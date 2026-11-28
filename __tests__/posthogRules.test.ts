import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  BALANCE_ERAS,
  CURRENT_BALANCE_ERA,
  getMinValidVersion,
  nextPatchVersion,
  type BalanceEra,
} from '@/analytics/balanceEras';
import {
  analyzeFights,
  generateSimulatedCohort,
  parseAnalyticsImportJson,
} from '@/analytics/dashboardEngine';
import { __enableAnalyticsForTests, analyticsEnabled } from '@/analytics/posthog';
import { POSTHOG_DASHBOARDS } from '@/analytics/posthogDashboards';
import {
  analyzePostHogForBalance,
  buildHogqlBalanceHygieneWhere,
  buildHogqlVersionClause,
  classifyCredibility,
  filterFightEvents,
  isLikelyE2eBotFight,
} from '@/analytics/posthogRules';
import { loadLocalEnv } from '../scripts/lib/loadEnv';

const CURRENT_ADV_MIN = getMinValidVersion('all', undefined, 'adventure');
const NEXT_PATCH_VER = nextPatchVersion(CURRENT_ADV_MIN);

const makeEvent = (overrides: Record<string, unknown> = {}, topOverrides: Record<string, unknown> = {}) => ({
  event: 'fight_ended',
  distinct_id: 'player-1',
  timestamp: '2026-11-21T18:00:00.000Z',
  ...topOverrides,
  properties: {
    fight_id: `fight-${Math.random().toString(36).slice(2)}`,
    app_version: CURRENT_ADV_MIN,
    env: 'prod',
    mode: 'adventure',
    level_id: '2-3',
    world: 2,
    practice: false,
    fighter: 'Corgi',
    outcome: 'won',
    duration_ms: 90_000,
    damage: 180,
    dpm: 120,
    sets: 12,
    mistakes: 1,
    helped_sets: 0,
    median_find_ms: 4200,
    evolutions: 0,
    evolutions_forged: [],
    weapons: ['blast-powder', 'flint-spark'],
    weapons_offered: ['blast-powder', 'chrono-shard'],
    weapons_picked: ['blast-powder'],
    weapons_bought: [],
    arcana: [],
    fun_rating: 'up',
    fun_tags: [],
    ...overrides,
  },
});

