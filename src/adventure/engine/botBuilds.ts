/**
 * How a bot gears up before a fight, the way a player would at the preview
 * screen: spend the stars it has earned so far on the fighter's skill tree,
 * pick charms (often two that arm an evolution) and play with them.
 *
 * Every choice is seeded, so a balance run tries a spread of builds (one per
 * run) and still gives the same numbers every time.
 */
import type { CharacterName } from '@/types';
import type { AdventureSave, ArcanaId, LevelDef, SkillNode } from '../types';
import { LEVELS, getLevel, mainIndexOf } from '../data/levels';
import { skillTreeOf } from '../data/skillTrees';
import { EVOLUTION_RECIPES } from '../data/evolutions';
import { arcanaSlotsOf, charmSlotsOf } from '../loadout';
import { applyLevelResult, createNewSave, getUnlockedUpgrades } from '../progress';
import { ALL_ARMORY_WEAPON_IDS, getArmoryWeapon } from '../data/armory';
import { weaponRole } from '../data/weaponRoles';
import { MAX_TUNING_TIER, weaponStatLines } from '../data/weaponStats';
import { createRng, type Rng } from './rng';

// ─── Stars ──────────────────────────────────────────────────────────────────

/**
 * Share of the stars on offer a player has earned by the time they reach a
 * level (counting replays: their best result on each level). A star is 1/3 of
 * a level, so 0.75 ≈ "★★ on most levels, ★★★ on a third of them".
 * Every fighter spends every star earned (progress.ts availableStars), so this
 * is also each fighter's skill-tree budget.
 */
export const STAR_SHARE = { novice: 0.6, average: 0.75, expert: 0.9 } as const;

/** Levels a player has finished before this one: the main path so far (and, for a branch, the levels it hangs off). */
export const levelsBefore = (level: LevelDef): LevelDef[] => {
  const idx = mainIndexOf(level);
  const ancestors = new Set<string>();
  for (let at = level; at.branchOf; ) {
    at = getLevel(at.branchOf);
    ancestors.add(at.id);
  }
  return LEVELS.filter(l => mainIndexOf(l) < idx || ancestors.has(l.id));
};

/** Stars a player with this share has earned on reaching the level. */
export const starsOnReaching = (level: LevelDef, share: number): number => Math.round(levelsBefore(level).length * 3 * share);

// ─── Skill trees ────────────────────────────────────────────────────────────

/**
 * How a player spends stars:
 *  - `plan`: picks a capstone it wants and buys the cheapest path to it, then the next one
 *  - `spread`: always buys the cheapest node it can reach (lots of small boosts)
 *  - `random`: buys any node it can reach and afford
 */
export type TreeStyle = 'plan' | 'spread' | 'random';
export const TREE_STYLES: TreeStyle[] = ['plan', 'spread', 'random'];

const isOpen = (n: SkillNode, owned: ReadonlySet<string>) => n.roots.length > 0 || n.links.some(id => owned.has(id));

/** Cheapest unowned path (by stars) from what's owned to `target`, as node ids in buying order, or null if sealed off. */
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

/**
 * Spend `stars` on a fighter's tree from scratch. The sealed capstone opens
 * only once `stars` reaches its requirement (stars earned, as in the game).
 * Returns the node ids bought, in order.
 */
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
    // Capstones first, in a random order of preference; then fill in whatever is left
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

// ─── Charms ─────────────────────────────────────────────────────────────────

/** Recipes the armory can arm (every recipe, once evolutions are unlocked): [recipe id, a weapon of each family] options. */
export const armableRecipes = (save: AdventureSave) =>
  EVOLUTION_RECIPES.filter(() => save.unlockedEvolutions.length > 0)
    .map(r => ({ id: r.id, options: r.families.map(fam => save.armory.filter(id => fam.includes(id))) as [string[], string[]] }))
    .filter(r => r.options.every(o => o.length > 0));

/** Chance a player who owns a recipe brings both halves of one into the fight. */
export const RECIPE_CHARM_CHANCE = 0.6;

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

/**
 * Fill the charm slots: often both halves of an unlocked recipe (so the bot
 * plays evolutions), the rest from the Armory at random.
 */
export const chooseCharms = (save: AdventureSave, rng: Rng, recipeChance = RECIPE_CHARM_CHANCE): string[] => {
  const slots = charmSlotsOf(save);
  const charms: string[] = [];
  const recipes = armableRecipes(save);
  if (recipes.length && slots >= 2 && rng.next() < recipeChance) {
    const r = rng.pick(recipes);
    charms.push(rng.pick(r.options[0]), rng.pick(r.options[1]));
  }
  for (const id of rng.shuffle(save.armory)) if (charms.length < slots && !charms.includes(id)) charms.push(id);
  return fixUnderstudyOrder(charms);
};

