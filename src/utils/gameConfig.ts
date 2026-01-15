/**
 * Centralized Game Configuration
 * All game balance values and rules in one place for easy tweaking.
 */

import { AttributeName, AdventureDifficulty } from '../types';

// =============================================================================
// PLAYER STARTING VALUES
// =============================================================================

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
  autoHintChance: 0,
  autoHintInterval: 10000, // 10 seconds default interval
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
  laserChance: 0,
  startingTime: 0, // Additional starting time in seconds
  ricochetChance: 0,
  ricochetChainChance: 0,
  enhancedHintChance: 0,    // % chance for autohint to show 2 cards instead of 1
  echoChance: 0,            // % chance to auto-match another set on player match
  chainReactionChance: 0,   // % chance for echo to trigger twice (2 additional matches)
} as const;

// =============================================================================
// BOARD & CARDS
// =============================================================================

export const BOARD = {
  initialCardCount: 12,
  maxBoardSize: 21,
  columns: 3,
} as const;

// =============================================================================
// ECONOMY
// =============================================================================

export const ECONOMY = {
  baseRerollCost: 5,
  rerollCostIncrement: 2,
  shopSize: 4,
  levelUpOptionsCount: 4,
} as const;

// =============================================================================
// WEAPON SYSTEM
// =============================================================================

export const WEAPON_SYSTEM = {
  // Base rarity drop rates for shop generation (used as fallback)
  rarityChances: {
    common: 0.60,    // 60% chance
    rare: 0.25,      // 25% chance
    epic: 0.12,      // 12% chance
    legendary: 0.03, // 3% chance
  },

  // Fire system
  fireBurnDuration: 7500, // 7.5 seconds
  fireSpreadOnDeathChance: 0.10, // 10% to spread when burning out

  // Auto-hint display duration
  autoHintDisplayDuration: 1500, // 1.5 seconds
} as const;

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

  // Legendary: 0.75% at round 1, 6% at round 10
  const legendaryStart = 0.0075;
  const legendaryEnd = 0.06;
  const legendary = legendaryStart + (legendaryEnd - legendaryStart) * progress;

  // Epic: 3% at round 1, 18% at round 10
  const epicStart = 0.03;
  const epicEnd = 0.18;
  const epic = epicStart + (epicEnd - epicStart) * progress;

  // Rare: 15% at round 1, 30% at round 10
  const rareStart = 0.15;
  const rareEnd = 0.30;
  const rare = rareStart + (rareEnd - rareStart) * progress;

  // Common: remainder
  const common = 1 - legendary - epic - rare;

  return { common, rare, epic, legendary };
};

// =============================================================================
// EFFECT CAPS - Maximum effective percentages for weapon effects
// =============================================================================

/**
 * Effect caps limit how much a stat can actually be used, even if accumulated higher.
 * This encourages build diversity and prevents one-dimensional strategies.
 * Players can increase caps by acquiring Cap Increaser weapons.
 */
export const EFFECT_CAPS = {
  // Effect name -> { defaultCap, capIncrease }
  echo: { defaultCap: 25, capIncrease: 5 },           // Echo Stone
  laser: { defaultCap: 30, capIncrease: 5 },          // Prismatic Ray
  graceGain: { defaultCap: 30, capIncrease: 5 },      // Fortune Token
  explosion: { defaultCap: 40, capIncrease: 10 },     // Blast Powder
  hint: { defaultCap: 40, capIncrease: 10 },          // Oracle Eye, Seeker Lens
  timeGain: { defaultCap: 40, capIncrease: 10 },      // Time Drop
  healing: { defaultCap: 50, capIncrease: 10 },       // Mending Charm
  fire: { defaultCap: 50, capIncrease: 10 },          // Flint Spark
  ricochet: { defaultCap: 60, capIncrease: 10 },      // Chaos Shard
  boardGrowth: { defaultCap: 60, capIncrease: 10 },   // Growth Seed
  coinGain: { defaultCap: 70, capIncrease: 15 },      // Fortune's Favor
  xpGain: { defaultCap: 100, capIncrease: 0 },        // Scholar's Tome (no cap increase)
} as const;

// Type for effect cap keys
export type EffectCapType = keyof typeof EFFECT_CAPS;

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
 * Mapping from PlayerStats field names to EffectCapType
 * Used by UI to show cap information for stats
 */
export const STAT_TO_CAP_TYPE: Record<string, EffectCapType> = {
  echoChance: 'echo',
  laserChance: 'laser',
  graceGainChance: 'graceGain',
  explosionChance: 'explosion',
  hintGainChance: 'hint',
  autoHintChance: 'hint',
  enhancedHintChance: 'hint',
  timeGainChance: 'timeGain',
  healingChance: 'healing',
  fireSpreadChance: 'fire',
  ricochetChance: 'ricochet',
  boardGrowthChance: 'boardGrowth',
  coinGainChance: 'coinGain',
  xpGainChance: 'xpGain',
};

