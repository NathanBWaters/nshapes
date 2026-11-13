/**
 * The balance lab's guardrails (src/adventure/balance, docs/balance-system.md).
 *
 * Every weapon is measured as a counterfactual on seeded fights (alone at
 * three stages and three skill tiers, and inside real builds) and judged
 * against the bands in balance/targets.ts. This suite fails on anything that
 * is overpowered for any tier, underpowered for all of them, a passenger, or
 * not worth a slot; and on a shrinking viable pool.
 *
 * BALANCE_REPORT=1 (npm run balance:report) also measures every recipe and
 * writes docs/balance-report.md and docs/balance-snapshot.json.
 */
import * as fs from 'fs';
import * as path from 'path';
import { benches, lift, play, synergy } from '@/adventure/balance/lab';
import { judge, measure, movers, renderMarkdown, snapshotOf, type BalanceReport, type Snapshot } from '@/adventure/balance/report';
import { BALANCE_TARGETS as T } from '@/adventure/balance/targets';
import { hasWeaponRole } from '@/adventure/data/weaponRoles';

const FULL = !!process.env.BALANCE_REPORT;
const DOCS = path.join(__dirname, '..', 'docs');

describe('the lab measures counterfactuals', () => {
  const b = benches();

  it('the same charms on the same seeds are the same fight; a weapon that does nothing is a passenger', () => {
    const a = play(b.early, ['blast-powder'], 'average', 4);
    const again = play(b.early, ['blast-powder'], 'average', 4);
    expect(again).toEqual(a);
    expect(lift(a, again)).toMatchObject({ ratio: 1, dead: 1, swing: 0 });
    const none = play(b.early, [], 'average', 4);
    expect(lift(a, none).ratio).toBeGreaterThan(1);
    expect(lift(a, none).dead).toBeLessThan(1);
  });

  it('three stages: more traits and better gear later', () => {
    expect([b.early, b.mid, b.late].map(x => x.level.rules.attributes.length)).toEqual([3, 4, 5]);
    for (const x of Object.values(b)) expect(x.save.armory.every(hasWeaponRole)).toBe(true);
  });

  it('synergy is 1 when two weapons simply add up, more when they feed each other', () => {
    const s = synergy(b.late, 'echo-stone', 'chain-reaction', 'average', 8);
    expect(Number.isFinite(s)).toBe(true);
    expect(s).toBeGreaterThan(0);
  });
});

describe('balance guardrails', () => {
  let report: BalanceReport;

  beforeAll(() => {
    report = judge(measure({ runs: FULL ? 14 : 8, builds: FULL ? 6 : 4, buildSize: 5, recipes: FULL }));
    if (!FULL) return;
    const file = path.join(DOCS, 'balance-snapshot.json');
    const before: Snapshot = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    const now = snapshotOf(report);
    fs.writeFileSync(path.join(DOCS, 'balance-report.md'), renderMarkdown(report, movers(now, before)));
    fs.writeFileSync(file, JSON.stringify(now, null, 1) + '\n');
  });

  const flagged = (kinds: string[]) => report.verdicts.filter(v => kinds.includes(v.kind)).map(v => `${v.kind}: ${v.id} (${v.detail})`);

  it('nothing is overpowered for any skill tier, at level 1, or inside a real build', () => {
    expect(flagged(['overpowered'])).toEqual([]);
  });

  it('nothing is underpowered for every skill tier, a passenger, or not worth its slot', () => {
    expect(flagged(['underpowered', 'passenger', 'no-slot-value'])).toEqual([]);
  });

  it('the viable pool is wide and there are several top picks', () => {
    expect(report.summary.viablePool).toBeGreaterThanOrEqual(T.viablePool);
    expect(report.summary.topPicks.length).toBeGreaterThanOrEqual(T.topPicksAtLeast);
    expect(report.summary.soloEarlyMean).toBeGreaterThanOrEqual(T.soloEarlyMean);
  });

  (FULL ? it : it.skip)('every evolution is in its band and the typical one is a power trip', () => {
    expect(flagged(['weak-recipe', 'runaway-recipe', 'rare-recipe'])).toEqual([]);
    expect(report.summary.recipeLiftMedian).toBeGreaterThanOrEqual(T.recipeLiftMedian);
  });
});
