/**
 * The adventure run engine: one attempt at one level.
 *
 * `createRun` builds the starting state; `runReducer` applies actions.
 * Randomness goes through a seeded RNG stored in state and time through
 * `elapsedMs`, so a run is replayable from (seed, actions). The headless
 * balance bot (engine/bot.ts) drives this same reducer.
 *
 * Every action ends the same way: queued fight events are resolved against
 * the live rules (rules/engine.ts `drain`), then `resolve` decides what's next.
 *
 * Note: foes are EnemyInstance objects with internal timers (mutable). They're
 * owned by the run and only touched inside the reducer.
 */
import type { Card, CardReward, Weapon } from '@/types';
import type { EnemyEvent } from '@/types/enemy';
import type { WeaponEffectResult } from '@/utils/weaponEffects';
import { createDeck } from '@/utils/gameUtils';
import { MATCH_REWARDS, getBoardSizeForAttributes } from '@/utils/gameConfig';
import { getAdjacentIndices } from '@/utils/weaponEffects';
import { getLinkedDestructionPositions, selectPositionsToConnect } from '@/utils/connectionUtils';
import { DEFAULT_PLAYER_STATS, canObtainWeapon } from '@/utils/gameDefinitions';
import { createInitialRoundStats } from '@/game/roundStats';
import type { AdventureSave, AdventureWeapon, ArcanaId, FeatureFlag, LevelDef, RunEventType, RunState } from '../types';
import type { Effect, WeaponTriggerKind } from '../rules/types';
import { createRng } from './rng';
import { allSets, countDifferentAttributes, hasAnySet, isRainbow, isSelectable } from './sets';
import { applyWeaponToStats, resolveWholeStats, startingLoadout } from '../loadout';
import { getArmoryWeapon, understudyOf } from '../data/armory';
import { UNDERSTUDY_ID } from '../data/adventureWeapons';
import { weaponBuilds } from '../weaponLevels';
import { createFoe } from '../data/foes';
import { arcanaRules } from '../data/arcana';
import { BASE_RULES } from '../data/rules';
import { challengeProgress } from './challenges';
import {
  addCoins, addConnection, addRandomConnections, addTime, addXp, announceDraw, arcana, begin, chanceStatsOf, dealDamage, drawCard,
  emit, enqueue, finish, foeMultiplier, heal, hurt, igniteCards, keepCatalystMatchable, mods, newLinkSlots, placeCatalyst,
  pruneConnections, recycle, refill, refreshSources, rollBridges, syncTraps, toDeckCard, tuning, updateCards,
  MAX_BOARD, type Draft, type FightHooks, TIME_HEADROOM,
} from './fight';
import { EVOLUTION_RULES } from './sources';
import { recordFightStart, recordLog } from './fightLog';
import { afterSetGear, gearSetBonus, holdCards, initGear, onMistakeGear, onWaveStartGear, resolveTwins, syncGear, tickGear, type GearSet } from './gear';
import { refreshArmedRecipes, resolveCatalyst, tickEvolutions } from './evolutions';
import { placeOpeningTraps, resolveTrapsOnSet, springSnares, tickTimeBombs } from './hazards';
import { initialSurge, surgeMultiplier, tickSurge } from './surge';
import {
  advanceCombo, afterSetPassives, consumeHotStreak, decayCombo, initPassives, onMistakePassives, onWaveStartPassives,
  passiveSetDamage, restingPassiveState, tickPassives,
} from './passives';
import { applyEffect, checkIdle, conditionsHold, drain, resetFoeBelowRules, resetIdleRules, weaponFired } from '../rules/engine';

export { xpForLevel } from './fight';
export { passiveTuningOf } from './fight';

/** What one matched card is worth before weapons and foes get involved. */
export const baseCardReward = (c: Card): CardReward => ({
  cardId: c.id,
  points: MATCH_REWARDS.basePoints + (c.bonusPoints ?? 0) + (c.charge ?? 0),
  money: MATCH_REWARDS.baseMoney + (c.bonusMoney ?? 0),
  experience: MATCH_REWARDS.baseExperience,
});

export type RunAction =
  | { type: 'MATCH'; cards: Card[]; rewards: CardReward[]; effects?: WeaponEffectResult }
  | { type: 'INVALID'; cards: Card[] }
  | { type: 'REPLACE'; ids: string[] }
  | { type: 'BURN'; card: Card }
  | { type: 'TICK'; ms: number }
  | { type: 'USE_HINT' }
  | { type: 'PICK'; weaponId: string | null }
  | { type: 'BUY'; index: number }
  | { type: 'REROLL' }
  | { type: 'NEXT_WAVE' }
  | { type: 'CLEAR_EVENTS'; upTo: number };

// ─── Helpers ────────────────────────────────────────────────────────────────

const scaledFoeHp = (baseHp: number, arcanaIds: ArcanaId[]): number => {
  const scale = arcanaRules(arcanaIds).foeHpScale;
  return scale === undefined ? baseHp : Math.max(1, Math.round(baseHp * scale));
};

const ENEMY_EVENT_MAP: Partial<Record<EnemyEvent['type'], RunEventType>> = {
  card_became_dud: 'dud',
  card_became_facedown: 'face_down',
  positions_shuffled: 'shuffle',
  attribute_changed: 'attr_shift',
  card_removed: 'card_removed',
  inactivity_penalty: 'inactivity',
  time_stolen: 'time_stolen',
  bomb_placed: 'bomb',
  countdown_warning: 'countdown',
};

/** Board slots of the cards with these ids (cards that already left are skipped). */
const slotsOf = (d: Draft, ids: readonly string[]): number[] =>
  ids.map(id => d.board.findIndex(c => c.id === id)).filter(i => i >= 0);

const emitEnemyEvents = (d: Draft, events: EnemyEvent[]) => {
  for (const e of events) {
    const t = ENEMY_EVENT_MAP[e.type];
    if (!t) continue;
    const ids = 'cardIds' in e ? e.cardIds : 'cardId' in e ? [e.cardId] : [];
    emit(d, t, undefined, undefined, { slots: slotsOf(d, ids) });
  }
};

