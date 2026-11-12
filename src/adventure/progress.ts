/**
 * Pure progression logic: unlock rules, star rewards, purchases.
 * No storage I/O here, so it's easy to test and simulate.
 */
import type { CharacterName } from '@/types';
import type {
  AdventureSave,
  ArcanaId,
  BountyDef,
  BountyStats,
  EvolutionRecipe,
  LevelDef,
  RewardDef,
  RunState,
  SkillNode,
  UnlockableFeature,
  UpgradeDef,
} from './types';
import { LEVELS, MAIN_LEVELS, BRANCH_STAR_REQUIREMENT, mainIndexOf } from './data/levels';
import { BIOMES, getBiome } from './data/biomes';
import { MECHANICS } from './data/mechanics';
import { FIGHTERS, STARTING_FIGHTERS } from './data/fighters';
import { UPGRADES, getUpgrade, getWeaponUpgradeCosts, MAX_WEAPON_UPGRADE_TIER } from './data/upgrades';
import { ARCANA } from './data/arcana';
import { getArmoryWeapon, resolveLegacyWeapon } from './data/armory';
import { LEGACY_WEAPON_RARITY } from '@/utils/gameDefinitions';
import { SKILL_NODES } from './data/skillTrees';
import { BOUNTIES } from './data/bounties';
import { EVOLUTION_RECIPES } from './data/evolutions';
import { CAMPAIGN_FEATURES, FEATURES } from './data/features';
import { starRewards, unlockablesOf } from './data/rewards';
import {
  boughtWeaponTiers,
  freeWeaponTiers,
  overflowRefund,
  settleWeaponTiers,
  weaponUpgradeCosts,
  weaponUpgradeTier,
} from './weaponLevels';

/**
 * The shape of a brand-new save. Loading fills anything a stored save lacks
 * from here (save.ts), so a new field only needs its type and its default.
 */
export const createNewSave = (): AdventureSave => ({
  version: 1,
  coins: 0,
  lifetimeCoins: 0,
  stars: {},
  plays: {},
  fighterLevels: {},
  skillNodes: {},
  unlockedFighters: [...STARTING_FIGHTERS],
  // Only weapons won from star/bounty rewards
  armory: [],
  charm: null,
  charms: [],
  unlockedArcana: [],
  activeArcana: null,
  equippedArcana: [],
  bountiesUnlocked: false,
  completedBounties: [],
  bountyStats: {
    totalSets: 0,
    rainbowSets: 0,
    purityChains: 0,
    threeStepPurities: 0,
    flawlessTimedWins: 0,
    maxOverkill: 0,
    evolutionsForged: 0,
    destructiveFights: 0,
    fighterWins: {},
    trapsDefused: 0,
    biggestHit: 0,
  },
  unlockedEvolutions: [],
  discoveredEvolutions: [],
  upgrades: {},
  weaponUpgrades: {},
  legacyWeaponTiers: {},
  coinsUnlocked: false,
  workshopUnlocked: false,
  seenMechanics: [],
  seenCoachMarks: [],
  selectedFighter: 'Orange Tabby',
  musicOn: true,
});

// ─── Stars & unlocks ────────────────────────────────────────────────────────

/** Every star ever earned (best result per level). Star gates read this, so spending never re-locks a world. */
export const totalStarsEarned = (save: AdventureSave): number =>
  Object.values(save.stars).reduce((a, b) => a + b, 0);

/** @alias totalStarsEarned */
export const totalStars = totalStarsEarned;

export const maxStars = (): number => LEVELS.length * 3;

export const isBiomeOpen = (save: AdventureSave, biomeId: LevelDef['biome']): boolean =>
  totalStarsEarned(save) >= getBiome(biomeId).starGate;

// ─── Star pool & skill trees ────────────────────────────────────────────────

const NODES_BY_ID = new Map<string, SkillNode>(SKILL_NODES.map(n => [n.id, n]));

const findNode = (id: string): SkillNode | undefined => NODES_BY_ID.get(id);

/** Stars currently spent across every fighter's skill tree (one shared pool). */
export const starsSpent = (save: AdventureSave): number =>
  Object.values(save.skillNodes).reduce(
    (sum, ids) => sum + ids.reduce((s, id) => s + (findNode(id)?.cost ?? 0), 0),
    0
  );

/** Stars free to spend: earned minus spent. */
export const availableStars = (save: AdventureSave): number => totalStarsEarned(save) - starsSpent(save);

export const ownedNodes = (save: AdventureSave, fighter: CharacterName): string[] => save.skillNodes[fighter] ?? [];

export const ownsNode = (save: AdventureSave, nodeId: string): boolean => {
  const node = findNode(nodeId);
  return !!node && ownedNodes(save, node.fighter).includes(nodeId);
};

const branchChain = (fighter: string, branch: 0 | 1): SkillNode[] =>
  SKILL_NODES.filter(n => n.fighter === fighter && n.branch === branch).sort((a, b) => a.depth - b.depth);

