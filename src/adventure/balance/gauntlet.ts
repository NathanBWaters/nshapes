/**
 * 6-Encounter Multi-Difficulty Enemy Gauntlet Balance Bench.
 *
 * Tests all 64 Armory weapons, 6 Fighters, and 208 Evolutions against REAL
 * finite-HP enemies across 6 escalating combat tiers (reusing canonical
 * `getLevel`, `generateSpireEncounter`, `spireEncounterToLevel`, and
 * `spireRunOverrides` — ZERO duplicated foe specs!) under BOTH:
 *  - `BOTS.average` (Uniform pace `[0.6, 1.4]`, zero droughts)
 *  - `calibrated_human` (PostHog-calibrated Lognormal droughts + cognitive load)
 *
 * Smooth Encounter Clear Score:
 *   S_e = 0.50 * min(1.5, damageDealt / foeMaxHp)
 *       + 0.30 * winRate
 *       + 0.20 * (timeLeftShare + heartsLeftShare) / 2
 *
 * Pure TypeScript (zero React Native / fs dependencies) so CLI, unit tests,
 * and `powerRank.ts` share identical types and math.
 */
import type { CharacterName } from '@/types';
import {
  canonicalLevelEnemyName,
  generateSpireEncounter,
} from '@/spire/data/encounters';
import {
  SPIRE_FIGHT_FEATURES,
  spireEncounterToLevel,
  spireRunOverrides,
  spireRunToVirtualSave,
} from '@/spire/engine/bridge';
import { createSpireRun } from '@/spire/engine/runState';
import type { AdventureSave, LevelDef, RunState } from '../types';
import { ALL_ARMORY_WEAPON_IDS, getArmoryWeapon } from '../data/armory';
import { EVOLUTION_RECIPES } from '../data/evolutions';
import { FIGHTERS } from '../data/fighters';
import { getLevel } from '../data/levels';
import { isPowerEnabled, setPowerEnabled } from '../data/weaponPower';
import { weaponRole, type WeaponRole } from '../data/weaponRoles';
import { MAX_TUNING_TIER, weaponStatLines } from '../data/weaponStats';
import { BOTS, simulateRun, type BotProfile, type SimOptions } from '../engine/bot';
import { armableRecipes, buyTree } from '../engine/botBuilds';
import { createRng } from '../engine/rng';
import { createMaxedSave } from '../progress';
import { normalizeRecipePair } from './lab';
import { PARTNER_WEAPONS } from './targets';

// ─── Public Types ────────────────────────────────────────────────────────────

export type GauntletTierId = 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6';

export const GAUNTLET_TIER_IDS: readonly GauntletTierId[] = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'];
export const GAUNTLET_SPIRE_TIERS: readonly GauntletTierId[] = ['T3', 'T5'];
export const GAUNTLET_EVO_TIERS: readonly GauntletTierId[] = ['T3', 'T4', 'T5'];

export interface EncounterRunMetrics {
  clearScore: number;
  winRate: number;
  survivalRate: number;
  damageRatio: number;
  timeLeftShare: number;
  heartsLeftShare: number;
}

export interface TierCounterfactualResult {
  tierId: GauntletTierId;
  avgLift: number;
  humanLift: number;
  avgWinDelta: number;
  humanWinDelta: number;
  avgSurvDelta: number;
  humanSurvDelta: number;
}

export interface GauntletTierSpecSummary {
  id: GauntletTierId;
  name: string;
  mode: 'adventure' | 'spire';
  encounters: { id: string; enemy: string; hp: number; ascension?: number }[];
  weaponLevel: number;
  tuned: boolean;
  powerEnabled: boolean;
  fighterStars: number;
  baseBeltSize: number;
  weaponSeedsPerSub: number;
  fighterSeedsPerSub: number;
  evoSeedsPerSub: number;
}

export interface GauntletWeaponRow {
  id: string;
  name: string;
  role: WeaponRole;
  partner: boolean;
  /** Geometric mean clear-score lift across T1–T6 under BOTS.average */
  avgBotLift: number;
  /** Geometric mean clear-score lift across T1–T6 under calibrated_human */
  humanBotLift: number;
  /** Geometric mean clear-score lift across Starfall Summit tiers (T3 + T5) under BOTS.average */
  spireAvgLift: number;
  /** Geometric mean clear-score lift across Starfall Summit tiers (T3 + T5) under calibrated_human */
  spireHumanLift: number;
  /** Combined Spire lift: sqrt(spireAvgLift * spireHumanLift) */
  spireLift: number;
  /** 1.00x weakest-anchored multiplier under BOTS.average */
  avgMult: number;
  /** 1.00x weakest-anchored multiplier under calibrated_human */
  humanMult: number;
  /** 1.00x weakest-anchored multiplier on Starfall Summit tiers (T3 + T5) */
  spireMult: number;
  /** Relative Bot-vs-Human shift: humanMult / avgMult (>1 means stronger for real humans than uniform bot) */
  humanVsAvgRatio: number;
  avgWinDelta: number;
  humanWinDelta: number;
  avgSurvDelta: number;
  humanSurvDelta: number;
  byTier: Record<GauntletTierId, TierCounterfactualResult>;
}

export interface GauntletEvolutionRow {
  id: string;
  name: string;
  pair: [string, string];
  hasEncoreFix: boolean;
  avgBotLift: number;
  humanBotLift: number;
  spireAvgLift: number;
  spireHumanLift: number;
  spireLift: number;
  avgMult: number;
  humanMult: number;
  spireMult: number;
  humanVsAvgRatio: number;
  avgStartsPerFight: number;
  humanStartsPerFight: number;
  avgWinDelta: number;
  humanWinDelta: number;
  byTier: Partial<Record<GauntletTierId, TierCounterfactualResult>>;
}

export interface GauntletFighterRow {
  id: CharacterName;
  name: CharacterName;
  /** Geometric mean encounter clear score across T1–T6 under BOTS.average */
  avgBotScore: number;
  /** Geometric mean encounter clear score across T1–T6 under calibrated_human */
  humanBotScore: number;
  /** Geometric mean encounter clear score across Starfall Summit tiers (T3 + T5) */
  spireAvgScore: number;
  spireHumanScore: number;
  spireScore: number;
  avgMult: number;
  humanMult: number;
  spireMult: number;
  humanVsAvgRatio: number;
  avgWinRate: number;
  humanWinRate: number;
  avgSurvivalRate: number;
  humanSurvivalRate: number;
  byTier: Record<
    GauntletTierId,
    {
      avgScore: number;
      humanScore: number;
      avgWinRate: number;
      humanWinRate: number;
      avgSurvival: number;
      humanSurvival: number;
    }
  >;
}

export interface GauntletMover {
  category: 'weapons' | 'evolutions' | 'fighters';
  id: string;
  name: string;
  avgMult: number;
  humanMult: number;
  /** humanMult / avgMult (> 1 = human riser; < 1 = bot-favored faller) */
  humanVsAvgRatio: number;
  /** Log shift ln(humanMult / avgMult) */
  logShift: number;
  avgRank: number;
  humanRank: number;
  rankDelta: number;
}

export interface GauntletReport {
  generatedAt: string;
  durationMs: number;
  bots: {
    average: BotProfile;
    human: BotProfile;
  };
  encoreChassisLiftAvg: number;
  encoreChassisLiftHuman: number;
  tiers: GauntletTierSpecSummary[];
  weapons: GauntletWeaponRow[];
  evolutions: GauntletEvolutionRow[];
  fighters: GauntletFighterRow[];
  movers: {
    topHumanRisers: GauntletMover[];
    topHumanFallers: GauntletMover[];
  };
}

export interface GauntletOptions {
  /** Calibrated human `BotProfile` (defaults to a sensible Lognormal human profile if omitted). */
  humanBot?: BotProfile;
  /** Optional subsets for fast testing or targeted runs. */
  weaponIds?: readonly string[];
  evolutionIds?: readonly string[];
  fighterNames?: readonly CharacterName[];
  /** Scale seed counts (default `1` = full benchmark ~60–75s; pass `0.35` or explicit overrides for tests). */
  seedScale?: number;
  weaponSeedsOverride?: Partial<Record<GauntletTierId, number>>;
  fighterSeedsOverride?: Partial<Record<GauntletTierId, number>>;
  evoSeedsOverride?: Partial<Record<GauntletTierId, number>>;
  /** Optional progress callback for CLI logging. */
  onProgress?: (msg: string) => void;
}

