/**
 * Starfall Summit — starter kits, Act themes, and encounter generator.
 *
 * ZERO duplicate enemy, weapon, taunt, parry, or hazard specs:
 * - Weapon pool is re-exported directly from Adventure's `ALL_ARMORY_WEAPON_IDS`.
 * - Act themes pull biome names straight from Adventure's `BIOMES`.
 * - Every encounter draws its enemy, taunt, board hazards, and telegraphed
 *   Set-Parry directly from Adventure's canonical `LEVELS` + `resolveParrySpec`,
 *   scaling only HP, clock, Ascension speed, and Summit loot rewards.
 *
 * HP curves are empirically validated via `__tests__/spireBalance.test.ts`.
 */
import type { CharacterName } from '@/types';
import type { BiomeId, LevelHazards, ParryRequirement, ParrySpec } from '@/adventure/types';
import { getBiome } from '@/adventure/data/biomes';
import { getLevel } from '@/adventure/data/levels';
import { PARRY_RULES, resolveParrySpec } from '@/adventure/data/parry';
import { WEAPON_ROLES, weaponRole } from '@/adventure/data/weaponRoles';
import { ALL_ARMORY_WEAPON_IDS } from '@/adventure/data/armory';
import type { Rng } from '@/adventure/engine/rng';
import type { SpireEncounter } from '../types';
import { ascensionModifiers } from './ascensions';

/** Every valid Armory weapon id shared between Adventure Mode and Starfall Summit. */
export const SPIRE_WEAPON_POOL: readonly string[] = ALL_ARMORY_WEAPON_IDS;

/** Every fighter brings a thematic starter charm & crisp opening kit to Starfall Summit. */
export interface FighterStarterKit {
  fighter: CharacterName;
  starterWeapon: string;
  bonusWeapon: string;
  maxHearts: number;
  startingCoins: number;
  startingHints: number;
  startingGraces: number;
  tagline: string;
}

export const STARTER_KITS: Record<CharacterName, FighterStarterKit> = {
  'Orange Tabby': {
    fighter: 'Orange Tabby',
    starterWeapon: 'blast-powder',
    bonusWeapon: 'mending-charm',
    maxHearts: 6,
    startingCoins: 65,
    startingHints: 2,
    startingGraces: 1,
    tagline: 'Starts armed for Phoenix Pyre — brawls hard and heals through blasts.',
  },
  'Sly Fox': {
    fighter: 'Sly Fox',
    starterWeapon: 'snowball',
    bonusWeapon: 'war-drum',
    maxHearts: 5,
    startingCoins: 70,
    startingHints: 2,
    startingGraces: 1,
    tagline: 'Starts armed for Avalanche — blistering combos that ramp Snowball & War Drum bursts.',
  },
  Corgi: {
    fighter: 'Corgi',
    starterWeapon: 'growth-seed',
    bonusWeapon: 'chaos-shard',
    maxHearts: 6,
    startingCoins: 75,
    startingHints: 2,
    startingGraces: 1,
    tagline: 'Starts armed for Shard Garden — expands the board with Fetch Power cards and ricochet storms.',
  },
  Badger: {
    fighter: 'Badger',
    starterWeapon: 'prismatic-ray',
    bonusWeapon: 'life-vessel',
    maxHearts: 6,
    startingCoins: 65,
    startingHints: 2,
    startingGraces: 1,
    tagline: 'Starts armed for Bloodline — massive Heart pool, Grudge retaliation, and cross-board lasers.',
  },
  'Emperor Penguin': {
    fighter: 'Emperor Penguin',
    starterWeapon: 'rainbow-charm',
    bonusWeapon: 'catalyst-prism',
    maxHearts: 5,
    startingCoins: 70,
    startingHints: 2,
    startingGraces: 1,
    tagline: 'Starts armed for Rainbow Nova — ×2 Rainbow hits, Deep Freeze locks, and rapid Catalysts.',
  },
  Pelican: {
    fighter: 'Pelican',
    starterWeapon: 'echo-stone',
    bonusWeapon: 'flint-spark',
    maxHearts: 6,
    startingCoins: 75,
    startingHints: 3,
    startingGraces: 1,
    tagline: 'Starts armed for Wildfire Echo — free Big Scoops, blazing fire spreads, and echo chains.',
  },
};

