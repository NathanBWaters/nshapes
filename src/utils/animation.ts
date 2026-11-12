import { useState, useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Animation tokens for consistent motion throughout the app.
 * Provides duration and easing constants for a cohesive feel.
 */
export const DURATION = {
  instant: 100,
  fast: 150,
  normal: 250,
  slow: 400,
  slower: 600,
} as const;

export const EASING = {
  easeOutExpo: [0.16, 1, 0.3, 1] as const,
  easeOutBack: [0.34, 1.56, 0.64, 1] as const,
  spring: { tension: 120, friction: 6 },
  bounce: { tension: 180, friction: 12 },
} as const;

/**
 * Hook to detect if the user prefers reduced motion.
 * On native: uses AccessibilityInfo.isReduceMotionEnabled
 * On web: uses prefers-reduced-motion media query
 */
export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Web: use media query
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      setReducedMotion(mediaQuery.matches);

      const handleChange = (event: MediaQueryListEvent) => {
        setReducedMotion(event.matches);
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } else {
      // Native: use AccessibilityInfo
      AccessibilityInfo.isReduceMotionEnabled().then(setReducedMotion);

      const subscription = AccessibilityInfo.addEventListener(
        'reduceMotionChanged',
        setReducedMotion
      );

      return () => subscription.remove();
    }
  }, []);

  return reducedMotion;
}
