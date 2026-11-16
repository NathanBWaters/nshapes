import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AdventureMode from '@/adventure/AdventureMode';
import { getLevel } from '@/adventure/data/levels';
import { createNewSave } from '@/adventure/progress';
import { createRun, runReducer, computeStars } from '@/adventure/engine/run';
import { explainStarBreakdown } from '@/adventure/engine/challenges';
import {
  computeLiveGuidance,
  describeValidSetWhy,
  explainInvalidPick,
  shouldShowDamageNumbers,
  shouldShowPassiveHud,
} from '@/adventure/coach';
import { allSets } from '@/adventure/engine/sets';
import type { Card } from '@/types';

const mockKvStore = new Map<string, string>();

jest.mock('@/utils/storage', () => ({
  storage: {
    getString: (key: string) => mockKvStore.get(key),
    set: (key: string, val: string) => {
      mockKvStore.set(key, val);
    },
    remove: (key: string) => {
      mockKvStore.delete(key);
    },
  },
}));

jest.mock('@/audio', () => {
  const band = new Proxy({}, { get: (_t, key) => (key === 'inFight' ? false : () => undefined) });
  return { sfx: () => undefined, music: band, band, setMusicEnabled: () => undefined, setSfxOverride: () => undefined };
});

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
    EnemyAvatar: ({ testID, enemy }: { testID?: string; enemy?: { name?: string } }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `enemy-avatar-${enemy?.name ?? 'foe'}` }),
  };
});

jest.mock('@/components/weapons', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  return {
    WeaponAvatar: ({ testID, weapon }: { testID?: string; weapon?: { name?: string } }) =>
      ReactActual.createElement(View, { testID, accessibilityLabel: `weapon-avatar-${weapon?.name ?? 'weapon'}` }),
  };
});

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const MockIcon = ({ name }: { name: string }) => ReactActual.createElement(View, { accessibilityLabel: `icon-${name}` });
  return { __esModule: true, default: MockIcon, Icon: MockIcon };
});

jest.mock('react-native-svg', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const makeSvgMock = (name: string) => {
    const Comp = (props: any) => ReactActual.createElement(View, props, props?.children);
    Comp.displayName = name;
    return Comp;
  };
  const SvgRoot = makeSvgMock('Svg');
  return new Proxy(
    { __esModule: true, default: SvgRoot, Svg: SvgRoot } as Record<string, any>,
    {
      get(target, prop: string) {
        if (!(prop in target)) target[prop] = makeSvgMock(String(prop));
        return target[prop];
      },
    }
  );
});

const INSETS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const makeCard = (id: string, shape: Card['shape'], color: Card['color'], number: Card['number'] = 1, shading: Card['shading'] = 'solid'): Card => ({
  id,
  shape,
  color,
  number,
  shading,
  selected: false,
});

