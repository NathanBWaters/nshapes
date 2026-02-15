import {
  WEAPONS,
  getRandomWeapon,
  generateLevelUpWeapons,
  calculatePlayerTotalStats,
  initializePlayer,
  canObtainWeapon,
  getPlayerWeaponCount,
} from '@/utils/gameDefinitions';
import { Weapon } from '@/types';

describe('Weapon Definitions - New Fusion System', () => {
  describe('WEAPONS array', () => {
    it('should have exactly 19 base weapons/passives', () => {
      // 6 base weapons + 13 base passives = 19 total
      expect(WEAPONS.length).toBe(19);
    });

    it('should have all weapons as common rarity (rarity system deprecated)', () => {
      const commons = WEAPONS.filter(w => w.rarity === 'common');
      expect(commons.length).toBe(19);
    });

    it('should have no rare/epic/legendary weapons', () => {
      const rares = WEAPONS.filter(w => w.rarity === 'rare');
      const epics = WEAPONS.filter(w => w.rarity === 'epic');
      const legendaries = WEAPONS.filter(w => w.rarity === 'legendary');
      expect(rares.length).toBe(0);
      expect(epics.length).toBe(0);
      expect(legendaries.length).toBe(0);
    });

    it('should have 6 base weapons (can fuse)', () => {
      const baseWeapons = ['Blast Powder', 'Flint Spark', 'Prismatic Ray', 'Chaos Shard', 'Echo Stone', 'Link Stone'];
      const weapons = WEAPONS.filter(w => baseWeapons.includes(w.name));
      expect(weapons.length).toBe(6);
    });

    it('should have 13 base passives (cannot fuse)', () => {
      const basePassives = [
        'Oracle Eye', 'Field Stone', 'Growth Seed', 'Second Chance',
        'Fortune Token', 'Life Vessel', 'Mending Charm', 'Crystal Orb',
        'Seeker Lens', 'Scholar\'s Tome', 'Fortune\'s Favor', 'Chrono Shard', 'Time Drop'
      ];
      const passives = WEAPONS.filter(w => basePassives.includes(w.name));
      expect(passives.length).toBe(13);
    });

    it('each weapon should have required properties', () => {
      WEAPONS.forEach(weapon => {
        expect(weapon).toHaveProperty('id');
        expect(weapon).toHaveProperty('name');
        expect(weapon).toHaveProperty('rarity');
        expect(weapon).toHaveProperty('level');
        expect(weapon).toHaveProperty('description');
        expect(weapon).toHaveProperty('effects');

        // Validate types
        expect(typeof weapon.id).toBe('string');
        expect(typeof weapon.name).toBe('string');
        expect(weapon.rarity).toBe('common'); // All weapons are common now
        expect(typeof weapon.level).toBe('number');
        expect(typeof weapon.description).toBe('string');
        expect(typeof weapon.effects).toBe('object');
      });
    });

    it('all weapons should have price 0 (shop removed)', () => {
      WEAPONS.forEach(weapon => {
        expect(weapon.price).toBe(0);
      });
    });

    it('should NOT contain any mastery weapons', () => {
      const masteryNames = [
        'Echo Mastery', 'Laser Mastery', 'Grace Mastery', 'Explosion Mastery',
        'Hint Mastery', 'Time Mastery', 'Healing Mastery', 'Fire Mastery',
        'Ricochet Mastery', 'Growth Mastery', 'Coin Mastery', 'Time Trigger Mastery'
      ];
      WEAPONS.forEach(weapon => {
        expect(masteryNames).not.toContain(weapon.name);
      });
    });

    it('should NOT contain any bridge weapons', () => {
      const bridgeNames = [
        'Chaos Conduit', 'Temporal Rift', 'Soul Harvest', 'Cascade Core',
        "Fortune's Blessing", 'Wisdom Chain', 'Grace Conduit', 'Life Link'
      ];
      WEAPONS.forEach(weapon => {
        expect(bridgeNames).not.toContain(weapon.name);
      });
    });

    it('should NOT contain any challenge legendaries', () => {
      const challengeNames = ['Prismatic Perfection', 'Tabula Rasa', 'Desperate Measures'];
      WEAPONS.forEach(weapon => {
        expect(challengeNames).not.toContain(weapon.name);
      });
    });

    it('should NOT contain removed connector variants', () => {
      const removedConnectors = [
        'Link Chain', 'Soul Link', 'Web Spinner', 'Web Master',
        'Echo Chamber', 'Resonance Core', 'Sympathetic Flames',
        'Neural Network', 'Revenge Linker'
      ];
      WEAPONS.forEach(weapon => {
        expect(removedConnectors).not.toContain(weapon.name);
      });
    });

    it('should NOT contain capIncrease on any weapon', () => {
      WEAPONS.forEach(weapon => {
        expect(weapon.capIncrease).toBeUndefined();
      });
    });

    it('should NOT contain bridgeEffect on any weapon', () => {
      WEAPONS.forEach(weapon => {
        expect(weapon.bridgeEffect).toBeUndefined();
      });
    });
  });

  describe('Weapon Effects', () => {
    it('Blast Powder should have explosionChance effect', () => {
      const blastPowder = WEAPONS.find(w => w.name === 'Blast Powder');
      expect(blastPowder).toBeDefined();
      expect(blastPowder?.effects).toHaveProperty('explosionChance');
      expect(blastPowder?.effects.explosionChance).toBe(10);
    });

    it('Oracle Eye should have autoHintChance effect', () => {
      const oracleEye = WEAPONS.find(w => w.name === 'Oracle Eye');
      expect(oracleEye).toBeDefined();
      expect(oracleEye?.effects).toHaveProperty('autoHintChance');
      expect(oracleEye?.effects.autoHintChance).toBe(15);
    });

    it('Field Stone should have fieldSize effect', () => {
      const fieldStone = WEAPONS.find(w => w.name === 'Field Stone');
      expect(fieldStone).toBeDefined();
      expect(fieldStone?.effects).toHaveProperty('fieldSize');
      expect(fieldStone?.effects.fieldSize).toBe(1);
    });

    it('Life Vessel should have maxHealth and health effects', () => {
      const lifeVessel = WEAPONS.find(w => w.name === 'Life Vessel');
      expect(lifeVessel).toBeDefined();
      expect(lifeVessel?.effects).toHaveProperty('maxHealth');
      expect(lifeVessel?.effects).toHaveProperty('health');
      expect(lifeVessel?.effects.maxHealth).toBe(1);
      expect(lifeVessel?.effects.health).toBe(1);
    });

    it('Mending Charm should have healingChance effect', () => {
      const mendingCharm = WEAPONS.find(w => w.name === 'Mending Charm');
      expect(mendingCharm).toBeDefined();
      expect(mendingCharm?.effects).toHaveProperty('healingChance');
      expect(mendingCharm?.effects.healingChance).toBe(5);
    });

    it('Crystal Orb should have maxHints effect', () => {
      const crystalOrb = WEAPONS.find(w => w.name === 'Crystal Orb');
      expect(crystalOrb).toBeDefined();
      expect(crystalOrb?.effects).toHaveProperty('maxHints');
      expect(crystalOrb?.effects.maxHints).toBe(1);
    });

    it('Second Chance should have graces effect', () => {
      const secondChance = WEAPONS.find(w => w.name === 'Second Chance');
      expect(secondChance).toBeDefined();
      expect(secondChance?.effects).toHaveProperty('graces');
      expect(secondChance?.effects.graces).toBe(1);
    });

    it('Chrono Shard should have startingTime effect', () => {
      const chronoShard = WEAPONS.find(w => w.name === 'Chrono Shard');
      expect(chronoShard).toBeDefined();
      expect(chronoShard?.effects).toHaveProperty('startingTime');
      expect(chronoShard?.effects.startingTime).toBe(10);
    });

    it('Prismatic Ray should have laserChance effect', () => {
      const prismaticRay = WEAPONS.find(w => w.name === 'Prismatic Ray');
      expect(prismaticRay).toBeDefined();
      expect(prismaticRay?.effects).toHaveProperty('laserChance');
      expect(prismaticRay?.effects.laserChance).toBe(5);
    });

    it('Echo Stone should have echoChance effect', () => {
      const echoStone = WEAPONS.find(w => w.name === 'Echo Stone');
      expect(echoStone).toBeDefined();
      expect(echoStone?.effects).toHaveProperty('echoChance');
      expect(echoStone?.effects.echoChance).toBe(8);
    });

    it('Link Stone should have connectionChance effect', () => {
      const linkStone = WEAPONS.find(w => w.name === 'Link Stone');
      expect(linkStone).toBeDefined();
      expect(linkStone?.effects).toHaveProperty('connectionChance');
      expect(linkStone?.effects.connectionChance).toBe(15);
    });
  });

  describe('generateLevelUpWeapons', () => {
    it('should generate the specified number of weapons', () => {
      const weapons = generateLevelUpWeapons(4);
      expect(weapons.length).toBe(4);
    });

    it('should generate weapons with valid properties', () => {
      const weapons = generateLevelUpWeapons(10);
      weapons.forEach(weapon => {
        expect(weapon).toHaveProperty('id');
        expect(weapon).toHaveProperty('name');
        expect(weapon).toHaveProperty('rarity');
      });
    });
  });

  describe('getRandomWeapon', () => {
    it('should return a valid weapon', () => {
      const weapon = getRandomWeapon();
      expect(weapon).toHaveProperty('id');
      expect(weapon).toHaveProperty('name');
      expect(weapon).toHaveProperty('rarity');
    });

    it('should filter based on maxCount when defined on WEAPONS entry', () => {
      // Note: maxCount is checked on the weapon definition (from WEAPONS array),
      // not on the player's copy. Currently no base weapons have maxCount defined.
      // This test verifies the function doesn't crash with empty/full player weapons.
      const playerWeapons = [...WEAPONS]; // Player has one of each weapon

      // Should still return weapons since none have maxCount limits
      for (let i = 0; i < 10; i++) {
        const weapon = getRandomWeapon(playerWeapons);
        expect(weapon).toBeDefined();
        expect(weapon.id).toBeDefined();
      }
    });
  });

  describe('canObtainWeapon', () => {
    it('should return true for weapons without maxCount', () => {
      const blastPowder = WEAPONS.find(w => w.name === 'Blast Powder')!;
      const playerWeapons: Weapon[] = [blastPowder, blastPowder, blastPowder];

      expect(canObtainWeapon(blastPowder, playerWeapons)).toBe(true);
    });

    it('should return false when player has maxCount of weapon', () => {
      const weaponWithLimit = { ...WEAPONS[0], maxCount: 1 };
      const playerWeapons: Weapon[] = [weaponWithLimit];

      expect(canObtainWeapon(weaponWithLimit, playerWeapons)).toBe(false);
    });

    it('should return true when player has less than maxCount', () => {
      const weaponWithLimit = { ...WEAPONS[0], maxCount: 2 };
      const playerWeapons: Weapon[] = [weaponWithLimit];

      expect(canObtainWeapon(weaponWithLimit, playerWeapons)).toBe(true);
    });
  });

  describe('getPlayerWeaponCount', () => {
    it('should return 0 for empty weapon list', () => {
      expect(getPlayerWeaponCount('Blast Powder', [])).toBe(0);
    });

    it('should count weapons by name', () => {
      const blastPowder = WEAPONS.find(w => w.name === 'Blast Powder')!;
      const playerWeapons = [blastPowder, blastPowder, blastPowder];

      expect(getPlayerWeaponCount('Blast Powder', playerWeapons)).toBe(3);
    });

    it('should only count weapons with matching name', () => {
      const blastPowder = WEAPONS.find(w => w.name === 'Blast Powder')!;
      const oracleEye = WEAPONS.find(w => w.name === 'Oracle Eye')!;
      const playerWeapons = [blastPowder, oracleEye, blastPowder];

      expect(getPlayerWeaponCount('Blast Powder', playerWeapons)).toBe(2);
      expect(getPlayerWeaponCount('Oracle Eye', playerWeapons)).toBe(1);
    });
  });
});

