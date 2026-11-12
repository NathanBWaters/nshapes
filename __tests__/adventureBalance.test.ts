/**
 * Adventure balance — headless bots play every level through the real reducer.
 *
 * What a bot brings (engine/botBuilds.ts), per run, like a player at the preview:
 *   - the gear, recipes, Arcana and free weapon levels won on the levels before this one;
 *   - a skill tree bought with the stars a player of its skill has by now
 *     (STAR_SHARE of the stars on offer before the level: every fighter
 *     spends every star earned), in a random buying style;
 *   - a random unlocked fighter, and charms it picks itself: often both halves
 *     of an evolution recipe, the rest at random;
 *   - level-up picks and shop buys that complete a recipe when they can.
 * No Workshop spending.
 *
 * Targets:
 *   - Every level is survivable (★) by an average player most of the time.
 *   - The meadow tutorial is very forgiving for novices.
 *   - ★★★ is NOT routine for an average player on the harder levels — that's
 *     what replaying, skill trees, and Camp upgrades are for.
 *
 * Star bands for the AVERAGE bot (see BANDS below): the main path gets gently
 * harder world by world, bosses and elites are real fights, fighter trials feel
 * good, and the ★★★ of a level that teaches something (use the new thing) is
 * reachable but not automatic. The bot is seeded, so these numbers are exact
 * and the asserted sample is the one the report prints.
 *
 * Set ADVENTURE_BALANCE_REPORT=1 to print the full table.
 */
import { LEVELS, MAIN_LEVELS } from '@/adventure/data/levels';
import { applyLevelResult, createNewSave, createMaxedSave } from '@/adventure/progress';
import { BOTS, simulateRun, starDistribution, type BotProfile } from '@/adventure/engine/bot';
import { levelsBefore, starsOnReaching, STAR_SHARE, type BuildPlan } from '@/adventure/engine/botBuilds';
import { MECHANICS } from '@/adventure/data/mechanics';
import { levelDefeatCondition } from '@/adventure/data/foes';
import type { AdventureSave, LevelDef } from '@/adventure/types';

// The bot is seeded, so a run count gives exact, repeatable numbers. The bands
// are asserted on the same 60-run sample the report prints (16 runs is too
// coarse: one run is ±6%).
const RUNS = 60;

const isTrial = (level: LevelDef) => level.introduces.startsWith('fighter_');


const WORLD: Record<string, number> = { meadow: 1, woods: 2, canyon: 3, peaks: 4, summit: 5 };

/** ★★★ asks you to DO something a number of times (the "use the new thing" goals) rather than a pass/fail rule. */
const isUseItChallenge = (level: LevelDef) => 'n' in level.challenge;

/** ★★★ is the foe's own condition and it asks for a fight with no damage taken. */
const isFlawless = (level: LevelDef) =>
  level.challenge.kind === 'enemy' && /0 damage taken/.test(levelDefeatCondition(level) ?? '');

/**
 * The player reads the level's puzzle and equips for it. 3-2 teaches charm
 * slots: "fill every slot with a DIFFERENT kind and trigger three of them".
 */
const PUZZLE_CHARMS: Record<string, string[]> = {
  '3-2': ['blast-powder', 'flint-spark', 'prismatic-ray'],
};

/**
 * How a bot of this skill gears up for the level: its stars (STAR_SHARE of
 * those on offer so far), any unlocked fighter (a fighter trial is played with
 * the fighter it teaches), its own charms (unless the level's puzzle names them).
 */
const planFor = (level: LevelDef, bot: BotProfile): BuildPlan => ({
  stars: starsOnReaching(level, STAR_SHARE[bot.name as keyof typeof STAR_SHARE]),
  fighter: isTrial(level) ? level.recommended![0] : 'any',
  keepCharms: !!PUZZLE_CHARMS[level.id],
});

