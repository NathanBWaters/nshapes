/**
 * Multi-factor combo analytics, fighter/Arcana synergy & uniqueness guardrails.
 *
 * Fast mode (default `npm test`): verifies analytics primitives (Ridge solver,
 * skewness, Pressure bench, Role Set Bonus / Gamble clash checks, Fighter
 * pressure equity, and Arcana EV + survival bounds).
 *
 * Full Atlas mode (`BALANCE_ATLAS=1` / `npm run balance:atlas`): sweeps all 64
 * weapons (8D behavioral uniqueness + MAP-Elites + Snowball trajectories), all
 * C(64,2) = 2,016 weapon pairs, all 208 evolutions, all 6 fighters × 64 weapons,
 * all 8 Arcana + 28 Arcana pairs, Covering-Array endgame builds, and all 59
 * campaign levels, writing `docs/balance-analytics.json`.
 */
import * as fs from 'fs';
import * as path from 'path';
import { benches, recipeLifts, synergy } from '@/adventure/balance/lab';
import {
  measureArcanaMatrix,
  measureFighterMatrix,
  measureGambleClashes,
  pressureBench,
  runFullBalanceAtlas,
  skewness,
  solveRidge,
} from '@/adventure/balance/analytics';
import { ALL_ARMORY_WEAPON_IDS } from '@/adventure/data/armory';
import { EVOLUTION_RECIPES } from '@/adventure/data/evolutions';

const FULL = !!process.env.BALANCE_ATLAS;
const SNAPSHOT_OUT = process.env.SNAPSHOT_OUT;
const DOCS = path.join(__dirname, '..', 'docs');

