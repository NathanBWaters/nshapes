/**
 * Looks up any weapon the adventure can hand out (Free Play weapons and the
 * adventure-only ones) at its build: level found in the world and Workshop
 * tuning (data/weaponStats.ts, weaponLevels.ts).
 */
import type { Weapon } from '@/types';
import { LEGACY_WEAPON_IDS, WEAPONS } from '@/utils/gameDefinitions';
import type { AdventureWeapon } from '../types';
import type { RuleSource } from '../rules/types';
import { ADVENTURE_WEAPONS, LEGACY_ADVENTURE_WEAPON_IDS } from './adventureWeapons';
import { BASE_BUILD, buildWeapon, type WeaponBuilds } from './weaponStats';
import { ADVENTURE_TUNING } from './weaponTuning';

/** Free Play weapons Adventure never hands out: their effect only exists in the Free Play game loop. */
export const FREE_PLAY_ONLY_WEAPONS: readonly string[] = ['sympathetic-flames'];

export const findAdventureWeapon = (id: string): AdventureWeapon | undefined => ADVENTURE_WEAPONS.find(w => w.id === id);

/** A Free Play weapon with Adventure's numbers (data/weaponTuning.ts). */
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
const TUNED: Weapon[] = WEAPONS.filter(w => !FREE_PLAY_ONLY_WEAPONS.includes(w.id)).map(tuned);

/** The authored weapon at level 1 (an adventure version wins over a Free Play one with the same id). */
export const armoryBaseWeapon = (id: string): Weapon | undefined => findAdventureWeapon(id) ?? TUNED.find(w => w.id === id);

/** Weapon `id` at its build in `builds` (absent = level 1, untuned). */
export const getArmoryWeapon = (id: string, builds?: WeaponBuilds): Weapon | undefined => {
  const base = armoryBaseWeapon(id);
  return base ? buildWeapon(base, builds?.[id] ?? BASE_BUILD) : undefined;
};

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
