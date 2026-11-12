/**
 * Pure progression logic: unlock rules, star rewards, purchases.
 * No storage I/O here, so it's easy to test and simulate.
 */
import type { CharacterName } from '@/types';
import type {
  AbilityId,
  AdventureSave,
  ArcanaId,
  BountyDef,
  BountyStats,
  LevelDef,
  RewardDef,
  RunState,
  UnlockableFeature,
  UpgradeDef,
} from './types';
import { LEVELS, MAIN_LEVELS, BRANCH_STAR_REQUIREMENT, mainIndexOf } from './data/levels';
import { BIOMES, getBiome } from './data/biomes';
import { MECHANICS } from './data/mechanics';
import { FIGHTERS, FIGHTER_LEVEL_COSTS, STARTING_FIGHTERS } from './data/fighters';
import { UPGRADES, getUpgrade, getWeaponUpgradeCosts } from './data/upgrades';
import { ABILITIES } from './data/abilities';
import { ARCANA } from './data/arcana';
import { getArmoryWeapon } from './data/armory';
import { fighterLevel } from './loadout';
import { BOUNTIES } from './data/bounties';
import { EVOLUTION_RECIPES } from './data/evolutions';
import { CAMPAIGN_FEATURES, FEATURES } from './data/features';
import { starRewards, unlockablesOf } from './data/rewards';

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
  fighterLevels: { 'Orange Tabby': 1 },
  unlockedFighters: [...STARTING_FIGHTERS],
  // Only weapons won from star/bounty rewards. Fighter gear is separate.
  armory: [],
  charm: null,
  unlockedArcana: [],
  activeArcana: null,
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
  },
  unlockedEvolutions: [],
  discoveredEvolutions: [],
  upgrades: {},
  weaponUpgrades: {},
  coinsUnlocked: false,
  workshopUnlocked: false,
  seenMechanics: [],
  seenCoachMarks: [],
  selectedFighter: 'Orange Tabby',
  musicOn: true,
});

// ─── Stars & unlocks ────────────────────────────────────────────────────────

export const totalStars = (save: AdventureSave): number =>
  Object.values(save.stars).reduce((a, b) => a + b, 0);

export const maxStars = (): number => LEVELS.length * 3;

export const isBiomeOpen = (save: AdventureSave, biomeId: LevelDef['biome']): boolean =>
  totalStars(save) >= getBiome(biomeId).starGate;

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
  | { kind: 'weapon'; id: string; star: number; firstWeapon: boolean }
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
const grant = (save: AdventureSave, reward: RewardDef, star = 0): { save: AdventureSave; unlocks: Unlock[] } => {
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
          next.fighterLevels = { ...next.fighterLevels, [u.id]: 1 };
        }
        break;
      case 'weapon':
        if (!next.armory.includes(u.id)) {
          unlocks.push({ kind: 'weapon', id: u.id, star, firstWeapon: next.armory.length === 0 });
          next.armory = [...next.armory, u.id];
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
  // With no charm equipped, a weapon reward is equipped straight away
  if (reward.weapons && !next.charm && next.armory.length > 0) next.charm = reward.weapons[0];
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
    evolutionsForged: prev.evolutionsForged + run.evolvedRecipes.length,
    destructiveFights: prev.destructiveFights + (destructive ? 1 : 0),
    fighterWins,
  };
  const discoveredEvolutions =
    run.evolvedRecipes.length > 0
      ? [...new Set([...save.discoveredEvolutions, ...run.evolvedRecipes])]
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
    const result = grant(next, reward, s);
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
          const result = grant({ ...next, completedBounties: [...next.completedBounties, b.id] }, b.reward);
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
  let next = save;
  const regrant = (reward: RewardDef) => {
    next = grant(next, { ...reward, coins: 0 }).save;
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
  if (next.charm && !next.armory.includes(next.charm)) next = { ...next, charm: next.armory[0] ?? null };
  if (next.activeArcana && !next.unlockedArcana.includes(next.activeArcana)) next = { ...next, activeArcana: null };
  return next;
};

// ─── What the player has met so far ─────────────────────────────────────────

/** A mechanic is known once its lesson was seen, the level teaching it has a star, or the feature it explains is unlocked. */
export const isMechanicKnown = (save: AdventureSave, mechanicId: string): boolean =>
  save.seenMechanics.includes(mechanicId) ||
  LEVELS.some(l => l.introduces === mechanicId && (save.stars[l.id] ?? 0) >= 1) ||
  FEATURES.some(f => f.mechanic === mechanicId && save[f.saveFlag]);

/** A Workshop upgrade is on sale once its mechanic is known (and stays listed while any tier is owned). */
const isUpgradeUnlocked = (save: AdventureSave, upgrade: UpgradeDef): boolean =>
  (save.upgrades[upgrade.id] ?? 0) > 0 || isMechanicKnown(save, upgrade.mechanic);

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
}

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

