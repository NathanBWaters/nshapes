import { useEffect, useRef, useState } from 'react';
import {
  EasingFunction,
  SharedValue,
  cancelAnimation,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useGuardedFrameCallback } from '@/hooks/useGuardedFrameCallback';
import { EASE, MS, OVERLAP } from '@/utils/motion';
import { advancePhase, expApproach, sampleBurstArcX, sampleBurstArcY } from '@/utils/proceduralMotion';

/** Parabolic trajectory specification for one staggered burst particle (zero twinning). */
export interface BurstArcSpec {
  /** Target horizontal travel (px) */
  spreadX: number;
  /** Outward perpendicular horizontal bow (px) */
  bowX: number;
  /** Peak vertical lift above origin (px) */
  liftY: number;
  /** Downward gravity drop at `t = 1` (px) */
  gravityY: number;
  /** Rotation spin across flight (deg) */
  spinDeg: number;
}

/**
 * Five asymmetric parabolic burst arcs (far-left, mid-left, center-high, mid-right, far-right)
 * so Lane 1 & Lane 2 burst icons fan out organically instead of moving as one welded slab.
 */
export const BURST_ARC_PRESETS: readonly [
  BurstArcSpec,
  BurstArcSpec,
  BurstArcSpec,
  BurstArcSpec,
  BurstArcSpec,
] = [
  { spreadX: -22, bowX: -4, liftY: 18, gravityY: 8, spinDeg: -26 },
  { spreadX: -11, bowX: -2, liftY: 25, gravityY: 6, spinDeg: -14 },
  { spreadX: 2, bowX: 3, liftY: 29, gravityY: 5, spinDeg: 9 },
  { spreadX: 13, bowX: 2, liftY: 23, gravityY: 7, spinDeg: 18 },
  { spreadX: 24, bowX: 4, liftY: 16, gravityY: 9, spinDeg: 29 },
] as const;

/**
 * Pure worklet (zero allocations): evaluates one particle's parabolic `(tx, ty, rot, opacity, scale)`
 * from its staggered `0..1` progress and `BurstArcSpec`.
 */
export function sampleBurstParticle(
  progress: number,
  spec: BurstArcSpec
): { tx: number; ty: number; rotDeg: number; opacity: number; scale: number } {
  'worklet';
  const t = Math.max(0, Math.min(1, progress));
  const tx = sampleBurstArcX(t, spec.spreadX, spec.bowX);
  const ty = sampleBurstArcY(t, spec.liftY, spec.gravityY);
  const rotDeg = spec.spinDeg * t;
  const opacity = t <= 0.001 ? 0 : t < 0.14 ? t / 0.14 : t > 0.72 ? (1 - t) / 0.28 : 1;
  const scale = t < 0.18 ? 0.45 + (t / 0.18) * 0.72 : 1.17 - ((t - 0.18) / 0.82) * 0.42;
  return { tx, ty, rotDeg, opacity, scale };
}

interface EffectsDriverOptions {
  animate: boolean;
  /** Ambient oscillator frequency before the first frame */
  initialAmbientHz: number;
  /** Ambient oscillator frequency the current mood calls for */
  ambientHz: number;
  /** 0/1 visibility of each of the three ambient indicators */
  presenceTargets: readonly [number, number, number];
  /** Cross-fade duration of the ambient indicators */
  fadeMs: number;
  activeReaction: string | null;
  /** Changes whenever a reaction (even a repeated one) should replay its burst */
  reactionId: number;
  /** Duration of the one-shot burst */
  burstMs: number;
  /** Burst progress shown when not animating */
  staticBurstProgress: number;
  /** Show the burst still (at `staticBurstProgress`) even while idle life animates: the Effects switch is off */
  stillBurst?: boolean;
  /** How burst progress runs in time (default `EASE.ui`; linear when the overlay shapes it itself) */
  burstEasing?: EasingFunction;
  /**
   * The same reaction again while its burst is still showing: carry on from this
   * progress (the burst at full size) instead of growing again from nothing.
   */
  rehitFrom?: number;
  /** Extra identity that replays the burst when it changes */
  restartKey?: unknown;
  /** Stagger offset (ms) between consecutive burst particles (default `OVERLAP.primaryMs` = 32ms) */
  particleStaggerMs?: number;
  /** Optional lead delay (ms) before particle 0 launches (e.g. synced to `cheerReleaseMs`) */
  particleStartOffsetMs?: number;
}

export type ParticleProgressTuple = readonly [
  SharedValue<number>,
  SharedValue<number>,
  SharedValue<number>,
  SharedValue<number>,
  SharedValue<number>,
];

interface EffectsDriver {
  /** 0 -> 1 progress of the current one-shot burst */
  burstProgress: SharedValue<number>;
  /** 5 staggered per-particle 0 -> 1 progress channels for parabolic burst fan-outs (GPU-only, zero frame loops) */
  particleProgresses: ParticleProgressTuple;
  /** Continuously integrated ambient phase (radians) */
  ambientPhase: SharedValue<number>;
  /** Cross-faded visibility of each ambient indicator */
  presences: readonly [SharedValue<number>, SharedValue<number>, SharedValue<number>];
}

/**
 * Drives a creature's effects overlay: a phase-continuous ambient oscillator, three
 * cross-fading ambient indicators, a one-shot burst that replays per reaction, and
 * five staggered GPU-only particle progress channels for independent parabolic arcs.
 */
