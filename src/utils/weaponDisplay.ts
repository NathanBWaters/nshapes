/**
 * Shared utility functions for weapon display across WeaponShop, LevelUp, and EnemySelection.
 */

import { Weapon, PlayerStats, EffectCaps } from '../types';
import { getCapInfoForStat, isStatCapped, shouldShowCapInfo, STAT_TO_CAP_TYPE, EFFECT_CAPS } from './gameConfig';

/**
 * Format stat key from camelCase to Title Case
 */
export const formatStatName = (key: string): string => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase());
};

/**
 * Format stat value with appropriate suffix (%, ms, s)
 */
export const formatStatValue = (key: string, value: number): string => {
  let displayValue = `${value}`;
  if (key.toLowerCase().includes('percent') || key.toLowerCase().includes('chance')) displayValue += '%';
  if (key.toLowerCase().includes('interval')) displayValue += 'ms';
  if (key.toLowerCase().includes('time') && !key.toLowerCase().includes('interval')) displayValue += 's';
  return displayValue;
};

/**
 * Effects that roll independently per weapon (don't show misleading before→after)
 */
export const INDEPENDENT_ROLL_EFFECTS = [
  'laserChance',
  'timeGainChance',
  'timeGainAmount',
];

/**
 * Generate dynamic description for cap-increase weapons
 */
export const getDynamicDescription = (weapon: Weapon, playerStats: PlayerStats): string => {
  if (!weapon.capIncrease) return weapon.description;

  const capType = weapon.capIncrease.type;
  const effectCaps = playerStats.effectCaps as Record<string, number> | undefined;
  const currentCap = effectCaps?.[capType] ?? EFFECT_CAPS[capType as keyof typeof EFFECT_CAPS]?.defaultCap ?? 0;
  const newCap = currentCap + weapon.capIncrease.amount;

  // Format cap type for display
  const capTypeName = capType.replace(/([A-Z])/g, ' $1').toLowerCase().trim();

  return `Raises your ${capTypeName} cap to ${newCap}%`;
};

/**
 * Cap increase info for Mastery weapons
 */
export interface CapIncreaseInfo {
  statName: string;
  currentValue: number;
  currentCap: number;
  newCap: number;
}

/**
 * Get cap-increase info for display (for Mastery weapons)
 */
export const getCapIncreaseInfo = (weapon: Weapon, playerStats: PlayerStats): CapIncreaseInfo | null => {
  if (!weapon.capIncrease) return null;

  const capType = weapon.capIncrease.type;
  const statKey = STAT_TO_CAP_TYPE[`${capType}Chance` as keyof typeof STAT_TO_CAP_TYPE]
    ? `${capType}Chance`
    : Object.entries(STAT_TO_CAP_TYPE).find(([_, type]) => type === capType)?.[0];

  if (!statKey) return null;

  const effectCaps = playerStats.effectCaps as Record<string, number> | undefined;
  const currentCap = effectCaps?.[capType] ?? EFFECT_CAPS[capType as keyof typeof EFFECT_CAPS]?.defaultCap ?? 0;
  const newCap = currentCap + weapon.capIncrease.amount;
  const currentValue = (playerStats as Record<string, any>)[statKey] ?? 0;

  // Format the stat name
  const statName = formatStatName(statKey);

  return { statName, currentValue, currentCap, newCap };
};

/**
 * Stat comparison result for displaying weapon effects
 */
export interface StatComparison {
  key: string;
  before: string;
  after: string;
  isIncrease: boolean;
  isCapped: boolean;
  cap: number | null;
  isPerWeapon: boolean;
}

/**
 * Calculate before/after stat comparison for a weapon.
 * Shows independent roll effects with "(per weapon)" notation.
 * Shows cap info when stat would exceed its cap.
 */
export const getStatComparison = (weapon: Weapon, playerStats: PlayerStats): StatComparison[] => {
  const effectCaps = playerStats.effectCaps as EffectCaps | undefined;

  return Object.entries(weapon.effects).map(([key, effectValue]) => {
    if (typeof effectValue !== 'number') return null;

    const isPerWeapon = INDEPENDENT_ROLL_EFFECTS.includes(key);

    if (isPerWeapon) {
      // For per-weapon effects, just show the weapon's value (no cumulative before→after)
      return {
        key: formatStatName(key),
        before: '',  // Not shown for per-weapon effects
        after: formatStatValue(key, effectValue),
        isIncrease: effectValue > 0,
        isCapped: false,
        cap: null,
        isPerWeapon: true,
      };
    }

    const currentValue = (playerStats as Record<string, any>)[key] ?? 0;
    const newValue = currentValue + effectValue;

    // Check if this stat has a cap
    const capInfo = getCapInfoForStat(key, effectCaps as Record<string, number> | undefined);
    const isCapped = capInfo ? isStatCapped(newValue, capInfo.cap) : false;

    // Only show cap info when player is close to the cap (within 20% or 2 points)
    const showCapInfo = capInfo ? shouldShowCapInfo(currentValue, capInfo.cap) : false;

    return {
      key: formatStatName(key),
      before: formatStatValue(key, currentValue),
      after: formatStatValue(key, newValue),
      isIncrease: effectValue > 0,
      isCapped,
      cap: showCapInfo ? capInfo?.cap ?? null : null,
      isPerWeapon: false,
    };
  }).filter((item): item is StatComparison => item !== null);
};

/**
 * Get rarity label for display
 */
export const getRarityLabel = (rarity: string): string => {
  switch (rarity) {
    case 'common': return 'Common';
    case 'rare': return 'Rare';
    case 'epic': return 'Epic';
    case 'legendary': return 'Legendary';
    default: return rarity;
  }
};
