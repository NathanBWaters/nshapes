/**
 * Pure progression logic: unlock rules, star rewards, purchases.
 * No storage I/O here, so it's easy to test and simulate.
 */
import type { CharacterName } from '@/types';
import { WEAPONS } from '@/utils/gameDefinitions';
import type {
  AdventureSave,
  ArcanaId,
  BountyDef,
  BountyStats,
  FeatureFlag,
  LevelDef,
  RewardDef,
  RunState,
  UnlockableFeature,
} from './types';
import { LEVELS, MAIN_LEVELS, BRANCH_STAR_REQUIREMENT, getLevel, mainIndexOf } from './data/levels';
import { BIOMES, getBiome } from './data/biomes';
import { MECHANICS } from './data/mechanics';
import { FIGHTERS, FIGHTER_LEVEL_COSTS, STARTING_FIGHTERS, getFighter, getLevelUpCost } from './data/fighters';
import {
  MAX_WEAPON_UPGRADE_TIER,
  UPGRADES,
  getUnlockedUpgrades,
  getUpgrade,
  getWeaponUpgradeCosts,
} from './data/upgrades';
import { ARCANA } from './data/arcana';
import { BOUNTIES, BOUNTY_UNLOCK_LEVEL_ID } from './data/bounties';
import { EVOLUTION_RECIPES } from './data/evolutions';

export const createDefaultBountyStats = (): BountyStats => ({
  totalSets: 0,
  rainbowSets: 0,
  purityChains: 0,
  threeStepPurities: 0,
  flawlessTimedWins: 0,
  maxOverkill: 0,
  evolutionsForged: 0,
  destructiveFights: 0,
  fighterWins: {},
});

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
  bountyStats: createDefaultBountyStats(),
  unlockedEvolutions: [],
  discoveredEvolutions: [],
  upgrades: {},
  weaponUpgrades: {},
  coinsUnlocked: false,
  workshopUnlocked: false,
  seenMechanics: [],
  seenCoachMarks: [],
  selectedFighter: 'Orange Tabby',
  lastLevelId: null,
  musicOn: true,
});

// ─── Stars & unlocks ────────────────────────────────────────────────────────

export const totalStars = (save: AdventureSave): number =>
  Object.values(save.stars).reduce((a, b) => a + b, 0);

export const maxStars = (): number => LEVELS.length * 3;

export const isBiomeOpen = (save: AdventureSave, biomeId: LevelDef['biome']): boolean =>
  totalStars(save) >= getBiome(biomeId).starGate;

export type LockReason =
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

/** Features accumulate: every `feature` mechanic introduced at or before this level is on, plus save unlocks. */
export const getFeaturesForLevel = (level: LevelDef, save?: AdventureSave): Set<FeatureFlag> => {
  const set = new Set<FeatureFlag>();
  const pos = mainIndexOf(level);
  for (let i = 0; i <= pos; i++) {
    const m = MECHANICS[MAIN_LEVELS[i].introduces];
    if (m?.enables) set.add(m.enables);
  }
  // Fighter gear, ability and charm are on everywhere except bare levels (1-1)
  if (!level.rules.noGear) set.add('gear');

  // Coin Drops unlock on 1-1 ★: off during first-time 1-1, on everywhere once unlocked
  if (level.rules.noGear) {
    if (save?.coinsUnlocked) set.add('coins');
  } else if (save?.coinsUnlocked || !save || pos >= mainIndexOf(getLevel('1-6'))) {
    set.add('coins');
  }

  // Hidden Evolution Catalysts & Weapon Combos switch on once the player unlocks their first Combo recipe
  if (!level.rules.noGear && (save ? save.unlockedEvolutions.length > 0 : pos >= mainIndexOf(getLevel('2-1')))) {
    set.add('evolutions');
  }
  return set;
};

// ─── Applying results ───────────────────────────────────────────────────────

export interface GrantedReward {
  star: number;
  reward: RewardDef;
}

