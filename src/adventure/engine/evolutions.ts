/**
 * Per-Weapon Timed Evolutions runtime engine (spec-combat-synergy.md §6, spec-evos-bounties.md §1).
 *
 * Every equipped Armory weapon with an equipped evolution runs its own parallel
 * `WeaponEvolutionRuntime` (`charging` → `active` → `cooldown` → `charging`).
 * Zero global per-fight cap; re-triggerable after a brief 3s post-expiry cooldown.
 * All 26 deterministic `EvolutionCondition` kinds evaluate purely on `Draft` + Set telemetry.
 */
import type { AttributeName, Card, Color, Shape, Weapon } from '@/types';
import { getAdjacentIndices } from '@/utils/weaponEffects';
import type {
  EvolutionCondition,
  SynergyCounters,
  WeaponEvolutionDef,
  WeaponEvolutionRuntime,
} from '../types';
import type { TrickKind } from '../rules/types';
import { UNDERSTUDY_ID } from '../data/adventureWeapons';
import { evolutionsForWeapon, getWeaponEvolution } from '../data/evolutions';
import {
  addTime,
  arcana,
  dealDamage,
  emit,
  enqueue,
  foeMultiplier,
  GRID_COLS,
  mods,
  notifyEvoEvent,
  refreshSources,
  setEvoEventHook,
  type Draft,
  type EvoHookEvent,
} from './fight';
import { activeWeaponEvolutions, EVOLUTION_CHASSIS } from './sources';
import { applyEffect, fireFinale, fireOpening } from '../rules/engine';

/** The four corner cards of the 3-column board (the last row may be short). */
const cornerSlots = (boardLength: number): number[] => {
  if (boardLength <= 0) return [];
  const lastRow = Math.floor((boardLength - 1) / GRID_COLS) * GRID_COLS;
  return [...new Set([0, Math.min(GRID_COLS - 1, boardLength - 1), lastRow, boardLength - 1])];
};

const UNDERSTUDY_FALLBACK_CONDITION: EvolutionCondition = { kind: 'clean_streak', target: 3 };

/** Numeric progress goal for any `EvolutionCondition`. */
export const conditionTarget = (cond: EvolutionCondition): number => {
  switch (cond.kind) {
    case 'trait_cycle': return 3;
    case 'base_damage_hit':
    case 'total_damage_hit':
    case 'multiplied_hit':
    case 'cards_destroyed_single_set':
      return Math.max(1, cond.target ?? 1);
    case 'combo_reach':
    case 'board_state':
      return Math.max(1, cond.setsRequired ?? 1);
    case 'understudy_mirror':
      return 1;
    default:
      return Math.max(1, cond.target);
  }
};

/** Resolve the equipped evolution ID for a weapon (explicit equip, else first unlocked evo for that weapon). */
export const resolveEquippedEvoId = (
  weaponId: string,
  equippedEvolutions: Readonly<Record<string, string>>,
  unlockedWeaponEvolutions: readonly string[]
): string | null => {
  const chosen = equippedEvolutions[weaponId];
  if (chosen) {
    const def = getWeaponEvolution(chosen);
    if (def && def.weaponId === weaponId && (unlockedWeaponEvolutions.length === 0 || unlockedWeaponEvolutions.includes(chosen))) {
      return chosen;
    }
  }
  const unlockedSet = new Set(unlockedWeaponEvolutions);
  const forW = evolutionsForWeapon(weaponId);
  const firstUnlocked = forW.find(e => unlockedSet.has(e.id));
  return firstUnlocked?.id ?? null;
};

/** Find the immediate left neighbor weapon's active condition (for Understudy `copy_condition`). */
const leftNeighborDef = (
  weapons: readonly Weapon[],
  trackers: readonly WeaponEvolutionRuntime[],
  weaponId: string
): { weaponId: string; def: WeaponEvolutionDef } | null => {
  const slot = weapons.findIndex(w => w.id === weaponId);
  if (slot <= 0) return null;
  const left = weapons[slot - 1];
  if (!left || left.id === UNDERSTUDY_ID) return null;
  const leftTracker = trackers.find(t => t.weaponId === left.id);
  if (!leftTracker) return null;
  const def = getWeaponEvolution(leftTracker.evoId);
  if (!def || def.condition.kind === 'understudy_mirror') return null;
  return { weaponId: left.id, def };
};

const effectiveConditionFor = (
  weapons: readonly Weapon[],
  trackers: readonly WeaponEvolutionRuntime[],
  tracker: WeaponEvolutionRuntime,
  def: WeaponEvolutionDef
): { cond: EvolutionCondition; ownerWeaponId: string } => {
  if (def.condition.kind === 'understudy_mirror' && def.condition.mode === 'copy_condition') {
    const left = leftNeighborDef(weapons, trackers, tracker.weaponId);
    if (left) return { cond: left.def.condition, ownerWeaponId: left.weaponId };
    return { cond: UNDERSTUDY_FALLBACK_CONDITION, ownerWeaponId: tracker.weaponId };
  }
  return { cond: def.condition, ownerWeaponId: tracker.weaponId };
};

