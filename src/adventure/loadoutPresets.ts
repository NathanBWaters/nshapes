/**
 * [GP-21] Armory Loadout Helpers:
 *  - 3 persistent named Loadout Presets (Burst / Survival / Farm) stored in MMKV
 *    independently of `save.ts`.
 *  - Pure `reorderCharmSlots` helper for belt slot left/right reordering (`Understudy`).
 *  - 1-tap `autoBuildLoadout(save, level)` foe-aware & evolution-aware builder.
 *  - Shared `filterAndSortArmory` helper for all 64 Armory weapons across Camp & LevelPreview.
 */
import type { CharacterName, Weapon } from '@/types';
import { storage } from '@/utils/storage';
import { SPIRE_CLASH_PAIRS } from '@/spire/engine/bridge';
import { ARCANA } from './data/arcana';
import { UNDERSTUDY_ID } from './data/adventureWeapons';
import { getArmoryWeapon } from './data/armory';
import { EVOLUTION_RECIPES } from './data/evolutions';
import { foeDisplay } from './data/foes';
import { weaponRole, type WeaponRole } from './data/weaponRoles';
import {
  arcanaSlots,
  charmSlots,
  charmSynergyWithEquipped,
  equippedArcanaOf,
  equippedCharms,
  weaponBuilds,
  weaponLevel,
} from './progress';
import type { AdventureSave, ArcanaId, LevelDef } from './types';

export const PRESET_SLOT_COUNT = 3;
export const DEFAULT_PRESET_NAMES = ['Burst', 'Survival', 'Farm'] as const;
const PRESETS_STORAGE_KEY = 'adventure_v2_loadout_presets';

export interface LoadoutPreset {
  slot: 0 | 1 | 2;
  name: string;
  fighter: CharacterName;
  charms: string[];
  arcana: ArcanaId[];
  savedAt: number;
}

const VALID_ARCANA_IDS = new Set<string>(ARCANA.map(a => a.id));

