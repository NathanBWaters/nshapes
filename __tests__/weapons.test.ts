import {
  WEAPONS,
  generateShopWeapons,
  getRandomShopWeapon,
  calculatePlayerTotalStats,
  initializePlayer,
  DEFAULT_PLAYER_STATS,
  canObtainWeapon,
  getPlayerWeaponCount,
} from '@/utils/gameDefinitions';
import { Weapon, WeaponRarity, Player } from '@/types';

describe('Weapon Definitions', () => {
  describe('WEAPONS array', () => {
    it('should have exactly 95 weapons (18 types x 3 rarities + 2 legendary-only + 11 cap increasers + 18 epic variants + 10 bridge legendaries)', () => {
      expect(WEAPONS.length).toBe(95);
    });

    it('should have 18 common weapons', () => {
      const commons = WEAPONS.filter(w => w.rarity === 'common');
      expect(commons.length).toBe(18);
    });

    it('should have 29 rare weapons (18 base + 11 cap increasers)', () => {
      const rares = WEAPONS.filter(w => w.rarity === 'rare');
      expect(rares.length).toBe(29);
    });

    it('should have 18 epic weapons (epic variants)', () => {
      const epics = WEAPONS.filter(w => w.rarity === 'epic');
      expect(epics.length).toBe(18);
    });

    it('should have 30 legendary weapons (18 base + Mystic Sight + Chain Reaction + 10 bridge legendaries)', () => {
      const legendaries = WEAPONS.filter(w => w.rarity === 'legendary');
      expect(legendaries.length).toBe(30);
    });

    it('should have all required weapon types', () => {
      const weaponNames = new Set(WEAPONS.map(w => w.name));
      const expectedTypes: import('@/types').WeaponName[] = [
        'Blast Powder',
        'Oracle Eye',
        'Mystic Sight',  // Legendary only
        'Field Stone',
        'Growth Seed',
        'Flint Spark',
        'Second Chance',
        'Fortune Token',
        'Life Vessel',
        'Mending Charm',
        'Crystal Orb',
        'Seeker Lens',
        'Scholar\'s Tome',
        'Fortune\'s Favor',
        'Chrono Shard',
        'Time Drop',
        'Prismatic Ray',
        'Chaos Shard',
        'Echo Stone',
        'Chain Reaction',
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
        expect(['common', 'rare', 'epic', 'legendary']).toContain(weapon.rarity);
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

    it('rare weapons should cost 10-20 coins', () => {
      const rares = WEAPONS.filter(w => w.rarity === 'rare');
      rares.forEach(weapon => {
        expect(weapon.price).toBeGreaterThanOrEqual(10);
        expect(weapon.price).toBeLessThanOrEqual(20);
      });
    });

    it('legendary weapons should cost 15-50 coins', () => {
      const legendaries = WEAPONS.filter(w => w.rarity === 'legendary');
      legendaries.forEach(weapon => {
        expect(weapon.price).toBeGreaterThanOrEqual(15);
        expect(weapon.price).toBeLessThanOrEqual(50);
      });
    });

    it('most weapon types should have 3 rarities, some are legendary-only, rare-only, or epic-only', () => {
      const weaponsByName = new Map<string, Weapon[]>();
      const legendaryOnlyWeapons = [
        'Mystic Sight', 'Chain Reaction',
        // Bridge weapons (cross-system triggers)
        'Phoenix Feather', 'Chaos Conduit', 'Temporal Rift', 'Soul Harvest',
        'Cascade Core', "Fortune's Blessing", 'Wisdom Chain', 'Grace Conduit',
        'Hint Catalyst', 'Life Link'
      ];
      // Cap increaser weapons are rare-only (one per effect type)
      const rareOnlyWeapons = [
        'Echo Mastery', 'Laser Mastery', 'Grace Mastery', 'Explosion Mastery',
        'Hint Mastery', 'Time Mastery', 'Healing Mastery', 'Fire Mastery',
        'Ricochet Mastery', 'Growth Mastery', 'Coin Mastery'
      ];
      // Epic weapon variants are epic-only
      const epicOnlyWeapons = [
        'Inferno Charge', 'Ember Heart', 'Lucky Charm', 'Restoration Aura',
        'Golden Touch', 'Spectrum Annihilator', 'Resonance Crystal',
        'Terra Foundation', "Fortune's Shield", 'Clairvoyant Sphere',
        'Arcane Codex', 'Temporal Core', 'Vital Core', "Prophet's Vision",
        'Life Bloom', 'Enlightened Eye', 'Hourglass of Ages', 'Entropy Engine'
      ];

      WEAPONS.forEach(weapon => {
        const existing = weaponsByName.get(weapon.name) || [];
        existing.push(weapon);
        weaponsByName.set(weapon.name, existing);
      });

      weaponsByName.forEach((weapons, name) => {
        if (legendaryOnlyWeapons.includes(name)) {
          // Legendary-only weapons should have exactly 1 rarity
          expect(weapons.length).toBe(1);
          expect(weapons[0].rarity).toBe('legendary');
        } else if (rareOnlyWeapons.includes(name)) {
          // Rare-only weapons (cap increasers) should have exactly 1 rarity
          expect(weapons.length).toBe(1);
          expect(weapons[0].rarity).toBe('rare');
        } else if (epicOnlyWeapons.includes(name)) {
          // Epic-only weapons should have exactly 1 rarity
          expect(weapons.length).toBe(1);
          expect(weapons[0].rarity).toBe('epic');
        } else {
          // Normal weapons should have all 3 rarities
          expect(weapons.length).toBe(3);
          const rarities = weapons.map(w => w.rarity);
          expect(rarities).toContain('common');
          expect(rarities).toContain('rare');
          expect(rarities).toContain('legendary');
        }
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

    it('Crystal Orb should have maxHints effect', () => {
      const crystalOrbs = WEAPONS.filter(w => w.name === 'Crystal Orb');
      crystalOrbs.forEach(weapon => {
        expect(weapon.effects).toHaveProperty('maxHints');
        expect(weapon.effects.maxHints).toBeGreaterThan(0);
      });
    });

    it('Second Chance should have graces effect', () => {
      const secondChances = WEAPONS.filter(w => w.name === 'Second Chance');
      secondChances.forEach(weapon => {
        expect(weapon.effects).toHaveProperty('graces');
        expect(weapon.effects.graces).toBeGreaterThan(0);
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

    it('legendary weapons should have higher effect values than common (for weapons with all rarities)', () => {
      const weaponsByName = new Map<string, Map<WeaponRarity, Weapon>>();
      const legendaryOnlyWeapons = [
        'Mystic Sight', 'Chain Reaction',
        // Bridge weapons (cross-system triggers)
        'Phoenix Feather', 'Chaos Conduit', 'Temporal Rift', 'Soul Harvest',
        'Cascade Core', "Fortune's Blessing", 'Wisdom Chain', 'Grace Conduit',
        'Hint Catalyst', 'Life Link'
      ];
      // Cap increaser weapons are rare-only (one per effect type)
      const rareOnlyWeapons = [
        'Echo Mastery', 'Laser Mastery', 'Grace Mastery', 'Explosion Mastery',
        'Hint Mastery', 'Time Mastery', 'Healing Mastery', 'Fire Mastery',
        'Ricochet Mastery', 'Growth Mastery', 'Coin Mastery'
      ];
      // Epic weapon variants are epic-only
      const epicOnlyWeapons = [
        'Inferno Charge', 'Ember Heart', 'Lucky Charm', 'Restoration Aura',
        'Golden Touch', 'Spectrum Annihilator', 'Resonance Crystal',
        'Terra Foundation', "Fortune's Shield", 'Clairvoyant Sphere',
        'Arcane Codex', 'Temporal Core', 'Vital Core', "Prophet's Vision",
        'Life Bloom', 'Enlightened Eye', 'Hourglass of Ages', 'Entropy Engine'
      ];

      WEAPONS.forEach(weapon => {
        if (!weaponsByName.has(weapon.name)) {
          weaponsByName.set(weapon.name, new Map());
        }
        weaponsByName.get(weapon.name)!.set(weapon.rarity, weapon);
      });

      weaponsByName.forEach((rarityMap, name) => {
        // Skip legendary-only, rare-only (cap increasers), and epic-only weapons
        if (legendaryOnlyWeapons.includes(name)) return;
        if (rareOnlyWeapons.includes(name)) return;
        if (epicOnlyWeapons.includes(name)) return;

        const common = rarityMap.get('common')!;
        const legendary = rarityMap.get('legendary')!;

        // Compare the first effect value
        const commonEffectKey = Object.keys(common.effects)[0];
        const commonValue = common.effects[commonEffectKey as keyof typeof common.effects] as number;
        const legendaryValue = legendary.effects[commonEffectKey as keyof typeof legendary.effects] as number;

        expect(legendaryValue).toBeGreaterThan(commonValue);
      });
    });

    it('Mystic Sight should have enhancedHintChance effect', () => {
      const mysticSight = WEAPONS.find(w => w.name === 'Mystic Sight');
      expect(mysticSight).toBeDefined();
      expect(mysticSight?.effects).toHaveProperty('enhancedHintChance');
      expect(mysticSight?.effects.enhancedHintChance).toBe(33);
    });

    it('Mystic Sight should be legendary only', () => {
      const mysticSights = WEAPONS.filter(w => w.name === 'Mystic Sight');
      expect(mysticSights.length).toBe(1);
      expect(mysticSights[0].rarity).toBe('legendary');
    });

    it('Mystic Sight should have maxCount of 1', () => {
      const mysticSight = WEAPONS.find(w => w.name === 'Mystic Sight');
      expect(mysticSight?.maxCount).toBe(1);
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
      const epics = weapons.filter(w => w.rarity === 'epic').length;
      const legendaries = weapons.filter(w => w.rarity === 'legendary').length;

      // Expected at round 5 (default): ~53% common, ~22.5% rare, ~10.5% epic, ~3% legendary
      // Allow generous tolerance for randomness since epic weapons don't exist yet
      // and all epic rolls fall back to common
      // Common should be majority
      expect(commons / totalSamples).toBeGreaterThan(0.35);
      expect(commons / totalSamples).toBeLessThan(0.85);

      // Rare should be significant
      expect(rares / totalSamples).toBeGreaterThan(0.10);
      expect(rares / totalSamples).toBeLessThan(0.40);

      // Epic should be present (may be 0 until epic weapons are added)
      // For now just check it's a valid count
      expect(epics).toBeGreaterThanOrEqual(0);
      expect(epics / totalSamples).toBeLessThan(0.30);

      // Legendary should be rare
      expect(legendaries / totalSamples).toBeGreaterThan(0.005);
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

    it('should not return weapons at maxCount when player weapons provided', () => {
      // Get Mystic Sight (maxCount: 1)
      const mysticSight = WEAPONS.find(w => w.name === 'Mystic Sight')!;
      const playerWeapons = [mysticSight]; // Player already has it

      // Generate many weapons and verify Mystic Sight never appears
      for (let i = 0; i < 100; i++) {
        const weapon = getRandomShopWeapon(playerWeapons);
        expect(weapon.name).not.toBe('Mystic Sight');
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
      const mysticSight = WEAPONS.find(w => w.name === 'Mystic Sight')!;
      const playerWeapons: Weapon[] = [mysticSight];

      expect(canObtainWeapon(mysticSight, playerWeapons)).toBe(false);
    });

    it('should return true when player has less than maxCount', () => {
      const mysticSight = WEAPONS.find(w => w.name === 'Mystic Sight')!;
      const playerWeapons: Weapon[] = [];

      expect(canObtainWeapon(mysticSight, playerWeapons)).toBe(true);
    });
  });

  describe('getPlayerWeaponCount', () => {
    it('should return 0 for empty weapon list', () => {
      expect(getPlayerWeaponCount('Mystic Sight', [])).toBe(0);
    });

    it('should count weapons by name', () => {
      const blastPowder = WEAPONS.find(w => w.name === 'Blast Powder' && w.rarity === 'common')!;
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
      const lifeVessel = WEAPONS.find(
        w => w.name === 'Life Vessel' && w.rarity === 'common'
      )!;
      player.weapons.push(lifeVessel);

      const baseStats = initializePlayer('test2', 'Test Player 2', 'Orange Tabby');
      const totalStats = calculatePlayerTotalStats(player);

      // +2 = +1 from starting Life Vessel + 1 from added
      expect(totalStats.maxHealth).toBe(baseStats.stats.maxHealth + 2);
    });

    it('should stack multiple weapons of the same type', () => {
      const player = initializePlayer('test', 'Test Player', 'Orange Tabby');

      // Add 3 Life Vessel commons (+1 each = +3 maxHealth)
      // Note: Orange Tabby already starts with Life Vessel (+1), so total is +4
      const lifeVessel = WEAPONS.find(
        w => w.name === 'Life Vessel' && w.rarity === 'common'
      )!;
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
      // Orange Tabby starts with Life Vessel (+1) and Mending Charm (+5 healing)
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

      // +2 = +1 from starting Life Vessel + 1 from added
      expect(totalStats.maxHealth).toBe(baseStats.stats.maxHealth + 2);
      // +1 from added Second Chance (Orange Tabby doesn't start with any graces)
      expect(totalStats.graces).toBe(baseStats.stats.graces + 1);
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

      // Orange Tabby starts with Mending Charm Common (+5), adding Rare (+15) = 20
      expect(totalStats.healingChance).toBe(20);
    });

    it('should correctly calculate laserChance from Prismatic Ray', () => {
      const player = initializePlayer('test', 'Test Player', 'Orange Tabby');

      const prismaticRay = WEAPONS.find(
        w => w.name === 'Prismatic Ray' && w.rarity === 'legendary'
      )!;
      player.weapons.push(prismaticRay);

      const totalStats = calculatePlayerTotalStats(player);

      // Prismatic Ray Legendary is +21 laserChance
      expect(totalStats.laserChance).toBe(21);
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
