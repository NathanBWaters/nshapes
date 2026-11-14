/**
 * The mutable working copy of a run inside one reducer step, and the
 * primitives everything else builds on: cards, damage, hearts, coins, area
 * destruction, Catalyst and trap placement.
 *
 * Primitives never run rules themselves. They queue fight events, and
 * rules/engine.ts resolves the queue (`drain`), so any source can chain into
 * any other without the primitives knowing about rules.
 */
import type { AttributeName, BoardConnection, BridgeTriggerType, Card, PlayerStats, Weapon } from '@/types';
import { ATTRIBUTE_VALUES, createDeck } from '@/utils/gameUtils';
import { getLinkedDestructionPositions, arePositionsConnected } from '@/utils/connectionUtils';
import type { ArcanaRules, FightLogLine, FightLogSetMath, PassiveId, RunEvent, RunEventType, RunState } from '../types';
import type { Area, Modifiers, TrickKind, WeaponTriggerKind } from '../rules/types';
import { arcanaRules } from '../data/arcana';
import { BASE_RULES, TRICK_RULES } from '../data/rules';
import { PASSIVE_TUNING } from '../data/passives';
import { createRng, type Rng } from './rng';
import { hasAnySet, isSelectable } from './sets';
import { EVOLUTION_RULES, evolutionLikelihoodFor, liveRules, modifiersOf, type KeyedRule } from './sources';

export const MAX_BOARD = 21;
export const GRID_COLS = 3;
export const MAX_TRAPS_PER_KIND = 2;
export const FOG_MS = TRICK_RULES.fogMs;
export const SNARE_DEFUSE_DAMAGE = 4;
/** Rule and evolution time gains can lift the clock this far above its start */
export const TIME_HEADROOM = 15;

// ─── Fight events ───────────────────────────────────────────────────────────

export type FightEventKind =
  | 'set' | 'rainbow' | 'mistake' | 'healed' | 'hurt' | 'weapon'
  | 'fightStart' | 'waveStart' | 'evolutionStart' | 'evolutionEnd' | 'trapDefused'
  | 'bonusCardMatched' | 'cardBroken' | 'hintUsed' | 'graceUsed' | 'cardBurned' | 'linkDestroyed' | 'trick';

export interface FightEvent {
  on: FightEventKind;
  kind?: WeaponTriggerKind;
  trick?: TrickKind;
}

/** The Set being scored, for set triggers and set conditions. */
export interface SetContext {
  diffCount: number;
  rainbow: boolean;
  /** Time since the previous Set (or the fight start) */
  sinceLastMs: number;
  firstOfWave: boolean;
  /** This Set's number in the fight (1 = first) */
  matchNo: number;
}

export interface FightHooks {
  /** Score a random Set on the board for the player and replace its cards */
  autoSet(d: Draft, source?: 'scoop'): void;
}

export interface Draft extends RunState {
  _rng: Rng;
  _queue: { ev: FightEvent; chain: readonly string[]; setCtx: SetContext | null }[];
  /** Keys of the rules whose effects are running right now (events queued now inherit them) */
  _chain: readonly string[];
  _firings: number;
  _mods: Modifiers | null;
  _rules: KeyedRule[] | null;
  _arcana: ArcanaRules | null;
  _setCtx: SetContext | null;
  _hooks: FightHooks;
  /** Events emitted during this action, with the rule that caused them (engine/fightLog.ts) */
  _lines: FightLogLine[];
  /** How the player's Set in this action was scored */
  _logSet: FightLogSetMath | null;
}

/**
 * Note: `board` keeps its reference until something actually changes it
 * (always replace, never mutate in place). GameBoard treats a new board
 * array as "the board changed" and clears hints/selection state.
 */
export const begin = (s: RunState, hooks: FightHooks): Draft => ({
  ...s,
  passive: { ...s.passive },
  gear: { ...s.gear },
  ruleState: { ...s.ruleState },
  activeEvolutions: s.activeEvolutions.map(e => ({ ...e })),
  hazardRefills: { ...s.hazardRefills },
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
  _queue: [],
  _chain: [],
  _firings: 0,
  _mods: null,
  _rules: null,
  _arcana: null,
  _setCtx: null,
  _hooks: hooks,
  _lines: [],
  _logSet: null,
});

export const finish = (d: Draft): RunState => {
  const { _rng, _queue, _chain, _firings, _mods, _rules, _arcana, _setCtx, _hooks, _lines, _logSet, ...rest } = d;
  return { ...rest, rng: _rng.state };
};

