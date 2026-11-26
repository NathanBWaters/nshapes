/**
 * Canonical Weapon Catalog, Entropy PRNG, Whole-Stat Determinism, Role Sharpening,
 * Arcana Kiss-Curse, and Growth Watch Integrity Tests
 * ([TP-10], [GP-19], [GP-11], [GP-15], [GP-09]).
 */
import { FREE_PLAY_ONLY_DEFINITIONS, LEGACY_WEAPON_RARITY, SHARED_WEAPONS, WEAPONS } from '@/utils/gameDefinitions';
import { ADVENTURE_WEAPONS } from '@/adventure/data/adventureWeapons';
import {
  ALL_ARMORY_WEAPON_IDS,
  FREE_PLAY_ONLY_WEAPONS,
  armoryBaseWeapon,
  getArmoryWeapon,
  weaponRuleSource,
} from '@/adventure/data/armory';
import {
  WEAPON_CADENCE,
  WEAPON_CATALOG,
  WEAPON_CATALOG_LIST,
  bracketParam,
  exportWeaponParameterTable,
  getWeaponCatalogEntry,
} from '@/adventure/data/weapons/catalog';
import { WHOLE_STATS, formatStat, weaponStatDefs, weaponStatLines, weaponValues } from '@/adventure/data/weaponStats';
import { WEAPON_GROWTH } from '@/adventure/data/weaponGrowth';
import { hasWeaponGuide } from '@/adventure/data/weaponGuide';
import { hasWeaponRole } from '@/adventure/data/weaponRoles';
import { hasWeaponVoice } from '@/audio/voices';
import { BALANCE_TARGETS } from '@/adventure/balance/targets';
import { ARCANA, arcanaRules, combineArcana, type ExtendedArcanaRules } from '@/adventure/data/arcana';
import { resolveWholeStats, startingLoadout } from '@/adventure/loadout';
import {
  ENTROPY_JITTER_FRACTION,
  createProcAccumulator,
  getEntropyCharge,
  rollEntropyBatch,
  rollEntropyProc,
} from '@/adventure/engine/entropy';
import { createMaxedSave } from '@/adventure/progress';
import { testLevel } from './testUtils/adventureFight';

const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

