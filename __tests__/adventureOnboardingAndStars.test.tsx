import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AdventureMode from '@/adventure/AdventureMode';
import LevelResults from '@/adventure/components/LevelResults';
import { MAIN_LEVELS, PRACTICE_LEVELS, getLevel } from '@/adventure/data/levels';
import { applyLevelResult, createNewSave, createSaveBefore } from '@/adventure/progress';
import { baseCardReward, createRun, runReducer, computeStars } from '@/adventure/engine/run';
import { explainStarBreakdown } from '@/adventure/engine/challenges';
import {
  assistCardsFor,
  assistStepsFor,
  companionMapGreeting,
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
import { ASSIST_RULES } from '@/adventure/data/rules';
import { MECHANICS } from '@/adventure/data/mechanics';
import { STORY } from '@/adventure/data/story';
import { lessonsDueBefore, taughtOnPreview } from '@/adventure/lessons';
import LevelPreview from '@/adventure/components/LevelPreview';
import AdventureMap from '@/adventure/components/AdventureMap';
import MainMenu from '@/components/MainMenu';
import { writeAdventureSave } from '@/adventure/save';
import { starRewards, unlockablesOf } from '@/adventure/data/rewards';
import type { RunState } from '@/adventure/types';
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
  // The main menu asks whether a classic-mode game is waiting to be resumed: none here
  SavedGameStorage: { hasSavedGame: () => false, load: () => null },
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

/** The fight clock moves on by this many seconds with nothing matched. */
const wait = (run: RunState, seconds: number): RunState => {
  let next = run;
  for (let i = 0; i < seconds * 4; i++) next = runReducer(next, { type: 'TICK', ms: 250 });
  return next;
};

/** Make a Set and deal the next cards. */
const score = (run: RunState, cards: Card[]): RunState => {
  const scored = runReducer(run, { type: 'MATCH', cards, rewards: cards.map(baseCardReward) });
  return runReducer(scored, { type: 'REPLACE', ids: cards.map(c => c.id) });
};

describe('Adventure first minutes: show, then say', () => {
  beforeEach(() => {
    mockKvStore.clear();
  });

  it('explains a Set and a wrong pick in the cards’ own words, trait by trait', () => {
    const sameColor = [makeCard('a', 'diamond', 'red'), makeCard('b', 'oval', 'red'), makeCard('c', 'squiggle', 'red')];
    expect(describeValidSetWhy(sameColor, ['shape', 'color'])).toBe('All red.');
    expect(evaluateTripleTraits(sameColor, ['shape', 'color'])).toEqual([
      { attr: 'color', status: 'pass', label: 'Color: all red' },
      { attr: 'shape', status: 'pass', label: 'Shape: all different' },
    ]);

    const allDiff = [makeCard('a', 'diamond', 'red'), makeCard('b', 'oval', 'green'), makeCard('c', 'squiggle', 'purple')];
    expect(describeValidSetWhy(allDiff, ['shape', 'color'])).toBe('Nothing in common!');

    // One trait wrong: named with the cards that were picked, and the trait that passed is shown too
    const badColor = [makeCard('a', 'diamond', 'red'), makeCard('b', 'oval', 'red'), makeCard('c', 'squiggle', 'green')];
    expect(explainInvalidPick(badColor, ['shape', 'color'], 'Orange Tabby')).toBe('Almost! Color was 2 red + 1 green.');
    expect(evaluateTripleTraits(badColor, ['shape', 'color'])).toEqual([
      { attr: 'color', status: 'fail', label: 'Color: 2 red + 1 green' },
      { attr: 'shape', status: 'pass', label: 'Shape: all different' },
    ]);

    const badNumber = [makeCard('a', 'oval', 'purple', 2), makeCard('b', 'oval', 'purple', 2), makeCard('c', 'oval', 'purple', 3)];
    expect(explainInvalidPick(badNumber, ['shape', 'color', 'number'], 'Corgi')).toBe('Almost! Number was two 2s + one 3.');

    const badBoth = [makeCard('a', 'oval', 'red'), makeCard('b', 'oval', 'red'), makeCard('c', 'diamond', 'green')];
    expect(explainInvalidPick(badBoth, ['shape', 'color'])).toBe('Not a Set: Color and Shape were 2 alike + 1 odd.');
  });

  it('every line the companion says in a fight fits a speech bubble', () => {
    const lines = [
      ...Object.values(MECHANICS).flatMap(m => (m.coach ? [m.coach] : [])),
      explainInvalidPick([makeCard('a', 'squiggle', 'purple', 2), makeCard('b', 'squiggle', 'purple', 2), makeCard('c', 'squiggle', 'purple', 3)], ['shape', 'color', 'number']),
      explainInvalidPick([makeCard('a', 'squiggle', 'purple'), makeCard('b', 'squiggle', 'purple'), makeCard('c', 'diamond', 'green')], ['shape', 'color']),
    ];
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(64);
    // Every World 1 level opens with a line of its own
    for (const level of MAIN_LEVELS.filter(l => l.biome === 'meadow').slice(1)) {
      expect(MECHANICS[level.introduces].coach).toBeTruthy();
    }
  });

  it('names the exact third card two picked cards need', () => {
    const c1 = makeCard('1', 'diamond', 'red', 1);
    const c2 = makeCard('2', 'oval', 'red', 2);
    const matchingThird = makeCard('3', 'squiggle', 'red', 3);
    const wrongThird = makeCard('4', 'oval', 'green', 3);

    const onBoard = predictThirdCard([c1, c2], ['shape', 'color'], [c1, c2, matchingThird]);
    expect(onBoard).not.toBeNull();
    expect(onBoard!.neededSummary).toBe('a red squiggle');
    expect(onBoard!.existsOnBoard).toBe(true);
    expect(onBoard!.cardId).toBe('3');
    expect(onBoard!.pills).toEqual([
      { attr: 'color', status: 'hint', label: 'Color: same → red' },
      { attr: 'shape', status: 'hint', label: 'Shape: different → squiggle' },
    ]);

    const threeTrait = predictThirdCard([c1, c2], ['shape', 'color', 'number'], [c1, c2, wrongThird]);
    expect(threeTrait!.neededSummary).toBe('3 red squiggles');
    expect(threeTrait!.existsOnBoard).toBe(false);
    expect(threeTrait!.cardId).toBeNull();
    expect(threeTrait!.pills).toHaveLength(3);
  });

  it('walks 1-1 through one idea at a time: same color, same shape, nothing in common, then your turn', () => {
    const level = getLevel('1-1');
    let run = createRun(level, createNewSave(), { seed: 42 });
    const lit = (g: ReturnType<typeof computeLiveGuidance>) => run.board.filter(c => g!.glowIds.includes(c.id));

    // Step 1: three cards of one colour are lit, the rest dimmed, and the words name the colour
    const step1 = computeLiveGuidance(run)!;
    expect(step1.kind).toBe('lesson');
    expect(step1.glowIds).toHaveLength(3);
    expect(step1.dimIds).toHaveLength(6);
    const color = lit(step1)[0].color;
    expect(lit(step1).every(c => c.color === color)).toBe(true);
    expect(step1.message).toBe(`Meow! Tap the 3 ${color} cards!`);
    // (as they tap, the line counts down)
    expect(computeLiveGuidance(run, { selectedCount: 2 })!.message).toBe('One more!');

    // The Set lands: praise, and nothing is pointed at until the next cards are dealt
    const first = lit(step1);
    const landing = runReducer(run, { type: 'MATCH', cards: first, rewards: first.map(baseCardReward) });
    const praise = computeLiveGuidance(landing)!;
    expect(praise.message).toBe('That is a Set!');
    expect(praise.glowIds).toHaveLength(0);
    run = runReducer(landing, { type: 'REPLACE', ids: first.map(c => c.id) });

    // Step 2: three cards of one shape
    const step2 = computeLiveGuidance(run)!;
    expect(step2.glowIds).toHaveLength(3);
    const shape = lit(step2)[0].shape;
    expect(lit(step2).every(c => c.shape === shape)).toBe(true);
    expect(step2.message).toBe(`Now the 3 ${shape}s.`);
    run = score(run, lit(step2));

    // Step 3: three cards with nothing in common
    const step3 = computeLiveGuidance(run)!;
    expect(step3.message).toBe('Now 3 with nothing in common!');
    expect(new Set(lit(step3).map(c => c.color)).size).toBe(3);
    expect(new Set(lit(step3).map(c => c.shape)).size).toBe(3);
    run = score(run, lit(step3));

    // Step 4: their turn. Nothing is lit, and the rule is said once, plainly.
    const turn = computeLiveGuidance(run)!;
    expect(turn.glowIds).toHaveLength(0);
    expect(turn.dimIds).toHaveLength(0);
    expect(turn.message).toBe('Your turn! All the same, or all different.');

    // Two cards held: the companion names the card that finishes the Set
    const triple = allSets(run.board, run.attributes)[0];
    const held = computeLiveGuidance(run, { selectedCount: 2, selectedCards: [triple[0], triple[1]] })!;
    expect(held.kind).toBe('pair');
    expect(held.message).toMatch(/^Find an? (red|green|purple) (diamond|oval|squiggle)!$/);

    // A wrong pick: why, in the cards' words, the checks per trait, and a Set to try
    const wrong = [triple[0], triple[1], run.board.find(c => !triple.includes(c))!];
    const note = explainInvalidPick(wrong, run.attributes, run.fighter);
    const mistake = computeLiveGuidance(run, { mistakeNote: note, mistakeCards: wrong })!;
    expect(mistake.kind).toBe('mistake');
    expect(mistake.message).toBe(`${note} Try these!`);
    expect(mistake.glowIds).toHaveLength(3);
    expect(mistake.pills!.some(p => p.status === 'fail')).toBe(true);

    // The last Sets: cheering
    run = score(run, triple);
    expect(computeLiveGuidance(run)!.message).toBe('Purr-fect! One more Set wins it!');
  });

  it('never leaves a new player stuck: a quiet board lights a Set one card at a time', () => {
    expect(assistStepsFor(getLevel('1-1'))).toEqual(ASSIST_RULES.firstLevel);
    expect(assistStepsFor(getLevel('1-2'))).toEqual(ASSIST_RULES.twoTraits);
    expect(assistStepsFor(getLevel('1-5'))).toEqual(ASSIST_RULES.threeTraits);
    expect(assistStepsFor(getLevel('2-1'))).toEqual(ASSIST_RULES.secondWorld);
    // By World 3 the player has hints and a build: the companion steps back. Practice has no clock to be stuck on.
    expect(assistStepsFor(getLevel('3-1'))).toBeNull();
    expect(assistStepsFor(PRACTICE_LEVELS[0])).toBeNull();
    expect(assistCardsFor(getLevel('1-5'), 11_000)).toBe(0);
    expect(assistCardsFor(getLevel('1-5'), 12_000)).toBe(1);
    expect(assistCardsFor(getLevel('1-5'), 60_000)).toBe(3);
    expect(assistCardsFor(getLevel('2-1'), 600_000)).toBe(2);

    // 1-5, three traits on twelve cards: the level's opening line first, then help as the seconds pass
    const level = getLevel('1-5');
    const save = createSaveBefore('1-5');
    let run = createRun(level, save, { seed: 9 });
    expect(computeLiveGuidance(run)!.kind).toBe('opening');
    expect(computeLiveGuidance(run)!.message).toBe(MECHANICS[level.introduces].coach);

    const [t1, t2, t3] = ASSIST_RULES.threeTraits;
    run = wait(run, t1 - 1);
    expect(computeLiveGuidance(run, { seenIntro: true })).toBeNull();
    run = wait(run, 1);
    const one = computeLiveGuidance(run, { seenIntro: true })!;
    expect(one.kind).toBe('rescue');
    expect(one.glowIds).toHaveLength(1);
    expect(one.message).toBe('Stuck? Start with this one.');
    run = wait(run, t2 - t1);
    const two = computeLiveGuidance(run, { seenIntro: true })!;
    expect(two.glowIds).toHaveLength(2);
    expect(two.glowIds).toContain(one.glowIds[0]);
    run = wait(run, t3 - t2);
    const three = computeLiveGuidance(run, { seenIntro: true })!;
    expect(three.glowIds).toHaveLength(3);
    // What is lit really is a Set
    const litCards = run.board.filter(c => three.glowIds.includes(c.id));
    expect(allSets(litCards, run.attributes)).toHaveLength(1);
    expect(three.pills!.every(p => p.status === 'pass')).toBe(true);

    // A foe that switches auto-hints off switches this off too
    expect(computeLiveGuidance(run, { seenIntro: true, noAssist: true })).toBeNull();

    // Making a Set starts the count again
    run = score(run, litCards);
    expect(computeLiveGuidance(run, { seenIntro: true })).toBeNull();
  });

  it('points at a Set that helps the level’s ★★★ challenge when the board has one', () => {
    // 1-2 asks for all-red Sets
    const level = getLevel('1-2');
    let run = createRun(level, createSaveBefore('1-2'), { seed: 5 });
    run = wait(run, ASSIST_RULES.twoTraits[2]);
    const help = computeLiveGuidance(run, { seenIntro: true })!;
    const cards = run.board.filter(c => help.glowIds.includes(c.id));
    expect(cards).toHaveLength(3);
    expect(cards.every(c => c.color === 'red')).toBe(true);
  });

  it('says so when the end is in sight, and makes a near miss a reason to try again', () => {
    const level = getLevel('1-2');
    const save = createSaveBefore('1-2');
    let run = createRun(level, save, { seed: 5 });
    run = score(run, allSets(run.board, run.attributes)[0]);

    // One plain Set from a knockout
    expect(computeLiveGuidance({ ...run, foeHp: 3 }, { seenIntro: true })!.message).toBe('Purr-fect! One more Set does it!');
    // The last move, with the foe still standing
    const last = computeLiveGuidance({ ...run, foeHp: 12, movesLeft: 1 }, { seenIntro: true })!;
    expect(last.message).toBe('Last move. Make it count!');
    // Mid-fight, with moves in hand: nothing to add
    expect(computeLiveGuidance({ ...run, foeHp: 12, movesLeft: 5 }, { seenIntro: true })).toBeNull();

    // The foe survived on a sliver of health: the results line says how close it was
    const survived = { ...run, status: 'won' as const, endReason: 'survived' as const, foeHp: 4, movesLeft: 0 };
    expect(companionResultsLine(level, survived, computeStars(survived), false)).toBe(`So close! ${run.foeName} had just 4 HP left.`);
    // Nowhere near: the fighter's usual line
    const far = { ...survived, foeHp: run.foeMaxHp - 3 };
    expect(companionResultsLine(level, far, computeStars(far), false)).toBe(companionVoice('Orange Tabby').win1);
  });

  it('gives every fighter a voice of their own and explains ★, ★★ and ★★★', () => {
    expect(companionVoice('Orange Tabby').hello).toBe('Meow!');
    expect(companionVoice('Corgi').hello).toBe('Woof!');
    expect(companionVoice('Emperor Penguin').cheer).toBe('Brr-illiant!');
    // Short enough to sit beside the stars on a results screen
    for (const name of ['Orange Tabby', 'Sly Fox', 'Emperor Penguin', 'Badger', 'Corgi', 'Pelican'] as const) {
      const v = companionVoice(name);
      for (const line of [v.win3, v.win2, v.win1, v.loss]) expect(line.length).toBeLessThanOrEqual(64);
    }

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
    expect(companionResultsLine(lvl12, run12, stars12, false)).toBe(companionVoice('Orange Tabby').win2);

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

  it('shows damage numbers and passives only once the game has introduced them', () => {
    const save = createNewSave();
    expect(shouldShowDamageNumbers(getLevel('1-1'), save)).toBe(false);
    expect(shouldShowDamageNumbers(getLevel('1-4'), save)).toBe(false);
    expect(shouldShowDamageNumbers(getLevel('1-7'), save)).toBe(true);

    expect(shouldShowPassiveHud(getLevel('1-1'), save)).toBe(false);
    expect(shouldShowPassiveHud(getLevel('1-2'), save)).toBe(false);
    expect(shouldShowPassiveHud(getLevel('1-5'), save)).toBe(true);
  });

  it('tells the story in three short beats and greets the map in one line', () => {
    expect(STORY.welcome.map(b => b.scene)).toEqual(['starfall', 'critters', 'hero']);
    for (const beat of STORY.welcome) {
      expect(beat.title.length).toBeLessThanOrEqual(34);
      expect(beat.body.length).toBeLessThanOrEqual(80);
    }
    const fresh = createNewSave();
    expect(companionMapGreeting(fresh, MAIN_LEVELS[0], 0, false)).toBe('Meow! Dozy Bunny found a star shard. Let’s win it back!');
    const after = createSaveBefore('1-2');
    expect(companionMapGreeting(after, getLevel('1-2'), 3, false)).toBe('Prickle is next, with something new: Hearts.');
  });
});

describe('Adventure first minutes: the screens', () => {
  beforeEach(() => {
    mockKvStore.clear();
    jest.useFakeTimers();
  });
  afterEach(() => {
    act(() => {
      jest.clearAllTimers();
    });
    jest.useRealTimers();
  });

  const wrap = (node: React.ReactElement) => <SafeAreaProvider initialMetrics={INSETS}>{node}</SafeAreaProvider>;

  it('a brand-new player sees the story, then is in the first fight: no map, no preview, no lesson card', () => {
    const screen = render(wrap(<AdventureMode onExit={() => {}} />));
    expect(screen.getByTestId('story-intro')).toBeTruthy();
    expect(screen.queryByTestId('map-guide-banner')).toBeNull();
    expect(screen.getByText(STORY.welcome[0].title)).toBeTruthy();

    fireEvent.press(screen.getByTestId('story-next'));
    expect(screen.getByText(STORY.welcome[1].title)).toBeTruthy();
    fireEvent.press(screen.getByTestId('story-next'));
    fireEvent.press(screen.getByTestId('story-next'));

    // Straight onto the guided board, with the fighter talking from the stage
    expect(screen.queryByTestId('story-intro')).toBeNull();
    expect(screen.queryByTestId('lesson-modal')).toBeNull();
    expect(screen.queryByTestId('preview-play')).toBeNull();
    expect(screen.getByTestId('run-stage')).toBeTruthy();
    expect(screen.getByTestId('run-coach-banner')).toBeTruthy();
    expect(screen.getByText(/^Meow! Tap the 3 (red|green|purple) cards!$/)).toBeTruthy();
  });

  it('Skip jumps from the story to the first fight', () => {
    const screen = render(wrap(<AdventureMode onExit={() => {}} />));
    fireEvent.press(screen.getByTestId('story-skip'));
    expect(screen.getByTestId('run-coach-banner')).toBeTruthy();
  });

  it('the story plays once: a player who has started is taken to the map', () => {
    const screen = render(wrap(<AdventureMode initialSave={createSaveBefore('1-2')} onExit={() => {}} />));
    expect(screen.queryByTestId('story-intro')).toBeNull();
    expect(screen.getByTestId('map-guide-banner')).toBeTruthy();
  });

  it('from the map, 1-1 still opens through its preview', () => {
    const screen = render(wrap(<AdventureMode coldOpen={false} onExit={() => {}} />));
    expect(screen.getByTestId('map-guide-banner')).toBeTruthy();
    fireEvent.press(screen.getByTestId('map-node-1-1'));
    expect(screen.getByTestId('preview-coach')).toBeTruthy();
    fireEvent.press(screen.getByTestId('preview-play'));
    expect(screen.queryByTestId('lesson-modal')).toBeNull();
    expect(screen.getByTestId('run-coach-banner')).toBeTruthy();
  });

  it('the preview IS the lesson: the new mechanic is shown there and Fight starts the fight', () => {
    const save = createSaveBefore('1-2');
    const level = getLevel('1-2');
    // The level's own mechanic is taught on the sheet
    const due = lessonsDueBefore(level, save);
    expect(due).toHaveLength(1);
    expect(taughtOnPreview(due[0], level)).toBe(true);

    const screen = render(wrap(<AdventureMode initialSave={save} onExit={() => {}} />));
    fireEvent.press(screen.getByTestId('map-node-1-2'));
    expect(screen.getByTestId('preview-lesson')).toBeTruthy();
    expect(screen.getByText(MECHANICS[level.introduces].tagline)).toBeTruthy();
    fireEvent.press(screen.getByTestId('preview-play'));
    expect(screen.queryByTestId('lesson-modal')).toBeNull();
    expect(screen.getByTestId('run-stage')).toBeTruthy();
    // ...and the fight opens with the level's one-line reminder
    expect(screen.getByText(MECHANICS[level.introduces].coach!)).toBeTruthy();
  });

  it('keeps gear management off the preview until the game has taught it', () => {
    const noop = () => {};
    const props = { onClose: noop, onPlay: noop, onSelectFighter: noop, onSelectCharm: noop, onShowMechanic: noop };
    // 1-2: one weapon, nothing to choose. It simply comes along.
    const early = render(wrap(<LevelPreview {...props} level={getLevel('1-2')} save={createSaveBefore('1-2')} />));
    expect(early.getByTestId('preview-bringing')).toBeTruthy();
    expect(early.queryByTestId('preview-charm-slots')).toBeNull();
    expect(early.queryByTestId('preview-passives')).toBeNull();
    early.unmount();
    // 1-4 teaches charms: the picker arrives with it
    const charms = render(wrap(<LevelPreview {...props} level={getLevel('1-4')} save={createSaveBefore('1-4')} />));
    expect(charms.getByTestId('preview-charm-slots')).toBeTruthy();
    expect(charms.queryByTestId('preview-bringing')).toBeNull();
    charms.unmount();
    // 1-5 brings a second fighter: passives appear
    const later = render(wrap(<LevelPreview {...props} level={getLevel('1-5')} save={createSaveBefore('1-5')} />));
    expect(later.getByTestId('preview-passives')).toBeTruthy();
  });

  it('the fight shows its ★★★ goal as a strip that tracks progress', () => {
    const screen = render(wrap(<AdventureMode initialSave={createSaveBefore('1-2')} onExit={() => {}} />));
    fireEvent.press(screen.getByTestId('map-node-1-2'));
    fireEvent.press(screen.getByTestId('preview-play'));
    expect(screen.getByTestId('run-challenge').props.accessibilityLabel).toMatch(/^Three star goal: Make 2 all-red Sets/);
    // (1-1 scores accuracy instead: no goal strip there)
    screen.unmount();
    mockKvStore.clear();
    const first = render(wrap(<AdventureMode onExit={() => {}} />));
    fireEvent.press(first.getByTestId('story-skip'));
    expect(first.queryByTestId('run-challenge')).toBeNull();
  });

  it('the map shows the road ahead: this world’s progress, the foes coming up, and where rewards still hide', () => {
    const save = createSaveBefore('1-3');
    const noop = () => {};
    const screen = render(wrap(<AdventureMap save={save} onSelectLevel={noop} onOpenCamp={noop} onOpenGuide={noop} onExit={noop} />));
    const meadow = MAIN_LEVELS.filter(l => l.biome === 'meadow');
    expect(screen.getByTestId('map-world-progress-meadow').props.accessibilityLabel).toBe(`6 of ${meadow.length * 3} stars in Sunny Meadow`);
    // A level whose stars still hide an unlock is tagged; one with nothing left to find is not
    for (const level of meadow) {
      const hides = starRewards(level).some((reward, i) => i >= (save.stars[level.id] ?? 0) && unlockablesOf(reward).length > 0);
      expect(!!screen.queryByTestId(`map-loot-${level.id}`)).toBe(hides);
    }
    expect(screen.queryByTestId('map-loot-1-1')).toBeNull();
    // The next levels down the road can still be opened to see what is waiting there
    expect(screen.getByTestId('map-node-1-4').props.accessibilityLabel).toContain('locked');
  });

  it('the main menu invites a new player to Play and takes a returning one back to their next foe', () => {
    const noop = () => {};
    const props = { onSelectAdventure: noop, onSelectFreeplay: noop, onSelectTutorial: noop, onSelectOptions: noop };
    const fresh = render(wrap(<MainMenu {...props} />));
    expect(fresh.getByTestId('menu-adventure').props.accessibilityLabel).toBe('Adventure: Play');
    expect(fresh.getByText('A star fell. The critters went wild.')).toBeTruthy();
    fresh.unmount();

    const save = createSaveBefore('1-5');
    writeAdventureSave(save);
    const back = render(wrap(<MainMenu {...props} />));
    expect(back.getByTestId('menu-adventure').props.accessibilityLabel).toBe('Adventure: Continue');
    expect(back.getByText(/^1-5 · Nutkin is waiting\s+★ 12$/)).toBeTruthy();
  });

  it('the results screen keeps what to do next in reach, with the next foe on the button', () => {
    const lvl = getLevel('1-2');
    const save = createNewSave();
    const won = { ...createRun(lvl, save, { seed: 3 }), status: 'won' as const, endReason: 'defeated' as const, challengeMet: true, foeHp: 0 };
    const onNext = jest.fn();
    const screen = render(wrap(
      <LevelResults
        level={lvl}
        run={won}
        stars={3}
        result={applyLevelResult(save, lvl, 3, 0, won)}
        unlocksRevealed
        nextLevel={getLevel('1-3')}
        nextUnlocked
        onRetry={() => {}}
        onNext={onNext}
        onMap={() => {}}
        onCamp={() => {}}
      />
    ));
    expect(screen.getByTestId('results-companion-bubble')).toBeTruthy();
    expect(screen.getByTestId('results-star-breakdown')).toBeTruthy();
    expect(screen.getByTestId('results-shards').props.children).toBe('All 3 star shards won back!');
    expect(screen.getByTestId('results-actions')).toBeTruthy();
    expect(screen.getByText(`NEXT: ${getLevel('1-3').name}`)).toBeTruthy();
    expect(screen.getByText(`New: ${MECHANICS[getLevel('1-3').introduces].title}`)).toBeTruthy();
    fireEvent.press(screen.getByTestId('results-next'));
    expect(onNext).toHaveBeenCalledTimes(1);
    // Early on, the numbers that have not been introduced stay away
    expect(screen.queryByTestId('results-sets')).toBeNull();
    expect(screen.queryByTestId('results-power')).toBeNull();
  });
});