export const emit = (d: Draft, type: RunEventType, amount?: number, text?: string) => {
  d.eventSeq += 1;
  // Which rule (if any) caused it: the fight log names it, and the band plays that weapon's voice
  const source = d._chain[d._chain.length - 1];
  const e: RunEvent = source ? { id: d.eventSeq, type, amount, text, source } : { id: d.eventSeq, type, amount, text };
  d.events.push(e);
  if (d.events.length > 60) d.events.shift();
  d._lines.push(source ? { type, amount, text, source } : { type, amount, text });
};

export const enqueue = (d: Draft, on: FightEventKind, kind?: WeaponTriggerKind, trick?: TrickKind) => {
  d._queue.push({ ev: { on, ...(kind ? { kind } : {}), ...(trick ? { trick } : {}) }, chain: d._chain, setCtx: d._setCtx });
};

// ─── Sources, modifiers & tuning ────────────────────────────────────────────

const sourceInputs = (d: RunState) => ({ skillNodes: d.skillNodes, weapons: d.weapons, activeEvolutions: d.activeEvolutions });

export const mods = (d: Draft): Modifiers => (d._mods ??= modifiersOf(sourceInputs(d)));
export const liveRulesOf = (d: Draft): KeyedRule[] => (d._rules ??= liveRules(sourceInputs(d)));
export const arcana = (d: Draft): ArcanaRules => (d._arcana ??= arcanaRules(d.arcana));

const CHANCE_STATS: Record<WeaponTriggerKind, keyof PlayerStats> = {
  explosion: 'explosionChance',
  laser: 'laserChance',
  fire: 'fireSpreadChance',
  ricochet: 'ricochetChance',
  echo: 'echoChance',
  heal: 'healingChance',
  coin: 'coinGainChance',
  time: 'timeGainChance',
  hint: 'hintGainChance',
  grace: 'graceGainChance',
  xp: 'xpGainChance',
  growth: 'boardGrowthChance',
};

export const chanceStatsOf = (stats: PlayerStats): Record<string, number> =>
  Object.fromEntries(Object.values(CHANCE_STATS).map(k => [k, stats[k] as number]));

/** Re-derive everything that depends on the live sources (call after weapons or evolutions change). */
export const refreshSources = (d: Draft) => {
  d._mods = null;
  d._rules = null;
  const m = mods(d);
  const scale = m.weaponChanceScale ?? {};
  let stats = d.stats;
  for (const [kind, key] of Object.entries(CHANCE_STATS) as [WeaponTriggerKind, keyof PlayerStats][]) {
    const want = Math.round((d.baseChances[key] ?? 0) * (scale[kind] ?? 1));
    if (stats[key] !== want) {
      if (stats === d.stats) stats = { ...stats };
      (stats as unknown as Record<string, number>)[key] = want;
    }
  }
  d.stats = stats;
  d.evolutionLikelihood = d.features.has('evolutions')
    ? evolutionLikelihoodFor(d.evolutionLabTier, m, arcana(d).catalystChanceScale ?? 1) + (d.level.rules.evolutionLikelihood ?? 0)
    : 0;
  d.evolutionCap = EVOLUTION_RULES.perFight + (m.extraEvolutionsPerFight ?? 0);
};

const DEFAULT_TUNING: Record<string, number> = Object.assign({}, ...Object.values(PASSIVE_TUNING));

/** A passive's tuning number with skill-node (and other) deltas applied. */
export const tuning = (d: Draft, key: string): number => (DEFAULT_TUNING[key] ?? 0) + (mods(d).passiveTuning?.[key] ?? 0);

export const hasPassive = (d: Draft, id: PassiveId) => d.passives.includes(id);

/** A passive tuning number for a finished state (HUD, results): base + skill nodes + active evolutions. */
export const passiveTuningOf = (s: RunState, key: string): number =>
  (DEFAULT_TUNING[key] ?? 0) + (modifiersOf(sourceInputs(s)).passiveTuning?.[key] ?? 0);

// ─── Cards ──────────────────────────────────────────────────────────────────

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
export const toDeckCard = (c: Card): Card => ({
  id: c.id, shape: c.shape, color: c.color, number: c.number, shading: c.shading, background: c.background, selected: false,
});

const withAttribute = (c: Card, attribute: AttributeName, value: string | number): Card =>
  ({ ...c, [attribute]: value }) as Card;

/**
 * Trick weapons that change what gets dealt (engine/gear.ts has the rest):
 * a wild card, a twin of a card on the board, or a card hidden in fog.
 */
