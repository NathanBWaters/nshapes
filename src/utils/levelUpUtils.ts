/**
 * Level Up Utilities
 *
 * Utility functions for the level up system, including:
 * - Option generation (new items + upgrades)
 * - Item upgrading
 * - Contextual filtering based on inventory state
 * - Reroll cost management
 */

import { FusionWeapon, PlayerInventory, WeaponLevel, LevelUpOption } from '../types';
import { BASE_WEAPONS, BASE_PASSIVES, ALL_ITEMS } from './fusionDefinitions';

// Re-export LevelUpOption for convenience
export type { LevelUpOption };

// =============================================================================
// Types
// =============================================================================

export interface RerollState {
  cost: number;
  count: number;
}

// =============================================================================
// Constants
// =============================================================================

const INITIAL_REROLL_COST = 5;
const NUM_LEVEL_UP_OPTIONS = 3;

// =============================================================================
// Reroll Cost Functions
// =============================================================================

/**
 * Get the initial reroll cost (at start of round)
 */
export const getInitialRerollCost = (): number => INITIAL_REROLL_COST;

/**
 * Calculate the next reroll cost (doubles each time)
 */
export const calculateNextRerollCost = (currentCost: number): number => currentCost * 2;

/**
 * Reset reroll cost to initial value (called at start of new round)
 */
export const resetRerollCost = (): number => INITIAL_REROLL_COST;

/**
 * Check if player can afford the current reroll cost
 */
export const canAffordReroll = (playerMoney: number, rerollCost: number): boolean => {
  return playerMoney >= rerollCost;
};

/**
 * Perform a reroll: deduct money and calculate next cost
 * @throws Error if player cannot afford
 */
export const performReroll = (
  playerMoney: number,
  rerollCost: number
): { newMoney: number; newRerollCost: number } => {
  if (!canAffordReroll(playerMoney, rerollCost)) {
    throw new Error('Cannot afford reroll');
  }

  return {
    newMoney: playerMoney - rerollCost,
    newRerollCost: calculateNextRerollCost(rerollCost),
  };
};

// =============================================================================
// Item Upgrade Functions
// =============================================================================

/**
 * Upgrade an item's level by 1 (max level 3)
 * Returns a new item object (immutable)
 */
export const upgradeItem = (item: FusionWeapon): FusionWeapon => {
  if (item.level >= 3) {
    return item; // Already at max level
  }

  const newLevel = (item.level + 1) as WeaponLevel;

  return {
    ...item,
    level: newLevel,
  };
};

// =============================================================================
// Inventory Analysis Functions
// =============================================================================

/**
 * Count non-null items in an array
 */
const countItems = (arr: (FusionWeapon | null)[]): number =>
  arr.filter(item => item !== null).length;

/**
 * Check if there's room for more weapons
 */
const hasWeaponSlot = (inventory: PlayerInventory): boolean =>
  countItems(inventory.weapons) < 4;

/**
 * Check if there's room for more passives
 */
const hasPassiveSlot = (inventory: PlayerInventory): boolean =>
  countItems(inventory.passives) < 4;

/**
 * Get all items that can be upgraded (level < 3)
 */
export const getUpgradableItems = (inventory: PlayerInventory): FusionWeapon[] => {
  const upgradable: FusionWeapon[] = [];

  inventory.weapons.forEach(item => {
    if (item && item.level < 3) {
      upgradable.push(item);
    }
  });

  inventory.passives.forEach(item => {
    if (item && item.level < 3) {
      upgradable.push(item);
    }
  });

  return upgradable;
};

/**
 * Get new items that can be acquired based on available slots
 */
export const getAvailableNewItems = (inventory: PlayerInventory): FusionWeapon[] => {
  const available: FusionWeapon[] = [];

  // Add weapons if there's room
  if (hasWeaponSlot(inventory)) {
    available.push(...BASE_WEAPONS);
  }

  // Add passives if there's room
  if (hasPassiveSlot(inventory)) {
    available.push(...BASE_PASSIVES);
  }

  return available;
};

// =============================================================================
// Option Generation
// =============================================================================

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
const shuffleArray = <T>(array: T[]): T[] => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

/**
 * Generate level up options based on player's current inventory
 *
 * Returns 3 options that can be:
 * - New items (if slots available)
 * - Upgrades (if items below level 3)
 *
 * Options are contextually filtered based on inventory state.
 * Tries to provide a balanced mix of upgrades and new items when both are available.
 */
export const generateLevelUpOptions = (inventory: PlayerInventory): LevelUpOption[] => {
  const options: LevelUpOption[] = [];
  const usedIds = new Set<string>();

  // Get available upgrade options
  const upgradableItems = getUpgradableItems(inventory);
  const upgradeOptions: LevelUpOption[] = shuffleArray(upgradableItems.map(item => {
    // Find slot info
    let slotInfo: LevelUpOption['slotInfo'];
    const weaponIndex = inventory.weapons.findIndex(w => w?.id === item.id);
    if (weaponIndex !== -1) {
      slotInfo = { slotType: 'weapons', slotIndex: weaponIndex };
    } else {
      const passiveIndex = inventory.passives.findIndex(p => p?.id === item.id);
      slotInfo = { slotType: 'passives', slotIndex: passiveIndex };
    }

    return {
      type: 'upgrade' as const,
      item,
      slotInfo,
    };
  }));

  // Get available new item options
  const availableNewItems = getAvailableNewItems(inventory);
  const newItemOptions: LevelUpOption[] = shuffleArray(availableNewItems.map(item => ({
    type: 'new' as const,
    item: {
      ...item,
      id: `${item.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      level: 1 as WeaponLevel,
    },
  })));

  // Strategy: Interleave upgrade and new item options for better balance
  // This ensures we offer a mix when both are available
  const interleavedOptions: LevelUpOption[] = [];
  const maxLen = Math.max(upgradeOptions.length, newItemOptions.length);

  for (let i = 0; i < maxLen; i++) {
    // Alternate between upgrades and new items
    if (i < upgradeOptions.length) {
      interleavedOptions.push(upgradeOptions[i]);
    }
    if (i < newItemOptions.length) {
      interleavedOptions.push(newItemOptions[i]);
    }
  }

  // Shuffle the interleaved options for variety
  const allOptions = shuffleArray(interleavedOptions);

  // Select up to NUM_LEVEL_UP_OPTIONS unique options
  for (const option of allOptions) {
    if (options.length >= NUM_LEVEL_UP_OPTIONS) break;

    // For new items, use base name for uniqueness check
    const uniqueKey = option.type === 'upgrade' ? option.item.id : option.item.name;
    if (!usedIds.has(uniqueKey)) {
      usedIds.add(uniqueKey);
      options.push(option);
    }
  }

  // If we don't have enough options (edge case), fill with random new items
  while (options.length < NUM_LEVEL_UP_OPTIONS && allOptions.length > 0) {
    const randomOption = allOptions[Math.floor(Math.random() * allOptions.length)];
    const uniqueKey = randomOption.type === 'upgrade' ? randomOption.item.id : randomOption.item.name;
    if (!usedIds.has(uniqueKey)) {
      usedIds.add(uniqueKey);
      options.push(randomOption);
    }
    // Remove this option to avoid infinite loop
    const index = allOptions.indexOf(randomOption);
    if (index !== -1) allOptions.splice(index, 1);
  }

  return options;
};
