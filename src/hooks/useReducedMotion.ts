/**
 * useReducedMotion - Accessibility hook for motion preferences
 * Respects the user's system preference for reduced motion
 */

import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Hook to detect if the user prefers reduced motion
 * On iOS/Android: Uses AccessibilityInfo.isReduceMotionEnabled
 * On Web: Uses prefers-reduced-motion media query
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Web: Use media query
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mediaQuery.matches);

      const handleChange = (event: MediaQueryListEvent) => {
        setPrefersReducedMotion(event.matches);
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Native: Use AccessibilityInfo
      AccessibilityInfo.isReduceMotionEnabled().then(setPrefersReducedMotion);

      const subscription = AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        setPrefersReducedMotion
      );

      return () => subscription.remove();
    }
  }, []);

  return prefersReducedMotion;
}

/**
 * Returns animation duration based on reduced motion preference
 * If reduced motion is preferred, returns a minimal duration
 */
export function useAnimationDuration(
  normalDuration: number,
  reducedDuration: number = 0
): number {
  const prefersReducedMotion = useReducedMotion();
  return prefersReducedMotion ? reducedDuration : normalDuration;
}

/**
 * Returns spring config based on reduced motion preference
 * If reduced motion is preferred, returns a more damped spring
 */
export function useSpringConfig(
  normalConfig: { damping: number; stiffness: number; mass: number },
  reducedConfig?: { damping: number; stiffness: number; mass: number }
) {
  const prefersReducedMotion = useReducedMotion();

  const defaultReducedConfig = {
    damping: 30,
    stiffness: 500,
    mass: 1,
  };

  return prefersReducedMotion
    ? (reducedConfig ?? defaultReducedConfig)
    : normalConfig;
}

export default useReducedMotion;
