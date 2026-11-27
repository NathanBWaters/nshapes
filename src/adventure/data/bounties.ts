/**
 * Cross-run Bounties — 200-Bounty Weapon-Linked Progression Web
 * (192 weapon-linked bounties across all 64 Armory weapons + 8 General bounties).
 *
 * Once the Bounty Board unlocks on World 1 Boss (1-10):
 *  - Every owned Armory weapon opens its 3 handcrafted bounties (Tier 1 Quick
 *    On-Ramp, Tier 2 Single-Fight Cross-Weapon Feat, Tier 3 Synergy Mastery).
 *  - All 192 per-weapon evolutions unlock 1:1 (1 starter on 1-10 ★1 + 191 via
 *    weapon-linked bounties), alongside 16 Bounty-Exclusive weapons (14 Layer-1
 *    + 2 Layer-2) and 14 early-access Campaign weapons in a deadlock-free DAG.
 */
import type { Color } from '@/types';
import type { IconName } from '@/components/Icon';
import type {
  AdventureSave,
  BountyCategory,
  BountyDef,
  BountyMetricKey,
  BountyScope,
  FightMetrics,
  RewardDef,
  SynergyAttrId,
} from '../types';
import type { TrickKind } from '../rules/types';
import { LEVELS } from './levels';

/** 14 Layer-1 Bounty-Exclusive Armory weapons unlocked by Layer-0 Campaign weapons. */
export const BOUNTY_EXCLUSIVE_L1: readonly string[] = [
  "chaos-conduit",
  "soul-harvest",
  "cascade-core",
  "life-link",
  "grace-conduit",
  "crystal-orb",
  "thorn-bush",
  "cursed-idol",
  "revenge-linker",
  "web-weaver",
  "temporal-rift",
  "echo-chamber",
  "fortunes-blessing",
  "wisdom-chain"
];

/** 2 Layer-2 Bounty-Exclusive Capstone Armory weapons unlocked by Layer-1 exclusive weapons. */
export const BOUNTY_EXCLUSIVE_L2: readonly string[] = [
  "neural-network",
  "chain-reaction"
];

/** All 16 Bounty-Exclusive Armory weapon IDs (level Lv 1 -> 5 via own 3 bounties + 5-5 clear). */
export const BOUNTY_EXCLUSIVE_WEAPON_IDS: readonly string[] = [
  ...BOUNTY_EXCLUSIVE_L1,
  ...BOUNTY_EXCLUSIVE_L2,
];

export const BOUNTY_EXCLUSIVE_WEAPON_SET: ReadonlySet<string> = new Set(BOUNTY_EXCLUSIVE_WEAPON_IDS);

export const isBountyExclusiveWeapon = (weaponId: string): boolean =>
  BOUNTY_EXCLUSIVE_WEAPON_SET.has(weaponId);

/** Lossless v1 -> redesign mapping for legacy completed bounty IDs whose successors still exist. */
export const LEGACY_BOUNTY_ID_MAP: Readonly<Record<string, string>> = {
  bounty_evolve_unique_3: 'bounty_gen_evo_arcana',
  bounty_stars_10: 'bounty_gen_stars_perfect',
  bounty_elites_2: 'bounty_gen_elites',
  bounty_coins_1000: 'bounty_gen_coins',
  bounty_roster_4: 'bounty_gen_roster',
  bounty_purity_10: 'bounty_gen_purity',
};

const eliteClears = (save: AdventureSave): number =>
  LEVELS.filter(l => l.branchOf && (save.stars[l.id] ?? 0) >= 2).length;

const uniqueFighterWins = (save: AdventureSave): number =>
  Object.values(save.bountyStats?.fighterWins ?? {}).filter(n => (n ?? 0) >= 1).length;

const perfectCount = (save: AdventureSave): number =>
  Object.values(save.stars).filter(s => s >= 3).length;

/** Deterministic reader for save-wide lifetime / progression bounty metrics. */
export const readSaveMetric = (save: AdventureSave, metric: BountyMetricKey): number => {
  const stats = save.bountyStats;
  switch (metric) {
    case 'evolutionsForged':
      return stats?.evolutionsForged ?? 0;
    case 'parriesLanded':
      return stats?.parriesLanded ?? 0;
    case 'perfectStages':
      return perfectCount(save);
    case 'eliteClears':
      return eliteClears(save);
    case 'lifetimeCoins':
      return save.lifetimeCoins ?? 0;
    case 'uniqueFighterWins':
      return uniqueFighterWins(save);
    case 'purityChains':
      return stats?.purityChains ?? 0;
    case 'threeStepPurities':
      return stats?.threeStepPurities ?? 0;
    case 'rainbows':
      return stats?.rainbowSets ?? 0;
    case 'sets':
      return stats?.totalSets ?? 0;
    case 'trapsDefused':
      return stats?.trapsDefused ?? 0;
    case 'maxSingleHit':
      return stats?.biggestHit ?? 0;
    case 'maxOverkill':
      return stats?.maxOverkill ?? 0;
    default:
      return 0;
  }
};

