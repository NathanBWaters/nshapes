/**
 * What the player brings into a level, derived from the level and the save.
 * The engine starts a run from this and the preview screen shows it.
 */
import type { PlayerStats, Weapon } from '@/types';
import { DEFAULT_PLAYER_STATS } from '@/utils/gameDefinitions';
import type { AdventureSave, ArcanaId, ArcanaRules, FeatureFlag, LevelDef, PassiveId } from './types';
import type { Modifiers } from './rules/types';
import { MAIN_LEVELS, mainIndexOf } from './data/levels';
import { MECHANICS } from './data/mechanics';
import { getFighter } from './data/fighters';
import { UPGRADES } from './data/upgrades';
import { arcanaRules } from './data/arcana';
import { getArmoryWeapon } from './data/armory';
import { weaponBuilds } from './weaponLevels';
import { WHOLE_STATS } from './data/weaponStats';
import { armedRecipesFor, evolutionLikelihoodFor, getSkillNode, modifiersOf, EVOLUTION_RULES } from './engine/sources';

export const BASE_CHARM_SLOTS = 3;
export const MAX_CHARM_SLOTS = 6;
export const BASE_ARCANA_SLOTS = 1;
export const MAX_ARCANA_SLOTS = 3;

export const charmSlotsOf = (save: AdventureSave): number =>
  Math.min(MAX_CHARM_SLOTS, BASE_CHARM_SLOTS + (save.upgrades.charm_belt ?? 0));

export const arcanaSlotsOf = (save: AdventureSave): number =>
  Math.min(MAX_ARCANA_SLOTS, BASE_ARCANA_SLOTS + (save.upgrades.tarot_deck ?? 0));

/** Equipped charms that come into a fight: owned, unique, within the slots. */
export const fightCharms = (save: AdventureSave): string[] =>
  [...new Set(save.charms ?? [])].filter(id => save.armory.includes(id)).slice(0, charmSlotsOf(save));

/** Equipped Arcana that come into a fight: unlocked, unique, within the slots. */
export const fightArcana = (save: AdventureSave): ArcanaId[] =>
  [...new Set(save.equippedArcana ?? [])].filter(id => save.unlockedArcana.includes(id)).slice(0, arcanaSlotsOf(save));

export const fighterPassives = (fighter: string): [PassiveId, PassiveId] => getFighter(fighter).passives;

/** Owned skill nodes of this fighter that exist in the tree data. */
export const fightSkillNodes = (save: AdventureSave, fighter: string): string[] =>
  (save.skillNodes?.[fighter] ?? []).filter(id => {
    const n = getSkillNode(id);
    return !!n && n.fighter === fighter;
  });

/** Features accumulate: every `feature` mechanic introduced at or before this level is on, plus save unlocks. */
export const getFeaturesForLevel = (level: LevelDef, save: AdventureSave): Set<FeatureFlag> => {
  const set = new Set<FeatureFlag>();
  const pos = mainIndexOf(level);
  for (let i = 0; i <= pos; i++) {
    const m = MECHANICS[MAIN_LEVELS[i].introduces];
    if (m?.enables) set.add(m.enables);
  }
  // Passives, charms and Arcana are on everywhere except bare levels (1-1)
  if (!level.rules.noGear) set.add('gear');

  // Coin Drops are a campaign unlock (data/features.ts): on everywhere once unlocked
  if (save.coinsUnlocked) set.add('coins');
  else if (level.rules.noGear) set.delete('coins');

  // Catalysts & evolutions switch on once the player unlocks their first recipe
  if (!level.rules.noGear && save.unlockedEvolutions.length > 0) set.add('evolutions');
  return set;
};

/**
 * Whole-number stats (hearts, graces, board cards...) can be fractional after
 * Workshop tuning. Round each down, plus one more with the fraction as the
 * chance: `rand` is the fight's RNG. Without `rand` (previews) they round down.
 */
export const resolveWholeStats = <T extends Partial<PlayerStats>>(stats: T, rand?: () => number): T => {
  let next = stats;
  for (const k of WHOLE_STATS) {
    const v = stats[k];
    if (typeof v !== 'number' || Number.isInteger(v)) continue;
    if (next === stats) next = { ...stats };
    const frac = v - Math.floor(v);
    (next as unknown as Record<string, number>)[k] = Math.floor(v) + (rand && rand() < frac ? 1 : 0);
  }
  return next;
};

/** Add a weapon's effects into baked stats (mirrors calculatePlayerTotalStats). */
export const applyWeaponToStats = (stats: PlayerStats, weapon: Weapon): PlayerStats => {
  const next: PlayerStats = { ...stats, effectCaps: stats.effectCaps ? { ...stats.effectCaps } : undefined };
  for (const [k, v] of Object.entries(weapon.effects)) {
    const cur = (next as unknown as Record<string, unknown>)[k];
    if (typeof v === 'number' && typeof cur === 'number') {
      (next as unknown as Record<string, number>)[k] = cur + v;
    }
  }
  return next;
};