/** Weapons that hit hard on their own: derived directly from the Damage shelf. */
export const DAMAGE_WEAPONS: readonly string[] = ALL_ARMORY_WEAPON_IDS.filter(id => weaponRole(id) === 'damage');

/**
 * A solid build, not a counter: both halves of a random recipe, then damage
 * weapons it owns, then anything else it owns.
 */
export const solidCharms = (save: AdventureSave, rng: Rng): string[] => {
  const slots = charmSlotsOf(save);
  const charms: string[] = [];
  const recipes = armableRecipes(save);
  if (recipes.length && slots >= 2) {
    const r = rng.pick(recipes);
    charms.push(rng.pick(r.options[0]), rng.pick(r.options[1]));
  }
  const nonPartners = save.armory.filter(id => !PARTNER_IDS.has(id));
  while (charms.length < slots) {
    const remaining = nonPartners.filter(id => !charms.includes(id));
    if (remaining.length === 0) break;
    const dmg = remaining.filter(id => DAMAGE_WEAPONS.includes(id));
    charms.push(dmg.length > 0 ? rng.pick(dmg) : rng.pick(remaining));
  }
  for (const id of rng.shuffle(save.armory)) if (charms.length < slots && !charms.includes(id)) charms.push(id);
  return fixUnderstudyOrder(charms);
};

/**
 * Pick up to `arcanaSlotsOf(save)` coherent, non-contradictory unlocked Arcana for a build:
 * never pairs `monochrome_pact` with `prismatic_fever` (or Rainbow builds), and skips
 * `glass_prism` on non-expert plans where a 3-heart lock can kill average bots on hazard bosses.
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
  const hasArmedRecipe = armableRecipes({ ...save, armory: [...charms] }).length > 0;
  const preferred: ArcanaId[] = [];
  if (isRainbow && unlocked.has('prismatic_fever')) preferred.push('prismatic_fever');
  if (hasArmedRecipe && unlocked.has('catalyst_resonance')) preferred.push('catalyst_resonance');
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

/** Every Workshop upgrade on sale bought to its top tier. */
export const maxedWorkshop = (save: AdventureSave): AdventureSave['upgrades'] => ({
  ...save.upgrades,
  ...Object.fromEntries(getUnlockedUpgrades(save).map(u => [u.id, u.costs.length])),
});

/** These weapons with every number tuned to the top Workshop tier. */
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
  /** Stars the player has earned (each fighter's skill budget) */
  stars: number;
  /** Fighter to play: a name, 'any' (a different unlocked fighter each run), or the save's selected fighter by default */
  fighter?: CharacterName | 'any';
  /** Tree style; default: one at random per run */
  treeStyle?: TreeStyle;
  /** Keep the save's charms instead of choosing (a puzzle level that asks for a loadout) */
  keepCharms?: boolean;
  /**
   * How charms are picked: 'random' (never chases a recipe), 'solid' (a recipe
   * pair plus damage weapons), or 'mixed' (default: a recipe pair 60% of the time)
   */
  charms?: 'random' | 'solid' | 'mixed';
  /** Every Workshop upgrade on sale maxed, and the charms brought fully tuned */
  workshop?: boolean;
  /** Level-up picks and shop buys prefer a weapon that arms a new recipe (default true) */
  chaseRecipes?: boolean;
  /** Equip unlocked non-contradictory Arcana ('none' keeps save's equippedArcana) */
  arcana?: 'none' | 'synergistic';
}

/** The save a bot walks into the fight with, for one seeded run. */
export const gearUp = (save: AdventureSave, plan: BuildPlan, seed: number): AdventureSave => {
  const rng = createRng(seed ^ 0x2545f491);
  const fighter = plan.fighter === 'any' ? rng.pick(save.unlockedFighters) : plan.fighter ?? save.selectedFighter;
  const style = plan.treeStyle ?? rng.pick(TREE_STYLES);
  const nodes = buyTree(fighter, plan.stars, style, rng);
  const upgrades = plan.workshop ? maxedWorkshop(save) : save.upgrades;
  // Charm & Arcana slots come from the Workshop, so buy first and pick after
  const bought = { ...save, upgrades };
  const charms = plan.keepCharms
    ? save.charms
    : plan.charms === 'random'
      ? chooseCharms(bought, rng, 0)
      : plan.charms === 'solid'
        ? solidCharms(bought, rng)
        : chooseCharms(bought, rng);
  const equippedArcana =
    plan.arcana === 'synergistic' ? chooseSynergisticArcana(bought, fighter, charms, rng) : save.equippedArcana;
  return {
    ...bought,
    selectedFighter: fighter,
    skillNodes: { ...save.skillNodes, [fighter]: nodes },
    charms,
    equippedArcana,
    activeArcana: equippedArcana[0] ?? null,
    weaponTuning: plan.workshop && save.workshopUnlocked ? maxedTuning(save, charms) : save.weaponTuning,
  };
};

