import { COLORS } from './colors';
import { FighterHealthState, getFighterHealthState } from './fighterAnimations';
import { MoodLoopRates, MoodPoseTargets } from './proceduralMotion';

/**
 * Enemy battle-wear state (mirrors FighterHealthState: pristine -> scuffed -> battered -> critical -> knocked_out).
 */
export type EnemyHealthState = FighterHealthState;

/**
 * Continuous ambient mood for enemies & foes.
 */
export type EnemyAmbientMood =
  | 'idle'      // Calm menacing breath + blinks + micro-fidgets (map, previews, menus)
  | 'menacing'  // Active combat stance: coiled, alert predator eyes
  | 'cornered'  // Low HP (<=30%): rapid ragged panting, hunched guard, sweat
  | 'enraged'   // Boss fury / high inactivity pressure / player mistake streak: fierce blazing aura
  | 'sleepy'    // Dozy Bunny / Lazy Sloth / idle board: heavy drowsy eyelids
  | 'victory'   // Player lost! Wicked gloating victory bounce
  | 'defeat';   // Enemy knocked out: slumped KO posture + X_X eyes

/**
 * Discrete one-shot enemy reactions triggered by gameplay or taps.
 */
export type EnemyReactionType =
  | 'pain'       // Player matched a Set! Enemy flinches/recoils with wince & impact sparks
  | 'crit_pain'  // Rainbow Strike / Mega-match / Combo / Grudge! Big stagger spin & heavy burst
  | 'taunt'      // Player made an invalid mistake! Wicked cackle & smug bounce
  | 'attack'     // Enemy triggered time steal / bomb / shuffle / inactivity hit! Fierce forward lunge
  | 'regen'      // Enemy healed/regenerated HP (e.g. Circling Vulture)! Eerie mend pulse
  | 'poke'       // Player tapped/poked the enemy! Snappy annoyed growl & glare
  | 'rage_spin'  // Rapid 5x poke easter egg! Furious tornado spin & dark sparks
  | 'entrance';  // Fight start or new wave arrival! Heavy stomp crouch & menacing roar

export interface EnemyReactionEvent {
  type: EnemyReactionType;
  /** Monotonically increasing ID so identical consecutive reactions re-trigger cleanly */
  id: number;
}

/**
 * Resolved facial expression rendered by EnemyEyes & creature mouths.
 */
export type EnemyExpression =
  | 'menacing'
  | 'blink'
  | 'wicked_glee'
  | 'enraged'
  | 'wince'
  | 'ko'
  | 'bruised_grit'
  | 'sleepy'
  | 'startled';

export interface EnemyPersonalityProfile {
  name: string;
  tier: 1 | 2 | 3 | 4;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  auraColor: string;
  irisColor: string;
  /** Idle breathing cycle duration in ms (fast for bugs/rodents, slow & heavy for bosses/golems) */
  breathCycleMs: number;
  /** Idle breathing vertical scale intensity */
  breathIntensity: number;
  /** Appendage (ear/wing/horn/pincer/head) sway amplitude in degrees */
  earSwayDeg: number;
  /** Tail / cloak / tentacle / quill cycle duration in ms */
  tailCycleMs: number;
  /** Tail / cloak / tentacle wag amplitude in degrees */
  tailWagDeg: number;
  /** Idle body bob / prowl tilt in degrees */
  idleTiltDeg: number;
  /** Whether this foe naturally snoozes when idle (e.g. Dozy Bunny, Lazy Sloth) */
  naturallySleepy?: boolean;
  /** Duration (ms) a one-shot reaction holds its expression before settling */
  reactionHoldMs: Record<EnemyReactionType, number>;
}

const DEFAULT_ENEMY_REACTION_HOLD_MS: Record<EnemyReactionType, number> = {
  pain: 760,
  crit_pain: 1050,
  taunt: 920,
  attack: 880,
  regen: 900,
  poke: 700,
  rage_spin: 1200,
  entrance: 820,
};

