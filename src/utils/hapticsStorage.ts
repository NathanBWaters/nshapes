/**
 * MMKV-backed reactive preference store for tactile haptic feedback ([AU-21]).
 * Uses the app's shared MMKV instance from `@/utils/storage` without modifying `storage.ts`.
 */
import { storage } from '@/utils/storage';

export const HAPTICS_STORAGE_KEY = 'haptics_enabled';

type BoolListener = (enabled: boolean) => void;
const hapticsListeners = new Set<BoolListener>();

const notifyHapticsListeners = (enabled: boolean) => {
  hapticsListeners.forEach(fn => {
    try {
      fn(enabled);
    } catch {
      // ignore subscriber errors
    }
  });
};

let memoryFallback = true;

const hasMmkv = (): boolean =>
  Boolean(storage && typeof storage.getBoolean === 'function' && typeof storage.set === 'function');

/** Haptics preference helper (default ON; gates all `src/utils/haptics.ts` triggers). */
export const HapticsStorage = {
  get: (): boolean => {
    if (hasMmkv()) {
      return storage.getBoolean(HAPTICS_STORAGE_KEY) ?? true;
    }
    return memoryFallback;
  },

  set: (enabled: boolean): void => {
    memoryFallback = enabled;
    if (hasMmkv()) {
      storage.set(HAPTICS_STORAGE_KEY, enabled);
    }
    notifyHapticsListeners(enabled);
  },

  subscribe: (listener: BoolListener): (() => void) => {
    hapticsListeners.add(listener);
    return () => {
      hapticsListeners.delete(listener);
    };
  },
};
