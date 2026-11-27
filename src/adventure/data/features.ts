/**
 * Campaign systems that start locked, plus World 1 / World 2 weapon-slot
 * milestones. Adding a feature means adding a row here, its AdventureSave flag,
 * and either `unlockFeature` on a star reward in levels.ts or a `clearLevel`.
 * Grants, reveals, the preview chip and the Field Guide all read this table.
 */
import type { AdventureSave, CampaignFeatureDef, UnlockableFeature } from '../types';

/** Campaign milestone required before Starfall Summit unlocks on MainMenu. */
export const SUMMIT_UNLOCK_LEVEL_ID = '1-10';

/** World boss clears that expand the player's Weapon Belt from 3 -> 4 -> 5 slots. */
export const SLOT_4_UNLOCK_LEVEL_ID = '1-10';
export const SLOT_5_UNLOCK_LEVEL_ID = '2-10';

export interface WeaponSlotMilestoneDef {
  slotNumber: 4 | 5;
  levelId: string;
  badgeLabel: 'W1' | 'W2';
  headline: string;
  tease: string;
  tooltip: string;
}

export const WEAPON_SLOT_MILESTONES: readonly WeaponSlotMilestoneDef[] = [
  {
    slotNumber: 4,
    levelId: SLOT_4_UNLOCK_LEVEL_ID,
    badgeLabel: 'W1',
    headline: '4th Weapon Slot Unlocked!',
    tease: 'Carry 4 weapons into every fight — deeper synergies, more evolutions!',
    tooltip: '4th Weapon Slot — Defeat Iron Shell (Level 1-10) to unlock!',
  },
  {
    slotNumber: 5,
    levelId: SLOT_5_UNLOCK_LEVEL_ID,
    badgeLabel: 'W2',
    headline: '5th Weapon Slot Unlocked!',
    tease: 'Carry 5 weapons into every fight — unleash full-belt Synergy engines!',
    tooltip: '5th Weapon Slot — Defeat Trap Weaver (Level 2-10) to unlock!',
  },
];

/** Look up milestone copy for the 4th or 5th weapon slot unlock reveal. */
export const getWeaponSlotMilestone = (slotNumber: 4 | 5): WeaponSlotMilestoneDef =>
  WEAPON_SLOT_MILESTONES[slotNumber === 4 ? 0 : 1];

/**
 * Starfall Summit opens once the World 1 Boss (`SUMMIT_UNLOCK_LEVEL_ID`) is cleared,
 * or automatically for existing players who already have Summit runs / an active climb.
 */
export const isSummitUnlocked = (
  save: Pick<AdventureSave, 'stars'>,
  spireMeta?: { totalRuns?: number } | null,
  hasActiveRun?: boolean,
): boolean =>
  (save.stars[SUMMIT_UNLOCK_LEVEL_ID] ?? 0) >= 1 ||
  (spireMeta?.totalRuns ?? 0) > 0 ||
  Boolean(hasActiveRun);

export const CAMPAIGN_FEATURES: Record<UnlockableFeature, CampaignFeatureDef> = {
  coins: {
    id: 'coins',
    saveFlag: 'coinsUnlocked',
    mechanic: 'coins',
    name: 'Coin Drops',
    secret: 'New ability',
    headline: 'Coin Drops unlocked!',
    tease: 'Every fight can now drop shiny coins for Camp!',
    badge: 'NEW ABILITY UNLOCKED',
  },
  workshop: {
    id: 'workshop',
    saveFlag: 'workshopUnlocked',
    mechanic: 'workshop',
    name: 'The Workshop',
    secret: 'Camp upgrade',
    headline: 'The Workshop unlocked!',
    tease: 'Spend coins at Camp to tune Armory weapons, extend Evolutions, and unlock permanent upgrades!',
    badge: 'NEW ABILITY UNLOCKED',
    open: { label: 'Open Workshop', destination: { screen: 'camp', tab: 'workshop' } },
  },
  bounties: {
    id: 'bounties',
    saveFlag: 'bountiesUnlocked',
    mechanic: 'bounty_board',
    name: 'Weapon Bounties',
    secret: 'New system',
    headline: 'Bounty Board unlocked!',
    tease: 'Every Armory weapon opens its own Bounties — try new weapons to unlock Evolutions and brand-new gear!',
    badge: 'NEW SYSTEM UNLOCKED',
    accent: '#F59E0B',
    clearLevel: '1-10',
    open: { label: 'View Bounty Board', destination: { screen: 'camp', tab: 'bounties' } },
  },
};

export const FEATURES: CampaignFeatureDef[] = Object.values(CAMPAIGN_FEATURES);