const isAlmostReady = (progress: number, target: number): boolean =>
  target > 1 ? progress >= target - 1 || progress / target >= 0.75 : false;

const makeTracker = (
  weaponId: string,
  evoId: string,
  def: WeaponEvolutionDef,
  synergy: SynergyCounters,
  effCond: EvolutionCondition
): WeaponEvolutionRuntime => ({
  weaponId,
  evoId,
  phase: 'charging',
  progress: 0,
  target: conditionTarget(effCond),
  almostReady: false,
  activeRemainingMs: 0,
  durationMs: def.durationMs,
  cooldownRemainingMs: 0,
  triggersCount: 0,
  ...(effCond.kind === 'synergy_delta' ? { synergyBaseline: synergy[effCond.attr] ?? 0 } : {}),
});

/** Build initial per-weapon evolution trackers at fight start. */
export const initWeaponEvolutions = (
  weapons: readonly Weapon[],
  equippedEvolutions: Readonly<Record<string, string>>,
  unlockedWeaponEvolutions: readonly string[],
  synergy: SynergyCounters,
  enabled: boolean
): WeaponEvolutionRuntime[] => {
  if (!enabled) return [];
  const raw: { weaponId: string; evoId: string; def: WeaponEvolutionDef }[] = [];
  const seen = new Set<string>();
  for (const w of weapons) {
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    const evoId = resolveEquippedEvoId(w.id, equippedEvolutions, unlockedWeaponEvolutions);
    if (!evoId) continue;
    const def = getWeaponEvolution(evoId);
    if (!def) continue;
    raw.push({ weaponId: w.id, evoId, def });
  }
  // Two-pass so Understudy `copy_condition` can read its left neighbor's tracker target
  const trackers: WeaponEvolutionRuntime[] = raw.map(r => makeTracker(r.weaponId, r.evoId, r.def, synergy, r.def.condition));
  return trackers.map((t, i) => {
    const { cond } = effectiveConditionFor(weapons, trackers, t, raw[i].def);
    return makeTracker(t.weaponId, t.evoId, raw[i].def, synergy, cond);
  });
};

/** Synchronize `d.weaponEvolutions` after acquiring/swapping weapons mid-fight (preserves existing trackers). */
export const syncWeaponEvolutions = (d: Draft) => {
  if (!d.features.has('evolutions')) {
    d.weaponEvolutions = [];
    return;
  }
  const byWeapon = new Map(d.weaponEvolutions.map(t => [t.weaponId, t]));
  const next: WeaponEvolutionRuntime[] = [];
  const seen = new Set<string>();
  for (const w of d.weapons) {
    if (seen.has(w.id)) continue;
    seen.add(w.id);
    const existing = byWeapon.get(w.id);
    const evoId = resolveEquippedEvoId(w.id, d.equippedEvolutions, d.unlockedWeaponEvolutions);
    if (!evoId) continue;
    const def = getWeaponEvolution(evoId);
    if (!def) continue;
    if (existing && existing.evoId === evoId) {
      next.push(existing);
    } else {
      next.push(makeTracker(w.id, evoId, def, d.synergy, def.condition));
    }
  }
  // Refresh Understudy `copy_condition` target if its left neighbor changed
  d.weaponEvolutions = next.map(t => {
    const def = getWeaponEvolution(t.evoId);
    if (!def || def.condition.kind !== 'understudy_mirror' || def.condition.mode !== 'copy_condition') return t;
    const { cond } = effectiveConditionFor(d.weapons, next, t, def);
    const target = conditionTarget(cond);
    return t.target === target
      ? t
      : {
          ...t,
          target,
          ...(cond.kind === 'synergy_delta' && t.synergyBaseline === undefined
            ? { synergyBaseline: d.synergy[cond.attr] ?? 0 }
            : {}),
        };
  });
};

/** Total extra progress ticks granted when advancing any charging evolution condition. */
const evolutionChargeBonusFor = (d: Draft): number =>
  Math.max(
    0,
    Math.round(
      (mods(d).evolutionChargeBonus ?? 0) +
        (arcana(d).evolutionChargeBonus ?? 0) +
        (d.level.rules.extraEvolutionChargeBonus ?? 0)
    )
  );

/** Compute total active duration (ms) for an igniting weapon evolution. */
const effectiveDurationMsFor = (d: Draft, def: WeaponEvolutionDef): number =>
  Math.max(
    3000,
    def.durationMs +
      d.evolutionLabTier * EVOLUTION_CHASSIS.labDurationMsPerTier +
      (mods(d).evolutionDurationMs ?? 0) +
      (arcana(d).evolutionDurationBonusMs ?? 0) +
      (d.level.rules.extraEvolutionDurationMs ?? 0)
  );

