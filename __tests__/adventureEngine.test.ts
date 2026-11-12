import { getLevel, LEVELS, MAIN_LEVELS } from '@/adventure/data/levels';
import { createNewSave, applyLevelResult, getLockReason, isLevelUnlocked, levelFighter, buyUpgrade, reconcileUnlocks, totalStars } from '@/adventure/progress';
import { getFeaturesForLevel } from '@/adventure/loadout';
import { createRun, runReducer, computeStars } from '@/adventure/engine/run';
import { allSets, hasAnySet } from '@/adventure/engine/sets';
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
    expect(getFeaturesForLevel(getLevel('1-1'), createNewSave()).has('hearts')).toBe(false);
    expect(getFeaturesForLevel(getLevel('1-2'), createNewSave()).has('hearts')).toBe(true);
    expect(getFeaturesForLevel(getLevel('4-5'), createNewSave()).has('hearts')).toBe(true);
    expect(getFeaturesForLevel(getLevel('2-8'), createNewSave()).has('shop')).toBe(false);
    expect(getFeaturesForLevel(getLevel('3-3'), createNewSave()).has('shop')).toBe(true);
  });

  it('first level: infinite hearts, no gear, no hints', () => {
    const run = createRun(getLevel('1-1'), createNewSave(), { seed: 1 });
    expect(run.hearts).toBeNull();
    expect(run.weapons).toHaveLength(0);
    expect(run.stats.hints).toBe(0);
    expect(hasAnySet(run.board, run.attributes)).toBe(true);
  });
});

