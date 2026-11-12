import { getLevel, LEVELS, MAIN_LEVELS } from '@/adventure/data/levels';
import { createNewSave, applyLevelResult, getLockReason, isLevelUnlocked, totalStars } from '@/adventure/progress';
import { getFeaturesForLevel, startingLoadout } from '@/adventure/loadout';
import { createRun, runReducer, computeStars } from '@/adventure/engine/run';
import { allSets, hasAnySet, isRainbow } from '@/adventure/engine/sets';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { ADVENTURE_WEAPONS } from '@/adventure/data/adventureWeapons';
import { SKILL_NODES } from '@/adventure/data/skillTrees';
import type { AdventureWeapon, RunState } from '@/adventure/types';
import { eventsOf, findSet, miss, playSet, startFight, testLevel, tick } from './testUtils/adventureFight';

describe('features accumulate along the map', () => {
  it('1-1 has no hearts, 1-2 introduces them, later levels keep them', () => {
    expect(getFeaturesForLevel(getLevel('1-1'), createNewSave()).has('hearts')).toBe(false);
    expect(getFeaturesForLevel(getLevel('1-2'), createNewSave()).has('hearts')).toBe(true);
    expect(getFeaturesForLevel(MAIN_LEVELS[MAIN_LEVELS.length - 1], createNewSave()).has('hearts')).toBe(true);
  });

  it('first level: infinite hearts, no gear, no passives, no hints', () => {
    const run = createRun(getLevel('1-1'), createNewSave(), { seed: 1 });
    expect(run.hearts).toBeNull();
    expect(run.weapons).toHaveLength(0);
    expect(run.passives).toHaveLength(0);
    expect(run.stats.hints).toBe(0);
    expect(hasAnySet(run.board, run.attributes)).toBe(true);
  });
});

describe('run reducer', () => {
  it('a Set deals its points and counts as a match', () => {
    let s = startFight({ level: testLevel({ foes: [{ name: 'Dummy', hp: 15 }] }), features: ['hearts'] });
    s = playSet(s);
    expect(s.foeHp).toBe(12);
    expect(s.matches).toBe(1);
    while (s.status === 'playing') s = playSet(s);
    expect(s.status).toBe('won');
    expect(s.endReason).toBe('defeated');
  });

  it.each([[0, 3], [1, 2], [2, 1], [5, 1]])('accuracy levels: %i mistakes → %i stars', (mistakes, stars) => {
    const level = testLevel({ foes: [{ name: 'Dummy', hp: 15 }], starRule: { kind: 'accuracy', threeStarMax: 0, twoStarMax: 1 } });
    let s = startFight({ level, features: [] });
    for (let i = 0; i < mistakes; i++) s = miss(s);
    expect(s.status).toBe('playing');
    while (s.status === 'playing') s = playSet(s);
    expect(computeStars(s)).toBe(stars);
  });

  it('move-limited levels count down moves and end survived', () => {
    let s = startFight({ level: testLevel({ rules: { moves: 2 } }), features: ['hearts'] });
    s = playSet(s);
    expect(s.movesLeft).toBe(1);
    s = playSet(s);
    expect(s.status).toBe('won');
    expect(computeStars(s)).toBe(1);
  });

  it('mistakes cost hearts and can lose the level', () => {
    let s = startFight({ level: testLevel({ rules: { hearts: 3 } }), features: ['hearts'] });
    for (let i = 0; i < 3; i++) s = miss(s);
    expect(s.hearts).toBe(0);
    expect(s.status).toBe('lost');
    expect(computeStars(s)).toBe(0);
  });

  it('timed levels give 1 star for surviving the clock', () => {
    let s = startFight({ level: testLevel({ rules: { timer: 20 } }), features: ['hearts'] });
    s = tick(s, 21000, 1000);
    expect(s.status).toBe('won');
    expect(s.endReason).toBe('survived');
  });

  it('waves advance through an intermission', () => {
    const level = testLevel({ foes: [{ name: 'A', hp: 6 }, { name: 'B', hp: 9 }] });
    let s = startFight({ level, features: ['hearts'] });
    while (s.status === 'playing') s = playSet(s);
    expect(s.status).toBe('intermission');
    s = runReducer(s, { type: 'NEXT_WAVE' });
    expect(s.wave).toBe(1);
    expect(s.foeHp).toBe(9);
    expect(s.setsThisWave).toBe(0);
  });

  it('the board keeps the same reference across quiet ticks', () => {
    const s = startFight({ level: testLevel({ rules: { timer: 60 } }), features: ['hearts'] });
    const t = runReducer(s, { type: 'TICK', ms: 250 });
    expect(t.board).toBe(s.board);
  });

  it('is deterministic for a given seed', () => {
    const play = () => {
      let s = startFight({ seed: 123, save: { selectedFighter: 'Corgi' } });
      for (let i = 0; i < 8; i++) s = playSet(tick(s, 1500));
      return s;
    };
    const a = play();
    const b = play();
    expect(a.board.map(c => `${c.shape}${c.color}${c.number}`)).toEqual(b.board.map(c => `${c.shape}${c.color}${c.number}`));
    expect(a.totalDamage).toBe(b.totalDamage);
    expect(a.rng).toBe(b.rng);
  });

  it('cards waiting to be replaced are left alone until REPLACE', () => {
    let s = startFight();
    const set = findSet(s)!;
    s = runReducer(s, { type: 'MATCH', cards: set, rewards: set.map(c => ({ cardId: c.id, points: 1 })) });
    expect(s.replacing).toEqual(set.map(c => c.id));
    s = runReducer(s, { type: 'REPLACE', ids: set.map(c => c.id) });
    expect(s.replacing).toEqual([]);
    expect(s.board.some(c => set.some(x => x.id === c.id))).toBe(false);
  });

  it('tracks the biggest hit and total damage', () => {
    let s = startFight({ features: ['hearts'] });
    s = playSet(s);
    expect(s.biggestHit).toBe(3);
    expect(s.totalDamage).toBe(3);
  });
});

