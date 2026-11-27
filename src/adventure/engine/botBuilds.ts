/**
 * How a bot gears up before a fight, the way a player would at the preview
 * screen: spend the stars it has earned so far on the fighter's skill tree,
 * assemble a synergistic weapon belt via the Synergy Graph, equip unlocked
 * per-weapon evolutions, and pick coherent Arcana.
 */
import type { CharacterName } from '@/types';
import type { AdventureSave, ArcanaId, LevelDef, SkillNode } from '../types';
import { LEVELS, getLevel, mainIndexOf } from '../data/levels';
import { skillTreeOf } from '../data/skillTrees';
import { evolutionsForWeapon } from '../data/evolutions';
import { beltSynergyOverlap } from '../data/synergy';
import { arcanaSlotsOf, charmSlotsOf } from '../loadout';
import { applyLevelResult, createNewSave, getUnlockedUpgrades } from '../progress';
import { ALL_ARMORY_WEAPON_IDS, getArmoryWeapon } from '../data/armory';
import { weaponRole } from '../data/weaponRoles';
import { MAX_TUNING_TIER, weaponStatLines } from '../data/weaponStats';
import { createRng, type Rng } from './rng';

// ─── Stars ──────────────────────────────────────────────────────────────────

export const STAR_SHARE = { novice: 0.6, average: 0.75, expert: 0.9 } as const;

export const levelsBefore = (level: LevelDef): LevelDef[] => {
  const idx = mainIndexOf(level);
  const ancestors = new Set<string>();
  for (let at = level; at.branchOf; ) {
    at = getLevel(at.branchOf);
    ancestors.add(at.id);
  }
  return LEVELS.filter(l => mainIndexOf(l) < idx || ancestors.has(l.id));
};

export const starsOnReaching = (level: LevelDef, share: number): number => Math.round(levelsBefore(level).length * 3 * share);

// ─── Skill trees ────────────────────────────────────────────────────────────

export type TreeStyle = 'plan' | 'spread' | 'random';
export const TREE_STYLES: TreeStyle[] = ['plan', 'spread', 'random'];

const isOpen = (n: SkillNode, owned: ReadonlySet<string>) => n.roots.length > 0 || n.links.some(id => owned.has(id));

const pathTo = (tree: SkillNode[], owned: ReadonlySet<string>, target: string, sealed: (n: SkillNode) => boolean): string[] | null => {
  const byId = new Map(tree.map(n => [n.id, n]));
  const dist = new Map<string, number>();
  const prev = new Map<string, string | null>();
  const open: string[] = [];
  for (const n of tree) {
    if (owned.has(n.id) || sealed(n) || !isOpen(n, owned)) continue;
    dist.set(n.id, n.cost);
    prev.set(n.id, null);
    open.push(n.id);
  }
  while (open.length) {
    open.sort((a, b) => dist.get(a)! - dist.get(b)!);
    const id = open.shift()!;
    if (id === target) break;
    for (const next of byId.get(id)!.links) {
      const n = byId.get(next);
      if (!n || owned.has(next) || sealed(n)) continue;
      const d = dist.get(id)! + n.cost;
      if (d < (dist.get(next) ?? Infinity)) {
        if (!dist.has(next)) open.push(next);
        dist.set(next, d);
        prev.set(next, id);
      }
    }
  }
  if (!prev.has(target)) return null;
  const path: string[] = [];
  for (let at: string | null = target; at; at = prev.get(at) ?? null) path.unshift(at);
  return path;
};

export const buyTree = (fighter: CharacterName, stars: number, style: TreeStyle, rng: Rng): string[] => {
  const tree = skillTreeOf(fighter);
  const sealed = (n: SkillNode) => !!n.requires && stars < n.requires.starsEarned;
  const owned = new Set<string>();
  let left = stars;
  const affordable = () => tree.filter(n => !owned.has(n.id) && !sealed(n) && isOpen(n, owned) && n.cost <= left);
  const buy = (id: string) => {
    owned.add(id);
    left -= tree.find(n => n.id === id)!.cost;
  };

  if (style === 'plan') {
    const goals = rng.shuffle(tree.filter(n => n.id.includes('-cap-') && !sealed(n)).map(n => n.id));
    for (const goal of goals) {
      const path = pathTo(tree, owned, goal, sealed);
      if (!path) continue;
      for (const id of path) {
        const n = tree.find(x => x.id === id)!;
        if (n.cost > left) break;
        buy(id);
      }
    }
  }
  for (let next = affordable(); next.length; next = affordable()) {
    if (style === 'random') buy(rng.pick(next).id);
    else buy([...next].sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id))[0].id);
  }
  return tree.filter(n => owned.has(n.id)).map(n => n.id);
};