export const TIER_AURA_COLORS: Record<1 | 2 | 3 | 4, string> = {
  1: COLORS.logicTeal,
  2: COLORS.impactOrange,
  3: COLORS.impactRed,
  4: '#7C3AED',
};

const FAST_CRITTER_NAMES = new Set([
  'Swift Bee',
  'Sneaky Mouse',
  'Junk Rat',
  'Greedy Squirrel',
  'Nutkin',
  'Chihuahua',
  'Swarming Ants',
  'Scout Ant',
  'Soldier Ant',
  'Queen Ant',
  'Punishing Ermine',
  'Wild Goose',
  'Prism Moth',
  'Shadow Bat',
]);

const HEAVY_BRUTE_NAMES = new Set([
  'Iron Shell',
  'Stone Sentinel',
  'One-Eyed Terror',
  'Dusty Mammoth',
  'Mammoth',
  'Raging Bear',
  'Polar Guardian',
  'Charging Boar',
  'Armored Tusks',
  'Ancient Dragon',
  'The Hydra',
  "Kraken's Grasp",
  'World Eater',
]);

const SLEEPY_NAMES = new Set(['Dozy Bunny', 'Lazy Sloth']);

const BOSS_NAMES = new Set([
  'Ancient Dragon',
  'The Hydra',
  "Kraken's Grasp",
  'The Reaper',
  'World Eater',
]);

