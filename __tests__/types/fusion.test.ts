/**
 * Tests for the Fusion Recipe system
 *
 * The fusion system features:
 * - 15 Tier 1 fusions (weapon + weapon combinations)
 * - 15 Tier 2 fusions (Tier 1 fusion + Tier 1 fusion combinations)
 * - Total of 30 recipes
 */

import { FusionRecipe, FusionTier } from '../../src/types';
import { FUSION_RECIPES, TIER1_FUSIONS, TIER2_FUSIONS, getFusionResult, canFuse } from '../../src/utils/fusionDefinitions';
import { BASE_WEAPONS } from '../../src/utils/fusionDefinitions';

describe('Fusion Recipe System', () => {
  describe('FUSION_RECIPES constant', () => {
    it('should have exactly 30 recipes (15 Tier 1 + 15 Tier 2)', () => {
      expect(FUSION_RECIPES).toHaveLength(30);
    });

    it('should have 15 Tier 1 recipes', () => {
      const tier1Recipes = FUSION_RECIPES.filter(r => r.tier === 1);
      expect(tier1Recipes).toHaveLength(15);
    });

    it('should have 15 Tier 2 recipes', () => {
      const tier2Recipes = FUSION_RECIPES.filter(r => r.tier === 2);
      expect(tier2Recipes).toHaveLength(15);
    });

    it('all Tier 1 recipes should have tier: 1', () => {
      const tier1Recipes = FUSION_RECIPES.filter(r => r.tier === 1);
      tier1Recipes.forEach(recipe => {
        expect(recipe.tier).toBe(1);
      });
    });

    it('all Tier 2 recipes should have tier: 2', () => {
      const tier2Recipes = FUSION_RECIPES.filter(r => r.tier === 2);
      tier2Recipes.forEach(recipe => {
        expect(recipe.tier).toBe(2);
      });
    });
  });

  describe('FusionRecipe interface', () => {
    it('each recipe should have inputs array with 2 elements', () => {
      FUSION_RECIPES.forEach(recipe => {
        expect(recipe.inputs).toBeDefined();
        expect(Array.isArray(recipe.inputs)).toBe(true);
        expect(recipe.inputs).toHaveLength(2);
      });
    });

    it('each recipe should have output string', () => {
      FUSION_RECIPES.forEach(recipe => {
        expect(recipe.output).toBeDefined();
        expect(typeof recipe.output).toBe('string');
        expect(recipe.output.length).toBeGreaterThan(0);
      });
    });

    it('each recipe should have tier 1 or 2', () => {
      const validTiers: FusionTier[] = [1, 2];
      FUSION_RECIPES.forEach(recipe => {
        expect(validTiers).toContain(recipe.tier);
      });
    });
  });

  describe('Tier 1 fusion recipes', () => {
    const tier1Recipes = FUSION_RECIPES.filter(r => r.tier === 1);

    it('should include Blast Powder + Flint Spark = Infernal Charge', () => {
      const recipe = tier1Recipes.find(r =>
        (r.inputs.includes('blast-powder') && r.inputs.includes('flint-spark'))
      );
      expect(recipe).toBeDefined();
      expect(recipe?.output).toBe('infernal-charge');
    });

    it('should include Blast Powder + Prismatic Ray = Detonation Beam', () => {
      const recipe = tier1Recipes.find(r =>
        (r.inputs.includes('blast-powder') && r.inputs.includes('prismatic-ray'))
      );
      expect(recipe).toBeDefined();
      expect(recipe?.output).toBe('detonation-beam');
    });

    it('should include Echo Stone + Link Stone = Resonant Link', () => {
      const recipe = tier1Recipes.find(r =>
        (r.inputs.includes('echo-stone') && r.inputs.includes('link-stone'))
      );
      expect(recipe).toBeDefined();
      expect(recipe?.output).toBe('resonant-link');
    });
  });

  describe('Tier 2 fusion recipes', () => {
    const tier2Recipes = FUSION_RECIPES.filter(r => r.tier === 2);

    it('should include Infernal Charge + Detonation Beam = Supernova', () => {
      const recipe = tier2Recipes.find(r =>
        (r.inputs.includes('infernal-charge') && r.inputs.includes('detonation-beam'))
      );
      expect(recipe).toBeDefined();
      expect(recipe?.output).toBe('supernova');
    });

    it('should include Shrapnel Storm + Chain Detonator = Armageddon', () => {
      const recipe = tier2Recipes.find(r =>
        (r.inputs.includes('shrapnel-storm') && r.inputs.includes('chain-detonator'))
      );
      expect(recipe).toBeDefined();
      expect(recipe?.output).toBe('armageddon');
    });
  });

  describe('getFusionResult function', () => {
    it('should return correct fusion for valid Tier 1 pair', () => {
      const blastPowder = BASE_WEAPONS.find(w => w.id === 'blast-powder')!;
      const flintSpark = BASE_WEAPONS.find(w => w.id === 'flint-spark')!;

      const result = getFusionResult(blastPowder, flintSpark);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('infernal-charge');
    });

    it('should return null for invalid pairs', () => {
      const blastPowder = BASE_WEAPONS.find(w => w.id === 'blast-powder')!;
      // Same weapon cannot fuse with itself
      const result = getFusionResult(blastPowder, blastPowder);

      expect(result).toBeNull();
    });

    it('should be commutative (A+B = B+A)', () => {
      const blastPowder = BASE_WEAPONS.find(w => w.id === 'blast-powder')!;
      const flintSpark = BASE_WEAPONS.find(w => w.id === 'flint-spark')!;

      const result1 = getFusionResult(blastPowder, flintSpark);
      const result2 = getFusionResult(flintSpark, blastPowder);

      expect(result1?.id).toBe(result2?.id);
    });

    it('should return correct fusion for valid Tier 2 pair', () => {
      const infernalCharge = TIER1_FUSIONS.find(f => f.id === 'infernal-charge')!;
      const detonationBeam = TIER1_FUSIONS.find(f => f.id === 'detonation-beam')!;

      const result = getFusionResult(infernalCharge, detonationBeam);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('supernova');
    });
  });

  describe('canFuse function', () => {
    it('should return true for valid Tier 1 weapon pairs at level 3', () => {
      const blastPowder = { ...BASE_WEAPONS.find(w => w.id === 'blast-powder')!, level: 3 as const };
      const flintSpark = { ...BASE_WEAPONS.find(w => w.id === 'flint-spark')!, level: 3 as const };

      expect(canFuse(blastPowder, flintSpark)).toBe(true);
    });

    it('should return false for weapons below level 3', () => {
      const blastPowder = { ...BASE_WEAPONS.find(w => w.id === 'blast-powder')!, level: 2 as const };
      const flintSpark = { ...BASE_WEAPONS.find(w => w.id === 'flint-spark')!, level: 3 as const };

      expect(canFuse(blastPowder, flintSpark)).toBe(false);
    });

    it('should return false for weapon + passive', () => {
      // Passives cannot fuse
      const blastPowder = { ...BASE_WEAPONS.find(w => w.id === 'blast-powder')!, level: 3 as const };
      // Simulate a passive with weapon properties for this test
      const passive = {
        ...blastPowder,
        type: 'passive' as const,
        id: 'oracle-eye'
      };

      expect(canFuse(blastPowder, passive)).toBe(false);
    });

    it('should return false for passive + passive', () => {
      // Two passives should not be able to fuse
      const passive1 = {
        ...BASE_WEAPONS[0],
        type: 'passive' as const,
        id: 'oracle-eye',
        level: 3 as const
      };
      const passive2 = {
        ...BASE_WEAPONS[0],
        type: 'passive' as const,
        id: 'field-stone',
        level: 3 as const
      };

      expect(canFuse(passive1, passive2)).toBe(false);
    });

    it('should return false for weapons with no valid recipe', () => {
      // Same weapon cannot fuse with itself
      const blastPowder = { ...BASE_WEAPONS.find(w => w.id === 'blast-powder')!, level: 3 as const };

      expect(canFuse(blastPowder, blastPowder)).toBe(false);
    });
  });
});
