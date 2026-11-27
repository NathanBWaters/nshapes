/**
 * The mutable working copy of a run inside one reducer step, and the
 * primitives everything else builds on: cards, damage, hearts, coins, area
 * destruction, Synergy Graph updates, marked/Holo cards, and trap placement.
 *
 * Primitives never run rules themselves. They queue fight events, and
 * rules/engine.ts resolves the queue (`drain`), so any source can chain into
 * any other without the primitives knowing about rules.
 */
import type { AttributeName, BoardConnection, BridgeTriggerType, Card, PlayerStats, Weapon } from '@/types';
import { ATTRIBUTE_VALUES } from '@/utils/gameUtils';
import { getLinkedDestructionPositions, arePositionsConnected } from '@/utils/connectionUtils';
import { applyEnemyStatModifiers } from '@/utils/enemyFactory';
import { WEAPON_COUNTERS } from '@/utils/enemyEffects';
import type {
  ArcanaRules,
  EventPlace,
  FightLogLine,
  FightLogSetMath,
  ParryRequirement,
  PassiveId,
  RunEvent,
  RunEventType,
  RunState,
  SynergyAttrId,
} from '../types';
import type { Area, Modifiers, TrickKind, WeaponTriggerKind } from '../rules/types';
import { arcanaRules } from '../data/arcana';
import { BASE_RULES, DECK_RULES, TRICK_RULES } from '../data/rules';
import { PASSIVE_TUNING } from '../data/passives';
import { createRng, type Rng } from './rng';
import { allSets, countDifferentAttributes, hasAnySet, isRainbow, isSelectable } from './sets';
import { buildDeck, deckCopies, variedDeal } from './dealer';
import { growthModifiers } from '../data/weaponGrowth';
import { liveRules, modifiersOf, type KeyedRule } from './sources';

export const MAX_BOARD = 21;
/** Most that luck can add to a chance, and the most the clock can be slowed (weapon growth) */
export const LUCK_CAP_PCT = 60;
export const CLOCK_SLOW_CAP_PCT = 50;
export const GRID_COLS = 3;
export const MAX_TRAPS_PER_KIND = 2;
export const FOG_MS = TRICK_RULES.fogMs;
export const SNARE_DEFUSE_DAMAGE = 8;
/** Rule and evolution time gains can lift the clock this far above its start */
export const TIME_HEADROOM = 15;

// ─── Fight events ───────────────────────────────────────────────────────────

export type FightEventKind =
  | 'set' | 'rainbow' | 'mistake' | 'healed' | 'hurt' | 'weapon'
  | 'fightStart' | 'waveStart' | 'evolutionStart' | 'evolutionEnd' | 'trapDefused'
  | 'bonusCardMatched' | 'holoMatched' | 'markedMatched' | 'parry'
  | 'weaponEvolutionStart' | 'weaponEvolutionEnd'
  | 'cardBroken' | 'hintUsed' | 'graceUsed' | 'cardBurned' | 'linkDestroyed' | 'trick'
  | 'grudgeRelease';

export interface FightEvent {
  on: FightEventKind;
  kind?: WeaponTriggerKind;
  trick?: TrickKind;
  perfect?: boolean;
  weaponId?: string;
}

/** Non-Set evolution tracker notifications dispatched from primitives/rules without circular imports. */
export type EvoHookEvent =
  | { on: 'weapon'; kind: WeaponTriggerKind }
  | { on: 'own'; weaponId: string }
  | { on: 'trick'; kind: TrickKind }
  | { on: 'synergy'; attr: SynergyAttrId }
  | { on: 'hazard'; hazardKind: 'bomb' | 'snare' | 'dud' | 'face_down' | 'thorn' | 'fuse' | 'curse' }
  | {
      on: 'resource';
      action:
        | 'hint_used'
        | 'grace_save'
        | 'healed'
        | 'overhealed'
        | 'hurt'
        | 'mistake_forgiven'
        | 'ally_evolution_started'
        | 'double_triggered';
      sourceWeaponId?: string;
    }
  | { on: 'mistake' };

/** The Set being scored, for set triggers and set conditions. */
export interface SetContext {
  diffCount: number;
  rainbow: boolean;
  /** Time since the previous Set (or the fight start) */
  sinceLastMs: number;
  firstOfWave: boolean;
  /** This Set's number in the fight (1 = first) */
  matchNo: number;
  /** Whether the Set used a pointed-out card (hint, auto-hint or Keen Eye) */
  hinted?: boolean;
  /** Number of Holo cards matched in this Set */
  holoInSet?: number;
  /** Badger Grudge stacks released by this Set (for `grudgeRelease` skill nodes) */
  grudgeReleased?: number;
}

export interface FightHooks {
  /** Score a random Set on the board for the player and replace its cards */
  autoSet(d: Draft, source?: 'scoop'): void;
}

/**
 * Active primary-Set damage fold during a synchronous `MATCH` turn.
 * Synchronous Set-triggered flat damage rules fold their pre-multiplier base damage
 * straight into `BASE` (`_logSet.flatItems`) so `SUM(additions) × PRODUCT(multipliers) = TOTAL`
 * holds exactly in both combat math and HUD.
 */
export interface SetDamageFold {
  /** Exact `SetContext` object of the primary player Set (isolates nested `autoSet`s) */
  setCtx: SetContext;
  /** Current pre-multiplier flat base total (cards + collateral + flatItems) */
  baseFlat: number;
  /** Full Set multiplier (including enemy multiplier) */
  totalMult: number;
  /** Total unified damage applied to foeHp / totalDamage so far for this Set */
  dealtSoFar: number;
  /** Foe HP right before the primary Set hit (for exact overkill calculation) */
  hpBeforeSet: number;
  /** Overkill already credited on this Set strike */
  overkillCredited: number;
  /** True while inside a nested `autoSet` so Free Sets remain separate follow-up hits */
  inAutoSet: boolean;
  /** Event sequence ID of the primary Set hit/rainbow/surge_hit event */
  primaryEventId: number;
  /** Index in `d._lines` of the primary Set hit/rainbow/surge_hit line */
  primaryLineIdx: number;
}

export interface FoldedRuleItem {
  label: string;
  note?: string;
  sourceRef?: string;
}

export interface Draft extends RunState {
  _rng: Rng;
  _foeRng: Rng;
  _weaponRng: Rng;
  _queue: { ev: FightEvent; chain: readonly string[]; setCtx: SetContext | null }[];
  /** Keys of the rules whose effects are running right now (events queued now inherit them) */
  _chain: readonly string[];
  _firings: number;
  /** Number of overheal-triggered `healed` events already queued in this action */
  _overheals: number;
  _mods: Modifiers | null;
  _rules: KeyedRule[] | null;
  _arcana: ArcanaRules | null;
  _setCtx: SetContext | null;
  /** Non-foe multiplier of the triggering Set during its synchronous drain() (1 outside a Set) */
  _setMultiplier: number;
  /** Primary Set fold accumulator during a synchronous MATCH drain() (null outside a Set) */
  _setFold: SetDamageFold | null;
  /** Cards destroyed during the current synchronous player Set turn (feeds `cards_destroyed_single_set`) */
  _turnCardsDestroyed: number;
  /** Tricks that paid out during the current synchronous player Set turn */
  _turnTricksPaid: Set<TrickKind>;
  _hooks: FightHooks;
  /** This action is the fight clock ticking: what it emits is marked `clock` (see RunEvent) */
  _clock: boolean;
  /** Events emitted during this action, with the rule that caused them (engine/fightLog.ts) */
  _lines: FightLogLine[];
  /** How the player's Set in this action was scored */
  _logSet: FightLogSetMath | null;
  /** Lazy copy-on-write flags so empty TICKs never clone telemetry maps */
  _ruleFiringsCloned?: boolean;
  _ruleZeroOpsCloned?: boolean;
}

export const recordRuleFiring = (d: Draft, key: string) => {
  if (!d.ruleFirings) return;
  if (!d._ruleFiringsCloned) {
    d.ruleFirings = { ...d.ruleFirings };
    d._ruleFiringsCloned = true;
  }
  d.ruleFirings[key] = (d.ruleFirings[key] ?? 0) + 1;
};

