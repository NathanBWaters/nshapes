/**
 * Safe MMKV / web-storage persistence for Prism Deck.
 * Completely isolated under `prism_v1_*` keys with quota-safe error tracking
 * and portable Save Backup Code export/import.
 */
import { storage } from '@/utils/storage';
import type { PrismMeta, PrismRun } from './types';
import { VICTORY_ANTE, computeUnlockedDecks } from './data/blinds';
import { diffCalendarDays } from './engine/rng';
import { decodeSaveBackup, encodeSaveBackup, type DecodeBackupResult } from './engine/share';

const RUN_KEY = 'prism_v1_run';
const META_KEY = 'prism_v1_meta';
const RECORDED_RUNS_KEY = 'prism_v1_recorded_runs';
const TUTORIAL_COMPLETED_KEY = 'prism_v1_tutorial_completed';
const BLUEPRINT_ASSIST_KEY = 'prism_v1_blueprint_assist';

interface RecordedRunCheckpoint {
  setsPlayed: number;
  spellsUsed: number;
  recordedVictory: boolean;
}

type RecordedRunsMap = Record<string, RecordedRunCheckpoint>;

const loadRecordedRuns = (): RecordedRunsMap => {
  try {
    const raw = storage.getString(RECORDED_RUNS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as RecordedRunsMap) : {};
  } catch {
    return {};
  }
};

const saveRecordedRuns = (map: RecordedRunsMap): void => {
  try {
    // Keep map bounded to the latest 25 runIds
    const entries = Object.entries(map);
    const bounded = entries.length > 25 ? Object.fromEntries(entries.slice(-25)) : map;
    storage.set(RECORDED_RUNS_KEY, JSON.stringify(bounded));
  } catch {
    // Non-fatal; never overwrite meta storage error
  }
};

let lastStorageError: string | null = null;

/** Last storage write/read error (e.g. browser private-mode quota exceeded), or null if healthy. */
export const getPrismStorageError = (): string | null => lastStorageError;

/** Clear the latched storage error after showing a warning banner to the player. */
export const clearPrismStorageError = (): void => {
  lastStorageError = null;
};

const formatErr = (err: unknown): string =>
  err instanceof Error ? err.message : String(err ?? 'Storage unavailable');

export const createInitialPrismMeta = (): PrismMeta => ({
  version: 1,
  totalRuns: 0,
  victories: 0,
  bestAnte: 0,
  bestEndlessAnte: 0,
  bestSingleSet: 0,
  bestRunScore: 0,
  totalSetsPlayed: 0,
  totalSpellsUsed: 0,
  unlockedDecks: ['classic_prism'],
  deckWins: {},
  dailyStreak: 0,
  bestDailyStreak: 0,
  lastDailyCompletedDate: null,
  completedDailyDates: [],
  dailyBestScores: {},
});

export const loadPrismMeta = (): PrismMeta => {
  try {
    const raw = storage.getString(META_KEY);
    if (!raw) return createInitialPrismMeta();
    const parsed = JSON.parse(raw) as Partial<PrismMeta>;
    if (parsed?.version !== 1) return createInitialPrismMeta();
    const merged: PrismMeta = {
      ...createInitialPrismMeta(),
      ...parsed,
      unlockedDecks: Array.isArray(parsed.unlockedDecks) ? parsed.unlockedDecks : ['classic_prism'],
      completedDailyDates: Array.isArray(parsed.completedDailyDates) ? parsed.completedDailyDates : [],
      deckWins: parsed.deckWins && typeof parsed.deckWins === 'object' ? parsed.deckWins : {},
      dailyBestScores:
        parsed.dailyBestScores && typeof parsed.dailyBestScores === 'object' ? parsed.dailyBestScores : {},
    };
    return {
      ...merged,
      unlockedDecks: computeUnlockedDecks(merged),
    };
  } catch (err) {
    lastStorageError = formatErr(err);
    return createInitialPrismMeta();
  }
};

export const writePrismMeta = (meta: PrismMeta): { ok: boolean; error?: string } => {
  try {
    const normalized: PrismMeta = {
      ...meta,
      unlockedDecks: computeUnlockedDecks(meta),
    };
    storage.set(META_KEY, JSON.stringify(normalized));
    lastStorageError = null;
    return { ok: true };
  } catch (err) {
    const msg = formatErr(err);
    lastStorageError = msg;
    return { ok: false, error: msg };
  }
};

