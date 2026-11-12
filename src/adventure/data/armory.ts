/** Looks up any weapon the adventure can hand out, base or evolved, at its Workshop upgrade tier. */
import type { Weapon } from '@/types';
import { WEAPONS } from '@/utils/gameDefinitions';
import { findEvolvedWeapon } from './evolutions';
import { applyWeaponUpgradeTier } from './upgrades';

export const getArmoryWeapon = (id: string, weaponUpgrades?: Record<string, number>): Weapon | undefined => {
  const base = WEAPONS.find(w => w.id === id) ?? findEvolvedWeapon(id);
  if (!base) return undefined;
  const tier = weaponUpgrades?.[id] ?? 0;
  return tier > 0 ? applyWeaponUpgradeTier(base, tier) : base;
};
