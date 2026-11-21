/**
 * Adventure 3-star balance — headless bots play every level through the real
 * reducer across all three star tiers (`★1+` Clear, `★★+` Knockout, `★★★` Mastery)
 * plus a World 1 Pro (`BOTS.expert`) `★★★` floor (docs/balance-philosophy.md):
 *
 *   BARE      no stars spent, no Workshop, random charms, never chases a recipe
 *   INVESTED  every star on offer spent with a plan, Workshop maxed (once unlocked),
 *             charms tuned, a solid recipe + damage build
 *   PRO       BOTS.expert with the invested build (verifies World 1 ★★★ is a fun
 *             mini-challenge, never a last-move RNG sweat)
 *
 * Targets by world (engine/botBuilds.ts WIN_TARGETS & STAR_TARGETS):
 *
 *   world            1     2     3     4     5
 *   bare ★1+      >=88% >=55% >=20%  >=3%    0%
 *   bare ★★+       75%   30%   10%    0%    0%
 *   invested ★★+   98%   90%   80%   70%   50%
 *   invested ★★★   72%   58%   48%   38%   28%
 *
 * Set ADVENTURE_BALANCE_REPORT=1 to print the full 3-star funnel table.
 */
import { LEVELS, MAIN_LEVELS, getLevel } from '@/adventure/data/levels';
import { createMaxedSave } from '@/adventure/progress';
import { BOTS, simulateRun, starDistribution } from '@/adventure/engine/bot';
import {
  barePlan,
  campaignSave,
  investedPlan,
  PUZZLE_CHARMS,
  starTargets,
  winTargets,
  worldOf,
  WIN_TARGETS,
  STAR_TARGETS,
  type BuildPlan,
} from '@/adventure/engine/botBuilds';
import { validateCampaignHpCurve } from '@/adventure/balance/tuner';
import { MECHANICS } from '@/adventure/data/mechanics';
import type { AdventureSave, LevelDef } from '@/adventure/types';

// 60 seeded runs per player: one run is ±1.7%, the sample is ±6%.
const RUNS = 60;

/** How far one level may sit from its target; world means must sit closer (WORLD_TOLERANCE). */
const LEVEL_TOLERANCE = 0.2;
const WORLD_TOLERANCE = 0.1;

const withPuzzle = (level: LevelDef, plan: BuildPlan): BuildPlan => ({ ...plan, keepCharms: !!PUZZLE_CHARMS[level.id] });

const progressedSave = (): AdventureSave => {
  const maxed = createMaxedSave();
  // all fighters and weapons unlocked, nothing bought: a "fresh but caught up" player
  return { ...maxed, upgrades: {}, skillNodes: {}, equippedArcana: [], charms: maxed.armory.slice(0, 3) };
};

const near = (x: number, target: number, tol: number) => {
  expect(x).toBeGreaterThanOrEqual(target - tol);
  expect(x).toBeLessThanOrEqual(target + tol);
};

describe('adventure data integrity', () => {
  it('every level introduces a known mechanic, and no mechanic is introduced twice', () => {
    const seen = new Set<string>();
    for (const l of LEVELS) {
      expect(MECHANICS[l.introduces]).toBeDefined();
      expect(seen.has(l.introduces)).toBe(false);
      seen.add(l.introduces);
    }
  });

  it('level ids are unique', () => {
    expect(new Set(LEVELS.map(l => l.id)).size).toBe(LEVELS.length);
  });

  it('campaign HP curve is monotonic across World Bosses without intra-world cliffs', () => {
    const check = validateCampaignHpCurve(LEVELS);
    expect(check.violations).toEqual([]);
  });

  it('bot simulation honors enemy weapon counters (Wet Crab reduces fire procs ~60% without double-applying)', () => {
    const crabLevel = getLevel('3-5P');
    const calmLevel: LevelDef = { ...crabLevel, foes: [{ name: 'Dry Crab', icon: 'lorc/crab', hp: crabLevel.foes[0].hp, parry: null }] };
    const crabNoParry: LevelDef = { ...crabLevel, foes: [{ ...crabLevel.foes[0], parry: null }] };
    const save: AdventureSave = { ...createMaxedSave(), charms: ['flint-spark'], skillNodes: {}, equippedArcana: [] };
    let dryFires = 0;
    let wetFires = 0;
    for (let i = 0; i < 16; i++) {
      const seed = 1000 + i * 7919;
      const dry = simulateRun(calmLevel, save, BOTS.average, seed, undefined, { skipPicks: true });
      const wet = simulateRun(crabNoParry, save, BOTS.average, seed, undefined, { skipPicks: true });
      dryFires += dry.state.log.reduce((n, e) => n + e.lines.filter(l => l.type === 'fire').length, 0);
      wetFires += wet.state.log.reduce((n, e) => n + e.lines.filter(l => l.type === 'fire').length, 0);
    }
    const ratio = wetFires / Math.max(1, dryFires);
    // Wet Crab reduces fireSpreadChance by 60% (ratio ~0.40, NOT 0.16 from double-application and NOT 1.0 from bypassing!)
    expect(ratio).toBeGreaterThan(0.22);
    expect(ratio).toBeLessThan(0.62);
  });
});

