/**
 * Weapon Evolutions & the Recipe Guide.
 *
 * How evolutions work in a fight:
 *  1. Bring or draft the required weapons, AND fulfill the recipe's in-fight
 *     awakening condition (a Set streak, Purity Chain, Rainbow count, etc.).
 *  2. Match a valid Set containing the card with the hidden Evolution Catalyst
 *     (`card.hasEvolutionItem`). At most ONE Catalyst can appear on screen at a time.
 *  3. If you match on the Catalyst card BEFORE any recipe is primed, the
 *     Catalyst shatters and is lost!
 */
import type { Weapon } from '@/types';
import type { RunState } from '../types';

export interface EvolutionBurst {
  damage?: number;
  heal?: number;
  coins?: number;
  timeBonus?: number;
  hints?: number;
  graces?: number;
  igniteCards?: number;
  growBoard?: number;
  xpBonus?: number;
}

export type EvolutionCheckContext = Pick<
  RunState,
  'matches' | 'mistakes' | 'coins' | 'maxPurityChain' | 'roundStats' | 'attributes'
>;

export interface EvolutionPrimeProgress {
  current: number;
  target: number;
  label: string;
}

export interface EvolutionRecipe {
  id: string;
  result: Weapon;
  burst: EvolutionBurst;
  burstText: string;
  gearRequirementText: string;
  primeRequirementText: string;
  mysteryHint: string;
  unlockHint: string;
  hasGear: (weapons: Weapon[]) => boolean;
  primeProgress: (ctx: EvolutionCheckContext) => EvolutionPrimeProgress;
}

const hasAnyId = (weapons: Weapon[], prefixes: string[]): boolean =>
  weapons.some(w => prefixes.some(p => w.id === p || w.id.startsWith(`${p}-`)));

const countMatchingWeapons = (weapons: Weapon[], prefixes: string[]): number =>
  weapons.filter(w => prefixes.some(p => w.id === p || w.id.startsWith(`${p}-`))).length;

const FIRE_IDS = ['flint-spark', 'ember-heart', 'sympathetic-flames', 'cascade-core'];
const BLAST_IDS = ['blast-powder', 'inferno-charge'];
const HEAL_IDS = ['mending-charm', 'restoration-aura', 'vital-core', 'soul-harvest'];
const LIFE_IDS = ['life-vessel', 'vital-core', 'life-link'];
const GRACE_CAP_IDS = ['second-chance', 'fortunes-shield'];
const GRACE_GAIN_IDS = ['fortune-token', 'lucky-charm', 'grace-conduit'];
const VISION_IDS = ['oracle-eye', 'seeker-lens', 'crystal-orb', 'clairvoyant-sphere', 'enlightened-eye', 'prophets-vision', 'mystic-sight'];
const GROWTH_IDS = ['growth-seed', 'life-bloom'];
const FIELD_IDS = ['field-stone', 'terra-foundation'];
const CHRONO_ECHO_IDS = ['chrono-shard', 'time-drop', 'echo-stone', 'temporal-core', 'hourglass-of-ages', 'resonance-crystal', 'temporal-rift'];
const WEALTH_TOME_IDS = ['fortunes-favor', 'golden-touch', 'fortunes-blessing', 'scholars-tome', 'arcane-codex', 'wisdom-chain'];
const LASER_CHAOS_IDS = ['prismatic-ray', 'spectrum-annihilator', 'chaos-shard', 'entropy-engine', 'chaos-conduit'];

/**
 * Cross-build Charm fusions sit first so equipping a specialty Charm prioritizes
 * its fusion ahead of a fighter's default starter pair.
 */
