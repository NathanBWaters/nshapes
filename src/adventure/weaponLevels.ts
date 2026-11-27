/**
 * How far each Armory weapon has grown (see data/weaponStats.ts for the model).
 *
 * - LEVEL is derived purely from save progress so re-granting rewards on load
 *   can never count one twice:
 *     - Campaign weapons (48): every earned reward (star or bounty) naming the
 *       weapon is one copy found; the first unlocks Lv 1 and each extra is +1.
 *     - Bounty-Exclusive weapons (16): unlock at Lv 1, gain +1 per completed
 *       own weapon bounty (T1/T2/T3 -> Lv 2/3/4), and +1 on clearing 5-5 (Lv 5).
 *     - Legacy rare/epic copies (`save.legacyWeaponTiers`) act as a level floor.
 * - TUNING is bought at the Workshop per number (`save.weaponTuning`).
 *
 * Pure: no storage I/O.
 */
import type { AdventureSave } from './types';
import { getWeaponBounties, isBountyExclusiveWeapon } from './data/bounties';
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

/** Campaign finale stage that grants the final Lv 5 step for Bounty-Exclusive weapons. */
export const BOUNTY_EXCLUSIVE_CAPSTONE_LEVEL = '5-5';

/** How many earned rewards (stars and completed bounties) name this weapon. */
const rewardsEarned = (save: AdventureSave, id: string): number =>
  unlockSources({ kind: 'weapon', id }).filter(s =>
    s.via === 'star'
      ? (save.stars[s.level.id] ?? 0) >= s.star
      : s.via === 'bounty' && save.completedBounties.includes(s.bounty.id)
  ).length;

/** Level-ups above Lv 1 earned for one of the 16 Bounty-Exclusive weapons. */
const bountyExclusiveLevelSteps = (save: AdventureSave, id: string): number => {
  const ownCompleted = getWeaponBounties(id).filter(b => save.completedBounties.includes(b.id)).length;
  const capstone = (save.stars[BOUNTY_EXCLUSIVE_CAPSTONE_LEVEL] ?? 0) >= 1 ? 1 : 0;
  const extraCopies = Math.max(0, rewardsEarned(save, id) - 1);
  return ownCompleted + capstone + extraCopies;
};

/** The weapon's level (1-5): derived from copies / own bounties + 5-5, never below an old save's floor. */
export const weaponLevel = (save: AdventureSave, id: string): number => {
  const steps = isBountyExclusiveWeapon(id)
    ? bountyExclusiveLevelSteps(save, id)
    : Math.max(0, rewardsEarned(save, id) - 1);
  return Math.min(MAX_WEAPON_LEVEL, 1 + Math.max(steps, save.legacyWeaponTiers?.[id] ?? 0));
};

/** How many levels for this weapon exist in the world (5 for Bounty-Exclusive weapons; star/bounty count otherwise). */
export const weaponLevelsInWorld = (id: string): number =>
  isBountyExclusiveWeapon(id)
    ? MAX_WEAPON_LEVEL
    : Math.min(MAX_WEAPON_LEVEL, Math.max(1, unlockSources({ kind: 'weapon', id }).length));

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