export const recordRuleZeroOp = (d: Draft, key: string) => {
  if (!d.ruleZeroOps) return;
  if (!d._ruleZeroOpsCloned) {
    d.ruleZeroOps = { ...d.ruleZeroOps };
    d._ruleZeroOpsCloned = true;
  }
  d.ruleZeroOps[key] = (d.ruleZeroOps[key] ?? 0) + 1;
};

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
  synergy: { ...s.synergy },
  synergyPeak: { ...s.synergyPeak },
  weaponEvolutions: s.weaponEvolutions.map(e => ({
    ...e,
    ...(e.windowTimes ? { windowTimes: [...e.windowTimes] } : {}),
    ...(e.seenCycleValues ? { seenCycleValues: [...e.seenCycleValues] } : {}),
  })),
  fightMetrics: {
    ...s.fightMetrics,
    synergy: { ...s.fightMetrics.synergy },
    synergyPeak: { ...s.fightMetrics.synergyPeak },
    colorSets: { ...s.fightMetrics.colorSets },
    weaponEvos: { ...s.fightMetrics.weaponEvos },
    trickPayouts: { ...s.fightMetrics.trickPayouts },
    ownTriggers: { ...s.fightMetrics.ownTriggers },
  },
  hazardRefills: { ...s.hazardRefills },
  colorSets: { ...s.colorSets },
  parry: s.parry ? { ...s.parry } : null,
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
  _foeRng: createRng(s.foeRng ?? s.rng),
  _weaponRng: createRng(s.weaponRng ?? ((s.rng ^ 0x5bd1e995) >>> 0)),
  _queue: [],
  _chain: [],
  _firings: 0,
  _overheals: 0,
  _mods: null,
  _rules: null,
  _arcana: null,
  _setCtx: null,
  _setMultiplier: 1,
  _setFold: null,
  _turnCardsDestroyed: 0,
  _turnTricksPaid: new Set(),
  _hooks: hooks,
  _clock: false,
  _lines: [],
  _logSet: null,
});

export const finish = (d: Draft, prev?: RunState): RunState => {
  const {
    _rng, _foeRng, _weaponRng, _queue, _chain, _firings, _overheals, _mods, _rules, _arcana,
    _setCtx, _setMultiplier, _setFold, _turnCardsDestroyed, _turnTricksPaid, _hooks, _clock,
    _lines, _logSet, _ruleFiringsCloned, _ruleZeroOpsCloned, ...rest
  } = d;
  const connections =
    prev &&
    d.connections.length === prev.connections.length &&
    d.connections.every((c, i) => c === prev.connections[i])
      ? prev.connections
      : d.connections;
  const events =
    prev &&
    d.events.length === prev.events.length &&
    d.events.every((e, i) => e === prev.events[i])
      ? prev.events
      : d.events;
  return { ...rest, connections, events, rng: _rng.state, foeRng: _foeRng.state, weaponRng: _weaponRng.state };
};

/**
 * Something happened. `place` says where on the board (slots, and the cards
 * that were there if it removed them), so the effects can play on those cards.
 */
export const emit = (d: Draft, type: RunEventType, amount?: number, text?: string, place?: EventPlace) => {
  d.eventSeq += 1;
  // Which rule (if any) caused it: the fight log names it, and the band plays that weapon's voice
  const source = d._chain[d._chain.length - 1];
  const e: RunEvent = source ? { id: d.eventSeq, type, amount, text, source } : { id: d.eventSeq, type, amount, text };
  if (place?.slots?.length) {
    e.slots = place.slots;
    if (place.cards) e.cards = place.cards;
  }
  if (d._clock) e.clock = true;
  d.events.push(e);
  if (d.events.length > 60) d.events.shift();
  d._lines.push(source ? { type, amount, text, source } : { type, amount, text });
};

/** Things weapon growth watches that are not queued fight events */
export type GrowthSignal = FightEvent | { on: 'own'; weaponId: string } | { on: 'doubled' } | { on: 'feat'; name: string };
/** engine/growth.ts listens to every queued event and signal (set from there, so this file does not depend on it) */
let growthHook: ((d: Draft, ev: GrowthSignal) => void) | null = null;
export const setGrowthHook = (hook: (d: Draft, ev: GrowthSignal) => void) => {
  growthHook = hook;
};
export const signalGrowth = (d: Draft, signal: GrowthSignal) => growthHook?.(d, signal);

/** engine/evolutions.ts listens for non-Set events without introducing a circular module dependency */
let evoEventHook: ((d: Draft, ev: EvoHookEvent) => void) | null = null;
export const setEvoEventHook = (hook: (d: Draft, ev: EvoHookEvent) => void) => {
  evoEventHook = hook;
};
export const notifyEvoEvent = (d: Draft, ev: EvoHookEvent) => evoEventHook?.(d, ev);

export const enqueue = (
  d: Draft,
  on: FightEventKind,
  kind?: WeaponTriggerKind,
  trick?: TrickKind,
  extra?: { perfect?: boolean; weaponId?: string }
) => {
  const ev: FightEvent = {
    on,
    ...(kind ? { kind } : {}),
    ...(trick ? { trick } : {}),
    ...(extra?.perfect !== undefined ? { perfect: extra.perfect } : {}),
    ...(extra?.weaponId ? { weaponId: extra.weaponId } : {}),
  };
  d._queue.push({ ev, chain: d._chain, setCtx: d._setCtx });
  growthHook?.(d, ev);
  // Mirror key fight events into per-weapon evolution trackers
  if (on === 'weapon' && kind) notifyEvoEvent(d, { on: 'weapon', kind });
  else if (on === 'trick' && trick) {
    d._turnTricksPaid.add(trick);
    d.fightMetrics.trickPayouts[trick] = (d.fightMetrics.trickPayouts[trick] ?? 0) + 1;
    notifyEvoEvent(d, { on: 'trick', kind: trick });
  } else if (on === 'hurt') notifyEvoEvent(d, { on: 'resource', action: 'hurt' });
  else if (on === 'hintUsed') notifyEvoEvent(d, { on: 'resource', action: 'hint_used' });
};

// ─── Synergy Graph counters ─────────────────────────────────────────────────

export const bumpSynergy = (d: Draft, attr: SynergyAttrId, delta: number) => {
  if (!delta) return;
  const next = Math.max(0, (d.synergy[attr] ?? 0) + delta);
  if (next === d.synergy[attr]) return;
  d.synergy[attr] = next;
  if (next > (d.synergyPeak[attr] ?? 0)) d.synergyPeak[attr] = next;
  d.fightMetrics.synergy[attr] = next;
  if (next > (d.fightMetrics.synergyPeak[attr] ?? 0)) d.fightMetrics.synergyPeak[attr] = next;
  d._mods = null;
  if (delta > 0) notifyEvoEvent(d, { on: 'synergy', attr });
};

export const setSynergy = (d: Draft, attr: SynergyAttrId, value: number) => {
  const next = Math.max(0, Math.round(value));
  const prev = d.synergy[attr] ?? 0;
  if (next === prev) return;
  d.synergy[attr] = next;
  if (next > (d.synergyPeak[attr] ?? 0)) d.synergyPeak[attr] = next;
  d.fightMetrics.synergy[attr] = next;
  if (next > (d.fightMetrics.synergyPeak[attr] ?? 0)) d.fightMetrics.synergyPeak[attr] = next;
  d._mods = null;
  if (next > prev) notifyEvoEvent(d, { on: 'synergy', attr });
};

/** Synchronize live gauge synergy nodes (field_size, streaks) with current Draft state. */
export const syncLiveSynergy = (d: Draft) => {
  if (d.board.length < MAX_BOARD) {
    setSynergy(d, 'field_size', Math.max(0, d.board.length - 12));
  } else {
    setSynergy(d, 'field_size', Math.max(d.synergy.field_size, MAX_BOARD - 12));
  }
  if (d.board.length > d.fightMetrics.maxBoardSize) {
    d.fightMetrics.maxBoardSize = d.board.length;
  }
  setSynergy(d, 'streaks', d.cleanStreak + Math.max(0, d.combo - 1));
};