// ─── Charms & Synergy Belt Assembly ─────────────────────────────────────────

/** Chance a player builds around a synergistic anchor weapon in mixed mode. */
export const SYNERGY_CHARM_CHANCE = 0.65;

const PARTNER_IDS = new Set(['understudy', 'encore-mask']);

/** Never leave Understudy in slot 0 (where it copies nothing): put it right after a strong non-partner weapon. */
export const fixUnderstudyOrder = (charms: readonly string[]): string[] => {
  const out = [...charms];
  const idx = out.indexOf('understudy');
  if (idx !== 0 || out.length < 2) return out;
  const target = out.findIndex((id, i) => i > 0 && !PARTNER_IDS.has(id));
  const swapWith = target > 0 ? target : 1;
  [out[0], out[swapWith]] = [out[swapWith], out[0]];
  return out;
};

/** Weapons that hit hard on their own: derived directly from the Damage shelf. */
export const DAMAGE_WEAPONS: readonly string[] = ALL_ARMORY_WEAPON_IDS.filter(id => weaponRole(id) === 'damage');

const hasUnlockedEvo = (save: AdventureSave, weaponId: string): boolean => {
  const unlocked = new Set(save.unlockedWeaponEvolutions ?? []);
  return evolutionsForWeapon(weaponId).some(e => unlocked.has(e.id));
};

/**
 * Fill the charm slots: with probability `synergyChance`, pick a Synergy-coherent
 * belt anchored on an owned weapon and add partners sharing Synergy Graph attributes.
 */
export const chooseCharms = (save: AdventureSave, rng: Rng, synergyChance = SYNERGY_CHARM_CHANCE): string[] => {
  const slots = charmSlotsOf(save);
  const charms: string[] = [];
  if (save.armory.length === 0 || slots <= 0) return charms;

  if (rng.next() < synergyChance) {
    const anchors = save.armory.filter(id => !PARTNER_IDS.has(id));
    if (anchors.length > 0) charms.push(rng.pick(anchors));
    while (charms.length < slots) {
      const remaining = save.armory.filter(id => !charms.includes(id));
      if (remaining.length === 0) break;
      const synergistic = remaining.filter(id => beltSynergyOverlap(id, charms).length > 0);
      const pool = synergistic.length > 0 ? synergistic : remaining;
      charms.push(rng.pick(pool));
    }
  }
  for (const id of rng.shuffle(save.armory)) if (charms.length < slots && !charms.includes(id)) charms.push(id);
  return fixUnderstudyOrder(charms);
};

/**
 * A solid build: anchor on a Damage weapon (preferring one with an unlocked
 * evolution), then fill remaining slots maximizing Synergy Graph overlap + Damage shelf.
 */
export const solidCharms = (save: AdventureSave, rng: Rng): string[] => {
  const slots = charmSlotsOf(save);
  const charms: string[] = [];
  const nonPartners = save.armory.filter(id => !PARTNER_IDS.has(id));
  const dmgOwned = nonPartners.filter(id => DAMAGE_WEAPONS.includes(id));
  const evoDmg = dmgOwned.filter(id => hasUnlockedEvo(save, id));
  const firstPool = evoDmg.length > 0 ? evoDmg : dmgOwned.length > 0 ? dmgOwned : nonPartners;
  if (firstPool.length > 0 && slots > 0) charms.push(rng.pick(firstPool));

  while (charms.length < slots) {
    const remaining = nonPartners.filter(id => !charms.includes(id));
    if (remaining.length === 0) break;
    let bestScore = -1;
    let best: string[] = [];
    for (const id of remaining) {
      const score =
        beltSynergyOverlap(id, charms).length * 3 +
        (DAMAGE_WEAPONS.includes(id) ? 2 : 0) +
        (hasUnlockedEvo(save, id) ? 1.5 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = [id];
      } else if (score === bestScore) {
        best.push(id);
      }
    }
    charms.push(rng.pick(best));
  }
  for (const id of rng.shuffle(save.armory)) if (charms.length < slots && !charms.includes(id)) charms.push(id);
  return fixUnderstudyOrder(charms);
};

/** Equip an unlocked evolution on each held charm when available (preserving existing valid picks). */
export const chooseEquippedEvolutions = (
  save: AdventureSave,
  charms: readonly string[],
  rng: Rng
): Record<string, string> => {
  const out: Record<string, string> = { ...(save.equippedEvolutions ?? {}) };
  const unlocked = new Set(save.unlockedWeaponEvolutions ?? []);
  if (unlocked.size === 0) return out;
  for (const wid of charms) {
    const existing = out[wid];
    if (existing && unlocked.has(existing)) continue;
    const avail = evolutionsForWeapon(wid).filter(e => unlocked.has(e.id));
    if (avail.length > 0) out[wid] = rng.pick(avail).id;
  }
  return out;
};

