/** Evolution id → its weapon-anchored evolution theme, from the 192-evolution catalog (cached). */
import { WEAPON_EVOLUTIONS, getWeaponEvolution } from '@/adventure/data/evolutions';
import { evolutionTheme, type EvolutionTheme, type EvolutionVariantIndex } from './voices';

const cache = new Map<string, EvolutionTheme>();

export const themeOf = (evoId: string): EvolutionTheme => {
  const hit = cache.get(evoId);
  if (hit) return hit;
  const evo = getWeaponEvolution(evoId);
  const weaponId = evo?.weaponId ?? (evoId.includes(':') ? evoId.slice(0, evoId.indexOf(':')) : evoId);
  const variantIndex: EvolutionVariantIndex = evo?.slotIndex ?? 0;
  const theme = evolutionTheme(evoId, weaponId, variantIndex);
  cache.set(evoId, theme);
  return theme;
};

export const EVOLUTION_IDS: string[] = WEAPON_EVOLUTIONS.map(e => e.id);
/** Back-compat alias kept for console debug helpers (`src/audio/index.ts`). */
export const RECIPE_IDS: string[] = EVOLUTION_IDS;
