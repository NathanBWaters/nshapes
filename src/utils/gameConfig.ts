/**
 * Centralized Game Configuration
 * All game balance values and rules in one place for easy tweaking.
 */

import type { AttributeName, AdventureDifficulty } from '../types';
import { EFFECT_CAPS, STAT_TO_CAP_TYPE } from '../game/effectCaps';

export const STARTING_STATS = {
  hints: 0, // Start with 0 hints
  maxHints: 3, // Maximum hints player can hold
  health: 3,
  maxHealth: 3,
  money: 0,
  fieldSize: 12,
  freeRerolls: 0,
  graces: 0,
  maxGraces: 5, // Maximum graces player can hold

  // Weapon effect stats (defaults to 0)
  explosionChance: 0,
  explosionDamage: 0,
  laserDamage: 0,
  ricochetDamage: 0,
  burnDamage: 0,
  autoHintChance: 0,
  autoHintInterval: 0, // ms reduction from 15s base wait (higher = faster hints)
  boardGrowthChance: 0,
  boardGrowthAmount: 1,
  fireSpreadChance: 0,
  graceGainChance: 0,
  healingChance: 0,
  hintGainChance: 0,
  xpGainChance: 0,
  coinGainChance: 0,
  timeGainChance: 0,
  timeGainAmount: 10, // 10 seconds default when triggered
  timeGainTriggerCap: 5, // Max time gains per round
  laserChance: 0,
  startingTime: 0, // Additional starting time in seconds
  ricochetChance: 0,
  ricochetChainChance: 0,
  enhancedHintChance: 0,    // % chance for autohint to show 2 cards instead of 1
  echoChance: 0,            // % chance to auto-match another set on player match
  chainReactionChance: 0,   // % chance for echo to trigger twice (2 additional matches)
} as const;

export const BOARD = {
  initialCardCount: 12,
} as const;

export const ECONOMY = {
  baseRerollCost: 5,
  /** A paid reroll in a run multiplies the next reroll's cost by this. */
  rerollCostGrowth: 1.2,
  /** A paid reroll in the dev store adds this to the next reroll's cost. */
  rerollCostIncrement: 2,
} as const;

/** Where a reroll is being bought; the two places raise the price differently. */
export type RerollPricing = 'run' | 'devStore';

/** The reroll cost after a paid reroll. */
export const getNextRerollCost = (currentCost: number, pricing: RerollPricing): number =>
  pricing === 'run'
    ? Math.max(1, Math.round(currentCost * ECONOMY.rerollCostGrowth))
    : currentCost + ECONOMY.rerollCostIncrement;

/**
 * The reroll cost a run's shop resets to at the start of a round.
 * Linear from $1 at round 1 to $20 at round 10 (R2=$3, R3=$5, ... R9=$17), continuing past 10.
 */
export const getBaseRerollCostForRound = (round: number): number =>
  Math.max(1, Math.round(1 + (round - 1) * (20 - 1) / (10 - 1)));

/**
 * Get rarity chances that scale by round.
 * Round 1: Lower epic/legendary chances, higher common
 * Round 10: Higher epic/legendary chances, lower common
 * Linear interpolation between rounds.
 */
export const getRarityChancesForRound = (round: number): { common: number; rare: number; epic: number; legendary: number } => {
  // Clamp round between 1 and 10
  const clampedRound = Math.max(1, Math.min(10, round));

  // Calculate progress from round 1 (0) to round 10 (1)
  const progress = (clampedRound - 1) / 9;

  // Legendary: 0.375% at round 1, 3% at round 10 (halved from original to make stretch goals more valuable)
  const legendaryStart = 0.00375;
  const legendaryEnd = 0.03;
  const legendary = legendaryStart + (legendaryEnd - legendaryStart) * progress;

  // Epic: 1.5% at round 1, 9% at round 10 (halved from original to make stretch goals more valuable)
  const epicStart = 0.015;
  const epicEnd = 0.09;
  const epic = epicStart + (epicEnd - epicStart) * progress;

  // Rare: 15% at round 1, 30% at round 10
  const rareStart = 0.15;
  const rareEnd = 0.30;
  const rare = rareStart + (rareEnd - rareStart) * progress;

  // Common: remainder
  const common = 1 - legendary - epic - rare;

  return { common, rare, epic, legendary };
};