const dealTricks = (d: Draft, card: Card): Card => {
  const m = mods(d);
  const roll = (pct: number | undefined) => (pct ?? 0) > 0 && d._rng.next() * 100 < pct!;
  if (roll(m.wildChance) && !d.board.some(c => c.isWild)) return { ...card, isWild: true };
  if (roll(m.twinChance)) {
    const originals = d.board.filter(c => isSelectable(c) && !c.isWild && !c.twinOf && !c.hasEvolutionItem && !d.replacing.includes(c.id));
    if (originals.length) {
      const t = d._rng.pick(originals);
      card = { ...card, shape: t.shape, color: t.color, number: t.number, shading: t.shading, background: t.background, twinOf: t.id };
    }
  }
  if (roll(m.decoyChance) && !card.twinOf) {
    // Decoy: a board card with one trait changed. Unmarked on purpose: spotting it is the game.
    const originals = d.board.filter(c => isSelectable(c) && !c.isWild && !c.hasEvolutionItem && !d.replacing.includes(c.id));
    if (originals.length) {
      const t = d._rng.pick(originals);
      const attribute = d._rng.pick(d.attributes);
      const current = attribute === 'background' ? t.background ?? 'white' : t[attribute];
      const value = d._rng.pick((ATTRIBUTE_VALUES[attribute] as readonly (string | number)[]).filter(v => v !== current));
      card = { ...card, shape: t.shape, color: t.color, number: t.number, shading: t.shading, background: t.background, [attribute]: value, decoyOf: t.id } as Card;
    }
  }
  if (roll(m.fogChance)) return { ...card, isFaceDown: true, fogFlipAt: d.elapsedMs + FOG_MS, fogBonus: m.fogBonus ?? 0 };
  if (roll(m.curseChance)) return { ...card, locked: true, cursedUntil: d.elapsedMs + TRICK_RULES.curseMs };
  if (roll(m.thornChance) && d.board.filter(c => c.thornAt !== undefined).length < TRICK_RULES.thornCards) card = { ...card, thornAt: d.elapsedMs + TRICK_RULES.thornMs + TRICK_RULES.thornMsPerExtraTrait * Math.max(0, d.attributes.length - 3) };
  if (roll(m.fuseChance)) card = { ...card, fuseAt: d.elapsedMs + TRICK_RULES.fuseMs };
  return card;
};

export interface DrawOptions {
  /** Deal the card as-is: the foe doesn't get to turn it into a dud, bomb, etc. */
  skipFoeDrawEffects?: boolean;
}

/** Draw one card from the deck top (recycling is handled by the caller). */
export const drawCard = (d: Draft, opts?: DrawOptions): Card => {
  // The deck holds the level's own traits (a Shading Surge adds shading to cards as they land)
  if (d.deck.length === 0) d.deck = d._rng.shuffle(createDeck(d.level.rules.attributes)).map(toDeckCard);
  const base = d.deck.shift()!;
  let card = freshCard(base);
  if (d.surge) card.shading = d.surge.active ? d._rng.pick(ATTRIBUTE_VALUES.shading) : ATTRIBUTE_VALUES.shading[0];
  if (d.simplified) card = withAttribute(card, d.simplified.attribute, d.simplified.value);
  const specialMult = arcana(d).specialCardChanceScale ?? 1;
  if (d.features.has('coins') && d._rng.next() < BASE_RULES.coinCardChance * specialMult) card.bonusMoney = BASE_RULES.coinCardValue;
  if (d.features.has('power') && d._rng.next() < BASE_RULES.powerCardChance * specialMult) card.bonusPoints = BASE_RULES.powerCardBonus;
  card = dealTricks(d, card);
  if (opts?.skipFoeDrawEffects) return card;
  card = d.foe.onCardDraw(card);
  if (card.isDud) emit(d, 'dud');
  if (card.isFaceDown) emit(d, 'face_down');
  if (card.hasBomb) emit(d, 'bomb');
  if (card.hasCountdown) emit(d, 'countdown');
  return card;
};

export interface RefillOptions extends DrawOptions {
  /** The refill comes from a Rainbow Strike (Catalyst bonus) */
  rainbow?: boolean;
  /** Don't count toward traps or roll for a Catalyst (re-deals) */
  quiet?: boolean;
}

/**
 * Replace the cards at `indices` with fresh draws. If that leaves the board
 * without any Set, redraw (a few times): the game should never deadlock.
 */