const syncStats = (d: Draft) => {
  const s = d.roundStats;
  s.timeRemaining = Math.ceil(d.timeLeft ?? 0);
  s.cardsRemaining = d.board.length;
  s.hintsRemaining = d.stats.hints;
  s.gracesRemaining = d.stats.graces;
  s.currentScore = d.totalDamage;
};

/** Armory weapons not already held: each weapon is one item, so a fight never offers a second copy. */
const rollPickOptions = (d: Draft, count = 3): Weapon[] => {
  const weapons = d.armory
    .filter(id => !d.weapons.some(w => w.id === id))
    .map(id => getArmoryWeapon(id, d.weaponBuilds))
    .filter((w): w is Weapon => !!w && canObtainWeapon(w, d.weapons));
  // Offers come from their own stream: what you are shown never changes how the fight itself plays out
  const offers = createRng((d._rng.state ^ 0x51ed270b) + d.levelUpsTaken * 7919 + d.rerolls * 104729 + d.wave * 1299709);
  return offers.shuffle(weapons).slice(0, count);
};

const acquireWeapon = (d: Draft, picked: Weapon) => {
  // An Understudy picked up mid-fight copies the weapon picked up before it
  const built = picked.id === UNDERSTUDY_ID ? understudyOf(picked, d.weapons[d.weapons.length - 1]?.id, d.weaponBuilds) : picked;
  const weapon: Weapon = { ...built, effects: resolveWholeStats(built.effects, () => d._rng.next()) };
  d.weapons = [...d.weapons, weapon];
  d.stats = applyWeaponToStats(d.stats, weapon);
  const base = { ...d.baseChances };
  for (const k of Object.keys(base)) {
    const v = (weapon.effects as Record<string, number | undefined>)[k];
    if (typeof v === 'number') base[k] += v;
  }
  d.baseChances = base;
  const m = (weapon as AdventureWeapon).modifiers;
  const heartsLocked = arcana(d).maxHeartsLock !== undefined;
  const extraHearts = (weapon.effects.maxHealth ?? 0) + (m?.maxHearts ?? 0);
  if (extraHearts && d.hearts !== null && d.maxHearts !== null && !heartsLocked) {
    d.maxHearts = Math.max(1, d.maxHearts + extraHearts);
    d.hearts = Math.min(d.maxHearts, d.hearts + Math.max(0, (weapon.effects.health ?? 0) + (m?.maxHearts ?? 0)));
  }
  if (m?.coinPercent) d.coinBonusPercent += m.coinPercent;
  refreshArmedRecipes(d);
  refreshSources(d);
};

/** Decide what happens next after any state change. Order matters. */
const resolve = (d: Draft) => {
  if (d.status === 'won' || d.status === 'lost') return;
  syncStats(d);
  if (d.status !== 'playing') return;

  if (d.foeHp <= 0) {
    if (d.wave < d.level.foes.length - 1) {
      emit(d, 'foe_defeated');
      d.status = 'intermission';
      if (d.features.has('shop')) d.shopOptions = rollPickOptions(d, 3);
      return;
    }
    d.status = 'won';
    d.endReason = 'defeated';
    d.challengeMet = challengeProgress(d).met;
    emit(d, 'foe_defeated');
    return;
  }
  if (d.hearts !== null && d.hearts <= 0) {
    d.status = 'lost';
    d.endReason = 'hearts';
    return;
  }
  if (d.movesLeft !== null && d.movesLeft <= 0) {
    d.status = 'won';
    d.endReason = 'survived';
    emit(d, 'moves_out');
    return;
  }
  if (d.timeLeft !== null && d.timeLeft <= 0) {
    d.status = 'won';
    d.endReason = 'survived';
    emit(d, 'time_up');
    return;
  }
  if (d.pendingPicks > 0) {
    d.pickOptions = rollPickOptions(d, (arcana(d).pickOptions ?? BASE_RULES.pickOptions) + (mods(d).pickOptions ?? 0));
    if (d.pickOptions.length === 0) d.pendingPicks = 0;
    else d.status = 'pick';
  }
};

// ─── Scoring a Set ──────────────────────────────────────────────────────────

const PURITY_DAMAGE = [0, 0, 1, 3, 5, 8];

/** Escalating Purity: returns the bonus damage and coins for this Set. */
const advancePurity = (d: Draft, diffCount: number, graceUsed: boolean): { damage: number; coins: number } => {
  if (!d.features.has('purity')) return { damage: 0, coins: 0 };
  if (graceUsed || diffCount === 0) {
    d.purityChain = 0;
    d.lastDiffCount = 0;
    return { damage: 0, coins: 0 };
  }
  if (d.purityChain === 0 || diffCount <= d.lastDiffCount) {
    // A repeated or lower diversity starts a new climb at this diversity
    d.purityChain = 1;
    d.lastDiffCount = diffCount;
    return { damage: 0, coins: 0 };
  }
  d.purityChain += 1;
  d.lastDiffCount = diffCount;
  d.maxPurityChain = Math.max(d.maxPurityChain, d.purityChain);
  d.purityChainsTriggered += 1;
  if (d.purityChain >= 3) d.threeStepPuritiesTriggered += 1;
  const damage = PURITY_DAMAGE[Math.min(d.purityChain, PURITY_DAMAGE.length - 1)];
  const coins = d.purityChain - 1;
  const reachedMax = diffCount === d.attributes.length;
  emit(d, reachedMax ? 'purity_max' : 'purity', d.purityChain, `Purity ×${d.purityChain}`);
  if (reachedMax) {
    d.purityChain = 0;
    d.lastDiffCount = 0;
  }
  return { damage, coins };
};

/**
 * What the Set's weapons did on the board (GameBoard rolled them). Their damage
 * is already inside the Set's own hit, so these events carry no amount: they
 * say what happened and where, for the effects, the band and the fight log.
 */
