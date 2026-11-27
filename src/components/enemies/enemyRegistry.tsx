import React from 'react';
import { CreatureScaleTier } from '@/components/creatures/RigLayers';
import { CreatureJointPivots, DEFAULT_CREATURE_PIVOTS } from '@/components/creatures/types';
import {
  EnemyMotionClass,
  EnemyPersonalityProfile,
  EnemySpeciesClass,
  EnemyTier,
  buildEnemyPersonality,
} from '@/utils/enemyAnimations';
import type { MassClass } from '@/utils/motion';
import {
  ApexPredatorRig,
  BearRig,
  BoarRig,
  HyenaRig,
  MammothRig,
  TapirRig,
  WolfRig,
  WolverineRig,
} from './rigs/BeastPredatorRigs';
import {
  AbyssalOctopusRig,
  AncientDragonRig,
  CreepingShadowRig,
  GoblinSaboteurRig,
  JellyfishRig,
  KrakensGraspRig,
  LurkingSharkRig,
  MonsterCrestFallbackRig,
  NightmareSquidRig,
  OneEyedTerrorRig,
  StoneSentinelRig,
  TheHydraRig,
  TheReaperRig,
  TrainingDummyRig,
  WetCrabRig,
  WickedImpRig,
  WorldEaterRig,
} from './rigs/BossArcaneAquaticRigs';
import {
  AntRig,
  ChameleonRig,
  FrogRig,
  IronShellRig,
  ScorpionRig,
  SerpentRig,
  TrapWeaverRig,
} from './rigs/ReptileBugRigs';
import {
  BeaverRig,
  BurrowingMoleRig,
  ChihuahuaRig,
  LagomorphRig,
  LazySlothRig,
  MaskedBanditRig,
  PunishingErmineRig,
  QuillBeastRig,
  RatMouseRig,
  SquirrelRig,
} from './rigs/RodentWoodlandRigs';
import { EnemyRigProps } from './rigs/types';
import {
  CirclingVultureRig,
  CorvidRig,
  NightOwlRig,
  PrismMothRig,
  RaptorRig,
  ShadowBatRig,
  SwiftBeeRig,
  WildGooseRig,
} from './rigs/WingedAvianRigs';

const WINGED_PIVOTS: CreatureJointPivots = {
  head: { x: 50, y: 40 },
  leftEar: { x: 24, y: 54 },
  rightEar: { x: 76, y: 54 },
  tail: { x: 50, y: 78 },
  paws: { x: 50, y: 80 },
};

const PINCER_PIVOTS: CreatureJointPivots = {
  head: { x: 50, y: 56 },
  leftEar: { x: 24, y: 58 }, // Left pincer
  rightEar: { x: 76, y: 58 }, // Right pincer
  tail: { x: 56, y: 38 }, // Arched scorpion stinger / bubbles
  paws: { x: 50, y: 82 },
};

// Calibrated 3/4 LEFT anatomical pivots for the 9 upgraded Iconic Bosses
const DRAGON_34_PIVOTS: CreatureJointPivots = {
  head: { x: 30, y: 36 }, // Muscular arched dragon neck & snout left
  leftEar: { x: 46, y: 44 }, // Far/left bat wing shoulder
  rightEar: { x: 58, y: 46 }, // Dominant foreground right bat pinion shoulder
  tail: { x: 64, y: 76 }, // Coiling spined tail base right
  paws: { x: 34, y: 80 }, // Forward-left dragon swipe talon
};

const HYDRA_34_PIVOTS: CreatureJointPivots = {
  head: { x: 46, y: 44 }, // Central towering alpha neck base
  leftEar: { x: 32, y: 54 }, // Lower-left striker serpent neck base
  rightEar: { x: 60, y: 54 }, // Upper-right coiled serpent neck base
  tail: { x: 74, y: 78 }, // Sweeping finned hydra tail right
  paws: { x: 48, y: 82 }, // Foreground coiled serpentine ridge
};

const KRAKEN_34_PIVOTS: CreatureJointPivots = {
  head: { x: 46, y: 40 }, // Bulbous slanted squid mantle
  leftEar: { x: 32, y: 64 }, // Left surging suckered tentacles
  rightEar: { x: 66, y: 64 }, // Right curling suckered tentacles
  tail: { x: 64, y: 56 }, // Rear rising abyssal tentacles
  paws: { x: 46, y: 74 }, // Forefront slamming tentacles
};

