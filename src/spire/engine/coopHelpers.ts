/**
 * Pure deterministic helpers for Starfall Summit 2P Co-Op mechanics:
 *   - Map voting consensus (unanimous agreement vs. mismatch vs. waiting)
 *   - Phase ready-barrier resolution
 *   - Shop gifting (Heal Ally +2 ♥, Gift Offered Weapon)
 *   - Campfire duo actions (Heal Ally, Duo Forge)
 *   - Receiving ally shop/campfire gifts safely under the 6-weapon belt cap
 */
import { getArmoryWeapon } from '@/adventure/data/armory';
import { MAX_WEAPON_LEVEL } from '@/adventure/data/weaponStats';
import {
  grantSpireWeapon,
  MAX_SUMMIT_WEAPONS,
  upgradeSpireWeapon,
} from './runState';
import type { SpireRun } from '../types';

export const COOP_SHOP_GIFT_HEAL_AMOUNT = 2;
export const COOP_WEAPON_GIFT_FALLBACK_COINS = 50;
export const COOP_DUO_FORGE_FALLBACK_COINS = 35;

export interface MapVoteConsensus {
  status: 'none' | 'waiting' | 'mismatch' | 'agreed';
  agreedNodeId: string | null;
  votedCount: number;
  totalPlayers: number;
}

/**
 * Evaluate map node votes across active party members.
 * Only reachable node IDs count; advances when every party member agrees on the same reachable node.
 */
export const evaluateMapVoteConsensus = (
  votesByPlayer: Readonly<Record<string, string | null | undefined>>,
  playerIds: readonly string[],
  reachableNodeIds: readonly string[]
): MapVoteConsensus => {
  const totalPlayers = playerIds.length;
  if (totalPlayers === 0) {
    return { status: 'none', agreedNodeId: null, votedCount: 0, totalPlayers: 0 };
  }
  const reachableSet = new Set(reachableNodeIds);
  const validVotes: string[] = [];
  for (const pid of playerIds) {
    const pick = votesByPlayer[pid];
    if (pick && reachableSet.has(pick)) {
      validVotes.push(pick);
    }
  }
  if (validVotes.length === 0) {
    return { status: 'none', agreedNodeId: null, votedCount: 0, totalPlayers };
  }
  const unique = new Set(validVotes);
  if (validVotes.length < totalPlayers) {
    return {
      status: unique.size > 1 ? 'mismatch' : 'waiting',
      agreedNodeId: null,
      votedCount: validVotes.length,
      totalPlayers,
    };
  }
  if (unique.size === 1) {
    return {
      status: 'agreed',
      agreedNodeId: validVotes[0],
      votedCount: validVotes.length,
      totalPlayers,
    };
  }
  return {
    status: 'mismatch',
    agreedNodeId: null,
    votedCount: validVotes.length,
    totalPlayers,
  };
};

export interface ReadyBarrierStatus {
  allReady: boolean;
  readyCount: number;
  totalCount: number;
}

/** Evaluate whether all players in a co-op climb have confirmed ready for the current phase barrier. */
export const evaluateReadyBarrier = (
  readyByPlayer: Readonly<Record<string, boolean | undefined>>,
  playerIds: readonly string[]
): ReadyBarrierStatus => {
  const totalCount = playerIds.length;
  if (totalCount === 0) return { allReady: false, readyCount: 0, totalCount: 0 };
  let readyCount = 0;
  for (const pid of playerIds) {
    if (readyByPlayer[pid]) readyCount += 1;
  }
  return {
    allReady: readyCount === totalCount,
    readyCount,
    totalCount,
  };
};

/** Spend coins in the Merchant Shop to send a +2 ♥ Trail Tonic to your co-op ally. */
export const applyCoopShopGiftHeal = (
  run: SpireRun,
  costOverride?: number
): { run: SpireRun; healAmount: number; spent: number } | null => {
  if (run.phase !== 'shop' || !run.shop) return null;
  const cost = Math.max(0, costOverride ?? run.shop.healCost);
  if (run.coins < cost) return null;
  return {
    run: {
      ...run,
      coins: run.coins - cost,
      stats: { ...run.stats, coinsSpent: run.stats.coinsSpent + cost },
    },
    healAmount: COOP_SHOP_GIFT_HEAL_AMOUNT,
    spent: cost,
  };
};

/** Spend coins in the Merchant Shop to buy an offered weapon and send it directly to your co-op ally. */
export const applyCoopShopGiftWeapon = (
  run: SpireRun,
  offerIndex: number
): { run: SpireRun; weaponId: string; level: number; spent: number } | null => {
  if (run.phase !== 'shop' || !run.shop) return null;
  const offer = run.shop.weapons[offerIndex];
  if (!offer || offer.sold || run.coins < offer.price) return null;
  return {
    run: {
      ...run,
      coins: run.coins - offer.price,
      stats: { ...run.stats, coinsSpent: run.stats.coinsSpent + offer.price },
      shop: {
        ...run.shop,
        weapons: run.shop.weapons.map((w, i) =>
          i === offerIndex ? { ...w, sold: true, locked: false } : w
        ),
      },
    },
    weaponId: offer.weaponId,
    level: offer.level,
    spent: offer.price,
  };
};

