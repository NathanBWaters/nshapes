import { useEffect } from 'react';
import {
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';

interface UseFloatingOptions {
  /** Amplitude of floating in pixels. Default 4px */
  amplitude?: number;
  /** Speed of floating cycle. Default 0.3 = ~6.7s cycle */
  speed?: number;
  /** Offset in ms for staggering multiple floating elements. Default 0 */
  offset?: number;
  /** Whether to animate. Default true */
  enabled?: boolean;
}

/**
 * Hook that provides a gentle Y-axis floating motion.
 * Returns an animated translateY value that oscillates like floating on water.
 *
 * @example
 * const floatingY = useFloating({ amplitude: 4, speed: 0.3, offset: 500 });
 * const animatedStyle = useAnimatedStyle(() => ({
 *   transform: [{ translateY: floatingY.value }],
 * }));
 */
export function useFloating(options: UseFloatingOptions = {}) {
  const { amplitude = 4, speed = 0.3, offset = 0, enabled = true } = options;

  // Calculate cycle duration from speed (speed 0.3 = ~6.7s, speed 1 = 2s)
  const cycleDuration = Math.round(2000 / speed);

  const translateY = useSharedValue(0);

  useEffect(() => {
    if (!enabled) {
      translateY.value = 0;
      return;
    }

    // Float up, then float down - dreamy sine wave motion
    const floatAnimation = withRepeat(
      withSequence(
        withTiming(-amplitude, {
          duration: cycleDuration / 2,
          easing: Easing.inOut(Easing.sin),
        }),
        withTiming(amplitude, {
          duration: cycleDuration / 2,
          easing: Easing.inOut(Easing.sin),
        })
      ),
      -1, // Infinite repeat
      false // Don't reverse
    );

    // Apply offset delay if specified
    if (offset > 0) {
      translateY.value = withDelay(offset, floatAnimation);
    } else {
      translateY.value = floatAnimation;
    }
  }, [enabled, amplitude, speed, offset, cycleDuration, translateY]);

  return translateY;
}

export default useFloating;
