/**
 * Angry Birds 2–style Golden Rescue Keys & "Save Your Friends" Story tests.
 *
 * Covers:
 * - Data & road-geometry invariants for MAP_KEYS (consecutive same-biome nodes,
 *   1-to-1 match with unlockable friends, zero legacy star-reward fighter locks).
 * - Player choice in any order via `claimMapKey`, duplicate/unreached guards,
 *   legacy save backfill in `reconcileUnlocks`, and dynamic `unlockHint`.
 * - Full UI flow: tapping a ready Golden Key on AdventureMap → picking any caged
 *   friend in FriendRescueModal → freeing them → switching fighters → rescued
 *   badge on the road, plus "Save key for later".
 * - Updated 3-beat "Save Your Friends" StoryIntro (`abduction` → `keys` → `hero`).
 */
import React from 'react';
import { fireEvent, render, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CUE_NAMES } from '@/audio/band';
import { FIGHTERS, STARTING_FIGHTERS } from '@/adventure/data/fighters';
import { LEVELS, MAIN_LEVELS, getLevel } from '@/adventure/data/levels';
import {
  MAP_KEYS,
  RESCUABLE_FIGHTERS,
  isMapKeyClaimed,
  isMapKeyReached,
  lockedFighters,
  readyMapKeys,
} from '@/adventure/data/mapKeys';
import { starRewards, unlockHint } from '@/adventure/data/rewards';
import { STORY } from '@/adventure/data/story';
import {
  claimMapKey,
  createMaxedSave,
  createNewSave,
  createSaveBefore,
  reconcileUnlocks,
} from '@/adventure/progress';
import { createRun } from '@/adventure/engine/run';
import AdventureMode from '@/adventure/AdventureMode';
import StoryIntro from '@/adventure/components/StoryIntro';
import { companionMapGreeting } from '@/adventure/coach';

const mockKvStore = new Map<string, string>();
jest.mock('@/utils/storage', () => ({
  storage: {
    getString: (key: string) => mockKvStore.get(key),
    set: (key: string, val: string) => { mockKvStore.set(key, val); },
    remove: (key: string) => { mockKvStore.delete(key); },
  },
}));

jest.mock('@/audio', () => ({
  sfx: jest.fn(),
  music: { play: jest.fn(), stop: jest.fn() },
  band: {
    play: jest.fn(),
    stop: jest.fn(),
    halt: jest.fn(),
    cue: jest.fn(),
    select: jest.fn(),
    deselect: jest.fn(),
    payout: jest.fn(),
    evolve: jest.fn(),
    devolve: jest.fn(),
    audition: jest.fn(),
    auditionEvolution: jest.fn(),
    storyBeat: jest.fn(),
    slowMoDefeat: jest.fn(),
    finale: jest.fn(),
    setMood: jest.fn(),
    gridMs: 60,
    inFight: false,
  },
  setMusicEnabled: jest.fn(),
  setSfxOverride: jest.fn(),
}));

jest.mock('@/components/fighters', () => {
  const { Text: RNText } = require('react-native');
  return {
    FighterAvatar: ({ testID, character }: { testID?: string; character: string }) => (
      <RNText testID={testID}>{character}</RNText>
    ),
  };
});

