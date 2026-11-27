/**
 * What the player brings into a level, derived from the level and the save.
 * The engine starts a run from this and the preview/Armory screens share the
 * slot math, Synergy-Graph auto-builder, and Armory filter/sort pipeline here.
 */
import type { PlayerStats, Weapon } from '@/types';
import { DEFAULT_PLAYER_STATS } from '@/utils/gameDefinitions';
import type {
  AdventureSave,
  ArcanaId,
  ArcanaRules,
  FeatureFlag,
  LevelDef,
  PassiveId,
  SynergyAttrId,
} from './types';
import type { Modifiers } from './rules/types';
import { MAIN_LEVELS, mainIndexOf } from './data/levels';
import { MECHANICS } from './data/mechanics';
import { getFighter } from './data/fighters';
import { foeDisplay } from './data/foes';
import { UPGRADES } from './data/upgrades';
import { arcanaRules } from './data/arcana';
import { UNDERSTUDY_ID } from './data/adventureWeapons';
import { charmWeapons, getArmoryWeapon } from './data/armory';
import { SYNERGY_ATTR_META, beltSynergyOverlap, weaponSynergyAttrs } from './data/synergy';
import { weaponRole, type WeaponRole } from './data/weaponRoles';
import { weaponBuilds, weaponLevel } from './weaponLevels';
import { WHOLE_STATS } from './data/weaponStats';
import { getSkillNode, modifiersOf } from './engine/sources';

export const BASE_CHARM_SLOTS = 3;
export const MAX_CHARM_SLOTS = 6;
export const SLOT_4_UNLOCK_LEVEL = '1-10';
export const SLOT_5_UNLOCK_LEVEL = '2-10';
export const BASE_ARCANA_SLOTS = 1;
export const MAX_ARCANA_SLOTS = 3;

/** Extra weapon belt slots earned from clearing World 1 Boss (1-10 -> 4th) and World 2 Boss (2-10 -> 5th). */
export const bossUnlockedCharmSlots = (save: Pick<AdventureSave, 'stars'>): number =>
  ((save.stars[SLOT_4_UNLOCK_LEVEL] ?? 0) >= 1 ? 1 : 0) +
  ((save.stars[SLOT_5_UNLOCK_LEVEL] ?? 0) >= 1 ? 1 : 0);

/**
 * Total equipped weapon belt slots:
 *   3 base + W1 Boss (1-10 -> 4th) + W2 Boss (2-10 -> 5th) + 1 optional Workshop Charm Belt (6th).
 */
export const charmSlotsOf = (save: Pick<AdventureSave, 'stars' | 'upgrades'>): number => {
  const bossSlots = bossUnlockedCharmSlots(save);
  const workshopBelt = Math.min(1, Math.max(0, Math.floor(save.upgrades?.charm_belt ?? 0)));
  return Math.min(MAX_CHARM_SLOTS, BASE_CHARM_SLOTS + bossSlots + workshopBelt);
};

export const arcanaSlotsOf = (save: Pick<AdventureSave, 'upgrades'>): number =>
  Math.min(MAX_ARCANA_SLOTS, BASE_ARCANA_SLOTS + (save.upgrades?.tarot_deck ?? 0));

/** Equipped charms that come into a fight: owned, unique, within the slots (or uncapped in Spire). */
export const fightCharms = (save: AdventureSave, uncapped = false): string[] => {
  const unique = [...new Set(save.charms ?? [])].filter(id => save.armory.includes(id));
  return uncapped ? unique : unique.slice(0, charmSlotsOf(save));
};

/** Equipped Arcana that come into a fight: unlocked, unique, within the slots (or uncapped in Spire). */
export const fightArcana = (save: AdventureSave, uncapped = false): ArcanaId[] => {
  const unique = [...new Set(save.equippedArcana ?? [])].filter(id => save.unlockedArcana.includes(id));
  return uncapped ? unique : unique.slice(0, arcanaSlotsOf(save));
};

export const fighterPassives = (fighter: string): [PassiveId, PassiveId] => getFighter(fighter).passives;

/** Owned skill nodes of this fighter that exist in the tree data. */
export const fightSkillNodes = (save: AdventureSave, fighter: string): string[] =>
  (save.skillNodes?.[fighter] ?? []).filter(id => {
    const n = getSkillNode(id);
    return !!n && n.fighter === fighter;
  });

/**
 * Features accumulate: every `feature` mechanic introduced at or before this level is on, plus save unlocks.
 * A practice fight has everything the player has learned so far, wherever it sits on the map.
 */
