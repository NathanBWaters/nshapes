/**
 * Secret side paths and the practice dummy.
 *
 * Side paths (elite branches, fighter trials, practice) are not on the map
 * until they open; opening one is revealed after the result that earned it and
 * plays once on the map. The practice level behind 1-4 is a fight that cannot
 * end: the dummy's health never moves, there is no clock or move limit, hearts
 * refill, and nothing is banked.
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AdventureMap from '@/adventure/components/AdventureMap';
import AdventureMode from '@/adventure/AdventureMode';
import LevelPreview from '@/adventure/components/LevelPreview';
import UnlockReveal from '@/adventure/components/UnlockReveal';
import { BRANCH_STAR_REQUIREMENT, LEVELS, MAIN_LEVELS, PRACTICE_LEVELS, SIDE_PATHS, branchStars, getLevel, isPathHidden } from '@/adventure/data/levels';
import { MECHANICS } from '@/adventure/data/mechanics';
import { CAMPAIGN_STARS } from '@/adventure/data/skillTrees';
import { starRewards, unlockHint, unlockSource, unlockablesOf } from '@/adventure/data/rewards';
import { computeStars, createRun, runReducer } from '@/adventure/engine/run';
import { getFeaturesForLevel, startingLoadout } from '@/adventure/loadout';
import {
  COACH_KEYS,
  applyLevelResult,
  createMaxedSave,
  createNewSave,
  freshPaths,
  getLockReason,
  markPathsRevealed,
  openPaths,
  pathsSeenBeforeSecrets,
} from '@/adventure/progress';
import { loadAdventureSave } from '@/adventure/save';
import { storage } from '@/utils/storage';
import type { AdventureSave, RunState } from '@/adventure/types';
import { eventsOf, miss, playSet, tick } from './testUtils/adventureFight';

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
}));

jest.mock('@/utils/storage', () => ({
  storage: { getString: jest.fn(() => undefined), set: jest.fn() },
}));

jest.mock('@/audio', () => {
  const band = new Proxy({}, { get: (_t, key) => (key === 'inFight' ? false : key === 'gridMs' ? 62.5 : () => undefined) });
  return { sfx: jest.fn(), music: band, band, setMusicEnabled: jest.fn(), setSfxOverride: jest.fn() };
});

let mockReducedMotion = false;
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReducedMotion }));

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

const DUMMY = PRACTICE_LEVELS[0];
const PARENT = getLevel(DUMMY.branchOf!);

/** A save with this many stars on every main level up to and including `lastId`. */
const clearedThrough = (lastId: string, stars = 1): AdventureSave => {
  let save = createNewSave();
  for (const l of MAIN_LEVELS.slice(0, MAIN_LEVELS.findIndex(x => x.id === lastId) + 1)) save = applyLevelResult(save, l, stars, 0).save;
  return save;
};

const noop = () => {};

describe('the practice level', () => {
  it('hangs off 1-4, opens on any clear of it, and is not part of the campaign', () => {
    expect(DUMMY.branchOf).toBe('1-4');
    expect(branchStars(DUMMY)).toBe(1);
    expect(DUMMY.rules.sandbox).toBe(true);
    expect(DUMMY.rules.timer).toBeUndefined();
    expect(DUMMY.rules.moves).toBeUndefined();
    expect(LEVELS).not.toContain(DUMMY);
    expect(CAMPAIGN_STARS).toBe(LEVELS.length * 3);
    expect(starRewards(DUMMY).every(r => r.coins === 0 && unlockablesOf(r).length === 0)).toBe(true);
    expect(MECHANICS[DUMMY.introduces]).toBeDefined();
    expect(getLevel(DUMMY.id)).toBe(DUMMY);
  });

  it('every side path hangs off a level that exists, and campaign branches open at ★★', () => {
    for (const path of SIDE_PATHS) {
      expect(() => getLevel(path.branchOf!)).not.toThrow();
      if (!path.rules.sandbox) expect(branchStars(path)).toBe(BRANCH_STAR_REQUIREMENT);
    }
  });
});

