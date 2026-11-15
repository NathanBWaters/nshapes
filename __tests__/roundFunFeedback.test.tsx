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

const fetchMock = jest.fn(async () => ({ ok: true, status: 200 }));
(global as { fetch?: unknown }).fetch = fetchMock;

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

jest.mock('@/audio', () => {
  const band = new Proxy({}, { get: (_t, key) => (key === 'inFight' ? false : key === 'gridMs' ? 62.5 : () => undefined) });
  return { sfx: jest.fn(), music: band, band, setMusicEnabled: jest.fn(), setSfxOverride: jest.fn() };
});

jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));

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

import RoundFunPrompt from '@/components/RoundFunPrompt';
import LevelResults from '@/adventure/components/LevelResults';
import BattleHistory from '@/adventure/components/BattleHistory';
import Camp from '@/adventure/components/Camp';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { getLevel } from '@/adventure/data/levels';
import { battleRecord, type BattleRecord } from '@/adventure/history';
import { applyLevelResult, createNewSave } from '@/adventure/progress';
import type { RunState } from '@/adventure/types';
import { __enableAnalyticsForTests, __resetAnalyticsForTests, analyticsOptedOut } from '@/analytics/posthog';
import { playSet, startFight, testLevel, tick, withWeapons } from './testUtils/adventureFight';

const SAFE_METRICS = {
  frame: { x: 0, y: 0, width: 1024, height: 768 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const wrapSafe = (ui: React.ReactElement) => (
  <SafeAreaProvider initialMetrics={SAFE_METRICS}>{ui}</SafeAreaProvider>
);

const sampleRun = (): RunState => {
  let s = withWeapons(startFight({ level: testLevel({ foes: [{ name: 'Fox', hp: 15 }] }), features: ['hearts'] }), getArmoryWeapon('clarity-lens')!);
  s = tick(s, 10_000, 1000);
  while (s.status === 'playing') s = playSet(s);
  return s;
};

describe('RoundFunPrompt & enjoyment feedback UI', () => {
  beforeEach(() => {
    mockMap.clear();
    fetchMock.mockClear();
    __resetAnalyticsForTests();
    __enableAnalyticsForTests();
  });

  it('switches between positive/negative tags, clears incompatible tags, and toggles off cleanly', () => {
    const onChange = jest.fn();
    const { getByTestId, rerender, queryByTestId } = render(
      <RoundFunPrompt rating={null} tags={[]} onChange={onChange} testIDPrefix="round-fun" />
    );

    expect(queryByTestId('round-fun-saved')).toBeNull();
    fireEvent.press(getByTestId('round-fun-up'));
    expect(onChange).toHaveBeenLastCalledWith('up', []);

    rerender(
      <RoundFunPrompt rating="up" tags={[]} onChange={onChange} testIDPrefix="round-fun" />
    );
    expect(getByTestId('round-fun-saved')).toBeTruthy();
    expect(queryByTestId('round-fun-tag-unfair_rng')).toBeNull();

    fireEvent.press(getByTestId('round-fun-tag-close_call'));
    expect(onChange).toHaveBeenLastCalledWith('up', ['close_call']);

    // Switching to thumbs down strips positive tag
    rerender(
      <RoundFunPrompt
        rating="up"
        tags={['close_call']}
        onChange={onChange}
        testIDPrefix="round-fun"
      />
    );
    fireEvent.press(getByTestId('round-fun-down'));
    expect(onChange).toHaveBeenLastCalledWith('down', []);

    // Pressing down again toggles rating back to null
    rerender(
      <RoundFunPrompt rating="down" tags={[]} onChange={onChange} testIDPrefix="round-fun" />
    );
    fireEvent.press(getByTestId('round-fun-down'));
    expect(onChange).toHaveBeenLastCalledWith(null, []);
  });

  it('renders thumbs up/down & reason tags inside LevelResults and notifies parent handlers', () => {
    const onRateFun = jest.fn();
    const onReplayOpened = jest.fn();
    const level = getLevel('1-1');
    const run = sampleRun();

    const { getByTestId } = render(
      wrapSafe(
        <LevelResults
          level={level}
          run={run}
          stars={3}
          result={applyLevelResult(createNewSave(), level, 3, 15, run)}
          unlocksRevealed
          nextLevel={getLevel('1-2')}
          nextUnlocked
          funRating="up"
          funTags={['great_build']}
          onRateFun={onRateFun}
          onReplayOpened={onReplayOpened}
          onRetry={jest.fn()}
          onNext={jest.fn()}
          onMap={jest.fn()}
          onCamp={jest.fn()}
        />
      )
    );

    expect(getByTestId('results-fun-saved')).toBeTruthy();
    fireEvent.press(getByTestId('results-fun-tag-close_call'));
    expect(onRateFun).toHaveBeenCalledWith('up', ['great_build', 'close_call']);

    fireEvent.press(getByTestId('results-fun-down'));
    expect(onRateFun).toHaveBeenCalledWith('down', []);
  });

  it('displays saved fun badge and allows rating inside expanded Camp -> BattleHistory rows', () => {
    const level = getLevel('1-1');
    const record: BattleRecord = {
      ...battleRecord(level, sampleRun(), { at: 1_700_000_000_000 }),
      fightId: 'fight-camp-1',
      funRating: 'up',
      funTags: ['satisfying_combos'],
    };
    const onRateBattle = jest.fn();

    const { getByTestId } = render(
      wrapSafe(<BattleHistory history={[record]} now={1_700_000_010_000} onRateBattle={onRateBattle} />)
    );

    expect(getByTestId('history-fun-badge')).toBeTruthy();
    fireEvent.press(getByTestId('history-battle'));
    expect(getByTestId('history-details')).toBeTruthy();

    fireEvent.press(getByTestId('history-fun-down'));
    expect(onRateBattle).toHaveBeenCalledWith(record, 'down', []);
  });

  it('toggles gameplay analytics opt-out from Camp Settings', () => {
    const { getByTestId } = render(
      wrapSafe(
        <Camp
          save={createNewSave()}
          history={[]}
          onChange={jest.fn()}
          onClose={jest.fn()}
        />
      )
    );

    expect(analyticsOptedOut()).toBe(false);
    fireEvent.press(getByTestId('camp-toggle-analytics'));
    expect(analyticsOptedOut()).toBe(true);
    fireEvent.press(getByTestId('camp-toggle-analytics'));
    expect(analyticsOptedOut()).toBe(false);
  });
});
