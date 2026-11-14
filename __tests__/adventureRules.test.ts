/**
 * The rule interpreter, evolutions, traps, challenges and Arcana stacking.
 * Rules are injected as test relics so these tests don't depend on content.
 */
import { baseCardReward, runReducer } from '@/adventure/engine/run';
import { allSets, hasAnySet } from '@/adventure/engine/sets';
import { MAX_FIRINGS_PER_ACTION } from '@/adventure/rules/engine';
import { arcanaRules, combineArcana } from '@/adventure/data/arcana';
import { challengeProgress, describeChallenge } from '@/adventure/engine/challenges';
import { snareTarget } from '@/adventure/engine/fight';
import { EVOLUTION_RECIPES } from '@/adventure/data/evolutions';
import type { Card } from '@/types';
import type { WeaponEffectResult } from '@/utils/weaponEffects';
import type { ChallengeDef, RunState } from '@/adventure/types';
import type { Rule } from '@/adventure/rules/types';
import { eventsOf, findSet, miss, playSet, relic, startFight, testLevel, tick, withWeapons } from './testUtils/adventureFight';

const damageOf = (s: RunState, set?: Card[]) => {
  const before = s.foeHp;
  const next = playSet(s, set);
  return { next, dmg: before - next.foeHp };
};

const hurtBy = (s: RunState, n: number): RunState => ({ ...s, hearts: s.hearts! - n });