/** How deep the player has bought into one branch (0 = only the free passive root). */
export const branchDepth = (save: AdventureSave, fighter: CharacterName, branch: 0 | 1): number => {
  const owned = new Set(ownedNodes(save, fighter));
  let depth = 0;
  for (const n of branchChain(fighter, branch)) {
    if (!owned.has(n.id) || n.depth !== depth + 1) break;
    depth = n.depth;
  }
  return depth;
};

export type NodeStatus =
  | 'owned'
  /** Its parent is owned and the stars are there */
  | 'buyable'
  /** Its parent is owned but stars are short */
  | 'needsStars'
  /** The node before it in its branch is not owned yet */
  | 'needsParent'
  | 'fighterLocked';

export const nodeStatus = (save: AdventureSave, nodeId: string): NodeStatus => {
  const node = findNode(nodeId);
  if (!node || !save.unlockedFighters.includes(node.fighter)) return 'fighterLocked';
  if (ownsNode(save, nodeId)) return 'owned';
  if (branchDepth(save, node.fighter, node.branch) !== node.depth - 1) return 'needsParent';
  return availableStars(save) >= node.cost ? 'buyable' : 'needsStars';
};

export const canBuyNode = (save: AdventureSave, nodeId: string): boolean => nodeStatus(save, nodeId) === 'buyable';

export const buyNode = (save: AdventureSave, nodeId: string): AdventureSave => {
  if (!canBuyNode(save, nodeId)) return save;
  const node = findNode(nodeId)!;
  return { ...save, skillNodes: { ...save.skillNodes, [node.fighter]: [...ownedNodes(save, node.fighter), nodeId] } };
};

/** Stars put into one branch of one fighter. */
export const branchSpent = (save: AdventureSave, fighter: CharacterName, branch: 0 | 1): number =>
  ownedNodes(save, fighter).reduce((sum, id) => {
    const n = findNode(id);
    return n && n.branch === branch ? sum + n.cost : sum;
  }, 0);

const withFighterNodes = (save: AdventureSave, fighter: CharacterName, ids: string[]): AdventureSave => {
  const skillNodes = { ...save.skillNodes };
  if (ids.length > 0) skillNodes[fighter] = ids;
  else delete skillNodes[fighter];
  return { ...save, skillNodes };
};

/** Give back every star in one branch. Whole branches only, so no kept node is missing its parent. */
export const refundBranch = (save: AdventureSave, fighter: CharacterName, branch: 0 | 1): AdventureSave =>
  withFighterNodes(save, fighter, ownedNodes(save, fighter).filter(id => findNode(id)?.branch !== branch));

/** Give back every star spent on this fighter. Free, any time. */
export const refundFighter = (save: AdventureSave, fighter: CharacterName): AdventureSave =>
  withFighterNodes(save, fighter, []);

/**
 * Keep only nodes that still exist and still sit on an unbroken path from their
 * passive. If the trees now cost more than the player earned (a rebalance),
 * every star is handed back.
 */
const normalizeSkillNodes = (save: AdventureSave): AdventureSave => {
  // Without tree data (a partial build) leave the save alone rather than wiping it
  if (SKILL_NODES.length === 0) return save;
  const skillNodes: Record<string, string[]> = {};
  for (const [fighter, ids] of Object.entries(save.skillNodes)) {
    const owned = new Set(ids);
    const keep: string[] = [];
    for (const branch of [0, 1] as const) {
      for (const n of branchChain(fighter, branch)) {
        if (!owned.has(n.id)) break;
        keep.push(n.id);
      }
    }
    if (keep.length > 0) skillNodes[fighter] = keep;
  }
  const next = { ...save, skillNodes };
  return starsSpent(next) > totalStarsEarned(next) ? { ...next, skillNodes: {} } : next;
};

// ─── Charm & Arcana slots ───────────────────────────────────────────────────

import { arcanaSlotsOf, charmSlotsOf, fightArcana, fightCharms } from './loadout';

const charmSlots = charmSlotsOf;
const arcanaSlots = arcanaSlotsOf;
const equippedCharms = fightCharms;
const equippedArcanaOf = fightArcana;

export {
  BASE_CHARM_SLOTS,
  MAX_CHARM_SLOTS,
  BASE_ARCANA_SLOTS,
  MAX_ARCANA_SLOTS,
} from './loadout';
export { charmSlots, arcanaSlots, equippedCharms, equippedArcanaOf };

/** Equip an Armory weapon into a free charm slot. No duplicates; does nothing when every slot is full. */
export const equipCharm = (save: AdventureSave, weaponId: string): AdventureSave => {
  const charms = equippedCharms(save);
  if (!save.armory.includes(weaponId) || charms.includes(weaponId) || charms.length >= charmSlots(save)) return save;
  return { ...save, charms: [...charms, weaponId] };
};

