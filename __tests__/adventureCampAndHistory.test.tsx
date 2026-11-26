/**
 * The battle history (one record per fight, with its damage per minute),
 * Camp as a menu of sections (Bounties and History live there), and the
 * map's slimmed-down top bar and dock.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AdventureMap from '@/adventure/components/AdventureMap';
import AdventureMode from '@/adventure/AdventureMode';
import BattleHistory from '@/adventure/components/BattleHistory';
import Camp from '@/adventure/components/Camp';
import LevelResults from '@/adventure/components/LevelResults';
import { MAIN_LEVELS, PRACTICE_LEVELS, getLevel } from '@/adventure/data/levels';
import { BOUNTIES } from '@/adventure/data/bounties';
import { baseCardReward, computeStars, runReducer } from '@/adventure/engine/run';
import {
  HISTORY_LIMIT,
  REPLAY_LIMIT,
  battleRecord,
  bestDpmOn,
  damagePerMinute,
  fightReplayOf,
  formatDuration,
  formatWhen,
  isBattleRecord,
  sanitizeBattleRecord,
  summarize,
  wasFought,
  withBattle,
  type BattleRecord,
} from '@/adventure/history';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { isValidCombination } from '@/utils/gameUtils';
import { COACH_KEYS, applyLevelResult, createNewSave, maxStars } from '@/adventure/progress';
import { loadBattleHistory, recordBattle } from '@/adventure/save';
import { storage } from '@/utils/storage';
import type { AdventureSave, RunState } from '@/adventure/types';
import type { AttributeName, Background, Card, Number as CardNumber, Color, Shading, Shape } from '@/types';
import { ALL_FEATURES, findSet, miss, playSet, startFight, testLevel, tick, withWeapons } from './testUtils/adventureFight';

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

jest.mock('@/utils/storage', () => ({
  storage: { getString: jest.fn(() => undefined), set: jest.fn() },
}));

jest.mock('@/audio', () => {
  const band = new Proxy({}, { get: (_t, key) => (key === 'inFight' ? false : key === 'gridMs' ? 62.5 : () => undefined) });
  return { sfx: jest.fn(), music: band, band, setMusicEnabled: jest.fn(), setSfxOverride: jest.fn() };
});

jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));

// The living avatars run on animation frames; plain stand-ins keep fake timers simple
jest.mock('@/components/fighters', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    FighterAvatar: ({ testID, character }: { testID?: string; character: string }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `fighter-avatar-${character}` }),
  };
});

jest.mock('@/components/enemies', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    EnemyAvatar: ({ testID, enemy }: { testID?: string; enemy: { name: string } }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `enemy-avatar-${enemy.name}` }),
  };
});

jest.mock('@/components/weapons', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    WeaponAvatar: ({ testID, weapon }: { testID?: string; weapon: { id: string } }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `weapon-avatar-${weapon.id}` }),
  };
});

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

const SAFE_AREA_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};
const wrap = (node: React.ReactElement) => <SafeAreaProvider initialMetrics={SAFE_AREA_METRICS}>{node}</SafeAreaProvider>;
const noop = () => {};
const HISTORY_KEY = 'adventure_v2_history';
const setMock = storage.set as jest.Mock;
const getMock = storage.getString as jest.Mock;

/** A fight won on a small foe, with `seconds` of fight clock on it. */
const wonRun = (seconds: number, hp = 15): RunState => {
  let s = startFight({ level: testLevel({ foes: [{ name: 'Dummy', hp }] }), features: ['hearts'] });
  s = tick(s, seconds * 1000, 1000);
  while (s.status === 'playing') s = playSet(s);
  return s;
};

const record = (over: Partial<BattleRecord> = {}): BattleRecord => ({
  at: 1_700_000_000_000,
  levelId: '1-2',
  levelName: 'Ouch!',
  foe: 'Prickle',
  fighter: 'Orange Tabby',
  outcome: 'won',
  stars: 2,
  damage: 36,
  dpm: 72,
  biggestHit: 6,
  sets: 8,
  mistakes: 1,
  durationMs: 30_000,
  coins: 30,
  evolutions: 0,
  weapons: [],
  ...over,
});

beforeEach(() => {
  setMock.mockClear();
  getMock.mockReset();
  getMock.mockImplementation(() => undefined);
});

