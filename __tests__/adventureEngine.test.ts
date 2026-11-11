import { getLevel, LEVELS } from '@/adventure/data/levels';
import { createNewSave, applyLevelResult, getFeaturesForLevel, isLevelUnlocked, levelFighter, buyUpgrade, totalStars } from '@/adventure/progress';
import { createRun, runReducer, computeStars, boardHasSet } from '@/adventure/engine/run';
import { allSets } from '@/adventure/engine/sets';
import type { Card, CardReward } from '@/types';
import type { RunState } from '@/adventure/types';

const rewards = (cards: Card[]): CardReward[] => cards.map(c => ({ cardId: c.id, points: 1, money: 1, experience: 1 }));

const playSet = (s: RunState): RunState => {
  const set = allSets(s.board, s.attributes)[0];
  let next = runReducer(s, { type: 'MATCH', cards: set, rewards: rewards(set) });
  next = runReducer(next, { type: 'REPLACE', ids: set.map(c => c.id) });
  return next;
};

describe('features accumulate along the map', () => {
  it('1-1 has no hearts, 1-2 introduces them, later levels keep them', () => {
    expect(getFeaturesForLevel(getLevel('1-1')).has('hearts')).toBe(false);
    expect(getFeaturesForLevel(getLevel('1-2')).has('hearts')).toBe(true);
    expect(getFeaturesForLevel(getLevel('4-5')).has('hearts')).toBe(true);
    expect(getFeaturesForLevel(getLevel('2-8')).has('shop')).toBe(false);
    expect(getFeaturesForLevel(getLevel('3-3')).has('shop')).toBe(true);
  });

  it('first level: infinite hearts, no gear, no hints', () => {
    const run = createRun(getLevel('1-1'), createNewSave(), { seed: 1 });
    expect(run.hearts).toBeNull();
    expect(run.weapons).toHaveLength(0);
    expect(run.stats.hints).toBe(0);
    expect(boardHasSet(run.board, run.attributes)).toBe(true);
  });
});

describe('run reducer', () => {
  it('matches damage the foe, spend moves, and knock it out for 2+ stars', () => {
    let s = createRun(getLevel('1-1'), createNewSave(), { seed: 42 });
    expect(s.foeHp).toBe(12);
    s = playSet(s);
    expect(s.foeHp).toBe(9);
    expect(s.movesLeft).toBe(5);
    while (s.status === 'playing') s = playSet(s);
    expect(s.status).toBe('won');
    expect(s.endReason).toBe('defeated');
    expect(computeStars(s)).toBe(3); // no mistakes
  });

  it('mistakes cost hearts and can lose the level', () => {
    let s = createRun(getLevel('1-2'), { ...createNewSave(), stars: { '1-1': 1 } }, { seed: 7 });
    expect(s.hearts).toBe(3);
    for (let i = 0; i < 3; i++) s = runReducer(s, { type: 'INVALID', cards: s.board.slice(0, 3) });
    expect(s.hearts).toBe(0);
    expect(s.status).toBe('lost');
    expect(computeStars(s)).toBe(0);
  });

  it('timed levels give 1 star for surviving the clock', () => {
    let s = createRun(getLevel('1-7'), createNewSave(), { seed: 3 });
    for (let i = 0; i < 200 && s.status === 'playing'; i++) s = runReducer(s, { type: 'TICK', ms: 1000 });
    expect(s.status).toBe('won');
    expect(s.endReason).toBe('survived');
    expect(computeStars(s)).toBe(1);
  });

  it('waves advance through an intermission', () => {
    let s = createRun(getLevel('3-2'), createNewSave(), { seed: 5 });
    while (s.status === 'playing' || s.status === 'pick') {
      s = s.status === 'pick' ? runReducer(s, { type: 'PICK', weaponId: null }) : playSet(s);
    }
    expect(s.status).toBe('intermission');
    s = runReducer(s, { type: 'NEXT_WAVE' });
    expect(s.wave).toBe(1);
    expect(s.foeHp).toBe(getLevel('3-2').foes[1].hp);
  });

  it('the board keeps the same reference across quiet ticks', () => {
    const s = createRun(getLevel('1-7'), createNewSave(), { seed: 9 });
    const t = runReducer(s, { type: 'TICK', ms: 250 });
    expect(t.board).toBe(s.board);
  });

  it('is deterministic for a given seed', () => {
    const a = createRun(getLevel('2-1'), createNewSave(), { seed: 123 });
    const b = createRun(getLevel('2-1'), createNewSave(), { seed: 123 });
    expect(a.board.map(c => `${c.shape}${c.color}${c.number}`)).toEqual(b.board.map(c => `${c.shape}${c.color}${c.number}`));
  });
});