export const unequipCharm = (save: AdventureSave, weaponId: string): AdventureSave =>
  save.charms.includes(weaponId) ? { ...save, charms: save.charms.filter(id => id !== weaponId) } : save;

/** Equip if free, unequip if worn. */
export const toggleCharm = (save: AdventureSave, weaponId: string): AdventureSave =>
  equippedCharms(save).includes(weaponId) ? unequipCharm(save, weaponId) : equipCharm(save, weaponId);

/**
 * Equip an unlocked Arcana. When every slot is taken, the one equipped
 * longest ago makes room (with one slot this is a plain swap).
 */
export const equipArcana = (save: AdventureSave, arcanaId: ArcanaId): AdventureSave => {
  const worn = equippedArcanaOf(save);
  if (!save.unlockedArcana.includes(arcanaId) || worn.includes(arcanaId)) return save;
  const room = worn.length >= arcanaSlots(save) ? worn.slice(worn.length - arcanaSlots(save) + 1) : worn;
  return { ...save, equippedArcana: [...room, arcanaId] };
};

export const unequipArcana = (save: AdventureSave, arcanaId: ArcanaId): AdventureSave =>
  save.equippedArcana.includes(arcanaId) ? { ...save, equippedArcana: save.equippedArcana.filter(id => id !== arcanaId) } : save;

export const toggleArcana = (save: AdventureSave, arcanaId: ArcanaId): AdventureSave =>
  equippedArcanaOf(save).includes(arcanaId) ? unequipArcana(save, arcanaId) : equipArcana(save, arcanaId);

/** A weapon belongs to a recipe family when its id is the family id or a tier of it (`oracle-eye-rare`). */
const inFamily = (weaponId: string, family: readonly string[]): boolean =>
  family.some(p => weaponId === p || weaponId.startsWith(`${p}-`));

/** Unlocked recipes whose two families are both among these weapons. */
export const recipesArmedBy = (weaponIds: readonly string[], unlockedEvolutions: readonly string[]): EvolutionRecipe[] =>
  EVOLUTION_RECIPES.filter(
    r => unlockedEvolutions.includes(r.id) && r.families.every(f => weaponIds.some(id => inFamily(id, f)))
  );

/** Recipes the equipped charms arm before the fight starts (picks and shop buys can arm more). */
export const armedRecipes = (save: AdventureSave): EvolutionRecipe[] => recipesArmedBy(equippedCharms(save), save.unlockedEvolutions);

/** For one recipe: which of its two families the equipped charms already cover. */
export const recipeFamiliesHeld = (save: AdventureSave, recipe: EvolutionRecipe): [boolean, boolean] => {
  const charms = equippedCharms(save);
  return [charms.some(id => inFamily(id, recipe.families[0])), charms.some(id => inFamily(id, recipe.families[1]))];
};

/** Drop anything equipped that is no longer owned or no longer fits the slots. */
const trimEquipped = (save: AdventureSave): AdventureSave => {
  const charms = equippedCharms(save);
  const equippedArcana = equippedArcanaOf(save);
  const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  return same(charms, save.charms) && same(equippedArcana, save.equippedArcana) ? save : { ...save, charms, equippedArcana };
};

// ─── Migration from the v1 save shape ───────────────────────────────────────

/** What each fighter level used to cost in coins (level N → N+1). Used only to refund old saves. */
export const LEGACY_FIGHTER_LEVEL_COSTS = [60, 120, 200, 320, 480, 700, 1000, 1400, 1900] as const;

/** Coins a v1 save spent levelling fighters. */
export const legacyFighterRefund = (fighterLevels: Record<string, number> | undefined): number =>
  Object.values(fighterLevels ?? {}).reduce((sum, level) => {
    const gained = Math.max(0, Math.min(LEGACY_FIGHTER_LEVEL_COSTS.length, Math.floor(Number(level) || 1) - 1));
    return sum + LEGACY_FIGHTER_LEVEL_COSTS.slice(0, gained).reduce((a, b) => a + b, 0);
  }, 0);

/**
 * Weapons from before each family became one weapon with levels: every old id
 * maps to its weapon (the Mastery weapons are dropped), owning a stronger
 * rare/epic copy gives that weapon the matching upgrade tier, and Workshop
 * tiers bought on a copy that no longer exists are refunded at the price paid.
 * Tiers bought on the plain (common) copy carry over. Safe to run more than once.
 */