describe('damage per minute', () => {
  it('is damage over the fight clock, in minutes', () => {
    expect(damagePerMinute({ totalDamage: 120, elapsedMs: 60_000 })).toBe(120);
    expect(damagePerMinute({ totalDamage: 120, elapsedMs: 30_000 })).toBe(240);
    expect(damagePerMinute({ totalDamage: 0, elapsedMs: 45_000 })).toBe(0);
    // A fight over in an instant is scored over one second, not divided by zero
    expect(damagePerMinute({ totalDamage: 10, elapsedMs: 0 })).toBe(600);
  });

  it('a real fight scores what it dealt over the time it took', () => {
    const run = wonRun(30);
    expect(run.elapsedMs).toBe(30_000);
    expect(damagePerMinute(run)).toBe(run.totalDamage * 2);
  });
});

describe('a battle record', () => {
  const level = testLevel({ id: '1-2', name: 'Ouch!', foes: [{ name: 'Dummy', hp: 15 }] });

  it('holds what happened: who, where, how it ended and the numbers', () => {
    const run = wonRun(20);
    const r = battleRecord(level, run, { at: 123, stars: computeStars(run), coins: 40 });
    expect(r).toMatchObject({
      at: 123, levelId: '1-2', levelName: 'Ouch!', foe: 'Dummy', fighter: 'Orange Tabby', outcome: 'won',
      stars: computeStars(run), damage: run.totalDamage, dpm: damagePerMinute(run), biggestHit: run.biggestHit,
      sets: run.matches, mistakes: 0, durationMs: 20_000, coins: 40, evolutions: 0, weapons: [],
    });
  });

  it('names every way a battle can end', () => {
    let lost = startFight({ level: testLevel({ rules: { hearts: 1 } }), features: ['hearts'] });
    while (lost.status === 'playing') lost = miss(lost);
    expect(battleRecord(level, lost, { at: 1 }).outcome).toBe('lost');

    let survived = startFight({ level: testLevel({ rules: { moves: 1 } }), features: ['hearts'] });
    survived = playSet(survived);
    expect(battleRecord(level, survived, { at: 1, stars: 1 }).outcome).toBe('survived');

    const midFight = playSet(startFight({ features: ['hearts'] }));
    expect(battleRecord(level, midFight, { at: 1, left: true })).toMatchObject({ outcome: 'left', stars: 0, coins: 0 });
    expect(battleRecord(PRACTICE_LEVELS[0], midFight, { at: 1 }).outcome).toBe('practice');
  });

  it('attaches a FightReplayData snapshot when the fight has log entries beyond the opening', () => {
    const fresh = startFight({ features: ['hearts'] });
    expect(battleRecord(level, fresh, { at: 1 }).replay).toBeUndefined();

    const played = playSet(withWeapons(fresh, getArmoryWeapon('blast-powder')!));
    const rec = battleRecord(level, played, { at: 2, stars: 3 });
    expect(rec.replay).toEqual(fightReplayOf(played));
    expect(rec.replay?.weapons).toContain('blast-powder');
    expect(rec.replay?.log.length).toBeGreaterThan(1);
    expect(isBattleRecord(rec)).toBe(true);
  });

  it('a fight left before any move is not a battle', () => {
    const fresh = startFight({ features: ['hearts'] });
    expect(wasFought(fresh)).toBe(false);
    expect(wasFought(playSet(fresh))).toBe(true);
    expect(wasFought(miss(fresh))).toBe(true);
  });
});

