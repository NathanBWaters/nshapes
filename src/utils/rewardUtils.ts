/**
 * Reward Utilities
 *
 * Utility functions for generating rewards, extracted to avoid circular dependencies.
 */

import type { Weapon } from '@/types';
import { WEAPONS, canObtainWeapon } from './gameDefinitions';

// Bonus money ranges by enemy tier (min, max)
export const CHALLENGE_BONUS_MONEY: Record<1 | 2 | 3 | 4, [number, number]> = {
  1: [10, 15],   // Tier 1: $10-15
  2: [20, 30],   // Tier 2: $20-30
  3: [40, 60],   // Tier 3: $40-60
  4: [50, 100],  // Tier 4: $50-100
};

/**
 * Get random bonus money for defeating an enemy's stretch goal.
 * @param tier - Enemy tier (1-4)
 * @returns Random money amount within the tier's range
 */
export const getChallengeBonusMoney = (tier: 1 | 2 | 3 | 4): number => {
  const [min, max] = CHALLENGE_BONUS_MONEY[tier];
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

/**
 * Generate a challenge bonus weapon.
 * In the new fusion system, all weapons are common (no rarity).
 * Progression comes from leveling and fusing.
 *
 * @param tier - Enemy tier (1-4) - currently unused, kept for API compatibility
 * @param excludeIds - Weapon IDs to exclude (already awarded weapons)
 * @param _playerStats - Unused, kept for API compatibility
 * @param playerWeapons - Player's current weapons (for filtering maxCount)
 * @returns A random weapon
 */
export const generateChallengeBonus = (
  tier: 1 | 2 | 3 | 4,
  excludeIds: string[] = [],
  _playerStats?: unknown,
  playerWeapons?: Weapon[]
): Weapon => {
  // Filter out already-awarded and max-count weapons
  let availableWeapons = WEAPONS.filter(w => !excludeIds.includes(w.id));

  if (playerWeapons) {
    availableWeapons = availableWeapons.filter(w => canObtainWeapon(w, playerWeapons));
  }

  if (availableWeapons.length === 0) {
    // Fallback: return any weapon
    availableWeapons = [...WEAPONS];
  }

  // Higher tiers could give better starting weapons in future
  // For now, just return random weapon
  return availableWeapons[Math.floor(Math.random() * availableWeapons.length)];
};