export const getFeaturesForLevel = (level: LevelDef, save: AdventureSave): Set<FeatureFlag> => {
  const set = new Set<FeatureFlag>();
  const pos = mainIndexOf(level);
  const learned = (l: LevelDef) => save.seenMechanics.includes(l.introduces) || (save.stars[l.id] ?? 0) >= 1;
  MAIN_LEVELS.forEach((l, i) => {
    if (i > pos && !(level.rules.sandbox && learned(l))) return;
    const m = MECHANICS[l.introduces];
    if (m?.enables) set.add(m.enables);
  });
  // Passives, charms and Arcana are on everywhere except bare levels (1-1)
  if (!level.rules.noGear) set.add('gear');

  // Coin Drops are a campaign unlock (data/features.ts): on everywhere once unlocked
  if (save.coinsUnlocked) set.add('coins');
  else if (level.rules.noGear) set.delete('coins');

  // Per-weapon timed evolutions switch on once the player has any unlocked evolution (or cleared 1-10)
  const hasUnlockedEvos =
    (save.unlockedWeaponEvolutions?.length ?? 0) > 0 ||
    (save.stars[SLOT_4_UNLOCK_LEVEL] ?? 0) >= 1;
  if (!level.rules.noGear && hasUnlockedEvos) set.add('evolutions');
  return set;
};

/**
 * Whole-number stats (hearts, graces, board cards, hints, links) now use clean
 * integer Lv 1-5 breakpoints and whole-unit Workshop tiers ([GP-19]). This
 * helper guarantees clean integer values deterministically with zero random
 * fight-start rounding (`_rand` is retained for call-site compatibility).
 */
export const resolveWholeStats = <T extends Partial<PlayerStats>>(stats: T, _rand?: () => number): T => {
  let next = stats;
  for (const k of WHOLE_STATS) {
    const v = stats[k];
    if (typeof v !== 'number' || Number.isInteger(v)) continue;
    if (next === stats) next = { ...stats };
    (next as unknown as Record<string, number>)[k] = Math.round(v);
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
  // Cap ricochet chain continuation below 100% so Chaos Shard + Understudy cannot deterministically wipe every card
  if (next.ricochetChainChance > 80) next.ricochetChainChance = 80;
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
  /** Per-weapon equipped evolution map (`weaponId -> evoId`) for active weapons */
  equippedEvolutions: Record<string, string>;
  /** All unlocked per-weapon evolution IDs (used for mid-fight weapon picks & shop buys) */
  unlockedWeaponEvolutions: string[];
  /** Workshop Evolution Lab tier (+2s duration per tier) */
  evolutionLabTier: number;
}

export interface LoadoutOptions {
  /** Allow holding more than MAX_CHARM_SLOTS weapons (e.g. Starfall Spire runs) */
  uncappedCharms?: boolean;
  /** Allow holding more than MAX_ARCANA_SLOTS Arcana (e.g. Starfall Spire runs) */
  uncappedArcana?: boolean;
  /** Override derived Adventure weapon builds (e.g. Spire per-run weapon levels) */
  weaponBuilds?: ReturnType<typeof weaponBuilds>;
  /** Lab-only override: strip fighter passives without disabling Parry/Surge/Rainbow/Purity */
  disablePassives?: boolean;
}

/** Resolve unlocked evolution IDs belonging to one weapon (canonical `<weaponId>:<slug>` format). */
const unlockedEvosFor = (unlocked: readonly string[], weaponId: string): string[] => {
  const prefix = `${weaponId}:`;
  return unlocked.filter(id => id.startsWith(prefix));
};

/**
 * Everything the selected fighter walks into a level with: which systems are
 * on, passives and skill nodes, equipped charms (at their upgrade tiers),
 * equipped per-weapon evolutions, combined Arcana, baked stats, hearts and clock.
 */
export const startingLoadout = (
  level: LevelDef,
  save: AdventureSave,
  features: Set<FeatureFlag> = getFeaturesForLevel(level, save),
  /** Retained for call-site compatibility */
  rand?: () => number,
  opts?: LoadoutOptions
): Loadout => {
  const fighter = save.selectedFighter;
  const gear = features.has('gear');
  const passives = gear && !opts?.disablePassives ? [...fighterPassives(fighter)] : [];
  const skillNodes = gear && !opts?.disablePassives ? fightSkillNodes(save, fighter) : [];
  const arcana = gear ? fightArcana(save, opts?.uncappedArcana) : [];
  const rules = arcanaRules(arcana);
  const builds = opts?.weaponBuilds ?? weaponBuilds(save);
  const effectiveCharmSlots = Math.max(1, charmSlotsOf(save) + (rules.charmSlotDelta ?? 0));
  const equippedCharmIds = fightCharms(save, opts?.uncappedCharms);
  const weapons: Weapon[] = gear
    ? charmWeapons(opts?.uncappedCharms ? equippedCharmIds : equippedCharmIds.slice(0, effectiveCharmSlots), builds)
    : [];
  const modifiers = modifiersOf({
    skillNodes,
    weapons,
    weaponEvolutions: [],
    weaponBuilds: builds,
  });

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
  const evolutionsOn = features.has('evolutions');

  const unlockedWeaponEvolutions = evolutionsOn ? [...(save.unlockedWeaponEvolutions ?? [])] : [];
  const unlockedSet = new Set(unlockedWeaponEvolutions);
  const equippedEvolutions: Record<string, string> = {};
  if (evolutionsOn) {
    for (const [wId, evoId] of Object.entries(save.equippedEvolutions ?? {})) {
      if (unlockedSet.has(evoId) && evoId.startsWith(`${wId}:`)) {
        equippedEvolutions[wId] = evoId;
      }
    }
    for (const w of weapons) {
      if (!equippedEvolutions[w.id]) {
        const first = unlockedEvosFor(unlockedWeaponEvolutions, w.id)[0];
        if (first) equippedEvolutions[w.id] = first;
      }
    }
  }

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
    charmSlots: effectiveCharmSlots,
    arcanaSlots: arcanaSlotsOf(save),
    equippedEvolutions,
    unlockedWeaponEvolutions,
    evolutionLabTier,
  };
};

