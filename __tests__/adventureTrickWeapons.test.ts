/**
 * Trick weapons (engine/gear.ts, data/adventureWeapons.ts): weapons with
 * something to hunt for or keep up, plus the Understudy and the Encore Mask.
 */
import type { Card } from '@/types';
import { isValidCombination } from '@/utils/gameUtils';
import { runReducer } from '@/adventure/engine/run';
import { allSets, countDifferentAttributes } from '@/adventure/engine/sets';
import { albumPageOf } from '@/adventure/engine/gear';
import { charmWeapons, getArmoryWeapon } from '@/adventure/data/armory';
import { TRICK_WEAPON_IDS } from '@/adventure/data/adventureWeapons';
import { hasWeaponRole } from '@/adventure/data/weaponRoles';
import { createMaxedSave } from '@/adventure/progress';
import { BOTS, simulateRun } from '@/adventure/engine/bot';
import { getLevel } from '@/adventure/data/levels';
import type { AdventureWeapon, RunState } from '@/adventure/types';
import type { Modifiers } from '@/adventure/rules/types';
import { findSet, miss, playSet, relic, startFight, tick, withWeapons } from './testUtils/adventureFight';

/** A fight holding a weapon that brings these trick numbers. */
const withTrick = (modifiers: Modifiers, s: RunState = startFight()): RunState => {
  const w = { ...relic([]), modifiers } as AdventureWeapon;
  return withWeapons(s, w);
};
const slotsOf = (s: RunState, set: Card[]) => set.map(c => s.board.findIndex(b => b.id === c.id));

describe('trick weapon data', () => {
  it('every trick weapon is in the Armory with wording and a number that grows', () => {
    const armory = createMaxedSave().armory;
    for (const id of TRICK_WEAPON_IDS) {
      expect(armory).toContain(id);
      const a = getArmoryWeapon(id, { [id]: { level: 1, tuning: {} } })!;
      const b = getArmoryWeapon(id, { [id]: { level: 5, tuning: {} } })!;
      expect(a.description.length).toBeGreaterThan(20);
      expect(b.description).not.toBe(a.description);
    }
  });
});

describe('Armory shelves', () => {
  it('every Armory weapon has a role', () => {
    for (const id of createMaxedSave().armory) expect({ id, shelved: hasWeaponRole(id) }).toEqual({ id, shelved: true });
  });
});

describe('Magnet', () => {
  it('marks one card; a Set with it hits harder and the mark moves', () => {
    let s = withTrick({ magnetDamage: 6 });
    s = tick(s, 1000);
    const marked = s.board.filter(c => c.magnet);
    expect(marked).toHaveLength(1);
    const withMark = findSet(s, set => set.some(c => c.magnet));
    if (!withMark) return;
    const next = playSet(s, withMark);
    expect(next.log[next.log.length - 1].lines).toContainEqual({ type: 'rule', amount: 6, text: 'Magnet!' });
    expect(next.board.filter(c => c.magnet)).toHaveLength(1);
    expect(next.board.find(c => c.magnet)!.id).not.toBe(marked[0].id);
    // A Set without the marked card gets nothing from it
    const without = findSet(s, set => !set.some(c => c.magnet));
    if (without) expect(playSet(s, without).log.at(-1)!.lines.some(l => l.text === 'Magnet!')).toBe(false);
  });
});

describe('Bounty Poster', () => {
  it('pays per wanted card and changes after three', () => {
    let s = tick(withTrick({ bountyDamage: 2 }), 1000);
    const first = s.gear.bounty!;
    expect(first.left).toBe(3);
    for (let i = 0; i < 12 && s.gear.bounty!.attribute === first.attribute && s.gear.bounty!.value === first.value; i++) {
      const wantedSet = findSet(s, set => set.some(c => (c as unknown as Record<string, unknown>)[first.attribute] === first.value)) ?? findSet(s)!;
      s = playSet(s, wantedSet);
    }
    expect(s.gear.bounty).not.toMatchObject({ attribute: first.attribute, value: first.value });
    expect(s.log.flatMap(e => e.lines).some(l => l.text === 'Bounty!')).toBe(true);
  });
});

describe('Mirror Shard', () => {
  it('pays when a Set reuses a slot of the previous Set', () => {
    let s = withTrick({ mirrorDamage: 5 });
    const first = findSet(s)!;
    const slots = slotsOf(s, first);
    s = playSet(s, first);
    expect(s.gear.lastSetSlots.sort()).toEqual(slots.sort());
    const reuse = findSet(s, set => slotsOf(s, set).some(i => slots.includes(i)));
    if (!reuse) return;
    s = playSet(s, reuse);
    expect(s.log[s.log.length - 1].lines).toContainEqual({ type: 'rule', amount: 5, text: 'Mirror!' });
  });
});

