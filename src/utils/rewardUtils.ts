/**
 * Reward Utilities
 *
 * Utility functions for generating rewards, extracted to avoid circular dependencies.
 */

import type { Weapon, WeaponRarity, CapIncreaseType, PlayerStats } from '@/types';
import { getWeaponsByRarity, countCapIncreaseWeapons, calculateLikelihoodBonus, selectWeightedWeapon } from './gameDefinitions';

// Mapping from CapIncreaseType to the corresponding PlayerStats key
const CAP_TYPE_TO_STAT: Record<CapIncreaseType, keyof PlayerStats> = {
  echo: 'echoChance',
  laser: 'laserChance',
  graceGain: 'graceGainChance',
  explosion: 'explosionChance',
  hint: 'hintGainChance',
  timeGain: 'timeGainChance',
  healing: 'healingChance',
  fire: 'fireSpreadChance',
  ricochet: 'ricochetChance',
  boardGrowth: 'boardGrowthChance',
  coinGain: 'coinGainChance',
  xpGain: 'xpGainChance',
};

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
 * Check if a cap-increase weapon is useful for the player.
 * A cap-increase is only useful if the player has at least 10% in the corresponding stat.
 *
 * @param weapon - The weapon to check
 * @param playerStats - The player's current stats (optional)
 * @returns true if the weapon is useful (not a cap-increase, or player has >=10% in that stat)
 */
const isCapIncreaseUseful = (weapon: Weapon, playerStats?: PlayerStats): boolean => {
  // If no player stats provided, assume all weapons are useful
  if (!playerStats) return true;

  // If weapon doesn't have a cap increase, it's useful
  if (!weapon.capIncrease) return true;

  // Check if player has at least 10% in the corresponding stat
  const statKey = CAP_TYPE_TO_STAT[weapon.capIncrease.type];
  const statValue = playerStats[statKey] as number | undefined;
  return (statValue ?? 0) >= 10;
};

/**
 * Generate a challenge bonus weapon based on enemy tier.
 * Higher tiers have better chances for legendary weapons.
 * Excludes cap-increase weapons if player has <10% in that stat.
 * Applies likelihood bonus based on player's cap-increase weapons.
 *
 * @param tier - Enemy tier (1-4)
 * @param excludeIds - Weapon IDs to exclude (already awarded weapons)
 * @param playerStats - Player's current stats (for filtering useless cap-increases)
 * @param playerWeapons - Player's current weapons (for likelihood bonus)
 * @returns A weapon of appropriate rarity for the tier
 */
export const generateChallengeBonus = (tier: 1 | 2 | 3 | 4, excludeIds: string[] = [], playerStats?: PlayerStats, playerWeapons?: Weapon[]): Weapon => {
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

  // Get a random weapon of the target rarity, excluding:
  // 1. Already-awarded weapons
  // 2. Cap-increase weapons where player has <10% in that stat
  const weaponsOfRarity = getWeaponsByRarity(targetRarity)
    .filter(w => !excludeIds.includes(w.id))
    .filter(w => isCapIncreaseUseful(w, playerStats));

  // Helper to select with likelihood bonus if playerWeapons provided
  const selectWithBonus = (weapons: Weapon[]): Weapon => {
    if (playerWeapons && playerWeapons.length > 0) {
      const capIncreaseCounts = countCapIncreaseWeapons(playerWeapons);
      if (capIncreaseCounts.size > 0) {
        const weights = weapons.map(w => calculateLikelihoodBonus(w, capIncreaseCounts));
        return selectWeightedWeapon(weapons, weights);
      }
    }
    return weapons[Math.floor(Math.random() * weapons.length)];
  };

  if (weaponsOfRarity.length === 0) {
    // Fallback to rare if no weapons of target rarity (excluding already awarded and useless cap-increases)
    const rareWeapons = getWeaponsByRarity('rare')
      .filter(w => !excludeIds.includes(w.id))
      .filter(w => isCapIncreaseUseful(w, playerStats));
    if (rareWeapons.length === 0) {
      // Last resort: return any weapon (shouldn't happen in practice)
      const allWeapons = getWeaponsByRarity('rare');
      return allWeapons[Math.floor(Math.random() * allWeapons.length)];
    }
    return selectWithBonus(rareWeapons);
  }
  return selectWithBonus(weaponsOfRarity);
};