// ─── Synergy-Graph Auto-Builder & Armory Filter/Sort Pipeline ───────────────

/** Severe Gamble/Board anti-synergies avoided by Auto-Equip (mirrors Spire clash warnings). */
export const BELT_CLASH_PAIRS: readonly { a: string; b: string }[] = [
  { a: 'chain-gang', b: 'long-fuse' },
  { a: 'greedy-chest', b: 'cursed-idol' },
  { a: 'ice-block', b: 'neural-network' },
  { a: 'twin-seed', b: 'chain-reaction' },
  { a: 'twin-seed', b: 'ice-block' },
  { a: 'twin-seed', b: 'hot-potato' },
  { a: 'twin-seed', b: 'long-fuse' },
  { a: 'fog-lantern', b: 'rust' },
  { a: 'thorn-bush', b: 'ice-block' },
  { a: 'rust', b: 'ice-block' },
  { a: 'twin-seed', b: 'thorn-bush' },
  { a: 'ice-block', b: 'greedy-chest' },
];

const clashesWithSelected = (selected: readonly string[], candidate: string): boolean =>
  BELT_CLASH_PAIRS.some(
    pair =>
      (pair.a === candidate && selected.includes(pair.b)) ||
      (pair.b === candidate && selected.includes(pair.a))
  );

const TIME_ONLY_WEAPONS = new Set(['chrono-shard', 'time-drop', 'temporal-rift', 'echo-chamber']);
const BLAST_CLEAR_WEAPONS = new Set(['blast-powder', 'prismatic-ray', 'flint-spark', 'chaos-shard', 'echo-stone']);
const SURVIVAL_WEAPONS = new Set(['mending-charm', 'life-vessel', 'life-link', 'second-chance', 'fortune-token']);

export interface AutoBuildResult {
  save: AdventureSave;
  summary: string;
  /** Shared Synergy Graph attributes linking 2+ equipped belt weapons */
  synergyLinks: SynergyAttrId[];
  /** Number of equipped belt weapons that have an armed Evolution */
  armedEvolutionsCount: number;
  /** First armed evolution summary label (null when none armed) */
  armedEvolution: string | null;
}

/**
 * Synergy-Graph 1-tap "Auto-Equip for Foe": inspects owned Armory weapons,
 * levels, unlocked per-weapon Evolutions, Synergy Graph overlap, anti-synergy
 * clashes, and upcoming level rules/foe abilities to assemble a cohesive belt
 * with proper `Understudy` placement and auto-armed Evolutions.
 */