/**
 * Pick up to `arcanaSlotsOf(save)` coherent, non-contradictory unlocked Arcana for a build.
 */
export const chooseSynergisticArcana = (
  save: AdventureSave,
  fighter: CharacterName,
  charms: readonly string[],
  rng: Rng,
  allowGlass = false
): ArcanaId[] => {
  const slots = arcanaSlotsOf(save);
  if (slots <= 0 || save.unlockedArcana.length === 0) return [];
  const unlocked = new Set(save.unlockedArcana);
  const isRainbow = fighter === 'Emperor Penguin' || charms.includes('rainbow-charm') || charms.includes('wild-card');
  const hasEquippedEvo = charms.some(id => hasUnlockedEvo(save, id));
  const preferred: ArcanaId[] = [];
  if (isRainbow && unlocked.has('prismatic_fever')) preferred.push('prismatic_fever');
  if (hasEquippedEvo && unlocked.has('catalyst_resonance')) preferred.push('catalyst_resonance');
  for (const id of rng.shuffle(['tempo_surge', 'controlled_burn', 'scholars_gambit'] as ArcanaId[])) {
    if (unlocked.has(id)) preferred.push(id);
  }
  if (!isRainbow && unlocked.has('monochrome_pact')) preferred.push('monochrome_pact');
  if (!isRainbow && unlocked.has('prismatic_fever') && !preferred.includes('monochrome_pact')) {
    preferred.push('prismatic_fever');
  }
  if (allowGlass && unlocked.has('glass_prism')) preferred.push('glass_prism');

  const chosen: ArcanaId[] = [];
  for (const id of preferred) {
    if (chosen.length >= slots) break;
    if (chosen.includes(id)) continue;
    if (id === 'monochrome_pact' && chosen.includes('prismatic_fever')) continue;
    if (id === 'prismatic_fever' && chosen.includes('monochrome_pact')) continue;
    chosen.push(id);
  }
  return chosen;
};

export const maxedWorkshop = (save: AdventureSave): AdventureSave['upgrades'] => ({
  ...save.upgrades,
  ...Object.fromEntries(getUnlockedUpgrades(save).map(u => [u.id, u.costs.length])),
});

export const maxedTuning = (save: AdventureSave, ids: readonly string[]): AdventureSave['weaponTuning'] => {
  const tuning = { ...(save.weaponTuning ?? {}) };
  for (const id of ids) {
    const w = getArmoryWeapon(id);
    if (!w) continue;
    const lines = weaponStatLines(w, { level: 1, tuning: {} }).filter(l => l.tunable);
    tuning[id] = Object.fromEntries(lines.map(l => [l.key, MAX_TUNING_TIER]));
  }
  return tuning;
};

// ─── Whole build ────────────────────────────────────────────────────────────

export interface BuildPlan {
  stars: number;
  fighter?: CharacterName | 'any';
  treeStyle?: TreeStyle;
  keepCharms?: boolean;
  charms?: 'random' | 'solid' | 'mixed';
  workshop?: boolean;
  /** Level-up picks and shop buys prefer weapons overlapping the belt's Synergy Graph (default true) */
  chaseRecipes?: boolean;
  arcana?: 'none' | 'synergistic';
}

export const gearUp = (save: AdventureSave, plan: BuildPlan, seed: number): AdventureSave => {
  const rng = createRng(seed ^ 0x2545f491);
  const fighter = plan.fighter === 'any' ? rng.pick(save.unlockedFighters) : plan.fighter ?? save.selectedFighter;
  const style = plan.treeStyle ?? rng.pick(TREE_STYLES);
  const nodes = buyTree(fighter, plan.stars, style, rng);
  const upgrades = plan.workshop ? maxedWorkshop(save) : save.upgrades;
  const bought = { ...save, upgrades };
  const charms = plan.keepCharms
    ? save.charms
    : plan.charms === 'random'
      ? chooseCharms(bought, rng, 0)
      : plan.charms === 'solid'
        ? solidCharms(bought, rng)
        : chooseCharms(bought, rng);
  const equippedEvolutions = chooseEquippedEvolutions(bought, charms, rng);
  const equippedArcana =
    plan.arcana === 'synergistic' ? chooseSynergisticArcana(bought, fighter, charms, rng) : save.equippedArcana;
  return {
    ...bought,
    selectedFighter: fighter,
    skillNodes: { ...save.skillNodes, [fighter]: nodes },
    charms,
    equippedEvolutions,
    equippedArcana,
    activeArcana: equippedArcana[0] ?? null,
    weaponTuning: plan.workshop && save.workshopUnlocked ? maxedTuning(save, charms) : save.weaponTuning,
  };
};