describe('adventure 3-star balance: ★1+ clear, ★★+ knockout, ★★★ mastery (docs/balance-philosophy.md)', () => {
  const report: string[] = [];
  /** [bareClear, bareKo, invClear, invKo, invStar3] of main non-boss levels by world */
  const byWorld = new Map<number, [number, number, number, number, number][]>();
  const world1ProStar3: number[] = [];

  afterAll(() => {
    if (process.env.ADVENTURE_BALANCE_REPORT) console.log(report.join('\n'));
  });

  for (const level of LEVELS) {
    const kind = level.starRule?.kind === 'accuracy' ? 'tutorial' : level.branchOf ? 'elite' : level.isBoss ? 'boss' : 'level';
    it(`${level.id} ${level.name} (${kind}) hits its ★1 / ★★ / ★★★ funnel targets`, () => {
      const save = campaignSave(level);
      const bare = starDistribution(level, save, BOTS.average, RUNS, withPuzzle(level, barePlan(level)));
      const inv = starDistribution(level, save, BOTS.average, RUNS, withPuzzle(level, investedPlan(level)));
      const clear = (d: number[]) => d[1] + d[2] + d[3];
      const ko = (d: number[]) => d[2] + d[3];
      const t = winTargets(level);
      const st = starTargets(level);
      const w = worldOf(level);
      const needsPro = w === 1 || !!level.isBoss || inv.dist[3] < st.investedStar3Floor;
      const pro = needsPro
        ? starDistribution(level, save, BOTS.expert, w === 1 ? RUNS : Math.max(20, Math.round(RUNS / 3)), withPuzzle(level, investedPlan(level)))
        : null;
      const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(4);
      report.push(
        `${level.id.padEnd(5)} ${level.name.padEnd(18)} bare ★1+${pct(clear(bare.dist))} ★★+${pct(ko(bare.dist))} (${pct(t.bare)}) | ` +
          `inv ★1+${pct(clear(inv.dist))} ★★+${pct(ko(inv.dist))} (${pct(t.invested)}) ★★★${pct(inv.dist[3])}` +
          (pro ? ` | pro★★★${pct(pro.dist[3])}` : '') +
          ` | coins ${Math.round(inv.avgCoins)}`
      );
      if (level.starRule?.kind === 'accuracy') {
        // The first level can't be lost, and pros 3-star it cleanly
        expect(bare.dist[0]).toBe(0);
        expect(inv.dist[0]).toBe(0);
        if (pro) expect(pro.dist[3]).toBeGreaterThanOrEqual(0.8);
        return;
      }
      // 1★+ Clear floor: World 1 never discourages players with frequent 0★ losses
      expect(clear(bare.dist)).toBeGreaterThanOrEqual(st.bareClearFloor - 0.1);
      expect(clear(inv.dist)).toBeGreaterThanOrEqual(st.investedClearFloor - 0.1);
      // 2★+ Knockout targets
      near(ko(bare.dist), t.bare, LEVEL_TOLERANCE);
      near(ko(inv.dist), t.invested, LEVEL_TOLERANCE);
      // 3★ Mastery floor: achievable challenge, never starved out
      expect(inv.dist[3]).toBeGreaterThanOrEqual(st.investedStar3Floor - 0.12);
      if (pro) {
        expect(pro.dist[3]).toBeGreaterThanOrEqual(st.expertStar3Floor - 0.08);
        if (w === 1 && !level.branchOf) world1ProStar3.push(pro.dist[3]);
      }
      // Progression pays off (gentle early lessons at >=95% KO allow ties at the ceiling)
      if (ko(inv.dist) >= 0.96 && t.bare >= 0.8) expect(ko(inv.dist)).toBeGreaterThanOrEqual(ko(bare.dist));
      else expect(ko(inv.dist)).toBeGreaterThan(ko(bare.dist));
      if (kind === 'level') {
        byWorld.set(w, [
          ...(byWorld.get(w) ?? []),
          [clear(bare.dist), ko(bare.dist), clear(inv.dist), ko(inv.dist), inv.dist[3]],
        ]);
      }
    });
  }

  it('each world lands on its ★1 / ★★ / ★★★ funnel targets and gets harder cleanly', () => {
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const worlds = [1, 2, 3, 4, 5];
    const bareClear = worlds.map(w => mean((byWorld.get(w) ?? []).map(x => x[0])));
    const bare = worlds.map(w => mean((byWorld.get(w) ?? []).map(x => x[1])));
    const invClear = worlds.map(w => mean((byWorld.get(w) ?? []).map(x => x[2])));
    const inv = worlds.map(w => mean((byWorld.get(w) ?? []).map(x => x[3])));
    const invStar3 = worlds.map(w => mean((byWorld.get(w) ?? []).map(x => x[4])));
    const proW1 = mean(world1ProStar3);
    report.push(
      `world ★1+ clear: bare ${bareClear.map(x => `${Math.round(x * 100)}%`).join(' > ')} | inv ${invClear.map(x => `${Math.round(x * 100)}%`).join(' > ')}\n` +
        `world ★★+ wins : bare ${bare.map(x => `${Math.round(x * 100)}%`).join(' > ')} | inv ${inv.map(x => `${Math.round(x * 100)}%`).join(' > ')}\n` +
        `world ★★★ mast.: inv  ${invStar3.map(x => `${Math.round(x * 100)}%`).join(' > ')} | W1 pro ★★★ ${Math.round(proW1 * 100)}%`
    );
    // World 1 is super welcoming: >=94% bare ★1+, >=98% invested ★1+, >=80% pro ★★★ mean
    expect(bareClear[0]).toBeGreaterThanOrEqual(0.94);
    expect(invClear[0]).toBeGreaterThanOrEqual(0.98);
    expect(proW1).toBeGreaterThanOrEqual(0.8);
    expect(invStar3[0]).toBeGreaterThanOrEqual(0.6);
    worlds.forEach((w, i) => {
      near(bare[i], WIN_TARGETS.bare[i] + (w === 1 ? 0.04 : 0), WORLD_TOLERANCE);
      near(inv[i], WIN_TARGETS.invested[i], WORLD_TOLERANCE);
      expect(invClear[i]).toBeGreaterThanOrEqual(STAR_TARGETS.investedClearFloor[i] - 0.05);
      // 3★ funnel: ★1+ >= ★★+ > ★★★ in every world
      expect(invClear[i]).toBeGreaterThanOrEqual(inv[i]);
      expect(inv[i]).toBeGreaterThan(invStar3[i]);
    });
    // Late worlds require tighter mastery for ★★★ than World 1
    expect(invStar3[0]).toBeGreaterThan(invStar3[4]);
    // Neither player finds a world easier than the last, and together they find each one harder
    for (let i = 1; i < worlds.length; i++) {
      expect(inv[i]).toBeLessThanOrEqual(inv[i - 1] + 0.02);
      expect(bare[i]).toBeLessThanOrEqual(bare[i - 1] + 0.02);
      expect(inv[i] + bare[i]).toBeLessThan(inv[i - 1] + bare[i - 1]);
    }
  });

  it('the level that teaches evolutions shows an invested player their first one', () => {
    const level = LEVELS.find(l => l.introduces === 'evolutions')!;
    const save = campaignSave(level);
    let evolved = 0;
    for (let i = 0; i < RUNS; i++) if (simulateRun(level, save, BOTS.average, 1000 + i * 7919, investedPlan(level)).state.evolutionsTriggered > 0) evolved += 1;
    report.push(`${level.id} first evolution fires (invested): ${Math.round((evolved / RUNS) * 100)}%`);
    expect(evolved / RUNS).toBeGreaterThanOrEqual(0.75);
  });
});

