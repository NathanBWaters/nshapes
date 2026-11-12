/**
 * Acquiring weapons and paying for rerolls in the legacy round-based run.
 */
import type { Weapon } from '@/types';
import { calculatePlayerTotalStats, getRandomShopWeapon } from '@/utils/gameDefinitions';
import { RerollPricing, getNextRerollCost } from '@/utils/gameConfig';
import type { Player } from './types';

/**
 * Add a weapon to the player's inventory and apply what it grants on pickup:
 * +1 hint for a weapon that raises max hints, its graces, and its health -
 * each clamped to the player's new maximum.
 */
export const grantWeapon = (player: Player, weapon: Weapon): Player => {
  const weapons = [...player.weapons, weapon];
  const newTotalStats = calculatePlayerTotalStats({ ...player, weapons });
  const { stats } = player;

  const hintsBonus =
    weapon.effects.maxHints && typeof weapon.effects.maxHints === 'number'
      ? Math.min(1, newTotalStats.maxHints - stats.hints)
      : 0;
  const gracesBonus =
    weapon.effects.graces && typeof weapon.effects.graces === 'number' ? weapon.effects.graces : 0;
  const healthBonus =
    weapon.effects.health && typeof weapon.effects.health === 'number' ? weapon.effects.health : 0;

  return {
    ...player,
    weapons,
    stats: {
      ...stats,
      hints: Math.min(stats.hints + hintsBonus, newTotalStats.maxHints),
      graces: Math.min(stats.graces + gracesBonus, newTotalStats.maxGraces),
      health: Math.min(stats.health + healthBonus, newTotalStats.maxHealth),
    },
  };
};

/** Weapon choices offered on level up. */
export const generateLevelUpOptions = (drawIncrease: number): Weapon[] => {
  const options: Weapon[] = [];
  const count = 4 + drawIncrease;
  for (let i = 0; i < count; i++) {
    options.push(getRandomShopWeapon());
  }
  return options;
};

export interface RerollWallet {
  money: number;
  freeRerolls: number;
  rerollCost: number;
}

export const canAffordReroll = (wallet: RerollWallet): boolean =>
  wallet.freeRerolls > 0 || wallet.money >= wallet.rerollCost;

/**
 * Pay for one reroll: a free reroll if the player has one, otherwise money -
 * and a paid reroll makes the next one more expensive. Returns null when the
 * player can afford neither.
 */
export const payForReroll = (wallet: RerollWallet, pricing: RerollPricing): RerollWallet | null => {
  if (wallet.freeRerolls > 0) {
    return { ...wallet, freeRerolls: wallet.freeRerolls - 1 };
  }
  if (wallet.money >= wallet.rerollCost) {
    return {
      ...wallet,
      money: wallet.money - wallet.rerollCost,
      rerollCost: getNextRerollCost(wallet.rerollCost, pricing),
    };
  }
  return null;
};