// ─── The two players & 3-star funnel balance is aimed at ────────────────────

export const WIN_TARGETS = {
  bare: [0.75, 0.3, 0.1, 0, 0],
  invested: [0.98, 0.9, 0.8, 0.7, 0.5],
} as const;

export const STAR_TARGETS = {
  bareClearFloor: [0.88, 0.55, 0.2, 0.03, 0],
  investedClearFloor: [0.95, 0.9, 0.82, 0.7, 0.5],
  investedStar3: [0.72, 0.58, 0.48, 0.38, 0.28],
  investedStar3Floor: [0.5, 0.3, 0.2, 0.15, 0.1],
  expertStar3Floor: [0.75, 0.45, 0.3, 0.2, 0.12],
} as const;

export interface StarTargets {
  bareClearFloor: number;
  investedClearFloor: number;
  bareKo: number;
  investedKo: number;
  investedStar3: number;
  investedStar3Floor: number;
  expertStar3Floor: number;
}

const WORLD_OF: Record<LevelDef['biome'], number> = { meadow: 1, woods: 2, canyon: 3, peaks: 4, summit: 5 };
export const worldOf = (level: LevelDef): number => WORLD_OF[level.biome];

export const isTrial = (level: LevelDef) => level.introduces.startsWith('fighter_');

export const winTargets = (level: LevelDef): { bare: number; invested: number } => {
  const w = worldOf(level) - 1;
  const bare = WIN_TARGETS.bare[w];
  const invested = WIN_TARGETS.invested[w];
  if (level.starRule?.kind === 'accuracy') return { bare: 1, invested: 1 };
  if (isTrial(level)) return { bare: Math.min(1, bare + 0.15), invested: Math.min(0.98, invested + 0.05) };
  if (level.branchOf) return { bare: Math.max(0, bare - 0.15), invested: invested - 0.15 };
  if (level.isBoss) return { bare: Math.max(0, bare - 0.12), invested: invested - 0.08 };
  const tutorial: Record<string, number> = { '1-2': 0.85, '1-3': 0.85, '1-4': 0.8, '1-5': 0.8 };
  return { bare: tutorial[level.id] ?? bare, invested };
};

export const starTargets = (level: LevelDef): StarTargets => {
  const w = worldOf(level) - 1;
  const ko = winTargets(level);
  const hardShift = level.branchOf && !isTrial(level) ? -0.1 : level.isBoss ? -0.08 : isTrial(level) ? 0.05 : 0;
  return {
    bareClearFloor: level.starRule?.kind === 'accuracy' ? 1 : Math.max(0, Math.min(1, STAR_TARGETS.bareClearFloor[w] + hardShift)),
    investedClearFloor: level.starRule?.kind === 'accuracy' ? 1 : Math.max(ko.invested, Math.min(1, STAR_TARGETS.investedClearFloor[w] + hardShift)),
    bareKo: ko.bare,
    investedKo: ko.invested,
    investedStar3: Math.max(0.15, Math.min(0.92, STAR_TARGETS.investedStar3[w] + hardShift)),
    investedStar3Floor: Math.max(0.08, Math.min(0.8, STAR_TARGETS.investedStar3Floor[w] + hardShift)),
    expertStar3Floor: Math.max(0.1, Math.min(0.9, STAR_TARGETS.expertStar3Floor[w] + hardShift)),
  };
};

export const barePlan = (level: LevelDef): BuildPlan => ({
  stars: 0,
  fighter: isTrial(level) ? level.recommended![0] : 'any',
  charms: 'random',
  chaseRecipes: false,
  arcana: 'none',
});

export const investedPlan = (level: LevelDef): BuildPlan => ({
  stars: starsOnReaching(level, 1),
  fighter: isTrial(level) ? level.recommended![0] : 'any',
  treeStyle: 'plan',
  charms: 'solid',
  workshop: true,
  arcana: 'synergistic',
});

export const PUZZLE_CHARMS: Record<string, string[]> = {
  '3-2': ['blast-powder', 'flint-spark', 'prismatic-ray'],
};

const campaignSaveCache = new Map<string, AdventureSave>();

export const campaignSave = (level: LevelDef): AdventureSave => {
  const hit = campaignSaveCache.get(level.id);
  if (hit) return hit;
  let save = createNewSave();
  for (const l of levelsBefore(level)) save = applyLevelResult(save, l, 3, 0).save;
  if (PUZZLE_CHARMS[level.id]) save = { ...save, charms: PUZZLE_CHARMS[level.id] };
  campaignSaveCache.set(level.id, save);
  return save;
};
