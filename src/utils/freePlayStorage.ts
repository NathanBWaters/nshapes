import { storage } from '@/utils/storage';
import { loadAdventureSave } from '@/adventure/save';
import {
  diffUtcDays,
  isValidDateKey,
  medalRank,
  type FreePlayMedal,
} from '@/adventure/dailySeed';
import type { FreePlayDifficulty } from '@/types';

const FREE_PLAY_DIFFICULTY_KEY = 'free_play_difficulty';
const EXPERIMENTAL_LABS_KEY = 'experimental_labs_enabled';
const FREE_PLAY_RECORDS_KEY = 'free_play_records_v1';

const VALID_DIFFICULTIES: readonly FreePlayDifficulty[] = ['easy', 'medium', 'hard', 'omega'];
const VALID_MEDALS: readonly FreePlayMedal[] = ['none', 'bronze', 'silver', 'gold', 'starfall'];

const isValidDifficulty = (value: unknown): value is FreePlayDifficulty =>
  typeof value === 'string' && VALID_DIFFICULTIES.includes(value as FreePlayDifficulty);

const isValidMedal = (value: unknown): value is FreePlayMedal =>
  typeof value === 'string' && VALID_MEDALS.includes(value as FreePlayMedal);

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

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

// ─── Free Play Zen Endless & Daily 3-Min Score Attack Persistence ([GP-24]) ──

export interface FreePlayZenRecords {
  totalSets: number;
  bestStreak: number;
  fastestTenSetMs: number | null;
}

export interface FreePlayDailyEntry {
  dateKey: string;
  bestSets: number;
  bestSetsPerMin: number;
  bestMistakes: number;
  bestPatternPower: number;
  bestMedal: FreePlayMedal;
  attempts: number;
}

export interface FreePlayRecords {
  version: 1;
  zen: FreePlayZenRecords;
  dailyStreak: number;
  bestDailyStreak: number;
  lastDailyDate: string | null;
  dailyHistory: Record<string, FreePlayDailyEntry>;
}

export const createInitialFreePlayRecords = (): FreePlayRecords => ({
  version: 1,
  zen: {
    totalSets: 0,
    bestStreak: 0,
    fastestTenSetMs: null,
  },
  dailyStreak: 0,
  bestDailyStreak: 0,
  lastDailyDate: null,
  dailyHistory: {},
});

const hydrateFreePlayRecords = (raw: unknown): FreePlayRecords => {
  const defaults = createInitialFreePlayRecords();
  if (!isRecord(raw) || raw.version !== 1) return defaults;
  const zenRaw = isRecord(raw.zen) ? raw.zen : {};
  const zen: FreePlayZenRecords = {
    totalSets: typeof zenRaw.totalSets === 'number' && Number.isFinite(zenRaw.totalSets) ? Math.max(0, Math.floor(zenRaw.totalSets)) : 0,
    bestStreak: typeof zenRaw.bestStreak === 'number' && Number.isFinite(zenRaw.bestStreak) ? Math.max(0, Math.floor(zenRaw.bestStreak)) : 0,
    fastestTenSetMs:
      typeof zenRaw.fastestTenSetMs === 'number' && Number.isFinite(zenRaw.fastestTenSetMs) && zenRaw.fastestTenSetMs > 0
        ? Math.round(zenRaw.fastestTenSetMs)
        : null,
  };
  const dailyHistory: Record<string, FreePlayDailyEntry> = {};
  if (isRecord(raw.dailyHistory)) {
    for (const [key, val] of Object.entries(raw.dailyHistory)) {
      if (!isValidDateKey(key) || !isRecord(val)) continue;
      dailyHistory[key] = {
        dateKey: key,
        bestSets: typeof val.bestSets === 'number' && Number.isFinite(val.bestSets) ? Math.max(0, Math.floor(val.bestSets)) : 0,
        bestSetsPerMin: typeof val.bestSetsPerMin === 'number' && Number.isFinite(val.bestSetsPerMin) ? Math.max(0, val.bestSetsPerMin) : 0,
        bestMistakes: typeof val.bestMistakes === 'number' && Number.isFinite(val.bestMistakes) ? Math.max(0, Math.floor(val.bestMistakes)) : 0,
        bestPatternPower: typeof val.bestPatternPower === 'number' && Number.isFinite(val.bestPatternPower) ? Math.max(100, Math.round(val.bestPatternPower)) : 100,
        bestMedal: isValidMedal(val.bestMedal) ? val.bestMedal : 'none',
        attempts: typeof val.attempts === 'number' && Number.isFinite(val.attempts) ? Math.max(1, Math.floor(val.attempts)) : 1,
      };
    }
  }
  return {
    version: 1,
    zen,
    dailyStreak: typeof raw.dailyStreak === 'number' && Number.isFinite(raw.dailyStreak) ? Math.max(0, Math.floor(raw.dailyStreak)) : 0,
    bestDailyStreak: typeof raw.bestDailyStreak === 'number' && Number.isFinite(raw.bestDailyStreak) ? Math.max(0, Math.floor(raw.bestDailyStreak)) : 0,
    lastDailyDate: typeof raw.lastDailyDate === 'string' && isValidDateKey(raw.lastDailyDate) ? raw.lastDailyDate : null,
    dailyHistory,
  };
};

