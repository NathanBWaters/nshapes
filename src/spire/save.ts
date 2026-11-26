/**
 * Starfall Summit — MMKV persistence & shared Evolution discovery sync.
 *
 * Legacy storage keys (`spire_v1_run`, `spire_v1_meta`) are intentionally kept
 * unchanged after the Starfall Spire → Starfall Summit rename so zero live
 * player saves break. Cross-mode Evolution discoveries sync transactionally
 * through `mergeDiscoveredEvolutions` in `src/adventure/save.ts`.
 */
import { storage } from '@/utils/storage';
import { mergeDiscoveredEvolutions } from '@/adventure/save';
import { diffUtcDays, isValidDateKey } from '@/adventure/dailySeed';
import { MAX_ASCENSION } from './data/ascensions';
import { computeSpireRating } from './engine/share';
import type { SpireMeta, SpireRun } from './types';

// Legacy MMKV key names preserved for backwards compatibility with existing Starfall Summit saves
const RUN_KEY = 'spire_v1_run';
const META_KEY = 'spire_v1_meta';
const META_BACKUP_KEY = 'spire_v1_meta_unreadable';
const META_IMPORT_BACKUP_KEY = 'spire_v1_meta_pre_import';
const RUN_IMPORT_BACKUP_KEY = 'spire_v1_run_pre_import';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export const createInitialSpireMeta = (): SpireMeta => ({
  version: 1,
  totalRuns: 0,
  victories: 0,
  highestAscensionUnlocked: 0,
  highestAscensionCleared: -1,
  bestFloor: 0,
  bestEndlessFloor: 0,
  bestBiggestHit: 0,
  bestDpm: 0,
  fighterWins: {},
  bestSummitRating: 0,
  dailyStreak: 0,
  bestDailyStreak: 0,
  lastDailyDate: null,
  completedDailyDates: [],
  dailyBestRatings: {},
});

/** Hydrate a parsed SpireMeta record (supports version 1 and best-effort future `version > 1`). */
export const hydrateSpireMeta = (parsed: unknown): SpireMeta | null => {
  if (!isRecord(parsed)) return null;
  const ver = parsed.version;
  if (typeof ver !== 'number' || !Number.isFinite(ver) || ver < 1) return null;
  const defaults = createInitialSpireMeta();
  const fighterWins = isRecord(parsed.fighterWins)
    ? (parsed.fighterWins as SpireMeta['fighterWins'])
    : defaults.fighterWins;
  const completedDailyDates = Array.isArray(parsed.completedDailyDates)
    ? parsed.completedDailyDates.filter((d): d is string => typeof d === 'string' && isValidDateKey(d))
    : [];
  const dailyBestRatings: Record<string, number> = {};
  if (isRecord(parsed.dailyBestRatings)) {
    for (const [k, v] of Object.entries(parsed.dailyBestRatings)) {
      if (isValidDateKey(k) && typeof v === 'number' && Number.isFinite(v)) {
        dailyBestRatings[k] = Math.max(0, Math.round(v));
      }
    }
  }
  return {
    ...defaults,
    ...(parsed as Partial<SpireMeta>),
    version: 1,
    fighterWins,
    bestSummitRating:
      typeof parsed.bestSummitRating === 'number' && Number.isFinite(parsed.bestSummitRating)
        ? Math.max(0, Math.round(parsed.bestSummitRating))
        : 0,
    dailyStreak:
      typeof parsed.dailyStreak === 'number' && Number.isFinite(parsed.dailyStreak)
        ? Math.max(0, Math.floor(parsed.dailyStreak))
        : 0,
    bestDailyStreak:
      typeof parsed.bestDailyStreak === 'number' && Number.isFinite(parsed.bestDailyStreak)
        ? Math.max(0, Math.floor(parsed.bestDailyStreak))
        : 0,
    lastDailyDate:
      typeof parsed.lastDailyDate === 'string' && isValidDateKey(parsed.lastDailyDate)
        ? parsed.lastDailyDate
        : null,
    completedDailyDates,
    dailyBestRatings,
  };
};

