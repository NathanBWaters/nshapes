/**
 * Cross-run Bounties.
 *
 * The Bounty Board unlocks upon clearing 1-8 (Meadow Boss). Once open, every
 * fight — win, lose, or replay — advances cumulative counters across runs and
 * cashes out coins, Armory weapons, and Arcana wildcards.
 */
import type { AdventureSave, BountyDef } from '../types';
import { LEVELS } from './levels';

const eliteClears = (save: AdventureSave): number =>
  LEVELS.filter(l => l.branchOf && (save.stars[l.id] ?? 0) >= 2).length;

const uniqueFighterWins = (save: AdventureSave): number =>
  Object.values(save.bountyStats.fighterWins).filter(n => (n ?? 0) >= 1).length;

const perfectCount = (save: AdventureSave): number =>
  Object.values(save.stars).filter(s => s >= 3).length;

export const BOUNTY_UNLOCK_LEVEL_ID = '1-8';

export const BOUNTIES: BountyDef[] = [
  // ── Mastery & Escalating Purity ─────────────────────────────────────────
  {
    id: 'bounty_sets_40',
    category: 'mastery',
    name: 'Pattern Apprentice',
    description: 'Complete 40 valid Sets across all Adventure fights.',
    icon: 'lorc/checked-shield',
    target: 40,
    progress: s => s.bountyStats.totalSets,
    reward: { coins: 75 },
  },
  {
    id: 'bounty_rainbow_12',
    category: 'mastery',
    name: 'Spectrum Seeker',
    description: 'Land 12 Rainbow Strikes (every active trait all-different).',
    icon: 'lorc/rainbow-star',
    target: 12,
    progress: s => s.bountyStats.rainbowSets,
    reward: { coins: 110, arcana: 'prismatic_fever' },
  },
  {
    id: 'bounty_purity_10',
    category: 'mastery',
    name: 'Ascending Mind',
    description: 'Trigger 10 Escalating Purity combos (chain Sets of rising diversity).',
    icon: 'lorc/lightning-branches',
    target: 10,
    progress: s => s.bountyStats.purityChains,
    reward: { coins: 90, weapons: ['echo-stone-rare'] },
  },
  {
    id: 'bounty_purity_triple_3',
    category: 'mastery',
    name: 'Crowning Purity',
    description: 'Reach a 3-step Escalating Purity combo 3 times.',
    icon: 'lorc/crystal-shine',
    target: 3,
    progress: s => s.bountyStats.threeStepPurities,
    reward: { coins: 150, weapons: ['resonance-crystal'] },
  },
  {
    id: 'bounty_flawless_timed_3',
    category: 'mastery',
    name: 'Untouchable',
    description: 'Knock out 3 timed stages (★★+) with zero mistakes.',
    icon: 'lorc/diamond-hard',
    target: 3,
    progress: s => s.bountyStats.flawlessTimedWins,
    reward: { coins: 130, arcana: 'glass_prism' },
  },

  // ── Chaos, Overkill & Evolutions ────────────────────────────────────────
  {
    id: 'bounty_destructive_6',
    category: 'chaos',
    name: 'Pyrotechnician',
    description: 'Trigger fire, explosions, or lasers in 6 fights.',
    icon: 'lorc/bright-explosion',
    target: 6,
    progress: s => s.bountyStats.destructiveFights,
    reward: { coins: 95, weapons: ['chaos-conduit'] },
  },
  {
    id: 'bounty_overkill_10',
    category: 'chaos',
    name: 'Overkill Finisher',
    description: 'Deal 8+ overkill damage past 0 HP on a finishing blow.',
    icon: 'lorc/skull-crack',
    target: 8,
    progress: s => s.bountyStats.maxOverkill,
    reward: { coins: 120, weapons: ['wisdom-chain'] },
  },
  {
    id: 'bounty_evolve_1',
    category: 'chaos',
    name: 'First Transmutation',
    description: 'Prime a weapon recipe and match on a hidden Catalyst card.',
    icon: 'lorc/crystal-wand',
    target: 1,
    progress: s => s.bountyStats.evolutionsForged,
    reward: { coins: 100 },
  },
  {
    id: 'bounty_evolve_unique_3',
    category: 'chaos',
    name: 'Relic Alchemist',
    description: 'Discover 3 unique Weapon Evolutions in the Recipe Guide.',
    icon: 'lorc/fireball',
    target: 3,
    progress: s => s.discoveredEvolutions.length,
    reward: { coins: 180, arcana: 'catalyst_resonance' },
  },

  // ── Roster Feats ────────────────────────────────────────────────────────
  {
    id: 'bounty_fox_wins_3',
    category: 'roster',
    name: 'Wildfire Trail',
    description: 'Knock out 3 foes (★★+) fighting as Sly Fox.',
    icon: 'caro-asercion/fox',
    target: 3,
    progress: s => s.bountyStats.fighterWins['Sly Fox'] ?? 0,
    reward: { coins: 85 },
  },
  {
    id: 'bounty_corgi_wins_3',
    category: 'roster',
    name: 'Goodest Boy',
    description: 'Knock out 3 foes (★★+) fighting as Corgi.',
    icon: 'delapouite/sitting-dog',
    target: 3,
    progress: s => s.bountyStats.fighterWins['Corgi'] ?? 0,
    reward: { coins: 95, weapons: ['connector-rare'] },
  },
  {
    id: 'bounty_badger_wins_3',
    category: 'roster',
    name: 'Grudge Match',
    description: 'Knock out 3 foes (★★+) fighting as Badger.',
    icon: 'caro-asercion/badger',
    target: 3,
    progress: s => s.bountyStats.fighterWins['Badger'] ?? 0,
    reward: { coins: 110, weapons: ['grace-conduit'] },
  },
  {
    id: 'bounty_roster_4',
    category: 'roster',
    name: 'Pack Leader',
    description: 'Earn a knockout win (★★+) with 4 different fighters.',
    icon: 'lorc/trophy',
    target: 4,
    progress: uniqueFighterWins,
    reward: { coins: 160, weapons: ['fortunes-blessing'] },
  },

  // ── Explorer & Completionist ────────────────────────────────────────────
  {
    id: 'bounty_stars_10',
    category: 'explorer',
    name: 'Star Collector',
    description: 'Earn ★★★ on 6 different stages.',
    icon: 'lorc/flat-star',
    target: 6,
    progress: perfectCount,
    reward: { coins: 120 },
  },
  {
    id: 'bounty_elites_2',
    category: 'explorer',
    name: 'Giant Slayer',
    description: 'Knock out 2 optional Elite branch foes (★★+).',
    icon: 'lorc/daemon-skull',
    target: 2,
    progress: eliteClears,
    reward: { coins: 180 },
  },
  {
    id: 'bounty_coins_1000',
    category: 'explorer',
    name: 'Treasure Hoard',
    description: 'Accumulate 1,000 lifetime coins across runs.',
    icon: 'lorc/crown-coin',
    target: 1000,
    progress: s => s.lifetimeCoins,
    reward: { coins: 200 },
  },
];

export const getBounty = (id: string): BountyDef => {
  const b = BOUNTIES.find(x => x.id === id);
  if (!b) throw new Error(`Unknown bounty: ${id}`);
  return b;
};
