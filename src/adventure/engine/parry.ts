/**
 * Set-Parrying engine:
 *  - Evaluates whether a matched Set satisfies a foe's Counter requirement
 *  - Advances calm → windup → golden Perfect Parry warning → unparried strike
 *  - Resolves Counter Parries, Perfect Parries, Stagger ×2, and board-fairness stalls
 *
 * Pure deterministic logic (uses only fight-clock ms and Draft state).
 */
import type { AttributeName, Card } from '@/types';
import type { FoeDef, LevelDef, ParryRequirement, ParrySpec, ParryState } from '../types';
import { PARRY_RULES, resolveParrySpec } from '../data/parry';
import { SKILL_FEAT_POWER } from '../data/weaponPower';
import { addCoins, addPower, addTime, emit, hurt, type Draft } from './fight';
import { allSets, countDifferentAttributes, isRainbow } from './sets';

/** Does this valid 3-card Set satisfy the foe's Counter requirement? */
export const setMatchesCounter = (
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

/** Does the current board contain at least one valid Set matching `req`? */
export const boardHasCounterSet = (
  board: readonly Card[],
  attrs: AttributeName[],
  req: ParryRequirement
): boolean => {
  const sets = allSets(board as Card[], attrs);
  if (req.kind === 'any') return sets.length > 0;
  return sets.some(s => setMatchesCounter(s, attrs, req));
};

/** Build the opening ParryState for a wave's foe (starts calm so the player reads the board first). */
export const initParryState = (level: LevelDef, foe?: FoeDef, windupScale = 1): ParryState | null => {
  const rawSpec = resolveParrySpec(level, foe);
  if (!rawSpec) return null;
  const spec: ParrySpec =
    windupScale !== 1
      ? { ...rawSpec, windupMs: Math.max(4000, Math.round(rawSpec.windupMs * windupScale)) }
      : rawSpec;
  // Opening calm is slightly shorter (~70%) so the first telegraph arrives briskly
  const initialCalm = Math.max(5000, Math.round(spec.cooldownMs * 0.7));
  return {
    spec,
    phase: 'calm',
    msLeft: initialCalm,
    durationMs: initialCalm,
    warned: false,
    stallsUsed: 0,
    parries: 0,
    perfectParries: 0,
  };
};

const effectiveCooldownMs = (d: Draft, spec: ParrySpec): number => {
  if (spec.bossEnrageDeltaMs && d.foeMaxHp > 0 && d.foeHp > 0 && d.foeHp / d.foeMaxHp < 0.5) {
    return Math.max(4000, spec.cooldownMs - spec.bossEnrageDeltaMs);
  }
  return spec.cooldownMs;
};

/** True while the foe is in its golden final Perfect Parry window. */
export const isInPerfectWindow = (p: ParryState | null): boolean =>
  !!p && p.phase === 'windup' && p.msLeft <= p.spec.perfectWindowMs;

/** Damage multiplier from Stagger (×2 while foe is staggered from a Parry). */
export const parryStaggerMultiplier = (p: ParryState | null): number =>
  p?.phase === 'staggered' ? PARRY_RULES.staggerDamageMult : 1;

/** Advance the foe's telegraph timer on every fight clock tick (pauses while frozen). */
export const tickParry = (d: Draft, ms: number): void => {
  const p = d.parry;
  if (!p || d.status !== 'playing') return;

  const nextMs = p.msLeft - ms;

  if (p.phase === 'staggered') {
    if (nextMs <= 0) {
      const cd = effectiveCooldownMs(d, p.spec);
      d.parry = {
        ...p,
        phase: 'calm',
        msLeft: cd,
        durationMs: cd,
        warned: false,
        stallsUsed: 0,
      };
    } else {
      d.parry = { ...p, msLeft: nextMs };
    }
    return;
  }

  if (p.phase === 'calm') {
    if (nextMs <= 0) {
      d.parry = {
        ...p,
        phase: 'windup',
        msLeft: p.spec.windupMs,
        durationMs: p.spec.windupMs,
        warned: false,
        stallsUsed: 0,
      };
    } else {
      d.parry = { ...p, msLeft: nextMs };
    }
    return;
  }

  // phase === 'windup'
  if (nextMs <= 0) {
    // Telegraph completed unparried — the foe strikes!
    applyUnparriedStrike(d, p.spec);
    const cd = effectiveCooldownMs(d, p.spec);
    d.parry = {
      ...p,
      phase: 'calm',
      msLeft: cd,
      durationMs: cd,
      warned: false,
      stallsUsed: 0,
    };
    return;
  }

  let warned = p.warned;
  if (!warned && nextMs <= p.spec.perfectWindowMs) {
    warned = true;
    emit(d, 'parry_warn', Math.ceil(nextMs / 1000), p.spec.attackName);
  }
  d.parry = { ...p, msLeft: nextMs, warned };
};

const applyUnparriedStrike = (d: Draft, spec: ParrySpec): void => {
  emit(d, 'foe_strike', 1, spec.attackName);
  if (spec.penalty === 'time' && d.timeLeft !== null) {
    addTime(d, -(spec.penaltyAmount ?? PARRY_RULES.timePenaltySeconds));
    return;
  }
  if (spec.penalty === 'glancing') {
    // World 1 teaching strikes bruise without unexpectedly ending a beginner's run
    if (d.hearts !== null && d.hearts > 1) hurt(d, spec.penaltyAmount ?? 1);
    return;
  }
  if (d.hearts !== null) hurt(d, spec.penaltyAmount ?? 1);
};

export interface ParryResolution {
  kind: 'parry' | 'perfect' | 'stalled' | null;
  /** Direct multiplier applied to the parrying Set */
  multiplier: number;
  /** Additional stagger multiplier active BEFORE this Set (e.g. already staggered) */
  wasStaggered: boolean;
}

/**
 * Evaluate a valid player Set against the foe's live telegraph.
 * Called inside `applyMatch` BEFORE final Set damage is calculated so a
 * Parry / Perfect Parry immediately boosts that Set's damage AND shows up in
 * the Live Multiplier Ignition breakdown!
 */
export const resolveParryOnSet = (
  d: Draft,
  matched: readonly Card[],
  graceUsed: boolean,
  auto: boolean
): ParryResolution => {
  const p = d.parry;
  if (!p) return { kind: null, multiplier: 1, wasStaggered: false };
  const wasStaggered = p.phase === 'staggered';
  if (auto || p.phase !== 'windup') return { kind: null, multiplier: 1, wasStaggered };

  const counterHit = !graceUsed && setMatchesCounter(matched, d.attributes, p.spec.counter);
  if (!counterHit) {
    // Fairness guard: if this foe demands a specific counter AND none was on the board,
    // clearing cards buys breathing room while refill() guarantees a completing Counter-Set
    // on the next draw. Never cap stalls while the board genuinely lacks any Counter-Set
    // (e.g. hazards physically locking matching pairs) so RNG never forces an unavoidable hit.
    if (
      p.spec.counter.kind !== 'any' &&
      !boardHasCounterSet(d.board, d.attributes, p.spec.counter)
    ) {
      d.parry = {
        ...p,
        msLeft: Math.min(p.durationMs, p.msLeft + PARRY_RULES.fairnessStallMs),
        stallsUsed: p.stallsUsed + 1,
      };
      return { kind: 'stalled', multiplier: 1, wasStaggered };
    }
    return { kind: null, multiplier: 1, wasStaggered };
  }

  const perfect = p.msLeft <= p.spec.perfectWindowMs;
  const isSpecific = p.spec.counter.kind !== 'any';
  const multiplier = perfect
    ? PARRY_RULES.perfectParryMult
    : isSpecific
      ? PARRY_RULES.counterParryMult
      : PARRY_RULES.anyParryMult;
  const anyStaggerMs = (PARRY_RULES as { anyStaggerMs?: number }).anyStaggerMs ?? 2500;
  const staggerMs = perfect
    ? (p.spec.staggerMs ?? PARRY_RULES.perfectStaggerMs)
    : isSpecific
      ? (p.spec.staggerMs ?? PARRY_RULES.counterStaggerMs)
      : anyStaggerMs;
  const bonusCoins = perfect ? PARRY_RULES.perfectParryCoins : PARRY_RULES.parryCoins;

  d.parriesLanded += 1;
  if (perfect) d.perfectParriesLanded += 1;
  // Skill-feat Power surge (GP-01): rewards clean timing even without charms
  addPower(d, perfect ? SKILL_FEAT_POWER.perfectParry : SKILL_FEAT_POWER.counterParry);

  if (staggerMs > 0) {
    d.parry = {
      ...p,
      phase: 'staggered',
      msLeft: staggerMs,
      durationMs: staggerMs,
      warned: false,
      stallsUsed: 0,
      parries: p.parries + 1,
      perfectParries: p.perfectParries + (perfect ? 1 : 0),
    };
  } else {
    const cd = effectiveCooldownMs(d, p.spec);
    d.parry = {
      ...p,
      phase: 'calm',
      msLeft: cd,
      durationMs: cd,
      warned: false,
      stallsUsed: 0,
      parries: p.parries + 1,
    };
  }

  if (bonusCoins > 0) addCoins(d, bonusCoins);
  emit(d, perfect ? 'perfect_parry' : 'parry', multiplier, p.spec.attackName);
  return { kind: perfect ? 'perfect' : 'parry', multiplier, wasStaggered };
};