const emitBoardWeapons = (d: Draft, rewards: CardReward[], fx: WeaponEffectResult | undefined) => {
  const place = (cards: readonly Card[]) => {
    const on = cards.map(c => ({ c, i: d.board.findIndex(b => b.id === c.id) })).filter(x => x.i >= 0);
    return { slots: on.map(x => x.i), cards: on.map(x => ((x.c.health ?? 1) > 1 ? null : d.board[x.i])) };
  };
  const tell = (type: 'blast' | 'laser' | 'ricochet' | 'link_burst' | 'echo', cards: readonly Card[]) => {
    const at = place(cards);
    if (at.slots.length) emit(d, type, undefined, String(at.slots.length), type === 'echo' ? { slots: at.slots } : at);
  };
  if (fx) {
    tell('blast', fx.explosiveCards);
    tell('laser', fx.laserCards);
    tell('ricochet', fx.ricochetCards);
    fx.autoMatchedSets.forEach(set => tell('echo', set));
  }
  const linked = new Set(rewards.filter(r => r.effectType === 'connected').map(r => r.cardId));
  if (linked.size) tell('link_burst', d.board.filter(c => linked.has(c.id)));
};

/** Weapon effects GameBoard rolled for this Set: queue their triggers (and replay one if a double is waiting). */
const fireBoardWeapons = (d: Draft, fx: WeaponEffectResult) => {
  const fired: [boolean, Parameters<typeof weaponFired>[1], Effect][] = [
    [fx.explosiveCards.length > 0, 'explosion', { do: 'explode', area: { shape: 'random', count: fx.explosiveCards.length } }],
    [fx.laserCards.length > 0, 'laser', { do: 'laser', area: { shape: 'random', count: fx.laserCards.length } }],
    [fx.fireCards.length > 0, 'fire', { do: 'ignite', count: fx.fireCards.length }],
    [fx.ricochetCards.length > 0, 'ricochet', { do: 'ricochet', count: fx.ricochetCards.length }],
    [fx.autoMatchedSets.length > 0, 'echo', { do: 'trigger', kind: 'echo' }],
    [fx.bonusHealing > 0, 'heal', { do: 'heal', amount: fx.bonusHealing }],
    [fx.bonusCoins > 0, 'coin', { do: 'coins', amount: fx.bonusCoins }],
    [fx.bonusTime > 0, 'time', { do: 'time', seconds: fx.bonusTime }],
    [fx.bonusHints > 0, 'hint', { do: 'hint', amount: fx.bonusHints }],
    [fx.bonusGraces > 0, 'grace', { do: 'grace', amount: fx.bonusGraces }],
    [fx.bonusExperience > 0, 'xp', { do: 'xp', amount: fx.bonusExperience }],
    [fx.boardGrowth > 0, 'growth', { do: 'growBoard', count: fx.boardGrowth }],
  ];
  for (const [on, kind, replay] of fired) if (on) weaponFired(d, kind, replay);
};

interface MatchOptions {
  /** Scored for the player (Big Scoop, echo triggers): costs no move; the caller replaces the cards at once */
  auto?: boolean;
}