describe('a practice fight', () => {
  const start = (save: AdventureSave = clearedThrough(PARENT.id)): RunState => createRun(DUMMY, save, { seed: 7 });

  it('has no clock and no move limit, and the dummy cannot be knocked out', () => {
    let s = start();
    expect(s.timeLeft).toBeNull();
    expect(s.movesLeft).toBeNull();
    const hp = s.foeHp;
    for (let i = 0; i < 60; i++) s = playSet(s);
    expect(s.status).toBe('playing');
    expect(s.foeHp).toBe(hp);
    expect(s.matches).toBe(60);
    // The damage still counts, far past the dummy's nominal health
    expect(s.totalDamage).toBeGreaterThan(hp);
    expect(s.biggestHit).toBeGreaterThan(0);
    s = tick(s, 10 * 60 * 1000, 1000);
    expect(s.status).toBe('playing');
    expect(computeStars(s)).toBe(0);
  });

  it('refills the hearts instead of ending when they run out', () => {
    let s = start();
    const hearts = s.maxHearts!;
    expect(hearts).toBeGreaterThan(0);
    // Mistake after mistake: whatever saves the fighter first (Nine Lives), the fight never ends
    let misses = 0;
    while (eventsOf(s, 'breather').length === 0 && misses < hearts + 3) {
      s = runReducer(s, { type: 'CLEAR_EVENTS', upTo: s.eventSeq });
      s = miss(s);
      misses += 1;
      expect(s.status).toBe('playing');
    }
    expect(misses).toBeGreaterThanOrEqual(hearts);
    expect(eventsOf(s, 'breather')).toEqual([expect.objectContaining({ amount: hearts })]);
    expect(s.hearts).toBe(hearts);
    // A real level is lost by the same mistakes
    let real = createRun(PARENT, clearedThrough(PARENT.id), { seed: 7 });
    for (let i = 0; i < misses && real.status === 'playing'; i++) real = miss(real);
    expect(real.status).toBe('lost');
  });

  it('lifts the limit on evolutions', () => {
    expect(start().evolutionCap).toBe(Infinity);
    expect(startingLoadout(DUMMY, clearedThrough(PARENT.id)).evolutionCap).toBe(Infinity);
    expect(Number.isFinite(createRun(PARENT, clearedThrough(PARENT.id), { seed: 1 }).evolutionCap)).toBe(true);
  });

  it('switches on everything the player has learned, wherever that was taught', () => {
    const rainbow = MAIN_LEVELS.find(l => MECHANICS[l.introduces].enables === 'rainbow')!;
    const hints = MAIN_LEVELS.find(l => MECHANICS[l.introduces].enables === 'hints')!;
    const early = clearedThrough(PARENT.id);
    expect(getFeaturesForLevel(DUMMY, early).has('hearts')).toBe(true);
    expect(getFeaturesForLevel(DUMMY, early).has('rainbow')).toBe(false);
    expect(getFeaturesForLevel(DUMMY, early).has('hints')).toBe(false);
    // Clearing the level that teaches it is enough
    expect(getFeaturesForLevel(DUMMY, clearedThrough(rainbow.id)).has('rainbow')).toBe(true);
    // So is having sat through its lesson
    expect(getFeaturesForLevel(DUMMY, { ...early, seenMechanics: [hints.introduces] }).has('hints')).toBe(true);
    // A campaign level still only has what was taught up to it
    expect(getFeaturesForLevel(PARENT, clearedThrough(rainbow.id)).has('rainbow')).toBe(false);
  });

  it('keeps its log bounded however long it runs', () => {
    let s = start();
    for (let i = 0; i < 450; i++) s = playSet(s);
    expect(s.log.length).toBeLessThanOrEqual(400);
    // The opening entry stays; the oldest moves are the ones dropped
    expect(s.log[0].t).toBe(0);
    expect(s.log[s.log.length - 1].kind).toBe('set');
  });

  it('banks nothing: no stars, coins or bounty progress, only a play and the recipes forged', () => {
    const save = { ...clearedThrough(PARENT.id), coinsUnlocked: true, bountiesUnlocked: true };
    let s = start(save);
    for (let i = 0; i < 20; i++) s = playSet(s);
    s = { ...s, forgedRecipes: ['phoenix-pyre'] };
    const result = applyLevelResult(save, DUMMY, computeStars(s), s.coins, s);
    expect(result.save.coins).toBe(save.coins);
    expect(result.save.lifetimeCoins).toBe(save.lifetimeCoins);
    expect(result.save.stars).toEqual(save.stars);
    expect(result.save.bountyStats).toEqual(save.bountyStats);
    expect(result.save.plays[DUMMY.id]).toBe(1);
    expect(result.save.discoveredEvolutions).toContain('phoenix-pyre');
    expect(result.unlocks).toEqual([]);
    expect(result.coinsBanked + result.starCoins + result.bountyCoins).toBe(0);
  });
});

