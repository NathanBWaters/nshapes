/**
 * Starfall Summit — Headless Monte Carlo Balance, Dead-Item & Economy Suite.
 *
 * Verifies:
 *  - Zero dead/XP-only weapons leak into `SPIRE_WEAPON_POOL` (static + runtime firing check)
 *  - Shop arbitrage impossibility (`sellValue < buyPrice` across all weapons/levels/sales)
 *  - Ascension description text matches numeric multipliers (`ascensions.ts`)
 *  - Act 1 → Act 2 → Act 3 curve & per-fighter equity across all 6 fighters
 *  - Real Ascension ladder scaling (`A0 / A8 / A15 / A20`) + Endless Act 4 entry & scaling
 */
import { BOTS, simulateRun } from '@/adventure/engine/bot';
import { FIGHTERS } from '@/adventure/data/fighters';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { MAX_WEAPON_LEVEL } from '@/adventure/data/weaponStats';
import { PARTNER_WEAPONS } from '@/adventure/balance/targets';
import { ASCENSION_DESCRIPTIONS, ascensionModifiers, MAX_ASCENSION } from '@/spire/data/ascensions';
import { generateSpireEncounter, SPIRE_WEAPON_POOL } from '@/spire/data/encounters';
import { SPIRE_FIGHT_FEATURES, spireEncounterToLevel, spireRunOverrides, spireRunToVirtualSave } from '@/spire/engine/bridge';
import {
  createSpireRun,
  SPIRE_EXCLUDED_WEAPONS,
  spireWeaponSellValue,
  standaloneWeaponShopPrice,
} from '@/spire/engine/runState';
import { simulateSpireClimb } from '@/spire/engine/bot';
import { createRng } from '@/adventure/engine/rng';

const REPORT = !!process.env.SPIRE_BALANCE_REPORT;
const RUNS = REPORT ? 36 : 18;

describe('Starfall Summit — invariants, economy & dead-item gates', () => {
  it('excludes XP-only weapons and ensures every Summit-eligible weapon impacts Act 1 combat', () => {
    const eligible = SPIRE_WEAPON_POOL.filter(id => !SPIRE_EXCLUDED_WEAPONS.has(id));
    expect(SPIRE_EXCLUDED_WEAPONS.has('scholars-tome')).toBe(true);
    expect(SPIRE_EXCLUDED_WEAPONS.has('wisdom-chain')).toBe(true);

    // Static check: no Spire-eligible weapon relies solely on excluded features (`xp` / `shop`)
    for (const id of eligible) {
      const w = getArmoryWeapon(id)!;
      expect(w).toBeDefined();
      const onlyXp =
        w.specialEffect === 'xpGain' &&
        !((w as { rules?: unknown[] }).rules?.length) &&
        !((w as { modifiers?: Record<string, unknown> }).modifiers && Object.keys((w as { modifiers?: Record<string, unknown> }).modifiers!).length);
      expect({ id, onlyXp }).toEqual({ id, onlyXp: false });
    }

    // Fast runtime check: every non-partner eligible weapon changes damage, log events, or rule firings in Spire combat
    const baseRun = createSpireRun('Orange Tabby', 0, 777);
    const enc = generateSpireEncounter({ act: 1, row: 2, kind: 'skirmish', ascension: 0, rng: createRng(777), id: 'probe' });
    const dummyEnc = { ...enc, foes: [{ ...enc.foes[0], hp: 10000, parry: null }] };
    const bareRun = { ...baseRun, weapons: [] as string[], weaponLevels: {} as Record<string, number> };
    const level = spireEncounterToLevel(bareRun, dummyEnc);
    const bareStates = [0, 1, 2].map(i =>
      simulateRun(level, spireRunToVirtualSave(bareRun), BOTS.average, 2000 + i * 7919, undefined, {
        skipPicks: true,
        features: new Set(SPIRE_FIGHT_FEATURES),
        overrides: spireRunOverrides(bareRun),
        trackRuleFirings: true,
      }).state
    );

    const dead: string[] = [];
    for (const id of eligible) {
      if (PARTNER_WEAPONS.includes(id)) continue;
      const testRun = { ...bareRun, weapons: [id], weaponLevels: { [id]: 3 } };
      let changed = false;
      for (let i = 0; i < 3; i++) {
        const st = simulateRun(level, spireRunToVirtualSave(testRun), BOTS.average, 2000 + i * 7919, undefined, {
          skipPicks: true,
          features: new Set(SPIRE_FIGHT_FEATURES),
          overrides: spireRunOverrides(testRun),
          trackRuleFirings: true,
        }).state;
        const firings = Object.values(st.ruleFirings ?? {}).reduce((a, b) => a + b, 0);
        if (
          st.totalDamage !== bareStates[i].totalDamage ||
          st.log.length !== bareStates[i].log.length ||
          st.board.length !== bareStates[i].board.length ||
          st.hearts !== bareStates[i].hearts ||
          st.coins !== bareStates[i].coins ||
          firings > 0
        ) {
          changed = true;
          break;
        }
      }
      if (!changed) dead.push(id);
    }
    expect(dead).toEqual([]);
  }, 60_000);

  it('prevents infinite-gold shop arbitrage across every weapon, level, and sale discount', () => {
    for (const id of SPIRE_WEAPON_POOL) {
      for (let lv = 1; lv <= MAX_WEAPON_LEVEL; lv++) {
        const sell = spireWeaponSellValue(id, lv);
        const buyRegular = standaloneWeaponShopPrice(id, lv, 1, false);
        const buySale = standaloneWeaponShopPrice(id, lv, 1, true);
        expect(sell).toBeLessThan(buyRegular);
        expect(sell).toBeLessThan(buySale);
      }
    }
  });

  it('keeps Ascension description copy synchronized with numeric multipliers', () => {
    expect(ASCENSION_DESCRIPTIONS).toHaveLength(MAX_ASCENSION + 1);
    const checkPct = (asc: number, field: 'foeHpScale' | 'bossHpScale' | 'shopPriceScale') => {
      const prev = ascensionModifiers(asc - 1)[field];
      const cur = ascensionModifiers(asc)[field];
      const pct = Math.round((cur / prev - 1) * 100);
      expect(ASCENSION_DESCRIPTIONS[asc]).toContain(`${pct}%`);
    };
    checkPct(2, 'foeHpScale');
    checkPct(6, 'shopPriceScale');
    checkPct(7, 'bossHpScale');
    checkPct(8, 'foeHpScale');
    checkPct(11, 'foeHpScale');
    checkPct(13, 'bossHpScale');
    checkPct(14, 'shopPriceScale');
    checkPct(16, 'foeHpScale');
    checkPct(18, 'bossHpScale');
    checkPct(20, 'bossHpScale');
  });
});

