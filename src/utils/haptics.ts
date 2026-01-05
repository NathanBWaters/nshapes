/**
 * Haptic feedback utility for mobile devices.
 * Provides tactile feedback for user interactions.
 */
import { Platform } from 'react-native';

// Only import expo-haptics on native platforms
let Haptics: typeof import('expo-haptics') | null = null;

if (Platform.OS !== 'web') {
  try {
    Haptics = require('expo-haptics');
  } catch {
    // expo-haptics not available
  }
}

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning';

/**
 * Trigger haptic feedback on supported devices.
 * No-op on web and devices without haptic support.
 */
export const triggerHaptic = async (type: HapticType = 'light'): Promise<void> => {
  if (!Haptics || Platform.OS === 'web') {
    return;
  }

  try {
    switch (type) {
      case 'light':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        break;
      case 'medium':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
      case 'heavy':
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        break;
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'error':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
    }
  } catch {
    // Silently fail if haptics unavailable
  }
};

/**
 * Trigger selection haptic (equivalent to light).
 */
export const selectionHaptic = (): Promise<void> => {
  if (!Haptics || Platform.OS === 'web') {
    return Promise.resolve();
  }

  try {
    return Haptics.selectionAsync();
  } catch {
    return Promise.resolve();
  }
};