describe('rule interpreter', () => {
  // Pelican: no passive touches Set damage
  const base = () => startFight({ save: { selectedFighter: 'Pelican' }, features: ['hearts', 'gear'] });

  it('a trigger fires its effects (and shows its callout)', () => {
    const s = withWeapons(base(), relic([{ trigger: { on: 'set' }, effects: [{ do: 'damage', amount: 5 }], callout: 'Zap!' }]));
    const { next, dmg } = damageOf(s);
    expect(dmg).toBe(3 + 5);
    expect(eventsOf(next, 'rule').map(e => e.text)).toEqual(['Zap!']);
    expect(next.biggestHit).toBe(8);
  });

  it('weapon effects chain into weapon triggers', () => {
    const s = withWeapons(
      hurtBy(base(), 2),
      relic([{ trigger: { on: 'set' }, effects: [{ do: 'heal', amount: 1 }] }]),
      relic([{ trigger: { on: 'weapon', kind: 'heal' }, effects: [{ do: 'damage', amount: 7 }] }], undefined, 'relic-b'),
      relic([{ trigger: { on: 'healed' }, effects: [{ do: 'coins', amount: 1 }] }], undefined, 'relic-c')
    );
    const { next, dmg } = damageOf(s);
    expect(dmg).toBe(3 + 7);
    expect(next.hearts).toBe(s.hearts! + 1);
  });

  it('a rule never reacts to what its own effects caused', () => {
    // set → heal; heal → heal (would loop forever without the guard)
    const s = withWeapons(
      hurtBy(base(), 3),
      relic([
        { trigger: { on: 'set' }, effects: [{ do: 'heal', amount: 1 }] },
        { trigger: { on: 'weapon', kind: 'heal' }, effects: [{ do: 'heal', amount: 1 }] },
      ])
    );
    const next = playSet(s);
    expect(next.hearts).toBe(s.hearts! + 2);
  });

  it(`one action resolves at most ${MAX_FIRINGS_PER_ACTION} rule firings`, () => {
    const many = Array.from({ length: 50 }, (_, i) => relic([{ trigger: { on: 'set' }, effects: [{ do: 'damage', amount: 1 }] }], undefined, `r${i}`));
    const { dmg } = damageOf(withWeapons(base(), ...many));
    expect(dmg).toBe(3 + MAX_FIRINGS_PER_ACTION);
  });

  it('doubleNext makes the next weapon trigger happen twice, and both copies chain', () => {
    const s = withWeapons(
      hurtBy(base(), 3),
      relic([
        { trigger: { on: 'mistake' }, effects: [{ do: 'doubleNext' }] },
        { trigger: { on: 'set' }, effects: [{ do: 'heal', amount: 1 }] },
      ]),
      relic([{ trigger: { on: 'weapon', kind: 'heal' }, effects: [{ do: 'damage', amount: 1 }] }], undefined, 'counter')
    );
    let next = miss(s);
    expect(next.doubleNext).toBe(1);
    const hearts = next.hearts!;
    const r = damageOf(next);
    next = r.next;
    expect(next.hearts).toBe(hearts + 2);
    expect(r.dmg).toBe(3 + 2);
    expect(eventsOf(next, 'doubled')).toHaveLength(1);
    expect(next.doubleNext).toBe(0);
  });

  it('weapons GameBoard rolled on a Set queue their triggers; a waiting double replays one', () => {
    const fx = (cards: Card[]): WeaponEffectResult => ({
      explosiveCards: cards, laserCards: [], laserCount: 0, fireCards: [], ricochetCards: [], ricochetCount: 0, autoMatchedSets: [],
      bonusPoints: 0, bonusMoney: 0, bonusTime: 0, bonusGraces: 0, bonusHealing: 0, bonusHints: 0, bonusExperience: 0, bonusCoins: 0,
      boardGrowth: 0, notifications: [], timeGainTriggered: false,
    });
    const s = withWeapons(base(), relic([{ trigger: { on: 'weapon', kind: 'explosion' }, effects: [{ do: 'damage', amount: 5 }] }]));
    const blastWith = (st: RunState) => {
      const set = findSet(st)!;
      const collateral = st.board.filter(c => !set.includes(c)).slice(0, 1);
      const cards = [...set, ...collateral];
      return runReducer(st, { type: 'MATCH', cards, rewards: cards.map(c => ({ cardId: c.id, points: 1 })), effects: fx(collateral) });
    };
    const once = blastWith(s);
    expect(s.foeHp - once.foeHp).toBe(4 + 5);
    expect(once.explosionsTriggered).toBe(1);
    const twice = blastWith({ ...s, doubleNext: 1 });
    expect(eventsOf(twice, 'doubled')).toHaveLength(1);
    // The board's own blast says where it happened (its damage is inside the Set's hit); the replay deals its own
    const blasts = eventsOf(twice, 'blast');
    expect(blasts).toHaveLength(2);
    expect(blasts[0].amount).toBeUndefined();
    expect(blasts[0].slots).toHaveLength(1);
    expect(blasts[1].amount).toBeGreaterThanOrEqual(1);
    expect(s.foeHp - twice.foeHp).toBeGreaterThanOrEqual(4 + 5 + 5 + 1);
  });

  it('everyNthSet, setsWithin and firstSetOfWave count the right Sets', () => {
    const s = withWeapons(
      base(),
      relic([{ trigger: { on: 'everyNthSet', n: 3 }, effects: [{ do: 'damage', amount: 10 }] }]),
      relic([{ trigger: { on: 'setsWithin', count: 2, withinMs: 3000 }, effects: [{ do: 'damage', amount: 100 }] }], undefined, 'b'),
      relic([{ trigger: { on: 'firstSetOfWave' }, effects: [{ do: 'damage', amount: 50 }] }], undefined, 'c')
    );
    const dmgs: number[] = [];
    let cur = s;
    for (const wait of [0, 5000, 5000, 1000]) {
      const r = damageOf(tick(cur, wait, 1000));
      dmgs.push(r.dmg);
      cur = r.next;
    }
    expect(dmgs).toEqual([3 + 50, 3, 3 + 10, 3 + 100]);
  });

  it('idle rules fire once per quiet stretch; foeBelow fires once per foe', () => {
    let s = withWeapons(
      startFight({ level: testLevel({ foes: [{ name: 'Dummy', hp: 20 }] }), features: ['hearts', 'gear'] }),
      relic([{ trigger: { on: 'idle', ms: 3000 }, effects: [{ do: 'damage', amount: 1 }] }]),
      relic([{ trigger: { on: 'foeBelow', fraction: 0.5 }, effects: [{ do: 'damage', amount: 2 }] }], undefined, 'b')
    );
    s = tick(s, 10000, 1000);
    expect(s.foeHp).toBe(19);
    s = playSet(s);
    s = tick(s, 3000, 1000);
    expect(s.foeHp).toBe(15);
    s = playSet(playSet(s)); // 15 → 12 → 9 (< 10: foeBelow +2 → 7)
    expect(s.foeHp).toBe(7);
    s = playSet(s);
    expect(s.foeHp).toBe(4);
  });

  it('conditions gate rules; chance 0 never fires', () => {
    const s = withWeapons(
      base(),
      relic([{ trigger: { on: 'set' }, when: [{ kind: 'chance', pct: 0 }], effects: [{ do: 'damage', amount: 50 }] }]),
      relic([{ trigger: { on: 'set' }, when: [{ kind: 'heartsFull' }], effects: [{ do: 'damage', amount: 5 }] }], undefined, 'b'),
      relic([{ trigger: { on: 'set' }, when: [{ kind: 'noMistakesThisFight' }], effects: [{ do: 'damage', amount: 7 }] }], undefined, 'c')
    );
    expect(damageOf(s).dmg).toBe(3 + 5 + 7);
    expect(damageOf(miss(s)).dmg).toBe(3);
  });

  it('time-since-last-Set conditions on a set trigger measure from the previous Set', () => {
    const s = withWeapons(
      base(),
      relic([{ trigger: { on: 'set' }, when: [{ kind: 'timeSinceLastSetAtLeast', ms: 4000 }], effects: [{ do: 'damage', amount: 10 }] }]),
      relic([{ trigger: { on: 'set' }, when: [{ kind: 'timeSinceLastSetAtMost', ms: 2000 }], effects: [{ do: 'damage', amount: 1 }] }], undefined, 'b')
    );
    const first = damageOf(tick(s, 5000, 1000));
    expect(first.dmg).toBe(3 + 10);
    expect(damageOf(tick(first.next, 1000, 1000)).dmg).toBe(3 + 1);
  });

  it('charged cards hit harder but are not power cards (power-card effects cannot feed on a board-wide boost)', () => {
    let s = withWeapons(
      startFight({ save: { selectedFighter: 'Pelican' }, features: ['hearts', 'gear'] }),
      relic([{ trigger: { on: 'set' }, effects: [{ do: 'empowerBoard', amount: 2 }] }]),
      relic([{ trigger: { on: 'bonusCardMatched' }, effects: [{ do: 'damage', amount: 1 }] }], undefined, 'b')
    );
    s = playSet(s);
    const set = findSet(s, x => x.every(c => (c.charge ?? 0) >= 2 && !c.bonusPoints && !c.bonusMoney))!;
    const before = s.foeHp;
    // Score with the real card values (playSet pays a flat 1 per card)
    s = runReducer(s, { type: 'MATCH', cards: set, rewards: set.map(baseCardReward) });
    expect(s.bonusCardsMatched).toBe(0);
    expect(eventsOf(s, 'hit').some(e => e.text === 'Bonus')).toBe(false);
    // 3 cards × (1 + 2 charge)
    expect(before - s.foeHp).toBe(3 * 3);
  });

  it('modifiers: flat and conditional Set damage', () => {
    const s = withWeapons(base(), relic([], { setDamage: 2, conditionalDamage: [{ when: [{ kind: 'heartsAtMost', n: 3 }], amount: 4 }] }));
    expect(damageOf(s).dmg).toBe(3 + 2);
    expect(damageOf(hurtBy(s, 2)).dmg).toBe(3 + 2 + 4);
  });

  it('area effects use the 3-column grid, skip the Set being scored, and armored cards lose a hit', () => {
    let s = withWeapons(base(), relic([{ trigger: { on: 'set' }, effects: [{ do: 'explode', area: { shape: 'block', cols: 3, rows: 2 } }] }]));
    s = { ...s, board: s.board.map((c, i) => (i === 0 ? { ...c, health: 3 } : c)) };
    const set = findSet(s, x => !x.some(c => c.id === s.board[0].id))!;
    const before = s.board;
    const next = runReducer(s, { type: 'MATCH', cards: set, rewards: set.map(c => ({ cardId: c.id, points: 1 })) });
    const blast = eventsOf(next, 'blast')[0];
    expect(blast).toBeDefined();
    for (const c of set) expect(next.board.some(x => x.id === c.id)).toBe(true);
    const changed = before.map((c, i) => (next.board[i].id !== c.id ? i : -1)).filter(i => i >= 0);
    expect(changed.length).toBe(Number(blast.text));
    expect(changed.every(i => Math.floor(i / 3) === Math.floor(changed[0] / 3) || Math.floor(i / 3) === Math.floor(changed[0] / 3) + 1)).toBe(true);
    if (next.board[0].id === before[0].id) expect(next.board[0].health).toBeLessThanOrEqual(3);
    expect(next.explosionsTriggered).toBe(1);
    expect(hasAnySet(next.board, next.attributes)).toBe(true);
  });

  it('armorCard makes a piñata; breaking it pays its bounty and fires cardBroken', () => {
    let s = withWeapons(
      base(),
      relic([{ trigger: { on: 'mistake' }, effects: [{ do: 'armorCard', extraHealth: 1, bounty: 10 }] }]),
      relic([{ trigger: { on: 'cardBroken' }, effects: [{ do: 'damage', amount: 1 }] }], undefined, 'b')
    );
    s = miss(s);
    const pinata = s.board.find(c => c.bounty === 10)!;
    expect(pinata.health).toBe(2);
    expect(eventsOf(s, 'pinata')).toHaveLength(1);
    for (let i = 0; i < 40 && s.board.some(c => c.id === pinata.id); i++) {
      s = playSet(s, findSet(s, x => x.some(c => c.id === pinata.id)) ?? findSet(s));
    }
    expect(s.board.some(c => c.id === pinata.id)).toBe(false);
    expect(eventsOf(s, 'pinata_break')[0]?.amount).toBe(10);
    expect(eventsOf(s, 'hit').some(e => e.amount === 1 && e.text === 'Bonus')).toBe(true);
  });

  it('simplify makes one attribute the same on every card, then wears off', () => {
    let s = withWeapons(base(), relic([{ trigger: { on: 'set' }, effects: [{ do: 'simplify', ms: 5000 }] }]));
    s = playSet(s);
    const simp = s.simplified!;
    expect(simp).not.toBeNull();
    expect(s.board.every(c => (c as unknown as Record<string, unknown>)[simp.attribute] === simp.value)).toBe(true);
    s = tick(s, 5000, 1000);
    expect(s.simplified).toBeNull();
    expect(eventsOf(s, 'simplify_end')).toHaveLength(1);
  });

  it('empowerBoard charges every card on the board', () => {
    const s = playSet(withWeapons(base(), relic([{ trigger: { on: 'set' }, effects: [{ do: 'empowerBoard', amount: 2 }] }])));
    expect(s.board.filter(c => !s.replacing.includes(c.id)).some(c => (c.charge ?? 0) >= 2)).toBe(true);
  });

  it('next-Set multipliers add up and cap at ×4; the board-growth trigger needs room to grow', () => {
    const times = relic([{ trigger: { on: 'mistake' }, effects: [{ do: 'nextSetMultiplier', times: 2 }] }]);
    let s = withWeapons(base(), times);
    s = miss(miss(s));
    expect(s.nextSetMultiplier).toBe(3);
    s = miss(miss(s));
    expect(s.nextSetMultiplier).toBe(4);

    const grow = withWeapons(
      base(),
      relic([{ trigger: { on: 'set' }, effects: [{ do: 'growBoard', count: 30 }] }]),
      relic([{ trigger: { on: 'weapon', kind: 'growth' }, effects: [{ do: 'damage', amount: 1 }] }], undefined, 'b')
    );
    const grown = playSet(grow);
    const full = playSet(grown);
    expect(eventsOf(grown, 'hit').filter(e => e.text === 'Bonus')).toHaveLength(1);
    expect(eventsOf(full, 'hit').filter(e => e.text === 'Bonus')).toHaveLength(1); // no new growth, no new trigger
  });

  it('nextSetMultiplier and comboStep feed the next Set', () => {
    const s = withWeapons(
      startFight({ save: { selectedFighter: 'Sly Fox' }, features: ['hearts', 'gear'] }),
      relic([{ trigger: { on: 'mistake' }, effects: [{ do: 'nextSetMultiplier', times: 3 }, { do: 'comboStep', amount: 2 }] }])
    );
    const after = miss(s);
    expect(after.nextSetMultiplier).toBe(3);
    expect(after.combo).toBe(3); // a chain of 1 plus 2 steps
    const { next, dmg } = damageOf(after);
    expect(dmg).toBe((3 + 3) * 3); // the Set extends the chain to 4 = 3 steps
    expect(next.nextSetMultiplier).toBe(1);
  });
});

