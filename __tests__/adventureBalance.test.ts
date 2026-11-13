/**
 * Adventure balance — headless bots play every level through the real reducer,
 * aimed at the two players in docs/balance-philosophy.md. Both are the same
 * average-skill bot (engine/bot.ts), so the gap between them is progression:
 *
 *   BARE      no stars spent, no Workshop, random charms, never chases a recipe
 *   INVESTED  every star on offer spent with a plan, every Workshop upgrade on
 *             sale maxed, its charms fully tuned, a solid build (a recipe pair
 *             plus damage weapons), level-up picks and buys that chase recipes
 *
 * Each run gears up from the save a player has on reaching the level (3★ on
 * everything before it, through the real reward pipeline) and a random unlocked
 * fighter. "Winning" is a knockout (★★). Targets by world (engine/botBuilds.ts
 * WIN_TARGETS / winTargets):
 *
 *   world      1     2     3     4     5
 *   bare      50%   30%   10%    0%    0%
 *   invested  97%   90%   80%   70%   50%
 *
 * Bosses and elites are a step harder for the invested player, fighter trials
 * a step kinder, and 1-2/1-3 come before any progression exists (both ~85%). The bot is seeded, so
 * the numbers are exact and the asserted sample is the one the report prints.
 *
 * Set ADVENTURE_BALANCE_REPORT=1 to print the full table.
 */
import { LEVELS, MAIN_LEVELS } from '@/adventure/data/levels';
import { applyLevelResult, createNewSave, createMaxedSave } from '@/adventure/progress';
import { BOTS, simulateRun, starDistribution } from '@/adventure/engine/bot';
import { barePlan, investedPlan, levelsBefore, winTargets, worldOf, WIN_TARGETS, type BuildPlan } from '@/adventure/engine/botBuilds';
import { MECHANICS } from '@/adventure/data/mechanics';
import type { AdventureSave, LevelDef } from '@/adventure/types';

// 60 seeded runs per player: one run is ±1.7%, the sample is ±6%.
const RUNS = 60;

/** How far one level may sit from its target; world means must sit closer (WORLD_TOLERANCE). */
const LEVEL_TOLERANCE = 0.2;
const WORLD_TOLERANCE = 0.1;

/**
 * The player reads the level's puzzle and equips for it. 3-2 teaches charm
 * slots: "fill every slot with a DIFFERENT kind and trigger three of them".
 */
const PUZZLE_CHARMS: Record<string, string[]> = {
  '3-2': ['blast-powder', 'flint-spark', 'prismatic-ray'],
};

const withPuzzle = (level: LevelDef, plan: BuildPlan): BuildPlan => ({ ...plan, keepCharms: !!PUZZLE_CHARMS[level.id] });

const progressedSave = (): AdventureSave => {
  const maxed = createMaxedSave();
  // all fighters and weapons unlocked, nothing bought: a "fresh but caught up" player
  return { ...maxed, upgrades: {}, skillNodes: {}, equippedArcana: [], charms: maxed.armory.slice(0, 3) };
};

/** What the player owns on reaching this level: 3★ on every level before it, through the real reward pipeline. */
const campaignSaves = new Map<string, AdventureSave>();
const campaignSave = (level: LevelDef): AdventureSave => {
  const hit = campaignSaves.get(level.id);
  if (hit) return hit;
  let save = createNewSave();
  for (const l of levelsBefore(level)) save = applyLevelResult(save, l, 3, 0).save;
  if (PUZZLE_CHARMS[level.id]) save = { ...save, charms: PUZZLE_CHARMS[level.id] };
  campaignSaves.set(level.id, save);
  return save;
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
});

describe('adventure balance: bare vs invested player (docs/balance-philosophy.md)', () => {
  const report: string[] = [];
  /** knockout rates of main non-boss levels by world: [bare, invested] */
  const byWorld = new Map<number, [number, number][]>();

  afterAll(() => {
    if (process.env.ADVENTURE_BALANCE_REPORT) console.log(report.join('\n'));
  });

  for (const level of LEVELS) {
    const kind = level.starRule?.kind === 'accuracy' ? 'tutorial' : level.branchOf ? 'elite' : level.isBoss ? 'boss' : 'level';
    it(`${level.id} ${level.name} (${kind}) sits between the bare and the invested player`, () => {
      const save = campaignSave(level);
      const bare = starDistribution(level, save, BOTS.average, RUNS, withPuzzle(level, barePlan(level)));
      const inv = starDistribution(level, save, BOTS.average, RUNS, withPuzzle(level, investedPlan(level)));
      const ko = (d: number[]) => d[2] + d[3];
      const t = winTargets(level);
      const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(4);
      report.push(
        `${level.id.padEnd(5)} ${level.name.padEnd(18)} bare ★0 ${pct(bare.dist[0])} win ${pct(ko(bare.dist))} (${pct(t.bare)}) | ` +
          `invested ★0 ${pct(inv.dist[0])} win ${pct(ko(inv.dist))} (${pct(t.invested)}) ★3 ${pct(inv.dist[3])} | coins ${Math.round(inv.avgCoins)}`
      );
      if (level.starRule?.kind === 'accuracy') {
        // The first level can't be lost
        expect(bare.dist[0]).toBe(0);
        expect(inv.dist[0]).toBe(0);
        return;
      }
      near(ko(bare.dist), t.bare, LEVEL_TOLERANCE);
      near(ko(inv.dist), t.invested, LEVEL_TOLERANCE);
      // Progression always pays off
      expect(ko(inv.dist)).toBeGreaterThan(ko(bare.dist));
      if (kind === 'level') byWorld.set(worldOf(level), [...(byWorld.get(worldOf(level)) ?? []), [ko(bare.dist), ko(inv.dist)]]);
    });
  }

  it('each world lands on its targets on average, and gets harder for both players', () => {
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const worlds = [1, 2, 3, 4, 5];
    const bare = worlds.map(w => mean((byWorld.get(w) ?? []).map(x => x[0])));
    const inv = worlds.map(w => mean((byWorld.get(w) ?? []).map(x => x[1])));
    report.push(`mean wins by world: bare ${bare.map(x => `${Math.round(x * 100)}%`).join(' > ')} | invested ${inv.map(x => `${Math.round(x * 100)}%`).join(' > ')}`);
    worlds.forEach((w, i) => {
      // World 1's first lessons ramp in, so its bare mean runs a little high
      near(bare[i], WIN_TARGETS.bare[i] + (w === 1 ? 0.05 : 0), WORLD_TOLERANCE);
      near(inv[i], WIN_TARGETS.invested[i], WORLD_TOLERANCE);
    });
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