export const refill = (d: Draft, indices: number[], opts?: RefillOptions) => {
  if (indices.length === 0) return;
  for (let attempt = 0; attempt < 12; attempt++) {
    const drawn = indices.map(() => drawCard(d, opts));
    const candidate = [...d.board];
    indices.forEach((idx, i) => (candidate[idx] = drawn[i]));
    if (hasAnySet(candidate, d.attributes) || attempt === 11) {
      d.board = candidate;
      break;
    }
    d.deck.push(...drawn.map(toDeckCard));
  }
  if (opts?.quiet) return;
  countHazardRefills(d, indices);
  rollCatalyst(d, indices, !!opts?.rainbow);
};

/** Put cards back in the deck and refill their slots. */
export const recycle = (d: Draft, indices: number[], opts?: RefillOptions) => {
  indices.forEach(i => d.deck.push(toDeckCard(d.board[i])));
  refill(d, indices, opts);
};

export const updateCards = (d: Draft, indices: Iterable<number>, change: (c: Card) => Card) => {
  const set = new Set(indices);
  if (set.size === 0) return;
  d.board = d.board.map((c, i) => (set.has(i) ? change(c) : c));
};

const isReplacing = (d: Draft, c: Card) => d.replacing.includes(c.id);

/** Cards a rule may touch: not on their way out, and never the Catalyst. */
export const touchable = (d: Draft, i: number): boolean => {
  const c = d.board[i];
  return !!c && !isReplacing(d, c) && !c.hasEvolutionItem;
};

// ─── Combat primitives ──────────────────────────────────────────────────────

export const foeMultiplier = (d: Draft) => d.foe.getStatModifiers().pointsMultiplier || 1;

export const dealDamage = (d: Draft, amount: number): number => {
  const dmg = Math.max(0, Math.round(amount));
  const hpBefore = d.foeHp;
  if (hpBefore > 0 && dmg > hpBefore) {
    const overkill = dmg - hpBefore;
    d.overkillDamage = Math.max(d.overkillDamage, overkill);
    const coinsPerDamage = arcana(d).overkillCoinsPerDamage;
    if (coinsPerDamage !== undefined) {
      addCoins(d, overkill * coinsPerDamage);
      emit(d, 'overkill', overkill);
    }
  }
  d.foeHp = Math.max(0, d.foeHp - dmg);
  d.totalDamage += dmg;
  return dmg;
};

export const addCoins = (d: Draft, base: number) => {
  if (!d.features.has('coins') || base <= 0) return;
  const amount = Math.max(1, Math.round(base * d.level.coinMultiplier * (1 + d.coinBonusPercent / 100)));
  d.coins += amount;
  emit(d, 'coins', amount);
};

export const xpForLevel = (lvl: number): number => 6 + lvl * 5;

export const addXp = (d: Draft, amount: number) => {
  if (!d.features.has('xp') || amount <= 0) return;
  d.xp += amount * (arcana(d).xpScale ?? 1);
  while (d.xp >= xpForLevel(d.xpLevel)) {
    d.xp -= xpForLevel(d.xpLevel);
    d.xpLevel += 1;
    d.levelUpsTaken += 1;
    d.pendingPicks += 1;
    emit(d, 'levelup');
  }
};

export const heal = (d: Draft, amount: number) => {
  if (d.hearts === null || d.maxHearts === null || amount <= 0) return;
  const before = d.hearts;
  d.hearts = Math.min(d.maxHearts, d.hearts + amount);
  if (d.hearts > before) {
    emit(d, 'heal', d.hearts - before);
    enqueue(d, 'healed');
  }
};

export const rollBridges = (d: Draft, trigger: BridgeTriggerType): Weapon[] =>
  d.weapons.filter(
    w => w.specialEffect === 'bridge' && w.bridgeEffect?.trigger === trigger && d._rng.next() * 100 < w.bridgeEffect.chance
  );

export const hurt = (d: Draft, amount: number) => {
  if (d.hearts === null || amount <= 0) return;
  d.hearts = Math.max(0, d.hearts - amount);
  d.roundStats.damageReceived += amount;
  emit(d, 'hurt', amount);
  enqueue(d, 'hurt');
  if (d.hearts === 0 && d.passive.nineLivesLeft > 0) {
    d.passive.nineLivesLeft -= 1;
    d.hearts = 1;
    emit(d, 'nine_lives', d.passive.nineLivesLeft);
  }
  if (d.hearts > 0) {
    for (const w of rollBridges(d, 'onHealthLoss')) {
      if (w.bridgeEffect?.effect === 'explosion') destroyCards(d, areaIndices(d, { shape: 'random', count: 4 }), 'explosion');
    }
  }
};