describe('side paths are secret until they open', () => {
  it('a new save has none open, and the dummy opens with the first star on 1-4', () => {
    expect(openPaths(createNewSave())).toEqual([]);
    const before = clearedThrough(MAIN_LEVELS[MAIN_LEVELS.indexOf(PARENT) - 1].id);
    expect(isPathHidden(DUMMY, before)).toBe(true);
    expect(getLockReason(before, DUMMY)).toEqual({ kind: 'branch', parentId: PARENT.id, need: 1 });
    const result = applyLevelResult(before, PARENT, 1, 0);
    expect(result.unlocks.filter(u => u.kind === 'path')).toEqual([{ kind: 'path', levelId: DUMMY.id, star: 1 }]);
    // Revealed after everything the stars themselves unlocked
    expect(result.unlocks[result.unlocks.length - 1].kind).toBe('path');
    expect(getLockReason(result.save, DUMMY)).toBeNull();
    // It opens once
    expect(applyLevelResult(result.save, PARENT, 3, 0).unlocks.some(u => u.kind === 'path' && u.levelId === DUMMY.id)).toBe(false);
  });

  it('a campaign branch stays hidden at ★ and is revealed at ★★, after the fighter it belongs to', () => {
    const trial = LEVELS.find(l => l.branchOf && MAIN_LEVELS.some(m => m.id === l.branchOf))!;
    const parent = getLevel(trial.branchOf!);
    const before = clearedThrough(MAIN_LEVELS[MAIN_LEVELS.indexOf(parent) - 1].id);
    const one = applyLevelResult(before, parent, 1, 0);
    expect(one.unlocks.some(u => u.kind === 'path')).toBe(false);
    expect(isPathHidden(trial, one.save)).toBe(true);
    const two = applyLevelResult(one.save, parent, 2, 0);
    const kinds = two.unlocks.map(u => u.kind);
    expect(two.unlocks).toContainEqual({ kind: 'path', levelId: trial.id, star: 2 });
    if (kinds.includes('fighter')) expect(kinds.indexOf('fighter')).toBeLessThan(kinds.indexOf('path'));
    expect(isPathHidden(trial, two.save)).toBe(false);
  });

  it('a branch off a branch stays hidden until the branch before it has ★★', () => {
    const chained = LEVELS.find(l => l.branchOf && getLevel(l.branchOf).branchOf)!;
    const first = getLevel(chained.branchOf!);
    let save = createMaxedSave();
    save = { ...save, stars: { ...save.stars, [first.id]: 1 } };
    expect(isPathHidden(first, save)).toBe(false);
    expect(isPathHidden(chained, save)).toBe(true);
    expect(openPaths(save)).not.toContain(chained);
  });

  it('remembers which arrivals have played; an older save has already seen its campaign branches, not the dummy', () => {
    const save = clearedThrough(MAIN_LEVELS[MAIN_LEVELS.length - 1].id, 3);
    expect(freshPaths(save).length).toBeGreaterThan(1);
    const seen = pathsSeenBeforeSecrets(save);
    expect(seen).not.toContain(DUMMY.id);
    expect(seen.length).toBeGreaterThan(0);
    const old = { ...save, revealedPaths: seen };
    expect(freshPaths(old)).toEqual([DUMMY]);
    expect(freshPaths(markPathsRevealed(old, [DUMMY.id]))).toEqual([]);
    expect(markPathsRevealed(old, seen)).toBe(old);
  });

  it('loading a save from before paths were secret keeps its branches quiet and the dummy a surprise', () => {
    const { revealedPaths: _none, ...old } = clearedThrough(MAIN_LEVELS[MAIN_LEVELS.length - 1].id, 3);
    (storage.getString as jest.Mock).mockReturnValueOnce(JSON.stringify(old));
    expect(freshPaths(loadAdventureSave())).toEqual([DUMMY]);
    // A save that already records arrivals is left as it is
    (storage.getString as jest.Mock).mockReturnValueOnce(JSON.stringify({ ...old, revealedPaths: [] }));
    expect(freshPaths(loadAdventureSave()).length).toBeGreaterThan(1);
  });

  it('a hint never names a path that is still hidden', () => {
    const hiddenSource = SIDE_PATHS.flatMap(path => starRewards(path).flatMap(unlockablesOf).map(u => ({ path, u })))
      .find(({ path, u }) => unlockSource(u)?.via === 'star' && (unlockSource(u) as { level: { id: string } }).level.id === path.id);
    expect(hiddenSource).toBeDefined();
    const { path, u } = hiddenSource!;
    const closed = unlockHint(u, createNewSave())!;
    expect(closed).not.toContain(path.name);
    expect(closed).toMatch(/secret path/i);
    expect(unlockHint(u, createMaxedSave())).toContain(path.name);
    expect(unlockHint(u)).toContain(path.name);
  });
});

