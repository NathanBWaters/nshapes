/**
 * The adventure run engine: one attempt at one level.
 *
 * `createRun` builds the starting state; `runReducer` applies actions.
 * Card randomness goes through a seeded RNG stored in state, so a run is
 * replayable from (seed, actions). The headless balance bot in
 * __tests__/adventureBalance.test.ts drives this same reducer.
 *
 * Note: foes are EnemyInstance objects with internal timers (mutable). They're
 * owned by the run and only touched inside the reducer.
 */
import type { BoardConnection, BridgeTriggerType, Card, CardReward, Weapon } from '@/types';
import type { EnemyEvent } from '@/types/enemy';
import type { WeaponEffectResult } from '@/utils/weaponEffects';
import { createDeck } from '@/utils/gameUtils';
import { allSets, countDifferentAttributes, hasAnySet, isRainbow, isSelectable } from './sets';
import { MATCH_REWARDS, getBoardSizeForAttributes } from '@/utils/gameConfig';
import { getAdjacentIndices } from '@/utils/weaponEffects';
import {
  arePositionsConnected,
  getLinkedDestructionPositions,
  selectPositionsToConnect,
} from '@/utils/connectionUtils';
import { DEFAULT_PLAYER_STATS, canObtainWeapon } from '@/utils/gameDefinitions';
import { createInitialRoundStats } from '@/game/roundStats';
import type { AbilityState, AdventureSave, ArcanaId, LevelDef, RunEvent, RunEventType, RunState } from '../types';
import { createRng, type Rng } from './rng';
import { applyWeaponToStats, startingLoadout } from '../loadout';
import { getArmoryWeapon } from '../data/armory';
import { createFoe } from '../data/foes';
import { challengeProgress } from './challenges';
import { ABILITY_TUNING, abilityFor, type AbilityId } from '../data/abilities';
import { arcanaRules } from '../data/arcana';
import { BASE_RULES } from '../data/rules';
import { getActiveEvolutionStatus, type EvolutionRecipe } from '../data/evolutions';

const MAX_BOARD = 21;
const CATALYST_DEAL_CHANCE = 0.45;
const CATALYST_REFILL_CHANCE = 0.35;

/** What one matched card is worth before weapons and foes get involved. */
export const baseCardReward = (c: Card): CardReward => ({
  cardId: c.id,
  points: MATCH_REWARDS.basePoints + (c.bonusPoints ?? 0),
  money: MATCH_REWARDS.baseMoney + (c.bonusMoney ?? 0),
  experience: MATCH_REWARDS.baseExperience,
});

export const xpForLevel = (lvl: number): number => 6 + lvl * 5;

export type RunAction =
  | { type: 'MATCH'; cards: Card[]; rewards: CardReward[]; effects?: WeaponEffectResult; nowMs?: number }
  | { type: 'INVALID'; cards: Card[] }
  | { type: 'REPLACE'; ids: string[] }
  | { type: 'BURN'; card: Card }
  | { type: 'TICK'; ms: number }
  | { type: 'USE_HINT' }
  | { type: 'PICK'; weaponId: string | null }
  | { type: 'BUY'; index: number }
  | { type: 'REROLL' }
  | { type: 'NEXT_WAVE' }
  | { type: 'ABILITY' }
  | { type: 'CLEAR_EVENTS'; upTo: number };

// ─── Helpers ────────────────────────────────────────────────────────────────

let cardSeq = 0;
const freshCard = (base: Card): Card => ({
  id: `${base.shape}-${base.color}-${base.number}-${base.shading}-${base.background ?? 'w'}-a${++cardSeq}`,
  shape: base.shape,
  color: base.color,
  number: base.number,
  shading: base.shading,
  background: base.background,
  selected: false,
});

/** Strip per-instance state so a card can go back into the deck. */
const toDeckCard = (c: Card): Card => ({
  id: c.id, shape: c.shape, color: c.color, number: c.number, shading: c.shading, background: c.background, selected: false,
});

