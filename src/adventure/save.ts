/** Storage wrapper for the adventure save (MMKV). Keep I/O out of progress.ts. */
import { storage } from '@/utils/storage';
import type { AdventureSave } from './types';
import { createNewSave } from './progress';

const KEY = 'adventure_v2_save';

export const loadAdventureSave = (): AdventureSave => {
  try {
    const raw = storage.getString(KEY);
    if (!raw) return createNewSave();
    const parsed = JSON.parse(raw) as AdventureSave;
    if (parsed.version !== 1) return createNewSave();
    // Fill in fields added after a save was written
    return { ...createNewSave(), ...parsed };
  } catch {
    return createNewSave();
  }
};

export const writeAdventureSave = (save: AdventureSave): void => {
  try {
    storage.set(KEY, JSON.stringify(save));
  } catch {
    // storage unavailable (private mode etc.) — progress lives in memory only
  }
};

export const resetAdventureSave = (): void => {
  try {
    storage.remove(KEY);
  } catch {
    // ignore
  }
};