describe('loadout', () => {
  const armory = ['blast-powder', 'mending-charm', 'flint-spark', 'war-drum', 'pinata'];

  it('fighters bring no gear: charms are the whole weapon loadout, capped at the slots', () => {
    const level = testLevel();
    const bare = startingLoadout(level, { ...createNewSave(), armory });
    expect(bare.weapons).toHaveLength(0);
    const save = { ...createNewSave(), armory, charms: [...armory, 'not-owned'] };
    expect(startingLoadout(level, save).weapons.map(w => w.id)).toEqual(armory.slice(0, 3));
    const belted = { ...save, upgrades: { charm_belt: 2 } };
    expect(startingLoadout(level, belted).weapons.map(w => w.id)).toEqual(armory);
    expect(startingLoadout(level, { ...save, upgrades: { charm_belt: 9 } }).charmSlots).toBe(6);
  });

  it('duplicate and unowned charms are dropped', () => {
    const save = { ...createNewSave(), armory: ['blast-powder'], charms: ['blast-powder', 'blast-powder', 'pinata'] };
    expect(startingLoadout(testLevel(), save).weapons.map(w => w.id)).toEqual(['blast-powder']);
  });

  it('bare levels stay bare even with charms, Arcana and nodes equipped', () => {
    const save = {
      ...createNewSave(),
      armory: ['blast-powder'],
      charms: ['blast-powder'],
      unlockedArcana: ['tempo_surge' as const],
      equippedArcana: ['tempo_surge' as const],
    };
    const l = startingLoadout(testLevel({ rules: { noGear: true } }), save);
    expect(l.weapons).toHaveLength(0);
    expect(l.arcana).toHaveLength(0);
    expect(l.passives).toHaveLength(0);
  });

  it('passives come from the fighter', () => {
    expect(startFight({ save: { selectedFighter: 'Sly Fox' } }).passives).toEqual(['combo', 'hot_streak']);
    expect(startFight({ save: { selectedFighter: 'Pelican' } }).passives).toEqual(['big_scoop', 'keen_eye']);
  });

  it('owned skill nodes of the fighter are live; other fighters’ nodes are ignored', () => {
    const tabby = SKILL_NODES.filter(n => n.fighter === 'Orange Tabby').slice(0, 2).map(n => n.id);
    const fox = SKILL_NODES.find(n => n.fighter === 'Sly Fox')!.id;
    const s = startFight({ save: { skillNodes: { 'Orange Tabby': [...tabby, fox] } } });
    expect(s.skillNodes).toEqual(tabby);
  });

  it('levels add flat gains to a rule weapon and tuning multiplies them (War Drum)', () => {
    const drum = (level: number, tuning: Record<string, number> = {}) => {
      const w = getArmoryWeapon('war-drum', { 'war-drum': { level, tuning } }) as AdventureWeapon;
      const r = w.rules![0];
      const e = r.effects[0];
      return [r.trigger.on === 'setsWithin' ? r.trigger.withinMs : NaN, e.do === 'empowerBoard' ? e.amount : NaN];
    };
    expect([1, 2, 3, 4, 5].map(l => drum(l))).toEqual([[20000, 2], [22000, 3], [24000, 3], [26000, 4], [28000, 4]]);
    // ×1.5 on the window, ×1.2 on power, at level 5
    expect(drum(5, { window: 4, power: 2 })).toEqual([42000, 5]);
    expect(getArmoryWeapon('war-drum', { 'war-drum': { level: 3, tuning: {} } })!.shortDescription).toBe('5 Sets in 24s: board +3 power');
  });

  it('every adventure weapon has numbers that grow with level and wording built from them', () => {
    for (const w of ADVENTURE_WEAPONS) {
      expect(Object.keys(w.stats ?? {}).length).toBeGreaterThan(0);
      for (const d of Object.values(w.stats!)) expect(d.perLevel).toBeGreaterThan(0);
      expect(w.description.length).toBeGreaterThan(10);
      expect(w.rules ?? w.modifiers).toBeDefined();
    }
  });

  it('a stat weapon levels every number flatly; tuning multiplies one (Blast Powder)', () => {
    const blast = (level: number, tuning: Record<string, number> = {}) =>
      getArmoryWeapon('blast-powder', { 'blast-powder': { level, tuning } })!.effects;
    expect([1, 2, 3, 4, 5].map(l => blast(l).explosionChance)).toEqual([10, 16, 22, 28, 34]);
    expect([1, 2, 3, 4, 5].map(l => blast(l).explosionDamage)).toEqual([0.25, 0.5, 0.75, 1, 1.25]);
    expect(blast(5, { explosionChance: 4 }).explosionChance).toBe(51);
    expect(blast(5, { explosionChance: 4 }).explosionDamage).toBe(1.25);
    expect(getArmoryWeapon('blast-powder', { 'blast-powder': { level: 3, tuning: { explosionChance: 2 } } })!.shortDescription)
      .toBe('26.4% blast, 1.8 dmg per card');
  });
});

