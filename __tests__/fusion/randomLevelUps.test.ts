/**
 * Random Level Ups Tests
 *
 * Tests for the random level up mechanic when player chooses
 * "Take Chance" instead of fusing weapons.
 */

import { FusionWeapon, PlayerInventory, WeaponLevel } from '@/types';
import { executeRandomLevelUps, RandomLevelUpResult } from '@/utils/fusionUtils';
import { BASE_WEAPONS, BASE_PASSIVES } from '@/utils/fusionDefinitions';

// Helper to create a test weapon at a specific level
const createTestWeapon = (level: WeaponLevel = 1): FusionWeapon => ({
  ...BASE_WEAPONS[0],
  id: `test-weapon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  level,
});

// Helper to create a test passive at a specific level
const createTestPassive = (level: WeaponLevel = 1): FusionWeapon => ({
  ...BASE_PASSIVES[0],
  id: `test-passive-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  level,
});

// Helper to create a test inventory
const createTestInventory = (
  weapons: (FusionWeapon | null)[] = [null, null, null, null],
  passives: (FusionWeapon | null)[] = [null, null, null, null]
): PlayerInventory => ({
  weapons: weapons.length === 4 ? weapons : [...weapons, ...Array(4 - weapons.length).fill(null)],
  passives: passives.length === 4 ? passives : [...passives, ...Array(4 - passives.length).fill(null)],
});

describe('Random Level Ups', () => {
  describe('executeRandomLevelUps', () => {
    it('should return 1-5 upgrades', () => {
      const inventory = createTestInventory(
        [createTestWeapon(1), createTestWeapon(1), createTestWeapon(1), createTestWeapon(1)],
        [createTestPassive(1), createTestPassive(1), createTestPassive(1), createTestPassive(1)]
      );

      // Run multiple times to verify range
      const upgradeCounts: number[] = [];
      for (let i = 0; i < 50; i++) {
        const result = executeRandomLevelUps(inventory);
        upgradeCounts.push(result.upgradesApplied);
      }

      const min = Math.min(...upgradeCounts);
      const max = Math.max(...upgradeCounts);

      expect(min).toBeGreaterThanOrEqual(1);
      expect(max).toBeLessThanOrEqual(5);
    });

    it('should apply upgrades to eligible items only', () => {
      const inventory = createTestInventory(
        [createTestWeapon(1), createTestWeapon(2), null, null],
        [createTestPassive(3), null, null, null] // Level 3 = not eligible
      );

      const result = executeRandomLevelUps(inventory);

      // Verify the level 3 passive wasn't upgraded
      const level3Passive = result.newInventory.passives[0];
      expect(level3Passive?.level).toBe(3);

      // Verify at least some item was upgraded
      expect(result.upgradesApplied).toBeGreaterThanOrEqual(1);
    });

    it('should not upgrade items at level 3', () => {
      const inventory = createTestInventory(
        [createTestWeapon(3), createTestWeapon(3), null, null],
        [createTestPassive(3), createTestPassive(3), null, null]
      );

      const result = executeRandomLevelUps(inventory);

      // No items can be upgraded
      expect(result.upgradesApplied).toBe(0);
    });

    it('should apply multiple upgrades to different items', () => {
      const weapon1 = createTestWeapon(1);
      const weapon2 = createTestWeapon(1);
      const passive1 = createTestPassive(1);
      const passive2 = createTestPassive(1);

      const inventory = createTestInventory(
        [weapon1, weapon2, null, null],
        [passive1, passive2, null, null]
      );

      // Run until we get a case with multiple upgrades spread across items
      let foundMultiItem = false;
      for (let i = 0; i < 50; i++) {
        const result = executeRandomLevelUps(inventory);

        if (result.upgradesApplied >= 2) {
          // Check if upgrades were applied to different items
          const upgradedIds = new Set(result.upgradedItems.map(item => item.id));
          if (upgradedIds.size >= 2) {
            foundMultiItem = true;
            break;
          }
        }
      }

      expect(foundMultiItem).toBe(true);
    });

    it('should apply all upgrades to one item if only one eligible', () => {
      const weapon = createTestWeapon(1);

      const inventory = createTestInventory(
        [weapon, createTestWeapon(3), createTestWeapon(3), null],
        [createTestPassive(3), null, null, null]
      );

      const result = executeRandomLevelUps(inventory);

      // Only the level 1 weapon can be upgraded
      // It can go 1 -> 2 -> 3, so max 2 upgrades
      expect(result.upgradesApplied).toBeLessThanOrEqual(2);
    });

    it('should not mutate the original inventory', () => {
      const weapon = createTestWeapon(1);
      const inventory = createTestInventory([weapon, null, null, null]);
      const originalLevel = weapon.level;

      executeRandomLevelUps(inventory);

      // Original weapon should be unchanged
      expect(weapon.level).toBe(originalLevel);
    });

    it('should track which items were upgraded', () => {
      const inventory = createTestInventory(
        [createTestWeapon(1), createTestWeapon(1), null, null],
        [createTestPassive(1), null, null, null]
      );

      const result = executeRandomLevelUps(inventory);

      expect(result.upgradedItems).toBeDefined();
      expect(result.upgradedItems.length).toBe(result.upgradesApplied);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty inventory', () => {
      const inventory = createTestInventory();

      const result = executeRandomLevelUps(inventory);

      expect(result.upgradesApplied).toBe(0);
      expect(result.upgradedItems.length).toBe(0);
    });

    it('should handle inventory with only level 3 items', () => {
      const inventory = createTestInventory(
        [createTestWeapon(3), createTestWeapon(3), createTestWeapon(3), createTestWeapon(3)],
        [createTestPassive(3), createTestPassive(3), createTestPassive(3), createTestPassive(3)]
      );

      const result = executeRandomLevelUps(inventory);

      expect(result.upgradesApplied).toBe(0);
    });

    it('should handle inventory with single upgradable item', () => {
      const inventory = createTestInventory([createTestWeapon(2), null, null, null]);

      const result = executeRandomLevelUps(inventory);

      // Only one upgrade possible (2 -> 3)
      expect(result.upgradesApplied).toBeLessThanOrEqual(1);
    });
  });
});
