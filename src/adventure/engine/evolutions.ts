/**
 * Evolutions (spec §5): matching the Catalyst starts a 30-second window in
 * which an armed recipe's rules are live. Several can run at once; triggers
 * per fight are capped.
 */
import type { Card } from '@/types';
import { EVOLUTION_RECIPES } from '../data/evolutions';
import { addTime, arcana, dealDamage, emit, enqueue, foeMultiplier, mods, refreshSources, updateCards, type Draft } from './fight';
import { armedRecipesFor, EVOLUTION_RULES, getRecipe } from './sources';
import { fireFinale, fireOpening } from '../rules/engine';

export const refreshArmedRecipes = (d: Draft) => {
  d.armedRecipes = d.features.has('evolutions') ? armedRecipesFor(d.weapons, d.unlockedEvolutions) : [];
};

/**
 * The recipe a Catalyst starts: the first armed one (recipe order) that isn't
 * running; if all are running, the one closest to ending is refreshed.
 */
const recipeToStart = (d: Draft): string | null => {
  const ordered = EVOLUTION_RECIPES.map(r => r.id).filter(id => d.armedRecipes.includes(id));
  if (ordered.length === 0) return null;
  const idle = ordered.find(id => !d.activeEvolutions.some(e => e.id === id));
  if (idle) return idle;
  return [...d.activeEvolutions].sort((a, b) => a.remainingMs - b.remainingMs)[0].id;
};

/** `slot` is the Catalyst card it started from, when there was one. */
export const startEvolution = (d: Draft, id: string, slot?: number) => {
  const recipe = getRecipe(id);
  if (!recipe) return;
  const durationMs = Math.max(1000, EVOLUTION_RULES.durationMs + (mods(d).evolutionDurationMs ?? 0));
  d.activeEvolutions = [...d.activeEvolutions.filter(e => e.id !== id), { id, remainingMs: durationMs, durationMs }];
  d.evolutionsTriggered += 1;
  if (!d.forgedRecipes.includes(id)) d.forgedRecipes = [...d.forgedRecipes, id];
  refreshSources(d);
  emit(d, 'evolution_start', durationMs, recipe.name, slot === undefined ? undefined : { slots: [slot] });
  // The opening burst (and the Arcana that makes it bigger)
  const burst = arcana(d).evolutionBurstBonus;
  emit(d, 'hit', dealDamage(d, (EVOLUTION_RULES.startDamage + (burst?.damage ?? 0)) * foeMultiplier(d)), recipe.name);
  if (burst && burst.time > 0) addTime(d, burst.time);
  enqueue(d, 'evolutionStart');
};

/** A Set with the Catalyst in it: consume the Catalyst and start an evolution if the cap allows. */
export const resolveCatalyst = (d: Draft, matched: Card[]) => {
  const ids = new Set(matched.map(c => c.id));
  const idx = d.board.findIndex(c => ids.has(c.id) && c.hasEvolutionItem);
  if (idx === -1) return;
  updateCards(d, [idx], c => ({ ...c, hasEvolutionItem: false, evolutionReady: false }));
  if (d.evolutionsTriggered >= d.evolutionCap) return;
  const id = recipeToStart(d);
  if (id) startEvolution(d, id, idx);
};

export const extendEvolutions = (d: Draft, ms: number) => {
  if (ms <= 0 || d.activeEvolutions.length === 0) return;
  d.activeEvolutions = d.activeEvolutions.map(e => ({ ...e, remainingMs: e.remainingMs + ms, durationMs: e.durationMs + ms }));
};

export const tickEvolutions = (d: Draft, ms: number) => {
  if (d.activeEvolutions.length === 0) return;
  const next = d.activeEvolutions.map(e => ({ ...e, remainingMs: e.remainingMs - ms }));
  const ended = next.filter(e => e.remainingMs <= 0);
  if (ended.length === 0) {
    d.activeEvolutions = next;
    return;
  }
  // Finales fire while the ending evolution's rules are still live
  d.activeEvolutions = next;
  const encore = mods(d).encoreDamage ?? 0;
  for (const e of ended) {
    fireFinale(d, e.id);
    if (encore > 0) {
      // Encore Mask: one more hit, and the recipe's opening plays again
      emit(d, 'hit', dealDamage(d, encore * foeMultiplier(d)), 'Encore!');
      fireOpening(d, e.id);
    }
  }
  d.activeEvolutions = next.filter(e => e.remainingMs > 0);
  refreshSources(d);
  for (const e of ended) {
    emit(d, 'evolution_end', undefined, getRecipe(e.id)?.name ?? e.id);
    enqueue(d, 'evolutionEnd');
  }
};
