/**
 * The rule interpreter, per-weapon timed evolutions, traps, challenges, Arcana stacking,
 * and unified add-then-multiply combat math.
 */
import { baseCardReward, computeStars, createRun, isSacrificeUnlocked, runReducer, SACRIFICE_BASE_DAMAGE, SACRIFICE_COOLDOWN_MS } from '@/adventure/engine/run';
import { countDifferentAttributes, hasAnySet, isRainbow } from '@/adventure/engine/sets';
import {
  COLLATERAL_SYNERGY_DAMAGE_CAP,
  MAX_CHAIN_OCCURRENCES,
  MAX_FIRINGS_PER_ACTION,
  SET_SYNERGY_DAMAGE_CAP,
} from '@/adventure/rules/engine';
import { arcanaRules, combineArcana } from '@/adventure/data/arcana';
import { BASE_RULES } from '@/adventure/data/rules';
import { challengeProgress, describeChallenge } from '@/adventure/engine/challenges';
import { SNARE_DEFUSE_DAMAGE, snareTarget } from '@/adventure/engine/fight';
import { BOMB_DEFUSE_BASE_DAMAGE, BOMB_DEFUSE_CLUTCH_DAMAGE, BOMB_DEFUSE_HOT_DAMAGE } from '@/adventure/engine/hazards';
import { EVOLUTION_CHASSIS } from '@/adventure/engine/sources';
import { ACTIVE_TREE_CAP, ACTIVE_TREE_CAP_RATIO, exclusiveConflictFor, SKILL_NODES, skillTreeOf, TREE_BUDGET } from '@/adventure/data/skillTrees';
import { getWeaponEvolution } from '@/adventure/data/evolutions';
import { FIGHTERS } from '@/adventure/data/fighters';
import { getLevel } from '@/adventure/data/levels';
import { createNewSave } from '@/adventure/progress';
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
  // Pelican: no passive touches Set damage; elevated base Set = 6 dmg (3 cards × 2)
  const base = () => startFight({ save: { selectedFighter: 'Pelican' }, features: ['hearts', 'gear'] });

  it('a trigger fires its effects (and shows its callout)', () => {
    const s = withWeapons(base(), relic([{ trigger: { on: 'set' }, effects: [{ do: 'damage', amount: 5 }], callout: 'Zap!' }]));
    const { next, dmg } = damageOf(s);
    expect(dmg).toBe(6 + 5);
    expect(eventsOf(next, 'rule').map(e => e.text)).toEqual(['Zap!']);
    expect(next.biggestHit).toBe(11);
  });

  it('weapon effects chain into weapon triggers', () => {
    const s = withWeapons(
      hurtBy(base(), 2),
      relic([{ trigger: { on: 'set' }, effects: [{ do: 'heal', amount: 1 }] }]),
      relic([{ trigger: { on: 'weapon', kind: 'heal' }, effects: [{ do: 'damage', amount: 7 }] }], undefined, 'relic-b'),
      relic([{ trigger: { on: 'healed' }, effects: [{ do: 'coins', amount: 1 }] }], undefined, 'relic-c')
    );
    const { next, dmg } = damageOf(s);
    expect(dmg).toBe(6 + 7);
    expect(next.hearts).toBe(s.hearts! + 1);
  });

  it(`a rule chain is bounded to ${MAX_CHAIN_OCCURRENCES} occurrences per key (allows 1 bounce, never loops infinitely)`, () => {
    const s = withWeapons(
      hurtBy(base(), 4),
      relic([
        { trigger: { on: 'set' }, effects: [{ do: 'heal', amount: 1 }] },
        { trigger: { on: 'weapon', kind: 'heal' }, effects: [{ do: 'heal', amount: 1 }] },
      ])
    );
    const next = playSet(s);
    expect(next.hearts).toBe(s.hearts! + 1 + MAX_CHAIN_OCCURRENCES);
  });

  it(`one action resolves at most ${MAX_FIRINGS_PER_ACTION} rule firings`, () => {
    const many = Array.from({ length: 50 }, (_, i) => relic([{ trigger: { on: 'set' }, effects: [{ do: 'damage', amount: 1 }] }], undefined, `r${i}`));
    const { dmg } = damageOf(withWeapons(base(), ...many));
    expect(dmg).toBe(6 + MAX_FIRINGS_PER_ACTION);
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
    expect(r.dmg).toBe(6 + 2);
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
    // 6 matched cards + 2 collateral blast + 5 weapon:explosion rule = 13
    expect(s.foeHp - once.foeHp).toBe(6 + 2 + 5);
    expect(once.explosionsTriggered).toBe(1);
    const twice = blastWith({ ...s, doubleNext: 1 });
    expect(eventsOf(twice, 'doubled')).toHaveLength(1);
    const blasts = eventsOf(twice, 'blast');
    expect(blasts).toHaveLength(2);
    expect(blasts[0].amount).toBeUndefined();
    expect(blasts[0].slots).toHaveLength(1);
    expect(blasts[1].amount).toBeGreaterThanOrEqual(2);
    expect(s.foeHp - twice.foeHp).toBeGreaterThanOrEqual(6 + 2 + 5 + 5 + 2);
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
    expect(dmgs).toEqual([6 + 50, 6, 6 + 10, 6 + 100]);
  });

  it('idle rules fire once per quiet stretch; foeBelow fires once per foe', () => {
    let s = withWeapons(
      startFight({ level: testLevel({ foes: [{ name: 'Dummy', hp: 40 }] }), save: { selectedFighter: 'Corgi' }, features: ['hearts', 'gear'] }),
      relic([{ trigger: { on: 'idle', ms: 3000 }, effects: [{ do: 'damage', amount: 1 }] }]),
      relic([{ trigger: { on: 'foeBelow', fraction: 0.5 }, effects: [{ do: 'damage', amount: 2 }] }], undefined, 'b')
    );
    s = tick(s, 10000, 1000);
    expect(s.foeHp).toBe(39);
    s = playSet(s); // 39 -> 33
    s = tick(s, 3000, 1000); // 33 -> 32
    expect(s.foeHp).toBe(32);
    s = playSet(playSet(s)); // 32 -> 26 -> 20 (still not < 20)
    expect(s.foeHp).toBe(20);
    s = playSet(s); // 20 -> 14 (< 20: foeBelow +2 -> 12)
    expect(s.foeHp).toBe(12);
    s = playSet(s); // 12 -> 6 (foeBelow already fired once)
    expect(s.foeHp).toBe(6);
  });

  it('conditions gate rules; chance 0 never fires', () => {
    const s = withWeapons(
      base(),
      relic([{ trigger: { on: 'set' }, when: [{ kind: 'chance', pct: 0 }], effects: [{ do: 'damage', amount: 50 }] }]),
      relic([{ trigger: { on: 'set' }, when: [{ kind: 'heartsFull' }], effects: [{ do: 'damage', amount: 5 }] }], undefined, 'b'),
      relic([{ trigger: { on: 'set' }, when: [{ kind: 'noMistakesThisFight' }], effects: [{ do: 'damage', amount: 7 }] }], undefined, 'c')
    );
    expect(damageOf(s).dmg).toBe(6 + 5 + 7);
    expect(damageOf(miss(s)).dmg).toBe(6);
  });

  it('time-since-last-Set conditions on a set trigger measure from the previous Set', () => {
    const s = withWeapons(
      base(),
      relic([{ trigger: { on: 'set' }, when: [{ kind: 'timeSinceLastSetAtLeast', ms: 4000 }], effects: [{ do: 'damage', amount: 10 }] }]),
      relic([{ trigger: { on: 'set' }, when: [{ kind: 'timeSinceLastSetAtMost', ms: 2000 }], effects: [{ do: 'damage', amount: 1 }] }], undefined, 'b')
    );
    const first = damageOf(tick(s, 5000, 1000));
    expect(first.dmg).toBe(6 + 10);
    expect(damageOf(tick(first.next, 1000, 1000)).dmg).toBe(6 + 1);
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
    s = runReducer(s, { type: 'MATCH', cards: set, rewards: set.map(baseCardReward) });
    expect(s.bonusCardsMatched).toBe(0);
    expect(eventsOf(s, 'hit').some(e => e.text === 'Bonus')).toBe(false);
    // 3 cards × (2 base + 2 charge) = 12
    expect(before - s.foeHp).toBe(3 * 4);
  });

  it('modifiers: flat and conditional Set damage', () => {
    const s = withWeapons(base(), relic([], { setDamage: 2, conditionalDamage: [{ when: [{ kind: 'heartsAtMost', n: 3 }], amount: 4 }] }));
    expect(damageOf(s).dmg).toBe(6 + 2);
    expect(damageOf(hurtBy(s, 2)).dmg).toBe(6 + 2 + 4);
  });

  it('area effects use the 3-column grid, skip the Set being scored, and armored cards lose a hit', () => {
    let s = withWeapons(base(), relic([{ trigger: { on: 'set' }, effects: [{ do: 'explode', area: { shape: 'block', cols: 3, rows: 2 } }] }]));
    s = { ...s, board: s.board.map((c, i) => (i === 0 ? { ...c, health: 3 } : c)) };
    const set = findSet(s, x => !x.some(c => c.id === s.board[0].id))!;
    const before = s.board;
    const next = runReducer(s, { type: 'MATCH', cards: set, rewards: set.map(c => ({ cardId: c.id, points: 2 })) });
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

  it('armorCard makes a piñata; breaking it folds its bounty into the Set before multipliers and fires cardBroken', () => {
    let s = withWeapons(
      base(),
      relic([{ trigger: { on: 'mistake' }, effects: [{ do: 'armorCard', extraHealth: 1, bounty: 10 }] }]),
      relic([{ trigger: { on: 'cardBroken' }, effects: [{ do: 'damage', amount: 1 }] }], undefined, 'b')
    );
    s = miss(s);
    const pinata = s.board.find(c => c.bounty === 10)!;
    expect(pinata.health).toBe(2);
    expect(eventsOf(s, 'pinata')).toHaveLength(1);
    let breakHit = 0;
    let breakEntry = s.log[s.log.length - 1];
    for (let i = 0; i < 40 && s.board.some(c => c.id === pinata.id); i++) {
      const set = findSet(s, x => x.some(c => c.id === pinata.id)) ?? findSet(s);
      const hpBefore = s.foeHp;
      s = playSet(s, set);
      if (!s.board.some(c => c.id === pinata.id)) {
        breakHit = hpBefore - s.foeHp;
        breakEntry = s.log[s.log.length - 1];
      }
    }
    expect(s.board.some(c => c.id === pinata.id)).toBe(false);
    // Bounty (+10) folded into the breaking Set's flat damage (6 + 10) + cardBroken bonus (+1) = 17
    expect(breakHit).toBe(6 + 10 + 1);
    expect(breakEntry.set?.flatItems).toContainEqual(
      expect.objectContaining({ label: 'Piñata', amount: 10, sourceRef: 'weapon:pinata' })
    );
    expect(eventsOf(s, 'pinata_break').length).toBeGreaterThanOrEqual(1);
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

  it('next-Set multipliers add up and cap at ×2.5; growBoard at MAX_BOARD overflows into empowerBoard and still fires weapon:growth', () => {
    const times = relic([{ trigger: { on: 'mistake' }, effects: [{ do: 'nextSetMultiplier', times: 1.5 }] }]);
    let s = withWeapons(base(), times);
    s = miss(miss(s));
    expect(s.nextSetMultiplier).toBe(2);
    for (let i = 0; i < 10; i++) s = miss({ ...s, hearts: 5 });
    expect(s.nextSetMultiplier).toBe(BASE_RULES.maxNextSetMultiplier);

    const grow = withWeapons(
      base(),
      relic([{ trigger: { on: 'set' }, effects: [{ do: 'growBoard', count: 30 }] }]),
      relic([{ trigger: { on: 'weapon', kind: 'growth' }, effects: [{ do: 'damage', amount: 1 }] }], undefined, 'b')
    );
    const grown = playSet(grow);
    expect(grown.board.length).toBe(21);
    const full = playSet(grown);
    expect(full.board.length).toBe(21);
    expect(eventsOf(grown, 'hit').filter(e => e.text === 'Bonus')).toHaveLength(1);
    expect(eventsOf(full, 'hit').filter(e => e.text === 'Bonus')).toHaveLength(2);
    expect(eventsOf(full, 'empowered').length).toBeGreaterThanOrEqual(1);
    expect(full.board.some(c => (c.charge ?? 0) >= 1)).toBe(true);
  });

  it('nextSetMultiplier and comboStep feed the next Set', () => {
    const s = withWeapons(
      startFight({ save: { selectedFighter: 'Sly Fox' }, features: ['hearts', 'gear'] }),
      relic([{ trigger: { on: 'mistake' }, effects: [{ do: 'nextSetMultiplier', times: 2 }, { do: 'comboStep', amount: 2 }] }])
    );
    const after = miss(s);
    expect(after.nextSetMultiplier).toBe(2);
    expect(after.combo).toBe(3); // chain of 1 + 2 steps
    const { next, dmg } = damageOf(after);
    // Set extends chain to 4 (= 3 steps × +2 per step = +6), so (6 base + 6 combo) × 2 = 24
    expect(dmg).toBe((6 + 6) * 2);
    expect(next.nextSetMultiplier).toBe(1);
  });
});

describe('per-weapon timed evolutions in combat', () => {
  const evoA = getWeaponEvolution('blast-powder:cluster-charge')!;
  const evoB = getWeaponEvolution('flint-spark:cinder-trail')!;
  const armedSave = {
    selectedFighter: 'Pelican' as const,
    armory: ['blast-powder', 'flint-spark'],
    charms: ['blast-powder', 'flint-spark'],
    unlockedWeaponEvolutions: [evoA.id, evoB.id],
    equippedEvolutions: { 'blast-powder': evoA.id, 'flint-spark': evoB.id },
  };

  it('arms one evolution tracker per equipped weapon with an unlocked evolution and extends duration via Evolution Lab', () => {
    const s = startFight({ save: armedSave, features: ['hearts', 'gear', 'evolutions'] });
    expect(s.weaponEvolutions.map(t => t.evoId)).toEqual([evoA.id, evoB.id]);
    expect(startFight({ save: { ...armedSave, unlockedWeaponEvolutions: [], equippedEvolutions: {} } }).weaponEvolutions).toEqual([]);

    const withLab = runReducer(
      startFight({ save: { ...armedSave, upgrades: { evolution_lab: 3 } }, features: ['hearts', 'gear', 'evolutions'] }),
      { type: 'DEV_TRIGGER_EVO', weaponId: 'blast-powder' }
    );
    expect(withLab.weaponEvolutions[0].durationMs).toBe(evoA.durationMs + 3 * EVOLUTION_CHASSIS.labDurationMsPerTier);
  });

  it('does not fire post-mortem evolution ignition after the final foe is already defeated by the Set', () => {
    // Blast Powder Napalm Payload needs 3 Red Sets -> prime to 2/3, then finish a 5 HP foe with a Red Set
    const napalm = getWeaponEvolution('blast-powder:napalm-payload')!;
    let s = startFight({
      save: {
        selectedFighter: 'Pelican',
        armory: ['blast-powder'],
        charms: ['blast-powder'],
        unlockedWeaponEvolutions: [napalm.id],
        equippedEvolutions: { 'blast-powder': napalm.id },
      },
      level: testLevel({ foes: [{ name: 'Frail Imp', icon: 'lorc/imp', hp: 5 }] }),
      features: ['hearts', 'gear', 'evolutions'],
    });
    s = runReducer(s, { type: 'DEV_ADVANCE_EVO', weaponId: 'blast-powder', amount: 2 });
    const board = [...s.board];
    board[0] = { ...board[0], id: 'pm0', shape: 'oval', color: 'red', number: 1, shading: 'solid' };
    board[1] = { ...board[1], id: 'pm1', shape: 'diamond', color: 'red', number: 2, shading: 'solid' };
    board[2] = { ...board[2], id: 'pm2', shape: 'squiggle', color: 'red', number: 3, shading: 'solid' };
    s = playSet({ ...s, board }, [board[0], board[1], board[2]]);
    expect(s.status).toBe('won');
    expect(s.foeHp).toBe(0);
    expect(s.evolutionsTriggered).toBe(0);
    expect(eventsOf(s, 'evolution_start')).toEqual([]);
  });

  it('still ignites a per-weapon evolution on a lethal Wave 1 Set when Wave 2 follows', () => {
    const napalm = getWeaponEvolution('blast-powder:napalm-payload')!;
    let s = startFight({
      save: {
        selectedFighter: 'Pelican',
        armory: ['blast-powder'],
        charms: ['blast-powder'],
        unlockedWeaponEvolutions: [napalm.id],
        equippedEvolutions: { 'blast-powder': napalm.id },
      },
      level: testLevel({
        foes: [
          { name: 'Wave 1 Imp', icon: 'lorc/imp', hp: 5 },
          { name: 'Wave 2 Boss', icon: 'lorc/imp', hp: 200 },
        ],
      }),
      features: ['hearts', 'gear', 'evolutions'],
    });
    s = runReducer(s, { type: 'DEV_ADVANCE_EVO', weaponId: 'blast-powder', amount: 2 });
    const board = [...s.board];
    board[0] = { ...board[0], id: 'w1_0', shape: 'oval', color: 'red', number: 1, shading: 'solid' };
    board[1] = { ...board[1], id: 'w1_1', shape: 'diamond', color: 'red', number: 2, shading: 'solid' };
    board[2] = { ...board[2], id: 'w1_2', shape: 'squiggle', color: 'red', number: 3, shading: 'solid' };
    s = playSet({ ...s, board }, [board[0], board[1], board[2]]);
    expect(s.status).toBe('intermission');
    expect(s.evolutionsTriggered).toBe(1);
    expect(s.weaponEvolutions[0].phase).toBe('active');
    expect(eventsOf(s, 'evolution_start')).toHaveLength(1);
  });
});

describe('traps', () => {
  it('time bombs: one at the start, fuse in seconds, a heart and a fresh card when it goes off', () => {
    let s = startFight({
      level: testLevel({ rules: { hazards: { timeBombs: { every: 3, seconds: 5 } } } }),
      save: { selectedFighter: 'Corgi' },
      features: ['hearts', 'gear'],
    });
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

  const snareFight = (pick: 'target' | 'snared') => {
    for (let seed = 1; seed < 200; seed++) {
      const fight = startFight({ seed, level: testLevel({ rules: { hazards: { snares: { every: 999 } } } }), features: ['hearts', 'gear'] });
      const s = { ...fight, passives: [], waveShieldLeft: 0 };
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

  it('matching the card a snare points at defuses it (+8 and trapDefused)', () => {
    const { s, i, set } = snareFight('target');
    const withRule = withWeapons(s, relic([{ trigger: { on: 'trapDefused' }, effects: [{ do: 'damage', amount: 1 }] }]));
    const { next, dmg } = damageOf(withRule, set);
    expect(dmg).toBe(6 + SNARE_DEFUSE_DAMAGE + 1);
    expect(next.trapsDefused).toBe(1);
    expect(next.hearts).toBe(s.hearts);
    expect(next.board[i].snare).toBeUndefined();
  });

  it('matching the snared card itself still scores but costs a heart (unless immune)', () => {
    const { s, set } = snareFight('snared');
    const { next, dmg } = damageOf(s, set);
    expect(dmg).toBe(6);
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
    const saved = runReducer(g, { type: 'MATCH', cards: set, rewards: set.map(c => ({ cardId: c.id, points: 2, effectType: 'grace' as const })) });
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

  it('rainbow multipliers combine cleanly relative to BASE_RULES.rainbowMultiplier (1.0)', () => {
    expect(arcanaRules('prismatic_fever').rainbowMultiplier).toBe(1.5);
    expect(arcanaRules(['monochrome_pact', 'prismatic_fever']).rainbowMultiplier).toBeCloseTo(0.65 * 1.5);
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
    expect(two.foeHp).toBe(100);
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

describe('unified add-then-multiply damage math', () => {
  const base = () =>
    startFight({
      save: { selectedFighter: 'Pelican' },
      level: testLevel({ foes: [{ name: 'Dummy', hp: 500 }] }),
      features: ['hearts', 'gear'],
    });

  it('multiplies a primed Piñata (+8) by a ×2 Set multiplier without double-dealing on REPLACE', () => {
    let s = base();
    const set = findSet(s)!;
    const targetId = set[0].id;
    s = {
      ...s,
      nextSetMultiplier: 2,
      board: s.board.map(c => (c.id === targetId ? { ...c, health: 1, bounty: 8 } : c)),
    };
    const hpBefore = s.foeHp;
    const after = playSet(s, set);
    // (6 base + 8 Piñata) * 2 = 28
    expect(hpBefore - after.foeHp).toBe((6 + 8) * 2);
    expect(after.board.some(c => c.id === targetId)).toBe(false);
    expect(eventsOf(after, 'pinata_break')).toHaveLength(1);
    expect(after.log[after.log.length - 1].set?.flatItems).toContainEqual(
      expect.objectContaining({ label: 'Piñata', amount: 8, sourceRef: 'weapon:pinata' })
    );
  });

  it('folds elevated Purity Chain (+7 at chain 3) and Snare Defused (+8) into flat BEFORE multiplying', () => {
    let s = startFight({
      save: { selectedFighter: 'Pelican' },
      level: testLevel({
        rules: { attributes: ['shape', 'color', 'number'], boardSize: 12 },
        foes: [{ name: 'Dummy', hp: 500 }],
      }),
      features: ['hearts', 'gear', 'purity'],
    });
    const set = findSet(s, cards => countDifferentAttributes(cards, s.attributes) >= 2)!;
    const diff = countDifferentAttributes(set, s.attributes);
    const targetSlot = s.board.findIndex(c => c.id === set[0].id);
    const snareSlot = s.board.findIndex((_, i) => snareTarget(i, 'right', s.board.length) === targetSlot || snareTarget(i, 'left', s.board.length) === targetSlot || snareTarget(i, 'up', s.board.length) === targetSlot || snareTarget(i, 'down', s.board.length) === targetSlot);
    const snareDir = (['right', 'left', 'up', 'down'] as const).find(dir => snareTarget(snareSlot, dir, s.board.length) === targetSlot)!;
    s = {
      ...s,
      nextSetMultiplier: 2,
      purityChain: 2,
      lastDiffCount: diff - 1,
      board: s.board.map((c, i) => (i === snareSlot ? { ...c, snare: snareDir } : c)),
    };
    const hpBefore = s.foeHp;
    const after = playSet(s, set);
    // purity chain 3 (+7) + snare defuse (+8) + base (6) = 21, then ×2 = 42
    expect(hpBefore - after.foeHp).toBe((6 + 7 + SNARE_DEFUSE_DAMAGE) * 2);
    const flatItems = after.log[after.log.length - 1].set?.flatItems ?? [];
    expect(flatItems).toContainEqual(expect.objectContaining({ label: 'Purity chain', amount: 7 }));
    expect(flatItems).toContainEqual(expect.objectContaining({ label: 'Snare Defused', amount: SNARE_DEFUSE_DAMAGE }));
  });

  it('multiplies synchronous drain() rule hits by the Set multiplier, and resets to ×1 on non-Set actions', () => {
    const s = withWeapons(
      { ...base(), nextSetMultiplier: 2 },
      relic([
        { trigger: { on: 'set' }, effects: [{ do: 'damage', amount: 6 }] },
        { trigger: { on: 'mistake' }, effects: [{ do: 'damage', amount: 5 }] },
      ])
    );
    const hpBefore = s.foeHp;
    const afterSet = playSet(s);
    // Set (6 * 2 = 12) + synchronous drain rule (6 * 2 = 12) = 24
    expect(hpBefore - afterSet.foeHp).toBe(6 * 2 + 6 * 2);
    const hpAfterSet = afterSet.foeHp;
    const afterMiss = miss(afterSet);
    expect(hpAfterSet - afterMiss.foeHp).toBe(5);
  });

  it('BURN pays primed Piñata bounty and applies burnMult stamped when ignited during a multiplied Set', () => {
    let s = withWeapons(
      { ...base(), nextSetMultiplier: 2 },
      relic([{ trigger: { on: 'set' }, effects: [{ do: 'ignite', count: 1 }] }])
    );
    const set = findSet(s)!;
    s = playSet(s, set);
    const burning = s.board.find(c => c.onFire)!;
    expect(burning).toBeDefined();
    expect(s.burnMults?.[burning.id]).toBe(2);
    const primedCard = { ...burning, health: 1, bounty: 8 };
    s = {
      ...s,
      board: s.board.map(c => (c.id === burning.id ? primedCard : c)),
    };
    const hpBefore = s.foeHp;
    const afterBurn = runReducer(s, { type: 'BURN', card: primedCard });
    // (2 base burn + 8 Piñata bounty) * 2 burnMult = 20
    expect(hpBefore - afterBurn.foeHp).toBe((BASE_RULES.cardBasePoints + 8) * 2);
    expect(eventsOf(afterBurn, 'pinata_break')).toHaveLength(1);
    expect(afterBurn.burnMults?.[burning.id]).toBeUndefined();
  });
});

describe('core engine bug fixes', () => {
  const base = () =>
    startFight({
      save: { selectedFighter: 'Pelican' },
      level: testLevel({ foes: [{ name: 'Dummy', hp: 500 }] }),
      features: ['hearts', 'gear', 'hints'],
    });

  it('blocks USE_HINT spam until a valid Set is matched (Safe Bet exploit guard)', () => {
    let s = withWeapons(
      { ...base(), stats: { ...base().stats, hints: 3 } },
      relic([{ trigger: { on: 'hintUsed' }, effects: [{ do: 'damage', amount: 4 }] }])
    );
    const hp0 = s.foeHp;
    s = runReducer(s, { type: 'USE_HINT' });
    expect(hp0 - s.foeHp).toBe(4);
    expect(s.stats.hints).toBe(2);
    expect(s.hintUsedThisSet).toBe(true);

    const blocked = runReducer(s, { type: 'USE_HINT' });
    expect(blocked.foeHp).toBe(s.foeHp);
    expect(blocked.stats.hints).toBe(2);

    const afterMiss = miss(blocked);
    const blockedAfterMiss = runReducer(afterMiss, { type: 'USE_HINT' });
    expect(blockedAfterMiss.stats.hints).toBe(2);

    const afterMatch = playSet(afterMiss);
    expect(afterMatch.hintUsedThisSet).toBe(false);
    const allowedAgain = runReducer(afterMatch, { type: 'USE_HINT' });
    expect(allowedAgain.stats.hints).toBe(1);
    expect(afterMatch.foeHp - allowedAgain.foeHp).toBe(4);
  });

  it('emits healed even when healing at full hearts (clean play)', () => {
    const s = withWeapons(
      base(),
      relic([
        { trigger: { on: 'set' }, effects: [{ do: 'heal', amount: 1 }] },
        { trigger: { on: 'healed' }, effects: [{ do: 'damage', amount: 6 }] },
      ])
    );
    expect(s.hearts).toBe(s.maxHearts);
    const { dmg } = damageOf(s);
    expect(dmg).toBe(6 + 6);
  });

  it('Life Link hurt-blast enqueues weapon:explosion', () => {
    const lifeLink = {
      ...relic([], undefined, 'life-link-test'),
      specialEffect: 'bridge' as const,
      bridgeEffect: { trigger: 'onHealthLoss' as const, chance: 100, effect: 'explosion' as const, amount: 4 },
    };
    const s = withWeapons(
      base(),
      lifeLink,
      relic([{ trigger: { on: 'weapon', kind: 'explosion' }, effects: [{ do: 'damage', amount: 9 }] }], undefined, 'listener')
    );
    const hpBefore = s.foeHp;
    const after = miss(s);
    expect(eventsOf(after, 'blast').length).toBeGreaterThanOrEqual(1);
    expect(hpBefore - after.foeHp).toBeGreaterThanOrEqual(4 + 9);
  });

  it('Clarity Lens preserves Rainbow detection on non-simplified traits and rolls doubleClarityChance on extension', () => {
    const c1: Card = { id: 'a', shape: 'oval', color: 'red', number: 1, shading: 'solid', selected: false };
    const c2: Card = { id: 'b', shape: 'diamond', color: 'green', number: 1, shading: 'solid', selected: false };
    const c3: Card = { id: 'c', shape: 'squiggle', color: 'purple', number: 1, shading: 'solid', selected: false };
    expect(isRainbow([c1, c2, c3], ['shape', 'color', 'number'])).toBe(false);
    expect(isRainbow([c1, c2, c3], ['shape', 'color', 'number'], ['number'])).toBe(true);

    const w1: Card = { ...c1, id: 'w1', isWild: true };
    const w2: Card = { ...c2, id: 'w2', isWild: true };
    expect(countDifferentAttributes([w1, w2, c3], ['shape', 'color', 'number'])).toBe(3);
    expect(isRainbow([w1, w2, c3], ['shape', 'color', 'number'])).toBe(true);

    let s = withWeapons(
      base(),
      relic([{ trigger: { on: 'set' }, effects: [{ do: 'simplify', ms: 6000 }] }], { doubleClarityChance: 100 })
    );
    s = playSet(s);
    expect(s.simplified?.also).toBeDefined();
    s = { ...s, simplified: { attribute: s.simplified!.attribute, value: s.simplified!.value, remainingMs: 3000 } };
    s = playSet(s);
    expect(s.simplified?.also).toBeDefined();
  });

  it('E.combo grants +1 Set damage per bonus step on non-Sly-Fox fighters without altering plain fast Sets', () => {
    const s = withWeapons(
      base(),
      relic([{ trigger: { on: 'mistake' }, effects: [{ do: 'comboStep', amount: 3 }] }])
    );
    expect(damageOf(s).dmg).toBe(6);
    const afterMiss = miss(s);
    expect(afterMiss.bonusCombo).toBe(3);
    expect(damageOf(afterMiss).dmg).toBe(6 + 3);
  });

  it('autoSet breaks linked partners and fires linkDestroyed', () => {
    let s = withWeapons(
      base(),
      relic([
        { trigger: { on: 'mistake' }, effects: [{ do: 'trigger', kind: 'echo' }] },
        { trigger: { on: 'linkDestroyed' }, effects: [{ do: 'damage', amount: 7 }] },
      ])
    );
    const connections = s.board.slice(0, -1).map((_, i) => ({
      id: `c-${i}`,
      positionA: i,
      positionB: i + 1,
      createdAt: 0,
    }));
    s = { ...s, connections };
    const hpBefore = s.foeHp;
    const after = miss(s);
    expect(hpBefore - after.foeHp).toBeGreaterThanOrEqual(6 + 7);
  });
});

describe('Wave 2 rule verbs & conditions', () => {
  const base = () =>
    startFight({
      save: { selectedFighter: 'Pelican' },
      level: testLevel({ foes: [{ name: 'Dummy', hp: 500 }] }),
      features: ['hearts', 'gear', 'hints'],
    });

  it('evaluates diffCountAtMost, diffCountAtLeast, and hintedSet conditions', () => {
    let s = withWeapons(
      base(),
      relic([
        { trigger: { on: 'set' }, when: [{ kind: 'diffCountAtLeast', n: 1 }], effects: [{ do: 'damage', amount: 4 }] },
        { trigger: { on: 'set' }, when: [{ kind: 'diffCountAtMost', n: 3 }], effects: [{ do: 'damage', amount: 3 }] },
        { trigger: { on: 'set' }, when: [{ kind: 'hintedSet' }], effects: [{ do: 'damage', amount: 10 }] },
      ])
    );
    const set = findSet(s)!;
    expect(damageOf(s, set).dmg).toBe(6 + 4 + 3);
    const hpBefore = s.foeHp;
    const hintedRun = runReducer(s, { type: 'MATCH', cards: set, rewards: set.map(c => ({ cardId: c.id, points: 2 })), hinted: true });
    expect(hpBefore - hintedRun.foeHp).toBe(6 + 4 + 3 + 10);
  });

  it('executes repairGlass, feedChest, advanceTricks, stampAlbum, addMagnet, chargeEvolution, and scaled xp', () => {
    let s = withWeapons(
      base(),
      relic(
        [
          {
            trigger: { on: 'mistake' },
            effects: [
              { do: 'repairGlass' },
              { do: 'feedChest', amount: 7 },
              { do: 'addMagnet', count: 1 },
              { do: 'stampAlbum' },
              { do: 'advanceTricks', ms: 3000 },
            ],
          },
        ],
        {
          glassDamage: 10,
          chestStart: 10,
          chestGrowth: 2,
          magnetDamage: 4,
          albumDamage: 20,
          frozenDamage: 15,
        }
      )
    );
    s = tick(s, 500);
    s = { ...s, gear: { ...s.gear, glassBroken: true } };
    const chestId = s.board.find(c => c.chest !== undefined)!.id;
    const iceBefore = s.board.find(c => (c.frozen ?? 0) > 0)?.frozen;
    const wrong = s.board.filter(c => c.id !== chestId && !(c.frozen ?? 0)).slice(0, 3);
    const afterInvalid = runReducer(s, { type: 'INVALID', cards: wrong });
    const after = runReducer(afterInvalid, { type: 'REPLACE', ids: wrong.map(c => c.id) });
    expect(after.gear.glassBroken).toBe(false);
    expect(after.board.find(c => c.chest !== undefined)?.chest).toBe(10 + 7 + 2);
    expect(after.board.filter(c => c.magnet).length).toBeGreaterThanOrEqual(2);
    expect(after.gear.album.length).toBe(1);
    if (iceBefore !== undefined) {
      expect(after.board.find(c => (c.frozen ?? 0) > 0)?.frozen).toBe(iceBefore - 1);
    }

    // xp with per: 'evolution' & chargeEvolution
    const evoA = getWeaponEvolution('blast-powder:cluster-charge')!;
    const evoB = getWeaponEvolution('flint-spark:cinder-trail')!;
    let s2 = startFight({
      save: {
        selectedFighter: 'Pelican',
        armory: ['blast-powder', 'flint-spark'],
        charms: ['blast-powder', 'flint-spark'],
        unlockedWeaponEvolutions: [evoA.id, evoB.id],
        equippedEvolutions: { 'blast-powder': evoA.id, 'flint-spark': evoB.id },
      },
      features: ['hearts', 'gear', 'xp', 'evolutions'],
    });
    s2 = runReducer(s2, { type: 'DEV_TRIGGER_EVO', weaponId: 'blast-powder' });
    s2 = withWeapons(
      s2,
      relic([
        {
          trigger: { on: 'mistake' },
          effects: [
            { do: 'xp', amount: 5, per: 'evolution' },
            { do: 'chargeEvolution', target: 'all', amount: 1 },
          ],
        },
      ])
    );
    const xpBefore = s2.xp;
    const fsBefore = s2.weaponEvolutions.find(t => t.weaponId === 'flint-spark')!.progress;
    const after2 = miss(s2);
    expect(after2.xp - xpBefore).toBe(5);
    const fsAfter = after2.weaponEvolutions.find(t => t.weaponId === 'flint-spark')!;
    expect(fsAfter.progress > fsBefore || fsAfter.phase === 'active').toBe(true);
  });
});

describe('Wave 2 core engine ([GP-02], [GP-03], [GP-04], [GP-05], [GP-06], [GP-08], [GP-13], Relief)', () => {
  const dummyLevel = (extra?: Parameters<typeof testLevel>[0]) =>
    testLevel({ foes: [{ name: 'Dummy', hp: 500 }], rules: { timer: 120, boardSize: 12, ...extra?.rules }, ...extra });

  it('[GP-03] stacks concurrent per-weapon evolutions ADDITIVELY (+8 flat & +0.20× per active evo, zero global cap)', () => {
    const evoA = getWeaponEvolution('blast-powder:cluster-charge')!;
    const evoB = getWeaponEvolution('flint-spark:cinder-trail')!;
    let s = startFight({
      save: {
        selectedFighter: 'Pelican',
        armory: ['blast-powder', 'flint-spark'],
        charms: ['blast-powder', 'flint-spark'],
        unlockedWeaponEvolutions: [evoA.id, evoB.id],
        equippedEvolutions: { 'blast-powder': evoA.id, 'flint-spark': evoB.id },
      },
      level: dummyLevel(),
      features: ['hearts', 'gear', 'evolutions'],
    });
    s = { ...s, blankEvolutionRules: true };
    s = runReducer(s, { type: 'DEV_TRIGGER_EVO', weaponId: 'blast-powder' });
    s = runReducer(s, { type: 'DEV_TRIGGER_EVO', weaponId: 'flint-spark' });
    const hpBefore = s.foeHp;
    const after = playSet(s);
    // 2 active evos: (6 base + 16 flat) × (1 + 0.40 additive) = 22 × 1.4 = 30.8 → 31
    expect(hpBefore - after.foeHp).toBe(
      Math.round((6 + EVOLUTION_CHASSIS.setFlatDamage * 2) * (1 + EVOLUTION_CHASSIS.setAdditiveMult * 2))
    );
  });

  it('[GP-04] GRACE_SAVE cycles 3 cards with 0 base damage, resets chains, spares hearts, and fires defensive graceUsed rules', () => {
    const s = withWeapons(
      startFight({
        save: { selectedFighter: 'Sly Fox' },
        level: dummyLevel({ rules: { startingGraces: 2, timer: 120, boardSize: 12 } }),
        features: ['hearts', 'gear', 'graces', 'purity'],
      }),
      relic([{ trigger: { on: 'graceUsed' }, effects: [{ do: 'damage', amount: 8 }, { do: 'shield', count: 1 }] }])
    );
    const primed: RunState = {
      ...s,
      combo: 4,
      purityChain: 2,
      lastDiffCount: 2,
      passive: { ...s.passive, hotStreak: true },
    };
    const picked = primed.board.slice(0, 3);
    const heartsBefore = primed.hearts!;
    const hpBefore = primed.foeHp;
    const saved = runReducer(primed, { type: 'GRACE_SAVE', cards: picked });

    expect(saved.hearts).toBe(heartsBefore);
    expect(saved.stats.graces).toBe(1);
    expect(saved.roundStats.gracesUsed).toBe(1);
    expect(saved.combo).toBe(0);
    expect(saved.purityChain).toBe(0);
    expect(saved.passive.hotStreak).toBe(false);
    expect(saved.matches).toBe(0);
    expect(hpBefore - saved.foeHp).toBe(8);
    expect(saved.freeMistakesLeft).toBe(1);
    expect(eventsOf(saved, 'grace')).toHaveLength(1);
    const legacy = runReducer(primed, { type: 'MATCH', cards: picked, graceUsed: true, resolveWeapons: true });
    expect(hpBefore - legacy.foeHp).toBe(8);
    expect(legacy.stats.graces).toBe(1);
  });

  it('[GP-05] SACRIFICE costs 1♥ bypassing shields, deals 18 shockwave, clears clogged cards, respects cooldown & 1♥ guard', () => {
    expect(SACRIFICE_BASE_DAMAGE).toBe(18);
    expect(isSacrificeUnlocked(getLevel('1-1'))).toBe(false);
    expect(isSacrificeUnlocked(getLevel('2-5'))).toBe(false);
    expect(isSacrificeUnlocked(getLevel('2-6'))).toBe(true);
    expect(isSacrificeUnlocked(getLevel('3-1'))).toBe(true);

    let s = withWeapons(
      startFight({
        save: { selectedFighter: 'Badger' },
        level: dummyLevel({ rules: { hearts: 4, startingGraces: 2, timer: 120, boardSize: 12 } }),
        features: ['hearts', 'gear', 'graces'],
      }),
      relic([{ trigger: { on: 'hurt' }, effects: [{ do: 'damage', amount: 5 }] }])
    );
    s = {
      ...s,
      freeMistakesLeft: 2,
      waveShieldLeft: 1,
      board: s.board.map((c, i) =>
        i === 0 ? { ...c, isDud: true } : i === 1 ? { ...c, locked: true } : c
      ),
    };
    const dudId = s.board[0].id;
    const lockedId = s.board[1].id;
    const hpBefore = s.foeHp;

    const after = runReducer(s, { type: 'SACRIFICE', cardIds: [dudId, lockedId] });
    expect(after.hearts).toBe(3);
    expect(after.stats.graces).toBe(2);
    expect(after.freeMistakesLeft).toBe(2);
    expect(after.waveShieldLeft).toBe(1);
    expect(hpBefore - after.foeHp).toBe(SACRIFICE_BASE_DAMAGE + 5);
    expect(after.board.some(c => c.id === dudId)).toBe(false);
    expect(after.board.some(c => c.id === lockedId)).toBe(false);
    expect(hasAnySet(after.board, after.attributes)).toBe(true);
    expect(after.sacrificeCooldownMs).toBe(SACRIFICE_COOLDOWN_MS);

    expect(runReducer(after, { type: 'SACRIFICE', cardIds: [] })).toBe(after);

    const cooled = tick(after, SACRIFICE_COOLDOWN_MS, 1000);
    expect(cooled.sacrificeCooldownMs).toBe(0);
    const oneHeart: RunState = { ...cooled, hearts: 1 };
    expect(runReducer(oneHeart, { type: 'SACRIFICE', cardIds: [] })).toBe(oneHeart);
  });

  it('[GP-06] Badger mistake-farm nodes only detonate on grudgeRelease and setup mistake nodes cap at once per Set', () => {
    const badgerNodes = ['badger-0-2', 'badger-0-4', 'badger-0-8', 'badger-0-10', 'badger-1-10', 'badger-cap-1', 'badger-cap-2'];
    let s = startFight({
      save: {
        selectedFighter: 'Badger',
        skillNodes: { Badger: [...badgerNodes, 'badger-0-7', 'badger-1-2', 'badger-0-9'] },
      },
      level: dummyLevel({ rules: { hearts: 5, startingHints: 0, timer: 120, boardSize: 12 } }),
      features: ['hearts', 'gear', 'coins', 'hints'],
    });
    const hp0 = s.foeHp;

    // 1st mistake: grudgeRelease nodes stay dormant; setup nodes (badger-0-7 hint, badger-1-2 2¢, badger-0-9 +8 & ×1.3) fire ONCE!
    s = miss(s);
    expect(hp0 - s.foeHp).toBe(8);
    expect(s.passive.grudge).toBe(1);
    expect(s.stats.hints).toBe(1);
    expect(s.coins).toBe(2);
    expect(s.nextSetMultiplier).toBeGreaterThan(1);
    const multAfter1 = s.nextSetMultiplier;
    const hpAfter1 = s.foeHp;
    expect(s.mistakeRewardUsedThisSet).toBe(true);

    // 2nd mistake before any valid Set: stores 2nd Grudge, ZERO extra damage/hint/coins/mult (1-per-Set cap!)
    s = miss(s);
    expect(s.foeHp).toBe(hpAfter1);
    expect(s.passive.grudge).toBe(2);
    expect(s.stats.hints).toBe(1);
    expect(s.coins).toBe(2);
    expect(s.nextSetMultiplier).toBe(multAfter1);

    const hpBeforeSet = s.foeHp;
    const afterSet = playSet(s);
    expect(afterSet.passive.grudge).toBe(0);
    expect(afterSet.mistakeRewardUsedThisSet).toBe(false);
    expect(hpBeforeSet - afterSet.foeHp).toBeGreaterThanOrEqual(40);
  });

  it('[GP-08] Time Bomb defusal throws bomb at foe with fuse-proximity bonus (+8 / +14 / +24, zero Power)', () => {
    expect(BOMB_DEFUSE_BASE_DAMAGE).toBe(8);
    expect(BOMB_DEFUSE_HOT_DAMAGE).toBe(14);
    expect(BOMB_DEFUSE_CLUTCH_DAMAGE).toBe(24);
    const runBomb = (remainingSec: number) => {
      let s = startFight({
        save: { selectedFighter: 'Pelican', charms: [], armory: [] },
        level: dummyLevel({ rules: { hazards: { timeBombs: { every: 99, seconds: 20 } }, boardSize: 12, timer: 120 } }),
        features: ['hearts', 'gear'],
      });
      const set = findSet(s)!;
      const bombId = set[0].id;
      s = {
        ...s,
        timeBombIds: [bombId],
        board: s.board.map(c =>
          c.id === bombId
            ? { ...c, hasCountdown: true, countdownTimer: remainingSec }
            : { ...c, hasCountdown: false, countdownTimer: undefined }
        ),
      };
      const hpBefore = s.foeHp;
      const after = playSet(s, set);
      return { after, dmg: hpBefore - after.foeHp };
    };

    const safe = runBomb(12);
    expect(safe.dmg).toBe(6 + BOMB_DEFUSE_BASE_DAMAGE);
    expect(safe.after.log[safe.after.log.length - 1].set?.flatItems).toContainEqual(
      expect.objectContaining({ label: 'Bomb Throw', amount: BOMB_DEFUSE_BASE_DAMAGE })
    );

    const hot = runBomb(6);
    expect(hot.dmg).toBe(6 + BOMB_DEFUSE_HOT_DAMAGE);
    expect(hot.after.log[hot.after.log.length - 1].set?.flatItems).toContainEqual(
      expect.objectContaining({ label: 'Hot Defuse!', amount: BOMB_DEFUSE_HOT_DAMAGE })
    );

    const clutch = runBomb(3);
    expect(clutch.dmg).toBe(6 + BOMB_DEFUSE_CLUTCH_DAMAGE);
    expect(clutch.after.log[clutch.after.log.length - 1].set?.flatItems).toContainEqual(
      expect.objectContaining({ label: 'Clutch Defuse!', amount: BOMB_DEFUSE_CLUTCH_DAMAGE })
    );
  });

  it('[GP-13] enforces 65% Active Star Capacity, 2 exclusive capstone pairs per fighter, and role-pure trees (0 lasers)', () => {
    expect(ACTIVE_TREE_CAP_RATIO).toBe(0.65);
    expect(ACTIVE_TREE_CAP).toBe(Math.round(TREE_BUDGET * 0.65));

    for (const node of SKILL_NODES) {
      for (const r of node.rules ?? []) {
        for (const e of r.effects) {
          expect({ node: node.id, do: e.do }).not.toEqual({ node: node.id, do: 'laser' });
        }
      }
    }

    const nonExploders = new Set(['Sly Fox', 'Emperor Penguin', 'Corgi', 'Pelican']);
    for (const node of SKILL_NODES.filter(n => nonExploders.has(n.fighter))) {
      for (const r of node.rules ?? []) {
        for (const e of r.effects) {
          expect({ node: node.id, do: e.do }).not.toEqual({ node: node.id, do: 'explode' });
        }
      }
    }

    for (const f of FIGHTERS) {
      const tree = skillTreeOf(f.name);
      const excl = tree.filter(n => n.exclusiveWith);
      expect(excl).toHaveLength(4);
      for (const n of excl) {
        const partner = tree.find(x => x.id === n.exclusiveWith)!;
        expect(partner.exclusiveWith).toBe(n.id);
        expect(exclusiveConflictFor([partner.id], n.id)?.id).toBe(partner.id);
      }
    }

    // Corgi Stampede (+8 flat base & ×1.25 conditionalMultiplier at 18+ cards) works in combat
    let corgi = startFight({
      save: { selectedFighter: 'Corgi', skillNodes: { Corgi: ['corgi-0-9'] } },
      level: dummyLevel({ rules: { boardSize: 18, timer: 120 } }),
      features: ['hearts', 'gear'],
    });
    expect(corgi.board.length).toBe(18);
    const stampedeNode = SKILL_NODES.find(n => n.id === 'corgi-0-9')!;
    const stampedeFlat = stampedeNode.modifiers?.conditionalDamage?.[0]?.amount ?? 0;
    const stampedeMult = stampedeNode.modifiers?.conditionalMultiplier?.[0]?.multiplier ?? 1.25;
    const hpBefore = corgi.foeHp;
    corgi = playSet(corgi);
    expect(hpBefore - corgi.foeHp).toBe(Math.round((6 + stampedeFlat) * stampedeMult));
  });

  it('normalizes and caps Synergy-scaled rule damage (Set vs high-frequency collateral) to prevent quadratic blowouts', () => {
    const clean = () => startFight({ save: { selectedFighter: 'Pelican' }, level: dummyLevel(), features: ['hearts', 'gear'] });
    // Set trigger with huge coins (250): coins/5 -> capped at SET_SYNERGY_STEP_CAP (14) & SET_SYNERGY_DAMAGE_CAP (20)
    let sSet = withWeapons(
      clean(),
      relic([{ trigger: { on: 'set' }, effects: [{ do: 'damage', amount: 3, per: 'coins' }] }])
    );
    sSet = { ...sSet, synergy: { ...sSet.synergy, coins: 250 } };
    expect(damageOf(sSet).dmg).toBe(6 + SET_SYNERGY_DAMAGE_CAP);

    // High-frequency collateral trigger (cardBurned) with huge burn (200): capped at COLLATERAL_SYNERGY_DAMAGE_CAP (10)
    let sBurn = withWeapons(
      clean(),
      relic([{ trigger: { on: 'cardBurned' }, effects: [{ do: 'damage', amount: 2, per: 'burn' }] }])
    );
    const burningCard = { ...sBurn.board[0], onFire: true };
    sBurn = {
      ...sBurn,
      synergy: { ...sBurn.synergy, burn: 200 },
      board: sBurn.board.map((c, i) => (i === 0 ? burningCard : c)),
    };
    const hpBefore = sBurn.foeHp;
    const afterBurn = runReducer(sBurn, { type: 'BURN', card: burningCard });
    // 2 base burn damage + COLLATERAL_SYNERGY_DAMAGE_CAP (10) = 12 (never 2 + 400!)
    expect(hpBefore - afterBurn.foeHp).toBe(BASE_RULES.cardBasePoints + COLLATERAL_SYNERGY_DAMAGE_CAP);
  });

  it('applies RunReliefOptions cleanly (foeHpScale, extraHearts, timerScale, parryWindupScale, coinMultiplier, starCap)', () => {
    const level = testLevel({
      foes: [{ name: 'Tank', hp: 100, parry: { attackName: 'Slam', icon: 'lorc/sword-clash', counter: { kind: 'any' }, cooldownMs: 8000, windupMs: 10000, perfectWindowMs: 3500, penalty: 'heart' } }],
      rules: { timer: 100, hearts: 3 },
    });
    const run = createRun(level, createNewSave(), {
      seed: 1,
      features: new Set(['hearts', 'gear', 'coins']),
      relief: {
        foeHpScale: 0.75,
        extraHearts: 2,
        timerScale: 1.2,
        parryWindupScale: 1.3,
        coinMultiplier: 2,
        starCap: 1,
        tailwindActive: true,
      },
    });
    expect(run.foeHp).toBe(75);
    expect(run.hearts).toBe(5);
    expect(run.maxHearts).toBe(5);
    expect(run.timeLeft).toBe(120);
    expect(run.parry?.spec.windupMs).toBe(13000);
    expect(run.tailwindActive).toBe(true);
    expect(computeStars({ ...run, status: 'won', endReason: 'defeated', challengeMet: true })).toBe(1);
  });
});
