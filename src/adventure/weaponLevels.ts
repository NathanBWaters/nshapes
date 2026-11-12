/**
 * How strong each Armory weapon is. A weapon is one item with four levels
 * (upgrade tiers 0-3). Its tier is the sum of:
 * - free tiers: every earned reward (star or bounty) that names a weapon the
 *   player already owns is +1, and an old save's stronger copies set a floor
 *   (`save.legacyWeaponTiers`, see migrateSave in progress.ts);
 * - Workshop tiers bought with coins (`save.weaponUpgrades`).
 * Free tiers are derived from stars and bounties, so re-granting rewards when
 * a save loads can never stack them twice. Pure: no storage I/O.
 */
import type { AdventureSave } from './types';
import { MAX_WEAPON_UPGRADE_TIER, getWeaponUpgradeCosts } from './data/upgrades';
import { getArmoryWeapon } from './data/armory';
import { unlockSources } from './data/rewards';

/** How many earned rewards (stars and completed bounties) name this weapon. */
const rewardsEarned = (save: AdventureSave, id: string): number =>
  unlockSources({ kind: 'weapon', id }).filter(s =>
    s.via === 'star'
      ? (save.stars[s.level.id] ?? 0) >= s.star
      : s.via === 'bounty' && save.completedBounties.includes(s.bounty.id)
  ).length;

/** Tiers this weapon has for free: one per earned reward after the one that unlocked it. */
export const freeWeaponTiers = (save: AdventureSave, id: string): number =>
  Math.min(MAX_WEAPON_UPGRADE_TIER, Math.max(0, rewardsEarned(save, id) - 1, save.legacyWeaponTiers?.[id] ?? 0));

/** Tiers bought at the Workshop. */
export const boughtWeaponTiers = (save: AdventureSave, id: string): number => save.weaponUpgrades[id] ?? 0;

/** The weapon's upgrade tier (0-3); it is at level tier + 1. */
export const weaponUpgradeTier = (save: AdventureSave, id: string): number =>
  Math.min(MAX_WEAPON_UPGRADE_TIER, freeWeaponTiers(save, id) + boughtWeaponTiers(save, id));

/** Every Armory weapon's tier above 0, as `getArmoryWeapon` and the fight engine read it. */
export const weaponTiers = (save: AdventureSave): Record<string, number> => {
  const out: Record<string, number> = {};
  for (const id of save.armory) {
    const tier = weaponUpgradeTier(save, id);
    if (tier > 0) out[id] = tier;
  }
  return out;
};

/** The Workshop price list of a weapon (by its rarity), or null if it is not a weapon. */
export const weaponUpgradeCosts = (id: string): readonly number[] | null => {
  const weapon = getArmoryWeapon(id);
  return weapon ? getWeaponUpgradeCosts(weapon.rarity) : null;
};

/** Coins paid for Workshop tiers that free tiers have since pushed past the top tier. */
export const overflowRefund = (save: AdventureSave, id: string): number => {
  const bought = boughtWeaponTiers(save, id);
  const keep = Math.max(0, MAX_WEAPON_UPGRADE_TIER - freeWeaponTiers(save, id));
  if (bought <= keep) return 0;
  return (weaponUpgradeCosts(id) ?? []).slice(keep, bought).reduce((a, b) => a + b, 0);
};

/**
 * When a free upgrade lands on a weapon already raised at the Workshop, its
 * bought tiers above the top tier are taken back and their coins returned.
 */
export const settleWeaponTiers = (save: AdventureSave): AdventureSave => {
  let next = save;
  for (const id of Object.keys(save.weaponUpgrades)) {
    const refund = overflowRefund(next, id);
    if (refund <= 0) continue;
    const keep = Math.max(0, MAX_WEAPON_UPGRADE_TIER - freeWeaponTiers(next, id));
    const weaponUpgrades = { ...next.weaponUpgrades };
    if (keep > 0) weaponUpgrades[id] = keep;
    else delete weaponUpgrades[id];
    next = { ...next, coins: next.coins + refund, weaponUpgrades };
  }
  return next;
};
