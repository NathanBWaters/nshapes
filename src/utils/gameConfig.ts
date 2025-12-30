/**
 * Centralized Game Configuration
 * All game balance values and rules in one place for easy tweaking.
 */

// =============================================================================
// PLAYER STARTING VALUES
// =============================================================================

export const STARTING_STATS = {
  hints: 1,
  health: 3,
  maxHealth: 3,
  money: 0,
  fieldSize: 12,
  freeRerolls: 0,
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
// ROUND REQUIREMENTS
// =============================================================================

export const ROUND_REQUIREMENTS: { points: number; time: number }[] = [
  { points: 0, time: 0 },    // Round 0 (unused, for 1-indexing)
  { points: 3, time: 30 },   // Round 1
  { points: 4, time: 30 },   // Round 2
  { points: 6, time: 30 },   // Round 3
  { points: 8, time: 30 },   // Round 4
  { points: 10, time: 30 },  // Round 5
  { points: 14, time: 30 },  // Round 6
  { points: 20, time: 30 },  // Round 7
  { points: 27, time: 30 },  // Round 8
  { points: 35, time: 30 },  // Round 9
  { points: 100, time: 60 }, // Round 10 (final)
];

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

/** Get round requirement by round number */
export const getRoundRequirement = (round: number): { points: number; time: number } => {
  if (round < 1 || round >= ROUND_REQUIREMENTS.length) {
    return ROUND_REQUIREMENTS[ROUND_REQUIREMENTS.length - 1];
  }
  return ROUND_REQUIREMENTS[round];
};