describe('harder foes pay more (Vampire Survivors-style grind)', () => {
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const regions = ['meadow', 'woods', 'canyon', 'peaks'] as const;

  it('each region pays more per coin than the last', () => {
    const m = regions.map(r => mean(MAIN_LEVELS.filter(l => l.biome === r).map(l => l.coinMultiplier)));
    for (let i = 1; i < m.length; i++) expect(m[i]).toBeGreaterThan(m[i - 1]);
  });

  it('bosses pay the most in their region', () => {
    for (const r of regions) {
      const lv = MAIN_LEVELS.filter(l => l.biome === r);
      const boss = lv.filter(l => l.isBoss);
      for (const b of boss) for (const l of lv.filter(x => !x.isBoss)) expect(b.coinMultiplier).toBeGreaterThan(l.coinMultiplier);
    }
  });

  it('higher difficulty pays more on average', () => {
    const byDiff = [1, 2, 3, 4, 5].map(d => LEVELS.filter(l => l.difficulty === d).map(l => l.coinMultiplier)).filter(xs => xs.length);
    const m = byDiff.map(mean);
    for (let i = 1; i < m.length; i++) expect(m[i]).toBeGreaterThan(m[i - 1]);
  });

  it('an average player banks more coins per run on each region boss', () => {
    const save = progressedSave();
    const bosses = regions.map(r => MAIN_LEVELS.filter(l => l.isBoss && l.biome === r)[0]).filter(Boolean).slice(0, 3);
    const coins = bosses.map(b => starDistribution(b, save, BOTS.average, 12).avgCoins);
    for (let i = 1; i < coins.length; i++) expect(coins[i]).toBeGreaterThan(coins[i - 1]);
  });
});

describe('elite branches pay better than the level they hang off', () => {
  it('every elite out-pays its parent', () => {
    for (const e of LEVELS.filter(l => l.branchOf)) {
      const parent = LEVELS.find(l => l.id === e.branchOf)!;
      expect(e.coinMultiplier).toBeGreaterThan(parent.coinMultiplier);
      expect(e.difficulty).toBeGreaterThanOrEqual(parent.difficulty);
    }
  });
});