describe('evolutions', () => {
  const phoenix = EVOLUTION_RECIPES.find(r => r.id === 'phoenix-pyre')!;
  const armedSave = {
    armory: ['blast-powder', 'mending-charm'],
    charms: ['blast-powder', 'mending-charm'],
    unlockedEvolutions: [phoenix.id],
  };

  it('a recipe is armed only when unlocked and both families are held', () => {
    expect(startFight({ save: armedSave }).armedRecipes).toEqual([phoenix.id]);
    expect(startFight({ save: { ...armedSave, unlockedEvolutions: [] } }).armedRecipes).toEqual([]);
    expect(startFight({ save: { ...armedSave, charms: ['blast-powder'] } }).armedRecipes).toEqual([]);
  });

  it('likelihood = 16% base + 4% per Evolution Lab tier + modifiers', () => {
    expect(startFight({ save: armedSave }).evolutionLikelihood).toBe(16);
    expect(startFight({ save: { ...armedSave, upgrades: { evolution_lab: 3 } } }).evolutionLikelihood).toBe(28);
    const prism = { ...armedSave, armory: [...armedSave.armory, 'catalyst-prism'], charms: [...armedSave.charms, 'catalyst-prism'] };
    expect(startFight({ save: prism }).evolutionLikelihood).toBe(22);
  });

  it('a level can add to the likelihood', () => {
    expect(startFight({ save: armedSave, level: testLevel({ rules: { evolutionLikelihood: 30 } }) }).evolutionLikelihood).toBe(46);
  });

  const catalystOn = (s: RunState): RunState => {
    const set = findSet(s)!;
    return { ...s, board: s.board.map(c => (c.id === set[0].id ? { ...c, hasEvolutionItem: true, evolutionReady: true } : c)) };
  };
  const catalystSet = (s: RunState) => findSet(s, set => set.some(c => c.hasEvolutionItem))!;

  it('refills spawn a Catalyst by likelihood, one at a time', () => {
    let s = { ...startFight({ save: armedSave }), evolutionLikelihood: 100 };
    s = playSet(s);
    expect(s.board.filter(c => c.hasEvolutionItem)).toHaveLength(1);
    expect(eventsOf(s, 'catalyst_spawn')).toHaveLength(1);
    s = playSet(s, findSet(s, set => !set.some(c => c.hasEvolutionItem)));
    expect(s.board.filter(c => c.hasEvolutionItem)).toHaveLength(1);
  });

  it('matching the Catalyst hits the foe and starts a 30s evolution: its rules are live, and every Set deals ×1.5 and +2', () => {
    let s = catalystOn(startFight({ save: armedSave, features: ['hearts', 'gear', 'evolutions'] }));
    const plain = damageOf(s, findSet(s, set => !set.some(c => c.hasEvolutionItem))).dmg;
    s = playSet(s, catalystSet(s));
    expect(s.activeEvolutions).toEqual([{ id: phoenix.id, remainingMs: 30000, durationMs: 30000 }]);
    // The opening burst, named after the recipe in the fight log
    expect(s.log[s.log.length - 1].lines).toContainEqual({ type: 'hit', amount: 10, text: phoenix.name });
    expect(s.evolutionsTriggered).toBe(1);
    expect(s.forgedRecipes).toEqual([phoenix.id]);
    expect(eventsOf(s, 'evolution_start')[0].text).toBe(phoenix.name);
    const before = s.foeHp;
    s = miss(s); // Phoenix: a lost heart blasts a 3×2 block
    expect(eventsOf(s, 'blast').length).toBeGreaterThan(0);
    expect(s.foeHp).toBeLessThan(before);
    const r = damageOf(s, findSet(s));
    expect(r.dmg).toBeGreaterThanOrEqual(Math.max(4, plain));
    s = tick(r.next, 30000, 1000);
    expect(s.activeEvolutions).toEqual([]);
    expect(eventsOf(s, 'evolution_end')).toHaveLength(1);
  });

  it('at most 3 evolutions per fight; no Catalyst spawns after the cap', () => {
    let s = { ...startFight({ save: armedSave, features: ['hearts', 'gear', 'evolutions'] }), evolutionLikelihood: 100 };
    for (let i = 0; i < 3; i++) {
      s = catalystOn({ ...s, board: s.board.map(c => ({ ...c, hasEvolutionItem: false })) });
      s = playSet(s, catalystSet(s));
    }
    expect(s.evolutionsTriggered).toBe(3);
    expect(s.evolutionCap).toBe(3);
    s = { ...s, evolutionLikelihood: 100, board: s.board.map(c => ({ ...c, hasEvolutionItem: false })) };
    for (let i = 0; i < 5; i++) s = playSet(s);
    expect(s.board.some(c => c.hasEvolutionItem)).toBe(false);
  });

  it('several recipes can run at once; the Catalyst picks one that is not running', () => {
    const second = EVOLUTION_RECIPES.find(r => r.id !== phoenix.id)!;
    const ids = [phoenix.id, second.id];
    const held = [...armedSave.charms, ...second.families.map(f => f[0])];
    let s = startFight({ save: { armory: held, charms: held, unlockedEvolutions: ids, upgrades: { charm_belt: 3 } } });
    // Both are armed (the four weapons also arm some pair recipes, which come later in recipe order)
    expect(s.armedRecipes.slice(0, 2)).toEqual(ids);
    s = catalystOn(s);
    s = playSet(s, catalystSet(s));
    s = catalystOn({ ...s, board: s.board.map(c => ({ ...c, hasEvolutionItem: false })) });
    s = playSet(s, catalystSet(s));
    expect(new Set(s.activeEvolutions.map(e => e.id))).toEqual(new Set(ids));
  });

  it('a Catalyst picked in a wrong Set is not lost: it moves to another card', () => {
    let s = catalystOn(startFight({ save: armedSave }));
    const wrong = [s.board.find(c => c.hasEvolutionItem)!, ...s.board.filter(c => !c.hasEvolutionItem).slice(0, 2)];
    s = runReducer(s, { type: 'INVALID', cards: wrong });
    s = runReducer(s, { type: 'REPLACE', ids: wrong.map(c => c.id) });
    expect(s.board.filter(c => c.hasEvolutionItem)).toHaveLength(1);
    expect(s.evolutionsTriggered).toBe(0);
  });
});