export interface ActTheme {
  title: string;
  subtitle: string;
  biome: BiomeId;
}

export const actThemeFor = (act: number): ActTheme => {
  if (act === 1) {
    return {
      title: `Act I · ${getBiome('woods').name}`,
      subtitle: 'Warm up your engine and forge your first Evolution.',
      biome: 'woods',
    };
  }
  if (act === 2) {
    return {
      title: `Act II · ${getBiome('canyon').name}`,
      subtitle: 'Counter-Parries intensify and builds catch fire.',
      biome: 'canyon',
    };
  }
  if (act === 3) {
    return {
      title: `Act III · ${getBiome('summit').name}`,
      subtitle: 'Shading Surge & Summit Titans stand at the peak.',
      biome: 'summit',
    };
  }
  const endlessBiomes: BiomeId[] = ['peaks', 'canyon', 'summit'];
  const biome = endlessBiomes[(act - 4) % endlessBiomes.length];
  return {
    title: `Endless Act ${act} · ${getBiome(biome).name}`,
    subtitle: 'Infinite Starfall scaling — push your build past all limits!',
    biome,
  };
};

/**
 * Canonical Adventure `LEVELS` IDs drawn for each Act & encounter tier.
 * Strictly non-overlapping across tiers within each Act AND across Acts 1–3
 * (53 unique levels / 53 unique canonical enemies). Every enemy name, taunt,
 * board hazard, and Set-Parry Counter comes directly from Adventure's shared
 * `LEVELS` + `resolveParrySpec` — zero custom copies.
 */
export const ACT_LEVEL_POOLS: Record<1 | 2 | 3, Record<'skirmish' | 'elite' | 'boss', readonly string[]>> = {
  1: {
    skirmish: ['1-7', '1-8', '1-9', '1-5F', '2-1', '2-2', '2-3', '2-4', '2-5', '2-6', '2-7', '2-8', '2-9'],
    elite: ['2-5C', '2-8B', '2-9P', '3-7'],
    boss: ['1-10', '2-10'],
  },
  2: {
    skirmish: ['3-1', '3-2', '3-3', '3-4', '3-5', '3-5P', '3-6', '3-8', '3-9'],
    elite: ['3-3E', '3-3E2', '3-8E', '4-8'],
    boss: ['3-10', '4-5E'],
  },
  3: {
    skirmish: ['4-1', '4-2', '4-3', '4-4', '4-5', '4-6', '4-7', '4-9', '4-10', '5-4'],
    elite: ['4-2E', '4-2E2', '4-7E', '4-7E2', '5-3'],
    boss: ['4-11', '5-1', '5-2', '5-5'],
  },
};

const ALL_POOL_LEVEL_IDS: readonly string[] = [
  ...ACT_LEVEL_POOLS[1].skirmish,
  ...ACT_LEVEL_POOLS[1].elite,
  ...ACT_LEVEL_POOLS[1].boss,
  ...ACT_LEVEL_POOLS[2].skirmish,
  ...ACT_LEVEL_POOLS[2].elite,
  ...ACT_LEVEL_POOLS[2].boss,
  ...ACT_LEVEL_POOLS[3].skirmish,
  ...ACT_LEVEL_POOLS[3].elite,
  ...ACT_LEVEL_POOLS[3].boss,
];

/** Canonical enemy display name for a given Adventure level id. */
export const canonicalLevelEnemyName = (levelId: string): string => {
  const srcLevel = getLevel(levelId);
  const srcFoe = srcLevel.foes[0];
  return srcFoe.enemy ?? srcFoe.name ?? srcLevel.name;
};