export const EVOLUTION_RECIPES: EvolutionRecipe[] = [
  {
    id: 'prism-annihilator',
    result: {
      id: 'evo-prism-annihilator',
      name: 'Prism Annihilator',
      rarity: 'legendary',
      level: 4,
      price: 60,
      description: '+30% laser chance, +35% ricochet chance, and +10% laser & ricochet caps.',
      shortDescription: '30% laser + 35% ricochet',
      flavorText: 'Splits a single Catalyst crystal into a lattice of board-clearing beams.',
      icon: 'lorc/laser-blast',
      specialEffect: 'laser',
      effects: { laserChance: 30, ricochetChance: 35, ricochetChainChance: 20 },
      capIncrease: { type: 'laser', amount: 10 },
      maxCount: 1,
    },
    burst: { damage: 8 },
    burstText: 'Deals 8 instant beam damage to the foe',
    gearRequirementText: 'Prismatic Ray or Chaos Shard + any 2nd weapon',
    primeRequirementText: 'Reach a 3-step Purity Chain or 2 Rainbow Strikes',
    mysteryHint: 'Combine beam or ricochet gear with prismatic mastery.',
    unlockHint: 'Earn ★★★ on 3-1 Fourth Dimension',
    hasGear: ws => ws.length >= 2 && hasAnyId(ws, LASER_CHAOS_IDS),
    primeProgress: ctx => {
      const score = Math.max(ctx.roundStats.allDifferentMatches, ctx.maxPurityChain >= 3 ? 2 : Math.floor(ctx.maxPurityChain / 2));
      return { current: Math.min(2, score), target: 2, label: `${Math.min(2, score)}/2 Rainbows or 3-Purity` };
    },
  },
  {
    id: 'chrono-singularity',
    result: {
      id: 'evo-chrono-singularity',
      name: 'Chrono Singularity',
      rarity: 'legendary',
      level: 4,
      price: 60,
      description: '+30% echo chance, +30% time gain chance, and +10% echo cap.',
      shortDescription: '30% echo + 30% time gain',
      flavorText: 'Past and future Sets collapse into the same heartbeat.',
      icon: 'lorc/time-trap',
      specialEffect: 'echo',
      effects: { echoChance: 30, timeGainChance: 30, timeGainAmount: 10 },
      capIncrease: { type: 'echo', amount: 10 },
      maxCount: 1,
    },
    burst: { damage: 5, timeBonus: 10 },
    burstText: '+10s on the clock and 5 damage',
    gearRequirementText: 'Any 2 Chrono or Echo weapons',
    primeRequirementText: 'Land 2 Rainbow Strikes (or 3 Sets on 2-trait boards)',
    mysteryHint: 'Pair two time-bending or echoing relics and strike with every color.',
    unlockHint: 'Earn ★★★ on 3-2 Marching Ants',
    hasGear: ws => countMatchingWeapons(ws, CHRONO_ECHO_IDS) >= 2,
    primeProgress: ctx => {
      if (ctx.attributes.length <= 2) {
        return { current: Math.min(3, ctx.matches), target: 3, label: `${Math.min(3, ctx.matches)}/3 Sets` };
      }
      const cur = Math.min(2, ctx.roundStats.allDifferentMatches);
      return { current: cur, target: 2, label: `${cur}/2 Rainbows` };
    },
  },
  {
    id: 'golden-philosopher',
    result: {
      id: 'evo-golden-philosopher',
      name: "Philosopher's Crown",
      rarity: 'legendary',
      level: 4,
      price: 60,
      description: '+50% coin gain chance, +50% XP gain chance, and +15% coin cap.',
      shortDescription: '+50% coins & XP gain',
      flavorText: 'Transmutes raw pattern insight directly into royal gold.',
      icon: 'delapouite/coins-pile',
      specialEffect: 'coinGain',
      effects: { coinGainChance: 50, xpGainChance: 50 },
      capIncrease: { type: 'coinGain', amount: 15 },
      maxCount: 1,
    },
    burst: { coins: 10, xpBonus: 8 },
    burstText: '+10 base coins and +8 XP burst',
    gearRequirementText: "Fortune's Favor or Scholar's Tome + any 2nd weapon",
    primeRequirementText: 'Collect 8+ coins during this fight',
    mysteryHint: 'Carry wealth or wisdom gear and fill your purse mid-fight.',
    unlockHint: 'Earn ★★★ on 2-6 Tick Tock',
    hasGear: ws => ws.length >= 2 && hasAnyId(ws, WEALTH_TOME_IDS),
    primeProgress: ctx => {
      const cur = Math.min(8, ctx.coins);
      return { current: cur, target: 8, label: `${cur}/8¢ banked` };
    },
  },
  {
    id: 'solar-cataclysm',
    result: {
      id: 'evo-solar-cataclysm',
      name: 'Solar Cataclysm',
      rarity: 'legendary',
      level: 4,
      price: 60,
      description: '+35% explosion chance, +35% fire chance, and +15% explosion cap.',
      shortDescription: '35% blast + 35% wildfire',
      flavorText: 'Flint and powder fused in a Catalyst heart: every Set erupts.',
      icon: 'lorc/fireball',
      specialEffect: 'explosive',
      effects: { explosionChance: 35, fireSpreadChance: 35 },
      capIncrease: { type: 'explosion', amount: 15 },
      maxCount: 1,
    },
    burst: { damage: 6, igniteCards: 2 },
    burstText: 'Deals 6 damage and ignites 2 cards',
    gearRequirementText: 'Flint Spark + Blast Powder families',
    primeRequirementText: 'Make 3 Sets in this fight',
    mysteryHint: "Sly Fox's twin elements—spark and powder—primed by three clean strikes.",
    unlockHint: "Earn ★★ on 1-5E Hoarder's Den (World 1 Elite)",
    hasGear: ws => hasAnyId(ws, FIRE_IDS) && hasAnyId(ws, BLAST_IDS),
    primeProgress: ctx => {
      const cur = Math.min(3, ctx.matches);
      return { current: cur, target: 3, label: `${cur}/3 Sets` };
    },
  },
  {
    id: 'immortal-aegis',
    result: {
      id: 'evo-immortal-aegis',
      name: 'Immortal Aegis',
      rarity: 'legendary',
      level: 4,
      price: 60,
      description: '+2 max Hearts, +35% healing chance, and +15% healing cap.',
      shortDescription: '+2 Hearts + 35% healing',
      flavorText: 'Radiant sanctuary forged from unbroken poise.',
      icon: 'lorc/angel-outfit',
      specialEffect: 'healing',
      effects: { maxHealth: 2, health: 2, healingChance: 35 },
      capIncrease: { type: 'healing', amount: 15 },
      maxCount: 1,
    },
    burst: { heal: 2, damage: 4 },
    burstText: 'Restores 2 Hearts and deals 4 damage',
    gearRequirementText: 'Mending Charm + Life Vessel families',
    primeRequirementText: 'Reach a 3-Set streak without mistakes',
    mysteryHint: "Orange Tabby's vitality pair awakened by a 3-Set streak.",
    unlockHint: 'Earn ★★ on 1-7 Ticking Clock',
    hasGear: ws => hasAnyId(ws, HEAL_IDS) && hasAnyId(ws, LIFE_IDS),
    primeProgress: ctx => {
      const cur = Math.min(3, ctx.roundStats.maxStreak);
      return { current: cur, target: 3, label: `${cur}/3 streak` };
    },
  },
  {
    id: 'vengeance-dynamo',
    result: {
      id: 'evo-vengeance-dynamo',
      name: 'Vengeance Dynamo',
      rarity: 'legendary',
      level: 4,
      price: 60,
      description: '+35% grace gain chance, +25% laser chance, and +10% grace cap.',
      shortDescription: '35% grace + 25% laser',
      flavorText: 'Turns stubborn second chances into searing counter-fire.',
      icon: 'lorc/lightning-helix',
      specialEffect: 'laser',
      effects: { graceGainChance: 35, laserChance: 25 },
      capIncrease: { type: 'graceGain', amount: 10 },
      maxCount: 1,
    },
    burst: { graces: 2, damage: 5 },
    burstText: '+2 Graces and 5 damage',
    gearRequirementText: 'Second Chance + Fortune Token families',
    primeRequirementText: 'Make 3 Sets in this fight',
    mysteryHint: "Badger's lucky charms charged across three Sets.",
    unlockHint: 'Earn ★★★ on 2-4 Near Miss',
    hasGear: ws => hasAnyId(ws, GRACE_CAP_IDS) && hasAnyId(ws, GRACE_GAIN_IDS),
    primeProgress: ctx => {
      const cur = Math.min(3, ctx.matches);
      return { current: cur, target: 3, label: `${cur}/3 Sets` };
    },
  },
  {
    id: 'world-tree',
    result: {
      id: 'evo-world-tree',
      name: 'World Tree Seed',
      rarity: 'legendary',
      level: 4,
      price: 60,
      description: '+45% board growth chance, +20% healing chance, and +10% growth cap.',
      shortDescription: '45% growth + 20% heal',
      flavorText: 'Roots spread beneath the grid, sprouting fresh Sets endlessly.',
      icon: 'lorc/flowers',
      specialEffect: 'boardGrowth',
      effects: { boardGrowthChance: 45, boardGrowthAmount: 2, healingChance: 20 },
      capIncrease: { type: 'boardGrowth', amount: 10 },
      maxCount: 1,
    },
    burst: { growBoard: 3, heal: 1, damage: 4 },
    burstText: 'Grows board by +3 cards, heals 1 Heart & deals 4 damage',
    gearRequirementText: 'Growth Seed + Field Stone families',
    primeRequirementText: 'Trigger an Escalating Purity Chain (2+ step)',
    mysteryHint: "Corgi's field and seed awakened by an escalating Purity combo.",
    unlockHint: 'Earn ★★★ on 2-2 Junk Drawer',
    hasGear: ws => hasAnyId(ws, GROWTH_IDS) && hasAnyId(ws, FIELD_IDS),
    primeProgress: ctx => {
      const cur = ctx.maxPurityChain >= 2 ? 1 : 0;
      return { current: cur, target: 1, label: cur >= 1 ? 'Purity Chain ✓' : '0/1 Purity Chain' };
    },
  },
  {
    id: 'astral-omniscience',
    result: {
      id: 'evo-astral-omniscience',
      name: 'Astral Omniscience',
      rarity: 'legendary',
      level: 4,
      price: 60,
      description: '+60% auto-hint chance, +35% hint gain chance, and +10% hint cap.',
      shortDescription: '60% auto-hint + 35% hint gain',
      flavorText: 'Every hidden pattern on the board illuminates at once.',
      icon: 'lorc/third-eye',
      specialEffect: 'autoHint',
      effects: { autoHintChance: 60, hintGainChance: 35, enhancedHintChance: 35 },
      capIncrease: { type: 'hint', amount: 10 },
      maxCount: 1,
    },
    burst: { hints: 2, damage: 6 },
    burstText: '+2 Hints and 6 damage',
    gearRequirementText: 'Any 2 Vision or Hint weapons (Oracle Eye, Seeker Lens, Crystal Orb)',
    primeRequirementText: 'Make 3 Sets without pressing the manual Hint button',
    mysteryHint: 'Carry twin eyes of foresight and prove your own sight across 3 Sets.',
    unlockHint: 'Earn ★★★ on 3-5 Color Me Gone',
    hasGear: ws => countMatchingWeapons(ws, VISION_IDS) >= 2,
    primeProgress: ctx => {
      if (ctx.roundStats.hintsUsed > 0) {
        return { current: 0, target: 3, label: 'Hint used (locked)' };
      }
      const cur = Math.min(3, ctx.matches);
      return { current: cur, target: 3, label: `${cur}/3 unaided Sets` };
    },
  },
];