/** Score a Set: traps, foe reaction, damage, rewards, weapon triggers, Catalyst, passives. */
const applyMatch = (d: Draft, cards: Card[], rewards: CardReward[], fx: WeaponEffectResult | undefined, opts: MatchOptions = {}) => {
  const matched = cards.slice(0, 3);
  const prevCtx = d._setCtx;
  const graceUsed = rewards.some(r => r.effectType === 'grace');
  d.replacing = [...new Set([...d.replacing, ...cards.map(c => c.id)])];

  const traps = resolveTrapsOnSet(d, matched);

  // Enemy reaction first (time theft, extra removals, flips)
  const enemyResult = d.foe.onValidMatch(matched, d.board);
  const statMods = d.foe.getStatModifiers();
  emitEnemyEvents(d, enemyResult.events);

  const diffCount = !graceUsed ? countDifferentAttributes(matched, d.attributes) : 0;
  const rainbow = d.features.has('rainbow') && !graceUsed && isRainbow(matched, d.attributes);
  const sinceLastMs = d.elapsedMs - d.lastMatchAtMs;
  d._setCtx = { diffCount, rainbow, sinceLastMs, firstOfWave: d.setsThisWave === 0, matchNo: d.matches + 1 };
  const purity = advancePurity(d, diffCount, graceUsed);

  // Damage
  const hotStreak = consumeHotStreak(d);
  advanceCombo(d);
  const m = mods(d);
  const a = arcana(d);
  let points = rewards.reduce((sum, r) => sum + (r.points ?? 0), 0);
  // Shading Surge: the Set's base damage (its cards) is ×5; flat bonuses are added after, multipliers apply on top
  const surgeMult = surgeMultiplier(d);
  points *= surgeMult;
  if (a.nonRainbowDamageDelta !== undefined && !rainbow) points = Math.max(1, points + a.nonRainbowDamageDelta);
  if (a.singleTraitBonusDamage !== undefined && !graceUsed && diffCount === 1) points += a.singleTraitBonusDamage;
  const conditional = (m.conditionalDamage ?? []).reduce((sum, c) => sum + (conditionsHold(d, c.when) ? c.amount : 0), 0);
  const gearSet: GearSet = {
    matched,
    slots: matched.map(mc => d.board.findIndex(bc => bc.id === mc.id)).filter(i => i >= 0),
    diffCount,
    graceUsed,
    auto: !!opts.auto,
  };
  const tricks = gearSetBonus(d, gearSet);
  // Rust can take damage off a Set, never below nothing
  const flat = Math.max(
    0,
    points + d.bonusDamagePerMatch + (m.setDamage ?? 0) + conditional + passiveSetDamage(d, sinceLastMs) + tricks.flat +
      d.activeEvolutions.length * EVOLUTION_RULES.setDamage
  );
  const rainbowMult =
    (rainbow ? (a.rainbowMultiplier ?? BASE_RULES.rainbowMultiplier) + (m.rainbowMultiplierBonus ?? 0) : 1) *
    (d.activeEvolutions.length > 0 ? EVOLUTION_RULES.setMultiplier : 1);
  const enemyMult = (enemyResult.pointsMultiplier || 1) * (statMods.pointsMultiplier || 1);
  // "Next Set ×N" effects and Hot Streak together top out at the same cap (data/rules.ts)
  const setMult = Math.min(BASE_RULES.maxNextSetMultiplier, d.nextSetMultiplier * hotStreak) * tricks.multiplier;
  d.nextSetMultiplier = 1;
  const dmg = flat * rainbowMult * (a.damageScale ?? 1) * enemyMult * setMult + (purity.damage + traps.bonus) * enemyMult;
  const hit = dealDamage(d, dmg);
  emit(d, surgeMult > 1 ? 'surge_hit' : rainbow ? 'rainbow' : 'hit', hit, undefined, { slots: gearSet.slots });
  if (surgeMult > 1 && d.surge) d.surge = { ...d.surge, sets: d.surge.sets + 1 };
  if (!opts.auto) emitBoardWeapons(d, rewards, fx);
  if (opts.auto) {
    d._lines[d._lines.length - 1].text = 'Free Set';
  } else {
    const matchedIds = new Set(matched.map(c => c.id));
    const collateral: NonNullable<RunState['log'][number]['set']>['collateral'] = {};
    for (const r of rewards) {
      if (matchedIds.has(r.cardId) || !r.effectType) continue;
      collateral[r.effectType] = (collateral[r.effectType] ?? 0) + (r.points ?? 0);
    }
    d._logSet = {
      cards: rewards.filter(r => matchedIds.has(r.cardId)).reduce((sum, r) => sum + (r.points ?? 0), 0),
      collateral,
      flatBonus: flat - points,
      multiplier: rainbowMult * (a.damageScale ?? 1) * enemyMult * setMult,
      rainbow,
      extra: (purity.damage + traps.bonus) * enemyMult,
      hit,
      diffTraits: diffCount,
      graceUsed,
      sinceLastMs,
      combo: d.combo,
    };
  }
  if (hotStreak > 1) emit(d, 'hot_streak_hit', hotStreak);
  resolveTwins(d, matched);
  holdCards(d, matched);
  afterSetGear(d, gearSet);
  springSnares(d, traps.sprung);

  // Bookkeeping & stats for defeat conditions
  d.matches += 1;
  d.setsThisWave += 1;
  if (d.movesLeft !== null && !opts.auto) d.movesLeft -= 1;
  const s = d.roundStats;
  s.totalMatches += 1;
  s.currentStreak += 1;
  s.maxStreak = Math.max(s.maxStreak, s.currentStreak);
  s.matchTimes.push(sinceLastMs);
  s.consecutiveInvalidMatches = 0;
  d.lastMatchAtMs = d.elapsedMs;
  for (const c of matched) {
    s.shapesMatched.add(c.shape);
    s.colorsMatched.add(c.color);
    s.colorMatchCounts.set(c.color, (s.colorMatchCounts.get(c.color) ?? 0) + 1);
  }
  if (isRainbow(matched, d.attributes)) s.allDifferentMatches += 1;
  if (matched.every(c => c.color === matched[0].color)) s.allSameColorMatches += 1;
  if (matched.some(c => c.shape === 'squiggle')) s.squiggleMatches += 1;
  s.faceDownCardsMatched += matched.filter(c => c.wasOriginallyFaceDown || c.isFaceDown).length;
  s.bombsDefused += matched.filter(c => c.hasBomb).length;
  s.countdownCardsMatched += matched.filter(c => c.hasCountdown).length;
  const bonusCards = matched.filter(c => (c.bonusPoints ?? 0) > 0 || (c.bonusMoney ?? 0) > 0).length;
  d.bonusCardsMatched += bonusCards;
  if (graceUsed) {
    d.stats = { ...d.stats, graces: Math.max(0, d.stats.graces - 1) };
    s.gracesUsed += 1;
    emit(d, 'grace');
  }

  // Rewards
  const money = rewards.reduce((sum, r) => sum + (r.money ?? 0), 0) + (fx?.bonusCoins ?? 0) + purity.coins;
  addCoins(d, money);
  const xp = rewards.reduce((sum, r) => sum + (r.experience ?? 0), 0) + (fx?.bonusExperience ?? 0);
  addXp(d, xp);
  heal(d, rewards.reduce((sum, r) => sum + (r.healing ?? 0), 0) + (fx?.bonusHealing ?? 0));
  let hints = rewards.reduce((sum, r) => sum + (r.hint ?? 0), 0) + (fx?.bonusHints ?? 0);
  if (d.features.has('coins') && money > 0 && !(fx && fx.bonusCoins > 0)) {
    for (const bw of rollBridges(d, 'onCoinGain')) if (bw.bridgeEffect?.effect === 'gainHint') hints += bw.bridgeEffect.amount ?? 1;
  }
  if (d.features.has('xp') && xp > 0 && !(fx && fx.bonusExperience > 0)) {
    for (const bw of rollBridges(d, 'onXPGain')) if (bw.bridgeEffect?.effect === 'gainCoin') addCoins(d, bw.bridgeEffect.amount ?? 1);
  }
  if (hints > 0 && d.features.has('hints')) {
    d.stats = { ...d.stats, hints: Math.min(d.stats.maxHints, d.stats.hints + hints) };
    emit(d, 'hint', hints);
  }
  if (fx?.bonusGraces && d.features.has('graces')) {
    d.stats = { ...d.stats, graces: Math.min(d.stats.maxGraces, d.stats.graces + fx.bonusGraces) };
  }
  const connected = rewards.filter(r => r.effectType === 'connected').length;
  const linkTimeBonus = connected * (d.stats.echoTimeBonusPerLink || 0);
  const arcanaTimeBonus = (rainbow ? a.rainbowTimeBonus ?? 0 : 0) + (a.setTimeBonus ?? 0);
  addTime(d, (fx?.bonusTime ?? 0) + (enemyResult.timeDelta ?? 0) + arcanaTimeBonus + linkTimeBonus);
  if (fx) {
    if (fx.explosiveCards.length) {
      s.weaponEffectsTriggered.add('explosion');
      d.explosionsTriggered += 1;
    }
    if (fx.laserCards.length) s.weaponEffectsTriggered.add('laser');
    // Support effects count as weapon effects too (e.g. Goblin Saboteur wants 3 different ones)
    const support: [number, string][] = [
      [fx.bonusHealing, 'heal'], [fx.bonusHints, 'hint'], [fx.bonusTime, 'time'], [fx.bonusGraces, 'grace'],
      [fx.bonusCoins, 'coin'], [fx.bonusExperience, 'xp'], [fx.boardGrowth, 'growth'], [fx.autoMatchedSets.length, 'echo'],
    ];
    for (const [amount, kind] of support) if (amount > 0) s.weaponEffectsTriggered.add(kind);
    if (fx.ricochetCards.length) s.weaponEffectsTriggered.add('ricochet');
    if (fx.fireCards.length) {
      s.weaponEffectsTriggered.add('fire');
      const ids = new Set(fx.fireCards.map(c => c.id));
      const stamp = d.elapsedMs + 1;
      d.board = d.board.map(c => (ids.has(c.id) && !c.onFire ? { ...c, onFire: true, fireStartTime: stamp } : c));
      emit(d, 'fire', fx.fireCards.length, undefined, { slots: slotsOf(d, [...ids]) });
    }
  }

  // Enemy board effects (no replacement)
  if (enemyResult.cardsToFlip.length) {
    const flip = new Set(enemyResult.cardsToFlip);
    d.board = d.board.map(c => (flip.has(c.id) ? { ...c, isFaceDown: false, wasOriginallyFaceDown: true } : c));
  }
  if (enemyResult.cardsToRemove.length) {
    const rm = new Set(enemyResult.cardsToRemove);
    const keep = new Set(cards.map(c => c.id));
    d.board = d.board.filter(c => !rm.has(c.id) || keep.has(c.id));
    pruneConnections(d);
    emit(d, 'card_removed');
  }
  // A full board can't grow: no cards, and no "whenever the board grows" trigger
  let grown = 0;
  if (fx?.boardGrowth) {
    grown = Math.max(0, Math.min(fx.boardGrowth, MAX_BOARD - d.board.length));
    const first = d.board.length;
    for (let i = 0; i < grown; i++) d.board = [...d.board, drawCard(d)];
    if (grown > 0) emit(d, 'grow', grown, undefined, { slots: Array.from({ length: grown }, (_, i) => first + i) });
    for (let i = first; i < d.board.length; i++) announceDraw(d, d.board[i], i);
  }

  // Connector weapons: chance to link two of the matched board positions for the wave
  if (d.stats.connectionChance > 0 && d._rng.next() * 100 < d.stats.connectionChance) {
    const positions = matched.map(mc => d.board.findIndex(bc => bc.id === mc.id)).filter(p => p >= 0);
    const pair = selectPositionsToConnect(positions, d.connections);
    if (pair) {
      const before = d.connections.length;
      addConnection(d, pair[0], pair[1]);
      if (d.stats.bonusConnectionChance > 0 && d._rng.next() * 100 < d.stats.bonusConnectionChance) addRandomConnections(d, 1);
      emit(d, 'link', d.connections.length - before, undefined, { slots: newLinkSlots(d, before) });
    }
  }

  if (rainbow) d.rainbowRefill = true;
  resolveCatalyst(d, matched);

  // Rule triggers (resolved by drain at the end of the action)
  if (fx) fireBoardWeapons(d, { ...fx, boardGrowth: grown });
  enqueue(d, 'set');
  if (rainbow) enqueue(d, 'rainbow');
  if (bonusCards > 0) enqueue(d, 'bonusCardMatched');
  if (graceUsed) enqueue(d, 'graceUsed');
  for (let i = 0; i < connected; i++) enqueue(d, 'linkDestroyed');
  resetIdleRules(d);

  afterSetPassives(d, matched, rainbow, !!opts.auto);
  d._setCtx = prevCtx;
};

