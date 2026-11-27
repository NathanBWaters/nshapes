import { COLORS } from './colors';
import {
  CreatureHealthState,
  MoodMotionTable,
  getCreatureHealthState,
} from './creatureAnimations';
import { ENEMY_ATTACK, MASS_CLASS, MassClass, PHASE } from './motion';

/**
 * Enemy battle-wear state: pristine -> scuffed -> battered -> critical -> knocked_out.
 */
export type EnemyHealthState = CreatureHealthState;

/**
 * Species acting archetype driving distinct limb, wingbeat, multi-head, pincer, and boss kinematics.
 */
export type EnemySpeciesClass = 'standard' | 'winged' | 'hydra' | 'pincer' | 'boss';

/**
 * Continuous ambient moods for enemies & foes.
 */
export const ENEMY_AMBIENT_MOODS = [
  'idle',      // Calm menacing breath + blinks + micro-fidgets (map, previews, menus)
  'menacing',  // Active combat stance: coiled, alert predator eyes
  'enraged',   // Boss fury / high inactivity pressure / player mistake streak: fierce blazing aura
  'cornered',  // Low HP (<=30%): rapid ragged panting, hunched guard, sweat
  'sleepy',    // Dozy Bunny / Lazy Sloth / idle board: heavy drowsy eyelids
  'victory',   // Player lost! Wicked gloating victory bounce
  'defeat',    // Enemy knocked out: slumped KO posture + X_X eyes
] as const;

export type EnemyAmbientMood = (typeof ENEMY_AMBIENT_MOODS)[number];

/**
 * Discrete one-shot enemy reactions triggered by gameplay or taps.
 */
export const ENEMY_REACTION_TYPES = [
  'pain',       // Player matched a Set! Enemy flinches/recoils with wince & impact sparks
  'crit_pain',  // Rainbow Strike / Mega-match / Combo / Grudge! Big stagger spin & heavy burst
  'taunt',      // Player made an invalid mistake! Wicked cackle & smug bounce
  'attack',     // Enemy triggered time steal / bomb / shuffle / inactivity hit! Fierce forward lunge
  'regen',      // Enemy healed/regenerated HP (e.g. Circling Vulture)! Eerie mend pulse
  'poke',       // Player tapped/poked the enemy! Snappy annoyed growl & glare
  'rage_spin',  // Rapid 5x poke easter egg! Furious tornado spin & dark sparks
  'entrance',   // Fight start or new wave arrival! Heavy stomp crouch & menacing roar
] as const;

export type EnemyReactionType = (typeof ENEMY_REACTION_TYPES)[number];

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
  auraColor: string;
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
}

/** Duration (ms) a one-shot enemy reaction holds its expression before settling */
export const ENEMY_REACTION_HOLD_MS: Record<EnemyReactionType, number> = {
  pain: 760,
  crit_pain: 920,
  taunt: 840,
  attack: 820,
  regen: 860,
  poke: 640,
  rage_spin: 880,
  entrance: 640,
};

export type EnemyTier = 1 | 2 | 3 | 4;

/** Tier accent colour: aura, portrait frame and tier dot. */
export const TIER_AURA_COLORS: Record<EnemyTier, string> = {
  1: COLORS.logicTeal,
  2: COLORS.impactOrange,
  3: COLORS.impactRed,
  4: '#7C3AED',
};

/** How a creature's build shapes its rhythm: twitchy critter, lumbering brute, or neither. */
export type EnemyMotionClass = 'fast' | 'heavy';

