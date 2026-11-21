import React from 'react';
import { render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { resolveVictoryCallout } from '@/adventure/victoryCallout';
import KillCamOverlay from '@/adventure/fx/KillCamOverlay';
import LevelResults from '@/adventure/components/LevelResults';
import { getLevel } from '@/adventure/data/levels';
import { applyLevelResult, createMaxedSave } from '@/adventure/progress';
import { createRun } from '@/adventure/engine/run';
import type { Anchors } from '@/adventure/fx/anchors';
import type { RunState } from '@/adventure/types';

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
  const ReactActual = require('react');
  const { View, Text } = require('react-native');
  return function MockIcon({ name }: { name: string }) {
    return ReactActual.createElement(View, { testID: `icon-${name}` }, ReactActual.createElement(Text, null, name));
  };
});

jest.mock('@/audio', () => ({
  band: { cue: jest.fn(), finale: jest.fn(), slowMoDefeat: jest.fn() },
  music: { play: jest.fn(), stop: jest.fn(), setMood: jest.fn() },
  sfx: { play: jest.fn(), tap: jest.fn(), tick: jest.fn() },
}));

jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => true,
}));

const SAFE_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const wrapSafe = (node: React.ReactNode) => (
  <SafeAreaProvider initialMetrics={SAFE_METRICS}>{node}</SafeAreaProvider>
);

const stubAnchors: Anchors = {
  rect: () => ({ x: 240, y: 90, w: 60, h: 60 }),
  ref: () => () => {},
  measure: () => {},
  rootRef: () => {},
  bump: () => {},
  onBump: () => () => {},
};

const buildRun = (levelId: string, overrides: Partial<RunState> = {}): RunState => {
  const save = createMaxedSave();
  const base = createRun(getLevel(levelId), save, { seed: 7 });
  return {
    ...base,
    status: 'won',
    endReason: 'defeated',
    foeHp: 0,
    mistakes: 0,
    roundStats: { ...base.roundStats, damageReceived: 0 },
    ...overrides,
  };
};

describe('resolveVictoryCallout', () => {
  it('never calls a 1-star run Flawless, even with 0 mistakes and 0 health lost', () => {
    const survived = resolveVictoryCallout({
      stars: 1,
      endReason: 'survived',
      damageReceived: 0,
      mistakes: 0,
      hasHearts: true,
      heartsLeft: 5,
      isBoss: true,
      finalBlowDmg: 42,
    });
    expect(survived.headline).toBe('NICE JOB!');
    expect(survived.eyebrow).toBe('★☆☆ · STAGE SURVIVED');
    expect(survived.rankSeal).toEqual({ label: 'SURVIVED', accent: 'gold' });

    const accuracyClear = resolveVictoryCallout({
      stars: 1,
      endReason: 'defeated',
      damageReceived: 0,
      mistakes: 5,
      hasHearts: false,
      heartsLeft: null,
    });
    expect(accuracyClear.headline).toBe('NICE JOB!');
    expect(accuracyClear.eyebrow).toBe('★☆☆ · STAGE CLEAR');
    expect(accuracyClear.rankSeal).toEqual({ label: 'STAGE CLEAR', accent: 'gold' });
  });

  it('calls 2-star victories "GREAT WORK!" even with 0 mistakes and 0 health lost', () => {
    const twoStar = resolveVictoryCallout({
      stars: 2,
      endReason: 'defeated',
      damageReceived: 0,
      mistakes: 0,
      hasHearts: true,
      heartsLeft: 5,
      finalBlowDmg: 88,
    });
    expect(twoStar.headline).toBe('GREAT WORK!');
    expect(twoStar.eyebrow).toBe('★★☆ · FINAL BLOW · 88 DMG');
    expect(twoStar.rankSeal).toEqual({ label: 'UNSCATHED', accent: 'teal' });

    const twoStarBoss = resolveVictoryCallout({
      stars: 2,
      endReason: 'defeated',
      damageReceived: 2,
      mistakes: 1,
      hasHearts: true,
      heartsLeft: 3,
      isBoss: true,
    });
    expect(twoStarBoss.headline).toBe('GREAT WORK!');
    expect(twoStarBoss.eyebrow).toBe('★★☆ · BOSS VANQUISHED');
    expect(twoStarBoss.rankSeal).toEqual({ label: 'BOSS SLAYER', accent: 'gold' });
  });

  it('distinguishes 3-star victories by health lost (Flawless vs Heroic vs Clutch)', () => {
    const untouched = resolveVictoryCallout({
      stars: 3,
      endReason: 'defeated',
      damageReceived: 0,
      mistakes: 0,
      hasHearts: true,
      heartsLeft: 5,
    });
    expect(untouched.headline).toBe('FLAWLESS VICTORY!');
    expect(untouched.eyebrow).toBe('★★★ · UNTOUCHED · ZERO MISSES');
    expect(untouched.rankSeal).toEqual({ label: 'UNTOUCHED', accent: 'teal' });

    const battered = resolveVictoryCallout({
      stars: 3,
      endReason: 'defeated',
      damageReceived: 2,
      mistakes: 1,
      hasHearts: true,
      heartsLeft: 3,
    });
    expect(battered.headline).toBe('HEROIC VICTORY!');
    expect(battered.eyebrow).toBe('★★★ · BATTLE-SCARRED');
    expect(battered.rankSeal).toEqual({ label: 'BATTLE-TESTED', accent: 'gold' });

    const clutch = resolveVictoryCallout({
      stars: 3,
      endReason: 'defeated',
      damageReceived: 4,
      mistakes: 2,
      hasHearts: true,
      heartsLeft: 1,
    });
    expect(clutch.headline).toBe('CLUTCH VICTORY!');
    expect(clutch.eyebrow).toBe('★★★ · LAST HEART STANDING');
    expect(clutch.rankSeal).toEqual({ label: 'CLUTCH 3★', accent: 'coral' });
  });

  it('supports Starfall Summit starless knockouts cleanly', () => {
    const cleanSkirmish = resolveVictoryCallout({
      stars: null,
      endReason: 'defeated',
      damageReceived: 0,
      mistakes: 0,
      hasHearts: true,
      heartsLeft: 6,
    });
    expect(cleanSkirmish.headline).toBe('FLAWLESS VICTORY!');
    expect(cleanSkirmish.eyebrow).toBe('UNTOUCHED · FLOOR CLEARED');

    const damagedSkirmish = resolveVictoryCallout({
      stars: null,
      endReason: 'defeated',
      damageReceived: 2,
      mistakes: 1,
      hasHearts: true,
      heartsLeft: 4,
      finalBlowDmg: 120,
    });
    expect(damagedSkirmish.headline).toBe('GREAT WORK!');
    expect(damagedSkirmish.eyebrow).toBe('FINAL BLOW · 120 DMG');

    const clutchSkirmish = resolveVictoryCallout({
      stars: null,
      endReason: 'defeated',
      damageReceived: 5,
      mistakes: 2,
      hasHearts: true,
      heartsLeft: 1,
    });
    expect(clutchSkirmish.headline).toBe('CLUTCH VICTORY!');
    expect(clutchSkirmish.eyebrow).toBe('LAST HEART STANDING');

    const bossUntouched = resolveVictoryCallout({
      stars: null,
      endReason: 'defeated',
      damageReceived: 0,
      mistakes: 0,
      hasHearts: true,
      heartsLeft: 6,
      isBoss: true,
    });
    expect(bossUntouched.headline).toBe('FLAWLESS BOSS K.O.!');
    expect(bossUntouched.eyebrow).toBe('NOT A SCRATCH');
  });
});

