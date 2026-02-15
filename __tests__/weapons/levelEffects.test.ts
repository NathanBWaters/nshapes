/**
 * Level-Based Effects Tests
 *
 * Tests for the new level-based weapon effects system:
 * - calculatePlayerTotalStats uses levelEffects
 * - Level 1/2/3 weapons apply correct effects
 * - Multiple weapons stack effects correctly
 * - Both weapons and passives contribute to stats
 */

import {
  calculatePlayerTotalStats,
  initializePlayer,
} from '@/utils/gameDefinitions';
import { BASE_WEAPONS, BASE_PASSIVES } from '@/utils/fusionDefinitions';
import { FusionWeapon, Player, PlayerInventory } from '@/types';

// Helper to create a test inventory
const createTestInventory = (
  weapons: (FusionWeapon | null)[] = [null, null, null, null],
  passives: (FusionWeapon | null)[] = [null, null, null, null]
): PlayerInventory => ({
  weapons: weapons.length === 4 ? weapons : [...weapons, ...Array(4 - weapons.length).fill(null)] as (FusionWeapon | null)[],
  passives: passives.length === 4 ? passives : [...passives, ...Array(4 - passives.length).fill(null)] as (FusionWeapon | null)[],
});

// Helper to create a weapon at a specific level
const createWeaponAtLevel = (weapon: FusionWeapon, level: 1 | 2 | 3): FusionWeapon => ({
  ...weapon,
  id: `${weapon.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
  level,
});

describe('Level-Based Effects', () => {
  // Get test weapons from fusion definitions
  const blastPowder = BASE_WEAPONS.find(w => w.name === 'Blast Powder')!;
  const flintSpark = BASE_WEAPONS.find(w => w.name === 'Flint Spark')!;
  const prismaticRay = BASE_WEAPONS.find(w => w.name === 'Prismatic Ray')!;

  // Get test passives
  const lifeVessel = BASE_PASSIVES.find(p => p.name === 'Life Vessel')!;
  const mendingCharm = BASE_PASSIVES.find(p => p.name === 'Mending Charm')!;
  const secondChance = BASE_PASSIVES.find(p => p.name === 'Second Chance')!;

  describe('calculatePlayerTotalStats uses levelEffects', () => {
    it('should apply level 1 effects for level 1 weapon', () => {
      const player = initializePlayer('test', 'Test', 'Sly Fox');

      // Clear existing inventory and add level 1 Blast Powder
      const weapon = createWeaponAtLevel(blastPowder, 1);
      player.inventory = createTestInventory([weapon, null, null, null]);

      const stats = calculatePlayerTotalStats(player);

      // Level 1 Blast Powder has explosionChance: 10
      expect(stats.explosionChance).toBe(10);
    });

    it('should apply level 2 effects for level 2 weapon', () => {
      const player = initializePlayer('test', 'Test', 'Sly Fox');

      const weapon = createWeaponAtLevel(blastPowder, 2);
      player.inventory = createTestInventory([weapon, null, null, null]);

      const stats = calculatePlayerTotalStats(player);

      // Level 2 Blast Powder has explosionChance: 20
      expect(stats.explosionChance).toBe(20);
    });

    it('should apply level 3 effects for level 3 weapon', () => {
      const player = initializePlayer('test', 'Test', 'Sly Fox');

      const weapon = createWeaponAtLevel(blastPowder, 3);
      player.inventory = createTestInventory([weapon, null, null, null]);

      const stats = calculatePlayerTotalStats(player);

      // Level 3 Blast Powder has explosionChance: 30
      expect(stats.explosionChance).toBe(30);
    });
  });

  describe('Multiple weapons stack effects', () => {
    it('should stack effects from multiple weapons', () => {
      const player = initializePlayer('test', 'Test', 'Sly Fox');

      // Add two Blast Powders at level 1
      const weapon1 = createWeaponAtLevel(blastPowder, 1);
      const weapon2 = createWeaponAtLevel(blastPowder, 1);
      player.inventory = createTestInventory([weapon1, weapon2, null, null]);

      const stats = calculatePlayerTotalStats(player);

      // Two level 1 Blast Powders: 10 + 10 = 20
      expect(stats.explosionChance).toBe(20);
    });

    it('should stack effects from weapons at different levels', () => {
      const player = initializePlayer('test', 'Test', 'Sly Fox');

      // Add Blast Powder at level 1, 2, and 3
      const weapon1 = createWeaponAtLevel(blastPowder, 1);
      const weapon2 = createWeaponAtLevel(blastPowder, 2);
      const weapon3 = createWeaponAtLevel(blastPowder, 3);
      player.inventory = createTestInventory([weapon1, weapon2, weapon3, null]);

      const stats = calculatePlayerTotalStats(player);

      // Level 1 (10) + Level 2 (20) + Level 3 (30) = 60
      expect(stats.explosionChance).toBe(60);
    });

    it('should stack effects from different weapon types', () => {
      const player = initializePlayer('test', 'Test', 'Sly Fox');

      // Add Blast Powder (explosion) and Flint Spark (fire)
      const weapon1 = createWeaponAtLevel(blastPowder, 1);
      const weapon2 = createWeaponAtLevel(flintSpark, 1);
      player.inventory = createTestInventory([weapon1, weapon2, null, null]);

      const stats = calculatePlayerTotalStats(player);

      // Blast Powder level 1: explosionChance 10
      // Flint Spark level 1: fireSpreadChance 10
      expect(stats.explosionChance).toBe(10);
      expect(stats.fireSpreadChance).toBe(10);
    });
  });

  describe('Passives contribute to stats', () => {
    it('should apply effects from passives', () => {
      const player = initializePlayer('test', 'Test', 'Sly Fox');

      // Add Life Vessel passive
      const passive = createWeaponAtLevel(lifeVessel, 1);
      player.inventory = createTestInventory([null, null, null, null], [passive, null, null, null]);

      const stats = calculatePlayerTotalStats(player);

      // Life Vessel level 1: maxHealth +1
      expect(stats.maxHealth).toBe(player.stats.maxHealth + 1);
    });

    it('should apply higher level passive effects', () => {
      const player = initializePlayer('test', 'Test', 'Sly Fox');

      const passive = createWeaponAtLevel(lifeVessel, 3);
      player.inventory = createTestInventory([null, null, null, null], [passive, null, null, null]);

      const stats = calculatePlayerTotalStats(player);

      // Life Vessel level 3: maxHealth +3
      expect(stats.maxHealth).toBe(player.stats.maxHealth + 3);
    });

    it('should stack passive effects', () => {
      const player = initializePlayer('test', 'Test', 'Sly Fox');

      const passive1 = createWeaponAtLevel(lifeVessel, 1);
      const passive2 = createWeaponAtLevel(lifeVessel, 2);
      player.inventory = createTestInventory([null, null, null, null], [passive1, passive2, null, null]);

      const stats = calculatePlayerTotalStats(player);

      // Life Vessel level 1 (+1) + level 2 (+2) = +3
      expect(stats.maxHealth).toBe(player.stats.maxHealth + 3);
    });
  });

  describe('Weapons and passives combined', () => {
    it('should apply effects from both weapons and passives', () => {
      const player = initializePlayer('test', 'Test', 'Sly Fox');

      const weapon = createWeaponAtLevel(blastPowder, 2);
      const passive = createWeaponAtLevel(mendingCharm, 2);
      player.inventory = createTestInventory(
        [weapon, null, null, null],
        [passive, null, null, null]
      );

      const stats = calculatePlayerTotalStats(player);

      // Blast Powder level 2: explosionChance 20
      // Mending Charm level 2: healingChance 10
      expect(stats.explosionChance).toBe(20);
      expect(stats.healingChance).toBe(10);
    });

    it('should handle full inventory with mixed levels', () => {
      const player = initializePlayer('test', 'Test', 'Sly Fox');

      const weapons = [
        createWeaponAtLevel(blastPowder, 1),
        createWeaponAtLevel(flintSpark, 2),
        createWeaponAtLevel(prismaticRay, 3),
        null,
      ];
      const passives = [
        createWeaponAtLevel(lifeVessel, 1),
        createWeaponAtLevel(mendingCharm, 2),
        createWeaponAtLevel(secondChance, 3),
        null,
      ];
      player.inventory = createTestInventory(weapons, passives);

      const stats = calculatePlayerTotalStats(player);

      // Verify weapons contribute
      expect(stats.explosionChance).toBe(10); // Blast Powder L1
      expect(stats.fireSpreadChance).toBe(20); // Flint Spark L2
      expect(stats.laserChance).toBe(15); // Prismatic Ray L3

      // Verify passives contribute
      expect(stats.maxHealth).toBe(player.stats.maxHealth + 1); // Life Vessel L1
      expect(stats.healingChance).toBe(10); // Mending Charm L2
      expect(stats.graces).toBe(player.stats.graces + 3); // Second Chance L3
    });
  });

  describe('Empty slots are handled', () => {
    it('should handle inventory with empty weapon slots', () => {
      const player = initializePlayer('test', 'Test', 'Sly Fox');

      const weapon = createWeaponAtLevel(blastPowder, 1);
      player.inventory = createTestInventory([null, weapon, null, null]);

      const stats = calculatePlayerTotalStats(player);
      expect(stats.explosionChance).toBe(10);
    });

    it('should handle inventory with empty passive slots', () => {
      const player = initializePlayer('test', 'Test', 'Sly Fox');

      const passive = createWeaponAtLevel(lifeVessel, 1);
      player.inventory = createTestInventory([null, null, null, null], [null, null, passive, null]);

      const stats = calculatePlayerTotalStats(player);
      expect(stats.maxHealth).toBe(player.stats.maxHealth + 1);
    });

    it('should handle completely empty inventory', () => {
      const player = initializePlayer('test', 'Test', 'Sly Fox');

      player.inventory = createTestInventory();

      const stats = calculatePlayerTotalStats(player);
      // Should return base stats with no modifications
      expect(stats.explosionChance).toBe(player.stats.explosionChance);
    });
  });
});
