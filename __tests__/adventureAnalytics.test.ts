/**
 * Multi-factor combo analytics, fighter/Arcana synergy & uniqueness guardrails.
 *
 * Fast mode (default `npm test`): verifies analytics primitives (Ridge solver,
 * skewness, Pressure bench, and anti-synergy regression checks such as Corgi's
 * Zoomies preserving active trick investment cards).
 *
 * Full Atlas mode (`BALANCE_ATLAS=1` / `npm run balance:atlas`): sweeps all 63
 * weapons (8D behavioral uniqueness + MAP-Elites + Snowball trajectories), all
 * C(63,2) = 1,953 weapon pairs, all 204 evolutions, all 6 fighters × 63 weapons,
 * all 8 Arcana + 28 Arcana pairs, 182 Covering-Array endgame builds, and all 56
 * campaign levels, writing `docs/balance-analytics.json`.
 */
import * as fs from 'fs';
import * as path from 'path';
import { benches, recipeLifts, synergy } from '@/adventure/balance/lab';
import {
  measureArcanaMatrix,
  measureFighterMatrix,
  pressureBench,
  runFullBalanceAtlas,
  skewness,
  solveRidge,
} from '@/adventure/balance/analytics';

const FULL = !!process.env.BALANCE_ATLAS;
const SNAPSHOT_OUT = process.env.SNAPSHOT_OUT;
const DOCS = path.join(__dirname, '..', 'docs');

describe('analytics primitives & pressure bench', () => {
  it('solves Ridge regression accurately and computes positive skewness for pop-off tails', () => {
    const X = [
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 1],
      [1, 0, 0],
    ];
    // y = 2 + 1.5*x1 + 0.8*x2
    const y = [3.5, 4.3, 2.8, 2.0];
    const beta = solveRidge(X, y, 0.001);
    expect(beta[0]).toBeCloseTo(2.0, 2);
    expect(beta[1]).toBeCloseTo(1.5, 2);
    expect(beta[2]).toBeCloseTo(0.8, 2);

    // Right-skewed Set damage series (steady hits + one huge pop-off)
    expect(skewness([4, 5, 4, 5, 4, 5, 4, 55])).toBeGreaterThan(1.5);
  });

  it('builds a realistic World 4-5 pressure bench with Shading Surge and active hazards', () => {
    const pb = pressureBench();
    expect(pb.level.rules.shadingSurge).toBe(true);
    expect(pb.level.rules.hazards?.timeBombs).toBeDefined();
    expect(pb.level.rules.hazards?.snares).toBeDefined();
    expect(pb.save.armory.length).toBeGreaterThanOrEqual(63);
  });

  it('keeps tuned edge-case evolutions and ricochet pairs inside healthy bands', () => {
    const late = benches().late;
    const rows = recipeLifts(late, 'average', 14, [
      'heart-pinata',
      'lucky-break',
      'gold-detector',
      'reverb',
      'standing-ovation',
      'body-double',
      'deep-learning',
    ]);
    for (const r of rows) {
      expect(r.ratio).toBeGreaterThanOrEqual(1.04);
      expect(r.ratio).toBeLessThanOrEqual(2.6);
      expect(r.starts).toBeGreaterThanOrEqual(0.15);
    }
    // Chaos Shard + Understudy no longer hits 100% deterministic full-board ricochet wipe
    expect(synergy(late, 'chaos-shard', 'understudy', 'average', 6)).toBeLessThan(3.5);
  });

  it('has no catastrophic fighter × trick-weapon self-sabotage on Corgi Zoomies', () => {
    // Regression guard: Corgi's Zoomies redeals every 3-5 Sets; Rust & Ice Block take 7 Sets to mature
    const fm = measureFighterMatrix(4, 4);
    const corgiRust = fm.cells.find(c => c.fighter === 'Corgi' && c.weaponId === 'rust')!;
    const corgiIce = fm.cells.find(c => c.fighter === 'Corgi' && c.weaponId === 'ice-block')!;
    const corgiChest = fm.cells.find(c => c.fighter === 'Corgi' && c.weaponId === 'greedy-chest')!;
    expect(corgiRust.weaponOnFighterLift).toBeGreaterThanOrEqual(1.0);
    expect(corgiIce.weaponOnFighterLift).toBeGreaterThanOrEqual(1.0);
    expect(corgiChest.weaponOnFighterLift).toBeGreaterThanOrEqual(1.0);
  });

  it('measures all 8 Arcana on a multi-wave XP/shop/recipe bench without dead kiss-curse traps', () => {
    const am = measureArcanaMatrix(4);
    expect(am.solo).toHaveLength(8);
    expect(am.pairs).toHaveLength(28);
    for (const row of am.solo) {
      expect(row.effectiveLiftAvg).toBeGreaterThan(0.75);
      expect(row.effectiveLiftAvg).toBeLessThan(2.0);
    }
  });
});

(FULL ? describe : describe.skip)('full balance atlas sweep', () => {
  it('sweeps every weapon, pair, evolution, fighter, Arcana, covering array & campaign level', () => {
    const atlas = runFullBalanceAtlas({
      weaponRuns: 8,
      buildCount: 8,
      pairRuns: 3,
      recipeRuns: 6,
      fighterRuns: 6,
      arcanaRuns: 6,
      coveringPasses: 14,
      campaignRuns: 16,
    });
    const outPath = SNAPSHOT_OUT || path.join(DOCS, 'balance-analytics.json');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(atlas, null, 2) + '\n');

    expect(atlas.weaponsSuite.weapons.length).toBe(63);
    expect(atlas.pairSuite.totalPairs).toBe((63 * 62) / 2);
    expect(atlas.pairSuite.recipes.length).toBeGreaterThanOrEqual(204);
    expect(atlas.fighterSuite.cells.length).toBe(6 * 63);
    expect(atlas.arcanaSuite.solo.length).toBe(8);
    expect(atlas.arcanaSuite.pairs.length).toBe(28);
    expect(atlas.campaignSuite.levels.length).toBeGreaterThanOrEqual(50);
  });
});
