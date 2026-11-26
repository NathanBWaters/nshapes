/**
 * MMKV-backed reactive preference stores for screen shake ([FX-18]) and
 * screen flashes ([FX-17]). Uses the shared MMKV instance from `@/utils/storage`
 * without editing `storage.ts`.
 */
import { useEffect, useState } from 'react';
import { storage } from '@/utils/storage';

export const SCREEN_SHAKE_STORAGE_KEY = 'screen_shake_enabled';
export const SCREEN_FLASH_STORAGE_KEY = 'screen_flash_enabled';

type BoolListener = (enabled: boolean) => void;

const shakeListeners = new Set<BoolListener>();
const flashListeners = new Set<BoolListener>();

const notify = (listeners: Set<BoolListener>, value: boolean) => {
  listeners.forEach(fn => {
    try {
      fn(value);
    } catch {
      // ignore subscriber errors
    }
  });
};

let shakeMemoryFallback = true;
let flashMemoryFallback = true;

const hasMmkv = (): boolean =>
  Boolean(storage && typeof storage.getBoolean === 'function' && typeof storage.set === 'function');

/** Screen shake preference helper (default ON; gates `useCombatShake` per [FX-18]). */
export const ScreenShakeStorage = {
  get: (): boolean => {
    if (hasMmkv()) {
      return storage.getBoolean(SCREEN_SHAKE_STORAGE_KEY) ?? true;
    }
    return shakeMemoryFallback;
  },

  set: (enabled: boolean): void => {
    shakeMemoryFallback = enabled;
    if (hasMmkv()) {
      storage.set(SCREEN_SHAKE_STORAGE_KEY, enabled);
    }
    notify(shakeListeners, enabled);
  },

  subscribe: (listener: BoolListener): (() => void) => {
    shakeListeners.add(listener);
    return () => {
      shakeListeners.delete(listener);
    };
  },
};

/** Screen flash preference helper (default ON; gates `ChiaroscuroFlash` per [FX-17]). */
export const ScreenFlashStorage = {
  get: (): boolean => {
    if (hasMmkv()) {
      return storage.getBoolean(SCREEN_FLASH_STORAGE_KEY) ?? true;
    }
    return flashMemoryFallback;
  },

  set: (enabled: boolean): void => {
    flashMemoryFallback = enabled;
    if (hasMmkv()) {
      storage.set(SCREEN_FLASH_STORAGE_KEY, enabled);
    }
    notify(flashListeners, enabled);
  },

  subscribe: (listener: BoolListener): (() => void) => {
    flashListeners.add(listener);
    return () => {
      flashListeners.delete(listener);
    };
  },
};

/** Reactive hook for the Screen Shake user preference. */
export const useScreenShakeEnabled = (): boolean => {
  const [enabled, setEnabled] = useState<boolean>(() => ScreenShakeStorage.get());
  useEffect(() => {
    setEnabled(ScreenShakeStorage.get());
    return ScreenShakeStorage.subscribe(setEnabled);
  }, []);
  return enabled;
};

/** Reactive hook for the Screen Flash user preference. */
export const useScreenFlashEnabled = (): boolean => {
  const [enabled, setEnabled] = useState<boolean>(() => ScreenFlashStorage.get());
  useEffect(() => {
    setEnabled(ScreenFlashStorage.get());
    return ScreenFlashStorage.subscribe(setEnabled);
  }, []);
  return enabled;
};
