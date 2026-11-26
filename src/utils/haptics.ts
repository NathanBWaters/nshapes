/**
 * Haptic feedback utility for mobile devices ([AU-21]).
 *
 * All haptic triggers are gated by `HapticsStorage` (persisted in MMKV) and
 * no-op cleanly on web or unsupported devices. Priority-scaled semantic
 * helpers match Sakurai Ep. #032 / #047 impact tiers so tactile pulses align
 * with visual hitstop frames rather than premature card confirmation.
 */
import { Platform } from 'react-native';
import { HapticsStorage } from './hapticsStorage';

export { HapticsStorage };

export interface HapticsModuleLike {
  ImpactFeedbackStyle: {
    Light: unknown;
    Medium: unknown;
    Heavy: unknown;
  };
  NotificationFeedbackType: {
    Success: unknown;
    Error: unknown;
    Warning: unknown;
  };
  impactAsync: (style: unknown) => Promise<void>;
  notificationAsync: (type: unknown) => Promise<void>;
  selectionAsync: () => Promise<void>;
}

// Only import expo-haptics on native platforms
let nativeHaptics: HapticsModuleLike | null = null;
let testHapticsOverride: HapticsModuleLike | null = null;

if (Platform.OS !== 'web') {
  try {
    nativeHaptics = require('expo-haptics') as HapticsModuleLike;
  } catch {
    // expo-haptics not available
  }
}

const getHaptics = (): HapticsModuleLike | null => testHapticsOverride ?? nativeHaptics;

/** Test helper: inject a mock `expo-haptics` module for Jest verification. */
export const __setHapticsModuleForTests = (mod: HapticsModuleLike | null): void => {
  testHapticsOverride = mod;
};

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning';

/**
 * Trigger haptic feedback on supported native devices when HapticsStorage is enabled.
 * No-op on web, when disabled in settings, or on devices without haptic support.
 */
export const triggerHaptic = async (type: HapticType = 'light'): Promise<void> => {
  if (Platform.OS === 'web' || !HapticsStorage.get()) {
    return;
  }
  const Haptics = getHaptics();
  if (!Haptics) {
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
 * Trigger selection haptic (crisp card/control tap), gated by HapticsStorage.
 */
export const selectionHaptic = (): Promise<void> => {
  if (Platform.OS === 'web' || !HapticsStorage.get()) {
    return Promise.resolve();
  }
  const Haptics = getHaptics();
  if (!Haptics) {
    return Promise.resolve();
  }

  try {
    return Haptics.selectionAsync();
  } catch {
    return Promise.resolve();
  }
};

// ─── Priority-scaled combat & reward haptics ([AU-21]) ──────────────────────

/**
 * Tier-scaled impact haptic synced to `onLand(beat)` ([AU-21]):
 *   tier 0 (tap)        -> 'light'
 *   tier 1 (thump)      -> 'medium'
 *   tier 2-3 (slam/MEGA)-> 'heavy'
 */
export const triggerImpactHaptic = (tier: number): Promise<void> => {
  const clamped = Math.max(0, Math.round(tier));
  if (clamped >= 2) return triggerHaptic('heavy');
  if (clamped === 1) return triggerHaptic('medium');
  return triggerHaptic('light');
};

/** Set-Parry haptic: crisp 'medium' on counter/standard parry, 'success' on Perfect Parry. */
export const triggerParryHaptic = (perfect: boolean): Promise<void> =>
  triggerHaptic(perfect ? 'success' : 'medium');

/** Player hurt / enemy strike haptic ('error'). */
export const triggerHurtHaptic = (): Promise<void> => triggerHaptic('error');

/**
 * Lethal knockout haptic synced to Kill-Cam impact frame:
 * fires 'heavy' immediately, plus a celebratory follow-up 'success' pulse (+95 ms)
 * on Boss / Perfect Parry knockouts.
 */
export const triggerKoHaptic = async (isBoss = false): Promise<void> => {
  await triggerHaptic('heavy');
  if (isBoss && Platform.OS !== 'web' && HapticsStorage.get()) {
    setTimeout(() => {
      void triggerHaptic('success');
    }, 95);
  }
};

/**
 * Star stamp haptic synced to `LevelResults` `starLandMs(starIndex)`:
 *   0 (1★) or 1 (2★) -> 'medium'
 *   >= 2 (3★ climax) -> 'heavy' + celebratory 'success' follow-up (+70 ms)
 */
export const triggerStarStampHaptic = async (starIndex: number): Promise<void> => {
  if (starIndex >= 2) {
    await triggerHaptic('heavy');
    if (Platform.OS !== 'web' && HapticsStorage.get()) {
      setTimeout(() => {
        void triggerHaptic('success');
      }, 70);
    }
    return;
  }
  await triggerHaptic('medium');
};

/** Grace near-miss save haptic ('warning'). */
export const triggerGraceHaptic = (): Promise<void> => triggerHaptic('warning');

/** Heal / recovery pulse ('light'). */
export const triggerHealHaptic = (): Promise<void> => triggerHaptic('light');

/** EvolutionCutIn 90 ms slash-flash pulse ('heavy'). */
export const triggerEvolutionHaptic = (): Promise<void> => triggerHaptic('heavy');

/** Victory rank-seal wax-stamp pulse ('light'). */
export const triggerRankSealHaptic = (): Promise<void> => triggerHaptic('light');