const updateTrackerProgress = (
  d: Draft,
  index: number,
  nextProgress: number,
  def: WeaponEvolutionDef
): boolean => {
  const t = d.weaponEvolutions[index];
  if (!t || t.phase !== 'charging') return false;
  const clamped = Math.max(0, Math.min(t.target, nextProgress));
  if (clamped >= t.target) {
    igniteWeaponEvolution(d, index);
    return true;
  }
  const prev = t.progress;
  const wasAlmost = t.almostReady;
  const nowAlmost = isAlmostReady(clamped, t.target);
  if (clamped !== prev || nowAlmost !== wasAlmost) {
    d.weaponEvolutions[index] = { ...t, progress: clamped, almostReady: nowAlmost };
    if (clamped > prev) {
      const prevChain = d._chain;
      d._chain = [...prevChain, `weapon:${t.weaponId}`];
      emit(d, 'evo_progress', clamped, `${clamped}/${t.target}`);
      if (nowAlmost && !wasAlmost) emit(d, 'evo_almost', clamped, def.name);
      d._chain = prevChain;
    }
  }
  return false;
};

/** Immediately ignite the weapon evolution at `index` (handles burst, openingEffects, Understudy mirror, metrics). */
export const igniteWeaponEvolution = (
  d: Draft,
  index: number,
  opts?: { fromMirror?: boolean; extraOpeningEffects?: readonly import('../rules/types').Effect[] }
) => {
  const t = d.weaponEvolutions[index];
  if (!t || t.phase === 'active') return;
  const def = getWeaponEvolution(t.evoId);
  if (!def) return;
  // Don't ignite dead-on-arrival evolutions after the final foe already hit 0 HP
  const finalFoeAlreadyDefeated = !d.level.rules.sandbox && d.foeHp <= 0 && d.wave >= d.level.foes.length - 1;
  if (finalFoeAlreadyDefeated) return;

  const durationMs = effectiveDurationMsFor(d, def);
  const triggersCount = t.triggersCount + 1;
  d.weaponEvolutions[index] = {
    ...t,
    phase: 'active',
    progress: t.target,
    almostReady: false,
    activeRemainingMs: durationMs,
    durationMs,
    cooldownRemainingMs: 0,
    triggersCount,
    windowTimes: undefined,
    seenCycleValues: undefined,
  };

  d.evolutionsTriggered += 1;
  d.fightMetrics.evolutionsTriggered += 1;
  d.fightMetrics.weaponEvos[t.weaponId] = (d.fightMetrics.weaponEvos[t.weaponId] ?? 0) + 1;
  d.fightMetrics.distinctWeaponsEvolved = Object.keys(d.fightMetrics.weaponEvos).length;
  const activeCount = activeWeaponEvolutions(d.weaponEvolutions).length;
  if (activeCount > d.fightMetrics.maxSimultaneousEvos) {
    d.fightMetrics.maxSimultaneousEvos = activeCount;
  }
  if (!d.forgedEvolutions.includes(def.id)) {
    d.forgedEvolutions = [...d.forgedEvolutions, def.id];
  }

  refreshSources(d);

  const prevChain = d._chain;
  d._chain = [...prevChain, `evo:${def.id}`];
  emit(d, 'evolution_start', durationMs, def.name);

  // Ignition Burst: +18 (+ Arcana bonus), scaled by foeMultiplier (and non-foe Set multiplier if inside a Set)
  const burst = arcana(d).evolutionBurstBonus;
  const burstRaw = EVOLUTION_CHASSIS.ignitionBurstDamage + (burst?.damage ?? 0);
  const dealt = dealDamage(d, burstRaw * d._setMultiplier * foeMultiplier(d));
  if (dealt > 0) emit(d, 'hit', dealt, def.name);
  if (burst && burst.time > 0) addTime(d, burst.time);

  // Run declarative openingEffects (and any mirrored openingEffects for Understudy)
  if (!d.blankEvolutionRules) {
    for (const eff of def.openingEffects ?? []) applyEffect(d, eff, def.name);
    for (const eff of opts?.extraOpeningEffects ?? []) applyEffect(d, eff, def.name);
  }
  d._chain = prevChain;

  enqueue(d, 'evolutionStart', undefined, undefined, { weaponId: t.weaponId });
  enqueue(d, 'weaponEvolutionStart', undefined, undefined, { weaponId: t.weaponId });

  // Notify ally weapons watching `ally_evolution_started`
  notifyEvoEvent(d, { on: 'resource', action: 'ally_evolution_started', sourceWeaponId: t.weaponId });

  // Understudy `ignite_with_left`: if the weapon immediately to the right is Understudy with `ignite_with_left`, ignite it too!
  if (!opts?.fromMirror) {
    const slot = d.weapons.findIndex(w => w.id === t.weaponId);
    const right = slot >= 0 ? d.weapons[slot + 1] : undefined;
    if (right?.id === UNDERSTUDY_ID) {
      const usIdx = d.weaponEvolutions.findIndex(x => x.weaponId === UNDERSTUDY_ID);
      if (usIdx >= 0 && d.weaponEvolutions[usIdx].phase !== 'active') {
        const usDef = getWeaponEvolution(d.weaponEvolutions[usIdx].evoId);
        if (usDef?.condition.kind === 'understudy_mirror' && usDef.condition.mode === 'ignite_with_left') {
          igniteWeaponEvolution(d, usIdx, { fromMirror: true, extraOpeningEffects: def.openingEffects });
        }
      }
    }
  }
};

