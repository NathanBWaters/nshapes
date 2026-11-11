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
import type { Card, CardReward, PlayerStats, Weapon, AttributeName } from '@/types';
import type { EnemyEvent, EnemyInstance } from '@/types/enemy';
import type { WeaponEffectResult } from '@/utils/weaponEffects';
import type { IconName } from '@/components/Icon';
import { createDeck, isValidCombination } from '@/utils/gameUtils';
import { allSets, hasAnySet } from './sets';
import { getBoardSizeForAttributes } from '@/utils/gameConfig';
import { getAdjacentIndices } from '@/utils/weaponEffects';
import { DEFAULT_PLAYER_STATS, WEAPONS, canObtainWeapon } from '@/utils/gameDefinitions';
import { createEnemy, createDummyEnemy, isEnemyRegistered } from '@/utils/enemyFactory';
import { createInitialRoundStats } from '@/hooks/useRoundStats';
import '@/utils/enemies';
import type { AdventureSave, FoeDef, LevelDef, RunEvent, RunEventType, RunState } from '../types';
import { createRng, type Rng } from './rng';
import { getFeaturesForLevel, fighterLevel } from '../progress';
import { getLoadout, getPerkStats } from '../data/fighters';
import { UPGRADES } from '../data/upgrades';
import { challengeProgress } from './challenges';
import { ABILITY_TUNING, abilityFor } from '../data/abilities';

export const MAX_BOARD = 21;
export const COIN_CARD_CHANCE = 0.1;
export const COIN_CARD_VALUE = 3;
export const RAINBOW_MULTIPLIER = 2;

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
  | { type: 'CLEAR_EVENTS'; upTo: number }
  | { type: 'FORFEIT' };

// ─── Helpers ────────────────────────────────────────────────────────────────

const weaponById = (id: string): Weapon | undefined => WEAPONS.find(w => w.id === id);

