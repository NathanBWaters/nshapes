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
import { ATTRIBUTE_VALUES } from '@/utils/gameUtils';
import { MATCH_REWARDS, getBoardSizeForAttributes } from '@/utils/gameConfig';
import { getAdjacentIndices } from '@/utils/weaponEffects';
import { resolveMatch } from '@/utils/matchResolution';
import { getLinkedDestructionPositions, selectPositionsToConnect } from '@/utils/connectionUtils';
import { DEFAULT_PLAYER_STATS, canObtainWeapon } from '@/utils/gameDefinitions';
import { createInitialRoundStats } from '@/game/roundStats';
import type { AdventureSave, AdventureWeapon, ArcanaDef, ArcanaId, BeltBadge, FeatureFlag, FightLogMathItem, LevelDef, RunEventType, RunReliefOptions, RunState, SetFollowUpItem } from '../types';
import type { Effect, WeaponTriggerKind } from '../rules/types';
import { createRng } from './rng';
import { seedProcAccumulator } from './entropy';
import { allSets, countDifferentAttributes, hasAnySet, isRainbow, isSelectable } from './sets';
import { boardVariety, buildDeck, deckCopies, kindsOfSet } from './dealer';
import { applyWeaponToStats, resolveWholeStats, startingLoadout, type LoadoutOptions } from '../loadout';
import { getArmoryWeapon, understudyOf } from '../data/armory';
import { ownerOfEvent } from '../data/weaponGuide';
import { UNDERSTUDY_ID } from '../data/adventureWeapons';
import { damageMultiplier, SKILL_FEAT_POWER } from '../data/weaponPower';
import { weaponBuilds } from '../weaponLevels';
import { createFoe } from '../data/foes';
import { arcanaRules, getArcana } from '../data/arcana';
import { BASE_RULES, TRICK_RULES } from '../data/rules';
import { PARRY_RULES } from '../data/parry';
import { challengeProgress } from './challenges';
import { initParryState, resolveParryOnSet, tickParry } from './parry';
import {
  addCoins, addConnection, addPower, addRandomConnections, addTime, addXp, arcana, begin, chanceStatsOf, clearCardLocks, dealDamage, drawCard,
  emit, empowerBoard, enqueue, ensureBoardHasSet, finish, foeMultiplier, growBoard, heal, hurt, igniteCards, keepCatalystMatchable, mods, newLinkSlots, placeCatalyst,
  pruneConnections, recycle, refill, refreshSources, returnToDeck, rollBridges, signalGrowth, syncEnemyCounters, syncTraps, toDeckCard, touchable, tuning, updateCards,
  MAX_BOARD, type Draft, type FightHooks, TIME_HEADROOM,
  CLOCK_SLOW_CAP_PCT,
} from './fight';
import { EVOLUTION_RULES, getRecipe, getSkillNode, liveSources } from './sources';
import { recordFightStart, recordLog } from './fightLog';
import { afterSetGear, gearSetBonus, holdCards, initGear, onMistakeGear, onWaveStartGear, resolveTwins, syncGear, tickGear, type GearSet } from './gear';
import { refreshArmedRecipes, resolveCatalyst, startEvolution, tickEvolutions } from './evolutions';
import { growthModifiers, WEAPON_GROWTH } from '../data/weaponGrowth';
import { isHintedSet, noteGrowth, seedGrowth } from './growth';
import { placeOpeningTraps, resolveTrapsOnSet, springSnares, tickTimeBombs } from './hazards';
import { initialSurge, surgeMultiplier, tickSurge } from './surge';
import {
  addComboSteps, advanceCombo, afterSetPassives, consumeHotStreak, decayCombo, initPassives, onMistakePassives, onWaveStartPassives,
  passiveSetDamageBreakdown, restingPassiveState, tickPassives,
} from './passives';
import { applyEffect, checkIdle, conditionsHold, drain, resetFoeBelowRules, resetIdleRules, weaponFired } from '../rules/engine';

export { xpForLevel, passiveTuningOf, activeEnemyCounters, type ActiveWeaponCounter } from './fight';

/** What one matched card is worth before weapons and foes get involved. */
export const baseCardReward = (c: Card): CardReward => ({
  cardId: c.id,
  points: MATCH_REWARDS.basePoints + (c.bonusPoints ?? 0) + (c.charge ?? 0),
  money: MATCH_REWARDS.baseMoney + (c.bonusMoney ?? 0),
  experience: MATCH_REWARDS.baseExperience,
});

export const SACRIFICE_BASE_DAMAGE = 6;
export const SACRIFICE_COOLDOWN_MS = 15000;

/** Explicit Sacrifice / Redraw ([GP-05]) unlocks in World 2 from 2-6 onward (and in practice/sandbox). */
export const isSacrificeUnlocked = (level: LevelDef): boolean => {
  if (level.rules.sandbox) return true;
  if (level.biome === 'canyon' || level.biome === 'peaks' || level.biome === 'summit') return true;
  if (level.biome === 'woods') {
    const ref = level.branchOf ?? level.id;
    const match = /^2-(\d+)/.exec(ref);
    return match ? Number(match[1]) >= 6 : false;
  }
  return false;
};

export type RunAction =
  /**
   * `hinted`: one of the picked cards was being pointed out (a hint or an auto-hint).
   * When `resolveWeapons` is true (or `rewards` is omitted), `runReducer` resolves
   * board weapon rolls deterministically via `d._rng.next`.
   */
  | {
      type: 'MATCH';
      cards: Card[];
      rewards?: CardReward[];
      effects?: WeaponEffectResult;
      hinted?: boolean;
      graceUsed?: boolean;
      resolveWeapons?: boolean;
    }
  /** Defensive Grace Save ([GP-04]): consumes 1 Grace, spares heart, resets chains, cycles 3 cards, 0 base damage */
  | { type: 'GRACE_SAVE'; cards: Card[] }
  /** Tactical Sacrifice / Redraw ([GP-05]): costs 1♥, sweeps up to 3 cards (incl. clogged), deals 6×Power shockwave */
  | { type: 'SACRIFICE'; cardIds: string[] }
  | { type: 'INVALID'; cards: Card[] }
  | { type: 'REPLACE'; ids: string[] }
  | { type: 'BURN'; card: Card }
  | { type: 'TICK'; ms: number }
  | { type: 'USE_HINT' }
  | { type: 'PICK'; weaponId: string | null }
  | { type: 'PICK_EVOLUTION'; recipeId: string }
  | { type: 'BUY'; index: number }
  | { type: 'REROLL' }
  | { type: 'NEXT_WAVE' }
  | { type: 'CLEAR_EVENTS'; upTo: number };

// ─── Helpers ────────────────────────────────────────────────────────────────

const scaledFoeHp = (baseHp: number, arcanaIds: ArcanaId[], reliefScale = 1): number => {
  const scale = (arcanaRules(arcanaIds).foeHpScale ?? 1) * reliefScale;
  return scale === 1 ? baseHp : Math.max(1, Math.round(baseHp * scale));
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
    if (!arcana(d).noHeal) {
      d.hearts = Math.min(d.maxHearts, d.hearts + Math.max(0, (weapon.effects.health ?? 0) + (m?.maxHearts ?? 0)));
    }
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
    const replacing = new Set(d.replacing);
    let brokenOnWin = 0;
    d.board = d.board.map(c => {
      if (replacing.has(c.id) && !c.stay && c.health === 1) {
        brokenOnWin += 1;
        return { ...c, health: undefined };
      }
      return c;
    });
    if (brokenOnWin > 0) d.roundStats.tripleCardsCleared += brokenOnWin;
    d.status = 'won';
    d.endReason = 'defeated';
    d.evolutionPickOptions = [];
    d.evolutionPickContext = undefined;
    d.challengeMet = challengeProgress(d).met;
    emit(d, 'foe_defeated');
    return;
  }
  if (d.hearts !== null && d.hearts <= 0) {
    if (d.level.rules.sandbox && d.maxHearts !== null) {
      // Practice cannot be lost: catch your breath and carry on
      d.hearts = d.maxHearts;
      emit(d, 'breather', d.maxHearts);
    } else {
      d.status = 'lost';
      d.endReason = 'hearts';
      d.evolutionPickOptions = [];
      d.evolutionPickContext = undefined;
      return;
    }
  }
  if (d.movesLeft !== null && d.movesLeft <= 0) {
    d.status = 'won';
    d.endReason = 'survived';
    d.evolutionPickOptions = [];
    d.evolutionPickContext = undefined;
    emit(d, 'moves_out');
    return;
  }
  if (d.timeLeft !== null && d.timeLeft <= 0) {
    d.status = 'won';
    d.endReason = 'survived';
    d.evolutionPickOptions = [];
    d.evolutionPickContext = undefined;
    emit(d, 'time_up');
    return;
  }
  if ((d.evolutionPickOptions?.length ?? 0) > 0) {
    d.status = 'pick_evolution';
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

/** Escalating Purity: returns the bonus damage, coins, and chain step reached for this Set. */
const advancePurity = (d: Draft, diffCount: number, graceUsed: boolean): { damage: number; coins: number; chain: number } => {
  if (!d.features.has('purity')) return { damage: 0, coins: 0, chain: 0 };
  if (graceUsed || diffCount === 0) {
    d.purityChain = 0;
    d.lastDiffCount = 0;
    return { damage: 0, coins: 0, chain: 0 };
  }
  if (d.purityChain === 0 || diffCount <= d.lastDiffCount) {
    // A repeated or lower diversity starts a new climb at this diversity
    d.purityChain = 1;
    d.lastDiffCount = diffCount;
    return { damage: 0, coins: 0, chain: 1 };
  }
  d.purityChain += 1;
  const chain = d.purityChain;
  d.lastDiffCount = diffCount;
  d.maxPurityChain = Math.max(d.maxPurityChain, d.purityChain);
  d.purityChainsTriggered += 1;
  if (d.purityChain >= 3) {
    d.threeStepPuritiesTriggered += 1;
    // Skill-feat Power surge ([GP-01]): 3+ step Purity chain rewards careful Set discipline
    addPower(d, SKILL_FEAT_POWER.purityChain3);
  }
  const damage = PURITY_DAMAGE[Math.min(d.purityChain, PURITY_DAMAGE.length - 1)];
  const coins = d.purityChain - 1;
  const reachedMax = diffCount === d.attributes.length;
  emit(d, reachedMax ? 'purity_max' : 'purity', d.purityChain, `Purity ×${d.purityChain}`);
  if (reachedMax) {
    d.purityChain = 0;
    d.lastDiffCount = 0;
  }
  return { damage, coins, chain };
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
    [fx.bonusHealing > 0, 'heal', { do: 'heal', amount: fx.bonusHealing }],
    [fx.bonusCoins > 0, 'coin', { do: 'coins', amount: fx.bonusCoins }],
    [fx.bonusTime > 0, 'time', { do: 'time', seconds: fx.bonusTime }],
    [fx.bonusHints > 0, 'hint', { do: 'hint', amount: fx.bonusHints }],
    [fx.bonusGraces > 0, 'grace', { do: 'grace', amount: fx.bonusGraces }],
    [fx.bonusExperience > 0, 'xp', { do: 'xp', amount: fx.bonusExperience }],
    [fx.boardGrowth > 0, 'growth', { do: 'growBoard', count: fx.boardGrowth }],
  ];
  for (const [on, kind, replay] of fired) if (on) weaponFired(d, kind, replay);
  // Fire weapon:echo once per echoed Set (including Chain Reaction's double-echo)
  for (let i = 0; i < fx.autoMatchedSets.length; i++) {
    weaponFired(d, 'echo', { do: 'trigger', kind: 'echo' });
  }
};