export const migrateWeaponIds = (save: AdventureSave): AdventureSave => {
  const legacyWeaponTiers: Record<string, number> = { ...(save.legacyWeaponTiers ?? {}) };
  const armory: string[] = [];
  for (const old of save.armory) {
    const to = resolveLegacyWeapon(old);
    if (!to) continue;
    if (!armory.includes(to.id)) armory.push(to.id);
    if (to.tier > 0) legacyWeaponTiers[to.id] = Math.min(MAX_WEAPON_UPGRADE_TIER, Math.max(legacyWeaponTiers[to.id] ?? 0, to.tier));
  }
  const weaponUpgrades: Record<string, number> = {};
  let refund = 0;
  for (const [old, tier] of Object.entries(save.weaponUpgrades)) {
    const to = resolveLegacyWeapon(old);
    if (to && to.tier === 0) {
      weaponUpgrades[to.id] = Math.max(weaponUpgrades[to.id] ?? 0, tier);
    } else {
      refund += getWeaponUpgradeCosts(LEGACY_WEAPON_RARITY[old] ?? 'common')
        .slice(0, Math.max(0, Math.min(MAX_WEAPON_UPGRADE_TIER, Math.floor(Number(tier) || 0))))
        .reduce((a, b) => a + b, 0);
    }
  }
  const charms: string[] = [];
  for (const old of save.charms) {
    const to = resolveLegacyWeapon(old);
    if (to && !charms.includes(to.id)) charms.push(to.id);
  }
  return { ...save, coins: save.coins + refund, armory, charms, weaponUpgrades, legacyWeaponTiers };
};

/**
 * Bring an older save to the current shape: fighter levels are refunded in full
 * (they no longer exist), the single charm joins `charms`, the single Arcana
 * joins `equippedArcana`, and old weapon ids become their one weapon
 * (migrateWeaponIds). Safe to run more than once.
 */
export const migrateSave = (save: AdventureSave): AdventureSave => {
  const next: AdventureSave = {
    ...save,
    coins: save.coins + legacyFighterRefund(save.fighterLevels),
    fighterLevels: {},
    skillNodes: save.skillNodes ?? {},
    charms: save.charms ?? [],
    equippedArcana: save.equippedArcana ?? [],
    charm: null,
    activeArcana: null,
  };
  if (save.charm && !next.charms.includes(save.charm)) next.charms = [save.charm, ...next.charms];
  if (save.activeArcana && !next.equippedArcana.includes(save.activeArcana)) next.equippedArcana = [save.activeArcana, ...next.equippedArcana];
  return normalizeSkillNodes(migrateWeaponIds(next));
};

type LockReason =
  | { kind: 'previous' }
  | { kind: 'stars'; need: number; have: number }
  | { kind: 'branch'; parentId: string; need: number };

/**
 * A main level opens when the previous main level has ≥1★ and its region's
 * star gate is met. An elite branch opens at ★★ on its parent level.
 */
export const getLockReason = (save: AdventureSave, level: LevelDef): LockReason | null => {
  if (level.branchOf) {
    if ((save.stars[level.branchOf] ?? 0) < BRANCH_STAR_REQUIREMENT) return { kind: 'branch', parentId: level.branchOf, need: BRANCH_STAR_REQUIREMENT };
    return null;
  }
  const pos = mainIndexOf(level);
  if (pos > 0) {
    const prev = MAIN_LEVELS[pos - 1];
    if ((save.stars[prev.id] ?? 0) < 1) return { kind: 'previous' };
  }
  const gate = getBiome(level.biome).starGate;
  const have = totalStars(save);
  if (have < gate) return { kind: 'stars', need: gate, have };
  return null;
};

export const isLevelUnlocked = (save: AdventureSave, level: LevelDef): boolean =>
  getLockReason(save, level) === null;

/** The next level the player should play: first unlocked level with 0 stars, else the last unlocked. */
export const getFrontierLevel = (save: AdventureSave): LevelDef => {
  let last = MAIN_LEVELS[0];
  for (const l of MAIN_LEVELS) {
    if (!isLevelUnlocked(save, l)) break;
    last = l;
    if ((save.stars[l.id] ?? 0) === 0) return l;
  }
  return last;
};

// ─── Applying results ───────────────────────────────────────────────────────

interface GrantedReward {
  star: number;
  reward: RewardDef;
}

/** One thing to reveal with fanfare after a level. `star === 0` indicates a Bounty reward. */
export type Unlock =
  | { kind: 'fighter'; name: CharacterName; star: number }
  /**
   * A new weapon, or (with `level`) a reward naming a weapon already owned:
   * it is now at that level. `refund`: coins returned for Workshop tiers the
   * free upgrade pushed past the top level.
   */
  | { kind: 'weapon'; id: string; star: number; firstWeapon: boolean; level?: number; refund?: number }
  | { kind: 'arcana'; id: ArcanaId; star: number }
  | { kind: 'evolution'; id: string; star: number; firstEvolution: boolean }
  | { kind: 'feature'; feature: UnlockableFeature; star: number };

export interface ResultApplication {
  save: AdventureSave;
  granted: GrantedReward[];
  /** Coins dropped during the fight */
  coinsBanked: number;
  /** Coins from newly earned stars */
  starCoins: number;
  /** Bonus coins from newly completed cross-run bounties */
  bountyCoins: number;
  completedBounties: BountyDef[];
  unlocks: Unlock[];
  newlyOpenedBiomes: string[];
}

