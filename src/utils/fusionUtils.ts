/**
 * Fusion System Utilities
 *
 * Utility functions for the weapon fusion system:
 * - Fusion gem drop mechanics
 * - Fusion execution
 * - Random level ups (alternative to fusion)
 * - Eligibility checking
 */

import { FusionWeapon, PlayerInventory, WeaponLevel } from '../types';
import { BASE_WEAPONS, TIER1_FUSIONS, TIER2_FUSIONS, getFusionResult, getItemById } from './fusionDefinitions';
import { upgradeItem } from './levelUpUtils';

// =============================================================================
// Constants
// =============================================================================

/** Base chance (%) for fusion gem to drop */
export const FUSION_GEM_BASE_CHANCE = 25;

/** Additional chance (%) per round */
export const FUSION_GEM_ROUND_SCALING = 5;

// =============================================================================
// Types
// =============================================================================

export interface FusionResult {
  success: boolean;
  newInventory: PlayerInventory;
  fusionWeapon?: FusionWeapon;
  freedSlot: boolean;
  error?: string;
}

export interface RandomLevelUpResult {
  newInventory: PlayerInventory;
  upgradesApplied: number;
  upgradedItems: FusionWeapon[];
}

export interface FusionPair {
  weaponA: FusionWeapon;
  weaponB: FusionWeapon;
  result: FusionWeapon;
}

// =============================================================================
// Fusion Gem Drop Functions
// =============================================================================

/**
 * Calculate the chance (%) for a fusion gem to drop
 * Based on round number, roughly 1 gem per 2-3 rounds
 */
export const calculateFusionGemDropChance = (round: number): number => {
  const chance = FUSION_GEM_BASE_CHANCE + (Math.max(0, round) * FUSION_GEM_ROUND_SCALING);
  return Math.min(100, chance);
};

/**
 * Determine if a fusion gem should drop this round
 * Will not drop if fusionGemPending is already true
 */
export const shouldDropFusionGem = (round: number, fusionGemPending: boolean): boolean => {
  if (fusionGemPending) return false;

  const chance = calculateFusionGemDropChance(round);
  return Math.random() * 100 < chance;
};

// =============================================================================
// Eligibility Functions
// =============================================================================

/**
 * Get all level 3 weapons from inventory (excluding passives)
 */
export const getLevel3Weapons = (inventory: PlayerInventory): FusionWeapon[] => {
  return inventory.weapons.filter(
    (w): w is FusionWeapon => w !== null && w.level === 3 && w.type === 'weapon'
  );
};

/**
 * Check if player can perform a fusion (has 2+ level 3 weapons)
 */
export const canFuseWeapons = (inventory: PlayerInventory): boolean => {
  const level3Weapons = getLevel3Weapons(inventory);
  return level3Weapons.length >= 2;
};

/**
 * Get all eligible fusion pairs from inventory
 */
export const getEligibleFusionPairs = (inventory: PlayerInventory): FusionPair[] => {
  const level3Weapons = getLevel3Weapons(inventory);
  const pairs: FusionPair[] = [];

  // Check all pairs
  for (let i = 0; i < level3Weapons.length; i++) {
    for (let j = i + 1; j < level3Weapons.length; j++) {
      const weaponA = level3Weapons[i];
      const weaponB = level3Weapons[j];
      const result = getFusionResult(weaponA, weaponB);

      if (result) {
        pairs.push({ weaponA, weaponB, result });
      }
    }
  }

  return pairs;
};

// =============================================================================
// Fusion Execution
// =============================================================================

/**
 * Execute a fusion between two weapons
 * Returns the updated inventory and fusion result
 */
