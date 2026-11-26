/**
 * Looks up any weapon the adventure can hand out (the 32 shared weapons and the
 * 32 adventure-only ones = 64 Armory weapons) at its build: level found in the
 * world and Workshop tuning (data/weaponStats.ts, weaponLevels.ts).
 *
 * Zero duplicate IDs and zero silent shadowing ([TP-10]): Free-Play-only
 * definitions stay cleanly isolated in `FREE_PLAY_ONLY_DEFINITIONS`.
 */
import type { Weapon } from '@/types';
import { FREE_PLAY_ONLY_DEFINITIONS, LEGACY_WEAPON_IDS, SHARED_WEAPONS } from '@/utils/gameDefinitions';
import type { AdventureWeapon } from '../types';
import type { RuleSource } from '../rules/types';
import { ADVENTURE_WEAPONS, LEGACY_ADVENTURE_WEAPON_IDS, UNDERSTUDY_ID } from './adventureWeapons';
import { BASE_BUILD, buildWeapon, type WeaponBuilds } from './weaponStats';
import { ADVENTURE_TUNING } from './weaponTuning';

/** Free Play weapons Adventure never hands out: their effect only exists in the Free Play game loop. */
export const FREE_PLAY_ONLY_WEAPONS: readonly string[] = FREE_PLAY_ONLY_DEFINITIONS.map(w => w.id);

export const findAdventureWeapon = (id: string): AdventureWeapon | undefined => ADVENTURE_WEAPONS.find(w => w.id === id);

/** A Free Play shared weapon with Adventure's numbers (data/weaponTuning.ts). */
const tuned = (w: Weapon): Weapon => {
  const t = ADVENTURE_TUNING[w.id];
  if (!t) return w;
  const { bridgeChance, ...effects } = t.effects ?? {};
  return {
    ...w,
    effects: { ...w.effects, ...effects } as Weapon['effects'],
    perLevel: { ...w.perLevel, ...t.perLevel },
    ...(w.bridgeEffect && bridgeChance !== undefined ? { bridgeEffect: { ...w.bridgeEffect, chance: bridgeChance } } : {}),
  };
};

const TUNED_SHARED: readonly Weapon[] = SHARED_WEAPONS.map(tuned);

/**
 * Canonical flat lookup across all 64 Armory weapons with zero silent shadowing.
 * Throws immediately on duplicate weapon IDs so collisions cannot hide.
 */
const ARMORY_BASE_MAP: ReadonlyMap<string, Weapon> = (() => {
  const map = new Map<string, Weapon>();
  for (const w of [...TUNED_SHARED, ...ADVENTURE_WEAPONS]) {
    if (map.has(w.id)) {
      throw new Error(`Duplicate Armory weapon id detected: "${w.id}"`);
    }
    map.set(w.id, w);
  }
  return map;
})();

/** Single source of truth for every valid Armory weapon id across Adventure Mode and Starfall Spire (64 weapons). */
export const ALL_ARMORY_WEAPON_IDS: readonly string[] = [...ARMORY_BASE_MAP.keys()];

/** The authored weapon at level 1 (direct canonical lookup, zero silent shadowing). */
export const armoryBaseWeapon = (id: string): Weapon | undefined => ARMORY_BASE_MAP.get(id);

/** Weapon `id` at its build in `builds` (absent = level 1, untuned). */
export const getArmoryWeapon = (id: string, builds?: WeaponBuilds, grown?: Readonly<Record<string, number>>): Weapon | undefined => {
  const base = armoryBaseWeapon(id);
  return base ? buildWeapon(base, builds?.[id] ?? BASE_BUILD, grown) : undefined;
};

/**
 * The Understudy standing in for `leftId`: the Understudy item with that
 * weapon's numbers, rules and wording at the higher of the Understudy's level
 * and the copied charm's level, untuned. It keeps its own id, so it never arms
 * the copied weapon's evolutions.
 */
export const understudyOf = (understudy: Weapon, leftId: string | undefined, builds?: WeaponBuilds): Weapon => {
  if (!leftId || leftId === UNDERSTUDY_ID) return understudy;
  const understudyLevel = builds?.[UNDERSTUDY_ID]?.level ?? 1;
  const leftLevel = builds?.[leftId]?.level ?? 1;
  const level = Math.max(understudyLevel, leftLevel);
  const copy = getArmoryWeapon(leftId, { [leftId]: { level, tuning: {} } }) as AdventureWeapon | undefined;
  if (!copy) return understudy;
  return {
    ...understudy,
    effects: copy.effects,
    specialEffect: copy.specialEffect,
    bridgeEffect: copy.bridgeEffect,
    rules: copy.rules,
    modifiers: copy.modifiers,
    description: `Copying ${copy.name} at level ${level}: ${copy.description}`,
    shortDescription: `${copy.name} again (Lv ${level}): ${copy.shortDescription}`,
  } as Weapon;
};

/** The weapons these charm ids bring into a fight, in slot order (an Understudy copies the charm to its left). */
export const charmWeapons = (ids: readonly string[], builds?: WeaponBuilds): Weapon[] =>
  ids
    .map((id, i) => {
      const w = getArmoryWeapon(id, builds);
      return w && id === UNDERSTUDY_ID ? understudyOf(w, ids[i - 1], builds) : w;
    })
    .filter((w): w is Weapon => !!w);

/** The rules a held weapon brings into a fight (plain Free Play weapons bring none). */
export const weaponRuleSource = (w: Weapon): RuleSource => {
  const a = w as AdventureWeapon;
  return { rules: a.rules, modifiers: a.modifiers };
};

/**
 * Where an id from an older save went: the weapon it is now and the level
 * floor (`tier` = level - 1) that old copy stands for. null: the weapon was
 * removed. Current ids map to themselves at tier 0.
 */
export const resolveLegacyWeapon = (id: string): { id: string; tier: number } | null => {
  if (id in LEGACY_WEAPON_IDS) return LEGACY_WEAPON_IDS[id];
  if (id in LEGACY_ADVENTURE_WEAPON_IDS) return LEGACY_ADVENTURE_WEAPON_IDS[id];
  return { id, tier: 0 };
};

/** Shown after a weapon's name once it is above level 1 (" Lv 3"). */
export const weaponLevelSuffix = (level: number): string => (level > 1 ? ` Lv ${level}` : '');
