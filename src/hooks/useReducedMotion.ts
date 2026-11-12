import { useState, useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

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
