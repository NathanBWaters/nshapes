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
import type { BoardConnection, BridgeTriggerType, Card, CardReward, PlayerStats, Weapon, AttributeName } from '@/types';
import type { EnemyEvent, EnemyInstance } from '@/types/enemy';
import type { WeaponEffectResult } from '@/utils/weaponEffects';
import type { IconName } from '@/components/Icon';
import { createDeck } from '@/utils/gameUtils';
import { allSets, hasAnySet } from './sets';
import { getBoardSizeForAttributes } from '@/utils/gameConfig';
import { getAdjacentIndices } from '@/utils/weaponEffects';
import {
  arePositionsConnected,
  getLinkedDestructionPositions,
  selectPositionsToConnect,
} from '@/utils/connectionUtils';
import { DEFAULT_PLAYER_STATS, WEAPONS, canObtainWeapon } from '@/utils/gameDefinitions';
import { createEnemy, isEnemyRegistered } from '@/utils/enemyFactory';
import { createDummyEnemy } from '@/utils/enemyEffects';
import { createInitialRoundStats } from '@/hooks/useRoundStats';
import type { AdventureSave, ArcanaId, FoeDef, LevelDef, RunEvent, RunEventType, RunState } from '../types';
import { createRng, type Rng } from './rng';
import { getFeaturesForLevel, fighterLevel } from '../progress';
import { getLoadout, getPerkStats } from '../data/fighters';
import { UPGRADES, applyWeaponUpgradeTier } from '../data/upgrades';
import { challengeProgress } from './challenges';
import { ABILITY_TUNING, abilityFor } from '../data/abilities';
import { findEvolvedWeapon, getActiveEvolutionStatus, type EvolutionRecipe } from '../data/evolutions';

const MAX_BOARD = 21;
const COIN_CARD_CHANCE = 0.1;
const COIN_CARD_VALUE = 3;
const POWER_CARD_CHANCE = 0.12;
const POWER_CARD_BONUS = 2;
const RAINBOW_MULTIPLIER = 2;
const CATALYST_DEAL_CHANCE = 0.45;
const CATALYST_REFILL_CHANCE = 0.35;

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

const weaponById = (id: string, weaponUpgrades?: Record<string, number>): Weapon | undefined => {
  const base = WEAPONS.find(w => w.id === id) ?? findEvolvedWeapon(id);
  if (!base) return undefined;
  const tier = weaponUpgrades?.[id] ?? 0;
  return tier > 0 ? applyWeaponUpgradeTier(base, tier) : base;
};

/** Add a weapon's effects into baked stats (mirrors calculatePlayerTotalStats). */
const applyWeaponToStats = (stats: PlayerStats, weapon: Weapon): PlayerStats => {
  const next: PlayerStats = { ...stats, effectCaps: stats.effectCaps ? { ...stats.effectCaps } : undefined };
  for (const [k, v] of Object.entries(weapon.effects)) {
    const cur = (next as unknown as Record<string, unknown>)[k];
    if (typeof v === 'number' && typeof cur === 'number') {
      (next as unknown as Record<string, number>)[k] = cur + v;
    }
  }
  if (weapon.capIncrease && next.effectCaps) {
    const caps = next.effectCaps as unknown as Record<string, number>;
    if (caps[weapon.capIncrease.type] !== undefined) caps[weapon.capIncrease.type] += weapon.capIncrease.amount;
  }
  return next;
};

const addStats = (stats: PlayerStats, delta: Partial<PlayerStats>): PlayerStats => {
  const next = { ...stats };
  for (const [k, v] of Object.entries(delta)) {
    const cur = (next as unknown as Record<string, unknown>)[k];
    if (typeof v === 'number' && typeof cur === 'number') (next as unknown as Record<string, number>)[k] = cur + v;
  }
  return next;
};

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

const selectable = (c: Card) => !c.isDud && !c.isFaceDown;

const isRainbow = (cards: Card[], attrs: AttributeName[]): boolean =>
  cards.length === 3 && attrs.every(a => new Set(cards.map(c => c[a as keyof Card])).size === 3);

