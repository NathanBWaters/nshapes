/**
 * Tests for Base Weapons in the fusion system
 *
 * 6 base weapons that can fuse at level 3:
 * - Blast Powder (explosion)
 * - Flint Spark (fire)
 * - Prismatic Ray (laser)
 * - Chaos Shard (ricochet)
 * - Echo Stone (echo)
 * - Link Stone (connector)
 */

import { BASE_WEAPONS } from '../../src/utils/fusionDefinitions';

describe('Base Weapons', () => {
  describe('Weapon count and type', () => {
    it('should have exactly 6 base weapons', () => {
      expect(BASE_WEAPONS).toHaveLength(6);
    });

    it('all base weapons should have type: weapon', () => {
      BASE_WEAPONS.forEach(weapon => {
        expect(weapon.type).toBe('weapon');
      });
    });

    it('all base weapons should have fusionTier: 0', () => {
      BASE_WEAPONS.forEach(weapon => {
        expect(weapon.fusionTier).toBe(0);
      });
    });

    it('all base weapons should start at level 1', () => {
      BASE_WEAPONS.forEach(weapon => {
        expect(weapon.level).toBe(1);
      });
    });
  });

  describe('Level effects structure', () => {
    it('all base weapons should have effects for levels 1, 2, and 3', () => {
      BASE_WEAPONS.forEach(weapon => {
        expect(weapon.levelEffects).toBeDefined();
        expect(weapon.levelEffects[1]).toBeDefined();
        expect(weapon.levelEffects[2]).toBeDefined();
        expect(weapon.levelEffects[3]).toBeDefined();
      });
    });

    it('all base weapons should have limitation defined', () => {
      BASE_WEAPONS.forEach(weapon => {
        expect(weapon.limitation).toBeDefined();
        expect(typeof weapon.limitation).toBe('string');
        expect(weapon.limitation!.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Blast Powder', () => {
    const blastPowder = BASE_WEAPONS.find(w => w.name === 'Blast Powder')!;

    it('should exist', () => {
      expect(blastPowder).toBeDefined();
    });

    it('should have explosion special effect', () => {
      expect(blastPowder.specialEffect).toBe('explosive');
    });

    it('should have incremental explosion chance (10% → 20% → 30%)', () => {
      expect(blastPowder.levelEffects[1].explosionChance).toBe(10);
      expect(blastPowder.levelEffects[2].explosionChance).toBe(20);
      expect(blastPowder.levelEffects[3].explosionChance).toBe(30);
    });

    it('should have color limitation', () => {
      expect(blastPowder.limitation).toContain('color');
    });
  });

  describe('Flint Spark', () => {
    const flintSpark = BASE_WEAPONS.find(w => w.name === 'Flint Spark')!;

    it('should exist', () => {
      expect(flintSpark).toBeDefined();
    });

    it('should have fire special effect', () => {
      expect(flintSpark.specialEffect).toBe('fire');
    });

    it('should have incremental fire spread chance (10% → 20% → 30%)', () => {
      expect(flintSpark.levelEffects[1].fireSpreadChance).toBe(10);
      expect(flintSpark.levelEffects[2].fireSpreadChance).toBe(20);
      expect(flintSpark.levelEffects[3].fireSpreadChance).toBe(30);
    });

    it('should have color limitation for fire spread', () => {
      expect(flintSpark.limitation).toContain('same-color');
    });
  });

  describe('Prismatic Ray', () => {
    const prismaticRay = BASE_WEAPONS.find(w => w.name === 'Prismatic Ray')!;

    it('should exist', () => {
      expect(prismaticRay).toBeDefined();
    });

    it('should have laser special effect', () => {
      expect(prismaticRay.specialEffect).toBe('laser');
    });

    it('should have incremental laser chance (5% → 10% → 15%)', () => {
      expect(prismaticRay.levelEffects[1].laserChance).toBe(5);
      expect(prismaticRay.levelEffects[2].laserChance).toBe(10);
      expect(prismaticRay.levelEffects[3].laserChance).toBe(15);
    });

    it('should have direction limitation', () => {
      expect(prismaticRay.limitation).toContain('direction');
    });
  });

  describe('Chaos Shard', () => {
    const chaosShard = BASE_WEAPONS.find(w => w.name === 'Chaos Shard')!;

    it('should exist', () => {
      expect(chaosShard).toBeDefined();
    });

    it('should have ricochet special effect', () => {
      expect(chaosShard.specialEffect).toBe('ricochet');
    });

    it('should have incremental ricochet chance (10% → 20% → 30%)', () => {
      expect(chaosShard.levelEffects[1].ricochetChance).toBe(10);
      expect(chaosShard.levelEffects[2].ricochetChance).toBe(20);
      expect(chaosShard.levelEffects[3].ricochetChance).toBe(30);
    });

    it('should have ricochet limit', () => {
      expect(chaosShard.limitation).toContain('ricochet');
    });
  });

  describe('Echo Stone', () => {
    const echoStone = BASE_WEAPONS.find(w => w.name === 'Echo Stone')!;

    it('should exist', () => {
      expect(echoStone).toBeDefined();
    });

    it('should have echo special effect', () => {
      expect(echoStone.specialEffect).toBe('echo');
    });

    it('should have incremental echo chance (8% → 15% → 22%)', () => {
      expect(echoStone.levelEffects[1].echoChance).toBe(8);
      expect(echoStone.levelEffects[2].echoChance).toBe(15);
      expect(echoStone.levelEffects[3].echoChance).toBe(22);
    });

    it('should have weapon effect limitation', () => {
      expect(echoStone.limitation).toContain('weapon');
    });
  });

  describe('Link Stone', () => {
    const linkStone = BASE_WEAPONS.find(w => w.name === 'Link Stone')!;

    it('should exist', () => {
      expect(linkStone).toBeDefined();
    });

    it('should have connector special effect', () => {
      expect(linkStone.specialEffect).toBe('connector');
    });

    it('should have incremental connection chance (15% → 25% → 35%)', () => {
      expect(linkStone.levelEffects[1].connectionChance).toBe(15);
      expect(linkStone.levelEffects[2].connectionChance).toBe(25);
      expect(linkStone.levelEffects[3].connectionChance).toBe(35);
    });

    it('should have connection limit', () => {
      expect(linkStone.limitation).toContain('connection');
    });
  });

  describe('Level progression consistency', () => {
    it('all weapons should have effects that increase with level', () => {
      BASE_WEAPONS.forEach(weapon => {
        const effects1 = weapon.levelEffects[1];
        const effects2 = weapon.levelEffects[2];
        const effects3 = weapon.levelEffects[3];

        // Find the primary effect for each weapon
        const primaryEffectKey = Object.keys(effects1)[0] as keyof typeof effects1;

        if (typeof effects1[primaryEffectKey] === 'number') {
          const val1 = effects1[primaryEffectKey] as number;
          const val2 = effects2[primaryEffectKey] as number;
          const val3 = effects3[primaryEffectKey] as number;

          expect(val2).toBeGreaterThan(val1);
          expect(val3).toBeGreaterThan(val2);
        }
      });
    });

    it('all weapons should NOT have fusionParents (base weapons)', () => {
      BASE_WEAPONS.forEach(weapon => {
        expect(weapon.fusionParents).toBeUndefined();
      });
    });
  });
});