/**
 * Calibrated base HP curve per Act and row (row 0..5 = floors, row 6 = Boss).
 * Tuned for pure item-driven scaling (`powerScaling: 0`): damage climbs from
 * upgraded weapons (Lv 2→5), board procs, stacking Evolutions (×1.5 per active
 * Evolution), Fighter Skill Tree nodes, Arcana wildcards, Set-Parries, and
 * Shading Surge (×5 in Act 3).
 */
const BASE_ACT_HP: Record<number, { start: number; end: number; eliteMult: number; boss: number; timer: number; skirmishTimer: number }> = {
  1: { start: 108, end: 320, eliteMult: 1.48, boss: 720, timer: 100, skirmishTimer: 72 },
  2: { start: 720, end: 1780, eliteMult: 1.44, boss: 3350, timer: 110, skirmishTimer: 94 },
  3: { start: 4400, end: 9500, eliteMult: 1.5, boss: 18500, timer: 112, skirmishTimer: 106 },
};

const actCurve = (act: number) => {
  if (act <= 3) return BASE_ACT_HP[act] ?? BASE_ACT_HP[3];
  const endlessStep = act - 3;
  const scale = Math.pow(1.65, endlessStep);
  return {
    start: Math.round(BASE_ACT_HP[3].end * 0.9 * scale),
    end: Math.round(BASE_ACT_HP[3].boss * 1.12 * scale),
    eliteMult: 1.4,
    boss: Math.round(BASE_ACT_HP[3].boss * 1.48 * scale),
    timer: Math.max(85, 118 - endlessStep * 5),
    skirmishTimer: Math.max(80, 112 - endlessStep * 5),
  };
};

