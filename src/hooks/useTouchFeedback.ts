/**
 * useTouchFeedback - Haptic feedback hook for delightful touch interactions
 * Provides consistent haptic feedback across the app
 */

import { useCallback } from 'react';
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

type FeedbackType =
  | 'light'      // Subtle feedback for selections, toggles
  | 'medium'     // Standard feedback for button presses
  | 'heavy'      // Strong feedback for important actions
  | 'success'    // Positive notification (match found, purchase complete)
  | 'warning'    // Caution feedback (low health, timer warning)
  | 'error'      // Error feedback (invalid match, insufficient funds)
  | 'selection'; // Selection change feedback

/**
 * Hook providing haptic feedback functions for touch interactions
 */
export function useTouchFeedback() {
  const trigger = useCallback(async (type: FeedbackType = 'medium') => {
    // Haptics only work on native platforms
    if (Platform.OS === 'web') return;

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

        case 'warning':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;

        case 'error':
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;

        case 'selection':
          await Haptics.selectionAsync();
          break;

        default:
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (error) {
      // Silently fail if haptics not available
      console.debug('Haptics not available:', error);
    }
  }, []);

  // Convenience methods for common feedback types
  const light = useCallback(() => trigger('light'), [trigger]);
  const medium = useCallback(() => trigger('medium'), [trigger]);
  const heavy = useCallback(() => trigger('heavy'), [trigger]);
  const success = useCallback(() => trigger('success'), [trigger]);
  const warning = useCallback(() => trigger('warning'), [trigger]);
  const error = useCallback(() => trigger('error'), [trigger]);
  const selection = useCallback(() => trigger('selection'), [trigger]);

  return {
    trigger,
    light,
    medium,
    heavy,
    success,
    warning,
    error,
    selection,
  };
}

/**
 * Simple function to trigger haptic feedback without hook
 * Useful for one-off feedback in event handlers
 */
export async function triggerHaptic(type: FeedbackType = 'medium') {
  if (Platform.OS === 'web') return;

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
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
      case 'selection':
        await Haptics.selectionAsync();
        break;
    }
  } catch (error) {
    // Silently fail
  }
}

export default useTouchFeedback;
