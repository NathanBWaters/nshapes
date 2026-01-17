/**
 * Enemy Factory
 *
 * Creates enemy instances using a registry pattern.
 * Each call to createEnemy() returns a fresh instance with reset internal state.
 */

import type { Card, Weapon, PlayerStats } from '@/types';
import type {
  EnemyInstance,
  EnemyOption,
  EnemyStartResult,
  EnemyTickResult,
  EnemyMatchResult,
  EnemyUIModifiers,
  EnemyStatModifiers,
  RoundStats,
} from '@/types/enemy';
import { shuffleArray } from './gameUtils';
import { generateChallengeBonus } from './rewardUtils';

// ============================================================================
// ENEMY REGISTRY
// ============================================================================

/**
 * Registry of all enemy constructors indexed by name.
 * Will be populated as enemies are implemented.
 */
export const ENEMY_REGISTRY: Record<string, () => EnemyInstance> = {
  // Tier 1 enemies will be added here
  // 'Junk Rat': () => createJunkRat(),
  // 'Stalking Wolf': () => createStalkingWolf(),
  // etc.
};

// ============================================================================
// DUMMY ENEMY
// ============================================================================

/**
 * Create a no-op enemy for testing.
 * All hooks return empty/neutral deltas.
 * checkDefeatCondition always returns true (always "defeated").
 */
