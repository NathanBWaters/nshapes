/**
 * Pure progression logic: unlock rules, star rewards, purchases.
 * No storage I/O here, so it's easy to test and simulate.
 */
import type { CharacterName } from '@/types';
import type { AdventureSave, FeatureFlag, LevelDef, RewardDef } from './types';
import { LEVELS } from './data/levels';
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
  armory: [...new Set(STARTING_FIGHTERS.flatMap(f => getLoadout(f, 1)))],
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

export type LockReason = { kind: 'previous' } | { kind: 'stars'; need: number; have: number };

/** A level opens when the previous level has ≥1★ and its biome's star gate is met. */
export const getLockReason = (save: AdventureSave, level: LevelDef): LockReason | null => {
  if (level.index > 0) {
    const prev = LEVELS[level.index - 1];
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
  let last = LEVELS[0];
  for (const l of LEVELS) {
    if (!isLevelUnlocked(save, l)) break;
    last = l;
    if ((save.stars[l.id] ?? 0) === 0) return l;
  }
  return last;
};

/** Features accumulate: every `feature` mechanic introduced at or before this level is on. */
export const getFeaturesForLevel = (level: LevelDef): Set<FeatureFlag> => {
  const set = new Set<FeatureFlag>();
  for (const l of LEVELS) {
    if (l.index > level.index) break;
    const m = MECHANICS[l.introduces];
    if (m?.enables) set.add(m.enables);
  }
  return set;
};

// ─── Applying results ───────────────────────────────────────────────────────

export interface GrantedReward {
  star: number;
  reward: RewardDef;
}

export interface ResultApplication {
  save: AdventureSave;
  granted: GrantedReward[];
  newStars: number;
  previousStars: number;
  coinsBanked: number;
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
  }
  if (reward.character && !next.unlockedFighters.includes(reward.character)) {
    next.unlockedFighters = [...next.unlockedFighters, reward.character];
    next.fighterLevels = { ...next.fighterLevels, [reward.character]: 1 };
    next.armory = [...new Set([...next.armory, ...getLoadout(reward.character, 1)])];
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
  for (let s = previousStars + 1; s <= stars; s++) {
    const reward = s === 1 ? level.rewards.star1 : s === 2 ? level.rewards.star2 : level.rewards.star3;
    next = grant(next, reward);
    granted.push({ star: s, reward });
  }
  next.stars = { ...next.stars, [level.id]: Math.max(previousStars, stars) };

  const newlyUnlockedLevels = LEVELS.filter(l => !isLevelUnlocked(before, l) && isLevelUnlocked(next, l)).map(l => l.id);
  const newlyOpenedBiomes = BIOMES.filter(b => b.starGate > 0 && !isBiomeOpen(before, b.id) && isBiomeOpen(next, b.id)).map(b => b.id);

  return { save: next, granted, newStars: stars, previousStars, coinsBanked: runCoins, newlyUnlockedLevels, newlyOpenedBiomes };
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
    // Gear a fighter carries is always available in the Armory too
    armory: [...new Set([...save.armory, ...getLoadout(name, newLevel)])],
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
  let save: AdventureSave = { ...base, stars, coins: 50000 };
  for (const l of LEVELS) {
    for (const r of [l.rewards.star1, l.rewards.star2, l.rewards.star3]) save = grant(save, r);
  }
  return save;
};