/** One thing to reveal with fanfare after a level. `star === 0` indicates a Bounty reward. */
export type Unlock =
  | { kind: 'fighter'; name: CharacterName; star: number }
  | { kind: 'weapon'; id: string; star: number; firstWeapon: boolean }
  | { kind: 'arcana'; id: ArcanaId; star: number }
  | { kind: 'evolution'; id: string; star: number; firstEvolution: boolean }
  | { kind: 'feature'; feature: UnlockableFeature; star: number }
  | { kind: 'bounty_board'; star: number };

export interface ResultApplication {
  save: AdventureSave;
  granted: GrantedReward[];
  newStars: number;
  previousStars: number;
  /** Coins dropped during the fight */
  coinsBanked: number;
  /** Coins from newly earned stars */
  starCoins: number;
  /** Bonus coins from newly completed cross-run bounties */
  bountyCoins: number;
  completedBounties: BountyDef[];
  unlocks: Unlock[];
  newlyUnlockedLevels: string[];
  newlyOpenedBiomes: string[];
}

const grant = (save: AdventureSave, reward: RewardDef): AdventureSave => {
  const next = { ...save };
  if (reward.coins) {
    next.coins += reward.coins;
    next.lifetimeCoins += reward.coins;
  }
  if (reward.unlockFeature === 'coins') {
    next.coinsUnlocked = true;
  }
  if (reward.unlockFeature === 'workshop') {
    next.workshopUnlocked = true;
  }
  if (reward.weapons) {
    const merged = [...new Set([...next.armory, ...reward.weapons])];
    if (merged.length !== next.armory.length) next.armory = merged;
    // The first weapon you ever unlock is equipped straight away
    if (!next.charm && next.armory.length > 0) next.charm = reward.weapons[0];
  }
  if (reward.character && !next.unlockedFighters.includes(reward.character)) {
    next.unlockedFighters = [...next.unlockedFighters, reward.character];
    next.fighterLevels = { ...next.fighterLevels, [reward.character]: 1 };
  }
  if (reward.arcana && !next.unlockedArcana.includes(reward.arcana)) {
    next.unlockedArcana = [...next.unlockedArcana, reward.arcana];
  }
  if (reward.evolution && !next.unlockedEvolutions.includes(reward.evolution)) {
    next.unlockedEvolutions = [...next.unlockedEvolutions, reward.evolution];
  }
  return next;
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
    lastLevelId: level.id,
  };
  if (run) {
    next = recordRunBountyStats(next, level, stars, run);
  }
  const granted: GrantedReward[] = [];
  const unlocks: Unlock[] = [];
  let starCoins = 0;
  for (let s = previousStars + 1; s <= stars; s++) {
    const reward = s === 1 ? level.rewards.star1 : s === 2 ? level.rewards.star2 : level.rewards.star3;
    if (reward.unlockFeature === 'coins' && !next.coinsUnlocked) {
      unlocks.push({ kind: 'feature', feature: 'coins', star: s });
    }
    if (reward.unlockFeature === 'workshop' && !next.workshopUnlocked) {
      unlocks.push({ kind: 'feature', feature: 'workshop', star: s });
    }
    if (reward.character && !next.unlockedFighters.includes(reward.character)) {
      unlocks.push({ kind: 'fighter', name: reward.character, star: s });
    }
    for (const id of reward.weapons ?? []) {
      if (!next.armory.includes(id)) {
        unlocks.push({ kind: 'weapon', id, star: s, firstWeapon: next.armory.length === 0 && !unlocks.some(u => u.kind === 'weapon') });
      }
    }
    if (reward.arcana && !next.unlockedArcana.includes(reward.arcana)) {
      unlocks.push({ kind: 'arcana', id: reward.arcana, star: s });
    }
    if (reward.evolution && !next.unlockedEvolutions.includes(reward.evolution)) {
      unlocks.push({
        kind: 'evolution',
        id: reward.evolution,
        star: s,
        firstEvolution: next.unlockedEvolutions.length === 0 && !unlocks.some(u => u.kind === 'evolution'),
      });
    }
    starCoins += reward.coins;
    next = grant(next, reward);
    granted.push({ star: s, reward });
  }
  next.stars = { ...next.stars, [level.id]: Math.max(previousStars, stars) };

  // Unlock the Cross-Run Bounty Board upon clearing 1-8 (Meadow Boss ★+)
  if (!before.bountiesUnlocked && (next.stars[BOUNTY_UNLOCK_LEVEL_ID] ?? 0) >= 1) {
    next = { ...next, bountiesUnlocked: true };
    unlocks.push({ kind: 'bounty_board', star: 1 });
  }

  // Evaluate newly completed bounties once the Bounty Board is open
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
          next = { ...next, completedBounties: [...next.completedBounties, b.id] };
          for (const id of b.reward.weapons ?? []) {
            if (!next.armory.includes(id)) {
              unlocks.push({ kind: 'weapon', id, star: 0, firstWeapon: next.armory.length === 0 && !unlocks.some(u => u.kind === 'weapon') });
            }
          }
          if (b.reward.arcana && !next.unlockedArcana.includes(b.reward.arcana)) {
            unlocks.push({ kind: 'arcana', id: b.reward.arcana, star: 0 });
          }
          if (b.reward.evolution && !next.unlockedEvolutions.includes(b.reward.evolution)) {
            unlocks.push({
              kind: 'evolution',
              id: b.reward.evolution,
              star: 0,
              firstEvolution: next.unlockedEvolutions.length === 0 && !unlocks.some(u => u.kind === 'evolution'),
            });
          }
          bountyCoins += b.reward.coins;
          next = grant(next, b.reward);
        }
      }
    }
  }

  const newlyUnlockedLevels = LEVELS.filter(l => !isLevelUnlocked(before, l) && isLevelUnlocked(next, l)).map(l => l.id);
  const newlyOpenedBiomes = BIOMES.filter(b => b.starGate > 0 && !isBiomeOpen(before, b.id) && isBiomeOpen(next, b.id)).map(b => b.id);

  return {
    save: next,
    granted,
    newStars: stars,
    previousStars,
    coinsBanked: runCoins,
    starCoins,
    bountyCoins,
    completedBounties,
    unlocks,
    newlyUnlockedLevels,
    newlyOpenedBiomes,
  };
};

