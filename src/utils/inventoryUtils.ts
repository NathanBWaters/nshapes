/**
 * Inventory Utility Functions
 *
 * Manages the 4 weapon + 4 passive slot inventory system.
 */

import { PlayerInventory, FusionWeapon } from '../types';

/**
 * Create an empty inventory with 4 weapon slots and 4 passive slots
 */
export function createEmptyInventory(): PlayerInventory {
  return {
    weapons: [null, null, null, null],
    passives: [null, null, null, null],
  };
}

/**
 * Result of adding an item to inventory
 */
export interface AddItemResult {
  success: boolean;
  inventory: PlayerInventory;
  error?: string;
}

/**
 * Add a weapon to the player's inventory
 * @returns Result with success status and updated inventory
 */
export function addWeaponToInventory(inventory: PlayerInventory, weapon: FusionWeapon): AddItemResult {
  // Validate it's a weapon
  if (weapon.type !== 'weapon') {
    return {
      success: false,
      inventory,
      error: 'Cannot add non-weapon to weapon slots',
    };
  }

  // Find first empty slot
  const emptyIndex = inventory.weapons.findIndex(slot => slot === null);

  if (emptyIndex === -1) {
    return {
      success: false,
      inventory,
      error: 'No empty weapon slots',
    };
  }

  // Create new inventory with weapon added
  const newWeapons = [...inventory.weapons];
  newWeapons[emptyIndex] = weapon;

  return {
    success: true,
    inventory: {
      ...inventory,
      weapons: newWeapons,
    },
  };
}

/**
 * Add a passive to the player's inventory
 * @returns Result with success status and updated inventory
 */
export function addPassiveToInventory(inventory: PlayerInventory, passive: FusionWeapon): AddItemResult {
  // Validate it's a passive
  if (passive.type !== 'passive') {
    return {
      success: false,
      inventory,
      error: 'Cannot add non-passive to passive slots',
    };
  }

  // Find first empty slot
  const emptyIndex = inventory.passives.findIndex(slot => slot === null);

  if (emptyIndex === -1) {
    return {
      success: false,
      inventory,
      error: 'No empty passive slots',
    };
  }

  // Create new inventory with passive added
  const newPassives = [...inventory.passives];
  newPassives[emptyIndex] = passive;

  return {
    success: true,
    inventory: {
      ...inventory,
      passives: newPassives,
    },
  };
}

/**
 * Add an item (weapon or passive) to the appropriate slot
 */
export function addItemToInventory(inventory: PlayerInventory, item: FusionWeapon): AddItemResult {
  if (item.type === 'weapon') {
    return addWeaponToInventory(inventory, item);
  } else {
    return addPassiveToInventory(inventory, item);
  }
}

/**
 * Remove a weapon from inventory by index
 */
export function removeWeaponFromInventory(inventory: PlayerInventory, index: number): AddItemResult {
  if (index < 0 || index >= 4) {
    return {
      success: false,
      inventory,
      error: 'Invalid weapon slot index',
    };
  }

  const newWeapons = [...inventory.weapons];
  newWeapons[index] = null;

  return {
    success: true,
    inventory: {
      ...inventory,
      weapons: newWeapons,
    },
  };
}

/**
 * Remove a passive from inventory by index
 */
export function removePassiveFromInventory(inventory: PlayerInventory, index: number): AddItemResult {
  if (index < 0 || index >= 4) {
    return {
      success: false,
      inventory,
      error: 'Invalid passive slot index',
    };
  }

  const newPassives = [...inventory.passives];
  newPassives[index] = null;

  return {
    success: true,
    inventory: {
      ...inventory,
      passives: newPassives,
    },
  };
}

/**
 * Count filled weapon slots
 */
export function getWeaponCount(inventory: PlayerInventory): number {
  return inventory.weapons.filter(slot => slot !== null).length;
}

/**
 * Count filled passive slots
 */
export function getPassiveCount(inventory: PlayerInventory): number {
  return inventory.passives.filter(slot => slot !== null).length;
}

/**
 * Check if there's room for another weapon
 */
export function hasWeaponSlot(inventory: PlayerInventory): boolean {
  return getWeaponCount(inventory) < 4;
}

/**
 * Check if there's room for another passive
 */
export function hasPassiveSlot(inventory: PlayerInventory): boolean {
  return getPassiveCount(inventory) < 4;
}

/**
 * Get all non-null weapons from inventory
 */
export function getWeapons(inventory: PlayerInventory): FusionWeapon[] {
  return inventory.weapons.filter((slot): slot is FusionWeapon => slot !== null);
}

/**
 * Get all non-null passives from inventory
 */
export function getPassives(inventory: PlayerInventory): FusionWeapon[] {
  return inventory.passives.filter((slot): slot is FusionWeapon => slot !== null);
}

/**
 * Get all items (weapons + passives) from inventory
 */
export function getAllItems(inventory: PlayerInventory): FusionWeapon[] {
  return [...getWeapons(inventory), ...getPassives(inventory)];
}

/**
 * Find a weapon by ID
 */
export function findWeaponById(inventory: PlayerInventory, id: string): { weapon: FusionWeapon; index: number } | null {
  const index = inventory.weapons.findIndex(w => w?.id === id);
  if (index === -1) return null;
  return { weapon: inventory.weapons[index]!, index };
}

/**
 * Find a passive by ID
 */
export function findPassiveById(inventory: PlayerInventory, id: string): { passive: FusionWeapon; index: number } | null {
  const index = inventory.passives.findIndex(p => p?.id === id);
  if (index === -1) return null;
  return { passive: inventory.passives[index]!, index };
}

/**
 * Update a weapon at a specific index
 */
export function updateWeaponAt(inventory: PlayerInventory, index: number, weapon: FusionWeapon): PlayerInventory {
  const newWeapons = [...inventory.weapons];
  newWeapons[index] = weapon;
  return {
    ...inventory,
    weapons: newWeapons,
  };
}

/**
 * Update a passive at a specific index
 */
export function updatePassiveAt(inventory: PlayerInventory, index: number, passive: FusionWeapon): PlayerInventory {
  const newPassives = [...inventory.passives];
  newPassives[index] = passive;
  return {
    ...inventory,
    passives: newPassives,
  };
}

/**
 * Upgrade a weapon's level (1→2→3)
 */
export function upgradeWeapon(weapon: FusionWeapon): FusionWeapon {
  if (weapon.level >= 3) {
    return weapon; // Already at max level
  }

  return {
    ...weapon,
    level: (weapon.level + 1) as 1 | 2 | 3,
  };
}

/**
 * Get level 3 weapons that are eligible for fusion
 */
export function getLevel3Weapons(inventory: PlayerInventory): FusionWeapon[] {
  return getWeapons(inventory).filter(w => w.level === 3);
}
