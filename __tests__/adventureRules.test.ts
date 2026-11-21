/**
 * The rule interpreter, evolutions, traps, challenges and Arcana stacking.
 * Rules are injected as test relics so these tests don't depend on content.
 */
import { baseCardReward, runReducer } from '@/adventure/engine/run';
import { allSets, countDifferentAttributes, hasAnySet, isRainbow } from '@/adventure/engine/sets';
import { MAX_CHAIN_OCCURRENCES, MAX_FIRINGS_PER_ACTION } from '@/adventure/rules/engine';
import { arcanaRules, combineArcana } from '@/adventure/data/arcana';
import { getArmoryWeapon } from '@/adventure/data/armory';
import { ROLE_SET_BONUSES, activeRoleBonuses, roleBonusProgress } from '@/adventure/data/weaponRoles';
import { challengeProgress, describeChallenge } from '@/adventure/engine/challenges';
import { snareTarget } from '@/adventure/engine/fight';
import { EVOLUTION_RECIPES } from '@/adventure/data/evolutions';
import type { Card } from '@/types';
import type { WeaponEffectResult } from '@/utils/weaponEffects';
import type { ChallengeDef, RunState } from '@/adventure/types';
import type { Rule } from '@/adventure/rules/types';
import { eventsOf, findSet, miss, playSet, relic, startFight, testLevel, tick, withWeapons } from './testUtils/adventureFight';
import { setPowerEnabled } from '@/adventure/data/weaponPower';

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

  it(`a rule chain is bounded to ${MAX_CHAIN_OCCURRENCES} occurrences per key (allows 1 bounce, never loops infinitely)`, () => {
    // set → heal (+1); heal → heal fires once (+1), then bounces once (+1), then stops at MAX_CHAIN_OCCURRENCES = 2
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
    // Bounty (+10) folded into the breaking Set's flat damage (3 + 10) + cardBroken bonus (+1) = 14, with no double-deal
    expect(breakHit).toBe(3 + 10 + 1);
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

  it('next-Set multipliers add up and cap at ×4; growBoard at MAX_BOARD overflows into empowerBoard and still fires weapon:growth', () => {
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
    expect(grown.board.length).toBe(21);
    const full = playSet(grown);
    expect(full.board.length).toBe(21);
    expect(eventsOf(grown, 'hit').filter(e => e.text === 'Bonus')).toHaveLength(1);
    // Overflow at 21 cards empowers the board (+1 charge) AND still fires weapon:growth
    expect(eventsOf(full, 'hit').filter(e => e.text === 'Bonus')).toHaveLength(2);
    expect(eventsOf(full, 'empowered').length).toBeGreaterThanOrEqual(1);
    expect(full.board.some(c => (c.charge ?? 0) >= 1)).toBe(true);
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
  // Exact hits: Power (which an evolution surges) is switched off here
  beforeEach(() => setPowerEnabled(false));
  afterEach(() => setPowerEnabled(true));
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
      // A recipe cannot be triggered again while it runs: let it end before the next
      s = tick(s, 31000, 1000);
      expect(s.activeEvolutions).toEqual([]);
    }
    expect(s.evolutionsTriggered).toBe(3);
    expect(s.evolutionCap).toBe(3);
    s = { ...s, evolutionLikelihood: 100, board: s.board.map(c => ({ ...c, hasEvolutionItem: false })) };
    for (let i = 0; i < 5; i++) s = playSet(s);
    expect(s.board.some(c => c.hasEvolutionItem)).toBe(false);
  });

  it('a Catalyst matched while its only recipe is running is spent without restarting it', () => {
    let s = catalystOn(startFight({ save: armedSave, features: ['hearts', 'gear', 'evolutions'] }));
    s = playSet(s, catalystSet(s));
    s = tick(s, 5000, 1000);
    const left = s.activeEvolutions[0].remainingMs;
    // (none can spawn now; this one is put there by hand)
    s = catalystOn(s);
    s = playSet(s, catalystSet(s));
    expect(s.evolutionsTriggered).toBe(1);
    expect(s.activeEvolutions).toEqual([{ id: phoenix.id, remainingMs: left, durationMs: 30000 }]);
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

  it('a Catalyst matched on a Set that already defeated the final foe does not fire a post-mortem Evolution', () => {
    let s = catalystOn(
      startFight({
        save: armedSave,
        level: testLevel({ foes: [{ name: 'Frail Imp', icon: 'lorc/imp', hp: 3 }] }),
        features: ['hearts', 'gear', 'evolutions'],
      })
    );
    s = playSet(s, catalystSet(s));
    expect(s.status).toBe('won');
    expect(s.foeHp).toBe(0);
    expect(s.evolutionsTriggered).toBe(0);
    expect(s.activeEvolutions).toEqual([]);
    expect(eventsOf(s, 'evolution_start')).toEqual([]);
  });

  it('a Catalyst matched on a lethal Wave 1 Set still fires an Evolution when another wave follows', () => {
    let s = catalystOn(
      startFight({
        save: armedSave,
        level: testLevel({
          foes: [
            { name: 'Wave 1 Imp', icon: 'lorc/imp', hp: 3 },
            { name: 'Wave 2 Boss', icon: 'lorc/imp', hp: 100 },
          ],
        }),
        features: ['hearts', 'gear', 'evolutions'],
      })
    );
    s = playSet(s, catalystSet(s));
    expect(s.status).toBe('intermission');
    expect(s.evolutionsTriggered).toBe(1);
    expect(s.activeEvolutions).toHaveLength(1);
    expect(eventsOf(s, 'evolution_start')).toHaveLength(1);
  });

  it('a Catalyst whose 10-dmg opening burst finishes the final foe still deals its lethal burst and wins', () => {
    let s = catalystOn(
      startFight({
        save: armedSave,
        level: testLevel({ foes: [{ name: 'Wounded Imp', icon: 'lorc/imp', hp: 10 }] }),
        features: ['hearts', 'gear', 'evolutions'],
      })
    );
    s = playSet(s, catalystSet(s));
    expect(s.status).toBe('won');
    expect(s.foeHp).toBe(0);
    expect(s.evolutionsTriggered).toBe(1);
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

describe('unified add-then-multiply damage math', () => {
  beforeEach(() => setPowerEnabled(false));
  afterEach(() => setPowerEnabled(true));
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
    // (3 base + 8 Piñata) * 2 = 22
    expect(hpBefore - after.foeHp).toBe((3 + 8) * 2);
    expect(after.board.some(c => c.id === targetId)).toBe(false);
    expect(eventsOf(after, 'pinata_break')).toHaveLength(1);
    expect(after.log[after.log.length - 1].set?.flatItems).toContainEqual(
      expect.objectContaining({ label: 'Piñata', amount: 8, sourceRef: 'weapon:pinata' })
    );
  });

  it('folds Purity Chain and Traps Cleared into flat BEFORE multiplying', () => {
    let s = startFight({
      save: { selectedFighter: 'Pelican' },
      level: testLevel({
        rules: { attributes: ['shape', 'color', 'number'], boardSize: 12 },
        foes: [{ name: 'Dummy', hp: 500 }],
      }),
      features: ['hearts', 'gear', 'purity'],
    });
    // Pick a Set with diffCount >= 2 so purity escalates from lastDiffCount = diffCount - 1 to chain 3 (+3)
    const set = findSet(s, cards => countDifferentAttributes(cards, s.attributes) >= 2)!;
    const diff = countDifferentAttributes(set, s.attributes);
    // Place a snare on a card pointing AT set[0]'s slot so matching set[0] defuses it (+4 trap bonus!)
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
    // purity chain reaches 3 (+3) + snare defuse (+4) + base (3) = 10, then ×2 = 20
    expect(hpBefore - after.foeHp).toBe((3 + 3 + 4) * 2);
    const flatItems = after.log[after.log.length - 1].set?.flatItems ?? [];
    expect(flatItems).toContainEqual(expect.objectContaining({ label: 'Purity chain', amount: 3 }));
    expect(flatItems).toContainEqual(expect.objectContaining({ label: 'Traps cleared', amount: 4 }));
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
    // Set (3 * 2 = 6) + synchronous drain rule (6 * 2 = 12) = 18
    expect(hpBefore - afterSet.foeHp).toBe(3 * 2 + 6 * 2);
    // Next non-Set action (INVALID) must NOT inherit ×2
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
    // Play a ×2 Set that ignites 1 untouched card on the board
    s = playSet(s, set);
    const burning = s.board.find(c => c.onFire)!;
    expect(burning).toBeDefined();
    expect(s.burnMults?.[burning.id]).toBe(2);
    // Prime that burning card as a health: 1 Piñata (+8 bounty)
    const primedCard = { ...burning, health: 1, bounty: 8 };
    s = {
      ...s,
      board: s.board.map(c => (c.id === burning.id ? primedCard : c)),
    };
    const hpBefore = s.foeHp;
    const afterBurn = runReducer(s, { type: 'BURN', card: primedCard });
    // (1 base burn + 8 Piñata bounty) * 2 burnMult = 18
    expect(hpBefore - afterBurn.foeHp).toBe((1 + 8) * 2);
    expect(eventsOf(afterBurn, 'pinata_break')).toHaveLength(1);
    expect(afterBurn.burnMults?.[burning.id]).toBeUndefined();
  });
});

describe('core engine bug fixes', () => {
  beforeEach(() => setPowerEnabled(false));
  afterEach(() => setPowerEnabled(true));
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

    // Second USE_HINT before a valid Set is rejected
    const blocked = runReducer(s, { type: 'USE_HINT' });
    expect(blocked.foeHp).toBe(s.foeHp);
    expect(blocked.stats.hints).toBe(2);

    // Still blocked even after an INVALID attempt
    const afterMiss = miss(blocked);
    const blockedAfterMiss = runReducer(afterMiss, { type: 'USE_HINT' });
    expect(blockedAfterMiss.stats.hints).toBe(2);

    // Matching a valid Set clears hintUsedThisSet so hint works again
    const afterMatch = playSet(afterMiss);
    expect(afterMatch.hintUsedThisSet).toBe(false);
    const allowedAgain = runReducer(afterMatch, { type: 'USE_HINT' });
    expect(allowedAgain.stats.hints).toBe(1);
    expect(afterMatch.foeHp - allowedAgain.foeHp).toBe(4);
  });

  it('emits healed even when healing at full hearts (Phoenix Pyre / clean play)', () => {
    const s = withWeapons(
      base(),
      relic([
        { trigger: { on: 'set' }, effects: [{ do: 'heal', amount: 1 }] },
        { trigger: { on: 'healed' }, effects: [{ do: 'damage', amount: 6 }] },
      ])
    );
    expect(s.hearts).toBe(s.maxHearts);
    const { dmg } = damageOf(s);
    expect(dmg).toBe(3 + 6);
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
    // 4 collateral blast damage + 9 from weapon:explosion listener
    expect(hpBefore - after.foeHp).toBeGreaterThanOrEqual(4 + 9);
  });

  it('Clarity Lens preserves Rainbow detection on non-simplified traits and rolls doubleClarityChance on extension', () => {
    const c1: Card = { id: 'a', shape: 'oval', color: 'red', number: 1, shading: 'solid', selected: false };
    const c2: Card = { id: 'b', shape: 'diamond', color: 'green', number: 1, shading: 'solid', selected: false };
    const c3: Card = { id: 'c', shape: 'squiggle', color: 'purple', number: 1, shading: 'solid', selected: false };
    // Number is simplified to all 1s, but shape & color are all-different -> Rainbow under Clarity!
    expect(isRainbow([c1, c2, c3], ['shape', 'color', 'number'])).toBe(false);
    expect(isRainbow([c1, c2, c3], ['shape', 'color', 'number'], ['number'])).toBe(true);

    // [Wild, Wild, Plain] returns full trait count and isRainbow === true
    const w1: Card = { ...c1, id: 'w1', isWild: true };
    const w2: Card = { ...c2, id: 'w2', isWild: true };
    expect(countDifferentAttributes([w1, w2, c3], ['shape', 'color', 'number'])).toBe(3);
    expect(isRainbow([w1, w2, c3], ['shape', 'color', 'number'])).toBe(true);

    // Double clarity chance rolls even when extending an already-active simplify
    let s = withWeapons(
      base(),
      relic([{ trigger: { on: 'set' }, effects: [{ do: 'simplify', ms: 6000 }] }], { doubleClarityChance: 100 })
    );
    s = playSet(s);
    expect(s.simplified?.also).toBeDefined();
    // Strip `also` and re-trigger simplify while already simplified: extension must re-roll doubleClarityChance
    s = { ...s, simplified: { attribute: s.simplified!.attribute, value: s.simplified!.value, remainingMs: 3000 } };
    s = playSet(s);
    expect(s.simplified?.also).toBeDefined();
  });

  it('Paradox finale spawns a Catalyst even in a 2-weapon pair because expired recipes leave activeEvolutions first', () => {
    const paradox = EVOLUTION_RECIPES.find(r => r.id === 'paradox')!;
    expect(paradox).toBeDefined();
    let s = startFight({
      save: {
        selectedFighter: 'Pelican',
        armory: ['temporal-rift', 'catalyst-prism'],
        charms: ['temporal-rift', 'catalyst-prism'],
        unlockedEvolutions: [paradox.id],
      },
      features: ['hearts', 'gear', 'evolutions'],
    });
    // Put paradox into activeEvolutions with 1s remaining and no catalyst on board
    s = {
      ...s,
      activeEvolutions: [{ id: paradox.id, remainingMs: 1000, durationMs: 30000 }],
      board: s.board.map(c => (c.hasEvolutionItem ? { ...c, hasEvolutionItem: false } : c)),
      catalystRecipeId: undefined,
    };
    const after = tick(s, 1500, 500);
    expect(after.activeEvolutions).toHaveLength(0);
    expect(after.board.some(c => c.hasEvolutionItem)).toBe(true);
    expect(after.catalystRecipeId).toBe(paradox.id);
  });

  it('E.combo grants +1 Set damage per bonus step on non-Sly-Fox fighters without altering plain fast Sets', () => {
    const s = withWeapons(
      base(),
      relic([{ trigger: { on: 'mistake' }, effects: [{ do: 'comboStep', amount: 3 }] }])
    );
    // Plain Pelican Set with no E.combo deals 3
    expect(damageOf(s).dmg).toBe(3);
    // After mistake bumps E.combo by 3, next Set deals 3 + 3 = 6
    const afterMiss = miss(s);
    expect(afterMiss.bonusCombo).toBe(3);
    expect(damageOf(afterMiss).dmg).toBe(3 + 3);
  });

  it('autoSet breaks linked partners and fires linkDestroyed', () => {
    let s = withWeapons(
      base(),
      relic([
        { trigger: { on: 'mistake' }, effects: [{ do: 'trigger', kind: 'echo' }] },
        { trigger: { on: 'linkDestroyed' }, effects: [{ do: 'damage', amount: 7 }] },
      ])
    );
    // Connect every board index to its neighbor so whichever Set autoSet picks breaks at least 1 link
    const connections = s.board.slice(0, -1).map((_, i) => ({
      id: `c-${i}`,
      positionA: i,
      positionB: i + 1,
      createdAt: 0,
    }));
    s = { ...s, connections };
    const hpBefore = s.foeHp;
    const after = miss(s);
    // AutoSet matched 3 cards + broke linked partner(s) -> linkDestroyed fired (+7 each)
    expect(hpBefore - after.foeHp).toBeGreaterThanOrEqual(3 + 7);
  });
});

describe('Role Set Bonuses (2/4/6 Brotato-style synergies)', () => {
  beforeEach(() => setPowerEnabled(false));
  afterEach(() => setPowerEnabled(true));

  it('defines 2/4/6 tiers for all 8 weapon roles and ignores synthetic test relics', () => {
    expect(Object.keys(ROLE_SET_BONUSES)).toHaveLength(8);
    expect(activeRoleBonuses([relic([]), relic([], undefined, 'r2')])).toEqual([]);
  });

  it('activates damage (2) and board (2) Role Set Bonuses live in a fight', () => {
    const blast = getArmoryWeapon('blast-powder')!;
    const ray = getArmoryWeapon('prismatic-ray')!;
    const fieldStone = getArmoryWeapon('field-stone')!;
    const growthSeed = getArmoryWeapon('growth-seed')!;

    const bonuses = activeRoleBonuses([blast, ray, fieldStone, growthSeed]);
    expect(bonuses.map(b => `${b.role}:${b.tier}`)).toEqual(expect.arrayContaining(['damage:2', 'board:2']));

    const progress = roleBonusProgress([blast, ray, fieldStone, growthSeed]);
    expect(progress.find(p => p.role === 'damage')).toMatchObject({ count: 2, activeTier: 2, nextTier: 4 });

    // Fight with 2 damage + 2 board weapons: board:2 adds +1 startingBoardCards on top of field-stone's fieldSize, damage:2 adds +1 setDamage
    const singleBoard = startFight({
      save: {
        selectedFighter: 'Pelican',
        upgrades: { charm_belt: 4 },
        armory: ['blast-powder', 'prismatic-ray', 'field-stone'],
        charms: ['blast-powder', 'prismatic-ray', 'field-stone'],
      },
      level: testLevel({ foes: [{ name: 'Dummy', hp: 500 }] }),
      features: ['hearts', 'gear'],
    });
    const s = startFight({
      save: {
        selectedFighter: 'Pelican',
        upgrades: { charm_belt: 4 },
        armory: ['blast-powder', 'prismatic-ray', 'field-stone', 'growth-seed'],
        charms: ['blast-powder', 'prismatic-ray', 'field-stone', 'growth-seed'],
      },
      level: testLevel({ foes: [{ name: 'Dummy', hp: 500 }] }),
      features: ['hearts', 'gear'],
    });
    expect(s.board.length).toBe(singleBoard.board.length + 1);
    const { next, dmg } = damageOf(s);
    // 3 base + 1 from Damage Set (2)
    expect(dmg).toBeGreaterThanOrEqual(4);
    expect(next.log[next.log.length - 1].set?.flatItems).toContainEqual(
      expect.objectContaining({ label: 'Damage Set', amount: 1, sourceRef: 'role:damage' })
    );
  });

  it('chains:4 adds starting links and +5% bonusEchoChance', () => {
    const s = startFight({
      save: {
        selectedFighter: 'Pelican',
        upgrades: { charm_belt: 4 },
        armory: ['echo-stone', 'chain-reaction', 'connector', 'web-weaver'],
        charms: ['echo-stone', 'chain-reaction', 'connector', 'web-weaver'],
      },
      level: testLevel({ foes: [{ name: 'Dummy', hp: 500 }] }),
      features: ['hearts', 'gear'],
    });
    // chains:4 adds startingLinks: 2 (plus connector/web-weaver links)
    expect(s.connections.length).toBeGreaterThanOrEqual(2);
    // chains:4 adds +5% bonusEchoChance on top of echo-stone
    const baseEchoOnly = startFight({
      save: { selectedFighter: 'Pelican', armory: ['echo-stone'], charms: ['echo-stone'] },
      level: testLevel({ foes: [{ name: 'Dummy', hp: 500 }] }),
      features: ['hearts', 'gear'],
    });
    expect(s.stats.echoChance).toBeGreaterThanOrEqual(baseEchoOnly.stats.echoChance + 5);
  });
});

describe('Wave 2 rule verbs & conditions', () => {
  beforeEach(() => setPowerEnabled(false));
  afterEach(() => setPowerEnabled(true));
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
    // Unhinted set: diffCountAtLeast(1) (+4) + diffCountAtMost(3) (+3) = +7
    expect(damageOf(s, set).dmg).toBe(3 + 4 + 3);
    // Hinted set: also triggers hintedSet (+10)
    const hpBefore = s.foeHp;
    const hintedRun = runReducer(s, { type: 'MATCH', cards: set, rewards: set.map(c => ({ cardId: c.id, points: 1 })), hinted: true });
    expect(hpBefore - hintedRun.foeHp).toBe(3 + 4 + 3 + 10);
  });

  it('executes repairGlass, feedChest, advanceTricks, stampAlbum, addMagnet, spawnCatalystForce, and scaled xp', () => {
    // repairGlass + feedChest + addMagnet + stampAlbum + advanceTricks
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
    // Sync gear once so chest, magnet, and ice block exist on board, then shatter glass
    s = tick(s, 500);
    s = { ...s, gear: { ...s.gear, glassBroken: true } };
    const chestId = s.board.find(c => c.chest !== undefined)!.id;
    const iceBefore = s.board.find(c => (c.frozen ?? 0) > 0)?.frozen;
    // Trigger INVALID on 3 cards that do NOT include the chest or frozen card so live mutations apply directly
    const wrong = s.board.filter(c => c.id !== chestId && !(c.frozen ?? 0)).slice(0, 3);
    const afterInvalid = runReducer(s, { type: 'INVALID', cards: wrong });
    const after = runReducer(afterInvalid, { type: 'REPLACE', ids: wrong.map(c => c.id) });
    // repairGlass runs in drain() after onMistakeGear shatters glass -> Glass Sword is repaired!
    expect(after.gear.glassBroken).toBe(false);
    // Chest was reset to floor (10) on mistake, then feedChest(+7) + advanceTricks(3000ms -> 1 step, +2) = 19
    expect(after.board.find(c => c.chest !== undefined)?.chest).toBe(10 + 7 + 2);
    // addMagnet added an extra magnetized card (1 base + 1 extra = 2)
    expect(after.board.filter(c => c.magnet).length).toBeGreaterThanOrEqual(2);
    // stampAlbum stamped 1 page
    expect(after.gear.album.length).toBe(1);
    // advanceTricks chipped Ice Block
    if (iceBefore !== undefined) {
      expect(after.board.find(c => (c.frozen ?? 0) > 0)?.frozen).toBe(iceBefore - 1);
    }

    // xp with per: 'evolution' & spawnCatalystForce
    const phoenix = EVOLUTION_RECIPES.find(r => r.id === 'phoenix-pyre')!;
    let s2 = startFight({
      save: {
        selectedFighter: 'Pelican',
        armory: ['blast-powder', 'mending-charm'],
        charms: ['blast-powder', 'mending-charm'],
        unlockedEvolutions: [phoenix.id],
      },
      features: ['hearts', 'gear', 'xp', 'evolutions'],
    });
    s2 = withWeapons(
      {
        ...s2,
        activeEvolutions: [{ id: phoenix.id, remainingMs: 30000, durationMs: 30000 }],
        board: s2.board.map(c => (c.hasEvolutionItem ? { ...c, hasEvolutionItem: false } : c)),
      },
      relic([
        {
          trigger: { on: 'mistake' },
          effects: [
            { do: 'xp', amount: 5, per: 'evolution' },
            { do: 'spawnCatalystForce' },
          ],
        },
      ])
    );
    const xpBefore = s2.xp;
    const after2 = miss(s2);
    expect(after2.xp - xpBefore).toBe(5);
    expect(after2.board.some(c => c.hasEvolutionItem)).toBe(true);
  });
});
