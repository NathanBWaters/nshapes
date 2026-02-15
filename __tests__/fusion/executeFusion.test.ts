/**
 * Execute Fusion Tests
 *
 * Tests for the fusion execution mechanic:
 * - Combining two level 3 weapons into a fusion weapon
 * - Inventory management (slot freeing)
 * - Fusion result lookup
 */

import { FusionWeapon, PlayerInventory, WeaponLevel } from '@/types';
import {
  executeFusion,
  FusionResult,
} from '@/utils/fusionUtils';
import { BASE_WEAPONS, TIER1_FUSIONS, TIER2_FUSIONS, getFusionResult } from '@/utils/fusionDefinitions';

// Helper to create a test weapon at a specific level
const createTestWeapon = (
  baseWeapon: FusionWeapon,
  level: WeaponLevel = 3
): FusionWeapon => ({
  ...baseWeapon,
  id: `${baseWeapon.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

describe('Execute Fusion', () => {
  // Get test weapons
  const blastPowder = BASE_WEAPONS.find(w => w.name === 'Blast Powder')!;
  const flintSpark = BASE_WEAPONS.find(w => w.name === 'Flint Spark')!;
  const prismaticRay = BASE_WEAPONS.find(w => w.name === 'Prismatic Ray')!;
  const infernalCharge = TIER1_FUSIONS.find(w => w.name === 'Infernal Charge')!;
  const detonationBeam = TIER1_FUSIONS.find(w => w.name === 'Detonation Beam')!;

  describe('Tier 1 Fusion', () => {
    it('should fuse Blast Powder + Flint Spark = Infernal Charge', () => {
      const weaponA = createTestWeapon(blastPowder, 3);
      const weaponB = createTestWeapon(flintSpark, 3);

      const inventory = createTestInventory([weaponA, weaponB, null, null]);

      const result = executeFusion(inventory, weaponA.id, weaponB.id);

      expect(result.success).toBe(true);
      expect(result.fusionWeapon).toBeDefined();
      expect(result.fusionWeapon!.name).toBe('Infernal Charge');
    });

    it('should remove both input weapons from inventory', () => {
      const weaponA = createTestWeapon(blastPowder, 3);
      const weaponB = createTestWeapon(flintSpark, 3);

      const inventory = createTestInventory([weaponA, weaponB, null, null]);

      const result = executeFusion(inventory, weaponA.id, weaponB.id);

      // Count non-null weapons in new inventory
      const weaponCount = result.newInventory.weapons.filter(w => w !== null).length;
      expect(weaponCount).toBe(1); // Only the fusion weapon remains
    });

    it('should add fusion weapon to inventory', () => {
      const weaponA = createTestWeapon(blastPowder, 3);
      const weaponB = createTestWeapon(flintSpark, 3);

      const inventory = createTestInventory([weaponA, weaponB, null, null]);

      const result = executeFusion(inventory, weaponA.id, weaponB.id);

      // The fusion weapon should be in the inventory
      const hasInfernalCharge = result.newInventory.weapons.some(
        w => w?.name === 'Infernal Charge'
      );
      expect(hasInfernalCharge).toBe(true);
    });

    it('should create fusion weapon at level 1', () => {
      const weaponA = createTestWeapon(blastPowder, 3);
      const weaponB = createTestWeapon(flintSpark, 3);

      const inventory = createTestInventory([weaponA, weaponB, null, null]);

      const result = executeFusion(inventory, weaponA.id, weaponB.id);

      expect(result.fusionWeapon!.level).toBe(1);
    });

    it('should create Tier 1 fusion with fusionTier 1', () => {
      const weaponA = createTestWeapon(blastPowder, 3);
      const weaponB = createTestWeapon(flintSpark, 3);

      const inventory = createTestInventory([weaponA, weaponB, null, null]);

      const result = executeFusion(inventory, weaponA.id, weaponB.id);

      expect(result.fusionWeapon!.fusionTier).toBe(1);
    });

    it('should free a slot (2 weapons → 1 weapon)', () => {
      const weaponA = createTestWeapon(blastPowder, 3);
      const weaponB = createTestWeapon(flintSpark, 3);

      const inventory = createTestInventory([weaponA, weaponB, null, null]);

      const result = executeFusion(inventory, weaponA.id, weaponB.id);

      // Before: 2 weapons, After: 1 weapon = 1 freed slot
      expect(result.freedSlot).toBe(true);
    });
  });

  describe('Tier 2 Fusion', () => {
    it('should fuse two Tier 1 weapons into Tier 2', () => {
      const weaponA = createTestWeapon(infernalCharge, 3);
      const weaponB = createTestWeapon(detonationBeam, 3);

      const inventory = createTestInventory([weaponA, weaponB, null, null]);

      const result = executeFusion(inventory, weaponA.id, weaponB.id);

      expect(result.success).toBe(true);
      expect(result.fusionWeapon).toBeDefined();
      // Infernal Charge + Detonation Beam = Supernova
      expect(result.fusionWeapon!.name).toBe('Supernova');
    });

    it('should create Tier 2 fusion with fusionTier 2', () => {
      const weaponA = createTestWeapon(infernalCharge, 3);
      const weaponB = createTestWeapon(detonationBeam, 3);

      const inventory = createTestInventory([weaponA, weaponB, null, null]);

      const result = executeFusion(inventory, weaponA.id, weaponB.id);

      expect(result.fusionWeapon!.fusionTier).toBe(2);
    });
  });

  describe('Fusion Failures', () => {
    it('should fail if weapon A is not level 3', () => {
      const weaponA = createTestWeapon(blastPowder, 2); // Level 2
      const weaponB = createTestWeapon(flintSpark, 3);

      const inventory = createTestInventory([weaponA, weaponB, null, null]);

      const result = executeFusion(inventory, weaponA.id, weaponB.id);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail if weapon B is not level 3', () => {
      const weaponA = createTestWeapon(blastPowder, 3);
      const weaponB = createTestWeapon(flintSpark, 1); // Level 1

      const inventory = createTestInventory([weaponA, weaponB, null, null]);

      const result = executeFusion(inventory, weaponA.id, weaponB.id);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail if no valid recipe exists (incompatible Tier 1 fusions)', () => {
      // Infernal Charge + Wildfire Shard = Eternal Flame (valid)
      // But Infernal Charge + Shrapnel Storm has no recipe
      const shrapnelStorm = TIER1_FUSIONS.find(w => w.name === 'Shrapnel Storm')!;
      const weaponA = createTestWeapon(infernalCharge, 3);
      const weaponB = createTestWeapon(shrapnelStorm, 3);

      const inventory = createTestInventory([weaponA, weaponB, null, null]);

      const result = executeFusion(inventory, weaponA.id, weaponB.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('recipe');
    });

    it('should fail if weapon A not found in inventory', () => {
      const weaponA = createTestWeapon(blastPowder, 3);
      const weaponB = createTestWeapon(flintSpark, 3);

      const inventory = createTestInventory([weaponB, null, null, null]); // Only B in inventory

      const result = executeFusion(inventory, weaponA.id, weaponB.id);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail if weapon B not found in inventory', () => {
      const weaponA = createTestWeapon(blastPowder, 3);
      const weaponB = createTestWeapon(flintSpark, 3);

      const inventory = createTestInventory([weaponA, null, null, null]); // Only A in inventory

      const result = executeFusion(inventory, weaponA.id, weaponB.id);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should fail if trying to fuse the same weapon with itself', () => {
      const weaponA = createTestWeapon(blastPowder, 3);

      const inventory = createTestInventory([weaponA, null, null, null]);

      const result = executeFusion(inventory, weaponA.id, weaponA.id);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Inventory Immutability', () => {
    it('should not mutate the original inventory', () => {
      const weaponA = createTestWeapon(blastPowder, 3);
      const weaponB = createTestWeapon(flintSpark, 3);

      const inventory = createTestInventory([weaponA, weaponB, null, null]);
      const originalWeapons = [...inventory.weapons];

      executeFusion(inventory, weaponA.id, weaponB.id);

      // Original inventory should be unchanged
      expect(inventory.weapons).toEqual(originalWeapons);
    });
  });
});