// The cap table and everything derived from it live in game/effectCaps.ts
// (a module without imports, so src/types.ts can derive its types from the table).
export {
  EFFECT_CAPS,
  EFFECT_CAP_TYPES,
  DEFAULT_EFFECT_CAPS,
  STAT_TO_CAP_TYPE,
  getMainStatForCap,
} from '../game/effectCaps';
export type { EffectCapType, EffectCaps, CappedStat } from '../game/effectCaps';

/**
 * Get the effective (capped) value for an accumulated stat
 * @param accumulated The total accumulated value from all sources
 * @param cap The maximum effective value
 * @returns The effective value (min of accumulated and cap)
 */
export const getEffectiveStat = (accumulated: number, cap: number): number => {
  return Math.min(accumulated, cap);
};

/**
 * Check if a stat is at or over its cap
 */
export const isStatCapped = (accumulated: number, cap: number): boolean => {
  return accumulated >= cap;
};

/**
 * Check if the player is close enough to a cap to warrant showing it.
 * Returns true if:
 * - currentValue >= cap * 0.8 (within 20% of cap), OR
 * - currentValue >= cap - 2 (within 2 points of cap)
 *
 * This prevents showing max info when players are far from the cap,
 * which can be confusing for stats they have nothing in.
 */
export const shouldShowCapInfo = (currentValue: number, cap: number): boolean => {
  const withinPercentage = currentValue >= cap * 0.8;  // Within 20%
  const withinPoints = currentValue >= cap - 2;        // Within 2 points
  return withinPercentage || withinPoints;
};

/**
 * Get cap info for a stat if it has one
 * Returns null if the stat is not capped
 */
export const getCapInfoForStat = (statKey: string, playerCaps?: Record<string, number>): { cap: number } | null => {
  const capType = STAT_TO_CAP_TYPE[statKey];
  if (!capType) return null;
  // If player has custom caps, use those
  return { cap: playerCaps?.[capType] ?? EFFECT_CAPS[capType].defaultCap };
};

export const MATCH_REWARDS = {
  basePoints: 1,
  baseMoney: 1,
  baseExperience: 1,
  hintDropChance: 0.01, // 1% chance per card
} as const;

export const LEVEL_UP = {
  /** XP for a level is level * level * xpMultiplier / LEVEL_SYSTEM.xpMultiplierReduction. */
  xpMultiplier: 10,
} as const;

export const ALL_ATTRIBUTES: readonly AttributeName[] = ['shape', 'color', 'number', 'shading', 'background'];

// Attributes by run round for the legacy run's first round, resumed saved games and the
// dev "change round" tool. New saves are always 'medium'; 'easy' and 'hard' only come
// from saved games written by older versions.
const ADVENTURE_DIFFICULTY_PROGRESSIONS: Record<AdventureDifficulty, { rounds: number[]; attributes: AttributeName[] }[]> = {
  easy: [
    // Easy: 3 attributes (shape, color, number) all 10 rounds
    { rounds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], attributes: ['shape', 'color', 'number'] },
  ],
  medium: [
    // Medium: Progressive (current default) - 3 -> 4 -> 5 attributes
    { rounds: [1, 2, 3], attributes: ['shape', 'color', 'number'] },
    { rounds: [4, 5, 6, 7, 8, 9], attributes: ['shape', 'color', 'number', 'shading'] },
    { rounds: [10], attributes: ['shape', 'color', 'number', 'shading', 'background'] },
  ],
  hard: [
    // Hard: 4 attributes rounds 1-5, 5 attributes rounds 6-10
    { rounds: [1, 2, 3, 4, 5], attributes: ['shape', 'color', 'number', 'shading'] },
    { rounds: [6, 7, 8, 9, 10], attributes: ['shape', 'color', 'number', 'shading', 'background'] },
  ],
};

export const ATTRIBUTE_SCALING = {
  // Free Play difficulty presets
  difficultyPresets: {
    easy: ['shape', 'color'] as AttributeName[],
    medium: ['shape', 'color', 'number'] as AttributeName[],
    hard: ['shape', 'color', 'number', 'shading'] as AttributeName[],
    omega: ['shape', 'color', 'number', 'shading', 'background'] as AttributeName[],
  },

  // Board size based on attribute count
  boardSizes: {
    2: 9,   // 3x3
    3: 12,  // 3x4
    4: 15,  // 3x5
    5: 18,  // 3x6
  } as Record<number, number>,
} as const;