describe('on the map', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  const pass = (ms: number) => act(() => { jest.advanceTimersByTime(ms); });

  /** The map with its animated avatars started, so it can be taken down cleanly. */
  const mapOf = (save: AdventureSave, onPathsRevealed: (ids: string[]) => void = noop) => {
    const view = render(wrap(
      <AdventureMap save={save} onSelectLevel={noop} onOpenCamp={noop} onOpenGuide={noop} onExit={noop} onPathsRevealed={onPathsRevealed} />
    ));
    pass(50);
    return view;
  };
  const close = (view: ReturnType<typeof mapOf>) => {
    view.unmount();
    pass(50);
  };

  it('draws no side path that has not opened, not even as a locked node', () => {
    const view = mapOf(clearedThrough(MAIN_LEVELS[MAIN_LEVELS.indexOf(PARENT) - 1].id));
    for (const path of SIDE_PATHS) expect(view.queryByTestId(`map-node-${path.id}`)).toBeNull();
    expect(view.queryByText('PRACTICE')).toBeNull();
    expect(view.queryByText(/ELITE|TRIAL/)).toBeNull();
    for (const main of MAIN_LEVELS) expect(view.getByTestId(`map-node-${main.id}`)).toBeTruthy();
    close(view);
  });

  it('shows the dummy once 1-4 is cleared, announces it, and reports the arrival once it has played', () => {
    const save = clearedThrough(PARENT.id);
    const revealed = jest.fn();
    const view = mapOf(save, revealed);
    expect(view.getByTestId(`map-node-${DUMMY.id}`)).toBeTruthy();
    expect(view.getByText('PRACTICE')).toBeTruthy();
    expect(view.getByText('SECRET PATH!')).toBeTruthy();
    // Still no other side path
    for (const path of SIDE_PATHS.filter(p => p !== DUMMY)) expect(view.queryByTestId(`map-node-${path.id}`)).toBeNull();
    expect(revealed).not.toHaveBeenCalled();
    pass(6000);
    expect(revealed).toHaveBeenCalledWith([DUMMY.id]);
    close(view);

    // Next visit: it is simply there
    const again = mapOf(markPathsRevealed(save, [DUMMY.id]), revealed);
    expect(again.getByTestId(`map-node-${DUMMY.id}`)).toBeTruthy();
    expect(again.queryByText('SECRET PATH!')).toBeNull();
    pass(6000);
    expect(revealed).toHaveBeenCalledTimes(1);
    close(again);
  });

  it('with reduced motion the path is simply there, tagged, and still counts as shown', () => {
    mockReducedMotion = true;
    try {
      const revealed = jest.fn();
      const view = mapOf(clearedThrough(PARENT.id), revealed);
      expect(view.getByTestId(`map-node-${DUMMY.id}`)).toBeTruthy();
      expect(view.getByText('SECRET PATH!')).toBeTruthy();
      pass(3000);
      expect(revealed).toHaveBeenCalledWith([DUMMY.id]);
      close(view);
    } finally {
      mockReducedMotion = false;
    }
  });

  it('a path left before its arrival finished plays again next time', () => {
    const revealed = jest.fn();
    const view = mapOf(clearedThrough(PARENT.id), revealed);
    pass(300);
    close(view);
    pass(6000);
    expect(revealed).not.toHaveBeenCalled();
  });
});