describe('the history', () => {
  it('keeps the most recent battles, oldest first', () => {
    let history: BattleRecord[] = [];
    for (let i = 0; i < HISTORY_LIMIT + 3; i++) history = withBattle(history, record({ at: i }));
    expect(history).toHaveLength(HISTORY_LIMIT);
    expect(history[0].at).toBe(3);
    expect(history[history.length - 1].at).toBe(HISTORY_LIMIT + 2);
  });

  it('knows the best score on a level, not counting fights left early or other levels', () => {
    const history = [
      record({ dpm: 50 }),
      record({ dpm: 80, outcome: 'lost', stars: 0 }),
      record({ dpm: 999, outcome: 'left', stars: 0 }),
      record({ dpm: 500, levelId: '1-3' }),
    ];
    expect(bestDpmOn(history, '1-2')).toBe(80);
    expect(bestDpmOn(history, '1-3')).toBe(500);
    expect(bestDpmOn(history, '2-1')).toBeNull();
  });

  it('adds up to totals', () => {
    const totals = summarize([
      record({ dpm: 50, damage: 30, biggestHit: 6 }),
      record({ dpm: 80, damage: 40, biggestHit: 12, outcome: 'lost' }),
      record({ dpm: 999, damage: 5, biggestHit: 3, outcome: 'left' }),
    ]);
    expect(totals).toEqual({ battles: 3, wins: 1, bestDpm: 80, biggestHit: 12, totalDamage: 75 });
  });

  it('says when and how long in plain words', () => {
    const now = new Date(2026, 10, 14, 15, 30).getTime();
    expect(formatWhen(new Date(2026, 10, 14, 9, 5).getTime(), now)).toBe('Today 09:05');
    expect(formatWhen(new Date(2026, 10, 13, 23, 59).getTime(), now)).toBe('Yesterday 23:59');
    expect(formatWhen(new Date(2026, 10, 2, 12, 0).getTime(), now)).toBe('2 Nov');
    expect(formatWhen(new Date(2025, 11, 31, 12, 0).getTime(), now)).toBe('31 Dec 2025');
    expect(formatDuration(65_000)).toBe('1:05');
    expect(formatDuration(9_400)).toBe('0:09');
  });

  it('is stored under its own key, apart from the save, and read back without broken entries', () => {
    const first = recordBattle([], record({ at: 1 }));
    expect(first).toHaveLength(1);
    expect(setMock).toHaveBeenCalledWith(HISTORY_KEY, JSON.stringify(first));

    getMock.mockImplementation((key: string) => (key === HISTORY_KEY ? JSON.stringify([record({ at: 1 }), { nonsense: true }, null, record({ at: 2 })]) : undefined));
    expect(loadBattleHistory().map(b => b.at)).toEqual([1, 2]);
    getMock.mockImplementation(() => 'not json');
    expect(loadBattleHistory()).toEqual([]);
  });

  it('caps stored replay snapshots at REPLAY_LIMIT and strips corrupted replays without losing the battle', () => {
    const sampleReplay = fightReplayOf(playSet(startFight({ features: ['hearts'] })));
    let history: BattleRecord[] = [];
    for (let i = 0; i < REPLAY_LIMIT + 5; i++) history = withBattle(history, record({ at: i + 1, replay: sampleReplay }));
    expect(history).toHaveLength(REPLAY_LIMIT + 5);
    expect(history.filter(b => b.replay)).toHaveLength(REPLAY_LIMIT);
    expect(history[0].replay).toBeUndefined();
    expect(history[history.length - 1].replay).toBeDefined();

    const damaged = { ...record({ at: 99 }), replay: { broken: true } };
    expect(isBattleRecord(damaged)).toBe(false);
    const cleaned = sanitizeBattleRecord(damaged);
    expect(cleaned).not.toBeNull();
    expect(cleaned?.at).toBe(99);
    expect(cleaned?.replay).toBeUndefined();

    getMock.mockImplementation((key: string) => (key === HISTORY_KEY ? JSON.stringify([damaged]) : undefined));
    const loaded = loadBattleHistory();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].at).toBe(99);
    expect(loaded[0].replay).toBeUndefined();
  });

  it('sheds older replay logs if storage quota throws so the battle record still saves', () => {
    const sampleReplay = fightReplayOf(playSet(startFight({ features: ['hearts'] })));
    const existing = Array.from({ length: 15 }, (_, i) => record({ at: i + 1, replay: sampleReplay }));
    let calls = 0;
    setMock.mockImplementation((_k: string, json: string) => {
      calls++;
      if (calls === 1) throw new Error('QuotaExceededError');
      return json;
    });
    const saved = recordBattle(existing, record({ at: 999, replay: sampleReplay }));
    expect(saved).toHaveLength(16);
    expect(setMock).toHaveBeenCalledTimes(2);
    const persisted = JSON.parse(setMock.mock.calls[1][1] as string) as BattleRecord[];
    expect(persisted).toHaveLength(16);
    expect(persisted.filter(b => b.replay)).toHaveLength(10);
    expect(persisted[persisted.length - 1].at).toBe(999);
  });
});

