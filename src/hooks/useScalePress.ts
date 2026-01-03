/**
 * useScalePress - Reusable press animation hook
 * Provides scale and opacity animation for button/card press interactions
 */

import { useCallback } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import { ANIMATION_PRESETS, SPRINGS, DURATIONS } from '../theme/animations';

interface UseScalePressOptions {
  /** Scale factor when pressed (default: 0.98) */
  scale?: number;
  /** Opacity when pressed (default: 0.9) */
  opacity?: number;
  /** Animation duration in ms (default: 100) */
  duration?: number;
  /** Use spring physics instead of timing */
  useSpring?: boolean;
  /** Disabled state - no animation */
  disabled?: boolean;
}

export function useScalePress(options: UseScalePressOptions = {}) {
  const {
    scale = ANIMATION_PRESETS.press.scale,
    opacity = ANIMATION_PRESETS.press.opacity,
    duration = DURATIONS.press,
    useSpring: shouldUseSpring = false,
    disabled = false,
  } = options;

  const pressed = useSharedValue(0);

  const onPressIn = useCallback(() => {
    if (disabled) return;

    if (shouldUseSpring) {
      pressed.value = withSpring(1, SPRINGS.press);
    } else {
      pressed.value = withTiming(1, { duration });
    }
  }, [disabled, shouldUseSpring, duration, pressed]);

  const onPressOut = useCallback(() => {
    if (disabled) return;

    if (shouldUseSpring) {
      pressed.value = withSpring(0, SPRINGS.press);
    } else {
      pressed.value = withTiming(0, { duration });
    }
  }, [disabled, shouldUseSpring, duration, pressed]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: interpolate(pressed.value, [0, 1], [1, scale]) },
      ],
      opacity: interpolate(pressed.value, [0, 1], [1, opacity]),
    };
  });

  return {
    onPressIn,
    onPressOut,
    animatedStyle,
    /** Raw pressed value for custom animations */
    pressed,
  };
}

export default useScalePress;
