/**
 * Fusion Chain Integration Tests
 *
 * Tests the complete fusion chain from base weapons to Tier 2:
 * - Tier 1 fusion from two base weapons
 * - Tier 1 fusion leveled to 3
 * - Tier 2 fusion from two Tier 1 fusions
 * - Tier 2 fusion has correct effects
 */

import { FusionWeapon, PlayerInventory, WeaponLevel } from '@/types';
import {
  BASE_WEAPONS,
  TIER1_FUSIONS,
  TIER2_FUSIONS,
  getFusionResult,
} from '@/utils/fusionDefinitions';
import { executeFusion } from '@/utils/fusionUtils';
import { upgradeItem } from '@/utils/levelUpUtils';

// Helper to create test inventory
const createTestInventory = (
  weapons: (FusionWeapon | null)[] = [null, null, null, null],
  passives: (FusionWeapon | null)[] = [null, null, null, null]
): PlayerInventory => ({
  weapons: weapons.length === 4 ? weapons : [...weapons, ...Array(4 - weapons.length).fill(null)] as (FusionWeapon | null)[],
  passives: passives.length === 4 ? passives : [...passives, ...Array(4 - passives.length).fill(null)] as (FusionWeapon | null)[],
});

// Helper to create weapon at level
const createWeaponAtLevel = (weapon: FusionWeapon, level: WeaponLevel): FusionWeapon => ({
  ...weapon,
  id: `${weapon.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  level,
});

describe('Fusion Chain', () => {
  const blastPowder = BASE_WEAPONS.find(w => w.name === 'Blast Powder')!;
  const flintSpark = BASE_WEAPONS.find(w => w.name === 'Flint Spark')!;
  const prismaticRay = BASE_WEAPONS.find(w => w.name === 'Prismatic Ray')!;
  const chaosShard = BASE_WEAPONS.find(w => w.name === 'Chaos Shard')!;

  const infernalCharge = TIER1_FUSIONS.find(w => w.name === 'Infernal Charge')!;
  const detonationBeam = TIER1_FUSIONS.find(w => w.name === 'Detonation Beam')!;
  const solarFlare = TIER1_FUSIONS.find(w => w.name === 'Solar Flare')!;
  const shrapnelStorm = TIER1_FUSIONS.find(w => w.name === 'Shrapnel Storm')!;

  describe('Tier 1 Fusion from Base Weapons', () => {
    it('should fuse Blast Powder + Flint Spark = Infernal Charge', () => {
      const weapon1 = createWeaponAtLevel(blastPowder, 3);
      const weapon2 = createWeaponAtLevel(flintSpark, 3);
      const inventory = createTestInventory([weapon1, weapon2, null, null]);

      const result = executeFusion(inventory, weapon1.id, weapon2.id);

      expect(result.success).toBe(true);
      expect(result.fusionWeapon).toBeDefined();
      expect(result.fusionWeapon!.name).toBe('Infernal Charge');
      expect(result.fusionWeapon!.fusionTier).toBe(1);
    });

    it('should fuse Blast Powder + Prismatic Ray = Detonation Beam', () => {
      const weapon1 = createWeaponAtLevel(blastPowder, 3);
      const weapon2 = createWeaponAtLevel(prismaticRay, 3);
      const inventory = createTestInventory([weapon1, weapon2, null, null]);

      const result = executeFusion(inventory, weapon1.id, weapon2.id);

      expect(result.success).toBe(true);
      expect(result.fusionWeapon!.name).toBe('Detonation Beam');
    });

    it('should fuse Flint Spark + Prismatic Ray = Solar Flare', () => {
      const weapon1 = createWeaponAtLevel(flintSpark, 3);
      const weapon2 = createWeaponAtLevel(prismaticRay, 3);
      const inventory = createTestInventory([weapon1, weapon2, null, null]);

      const result = executeFusion(inventory, weapon1.id, weapon2.id);

      expect(result.success).toBe(true);
      expect(result.fusionWeapon!.name).toBe('Solar Flare');
    });

    it('should fuse Blast Powder + Chaos Shard = Shrapnel Storm', () => {
      const weapon1 = createWeaponAtLevel(blastPowder, 3);
      const weapon2 = createWeaponAtLevel(chaosShard, 3);
      const inventory = createTestInventory([weapon1, weapon2, null, null]);

      const result = executeFusion(inventory, weapon1.id, weapon2.id);

      expect(result.success).toBe(true);
      expect(result.fusionWeapon!.name).toBe('Shrapnel Storm');
    });

    it('should have fusionParents set correctly', () => {
      const weapon1 = createWeaponAtLevel(blastPowder, 3);
      const weapon2 = createWeaponAtLevel(flintSpark, 3);
      const inventory = createTestInventory([weapon1, weapon2, null, null]);

      const result = executeFusion(inventory, weapon1.id, weapon2.id);

      expect(result.fusionWeapon!.fusionParents).toBeDefined();
      expect(result.fusionWeapon!.fusionParents).toContain('Blast Powder');
      expect(result.fusionWeapon!.fusionParents).toContain('Flint Spark');
    });
  });

  describe('Tier 1 Fusion Leveled to 3', () => {
    it('should create Tier 1 fusion at level 1', () => {
      const weapon1 = createWeaponAtLevel(blastPowder, 3);
      const weapon2 = createWeaponAtLevel(flintSpark, 3);
      const inventory = createTestInventory([weapon1, weapon2, null, null]);

      const result = executeFusion(inventory, weapon1.id, weapon2.id);

      expect(result.fusionWeapon!.level).toBe(1);
    });

    it('should level Tier 1 fusion to 2', () => {
      const weapon1 = createWeaponAtLevel(blastPowder, 3);
      const weapon2 = createWeaponAtLevel(flintSpark, 3);
      const inventory = createTestInventory([weapon1, weapon2, null, null]);

      const result = executeFusion(inventory, weapon1.id, weapon2.id);
      const upgraded = upgradeItem(result.fusionWeapon!);

      expect(upgraded.level).toBe(2);
    });

    it('should level Tier 1 fusion to 3', () => {
      const weapon1 = createWeaponAtLevel(blastPowder, 3);
      const weapon2 = createWeaponAtLevel(flintSpark, 3);
      const inventory = createTestInventory([weapon1, weapon2, null, null]);

      const result = executeFusion(inventory, weapon1.id, weapon2.id);
      let fusion = result.fusionWeapon!;

      fusion = upgradeItem(fusion);
      fusion = upgradeItem(fusion);

      expect(fusion.level).toBe(3);
    });

    it('should have scaling effects at each level', () => {
      const tier1 = infernalCharge;

      const l1Effects = tier1.levelEffects[1];
      const l2Effects = tier1.levelEffects[2];
      const l3Effects = tier1.levelEffects[3];

      // Infernal Charge has explosionChance and fireSpreadChance
      expect(l1Effects.explosionChance).toBeDefined();
      expect(l2Effects.explosionChance).toBeGreaterThan(l1Effects.explosionChance!);
      expect(l3Effects.explosionChance).toBeGreaterThan(l2Effects.explosionChance!);
    });
  });

  describe('Tier 2 Fusion from Two Tier 1 Fusions', () => {
    it('should fuse Infernal Charge + Detonation Beam = Supernova', () => {
      const tier1a = createWeaponAtLevel(infernalCharge, 3);
      const tier1b = createWeaponAtLevel(detonationBeam, 3);
      const inventory = createTestInventory([tier1a, tier1b, null, null]);

      const result = executeFusion(inventory, tier1a.id, tier1b.id);

      expect(result.success).toBe(true);
      expect(result.fusionWeapon!.name).toBe('Supernova');
      expect(result.fusionWeapon!.fusionTier).toBe(2);
    });

    it('should create Tier 2 fusion at level 1', () => {
      const tier1a = createWeaponAtLevel(infernalCharge, 3);
      const tier1b = createWeaponAtLevel(detonationBeam, 3);
      const inventory = createTestInventory([tier1a, tier1b, null, null]);

      const result = executeFusion(inventory, tier1a.id, tier1b.id);

      expect(result.fusionWeapon!.level).toBe(1);
    });

    it('should have Tier 1 parents for Tier 2 fusion', () => {
      const tier1a = createWeaponAtLevel(infernalCharge, 3);
      const tier1b = createWeaponAtLevel(detonationBeam, 3);
      const inventory = createTestInventory([tier1a, tier1b, null, null]);

      const result = executeFusion(inventory, tier1a.id, tier1b.id);

      expect(result.fusionWeapon!.fusionParents).toContain('Infernal Charge');
      expect(result.fusionWeapon!.fusionParents).toContain('Detonation Beam');
    });

    it('should fail to fuse incompatible Tier 1 fusions', () => {
      // Infernal Charge + Shrapnel Storm have no recipe
      const tier1a = createWeaponAtLevel(infernalCharge, 3);
      const tier1b = createWeaponAtLevel(shrapnelStorm, 3);
      const inventory = createTestInventory([tier1a, tier1b, null, null]);

      const result = executeFusion(inventory, tier1a.id, tier1b.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('recipe');
    });
  });

  describe('Tier 2 Fusion Has Correct Effects', () => {
    it('should have Supernova with powerful effects', () => {
      const supernova = TIER2_FUSIONS.find(w => w.name === 'Supernova')!;

      expect(supernova.levelEffects[1]).toBeDefined();
      expect(supernova.levelEffects[2]).toBeDefined();
      expect(supernova.levelEffects[3]).toBeDefined();
    });

    it('should have scaling effects at each level for Tier 2', () => {
      const supernova = TIER2_FUSIONS.find(w => w.name === 'Supernova')!;

      const l1 = supernova.levelEffects[1];
      const l3 = supernova.levelEffects[3];

      // Level 3 should be more powerful than level 1
      // Check at least one effect scales
      const l1Values = Object.values(l1).filter(v => typeof v === 'number');
      const l3Values = Object.values(l3).filter(v => typeof v === 'number');

      const l1Sum = l1Values.reduce((a, b) => (a as number) + (b as number), 0) as number;
      const l3Sum = l3Values.reduce((a, b) => (a as number) + (b as number), 0) as number;

      expect(l3Sum).toBeGreaterThan(l1Sum);
    });

    it('should have all Tier 2 fusions with fusionTier 2', () => {
      TIER2_FUSIONS.forEach(fusion => {
        expect(fusion.fusionTier).toBe(2);
      });
    });

    it('should have 15 Tier 2 fusions', () => {
      expect(TIER2_FUSIONS.length).toBe(15);
    });
  });

  describe('Complete Fusion Chain', () => {
    it('should complete the entire chain: Base → Tier1 → Tier2', () => {
      // Step 1: Create base weapons and level to 3
      let bp = createWeaponAtLevel(blastPowder, 1);
      let fs = createWeaponAtLevel(flintSpark, 1);
      let pr = createWeaponAtLevel(prismaticRay, 1);
      let bp2 = createWeaponAtLevel(blastPowder, 1);

      bp = upgradeItem(upgradeItem(bp));
      fs = upgradeItem(upgradeItem(fs));
      pr = upgradeItem(upgradeItem(pr));
      bp2 = upgradeItem(upgradeItem(bp2));

      expect(bp.level).toBe(3);
      expect(fs.level).toBe(3);
      expect(pr.level).toBe(3);
      expect(bp2.level).toBe(3);

      // Step 2: Fuse into Tier 1
      let inventory = createTestInventory([bp, fs, null, null]);
      let result = executeFusion(inventory, bp.id, fs.id);
      expect(result.success).toBe(true);
      let tier1a = result.fusionWeapon!;
      expect(tier1a.name).toBe('Infernal Charge');

      inventory = createTestInventory([bp2, pr, null, null]);
      result = executeFusion(inventory, bp2.id, pr.id);
      expect(result.success).toBe(true);
      let tier1b = result.fusionWeapon!;
      expect(tier1b.name).toBe('Detonation Beam');

      // Step 3: Level Tier 1 to 3
      tier1a = upgradeItem(upgradeItem(tier1a));
      tier1b = upgradeItem(upgradeItem(tier1b));
      expect(tier1a.level).toBe(3);
      expect(tier1b.level).toBe(3);

      // Step 4: Fuse into Tier 2
      inventory = createTestInventory([tier1a, tier1b, null, null]);
      result = executeFusion(inventory, tier1a.id, tier1b.id);
      expect(result.success).toBe(true);

      const tier2 = result.fusionWeapon!;
      expect(tier2.name).toBe('Supernova');
      expect(tier2.fusionTier).toBe(2);
      expect(tier2.level).toBe(1);

      // Step 5: Level Tier 2 to 3
      const tier2Maxed = upgradeItem(upgradeItem(tier2));
      expect(tier2Maxed.level).toBe(3);
    });
  });
});
