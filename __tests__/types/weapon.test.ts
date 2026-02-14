/**
 * Tests for the new Weapon interface in the fusion system
 *
 * The new weapon system features:
 * - type: 'weapon' | 'passive' to distinguish between fusable weapons and non-fusable passives
 * - level: 1 | 2 | 3 for progression
 * - fusionTier: 0 | 1 | 2 for base/Tier1/Tier2 fusions
 * - fusionParents: tracking which weapons were fused to create this weapon
 * - levelEffects: effects per level instead of single effects object
 * - limitation: string describing weapon limitations (lifted by fusion)
 */

import { FusionWeapon, WeaponType, WeaponLevel, FusionTier } from '../../src/types';
import { BASE_WEAPONS, BASE_PASSIVES, TIER1_FUSIONS, TIER2_FUSIONS } from '../../src/utils/fusionDefinitions';

describe('Weapon Type System', () => {
  describe('Weapon interface fields', () => {
    it('should have type field as weapon or passive', () => {
      // Test that all base weapons have type: 'weapon'
      BASE_WEAPONS.forEach(weapon => {
        expect(weapon.type).toBe('weapon');
      });

      // Test that all base passives have type: 'passive'
      BASE_PASSIVES.forEach(passive => {
        expect(passive.type).toBe('passive');
      });
    });

    it('should have level field of 1, 2, or 3', () => {
      const validLevels: WeaponLevel[] = [1, 2, 3];

      // All weapons should start at level 1
      BASE_WEAPONS.forEach(weapon => {
        expect(validLevels).toContain(weapon.level);
        expect(weapon.level).toBe(1); // Default level is 1
      });
    });

    it('should have fusionTier of 0, 1, or 2', () => {
      const validTiers: FusionTier[] = [0, 1, 2];

      // Base weapons have fusionTier 0
      BASE_WEAPONS.forEach(weapon => {
        expect(weapon.fusionTier).toBe(0);
      });

      // Tier 1 fusions have fusionTier 1
      TIER1_FUSIONS.forEach(fusion => {
        expect(fusion.fusionTier).toBe(1);
      });

      // Tier 2 fusions have fusionTier 2
      TIER2_FUSIONS.forEach(fusion => {
        expect(fusion.fusionTier).toBe(2);
      });
    });

    it('should have level-based effects structure', () => {
      BASE_WEAPONS.forEach(weapon => {
        expect(weapon.levelEffects).toBeDefined();
        expect(weapon.levelEffects[1]).toBeDefined();
        expect(weapon.levelEffects[2]).toBeDefined();
        expect(weapon.levelEffects[3]).toBeDefined();
      });
    });
  });

  describe('Weapon type discrimination', () => {
    it('weapons should be classified as type weapon', () => {
      const weaponNames = ['Blast Powder', 'Flint Spark', 'Prismatic Ray', 'Chaos Shard', 'Echo Stone', 'Link Stone'];

      weaponNames.forEach(name => {
        const weapon = BASE_WEAPONS.find(w => w.name === name);
        expect(weapon).toBeDefined();
        expect(weapon?.type).toBe('weapon');
      });
    });

    it('passives should be classified as type passive', () => {
      const passiveNames = ['Oracle Eye', 'Field Stone', 'Growth Seed', 'Second Chance', 'Fortune Token',
                           'Life Vessel', 'Mending Charm', 'Crystal Orb', 'Seeker Lens',
                           'Scholar\'s Tome', 'Fortune\'s Favor', 'Chrono Shard', 'Time Drop'];

      passiveNames.forEach(name => {
        const passive = BASE_PASSIVES.find(p => p.name === name);
        expect(passive).toBeDefined();
        expect(passive?.type).toBe('passive');
      });
    });
  });

  describe('Fusion tier validation', () => {
    it('base weapons should have fusionTier 0', () => {
      BASE_WEAPONS.forEach(weapon => {
        expect(weapon.fusionTier).toBe(0);
      });
    });

    it('base passives should have fusionTier 0 or undefined', () => {
      BASE_PASSIVES.forEach(passive => {
        expect([0, undefined]).toContain(passive.fusionTier);
      });
    });

    it('Tier 1 fusions should have fusionTier 1', () => {
      TIER1_FUSIONS.forEach(fusion => {
        expect(fusion.fusionTier).toBe(1);
      });
    });

    it('Tier 2 fusions should have fusionTier 2', () => {
      TIER2_FUSIONS.forEach(fusion => {
        expect(fusion.fusionTier).toBe(2);
      });
    });
  });

  describe('Fusion parents tracking', () => {
    it('base weapons should not have fusionParents', () => {
      BASE_WEAPONS.forEach(weapon => {
        expect(weapon.fusionParents).toBeUndefined();
      });
    });

    it('Tier 1 fusions should have two fusionParents (both base weapons)', () => {
      TIER1_FUSIONS.forEach(fusion => {
        expect(fusion.fusionParents).toBeDefined();
        expect(fusion.fusionParents).toHaveLength(2);

        // Both parents should be base weapon IDs
        const [parent1, parent2] = fusion.fusionParents!;
        const parent1Weapon = BASE_WEAPONS.find(w => w.id === parent1);
        const parent2Weapon = BASE_WEAPONS.find(w => w.id === parent2);
        expect(parent1Weapon).toBeDefined();
        expect(parent2Weapon).toBeDefined();
      });
    });

    it('Tier 2 fusions should have two fusionParents (both Tier 1 fusions)', () => {
      TIER2_FUSIONS.forEach(fusion => {
        expect(fusion.fusionParents).toBeDefined();
        expect(fusion.fusionParents).toHaveLength(2);

        // Both parents should be Tier 1 fusion IDs
        const [parent1, parent2] = fusion.fusionParents!;
        const parent1Fusion = TIER1_FUSIONS.find(f => f.id === parent1);
        const parent2Fusion = TIER1_FUSIONS.find(f => f.id === parent2);
        expect(parent1Fusion).toBeDefined();
        expect(parent2Fusion).toBeDefined();
      });
    });
  });

  describe('Weapon limitations', () => {
    it('base weapons should have limitation defined', () => {
      BASE_WEAPONS.forEach(weapon => {
        expect(weapon.limitation).toBeDefined();
        expect(typeof weapon.limitation).toBe('string');
        expect(weapon.limitation!.length).toBeGreaterThan(0);
      });
    });

    it('passives should NOT have limitation field', () => {
      BASE_PASSIVES.forEach(passive => {
        expect(passive.limitation).toBeUndefined();
      });
    });
  });

  describe('Removed fields', () => {
    it('weapons should not have rarity field', () => {
      BASE_WEAPONS.forEach(weapon => {
        expect((weapon as any).rarity).toBeUndefined();
      });
    });

    it('weapons should not have price field', () => {
      BASE_WEAPONS.forEach(weapon => {
        expect((weapon as any).price).toBeUndefined();
      });
    });

    it('weapons should not have bridgeEffect field', () => {
      BASE_WEAPONS.forEach(weapon => {
        expect((weapon as any).bridgeEffect).toBeUndefined();
      });
    });

    it('weapons should not have capIncrease field', () => {
      BASE_WEAPONS.forEach(weapon => {
        expect((weapon as any).capIncrease).toBeUndefined();
      });
    });
  });
});
