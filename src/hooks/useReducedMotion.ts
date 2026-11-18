import { useState, useEffect } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * Hook to detect if the user prefers reduced motion.
 * On native: uses AccessibilityInfo.isReduceMotionEnabled
 * On web: uses prefers-reduced-motion media query
 */
/** What the browser says right now, so the very first render already knows (false anywhere it cannot be asked). */
const readNow = (): boolean => {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(readNow);

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