const REAPER_34_PIVOTS: CreatureJointPivots = {
  head: { x: 46, y: 36 }, // Deep peaked void cowl angled 3/4 left
  leftEar: { x: 36, y: 48 }, // Left billowing cloak sleeve
  rightEar: { x: 64, y: 50 }, // Right billowing cloak mantle
  tail: { x: 56, y: 72 }, // Floating tattered spectral cloak hem
  paws: { x: 46, y: 54 }, // Skeletal hands & arcing crescent scythe pivot
};

const WORLDEATER_34_PIVOTS: CreatureJointPivots = {
  head: { x: 32, y: 42 }, // Hunched void-beast roaring jaws left
  leftEar: { x: 50, y: 50 }, // Inner cosmic accretion vortex ring
  rightEar: { x: 50, y: 50 }, // Outer swirling cosmic stardust ring
  tail: { x: 68, y: 68 }, // Starry void haunch & orbiting shards
  paws: { x: 34, y: 72 }, // Reaching clawed void forelimbs
};

const IRONSHELL_34_PIVOTS: CreatureJointPivots = {
  head: { x: 28, y: 62 }, // Sturdy olive turtle neck extending left
  leftEar: { x: 38, y: 46 }, // Front-left armored shell crest
  rightEar: { x: 66, y: 46 }, // Rear-right spiked shell flank
  tail: { x: 82, y: 72 }, // Stubby armored tortoise tail
  paws: { x: 44, y: 80 }, // Stocky clawed fortress legs
};

const HYENA_BOSS_34_PIVOTS: CreatureJointPivots = {
  head: { x: 32, y: 46 }, // Hunched snarling hyena head left
  leftEar: { x: 28, y: 34 }, // Front rounded ear
  rightEar: { x: 42, y: 34 }, // Rear rounded ear
  tail: { x: 76, y: 68 }, // Bushy swishing tail & billowing scarf tip
  paws: { x: 34, y: 76 }, // Raised prowling claw paw left
};

const MAMMOTH_34_PIVOTS: CreatureJointPivots = {
  head: { x: 34, y: 44 }, // Domed woolly cranium & curling raised trunk
  leftEar: { x: 32, y: 56 }, // Sweeping forward ivory tusks
  rightEar: { x: 48, y: 40 }, // Flapping shaggy ear
  tail: { x: 80, y: 68 }, // Tufted mammoth tail right
  paws: { x: 44, y: 82 }, // Massive columnar stomping legs
};

const SENTINEL_34_PIVOTS: CreatureJointPivots = {
  head: { x: 42, y: 32 }, // Slotted glowing cyan visor-helm
  leftEar: { x: 30, y: 46 }, // Lead beveled basalt pauldron left
  rightEar: { x: 66, y: 46 }, // Rear heavy stone pauldron right
  tail: { x: 68, y: 36 }, // Floating arcane rune shard behind shoulder
  paws: { x: 32, y: 62 }, // Raised clenched stone lead fist left
};

interface EnemyTraits {
  /** Joint pivots when the anatomy differs from the default quadruped */
  pivots?: CreatureJointPivots;
  /** Twitchy critter or lumbering brute; omit for an average build */
  motionClass?: EnemyMotionClass;
  /** Species-class acting behavior (`winged`, `hydra`, `pincer`, `boss`) */
  speciesClass?: EnemySpeciesClass;
  /** Intrinsic boss flag so boss kinematics & scale apply even when invoked by name */
  isBoss?: boolean;
  /** Canonical tier when caller only passes an enemy name string */
  defaultTier?: EnemyTier;
  /** Snoozes when left idle at full health */
  naturallySleepy?: boolean;
}

/** Everything that makes one named enemy look and move the way it does. */
interface EnemyCreature extends EnemyTraits {
  /** Renders the creature (art variant already chosen) */
  render: (props: EnemyRigProps) => React.ReactElement;
}