// Background color hex values
// Note: "beige" is now medium gray (#808080) for better visual contrast with white
export const BACKGROUND_COLORS = {
  white: '#FFFFFF',
  beige: '#808080',  // Changed from #F4EFEA (light beige) to medium gray for visibility
  charcoal: '#383838',
} as const;

/** Get active attributes for a given run round (see ADVENTURE_DIFFICULTY_PROGRESSIONS for where this applies) */
export const getActiveAttributesForRound = (round: number, difficulty: AdventureDifficulty = 'medium'): AttributeName[] => {
  const progression = ADVENTURE_DIFFICULTY_PROGRESSIONS[difficulty].find(
    p => (p.rounds as readonly number[]).includes(round)
  );
  return progression ? [...progression.attributes] : ['shape', 'color'];
};

/** Get board size for a given number of active attributes */
export const getBoardSizeForAttributes = (attributeCount: number): number => {
  const sizes: Record<number, number> = ATTRIBUTE_SCALING.boardSizes;
  return sizes[attributeCount] || BOARD.initialCardCount;
};

// Which of the two round tables applies where is decided in game/rounds.ts.

export const LEVEL_SYSTEM = {
  roundsPerLevel: 5,
  xpMultiplierReduction: 3, // XP requirements reduced to 1/3
} as const;

/**
 * The legacy run plays exactly one level: five rounds with three attributes and
 * no fixed bosses (enemies only appear in endless mode and in resumed saved
 * games, through the enemy selection screen).
 */
export const LEGACY_RUN_LEVEL = {
  number: 1,
  attributes: ['shape', 'color', 'number'],
} as const satisfies { number: number; attributes: readonly AttributeName[] };

/** Targets and clocks by run round (1-10). */
export const ROUND_REQUIREMENTS: readonly { round: number; targetScore: number; time: number }[] = [
  { round: 1, targetScore: 3, time: 30 },
  { round: 2, targetScore: 4, time: 45 },
  { round: 3, targetScore: 6, time: 45 },
  { round: 4, targetScore: 8, time: 45 },
  { round: 5, targetScore: 10, time: 60 },
  { round: 6, targetScore: 14, time: 60 },
  { round: 7, targetScore: 20, time: 60 },
  { round: 8, targetScore: 27, time: 60 },
  { round: 9, targetScore: 35, time: 60 },
  { round: 10, targetScore: 100, time: 60 },
];

// Run rounds past 10 (slightly exponential scaling)
// Round 11: 120, Round 12: 144, Round 13: 173, Round 14: 208, Round 15: 250...
export const getEndlessRoundRequirement = (round: number): { round: number; targetScore: number; time: number } => {
  const baseScore = 100; // Round 10 target
  const baseIncrement = 20;
  const scaleFactor = 1.2; // 20% increase per round

  let target = baseScore;
  for (let r = 11; r <= round; r++) {
    target += Math.floor(baseIncrement * Math.pow(scaleFactor, r - 11));
  }

  return {
    round,
    targetScore: target,
    time: 60,
  };
};

/** Targets and clocks by position in the 5-round level. */
export const LEVEL_ROUND_REQUIREMENTS: readonly { roundInLevel: number; targetScore: number; time: number }[] = [
  { roundInLevel: 1, targetScore: 8, time: 120 },
  { roundInLevel: 2, targetScore: 12, time: 120 },
  { roundInLevel: 3, targetScore: 18, time: 120 },
  { roundInLevel: 4, targetScore: 25, time: 120 },
  { roundInLevel: 5, targetScore: 35, time: 120 },
];

/**
 * Total XP at which the player reaches `level`: the exact inverse of
 * getAdjustedLevelFromXP, so progress bars and levelling agree.
 */
export const getAdjustedXPForLevel = (level: number): number => {
  return Math.ceil((level * level * LEVEL_UP.xpMultiplier) / LEVEL_SYSTEM.xpMultiplierReduction);
};

/**
 * Get level from total XP: floor(sqrt(xp * 3 / 10)), i.e. 3x faster than the original curve.
 */
export const getAdjustedLevelFromXP = (experience: number): number => {
  return Math.floor(Math.sqrt((experience * LEVEL_SYSTEM.xpMultiplierReduction) / LEVEL_UP.xpMultiplier));
};