describe('the results screen', () => {
  const level = getLevel('1-7');
  const show = (run: RunState, bestDpm: number | null, lvl = level) => {
    const stars = computeStars(run);
    const result = applyLevelResult(createNewSave(), lvl, stars, 0, run);
    return render(wrap(
      <LevelResults level={lvl} run={run} stars={stars} result={result} bestDpm={bestDpm} unlocksRevealed nextLevel={null} nextUnlocked={false} onRetry={noop} onNext={noop} onMap={noop} onCamp={noop} />
    ));
  };

  it('hides damage stats on early levels (1-1..1-6) and shows damage per minute from 1-7+', () => {
    const run = wonRun(30);
    const early = show(run, null, getLevel('1-2'));
    expect(early.queryByTestId('results-dpm')).toBeNull();
    early.unmount();

    const view = show(run, null);
    expect(view.getByTestId('results-dpm')).toBeTruthy();
    expect(view.getByText('Damage / min')).toBeTruthy();
    expect(view.getByText(`${damagePerMinute(run)}`)).toBeTruthy();
    // First time on the level: nothing to compare with
    expect(view.queryByText('NEW BEST')).toBeNull();
    expect(view.queryByText(/^best /)).toBeNull();
    // Bounties are reached through Camp now
    expect(view.queryByTestId('results-bounties')).toBeNull();
  });

  it('compares it with the best on that level so far', () => {
    const run = wonRun(30);
    const dpm = damagePerMinute(run);
    const better = show(run, dpm - 1);
    expect(better.getByText('NEW BEST')).toBeTruthy();
    better.unmount();
    const worse = show(run, dpm + 10);
    expect(worse.getByText(`best ${dpm + 10}`)).toBeTruthy();
    expect(worse.queryByText('NEW BEST')).toBeNull();
  });
});