function creature<V extends string = never>(
  Rig: React.FC<EnemyRigProps<V>>,
  traits: EnemyTraits & { variant?: V } = {}
): EnemyCreature {
  const { variant, ...rest } = traits;
  return {
    ...rest,
    render: (props) => <Rig {...props} variant={variant} />,
  };
}

const FAST: EnemyTraits = { motionClass: 'fast' };
const HEAVY: EnemyTraits = { motionClass: 'heavy' };
const WINGED: EnemyTraits = { pivots: WINGED_PIVOTS, speciesClass: 'winged' };
const PINCER: EnemyTraits = { pivots: PINCER_PIVOTS, speciesClass: 'pincer' };

/**
 * The single place an enemy name is tied to its art and motion. Covers every
 * Tier 1–4 enemy, Adventure foe, legacy name and the sparring dummy.
 */
const ENEMY_CREATURES: Record<string, EnemyCreature> = {
  'Junk Rat': creature(RatMouseRig, { ...FAST, variant: 'junk' }),
  'Sneaky Mouse': creature(RatMouseRig, FAST),
  'Whisker Trickster': creature(RatMouseRig, FAST),
  'Greedy Squirrel': creature(SquirrelRig, FAST),
  'Nutkin': creature(SquirrelRig, { ...FAST, variant: 'nutkin' }),
  'Dozy Bunny': creature(LagomorphRig, { naturallySleepy: true, variant: 'dozy' }),
  'Snow Hare': creature(LagomorphRig, { variant: 'snow' }),
  'Rabbit': creature(LagomorphRig, { variant: 'rabbit' }),
  'Spiny Hedgehog': creature(QuillBeastRig),
  'Prickle': creature(QuillBeastRig, { variant: 'prickle' }),
  'Merciless Porcupine': creature(QuillBeastRig, { variant: 'porcupine' }),
  'Old Quillback': creature(QuillBeastRig, { variant: 'porcupine' }),
  'Burrowing Mole': creature(BurrowingMoleRig),
  'Golden Mole': creature(BurrowingMoleRig),
  'Hoarding Beaver': creature(BeaverRig, { variant: 'hoarding' }),
  'Busy Beaver': creature(BeaverRig),
  'Punishing Ermine': creature(PunishingErmineRig, FAST),
  'Masked Bandit': creature(MaskedBanditRig),
  'Lazy Sloth': creature(LazySlothRig, { naturallySleepy: true }),
  'Chihuahua': creature(ChihuahuaRig, FAST),

  'Stalking Wolf': creature(WolfRig),
  'Prowling Direwolf': creature(WolfRig, { variant: 'dire' }),
  'Cackling Hyena': creature(HyenaRig),
  'Pickpocket Hyena': creature(HyenaRig, { variant: 'pickpocket' }),
  'Haggling Hyena': creature(HyenaRig, { variant: 'haggling' }),
  'Hyena Boss': creature(HyenaRig, {
    variant: 'boss',
    speciesClass: 'boss',
    isBoss: true,
    defaultTier: 3,
    pivots: HYENA_BOSS_34_PIVOTS,
  }),
  'Charging Boar': creature(BoarRig, HEAVY),
  'Bully Boar': creature(BoarRig, HEAVY),
  'Armored Tusks': creature(BoarRig, { ...HEAVY, variant: 'armored' }),
  'Polar Guardian': creature(BearRig, { ...HEAVY, variant: 'polar' }),
  'Raging Bear': creature(BearRig, HEAVY),
  'Fierce Wolverine': creature(WolverineRig),
  'Ravenous Tapir': creature(TapirRig),
  'Lazy Tapir': creature(TapirRig, { naturallySleepy: true }),
  'Dusty Mammoth': creature(MammothRig, {
    ...HEAVY,
    variant: 'dusty',
    speciesClass: 'boss',
    isBoss: true,
    defaultTier: 3,
    pivots: MAMMOTH_34_PIVOTS,
  }),
  'Mammoth': creature(MammothRig, {
    ...HEAVY,
    speciesClass: 'boss',
    isBoss: true,
    defaultTier: 3,
    pivots: MAMMOTH_34_PIVOTS,
  }),
  'Feral Fangs': creature(ApexPredatorRig, { variant: 'saber' }),
  'Savage Claws': creature(ApexPredatorRig),

  'Thieving Raven': creature(CorvidRig, WINGED),
  'Magpie': creature(CorvidRig, { ...WINGED, variant: 'magpie' }),
  'Night Owl': creature(NightOwlRig, WINGED),
  'Wild Goose': creature(WildGooseRig, { ...WINGED, ...FAST }),
  'Circling Vulture': creature(CirclingVultureRig, WINGED),
  'Diving Hawk': creature(RaptorRig, WINGED),
  'Hunting Eagle': creature(RaptorRig, { ...WINGED, variant: 'eagle' }),
  'Shadow Bat': creature(ShadowBatRig, { ...WINGED, ...FAST }),
  'Prism Moth': creature(PrismMothRig, { ...WINGED, ...FAST }),
  'Swift Bee': creature(SwiftBeeRig, { ...WINGED, ...FAST }),

  // Reptiles & bugs
  'Foggy Frog': creature(FrogRig),
  'Cinder Toad': creature(FrogRig),
  'Bumble Bomber': creature(SwiftBeeRig, { ...WINGED, ...FAST }),
  'Thicket Spider': creature(TrapWeaverRig),
  'Bramble Frog': creature(FrogRig, { variant: 'bramble' }),
  'Clover Frog': creature(FrogRig, { variant: 'bramble' }),
  'Sunny Gecko': creature(ChameleonRig),
  'Iron Shell': creature(IronShellRig, {
    ...HEAVY,
    speciesClass: 'boss',
    isBoss: true,
    defaultTier: 3,
    pivots: IRONSHELL_34_PIVOTS,
  }),
  'Ticking Viper': creature(SerpentRig, { variant: 'viper' }),
  'Venomous Cobra': creature(SerpentRig, { variant: 'cobra' }),
  'Snake': creature(SerpentRig),
  'Shifting Chameleon': creature(ChameleonRig),
  'Stinging Scorpion': creature(ScorpionRig, PINCER),
  'Trap Weaver': creature(TrapWeaverRig),
  'Swarming Ants': creature(AntRig, { ...FAST, variant: 'swarm' }),
  'Scout Ant': creature(AntRig, { ...FAST, variant: 'scout' }),
  'Soldier Ant': creature(AntRig, { ...FAST, variant: 'soldier' }),
  'Queen Ant': creature(AntRig, { ...FAST, variant: 'queen' }),

  // Bosses, arcane & aquatic
  'Wet Crab': creature(WetCrabRig, PINCER),
  'Lurking Shark': creature(LurkingSharkRig),
  'Jellyfish': creature(JellyfishRig),
  'Abyssal Octopus': creature(AbyssalOctopusRig),
  'Nightmare Squid': creature(NightmareSquidRig),
  'Goblin Saboteur': creature(GoblinSaboteurRig),
  'Wicked Imp': creature(WickedImpRig, WINGED),
  'Creeping Shadow': creature(CreepingShadowRig),
  'One-Eyed Terror': creature(OneEyedTerrorRig, HEAVY),
  'Stone Sentinel': creature(StoneSentinelRig, {
    ...HEAVY,
    speciesClass: 'boss',
    isBoss: true,
    defaultTier: 3,
    pivots: SENTINEL_34_PIVOTS,
  }),
  'Ancient Dragon': creature(AncientDragonRig, {
    ...HEAVY,
    speciesClass: 'winged',
    isBoss: true,
    defaultTier: 4,
    pivots: DRAGON_34_PIVOTS,
  }),
  'The Hydra': creature(TheHydraRig, {
    ...HEAVY,
    speciesClass: 'hydra',
    isBoss: true,
    defaultTier: 4,
    pivots: HYDRA_34_PIVOTS,
  }),
  "Kraken's Grasp": creature(KrakensGraspRig, {
    ...HEAVY,
    speciesClass: 'boss',
    isBoss: true,
    defaultTier: 4,
    pivots: KRAKEN_34_PIVOTS,
  }),
  'The Reaper': creature(TheReaperRig, {
    ...HEAVY,
    speciesClass: 'boss',
    isBoss: true,
    defaultTier: 4,
    pivots: REAPER_34_PIVOTS,
  }),
  'World Eater': creature(WorldEaterRig, {
    ...HEAVY,
    speciesClass: 'boss',
    isBoss: true,
    defaultTier: 4,
    pivots: WORLDEATER_34_PIVOTS,
  }),
  'Sparring Foe': creature(TrainingDummyRig),
  'Training Dummy': creature(TrainingDummyRig),
  'Dummy': creature(TrainingDummyRig),
};

