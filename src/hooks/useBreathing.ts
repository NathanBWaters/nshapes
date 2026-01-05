import { useEffect } from 'react';
import {
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { DURATION } from '@/utils/designSystem';

interface UseBreathingOptions {
  /** Speed of breathing cycle. Default 0.5 = ~4s cycle */
  speed?: number;
  /** Intensity of scale change. Default 0.02 = ±2% */
  intensity?: number;
  /** Whether to animate. Default true */
  enabled?: boolean;
}

/**
 * Hook that provides a subtle scale oscillation for a "breathing" effect.
 * Returns an animated shared value that oscillates between (1 - intensity) and (1 + intensity).
 *
 * @example
 * const breathingScale = useBreathing({ speed: 0.5, intensity: 0.02 });
 * const animatedStyle = useAnimatedStyle(() => ({
 *   transform: [{ scale: breathingScale.value }],
 * }));
 */
export function useBreathing(options: UseBreathingOptions = {}) {
  const { speed = 0.5, intensity = 0.02, enabled = true } = options;

  // Calculate cycle duration from speed (speed 0.5 = 4s, speed 1 = 2s)
  const cycleDuration = Math.round(2000 / speed);

  const scale = useSharedValue(1);

  useEffect(() => {
    if (!enabled) {
      scale.value = 1;
      return;
    }

    // Breathe in (scale up) then breathe out (scale down)
    scale.value = withRepeat(
      withSequence(
        withTiming(1 + intensity, {
          duration: cycleDuration / 2,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(1 - intensity, {
          duration: cycleDuration / 2,
          easing: Easing.inOut(Easing.sin),
        })
      ),
      -1, // Infinite repeat
      false // Don't reverse
    );
  }, [enabled, speed, intensity, cycleDuration, scale]);

  return scale;
}

export default useBreathing;
