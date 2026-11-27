import React from 'react';
import { Platform } from 'react-native';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
  MusicStorage: { get: () => true, set: jest.fn(), hasValue: () => true, subscribe: () => () => {} },
  SoundStorage: { get: () => true, set: jest.fn(), subscribe: () => () => {} },
  ColorblindStorage: { get: () => false, set: jest.fn(), subscribe: () => () => {} },
}));

jest.mock('@/audio', () => {
  const b = {
    current: null as string | null,
    inFight: false,
    gridMs: 62.5,
    play: jest.fn((name: string) => {
      b.current = name;
    }),
    playScreenMusic: jest.fn((screen: string) => {
      b.current = screen === 'freeplay' ? 'title' : screen;
    }),
    setStoryHeroMode: jest.fn(),
    fighterCall: jest.fn(),
    stop: jest.fn(() => {
      b.current = null;
    }),
    halt: jest.fn(),
    enterFight: jest.fn(),
    leaveFight: jest.fn(),
    setMood: jest.fn(),
    cue: jest.fn(),
    fire: jest.fn(),
    payout: jest.fn(),
    stretch: jest.fn(() => null),
    finale: jest.fn(),
    slowMoDefeat: jest.fn(),
    playCutInEvolve: jest.fn(),
    playWeaponPickReelStop: jest.fn(),
  };
  return {
    sfx: jest.fn(),
    music: b,
    band: b,
    setMusicEnabled: jest.fn(),
    setSfxOverride: jest.fn(),
  };
});

jest.mock('@/hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}));

jest.mock('@/hooks/useAppActive', () => ({
  useAppActive: () => true,
}));

jest.mock('@/components/Icon', () => {
  const ReactActual = require('react');
  const { View } = require('react-native');
  const MockIcon = ({ name }: { name: string }) =>
    ReactActual.createElement(View, { accessibilityLabel: `icon-${name}` });
  return { __esModule: true, default: MockIcon, Icon: MockIcon };
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

jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
}));

import { band } from '@/audio';
import AdventureMode from '@/adventure/AdventureMode';
import AdventureRun from '@/adventure/components/AdventureRun';
import Camp from '@/adventure/components/Camp';
import LevelResults from '@/adventure/components/LevelResults';
import StoryIntro from '@/adventure/components/StoryIntro';
import { getBiome } from '@/adventure/data/biomes';
import { getLevel } from '@/adventure/data/levels';
import { createRun, runReducer } from '@/adventure/engine/run';
import { applyLevelResult, createMaxedSave } from '@/adventure/progress';
import FreePlayMode from '@/components/FreePlayMode';
import MainMenu from '@/components/MainMenu';
import { __setHapticsModuleForTests, HapticsStorage } from '@/utils/haptics';

const SAFE_METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

const wrap = (node: React.ReactNode) => (
  <SafeAreaProvider initialMetrics={SAFE_METRICS}>{node}</SafeAreaProvider>
);