export const autoBuildLoadout = (save: AdventureSave, level?: LevelDef | null): AutoBuildResult => {
  const slots = charmSlotsOf(save);
  const owned = [...new Set(save.armory)].filter(id => Boolean(getArmoryWeapon(id)));
  if (slots <= 0 || owned.length === 0) {
    return {
      save,
      summary: 'No Armory weapons to equip yet.',
      synergyLinks: [],
      armedEvolutionsCount: 0,
      armedEvolution: null,
    };
  }

  const unlockedEvos = save.unlockedWeaponEvolutions ?? [];
  const untimed = Boolean(level && !level.rules.timer && !level.rules.sandbox);
  const hasHazards = Boolean(level?.rules.hazards?.timeBombs || level?.rules.hazards?.snares);
  const foeTexts = (level?.foes ?? [])
    .map(f => `${f.enemy ?? ''} ${foeDisplay(f).ability ?? ''}`.toLowerCase())
    .join(' ');
  const wantsBoardClear = hasHazards || /dud|lock|clog|face-down|stone|bomb|snare/.test(foeTexts);
  const highPressure = Boolean(level && (level.isBoss || level.difficulty >= 4 || hasHazards));

  const weaponScore = (id: string): number => {
    let score = weaponLevel(save, id) * 14;
    const role = weaponRole(id);
    if (role === 'damage') score += 12;
    else if (role === 'chains' || role === 'board') score += 8;
    else if (role === 'tricks') score += 6;
    else if (role === 'survival') score += highPressure ? 11 : 4;
    else if (role === 'tempo') score += 5;
    else if (role === 'insight') score += 5;
    else if (role === 'gambles') score += 2;

    if (unlockedEvosFor(unlockedEvos, id).length > 0) score += 15;
    if (untimed && TIME_ONLY_WEAPONS.has(id)) score -= 25;
    if (wantsBoardClear && BLAST_CLEAR_WEAPONS.has(id)) score += 10;
    if (highPressure && SURVIVAL_WEAPONS.has(id)) score += 7;
    if (foeTexts.includes('fire') && foeTexts.includes('reduce') && id === 'flint-spark') score -= 18;
    if (foeTexts.includes('blast') && foeTexts.includes('reduce') && id === 'blast-powder') score -= 18;
    if (foeTexts.includes('laser') && foeTexts.includes('reduce') && id === 'prismatic-ray') score -= 18;
    if (id === UNDERSTUDY_ID) score += 4;
    return score;
  };

  // Greedy Synergy-Graph assembly: pick highest-scoring anchor, then maximize base score + Synergy overlap
  const chosen: string[] = [];
  const remaining = [...owned].sort((a, b) => weaponScore(b) - weaponScore(a) || a.localeCompare(b));

  while (chosen.length < slots) {
    let bestId: string | null = null;
    let bestTotal = -Infinity;
    for (const id of remaining) {
      if (chosen.includes(id)) continue;
      if (id === UNDERSTUDY_ID && chosen.length === 0) continue;
      if (clashesWithSelected(chosen, id)) continue;
      const synergyBonus = chosen.length > 0 ? beltSynergyOverlap(id, chosen).length * 10 : 0;
      const total = weaponScore(id) + synergyBonus;
      if (total > bestTotal) {
        bestTotal = total;
        bestId = id;
      }
    }
    if (!bestId) break;
    chosen.push(bestId);
  }

  // Fallback if clash pruning left slots open
  for (const id of remaining) {
    if (chosen.length >= slots) break;
    if (!chosen.includes(id)) chosen.push(id);
  }

  // Ensure `understudy` sits directly to the right of the strongest non-understudy charm (never slot 0)
  const uIdx = chosen.indexOf(UNDERSTUDY_ID);
  if (uIdx >= 0 && chosen.length >= 2) {
    chosen.splice(uIdx, 1);
    let bestAnchor = 0;
    let bestAnchorScore = -Infinity;
    chosen.forEach((id, idx) => {
      const s = weaponScore(id);
      if (s > bestAnchorScore) {
        bestAnchorScore = s;
        bestAnchor = idx;
      }
    });
    chosen.splice(bestAnchor + 1, 0, UNDERSTUDY_ID);
  }

  const finalBelt = chosen.slice(0, slots);

  // Auto-arm an unlocked evolution for any chosen weapon that doesn't have one equipped yet
  const nextEquippedEvos: Record<string, string> = { ...(save.equippedEvolutions ?? {}) };
  let armedEvolutionsCount = 0;
  let firstArmedEvo: string | null = null;
  for (const wId of finalBelt) {
    const ownedForW = unlockedEvosFor(unlockedEvos, wId);
    const current = nextEquippedEvos[wId];
    if (current && ownedForW.includes(current)) {
      armedEvolutionsCount++;
      if (!firstArmedEvo) firstArmedEvo = current;
    } else if (ownedForW.length > 0) {
      nextEquippedEvos[wId] = ownedForW[0];
      armedEvolutionsCount++;
      if (!firstArmedEvo) firstArmedEvo = ownedForW[0];
    }
  }

  // Summarize shared Synergy Graph links across the chosen belt
  const attrCounts = new Map<SynergyAttrId, number>();
  for (const wId of finalBelt) {
    for (const attr of weaponSynergyAttrs(wId)) {
      attrCounts.set(attr, (attrCounts.get(attr) ?? 0) + 1);
    }
  }
  const synergyLinks = [...attrCounts.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([attr]) => attr);

  const notes: string[] = [];
  if (armedEvolutionsCount > 0) {
    notes.push(`${armedEvolutionsCount} Evo${armedEvolutionsCount === 1 ? '' : 's'}`);
  }
  if (synergyLinks.length > 0) {
    const labels = synergyLinks.slice(0, 2).map(id => SYNERGY_ATTR_META[id]?.label ?? id);
    notes.push(`Synergy: ${labels.join(', ')}`);
  }
  const suffix = notes.length > 0 ? ` (${notes.join(' · ')})` : '';
  const summary = `Auto-equipped ${finalBelt.length} weapon${finalBelt.length === 1 ? '' : 's'}${suffix}`;

  return {
    save: { ...save, charms: finalBelt, equippedEvolutions: nextEquippedEvos },
    summary,
    synergyLinks,
    armedEvolutionsCount,
    armedEvolution: firstArmedEvo,
  };
};