const unlockFeature = (save: AdventureSave, feature: UnlockableFeature): AdventureSave => ({
  ...save,
  [CAMPAIGN_FEATURES[feature].saveFlag]: true,
});

/**
 * Pay out a reward. Returns the new save and what in it was new to the player,
 * in reveal order. Things the save already has are not unlocked again.
 */
const grant = (
  save: AdventureSave,
  reward: RewardDef,
  star = 0,
  /** Put newly won weapons straight into free charm slots (not when quietly reconciling an old save) */
  autoEquip = true,
  /**
   * The save before this reward was earned (before its star or bounty counted).
   * A weapon already owned is then revealed as levelled up. Left out when quietly
   * reconciling an old save.
   */
  before?: AdventureSave
): { save: AdventureSave; unlocks: Unlock[] } => {
  let next = { ...save };
  const unlocks: Unlock[] = [];
  if (reward.coins) {
    next.coins += reward.coins;
    next.lifetimeCoins += reward.coins;
  }
  for (const u of unlockablesOf(reward)) {
    switch (u.kind) {
      case 'feature':
        if (!next[CAMPAIGN_FEATURES[u.id].saveFlag]) {
          unlocks.push({ kind: 'feature', feature: u.id, star });
          next = unlockFeature(next, u.id);
        }
        break;
      case 'fighter':
        if (!next.unlockedFighters.includes(u.id)) {
          unlocks.push({ kind: 'fighter', name: u.id, star });
          next.unlockedFighters = [...next.unlockedFighters, u.id];
        }
        break;
      case 'weapon':
        if (!next.armory.includes(u.id)) {
          unlocks.push({ kind: 'weapon', id: u.id, star, firstWeapon: next.armory.length === 0 });
          next.armory = [...next.armory, u.id];
          // A new weapon goes straight into a free charm slot
          if (autoEquip) next = equipCharm(next, u.id);
        } else if (before) {
          // Already owned: this reward is a free level (derived from the earned star/bounty, see weaponLevels.ts)
          const tier = weaponUpgradeTier(next, u.id);
          const refund = overflowRefund(next, u.id);
          if (tier > weaponUpgradeTier(before, u.id) || refund > 0) {
            unlocks.push({ kind: 'weapon', id: u.id, star, firstWeapon: false, level: tier + 1, ...(refund > 0 ? { refund } : {}) });
          }
        }
        break;
      case 'arcana':
        if (!next.unlockedArcana.includes(u.id)) {
          unlocks.push({ kind: 'arcana', id: u.id, star });
          next.unlockedArcana = [...next.unlockedArcana, u.id];
        }
        break;
      case 'evolution':
        if (!next.unlockedEvolutions.includes(u.id)) {
          unlocks.push({ kind: 'evolution', id: u.id, star, firstEvolution: next.unlockedEvolutions.length === 0 });
          next.unlockedEvolutions = [...next.unlockedEvolutions, u.id];
        }
        break;
    }
  }
  return { save: settleWeaponTiers(next), unlocks };
};

const recordRunBountyStats = (save: AdventureSave, level: LevelDef, stars: number, run: RunState): AdventureSave => {
  const prev = save.bountyStats;
  const destructive =
    run.roundStats.weaponEffectsTriggered.has('explosion') ||
    run.roundStats.weaponEffectsTriggered.has('fire') ||
    run.roundStats.weaponEffectsTriggered.has('laser');
  const knockedOut = stars >= 2 && run.endReason === 'defeated';
  const fighterWins = knockedOut
    ? { ...prev.fighterWins, [run.fighter]: (prev.fighterWins[run.fighter] ?? 0) + 1 }
    : prev.fighterWins;
  const bountyStats: BountyStats = {
    totalSets: prev.totalSets + run.matches,
    rainbowSets: prev.rainbowSets + run.roundStats.allDifferentMatches,
    purityChains: prev.purityChains + run.purityChainsTriggered,
    threeStepPurities: prev.threeStepPurities + run.threeStepPuritiesTriggered,
    flawlessTimedWins: prev.flawlessTimedWins + (knockedOut && !!level.rules.timer && run.mistakes === 0 ? 1 : 0),
    maxOverkill: Math.max(prev.maxOverkill, run.overkillDamage),
    evolutionsForged: prev.evolutionsForged + run.evolutionsTriggered,
    destructiveFights: prev.destructiveFights + (destructive || run.explosionsTriggered > 0 ? 1 : 0),
    trapsDefused: (prev.trapsDefused ?? 0) + run.trapsDefused,
    biggestHit: Math.max(prev.biggestHit ?? 0, run.biggestHit),
    fighterWins,
  };

  const discoveredEvolutions =
    run.forgedRecipes.length > 0
      ? [...new Set([...save.discoveredEvolutions, ...run.forgedRecipes])]
      : save.discoveredEvolutions;
  return { ...save, bountyStats, discoveredEvolutions };
};