/**
 * Cards leaving the board after a Set or a miss: armored cards lose a hit, a
 * multi-hit card that breaks pays its bounty. Returns the slots to refill.
 */
const replaceCards = (d: Draft, ids: Set<string>, ended: boolean): number[] => {
  const indices: number[] = [];
  const broken: number[] = [];
  d.board = d.board.map((c, i) => {
    if (!ids.has(c.id)) return c;
    // A chained card matched alone and a fresh Tar Pit card stay for one more match (engine/gear.ts holdCards)
    if (c.stay) return { ...c, stay: false, selected: false };
    if ((c.health ?? 1) > 1) return { ...c, health: (c.health ?? 1) - 1, selected: false };
    if (c.health === 1) broken.push(i);
    indices.push(i);
    d.deck.push(toDeckCard(c));
    return c;
  });
  for (const i of broken) {
    const c = d.board[i];
    d.roundStats.tripleCardsCleared += 1;
    if (ended) continue;
    enqueue(d, 'cardBroken');
    if (c.bounty) emit(d, 'pinata_break', dealDamage(d, c.bounty * foeMultiplier(d)), undefined, { slots: [i] });
  }
  return indices;
};

/** Refill slots after cards left; a Catalyst that left unmatched moves to another card. */
const refillAfterLeaving = (d: Draft, indices: number[]) => {
  const hadCatalyst = indices.some(i => d.board[i]?.hasEvolutionItem);
  refill(d, indices, { rainbow: d.rainbowRefill });
  d.rainbowRefill = false;
  if (hadCatalyst) placeCatalyst(d, indices);
};

/** The weapon trigger a held weapon fires when something "triggers every weapon you hold". */
const WEAPON_TRIGGER: Partial<Record<NonNullable<Weapon['specialEffect']>, WeaponTriggerKind>> = {
  explosive: 'explosion',
  laser: 'laser',
  fire: 'fire',
  ricochet: 'ricochet',
  echo: 'echo',
  healing: 'heal',
  coinGain: 'coin',
  timeGain: 'time',
  hintGain: 'hint',
  graceGain: 'grace',
  xpGain: 'xp',
  boardGrowth: 'growth',
};