describe('Adventure FTUE live coaching, progressive UI disclosure & 3-star breakdown', () => {
  beforeEach(() => {
    mockKvStore.clear();
  });

  it('explains why valid 3-card matches work and why invalid 3-card picks missed in plain English', () => {
    const sameColor = [
      makeCard('a', 'diamond', 'red'),
      makeCard('b', 'oval', 'red'),
      makeCard('c', 'squiggle', 'red'),
    ];
    expect(describeValidSetWhy(sameColor, ['shape', 'color'])).toBe('All 3 are red, with 3 different shapes!');

    const allDiff = [
      makeCard('a', 'diamond', 'red'),
      makeCard('b', 'oval', 'green'),
      makeCard('c', 'squiggle', 'purple'),
    ];
    expect(describeValidSetWhy(allDiff, ['shape', 'color'])).toBe('3 different shapes and 3 different colors!');

    const badColor = [
      makeCard('a', 'diamond', 'red'),
      makeCard('b', 'oval', 'red'),
      makeCard('c', 'squiggle', 'green'),
    ];
    expect(explainInvalidPick(badColor, ['shape', 'color'])).toBe(
      'Almost! 2 red + 1 green — colors must be ALL SAME or ALL DIFFERENT.'
    );

    const badNumber = [
      makeCard('a', 'oval', 'purple', 2),
      makeCard('b', 'oval', 'purple', 2),
      makeCard('c', 'oval', 'purple', 3),
    ];
    expect(explainInvalidPick(badNumber, ['shape', 'color', 'number'])).toBe(
      'Almost! Two 2s and a 3 — numbers must be ALL SAME or ALL DIFFERENT.'
    );
  });

  it('steps 1-1 live guidance from 3 glowing cards → all-different 3 cards → 1 starter card → solo play', () => {
    const level = getLevel('1-1');
    const save = createNewSave();
    let run = createRun(level, save, { seed: 42 });

    // Match 1: 3 glowing cards + 6 dimmed cards
    const step1 = computeLiveGuidance(run);
    expect(step1).not.toBeNull();
    expect(step1!.glowIds).toHaveLength(3);
    expect(step1!.dimIds).toHaveLength(6);
    expect(step1!.message).toContain('Tap the 3 glowing cards!');

    // Advance 1 match
    const match1 = allSets(run.board, run.attributes)[0];
    run = runReducer(run, { type: 'MATCH', cards: match1, rewards: [] });
    run = runReducer(run, { type: 'REPLACE', ids: match1.map(c => c.id) });

    // Match 2: 3 glowing cards
    const step2 = computeLiveGuidance(run);
    expect(step2!.glowIds).toHaveLength(3);
    expect(step2!.message).toContain('Now tap these 3');

    // Advance 2nd match
    const match2 = allSets(run.board, run.attributes)[0];
    run = runReducer(run, { type: 'MATCH', cards: match2, rewards: [] });
    run = runReducer(run, { type: 'REPLACE', ids: match2.map(c => c.id) });

    // Match 3: 1 glowing starter card (no dimming)
    const step3 = computeLiveGuidance(run);
    expect(step3!.glowIds).toHaveLength(1);
    expect(step3!.dimIds).toHaveLength(0);
    expect(step3!.message).toContain('Start with the glowing card');

    // Advance 3rd match → Match 4 runs solo!
    const match3 = allSets(run.board, run.attributes)[0];
    run = runReducer(run, { type: 'MATCH', cards: match3, rewards: [] });
    run = runReducer(run, { type: 'REPLACE', ids: match3.map(c => c.id) });
    const step4 = computeLiveGuidance(run);
    expect(step4!.glowIds).toHaveLength(0);
    expect(step4!.message).toContain('more matches to beat Dozy Bunny');
  });

  it('explains exact ✓ / ✗ reasons for ★, ★★, and ★★★ on LevelResults across win, partial KO, and loss', () => {
    const save = createNewSave();

    // 1-2: 2★ win where all-red challenge has 1/2 done (challengeMet = false)
    const lvl12 = getLevel('1-2');
    const base12 = createRun(lvl12, save, { seed: 7 });
    const run12 = {
      ...base12,
      status: 'won' as const,
      endReason: 'defeated' as const,
      challengeMet: false,
      foeHp: 0,
      colorSets: { ...base12.colorSets, red: 1 },
    };
    const stars12 = computeStars(run12);
    expect(stars12).toBe(2);
    const rows12 = explainStarBreakdown(lvl12, run12, stars12);
    expect(rows12[0]).toMatchObject({ star: 1, earned: true, reason: 'Cleared!' });
    expect(rows12[1]).toMatchObject({ star: 2, earned: true, reason: 'Knocked out!' });
    expect(rows12[2]).toMatchObject({ star: 3, earned: false, reason: '1/2 done' });

    // 1-7: 1★ partial damage survival where ★★★ goal was met, but foe wasn't fully KO'd
    const lvl17 = getLevel('1-7');
    const run17 = {
      ...createRun(lvl17, save, { seed: 11 }),
      status: 'won' as const,
      endReason: 'survived' as const,
      movesLeft: 0,
      foeHp: 6,
      biggestHit: 8,
    };
    const stars17 = computeStars(run17);
    expect(stars17).toBe(1);
    const rows17 = explainStarBreakdown(lvl17, run17, stars17);
    expect(rows17[0]).toMatchObject({ star: 1, earned: true, reason: 'Cleared!' });
    expect(rows17[1]).toMatchObject({ star: 2, earned: false, reason: '6 HP left' });
    expect(rows17[2]).toMatchObject({ star: 3, earned: false, reason: 'Goal met — need ★★ KO too' });

    // 1-7: 0★ out-of-moves loss (still has hearts) explains "Out of moves" rather than hearts
    const run17Loss = {
      ...createRun(lvl17, save, { seed: 11 }),
      status: 'lost' as const,
      endReason: null,
      movesLeft: 0,
      foeHp: 18,
      biggestHit: 3,
    };
    const rowsLoss = explainStarBreakdown(lvl17, run17Loss, computeStars(run17Loss));
    expect(rowsLoss[0]).toMatchObject({ star: 1, earned: false, reason: 'Out of moves' });
    expect(rowsLoss[1]).toMatchObject({ star: 2, earned: false, reason: '18 HP left' });
    expect(rowsLoss[2]).toMatchObject({ star: 3, earned: false, reason: 'Best hit 3 (need 7+)' });
  });

  it('gates damage & passive HUD chips progressively as mechanics unlock', () => {
    const save = createNewSave();
    expect(shouldShowDamageNumbers(getLevel('1-1'), save)).toBe(false);
    expect(shouldShowDamageNumbers(getLevel('1-4'), save)).toBe(false);
    expect(shouldShowDamageNumbers(getLevel('1-7'), save)).toBe(true);

    expect(shouldShowPassiveHud(getLevel('1-1'), save)).toBe(false);
    expect(shouldShowPassiveHud(getLevel('1-2'), save)).toBe(false);
    expect(shouldShowPassiveHud(getLevel('1-5'), save)).toBe(true);
  });

  it('launches straight onto the World Map with 0 modals and reaches the 1-1 board in 2 taps', () => {
    jest.useFakeTimers();
    try {
      const screen = render(
        <SafeAreaProvider initialMetrics={INSETS}>
          <AdventureMode onExit={() => {}} />
        </SafeAreaProvider>
      );
      // Launch: straight on World Map, 0 modals!
      expect(screen.queryByTestId('lesson-modal')).toBeNull();
      expect(screen.getByTestId('map-guide-banner')).toBeTruthy();

      // Tap 1: select enemy 1-1 → shows star system & coach banner
      fireEvent.press(screen.getByTestId('map-node-1-1'));
      expect(screen.getByTestId('preview-coach')).toBeTruthy();

      // Tap 2: press Fight! → straight onto live guided board with 0 modals!
      fireEvent.press(screen.getByTestId('preview-play'));
      expect(screen.queryByTestId('lesson-modal')).toBeNull();
      expect(screen.queryByTestId('tip-ok')).toBeNull();
      expect(screen.getByTestId('run-coach-banner')).toBeTruthy();
    } finally {
      act(() => {
        jest.clearAllTimers();
      });
      jest.useRealTimers();
    }
  });
});
