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
 * @param excludeIds - Weapon IDs to exclude (already awarded weapons)
 * @returns A weapon of appropriate rarity for the tier
 */
export const generateChallengeBonus = (tier: 1 | 2 | 3 | 4, excludeIds: string[] = []): Weapon => {
  let targetRarity: WeaponRarity;

  switch (tier) {
    case 1: {
      // Tier 1: 50% Rare, 50% Epic
      const roll1 = Math.random();
      targetRarity = roll1 < 0.5 ? 'rare' : 'epic';
      break;
    }
    case 2: {
      // Tier 2: 40% Rare, 40% Epic, 20% Legendary
      const roll2 = Math.random();
      if (roll2 < 0.4) {
        targetRarity = 'rare';
      } else if (roll2 < 0.8) {
        targetRarity = 'epic';
      } else {
        targetRarity = 'legendary';
      }
      break;
    }
    case 3: {
      // Tier 3: 20% Rare, 40% Epic, 40% Legendary
      const roll3 = Math.random();
      if (roll3 < 0.2) {
        targetRarity = 'rare';
      } else if (roll3 < 0.6) {
        targetRarity = 'epic';
      } else {
        targetRarity = 'legendary';
      }
      break;
    }
    case 4:
      // Tier 4: Guaranteed Legendary
      targetRarity = 'legendary';
      break;
    default:
      targetRarity = 'rare';
  }

  // A random weapon of the target rarity that was not awarded yet
  const pick = (weapons: Weapon[]): Weapon => weapons[Math.floor(Math.random() * weapons.length)];
  const weaponsOfRarity = getWeaponsByRarity(targetRarity).filter(w => !excludeIds.includes(w.id));
  if (weaponsOfRarity.length > 0) return pick(weaponsOfRarity);

  // Fall back to any rare, then any weapon at all, so an empty bucket never breaks the reward
  const rareWeapons = getWeaponsByRarity('rare').filter(w => !excludeIds.includes(w.id));
  if (rareWeapons.length > 0) return pick(rareWeapons);
  const anyRare = getWeaponsByRarity('rare');
  return pick(anyRare.length > 0 ? anyRare : getWeaponsByRarity('common'));
};