/**
 * Bring an older save in line with the current level table: anything a level's
 * already-earned stars now unlock (a fighter, weapon, Arcana, Combo recipe or
 * campaign feature that moved there in an update) is granted. Coins are never paid twice.
 */
export const reconcileUnlocks = (save: AdventureSave): AdventureSave => {
  let next = save;
  for (const level of LEVELS) {
    const stars = save.stars[level.id] ?? 0;
    const rewards = [level.rewards.star1, level.rewards.star2, level.rewards.star3];
    for (let s = 0; s < stars; s++) next = grant(next, { ...rewards[s], coins: 0 });
  }
  if (!next.coinsUnlocked && (next.lifetimeCoins > 0 || (next.stars['1-6'] ?? 0) >= 1)) {
    next = { ...next, coinsUnlocked: true };
  }
  if (!next.workshopUnlocked && (Object.keys(next.upgrades).length > 0 || Object.keys(next.weaponUpgrades).length > 0)) {
    next = { ...next, workshopUnlocked: true };
  }
  if (!next.bountiesUnlocked && (next.stars[BOUNTY_UNLOCK_LEVEL_ID] ?? 0) >= 1) {
    next = { ...next, bountiesUnlocked: true };
  }
  for (const id of next.completedBounties) {
    const b = BOUNTIES.find(x => x.id === id);
    if (b) next = grant(next, { ...b.reward, coins: 0 });
  }
  if (next.charm && !next.armory.includes(next.charm)) next = { ...next, charm: next.armory[0] ?? null };
  if (next.activeArcana && !next.unlockedArcana.includes(next.activeArcana)) next = { ...next, activeArcana: null };
  return next;
};

// ─── Camp purchases, Workshop gating & 100% Free Respec Refunds ─────────────

