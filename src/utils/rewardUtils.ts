/**
 * Reward Utilities
 *
 * Utility functions for generating rewards, extracted to avoid circular dependencies.
 */

import type { Weapon, WeaponRarity } from '@/types';
import { getWeaponsByRarity } from './gameDefinitions';

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
 * Generate a challenge bonus weapon based on enemy tier.
 * Higher tiers have better chances for legendary weapons.
 *
 * @param tier - Enemy tier (1-4)
 * @returns A weapon of appropriate rarity for the tier
 */
export const generateChallengeBonus = (tier: 1 | 2 | 3 | 4): Weapon => {
  let targetRarity: WeaponRarity;

  switch (tier) {
    case 1:
      // Tier 1: Guaranteed Rare
      targetRarity = 'rare';
      break;
    case 2:
      // Tier 2: 70% Rare, 30% Legendary
      targetRarity = Math.random() < 0.7 ? 'rare' : 'legendary';
      break;
    case 3:
      // Tier 3: 40% Rare, 60% Legendary
      targetRarity = Math.random() < 0.4 ? 'rare' : 'legendary';
      break;
    case 4:
      // Tier 4: Guaranteed Legendary
      targetRarity = 'legendary';
      break;
    default:
      targetRarity = 'rare';
  }

  // Get a random weapon of the target rarity
  const weaponsOfRarity = getWeaponsByRarity(targetRarity);
  if (weaponsOfRarity.length === 0) {
    // Fallback to rare if no weapons of target rarity
    const rareWeapons = getWeaponsByRarity('rare');
    return rareWeapons[Math.floor(Math.random() * rareWeapons.length)];
  }
  return weaponsOfRarity[Math.floor(Math.random() * weaponsOfRarity.length)];
};