const autoSet = (d: Draft, source?: 'scoop') => {
  const sets = allSets(d.board.filter(c => !d.replacing.includes(c.id)), d.attributes);
  if (sets.length === 0) return;
  const set = d._rng.pick(sets);
  applyMatch(d, set, set.map(baseCardReward), undefined, { auto: true });
  const ids = new Set(set.map(c => c.id));
  d.replacing = d.replacing.filter(id => !ids.has(id));
  const indices = replaceCards(d, ids, false);
  if (indices.length) refill(d, indices);
  if (source === 'scoop') {
    const times = Math.max(0, tuning(d, 'scoop.weaponTriggers'));
    for (let t = 0; t < times; t++) {
      for (const w of d.weapons) {
        const kind = w.specialEffect && WEAPON_TRIGGER[w.specialEffect];
        if (kind) applyEffect(d, { do: 'trigger', kind });
      }
    }
  }
};

const HOOKS: FightHooks = { autoSet };

// ─── Setup ──────────────────────────────────────────────────────────────────

export interface CreateRunOptions {
  seed: number;
  /** Replace the level's accumulated features (dev tools & tests) */
  features?: Set<FeatureFlag>;
}

export const createRun = (level: LevelDef, save: AdventureSave, opts: CreateRunOptions): RunState => {
  const fighter = save.selectedFighter;
  const rng = createRng(opts.seed);
  const loadout = startingLoadout(level, save, opts.features, () => rng.next());
  const features = loadout.features;
  const gear = features.has('gear');
  const { stats, weapons, maxHearts, timer, bonusDamagePerMatch, coinBonusPercent } = loadout;
  const arcanaIds = gear ? loadout.arcana : [];
  const attributes = level.rules.attributes;
  const baseSize = level.rules.boardSize ?? getBoardSizeForAttributes(attributes.length);
  const boardSize = Math.min(MAX_BOARD, Math.max(baseSize, gear ? baseSize + (stats.fieldSize - DEFAULT_PLAYER_STATS.fieldSize) : baseSize));
  const first = createFoe(level.foes[0]);
  const rules = arcanaRules(arcanaIds);
  const untimedMoves = rules.untimedMoves;
  const startingMoves =
    level.rules.moves !== undefined
      ? untimedMoves && !level.rules.timer
        ? Math.max(untimedMoves.min, level.rules.moves + untimedMoves.delta)
        : level.rules.moves
      : null;
  const firstFoeHp = scaledFoeHp(level.foes[0].hp, arcanaIds);
  const totalFoeHp = level.foes.reduce((sum, f) => sum + scaledFoeHp(f.hp, arcanaIds), 0);

  const state: RunState = {
    level,
    fighter,
    features,
    rng: rng.state,
    attributes,
    deck: rng.shuffle(createDeck(attributes)).map(toDeckCard),
    board: [],
    connections: [],
    stats,
    baseChances: chanceStatsOf(stats),
    weapons: gear ? weapons : [],
    hearts: features.has('hearts') ? maxHearts : null,
    maxHearts: features.has('hearts') ? maxHearts : null,
    wave: 0,
    foe: first.foe,
    foeName: first.name,
    foeIcon: first.icon,
    foeHp: firstFoeHp,
    foeMaxHp: firstFoeHp,
    totalDamage: 0,
    biggestHit: 0,
    matches: 0,
    mistakes: 0,
    movesLeft: startingMoves,
    timeLeft: timer,
    timeCap: timer === null ? null : timer + TIME_HEADROOM,
    timeBank: timer === null ? null : Math.round(timer * BASE_RULES.maxTimeGainShare),
    gear: initGear(),
    elapsedMs: 0,
    lastMatchAtMs: 0,
    replacing: [],
    coins: 0,
    xp: 0,
    xpLevel: 0,
    pickOptions: [],
    pendingPicks: 0,
    status: 'playing',
    endReason: null,
    challengeMet: false,
    roundStats: createInitialRoundStats(totalFoeHp, stats.hints, stats.graces),
    events: [],
    eventSeq: 0,
    log: [],
    bonusDamagePerMatch,
    coinBonusPercent,
    shopOptions: [],
    rerolls: 0,
    armory: save.armory,
    weaponBuilds: weaponBuilds(save),
    passives: gear ? loadout.passives : [],
    passive: restingPassiveState(),
    skillNodes: gear ? loadout.skillNodes : [],
    ruleState: {},
    doubleNext: 0,
    nextSetMultiplier: 1,
    frozenMs: 0,
    simplified: null,
    surge: level.rules.shadingSurge ? initialSurge() : null,
    combo: 0,
    maxCombo: 0,
    setsThisWave: 0,
    freeMistakesLeft: gear ? loadout.modifiers.freeMistakes ?? 0 : 0,
    arcana: arcanaIds,
    arcanaBurnCooldownMs: 0,
    overkillDamage: 0,
    purityChain: 0,
    lastDiffCount: 0,
    maxPurityChain: 0,
    purityChainsTriggered: 0,
    threeStepPuritiesTriggered: 0,
    unlockedEvolutions: save.unlockedEvolutions,
    armedRecipes: [],
    activeEvolutions: [],
    evolutionsTriggered: 0,
    evolutionCap: loadout.evolutionCap,
    evolutionLabTier: loadout.evolutionLabTier,
    evolutionLikelihood: 0,
    forgedRecipes: [],
    rainbowRefill: false,
    timeBombIds: [],
    hazardRefills: { timeBombs: 0, snares: 0 },
    trapsDefused: 0,
    trapsSprung: 0,
    explosionsTriggered: 0,
    bonusCardsMatched: 0,
    levelUpsTaken: 0,
    shopBuys: 0,
  };

  const d = begin(state, HOOKS);
  refreshArmedRecipes(d);
  refreshSources(d);
  initPassives(d);
  // Deal a board that contains at least one Set
  for (let attempt = 0; attempt < 30; attempt++) {
    d.deck.push(...d.board.map(toDeckCard));
    d.deck = d._rng.shuffle(d.deck);
    const dealt: Card[] = [];
    for (let i = 0; i < boardSize; i++) dealt.push(drawCard(d));
    d.board = dealt;
    if (hasAnySet(d.board, attributes)) break;
  }
  d.events = []; // don't coach-mark the deal itself
  d._lines = [];
  startFoe(d);
  placeOpeningTraps(d);
  if (d.stats.startingConnections > 0) addRandomConnections(d, d.stats.startingConnections);
  enqueue(d, 'fightStart');
  enqueue(d, 'waveStart');
  drain(d);
  syncGear(d);
  syncStats(d);
  recordFightStart(d);
  return finish(d);
};

