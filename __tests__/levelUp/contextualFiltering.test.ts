/**
 * Contextual Filtering Tests for Level Up System
 *
 * Tests that the level up option generation correctly filters
 * options based on player's current inventory state.
 */

import { FusionWeapon, PlayerInventory } from '@/types';
import {
  generateLevelUpOptions,
  getAvailableNewItems,
  getUpgradableItems,
  LevelUpOption,
} from '@/utils/levelUpUtils';
import { BASE_WEAPONS, BASE_PASSIVES } from '@/utils/fusionDefinitions';

// Helper to create a test inventory
const createTestInventory = (
  weapons: (FusionWeapon | null)[] = [null, null, null, null],
  passives: (FusionWeapon | null)[] = [null, null, null, null]
): PlayerInventory => ({
  weapons: weapons.length === 4 ? weapons : [...weapons, ...Array(4 - weapons.length).fill(null)],
  passives: passives.length === 4 ? passives : [...passives, ...Array(4 - passives.length).fill(null)],
});

// Helper to create a test weapon at a specific level
const createTestWeapon = (level: 1 | 2 | 3 = 1): FusionWeapon => ({
  ...BASE_WEAPONS[0],
  id: `test-weapon-${Date.now()}-${Math.random()}`,
  level,
});

// Helper to create a test passive at a specific level
const createTestPassive = (level: 1 | 2 | 3 = 1): FusionWeapon => ({
  ...BASE_PASSIVES[0],
  id: `test-passive-${Date.now()}-${Math.random()}`,
  level,
});