export const loadSpireMeta = (): SpireMeta => {
  try {
    const raw = storage.getString(META_KEY);
    if (!raw) return createInitialSpireMeta();
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return createInitialSpireMeta();
    const ver = parsed.version;
    if (typeof ver === 'number' && Number.isFinite(ver) && ver > 1) {
      if (storage.getString(META_BACKUP_KEY) === undefined) storage.set(META_BACKUP_KEY, raw);
      return hydrateSpireMeta(parsed) ?? createInitialSpireMeta();
    }
    if (ver !== 1) return createInitialSpireMeta();
    return hydrateSpireMeta(parsed) ?? createInitialSpireMeta();
  } catch {
    return createInitialSpireMeta();
  }
};

export const writeSpireMeta = (meta: SpireMeta): void => {
  try {
    storage.set(META_KEY, JSON.stringify(meta));
  } catch {
    // storage unavailable
  }
};

/** Hydrate and migrate a parsed SpireRun object (returns `null` if invalid or missing core fields). */
export const hydrateSpireRun = (rawParsed: unknown): SpireRun | null => {
  if (!isRecord(rawParsed)) return null;
  const parsed = rawParsed as Partial<SpireRun> & {
    bonusDamagePerMatch?: number;
    bonusClockSeconds?: number;
    evolutionLabTier?: number;
  };
  if (parsed?.version !== 1 || !parsed.map || !parsed.fighter) return null;

  // Migrate older saved runs that stored flat upgrade counters instead of shared `upgrades`
  const upgrades: Record<string, number> = { ...(parsed.upgrades ?? {}) };
  if (!parsed.upgrades) {
    if (parsed.bonusDamagePerMatch) upgrades.heavy_hitter = parsed.bonusDamagePerMatch;
    if (parsed.bonusClockSeconds) upgrades.hourglass = Math.round(parsed.bonusClockSeconds / 8);
    upgrades.evolution_lab = parsed.evolutionLabTier ?? 1;
  }

  // Migrate older saved shop upgrade offers (`kind` → `upgradeId`)
  const shop = parsed.shop
    ? {
        ...parsed.shop,
        upgrades: parsed.shop.upgrades.map(u => {
          const legacy = u as unknown as { upgradeId?: string; kind?: string; price: number; sold?: boolean; locked?: boolean };
          return {
            upgradeId: (legacy.upgradeId ?? legacy.kind ?? 'heavy_hitter') as SpireRun['shop'] extends null
              ? never
              : NonNullable<SpireRun['shop']>['upgrades'][number]['upgradeId'],
            price: legacy.price,
            sold: legacy.sold,
            ...(legacy.locked ? { locked: true } : {}),
          };
        }),
      }
    : null;

  const seenEvents = Array.isArray(parsed.seenEvents) ? parsed.seenEvents : [];
  const seenEnemies = Array.isArray(parsed.seenEnemies) ? parsed.seenEnemies : [];
  const run: SpireRun = { ...(parsed as SpireRun), upgrades, shop, seenEvents, seenEnemies };
  // Defensive guard: if a saved phase references missing room state, land cleanly on the Act map
  const needsFallbackToMap =
    ((run.phase === 'preview' || run.phase === 'fight') && !run.activeEncounter) ||
    (run.phase === 'reward' && !run.reward) ||
    (run.phase === 'shop' && !run.shop) ||
    (run.phase === 'campfire' && !run.campfire) ||
    (run.phase === 'event' && !run.event) ||
    (run.phase === 'treasure' && !run.treasure);
  return needsFallbackToMap ? { ...run, phase: 'map' } : run;
};

export const loadSpireRun = (): SpireRun | null => {
  try {
    const raw = storage.getString(RUN_KEY);
    if (!raw) return null;
    return hydrateSpireRun(JSON.parse(raw));
  } catch {
    return null;
  }
};

export const writeSpireRun = (run: SpireRun | null): void => {
  try {
    if (!run) storage.remove(RUN_KEY);
    else storage.set(RUN_KEY, JSON.stringify(run));
  } catch {
    // storage unavailable
  }
};

