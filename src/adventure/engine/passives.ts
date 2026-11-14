/**
 * Fighter passives (spec §2). Each is a small hand-coded behaviour hooked into
 * the fight at a fixed point; every number comes from `tuning`, so skill nodes
 * can reshape them. The combo counter itself runs for every fighter (it feeds
 * the HUD and `comboReach` challenges); Sly Fox turns it into damage.
 */
import { comboWindowFor } from '../data/passives';
import type { Card } from '@/types';
import type { PassiveId, PassiveState } from '../types';
import { BASE_RULES } from '../data/rules';
import { emit, hasPassive, redeal, touchable, tuning, updateCards, type Draft } from './fight';
import { allSets } from './sets';

export const restingPassiveState = (): PassiveState => ({
  nineLivesLeft: 0,
  hotStreak: false,
  grudge: 0,
  thickHideLeft: 0,
  zoomiesIn: 0,
  scoopIn: 0,
  keenEyeCardId: null,
});

/** Fresh state for the start of a fight (call once the run's sources are known). */
export const initPassives = (d: Draft) => {
  const has = (id: PassiveId) => hasPassive(d, id);
  d.passive = {
    ...restingPassiveState(),
    nineLivesLeft: has('nine_lives') ? Math.max(0, tuning(d, 'nineLives.charges')) : 0,
    thickHideLeft: has('thick_hide') ? Math.max(0, tuning(d, 'thickHide.perWave')) : 0,
    zoomiesIn: has('zoomies') ? Math.max(1, tuning(d, 'zoomies.every')) : 0,
    scoopIn: has('big_scoop') ? Math.max(1, tuning(d, 'scoop.every')) : 0,
  };
};

export const onWaveStartPassives = (d: Draft) => {
  if (hasPassive(d, 'thick_hide')) d.passive.thickHideLeft = Math.max(0, tuning(d, 'thickHide.perWave'));
};

// ─── Combo & Hot Streak ─────────────────────────────────────────────────────

const comboSteps = (d: Draft) => Math.max(0, d.combo - 1);

const noteCombo = (d: Draft) => {
  d.maxCombo = Math.max(d.maxCombo, d.combo);
  if (d.combo > 1) emit(d, 'combo', d.combo);
  if (hasPassive(d, 'hot_streak') && !d.passive.hotStreak && comboSteps(d) >= tuning(d, 'combo.max')) {
    d.passive.hotStreak = true;
    emit(d, 'hot_streak');
  }
};

export const comboWindowMs = (d: Draft) => comboWindowFor(tuning(d, 'combo.windowMs'), d.attributes.length);

/** A Set extends the chain if it lands inside the window, else starts a new one. */
export const advanceCombo = (d: Draft) => {
  d.combo = d.combo > 0 && d.elapsedMs - d.lastMatchAtMs <= comboWindowMs(d) ? d.combo + 1 : 1;
  noteCombo(d);
};

export const addComboSteps = (d: Draft, n: number) => {
  if (n <= 0) return;
  d.combo = Math.max(1, d.combo) + n;
  noteCombo(d);
};

export const decayCombo = (d: Draft) => {
  if (d.combo > 0 && d.elapsedMs - d.lastMatchAtMs > comboWindowMs(d)) d.combo = 0;
};

/** Hot Streak: returns the multiplier for this Set (1 when not armed) and disarms it. */
export const consumeHotStreak = (d: Draft): number => {
  if (!d.passive.hotStreak) return 1;
  d.passive.hotStreak = false;
  return Math.max(1, tuning(d, 'hotStreak.multiplier'));
};

// ─── Set scoring ────────────────────────────────────────────────────────────

/** Flat damage the passives add to the Set being scored (Scrappy, Combo, Grudge, Patience). */
/**
 * Emperor Penguin's Patience window: a fixed time per active trait, so about
 * the same share of Sets count as "patient" at 2 traits as at 5.
 */
export const patienceMs = (d: Draft): number => tuning(d, 'patience.msPerTrait') * d.attributes.length;

export const passiveSetDamage = (d: Draft, sinceLastMs: number): number => {
  let bonus = 0;
  if (hasPassive(d, 'scrappy') && d.hearts !== null && d.maxHearts !== null) {
    bonus += Math.max(0, d.maxHearts - d.hearts) * tuning(d, 'scrappy.perHeart');
  }
  if (hasPassive(d, 'combo')) bonus += Math.min(comboSteps(d), tuning(d, 'combo.max')) * tuning(d, 'combo.perStep');
  if (hasPassive(d, 'grudge') && d.passive.grudge > 0) {
    const release = d.passive.grudge * tuning(d, 'grudge.damage');
    emit(d, 'grudge_release', release);
    d.passive.grudge = 0;
    bonus += release;
  }
  if (hasPassive(d, 'patience') && sinceLastMs >= patienceMs(d)) {
    const p = tuning(d, 'patience.damage');
    emit(d, 'patience', p);
    bonus += p;
  }
  return bonus;
};