const startFoe = (d: Draft) => {
  const start = d.foe.onRoundStart(d.board);
  for (const mod of start.cardModifications) {
    d.board = d.board.map(c => (c.id === mod.cardId ? { ...c, ...mod.changes } : c));
  }
  emitEnemyEvents(d, start.events);
  if (d.board.some(c => (c.health ?? 1) > 1)) emit(d, 'triple');
  if (d.board.some(c => c.hasCountdown)) emit(d, 'countdown');
  if (d.board.some(c => c.hasBomb)) emit(d, 'bomb');
  if (d.board.some(c => c.isFaceDown)) emit(d, 'face_down');
};

// ─── Reducer ────────────────────────────────────────────────────────────────

export const runReducer = (state: RunState, action: RunAction): RunState => {
  if (action.type === 'CLEAR_EVENTS') {
    return { ...state, events: state.events.filter(e => e.id > action.upTo) };
  }
  const ended = state.status === 'won' || state.status === 'lost';
  if (ended && action.type !== 'REPLACE') return state;

  const d = begin(state, HOOKS);

  switch (action.type) {
    case 'MATCH': {
      if (d.status !== 'playing') return state;
      const before = d.totalDamage;
      applyMatch(d, action.cards, action.rewards, action.effects);
      drain(d);
      d.biggestHit = Math.max(d.biggestHit, d.totalDamage - before);
      break;
    }

    case 'INVALID': {
      if (d.status !== 'playing') return state;
      d.mistakes += 1;
      d.purityChain = 0;
      d.lastDiffCount = 0;
      d.replacing = [...new Set([...d.replacing, ...action.cards.map(c => c.id)])];
      const s = d.roundStats;
      s.invalidMatches += 1;
      s.currentStreak = 0;
      s.consecutiveInvalidMatches += 1;
      const mistakeBurn = arcana(d).mistakeBurn;
      if (onMistakePassives(d)) {
        // Thick Hide took it
      } else if (d.freeMistakesLeft > 0) {
        d.freeMistakesLeft -= 1;
        emit(d, 'free_mistake', d.freeMistakesLeft);
      } else if (mistakeBurn && d.arcanaBurnCooldownMs <= 0) {
        d.arcanaBurnCooldownMs = mistakeBurn.cooldownMs;
        igniteCards(d, mistakeBurn.cards);
        emit(d, 'arcana_burn');
      } else {
        hurt(d, Math.floor(1 * (d.foe.getStatModifiers().damageMultiplier || 1)));
      }
      onMistakeGear(d);
      emit(d, 'mistake');
      enqueue(d, 'mistake');
      const res = d.foe.onInvalidMatch(action.cards, d.board);
      if (res.cardsToRemove.length) {
        const rm = new Set(res.cardsToRemove);
        const picked = new Set(action.cards.map(c => c.id));
        d.board = d.board.filter(c => !rm.has(c.id) || picked.has(c.id));
        pruneConnections(d);
        emit(d, 'card_removed');
      }
      emitEnemyEvents(d, res.events);
      drain(d);
      break;
    }

    case 'REPLACE': {
      const ids = new Set(action.ids);
      d.replacing = d.replacing.filter(id => !ids.has(id));
      const indices = replaceCards(d, ids, ended);
      if (ended) {
        // keep the board stable behind the results screen
        return finish(d);
      }
      refillAfterLeaving(d, indices);
      drain(d);
      break;
    }

    case 'BURN': {
      if (d.status !== 'playing') return state;
      const idx = d.board.findIndex(c => c.id === action.card.id);
      if (idx === -1) return state;
      const linked = d.connections.length
        ? getLinkedDestructionPositions(d.connections, idx, new Set([idx])).filter(
            p => p >= 0 && p < d.board.length && (d.board[p].health ?? 1) <= 1 && !d.board[p].hasEvolutionItem
          )
        : [];
      const burned = [idx, ...linked];
      emit(d, 'hit', dealDamage(d, burned.length * (1 + (d.stats.burnDamage ?? 0)) * foeMultiplier(d)), 'Burn', { slots: burned });
      addCoins(d, burned.length);
      for (const bw of rollBridges(d, 'onDestruction')) if (bw.bridgeEffect?.effect === 'heal') heal(d, bw.bridgeEffect.amount ?? 1);
      // 10% chance the fire jumps to a neighbour
      if (d._rng.next() < 0.1) {
        const burnedSet = new Set(burned);
        const adj = getAdjacentIndices(idx, d.board.length).filter(i => d.board[i] && !d.board[i].onFire && !burnedSet.has(i) && !d.board[i].hasEvolutionItem);
        if (adj.length) {
          const t = d._rng.pick(adj);
          updateCards(d, [t], c => ({ ...c, onFire: true, fireStartTime: d.elapsedMs + 1 }));
        }
      }
      const hadCatalyst = burned.some(i => d.board[i].hasEvolutionItem);
      enqueue(d, 'cardBurned');
      linked.forEach(() => enqueue(d, 'linkDestroyed'));
      recycle(d, burned);
      if (hadCatalyst) placeCatalyst(d, burned);
      drain(d);
      break;
    }

    case 'TICK': {
      if (d.status !== 'playing') return state;
      d._clock = true;
      d.elapsedMs += action.ms;
      if (d.arcanaBurnCooldownMs > 0) d.arcanaBurnCooldownMs = Math.max(0, d.arcanaBurnCooldownMs - action.ms);
      decayCombo(d);
      if (d.frozenMs > 0) {
        // Deep Freeze & freeze effects: clock, foe, fuses, evolutions and Simplify stand still
        d.frozenMs = Math.max(0, d.frozenMs - action.ms);
      } else {
        tickClock(d, action.ms);
      }
      checkIdle(d);
      tickPassives(d);
      tickGear(d);
      drain(d);
      break;
    }

    case 'USE_HINT': {
      d.stats = { ...d.stats, hints: Math.max(0, d.stats.hints - 1) };
      d.roundStats.hintsUsed += 1;
      enqueue(d, 'hintUsed');
      drain(d);
      break;
    }

    case 'PICK': {
      if (d.status !== 'pick') return state;
      const w = action.weaponId ? d.pickOptions.find(x => x.id === action.weaponId) : undefined;
      if (w) acquireWeapon(d, w);
      d.pendingPicks = Math.max(0, d.pendingPicks - 1);
      d.pickOptions = [];
      d.status = 'playing';
      break;
    }

    case 'BUY': {
      if (d.status !== 'intermission') return state;
      const w = d.shopOptions[action.index];
      if (!w || d.coins < shopPrice(w)) return state;
      d.coins -= shopPrice(w);
      d.shopBuys += 1;
      acquireWeapon(d, w);
      d.shopOptions = d.shopOptions.filter((_, i) => i !== action.index);
      break;
    }

    case 'REROLL': {
      if (d.status !== 'intermission') return state;
      const cost = rerollCost(d);
      if (d.coins < cost) return state;
      d.coins -= cost;
      d.rerolls += 1;
      d.shopOptions = rollPickOptions(d, 3);
      break;
    }

    case 'NEXT_WAVE': {
      if (d.status !== 'intermission') return state;
      d.foe.onRoundEnd();
      heal(d, arcana(d).waveClearHeal ?? 0);
      d.wave += 1;
      const def = d.level.foes[d.wave];
      const next = createFoe(def);
      const hp = scaledFoeHp(def.hp, d.arcana);
      d.foe = next.foe;
      d.foeName = next.name;
      d.foeIcon = next.icon;
      d.foeHp = hp;
      d.foeMaxHp = hp;
      d.shopOptions = [];
      d.connections = [];
      d.setsThisWave = 0;
      d.status = 'playing';
      onWaveStartPassives(d);
      onWaveStartGear(d);
      resetFoeBelowRules(d);
      emit(d, 'wave', d.wave + 1);
      startFoe(d);
      if (d.stats.startingConnections > 0) addRandomConnections(d, d.stats.startingConnections);
      enqueue(d, 'waveStart');
      drain(d);
      break;
    }
  }

  keepCatalystMatchable(d);
  syncTraps(d);
  syncGear(d);
  resolve(d);
  recordLog(d, state, action);
  return finish(d);
};