/** Apply a heal gift received from your co-op ally (clamped to maxHearts). */
export const applyCoopReceivedHeal = (
  run: SpireRun,
  healAmount: number
): { run: SpireRun; gained: number } => {
  const safeAmt = Math.max(0, Math.floor(healAmount));
  const after = Math.min(run.maxHearts, run.hearts + safeAmt);
  const gained = Math.max(0, after - run.hearts);
  return {
    run: gained > 0 ? { ...run, hearts: after } : run,
    gained,
  };
};

/**
 * Apply a weapon gift sent by your co-op ally from the Merchant Shop.
 * Upgrades if already held, adds if belt has space (< 6), or converts to bonus coins if belt is full.
 */
export const applyCoopReceivedWeaponGift = (
  run: SpireRun,
  weaponId: string,
  level = 1
): { run: SpireRun; applied: 'upgraded' | 'added' | 'coins'; bonusCoins?: number } => {
  if (run.weaponLevels[weaponId] !== undefined) {
    return { run: grantSpireWeapon(run, weaponId, level), applied: 'upgraded' };
  }
  if (run.weapons.length < MAX_SUMMIT_WEAPONS) {
    return { run: grantSpireWeapon(run, weaponId, level), applied: 'added' };
  }
  return {
    run: { ...run, coins: run.coins + COOP_WEAPON_GIFT_FALLBACK_COINS },
    applied: 'coins',
    bonusCoins: COOP_WEAPON_GIFT_FALLBACK_COINS,
  };
};

/** Resolve a Co-Op Campfire "Heal Ally" action (sends +healAmount ♥ to ally and warms self +1 ♥ if hurt). */
export const applyCoopCampfireHealAlly = (
  run: SpireRun,
  allyName: string,
  healAmount?: number
): { run: SpireRun; allyHealAmount: number } | null => {
  if (run.phase !== 'campfire' || !run.campfire || run.campfire.resolved) return null;
  const allyHealAmount = Math.max(2, healAmount ?? run.campfire.healAmount);
  const selfAfter = Math.min(run.maxHearts, run.hearts + 1);
  const selfGained = selfAfter - run.hearts;
  return {
    run: {
      ...run,
      hearts: selfAfter,
      campfire: {
        ...run.campfire,
        resolved: true,
        outcomeText:
          selfGained > 0
            ? `Tended the fire for ${allyName} (+${allyHealAmount} ♥ sent) and warmed up (+1 ♥)!`
            : `Tended the fire for ${allyName} (+${allyHealAmount} ♥ sent)!`,
      },
    },
    allyHealAmount,
  };
};

/** Resolve a Co-Op Campfire "Duo Forge" action (upgrades one local weapon +1 Lv and sends a forge spark to ally). */
export const applyCoopCampfireDuoForge = (
  run: SpireRun,
  weaponId: string,
  allyName: string
): { run: SpireRun; weaponId: string; newLevel: number } | null => {
  if (run.phase !== 'campfire' || !run.campfire || run.campfire.resolved) return null;
  const cur = run.weaponLevels[weaponId];
  if (cur === undefined || cur >= MAX_WEAPON_LEVEL) return null;
  const next = upgradeSpireWeapon(run, weaponId, 1);
  const newLevel = next.weaponLevels[weaponId] ?? cur + 1;
  const wName = getArmoryWeapon(weaponId)?.name ?? weaponId;
  return {
    run: {
      ...next,
      campfire: {
        ...run.campfire,
        resolved: true,
        outcomeText: `Duo Forged ${wName} to Level ${newLevel} & sent a forge spark to ${allyName}!`,
      },
    },
    weaponId,
    newLevel,
  };
};

/** Apply a Duo Forge spark received from your ally (upgrades first non-maxed weapon +1 Lv, or grants bonus coins). */
export const applyCoopReceivedDuoForgeSpark = (
  run: SpireRun
): { run: SpireRun; upgradedWeaponId?: string; bonusCoins?: number } => {
  const candidate = run.weapons.find(id => (run.weaponLevels[id] ?? 1) < MAX_WEAPON_LEVEL);
  if (candidate) {
    return {
      run: upgradeSpireWeapon(run, candidate, 1),
      upgradedWeaponId: candidate,
    };
  }
  return {
    run: { ...run, coins: run.coins + COOP_DUO_FORGE_FALLBACK_COINS },
    bonusCoins: COOP_DUO_FORGE_FALLBACK_COINS,
  };
};
