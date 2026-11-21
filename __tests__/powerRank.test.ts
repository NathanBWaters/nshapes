import * as fs from 'fs';
import * as path from 'path';
import {
  CATEGORY_LENSES,
  compareItems,
  computePowerRankings,
  EMPIRICAL_BAYES_PRIOR_K,
  findItemInReport,
  renderPowerRankCompact,
  renderPowerRankMarkdown,
  type EvolutionEntryMeta,
  type LiveItemSignalLike,
  type PostHogSignalsInput,
  type PowerCategory,
  type WeaponEntryMeta,
} from '@/adventure/balance/powerRank';
import type { FullBalanceAtlasData } from '@/adventure/balance/analytics';
import type { Snapshot } from '@/adventure/balance/report';
import { BALANCE_ERA_MANIFEST } from '@/analytics/balanceEras';
import { analyzePostHogForBalance } from '@/analytics/posthogRules';

const DOCS = path.join(__dirname, '..', 'docs');
const SNAPSHOT: Snapshot = JSON.parse(fs.readFileSync(path.join(DOCS, 'balance-snapshot.json'), 'utf8'));
const ANALYTICS: FullBalanceAtlasData = JSON.parse(
  fs.readFileSync(path.join(DOCS, 'balance-analytics.json'), 'utf8')
);

const makeSignal = (
  category: PowerCategory,
  id: string,
  overrides: Partial<LiveItemSignalLike> = {}
): LiveItemSignalLike => ({
  id,
  category,
  validSince: '0.1.164',
  fights: 40,
  effectiveN: 30,
  uniquePlayers: 12,
  winRate: 0.65,
  expectedWinRate: 0.55,
  adjustedWinDelta: 0.1,
  liveLogLift: 0.35,
  liveLogLiftSE: 0.12,
  pickRate: 0.25,
  funRate: 0.78,
  funCount: 15,
  credibility: 'emerging',
  ...overrides,
});