describe('Odd One Out and the Collector\'s Album', () => {
  it('Odd One Out pays Sets with exactly one trait different', () => {
    const s = withTrick({ oddOneOutDamage: 4 });
    const one = findSet(s, set => countDifferentAttributes(set, s.attributes) === 1);
    if (!one) return;
    const after = playSet(s, one);
    expect(after.log[after.log.length - 1].lines).toContainEqual({ type: 'rule', amount: 4, text: 'Odd one out!' });
  });

  it('the Album fills one page per trait, pays on the last and starts over', () => {
    let s = withTrick({ albumDamage: 15 });
    let paid = false;
    for (let i = 0; i < 80 && !paid; i++) {
      const page = findSet(s, set => albumPageOf(set, s.attributes, s.gear.album) !== null);
      s = playSet(s, page ?? findSet(s)!);
      paid = s.log[s.log.length - 1].lines.some(l => l.text === 'Album complete!' && l.amount === 15);
    }
    expect(paid).toBe(true);
    expect(s.gear.album).toEqual([]);
  });
});

describe('Snowball and the Glass Sword', () => {
  it('Snowball stacks per Set up to its max and a mistake halves it', () => {
    let s = withTrick({ snowballStep: 1, snowballMax: 3 });
    for (let i = 0; i < 5; i++) s = playSet(s);
    expect(s.gear.snowball).toBe(3);
    expect(s.log[s.log.length - 1].lines).toContainEqual({ type: 'rule', amount: 3, text: 'Snowball' });
    s = miss(s);
    expect(s.gear.snowball).toBe(1);
  });

  it('the Glass Sword pays until a mistake shatters it', () => {
    let s = withTrick({ glassDamage: 6, glassWindowMs: 6000 });
    s = playSet(s);
    expect(s.log[s.log.length - 1].lines).toContainEqual({ type: 'rule', amount: 6, text: 'Glass Sword' });
    s = miss(s);
    expect(s.gear.glassBroken).toBe(true);
    s = playSet(s);
    expect(s.log[s.log.length - 1].lines.some(l => l.text === 'Glass Sword')).toBe(false);
  });

  it('the Glass Sword also shatters after its window without a Set', () => {
    let s = withTrick({ glassDamage: 6, glassWindowMs: 6000 });
    s = tick(s, 5000, 1000);
    expect(s.gear.glassBroken).toBe(false);
    s = tick(s, 2000, 1000);
    expect(s.gear.glassBroken).toBe(true);
  });
});

describe('Devil\'s Bargain', () => {
  it('pays for the heart it took and every other missing heart', () => {
    let s = withTrick({ missingHeartDamage: 2 }, startFight({ features: ['hearts', 'gear'] }));
    s = playSet(s);
    expect(s.log[s.log.length - 1].lines).toContainEqual({ type: 'rule', amount: 2, text: "Devil's Bargain" });
    s = playSet(miss(s));
    expect(s.log[s.log.length - 1].lines).toContainEqual({ type: 'rule', amount: 4, text: "Devil's Bargain" });
  });
});

describe('Wild Card', () => {
  it('a wild card makes a Set with any two cards', () => {
    const s = startFight();
    const [a, b, c] = s.board;
    const wild = { ...c, isWild: true };
    expect(isValidCombination([a, b, wild], s.attributes).isValid).toBe(true);
    const board = s.board.map(x => (x.id === c.id ? wild : x));
    const n = board.length - 1;
    // Every pair of the other cards, plus the ordinary Sets among them
    expect(allSets(board, s.attributes).filter(set => set.some(x => x.isWild))).toHaveLength((n * (n - 1)) / 2);
  });

  it('wild cards are dealt by chance, one at a time, and score as a Set', () => {
    let s = withTrick({ wildChance: 100 });
    s = playSet(s);
    expect(s.board.filter(c => c.isWild)).toHaveLength(1);
    const before = s.matches;
    s = playSet(s, findSet(s, set => set.some(c => c.isWild)));
    expect(s.matches).toBe(before + 1);
    expect(s.board.filter(c => c.isWild).length).toBeLessThanOrEqual(1);
  });
});