/** Add seconds to the clock (timed fights only), up to `timeCap` and what is left in the fight's `timeBank`. */
export const addTime = (d: Draft, seconds: number, cap: number | null = d.timeCap) => {
  if (d.timeLeft === null || seconds === 0) return;
  const before = d.timeLeft;
  // (`typeof`: a run saved before the bank existed has none, and plays without the limit)
  const banked = typeof d.timeBank === 'number';
  const allowed = seconds > 0 && banked ? Math.min(seconds, d.timeBank!) : seconds;
  d.timeLeft = Math.max(0, cap === null ? d.timeLeft + allowed : Math.min(Math.max(cap, d.timeLeft), d.timeLeft + allowed));
  const gained = d.timeLeft - before;
  if (gained > 0) {
    if (banked) d.timeBank = Math.max(0, d.timeBank! - gained);
    emit(d, 'time_gain', Math.round(gained * 10) / 10);
  }
};

export const addHints = (d: Draft, n: number) => {
  if (!d.features.has('hints') || n <= 0) return;
  const hints = d.stats.hints + n;
  d.stats = { ...d.stats, hints, maxHints: Math.max(d.stats.maxHints, hints) };
  emit(d, 'hint', n);
};

export const addGraces = (d: Draft, n: number) => {
  if (!d.features.has('graces') || n <= 0) return;
  const graces = d.stats.graces + n;
  d.stats = { ...d.stats, graces, maxGraces: Math.max(d.stats.maxGraces, graces) };
};

// ─── Board effects ──────────────────────────────────────────────────────────

const rowsOf = (d: Draft) => Math.ceil(d.board.length / GRID_COLS);

/** Board indices covered by an area (3-column grid). Blocks pick a random anchor that fits. */
export const areaIndices = (d: Draft, area: Area): number[] => {
  const n = d.board.length;
  const all = d.board.map((_, i) => i);
  const usable = all.filter(i => touchable(d, i));
  if (usable.length === 0) return [];
  switch (area.shape) {
    case 'random':
      return d._rng.shuffle(usable).slice(0, Math.max(0, area.count));
    case 'row': {
      const rows = [...new Set(usable.map(i => Math.floor(i / GRID_COLS)))];
      const r = d._rng.pick(rows);
      return all.filter(i => Math.floor(i / GRID_COLS) === r);
    }
    case 'column': {
      const cols = [...new Set(usable.map(i => i % GRID_COLS))];
      const c = d._rng.pick(cols);
      return all.filter(i => i % GRID_COLS === c);
    }
    case 'block': {
      const cols = Math.max(1, Math.min(GRID_COLS, area.cols));
      const rows = Math.max(1, Math.min(rowsOf(d), area.rows));
      const anchors: number[] = [];
      for (let r = 0; r + rows <= rowsOf(d); r++) {
        for (let c = 0; c + cols <= GRID_COLS; c++) anchors.push(r * GRID_COLS + c);
      }
      const cells = (a: number) => {
        const out: number[] = [];
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push(a + r * GRID_COLS + c);
        return out.filter(i => i < n);
      };
      const hitting = anchors.filter(a => cells(a).some(i => touchable(d, i)));
      return hitting.length ? cells(d._rng.pick(hitting)) : [];
    }
  }
};

export type DestroyKind = 'explosion' | 'laser' | 'ricochet';

/** Damage a destroyed card pays (spec §1), matching GameBoard's collateral. */
export const COLLATERAL_DAMAGE = { explosion: 1, laser: 2, ricochet: 1, connected: 1 } as const;

/** The stat that adds to a kind's collateral (weapon levels and tuning: Blast Powder, Prismatic Ray, Chaos Shard). */
const COLLATERAL_BONUS = { explosion: 'explosionDamage', laser: 'laserDamage', ricochet: 'ricochetDamage' } as const satisfies Record<DestroyKind, keyof PlayerStats>;

const DESTROY_EVENT: Record<DestroyKind, RunEventType> = { explosion: 'blast', laser: 'laser', ricochet: 'ricochet' };

/**
 * Destroy the cards at `indices`: armored cards lose a hit instead, the
 * Catalyst and cards on their way out are skipped, linked partners go too.
 * Every destroyed card pays its collateral damage and 1 coin.
 */
