import { useEffect } from 'react';
import {
  Easing,
  SharedValue,
  useFrameCallback,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { advancePhase, expApproach } from '@/utils/proceduralMotion';

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
  /** Extra identity that replays the burst when it changes */
  restartKey?: unknown;
}

interface EffectsDriver {
  /** 0 -> 1 progress of the current one-shot burst */
  burstProgress: SharedValue<number>;
  /** Continuously integrated ambient phase (radians) */
  ambientPhase: SharedValue<number>;
  /** Cross-faded visibility of each ambient indicator */
  presences: readonly [SharedValue<number>, SharedValue<number>, SharedValue<number>];
}

/**
 * Drives a creature's effects overlay: a phase-continuous ambient oscillator, three
 * cross-fading ambient indicators, and a one-shot burst that replays per reaction.
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
  restartKey,
}: EffectsDriverOptions): EffectsDriver {
  const burstProgress = useSharedValue(0);
  const ambientPhase = useSharedValue(0);
  const ambientFreqHz = useSharedValue(initialAmbientHz);

  const [targetA, targetB, targetC] = presenceTargets;
  const presenceA = useSharedValue(targetA);
  const presenceB = useSharedValue(targetB);
  const presenceC = useSharedValue(targetC);

  useFrameCallback((frameInfo) => {
    const dtMs = frameInfo.timeSincePreviousFrame;
    if (dtMs === null || dtMs <= 0) return;
    const dt = Math.min(dtMs / 1000, 0.05);
    ambientFreqHz.value = expApproach(ambientFreqHz.value, ambientHz, 8, dt);
    ambientPhase.value = advancePhase(ambientPhase.value, ambientFreqHz.value, dt);
  }, animate);

  useEffect(() => {
    if (!animate) {
      presenceA.value = targetA;
      presenceB.value = targetB;
      presenceC.value = targetC;
      return;
    }
    const cfg = { duration: fadeMs, easing: Easing.inOut(Easing.quad) };
    presenceA.value = withTiming(targetA, cfg);
    presenceB.value = withTiming(targetB, cfg);
    presenceC.value = withTiming(targetC, cfg);
  }, [animate, targetA, targetB, targetC, fadeMs, presenceA, presenceB, presenceC]);

  useEffect(() => {
    if (!activeReaction) {
      burstProgress.value = 0;
      return;
    }
    if (!animate) {
      burstProgress.value = staticBurstProgress;
      return;
    }
    burstProgress.value = 0;
    burstProgress.value = withTiming(1, {
      duration: burstMs,
      easing: Easing.out(Easing.cubic),
    });
  }, [activeReaction, reactionId, animate, burstProgress, burstMs, staticBurstProgress, restartKey]);

  return { burstProgress, ambientPhase, presences: [presenceA, presenceB, presenceC] };
}
