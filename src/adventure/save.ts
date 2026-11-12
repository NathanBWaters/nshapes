/** Storage wrapper for the adventure save (MMKV). Keep I/O out of progress.ts. */
import { storage } from '@/utils/storage';
import type { AdventureSave } from './types';
import { createDefaultBountyStats, createNewSave, reconcileUnlocks } from './progress';

const KEY = 'adventure_v2_save';

export const loadAdventureSave = (): AdventureSave => {
  try {
    const raw = storage.getString(KEY);
    if (!raw) return createNewSave();
    const parsed = JSON.parse(raw) as Partial<AdventureSave>;
    if (parsed.version !== 1) return createNewSave();
    const defaults = createNewSave();
    // Fill in fields added after a save was written (including nested maps & arrays)
    return reconcileUnlocks({
      ...defaults,
      ...parsed,
      upgrades: { ...(parsed.upgrades ?? {}) },
      weaponUpgrades: { ...(parsed.weaponUpgrades ?? {}) },
      unlockedEvolutions: Array.isArray(parsed.unlockedEvolutions) ? parsed.unlockedEvolutions : [],
      discoveredEvolutions: Array.isArray(parsed.discoveredEvolutions) ? parsed.discoveredEvolutions : [],
      bountyStats: {
        ...createDefaultBountyStats(),
        ...(parsed.bountyStats ?? {}),
        fighterWins: { ...(parsed.bountyStats?.fighterWins ?? {}) },
      },
    });
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