jest.mock('@/components/enemies', () => {
  const { Text: RNText } = require('react-native');
  return {
    EnemyAvatar: ({ testID, enemy }: { testID?: string; enemy: { name: string } }) => (
      <RNText testID={testID}>{enemy.name}</RNText>
    ),
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
  insets: { top: 44, bottom: 34, left: 0, right: 0 },
};
const wrap = (node: React.ReactElement) => <SafeAreaProvider initialMetrics={INSETS}>{node}</SafeAreaProvider>;

describe('Golden Rescue Keys — data & progression', () => {
  it('places 5 keys one-to-one with rescueable friends on consecutive same-biome main road segments', () => {
    expect(MAP_KEYS).toHaveLength(RESCUABLE_FIGHTERS.length);
    const ids = new Set<string>();
    const defaults = new Set<string>();

    for (const k of MAP_KEYS) {
      expect(ids.has(k.id)).toBe(false);
      ids.add(k.id);

      const aIdx = MAIN_LEVELS.findIndex(l => l.id === k.afterLevel);
      const bIdx = MAIN_LEVELS.findIndex(l => l.id === k.beforeLevel);
      expect(aIdx).toBeGreaterThanOrEqual(0);
      expect(bIdx).toBe(aIdx + 1);
      // Same biome guarantees no biome header banner overlaps the key
      expect(MAIN_LEVELS[aIdx].biome).toBe(MAIN_LEVELS[bIdx].biome);

      expect(STARTING_FIGHTERS).not.toContain(k.defaultFighter);
      expect(FIGHTERS.some(f => f.name === k.defaultFighter)).toBe(true);
      expect(defaults.has(k.defaultFighter)).toBe(false);
      defaults.add(k.defaultFighter);
    }

    // No fixed character star rewards remain in campaign levels
    const fixedCharacterRewards = LEVELS.flatMap(l => starRewards(l).filter(r => Boolean(r.character)));
    expect(fixedCharacterRewards).toHaveLength(0);
  });

  it('registers keyFound and friendRescued cues in band audio', () => {
    expect(CUE_NAMES).toContain('keyFound');
    expect(CUE_NAMES).toContain('friendRescued');
  });

  it('lets the player free ANY caged friend in ANY order and enforces guards', () => {
    const fresh = createNewSave();
    expect(readyMapKeys(fresh)).toHaveLength(0);
    // Cannot claim an unreached key
    expect(claimMapKey(fresh, 'key-1', 'Pelican')).toBe(fresh);

    // Clear 1-5 -> key-1 becomes ready!
    let save = createSaveBefore('1-6', { leaveKeysReady: true });
    expect(isMapKeyReached(save, MAP_KEYS[0])).toBe(true);
    expect(isMapKeyClaimed(save, MAP_KEYS[0])).toBe(false);
    expect(readyMapKeys(save).map(k => k.id)).toEqual(['key-1']);
    expect(lockedFighters(save)).toHaveLength(5);

    // Choose Pelican FIRST (last in roster!) on key-1
    save = claimMapKey(save, 'key-1', 'Pelican');
    expect(save.unlockedFighters).toContain('Pelican');
    expect(save.claimedMapKeys['key-1']).toBe('Pelican');
    expect(readyMapKeys(save)).toHaveLength(0);

    // Double-claiming the same key is a no-op
    expect(claimMapKey(save, 'key-1', 'Corgi')).toBe(save);

    // Reach all remaining keys and claim in arbitrary order
    save = {
      ...save,
      stars: { ...save.stars, '1-9': 1, '2-5': 1, '2-9': 1, '3-5': 1 },
    };
    // Cannot re-claim an already-unlocked friend on key-2
    expect(claimMapKey(save, 'key-2', 'Pelican')).toBe(save);

    save = claimMapKey(save, 'key-2', 'Emperor Penguin');
    save = claimMapKey(save, 'key-3', 'Badger');
    save = claimMapKey(save, 'key-4', 'Corgi');
    save = claimMapKey(save, 'key-5', 'Sly Fox');

    expect(save.unlockedFighters).toHaveLength(FIGHTERS.length);
    expect(lockedFighters(save)).toHaveLength(0);
    expect(readyMapKeys(save)).toHaveLength(0);
  });

  it('migrates legacy saves cleanly in reconcileUnlocks without losing friends or duplicating keys', () => {
    const legacy = {
      ...createNewSave(),
      stars: { '1-1': 3, '1-5': 3, '1-9': 3, '2-5': 2 },
      unlockedFighters: ['Orange Tabby' as const, 'Sly Fox' as const, 'Corgi' as const],
      claimedMapKeys: {},
    };
    const reconciled = reconcileUnlocks(legacy);
    expect(reconciled.unlockedFighters).toEqual(['Orange Tabby', 'Sly Fox', 'Corgi']);
    expect(Object.keys(reconciled.claimedMapKeys)).toEqual(['key-1', 'key-2']);
    expect(Object.values(reconciled.claimedMapKeys)).toEqual(['Sly Fox', 'Corgi']);
    // key-3 (after 2-5) is immediately ready for the player's next choice!
    expect(readyMapKeys(reconciled).map(k => k.id)).toEqual(['key-3']);
  });

  it('produces accurate Golden Key unlock hints and companion map greeting', () => {
    const fresh = createNewSave();
    expect(unlockHint({ kind: 'fighter', id: 'Corgi' }, fresh)).toContain('Golden Key');
    expect(unlockHint({ kind: 'fighter', id: 'Corgi' }, fresh)).toContain('1-5');

    const ready = createSaveBefore('1-6', { leaveKeysReady: true });
    expect(unlockHint({ kind: 'fighter', id: 'Corgi' }, ready)).toContain('waiting on the map');
    expect(companionMapGreeting(ready, getLevel('1-6'), 15, false)).toContain('Golden Key');

    const maxed = createMaxedSave();
    expect(maxed.unlockedFighters).toHaveLength(FIGHTERS.length);
    expect(Object.keys(maxed.claimedMapKeys)).toHaveLength(MAP_KEYS.length);
  });
});

describe('Golden Rescue Keys — UI flow & Save Your Friends story', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockKvStore.clear();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('tapping a ready Golden Key on the map lets the player pick Corgi, frees them, and switches fighter', () => {
    const save = createSaveBefore('1-6', { leaveKeysReady: true });
    const screen = render(wrap(<AdventureMode initialSave={save} coldOpen={false} onExit={() => {}} />));

    // Ready Golden Key is rendered on the road
    const keyBtn = screen.getByTestId('map-key-key-1');
    expect(keyBtn.props.accessibilityState?.disabled).toBe(false);

    // Tap it → FriendRescueModal opens showing all 5 caged friends
    fireEvent.press(keyBtn);
    expect(screen.getByTestId('friend-rescue-modal')).toBeTruthy();
    expect(screen.getByTestId('rescue-option-Sly Fox')).toBeTruthy();
    expect(screen.getByTestId('rescue-option-Corgi')).toBeTruthy();
    expect(screen.getByTestId('rescue-option-Pelican')).toBeTruthy();

    // Deferring once leaves the key unclaimed on the map
    fireEvent.press(screen.getByTestId('rescue-later-btn'));
    expect(screen.queryByTestId('friend-rescue-modal')).toBeNull();

    // Re-open, select Corgi, and free Corgi!
    fireEvent.press(screen.getByTestId('map-key-key-1'));
    fireEvent.press(screen.getByTestId('rescue-option-Corgi'));
    fireEvent.press(screen.getByTestId('rescue-confirm-btn'));

    // Celebration phase plays and settles into PLAY AS CORGI!
    expect(screen.getByTestId('rescue-celebration')).toBeTruthy();
    act(() => { jest.advanceTimersByTime(900); });
    fireEvent.press(screen.getByTestId('rescue-use-fighter'));
    expect(screen.queryByTestId('friend-rescue-modal')).toBeNull();

    // Map key now displays Corgi's rescued badge!
    const freedKey = screen.getByTestId('map-key-key-1');
    expect(freedKey.props.accessibilityLabel).toContain('Corgi');
  });

  it('walking over key-1 automatically triggers after clearing 1-5 on both NEXT and MAP from LevelResults', () => {
    const level15 = getLevel('1-5');
    const before15 = createSaveBefore('1-5');
    const wonRun = {
      ...createRun(level15, before15, { seed: 7 }),
      status: 'won' as const,
      endReason: 'defeated' as const,
      foeHp: 0,
      matches: 6,
    };

    // Path 1: Tapping NEXT on 1-5 results walks onto key-1 between 1-5 and 1-6!
    const screenNext = render(
      wrap(
        <AdventureMode
          initialSave={before15}
          coldOpen={false}
          devResult={{ levelId: '1-5', run: wonRun, stars: 2 }}
          onExit={() => {}}
        />
      )
    );
    // Advance past stars & dismiss 1-5F secret path unlock if any
    act(() => { jest.advanceTimersByTime(3000); });
    if (screenNext.queryByTestId('unlock-reveal')) {
      fireEvent.press(screenNext.getByTestId('unlock-reveal'));
      act(() => { jest.advanceTimersByTime(1100); });
      if (screenNext.queryByTestId('unlock-later')) fireEvent.press(screenNext.getByTestId('unlock-later'));
      else if (screenNext.queryByTestId('unlock-primary')) fireEvent.press(screenNext.getByTestId('unlock-primary'));
      act(() => { jest.advanceTimersByTime(600); });
    }

    fireEvent.press(screenNext.getByTestId('results-next'));
    // Fighter bubble walks onto key-1, then opens FriendRescueModal automatically!
    expect(screenNext.getByTestId('map-key-walker')).toBeTruthy();
    act(() => { jest.advanceTimersByTime(600); });
    expect(screenNext.getByTestId('friend-rescue-modal')).toBeTruthy();

    // Free Pelican FIRST on key-1!
    fireEvent.press(screenNext.getByTestId('rescue-option-Pelican'));
    fireEvent.press(screenNext.getByTestId('rescue-confirm-btn'));
    act(() => { jest.advanceTimersByTime(800); });
    fireEvent.press(screenNext.getByTestId('rescue-use-fighter'));
    expect(screenNext.queryByTestId('friend-rescue-modal')).toBeNull();
    expect(screenNext.getByTestId('map-key-key-1').props.accessibilityLabel).toContain('Pelican');
    screenNext.unmount();

    // Path 2: Tapping MAP on 1-5 results also walks onto key-1 automatically!
    const screenMap = render(
      wrap(
        <AdventureMode
          initialSave={before15}
          coldOpen={false}
          devResult={{ levelId: '1-5', run: wonRun, stars: 1 }}
          onExit={() => {}}
        />
      )
    );
    act(() => { jest.advanceTimersByTime(2200); });
    fireEvent.press(screenMap.getByTestId('results-map'));
    expect(screenMap.getByTestId('map-key-walker')).toBeTruthy();
    act(() => { jest.advanceTimersByTime(600); });
    expect(screenMap.getByTestId('friend-rescue-modal')).toBeTruthy();
    screenMap.unmount();
  }, 30_000);

  it('StoryIntro plays all 3 "Save Your Friends" beats and supports Skip', () => {
    const onDone = jest.fn();
    const screen = render(wrap(<StoryIntro fighter="Orange Tabby" onDone={onDone} />));

    expect(STORY.welcome).toHaveLength(3);
    expect(screen.getByText(STORY.welcome[0].title)).toBeTruthy();

    fireEvent.press(screen.getByTestId('story-next'));
    expect(screen.getByText(STORY.welcome[1].title)).toBeTruthy();

    fireEvent.press(screen.getByTestId('story-next'));
    expect(screen.getByText(`“${STORY.welcome[2].title}”`)).toBeTruthy();

    fireEvent.press(screen.getByTestId('story-next'));
    expect(onDone).toHaveBeenCalledTimes(1);

    // Skip immediately exits from beat 1
    const onSkip = jest.fn();
    const skipped = render(wrap(<StoryIntro fighter="Orange Tabby" onDone={onSkip} />));
    fireEvent.press(skipped.getByTestId('story-skip'));
    expect(onSkip).toHaveBeenCalledTimes(1);
  });
});