function hashName(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * Computes the exact attack strike launch offset (ms) for a given `MassClass`,
 * keeping visual slash/spark bursts strictly synced to the lunge frame (zero premature VFX).
 */
export function getEnemyAttackTimings(massClass: MassClass = 'standard'): {
  windMs: number;
  coilHoldMs: number;
  strikeMs: number;
  apexHoldMs: number;
  strikeStartMs: number;
} {
  if (massClass === 'boss') {
    const windMs = PHASE.bossWindMs;
    const coilHoldMs = PHASE.bossCoilHoldMs;
    const strikeMs = ENEMY_ATTACK.strikeMs;
    const apexHoldMs = PHASE.bossApexHoldMs;
    return { windMs, coilHoldMs, strikeMs, apexHoldMs, strikeStartMs: windMs + coilHoldMs };
  }
  const timeMult = MASS_CLASS[massClass].timeMult;
  const windMs = Math.round(ENEMY_ATTACK.windMs * timeMult);
  const coilHoldMs = Math.round(ENEMY_ATTACK.coilHoldMs * timeMult);
  const strikeMs = ENEMY_ATTACK.strikeMs;
  const apexHoldMs = Math.round(ENEMY_ATTACK.apexHoldMs * timeMult);
  return { windMs, coilHoldMs, strikeMs, apexHoldMs, strikeStartMs: windMs + coilHoldMs };
}

/**
 * Deterministic personality & motion physics for an enemy of the given build, species class, and tier.
 */
export function buildEnemyPersonality(params: {
  name: string;
  tier: EnemyTier;
  motionClass?: EnemyMotionClass;
  speciesClass?: EnemySpeciesClass;
  isBoss?: boolean;
  naturallySleepy?: boolean;
}): EnemyPersonalityProfile {
  const { name, tier, motionClass, speciesClass = 'standard', isBoss = false, naturallySleepy = false } = params;
  const h = hashName(name);
  const isFast = motionClass === 'fast';
  const isHeavy = motionClass === 'heavy';
  const isWinged = speciesClass === 'winged';
  const isHydra = speciesClass === 'hydra';

  // Winged critters get brisk rhythmic wingbeats (`breathPhase` drives asymmetric wing layers);
  // bosses keep deep weighty chest heaves (`2850–3300ms`, 0.042 intensity).
  let breathCycleMs: number;
  if (naturallySleepy) {
    breathCycleMs = 3400;
  } else if (isWinged && !isBoss) {
    breathCycleMs = isFast ? 520 + (h % 120) : 920 + (h % 180);
  } else if (isBoss || tier >= 4) {
    breathCycleMs = isWinged ? 2550 + (h % 250) : 2880 + (h % 380);
  } else if (isFast) {
    breathCycleMs = 1450 + (h % 320);
  } else if (isHeavy) {
    breathCycleMs = 2850 + (h % 450);
  } else {
    breathCycleMs = 2150 + (h % 420);
  }

  const breathIntensity =
    isWinged && !isBoss
      ? isFast
        ? 0.024
        : 0.028
      : isBoss || tier >= 4
        ? 0.042
        : isHeavy
          ? 0.038
          : isFast
            ? 0.034
            : 0.03;

  const earSwayDeg = isWinged
    ? isFast
      ? 26
      : isBoss
        ? 15
        : 19
    : isHydra
      ? 14.5
      : isFast
        ? 11
        : isHeavy
          ? 6.5
          : 8.5;

  return {
    name,
    auraColor: TIER_AURA_COLORS[tier],
    breathCycleMs,
    breathIntensity,
    earSwayDeg,
    tailCycleMs: isFast ? 780 + (h % 280) : isBoss || isHeavy ? 2100 + (h % 400) : 1480 + (h % 360),
    tailWagDeg: isHydra ? 15 : isFast ? 16 : isHeavy ? 10 : 13,
    idleTiltDeg: isWinged && isFast ? 3.2 : isBoss || isHeavy ? 1.6 : isFast ? 2.8 : 2.1,
    naturallySleepy,
  };
}

/**
 * Pure mapping from (hp, maxHp) -> EnemyHealthState.
 */
export const getEnemyHealthState = getCreatureHealthState;

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
 * Supports both legacy boolean `isBlinking` and 3-step `blinkStage` (`2` → `'blink'`,
 * `1` keeps base expression while `EnemyEyes` renders `HalfBlinkLidEye`).
 */
export function resolveEnemyExpression(params: {
  healthState: EnemyHealthState;
  mood: EnemyAmbientMood;
  activeReaction: EnemyReactionType | null;
  isBlinking: boolean;
  blinkStage?: 0 | 1 | 2;
}): EnemyExpression {
  const { healthState, mood, activeReaction, isBlinking, blinkStage } = params;

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

  if (blinkStage === 2 || (blinkStage === undefined && isBlinking)) {
    return 'blink';
  }

  if (healthState === 'critical' || healthState === 'battered' || mood === 'cornered') {
    return 'bruised_grit';
  }

  return 'menacing';
}

/** Ambient rhythm & posture of enemies per mood and health state. */
export const ENEMY_MOOD_MOTION: MoodMotionTable<EnemyAmbientMood> = {
  rates: {
    menacing: { breath: 1.16, wag: 1.25, sway: 1.12, breathAmp: 1.08, wagAmp: 1.15 },
    cornered: { breath: 1.65, wag: 1.5, sway: 1.45, breathAmp: 1.28, wagAmp: 1.18 },
    enraged: { breath: 1.52, wag: 1.95, sway: 1.55, breathAmp: 1.32, wagAmp: 1.45, swayAmp: 1.3 },
    victory: { breath: 1.45, wag: 1.8, sway: 1.4, breathAmp: 1.2, wagAmp: 1.35 },
    sleepy: { breath: 0.52, wag: 0.4, sway: 0.45, breathAmp: 1.22, wagAmp: 0.35, swayAmp: 0.5 },
    defeat: { breath: 0.62, wag: 0.25, sway: 0.42, breathAmp: 0.7, wagAmp: 0.08, swayAmp: 0.3 },
  },
  criticalBreath: { rate: 1.38, amp: 1.3 },
  batteredBreath: { rate: 1.14, amp: 1.12 },
  gazeFollow: { leanX: 0.013, bodyTiltDeg: 1.2, headTiltDeg: 2.9, headY: 0.012 },
  poses: {
    menacing: { leanY: 0.014, headTiltDeg: -2.2, headY: 0.008, leftEarDeg: -7, rightEarDeg: 7, postureStretchY: 0.985 },
    cornered: { leanY: 0.024, bodyTiltDeg: 2.5, headTiltDeg: -3.5, leftEarDeg: 9, rightEarDeg: -9, postureStretchY: 0.955 },
    enraged: { leanY: -0.02, headY: -0.015, leftEarDeg: -13, rightEarDeg: 13, postureStretchY: 1.045 },
    sleepy: { leanY: 0.026, bodyTiltDeg: 2.8, headTiltDeg: 5.5, headY: 0.028, leftEarDeg: 10, rightEarDeg: -10, postureStretchY: 0.955 },
    victory: { leanY: -0.028, leftEarDeg: -11, rightEarDeg: 11, postureStretchY: 1.05 },
    defeat: { leanY: 0.048, bodyTiltDeg: 6.0, headTiltDeg: 7.0, headY: 0.032, leftEarDeg: 12, rightEarDeg: -12, postureStretchY: 0.925 },
  },
  knockedOutPose: {
    leanX: 0.022,
    leanY: 0.07,
    bodyTiltDeg: 10.5,
    headTiltDeg: 8.0,
    headY: 0.034,
    leftEarDeg: 14,
    rightEarDeg: -14,
    postureStretchY: 0.9,
  },
  criticalPose: { leanY: 0.018, bodyTiltDeg: 2.2, postureStretchYScale: 0.968 },
  batteredLeanY: 0.008,
  celebrationMood: 'victory',
};