describe('[TP-10] Canonical 64-Weapon Parameter Registry & zero shadowing', () => {
  it('has zero duplicate IDs across SHARED_WEAPONS, FREE_PLAY_ONLY_DEFINITIONS, and ADVENTURE_WEAPONS', () => {
    const sharedIds = SHARED_WEAPONS.map(w => w.id);
    const freePlayOnlyIds = FREE_PLAY_ONLY_DEFINITIONS.map(w => w.id);
    const advIds = ADVENTURE_WEAPONS.map(w => w.id);

    expect(new Set(sharedIds).size).toBe(sharedIds.length);
    expect(new Set(freePlayOnlyIds).size).toBe(freePlayOnlyIds.length);
    expect(new Set(advIds).size).toBe(advIds.length);

    const all = [...sharedIds, ...freePlayOnlyIds, ...advIds];
    expect(new Set(all).size).toBe(all.length);

    // revenge-linker lives exclusively in ADVENTURE_WEAPONS (no duplicate shadowing in WEAPONS)
    expect(WEAPONS.some(w => w.id === 'revenge-linker')).toBe(false);
    expect(ADVENTURE_WEAPONS.some(w => w.id === 'revenge-linker')).toBe(true);
    expect(LEGACY_WEAPON_RARITY['revenge-linker']).toBe('legendary');
    expect(FREE_PLAY_ONLY_WEAPONS).toContain('sympathetic-flames');
  });

  it('preserves all 64 Armory weapons in WEAPON_CATALOG with 100% Lv 1–5 equivalence', () => {
    expect(ALL_ARMORY_WEAPON_IDS).toHaveLength(64);
    expect(WEAPON_CATALOG_LIST).toHaveLength(64);
    expect(Object.keys(WEAPON_CATALOG)).toHaveLength(64);

    for (const id of ALL_ARMORY_WEAPON_IDS) {
      const entry = getWeaponCatalogEntry(id);
      expect(entry).toBeDefined();
      expect(hasWeaponGuide(id)).toBe(true);
      expect(hasWeaponRole(id)).toBe(true);
      expect(hasWeaponVoice(id)).toBe(true);

      const base = armoryBaseWeapon(id)!;
      expect(base).toBeDefined();
      for (const level of [1, 2, 3, 4, 5] as const) {
        const expected = weaponValues(base, { level, tuning: {} });
        expect(entry!.levels[level - 1]).toEqual(expected);
      }

      for (const spec of Object.values(entry!.stats)) {
        expect(spec.bracketLabel).toBe(bracketParam(spec.label));
        expect(spec.bracketLabel).toMatch(/^\[.+\]$/);
        expect(spec.levels).toHaveLength(5);
      }
    }
  });

  it('exports a non-empty flat parameter spreadsheet table with all 64 weapons represented', () => {
    const rows = exportWeaponParameterTable();
    expect(rows.length).toBeGreaterThanOrEqual(64);
    const coveredIds = new Set(rows.map(r => r.id));
    expect(coveredIds.size).toBe(64);
    for (const row of rows) {
      expect(row.bracketLabel).toMatch(/^\[.+\]$/);
      expect(Number.isFinite(row.lv1)).toBe(true);
      expect(Number.isFinite(row.lv5)).toBe(true);
    }
    expect(WEAPON_CADENCE.CLARITY_EVERY).toBe(5);
    expect(WEAPON_CADENCE.CLARITY_EVERY_HIGH).toBe(4);
    expect(WEAPON_CADENCE.ORACLE_WAIT_S).toBe(4);
  });
});