describe('fighter abilities', () => {
  const caughtUp = () => {
    const base = createNewSave();
    const stars = Object.fromEntries(LEVELS.map(l => [l.id, 3]));
    return { ...base, stars, unlockedFighters: ['Orange Tabby', 'Sly Fox', 'Badger', 'Emperor Penguin', 'Corgi', 'Pelican'] as const } as unknown as ReturnType<typeof createNewSave>;
  };

  it('no ability before gear is taught (1-4)', () => {
    expect(createRun(getLevel('1-3'), createNewSave(), { seed: 1 }).ability).toBeNull();
    expect(createRun(getLevel('1-4'), createNewSave(), { seed: 1 }).ability?.id).toBe('nine_lives');
  });

  it('Orange Tabby — Nine Lives survives one knockout', () => {
    let s = createRun(getLevel('2-1'), caughtUp(), { seed: 2, fighter: 'Orange Tabby' });
    const hearts = s.hearts!;
    for (let i = 0; i < hearts; i++) s = runReducer(s, { type: 'INVALID', cards: s.board.slice(0, 3) });
    expect(s.status).toBe('playing');
    expect(s.hearts).toBe(1);
    expect(s.events.some(e => e.type === 'nine_lives')).toBe(true);
    s = runReducer(s, { type: 'INVALID', cards: s.board.slice(0, 3) });
    expect(s.status).toBe('lost');
  });

  it('Sly Fox — quick Sets build a combo; a mistake breaks it', () => {
    let s = createRun(getLevel('2-1'), caughtUp(), { seed: 3, fighter: 'Sly Fox' });
    s = playSet(s);
    const hp1 = s.foeHp;
    s = runReducer(s, { type: 'TICK', ms: 1000 });
    s = playSet(s); // combo 1
    expect(s.ability!.combo).toBe(1);
    expect(hp1 - s.foeHp).toBeGreaterThanOrEqual(4);
    s = runReducer(s, { type: 'INVALID', cards: s.board.slice(0, 3) });
    expect(s.ability!.combo).toBe(0);
  });

  it('Badger — mistakes store grudges released on the next Set', () => {
    let s = createRun(getLevel('2-1'), caughtUp(), { seed: 4, fighter: 'Badger' });
    s = runReducer(s, { type: 'INVALID', cards: s.board.slice(0, 3) });
    s = runReducer(s, { type: 'INVALID', cards: s.board.slice(0, 3) });
    expect(s.ability!.grudge).toBe(2);
    const before = s.foeHp;
    s = playSet(s);
    expect(before - s.foeHp).toBeGreaterThanOrEqual(3 + 6);
    expect(s.ability!.grudge).toBe(0);
  });

  it('Emperor Penguin — Deep Freeze stops the clock', () => {
    let s = createRun(getLevel('2-1'), caughtUp(), { seed: 5, fighter: 'Emperor Penguin' });
    for (let i = 0; i < 4; i++) s = playSet(s);
    expect(s.ability!.charge).toBe(4);
    s = runReducer(s, { type: 'ABILITY' });
    const t = s.timeLeft;
    s = runReducer(s, { type: 'TICK', ms: 3000 });
    expect(s.timeLeft).toBe(t);
    s = runReducer(s, { type: 'TICK', ms: 3000 });
    s = runReducer(s, { type: 'TICK', ms: 1000 });
    expect(s.timeLeft).toBeLessThan(t!);
  });

  it('Corgi — Zoomies re-deals the board', () => {
    let s = createRun(getLevel('2-2'), caughtUp(), { seed: 6, fighter: 'Corgi' });
    for (let i = 0; i < 3; i++) s = playSet(s);
    const before = s.board.map(c => c.id);
    s = runReducer(s, { type: 'ABILITY' });
    expect(s.board.map(c => c.id)).not.toEqual(before);
    expect(s.board.some(c => c.isDud)).toBe(false);
    expect(boardHasSet(s.board, s.attributes)).toBe(true);
  });

  it('Pelican — Big Scoop plays a Set for you', () => {
    let s = createRun(getLevel('2-1'), caughtUp(), { seed: 7, fighter: 'Pelican' });
    for (let i = 0; i < 4; i++) s = playSet(s);
    const m = s.matches;
    s = runReducer(s, { type: 'ABILITY' });
    expect(s.matches).toBe(m + 1);
    expect(s.ability!.scooped).toHaveLength(3);
    expect(s.ability!.charge).toBe(0);
  });
});

describe('progression', () => {
  it('star rewards are granted once each, coins always bank', () => {
    const save = createNewSave();
    const lvl = getLevel('1-1');
    const r1 = applyLevelResult(save, lvl, 2, 0);
    expect(r1.granted.map(g => g.star)).toEqual([1, 2]);
    expect(r1.save.coins).toBe(25);
    const r2 = applyLevelResult(r1.save, lvl, 2, 5);
    expect(r2.granted).toHaveLength(0);
    expect(r2.save.coins).toBe(30);
    const r3 = applyLevelResult(r2.save, lvl, 3, 0);
    expect(r3.granted.map(g => g.star)).toEqual([3]);
  });

  it('levels unlock in order and biomes are star-gated', () => {
    let save = createNewSave();
    expect(isLevelUnlocked(save, getLevel('1-2'))).toBe(false);
    save = applyLevelResult(save, getLevel('1-1'), 1, 0).save;
    expect(isLevelUnlocked(save, getLevel('1-2'))).toBe(true);
    // Beat all of meadow with 1 star each: 8 stars < 12 gate for woods
    for (const l of LEVELS.filter(x => x.biome === 'meadow')) save = applyLevelResult(save, l, 1, 0).save;
    expect(totalStars(save)).toBe(8);
    expect(isLevelUnlocked(save, getLevel('2-1'))).toBe(false);
  });

  it('boss star rewards unlock fighters', () => {
    const r = applyLevelResult(createNewSave(), getLevel('1-8'), 2, 0);
    expect(r.save.unlockedFighters).toContain('Sly Fox');
  });

  it('camp purchases spend coins', () => {
    let save = { ...createNewSave(), coins: 1000 };
    save = levelFighter(save, 'Orange Tabby');
    expect(save.fighterLevels['Orange Tabby']).toBe(2);
    expect(save.coins).toBe(940);
    save = buyUpgrade(save, 'tough_hide');
    expect(save.upgrades.tough_hide).toBe(1);
    expect(save.coins).toBe(690);
  });
});