describe('powerRank engine (1.00x weakest-anchored power rankings)', () => {
  it('enforces the 1.00x weakest floor, finite positive multipliers, and descending rank order across every category and sub-lens', () => {
    const categories: PowerCategory[] = ['weapons', 'evolutions', 'fighters', 'arcana'];
    for (const cat of categories) {
      for (const lens of CATEGORY_LENSES[cat]) {
        const report = computePowerRankings({
          snapshot: SNAPSHOT,
          analytics: ANALYTICS,
          lenses: { [cat]: lens },
        });
        const cr = report.categories[cat];
        expect(cr.entries.length).toBeGreaterThan(0);

        const weakest = cr.entries[cr.entries.length - 1];
        const strongest = cr.entries[0];
        expect(weakest.powerMult).toBeCloseTo(1.0, 4);
        expect(strongest.powerMult).toBeGreaterThanOrEqual(1.0);
        expect(cr.weakestId).toBe(weakest.id);
        expect(cr.strongestId).toBe(strongest.id);

        for (let i = 0; i < cr.entries.length; i++) {
          const e = cr.entries[i];
          expect(e.rank).toBe(i + 1);
          expect(Number.isFinite(e.powerMult)).toBe(true);
          expect(e.powerMult).toBeGreaterThanOrEqual(1.0);
          expect(Number.isFinite(e.simMult)).toBe(true);
          expect(e.simMult).toBeGreaterThanOrEqual(1.0);
          if (i > 0) {
            expect(e.powerMult).toBeLessThanOrEqual(cr.entries[i - 1].powerMult + 1e-9);
          }
          if (cr.minRawBlended >= 1.05) {
            expect(e.addedMult).not.toBeNull();
            expect(e.addedMult!).toBeGreaterThanOrEqual(1.0);
          } else {
            expect(e.addedMult).toBeNull();
          }
        }
        if (cr.minRawBlended >= 1.05) {
          expect(weakest.addedMult).toBeCloseTo(1.0, 4);
        }
      }
    }
  });

  it('scores all 64 weapons, 208 evolutions, 6 fighters, and 8 arcana with expected sanity anchors', () => {
    const report = computePowerRankings({ snapshot: SNAPSHOT, analytics: ANALYTICS });
    expect(report.categories.weapons.count).toBe(64);
    expect(report.categories.evolutions.count).toBe(208);
    expect(report.categories.fighters.count).toBe(6);
    expect(report.categories.arcana.count).toBe(8);

    // Weapon role rollups cover all 8 shelves and sum to 64
    const rollups = report.categories.weapons.roleRollups ?? [];
    expect(rollups.length).toBe(8);
    expect(rollups.reduce((s, r) => s + r.count, 0)).toBe(64);

    // Real-data sanity: Blast Powder leads composite weapons, Corgi leads composite fighters
    expect(report.categories.weapons.strongestId).toBe('blast-powder');
    expect(report.categories.fighters.strongestId).toBe('Corgi');
    expect(report.categories.fighters.weakestId).toBe('Orange Tabby');
    // Shapley lens has minRaw < 1.05, so addedMult must safely be null
    const shapReport = computePowerRankings({
      snapshot: SNAPSHOT,
      analytics: ANALYTICS,
      lenses: { weapons: 'shapley', fighters: 'fullBuild' },
    });
    expect(shapReport.categories.weapons.entries[0].addedMult).toBeNull();
    expect(shapReport.categories.fighters.entries[0].addedMult).toBeNull();
    expect(shapReport.categories.fighters.strongestId).toBe('Pelican');
  });

  it('treats partner-only weapons (understudy, encore-mask) fairly in composite while keeping raw solo honest', () => {
    const comp = computePowerRankings({ snapshot: SNAPSHOT, analytics: ANALYTICS });
    const understudy = comp.categories.weapons.entries.find(e => e.id === 'understudy')!;
    const encoreMask = comp.categories.weapons.entries.find(e => e.id === 'encore-mask')!;

    expect((understudy.meta as WeaponEntryMeta).partner).toBe(true);
    expect((encoreMask.meta as WeaponEntryMeta).partner).toBe(true);
    // Neither should be artificially pinned at 1.00x / #64 due to solo=1.00
    expect(understudy.powerMult).toBeGreaterThan(1.0);
    expect(encoreMask.powerMult).toBeGreaterThan(1.0);
    expect(understudy.rank).toBeLessThan(64);
    expect(encoreMask.rank).toBeLessThan(64);

    // Raw solo lens remains honest (1.00x)
    const solo = computePowerRankings({
      snapshot: SNAPSHOT,
      analytics: ANALYTICS,
      lenses: { weapons: 'solo' },
    });
    expect(solo.categories.weapons.entries.find(e => e.id === 'understudy')!.powerMult).toBeCloseTo(1.0, 4);
    expect(solo.categories.weapons.entries.find(e => e.id === 'encore-mask')!.powerMult).toBeCloseTo(1.0, 4);
  });

  it('fixes the Encore Mask evolution denominator artifact so standing-ovation does not dominate E7 rankings', () => {
    const report = computePowerRankings({ snapshot: SNAPSHOT, analytics: ANALYTICS });
    const evos = report.categories.evolutions.entries;
    const encoreIds = ['standing-ovation', 'second-act', 'curtain-of-gold'];

    expect(report.medianChassisLift).toBeGreaterThan(1.1);
    expect(report.medianChassisLift).toBeLessThan(1.3);

    for (const id of encoreIds) {
      const e = evos.find(x => x.id === id)!;
      const m = e.meta as EvolutionEntryMeta;
      expect(m.hasEncoreFix).toBe(true);
      expect(m.rawTotalLift).toBeGreaterThan(3.0);
      expect(m.cleanTotalLift).toBeCloseTo(m.ruleLift * report.medianChassisLift, 2);
      // Should sit honestly in the middle/lower pack, never inflating into Top 25
      expect(e.rank).toBeGreaterThan(25);
    }
  });

  it('blends PostHog telemetry via Empirical Bayes shrinkage monotonically and preserves 1.00x anchoring', () => {
    const targetId = 'fortunes-favor'; // weakest weapon in sim (1.00x)
    const simOnly = computePowerRankings({ snapshot: SNAPSHOT, analytics: ANALYTICS });
    const simEntry = simOnly.categories.weapons.entries.find(e => e.id === targetId)!;

    // n = 0 => exact identity with simulation prior
    const zeroReport = computePowerRankings({
      snapshot: SNAPSHOT,
      analytics: ANALYTICS,
      posthog: {
        weapons: [makeSignal('weapons', targetId, { fights: 0, effectiveN: 0, liveLogLift: 0.9, credibility: 'sim_only' })],
      },
    });
    const zeroEntry = zeroReport.categories.weapons.entries.find(e => e.id === targetId)!;
    expect(zeroEntry.liveWeight).toBe(0);
    expect(zeroEntry.rawBlendedIndex).toBeCloseTo(simEntry.rawSimIndex, 4);
    expect(zeroEntry.powerMult).toBeCloseTo(simEntry.powerMult, 4);
    expect(zeroEntry.ciLow).toBeNull();

    // Monotonicity as effectiveN grows: 10 -> 30 (exact 0.5 weight) -> 120 (0.8 weight)
    const samples = [10, EMPIRICAL_BAYES_PRIOR_K, 120].map(n => {
      const rep = computePowerRankings({
        snapshot: SNAPSHOT,
        analytics: ANALYTICS,
        posthog: {
          weapons: [makeSignal('weapons', targetId, { fights: n, effectiveN: n, liveLogLift: 0.5 })],
        },
      });
      // Weakest item after re-anchoring is still exactly 1.00x
      const last = rep.categories.weapons.entries[rep.categories.weapons.entries.length - 1];
      expect(last.powerMult).toBeCloseTo(1.0, 4);
      return rep.categories.weapons.entries.find(e => e.id === targetId)!;
    });

    expect(samples[0].liveWeight).toBeCloseTo(10 / 40, 4);
    expect(samples[1].liveWeight).toBeCloseTo(0.5, 4);
    expect(samples[2].liveWeight).toBeCloseTo(120 / 150, 4);

    expect(samples[0].rawBlendedIndex).toBeGreaterThan(simEntry.rawSimIndex);
    expect(samples[1].rawBlendedIndex).toBeGreaterThan(samples[0].rawBlendedIndex);
    expect(samples[2].rawBlendedIndex).toBeGreaterThan(samples[1].rawBlendedIndex);
    expect(samples[1].ciLow).not.toBeNull();
    expect(samples[1].ciHigh!).toBeGreaterThan(samples[1].powerMult);
    expect(samples[1].ciLow!).toBeLessThan(samples[1].powerMult);
  });

  it('triggers BOT_BLIND_SLEEPER, BOT_FAVORED_TRAP, FUN_POWER_GAP, and STALE_DATA alerts cleanly', () => {
    const posthog: PostHogSignalsInput = {
      ledger: {
        totalRaw: 100,
        deduped: 0,
        ratedFolds: 0,
        kept: 0,
        droppedByVersion: 100,
        droppedByEnv: 0,
        droppedByMode: 0,
        droppedByPractice: 0,
        droppedByBug: 0,
        droppedByShort: 0,
        droppedByCoached: 0,
        activeMinVersion: '0.1.164',
        currentEraId: 'E8',
      },
      weapons: [
        // Weak in sim, strong in live -> BOT_BLIND_SLEEPER + crowd pleaser FUN_POWER_GAP
        makeSignal('weapons', 'fortunes-favor', {
          effectiveN: 25,
          liveLogLift: 0.45,
          funRate: 0.92,
          funCount: 20,
        }),
        // Strong in sim, weak in live -> BOT_FAVORED_TRAP + high-power low-fun FUN_POWER_GAP
        makeSignal('weapons', 'blast-powder', {
          effectiveN: 30,
          liveLogLift: -0.35,
          funRate: 0.35,
          funCount: 20,
        }),
      ],
    };

    const report = computePowerRankings({ snapshot: SNAPSHOT, analytics: ANALYTICS, posthog });
    const ffAlerts = report.categories.weapons.entries.find(e => e.id === 'fortunes-favor')!.alerts;
    const bpAlerts = report.categories.weapons.entries.find(e => e.id === 'blast-powder')!.alerts;

    expect(ffAlerts.some(a => a.kind === 'BOT_BLIND_SLEEPER')).toBe(true);
    expect(bpAlerts.some(a => a.kind === 'BOT_FAVORED_TRAP')).toBe(true);
    expect(bpAlerts.some(a => a.kind === 'FUN_POWER_GAP')).toBe(true);
    expect(report.alerts.some(a => a.kind === 'STALE_DATA' && a.severity === 'warn')).toBe(true);
  });

  it('supports fuzzy item lookup, head-to-head comparison, and markdown/compact rendering', () => {
    const report = computePowerRankings({ snapshot: SNAPSHOT, analytics: ANALYTICS });
    expect(findItemInReport(report, 'Blast Powder')?.id).toBe('blast-powder');
    expect(findItemInReport(report, 'orange tabby')?.id).toBe('Orange Tabby');

    const cmp = compareItems(report, 'blast-powder', 'fortunes-favor');
    expect(cmp).not.toBeNull();
    expect(cmp!.ratioAOverB).toBeGreaterThan(1.5);
    expect(cmp!.rankDelta).toBeGreaterThan(50);

    const md = renderPowerRankMarkdown(report, { includeArcana: true, includeAllEvolutions: true });
    expect(md).toContain('# NShapes Power Rankings');
    expect(md).toContain('## Weapons');
    expect(md).toContain('## Evolutions');
    expect(md).toContain('## Fighters');
    expect(md).toContain('## Arcana');
    expect(md).toContain('Blast Powder');
    expect(md).toContain('Complete All 208 Evolutions Ranked');

    const compact = renderPowerRankCompact(report, { top: 5, bottom: 3 });
    expect(compact).toContain('[WEAPONS');
    expect(compact).toContain('[EVOLUTIONS');
    expect(compact).toContain('[FIGHTERS');
  });

  it('integrates end-to-end with analyzePostHogForBalance, excluding stale-era fights while blending valid current-era fights', () => {
    const curVer = BALANCE_ERA_MANIFEST.currentAppVersion;
    const rawEvents: Record<string, unknown>[] = [];

    // 10 stale pre-E8 fights that must be excluded by version-era rules
    for (let i = 0; i < 10; i++) {
      rawEvents.push({
        event: 'fight_ended',
        distinct_id: `old-${i}`,
        timestamp: '2026-11-18T12:00:00Z',
        properties: {
          fight_id: `old-${i}`,
          app_version: '0.1.158',
          env: 'prod',
          mode: 'adventure',
          level_id: '2-3',
          fighter: 'Orange Tabby',
          outcome: 'won',
          sets: 12,
          duration_ms: 80_000,
          dpm: 900,
          weapons: ['fortunes-favor'],
        },
      });
    }

    // 40 valid current-era fights across 10 players with varied weapons/fighters
    for (let i = 0; i < 40; i++) {
      const won = i % 2 === 0;
      rawEvents.push({
        event: 'fight_ended',
        distinct_id: `p-${i % 10}`,
        timestamp: `2026-11-21T18:${String(i).padStart(2, '0')}:00Z`,
        properties: {
          fight_id: `cur-${i}`,
          app_version: curVer,
          env: 'prod',
          mode: 'adventure',
          level_id: '2-3',
          fighter: won ? 'Pelican' : 'Orange Tabby',
          outcome: won ? 'won' : 'lost',
          sets: 14,
          duration_ms: 90_000,
          dpm: won ? 600 : 240,
          weapons: won ? ['blast-powder', 'chrono-shard'] : ['fortunes-favor', 'life-vessel'],
          evolutions: won ? 1 : 0,
          evolutions_forged: won ? ['phoenix-pyre'] : [],
          fun_rating: won ? 'up' : 'down',
        },
      });
    }

    const signals = analyzePostHogForBalance(rawEvents, { mode: 'adventure' });
    expect(signals.audit.droppedByVersion).toBe(10);
    expect(signals.audit.kept).toBe(40);

    const blended = computePowerRankings({ snapshot: SNAPSHOT, analytics: ANALYTICS, posthog: signals });
    expect(blended.hasLiveData).toBe(true);
    expect(blended.auditLedger?.kept).toBe(40);
    expect(blended.auditLedger?.droppedByVersion).toBe(10);

    // Pelican won all 20 fights vs Orange Tabby losing 20 -> Pelican liveMult should beat Orange Tabby
    const pelican = blended.categories.fighters.entries.find(e => e.id === 'Pelican')!;
    const tabby = blended.categories.fighters.entries.find(e => e.id === 'Orange Tabby')!;
    expect(pelican.fights).toBe(20);
    expect(tabby.fights).toBe(20);
    expect(pelican.liveMult!).toBeGreaterThan(tabby.liveMult!);
    // Weakest fighter remains strictly anchored at 1.00x
    expect(blended.categories.fighters.entries[blended.categories.fighters.entries.length - 1].powerMult).toBeCloseTo(
      1.0,
      4
    );
  });
});