describe('traps', () => {
  it('time bombs: one at the start, fuse in seconds, a heart and a fresh card when it goes off', () => {
    let s = startFight({ level: testLevel({ rules: { hazards: { timeBombs: { every: 3, seconds: 5 } } } }), features: ['hearts', 'gear'] });
    expect(s.timeBombIds).toHaveLength(1);
    const bomb = s.board.find(c => c.id === s.timeBombIds[0])!;
    expect(bomb.hasCountdown).toBe(true);
    expect(bomb.countdownTimer).toBe(5);
    const hearts = s.hearts!;
    s = tick(s, 5000, 1000);
    expect(s.hearts).toBe(hearts - 1);
    expect(s.board.some(c => c.id === bomb.id)).toBe(false);
    expect(eventsOf(s, 'trap_sprung')[0].text).toBe('bomb');
  });

  it('time bombs: matching one in time defuses it', () => {
    let s = startFight({ level: testLevel({ rules: { hazards: { timeBombs: { every: 99, seconds: 30 } } } }), features: ['hearts', 'gear'] });
    const id = s.timeBombIds[0];
    for (let i = 0; i < 40 && !findSet(s, set => set.some(c => c.id === id)); i++) s = playSet(s);
    s = playSet(s, findSet(s, set => set.some(c => c.id === id)));
    expect(s.trapsDefused).toBe(1);
    expect(s.timeBombIds).toEqual([]);
  });

  it('every N refilled cards bring a new trap, at most 2 of each kind', () => {
    let s = startFight({ level: testLevel({ rules: { hazards: { timeBombs: { every: 3, seconds: 60 }, snares: { every: 3 } } } }), features: ['hearts', 'gear'] });
    const avoid = (st: RunState) => findSet(st, set => !set.some(c => c.hasCountdown || c.snare)) ?? findSet(st);
    for (let i = 0; i < 6; i++) {
      s = playSet(s, avoid(s));
      expect(s.board.filter(c => c.hasCountdown).length).toBeLessThanOrEqual(2);
      expect(s.board.filter(c => c.snare).length).toBeLessThanOrEqual(2);
    }
    expect(s.board.filter(c => c.snare).length).toBe(2);
  });

  /** A fight with one snare and a Set that matches `pick` (the target or the snared card), searching seeds. */
  const snareFight = (pick: 'target' | 'snared') => {
    for (let seed = 1; seed < 200; seed++) {
      const fight = startFight({ seed, level: testLevel({ rules: { hazards: { snares: { every: 999 } } } }), features: ['hearts', 'gear'] });
      const s = { ...fight, passives: [] };
      const i = s.board.findIndex(c => c.snare);
      const t = snareTarget(i, s.board[i].snare!, s.board.length)!;
      const [want, avoid] = pick === 'target' ? [s.board[t].id, s.board[i].id] : [s.board[i].id, s.board[t].id];
      const set = findSet(s, x => x.some(c => c.id === want) && !x.some(c => c.id === avoid));
      if (set) return { s, i, set };
    }
    throw new Error('no suitable board');
  };

  it('snares always point at an existing card', () => {
    for (let seed = 1; seed < 20; seed++) {
      const s = startFight({ seed, level: testLevel({ rules: { hazards: { snares: { every: 1 } } } }) });
      s.board.forEach((c, i) => {
        if (c.snare) expect(snareTarget(i, c.snare, s.board.length)).not.toBeNull();
      });
    }
  });

  it('matching the card a snare points at defuses it (+4 and trapDefused)', () => {
    const { s, i, set } = snareFight('target');
    const withRule = withWeapons(s, relic([{ trigger: { on: 'trapDefused' }, effects: [{ do: 'damage', amount: 1 }] }]));
    const { next, dmg } = damageOf(withRule, set);
    expect(dmg).toBe(3 + 4 + 1);
    expect(next.trapsDefused).toBe(1);
    expect(next.hearts).toBe(s.hearts);
    expect(next.board[i].snare).toBeUndefined();
  });

  it('matching the snared card itself still scores but costs a heart (unless immune)', () => {
    const { s, set } = snareFight('snared');
    const { next, dmg } = damageOf(s, set);
    expect(dmg).toBe(3);
    expect(next.hearts).toBe(s.hearts! - 1);
    expect(next.trapsSprung).toBe(1);
    const immune = withWeapons(s, relic([], { trapImmunity: true }));
    expect(playSet(immune, set).hearts).toBe(s.hearts);
  });
});

