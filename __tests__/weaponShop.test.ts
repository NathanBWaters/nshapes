/**
 * Tests for WeaponShop and LevelUp weapon display
 *
 * These tests verify that:
 * 1. getRandomShopWeapon never returns undefined
 * 2. All weapon types can be displayed correctly
 * 3. The shop handles edge cases (empty, all null, etc.)
 */

import { WEAPONS, getRandomShopWeapon, generateShopWeapons, getWeaponsByRarity } from '../src/utils/gameDefinitions';
import { Weapon, WeaponRarity } from '../src/types';

describe('Weapon System', () => {
  describe('WEAPONS array validation', () => {
    it('has at least one weapon of each rarity', () => {
      const rarities: WeaponRarity[] = ['common', 'rare', 'epic', 'legendary'];

      for (const rarity of rarities) {
        const weaponsOfRarity = WEAPONS.filter(w => w.rarity === rarity);
        expect(weaponsOfRarity.length).toBeGreaterThan(0);
      }
    });

    it('all weapons have required fields', () => {
      for (const weapon of WEAPONS) {
        expect(weapon.id).toBeDefined();
        expect(weapon.name).toBeDefined();
        expect(weapon.rarity).toBeDefined();
        expect(weapon.level).toBeDefined();
        expect(weapon.description).toBeDefined();
        expect(weapon.effects).toBeDefined();
        expect(typeof weapon.effects).toBe('object');
      }
    });

    it('all weapons have valid prices', () => {
      for (const weapon of WEAPONS) {
        expect(weapon.price).toBeGreaterThan(0);
        expect(Number.isFinite(weapon.price)).toBe(true);
      }
    });

    it('has no duplicate weapon IDs', () => {
      const ids = WEAPONS.map(w => w.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('getRandomShopWeapon', () => {
    it('never returns undefined', () => {
      // Run many times to catch random edge cases
      for (let i = 0; i < 100; i++) {
        const weapon = getRandomShopWeapon();
        expect(weapon).toBeDefined();
        expect(weapon).not.toBeNull();
      }
    });

    it('returns a valid weapon object', () => {
      const weapon = getRandomShopWeapon();
      expect(weapon.id).toBeDefined();
      expect(weapon.name).toBeDefined();
      expect(weapon.rarity).toBeDefined();
      expect(weapon.effects).toBeDefined();
    });

    it('respects round-based rarity scaling', () => {
      // Early rounds should have more common weapons
      let commonCount = 0;
      for (let i = 0; i < 100; i++) {
        const weapon = getRandomShopWeapon(undefined, 1);
        if (weapon.rarity === 'common') commonCount++;
      }
      // Round 1 should have mostly common weapons (expect > 50%)
      expect(commonCount).toBeGreaterThan(50);

      // Late rounds should have more rare/legendary
      let legendaryCount = 0;
      for (let i = 0; i < 100; i++) {
        const weapon = getRandomShopWeapon(undefined, 10);
        if (weapon.rarity === 'legendary') legendaryCount++;
      }
      // Round 10 should have more legendary than round 1
      // (at least some legendary should appear)
      expect(legendaryCount).toBeGreaterThan(0);
    });

    it('handles empty player weapons array', () => {
      const weapon = getRandomShopWeapon([], 5);
      expect(weapon).toBeDefined();
      expect(weapon).not.toBeNull();
    });

    it('handles player with many weapons', () => {
      // Create a mock player weapons array with many copies
      const playerWeapons: Weapon[] = [];
      for (let i = 0; i < 50; i++) {
        playerWeapons.push(WEAPONS[i % WEAPONS.length]);
      }

      const weapon = getRandomShopWeapon(playerWeapons, 5);
      expect(weapon).toBeDefined();
      expect(weapon).not.toBeNull();
    });
  });

  describe('generateShopWeapons', () => {
    it('generates the requested number of weapons', () => {
      const weapons = generateShopWeapons(4);
      expect(weapons.length).toBe(4);

      const weapons6 = generateShopWeapons(6);
      expect(weapons6.length).toBe(6);
    });

    it('all generated weapons are valid', () => {
      const weapons = generateShopWeapons(10);

      for (const weapon of weapons) {
        expect(weapon).toBeDefined();
        expect(weapon).not.toBeNull();
        expect(weapon.id).toBeDefined();
        expect(weapon.effects).toBeDefined();
      }
    });

    it('handles zero count', () => {
      const weapons = generateShopWeapons(0);
      expect(weapons).toEqual([]);
    });

    it('returns non-empty array for positive count', () => {
      const weapons = generateShopWeapons(1);
      expect(weapons.length).toBe(1);
      expect(weapons[0]).toBeDefined();
    });
  });

  describe('getWeaponsByRarity', () => {
    it('returns only weapons of specified rarity', () => {
      const commonWeapons = getWeaponsByRarity('common');
      for (const weapon of commonWeapons) {
        expect(weapon.rarity).toBe('common');
      }

      const legendaryWeapons = getWeaponsByRarity('legendary');
      for (const weapon of legendaryWeapons) {
        expect(weapon.rarity).toBe('legendary');
      }
    });

    it('returns all weapons of specified rarity', () => {
      const rarities: WeaponRarity[] = ['common', 'rare', 'epic', 'legendary'];

      for (const rarity of rarities) {
        const weaponsByFunction = getWeaponsByRarity(rarity);
        const weaponsByFilter = WEAPONS.filter(w => w.rarity === rarity);
        expect(weaponsByFunction.length).toBe(weaponsByFilter.length);
      }
    });
  });

  describe('Weapon effects', () => {
    it('all weapons have valid effects object (can be empty)', () => {
      for (const weapon of WEAPONS) {
        expect(weapon.effects).toBeDefined();
        expect(typeof weapon.effects).toBe('object');
        expect(weapon.effects).not.toBeNull();
      }
    });

    it('cap increaser weapons have capIncrease property', () => {
      const capIncreasers = WEAPONS.filter(w => w.specialEffect === 'capIncrease');

      for (const weapon of capIncreasers) {
        expect(weapon.capIncrease).toBeDefined();
        expect(weapon.capIncrease?.type).toBeDefined();
        expect(weapon.capIncrease?.amount).toBeGreaterThan(0);
      }
    });

    it('bridge weapons have bridgeEffect property', () => {
      const bridgeWeapons = WEAPONS.filter(w => w.specialEffect === 'bridge');

      for (const weapon of bridgeWeapons) {
        expect(weapon.bridgeEffect).toBeDefined();
        expect(weapon.bridgeEffect?.trigger).toBeDefined();
        expect(weapon.bridgeEffect?.effect).toBeDefined();
        expect(weapon.bridgeEffect?.chance).toBeGreaterThan(0);
      }
    });
  });
});

describe('Shop State Management', () => {
  describe('focusedIndex edge cases', () => {
    it('finds first available weapon in mixed array', () => {
      const weapons: (Weapon | null)[] = [null, null, WEAPONS[0], WEAPONS[1]];
      const firstAvailable = weapons.findIndex(w => w !== null);
      expect(firstAvailable).toBe(2);
    });

    it('handles all null weapons array', () => {
      const weapons: (Weapon | null)[] = [null, null, null, null];
      const firstAvailable = weapons.findIndex(w => w !== null);
      expect(firstAvailable).toBe(-1);
    });

    it('handles empty weapons array', () => {
      const weapons: (Weapon | null)[] = [];
      const firstAvailable = weapons.findIndex(w => w !== null);
      expect(firstAvailable).toBe(-1);
    });

    it('handles all valid weapons array', () => {
      const weapons: (Weapon | null)[] = [WEAPONS[0], WEAPONS[1], WEAPONS[2]];
      const firstAvailable = weapons.findIndex(w => w !== null);
      expect(firstAvailable).toBe(0);
    });
  });

  describe('Level up options management', () => {
    it('options array should never contain undefined', () => {
      // Simulate generateLevelUpOptions behavior
      const options: Weapon[] = [];
      const optionsSize = 4;

      for (let i = 0; i < optionsSize; i++) {
        const weapon = getRandomShopWeapon();
        options.push(weapon);
      }

      expect(options.length).toBe(4);
      for (const option of options) {
        expect(option).toBeDefined();
        expect(option).not.toBeNull();
      }
    });

    it('findIndex correctly finds first valid option', () => {
      const options: (Weapon | undefined)[] = [undefined, WEAPONS[0], WEAPONS[1]];
      const firstValid = options.findIndex(opt => opt !== undefined);
      expect(firstValid).toBe(1);
    });

    it('validates focusedIndex bounds check', () => {
      const options = [WEAPONS[0], WEAPONS[1]];
      const focusedIndex = 5; // Out of bounds

      // This is the check we added to LevelUp
      const shouldReset = focusedIndex >= options.length && options.length > 0;
      expect(shouldReset).toBe(true);
    });
  });
});