export interface Loadout {
  features: Set<FeatureFlag>;
  passives: PassiveId[];
  skillNodes: string[];
  weapons: Weapon[];
  arcana: ArcanaId[];
  arcanaRules: ArcanaRules;
  /** Standing modifiers from skill nodes and charms (evolutions add theirs in the fight) */
  modifiers: Modifiers;
  stats: PlayerStats;
  maxHearts: number | null;
  /** Seconds on the clock (null = untimed) */
  timer: number | null;
  bonusDamagePerMatch: number;
  coinBonusPercent: number;
  charmSlots: number;
  arcanaSlots: number;
  armedRecipes: string[];
  /** % Catalyst chance per refill */
  evolutionLikelihood: number;
  evolutionCap: number;
  evolutionLabTier: number;
}

/**
 * Everything the selected fighter walks into a level with: which systems are
 * on, passives and skill nodes, equipped charms (at their upgrade tiers),
 * combined Arcana, baked stats, hearts and clock.
 */
export const startingLoadout = (
  level: LevelDef,
  save: AdventureSave,
  features: Set<FeatureFlag> = getFeaturesForLevel(level, save),
  /** The fight's RNG, for rounding tuned whole-number stats by chance (resolveWholeStats) */
  rand?: () => number
): Loadout => {
  const fighter = save.selectedFighter;
  const gear = features.has('gear');
  const passives = gear ? [...fighterPassives(fighter)] : [];
  const skillNodes = gear ? fightSkillNodes(save, fighter) : [];
  const arcana = gear ? fightArcana(save) : [];
  const rules = arcanaRules(arcana);
  const weapons: Weapon[] = gear
    ? fightCharms(save).map(id => getArmoryWeapon(id, weaponBuilds(save))).filter((w): w is Weapon => !!w)
    : [];
  const modifiers = modifiersOf({ skillNodes, weapons, activeEvolutions: [] });

  // Time gains are exactly the seconds the weapons say (Free Play adds them to a 10s base)
  let stats: PlayerStats = { ...DEFAULT_PLAYER_STATS, hints: 0, graces: 0, timeGainAmount: 0, effectCaps: { ...DEFAULT_PLAYER_STATS.effectCaps! } };
  for (const w of weapons) stats = applyWeaponToStats(stats, w);
  stats = resolveWholeStats(stats, rand);
  let bonusDamagePerMatch = 0;
  let coinBonusPercent = modifiers.coinPercent ?? 0;
  for (const u of UPGRADES) {
    const tier = save.upgrades[u.id] ?? 0;
    if (tier <= 0) continue;
    stats = u.apply(stats, tier, { timed: !!level.rules.timer });
    bonusDamagePerMatch += u.bonusDamage?.(tier) ?? 0;
    coinBonusPercent += u.coinBonusPercent?.(tier) ?? 0;
  }
  // Features gate whole systems: no hints/graces before they're taught
  stats.hints = features.has('hints') ? stats.hints + (level.rules.startingHints ?? 0) + (modifiers.startingHints ?? 0) : 0;
  stats.maxHints = Math.max(stats.maxHints, stats.hints);
  stats.graces = features.has('graces') ? stats.graces + (level.rules.startingGraces ?? 0) + (modifiers.startingGraces ?? 0) : 0;
  if (rules.startingGraces !== undefined) stats.graces = rules.startingGraces;
  if (!features.has('graces')) stats.graceGainChance = 0;
  if (!features.has('hints')) stats.hintGainChance = 0;
  stats.maxGraces = Math.max(stats.maxGraces, stats.graces);

  const heartBonus = stats.maxHealth - DEFAULT_PLAYER_STATS.maxHealth + (modifiers.maxHearts ?? 0);
  let maxHearts = features.has('hearts') ? Math.max(1, level.rules.hearts + heartBonus) : null;
  if (maxHearts !== null && rules.maxHeartsDelta !== undefined) maxHearts = Math.max(1, maxHearts + rules.maxHeartsDelta);
  if (maxHearts !== null && rules.maxHeartsLock !== undefined) maxHearts = rules.maxHeartsLock;

  const timer = level.rules.timer ? level.rules.timer + stats.startingTime + (modifiers.startingSeconds ?? 0) : null;
  const evolutionLabTier = save.upgrades.evolution_lab ?? 0;
  const evolutions = features.has('evolutions');
  const likelihood = evolutionLikelihoodFor(evolutionLabTier, modifiers, rules.catalystChanceScale ?? 1) + (level.rules.evolutionLikelihood ?? 0);

  return {
    features,
    passives,
    skillNodes,
    weapons,
    arcana,
    arcanaRules: rules,
    modifiers,
    stats,
    maxHearts,
    timer,
    bonusDamagePerMatch,
    coinBonusPercent,
    charmSlots: charmSlotsOf(save),
    arcanaSlots: arcanaSlotsOf(save),
    armedRecipes: evolutions ? armedRecipesFor(weapons, save.unlockedEvolutions) : [],
    evolutionLikelihood: evolutions ? likelihood : 0,
    evolutionCap: EVOLUTION_RULES.perFight + (modifiers.extraEvolutionsPerFight ?? 0),
    evolutionLabTier,
  };
};