export const destroyCards = (d: Draft, indices: number[], kind: DestroyKind): number => {
  const targets = [...new Set(indices)].filter(i => touchable(d, i));
  const armored = targets.filter(i => (d.board[i].health ?? 1) > 1);
  updateCards(d, armored, c => ({ ...c, health: (c.health ?? 1) - 1 }));
  const destroyed = targets.filter(i => (d.board[i].health ?? 1) <= 1 && !armored.includes(i));
  const visited = new Set(destroyed);
  const linked: number[] = [];
  if (d.connections.length) {
    for (const i of destroyed) {
      for (const p of getLinkedDestructionPositions(d.connections, i, new Set(visited))) {
        if (visited.has(p) || !touchable(d, p) || (d.board[p].health ?? 1) > 1) continue;
        visited.add(p);
        linked.push(p);
      }
    }
  }
  if (destroyed.length + armored.length === 0) return 0;
  d.roundStats.weaponEffectsTriggered.add(kind);
  if (kind === 'explosion') d.explosionsTriggered += 1;
  const raw = destroyed.length * (COLLATERAL_DAMAGE[kind] + (d.stats[COLLATERAL_BONUS[kind]] ?? 0)) + linked.length * COLLATERAL_DAMAGE.connected;
  const dmg = dealDamage(d, raw * foeMultiplier(d));
  addCoins(d, destroyed.length + linked.length);
  emit(d, DESTROY_EVENT[kind], dmg, String(destroyed.length + linked.length));
  linked.forEach(() => enqueue(d, 'linkDestroyed'));
  const gone = [...destroyed, ...linked];
  if (gone.length) recycle(d, gone);
  return gone.length;
};

/** Set random cards on fire. GameBoard burns them and sends BURN. */
export const igniteCards = (d: Draft, count: number): number => {
  const candidates = d.board
    .map((c, i) => (touchable(d, i) && isSelectable(c) && !c.onFire ? i : -1))
    .filter(i => i >= 0);
  const chosen = d._rng.shuffle(candidates).slice(0, count);
  if (chosen.length === 0) return 0;
  d.roundStats.weaponEffectsTriggered.add('fire');
  // Only a change key for the burn timer, so elapsed time is enough (and must be non-zero)
  const stamp = d.elapsedMs + 1;
  updateCards(d, chosen, c => ({ ...c, onFire: true, fireStartTime: stamp }));
  emit(d, 'fire', chosen.length);
  return chosen.length;
};

export const growBoard = (d: Draft, count: number): number => {
  const extra = Math.min(count, MAX_BOARD - d.board.length);
  if (extra <= 0) return 0;
  const added: Card[] = [];
  for (let i = 0; i < extra; i++) added.push(drawCard(d));
  d.board = [...d.board, ...added];
  return extra;
};

export const empowerBoard = (d: Draft, amount: number) => {
  if (amount <= 0 || d.board.length === 0) return;
  // Charge, not power: a charged card hits harder but isn't a power card (so power-card effects can't feed on it)
  d.board = d.board.map(c => ({ ...c, charge: (c.charge ?? 0) + amount }));
  emit(d, 'empowered', amount);
};

export const armorCard = (d: Draft, extraHealth: number, bounty: number) => {
  const candidates = d.board
    .map((c, i) => (touchable(d, i) && isSelectable(c) && !c.snare && !c.hasCountdown && !c.hasBomb ? i : -1))
    .filter(i => i >= 0);
  if (candidates.length === 0 || extraHealth <= 0) return;
  const i = d._rng.pick(candidates);
  updateCards(d, [i], c => ({ ...c, health: (c.health ?? 1) + extraHealth, bounty: (c.bounty ?? 0) + bounty }));
  emit(d, 'pinata', bounty);
};

/** Re-deal every card that isn't armored or on its way out; the foe's draw effects don't apply. */
export const redeal = (d: Draft) => {
  const idx = d.board.map((c, i) => (d.replacing.includes(c.id) || (c.health ?? 1) > 1 ? -1 : i)).filter(i => i >= 0);
  if (idx.length === 0) return;
  const hadCatalyst = idx.some(i => d.board[i].hasEvolutionItem);
  idx.forEach(i => d.deck.push(toDeckCard(d.board[i])));
  d.deck = d._rng.shuffle(d.deck);
  refill(d, idx, { skipFoeDrawEffects: true, quiet: true });
  if (hadCatalyst) placeCatalyst(d, idx);
  emit(d, 'redeal');
};