/** Target bands for the average bot: [min, max] fractions of runs. */
const BANDS = {
  /** ★ or better on the main path (World 5 is the sharp finale) */
  survive: (world: number) => (world === 5 ? 0.7 : 0.85),
  /** ★★ (knockout) on the main path, by world; bosses have their own band */
  knockout: (world: number): [number, number] => (world === 1 ? [0.7, 0.9] : world === 5 ? [0.3, 0.6] : [0.45, 0.9]),
  boss: [0.35, 0.75] as [number, number],
  /** ★★★ on the main path; a "use it" challenge must be reachable */
  threeStar: [0.1, 0.7] as [number, number],
  useIt: [0.15, 0.7] as [number, number],
  /**
   * World 1 teaches: when knocking the foe out already means using the new
   * mechanic (Rainbow Strike), ★★★ may track ★★ closely.
   */
  useItWorld1: [0.15, 0.85] as [number, number],
  /**
   * A flawless ★★★ (the foe's condition needs 0 damage taken, e.g. The Reaper)
   * on the finale world is meant to be rare: reachable, not routine.
   */
  flawless: [0.03, 0.7] as [number, number],
  /** novice ★0 on main levels before World 4 */
  noviceLoss: 0.35,
  elite: { knockout: [0.25, 0.65] as [number, number], loss: 0.3 },
  trial: { knockout: 0.55, threeStar: 0.15 },
};

const inBand = (x: number, [lo, hi]: [number, number]) => {
  expect(x).toBeGreaterThanOrEqual(lo);
  expect(x).toBeLessThanOrEqual(hi);
};

const progressedSave = (): AdventureSave => {
  const maxed = createMaxedSave();
  // all fighters and weapons unlocked, nothing bought: a "fresh but caught up" player
  return { ...maxed, upgrades: {}, skillNodes: {}, equippedArcana: [], charms: maxed.armory.slice(0, 3) };
};

/**
 * What the player owns when they reach this level: a fresh save that has
 * earned all three stars on every level before it, paid out through the real
 * reward pipeline (applyLevelResult). That gives the right weapons, recipes,
 * Arcana, fighters and campaign features, and the free weapon levels repeat
 * rewards grant. The bot spends its stars and picks its charms per run (plan below).
 * A World 1 level is played with World 1 gear, not the whole Armory.
 */
