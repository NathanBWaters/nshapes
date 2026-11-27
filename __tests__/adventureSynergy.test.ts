/**
 * Synergy Graph (15 nodes, 64 weapon base scaling hooks), Holographic Cards
 * (+4 base & +0.20× additive mult), Elevated Base Damage vs Compressed Multipliers,
 * and complete Power-scaling removal verification.
 */
import * as fs from 'fs';
import * as path from 'path';
import type { Card } from '@/types';
import { ALL_ARMORY_WEAPON_IDS } from '@/adventure/data/armory';
import {
  SYNERGY_ATTR_IDS,
  SYNERGY_ATTR_META,
  WEAPON_SYNERGY_PROFILES,
  beltSynergyOverlap,
  createInitialSynergyCounters,
  evaluateWeaponSynergyDamage,
  evaluateWeaponSynergyModifiers,
  getWeaponSynergyHooks,
  getWeaponSynergyProfile,
} from '@/adventure/data/synergy';
import { BASE_RULES, SURGE_RULES, TRICK_RULES } from '@/adventure/data/rules';
import { PARRY_RULES } from '@/adventure/data/parry';
import { PASSIVE_TUNING } from '@/adventure/data/passives';
import { baseCardReward, runReducer } from '@/adventure/engine/run';
import { COLLATERAL_DAMAGE } from '@/adventure/engine/fight';
import type { SynergyAttrId } from '@/adventure/types';
import { findSet, playSet, relic, startFight, testLevel, tick, withWeapons } from './testUtils/adventureFight';

