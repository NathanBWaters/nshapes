/**
 * Looks up any weapon the adventure can hand out (Free Play weapons and the
 * adventure-only ones) at its upgrade tier (Workshop tiers plus free reward
 * upgrades; see `weaponTiers` in progress.ts).
 */
import type { Weapon } from '@/types';
import { LEGACY_WEAPON_IDS, WEAPONS } from '@/utils/gameDefinitions';
import type { AdventureWeapon } from '../types';
import type { RuleSource } from '../rules/types';
import { ADVENTURE_WEAPONS, LEGACY_ADVENTURE_WEAPON_IDS } from './adventureWeapons';
import { applyWeaponUpgradeTier, describeWeaponUpgradeBonus, MAX_WEAPON_UPGRADE_TIER } from './upgrades';

/** A rule weapon at upgrade tier `tier` (0 = level 1): its level's rules and modifiers, and what changed. */
const upgradeAdventureWeapon = (w: AdventureWeapon, tier: number): AdventureWeapon => {
  const level = w.levels?.[Math.min(tier, MAX_WEAPON_UPGRADE_TIER) - 1];
  const withStats: AdventureWeapon = Object.values(w.effects).some(v => typeof v === 'number' && v > 0)
    ? { ...w, ...applyWeaponUpgradeTier(w, tier) }
    : w;
  if (!level) return withStats;
  return {
    ...withStats,
    ...(level.rules ? { rules: level.rules } : {}),
    ...(level.modifiers ? { modifiers: level.modifiers } : {}),
    shortDescription: `${withStats.shortDescription} (${level.text})`,
  };
};

export const findAdventureWeapon = (id: string): AdventureWeapon | undefined => ADVENTURE_WEAPONS.find(w => w.id === id);

/** Weapon `id` at its tier in `weaponTiers` (absent = level 1). */
export const getArmoryWeapon = (id: string, weaponTiers?: Record<string, number>): Weapon | undefined => {
  const tier = weaponTiers?.[id] ?? 0;
  const adventure = findAdventureWeapon(id);
  if (adventure) return tier > 0 ? upgradeAdventureWeapon(adventure, tier) : adventure;
  const base = WEAPONS.find(w => w.id === id);
  if (!base) return undefined;
  return tier > 0 ? applyWeaponUpgradeTier(base, tier) : base;
};

/** The rules a held weapon brings into a fight (plain Free Play weapons bring none). */
export const weaponRuleSource = (w: Weapon): RuleSource => {
  const a = w as AdventureWeapon;
  return { rules: a.rules, modifiers: a.modifiers };
};

/**
 * Where an id from an older save went: the weapon it is now and the upgrade
 * tier that old copy stands for. null: the weapon was removed. Current ids map
 * to themselves at tier 0.
 */
export const resolveLegacyWeapon = (id: string): { id: string; tier: number } | null => {
  if (id in LEGACY_WEAPON_IDS) return LEGACY_WEAPON_IDS[id];
  if (id in LEGACY_ADVENTURE_WEAPON_IDS) return LEGACY_ADVENTURE_WEAPON_IDS[id];
  return { id, tier: 0 };
};

/** What upgrade tier `tier` (1-3) gives this weapon over level 1, in a few words. */
export const describeWeaponLevel = (w: Weapon, tier: number): string => {
  const level = findAdventureWeapon(w.id)?.levels?.[Math.min(Math.max(1, tier), MAX_WEAPON_UPGRADE_TIER) - 1];
  return level ? level.text : describeWeaponUpgradeBonus(w, tier);
};

/** Shown after a weapon's name once it is above level 1 (" Lv 3"). */
export const weaponLevelSuffix = (tier: number): string => (tier > 0 ? ` Lv ${tier + 1}` : '');
