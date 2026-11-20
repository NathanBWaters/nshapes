/**
 * Brotato-style Cumulative Weapon/Passive Damage Story (`damageStory.ts`)
 * & Shared Component (`BattleDamageStory.tsx`) tests across Adventure Mode
 * and Starfall Spire.
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  buildDamageStory,
  buildSpireRunDamageStory,
  mergeSpireDamageLedger,
} from '@/adventure/engine/damageStory';
import { simulateRun, BOTS } from '@/adventure/engine/bot';
import { getLevel } from '@/adventure/data/levels';
import { applyLevelResult, createMaxedSave, createNewSave } from '@/adventure/progress';
import { computeStars } from '@/adventure/engine/run';
import BattleDamageStory from '@/adventure/components/BattleDamageStory';
import LevelResults from '@/adventure/components/LevelResults';
import SpireRewardScreen from '@/spire/components/SpireRewardScreen';
import SpireEndScreen from '@/spire/components/SpireEndScreen';
import { completeSpireBattle, createSpireRun, selectSpireNode } from '@/spire/engine/runState';
import { buildSpireWeaponBuilds, SPIRE_FIGHT_FEATURES, spireEncounterToLevel, spireHeldWeapons, spireRunOverrides, spireRunToVirtualSave } from '@/spire/engine/bridge';
import type { SpireLastFightSnapshot } from '@/spire/types';

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
  const band = new Proxy(
    {},
    {
      get: (_t, key) => (key === 'inFight' ? false : key === 'gridMs' ? 62.5 : () => undefined),
    }
  );
  return { band, sfx: () => undefined, sound: { play: () => undefined } };
});

jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => false }));

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { View: RNView, Text: RNText } = require('react-native');
  return function MockIcon({ name }: { name: string }) {
    return ReactActual.createElement(
      RNView,
      { testID: `icon-${name}` },
      ReactActual.createElement(RNText, null, name)
    );
  };
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

const wrap = (node: React.ReactElement) => (
  <SafeAreaProvider
    initialMetrics={{
      frame: { x: 0, y: 0, width: 390, height: 844 },
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
    }}
  >
    {node}
  </SafeAreaProvider>
);

const noop = () => {};

const runGearedFight = () => {
  const save = createMaxedSave();
  const level = getLevel('2-4');
  const sim = simulateRun(level, save, BOTS.expert, 7);
  return { save, level, run: sim.state };
};

describe('damageStory attribution & timeline engine', () => {
  it('conserves exact fight damage and produces monotonic cumulative timelines on a geared Adventure fight', () => {
    const { run } = runGearedFight();
    const story = buildDamageStory(run);

    expect(story.totalDamage).toBeGreaterThan(0);
    expect(story.xAxisMode).toBe('time');
    expect(story.sources.length).toBeGreaterThanOrEqual(3);
    expect(story.chartSources.length).toBeGreaterThan(0);
    expect(story.chartSources.length).toBeLessThanOrEqual(5);

    // Conservation: sum of individual sources equals total fight damage within rounding tolerance
    const attributedSum = story.sources.reduce((acc, s) => acc + s.totalDamage, 0);
    expect(Math.abs(attributedSum - story.totalDamage)).toBeLessThanOrEqual(story.sources.length);

    // Sources sorted descending by cumulative damage
    for (let i = 1; i < story.sources.length; i++) {
      expect(story.sources[i - 1].totalDamage).toBeGreaterThanOrEqual(story.sources[i].totalDamage);
    }

    // Weapon attribution includes canonical weaponId so WeaponExplainer can inspect it
    const weapons = story.sources.filter(s => s.kind === 'weapon');
    expect(weapons.length).toBeGreaterThan(0);
    for (const w of weapons) {
      expect(typeof w.weaponId).toBe('string');
      expect(w.weaponId!.length).toBeGreaterThan(0);
    }

    // Timeline starts at 0 and climbs monotonically to totalDamage
    expect(story.points[0].totalCumulative).toBe(0);
    for (let i = 1; i < story.points.length; i++) {
      expect(story.points[i].totalCumulative).toBeGreaterThanOrEqual(story.points[i - 1].totalCumulative);
    }
    expect(Math.round(story.points[story.points.length - 1].totalCumulative)).toBe(Math.round(story.totalDamage));

    // Crescendo beats stay cleanly inside [0.06, 0.985] and strictly ascending
    expect(story.crescendoBeats.length).toBeGreaterThan(0);
    expect(story.crescendoBeats.length).toBeLessThanOrEqual(7);
    for (let i = 0; i < story.crescendoBeats.length; i++) {
      const b = story.crescendoBeats[i];
      expect(b.progress).toBeGreaterThanOrEqual(0.06);
      expect(b.progress).toBeLessThanOrEqual(0.985);
      if (i > 0) expect(b.pointIndex).toBeGreaterThan(story.crescendoBeats[i - 1].pointIndex);
    }

    expect(story.headline.length).toBeGreaterThan(10);
  });

  it('accumulates floor-by-floor Spire damage across wins and defeats into a full-climb story', () => {
    const { run: fight1 } = runGearedFight();
    const { run: fight2 } = runGearedFight();

    const step1 = mergeSpireDamageLedger(undefined, undefined, 1, fight1);
    const step2 = mergeSpireDamageLedger(step1.sourceDamage, step1.floorLedger, 2, fight2);

    expect(step2.floorLedger).toHaveLength(2);
    expect(step2.floorLedger[0].floor).toBe(1);
    expect(step2.floorLedger[1].floor).toBe(2);

    const climbStory = buildSpireRunDamageStory(step2.sourceDamage, step2.floorLedger);
    expect(climbStory).not.toBeNull();
    expect(climbStory!.xAxisMode).toBe('floors');
    expect(climbStory!.points).toHaveLength(3); // Start + Fl 1 + Fl 2
    expect(climbStory!.points[0].label).toBe('Start');
    expect(climbStory!.points[1].label).toBe('Fl 1');
    expect(climbStory!.points[2].label).toBe('Fl 2');
    expect(Math.round(climbStory!.totalDamage)).toBe(Math.round(fight1.totalDamage + fight2.totalDamage));

    // Complete a real Spire battle (both victory & defeat) and verify sourceDamage persists on SpireRun.stats
    let spire = createSpireRun('Orange Tabby', 0, 101);
    const firstNode = spire.map.nodes.find(n => n.row === 0 && n.encounter);
    expect(firstNode).toBeTruthy();
    spire = selectSpireNode(spire, firstNode!.id);
    const lvl = spireEncounterToLevel(spire, spire.activeEncounter!);
    const simWon = simulateRun(lvl, createNewSave(), BOTS.expert, 17).state;
    const wonSpire = completeSpireBattle(spire, { ...simWon, status: 'won', endReason: 'defeated', foeHp: 0 });
    expect(wonSpire.stats.sourceDamage).toBeDefined();
    expect(wonSpire.stats.floorLedger).toHaveLength(1);
    expect(Object.keys(wonSpire.stats.sourceDamage!).length).toBeGreaterThan(0);

    const lostSpire = completeSpireBattle(spire, { ...simWon, status: 'lost', endReason: 'hearts', hearts: 0 });
    expect(lostSpire.phase).toBe('defeat');
    expect(lostSpire.stats.sourceDamage).toBeDefined();
    expect(lostSpire.stats.floorLedger).toHaveLength(1);
  });

  it('attributes Spire fights with zero Power Scaling and credits active Evolutions by their canonical name & kind', () => {
    let spire = createSpireRun('Corgi', 0, 2027);
    const firstNode = spire.map.nodes.find(n => n.row === 0 && n.encounter)!;
    spire = selectSpireNode(spire, firstNode.id);
    const sim = simulateRun(
      spireEncounterToLevel(spire, spire.activeEncounter!),
      spireRunToVirtualSave(spire),
      BOTS.expert,
      42,
      undefined,
      {
        skipPicks: true,
        features: new Set(SPIRE_FIGHT_FEATURES),
        overrides: spireRunOverrides(spire),
      }
    );
    const story = buildDamageStory(sim.state);
    expect(story.sources.find(s => s.kind === 'power')).toBeUndefined();
    expect(story.sources.find(s => s.name === 'Active Evolution')).toBeUndefined();
    if (sim.state.forgedRecipes.length > 0) {
      const evos = story.sources.filter(s => s.kind === 'evolution');
      expect(evos.length).toBeGreaterThan(0);
    }
  });
});

describe('BattleDamageStory shared UI across Adventure Mode and Starfall Spire', () => {
  it('renders by default on geared LevelResults and opens canonical WeaponExplainer when tapping a weapon row', () => {
    const { save, level, run } = runGearedFight();
    const stars = Math.max(1, computeStars(run));
    const result = applyLevelResult(save, level, stars, 0, run);
    const story = buildDamageStory(run);
    const weaponIdx = story.sources.slice(0, 4).findIndex(s => s.kind === 'weapon');

    const view = render(
      wrap(
        <LevelResults
          level={level}
          run={run}
          stars={stars}
          result={result}
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

    expect(view.getByTestId('battle-damage-story')).toBeTruthy();
    expect(view.getByTestId('battle-damage-story-chart')).toBeTruthy();
    expect(view.getByTestId('battle-damage-story-rows')).toBeTruthy();
    expect(view.getByTestId('battle-damage-story-replay-btn')).toBeTruthy();

    // Tap a row (weapon if in top 4, else row 0) to isolate its curve & open inline inspector
    const tapIdx = weaponIdx >= 0 ? weaponIdx : 0;
    fireEvent.press(view.getByTestId(`battle-damage-story-row-${tapIdx}`));
    expect(view.getByTestId('battle-damage-story-inspector')).toBeTruthy();
  });

  it('respects reduced motion by hiding the 3s replay trigger and showing final total immediately', () => {
    const { run } = runGearedFight();
    const story = buildDamageStory(run);
    const view = render(
      wrap(<BattleDamageStory story={story} weaponBuilds={run.weaponBuilds} reduced muted />)
    );
    expect(view.queryByTestId('battle-damage-story-replay-btn')).toBeNull();
    expect(view.getByTestId('battle-damage-story-total').props.children.join('')).toContain(
      Math.round(story.totalDamage).toLocaleString()
    );
  });

  it('renders by default on SpireRewardScreen and SpireEndScreen (with Climb / Last Fight scope toggle)', () => {
    const { run: fight1 } = runGearedFight();
    const { run: fight2 } = runGearedFight();
    let spire = createSpireRun('Sly Fox', 0, 555);
    const firstNode = spire.map.nodes.find(n => n.row === 0 && n.encounter)!;
    spire = selectSpireNode(spire, firstNode.id);
    // Win floor 1
    spire = completeSpireBattle(spire, { ...fight1, status: 'won', endReason: 'defeated', foeHp: 0 });
    const snapshot: SpireLastFightSnapshot = {
      run: fight2,
      weapons: spireHeldWeapons(spire),
      builds: buildSpireWeaponBuilds(spire),
    };

    const rewardView = render(
      wrap(
        <SpireRewardScreen
          run={spire}
          reward={spire.reward!}
          lastFight={snapshot}
          onClaimWeapon={noop}
          onRerollWeapons={noop}
          onSkipWeapon={noop}
          onClaimArcana={noop}
          onSkipArcana={noop}
          onClaimSkill={noop}
          onSkipSkill={noop}
          onContinue={noop}
        />
      )
    );
    expect(rewardView.getByTestId('spire-reward-damage-story')).toBeTruthy();
    expect(rewardView.getByTestId('spire-reward-damage-story-chart')).toBeTruthy();
    rewardView.unmount();

    // Add a 2nd floor to spire.stats so SpireEndScreen offers both Full Climb and Final Fight toggle
    const merged2 = mergeSpireDamageLedger(spire.stats.sourceDamage, spire.stats.floorLedger, 2, fight2);
    const endedSpire = {
      ...spire,
      floor: 2,
      phase: 'victory' as const,
      stats: { ...spire.stats, ...merged2, floorsCleared: 2 },
    };

    const endView = render(
      wrap(
        <SpireEndScreen
          run={endedSpire}
          victory
          lastFight={snapshot}
          onNewRun={noop}
          onExitToMenu={noop}
        />
      )
    );
    expect(endView.getByTestId('spire-end-damage-story')).toBeTruthy();
    expect(endView.getByTestId('spire-story-scope-climb')).toBeTruthy();
    expect(endView.getByTestId('spire-story-scope-final')).toBeTruthy();

    fireEvent.press(endView.getByTestId('spire-story-scope-final'));
    expect(endView.getByText('FINAL FIGHT DAMAGE')).toBeTruthy();
    fireEvent.press(endView.getByTestId('spire-story-scope-climb'));
    expect(endView.getByText('FULL CLIMB DAMAGE')).toBeTruthy();
  });
});