export const getEvolutionRecipe = (id: string): EvolutionRecipe => {
  const r = EVOLUTION_RECIPES.find(x => x.id === id);
  if (!r) throw new Error(`Unknown evolution recipe: ${id}`);
  return r;
};

export const findEvolvedWeapon = (weaponId: string): Weapon | undefined =>
  EVOLUTION_RECIPES.find(r => r.result.id === weaponId)?.result;

/**
 * Find the highest-priority recipe whose gear is owned and not yet forged this run,
 * returning both the recipe and its current priming progress.
 */
export const getActiveEvolutionStatus = (
  weapons: Weapon[],
  evolvedRecipes: string[],
  ctx: EvolutionCheckContext,
  unlockedRecipes?: string[]
): { recipe: EvolutionRecipe; progress: EvolutionPrimeProgress; ready: boolean } | null => {
  const candidates = EVOLUTION_RECIPES.filter(
    r =>
      (!unlockedRecipes || unlockedRecipes.includes(r.id)) &&
      !evolvedRecipes.includes(r.id) &&
      r.hasGear(weapons)
  );
  if (candidates.length === 0) return null;
  // Prefer a recipe that is ALREADY ready if multiple match!
  for (const r of candidates) {
    const progress = r.primeProgress(ctx);
    if (progress.current >= progress.target) return { recipe: r, progress, ready: true };
  }
  const first = candidates[0];
  const progress = first.primeProgress(ctx);
  return { recipe: first, progress, ready: progress.current >= progress.target };
};