describe('Camp', () => {
  const SECTION_IDS = ['fighters', 'armory', 'arcana', 'workshop', 'bounties', 'history'];
  const campOf = (save: AdventureSave, history: BattleRecord[] = [], over: Partial<React.ComponentProps<typeof Camp>> = {}) =>
    render(wrap(<Camp save={save} history={history} onChange={noop} onClose={noop} {...over} />));

  it('opens on a menu of its sections, with what is still locked saying how to open it', () => {
    const view = campOf(createNewSave());
    for (const id of SECTION_IDS) expect(view.getByTestId(`camp-tab-${id}`)).toBeTruthy();
    expect(view.getByLabelText('Back to map')).toBeTruthy();
    expect(view.getByTestId('camp-tab-workshop').props.accessibilityState.disabled).toBe(true);
    expect(view.getByTestId('camp-tab-bounties').props.accessibilityState.disabled).toBe(true);
    expect(view.getByTestId('camp-tab-fighters').props.accessibilityState.disabled).toBe(false);
    expect(view.getAllByText(/Earn ★.* to open/).length).toBe(2);
    expect(view.getByText('No battles yet')).toBeTruthy();
    // Nothing of a section is on the menu itself
    expect(view.queryByTestId('camp-fighter-Orange Tabby')).toBeNull();
  });

  it('a section opens from the menu and its back button returns there', () => {
    const closed = jest.fn();
    const view = campOf(createNewSave(), [], { onClose: closed });
    fireEvent.press(view.getByTestId('camp-tab-fighters'));
    expect(view.getByTestId('camp-fighter-Orange Tabby')).toBeTruthy();
    expect(view.queryByTestId('camp-tab-armory')).toBeNull();
    fireEvent.press(view.getByLabelText('Back to camp'));
    expect(view.getByTestId('camp-tab-armory')).toBeTruthy();
    expect(closed).not.toHaveBeenCalled();
    fireEvent.press(view.getByLabelText('Back to map'));
    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('can be opened straight on a section; back still leads to the menu', () => {
    const view = campOf(createNewSave(), [], { initialTab: 'armory' });
    expect(view.getByTestId('camp-charm-slots')).toBeTruthy();
    fireEvent.press(view.getByLabelText('Back to camp'));
    expect(view.getByTestId('camp-tab-history')).toBeTruthy();
  });

  it('holds the Bounties once they are unlocked', () => {
    const save = { ...createNewSave(), bountiesUnlocked: true };
    const view = campOf(save);
    const tile = view.getByTestId('camp-tab-bounties');
    expect(tile.props.accessibilityState.disabled).toBe(false);
    expect(view.getByText(`0/${BOUNTIES.length} claimed`)).toBeTruthy();
    fireEvent.press(tile);
    expect(view.getByTestId('bounty-filter-all')).toBeTruthy();
    expect(view.getByText(BOUNTIES[0].name)).toBeTruthy();
    fireEvent.press(view.getByLabelText('Back to camp'));
    expect(view.getByTestId('camp-tab-bounties')).toBeTruthy();
  });

  it('flags a section that wants attention: stars to spend, a bounty nearly done', () => {
    const save = applyLevelResult(createNewSave(), MAIN_LEVELS[0], 3, 0).save;
    const view = campOf(save);
    expect(view.getByTestId('camp-badge-fighters')).toBeTruthy();
    expect(view.queryByTestId('camp-badge-bounties')).toBeNull();
  });

  it('lists every battle, newest first, and opens one for the rest of its numbers', () => {
    const history = [
      record({ at: 1, levelId: '1-1', levelName: 'First Light', dpm: 40, stars: 3 }),
      record({ at: 2, levelId: '1-2', levelName: 'Ouch!', dpm: 72, outcome: 'lost', stars: 0 }),
      record({ at: 3, levelId: '1-4D', levelName: 'The Back Field', dpm: 150, outcome: 'practice', stars: 0, durationMs: 65_000 }),
    ];
    const view = campOf(createNewSave(), history);
    expect(view.getByText('3 battles · best 150 damage / min')).toBeTruthy();
    fireEvent.press(view.getByTestId('camp-tab-history'));
    const rows = view.getAllByTestId('history-battle');
    expect(rows.map(r => r.props.accessibilityLabel)).toEqual([
      'The Back Field, 150 damage per minute',
      'Ouch!, 72 damage per minute',
      'First Light, 40 damage per minute',
    ]);
    expect(view.getByText('DEFEATED')).toBeTruthy();
    expect(view.getByText('PRACTICE')).toBeTruthy();
    expect(view.queryByTestId('history-details')).toBeNull();
    fireEvent.press(rows[0]);
    expect(view.getByTestId('history-details')).toBeTruthy();
    expect(view.getByText('1:05')).toBeTruthy();
    fireEvent.press(view.getAllByTestId('history-battle')[0]);
    expect(view.queryByTestId('history-details')).toBeNull();
  });

  it('charts battle history DPM, expands a fight from its chart bar, and opens full FightReplay with Set math & gear', () => {
    const level = testLevel({ id: '1-2', name: 'Ouch!', foes: [{ name: 'Prickle', hp: 20 }] });
    let run = startFight({ level, features: ['hearts', 'gear', 'power'] });
    run = withWeapons(run, getArmoryWeapon('blast-powder')!);
    run = tick(run, 12_000, 1000);
    run = playSet(run);
    const withReplay = battleRecord(level, run, { at: 200, stars: 3, coins: 10 });
    const legacy = record({ at: 100, levelId: '1-1', levelName: 'First Light', dpm: 45, weapons: ['mending-charm'] });

    const view = campOf(createNewSave(), [legacy, withReplay], { initialTab: 'history' });
    expect(view.getByTestId('history-chart')).toBeTruthy();

    // Tapping bar 0 (older / legacy fight) expands that fight and shows WeaponExplainer without FightReplay button
    fireEvent.press(view.getByTestId('history-chart-bar-0'));
    expect(view.getByTestId('history-details')).toBeTruthy();
    expect(view.getByTestId('weapon-explainer-mending-charm')).toBeTruthy();
    expect(view.queryByTestId('history-replay')).toBeNull();

    // Tapping bar 1 (newer fight with saved log) expands its details, shows the DamageSplitBar, and launches FightReplay
    fireEvent.press(view.getByTestId('history-chart-bar-1'));
    expect(view.getByTestId('history-damage-split')).toBeTruthy();
    fireEvent.press(view.getByTestId('history-replay'));

    expect(view.getByTestId('history-details')).toBeTruthy();
    expect(view.getByTestId('fight-replay')).toBeTruthy();
    expect(view.getByTestId('replay-chart')).toBeTruthy();
    expect(view.getByTestId('replay-gear')).toBeTruthy();
    expect(view.getByTestId('weapon-explainer-blast-powder')).toBeTruthy();
    expect(view.getByText('HOW THE SET HIT')).toBeTruthy();
    expect(view.getByText('Every move')).toBeTruthy();

    fireEvent.press(view.getByTestId('fight-replay-close'));
    expect(view.queryByTestId('fight-replay')).toBeNull();
  });

  it('explains cards, itemized Set math, and Power across BattleHistory, FightReplay, and LevelResults', () => {
    const level = testLevel({ id: '1-4D', name: 'The Back Field', foes: [{ name: 'Training Dummy', hp: 999 }], rules: { sandbox: true, hearts: 7 } });
    let run = {
      ...startFight({ level, save: { upgrades: { heavy_hitter: 1 } }, features: ALL_FEATURES }),
      power: 10,
    };
    run = withWeapons(run, getArmoryWeapon('greedy-chest')!, getArmoryWeapon('magnet')!);
    const triple = findSet(run)!;
    run = {
      ...run,
      board: run.board.map(c =>
        c.id === triple[0].id ? { ...c, bonusPoints: 2 } : c.id === triple[1].id ? { ...c, magnet: true } : c
      ),
    };
    const matchCards = run.board.filter(c => triple.some(t => t.id === c.id));
    run = runReducer(run, { type: 'MATCH', cards: matchCards, rewards: matchCards.map(baseCardReward) });
    const rec = battleRecord(level, run, { at: 500, stars: 0, coins: 0 });

    // 1. LevelResults: tapping results-power opens PowerExplainer inline
    const resView = render(
      wrap(
        <LevelResults
          level={level}
          run={run}
          stars={0}
          result={applyLevelResult(createNewSave(), level, 0, 0)}
          unlocksRevealed
          nextLevel={null}
          nextUnlocked={false}
          onRetry={noop}
          onNext={noop}
          onMap={noop}
          onCamp={noop}
        />
      )
    );
    expect(resView.queryByTestId('power-explainer')).toBeNull();
    fireEvent.press(resView.getByTestId('results-power'));
    expect(resView.getByTestId('power-explainer')).toBeTruthy();
    expect(resView.getByText('WHAT IS POWER?')).toBeTruthy();

    // 2. BattleHistory: tapping history-power toggles PowerExplainer, and FightReplay explains everything
    const view = campOf(createNewSave(), [rec], { initialTab: 'history' });
    fireEvent.press(view.getByTestId('history-battle'));
    fireEvent.press(view.getByTestId('history-power'));
    expect(view.getByTestId('power-explainer')).toBeTruthy();
    fireEvent.press(view.getByTestId('history-power'));
    expect(view.queryByTestId('power-explainer')).toBeNull();

    fireEvent.press(view.getByTestId('history-replay'));
    expect(view.getByTestId('fight-replay')).toBeTruthy();
    expect(view.queryByText('Set / triggered')).toBeNull();
    expect(view.getByText('3 matched cards (1 dmg each)')).toBeTruthy();
    expect(view.getByText('Bonus on those cards')).toBeTruthy();
    expect(view.getByText('Subtotal before multipliers')).toBeTruthy();

    // Tap Power banner
    fireEvent.press(view.getByTestId('replay-power-banner'));
    expect(view.getByTestId('power-explainer')).toBeTruthy();
    fireEvent.press(view.getByTestId('replay-power-banner'));

    // Tap card 0 to explain why it scored 3 dmg
    fireEvent.press(view.getByTestId('replay-card-0'));
    expect(view.getByTestId('replay-card-detail-0')).toBeTruthy();

    // Tap math row 0 & inspector Power chip
    fireEvent.press(view.getByTestId('replay-math-0'));
    expect(view.getByTestId('replay-math-detail-0')).toBeTruthy();
    fireEvent.press(view.getByTestId('replay-inspector-power'));
    expect(view.getByTestId('power-explainer')).toBeTruthy();

    fireEvent.press(view.getByTestId('fight-replay-close'));
    expect(view.queryByTestId('fight-replay')).toBeNull();
  });

  it('shows a long history a page at a time', () => {
    const history = Array.from({ length: 75 }, (_, i) => record({ at: i + 1 }));
    const view = render(wrap(<BattleHistory history={history} now={2_000_000} />));
    expect(view.getAllByTestId('history-battle')).toHaveLength(30);
    fireEvent.press(view.getByTestId('history-more'));
    expect(view.getAllByTestId('history-battle')).toHaveLength(60);
    fireEvent.press(view.getByTestId('history-more'));
    expect(view.getAllByTestId('history-battle')).toHaveLength(75);
    expect(view.queryByTestId('history-more')).toBeNull();
  });

  it('holds the sound and effects switches', () => {
    const changed = jest.fn();
    const save = createNewSave();
    const view = campOf(save, [], { onChange: changed });
    fireEvent.press(view.getByTestId('camp-toggle-sound'));
    expect(changed).toHaveBeenLastCalledWith({ ...save, musicOn: false });
    fireEvent.press(view.getByTestId('camp-toggle-effects'));
    expect(changed).toHaveBeenLastCalledWith({ ...save, effectsOn: false });
    expect(view.getByText('Sound: on')).toBeTruthy();
  });
});

describe('the map', () => {
  it('keeps its top bar to the way back, the stars and the coins, and its dock to Guide, Play and Camp', () => {
    const save = { ...applyLevelResult(createNewSave(), MAIN_LEVELS[0], 3, 20).save, bountiesUnlocked: true, unlockedArcana: ['monochrome_pact' as const], equippedArcana: ['monochrome_pact' as const] };
    const view = render(wrap(<AdventureMap save={save} onSelectLevel={noop} onOpenCamp={noop} onOpenGuide={noop} onExit={noop} />));
    expect(view.getByLabelText('Back to menu')).toBeTruthy();
    expect(view.getByTestId('map-stars').props.accessibilityLabel).toBe(`3 of ${maxStars()} stars`);
    // Sound, Arcana and Bounties moved to Camp
    expect(view.queryByLabelText('Mute sound')).toBeNull();
    expect(view.queryByLabelText('Turn sound on')).toBeNull();
    expect(view.queryByText('I')).toBeNull();
    expect(view.queryByTestId('map-dock-bounties')).toBeNull();
    expect(view.getByTestId('map-dock-guide')).toBeTruthy();
    expect(view.getByTestId('map-play-next')).toBeTruthy();
    expect(view.getByTestId('map-dock-camp')).toBeTruthy();
  });
});

describe('playing', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const dummy = PRACTICE_LEVELS[0];
  const ready = (): AdventureSave => {
    let save = createNewSave();
    for (const l of MAIN_LEVELS.slice(0, 4)) save = applyLevelResult(save, l, 2, 0).save;
    return {
      ...save,
      seenMechanics: [...MAIN_LEVELS.map(l => l.introduces), dummy.introduces],
      seenCoachMarks: [COACH_KEYS.fightStart(dummy.introduces), COACH_KEYS.passives('Orange Tabby')],
      revealedPaths: [dummy.id, '1-3F'],
    };
  };
  const historyWrites = () => setMock.mock.calls.filter(c => c[0] === HISTORY_KEY).map(c => JSON.parse(c[1]) as BattleRecord[]);

  it('a finished battle is written into the history and shows up at Camp', () => {
    const view = render(wrap(<AdventureMode initialSave={ready()} onExit={noop} />));
    fireEvent.press(view.getByTestId(`map-node-${dummy.id}`));
    fireEvent.press(view.getByTestId('preview-play'));
    act(() => { jest.advanceTimersByTime(5000); });
    expect(historyWrites()).toHaveLength(0);
    fireEvent.press(view.getByTestId('run-done'));
    expect(view.getByTestId('results-dpm')).toBeTruthy();

    const writes = historyWrites();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toHaveLength(1);
    expect(writes[0][0]).toMatchObject({ levelId: dummy.id, levelName: dummy.name, outcome: 'practice', fighter: 'Orange Tabby', coins: 0 });

    fireEvent.press(view.getByTestId('results-camp'));
    fireEvent.press(view.getByTestId('camp-tab-history'));
    expect(view.getAllByTestId('history-battle')).toHaveLength(1);
    act(() => { jest.runOnlyPendingTimers(); });
    view.unmount();
  });

  it('retreating before making a move leaves no trace', () => {
    const view = render(wrap(<AdventureMode initialSave={ready()} onExit={noop} />));
    fireEvent.press(view.getByTestId('map-node-1-2'));
    fireEvent.press(view.getByTestId('preview-play'));
    act(() => { jest.advanceTimersByTime(1000); });
    while (view.queryByTestId('tip-ok')) fireEvent.press(view.getByTestId('tip-ok'));
    fireEvent.press(view.getByLabelText('Pause'));
    fireEvent.press(view.getByText('Retreat to map'));
    expect(view.getByTestId('map-node-1-2')).toBeTruthy();
    expect(historyWrites()).toHaveLength(0);
    act(() => { jest.runOnlyPendingTimers(); });
    view.unmount();
  });

  it('after playing a Set and finishing, Camp → History opens the full FightReplay timeline from storage', () => {
    const LABEL_RE = /^(\d+) (orange|blue|pink|red|green|purple) (solid|striped|open) (triangle|circle|bolt|diamond|oval|squiggle)(?: on (white|mist|charcoal|beige|cream|sky))?/;
    const COLOR_MAP: Record<string, Color> = { orange: 'red', red: 'red', blue: 'green', green: 'green', pink: 'purple', purple: 'purple' };
    const SHAPE_MAP: Record<string, Shape> = { circle: 'oval', oval: 'oval', triangle: 'diamond', diamond: 'diamond', bolt: 'squiggle', squiggle: 'squiggle' };
    const BG_MAP: Record<string, Background> = { white: 'white', mist: 'beige', beige: 'beige', cream: 'beige', sky: 'beige', charcoal: 'charcoal' };
    const view = render(wrap(<AdventureMode initialSave={ready()} onExit={noop} />));
    fireEvent.press(view.getByTestId(`map-node-${dummy.id}`));
    fireEvent.press(view.getByTestId('preview-play'));
    act(() => { jest.advanceTimersByTime(1000); });

    const slots = view.getAllByLabelText(LABEL_RE).map((pressable, idx) => {
      const m = LABEL_RE.exec(String(pressable.props.accessibilityLabel))!;
      const card: Card = {
        id: `${idx}`,
        number: Number(m[1]) as CardNumber,
        color: COLOR_MAP[m[2]],
        shading: m[3] as Shading,
        shape: SHAPE_MAP[m[4]],
        background: m[5] ? (BG_MAP[m[5]] ?? 'white') : 'white',
        selected: false,
      };
      return { pressable, card };
    });
    const attrs: AttributeName[] = ['shape', 'color', 'number'];
    let triple: typeof slots | null = null;
    for (let i = 0; i < slots.length - 2 && !triple; i++) {
      for (let j = i + 1; j < slots.length - 1 && !triple; j++) {
        for (let k = j + 1; k < slots.length && !triple; k++) {
          if (isValidCombination([slots[i].card, slots[j].card, slots[k].card], attrs).isValid) {
            triple = [slots[i], slots[j], slots[k]];
          }
        }
      }
    }
    expect(triple).not.toBeNull();
    for (const s of triple!) fireEvent.press(s.pressable);
    act(() => { jest.advanceTimersByTime(1500); });

    fireEvent.press(view.getByTestId('run-done'));
    const writes = historyWrites();
    expect(writes).toHaveLength(1);
    expect(writes[0][0].replay?.log.length).toBeGreaterThan(1);

    fireEvent.press(view.getByTestId('results-camp'));
    fireEvent.press(view.getByTestId('camp-tab-history'));
    fireEvent.press(view.getByTestId('history-battle'));
    fireEvent.press(view.getByTestId('history-replay'));
    expect(view.getByTestId('fight-replay')).toBeTruthy();
    expect(view.getByTestId('replay-chart')).toBeTruthy();
    expect(view.getByText('HOW THE SET HIT')).toBeTruthy();
    fireEvent.press(view.getByTestId('fight-replay-close'));
    expect(view.queryByTestId('fight-replay')).toBeNull();

    act(() => { jest.runOnlyPendingTimers(); });
    view.unmount();
  });
});
