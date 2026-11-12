import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

/**
 * Hook that provides safe area insets with PWA fallback support.
 *
 * In iOS PWA (standalone) mode, react-native-safe-area-context often returns 0
 * for bottom insets because the viewport behaves differently than Safari.
 * This hook detects PWA mode and applies a fallback padding.
 */
export function usePWASafeAreaInsets() {
  const insets = useSafeAreaInsets();

  // On web, check if we're running as a PWA (standalone mode)
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    // Check for iOS standalone mode (PWA added to home screen)
    const isIOSStandalone = (window.navigator as any).standalone === true;

    // Check for Android/Chrome PWA mode
    const isAndroidPWA = window.matchMedia?.('(display-mode: standalone)').matches;

    const isPWA = isIOSStandalone || isAndroidPWA;

    // If in PWA mode and bottom inset is 0, provide a fallback
    // iOS devices with home indicator need ~34px, older devices need ~20px
    // We use 34px as a safe default for modern iPhones
    if (isPWA && insets.bottom === 0) {
      return {
        ...insets,
        bottom: 34,
      };
    }
  }

  return insets;
}
