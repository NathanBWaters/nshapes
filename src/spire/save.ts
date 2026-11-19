/**
 * Starfall Spire — MMKV persistence & shared Evolution discovery sync.
 *
 * Kept completely isolated under `spire_v1_*` keys so Adventure Mode's save is
 * never corrupted, while newly forged Evolutions in Spire smoothly sync into
 * the player's shared Recipe Guide (`discoveredEvolutions`).
 */
import { storage } from '@/utils/storage';
import { loadAdventureSave, writeAdventureSave } from '@/adventure/save';
import { MAX_ASCENSION } from './data/ascensions';
import type { SpireMeta, SpireRun } from './types';

const RUN_KEY = 'spire_v1_run';
const META_KEY = 'spire_v1_meta';

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
});

export const loadSpireMeta = (): SpireMeta => {
  try {
    const raw = storage.getString(META_KEY);
    if (!raw) return createInitialSpireMeta();
    const parsed = JSON.parse(raw) as Partial<SpireMeta>;
    if (parsed?.version !== 1) return createInitialSpireMeta();
    return { ...createInitialSpireMeta(), ...parsed };
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

export const loadSpireRun = (): SpireRun | null => {
  try {
    const raw = storage.getString(RUN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SpireRun>;
    if (parsed?.version !== 1 || !parsed.map || !parsed.fighter) return null;
    const run = parsed as SpireRun;
    // Defensive guard: if a saved phase references missing room state, land cleanly on the Act map
    const needsFallbackToMap =
      ((run.phase === 'preview' || run.phase === 'fight') && !run.activeEncounter) ||
      (run.phase === 'reward' && !run.reward) ||
      (run.phase === 'shop' && !run.shop) ||
      (run.phase === 'campfire' && !run.campfire) ||
      (run.phase === 'event' && !run.event) ||
      (run.phase === 'treasure' && !run.treasure);
    return needsFallbackToMap ? { ...run, phase: 'map' } : run;
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

export const hasActiveSpireRun = (): boolean => {
  const r = loadSpireRun();
  return !!r && r.phase !== 'defeat' && r.phase !== 'victory';
};

/** Record a finished (or victorious) Spire run into career meta stats. */
export const recordSpireRunEnd = (run: SpireRun, victory: boolean): SpireMeta => {
  const prev = loadSpireMeta();
  const nextWins = { ...prev.fighterWins };
  if (victory) nextWins[run.fighter] = (nextWins[run.fighter] ?? 0) + 1;
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
  };
  writeSpireMeta(next);
  return next;
};

/** Share newly discovered Evolution recipes from Spire back to Adventure's Recipe Guide! */
export const syncSpireDiscoveriesToAdventure = (forgedRecipes: readonly string[]): void => {
  if (!forgedRecipes.length) return;
  try {
    const adv = loadAdventureSave();
    const added = forgedRecipes.filter(id => !adv.discoveredEvolutions.includes(id));
    if (added.length === 0) return;
    writeAdventureSave({
      ...adv,
      discoveredEvolutions: [...adv.discoveredEvolutions, ...added],
    });
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