export const fighterLevel = (save: AdventureSave, name: string): number => save.fighterLevels[name] ?? 1;

export const canLevelFighter = (save: AdventureSave, name: CharacterName): boolean => {
  const cost = getLevelUpCost(fighterLevel(save, name));
  return cost !== null && save.unlockedFighters.includes(name) && save.coins >= cost;
};

export const levelFighter = (save: AdventureSave, name: CharacterName): AdventureSave => {
  if (!canLevelFighter(save, name)) return save;
  const lvl = fighterLevel(save, name);
  const cost = getLevelUpCost(lvl)!;
  const newLevel = lvl + 1;
  getFighter(name); // validate
  return {
    ...save,
    coins: save.coins - cost,
    fighterLevels: { ...save.fighterLevels, [name]: newLevel },
  };
};

/** Total coins invested in levelling a fighter past level 1. */
export const fighterSpentCoins = (save: AdventureSave, name: CharacterName): number => {
  const lvl = fighterLevel(save, name);
  return FIGHTER_LEVEL_COSTS.slice(0, Math.max(0, lvl - 1)).reduce((a, b) => a + b, 0);
};

/** Refund 100% of coins spent on a fighter, resetting them to level 1. */
export const refundFighter = (save: AdventureSave, name: CharacterName): AdventureSave => {
  const refund = fighterSpentCoins(save, name);
  if (refund <= 0) return save;
  return {
    ...save,
    coins: save.coins + refund,
    fighterLevels: { ...save.fighterLevels, [name]: 1 },
  };
};

export const isUpgradeUnlocked = (save: AdventureSave, id: string): boolean =>
  getUpgrade(id).isUnlocked(save);

export { getUnlockedUpgrades };

export const upgradeTier = (save: AdventureSave, id: string): number => save.upgrades[id] ?? 0;

export const upgradeCost = (save: AdventureSave, id: string): number | null => {
  const u = getUpgrade(id);
  const tier = upgradeTier(save, id);
  return tier >= u.costs.length ? null : u.costs[tier];
};

export const canBuyUpgrade = (save: AdventureSave, id: string): boolean => {
  if (!save.workshopUnlocked || !isUpgradeUnlocked(save, id)) return false;
  const cost = upgradeCost(save, id);
  return cost !== null && save.coins >= cost;
};

export const buyUpgrade = (save: AdventureSave, id: string): AdventureSave => {
  if (!canBuyUpgrade(save, id)) return save;
  const cost = upgradeCost(save, id)!;
  return { ...save, coins: save.coins - cost, upgrades: { ...save.upgrades, [id]: upgradeTier(save, id) + 1 } };
};

/** Total coins invested in a Workshop mechanic upgrade across all bought tiers. */
export const upgradeSpentCoins = (save: AdventureSave, id: string): number => {
  const u = getUpgrade(id);
  const tier = upgradeTier(save, id);
  return u.costs.slice(0, Math.max(0, tier)).reduce((a, b) => a + b, 0);
};

/** Refund 100% of coins spent on a Workshop mechanic upgrade, resetting it to tier 0. */
export const refundUpgrade = (save: AdventureSave, id: string): AdventureSave => {
  const refund = upgradeSpentCoins(save, id);
  if (refund <= 0) return save;
  const nextUpgrades = { ...save.upgrades };
  delete nextUpgrades[id];
  return {
    ...save,
    coins: save.coins + refund,
    upgrades: nextUpgrades,
  };
};

// ─── Armory Weapon Upgrades (Workshop) ──────────────────────────────────────

export const weaponUpgradeTier = (save: AdventureSave, weaponId: string): number =>
  save.weaponUpgrades[weaponId] ?? 0;

export const weaponUpgradeCost = (save: AdventureSave, weaponId: string): number | null => {
  const w = WEAPONS.find(x => x.id === weaponId);
  if (!w) return null;
  const tier = weaponUpgradeTier(save, weaponId);
  if (tier >= MAX_WEAPON_UPGRADE_TIER) return null;
  return getWeaponUpgradeCosts(w.rarity)[tier];
};

