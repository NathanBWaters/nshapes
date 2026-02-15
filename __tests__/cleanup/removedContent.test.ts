/**
 * Removed Content Tests
 *
 * These tests verify that deprecated content has been properly removed
 * from the codebase as part of the Weapon/Passive Fusion System implementation.
 *
 * Phase 3: Remove Old Content
 */

import { WEAPONS } from '@/utils/gameDefinitions';
import { DEFAULT_PLAYER_STATS } from '@/utils/gameDefinitions';

describe('Removed Content Verification', () => {
  describe('Mastery Weapons Removal', () => {
    const masteryNames = [
      'Echo Mastery',
      'Laser Mastery',
      'Grace Mastery',
      'Explosion Mastery',
      'Hint Mastery',
      'Time Mastery',
      'Healing Mastery',
      'Fire Mastery',
      'Ricochet Mastery',
      'Growth Mastery',
      'Coin Mastery',
      'Time Trigger Mastery',
    ];

    it('should not contain any mastery weapons in WEAPONS array', () => {
      masteryNames.forEach(name => {
        const found = WEAPONS.find(w => w.name === name);
        expect(found).toBeUndefined();
      });
    });
  });

  describe('Rarity Variants Removal', () => {
    it('should have all weapons as common rarity', () => {
      WEAPONS.forEach(weapon => {
        expect(weapon.rarity).toBe('common');
      });
    });

    it('should not have any rare weapons', () => {
      const rares = WEAPONS.filter(w => w.rarity === 'rare');
      expect(rares.length).toBe(0);
    });

    it('should not have any epic weapons', () => {
      const epics = WEAPONS.filter(w => w.rarity === 'epic');
      expect(epics.length).toBe(0);
    });

    it('should not have any legendary weapons', () => {
      const legendaries = WEAPONS.filter(w => w.rarity === 'legendary');
      expect(legendaries.length).toBe(0);
    });
  });

  describe('Bridge Weapons Removal', () => {
    const bridgeNames = [
      'Chaos Conduit',
      'Temporal Rift',
      'Soul Harvest',
      'Cascade Core',
      "Fortune's Blessing",
      'Wisdom Chain',
      'Grace Conduit',
      'Life Link',
    ];

    it('should not contain any bridge weapons in WEAPONS array', () => {
      bridgeNames.forEach(name => {
        const found = WEAPONS.find(w => w.name === name);
        expect(found).toBeUndefined();
      });
    });
  });

  describe('Challenge Legendaries Removal', () => {
    const challengeNames = [
      'Prismatic Perfection',
      'Tabula Rasa',
      'Desperate Measures',
    ];

    it('should not contain any challenge legendary weapons', () => {
      challengeNames.forEach(name => {
        const found = WEAPONS.find(w => w.name === name);
        expect(found).toBeUndefined();
      });
    });
  });

  describe('Connector Weapon Variants Removal', () => {
    const removedConnectors = [
      'Link Chain',
      'Soul Link',
      'Web Spinner',
      'Web Master',
      'Echo Chamber',
      'Resonance Core',
      'Sympathetic Flames',
      'Neural Network',
      'Revenge Linker',
    ];

    it('should not contain removed connector variants', () => {
      removedConnectors.forEach(name => {
        const found = WEAPONS.find(w => w.name === name);
        expect(found).toBeUndefined();
      });
    });

    it('should have Link Stone as the only connector weapon', () => {
      const linkStone = WEAPONS.find(w => w.name === 'Link Stone');
      expect(linkStone).toBeDefined();
      expect(linkStone?.effects.connectionChance).toBe(15);
    });
  });

  describe('Cap System Removal', () => {
    it('should not have capIncrease on any weapon', () => {
      WEAPONS.forEach(weapon => {
        expect(weapon.capIncrease).toBeUndefined();
      });
    });

    it('should not have effectCaps in DEFAULT_PLAYER_STATS', () => {
      expect((DEFAULT_PLAYER_STATS as unknown as Record<string, unknown>).effectCaps).toBeUndefined();
    });
  });

  describe('Bridge Effect System Removal', () => {
    it('should not have bridgeEffect on any weapon', () => {
      WEAPONS.forEach(weapon => {
        expect(weapon.bridgeEffect).toBeUndefined();
      });
    });

    it('should not have bridgeTrigger on any weapon', () => {
      WEAPONS.forEach(weapon => {
        expect((weapon as unknown as Record<string, unknown>).bridgeTrigger).toBeUndefined();
      });
    });
  });

  describe('Shop System Removal', () => {
    it('should have all weapons with price 0', () => {
      WEAPONS.forEach(weapon => {
        expect(weapon.price).toBe(0);
      });
    });
  });

  describe('Weapon Count Verification', () => {
    it('should have exactly 19 base weapons/passives', () => {
      // 6 base weapons + 13 base passives = 19 total
      expect(WEAPONS.length).toBe(19);
    });

    it('should have 6 base weapons that can fuse', () => {
      const baseWeaponNames = [
        'Blast Powder',
        'Flint Spark',
        'Prismatic Ray',
        'Chaos Shard',
        'Echo Stone',
        'Link Stone',
      ];
      const found = WEAPONS.filter(w => baseWeaponNames.includes(w.name));
      expect(found.length).toBe(6);
    });

    it('should have 13 base passives', () => {
      const basePassiveNames = [
        'Oracle Eye',
        'Field Stone',
        'Growth Seed',
        'Second Chance',
        'Fortune Token',
        'Life Vessel',
        'Mending Charm',
        'Crystal Orb',
        'Seeker Lens',
        "Scholar's Tome",
        "Fortune's Favor",
        'Chrono Shard',
        'Time Drop',
      ];
      const found = WEAPONS.filter(w => basePassiveNames.includes(w.name));
      expect(found.length).toBe(13);
    });
  });
});