export const FreePlayRecordsStorage = {
  load: (): FreePlayRecords => {
    try {
      const raw = storage.getString(FREE_PLAY_RECORDS_KEY);
      if (!raw) return createInitialFreePlayRecords();
      return hydrateFreePlayRecords(JSON.parse(raw));
    } catch {
      return createInitialFreePlayRecords();
    }
  },

  save: (records: FreePlayRecords): void => {
    try {
      storage.set(FREE_PLAY_RECORDS_KEY, JSON.stringify(records));
    } catch {
      // ignore storage errors
    }
  },

  clear: (): void => {
    removeKey(FREE_PLAY_RECORDS_KEY);
  },

  /** Persist a Zen Endless Set find, updating Total Sets, Best Streak & Fastest 10-Set Sprint. */
  recordZenSet: (input: {
    streak: number;
    tenSetElapsedMs?: number | null;
  }): { records: FreePlayRecords; newBestStreak: boolean; newFastestTen: boolean } => {
    const prev = FreePlayRecordsStorage.load();
    const cleanStreak = Math.max(1, Math.floor(input.streak));
    const newBestStreak = cleanStreak > prev.zen.bestStreak;
    const validSprint =
      typeof input.tenSetElapsedMs === 'number' &&
      Number.isFinite(input.tenSetElapsedMs) &&
      input.tenSetElapsedMs >= 500
        ? Math.round(input.tenSetElapsedMs)
        : null;
    const newFastestTen =
      validSprint !== null &&
      (prev.zen.fastestTenSetMs === null || validSprint < prev.zen.fastestTenSetMs);

    const next: FreePlayRecords = {
      ...prev,
      zen: {
        totalSets: prev.zen.totalSets + 1,
        bestStreak: Math.max(prev.zen.bestStreak, cleanStreak),
        fastestTenSetMs: newFastestTen ? validSprint : prev.zen.fastestTenSetMs,
      },
    };
    FreePlayRecordsStorage.save(next);
    return { records: next, newBestStreak, newFastestTen };
  },

  /** Persist a completed Daily 3-Min Score Attack run & update consecutive UTC day streak. */
  recordDailyRun: (input: {
    dateKey: string;
    sets: number;
    setsPerMin: number;
    mistakes: number;
    patternPower: number;
    medal: FreePlayMedal;
  }): { records: FreePlayRecords; isNewBest: boolean } => {
    const prev = FreePlayRecordsStorage.load();
    const existing = prev.dailyHistory[input.dateKey];
    const isNewBest =
      !existing ||
      input.sets > existing.bestSets ||
      (input.sets === existing.bestSets && input.patternPower > existing.bestPatternPower);

    const updatedEntry: FreePlayDailyEntry = existing
      ? {
          dateKey: input.dateKey,
          bestSets: Math.max(existing.bestSets, input.sets),
          bestSetsPerMin: Math.max(existing.bestSetsPerMin, input.setsPerMin),
          bestMistakes: isNewBest ? input.mistakes : existing.bestMistakes,
          bestPatternPower: Math.max(existing.bestPatternPower, input.patternPower),
          bestMedal:
            medalRank(input.medal) >= medalRank(existing.bestMedal)
              ? input.medal
              : existing.bestMedal,
          attempts: existing.attempts + 1,
        }
      : {
          dateKey: input.dateKey,
          bestSets: input.sets,
          bestSetsPerMin: input.setsPerMin,
          bestMistakes: input.mistakes,
          bestPatternPower: input.patternPower,
          bestMedal: input.medal,
          attempts: 1,
        };

    let dailyStreak = prev.dailyStreak;
    let lastDailyDate = prev.lastDailyDate;
    if (!lastDailyDate) {
      dailyStreak = 1;
      lastDailyDate = input.dateKey;
    } else if (lastDailyDate !== input.dateKey) {
      const delta = diffUtcDays(lastDailyDate, input.dateKey);
      if (delta === 1) {
        dailyStreak = prev.dailyStreak + 1;
        lastDailyDate = input.dateKey;
      } else if (delta > 1) {
        dailyStreak = 1;
        lastDailyDate = input.dateKey;
      }
      // Replaying an older shared daily date (delta < 0) does not break current streak
    }

    const next: FreePlayRecords = {
      ...prev,
      dailyStreak,
      bestDailyStreak: Math.max(prev.bestDailyStreak, dailyStreak),
      lastDailyDate,
      dailyHistory: {
        ...prev.dailyHistory,
        [input.dateKey]: updatedEntry,
      },
    };
    FreePlayRecordsStorage.save(next);
    return { records: next, isNewBest };
  },
};