function hashName(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Deterministic personality & motion physics for every enemy in NShapes.
 */
export function getEnemyPersonality(enemyName?: string | null, tierOverride?: number): EnemyPersonalityProfile {
  const name = enemyName || 'Sparring Foe';
  const inferredTier = (
    tierOverride && tierOverride >= 1 && tierOverride <= 4
      ? tierOverride
      : BOSS_NAMES.has(name)
        ? 4
        : 1
  ) as 1 | 2 | 3 | 4;

  const h = hashName(name);
  const isFast = FAST_CRITTER_NAMES.has(name);
  const isHeavy = HEAVY_BRUTE_NAMES.has(name);
  const isSleepy = SLEEPY_NAMES.has(name);

  const breathCycleMs = isSleepy
    ? 3400
    : isFast
      ? 1450 + (h % 320)
      : isHeavy
        ? 2850 + (h % 450)
        : 2150 + (h % 420);

  const breathIntensity = isHeavy ? 0.038 : isFast ? 0.034 : 0.03;
  const earSwayDeg = isFast ? 11 : isHeavy ? 6.5 : 8.5;
  const tailCycleMs = isFast ? 780 + (h % 280) : isHeavy ? 2100 + (h % 400) : 1480 + (h % 360);
  const tailWagDeg = isFast ? 16 : isHeavy ? 10 : 13;
  const idleTiltDeg = isHeavy ? 1.6 : isFast ? 2.8 : 2.1;

  const auraColor = TIER_AURA_COLORS[inferredTier];
  const irisColor =
    inferredTier === 4
      ? '#EF4444'
      : inferredTier === 3
        ? '#DC2626'
        : inferredTier === 2
          ? '#D97706'
          : COLORS.slateCharcoal;

  return {
    name,
    tier: inferredTier,
    primaryColor: COLORS.slateCharcoal,
    secondaryColor: COLORS.paperBeige,
    accentColor: auraColor,
    auraColor,
    irisColor,
    breathCycleMs,
    breathIntensity,
    earSwayDeg,
    tailCycleMs,
    tailWagDeg,
    idleTiltDeg,
    naturallySleepy: isSleepy,
    reactionHoldMs: DEFAULT_ENEMY_REACTION_HOLD_MS,
  };
}

/**
 * Pure mapping from (hp, maxHp) -> EnemyHealthState.
 */
export function getEnemyHealthState(hp?: number, maxHp: number = 3): EnemyHealthState {
  return getFighterHealthState(hp, maxHp);
}

/**
 * Resolves live combat mood for an enemy from HP, boss/tier status, and inactivity pressure.
 */
export function resolveEnemyAmbientMood(params: {
  hp?: number;
  maxHp?: number;
  isBoss?: boolean;
  inactivityRatio?: number;
  isActiveCombat?: boolean;
  naturallySleepy?: boolean;
}): EnemyAmbientMood {
  const {
    hp,
    maxHp = 100,
    isBoss = false,
    inactivityRatio = 0,
    isActiveCombat = false,
    naturallySleepy = false,
  } = params;

  if (hp !== undefined && hp <= 0) {
    return 'defeat';
  }

  const ratio = hp !== undefined && maxHp > 0 ? hp / maxHp : 1;

  if (inactivityRatio >= 0.65 || (isBoss && isActiveCombat && ratio <= 0.6)) {
    return 'enraged';
  }

  if (ratio <= 0.3) {
    return 'cornered';
  }

  if (naturallySleepy && ratio >= 0.95) {
    return 'sleepy';
  }

  if (isActiveCombat) {
    return 'menacing';
  }

  return 'idle';
}

/**
 * Resolves exact facial expression for an enemy rig.
 */
export function resolveEnemyExpression(params: {
  healthState: EnemyHealthState;
  mood: EnemyAmbientMood;
  activeReaction: EnemyReactionType | null;
  isBlinking: boolean;
}): EnemyExpression {
  const { healthState, mood, activeReaction, isBlinking } = params;

  if (healthState === 'knocked_out' && activeReaction !== 'regen') {
    return 'ko';
  }

  if (activeReaction) {
    switch (activeReaction) {
      case 'pain':
      case 'crit_pain':
        return 'wince';
      case 'taunt':
      case 'regen':
        return 'wicked_glee';
      case 'attack':
      case 'rage_spin':
      case 'entrance':
        return 'enraged';
      case 'poke':
        return 'startled';
    }
  }

  if (mood === 'defeat') return 'ko';
  if (mood === 'victory') return 'wicked_glee';
  if (mood === 'enraged') return 'enraged';
  if (mood === 'sleepy') return 'sleepy';

  if (isBlinking) {
    return 'blink';
  }

  if (healthState === 'critical' || healthState === 'battered' || mood === 'cornered') {
    return 'bruised_grit';
  }

  return 'menacing';
}

/**
 * Worklet-safe oscillator loop rate targets for enemy moods.
 */
export function computeEnemyMoodLoopRates(
  breathCycleMs: number,
  tailCycleMs: number,
  mood: EnemyAmbientMood,
  healthState: EnemyHealthState
): MoodLoopRates {
  'worklet';
  let breathMult = 1.0;
  let wagMult = 1.0;
  let swayMult = 1.0;
  let breathAmpScale = 1.0;
  let wagAmpScale = 1.0;
  let swayAmpScale = 1.0;

  if (mood === 'menacing') {
    breathMult = 1.16;
    wagMult = 1.25;
    swayMult = 1.12;
    breathAmpScale = 1.08;
    wagAmpScale = 1.15;
  } else if (mood === 'cornered') {
    breathMult = 1.65;
    wagMult = 1.5;
    swayMult = 1.45;
    breathAmpScale = 1.28;
    wagAmpScale = 1.18;
  } else if (mood === 'enraged') {
    breathMult = 1.52;
    wagMult = 1.95;
    swayMult = 1.55;
    breathAmpScale = 1.32;
    wagAmpScale = 1.45;
    swayAmpScale = 1.3;
  } else if (mood === 'victory') {
    breathMult = 1.45;
    wagMult = 1.8;
    swayMult = 1.4;
    breathAmpScale = 1.2;
    wagAmpScale = 1.35;
  } else if (mood === 'sleepy') {
    breathMult = 0.52;
    wagMult = 0.4;
    swayMult = 0.45;
    breathAmpScale = 1.22;
    wagAmpScale = 0.35;
    swayAmpScale = 0.5;
  } else if (mood === 'defeat') {
    breathMult = 0.62;
    wagMult = 0.25;
    swayMult = 0.42;
    breathAmpScale = 0.7;
    wagAmpScale = 0.08;
    swayAmpScale = 0.3;
  }

  if (healthState === 'critical') {
    breathMult *= 1.38;
    breathAmpScale *= 1.3;
  } else if (healthState === 'battered') {
    breathMult *= 1.14;
    breathAmpScale *= 1.12;
  }

  const baseBreathHz = 1000 / Math.max(600, breathCycleMs);
  const baseWagHz = 1000 / Math.max(400, tailCycleMs);
  const baseSwayHz = baseBreathHz * 0.618;

  return {
    breathHz: baseBreathHz * breathMult,
    wagHz: baseWagHz * wagMult,
    swayHz: baseSwayHz * swayMult,
    breathAmpScale,
    wagAmpScale,
    swayAmpScale,
  };
}

/**
 * Worklet-safe resting posture targets for enemy moods, blended via second-order dynamics.
 */
export function computeEnemyMoodPoseTargets(
  mood: EnemyAmbientMood,
  healthState: EnemyHealthState,
  size: number,
  gazeX = 0,
  gazeY = 0
): MoodPoseTargets {
  'worklet';
  let leanX = gazeX * size * 0.013;
  let leanY = 0;
  let bodyTiltDeg = gazeX * 1.2;
  let headTiltDeg = gazeX * 2.9;
  let headY = gazeY * size * 0.012;
  let leftEarDeg = 0;
  let rightEarDeg = 0;
  let postureStretchY = 1.0;

  if (healthState === 'knocked_out') {
    return {
      leanX: size * 0.022,
      leanY: size * 0.07,
      bodyTiltDeg: 10.5,
      headTiltDeg: 8.0,
      headY: size * 0.034,
      leftEarDeg: 14,
      rightEarDeg: -14,
      postureStretchY: 0.9,
    };
  }

  switch (mood) {
    case 'menacing':
      leanY = size * 0.014;
      headTiltDeg -= 2.2;
      headY += size * 0.008;
      leftEarDeg = -7;
      rightEarDeg = 7;
      postureStretchY = 0.985;
      break;

    case 'cornered':
      leanY = size * 0.024;
      bodyTiltDeg += 2.5;
      headTiltDeg -= 3.5;
      leftEarDeg = 9;
      rightEarDeg = -9;
      postureStretchY = 0.955;
      break;

    case 'enraged':
      leanY = -size * 0.02;
      headY -= size * 0.015;
      leftEarDeg = -13;
      rightEarDeg = 13;
      postureStretchY = 1.045;
      break;

    case 'sleepy':
      leanY = size * 0.026;
      bodyTiltDeg += 2.8;
      headTiltDeg += 5.5;
      headY += size * 0.028;
      leftEarDeg = 10;
      rightEarDeg = -10;
      postureStretchY = 0.955;
      break;

    case 'victory':
      leanY = -size * 0.028;
      leftEarDeg = -11;
      rightEarDeg = 11;
      postureStretchY = 1.05;
      break;

    case 'defeat':
      leanY = size * 0.048;
      bodyTiltDeg += 6.0;
      headTiltDeg += 7.0;
      headY += size * 0.032;
      leftEarDeg = 12;
      rightEarDeg = -12;
      postureStretchY = 0.925;
      break;

    case 'idle':
    default:
      break;
  }

  if (healthState === 'critical' && mood !== 'victory') {
    leanY += size * 0.018;
    bodyTiltDeg += 2.2;
    postureStretchY *= 0.968;
  } else if (healthState === 'battered' && mood !== 'victory') {
    leanY += size * 0.008;
  }

  return {
    leanX,
    leanY,
    bodyTiltDeg,
    headTiltDeg,
    headY,
    leftEarDeg,
    rightEarDeg,
    postureStretchY,
  };
}