/** Extend active weapon evolution timers (`target`: 'all' | 'self' | 'other'). */
export const extendEvolutions = (
  d: Draft,
  ms: number,
  target: 'all' | 'self' | 'other' = 'all',
  sourceWeaponId?: string
): boolean => {
  if (ms <= 0) return false;
  let extended = false;
  d.weaponEvolutions = d.weaponEvolutions.map(e => {
    if (e.phase !== 'active') return e;
    if (target === 'self' && sourceWeaponId && e.weaponId !== sourceWeaponId) return e;
    if (target === 'other' && sourceWeaponId && e.weaponId === sourceWeaponId) return e;
    extended = true;
    return { ...e, activeRemainingMs: e.activeRemainingMs + ms, durationMs: e.durationMs + ms };
  });
  return extended;
};

/** Grant external progress ticks to charging weapon evolutions (`chargeEvolution` effect, Perfect Parry, Catalyst Prism). */
export const chargeWeaponEvolutions = (
  d: Draft,
  target: 'all' | 'self' | 'other',
  amount: number,
  sourceWeaponId?: string
): boolean => {
  if (amount <= 0 || !d.features.has('evolutions')) return false;
  let chargedAny = false;
  for (let i = 0; i < d.weaponEvolutions.length; i++) {
    const t = d.weaponEvolutions[i];
    if (t.phase !== 'charging') continue;
    if (target === 'self' && sourceWeaponId && t.weaponId !== sourceWeaponId) continue;
    if (target === 'other' && sourceWeaponId && t.weaponId === sourceWeaponId) continue;
    const def = getWeaponEvolution(t.evoId);
    if (!def) continue;
    const { cond } = effectiveConditionFor(d.weapons, d.weaponEvolutions, t, def);
    chargedAny = true;
    if (cond.kind === 'sets_in_window') {
      const times = [...(t.windowTimes ?? [])];
      for (let k = 0; k < amount; k++) times.push(d.elapsedMs);
      d.weaponEvolutions[i] = { ...t, windowTimes: times };
    } else if (cond.kind === 'synergy_delta') {
      const base = (t.synergyBaseline ?? d.synergy[cond.attr] ?? 0) - amount;
      d.weaponEvolutions[i] = { ...t, synergyBaseline: base };
    }
    const prevChain = d._chain;
    d._chain = [...prevChain, `weapon:${t.weaponId}`];
    emit(d, 'evo_charge', amount, def.name);
    d._chain = prevChain;
    updateTrackerProgress(d, i, t.progress + amount, def);
  }
  return chargedAny;
};

/** Complete telemetry captured for a single player Set to evaluate all Set-based Evolution Conditions. */
export interface SetEvalTelemetry {
  matched: readonly Card[];
  slots: readonly number[];
  prevSetSlots: readonly number[];
  diffCount: number;
  differingAttrs: readonly AttributeName[];
  sameColor: boolean;
  color: Color | null;
  sameShape: boolean;
  shape: Shape | null;
  numberMode: 'same' | 'diff' | 'none';
  numberValue: 1 | 2 | 3 | null;
  rainbow: boolean;
  purityChain: number;
  baseDamage: number;
  totalDamage: number;
  combinedMultiplier: number;
  cardsDestroyedInSet: number;
  sinceLastMs: number;
  combo: number;
  cleanStreak: number;
  graceUsed: boolean;
  hinted: boolean;
  surgeSet: boolean;
  parryKind: 'parry' | 'perfect' | 'stalled' | null;
  wasStaggered: boolean;
  tricksPaid: ReadonlySet<TrickKind>;
  /** Board & resource snapshots captured BEFORE the Set leaves the board */
  boardLength: number;
  activeLinks: number;
  linkedSlotSet: ReadonlySet<number>;
  burningOnBoard: number;
  holoOnBoard: number;
  hearts: number | null;
  maxHearts: number | null;
  hints: number;
  graces: number;
}

const isAdjacentCluster = (slots: readonly number[], boardLength: number): boolean => {
  if (slots.length < 3) return false;
  const set = new Set(slots);
  const visited = new Set<number>([slots[0]]);
  const queue = [slots[0]];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const adj of getAdjacentIndices(cur, boardLength)) {
      if (set.has(adj) && !visited.has(adj)) {
        visited.add(adj);
        queue.push(adj);
      }
    }
  }
  return visited.size === slots.length;
};