/** Bank run coins + grant first-time star rewards + evaluate cross-run bounties. */
export const applyLevelResult = (
  save: AdventureSave,
  level: LevelDef,
  stars: number,
  runCoins: number,
  run?: RunState
): ResultApplication => {
  const before = save;
  const previousStars = save.stars[level.id] ?? 0;
  let next: AdventureSave = {
    ...save,
    coins: save.coins + runCoins,
    lifetimeCoins: save.lifetimeCoins + runCoins,
    plays: { ...save.plays, [level.id]: (save.plays[level.id] ?? 0) + 1 },
  };
  if (run) {
    next = recordRunBountyStats(next, level, stars, run);
  }
  const granted: GrantedReward[] = [];
  const unlocks: Unlock[] = [];
  let starCoins = 0;
  const rewards = starRewards(level);
  for (let s = previousStars + 1; s <= stars; s++) {
    const reward = rewards[s - 1];
    // The star counts before its reward is paid, so a weapon it names again is a free level
    const earnedBefore = next;
    next = { ...next, stars: { ...next.stars, [level.id]: s } };
    const result = grant(next, reward, s, true, earnedBefore);
    next = result.save;
    unlocks.push(...result.unlocks);
    starCoins += reward.coins;
    granted.push({ star: s, reward });
  }
  next = { ...next, stars: { ...next.stars, [level.id]: Math.max(previousStars, stars) } };

  // Features opened by clearing a level are revealed after that result's star rewards
  for (const f of FEATURES) {
    if (f.clearLevel && !next[f.saveFlag] && (next.stars[f.clearLevel] ?? 0) >= 1) {
      next = unlockFeature(next, f.id);
      unlocks.push({ kind: 'feature', feature: f.id, star: 1 });
    }
  }

  const completedBounties: BountyDef[] = [];
  let bountyCoins = 0;
  if (next.bountiesUnlocked) {
    // Loop so a coin bounty pushing lifetimeCoins past 1,000 can cascade cleanly
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const b of BOUNTIES) {
        if (next.completedBounties.includes(b.id)) continue;
        if (b.progress(next) >= b.target) {
          progressed = true;
          completedBounties.push(b);
          const result = grant({ ...next, completedBounties: [...next.completedBounties, b.id] }, b.reward, 0, true, next);
          next = result.save;
          unlocks.push(...result.unlocks);
          bountyCoins += b.reward.coins;
        }
      }
    }
  }

  const newlyOpenedBiomes = BIOMES.filter(b => b.starGate > 0 && !isBiomeOpen(before, b.id) && isBiomeOpen(next, b.id)).map(b => b.id);

  return {
    save: next,
    granted,
    coinsBanked: runCoins,
    starCoins,
    bountyCoins,
    completedBounties,
    unlocks,
    newlyOpenedBiomes,
  };
};

/**
 * Signs that a save used a feature before its unlock flag was added to the save
 * format. Every star has always paid coins, so any progress at all shows up as
 * `lifetimeCoins > 0`; bought upgrades show the Workshop was open.
 */
const USED_BEFORE_FLAG: Record<UnlockableFeature, (save: AdventureSave) => boolean> = {
  coins: s => s.lifetimeCoins > 0,
  workshop: s => Object.keys(s.upgrades).length > 0 || Object.keys(s.weaponUpgrades).length > 0,
  bounties: () => false,
};

/**
 * Bring an older save in line with the current level table: anything a level's
 * already-earned stars now unlock (a fighter, weapon, Arcana, Combo recipe or
 * campaign feature that moved there in an update) is granted. Coins are never paid twice.
 */
export const reconcileUnlocks = (save: AdventureSave): AdventureSave => {
  let next = migrateSave(save);
  const regrant = (reward: RewardDef) => {
    next = grant(next, { ...reward, coins: 0 }, 0, false).save;
  };
  for (const level of LEVELS) {
    starRewards(level).slice(0, save.stars[level.id] ?? 0).forEach(regrant);
  }
  for (const f of FEATURES) {
    const cleared = !!f.clearLevel && (next.stars[f.clearLevel] ?? 0) >= 1;
    if (!next[f.saveFlag] && (cleared || USED_BEFORE_FLAG[f.id](next))) next = unlockFeature(next, f.id);
  }
  for (const id of next.completedBounties) {
    const b = BOUNTIES.find(x => x.id === id);
    if (b) regrant(b.reward);
  }
  // Recipes and weapons that no longer exist (renamed in an update) are dropped
  const known = new Set(EVOLUTION_RECIPES.map(r => r.id));
  next = {
    ...next,
    armory: next.armory.filter(id => !!getArmoryWeapon(id)),
    unlockedEvolutions: next.unlockedEvolutions.filter(id => known.has(id)),
    discoveredEvolutions: next.discoveredEvolutions.filter(id => known.has(id)),
  };
  return trimEquipped(normalizeSkillNodes(settleWeaponTiers(next)));
};