describe('posthogRules filtering, hygiene & audit ledger', () => {
  it('enforces version, env, mode, practice, bug_in_game, short, coached, dedup & fight_rated folding', () => {
    const events: Record<string, unknown>[] = [
      // 1. Valid prod E8 event (with legacy weapon ID to normalize)
      makeEvent({
        fight_id: 'f-valid-1',
        weapons: ['blast-powder-rare', 'flint-spark'],
        fun_rating: null,
        fun_tags: [],
      }),
      // Duplicate of f-valid-1 (should dedup)
      makeEvent(
        {
          fight_id: 'f-valid-1',
          weapons: ['blast-powder-rare', 'flint-spark'],
          fun_rating: null,
        },
        { timestamp: '2026-11-21T18:00:05.000Z' }
      ),
      // Retrospective fight_rated for f-valid-1
      {
        event: 'fight_rated',
        distinct_id: 'player-1',
        timestamp: '2026-11-21T18:05:00.000Z',
        properties: { fight_id: 'f-valid-1', fun_rating: 'up', fun_tags: ['great_build'] },
      },
      // 2. Dropped by stale version (0.1.163 < 0.1.164)
      makeEvent({ fight_id: 'f-stale', app_version: '0.1.163' }),
      // 3. Dropped by stale version lexicographic trap (0.1.99 < 0.1.164)
      makeEvent({ fight_id: 'f-lex-stale', app_version: '0.1.99' }),
      // 4. Dropped by env=dev
      makeEvent({ fight_id: 'f-dev', env: 'dev' }),
      // 5. Dropped by mode=spire when analyzing adventure
      makeEvent({ fight_id: 'f-spire', mode: 'spire', level_id: 'spire-1-1' }),
      // 6. Dropped by practice=true
      makeEvent({ fight_id: 'f-practice', practice: true, outcome: 'practice' }),
      // 7. Dropped by bug_in_game tag (folded via retrospective fight_rated!)
      makeEvent({ fight_id: 'f-bug', fun_tags: [] }),
      {
        event: 'fight_rated',
        distinct_id: 'player-1',
        timestamp: '2026-11-21T18:06:00.000Z',
        properties: { fight_id: 'f-bug', fun_rating: 'down', fun_tags: ['bug_in_game'] },
      },
      // 8. Dropped by short fight (sets < 3)
      makeEvent({ fight_id: 'f-short-sets', sets: 2, duration_ms: 40_000 }),
      // 9. Dropped by short duration (< 10s)
      makeEvent({ fight_id: 'f-short-dur', sets: 5, duration_ms: 8_000 }),
      // 10. Dropped by tutorial 1-1
      makeEvent({ fight_id: 'f-tut', level_id: '1-1', world: 1 }),
      // 11. Dropped by heavy coaching (> 50% helped sets)
      makeEvent({ fight_id: 'f-coached', level_id: '1-3', sets: 8, helped_sets: 5 }),
    ];

    const { fights, audit } = filterFightEvents(events, { mode: 'adventure', eraId: 'current' });
    expect(fights).toHaveLength(1);
    expect(fights[0].fightId).toBe('f-valid-1');
    expect(fights[0].weapons).toEqual(['blast-powder', 'flint-spark']); // legacy normalized
    expect(fights[0].funRating).toBe('up');
    expect(fights[0].funTags).toEqual(['great_build']);

    expect(audit.deduped).toBe(1);
    expect(audit.ratedFolds).toBe(2);
    expect(audit.kept).toBe(1);
    expect(audit.droppedByVersion).toBe(2);
    expect(audit.droppedByEnv).toBe(1);
    expect(audit.droppedByMode).toBe(1);
    expect(audit.droppedByPractice).toBe(1);
    expect(audit.droppedByE2eBot).toBe(0);
    expect(audit.droppedByBug).toBe(1);
    expect(audit.droppedByShort).toBe(2);
    expect(audit.droppedByCoached).toBe(2);
    expect(audit.activeMinVersion).toBe(CURRENT_ADV_MIN);
  });

  it('applies per-item minValidVersion so only updated items discard pre-patch data', () => {
    const customEras: BalanceEra[] = [
      ...BALANCE_ERAS,
      {
        id: `E${BALANCE_ERAS.length}`,
        minVersion: NEXT_PATCH_VER,
        date: '2026-11-22',
        commit: 'abc1234',
        summary: 'Tweak chrono-shard only',
        scope: 'item',
        invalidated: { weapons: ['chrono-shard'] },
      },
    ];

    const events: Record<string, unknown>[] = [];
    for (let i = 0; i < 6; i++) {
      // Pre-patch fights: valid for blast-powder, INVALID for chrono-shard
      events.push(
        makeEvent(
          {
            fight_id: `vpre-${i}`,
            app_version: CURRENT_ADV_MIN,
            weapons: ['blast-powder', 'chrono-shard'],
            outcome: 'lost',
          },
          { distinct_id: `p-${i}` }
        )
      );
      // Post-patch fights: valid for BOTH
      events.push(
        makeEvent(
          {
            fight_id: `vpost-${i}`,
            app_version: NEXT_PATCH_VER,
            weapons: ['blast-powder', 'chrono-shard'],
            outcome: 'won',
          },
          { distinct_id: `p-${i + 10}` }
        )
      );
    }

    const signals = analyzePostHogForBalance(events, {
      mode: 'adventure',
      eraId: 'current',
      eras: customEras,
      usePerItemMinVersion: true,
    });

    expect(signals.weapons['blast-powder'].validSince).toBe(CURRENT_ADV_MIN);
    expect(signals.weapons['blast-powder'].fights).toBe(12);
    expect(signals.weapons['chrono-shard'].validSince).toBe(NEXT_PATCH_VER);
    expect(signals.weapons['chrono-shard'].fights).toBe(6);
    expect(signals.weapons['chrono-shard'].winRate).toBe(1);
  });

  it('caps single-player dominance, controls evolution survivorship, and debiases co-occurrence via Ridge', () => {
    // 1. Single player grinding 60 runs must stay exploratory (uniquePlayers === 1)
    const spamEvents = Array.from({ length: 60 }, (_, i) =>
      makeEvent({ fight_id: `spam-${i}`, weapons: ['war-drum'] }, { distinct_id: 'one-grinder' })
    );
    const spamSig = analyzePostHogForBalance(spamEvents, { mode: 'adventure' });
    expect(spamSig.weapons['war-drum'].uniquePlayers).toBe(1);
    expect(spamSig.weapons['war-drum'].credibility).toBe('exploratory');
    expect(classifyCredibility(60, 12)).toBe('credible');
    expect(classifyCredibility(20, 6)).toBe('emerging');
    expect(classifyCredibility(0, 0)).toBe('sim_only');

    // 2. Co-occurrence Ridge debiasing + Evolution survivorship control (N = 120 decided fights)
    const events: Record<string, unknown>[] = [];
    for (let i = 0; i < 120; i++) {
      const pid = `player-${i % 24}`;
      const hasCarry = i % 2 === 0;
      // Passenger rides along with carry 75% of the time, and with weak weapon 25% of the time
      const hasPassenger = (hasCarry && i % 4 !== 0) || (!hasCarry && i % 8 === 1);
      const weapons = [hasCarry ? 'carry-sword' : 'weak-twig'];
      if (hasPassenger) weapons.push('passenger-charm');

      // True causal effect: carry-sword wins 90% @ 220 DPM; weak-twig wins 20% @ 80 DPM; passenger adds 0
      const won = hasCarry ? i % 10 !== 0 : i % 5 === 0;
      const dpm = hasCarry ? 220 : 80;

      // Evolution cohort: only wins >= 50% forged evolutions; strong-evo wins 95% within cohort, weak-evo wins 50%
      const forged = i < 60;
      const isStrongEvo = forged && i % 2 === 0;
      const evoOutcome = forged ? (isStrongEvo ? (i % 20 !== 0 ? 'won' : 'lost') : i % 4 === 0 ? 'won' : 'lost') : won ? 'won' : 'lost';

      events.push(
        makeEvent(
          {
            fight_id: `ridge-${i}`,
            level_id: i % 3 === 0 ? '3-2' : '2-4',
            weapons,
            outcome: forged ? evoOutcome : won ? 'won' : 'lost',
            dpm: forged ? (isStrongEvo ? 260 : 120) : dpm,
            evolutions: forged ? 1 : 0,
            evolutions_forged: forged ? [isStrongEvo ? 'strong-evo' : 'weak-evo'] : [],
            fighter: i % 2 === 0 ? 'Corgi' : 'Badger',
          },
          { distinct_id: pid }
        )
      );
    }

    const sig = analyzePostHogForBalance(events, { mode: 'adventure' });
    expect(sig.ridgeUsed).toBe(true);
    expect(sig.decidedFights).toBe(120);
    expect(sig.evolutionCohortFights).toBe(60);

    // Carry beats passenger decisively in Ridge even though passenger co-occurs heavily with carry
    const carry = sig.weapons['carry-sword'];
    const passenger = sig.weapons['passenger-charm'];
    const weak = sig.weapons['weak-twig'];
    expect(carry.ridgeWinDelta).not.toBeNull();
    expect(carry.liveLogLift).toBeGreaterThan(passenger.liveLogLift);
    expect(carry.liveLogLift).toBeGreaterThan(weak.liveLogLift);
    expect(Math.abs(passenger.ridgeWinDelta ?? 1)).toBeLessThan(Math.abs(carry.ridgeWinDelta ?? 0));

    // Evolution survivorship: weak-evo is benchmarked against evo cohort, so its adjusted delta is negative!
    expect(sig.evolutions['strong-evo'].adjustedWinDelta!).toBeGreaterThan(0);
    expect(sig.evolutions['weak-evo'].adjustedWinDelta!).toBeLessThan(0);
  });

  it('tracks equipped_evolutions, peak_base_damage, synergy_score_total, and per-weapon evolution triggerRate', () => {
    const events: Record<string, unknown>[] = [];
    for (let i = 0; i < 10; i++) {
      const triggered = i < 6;
      events.push(
        makeEvent(
          {
            fight_id: `evo-rate-${i}`,
            weapons: ['blast-powder', 'flint-spark'],
            equipped_evolutions: ['blast-powder:cluster-charge', 'flint-spark:cinder-trail'],
            evolutions: triggered ? 1 : 0,
            weapon_evos_triggered: triggered ? 1 : 0,
            evolutions_forged: triggered ? ['blast-powder:cluster-charge'] : [],
            peak_base_damage: 42 + i * 3,
            synergy_score_total: 120 + i * 10,
            outcome: triggered ? 'won' : 'lost',
          },
          { distinct_id: `evo-p-${i}` }
        )
      );
    }

    const { fights } = filterFightEvents(events, { mode: 'adventure', eraId: 'current' });
    expect(fights).toHaveLength(10);
    expect(fights[0].equippedEvolutions).toEqual({
      'blast-powder': 'blast-powder:cluster-charge',
      'flint-spark': 'flint-spark:cinder-trail',
    });
    expect(fights[0].peakBaseDamage).toBe(42);
    expect(fights[0].synergyScoreTotal).toBe(120);

    const sig = analyzePostHogForBalance(events, { mode: 'adventure', eraId: 'current' });
    expect(sig.evolutions['blast-powder:cluster-charge']?.fights).toBe(6);
    expect(sig.evolutions['blast-powder:cluster-charge']?.triggerRate).toBeCloseTo(0.6, 2);
  });

  it('builds safe HogQL numeric semver and balance hygiene SQL clauses', () => {
    const verSql = buildHogqlVersionClause('0.1.164');
    expect(verSql).toContain('>= 1164');
    expect(verSql).toContain('splitByChar');
    expect(verSql).toContain('arrayElement');

    const whereSql = buildHogqlBalanceHygieneWhere({ mode: 'adventure', minVersion: '0.1.164', decidedOnly: true });
    expect(whereSql).toContain("event = 'fight_ended'");
    expect(whereSql).toContain("= 'prod'");
    expect(whereSql).toContain("= 'adventure'");
    expect(whereSql).not.toContain('toBool(');
    expect(whereSql).toContain('bug_in_game');
    expect(whereSql).toContain("!= '1-1'");
    expect(whereSql).toContain('helped_sets');
    expect(whereSql).toContain("IN ('won', 'survived', 'lost')");

    // Verify every HogQL tile avoids ClickHouse/HogQL pitfalls: no toBool(), no toInt32OrZero/Null, no OFFSET, no unguarded log(0), LEFT JOIN before ARRAY JOIN, no cyclic ARRAY JOIN alias
    for (const dash of POSTHOG_DASHBOARDS) {
      for (const tile of dash.tiles) {
        expect(tile.hogql).not.toContain('toBool(');
        expect(tile.hogql).not.toContain('toInt32OrZero(');
        expect(tile.hogql).not.toContain('toInt32OrNull(');
        expect(tile.hogql).not.toMatch(/\bOFFSET\b/i);
        expect(tile.hogql).not.toMatch(/avgIf\(log\(toFloat64/);
        const arrayJoinIdx = tile.hogql.lastIndexOf('ARRAY JOIN');
        const leftJoinIdx = tile.hogql.lastIndexOf('LEFT JOIN');
        if (arrayJoinIdx >= 0 && leftJoinIdx >= 0 && !tile.hogql.includes('WITH offers')) {
          expect(leftJoinIdx).toBeLessThan(arrayJoinIdx);
        }
        expect(tile.hogql).not.toMatch(/trim\(BOTH '"' FROM (\w+)\) AS \1\b/);
      }
    }

    // Also guard source files against unsupported HogQL casts & OFFSET pagination
    const rootDir = path.resolve(__dirname, '..');
    for (const rel of [
      'src/analytics/posthogDashboards.ts',
      'src/analytics/posthogRules.ts',
      'scripts/lib/posthogFetch.ts',
    ]) {
      const src = fs.readFileSync(path.join(rootDir, rel), 'utf8');
      expect(src).not.toContain('toInt32OrZero(');
      expect(src).not.toContain('toInt32OrNull(');
      if (rel === 'scripts/lib/posthogFetch.ts') {
        expect(src).not.toMatch(/^\s*OFFSET\s+/m);
      }
    }
  });

  it('enforces exact <=25% maxPlayerWeightShare via iterative water-filling', () => {
    // 1 grinder with 100 wins + 4 casuals with 1 loss each: grinder must be capped to exact 25% share!
    const events: Record<string, unknown>[] = [];
    for (let i = 0; i < 100; i++) {
      events.push(
        makeEvent(
          { fight_id: `grinder-${i}`, weapons: ['war-drum'], outcome: 'won', dpm: 200 },
          { distinct_id: 'grinder' }
        )
      );
    }
    for (let i = 0; i < 4; i++) {
      events.push(
        makeEvent(
          { fight_id: `casual-${i}`, weapons: ['war-drum'], outcome: 'lost', dpm: 100 },
          { distinct_id: `casual-${i}` }
        )
      );
    }
    const sig = analyzePostHogForBalance(events, { mode: 'adventure', maxPlayerWeightShare: 0.25 });
    const drum = sig.weapons['war-drum'];
    expect(drum.uniquePlayers).toBe(5);
    expect(drum.fights).toBe(104);
    expect(drum.winRate).toBeCloseTo(0.25, 3);
  });

  it('preserves historical items under --era all / explicit eraId and isolates pre-patch Ridge features', () => {
    // Historical E5 events (0.1.154): must NOT be silently dropped when eraId='all' or 'E5'
    const e5Events = Array.from({ length: 10 }, (_, i) =>
      makeEvent(
        {
          fight_id: `e5-${i}`,
          app_version: '0.1.154',
          weapons: ['blast-powder', 'flint-spark'],
          fighter: 'Badger',
          evolutions: 1,
          evolutions_forged: ['phoenix-pyre'],
          outcome: i < 7 ? 'won' : 'lost',
        },
        { distinct_id: `hist-p-${i}` }
      )
    );
    const allEraSig = analyzePostHogForBalance(e5Events, { mode: 'adventure', eraId: 'all' });
    expect(allEraSig.audit.kept).toBe(10);
    expect(allEraSig.weapons['blast-powder']?.fights).toBe(10);
    expect(allEraSig.fighters['Badger']?.fights).toBe(10);
    expect(allEraSig.evolutions['phoenix-pyre']?.fights).toBe(10);

    const e5Sig = analyzePostHogForBalance(e5Events, { mode: 'adventure', eraId: 'E5' });
    expect(e5Sig.audit.kept).toBe(10);
    expect(e5Sig.weapons['blast-powder']?.fights).toBe(10);

    // Granular item patch at NEXT_PATCH_VER: stale pre-patch chrono-shard fights must NOT contaminate Ridge
    const customEras: BalanceEra[] = [
      ...BALANCE_ERAS,
      {
        id: `E${BALANCE_ERAS.length}`,
        minVersion: NEXT_PATCH_VER,
        date: '2026-11-22',
        commit: 'testridge',
        summary: 'Huge buff to chrono-shard',
        scope: 'item',
        invalidated: { weapons: ['chrono-shard'] },
      },
    ];
    const mixed: Record<string, unknown>[] = [];
    // 60 stale pre-patch fights where chrono-shard loses 100%, blast-powder wins 50%
    for (let i = 0; i < 60; i++) {
      const hasChrono = i < 30;
      mixed.push(
        makeEvent(
          {
            fight_id: `pre-${i}`,
            app_version: CURRENT_ADV_MIN,
            weapons: hasChrono ? ['chrono-shard', 'blast-powder'] : ['blast-powder', 'flint-spark'],
            outcome: hasChrono ? 'lost' : 'won',
            dpm: hasChrono ? 60 : 180,
          },
          { distinct_id: `p-${i % 20}` }
        )
      );
    }
    // 40 post-buff fights where chrono-shard wins 100%
    for (let i = 0; i < 40; i++) {
      const hasChrono = i < 20;
      mixed.push(
        makeEvent(
          {
            fight_id: `post-${i}`,
            app_version: NEXT_PATCH_VER,
            weapons: hasChrono ? ['chrono-shard', 'blast-powder'] : ['blast-powder', 'flint-spark'],
            outcome: hasChrono ? 'won' : 'lost',
            dpm: hasChrono ? 240 : 100,
          },
          { distinct_id: `p-${i % 20}` }
        )
      );
    }
    const ridgeSig = analyzePostHogForBalance(mixed, {
      mode: 'adventure',
      eraId: 'current',
      eras: customEras,
    });
    expect(ridgeSig.ridgeUsed).toBe(true);
    expect(ridgeSig.weapons['chrono-shard'].fights).toBe(20);
    expect(ridgeSig.weapons['chrono-shard'].winRate).toBe(1);
    expect(ridgeSig.weapons['chrono-shard'].ridgeWinDelta!).toBeGreaterThan(0.15);
  });
});

describe('dashboardEngine parser & filter upgrades', () => {
  it('parses NDJSON and PostHog HogQL { columns, results } tabular payloads with dedup & fight_rated folding', () => {
    const ndjson = [
      JSON.stringify({
        event: 'fight_ended',
        distinct_id: 'u1',
        timestamp: '2026-11-21T18:00:00.000Z',
        properties: { fight_id: 'nd-1', app_version: '0.1.164', env: 'prod', mode: 'adventure', level_id: '2-1', outcome: 'won', sets: 10, duration_ms: 45_000, weapons: ['blast-powder-rare'] },
      }),
      JSON.stringify({
        event: 'fight_rated',
        distinct_id: 'u1',
        timestamp: '2026-11-21T18:02:00.000Z',
        properties: { fight_id: 'nd-1', fun_rating: 'up', fun_tags: ['close_call'] },
      }),
    ].join('\n');

    const parsedNd = parseAnalyticsImportJson(ndjson);
    expect(parsedNd.error).toBeUndefined();
    expect(parsedNd.rows).toHaveLength(1);
    expect(parsedNd.rows[0].appVersion).toBe('0.1.164');
    expect(parsedNd.rows[0].env).toBe('prod');
    expect(parsedNd.rows[0].weapons).toEqual(['blast-powder']);
    expect(parsedNd.rows[0].funRating).toBe('up');
    expect(parsedNd.rows[0].funTags).toEqual(['close_call']);

    const hogqlTable = JSON.stringify({
      columns: ['event', 'distinct_id', 'timestamp', 'fight_id', 'app_version', 'env', 'mode', 'level_id', 'outcome', 'sets', 'duration_ms', 'weapons'],
      results: [
        ['fight_ended', 'u2', '2026-11-21T19:00:00.000Z', 'hq-1', '0.1.164', 'prod', 'spire', 'spire-1-2', 'won', 9, 60000, '["flint-spark"]'],
      ],
    });
    const parsedHq = parseAnalyticsImportJson(hogqlTable);
    expect(parsedHq.error).toBeUndefined();
    expect(parsedHq.rows).toHaveLength(1);
    expect(parsedHq.rows[0].fightId).toBe('hq-1');
    expect(parsedHq.rows[0].mode).toBe('spire');
    expect(parsedHq.rows[0].weapons).toEqual(['flint-spark']);
  });

  it('produces valid current-era prod rows in generateSimulatedCohort and audits filters accurately', () => {
    const simRows = generateSimulatedCohort(20261115, 30);
    expect(simRows.every(r => r.appVersion === CURRENT_BALANCE_ERA.minVersion && r.env === 'prod')).toBe(true);

    const reportClean = analyzeFights(simRows, {
      eraScope: 'current',
      modeFilter: 'adventure',
      hygiene: 'prod_clean',
    });
    expect(reportClean.filterAudit.activeMinVersion).toBe(CURRENT_ADV_MIN);
    expect(reportClean.filterAudit.droppedByVersion).toBe(0);
    expect(reportClean.filterAudit.droppedByCoached).toBeGreaterThan(0); // level 1-1 excluded
    expect(reportClean.totalFights).toBe(reportClean.filterAudit.keptCount);

    // Simulated rows also work directly with analyzePostHogForBalance
    const liveSignals = analyzePostHogForBalance(simRows as unknown as Record<string, unknown>[], {
      mode: 'adventure',
      eraId: 'current',
    });
    expect(liveSignals.audit.kept).toBeGreaterThan(50);
    expect(Object.keys(liveSignals.weapons).length).toBeGreaterThan(0);
  });
});

describe('soloTester mode, E2E bot suppression & loadLocalEnv', () => {
  it('enforces uniform weights, player-count-free credibility tiers, low-N lift clamp, and E2E bot filtering', () => {
    // Credibility tiers in soloTester mode
    expect(classifyCredibility(0, 0, true)).toBe('sim_only');
    expect(classifyCredibility(1, 1, true)).toBe('exploratory');
    expect(classifyCredibility(2, 1, true)).toBe('exploratory');
    expect(classifyCredibility(3, 1, true)).toBe('emerging');
    expect(classifyCredibility(9, 1, true)).toBe('emerging');
    expect(classifyCredibility(10, 1, true)).toBe('credible');

    // E2E bot detector
    expect(isLikelyE2eBotFight({ env: 'dev', medianFindMs: 1250, maxDroughtMs: 1250, mistakes: 0 })).toBe(true);
    expect(isLikelyE2eBotFight({ env: 'dev', medianFindMs: 3500, maxDroughtMs: 12000, mistakes: 0 })).toBe(false);
    expect(isLikelyE2eBotFight({ env: 'prod', medianFindMs: 1250, maxDroughtMs: 1250, mistakes: 0 })).toBe(false);

    // 1. soloTester keeps env='prod' by default (dev rows dropped by env)
    const mixedEnv = [
      makeEvent({ fight_id: 'prod-1', env: 'prod', median_find_ms: 3500, max_drought_ms: 11000 }),
      makeEvent({ fight_id: 'dev-bot', env: 'dev', median_find_ms: 1250, max_drought_ms: 1250, mistakes: 0 }),
      makeEvent({ fight_id: 'dev-human', env: 'dev', median_find_ms: 3600, max_drought_ms: 12500, mistakes: 1 }),
    ];
    const prodOnly = filterFightEvents(mixedEnv, { mode: 'adventure', soloTester: true });
    expect(prodOnly.audit.kept).toBe(1);
    expect(prodOnly.audit.droppedByEnv).toBe(2);
    expect(prodOnly.audit.droppedByE2eBot).toBe(0);

    // 2. soloTester + includeDev drops ONLY Playwright E2E bot, keeps human dev + prod
    const withDev = filterFightEvents(mixedEnv, { mode: 'adventure', soloTester: true, includeDev: true });
    expect(withDev.audit.kept).toBe(2);
    expect(withDev.audit.droppedByE2eBot).toBe(1);
    expect(withDev.fights.map(f => f.fightId).sort()).toEqual(['dev-human', 'prod-1']);

    // 3. Uniform weights (effectiveN === fights across 2 browser profiles) & low-N ±0.50 lift clamp
    const soloEvents: Record<string, unknown>[] = [];
    // Baseline 20 losses on 2-3 with filler weapon on browser A
    for (let i = 0; i < 20; i++) {
      soloEvents.push(
        makeEvent(
          { fight_id: `base-${i}`, weapons: ['field-stone'], outcome: 'lost', dpm: 80 },
          { distinct_id: 'nathan-desktop' }
        )
      );
    }
    // 4 extreme wins with low-N weapon (3 on desktop, 1 on mobile) -> effectiveN=4, emerging, lift clamped to <= 0.50
    for (let i = 0; i < 4; i++) {
      soloEvents.push(
        makeEvent(
          { fight_id: `low-${i}`, weapons: ['clarity-lens'], outcome: 'won', dpm: 600 },
          { distinct_id: i < 3 ? 'nathan-desktop' : 'nathan-mobile' }
        )
      );
    }
    // 12 extreme wins with high-N weapon (10 on desktop, 2 on mobile) -> effectiveN=12, credible, lift > 0.50 (up to 0.80)
    for (let i = 0; i < 12; i++) {
      soloEvents.push(
        makeEvent(
          { fight_id: `high-${i}`, weapons: ['blast-powder'], outcome: 'won', dpm: 600 },
          { distinct_id: i < 10 ? 'nathan-desktop' : 'nathan-mobile' }
        )
      );
    }
    const soloSig = analyzePostHogForBalance(soloEvents, { mode: 'adventure', soloTester: true });
    expect(soloSig.soloTester).toBe(true);
    expect(soloSig.weapons['clarity-lens'].effectiveN).toBe(4);
    expect(soloSig.weapons['clarity-lens'].credibility).toBe('emerging');
    expect(soloSig.weapons['clarity-lens'].liveLogLift).toBeLessThanOrEqual(0.5);
    expect(soloSig.weapons['blast-powder'].effectiveN).toBe(12);
    expect(soloSig.weapons['blast-powder'].credibility).toBe('credible');
    expect(soloSig.weapons['blast-powder'].liveLogLift).toBeGreaterThan(0.5);
    expect(soloSig.weapons['blast-powder'].liveLogLift).toBeLessThanOrEqual(0.8);
  });

  it('loads .env.local before .env without overriding existing process.env vars', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nshapes-env-test-'));
    const keys = ['NSHAPES_TEST_A', 'NSHAPES_TEST_B', 'NSHAPES_TEST_C', 'NSHAPES_TEST_D'];
    const saved: Record<string, string | undefined> = {};
    for (const k of keys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
    try {
      process.env.NSHAPES_TEST_A = 'from-shell';
      fs.writeFileSync(
        path.join(tmpDir, '.env.local'),
        [
          '# comment line',
          'NSHAPES_TEST_A=from-local',
          'export NSHAPES_TEST_B="quoted value" # trailing comment',
          "NSHAPES_TEST_C='single-quoted'",
        ].join('\n'),
        'utf8'
      );
      fs.writeFileSync(
        path.join(tmpDir, '.env'),
        ['NSHAPES_TEST_B=from-env', 'NSHAPES_TEST_D=fallback-val # inline note'].join('\n'),
        'utf8'
      );

      loadLocalEnv(tmpDir);
      expect(process.env.NSHAPES_TEST_A).toBe('from-shell');
      expect(process.env.NSHAPES_TEST_B).toBe('quoted value');
      expect(process.env.NSHAPES_TEST_C).toBe('single-quoted');
      expect(process.env.NSHAPES_TEST_D).toBe('fallback-val');
    } finally {
      for (const k of keys) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('suppresses PostHog capture when navigator.webdriver is true (Playwright E2E guard)', () => {
    const prevNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    try {
      __enableAnalyticsForTests();
      Object.defineProperty(globalThis, 'navigator', {
        value: { webdriver: true },
        configurable: true,
      });
      expect(analyticsEnabled()).toBe(false);

      Object.defineProperty(globalThis, 'navigator', {
        value: { webdriver: false },
        configurable: true,
      });
      expect(analyticsEnabled()).toBe(true);
    } finally {
      if (prevNav) Object.defineProperty(globalThis, 'navigator', prevNav);
      else delete (globalThis as { navigator?: unknown }).navigator;
    }
  });
});
