/**
 * Tests for Tier 2 Fusions in the fusion system
 *
 * 15 Tier 2 legendary fusions from combining Tier 1 fusions:
 * - Supernova (Infernal Charge + Detonation Beam)
 * - Eternal Flame (Infernal Charge + Wildfire Shard)
 * - Extinction Ray (Detonation Beam + Solar Flare)
 * - Reality Fracture (Shrapnel Storm + Prism Shatter)
 * - Infinite Echo (Resonant Blast + Cascade Chaos)
 * - Doom Network (Chain Detonator + Chaotic Web)
 * - Prismatic Inferno (Solar Flare + Mirror Beam)
 * - Soul Pyre (Blazing Echo + Burning Bonds)
 * - Plague Fire (Wildfire Shard + Chaotic Web)
 * - Quantum Entanglement (Linked Annihilation + Resonant Link)
 * - Paradox Engine (Mirror Beam + Cascade Chaos)
 * - Grid Eraser (Prism Shatter + Linked Annihilation)
 * - Scorched Earth (Burning Bonds + Chain Detonator)
 * - Phoenix Storm (Resonant Blast + Blazing Echo)
 * - Armageddon (Shrapnel Storm + Chain Detonator)
 */

import { TIER2_FUSIONS, TIER1_FUSIONS, FUSION_RECIPES } from '../../src/utils/fusionDefinitions';

