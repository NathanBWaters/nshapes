import { EFFECT_CAPS, getEffectiveStat, isStatCapped, EffectCapType } from '@/utils/gameConfig';
import { DEFAULT_EFFECT_CAPS } from '@/utils/gameDefinitions';
import { EffectCaps } from '@/types';

describe('Effect Cap System', () => {
  describe('EFFECT_CAPS configuration', () => {
    it('should have all required effect types', () => {
      const expectedEffects: EffectCapType[] = [
        'echo', 'laser', 'graceGain', 'explosion', 'hint', 'timeGain',
        'healing', 'fire', 'ricochet', 'boardGrowth', 'coinGain', 'xpGain'
      ];

      expectedEffects.forEach(effect => {
        expect(EFFECT_CAPS[effect]).toBeDefined();
        expect(EFFECT_CAPS[effect].defaultCap).toBeGreaterThan(0);
        expect(EFFECT_CAPS[effect].capIncrease).toBeGreaterThanOrEqual(0);
      });
    });

  });


  describe('getEffectiveStat', () => {
    it('should return accumulated value when under cap', () => {
      expect(getEffectiveStat(10, 25)).toBe(10);
      expect(getEffectiveStat(0, 25)).toBe(0);
      expect(getEffectiveStat(24, 25)).toBe(24);
    });

    it('should return cap when accumulated equals cap', () => {
      expect(getEffectiveStat(25, 25)).toBe(25);
      expect(getEffectiveStat(100, 100)).toBe(100);
    });

    it('should return cap when accumulated exceeds cap', () => {
      expect(getEffectiveStat(30, 25)).toBe(25);
      expect(getEffectiveStat(100, 25)).toBe(25);
      expect(getEffectiveStat(150, 100)).toBe(100);
    });
  });

  describe('isStatCapped', () => {
    it('should return false when under cap', () => {
      expect(isStatCapped(10, 25)).toBe(false);
      expect(isStatCapped(0, 25)).toBe(false);
      expect(isStatCapped(24, 25)).toBe(false);
    });

    it('should return true when at cap', () => {
      expect(isStatCapped(25, 25)).toBe(true);
      expect(isStatCapped(100, 100)).toBe(true);
    });

    it('should return true when over cap', () => {
      expect(isStatCapped(30, 25)).toBe(true);
      expect(isStatCapped(100, 25)).toBe(true);
    });
  });

  describe('EffectCaps type', () => {
    it('should allow cap modifications', () => {
      const caps: EffectCaps = { ...DEFAULT_EFFECT_CAPS };

      // Increase echo cap
      caps.echo += EFFECT_CAPS.echo.capIncrease;
      expect(caps.echo).toBe(30); // 25 + 5

      // Increase explosion cap
      caps.explosion += EFFECT_CAPS.explosion.capIncrease;
      expect(caps.explosion).toBe(50); // 40 + 10
    });
  });
});