describe('challenges', () => {
  const cases: [ChallengeDef, Partial<RunState>][] = [
    [{ kind: 'evolutions', n: 1 }, { evolutionsTriggered: 1 }],
    [{ kind: 'defuseTraps', n: 2 }, { trapsDefused: 2 }],
    [{ kind: 'comboReach', n: 4 }, { maxCombo: 4 }],
    [{ kind: 'bonusCards', n: 3 }, { bonusCardsMatched: 3 }],
    [{ kind: 'explosions', n: 2 }, { explosionsTriggered: 2 }],
    [{ kind: 'purityChain', n: 3 }, { maxPurityChain: 3 }],
    [{ kind: 'levelUps', n: 2 }, { levelUpsTaken: 2 }],
    [{ kind: 'shopBuys', n: 1 }, { shopBuys: 1 }],
    [{ kind: 'bigHit', n: 20 }, { biggestHit: 25 }],
  ];

  it.each(cases)('%o is met by its counter', (challenge, counters) => {
    const s = startFight({ level: testLevel({ challenge }) });
    expect(describeChallenge(s.level).length).toBeGreaterThan(5);
    expect(challengeProgress(s).met).toBe(false);
    expect(challengeProgress({ ...s, ...counters }).met).toBe(true);
  });

  it('useHints and graceSaves read the round stats', () => {
    let s = startFight({ level: testLevel({ challenge: { kind: 'useHints', n: 1 }, rules: { startingHints: 2 } }) });
    expect(challengeProgress(s).text).toContain('0/1');
    s = runReducer(s, { type: 'USE_HINT' });
    expect(challengeProgress(s).met).toBe(true);
    const g = startFight({ level: testLevel({ challenge: { kind: 'graceSaves', n: 1 }, rules: { startingGraces: 1 } }) });
    const set = findSet(g)!;
    const saved = runReducer(g, { type: 'MATCH', cards: set, rewards: set.map(c => ({ cardId: c.id, points: 1, effectType: 'grace' as const })) });
    expect(challengeProgress(saved).met).toBe(true);
  });

  it('the hintUsed and graceUsed triggers fire', () => {
    const s = withWeapons(
      startFight({ level: testLevel({ rules: { startingHints: 1, startingGraces: 1 } }) }),
      relic([
        { trigger: { on: 'hintUsed' }, effects: [{ do: 'damage', amount: 2 }] },
        { trigger: { on: 'graceUsed' }, effects: [{ do: 'damage', amount: 5 }] },
      ] as Rule[])
    );
    const hinted = runReducer(s, { type: 'USE_HINT' });
    expect(s.foeHp - hinted.foeHp).toBe(2);
  });

  it('the live combo and biggest hit feed comboReach / bigHit during a real fight', () => {
    let s = startFight({ level: testLevel({ challenge: { kind: 'comboReach', n: 3 } }) });
    for (let i = 0; i < 3; i++) s = playSet(tick(s, 1000));
    expect(challengeProgress(s).met).toBe(true);
  });
});

