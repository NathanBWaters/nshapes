/**
 * useHoverElevation - Hover animation for desktop/web
 * Provides scale, translateY, and shadow animation on hover
 */

import { useCallback } from 'react';
import { Platform } from 'react-native';
import {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { DURATIONS, ANIMATION_PRESETS } from '../theme/animations';

interface UseHoverElevationOptions {
  /** Scale factor on hover (default: 1.02) */
  scale?: number;
  /** Vertical lift on hover (default: -2) */
  translateY?: number;
  /** Animation duration in ms (default: 150) */
  duration?: number;
  /** Shadow opacity when elevated (default: 0.25) */
  elevatedShadowOpacity?: number;
  /** Disabled state - no animation */
  disabled?: boolean;
}

export function useHoverElevation(options: UseHoverElevationOptions = {}) {
  const {
    scale = ANIMATION_PRESETS.hover.scale,
    translateY = ANIMATION_PRESETS.hover.translateY,
    duration = DURATIONS.hover,
    elevatedShadowOpacity = 0.25,
    disabled = false,
  } = options;

  const hovered = useSharedValue(0);

  const onHoverIn = useCallback(() => {
    if (disabled || Platform.OS !== 'web') return;
    hovered.value = withTiming(1, { duration });
  }, [disabled, duration, hovered]);

  const onHoverOut = useCallback(() => {
    if (disabled || Platform.OS !== 'web') return;
    hovered.value = withTiming(0, { duration });
  }, [disabled, duration, hovered]);

  // For Pressable components
  const onMouseEnter = onHoverIn;
  const onMouseLeave = onHoverOut;

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { scale: interpolate(hovered.value, [0, 1], [1, scale]) },
        { translateY: interpolate(hovered.value, [0, 1], [0, translateY]) },
      ],
      // Shadow animation (works on iOS and web)
      shadowOpacity: interpolate(hovered.value, [0, 1], [0.1, elevatedShadowOpacity]),
      shadowRadius: interpolate(hovered.value, [0, 1], [2, 8]),
      shadowOffset: {
        width: 0,
        height: interpolate(hovered.value, [0, 1], [1, 4]),
      },
    };
  });

  // Web-specific cursor style
  const webStyle = Platform.OS === 'web' && !disabled
    ? { cursor: 'pointer' as const }
    : {};

  return {
    onHoverIn,
    onHoverOut,
    onMouseEnter,
    onMouseLeave,
    animatedStyle,
    webStyle,
    /** Raw hovered value for custom animations */
    hovered,
    /** Whether currently hovered */
    isHovered: hovered,
  };
}

export default useHoverElevation;
