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

// ─── Board gambles: a harder board for a bigger payoff ──────────────────────

const lastLines = (s: RunState) => s.log[s.log.length - 1].lines;

describe('Cursed Idol', () => {
  it('a cursed card is out of play, then becomes a ×2 card or passes the curse on', () => {
    let s = withTrick({ curseChance: 100 });
    s = playSet(s);
    const cursed = s.board.filter(c => c.cursedUntil !== undefined);
    expect(cursed.length).toBeGreaterThan(0);
    expect(cursed.every(c => c.locked)).toBe(true);
    expect(allSets(s.board, s.attributes).flat().some(c => c.locked)).toBe(false);
    s = tick(s, 11000, 1000);
    // Each of those curses ended one of two ways
    for (const c of cursed) {
      const now = s.board.find(b => b.id === c.id);
      if (now) expect(!!now.doubler || !now.locked).toBe(true);
    }
    const doubled = findSet(s, set => set.some(c => c.doubler));
    if (!doubled) return;
    s = playSet(s, doubled);
    expect(lastLines(s)).toContainEqual({ type: 'rule', amount: 2, text: 'Curse broken ×2' });
  });
});

describe('Chain Gang', () => {
  it('chains two cards; together they pay, alone a chained card stays', () => {
    let s = tick(withTrick({ chainDamage: 12 }), 1000);
    const chained = s.board.filter(c => c.shackle);
    expect(chained).toHaveLength(2);
    expect(chained[0].shackle).toBe(chained[1].id);
    const alone = findSet(s, set => set.filter(c => c.shackle).length === 1);
    if (alone) {
      const after = playSet(s, alone);
      const kept = alone.find(c => c.shackle)!;
      expect(after.board.some(c => c.id === kept.id)).toBe(true);
    }
    const both = findSet(s, set => set.filter(c => c.shackle).length === 2);
    if (!both) return;
    s = playSet(s, both);
    expect(lastLines(s)).toContainEqual({ type: 'rule', amount: 12, text: 'Chain Gang!' });
    expect(s.board.filter(c => c.shackle)).toHaveLength(2);
  });
});

describe('Thorn Bush', () => {
  it('thorn cards pay when matched in time and cost a heart when left', () => {
    let s = withTrick({ thornChance: 100, thornDamage: 6 }, startFight({ features: ['hearts', 'gear'] }));
    s = playSet(s);
    const thorny = s.board.filter(c => c.thornAt !== undefined);
    expect(thorny.length).toBeGreaterThan(0);
    const paid = playSet(s, findSet(s, set => set.some(c => c.thornAt !== undefined)));
    expect(lastLines(paid).some(l => l.text === 'Thorns' && (l.amount ?? 0) >= 6)).toBe(true);
    const hearts = s.hearts!;
    s = tick(s, 16000 + 5000 * Math.max(0, s.attributes.length - 3), 1000);
    expect(s.hearts).toBeLessThan(hearts);
    expect(s.board.some(c => thorny.some(t => t.id === c.id) && c.thornAt !== undefined)).toBe(false);
  });
});

describe('Rust', () => {
  it('cards lose damage as they sit, never below nothing, and the oldest turns golden after 7 Sets', () => {
    let s = withTrick({ rustGold: 15 });
    s = playSet(s);
    expect(s.board.some(c => c.rust === 1)).toBe(true);
    for (let i = 0; i < 12; i++) s = playSet(s, findSet(s, set => !set.some(c => c.rusted)) ?? findSet(s));
    const golden = s.board.filter(c => c.rusted);
    expect(golden.length).toBeGreaterThan(0);
    expect(golden.every(c => (c.bonusPoints ?? 0) >= 15 && (c.bonusMoney ?? 0) >= 5 && c.rust === undefined)).toBe(true);
    // Three fully rusted plain cards are worth nothing, not less
    const rusty = findSet(s, set => set.every(c => (c.rust ?? 0) >= 1 && !c.bonusPoints && !c.charge));
    if (!rusty) return;
    const before = s.totalDamage;
    s = playSet(s, rusty);
    expect(s.totalDamage).toBeGreaterThanOrEqual(before);
    expect(s.log[s.log.length - 1].setDamage).toBeGreaterThanOrEqual(0);
  });
});