describe('the screens around it', () => {
  it('the preview of the practice level shows no goals or rewards', () => {
    const view = render(wrap(
      <LevelPreview level={DUMMY} save={clearedThrough(PARENT.id)} onClose={noop} onPlay={noop} onSelectFighter={noop} onSelectCharm={noop} onShowMechanic={noop} />
    ));
    expect(view.getByTestId('preview-practice')).toBeTruthy();
    expect(view.queryByText('REWARDS')).toBeNull();
    expect(view.getByText('∞ HP')).toBeTruthy();
    expect(view.getByText('No clock')).toBeTruthy();
    expect(view.getByText('Practice')).toBeTruthy();
    // A campaign level still shows its three goals
    view.rerender(wrap(
      <LevelPreview level={PARENT} save={clearedThrough(PARENT.id)} onClose={noop} onPlay={noop} onSelectFighter={noop} onSelectCharm={noop} onShowMechanic={noop} />
    ));
    expect(view.getByText('REWARDS')).toBeTruthy();
    expect(view.queryByTestId('preview-practice')).toBeNull();
  });

  it('opening a secret path is revealed, and the reveal leads to the map', () => {
    const shown = jest.fn();
    const done = jest.fn();
    const view = render(
      <UnlockReveal
        unlocks={[{ kind: 'path', levelId: DUMMY.id, star: 1 }]}
        save={clearedThrough(PARENT.id)}
        onUseFighter={noop}
        onEquipCharm={noop}
        onShowPath={shown}
        onDone={done}
      />
    );
    expect(view.getByText('You found a secret path!')).toBeTruthy();
    // Nothing names it before the reveal
    expect(view.queryByText(DUMMY.name)).toBeNull();
    fireEvent.press(view.getByTestId('unlock-reveal'));
    expect(view.getByText(DUMMY.name)).toBeTruthy();
    expect(view.getByText(MECHANICS[DUMMY.introduces].body[0])).toBeTruthy();
    fireEvent.press(view.getByTestId('unlock-primary'));
    expect(done).toHaveBeenCalled();
    expect(shown).toHaveBeenCalledWith(DUMMY.id);
  });

  it('a practice fight is entered from the map and left with Done: no stars, no coins', () => {
    jest.useFakeTimers();
    const save: AdventureSave = {
      ...clearedThrough(PARENT.id),
      // Lessons and first-fight tips already seen
      seenMechanics: [...MAIN_LEVELS.map(l => l.introduces), DUMMY.introduces],
      seenCoachMarks: [COACH_KEYS.fightStart(DUMMY.introduces), COACH_KEYS.passives('Orange Tabby')],
      revealedPaths: [DUMMY.id],
    };
    const view = render(wrap(<AdventureMode initialSave={save} onExit={noop} />));
    fireEvent.press(view.getByTestId(`map-node-${DUMMY.id}`));
    fireEvent.press(view.getByTestId('preview-play'));
    act(() => { jest.advanceTimersByTime(500); });

    expect(view.getByTestId('run-foe-hp').props.accessibilityLabel).toBe('Foe health: endless');
    expect(view.getByTestId('run-no-clock')).toBeTruthy();
    expect(view.queryByTestId('run-clock')).toBeNull();
    expect(view.queryByText('★★★')).toBeNull();
    // Time passes and nothing ends
    act(() => { jest.advanceTimersByTime(20_000); });
    expect(view.queryByTestId('results-map')).toBeNull();

    fireEvent.press(view.getByTestId('run-done'));
    expect(view.getByText('PRACTICE OVER')).toBeTruthy();
    expect(view.queryByText('DEFEATED')).toBeNull();
    expect(view.getByText('Practice again')).toBeTruthy();
    fireEvent.press(view.getByTestId('results-map'));
    expect(view.getByTestId(`map-node-${DUMMY.id}`)).toBeTruthy();
    act(() => { jest.runOnlyPendingTimers(); });
    view.unmount();
    jest.useRealTimers();
  });
});
