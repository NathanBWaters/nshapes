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

    it('should have correct default cap values', () => {
      // Verify specific caps from the spec
      expect(EFFECT_CAPS.echo.defaultCap).toBe(25);
      expect(EFFECT_CAPS.laser.defaultCap).toBe(30);
      expect(EFFECT_CAPS.graceGain.defaultCap).toBe(30);
      expect(EFFECT_CAPS.explosion.defaultCap).toBe(40);
      expect(EFFECT_CAPS.hint.defaultCap).toBe(40);
      expect(EFFECT_CAPS.timeGain.defaultCap).toBe(40);
      expect(EFFECT_CAPS.healing.defaultCap).toBe(50);
      expect(EFFECT_CAPS.fire.defaultCap).toBe(50);
      expect(EFFECT_CAPS.ricochet.defaultCap).toBe(60);
      expect(EFFECT_CAPS.boardGrowth.defaultCap).toBe(60);
      expect(EFFECT_CAPS.coinGain.defaultCap).toBe(70);
      expect(EFFECT_CAPS.xpGain.defaultCap).toBe(100);
    });

    it('should have correct cap increase values', () => {
      // Verify cap increases from the spec
      expect(EFFECT_CAPS.echo.capIncrease).toBe(5);
      expect(EFFECT_CAPS.laser.capIncrease).toBe(5);
      expect(EFFECT_CAPS.graceGain.capIncrease).toBe(5);
      expect(EFFECT_CAPS.explosion.capIncrease).toBe(10);
      expect(EFFECT_CAPS.hint.capIncrease).toBe(10);
      expect(EFFECT_CAPS.timeGain.capIncrease).toBe(10);
      expect(EFFECT_CAPS.healing.capIncrease).toBe(10);
      expect(EFFECT_CAPS.fire.capIncrease).toBe(10);
      expect(EFFECT_CAPS.ricochet.capIncrease).toBe(10);
      expect(EFFECT_CAPS.boardGrowth.capIncrease).toBe(10);
      expect(EFFECT_CAPS.coinGain.capIncrease).toBe(15);
      expect(EFFECT_CAPS.xpGain.capIncrease).toBe(0); // XP has no cap increase
    });
  });

  describe('DEFAULT_EFFECT_CAPS', () => {
    it('should match EFFECT_CAPS default values', () => {
      expect(DEFAULT_EFFECT_CAPS.echo).toBe(EFFECT_CAPS.echo.defaultCap);
      expect(DEFAULT_EFFECT_CAPS.laser).toBe(EFFECT_CAPS.laser.defaultCap);
      expect(DEFAULT_EFFECT_CAPS.graceGain).toBe(EFFECT_CAPS.graceGain.defaultCap);
      expect(DEFAULT_EFFECT_CAPS.explosion).toBe(EFFECT_CAPS.explosion.defaultCap);
      expect(DEFAULT_EFFECT_CAPS.hint).toBe(EFFECT_CAPS.hint.defaultCap);
      expect(DEFAULT_EFFECT_CAPS.timeGain).toBe(EFFECT_CAPS.timeGain.defaultCap);
      expect(DEFAULT_EFFECT_CAPS.healing).toBe(EFFECT_CAPS.healing.defaultCap);
      expect(DEFAULT_EFFECT_CAPS.fire).toBe(EFFECT_CAPS.fire.defaultCap);
      expect(DEFAULT_EFFECT_CAPS.ricochet).toBe(EFFECT_CAPS.ricochet.defaultCap);
      expect(DEFAULT_EFFECT_CAPS.boardGrowth).toBe(EFFECT_CAPS.boardGrowth.defaultCap);
      expect(DEFAULT_EFFECT_CAPS.coinGain).toBe(EFFECT_CAPS.coinGain.defaultCap);
      expect(DEFAULT_EFFECT_CAPS.xpGain).toBe(EFFECT_CAPS.xpGain.defaultCap);
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
    it('should have all required keys', () => {
      const caps: EffectCaps = { ...DEFAULT_EFFECT_CAPS };

      // Verify all keys exist
      expect(caps.echo).toBeDefined();
      expect(caps.laser).toBeDefined();
      expect(caps.graceGain).toBeDefined();
      expect(caps.explosion).toBeDefined();
      expect(caps.hint).toBeDefined();
      expect(caps.timeGain).toBeDefined();
      expect(caps.healing).toBeDefined();
      expect(caps.fire).toBeDefined();
      expect(caps.ricochet).toBeDefined();
      expect(caps.boardGrowth).toBeDefined();
      expect(caps.coinGain).toBeDefined();
      expect(caps.xpGain).toBeDefined();
    });

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