const matchesBoardGeometry = (
  geometry: Extract<EvolutionCondition, { kind: 'board_geometry' }>['geometry'],
  tel: SetEvalTelemetry
): boolean => {
  switch (geometry) {
    case 'corners': {
      const corners = cornerSlots(tel.boardLength);
      return tel.slots.filter(s => corners.includes(s)).length >= 2;
    }
    case 'same_row':
      return tel.slots.length === 3 && new Set(tel.slots.map(s => Math.floor(s / GRID_COLS))).size === 1;
    case 'same_col':
      return tel.slots.length === 3 && new Set(tel.slots.map(s => s % GRID_COLS)).size === 1;
    case 'adjacent_cluster':
      return isAdjacentCluster(tel.slots, tel.boardLength);
    case 'reuse_last_slot':
      return tel.prevSetSlots.length > 0 && tel.slots.some(s => tel.prevSetSlots.includes(s));
    case 'touch_last_set':
      return (
        tel.prevSetSlots.length > 0 &&
        tel.slots.some(
          s =>
            tel.prevSetSlots.includes(s) ||
            getAdjacentIndices(s, tel.boardLength).some(adj => tel.prevSetSlots.includes(adj))
        )
      );
  }
};

const cardHasTag = (
  c: Card,
  slot: number,
  tag: Extract<EvolutionCondition, { kind: 'special_cards_matched' }>['cardTag'],
  linkedSlotSet: ReadonlySet<number>
): boolean => {
  switch (tag) {
    case 'power': return (c.bonusPoints ?? 0) > 0;
    case 'gold': return (c.bonusMoney ?? 0) > 0;
    case 'holo': return !!c.holo;
    case 'burning': return !!c.onFire;
    case 'linked': return slot >= 0 && linkedSlotSet.has(slot);
    case 'wild': return !!c.isWild;
    case 'armored': return (c.health ?? 1) > 1 || (c.bounty ?? 0) > 0;
    case 'marked': return !!c.marked || !!c.magnet || !!c.doubler || !!c.hot || c.chest !== undefined;
    case 'any_special':
      return (
        (c.bonusPoints ?? 0) > 0 ||
        (c.bonusMoney ?? 0) > 0 ||
        !!c.holo ||
        !!c.onFire ||
        (slot >= 0 && linkedSlotSet.has(slot)) ||
        !!c.isWild ||
        (c.health ?? 1) > 1 ||
        (c.bounty ?? 0) > 0 ||
        !!c.marked ||
        !!c.magnet ||
        !!c.doubler ||
        !!c.hot ||
        c.chest !== undefined
      );
  }
};

const boardStateHolds = (
  cond: Extract<EvolutionCondition, { kind: 'board_state' }>,
  tel: SetEvalTelemetry
): boolean => {
  switch (cond.check) {
    case 'board_at_least': return tel.boardLength >= cond.threshold;
    case 'links_at_least': return tel.activeLinks >= cond.threshold;
    case 'burning_at_least': return tel.burningOnBoard >= cond.threshold;
    case 'holo_on_board_at_least': return tel.holoOnBoard >= cond.threshold;
    case 'hints_held_at_least': return tel.hints >= cond.threshold;
    case 'graces_held_at_least': return tel.graces >= cond.threshold;
    case 'hearts_full': return tel.hearts !== null && tel.maxHearts !== null && tel.hearts >= tel.maxHearts;
    case 'hearts_at_most': return tel.hearts !== null && tel.hearts <= cond.threshold;
  }
};

