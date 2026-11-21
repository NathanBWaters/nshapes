import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AdventureMode from '@/adventure/AdventureMode';
import LevelResults from '@/adventure/components/LevelResults';
import { MAIN_LEVELS, PRACTICE_LEVELS, getLevel } from '@/adventure/data/levels';
import { applyLevelResult, armableRecipesFromArmory, createMaxedSave, createNewSave, createSaveBefore, equipCharm } from '@/adventure/progress';
import { baseCardReward, createRun, runReducer, computeStars } from '@/adventure/engine/run';
import { explainStarBreakdown } from '@/adventure/engine/challenges';
import {
  assistCardsFor,
  assistStepsFor,
  companionMapGreeting,
  companionResultsLine,
  companionVoice,
  computeLiveGuidance,
  describeSingleCardTraits,
  describeValidSetWhy,
  fightRemarks,
  evaluateTripleTraits,
  explainInvalidPick,
  predictThirdCard,
  shouldShowDamageNumbers,
  shouldShowPassiveHud,
} from '@/adventure/coach';
import { ASSIST_RULES } from '@/adventure/data/rules';
import { MECHANICS } from '@/adventure/data/mechanics';
import { STORY } from '@/adventure/data/story';
import { FIGHTERS } from '@/adventure/data/fighters';
import { lessonsDueBefore, taughtOnPreview } from '@/adventure/lessons';
import LevelPreview from '@/adventure/components/LevelPreview';
import AdventureMap from '@/adventure/components/AdventureMap';
import UnlockReveal from '@/adventure/components/UnlockReveal';
import Camp from '@/adventure/components/Camp';
import AdventureRun from '@/adventure/components/AdventureRun';
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
    expect(describeValidSetWhy(sameColor, ['shape', 'color'])).toBe('All red, all different shapes.');
    expect(evaluateTripleTraits(sameColor, ['shape', 'color'])).toEqual([
      { attr: 'color', status: 'pass', label: 'Color: all red', detail: 'all red', brief: 'all red' },
      { attr: 'shape', status: 'pass', label: 'Shape: all different', detail: 'all different', brief: 'all different' },
    ]);

    const allDiff = [makeCard('a', 'diamond', 'red'), makeCard('b', 'oval', 'green'), makeCard('c', 'squiggle', 'purple')];
    expect(describeValidSetWhy(allDiff, ['shape', 'color'])).toBe('All different colors and shapes.');

    // One trait wrong: named with the cards that were picked, and the trait that passed is shown too
    const badColor = [makeCard('a', 'diamond', 'red'), makeCard('b', 'oval', 'red'), makeCard('c', 'squiggle', 'green')];
    expect(explainInvalidPick(badColor, ['shape', 'color'], 'Orange Tabby')).toBe('Almost! Color was 2 red + 1 green.');
    expect(evaluateTripleTraits(badColor, ['shape', 'color'])).toEqual([
      { attr: 'color', status: 'fail', label: 'Color: 2 red + 1 green', detail: '2 red + 1 green', brief: '2 + 1' },
      { attr: 'shape', status: 'pass', label: 'Shape: all different', detail: 'all different', brief: 'all different' },
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
    expect(onBoard!.identicalPair).toBe(false);
    expect(onBoard!.pills).toEqual([
      { attr: 'color', status: 'hint', label: 'Color: same → red', detail: 'red (same)', brief: 'red' },
      { attr: 'shape', status: 'hint', label: 'Shape: different → squiggle', detail: 'squiggle (different)', brief: 'squiggle' },
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

    // Step 1: three cards of one colour are lit, the rest dimmed, and the words name BOTH traits
    const step1 = computeLiveGuidance(run)!;
    expect(step1.kind).toBe('lesson');
    expect(step1.glowIds).toHaveLength(3);
    expect(step1.dimIds).toHaveLength(6);
    const color = lit(step1)[0].color;
    expect(lit(step1).every(c => c.color === color)).toBe(true);
    expect(step1.message).toBe(`Meow! Tap these 3: all ${color}, 3 shapes!`);
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
    expect(step2.message).toMatch(/^Now these 3: all (diamonds|ovals|squiggles), 3 colors!$/);
    run = score(run, lit(step2));

    // Step 3: three cards with nothing in common
    const step3 = computeLiveGuidance(run)!;
    expect(step3.message).toBe('And these 3: 3 colors & 3 shapes!');
    expect(new Set(lit(step3).map(c => c.color)).size).toBe(3);
    expect(new Set(lit(step3).map(c => c.shape)).size).toBe(3);
    run = score(run, lit(step3));

    // Step 4: their turn. Nothing is lit, and the rule is said once, plainly.
    const turn = computeLiveGuidance(run)!;
    expect(turn.glowIds).toHaveLength(0);
    expect(turn.dimIds).toHaveLength(0);
    expect(turn.message).toBe('Your turn! Each trait: all same, or all different.');

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

    // 1-5, three traits on twelve cards: lights an example Set for Number with trait pills, then help as the seconds pass
    const level = getLevel('1-5');
    const save = createSaveBefore('1-5');
    let run = createRun(level, save, { seed: 9 });
    const open15 = computeLiveGuidance(run)!;
    expect(open15.kind).toBe('lesson');
    expect(open15.message).toBe(MECHANICS[level.introduces].coach);
    expect(open15.pills).toHaveLength(3);

    const [t1, t2, t3] = ASSIST_RULES.threeTraits;
    const [twoT1] = ASSIST_RULES.twoTraits;
    const quietBefore13 = wait(createRun(getLevel('1-3'), createSaveBefore('1-3'), { seed: 9 }), twoT1 - 1);
    expect(computeLiveGuidance(quietBefore13, { seenIntro: true })).toBeNull();
    run = wait(run, t1 - 1);
    expect(computeLiveGuidance(run, { seenIntro: true })!.kind).toBe('lesson');
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
    const save = createSaveBefore('1-2');
    const base = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      .map(seed => createRun(level, save, { seed }))
      .find(r => allSets(r.board, r.attributes).some(s => s.every(c => c.color === 'red')))!;
    expect(base).toBeTruthy();
    const run = wait(base, ASSIST_RULES.twoTraits[2]);
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

  it('the fighter remarks on how the fight is going, most important first', () => {
    const level = getLevel('1-2');
    const run = createRun(level, createSaveBefore('1-2'), { seed: 5 });
    const keys = (r: RunState, met = false) => fightRemarks(r, met).map(x => x.key);
    expect(keys(run)).toEqual([]);
    expect(fightRemarks({ ...run, foeHp: run.foeMaxHp / 2 }, false)).toEqual([{ key: 'half-0', text: 'Halfway there!' }]);
    expect(fightRemarks({ ...run, foeHp: 5 }, false)).toEqual([{ key: 'wobble-0', text: `${run.foeName} is wobbling!` }]);
    // (one plain Set from the end, the "one more Set" line takes over instead)
    expect(keys({ ...run, foeHp: 3 })).toEqual(['half-0']);
    expect(keys({ ...run, combo: 3 })).toEqual(['roll']);
    // The last heart outranks everything; the goal being met comes next
    expect(keys({ ...run, hearts: 1, foeHp: 5, combo: 4 }, true)).toEqual(['last-heart', 'goal', 'wobble-0', 'roll']);
    // A second wave gets its own "halfway"
    expect(keys({ ...run, wave: 1, foeHp: run.foeMaxHp / 2 })).toEqual(['half-1']);
    // The walk-through level and practice have their own voice: no remarks there
    const first = createRun(getLevel('1-1'), createNewSave(), { seed: 1 });
    expect(keys({ ...first, foeHp: 6, combo: 3 })).toEqual([]);
    const dummy = createRun(PRACTICE_LEVELS[0], createSaveBefore('1-5'), { seed: 1 });
    expect(keys({ ...dummy, combo: 5 })).toEqual([]);
    for (const r of fightRemarks({ ...run, hearts: 1, foeHp: 5, combo: 4 }, true)) expect(r.text.length).toBeLessThanOrEqual(64);
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
    expect(STORY.welcome.map(b => b.scene)).toEqual(['abduction', 'keys', 'hero']);
    for (const beat of STORY.welcome) {
      expect(beat.title.length).toBeLessThanOrEqual(34);
      expect(beat.body.length).toBeLessThanOrEqual(80);
    }
    const fresh = createNewSave();
    expect(companionMapGreeting(fresh, MAIN_LEVELS[0], 0, false)).toBe('Meow! Dozy Bunny is blocking the road. Let’s go save our friends!');
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
  /** The foe has the first word (its taunt); a moment later the fighter takes the stage. */
  const letTheFoeFinish = () => act(() => {
    jest.advanceTimersByTime(2500);
  });

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
    // The foe speaks first, in its own words; then the fighter says what to do
    expect(screen.getByTestId('run-foe-taunt')).toBeTruthy();
    expect(screen.getByText(`“${getLevel('1-1').foes[0].taunt}”`)).toBeTruthy();
    expect(screen.queryByTestId('run-coach-banner')).toBeNull();
    letTheFoeFinish();
    expect(screen.queryByTestId('run-foe-taunt')).toBeNull();
    expect(screen.getByTestId('run-coach-banner')).toBeTruthy();
    expect(screen.getByText(/^Meow! Tap these 3: all (red|green|purple), 3 shapes!$/)).toBeTruthy();
  });

  it('Skip jumps from the story to the first fight', () => {
    const screen = render(wrap(<AdventureMode onExit={() => {}} />));
    fireEvent.press(screen.getByTestId('story-skip'));
    expect(screen.getByTestId('run-stage')).toBeTruthy();
    letTheFoeFinish();
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
    letTheFoeFinish();
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
    // ...and after the foe's taunt, the fight opens with the level's one-line reminder
    letTheFoeFinish();
    expect(screen.getByText(MECHANICS[level.introduces].coach!)).toBeTruthy();
  });

  it('a lesson that is used at Camp offers to go there before the fight (skill trees on 1-7)', () => {
    const screen = render(wrap(<AdventureMode initialSave={createSaveBefore('1-7')} onExit={() => {}} />));
    fireEvent.press(screen.getByTestId('map-node-1-7'));
    expect(screen.getByTestId('preview-lesson')).toBeTruthy();
    fireEvent.press(screen.getByTestId('preview-lesson-camp'));
    // Straight to the fighters and their trees, with the stars earned so far ready to spend
    expect(screen.queryByTestId('preview-play')).toBeNull();
    expect(screen.getByTestId('camp-open-tree-Orange Tabby')).toBeTruthy();
    // Other lessons have nothing to do at Camp
    screen.unmount();
    mockKvStore.clear();
    const other = render(wrap(<AdventureMode initialSave={createSaveBefore('1-2')} onExit={() => {}} />));
    fireEvent.press(other.getByTestId('map-node-1-2'));
    expect(other.queryByTestId('preview-lesson-camp')).toBeNull();
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

  it('describes a single held card trait-by-trait and protects incompatible pairs from stuck rescue', () => {
    const c = makeCard('s1', 'oval', 'purple', 2);
    expect(describeSingleCardTraits(c, ['shape', 'color', 'number'])).toEqual([
      { attr: 'color', status: 'info', label: 'Color: purple', detail: 'purple', brief: 'purple' },
      { attr: 'shape', status: 'info', label: 'Shape: oval', detail: 'oval', brief: 'oval' },
      { attr: 'number', status: 'info', label: 'Number: 2', detail: '2', brief: '2' },
    ]);

    const level = getLevel('1-3');
    const save = createSaveBefore('1-3');
    const board: Card[] = [
      makeCard('x1', 'oval', 'red'),
      makeCard('x2', 'oval', 'green'),
      makeCard('d1', 'diamond', 'red'),
      makeCard('d2', 'diamond', 'green'),
      makeCard('d3', 'diamond', 'purple'),
      makeCard('q1', 'squiggle', 'red'),
    ];
    const run = wait({ ...createRun(level, save, { seed: 4 }), board }, ASSIST_RULES.twoTraits[2]);
    const guidance = computeLiveGuidance(run, { selectedCount: 2, selectedCards: [board[0], board[1]], seenIntro: true })!;
    expect(guidance.kind).toBe('pair');
    expect(guidance.message).toMatch(/Swap one!/);
    expect(guidance.glowIds).toEqual([]);
  });

  it('allows immediate taunt dismissal on card tap and opens HudInspector from passive and challenge chips', () => {
    const save = createSaveBefore('1-7');
    const screen = render(wrap(
      <AdventureRun
        level={getLevel('1-7')}
        save={save}
        seed={12}
        onFinish={() => {}}
        onQuit={() => {}}
        onRestart={() => {}}
        onCoachMarkSeen={() => {}}
      />
    ));
    expect(screen.getByTestId('run-foe-taunt')).toBeTruthy();

    fireEvent.press(screen.getAllByTestId(/^card-(diamond|oval|squiggle)-/)[0]);
    expect(screen.queryByTestId('run-foe-taunt')).toBeNull();

    fireEvent.press(screen.getByTestId('run-passive-nine_lives'));
    expect(screen.getByTestId('hud-inspector-modal')).toBeTruthy();
    expect(screen.getByText('Nine Lives')).toBeTruthy();
    fireEvent.press(screen.getByTestId('hud-inspector-close'));
    expect(screen.queryByTestId('hud-inspector-modal')).toBeNull();

    fireEvent.press(screen.getByTestId('run-challenge'));
    expect(screen.getByTestId('hud-inspector-modal')).toBeTruthy();
    expect(screen.getByText('Star Goals')).toBeTruthy();
  });

  it('offers one-tap belt swap on UnlockReveal when charm slots are full', () => {
    jest.useFakeTimers();
    let save = createSaveBefore('1-4');
    // Ensure belt is full and pick a real unowned Armory weapon to unlock
    save = applyLevelResult(save, getLevel('1-3'), 3, 0).save;
    const fullSave = save.charms.length >= 2 ? save : equipCharm(save, save.armory[1]);
    const extraId = createMaxedSave().armory.find(id => !fullSave.armory.includes(id) && !fullSave.charms.includes(id))!;
    const onSwapCharm = jest.fn();

    const screen = render(wrap(
      <UnlockReveal
        unlocks={[{ kind: 'weapon', id: extraId, star: 3, firstWeapon: false }]}
        save={fullSave}
        onUseFighter={() => {}}
        onEquipCharm={() => {}}
        onSwapCharm={onSwapCharm}
        onDone={() => {}}
      />
    ));
    // The reward turns into view (UnlockReveal: about 0.8 s from the tap to the buttons)
    fireEvent.press(screen.getByTestId('unlock-reveal'));
    act(() => { jest.advanceTimersByTime(1000); });
    expect(screen.getByTestId('unlock-swap-box')).toBeTruthy();
    fireEvent.press(screen.getByTestId(`unlock-swap-${fullSave.charms[0]}`));
    expect(onSwapCharm).toHaveBeenCalledWith(fullSave.charms[0], extraId);
  });

  it('renders evolution one-tap arm button and fighter trial nudge on LevelPreview, and Camp return bar', () => {
    const maxed = createMaxedSave();
    const armable = armableRecipesFromArmory(maxed);
    expect(armable.length).toBeGreaterThan(0);
    const noArmedSave = { ...maxed, charms: [] };
    const onArmRecipe = jest.fn();
    const noop = () => {};

    const evoPreview = render(wrap(
      <LevelPreview
        level={getLevel('2-2')}
        save={noArmedSave}
        onClose={noop}
        onPlay={noop}
        onSelectFighter={noop}
        onSelectCharm={noop}
        onArmRecipe={onArmRecipe}
        onShowMechanic={noop}
      />
    ));
    expect(evoPreview.getByText('No evolution armed')).toBeTruthy();
    fireEvent.press(evoPreview.getByTestId('preview-arm-recipe'));
    expect(onArmRecipe).toHaveBeenCalledWith(armable[0].recipe.id);
    evoPreview.unmount();

    const trialLevel = getLevel('1-5F');
    const trialFighter = FIGHTERS.find(f => f.signature === trialLevel.introduces)!;
    const otherFighter = trialFighter.name === 'Orange Tabby' ? 'Sly Fox' : 'Orange Tabby';
    const onSelectFighter = jest.fn();
    const trialPreview = render(wrap(
      <LevelPreview
        level={trialLevel}
        save={{ ...maxed, selectedFighter: otherFighter }}
        onClose={noop}
        onPlay={noop}
        onSelectFighter={onSelectFighter}
        onSelectCharm={noop}
        onShowMechanic={noop}
      />
    ));
    expect(trialPreview.getByTestId('preview-trial-fighter-nudge')).toBeTruthy();
    fireEvent.press(trialPreview.getByTestId('preview-switch-trial-fighter'));
    expect(onSelectFighter).toHaveBeenCalledWith(trialFighter.name);
    trialPreview.unmount();

    const onReturnToLevel = jest.fn();
    const camp = render(wrap(
      <Camp
        save={maxed}
        returnLevel={getLevel('1-7')}
        onReturnToLevel={onReturnToLevel}
        onChange={noop}
        onClose={noop}
      />
    ));
    fireEvent.press(camp.getByTestId('camp-return-fight'));
    expect(onReturnToLevel).toHaveBeenCalledWith(getLevel('1-7'));
  });

  it('hides premature biome unlock banner on 1-4 and shows boss-clear celebration on 1-10 win', () => {
    const save14 = createSaveBefore('1-4');
    const lvl14 = getLevel('1-4');
    const run14 = { ...createRun(lvl14, save14, { seed: 3 }), status: 'won' as const, endReason: 'defeated' as const, challengeMet: true, foeHp: 0 };
    const res14 = applyLevelResult(save14, lvl14, 3, 0, run14);
    expect(res14.newlyOpenedBiomes).toContain('woods');
    const early = render(wrap(
      <LevelResults
        level={lvl14}
        run={run14}
        stars={3}
        result={res14}
        unlocksRevealed
        nextLevel={getLevel('1-5')}
        nextUnlocked
        onRetry={() => {}}
        onNext={() => {}}
        onMap={() => {}}
        onCamp={() => {}}
      />
    ));
    expect(early.queryByText(/New region unlocked/)).toBeNull();
    early.unmount();

    const save110 = createSaveBefore('1-10');
    const lvl110 = getLevel('1-10');
    const run110 = { ...createRun(lvl110, save110, { seed: 4 }), status: 'won' as const, endReason: 'defeated' as const, challengeMet: true, foeHp: 0 };
    const res110 = applyLevelResult(save110, lvl110, 3, 0, run110);
    const boss = render(wrap(
      <LevelResults
        level={lvl110}
        run={run110}
        stars={3}
        result={res110}
        unlocksRevealed
        nextLevel={getLevel('2-1')}
        nextUnlocked
        onRetry={() => {}}
        onNext={() => {}}
        onMap={() => {}}
        onCamp={() => {}}
      />
    ));
    expect(boss.getByTestId('results-boss-clear')).toBeTruthy();
    expect(boss.getByText(/New region unlocked/)).toBeTruthy();
  });
});