export function useEffectsDriver({
  animate,
  initialAmbientHz,
  ambientHz,
  presenceTargets,
  fadeMs,
  activeReaction,
  reactionId,
  burstMs,
  staticBurstProgress,
  stillBurst = false,
  burstEasing,
  rehitFrom,
  restartKey,
  particleStaggerMs = OVERLAP.primaryMs,
  particleStartOffsetMs = 0,
}: EffectsDriverOptions): EffectsDriver {
  const lastBurstRef = useRef<string | null>(null);
  const burstProgress = useSharedValue(0);
  const particle0 = useSharedValue(0);
  const particle1 = useSharedValue(0);
  const particle2 = useSharedValue(0);
  const particle3 = useSharedValue(0);
  const particle4 = useSharedValue(0);
  const ambientPhase = useSharedValue(0);
  const ambientFreqHz = useSharedValue(initialAmbientHz);

  const [targetA, targetB, targetC] = presenceTargets;
  const presenceA = useSharedValue(targetA);
  const presenceB = useSharedValue(targetB);
  const presenceC = useSharedValue(targetC);

  const hasTarget = targetA > 0 || targetB > 0 || targetC > 0;
  const [fadingOut, setFadingOut] = useState(false);
  const prevHasTargetRef = useRef(hasTarget);

  useEffect(() => {
    const prev = prevHasTargetRef.current;
    prevHasTargetRef.current = hasTarget;
    if (!animate || hasTarget) {
      setFadingOut(false);
      return;
    }
    if (prev && !hasTarget) {
      setFadingOut(true);
      const timer = setTimeout(() => setFadingOut(false), fadeMs + 40);
      return () => clearTimeout(timer);
    }
  }, [animate, hasTarget, fadeMs]);

  useGuardedFrameCallback((frameInfo) => {
    'worklet';
    const dtMs = frameInfo.timeSincePreviousFrame;
    if (dtMs === null || dtMs <= 0) return;
    const dt = Math.min(dtMs / 1000, 0.05);
    ambientFreqHz.value = expApproach(ambientFreqHz.value, ambientHz, 8, dt);
    ambientPhase.value = advancePhase(ambientPhase.value, ambientFreqHz.value, dt);
  }, animate && (hasTarget || fadingOut), 'useEffectsDriver');

  useEffect(() => {
    if (!animate) {
      presenceA.value = targetA;
      presenceB.value = targetB;
      presenceC.value = targetC;
      return;
    }
    const cfg = { duration: fadeMs, easing: EASE.drift };
    presenceA.value = withTiming(targetA, cfg);
    presenceB.value = withTiming(targetB, cfg);
    presenceC.value = withTiming(targetC, cfg);
  }, [animate, targetA, targetB, targetC, fadeMs, presenceA, presenceB, presenceC]);

  useEffect(() => {
    const previous = lastBurstRef.current;
    lastBurstRef.current = activeReaction;
    const particles = [particle0, particle1, particle2, particle3, particle4] as const;

    if (!activeReaction) {
      cancelAnimation(burstProgress);
      burstProgress.value = 0;
      for (let i = 0; i < particles.length; i++) {
        cancelAnimation(particles[i]);
        particles[i].value = 0;
      }
      return;
    }
    if (!animate || stillBurst) {
      cancelAnimation(burstProgress);
      burstProgress.value = staticBurstProgress;
      for (let i = 0; i < particles.length; i++) {
        cancelAnimation(particles[i]);
        particles[i].value = Math.max(0, Math.min(1, staticBurstProgress - i * 0.08));
      }
      return;
    }

    const now = burstProgress.value;
    const rehit = rehitFrom !== undefined && previous === activeReaction && now > rehitFrom && now < 1;
    const effectiveDuration = rehit ? Math.round(burstMs * (1 - rehitFrom)) : burstMs;
    const easing = burstEasing ?? EASE.ui;

    burstProgress.value = rehit ? rehitFrom : 0;
    burstProgress.value = withTiming(1, {
      duration: effectiveDuration,
      easing,
    });

    const leadMs = rehit ? 0 : Math.max(0, Math.min(effectiveDuration - MS.feedback, particleStartOffsetMs));
    const availableSpan = Math.max(MS.feedback, effectiveDuration - leadMs);
    const stepMs = Math.min(
      Math.max(0, particleStaggerMs),
      Math.floor((availableSpan * 0.45) / (particles.length - 1))
    );

    for (let i = 0; i < particles.length; i++) {
      const delayMs = leadMs + i * stepMs;
      const durMs = Math.max(MS.feedback, availableSpan - i * stepMs);
      particles[i].value = rehit ? rehitFrom : 0;
      const anim = withTiming(1, { duration: durMs, easing });
      particles[i].value = delayMs > 0 ? withDelay(delayMs, anim) : anim;
    }
  }, [
    activeReaction,
    reactionId,
    animate,
    stillBurst,
    burstProgress,
    particle0,
    particle1,
    particle2,
    particle3,
    particle4,
    burstMs,
    burstEasing,
    rehitFrom,
    staticBurstProgress,
    restartKey,
    particleStaggerMs,
    particleStartOffsetMs,
  ]);

  useEffect(() => {
    return () => {
      cancelAnimation(burstProgress);
      cancelAnimation(particle0);
      cancelAnimation(particle1);
      cancelAnimation(particle2);
      cancelAnimation(particle3);
      cancelAnimation(particle4);
      cancelAnimation(presenceA);
      cancelAnimation(presenceB);
      cancelAnimation(presenceC);
    };
  }, [
    burstProgress,
    particle0,
    particle1,
    particle2,
    particle3,
    particle4,
    presenceA,
    presenceB,
    presenceC,
  ]);

  return {
    burstProgress,
    particleProgresses: [particle0, particle1, particle2, particle3, particle4],
    ambientPhase,
    presences: [presenceA, presenceB, presenceC],
  };
}
