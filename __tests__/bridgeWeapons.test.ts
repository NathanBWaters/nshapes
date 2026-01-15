import { WEAPONS, getBridgeWeaponsForTrigger, rollBridgeEffects, hasBridgeWeaponsForTrigger } from '@/utils/gameDefinitions';
import { Weapon, BridgeTriggerType, BridgeEffectType } from '@/types';

describe('Bridge Weapons', () => {
  // Get all bridge weapons
  const bridgeWeapons = WEAPONS.filter(w => w.specialEffect === 'bridge');

  describe('Weapon Definitions', () => {
    it('should have 10 bridge weapons', () => {
      expect(bridgeWeapons.length).toBe(10);
    });

    it('all bridge weapons should be legendary rarity', () => {
      bridgeWeapons.forEach(weapon => {
        expect(weapon.rarity).toBe('legendary');
      });
    });

    it('all bridge weapons should have empty effects (no stat bonuses)', () => {
      bridgeWeapons.forEach(weapon => {
        expect(Object.keys(weapon.effects).length).toBe(0);
      });
    });

    it('all bridge weapons should have bridgeEffect defined', () => {
      bridgeWeapons.forEach(weapon => {
        expect(weapon.bridgeEffect).toBeDefined();
        expect(weapon.bridgeEffect?.trigger).toBeDefined();
        expect(weapon.bridgeEffect?.chance).toBeGreaterThan(0);
        expect(weapon.bridgeEffect?.effect).toBeDefined();
      });
    });

    it('all bridge weapons should have maxCount defined', () => {
      bridgeWeapons.forEach(weapon => {
        expect(weapon.maxCount).toBeDefined();
        expect(weapon.maxCount).toBeGreaterThan(0);
        expect(weapon.maxCount).toBeLessThanOrEqual(3);
      });
    });

    it('bridge weapon prices should be in legendary range (30-50 coins)', () => {
      bridgeWeapons.forEach(weapon => {
        expect(weapon.price).toBeGreaterThanOrEqual(30);
        expect(weapon.price).toBeLessThanOrEqual(50);
      });
    });
  });

  describe('Trigger Coverage', () => {
    const expectedTriggers: BridgeTriggerType[] = [
      'onHeal',
      'onExplosion',
      'onTimeGain',
      'onDestruction',
      'onEcho',
      'onCoinGain',
      'onXPGain',
      'onGraceUse',
      'onHintUse',
      'onHealthLoss'
    ];

    it('should cover all trigger types', () => {
      const usedTriggers = bridgeWeapons.map(w => w.bridgeEffect?.trigger);
      expectedTriggers.forEach(trigger => {
        expect(usedTriggers).toContain(trigger);
      });
    });
  });

  describe('Effect Coverage', () => {
    const usedEffects = bridgeWeapons.map(w => w.bridgeEffect?.effect);

    it('should have holographic effects', () => {
      expect(usedEffects).toContain('makeHolographic');
    });

    it('should have grace effects', () => {
      expect(usedEffects).toContain('gainGrace');
    });

    it('should have echo effects', () => {
      expect(usedEffects).toContain('triggerEcho');
    });

    it('should have heal effects', () => {
      expect(usedEffects).toContain('heal');
    });

    it('should have fire effects', () => {
      expect(usedEffects).toContain('fireCard');
    });

    it('should have hint effects', () => {
      expect(usedEffects).toContain('gainHint');
    });

    it('should have coin effects', () => {
      expect(usedEffects).toContain('gainCoin');
    });

    it('should have laser effects', () => {
      expect(usedEffects).toContain('triggerLaser');
    });

    it('should have explosion effects', () => {
      expect(usedEffects).toContain('explosion');
    });
  });

  describe('Specific Bridge Weapons', () => {
    const testBridgeWeapon = (
      name: string,
      trigger: BridgeTriggerType,
      effect: BridgeEffectType,
      chance: number,
      maxCount: number
    ) => {
      it(`${name} should trigger ${effect} on ${trigger} at ${chance}% chance (max ${maxCount})`, () => {
        const weapon = WEAPONS.find(w => w.name === name);
        expect(weapon).toBeDefined();
        expect(weapon?.bridgeEffect?.trigger).toBe(trigger);
        expect(weapon?.bridgeEffect?.effect).toBe(effect);
        expect(weapon?.bridgeEffect?.chance).toBe(chance);
        expect(weapon?.maxCount).toBe(maxCount);
      });
    };

    testBridgeWeapon('Phoenix Feather', 'onHeal', 'makeHolographic', 15, 2);
    testBridgeWeapon('Chaos Conduit', 'onExplosion', 'gainGrace', 10, 3);
    testBridgeWeapon('Temporal Rift', 'onTimeGain', 'triggerEcho', 20, 2);
    testBridgeWeapon('Soul Harvest', 'onDestruction', 'heal', 5, 3);
    testBridgeWeapon('Cascade Core', 'onEcho', 'fireCard', 15, 2);
    testBridgeWeapon("Fortune's Blessing", 'onCoinGain', 'gainHint', 10, 3);
    testBridgeWeapon('Wisdom Chain', 'onXPGain', 'gainCoin', 15, 3);
    testBridgeWeapon('Grace Conduit', 'onGraceUse', 'triggerLaser', 25, 2);
    testBridgeWeapon('Hint Catalyst', 'onHintUse', 'makeHolographic', 20, 2);
    testBridgeWeapon('Life Link', 'onHealthLoss', 'explosion', 30, 2);
  });

  describe('Bridge Effect Amounts', () => {
    it('Phoenix Feather should make 1 card holographic', () => {
      const weapon = WEAPONS.find(w => w.name === 'Phoenix Feather');
      expect(weapon?.bridgeEffect?.amount).toBe(1);
    });

    it('Hint Catalyst should make 3 cards holographic', () => {
      const weapon = WEAPONS.find(w => w.name === 'Hint Catalyst');
      expect(weapon?.bridgeEffect?.amount).toBe(3);
    });

    it('Soul Harvest should heal 1 HP', () => {
      const weapon = WEAPONS.find(w => w.name === 'Soul Harvest');
      expect(weapon?.bridgeEffect?.amount).toBe(1);
    });

    it('Chaos Conduit should give 1 grace', () => {
      const weapon = WEAPONS.find(w => w.name === 'Chaos Conduit');
      expect(weapon?.bridgeEffect?.amount).toBe(1);
    });

    it('Cascade Core should fire 1 card', () => {
      const weapon = WEAPONS.find(w => w.name === 'Cascade Core');
      expect(weapon?.bridgeEffect?.amount).toBe(1);
    });

    it("Fortune's Blessing should give 1 hint", () => {
      const weapon = WEAPONS.find(w => w.name === "Fortune's Blessing");
      expect(weapon?.bridgeEffect?.amount).toBe(1);
    });

    it('Wisdom Chain should give 1 coin', () => {
      const weapon = WEAPONS.find(w => w.name === 'Wisdom Chain');
      expect(weapon?.bridgeEffect?.amount).toBe(1);
    });
  });

  describe('Bridge Resolution Functions', () => {
    // Create test weapons for resolution testing
    const phoenixFeather = WEAPONS.find(w => w.name === 'Phoenix Feather')!;
    const chaosConduit = WEAPONS.find(w => w.name === 'Chaos Conduit')!;
    const temporalRift = WEAPONS.find(w => w.name === 'Temporal Rift')!;

    describe('getBridgeWeaponsForTrigger', () => {
      it('should return empty array when no bridge weapons', () => {
        const regularWeapons = WEAPONS.filter(w => w.specialEffect !== 'bridge').slice(0, 5);
        const result = getBridgeWeaponsForTrigger('onHeal', regularWeapons);
        expect(result).toEqual([]);
      });

      it('should return matching bridge weapons for trigger', () => {
        const testWeapons = [phoenixFeather, chaosConduit];
        const result = getBridgeWeaponsForTrigger('onHeal', testWeapons);
        expect(result.length).toBe(1);
        expect(result[0].name).toBe('Phoenix Feather');
      });

      it('should return all matching weapons when multiple exist', () => {
        const phoenixCopy = { ...phoenixFeather, id: 'phoenix-2' };
        const testWeapons = [phoenixFeather, phoenixCopy, chaosConduit];
        const result = getBridgeWeaponsForTrigger('onHeal', testWeapons);
        expect(result.length).toBe(2);
      });

      it('should return empty array when trigger type does not match', () => {
        const testWeapons = [phoenixFeather];
        const result = getBridgeWeaponsForTrigger('onExplosion', testWeapons);
        expect(result).toEqual([]);
      });
    });

    describe('hasBridgeWeaponsForTrigger', () => {
      it('should return false when no matching bridge weapons', () => {
        const testWeapons = [phoenixFeather];
        expect(hasBridgeWeaponsForTrigger('onExplosion', testWeapons)).toBe(false);
      });

      it('should return true when matching bridge weapons exist', () => {
        const testWeapons = [phoenixFeather];
        expect(hasBridgeWeaponsForTrigger('onHeal', testWeapons)).toBe(true);
      });
    });

    describe('rollBridgeEffects', () => {
      it('should return empty array when isCascade is true', () => {
        const testWeapons = [phoenixFeather];
        const result = rollBridgeEffects('onHeal', testWeapons, true);
        expect(result).toEqual([]);
      });

      it('should return empty array when no matching bridge weapons', () => {
        const testWeapons = [phoenixFeather];
        const result = rollBridgeEffects('onExplosion', testWeapons, false);
        expect(result).toEqual([]);
      });

      it('should respect chance probability (100% chance should always trigger)', () => {
        // Create a weapon with 100% chance for testing
        const guaranteedWeapon: Weapon = {
          ...phoenixFeather,
          id: 'guaranteed-test',
          bridgeEffect: {
            trigger: 'onHeal',
            chance: 100,
            effect: 'makeHolographic',
            amount: 1,
          },
        };
        const testWeapons = [guaranteedWeapon];

        // Should always trigger with 100% chance
        for (let i = 0; i < 10; i++) {
          const result = rollBridgeEffects('onHeal', testWeapons, false);
          expect(result.length).toBe(1);
          expect(result[0].effect).toBe('makeHolographic');
          expect(result[0].amount).toBe(1);
        }
      });

      it('should respect chance probability (0% chance should never trigger)', () => {
        const impossibleWeapon: Weapon = {
          ...phoenixFeather,
          id: 'impossible-test',
          bridgeEffect: {
            trigger: 'onHeal',
            chance: 0,
            effect: 'makeHolographic',
            amount: 1,
          },
        };
        const testWeapons = [impossibleWeapon];

        // Should never trigger with 0% chance
        for (let i = 0; i < 10; i++) {
          const result = rollBridgeEffects('onHeal', testWeapons, false);
          expect(result.length).toBe(0);
        }
      });

      it('should include weapon name in result', () => {
        const guaranteedWeapon: Weapon = {
          ...phoenixFeather,
          id: 'named-test',
          bridgeEffect: {
            trigger: 'onHeal',
            chance: 100,
            effect: 'makeHolographic',
            amount: 1,
          },
        };
        const testWeapons = [guaranteedWeapon];
        const result = rollBridgeEffects('onHeal', testWeapons, false);
        expect(result[0].weaponName).toBe('Phoenix Feather');
      });

      it('should roll for each matching weapon independently', () => {
        // Create two weapons with 100% chance
        const weapon1: Weapon = {
          ...phoenixFeather,
          id: 'test-1',
          bridgeEffect: { trigger: 'onHeal', chance: 100, effect: 'makeHolographic', amount: 1 },
        };
        const weapon2: Weapon = {
          ...phoenixFeather,
          id: 'test-2',
          bridgeEffect: { trigger: 'onHeal', chance: 100, effect: 'makeHolographic', amount: 2 },
        };
        const testWeapons = [weapon1, weapon2];
        const result = rollBridgeEffects('onHeal', testWeapons, false);
        expect(result.length).toBe(2);
        expect(result[0].amount).toBe(1);
        expect(result[1].amount).toBe(2);
      });
    });

    describe('Cascade Prevention', () => {
      it('should prevent bridge-triggered effects from triggering other bridges', () => {
        // This simulates: explosion triggers Chaos Conduit (gainGrace)
        // If gaining grace would trigger another bridge, it should be prevented
        const testWeapons = [chaosConduit];

        // First roll (not a cascade) - should work
        const firstResult = rollBridgeEffects('onExplosion', testWeapons, false);
        // Result depends on RNG, but function should work
        expect(Array.isArray(firstResult)).toBe(true);

        // Second roll (is a cascade) - should return empty
        const cascadeResult = rollBridgeEffects('onGraceUse', testWeapons, true);
        expect(cascadeResult).toEqual([]);
      });
    });
  });
});