export function createDummyEnemy(): EnemyInstance {
  return {
    name: 'Dummy',
    icon: 'lorc/uncertainty',
    tier: 1,
    description: 'No effect',
    defeatConditionText: 'Always defeated',

    onRoundStart: (_board: Card[]): EnemyStartResult => ({
      cardModifications: [],
      events: [],
    }),

    onTick: (_deltaMs: number, _board: Card[]): EnemyTickResult => ({
      scoreDelta: 0,
      healthDelta: 0,
      timeDelta: 0,
      cardsToRemove: [],
      cardModifications: [],
      cardsToFlip: [],
      events: [],
      instantDeath: false,
    }),

    onValidMatch: (_matchedCards: Card[], _board: Card[]): EnemyMatchResult => ({
      timeDelta: 0,
      pointsMultiplier: 1,
      cardsToRemove: [],
      cardsToFlip: [],
      events: [],
    }),

    onInvalidMatch: (_cards: Card[], _board: Card[]): EnemyMatchResult => ({
      timeDelta: 0,
      pointsMultiplier: 1,
      cardsToRemove: [],
      cardsToFlip: [],
      events: [],
    }),

    onCardDraw: (card: Card): Card => card,

    checkDefeatCondition: (_stats: RoundStats): boolean => true,

    onRoundEnd: (): void => {},

    getUIModifiers: (): EnemyUIModifiers => ({}),

    getStatModifiers: (): EnemyStatModifiers => ({}),
  };
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create an enemy instance by name.
 * Each call returns a FRESH instance with reset internal state.
 *
 * @param name - The enemy name to create
 * @returns A fresh EnemyInstance, or DummyEnemy if name not found
 */
export function createEnemy(name: string): EnemyInstance {
  const factory = ENEMY_REGISTRY[name];
  if (!factory) {
    console.warn(`Unknown enemy: ${name}, using dummy`);
    return createDummyEnemy();
  }
  return factory();
}

/**
 * Get a list of all registered enemy names.
 */
export function getEnemyNames(): string[] {
  return Object.keys(ENEMY_REGISTRY);
}

/**
 * Get all enemies of a specific tier.
 *
 * @param tier - The tier to filter by (1-4)
 * @returns Array of enemy names in that tier
 */
export function getEnemiesByTier(tier: 1 | 2 | 3 | 4): string[] {
  return Object.entries(ENEMY_REGISTRY)
    .filter(([_, factory]) => factory().tier === tier)
    .map(([name]) => name);
}

/**
 * Get random enemies for selection screen.
 * Returns fresh instances, not references.
 *
 * @param tier - Which tier to pull from
 * @param count - How many to return (default 3)
 * @param exclude - Enemy names to exclude from selection (e.g., already defeated enemies)
 * @returns Array of fresh EnemyInstance objects
 */
export function getRandomEnemies(tier: 1 | 2 | 3 | 4, count: number = 3, exclude: string[] = []): EnemyInstance[] {
  const tierEnemyNames = getEnemiesByTier(tier);

  // Filter out excluded enemies (already defeated)
  const availableNames = tierEnemyNames.filter(name => !exclude.includes(name));

  if (availableNames.length === 0) {
    // No enemies available for this tier, return dummy enemies
    return Array(count).fill(null).map(() => createDummyEnemy());
  }

  // Shuffle and take requested count
  const shuffled = shuffleArray(availableNames);
  const selectedNames = shuffled.slice(0, Math.min(count, shuffled.length));

  // Create fresh instances
  return selectedNames.map(name => createEnemy(name));
}

/**
 * Get random enemy options for selection screen with pre-determined rewards.
 * Returns fresh instances with their stretch goal rewards already generated.
 *
 * @param tier - Which tier to pull from
 * @param count - How many to return (default 3)
 * @param excludeEnemies - Enemy names to exclude from selection (e.g., already defeated enemies)
 * @param excludeWeaponIds - Weapon IDs to exclude from rewards (e.g., already awarded weapons)
 * @param playerStats - Player's current stats (for filtering useless cap-increase weapons)
 * @param playerWeapons - Player's current weapons (for likelihood bonus)
 * @returns Array of EnemyOption objects (enemy + pre-determined reward)
 */
export function getRandomEnemyOptions(
  tier: 1 | 2 | 3 | 4,
  count: number = 3,
  excludeEnemies: string[] = [],
  excludeWeaponIds: string[] = [],
  playerStats?: PlayerStats,
  playerWeapons?: Weapon[]
): EnemyOption[] {
  const enemies = getRandomEnemies(tier, count, excludeEnemies);
  return enemies.map(enemy => ({
    enemy,
    stretchGoalReward: generateChallengeBonus(enemy.tier, excludeWeaponIds, playerStats, playerWeapons),
  }));
}

/**
 * Check if an enemy is registered.
 *
 * @param name - The enemy name to check
 * @returns true if the enemy exists in the registry
 */
export function isEnemyRegistered(name: string): boolean {
  return name in ENEMY_REGISTRY;
}

/**
 * Register a new enemy in the registry.
 * Used by enemy implementation files to add themselves.
 *
 * @param name - The enemy name
 * @param factory - Function that creates a fresh instance
 */
export function registerEnemy(name: string, factory: () => EnemyInstance): void {
  if (ENEMY_REGISTRY[name]) {
    console.warn(`Enemy "${name}" is already registered, overwriting`);
  }
  ENEMY_REGISTRY[name] = factory;
}

// ============================================================================
// STAT MODIFIER UTILITIES
// ============================================================================

/**
 * Apply enemy stat modifiers to player stats.
 * Reduces weapon chances based on enemy counter effects.
 *
 * Uses division by 3 instead of subtraction to ensure players always retain
 * some capability. Example: 40% explosion with enemy counter → 40% ÷ 3 ≈ 13%
 *
 * @param baseStats - The base player stats from calculatePlayerTotalStats
 * @param enemy - The active enemy instance (or null/undefined for no enemy)
 * @returns Modified player stats with enemy reductions applied
 */
export function applyEnemyStatModifiers(
  baseStats: PlayerStats,
  enemy: EnemyInstance | null | undefined
): PlayerStats {
  if (!enemy) {
    return baseStats;
  }

  const modifiers = enemy.getStatModifiers();
  const modifiedStats = { ...baseStats };

  // Apply weapon counter reductions by dividing by 3 (ensures some capability remains)
  // This is more balanced than subtraction which could reduce stats to 0%
  if (modifiers.fireSpreadChanceReduction && modifiedStats.fireSpreadChance !== undefined) {
    modifiedStats.fireSpreadChance = Math.round(modifiedStats.fireSpreadChance / 3);
  }
  if (modifiers.explosionChanceReduction && modifiedStats.explosionChance !== undefined) {
    modifiedStats.explosionChance = Math.round(modifiedStats.explosionChance / 3);
  }
  if (modifiers.laserChanceReduction && modifiedStats.laserChance !== undefined) {
    modifiedStats.laserChance = Math.round(modifiedStats.laserChance / 3);
  }
  if (modifiers.hintGainChanceReduction && modifiedStats.hintGainChance !== undefined) {
    modifiedStats.hintGainChance = Math.round(modifiedStats.hintGainChance / 3);
  }
  if (modifiers.graceGainChanceReduction && modifiedStats.graceGainChance !== undefined) {
    modifiedStats.graceGainChance = Math.round(modifiedStats.graceGainChance / 3);
  }
  if (modifiers.timeGainChanceReduction && modifiedStats.timeGainChance !== undefined) {
    modifiedStats.timeGainChance = Math.round(modifiedStats.timeGainChance / 3);
  }
  if (modifiers.healingChanceReduction && modifiedStats.healingChance !== undefined) {
    modifiedStats.healingChance = Math.round(modifiedStats.healingChance / 3);
  }

  // Note: damageMultiplier and pointsMultiplier are handled separately in Game.tsx
  // because they need to be applied at the point of damage/points calculation,
  // not to the base stats.

  return modifiedStats;
}
