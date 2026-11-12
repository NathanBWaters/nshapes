import React from 'react';
import { CreatureJointPivots, DEFAULT_CREATURE_PIVOTS } from '@/components/creatures/types';
import {
  EnemyMotionClass,
  EnemyPersonalityProfile,
  EnemyTier,
  buildEnemyPersonality,
} from '@/utils/enemyAnimations';
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

const HYDRA_PIVOTS: CreatureJointPivots = {
  head: { x: 50, y: 42 },
  leftEar: { x: 24, y: 52 },  // Left serpent neck base
  rightEar: { x: 76, y: 52 }, // Right serpent neck base
  tail: { x: 72, y: 82 },
  paws: { x: 50, y: 82 },
};

const PINCER_PIVOTS: CreatureJointPivots = {
  head: { x: 50, y: 56 },
  leftEar: { x: 24, y: 58 },  // Left pincer
  rightEar: { x: 76, y: 58 }, // Right pincer
  tail: { x: 56, y: 38 },     // Arched scorpion stinger / bubbles
  paws: { x: 50, y: 82 },
};

interface EnemyTraits {
  /** Joint pivots when the anatomy differs from the default quadruped */
  pivots?: CreatureJointPivots;
  /** Twitchy critter or lumbering brute; omit for an average build */
  motionClass?: EnemyMotionClass;
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
const WINGED: EnemyTraits = { pivots: WINGED_PIVOTS };

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
  'Hyena Boss': creature(HyenaRig, { variant: 'boss' }),
  'Charging Boar': creature(BoarRig, HEAVY),
  'Bully Boar': creature(BoarRig, HEAVY),
  'Armored Tusks': creature(BoarRig, { ...HEAVY, variant: 'armored' }),
  'Polar Guardian': creature(BearRig, { ...HEAVY, variant: 'polar' }),
  'Raging Bear': creature(BearRig, HEAVY),
  'Fierce Wolverine': creature(WolverineRig),
  'Ravenous Tapir': creature(TapirRig),
  'Lazy Tapir': creature(TapirRig, { naturallySleepy: true }),
  'Dusty Mammoth': creature(MammothRig, { ...HEAVY, variant: 'dusty' }),
  'Mammoth': creature(MammothRig, HEAVY),
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
  'Iron Shell': creature(IronShellRig, HEAVY),
  'Ticking Viper': creature(SerpentRig, { variant: 'viper' }),
  'Venomous Cobra': creature(SerpentRig, { variant: 'cobra' }),
  'Snake': creature(SerpentRig),
  'Shifting Chameleon': creature(ChameleonRig),
  'Stinging Scorpion': creature(ScorpionRig, { pivots: PINCER_PIVOTS }),
  'Trap Weaver': creature(TrapWeaverRig),
  'Swarming Ants': creature(AntRig, { ...FAST, variant: 'swarm' }),
  'Scout Ant': creature(AntRig, { ...FAST, variant: 'scout' }),
  'Soldier Ant': creature(AntRig, { ...FAST, variant: 'soldier' }),
  'Queen Ant': creature(AntRig, { ...FAST, variant: 'queen' }),

  // Bosses, arcane & aquatic
  'Wet Crab': creature(WetCrabRig, { pivots: PINCER_PIVOTS }),
  'Lurking Shark': creature(LurkingSharkRig),
  'Jellyfish': creature(JellyfishRig),
  'Abyssal Octopus': creature(AbyssalOctopusRig),
  'Nightmare Squid': creature(NightmareSquidRig),
  'Goblin Saboteur': creature(GoblinSaboteurRig),
  'Wicked Imp': creature(WickedImpRig, WINGED),
  'Creeping Shadow': creature(CreepingShadowRig),
  'One-Eyed Terror': creature(OneEyedTerrorRig, HEAVY),
  'Stone Sentinel': creature(StoneSentinelRig, HEAVY),
  'Ancient Dragon': creature(AncientDragonRig, { ...WINGED, ...HEAVY }),
  'The Hydra': creature(TheHydraRig, { ...HEAVY, pivots: HYDRA_PIVOTS }),
  "Kraken's Grasp": creature(KrakensGraspRig, HEAVY),
  'The Reaper': creature(TheReaperRig),
  'World Eater': creature(WorldEaterRig, HEAVY),
  'Sparring Foe': creature(TrainingDummyRig),
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

/**
 * Deterministic personality & motion physics for every enemy in NShapes.
 * The aura colour follows the tier the caller supplies (tier 1 when unknown).
 */
export function getEnemyPersonality(enemyName?: string | null, tier?: number): EnemyPersonalityProfile {
  const name = enemyName || 'Sparring Foe';
  const { motionClass, naturallySleepy } = getEnemyCreature(name);
  const safeTier = (tier && tier >= 1 && tier <= 4 ? tier : 1) as EnemyTier;
  return buildEnemyPersonality({ name, tier: safeTier, motionClass, naturallySleepy });
}

/**
 * Draws any enemy by name with its bespoke multi-part animated SVG rig.
 */
export const EnemyCreatureRig: React.FC<EnemyRigProps & { enemyName: string }> = ({
  enemyName,
  ...rigProps
}) => getEnemyCreature(enemyName).render(rigProps);
