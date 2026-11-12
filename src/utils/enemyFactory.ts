/**
 * Enemy Factory
 *
 * Creates enemy instances using a registry pattern.
 * Each call to createEnemy() returns a fresh instance with reset internal state.
 */

import type { Weapon, PlayerStats } from '@/types';
import type {
  EnemyInstance,
  EnemyOption } from '@/types/enemy';
import { shuffleArray } from './gameUtils';
import { createDummyEnemy, WEAPON_COUNTERS, applyWeaponCounter } from './enemyEffects';
import { ENEMY_CREATORS } from './enemies';
import { generateChallengeBonus, getChallengeBonusMoney } from './rewardUtils';

// ============================================================================
// ENEMY REGISTRY
// ============================================================================

const ENEMY_REGISTRY: Record<string, { create: () => EnemyInstance; tier: EnemyInstance['tier'] }> = {};
for (const create of ENEMY_CREATORS) {
  const { name, tier } = create();
  ENEMY_REGISTRY[name] = { create, tier };
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
  const entry = ENEMY_REGISTRY[name];
  if (!entry) {
    console.warn(`Unknown enemy: ${name}, using dummy`);
    return createDummyEnemy();
  }
  return entry.create();
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
    .filter(([, entry]) => entry.tier === tier)
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
    stretchGoalMoney: getChallengeBonusMoney(enemy.tier),
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

// ============================================================================
// STAT MODIFIER UTILITIES
// ============================================================================

/**
 * Apply enemy stat modifiers to player stats.
 * Reduces weapon chances based on enemy counter effects.
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

  for (const { modifier, stat } of Object.values(WEAPON_COUNTERS)) {
    if (modifiers[modifier] && modifiedStats[stat] !== undefined) {
      modifiedStats[stat] = applyWeaponCounter(modifiedStats[stat]);
    }
  }

  // Note: damageMultiplier and pointsMultiplier are handled separately in Game.tsx
  // because they need to be applied at the point of damage/points calculation,
  // not to the base stats.

  return modifiedStats;
}