/** Evaluate every charging per-weapon evolution after a player Set finishes resolving. */
export const evaluateWeaponEvolutionsOnSet = (d: Draft, tel: SetEvalTelemetry) => {
  if (!d.features.has('evolutions') || d.weaponEvolutions.length === 0) return;
  const chargeBonus = evolutionChargeBonusFor(d);
  const step = 1 + chargeBonus;

  for (let i = 0; i < d.weaponEvolutions.length; i++) {
    const t = d.weaponEvolutions[i];
    if (t.phase !== 'charging') continue;
    const def = getWeaponEvolution(t.evoId);
    if (!def) continue;
    const { cond } = effectiveConditionFor(d.weapons, d.weaponEvolutions, t, def);

    switch (cond.kind) {
      case 'color_set': {
        const hit = !tel.graceUsed && tel.sameColor && (cond.color === 'any_same' || tel.color === cond.color);
        if (hit) updateTrackerProgress(d, i, t.progress + step, def);
        else if (cond.consecutive && t.progress > 0) updateTrackerProgress(d, i, 0, def);
        break;
      }
      case 'shape_set': {
        const hit = !tel.graceUsed && tel.sameShape && (cond.shape === 'any_same' || tel.shape === cond.shape);
        if (hit) updateTrackerProgress(d, i, t.progress + step, def);
        else if (cond.consecutive && t.progress > 0) updateTrackerProgress(d, i, 0, def);
        break;
      }
      case 'number_set': {
        if (!d.attributes.includes('number')) break;
        const hit =
          !tel.graceUsed &&
          (cond.mode === 'same'
            ? tel.numberMode === 'same' && (cond.value === undefined || tel.numberValue === cond.value)
            : tel.numberMode === 'diff');
        if (hit) updateTrackerProgress(d, i, t.progress + step, def);
        else if (cond.consecutive && t.progress > 0) updateTrackerProgress(d, i, 0, def);
        break;
      }
      case 'exact_diff_traits': {
        if (
          (cond.onlyDiffAttr && !d.attributes.includes(cond.onlyDiffAttr)) ||
          (cond.onlySameAttr && !d.attributes.includes(cond.onlySameAttr)) ||
          cond.diffCount > d.attributes.length
        ) {
          break;
        }
        let hit = !tel.graceUsed && tel.diffCount === cond.diffCount;
        if (hit && cond.onlyDiffAttr) {
          hit = tel.differingAttrs.length === 1 && tel.differingAttrs[0] === cond.onlyDiffAttr;
        }
        if (hit && cond.onlySameAttr) {
          const sameAttrs = d.attributes.filter(a => !tel.differingAttrs.includes(a));
          hit = sameAttrs.length === 1 && sameAttrs[0] === cond.onlySameAttr;
        }
        if (hit) updateTrackerProgress(d, i, t.progress + step, def);
        else if (cond.consecutive && t.progress > 0) updateTrackerProgress(d, i, 0, def);
        break;
      }
      case 'rainbow_set': {
        const hit = !tel.graceUsed && tel.rainbow;
        if (hit) updateTrackerProgress(d, i, t.progress + step, def);
        else if (cond.consecutive && t.progress > 0) updateTrackerProgress(d, i, 0, def);
        break;
      }
      case 'purity_step': {
        const minChain = cond.minChain ?? 2;
        const hit = !tel.graceUsed && tel.purityChain >= minChain;
        if (hit) updateTrackerProgress(d, i, t.progress + step, def);
        else if (cond.consecutive && t.progress > 0) updateTrackerProgress(d, i, 0, def);
        break;
      }
      case 'board_geometry': {
        const needsPrev = cond.geometry === 'reuse_last_slot' || cond.geometry === 'touch_last_set';
        if (needsPrev && tel.prevSetSlots.length === 0) break;
        const hit = matchesBoardGeometry(cond.geometry, tel);
        if (hit) updateTrackerProgress(d, i, t.progress + step, def);
        else if (cond.consecutive && t.progress > 0) updateTrackerProgress(d, i, 0, def);
        break;
      }
      case 'trait_cycle': {
        if (tel.graceUsed || !d.attributes.includes(cond.attr)) break;
        let val: string | number | null = null;
        if (cond.attr === 'color' && tel.sameColor) val = tel.color;
        else if (cond.attr === 'shape' && tel.sameShape) val = tel.shape;
        else if (cond.attr === 'number' && tel.numberMode === 'same') val = tel.numberValue;
        if (val !== null) {
          const seen = [...(t.seenCycleValues ?? [])];
          if (!seen.includes(val)) {
            seen.push(val);
            d.weaponEvolutions[i] = { ...t, seenCycleValues: seen };
            updateTrackerProgress(d, i, Math.max(t.progress + step, seen.length), def);
          }
        }
        break;
      }
      case 'base_damage_hit': {
        if (tel.baseDamage >= cond.threshold) updateTrackerProgress(d, i, t.progress + step, def);
        break;
      }
      case 'total_damage_hit': {
        if (tel.totalDamage >= cond.threshold) updateTrackerProgress(d, i, t.progress + step, def);
        break;
      }
      case 'multiplied_hit': {
        if (tel.combinedMultiplier >= cond.threshold - 1e-6) updateTrackerProgress(d, i, t.progress + step, def);
        break;
      }
      case 'cards_destroyed_single_set': {
        if (tel.cardsDestroyedInSet >= cond.threshold) updateTrackerProgress(d, i, t.progress + step, def);
        break;
      }
      case 'quick_sets': {
        const hit = !tel.graceUsed && tel.sinceLastMs <= cond.withinMs;
        if (hit) updateTrackerProgress(d, i, t.progress + step, def);
        else if (cond.consecutive && t.progress > 0) updateTrackerProgress(d, i, 0, def);
        break;
      }
      case 'sets_in_window': {
        const nextTimes = [...(t.windowTimes ?? []), d.elapsedMs].filter(ts => d.elapsedMs - ts <= cond.windowMs);
        for (let k = 0; k < chargeBonus; k++) nextTimes.push(d.elapsedMs);
        d.weaponEvolutions[i] = { ...t, windowTimes: nextTimes };
        updateTrackerProgress(d, i, nextTimes.length, def);
        break;
      }
      case 'clean_streak': {
        if (!tel.graceUsed) updateTrackerProgress(d, i, t.progress + step, def);
        else if (t.progress > 0) updateTrackerProgress(d, i, 0, def);
        break;
      }
      case 'patient_sets': {
        const hit = !tel.graceUsed && tel.sinceLastMs >= cond.minGapMs;
        if (hit) updateTrackerProgress(d, i, t.progress + step, def);
        else if (cond.consecutive && t.progress > 0) updateTrackerProgress(d, i, 0, def);
        break;
      }
      case 'combo_reach': {
        if (tel.combo >= cond.minCombo) updateTrackerProgress(d, i, t.progress + step, def);
        break;
      }
      case 'special_cards_matched': {
        let count = 0;
        for (let k = 0; k < tel.matched.length; k++) {
          if (cardHasTag(tel.matched[k], tel.slots[k] ?? -1, cond.cardTag, tel.linkedSlotSet)) count += 1;
        }
        if (cond.inSingleSet) {
          if (count >= cond.target) updateTrackerProgress(d, i, t.target, def);
          else if (cond.consecutive && t.progress > 0) updateTrackerProgress(d, i, 0, def);
        } else {
          if (count > 0) updateTrackerProgress(d, i, t.progress + count + chargeBonus, def);
          else if (cond.consecutive && t.progress > 0) updateTrackerProgress(d, i, 0, def);
        }
        break;
      }
      case 'trick_payout': {
        // Increments happen on the `trick` event hook; here we only enforce `consecutive` resets on Sets with no matching payout.
        if (cond.consecutive && t.progress > 0) {
          const hit = cond.trick === 'any' ? tel.tricksPaid.size > 0 : tel.tricksPaid.has(cond.trick);
          if (!hit) updateTrackerProgress(d, i, 0, def);
        }
        break;
      }
      case 'board_state': {
        if (boardStateHolds(cond, tel)) updateTrackerProgress(d, i, t.progress + step, def);
        break;
      }
      case 'parry_feat': {
        const hit =
          (cond.mode === 'any' && (tel.parryKind === 'parry' || tel.parryKind === 'perfect')) ||
          (cond.mode === 'perfect' && tel.parryKind === 'perfect') ||
          (cond.mode === 'staggered_set' && tel.wasStaggered);
        if (hit) updateTrackerProgress(d, i, t.progress + step, def);
        break;
      }
      case 'resource_action': {
        if (cond.action === 'hinted_set' && tel.hinted) {
          updateTrackerProgress(d, i, t.progress + step, def);
        } else if (cond.action === 'surge_set') {
          // On non-Surge levels, Rainbows serve as clean fallback progress so `crystal-orb:astral-archive` never soft-locks
          const hit = d.surge ? tel.surgeSet : !tel.graceUsed && tel.rainbow;
          if (hit) updateTrackerProgress(d, i, t.progress + step, def);
        }
        break;
      }
      case 'synergy_delta': {
        const base = t.synergyBaseline ?? 0;
        const delta = Math.max(0, (d.synergy[cond.attr] ?? 0) - base);
        if (delta > t.progress) updateTrackerProgress(d, i, delta, def);
        break;
      }
      case 'understudy_mirror': {
        // Mirror left neighbor's fractional progress for HUD feedback while waiting on `ignite_with_left`
        const slot = d.weapons.findIndex(w => w.id === t.weaponId);
        const left = slot > 0 ? d.weapons[slot - 1] : undefined;
        const leftTracker = left ? d.weaponEvolutions.find(x => x.weaponId === left.id) : undefined;
        if (leftTracker && leftTracker.phase === 'charging') {
          const nextAlmost = leftTracker.almostReady;
          if (t.almostReady !== nextAlmost) d.weaponEvolutions[i] = { ...t, almostReady: nextAlmost };
        }
        break;
      }
      default:
        break;
    }
  }
};