describe('KillCamOverlay & LevelResults stay aligned across star tiers', () => {
  const cases: Array<{
    name: string;
    stars: 1 | 2 | 3;
    endReason: 'survived' | 'defeated';
    damageReceived: number;
    heartsLeft: number;
    expectedHeadline: string;
    expectKoTag: boolean;
  }> = [
    {
      name: '1-star survived with 0 mistakes',
      stars: 1,
      endReason: 'survived',
      damageReceived: 0,
      heartsLeft: 5,
      expectedHeadline: 'NICE JOB!',
      expectKoTag: false,
    },
    {
      name: '2-star knockout with 0 mistakes',
      stars: 2,
      endReason: 'defeated',
      damageReceived: 0,
      heartsLeft: 5,
      expectedHeadline: 'GREAT WORK!',
      expectKoTag: true,
    },
    {
      name: '3-star untouched knockout',
      stars: 3,
      endReason: 'defeated',
      damageReceived: 0,
      heartsLeft: 5,
      expectedHeadline: 'FLAWLESS VICTORY!',
      expectKoTag: true,
    },
    {
      name: '3-star battered knockout',
      stars: 3,
      endReason: 'defeated',
      damageReceived: 2,
      heartsLeft: 3,
      expectedHeadline: 'HEROIC VICTORY!',
      expectKoTag: true,
    },
    {
      name: '3-star 1-heart clutch knockout',
      stars: 3,
      endReason: 'defeated',
      damageReceived: 4,
      heartsLeft: 1,
      expectedHeadline: 'CLUTCH VICTORY!',
      expectKoTag: true,
    },
  ];

  for (const tc of cases) {
    it(`matches KillCamOverlay and LevelResults on ${tc.name}`, () => {
      const level = getLevel('1-4');
      const run = buildRun('1-4', {
        endReason: tc.endReason,
        foeHp: tc.endReason === 'defeated' ? 0 : 40,
        hearts: tc.heartsLeft,
        maxHearts: 5,
        mistakes: 0,
        challengeMet: tc.stars === 3,
        roundStats: { ...buildRun('1-4').roundStats, damageReceived: tc.damageReceived },
      });

      const killCam = render(
        <KillCamOverlay
          ignition={null}
          victory
          stars={tc.stars}
          endReason={tc.endReason}
          damageReceived={tc.damageReceived}
          mistakes={0}
          hasHearts
          heartsLeft={tc.heartsLeft}
          isBoss={false}
          anchors={stubAnchors}
          stageSize={{ w: 390, h: 844 }}
          enabled={false}
          reduced
        />
      );
      expect(killCam.getByTestId('kill-cam-headline').props.children).toBe(tc.expectedHeadline);
      killCam.unmount();

      const results = render(
        wrapSafe(
          <LevelResults
            level={level}
            run={run}
            stars={tc.stars}
            result={applyLevelResult(createMaxedSave(), level, tc.stars, 12, run)}
            unlocksRevealed
            nextLevel={getLevel('1-5')}
            nextUnlocked
            onRetry={jest.fn()}
            onNext={jest.fn()}
            onMap={jest.fn()}
            onCamp={jest.fn()}
          />
        )
      );
      expect(results.getByTestId('results-title').props.children).toBe(tc.expectedHeadline);
      if (tc.expectKoTag) {
        expect(results.queryByTestId('results-ko-tag')).not.toBeNull();
      } else {
        expect(results.queryByTestId('results-ko-tag')).toBeNull();
      }
      results.unmount();
    });
  }
});