/**
 * Get cap info for a stat if it has one
 * Returns null if the stat is not capped
 */
export const getCapInfoForStat = (statKey: string, playerCaps?: Record<string, number>): { cap: number; capIncrease: number } | null => {
  const capType = STAT_TO_CAP_TYPE[statKey];
  if (!capType) return null;

  const capConfig = EFFECT_CAPS[capType];
  // If player has custom caps, use those
  const cap = playerCaps?.[capType] ?? capConfig.defaultCap;
  return { cap, capIncrease: capConfig.capIncrease };
};

// =============================================================================
// REWARDS (per matched card)
// =============================================================================

export const MATCH_REWARDS = {
  basePoints: 1,
  baseMoney: 1,
  baseExperience: 1,
  hintDropChance: 0.01, // 1% chance per card
} as const;

// =============================================================================
// LEVEL UP
// =============================================================================

export const LEVEL_UP = {
  /** Formula: level * level * 10 (Level 1 = 10 XP, Level 2 = 40 XP, etc.) */
  xpMultiplier: 10,
  statUpgradeChance: 0.7, // 70% stat upgrade, 30% weapon upgrade
  weaponLevelCap: 4,
  statUpgradeValues: {
    flat: 1,       // damage, maxHealth
    fieldSize: 2,  // fieldSize gets +2
    percent: 5,    // percentage stats get +5%
  },
} as const;

// =============================================================================
// COMBAT & PENALTIES
// =============================================================================

export const COMBAT = {
  invalidMatchPenalty: 1, // health lost per invalid match
} as const;

// =============================================================================
// TIMING (milliseconds)
// =============================================================================

export const TIMING = {
  matchRevealDelay: 200,
  rewardDisplayDuration: 1500,
  invalidMatchDelay: 500,
  timerTickInterval: 1000,
} as const;

// =============================================================================
// TIMER THRESHOLDS
// =============================================================================

export const TIMER = {
  criticalThreshold: 5,  // seconds - red, pulsing
  warningThreshold: 10,  // seconds - orange
} as const;

// =============================================================================
// CARD MODIFIER GENERATION
// =============================================================================

export const CARD_MODIFIERS = {
  /** Base chance formula: baseChance * difficulty + roundMultiplier * round */
  baseChance: 0.05,
  roundMultiplier: 0.02,

  // Individual modifier chances (multiplied by base modifier chance)
  chances: {
    health: 0.70,
    lootBox: 0.30,
    bonusMoney: 0.50,
    bonusPoints: 0.50,
    fireStarter: 0.20,
    bomb: 0.15,
    healing: 0.25,
    spikes: 0.20,
    dud: 0.10,
    fragile: 0.20,
    boobyTrap: 0.15,
    clover: 0.30,
    cardClear: 0.10,
    broom: 0.05,
    selfHealing: 0.20,
    timedReward: 0.40,
  },

  // Round requirements for certain modifiers
  roundRequirements: {
    bomb: 2,
    spikes: 3,
    dud: 4,
    fragile: 3,
    boobyTrap: 5,
    cardClear: 6,
    broom: 7,
    selfHealing: 4,
  },

  // Value ranges
  ranges: {
    health: { min: 2, max: 5 },
    bonusMoney: { min: 1, max: 5 },
    bonusPoints: { min: 1, max: 3 },
    bombTimer: { min: 10, max: 20 },
    timedReward: { min: 3, max: 7 },
  },
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Calculate XP required for a given level */
export const getXPForLevel = (level: number): number => {
  return level * level * LEVEL_UP.xpMultiplier;
};

/** Calculate level from total XP */
export const getLevelFromXP = (experience: number): number => {
  return Math.floor(Math.sqrt(experience / LEVEL_UP.xpMultiplier));
};

// =============================================================================
// ATTRIBUTE SCALING
// =============================================================================

// Adventure mode difficulty progressions
export const ADVENTURE_DIFFICULTY_PROGRESSIONS: Record<AdventureDifficulty, { rounds: number[]; attributes: AttributeName[] }[]> = {
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
  // Round-based attribute progression for Adventure Mode (legacy - use ADVENTURE_DIFFICULTY_PROGRESSIONS)
  roundProgression: [
    { rounds: [1, 2, 3], attributes: ['shape', 'color', 'number'] as AttributeName[] },
    { rounds: [4, 5, 6, 7, 8, 9], attributes: ['shape', 'color', 'number', 'shading'] as AttributeName[] },
    { rounds: [10], attributes: ['shape', 'color', 'number', 'shading', 'background'] as AttributeName[] },
  ],

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
export const BACKGROUND_COLORS = {
  white: '#FFFFFF',
  beige: '#F4EFEA',
  charcoal: '#383838',
} as const;

/** Get active attributes for a given round (Adventure Mode) */
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