// ─── The two players & 3-star funnel balance is aimed at (docs/balance-philosophy.md) ───

/** Knockout (★★+) rate by world, 1-5, for each player. */
export const WIN_TARGETS = {
  /** No stars or coins spent, random charms, never chases a recipe */
  bare: [0.75, 0.3, 0.1, 0, 0],
  /** Everything available by then: every star, the Workshop maxed, charms tuned, a solid recipe build */
  invested: [0.98, 0.9, 0.8, 0.7, 0.5],
} as const;

/**
 * Full 3-star funnel targets by world, 1-5 (mobile 3-star best practices):
 * - ★1+ (`clear`): very easy in World 1 (~95–100%) so players never feel discouraged; steps down smoothly.
 * - ★★+ (`ko`): easy in World 1 (~78% bare, ~98% invested), tightening in later worlds (`WIN_TARGETS`).
 * - ★★★ (`star3`): "a bit of a challenge" in World 1 (~72% average invested, >=75% pro floor per level),
 *   tightening to ~28% first-try mastery in World 5 so replays & buildcraft stay rewarding.
 */
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

/** A fighter trial (an elite branch that teaches a fighter) */
export const isTrial = (level: LevelDef) => level.introduces.startsWith('fighter_');

/**
 * This level's knockout (★★+) targets. Bosses and elites are a step harder for the
 * invested player; fighter trials feel good; the first meadow lessons ramp gently.
 */
export const winTargets = (level: LevelDef): { bare: number; invested: number } => {
  const w = worldOf(level) - 1;
  const bare = WIN_TARGETS.bare[w];
  const invested = WIN_TARGETS.invested[w];
  if (level.starRule?.kind === 'accuracy') return { bare: 1, invested: 1 };
  if (isTrial(level)) return { bare: Math.min(1, bare + 0.15), invested: Math.min(0.98, invested + 0.05) };
  if (level.branchOf) return { bare: Math.max(0, bare - 0.15), invested: invested - 0.15 };
  if (level.isBoss) return { bare: Math.max(0, bare - 0.12), invested: invested - 0.08 };
  // The meadow's opening lessons come before Skill Trees, Coins or Workshop exist, so bare stays high
  const tutorial: Record<string, number> = { '1-2': 0.85, '1-3': 0.85, '1-4': 0.8, '1-5': 0.8 };
  return { bare: tutorial[level.id] ?? bare, invested };
};

/** Full 3-star funnel targets (`★1+` clear, `★★+` knockout, `★★★` mastery & pro `★★★` floor) for a level. */
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

/** The bare player: no stars, no Workshop, random charms, never chases recipes. */
export const barePlan = (level: LevelDef): BuildPlan => ({
  stars: 0,
  fighter: isTrial(level) ? level.recommended![0] : 'any',
  charms: 'random',
  chaseRecipes: false,
  arcana: 'none',
});

/** The invested player: every star on offer spent with a plan, the Workshop maxed, synergistic Arcana, and a solid recipe build. */
export const investedPlan = (level: LevelDef): BuildPlan => ({
  stars: starsOnReaching(level, 1),
  fighter: isTrial(level) ? level.recommended![0] : 'any',
  treeStyle: 'plan',
  charms: 'solid',
  workshop: true,
  arcana: 'synergistic',
});

// ─── Shared campaign save builder (single source of truth for tuner, analytics & balance tests) ───

/** Levels whose puzzle names its charms. */
export const PUZZLE_CHARMS: Record<string, string[]> = {
  '3-2': ['blast-powder', 'flint-spark', 'prismatic-ray'],
};

const campaignSaveCache = new Map<string, AdventureSave>();

/** What the player owns on reaching a level: 3★ on every level before it, through the real reward pipeline. */
export const campaignSave = (level: LevelDef): AdventureSave => {
  const hit = campaignSaveCache.get(level.id);
  if (hit) return hit;
  let save = createNewSave();
  for (const l of levelsBefore(level)) save = applyLevelResult(save, l, 3, 0).save;
  if (PUZZLE_CHARMS[level.id]) save = { ...save, charms: PUZZLE_CHARMS[level.id] };
  campaignSaveCache.set(level.id, save);
  return save;
};