export type ArmoryQuickFilter = 'all' | 'synergy' | 'hasEvo' | 'equipped' | 'lv2plus';
export type ArmorySortMode = 'shelves' | 'synergy' | 'level' | 'az';

export interface ArmoryFilterOptions {
  quick: ArmoryQuickFilter;
  role: WeaponRole | 'all';
  query: string;
  sort: ArmorySortMode;
}

/** Shared filter & sort pipeline for all 64 Armory weapons across Camp and LevelPreview. */
export const filterAndSortArmory = (
  save: AdventureSave,
  options: ArmoryFilterOptions
): Weapon[] => {
  const builds = weaponBuilds(save);
  const charms = fightCharms(save);
  const unlockedEvos = save.unlockedWeaponEvolutions ?? [];
  const q = options.query.trim().toLowerCase();

  const items: Weapon[] = [];
  for (const id of save.armory) {
    const w = getArmoryWeapon(id, builds);
    if (!w) continue;
    const isEquipped = charms.includes(id);
    const lvl = weaponLevel(save, id);
    const hasSynergyMatch = !isEquipped && charms.length > 0 && beltSynergyOverlap(id, charms).length > 0;
    const hasEvo = unlockedEvosFor(unlockedEvos, id).length > 0;

    if (options.quick === 'synergy' && !hasSynergyMatch) continue;
    if (options.quick === 'hasEvo' && !hasEvo) continue;
    if (options.quick === 'equipped' && !isEquipped) continue;
    if (options.quick === 'lv2plus' && lvl < 2) continue;
    if (options.role !== 'all' && weaponRole(id) !== options.role) continue;
    if (q.length > 0) {
      const synergyText = weaponSynergyAttrs(id)
        .map(a => SYNERGY_ATTR_META[a]?.label ?? a)
        .join(' ');
      const hay = `${w.name} ${w.shortDescription} ${w.description} ${weaponRole(id)} ${synergyText}`.toLowerCase();
      if (!hay.includes(q)) continue;
    }
    items.push(w);
  }

  if (options.sort === 'shelves') {
    return items;
  }

  return [...items].sort((a, b) => {
    if (options.sort === 'az') {
      return a.name.localeCompare(b.name);
    }
    const lvlA = weaponLevel(save, a.id);
    const lvlB = weaponLevel(save, b.id);
    if (options.sort === 'level') {
      return lvlB - lvlA || a.name.localeCompare(b.name);
    }
    // 'synergy': highest unequipped Synergy Graph overlap first, then equipped, then hasEvo, then level, then A-Z
    const eqA = charms.includes(a.id);
    const eqB = charms.includes(b.id);
    const synA = !eqA ? beltSynergyOverlap(a.id, charms).length : 0;
    const synB = !eqB ? beltSynergyOverlap(b.id, charms).length : 0;
    const rankA = synA > 0 ? 100 + synA : eqA ? 50 : 0;
    const rankB = synB > 0 ? 100 + synB : eqB ? 50 : 0;
    if (rankB !== rankA) return rankB - rankA;
    const evoA = unlockedEvosFor(unlockedEvos, a.id).length > 0 ? 1 : 0;
    const evoB = unlockedEvosFor(unlockedEvos, b.id).length > 0 ? 1 : 0;
    return evoB - evoA || lvlB - lvlA || a.name.localeCompare(b.name);
  });
};
