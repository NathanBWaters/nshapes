/**
 * [GP-21] Armory Loadout Presets & Reordering:
 *  - 3 persistent named Loadout Presets (Burst / Survival / Farm) stored in MMKV
 *    independently of `save.ts`, with backwards-compatible per-weapon
 *    `equippedEvolutions` snapshot/restore.
 *  - Pure `reorderCharmSlots` helper for belt slot left/right reordering (`Understudy`).
 *  - Re-exports `autoBuildLoadout` and `filterAndSortArmory` from `loadout.ts`.
 */
import type { CharacterName } from '@/types';
import { storage } from '@/utils/storage';
import { ARCANA } from './data/arcana';
import {
  arcanaSlotsOf,
  autoBuildLoadout,
  charmSlotsOf,
  fightArcana,
  fightCharms,
  filterAndSortArmory,
  type ArmoryFilterOptions,
  type ArmoryQuickFilter,
  type ArmorySortMode,
  type AutoBuildResult,
} from './loadout';
import type { AdventureSave, ArcanaId } from './types';

export {
  autoBuildLoadout,
  filterAndSortArmory,
  type ArmoryFilterOptions,
  type ArmoryQuickFilter,
  type ArmorySortMode,
  type AutoBuildResult,
};

export const PRESET_SLOT_COUNT = 3;
export const DEFAULT_PRESET_NAMES = ['Burst', 'Survival', 'Farm'] as const;
const PRESETS_STORAGE_KEY = 'adventure_v2_loadout_presets';

export interface LoadoutPreset {
  slot: 0 | 1 | 2;
  name: string;
  fighter: CharacterName;
  charms: string[];
  arcana: ArcanaId[];
  /** Optional snapshot of equipped per-weapon evolutions for the preset's charms */
  equippedEvolutions?: Record<string, string>;
  savedAt: number;
}

const VALID_ARCANA_IDS = new Set<string>(ARCANA.map(a => a.id));

const emptyPresetSlots = (): (LoadoutPreset | null)[] => [null, null, null];

const sanitizeEquippedEvos = (raw: unknown): Record<string, string> | undefined => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  let count = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof k === 'string' && k.length > 0 && typeof v === 'string' && v.length > 0) {
      out[k] = v;
      count++;
    }
  }
  return count > 0 ? out : undefined;
};

const isPresetLike = (v: unknown): v is LoadoutPreset => {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return (
    (o.slot === 0 || o.slot === 1 || o.slot === 2) &&
    typeof o.name === 'string' &&
    typeof o.fighter === 'string' &&
    Array.isArray(o.charms) &&
    o.charms.every(c => typeof c === 'string') &&
    Array.isArray(o.arcana) &&
    o.arcana.every(a => typeof a === 'string')
  );
};

export const loadLoadoutPresets = (): (LoadoutPreset | null)[] => {
  try {
    const raw = storage.getString(PRESETS_STORAGE_KEY);
    if (!raw) return emptyPresetSlots();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return emptyPresetSlots();
    const out = emptyPresetSlots();
    for (let i = 0; i < PRESET_SLOT_COUNT; i++) {
      const item = parsed[i];
      if (isPresetLike(item)) {
        const equippedEvolutions = sanitizeEquippedEvos(item.equippedEvolutions);
        out[i] = {
          slot: i as 0 | 1 | 2,
          name: item.name,
          fighter: item.fighter,
          charms: [...item.charms],
          arcana: [...item.arcana],
          savedAt: typeof item.savedAt === 'number' && Number.isFinite(item.savedAt) ? item.savedAt : 0,
          ...(equippedEvolutions ? { equippedEvolutions } : {}),
        };
      }
    }
    return out;
  } catch {
    return emptyPresetSlots();
  }
};

const writePresets = (presets: (LoadoutPreset | null)[]): void => {
  try {
    storage.set(PRESETS_STORAGE_KEY, JSON.stringify(presets));
  } catch {
    // Ignore storage write errors in restricted / test environments
  }
};

export const saveLoadoutPreset = (
  slot: 0 | 1 | 2,
  save: AdventureSave,
  name?: string
): (LoadoutPreset | null)[] => {
  const next = loadLoadoutPresets();
  const resolvedName = (name ?? next[slot]?.name ?? DEFAULT_PRESET_NAMES[slot]).trim() || DEFAULT_PRESET_NAMES[slot];
  const charms = [...fightCharms(save)];
  const equippedEvolutions: Record<string, string> = {};
  for (const wId of charms) {
    const evoId = save.equippedEvolutions?.[wId];
    if (typeof evoId === 'string' && evoId.length > 0) {
      equippedEvolutions[wId] = evoId;
    }
  }
  next[slot] = {
    slot,
    name: resolvedName,
    fighter: save.selectedFighter,
    charms,
    arcana: [...fightArcana(save)],
    ...(Object.keys(equippedEvolutions).length > 0 ? { equippedEvolutions } : {}),
    savedAt: Date.now(),
  };
  writePresets(next);
  return next;
};

export const clearLoadoutPreset = (slot: 0 | 1 | 2): (LoadoutPreset | null)[] => {
  const next = loadLoadoutPresets();
  next[slot] = null;
  writePresets(next);
  return next;
};

/** Apply a saved preset safely against the player's currently unlocked inventory, evolutions, and slot limits. */
export const applyLoadoutPreset = (save: AdventureSave, preset: LoadoutPreset): AdventureSave => {
  const fighter = save.unlockedFighters.includes(preset.fighter)
    ? preset.fighter
    : save.selectedFighter;
  const maxCharms = charmSlotsOf(save);
  const ownedSet = new Set(save.armory);
  const charms: string[] = [];
  for (const id of preset.charms) {
    if (ownedSet.has(id) && !charms.includes(id) && charms.length < maxCharms) {
      charms.push(id);
    }
  }
  const maxArc = arcanaSlotsOf(save);
  const unlockedArc = new Set<string>(save.unlockedArcana);
  const arcana: ArcanaId[] = [];
  for (const id of preset.arcana) {
    if (VALID_ARCANA_IDS.has(id) && unlockedArc.has(id) && !arcana.includes(id) && arcana.length < maxArc) {
      arcana.push(id);
    }
  }
  // Merge valid unlocked per-weapon evolutions from preset without clobbering unrelated weapons
  const unlockedEvos = new Set<string>(save.unlockedWeaponEvolutions ?? []);
  const equippedEvolutions: Record<string, string> = { ...(save.equippedEvolutions ?? {}) };
  if (preset.equippedEvolutions) {
    for (const [weaponId, evoId] of Object.entries(preset.equippedEvolutions)) {
      if (ownedSet.has(weaponId) && unlockedEvos.has(evoId) && evoId.startsWith(`${weaponId}:`)) {
        equippedEvolutions[weaponId] = evoId;
      }
    }
  }
  return {
    ...save,
    selectedFighter: fighter,
    charms,
    equippedArcana: arcana,
    equippedEvolutions,
  };
};

/** Move an equipped charm from `fromIndex` to `toIndex`, preserving belt order (key for `Understudy`). */
export const reorderCharmSlots = (
  save: AdventureSave,
  fromIndex: number,
  toIndex: number
): AdventureSave => {
  const charms = [...fightCharms(save)];
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= charms.length ||
    toIndex >= charms.length ||
    fromIndex === toIndex
  ) {
    return save;
  }
  const [moved] = charms.splice(fromIndex, 1);
  charms.splice(toIndex, 0, moved);
  return { ...save, charms };
};
