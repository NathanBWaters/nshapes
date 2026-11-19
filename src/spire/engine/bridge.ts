/**
 * Bridge between Starfall Spire and Adventure Mode's shared combat engine.
 *
 * Converts a `SpireRun` + `SpireEncounter` into a standard `LevelDef`, a
 * virtual `AdventureSave`, `RunOverrides`, and `FeatureFlag` set so EVERY
 * Spire fight runs through the exact same `runReducer`, `AdventureRun`,
 * 204 Evolutions, Set-Parrying, Multiplier Ignition, Kill-Cam, and Audio Band!
 */
import type { AttributeName, Weapon } from '@/types';
import type { AdventureSave, FeatureFlag, LevelDef } from '@/adventure/types';
import type { WeaponBuilds } from '@/adventure/data/weaponStats';
import { createNewSave } from '@/adventure/progress';
import { EVOLUTION_RECIPES } from '@/adventure/data/evolutions';
import { ARCANA } from '@/adventure/data/arcana';
import { charmWeapons } from '@/adventure/data/armory';
import { armedRecipesFor } from '@/adventure/engine/sources';
import type { RunOverrides } from '@/adventure/engine/run';
import { SPIRE_WEAPON_POOL } from '../data/encounters';
import type { SpireEncounter, SpireRun } from '../types';

const A3: AttributeName[] = ['shape', 'color', 'number'];

/** All core combat features enabled inside Starfall Spire fights (no mid-fight wave shop/xp popups — progression lives on the Spire map!). */
export const SPIRE_FIGHT_FEATURES: ReadonlySet<FeatureFlag> = new Set<FeatureFlag>([
  'hearts',
  'gear',
  'power',
  'rainbow',
  'purity',
  'coins',
  'hints',
  'graces',
  'evolutions',
]);

export const ALL_EVOLUTION_IDS: readonly string[] = EVOLUTION_RECIPES.map(r => r.id);

/** Build a `WeaponBuilds` lookup from the Spire run's weapon levels. */
export const buildSpireWeaponBuilds = (run: Pick<SpireRun, 'weaponLevels'>): WeaponBuilds => {
  const out: Record<string, { level: number; tuning: Record<string, number> }> = {};
  for (const [id, level] of Object.entries(run.weaponLevels)) {
    out[id] = { level: Math.max(1, Math.min(5, level)), tuning: {} };
  }
  return out;
};

/** Instantiate the player's current held weapons at their Spire levels (respecting Understudy slot order). */
export const spireHeldWeapons = (run: Pick<SpireRun, 'weapons' | 'weaponLevels'>): Weapon[] =>
  charmWeapons(run.weapons, buildSpireWeaponBuilds(run));

/** Armed evolution recipe ids for a Spire run's current weapons. */
export const spireArmedRecipes = (run: Pick<SpireRun, 'weapons' | 'weaponLevels'>): string[] =>
  armedRecipesFor(spireHeldWeapons(run), ALL_EVOLUTION_IDS);

/**
 * How many NEW evolutions would adding `candidateWeaponId` arm with the run's
 * current weapons? Used to badge synergy picks in drafts and shops!
 */
export const newEvolutionsArmedBy = (
  run: Pick<SpireRun, 'weapons' | 'weaponLevels'>,
  candidateWeaponId: string
): string[] => {
  if (run.weapons.includes(candidateWeaponId)) return [];
  const before = new Set(spireArmedRecipes(run));
  const after = armedRecipesFor(
    charmWeapons([...run.weapons, candidateWeaponId], buildSpireWeaponBuilds(run)),
    ALL_EVOLUTION_IDS
  );
  return after.filter(id => !before.has(id));
};

/** Convert a Spire encounter into a standard Adventure `LevelDef`. */
export const spireEncounterToLevel = (run: SpireRun, encounter: SpireEncounter): LevelDef => ({
  id: `spire-${run.act}-${run.floor}-${encounter.id}`,
  biome: encounter.biome,
  name: encounter.name,
  introduces: 'timer',
  rules: {
    attributes: A3,
    boardSize: encounter.boardSize,
    timer: Math.max(45, encounter.timer + run.bonusClockSeconds),
    hearts: run.maxHearts,
    startingHints: run.startingHints,
    startingGraces: run.startingGraces,
    shadingSurge: encounter.shadingSurge,
    ...(encounter.hazards ? { hazards: encounter.hazards } : {}),
    ...(run.extraEvolutionLikelihood > 0 ? { evolutionLikelihood: run.extraEvolutionLikelihood } : {}),
    ...(run.extraEvolutionCap > 0 ? { extraEvolutionCap: run.extraEvolutionCap } : {}),
  },
  foes: encounter.foes,
  challenge: { kind: 'noMistakes' },
  coinMultiplier: 1 + run.act * 0.35,
  difficulty: encounter.difficulty,
  rewards: {
    star1: { coins: 0 },
    star2: { coins: encounter.coinReward },
    star3: { coins: encounter.coinReward },
  },
  isBoss: encounter.kind === 'boss',
  ...(encounter.kind === 'elite' ? { branchOf: 'spire-elite' } : {}),
});

/** Build a virtual `AdventureSave` reflecting the Spire run's exact fighter, gear, skills, Arcana, and upgrades. */
export const spireRunToVirtualSave = (
  run: SpireRun,
  prefs: { musicOn: boolean; effectsOn: boolean } = { musicOn: true, effectsOn: true }
): AdventureSave => {
  const base = createNewSave();
  return {
    ...base,
    selectedFighter: run.fighter,
    unlockedFighters: [run.fighter],
    armory: [...SPIRE_WEAPON_POOL],
    charms: [...run.weapons],
    skillNodes: { [run.fighter]: [...run.skillNodes] },
    unlockedArcana: ARCANA.map(a => a.id),
    equippedArcana: [...run.arcana],
    unlockedEvolutions: [...ALL_EVOLUTION_IDS],
    discoveredEvolutions: [...run.stats.forgedRecipeIds],
    coinsUnlocked: true,
    workshopUnlocked: true,
    bountiesUnlocked: false,
    upgrades: {
      heavy_hitter: run.bonusDamagePerMatch,
      evolution_lab: run.evolutionLabTier,
    },
    musicOn: prefs.musicOn,
    effectsOn: prefs.effectsOn,
    // Mark all intro/coach tips seen so Spire fights stay brisk and never interrupt with campaign tutorial tips
    seenMechanics: ['set_rule', 'hearts', 'timer', 'rainbow', 'evolutions', 'skill_tree', 'coins', 'hints', 'graces', 'shading_surge'],
    seenCoachMarks: ['evo', 'power_meter', 'weapon_growth'],
  };
};

/** Overrides passed to `createRun` / `AdventureRun` so Spire keeps persistent HP and uncapped builds. */
export const spireRunOverrides = (run: SpireRun): RunOverrides => ({
  startingHearts: run.hearts,
  uncappedCharms: true,
  uncappedArcana: true,
  weaponBuilds: buildSpireWeaponBuilds(run),
});