/** One active attribute becomes the same on every card (and on new cards) for a while. */
export const simplify = (d: Draft, ms: number) => {
  if (ms <= 0) return;
  if (d.simplified) {
    d.simplified = { ...d.simplified, remainingMs: Math.max(d.simplified.remainingMs, ms) };
    return;
  }
  const attribute = d._rng.pick(d.attributes);
  const value = d._rng.pick(ATTRIBUTE_VALUES[attribute] as readonly (string | number)[]);
  d.simplified = { attribute, value, remainingMs: ms };
  d.board = d.board.map(c => withAttribute(c, attribute, value));
  emit(d, 'simplified', ms, attribute);
};

let connSeq = 0;
const makeConnection = (posA: number, posB: number, createdAt: number): BoardConnection => ({
  id: `adv-conn-${++connSeq}`,
  positionA: Math.min(posA, posB),
  positionB: Math.max(posA, posB),
  createdAt,
});

export const addConnection = (d: Draft, posA: number, posB: number) => {
  d.connections = [...d.connections, makeConnection(posA, posB, d.elapsedMs)];
};

export const addRandomConnections = (d: Draft, count: number): number => {
  if (count <= 0 || d.board.length < 2) return 0;
  let added = 0;
  for (let attempts = 0; added < count && attempts < count * 10; attempts++) {
    const posA = Math.floor(d._rng.next() * d.board.length);
    const posB = Math.floor(d._rng.next() * d.board.length);
    if (posA === posB || arePositionsConnected(d.connections, posA, posB)) continue;
    addConnection(d, posA, posB);
    added += 1;
  }
  return added;
};

export const pruneConnections = (d: Draft) => {
  const n = d.board.length;
  if (d.connections.some(c => c.positionA >= n || c.positionB >= n)) {
    d.connections = d.connections.filter(c => c.positionA < n && c.positionB < n);
  }
};

// ─── Evolution Catalyst placement ───────────────────────────────────────────

const catalystEligible = (d: Draft, c: Card | undefined): boolean =>
  !!c && isSelectable(c) && (c.health ?? 1) === 1 && !c.hasBomb && !c.hasCountdown && !c.snare && !c.hasEvolutionItem && !isReplacing(d, c);

export const catalystOnBoard = (d: Draft) => d.board.some(c => c.hasEvolutionItem);

export const canSpawnCatalyst = (d: Draft) =>
  d.features.has('evolutions') && d.armedRecipes.length > 0 && !catalystOnBoard(d) && d.evolutionsTriggered < d.evolutionCap;

/** Put the (single) Catalyst on one of `candidates`, or anywhere eligible if none of them fits. */
export const placeCatalyst = (d: Draft, candidates: number[]): boolean => {
  if (catalystOnBoard(d)) return false;
  let eligible = candidates.filter(i => catalystEligible(d, d.board[i]));
  if (eligible.length === 0) eligible = d.board.map((_, i) => i).filter(i => catalystEligible(d, d.board[i]));
  if (eligible.length === 0) return false;
  const target = d._rng.pick(eligible);
  updateCards(d, [target], c => ({ ...c, hasEvolutionItem: true, evolutionReady: true }));
  emit(d, 'catalyst_spawn');
  return true;
};

export const rollCatalyst = (d: Draft, indices: number[], rainbow: boolean) => {
  if (!canSpawnCatalyst(d)) return;
  const chance = d.evolutionLikelihood + (rainbow ? mods(d).rainbowEvolutionLikelihood ?? 0 : 0);
  if (d._rng.next() * 100 < chance) placeCatalyst(d, indices);
};

/** If a foe turned the Catalyst card into something unmatchable, move the Catalyst. */
export const keepCatalystMatchable = (d: Draft) => {
  const idx = d.board.findIndex(c => c.hasEvolutionItem);
  if (idx === -1) return;
  const c = d.board[idx];
  if (isSelectable(c) && (c.health ?? 1) === 1 && !c.hasBomb && !c.hasCountdown) return;
  updateCards(d, [idx], x => ({ ...x, hasEvolutionItem: false, evolutionReady: false }));
  placeCatalyst(d, []);
};

// ─── Trap placement ─────────────────────────────────────────────────────────

export type SnareDir = NonNullable<Card['snare']>;

/** The board index a snare at `index` points at, if that neighbour exists. */
export const snareTarget = (index: number, dir: SnareDir, length: number): number | null => {
  const col = index % GRID_COLS;
  const t =
    dir === 'up' ? index - GRID_COLS : dir === 'down' ? index + GRID_COLS : dir === 'left' ? (col > 0 ? index - 1 : -1) : col < GRID_COLS - 1 ? index + 1 : -1;
  return t >= 0 && t < length ? t : null;
};