// ─── Sources, modifiers & tuning ────────────────────────────────────────────

export const synergyCtxOf = (d: RunState) => ({
  hearts: d.hearts,
  maxHearts: d.maxHearts,
  timeLeft: d.timeLeft,
  movesLeft: d.movesLeft,
  liveLinks: d.connections.length,
});

const sourceInputs = (d: RunState) => ({
  skillNodes: d.skillNodes,
  weapons: d.weapons,
  weaponEvolutions: d.weaponEvolutions,
  weaponBuilds: d.weaponBuilds,
  synergy: d.synergy,
  synergyCtx: synergyCtxOf(d),
  growth: growthModifiers(d.growth ?? {}),
  blankEvolutionRules: d.blankEvolutionRules,
});

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

export interface ActiveWeaponCounter {
  type: keyof typeof WEAPON_COUNTERS;
  label: string;
  stat: keyof PlayerStats;
  baseChance: number;
  effectiveChance: number;
  reduction: number;
}

/** Enemy weapon counters currently dampening stats in this wave (for HUD / inspect UI). */
export const activeEnemyCounters = (
  s: Pick<RunState, 'foe' | 'stats' | 'baseChances'>
): ActiveWeaponCounter[] => {
  const statMods = s.foe?.getStatModifiers?.();
  if (!statMods) return [];
  const out: ActiveWeaponCounter[] = [];
  for (const [type, info] of Object.entries(WEAPON_COUNTERS) as [
    keyof typeof WEAPON_COUNTERS,
    (typeof WEAPON_COUNTERS)[keyof typeof WEAPON_COUNTERS],
  ][]) {
    const reduction = statMods[info.modifier];
    if (!reduction) continue;
    out.push({
      type,
      label: info.label,
      stat: info.stat,
      baseChance: s.baseChances[info.stat] ?? 0,
      effectiveChance: (s.stats[info.stat] as number | undefined) ?? 0,
      reduction,
    });
  }
  return out;
};

/** Re-apply live enemy weapon counters (e.g. Kraken's Tentacle Lock) without rebuilding rules/modifiers. */
export const syncEnemyCounters = (d: Draft) => {
  const m = mods(d);
  const scale = m.weaponChanceScale ?? {};
  // Luck (Second Chance's growth & Synergy hooks) lifts every weapon chance
  const luck = 1 + Math.min(LUCK_CAP_PCT, m.luckPct ?? 0) / 100;
  const uncountered: PlayerStats = { ...d.stats };
  for (const [kind, key] of Object.entries(CHANCE_STATS) as [WeaponTriggerKind, keyof PlayerStats][]) {
    const base = d.baseChances[key] ?? 0;
    (uncountered as unknown as Record<string, number>)[key] = Math.round(base * (scale[kind] ?? 1) * luck);
  }
  // Wire enemy weapon counters (Wet Crab, Kraken's Grasp, Goblin Saboteur, Polar Guardian, etc.)
  const effective = applyEnemyStatModifiers(uncountered, d.foe);
  let stats = d.stats;
  for (const key of Object.values(CHANCE_STATS)) {
    const want = effective[key] as number;
    if (stats[key] !== want) {
      if (stats === d.stats) stats = { ...stats };
      (stats as unknown as Record<string, number>)[key] = want;
    }
  }
  d.stats = stats;
};

/** Re-derive everything that depends on the live sources (call after weapons, evolutions, or wave foe change). */
export const refreshSources = (d: Draft) => {
  d._mods = null;
  d._rules = null;
  syncEnemyCounters(d);
};

