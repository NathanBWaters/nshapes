/**
 * Pure progression logic: unlock rules, star rewards, purchases.
 * No storage I/O here, so it's easy to test and simulate.
 */
import type { CharacterName } from '@/types';
import type { AdventureSave, FeatureFlag, LevelDef, RewardDef } from './types';
import { LEVELS, MAIN_LEVELS, BRANCH_STAR_REQUIREMENT, getLevel, mainIndexOf } from './data/levels';
import { BIOMES, getBiome } from './data/biomes';
import { MECHANICS } from './data/mechanics';
import { STARTING_FIGHTERS, getFighter, getLevelUpCost, getLoadout } from './data/fighters';
import { UPGRADES, getUpgrade } from './data/upgrades';

export const createNewSave = (): AdventureSave => ({
  version: 1,
  coins: 0,
  lifetimeCoins: 0,
  stars: {},
  plays: {},
  fighterLevels: { 'Orange Tabby': 1 },
  unlockedFighters: [...STARTING_FIGHTERS],
  // Only weapons won from star rewards. Fighter gear is separate.
  armory: [],
  charm: null,
  upgrades: {},
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

/** Features accumulate: every `feature` mechanic introduced at or before this level is on. */
export const getFeaturesForLevel = (level: LevelDef): Set<FeatureFlag> => {
  const set = new Set<FeatureFlag>();
  const pos = mainIndexOf(level);
  for (let i = 0; i <= pos; i++) {
    const m = MECHANICS[MAIN_LEVELS[i].introduces];
    if (m?.enables) set.add(m.enables);
  }
  // Fighter gear, ability and charm are on everywhere except bare levels (1-1)
  if (!level.rules.noGear) set.add('gear');
  return set;
};

// ─── Applying results ───────────────────────────────────────────────────────

export interface GrantedReward {
  star: number;
  reward: RewardDef;
}

/** One thing to reveal with fanfare after a level. */
export type Unlock =
  | { kind: 'fighter'; name: CharacterName; star: number }
  | { kind: 'weapon'; id: string; star: number; firstWeapon: boolean };

export interface ResultApplication {
  save: AdventureSave;
  granted: GrantedReward[];
  newStars: number;
  previousStars: number;
  /** Coins dropped during the fight */
  coinsBanked: number;
  /** Coins from newly earned stars */
  starCoins: number;
  unlocks: Unlock[];
  newlyUnlockedLevels: string[];
  newlyOpenedBiomes: string[];
}

const grant = (save: AdventureSave, reward: RewardDef): AdventureSave => {
  let next = { ...save };
  if (reward.coins) {
    next.coins += reward.coins;
    next.lifetimeCoins += reward.coins;
  }
  if (reward.weapons) {
    next.armory = [...new Set([...next.armory, ...reward.weapons])];
    // The first weapon you ever unlock is equipped straight away
    if (!next.charm) next.charm = reward.weapons[0];
  }
  if (reward.character && !next.unlockedFighters.includes(reward.character)) {
    next.unlockedFighters = [...next.unlockedFighters, reward.character];
    next.fighterLevels = { ...next.fighterLevels, [reward.character]: 1 };
  }
  return next;
};

/** Bank run coins + grant first-time star rewards (each star's reward is granted once). */
export const applyLevelResult = (
  save: AdventureSave,
  level: LevelDef,
  stars: number,
  runCoins: number
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
  const granted: GrantedReward[] = [];
  const unlocks: Unlock[] = [];
  let starCoins = 0;
  for (let s = previousStars + 1; s <= stars; s++) {
    const reward = s === 1 ? level.rewards.star1 : s === 2 ? level.rewards.star2 : level.rewards.star3;
    if (reward.character && !next.unlockedFighters.includes(reward.character)) unlocks.push({ kind: 'fighter', name: reward.character, star: s });
    for (const id of reward.weapons ?? []) {
      if (!next.armory.includes(id)) unlocks.push({ kind: 'weapon', id, star: s, firstWeapon: next.armory.length === 0 && !unlocks.some(u => u.kind === 'weapon') });
    }
    starCoins += reward.coins;
    next = grant(next, reward);
    granted.push({ star: s, reward });
  }
  next.stars = { ...next.stars, [level.id]: Math.max(previousStars, stars) };

  const newlyUnlockedLevels = LEVELS.filter(l => !isLevelUnlocked(before, l) && isLevelUnlocked(next, l)).map(l => l.id);
  const newlyOpenedBiomes = BIOMES.filter(b => b.starGate > 0 && !isBiomeOpen(before, b.id) && isBiomeOpen(next, b.id)).map(b => b.id);

  return { save: next, granted, newStars: stars, previousStars, coinsBanked: runCoins, starCoins, unlocks, newlyUnlockedLevels, newlyOpenedBiomes };
};

// ─── Camp purchases ─────────────────────────────────────────────────────────

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

export const upgradeTier = (save: AdventureSave, id: string): number => save.upgrades[id] ?? 0;

export const upgradeCost = (save: AdventureSave, id: string): number | null => {
  const u = getUpgrade(id);
  const tier = upgradeTier(save, id);
  return tier >= u.costs.length ? null : u.costs[tier];
};

export const buyUpgrade = (save: AdventureSave, id: string): AdventureSave => {
  const cost = upgradeCost(save, id);
  if (cost === null || save.coins < cost) return save;
  return { ...save, coins: save.coins - cost, upgrades: { ...save.upgrades, [id]: upgradeTier(save, id) + 1 } };
};

export const equipCharm = (save: AdventureSave, weaponId: string | null): AdventureSave =>
  weaponId === null || save.armory.includes(weaponId) ? { ...save, charm: weaponId } : save;

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
  let save: AdventureSave = { ...base, stars, plays, seenMechanics, seenCoachMarks, coins: 50000 };
  for (const l of LEVELS) {
    for (const r of [l.rewards.star1, l.rewards.star2, l.rewards.star3]) save = grant(save, r);
  }
  return save;
};