/** Count how many active attributes are all-different across the 3 matched cards. */
export const countDifferentAttributes = (cards: Card[], attrs: AttributeName[]): number => {
  if (cards.length !== 3) return 0;
  return attrs.filter(a => new Set(cards.map(c => c[a as keyof Card])).size === 3).length;
};

const scaledFoeHp = (baseHp: number, arcana: ArcanaId | null): number => {
  if (arcana === 'overkill_harvest') return Math.max(1, Math.round(baseHp * 1.15));
  if (arcana === 'catalyst_resonance') return Math.max(1, Math.round(baseHp * 1.1));
  return baseHp;
};

const makeFoe = (def: FoeDef): { foe: EnemyInstance; name: string; icon: IconName } => {
  if (def.enemy && isEnemyRegistered(def.enemy)) {
    const foe = createEnemy(def.enemy);
    return { foe, name: def.name ?? foe.name, icon: def.icon ?? foe.icon };
  }
  const foe = createDummyEnemy();
  return { foe, name: def.name ?? 'Sparring Foe', icon: def.icon ?? 'lorc/crossed-swords' };
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

/** Draw one card from the deck top (recycling is handled by the caller). */
const drawCard = (d: Draft, clean = false): Card => {
  if (d.deck.length === 0) d.deck = d._rng.shuffle(createDeck(d.attributes)).map(toDeckCard);
  const base = d.deck.shift()!;
  let card = freshCard(base);
  const specialMult = d.activeArcana === 'glass_prism' ? 3 : 1;
  if (d.features.has('coins') && d._rng.next() < COIN_CARD_CHANCE * specialMult) card.bonusMoney = COIN_CARD_VALUE;
  if (d.features.has('power') && d._rng.next() < POWER_CARD_CHANCE * specialMult) card.bonusPoints = POWER_CARD_BONUS;
  if (clean) return card;
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
const refill = (d: Draft, indices: number[], clean = false) => {
  if (indices.length === 0) return;
  for (let attempt = 0; attempt < 12; attempt++) {
    const drawn = indices.map(() => drawCard(d, clean));
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
    .map(id => weaponById(id, d.weaponUpgrades))
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
  // Orange Tabby — Nine Lives: shrug off one knockout per fight
  if (d.hearts === 0 && d.ability?.id === 'nine_lives' && !d.ability.spent) {
    d.ability.spent = true;
    d.hearts = 1;
    emit(d, 'nine_lives');
  }
  // Life Link bridge weapon — health loss can trigger retaliatory board explosions
  if (d.hearts > 0) {
    for (const w of rollSeededBridges(d, 'onHealthLoss')) {
      if (w.bridgeEffect?.effect === 'explosion') {
        const candidates = d.board
          .map((c, i) => (selectable(c) && (c.health ?? 1) <= 1 && !c.hasEvolutionItem ? i : -1))
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

/** Bonus damage from passive abilities for a Set made right now. */
const abilityBonusDamage = (d: Draft): number => {
  const a = d.ability;
  if (!a) return 0;
  if (a.id === 'combo') {
    const inWindow = d.matches > 0 && d.elapsedMs - d.lastMatchAtMs <= ABILITY_TUNING.comboWindowMs;
    a.combo = inWindow ? Math.min(ABILITY_TUNING.comboMax, a.combo + 1) : 0;
    if (a.combo > 0) emit(d, 'combo', a.combo);
    return a.combo;
  }
  if (a.id === 'grudge' && a.grudge > 0) {
    const bonus = a.grudge * ABILITY_TUNING.grudgeDamage;
    emit(d, 'grudge_release', bonus);
    a.grudge = 0;
    return bonus;
  }
  return 0;
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
    if (d.activeArcana === 'overkill_harvest') {
      addCoins(d, overkill * 2);
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
  const gained = d.activeArcana === 'scholars_gambit' ? amount * 2 : amount;
  d.xp += gained;
  while (d.xp >= xpForLevel(d.xpLevel)) {
    d.xp -= xpForLevel(d.xpLevel);
    d.xpLevel += 1;
    d.pendingPicks += 1;
    emit(d, 'levelup');
  }
};

const isEligibleCatalystCard = (c: Card | undefined): boolean =>
  !!c && selectable(c) && (c.health ?? 1) === 1 && !c.hasBomb && !c.hasCountdown;

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
  const chance = Math.min(1, baseChance * (d.activeArcana === 'catalyst_resonance' ? 2 : 1));
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

const triggerEvolution = (d: Draft, recipe: EvolutionRecipe, excludedCards: Card[], nowMs: number) => {
  const evolved = recipe.result;
  d.weapons = [...d.weapons, evolved];
  d.stats = applyWeaponToStats(d.stats, evolved);
  if (evolved.effects.maxHealth && d.hearts !== null && d.maxHearts !== null && d.activeArcana !== 'glass_prism') {
    d.maxHearts += evolved.effects.maxHealth;
    d.hearts = Math.min(d.maxHearts, d.hearts + (evolved.effects.health ?? 0));
  }
  d.evolvedRecipes = [...d.evolvedRecipes, recipe.id];
  d.catalystState = 'evolved';

  const b = recipe.burst;
  const resonance = d.activeArcana === 'catalyst_resonance';
  const burstDamage = (b.damage ?? 0) + (resonance ? 8 : 0);
  if (burstDamage > 0) {
    dealDamage(d, burstDamage * (d.foe.getStatModifiers().pointsMultiplier || 1));
  }
  if (b.heal) heal(d, b.heal);
  if (b.coins) addCoins(d, b.coins);
  const burstTime = (b.timeBonus ?? 0) + (resonance ? 8 : 0);
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
      .map((c, i) => (selectable(c) && !c.onFire && !excludedIds.has(c.id) ? i : -1))
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
  if (d.status === 'playing' && d.pendingPicks > 0) {
    d.pickOptions = rollPickOptions(d, d.activeArcana === 'scholars_gambit' ? 4 : 3);
    if (d.pickOptions.length === 0) d.pendingPicks = 0;
    else d.status = 'pick';
  }
};

// ─── Setup ──────────────────────────────────────────────────────────────────

interface RunSetupOptions {
  seed: number;
}

const computeStartingStats = (level: LevelDef, save: AdventureSave, fighter: string) => {
  const features = getFeaturesForLevel(level, save);
  const activeArcana: ArcanaId | null =
    features.has('gear') && save.activeArcana && save.unlockedArcana.includes(save.activeArcana)
      ? save.activeArcana
      : null;
  const lvl = fighterLevel(save, fighter);
  const weapons: Weapon[] = features.has('gear')
    ? getLoadout(fighter, lvl).map(id => weaponById(id, save.weaponUpgrades)).filter((w): w is Weapon => !!w)
    : [];
  // Charm: one equipped Armory weapon on top of the fighter's own gear
  const charm = features.has('gear') && save.charm && save.armory.includes(save.charm)
    ? weaponById(save.charm, save.weaponUpgrades)
    : undefined;
  if (charm) weapons.push(charm);
  let stats: PlayerStats = { ...DEFAULT_PLAYER_STATS, hints: 0, graces: 0, effectCaps: { ...DEFAULT_PLAYER_STATS.effectCaps! } };
  for (const w of weapons) stats = applyWeaponToStats(stats, w);
  stats = addStats(stats, getPerkStats(lvl));
  let bonusDamagePerMatch = 0;
  let coinBonusPercent = 0;
  for (const u of UPGRADES) {
    const tier = save.upgrades[u.id] ?? 0;
    if (tier <= 0) continue;
    stats = u.apply(stats, tier, { timed: !!level.rules.timer });
    bonusDamagePerMatch += u.bonusDamage?.(tier) ?? 0;
    coinBonusPercent += u.coinBonusPercent?.(tier) ?? 0;
  }
  // Features gate whole systems: no hints/graces before they're taught
  stats.hints = features.has('hints') ? stats.hints + (level.rules.startingHints ?? 0) : 0;
  stats.maxHints = Math.max(stats.maxHints, stats.hints);
  stats.graces = features.has('graces') ? stats.graces + (level.rules.startingGraces ?? 0) : 0;
  if (activeArcana === 'controlled_burn') stats.graces = 0;
  if (!features.has('graces')) stats.graceGainChance = 0;
  if (!features.has('hints')) stats.hintGainChance = 0;
  stats.maxGraces = Math.max(stats.maxGraces, stats.graces);

  const heartBonus = stats.maxHealth - DEFAULT_PLAYER_STATS.maxHealth;
  let maxHearts = features.has('hearts') ? Math.max(1, level.rules.hearts + heartBonus) : null;
  if (maxHearts !== null && activeArcana === 'scholars_gambit') maxHearts = Math.max(1, maxHearts - 1);
  if (maxHearts !== null && activeArcana === 'glass_prism') maxHearts = 1;
  return { features, activeArcana, weapons, stats, maxHearts, bonusDamagePerMatch, coinBonusPercent };
};

export const createRun = (level: LevelDef, save: AdventureSave, opts: RunSetupOptions): RunState => {
  const fighter = save.selectedFighter;
  const { features, activeArcana, weapons, stats, maxHearts, bonusDamagePerMatch, coinBonusPercent } = computeStartingStats(level, save, fighter);
  const rng = createRng(opts.seed);
  const attributes = level.rules.attributes;
  const baseSize = level.rules.boardSize ?? getBoardSizeForAttributes(attributes.length);
  const boardSize = Math.min(MAX_BOARD, Math.max(baseSize, features.has('gear') ? baseSize + (stats.fieldSize - DEFAULT_PLAYER_STATS.fieldSize) : baseSize));
  const first = makeFoe(level.foes[0]);
  const timer = level.rules.timer ? level.rules.timer + stats.startingTime : null;
  const startingMoves =
    level.rules.moves !== undefined
      ? activeArcana === 'tempo_surge' && !level.rules.timer
        ? Math.max(4, level.rules.moves - 1)
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
    catalystRespawnsLeft: activeArcana === 'catalyst_resonance' ? 1 : 0,
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
      const matched = action.cards.slice(0, 3);
      const graceUsed = action.rewards.some(r => r.effectType === 'grace');
      const fx = action.effects;

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

      let points = action.rewards.reduce((a, r) => a + (r.points ?? 0), 0);
      if (d.activeArcana === 'prismatic_fever' && !rainbow) {
        points = Math.max(1, points - 1);
      }
      if (d.activeArcana === 'monochrome_pact' && !graceUsed && diffCount === 1) {
        points += 3;
      }
      const rainbowMult = rainbow
        ? d.activeArcana === 'monochrome_pact'
          ? 1
          : d.activeArcana === 'prismatic_fever'
            ? 3
            : RAINBOW_MULTIPLIER
        : 1;
      const tempoMult = d.activeArcana === 'tempo_surge' ? 1.25 : 1;
      const enemyMult = (enemyResult.pointsMultiplier || 1) * (statMods.pointsMultiplier || 1);
      const dmg = (points + d.bonusDamagePerMatch + abilityBonusDamage(d)) * rainbowMult * tempoMult * enemyMult + purityDamage * enemyMult;
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
      const money = action.rewards.reduce((a, r) => a + (r.money ?? 0), 0) + (fx?.bonusCoins ?? 0) + purityCoins;
      addCoins(d, money);
      const xp = action.rewards.reduce((a, r) => a + (r.experience ?? 0), 0) + (fx?.bonusExperience ?? 0);
      addXp(d, xp);
      const healing = action.rewards.reduce((a, r) => a + (r.healing ?? 0), 0) + (fx?.bonusHealing ?? 0);
      heal(d, healing);
      let hints = action.rewards.reduce((a, r) => a + (r.hint ?? 0), 0) + (fx?.bonusHints ?? 0);
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
      const connectedCount = action.rewards.filter(r => r.effectType === 'connected').length;
      const linkTimeBonus = connectedCount > 0 ? connectedCount * (d.stats.echoTimeBonusPerLink || 0) : 0;
      const arcanaTimeBonus =
        (d.activeArcana === 'prismatic_fever' && rainbow ? 4 : 0) +
        (d.activeArcana === 'tempo_surge' ? 2 : 0);
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
          const now = action.nowMs ?? Date.now();
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
        const matchedIds = new Set(action.cards.map(c => c.id));
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
          triggerEvolution(d, preMatchEvo.recipe, action.cards, action.nowMs ?? Date.now());
        } else {
          loseCatalyst(d);
        }
      } else {
        syncCatalystCardState(d);
      }

      resolve(d);
      return finish(d);
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
      if (d.activeArcana === 'controlled_burn' && d.arcanaBurnCooldownMs <= 0) {
        d.arcanaBurnCooldownMs = 12000;
        const pickedIds = new Set(action.cards.map(c => c.id));
        const candidates = d.board
          .map((c, i) => (selectable(c) && !c.onFire && !pickedIds.has(c.id) ? i : -1))
          .filter(i => i >= 0);
        const toIgnite = new Set(d._rng.shuffle(candidates).slice(0, 2));
        if (toIgnite.size > 0) {
          s.weaponEffectsTriggered.add('fire');
          d.board = d.board.map((c, i) => (toIgnite.has(i) ? { ...c, onFire: true, fireStartTime: Date.now() } : c));
        }
        emit(d, 'arcana_burn');
      } else {
        hurt(d, Math.floor(1 * (mods.damageMultiplier || 1)));
      }
      emit(d, 'mistake');
      if (d.ability?.id === 'combo') d.ability.combo = 0;
      if (d.ability?.id === 'grudge' && d.ability.grudge < ABILITY_TUNING.grudgeMax) {
        d.ability.grudge += 1;
        emit(d, 'grudge', d.ability.grudge);
      }
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
      syncCatalystCardState(d);
      resolve(d);
      return finish(d);
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
      syncCatalystCardState(d);
      syncStats(d);
      return finish(d);
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
      syncCatalystCardState(d);
      resolve(d);
      return finish(d);
    }

    case 'TICK': {
      if (d.status !== 'playing') return state;
      const mods = d.foe.getUIModifiers();
      const speed = (mods.timerSpeedMultiplier || 1) * (d.activeArcana === 'tempo_surge' ? 1.2 : 1);
      d.elapsedMs += action.ms;
      if (d.arcanaBurnCooldownMs > 0) {
        d.arcanaBurnCooldownMs = Math.max(0, d.arcanaBurnCooldownMs - action.ms);
      }
      // Emperor Penguin — Deep Freeze: clock and foe stand still
      if (d.ability && d.ability.frozenMs > 0) {
        d.ability.frozenMs = Math.max(0, d.ability.frozenMs - action.ms);
        resolve(d);
        return finish(d);
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
        const victims = d._rng.shuffle(d.board.map((_, i) => i).filter(i => selectable(d.board[i]) && (d.board[i].health ?? 1) <= 1)).slice(0, 3);
        victims.forEach(i => d.deck.push(toDeckCard(d.board[i])));
        refill(d, victims);
        maybePlaceCatalyst(d, victims, CATALYST_REFILL_CHANCE);
      }
      syncCatalystCardState(d);
      resolve(d);
      return finish(d);
    }

    case 'USE_HINT': {
      d.stats = { ...d.stats, hints: Math.max(0, d.stats.hints - 1) };
      d.roundStats.hintsUsed += 1;
      syncCatalystCardState(d);
      syncStats(d);
      return finish(d);
    }

    case 'PICK': {
      if (d.status !== 'pick') return state;
      const w = action.weaponId ? d.pickOptions.find(x => x.id === action.weaponId) : undefined;
      if (w) {
        d.weapons = [...d.weapons, w];
        d.stats = applyWeaponToStats(d.stats, w);
        if (w.effects.maxHealth && d.hearts !== null && d.maxHearts !== null && d.activeArcana !== 'glass_prism') {
          d.maxHearts += w.effects.maxHealth;
          d.hearts += w.effects.health ?? 0;
        }
      }
      d.pendingPicks = Math.max(0, d.pendingPicks - 1);
      d.pickOptions = [];
      d.status = 'playing';
      syncCatalystCardState(d);
      resolve(d);
      return finish(d);
    }

    case 'BUY': {
      if (d.status !== 'intermission') return state;
      const w = d.shopOptions[action.index];
      if (!w || d.coins < shopPrice(w)) return state;
      d.coins -= shopPrice(w);
      d.weapons = [...d.weapons, w];
      d.stats = applyWeaponToStats(d.stats, w);
      if (w.effects.maxHealth && d.hearts !== null && d.maxHearts !== null && d.activeArcana !== 'glass_prism') {
        d.maxHearts += w.effects.maxHealth;
        d.hearts += w.effects.health ?? 0;
      }
      d.shopOptions = d.shopOptions.filter((_, i) => i !== action.index);
      syncCatalystCardState(d);
      return finish(d);
    }

    case 'REROLL': {
      if (d.status !== 'intermission') return state;
      const cost = rerollCost(d);
      if (d.coins < cost) return state;
      d.coins -= cost;
      d.rerolls += 1;
      d.shopOptions = rollPickOptions(d, 3);
      return finish(d);
    }

    case 'NEXT_WAVE': {
      if (d.status !== 'intermission') return state;
      d.foe.onRoundEnd();
      if (d.activeArcana === 'overkill_harvest') heal(d, 1);
      d.wave += 1;
      const def = d.level.foes[d.wave];
      const next = makeFoe(def);
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
      syncCatalystCardState(d);
      resolve(d);
      return finish(d);
    }

    case 'ABILITY': {
      const a = d.ability;
      if (d.status !== 'playing' || !a || a.max <= 0 || a.charge < a.max) return state;
      a.charge = 0;
      if (a.id === 'deep_freeze') {
        a.frozenMs = ABILITY_TUNING.freezeMs;
        emit(d, 'freeze');
        return finish(d);
      }
      if (a.id === 'zoomies') {
        // Re-deal every card that isn't armored; duds and hidden cards are swept away
        const idx = d.board.map((c, i) => ((c.health ?? 1) > 1 ? -1 : i)).filter(i => i >= 0);
        idx.forEach(i => d.deck.push(toDeckCard(d.board[i])));
        d.deck = d._rng.shuffle(d.deck);
        refill(d, idx, true); // a clean board: the foe's draw effects don't apply
        maybePlaceCatalyst(d, idx, CATALYST_DEAL_CHANCE);
        syncCatalystCardState(d);
        emit(d, 'redeal');
        return finish(d);
      }
      if (a.id === 'big_scoop') {
        const set = findSetOnBoard(d.board, d.attributes, d._rng);
        if (!set) return finish(d);
        a.scooped = set.map(c => c.id);
        emit(d, 'scoop');
        const rewards = set.map(c => ({ cardId: c.id, points: 1 + (c.bonusPoints ?? 0), money: 1 + (c.bonusMoney ?? 0), experience: 1 }));
        const after = runReducer(finish(d), { type: 'MATCH', cards: set, rewards });
        // the free Set doesn't recharge the meter it just spent
        return after.ability ? { ...after, ability: { ...after.ability, charge: 0 } } : after;
      }
      return finish(d);
    }
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

/** Cards a selection would remove that are still selectable (for bots / hints). */
const findSetOnBoard = (board: Card[], attrs: AttributeName[], rng?: Rng): Card[] | null => {
  const sets = allSets(board, attrs);
  if (sets.length === 0) return null;
  return rng ? rng.pick(sets) : sets[0];
};
