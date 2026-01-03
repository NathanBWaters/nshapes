import { useEffect } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const SHIMMER_DURATION = 2500; // 2.5 seconds for full cycle

/**
 * Provides animated shimmer styles for holographic card effects.
 * Returns a reanimated style object for the shimmer overlay.
 */
export function useHolographicShimmer() {
  const shimmerPosition = useSharedValue(0);

  useEffect(() => {
    shimmerPosition.value = withRepeat(
      withTiming(1, {
        duration: SHIMMER_DURATION,
        easing: Easing.linear,
      }),
      -1,    // Repeat infinitely
      false  // Don't reverse
    );
  }, [shimmerPosition]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (shimmerPosition.value - 0.5) * 200 },
      { translateY: (shimmerPosition.value - 0.5) * 150 },
    ],
    opacity: 0.4 + Math.sin(shimmerPosition.value * Math.PI * 2) * 0.2,
  }));

  return shimmerStyle;
}
