/**
 * Per-Weapon Timed Evolutions barrel & convenience helpers.
 *
 * Replaces legacy 2-weapon pair recipes (`evolutionPairs.ts`) with 192 bespoke
 * per-weapon timed evolutions (64 Armory weapons × 3 evolutions each).
 */
import type { WeaponEvolutionDef } from '../types';
import {
  EVOLUTION_COUNT,
  EVOLUTION_WEAPON_COUNT,
  WEAPON_EVOLUTIONS,
  WEAPON_EVOLUTION_MAP,
  defaultEvolutionForWeapon,
  evolutionConditionShort,
  evolutionConditionText,
  evolutionShortVerb,
  evolutionsForWeapon,
  formatEvolutionConditionShort,
  formatEvolutionConditionText,
  getWeaponEvolution,
  isWeaponEvolutionId,
} from './weaponEvolutions';

export {
  EVOLUTION_COUNT,
  EVOLUTION_WEAPON_COUNT,
  WEAPON_EVOLUTIONS,
  WEAPON_EVOLUTION_MAP,
  defaultEvolutionForWeapon,
  evolutionConditionShort,
  evolutionConditionText,
  evolutionShortVerb,
  evolutionsForWeapon,
  formatEvolutionConditionShort,
  formatEvolutionConditionText,
  getWeaponEvolution,
  isWeaponEvolutionId,
};

/** Look up a weapon evolution by ID, throwing if unknown. */
export const requireWeaponEvolution = (evoId: string): WeaponEvolutionDef => {
  const def = WEAPON_EVOLUTION_MAP.get(evoId);
  if (!def) throw new Error(`Unknown weapon evolution: ${evoId}`);
  return def;
};

/** Owning Armory weapon ID for an evolution ID (or undefined if unknown). */
export const evolutionWeaponId = (evoId: string): string | undefined =>
  WEAPON_EVOLUTION_MAP.get(evoId)?.weaponId;

/** Variant slot index (`0 | 1 | 2`) for audio themes & UI ordering (defaults to `0`). */
export const weaponEvolutionVariantIndex = (evoId: string): 0 | 1 | 2 =>
  WEAPON_EVOLUTION_MAP.get(evoId)?.slotIndex ?? 0;

/**
 * Resolve the active evolution definition for `weaponId` given an equipped map and
 * optional unlocked list. In Adventure Mode, only unlocked evolutions may arm;
 * when `unlocked` is omitted (e.g., Starfall Summit), falls back to Slot A.
 */
export const resolvedEquippedEvolution = (
  weaponId: string,
  equipped?: Readonly<Record<string, string>>,
  unlocked?: readonly string[],
): WeaponEvolutionDef | undefined => {
  const unlockedSet = unlocked ? new Set(unlocked) : null;
  const isAllowed = (def: WeaponEvolutionDef | undefined): def is WeaponEvolutionDef =>
    !!def && def.weaponId === weaponId && (!unlockedSet || unlockedSet.has(def.id));

  const pickedId = equipped?.[weaponId];
  if (pickedId) {
    const picked = WEAPON_EVOLUTION_MAP.get(pickedId);
    if (isAllowed(picked)) return picked;
  }

  const all = evolutionsForWeapon(weaponId);
  if (unlockedSet) {
    return all.find(e => unlockedSet.has(e.id));
  }
  return all[0];
};