const isPower = (c: Card) => (c.bonusPoints ?? 0) > 0;
const isGold = (c: Card) => (c.bonusMoney ?? 0) > 0;

/** Turn up to `n` ordinary cards (not in `skip`) into power or gold cards. Returns the slots that changed. */
const grantBonusCards = (d: Draft, n: number, kind: 'power' | 'gold', skip: Set<string>): number[] => {
  if (n <= 0) return [];
  const has = kind === 'power' ? isPower : isGold;
  const slots = d.board.map((c, i) => (touchable(d, i) && !skip.has(c.id) && !has(c) ? i : -1)).filter(i => i >= 0);
  const chosen = d._rng.shuffle(slots).slice(0, n);
  updateCards(d, chosen, c =>
    kind === 'power' ? { ...c, bonusPoints: (c.bonusPoints ?? 0) + BASE_RULES.powerCardBonus } : { ...c, bonusMoney: BASE_RULES.coinCardValue }
  );
  return chosen;
};

/** Fetch: each kind of bonus card in the Set brings a new one onto the board. */
const fetchBonusCards = (d: Draft, matched: Card[]) => {
  const n = Math.max(0, tuning(d, 'fetch.count'));
  const ids = new Set(matched.map(c => c.id));
  const fetched: number[] = [];
  if (matched.some(isPower)) fetched.push(...grantBonusCards(d, n, 'power', ids));
  if (d.features.has('coins') && matched.some(isGold)) fetched.push(...grantBonusCards(d, n, 'gold', ids));
  if (fetched.length > 0) emit(d, 'fetch', fetched.length, undefined, { slots: fetched });
};

/**
 * After a Set is scored: Deep Freeze on Rainbows, Fetch, Zoomies and Big Scoop.
 * `auto` Sets (scooped or echoed) don't count toward the next scoop.
 */
export const afterSetPassives = (d: Draft, matched: Card[], rainbow: boolean, auto: boolean) => {
  d.passive.keenEyeCardId = null;
  if (rainbow && hasPassive(d, 'deep_freeze')) {
    const ms = tuning(d, 'deepFreeze.ms');
    d.frozenMs = Math.max(d.frozenMs, ms);
    emit(d, 'freeze', ms);
  }
  if (hasPassive(d, 'fetch')) fetchBonusCards(d, matched);
  if (hasPassive(d, 'zoomies')) {
    d.passive.zoomiesIn -= 1;
    if (d.passive.zoomiesIn <= 0) {
      d.passive.zoomiesIn = Math.max(1, tuning(d, 'zoomies.every'));
      redeal(d);
      grantBonusCards(d, tuning(d, 'zoomies.powerCards'), 'power', new Set());
    }
  }
  if (hasPassive(d, 'big_scoop') && !auto) {
    d.passive.scoopIn -= 1;
    if (d.passive.scoopIn <= 0) {
      d.passive.scoopIn = Math.max(1, tuning(d, 'scoop.every'));
      emit(d, 'scoop');
      d._hooks.autoSet(d, 'scoop');
    }
  }
};

// ─── Mistakes & time ────────────────────────────────────────────────────────

/** Grudge stores, the combo breaks. Returns true when Thick Hide spares the heart. */
export const onMistakePassives = (d: Draft): boolean => {
  d.combo = 0;
  d.passive.hotStreak = false;
  if (hasPassive(d, 'grudge') && d.passive.grudge < tuning(d, 'grudge.max')) {
    d.passive.grudge += 1;
    emit(d, 'grudge', d.passive.grudge);
  }
  if (d.passive.thickHideLeft > 0) {
    d.passive.thickHideLeft -= 1;
    emit(d, 'thick_hide', d.passive.thickHideLeft);
    return true;
  }
  return false;
};

/** Keen Eye: after a quiet stretch, one card of a Set glows. */
export const tickPassives = (d: Draft) => {
  if (!hasPassive(d, 'keen_eye')) return;
  const glowing = d.passive.keenEyeCardId;
  if (glowing && d.board.some(c => c.id === glowing && !d.replacing.includes(c.id))) return;
  d.passive.keenEyeCardId = null;
  if (d.elapsedMs - d.lastMatchAtMs < tuning(d, 'keenEye.ms')) return;
  const sets = allSets(d.board.filter(c => !d.replacing.includes(c.id)), d.attributes);
  if (sets.length === 0) return;
  const card = d._rng.pick(d._rng.pick(sets));
  d.passive.keenEyeCardId = card.id;
  emit(d, 'keen_eye', undefined, undefined, { slots: [d.board.findIndex(c => c.id === card.id)] });
};
