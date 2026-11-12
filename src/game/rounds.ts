/**
 * Round rules of the legacy round-based run: targets, clocks and when a run is won.
 *
 * The run numbers its rounds in two ways and each has its own table. They give
 * DIFFERENT numbers, both are reachable, and this module is the one place that
 * says which applies where:
 *
 *  - by run round (`state.round`, 1-10, then the endless formula): the first
 *    round of a run, a resumed saved game, the dev "change round" / "reset
 *    board" tools, and - for every round - the clock's full-ring time and the
 *    cap on time gained during a round.
 *  - by round in level (1-5): every round entered through "next round" (its
 *    target and starting clock) and the round-progress charts.
 */
import type { AttributeName, PlayerStats } from '@/types';
import {
  ALL_ATTRIBUTES,
  LEGACY_RUN_LEVEL,
  LEVEL_ROUND_REQUIREMENTS,
  LEVEL_SYSTEM,
  ROUND_REQUIREMENTS,
  getEndlessRoundRequirement,
} from '@/utils/gameConfig';

export interface RoundRequirement {
  targetScore: number;
  time: number;
}

/** Target and clock for a round looked up by its number in the run. */
export const getRunRoundRequirement = (round: number): RoundRequirement => {
  if (round > ROUND_REQUIREMENTS.length) {
    return getEndlessRoundRequirement(round);
  }
  return ROUND_REQUIREMENTS.find(r => r.round === round) || { targetScore: 3, time: 60 };
};

/** Target and clock for a round looked up by its position in the 5-round level. */
export const getLevelRoundRequirement = (roundInLevel: number): RoundRequirement => {
  const req = LEVEL_ROUND_REQUIREMENTS.find(r => r.roundInLevel === roundInLevel);
  // Endless rounds run past the table and all get this.
  return req ? { targetScore: req.targetScore, time: req.time } : { targetScore: 10, time: 120 };
};

/** Extra seconds on the clock at round start: weapon bonus plus 3s per heart above 3. */
export const getRoundStartTimeBonus = (totalStats: PlayerStats): number => {
  const excessHealth = Math.max(0, totalStats.health - 3);
  return (totalStats.startingTime || 0) + excessHealth * 3;
};

/** Time gained during a round can never push the clock past this. */
export const getMaxRoundTime = (round: number, totalStats: PlayerStats): number =>
  getRunRoundRequirement(round).time + (totalStats.startingTime || 0);

/** Attributes in play for a round entered through "next round". */
export const getNextRoundAttributes = (isEndlessMode: boolean): AttributeName[] =>
  isEndlessMode ? [...ALL_ATTRIBUTES] : [...LEGACY_RUN_LEVEL.attributes];

/** Enemy tier offered on the enemy selection screen. */
export const getEnemyTierForRound = (round: number): 1 | 2 | 3 | 4 => {
  if (round >= 10) return 4;
  if (round >= 8) return 3;
  if (round >= 5) return 2;
  return 1;
};

// --- Victory -----------------------------------------------------------------

export type RunVictory =
  /** Cleared run round 10+. Checked when a round is completed. */
  | 'final_round_cleared'
  /** Cleared all rounds of the level. Checked when the next round would start (after the shop). */
  | 'level_cleared';

const FINAL_RUN_ROUND = ROUND_REQUIREMENTS.length;

/**
 * Did the run just end in victory? There are two ways to win and they are
 * checked at different moments; endless mode can never be won.
 */
export const getRunVictory = (
  moment: 'round_completed' | 'starting_next_round',
  run: { round: number; roundInLevel: number; isEndlessMode: boolean }
): RunVictory | null => {
  if (run.isEndlessMode) return null;
  if (moment === 'round_completed') {
    return run.round >= FINAL_RUN_ROUND ? 'final_round_cleared' : null;
  }
  return run.roundInLevel + 1 > LEVEL_SYSTEM.roundsPerLevel ? 'level_cleared' : null;
};

// --- Round progress chart ----------------------------------------------------

export interface RoundHistoryEntry {
  round: number;
  target: number;
  actual: number;
}

export interface RoundScore {
  round: number;
  target: number;
  actual?: number;
}

/** Record (or replace) a finished round in the history shown by the progress chart. */
export const recordRoundInHistory = (
  history: RoundHistoryEntry[],
  roundInLevel: number,
  score: number
): RoundHistoryEntry[] => [
  ...history.filter(r => r.round !== roundInLevel),
  { round: roundInLevel, target: getLevelRoundRequirement(roundInLevel).targetScore, actual: score },
];

/**
 * One chart entry per round of the level. `inProgress` overrides the history
 * for the round that is being shown before it was recorded (a failed round).
 */
export const buildRoundScores = (
  history: RoundHistoryEntry[],
  inProgress?: { roundInLevel: number; score: number }
): RoundScore[] =>
  LEVEL_ROUND_REQUIREMENTS.map(req => ({
    round: req.roundInLevel,
    target: req.targetScore,
    actual:
      inProgress && inProgress.roundInLevel === req.roundInLevel
        ? inProgress.score
        : history.find(h => h.round === req.roundInLevel)?.actual,
  }));