// ─── Defaults & Helpers ──────────────────────────────────────────────────────

export const DEFAULT_CALIBRATED_HUMAN_BOT: BotProfile = {
  name: 'calibrated_human',
  secondsPerAttribute: 0.9,
  baseReactionSec: 0.8,
  findTimeSigma: 0.75,
  maxPaceMultiplier: 5.0,
  mistakeRate: 0.059,
  huntsRainbows: true,
  hintEagerness: 0.12,
  nearMissRate: 0.78,
  boldness: 0.18,
  perfectParryWaitChance: 0.06,
};

const PARTNER_SET = new Set<string>(PARTNER_WEAPONS);
const SCORE_FLOOR = 0.05;
const seedOf = (i: number, salt = 0): number => (1000 + i * 7919 + salt * 104729) >>> 0;
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const roundN = (x: number, digits = 4): number => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};
const mean = (xs: readonly number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const geoMean = (xs: readonly number[]): number => {
  if (!xs.length) return 1;
  let sum = 0;
  for (const x of xs) sum += Math.log(Math.max(1e-4, x));
  return Math.exp(sum / xs.length);
};
const median = (xs: readonly number[]): number => {
  if (!xs.length) return 1;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const withPower = <T,>(on: boolean, fn: () => T): T => {
  const prev = isPowerEnabled();
  setPowerEnabled(on);
  try {
    return fn();
  } finally {
    setPowerEnabled(prev);
  }
};

/**
 * Smooth Encounter Clear Score for a single completed fight:
 *   S_e = 0.50 * min(1.5, damageDealt / foeMaxHp)
 *       + 0.30 * winRate
 *       + 0.20 * (timeLeftShare + heartsLeftShare) / 2
 */
export const computeClearScore = (state: RunState, level: LevelDef): EncounterRunMetrics => {
  const foeMaxHp = Math.max(1, state.foeMaxHp);
  const damageRatio = Math.min(1.5, Math.max(0, state.totalDamage) / foeMaxHp);
  const winRate = state.status === 'won' && state.foeHp <= 0 ? 1 : 0;
  const survivalRate = state.endReason === 'hearts' ? 0 : 1;

  let timeLeftShare = 0;
  if (typeof level.rules.timer === 'number' && level.rules.timer > 0) {
    timeLeftShare = clamp((state.timeLeft ?? 0) / level.rules.timer, 0, 1);
  } else if (typeof level.rules.moves === 'number' && level.rules.moves > 0) {
    timeLeftShare = clamp((state.movesLeft ?? 0) / level.rules.moves, 0, 1);
  }

  const heartsLeftShare =
    state.maxHearts !== null && state.maxHearts > 0
      ? clamp((state.hearts ?? 0) / state.maxHearts, 0, 1)
      : 1;

  const clearScore = 0.5 * damageRatio + 0.3 * winRate + 0.2 * ((timeLeftShare + heartsLeftShare) / 2);
  return {
    clearScore,
    winRate,
    survivalRate,
    damageRatio,
    timeLeftShare,
    heartsLeftShare,
  };
};

// ─── Canonical Encounter & Tier Construction ─────────────────────────────────

interface SubEncounterContext {
  id: string;
  tierId: GauntletTierId;
  mode: 'adventure' | 'spire';
  enemyName: string;
  ascension?: number;
  level: LevelDef;
  powerEnabled: boolean;
  /** Build save + SimOptions for a given fighter, weapon belt, unlocked evolutions, and overrides. */
  buildRun: (params: {
    fighter: CharacterName;
    weapons: readonly string[];
    skillNodes: readonly string[];
    unlockedEvolutions: readonly string[];
    blankEvolutionRules?: boolean;
    extraEvoBonus?: boolean;
  }) => { level: LevelDef; save: AdventureSave; opts: SimOptions };
}

interface TierSpec {
  id: GauntletTierId;
  name: string;
  mode: 'adventure' | 'spire';
  weaponLevel: number;
  tuned: boolean;
  powerEnabled: boolean;
  fighterStars: number;
  /** Default base belt without candidate weapon (slot 0 is always a real non-partner weapon; T2-T6 arm an evolution). */
  baseBelt: readonly string[];
  /** Fallback non-partner replacements used when the candidate weapon is already inside `baseBelt`. */
  backupWeapons: readonly string[];
  /** Neutral belt used for fighter comparisons across T1-T6. */
  fighterBelt: readonly string[];
  weaponSeedsPerSub: number;
  fighterSeedsPerSub: number;
  evoSeedsPerSub: number;
  subEncounters: SubEncounterContext[];
}

const gearCache = new Map<string, Pick<AdventureSave, 'armory' | 'stars' | 'completedBounties' | 'legacyWeaponTiers' | 'weaponTuning'>>();

const getGearFields = (lv: number, tuned: boolean) => {
  const key = `${lv}:${tuned ? 1 : 0}`;
  const hit = gearCache.get(key);
  if (hit) return hit;
  const armory = [...ALL_ARMORY_WEAPON_IDS];
  const fields: Pick<AdventureSave, 'armory' | 'stars' | 'completedBounties' | 'legacyWeaponTiers' | 'weaponTuning'> = {
    armory,
    stars: {},
    completedBounties: [],
    legacyWeaponTiers: Object.fromEntries(armory.map(id => [id, Math.max(0, lv - 1)])),
    weaponTuning: tuned
      ? Object.fromEntries(
          armory.map(id => {
            const lines = weaponStatLines(getArmoryWeapon(id)!, { level: lv, tuning: {} });
            return [id, Object.fromEntries(lines.filter(l => l.tunable).map(l => [l.key, MAX_TUNING_TIER]))];
          })
        )
      : {},
  };
  gearCache.set(key, fields);
  return fields;
};

let baseMaxedTemplate: AdventureSave | null = null;
const getBaseMaxed = (): AdventureSave => {
  if (!baseMaxedTemplate) baseMaxedTemplate = createMaxedSave();
  return baseMaxedTemplate;
};

const skillTreeCache = new Map<string, readonly string[]>();
const getFighterSkillNodes = (fighter: CharacterName, stars: number): readonly string[] => {
  if (stars <= 0) return [];
  const key = `${fighter}:${stars}`;
  const hit = skillTreeCache.get(key);
  if (hit) return hit;
  const nodes = buyTree(fighter, stars, 'plan', createRng(77 + stars * 13));
  skillTreeCache.set(key, nodes);
  return nodes;
};

const makeAdvSubEncounter = (
  tierId: GauntletTierId,
  levelId: string,
  weaponLevel: number,
  tuned: boolean,
  powerEnabled: boolean,
  upgrades: Record<string, number>
): SubEncounterContext => {
  const level = getLevel(levelId);
  const foe = level.foes[0];
  const enemyName = foe.enemy ?? foe.name ?? level.name;
  const gear = getGearFields(weaponLevel, tuned);
  const template = getBaseMaxed();

  return {
    id: levelId,
    tierId,
    mode: 'adventure',
    enemyName,
    level,
    powerEnabled,
    buildRun: ({ fighter, weapons, skillNodes, unlockedEvolutions, blankEvolutionRules, extraEvoBonus }) => {
      const effUpgrades = extraEvoBonus
        ? { charm_belt: 3, ...upgrades, evolution_lab: Math.max(upgrades.evolution_lab ?? 0, 3) }
        : { charm_belt: 3, ...upgrades };
      const save: AdventureSave = {
        ...template,
        ...gear,
        selectedFighter: fighter,
        unlockedFighters: [fighter],
        upgrades: effUpgrades,
        skillNodes: skillNodes.length > 0 ? { [fighter]: [...skillNodes] } : {},
        charms: [...weapons],
        unlockedEvolutions: [...unlockedEvolutions],
        equippedArcana: [],
      };
      const opts: SimOptions = {
        skipPicks: true,
        ...(blankEvolutionRules ? { overrides: { blankEvolutionRules: true } } : {}),
      };
      return { level, save, opts };
    },
  };
};

const makeSpireSubEncounter = (params: {
  id: string;
  tierId: GauntletTierId;
  act: number;
  ascension: number;
  weaponLevel: number;
  excludeLevelIds: readonly string[];
  upgrades: Record<string, number>;
}): SubEncounterContext => {
  const { id, tierId, act, ascension, weaponLevel, excludeLevelIds, upgrades } = params;
  const enc = generateSpireEncounter({
    act,
    row: 6,
    kind: 'boss',
    ascension,
    rng: createRng(101 + act * 17 + ascension * 31),
    id,
    excludeEnemies: new Set(excludeLevelIds.map(canonicalLevelEnemyName)),
  });
  // Sample level for metadata display
  const refRun = createSpireRun('Orange Tabby', ascension, 101);
  const sampleLevel = spireEncounterToLevel({ ...refRun, act, floor: act * 7 }, enc);

  return {
    id,
    tierId,
    mode: 'spire',
    enemyName: enc.name,
    ascension,
    level: sampleLevel,
    powerEnabled: false,
    buildRun: ({ fighter, weapons, skillNodes, unlockedEvolutions, blankEvolutionRules, extraEvoBonus }) => {
      const baseRun = createSpireRun(fighter, ascension, 101 + act * 7);
      const run = {
        ...baseRun,
        act,
        floor: act * 7,
        weapons: [...weapons],
        weaponLevels: Object.fromEntries(weapons.map(w => [w, weaponLevel])),
        skillNodes: [...skillNodes],
        upgrades: extraEvoBonus
          ? { ...upgrades, evolution_lab: Math.max(upgrades.evolution_lab ?? 1, 2) }
          : { ...upgrades },
        extraEvolutionLikelihood: extraEvoBonus ? 12 : baseRun.extraEvolutionLikelihood,
      };
      const level = spireEncounterToLevel(run, enc);
      const save: AdventureSave = {
        ...spireRunToVirtualSave(run),
        unlockedEvolutions: [...unlockedEvolutions],
      };
      const overrides = {
        ...spireRunOverrides(run),
        ...(blankEvolutionRules ? { blankEvolutionRules: true } : {}),
      };
      const opts: SimOptions = {
        skipPicks: true,
        features: new Set(SPIRE_FIGHT_FEATURES),
        overrides,
      };
      return { level, save, opts };
    },
  };
};

const scaleSeeds = (n: number, scale: number, override?: number): number => {
  if (override !== undefined) return Math.max(1, Math.round(override));
  return Math.max(1, Math.round(n * scale));
};

const buildGauntletTiers = (opts: GauntletOptions): TierSpec[] => {
  const s = opts.seedScale ?? 1;
  const wOv = opts.weaponSeedsOverride ?? {};
  const fOv = opts.fighterSeedsOverride ?? {};
  const eOv = opts.evoSeedsOverride ?? {};

  return [
    {
      id: 'T1',
      name: 'Warmup (Adv 1-10 Iron Shell)',
      mode: 'adventure',
      weaponLevel: 2,
      tuned: false,
      powerEnabled: false,
      fighterStars: 15,
      baseBelt: ['flint-spark', 'mending-charm'],
      backupWeapons: ['war-drum', 'echo-stone'],
      fighterBelt: ['flint-spark', 'mending-charm'],
      weaponSeedsPerSub: scaleSeeds(4, s, wOv.T1),
      fighterSeedsPerSub: scaleSeeds(5, s, fOv.T1),
      evoSeedsPerSub: scaleSeeds(0, s, eOv.T1),
      subEncounters: [
        makeAdvSubEncounter('T1', '1-10', 2, false, false, { heavy_hitter: 1, evolution_lab: 1 }),
      ],
    },
    {
      id: 'T2',
      name: 'Board Disruption (Adv 2-5 Greedy Squirrel & 2-6 Junk Rat)',
      mode: 'adventure',
      weaponLevel: 2,
      tuned: false,
      powerEnabled: false,
      fighterStars: 32,
      baseBelt: ['blast-powder', 'mending-charm'],
      backupWeapons: ['flint-spark', 'echo-stone'],
      fighterBelt: ['blast-powder', 'mending-charm', 'flint-spark'],
      weaponSeedsPerSub: scaleSeeds(2, s, wOv.T2),
      fighterSeedsPerSub: scaleSeeds(4, s, fOv.T2),
      evoSeedsPerSub: scaleSeeds(0, s, eOv.T2),
      subEncounters: [
        makeAdvSubEncounter('T2', '2-5', 2, false, false, { heavy_hitter: 2, evolution_lab: 1 }),
        makeAdvSubEncounter('T2', '2-6', 3, false, false, { heavy_hitter: 2, evolution_lab: 1 }),
      ],
    },
    {
      id: 'T3',
      name: 'Clock & Drought Squeeze (Spire Act 2 Boss: Charging Boar A0)',
      mode: 'spire',
      weaponLevel: 3,
      tuned: false,
      powerEnabled: false,
      fighterStars: 55,
      baseBelt: ['flint-spark', 'mending-charm', 'echo-stone'],
      backupWeapons: ['blast-powder', 'war-drum', 'rally-horn'],
      fighterBelt: ['flint-spark', 'mending-charm', 'echo-stone'],
      weaponSeedsPerSub: scaleSeeds(3, s, wOv.T3),
      fighterSeedsPerSub: scaleSeeds(5, s, fOv.T3),
      evoSeedsPerSub: scaleSeeds(2, s, eOv.T3),
      subEncounters: [
        makeSpireSubEncounter({
          id: 'spire-a2-boar-a0',
          tierId: 'T3',
          act: 2,
          ascension: 0,
          weaponLevel: 3,
          excludeLevelIds: ['4-5E'],
          upgrades: { evolution_lab: 1, heavy_hitter: 1 },
        }),
      ],
    },
    {
      id: 'T4',
      name: 'Attrition & Hazard Barrage (Adv 4-6 Ticking Viper & 4-10 Feral Fangs)',
      mode: 'adventure',
      weaponLevel: 4,
      tuned: false,
      powerEnabled: true,
      fighterStars: 95,
      baseBelt: ['blast-powder', 'mending-charm', 'flint-spark', 'echo-stone'],
      backupWeapons: ['war-drum', 'rally-horn', 'time-drop', 'catalyst-prism'],
      fighterBelt: ['blast-powder', 'mending-charm', 'flint-spark', 'echo-stone'],
      weaponSeedsPerSub: scaleSeeds(2, s, wOv.T4),
      fighterSeedsPerSub: scaleSeeds(3, s, fOv.T4),
      evoSeedsPerSub: scaleSeeds(1, s, eOv.T4),
      subEncounters: [
        makeAdvSubEncounter('T4', '4-6', 4, false, true, { heavy_hitter: 3, evolution_lab: 2, hourglass: 2, tough_hide: 2 }),
        makeAdvSubEncounter('T4', '4-10', 4, false, true, { heavy_hitter: 3, evolution_lab: 2, hourglass: 2, tough_hide: 2 }),
      ],
    },
    {
      id: 'T5',
      name: 'Summit Apex (Spire Act 3 Boss A0 & A18)',
      mode: 'spire',
      weaponLevel: 4,
      tuned: false,
      powerEnabled: false,
      fighterStars: 120,
      baseBelt: ['blast-powder', 'mending-charm', 'flint-spark', 'echo-stone'],
      backupWeapons: ['war-drum', 'rally-horn', 'catalyst-prism', 'time-drop'],
      fighterBelt: ['blast-powder', 'mending-charm', 'flint-spark', 'echo-stone', 'war-drum'],
      weaponSeedsPerSub: scaleSeeds(2, s, wOv.T5),
      fighterSeedsPerSub: scaleSeeds(4, s, fOv.T5),
      evoSeedsPerSub: scaleSeeds(1, s, eOv.T5),
      subEncounters: [
        makeSpireSubEncounter({
          id: 'spire-a3-boss-a0',
          tierId: 'T5',
          act: 3,
          ascension: 0,
          weaponLevel: 4,
          excludeLevelIds: ['5-5', '5-1', '5-2'],
          upgrades: { evolution_lab: 2, heavy_hitter: 2 },
        }),
        makeSpireSubEncounter({
          id: 'spire-a3-boss-a18',
          tierId: 'T5',
          act: 3,
          ascension: 18,
          weaponLevel: 5,
          excludeLevelIds: ['5-5', '4-11', '5-1'],
          upgrades: { evolution_lab: 2, heavy_hitter: 3, hourglass: 2 },
        }),
      ],
    },
    {
      id: 'T6',
      name: 'Campaign Finale (Adv 5-5 The Hydra)',
      mode: 'adventure',
      weaponLevel: 5,
      tuned: true,
      powerEnabled: true,
      fighterStars: 160,
      baseBelt: ['blast-powder', 'mending-charm', 'flint-spark', 'echo-stone'],
      backupWeapons: ['war-drum', 'rally-horn', 'catalyst-prism', 'time-drop'],
      fighterBelt: ['blast-powder', 'mending-charm', 'flint-spark', 'echo-stone', 'war-drum'],
      weaponSeedsPerSub: scaleSeeds(2, s, wOv.T6),
      fighterSeedsPerSub: scaleSeeds(3, s, fOv.T6),
      evoSeedsPerSub: scaleSeeds(0, s, eOv.T6),
      subEncounters: [
        makeAdvSubEncounter('T6', '5-5', 5, true, true, {
          heavy_hitter: 5,
          evolution_lab: 3,
          hourglass: 4,
          tough_hide: 4,
          sharp_eyes: 3,
          second_wind: 3,
        }),
      ],
    },
  ];
};

// ─── Batch Simulation Runner ─────────────────────────────────────────────────

const ALL_EVO_IDS: readonly string[] = EVOLUTION_RECIPES.map(r => r.id);

interface BatchAggregate extends EncounterRunMetrics {
  evolutions: number;
}

const runSubEncounterBatch = (
  sub: SubEncounterContext,
  bot: BotProfile,
  runs: number,
  salt: number,
  params: Parameters<SubEncounterContext['buildRun']>[0]
): BatchAggregate => {
  const { level, save, opts } = sub.buildRun(params);
  let clearSum = 0;
  let winSum = 0;
  let survSum = 0;
  let dmgSum = 0;
  let timeSum = 0;
  let heartSum = 0;
  let evoSum = 0;

  withPower(sub.powerEnabled, () => {
    for (let i = 0; i < runs; i++) {
      const { state } = simulateRun(level, save, bot, seedOf(i, salt), undefined, opts);
      const m = computeClearScore(state, level);
      clearSum += m.clearScore;
      winSum += m.winRate;
      survSum += m.survivalRate;
      dmgSum += m.damageRatio;
      timeSum += m.timeLeftShare;
      heartSum += m.heartsLeftShare;
      evoSum += state.evolutionsTriggered;
    }
  });

  const denom = Math.max(1, runs);
  return {
    clearScore: clearSum / denom,
    winRate: winSum / denom,
    survivalRate: survSum / denom,
    damageRatio: dmgSum / denom,
    timeLeftShare: timeSum / denom,
    heartsLeftShare: heartSum / denom,
    evolutions: evoSum / denom,
  };
};

/**
 * Constructs a partner-safe `(withoutBelt, withBelt)` pair for weapon `candidateId`:
 * - `withoutBelt` never contains `candidateId` (swaps in a non-partner backup if needed).
 * - `withBelt` places `candidateId` in slot 1 (right after a real non-partner slot 0),
 *   so `understudy` always copies slot 0 and `encore-mask` benefits from the armed pair!
 */
const buildWeaponBelts = (
  baseBelt: readonly string[],
  backupWeapons: readonly string[],
  candidateId: string
): { withoutBelt: string[]; withBelt: string[] } => {
  const withoutBelt = [...baseBelt];
  const existingIdx = withoutBelt.indexOf(candidateId);
  if (existingIdx >= 0) {
    const replacement =
      backupWeapons.find(b => b !== candidateId && !withoutBelt.includes(b)) ??
      ALL_ARMORY_WEAPON_IDS.find(b => b !== candidateId && !PARTNER_SET.has(b) && !withoutBelt.includes(b))!;
    withoutBelt[existingIdx] = replacement;
  }
  const withBelt = [withoutBelt[0], candidateId, ...withoutBelt.slice(1)];
  return { withoutBelt, withBelt };
};

// ─── Main Public Entry Point ─────────────────────────────────────────────────

export const runGauntlet = (opts: GauntletOptions = {}): GauntletReport => {
  const t0 = Date.now();
  const avgBot = BOTS.average;
  const humanBot = opts.humanBot ?? DEFAULT_CALIBRATED_HUMAN_BOT;
  const tiers = buildGauntletTiers(opts);
  const tierById = new Map<GauntletTierId, TierSpec>(tiers.map(t => [t.id, t]));
  const log = opts.onProgress ?? (() => {});

  const weaponIds = opts.weaponIds ?? ALL_ARMORY_WEAPON_IDS;
  const fighterNames = opts.fighterNames ?? FIGHTERS.map(f => f.name);

  // Build canonical recipe list from armableRecipes (same as lab.ts)
  const allArmable = armableRecipes({ ...getBaseMaxed(), armory: [...ALL_ARMORY_WEAPON_IDS], unlockedEvolutions: [...ALL_EVO_IDS] });
  const evoNameById = new Map(EVOLUTION_RECIPES.map(r => [r.id, r.name]));
  const targetRecipes = opts.evolutionIds
    ? allArmable.filter(r => opts.evolutionIds!.includes(r.id))
    : allArmable;

  // ── 1. WEAPONS (All 64 across T1..T6, both bots) ──────────────────────────
  log(`[gauntlet] Running ${weaponIds.length} weapons across 6 tiers (BOTS.average vs ${humanBot.name})...`);
  const baselineCache = new Map<string, BatchAggregate>();
  const getCachedWeaponBaseline = (
    tier: TierSpec,
    sub: SubEncounterContext,
    botKey: 'avg' | 'human',
    bot: BotProfile,
    belt: readonly string[],
    salt: number
  ): BatchAggregate => {
    const key = `${tier.id}|${sub.id}|${botKey}|${belt.join(',')}`;
    const hit = baselineCache.get(key);
    if (hit) return hit;
    const res = runSubEncounterBatch(sub, bot, tier.weaponSeedsPerSub, salt, {
      fighter: 'Orange Tabby',
      weapons: belt,
      skillNodes: getFighterSkillNodes('Orange Tabby', tier.fighterStars),
      unlockedEvolutions: ALL_EVO_IDS,
    });
    baselineCache.set(key, res);
    return res;
  };

  interface RawWeaponAcc {
    id: string;
    name: string;
    role: WeaponRole;
    partner: boolean;
    avgBotLift: number;
    humanBotLift: number;
    spireAvgLift: number;
    spireHumanLift: number;
    spireLift: number;
    avgWinDelta: number;
    humanWinDelta: number;
    avgSurvDelta: number;
    humanSurvDelta: number;
    byTier: Record<GauntletTierId, TierCounterfactualResult>;
  }

  const rawWeapons: RawWeaponAcc[] = weaponIds.map(id => {
    const w = getArmoryWeapon(id);
    const byTier = {} as Record<GauntletTierId, TierCounterfactualResult>;
    const avgTierLifts: number[] = [];
    const humTierLifts: number[] = [];
    const avgWinDeltas: number[] = [];
    const humWinDeltas: number[] = [];
    const avgSurvDeltas: number[] = [];
    const humSurvDeltas: number[] = [];

    for (let ti = 0; ti < tiers.length; ti++) {
      const tier = tiers[ti];
      const { withoutBelt, withBelt } = buildWeaponBelts(tier.baseBelt, tier.backupWeapons, id);
      const skillNodes = getFighterSkillNodes('Orange Tabby', tier.fighterStars);

      const subAvgLifts: number[] = [];
      const subHumLifts: number[] = [];
      const subAvgWins: number[] = [];
      const subHumWins: number[] = [];
      const subAvgSurvs: number[] = [];
      const subHumSurvs: number[] = [];

      for (let si = 0; si < tier.subEncounters.length; si++) {
        const sub = tier.subEncounters[si];
        const salt = ti * 10 + si + 1;
        const baseAvg = getCachedWeaponBaseline(tier, sub, 'avg', avgBot, withoutBelt, salt);
        const withAvg = runSubEncounterBatch(sub, avgBot, tier.weaponSeedsPerSub, salt, {
          fighter: 'Orange Tabby',
          weapons: withBelt,
          skillNodes,
          unlockedEvolutions: ALL_EVO_IDS,
        });
        const baseHum = getCachedWeaponBaseline(tier, sub, 'human', humanBot, withoutBelt, salt);
        const withHum = runSubEncounterBatch(sub, humanBot, tier.weaponSeedsPerSub, salt, {
          fighter: 'Orange Tabby',
          weapons: withBelt,
          skillNodes,
          unlockedEvolutions: ALL_EVO_IDS,
        });

        subAvgLifts.push(Math.max(SCORE_FLOOR, withAvg.clearScore) / Math.max(SCORE_FLOOR, baseAvg.clearScore));
        subHumLifts.push(Math.max(SCORE_FLOOR, withHum.clearScore) / Math.max(SCORE_FLOOR, baseHum.clearScore));
        subAvgWins.push(withAvg.winRate - baseAvg.winRate);
        subHumWins.push(withHum.winRate - baseHum.winRate);
        subAvgSurvs.push(withAvg.survivalRate - baseAvg.survivalRate);
        subHumSurvs.push(withHum.survivalRate - baseHum.survivalRate);
      }

      const avgLift = geoMean(subAvgLifts);
      const humanLift = geoMean(subHumLifts);
      const avgWinDelta = mean(subAvgWins);
      const humanWinDelta = mean(subHumWins);
      const avgSurvDelta = mean(subAvgSurvs);
      const humanSurvDelta = mean(subHumSurvs);

      byTier[tier.id] = {
        tierId: tier.id,
        avgLift: roundN(avgLift, 4),
        humanLift: roundN(humanLift, 4),
        avgWinDelta: roundN(avgWinDelta, 3),
        humanWinDelta: roundN(humanWinDelta, 3),
        avgSurvDelta: roundN(avgSurvDelta, 3),
        humanSurvDelta: roundN(humanSurvDelta, 3),
      };
      avgTierLifts.push(avgLift);
      humTierLifts.push(humanLift);
      avgWinDeltas.push(avgWinDelta);
      humWinDeltas.push(humanWinDelta);
      avgSurvDeltas.push(avgSurvDelta);
      humSurvDeltas.push(humanSurvDelta);
    }

    const avgBotLift = geoMean(avgTierLifts);
    const humanBotLift = geoMean(humTierLifts);
    const spireAvgLift = geoMean(GAUNTLET_SPIRE_TIERS.map(t => byTier[t].avgLift));
    const spireHumanLift = geoMean(GAUNTLET_SPIRE_TIERS.map(t => byTier[t].humanLift));
    const spireLift = Math.sqrt(spireAvgLift * spireHumanLift);

    return {
      id,
      name: w?.name ?? id,
      role: weaponRole(id),
      partner: PARTNER_SET.has(id),
      avgBotLift: roundN(avgBotLift, 4),
      humanBotLift: roundN(humanBotLift, 4),
      spireAvgLift: roundN(spireAvgLift, 4),
      spireHumanLift: roundN(spireHumanLift, 4),
      spireLift: roundN(spireLift, 4),
      avgWinDelta: roundN(mean(avgWinDeltas), 3),
      humanWinDelta: roundN(mean(humWinDeltas), 3),
      avgSurvDelta: roundN(mean(avgSurvDeltas), 3),
      humanSurvDelta: roundN(mean(humSurvDeltas), 3),
      byTier,
    };
  });

  const minWAvg = Math.min(...rawWeapons.map(w => w.avgBotLift));
  const minWHum = Math.min(...rawWeapons.map(w => w.humanBotLift));
  const minWSpire = Math.min(...rawWeapons.map(w => w.spireLift));

  const weapons: GauntletWeaponRow[] = rawWeapons
    .map(w => {
      const avgMult = w.avgBotLift / Math.max(1e-4, minWAvg);
      const humanMult = w.humanBotLift / Math.max(1e-4, minWHum);
      const spireMult = w.spireLift / Math.max(1e-4, minWSpire);
      return {
        ...w,
        avgMult: roundN(avgMult, 4),
        humanMult: roundN(humanMult, 4),
        spireMult: roundN(spireMult, 4),
        humanVsAvgRatio: roundN(humanMult / Math.max(1e-4, avgMult), 4),
      };
    })
    .sort((a, b) => b.humanBotLift - a.humanBotLift || a.id.localeCompare(b.id));

  // ── 2. FIGHTERS (All 6 across T1..T6, scaled star trees + 160★ endgame) ───
  log(`[gauntlet] Running ${fighterNames.length} fighters across 6 tiers (${tiers.map(t => `${t.id}:${t.fighterStars}★`).join(', ')})...`);
  const rawFighters = fighterNames.map(fighter => {
    const byTier = {} as GauntletFighterRow['byTier'];
    const avgScores: number[] = [];
    const humScores: number[] = [];
    const avgWins: number[] = [];
    const humWins: number[] = [];
    const avgSurvs: number[] = [];
    const humSurvs: number[] = [];

    for (let ti = 0; ti < tiers.length; ti++) {
      const tier = tiers[ti];
      const skillNodes = getFighterSkillNodes(fighter, tier.fighterStars);
      const subAvg: BatchAggregate[] = [];
      const subHum: BatchAggregate[] = [];

      for (let si = 0; si < tier.subEncounters.length; si++) {
        const sub = tier.subEncounters[si];
        const salt = 50 + ti * 10 + si;
        subAvg.push(
          runSubEncounterBatch(sub, avgBot, tier.fighterSeedsPerSub, salt, {
            fighter,
            weapons: tier.fighterBelt,
            skillNodes,
            unlockedEvolutions: ALL_EVO_IDS,
          })
        );
        subHum.push(
          runSubEncounterBatch(sub, humanBot, tier.fighterSeedsPerSub, salt, {
            fighter,
            weapons: tier.fighterBelt,
            skillNodes,
            unlockedEvolutions: ALL_EVO_IDS,
          })
        );
      }

      const avgScore = Math.max(SCORE_FLOOR, mean(subAvg.map(x => x.clearScore)));
      const humanScore = Math.max(SCORE_FLOOR, mean(subHum.map(x => x.clearScore)));
      const avgWinRate = mean(subAvg.map(x => x.winRate));
      const humanWinRate = mean(subHum.map(x => x.winRate));
      const avgSurvival = mean(subAvg.map(x => x.survivalRate));
      const humanSurvival = mean(subHum.map(x => x.survivalRate));

      byTier[tier.id] = {
        avgScore: roundN(avgScore, 4),
        humanScore: roundN(humanScore, 4),
        avgWinRate: roundN(avgWinRate, 3),
        humanWinRate: roundN(humanWinRate, 3),
        avgSurvival: roundN(avgSurvival, 3),
        humanSurvival: roundN(humanSurvival, 3),
      };
      avgScores.push(avgScore);
      humScores.push(humanScore);
      avgWins.push(avgWinRate);
      humWins.push(humanWinRate);
      avgSurvs.push(avgSurvival);
      humSurvs.push(humanSurvival);
    }

    const avgBotScore = geoMean(avgScores);
    const humanBotScore = geoMean(humScores);
    const spireAvgScore = geoMean(GAUNTLET_SPIRE_TIERS.map(t => byTier[t].avgScore));
    const spireHumanScore = geoMean(GAUNTLET_SPIRE_TIERS.map(t => byTier[t].humanScore));
    const spireScore = Math.sqrt(spireAvgScore * spireHumanScore);

    return {
      id: fighter,
      name: fighter,
      avgBotScore: roundN(avgBotScore, 4),
      humanBotScore: roundN(humanBotScore, 4),
      spireAvgScore: roundN(spireAvgScore, 4),
      spireHumanScore: roundN(spireHumanScore, 4),
      spireScore: roundN(spireScore, 4),
      avgWinRate: roundN(mean(avgWins), 3),
      humanWinRate: roundN(mean(humWins), 3),
      avgSurvivalRate: roundN(mean(avgSurvs), 3),
      humanSurvivalRate: roundN(mean(humSurvs), 3),
      byTier,
    };
  });

  const minFAvg = Math.min(...rawFighters.map(f => f.avgBotScore));
  const minFHum = Math.min(...rawFighters.map(f => f.humanBotScore));
  const minFSpire = Math.min(...rawFighters.map(f => f.spireScore));

  const fighters: GauntletFighterRow[] = rawFighters
    .map(f => {
      const avgMult = f.avgBotScore / Math.max(1e-4, minFAvg);
      const humanMult = f.humanBotScore / Math.max(1e-4, minFHum);
      const spireMult = f.spireScore / Math.max(1e-4, minFSpire);
      return {
        ...f,
        avgMult: roundN(avgMult, 4),
        humanMult: roundN(humanMult, 4),
        spireMult: roundN(spireMult, 4),
        humanVsAvgRatio: roundN(humanMult / Math.max(1e-4, avgMult), 4),
      };
    })
    .sort((a, b) => b.humanBotScore - a.humanBotScore || a.id.localeCompare(b.id));

  // ── 3. EVOLUTIONS (All 208 across T3, T4, T5 with Encore Mask fix) ────────
  const evoTiers: { tier: TierSpec; sub: SubEncounterContext; salt: number }[] = [
    { tier: tierById.get('T3')!, sub: tierById.get('T3')!.subEncounters[0], salt: 201 },
    { tier: tierById.get('T4')!, sub: tierById.get('T4')!.subEncounters[0], salt: 202 },
    { tier: tierById.get('T5')!, sub: tierById.get('T5')!.subEncounters[0], salt: 203 },
  ];

  log(`[gauntlet] Running ${targetRecipes.length} evolutions across T3 (Boar A0), T4 (4-6 Viper), T5 (Spire A3 Boss A0)...`);

  // Step 3a: Estimate median universal blank-shell chassis lift on a deterministic sample of non-Encore recipes
  const nonEncoreSample = targetRecipes.filter(r => !normalizeRecipePair(r.options[0][0], r.options[1][0]).includes('encore-mask'));
  const sampleStep = Math.max(1, Math.floor(nonEncoreSample.length / 18));
  const chassisSampleAvg: number[] = [];
  const chassisSampleHum: number[] = [];
  const sampledChassisIndices = new Set<string>();
  for (let i = 0; i < nonEncoreSample.length && sampledChassisIndices.size < 18; i += sampleStep) {
    sampledChassisIndices.add(nonEncoreSample[i].id);
  }

  // First pass: evaluate non-Encore recipes (and collect chassis ratios on the 18-recipe sample)
  interface EvoTemp {
    id: string;
    name: string;
    pair: [string, string];
    hasEncoreFix: boolean;
    byTier: Partial<Record<GauntletTierId, TierCounterfactualResult>>;
    avgStarts: number;
    humanStarts: number;
    avgWinDelta: number;
    humanWinDelta: number;
  }

  const evoTemps: EvoTemp[] = [];
  const encoreTemps: {
    id: string;
    name: string;
    pair: [string, string];
    tierRules: {
      tierId: GauntletTierId;
      avgRuleLift: number;
      humRuleLift: number;
      avgWinDelta: number;
      humWinDelta: number;
      avgSurvDelta: number;
      humSurvDelta: number;
    }[];
    avgStarts: number;
    humanStarts: number;
  }[] = [];

  for (const r of targetRecipes) {
    const pair = normalizeRecipePair(r.options[0][0], r.options[1][0]);
    const hasEncore = pair.includes('encore-mask');
    const name = evoNameById.get(r.id) ?? r.id;

    if (!hasEncore) {
      const byTier: Partial<Record<GauntletTierId, TierCounterfactualResult>> = {};
      const avgStartsArr: number[] = [];
      const humStartsArr: number[] = [];
      const avgWinsArr: number[] = [];
      const humWinsArr: number[] = [];
      const sampleForChassis = sampledChassisIndices.has(r.id);

      for (const { tier, sub, salt } of evoTiers) {
        const runs = Math.max(1, tier.evoSeedsPerSub);
        const skillNodes = getFighterSkillNodes('Orange Tabby', tier.fighterStars);

        const onAvg = runSubEncounterBatch(sub, avgBot, runs, salt, {
          fighter: 'Orange Tabby',
          weapons: pair,
          skillNodes,
          unlockedEvolutions: [r.id],
          extraEvoBonus: true,
        });
        const offAvg = runSubEncounterBatch(sub, avgBot, runs, salt, {
          fighter: 'Orange Tabby',
          weapons: pair,
          skillNodes,
          unlockedEvolutions: [],
          extraEvoBonus: true,
        });

        const onHum = runSubEncounterBatch(sub, humanBot, runs, salt, {
          fighter: 'Orange Tabby',
          weapons: pair,
          skillNodes,
          unlockedEvolutions: [r.id],
          extraEvoBonus: true,
        });
        const offHum = runSubEncounterBatch(sub, humanBot, runs, salt, {
          fighter: 'Orange Tabby',
          weapons: pair,
          skillNodes,
          unlockedEvolutions: [],
          extraEvoBonus: true,
        });

        if (sampleForChassis) {
          const shellAvg = runSubEncounterBatch(sub, avgBot, runs, salt, {
            fighter: 'Orange Tabby',
            weapons: pair,
            skillNodes,
            unlockedEvolutions: [r.id],
            blankEvolutionRules: true,
            extraEvoBonus: true,
          });
          const shellHum = runSubEncounterBatch(sub, humanBot, runs, salt, {
            fighter: 'Orange Tabby',
            weapons: pair,
            skillNodes,
            unlockedEvolutions: [r.id],
            blankEvolutionRules: true,
            extraEvoBonus: true,
          });
          const cAvg = Math.max(SCORE_FLOOR, shellAvg.clearScore) / Math.max(SCORE_FLOOR, offAvg.clearScore);
          const cHum = Math.max(SCORE_FLOOR, shellHum.clearScore) / Math.max(SCORE_FLOOR, offHum.clearScore);
          if (Number.isFinite(cAvg) && cAvg > 0.5 && cAvg < 3) chassisSampleAvg.push(cAvg);
          if (Number.isFinite(cHum) && cHum > 0.5 && cHum < 3) chassisSampleHum.push(cHum);
        }

        const avgLift = Math.max(SCORE_FLOOR, onAvg.clearScore) / Math.max(SCORE_FLOOR, offAvg.clearScore);
        const humanLift = Math.max(SCORE_FLOOR, onHum.clearScore) / Math.max(SCORE_FLOOR, offHum.clearScore);
        byTier[tier.id] = {
          tierId: tier.id,
          avgLift: roundN(avgLift, 4),
          humanLift: roundN(humanLift, 4),
          avgWinDelta: roundN(onAvg.winRate - offAvg.winRate, 3),
          humanWinDelta: roundN(onHum.winRate - offHum.winRate, 3),
          avgSurvDelta: roundN(onAvg.survivalRate - offAvg.survivalRate, 3),
          humanSurvDelta: roundN(onHum.survivalRate - offHum.survivalRate, 3),
        };
        avgStartsArr.push(onAvg.evolutions);
        humStartsArr.push(onHum.evolutions);
        avgWinsArr.push(onAvg.winRate - offAvg.winRate);
        humWinsArr.push(onHum.winRate - offHum.winRate);
      }

      evoTemps.push({
        id: r.id,
        name,
        pair,
        hasEncoreFix: false,
        byTier,
        avgStarts: mean(avgStartsArr),
        humanStarts: mean(humStartsArr),
        avgWinDelta: mean(avgWinsArr),
        humanWinDelta: mean(humWinsArr),
      });
    } else {
      // Encore Mask recipe: compare against blank evolution shell so turning evolutions off never disables Encore Mask itself
      const tierRules: (typeof encoreTemps)[number]['tierRules'] = [];
      const avgStartsArr: number[] = [];
      const humStartsArr: number[] = [];

      for (const { tier, sub, salt } of evoTiers) {
        const runs = Math.max(1, tier.evoSeedsPerSub);
        const skillNodes = getFighterSkillNodes('Orange Tabby', tier.fighterStars);

        const onAvg = runSubEncounterBatch(sub, avgBot, runs, salt, {
          fighter: 'Orange Tabby',
          weapons: pair,
          skillNodes,
          unlockedEvolutions: [r.id],
          extraEvoBonus: true,
        });
        const shellAvg = runSubEncounterBatch(sub, avgBot, runs, salt, {
          fighter: 'Orange Tabby',
          weapons: pair,
          skillNodes,
          unlockedEvolutions: [r.id],
          blankEvolutionRules: true,
          extraEvoBonus: true,
        });

        const onHum = runSubEncounterBatch(sub, humanBot, runs, salt, {
          fighter: 'Orange Tabby',
          weapons: pair,
          skillNodes,
          unlockedEvolutions: [r.id],
          extraEvoBonus: true,
        });
        const shellHum = runSubEncounterBatch(sub, humanBot, runs, salt, {
          fighter: 'Orange Tabby',
          weapons: pair,
          skillNodes,
          unlockedEvolutions: [r.id],
          blankEvolutionRules: true,
          extraEvoBonus: true,
        });

        tierRules.push({
          tierId: tier.id,
          avgRuleLift: Math.max(SCORE_FLOOR, onAvg.clearScore) / Math.max(SCORE_FLOOR, shellAvg.clearScore),
          humRuleLift: Math.max(SCORE_FLOOR, onHum.clearScore) / Math.max(SCORE_FLOOR, shellHum.clearScore),
          avgWinDelta: onAvg.winRate - shellAvg.winRate,
          humWinDelta: onHum.winRate - shellHum.winRate,
          avgSurvDelta: onAvg.survivalRate - shellAvg.survivalRate,
          humSurvDelta: onHum.survivalRate - shellHum.survivalRate,
        });
        avgStartsArr.push(onAvg.evolutions);
        humStartsArr.push(onHum.evolutions);
      }

      encoreTemps.push({
        id: r.id,
        name,
        pair,
        tierRules,
        avgStarts: mean(avgStartsArr),
        humanStarts: mean(humStartsArr),
      });
    }
  }

  const encoreChassisLiftAvg = chassisSampleAvg.length > 0 ? clamp(median(chassisSampleAvg), 1.02, 1.8) : 1.19;
  const encoreChassisLiftHuman = chassisSampleHum.length > 0 ? clamp(median(chassisSampleHum), 1.02, 1.8) : 1.19;

  for (const e of encoreTemps) {
    const byTier: Partial<Record<GauntletTierId, TierCounterfactualResult>> = {};
    for (const tr of e.tierRules) {
      byTier[tr.tierId] = {
        tierId: tr.tierId,
        avgLift: roundN(tr.avgRuleLift * encoreChassisLiftAvg, 4),
        humanLift: roundN(tr.humRuleLift * encoreChassisLiftHuman, 4),
        avgWinDelta: roundN(tr.avgWinDelta, 3),
        humanWinDelta: roundN(tr.humWinDelta, 3),
        avgSurvDelta: roundN(tr.avgSurvDelta, 3),
        humanSurvDelta: roundN(tr.humSurvDelta, 3),
      };
    }
    evoTemps.push({
      id: e.id,
      name: e.name,
      pair: e.pair,
      hasEncoreFix: true,
      byTier,
      avgStarts: e.avgStarts,
      humanStarts: e.humanStarts,
      avgWinDelta: mean(e.tierRules.map(x => x.avgWinDelta)),
      humanWinDelta: mean(e.tierRules.map(x => x.humWinDelta)),
    });
  }

  const rawEvos = evoTemps.map(e => {
    const tierEntries = GAUNTLET_EVO_TIERS.map(t => e.byTier[t]).filter((x): x is TierCounterfactualResult => !!x);
    const avgBotLift = geoMean(tierEntries.map(x => x.avgLift));
    const humanBotLift = geoMean(tierEntries.map(x => x.humanLift));
    const spireEntries = GAUNTLET_SPIRE_TIERS.map(t => e.byTier[t]).filter((x): x is TierCounterfactualResult => !!x);
    const spireAvgLift = spireEntries.length ? geoMean(spireEntries.map(x => x.avgLift)) : avgBotLift;
    const spireHumanLift = spireEntries.length ? geoMean(spireEntries.map(x => x.humanLift)) : humanBotLift;
    const spireLift = Math.sqrt(spireAvgLift * spireHumanLift);
    return {
      ...e,
      avgBotLift: roundN(avgBotLift, 4),
      humanBotLift: roundN(humanBotLift, 4),
      spireAvgLift: roundN(spireAvgLift, 4),
      spireHumanLift: roundN(spireHumanLift, 4),
      spireLift: roundN(spireLift, 4),
      avgStartsPerFight: roundN(e.avgStarts, 2),
      humanStartsPerFight: roundN(e.humanStarts, 2),
      avgWinDelta: roundN(e.avgWinDelta, 3),
      humanWinDelta: roundN(e.humanWinDelta, 3),
    };
  });

  const minEAvg = rawEvos.length ? Math.min(...rawEvos.map(e => e.avgBotLift)) : 1;
  const minEHum = rawEvos.length ? Math.min(...rawEvos.map(e => e.humanBotLift)) : 1;
  const minESpire = rawEvos.length ? Math.min(...rawEvos.map(e => e.spireLift)) : 1;

  const evolutions: GauntletEvolutionRow[] = rawEvos
    .map(e => {
      const avgMult = e.avgBotLift / Math.max(1e-4, minEAvg);
      const humanMult = e.humanBotLift / Math.max(1e-4, minEHum);
      const spireMult = e.spireLift / Math.max(1e-4, minESpire);
      return {
        id: e.id,
        name: e.name,
        pair: e.pair,
        hasEncoreFix: e.hasEncoreFix,
        avgBotLift: e.avgBotLift,
        humanBotLift: e.humanBotLift,
        spireAvgLift: e.spireAvgLift,
        spireHumanLift: e.spireHumanLift,
        spireLift: e.spireLift,
        avgMult: roundN(avgMult, 4),
        humanMult: roundN(humanMult, 4),
        spireMult: roundN(spireMult, 4),
        humanVsAvgRatio: roundN(humanMult / Math.max(1e-4, avgMult), 4),
        avgStartsPerFight: e.avgStartsPerFight,
        humanStartsPerFight: e.humanStartsPerFight,
        avgWinDelta: e.avgWinDelta,
        humanWinDelta: e.humanWinDelta,
        byTier: e.byTier,
      };
    })
    .sort((a, b) => b.humanBotLift - a.humanBotLift || a.id.localeCompare(b.id));

  // ── 4. Bot-vs-Human Movers (relative 1.00x-anchored standing shift) ───────
  const buildMovers = <T extends { id: string; name: string; avgMult: number; humanMult: number }>(
    category: GauntletMover['category'],
    rows: readonly T[]
  ): GauntletMover[] => {
    const byAvg = [...rows].sort((a, b) => b.avgMult - a.avgMult || a.id.localeCompare(b.id));
    const byHum = [...rows].sort((a, b) => b.humanMult - a.humanMult || a.id.localeCompare(b.id));
    const avgRank = new Map(byAvg.map((r, i) => [r.id, i + 1]));
    const humRank = new Map(byHum.map((r, i) => [r.id, i + 1]));
    const gmAvg = geoMean(rows.map(r => r.avgMult));
    const gmHum = geoMean(rows.map(r => r.humanMult));
    return rows.map(r => {
      // Compare normalized relative position vs category peers so weakest-item noise doesn't skew every mover
      const normRatio = (r.humanMult / gmHum) / Math.max(1e-4, r.avgMult / gmAvg);
      const aRank = avgRank.get(r.id) ?? 1;
      const hRank = humRank.get(r.id) ?? 1;
      return {
        category,
        id: r.id,
        name: r.name,
        avgMult: r.avgMult,
        humanMult: r.humanMult,
        humanVsAvgRatio: roundN(normRatio, 4),
        logShift: roundN(Math.log(Math.max(1e-4, normRatio)), 4),
        avgRank: aRank,
        humanRank: hRank,
        rankDelta: aRank - hRank,
      };
    });
  };

  const allMovers = [
    ...buildMovers('weapons', weapons),
    ...buildMovers('evolutions', evolutions),
    ...buildMovers('fighters', fighters),
  ];
  const topHumanRisers = [...allMovers]
    .filter(m => m.logShift > 0.04)
    .sort((a, b) => b.logShift - a.logShift)
    .slice(0, 15);
  const topHumanFallers = [...allMovers]
    .filter(m => m.logShift < -0.04)
    .sort((a, b) => a.logShift - b.logShift)
    .slice(0, 15);

  const tierSummaries: GauntletTierSpecSummary[] = tiers.map(t => ({
    id: t.id,
    name: t.name,
    mode: t.mode,
    encounters: t.subEncounters.map(sub => ({
      id: sub.id,
      enemy: sub.enemyName,
      hp: sub.level.foes[0]?.hp ?? 0,
      ...(sub.ascension !== undefined ? { ascension: sub.ascension } : {}),
    })),
    weaponLevel: t.weaponLevel,
    tuned: t.tuned,
    powerEnabled: t.powerEnabled,
    fighterStars: t.fighterStars,
    baseBeltSize: t.baseBelt.length,
    weaponSeedsPerSub: t.weaponSeedsPerSub,
    fighterSeedsPerSub: t.fighterSeedsPerSub,
    evoSeedsPerSub: t.evoSeedsPerSub,
  }));

  const durationMs = Date.now() - t0;
  log(`[gauntlet] Finished in ${(durationMs / 1000).toFixed(1)}s.`);

  return {
    generatedAt: new Date().toISOString(),
    durationMs,
    bots: {
      average: avgBot,
      human: humanBot,
    },
    encoreChassisLiftAvg: roundN(encoreChassisLiftAvg, 4),
    encoreChassisLiftHuman: roundN(encoreChassisLiftHuman, 4),
    tiers: tierSummaries,
    weapons,
    evolutions,
    fighters,
    movers: {
      topHumanRisers,
      topHumanFallers,
    },
  };
};

// ─── Markdown Renderer ───────────────────────────────────────────────────────

export const renderGauntletMarkdown = (report: GauntletReport, opts: { top?: number; bottom?: number } = {}): string => {
  const top = opts.top ?? 12;
  const bottom = opts.bottom ?? 5;
  const out: string[] = [];
  const row = (cells: (string | number)[]) => out.push(`| ${cells.join(' | ')} |`);
  const fx = (x: number) => `${x.toFixed(2)}×`;
  const fdelta = (x: number) => `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`;

  out.push('# NShapes 6-Tier Multi-Difficulty Enemy Gauntlet Report', '');
  out.push(
    `- **Generated:** \`${report.generatedAt}\` (${(report.durationMs / 1000).toFixed(1)}s) | **Bots:** \`BOTS.average\` (Uniform) vs \`${report.bots.human.name}\` (Lognormal \`σ=${report.bots.human.findTimeSigma ?? 0}\`, \`${report.bots.human.baseReactionSec ?? 0}s + ${report.bots.human.secondsPerAttribute}s/attr\`)`,
    `- **Score Formula:** \`S_e = 0.50·min(1.5, dmg/hp) + 0.30·win + 0.20·(timeShare + heartsShare)/2\``,
    `- **Encore Mask Chassis Lift:** avg=\`×${report.encoreChassisLiftAvg.toFixed(3)}\`, human=\`×${report.encoreChassisLiftHuman.toFixed(3)}\``,
    ''
  );

  out.push('## Gauntlet Encounters (Canonical Levels & Spire Overrides)', '');
  row(['Tier', 'Encounter(s)', 'Mode', 'Gear', 'Power', 'Fighter ★']);
  row(['---', '---', '---', '---', '---', '---']);
  for (const t of report.tiers) {
    const encs = t.encounters.map(e => `${e.enemy} (${e.hp} HP${e.ascension !== undefined ? ` A${e.ascension}` : ''})`).join(', ');
    row([`**${t.id}**`, encs, t.mode, `Lv${t.weaponLevel}${t.tuned ? ' tuned' : ''}`, t.powerEnabled ? 'ON' : 'OFF', `${t.fighterStars}★`]);
  }
  out.push('');

  if (report.fighters.length > 0) {
    out.push('## Fighters (All 6 Tiers, Scaled Skill Trees → 160★ Endgame)', '');
    row(['#', 'Fighter', 'Human 1.00×', 'Avg 1.00×', 'Spire 1.00×', 'Human/Avg', 'Hum Win%', 'Avg Win%', 'Hum Surv%']);
    row(['---', '---', '---', '---', '---', '---', '---', '---', '---']);
    report.fighters.forEach((f, idx) => {
      row([
        idx + 1,
        `**${f.name}**`,
        `**${fx(f.humanMult)}**`,
        fx(f.avgMult),
        fx(f.spireMult),
        `${f.humanVsAvgRatio.toFixed(2)}×`,
        `${Math.round(f.humanWinRate * 100)}%`,
        `${Math.round(f.avgWinRate * 100)}%`,
        `${Math.round(f.humanSurvivalRate * 100)}%`,
      ]);
    });
    out.push('');
  }

  if (report.weapons.length > 0) {
    out.push(`## Weapons (${report.weapons.length} · Top ${top} & Bottom ${bottom} by Calibrated Human Gauntlet)`, '');
    row(['#', 'Weapon', 'Role', 'Human 1.00×', 'Avg 1.00×', 'Spire 1.00×', 'Hum Lift', 'Avg Lift', 'Hum WinΔ', 'Hum SurvΔ']);
    row(['---', '---', '---', '---', '---', '---', '---', '---', '---', '---']);
    const head = report.weapons.slice(0, top);
    const tail = report.weapons.length > top ? report.weapons.slice(-Math.min(bottom, report.weapons.length - top)) : [];
    const show = [...head, ...tail];
    for (const w of show) {
      const rank = report.weapons.indexOf(w) + 1;
      row([
        rank,
        `${w.name}${w.partner ? ' *' : ''}`,
        w.role,
        `**${fx(w.humanMult)}**`,
        fx(w.avgMult),
        fx(w.spireMult),
        `×${w.humanBotLift.toFixed(2)}`,
        `×${w.avgBotLift.toFixed(2)}`,
        fdelta(w.humanWinDelta),
        fdelta(w.humanSurvDelta),
      ]);
    }
    out.push('');
  }

  if (report.evolutions.length > 0) {
    out.push(`## Evolutions (${report.evolutions.length} · Top ${top} & Bottom ${bottom} on Live Bosses T3/T4/T5)`, '');
    row(['#', 'Evolution', 'Pair', 'Human 1.00×', 'Avg 1.00×', 'Spire 1.00×', 'Hum Lift', 'Avg Lift', 'Hum WinΔ', 'Starts']);
    row(['---', '---', '---', '---', '---', '---', '---', '---', '---', '---']);
    const head = report.evolutions.slice(0, top);
    const tail = report.evolutions.length > top ? report.evolutions.slice(-Math.min(bottom, report.evolutions.length - top)) : [];
    for (const e of [...head, ...tail]) {
      const rank = report.evolutions.indexOf(e) + 1;
      row([
        rank,
        `${e.name}${e.hasEncoreFix ? ' †' : ''}`,
        `\`${e.pair.join(' + ')}\``,
        `**${fx(e.humanMult)}**`,
        fx(e.avgMult),
        fx(e.spireMult),
        `×${e.humanBotLift.toFixed(2)}`,
        `×${e.avgBotLift.toFixed(2)}`,
        fdelta(e.humanWinDelta),
        e.humanStartsPerFight.toFixed(1),
      ]);
    }
    out.push('');
  }

  if (report.movers.topHumanRisers.length > 0 || report.movers.topHumanFallers.length > 0) {
    out.push('## Biggest Bot-vs-Human Gauntlet Movers (Lognormal Droughts + Cognitive Load vs Uniform Bot)', '');
    row(['Direction', 'Category', 'Item', 'Avg 1.00× (#)', 'Human 1.00× (#)', 'Peer Ratio', 'Rank Δ']);
    row(['---', '---', '---', '---', '---', '---', '---']);
    for (const m of report.movers.topHumanRisers.slice(0, 8)) {
      row([
        '↑ Human Riser',
        m.category,
        `**${m.name}** (\`${m.id}\`)`,
        `${fx(m.avgMult)} (#${m.avgRank})`,
        `${fx(m.humanMult)} (#${m.humanRank})`,
        `**${m.humanVsAvgRatio.toFixed(2)}×**`,
        `${m.rankDelta >= 0 ? '+' : ''}${m.rankDelta}`,
      ]);
    }
    for (const m of report.movers.topHumanFallers.slice(0, 8)) {
      row([
        '↓ Bot-Favored',
        m.category,
        `**${m.name}** (\`${m.id}\`)`,
        `${fx(m.avgMult)} (#${m.avgRank})`,
        `${fx(m.humanMult)} (#${m.humanRank})`,
        `**${m.humanVsAvgRatio.toFixed(2)}×**`,
        `${m.rankDelta >= 0 ? '+' : ''}${m.rankDelta}`,
      ]);
    }
    out.push('');
  }

  return out.join('\n');
};