describe('Stats Calculation', () => {
  describe('calculatePlayerTotalStats', () => {
    it('should return base stats for player with no weapons', () => {
      const player = initializePlayer('test', 'Test Player', 'Orange Tabby');
      const totalStats = calculatePlayerTotalStats(player);

      expect(totalStats.health).toBeDefined();
      expect(totalStats.maxHealth).toBeDefined();
      expect(totalStats.money).toBeDefined();
    });

    it('should add weapon effects to base stats', () => {
      const player = initializePlayer('test', 'Test Player', 'Orange Tabby');

      // Add a Life Vessel weapon (+1 maxHealth)
      // Orange Tabby starts with Life Vessel (+1), so adding another makes +2
      const lifeVessel = WEAPONS.find(w => w.name === 'Life Vessel')!;
      player.weapons.push(lifeVessel);

      const baseStats = initializePlayer('test2', 'Test Player 2', 'Orange Tabby');
      const totalStats = calculatePlayerTotalStats(player);

      // +2 = +1 from starting Life Vessel + 1 from added
      expect(totalStats.maxHealth).toBe(baseStats.stats.maxHealth + 2);
    });

    it('should stack multiple weapons of the same type', () => {
      const player = initializePlayer('test', 'Test Player', 'Orange Tabby');

      // Add 3 Life Vessel weapons (+1 each = +3 maxHealth)
      // Note: Orange Tabby already starts with Life Vessel (+1), so total is +4
      const lifeVessel = WEAPONS.find(w => w.name === 'Life Vessel')!;
      player.weapons.push({ ...lifeVessel, id: 'lv1' });
      player.weapons.push({ ...lifeVessel, id: 'lv2' });
      player.weapons.push({ ...lifeVessel, id: 'lv3' });

      const baseStats = initializePlayer('test2', 'Test Player 2', 'Orange Tabby');
      const totalStats = calculatePlayerTotalStats(player);

      // +4 = +1 from starting Life Vessel + 3 from added
      expect(totalStats.maxHealth).toBe(baseStats.stats.maxHealth + 4);
    });

    it('should combine effects from different weapon types', () => {
      const player = initializePlayer('test', 'Test Player', 'Orange Tabby');

      // Add Life Vessel (+1 maxHealth) and Second Chance (+1 grace)
      const lifeVessel = WEAPONS.find(w => w.name === 'Life Vessel')!;
      const secondChance = WEAPONS.find(w => w.name === 'Second Chance')!;

      player.weapons.push(lifeVessel);
      player.weapons.push(secondChance);

      const baseStats = initializePlayer('test2', 'Test Player 2', 'Orange Tabby');
      const totalStats = calculatePlayerTotalStats(player);

      // +2 = +1 from starting Life Vessel + 1 from added
      expect(totalStats.maxHealth).toBe(baseStats.stats.maxHealth + 2);
      // +1 from added Second Chance
      expect(totalStats.graces).toBe(baseStats.stats.graces + 1);
    });

    it('should correctly calculate explosionChance from Blast Powder', () => {
      const player = initializePlayer('test', 'Test Player', 'Orange Tabby');

      const blastPowder = WEAPONS.find(w => w.name === 'Blast Powder')!;
      player.weapons.push(blastPowder);

      const totalStats = calculatePlayerTotalStats(player);

      expect(totalStats.explosionChance).toBe(10);
    });

    it('should correctly calculate healingChance from Mending Charm', () => {
      const player = initializePlayer('test', 'Test Player', 'Orange Tabby');

      const mendingCharm = WEAPONS.find(w => w.name === 'Mending Charm')!;
      player.weapons.push(mendingCharm);

      const totalStats = calculatePlayerTotalStats(player);

      // Orange Tabby starts with Mending Charm (+5), adding another (+5) = 10
      expect(totalStats.healingChance).toBe(10);
    });

    it('should correctly calculate laserChance from Prismatic Ray', () => {
      const player = initializePlayer('test', 'Test Player', 'Orange Tabby');

      const prismaticRay = WEAPONS.find(w => w.name === 'Prismatic Ray')!;
      player.weapons.push(prismaticRay);

      const totalStats = calculatePlayerTotalStats(player);

      // Prismatic Ray is +5 laserChance
      expect(totalStats.laserChance).toBe(5);
    });

    it('should correctly calculate startingTime from Chrono Shard', () => {
      const player = initializePlayer('test', 'Test Player', 'Orange Tabby');

      const chronoShard = WEAPONS.find(w => w.name === 'Chrono Shard')!;
      player.weapons.push(chronoShard);

      const totalStats = calculatePlayerTotalStats(player);

      expect(totalStats.startingTime).toBe(10);
    });
  });
});