/** Add a weapon's effects into baked stats (mirrors calculatePlayerTotalStats). */
export const applyWeaponToStats = (stats: PlayerStats, weapon: Weapon): PlayerStats => {
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

export const boardHasSet = (board: Card[], attrs: AttributeName[]): boolean => hasAnySet(board, attrs);

const isRainbow = (cards: Card[], attrs: AttributeName[]): boolean =>
  cards.length === 3 && attrs.every(a => new Set(cards.map(c => c[a as keyof Card])).size === 3);

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
const drawCard = (d: Draft): Card => {
  if (d.deck.length === 0) d.deck = d._rng.shuffle(createDeck(d.attributes)).map(toDeckCard);
  const base = d.deck.shift()!;
  let card = freshCard(base);
  if (d.features.has('coins') && d._rng.next() < COIN_CARD_CHANCE) card.bonusMoney = COIN_CARD_VALUE;
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
const refill = (d: Draft, indices: number[]) => {
  if (indices.length === 0) return;
  for (let attempt = 0; attempt < 12; attempt++) {
    const drawn = indices.map(() => drawCard(d));
    const candidate = [...d.board];
    indices.forEach((idx, i) => (candidate[idx] = drawn[i]));
    if (boardHasSet(candidate, d.attributes) || attempt === 11) {
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
  const weapons = d.armory.map(weaponById).filter((w): w is Weapon => !!w && canObtainWeapon(w, d.weapons));
  return d._rng.shuffle(weapons).slice(0, count);
};

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
  d.xp += amount;
  while (d.xp >= xpForLevel(d.xpLevel)) {
    d.xp -= xpForLevel(d.xpLevel);
    d.xpLevel += 1;
    d.pendingPicks += 1;
    emit(d, 'levelup');
  }
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
    d.pickOptions = rollPickOptions(d, 3);
    if (d.pickOptions.length === 0) d.pendingPicks = 0;
    else d.status = 'pick';
  }
};

// ─── Setup ──────────────────────────────────────────────────────────────────

export interface RunSetupOptions {
  seed: number;
  fighter?: string;
}

export const computeStartingStats = (level: LevelDef, save: AdventureSave, fighter: string) => {
  const features = getFeaturesForLevel(level);
  const lvl = fighterLevel(save, fighter);
  const weapons: Weapon[] = features.has('gear')
    ? getLoadout(fighter, lvl).map(weaponById).filter((w): w is Weapon => !!w)
    : [];
  let stats: PlayerStats = { ...DEFAULT_PLAYER_STATS, hints: 0, graces: 0, effectCaps: { ...DEFAULT_PLAYER_STATS.effectCaps! } };
  for (const w of weapons) stats = applyWeaponToStats(stats, w);
  stats = addStats(stats, getPerkStats(fighter, lvl));
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
  if (!features.has('graces')) stats.graceGainChance = 0;
  if (!features.has('hints')) stats.hintGainChance = 0;
  stats.maxGraces = Math.max(stats.maxGraces, stats.graces);

  const heartBonus = stats.maxHealth - DEFAULT_PLAYER_STATS.maxHealth;
  const maxHearts = features.has('hearts') ? Math.max(1, level.rules.hearts + heartBonus) : null;
  return { features, weapons, stats, maxHearts, bonusDamagePerMatch, coinBonusPercent };
};

export const createRun = (level: LevelDef, save: AdventureSave, opts: RunSetupOptions): RunState => {
  const fighter = opts.fighter ?? save.selectedFighter;
  const { features, weapons, stats, maxHearts, bonusDamagePerMatch, coinBonusPercent } = computeStartingStats(level, save, fighter);
  const rng = createRng(opts.seed);
  const attributes = level.rules.attributes;
  const baseSize = level.rules.boardSize ?? getBoardSizeForAttributes(attributes.length);
  const boardSize = Math.min(MAX_BOARD, Math.max(baseSize, features.has('gear') ? baseSize + (stats.fieldSize - DEFAULT_PLAYER_STATS.fieldSize) : baseSize));
  const first = makeFoe(level.foes[0]);
  const timer = level.rules.timer ? level.rules.timer + stats.startingTime : null;

  const state: RunState = {
    level,
    fighter: fighter as RunState['fighter'],
    features,
    rng: rng.state,
    attributes,
    deck: rng.shuffle(createDeck(attributes)).map(toDeckCard),
    board: [],
    stats,
    weapons,
    hearts: maxHearts,
    maxHearts,
    wave: 0,
    foe: first.foe,
    foeName: first.name,
    foeIcon: first.icon,
    foeHp: level.foes[0].hp,
    foeMaxHp: level.foes[0].hp,
    totalDamage: 0,
    matches: 0,
    mistakes: 0,
    movesLeft: level.rules.moves ?? null,
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
    roundStats: createInitialRoundStats(level.foes.reduce((a, f) => a + f.hp, 0), stats.hints, stats.graces),
    events: [],
    eventSeq: 0,
    bonusDamagePerMatch,
    coinBonusPercent,
    shopOptions: [],
    rerolls: 0,
    armory: save.armory,
    ability: null,
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
    if (boardHasSet(d.board, attributes)) break;
  }
  d.events = []; // don't coach-mark the deal itself
  startFoe(d);
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

      // Enemy reaction first (time theft, extra removals, flips)
      const enemyResult = d.foe.onValidMatch(matched, d.board);
      const statMods = d.foe.getStatModifiers();
      emitEnemyEvents(d, enemyResult.events);

      // Damage
      const rainbow = d.features.has('rainbow') && !graceUsed && isRainbow(matched, d.attributes);
      const points = action.rewards.reduce((a, r) => a + (r.points ?? 0), 0);
      const mult = (rainbow ? RAINBOW_MULTIPLIER : 1) * (enemyResult.pointsMultiplier || 1) * (statMods.pointsMultiplier || 1);
      const dmg = (points + d.bonusDamagePerMatch + abilityBonusDamage(d)) * mult;
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
      const money = action.rewards.reduce((a, r) => a + (r.money ?? 0), 0) + (fx?.bonusCoins ?? 0);
      addCoins(d, money);
      const xp = action.rewards.reduce((a, r) => a + (r.experience ?? 0), 0) + (fx?.bonusExperience ?? 0);
      addXp(d, xp);
      const healing = action.rewards.reduce((a, r) => a + (r.healing ?? 0), 0) + (fx?.bonusHealing ?? 0);
      heal(d, healing);
      const hints = action.rewards.reduce((a, r) => a + (r.hint ?? 0), 0) + (fx?.bonusHints ?? 0);
      if (hints > 0 && d.features.has('hints')) {
        d.stats = { ...d.stats, hints: Math.min(d.stats.maxHints, d.stats.hints + hints) };
        emit(d, 'hint', hints);
      }
      if (fx?.bonusGraces && d.features.has('graces')) {
        d.stats = { ...d.stats, graces: Math.min(d.stats.maxGraces, d.stats.graces + fx.bonusGraces) };
      }
      const timeDelta = (fx?.bonusTime ?? 0) + (enemyResult.timeDelta ?? 0);
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
        emit(d, 'card_removed');
      }
      if (fx?.boardGrowth) {
        const extra = Math.min(fx.boardGrowth, MAX_BOARD - d.board.length);
        const added: Card[] = [];
        for (let i = 0; i < extra; i++) added.push(drawCard(d));
        d.board = [...d.board, ...added];
      }
      resolve(d);
      return finish(d);
    }

    case 'INVALID': {
      if (d.status !== 'playing') return state;
      d.mistakes += 1;
      const s = d.roundStats;
      s.invalidMatches += 1;
      s.currentStreak = 0;
      s.consecutiveInvalidMatches += 1;
      const mods = d.foe.getStatModifiers();
      hurt(d, Math.floor(1 * (mods.damageMultiplier || 1)));
      emit(d, 'mistake');
      if (d.ability?.id === 'combo') d.ability.combo = 0;
      if (d.ability?.id === 'grudge' && d.ability.grudge < ABILITY_TUNING.grudgeMax) {
        d.ability.grudge += 1;
        emit(d, 'grudge', d.ability.grudge);
      }
      const res = d.foe.onInvalidMatch(action.cards, d.board);
      if (res.cardsToRemove.length) {
        const rm = new Set(res.cardsToRemove);
        const picked = new Set(action.cards.map(c => c.id));
        d.board = d.board.filter(c => !rm.has(c.id) || picked.has(c.id));
        emit(d, 'card_removed');
      }
      emitEnemyEvents(d, res.events);
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
      syncStats(d);
      return finish(d);
    }

    case 'BURN': {
      if (d.status !== 'playing') return state;
      const idx = d.board.findIndex(c => c.id === action.card.id);
      if (idx === -1) return state;
      dealDamage(d, 1 * (d.foe.getStatModifiers().pointsMultiplier || 1));
      emit(d, 'hit', 1);
      addCoins(d, 1);
      // 10% chance the fire jumps to a neighbour
      if (d._rng.next() < 0.1) {
        const adj = getAdjacentIndices(idx, d.board.length).filter(i => d.board[i] && !d.board[i].onFire);
        if (adj.length) {
          const t = d._rng.pick(adj);
          d.board = d.board.map((c, i) => (i === t ? { ...c, onFire: true, fireStartTime: Date.now() } : c));
        }
      }
      d.deck.push(toDeckCard(d.board[idx]));
      refill(d, [idx]);
      resolve(d);
      return finish(d);
    }

    case 'TICK': {
      if (d.status !== 'playing') return state;
      const mods = d.foe.getUIModifiers();
      const speed = mods.timerSpeedMultiplier || 1;
      d.elapsedMs += action.ms;
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
      if (!boardHasSet(d.board, d.attributes) && d.board.length >= 3) {
        const victims = d._rng.shuffle(d.board.map((_, i) => i).filter(i => selectable(d.board[i]) && (d.board[i].health ?? 1) <= 1)).slice(0, 3);
        victims.forEach(i => d.deck.push(toDeckCard(d.board[i])));
        refill(d, victims);
      }
      resolve(d);
      return finish(d);
    }

    case 'USE_HINT': {
      d.stats = { ...d.stats, hints: Math.max(0, d.stats.hints - 1) };
      d.roundStats.hintsUsed += 1;
      syncStats(d);
      return finish(d);
    }

    case 'PICK': {
      if (d.status !== 'pick') return state;
      const w = action.weaponId ? d.pickOptions.find(x => x.id === action.weaponId) : undefined;
      if (w) {
        d.weapons = [...d.weapons, w];
        d.stats = applyWeaponToStats(d.stats, w);
        if (w.effects.maxHealth && d.hearts !== null && d.maxHearts !== null) {
          d.maxHearts += w.effects.maxHealth;
          d.hearts += w.effects.health ?? 0;
        }
      }
      d.pendingPicks = Math.max(0, d.pendingPicks - 1);
      d.pickOptions = [];
      d.status = 'playing';
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
      if (w.effects.maxHealth && d.hearts !== null && d.maxHearts !== null) {
        d.maxHearts += w.effects.maxHealth;
        d.hearts += w.effects.health ?? 0;
      }
      d.shopOptions = d.shopOptions.filter((_, i) => i !== action.index);
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
      d.wave += 1;
      const def = d.level.foes[d.wave];
      const next = makeFoe(def);
      d.foe = next.foe;
      d.foeName = next.name;
      d.foeIcon = next.icon;
      d.foeHp = def.hp;
      d.foeMaxHp = def.hp;
      d.shopOptions = [];
      d.status = 'playing';
      emit(d, 'wave', d.wave + 1);
      startFoe(d);
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
        refill(d, idx);
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

    case 'FORFEIT': {
      d.status = 'lost';
      d.endReason = 'hearts';
      return finish(d);
    }
  }
  return state;
};

export const shopPrice = (w: Weapon): number => Math.round(w.price * 2);
export const rerollCost = (s: RunState): number => 5 + s.rerolls * 5;

/** ★ = survived, ★★ = every foe defeated, ★★★ = defeated + challenge. */
export const computeStars = (s: RunState): number => {
  if (s.status === 'lost') return 0;
  if (s.status !== 'won') return 0;
  if (s.endReason === 'survived') return 1;
  return s.challengeMet ? 3 : 2;
};

/** Cards a selection would remove that are still selectable (for bots / hints). */
export const findSetOnBoard = (board: Card[], attrs: AttributeName[], rng?: Rng): Card[] | null => {
  const sets = allSets(board, attrs);
  if (sets.length === 0) return null;
  return rng ? rng.pick(sets) : sets[0];
};

export const invalidCount = (cards: Card[], attrs: AttributeName[]): number =>
  isValidCombination(cards, attrs).invalidAttributes.length;