const SNARE_DIRS: SnareDir[] = ['up', 'down', 'left', 'right'];

/** Directions from `index` that point at an existing card, selectable neighbours first. */
export const snareDirections = (d: Draft, index: number): SnareDir[] => {
  const valid = SNARE_DIRS.filter(dir => snareTarget(index, dir, d.board.length) !== null);
  const good = valid.filter(dir => isSelectable(d.board[snareTarget(index, dir, d.board.length)!]));
  return good.length ? good : valid;
};

const trapEligible = (d: Draft, i: number) => {
  const c = d.board[i];
  return (
    !!c && isSelectable(c) && (c.health ?? 1) === 1 && !c.hasEvolutionItem && !c.hasBomb && !c.hasCountdown && !c.snare && !isReplacing(d, c)
  );
};

export const timeBombsOnBoard = (d: Draft) => d.board.filter(c => c.hasCountdown && d.timeBombIds.includes(c.id)).length;
export const snaresOnBoard = (d: Draft) => d.board.filter(c => c.snare).length;

const pickTrapSlot = (d: Draft, candidates: number[]): number | null => {
  let eligible = candidates.filter(i => trapEligible(d, i));
  if (eligible.length === 0) eligible = d.board.map((_, i) => i).filter(i => trapEligible(d, i));
  return eligible.length ? d._rng.pick(eligible) : null;
};

export const placeTimeBomb = (d: Draft, candidates: number[]): boolean => {
  const bombs = d.level.rules.hazards?.timeBombs;
  if (!bombs || timeBombsOnBoard(d) >= MAX_TRAPS_PER_KIND) return false;
  const i = pickTrapSlot(d, candidates);
  if (i === null) return false;
  updateCards(d, [i], c => ({ ...c, hasCountdown: true, countdownTimer: bombs.seconds }));
  d.timeBombIds = [...d.timeBombIds, d.board[i].id];
  emit(d, 'trap_placed', bombs.seconds, 'bomb');
  return true;
};

export const placeSnare = (d: Draft, candidates: number[]): boolean => {
  if (!d.level.rules.hazards?.snares || snaresOnBoard(d) >= MAX_TRAPS_PER_KIND) return false;
  const usable = candidates.filter(i => snareDirections(d, i).length > 0);
  const all = d.board.map((_, i) => i).filter(i => snareDirections(d, i).length > 0);
  const i = pickTrapSlot(d, usable.length ? usable : all);
  if (i === null) return false;
  const dirs = snareDirections(d, i);
  if (dirs.length === 0) return false;
  const dir = d._rng.pick(dirs);
  updateCards(d, [i], c => ({ ...c, snare: dir }));
  emit(d, 'trap_placed', undefined, 'snare');
  return true;
};

/** `every` refilled cards bring a new trap of that kind (at most 2 of each on the board). */
const countHazardRefills = (d: Draft, indices: number[]) => {
  const hz = d.level.rules.hazards;
  if (!hz) return;
  if (hz.timeBombs) {
    d.hazardRefills.timeBombs += indices.length;
    if (d.hazardRefills.timeBombs >= hz.timeBombs.every) {
      d.hazardRefills.timeBombs = placeTimeBomb(d, indices) ? d.hazardRefills.timeBombs - hz.timeBombs.every : hz.timeBombs.every;
    }
  }
  if (hz.snares) {
    d.hazardRefills.snares += indices.length;
    if (d.hazardRefills.snares >= hz.snares.every) {
      d.hazardRefills.snares = placeSnare(d, indices) ? d.hazardRefills.snares - hz.snares.every : hz.snares.every;
    }
  }
};

/** Keep trap bookkeeping honest after the board moved: forget gone bombs, re-aim or clear stray snares. */
export const syncTraps = (d: Draft) => {
  if (d.timeBombIds.length) {
    const live = new Set(d.board.filter(c => c.hasCountdown).map(c => c.id));
    const kept = d.timeBombIds.filter(id => live.has(id));
    if (kept.length !== d.timeBombIds.length) d.timeBombIds = kept;
  }
  const fix: number[] = [];
  d.board.forEach((c, i) => {
    if (c.snare && snareTarget(i, c.snare, d.board.length) === null) fix.push(i);
  });
  if (fix.length) {
    updateCards(d, fix, c => {
      const i = d.board.indexOf(c);
      const dirs = snareDirections(d, i);
      return dirs.length ? { ...c, snare: dirs[0] } : { ...c, snare: undefined };
    });
  }
};
