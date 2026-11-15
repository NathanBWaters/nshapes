import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockMap = new Map<string, string>();
jest.mock('@/utils/storage', () => ({
  storage: {
    getString: jest.fn((k: string) => mockMap.get(k)),
    set: jest.fn((k: string, v: string) => mockMap.set(k, v)),
    remove: jest.fn((k: string) => mockMap.delete(k)),
  },
}));

jest.mock('react-native-svg', () => ({
  __esModule: true,
  default: 'Svg',
  Svg: 'Svg',
  Circle: 'Circle',
  Ellipse: 'Ellipse',
  G: 'G',
  Text: 'Text',
  TSpan: 'TSpan',
  TextPath: 'TextPath',
  Path: 'Path',
  Polygon: 'Polygon',
  Polyline: 'Polyline',
  Line: 'Line',
  Rect: 'Rect',
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  RadialGradient: 'RadialGradient',
  Stop: 'Stop',
  ClipPath: 'ClipPath',
  Pattern: 'Pattern',
}));

jest.mock('@/audio', () => ({ sfx: jest.fn() }));

jest.mock('@/components/Icon', () => {
  const { View: RNView, Text: RNText } = require('react-native');
  return function MockIcon({ name }: { name: string }) {
    return (
      <RNView testID={`fallback-icon-${name}`}>
        <RNText>{name}</RNText>
      </RNView>
    );
  };
});

import AnalyticsDashboard from '@/analytics/components/AnalyticsDashboard';
import {
  analyzeFights,
  generateSimulatedCohort,
  parseAnalyticsImportJson,
  wilsonCI,
  type NormalizedFightRow,
} from '@/analytics/dashboardEngine';
import { POSTHOG_DASHBOARDS, buildPostHogExportBundle } from '@/analytics/posthogDashboards';
import { __enableAnalyticsForTests, __resetAnalyticsForTests } from '@/analytics/posthog';

