/**
 * Tests for Tier 1 Fusions in the fusion system
 *
 * 15 Tier 1 fusions from combining base weapons:
 * - Infernal Charge (Blast + Flint)
 * - Detonation Beam (Blast + Prismatic)
 * - Shrapnel Storm (Blast + Chaos)
 * - Resonant Blast (Blast + Echo)
 * - Chain Detonator (Blast + Link)
 * - Solar Flare (Flint + Prismatic)
 * - Wildfire Shard (Flint + Chaos)
 * - Blazing Echo (Flint + Echo)
 * - Burning Bonds (Flint + Link)
 * - Prism Shatter (Prismatic + Chaos)
 * - Mirror Beam (Prismatic + Echo)
 * - Linked Annihilation (Prismatic + Link)
 * - Cascade Chaos (Chaos + Echo)
 * - Chaotic Web (Chaos + Link)
 * - Resonant Link (Echo + Link)
 */

import { TIER1_FUSIONS, BASE_WEAPONS, FUSION_RECIPES } from '../../src/utils/fusionDefinitions';

describe('Tier 1 Fusions', () => {
  describe('Fusion count and type', () => {
    it('should have exactly 15 Tier 1 fusions', () => {
      expect(TIER1_FUSIONS).toHaveLength(15);
    });

    it('all Tier 1 fusions should have type: weapon', () => {
      TIER1_FUSIONS.forEach(fusion => {
        expect(fusion.type).toBe('weapon');
      });
    });

    it('all Tier 1 fusions should have fusionTier: 1', () => {
      TIER1_FUSIONS.forEach(fusion => {
        expect(fusion.fusionTier).toBe(1);
      });
    });

    it('all Tier 1 fusions should start at level 1', () => {
      TIER1_FUSIONS.forEach(fusion => {
        expect(fusion.level).toBe(1);
      });
    });
  });

  describe('Fusion parents', () => {
    it('all Tier 1 fusions should have fusionParents', () => {
      TIER1_FUSIONS.forEach(fusion => {
        expect(fusion.fusionParents).toBeDefined();
        expect(fusion.fusionParents).toHaveLength(2);
      });
    });

    it('all fusion parents should be base weapon IDs', () => {
      const baseWeaponIds = BASE_WEAPONS.map(w => w.id);

      TIER1_FUSIONS.forEach(fusion => {
        const [parent1, parent2] = fusion.fusionParents!;
        expect(baseWeaponIds).toContain(parent1);
        expect(baseWeaponIds).toContain(parent2);
      });
    });

    it('no fusion should have the same parent twice', () => {
      TIER1_FUSIONS.forEach(fusion => {
        const [parent1, parent2] = fusion.fusionParents!;
        expect(parent1).not.toBe(parent2);
      });
    });
  });

  describe('Fusion recipes', () => {
    it('should have 15 Tier 1 recipes', () => {
      const tier1Recipes = FUSION_RECIPES.filter(r => r.tier === 1);
      expect(tier1Recipes).toHaveLength(15);
    });

    it('each Tier 1 fusion should have a corresponding recipe', () => {
      const tier1Recipes = FUSION_RECIPES.filter(r => r.tier === 1);

      TIER1_FUSIONS.forEach(fusion => {
        const recipe = tier1Recipes.find(r => r.output === fusion.id);
        expect(recipe).toBeDefined();
      });
    });

    it('recipe inputs should match fusion parents', () => {
      const tier1Recipes = FUSION_RECIPES.filter(r => r.tier === 1);

      TIER1_FUSIONS.forEach(fusion => {
        const recipe = tier1Recipes.find(r => r.output === fusion.id)!;
        const recipeInputs = [...recipe.inputs].sort();
        const fusionParents = [...fusion.fusionParents!].sort();

        expect(recipeInputs).toEqual(fusionParents);
      });
    });
  });

  describe('Specific fusions', () => {
    it('Infernal Charge should combine Blast Powder + Flint Spark', () => {
      const infernalCharge = TIER1_FUSIONS.find(f => f.name === 'Infernal Charge')!;
      expect(infernalCharge).toBeDefined();
      expect(infernalCharge.fusionParents).toContain('blast-powder');
      expect(infernalCharge.fusionParents).toContain('flint-spark');
    });

    it('Detonation Beam should combine Blast Powder + Prismatic Ray', () => {
      const detonationBeam = TIER1_FUSIONS.find(f => f.name === 'Detonation Beam')!;
      expect(detonationBeam).toBeDefined();
      expect(detonationBeam.fusionParents).toContain('blast-powder');
      expect(detonationBeam.fusionParents).toContain('prismatic-ray');
    });

    it('Solar Flare should combine Flint Spark + Prismatic Ray', () => {
      const solarFlare = TIER1_FUSIONS.find(f => f.name === 'Solar Flare')!;
      expect(solarFlare).toBeDefined();
      expect(solarFlare.fusionParents).toContain('flint-spark');
      expect(solarFlare.fusionParents).toContain('prismatic-ray');
    });

    it('Resonant Link should combine Echo Stone + Link Stone', () => {
      const resonantLink = TIER1_FUSIONS.find(f => f.name === 'Resonant Link')!;
      expect(resonantLink).toBeDefined();
      expect(resonantLink.fusionParents).toContain('echo-stone');
      expect(resonantLink.fusionParents).toContain('link-stone');
    });
  });

  describe('Level effects', () => {
    it('all Tier 1 fusions should have effects for levels 1, 2, and 3', () => {
      TIER1_FUSIONS.forEach(fusion => {
        expect(fusion.levelEffects).toBeDefined();
        expect(fusion.levelEffects[1]).toBeDefined();
        expect(fusion.levelEffects[2]).toBeDefined();
        expect(fusion.levelEffects[3]).toBeDefined();
      });
    });

    it('Tier 1 fusions should NOT have limitations (lifted by fusion)', () => {
      TIER1_FUSIONS.forEach(fusion => {
        expect(fusion.limitation).toBeUndefined();
      });
    });

    it('Tier 1 fusions should combine effects from both parents', () => {
      // Test Infernal Charge (Blast + Fire) has both explosion and fire effects
      const infernalCharge = TIER1_FUSIONS.find(f => f.name === 'Infernal Charge')!;
      expect(infernalCharge.levelEffects[1].explosionChance).toBeDefined();
      expect(infernalCharge.levelEffects[1].fireSpreadChance).toBeDefined();

      // Test Solar Flare (Fire + Laser) has both fire and laser effects
      const solarFlare = TIER1_FUSIONS.find(f => f.name === 'Solar Flare')!;
      expect(solarFlare.levelEffects[1].fireSpreadChance).toBeDefined();
      expect(solarFlare.levelEffects[1].laserChance).toBeDefined();
    });
  });

  describe('Unique combinations', () => {
    it('each base weapon pair should produce exactly one Tier 1 fusion', () => {
      // 6 base weapons = C(6,2) = 15 unique pairs = 15 Tier 1 fusions
      const pairs = new Set<string>();

      TIER1_FUSIONS.forEach(fusion => {
        const [p1, p2] = fusion.fusionParents!.sort();
        const pairKey = `${p1}+${p2}`;
        expect(pairs.has(pairKey)).toBe(false);
        pairs.add(pairKey);
      });

      expect(pairs.size).toBe(15);
    });
  });
});