// ─── What the player has met so far ─────────────────────────────────────────

/** A mechanic is known once its lesson was seen, the level teaching it has a star, or the feature it explains is unlocked. */
export const isMechanicKnown = (save: AdventureSave, mechanicId: string): boolean =>
  save.seenMechanics.includes(mechanicId) ||
  LEVELS.some(l => l.introduces === mechanicId && (save.stars[l.id] ?? 0) >= 1) ||
  FEATURES.some(f => f.mechanic === mechanicId && save[f.saveFlag]);

/**
 * Extra conditions some Workshop items have on top of their mechanic being
 * known. Tarot Deck only makes sense once there are two Arcana to wear.
 */
const UPGRADE_GATES: Record<string, (save: AdventureSave) => boolean> = {
  tarot_deck: s => s.unlockedArcana.length >= 2,
};

/** A Workshop upgrade is on sale once its mechanic is known (and stays listed while any tier is owned). */
const isUpgradeUnlocked = (save: AdventureSave, upgrade: UpgradeDef): boolean =>
  (save.upgrades[upgrade.id] ?? 0) > 0 ||
  (isMechanicKnown(save, upgrade.mechanic) && (UPGRADE_GATES[upgrade.id]?.(save) ?? true));

export const getUnlockedUpgrades = (save: AdventureSave): UpgradeDef[] =>
  UPGRADES.filter(u => isUpgradeUnlocked(save, u));

// ─── Camp purchases (every one refundable at 100%) ──────────────────────────

/** Something bought step by step with coins: each step has a price, and all of it can be refunded. */
interface TrackDef<K extends string> {
  /** Price of each step, first step first. null: there is no such item. */
  costs: (key: K) => readonly number[] | null;
  /** Steps bought so far */
  steps: (save: AdventureSave, key: K) => number;
  withSteps: (save: AdventureSave, key: K, steps: number) => AdventureSave;
  /** Whether the item is on sale at all, before looking at the price */
  onSale: (save: AdventureSave, key: K) => boolean;
  /** Steps that can be bought at most (default: every listed price) */
  maxSteps?: (save: AdventureSave, key: K) => number;
}

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

const purchaseTrack = <K extends string>(def: TrackDef<K>) => {
  /** Price of the next step, or null when maxed out */
  const cost = (save: AdventureSave, key: K): number | null => {
    const steps = def.steps(save, key);
    if (def.maxSteps && steps >= def.maxSteps(save, key)) return null;
    return def.costs(key)?.[steps] ?? null;
  };
  const canBuy = (save: AdventureSave, key: K): boolean => {
    const price = cost(save, key);
    return price !== null && def.onSale(save, key) && save.coins >= price;
  };
  const buy = (save: AdventureSave, key: K): AdventureSave =>
    canBuy(save, key)
      ? { ...def.withSteps(save, key, def.steps(save, key) + 1), coins: save.coins - cost(save, key)! }
      : save;
  /** Coins put into this item so far */
  const spent = (save: AdventureSave, key: K): number =>
    sum((def.costs(key) ?? []).slice(0, Math.max(0, def.steps(save, key))));
  /** Give every coin back and return the item to its starting state */
  const refund = (save: AdventureSave, key: K): AdventureSave => {
    const coins = spent(save, key);
    return coins > 0 ? { ...def.withSteps(save, key, 0), coins: save.coins + coins } : save;
  };
  return { cost, canBuy, buy, spent, refund };
};

/** A tier map where an absent key means tier 0. */
const withTier = (tiers: Record<string, number>, key: string, tier: number): Record<string, number> => {
  const next = { ...tiers };
  if (tier > 0) next[key] = tier;
  else delete next[key];
  return next;
};

const upgradeTrack = purchaseTrack<string>({
  costs: id => UPGRADES.find(u => u.id === id)?.costs ?? null,
  steps: (save, id) => save.upgrades[id] ?? 0,
  // Losing a Charm Belt or Tarot Deck tier also takes off what no longer fits
  withSteps: (save, id, steps) => trimEquipped({ ...save, upgrades: withTier(save.upgrades, id, steps) }),
  onSale: (save, id) => save.workshopUnlocked && isUpgradeUnlocked(save, getUpgrade(id)),
});

/**
 * Workshop tiers of an Armory weapon. The k-th tier bought costs the k-th
 * price, whatever free tiers the weapon has, so a refund returns exactly what
 * was paid; free tiers only lower how many can still be bought.
 */
const weaponUpgradeTrack = purchaseTrack<string>({
  costs: weaponUpgradeCosts,
  steps: boughtWeaponTiers,
  withSteps: (save, id, steps) => ({ ...save, weaponUpgrades: withTier(save.weaponUpgrades, id, steps) }),
  onSale: (save, id) => save.workshopUnlocked && save.armory.includes(id),
  maxSteps: (save, id) => MAX_WEAPON_UPGRADE_TIER - freeWeaponTiers(save, id),
});

