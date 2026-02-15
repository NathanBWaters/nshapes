/**
 * Level Progression Integration Tests
 *
 * Tests the weapon/passive level progression system:
 * - Weapons level up from 1 to 2 to 3
 * - Effects update at each level
 * - Level 3 weapons can fuse
 * - Fused weapons start at level 1
 * - Fused weapons can level to 3
 */

import { FusionWeapon, PlayerInventory } from '@/types';
import {
  BASE_WEAPONS,
  TIER1_FUSIONS,
  TIER2_FUSIONS,
} from '@/utils/fusionDefinitions';
import { upgradeItem } from '@/utils/levelUpUtils';
import { executeFusion, canFuseWeapons, getLevel3Weapons } from '@/utils/fusionUtils';

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

describe('Level Progression', () => {
  const blastPowder = BASE_WEAPONS.find(w => w.name === 'Blast Powder')!;
  const flintSpark = BASE_WEAPONS.find(w => w.name === 'Flint Spark')!;
  const infernalCharge = TIER1_FUSIONS.find(w => w.name === 'Infernal Charge')!;
  const detonationBeam = TIER1_FUSIONS.find(w => w.name === 'Detonation Beam')!;

  describe('Weapon Leveling', () => {
    it('should level weapon from 1 to 2', () => {
      const weapon = createWeaponAtLevel(blastPowder, 1);
      const upgraded = upgradeItem(weapon);

      expect(upgraded.level).toBe(2);
    });

    it('should level weapon from 2 to 3', () => {
      const weapon = createWeaponAtLevel(blastPowder, 2);
      const upgraded = upgradeItem(weapon);

      expect(upgraded.level).toBe(3);
    });

    it('should not level weapon beyond 3', () => {
      const weapon = createWeaponAtLevel(blastPowder, 3);
      const upgraded = upgradeItem(weapon);

      expect(upgraded.level).toBe(3);
    });

    it('should progress weapon through all levels', () => {
      let weapon = createWeaponAtLevel(blastPowder, 1);
      expect(weapon.level).toBe(1);

      weapon = upgradeItem(weapon);
      expect(weapon.level).toBe(2);

      weapon = upgradeItem(weapon);
      expect(weapon.level).toBe(3);

      weapon = upgradeItem(weapon);
      expect(weapon.level).toBe(3); // Should stay at 3
    });
  });

  describe('Effects Update at Each Level', () => {
    it('should have different effects at level 1', () => {
      const weapon = createWeaponAtLevel(blastPowder, 1);
      const effects = weapon.levelEffects[1];

      expect(effects.explosionChance).toBe(10);
    });

    it('should have increased effects at level 2', () => {
      const weapon = createWeaponAtLevel(blastPowder, 2);
      const effects = weapon.levelEffects[2];

      expect(effects.explosionChance).toBe(20);
    });

    it('should have maximum effects at level 3', () => {
      const weapon = createWeaponAtLevel(blastPowder, 3);
      const effects = weapon.levelEffects[3];

      expect(effects.explosionChance).toBe(30);
    });

    it('should access correct level effects based on weapon level', () => {
      const weapon1 = createWeaponAtLevel(blastPowder, 1);
      const weapon2 = createWeaponAtLevel(blastPowder, 2);
      const weapon3 = createWeaponAtLevel(blastPowder, 3);

      // Each weapon should have access to effects for its level
      expect(weapon1.levelEffects[weapon1.level].explosionChance).toBe(10);
      expect(weapon2.levelEffects[weapon2.level].explosionChance).toBe(20);
      expect(weapon3.levelEffects[weapon3.level].explosionChance).toBe(30);
    });
  });

  describe('Level 3 Weapons Can Fuse', () => {
    it('should identify level 3 weapons as fusible', () => {
      const weapon1 = createWeaponAtLevel(blastPowder, 3);
      const weapon2 = createWeaponAtLevel(flintSpark, 3);
      const inventory = createTestInventory([weapon1, weapon2, null, null]);

      const level3Weapons = getLevel3Weapons(inventory);
      expect(level3Weapons.length).toBe(2);
    });

    it('should not identify level 1 or 2 weapons as fusible', () => {
      const weapon1 = createWeaponAtLevel(blastPowder, 1);
      const weapon2 = createWeaponAtLevel(flintSpark, 2);
      const inventory = createTestInventory([weapon1, weapon2, null, null]);

      const level3Weapons = getLevel3Weapons(inventory);
      expect(level3Weapons.length).toBe(0);
    });

    it('should allow fusion of two level 3 weapons', () => {
      const weapon1 = createWeaponAtLevel(blastPowder, 3);
      const weapon2 = createWeaponAtLevel(flintSpark, 3);
      const inventory = createTestInventory([weapon1, weapon2, null, null]);

      expect(canFuseWeapons(inventory)).toBe(true);
    });

    it('should not allow fusion with less than 2 level 3 weapons', () => {
      const weapon1 = createWeaponAtLevel(blastPowder, 3);
      const weapon2 = createWeaponAtLevel(flintSpark, 2);
      const inventory = createTestInventory([weapon1, weapon2, null, null]);

      expect(canFuseWeapons(inventory)).toBe(false);
    });
  });

  describe('Fused Weapon Starts at Level 1', () => {
    it('should create Tier 1 fusion at level 1', () => {
      const weapon1 = createWeaponAtLevel(blastPowder, 3);
      const weapon2 = createWeaponAtLevel(flintSpark, 3);
      const inventory = createTestInventory([weapon1, weapon2, null, null]);

      const result = executeFusion(inventory, weapon1.id, weapon2.id);

      expect(result.success).toBe(true);
      expect(result.fusionWeapon).toBeDefined();
      expect(result.fusionWeapon!.level).toBe(1);
      expect(result.fusionWeapon!.fusionTier).toBe(1);
    });

    it('should create Tier 2 fusion at level 1', () => {
      const weapon1 = createWeaponAtLevel(infernalCharge, 3);
      const weapon2 = createWeaponAtLevel(detonationBeam, 3);
      const inventory = createTestInventory([weapon1, weapon2, null, null]);

      const result = executeFusion(inventory, weapon1.id, weapon2.id);

      expect(result.success).toBe(true);
      expect(result.fusionWeapon).toBeDefined();
      expect(result.fusionWeapon!.level).toBe(1);
      expect(result.fusionWeapon!.fusionTier).toBe(2);
    });
  });

  describe('Fused Weapon Can Level to 3', () => {
    it('should level Tier 1 fusion from 1 to 3', () => {
      const weapon1 = createWeaponAtLevel(blastPowder, 3);
      const weapon2 = createWeaponAtLevel(flintSpark, 3);
      const inventory = createTestInventory([weapon1, weapon2, null, null]);

      const result = executeFusion(inventory, weapon1.id, weapon2.id);
      expect(result.success).toBe(true);

      let fusionWeapon = result.fusionWeapon!;
      expect(fusionWeapon.level).toBe(1);

      fusionWeapon = upgradeItem(fusionWeapon);
      expect(fusionWeapon.level).toBe(2);

      fusionWeapon = upgradeItem(fusionWeapon);
      expect(fusionWeapon.level).toBe(3);
    });

    it('should have correct effects at each fusion level', () => {
      const weapon1 = createWeaponAtLevel(blastPowder, 3);
      const weapon2 = createWeaponAtLevel(flintSpark, 3);
      const inventory = createTestInventory([weapon1, weapon2, null, null]);

      const result = executeFusion(inventory, weapon1.id, weapon2.id);
      const fusionWeapon = result.fusionWeapon!;

      // Infernal Charge level effects
      expect(fusionWeapon.levelEffects[1]).toBeDefined();
      expect(fusionWeapon.levelEffects[2]).toBeDefined();
      expect(fusionWeapon.levelEffects[3]).toBeDefined();

      // Effects should scale with level
      const l1 = fusionWeapon.levelEffects[1];
      const l2 = fusionWeapon.levelEffects[2];
      const l3 = fusionWeapon.levelEffects[3];

      expect(l1).not.toEqual(l2);
      expect(l2).not.toEqual(l3);
    });

    it('should allow level 3 Tier 1 fusions to fuse into Tier 2', () => {
      // Create two level 3 Tier 1 fusions
      const tier1a = createWeaponAtLevel(infernalCharge, 3);
      const tier1b = createWeaponAtLevel(detonationBeam, 3);
      const inventory = createTestInventory([tier1a, tier1b, null, null]);

      const result = executeFusion(inventory, tier1a.id, tier1b.id);

      expect(result.success).toBe(true);
      expect(result.fusionWeapon!.fusionTier).toBe(2);
      expect(result.fusionWeapon!.name).toBe('Supernova');
      expect(result.fusionWeapon!.level).toBe(1);
    });
  });

  describe('Full Progression Chain', () => {
    it('should progress: base L1 → L3 → Tier1 L1 → L3 → Tier2 L1 → L3', () => {
      // Start with two base weapons at level 1
      let weapon1 = createWeaponAtLevel(blastPowder, 1);
      let weapon2 = createWeaponAtLevel(flintSpark, 1);

      // Level them to 3
      weapon1 = upgradeItem(upgradeItem(weapon1));
      weapon2 = upgradeItem(upgradeItem(weapon2));
      expect(weapon1.level).toBe(3);
      expect(weapon2.level).toBe(3);

      // Fuse into Tier 1
      let inventory = createTestInventory([weapon1, weapon2, null, null]);
      let result = executeFusion(inventory, weapon1.id, weapon2.id);
      expect(result.success).toBe(true);
      let tier1 = result.fusionWeapon!;
      expect(tier1.fusionTier).toBe(1);
      expect(tier1.level).toBe(1);

      // Level Tier 1 to 3
      tier1 = upgradeItem(upgradeItem(tier1));
      expect(tier1.level).toBe(3);

      // Create another Tier 1 at level 3 (Detonation Beam from Blast + Prismatic)
      const prismaticRay = BASE_WEAPONS.find(w => w.name === 'Prismatic Ray')!;
      let bp2 = createWeaponAtLevel(blastPowder, 3);
      let pr = createWeaponAtLevel(prismaticRay, 3);

      inventory = createTestInventory([bp2, pr, null, null]);
      result = executeFusion(inventory, bp2.id, pr.id);
      expect(result.success).toBe(true);
      let tier1b = result.fusionWeapon!;
      tier1b = upgradeItem(upgradeItem(tier1b));
      expect(tier1b.level).toBe(3);

      // Now fuse two level 3 Tier 1s into Tier 2
      inventory = createTestInventory([tier1, tier1b, null, null]);
      result = executeFusion(inventory, tier1.id, tier1b.id);
      expect(result.success).toBe(true);
      let tier2 = result.fusionWeapon!;
      expect(tier2.fusionTier).toBe(2);
      expect(tier2.level).toBe(1);

      // Level Tier 2 to 3
      tier2 = upgradeItem(upgradeItem(tier2));
      expect(tier2.level).toBe(3);
    });
  });
});
