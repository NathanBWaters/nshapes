/**
 * Damped Entropy / Pity-Bag Accumulator PRNG for weapon procs ([GP-19]).
 *
 * Replaces pure independent Bernoulli rolls (`rng() * 100 < pct`, which allow
 * frustrating 10–15 Set dry streaks at 14–18%) with a bounded-variance entropy
 * accumulator:
 *   - Each Set adds `effectivePct + uniform(-pct * jitter, +pct * jitter)` to
 *     `procAccum[kind]`.
 *   - Whenever `procAccum[kind] >= 100`, the proc fires and subtracts `100`
 *     (clamped at `>= 0`).
 *
 * Mathematical guarantees:
 *   - Unbiased expectation: `E[jitter] = 0`, so `E[procs / Set] = effectivePct / 100`.
 *   - Hard dry-streak ceiling: at `jitter = 0.25`, an `18%` Lv1 Blast Powder
 *     adds at least `13.5` per Set → guaranteed to fire within at most 8 Sets
 *     (typically 4–6 Sets), while a `34%` Lv5 Blast Powder fires every 2–4 Sets.
 *   - Exposes `getEntropyCharge(state, kind)` (`0..1`) so belt icons can render
 *     a subtle charge ring as a weapon nears its next proc.
 */
import type { WeaponTriggerKind } from '../rules/types';

/** Default symmetric jitter half-width (±25% of effectivePct). */
export const ENTROPY_JITTER_FRACTION = 0.25;

/** Maximum per-channel proc percentage routed through the damped-entropy pity bag ([GP-19]). */
export const ENTROPY_MAX_PCT = 35;

/** Board-proc weapon channels routed through the damped-entropy pity bag. */
export const ENTROPY_CHANNELS = ['explosion', 'laser', 'fire', 'ricochet', 'echo'] as const;

/** True when a weapon proc channel falls in the low-proc band (`0 < pct <= 35%`) using pity-bag entropy. */
export const shouldUseEntropy = (effectivePct: number): boolean =>
  Number.isFinite(effectivePct) && effectivePct > 0 && effectivePct <= ENTROPY_MAX_PCT;

/** Mutable-free accumulator map persisted on RunState (`procAccum`). */
export type ProcAccumulatorState = Readonly<Partial<Record<WeaponTriggerKind | string, number>>>;

export interface EntropyRollResult {
  /** True if at least one trigger fired on this Set */
  triggered: boolean;
  /** Number of triggers fired (0, 1, or >1 when effectivePct >= 100) */
  triggers: number;
  /** Updated accumulator value for `kind` (`>= 0`, `< 100`) */
  nextAccum: number;
  /** Updated immutable state map */
  nextState: ProcAccumulatorState;
  /** Normalized 0..1 charge ratio (`nextAccum / 100`) for UI charge rings */
  chargeRatio: number;
}

const tidy = (n: number): number => Math.round(n * 10000) / 10000;

/** Creates a fresh empty pity-bag accumulator state (0 initial charge on every channel). */
export const createProcAccumulator = (): ProcAccumulatorState => ({});

/**
 * Seeds each low-proc entropy channel with a deterministic stationary phase in `[0, 100)`.
 * Ensures short fights have exact unbiased `E[procs] = K * pct / 100` from Set #1
 * (no artificial dead-zone on low-proc 8–14% weapons) while keeping hard dry-streak ceilings.
 */
export const seedProcAccumulator = (rand: () => number): ProcAccumulatorState => {
  const seeded: Record<string, number> = {};
  for (const ch of ENTROPY_CHANNELS) {
    const u = Math.max(0, Math.min(0.999999999999, rand()));
    seeded[ch] = tidy(u * 100);
  }
  return seeded;
};

/** Returns the current 0..1 charge progress toward the next guaranteed proc. */
export const getEntropyCharge = (state: ProcAccumulatorState, kind: WeaponTriggerKind | string): number => {
  const cur = state[kind] ?? 0;
  if (!Number.isFinite(cur) || cur <= 0) return 0;
  return Math.min(1, cur / 100);
};

/**
 * Advances one weapon proc channel by `effectivePct` using damped entropy.
 * Pure & deterministic for a given `rand` function (`() => [0, 1)`).
 */
export const rollEntropyProc = (
  state: ProcAccumulatorState,
  kind: WeaponTriggerKind | string,
  effectivePct: number,
  rand: () => number,
  jitterFraction: number = ENTROPY_JITTER_FRACTION
): EntropyRollResult => {
  const prev = Math.max(0, state[kind] ?? 0);
  if (!Number.isFinite(effectivePct) || effectivePct <= 0) {
    return {
      triggered: false,
      triggers: 0,
      nextAccum: prev,
      nextState: state,
      chargeRatio: Math.min(1, prev / 100),
    };
  }
  const clampedJitter = Math.max(0, Math.min(0.5, jitterFraction));
  // Symmetric uniform jitter in [-pct * jitter, +pct * jitter], zero mean
  const u = Math.max(0, Math.min(0.999999999999, rand()));
  const jitter = (u * 2 - 1) * effectivePct * clampedJitter;
  const accum = Math.max(0, prev + effectivePct + jitter);
  const triggers = Math.floor(accum / 100);
  const nextAccum = tidy(Math.max(0, accum - triggers * 100));
  const nextState: ProcAccumulatorState = { ...state, [kind]: nextAccum };
  return {
    triggered: triggers > 0,
    triggers,
    nextAccum,
    nextState,
    chargeRatio: Math.min(1, nextAccum / 100),
  };
};

/**
 * Rolls multiple independent weapon proc channels in deterministic order,
 * threading `ProcAccumulatorState` cleanly across all channels.
 */
export const rollEntropyBatch = (
  state: ProcAccumulatorState,
  chances: readonly (readonly [kind: WeaponTriggerKind | string, effectivePct: number])[],
  rand: () => number,
  jitterFraction: number = ENTROPY_JITTER_FRACTION
): {
  nextState: ProcAccumulatorState;
  triggers: Record<string, number>;
} => {
  let cur = state;
  const triggers: Record<string, number> = {};
  for (const [kind, pct] of chances) {
    const res = rollEntropyProc(cur, kind, pct, rand, jitterFraction);
    cur = res.nextState;
    if (res.triggers > 0) triggers[kind] = (triggers[kind] ?? 0) + res.triggers;
  }
  return { nextState: cur, triggers };
};