const campaignSaves = new Map<string, AdventureSave>();
const campaignSave = (level: LevelDef): AdventureSave => {
  const hit = campaignSaves.get(level.id);
  if (hit) return hit;
  let save = createNewSave();
  for (const l of levelsBefore(level)) save = applyLevelResult(save, l, 3, 0).save;
  campaignSaves.set(level.id, save);
  return save;
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

describe('adventure balance (headless bots)', () => {
  const report: string[] = [];
  /** avg ★≥2 per main non-boss level, by world (checked after every level has run) */
  const knockouts = new Map<number, number[]>();

  afterAll(() => {
    if (process.env.ADVENTURE_BALANCE_REPORT) console.log(report.join('\n'));
  });

  for (const level of LEVELS) {
    const elite = !!level.branchOf;
    it(elite ? `${level.id} ${level.name} (elite) is beatable but not a free win` : `${level.id} ${level.name} is survivable by an average player`, () => {
      // The final boss expects some Camp investment (2 Tough Hide)
      const finalBoss = MAIN_LEVELS[MAIN_LEVELS.length - 1];
      const earned = campaignSave(level);
      const base: AdventureSave = level.id === finalBoss.id ? { ...earned, upgrades: { ...earned.upgrades, tough_hide: 2 } } : earned;
      const fresh: AdventureSave = PUZZLE_CHARMS[level.id] ? { ...base, charms: PUZZLE_CHARMS[level.id] } : base;
      const avg = starDistribution(level, fresh, BOTS.average, RUNS, planFor(level, BOTS.average));
      const nov = starDistribution(level, fresh, BOTS.novice, RUNS, planFor(level, BOTS.novice));
      const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(4);
      report.push(
        `${level.id.padEnd(4)} ${level.name.padEnd(18)} ` +
          `novice ★0 ${pct(nov.dist[0])} ★1 ${pct(nov.dist[1])} ★2 ${pct(nov.dist[2])} ★3 ${pct(nov.dist[3])} | ` +
          `avg ★0 ${pct(avg.dist[0])} ★1 ${pct(avg.dist[1])} ★2 ${pct(avg.dist[2])} ★3 ${pct(avg.dist[3])} | coins ${Math.round(avg.avgCoins)}`
      );
      if (elite) {
        // Elites are optional and hard: an expert can at least survive, and
        // an average player on a level-1 fighter does not three-star them for free.
        const exp = starDistribution(level, fresh, BOTS.expert, RUNS, planFor(level, BOTS.expert));
        expect(1 - exp.dist[0]).toBeGreaterThanOrEqual(0.5);
        expect(avg.dist[3]).toBeLessThanOrEqual(0.7); // small samples are noisy
        const ko = avg.dist[2] + avg.dist[3];
        if (isTrial(level)) {
          // Fighter trials teach the fighter: they should feel good
          expect(ko).toBeGreaterThanOrEqual(BANDS.trial.knockout);
          expect(avg.dist[3]).toBeGreaterThanOrEqual(BANDS.trial.threeStar);
        } else {
          inBand(ko, BANDS.elite.knockout);
          expect(avg.dist[0]).toBeLessThanOrEqual(BANDS.elite.loss);
        }
        return;
      }
      expect(1 - avg.dist[0]).toBeGreaterThanOrEqual(0.6);
      if (level.biome === 'meadow') expect(1 - nov.dist[0]).toBeGreaterThanOrEqual(0.6);
      if (level.starRule?.kind === 'accuracy') {
        // The first level can't be lost
        expect(avg.dist[0]).toBe(0);
        expect(nov.dist[0]).toBe(0);
        return;
      }
      const world = WORLD[level.biome];
      const ko = avg.dist[2] + avg.dist[3];
      expect(1 - avg.dist[0]).toBeGreaterThanOrEqual(BANDS.survive(world));
      if (!level.isBoss) knockouts.set(world, [...(knockouts.get(world) ?? []), ko]);
      inBand(ko, level.isBoss ? BANDS.boss : BANDS.knockout(world));
      inBand(
        avg.dist[3],
        isUseItChallenge(level) ? (world === 1 ? BANDS.useItWorld1 : BANDS.useIt) : isFlawless(level) && world === 5 ? BANDS.flawless : BANDS.threeStar
      );
      if (world < 4) expect(nov.dist[0]).toBeLessThanOrEqual(BANDS.noviceLoss);
    });
  }

  it('the level that teaches evolutions shows most players their first one', () => {
    const level = LEVELS.find(l => l.introduces === 'evolutions')!;
    const earned = campaignSave(level);
    for (const bot of [BOTS.novice, BOTS.average]) {
      let evolved = 0;
      for (let i = 0; i < RUNS; i++) if (simulateRun(level, earned, bot, 1000 + i * 7919, planFor(level, bot)).state.evolutionsTriggered > 0) evolved += 1;
      report.push(`${level.id} first evolution fires (${bot.name}): ${Math.round((evolved / RUNS) * 100)}%`);
      expect(evolved / RUNS).toBeGreaterThanOrEqual(0.75);
    }
  });

  it('the main path gets harder world by world (mean ★★ rate falls each world)', () => {
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const byWorld = [1, 2, 3, 4, 5].map(w => mean(knockouts.get(w) ?? [NaN]));
    report.push(`mean ★≥2 by world: ${byWorld.map(x => `${Math.round(x * 100)}%`).join(' > ')}`);
    for (let i = 1; i < byWorld.length; i++) expect(byWorld[i]).toBeLessThan(byWorld[i - 1]);
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