describe('Contextual Filtering - Level Up Options', () => {
  describe('Player with 4 weapons', () => {
    const fullWeaponInventory = createTestInventory(
      [createTestWeapon(1), createTestWeapon(1), createTestWeapon(1), createTestWeapon(1)],
      [null, null, null, null]
    );

    it('should not offer new weapons when weapon slots are full', () => {
      const options = generateLevelUpOptions(fullWeaponInventory);
      const newWeaponOptions = options.filter(
        opt => opt.type === 'new' && opt.item.type === 'weapon'
      );
      expect(newWeaponOptions.length).toBe(0);
    });

    it('should be able to offer weapon upgrades (run multiple times for randomness)', () => {
      // Run multiple times to account for randomness
      let hasUpgrade = false;
      for (let i = 0; i < 20; i++) {
        const options = generateLevelUpOptions(fullWeaponInventory);
        const upgradeOptions = options.filter(
          opt => opt.type === 'upgrade' && opt.item.type === 'weapon'
        );
        if (upgradeOptions.length > 0) {
          hasUpgrade = true;
          break;
        }
      }
      expect(hasUpgrade).toBe(true);
    });

    it('should be able to offer new passives since passive slots are empty', () => {
      // Run multiple times to account for randomness
      let hasNewPassive = false;
      for (let i = 0; i < 20; i++) {
        const options = generateLevelUpOptions(fullWeaponInventory);
        const newPassiveOptions = options.filter(
          opt => opt.type === 'new' && opt.item.type === 'passive'
        );
        if (newPassiveOptions.length > 0) {
          hasNewPassive = true;
          break;
        }
      }
      expect(hasNewPassive).toBe(true);
    });
  });

  describe('Player with 4 passives', () => {
    const fullPassiveInventory = createTestInventory(
      [null, null, null, null],
      [createTestPassive(1), createTestPassive(1), createTestPassive(1), createTestPassive(1)]
    );

    it('should not offer new passives when passive slots are full', () => {
      const options = generateLevelUpOptions(fullPassiveInventory);
      const newPassiveOptions = options.filter(
        opt => opt.type === 'new' && opt.item.type === 'passive'
      );
      expect(newPassiveOptions.length).toBe(0);
    });

    it('should be able to offer passive upgrades (run multiple times for randomness)', () => {
      // Run multiple times to account for randomness
      let hasUpgrade = false;
      for (let i = 0; i < 20; i++) {
        const options = generateLevelUpOptions(fullPassiveInventory);
        const upgradeOptions = options.filter(
          opt => opt.type === 'upgrade' && opt.item.type === 'passive'
        );
        if (upgradeOptions.length > 0) {
          hasUpgrade = true;
          break;
        }
      }
      expect(hasUpgrade).toBe(true);
    });

    it('should be able to offer new weapons since weapon slots are empty', () => {
      // Run multiple times to account for randomness
      let hasNewWeapon = false;
      for (let i = 0; i < 20; i++) {
        const options = generateLevelUpOptions(fullPassiveInventory);
        const newWeaponOptions = options.filter(
          opt => opt.type === 'new' && opt.item.type === 'weapon'
        );
        if (newWeaponOptions.length > 0) {
          hasNewWeapon = true;
          break;
        }
      }
      expect(hasNewWeapon).toBe(true);
    });
  });

  describe('Player with room for both', () => {
    const partialInventory = createTestInventory(
      [createTestWeapon(1), createTestWeapon(2), null, null],
      [createTestPassive(1), null, null, null]
    );

    it('should offer mixed options (new items and upgrades)', () => {
      const options = generateLevelUpOptions(partialInventory);

      // Should have 3 options
      expect(options.length).toBe(3);

      // Options can be new or upgrades
      const types = new Set(options.map(o => o.type));
      expect(types.size).toBeGreaterThan(0);
    });

    it('should offer new weapons when weapon slots available', () => {
      const availableNew = getAvailableNewItems(partialInventory);
      const newWeapons = availableNew.filter(item => item.type === 'weapon');
      expect(newWeapons.length).toBeGreaterThan(0);
    });

    it('should offer new passives when passive slots available', () => {
      const availableNew = getAvailableNewItems(partialInventory);
      const newPassives = availableNew.filter(item => item.type === 'passive');
      expect(newPassives.length).toBeGreaterThan(0);
    });
  });

  describe('Player with all items at level 3', () => {
    const maxLevelInventory = createTestInventory(
      [createTestWeapon(3), createTestWeapon(3), null, null],
      [createTestPassive(3), null, null, null]
    );

    it('should not offer upgrades for level 3 items', () => {
      const upgradable = getUpgradableItems(maxLevelInventory);
      expect(upgradable.length).toBe(0);
    });

    it('should only offer new items when all existing are level 3', () => {
      const options = generateLevelUpOptions(maxLevelInventory);
      const upgradeOptions = options.filter(opt => opt.type === 'upgrade');
      expect(upgradeOptions.length).toBe(0);
    });
  });

  describe('Empty inventory', () => {
    const emptyInventory = createTestInventory();

    it('should return exactly 3 options', () => {
      const options = generateLevelUpOptions(emptyInventory);
      expect(options.length).toBe(3);
    });

    it('should only offer new items (no upgrades possible)', () => {
      const options = generateLevelUpOptions(emptyInventory);
      const upgradeOptions = options.filter(opt => opt.type === 'upgrade');
      expect(upgradeOptions.length).toBe(0);
    });

    it('should offer a mix of weapons and passives', () => {
      // Run multiple times to verify randomness
      let hasWeapon = false;
      let hasPassive = false;

      for (let i = 0; i < 20; i++) {
        const options = generateLevelUpOptions(emptyInventory);
        if (options.some(o => o.item.type === 'weapon')) hasWeapon = true;
        if (options.some(o => o.item.type === 'passive')) hasPassive = true;
        if (hasWeapon && hasPassive) break;
      }

      expect(hasWeapon).toBe(true);
      expect(hasPassive).toBe(true);
    });
  });

  describe('getUpgradableItems', () => {
    it('should return items below level 3', () => {
      const inventory = createTestInventory(
        [createTestWeapon(1), createTestWeapon(2), createTestWeapon(3), null],
        [createTestPassive(2), null, null, null]
      );

      const upgradable = getUpgradableItems(inventory);
      // Should have: weapon level 1, weapon level 2, passive level 2
      expect(upgradable.length).toBe(3);
      upgradable.forEach(item => {
        expect(item.level).toBeLessThan(3);
      });
    });

    it('should return empty array when all items at level 3', () => {
      const inventory = createTestInventory(
        [createTestWeapon(3), null, null, null],
        [createTestPassive(3), null, null, null]
      );

      const upgradable = getUpgradableItems(inventory);
      expect(upgradable.length).toBe(0);
    });
  });

  describe('getAvailableNewItems', () => {
    it('should return weapons when weapon slots available', () => {
      const inventory = createTestInventory(
        [createTestWeapon(1), null, null, null],
        [null, null, null, null]
      );

      const available = getAvailableNewItems(inventory);
      const weapons = available.filter(item => item.type === 'weapon');
      expect(weapons.length).toBeGreaterThan(0);
    });

    it('should not return weapons when weapon slots full', () => {
      const inventory = createTestInventory(
        [createTestWeapon(1), createTestWeapon(1), createTestWeapon(1), createTestWeapon(1)],
        [null, null, null, null]
      );

      const available = getAvailableNewItems(inventory);
      const weapons = available.filter(item => item.type === 'weapon');
      expect(weapons.length).toBe(0);
    });

    it('should return passives when passive slots available', () => {
      const inventory = createTestInventory(
        [null, null, null, null],
        [createTestPassive(1), null, null, null]
      );

      const available = getAvailableNewItems(inventory);
      const passives = available.filter(item => item.type === 'passive');
      expect(passives.length).toBeGreaterThan(0);
    });

    it('should not return passives when passive slots full', () => {
      const inventory = createTestInventory(
        [null, null, null, null],
        [createTestPassive(1), createTestPassive(1), createTestPassive(1), createTestPassive(1)]
      );

      const available = getAvailableNewItems(inventory);
      const passives = available.filter(item => item.type === 'passive');
      expect(passives.length).toBe(0);
    });
  });
});