describe('[GP-19] Clean integer WHOLE_STATS & deterministic damped entropy PRNG', () => {
  it('resolves every WHOLE_STATS field as a clean integer across all 64 weapons × Lv 1–5 × T0–T4', () => {
    const wholeSet = new Set<string>(WHOLE_STATS);
    for (const id of ALL_ARMORY_WEAPON_IDS) {
      const base = armoryBaseWeapon(id)!;
      const defs = weaponStatDefs(base);
      const keys = Object.keys(defs);
      for (const level of [1, 2, 3, 4, 5] as const) {
        for (const tier of [0, 1, 2, 3, 4] as const) {
          const tuning = Object.fromEntries(keys.map(k => [k, tier]));
          const vals = weaponValues(base, { level, tuning });
          for (const [k, v] of Object.entries(vals)) {
            if (wholeSet.has(k) || defs[k]?.whole) {
              expect({ id, level, tier, k, v, isInt: Number.isInteger(v) }).toEqual({
                id,
                level,
                tier,
                k,
                v,
                isInt: true,
              });
            }
          }
          // Built weapon description and formatted stat tiles never display fractional ranges like "2-3"
          const built = getArmoryWeapon(id, { [id]: { level, tuning } })!;
          const lines = weaponStatLines(base, { level, tuning });
          for (const line of lines) {
            if (line.unit === 'count') {
              const formatted = formatStat(line.unit, line.value);
              expect(formatted).not.toMatch(/\d+-\d+/);
            }
          }
          expect(built.description).not.toMatch(/\b\d+-\d+\s+(extra\s+)?(cards?|hints?|graces?|hearts?|links?)\b/i);
        }
      }
    }
  });

  it('resolveWholeStats is 100% deterministic regardless of rand input', () => {
    const sample = { maxHealth: 4.6, hints: 2.2, maxHints: 3.8, graces: 1.5, extraCards: 2, startingLinks: 2 };
    const a = resolveWholeStats(sample, () => 0.0001);
    const b = resolveWholeStats(sample, () => 0.9999);
    expect(a).toEqual(b);
    expect(a).toEqual({ maxHealth: 5, hints: 2, maxHints: 4, graces: 2, extraCards: 2, startingLinks: 2 });
  });

  it('rollEntropyProc maintains unbiased expectation and enforces bounded dry streaks', () => {
    const rand = mulberry32(20261126);
    for (const pct of [18, 34, 55]) {
      let state = createProcAccumulator();
      let totalTriggers = 0;
      let streak = 0;
      let maxStreak = 0;
      const trials = 10000;

      for (let i = 0; i < trials; i++) {
        const res = rollEntropyProc(state, 'blast', pct, rand);
        state = res.nextState;
        expect(res.nextAccum).toBeGreaterThanOrEqual(0);
        expect(res.nextAccum).toBeLessThan(100);
        expect(res.chargeRatio).toBeCloseTo(getEntropyCharge(state, 'blast'), 6);
        if (res.triggered) {
          totalTriggers += res.triggers;
          streak = 0;
        } else {
          streak += 1;
          if (streak > maxStreak) maxStreak = streak;
        }
      }

      const observedRate = (totalTriggers / trials) * 100;
      expect(Math.abs(observedRate - pct)).toBeLessThan(1.0);
      // Hard mathematical dry-streak ceiling: ceil(100 / (pct * (1 - jitter))) - 1
      const maxAllowedDrySets = Math.ceil(100 / (pct * (1 - ENTROPY_JITTER_FRACTION))) - 1;
      expect(maxStreak).toBeLessThanOrEqual(maxAllowedDrySets);
    }
  });

  it('handles edge rates (<=0%, 100%, >100%) and batch rolling deterministically', () => {
    const start = createProcAccumulator();
    const zero = rollEntropyProc(start, 'blast', 0, () => 0.5);
    expect(zero.triggered).toBe(false);
    expect(zero.triggers).toBe(0);

    const neg = rollEntropyProc(start, 'blast', -10, () => 0.5);
    expect(neg.triggered).toBe(false);

    const guaranteed = rollEntropyProc(start, 'blast', 100, () => 0.5);
    expect(guaranteed.triggered).toBe(true);
    expect(guaranteed.triggers).toBe(1);

    const doubleGuaranteed = rollEntropyProc(start, 'blast', 200, () => 0.5);
    expect(doubleGuaranteed.triggers).toBe(2);

    const batchA = rollEntropyBatch(start, [['blast', 60], ['echo', 60]], mulberry32(42));
    const batchB = rollEntropyBatch(start, [['blast', 60], ['echo', 60]], mulberry32(42));
    expect(batchA).toEqual(batchB);
  });
});

describe('[GP-11] Role sharpening & utility purity', () => {
  const PURE_UTILITY_IDS = [
    'clarity-lens',
    'mending-charm',
    'life-vessel',
    'field-stone',
    'fortunes-favor',
    'scholars-tome',
    'crystal-orb',
    'oracle-eye',
    'second-chance',
    'fortune-token',
    'fortunes-blessing',
  ] as const;

  it('pure utility weapons carry zero direct hit/blast/laser/setDamage riders', () => {
    for (const id of PURE_UTILITY_IDS) {
      for (const level of [1, 5] as const) {
        const built = getArmoryWeapon(id, { [id]: { level, tuning: {} } })!;
        const source = weaponRuleSource(built);
        const rules = source.rules ?? [];
        const hasRawDamageRule = rules.some(ru =>
          ru.effects.some(e => e.do === 'damage' || e.do === 'explode' || e.do === 'laser')
        );
        const mods = source.modifiers ?? {};
        const hasRawDamageMod =
          (mods.setDamage ?? 0) > 0 ||
          (mods.conditionalDamage?.length ?? 0) > 0 ||
          (mods.hintHeldDamage ?? 0) > 0 ||
          (mods.hintedSetDamage ?? 0) > 0;
        expect({ id, level, hasRawDamageRule, hasRawDamageMod }).toEqual({
          id,
          level,
          hasRawDamageRule: false,
          hasRawDamageMod: false,
        });
      }
    }
  });

  it('updates BALANCE_TARGETS utility floors and synergy floors per [GP-11] & [GP-12]', () => {
    expect(BALANCE_TARGETS.soloLate.board[0]).toBe(0.95);
    expect(BALANCE_TARGETS.soloLate.survival[0]).toBe(0.95);
    expect(BALANCE_TARGETS.soloLate.insight[0]).toBe(0.95);
    expect(BALANCE_TARGETS.soloLate.tempo[0]).toBe(0.95);
    expect(BALANCE_TARGETS.inBuild[0]).toBe(1.08);
    expect(BALANCE_TARGETS.recipeRuleLift[0]).toBe(1.2);
  });
});

