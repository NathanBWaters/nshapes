/**
 * How far each Armory weapon has grown (see data/weaponStats.ts for the model).
 *
 * - LEVEL is found in the world: every earned reward (star or bounty) that
 *   names a weapon is one copy found; the first unlocks it at level 1 and each
 *   later one is +1 level. An old save's stronger copies set a floor
 *   (`save.legacyWeaponTiers`). Derived from stars and bounties, so re-granting
 *   rewards when a save loads can never count one twice.
 * - TUNING is bought at the Workshop per number (`save.weaponTuning`).
 *
 * Pure: no storage I/O.
 */
import type { AdventureSave } from './types';
import { unlockSources } from './data/rewards';
import { getArmoryWeapon } from './data/armory';
import {
  MAX_TUNING_TIER,
  MAX_WEAPON_LEVEL,
  TUNING_COSTS,
  weaponStatLines,
  type WeaponBuild,
  type WeaponBuilds,
} from './data/weaponStats';

/** How many earned rewards (stars and completed bounties) name this weapon. */
const rewardsEarned = (save: AdventureSave, id: string): number =>
  unlockSources({ kind: 'weapon', id }).filter(s =>
    s.via === 'star'
      ? (save.stars[s.level.id] ?? 0) >= s.star
      : s.via === 'bounty' && save.completedBounties.includes(s.bounty.id)
  ).length;

/** The weapon's level (1-5): one per copy found after the first, and never below an old save's floor. */
export const weaponLevel = (save: AdventureSave, id: string): number =>
  Math.min(MAX_WEAPON_LEVEL, 1 + Math.max(0, rewardsEarned(save, id) - 1, save.legacyWeaponTiers?.[id] ?? 0));

/** How many level-ups for this weapon exist in the world at all (stars and bounties). */
export const weaponLevelsInWorld = (id: string): number =>
  Math.min(MAX_WEAPON_LEVEL, Math.max(1, unlockSources({ kind: 'weapon', id }).length));

/** Workshop tuning tiers of one weapon, by number key. */
export const weaponTuning = (save: AdventureSave, id: string): Record<string, number> => save.weaponTuning?.[id] ?? {};

export const weaponBuild = (save: AdventureSave, id: string): WeaponBuild => ({
  level: weaponLevel(save, id),
  tuning: weaponTuning(save, id),
});

/** Every Armory weapon's build, as `getArmoryWeapon` and the fight engine read it. */
export const weaponBuilds = (save: AdventureSave): WeaponBuilds =>
  Object.fromEntries(save.armory.map(id => [id, weaponBuild(save, id)]));

// ─── Workshop tuning ────────────────────────────────────────────────────────

/** The price of the next tuning tier of one number, or null when maxed or not tunable. */
export const tuningCost = (save: AdventureSave, id: string, key: string): number | null => {
  const w = getArmoryWeapon(id);
  const line = w && weaponStatLines(w, weaponBuild(save, id)).find(l => l.key === key);
  if (!line || !line.tunable || line.tier >= MAX_TUNING_TIER) return null;
  return TUNING_COSTS[line.tier];
};

export const canTune = (save: AdventureSave, id: string, key: string): boolean => {
  const cost = tuningCost(save, id, key);
  return cost !== null && save.workshopUnlocked && save.armory.includes(id) && save.coins >= cost;
};

export const buyTuning = (save: AdventureSave, id: string, key: string): AdventureSave => {
  if (!canTune(save, id, key)) return save;
  const cost = tuningCost(save, id, key)!;
  const current = weaponTuning(save, id);
  return {
    ...save,
    coins: save.coins - cost,
    weaponTuning: { ...save.weaponTuning, [id]: { ...current, [key]: (current[key] ?? 0) + 1 } },
  };
};

/** Coins put into tuning this weapon. */
export const tuningSpent = (save: AdventureSave, id: string): number =>
  Object.values(weaponTuning(save, id)).reduce(
    (sum, tier) => sum + TUNING_COSTS.slice(0, Math.max(0, Math.min(MAX_TUNING_TIER, tier))).reduce((a, b) => a + b, 0),
    0
  );

/** Give back every coin spent tuning this weapon. */
export const refundTuning = (save: AdventureSave, id: string): AdventureSave => {
  const coins = tuningSpent(save, id);
  if (coins <= 0) return save;
  const weaponTuning = { ...save.weaponTuning };
  delete weaponTuning[id];
  return { ...save, coins: save.coins + coins, weaponTuning };
};