/** Deterministic reader for single-fight FightMetrics keys (including synergy, colorSets, trick, own). */
export const readFightMetric = (metrics: FightMetrics, key: BountyMetricKey): number => {
  if (key === 'synergy_field_size_max') {
    return Math.max(metrics.maxBoardSize ?? 0, metrics.synergyPeak?.field_size ?? 0, metrics.synergy?.field_size ?? 0);
  }
  if (key === 'synergy_streaks_max') {
    return Math.max(metrics.maxCleanStreak ?? 0, metrics.synergyPeak?.streaks ?? 0, metrics.synergy?.streaks ?? 0);
  }
  if (key.startsWith('synergy_')) {
    const attr = key.slice('synergy_'.length) as SynergyAttrId;
    return Math.max(metrics.synergy?.[attr] ?? 0, metrics.synergyPeak?.[attr] ?? 0);
  }
  if (key.startsWith('colorSets:')) {
    const color = key.slice('colorSets:'.length) as Color;
    return metrics.colorSets?.[color] ?? 0;
  }
  if (key.startsWith('trick:')) {
    const trick = key.slice('trick:'.length) as TrickKind;
    return metrics.trickPayouts?.[trick] ?? 0;
  }
  if (key.startsWith('own:')) {
    const weaponId = key.slice('own:'.length);
    return metrics.ownTriggers?.[weaponId] ?? 0;
  }
  const value = (metrics as unknown as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

interface RawBounty {
  id: string;
  category: BountyCategory;
  requiresWeapon?: string;
  tier: 0 | 1 | 2 | 3;
  name: string;
  description: string;
  icon: IconName;
  scope: BountyScope;
  metric: BountyMetricKey;
  target: number;
  reward: RewardDef;
}

const buildBounty = (raw: RawBounty): BountyDef => ({
  ...raw,
  ...(raw.reward.evolution ? { rewardEvolutionId: raw.reward.evolution } : {}),
  ...(raw.reward.weapons?.[0] ? { rewardWeaponId: raw.reward.weapons[0] } : {}),
  ...(raw.reward.arcana ? { rewardArcanaId: raw.reward.arcana } : {}),
  progress: (save: AdventureSave): number => {
    if (save.completedBounties.includes(raw.id)) return raw.target;
    if (!raw.requiresWeapon && (raw.scope === 'save' || raw.scope === 'cumulative')) {
      return readSaveMetric(save, raw.metric);
    }
    return save.bountyProgress?.[raw.id] ?? 0;
  },
});

const RAW_BOUNTIES: readonly RawBounty[] = [
  { id: "bounty_blast_powder_1", category: "weapon_intro", requiresWeapon: "blast-powder", tier: 1, name: "Powder Trial", description: "Trigger 5 explosions in a single fight with Blast Powder equipped.", icon: "lorc/bright-explosion", scope: "single_fight", metric: "blasts", target: 5, reward: { coins: 100, weapons: ["chaos-conduit"] } },
  { id: "bounty_blast_powder_2", category: "weapon_feat", requiresWeapon: "blast-powder", tier: 2, name: "Chain Detonation", description: "Destroy 6+ cards in a single Set turn with Blast Powder equipped.", icon: "lorc/sparky-bomb", scope: "single_fight", metric: "maxCardsDestroyedInSet", target: 6, reward: { coins: 140, evolution: "chaos-conduit:static-discharge" } },
  { id: "bounty_blast_powder_3", category: "weapon_mastery", requiresWeapon: "blast-powder", tier: 3, name: "Scorched Meadow", description: "Destroy 18+ cards in one fight while wielding Blast Powder.", icon: "lorc/bombing-run", scope: "single_fight", metric: "synergy_destruction", target: 18, reward: { coins: 200, evolution: "flint-spark:hellfire-corona" } },
  { id: "bounty_rainbow_charm_1", category: "weapon_intro", requiresWeapon: "rainbow-charm", tier: 1, name: "First Spectrum", description: "Land 5 Rainbow Sets across fights with Rainbow Charm equipped.", icon: "lorc/rainbow-star", scope: "cumulative", metric: "rainbows", target: 5, reward: { coins: 90, evolution: "rainbow-charm:spectrum-flare" } },
  { id: "bounty_rainbow_charm_2", category: "weapon_feat", requiresWeapon: "rainbow-charm", tier: 2, name: "Prism Collector", description: "Land 4 Rainbow Sets in a single fight with Rainbow Charm equipped.", icon: "delapouite/sparkles", scope: "single_fight", metric: "rainbows", target: 4, reward: { coins: 140, weapons: ["collectors-album"], evolution: "collectors-album:foil-edition" } },
  { id: "bounty_rainbow_charm_3", category: "weapon_mastery", requiresWeapon: "rainbow-charm", tier: 3, name: "Chromatic Mastery", description: "Reach 10+ Prism synergy in a single fight with Rainbow Charm equipped.", icon: "delapouite/galaxy", scope: "single_fight", metric: "synergy_prism", target: 10, reward: { coins: 210, evolution: "catalyst-prism:harmonic-convergence" } },
  { id: "bounty_flint_spark_1", category: "weapon_intro", requiresWeapon: "flint-spark", tier: 1, name: "Kindling", description: "Burn 12 cards across fights with Flint Spark equipped.", icon: "lorc/campfire", scope: "cumulative", metric: "cardsBurned", target: 12, reward: { coins: 95, evolution: "flint-spark:cinder-trail" } },
  { id: "bounty_flint_spark_2", category: "weapon_feat", requiresWeapon: "flint-spark", tier: 2, name: "Arsonist", description: "Burn 10+ cards in a single fight with Flint Spark equipped.", icon: "lorc/fire-ring", scope: "single_fight", metric: "cardsBurned", target: 10, reward: { coins: 150, weapons: ["cascade-core"], evolution: "cascade-core:ember-swarm" } },
  { id: "bounty_flint_spark_3", category: "weapon_mastery", requiresWeapon: "flint-spark", tier: 3, name: "Wildfire Architect", description: "Reach 16+ Burn synergy in a single fight with Flint Spark equipped.", icon: "lorc/flame-tunnel", scope: "single_fight", metric: "synergy_burn", target: 16, reward: { coins: 210, evolution: "blast-powder:supernova-core" } },
  { id: "bounty_prismatic_ray_1", category: "weapon_intro", requiresWeapon: "prismatic-ray", tier: 1, name: "Line of Fire", description: "Fire 6 lasers across fights with Prismatic Ray equipped.", icon: "lorc/laser-warning", scope: "cumulative", metric: "lasers", target: 6, reward: { coins: 95, evolution: "prismatic-ray:sweep-beam" } },
  { id: "bounty_prismatic_ray_2", category: "weapon_feat", requiresWeapon: "prismatic-ray", tier: 2, name: "Spectrum Barrage", description: "Fire 5+ lasers in a single fight with Prismatic Ray equipped.", icon: "lorc/laser-blast", scope: "single_fight", metric: "lasers", target: 5, reward: { coins: 150, weapons: ["mirror-shard"], evolution: "mirror-shard:looking-glass" } },
  { id: "bounty_prismatic_ray_3", category: "weapon_mastery", requiresWeapon: "prismatic-ray", tier: 3, name: "Laser Surgery", description: "Deal 65+ damage in one Set turn with Prismatic Ray equipped.", icon: "lorc/laser-precision", scope: "single_fight", metric: "maxSingleHit", target: 65, reward: { coins: 210, evolution: "rainbow-charm:prismatic-apotheosis" } },
  { id: "bounty_chaos_shard_1", category: "weapon_intro", requiresWeapon: "chaos-shard", tier: 1, name: "First Bounce", description: "Land 12 ricochet hits across fights with Chaos Shard equipped.", icon: "lorc/chained-arrow-heads", scope: "cumulative", metric: "ricochets", target: 12, reward: { coins: 95, evolution: "chaos-shard:pinball-frenzy" } },
  { id: "bounty_chaos_shard_2", category: "weapon_feat", requiresWeapon: "chaos-shard", tier: 2, name: "Pinball Wizard", description: "Land 12+ ricochet hits in a single fight with Chaos Shard equipped.", icon: "lorc/bouncing-sword", scope: "single_fight", metric: "ricochets", target: 12, reward: { coins: 150, weapons: ["devils-bargain"], evolution: "devils-bargain:brimstone-contract" } },
  { id: "bounty_chaos_shard_3", category: "weapon_mastery", requiresWeapon: "chaos-shard", tier: 3, name: "Unending Ricochet", description: "Chain 4+ ricochets from a single Set with Chaos Shard equipped.", icon: "lorc/vortex", scope: "single_fight", metric: "maxRicochetChain", target: 4, reward: { coins: 210, evolution: "pinata:gilded-jackpot" } },
  { id: "bounty_war_drum_1", category: "weapon_intro", requiresWeapon: "war-drum", tier: 1, name: "Keep the Beat", description: "Sound War Drum 4 times across fights.", icon: "delapouite/drum", scope: "cumulative", metric: "own:war-drum", target: 4, reward: { coins: 95, evolution: "war-drum:battle-cadence" } },
  { id: "bounty_war_drum_2", category: "weapon_feat", requiresWeapon: "war-drum", tier: 2, name: "Drumline Blitz", description: "Sound War Drum 4+ times in a single fight.", icon: "skoll/sound-waves", scope: "single_fight", metric: "own:war-drum", target: 4, reward: { coins: 150, weapons: ["amplifier-coil"], evolution: "amplifier-coil:power-grid" } },
  { id: "bounty_war_drum_3", category: "weapon_mastery", requiresWeapon: "war-drum", tier: 3, name: "Warpath Tempo", description: "Reach 20+ base damage on one Set with War Drum equipped.", icon: "delapouite/trumpet-flag", scope: "single_fight", metric: "maxBaseDamage", target: 20, reward: { coins: 210, evolution: "rally-horn:brass-apocalypse" } },
  { id: "bounty_rally_horn_1", category: "weapon_intro", requiresWeapon: "rally-horn", tier: 1, name: "Sound the Charge", description: "Trigger Rally Horn 6 times across fights.", icon: "lorc/hunting-horn", scope: "cumulative", metric: "own:rally-horn", target: 6, reward: { coins: 90, evolution: "rally-horn:vanguard-blast" } },
  { id: "bounty_rally_horn_2", category: "weapon_feat", requiresWeapon: "rally-horn", tier: 2, name: "Horn of Valor", description: "Trigger Rally Horn 5+ times in a single fight.", icon: "lorc/sonic-shout", scope: "single_fight", metric: "own:rally-horn", target: 5, reward: { coins: 145, weapons: ["echo-stone"], evolution: "echo-stone:lullaby-chime" } },
  { id: "bounty_rally_horn_3", category: "weapon_mastery", requiresWeapon: "rally-horn", tier: 3, name: "Opening Haymaker", description: "Deal 25+ overkill damage on a KO with Rally Horn equipped.", icon: "lorc/sonic-boom", scope: "single_fight", metric: "maxOverkill", target: 25, reward: { coins: 205, evolution: "war-drum:warpath-crescendo" } },
  { id: "bounty_pinata_1", category: "weapon_intro", requiresWeapon: "pinata", tier: 1, name: "Candy Cracker", description: "Break 4 Piñata cards across fights.", icon: "delapouite/pinata", scope: "cumulative", metric: "pinatasBroken", target: 4, reward: { coins: 90, evolution: "pinata:candy-barrage" } },
  { id: "bounty_pinata_2", category: "weapon_feat", requiresWeapon: "pinata", tier: 2, name: "Fiesta Fury", description: "Break 4+ Piñata cards in a single fight.", icon: "delapouite/present", scope: "single_fight", metric: "pinatasBroken", target: 4, reward: { coins: 145, weapons: ["fortune-token"], evolution: "fortune-token:clover-field" } },
  { id: "bounty_pinata_3", category: "weapon_mastery", requiresWeapon: "pinata", tier: 3, name: "Sugar Rush Slam", description: "Land a 22+ base-damage Set with Piñata equipped.", icon: "delapouite/barrel", scope: "single_fight", metric: "maxBaseDamage", target: 22, reward: { coins: 205, evolution: "twin-seed:mirrored-echo" } },
  { id: "bounty_amplifier_coil_1", category: "weapon_intro", requiresWeapon: "amplifier-coil", tier: 1, name: "Double Tap", description: "Double 6 weapon triggers across fights with Amplifier Coil.", icon: "lorc/tesla-coil", scope: "cumulative", metric: "doubledTriggers", target: 6, reward: { coins: 100, evolution: "amplifier-coil:overvolt-arc" } },
  { id: "bounty_amplifier_coil_2", category: "weapon_feat", requiresWeapon: "amplifier-coil", tier: 2, name: "Overclocked Coil", description: "Double 6+ weapon triggers in a single fight with Amplifier Coil.", icon: "lorc/power-lightning", scope: "single_fight", metric: "doubledTriggers", target: 6, reward: { coins: 155, evolution: "war-drum:thunder-anthem" } },
  { id: "bounty_amplifier_coil_3", category: "weapon_mastery", requiresWeapon: "amplifier-coil", tier: 3, name: "Belt Resonance", description: "Have 2+ weapons evolved at once with Amplifier Coil equipped.", icon: "lorc/lightning-helix", scope: "single_fight", metric: "maxSimultaneousEvos", target: 2, reward: { coins: 220, evolution: "prismatic-ray:orbital-lance" } },
  { id: "bounty_magnet_1", category: "weapon_intro", requiresWeapon: "magnet", tier: 1, name: "True North", description: "Match 8 Magnet-marked cards across fights.", icon: "lorc/magnet", scope: "cumulative", metric: "trick:magnet", target: 8, reward: { coins: 95, evolution: "magnet:lodestone-pull" } },
  { id: "bounty_magnet_2", category: "weapon_feat", requiresWeapon: "magnet", tier: 2, name: "Iron Pull", description: "Match 7+ Magnet-marked cards in a single fight.", icon: "lorc/magnet-blast", scope: "single_fight", metric: "trick:magnet", target: 7, reward: { coins: 150, weapons: ["greedy-chest"], evolution: "greedy-chest:mimic-bite" } },
  { id: "bounty_magnet_3", category: "weapon_mastery", requiresWeapon: "magnet", tier: 3, name: "Polar Attraction", description: "Reach 14+ Marks synergy in a single fight with Magnet equipped.", icon: "delapouite/metal-detector", scope: "single_fight", metric: "synergy_marks", target: 14, reward: { coins: 210, evolution: "bounty-poster:witch-hunt" } },
  { id: "bounty_bounty_poster_1", category: "weapon_intro", requiresWeapon: "bounty-poster", tier: 1, name: "Wanted Alive", description: "Match 9 Wanted cards across fights with Bounty Poster.", icon: "delapouite/wanted-reward", scope: "cumulative", metric: "trick:bounty", target: 9, reward: { coins: 100, evolution: "bounty-poster:dead-or-alive" } },
  { id: "bounty_bounty_poster_2", category: "weapon_feat", requiresWeapon: "bounty-poster", tier: 2, name: "Posse Roundup", description: "Match 8+ Wanted cards in a single fight with Bounty Poster.", icon: "delapouite/cowboy-holster", scope: "single_fight", metric: "trick:bounty", target: 8, reward: { coins: 155, weapons: ["decoy"], evolution: "decoy:red-herring" } },
  { id: "bounty_bounty_poster_3", category: "weapon_mastery", requiresWeapon: "bounty-poster", tier: 3, name: "Sheriff of the Board", description: "Collect 28+ coins in a single fight with Bounty Poster equipped.", icon: "delapouite/prisoner", scope: "single_fight", metric: "synergy_coins", target: 28, reward: { coins: 215, evolution: "magnet:gold-detector" } },
  { id: "bounty_mirror_shard_1", category: "weapon_intro", requiresWeapon: "mirror-shard", tier: 1, name: "Double Take", description: "Score 8 Mirror Sets (reusing a previous slot) across fights.", icon: "lorc/mirror-mirror", scope: "cumulative", metric: "trick:mirror", target: 8, reward: { coins: 100, evolution: "mirror-shard:hall-of-mirrors" } },
  { id: "bounty_mirror_shard_2", category: "weapon_feat", requiresWeapon: "mirror-shard", tier: 2, name: "Infinite Reflection", description: "Score 7+ Mirror Sets in a single fight.", icon: "lorc/portal", scope: "single_fight", metric: "trick:mirror", target: 7, reward: { coins: 155, weapons: ["understudy"], evolution: "understudy:body-double" } },
  { id: "bounty_mirror_shard_3", category: "weapon_mastery", requiresWeapon: "mirror-shard", tier: 3, name: "Glass Labyrinth", description: "Hit an 8-Set clean streak in one fight with Mirror Shard equipped.", icon: "delapouite/door", scope: "single_fight", metric: "maxCleanStreak", target: 8, reward: { coins: 215, evolution: "tightrope:acrobat-encore" } },
  { id: "bounty_odd_one_out_1", category: "weapon_intro", requiresWeapon: "odd-one-out", tier: 1, name: "Spot the Oddball", description: "Land 8 Odd One Out (1-diff) Sets across fights.", icon: "delapouite/puzzle", scope: "cumulative", metric: "trick:odd", target: 8, reward: { coins: 95, evolution: "odd-one-out:spot-the-difference" } },
  { id: "bounty_odd_one_out_2", category: "weapon_feat", requiresWeapon: "odd-one-out", tier: 2, name: "Single Thread", description: "Land 4+ Sets where ONLY the number differs in a single fight with Odd One Out.", icon: "lorc/spectacles", scope: "single_fight", metric: "numberOnlyDiffSets", target: 4, reward: { coins: 155, weapons: ["cursed-idol"], evolution: "cursed-idol:ancient-relic" } },
  { id: "bounty_odd_one_out_3", category: "weapon_mastery", requiresWeapon: "odd-one-out", tier: 3, name: "Escalation Artist", description: "Trigger 3+ Escalating Purity chains in one fight with Odd One Out.", icon: "lorc/spectacle-lenses", scope: "single_fight", metric: "purityChains", target: 3, reward: { coins: 215, evolution: "collectors-album:mint-completion" } },
  { id: "bounty_collectors_album_1", category: "weapon_intro", requiresWeapon: "collectors-album", tier: 1, name: "First Stamp", description: "Stamp 6 Album pages across fights with Collector’s Album.", icon: "delapouite/post-stamp", scope: "cumulative", metric: "trick:album", target: 6, reward: { coins: 100, evolution: "collectors-album:sticker-book" } },
  { id: "bounty_collectors_album_2", category: "weapon_feat", requiresWeapon: "collectors-album", tier: 2, name: "Binder Complete", description: "Stamp 6+ Album pages in a single fight (2 full 3-trait Albums!).", icon: "delapouite/notebook", scope: "single_fight", metric: "trick:album", target: 6, reward: { coins: 155, evolution: "rainbow-charm:chroma-cascade" } },
  { id: "bounty_collectors_album_3", category: "weapon_mastery", requiresWeapon: "collectors-album", tier: 3, name: "Mint Condition", description: "Match 4+ Holo cards in a single fight with Collector’s Album.", icon: "quoting/card-pickup", scope: "single_fight", metric: "holoCards", target: 4, reward: { coins: 220, evolution: "odd-one-out:purity-conductor" } },
  { id: "bounty_snowball_1", category: "weapon_intro", requiresWeapon: "snowball", tier: 1, name: "Rolling Start", description: "Score 18 valid Sets across fights with Snowball equipped.", icon: "lorc/snowman", scope: "cumulative", metric: "sets", target: 18, reward: { coins: 95, evolution: "snowball:avalanche-roll" } },
  { id: "bounty_snowball_2", category: "weapon_feat", requiresWeapon: "snowball", tier: 2, name: "Unbroken Drift", description: "Hit a 7-Set clean streak in one fight with Snowball equipped.", icon: "lorc/snowing", scope: "single_fight", metric: "maxCleanStreak", target: 7, reward: { coins: 150, weapons: ["glass-sword"], evolution: "glass-sword:knife-edge-parry" } },
  { id: "bounty_snowball_3", category: "weapon_mastery", requiresWeapon: "snowball", tier: 3, name: "Whiteout Sweep", description: "Reach a 10+ streak in a single fight with Snowball equipped.", icon: "lorc/snowflake-1", scope: "single_fight", metric: "synergy_streaks_max", target: 10, reward: { coins: 215, evolution: "ice-block:absolute-zero" } },
  { id: "bounty_glass_sword_1", category: "weapon_intro", requiresWeapon: "glass-sword", tier: 1, name: "Razor Tempo", description: "Score 10 quick Sets (<4.5s) across fights with Glass Sword.", icon: "lorc/shard-sword", scope: "cumulative", metric: "quickSets", target: 10, reward: { coins: 105, evolution: "glass-sword:tempered-edge" } },
  { id: "bounty_glass_sword_2", category: "weapon_feat", requiresWeapon: "glass-sword", tier: 2, name: "Untouched Edge", description: "Score 7+ quick Sets in a single fight with Glass Sword equipped.", icon: "lorc/anvil-impact", scope: "single_fight", metric: "quickSets", target: 7, reward: { coins: 160, evolution: "snowball:frostbite-glide" } },
  { id: "bounty_glass_sword_3", category: "weapon_mastery", requiresWeapon: "glass-sword", tier: 3, name: "Flawless Duelist", description: "Hit 24+ base damage on one Set with Glass Sword equipped.", icon: "lorc/bowie-knife", scope: "single_fight", metric: "maxBaseDamage", target: 24, reward: { coins: 225, evolution: "devils-bargain:faustian-zenith" } },
  { id: "bounty_devils_bargain_1", category: "weapon_intro", requiresWeapon: "devils-bargain", tier: 1, name: "Signed in Ink", description: "Score 15 Sets across fights while bearing Devil’s Bargain.", icon: "delapouite/devil-mask", scope: "cumulative", metric: "sets", target: 15, reward: { coins: 105, evolution: "devils-bargain:blood-tithe" } },
  { id: "bounty_devils_bargain_2", category: "weapon_feat", requiresWeapon: "devils-bargain", tier: 2, name: "Living on the Edge", description: "Land a 55+ damage Set turn with Devil’s Bargain equipped.", icon: "zeromancer/heart-minus", scope: "single_fight", metric: "maxSingleHit", target: 55, reward: { coins: 160, evolution: "life-link:martyrs-retort" } },
  { id: "bounty_devils_bargain_3", category: "weapon_mastery", requiresWeapon: "devils-bargain", tier: 3, name: "Infernal Payout", description: "Reach 12+ Burn synergy in one fight with Devil’s Bargain.", icon: "skoll/pentacle", scope: "single_fight", metric: "synergy_burn", target: 12, reward: { coins: 220, evolution: "glass-sword:diamond-cleave" } },
  { id: "bounty_tightrope_1", category: "weapon_intro", requiresWeapon: "tightrope", tier: 1, name: "Balanced Step", description: "Land 8 Tightrope Sets touching your last Set across fights.", icon: "delapouite/tightrope", scope: "cumulative", metric: "trick:tightrope", target: 8, reward: { coins: 100, evolution: "tightrope:high-wire-act" } },
  { id: "bounty_tightrope_2", category: "weapon_feat", requiresWeapon: "tightrope", tier: 2, name: "High-Wire Marathon", description: "Land 7+ Tightrope Sets in a single fight.", icon: "darkzaitzev/acrobatic", scope: "single_fight", metric: "trick:tightrope", target: 7, reward: { coins: 155, evolution: "chain-gang:ball-and-chain" } },
  { id: "bounty_tightrope_3", category: "weapon_mastery", requiresWeapon: "tightrope", tier: 3, name: "No-Net Virtuoso", description: "Land 3+ Parries in a single fight with Tightrope equipped.", icon: "delapouite/direction-signs", scope: "single_fight", metric: "parries", target: 3, reward: { coins: 215, evolution: "mirror-shard:silver-reflection" } },
  { id: "bounty_understudy_1", category: "weapon_intro", requiresWeapon: "understudy", tier: 1, name: "Learn the Lines", description: "Score 15 Sets across fights with Understudy copying a charm.", icon: "lorc/two-shadows", scope: "cumulative", metric: "sets", target: 15, reward: { coins: 110, evolution: "understudy:dress-rehearsal" } },
  { id: "bounty_understudy_2", category: "weapon_feat", requiresWeapon: "understudy", tier: 2, name: "Scene Stealer", description: "Trigger 3+ weapon evolutions in a single fight with Understudy.", icon: "delapouite/theater", scope: "single_fight", metric: "evolutionsTriggered", target: 3, reward: { coins: 165, evolution: "encore-mask:curtain-of-gold" } },
  { id: "bounty_understudy_3", category: "weapon_mastery", requiresWeapon: "understudy", tier: 3, name: "Full Ensemble", description: "Have 3+ weapons evolved simultaneously with Understudy equipped.", icon: "lorc/double-face-mask", scope: "single_fight", metric: "maxSimultaneousEvos", target: 3, reward: { coins: 240, evolution: "amplifier-coil:harmonic-overload" } },
  { id: "bounty_cursed_idol_1", category: "weapon_intro", requiresWeapon: "cursed-idol", tier: 1, name: "Break the Hex", description: "Match 3 Cursed Idol reward cards across fights.", icon: "lorc/totem-head", scope: "cumulative", metric: "trick:curse", target: 3, reward: { coins: 105, evolution: "cursed-idol:evil-eye" } },
  { id: "bounty_cursed_idol_2", category: "weapon_feat", requiresWeapon: "cursed-idol", tier: 2, name: "Hex Breaker", description: "Match 3+ Cursed Idol reward cards in a single fight.", icon: "skoll/evil-eyes", scope: "single_fight", metric: "trick:curse", target: 3, reward: { coins: 165, evolution: "odd-one-out:outlier-surge" } },
  { id: "bounty_cursed_idol_3", category: "weapon_mastery", requiresWeapon: "cursed-idol", tier: 3, name: "Cursed Fortune", description: "Clear 8+ hazards/curses in a single fight with Cursed Idol.", icon: "lorc/cursed-star", scope: "single_fight", metric: "synergy_hazards", target: 8, reward: { coins: 225, evolution: "fog-lantern:whiteout-mirage" } },
  { id: "bounty_chain_gang_1", category: "weapon_intro", requiresWeapon: "chain-gang", tier: 1, name: "Break Together", description: "Match 5 Chained pairs together across fights.", icon: "lorc/crossed-chains", scope: "cumulative", metric: "trick:chain", target: 5, reward: { coins: 100, evolution: "chain-gang:shackle-line" } },
  { id: "bounty_chain_gang_2", category: "weapon_feat", requiresWeapon: "chain-gang", tier: 2, name: "Chain Gang Breakout", description: "Match 4+ Chained pairs together in a single fight.", icon: "lorc/manacles", scope: "single_fight", metric: "trick:chain", target: 4, reward: { coins: 155, weapons: ["web-weaver"], evolution: "web-weaver:web-of-echoes" } },
  { id: "bounty_chain_gang_3", category: "weapon_mastery", requiresWeapon: "chain-gang", tier: 3, name: "Shackled Web", description: "Reach 10+ Links synergy in a single fight with Chain Gang.", icon: "delapouite/flail", scope: "single_fight", metric: "synergy_links", target: 10, reward: { coins: 220, evolution: "connector:circuit-breaker" } },
  { id: "bounty_thorn_bush_1", category: "weapon_intro", requiresWeapon: "thorn-bush", tier: 1, name: "Quick Prune", description: "Clear 5 Thorn cards in time across fights.", icon: "lorc/thorny-vine", scope: "cumulative", metric: "trick:thorn", target: 5, reward: { coins: 105, evolution: "thorn-bush:rose-garden" } },
  { id: "bounty_thorn_bush_2", category: "weapon_feat", requiresWeapon: "thorn-bush", tier: 2, name: "Rose Harvester", description: "Clear 4+ Thorn cards in a single fight.", icon: "lorc/rose", scope: "single_fight", metric: "trick:thorn", target: 4, reward: { coins: 160, evolution: "growth-seed:sunflower-harvest" } },
  { id: "bounty_thorn_bush_3", category: "weapon_mastery", requiresWeapon: "thorn-bush", tier: 3, name: "Briar Warden", description: "Clear 7+ hazards/thorns in a single fight with Thorn Bush.", icon: "lorc/crown-of-thorns", scope: "single_fight", metric: "synergy_hazards", target: 7, reward: { coins: 220, evolution: "tar-pit:fossil-amber" } },
  { id: "bounty_rust_1", category: "weapon_intro", requiresWeapon: "rust", tier: 1, name: "First Patina", description: "Match 3 Golden Rust cards across fights.", icon: "delapouite/rusty-sword", scope: "cumulative", metric: "trick:rust", target: 3, reward: { coins: 105, evolution: "rust:patina-polish" } },
  { id: "bounty_rust_2", category: "weapon_feat", requiresWeapon: "rust", tier: 2, name: "Patient Alchemist", description: "Match 3+ Golden Rust cards in a single fight.", icon: "delapouite/amphora", scope: "single_fight", metric: "trick:rust", target: 3, reward: { coins: 165, evolution: "fortunes-favor:gold-rush-blast" } },
  { id: "bounty_rust_3", category: "weapon_mastery", requiresWeapon: "rust", tier: 3, name: "Gilded Reliquary", description: "Earn 32+ coins in a single fight with Rust equipped.", icon: "delapouite/gold-stack", scope: "single_fight", metric: "synergy_coins", target: 32, reward: { coins: 225, evolution: "greedy-chest:kings-vault" } },
  { id: "bounty_tar_pit_1", category: "weapon_intro", requiresWeapon: "tar-pit", tier: 1, name: "Wade In", description: "Score 8 Sets touching the Tar Pit row across fights.", icon: "delapouite/sticky-boot", scope: "cumulative", metric: "trick:tar", target: 8, reward: { coins: 105, evolution: "tar-pit:quicksand-snare" } },
  { id: "bounty_tar_pit_2", category: "weapon_feat", requiresWeapon: "tar-pit", tier: 2, name: "Swamp Dweller", description: "Score 7+ Tar Pit Sets in a single fight.", icon: "delapouite/swamp", scope: "single_fight", metric: "trick:tar", target: 7, reward: { coins: 160, evolution: "field-stone:megalith-quiver" } },
  { id: "bounty_tar_pit_3", category: "weapon_mastery", requiresWeapon: "tar-pit", tier: 3, name: "Boiling Pitch", description: "Burn 8+ cards in a single fight with Tar Pit equipped.", icon: "lorc/quicksand", scope: "single_fight", metric: "cardsBurned", target: 8, reward: { coins: 220, evolution: "thorn-bush:crown-of-thorns" } },
  { id: "bounty_decoy_1", category: "weapon_intro", requiresWeapon: "decoy", tier: 1, name: "Sharp Sleuth", description: "Catch 3 Decoy pairs across fights.", icon: "delapouite/plastic-duck", scope: "cumulative", metric: "trick:decoy", target: 3, reward: { coins: 105, evolution: "decoy:private-eye" } },
  { id: "bounty_decoy_2", category: "weapon_feat", requiresWeapon: "decoy", tier: 2, name: "Case Closed", description: "Catch 3+ Decoy pairs in a single fight.", icon: "lorc/fedora", scope: "single_fight", metric: "trick:decoy", target: 3, reward: { coins: 165, evolution: "bounty-poster:most-wanted" } },
  { id: "bounty_decoy_3", category: "weapon_mastery", requiresWeapon: "decoy", tier: 3, name: "Unmasked Bluff", description: "Score 6+ single-difference Sets in one fight with Decoy.", icon: "lorc/domino-mask", scope: "single_fight", metric: "oneDiffSets", target: 6, reward: { coins: 225, evolution: "wild-card:chaos-royal" } },
  { id: "bounty_long_fuse_1", category: "weapon_intro", requiresWeapon: "long-fuse", tier: 1, name: "Steady Nerve", description: "Match 3 Short-Fuse cards in their hot red window across fights.", icon: "delapouite/time-dynamite", scope: "cumulative", metric: "trick:fuse", target: 3, reward: { coins: 105, evolution: "long-fuse:countdown-rush" } },
  { id: "bounty_long_fuse_2", category: "weapon_feat", requiresWeapon: "long-fuse", tier: 2, name: "Red Wire Specialist", description: "Match 3+ hot Short-Fuse cards in a single fight.", icon: "delapouite/alarm-clock", scope: "single_fight", metric: "trick:fuse", target: 3, reward: { coins: 165, evolution: "blast-powder:napalm-payload" } },
  { id: "bounty_long_fuse_3", category: "weapon_mastery", requiresWeapon: "long-fuse", tier: 3, name: "Last-Second Blast", description: "Land 2+ Perfect Parries in one fight with Long Fuse equipped.", icon: "delapouite/matchbox", scope: "single_fight", metric: "perfectParries", target: 2, reward: { coins: 225, evolution: "hot-potato:volcanic-toss" } },
  { id: "bounty_ice_block_1", category: "weapon_intro", requiresWeapon: "ice-block", tier: 1, name: "First Thaw", description: "Thaw and match 2 Ice Block cards across fights.", icon: "lorc/frozen-block", scope: "cumulative", metric: "trick:ice", target: 2, reward: { coins: 105, evolution: "ice-block:glacier-clock" } },
  { id: "bounty_ice_block_2", category: "weapon_feat", requiresWeapon: "ice-block", tier: 2, name: "Icebreaker", description: "Thaw and match 2+ Ice Block cards in a single fight.", icon: "delapouite/iceberg", scope: "single_fight", metric: "trick:ice", target: 2, reward: { coins: 165, evolution: "chrono-shard:time-sight" } },
  { id: "bounty_ice_block_3", category: "weapon_mastery", requiresWeapon: "ice-block", tier: 3, name: "Deep Winter Strike", description: "Deal 75+ damage in one Set turn with Ice Block equipped.", icon: "lorc/ice-cube", scope: "single_fight", metric: "maxSingleHit", target: 75, reward: { coins: 230, evolution: "snowball:glacier-juggernaut" } },
  { id: "bounty_greedy_chest_1", category: "weapon_intro", requiresWeapon: "greedy-chest", tier: 1, name: "Crack the Lid", description: "Cash in 4 Greedy Chests across fights.", icon: "delapouite/mimic-chest", scope: "cumulative", metric: "trick:chest", target: 4, reward: { coins: 100, evolution: "greedy-chest:treasure-hunt" } },
  { id: "bounty_greedy_chest_2", category: "weapon_feat", requiresWeapon: "greedy-chest", tier: 2, name: "Heavy Vault", description: "Cash in 3+ Greedy Chests in a single fight.", icon: "skoll/open-treasure-chest", scope: "single_fight", metric: "trick:chest", target: 3, reward: { coins: 155, evolution: "magnet:shrapnel-magnet" } },
  { id: "bounty_greedy_chest_3", category: "weapon_mastery", requiresWeapon: "greedy-chest", tier: 3, name: "Dragon’s Hoard", description: "Hit 26+ base damage on a single Set with Greedy Chest.", icon: "lorc/crown", scope: "single_fight", metric: "maxBaseDamage", target: 26, reward: { coins: 225, evolution: "rust:alchemical-gold" } },
  { id: "bounty_hot_potato_1", category: "weapon_intro", requiresWeapon: "hot-potato", tier: 1, name: "Quick Catch", description: "Match 5 Hot Potato cards across fights.", icon: "delapouite/potato", scope: "cumulative", metric: "trick:potato", target: 5, reward: { coins: 105, evolution: "hot-potato:hot-shrapnel" } },
  { id: "bounty_hot_potato_2", category: "weapon_feat", requiresWeapon: "hot-potato", tier: 2, name: "Kitchen Chaos", description: "Match 4+ Hot Potato cards in a single fight.", icon: "delapouite/fried-eggs", scope: "single_fight", metric: "trick:potato", target: 4, reward: { coins: 160, evolution: "flint-spark:smelting-forge" } },
  { id: "bounty_hot_potato_3", category: "weapon_mastery", requiresWeapon: "hot-potato", tier: 3, name: "Magma Juggler", description: "Match 5+ Orange (O) Sets in one fight with Hot Potato.", icon: "delapouite/fire-gem", scope: "single_fight", metric: "colorSets:red", target: 5, reward: { coins: 220, evolution: "long-fuse:demolition-clock" } },
  { id: "bounty_twin_seed_1", category: "weapon_intro", requiresWeapon: "twin-seed", tier: 1, name: "Double Pop", description: "Pop 6 Twin pairs across fights.", icon: "delapouite/gemini", scope: "cumulative", metric: "trick:twin", target: 6, reward: { coins: 100, evolution: "twin-seed:burning-twins" } },
  { id: "bounty_twin_seed_2", category: "weapon_feat", requiresWeapon: "twin-seed", tier: 2, name: "Seeing Double", description: "Pop 5+ Twin pairs in a single fight.", icon: "lorc/twin-shell", scope: "single_fight", metric: "trick:twin", target: 5, reward: { coins: 155, evolution: "pinata:powder-keg" } },
  { id: "bounty_twin_seed_3", category: "weapon_mastery", requiresWeapon: "twin-seed", tier: 3, name: "Twin Tempest", description: "Destroy 16+ cards in a single fight with Twin Seed equipped.", icon: "lorc/body-swapping", scope: "single_fight", metric: "synergy_destruction", target: 16, reward: { coins: 220, evolution: "field-stone:horizon-monolith" } },
  { id: "bounty_fog_lantern_1", category: "weapon_intro", requiresWeapon: "fog-lantern", tier: 1, name: "Mist Watcher", description: "Match 5 cards lifted from Fog across fights.", icon: "lorc/lantern-flame", scope: "cumulative", metric: "trick:fog", target: 5, reward: { coins: 105, evolution: "fog-lantern:lighthouse-beam" } },
  { id: "bounty_fog_lantern_2", category: "weapon_feat", requiresWeapon: "fog-lantern", tier: 2, name: "Beacon Keeper", description: "Match 4+ Fog-empowered cards in a single fight.", icon: "delapouite/fog-light", scope: "single_fight", metric: "trick:fog", target: 4, reward: { coins: 160, evolution: "oracle-eye:clairvoyant-care" } },
  { id: "bounty_fog_lantern_3", category: "weapon_mastery", requiresWeapon: "fog-lantern", tier: 3, name: "Clarity in the Dark", description: "Score 4+ Hinted Sets in one fight with Fog Lantern equipped.", icon: "lorc/fluffy-cloud", scope: "single_fight", metric: "hintedSets", target: 4, reward: { coins: 220, evolution: "cursed-idol:hex-monolith" } },
  { id: "bounty_field_stone_1", category: "weapon_intro", requiresWeapon: "field-stone", tier: 1, name: "Wide Meadow", description: "Score 16 Sets across fights with Field Stone equipped.", icon: "lorc/field", scope: "cumulative", metric: "sets", target: 16, reward: { coins: 90, evolution: "field-stone:fertile-expanse" } },
  { id: "bounty_field_stone_2", category: "weapon_feat", requiresWeapon: "field-stone", tier: 2, name: "Sprawling Pasture", description: "Expand the board to 18+ cards in a single fight with Field Stone.", icon: "lorc/stone-sphere", scope: "single_fight", metric: "maxBoardSize", target: 18, reward: { coins: 145, weapons: ["tar-pit"], evolution: "tar-pit:mangrove-mire" } },
  { id: "bounty_field_stone_3", category: "weapon_mastery", requiresWeapon: "field-stone", tier: 3, name: "Mega-Board Master", description: "Match 6+ Charged/Power cards in one fight with Field Stone.", icon: "lorc/stone-tablet", scope: "single_fight", metric: "powerCards", target: 6, reward: { coins: 210, evolution: "growth-seed:world-tree" } },
  { id: "bounty_growth_seed_1", category: "weapon_intro", requiresWeapon: "growth-seed", tier: 1, name: "First Sprout", description: "Reach a 16+ card board in a fight with Growth Seed equipped.", icon: "delapouite/card-exchange", scope: "single_fight", metric: "synergy_field_size_max", target: 16, reward: { coins: 95, evolution: "growth-seed:overgrowth-bloom" } },
  { id: "bounty_growth_seed_2", category: "weapon_feat", requiresWeapon: "growth-seed", tier: 2, name: "Wild Garden", description: "Grow the board to 19+ cards in a single fight with Growth Seed.", icon: "lorc/vine-flower", scope: "single_fight", metric: "maxBoardSize", target: 19, reward: { coins: 155, weapons: ["thorn-bush"], evolution: "thorn-bush:bramble-patch" } },
  { id: "bounty_growth_seed_3", category: "weapon_mastery", requiresWeapon: "growth-seed", tier: 3, name: "Canopy Titan", description: "Match 4+ Holo cards in a single fight with Growth Seed.", icon: "lorc/oak", scope: "single_fight", metric: "holoCards", target: 4, reward: { coins: 215, evolution: "chaos-shard:shatterstorm" } },
  { id: "bounty_clarity_lens_1", category: "weapon_intro", requiresWeapon: "clarity-lens", tier: 1, name: "Clear View", description: "Trigger Clarity simplification 4 times across fights.", icon: "lorc/magnifying-glass", scope: "cumulative", metric: "simplifies", target: 4, reward: { coins: 90, evolution: "clarity-lens:crystal-focus" } },
  { id: "bounty_clarity_lens_2", category: "weapon_feat", requiresWeapon: "clarity-lens", tier: 2, name: "Crystal Vision", description: "Trigger Clarity simplification 3+ times in a single fight.", icon: "lorc/burning-eye", scope: "single_fight", metric: "simplifies", target: 3, reward: { coins: 145, weapons: ["wild-card"], evolution: "wild-card:stacked-deck" } },
  { id: "bounty_clarity_lens_3", category: "weapon_mastery", requiresWeapon: "clarity-lens", tier: 3, name: "Effortless Flow", description: "Score 6+ single-color Sets in one fight with Clarity Lens.", icon: "delapouite/broom", scope: "single_fight", metric: "sameColorSets", target: 6, reward: { coins: 205, evolution: "oracle-eye:grand-prophecy" } },
  { id: "bounty_wild_card_1", category: "weapon_intro", requiresWeapon: "wild-card", tier: 1, name: "Wild Debut", description: "Match 4 Wild Cards across fights.", icon: "delapouite/card-joker", scope: "cumulative", metric: "trick:wild", target: 4, reward: { coins: 105, evolution: "wild-card:jokers-rainbow" } },
  { id: "bounty_wild_card_2", category: "weapon_feat", requiresWeapon: "wild-card", tier: 2, name: "Joker’s Gambit", description: "Match 3+ Wild Cards in a single fight.", icon: "delapouite/jester-hat", scope: "single_fight", metric: "trick:wild", target: 3, reward: { coins: 160, evolution: "clarity-lens:prism-optics" } },
  { id: "bounty_wild_card_3", category: "weapon_mastery", requiresWeapon: "wild-card", tier: 3, name: "Royal Flush", description: "Match 8+ special/bonus cards in one fight with Wild Card.", icon: "lorc/poker-hand", scope: "single_fight", metric: "bonusCardsMatched", target: 8, reward: { coins: 225, evolution: "decoy:master-counterfeit" } },
  { id: "bounty_mending_charm_1", category: "weapon_intro", requiresWeapon: "mending-charm", tier: 1, name: "Gentle Mend", description: "Trigger 5 heals across fights with Mending Charm equipped.", icon: "lorc/shining-heart", scope: "cumulative", metric: "heals", target: 5, reward: { coins: 90, evolution: "mending-charm:sanctuary-pulse" } },
  { id: "bounty_mending_charm_2", category: "weapon_feat", requiresWeapon: "mending-charm", tier: 2, name: "Overflowing Grace", description: "Trigger 5+ heals (including overheals) in a single fight with Mending Charm.", icon: "lorc/fireball", scope: "single_fight", metric: "heals", target: 5, reward: { coins: 150, weapons: ["soul-harvest"], evolution: "soul-harvest:pyre-of-souls" } },
  { id: "bounty_mending_charm_3", category: "weapon_mastery", requiresWeapon: "mending-charm", tier: 3, name: "Immortal Sanctuary", description: "Trigger 4+ full-HP Overheals in a single fight with Mending Charm.", icon: "lorc/heart-bottle", scope: "single_fight", metric: "overheals", target: 4, reward: { coins: 210, evolution: "life-vessel:titans-pulse" } },
  { id: "bounty_life_vessel_1", category: "weapon_intro", requiresWeapon: "life-vessel", tier: 1, name: "Deep Vitality", description: "Trigger 6 heals across fights with Life Vessel equipped.", icon: "lorc/heart-inside", scope: "cumulative", metric: "heals", target: 6, reward: { coins: 95, evolution: "life-vessel:vital-bastion" } },
  { id: "bounty_life_vessel_2", category: "weapon_feat", requiresWeapon: "life-vessel", tier: 2, name: "Iron Heart", description: "Reach 6+ Vitality synergy in a single fight with Life Vessel.", icon: "skoll/hearts", scope: "single_fight", metric: "synergy_vitality", target: 6, reward: { coins: 155, weapons: ["life-link"], evolution: "mending-charm:phoenix-pyre" } },
  { id: "bounty_life_vessel_3", category: "weapon_mastery", requiresWeapon: "life-vessel", tier: 3, name: "Unbreakable Tank", description: "Score 16+ Sets in one fight with Life Vessel equipped.", icon: "lorc/heart-organ", scope: "single_fight", metric: "sets", target: 16, reward: { coins: 215, evolution: "life-link:crimson-superpulse" } },
  { id: "bounty_life_link_1", category: "weapon_intro", requiresWeapon: "life-link", tier: 1, name: "Pulse Check", description: "Trigger 8 explosions across fights with Life Link equipped.", icon: "lorc/broken-heart", scope: "cumulative", metric: "blasts", target: 8, reward: { coins: 105, evolution: "life-link:heartblast-ward" } },
  { id: "bounty_life_link_2", category: "weapon_feat", requiresWeapon: "life-link", tier: 2, name: "Heartbreak Blast", description: "Trigger 6+ explosions in a single fight with Life Link equipped.", icon: "lorc/bleeding-heart", scope: "single_fight", metric: "blasts", target: 6, reward: { coins: 165, evolution: "life-vessel:bloodline-beam" } },
  { id: "bounty_life_link_3", category: "weapon_mastery", requiresWeapon: "life-link", tier: 3, name: "Crimson Resonance", description: "Reach 8+ Vitality synergy in one fight with Life Link.", icon: "lorc/burning-passion", scope: "single_fight", metric: "synergy_vitality", target: 8, reward: { coins: 225, evolution: "soul-harvest:spectral-choir" } },
  { id: "bounty_soul_harvest_1", category: "weapon_intro", requiresWeapon: "soul-harvest", tier: 1, name: "Reap the Board", description: "Destroy 20 cards across fights with Soul Harvest equipped.", icon: "lorc/death-note", scope: "cumulative", metric: "synergy_destruction", target: 20, reward: { coins: 105, evolution: "soul-harvest:reapers-toll" } },
  { id: "bounty_soul_harvest_2", category: "weapon_feat", requiresWeapon: "soul-harvest", tier: 2, name: "Soul Collector", description: "Heal 5+ times in a single fight with Soul Harvest equipped.", icon: "lorc/scythe", scope: "single_fight", metric: "heals", target: 5, reward: { coins: 165, evolution: "revenge-linker:trap-counter" } },
  { id: "bounty_soul_harvest_3", category: "weapon_mastery", requiresWeapon: "soul-harvest", tier: 3, name: "Phantom Scythe", description: "Destroy 20+ cards in a single fight with Soul Harvest equipped.", icon: "lorc/ghost", scope: "single_fight", metric: "synergy_destruction", target: 20, reward: { coins: 230, evolution: "mending-charm:immortal-bloom" } },
  { id: "bounty_revenge_linker_1", category: "weapon_intro", requiresWeapon: "revenge-linker", tier: 1, name: "Wire the Trap", description: "Create 8 board links across fights with Revenge Linker.", icon: "lorc/linked-rings", scope: "cumulative", metric: "linksCreated", target: 8, reward: { coins: 105, evolution: "revenge-linker:tripwire-web" } },
  { id: "bounty_revenge_linker_2", category: "weapon_feat", requiresWeapon: "revenge-linker", tier: 2, name: "Counter-Wire", description: "Destroy 6+ linked cards in a single fight with Revenge Linker.", icon: "lorc/wolf-trap", scope: "single_fight", metric: "linksDestroyed", target: 6, reward: { coins: 165, evolution: "connector:stitch-and-mend" } },
  { id: "bounty_revenge_linker_3", category: "weapon_mastery", requiresWeapon: "revenge-linker", tier: 3, name: "Payback Specialist", description: "Defuse 4+ traps/hazards in a single fight with Revenge Linker.", icon: "lorc/crossed-swords", scope: "single_fight", metric: "trapsDefused", target: 4, reward: { coins: 225, evolution: "chain-gang:iron-brotherhood" } },
  { id: "bounty_second_chance_1", category: "weapon_intro", requiresWeapon: "second-chance", tier: 1, name: "Lucky Cushion", description: "Survive 3 near-misses via Grace saves with Second Chance.", icon: "lorc/clover", scope: "cumulative", metric: "gracesSaved", target: 3, reward: { coins: 95, evolution: "second-chance:steady-hands" } },
  { id: "bounty_second_chance_2", category: "weapon_feat", requiresWeapon: "second-chance", tier: 2, name: "Charmed Life", description: "Trigger 2+ Grace saves in a single fight with Second Chance.", icon: "delapouite/stone-wall", scope: "single_fight", metric: "gracesSaved", target: 2, reward: { coins: 155, weapons: ["grace-conduit"], evolution: "grace-conduit:hymn-of-light" } },
  { id: "bounty_second_chance_3", category: "weapon_mastery", requiresWeapon: "second-chance", tier: 3, name: "Four-Leaf Mastery", description: "Reach 6+ Grace synergy in a single fight with Second Chance.", icon: "lorc/meditation", scope: "single_fight", metric: "synergy_graces", target: 6, reward: { coins: 215, evolution: "fortune-token:wishing-well" } },
  { id: "bounty_fortune_token_1", category: "weapon_intro", requiresWeapon: "fortune-token", tier: 1, name: "Token Spinner", description: "Generate 6 Grace synergy points across fights with Fortune Token.", icon: "lorc/cycle", scope: "cumulative", metric: "synergy_graces", target: 6, reward: { coins: 100, evolution: "fortune-token:lucky-coin" } },
  { id: "bounty_fortune_token_2", category: "weapon_feat", requiresWeapon: "fortune-token", tier: 2, name: "Grace Mint", description: "Reach 5+ Grace synergy in a single fight with Fortune Token.", icon: "delapouite/token", scope: "single_fight", metric: "synergy_graces", target: 5, reward: { coins: 155, evolution: "second-chance:iron-will" } },
  { id: "bounty_fortune_token_3", category: "weapon_mastery", requiresWeapon: "fortune-token", tier: 3, name: "Wishing Cascade", description: "Match 5+ Gold cards in a single fight with Fortune Token.", icon: "delapouite/well", scope: "single_fight", metric: "goldCards", target: 5, reward: { coins: 220, evolution: "chaos-conduit:stormglass-core" } },
  { id: "bounty_grace_conduit_1", category: "weapon_intro", requiresWeapon: "grace-conduit", tier: 1, name: "Divine Retort", description: "Fire 5 lasers across fights with Grace Conduit equipped.", icon: "lorc/angel-outfit", scope: "cumulative", metric: "lasers", target: 5, reward: { coins: 110, evolution: "grace-conduit:judgement-beam" } },
  { id: "bounty_grace_conduit_2", category: "weapon_feat", requiresWeapon: "grace-conduit", tier: 2, name: "Radiant Revenge", description: "Fire 4+ lasers in a single fight with Grace Conduit equipped.", icon: "delapouite/church", scope: "single_fight", metric: "lasers", target: 4, reward: { coins: 170, evolution: "prismatic-ray:prism-refraction" } },
  { id: "bounty_grace_conduit_3", category: "weapon_mastery", requiresWeapon: "grace-conduit", tier: 3, name: "Celestial Guard", description: "Reach 7+ Grace synergy in a single fight with Grace Conduit.", icon: "lorc/spiked-halo", scope: "single_fight", metric: "synergy_graces", target: 7, reward: { coins: 230, evolution: "second-chance:clover-miracle" } },
  { id: "bounty_chaos_conduit_1", category: "weapon_intro", requiresWeapon: "chaos-conduit", tier: 1, name: "Merciful Blast", description: "Trigger 8 explosions across fights with Chaos Conduit.", icon: "lorc/lightning-helix", scope: "cumulative", metric: "blasts", target: 8, reward: { coins: 105, evolution: "chaos-conduit:short-fuse-mercy" } },
  { id: "bounty_chaos_conduit_2", category: "weapon_feat", requiresWeapon: "chaos-conduit", tier: 2, name: "Volatile Grace", description: "Destroy 14+ cards in a single fight with Chaos Conduit.", icon: "delapouite/dynamite", scope: "single_fight", metric: "synergy_destruction", target: 14, reward: { coins: 165, evolution: "chaos-shard:butterfly-effect" } },
  { id: "bounty_chaos_conduit_3", category: "weapon_mastery", requiresWeapon: "chaos-conduit", tier: 3, name: "Stormbreaker", description: "Destroy 7+ cards in one Set turn with Chaos Conduit.", icon: "lorc/glass-heart", scope: "single_fight", metric: "maxCardsDestroyedInSet", target: 7, reward: { coins: 230, evolution: "grace-conduit:seraph-halo" } },
  { id: "bounty_seeker_lens_1", category: "weapon_intro", requiresWeapon: "seeker-lens", tier: 1, name: "Bright Idea", description: "Accumulate 6 Hint synergy points across fights with Seeker Lens.", icon: "lorc/light-bulb", scope: "cumulative", metric: "synergy_hints", target: 6, reward: { coins: 95, evolution: "seeker-lens:hoarders-glare" } },
  { id: "bounty_seeker_lens_2", category: "weapon_feat", requiresWeapon: "seeker-lens", tier: 2, name: "Hoarder’s Might", description: "Reach 6+ Hint synergy in a single fight with Seeker Lens.", icon: "delapouite/idea", scope: "single_fight", metric: "synergy_hints", target: 6, reward: { coins: 155, weapons: ["crystal-orb"], evolution: "crystal-orb:crystal-garden" } },
  { id: "bounty_seeker_lens_3", category: "weapon_mastery", requiresWeapon: "seeker-lens", tier: 3, name: "Flash of Genius", description: "Hit 20+ base damage on a Set with Seeker Lens equipped.", icon: "lorc/chained-arrow-heads", scope: "single_fight", metric: "maxBaseDamage", target: 20, reward: { coins: 215, evolution: "mystic-sight:sniper-trance" } },
  { id: "bounty_crystal_orb_1", category: "weapon_intro", requiresWeapon: "crystal-orb", tier: 1, name: "Frozen Glance", description: "Use 5 Hints across fights with Crystal Orb equipped.", icon: "lorc/floating-crystal", scope: "cumulative", metric: "hintsUsed", target: 5, reward: { coins: 105, evolution: "crystal-orb:time-stop-vault" } },
  { id: "bounty_crystal_orb_2", category: "weapon_feat", requiresWeapon: "crystal-orb", tier: 2, name: "Chrono-Gaze", description: "Freeze the clock 4+ times in a single fight with Crystal Orb.", icon: "lorc/crystal-ball", scope: "single_fight", metric: "freezes", target: 4, reward: { coins: 165, evolution: "seeker-lens:seeker-swarm" } },
  { id: "bounty_crystal_orb_3", category: "weapon_mastery", requiresWeapon: "crystal-orb", tier: 3, name: "Seer of the Surge", description: "Score 5+ Hinted Sets in a single fight with Crystal Orb.", icon: "lorc/gem-pendant", scope: "single_fight", metric: "hintedSets", target: 5, reward: { coins: 225, evolution: "clarity-lens:omniscient-sweep" } },
  { id: "bounty_oracle_eye_1", category: "weapon_intro", requiresWeapon: "oracle-eye", tier: 1, name: "Second Sight", description: "Score 6 Hinted Sets across fights with Oracle Eye.", icon: "lorc/sheikah-eye", scope: "cumulative", metric: "hintedSets", target: 6, reward: { coins: 95, evolution: "oracle-eye:sight-lines" } },
  { id: "bounty_oracle_eye_2", category: "weapon_feat", requiresWeapon: "oracle-eye", tier: 2, name: "Prophet’s Pace", description: "Score 4+ Hinted Sets in a single fight with Oracle Eye.", icon: "lorc/eyeball", scope: "single_fight", metric: "hintedSets", target: 4, reward: { coins: 155, weapons: ["mystic-sight"], evolution: "mystic-sight:magic-mirror" } },
  { id: "bounty_oracle_eye_3", category: "weapon_mastery", requiresWeapon: "oracle-eye", tier: 3, name: "Written in Stars", description: "Land 4+ Patient Sets (5s+ pause) in one fight with Oracle Eye.", icon: "delapouite/scroll-quill", scope: "single_fight", metric: "patientSets", target: 4, reward: { coins: 215, evolution: "seeker-lens:eureka-flash" } },
  { id: "bounty_mystic_sight_1", category: "weapon_intro", requiresWeapon: "mystic-sight", tier: 1, name: "Third Eye Open", description: "Score 6 Hinted Sets across fights with Mystic Sight.", icon: "lorc/third-eye", scope: "cumulative", metric: "hintedSets", target: 6, reward: { coins: 110, evolution: "mystic-sight:lens-of-truth" } },
  { id: "bounty_mystic_sight_2", category: "weapon_feat", requiresWeapon: "mystic-sight", tier: 2, name: "Twin-Beam Sniper", description: "Score 5+ Hinted Sets in a single fight with Mystic Sight.", icon: "delapouite/eye-target", scope: "single_fight", metric: "hintedSets", target: 5, reward: { coins: 170, evolution: "fog-lantern:smoke-bomb" } },
  { id: "bounty_mystic_sight_3", category: "weapon_mastery", requiresWeapon: "mystic-sight", tier: 3, name: "Deadeye Oracle", description: "Deal 70+ damage in one Set turn with Mystic Sight equipped.", icon: "lorc/magic-portal", scope: "single_fight", metric: "maxSingleHit", target: 70, reward: { coins: 235, evolution: "crystal-orb:astral-archive" } },
  { id: "bounty_fortunes_favor_1", category: "weapon_intro", requiresWeapon: "fortunes-favor", tier: 1, name: "Pocket Change", description: "Collect 40 fight coins across runs with Fortune’s Favor.", icon: "lorc/crown-coin", scope: "cumulative", metric: "synergy_coins", target: 40, reward: { coins: 100, evolution: "fortunes-favor:golden-touch" } },
  { id: "bounty_fortunes_favor_2", category: "weapon_feat", requiresWeapon: "fortunes-favor", tier: 2, name: "Coin Baron", description: "Collect 26+ coins in a single fight with Fortune’s Favor.", icon: "willdabeast/gold-bar", scope: "single_fight", metric: "synergy_coins", target: 26, reward: { coins: 160, weapons: ["fortunes-blessing"], evolution: "fortunes-blessing:treasure-map" } },
  { id: "bounty_fortunes_favor_3", category: "weapon_mastery", requiresWeapon: "fortunes-favor", tier: 3, name: "Gilded Tycoon", description: "Match 6+ Gold cards in a single fight with Fortune’s Favor.", icon: "lorc/gold-scarab", scope: "single_fight", metric: "goldCards", target: 6, reward: { coins: 225, evolution: "scholars-tome:forbidden-thesis" } },
  { id: "bounty_fortunes_blessing_1", category: "weapon_intro", requiresWeapon: "fortunes-blessing", tier: 1, name: "Alchemist’s Purse", description: "Match 6 Gold cards across fights with Fortune’s Blessing.", icon: "delapouite/two-coins", scope: "cumulative", metric: "goldCards", target: 6, reward: { coins: 110, evolution: "fortunes-blessing:gilded-oracle" } },
  { id: "bounty_fortunes_blessing_2", category: "weapon_feat", requiresWeapon: "fortunes-blessing", tier: 2, name: "Gilded Insight", description: "Collect 30+ coins in a single fight with Fortune’s Blessing.", icon: "lorc/treasure-map", scope: "single_fight", metric: "synergy_coins", target: 30, reward: { coins: 170, evolution: "rust:old-powder" } },
  { id: "bounty_fortunes_blessing_3", category: "weapon_mastery", requiresWeapon: "fortunes-blessing", tier: 3, name: "Treasure Sovereign", description: "Reach 7+ Hint synergy in a single fight with Fortune’s Blessing.", icon: "lorc/gems", scope: "single_fight", metric: "synergy_hints", target: 7, reward: { coins: 235, evolution: "wisdom-chain:golden-syllabus" } },
  { id: "bounty_scholars_tome_1", category: "weapon_intro", requiresWeapon: "scholars-tome", tier: 1, name: "Quick Study", description: "Earn 25 XP across fights with Scholar’s Tome equipped.", icon: "lorc/open-book", scope: "cumulative", metric: "xpGained", target: 25, reward: { coins: 100, evolution: "scholars-tome:speed-reading" } },
  { id: "bounty_scholars_tome_2", category: "weapon_feat", requiresWeapon: "scholars-tome", tier: 2, name: "Honor Roll", description: "Level up 3+ times in a single fight with Scholar’s Tome.", icon: "lorc/book-cover", scope: "single_fight", metric: "levelUps", target: 3, reward: { coins: 160, weapons: ["wisdom-chain"], evolution: "wisdom-chain:deans-list" } },
  { id: "bounty_scholars_tome_3", category: "weapon_mastery", requiresWeapon: "scholars-tome", tier: 3, name: "Grand Dissertation", description: "Earn 24+ XP in a single fight with Scholar’s Tome equipped.", icon: "lorc/burning-book", scope: "single_fight", metric: "xpGained", target: 24, reward: { coins: 220, evolution: "fortunes-favor:midas-cascade" } },
  { id: "bounty_wisdom_chain_1", category: "weapon_intro", requiresWeapon: "wisdom-chain", tier: 1, name: "First Dividend", description: "Earn 25 XP across fights with Wisdom Chain equipped.", icon: "lorc/bookmarklet", scope: "cumulative", metric: "xpGained", target: 25, reward: { coins: 110, evolution: "wisdom-chain:compound-dividend" } },
  { id: "bounty_wisdom_chain_2", category: "weapon_feat", requiresWeapon: "wisdom-chain", tier: 2, name: "Compound Wisdom", description: "Earn 28+ coins in a single fight with Wisdom Chain equipped.", icon: "delapouite/graduate-cap", scope: "single_fight", metric: "synergy_coins", target: 28, reward: { coins: 170, evolution: "scholars-tome:lecture-hall" } },
  { id: "bounty_wisdom_chain_3", category: "weapon_mastery", requiresWeapon: "wisdom-chain", tier: 3, name: "Golden Scholar", description: "Level up 4+ times in a single fight with Wisdom Chain.", icon: "delapouite/book-pile", scope: "single_fight", metric: "levelUps", target: 4, reward: { coins: 235, evolution: "fortunes-blessing:sovereign-mint" } },
  { id: "bounty_chrono_shard_1", category: "weapon_intro", requiresWeapon: "chrono-shard", tier: 1, name: "Borrowed Time", description: "Land 10 quick Sets across fights with Chrono Shard.", icon: "lorc/hourglass", scope: "cumulative", metric: "quickSets", target: 10, reward: { coins: 95, evolution: "chrono-shard:tempo-lock" } },
  { id: "bounty_chrono_shard_2", category: "weapon_feat", requiresWeapon: "chrono-shard", tier: 2, name: "Tempo Keeper", description: "Reach a 5× Speed Combo in a single fight with Chrono Shard.", icon: "delapouite/metronome", scope: "single_fight", metric: "maxCombo", target: 5, reward: { coins: 155, evolution: "ice-block:cryo-prism" } },
  { id: "bounty_chrono_shard_3", category: "weapon_mastery", requiresWeapon: "chrono-shard", tier: 3, name: "Timeless Duel", description: "Score 18+ Sets in a single timed fight with Chrono Shard.", icon: "lorc/sands-of-time", scope: "single_fight", metric: "sets", target: 18, reward: { coins: 215, evolution: "time-drop:second-spring" } },
  { id: "bounty_time_drop_1", category: "weapon_intro", requiresWeapon: "time-drop", tier: 1, name: "Drop in the Clock", description: "Gain 20+ seconds on the clock across fights with Time Drop.", icon: "lorc/stopwatch", scope: "cumulative", metric: "timeGainedSec", target: 20, reward: { coins: 100, evolution: "time-drop:golden-hour" } },
  { id: "bounty_time_drop_2", category: "weapon_feat", requiresWeapon: "time-drop", tier: 2, name: "Overtime Hero", description: "Gain 16+ seconds on the clock in a single fight with Time Drop.", icon: "lorc/shattered-glass", scope: "single_fight", metric: "timeGainedSec", target: 16, reward: { coins: 160, weapons: ["temporal-rift"], evolution: "temporal-rift:rewind-ward" } },
  { id: "bounty_time_drop_3", category: "weapon_mastery", requiresWeapon: "time-drop", tier: 3, name: "Endless Minute", description: "Land 4+ Rainbows in a single fight with Time Drop equipped.", icon: "lorc/flower-twirl", scope: "single_fight", metric: "rainbows", target: 4, reward: { coins: 220, evolution: "chrono-shard:chronosphere" } },
  { id: "bounty_temporal_rift_1", category: "weapon_intro", requiresWeapon: "temporal-rift", tier: 1, name: "Time Echo", description: "Trigger 6 Echoes across fights with Temporal Rift.", icon: "lorc/time-trap", scope: "cumulative", metric: "echoes", target: 6, reward: { coins: 110, evolution: "temporal-rift:deja-vu" } },
  { id: "bounty_temporal_rift_2", category: "weapon_feat", requiresWeapon: "temporal-rift", tier: 2, name: "Rift Walker", description: "Trigger 5+ Echoes in a single fight with Temporal Rift.", icon: "delapouite/backward-time", scope: "single_fight", metric: "echoes", target: 5, reward: { coins: 175, weapons: ["chain-reaction"], evolution: "chain-reaction:cascade-beam" } },
  { id: "bounty_temporal_rift_3", category: "weapon_mastery", requiresWeapon: "temporal-rift", tier: 3, name: "Closed Timeloop", description: "Gain 20+ seconds in one fight with Temporal Rift equipped.", icon: "lorc/clockwork", scope: "single_fight", metric: "timeGainedSec", target: 20, reward: { coins: 235, evolution: "echo-chamber:chrono-symphony" } },
  { id: "bounty_catalyst_prism_1", category: "weapon_intro", requiresWeapon: "catalyst-prism", tier: 1, name: "Spark of Change", description: "Trigger 4 Weapon Evolutions across fights with Catalyst Prism.", icon: "delapouite/prism", scope: "cumulative", metric: "evolutionsTriggered", target: 4, reward: { coins: 100, evolution: "catalyst-prism:ignition-catalyst" } },
  { id: "bounty_catalyst_prism_2", category: "weapon_feat", requiresWeapon: "catalyst-prism", tier: 2, name: "Prism Awakened", description: "Trigger 3+ Weapon Evolutions in a single fight with Catalyst Prism.", icon: "skoll/laser-burst", scope: "single_fight", metric: "evolutionsTriggered", target: 3, reward: { coins: 160, weapons: ["encore-mask"], evolution: "rally-horn:counter-fanfare" } },
  { id: "bounty_catalyst_prism_3", category: "weapon_mastery", requiresWeapon: "catalyst-prism", tier: 3, name: "Full-Belt Ascension", description: "Have 3+ weapons evolved simultaneously with Catalyst Prism.", icon: "delapouite/star-formation", scope: "single_fight", metric: "maxSimultaneousEvos", target: 3, reward: { coins: 235, evolution: "encore-mask:standing-ovation" } },
  { id: "bounty_encore_mask_1", category: "weapon_intro", requiresWeapon: "encore-mask", tier: 1, name: "Take a Bow", description: "Trigger 5 Weapon Evolutions across fights with Encore Mask.", icon: "delapouite/theater-curtains", scope: "cumulative", metric: "evolutionsTriggered", target: 5, reward: { coins: 110, evolution: "encore-mask:second-act" } },
  { id: "bounty_encore_mask_2", category: "weapon_feat", requiresWeapon: "encore-mask", tier: 2, name: "Double Feature", description: "Trigger 4+ Weapon Evolutions in a single fight with Encore Mask.", icon: "delapouite/ticket", scope: "single_fight", metric: "evolutionsTriggered", target: 4, reward: { coins: 170, evolution: "catalyst-prism:prism-cannon" } },
  { id: "bounty_encore_mask_3", category: "weapon_mastery", requiresWeapon: "encore-mask", tier: 3, name: "Showstopper", description: "Deal 80+ damage in one Set turn with Encore Mask equipped.", icon: "delapouite/hand-ok", scope: "single_fight", metric: "maxSingleHit", target: 80, reward: { coins: 245, evolution: "understudy:doppelganger-cast" } },
  { id: "bounty_echo_stone_1", category: "weapon_intro", requiresWeapon: "echo-stone", tier: 1, name: "First Echo", description: "Trigger 6 Echoes across fights with Echo Stone equipped.", icon: "lorc/echo-ripples", scope: "cumulative", metric: "echoes", target: 6, reward: { coins: 100, evolution: "echo-stone:resonance-wave" } },
  { id: "bounty_echo_stone_2", category: "weapon_feat", requiresWeapon: "echo-stone", tier: 2, name: "Echo Chamber Chorus", description: "Trigger 5+ Echoes in a single fight with Echo Stone equipped.", icon: "lorc/resonance", scope: "single_fight", metric: "echoes", target: 5, reward: { coins: 160, weapons: ["echo-chamber"], evolution: "echo-chamber:acoustic-vault" } },
  { id: "bounty_echo_stone_3", category: "weapon_mastery", requiresWeapon: "echo-stone", tier: 3, name: "Harmonic Cascade", description: "Reach 10+ Echoes synergy in a single fight with Echo Stone.", icon: "delapouite/harp", scope: "single_fight", metric: "synergy_echoes", target: 10, reward: { coins: 225, evolution: "chain-reaction:crystal-choir" } },
  { id: "bounty_chain_reaction_1", category: "weapon_intro", requiresWeapon: "chain-reaction", tier: 1, name: "Twin Resonance", description: "Trigger 3 Double-Echoes across fights with Chain Reaction.", icon: "lorc/lightning-branches", scope: "cumulative", metric: "doubleEchoes", target: 3, reward: { coins: 115, evolution: "chain-reaction:feedback-loop" } },
  { id: "bounty_chain_reaction_2", category: "weapon_feat", requiresWeapon: "chain-reaction", tier: 2, name: "Runaway Feedback", description: "Trigger 7+ Echoes in a single fight with Chain Reaction.", icon: "various-artists/infinity", scope: "single_fight", metric: "echoes", target: 7, reward: { coins: 180, evolution: "time-drop:broken-hourglass" } },
  { id: "bounty_chain_reaction_3", category: "weapon_mastery", requiresWeapon: "chain-reaction", tier: 3, name: "Symphony of Chaos", description: "Reach 14+ Echoes synergy in a single fight with Chain Reaction.", icon: "lorc/crystal-wand", scope: "single_fight", metric: "synergy_echoes", target: 14, reward: { coins: 250, evolution: "cascade-core:solar-flare-loop" } },
  { id: "bounty_cascade_core_1", category: "weapon_intro", requiresWeapon: "cascade-core", tier: 1, name: "Echoes in Flame", description: "Burn 12 cards across fights with Cascade Core equipped.", icon: "lorc/fire-ring", scope: "cumulative", metric: "cardsBurned", target: 12, reward: { coins: 110, evolution: "cascade-core:wildfire-echo" } },
  { id: "bounty_cascade_core_2", category: "weapon_feat", requiresWeapon: "cascade-core", tier: 2, name: "Wildfire Chorus", description: "Burn 12+ cards in a single fight with Cascade Core equipped.", icon: "lorc/flame-spin", scope: "single_fight", metric: "cardsBurned", target: 12, reward: { coins: 170, evolution: "hot-potato:sizzle-sprint" } },
  { id: "bounty_cascade_core_3", category: "weapon_mastery", requiresWeapon: "cascade-core", tier: 3, name: "Solar Feedback", description: "Reach 18+ Burn synergy in a single fight with Cascade Core.", icon: "lorc/sun", scope: "single_fight", metric: "synergy_burn", target: 18, reward: { coins: 235, evolution: "echo-stone:echo-bomb-chorus" } },
  { id: "bounty_connector_1", category: "weapon_intro", requiresWeapon: "connector", tier: 1, name: "Thread the Board", description: "Create 10 board links across fights with Link Stone.", icon: "lorc/chained-heart", scope: "cumulative", metric: "linksCreated", target: 10, reward: { coins: 100, evolution: "connector:living-loom" } },
  { id: "bounty_connector_2", category: "weapon_feat", requiresWeapon: "connector", tier: 2, name: "Loom Master", description: "Destroy 8+ linked cards in a single fight with Link Stone.", icon: "lorc/circuitry", scope: "single_fight", metric: "linksDestroyed", target: 8, reward: { coins: 160, weapons: ["revenge-linker"], evolution: "tightrope:compass-walk" } },
  { id: "bounty_connector_3", category: "weapon_mastery", requiresWeapon: "connector", tier: 3, name: "Grand Tapestry", description: "Reach 14+ Links synergy in a single fight with Link Stone.", icon: "lorc/sewing-needle", scope: "single_fight", metric: "synergy_links", target: 14, reward: { coins: 220, evolution: "web-weaver:gilded-gossamer" } },
  { id: "bounty_web_weaver_1", category: "weapon_intro", requiresWeapon: "web-weaver", tier: 1, name: "Opening Silk", description: "Destroy 10 linked cards across fights with Web Spinner.", icon: "lorc/cobweb", scope: "cumulative", metric: "linksDestroyed", target: 10, reward: { coins: 110, evolution: "web-weaver:silk-snare" } },
  { id: "bounty_web_weaver_2", category: "weapon_feat", requiresWeapon: "web-weaver", tier: 2, name: "Spider’s Domain", description: "Destroy 10+ linked cards in a single fight with Web Spinner.", icon: "lorc/spider-web", scope: "single_fight", metric: "linksDestroyed", target: 10, reward: { coins: 175, weapons: ["neural-network"], evolution: "neural-network:deep-learning" } },
  { id: "bounty_web_weaver_3", category: "weapon_mastery", requiresWeapon: "web-weaver", tier: 3, name: "Golden Silk", description: "Reach 16+ Links synergy in a single fight with Web Spinner.", icon: "lorc/gem-chain", scope: "single_fight", metric: "synergy_links", target: 16, reward: { coins: 240, evolution: "revenge-linker:vendetta-matrix" } },
  { id: "bounty_neural_network_1", category: "weapon_intro", requiresWeapon: "neural-network", tier: 1, name: "Branching Mind", description: "Create 14 links across fights with Neural Network equipped.", icon: "lorc/brainstorm", scope: "cumulative", metric: "linksCreated", target: 14, reward: { coins: 115, evolution: "neural-network:synapse-surge" } },
  { id: "bounty_neural_network_2", category: "weapon_feat", requiresWeapon: "neural-network", tier: 2, name: "Synaptic Storm", description: "Create 10+ links in a single fight with Neural Network.", icon: "lorc/brain", scope: "single_fight", metric: "linksCreated", target: 10, reward: { coins: 180, evolution: "twin-seed:sprouting-doubles" } },
  { id: "bounty_neural_network_3", category: "weapon_mastery", requiresWeapon: "neural-network", tier: 3, name: "Total Singularity", description: "Reach 18+ Links synergy in a single fight with Neural Network.", icon: "lorc/processor", scope: "single_fight", metric: "synergy_links", target: 18, reward: { coins: 250, evolution: "temporal-rift:paradox-loop" } },
  { id: "bounty_echo_chamber_1", category: "weapon_intro", requiresWeapon: "echo-chamber", tier: 1, name: "Linked Seconds", description: "Destroy 10 linked cards across fights with Echo Chamber.", icon: "lorc/radar-sweep", scope: "cumulative", metric: "linksDestroyed", target: 10, reward: { coins: 110, evolution: "echo-chamber:overclock-web" } },
  { id: "bounty_echo_chamber_2", category: "weapon_feat", requiresWeapon: "echo-chamber", tier: 2, name: "Clockwork Web", description: "Gain 18+ seconds in a single fight with Echo Chamber.", icon: "lorc/satellite", scope: "single_fight", metric: "timeGainedSec", target: 18, reward: { coins: 170, evolution: "long-fuse:playing-with-fire" } },
  { id: "bounty_echo_chamber_3", category: "weapon_mastery", requiresWeapon: "echo-chamber", tier: 3, name: "Resonant Timepiece", description: "Match 6+ 1-2-3 number Sets in one fight with Echo Chamber.", icon: "lorc/psychic-waves", scope: "single_fight", metric: "numberTriadSets", target: 6, reward: { coins: 235, evolution: "neural-network:hivemind-singularity" } },
  { id: "bounty_gen_evo_arcana", category: "chaos", tier: 0, name: "Evolution Alchemist", description: "Trigger 5 Weapon Evolutions across Adventure fights.", icon: "lorc/crystal-wand", scope: "cumulative", metric: "evolutionsForged", target: 5, reward: { coins: 180, arcana: "catalyst_resonance" } },
  { id: "bounty_gen_stars_perfect", category: "explorer", tier: 0, name: "Star Collector", description: "Earn ★★★ on 8 different Adventure stages.", icon: "lorc/flat-star", scope: "save", metric: "perfectStages", target: 8, reward: { coins: 160, weapons: ["rainbow-charm"] } },
  { id: "bounty_gen_elites", category: "explorer", tier: 0, name: "Giant Slayer", description: "Knock out 3 optional side-branch foes (★★+).", icon: "lorc/daemon-skull", scope: "save", metric: "eliteClears", target: 3, reward: { coins: 200, weapons: ["understudy"] } },
  { id: "bounty_gen_coins", category: "explorer", tier: 0, name: "Treasure Hoard", description: "Accumulate 1,500 lifetime coins across Adventure runs.", icon: "lorc/crown-coin", scope: "save", metric: "lifetimeCoins", target: 1500, reward: { coins: 220, weapons: ["fortunes-favor"] } },
  { id: "bounty_gen_parries", category: "mastery", tier: 0, name: "Counter Virtuoso", description: "Land 15 Parries across Adventure fights.", icon: "lorc/sword-clash", scope: "cumulative", metric: "parriesLanded", target: 15, reward: { coins: 160, weapons: ["rally-horn"] } },
  { id: "bounty_gen_roster", category: "roster", tier: 0, name: "Pack Leader", description: "Earn a knockout win (★★+) with 4 different fighters.", icon: "lorc/trophy", scope: "save", metric: "uniqueFighterWins", target: 4, reward: { coins: 200, weapons: ["encore-mask"] } },
  { id: "bounty_gen_multi_evo", category: "chaos", tier: 0, name: "Full-Belt Overdrive", description: "Trigger 3 different Weapon Evolutions in the same fight.", icon: "lorc/crystal-shine", scope: "single_fight", metric: "distinctWeaponsEvolved", target: 3, reward: { coins: 240, weapons: ["catalyst-prism"] } },
  { id: "bounty_gen_purity", category: "mastery", tier: 0, name: "Ascending Mind", description: "Trigger 10 Escalating Purity chains across Adventure fights.", icon: "lorc/lightning-branches", scope: "cumulative", metric: "purityChains", target: 10, reward: { coins: 160, weapons: ["odd-one-out"] } },
];

/** All 200 Adventure Bounties (192 weapon-linked + 8 general). */
export const BOUNTIES: BountyDef[] = RAW_BOUNTIES.map(buildBounty);

/** The 192 weapon-linked bounties (3 per Armory weapon). */
export const WEAPON_BOUNTIES: readonly BountyDef[] = BOUNTIES.filter(b => Boolean(b.requiresWeapon));

/** The 8 general campaign/combat bounties (no weapon prerequisite). */
export const GENERAL_BOUNTIES: readonly BountyDef[] = BOUNTIES.filter(b => !b.requiresWeapon);

export const BOUNTY_BY_ID: ReadonlyMap<string, BountyDef> = new Map(BOUNTIES.map(b => [b.id, b]));

const BOUNTIES_BY_WEAPON = new Map<string, BountyDef[]>();
const BOUNTY_BY_EVO = new Map<string, BountyDef>();
const BOUNTIES_BY_REWARD_WEAPON = new Map<string, BountyDef[]>();

for (const b of BOUNTIES) {
  if (b.requiresWeapon) {
    const list = BOUNTIES_BY_WEAPON.get(b.requiresWeapon);
    if (list) list.push(b);
    else BOUNTIES_BY_WEAPON.set(b.requiresWeapon, [b]);
  }
  if (b.rewardEvolutionId) {
    BOUNTY_BY_EVO.set(b.rewardEvolutionId, b);
  }
  for (const wId of b.reward.weapons ?? []) {
    const list = BOUNTIES_BY_REWARD_WEAPON.get(wId);
    if (list) list.push(b);
    else BOUNTIES_BY_REWARD_WEAPON.set(wId, [b]);
  }
}

const EMPTY_BOUNTIES: readonly BountyDef[] = [];

export const getBounty = (id: string): BountyDef | undefined => BOUNTY_BY_ID.get(id);

/** All 3 weapon-linked bounties gated by owning `weaponId` (empty array for unknown IDs). */
export const getWeaponBounties = (weaponId: string): readonly BountyDef[] =>
  BOUNTIES_BY_WEAPON.get(weaponId) ?? EMPTY_BOUNTIES;

/** True when the player owns `bounty.requiresWeapon` (or the bounty has no weapon prerequisite). */
export const isBountyWeaponOwned = (
  save: Pick<AdventureSave, 'armory'>,
  bounty: Pick<BountyDef, 'requiresWeapon'>
): boolean => !bounty.requiresWeapon || save.armory.includes(bounty.requiresWeapon);

/**
 * True when `bounty` is currently open to progress and surface on the Bounty Board:
 * requires the Bounty Board unlocked (when provided) AND `bounty.requiresWeapon` owned.
 */
export const isBountyUnlocked = (
  save: Pick<AdventureSave, 'armory'> & Partial<Pick<AdventureSave, 'bountiesUnlocked'>>,
  bounty: Pick<BountyDef, 'requiresWeapon'>
): boolean => save.bountiesUnlocked !== false && isBountyWeaponOwned(save, bounty);

/** Look up the bounty that unlocks a given per-weapon evolution ID (undefined for starter 1-10 ★1 evo). */
export const bountyForEvolution = (evoId: string): BountyDef | undefined => BOUNTY_BY_EVO.get(evoId);

/** All bounties whose reward grants `weaponId` (exclusive or early-access). */
export const weaponUnlockBountiesFor = (weaponId: string): readonly BountyDef[] =>
  BOUNTIES_BY_REWARD_WEAPON.get(weaponId) ?? EMPTY_BOUNTIES;