/** Evaluate event-driven evolution conditions (procs, tricks, synergy deltas, hazards, resources, mistake resets). */
export const evaluateWeaponEvolutionsOnEvent = (d: Draft, ev: EvoHookEvent) => {
  if (!d.features.has('evolutions') || d.weaponEvolutions.length === 0) return;
  if (d.status !== 'playing' && d.status !== 'pick' && d.status !== 'intermission') return;
  const chargeBonus = evolutionChargeBonusFor(d);
  const step = 1 + chargeBonus;

  for (let i = 0; i < d.weaponEvolutions.length; i++) {
    const t = d.weaponEvolutions[i];
    if (t.phase !== 'charging') continue;
    const def = getWeaponEvolution(t.evoId);
    if (!def) continue;
    const { cond, ownerWeaponId } = effectiveConditionFor(d.weapons, d.weaponEvolutions, t, def);

    if (ev.on === 'mistake') {
      if (
        cond.kind === 'clean_streak' ||
        ('consecutive' in cond && cond.consecutive)
      ) {
        if (t.progress > 0) updateTrackerProgress(d, i, 0, def);
      }
      continue;
    }

    if (ev.on === 'weapon' && cond.kind === 'weapon_proc' && cond.procKind === ev.kind) {
      updateTrackerProgress(d, i, t.progress + step, def);
      continue;
    }

    if (ev.on === 'own' && cond.kind === 'weapon_proc' && cond.procKind === 'own') {
      if (ev.weaponId === t.weaponId || ev.weaponId === ownerWeaponId) {
        updateTrackerProgress(d, i, t.progress + step, def);
      }
      continue;
    }

    if (ev.on === 'trick' && cond.kind === 'trick_payout') {
      if (cond.trick === 'any' || cond.trick === ev.kind) {
        updateTrackerProgress(d, i, t.progress + step, def);
      }
      continue;
    }

    if (ev.on === 'synergy' && cond.kind === 'synergy_delta' && cond.attr === ev.attr) {
      const base = t.synergyBaseline ?? 0;
      const delta = Math.max(0, (d.synergy[cond.attr] ?? 0) - base);
      if (delta > t.progress) updateTrackerProgress(d, i, delta, def);
      continue;
    }

    if (ev.on === 'hazard' && cond.kind === 'hazard_feat') {
      if (cond.hazardKind === 'any' || cond.hazardKind === ev.hazardKind) {
        updateTrackerProgress(d, i, t.progress + step, def);
      }
      continue;
    }

    if (ev.on === 'resource' && cond.kind === 'resource_action' && cond.action === ev.action) {
      if (ev.action === 'ally_evolution_started' && ev.sourceWeaponId === t.weaponId) continue;
      updateTrackerProgress(d, i, t.progress + step, def);
      continue;
    }
  }
};

