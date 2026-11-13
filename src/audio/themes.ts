/** Recipe id → its evolution theme, from the recipe table (cached). */
import { EVOLUTION_RECIPES } from '@/adventure/data/evolutions';
import { evolutionTheme, type EvolutionTheme } from './voices';

const cache = new Map<string, EvolutionTheme>();

export const themeOf = (recipeId: string): EvolutionTheme => {
  const hit = cache.get(recipeId);
  if (hit) return hit;
  const recipe = EVOLUTION_RECIPES.find(r => r.id === recipeId);
  const theme = evolutionTheme(recipeId, recipe?.families ?? [[recipeId], [recipeId]]);
  cache.set(recipeId, theme);
  return theme;
};

export const RECIPE_IDS: string[] = EVOLUTION_RECIPES.map(r => r.id);
