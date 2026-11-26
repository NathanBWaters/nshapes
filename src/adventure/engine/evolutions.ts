/**
 * Evolutions (spec §5): matching the Catalyst starts a 30-second window in
 * which an armed recipe's rules are live. Different recipes can run at once,
 * but a recipe is never re-triggered while it is running (no Catalyst appears
 * unless some armed recipe is idle); triggers per fight are capped.
 */
import type { Card } from '@/types';
import { addPower, addTime, arcana, dealDamage, emit, enqueue, foeMultiplier, idleRecipes, mods, nextCatalystRecipe, refreshSources, signalGrowth, updateCards, type Draft } from './fight';
import { armedRecipesFor, EVOLUTION_RULES, getRecipe } from './sources';
import { fireFinale, fireOpening } from '../rules/engine';

export { nextCatalystRecipe };

export const refreshArmedRecipes = (d: Draft) => {
  d.armedRecipes = d.features.has('evolutions') ? armedRecipesFor(d.weapons, d.unlockedEvolutions) : [];
};

/** `slot` is the Catalyst card it started from, when there was one. */
export const startEvolution = (d: Draft, id: string, slot?: number) => {
  const recipe = getRecipe(id);
  if (!recipe) return;
  const durationMs = Math.max(1000, EVOLUTION_RULES.durationMs + (mods(d).evolutionDurationMs ?? 0));
  d.activeEvolutions = [...d.activeEvolutions.filter(e => e.id !== id), { id, remainingMs: durationMs, durationMs }];
  d.evolutionsTriggered += 1;
  // An evolution surges Power (+1.50), cleanly feeding the C¹ Power multiplier
  addPower(d, EVOLUTION_RULES.power);
  if (!d.forgedRecipes.includes(id)) d.forgedRecipes = [...d.forgedRecipes, id];
  refreshSources(d);
  emit(d, 'evolution_start', durationMs, recipe.name, slot === undefined ? undefined : { slots: [slot] });
  // The opening burst (and the Arcana that makes it bigger), unified with the triggering Set's multipliers
  const burst = arcana(d).evolutionBurstBonus;
  emit(d, 'hit', dealDamage(d, (EVOLUTION_RULES.startDamage + (burst?.damage ?? 0)) * d._setMultiplier * foeMultiplier(d)), recipe.name);
  if (burst && burst.time > 0) addTime(d, burst.time);
  enqueue(d, 'evolutionStart');
};

/** A Set with the Catalyst in it: consume the Catalyst and auto-ignite (1 idle) or offer up to 3 randomly chosen idle evolutions (2+ idle). */
export const resolveCatalyst = (d: Draft, matched: Card[]) => {
  const ids = new Set(matched.map(c => c.id));
  const idx = d.board.findIndex(c => ids.has(c.id) && c.hasEvolutionItem);
  if (idx === -1) return;
  const loadedId = d.catalystRecipeId;
  d.catalystRecipeId = null;
  updateCards(d, [idx], c => ({ ...c, hasEvolutionItem: false, evolutionReady: false }));
  // If this Set already knocked out the final foe (outside endless practice), skip triggering
  // a dead-on-arrival Evolution (no phantom burst, no post-mortem rules, no unnecessary cut-in).
  const finalFoeAlreadyDefeated = !d.level.rules.sandbox && d.foeHp <= 0 && d.wave >= d.level.foes.length - 1;
  if (finalFoeAlreadyDefeated) return;
  if (d.evolutionsTriggered >= d.evolutionCap) return;
  if (d.evolutionPickOptions && d.evolutionPickOptions.length > 0) return;
  const idle = idleRecipes(d);
  if (idle.length === 0) return;
  if (idle.length === 1) {
    const id = loadedId && idle.includes(loadedId) ? loadedId : idle[0];
    // Told first, so what grows on a matched Catalyst (Catalyst Prism) already counts for this evolution
    signalGrowth(d, { on: 'catalyst' });
    startEvolution(d, id, idx);
    return;
  }
  // 2+ idle armed evolutions: draw up to 3 randomly so the player can strategize around luck & synergies
  const choices = d._rng.shuffle(idle).slice(0, 3);
  d.evolutionPickOptions = choices;
  d.evolutionPickContext = { slot: idx, setMultiplier: d._setMultiplier };
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
  const encore = mods(d).encoreDamage ?? 0;
  // Remove expired recipes BEFORE running finales so Paradox finale Catalyst sees the recipe as idle!
  d.activeEvolutions = next.filter(e => e.remainingMs > 0);
  refreshSources(d);
  for (const e of ended) {
    fireFinale(d, e.id);
    if (encore > 0) {
      // Encore Mask: one more hit, and the recipe's opening plays again
      emit(d, 'hit', dealDamage(d, encore * foeMultiplier(d)), 'Encore!');
      fireOpening(d, e.id);
    }
  }
  for (const e of ended) {
    emit(d, 'evolution_end', undefined, getRecipe(e.id)?.name ?? e.id);
    enqueue(d, 'evolutionEnd');
  }
};
