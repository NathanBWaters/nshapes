/**
 * NShapes Haptic Feedback System
 * Platform-aware haptic feedback utilities
 */

import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Haptic feedback utilities with platform safety
 * All functions are safe to call on web - they simply no-op
 */
export const haptics = {
  /**
   * Light impact - for subtle feedback like button hovers
   */
  light: async () => {
    if (Platform.OS === 'web') return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },

  /**
   * Medium impact - for standard button presses, purchases
   */
  medium: async () => {
    if (Platform.OS === 'web') return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },

  /**
   * Heavy impact - for significant actions like level up
   */
  heavy: async () => {
    if (Platform.OS === 'web') return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },

  /**
   * Success notification - for valid matches, successful purchases
   */
  success: async () => {
    if (Platform.OS === 'web') return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },

  /**
   * Error notification - for invalid matches, errors
   */
  error: async () => {
    if (Platform.OS === 'web') return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },

  /**
   * Warning notification - for near-misses, low health
   */
  warning: async () => {
    if (Platform.OS === 'web') return;
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },

  /**
   * Selection feedback - for card/item selection, navigation
   */
  selection: async () => {
    if (Platform.OS === 'web') return;
    await Haptics.selectionAsync();
  },
};

/**
 * Semantic haptic actions for game events
 */
export const gameHaptics = {
  /** Card selected */
  cardSelect: haptics.selection,

  /** Card deselected */
  cardDeselect: haptics.light,

  /** Valid SET match found */
  validMatch: haptics.success,

  /** Invalid match attempt */
  invalidMatch: haptics.error,

  /** Grace used (near-miss saved) */
  graceUsed: haptics.warning,

  /** Grace saved a near-miss (alias for graceUsed) */
  graceSave: haptics.warning,

  /** Button pressed */
  buttonPress: haptics.light,

  /** Weapon purchased */
  purchase: haptics.medium,

  /** Level up */
  levelUp: haptics.heavy,

  /** Round complete */
  roundComplete: haptics.success,

  /** Game over */
  gameOver: haptics.error,

  /** Victory */
  victory: haptics.heavy,

  /** Timer critical (< 5 seconds) */
  timerCritical: haptics.warning,

  /** Card on fire burned */
  cardBurned: haptics.light,

  /** Explosion effect */
  explosion: haptics.medium,

  /** Laser fired */
  laserFired: haptics.medium,

  /** Hint revealed */
  hintRevealed: haptics.selection,

  /** Health lost */
  healthLost: haptics.error,

  /** Health gained */
  healthGained: haptics.success,
};

export default haptics;