interface MatchOptions {
  /** Scored for the player (Big Scoop, echo triggers): costs no move; the caller replaces the cards at once */
  auto?: boolean;
  /** One of the picked cards was being pointed out */
  hinted?: boolean;
}

/** Score a Set: traps, foe reaction, damage, rewards, weapon triggers, Catalyst, passives. */
const applyMatch = (d: Draft, cards: Card[], rewards: CardReward[], fx: WeaponEffectResult | undefined, opts: MatchOptions = {}) => {
  const matched = cards.slice(0, 3).map(c => d.board.find(b => b.id === c.id) ?? c);
  const matchedIds = new Set(matched.map(c => c.id));
  const prevCtx = d._setCtx;
  const prevSetMult = d._setMultiplier;
  const prevInAutoSet = d._setFold?.inAutoSet ?? false;
  if (opts.auto && d._setFold) d._setFold.inAutoSet = true;
  const graceUsed = rewards.some(r => r.effectType === 'grace');
  if (!opts.auto) {
    d.hintUsedThisSet = false;
    d.mistakeRewardUsedThisSet = false;
  }
  d.replacing = [...new Set([...d.replacing, ...cards.map(c => c.id)])];

  const simplifiedAttrs = d.simplified
    ? [d.simplified.attribute, ...(d.simplified.also ? [d.simplified.also.attribute] : [])]
    : undefined;
  const diffCount = !graceUsed ? countDifferentAttributes(matched, d.attributes) : 0;
  // An all-different Set is always detected for gear/passives/challenges (evaluated over non-simplified traits during Clarity);
  // base multiplier is 1× unless a weapon (e.g. Rainbow Charm), skill node, evolution, or Arcana adds a Rainbow multiplier.
  const rainbow = !graceUsed && isRainbow(matched, d.attributes, simplifiedAttrs);
  const sinceLastMs = d.elapsedMs - d.lastMatchAtMs;
  const hinted = !opts.auto && isHintedSet(d, opts.hinted);
  d._setCtx = { diffCount, rainbow, sinceLastMs, firstOfWave: d.setsThisWave === 0, matchNo: d.matches + 1, hinted };

  const traps = resolveTrapsOnSet(d, matched);

  // Enemy reaction first (time theft, extra removals, flips, dynamic Tentacle Lock release)
  const enemyResult = d.foe.onValidMatch(matched, d.board, d._foeRng.next);
  syncEnemyCounters(d);
  const statMods = d.foe.getStatModifiers();
  emitEnemyEvents(d, enemyResult.events);

  const purity = advancePurity(d, diffCount, graceUsed);

  // Unified Balatro-style damage pipeline: SUM(all additions) × PRODUCT(all multipliers)
  const parryRes = resolveParryOnSet(d, matched, graceUsed, !!opts.auto);
  const hotStreak = consumeHotStreak(d);
  const a = arcana(d);
  advanceCombo(d);
  if (!graceUsed && (a.setComboBonus ?? 0) > 0) {
    addComboSteps(d, a.setComboBonus!);
  }
  const m = mods(d);
  const rawPoints = rewards.reduce((sum, r) => sum + (r.points ?? 0), 0);
  const surgeMult = surgeMultiplier(d);
  let points = rawPoints;
  const flatItems: FightLogMathItem[] = [];
  const describeSource = (key: string): { label: string; sourceRef?: string; defaultNote?: string } => {
    if (key.startsWith('node:')) {
      const id = key.slice(5);
      return { label: getSkillNode(id)?.name ?? id, sourceRef: key, defaultNote: 'skill node' };
    }
    if (key.startsWith('evo:')) {
      const id = key.slice(4);
      return { label: getRecipe(id)?.name ?? id, sourceRef: key, defaultNote: 'active Evolution' };
    }
    const slot = /^w(\d+):(.*)$/.exec(key);
    if (slot) {
      const w = d.weapons[Number(slot[1])];
      return { label: w?.name ?? slot[2], sourceRef: `weapon:${w?.id ?? slot[2]}`, defaultNote: 'weapon bonus' };
    }
    return { label: 'Weapon scaling', defaultNote: 'weapon growth' };
  };
  const findArcanaFor = (
    field: 'nonRainbowDamageDelta' | 'singleTraitBonusDamage' | 'damageScale' | 'highDiffDamageScale' | 'nonEvolvedDamageScale'
  ): ArcanaDef | undefined => {
    for (const id of d.arcana) {
      const def = getArcana(id);
      if (def.rules[field] !== undefined) return def;
    }
    return undefined;
  };
  if (a.nonRainbowDamageDelta !== undefined && !rainbow) {
    const before = points;
    points = Math.max(1, points + a.nonRainbowDamageDelta);
    const delta = points - before;
    if (delta !== 0) {
      const arc = findArcanaFor('nonRainbowDamageDelta');
      flatItems.push({ label: arc?.name ?? 'Arcana', amount: delta, note: 'non-Rainbow penalty' });
    }
  }
  if (!graceUsed && diffCount === 1) {
    if (a.singleTraitBonusDamage !== undefined) {
      points += a.singleTraitBonusDamage;
      if (a.singleTraitBonusDamage !== 0) {
        const arc = findArcanaFor('singleTraitBonusDamage');
        flatItems.push({ label: arc?.name ?? 'Monochrome Pact', amount: a.singleTraitBonusDamage, note: 'only 1 trait differed' });
      }
    }
    if ((a.singleTraitPowerBonus ?? 0) > 0) {
      addPower(d, a.singleTraitPowerBonus!);
    }
  }
  // Fold Piñata break bounties for cards breaking on this Set into flat BEFORE multipliers!
  let pinataBounty = 0;
  const breakingPinataIds: string[] = [];
  const seenCards = new Set<string>();
  for (const c of cards) {
    if (seenCards.has(c.id)) continue;
    seenCards.add(c.id);
    const live = d.board.find(b => b.id === c.id) ?? c;
    const willStay =
      !!live.stay ||
      (matchedIds.has(live.id) && ((!!live.shackle && !matchedIds.has(live.shackle)) || live.tar === 1));
    if (live.health === 1 && !willStay && (live.bounty ?? 0) > 0) {
      pinataBounty += live.bounty!;
      breakingPinataIds.push(live.id);
    }
  }
  if (pinataBounty > 0) {
    d.paidPinataIds = [...new Set([...(d.paidPinataIds ?? []), ...breakingPinataIds])];
    flatItems.push({
      label: 'Piñata',
      amount: pinataBounty,
      note: breakingPinataIds.length === 1 ? 'piñata broken in this Set' : `${breakingPinataIds.length} piñatas broken`,
      sourceRef: 'weapon:pinata',
    });
  }
  // Fold Purity Chain & Traps Defused (Bomb Throw / Hot / Clutch Defuse + Snares) into flat BEFORE multipliers!
  if (purity.damage !== 0) {
    flatItems.push({ label: 'Purity chain', amount: purity.damage, note: `${purity.chain}-Set Purity streak` });
  }
  if (traps.items.length > 0) {
    flatItems.push(...traps.items);
  } else if (traps.bonus !== 0) {
    flatItems.push({ label: 'Traps cleared', amount: traps.bonus, note: 'cleared hazard cards in this Set' });
  }
  const sources = liveSources({
    skillNodes: d.skillNodes,
    weapons: d.weapons,
    activeEvolutions: d.activeEvolutions,
    growth: growthModifiers(d.growth ?? {}),
    blankEvolutionRules: d.blankEvolutionRules,
  });
  let conditional = 0;
  for (const { key, source } of sources) {
    for (const c of source.modifiers?.conditionalDamage ?? []) {
      if (conditionsHold(d, c.when)) {
        conditional += c.amount;
        if (c.amount !== 0) {
          const info = describeSource(key);
          flatItems.push({
            label: info.label,
            amount: c.amount,
            note: info.defaultNote,
            ...(info.sourceRef ? { sourceRef: info.sourceRef } : {}),
          });
        }
      }
    }
  }
  if (d.bonusDamagePerMatch !== 0) {
    flatItems.push({ label: 'Heavy Hitter', amount: d.bonusDamagePerMatch, note: 'Workshop upgrade' });
  }
  for (const { key, source } of sources) {
    if (key === 'growth') continue;
    const amt = source.modifiers?.setDamage ?? 0;
    if (amt !== 0) {
      const info = describeSource(key);
      flatItems.push({
        label: info.label,
        amount: amt,
        note: info.defaultNote,
        ...(info.sourceRef ? { sourceRef: info.sourceRef } : {}),
      });
    }
  }
  const growthEntries: { wId: string; wName: string; stacks: number; mods: NonNullable<NonNullable<(typeof WEAPON_GROWTH)[string]>[number]['mods']> }[] = [];
  for (const [gKey, track] of Object.entries(d.growth ?? {})) {
    if (!track.stacks) continue;
    const [wId, index] = gKey.split('#');
    const def = WEAPON_GROWTH[wId]?.[Number(index)];
    if (!def?.mods) continue;
    const wName = d.weapons.find(w => w.id === wId)?.name ?? getArmoryWeapon(wId)?.name ?? wId;
    growthEntries.push({ wId, wName, stacks: track.stacks, mods: def.mods });
    const sd = (def.mods.setDamage ?? 0) * track.stacks;
    if (sd !== 0) {
      flatItems.push({
        label: wName,
        amount: sd,
        note: `${track.stacks} scaling stack${track.stacks === 1 ? '' : 's'}`,
        sourceRef: `weapon:${wId}`,
      });
    }
  }
  const gearSet: GearSet = {
    matched,
    slots: matched.map(mc => d.board.findIndex(bc => bc.id === mc.id)).filter(i => i >= 0),
    diffCount,
    graceUsed,
    auto: !!opts.auto,
  };
  const tricks = gearSetBonus(d, gearSet);
  const passives = passiveSetDamageBreakdown(d, sinceLastMs);
  // Weapon growth & riders: hints held are worth damage (Seeker Lens), and so is a Set made on a pointed-out card (Oracle Eye)
  const growthDamage = (m.hintHeldDamage ?? 0) * d.stats.hints + (hinted ? m.hintedSetDamage ?? 0 : 0);
  for (const { key, source } of sources) {
    if (key === 'growth') continue;
    const hh = (source.modifiers?.hintHeldDamage ?? 0) * d.stats.hints;
    const hs = hinted ? source.modifiers?.hintedSetDamage ?? 0 : 0;
    if (hh !== 0 || hs !== 0) {
      const info = describeSource(key);
      if (hh !== 0) flatItems.push({ label: info.label, amount: hh, note: `${d.stats.hints} hint${d.stats.hints === 1 ? '' : 's'} held`, ...(info.sourceRef ? { sourceRef: info.sourceRef } : {}) });
      if (hs !== 0) flatItems.push({ label: info.label, amount: hs, note: 'matched pointed-out card', ...(info.sourceRef ? { sourceRef: info.sourceRef } : {}) });
    }
  }
  for (const g of growthEntries) {
    const hh = (g.mods.hintHeldDamage ?? 0) * g.stacks * d.stats.hints;
    if (hh !== 0) flatItems.push({ label: g.wName, amount: hh, note: `${d.stats.hints} hint${d.stats.hints === 1 ? '' : 's'} held`, sourceRef: `weapon:${g.wId}` });
    const hs = hinted ? (g.mods.hintedSetDamage ?? 0) * g.stacks : 0;
    if (hs !== 0) flatItems.push({ label: g.wName, amount: hs, note: 'matched pointed-out card', sourceRef: `weapon:${g.wId}` });
  }
  flatItems.push(...passives.items, ...tricks.flatItems);
  for (const evo of d.activeEvolutions) {
    flatItems.push({
      label: getRecipe(evo.id)?.name ?? 'Active Evolution',
      amount: EVOLUTION_RULES.setDamage,
      note: 'active Evolution bonus',
      sourceRef: `evo:${evo.id}`,
    });
  }
  // Rust can take damage off a Set, never below nothing
  const unclampedFlat =
    points + pinataBounty + purity.damage + traps.bonus + d.bonusDamagePerMatch + (m.setDamage ?? 0) + conditional +
    passives.bonus + tricks.flat + growthDamage + d.activeEvolutions.length * EVOLUTION_RULES.setDamage;
  const flat = Math.max(0, unclampedFlat);
  if (unclampedFlat < 0) {
    flatItems.push({ label: 'Minimum damage floor', amount: -unclampedFlat, note: 'Set damage cannot drop below 0' });
  }
  const weaponRainbowMult = rainbow ? Math.max(0.1, 1 + (m.rainbowMultiplierBonus ?? 0)) : 1;
  const arcanaRainbowMult = rainbow ? (a.rainbowMultiplier ?? BASE_RULES.rainbowMultiplier) : 1;
  // Combine positive Arcana Rainbow bonuses (Prismatic Fever) additively with Rainbow Charm / Rainbow Hunter
  // so they stack cleanly instead of compounding exponentially, while penalties (Monochrome ×0.5) still halve.
  const rainbowBaseMult = !rainbow
    ? 1
    : arcanaRainbowMult > 1
      ? weaponRainbowMult + (arcanaRainbowMult - 1)
      : weaponRainbowMult * arcanaRainbowMult;
  const rainbowBoosted = rainbow && rainbowBaseMult > 1;
  const evoCount = d.activeEvolutions.length;
  const stackEvos = d.stackEvolutionMultipliers !== false;
  const evoMult =
    evoCount > 0
      ? stackEvos
        ? Math.pow(EVOLUTION_RULES.setMultiplier, evoCount)
        : EVOLUTION_RULES.setMultiplier
      : 1;
  const rainbowMult = rainbowBaseMult * evoMult;
  const enemyMult = (enemyResult.pointsMultiplier || 1) * (statMods.pointsMultiplier || 1);
  // "Next Set ×N" effects and Hot Streak together top out at the same cap (data/rules.ts)
  const preTricksSetMult = Math.min(BASE_RULES.maxNextSetMultiplier, d.nextSetMultiplier * hotStreak);
  const setMult = preTricksSetMult * tricks.multiplier;
  d.nextSetMultiplier = 1;
  const multItems: FightLogMathItem[] = [];
  if (surgeMult !== 1) {
    multItems.push({
      label: 'Shading Surge',
      amount: surgeMult,
      note: '4-trait Shading Surge multiplier',
    });
  }
  if (rainbow) {
    let runningRainbow = 1;
    for (const { key, source } of sources) {
      if (key === 'growth') continue;
      const bonus = source.modifiers?.rainbowMultiplierBonus ?? 0;
      if (bonus === 0) continue;
      const next = Math.max(0.1, runningRainbow + bonus);
      const factor = next / runningRainbow;
      const info = describeSource(key);
      multItems.push({
        label: info.label,
        amount: Math.round(factor * 1000) / 1000,
        note: runningRainbow === 1 ? 'all traits different' : `+${bonus}× on Rainbow Sets`,
        ...(info.sourceRef ? { sourceRef: info.sourceRef } : {}),
      });
      runningRainbow = next;
    }
    for (const g of growthEntries) {
      const bonus = (g.mods.rainbowMultiplierBonus ?? 0) * g.stacks;
      if (bonus === 0) continue;
      const next = Math.max(0.1, runningRainbow + bonus);
      const factor = next / runningRainbow;
      multItems.push({
        label: g.wName,
        amount: Math.round(factor * 1000) / 1000,
        note: `${g.stacks} scaling stack${g.stacks === 1 ? '' : 's'}`,
        sourceRef: `weapon:${g.wId}`,
      });
      runningRainbow = next;
    }
    if (arcanaRainbowMult !== 1) {
      const matchingArcana = d.arcana.map(getArcana).filter(def => def.rules.rainbowMultiplier !== undefined);
      const arcLabel = matchingArcana.length === 1 ? matchingArcana[0].name : 'Arcana';
      const arcFactor = arcanaRainbowMult > 1 ? rainbowBaseMult / weaponRainbowMult : arcanaRainbowMult;
      multItems.push({
        label: arcLabel,
        amount: Math.round(arcFactor * 1000) / 1000,
        note: arcanaRainbowMult < 1 ? 'all-different Set penalty' : weaponRainbowMult > 1 ? `+${arcanaRainbowMult - 1}× on Rainbow Sets` : 'all traits different',
      });
    }
  }
  if (evoMult !== 1) {
    const perEvo = stackEvos
      ? EVOLUTION_RULES.setMultiplier
      : Math.pow(evoMult, 1 / evoCount);
    for (const evo of d.activeEvolutions) {
      multItems.push({
        label: getRecipe(evo.id)?.name ?? 'Active Evolution',
        amount: Math.round(perEvo * 1000) / 1000,
        note: 'active Evolution multiplier',
        sourceRef: `evo:${evo.id}`,
      });
    }
  }
  let conditionalMult = 1;
  for (const { key, source } of sources) {
    for (const cm of source.modifiers?.conditionalMultiplier ?? []) {
      if (conditionsHold(d, cm.when) && cm.multiplier !== 1) {
        conditionalMult *= cm.multiplier;
        const info = describeSource(key);
        multItems.push({
          label: info.label,
          amount: Math.round(cm.multiplier * 1000) / 1000,
          note: info.defaultNote,
          ...(info.sourceRef ? { sourceRef: info.sourceRef } : {}),
        });
      }
    }
  }
  if ((a.damageScale ?? 1) !== 1) {
    const arc = findArcanaFor('damageScale');
    multItems.push({ label: arc?.name ?? 'Arcana', amount: a.damageScale!, note: 'Arcana Set multiplier' });
  }
  // Monochrome Pact: 3+ diff non-Rainbow Sets (or any 3+ diff if no rainbowMultiplier already resolved it)
  const highDiffScale =
    !graceUsed && diffCount >= 3 && (!rainbow || a.rainbowMultiplier === undefined)
      ? (a.highDiffDamageScale ?? 1)
      : 1;
  if (highDiffScale !== 1) {
    const arc = findArcanaFor('highDiffDamageScale');
    multItems.push({ label: arc?.name ?? 'Monochrome Pact', amount: highDiffScale, note: '3+ different traits penalty' });
  }
  // Catalyst Resonance: Sets made without an active Evolution
  const nonEvoScale = d.activeEvolutions.length === 0 ? (a.nonEvolvedDamageScale ?? 1) : 1;
  if (nonEvoScale !== 1) {
    const arc = findArcanaFor('nonEvolvedDamageScale');
    multItems.push({ label: arc?.name ?? 'Catalyst Resonance', amount: nonEvoScale, note: 'no active Evolution' });
  }
  if (enemyMult !== 1) multItems.push({ label: enemyMult > 1 ? `${d.foeName} Weakness` : d.foeName, amount: enemyMult, note: enemyMult < 1 ? 'foe resistance' : 'foe vulnerability' });
  if (preTricksSetMult !== 1) multItems.push({ label: hotStreak > 1 ? 'Hot Streak' : 'Next-Set boost', amount: preTricksSetMult, note: hotStreak > 1 ? 'max Combo passive' : 'saved multiplier' });
  const staggerMult = parryRes.wasStaggered ? PARRY_RULES.staggerDamageMult : 1;
  const parryMult = parryRes.multiplier;
  if (parryMult !== 1) {
    multItems.push({
      label: parryRes.kind === 'perfect' ? 'Perfect Parry' : 'Counter Parry',
      amount: parryMult,
      note: parryRes.kind === 'perfect' ? 'golden window parry' : 'countered telegraphed strike',
    });
  }
  if (staggerMult !== 1) {
    multItems.push({
      label: 'Staggered!',
      amount: staggerMult,
      note: 'foe staggered by Parry',
    });
  }
  multItems.push(...tricks.multItems);
  const totalMult =
    surgeMult *
    rainbowMult *
    conditionalMult *
    (a.damageScale ?? 1) *
    highDiffScale *
    nonEvoScale *
    enemyMult *
    setMult *
    parryMult *
    staggerMult;
  // Store the non-foe Set multiplier so synchronous same-Set rules, Twins, blasts, and burns inherit it!
  d._setMultiplier = enemyMult !== 0 ? totalMult / enemyMult : totalMult;
  const dmg = flat * totalMult;
  const powerMult = damageMultiplier(d.power ?? 0);
  const hpBeforeSet = d.foeHp;
  const hit = dealDamage(d, dmg);
  emit(d, surgeMult > 1 ? 'surge_hit' : rainbowBoosted ? 'rainbow' : 'hit', hit, undefined, { slots: gearSet.slots });
  const primaryEventId = d.eventSeq;
  const primaryLineIdx = d._lines.length - 1;
  if (surgeMult > 1 && d.surge) d.surge = { ...d.surge, sets: d.surge.sets + 1 };
  if (!opts.auto) emitBoardWeapons(d, rewards, fx);
  if (opts.auto) {
    d._lines[d._lines.length - 1].text = 'Free Set';
  } else {
    const collateral: NonNullable<RunState['log'][number]['set']>['collateral'] = {};
    for (const r of rewards) {
      if (matchedIds.has(r.cardId) || !r.effectType) continue;
      collateral[r.effectType] = (collateral[r.effectType] ?? 0) + (r.points ?? 0);
    }
    const matchedPts = rewards.filter(r => matchedIds.has(r.cardId)).reduce((sum, r) => sum + (r.points ?? 0), 0);
    const baseCards = matched.length * MATCH_REWARDS.basePoints;
    const cardBonus = Math.max(0, matchedPts - baseCards);
    const powerBonus = matched.reduce((sum, c) => sum + (c.bonusPoints ?? 0), 0);
    const chargeBonus = matched.reduce((sum, c) => sum + (c.charge ?? 0), 0);
    const cardBonusParts: string[] = [];
    if (powerBonus > 0) {
      const cnt = matched.filter(c => (c.bonusPoints ?? 0) > 0).length;
      cardBonusParts.push(`${cnt} Power card${cnt === 1 ? '' : 's'} (+${powerBonus})`);
    }
    if (chargeBonus > 0) cardBonusParts.push(`charged cards (+${chargeBonus})`);
    if (cardBonus > powerBonus + chargeBonus) cardBonusParts.push(`extra card points (+${cardBonus - powerBonus - chargeBonus})`);
    d._logSet = {
      cards: matchedPts,
      cardCount: matched.length,
      baseCards,
      ...(cardBonus > 0 ? { cardBonus } : {}),
      ...(cardBonusParts.length > 0 ? { cardBonusNote: cardBonusParts.join(', ') } : {}),
      ...(surgeMult !== 1 ? { surgeMultiplier: surgeMult } : {}),
      collateral,
      flatBonus: flat - rawPoints,
      ...(flatItems.length > 0 ? { flatItems } : {}),
      multiplier: totalMult,
      ...(multItems.length > 0 ? { multItems } : {}),
      rainbow: rainbowBoosted,
      extra: 0,
      ...(powerMult > 1 ? { powerMultiplier: powerMult, powerPoints: d.power ?? 0 } : {}),
      hit,
      diffTraits: diffCount,
      graceUsed,
      sinceLastMs,
      combo: d.combo,
    };
    d.lastSetIgnition = {
      id: d.eventSeq,
      math: d._logSet,
      ...(parryRes.kind === 'parry' || parryRes.kind === 'perfect' ? { parryKind: parryRes.kind } : {}),
      ...(parryRes.wasStaggered ? { staggered: true } : {}),
      lethal: d.foeHp <= 0,
      isBossOrElite: !!(d.level.isBoss || d.level.isElite || d.level.branchOf),
      foeName: d.foeName,
    };
    d._setFold = {
      setCtx: d._setCtx,
      baseFlat: flat,
      totalMult,
      powerMult,
      dealtSoFar: hit,
      hpBeforeSet,
      overkillCredited: hpBeforeSet > 0 && hit > hpBeforeSet ? hit - hpBeforeSet : 0,
      inAutoSet: false,
      primaryEventId,
      primaryLineIdx,
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
  if (!graceUsed && isRainbow(matched, d.attributes, simplifiedAttrs)) s.allDifferentMatches += 1;
  if (!graceUsed && matched.every(c => c.color === matched[0].color)) {
    s.allSameColorMatches += 1;
    d.colorSets[matched[0].color] += 1;
  }
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

  // Rewards (Overkill Harvest zeroes base Set coins; Gold cards, Overkill, Parries & coin weapons still pay)
  const rewardMoney = a.zeroBaseSetCoins
    ? rewards.reduce((sum, r) => sum + (!r.effectType ? Math.max(0, (r.money ?? 0) - MATCH_REWARDS.baseMoney) : 0), 0)
    : rewards.reduce((sum, r) => sum + (r.money ?? 0), 0);
  const money = rewardMoney + (fx?.bonusCoins ?? 0) + (a.zeroBaseSetCoins ? 0 : purity.coins);
  addCoins(d, money);
  const xp = rewards.reduce((sum, r) => sum + (r.experience ?? 0), 0) + (fx?.bonusExperience ?? 0);
  addXp(d, xp);
  heal(d, rewards.reduce((sum, r) => sum + (r.healing ?? 0), 0) + (fx?.bonusHealing ?? 0));
  const baseHints = rewards.reduce((sum, r) => sum + (r.hint ?? 0), 0) + (fx?.bonusHints ?? 0);
  let bridgeHints = 0;
  let bridgeCoins = 0;
  if (d.features.has('coins') && money > 0 && !(fx && fx.bonusCoins > 0)) {
    for (const bw of rollBridges(d, 'onCoinGain')) {
      if (bw.bridgeEffect?.effect === 'gainHint') bridgeHints += bw.bridgeEffect.amount ?? 1;
    }
  }
  if (d.features.has('xp') && xp > 0 && !(fx && fx.bonusExperience > 0)) {
    for (const bw of rollBridges(d, 'onXPGain')) {
      if (bw.bridgeEffect?.effect === 'gainCoin') {
        const amt = bw.bridgeEffect.amount ?? 1;
        bridgeCoins += amt;
        addCoins(d, amt);
      }
    }
  }
  const hints = baseHints + bridgeHints;
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
  const timeGained = addTime(d, (fx?.bonusTime ?? 0) + (enemyResult.timeDelta ?? 0) + arcanaTimeBonus + linkTimeBonus);
  if (bridgeHints > 0 && d.features.has('hints')) s.weaponEffectsTriggered.add('hint');
  if (bridgeCoins > 0 && d.features.has('coins')) s.weaponEffectsTriggered.add('coin');
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
      if (d._setMultiplier !== 1) {
        const nextMults = { ...(d.burnMults ?? {}) };
        for (const c of d.board) {
          if (ids.has(c.id) && !c.onFire) nextMults[c.id] = d._setMultiplier;
        }
        d.burnMults = nextMults;
      }
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
  // Grow the board (at MAX_BOARD, growBoard overflows into empowerBoard(1) and still fires weapon:growth!)
  const growthFired = fx?.boardGrowth ?? 0;
  if (growthFired > 0) growBoard(d, growthFired);

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
  if (!opts.auto) noteGrowth(d, { on: 'set', cards: matched, slots: gearSet.slots, rainbow, hinted, sinceLastMs });
  resolveCatalyst(d, matched);

  // Rule triggers (resolved by drain at the end of the action)
  if (fx) fireBoardWeapons(d, { ...fx, boardGrowth: growthFired });
  if (bridgeHints > 0 && d.features.has('hints') && !(fx && fx.bonusHints > 0)) {
    weaponFired(d, 'hint', { do: 'hint', amount: bridgeHints });
  }
  if (bridgeCoins > 0 && d.features.has('coins') && !(fx && fx.bonusCoins > 0)) {
    weaponFired(d, 'coin', { do: 'coins', amount: bridgeCoins });
  }
  if (linkTimeBonus > 0 && timeGained > 0 && !(fx && fx.bonusTime > 0)) {
    weaponFired(d, 'time', { do: 'time', seconds: linkTimeBonus });
  }
  enqueue(d, 'set');
  if (rainbow) enqueue(d, 'rainbow');
  if (bonusCards > 0) enqueue(d, 'bonusCardMatched');
  if (graceUsed) enqueue(d, 'graceUsed');
  for (let i = 0; i < connected; i++) enqueue(d, 'linkDestroyed');
  resetIdleRules(d);

  afterSetPassives(d, matched, rainbow, !!opts.auto);
  d._setCtx = prevCtx;
  if (opts.auto) {
    d._setMultiplier = prevSetMult;
    if (d._setFold) d._setFold.inAutoSet = prevInAutoSet;
  }
};

/**
 * Cards leaving the board after a Set or a miss: armored cards lose a hit, a
 * multi-hit card that breaks pays its bounty (unless already folded into the Set's hit).
 * Returns the slots to refill.
 */
const replaceCards = (d: Draft, ids: Set<string>, ended: boolean): number[] => {
  const indices: number[] = [];
  const broken: number[] = [];
  const paidSet = new Set(d.paidPinataIds ?? []);
  const resetThorn =
    d.elapsedMs + TRICK_RULES.thornMs + TRICK_RULES.thornMsPerExtraTrait * Math.max(0, d.attributes.length - 3);
  d.board = d.board.map((c, i) => {
    if (!ids.has(c.id)) return c;
    // A chained card matched alone and a fresh Tar Pit card stay for one more match (engine/gear.ts holdCards)
    // Reset any thorn timer on staying cards so Tar + Thorn doesn't silently expire and bite immediately
    if (c.stay) {
      return {
        ...c,
        stay: false,
        selected: false,
        ...(c.thornAt !== undefined ? { thornAt: resetThorn } : {}),
      };
    }
    if ((c.health ?? 1) > 1) return { ...c, health: (c.health ?? 1) - 1, selected: false };
    if (c.health === 1) broken.push(i);
    indices.push(i);
    return c;
  });
  returnToDeck(d, indices.map(i => d.board[i]));
  for (const i of broken) {
    const c = d.board[i];
    d.roundStats.tripleCardsCleared += 1;
    if (ended) continue;
    enqueue(d, 'cardBroken');
    if (c.bounty) {
      if (paidSet.has(c.id)) {
        // Bounty was already added to the breaking Set's flat damage before multipliers: emit visual burst only
        emit(d, 'pinata_break', undefined, undefined, { slots: [i] });
      } else {
        emit(d, 'pinata_break', dealDamage(d, c.bounty * d._setMultiplier * foeMultiplier(d)), undefined, { slots: [i] });
      }
    }
  }
  if (d.paidPinataIds?.length) {
    d.paidPinataIds = d.paidPinataIds.filter(id => !ids.has(id));
  }
  if (d.burnMults && Object.keys(d.burnMults).length > 0) {
    const nextMults: Record<string, number> = {};
    for (const [k, v] of Object.entries(d.burnMults)) {
      if (!ids.has(k)) nextMults[k] = v;
    }
    d.burnMults = nextMults;
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

/**
 * Make three of these freshly dealt cards a Set: the third is rewritten into the
 * card that completes the first two. Only plain cards are touched.
 */
const plantSet = (d: Draft, indices: number[]) => {
  const plain = indices.filter(i => {
    const c = d.board[i];
    return !!c && isSelectable(c) && !c.isWild && !c.hasEvolutionItem && !c.twinOf && !c.decoyOf && !d.replacing.includes(c.id);
  });
  if (plain.length < 3) return;
  const [a, b, c] = plain.slice(0, 3).map(i => d.board[i]);
  let third = c;
  for (const attribute of d.attributes) {
    const va = attribute === 'background' ? a.background ?? 'white' : a[attribute];
    const vb = attribute === 'background' ? b.background ?? 'white' : b[attribute];
    const value = va === vb ? va : (ATTRIBUTE_VALUES[attribute] as readonly (string | number)[]).find(v => v !== va && v !== vb)!;
    third = { ...third, [attribute]: value } as Card;
  }
  updateCards(d, [plain[2]], () => third);
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
  // Allow auto/echoed Sets to break linked partners (linkDestroyed) just like player Sets!
  const linkedPos: number[] = [];
  if (d.connections.length > 0) {
    const setPos = new Set(set.map(c => d.board.findIndex(b => b.id === c.id)).filter(i => i >= 0));
    const visited = new Set<number>(setPos);
    const traversed = new Set<number>();
    for (const pos of setPos) {
      if (traversed.has(pos)) continue;
      for (const p of getLinkedDestructionPositions(d.connections, pos, traversed)) {
        if (visited.has(p) || !touchable(d, p) || (d.board[p].health ?? 1) > 1) continue;
        visited.add(p);
        linkedPos.push(p);
      }
    }
  }
  const linkedCards = linkedPos.map(p => d.board[p]);
  const allCards = [...set, ...linkedCards];
  const allRewards: CardReward[] = [
    ...set.map(baseCardReward),
    ...linkedCards.map(c => ({ cardId: c.id, points: 1, money: 1, effectType: 'connected' as const })),
  ];
  applyMatch(d, allCards, allRewards, undefined, { auto: true });
  if (linkedCards.length > 0) {
    emit(d, 'link_burst', undefined, String(linkedCards.length), { slots: linkedPos, cards: linkedCards });
    for (let k = 0; k < linkedCards.length; k++) {
      for (const bw of rollBridges(d, 'onDestruction')) {
        if (bw.bridgeEffect?.effect === 'heal') {
          if (heal(d, bw.bridgeEffect.amount ?? 1)) enqueue(d, 'weapon', 'heal');
        }
      }
    }
  }
  const ids = new Set(allCards.map(c => c.id));
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

export interface RunOverrides extends LoadoutOptions {
  /** Override starting hearts (e.g. carry HP across floors in Starfall Summit) */
  startingHearts?: number;
  /** Scale Power accumulation (default 1; 0 disables generic global Power scaling in Starfall Summit) */
  powerScaling?: number;
  /** Stack concurrent active Evolution Set multipliers multiplicatively (used by Starfall Summit) */
  stackEvolutionMultipliers?: boolean;
  /** Lab-only override: omit each active Evolution's bespoke rules/modifiers (keeps universal shell) */
  blankEvolutionRules?: boolean;
}

export interface CreateRunOptions {
  seed: number;
  /** Replace the level's accumulated features (dev tools & tests) */
  features?: Set<FeatureFlag>;
  /** Optional overrides used by Starfall Summit runs without affecting Adventure Mode */
  overrides?: RunOverrides;
  /** Optional run-level relief / Tailwind / Cauldron Wager modifiers ([GP-10] / [GP-16]) */
  relief?: RunReliefOptions;
  /** Opt-in lab telemetry: count firings & zero-op firings per rule key (zero overhead when omitted) */
  trackRuleFirings?: boolean;
}

export const createRun = (level: LevelDef, save: AdventureSave, opts: CreateRunOptions): RunState => {
  const fighter = save.selectedFighter;
  const rng = createRng(opts.seed);
  const foeRng = createRng((opts.seed ^ 0x2545f491) >>> 0);
  const ov = opts.overrides;
  const relief = opts.relief;
  const loadout = startingLoadout(level, save, opts.features, () => rng.next(), ov);
  const features = loadout.features;
  const gear = features.has('gear');
  const { stats, weapons, maxHearts: rawMaxHearts, timer: rawTimer, bonusDamagePerMatch, coinBonusPercent } = loadout;
  const maxHearts =
    rawMaxHearts !== null ? Math.max(1, rawMaxHearts + (relief?.extraHearts ?? 0)) : null;
  const timer =
    rawTimer !== null && relief?.timerScale && relief.timerScale !== 1
      ? Math.max(10, Math.round(rawTimer * relief.timerScale))
      : rawTimer;
  const resolvedHearts =
    features.has('hearts') && maxHearts !== null
      ? ov?.startingHearts !== undefined
        ? Math.max(1, Math.min(maxHearts, ov.startingHearts))
        : maxHearts
      : null;
  const arcanaIds = gear ? loadout.arcana : [];
  const attributes = level.rules.attributes;
  const baseSize = level.rules.boardSize ?? getBoardSizeForAttributes(attributes.length);
  const desiredBoardSize = Math.max(baseSize, gear ? baseSize + (stats.fieldSize - DEFAULT_PLAYER_STATS.fieldSize) : baseSize);
  const boardSize = Math.min(MAX_BOARD, desiredBoardSize);
  const boardOverflow = Math.max(0, desiredBoardSize - MAX_BOARD);
  const first = createFoe(level.foes[0], foeRng.next);
  const rules = arcanaRules(arcanaIds);
  const untimedMoves = rules.untimedMoves;
  const baseMoves =
    level.rules.moves !== undefined
      ? untimedMoves && !level.rules.timer
        ? Math.max(untimedMoves.min, level.rules.moves + untimedMoves.delta)
        : level.rules.moves
      : null;
  const startingMoves =
    baseMoves !== null && rawTimer === null && relief?.timerScale && relief.timerScale !== 1
      ? Math.max(3, Math.round(baseMoves * relief.timerScale))
      : baseMoves;
  const reliefHpScale = relief?.foeHpScale ?? 1;
  const firstFoeHp = scaledFoeHp(level.foes[0].hp, arcanaIds, reliefHpScale);
  const totalFoeHp = level.foes.reduce((sum, f) => sum + scaledFoeHp(f.hp, arcanaIds, reliefHpScale), 0);

  const state: RunState = {
    level,
    fighter,
    features,
    rng: rng.state,
    foeRng: foeRng.state,
    weaponRng: (opts.seed ^ 0x5bd1e995) >>> 0,
    attributes,
    deck: rng.shuffle(buildDeck(level)).map(toDeckCard),
    board: [],
    connections: [],
    stats,
    baseChances: chanceStatsOf(stats),
    weapons: gear ? weapons : [],
    hearts: resolvedHearts,
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
    growth: {},
    power: 0,
    ...(ov?.powerScaling !== undefined ? { powerScaling: ov.powerScaling } : {}),
    stackEvolutionMultipliers: ov?.stackEvolutionMultipliers ?? true,
    ...(ov?.blankEvolutionRules ? { blankEvolutionRules: true } : {}),
    ...(opts.trackRuleFirings ? { ruleFirings: {}, ruleZeroOps: {} } : {}),
    sacrificeCooldownMs: 0,
    sacrificeUsedThisWave: false,
    mistakeRewardUsedThisSet: false,
    ...(relief ? { relief } : {}),
    ...(relief?.tailwindActive ? { tailwindActive: true } : {}),
    ...(relief?.cauldronWager
      ? { cauldronWager: typeof relief.cauldronWager === 'number' ? relief.cauldronWager : 1 }
      : {}),
    growthMemo: { lastSetColor: null, lastHintAtMs: -1, plantSet: false },
    elapsedMs: 0,
    lastMatchAtMs: 0,
    replacing: [],
    paidPinataIds: [],
    burnMults: {},
    hintUsedThisSet: false,
    bonusCombo: 0,
    catalystRecipeId: null,
    evolutionPickOptions: [],
    evolutionPickContext: undefined,
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
    weaponBuilds: ov?.weaponBuilds ?? weaponBuilds(save),
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
    pendingOverkillCarry: 0,
    procAccum: seedProcAccumulator(createRng((opts.seed ^ 0x6c8e9cf5) >>> 0).next),
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
    colorSets: { red: 0, green: 0, purple: 0 },
    trapsDefused: 0,
    trapsSprung: 0,
    explosionsTriggered: 0,
    bonusCardsMatched: 0,
    levelUpsTaken: 0,
    shopBuys: 0,
    parry: initParryState(level, level.foes[0], relief?.parryWindupScale ?? 1),
    parriesLanded: 0,
    perfectParriesLanded: 0,
    lastSetIgnition: null,
  };

  const d = begin(state, HOOKS);
  refreshArmedRecipes(d);
  refreshSources(d);
  initPassives(d);
  // Deal a board that contains at least one Set
  const varied = deckCopies(level) > 1;
  for (let attempt = 0; attempt < 30; attempt++) {
    d.deck.push(...d.board.map(toDeckCard));
    d.deck = d._rng.shuffle(d.deck);
    const dealt: Card[] = [];
    for (let i = 0; i < boardSize; i++) dealt.push(drawCard(d));
    d.board = dealt;
    // A deck with copies opens on every kind of Set its traits allow (the first level shows one of each)
    if (varied ? boardVariety(d.board, attributes).kinds >= kindsOfSet(attributes) : hasAnySet(d.board, attributes)) break;
  }
  if (!hasAnySet(d.board, attributes)) {
    const fixed = [...d.board];
    ensureBoardHasSet(d, fixed, fixed.map((_, i) => i));
    d.board = fixed;
  }
  d.events = []; // don't coach-mark the deal itself
  d._lines = [];
  if (boardOverflow > 0) empowerBoard(d, boardOverflow);
  startFoe(d);
  placeOpeningTraps(d);
  if (d.stats.startingConnections > 0) addRandomConnections(d, d.stats.startingConnections);
  seedGrowth(d);
  enqueue(d, 'fightStart');
  enqueue(d, 'waveStart');
  drain(d);
  syncGear(d);
  syncStats(d);
  recordFightStart(d);
  return finish(d);
};

const startFoe = (d: Draft) => {
  const start = d.foe.onRoundStart(d.board, d._foeRng.next);
  for (const mod of start.cardModifications) {
    d.board = d.board.map(c => (c.id === mod.cardId ? { ...c, ...mod.changes } : c));
  }
  emitEnemyEvents(d, start.events);
  if (d.board.some(c => (c.health ?? 1) > 1)) emit(d, 'triple');
  if (d.board.some(c => c.hasCountdown)) emit(d, 'countdown');
  if (d.board.some(c => c.hasBomb)) emit(d, 'bomb');
  if (d.board.some(c => c.isFaceDown)) emit(d, 'face_down');
};

const fmtBadgeNum = (n: number): string => {
  const r = Math.round(n * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
};

/** Resolve a rule source key (`w0:rally-horn#0`, `evo:...`, `node:...`) to a readable name + ref. */
const resolveLineSource = (d: Draft, key?: string): { label?: string; sourceRef?: string; weaponId?: string } => {
  if (!key) return {};
  const base = key.split('#')[0];
  if (base.startsWith('node:')) return { label: getSkillNode(base.slice(5))?.name ?? base, sourceRef: base };
  if (base.startsWith('evo:')) return { label: getRecipe(base.slice(4))?.name ?? base, sourceRef: base };
  const slot = /^w(\d+):(.*)$/.exec(base);
  if (slot) {
    const w = d.weapons[Number(slot[1])];
    const id = w?.id ?? slot[2];
    return { label: w?.name ?? id, sourceRef: `weapon:${id}`, weaponId: id };
  }
  return {};
};

/**
 * Enrich `d.lastSetIgnition` after `drain(d)` with any follow-up turn damage
 * lines (Rally Horn, Free Set, Piñata, Blast rules, etc.) and per-weapon
 * Balatro trigger badges so the docked Scoreboard and GearBelt reconcile 100%
 * with the exact damage dealt on this move.
 */
const finalizeTurnIgnition = (d: Draft, beforeDamage: number) => {
  if (!d.lastSetIgnition) return;
  const turnDamage = Math.max(0, Math.round(d.totalDamage - beforeDamage));
  const held = d.weapons.map(w => w.id);
  const math = d.lastSetIgnition.math;

  const followUps: SetFollowUpItem[] = [];
  const dmgByWeapon = new Map<string, number>();
  const multByWeapon = new Map<string, number>();
  const fxByWeapon = new Map<string, string>();

  // 1. Direct Set contributors already itemized in `math`
  for (const item of math.flatItems ?? []) {
    if (item.amount !== 0 && item.sourceRef?.startsWith('weapon:')) {
      const id = item.sourceRef.slice(7);
      dmgByWeapon.set(id, (dmgByWeapon.get(id) ?? 0) + item.amount);
    }
  }
  for (const item of math.multItems ?? []) {
    if (Math.abs(item.amount - 1) >= 0.01 && item.sourceRef?.startsWith('weapon:')) {
      const id = item.sourceRef.slice(7);
      multByWeapon.set(id, (multByWeapon.get(id) ?? 1) * item.amount);
    }
  }
  const collTypes: [keyof typeof math.collateral, RunEventType][] = [
    ['explosion', 'blast'],
    ['laser', 'laser'],
    ['ricochet', 'ricochet'],
    ['connected', 'link'],
  ];
  for (const [k, evType] of collTypes) {
    const amt = math.collateral[k] ?? 0;
    if (amt <= 0) continue;
    const owner = ownerOfEvent(evType, undefined, held);
    if (owner) dmgByWeapon.set(owner, (dmgByWeapon.get(owner) ?? 0) + amt);
  }

  // 2. Post-Set rule/weapon lines emitted during the same `MATCH` turn
  // (`hot_streak_hit` and `grudge_release` are already inside `math.multItems` / `math.flatItems`)
  const FOLLOW_UP_DMG = new Set<RunEventType>(['hit', 'blast', 'laser', 'ricochet', 'pinata_break']);
  let skippedPrimarySetHit = false;
  for (const line of d._lines) {
    const isPrimary = !skippedPrimarySetHit && (line.type === 'hit' && !line.text || line.type === 'rainbow' || line.type === 'surge_hit');
    if (isPrimary) {
      skippedPrimarySetHit = true;
      continue;
    }
    const src = resolveLineSource(d, line.source);
    const owner = src.weaponId ?? ownerOfEvent(line.type, line.text, held) ?? undefined;
    const amt = line.amount ?? 0;

    if (FOLLOW_UP_DMG.has(line.type) && amt > 0) {
      const label = src.label ?? line.text ?? (line.type === 'pinata_break' ? 'Piñata' : 'Bonus hit');
      followUps.push({ label, amount: Math.round(amt * 10) / 10, ...(src.sourceRef ? { sourceRef: src.sourceRef } : owner ? { sourceRef: `weapon:${owner}` } : {}) });
      if (owner) dmgByWeapon.set(owner, (dmgByWeapon.get(owner) ?? 0) + amt);
      continue;
    }

    if (!owner || fxByWeapon.has(owner)) continue;
    if (line.type === 'fire' && amt > 0) fxByWeapon.set(owner, `🔥${Math.round(amt)}`);
    else if (line.type === 'heal' && amt > 0) fxByWeapon.set(owner, `+${Math.round(amt)}♥`);
    else if (line.type === 'coins' && amt > 0) fxByWeapon.set(owner, `+${Math.round(amt)}¢`);
    else if (line.type === 'time_gain' && amt > 0) fxByWeapon.set(owner, `+${fmtBadgeNum(amt)}s`);
    else if (line.type === 'power_up' && amt > 0) fxByWeapon.set(owner, `⚡+${Math.round(amt)}`);
    else if (line.type === 'pinata') fxByWeapon.set(owner, 'ARMOR');
    else if (line.type === 'link') fxByWeapon.set(owner, 'LINK');
    else if (line.type === 'echo') fxByWeapon.set(owner, 'ECHO');
    else if (line.type === 'grow') fxByWeapon.set(owner, '+1 CARD');
  }

  const beltBadges: Record<string, BeltBadge> = {};
  for (const id of held) {
    const mult = multByWeapon.get(id);
    const dmg = dmgByWeapon.get(id);
    const fx = fxByWeapon.get(id);
    if (mult && Math.abs(mult - 1) >= 0.01) {
      beltBadges[id] = { text: `×${fmtBadgeNum(mult)}`, kind: 'mult' };
    } else if (dmg && dmg !== 0) {
      beltBadges[id] = { text: `${dmg > 0 ? '+' : ''}${fmtBadgeNum(dmg)}`, kind: followUps.some(f => f.sourceRef === `weapon:${id}`) ? 'fx' : 'flat' };
    } else if (fx) {
      beltBadges[id] = { text: fx, kind: 'fx' };
    }
  }

  d.lastSetIgnition = {
    ...d.lastSetIgnition,
    turnDamage,
    ...(followUps.length > 0 ? { followUps } : {}),
    ...(Object.keys(beltBadges).length > 0 ? { beltBadges } : {}),
    lethal: d.lastSetIgnition.lethal || d.foeHp <= 0,
  };
};

/**
 * Defensive Grace Save ([GP-04]): consumes 1 Grace, spares the heart, resets chains,
 * cycles the 3 cards with 0 base Set damage, and queues `graceUsed` so defensive
 * Grace-reaction rules (Second Chance, Grace Conduit, Judgement Beam, Badger 1-8,
 * Chaos Conduit) fire cleanly without rolling offensive Set weapons.
 */
const applyGraceSave = (d: Draft, cards: Card[]) => {
  const picked = cards.slice(0, 3).map(c => d.board.find(b => b.id === c.id) ?? c);
  d.replacing = [...new Set([...d.replacing, ...picked.map(c => c.id)])];
  d.purityChain = 0;
  d.lastDiffCount = 0;
  d.combo = 0;
  d.bonusCombo = 0;
  d.passive.hotStreak = false;
  d.hintUsedThisSet = false;
  d.roundStats.currentStreak = 0;
  d.stats = { ...d.stats, graces: Math.max(0, d.stats.graces - 1) };
  d.roundStats.gracesUsed += 1;
  emit(d, 'grace');
  enqueue(d, 'graceUsed');
};

// ─── Reducer ────────────────────────────────────────────────────────────────

export const runReducer = (state: RunState, action: RunAction): RunState => {
  if (action.type === 'CLEAR_EVENTS') {
    return { ...state, events: state.events.filter(e => e.id > action.upTo) };
  }
  const ended = state.status === 'won' || state.status === 'lost';
  if (ended && action.type !== 'REPLACE') return state;

  const d = begin(state, HOOKS);
  let loggedAction: RunAction = action;

  switch (action.type) {
    case 'MATCH': {
      if (d.status !== 'playing') return state;
      const before = d.totalDamage;
      const isGraceSave =
        Boolean(action.graceUsed) || Boolean(action.rewards?.some(r => r.effectType === 'grace'));
      if (isGraceSave) {
        loggedAction = { type: 'GRACE_SAVE', cards: action.cards };
        applyGraceSave(d, action.cards);
        drain(d);
        d.biggestHit = Math.max(d.biggestHit, d.totalDamage - before);
        break;
      }
      let matchCards = action.cards;
      let matchRewards = action.rewards;
      let matchEffects = action.effects;
      if (action.resolveWeapons || !matchRewards) {
        const resolved = resolveMatch({
          board: d.board,
          selected: action.cards.slice(0, 3),
          playerStats: d.stats,
          weapons: d.weapons,
          activeAttributes: d.attributes,
          connections: d.connections,
          graceUsed: false,
          rng: d._weaponRng.next,
          procAccum: d.procAccum ?? {},
        });
        matchCards = resolved.cards;
        matchRewards = resolved.rewards;
        matchEffects = resolved.weaponEffects;
      }
      if (matchEffects?.nextProcAccum) {
        d.procAccum = matchEffects.nextProcAccum;
      }
      applyMatch(d, matchCards, matchRewards, matchEffects, { hinted: action.hinted });
      drain(d);
      d._setMultiplier = 1;
      d._setFold = null;
      finalizeTurnIgnition(d, before);
      d.biggestHit = Math.max(d.biggestHit, d.totalDamage - before);
      break;
    }

    case 'GRACE_SAVE': {
      if (d.status !== 'playing' || d.stats.graces <= 0) return state;
      const before = d.totalDamage;
      applyGraceSave(d, action.cards);
      drain(d);
      d.biggestHit = Math.max(d.biggestHit, d.totalDamage - before);
      break;
    }

    case 'SACRIFICE': {
      if (d.status !== 'playing') return state;
      if (d.hearts === null || d.hearts <= 1) return state;
      const isTimed = d.timeLeft !== null;
      if (isTimed ? (d.sacrificeCooldownMs ?? 0) > 0 : Boolean(d.sacrificeUsedThisWave)) return state;

      const before = d.totalDamage;
      const eligible = (c: Card) => !c.hasEvolutionItem && !d.replacing.includes(c.id);
      const clogPriority = (c: Card): number => {
        if (c.isDud) return 0;
        if (c.locked || c.cursedUntil !== undefined || (c.frozen ?? 0) > 0) return 1;
        if (c.isFaceDown) return 2;
        if (c.thornAt !== undefined || c.snare || c.hasBomb || c.hasCountdown || c.fuseAt !== undefined) return 3;
        return 4;
      };

      const chosenIndices: number[] = [];
      const chosenSet = new Set<number>();
      for (const id of action.cardIds) {
        if (chosenIndices.length >= 3) break;
        const idx = d.board.findIndex(c => c.id === id);
        if (idx >= 0 && !chosenSet.has(idx) && eligible(d.board[idx])) {
          chosenIndices.push(idx);
          chosenSet.add(idx);
        }
      }
      if (chosenIndices.length < 3) {
        const rest = d.board
          .map((c, i) => ({ c, i, prio: clogPriority(c) }))
          .filter(x => !chosenSet.has(x.i) && eligible(x.c))
          .sort((a, b) => a.prio - b.prio || a.i - b.i);
        for (const item of rest) {
          if (chosenIndices.length >= 3) break;
          chosenIndices.push(item.i);
          chosenSet.add(item.i);
        }
      }
      if (chosenIndices.length === 0) return state;

      // Intentional 1♥ sacrifice: bypasses Graces, Thick Hide, freeMistakes, Wave-1 Shield; triggers `hurt` synergies
      hurt(d, 1, { bypassWaveShield: true });

      const sweptCards = chosenIndices.map(i => d.board[i]);
      const shockDmg = dealDamage(d, SACRIFICE_BASE_DAMAGE * foeMultiplier(d));
      emit(d, 'hit', shockDmg, 'Sacrifice!', { slots: chosenIndices, cards: sweptCards });

      const sweptIds = new Set(sweptCards.map(c => c.id));
      if (d.timeBombIds.length) {
        d.timeBombIds = d.timeBombIds.filter(id => !sweptIds.has(id));
      }
      returnToDeck(d, sweptCards);
      refill(d, chosenIndices, { skipFoeDrawEffects: true, quiet: true });
      updateCards(d, chosenIndices, clearCardLocks);
      if (!hasAnySet(d.board, d.attributes)) {
        const fixed = [...d.board];
        ensureBoardHasSet(d, fixed, chosenIndices, { skipFoeDrawEffects: true });
        d.board = fixed;
      }

      if (isTimed) d.sacrificeCooldownMs = SACRIFICE_COOLDOWN_MS;
      d.sacrificeUsedThisWave = true;
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
      const a = arcana(d);
      const mistakeBurn = a.mistakeBurn;
      if (onMistakePassives(d)) {
        // Thick Hide took it
      } else if (d.freeMistakesLeft > 0) {
        d.freeMistakesLeft -= 1;
        emit(d, 'free_mistake', d.freeMistakesLeft);
      } else if (mistakeBurn && d.arcanaBurnCooldownMs <= 0) {
        d.arcanaBurnCooldownMs = mistakeBurn.cooldownMs;
        igniteCards(d, mistakeBurn.cards, a.mistakeBurnDamageScale ?? 1);
        if ((a.mistakeBurnPowerBonus ?? 0) > 0) addPower(d, a.mistakeBurnPowerBonus!);
        emit(d, 'arcana_burn');
      } else {
        const baseHearts =
          mistakeBurn && d.arcanaBurnCooldownMs > 0 && a.cooldownMistakeHearts !== undefined
            ? a.cooldownMistakeHearts
            : 1;
        hurt(d, Math.floor(baseHearts * (d.foe.getStatModifiers().damageMultiplier || 1)));
      }
      onMistakeGear(d);
      noteGrowth(d, { on: 'mistake', cards: action.cards });
      emit(d, 'mistake');
      enqueue(d, 'mistake');
      const res = d.foe.onInvalidMatch(action.cards, d.board, d._foeRng.next);
      if (res.cardsToRemove.length) {
        const rm = new Set(res.cardsToRemove);
        const picked = new Set(action.cards.map(c => c.id));
        d.board = d.board.filter(c => !rm.has(c.id) || picked.has(c.id));
        pruneConnections(d);
        emit(d, 'card_removed');
      }
      emitEnemyEvents(d, res.events);
      drain(d);
      d.mistakeRewardUsedThisSet = true;
      break;
    }

    case 'REPLACE': {
      const ids = new Set(action.ids);
      d.replacing = d.replacing.filter(id => !ids.has(id));
      const indices = replaceCards(d, ids, ended);
      if (ended) {
        // keep the board stable behind the results screen
        return finish(d, state);
      }
      refillAfterLeaving(d, indices);
      // Prismatic Ray's growth: the cards that replace a laser's cards hold a Set among themselves
      if (d.growthMemo.plantSet) {
        d.growthMemo = { ...d.growthMemo, plantSet: false };
        plantSet(d, indices);
      }
      drain(d);
      break;
    }

    case 'BURN': {
      if (d.status !== 'playing') return state;
      const idx = d.board.findIndex(c => c.id === action.card.id);
      if (idx === -1) return state;
      const linked = d.connections.length
        ? getLinkedDestructionPositions(d.connections, idx, new Set()).filter(
            p => p !== idx && p >= 0 && p < d.board.length && (d.board[p].health ?? 1) <= 1 && !d.board[p].hasEvolutionItem
          )
        : [];
      const burned = [idx, ...linked];
      const baseBurnMult = d.burnMults?.[action.card.id] ?? 1;
      const rawBurn = burned.reduce((sum, i) => {
        const cMult = d.burnMults?.[d.board[i].id] ?? baseBurnMult;
        return sum + (1 + (d.stats.burnDamage ?? 0)) * cMult;
      }, 0);
      emit(d, 'hit', dealDamage(d, rawBurn * foeMultiplier(d)), 'Burn', { slots: burned });
      addCoins(d, burned.length);
      // Soul Harvest: roll onDestruction once per burned card (including linked partners)
      for (let k = 0; k < burned.length; k++) {
        for (const bw of rollBridges(d, 'onDestruction')) {
          if (bw.bridgeEffect?.effect === 'heal') {
            if (heal(d, bw.bridgeEffect.amount ?? 1)) enqueue(d, 'weapon', 'heal');
          }
        }
      }
      // 10% chance the fire jumps to a neighbour (inheriting the triggering Set's burnMult)
      if (d._rng.next() < 0.1) {
        const burnedSet = new Set(burned);
        const adj = getAdjacentIndices(idx, d.board.length).filter(i => d.board[i] && !d.board[i].onFire && !burnedSet.has(i) && !d.board[i].hasEvolutionItem);
        if (adj.length) {
          const t = d._rng.pick(adj);
          if (baseBurnMult !== 1) d.burnMults = { ...(d.burnMults ?? {}), [d.board[t].id]: baseBurnMult };
          updateCards(d, [t], c => ({ ...c, onFire: true, fireStartTime: d.elapsedMs + 1 }));
        }
      }
      const hadCatalyst = burned.some(i => d.board[i].hasEvolutionItem);
      const paidPinatas = new Set(d.paidPinataIds ?? []);
      for (const i of burned) {
        const c = d.board[i];
        if (c.health === 1) {
          d.roundStats.tripleCardsCleared += 1;
          enqueue(d, 'cardBroken');
          // Fix Piñata + Flint Spark burn bug: pay c.bounty (scaled by burnMult) when a primed Piñata burns out!
          if (c.bounty && !paidPinatas.has(c.id)) {
            const bMult = d.burnMults?.[c.id] ?? baseBurnMult;
            emit(d, 'pinata_break', dealDamage(d, c.bounty * bMult * foeMultiplier(d)), undefined, { slots: [i] });
          }
        }
      }
      if (d.burnMults && Object.keys(d.burnMults).length > 0) {
        const burnedIds = new Set(burned.map(i => d.board[i].id));
        const nextMults: Record<string, number> = {};
        for (const [k, v] of Object.entries(d.burnMults)) {
          if (!burnedIds.has(k)) nextMults[k] = v;
        }
        d.burnMults = nextMults;
      }
      recycle(d, burned);
      if (hadCatalyst) placeCatalyst(d, burned);
      enqueue(d, 'cardBurned');
      linked.forEach(() => enqueue(d, 'linkDestroyed'));
      drain(d);
      break;
    }

    case 'TICK': {
      if (d.status !== 'playing') return state;
      d._clock = true;
      // While frozen: do NOT advance elapsedMs or tickGear (Glass Sword, Thorns, Fuse, Curse, Fog, Potato truly freeze!)
      const frozenUsed = d.frozenMs > 0 ? Math.min(d.frozenMs, action.ms) : 0;
      if (frozenUsed > 0) d.frozenMs = Math.max(0, d.frozenMs - frozenUsed);
      const activeMs = action.ms - frozenUsed;
      if (activeMs > 0) {
        d.elapsedMs += activeMs;
        if (d.arcanaBurnCooldownMs > 0) d.arcanaBurnCooldownMs = Math.max(0, d.arcanaBurnCooldownMs - activeMs);
        if ((d.sacrificeCooldownMs ?? 0) > 0) d.sacrificeCooldownMs = Math.max(0, (d.sacrificeCooldownMs ?? 0) - activeMs);
        decayCombo(d);
        tickClock(d, activeMs);
        checkIdle(d);
        tickPassives(d);
        tickGear(d);
      }
      drain(d);
      break;
    }

    case 'USE_HINT': {
      if (d.status !== 'playing') return state;
      // Block spamming USE_HINT without finding a Set (closes Safe Bet infinite zero-Set exploit)
      if (d.hintUsedThisSet) return state;
      d.hintUsedThisSet = true;
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

    case 'PICK_EVOLUTION': {
      if (d.status !== 'pick_evolution') return state;
      const options = d.evolutionPickOptions ?? [];
      const chosenId = options.includes(action.recipeId) ? action.recipeId : options[0];
      const ctx = d.evolutionPickContext;
      d.evolutionPickOptions = [];
      d.evolutionPickContext = undefined;
      d.status = 'playing';
      if (chosenId && d.evolutionsTriggered < d.evolutionCap) {
        const before = d.totalDamage;
        d._setMultiplier = ctx?.setMultiplier ?? 1;
        // Told first, so what grows on a matched Catalyst (Catalyst Prism) already counts for this evolution
        signalGrowth(d, { on: 'catalyst' });
        const slot = ctx?.slot !== undefined && ctx.slot >= 0 && ctx.slot < d.board.length ? ctx.slot : undefined;
        startEvolution(d, chosenId, slot);
        drain(d);
        d._setMultiplier = 1;
        d.biggestHit = Math.max(d.biggestHit, d.totalDamage - before);
        if (d.lastSetIgnition && d.foeHp <= 0) {
          d.lastSetIgnition = { ...d.lastSetIgnition, lethal: true };
        }
      }
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
      const next = createFoe(def, d._foeRng.next);
      const hp = scaledFoeHp(def.hp, d.arcana, d.relief?.foeHpScale ?? 1);
      d.foe = next.foe;
      d.foeName = next.name;
      d.foeIcon = next.icon;
      d.foeHp = hp;
      d.foeMaxHp = hp;
      d.shopOptions = [];
      d.hintUsedThisSet = false;
      d.mistakeRewardUsedThisSet = false;
      d.sacrificeUsedThisWave = false;
      d.paidPinataIds = [];
      d.burnMults = {};
      // Links are for the wave, unless the Link Stone has grown (then they stay where they are)
      if (!(mods(d).keepLinks ?? 0)) d.connections = [];
      d.setsThisWave = 0;
      d.parry = initParryState(d.level, def, d.relief?.parryWindupScale ?? 1);
      d.status = 'playing';
      refreshSources(d);
      onWaveStartPassives(d);
      onWaveStartGear(d);
      resetFoeBelowRules(d);
      emit(d, 'wave', d.wave + 1);
      startFoe(d);
      // Overkill Harvest: spill banked overkill damage cleanly into the fresh wave foe (already Power-scaled on kill)
      if ((d.pendingOverkillCarry ?? 0) > 0) {
        const carry = Math.round(d.pendingOverkillCarry!);
        d.pendingOverkillCarry = 0;
        if (carry > 0 && !d.level.rules.sandbox) {
          const hpBeforeCarry = d.foeHp;
          d.foeHp = Math.max(0, d.foeHp - carry);
          d.totalDamage += carry;
          if (hpBeforeCarry > 0 && carry > hpBeforeCarry) {
            const spill = carry - hpBeforeCarry;
            d.overkillDamage = Math.max(d.overkillDamage, spill);
            const pct = arcana(d).overkillCarryPct;
            if (pct && pct > 0) d.pendingOverkillCarry = Math.round(spill * pct);
          }
          emit(d, 'hit', carry, 'Overkill Carry');
        }
      }
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
  recordLog(d, state, loggedAction);
  return finish(d, state);
};

/** Everything that runs on the fight clock (paused while frozen). */
const tickClock = (d: Draft, ms: number) => {
  const speed = (d.foe.getUIModifiers().timerSpeedMultiplier || 1) * (arcana(d).timerSpeedScale ?? 1);
  // Chrono Shard's growth slows the player's clock only: the foe, fuses and evolutions keep their pace
  const slow = 1 - Math.min(CLOCK_SLOW_CAP_PCT, mods(d).clockSlowPct ?? 0) / 100;
  if (d.timeLeft !== null) d.timeLeft = Math.max(0, d.timeLeft - (ms / 1000) * speed * slow);
  tickSurge(d, ms * speed);
  tickEvolutions(d, ms);
  if (d.simplified) {
    const remainingMs = d.simplified.remainingMs - ms;
    d.simplified = remainingMs > 0 ? { ...d.simplified, remainingMs } : null;
    if (!d.simplified) emit(d, 'simplify_end');
  }
  tickTimeBombs(d, ms);
  tickParry(d, ms * speed);

  // A Staggered foe is rattled and cannot tick its own hostile abilities or regen
  if (d.parry?.phase === 'staggered') return;

  const tick = d.foe.onTick(ms * speed, d.board, d._foeRng.next);
  syncEnemyCounters(d);
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

/** ★ = survived, ★★ = every foe defeated, ★★★ = defeated + challenge (capped by relief.starCap when Tailwind is active). */
export const computeStars = (s: RunState): number => {
  if (s.status !== 'won') return 0;
  const rule = s.level.starRule;
  const raw =
    rule?.kind === 'accuracy'
      ? s.mistakes <= rule.threeStarMax
        ? 3
        : s.mistakes <= rule.twoStarMax
          ? 2
          : 1
      : s.endReason === 'survived'
        ? 1
        : s.challengeMet
          ? 3
          : 2;
  return s.relief?.starCap !== undefined ? Math.min(s.relief.starCap, raw) : raw;
};


