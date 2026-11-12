/**
 * How a bot gears up before a fight, the way a player would at the preview
 * screen: spend the stars it has earned so far on the fighter's skill tree,
 * pick charms (often two that arm an evolution) and play with them.
 *
 * Every choice is seeded, so a balance run tries a spread of builds (one per
 * run) and still gives the same numbers every time.
 */
import type { CharacterName } from '@/types';
import type { AdventureSave, LevelDef, SkillNode } from '../types';
import { LEVELS, getLevel, mainIndexOf } from '../data/levels';
import { skillTreeOf } from '../data/skillTrees';
import { EVOLUTION_RECIPES } from '../data/evolutions';
import { charmSlotsOf } from '../loadout';
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

/** Unlocked recipes the armory can arm: [recipe id, a weapon of each family] options. */
export const armableRecipes = (save: AdventureSave) =>
  EVOLUTION_RECIPES.filter(r => save.unlockedEvolutions.includes(r.id))
    .map(r => ({ id: r.id, options: r.families.map(fam => save.armory.filter(id => fam.includes(id))) as [string[], string[]] }))
    .filter(r => r.options.every(o => o.length > 0));

/** Chance a player who owns a recipe brings both halves of one into the fight. */
export const RECIPE_CHARM_CHANCE = 0.6;

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
  return charms;
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
}

/** The save a bot walks into the fight with, for one seeded run. */
export const gearUp = (save: AdventureSave, plan: BuildPlan, seed: number): AdventureSave => {
  const rng = createRng(seed ^ 0x2545f491);
  const fighter = plan.fighter === 'any' ? rng.pick(save.unlockedFighters) : plan.fighter ?? save.selectedFighter;
  const style = plan.treeStyle ?? rng.pick(TREE_STYLES);
  const nodes = buyTree(fighter, plan.stars, style, rng);
  return {
    ...save,
    selectedFighter: fighter,
    skillNodes: { ...save.skillNodes, [fighter]: nodes },
    charms: plan.keepCharms ? save.charms : chooseCharms(save, rng),
  };
};
