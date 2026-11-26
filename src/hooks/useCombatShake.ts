/**
 * Unified deterministic, viewport-scaled, pattern-varied combat screen shake ([FX-18]).
 *
 * Sakurai Ep. #103 (Screen Shake) & Ep. #047 (Spec #5 & #8):
 *   - Small  (tier 1 / hurt / foe_strike): vertical-only thump (±3 px Y, 0 X, 0° roll, 110 ms)
 *   - Medium (tier 2 / blast / parry):     diagonal X+Y kick (±6 px X, ±4 px Y, 0° roll, 180 ms)
 *   - Large  (tier 3 / perfect parry / KO): multi-axis punch + roll (±10 px X, ±6 px Y, ±0.7°, 260 ms)
 *
 * Uses monotonic ×0.7 geometric decay, alternating deterministic parity (zero `Math.random()`),
 * GPU-only `transform`, `fxMs` slow-motion scaling, and strict `ScreenShakeStorage` +
 * `useReducedMotion()` gating with `cancelAnimation` cleanup.
 */
import { useCallback, useEffect, useRef } from 'react';
import {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { fxMs } from '@/adventure/fx/clock';
import { ScreenShakeStorage, useScreenShakeEnabled } from '@/utils/fxSettingsStorage';
import { EASE } from '@/utils/motion';

export type CombatShakeKind = 'small' | 'medium' | 'large';

/** Monotonic geometric amplitude decay per oscillation leg ([FX-05]/[FX-18]). */
export const COMBAT_SHAKE_DECAY = 0.7;

export interface CombatShakeSpec {
  ampX: number;
  ampY: number;
  rollDeg: number;
  legs: number;
  totalMs: number;
}

export const COMBAT_SHAKE_SPECS: Record<CombatShakeKind, CombatShakeSpec> = {
  small: { ampX: 0, ampY: 3, rollDeg: 0, legs: 4, totalMs: 110 },
  medium: { ampX: 6, ampY: 4, rollDeg: 0, legs: 5, totalMs: 180 },
  large: { ampX: 10, ampY: 6, rollDeg: 0.7, legs: 6, totalMs: 260 },
};

/** Viewport amplitude scale anchored at 375 px phone width, clamped to [0.75, 1.5]. */
export function viewportShakeScale(stageW: number): number {
  if (!Number.isFinite(stageW) || stageW <= 0) return 1;
  return Math.max(0.75, Math.min(1.5, stageW / 375));
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Deterministic monotonic geometric-decay sequence ending at 0.
 * Example: `geometricShakeSequence(10, 5, 0.7, -1)` => `[-10, 7, -4.9, 3.43, -2.4, 0]`.
 */
export function geometricShakeSequence(
  amp: number,
  legs: number,
  decay: number = COMBAT_SHAKE_DECAY,
  sign: 1 | -1 = 1
): number[] {
  if (!Number.isFinite(amp) || amp === 0 || legs <= 0) return [0];
  const out: number[] = [];
  let cur = Math.abs(amp);
  for (let i = 0; i < legs; i++) {
    const dir = i % 2 === 0 ? sign : -sign;
    out.push(round2(dir * cur));
    cur *= decay;
  }
  out.push(0);
  return out;
}

export interface CombatShakePlan {
  kind: CombatShakeKind;
  scale: number;
  totalMs: number;
  durations: number[];
  xs: number[];
  ys: number[];
  rolls: number[];
}

/** Pure deterministic shake trajectory & leg timings (testable without Reanimated). */
export function buildCombatShakePlan(
  kind: CombatShakeKind,
  stageW: number = 375,
  parity: 1 | -1 = 1
): CombatShakePlan {
  const spec = COMBAT_SHAKE_SPECS[kind];
  const scale = viewportShakeScale(stageW);
  const steps = spec.legs + 1; // displaced legs + final return to 0
  const firstLegMs = Math.min(24, Math.max(16, Math.round(spec.totalMs * 0.18)));
  const settleMs = Math.min(48, Math.max(24, Math.round(spec.totalMs * 0.25)));
  const interiorCount = Math.max(1, steps - 2);
  const interiorTotal = Math.max(interiorCount * 16, spec.totalMs - firstLegMs - settleMs);
  const baseInterior = Math.floor(interiorTotal / interiorCount);
  const durations: number[] = [firstLegMs];
  let used = firstLegMs + settleMs;
  for (let i = 0; i < interiorCount; i++) {
    const d = i === interiorCount - 1 ? Math.max(16, spec.totalMs - used) : baseInterior;
    durations.push(d);
    used += d;
  }
  durations.push(settleMs);

  const zeroTrack = () => new Array<number>(steps).fill(0);
  const xs = spec.ampX > 0 ? geometricShakeSequence(spec.ampX * scale, spec.legs, COMBAT_SHAKE_DECAY, parity) : zeroTrack();
  // Cross-phase Y against X on multi-axis hits so diagonal kicks feel jagged, not linear
  const yParity: 1 | -1 = spec.ampX > 0 ? (parity === 1 ? -1 : 1) : parity;
  const ys = spec.ampY > 0 ? geometricShakeSequence(spec.ampY * scale, spec.legs, COMBAT_SHAKE_DECAY, yParity) : zeroTrack();
  const rolls = spec.rollDeg > 0 ? geometricShakeSequence(spec.rollDeg * Math.min(1.25, scale), spec.legs, COMBAT_SHAKE_DECAY, parity) : zeroTrack();

  return { kind, scale, totalMs: spec.totalMs, durations, xs, ys, rolls };
}

export interface UseCombatShakeOptions {
  /** Whether visual effects are enabled (default true). */
  enabled?: boolean;
  /** Explicit reduced-motion override (combined with OS `useReducedMotion()`). */
  reduced?: boolean;
  /** Default viewport width in px when caller omits `stageW` on trigger. */
  stageW?: number;
}

const buildAxisSequence = (values: readonly number[], durations: readonly number[]) => {
  const timings = values.map((toValue, idx) => {
    const easing =
      idx === 0 ? EASE.enter : idx === values.length - 1 ? EASE.enterSoft : EASE.ui;
    return withTiming(toValue, { duration: fxMs(durations[idx] ?? 24), easing });
  });
  return timings.length === 1 ? timings[0] : withSequence(...timings);
};

export function useCombatShake(options: UseCombatShakeOptions = {}) {
  const osReduced = useReducedMotion();
  const prefEnabled = useScreenShakeEnabled();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotateDeg = useSharedValue(0);

  const parityRef = useRef<1 | -1>(-1);
  const optsRef = useRef({
    enabled: options.enabled ?? true,
    reduced: Boolean(options.reduced),
    osReduced: Boolean(osReduced),
    stageW: options.stageW ?? 375,
  });
  optsRef.current = {
    enabled: options.enabled ?? true,
    reduced: Boolean(options.reduced),
    osReduced: Boolean(osReduced),
    stageW: options.stageW ?? 375,
  };

  const resetNow = useCallback(() => {
    cancelAnimation(translateX);
    cancelAnimation(translateY);
    cancelAnimation(rotateDeg);
    translateX.value = 0;
    translateY.value = 0;
    rotateDeg.value = 0;
  }, [translateX, translateY, rotateDeg]);

  // Cancel any in-flight shake immediately when user disables shake/effects/motion or unmounts
  const blocked = !prefEnabled || options.enabled === false || Boolean(options.reduced) || Boolean(osReduced);
  useEffect(() => {
    if (blocked) resetNow();
  }, [blocked, resetNow]);

  useEffect(() => () => {
    resetNow();
  }, [resetNow]);

  const triggerCombatShake = useCallback(
    (kind: CombatShakeKind, stageW?: number): boolean => {
      const { enabled, reduced, osReduced: osRed, stageW: defaultW } = optsRef.current;
      if (!ScreenShakeStorage.get() || !enabled || reduced || osRed) {
        resetNow();
        return false;
      }
      parityRef.current = parityRef.current === 1 ? -1 : 1;
      const plan = buildCombatShakePlan(kind, stageW ?? defaultW, parityRef.current);
      const spec = COMBAT_SHAKE_SPECS[kind];

      cancelAnimation(translateX);
      cancelAnimation(translateY);
      cancelAnimation(rotateDeg);

      if (spec.ampX > 0) {
        translateX.value = buildAxisSequence(plan.xs, plan.durations);
      } else {
        translateX.value = 0;
      }

      if (spec.ampY > 0) {
        translateY.value = buildAxisSequence(plan.ys, plan.durations);
      } else {
        translateY.value = 0;
      }

      if (spec.rollDeg > 0) {
        rotateDeg.value = buildAxisSequence(plan.rolls, plan.durations);
      } else {
        rotateDeg.value = 0;
      }
      return true;
    },
    [resetNow, translateX, translateY, rotateDeg]
  );

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotateDeg.value}deg` },
    ],
  }));

  return {
    shakeStyle,
    triggerCombatShake,
    cancelCombatShake: resetNow,
    shakeValues: { translateX, translateY, rotateDeg },
  };
}