/** Bonus damage carried by newly spawned Power cards (Glass Prism overrides +5 -> +10). */
export const powerCardBonusFor = (d: Draft): number =>
  arcana(d).powerCardBonusOverride ?? BASE_RULES.powerCardBonus;

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
  if (roll(m.wildChance) && d.board.filter(c => c.isWild).length < 1 + Math.round(m.wildMax ?? 0)) return { ...card, isWild: true };
  if (roll(m.twinChance)) {
    const originals = d.board.filter(c => isSelectable(c) && !c.isWild && !c.twinOf && !d.replacing.includes(c.id));
    if (originals.length) {
      const t = d._rng.pick(originals);
      card = { ...card, shape: t.shape, color: t.color, number: t.number, shading: t.shading, background: t.background, twinOf: t.id };
    }
  }
  if (roll(m.decoyChance) && !card.twinOf) {
    // Decoy: a board card with one trait changed. Unmarked on purpose: spotting it is the game.
    const originals = d.board.filter(c => isSelectable(c) && !c.isWild && !d.replacing.includes(c.id));
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

/**
 * Cards that leave the board go back into the deck at a random place in its
 * lower part, and never among the cards about to take their places.
 */
export const returnToDeck = (d: Draft, cards: readonly Card[]) => {
  for (const c of cards) {
    const from = Math.min(d.deck.length, Math.max(cards.length, Math.ceil(d.deck.length * DECK_RULES.returnDepth)));
    d.deck.splice(from + Math.floor(d._rng.next() * (d.deck.length - from + 1)), 0, toDeckCard(c));
  }
};

/** Take cards out of the deck by position (the top is 0); a deck that runs short is topped up first. */
const takeFromDeck = (d: Draft, positions: readonly number[] = [0]): Card[] => {
  const uniquePositions = [...new Set(positions)];
  const needed = Math.max(positions.length, uniquePositions.length, ...uniquePositions.map(p => p + 1));
  if (d.deck.length < needed) {
    const inPlay = new Set([...d.board.map(c => c.id), ...d.deck.map(c => c.id)]);
    const fresh = d._rng
      .shuffle(buildDeck(d.level))
      .map(toDeckCard)
      .filter(c => !inPlay.has(c.id));
    d.deck = [...d.deck, ...fresh];
    if (d.deck.length < needed) {
      const extra = d._rng.shuffle(buildDeck(d.level)).map((c, idx) => toDeckCard({ ...c, id: `${c.id}-x${d.eventSeq}-${idx}` }));
      d.deck = [...d.deck, ...extra];
    }
  }
  const pickedIndices: number[] = [];
  const pickedSet = new Set<number>();
  for (const p of positions) {
    let idx = p;
    if (idx < 0 || idx >= d.deck.length || pickedSet.has(idx)) {
      idx = d.deck.findIndex((_, i) => !pickedSet.has(i));
    }
    if (idx >= 0) {
      pickedIndices.push(idx);
      pickedSet.add(idx);
    }
  }
  const taken = pickedIndices.map(i => d.deck[i]);
  d.deck = d.deck.filter((_, i) => !pickedSet.has(i));
  return taken;
};

/** Draw one card from the deck top (recycling is handled by the caller). */
export const drawCard = (d: Draft, opts?: DrawOptions): Card => dress(d, takeFromDeck(d)[0], opts);

/** A deck card as it lands on the board: what the level, the fight and the foe do to it on the way. */
const dress = (d: Draft, base: Card, opts?: DrawOptions): Card => {
  let card = freshCard(base);
  if (d.surge) card.shading = d.surge.active ? d._rng.pick(ATTRIBUTE_VALUES.shading) : ATTRIBUTE_VALUES.shading[0];
  if (d.simplified) {
    card = withAttribute(card, d.simplified.attribute, d.simplified.value);
    if (d.simplified.also) card = withAttribute(card, d.simplified.also.attribute, d.simplified.also.value);
  }
  const specialMult = arcana(d).specialCardChanceScale ?? 1;
  if (d.features.has('coins') && d._rng.next() < BASE_RULES.coinCardChance * specialMult) card.bonusMoney = BASE_RULES.coinCardValue;
  if (d.features.has('power') && d._rng.next() < BASE_RULES.powerCardChance * specialMult) card.bonusPoints = powerCardBonusFor(d);
  const holoChance =
    (BASE_RULES.holoCardChance ?? 0.04) * (arcana(d).holoCardChanceScale ?? 1) +
    (mods(d).holoChance ?? 0) / 100;
  if (d.features.has('power') && holoChance > 0 && d._rng.next() < holoChance) {
    card.holo = true;
  }
  card = dealTricks(d, card);
  if (opts?.skipFoeDrawEffects) return card;
  return d.foe.onCardDraw(card, d._foeRng.next);
};

/** Say what the foe did to a card that was just dealt into `slot` (call once the card is really on the board). */
export const announceDraw = (d: Draft, card: Card, slot: number) => {
  const at = { slots: [slot] };
  if (card.isDud) emit(d, 'dud', undefined, undefined, at);
  if (card.isFaceDown && card.fogFlipAt === undefined) emit(d, 'face_down', undefined, undefined, at);
  if (card.hasBomb) emit(d, 'bomb', undefined, undefined, at);
  if (card.hasCountdown) emit(d, 'countdown', undefined, undefined, at);
};

export interface RefillOptions extends DrawOptions {
  /** Don't count toward traps (re-deals) */
  quiet?: boolean;
}

const attrValue = (c: Card, attr: AttributeName): string | number =>
  attr === 'background' ? c.background ?? 'white' : c[attr];

const completingValue = (a: Card, b: Card, attr: AttributeName): string | number => {
  const va = attrValue(a, attr);
  const vb = attrValue(b, attr);
  if (va === vb) return va;
  return (ATTRIBUTE_VALUES[attr] as readonly (string | number)[]).find(v => v !== va && v !== vb)!;
};

const cardsMatchCounter = (
  cards: readonly Card[],
  attrs: readonly AttributeName[],
  req: ParryRequirement
): boolean => {
  if (cards.length < 3) return false;
  const set = cards.slice(0, 3);
  switch (req.kind) {
    case 'any':
      return true;
    case 'color':
      return set.every(c => c.isWild || c.color === req.color);
    case 'shape':
      return set.every(c => c.isWild || c.shape === req.shape);
    case 'all_different':
      return isRainbow(set, attrs as AttributeName[]);
    case 'exact_same': {
      const diff = countDifferentAttributes(set, attrs as AttributeName[]);
      return attrs.length - diff === req.count;
    }
    case 'exact_diff': {
      const diff = countDifferentAttributes(set, attrs as AttributeName[]);
      return diff === req.count;
    }
    case 'same_number': {
      const concrete = set.filter(c => !c.isWild);
      return concrete.length <= 1 || concrete.every(c => c.number === concrete[0].number);
    }
    case 'diff_number': {
      const concrete = set.filter(c => !c.isWild);
      return new Set(concrete.map(c => c.number)).size === concrete.length;
    }
  }
};

const candidateHasCounterSet = (
  board: Card[],
  attrs: AttributeName[],
  req: ParryRequirement
): boolean => {
  const sets = allSets(board, attrs);
  if (req.kind === 'any') return sets.length > 0;
  return sets.some(s => cardsMatchCounter(s, attrs, req));
};

export const clearCardLocks = (card: Card): Card => ({
  ...card,
  isDud: false,
  isFaceDown: false,
  locked: false,
  fogFlipAt: undefined,
  fogBonus: undefined,
  cursedUntil: undefined,
});

/**
 * Pull a card matching `target` on the deck's traits (or synthesize one cleanly if
 * the deck currently lacks it), ensuring it lands selectable with exact `target` traits.
 */
const placeTargetedCard = (
  d: Draft,
  candidate: Card[],
  slot: number,
  target: Partial<Record<AttributeName, string | number>>,
  opts?: DrawOptions
): Card => {
  const displaced = candidate[slot];
  if (displaced) returnToDeck(d, [displaced]);

  const deckAttrs = d.surge ? d.level.rules.attributes : d.attributes;
  const deckIdx = d.deck.findIndex(c =>
    deckAttrs.every(attr => target[attr] === undefined || attrValue(c, attr) === target[attr])
  );
  let base: Card;
  if (deckIdx >= 0) {
    base = d.deck[deckIdx];
    d.deck.splice(deckIdx, 1);
  } else {
    base = {
      id: 'synth',
      shape: (target.shape as Card['shape']) ?? 'oval',
      color: (target.color as Card['color']) ?? 'red',
      number: (target.number as Card['number']) ?? 1,
      shading: (target.shading as Card['shading']) ?? ATTRIBUTE_VALUES.shading[0],
      background: (target.background as Card['background']) ?? 'white',
      selected: false,
    };
  }

  let card = dress(d, base, { ...opts, skipFoeDrawEffects: true });
  for (const attr of d.attributes) {
    if (target[attr] !== undefined) card = withAttribute(card, attr, target[attr]!);
  }
  if (d.surge && !d.surge.active) {
    card = { ...card, shading: ATTRIBUTE_VALUES.shading[0] };
  }
  card = {
    ...clearCardLocks(card),
    twinOf: undefined,
    decoyOf: undefined,
  };
  candidate[slot] = card;
  return card;
};

/**
 * Deterministic zero-deadlock fallback: guarantees `candidate` contains at least one
 * valid Set by pulling/placing the exact completing 3rd card for a selectable pair.
 */
export const ensureBoardHasSet = (
  d: Draft,
  candidate: Card[],
  slots: readonly number[],
  opts?: DrawOptions
): boolean => {
  if (hasAnySet(candidate, d.attributes)) return true;
  const validSlots = slots.filter(i => i >= 0 && i < candidate.length);
  if (validSlots.length === 0 || candidate.length < 3) return false;

  const targetSlot = validSlots[0];
  const partnerSlots = validSlots.slice(1);
  const slotSet = new Set(validSlots);

  const stayingSelectable = candidate
    .map((c, i) => (!slotSet.has(i) && isSelectable(c) && !d.replacing.includes(c.id) ? i : -1))
    .filter(i => i >= 0);

  const extraPartners: number[] = [];
  for (const s of partnerSlots) {
    if (isSelectable(candidate[s])) {
      extraPartners.push(s);
    } else if (stayingSelectable.length + extraPartners.length < 2) {
      candidate[s] = clearCardLocks(candidate[s]);
      extraPartners.push(s);
    }
  }

  const pool = [...stayingSelectable, ...extraPartners].map(i => candidate[i]);
  if (pool.length < 2) return false;

  if (pool.some(c => c.isWild)) {
    candidate[targetSlot] = clearCardLocks(candidate[targetSlot]);
    return hasAnySet(candidate, d.attributes);
  }

  const shuffled = d._rng.shuffle(pool);
  let pairA = shuffled[0];
  let pairB = shuffled[1];
  outer: for (let i = 0; i < shuffled.length; i++) {
    for (let j = i + 1; j < shuffled.length; j++) {
      if (d.attributes.some(attr => attrValue(shuffled[i], attr) !== attrValue(shuffled[j], attr))) {
        pairA = shuffled[i];
        pairB = shuffled[j];
        break outer;
      }
    }
  }

  const target: Partial<Record<AttributeName, string | number>> = {};
  for (const attr of d.attributes) {
    target[attr] = completingValue(pairA, pairB, attr);
  }
  placeTargetedCard(d, candidate, targetSlot, target, opts);
  return hasAnySet(candidate, d.attributes);
};

interface CounterPattern {
  mode: Record<AttributeName, 'same' | 'diff'>;
  pinned: Partial<Record<AttributeName, string | number>>;
}

const planCounterPattern = (
  d: Draft,
  attrs: readonly AttributeName[],
  req: ParryRequirement
): CounterPattern | null => {
  const forced = new Map<AttributeName, string | number>();
  if (d.simplified) {
    forced.set(d.simplified.attribute, d.simplified.value);
    if (d.simplified.also) forced.set(d.simplified.also.attribute, d.simplified.also.value);
  }
  const mode = {} as Record<AttributeName, 'same' | 'diff'>;
  const pinned: Partial<Record<AttributeName, string | number>> = {};
  for (const [k, v] of forced.entries()) pinned[k] = v;

  const setDefaultOthers = (alreadySet: Set<AttributeName>, needAtLeastOneDiff: boolean) => {
    const rest = attrs.filter(a => !alreadySet.has(a));
    const freeRest = rest.filter(a => !forced.has(a));
    for (const a of rest) {
      if (forced.has(a)) mode[a] = 'same';
      else mode[a] = d._rng.next() < 0.5 ? 'diff' : 'same';
    }
    if (needAtLeastOneDiff && freeRest.length > 0 && !attrs.some(a => mode[a] === 'diff')) {
      mode[d._rng.pick(freeRest)] = 'diff';
    }
  };

  switch (req.kind) {
    case 'any':
      setDefaultOthers(new Set(), true);
      return { mode, pinned };
    case 'color': {
      if (forced.has('color') && forced.get('color') !== req.color) return null;
      mode.color = 'same';
      pinned.color = req.color;
      setDefaultOthers(new Set(['color']), true);
      return { mode, pinned };
    }
    case 'shape': {
      if (forced.has('shape') && forced.get('shape') !== req.shape) return null;
      mode.shape = 'same';
      pinned.shape = req.shape;
      setDefaultOthers(new Set(['shape']), true);
      return { mode, pinned };
    }
    case 'same_number': {
      mode.number = 'same';
      setDefaultOthers(new Set(['number']), true);
      return { mode, pinned };
    }
    case 'diff_number': {
      if (forced.has('number')) return null;
      mode.number = 'diff';
      setDefaultOthers(new Set(['number']), false);
      return { mode, pinned };
    }
    case 'all_different': {
      if (forced.size > 0) return null;
      for (const a of attrs) mode[a] = 'diff';
      return { mode, pinned };
    }
    case 'exact_same': {
      if (req.count > attrs.length || forced.size > req.count) return null;
      const sameSet = new Set<AttributeName>(forced.keys());
      const free = d._rng.shuffle(attrs.filter(a => !sameSet.has(a)));
      for (const a of free.slice(0, req.count - sameSet.size)) sameSet.add(a);
      for (const a of attrs) mode[a] = sameSet.has(a) ? 'same' : 'diff';
      return { mode, pinned };
    }
    case 'exact_diff': {
      const free = d._rng.shuffle(attrs.filter(a => !forced.has(a)));
      if (req.count > free.length) return null;
      const diffSet = new Set<AttributeName>(free.slice(0, req.count));
      for (const a of attrs) mode[a] = diffSet.has(a) ? 'diff' : 'same';
      return { mode, pinned };
    }
  }
};

/**
 * Counter-Parry fairness guarantee: during a specific Counter-Parry wind-up, if the
 * refilled board still has no valid Counter-Set, deterministically pull/place card(s)
 * from the deck into the refilled slots so at least one Counter-Set is immediately
 * solvable.
 */
const ensureParryCounterOnRefill = (
  d: Draft,
  candidate: Card[],
  slots: readonly number[],
  opts?: DrawOptions
): void => {
  const parry = d.parry;
  if (!parry || parry.phase !== 'windup' || parry.spec.counter.kind === 'any') return;
  const req = parry.spec.counter;
  const attrs = d.attributes;
  if (candidateHasCounterSet(candidate, attrs, req)) return;

  const validSlots = slots.filter(i => i >= 0 && i < candidate.length);
  if (validSlots.length === 0) return;

  const forced = new Map<AttributeName, string | number>();
  if (d.simplified) {
    forced.set(d.simplified.attribute, d.simplified.value);
    if (d.simplified.also) forced.set(d.simplified.also.attribute, d.simplified.also.value);
  }

  const targetSlot = validSlots[0];
  const others = d._rng.shuffle(
    candidate
      .map((c, i) => (i !== targetSlot && isSelectable(c) && !c.isWild && !d.replacing.includes(c.id) ? c : null))
      .filter((c): c is Card => c !== null)
  );
  for (let i = 0; i < others.length; i++) {
    for (let j = i + 1; j < others.length; j++) {
      const a = others[i];
      const b = others[j];
      const target: Partial<Record<AttributeName, string | number>> = {};
      let respectsForced = true;
      for (const attr of attrs) {
        const val = completingValue(a, b, attr);
        if (forced.has(attr) && forced.get(attr) !== val) {
          respectsForced = false;
          break;
        }
        target[attr] = val;
      }
      if (!respectsForced) continue;
      const preview: Card = { ...a, ...target, isWild: false } as Card;
      if (cardsMatchCounter([a, b, preview], attrs, req)) {
        placeTargetedCard(d, candidate, targetSlot, target, opts);
        if (candidateHasCounterSet(candidate, attrs, req)) return;
      }
    }
  }

  const pattern = planCounterPattern(d, attrs, req);
  if (!pattern) return;

  if (validSlots.length >= 2) {
    const usedTwo = new Set([validSlots[0], validSlots[1]]);
    const anchors = d._rng.shuffle(
      candidate.filter((c, i) => {
        if (usedTwo.has(i) || !isSelectable(c) || c.isWild || d.replacing.includes(c.id)) return false;
        return attrs.every(attr => pattern.pinned[attr] === undefined || attrValue(c, attr) === pattern.pinned[attr]);
      })
    );
    if (anchors.length > 0) {
      const a = anchors[0];
      const targetB: Partial<Record<AttributeName, string | number>> = {};
      const targetC: Partial<Record<AttributeName, string | number>> = {};
      for (const attr of attrs) {
        const va = attrValue(a, attr);
        if (pattern.mode[attr] === 'same') {
          targetB[attr] = va;
          targetC[attr] = va;
        } else {
          const rest = (ATTRIBUTE_VALUES[attr] as readonly (string | number)[]).filter(v => v !== va);
          const vb = d._rng.pick(rest);
          const vc = rest.find(v => v !== vb)!;
          targetB[attr] = vb;
          targetC[attr] = vc;
        }
      }
      placeTargetedCard(d, candidate, validSlots[0], targetB, opts);
      placeTargetedCard(d, candidate, validSlots[1], targetC, opts);
      if (candidateHasCounterSet(candidate, attrs, req)) return;
    }
  }

  if (validSlots.length >= 3) {
    const targets: [
      Partial<Record<AttributeName, string | number>>,
      Partial<Record<AttributeName, string | number>>,
      Partial<Record<AttributeName, string | number>>,
    ] = [{}, {}, {}];
    for (const attr of attrs) {
      if (pattern.mode[attr] === 'same') {
        const v = pattern.pinned[attr] ?? d._rng.pick(ATTRIBUTE_VALUES[attr] as readonly (string | number)[]);
        targets[0][attr] = v;
        targets[1][attr] = v;
        targets[2][attr] = v;
      } else {
        const vals = d._rng.shuffle(ATTRIBUTE_VALUES[attr] as readonly (string | number)[]);
        targets[0][attr] = vals[0];
        targets[1][attr] = vals[1];
        targets[2][attr] = vals[2];
      }
    }
    placeTargetedCard(d, candidate, validSlots[0], targets[0], opts);
    placeTargetedCard(d, candidate, validSlots[1], targets[1], opts);
    placeTargetedCard(d, candidate, validSlots[2], targets[2], opts);
  }
};

/**
 * Replace the cards at `indices` with fresh draws. Retries up to 11 times for a
 * natural Set, then falls back to deterministic Set construction so a refill never
 * commits a deadlocked board, and biases refills during specific Counter-Parry
 * wind-ups so a valid Counter-Set is immediately solvable.
 */
export const refill = (d: Draft, indices: number[], opts?: RefillOptions) => {
  if (indices.length === 0) return;
  let candidate: Card[] = d.board;
  for (let attempt = 0; attempt < 12; attempt++) {
    const picks = attempt === 0 && deckCopies(d.level) > 1 ? variedDeal(d.board, indices, d.deck, d.attributes) : null;
    const drawn = picks ? takeFromDeck(d, picks).map(base => dress(d, base, opts)) : indices.map(() => drawCard(d, opts));
    candidate = [...d.board];
    indices.forEach((idx, i) => (candidate[idx] = drawn[i]));
    if (hasAnySet(candidate, d.attributes) || attempt === 11) {
      break;
    }
    returnToDeck(d, drawn);
  }
  if (!hasAnySet(candidate, d.attributes)) {
    ensureBoardHasSet(d, candidate, indices, opts);
  }
  ensureParryCounterOnRefill(d, candidate, indices, opts);
  d.board = candidate;
  if (!opts?.skipFoeDrawEffects) indices.forEach(idx => announceDraw(d, d.board[idx], idx));
  if (opts?.quiet) return;
  countHazardRefills(d, indices);
};

/** Put cards back in the deck and refill their slots. */
export const recycle = (d: Draft, indices: number[], opts?: RefillOptions) => {
  returnToDeck(d, indices.map(i => d.board[i]));
  refill(d, indices, opts);
};

export const updateCards = (d: Draft, indices: Iterable<number>, change: (c: Card) => Card) => {
  const set = new Set(indices);
  if (set.size === 0) return;
  d.board = d.board.map((c, i) => (set.has(i) ? change(c) : c));
};

const isReplacing = (d: Draft, c: Card) => d.replacing.includes(c.id);

/** Cards a rule may touch: anything currently on the board and not mid-replacement. */
export const touchable = (d: Draft, i: number): boolean => {
  const c = d.board[i];
  return !!c && !isReplacing(d, c);
};

// ─── Combat primitives ──────────────────────────────────────────────────────

export const foeMultiplier = (d: Draft) => d.foe.getStatModifiers().pointsMultiplier || 1;

export const dealDamage = (d: Draft, amount: number): number => {
  const dmg = Math.max(0, Math.round(amount));
  if (d.level.rules.sandbox) {
    d.totalDamage += dmg;
    return dmg;
  }
  const hpBefore = d.foeHp;
  if (hpBefore > 0 && dmg > hpBefore) {
    const overkill = dmg - hpBefore;
    d.overkillDamage = Math.max(d.overkillDamage, overkill);
    d.fightMetrics.maxOverkill = Math.max(d.fightMetrics.maxOverkill, overkill);
    const a = arcana(d);
    if (a.overkillCarryPct && a.overkillCarryPct > 0) {
      d.pendingOverkillCarry = Math.max(d.pendingOverkillCarry ?? 0, Math.round(overkill * a.overkillCarryPct));
    }
    const coinsPerDamage = a.overkillCoinsPerDamage;
    if (coinsPerDamage !== undefined) {
      addCoins(d, overkill * coinsPerDamage);
      emit(d, 'overkill', overkill);
    }
  }
  d.foeHp = Math.max(0, d.foeHp - dmg);
  d.totalDamage += dmg;
  return dmg;
};

/**
 * Fold a synchronous Set-triggered flat damage bonus (`rawBase` BEFORE multipliers)
 * directly into the active primary Set's `BASE` bucket, applying only the exact
 * incremental damage delta so `Math.round(newBaseFlat * totalMult)` is exact.
 */
export const foldSetRuleDamage = (d: Draft, rawBase: number, item: FoldedRuleItem): number => {
  const fold = d._setFold;
  if (!fold || rawBase <= 0) return 0;
  const nextBaseFlat = fold.baseFlat + rawBase;
  const nextTotal = Math.max(0, Math.round(nextBaseFlat * fold.totalMult));
  const delta = Math.max(0, nextTotal - fold.dealtSoFar);

  fold.baseFlat = nextBaseFlat;
  fold.dealtSoFar = nextTotal;

  if (delta > 0) {
    if (d.level.rules.sandbox) {
      d.totalDamage += delta;
    } else {
      d.foeHp = Math.max(0, d.foeHp - delta);
      d.totalDamage += delta;
      if (fold.hpBeforeSet > 0 && nextTotal > fold.hpBeforeSet) {
        const totalOverkill = nextTotal - fold.hpBeforeSet;
        const extraOverkill = totalOverkill - fold.overkillCredited;
        if (extraOverkill > 0) {
          fold.overkillCredited = totalOverkill;
          d.overkillDamage = Math.max(d.overkillDamage, totalOverkill);
          d.fightMetrics.maxOverkill = Math.max(d.fightMetrics.maxOverkill, totalOverkill);
          const a = arcana(d);
          if (a.overkillCarryPct && a.overkillCarryPct > 0) {
            d.pendingOverkillCarry = Math.max(d.pendingOverkillCarry ?? 0, Math.round(totalOverkill * a.overkillCarryPct));
          }
          const coinsPerDamage = a.overkillCoinsPerDamage;
          if (coinsPerDamage !== undefined) {
            addCoins(d, extraOverkill * coinsPerDamage);
            emit(d, 'overkill', extraOverkill);
          }
        }
      }
    }
  }

  const primaryEv = d.events.find(e => e.id === fold.primaryEventId);
  if (primaryEv) primaryEv.amount = nextTotal;
  const primaryLine = d._lines[fold.primaryLineIdx];
  if (primaryLine) primaryLine.amount = nextTotal;

  if (d._logSet) {
    const flatItems = d._logSet.flatItems ? [...d._logSet.flatItems] : [];
    const rounded = Math.round(rawBase * 10) / 10;
    flatItems.push({
      label: item.label,
      amount: rounded,
      ...(item.note ? { note: item.note } : {}),
      ...(item.sourceRef ? { sourceRef: item.sourceRef } : {}),
    });
    d._logSet.flatItems = flatItems;
    d._logSet.flatBonus = Math.round((d._logSet.flatBonus + rawBase) * 10) / 10;
    d._logSet.baseDamageBeforeMult = Math.round(nextBaseFlat * 10) / 10;
    d._logSet.hit = nextTotal;
  }

  return delta;
};

export const addCoins = (d: Draft, base: number) => {
  if (!d.features.has('coins') || base <= 0) return;
  const reliefMult = d.relief?.cauldronWager ? 1 : (d.relief?.coinMultiplier ?? 1);
  const amount = Math.max(1, Math.round(base * d.level.coinMultiplier * (1 + d.coinBonusPercent / 100) * reliefMult));
  d.coins += amount;
  bumpSynergy(d, 'coins', amount);
  emit(d, 'coins', amount);
};

export const xpForLevel = (lvl: number): number => 6 + lvl * 5;

export const addXp = (d: Draft, amount: number) => {
  if (!d.features.has('xp') || amount <= 0) return;
  const a = arcana(d);
  const gained = amount * (a.xpScale ?? 1);
  d.xp += gained;
  d.fightMetrics.xpGained += gained;
  while (d.xp >= xpForLevel(d.xpLevel)) {
    d.xp -= xpForLevel(d.xpLevel);
    d.xpLevel += 1;
    d.levelUpsTaken += 1;
    d.fightMetrics.levelUps += 1;
    d.pendingPicks += 1;
    if (a.levelUpBaseDamageBonus && a.levelUpBaseDamageBonus > 0) {
      d.fightBaseDamageBonus += a.levelUpBaseDamageBonus;
    }
    emit(d, 'levelup');
  }
};

/** Cap overheal-sourced `healed` events per action so full-HP heal→destroy loops can't snowball unboundedly. */
export const MAX_OVERHEAL_TRIGGERS_PER_ACTION = 1;

export const heal = (d: Draft, amount: number): boolean => {
  if (d.hearts === null || d.maxHearts === null || amount <= 0) return false;
  if (arcana(d).noHeal) return false;
  const before = d.hearts;
  d.hearts = Math.min(d.maxHearts, d.hearts + amount);
  const restored = d.hearts - before;
  if (restored > 0) {
    d.fightMetrics.heals += restored;
    bumpSynergy(d, 'vitality', restored);
    emit(d, 'heal', restored);
    enqueue(d, 'healed');
    notifyEvoEvent(d, { on: 'resource', action: 'healed' });
    return true;
  }
  // Overheal counts as healed too so Phoenix/Mending/Life rules work at full HP
  if (d._overheals < MAX_OVERHEAL_TRIGGERS_PER_ACTION) {
    d._overheals += 1;
    d.fightMetrics.heals += 1;
    d.fightMetrics.overheals += 1;
    bumpSynergy(d, 'vitality', 1);
    enqueue(d, 'healed');
    notifyEvoEvent(d, { on: 'resource', action: 'healed' });
    notifyEvoEvent(d, { on: 'resource', action: 'overhealed' });
    return true;
  }
  return false;
};

export const rollBridges = (d: Draft, trigger: BridgeTriggerType): Weapon[] =>
  d.weapons.filter(
    w => w.specialEffect === 'bridge' && w.bridgeEffect?.trigger === trigger && d._rng.next() * 100 < w.bridgeEffect.chance
  );

export const hurt = (d: Draft, amount: number, opts?: { bypassWaveShield?: boolean }) => {
  if (d.hearts === null || amount <= 0) return;
  if (!opts?.bypassWaveShield && (d.waveShieldLeft ?? 0) > 0) {
    d.waveShieldLeft = Math.max(0, (d.waveShieldLeft ?? 0) - 1);
    emit(d, 'free_mistake', d.waveShieldLeft);
    return;
  }
  d.hearts = Math.max(0, d.hearts - amount);
  d.roundStats.damageReceived += amount;
  d.fightMetrics.heartsLost += amount;
  emit(d, 'hurt', amount);
  enqueue(d, 'hurt');
  if (d.hearts === 0 && d.passive.nineLivesLeft > 0) {
    d.passive.nineLivesLeft -= 1;
    d.hearts = 1;
    emit(d, 'nine_lives', d.passive.nineLivesLeft);
  }
  if (d.hearts === 1) signalGrowth(d, { on: 'feat', name: 'lastHeart' });
  if (d.hearts > 0) {
    for (const w of rollBridges(d, 'onHealthLoss')) {
      if (w.bridgeEffect?.effect === 'explosion') {
        const hit = destroyCards(d, areaIndices(d, { shape: 'random', count: 4 }), 'explosion');
        if (hit > 0) enqueue(d, 'weapon', 'explosion');
      }
    }
  }
};

/** Add seconds to the clock (timed fights only), up to `timeCap` and what is left in the fight's `timeBank`. */
export const addTime = (d: Draft, seconds: number, cap: number | null = d.timeCap): number => {
  if (d.timeLeft === null || seconds === 0) return 0;
  const before = d.timeLeft;
  const banked = typeof d.timeBank === 'number';
  const allowed = seconds > 0 && banked ? Math.min(seconds, d.timeBank!) : seconds;
  d.timeLeft = Math.max(0, cap === null ? d.timeLeft + allowed : Math.min(Math.max(cap, d.timeLeft), d.timeLeft + allowed));
  const gained = d.timeLeft - before;
  if (gained > 0) {
    if (banked) d.timeBank = Math.max(0, d.timeBank! - gained);
    d.fightMetrics.timeGainedSec = Math.round((d.fightMetrics.timeGainedSec + gained) * 10) / 10;
    emit(d, 'time_gain', Math.round(gained * 10) / 10);
  }
  return Math.max(0, gained);
};

export const addHints = (d: Draft, n: number) => {
  if (!d.features.has('hints') || n <= 0) return;
  const hints = d.stats.hints + n;
  d.stats = { ...d.stats, hints, maxHints: Math.max(d.stats.maxHints, hints) };
  bumpSynergy(d, 'hints', n);
  emit(d, 'hint', n);
};

export const addGraces = (d: Draft, n: number) => {
  if (!d.features.has('graces') || n <= 0) return;
  const graces = d.stats.graces + n;
  d.stats = { ...d.stats, graces, maxGraces: Math.max(d.stats.maxGraces, graces) };
  bumpSynergy(d, 'graces', n);
};

/** Place Synergy `marked: true` targets on `count` selectable unmarked board cards. */
export const markCards = (d: Draft, count: number): number => {
  if (count <= 0) return 0;
  const candidates = d.board
    .map((c, i) => (touchable(d, i) && isSelectable(c) && !c.marked ? i : -1))
    .filter(i => i >= 0);
  const chosen = d._rng.shuffle(candidates).slice(0, count);
  if (chosen.length === 0) return 0;
  updateCards(d, chosen, c => ({ ...c, marked: true }));
  bumpSynergy(d, 'marks', chosen.length);
  emit(d, 'marked', chosen.length, undefined, { slots: chosen });
  return chosen.length;
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

/** Elevated Adventure collateral damage per destroyed card (spec-combat-synergy.md §3.2). */
export const COLLATERAL_DAMAGE = { explosion: 2, laser: 4, ricochet: 2, connected: 2 } as const;

/** The stat that adds to a kind's collateral (Blast Powder, Prismatic Ray, Chaos Shard). */
const COLLATERAL_BONUS = { explosion: 'explosionDamage', laser: 'laserDamage', ricochet: 'ricochetDamage' } as const satisfies Record<DestroyKind, keyof PlayerStats>;

const DESTROY_EVENT: Record<DestroyKind, RunEventType> = { explosion: 'blast', laser: 'laser', ricochet: 'ricochet' };

/**
 * Destroy the cards at `indices`: armored cards lose a hit instead, cards on
 * their way out are skipped, linked partners go too. Every destroyed card pays
 * its collateral damage, 1 coin, and feeds the Destruction Synergy node.
 */
export const destroyCards = (d: Draft, indices: number[], kind: DestroyKind): number => {
  const targets = [...new Set(indices)].filter(i => touchable(d, i));
  const armored = targets.filter(i => (d.board[i].health ?? 1) > 1);
  updateCards(d, armored, c => ({ ...c, health: (c.health ?? 1) - 1 }));
  const destroyed = targets.filter(i => (d.board[i].health ?? 1) <= 1 && !armored.includes(i));
  const visited = new Set(destroyed);
  const linked: number[] = [];
  if (d.connections.length) {
    const traversed = new Set<number>();
    for (const i of destroyed) {
      if (traversed.has(i)) continue;
      for (const p of getLinkedDestructionPositions(d.connections, i, traversed)) {
        if (visited.has(p) || !touchable(d, p) || (d.board[p].health ?? 1) > 1) continue;
        visited.add(p);
        linked.push(p);
      }
    }
  }
  if (destroyed.length + armored.length === 0) return 0;
  d.roundStats.weaponEffectsTriggered.add(kind);
  if (kind === 'explosion') {
    d.explosionsTriggered += 1;
    d.fightMetrics.blasts += 1;
  } else if (kind === 'laser') {
    d.fightMetrics.lasers += 1;
  } else if (kind === 'ricochet') {
    d.fightMetrics.ricochets += destroyed.length;
    d.fightMetrics.maxRicochetChain = Math.max(d.fightMetrics.maxRicochetChain, destroyed.length);
  }
  const raw = destroyed.length * (COLLATERAL_DAMAGE[kind] + (d.stats[COLLATERAL_BONUS[kind]] ?? 0)) + linked.length * COLLATERAL_DAMAGE.connected;
  const dmg = dealDamage(d, raw * d._setMultiplier * foeMultiplier(d));
  const gone = [...destroyed, ...linked];
  emit(d, DESTROY_EVENT[kind], dmg, String(gone.length), {
    slots: [...gone, ...armored],
    cards: [...gone.map(i => d.board[i] ?? null), ...armored.map(() => null)],
  });
  let brokenCount = 0;
  for (const i of gone) {
    const c = d.board[i];
    if (c?.health === 1) {
      d.roundStats.tripleCardsCleared += 1;
      brokenCount += 1;
      if (c.bounty) {
        d.fightMetrics.pinatasBroken += 1;
        emit(d, 'pinata_break', dealDamage(d, c.bounty * d._setMultiplier * foeMultiplier(d)), undefined, { slots: [i] });
      }
    }
  }
  // Recycle destroyed slots BEFORE addCoins / bumpSynergy can trigger re-entrant evolution openingEffects
  if (gone.length) recycle(d, gone);
  addCoins(d, gone.length);
  if (gone.length > 0) {
    d._turnCardsDestroyed += gone.length;
    bumpSynergy(d, 'destruction', gone.length);
  }
  if (linked.length > 0) {
    d.fightMetrics.linksDestroyed += linked.length;
    bumpSynergy(d, 'links', linked.length);
  }
  for (let k = 0; k < brokenCount; k++) enqueue(d, 'cardBroken');
  for (let k = 0; k < gone.length; k++) {
    for (const bw of rollBridges(d, 'onDestruction')) {
      if (bw.bridgeEffect?.effect === 'heal') {
        if (heal(d, bw.bridgeEffect.amount ?? 1)) enqueue(d, 'weapon', 'heal');
      }
    }
  }
  linked.forEach(() => enqueue(d, 'linkDestroyed'));
  return gone.length;
};

/** Set random cards on fire. GameBoard burns them and sends BURN. */
export const igniteCards = (d: Draft, count: number, burnMult: number = d._setMultiplier): number => {
  const candidates = d.board
    .map((c, i) => (touchable(d, i) && isSelectable(c) && !c.onFire ? i : -1))
    .filter(i => i >= 0);
  const chosen = d._rng.shuffle(candidates).slice(0, count);
  if (chosen.length === 0) return 0;
  d.roundStats.weaponEffectsTriggered.add('fire');
  const stamp = d.elapsedMs + 1;
  if (burnMult !== 1) {
    const nextMults = { ...(d.burnMults ?? {}) };
    for (const i of chosen) nextMults[d.board[i].id] = burnMult;
    d.burnMults = nextMults;
  }
  updateCards(d, chosen, c => ({ ...c, onFire: true, fireStartTime: stamp }));
  bumpSynergy(d, 'burn', chosen.length);
  emit(d, 'fire', chosen.length, undefined, { slots: chosen });
  return chosen.length;
};

export const growBoard = (d: Draft, count: number): number => {
  if (count <= 0) return 0;
  const extra = Math.min(count, MAX_BOARD - d.board.length);
  if (extra <= 0) {
    empowerBoard(d, 1);
    bumpSynergy(d, 'field_size', 1);
    return 0;
  }
  const added: Card[] = [];
  for (let i = 0; i < extra; i++) added.push(drawCard(d));
  const first = d.board.length;
  d.board = [...d.board, ...added];
  syncLiveSynergy(d);
  emit(d, 'grow', extra, undefined, { slots: added.map((_, i) => first + i) });
  added.forEach((c, i) => announceDraw(d, c, first + i));
  return extra;
};

export const empowerBoard = (d: Draft, amount: number) => {
  if (amount <= 0 || d.board.length === 0) return;
  d.board = d.board.map(c => ({ ...c, charge: (c.charge ?? 0) + amount }));
  emit(d, 'empowered', amount);
};

export const armorCard = (d: Draft, extraHealth: number, bounty: number) => {
  const all = d.board
    .map((c, i) => (touchable(d, i) && isSelectable(c) && !c.snare && !c.hasCountdown && !c.hasBomb ? i : -1))
    .filter(i => i >= 0);
  if (all.length === 0 || extraHealth <= 0) return;
  const unarmored = all.filter(i => (d.board[i].health ?? 1) <= 1 && !d.board[i].bounty);
  const candidates = unarmored.length > 0 ? unarmored : all;
  const i = d._rng.pick(candidates);
  updateCards(d, [i], c => ({
    ...c,
    health: unarmored.length > 0 ? (c.health ?? 1) + extraHealth : Math.max(c.health ?? 1, 1 + extraHealth),
    bounty: (c.bounty ?? 0) + bounty,
  }));
  bumpSynergy(d, 'marks', 1);
  emit(d, 'pinata', bounty, undefined, { slots: [i] });
};

/** Re-deal every card that isn't armored, mid-trick or on its way out; the foe's draw effects don't apply. */
export const redeal = (d: Draft) => {
  const m = mods(d);
  let clearedDuds = 0;
  d.board = d.board.map(c =>
    c.isFaceDown && (c.fogBonus ?? 0) > 0
      ? {
          ...c,
          isFaceDown: false,
          bonusPoints: (c.bonusPoints ?? 0) + (c.fogBonus ?? 0),
          ...(m.fogHolo ? { holo: true } : {}),
          fogFlipAt: undefined,
          fogBonus: undefined,
        }
      : c
  );
  const keep = (c: Card) =>
    (c.health ?? 1) > 1 ||
    (c.rust ?? 0) > 0 ||
    !!c.rusted ||
    (c.frozen ?? 0) > 0 ||
    !!c.thawed ||
    c.chest !== undefined ||
    !!c.doubler;
  const idx = d.board.map((c, i) => (d.replacing.includes(c.id) || keep(c) ? -1 : i)).filter(i => i >= 0);
  if (idx.length === 0) return;
  for (const i of idx) {
    if (d.board[i].isDud) clearedDuds += 1;
  }
  idx.forEach(i => d.deck.push(toDeckCard(d.board[i])));
  d.deck = d._rng.shuffle(d.deck);
  refill(d, idx, { skipFoeDrawEffects: true, quiet: true });
  for (let k = 0; k < clearedDuds; k++) {
    bumpSynergy(d, 'hazards', 1);
    notifyEvoEvent(d, { on: 'hazard', hazardKind: 'dud' });
  }
  emit(d, 'redeal');
};

/** One active attribute becomes the same on every card (and on new cards) for a while. */
export const simplify = (d: Draft, ms: number) => {
  if (ms <= 0) return;
  d.fightMetrics.simplifies += 1;
  bumpSynergy(d, 'prism', 1);
  if (d.simplified) {
    d.simplified = { ...d.simplified, remainingMs: Math.max(d.simplified.remainingMs, ms) };
    if (!d.simplified.also) {
      const others = d.attributes.filter(a => a !== d.simplified!.attribute);
      const twice = mods(d).doubleClarityChance ?? 0;
      if (others.length >= 2 && twice > 0 && d._rng.next() * 100 < twice) {
        const second = d._rng.pick(others);
        const also = { attribute: second, value: d._rng.pick(ATTRIBUTE_VALUES[second] as readonly (string | number)[]) };
        d.simplified = { ...d.simplified, also };
        d.board = d.board.map(c => withAttribute(c, also.attribute, also.value));
        emit(d, 'simplified', d.simplified.remainingMs, `${d.simplified.attribute} and ${also.attribute}`);
      }
    }
    return;
  }
  const attribute = d._rng.pick(d.attributes);
  const value = d._rng.pick(ATTRIBUTE_VALUES[attribute] as readonly (string | number)[]);
  d.simplified = { attribute, value, remainingMs: ms };
  d.board = d.board.map(c => withAttribute(c, attribute, value));
  const others = d.attributes.filter(a => a !== attribute);
  const twice = mods(d).doubleClarityChance ?? 0;
  if (others.length >= 2 && twice > 0 && d._rng.next() * 100 < twice) {
    const second = d._rng.pick(others);
    const also = { attribute: second, value: d._rng.pick(ATTRIBUTE_VALUES[second] as readonly (string | number)[]) };
    d.simplified = { ...d.simplified, also };
    d.board = d.board.map(c => withAttribute(c, also.attribute, also.value));
  }
  emit(d, 'simplified', ms, d.simplified.also ? `${attribute} and ${d.simplified.also.attribute}` : attribute);
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
  d.fightMetrics.linksCreated += 1;
  bumpSynergy(d, 'links', 1);
};

/** Board slots of the links added since there were `before` of them. */
export const newLinkSlots = (d: Draft, before: number): number[] =>
  d.connections.slice(before).flatMap(c => [c.positionA, c.positionB]);

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
    !!c && isSelectable(c) && (c.health ?? 1) === 1 && !c.hasBomb && !c.hasCountdown && !c.snare && !isReplacing(d, c)
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
  emit(d, 'trap_placed', bombs.seconds, 'bomb', { slots: [i] });
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
  emit(d, 'trap_placed', undefined, 'snare', { slots: [i] });
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
  updateCards(d, fix, (c, ) => ({ ...c, snare: undefined }));
};