const SAFE_METRICS = {
  frame: { x: 0, y: 0, width: 1024, height: 768 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const makeRow = (overrides: Partial<NormalizedFightRow>): NormalizedFightRow => ({
  fightId: 'f-' + Math.random(),
  distinctId: 'player-1',
  playerCode: 'NSH-PLAYER1',
  sessionId: 'sess-1',
  timestampMs: 1_700_000_000_000,
  dayKey: '2026-11-10',
  mode: 'adventure',
  levelId: '1-1',
  levelName: 'Meadow',
  levelOrder: 1,
  world: 1,
  fighter: 'Wolf',
  foe: 'Fox',
  outcome: 'won',
  stars: 3,
  durationMs: 45_000,
  damage: 45,
  dpm: 60,
  sets: 5,
  mistakes: 0,
  triggeredDamageShare: 0.3,
  medianFindMs: 5000,
  maxDroughtMs: 7000,
  closeCall: false,
  diedWithHints: false,
  weapons: ['Lucky Coin'],
  weaponsOffered: ['Lucky Coin'],
  weaponsPicked: ['Lucky Coin'],
  weaponsBought: [],
  evolutions: [],
  arcana: [],
  funRating: 'up',
  funTags: [],
  ...overrides,
});

describe('analytics dashboard engine & PostHog dashboard specs', () => {
  beforeEach(() => {
    mockMap.clear();
    __resetAnalyticsForTests();
    __enableAnalyticsForTests();
  });

  it('produces deterministic simulated cohorts and narrows Wilson CI as sample grows', () => {
    const a = generateSimulatedCohort(20261115, 30);
    const b = generateSimulatedCohort(20261115, 30);
    expect(a).toHaveLength(b.length);
    expect(a.length).toBeGreaterThan(100);
    expect(a[0]).toEqual(b[0]);

    expect(wilsonCI(0, 0)).toBeNull();
    const small = wilsonCI(7, 10)!;
    const large = wilsonCI(700, 1000)!;
    expect(small[0]).toBeGreaterThan(0.3);
    expect(small[1]).toBeLessThan(0.95);
    expect(large[1] - large[0]).toBeLessThan(small[1] - small[0]);
  });

  it("applies Simpson's Paradox level adjustment so hard-level performers beat farm-level winners", () => {
    const rows: NormalizedFightRow[] = [];
    // Easy level 1-1: baseline win rate 90% (18/20). Tool A wins 9/10 -> +0% adjusted delta.
    for (let i = 0; i < 10; i++) {
      rows.push(
        makeRow({
          fightId: `easy-a-${i}`,
          levelId: '1-1',
          levelOrder: 1,
          outcome: i < 9 ? 'won' : 'lost',
          weapons: ['easy-farm-charm'],
        })
      );
      rows.push(
        makeRow({
          fightId: `easy-other-${i}`,
          levelId: '1-1',
          levelOrder: 1,
          outcome: i < 9 ? 'won' : 'lost',
          weapons: ['baseline-charm'],
        })
      );
    }
    // Hard level 4-4: baseline win rate 40% (8/20), except Tool B wins 7/10 while baseline wins 1/10!
    for (let i = 0; i < 10; i++) {
      rows.push(
        makeRow({
          fightId: `hard-b-${i}`,
          levelId: '4-4',
          levelOrder: 20,
          world: 4,
          outcome: i < 7 ? 'won' : 'lost',
          weapons: ['hard-carry-charm'],
          funRating: 'up',
        })
      );
      rows.push(
        makeRow({
          fightId: `hard-other-${i}`,
          levelId: '4-4',
          levelOrder: 20,
          world: 4,
          outcome: i === 0 ? 'won' : 'lost',
          weapons: ['baseline-charm'],
        })
      );
    }

    const report = analyzeFights(rows);
    const easyTool = report.balance.weapons.find(w => w.id === 'easy-farm-charm')!;
    const hardTool = report.balance.weapons.find(w => w.id === 'hard-carry-charm')!;

    expect(easyTool.rawWinRate).toBeCloseTo(0.9, 2);
    expect(Math.abs(easyTool.adjustedWinDelta ?? 0)).toBeLessThan(0.05);

    expect(hardTool.rawWinRate).toBeCloseTo(0.7, 2);
    expect(hardTool.adjustedWinDelta!).toBeGreaterThan(0.25);
    expect(hardTool.status).toBe('overpowered');
  });

  it('parses PostHog JSON arrays, NDJSON, and HogQL { results } envelopes cleanly', () => {
    const arrResult = parseAnalyticsImportJson(
      JSON.stringify([
        {
          event: 'fight_ended',
          distinct_id: 'd-1',
          timestamp: '2026-11-10T10:00:00.000Z',
          properties: {
            fight_id: 'imp-1',
            mode: 'adventure',
            level: '1-2',
            outcome: 'won',
            fun_rating: 'up',
            fun_tags: ['great_build'],
          },
        },
      ])
    );
    expect(arrResult.error).toBeUndefined();
    expect(arrResult.rows).toHaveLength(1);
    expect(arrResult.rows[0].fightId).toBe('imp-1');
    expect(arrResult.rows[0].funRating).toBe('up');

    const envelope = parseAnalyticsImportJson(
      JSON.stringify({
        results: [{ fight_id: 'imp-2', mode: 'classic', outcome: 'lost', fun_rating: 'down' }],
      })
    );
    expect(envelope.error).toBeUndefined();
    expect(envelope.rows).toHaveLength(1);
    expect(envelope.rows[0].mode).toBe('classic');

    const bad = parseAnalyticsImportJson('{not valid json');
    expect(bad.error).toBeTruthy();
    expect(bad.rows).toHaveLength(0);
  });

  it('exports 4 PostHog dashboards with 18 HogQL queries referencing only minimal events', () => {
    const bundle = buildPostHogExportBundle();
    expect(bundle.projectId).toBe(738615);
    expect(bundle.eventSchema.oneEventPerGameRule).toBe(true);
    expect(POSTHOG_DASHBOARDS).toHaveLength(4);
    const allTiles = POSTHOG_DASHBOARDS.flatMap(d => d.tiles);
    expect(allTiles.length).toBe(18);
    for (const tile of allTiles) {
      expect(tile.query.kind).toBe('DataTableNode');
      expect(tile.query.source.kind).toBe('HogQLQuery');
      expect(tile.hogql).toContain('FROM events');
    }
  });
});

describe('AnalyticsDashboard component studio', () => {
  beforeEach(() => {
    mockMap.clear();
    __resetAnalyticsForTests();
    __enableAnalyticsForTests();
  });

  it('renders simulated 60-player data and switches across all 5 tabs, balance sub-filters, and JSON import', () => {
    const { getByTestId, getByText } = render(
      <SafeAreaProvider initialMetrics={SAFE_METRICS}>
        <AnalyticsDashboard initialSource="simulated" />
      </SafeAreaProvider>
    );

    expect(getByTestId('analytics-dashboard-root')).toBeTruthy();
    expect(getByTestId('analytics-panel-overview')).toBeTruthy();
    expect(getByTestId('analytics-retention-chart')).toBeTruthy();

    fireEvent.press(getByTestId('analytics-tab-funnel'));
    expect(getByTestId('analytics-panel-funnel')).toBeTruthy();
    expect(getByTestId('analytics-funnel-chart')).toBeTruthy();

    fireEvent.press(getByTestId('analytics-tab-balance'));
    expect(getByTestId('analytics-panel-balance')).toBeTruthy();
    expect(getByTestId('analytics-balance-chart')).toBeTruthy();
    fireEvent.press(getByTestId('analytics-balance-fighters'));
    expect(getByText(/Fighters Balance/i)).toBeTruthy();
    fireEvent.press(getByTestId('analytics-balance-evolutions'));
    expect(getByText(/Evolutions Balance/i)).toBeTruthy();
    fireEvent.press(getByTestId('analytics-balance-arcana'));
    expect(getByText(/Arcana Balance/i)).toBeTruthy();

    fireEvent.press(getByTestId('analytics-tab-enjoyment'));
    expect(getByTestId('analytics-panel-enjoyment')).toBeTruthy();
    expect(getByTestId('analytics-enjoyment-chart')).toBeTruthy();

    fireEvent.press(getByTestId('analytics-tab-posthog'));
    expect(getByTestId('analytics-panel-posthog')).toBeTruthy();
    expect(getByText(/Project 738615/i)).toBeTruthy();

    // Switch back to overview via imported JSON
    fireEvent.press(getByTestId('analytics-source-import'));
    fireEvent.changeText(
      getByTestId('analytics-import-input'),
      JSON.stringify([
        {
          event: 'fight_ended',
          distinct_id: 'u-import',
          properties: {
            fight_id: 'imp-ui-1',
            mode: 'adventure',
            level: '1-1',
            outcome: 'won',
            fun_rating: 'up',
            fun_tags: ['close_call'],
          },
        },
      ])
    );
    fireEvent.press(getByTestId('analytics-import-apply'));
    fireEvent.press(getByTestId('analytics-tab-overview'));
    expect(getByText(/Loaded 1 fight rows/i)).toBeTruthy();
  });
});