export const loadPrismRun = (): PrismRun | null => {
  try {
    const raw = storage.getString(RUN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PrismRun>;
    if (
      parsed?.version !== 1 ||
      !Array.isArray(parsed.deck) ||
      !Array.isArray(parsed.anteBlinds) ||
      parsed.anteBlinds.length !== 3
    ) {
      return null;
    }
    const run = parsed as PrismRun;
    // Defensive guard: if saved phase references missing room data, land cleanly on blind_select
    if (run.phase === 'shop' && !run.shop) {
      return { ...run, phase: 'blind_select' };
    }
    if (run.phase === 'playing' && (!Array.isArray(run.board) || run.board.length < 3)) {
      return { ...run, phase: 'blind_select' };
    }
    return run;
  } catch (err) {
    lastStorageError = formatErr(err);
    return null;
  }
};

export const writePrismRun = (run: PrismRun | null): { ok: boolean; error?: string } => {
  try {
    if (!run) {
      storage.remove(RUN_KEY);
      // Do NOT clear `lastStorageError` on remove — a preceding `writePrismMeta` quota failure must stay visible!
      return { ok: true };
    }
    storage.set(RUN_KEY, JSON.stringify(run));
    lastStorageError = null;
    return { ok: true };
  } catch (err) {
    const msg = formatErr(err);
    lastStorageError = msg;
    return { ok: false, error: msg };
  }
};

export const hasActivePrismRun = (): boolean => {
  const r = loadPrismRun();
  return !!r && r.phase !== 'defeat' && r.phase !== 'victory';
};

/**
 * Record a completed (or victorious) Prism Deck run into persistent career meta stats,
 * updating deck unlocks and Daily Challenge streak!
 * Tracks per-`runId` checkpoints so Victory → Continue Endless → Defeat adds only
 * post-Victory Endless deltas (never double-counting Sets, Spells, Runs, or Wins).
 */
export const recordPrismRunEnd = (run: PrismRun, victoryOverride?: boolean): PrismMeta => {
  const prev = loadPrismMeta();
  const recordedRuns = loadRecordedRuns();
  const prior = recordedRuns[run.runId];

  const wonAnte8 =
    victoryOverride ??
    (run.phase === 'victory' ||
      run.ante > VICTORY_ANTE ||
      run.anteHistory.some(a => a.ante === VICTORY_ANTE && a.boss === 'cleared'));

  const alreadyRecordedRun = Boolean(prior) || (run.isEndless && !victoryOverride);
  const shouldCountVictory = wonAnte8 && !run.isEndless && !prior?.recordedVictory;

  const setsDelta = Math.max(0, run.stats.setsPlayed - (prior?.setsPlayed ?? 0));
  const spellsDelta = Math.max(0, run.stats.spellsUsed - (prior?.spellsUsed ?? 0));

  const nextDeckWins = { ...prev.deckWins };
  if (shouldCountVictory) {
    nextDeckWins[run.deckId] = (nextDeckWins[run.deckId] ?? 0) + 1;
  }

  let dailyStreak = prev.dailyStreak;
  let bestDailyStreak = prev.bestDailyStreak;
  let lastDailyCompletedDate = prev.lastDailyCompletedDate;
  const completedDailyDates = [...prev.completedDailyDates];
  const dailyBestScores = { ...prev.dailyBestScores };

  if (run.isDaily && run.dailyDate) {
    const prevBest = dailyBestScores[run.dailyDate] ?? 0;
    dailyBestScores[run.dailyDate] = Math.max(prevBest, run.stats.totalScore);
    if (!completedDailyDates.includes(run.dailyDate)) {
      completedDailyDates.push(run.dailyDate);
      completedDailyDates.sort();
      if (!lastDailyCompletedDate) {
        dailyStreak = 1;
      } else {
        const diff = diffCalendarDays(lastDailyCompletedDate, run.dailyDate);
        if (diff === 1) dailyStreak += 1;
        else if (diff > 1) dailyStreak = 1;
      }
      lastDailyCompletedDate = run.dailyDate;
      bestDailyStreak = Math.max(bestDailyStreak, dailyStreak);
    }
  }

  const next: PrismMeta = {
    ...prev,
    totalRuns: prev.totalRuns + (alreadyRecordedRun ? 0 : 1),
    victories: prev.victories + (shouldCountVictory ? 1 : 0),
    bestAnte: Math.max(prev.bestAnte, run.ante),
    bestEndlessAnte: run.isEndless ? Math.max(prev.bestEndlessAnte, run.ante) : prev.bestEndlessAnte,
    bestSingleSet: Math.max(prev.bestSingleSet, run.stats.bestSingleSet),
    bestRunScore: Math.max(prev.bestRunScore, run.stats.totalScore),
    totalSetsPlayed: prev.totalSetsPlayed + setsDelta,
    totalSpellsUsed: prev.totalSpellsUsed + spellsDelta,
    deckWins: nextDeckWins,
    dailyStreak,
    bestDailyStreak,
    lastDailyCompletedDate,
    completedDailyDates,
    dailyBestScores,
  };

  next.unlockedDecks = computeUnlockedDecks(next);
  const writeRes = writePrismMeta(next);
  if (writeRes.ok) {
    saveRecordedRuns({
      ...recordedRuns,
      [run.runId]: {
        setsPlayed: Math.max(prior?.setsPlayed ?? 0, run.stats.setsPlayed),
        spellsUsed: Math.max(prior?.spellsUsed ?? 0, run.stats.spellsUsed),
        recordedVictory: Boolean(prior?.recordedVictory || shouldCountVictory),
      },
    });
  }
  return next;
};

/** Export current persisted Prism Deck meta + optional active run as a portable Backup Code. */
export const exportPrismBackupCode = (includeActiveRun: boolean = true): string => {
  const meta = loadPrismMeta();
  const run = includeActiveRun ? loadPrismRun() : null;
  return encodeSaveBackup(meta, run);
};

/** Validate and import a portable Prism Deck Save Backup Code into storage. */
export const importPrismBackupCode = (code: string): DecodeBackupResult & { storageError?: string } => {
  const decoded = decodeSaveBackup(code);
  if (!decoded.ok) return decoded;
  const metaWrite = writePrismMeta(decoded.meta);
  if (!metaWrite.ok) {
    return { ...decoded, storageError: metaWrite.error };
  }
  if (decoded.run) {
    const runWrite = writePrismRun(decoded.run);
    if (!runWrite.ok) {
      return { ...decoded, storageError: runWrite.error };
    }
  }
  return decoded;
};

export const resetPrismStorage = (): void => {
  try {
    storage.remove(RUN_KEY);
    storage.remove(META_KEY);
    storage.remove(RECORDED_RUNS_KEY);
    storage.remove(TUTORIAL_COMPLETED_KEY);
    storage.remove(BLUEPRINT_ASSIST_KEY);
    lastStorageError = null;
  } catch (err) {
    lastStorageError = formatErr(err);
  }
};