describe('run reducer', () => {
  it('1-1: five Sets win it, and it cannot be lost', () => {
    let s = createRun(getLevel('1-1'), createNewSave(), { seed: 42 });
    expect(s.foeHp).toBe(15);
    expect(s.hearts).toBeNull();
    expect(s.movesLeft).toBeNull();
    expect(s.timeLeft).toBeNull();
    s = playSet(s);
    expect(s.foeHp).toBe(12);
    while (s.status === 'playing') s = playSet(s);
    expect(s.matches).toBe(5);
    expect(s.status).toBe('won');
    expect(computeStars(s)).toBe(3); // no mistakes
  });

  it.each([[0, 3], [1, 2], [2, 1], [5, 1]])('1-1 stars are about accuracy: %i mistakes → %i stars', (mistakes, stars) => {
    let s = createRun(getLevel('1-1'), createNewSave(), { seed: 8 });
    for (let i = 0; i < mistakes; i++) {
      const wrong = s.board.slice(0, 3);
      s = runReducer(s, { type: 'INVALID', cards: wrong });
      s = runReducer(s, { type: 'REPLACE', ids: wrong.map(c => c.id) });
    }
    expect(s.status).toBe('playing');
    while (s.status === 'playing') s = playSet(s);
    expect(computeStars(s)).toBe(stars);
  });

  it('move-limited levels count down moves', () => {
    let s = createRun(getLevel('1-3'), createNewSave(), { seed: 42 });
    const moves = s.movesLeft!;
    s = playSet(s);
    expect(s.movesLeft).toBe(moves - 1);
  });

  it('mistakes cost hearts and can lose the level', () => {
    let s = createRun(getLevel('1-2'), { ...createNewSave(), stars: { '1-1': 1 } }, { seed: 7 });
    const hearts = s.hearts!;
    expect(hearts).toBeGreaterThanOrEqual(3);
    // +1: Orange Tabby's Nine Lives absorbs one knockout
    for (let i = 0; i < hearts + 1; i++) s = runReducer(s, { type: 'INVALID', cards: s.board.slice(0, 3) });
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

  it('the bare first level has no ability or gear; everything after does', () => {
    const first = createRun(getLevel('1-1'), createNewSave(), { seed: 1 });
    expect(first.ability).toBeNull();
    expect(first.weapons).toHaveLength(0);
    const second = createRun(getLevel('1-2'), createNewSave(), { seed: 1 });
    expect(second.ability?.id).toBe('nine_lives');
    expect(second.weapons.length).toBeGreaterThan(0);
  });

  it('the equipped charm joins the fighter gear', () => {
    const save = { ...createNewSave(), armory: ['blast-powder-rare'], charm: 'blast-powder-rare' };
    const withCharm = createRun(getLevel('1-2'), save, { seed: 1 });
    const without = createRun(getLevel('1-2'), createNewSave(), { seed: 1 });
    expect(withCharm.weapons.map(w => w.id)).toContain('blast-powder-rare');
    expect(withCharm.weapons).toHaveLength(without.weapons.length + 1);
    expect(withCharm.stats.explosionChance).toBeGreaterThan(without.stats.explosionChance);
  });

  it('power cards appear from 1-4 on and add damage', () => {
    const before = createRun(getLevel('1-3'), createNewSave(), { seed: 2 });
    expect(before.features.has('power')).toBe(false);
    let found = false;
    for (let seed = 1; seed < 30 && !found; seed++) {
      found = createRun(getLevel('1-4'), createNewSave(), { seed }).board.some(c => c.bonusPoints === 2);
    }
    expect(found).toBe(true);
  });

  it('Orange Tabby — Nine Lives survives one knockout', () => {
    let s = createRun(getLevel('2-1'), { ...caughtUp(), selectedFighter: 'Orange Tabby' }, { seed: 2 });
    const hearts = s.hearts!;
    for (let i = 0; i < hearts; i++) s = runReducer(s, { type: 'INVALID', cards: s.board.slice(0, 3) });
    expect(s.status).toBe('playing');
    expect(s.hearts).toBe(1);
    expect(s.events.some(e => e.type === 'nine_lives')).toBe(true);
    s = runReducer(s, { type: 'INVALID', cards: s.board.slice(0, 3) });
    expect(s.status).toBe('lost');
  });

  it('Sly Fox — quick Sets build a combo; a mistake breaks it', () => {
    let s = createRun(getLevel('2-1'), { ...caughtUp(), selectedFighter: 'Sly Fox' }, { seed: 3 });
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
    let s = createRun(getLevel('2-1'), { ...caughtUp(), selectedFighter: 'Badger' }, { seed: 4 });
    s = runReducer(s, { type: 'INVALID', cards: s.board.slice(0, 3) });
    s = runReducer(s, { type: 'INVALID', cards: s.board.slice(0, 3) });
    expect(s.ability!.grudge).toBe(2);
    const before = s.foeHp;
    s = playSet(s);
    expect(before - s.foeHp).toBeGreaterThanOrEqual(3 + 6);
    expect(s.ability!.grudge).toBe(0);
  });

  it('Emperor Penguin — Deep Freeze stops the clock', () => {
    let s = createRun(getLevel('2-1'), { ...caughtUp(), selectedFighter: 'Emperor Penguin' }, { seed: 5 });
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

  it.each([6, 11, 21, 34, 55, 89, 144, 233])('Corgi — Zoomies re-deals a clean board (seed %i)', seed => {
    let s = createRun(getLevel('2-2'), { ...caughtUp(), selectedFighter: 'Corgi' }, { seed });
    for (let i = 0; i < 3; i++) s = playSet(s);
    const before = s.board.map(c => c.id);
    s = runReducer(s, { type: 'ABILITY' });
    expect(s.board.map(c => c.id)).not.toEqual(before);
    expect(s.board.some(c => c.isDud)).toBe(false);
    expect(hasAnySet(s.board, s.attributes)).toBe(true);
  });

  it('Pelican — Big Scoop plays a Set for you', () => {
    let s = createRun(getLevel('2-1'), { ...caughtUp(), selectedFighter: 'Pelican' }, { seed: 7 });
    for (let i = 0; i < 4; i++) s = playSet(s);
    const m = s.matches;
    s = runReducer(s, { type: 'ABILITY' });
    expect(s.matches).toBe(m + 1);
    expect(s.ability!.scooped).toHaveLength(3);
    expect(s.ability!.charge).toBe(0);
  });
});

describe('progression', () => {
  it('every star on every level pays coins, rising with the stars', () => {
    for (const l of LEVELS) {
      const { star1, star2, star3 } = l.rewards;
      expect(star1.coins).toBeGreaterThan(0);
      expect(star2.coins).toBeGreaterThanOrEqual(star1.coins);
      expect(star3.coins).toBeGreaterThanOrEqual(star2.coins);
    }
  });

  it('1-1 unlocks coins at ★, explosive Blast Powder at ★★, and Sly Fox at ★★★, each once', () => {
    const save = createNewSave();
    const lvl = getLevel('1-1');
    const r1 = applyLevelResult(save, lvl, 1, 0);
    expect(r1.unlocks).toEqual([{ kind: 'feature', feature: 'coins', star: 1 }]);
    expect(r1.save.coinsUnlocked).toBe(true);
    expect(r1.save.coins).toBe(20);
    const r2 = applyLevelResult(r1.save, lvl, 2, 5);
    expect(r2.unlocks).toEqual([{ kind: 'weapon', id: 'blast-powder-common', star: 2, firstWeapon: true }]);
    expect(r2.save.armory).toEqual(['blast-powder-common']);
    expect(r2.save.charm).toBe('blast-powder-common'); // first weapon is equipped automatically
    expect(r2.save.coins).toBe(20 + 30 + 5);
    const r3 = applyLevelResult(r2.save, lvl, 2, 0);
    expect(r3.granted).toHaveLength(0);
    expect(r3.unlocks).toHaveLength(0);
    const r4 = applyLevelResult(r3.save, lvl, 3, 0);
    expect(r4.unlocks).toEqual([{ kind: 'fighter', name: 'Sly Fox', star: 3 }]);
    expect(r4.save.unlockedFighters).toContain('Sly Fox');
    expect(r4.granted.map(g => g.star)).toEqual([3]);
    expect(r4.starCoins).toBe(50);
  });

  it('elite branches open at ★★ on their parent and never block the main path', () => {
    let save = createNewSave();
    for (const id of ['1-1', '1-2', '1-3', '1-4']) save = applyLevelResult(save, getLevel(id), 1, 0).save;
    save = applyLevelResult(save, getLevel('1-5'), 1, 0).save;
    expect(getLockReason(save, getLevel('1-5E'))).toEqual({ kind: 'branch', parentId: '1-5', need: 2 });
    expect(isLevelUnlocked(save, getLevel('1-6'))).toBe(true);
    save = applyLevelResult(save, getLevel('1-5'), 2, 0).save;
    expect(isLevelUnlocked(save, getLevel('1-5E'))).toBe(true);
  });

  it('levels unlock in order and biomes are star-gated', () => {
    let save = createNewSave();
    expect(isLevelUnlocked(save, getLevel('1-2'))).toBe(false);
    save = applyLevelResult(save, getLevel('1-1'), 1, 0).save;
    expect(isLevelUnlocked(save, getLevel('1-2'))).toBe(true);
    // Beat all of meadow with 1 star each: 8 stars < 12 gate for woods
    for (const l of MAIN_LEVELS.filter(x => x.biome === 'meadow')) save = applyLevelResult(save, l, 1, 0).save;
    expect(totalStars(save)).toBe(8);
    expect(isLevelUnlocked(save, getLevel('2-1'))).toBe(false);
  });

  it('boss star rewards unlock fighters', () => {
    const r = applyLevelResult(createNewSave(), getLevel('1-8'), 2, 0);
    expect(r.save.unlockedFighters).toContain('Corgi');
  });

  it('an older save gets unlocks that moved onto levels it already cleared', () => {
    // A save from before fighters unlocked early: stars but no Sly Fox, no weapons
    const old = { ...createNewSave(), stars: { '1-1': 3, '1-2': 2 }, coins: 70 };
    const fixed = reconcileUnlocks(old);
    expect(fixed.unlockedFighters).toContain('Sly Fox');
    expect(fixed.armory).toContain('blast-powder-common');
    expect(fixed.charm).toBe('blast-powder-common');
    expect(fixed.coins).toBe(70); // no coins paid twice
    expect(reconcileUnlocks(fixed)).toEqual(fixed);
  });

  it('camp purchases spend coins once Workshop and target mechanics are unlocked', () => {
    let save = { ...createNewSave(), coins: 1000 };
    save = levelFighter(save, 'Orange Tabby');
    expect(save.fighterLevels['Orange Tabby']).toBe(2);
    expect(save.coins).toBe(940);
    // Blocked before Workshop and Hearts (1-2) are unlocked
    expect(buyUpgrade(save, 'tough_hide')).toBe(save);
    save = { ...save, workshopUnlocked: true, stars: { '1-2': 1 } };
    save = buyUpgrade(save, 'tough_hide');
    expect(save.upgrades.tough_hide).toBe(1);
    expect(save.coins).toBe(690);
  });
});
