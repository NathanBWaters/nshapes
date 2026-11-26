/**
 * Starfall Summit — Summit Rating, GSP-Style Percentile Framing &
 * Spoiler-Free Share Card helpers (`[TP-19]`).
 */
import {
  buildSummitShareUrl,
  computeSummitRating,
  formatSummitShareCard,
  getSummitDailyMutator,
  type SummitRatingBreakdown,
} from '@/adventure/dailySeed';
import type { SpireRun } from '../types';

export type { SummitRatingBreakdown };

/** Compute Summit Rating + GSP-style percentile framing for a completed or active climb. */
export const computeSpireRating = (run: SpireRun, victory: boolean): SummitRatingBreakdown =>
  computeSummitRating({
    floorsCleared: run.stats.floorsCleared,
    victory,
    peakDpm: run.stats.peakDpm,
    parries: run.stats.parries,
    perfectParries: run.stats.perfectParries,
    evolutionsForged: run.stats.evolutionsForged,
    ascension: run.ascension,
    act: run.act,
    endless: run.endless,
  });

/** Build a shareable `?mode=summit&seed=...` (or `&daily=...`) link for a climb. */
export const buildSummitUrlForRun = (run: SpireRun, baseUrl?: string): string =>
  buildSummitShareUrl({
    seed: run.seed,
    dailyDate: run.isDaily ? run.dailyDate : undefined,
    fighter: run.fighter,
    ascension: run.ascension,
    baseUrl,
  });

/** Format a compact, spoiler-free emoji progress & Summit Rating share card. */
export const formatSpireShareCard = (
  run: SpireRun,
  victory: boolean,
  baseUrl?: string
): string => {
  const rating = computeSpireRating(run, victory);
  const dailyMutatorName = run.dailyMutatorId
    ? getSummitDailyMutator(run.dailyMutatorId).name
    : undefined;
  return formatSummitShareCard({
    seed: run.seed,
    fighter: run.fighter,
    ascension: run.ascension,
    act: run.act,
    floor: run.floor,
    floorsCleared: run.stats.floorsCleared,
    victory,
    endless: run.endless,
    peakDpm: run.stats.peakDpm,
    biggestHit: run.stats.biggestHit,
    parries: run.stats.parries,
    perfectParries: run.stats.perfectParries,
    evolutionsForged: run.stats.evolutionsForged,
    isDaily: run.isDaily,
    dailyDate: run.dailyDate,
    dailyMutatorName,
    rating,
    baseUrl,
  });
};
