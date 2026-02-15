/**
 * Initialize Player Tests
 *
 * Tests for the initializePlayer function focusing on inventory structure.
 */

import { initializePlayer } from '@/utils/gameDefinitions';

describe('initializePlayer', () => {
  describe('Inventory Structure', () => {
    it('should create an inventory object', () => {
      const player = initializePlayer('test', 'Test', 'Orange Tabby');
      expect(player.inventory).toBeDefined();
    });

    it('should create a 4-slot weapons array', () => {
      const player = initializePlayer('test', 'Test', 'Orange Tabby');
      expect(player.inventory!.weapons).toHaveLength(4);
    });

    it('should create a 4-slot passives array', () => {
      const player = initializePlayer('test', 'Test', 'Orange Tabby');
      expect(player.inventory!.passives).toHaveLength(4);
    });

    it('should have empty slots as null', () => {
      const player = initializePlayer('test', 'Test', 'Orange Tabby');
      // Orange Tabby has 0 weapons, so all weapon slots should be null
      player.inventory!.weapons.forEach(slot => {
        expect(slot).toBeNull();
      });
      // Orange Tabby has 2 passives, so slots 2 and 3 should be null
      expect(player.inventory!.passives[2]).toBeNull();
      expect(player.inventory!.passives[3]).toBeNull();
    });
  });

  describe('Starting Weapons Placement', () => {
    it('should place weapons in weapons array for Sly Fox', () => {
      const player = initializePlayer('test', 'Test', 'Sly Fox');
      // Sly Fox has 2 weapons: Flint Spark, Blast Powder
      expect(player.inventory!.weapons[0]?.type).toBe('weapon');
      expect(player.inventory!.weapons[1]?.type).toBe('weapon');
    });

    it('should have no passives for Sly Fox', () => {
      const player = initializePlayer('test', 'Test', 'Sly Fox');
      player.inventory!.passives.forEach(slot => {
        expect(slot).toBeNull();
      });
    });
  });

  describe('Starting Passives Placement', () => {
    it('should place passives in passives array for Orange Tabby', () => {
      const player = initializePlayer('test', 'Test', 'Orange Tabby');
      // Orange Tabby has 2 passives: Life Vessel, Mending Charm
      expect(player.inventory!.passives[0]?.type).toBe('passive');
      expect(player.inventory!.passives[1]?.type).toBe('passive');
    });

    it('should have no weapons for Orange Tabby', () => {
      const player = initializePlayer('test', 'Test', 'Orange Tabby');
      player.inventory!.weapons.forEach(slot => {
        expect(slot).toBeNull();
      });
    });
  });

  describe('Item Properties', () => {
    it('should create items with type field', () => {
      const player = initializePlayer('test', 'Test', 'Orange Tabby');
      const passive = player.inventory!.passives[0];
      expect(passive).not.toBeNull();
      expect(passive!.type).toBeDefined();
      expect(['weapon', 'passive']).toContain(passive!.type);
    });

    it('should create items with level 1', () => {
      const player = initializePlayer('test', 'Test', 'Orange Tabby');
      const passive = player.inventory!.passives[0];
      expect(passive!.level).toBe(1);
    });

    it('should create items with fusionTier 0', () => {
      const player = initializePlayer('test', 'Test', 'Orange Tabby');
      const passive = player.inventory!.passives[0];
      expect(passive!.fusionTier).toBe(0);
    });

    it('should create items with levelEffects', () => {
      const player = initializePlayer('test', 'Test', 'Orange Tabby');
      const passive = player.inventory!.passives[0];
      expect(passive!.levelEffects).toBeDefined();
      expect(passive!.levelEffects[1]).toBeDefined();
      expect(passive!.levelEffects[2]).toBeDefined();
      expect(passive!.levelEffects[3]).toBeDefined();
    });
  });

  describe('Legacy weapons array', () => {
    it('should have empty legacy weapons array when using inventory system', () => {
      const player = initializePlayer('test', 'Test', 'Orange Tabby');
      // Legacy weapons array is empty to avoid double-counting effects
      // All starting items are now in the inventory system
      expect(player.weapons).toBeDefined();
      expect(player.weapons.length).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for unknown character', () => {
      expect(() => initializePlayer('test', 'Test', 'Unknown Character'))
        .toThrow('Character Unknown Character not found');
    });
  });
});
