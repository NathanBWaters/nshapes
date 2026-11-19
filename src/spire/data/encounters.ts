/**
 * Starfall Spire — starter kits, Act themes, and encounter generator.
 *
 * ZERO duplicate enemy, weapon, taunt, parry, or hazard specs:
 * - Weapon pool is re-exported directly from Adventure's `ALL_ARMORY_WEAPON_IDS`.
 * - Act themes pull biome names straight from Adventure's `BIOMES`.
 * - Every encounter draws its enemy, taunt, board hazards, and telegraphed
 *   Set-Parry directly from Adventure's canonical `LEVELS` + `resolveParrySpec`,
 *   scaling only HP, clock, Ascension speed, and Spire loot rewards.
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

/** Every valid Armory weapon id shared between Adventure Mode and Starfall Spire. */
export const SPIRE_WEAPON_POOL: readonly string[] = ALL_ARMORY_WEAPON_IDS;

/** Every fighter brings a thematic starter charm & crisp opening kit to the Spire. */
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
    starterWeapon: 'rally-horn',
    bonusWeapon: 'flint-spark',
    maxHearts: 5,
    startingCoins: 70,
    startingHints: 2,
    startingGraces: 1,
    tagline: 'Blistering combo speed with opening fire & rhythm bursts.',
  },
  Corgi: {
    fighter: 'Corgi',
    starterWeapon: 'field-stone',
    bonusWeapon: 'growth-seed',
    maxHearts: 6,
    startingCoins: 75,
    startingHints: 2,
    startingGraces: 1,
    tagline: 'Wide boards, Fetch power cards, and clean Zoomies sweeps.',
  },
  Badger: {
    fighter: 'Badger',
    starterWeapon: 'second-chance',
    bonusWeapon: 'prismatic-ray',
    maxHearts: 6,
    startingCoins: 65,
    startingHints: 2,
    startingGraces: 2,
    tagline: 'Starts armed for Judgement Beam — turns graces & grudges into lasers.',
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
    bonusWeapon: 'cascade-core',
    maxHearts: 6,
    startingCoins: 75,
    startingHints: 3,
    startingGraces: 1,
    tagline: 'Starts armed for Wildfire Echo — free Big Scoops and blazing echo chains.',
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
 * Every enemy name, taunt, board hazard, and Set-Parry Counter comes directly
 * from Adventure's shared `LEVELS` + `resolveParrySpec` — zero custom copies.
 */
const ACT_LEVEL_POOLS: Record<1 | 2 | 3, Record<'skirmish' | 'elite' | 'boss', readonly string[]>> = {
  1: {
    skirmish: ['2-1', '2-4', '2-5', '2-6', '2-7', '1-7'],
    elite: ['1-10', '2-10', '3-7'],
    boss: ['1-10', '2-10'],
  },
  2: {
    skirmish: ['3-2', '3-8', '3-9', '3-5P', '3-3', '3-4'],
    elite: ['3-3E', '3-3E2', '4-8'],
    boss: ['3-10', '4-5E'],
  },
  3: {
    skirmish: ['4-9', '4-10', '3-8E', '4-7E', '5-4'],
    elite: ['4-2E', '4-7E2', '5-3'],
    boss: ['4-11', '5-2', '5-5'],
  },
};

/**
 * Calibrated base HP curve per Act and row (row 0..5 = floors, row 6 = Boss).
 * Accounts for NShapes' real Power ×N snowball (1–2 weapons in Act 1 → 4–6+
 * weapons + Evolutions + Skill Nodes + Shading Surge in Act 3 → Endless!).
 */
const BASE_ACT_HP: Record<number, { start: number; end: number; eliteMult: number; boss: number; timer: number }> = {
  1: { start: 320, end: 1200, eliteMult: 1.32, boss: 2050, timer: 104 },
  2: { start: 2250, end: 7400, eliteMult: 1.38, boss: 12200, timer: 116 },
  3: { start: 13000, end: 35000, eliteMult: 1.42, boss: 60000, timer: 126 },
};

const actCurve = (act: number) => {
  if (act <= 3) return BASE_ACT_HP[act] ?? BASE_ACT_HP[3];
  const endlessStep = act - 3;
  const scale = Math.pow(3.4, endlessStep);
  return {
    start: Math.round(BASE_ACT_HP[3].end * 0.95 * scale),
    end: Math.round(BASE_ACT_HP[3].boss * 1.25 * scale),
    eliteMult: 1.48,
    boss: Math.round(BASE_ACT_HP[3].boss * 2.0 * scale),
    timer: Math.max(85, 118 - endlessStep * 6),
  };
};

export const generateSpireEncounter = (o: {
  act: number;
  row: number;
  kind: 'skirmish' | 'elite' | 'boss';
  ascension: number;
  rng: Rng;
  id: string;
}): SpireEncounter => {
  const { act, row, kind, ascension, rng, id } = o;
  const theme = actThemeFor(act);
  const asc = ascensionModifiers(ascension);
  const curve = actCurve(act);

  const actBucket: 1 | 2 | 3 = act <= 1 ? 1 : act === 2 ? 2 : 3;
  const srcLevel = getLevel(rng.pick(ACT_LEVEL_POOLS[actBucket][kind]));
  const srcFoe = srcLevel.foes[0];
  const srcParry = resolveParrySpec(srcLevel, srcFoe);

  const rowFrac = Math.max(0, Math.min(1, row / 5));
  let baseHp =
    kind === 'boss'
      ? curve.boss
      : Math.round((curve.start + (curve.end - curve.start) * rowFrac) * (kind === 'elite' ? curve.eliteMult : 1));
  baseHp = Math.round(baseHp * asc.foeHpScale * (kind === 'skirmish' ? 1 : asc.bossHpScale));

  const timerBase = kind === 'boss' ? curve.timer + 20 : kind === 'elite' ? curve.timer + 10 : curve.timer;
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
      ? 95 + act * 30
      : kind === 'elite'
        ? 65 + act * 22
        : 36 + act * 14 + row * 4;

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

/** Helper to check if a weapon belongs to a given role shelf (useful for Spire draft diversity). */
export const spireRoleLabel = (weaponId: string): string => {
  const role = weaponRole(weaponId);
  return WEAPON_ROLES.find(r => r.id === role)?.label ?? 'Damage';
};