const ICON_SRC = fs.readFileSync(path.resolve(__dirname, '../src/components/Icon.tsx'), 'utf8');
const VALID_ICONS = new Set([...ICON_SRC.slice(ICON_SRC.indexOf('const ICON_REGISTRY')).matchAll(/^\s*'([^']+)':/gm)].map(m => m[1]));

const REPO_ROOT = path.resolve(__dirname, '..');

const mkCard = (
  id: string,
  shape: Card['shape'],
  color: Card['color'],
  number: 1 | 2 | 3,
  extra: Partial<Card> = {}
): Card => ({
  id,
  shape,
  color,
  number,
  shading: 'solid',
  background: 'white',
  selected: false,
  ...extra,
});

describe('15-Node Synergy Graph & 64-Weapon Scaling Hooks', () => {
  it('defines all 15 Synergy attributes with verified icons, distinct labels, and dense producer/consumer edges', () => {
    expect(SYNERGY_ATTR_IDS).toHaveLength(15);
    expect(Object.keys(SYNERGY_ATTR_META)).toHaveLength(15);

    const labels = new Set<string>();
    for (const id of SYNERGY_ATTR_IDS) {
      const meta = SYNERGY_ATTR_META[id];
      expect(meta.id).toBe(id);
      expect(VALID_ICONS.has(meta.icon)).toBe(true);
      expect(meta.description.length).toBeGreaterThan(10);
      expect(labels.has(meta.label)).toBe(false);
      labels.add(meta.label);
    }

    const producers = new Map<SynergyAttrId, number>();
    const consumers = new Map<SynergyAttrId, number>();
    for (const id of SYNERGY_ATTR_IDS) {
      producers.set(id, 0);
      consumers.set(id, 0);
    }

    expect(Object.keys(WEAPON_SYNERGY_PROFILES)).toHaveLength(64);
    for (const weaponId of ALL_ARMORY_WEAPON_IDS) {
      const profile = getWeaponSynergyProfile(weaponId);
      expect(profile.weaponId).toBe(weaponId);
      const hooks = getWeaponSynergyHooks(weaponId);
      expect(hooks.length).toBeGreaterThanOrEqual(1);
      expect(hooks.length).toBeLessThanOrEqual(3);

      for (const a of profile.produces) producers.set(a, (producers.get(a) ?? 0) + 1);
      for (const a of profile.consumes) consumers.set(a, (consumers.get(a) ?? 0) + 1);

      for (const h of hooks) {
        expect(SYNERGY_ATTR_IDS).toContain(h.attr);
        expect(h.summary(1).length).toBeGreaterThan(5);
        expect(h.summary(5).length).toBeGreaterThan(5);
      }
    }

    // Every single one of the 15 Synergy nodes has at least 2 producers and 2 consumers
    for (const id of SYNERGY_ATTR_IDS) {
      expect({ attr: id, producers: producers.get(id) }).toEqual(
        expect.objectContaining({ producers: expect.any(Number) })
      );
      expect(producers.get(id)!).toBeGreaterThanOrEqual(2);
      expect(consumers.get(id)!).toBeGreaterThanOrEqual(2);
    }

    // Belt synergy overlap detects shared nodes between paired weapons
    const overlap = beltSynergyOverlap('blast-powder', ['flint-spark']);
    expect(overlap).toEqual(expect.arrayContaining(['destruction', 'burn']));
  });

  it('evaluates base-damage & modifier Synergy hooks accurately and scales them with weapon level', () => {
    const syn = {
      ...createInitialSynergyCounters(15),
      destruction: 10,
      burn: 8,
      streaks: 6,
      coins: 20,
      field_size: 4,
    };
    const bpLv1 = evaluateWeaponSynergyDamage('blast-powder', 1, syn);
    const bpLv5 = evaluateWeaponSynergyDamage('blast-powder', 5, syn);
    expect(bpLv1.total).toBeGreaterThan(0);
    expect(bpLv5.total).toBeGreaterThan(bpLv1.total);

    const fsLv1 = evaluateWeaponSynergyDamage('flint-spark', 1, syn);
    expect(fsLv1.total).toBeGreaterThan(0);

    // Check at least one weapon grants standing modPerStep modifiers when its Synergy counter rises
    const modWeapons = ALL_ARMORY_WEAPON_IDS.filter(id =>
      getWeaponSynergyHooks(id).some(h => h.modPerStep !== undefined)
    );
    expect(modWeapons.length).toBeGreaterThan(0);
    const sampleModId = modWeapons[0];
    const modSyn = Object.fromEntries(SYNERGY_ATTR_IDS.map(a => [a, 12])) as unknown as ReturnType<typeof createInitialSynergyCounters>;
    const modsOut = evaluateWeaponSynergyModifiers(sampleModId, 3, modSyn, { hearts: 3, maxHearts: 5, timeLeft: 60, liveLinks: 4 });
    expect(Object.keys(modsOut).length).toBeGreaterThan(0);
  });

  it('tracks live Synergy counters in combat and feeds Synergy hook damage (including Understudy left-copy) into Set math', () => {
    // Field Stone starts on a 12-card level with +2 cards (14 total) -> field_size === 2
    let s = startFight({
      save: {
        selectedFighter: 'Pelican',
        armory: ['blast-powder', 'understudy', 'field-stone'],
        charms: ['blast-powder', 'understudy', 'field-stone'],
      },
      level: testLevel({ foes: [{ name: 'Synergy Dummy', hp: 2000 }], rules: { boardSize: 12, timer: 120 } }),
      features: ['hearts', 'gear', 'coins', 'hints', 'graces', 'rainbow', 'purity'],
    });
    expect(s.board.length).toBe(14);
    expect(s.synergy.field_size).toBe(2);

    // Raise destruction to 10 -> both Blast Powder AND Understudy (copying Blast Powder) evaluate Blast Powder's destruction hook!
    s = { ...s, synergy: { ...s.synergy, destruction: 10 } };
    const singleBp = evaluateWeaponSynergyDamage('blast-powder', 1, s.synergy).total;
    expect(singleBp).toBeGreaterThan(0);

    const set = findSet(s)!;
    const hpBefore = s.foeHp;
    const after = runReducer(s, { type: 'MATCH', cards: set, rewards: set.map(baseCardReward) });
    const entry = after.log[after.log.length - 1];
    // Both Blast Powder and Understudy contributed Synergy damage to the Set!
    expect(entry.set?.synergyBonus).toBeGreaterThanOrEqual(singleBp * 2);
    expect(hpBefore - after.foeHp).toBeGreaterThanOrEqual(Math.round(6 + singleBp * 2));
    // Clean Set incremented streaks counter
    expect(after.synergy.streaks).toBeGreaterThanOrEqual(1);
  });
});

describe('Holographic Cards (+4 Base & +0.20× Additive Multiplier)', () => {
  it('adds +4 base and +0.20× additive multiplier per Holo card in a Set (1=×1.2, 2=×1.4, 3=×1.6) and fires holoMatched', () => {
    expect(BASE_RULES.holoCardBonus).toBe(4);
    expect(BASE_RULES.holoCardMult).toBe(0.2);
    expect(BASE_RULES.holoCardChance).toBe(0.04);

    const runWithHolos = (holoCount: 0 | 1 | 2 | 3) => {
      let s = startFight({
        save: { selectedFighter: 'Pelican', armory: [], charms: [] },
        level: testLevel({ foes: [{ name: 'Holo Dummy', hp: 1000 }], rules: { boardSize: 12 } }),
        features: ['hearts', 'gear', 'rainbow'],
      });
      const cards: [Card, Card, Card] = [
        mkCard('h0', 'oval', 'red', 1, { holo: holoCount >= 1 }),
        mkCard('h1', 'oval', 'red', 2, { holo: holoCount >= 2 }),
        mkCard('h2', 'oval', 'red', 3, { holo: holoCount >= 3 }),
      ];
      const board = [...s.board];
      board[0] = cards[0];
      board[1] = cards[1];
      board[2] = cards[2];
      s = { ...s, board };
      const hpBefore = s.foeHp;
      const after = runReducer(s, { type: 'MATCH', cards, rewards: cards.map(baseCardReward) });
      return { after, dmg: hpBefore - after.foeHp };
    };

    // 0 Holo: 6 × 1.0 = 6
    expect(runWithHolos(0).dmg).toBe(6);
    // 1 Holo: (6 + 4) × 1.2 = 12
    const r1 = runWithHolos(1);
    expect(r1.dmg).toBe(12);
    expect(r1.after.fightMetrics.holoCards).toBe(1);
    expect(r1.after.synergy.holo).toBeGreaterThanOrEqual(1);
    // 2 Holo: (6 + 8) × 1.4 = 19.6 → 20
    expect(runWithHolos(2).dmg).toBe(Math.round(14 * 1.4));
    // 3 Holo: (6 + 12) × 1.6 = 28.8 → 29
    expect(runWithHolos(3).dmg).toBe(Math.round(18 * 1.6));

    // holoMatched trigger & convert: 'holo' effect work in rules engine
    let sTrig = withWeapons(
      startFight({ save: { selectedFighter: 'Pelican' }, features: ['hearts', 'gear'] }),
      relic([
        { trigger: { on: 'holoMatched' }, effects: [{ do: 'damage', amount: 9 }] },
        { trigger: { on: 'mistake' }, effects: [{ do: 'convert', to: 'holo', count: 1 }] },
      ])
    );
    const cards: [Card, Card, Card] = [
      mkCard('ht0', 'oval', 'red', 1, { holo: true }),
      mkCard('ht1', 'oval', 'red', 2),
      mkCard('ht2', 'oval', 'red', 3),
    ];
    sTrig = { ...sTrig, board: [cards[0], cards[1], cards[2], ...sTrig.board.slice(3)] };
    const hpBefore = sTrig.foeHp;
    sTrig = runReducer(sTrig, { type: 'MATCH', cards, rewards: cards.map(baseCardReward) });
    // (6 + 4) × 1.2 = 12 Set hit + synchronous holoMatched rule (9 × 1.2 = 10.8 -> 11) = 23
    expect(hpBefore - sTrig.foeHp).toBe(12 + Math.round(9 * 1.2));

    // Mistake converts 1 board card into Holo
    const beforeHolos = sTrig.board.filter(c => c.holo).length;
    const wrong = sTrig.board.slice(0, 3);
    sTrig = runReducer(sTrig, { type: 'INVALID', cards: wrong });
    expect(sTrig.board.filter(c => c.holo).length).toBeGreaterThan(beforeHolos);
  });
});

describe('Elevated Base Damage, Compressed Multipliers & Zero Power Scaling', () => {
  it('enforces elevated base constants and compressed multipliers across Rules, Surge, Parry, Tricks & Passives', () => {
    // Elevated Base Damage
    expect(BASE_RULES.cardBasePoints).toBe(2);
    expect(BASE_RULES.powerCardBonus).toBe(5);
    expect(COLLATERAL_DAMAGE).toEqual({ explosion: 2, laser: 4, ricochet: 2, connected: 2 });

    // Compressed Multipliers
    expect(BASE_RULES.maxNextSetMultiplier).toBe(2.5);
    expect(SURGE_RULES.multiplier).toBe(1.8);
    expect(SURGE_RULES.flatBonus).toBe(12);
    expect(PARRY_RULES.anyParryMult).toBe(1.15);
    expect(PARRY_RULES.counterParryMult).toBe(1.25);
    expect(PARRY_RULES.perfectParryMult).toBe(1.35);
    expect(PARRY_RULES.staggerDamageMult).toBe(1.35);
    expect(PARRY_RULES.anyParryFlat).toBe(5);
    expect(PARRY_RULES.counterParryFlat).toBe(10);
    expect(PARRY_RULES.perfectParryFlat).toBe(16);
    expect(PARRY_RULES.staggerFlatBonus).toBe(8);
    expect(TRICK_RULES.curseMultiplier).toBe(1.35);
    expect(TRICK_RULES.offRopeMultiplier).toBe(0.7);
    expect(TRICK_RULES.rustCoins).toBe(8);
    expect(PASSIVE_TUNING.hot_streak['hotStreak.multiplier']).toBe(1.35);
    expect(PASSIVE_TUNING.hot_streak['hotStreak.damage']).toBe(10);

    // Live Shading Surge verification: (6 base + 12 Surge flat) × 1.8 = 32.4 → 32
    let surged = startFight({
      save: { selectedFighter: 'Pelican', armory: [], charms: [] },
      level: testLevel({ foes: [{ name: 'Surge Dummy', hp: 500 }], rules: { shadingSurge: true, timer: 300, boardSize: 15 } }),
      features: ['hearts'],
    });
    surged = tick(surged, SURGE_RULES.calmMs);
    expect(surged.surge?.active).toBe(true);
    const hpBefore = surged.foeHp;
    surged = playSet(surged);
    expect(hpBefore - surged.foeHp).toBe(Math.round((6 + SURGE_RULES.flatBonus) * SURGE_RULES.multiplier));
  });

  it('completely removes global Power scaling & legacy evolutionPairs files from runtime state and repository', () => {
    expect(fs.existsSync(path.join(REPO_ROOT, 'src/adventure/data/weaponPower.ts'))).toBe(false);
    expect(fs.existsSync(path.join(REPO_ROOT, 'src/adventure/data/evolutionPairs.ts'))).toBe(false);

    const run = playSet(startFight({ save: { selectedFighter: 'Pelican' } }));
    expect('power' in (run as unknown as Record<string, unknown>)).toBe(false);
    const setEntry = run.log.find(e => e.kind === 'set')!;
    expect(setEntry.set).toBeDefined();
    expect('powerMultiplier' in (setEntry.set as unknown as Record<string, unknown>)).toBe(false);
  });
});
