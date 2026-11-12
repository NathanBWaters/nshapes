/**
 * What the player brings into a level, derived from the level and the save.
 * The engine starts a run from this and the preview screen shows it.
 */
import type { PlayerStats, Weapon } from '@/types';
import { DEFAULT_PLAYER_STATS } from '@/utils/gameDefinitions';
import type { AdventureSave, ArcanaId, FeatureFlag, LevelDef } from './types';
import { MAIN_LEVELS, getLevel, mainIndexOf } from './data/levels';
import { MECHANICS } from './data/mechanics';
import { getLoadout, getPerkStats } from './data/fighters';
import { UPGRADES } from './data/upgrades';
import { arcanaRules } from './data/arcana';
import { getArmoryWeapon } from './data/armory';

export const fighterLevel = (save: AdventureSave, name: string): number => save.fighterLevels[name] ?? 1;

/** Features accumulate: every `feature` mechanic introduced at or before this level is on, plus save unlocks. */
export const getFeaturesForLevel = (level: LevelDef, save: AdventureSave): Set<FeatureFlag> => {
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
    if (save.coinsUnlocked) set.add('coins');
  } else if (save.coinsUnlocked || pos >= mainIndexOf(getLevel('1-6'))) {
    set.add('coins');
  }

  // Hidden Evolution Catalysts & Weapon Combos switch on once the player unlocks their first Combo recipe
  if (!level.rules.noGear && save.unlockedEvolutions.length > 0) {
    set.add('evolutions');
  }
  return set;
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
  if (weapon.capIncrease && next.effectCaps) {
    const caps = next.effectCaps as unknown as Record<string, number>;
    if (caps[weapon.capIncrease.type] !== undefined) caps[weapon.capIncrease.type] += weapon.capIncrease.amount;
  }
  return next;
};

const addStats = (stats: PlayerStats, delta: Partial<PlayerStats>): PlayerStats => {
  const next = { ...stats };
  for (const [k, v] of Object.entries(delta)) {
    const cur = (next as unknown as Record<string, unknown>)[k];
    if (typeof v === 'number' && typeof cur === 'number') (next as unknown as Record<string, number>)[k] = cur + v;
  }
  return next;
};

/**
 * Everything the selected fighter walks into a level with: which systems are
 * switched on, gear (own kit + charm, with upgrade tiers), baked stats and hearts.
 */
export const startingLoadout = (level: LevelDef, save: AdventureSave) => {
  const fighter = save.selectedFighter;
  const features = getFeaturesForLevel(level, save);
  const activeArcana: ArcanaId | null =
    features.has('gear') && save.activeArcana && save.unlockedArcana.includes(save.activeArcana)
      ? save.activeArcana
      : null;
  const lvl = fighterLevel(save, fighter);
  const weapons: Weapon[] = features.has('gear')
    ? getLoadout(fighter, lvl).map(id => getArmoryWeapon(id, save.weaponUpgrades)).filter((w): w is Weapon => !!w)
    : [];
  // Charm: one equipped Armory weapon on top of the fighter's own gear
  const charm = features.has('gear') && save.charm && save.armory.includes(save.charm)
    ? getArmoryWeapon(save.charm, save.weaponUpgrades)
    : undefined;
  if (charm) weapons.push(charm);
  let stats: PlayerStats = { ...DEFAULT_PLAYER_STATS, hints: 0, graces: 0, effectCaps: { ...DEFAULT_PLAYER_STATS.effectCaps! } };
  for (const w of weapons) stats = applyWeaponToStats(stats, w);
  stats = addStats(stats, getPerkStats(lvl));
  let bonusDamagePerMatch = 0;
  let coinBonusPercent = 0;
  for (const u of UPGRADES) {
    const tier = save.upgrades[u.id] ?? 0;
    if (tier <= 0) continue;
    stats = u.apply(stats, tier, { timed: !!level.rules.timer });
    bonusDamagePerMatch += u.bonusDamage?.(tier) ?? 0;
    coinBonusPercent += u.coinBonusPercent?.(tier) ?? 0;
  }
  // Features gate whole systems: no hints/graces before they're taught
  stats.hints = features.has('hints') ? stats.hints + (level.rules.startingHints ?? 0) : 0;
  stats.maxHints = Math.max(stats.maxHints, stats.hints);
  stats.graces = features.has('graces') ? stats.graces + (level.rules.startingGraces ?? 0) : 0;
  const rules = arcanaRules(activeArcana);
  if (rules.startingGraces !== undefined) stats.graces = rules.startingGraces;
  if (!features.has('graces')) stats.graceGainChance = 0;
  if (!features.has('hints')) stats.hintGainChance = 0;
  stats.maxGraces = Math.max(stats.maxGraces, stats.graces);

  const heartBonus = stats.maxHealth - DEFAULT_PLAYER_STATS.maxHealth;
  let maxHearts = features.has('hearts') ? Math.max(1, level.rules.hearts + heartBonus) : null;
  if (maxHearts !== null && rules.maxHeartsDelta !== undefined) maxHearts = Math.max(1, maxHearts + rules.maxHeartsDelta);
  if (maxHearts !== null && rules.maxHeartsLock !== undefined) maxHearts = rules.maxHeartsLock;
  return { features, activeArcana, weapons, stats, maxHearts, bonusDamagePerMatch, coinBonusPercent };
};