describe('Starfall Summit — full climb balance', () => {
  let a0ExpWinRate = 0;

  it('Ascension 0 has a balanced Act 1 → Act 2 → Act 3 curve, economy spend, and fighter equity', () => {
    const fighters = FIGHTERS.map(f => f.name);
    let avgA1 = 0, avgA2 = 0, avgA3 = 0;
    let expA1 = 0, expA2 = 0, expA3 = 0;
    const byFighter: Record<string, { n: number; avgWin: number; expWin: number; avgFloors: number; expFloors: number }> = {};

    let totalBuildDmg = 0;
    let totalSetDmg = 0;
    let totalPowerDmg = 0;
    let totalAllDmg = 0;
    let sumWeapons = 0;
    let sumAvgLv = 0;
    let sumSkills = 0;
    let sumArcana = 0;
    let sumEvos = 0;
    let sumSetsPerFight = 0;
    let totalSpent = 0;
    let totalAvailable = 0;
    let fightsCount = 0;

    for (let i = 0; i < RUNS; i++) {
      const fighter = fighters[i % fighters.length];
      const seed = 5000 + i * 7919;
      const avg = simulateSpireClimb({ fighter, ascension: 0, seed, bot: BOTS.average });
      if (avg.wonAct1) avgA1 += 1;
      if (avg.wonAct2) avgA2 += 1;
      if (avg.wonAct3) avgA3 += 1;

      const exp = simulateSpireClimb({ fighter, ascension: 0, seed, bot: BOTS.expert });
      if (exp.wonAct1) expA1 += 1;
      if (exp.wonAct2) expA2 += 1;
      if (exp.wonAct3) expA3 += 1;

      for (const s of Object.values(avg.run.stats.sourceDamage ?? {})) {
        totalAllDmg += s.damage;
        if (s.kind === 'set') totalSetDmg += s.damage;
        else if (s.kind === 'power') totalPowerDmg += s.damage;
        else totalBuildDmg += s.damage;
      }
      const lvs = Object.values(avg.run.weaponLevels);
      sumWeapons += avg.run.weapons.length;
      sumAvgLv += lvs.length > 0 ? lvs.reduce((a, b) => a + b, 0) / lvs.length : 1;
      sumSkills += avg.run.skillNodes.length;
      sumArcana += avg.run.arcana.length;
      sumEvos += avg.run.stats.evolutionsForged;
      const fights = Math.max(1, avg.run.stats.floorLedger?.length ?? 0);
      sumSetsPerFight += avg.run.stats.totalSets / fights;
      totalSpent += avg.run.stats.coinsSpent;
      totalAvailable += avg.run.stats.coinsSpent + avg.run.coins;
      fightsCount += 1;

      const row = (byFighter[fighter] ??= { n: 0, avgWin: 0, expWin: 0, avgFloors: 0, expFloors: 0 });
      row.n += 1;
      if (avg.wonAct3) row.avgWin += 1;
      if (exp.wonAct3) row.expWin += 1;
      row.avgFloors += avg.finalFloor;
      row.expFloors += exp.finalFloor;
    }

    const r = (n: number) => n / RUNS;
    a0ExpWinRate = r(expA3);
    const buildShare = totalAllDmg > 0 ? totalBuildDmg / totalAllDmg : 0;
    const powerShare = totalAllDmg > 0 ? totalPowerDmg / totalAllDmg : 0;
    const setShare = totalAllDmg > 0 ? totalSetDmg / totalAllDmg : 0;
    const spendRatio = totalAvailable > 0 ? totalSpent / totalAvailable : 0;

    if (REPORT) {
      const fighterLines = Object.entries(byFighter)
        .map(
          ([f, v]) =>
            `    ${f.padEnd(16)} avgWin=${Math.round((v.avgWin / v.n) * 100)}% | expWin=${Math.round((v.expWin / v.n) * 100)}% | avgFloors=${(v.avgFloors / v.n).toFixed(1)} | expFloors=${(v.expFloors / v.n).toFixed(1)}`
        )
        .join('\n');
      console.log(
        `SPIRE A0 (${RUNS} runs across all 6 fighters):\n` +
          `  Average: Act1=${Math.round(r(avgA1) * 100)}% | Act2=${Math.round(r(avgA2) * 100)}% | Victory=${Math.round(r(avgA3) * 100)}%\n` +
          `  Expert : Act1=${Math.round(r(expA1) * 100)}% | Act2=${Math.round(r(expA2) * 100)}% | Victory=${Math.round(r(expA3) * 100)}%\n` +
          `  Damage Share: Build/Items=${Math.round(buildShare * 100)}% | Bare Sets=${Math.round(setShare * 100)}% | Power=${Math.round(powerShare * 100)}%\n` +
          `  Economy Spend Ratio: ${Math.round(spendRatio * 100)}% | Avg Build: ${(sumWeapons / fightsCount).toFixed(1)} weapons (avg Lv ${(sumAvgLv / fightsCount).toFixed(2)}), ${(sumSkills / fightsCount).toFixed(1)} skills, ${(sumArcana / fightsCount).toFixed(1)} arcana, ${(sumEvos / fightsCount).toFixed(1)} evos/run, ${(sumSetsPerFight / fightsCount).toFixed(1)} sets/fight\n` +
          `  Per fighter:\n${fighterLines}`
      );
    }

    // Pure item-driven Spire: generic global Power must be 0%, and real build items/synergies carry the vast majority of damage!
    expect(powerShare).toBe(0);
    expect(buildShare).toBeGreaterThanOrEqual(0.65);
    expect(spendRatio).toBeGreaterThanOrEqual(0.6);

    // Act 1 should feel welcoming & fun
    expect(r(avgA1)).toBeGreaterThanOrEqual(0.55);
    expect(r(expA1)).toBeGreaterThanOrEqual(0.75);
    // Average players can beat A0 with a solid run, neither bricked nor free
    expect(r(avgA3)).toBeGreaterThanOrEqual(0.25);
    expect(r(avgA3)).toBeLessThanOrEqual(0.85);
    // Skilled play pays off strongly
    expect(r(expA3)).toBeGreaterThanOrEqual(0.55);
    expect(r(expA3)).toBeLessThanOrEqual(0.98);
    expect(r(expA3)).toBeGreaterThanOrEqual(r(avgA3));

    // Per-fighter equity across all 6 fighters
    const avgFloorMeans = Object.values(byFighter).map(v => v.avgFloors / v.n);
    const expFloorMeans = Object.values(byFighter).map(v => v.expFloors / v.n);
    expect(Math.min(...expFloorMeans)).toBeGreaterThanOrEqual(12);
    expect(Math.max(...avgFloorMeans) - Math.min(...avgFloorMeans)).toBeLessThanOrEqual(7);
    if (REPORT) {
      const expWinRates = Object.values(byFighter).map(v => v.expWin / v.n);
      expect(Math.min(...expWinRates)).toBeGreaterThanOrEqual(0.4);
      expect(Math.max(...expWinRates) - Math.min(...expWinRates)).toBeLessThanOrEqual(0.45);
    }
  }, 180_000);

  it('Ascension ladder (A0 → A8 → A15 → A20) and Endless Act 4 scale meaningfully', () => {
    const sample = REPORT ? 12 : 6;
    const runTier = (asc: number, bot: typeof BOTS.average) => {
      let wins = 0;
      let floors = 0;
      for (let i = 0; i < sample; i++) {
        const fighter = FIGHTERS[i % FIGHTERS.length].name;
        const seed = 9100 + i * 3571;
        const res = simulateSpireClimb({ fighter, ascension: asc, seed, bot });
        if (res.wonAct3) wins += 1;
        floors += res.finalFloor;
      }
      return { winRate: wins / sample, avgFloors: floors / sample, wins };
    };

    const a0Avg = runTier(0, BOTS.average);
    const a8Avg = runTier(8, BOTS.average);
    const a0Exp = runTier(0, BOTS.expert);
    const a8Exp = runTier(8, BOTS.expert);
    const a15Exp = runTier(15, BOTS.expert);

    let endlessA4Wins = 0;
    let endlessMaxFloor = 0;
    for (let i = 0; i < sample; i++) {
      const fighter = FIGHTERS[i % FIGHTERS.length].name;
      const seed = 9100 + i * 3571;
      const re = simulateSpireClimb({ fighter, ascension: 0, seed, bot: BOTS.expert, playEndless: true, maxAct: 4 });
      if (re.wonAct4) endlessA4Wins += 1;
      endlessMaxFloor = Math.max(endlessMaxFloor, re.finalFloor);
    }

    if (REPORT) {
      const a5Exp = runTier(5, BOTS.expert);
      const a10Exp = runTier(10, BOTS.expert);
      const a20Exp = runTier(20, BOTS.expert);
      console.log(
        `SPIRE LADDER (${sample} runs/tier):\n` +
          `  Avg: A0=${Math.round(a0Avg.winRate * 100)}% | A8=${Math.round(a8Avg.winRate * 100)}%\n` +
          `  Exp: A0=${Math.round(a0Exp.winRate * 100)}% | A5=${Math.round(a5Exp.winRate * 100)}% | A8=${Math.round(a8Exp.winRate * 100)}% | A10=${Math.round(a10Exp.winRate * 100)}% | A15=${Math.round(a15Exp.winRate * 100)}% (fl ${a15Exp.avgFloors.toFixed(1)}) | A20=${Math.round(a20Exp.winRate * 100)}% (fl ${a20Exp.avgFloors.toFixed(1)})\n` +
          `  Endless A4 Exp: ${Math.round((endlessA4Wins / sample) * 100)}% (maxFloor=${endlessMaxFloor})`
      );
      // A20 should be brutal yet beatable for an expert
      expect(a20Exp.winRate).toBeGreaterThanOrEqual(0.08);
      expect(a20Exp.winRate).toBeLessThanOrEqual(0.65);
    }

    expect(a8Avg.wins).toBeLessThanOrEqual(a0Avg.wins);
    expect(a8Avg.wins).toBeLessThan(sample);
    expect(a15Exp.wins).toBeLessThanOrEqual(a8Exp.wins);
    expect(a8Exp.wins).toBeLessThanOrEqual(a0Exp.wins);
    expect(a15Exp.avgFloors).toBeGreaterThanOrEqual(10);
    // Endless Act 4 is actually entered (> floor 21) and never easier than Act 3
    expect(endlessMaxFloor).toBeGreaterThan(21);
    expect(endlessA4Wins / sample).toBeLessThanOrEqual(Math.max(a0Exp.winRate, a0ExpWinRate) + 0.05);
  }, 240_000);
});
