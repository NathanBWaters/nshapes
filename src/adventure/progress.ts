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
import { LEVELS, MAIN_LEVELS, SIDE_PATHS, branchStars, isPathHidden, mainIndexOf } from './data/levels';
import { BIOMES, getBiome } from './data/biomes';
import { MECHANICS } from './data/mechanics';
import { FIGHTERS, STARTING_FIGHTERS } from './data/fighters';
import { UPGRADES, getUpgrade, LEGACY_WEAPON_LEVEL_COSTS } from './data/upgrades';
import { ARCANA } from './data/arcana';
import { getArmoryWeapon, resolveLegacyWeapon } from './data/armory';
import { MAX_WEAPON_LEVEL } from './data/weaponStats';
import { LEGACY_WEAPON_RARITY, WEAPONS } from '@/utils/gameDefinitions';
import { SKILL_NODES, skillTreeOf, CAMPAIGN_STARS } from './data/skillTrees';
import { BOUNTIES } from './data/bounties';
import { EVOLUTION_RECIPES } from './data/evolutions';
import { CAMPAIGN_FEATURES, FEATURES } from './data/features';
import { starRewards, unlockablesOf } from './data/rewards';
import { tuningSpent, weaponLevel } from './weaponLevels';

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
  weaponTuning: {},
  legacyWeaponTiers: {},
  coinsUnlocked: false,
  workshopUnlocked: false,
  seenMechanics: [],
  seenCoachMarks: [],
  selectedFighter: 'Orange Tabby',
  musicOn: true,
  effectsOn: true,
  revealedPaths: [],
});

// ─── Stars & unlocks ────────────────────────────────────────────────────────

/** Every star ever earned (best result per level). Star gates read this, so spending never re-locks a world. */
export const totalStarsEarned = (save: AdventureSave): number =>
  Object.values(save.stars).reduce((a, b) => a + b, 0);

/** @alias totalStarsEarned */
export const totalStars = totalStarsEarned;

export const maxStars = (): number => CAMPAIGN_STARS;

export const isBiomeOpen = (save: AdventureSave, biomeId: LevelDef['biome']): boolean =>
  totalStarsEarned(save) >= getBiome(biomeId).starGate;

// ─── Star pool & skill trees ────────────────────────────────────────────────

const NODES_BY_ID = new Map<string, SkillNode>(SKILL_NODES.map(n => [n.id, n]));

const findNode = (id: string): SkillNode | undefined => NODES_BY_ID.get(id);

/**
 * Stars this fighter can still spend. Every fighter spends from every star
 * earned (data/skillTrees.ts, star budget): what one fighter buys never
 * costs another anything.
 */
export const availableStars = (save: AdventureSave, fighter: CharacterName): number =>
  totalStarsEarned(save) - fighterStarsSpent(save, fighter);

/** Some unlocked fighter has stars left to spend (the Camp badge on the map). */
export const hasUnspentStars = (save: AdventureSave): boolean =>
  save.unlockedFighters.some(f => availableStars(save, f) > 0 && skillTreeOf(f).some(n => !ownsNode(save, n.id)));

export const ownedNodes = (save: AdventureSave, fighter: CharacterName): string[] => save.skillNodes[fighter] ?? [];

export const ownsNode = (save: AdventureSave, nodeId: string): boolean => {
  const node = findNode(nodeId);
  return !!node && ownedNodes(save, node.fighter).includes(nodeId);
};

/** Stars spent on one fighter's tree. */
export const fighterStarsSpent = (save: AdventureSave, fighter: CharacterName): number =>
  ownedNodes(save, fighter).reduce((sum, id) => sum + (findNode(id)?.cost ?? 0), 0);

/**
 * The owned nodes that still hang together: reachable from a passive root
 * through owned nodes only (breadth-first from every node that touches a root).
 */