describe('fighter passives', () => {
  const fight = (fighter: RunState['fighter'], over: Parameters<typeof startFight>[0] = {}) =>
    startFight({ ...over, save: { selectedFighter: fighter, ...over.save } });

  it('Orange Tabby — Nine Lives survives one knockout', () => {
    let s = fight('Orange Tabby', { level: testLevel({ rules: { hearts: 3 } }) });
    for (let i = 0; i < 3; i++) s = miss(s);
    expect(s.status).toBe('playing');
    expect(s.hearts).toBe(1);
    expect(s.passive.nineLivesLeft).toBe(0);
    s = miss(s);
    expect(s.status).toBe('lost');
  });

  it('Orange Tabby — Scrappy adds damage per missing heart', () => {
    let s = fight('Orange Tabby', { features: ['hearts', 'gear'] });
    s = miss(miss(s));
    const before = s.foeHp;
    s = playSet(s);
    expect(before - s.foeHp).toBe(3 + 2);
  });

  it('Sly Fox — quick Sets chain a combo, a mistake breaks it, max combo arms Hot Streak', () => {
    let s = fight('Sly Fox', { features: ['hearts', 'gear'] });
    const hit = (st: RunState) => {
      const before = st.foeHp;
      const next = playSet(tick(st, 1000));
      return { next, dmg: before - next.foeHp };
    };
    let r = hit(s);
    expect(r.next.combo).toBe(1);
    expect(r.dmg).toBe(3);
    r = hit(r.next);
    expect(r.next.combo).toBe(2);
    expect(r.dmg).toBe(4);
    r = hit(hit(hit(r.next).next).next); // combo 5 = 4 steps = max
    expect(r.next.combo).toBe(5);
    expect(r.next.passive.hotStreak).toBe(true);
    r = hit(r.next);
    expect(r.dmg).toBe((3 + 4) * 2);
    s = miss(r.next);
    expect(s.combo).toBe(0);
    expect(s.passive.hotStreak).toBe(false);
    expect(s.maxCombo).toBe(6);
  });

  it('every fighter has a combo counter (it just deals no damage)', () => {
    let s = fight('Orange Tabby', { features: ['gear'] });
    s = playSet(tick(s, 500));
    s = playSet(tick(s, 500));
    expect(s.combo).toBe(2);
    s = tick(s, 6000);
    expect(s.combo).toBe(0);
  });

  it('Badger — Grudge stores mistakes for the next Set; Thick Hide spares the first heart each wave', () => {
    let s = fight('Badger', { features: ['hearts', 'gear'] });
    const hearts = s.hearts!;
    s = miss(s);
    expect(s.hearts).toBe(hearts);
    expect(eventsOf(s, 'thick_hide')).toHaveLength(1);
    s = miss(s);
    expect(s.hearts).toBe(hearts - 1);
    expect(s.passive.grudge).toBe(2);
    const before = s.foeHp;
    s = playSet(s);
    expect(before - s.foeHp).toBe(3 + 6);
    expect(s.passive.grudge).toBe(0);
  });

  it('Emperor Penguin — Patience rewards slow Sets; Deep Freeze stops the clock on Rainbows', () => {
    let s = fight('Emperor Penguin', { level: testLevel({ rules: { timer: 120 } }), features: ['hearts', 'gear'] });
    s = tick(s, 6000, 1000);
    let before = s.foeHp;
    s = playSet(s);
    expect(before - s.foeHp).toBe(3 + 3);
    before = s.foeHp;
    s = playSet(tick(s, 1000));
    expect(before - s.foeHp).toBe(3);

    let r = fight('Emperor Penguin', { level: testLevel({ rules: { timer: 120 } }), features: ['hearts', 'gear', 'rainbow'], seed: 3 });
    for (let i = 0; i < 40 && !findSet(r, set => isRainbow(set, r.attributes)); i++) r = playSet(r);
    const rainbow = findSet(r, set => isRainbow(set, r.attributes))!;
    r = playSet(r, rainbow);
    expect(r.frozenMs).toBe(4000);
    const t = r.timeLeft;
    r = tick(r, 3000, 1000);
    expect(r.timeLeft).toBe(t);
    r = tick(r, 2000, 1000);
    expect(r.timeLeft).toBeLessThan(t!);
  });

  it.each([6, 11, 21, 34])('Corgi — every 5th Set re-deals a clean board (seed %i)', seed => {
    let s = fight('Corgi', { seed });
    for (let i = 0; i < 4; i++) s = playSet(s);
    expect(s.passive.zoomiesIn).toBe(1);
    const set = findSet(s)!;
    const others = s.board.filter(c => !set.some(x => x.id === c.id) && (c.health ?? 1) <= 1).map(c => c.id);
    s = playSet(s, set);
    expect(eventsOf(s, 'redeal')).toHaveLength(1);
    expect(s.board.some(c => others.includes(c.id))).toBe(false);
    expect(s.board.some(c => c.isDud || c.isFaceDown)).toBe(false);
    expect(hasAnySet(s.board, s.attributes)).toBe(true);
    expect(s.passive.zoomiesIn).toBe(5);
  });

  it('Corgi — Fetch brings a new power card when one is matched', () => {
    let s = fight('Corgi', { features: ['gear', 'power'] });
    for (let i = 0; i < 30 && !findSet(s, set => set.some(c => (c.bonusPoints ?? 0) > 0)); i++) s = playSet(s);
    const set = findSet(s, x => x.some(c => (c.bonusPoints ?? 0) > 0))!;
    const ids = new Set(set.map(c => c.id));
    const powerOthers = (st: RunState) => st.board.filter(c => (c.bonusPoints ?? 0) > 0 && !ids.has(c.id)).length;
    const before = powerOthers(s);
    s = runReducer(s, { type: 'MATCH', cards: set, rewards: set.map(c => ({ cardId: c.id, points: 1 + (c.bonusPoints ?? 0) })) });
    expect(eventsOf(s, 'fetch').length).toBeGreaterThan(0);
    expect(powerOthers(s)).toBe(before + 1);
  });

  it('Pelican — every 6th Set scoops a free Set (no move spent, not counted toward the next scoop)', () => {
    let s = fight('Pelican', { level: testLevel({ rules: { moves: 30 } }) });
    for (let i = 0; i < 5; i++) s = playSet(s);
    expect(s.matches).toBe(5);
    s = playSet(s);
    expect(s.matches).toBe(7);
    expect(s.movesLeft).toBe(24);
    expect(eventsOf(s, 'scoop')).toHaveLength(1);
    expect(s.passive.scoopIn).toBe(6);
    expect(hasAnySet(s.board, s.attributes)).toBe(true);
  });

  it('Pelican — Keen Eye lights a card of a Set after 8s; a skill node makes it 6s', () => {
    let s = fight('Pelican');
    s = tick(s, 7000, 1000);
    expect(s.passive.keenEyeCardId).toBeNull();
    s = tick(s, 1000, 1000);
    const id = s.passive.keenEyeCardId!;
    expect(allSets(s.board, s.attributes).some(set => set.some(c => c.id === id))).toBe(true);
    s = playSet(s);
    expect(s.passive.keenEyeCardId).toBeNull();

    const sharp = SKILL_NODES.find(n => n.fighter === 'Pelican' && n.modifiers?.passiveTuning?.['keenEye.ms'] === -2000)!;
    let t = fight('Pelican', { save: { skillNodes: { Pelican: [sharp.id] } } });
    t = tick(t, 6000, 1000);
    expect(t.passive.keenEyeCardId).not.toBeNull();
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

  it('elite branches open at ★★ on their parent and never block the main path', () => {
    const elite = LEVELS.find(l => l.branchOf)!;
    const parent = getLevel(elite.branchOf!);
    let save = createNewSave();
    for (const l of MAIN_LEVELS.slice(0, MAIN_LEVELS.indexOf(parent) + 1)) save = applyLevelResult(save, l, 1, 0).save;
    expect(getLockReason(save, elite)).toEqual({ kind: 'branch', parentId: parent.id, need: 2 });
    save = applyLevelResult(save, parent, 2, 0).save;
    expect(isLevelUnlocked(save, elite)).toBe(true);
  });

  it('levels unlock in order', () => {
    let save = createNewSave();
    expect(isLevelUnlocked(save, MAIN_LEVELS[1])).toBe(false);
    save = applyLevelResult(save, MAIN_LEVELS[0], 1, 0).save;
    expect(isLevelUnlocked(save, MAIN_LEVELS[1])).toBe(true);
    expect(totalStars(save)).toBe(1);
  });
});
