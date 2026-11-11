/**
 * Adventure balance — headless bots play every level through the real reducer.
 *
 * Targets (with a level-1 fighter and no upgrades):
 *   - Every level is survivable (★) by an average player most of the time.
 *   - The meadow tutorial is very forgiving for novices.
 *   - ★★★ is NOT routine for an average player on the harder levels — that's
 *     what replaying, levelling fighters, and Camp upgrades are for.
 *
 * Set ADVENTURE_BALANCE_REPORT=1 to print the full table.
 */
import { LEVELS, MAIN_LEVELS } from '@/adventure/data/levels';
import { createNewSave, createMaxedSave } from '@/adventure/progress';
import { BOTS, starDistribution } from '@/adventure/engine/bot';
import { MECHANICS } from '@/adventure/data/mechanics';
import type { AdventureSave } from '@/adventure/types';

const RUNS = process.env.ADVENTURE_BALANCE_REPORT ? 60 : 16;

const progressedSave = (): AdventureSave => {
  const maxed = createMaxedSave();
  // all fighters unlocked but at level 1, no upgrades: a "fresh but caught up" player
  return { ...maxed, upgrades: {}, fighterLevels: Object.fromEntries(maxed.unlockedFighters.map(f => [f, 1])) };
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

  it('level ids are unique and indices are ordered', () => {
    expect(new Set(LEVELS.map(l => l.id)).size).toBe(LEVELS.length);
    LEVELS.forEach((l, i) => expect(l.index).toBe(i));
  });
});

describe('adventure balance (headless bots)', () => {
  const save = progressedSave();
  const report: string[] = [];

  afterAll(() => {
    if (process.env.ADVENTURE_BALANCE_REPORT) console.log(report.join('\n'));
  });

  for (const level of LEVELS) {
    const elite = !!level.branchOf;
    it(elite ? `${level.id} ${level.name} (elite) is beatable but not a free win` : `${level.id} ${level.name} is survivable by an average player`, () => {
      // The final boss expects some Camp investment (fighter Lv 6 + 2 Tough Hide)
      const geared: AdventureSave = { ...save, fighterLevels: { ...save.fighterLevels, 'Orange Tabby': 6 }, upgrades: { tough_hide: 2 } };
      const fresh = level.id === '1-1' ? createNewSave() : level.id === '4-5' ? geared : save;
      const avg = starDistribution(level, fresh, BOTS.average, RUNS);
      const nov = starDistribution(level, fresh, BOTS.novice, RUNS);
      const pct = (x: number) => `${Math.round(x * 100)}%`.padStart(4);
      report.push(
        `${level.id.padEnd(4)} ${level.name.padEnd(18)} ` +
          `novice ★0 ${pct(nov.dist[0])} ★1 ${pct(nov.dist[1])} ★2 ${pct(nov.dist[2])} ★3 ${pct(nov.dist[3])} | ` +
          `avg ★0 ${pct(avg.dist[0])} ★1 ${pct(avg.dist[1])} ★2 ${pct(avg.dist[2])} ★3 ${pct(avg.dist[3])} | coins ${Math.round(avg.avgCoins)}`
      );
      if (elite) {
        // Elites are optional and hard: an expert can at least survive, and
        // an average player on a level-1 fighter does not three-star them for free.
        const exp = starDistribution(level, save, BOTS.expert, RUNS);
        expect(1 - exp.dist[0]).toBeGreaterThanOrEqual(0.5);
        expect(avg.dist[3]).toBeLessThanOrEqual(0.7); // small samples are noisy
        return;
      }
      expect(1 - avg.dist[0]).toBeGreaterThanOrEqual(0.6);
      if (level.biome === 'meadow') expect(1 - nov.dist[0]).toBeGreaterThanOrEqual(0.6);
    });
  }
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
    const coins = ['1-8', '2-8', '3-8'].map(id => starDistribution(LEVELS.find(l => l.id === id)!, save, BOTS.average, 12).avgCoins);
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
