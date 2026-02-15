/**
 * Upgrade Logic Tests for Level Up System
 *
 * Tests that upgrading items increases their level correctly
 * and updates their effects appropriately.
 */

import { FusionWeapon, WeaponLevel } from '@/types';
import { upgradeItem } from '@/utils/levelUpUtils';
import { BASE_WEAPONS, BASE_PASSIVES } from '@/utils/fusionDefinitions';

// Helper to create a test weapon at a specific level
const createTestWeapon = (level: WeaponLevel = 1): FusionWeapon => ({
  ...BASE_WEAPONS[0], // Blast Powder
  id: `test-weapon-${Date.now()}-${Math.random()}`,
  level,
});

// Helper to create a test passive at a specific level
const createTestPassive = (level: WeaponLevel = 1): FusionWeapon => ({
  ...BASE_PASSIVES[0], // Oracle Eye
  id: `test-passive-${Date.now()}-${Math.random()}`,
  level,
});

describe('Upgrade Logic', () => {
  describe('upgradeItem - Level Progression', () => {
    it('should increase level from 1 to 2', () => {
      const weapon = createTestWeapon(1);
      const upgraded = upgradeItem(weapon);

      expect(upgraded.level).toBe(2);
    });

    it('should increase level from 2 to 3', () => {
      const weapon = createTestWeapon(2);
      const upgraded = upgradeItem(weapon);

      expect(upgraded.level).toBe(3);
    });

    it('should not change level when already at 3', () => {
      const weapon = createTestWeapon(3);
      const upgraded = upgradeItem(weapon);

      expect(upgraded.level).toBe(3);
    });

    it('should return same item (not upgrade) when at max level', () => {
      const weapon = createTestWeapon(3);
      const upgraded = upgradeItem(weapon);

      // Should be the same reference or equivalent
      expect(upgraded.id).toBe(weapon.id);
      expect(upgraded.level).toBe(weapon.level);
    });
  });

  describe('upgradeItem - Weapons', () => {
    it('should upgrade Blast Powder correctly', () => {
      // Blast Powder: explosionChance 10 -> 20 -> 30
      const blastPowder = { ...BASE_WEAPONS.find(w => w.name === 'Blast Powder')!, level: 1 as WeaponLevel };

      const level2 = upgradeItem(blastPowder);
      expect(level2.level).toBe(2);

      const level3 = upgradeItem(level2);
      expect(level3.level).toBe(3);
    });

    it('should work for Prismatic Ray', () => {
      const prismaticRay = { ...BASE_WEAPONS.find(w => w.name === 'Prismatic Ray')!, level: 1 as WeaponLevel };

      const level2 = upgradeItem(prismaticRay);
      expect(level2.level).toBe(2);

      const level3 = upgradeItem(level2);
      expect(level3.level).toBe(3);
    });
  });

  describe('upgradeItem - Passives', () => {
    it('should upgrade Oracle Eye correctly', () => {
      // Oracle Eye: autoHintChance 15 -> 25 -> 35
      const oracleEye = { ...BASE_PASSIVES.find(w => w.name === 'Oracle Eye')!, level: 1 as WeaponLevel };

      const level2 = upgradeItem(oracleEye);
      expect(level2.level).toBe(2);

      const level3 = upgradeItem(level2);
      expect(level3.level).toBe(3);
    });

    it('should work for Life Vessel', () => {
      const lifeVessel = { ...BASE_PASSIVES.find(w => w.name === 'Life Vessel')!, level: 1 as WeaponLevel };

      const level2 = upgradeItem(lifeVessel);
      expect(level2.level).toBe(2);

      const level3 = upgradeItem(level2);
      expect(level3.level).toBe(3);
    });

    it('should work for Field Stone', () => {
      const fieldStone = { ...BASE_PASSIVES.find(w => w.name === 'Field Stone')!, level: 1 as WeaponLevel };

      const level2 = upgradeItem(fieldStone);
      expect(level2.level).toBe(2);

      const level3 = upgradeItem(level2);
      expect(level3.level).toBe(3);
    });
  });

  describe('upgradeItem - Effect Values', () => {
    it('should have level effects preserved', () => {
      const weapon = createTestWeapon(1);
      const upgraded = upgradeItem(weapon);

      // The item should retain its levelEffects structure
      expect(upgraded.levelEffects).toBeDefined();
      expect(upgraded.levelEffects[1]).toBeDefined();
      expect(upgraded.levelEffects[2]).toBeDefined();
      expect(upgraded.levelEffects[3]).toBeDefined();
    });

    it('should return new object (immutable)', () => {
      const weapon = createTestWeapon(1);
      const upgraded = upgradeItem(weapon);

      // Should not mutate original
      expect(weapon.level).toBe(1);
      expect(upgraded.level).toBe(2);
      expect(weapon).not.toBe(upgraded);
    });
  });

  describe('upgradeItem - Type Preservation', () => {
    it('should preserve weapon type', () => {
      const weapon = createTestWeapon(1);
      const upgraded = upgradeItem(weapon);

      expect(upgraded.type).toBe('weapon');
    });

    it('should preserve passive type', () => {
      const passive = createTestPassive(1);
      const upgraded = upgradeItem(passive);

      expect(upgraded.type).toBe('passive');
    });

    it('should preserve fusionTier', () => {
      const weapon = createTestWeapon(1);
      const upgraded = upgradeItem(weapon);

      expect(upgraded.fusionTier).toBe(weapon.fusionTier);
    });

    it('should preserve id', () => {
      const weapon = createTestWeapon(1);
      const originalId = weapon.id;
      const upgraded = upgradeItem(weapon);

      expect(upgraded.id).toBe(originalId);
    });
  });

  describe('Edge cases', () => {
    it('should handle upgrade chain without errors', () => {
      let item = createTestWeapon(1);

      // Level 1 -> 2
      item = upgradeItem(item);
      expect(item.level).toBe(2);

      // Level 2 -> 3
      item = upgradeItem(item);
      expect(item.level).toBe(3);

      // Level 3 -> 3 (no change)
      item = upgradeItem(item);
      expect(item.level).toBe(3);

      // Repeated attempts at max level
      item = upgradeItem(item);
      item = upgradeItem(item);
      expect(item.level).toBe(3);
    });

    it('should handle all base weapons', () => {
      BASE_WEAPONS.forEach(weapon => {
        const testWeapon = { ...weapon, level: 1 as WeaponLevel };
        const upgraded = upgradeItem(testWeapon);
        expect(upgraded.level).toBe(2);
      });
    });

    it('should handle all base passives', () => {
      BASE_PASSIVES.forEach(passive => {
        const testPassive = { ...passive, level: 1 as WeaponLevel };
        const upgraded = upgradeItem(testPassive);
        expect(upgraded.level).toBe(2);
      });
    });
  });
});