const connectedFromRoots = (owned: ReadonlySet<string>): Set<string> => {
  const seen = new Set<string>();
  const queue = [...owned].filter(id => (findNode(id)?.roots.length ?? 0) > 0);
  for (const id of queue) seen.add(id);
  while (queue.length > 0) {
    const n = findNode(queue.shift()!);
    for (const next of n?.links ?? []) {
      if (owned.has(next) && !seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  return seen;
};

/** True when the node touches a passive root or a node the player owns. */
const isLinked = (save: AdventureSave, node: SkillNode): boolean =>
  node.roots.length > 0 || node.links.some(id => ownsNode(save, id));

/** True while the node is sealed behind a star requirement the player hasn't earned. */
export const isNodeSealed = (save: AdventureSave, node: SkillNode): boolean =>
  !!node.requires && totalStarsEarned(save) < node.requires.starsEarned;

export type NodeStatus =
  | 'owned'
  /** Linked to something owned (or a passive) and the stars are there */
  | 'buyable'
  /** Linked, but stars are short */
  | 'needsStars'
  /** Nothing it links to is owned yet */
  | 'needsLink'
  /** Linked, but sealed until more stars have been earned */
  | 'sealed'
  | 'fighterLocked';

export const nodeStatus = (save: AdventureSave, nodeId: string): NodeStatus => {
  const node = findNode(nodeId);
  if (!node || !save.unlockedFighters.includes(node.fighter)) return 'fighterLocked';
  if (ownsNode(save, nodeId)) return 'owned';
  if (!isLinked(save, node)) return 'needsLink';
  if (isNodeSealed(save, node)) return 'sealed';
  return availableStars(save, node.fighter) >= node.cost ? 'buyable' : 'needsStars';
};

export const canBuyNode = (save: AdventureSave, nodeId: string): boolean => nodeStatus(save, nodeId) === 'buyable';

export const buyNode = (save: AdventureSave, nodeId: string): AdventureSave => {
  if (!canBuyNode(save, nodeId)) return save;
  const node = findNode(nodeId)!;
  return { ...save, skillNodes: { ...save.skillNodes, [node.fighter]: [...ownedNodes(save, node.fighter), nodeId] } };
};

const withFighterNodes = (save: AdventureSave, fighter: CharacterName, ids: string[]): AdventureSave => {
  const skillNodes = { ...save.skillNodes };
  if (ids.length > 0) skillNodes[fighter] = ids;
  else delete skillNodes[fighter];
  return { ...save, skillNodes };
};

/**
 * Owned nodes that would be cut off from both passives if this node were
 * refunded. Empty means the node can be refunded on its own.
 */
export const refundBlockers = (save: AdventureSave, nodeId: string): SkillNode[] => {
  const node = findNode(nodeId);
  if (!node || !ownsNode(save, nodeId)) return [];
  const rest = new Set(ownedNodes(save, node.fighter).filter(id => id !== nodeId));
  const kept = connectedFromRoots(rest);
  return [...rest].filter(id => !kept.has(id)).map(id => findNode(id)!);
};

export const canRefundNode = (save: AdventureSave, nodeId: string): boolean =>
  ownsNode(save, nodeId) && refundBlockers(save, nodeId).length === 0;

/** Give back one node's stars. Only when every other owned node stays connected to a passive. */
export const refundNode = (save: AdventureSave, nodeId: string): AdventureSave => {
  if (!canRefundNode(save, nodeId)) return save;
  const node = findNode(nodeId)!;
  return withFighterNodes(save, node.fighter, ownedNodes(save, node.fighter).filter(id => id !== nodeId));
};

/** Give back every star spent on this fighter. Free, any time. */
export const refundFighter = (save: AdventureSave, fighter: CharacterName): AdventureSave =>
  withFighterNodes(save, fighter, []);

/**
 * Keep only nodes that still exist, belong to the fighter they are filed under
 * and still connect to a passive through owned nodes. If a fighter's tree now
 * costs more than the player earned (a rebalance, or more levels scaling the
 * costs up), that fighter's stars are handed back.
 */
const normalizeSkillNodes = (save: AdventureSave): AdventureSave => {
  // Without tree data (a partial build) leave the save alone rather than wiping it
  if (SKILL_NODES.length === 0) return save;
  const skillNodes: Record<string, string[]> = {};
  for (const [fighter, ids] of Object.entries(save.skillNodes)) {
    const owned = new Set(ids.filter(id => findNode(id)?.fighter === fighter));
    const connected = connectedFromRoots(owned);
    const keep = [...owned].filter(id => connected.has(id));
    const spent = keep.reduce((sum, id) => sum + (findNode(id)?.cost ?? 0), 0);
    if (keep.length > 0 && spent <= totalStarsEarned(save)) skillNodes[fighter] = keep;
  }
  return { ...save, skillNodes };
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
    r => unlockedEvolutions.length > 0 && r.families.every(f => weaponIds.some(id => inFamily(id, f)))
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

/** The rarity an old weapon id had, which set its old Workshop level prices. */
const legacyRarityOf = (id: string) =>
  LEGACY_WEAPON_RARITY[id] ?? WEAPONS.find(w => w.id === id)?.rarity ?? 'common';

/**
 * Weapons from older saves:
 * - every old id maps to its one weapon (the Mastery weapons, bundle epics'
 *   second effect and cap-raising legendaries are dropped), and owning a
 *   stronger rare/epic copy gives that weapon a level floor;
 * - Workshop levels bought with coins are refunded at the price paid: levels
 *   are found in the world now, and the Workshop sells tuning instead.
 * Safe to run more than once.
 */
export const migrateWeaponIds = (save: AdventureSave): AdventureSave => {
  const legacyWeaponTiers: Record<string, number> = { ...(save.legacyWeaponTiers ?? {}) };
  const armory: string[] = [];
  for (const old of save.armory) {
    const to = resolveLegacyWeapon(old);
    if (!to) continue;
    if (!armory.includes(to.id)) armory.push(to.id);
    if (to.tier > 0) legacyWeaponTiers[to.id] = Math.min(MAX_WEAPON_LEVEL - 1, Math.max(legacyWeaponTiers[to.id] ?? 0, to.tier));
  }
  let refund = 0;
  for (const [old, tier] of Object.entries(save.weaponUpgrades ?? {})) {
    const bought = Math.max(0, Math.min(3, Math.floor(Number(tier) || 0)));
    refund += LEGACY_WEAPON_LEVEL_COSTS[legacyRarityOf(old)].slice(0, bought).reduce((a, b) => a + b, 0);
  }
  const charms: string[] = [];
  for (const old of save.charms) {
    const to = resolveLegacyWeapon(old);
    if (to && !charms.includes(to.id)) charms.push(to.id);
  }
  const weaponTuning: Record<string, Record<string, number>> = {};
  for (const [old, tuning] of Object.entries(save.weaponTuning ?? {})) {
    const to = resolveLegacyWeapon(old);
    if (to) weaponTuning[to.id] = { ...(weaponTuning[to.id] ?? {}), ...tuning };
  }
  return { ...save, coins: save.coins + refund, armory, charms, weaponUpgrades: {}, weaponTuning, legacyWeaponTiers };
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
 * star gate is met. A side path opens (and first appears on the map) once its
 * parent level has the stars it asks for: ★★ unless the path says otherwise.
 */
export const getLockReason = (save: AdventureSave, level: LevelDef): LockReason | null => {
  if (level.branchOf) {
    return isPathHidden(level, save) ? { kind: 'branch', parentId: level.branchOf, need: branchStars(level) } : null;
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

// ─── Secret side paths ──────────────────────────────────────────────────────

/** Side paths that are open, and so drawn on the map. */
export const openPaths = (save: AdventureSave): LevelDef[] => SIDE_PATHS.filter(l => !isPathHidden(l, save));

/** Open paths whose arrival the map has not played yet. */
export const freshPaths = (save: AdventureSave): LevelDef[] =>
  openPaths(save).filter(l => !save.revealedPaths.includes(l.id));

export const markPathsRevealed = (save: AdventureSave, ids: readonly string[]): AdventureSave => {
  const add = ids.filter(id => !save.revealedPaths.includes(id));
  return add.length > 0 ? { ...save, revealedPaths: [...save.revealedPaths, ...add] } : save;
};

/**
 * A save from before side paths were secret: the campaign branches it had open
 * were already on its map, so they arrive without fanfare. Practice paths are
 * new, and still get their moment.
 */
export const pathsSeenBeforeSecrets = (save: AdventureSave): string[] =>
  openPaths(save).filter(l => !l.rules.sandbox).map(l => l.id);

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
   * another copy found, so it is now at that level.
   */
  | { kind: 'weapon'; id: string; star: number; firstWeapon: boolean; level?: number }
  | { kind: 'arcana'; id: ArcanaId; star: number }
  | { kind: 'evolution'; id: string; star: number; firstEvolution: boolean }
  | { kind: 'feature'; feature: UnlockableFeature; star: number }
  /** A secret side path opened on the map (`star` = the stars on its parent that opened it) */
  | { kind: 'path'; levelId: string; star: number };

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
          // Already owned: this reward is another copy found, +1 level (derived from earned stars/bounties, see weaponLevels.ts)
          const level = weaponLevel(next, u.id);
          if (level > weaponLevel(before, u.id)) unlocks.push({ kind: 'weapon', id: u.id, star, firstWeapon: false, level });
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
  return { save: next, unlocks };
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

/** A practice fight: it is counted as played and its evolutions are remembered; nothing else changes. */
const applyPracticeResult = (save: AdventureSave, level: LevelDef, run?: RunState): ResultApplication => {
  const forged = run?.forgedRecipes ?? [];
  return {
    save: {
      ...save,
      plays: { ...save.plays, [level.id]: (save.plays[level.id] ?? 0) + 1 },
      discoveredEvolutions: forged.length > 0 ? [...new Set([...save.discoveredEvolutions, ...forged])] : save.discoveredEvolutions,
    },
    granted: [],
    coinsBanked: 0,
    starCoins: 0,
    bountyCoins: 0,
    completedBounties: [],
    unlocks: [],
    newlyOpenedBiomes: [],
  };
};

/** Bank run coins + grant first-time star rewards + evaluate cross-run bounties. */
export const applyLevelResult = (
  save: AdventureSave,
  level: LevelDef,
  stars: number,
  runCoins: number,
  run?: RunState
): ResultApplication => {
  if (level.rules.sandbox) return applyPracticeResult(save, level, run);
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

  // Secret paths this result opened are revealed last: the map is where they lead
  for (const path of SIDE_PATHS) {
    if (isPathHidden(path, before) && !isPathHidden(path, next)) unlocks.push({ kind: 'path', levelId: path.id, star: branchStars(path) });
  }

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
  workshop: s => Object.keys(s.upgrades).length > 0 || Object.keys(s.weaponTuning ?? {}).length > 0,
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
  return trimEquipped(normalizeSkillNodes(next));
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

export const upgradeTier = (save: AdventureSave, id: string): number => save.upgrades[id] ?? 0;
export const { cost: upgradeCost, canBuy: canBuyUpgrade, buy: buyUpgrade, spent: upgradeSpentCoins, refund: refundUpgrade } = upgradeTrack;

export {
  weaponLevel,
  weaponLevelsInWorld,
  weaponBuild,
  weaponBuilds,
  weaponTuning,
  tuningCost,
  canTune,
  buyTuning,
  tuningSpent,
  refundTuning,
} from './weaponLevels';

/** Total coins currently refundable across mechanic upgrades and weapon tuning. */
export const refundableCoins = (save: AdventureSave): number =>
  sum(UPGRADES.map(u => upgradeSpentCoins(save, u.id))) +
  sum(Object.keys(save.weaponTuning ?? {}).map(id => tuningSpent(save, id)));

/** One-tap respec: refund 100% of coins spent on every Workshop item and all weapon tuning. */
export const refundAllCamp = (save: AdventureSave): AdventureSave => {
  const refund = refundableCoins(save);
  if (refund <= 0) return save;
  return trimEquipped({ ...save, coins: save.coins + refund, upgrades: {}, weaponTuning: {} });
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
    revealedPaths: SIDE_PATHS.map(l => l.id),
  };
  for (const f of FEATURES) save = unlockFeature(save, f.id);
  for (const l of LEVELS) {
    for (const r of starRewards(l)) save = grant(save, r).save;
  }
  for (const b of BOUNTIES) save = grant(save, { ...b.reward, coins: 0 }).save;
  return save;
};

/**
 * Dev helper: ★★★ on every main level before this one, with their lessons
 * seen, so this level is the next to play (side paths are left to be found).
 */
export const createSaveBefore = (levelId: string): AdventureSave => {
  const earlier = MAIN_LEVELS.slice(0, Math.max(0, MAIN_LEVELS.findIndex(l => l.id === levelId)));
  let save = createNewSave();
  for (const l of earlier) save = applyLevelResult(save, l, 3, 0).save;
  return { ...save, seenMechanics: [...new Set([...save.seenMechanics, ...earlier.map(l => LESSON_KEYS.mechanic(l.introduces))])] };
};
