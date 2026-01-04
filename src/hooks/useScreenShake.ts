import { useCallback } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

const MAX_INTENSITY = 8; // Max pixel displacement
const BASE_DURATION = 300; // Total shake duration ms
const DECAY_RATE = 0.85; // How quickly shake decays

/**
 * Provides screen shake animation for explosive effects.
 * Returns an animated style and trigger function.
 *
 * @example
 * const { shakeStyle, triggerShake } = useScreenShake();
 * // Apply shakeStyle to container
 * // Call triggerShake(explosionCount) when explosions occur
 */
export function useScreenShake() {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const triggerShake = useCallback(
    (intensity: number) => {
      'worklet';
      cancelAnimation(translateX);
      cancelAnimation(translateY);

      // Scale: 1 card = mild, 5+ cards = max
      const scaledIntensity = Math.min(intensity / 5, 1) * MAX_INTENSITY;
      const oscillations = Math.min(3 + Math.floor(intensity / 2), 8);
      const oscillationDuration = BASE_DURATION / oscillations;

      // Build decaying oscillation sequence
      const xSeq: number[] = [];
      const ySeq: number[] = [];
      let current = scaledIntensity;

      for (let i = 0; i < oscillations; i++) {
        xSeq.push(current * (i % 2 === 0 ? 1 : -1) * (0.8 + Math.random() * 0.4));
        ySeq.push(current * (i % 2 === 0 ? -1 : 1) * (0.6 + Math.random() * 0.4));
        current *= DECAY_RATE;
      }
      xSeq.push(0);
      ySeq.push(0);

      const makeTimings = (seq: number[]) =>
        seq.map((val, i) =>
          withTiming(val, {
            duration: oscillationDuration,
            easing: i === seq.length - 1 ? Easing.out(Easing.cubic) : Easing.inOut(Easing.quad),
          })
        );

      translateX.value = withSequence(...makeTimings(xSeq));
      translateY.value = withSequence(...makeTimings(ySeq));
    },
    [translateX, translateY]
  );

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
  }));

  return { shakeStyle, triggerShake };
}