describe('[GP-15] Arcana Kiss-Curse structural tradeoffs', () => {
  it('removes all flat damageScale padding and generic foeHpScale curses from all 8 Arcana', () => {
    expect(ARCANA).toHaveLength(8);
    for (const a of ARCANA) {
      const rules = a.rules as ExtendedArcanaRules;
      expect(rules.damageScale).toBeUndefined();
      expect(rules.foeHpScale).toBeUndefined();
    }
  });

  it('combines all new structural flags cleanly through combineArcana', () => {
    const combined = combineArcana([
      arcanaRules('glass_prism'),
      arcanaRules('overkill_harvest'),
      arcanaRules('scholars_gambit'),
      arcanaRules('catalyst_resonance'),
      arcanaRules('tempo_surge'),
    ]);
    expect(combined.noHeal).toBe(true);
    expect(combined.powerCardBonusOverride).toBe(4);
    expect(combined.zeroBaseSetCoins).toBe(true);
    expect(combined.overkillCarryPct).toBe(0.5);
    expect(combined.charmSlotDelta).toBe(-1);
    expect(combined.levelUpPowerBonus).toBe(0.3);
    expect(combined.nonEvolvedDamageScale).toBe(0.75);
    expect(combined.setComboBonus).toBe(1);
  });

  it("enforces Scholar's Gambit charmSlotDelta (-1) in startingLoadout", () => {
    const level = testLevel({ foes: [{ name: 'Dummy', hp: 100 }] });
    const charms = ['blast-powder', 'flint-spark', 'echo-stone', 'war-drum'];
    const baseSave = {
      ...createMaxedSave(),
      upgrades: { charm_belt: 1 }, // 4 base slots
      armory: charms,
      charms,
      equippedArcana: [] as ('scholars_gambit')[],
      unlockedArcana: ['scholars_gambit'] as ('scholars_gambit')[],
    };
    const withoutGambit = startingLoadout(level, { ...baseSave, equippedArcana: [] });
    const withGambit = startingLoadout(level, { ...baseSave, equippedArcana: ['scholars_gambit'] });

    expect(withoutGambit.charmSlots).toBe(4);
    expect(withoutGambit.weapons).toHaveLength(4);
    expect(withGambit.charmSlots).toBe(3);
    expect(withGambit.weapons).toHaveLength(3);
  });
});

describe('[GP-09] Obscure weapon growth micro-watches eliminated', () => {
  it('uses zero corners, oneTwoThree, sameColorAgain, or allRed watches in WEAPON_GROWTH', () => {
    const forbiddenTests = new Set(['corners', 'oneTwoThree', 'sameColorAgain']);
    for (const [weaponId, defs] of Object.entries(WEAPON_GROWTH)) {
      for (const def of defs) {
        const testName = def.watch.on === 'set' ? def.watch.test : undefined;
        expect({ weaponId, testName, forbidden: testName ? forbiddenTests.has(testName) : false }).toEqual({
          weaponId,
          testName,
          forbidden: false,
        });
        expect(def.watch.on === 'mistake' && def.watch.allRed === true).toBe(false);
      }
    }
  });
});
