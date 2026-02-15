/**
 * Fusion Eligibility Tests
 *
 * Tests for checking if player can perform a fusion:
 * - Must have 2+ level 3 weapons
 * - Only weapons can fuse (not passives)
 */

import { FusionWeapon, PlayerInventory, WeaponLevel } from '@/types';
import {
  canFuseWeapons,
  getLevel3Weapons,
  getEligibleFusionPairs,
} from '@/utils/fusionUtils';
import { BASE_WEAPONS, BASE_PASSIVES, TIER1_FUSIONS } from '@/utils/fusionDefinitions';

// Helper to create a test weapon at a specific level
const createTestWeapon = (
  baseWeapon: FusionWeapon,
  level: WeaponLevel = 3
): FusionWeapon => ({
  ...baseWeapon,
  id: `${baseWeapon.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  level,
});

// Helper to create a test passive at a specific level
const createTestPassive = (
  basePassive: FusionWeapon,
  level: WeaponLevel = 3
): FusionWeapon => ({
  ...basePassive,
  id: `${basePassive.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

describe('Fusion Eligibility', () => {
  const blastPowder = BASE_WEAPONS.find(w => w.name === 'Blast Powder')!;
  const flintSpark = BASE_WEAPONS.find(w => w.name === 'Flint Spark')!;
  const prismaticRay = BASE_WEAPONS.find(w => w.name === 'Prismatic Ray')!;
  const oracleEye = BASE_PASSIVES.find(w => w.name === 'Oracle Eye')!;

  describe('canFuseWeapons', () => {
    it('should return false with 0 level 3 weapons', () => {
      const inventory = createTestInventory([
        createTestWeapon(blastPowder, 1),
        createTestWeapon(flintSpark, 2),
        null,
        null,
      ]);

      expect(canFuseWeapons(inventory)).toBe(false);
    });

    it('should return false with 1 level 3 weapon', () => {
      const inventory = createTestInventory([
        createTestWeapon(blastPowder, 3),
        createTestWeapon(flintSpark, 2),
        null,
        null,
      ]);

      expect(canFuseWeapons(inventory)).toBe(false);
    });

    it('should return true with 2 level 3 weapons', () => {
      const inventory = createTestInventory([
        createTestWeapon(blastPowder, 3),
        createTestWeapon(flintSpark, 3),
        null,
        null,
      ]);

      expect(canFuseWeapons(inventory)).toBe(true);
    });

    it('should return true with 3+ level 3 weapons', () => {
      const inventory = createTestInventory([
        createTestWeapon(blastPowder, 3),
        createTestWeapon(flintSpark, 3),
        createTestWeapon(prismaticRay, 3),
        null,
      ]);

      expect(canFuseWeapons(inventory)).toBe(true);
    });

    it('should ignore level 3 passives (only count weapons)', () => {
      const inventory = createTestInventory(
        [createTestWeapon(blastPowder, 3), null, null, null],
        [
          createTestPassive(oracleEye, 3),
          createTestPassive(BASE_PASSIVES[1], 3),
          null,
          null,
        ]
      );

      expect(canFuseWeapons(inventory)).toBe(false);
    });
  });

  describe('getLevel3Weapons', () => {
    it('should return empty array when no level 3 weapons', () => {
      const inventory = createTestInventory([
        createTestWeapon(blastPowder, 1),
        createTestWeapon(flintSpark, 2),
        null,
        null,
      ]);

      const level3 = getLevel3Weapons(inventory);
      expect(level3.length).toBe(0);
    });

    it('should return only level 3 weapons', () => {
      const inventory = createTestInventory([
        createTestWeapon(blastPowder, 3),
        createTestWeapon(flintSpark, 2),
        createTestWeapon(prismaticRay, 3),
        null,
      ]);

      const level3 = getLevel3Weapons(inventory);
      expect(level3.length).toBe(2);
      expect(level3.every(w => w.level === 3)).toBe(true);
    });

    it('should exclude passives', () => {
      const inventory = createTestInventory(
        [createTestWeapon(blastPowder, 3), null, null, null],
        [createTestPassive(oracleEye, 3), null, null, null]
      );

      const level3 = getLevel3Weapons(inventory);
      expect(level3.length).toBe(1);
      expect(level3[0].type).toBe('weapon');
    });

    it('should return all level 3 weapons when all are level 3', () => {
      const inventory = createTestInventory([
        createTestWeapon(blastPowder, 3),
        createTestWeapon(flintSpark, 3),
        createTestWeapon(prismaticRay, 3),
        createTestWeapon(BASE_WEAPONS[3], 3),
      ]);

      const level3 = getLevel3Weapons(inventory);
      expect(level3.length).toBe(4);
    });
  });

  describe('getEligibleFusionPairs', () => {
    it('should return empty array when no level 3 weapons', () => {
      const inventory = createTestInventory([
        createTestWeapon(blastPowder, 2),
        createTestWeapon(flintSpark, 2),
        null,
        null,
      ]);

      const pairs = getEligibleFusionPairs(inventory);
      expect(pairs.length).toBe(0);
    });

    it('should return valid fusion pairs', () => {
      // Blast Powder + Flint Spark = Infernal Charge
      const inventory = createTestInventory([
        createTestWeapon(blastPowder, 3),
        createTestWeapon(flintSpark, 3),
        null,
        null,
      ]);

      const pairs = getEligibleFusionPairs(inventory);
      expect(pairs.length).toBeGreaterThan(0);

      // Should contain the Blast Powder + Flint Spark pair
      const hasInfernalRecipe = pairs.some(
        p => p.result.name === 'Infernal Charge'
      );
      expect(hasInfernalRecipe).toBe(true);
    });

    it('should return multiple pairs when multiple valid combinations exist', () => {
      // Blast Powder + Flint Spark = Infernal Charge
      // Blast Powder + Prismatic Ray = Detonation Beam
      const inventory = createTestInventory([
        createTestWeapon(blastPowder, 3),
        createTestWeapon(flintSpark, 3),
        createTestWeapon(prismaticRay, 3),
        null,
      ]);

      const pairs = getEligibleFusionPairs(inventory);
      // Should have at least Infernal Charge and Detonation Beam recipes
      expect(pairs.length).toBeGreaterThanOrEqual(2);
    });

    it('should return pairs with weaponA, weaponB, and result', () => {
      const inventory = createTestInventory([
        createTestWeapon(blastPowder, 3),
        createTestWeapon(flintSpark, 3),
        null,
        null,
      ]);

      const pairs = getEligibleFusionPairs(inventory);
      expect(pairs.length).toBeGreaterThan(0);

      pairs.forEach(pair => {
        expect(pair.weaponA).toBeDefined();
        expect(pair.weaponB).toBeDefined();
        expect(pair.result).toBeDefined();
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty inventory', () => {
      const inventory = createTestInventory();

      expect(canFuseWeapons(inventory)).toBe(false);
      expect(getLevel3Weapons(inventory).length).toBe(0);
      expect(getEligibleFusionPairs(inventory).length).toBe(0);
    });

    it('should handle inventory with only passives', () => {
      const inventory = createTestInventory(
        [null, null, null, null],
        [
          createTestPassive(oracleEye, 3),
          createTestPassive(BASE_PASSIVES[1], 3),
          createTestPassive(BASE_PASSIVES[2], 3),
          createTestPassive(BASE_PASSIVES[3], 3),
        ]
      );

      expect(canFuseWeapons(inventory)).toBe(false);
      expect(getLevel3Weapons(inventory).length).toBe(0);
    });
  });
});
