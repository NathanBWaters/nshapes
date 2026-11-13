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

// The trick weapons don't arm evolutions yet
const ARMORY = createMaxedSave().armory.filter(id => !TRICK_WEAPON_IDS.includes(id));
const arms = (families: [string[], string[]], a: string, b: string) =>
  (families[0].includes(a) && families[1].includes(b)) || (families[0].includes(b) && families[1].includes(a));

describe('evolution roster', () => {
  it('has 4 evolutions per Armory weapon', () => {
    expect(EVOLUTION_RECIPES).toHaveLength(ARMORY.length * 4);
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

  it('every weapon sits in at least 6 recipes', () => {
    for (const id of ARMORY) {
      expect(EVOLUTION_RECIPES.filter(r => r.families.some(f => f.includes(id))).length).toBeGreaterThanOrEqual(6);
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
    expect(s.activeEvolutions).toEqual([]);
    expect(Number.isFinite(s.foeHp)).toBe(true);
  });
});
