/**
 * The evolution roster: 4 evolutions per Armory weapon, every pair arms at
 * most one recipe, and every recipe forges and runs in a real fight.
 */
import { EVOLUTION_RECIPES, SIGNATURE_RECIPES } from '@/adventure/data/evolutions';
import { PAIR_RECIPES } from '@/adventure/data/evolutionPairs';
import { TRICK_WEAPON_IDS } from '@/adventure/data/adventureWeapons';
import { createMaxedSave } from '@/adventure/progress';
import { runReducer } from '@/adventure/engine/run';
import { findSet, miss, playSet, startFight, tick } from './testUtils/adventureFight';
import type { RunState } from '@/adventure/types';

const ARMORY = createMaxedSave().armory;
/** The classic weapons have 4 recipes each (about 8 they sit in); the trick weapons have 2 each (3 they sit in) */
const CLASSIC = ARMORY.filter(id => !TRICK_WEAPON_IDS.includes(id));
const arms = (families: [string[], string[]], a: string, b: string) =>
  (families[0].includes(a) && families[1].includes(b)) || (families[0].includes(b) && families[1].includes(a));

describe('evolution roster', () => {
  it('has 4 evolutions per classic weapon and 2 per trick weapon', () => {
    expect(EVOLUTION_RECIPES).toHaveLength(CLASSIC.length * 4 + TRICK_WEAPON_IDS.length * 2);
    expect(SIGNATURE_RECIPES.length + PAIR_RECIPES.length).toBe(EVOLUTION_RECIPES.length);
  });

  it('ids, names and icons are unique, and every recipe has rules or modifiers', () => {
    for (const key of ['id', 'name', 'icon'] as const) {
      expect(new Set(EVOLUTION_RECIPES.map(r => r[key])).size).toBe(EVOLUTION_RECIPES.length);
    }
    for (const r of EVOLUTION_RECIPES) {
      expect((r.source.rules?.length ?? 0) + Object.keys(r.source.modifiers ?? {}).length).toBeGreaterThan(0);
      expect(r.activeText.length).toBeLessThanOrEqual(130);
    }
  });

  it('pair recipes use two different Armory weapons, and no pair of weapons arms two recipes', () => {
    for (const p of PAIR_RECIPES) {
      const [[a], [b]] = p.families;
      expect(ARMORY).toContain(a);
      expect(ARMORY).toContain(b);
      expect(a).not.toBe(b);
      expect(EVOLUTION_RECIPES.filter(r => arms(r.families, a, b)).map(r => r.id)).toEqual([p.id]);
    }
  });

  it('every classic weapon sits in at least 6 recipes and every trick weapon in at least 3', () => {
    for (const id of ARMORY) {
      const n = EVOLUTION_RECIPES.filter(r => r.families.some(f => f.includes(id))).length;
      expect({ id, enough: n >= (TRICK_WEAPON_IDS.includes(id) ? 3 : 6) }).toEqual({ id, enough: true });
    }
  });
});

describe('every evolution runs', () => {
  const catalystOn = (s: RunState): RunState => {
    const set = findSet(s)!;
    return { ...s, board: s.board.map(c => (c.id === set[0].id ? { ...c, hasEvolutionItem: true, evolutionReady: true } : c)) };
  };

  it.each(PAIR_RECIPES.map(r => [r.id, r] as const))('%s forges from its two weapons and runs to its finale', (_id, r) => {
    const held = [r.families[0][0], r.families[1][0]];
    // Knowing any recipe arms them all
    let s = startFight({ save: { armory: held, charms: held, unlockedEvolutions: ['phoenix-pyre'] } });
    expect(s.armedRecipes).toEqual([r.id]);
    s = catalystOn(s);
    s = playSet(s, findSet(s, set => set.some(c => c.hasEvolutionItem))!);
    expect(s.activeEvolutions.map(e => e.id)).toEqual([r.id]);
    expect(s.forgedRecipes).toContain(r.id);
    for (let i = 0; i < 4 && s.status === 'playing'; i++) s = playSet(tick(s, 3000, 1000));
    if (s.status === 'playing') s = miss(s);
    if (s.status === 'playing') s = runReducer(s, { type: 'USE_HINT' });
    s = tick(s, 35000, 1000); // freezes pause the evolution clock too
    // (a fight that ended on the way, e.g. thorns on a Devil's Bargain, stops its clock)
    if (s.status === 'playing') expect(s.activeEvolutions).toEqual([]);
    expect(Number.isFinite(s.foeHp)).toBe(true);
  });
});