export const executeFusion = (
  inventory: PlayerInventory,
  weaponAId: string,
  weaponBId: string
): FusionResult => {
  // Find weapons in inventory
  const weaponAIndex = inventory.weapons.findIndex(w => w?.id === weaponAId);
  const weaponBIndex = inventory.weapons.findIndex(w => w?.id === weaponBId);

  const weaponA = weaponAIndex !== -1 ? inventory.weapons[weaponAIndex] : null;
  const weaponB = weaponBIndex !== -1 ? inventory.weapons[weaponBIndex] : null;

  // Validate weapons exist
  if (!weaponA) {
    return {
      success: false,
      newInventory: inventory,
      freedSlot: false,
      error: 'Weapon A not found in inventory',
    };
  }

  if (!weaponB) {
    return {
      success: false,
      newInventory: inventory,
      freedSlot: false,
      error: 'Weapon B not found in inventory',
    };
  }

  // Validate same weapon check
  if (weaponAId === weaponBId) {
    return {
      success: false,
      newInventory: inventory,
      freedSlot: false,
      error: 'Cannot fuse weapon with itself',
    };
  }

  // Validate both are level 3
  if (weaponA.level !== 3) {
    return {
      success: false,
      newInventory: inventory,
      freedSlot: false,
      error: 'Weapon A must be level 3 to fuse',
    };
  }

  if (weaponB.level !== 3) {
    return {
      success: false,
      newInventory: inventory,
      freedSlot: false,
      error: 'Weapon B must be level 3 to fuse',
    };
  }

  // Look up fusion recipe
  const fusionTemplate = getFusionResult(weaponA, weaponB);
  if (!fusionTemplate) {
    return {
      success: false,
      newInventory: inventory,
      freedSlot: false,
      error: 'No fusion recipe exists for these weapons',
    };
  }

  // Create the fusion weapon
  const fusionWeapon: FusionWeapon = {
    ...fusionTemplate,
    id: `${fusionTemplate.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    level: 1 as WeaponLevel,
    fusionParents: [weaponA.name, weaponB.name],
  };

  // Create new inventory with weapons removed and fusion added
  const newWeapons = [...inventory.weapons];

  // Remove both input weapons
  newWeapons[weaponAIndex] = null;
  newWeapons[weaponBIndex] = null;

  // Add fusion weapon to first empty slot
  const emptySlot = newWeapons.findIndex(w => w === null);
  if (emptySlot !== -1) {
    newWeapons[emptySlot] = fusionWeapon;
  }

  return {
    success: true,
    newInventory: {
      weapons: newWeapons,
      passives: [...inventory.passives],
    },
    fusionWeapon,
    freedSlot: true, // 2 weapons -> 1 weapon = freed slot
  };
};

// =============================================================================
// Random Level Ups
// =============================================================================

/**
 * Get all upgradable items from inventory (level < 3)
 */
const getUpgradableItems = (inventory: PlayerInventory): { item: FusionWeapon; type: 'weapons' | 'passives'; index: number }[] => {
  const upgradable: { item: FusionWeapon; type: 'weapons' | 'passives'; index: number }[] = [];

  inventory.weapons.forEach((item, index) => {
    if (item && item.level < 3) {
      upgradable.push({ item, type: 'weapons', index });
    }
  });

  inventory.passives.forEach((item, index) => {
    if (item && item.level < 3) {
      upgradable.push({ item, type: 'passives', index });
    }
  });

  return upgradable;
};

/**
 * Execute random level ups (alternative to fusion)
 * Applies 1-5 random upgrades to eligible items
 */
export const executeRandomLevelUps = (inventory: PlayerInventory): RandomLevelUpResult => {
  const upgradable = getUpgradableItems(inventory);

  if (upgradable.length === 0) {
    return {
      newInventory: inventory,
      upgradesApplied: 0,
      upgradedItems: [],
    };
  }

  // Roll 1-5 upgrades
  const numUpgrades = Math.floor(Math.random() * 5) + 1;

  // Create mutable copies of inventory arrays
  const newWeapons = [...inventory.weapons];
  const newPassives = [...inventory.passives];

  const upgradedItems: FusionWeapon[] = [];
  let upgradesApplied = 0;

  for (let i = 0; i < numUpgrades; i++) {
    // Get currently upgradable items (may have changed due to previous upgrades)
    const currentUpgradable: { item: FusionWeapon; type: 'weapons' | 'passives'; index: number }[] = [];

    newWeapons.forEach((item, index) => {
      if (item && item.level < 3) {
        currentUpgradable.push({ item, type: 'weapons', index });
      }
    });

    newPassives.forEach((item, index) => {
      if (item && item.level < 3) {
        currentUpgradable.push({ item, type: 'passives', index });
      }
    });

    if (currentUpgradable.length === 0) break;

    // Pick random item to upgrade
    const target = currentUpgradable[Math.floor(Math.random() * currentUpgradable.length)];
    const upgraded = upgradeItem(target.item);

    // Update the inventory
    if (target.type === 'weapons') {
      newWeapons[target.index] = upgraded;
    } else {
      newPassives[target.index] = upgraded;
    }

    upgradedItems.push(upgraded);
    upgradesApplied++;
  }

  return {
    newInventory: {
      weapons: newWeapons,
      passives: newPassives,
    },
    upgradesApplied,
    upgradedItems,
  };
};