describe('Twin Seed', () => {
  it('deals twins that point at each other; matching one destroys the other for damage', () => {
    let s = withTrick({ twinChance: 100, twinDamage: 5 });
    s = playSet(s);
    const twins = s.board.filter(c => c.twinOf);
    expect(twins.length).toBeGreaterThanOrEqual(2);
    for (const t of twins) expect(s.board.find(c => c.id === t.twinOf)?.twinOf).toBe(t.id);
    const set = findSet(s, cards => cards.some(c => c.twinOf));
    if (!set) return;
    const partnerIds = set.map(c => c.twinOf).filter(Boolean);
    s = playSet(s, set);
    expect(s.log[s.log.length - 1].lines).toContainEqual({ type: 'hit', amount: 5, text: 'Twin' });
    for (const id of partnerIds) expect(s.board.some(c => c.id === id)).toBe(false);
  });
});

describe('Fog Lantern', () => {
  it('deals face-down cards that flip up after 8s as power cards', () => {
    let s = withTrick({ fogChance: 100, fogBonus: 7 });
    s = playSet(s);
    const fogged = s.board.filter(c => c.fogFlipAt !== undefined);
    expect(fogged.length).toBeGreaterThan(0);
    expect(fogged.every(c => c.isFaceDown)).toBe(true);
    s = tick(s, 9000, 1000);
    for (const f of fogged) {
      const now = s.board.find(c => c.id === f.id);
      if (!now) continue;
      expect(now.isFaceDown).toBeFalsy();
      expect(now.bonusPoints).toBeGreaterThanOrEqual(7);
    }
  });
});

describe('Understudy', () => {
  it('copies the charm to its left at its own level, and does nothing in the first slot', () => {
    const [blast, copy] = charmWeapons(['blast-powder', 'understudy'], { understudy: { level: 2, tuning: {} } });
    expect(copy.id).toBe('understudy');
    expect(copy.effects.explosionChance).toBe(getArmoryWeapon('blast-powder', { 'blast-powder': { level: 2, tuning: {} } })!.effects.explosionChance);
    expect(copy.shortDescription).toContain(blast.name);
    const [alone] = charmWeapons(['understudy', 'blast-powder']);
    expect(alone.effects).toEqual({});
  });

  it('a copied trick weapon stacks with the original', () => {
    const save = { ...createMaxedSave(), charms: ['magnet', 'understudy'], skillNodes: {}, equippedArcana: [], upgrades: {} };
    const s = startFight({ save });
    expect(s.weapons.map(w => w.id)).toEqual(['magnet', 'understudy']);
    const m = (s.weapons[1] as AdventureWeapon).modifiers!;
    // The copy is the Magnet at the Understudy's level (1), whatever level the Magnet itself is
    expect(m.magnetDamage).toBe((getArmoryWeapon('magnet', { magnet: { level: 1, tuning: {} } }) as AdventureWeapon).modifiers!.magnetDamage);
  });
});

describe('Encore Mask', () => {
  it('an evolution ends with a hit', () => {
    const save = { ...createMaxedSave(), charms: ['blast-powder', 'mending-charm', 'encore-mask'], skillNodes: {}, equippedArcana: [], upgrades: {} };
    let s = startFight({ save, features: ['hearts', 'gear', 'evolutions'] });
    const set = findSet(s)!;
    s = { ...s, board: s.board.map(c => (c.id === set[0].id ? { ...c, hasEvolutionItem: true, evolutionReady: true } : c)) };
    s = playSet(s, findSet(s, cards => cards.some(c => c.hasEvolutionItem)));
    expect(s.activeEvolutions).toHaveLength(1);
    s = tick(s, 31000, 1000);
    expect(s.activeEvolutions).toHaveLength(0);
    expect(s.log.flatMap(e => e.lines)).toContainEqual({ type: 'hit', amount: 10, text: 'Encore!' });
  });
});

describe('trick weapons in real fights', () => {
  it('bots finish fights holding every trick weapon, and the log still adds up', () => {
    const base = { ...createMaxedSave(), skillNodes: {}, equippedArcana: [], upgrades: {} };
    for (const id of ['2-3', '3-5', '4-2']) {
      for (let i = 0; i < TRICK_WEAPON_IDS.length; i += 3) {
        const charms = ['blast-powder', ...TRICK_WEAPON_IDS.slice(i, i + 3)];
        const { state } = simulateRun(getLevel(id), { ...base, charms }, BOTS.average, 7 + i);
        expect(['won', 'lost']).toContain(state.status);
        expect(state.log.reduce((a, e) => a + e.damage, 0)).toBe(state.totalDamage);
        expect(state.board.filter(c => c.isWild).length).toBeLessThanOrEqual(1);
      }
    }
  });
});