// Register non-Set evolution listener with fight.ts
setEvoEventHook(evaluateWeaponEvolutionsOnEvent);

/** Advance active evolution timers and post-expiry recharge cooldowns on every fight clock tick. */
export const tickEvolutions = (d: Draft, ms: number) => {
  if (d.weaponEvolutions.length === 0 || ms <= 0) return;

  const expired: { index: number; weaponId: string; evoId: string; def: WeaponEvolutionDef | undefined }[] = [];
  let sourcesDirty = false;

  const next = d.weaponEvolutions.map((e, index) => {
    if (e.phase === 'active') {
      const rem = e.activeRemainingMs - ms;
      if (rem > 0) return { ...e, activeRemainingMs: rem };
      const def = getWeaponEvolution(e.evoId);
      const cd = def?.cooldownMs ?? EVOLUTION_CHASSIS.defaultCooldownMs;
      expired.push({ index, weaponId: e.weaponId, evoId: e.evoId, def });
      sourcesDirty = true;
      return {
        ...e,
        phase: 'cooldown' as const,
        activeRemainingMs: 0,
        cooldownRemainingMs: cd,
        progress: 0,
        almostReady: false,
      };
    }
    if (e.phase === 'cooldown') {
      const rem = e.cooldownRemainingMs - ms;
      if (rem > 0) return { ...e, cooldownRemainingMs: rem };
      const def = getWeaponEvolution(e.evoId);
      const headStart = Math.max(0, e.pendingHeadStart ?? 0);
      const clampedHead = Math.min(Math.max(0, e.target - 1), headStart);
      const effCond = def ? effectiveConditionFor(d.weapons, d.weaponEvolutions, e, def).cond : undefined;
      return {
        ...e,
        phase: 'charging' as const,
        cooldownRemainingMs: 0,
        progress: clampedHead,
        almostReady: isAlmostReady(clampedHead, e.target),
        windowTimes: undefined,
        seenCycleValues: undefined,
        pendingHeadStart: 0,
        ...(effCond?.kind === 'synergy_delta' ? { synergyBaseline: d.synergy[effCond.attr] ?? 0 } : {}),
      };
    }
    return e;
  });

  if (expired.length === 0) {
    d.weaponEvolutions = next;
    return;
  }

  // Snapshot Encore Mask modifiers BEFORE refreshing expired evolutions out of live sources
  const encoreDamage = mods(d).encoreDamage ?? 0;
  const encoreHeadStart = Math.round(mods(d).encoreHeadStart ?? 0);

  d.weaponEvolutions = next;
  if (sourcesDirty) refreshSources(d);

  for (const ex of expired) {
    if (encoreHeadStart > 0 && d.weaponEvolutions[ex.index]) {
      const cur = d.weaponEvolutions[ex.index];
      d.weaponEvolutions[ex.index] = {
        ...cur,
        pendingHeadStart: (cur.pendingHeadStart ?? 0) + encoreHeadStart,
      };
    }
    fireFinale(d, ex.evoId);
    if (encoreDamage > 0) {
      emit(d, 'hit', dealDamage(d, encoreDamage * foeMultiplier(d)), 'Encore!');
      fireOpening(d, ex.evoId);
    }
    emit(d, 'evolution_end', undefined, ex.def?.name ?? ex.evoId);
    enqueue(d, 'evolutionEnd', undefined, undefined, { weaponId: ex.weaponId });
    enqueue(d, 'weaponEvolutionEnd', undefined, undefined, { weaponId: ex.weaponId });
  }
};