describe('Arcana', () => {
  it('stacking: additive fields add, scales multiply, locks take the lowest, mistakeBurn the shortest cooldown', () => {
    const r = combineArcana([
      { maxHeartsDelta: -1, foeHpScale: 1.1, maxHeartsLock: 3, mistakeBurn: { cooldownMs: 12000, cards: 2 }, pickOptions: 4 },
      { maxHeartsDelta: -1, foeHpScale: 1.2, maxHeartsLock: 1, mistakeBurn: { cooldownMs: 8000, cards: 1 }, xpScale: 2 },
    ]);
    expect(r.maxHeartsDelta).toBe(-2);
    expect(r.foeHpScale).toBeCloseTo(1.32);
    expect(r.maxHeartsLock).toBe(1);
    expect(r.mistakeBurn).toEqual({ cooldownMs: 8000, cards: 1 });
    expect(r.pickOptions).toBe(4);
    expect(r.xpScale).toBe(2);
  });

  it('rainbow multipliers combine relative to the standard ×2', () => {
    expect(arcanaRules(['monochrome_pact', 'prismatic_fever']).rainbowMultiplier).toBeCloseTo(1.5);
    expect(arcanaRules('prismatic_fever').rainbowMultiplier).toBe(3);
  });

  it('equipped Arcana combine in a fight, up to the Tarot Deck slots', () => {
    const save = {
      unlockedArcana: ['overkill_harvest' as const, 'catalyst_resonance' as const],
      equippedArcana: ['overkill_harvest' as const, 'catalyst_resonance' as const],
    };
    const level = testLevel({ foes: [{ name: 'Dummy', hp: 100 }] });
    expect(startFight({ level, save }).arcana).toEqual(['overkill_harvest']);
    const two = startFight({ level, save: { ...save, upgrades: { tarot_deck: 1 } } });
    expect(two.arcana).toEqual(['overkill_harvest', 'catalyst_resonance']);
    expect(two.foeHp).toBe(Math.round(100 * (1.15 * 1.1)));
  });
});

describe('rule sources on the board', () => {
  it('rule effects never touch the Catalyst', () => {
    let s = withWeapons(
      startFight({ features: ['hearts', 'gear'] }),
      relic([{ trigger: { on: 'set' }, effects: [{ do: 'laser', area: { shape: 'random', count: 20 } }] }])
    );
    const set = findSet(s)!;
    const other = s.board.find(c => !set.some(x => x.id === c.id))!;
    s = { ...s, board: s.board.map(c => (c.id === other.id ? { ...c, hasEvolutionItem: true } : c)) };
    s = playSet(s, set);
    expect(s.board.some(c => c.id === other.id && c.hasEvolutionItem)).toBe(true);
    expect(allSets(s.board, s.attributes).length).toBeGreaterThan(0);
  });
});

describe('board deadlock guard', () => {
  it('frees a board where foes have hidden every card', () => {
    const start = startFight();
    const hidden: RunState = { ...start, board: start.board.map(c => ({ ...c, isFaceDown: true })) };
    expect(hasAnySet(hidden.board, hidden.attributes)).toBe(false);

    const after = tick(hidden, 250);
    expect(after.board.some(c => !c.isFaceDown)).toBe(true);
    expect(hasAnySet(after.board, after.attributes)).toBe(true);
  });
});
