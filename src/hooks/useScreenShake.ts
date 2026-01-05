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

type ShakeIntensityPreset = 'light' | 'medium' | 'heavy';

interface ShakeConfig {
  offset: number;
  duration: number;
  iterations: number;
}

const SHAKE_PRESETS: Record<ShakeIntensityPreset, ShakeConfig> = {
  light: { offset: 2, duration: 100, iterations: 2 },
  medium: { offset: 5, duration: 150, iterations: 3 },
  heavy: { offset: 10, duration: 200, iterations: 4 },
};

/**
 * Provides screen shake animation for explosive effects.
 * Returns an animated style and trigger functions.
 *
 * @example
 * const { shakeStyle, triggerShake, shake } = useScreenShake();
 * // Apply shakeStyle to container
 * // Call triggerShake(explosionCount) for dynamic intensity
 * // Call shake('medium') for preset intensity
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

  /**
   * Trigger shake with preset intensity level
   */
  const shake = useCallback(
    (preset: ShakeIntensityPreset = 'medium') => {
      cancelAnimation(translateX);
      cancelAnimation(translateY);

      const config = SHAKE_PRESETS[preset];
      const { offset, duration, iterations } = config;

      // Build shake sequence with decay
      const xSeq: number[] = [];
      const ySeq: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const decay = 1 - i / iterations;
        const currentOffset = offset * decay;

        xSeq.push(currentOffset);
        xSeq.push(-currentOffset);
        ySeq.push(currentOffset * 0.5);
        ySeq.push(-currentOffset * 0.5);
      }
      xSeq.push(0);
      ySeq.push(0);

      const oscillationDuration = duration / (iterations * 2 + 1);

      const makeTimings = (seq: number[]) =>
        seq.map((val, i) =>
          withTiming(val, {
            duration: oscillationDuration,
            easing: i === seq.length - 1 ? Easing.out(Easing.cubic) : Easing.linear,
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

  return {
    shakeStyle,
    triggerShake,
    shake,
    translateX,
    translateY,
  };
}
