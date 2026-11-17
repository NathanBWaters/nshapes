import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AdventureMode from '@/adventure/AdventureMode';
import LevelResults from '@/adventure/components/LevelResults';
import { getLevel } from '@/adventure/data/levels';
import { applyLevelResult, createNewSave } from '@/adventure/progress';
import { createRun, runReducer, computeStars } from '@/adventure/engine/run';
import { explainStarBreakdown } from '@/adventure/engine/challenges';
import {
  companionResultsLine,
  companionVoice,
  computeLiveGuidance,
  describeValidSetWhy,
  evaluateTripleTraits,
  explainInvalidPick,
  predictThirdCard,
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

const makeCard = (
  id: string,
  shape: Card['shape'],
  color: Card['color'],
  number: Card['number'] = 1,
  shading: Card['shading'] = 'solid'
): Card => ({
  id,
  shape,
  color,
  number,
  shading,
  selected: false,
});

describe('Adventure FTUE: SET Magic Rule, TraitCheckPills, cute companion bubbles & 3-star breakdown', () => {
  beforeEach(() => {
    mockKvStore.clear();
  });

  it('teaches the Every-Trait Rule & Magic Rule (2 + 1 = not a Set) with per-trait pills', () => {
    const sameColor = [
      makeCard('a', 'diamond', 'red'),
      makeCard('b', 'oval', 'red'),
      makeCard('c', 'squiggle', 'red'),
    ];
    expect(describeValidSetWhy(sameColor, ['shape', 'color'])).toBe(
      'Every trait passes: all 3 are red, AND all 3 shapes differ!'
    );
    expect(evaluateTripleTraits(sameColor, ['shape', 'color'])).toEqual([
      { attr: 'color', status: 'pass', label: 'Color: all red' },
      { attr: 'shape', status: 'pass', label: 'Shape: all 3 diff' },
    ]);

    const allDiff = [
      makeCard('a', 'diamond', 'red'),
      makeCard('b', 'oval', 'green'),
      makeCard('c', 'squiggle', 'purple'),
    ];
    expect(describeValidSetWhy(allDiff, ['shape', 'color'])).toBe(
      'Every trait is ALL DIFFERENT — 3 colors AND 3 shapes!'
    );

    const badColor = [
      makeCard('a', 'diamond', 'red'),
      makeCard('b', 'oval', 'red'),
      makeCard('c', 'squiggle', 'green'),
    ];
    expect(explainInvalidPick(badColor, ['shape', 'color'], 'Orange Tabby')).toContain(
      'Magic Rule: 2 red + 1 green breaks Color — EVERY trait must be all same or all different!'
    );
    // Shows BOTH which trait failed (Color) AND which trait passed (Shape)!
    expect(evaluateTripleTraits(badColor, ['shape', 'color'])).toEqual([
      { attr: 'color', status: 'fail', label: 'Color: 2 red + 1 green' },
      { attr: 'shape', status: 'pass', label: 'Shape: all 3 diff' },
    ]);

    const badNumber = [
      makeCard('a', 'oval', 'purple', 2),
      makeCard('b', 'oval', 'purple', 2),
      makeCard('c', 'oval', 'purple', 3),
    ];
    expect(explainInvalidPick(badNumber, ['shape', 'color', 'number'], 'Corgi')).toContain(
      'Magic Rule: two 2s + a 3 breaks Number — EVERY trait must be all same or all different!'
    );
  });

  it('predicts the exact 3rd card needed across every active trait when 2 cards are selected', () => {
    const c1 = makeCard('1', 'diamond', 'red', 1);
    const c2 = makeCard('2', 'oval', 'red', 2);
    const matchingThird = makeCard('3', 'squiggle', 'red', 3);
    const wrongThird = makeCard('4', 'oval', 'green', 3);

    const onBoard = predictThirdCard([c1, c2], ['shape', 'color'], [c1, c2, matchingThird]);
    expect(onBoard).not.toBeNull();
    expect(onBoard!.neededSummary).toBe('a red squiggle');
    expect(onBoard!.existsOnBoard).toBe(true);
    expect(onBoard!.pills).toEqual([
      { attr: 'color', status: 'hint', label: 'Color (both match) → red' },
      { attr: 'shape', status: 'hint', label: 'Shape (2 diff) → squiggle' },
    ]);

    const threeTrait = predictThirdCard([c1, c2], ['shape', 'color', 'number'], [c1, c2, wrongThird]);
    expect(threeTrait!.neededSummary).toBe('3 red squiggles');
    expect(threeTrait!.existsOnBoard).toBe(false);
    expect(threeTrait!.pills).toHaveLength(3);
  });

  it('steps 1-1 live guidance through trait pills, Magic Rule, and 2-card live helper with cute personality', () => {
    const level = getLevel('1-1');
    const save = createNewSave();
    let run = createRun(level, save, { seed: 42 });

    // Match 1: 3 glowing cards + 6 dimmed cards + 2 passing trait pills
    const step1 = computeLiveGuidance(run);
    expect(step1).not.toBeNull();
    expect(step1!.glowIds).toHaveLength(3);
    expect(step1!.dimIds).toHaveLength(6);
    expect(step1!.message).toContain('Tap the 3 glowing cards!');
    expect(step1!.pills?.every(p => p.status === 'pass')).toBe(true);

    // Advance 1 match
    const match1 = allSets(run.board, run.attributes)[0];
    run = runReducer(run, { type: 'MATCH', cards: match1, rewards: [] });
    run = runReducer(run, { type: 'REPLACE', ids: match1.map(c => c.id) });

    // Match 2: 3 glowing cards + cute cheer + trait pills
    const step2 = computeLiveGuidance(run);
    expect(step2!.glowIds).toHaveLength(3);
    expect(step2!.message).toContain('Now tap these 3!');
    expect(step2!.pills).toHaveLength(2);

    // Advance 2nd match
    const match2 = allSets(run.board, run.attributes)[0];
    run = runReducer(run, { type: 'MATCH', cards: match2, rewards: [] });
    run = runReducer(run, { type: 'REPLACE', ids: match2.map(c => c.id) });

    // Match 3: 1 glowing starter card + Magic Rule explanation
    const step3 = computeLiveGuidance(run);
    expect(step3!.glowIds).toHaveLength(1);
    expect(step3!.dimIds).toHaveLength(0);
    expect(step3!.message).toContain('Magic Rule');

    // Selecting 2 cards on Match 3 activates the live "Find the Missing 3rd Card" trait pills!
    const validTriple = allSets(run.board, run.attributes)[0];
    const twoPicked = computeLiveGuidance(run, {
      selectedCount: 2,
      selectedCards: [validTriple[0], validTriple[1]],
    });
    expect(twoPicked!.pills?.every(p => p.status === 'hint')).toBe(true);
    expect(twoPicked!.message).toContain('Check EVERY trait below');

    // Advance 3rd match → Match 4 runs solo with cheerful encouragement!
    run = runReducer(run, { type: 'MATCH', cards: validTriple, rewards: [] });
    run = runReducer(run, { type: 'REPLACE', ids: validTriple.map(c => c.id) });
    const step4 = computeLiveGuidance(run);
    expect(step4!.glowIds).toHaveLength(0);
    expect(step4!.message).toContain('Dozy Bunny');
  });

  it('gives every cute fighter their own distinct encouraging voice and explains ★, ★★, and ★★★', () => {
    expect(companionVoice('Orange Tabby').hello).toBe('Meow!');
    expect(companionVoice('Corgi').hello).toBe('Woof!');
    expect(companionVoice('Emperor Penguin').cheer).toBe('Brr-illiant!');

    const save = createNewSave();
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
    expect(companionResultsLine(lvl12, run12, stars12, false)).toContain('Pawsome knockout');

    const rows12 = explainStarBreakdown(lvl12, run12, stars12);
    expect(rows12[0]).toMatchObject({ star: 1, earned: true, reason: 'Cleared!' });
    expect(rows12[1]).toMatchObject({ star: 2, earned: true, reason: 'Knocked out!' });
    expect(rows12[2]).toMatchObject({ star: 3, earned: false, reason: '1/2 done' });

    const lvl17 = getLevel('1-7');
    const run17 = {
      ...createRun(lvl17, save, { seed: 11 }),
      status: 'won' as const,
      endReason: 'survived' as const,
      movesLeft: 0,
      foeHp: 6,
      biggestHit: 8,
    };
    const rows17 = explainStarBreakdown(lvl17, run17, computeStars(run17));
    expect(rows17[0]).toMatchObject({ star: 1, earned: true, reason: 'Cleared!' });
    expect(rows17[1]).toMatchObject({ star: 2, earned: false, reason: '6 HP left' });
    expect(rows17[2]).toMatchObject({ star: 3, earned: false, reason: 'Goal met — need ★★ KO too' });

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

  it('renders cute CompanionBubble across Map, Preview, live 1-1 Board (with TraitCheckPills), and Results', () => {
    jest.useFakeTimers();
    try {
      const screen = render(
        <SafeAreaProvider initialMetrics={INSETS}>
          <AdventureMode onExit={() => {}} />
        </SafeAreaProvider>
      );
      // Launch: straight on World Map with Orange Tabby speech bubble
      expect(screen.queryByTestId('lesson-modal')).toBeNull();
      expect(screen.getByTestId('map-guide-banner')).toBeTruthy();

      // Tap 1: select enemy 1-1 → Orange Tabby explains the Magic Rule in preview-coach
      fireEvent.press(screen.getByTestId('map-node-1-1'));
      expect(screen.getByTestId('preview-coach')).toBeTruthy();

      // Tap 2: press Fight! → straight onto live guided board with CompanionBubble + TraitCheckPills!
      fireEvent.press(screen.getByTestId('preview-play'));
      expect(screen.queryByTestId('lesson-modal')).toBeNull();
      expect(screen.getByTestId('run-coach-banner')).toBeTruthy();
      expect(screen.getByTestId('coach-trait-pills')).toBeTruthy();
      expect(screen.getByTestId('coach-trait-color')).toBeTruthy();
      expect(screen.getByTestId('coach-trait-shape')).toBeTruthy();
      screen.unmount();

      // Post-battle LevelResults renders results-companion-bubble + results-star-breakdown
      const lvl = getLevel('1-2');
      const save = createNewSave();
      const won = { ...createRun(lvl, save, { seed: 3 }), status: 'won' as const, endReason: 'defeated' as const, challengeMet: true, foeHp: 0 };
      const resScreen = render(
        <SafeAreaProvider initialMetrics={INSETS}>
          <LevelResults
            level={lvl}
            run={won}
            stars={3}
            result={applyLevelResult(save, lvl, 3, 0, won)}
            unlocksRevealed
            nextLevel={getLevel('1-3')}
            nextUnlocked
            onRetry={() => {}}
            onNext={() => {}}
            onMap={() => {}}
            onCamp={() => {}}
          />
        </SafeAreaProvider>
      );
      expect(resScreen.getByTestId('results-companion-bubble')).toBeTruthy();
      expect(resScreen.getByTestId('results-star-breakdown')).toBeTruthy();
    } finally {
      act(() => {
        jest.clearAllTimers();
      });
      jest.useRealTimers();
    }
  });
});