describe('Tar Pit', () => {
  it('one row is sticky: its cards take two matches, and Sets there pay', () => {
    let s = tick(withTrick({ tarDamage: 5 }), 1000);
    const row = s.gear.tarRow!;
    expect(row).not.toBeNull();
    const inRow = s.board.filter((_, i) => Math.floor(i / 3) === row);
    expect(inRow.every(c => c.tar === 1)).toBe(true);
    expect(s.board.filter((_, i) => Math.floor(i / 3) !== row).some(c => c.tar)).toBe(false);
    const set = findSet(s, cards => cards.some(c => c.tar));
    if (!set) return;
    const sticky = set.filter(c => c.tar);
    s = playSet(s, set);
    expect(lastLines(s)).toContainEqual({ type: 'rule', amount: 5, text: 'Tar Pit' });
    for (const c of sticky) expect(s.board.find(b => b.id === c.id)?.tar).toBe(2);
  });
});

describe('Decoy', () => {
  it('deals unmarked near-copies; matching one with its original pays', () => {
    let s = withTrick({ decoyChance: 100, decoyDamage: 10 });
    s = playSet(s);
    const decoys = s.board.filter(c => c.decoyOf && s.board.some(o => o.id === c.decoyOf));
    expect(decoys.length).toBeGreaterThan(0);
    for (const dcy of decoys) {
      const original = s.board.find(o => o.id === dcy.decoyOf)!;
      expect(s.attributes.filter(a => (dcy as unknown as Record<string, unknown>)[a] !== (original as unknown as Record<string, unknown>)[a])).toHaveLength(1);
    }
    const pair = findSet(s, set => set.some(c => c.decoyOf && set.some(o => o.id === c.decoyOf)));
    if (!pair) return;
    s = playSet(s, pair);
    expect(lastLines(s)).toContainEqual({ type: 'rule', amount: 10, text: 'Decoy found!' });
  });
});

describe('Long Fuse', () => {
  it('fused cards pay in their last 5 seconds and burn out as duds, without ever leaving the board Set-less', () => {
    let s = withTrick({ fuseChance: 100, fuseDamage: 6 });
    s = playSet(s);
    expect(s.board.some(c => c.fuseAt !== undefined)).toBe(true);
    s = tick(s, 16000, 1000);
    expect(s.board.some(c => c.fuseHot)).toBe(true);
    const hot = findSet(s, set => set.some(c => c.fuseHot));
    if (hot) expect(lastLines(playSet(s, hot)).some(l => l.text === 'Short fuse' && (l.amount ?? 0) >= 6)).toBe(true);
    s = tick(s, 6000, 1000);
    expect(s.board.filter(c => c.fuseDud).length).toBeLessThanOrEqual(3);
    for (let i = 0; i < 20; i++) {
      expect(findSet(s)).toBeDefined();
      s = tick(playSet(s), 21000, 1000);
    }
  });
});

describe('Ice Block', () => {
  it('one card is frozen out of play, thaws after 7 Sets worth +25, then another freezes', () => {
    let s = tick(withTrick({ frozenDamage: 25 }), 1000);
    const ice = s.board.find(c => (c.frozen ?? 0) > 0)!;
    expect(ice).toMatchObject({ frozen: 7, locked: true });
    for (let i = 0; i < 7; i++) s = playSet(s, findSet(s, set => !set.some(c => c.id === ice.id)));
    const thawed = s.board.find(c => c.id === ice.id);
    if (!thawed) return; // destroyed by something else on the way
    expect(thawed).toMatchObject({ thawed: true });
    expect(thawed.locked).toBeFalsy();
    expect(thawed.bonusPoints).toBeGreaterThanOrEqual(25);
    expect(s.board.filter(c => (c.frozen ?? 0) > 0)).toHaveLength(0);
    const set = findSet(s, cards => cards.some(c => c.id === ice.id));
    if (!set) return;
    s = playSet(s, set);
    expect(s.board.filter(c => (c.frozen ?? 0) > 0)).toHaveLength(1);
  });
});