export const canUpgradeWeapon = (save: AdventureSave, weaponId: string): boolean => {
  if (!save.workshopUnlocked || !save.armory.includes(weaponId)) return false;
  const cost = weaponUpgradeCost(save, weaponId);
  return cost !== null && save.coins >= cost;
};

export const buyWeaponUpgrade = (save: AdventureSave, weaponId: string): AdventureSave => {
  if (!canUpgradeWeapon(save, weaponId)) return save;
  const cost = weaponUpgradeCost(save, weaponId)!;
  const nextTier = weaponUpgradeTier(save, weaponId) + 1;
  return {
    ...save,
    coins: save.coins - cost,
    weaponUpgrades: { ...save.weaponUpgrades, [weaponId]: nextTier },
  };
};

/** Total coins invested in upgrading an Armory weapon across all bought tiers. */
export const weaponUpgradeSpentCoins = (save: AdventureSave, weaponId: string): number => {
  const w = WEAPONS.find(x => x.id === weaponId);
  if (!w) return 0;
  const tier = weaponUpgradeTier(save, weaponId);
  return getWeaponUpgradeCosts(w.rarity).slice(0, Math.max(0, tier)).reduce((a, b) => a + b, 0);
};

/** Refund 100% of coins spent on an Armory weapon upgrade, resetting it to tier 0. */
export const refundWeaponUpgrade = (save: AdventureSave, weaponId: string): AdventureSave => {
  const refund = weaponUpgradeSpentCoins(save, weaponId);
  if (refund <= 0) return save;
  const nextWeaponUpgrades = { ...save.weaponUpgrades };
  delete nextWeaponUpgrades[weaponId];
  return {
    ...save,
    coins: save.coins + refund,
    weaponUpgrades: nextWeaponUpgrades,
  };
};

/** Total coins currently refundable across all fighters, mechanic upgrades, and weapon upgrades. */
export const refundableCoins = (save: AdventureSave): number => {
  let total = 0;
  for (const f of FIGHTERS) total += fighterSpentCoins(save, f.name);
  for (const u of UPGRADES) total += upgradeSpentCoins(save, u.id);
  for (const weaponId of Object.keys(save.weaponUpgrades)) total += weaponUpgradeSpentCoins(save, weaponId);
  return total;
};

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

export const markMechanicSeen = (save: AdventureSave, id: string): AdventureSave =>
  save.seenMechanics.includes(id) ? save : { ...save, seenMechanics: [...save.seenMechanics, id] };

export const markCoachMarkSeen = (save: AdventureSave, id: string): AdventureSave =>
  save.seenCoachMarks.includes(id) ? save : { ...save, seenCoachMarks: [...save.seenCoachMarks, id] };

export const allUpgrades = UPGRADES;

/** Dev helper: unlock everything. */
export const createMaxedSave = (): AdventureSave => {
  const base = createNewSave();
  const stars: Record<string, number> = {};
  LEVELS.forEach(l => (stars[l.id] = 3));
  const seenMechanics = Object.keys(MECHANICS);
  const seenCoachMarks = [...seenMechanics, ...seenMechanics.map(id => `start_${id}`)];
  const plays = Object.fromEntries(LEVELS.map(l => [l.id, 1]));
  let save: AdventureSave = {
    ...base,
    stars,
    plays,
    seenMechanics,
    seenCoachMarks,
    coins: 50000,
    coinsUnlocked: true,
    workshopUnlocked: true,
    unlockedArcana: ARCANA.map(a => a.id),
    bountiesUnlocked: true,
    unlockedEvolutions: EVOLUTION_RECIPES.map(r => r.id),
    discoveredEvolutions: EVOLUTION_RECIPES.map(r => r.id),
  };
  for (const l of LEVELS) {
    for (const r of [l.rewards.star1, l.rewards.star2, l.rewards.star3]) save = grant(save, r);
  }
  for (const b of BOUNTIES) save = grant(save, { ...b.reward, coins: 0 });
  return save;
};