/** Drawn for a missing enemy (no name at all). */
const NAMELESS_ENEMY = creature(TrainingDummyRig);

/** Drawn for any enemy name with no registry entry: a heraldic crest with average motion. */
const FALLBACK_ENEMY = creature(MonsterCrestFallbackRig);

export const ALL_CUSTOM_ENEMY_RIG_NAMES: readonly string[] = Object.keys(ENEMY_CREATURES);

export function hasEnemyCreature(enemyName: string): boolean {
  return Object.prototype.hasOwnProperty.call(ENEMY_CREATURES, enemyName);
}

function getEnemyCreature(enemyName: string): EnemyCreature {
  if (hasEnemyCreature(enemyName)) return ENEMY_CREATURES[enemyName];
  return enemyName === '' ? NAMELESS_ENEMY : FALLBACK_ENEMY;
}

export function getEnemyRigPivots(enemyName: string): CreatureJointPivots {
  return getEnemyCreature(enemyName).pivots ?? DEFAULT_CREATURE_PIVOTS;
}

/** Whether this enemy snoozes when left idle at full health (e.g. Dozy Bunny, Lazy Sloth). */
export function isNaturallySleepyEnemy(enemyName?: string | null): boolean {
  return !!enemyName && getEnemyCreature(enemyName).naturallySleepy === true;
}

