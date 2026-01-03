/**
 * usePlayfulPress - Delightful, bouncy press animation hook
 * Makes buttons and cards feel alive and eager to be interacted with
 */

import { useCallback, useRef } from 'react';
import {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  interpolate,
  runOnJS,
  Extrapolation,
} from 'react-native-reanimated';
import { SPRINGS, ANIMATION_PRESETS } from '../theme/animations';
import { triggerHaptic } from './useTouchFeedback';
import { Platform } from 'react-native';

type PressStyle = 'squish' | 'bounce' | 'eager' | 'gentle' | 'joyful';

interface UsePlayfulPressOptions {
  /** Press animation style (default: 'squish') */
  style?: PressStyle;
  /** Scale when pressed - smaller = more squish (default: 0.92) */
  pressScale?: number;
  /** Scale overshoot on release (default: 1.05) */
  releaseOvershoot?: number;
  /** Enable haptic feedback (default: true on native) */
  haptics?: boolean;
  /** Haptic feedback type */
  hapticType?: 'light' | 'medium' | 'heavy';
  /** Disabled state - no animation */
  disabled?: boolean;
  /** Callback when press starts */
  onPressStart?: () => void;
  /** Callback when press ends */
  onPressEnd?: () => void;
}

const STYLE_CONFIGS: Record<PressStyle, { spring: keyof typeof SPRINGS; scale: number; overshoot: number }> = {
  squish: { spring: 'squish', scale: 0.92, overshoot: 1.04 },
  bounce: { spring: 'bouncy', scale: 0.88, overshoot: 1.08 },
  eager: { spring: 'eager', scale: 0.94, overshoot: 1.06 },
  gentle: { spring: 'gentle', scale: 0.96, overshoot: 1.02 },
  joyful: { spring: 'joyful', scale: 0.9, overshoot: 1.1 },
};

export function usePlayfulPress(options: UsePlayfulPressOptions = {}) {
  const {
    style = 'squish',
    pressScale,
    releaseOvershoot,
    haptics = Platform.OS !== 'web',
    hapticType = 'light',
    disabled = false,
    onPressStart,
    onPressEnd,
  } = options;

  const config = STYLE_CONFIGS[style];
  const scale = pressScale ?? config.scale;
  const overshoot = releaseOvershoot ?? config.overshoot;
  const springConfig = SPRINGS[config.spring];

  const pressed = useSharedValue(0);
  const isPressed = useRef(false);

  const triggerHapticFeedback = useCallback(() => {
    if (haptics) {
      triggerHaptic(hapticType);
    }
  }, [haptics, hapticType]);

  const onPressIn = useCallback(() => {
    if (disabled) return;
    isPressed.current = true;

    // Trigger haptic on press down
    triggerHapticFeedback();
    onPressStart?.();

    // Quick squish down
    pressed.value = withSpring(1, {
      ...springConfig,
      stiffness: springConfig.stiffness * 1.5, // Faster press down
    });
  }, [disabled, springConfig, pressed, triggerHapticFeedback, onPressStart]);

  const onPressOut = useCallback(() => {
    if (disabled || !isPressed.current) return;
    isPressed.current = false;

    onPressEnd?.();

    // Bouncy release with overshoot
    pressed.value = withSequence(
      // Quick release to overshoot
      withSpring(-0.3, {
        ...springConfig,
        stiffness: springConfig.stiffness * 0.8,
      }),
      // Settle back to rest
      withSpring(0, springConfig)
    );
  }, [disabled, springConfig, pressed, onPressEnd]);

  const animatedStyle = useAnimatedStyle(() => {
    // Interpolate scale: 0 = rest, 1 = pressed, -0.3 = overshoot
    const scaleValue = interpolate(
      pressed.value,
      [-0.5, 0, 1],
      [overshoot, 1, scale],
      Extrapolation.CLAMP
    );

    // Subtle rotation wiggle on press for extra life
    const rotateValue = interpolate(
      pressed.value,
      [-0.5, 0, 0.5, 1],
      [0.5, 0, -0.5, 0],
      Extrapolation.CLAMP
    );

    return {
      transform: [
        { scale: scaleValue },
        { rotate: `${rotateValue}deg` },
      ],
    };
  });

  // Style without rotation for simpler uses
  const animatedStyleSimple = useAnimatedStyle(() => {
    const scaleValue = interpolate(
      pressed.value,
      [-0.5, 0, 1],
      [overshoot, 1, scale],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale: scaleValue }],
    };
  });

  return {
    onPressIn,
    onPressOut,
    /** Animated style with scale and subtle rotation */
    animatedStyle,
    /** Animated style with scale only (no rotation) */
    animatedStyleSimple,
    /** Raw pressed value for custom animations */
    pressed,
    /** Whether currently in pressed state */
    isPressed: isPressed.current,
  };
}

/**
 * Hook for card-specific press interactions
 * Includes lift effect and glow-ready state
 */
export function useCardPress(options: Omit<UsePlayfulPressOptions, 'style'> = {}) {
  const pressed = useSharedValue(0);
  const {
    haptics = Platform.OS !== 'web',
    disabled = false,
    onPressStart,
    onPressEnd,
  } = options;

  const triggerHapticFeedback = useCallback(() => {
    if (haptics) {
      triggerHaptic('selection');
    }
  }, [haptics]);

  const onPressIn = useCallback(() => {
    if (disabled) return;
    triggerHapticFeedback();
    onPressStart?.();
    pressed.value = withSpring(1, SPRINGS.eager);
  }, [disabled, pressed, triggerHapticFeedback, onPressStart]);

  const onPressOut = useCallback(() => {
    if (disabled) return;
    onPressEnd?.();
    pressed.value = withSpring(0, SPRINGS.wobbly);
  }, [disabled, pressed, onPressEnd]);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(pressed.value, [0, 1], [1, 1.05]);
    const translateY = interpolate(pressed.value, [0, 1], [0, -8]);
    const rotate = interpolate(pressed.value, [0, 1], [0, 1]);

    return {
      transform: [
        { scale },
        { translateY },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  return {
    onPressIn,
    onPressOut,
    animatedStyle,
    pressed,
  };
}

/**
 * Hook for success/celebration animations
 * Use after a successful action to provide positive feedback
 */
export function useCelebration() {
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);

  const celebrate = useCallback(() => {
    // Pop and wiggle
    scale.value = withSequence(
      withSpring(1.15, SPRINGS.joyful),
      withSpring(0.95, SPRINGS.bouncy),
      withSpring(1.05, SPRINGS.wobbly),
      withSpring(1, SPRINGS.gentle)
    );

    rotation.value = withSequence(
      withTiming(5, { duration: 100 }),
      withTiming(-5, { duration: 100 }),
      withTiming(3, { duration: 80 }),
      withTiming(-3, { duration: 80 }),
      withSpring(0, SPRINGS.gentle)
    );

    // Trigger success haptic
    triggerHaptic('success');
  }, [scale, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  return {
    celebrate,
    animatedStyle,
    scale,
    rotation,
  };
}

/**
 * Hook for error shake animation
 */
export function useErrorShake() {
  const translateX = useSharedValue(0);

  const shake = useCallback(() => {
    translateX.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 50 }),
      withTiming(-4, { duration: 50 }),
      withTiming(4, { duration: 50 }),
      withSpring(0, SPRINGS.gentle)
    );

    triggerHaptic('error');
  }, [translateX]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return {
    shake,
    animatedStyle,
    translateX,
  };
}

export default usePlayfulPress;
