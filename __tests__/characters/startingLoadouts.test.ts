/**
 * Starting Loadouts Tests
 *
 * Tests that each character has the correct starting weapons/passives
 * placed in the correct inventory slots.
 */

import { initializePlayer, CHARACTERS } from '@/utils/gameDefinitions';
import { FusionWeapon } from '@/types';

describe('Character Starting Loadouts', () => {
  // Helper to count non-null items in an array
  const countItems = (arr: (FusionWeapon | null)[]): number =>
    arr.filter(item => item !== null).length;

  describe('Orange Tabby', () => {
    const player = initializePlayer('test', 'Test', 'Orange Tabby');

    it('should have 0 weapons', () => {
      expect(player.inventory).toBeDefined();
      expect(countItems(player.inventory!.weapons)).toBe(0);
    });

    it('should have 2 passives', () => {
      expect(countItems(player.inventory!.passives)).toBe(2);
    });

    it('should have Life Vessel as first passive', () => {
      expect(player.inventory!.passives[0]?.name).toBe('Life Vessel');
    });

    it('should have Mending Charm as second passive', () => {
      expect(player.inventory!.passives[1]?.name).toBe('Mending Charm');
    });

    it('should have all starting items at level 1', () => {
      player.inventory!.passives.filter(p => p !== null).forEach(passive => {
        expect(passive!.level).toBe(1);
      });
    });
  });

  describe('Sly Fox', () => {
    const player = initializePlayer('test', 'Test', 'Sly Fox');

    it('should have 2 weapons', () => {
      expect(player.inventory).toBeDefined();
      expect(countItems(player.inventory!.weapons)).toBe(2);
    });

    it('should have 0 passives', () => {
      expect(countItems(player.inventory!.passives)).toBe(0);
    });

    it('should have Flint Spark as first weapon', () => {
      expect(player.inventory!.weapons[0]?.name).toBe('Flint Spark');
    });

    it('should have Blast Powder as second weapon', () => {
      expect(player.inventory!.weapons[1]?.name).toBe('Blast Powder');
    });

    it('should have all starting items at level 1', () => {
      player.inventory!.weapons.filter(w => w !== null).forEach(weapon => {
        expect(weapon!.level).toBe(1);
      });
    });
  });

  describe('Emperor Penguin', () => {
    const player = initializePlayer('test', 'Test', 'Emperor Penguin');

    it('should have 0 weapons', () => {
      expect(player.inventory).toBeDefined();
      expect(countItems(player.inventory!.weapons)).toBe(0);
    });

    it('should have 2 passives', () => {
      expect(countItems(player.inventory!.passives)).toBe(2);
    });

    it('should have Crystal Orb as first passive', () => {
      expect(player.inventory!.passives[0]?.name).toBe('Crystal Orb');
    });

    it('should have Seeker Lens as second passive', () => {
      expect(player.inventory!.passives[1]?.name).toBe('Seeker Lens');
    });

    it('should have all starting items at level 1', () => {
      player.inventory!.passives.filter(p => p !== null).forEach(passive => {
        expect(passive!.level).toBe(1);
      });
    });
  });

  describe('Corgi', () => {
    const player = initializePlayer('test', 'Test', 'Corgi');

    it('should have 0 weapons', () => {
      expect(player.inventory).toBeDefined();
      expect(countItems(player.inventory!.weapons)).toBe(0);
    });

    it('should have 2 passives', () => {
      expect(countItems(player.inventory!.passives)).toBe(2);
    });

    it('should have Field Stone as first passive', () => {
      expect(player.inventory!.passives[0]?.name).toBe('Field Stone');
    });

    it('should have Growth Seed as second passive', () => {
      expect(player.inventory!.passives[1]?.name).toBe('Growth Seed');
    });

    it('should have all starting items at level 1', () => {
      player.inventory!.passives.filter(p => p !== null).forEach(passive => {
        expect(passive!.level).toBe(1);
      });
    });
  });

  describe('Pelican', () => {
    const player = initializePlayer('test', 'Test', 'Pelican');

    it('should have 0 weapons', () => {
      expect(player.inventory).toBeDefined();
      expect(countItems(player.inventory!.weapons)).toBe(0);
    });

    it('should have 2 passives', () => {
      expect(countItems(player.inventory!.passives)).toBe(2);
    });

    it('should have Oracle Eye as first passive', () => {
      expect(player.inventory!.passives[0]?.name).toBe('Oracle Eye');
    });

    it('should have Oracle Eye as second passive (duplicate)', () => {
      expect(player.inventory!.passives[1]?.name).toBe('Oracle Eye');
    });

    it('should have all starting items at level 1', () => {
      player.inventory!.passives.filter(p => p !== null).forEach(passive => {
        expect(passive!.level).toBe(1);
      });
    });
  });

  describe('Badger', () => {
    const player = initializePlayer('test', 'Test', 'Badger');

    it('should have 0 weapons', () => {
      expect(player.inventory).toBeDefined();
      expect(countItems(player.inventory!.weapons)).toBe(0);
    });

    it('should have 2 passives', () => {
      expect(countItems(player.inventory!.passives)).toBe(2);
    });

    it('should have Second Chance as first passive', () => {
      expect(player.inventory!.passives[0]?.name).toBe('Second Chance');
    });

    it('should have Fortune Token as second passive', () => {
      expect(player.inventory!.passives[1]?.name).toBe('Fortune Token');
    });

    it('should have all starting items at level 1', () => {
      player.inventory!.passives.filter(p => p !== null).forEach(passive => {
        expect(passive!.level).toBe(1);
      });
    });
  });

  describe('All Characters', () => {
    it('should have exactly 6 characters defined', () => {
      expect(CHARACTERS.length).toBe(6);
    });

    it('should all have valid starting weapons defined', () => {
      CHARACTERS.forEach(character => {
        expect(character.startingWeapons).toBeDefined();
        expect(character.startingWeapons.length).toBe(2);
      });
    });
  });
});