export const generateSpireEncounter = (o: {
  act: number;
  row: number;
  kind: 'skirmish' | 'elite' | 'boss';
  ascension: number;
  rng: Rng;
  id: string;
  excludeEnemies?: ReadonlySet<string>;
  mustExcludeEnemies?: ReadonlySet<string>;
}): SpireEncounter => {
  const { act, row, kind, ascension, rng, id, excludeEnemies, mustExcludeEnemies } = o;
  const theme = actThemeFor(act);
  const asc = ascensionModifiers(ascension);
  const curve = actCurve(act);

  const actBucket: 1 | 2 | 3 = act <= 1 ? 1 : act === 2 ? 2 : 3;
  const primaryPool = ACT_LEVEL_POOLS[actBucket][kind];
  const notExcluded = (pool: readonly string[], excluded?: ReadonlySet<string>) =>
    excluded && excluded.size > 0
      ? pool.filter(lvlId => !excluded.has(canonicalLevelEnemyName(lvlId)))
      : [...pool];

  let candidates = notExcluded(primaryPool, excludeEnemies);
  if (candidates.length === 0 && excludeEnemies && excludeEnemies.size > 0) {
    // Fallback 1 (e.g. Endless Act 4+): unseen encounters of the same tier from other Acts
    const sameKindAllActs = [
      ...ACT_LEVEL_POOLS[1][kind],
      ...ACT_LEVEL_POOLS[2][kind],
      ...ACT_LEVEL_POOLS[3][kind],
    ];
    candidates = notExcluded(sameKindAllActs, excludeEnemies);
  }
  if (candidates.length === 0 && excludeEnemies && excludeEnemies.size > 0) {
    // Fallback 2 (deep Endless Act 5+): ANY unseen encounter across all pools before allowing a repeat
    candidates = notExcluded(ALL_POOL_LEVEL_IDS, excludeEnemies);
  }
  if (candidates.length === 0 && mustExcludeEnemies && mustExcludeEnemies.size > 0) {
    // Fallback 3 (ultra-deep Endless after all 53 unique enemies seen): still keep the current Act map duplicate-free
    candidates = notExcluded(primaryPool, mustExcludeEnemies);
    if (candidates.length === 0) {
      candidates = notExcluded(ALL_POOL_LEVEL_IDS, mustExcludeEnemies);
    }
  }
  const pickedLevelId = rng.pick(candidates.length > 0 ? candidates : primaryPool);
  const srcLevel = getLevel(pickedLevelId);
  const srcFoe = srcLevel.foes[0];
  const srcParry = resolveParrySpec(srcLevel, srcFoe);

  const rowFrac = Math.max(0, Math.min(1, row / 5));
  let baseHp =
    kind === 'boss'
      ? curve.boss
      : Math.round((curve.start + (curve.end - curve.start) * rowFrac) * (kind === 'elite' ? curve.eliteMult : 1));
  baseHp = Math.round(baseHp * asc.foeHpScale * (kind === 'skirmish' ? 1 : asc.bossHpScale));

  const timerBase =
    kind === 'boss'
      ? curve.timer + 20
      : kind === 'elite'
        ? curve.timer + 10
        : curve.skirmishTimer + (act === 1 ? row * 3 : 0);
  const timer = Math.max(60, Math.round(timerBase * asc.timerScale));

  // Early Act 1 Skirmishes default to timing-based parry unless Ascension 5+ or late Act 1
  const useDefaultTiming =
    act === 1 && kind === 'skirmish' && row <= 2 && !asc.earlySpecificCounters;
  const counter: ParryRequirement = useDefaultTiming
    ? { kind: 'any' }
    : (srcParry?.counter ?? { kind: 'any' });
  const baseCooldown = srcParry?.cooldownMs ?? (kind === 'boss' ? 12000 : kind === 'elite' ? 12500 : 13500);
  const baseWindup = srcParry?.windupMs ?? (counter.kind === 'any' ? 15000 : 15500);
  const parry: ParrySpec = {
    attackName: srcParry?.attackName ?? 'Wild Lunge',
    icon: srcParry?.icon ?? 'lorc/sword-clash',
    counter,
    cooldownMs: Math.max(8000, Math.round(baseCooldown * asc.parrySpeedScale)),
    windupMs: Math.max(10500, Math.round(baseWindup * asc.parrySpeedScale)),
    perfectWindowMs: srcParry?.perfectWindowMs ?? PARRY_RULES.perfectWindowMs,
    penalty: srcParry?.penalty === 'time' ? 'time' : 'heart',
  };

  let hazards: LevelHazards | undefined = srcLevel.rules.hazards ? { ...srcLevel.rules.hazards } : undefined;
  if (asc.extraHazards && kind !== 'skirmish' && !hazards) {
    hazards = { timeBombs: { every: 11, seconds: 16 } };
  }

  const shadingSurge = act >= 3 || (act === 2 && kind === 'boss');

  const coinReward =
    kind === 'boss'
      ? 70 + act * 20
      : kind === 'elite'
        ? 52 + act * 16
        : 28 + act * 10 + row * 3;

  const difficulty = Math.min(
    5,
    Math.max(1, act + (kind === 'boss' ? 2 : kind === 'elite' ? 1 : row >= 4 ? 1 : 0))
  ) as 1 | 2 | 3 | 4 | 5;

  const foeName = srcFoe.enemy ?? srcFoe.name ?? srcLevel.name;

  return {
    id,
    name: foeName,
    kind,
    biome: theme.biome,
    foes: [{ ...srcFoe, hp: baseHp, parry }],
    timer,
    boardSize: act >= 2 || kind !== 'skirmish' ? 15 : 12,
    shadingSurge,
    ...(hazards ? { hazards } : {}),
    coinReward,
    difficulty,
    parry,
  };
};

/** Helper to check if a weapon belongs to a given role shelf (useful for Summit draft diversity). */
export const spireRoleLabel = (weaponId: string): string => {
  const role = weaponRole(weaponId);
  return WEAPON_ROLES.find(r => r.id === role)?.label ?? 'Damage';
};