/** Canonical tier for an enemy when caller only supplies a string name. */
export function getEnemyDefaultTier(enemyName?: string | null): EnemyTier {
  if (!enemyName) return 1;
  return getEnemyCreature(enemyName).defaultTier ?? 1;
}

/** Whether this enemy is an iconic Chapter Boss or Tier-4 Boss. */
export function isBossEnemy(enemyName?: string | null): boolean {
  return !!enemyName && getEnemyCreature(enemyName).isBoss === true;
}

/** Species-class acting archetype (`winged`, `hydra`, `pincer`, `boss`, or `standard`). */
export function getEnemySpeciesClass(enemyName?: string | null): EnemySpeciesClass {
  if (!enemyName) return 'standard';
  const entry = getEnemyCreature(enemyName);
  return entry.speciesClass ?? (entry.isBoss ? 'boss' : 'standard');
}

/** Resolves `MASS_CLASS` physical inertia weight from enemy build and scale tier. */
export function getEnemyMassClass(
  enemyName?: string | null,
  scaleTier?: CreatureScaleTier
): MassClass {
  const entry = enemyName ? getEnemyCreature(enemyName) : NAMELESS_ENEMY;
  if (scaleTier === 'boss' || entry.isBoss) return 'boss';
  if (entry.motionClass === 'heavy') return 'heavy';
  if (entry.motionClass === 'fast') return 'nimble';
  return 'standard';
}

/**
 * Deterministic personality & motion physics for every enemy in NShapes.
 * The aura colour follows the tier the caller supplies (or canonical default tier when omitted).
 */
export function getEnemyPersonality(enemyName?: string | null, tier?: number): EnemyPersonalityProfile {
  const name = enemyName || 'Sparring Foe';
  const { motionClass, naturallySleepy, speciesClass, isBoss, defaultTier } = getEnemyCreature(name);
  const resolved = tier ?? defaultTier ?? 1;
  const safeTier = (resolved >= 1 && resolved <= 4 ? resolved : 1) as EnemyTier;
  return buildEnemyPersonality({
    name,
    tier: safeTier,
    motionClass,
    speciesClass,
    isBoss,
    naturallySleepy,
  });
}

/**
 * Draws any enemy by name with its bespoke multi-part animated SVG rig.
 */
export const EnemyCreatureRig: React.FC<EnemyRigProps & { enemyName: string }> = ({
  enemyName,
  ...rigProps
}) => getEnemyCreature(enemyName).render(rigProps);