describe('Greedy Chest', () => {
  it('grows every Set you leave it, pays when matched, and a mistake empties it', () => {
    let s = tick(withTrick({ chestStart: 10, chestGrowth: 2 }), 1000);
    const chest = s.board.find(c => c.chest !== undefined)!;
    expect(chest.chest).toBe(10);
    s = playSet(s, findSet(s, set => !set.some(c => c.id === chest.id)));
    expect(s.board.find(c => c.id === chest.id)?.chest).toBe(12);
    const open = findSet(s, set => set.some(c => c.id === chest.id));
    if (open) {
      const paid = playSet(s, open);
      expect(lastLines(paid)).toContainEqual({ type: 'rule', amount: 12, text: 'Greedy Chest!' });
      expect(paid.board.filter(c => c.chest !== undefined)).toHaveLength(1);
    }
    s = miss(s);
    const after = s.board.find(c => c.chest !== undefined);
    if (after?.id === chest.id) expect(after.chest).toBe(0);
  });
});

describe('Tightrope', () => {
  it('pays Sets that touch the last Set and halves the others', () => {
    let s = withTrick({ tightropeDamage: 5 });
    const first = findSet(s)!;
    const slots = slotsOf(s, first);
    s = playSet(s, first);
    expect(lastLines(s)).toContainEqual({ type: 'rule', amount: 5, text: 'Tightrope' });
    const near = new Set(slots.flatMap(i => [i, i - 3, i + 3, ...(i % 3 > 0 ? [i - 1] : []), ...(i % 3 < 2 ? [i + 1] : [])]));
    const off = findSet(s, set => !slotsOf(s, set).some(i => near.has(i)));
    if (off) {
      const r = playSet(s, off);
      expect(lastLines(r)).toContainEqual({ type: 'rule', amount: 0.5, text: 'Off the rope' });
      expect(r.log[r.log.length - 1].set!.multiplier % 1).toBe(r.log[r.log.length - 1].set!.rainbow ? 0 : 0.5);
    }
    const onRope = findSet(s, set => slotsOf(s, set).some(i => near.has(i)));
    if (onRope) expect(lastLines(playSet(s, onRope))).toContainEqual({ type: 'rule', amount: 5, text: 'Tightrope' });
  });
});

describe('Hot Potato', () => {
  it('one hot card that jumps every 10s, pays when matched, and makes mistakes cost more', () => {
    let s = tick(withTrick({ potatoDamage: 8 }, startFight({ features: ['hearts', 'gear'] })), 1000);
    const hot = s.board.find(c => c.hot)!;
    expect(s.board.filter(c => c.hot)).toHaveLength(1);
    const moved = tick(s, 11000, 1000);
    expect(moved.board.filter(c => c.hot)).toHaveLength(1);
    expect(moved.board.find(c => c.hot)!.id).not.toBe(hot.id);
    const set = findSet(s, cards => cards.some(c => c.hot));
    if (set) expect(lastLines(playSet(s, set))).toContainEqual({ type: 'rule', amount: 8, text: 'Hot Potato!' });
    const plain = miss(startFight({ features: ['hearts', 'gear'] }));
    const lostPlain = plain.maxHearts! - plain.hearts!;
    const burned = miss(s);
    expect(s.hearts! - burned.hearts!).toBe(lostPlain + 1);
  });
});

describe('every board gamble keeps the board playable', () => {
  it('bots finish fights holding them all, the log adds up, and a Set is always there', () => {
    const base = { ...createMaxedSave(), skillNodes: {}, equippedArcana: [], upgrades: {} };
    const gambles = ['cursed-idol', 'chain-gang', 'thorn-bush', 'rust', 'tar-pit', 'decoy', 'long-fuse', 'ice-block', 'greedy-chest', 'tightrope', 'hot-potato'];
    for (const id of ['2-3', '3-5', '4-2', '5-3']) {
      for (let i = 0; i < gambles.length; i += 4) {
        const { state } = simulateRun(getLevel(id), { ...base, charms: ['blast-powder', ...gambles.slice(i, i + 4)] }, BOTS.average, 11 + i);
        expect(['won', 'lost']).toContain(state.status);
        expect(state.log.reduce((a, e) => a + e.damage, 0)).toBe(state.totalDamage);
        expect(state.log.every(e => e.setDamage >= 0)).toBe(true);
        expect(state.matches).toBeGreaterThan(3);
      }
    }
  });
});
