import {
  WEAPONS,
  generateShopWeapons,
  getRandomShopWeapon,
  calculatePlayerTotalStats,
  initializePlayer,
  DEFAULT_PLAYER_STATS,
} from '@/utils/gameDefinitions';
import { Weapon, WeaponRarity, Player } from '@/types';

describe('Weapon Definitions', () => {
  describe('WEAPONS array', () => {
    it('should have exactly 45 weapons (15 types x 3 rarities)', () => {
      expect(WEAPONS.length).toBe(45);
    });

    it('should have 15 common weapons', () => {
      const commons = WEAPONS.filter(w => w.rarity === 'common');
      expect(commons.length).toBe(15);
    });

    it('should have 15 rare weapons', () => {
      const rares = WEAPONS.filter(w => w.rarity === 'rare');
      expect(rares.length).toBe(15);
    });

    it('should have 15 legendary weapons', () => {
      const legendaries = WEAPONS.filter(w => w.rarity === 'legendary');
      expect(legendaries.length).toBe(15);
    });

    it('should have all required weapon types', () => {
      const weaponNames = new Set(WEAPONS.map(w => w.name));
      const expectedTypes: import('@/types').WeaponName[] = [
        'Blast Powder',
        'Oracle Eye',
        'Field Stone',
        'Growth Seed',
        'Flint Spark',
        'Second Chance',
        'Fortune Token',
        'Life Vessel',
        'Mending Charm',
        'Crystal Orb',
        'Seeker Lens',
        'Prism Glass',
        'Chrono Shard',
        'Time Drop',
        'Prismatic Ray',
      ];

      expectedTypes.forEach(type => {
        expect(weaponNames.has(type)).toBe(true);
      });
    });

    it('each weapon should have all required properties', () => {
      WEAPONS.forEach(weapon => {
        expect(weapon).toHaveProperty('id');
        expect(weapon).toHaveProperty('name');
        expect(weapon).toHaveProperty('rarity');
        expect(weapon).toHaveProperty('level');
        expect(weapon).toHaveProperty('price');
        expect(weapon).toHaveProperty('description');
        expect(weapon).toHaveProperty('effects');

        // Validate types
        expect(typeof weapon.id).toBe('string');
        expect(typeof weapon.name).toBe('string');
        expect(['common', 'rare', 'legendary']).toContain(weapon.rarity);
        expect(typeof weapon.level).toBe('number');
        expect(typeof weapon.price).toBe('number');
        expect(typeof weapon.description).toBe('string');
        expect(typeof weapon.effects).toBe('object');
      });
    });

    it('common weapons should cost 5-10 coins', () => {
      const commons = WEAPONS.filter(w => w.rarity === 'common');
      commons.forEach(weapon => {
        expect(weapon.price).toBeGreaterThanOrEqual(5);
        expect(weapon.price).toBeLessThanOrEqual(10);
      });
    });

    it('rare weapons should cost 14-25 coins', () => {
      const rares = WEAPONS.filter(w => w.rarity === 'rare');
      rares.forEach(weapon => {
        expect(weapon.price).toBeGreaterThanOrEqual(14);
        expect(weapon.price).toBeLessThanOrEqual(25);
      });
    });

    it('legendary weapons should cost 38-60 coins', () => {
      const legendaries = WEAPONS.filter(w => w.rarity === 'legendary');
      legendaries.forEach(weapon => {
        expect(weapon.price).toBeGreaterThanOrEqual(38);
        expect(weapon.price).toBeLessThanOrEqual(60);
      });
    });

    it('each weapon type should have 3 rarities', () => {
      const weaponsByName = new Map<string, Weapon[]>();

      WEAPONS.forEach(weapon => {
        const existing = weaponsByName.get(weapon.name) || [];
        existing.push(weapon);
        weaponsByName.set(weapon.name, existing);
      });

      weaponsByName.forEach((weapons, name) => {
        expect(weapons.length).toBe(3);
        const rarities = weapons.map(w => w.rarity);
        expect(rarities).toContain('common');
        expect(rarities).toContain('rare');
        expect(rarities).toContain('legendary');
      });
    });
  });

  describe('Weapon Effects', () => {
    it('Blast Powder should have explosionChance effect', () => {
      const blastPowders = WEAPONS.filter(w => w.name === 'Blast Powder');
      blastPowders.forEach(weapon => {
        expect(weapon.effects).toHaveProperty('explosionChance');
        expect(weapon.effects.explosionChance).toBeGreaterThan(0);
      });
    });

    it('Oracle Eye should have autoHintChance effect', () => {
      const oracleEyes = WEAPONS.filter(w => w.name === 'Oracle Eye');
      oracleEyes.forEach(weapon => {
        expect(weapon.effects).toHaveProperty('autoHintChance');
        expect(weapon.effects.autoHintChance).toBeGreaterThan(0);
      });
    });

    it('Field Stone should have fieldSize effect', () => {
      const fieldStones = WEAPONS.filter(w => w.name === 'Field Stone');
      fieldStones.forEach(weapon => {
        expect(weapon.effects).toHaveProperty('fieldSize');
        expect(weapon.effects.fieldSize).toBeGreaterThan(0);
      });
    });

    it('Life Vessel should have maxHealth effect', () => {
      const lifeVessels = WEAPONS.filter(w => w.name === 'Life Vessel');
      lifeVessels.forEach(weapon => {
        expect(weapon.effects).toHaveProperty('maxHealth');
        expect(weapon.effects.maxHealth).toBeGreaterThan(0);
      });
    });

    it('Mending Charm should have healingChance effect', () => {
      const mendingCharms = WEAPONS.filter(w => w.name === 'Mending Charm');
      mendingCharms.forEach(weapon => {
        expect(weapon.effects).toHaveProperty('healingChance');
        expect(weapon.effects.healingChance).toBeGreaterThan(0);
      });
    });

    it('Crystal Orb should have hints effect', () => {
      const crystalOrbs = WEAPONS.filter(w => w.name === 'Crystal Orb');
      crystalOrbs.forEach(weapon => {
        expect(weapon.effects).toHaveProperty('hints');
        expect(weapon.effects.hints).toBeGreaterThan(0);
      });
    });

    it('Second Chance should have mulligans effect', () => {
      const secondChances = WEAPONS.filter(w => w.name === 'Second Chance');
      secondChances.forEach(weapon => {
        expect(weapon.effects).toHaveProperty('mulligans');
        expect(weapon.effects.mulligans).toBeGreaterThan(0);
      });
    });

    it('Chrono Shard should have startingTime effect', () => {
      const chronoShards = WEAPONS.filter(w => w.name === 'Chrono Shard');
      chronoShards.forEach(weapon => {
        expect(weapon.effects).toHaveProperty('startingTime');
        expect(weapon.effects.startingTime).toBeGreaterThan(0);
      });
    });

    it('Prismatic Ray should have laserChance effect', () => {
      const prismaticRays = WEAPONS.filter(w => w.name === 'Prismatic Ray');
      prismaticRays.forEach(weapon => {
        expect(weapon.effects).toHaveProperty('laserChance');
        expect(weapon.effects.laserChance).toBeGreaterThan(0);
      });
    });

    it('legendary weapons should have higher effect values than common', () => {
      const weaponsByName = new Map<string, Map<WeaponRarity, Weapon>>();

      WEAPONS.forEach(weapon => {
        if (!weaponsByName.has(weapon.name)) {
          weaponsByName.set(weapon.name, new Map());
        }
        weaponsByName.get(weapon.name)!.set(weapon.rarity, weapon);
      });

      weaponsByName.forEach((rarityMap, name) => {
        const common = rarityMap.get('common')!;
        const legendary = rarityMap.get('legendary')!;

        // Compare the first effect value
        const commonEffectKey = Object.keys(common.effects)[0];
        const commonValue = common.effects[commonEffectKey as keyof typeof common.effects] as number;
        const legendaryValue = legendary.effects[commonEffectKey as keyof typeof legendary.effects] as number;

        expect(legendaryValue).toBeGreaterThan(commonValue);
      });
    });
  });

  describe('generateShopWeapons', () => {
    it('should generate the specified number of weapons', () => {
      const weapons = generateShopWeapons(4);
      expect(weapons.length).toBe(4);
    });

    it('should generate weapons with valid properties', () => {
      const weapons = generateShopWeapons(10);
      weapons.forEach(weapon => {
        expect(weapon).toHaveProperty('id');
        expect(weapon).toHaveProperty('name');
        expect(weapon).toHaveProperty('rarity');
        expect(weapon).toHaveProperty('price');
      });
    });

    it('should follow approximate rarity distribution over many samples', () => {
      // Generate many weapons to test distribution
      const totalSamples = 1000;
      const weapons: Weapon[] = [];

      for (let i = 0; i < totalSamples / 4; i++) {
        weapons.push(...generateShopWeapons(4));
      }

      const commons = weapons.filter(w => w.rarity === 'common').length;
      const rares = weapons.filter(w => w.rarity === 'rare').length;
      const legendaries = weapons.filter(w => w.rarity === 'legendary').length;

      // Expected: 70% common, 25% rare, 5% legendary
      // Allow +/- 10% tolerance for randomness
      expect(commons / totalSamples).toBeGreaterThan(0.55);
      expect(commons / totalSamples).toBeLessThan(0.85);

      expect(rares / totalSamples).toBeGreaterThan(0.15);
      expect(rares / totalSamples).toBeLessThan(0.40);

      expect(legendaries / totalSamples).toBeGreaterThan(0.01);
      expect(legendaries / totalSamples).toBeLessThan(0.15);
    });
  });

  describe('getRandomShopWeapon', () => {
    it('should return a valid weapon', () => {
      const weapon = getRandomShopWeapon();
      expect(weapon).toHaveProperty('id');
      expect(weapon).toHaveProperty('name');
      expect(weapon).toHaveProperty('rarity');
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
      const lifeVessel = WEAPONS.find(
        w => w.name === 'Life Vessel' && w.rarity === 'common'
      )!;
      player.weapons.push(lifeVessel);

      const baseStats = initializePlayer('test2', 'Test Player 2', 'Orange Tabby');
      const totalStats = calculatePlayerTotalStats(player);

      expect(totalStats.maxHealth).toBe(baseStats.stats.maxHealth + 1);
    });

    it('should stack multiple weapons of the same type', () => {
      const player = initializePlayer('test', 'Test Player', 'Orange Tabby');

      // Add 3 Life Vessel commons (+1 each = +3 maxHealth)
      const lifeVessel = WEAPONS.find(
        w => w.name === 'Life Vessel' && w.rarity === 'common'
      )!;
      player.weapons.push({ ...lifeVessel, id: 'lv1' });
      player.weapons.push({ ...lifeVessel, id: 'lv2' });
      player.weapons.push({ ...lifeVessel, id: 'lv3' });

      const baseStats = initializePlayer('test2', 'Test Player 2', 'Orange Tabby');
      const totalStats = calculatePlayerTotalStats(player);

      expect(totalStats.maxHealth).toBe(baseStats.stats.maxHealth + 3);
    });

    it('should combine effects from different weapon types', () => {
      const player = initializePlayer('test', 'Test Player', 'Orange Tabby');

      // Add Life Vessel (+1 maxHealth) and Second Chance (+1 mulligan)
      // Note: Orange Tabby already starts with Second Chance (+1 mulligan)
      const lifeVessel = WEAPONS.find(
        w => w.name === 'Life Vessel' && w.rarity === 'common'
      )!;
      const secondChance = WEAPONS.find(
        w => w.name === 'Second Chance' && w.rarity === 'common'
      )!;

      player.weapons.push(lifeVessel);
      player.weapons.push(secondChance);

      const baseStats = initializePlayer('test2', 'Test Player 2', 'Orange Tabby');
      const totalStats = calculatePlayerTotalStats(player);

      expect(totalStats.maxHealth).toBe(baseStats.stats.maxHealth + 1);
      // +2 because Orange Tabby starts with Second Chance, plus we added another
      expect(totalStats.mulligans).toBe(baseStats.stats.mulligans + 2);
    });

    it('should correctly calculate explosionChance from Blast Powder', () => {
      const player = initializePlayer('test', 'Test Player', 'Orange Tabby');

      const blastPowder = WEAPONS.find(
        w => w.name === 'Blast Powder' && w.rarity === 'common'
      )!;
      player.weapons.push(blastPowder);

      const totalStats = calculatePlayerTotalStats(player);

      expect(totalStats.explosionChance).toBe(10); // Common is 10%
    });

    it('should correctly calculate healingChance from Mending Charm', () => {
      const player = initializePlayer('test', 'Test Player', 'Orange Tabby');

      const mendingCharm = WEAPONS.find(
        w => w.name === 'Mending Charm' && w.rarity === 'rare'
      )!;
      player.weapons.push(mendingCharm);

      const totalStats = calculatePlayerTotalStats(player);

      expect(totalStats.healingChance).toBe(10); // Rare is 10%
    });

    it('should correctly calculate laserChance from Prismatic Ray', () => {
      const player = initializePlayer('test', 'Test Player', 'Orange Tabby');

      const prismaticRay = WEAPONS.find(
        w => w.name === 'Prismatic Ray' && w.rarity === 'legendary'
      )!;
      player.weapons.push(prismaticRay);

      const totalStats = calculatePlayerTotalStats(player);

      expect(totalStats.laserChance).toBe(10); // Legendary is 10%
    });

    it('should correctly calculate startingTime from Chrono Shard', () => {
      const player = initializePlayer('test', 'Test Player', 'Orange Tabby');

      const chronoShard = WEAPONS.find(
        w => w.name === 'Chrono Shard' && w.rarity === 'common'
      )!;
      player.weapons.push(chronoShard);

      const totalStats = calculatePlayerTotalStats(player);

      expect(totalStats.startingTime).toBe(15); // Common is +15s
    });
  });
});