describe('Tier 2 Fusions', () => {
  describe('Fusion count and type', () => {
    it('should have exactly 15 Tier 2 fusions', () => {
      expect(TIER2_FUSIONS).toHaveLength(15);
    });

    it('all Tier 2 fusions should have type: weapon', () => {
      TIER2_FUSIONS.forEach(fusion => {
        expect(fusion.type).toBe('weapon');
      });
    });

    it('all Tier 2 fusions should have fusionTier: 2', () => {
      TIER2_FUSIONS.forEach(fusion => {
        expect(fusion.fusionTier).toBe(2);
      });
    });

    it('all Tier 2 fusions should start at level 1', () => {
      TIER2_FUSIONS.forEach(fusion => {
        expect(fusion.level).toBe(1);
      });
    });
  });

  describe('Fusion parents', () => {
    it('all Tier 2 fusions should have fusionParents', () => {
      TIER2_FUSIONS.forEach(fusion => {
        expect(fusion.fusionParents).toBeDefined();
        expect(fusion.fusionParents).toHaveLength(2);
      });
    });

    it('all fusion parents should be Tier 1 fusion IDs', () => {
      const tier1FusionIds = TIER1_FUSIONS.map(f => f.id);

      TIER2_FUSIONS.forEach(fusion => {
        const [parent1, parent2] = fusion.fusionParents!;
        expect(tier1FusionIds).toContain(parent1);
        expect(tier1FusionIds).toContain(parent2);
      });
    });

    it('no fusion should have the same parent twice', () => {
      TIER2_FUSIONS.forEach(fusion => {
        const [parent1, parent2] = fusion.fusionParents!;
        expect(parent1).not.toBe(parent2);
      });
    });
  });

  describe('Fusion recipes', () => {
    it('should have 15 Tier 2 recipes', () => {
      const tier2Recipes = FUSION_RECIPES.filter(r => r.tier === 2);
      expect(tier2Recipes).toHaveLength(15);
    });

    it('each Tier 2 fusion should have a corresponding recipe', () => {
      const tier2Recipes = FUSION_RECIPES.filter(r => r.tier === 2);

      TIER2_FUSIONS.forEach(fusion => {
        const recipe = tier2Recipes.find(r => r.output === fusion.id);
        expect(recipe).toBeDefined();
      });
    });

    it('recipe inputs should match fusion parents', () => {
      const tier2Recipes = FUSION_RECIPES.filter(r => r.tier === 2);

      TIER2_FUSIONS.forEach(fusion => {
        const recipe = tier2Recipes.find(r => r.output === fusion.id)!;
        const recipeInputs = [...recipe.inputs].sort();
        const fusionParents = [...fusion.fusionParents!].sort();

        expect(recipeInputs).toEqual(fusionParents);
      });
    });
  });

  describe('Specific fusions', () => {
    it('Supernova should combine Infernal Charge + Detonation Beam', () => {
      const supernova = TIER2_FUSIONS.find(f => f.name === 'Supernova')!;
      expect(supernova).toBeDefined();
      expect(supernova.fusionParents).toContain('infernal-charge');
      expect(supernova.fusionParents).toContain('detonation-beam');
    });

    it('Armageddon should combine Shrapnel Storm + Chain Detonator', () => {
      const armageddon = TIER2_FUSIONS.find(f => f.name === 'Armageddon')!;
      expect(armageddon).toBeDefined();
      expect(armageddon.fusionParents).toContain('shrapnel-storm');
      expect(armageddon.fusionParents).toContain('chain-detonator');
    });

    it('Phoenix Storm should combine Resonant Blast + Blazing Echo', () => {
      const phoenixStorm = TIER2_FUSIONS.find(f => f.name === 'Phoenix Storm')!;
      expect(phoenixStorm).toBeDefined();
      expect(phoenixStorm.fusionParents).toContain('resonant-blast');
      expect(phoenixStorm.fusionParents).toContain('blazing-echo');
    });

    it('Quantum Entanglement should combine Linked Annihilation + Resonant Link', () => {
      const quantumEntanglement = TIER2_FUSIONS.find(f => f.name === 'Quantum Entanglement')!;
      expect(quantumEntanglement).toBeDefined();
      expect(quantumEntanglement.fusionParents).toContain('linked-annihilation');
      expect(quantumEntanglement.fusionParents).toContain('resonant-link');
    });
  });

  describe('Level effects', () => {
    it('all Tier 2 fusions should have effects for levels 1, 2, and 3', () => {
      TIER2_FUSIONS.forEach(fusion => {
        expect(fusion.levelEffects).toBeDefined();
        expect(fusion.levelEffects[1]).toBeDefined();
        expect(fusion.levelEffects[2]).toBeDefined();
        expect(fusion.levelEffects[3]).toBeDefined();
      });
    });

    it('Tier 2 fusions should NOT have limitations (lifted by fusion)', () => {
      TIER2_FUSIONS.forEach(fusion => {
        expect(fusion.limitation).toBeUndefined();
      });
    });
  });

  describe('Legendary power', () => {
    it('Tier 2 fusions should have higher base effects than Tier 1', () => {
      // Compare Supernova (Tier 2) to Infernal Charge (Tier 1)
      const supernova = TIER2_FUSIONS.find(f => f.name === 'Supernova')!;
      const infernalCharge = TIER1_FUSIONS.find(f => f.name === 'Infernal Charge')!;

      // Supernova level 1 should have higher effects than Infernal Charge level 1
      const supernovaExplosion = supernova.levelEffects[1].explosionChance || 0;
      const infernalExplosion = infernalCharge.levelEffects[1].explosionChance || 0;

      expect(supernovaExplosion).toBeGreaterThanOrEqual(infernalExplosion);
    });

    it('all Tier 2 fusions should have multiple effect types', () => {
      TIER2_FUSIONS.forEach(fusion => {
        const effects = fusion.levelEffects[1];
        const effectKeys = Object.keys(effects).filter(k => {
          const val = effects[k as keyof typeof effects];
          return typeof val === 'number' && val > 0;
        });

        // Each Tier 2 fusion should have at least 2 effect types
        expect(effectKeys.length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe('Uniqueness', () => {
    it('each Tier 2 fusion should have a unique name', () => {
      const names = TIER2_FUSIONS.map(f => f.name);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(15);
    });

    it('each Tier 2 fusion should have a unique ID', () => {
      const ids = TIER2_FUSIONS.map(f => f.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(15);
    });

    it('parent combinations should be unique across Tier 2', () => {
      const pairs = new Set<string>();

      TIER2_FUSIONS.forEach(fusion => {
        const [p1, p2] = fusion.fusionParents!.sort();
        const pairKey = `${p1}+${p2}`;
        expect(pairs.has(pairKey)).toBe(false);
        pairs.add(pairKey);
      });

      expect(pairs.size).toBe(15);
    });
  });
});