describe('Wave 3 Integration: Labs, Aura, Screen Music, Summit & Haptics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockKvStore.clear();
    (band as unknown as { current: string | null }).current = null;
  });

  it('wires all 8 DEV_* reducer actions cleanly in sandbox/dev runs', () => {
    const save = {
      ...createMaxedSave(),
      charms: ['blast-powder', 'mending-charm'],
      equippedArcana: [],
    };
    const level = getLevel('1-4D');
    let state = createRun(level, save, { seed: 777 });

    // DEV_SET_FOE_HP
    state = runReducer(state, { type: 'DEV_SET_FOE_HP', hp: 1 });
    expect(state.foeHp).toBe(1);

    // DEV_FREEZE_CLOCK halts TICK advancement
    const beforeTickMs = state.elapsedMs;
    state = runReducer(state, { type: 'DEV_FREEZE_CLOCK', frozen: true });
    expect(state.devClockFrozen).toBe(true);
    state = runReducer(state, { type: 'TICK', ms: 1000 });
    expect(state.elapsedMs).toBe(beforeTickMs);
    state = runReducer(state, { type: 'DEV_FREEZE_CLOCK', frozen: false });
    state = runReducer(state, { type: 'TICK', ms: 500 });
    expect(state.elapsedMs).toBe(beforeTickMs + 500);

    // DEV_ADVANCE_EVO advances charging progress and DEV_TRIGGER_EVO ignites the weapon's equipped timed evolution
    state = runReducer(state, { type: 'DEV_ADVANCE_EVO', weaponId: 'blast-powder', amount: 1 });
    expect(state.weaponEvolutions.find(e => e.weaponId === 'blast-powder')?.progress).toBeGreaterThanOrEqual(1);
    state = runReducer(state, { type: 'DEV_TRIGGER_EVO', weaponId: 'blast-powder' });
    const blastEvo = state.weaponEvolutions.find(e => e.weaponId === 'blast-powder');
    expect(blastEvo?.phase).toBe('active');
    expect(blastEvo?.activeRemainingMs).toBeGreaterThan(0);

    // DEV_TRIGGER_PARRY opens windup & perfect windows with specific counter
    state = runReducer(state, {
      type: 'DEV_TRIGGER_PARRY',
      window: 'perfect',
      counter: { kind: 'color', color: 'red' },
    });
    expect(state.parry?.phase).toBe('windup');
    expect(state.parry?.warned).toBe(true);
    expect(state.parry?.spec.counter).toEqual({ kind: 'color', color: 'red' });

    // DEV_TOGGLE_SURGE activates and deactivates Shading Surge cleanly
    state = runReducer(state, { type: 'DEV_TOGGLE_SURGE' });
    expect(state.surge?.active).toBe(true);
    expect(state.attributes).toContain('shading');
    state = runReducer(state, { type: 'DEV_TOGGLE_SURGE' });
    expect(state.surge?.active).toBe(false);
    expect(state.attributes).not.toContain('shading');

    // DEV_SWAP_LOADOUT swaps fighter, toggles/upgrades weapons & toggles Arcana
    state = runReducer(state, { type: 'DEV_SWAP_LOADOUT', fighter: 'Sly Fox' });
    expect(state.fighter).toBe('Sly Fox');
    state = runReducer(state, { type: 'DEV_SWAP_LOADOUT', weaponId: 'flint-spark', weaponLevel: 4 });
    expect(state.weapons.some(w => w.id === 'flint-spark')).toBe(true);
    expect(state.weaponBuilds['flint-spark']?.level).toBe(4);
    state = runReducer(state, { type: 'DEV_SWAP_LOADOUT', toggleWeaponId: 'flint-spark' });
    expect(state.weapons.some(w => w.id === 'flint-spark')).toBe(false);
    state = runReducer(state, { type: 'DEV_SWAP_LOADOUT', toggleArcanaId: 'prismatic_fever' });
    expect(state.arcana).toContain('prismatic_fever');

    // DEV_SET_HEARTS updates hearts cleanly
    state = runReducer(state, { type: 'DEV_SET_HEARTS', hearts: 2 });
    expect(state.hearts).toBe(2);

    // DEV_RESET_DUMMY zeroes DPS/log/elapsedMs and restores dummy HP & hearts
    state = runReducer(state, { type: 'DEV_RESET_DUMMY' });
    expect(state.totalDamage).toBe(0);
    expect(state.biggestHit).toBe(0);
    expect(state.elapsedMs).toBe(0);
    expect(state.foeHp).toBe(state.foeMaxHp);
    expect(state.log).toHaveLength(1);
    expect(state.log[0].damage).toBe(0);
  });

  it('mounts TrainingLabBar, FightDebugDrawer & FighterBuildAura in AdventureRun', () => {
    const save = {
      ...createMaxedSave(),
      charms: ['blast-powder', 'flint-spark'],
      equippedArcana: ['prismatic_fever' as const],
    };
    const onSandboxReturn = jest.fn();
    const view = render(
      wrap(
        <AdventureRun
          level={getLevel('1-4D')}
          save={save}
          seed={1234}
          onFinish={jest.fn()}
          onQuit={jest.fn()}
          onRestart={jest.fn()}
          onCoachMarkSeen={jest.fn()}
          sandboxReturnLabel="Back to Camp"
          onSandboxReturn={onSandboxReturn}
        />
      )
    );

    expect(view.getByTestId('training-lab-bar')).toBeTruthy();
    expect(view.getByTestId('fight-debug-drawer')).toBeTruthy();
    expect(view.getByTestId('adventure-run-fighter-aura')).toBeTruthy();

    fireEvent.press(view.getByTestId('training-lab-return'));
    expect(onSandboxReturn).toHaveBeenCalledTimes(1);
    view.unmount();
  });

  it('routes Camp & LevelPreview Test Loadout straight into 1-4D and back with zero map detour', () => {
    jest.useFakeTimers();
    const save = {
      ...createMaxedSave(),
      charms: ['blast-powder', 'flint-spark'],
    };
    const view = render(wrap(<AdventureMode initialSave={save} coldOpen={false} onExit={jest.fn()} />));

    // 1. From Camp -> Armory tab -> Test Loadout -> Back to Camp returns straight to Armory tab!
    fireEvent.press(view.getByTestId('map-dock-camp'));
    act(() => {
      jest.advanceTimersByTime(400);
    });
    fireEvent.press(view.getByTestId('camp-tab-armory'));
    expect(view.getByTestId('camp-armory-search')).toBeTruthy();

    fireEvent.press(view.getByTestId('camp-test-loadout'));
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(view.getByTestId('training-lab-bar')).toBeTruthy();
    expect(view.getByText('Back to Camp')).toBeTruthy();

    fireEvent.press(view.getByTestId('training-lab-return'));
    act(() => {
      jest.advanceTimersByTime(400);
    });
    // Back directly on Camp's Armory tab — no map detour!
    expect(view.getByTestId('camp-armory-search')).toBeTruthy();

    // 2. From LevelPreview -> Test Loadout -> Back to Preview returns straight to the exact LevelPreview!
    fireEvent.press(view.getByLabelText('Back to camp'));
    fireEvent.press(view.getByLabelText('Back to map'));
    act(() => {
      jest.advanceTimersByTime(400);
    });
    fireEvent.press(view.getByTestId('map-node-1-5'));
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(view.getByTestId('preview-test-loadout')).toBeTruthy();

    fireEvent.press(view.getByTestId('preview-test-loadout'));
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(view.getByTestId('training-lab-bar')).toBeTruthy();
    expect(view.getByText('Back to Preview')).toBeTruthy();

    fireEvent.press(view.getByTestId('training-lab-return'));
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(view.getByTestId('preview-play')).toBeTruthy();

    act(() => {
      jest.runOnlyPendingTimers();
    });
    view.unmount();
    jest.useRealTimers();
  });

  it('wires [AU-18] Summit biome music, [AU-20] screen tracks & [AU-21] star stamp haptics', async () => {
    expect(getBiome('summit').music).toBe('summit');

    // MainMenu -> 'title'
    const menu = render(
      wrap(
        <MainMenu
          onSelectAdventure={jest.fn()}
          onSelectFreeplay={jest.fn()}
          onSelectOptions={jest.fn()}
        />
      )
    );
    expect(band.playScreenMusic).toHaveBeenCalledWith('title');
    menu.unmount();

    // StoryIntro -> 'story' + Beat 3 hero brightening
    const story = render(wrap(<StoryIntro fighter="Orange Tabby" onDone={jest.fn()} />));
    expect(band.playScreenMusic).toHaveBeenCalledWith('story');
    expect(band.setStoryHeroMode).toHaveBeenCalledWith(false);
    fireEvent.press(story.getByTestId('story-next'));
    fireEvent.press(story.getByTestId('story-next'));
    expect(band.setStoryHeroMode).toHaveBeenCalledWith(true);
    story.unmount();

    // Camp -> 'camp'
    const camp = render(wrap(<Camp save={createMaxedSave()} onChange={jest.fn()} onClose={jest.fn()} />));
    expect(band.playScreenMusic).toHaveBeenCalledWith('camp');
    camp.unmount();

    // FreePlayMode -> 'freeplay'
    const fp = render(wrap(<FreePlayMode onExit={jest.fn()} />));
    expect(band.playScreenMusic).toHaveBeenCalledWith('freeplay');
    fp.unmount();

    // LevelResults -> fires star stamp haptics on native when enabled
    jest.useFakeTimers();
    const origOS = Platform.OS;
    Object.defineProperty(Platform, 'OS', { value: 'ios', configurable: true });
    HapticsStorage.set(true);
    const mockImpact = jest.fn(() => Promise.resolve());
    const mockNotify = jest.fn(() => Promise.resolve());
    __setHapticsModuleForTests({
      ImpactFeedbackStyle: { Light: 'L', Medium: 'M', Heavy: 'H' },
      NotificationFeedbackType: { Success: 'S', Error: 'E', Warning: 'W' },
      impactAsync: mockImpact,
      notificationAsync: mockNotify,
      selectionAsync: jest.fn(() => Promise.resolve()),
    });

    const save = createMaxedSave();
    const lvl = getLevel('1-2');
    const run = { ...createRun(lvl, save, { seed: 42 }), status: 'won' as const, endReason: 'defeated' as const };
    const result = applyLevelResult(save, lvl, 3, 10, run);
    const resView = render(
      wrap(
        <LevelResults
          level={lvl}
          run={run}
          stars={3}
          result={result}
          unlocksRevealed
          nextLevel={getLevel('1-3')}
          nextUnlocked
          onRetry={jest.fn()}
          onNext={jest.fn()}
          onMap={jest.fn()}
          onCamp={jest.fn()}
        />
      )
    );
    await act(async () => {
      jest.advanceTimersByTime(2500);
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      jest.advanceTimersByTime(100);
      await Promise.resolve();
    });
    expect(mockImpact).toHaveBeenCalledWith('M');
    expect(mockImpact).toHaveBeenCalledWith('H');
    expect(mockNotify).toHaveBeenCalledWith('S');

    resView.unmount();
    __setHapticsModuleForTests(null);
    Object.defineProperty(Platform, 'OS', { value: origOS, configurable: true });
    jest.useRealTimers();
  });
});
