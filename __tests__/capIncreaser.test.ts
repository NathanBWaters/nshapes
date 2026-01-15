import { WEAPONS, calculatePlayerTotalStats, DEFAULT_PLAYER_STATS, DEFAULT_EFFECT_CAPS } from '@/utils/gameDefinitions';
import { EFFECT_CAPS } from '@/utils/gameConfig';
import { Weapon, Player, EffectCaps } from '@/types';

describe('Cap Increaser Weapons', () => {
  // Get all cap increaser weapons
  const capIncreasers = WEAPONS.filter(w => w.specialEffect === 'capIncrease');

  describe('Weapon Definitions', () => {
    it('should have 11 cap increaser weapons (one per effect type except XP)', () => {
      // XP has no cap increase, so there are 11 cap types with cap increasers
      expect(capIncreasers.length).toBe(11);
    });

    it('all cap increaser weapons should be rare rarity', () => {
      capIncreasers.forEach(weapon => {
        expect(weapon.rarity).toBe('rare');
      });
    });

    it('all cap increaser weapons should have empty effects', () => {
      capIncreasers.forEach(weapon => {
        expect(Object.keys(weapon.effects).length).toBe(0);
      });
    });

    it('all cap increaser weapons should have capIncrease defined', () => {
      capIncreasers.forEach(weapon => {
        expect(weapon.capIncrease).toBeDefined();
        expect(weapon.capIncrease?.type).toBeDefined();
        expect(weapon.capIncrease?.amount).toBeGreaterThan(0);
      });
    });

    it('should cover all capped effect types except xpGain', () => {
      const capTypes = capIncreasers.map(w => w.capIncrease?.type);
      const expectedTypes = Object.keys(EFFECT_CAPS).filter(t => t !== 'xpGain');

      expectedTypes.forEach(type => {
        expect(capTypes).toContain(type);
      });
    });

    it('cap increase amounts should match EFFECT_CAPS configuration', () => {
      capIncreasers.forEach(weapon => {
        const { type, amount } = weapon.capIncrease!;
        const expectedAmount = EFFECT_CAPS[type as keyof typeof EFFECT_CAPS].capIncrease;
        expect(amount).toBe(expectedAmount);
      });
    });

    it('cap increaser weapon prices should be reasonable (12-18 coins)', () => {
      capIncreasers.forEach(weapon => {
        expect(weapon.price).toBeGreaterThanOrEqual(12);
        expect(weapon.price).toBeLessThanOrEqual(18);
      });
    });
  });

  describe('Cap Increase Application', () => {
    const createTestPlayer = (weapons: Weapon[]): Player => {
      return {
        id: 'test-id',
        username: 'TestPlayer',
        character: {
          name: 'Orange Tabby',
          description: 'Test character',
          icon: 'lorc/cat',
          baseStats: {},
          startingWeapons: []
        },
        stats: { ...DEFAULT_PLAYER_STATS },
        weapons,
        items: []
      };
    };

    it('should apply cap increase when weapon is equipped', () => {
      const echoMastery = WEAPONS.find(w => w.name === 'Echo Mastery')!;
      const player = createTestPlayer([echoMastery]);

      const totalStats = calculatePlayerTotalStats(player);

      // Default echo cap is 25, mastery adds 5
      expect(totalStats.effectCaps?.echo).toBe(30);
    });

    it('should stack multiple cap increases of the same type', () => {
      const echoMastery1 = { ...WEAPONS.find(w => w.name === 'Echo Mastery')!, id: 'echo-1' };
      const echoMastery2 = { ...WEAPONS.find(w => w.name === 'Echo Mastery')!, id: 'echo-2' };
      const player = createTestPlayer([echoMastery1, echoMastery2]);

      const totalStats = calculatePlayerTotalStats(player);

      // Default echo cap is 25, 2x mastery adds 10
      expect(totalStats.effectCaps?.echo).toBe(35);
    });

    it('should apply multiple different cap increases', () => {
      const echoMastery = WEAPONS.find(w => w.name === 'Echo Mastery')!;
      const explosionMastery = WEAPONS.find(w => w.name === 'Explosion Mastery')!;
      const player = createTestPlayer([echoMastery, explosionMastery]);

      const totalStats = calculatePlayerTotalStats(player);

      // Echo: 25 + 5 = 30
      expect(totalStats.effectCaps?.echo).toBe(30);
      // Explosion: 40 + 10 = 50
      expect(totalStats.effectCaps?.explosion).toBe(50);
      // Laser should remain unchanged
      expect(totalStats.effectCaps?.laser).toBe(DEFAULT_EFFECT_CAPS.laser);
    });

    it('should not modify other caps when adding a cap increaser', () => {
      const echoMastery = WEAPONS.find(w => w.name === 'Echo Mastery')!;
      const player = createTestPlayer([echoMastery]);

      const totalStats = calculatePlayerTotalStats(player);

      // All other caps should match defaults
      expect(totalStats.effectCaps?.laser).toBe(DEFAULT_EFFECT_CAPS.laser);
      expect(totalStats.effectCaps?.explosion).toBe(DEFAULT_EFFECT_CAPS.explosion);
      expect(totalStats.effectCaps?.healing).toBe(DEFAULT_EFFECT_CAPS.healing);
      expect(totalStats.effectCaps?.fire).toBe(DEFAULT_EFFECT_CAPS.fire);
      expect(totalStats.effectCaps?.ricochet).toBe(DEFAULT_EFFECT_CAPS.ricochet);
      expect(totalStats.effectCaps?.boardGrowth).toBe(DEFAULT_EFFECT_CAPS.boardGrowth);
      expect(totalStats.effectCaps?.coinGain).toBe(DEFAULT_EFFECT_CAPS.coinGain);
      expect(totalStats.effectCaps?.xpGain).toBe(DEFAULT_EFFECT_CAPS.xpGain);
    });
  });

  describe('Specific Cap Increasers', () => {
    const testCapIncreaser = (name: string, capType: keyof EffectCaps, expectedIncrease: number) => {
      it(`${name} should increase ${capType} cap by ${expectedIncrease}%`, () => {
        const weapon = WEAPONS.find(w => w.name === name);
        expect(weapon).toBeDefined();
        expect(weapon?.capIncrease?.type).toBe(capType);
        expect(weapon?.capIncrease?.amount).toBe(expectedIncrease);
      });
    };

    testCapIncreaser('Echo Mastery', 'echo', 5);
    testCapIncreaser('Laser Mastery', 'laser', 5);
    testCapIncreaser('Grace Mastery', 'graceGain', 5);
    testCapIncreaser('Explosion Mastery', 'explosion', 10);
    testCapIncreaser('Hint Mastery', 'hint', 10);
    testCapIncreaser('Time Mastery', 'timeGain', 10);
    testCapIncreaser('Healing Mastery', 'healing', 10);
    testCapIncreaser('Fire Mastery', 'fire', 10);
    testCapIncreaser('Ricochet Mastery', 'ricochet', 10);
    testCapIncreaser('Growth Mastery', 'boardGrowth', 10);
    testCapIncreaser('Coin Mastery', 'coinGain', 15);
  });
});