export const upgradeTier = (save: AdventureSave, id: string): number => save.upgrades[id] ?? 0;
export const { cost: upgradeCost, canBuy: canBuyUpgrade, buy: buyUpgrade, spent: upgradeSpentCoins, refund: refundUpgrade } = upgradeTrack;

export { weaponUpgradeTier, freeWeaponTiers, weaponTiers } from './weaponLevels';
export const {
  cost: weaponUpgradeCost,
  canBuy: canUpgradeWeapon,
  buy: buyWeaponUpgrade,
  spent: weaponUpgradeSpentCoins,
  refund: refundWeaponUpgrade,
} = weaponUpgradeTrack;

/** Total coins currently refundable across mechanic upgrades and weapon upgrades. */
export const refundableCoins = (save: AdventureSave): number =>
  sum(UPGRADES.map(u => upgradeSpentCoins(save, u.id))) +
  sum(Object.keys(save.weaponUpgrades).map(id => weaponUpgradeSpentCoins(save, id)));

/** One-tap respec: refund 100% of coins spent on every Workshop item and weapon upgrade. */
export const refundAllCamp = (save: AdventureSave): AdventureSave => {
  const refund = refundableCoins(save);
  if (refund <= 0) return save;
  return trimEquipped({ ...save, coins: save.coins + refund, upgrades: {}, weaponUpgrades: {} });
};

// ─── Lessons and tips already shown ─────────────────────────────────────────

/**
 * Keys held in `save.seenMechanics`: one per mechanic lesson played, plus
 * one-off lessons that belong to no mechanic. The stored strings are part of
 * the save format.
 */
export const LESSON_KEYS = {
  mechanic: (mechanicId: string) => mechanicId,
  /** The "your first evolution is near" page (lessons.ts) */
  comboDiscovery: 'combo_hunt_intro',
} as const;

/** Keys held in `save.seenCoachMarks`, one per in-fight tip that is shown only once. */
export const COACH_KEYS = {
  /** A mechanic's first-time event tip (`MechanicDef.coachMark`) */
  event: (mechanicId: string) => mechanicId,
  /** A mechanic's tips at the start of its first fight (`MechanicDef.fightTips`) */
  fightStart: (mechanicId: string) => `start_${mechanicId}`,
  /** The first fight with a fighter: what its two passives do */
  passives: (fighter: CharacterName) => `passives_${fighter}`,
  /** The first fight where a level places this hazard */
  hazard: (kind: 'timeBombs' | 'snares') => `hazard_${kind}`,
  /** The first time an evolution starts */
  evolution: 'evolution_first',
} as const;

export const markMechanicSeen = (save: AdventureSave, key: string): AdventureSave =>
  save.seenMechanics.includes(key) ? save : { ...save, seenMechanics: [...save.seenMechanics, key] };

export const markCoachMarkSeen = (save: AdventureSave, key: string): AdventureSave =>
  save.seenCoachMarks.includes(key) ? save : { ...save, seenCoachMarks: [...save.seenCoachMarks, key] };

/**
 * Dev helper: every star, unlock and Workshop item. Skill trees are left
 * empty so the stars can be spent by hand.
 */
export const createMaxedSave = (): AdventureSave => {
  const mechanicIds = Object.keys(MECHANICS);
  let save: AdventureSave = {
    ...createNewSave(),
    stars: Object.fromEntries(LEVELS.map(l => [l.id, 3])),
    plays: Object.fromEntries(LEVELS.map(l => [l.id, 1])),
    seenMechanics: [...mechanicIds.map(LESSON_KEYS.mechanic), LESSON_KEYS.comboDiscovery],
    seenCoachMarks: [
      ...mechanicIds.map(COACH_KEYS.event),
      ...mechanicIds.map(COACH_KEYS.fightStart),
      ...FIGHTERS.map(f => COACH_KEYS.passives(f.name)),
      COACH_KEYS.hazard('timeBombs'),
      COACH_KEYS.hazard('snares'),
      COACH_KEYS.evolution,
    ],
    coins: 50000,
    upgrades: Object.fromEntries(UPGRADES.map(u => [u.id, u.costs.length])),
    unlockedArcana: ARCANA.map(a => a.id),
    unlockedEvolutions: EVOLUTION_RECIPES.map(r => r.id),
    discoveredEvolutions: EVOLUTION_RECIPES.map(r => r.id),
  };
  for (const f of FEATURES) save = unlockFeature(save, f.id);
  for (const l of LEVELS) {
    for (const r of starRewards(l)) save = grant(save, r).save;
  }
  for (const b of BOUNTIES) save = grant(save, { ...b.reward, coins: 0 }).save;
  return save;
};
