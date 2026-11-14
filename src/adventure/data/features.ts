/**
 * Campaign systems that start locked. Adding one means adding a row here, its
 * AdventureSave flag, and either `unlockFeature` on a star reward in levels.ts
 * or a `clearLevel`. Grants, reveals, the preview chip and the Field Guide all
 * read this table.
 */
import type { CampaignFeatureDef, UnlockableFeature } from '../types';

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
    tease: 'Spend coins at Camp on permanent upgrades, bigger loadouts and stronger Armory weapons!',
    badge: 'NEW ABILITY UNLOCKED',
    open: { label: 'Open Workshop', destination: { screen: 'camp', tab: 'workshop' } },
  },
  bounties: {
    id: 'bounties',
    saveFlag: 'bountiesUnlocked',
    mechanic: 'bounty_board',
    name: 'Cross-Run Bounties',
    secret: 'New system',
    headline: 'Bounty Board unlocked!',
    tease: 'Your feats across every fight now earn extra loot!',
    badge: 'NEW SYSTEM UNLOCKED',
    accent: '#F59E0B',
    clearLevel: '1-8',
    open: { label: 'View Bounty Board', destination: { screen: 'camp', tab: 'bounties' } },
  },
};

export const FEATURES: CampaignFeatureDef[] = Object.values(CAMPAIGN_FEATURES);