const scaledFoeHp = (baseHp: number, arcana: ArcanaId | null): number => {
  const scale = arcanaRules(arcana).foeHpScale;
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

// ─── Mutable working copy used inside one reducer step ─────────────────────

interface Draft extends RunState {
  _rng: Rng;
}

/**
 * Note: `board` keeps its reference until something actually changes it
 * (always replace, never mutate in place). GameBoard treats a new board
 * array as "the board changed" and clears hints/selection state.
 */
const begin = (s: RunState): Draft => ({
  ...s,
  ability: s.ability ? { ...s.ability } : null,
  roundStats: {
    ...s.roundStats,
    matchTimes: [...s.roundStats.matchTimes],
    shapesMatched: new Set(s.roundStats.shapesMatched),
    colorsMatched: new Set(s.roundStats.colorsMatched),
    colorMatchCounts: new Map(s.roundStats.colorMatchCounts),
    weaponEffectsTriggered: new Set(s.roundStats.weaponEffectsTriggered),
  },
  deck: [...s.deck],
  connections: [...s.connections],
  events: [...s.events],
  _rng: createRng(s.rng),
});

const finish = (d: Draft): RunState => {
  const { _rng, ...rest } = d;
  return { ...rest, rng: _rng.state };
};

const emit = (d: Draft, type: RunEventType, amount?: number, text?: string) => {
  d.eventSeq += 1;
  const e: RunEvent = { id: d.eventSeq, type, amount, text };
  d.events.push(e);
  if (d.events.length > 40) d.events.shift();
};

const emitEnemyEvents = (d: Draft, events: EnemyEvent[]) => {
  for (const e of events) {
    const t = ENEMY_EVENT_MAP[e.type];
    if (t) emit(d, t);
  }
};

interface DrawOptions {
  /** Deal the card as-is: the foe doesn't get to turn it into a dud, bomb, etc. */
  skipFoeDrawEffects?: boolean;
}

/** Draw one card from the deck top (recycling is handled by the caller). */
const drawCard = (d: Draft, opts?: DrawOptions): Card => {
  if (d.deck.length === 0) d.deck = d._rng.shuffle(createDeck(d.attributes)).map(toDeckCard);
  const base = d.deck.shift()!;
  let card = freshCard(base);
  const specialMult = arcanaRules(d.activeArcana).specialCardChanceScale ?? 1;
  if (d.features.has('coins') && d._rng.next() < BASE_RULES.coinCardChance * specialMult) card.bonusMoney = BASE_RULES.coinCardValue;
  if (d.features.has('power') && d._rng.next() < BASE_RULES.powerCardChance * specialMult) card.bonusPoints = BASE_RULES.powerCardBonus;
  if (opts?.skipFoeDrawEffects) return card;
  card = d.foe.onCardDraw(card);
  if (card.isDud) emit(d, 'dud');
  if (card.isFaceDown) emit(d, 'face_down');
  if (card.hasBomb) emit(d, 'bomb');
  if (card.hasCountdown) emit(d, 'countdown');
  return card;
};

/**
 * Replace the cards at `indices` with fresh draws. If that leaves the board
 * without any Set, redraw (a few times) — the game should never deadlock.
 */
const refill = (d: Draft, indices: number[], opts?: DrawOptions) => {
  if (indices.length === 0) return;
  for (let attempt = 0; attempt < 12; attempt++) {
    const drawn = indices.map(() => drawCard(d, opts));
    const candidate = [...d.board];
    indices.forEach((idx, i) => (candidate[idx] = drawn[i]));
    if (hasAnySet(candidate, d.attributes) || attempt === 11) {
      d.board = candidate;
      return;
    }
    // put the rejected draws at the bottom of the deck and try again
    d.deck.push(...drawn.map(toDeckCard));
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

const rollPickOptions = (d: Draft, count = 3): Weapon[] => {
  const weapons = d.armory
    .map(id => getArmoryWeapon(id, d.weaponUpgrades))
    .filter((w): w is Weapon => !!w && canObtainWeapon(w, d.weapons));
  return d._rng.shuffle(weapons).slice(0, count);
};

let connSeq = 0;
const makeSeededConnection = (posA: number, posB: number, createdAt: number): BoardConnection => ({
  id: `adv-conn-${++connSeq}`,
  positionA: Math.min(posA, posB),
  positionB: Math.max(posA, posB),
  createdAt,
});

const addSeededRandomConnections = (d: Draft, count: number) => {
  if (count <= 0 || d.board.length < 2) return;
  let added = 0;
  let attempts = 0;
  const maxAttempts = count * 10;
  while (added < count && attempts < maxAttempts) {
    attempts += 1;
    const posA = Math.floor(d._rng.next() * d.board.length);
    const posB = Math.floor(d._rng.next() * d.board.length);
    if (posA === posB || arePositionsConnected(d.connections, posA, posB)) continue;
    d.connections = [...d.connections, makeSeededConnection(posA, posB, d.elapsedMs)];
    added += 1;
  }
};

const pruneConnections = (d: Draft) => {
  if (d.connections.length === 0) return;
  const n = d.board.length;
  if (d.connections.some(c => c.positionA >= n || c.positionB >= n)) {
    d.connections = d.connections.filter(c => c.positionA < n && c.positionB < n);
  }
};

const rollSeededBridges = (d: Draft, trigger: BridgeTriggerType): Weapon[] =>
  d.weapons.filter(
    w => w.specialEffect === 'bridge' && w.bridgeEffect?.trigger === trigger && d._rng.next() * 100 < w.bridgeEffect.chance
  );

const hurt = (d: Draft, amount: number) => {
  if (d.hearts === null || amount <= 0) return;
  d.hearts = Math.max(0, d.hearts - amount);
  d.roundStats.damageReceived += amount;
  emit(d, 'hurt', amount);
  if (d.hearts === 0 && d.ability && ABILITY_RULES[d.ability.id].survivesKnockout?.(d, d.ability)) d.hearts = 1;
  // Life Link bridge weapon — health loss can trigger retaliatory board explosions
  if (d.hearts > 0) {
    for (const w of rollSeededBridges(d, 'onHealthLoss')) {
      if (w.bridgeEffect?.effect === 'explosion') {
        const candidates = d.board
          .map((c, i) => (isSelectable(c) && (c.health ?? 1) <= 1 && !c.hasEvolutionItem ? i : -1))
          .filter(i => i >= 0);
        const exploded = d._rng.shuffle(candidates).slice(0, 2);
        if (exploded.length > 0) {
          d.roundStats.weaponEffectsTriggered.add('explosion');
          dealDamage(d, exploded.length * (d.foe.getStatModifiers().pointsMultiplier || 1));
          emit(d, 'hit', exploded.length);
          exploded.forEach(i => d.deck.push(toDeckCard(d.board[i])));
          refill(d, exploded);
        }
      }
    }
  }
};

const chargeAbility = (d: Draft) => {
  const a = d.ability;
  if (!a || a.max <= 0 || a.charge >= a.max) return;
  a.charge += 1;
  if (a.charge === a.max) emit(d, 'ability_ready');
};

const heal = (d: Draft, amount: number) => {
  if (d.hearts === null || d.maxHearts === null || amount <= 0) return;
  const before = d.hearts;
  d.hearts = Math.min(d.maxHearts, d.hearts + amount);
  if (d.hearts > before) emit(d, 'heal', d.hearts - before);
};

const dealDamage = (d: Draft, amount: number) => {
  const dmg = Math.max(0, Math.round(amount));
  const hpBefore = d.foeHp;
  if (hpBefore > 0 && dmg > hpBefore) {
    const overkill = dmg - hpBefore;
    d.overkillDamage = Math.max(d.overkillDamage, overkill);
    const coinsPerDamage = arcanaRules(d.activeArcana).overkillCoinsPerDamage;
    if (coinsPerDamage !== undefined) {
      addCoins(d, overkill * coinsPerDamage);
      emit(d, 'overkill', overkill);
    }
  }
  d.foeHp = Math.max(0, d.foeHp - dmg);
  d.totalDamage += dmg;
};

const addCoins = (d: Draft, base: number) => {
  if (!d.features.has('coins') || base <= 0) return;
  const amount = Math.max(1, Math.round(base * d.level.coinMultiplier * (1 + d.coinBonusPercent / 100)));
  d.coins += amount;
  emit(d, 'coins', amount);
};

const addXp = (d: Draft, amount: number) => {
  if (!d.features.has('xp') || amount <= 0) return;
  const gained = amount * (arcanaRules(d.activeArcana).xpScale ?? 1);
  d.xp += gained;
  while (d.xp >= xpForLevel(d.xpLevel)) {
    d.xp -= xpForLevel(d.xpLevel);
    d.xpLevel += 1;
    d.pendingPicks += 1;
    emit(d, 'levelup');
  }
};

const isEligibleCatalystCard = (c: Card | undefined): boolean =>
  !!c && isSelectable(c) && (c.health ?? 1) === 1 && !c.hasBomb && !c.hasCountdown;

/**
 * Keep `evolutionReady` synced on the single board Catalyst card (if any).
 * If an enemy mutates the Catalyst card into a Dud/FaceDown/Armored/Bomb/Countdown,
 * release and relocate the Catalyst cleanly so it never soft-locks.
 */
const syncCatalystCardState = (d: Draft) => {
  if (!d.features.has('evolutions')) return;
  const idx = d.board.findIndex(c => c.hasEvolutionItem);
  if (idx === -1) return;
  if (!isEligibleCatalystCard(d.board[idx])) {
    d.board = d.board.map((c, i) => (i === idx ? { ...c, hasEvolutionItem: false, evolutionReady: false } : c));
    maybePlaceCatalyst(d, d.board.map((_, i) => i), 1);
    return;
  }
  const ready = Boolean(getActiveEvolutionStatus(d.weapons, d.evolvedRecipes, d, d.unlockedEvolutions)?.ready);
  const current = Boolean(d.board[idx].evolutionReady);
  if (current === ready) return;
  d.board = d.board.map((c, i) => (i === idx ? { ...c, evolutionReady: ready } : c));
  if (ready) emit(d, 'catalyst_ready');
};

/**
 * Potentially hide an Evolution Catalyst behind ONE eligible card among `candidateIndices`.
 * Enforces the strict invariant: at most ONE `hasEvolutionItem` card on screen at a time.
 */
const maybePlaceCatalyst = (d: Draft, candidateIndices: number[], baseChance: number) => {
  if (!d.features.has('evolutions') || d.catalystState !== 'available') return;
  if (d.board.some(c => c.hasEvolutionItem)) return;
  if (!d.unlockedEvolutions.some(id => !d.evolvedRecipes.includes(id))) return;
  const eligible = candidateIndices.filter(i => isEligibleCatalystCard(d.board[i]));
  if (eligible.length === 0) return;
  const chance = Math.min(1, baseChance * (arcanaRules(d.activeArcana).catalystChanceScale ?? 1));
  if (d._rng.next() >= chance) return;
  const targetIdx = d._rng.pick(eligible);
  const ready = Boolean(getActiveEvolutionStatus(d.weapons, d.evolvedRecipes, d, d.unlockedEvolutions)?.ready);
  d.board = d.board.map((c, i) => (i === targetIdx ? { ...c, hasEvolutionItem: true, evolutionReady: ready } : c));
  emit(d, 'catalyst_spawn');
  if (ready) emit(d, 'catalyst_ready');
};

const loseCatalyst = (d: Draft) => {
  if (d.catalystState !== 'available') return;
  if (d.catalystRespawnsLeft > 0) {
    d.catalystRespawnsLeft -= 1;
    emit(d, 'catalyst_saved');
    return;
  }
  d.catalystState = 'lost';
  d.catalystsLost += 1;
  emit(d, 'catalyst_lost');
};

const acquireWeapon = (d: Draft, weapon: Weapon) => {
  d.weapons = [...d.weapons, weapon];
  d.stats = applyWeaponToStats(d.stats, weapon);
  const heartsLocked = arcanaRules(d.activeArcana).maxHeartsLock !== undefined;
  if (weapon.effects.maxHealth && d.hearts !== null && d.maxHearts !== null && !heartsLocked) {
    d.maxHearts += weapon.effects.maxHealth;
    d.hearts = Math.min(d.maxHearts, d.hearts + (weapon.effects.health ?? 0));
  }
};

const triggerEvolution = (d: Draft, recipe: EvolutionRecipe, excludedCards: Card[], nowMs: number) => {
  const evolved = recipe.result;
  acquireWeapon(d, evolved);
  d.evolvedRecipes = [...d.evolvedRecipes, recipe.id];
  d.catalystState = 'evolved';

  const b = recipe.burst;
  const burstBonus = arcanaRules(d.activeArcana).evolutionBurstBonus;
  const burstDamage = (b.damage ?? 0) + (burstBonus?.damage ?? 0);
  if (burstDamage > 0) {
    dealDamage(d, burstDamage * (d.foe.getStatModifiers().pointsMultiplier || 1));
  }
  if (b.heal) heal(d, b.heal);
  if (b.coins) addCoins(d, b.coins);
  const burstTime = (b.timeBonus ?? 0) + (burstBonus?.time ?? 0);
  if (burstTime > 0 && d.timeLeft !== null) {
    const cap = (d.level.rules.timer ?? 0) + d.stats.startingTime + 15;
    d.timeLeft = Math.min(cap, d.timeLeft + burstTime);
  }
  if (b.hints && d.features.has('hints')) {
    const nextHints = d.stats.hints + b.hints;
    d.stats = { ...d.stats, maxHints: Math.max(d.stats.maxHints, nextHints), hints: nextHints };
    emit(d, 'hint', b.hints);
  }
  if (b.graces && d.features.has('graces')) {
    const nextGraces = d.stats.graces + b.graces;
    d.stats = { ...d.stats, maxGraces: Math.max(d.stats.maxGraces, nextGraces), graces: nextGraces };
  }
  if (b.xpBonus) addXp(d, b.xpBonus);
  if (b.igniteCards) {
    const excludedIds = new Set(excludedCards.map(c => c.id));
    const candidates = d.board
      .map((c, i) => (isSelectable(c) && !c.onFire && !excludedIds.has(c.id) ? i : -1))
      .filter(i => i >= 0);
    const chosen = new Set(d._rng.shuffle(candidates).slice(0, b.igniteCards));
    if (chosen.size > 0) {
      d.roundStats.weaponEffectsTriggered.add('fire');
      d.board = d.board.map((c, i) => (chosen.has(i) ? { ...c, onFire: true, fireStartTime: nowMs } : c));
      emit(d, 'fire');
    }
  }
  if (b.growBoard) {
    const extra = Math.min(b.growBoard, MAX_BOARD - d.board.length);
    if (extra > 0) {
      const added: Card[] = [];
      for (let i = 0; i < extra; i++) added.push(drawCard(d));
      d.board = [...d.board, ...added];
    }
  }
  emit(d, 'evolution', burstDamage || undefined, evolved.name);
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
    d.pickOptions = rollPickOptions(d, arcanaRules(d.activeArcana).pickOptions ?? BASE_RULES.pickOptions);
    if (d.pickOptions.length === 0) d.pendingPicks = 0;
    else d.status = 'pick';
  }
};

// ─── Setup ──────────────────────────────────────────────────────────────────

export const createRun = (level: LevelDef, save: AdventureSave, opts: { seed: number }): RunState => {
  const fighter = save.selectedFighter;
  const { features, activeArcana, weapons, stats, maxHearts, bonusDamagePerMatch, coinBonusPercent } = startingLoadout(level, save);
  const rng = createRng(opts.seed);
  const attributes = level.rules.attributes;
  const baseSize = level.rules.boardSize ?? getBoardSizeForAttributes(attributes.length);
  const boardSize = Math.min(MAX_BOARD, Math.max(baseSize, features.has('gear') ? baseSize + (stats.fieldSize - DEFAULT_PLAYER_STATS.fieldSize) : baseSize));
  const first = createFoe(level.foes[0]);
  const timer = level.rules.timer ? level.rules.timer + stats.startingTime : null;
  const untimedMoves = arcanaRules(activeArcana).untimedMoves;
  const startingMoves =
    level.rules.moves !== undefined
      ? untimedMoves && !level.rules.timer
        ? Math.max(untimedMoves.min, level.rules.moves + untimedMoves.delta)
        : level.rules.moves
      : null;
  const firstFoeHp = scaledFoeHp(level.foes[0].hp, activeArcana);
  const totalFoeHp = level.foes.reduce((a, f) => a + scaledFoeHp(f.hp, activeArcana), 0);

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
    weapons,
    hearts: maxHearts,
    maxHearts,
    wave: 0,
    foe: first.foe,
    foeName: first.name,
    foeIcon: first.icon,
    foeHp: firstFoeHp,
    foeMaxHp: firstFoeHp,
    totalDamage: 0,
    matches: 0,
    mistakes: 0,
    movesLeft: startingMoves,
    timeLeft: timer,
    elapsedMs: 0,
    lastMatchAtMs: 0,
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
    bonusDamagePerMatch,
    coinBonusPercent,
    shopOptions: [],
    rerolls: 0,
    armory: save.armory,
    weaponUpgrades: save.weaponUpgrades,
    ability: null,
    activeArcana,
    arcanaBurnCooldownMs: 0,
    overkillDamage: 0,
    purityChain: 0,
    lastDiffCount: 0,
    maxPurityChain: 0,
    purityChainsTriggered: 0,
    threeStepPuritiesTriggered: 0,
    unlockedEvolutions: save.unlockedEvolutions,
    catalystState: 'available',
    catalystRespawnsLeft: arcanaRules(activeArcana).catalystRespawns ?? 0,
    catalystsLost: 0,
    evolvedRecipes: [],
  };
  const abilityDef = features.has('gear') ? abilityFor(fighter) : null;
  if (abilityDef) {
    state.ability = { id: abilityDef.id, charge: 0, max: abilityDef.chargeSets ?? 0, spent: false, combo: 0, grudge: 0, frozenMs: 0, scooped: [] };
  }

  const d = begin(state);
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
  startFoe(d);
  if (d.stats.startingConnections > 0) addSeededRandomConnections(d, d.stats.startingConnections);
  maybePlaceCatalyst(d, d.board.map((_, i) => i), CATALYST_DEAL_CHANCE);
  syncStats(d);
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

/** Score a Set: foe reaction, damage, rewards, weapon and catalyst effects. */
const applyMatch = (d: Draft, cards: Card[], rewards: CardReward[], effects: WeaponEffectResult | undefined, nowMs: number) => {
  const matched = cards.slice(0, 3);
  const graceUsed = rewards.some(r => r.effectType === 'grace');
  const fx = effects;

  // Snapshot Evolution readiness BEFORE this Set updates counters:
  // matching on a Catalyst card before you are already ready shatters it!
  const preMatchEvo = d.features.has('evolutions')
    ? getActiveEvolutionStatus(d.weapons, d.evolvedRecipes, d, d.unlockedEvolutions)
    : null;
  const matchedIds = new Set(matched.map(c => c.id));
  const matchedCatalyst =
    d.features.has('evolutions') &&
    d.board.some(c => matchedIds.has(c.id) && c.hasEvolutionItem);

  // Enemy reaction first (time theft, extra removals, flips)
  const enemyResult = d.foe.onValidMatch(matched, d.board);
  const statMods = d.foe.getStatModifiers();
  emitEnemyEvents(d, enemyResult.events);

  // Attribute diversity, Escalating Purity & Arcana modifiers
  const diffCount = !graceUsed ? countDifferentAttributes(matched, d.attributes) : 0;
  const rainbow = d.features.has('rainbow') && !graceUsed && isRainbow(matched, d.attributes);
  let purityDamage = 0;
  let purityCoins = 0;
  if (d.features.has('purity')) {
    if (graceUsed || diffCount === 0) {
      d.purityChain = 0;
      d.lastDiffCount = 0;
    } else if (d.purityChain === 0) {
      d.purityChain = 1;
      d.lastDiffCount = diffCount;
    } else if (diffCount > d.lastDiffCount) {
      d.purityChain += 1;
      d.lastDiffCount = diffCount;
      d.maxPurityChain = Math.max(d.maxPurityChain, d.purityChain);
      d.purityChainsTriggered += 1;
      if (d.purityChain >= 3) d.threeStepPuritiesTriggered += 1;
      purityDamage = d.purityChain === 2 ? 1 : d.purityChain === 3 ? 3 : d.purityChain === 4 ? 5 : 8;
      purityCoins = d.purityChain - 1;
      const reachedMax = diffCount === d.attributes.length;
      emit(d, reachedMax ? 'purity_max' : 'purity', d.purityChain, `Purity ×${d.purityChain}`);
      if (reachedMax) {
        // Completed the full diversity climb — reset cleanly so next Set starts a fresh climb!
        d.purityChain = 0;
        d.lastDiffCount = 0;
      }
    } else {
      // Repeated or dropped diversity starts a new Step 1 baseline at this diversity
      d.purityChain = 1;
      d.lastDiffCount = diffCount;
    }
  }

  let points = rewards.reduce((a, r) => a + (r.points ?? 0), 0);
  const rules = arcanaRules(d.activeArcana);
  if (rules.nonRainbowDamageDelta !== undefined && !rainbow) {
    points = Math.max(1, points + rules.nonRainbowDamageDelta);
  }
  if (rules.singleTraitBonusDamage !== undefined && !graceUsed && diffCount === 1) {
    points += rules.singleTraitBonusDamage;
  }
  const rainbowMult = rainbow ? rules.rainbowMultiplier ?? BASE_RULES.rainbowMultiplier : 1;
  const tempoMult = rules.damageScale ?? 1;
  const enemyMult = (enemyResult.pointsMultiplier || 1) * (statMods.pointsMultiplier || 1);
  const dmg = (points + d.bonusDamagePerMatch + (d.ability ? ABILITY_RULES[d.ability.id].setBonusDamage?.(d, d.ability) ?? 0 : 0)) * rainbowMult * tempoMult * enemyMult + purityDamage * enemyMult;
  dealDamage(d, dmg);
  emit(d, rainbow ? 'rainbow' : 'hit', Math.round(dmg));

  chargeAbility(d);

  // Bookkeeping & stats for defeat conditions
  d.matches += 1;
  if (d.movesLeft !== null) d.movesLeft -= 1;
  const s = d.roundStats;
  s.totalMatches += 1;
  s.currentStreak += 1;
  s.maxStreak = Math.max(s.maxStreak, s.currentStreak);
  s.matchTimes.push(d.elapsedMs - d.lastMatchAtMs);
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
  if (graceUsed) {
    d.stats = { ...d.stats, graces: Math.max(0, d.stats.graces - 1) };
    s.gracesUsed += 1;
    emit(d, 'grace');
  }

  // Rewards
  const money = rewards.reduce((a, r) => a + (r.money ?? 0), 0) + (fx?.bonusCoins ?? 0) + purityCoins;
  addCoins(d, money);
  const xp = rewards.reduce((a, r) => a + (r.experience ?? 0), 0) + (fx?.bonusExperience ?? 0);
  addXp(d, xp);
  const healing = rewards.reduce((a, r) => a + (r.healing ?? 0), 0) + (fx?.bonusHealing ?? 0);
  heal(d, healing);
  let hints = rewards.reduce((a, r) => a + (r.hint ?? 0), 0) + (fx?.bonusHints ?? 0);
  if (d.features.has('coins') && money > 0 && !(fx && fx.bonusCoins > 0)) {
    for (const bw of rollSeededBridges(d, 'onCoinGain')) {
      if (bw.bridgeEffect?.effect === 'gainHint') hints += bw.bridgeEffect.amount ?? 1;
    }
  }
  if (d.features.has('xp') && xp > 0 && !(fx && fx.bonusExperience > 0)) {
    for (const bw of rollSeededBridges(d, 'onXPGain')) {
      if (bw.bridgeEffect?.effect === 'gainCoin') addCoins(d, bw.bridgeEffect.amount ?? 1);
    }
  }
  if (hints > 0 && d.features.has('hints')) {
    d.stats = { ...d.stats, hints: Math.min(d.stats.maxHints, d.stats.hints + hints) };
    emit(d, 'hint', hints);
  }
  if (fx?.bonusGraces && d.features.has('graces')) {
    d.stats = { ...d.stats, graces: Math.min(d.stats.maxGraces, d.stats.graces + fx.bonusGraces) };
  }
  const connectedCount = rewards.filter(r => r.effectType === 'connected').length;
  const linkTimeBonus = connectedCount > 0 ? connectedCount * (d.stats.echoTimeBonusPerLink || 0) : 0;
  const arcanaTimeBonus = (rainbow ? rules.rainbowTimeBonus ?? 0 : 0) + (rules.setTimeBonus ?? 0);
  const timeDelta = (fx?.bonusTime ?? 0) + (enemyResult.timeDelta ?? 0) + arcanaTimeBonus + linkTimeBonus;
  if (d.timeLeft !== null && timeDelta !== 0) {
    const cap = (d.level.rules.timer ?? 0) + d.stats.startingTime;
    d.timeLeft = Math.max(0, Math.min(cap, d.timeLeft + timeDelta));
  }
  if (fx) {
    if (fx.explosiveCards.length) s.weaponEffectsTriggered.add('explosion');
    if (fx.laserCards.length) s.weaponEffectsTriggered.add('laser');
    if (fx.ricochetCards.length) s.weaponEffectsTriggered.add('ricochet');
    if (fx.fireCards.length) {
      s.weaponEffectsTriggered.add('fire');
      const ids = new Set(fx.fireCards.map(c => c.id));
      const now = nowMs;
      d.board = d.board.map(c => (ids.has(c.id) && !c.onFire ? { ...c, onFire: true, fireStartTime: now } : c));
      emit(d, 'fire');
    }
  }

  // Enemy board effects (no replacement)
  if (enemyResult.cardsToFlip.length) {
    const flip = new Set(enemyResult.cardsToFlip);
    d.board = d.board.map(c => (flip.has(c.id) ? { ...c, isFaceDown: false, wasOriginallyFaceDown: true } : c));
  }
  if (enemyResult.cardsToRemove.length) {
    const rm = new Set(enemyResult.cardsToRemove);
    const matchedIds = new Set(cards.map(c => c.id));
    d.board = d.board.filter(c => !rm.has(c.id) || matchedIds.has(c.id));
    pruneConnections(d);
    emit(d, 'card_removed');
  }
  if (fx?.boardGrowth) {
    const extra = Math.min(fx.boardGrowth, MAX_BOARD - d.board.length);
    const added: Card[] = [];
    for (let i = 0; i < extra; i++) added.push(drawCard(d));
    d.board = [...d.board, ...added];
  }

  // Connector weapons — chance to link two of the matched board positions for the wave
  if (d.stats.connectionChance > 0 && d._rng.next() * 100 < d.stats.connectionChance) {
    const matchedPositions = matched
      .map(mc => d.board.findIndex(bc => bc.id === mc.id))
      .filter(pos => pos >= 0);
    const pair = selectPositionsToConnect(matchedPositions, d.connections);
    if (pair) {
      d.connections = [...d.connections, makeSeededConnection(pair[0], pair[1], d.elapsedMs)];
      if (d.stats.bonusConnectionChance > 0 && d._rng.next() * 100 < d.stats.bonusConnectionChance) {
        addSeededRandomConnections(d, 1);
      }
    }
  }

  // Resolve Evolution Catalyst if one of the 3 matched Set cards carried it
  if (matchedCatalyst) {
    d.board = d.board.map(c => (matchedIds.has(c.id) && c.hasEvolutionItem ? { ...c, hasEvolutionItem: false, evolutionReady: false } : c));
    if (preMatchEvo?.ready) {
      triggerEvolution(d, preMatchEvo.recipe, cards, nowMs);
    } else {
      loseCatalyst(d);
    }
  } else {
    syncCatalystCardState(d);
  }
};

// ─── Fighter abilities ──────────────────────────────────────────────────────

/** What a fighter's ability does at each point the fight consults it. Tuning lives in data/abilities.ts. */
interface AbilityRules {
  /** Hearts just reached 0: return true to stay standing on 1 heart */
  survivesKnockout?(d: Draft, a: AbilityState): boolean;
  /** Extra damage for the Set being scored right now */
  setBonusDamage?(d: Draft, a: AbilityState): number;
  onMistake?(d: Draft, a: AbilityState): void;
  /** Fire a fully charged active ability */
  activate?(d: Draft, a: AbilityState): void;
}

const ABILITY_RULES: Record<AbilityId, AbilityRules> = {
  nine_lives: {
    survivesKnockout: (d, a) => {
      if (a.spent) return false;
      a.spent = true;
      emit(d, 'nine_lives');
      return true;
    },
  },
  combo: {
    setBonusDamage: (d, a) => {
      const inWindow = d.matches > 0 && d.elapsedMs - d.lastMatchAtMs <= ABILITY_TUNING.comboWindowMs;
      a.combo = inWindow ? Math.min(ABILITY_TUNING.comboMax, a.combo + 1) : 0;
      if (a.combo > 0) emit(d, 'combo', a.combo);
      return a.combo;
    },
    onMistake: (_d, a) => {
      a.combo = 0;
    },
  },
  grudge: {
    setBonusDamage: (d, a) => {
      if (a.grudge === 0) return 0;
      const bonus = a.grudge * ABILITY_TUNING.grudgeDamage;
      emit(d, 'grudge_release', bonus);
      a.grudge = 0;
      return bonus;
    },
    onMistake: (d, a) => {
      if (a.grudge >= ABILITY_TUNING.grudgeMax) return;
      a.grudge += 1;
      emit(d, 'grudge', a.grudge);
    },
  },
  deep_freeze: {
    activate: (d, a) => {
      a.frozenMs = ABILITY_TUNING.freezeMs;
      emit(d, 'freeze');
    },
  },
  zoomies: {
    activate: d => {
      // Armored cards stay; everything else, duds and hidden cards included, is re-dealt
      const idx = d.board.map((c, i) => ((c.health ?? 1) > 1 ? -1 : i)).filter(i => i >= 0);
      idx.forEach(i => d.deck.push(toDeckCard(d.board[i])));
      d.deck = d._rng.shuffle(d.deck);
      refill(d, idx, { skipFoeDrawEffects: true });
      maybePlaceCatalyst(d, idx, CATALYST_DEAL_CHANCE);
      syncCatalystCardState(d);
      emit(d, 'redeal');
    },
  },
  big_scoop: {
    activate: (d, a) => {
      const sets = allSets(d.board, d.attributes);
      if (sets.length === 0) return;
      const set = d._rng.pick(sets);
      a.scooped = set.map(c => c.id);
      emit(d, 'scoop');
      // Still fully charged while this Set is scored, so the free Set doesn't recharge the meter
      applyMatch(d, set, set.map(baseCardReward), undefined, Date.now());
    },
  },
};

// ─── Reducer ────────────────────────────────────────────────────────────────

export const runReducer = (state: RunState, action: RunAction): RunState => {
  if (action.type === 'CLEAR_EVENTS') {
    return { ...state, events: state.events.filter(e => e.id > action.upTo) };
  }
  const ended = state.status === 'won' || state.status === 'lost';
  if (ended && action.type !== 'REPLACE') return state;

  const d = begin(state);

  switch (action.type) {
    case 'MATCH': {
      if (d.status !== 'playing') return state;
      applyMatch(d, action.cards, action.rewards, action.effects, action.nowMs ?? Date.now());
      break;
    }

    case 'INVALID': {
      if (d.status !== 'playing') return state;
      d.mistakes += 1;
      d.purityChain = 0;
      d.lastDiffCount = 0;
      const s = d.roundStats;
      s.invalidMatches += 1;
      s.currentStreak = 0;
      s.consecutiveInvalidMatches += 1;
      const mods = d.foe.getStatModifiers();
      const mistakeBurn = arcanaRules(d.activeArcana).mistakeBurn;
      if (mistakeBurn && d.arcanaBurnCooldownMs <= 0) {
        d.arcanaBurnCooldownMs = mistakeBurn.cooldownMs;
        const pickedIds = new Set(action.cards.map(c => c.id));
        const candidates = d.board
          .map((c, i) => (isSelectable(c) && !c.onFire && !pickedIds.has(c.id) ? i : -1))
          .filter(i => i >= 0);
        const toIgnite = new Set(d._rng.shuffle(candidates).slice(0, mistakeBurn.cards));
        if (toIgnite.size > 0) {
          s.weaponEffectsTriggered.add('fire');
          d.board = d.board.map((c, i) => (toIgnite.has(i) ? { ...c, onFire: true, fireStartTime: Date.now() } : c));
        }
        emit(d, 'arcana_burn');
      } else {
        hurt(d, Math.floor(1 * (mods.damageMultiplier || 1)));
      }
      emit(d, 'mistake');
      if (d.ability) ABILITY_RULES[d.ability.id].onMistake?.(d, d.ability);
      const pickedCatalystIds = new Set(action.cards.map(c => c.id));
      if (d.features.has('evolutions') && d.board.some(c => pickedCatalystIds.has(c.id) && c.hasEvolutionItem)) {
        d.board = d.board.map(c => (pickedCatalystIds.has(c.id) && c.hasEvolutionItem ? { ...c, hasEvolutionItem: false, evolutionReady: false } : c));
        loseCatalyst(d);
      } else {
        syncCatalystCardState(d);
      }
      const res = d.foe.onInvalidMatch(action.cards, d.board);
      if (res.cardsToRemove.length) {
        const rm = new Set(res.cardsToRemove);
        const picked = new Set(action.cards.map(c => c.id));
        d.board = d.board.filter(c => !rm.has(c.id) || picked.has(c.id));
        pruneConnections(d);
        emit(d, 'card_removed');
      }
      emitEnemyEvents(d, res.events);
      break;
    }

    case 'REPLACE': {
      const ids = new Set(action.ids);
      const indices: number[] = [];
      d.board = d.board.map((c, i) => {
        if (!ids.has(c.id)) return c;
        if ((c.health ?? 1) > 1) return { ...c, health: (c.health ?? 1) - 1, selected: false };
        if (c.health === 1) d.roundStats.tripleCardsCleared += 1;
        indices.push(i);
        d.deck.push(toDeckCard(c));
        return c;
      });
      if (ended) {
        // keep the board stable behind the results screen
        return finish(d);
      }
      refill(d, indices);
      maybePlaceCatalyst(d, indices, CATALYST_REFILL_CHANCE);
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
      const burnedPositions = [idx, ...linked];
      const count = burnedPositions.length;
      dealDamage(d, count * (d.foe.getStatModifiers().pointsMultiplier || 1));
      emit(d, 'hit', count);
      addCoins(d, count);
      for (const bw of rollSeededBridges(d, 'onDestruction')) {
        if (bw.bridgeEffect?.effect === 'heal') heal(d, bw.bridgeEffect.amount ?? 1);
      }
      // 10% chance the fire jumps to a neighbour
      if (d._rng.next() < 0.1) {
        const burnedSet = new Set(burnedPositions);
        const adj = getAdjacentIndices(idx, d.board.length).filter(
          i => d.board[i] && !d.board[i].onFire && !burnedSet.has(i)
        );
        if (adj.length) {
          const t = d._rng.pick(adj);
          d.board = d.board.map((c, i) => (i === t ? { ...c, onFire: true, fireStartTime: Date.now() } : c));
        }
      }
      burnedPositions.forEach(p => d.deck.push(toDeckCard(d.board[p])));
      refill(d, burnedPositions);
      maybePlaceCatalyst(d, burnedPositions, CATALYST_REFILL_CHANCE);
      break;
    }

    case 'TICK': {
      if (d.status !== 'playing') return state;
      const mods = d.foe.getUIModifiers();
      const speed = (mods.timerSpeedMultiplier || 1) * (arcanaRules(d.activeArcana).timerSpeedScale ?? 1);
      d.elapsedMs += action.ms;
      if (d.arcanaBurnCooldownMs > 0) {
        d.arcanaBurnCooldownMs = Math.max(0, d.arcanaBurnCooldownMs - action.ms);
      }
      // Emperor Penguin — Deep Freeze: clock and foe stand still
      if (d.ability && d.ability.frozenMs > 0) {
        d.ability.frozenMs = Math.max(0, d.ability.frozenMs - action.ms);
        break;
      }
      if (d.timeLeft !== null) d.timeLeft = Math.max(0, d.timeLeft - (action.ms / 1000) * speed);

      const tick = d.foe.onTick(action.ms * speed, d.board);
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
      // A shrinking or shifting board must never deadlock
      if (!hasAnySet(d.board, d.attributes) && d.board.length >= 3) {
        const victims = d._rng.shuffle(d.board.map((_, i) => i).filter(i => isSelectable(d.board[i]) && (d.board[i].health ?? 1) <= 1)).slice(0, 3);
        victims.forEach(i => d.deck.push(toDeckCard(d.board[i])));
        refill(d, victims);
        maybePlaceCatalyst(d, victims, CATALYST_REFILL_CHANCE);
      }
      break;
    }

    case 'USE_HINT': {
      d.stats = { ...d.stats, hints: Math.max(0, d.stats.hints - 1) };
      d.roundStats.hintsUsed += 1;
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
      heal(d, arcanaRules(d.activeArcana).waveClearHeal ?? 0);
      d.wave += 1;
      const def = d.level.foes[d.wave];
      const next = createFoe(def);
      const hp = scaledFoeHp(def.hp, d.activeArcana);
      d.foe = next.foe;
      d.foeName = next.name;
      d.foeIcon = next.icon;
      d.foeHp = hp;
      d.foeMaxHp = hp;
      d.shopOptions = [];
      d.connections = [];
      if (d.catalystState !== 'available' && d.unlockedEvolutions.some(id => !d.evolvedRecipes.includes(id))) {
        d.catalystState = 'available';
      }
      d.status = 'playing';
      emit(d, 'wave', d.wave + 1);
      startFoe(d);
      if (d.stats.startingConnections > 0) addSeededRandomConnections(d, d.stats.startingConnections);
      maybePlaceCatalyst(d, d.board.map((_, i) => i), CATALYST_DEAL_CHANCE);
      break;
    }

    case 'ABILITY': {
      const a = d.ability;
      if (d.status !== 'playing' || !a || a.max <= 0 || a.charge < a.max) return state;
      ABILITY_RULES[a.id].activate?.(d, a);
      a.charge = 0;
      break;
    }
  }

  syncCatalystCardState(d);
  resolve(d);
  return finish(d);
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