/** Everything that runs on the fight clock (paused while frozen). */
const tickClock = (d: Draft, ms: number) => {
  const speed = (d.foe.getUIModifiers().timerSpeedMultiplier || 1) * (arcana(d).timerSpeedScale ?? 1);
  if (d.timeLeft !== null) d.timeLeft = Math.max(0, d.timeLeft - (ms / 1000) * speed);
  tickSurge(d, ms * speed);
  tickEvolutions(d, ms);
  if (d.simplified) {
    const remainingMs = d.simplified.remainingMs - ms;
    d.simplified = remainingMs > 0 ? { ...d.simplified, remainingMs } : null;
    if (!d.simplified) emit(d, 'simplify_end');
  }
  tickTimeBombs(d, ms);

  const tick = d.foe.onTick(ms * speed, d.board);
  emitEnemyEvents(d, tick.events);
  if (tick.scoreDelta < 0) {
    const healAmt = Math.min(-tick.scoreDelta, d.foeMaxHp - d.foeHp);
    if (healAmt > 0) {
      d.foeHp += healAmt;
      emit(d, 'regen', healAmt);
    }
  }
  if (tick.instantDeath && d.hearts !== null) hurt(d, d.hearts);
  else if (tick.healthDelta < 0) hurt(d, -tick.healthDelta);
  if (tick.cardsToRemove.length) {
    const rm = new Set(tick.cardsToRemove);
    d.board = d.board.filter(c => !rm.has(c.id));
    pruneConnections(d);
    if (!tick.events.some(e => e.type === 'card_removed')) emit(d, 'card_removed');
  }
  for (const mod of tick.cardModifications) {
    d.board = d.board.map(c => (c.id === mod.cardId ? { ...c, ...mod.changes } : c));
  }
  if (tick.cardsToFlip.length) {
    const flip = new Set(tick.cardsToFlip);
    d.board = d.board.map(c => (flip.has(c.id) ? { ...c, isFaceDown: false } : c));
  }
  if (tick.events.some(e => e.type === 'positions_shuffled')) d.board = d._rng.shuffle(d.board);
  // A shrinking or shifting board must never deadlock. Dud and face-down cards
  // go first: when foes have hidden every card, they are the only way out.
  if (!hasAnySet(d.board, d.attributes) && d.board.length >= 3) {
    const recyclable = d.board
      .map((_, i) => i)
      .filter(i => (d.board[i].health ?? 1) <= 1 && !d.replacing.includes(d.board[i].id));
    const stuck = d._rng.shuffle(recyclable.filter(i => !isSelectable(d.board[i])));
    const open = d._rng.shuffle(recyclable.filter(i => isSelectable(d.board[i])));
    // With hardly anything open, three new cards rarely make a Set: replace every stuck card
    const count = open.length < 6 ? Math.max(3, stuck.length) : 3;
    recycle(d, [...stuck, ...open].slice(0, count));
  }
};

export const shopPrice = (w: Weapon): number => Math.round(w.price * 2);
export const rerollCost = (s: RunState): number => 5 + s.rerolls * 5;

/** ★ = survived, ★★ = every foe defeated, ★★★ = defeated + challenge. */
export const computeStars = (s: RunState): number => {
  if (s.status !== 'won') return 0;
  const rule = s.level.starRule;
  if (rule?.kind === 'accuracy') return s.mistakes <= rule.threeStarMax ? 3 : s.mistakes <= rule.twoStarMax ? 2 : 1;
  if (s.endReason === 'survived') return 1;
  return s.challengeMet ? 3 : 2;
};