const STRUCTURAL_GAMBLE_PROBES: readonly (readonly [string, string])[] = [
  ['chain-gang', 'long-fuse'],
  ['greedy-chest', 'cursed-idol'],
  ['hot-potato', 'thorn-bush'],
  ['tar-pit', 'thorn-bush'],
  ['rust', 'greedy-chest'],
  ['ice-block', 'long-fuse'],
  ['fog-lantern', 'cursed-idol'],
  ['chain-gang', 'tar-pit'],
  ['decoy', 'twin-seed'],
  ['hot-potato', 'cursed-idol'],
  ['thorn-bush', 'long-fuse'],
  ['rust', 'ice-block'],
];

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

  it('builds a realistic World 4-5 pressure bench with Shading Surge, Set-Parry, and active hazards', () => {
    const pb = pressureBench();
    expect(pb.level.rules.shadingSurge).toBe(true);
    expect(pb.level.rules.hazards?.timeBombs).toBeDefined();
    expect(pb.level.rules.hazards?.snares).toBeDefined();
    expect(pb.level.foes[0].parry).toBeDefined();
    expect(pb.level.foes[0].parry).not.toBeNull();
    expect(pb.save.armory.length).toBe(ALL_ARMORY_WEAPON_IDS.length);
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
      expect({ id: r.id, ratio: r.ratio, ok: r.ratio >= 1.04 }).toEqual({ id: r.id, ratio: r.ratio, ok: true });
      if (!r.pair.includes('encore-mask')) {
        expect({ id: r.id, ratio: r.ratio, ok: r.ratio <= 2.6 }).toEqual({ id: r.id, ratio: r.ratio, ok: true });
      }
      expect({ id: r.id, ruleLift: r.ruleLift, ok: r.ruleLift >= 1.04 && r.ruleLift <= 1.85 }).toEqual({
        id: r.id,
        ruleLift: r.ruleLift,
        ok: true,
      });
      expect({ id: r.id, starts: r.starts, ok: r.starts >= 0.15 }).toEqual({ id: r.id, starts: r.starts, ok: true });
      expect({ id: r.id, deadRules: r.deadRules }).toEqual({ id: r.id, deadRules: [] });
    }
    // Chaos Shard + Understudy no longer hits 100% deterministic full-board ricochet wipe
    expect(synergy(late, 'chaos-shard', 'understudy', 'average', 6)).toBeLessThan(3.5);
  });

  it('has fighter pressure equity, viable survival, and no Corgi Zoomies self-sabotage', () => {
    // Regression guard: Corgi's Zoomies redeals every 3-5 Sets; Rust & Ice Block take 7 Sets to mature
    const fm = measureFighterMatrix(6, 4);
    const corgiRust = fm.cells.find(c => c.fighter === 'Corgi' && c.weaponId === 'rust')!;
    const corgiIce = fm.cells.find(c => c.fighter === 'Corgi' && c.weaponId === 'ice-block')!;
    const corgiChest = fm.cells.find(c => c.fighter === 'Corgi' && c.weaponId === 'greedy-chest')!;
    expect(corgiRust.weaponOnFighterLift).toBeGreaterThanOrEqual(1.0);
    expect(corgiIce.weaponOnFighterLift).toBeGreaterThanOrEqual(1.0);
    expect(corgiChest.weaponOnFighterLift).toBeGreaterThanOrEqual(1.0);

    // Fighter pressure equity: no fighter laps the weakest by >2.25×, and every fighter survives under pressure
    const pressLifts = fm.curves.map(c => c.pressure160Stars);
    const spread = Math.max(...pressLifts) / Math.max(0.01, Math.min(...pressLifts));
    expect(spread).toBeLessThanOrEqual(2.25);
    for (const c of fm.curves) {
      expect({ fighter: c.fighter, surv: c.pressureSurvival160, ok: c.pressureSurvival160 >= 0.3 }).toEqual({
        fighter: c.fighter,
        surv: c.pressureSurvival160,
        ok: true,
      });
    }
  }, 120_000);

  it('measures all 8 Arcana on a multi-wave XP/shop/recipe bench without dead or suicidal kiss-curse traps', () => {
    const am = measureArcanaMatrix(6);
    expect(am.solo).toHaveLength(8);
    expect(am.pairs).toHaveLength(28);
    const bad = am.solo
      .map(row => ({
        id: row.id,
        avgLift: Number(row.effectiveLiftAvg.toFixed(2)),
        expLift: Number(row.effectiveLiftExpert.toFixed(2)),
        avgSurv: Number(row.survivalRateAvg.toFixed(2)),
        expSurv: Number(row.survivalRateExpert.toFixed(2)),
        ok:
          Math.max(row.effectiveLiftAvg, row.effectiveLiftExpert) >= 1.02 &&
          row.effectiveLiftAvg >= 0.9 &&
          row.effectiveLiftAvg <= 1.75 &&
          row.survivalRateExpert >= 0.35,
      }))
      .filter(r => !r.ok);
    expect(bad).toEqual([]);
  }, 120_000);

  it('flags no undocumented catastrophic Gamble clashes under Pressure', () => {
    const rows = measureGambleClashes(4, FULL ? undefined : STRUCTURAL_GAMBLE_PROBES);
    const undocumentedSevere = rows.filter(
      r => !r.documented && (r.synergy < 0.7 || (r.survivalRate < 0.2 && r.survivalDelta <= -0.35))
    );
    expect(undocumentedSevere).toEqual([]);
  }, 120_000);
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

    const nWeapons = ALL_ARMORY_WEAPON_IDS.length;
    expect(atlas.weaponsSuite.weapons.length).toBe(nWeapons);
    expect(atlas.pairSuite.totalPairs).toBe((nWeapons * (nWeapons - 1)) / 2);
    expect(atlas.pairSuite.recipes.length).toBe(EVOLUTION_RECIPES.length);
    expect(atlas.fighterSuite.cells.length).toBe(6 * nWeapons);
    expect(atlas.arcanaSuite.solo.length).toBe(8);
    expect(atlas.arcanaSuite.pairs.length).toBe(28);
    expect(atlas.campaignSuite.levels.length).toBeGreaterThanOrEqual(50);
  }, 900_000);
});