const emptyPresetSlots = (): (LoadoutPreset | null)[] => [null, null, null];

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
        out[i] = { ...item, slot: i as 0 | 1 | 2 };
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
  next[slot] = {
    slot,
    name: resolvedName,
    fighter: save.selectedFighter,
    charms: [...equippedCharms(save)],
    arcana: [...equippedArcanaOf(save)],
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

/** Apply a saved preset safely against the player's currently unlocked inventory and slot limits. */
export const applyLoadoutPreset = (save: AdventureSave, preset: LoadoutPreset): AdventureSave => {
  const fighter = save.unlockedFighters.includes(preset.fighter)
    ? preset.fighter
    : save.selectedFighter;
  const maxCharms = charmSlots(save);
  const ownedSet = new Set(save.armory);
  const charms: string[] = [];
  for (const id of preset.charms) {
    if (ownedSet.has(id) && !charms.includes(id) && charms.length < maxCharms) {
      charms.push(id);
    }
  }
  const maxArc = arcanaSlots(save);
  const unlockedArc = new Set<string>(save.unlockedArcana);
  const arcana: ArcanaId[] = [];
  for (const id of preset.arcana) {
    if (VALID_ARCANA_IDS.has(id) && unlockedArc.has(id) && !arcana.includes(id) && arcana.length < maxArc) {
      arcana.push(id);
    }
  }
  return {
    ...save,
    selectedFighter: fighter,
    charms,
    equippedArcana: arcana,
  };
};

/** Move an equipped charm from `fromIndex` to `toIndex`, preserving belt order (key for `Understudy`). */
export const reorderCharmSlots = (
  save: AdventureSave,
  fromIndex: number,
  toIndex: number
): AdventureSave => {
  const charms = [...equippedCharms(save)];
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

const inFamily = (id: string, family: readonly string[]): boolean =>
  family.some(prefix => id === prefix || id.startsWith(`${prefix}-`));

const clashesWithSelected = (selected: readonly string[], candidate: string): boolean =>
  SPIRE_CLASH_PAIRS.some(
    pair =>
      (pair.a === candidate && selected.includes(pair.b)) ||
      (pair.b === candidate && selected.includes(pair.a))
  );

const TIME_ONLY_WEAPONS = new Set(['chrono-shard', 'time-drop', 'temporal-rift', 'echo-chamber']);
const BLAST_CLEAR_WEAPONS = new Set(['blast-powder', 'prismatic-ray', 'flint-spark', 'chaos-shard', 'echo-stone']);
const SURVIVAL_WEAPONS = new Set(['mending-charm', 'life-vessel', 'life-link', 'second-chance', 'fortune-token']);

export interface AutoBuildResult {
  save: AdventureSave;
  summary: string;
  armedEvolution: string | null;
}

/**
 * [GP-21] 1-tap "Auto-Equip for Foe": inspects owned Armory weapons, levels,
 * armed Evolutions, `SPIRE_CLASH_PAIRS`, and upcoming level rules/foe abilities
 * to equip a cohesive belt with zero clashing gambles and proper `Understudy` placement.
 */
export const autoBuildLoadout = (save: AdventureSave, level?: LevelDef | null): AutoBuildResult => {
  const slots = charmSlots(save);
  const owned = [...new Set(save.armory)].filter(id => Boolean(getArmoryWeapon(id)));
  if (slots <= 0 || owned.length === 0) {
    return { save, summary: 'No Armory weapons to equip yet.', armedEvolution: null };
  }

  const untimed = Boolean(level && !level.rules.timer && !level.rules.sandbox);
  const hasHazards = Boolean(level?.rules.hazards?.timeBombs || level?.rules.hazards?.snares);
  const foeTexts = (level?.foes ?? [])
    .map(f => `${f.enemy ?? ''} ${foeDisplay(f).ability ?? ''}`.toLowerCase())
    .join(' ');
  const wantsBoardClear = hasHazards || /dud|lock|clog|face-down|stone|bomb|snare/.test(foeTexts);
  const highPressure = Boolean(level && (level.isBoss || level.difficulty >= 4 || hasHazards));

  const weaponScore = (id: string): number => {
    let score = weaponLevel(save, id) * 14;
    const role = weaponRole(id);
    if (role === 'damage') score += 12;
    else if (role === 'chains' || role === 'board') score += 8;
    else if (role === 'tricks') score += 6;
    else if (role === 'survival') score += highPressure ? 11 : 4;
    else if (role === 'tempo') score += 5;
    else if (role === 'insight') score += 5;
    else if (role === 'gambles') score += 2;

    if (untimed && TIME_ONLY_WEAPONS.has(id)) score -= 25;
    if (wantsBoardClear && BLAST_CLEAR_WEAPONS.has(id)) score += 10;
    if (highPressure && SURVIVAL_WEAPONS.has(id)) score += 7;
    if (foeTexts.includes('fire') && foeTexts.includes('reduce') && id === 'flint-spark') score -= 18;
    if (foeTexts.includes('blast') && foeTexts.includes('reduce') && id === 'blast-powder') score -= 18;
    if (foeTexts.includes('laser') && foeTexts.includes('reduce') && id === 'prismatic-ray') score -= 18;
    if (id === UNDERSTUDY_ID) score += 4;
    return score;
  };

  const chosen: string[] = [];
  let armedEvolution: string | null = null;

  // 1. If evolutions are unlocked and we have >=2 slots, pick the highest-scoring non-clashing Evolution pair
  if (slots >= 2 && (save.unlockedEvolutions.length > 0 || save.discoveredEvolutions.length > 0)) {
    let bestPair: { a: string; b: string; name: string; score: number } | null = null;
    for (const recipe of EVOLUTION_RECIPES) {
      const known =
        save.unlockedEvolutions.includes(recipe.id) ||
        save.discoveredEvolutions.includes(recipe.id);
      const aCandidates = owned
        .filter(id => id !== UNDERSTUDY_ID && inFamily(id, recipe.families[0]))
        .sort((x, y) => weaponScore(y) - weaponScore(x));
      const bCandidates = owned
        .filter(id => id !== UNDERSTUDY_ID && inFamily(id, recipe.families[1]))
        .sort((x, y) => weaponScore(y) - weaponScore(x));
      if (aCandidates.length === 0 || bCandidates.length === 0) continue;
      for (const a of aCandidates.slice(0, 2)) {
        for (const b of bCandidates.slice(0, 2)) {
          if (a === b || clashesWithSelected([a], b)) continue;
          const total = weaponScore(a) + weaponScore(b) + (known ? 20 : 12);
          if (!bestPair || total > bestPair.score) {
            bestPair = { a, b, name: known ? recipe.name : 'an Evolution', score: total };
          }
        }
      }
    }
    if (bestPair) {
      chosen.push(bestPair.a, bestPair.b);
      armedEvolution = bestPair.name;
    }
  }

  // 2. Fill remaining belt slots with highest-scoring non-clashing weapons
  const ranked = [...owned].sort((a, b) => weaponScore(b) - weaponScore(a) || a.localeCompare(b));
  for (const id of ranked) {
    if (chosen.length >= slots) break;
    if (chosen.includes(id)) continue;
    if (id === UNDERSTUDY_ID && chosen.length === 0) continue;
    if (clashesWithSelected(chosen, id)) continue;
    chosen.push(id);
  }
  // Fallback if clash pruning left slots empty
  for (const id of ranked) {
    if (chosen.length >= slots) break;
    if (!chosen.includes(id)) chosen.push(id);
  }

  // 3. Ensure `understudy` sits directly to the right of the strongest non-understudy charm (never slot 0!)
  const uIdx = chosen.indexOf(UNDERSTUDY_ID);
  if (uIdx >= 0 && chosen.length >= 2) {
    chosen.splice(uIdx, 1);
    let bestAnchor = 0;
    let bestAnchorScore = -Infinity;
    chosen.forEach((id, idx) => {
      const s = weaponScore(id);
      if (s > bestAnchorScore) {
        bestAnchorScore = s;
        bestAnchor = idx;
      }
    });
    chosen.splice(bestAnchor + 1, 0, UNDERSTUDY_ID);
  }

  const nextSave: AdventureSave = { ...save, charms: chosen.slice(0, slots) };
  const evoNote = armedEvolution ? ` (arms ${armedEvolution})` : '';
  const summary = `Auto-equipped ${nextSave.charms.length} weapon${nextSave.charms.length === 1 ? '' : 's'}${evoNote}`;
  return { save: nextSave, summary, armedEvolution };
};

export type ArmoryQuickFilter = 'all' | 'fuses' | 'equipped' | 'lv2plus';
export type ArmorySortMode = 'shelves' | 'fuses' | 'level' | 'az';

export interface ArmoryFilterOptions {
  quick: ArmoryQuickFilter;
  role: WeaponRole | 'all';
  query: string;
  sort: ArmorySortMode;
}

/** Shared filter & sort pipeline for all 64 Armory weapons across Camp and LevelPreview. */
export const filterAndSortArmory = (
  save: AdventureSave,
  options: ArmoryFilterOptions
): Weapon[] => {
  const builds = weaponBuilds(save);
  const charms = equippedCharms(save);
  const q = options.query.trim().toLowerCase();

  const items: Weapon[] = [];
  for (const id of save.armory) {
    const w = getArmoryWeapon(id, builds);
    if (!w) continue;
    const isEquipped = charms.includes(id);
    const lvl = weaponLevel(save, id);
    const fuses = !isEquipped && Boolean(charmSynergyWithEquipped(save, id));

    if (options.quick === 'fuses' && !fuses) continue;
    if (options.quick === 'equipped' && !isEquipped) continue;
    if (options.quick === 'lv2plus' && lvl < 2) continue;
    if (options.role !== 'all' && weaponRole(id) !== options.role) continue;
    if (q.length > 0) {
      const hay = `${w.name} ${w.shortDescription} ${w.description} ${weaponRole(id)}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    items.push(w);
  }

  if (options.sort === 'shelves') {
    return items;
  }

  return [...items].sort((a, b) => {
    if (options.sort === 'az') {
      return a.name.localeCompare(b.name);
    }
    const lvlA = weaponLevel(save, a.id);
    const lvlB = weaponLevel(save, b.id);
    if (options.sort === 'level') {
      return lvlB - lvlA || a.name.localeCompare(b.name);
    }
    // 'fuses': fusing unequipped weapons first, then equipped, then higher level, then A-Z
    const eqA = charms.includes(a.id);
    const eqB = charms.includes(b.id);
    const fuseA = !eqA && Boolean(charmSynergyWithEquipped(save, a.id)) ? 2 : eqA ? 1 : 0;
    const fuseB = !eqB && Boolean(charmSynergyWithEquipped(save, b.id)) ? 2 : eqB ? 1 : 0;
    return fuseB - fuseA || lvlB - lvlA || a.name.localeCompare(b.name);
  });
};
