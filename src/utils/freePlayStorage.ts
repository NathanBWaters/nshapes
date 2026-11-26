import { storage } from '@/utils/storage';
import { loadAdventureSave } from '@/adventure/save';
import type { FreePlayDifficulty } from '@/types';

const FREE_PLAY_DIFFICULTY_KEY = 'free_play_difficulty';
const EXPERIMENTAL_LABS_KEY = 'experimental_labs_enabled';

const VALID_DIFFICULTIES: readonly FreePlayDifficulty[] = ['easy', 'medium', 'hard', 'omega'];

const isValidDifficulty = (value: unknown): value is FreePlayDifficulty =>
  typeof value === 'string' && VALID_DIFFICULTIES.includes(value as FreePlayDifficulty);

const removeKey = (key: string): void => {
  const s = storage as { remove?: (k: string) => unknown; delete?: (k: string) => unknown };
  try {
    if (typeof s.remove === 'function') s.remove(key);
    else if (typeof s.delete === 'function') s.delete(key);
  } catch {
    // ignore storage errors
  }
};

/**
 * Remembers the player's last chosen Free Play difficulty.
 * Newcomers with 0 stars (or before clearing 1-5 Number) default to `'easy'` (2 traits);
 * once `1-5` is cleared, newcomers default to `'medium'` (3 traits).
 */
export const FreePlayDifficultyStorage = {
  get: (): FreePlayDifficulty | null => {
    try {
      const stored = storage.getString(FREE_PLAY_DIFFICULTY_KEY);
      return isValidDifficulty(stored) ? stored : null;
    } catch {
      return null;
    }
  },

  set: (difficulty: FreePlayDifficulty): void => {
    try {
      storage.set(FREE_PLAY_DIFFICULTY_KEY, difficulty);
    } catch {
      // ignore storage errors
    }
  },

  clear: (): void => {
    removeKey(FREE_PLAY_DIFFICULTY_KEY);
  },

  getDefault: (stars?: Record<string, number>): FreePlayDifficulty => {
    const saved = FreePlayDifficultyStorage.get();
    if (saved) return saved;
    try {
      const starMap = stars ?? loadAdventureSave().stars;
      return (starMap['1-5'] ?? 0) >= 1 ? 'medium' : 'easy';
    } catch {
      return 'easy';
    }
  },
};

/**
 * Opt-in Labs flag controlling whether experimental side-modes (e.g. Prism Deck)
 * appear on the Main Menu. Off by default on Day-1 launch.
 */
export const LabsStorage = {
  get: (): boolean => {
    try {
      return storage.getBoolean(EXPERIMENTAL_LABS_KEY) ?? false;
    } catch {
      return false;
    }
  },

  set: (enabled: boolean): void => {
    try {
      storage.set(EXPERIMENTAL_LABS_KEY, enabled);
    } catch {
      // ignore storage errors
    }
  },

  clear: (): void => {
    removeKey(EXPERIMENTAL_LABS_KEY);
  },

  isEnabled: (urlLabsParam?: boolean): boolean => Boolean(urlLabsParam) || LabsStorage.get(),
};
