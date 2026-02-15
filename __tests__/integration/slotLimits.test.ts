/**
 * Slot Limits Integration Tests
 *
 * Tests the inventory slot limit system:
 * - Cannot exceed 4 weapons
 * - Cannot exceed 4 passives
 * - Fusion frees a slot correctly
 * - Contextual filtering prevents overflow
 */

import { FusionWeapon, PlayerInventory } from '@/types';
import { BASE_WEAPONS, BASE_PASSIVES } from '@/utils/fusionDefinitions';
import { generateLevelUpOptions } from '@/utils/levelUpUtils';
import { executeFusion } from '@/utils/fusionUtils';

// Helper to create test inventory
const createTestInventory = (
  weapons: (FusionWeapon | null)[] = [null, null, null, null],
  passives: (FusionWeapon | null)[] = [null, null, null, null]
): PlayerInventory => ({
  weapons: weapons.length === 4 ? weapons : [...weapons, ...Array(4 - weapons.length).fill(null)] as (FusionWeapon | null)[],
  passives: passives.length === 4 ? passives : [...passives, ...Array(4 - passives.length).fill(null)] as (FusionWeapon | null)[],
});

// Helper to create weapon at level
const createWeaponAtLevel = (weapon: FusionWeapon, level: 1 | 2 | 3): FusionWeapon => ({
  ...weapon,
  id: `${weapon.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  level,
});

describe('Slot Limits', () => {
  // Get test weapons
  const blastPowder = BASE_WEAPONS.find(w => w.name === 'Blast Powder')!;
  const flintSpark = BASE_WEAPONS.find(w => w.name === 'Flint Spark')!;
  const prismaticRay = BASE_WEAPONS.find(w => w.name === 'Prismatic Ray')!;
  const chaosShard = BASE_WEAPONS.find(w => w.name === 'Chaos Shard')!;

  // Get test passives
  const lifeVessel = BASE_PASSIVES.find(p => p.name === 'Life Vessel')!;
  const mendingCharm = BASE_PASSIVES.find(p => p.name === 'Mending Charm')!;
  const secondChance = BASE_PASSIVES.find(p => p.name === 'Second Chance')!;
  const fortuneToken = BASE_PASSIVES.find(p => p.name === 'Fortune Token')!;

  describe('Weapon Slot Limits', () => {
    it('should allow up to 4 weapons', () => {
      const weapons = [
        createWeaponAtLevel(blastPowder, 1),
        createWeaponAtLevel(flintSpark, 1),
        createWeaponAtLevel(prismaticRay, 1),
        createWeaponAtLevel(chaosShard, 1),
      ];
      const inventory = createTestInventory(weapons);

      // All 4 slots should be filled
      const filledSlots = inventory.weapons.filter(w => w !== null).length;
      expect(filledSlots).toBe(4);
    });

    it('should have no empty weapon slots when full', () => {
      const weapons = [
        createWeaponAtLevel(blastPowder, 1),
        createWeaponAtLevel(flintSpark, 1),
        createWeaponAtLevel(prismaticRay, 1),
        createWeaponAtLevel(chaosShard, 1),
      ];
      const inventory = createTestInventory(weapons);

      const emptySlots = inventory.weapons.filter(w => w === null).length;
      expect(emptySlots).toBe(0);
    });
  });

  describe('Passive Slot Limits', () => {
    it('should allow up to 4 passives', () => {
      const passives = [
        createWeaponAtLevel(lifeVessel, 1),
        createWeaponAtLevel(mendingCharm, 1),
        createWeaponAtLevel(secondChance, 1),
        createWeaponAtLevel(fortuneToken, 1),
      ];
      const inventory = createTestInventory([null, null, null, null], passives);

      const filledSlots = inventory.passives.filter(p => p !== null).length;
      expect(filledSlots).toBe(4);
    });

    it('should have no empty passive slots when full', () => {
      const passives = [
        createWeaponAtLevel(lifeVessel, 1),
        createWeaponAtLevel(mendingCharm, 1),
        createWeaponAtLevel(secondChance, 1),
        createWeaponAtLevel(fortuneToken, 1),
      ];
      const inventory = createTestInventory([null, null, null, null], passives);

      const emptySlots = inventory.passives.filter(p => p === null).length;
      expect(emptySlots).toBe(0);
    });
  });

  describe('Fusion Frees Slots', () => {
    it('should free a weapon slot after fusion (2 weapons → 1 fusion)', () => {
      const weapon1 = createWeaponAtLevel(blastPowder, 3);
      const weapon2 = createWeaponAtLevel(flintSpark, 3);
      const inventory = createTestInventory([weapon1, weapon2, null, null]);

      const result = executeFusion(inventory, weapon1.id, weapon2.id);

      expect(result.success).toBe(true);
      expect(result.freedSlot).toBe(true);

      // Should have 1 weapon now (fusion result) instead of 2
      const filledSlots = result.newInventory.weapons.filter(w => w !== null).length;
      expect(filledSlots).toBe(1);
    });

    it('should go from full (4) to 3 weapons after fusion', () => {
      const weapon1 = createWeaponAtLevel(blastPowder, 3);
      const weapon2 = createWeaponAtLevel(flintSpark, 3);
      const weapon3 = createWeaponAtLevel(prismaticRay, 1);
      const weapon4 = createWeaponAtLevel(chaosShard, 1);
      const inventory = createTestInventory([weapon1, weapon2, weapon3, weapon4]);

      const result = executeFusion(inventory, weapon1.id, weapon2.id);

      expect(result.success).toBe(true);

      // 4 - 2 fused + 1 result = 3
      const filledSlots = result.newInventory.weapons.filter(w => w !== null).length;
      expect(filledSlots).toBe(3);
    });
  });

  describe('Contextual Filtering Prevents Overflow', () => {
    it('should not offer new weapons when all 4 slots are full', () => {
      const weapons = [
        createWeaponAtLevel(blastPowder, 1),
        createWeaponAtLevel(flintSpark, 1),
        createWeaponAtLevel(prismaticRay, 1),
        createWeaponAtLevel(chaosShard, 1),
      ];
      const inventory = createTestInventory(weapons);

      // Run multiple times due to randomization
      for (let i = 0; i < 10; i++) {
        const options = generateLevelUpOptions(inventory);

        // No options should be new weapons
        const newWeapons = options.filter(
          opt => opt.type === 'new' && opt.item.type === 'weapon'
        );
        expect(newWeapons.length).toBe(0);
      }
    });

    it('should not offer new passives when all 4 slots are full', () => {
      const passives = [
        createWeaponAtLevel(lifeVessel, 1),
        createWeaponAtLevel(mendingCharm, 1),
        createWeaponAtLevel(secondChance, 1),
        createWeaponAtLevel(fortuneToken, 1),
      ];
      const inventory = createTestInventory([null, null, null, null], passives);

      for (let i = 0; i < 10; i++) {
        const options = generateLevelUpOptions(inventory);

        // No options should be new passives
        const newPassives = options.filter(
          opt => opt.type === 'new' && opt.item.type === 'passive'
        );
        expect(newPassives.length).toBe(0);
      }
    });

    it('should still offer upgrades when slots are full', () => {
      const weapons = [
        createWeaponAtLevel(blastPowder, 1),
        createWeaponAtLevel(flintSpark, 1),
        createWeaponAtLevel(prismaticRay, 1),
        createWeaponAtLevel(chaosShard, 1),
      ];
      const inventory = createTestInventory(weapons);

      // Run multiple times due to randomization
      let hasUpgrade = false;
      for (let i = 0; i < 20; i++) {
        const options = generateLevelUpOptions(inventory);
        if (options.some(opt => opt.type === 'upgrade')) {
          hasUpgrade = true;
          break;
        }
      }
      expect(hasUpgrade).toBe(true);
    });

    it('should offer new items when slots are available', () => {
      const inventory = createTestInventory([null, null, null, null]);

      // Run multiple times due to randomization
      let hasNewItem = false;
      for (let i = 0; i < 20; i++) {
        const options = generateLevelUpOptions(inventory);
        if (options.some(opt => opt.type === 'new')) {
          hasNewItem = true;
          break;
        }
      }
      expect(hasNewItem).toBe(true);
    });
  });

  describe('Mixed Full Inventory', () => {
    it('should handle full weapons and partial passives', () => {
      const weapons = [
        createWeaponAtLevel(blastPowder, 1),
        createWeaponAtLevel(flintSpark, 1),
        createWeaponAtLevel(prismaticRay, 1),
        createWeaponAtLevel(chaosShard, 1),
      ];
      const passives = [
        createWeaponAtLevel(lifeVessel, 1),
        createWeaponAtLevel(mendingCharm, 1),
        null,
        null,
      ];
      const inventory = createTestInventory(weapons, passives);

      // Run multiple times
      for (let i = 0; i < 10; i++) {
        const options = generateLevelUpOptions(inventory);

        // Should not have new weapons
        const newWeapons = options.filter(
          opt => opt.type === 'new' && opt.item.type === 'weapon'
        );
        expect(newWeapons.length).toBe(0);

        // Should potentially have new passives (empty slots available)
        // Note: due to randomization, we can't guarantee passives in every run
      }
    });

    it('should handle partial weapons and full passives', () => {
      const weapons = [
        createWeaponAtLevel(blastPowder, 1),
        null,
        null,
        null,
      ];
      const passives = [
        createWeaponAtLevel(lifeVessel, 1),
        createWeaponAtLevel(mendingCharm, 1),
        createWeaponAtLevel(secondChance, 1),
        createWeaponAtLevel(fortuneToken, 1),
      ];
      const inventory = createTestInventory(weapons, passives);

      for (let i = 0; i < 10; i++) {
        const options = generateLevelUpOptions(inventory);

        // Should not have new passives
        const newPassives = options.filter(
          opt => opt.type === 'new' && opt.item.type === 'passive'
        );
        expect(newPassives.length).toBe(0);
      }
    });
  });
});