/** Snapshot current Starfall Summit storage before a Save Backup Code restore overwrites it. */
export const backupSpireStorageBeforeOverwrite = (): void => {
  try {
    const rawMeta = storage.getString(META_KEY);
    if (rawMeta) storage.set(META_IMPORT_BACKUP_KEY, rawMeta);
    const rawRun = storage.getString(RUN_KEY);
    if (rawRun) storage.set(RUN_IMPORT_BACKUP_KEY, rawRun);
  } catch {
    // non-fatal
  }
};

export const hasActiveSpireRun = (): boolean => {
  const r = loadSpireRun();
  return !!r && r.phase !== 'defeat' && r.phase !== 'victory';
};

/** Record a finished (or victorious) Summit run into career meta stats. */
export const recordSpireRunEnd = (run: SpireRun, victory: boolean): SpireMeta => {
  const prev = loadSpireMeta();
  const nextWins = { ...prev.fighterWins };
  if (victory) nextWins[run.fighter] = (nextWins[run.fighter] ?? 0) + 1;

  const runRating = computeSpireRating(run, victory).rating;
  const bestSummitRating = Math.max(prev.bestSummitRating ?? 0, runRating);

  let dailyStreak = prev.dailyStreak ?? 0;
  let bestDailyStreak = prev.bestDailyStreak ?? 0;
  let lastDailyDate = prev.lastDailyDate ?? null;
  const completedDailyDates = [...(prev.completedDailyDates ?? [])];
  const dailyBestRatings = { ...(prev.dailyBestRatings ?? {}) };

  if (run.isDaily && run.dailyDate && isValidDateKey(run.dailyDate)) {
    const dayKey = run.dailyDate;
    dailyBestRatings[dayKey] = Math.max(dailyBestRatings[dayKey] ?? 0, runRating);
    if (victory) {
      if (!completedDailyDates.includes(dayKey)) {
        completedDailyDates.push(dayKey);
      }
      if (!lastDailyDate) {
        dailyStreak = 1;
        lastDailyDate = dayKey;
      } else if (lastDailyDate !== dayKey) {
        const delta = diffUtcDays(lastDailyDate, dayKey);
        if (delta === 1) {
          dailyStreak += 1;
          lastDailyDate = dayKey;
        } else if (delta > 1) {
          dailyStreak = 1;
          lastDailyDate = dayKey;
        }
      }
      bestDailyStreak = Math.max(bestDailyStreak, dailyStreak);
    }
  }

  const next: SpireMeta = {
    ...prev,
    totalRuns: prev.totalRuns + (run.endless && !victory ? 0 : 1),
    victories: prev.victories + (victory ? 1 : 0),
    highestAscensionCleared: victory ? Math.max(prev.highestAscensionCleared, run.ascension) : prev.highestAscensionCleared,
    highestAscensionUnlocked: victory
      ? Math.min(MAX_ASCENSION, Math.max(prev.highestAscensionUnlocked, run.ascension + 1))
      : prev.highestAscensionUnlocked,
    bestFloor: Math.max(prev.bestFloor, run.floor),
    bestEndlessFloor: run.endless ? Math.max(prev.bestEndlessFloor, run.floor) : prev.bestEndlessFloor,
    bestBiggestHit: Math.max(prev.bestBiggestHit, run.stats.biggestHit),
    bestDpm: Math.max(prev.bestDpm, run.stats.peakDpm),
    fighterWins: nextWins,
    bestSummitRating,
    dailyStreak,
    bestDailyStreak,
    lastDailyDate,
    completedDailyDates,
    dailyBestRatings,
  };
  writeSpireMeta(next);
  return next;
};

/** Share newly discovered Evolution recipes from Starfall Summit back to Adventure's Recipe Guide transactionally! */
export const syncSpireDiscoveriesToAdventure = (forgedRecipes: readonly string[]): void => {
  if (!forgedRecipes.length) return;
  try {
    mergeDiscoveredEvolutions(forgedRecipes);
  } catch {
    // non-fatal
  }
};

export const resetSpireStorage = (): void => {
  try {
    storage.remove(RUN_KEY);
    storage.remove(META_KEY);
  } catch {
    // storage unavailable
  }
};
