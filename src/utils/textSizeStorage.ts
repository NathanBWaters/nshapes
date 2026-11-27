/**
 * MMKV-backed reactive preference store for user text-size accessibility scaling ([UI-16]).
 * Uses the app's shared MMKV instance from `@/utils/storage` without modifying `storage.ts`,
 * with a safe in-memory fallback for Node CLI scripts and partial test mocks.
 */
import { useSyncExternalStore } from 'react';

export const TEXT_SIZE_STORAGE_KEY = 'text_size_mode';

export type TextSizeMode = 'normal' | 'large';

export const TEXT_SIZE_SCALES: Readonly<Record<TextSizeMode, number>> = {
  normal: 1.0,
  large: 1.15,
};

/** Hard typography readability floor (px) across readable HUD/modal text ([UI-16]). */
export const MIN_READABLE_FONT_PX = 11;

interface StorageLike {
  getString?: (key: string) => string | undefined;
  set?: (key: string, value: string | number | boolean) => void;
}

let cachedStorage: StorageLike | null | undefined;
const getStorage = (): StorageLike | null => {
  if (cachedStorage !== undefined) return cachedStorage;
  try {
    const mod = require('./storage') as { storage?: StorageLike };
    const s = mod?.storage;
    cachedStorage =
      s && typeof s.getString === 'function' && typeof s.set === 'function' ? s : null;
  } catch {
    // Pure Node CLI scripts or mocked storage environments without MMKV.
    cachedStorage = null;
  }
  return cachedStorage;
};

type TextSizeListener = (mode: TextSizeMode) => void;
const listeners = new Set<TextSizeListener>();
let memoryFallback: TextSizeMode = 'normal';

const normalizeMode = (raw: string | undefined): TextSizeMode =>
  raw === 'large' ? 'large' : 'normal';

const notify = (mode: TextSizeMode) => {
  listeners.forEach(fn => {
    try {
      fn(mode);
    } catch {
      // ignore subscriber errors
    }
  });
};

/** Reactive preference helper for Normal (1.0x) vs Large (1.15x) text sizing. */
export const TextSizeStorage = {
  get: (): TextSizeMode => {
    const store = getStorage();
    if (store?.getString) {
      return normalizeMode(store.getString(TEXT_SIZE_STORAGE_KEY));
    }
    return memoryFallback;
  },

  set: (mode: TextSizeMode): void => {
    const next = normalizeMode(mode);
    memoryFallback = next;
    const store = getStorage();
    if (store?.set) {
      store.set(TEXT_SIZE_STORAGE_KEY, next);
    }
    notify(next);
  },

  getScale: (): number => TEXT_SIZE_SCALES[TextSizeStorage.get()],

  subscribe: (listener: TextSizeListener): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export const getTextSize = (): TextSizeMode => TextSizeStorage.get();

export const getTextScale = (): number => TextSizeStorage.getScale();

const subscribeStore = (onStoreChange: () => void): (() => void) =>
  TextSizeStorage.subscribe(() => onStoreChange());

/** Reactive hook returning the active TextSizeMode ('normal' | 'large'). */
export const useTextSize = (): TextSizeMode =>
  useSyncExternalStore(subscribeStore, getTextSize, getTextSize);

/** Reactive hook returning the active font scale multiplier (1.0 | 1.15). */
export const useTextScale = (): number => TEXT_SIZE_SCALES[useTextSize()];

/** Scale a base font size by the active text scale while honoring the >=11px floor. */
export const scaleText = (
  basePx: number,
  scale: number,
  floor: number = MIN_READABLE_FONT_PX
): number => Math.max(floor, Math.round(basePx * scale * 2) / 2);