const purchaseTrack = <K extends string>(def: TrackDef<K>) => {
  /** Price of the next step, or null when maxed out */
  const cost = (save: AdventureSave, key: K): number | null => def.costs(key)?.[def.steps(save, key)] ?? null;
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

const fighterTrack = purchaseTrack<CharacterName>({
  costs: () => FIGHTER_LEVEL_COSTS,
  steps: (save, name) => fighterLevel(save, name) - 1,
  withSteps: (save, name, steps) => ({ ...save, fighterLevels: { ...save.fighterLevels, [name]: steps + 1 } }),
  onSale: (save, name) => save.unlockedFighters.includes(name),
});

const upgradeTrack = purchaseTrack<string>({
  costs: id => getUpgrade(id).costs,
  steps: (save, id) => save.upgrades[id] ?? 0,
  withSteps: (save, id, steps) => ({ ...save, upgrades: withTier(save.upgrades, id, steps) }),
  onSale: (save, id) => save.workshopUnlocked && isUpgradeUnlocked(save, getUpgrade(id)),
});

const weaponUpgradeTrack = purchaseTrack<string>({
  costs: id => {
    const weapon = getArmoryWeapon(id);
    return weapon ? getWeaponUpgradeCosts(weapon.rarity) : null;
  },
  steps: (save, id) => save.weaponUpgrades[id] ?? 0,
  withSteps: (save, id, steps) => ({ ...save, weaponUpgrades: withTier(save.weaponUpgrades, id, steps) }),
  onSale: (save, id) => save.workshopUnlocked && save.armory.includes(id),
});

export const { canBuy: canLevelFighter, buy: levelFighter, spent: fighterSpentCoins, refund: refundFighter } = fighterTrack;

export const upgradeTier = (save: AdventureSave, id: string): number => save.upgrades[id] ?? 0;
export const { cost: upgradeCost, canBuy: canBuyUpgrade, buy: buyUpgrade, spent: upgradeSpentCoins, refund: refundUpgrade } = upgradeTrack;

export const weaponUpgradeTier = (save: AdventureSave, weaponId: string): number => save.weaponUpgrades[weaponId] ?? 0;
export const {
  cost: weaponUpgradeCost,
  canBuy: canUpgradeWeapon,
  buy: buyWeaponUpgrade,
  spent: weaponUpgradeSpentCoins,
  refund: refundWeaponUpgrade,
} = weaponUpgradeTrack;

/** Total coins currently refundable across all fighters, mechanic upgrades, and weapon upgrades. */
export const refundableCoins = (save: AdventureSave): number =>
  sum(FIGHTERS.map(f => fighterSpentCoins(save, f.name))) +
  sum(UPGRADES.map(u => upgradeSpentCoins(save, u.id))) +
  sum(Object.keys(save.weaponUpgrades).map(id => weaponUpgradeSpentCoins(save, id)));

/** One-tap respec: refund 100% of coins spent on every fighter, mechanic upgrade, and weapon upgrade. */
export const refundAllCamp = (save: AdventureSave): AdventureSave => {
  const refund = refundableCoins(save);
  if (refund <= 0) return save;
  const resetLevels: Record<string, number> = {};
  for (const name of Object.keys(save.fighterLevels)) resetLevels[name] = 1;
  return {
    ...save,
    coins: save.coins + refund,
    fighterLevels: resetLevels,
    upgrades: {},
    weaponUpgrades: {},
  };
};

export const equipCharm = (save: AdventureSave, weaponId: string | null): AdventureSave =>
  weaponId === null || save.armory.includes(weaponId) ? { ...save, charm: weaponId } : save;

export const equipArcana = (save: AdventureSave, arcanaId: ArcanaId | null): AdventureSave =>
  arcanaId === null || save.unlockedArcana.includes(arcanaId) ? { ...save, activeArcana: arcanaId } : save;

// ─── Lessons and tips already shown ─────────────────────────────────────────

/**
 * Keys held in `save.seenMechanics`: one per mechanic lesson played, plus
 * one-off lessons that belong to no mechanic. The stored strings are part of
 * the save format.
 */
export const LESSON_KEYS = {
  mechanic: (mechanicId: string) => mechanicId,
  /** The "your first Weapon Combo is near" page (lessons.ts) */
  comboDiscovery: 'combo_hunt_intro',
} as const;

/** Keys held in `save.seenCoachMarks`, one per in-fight tip that is shown only once. */
export const COACH_KEYS = {
  /** A mechanic's first-time event tip (`MechanicDef.coachMark`) */
  event: (mechanicId: string) => mechanicId,
  /** A mechanic's tips at the start of its first fight (`MechanicDef.fightTips`) */
  fightStart: (mechanicId: string) => `start_${mechanicId}`,
  abilityReady: (abilityId: AbilityId) => `ability_${abilityId}`,
} as const;

export const markMechanicSeen = (save: AdventureSave, key: string): AdventureSave =>
  save.seenMechanics.includes(key) ? save : { ...save, seenMechanics: [...save.seenMechanics, key] };

export const markCoachMarkSeen = (save: AdventureSave, key: string): AdventureSave =>
  save.seenCoachMarks.includes(key) ? save : { ...save, seenCoachMarks: [...save.seenCoachMarks, key] };

/** Dev helper: unlock everything. */
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
      ...(Object.keys(ABILITIES) as AbilityId[]).map(COACH_KEYS.abilityReady),
    ],
    coins: 50000,
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
