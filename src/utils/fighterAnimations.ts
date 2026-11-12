import { CharacterName } from '@/types';
import { COLORS } from './colors';
import {
  CreatureHealthState,
  MoodMotionTable,
  getCreatureHealthState,
} from './creatureAnimations';

/**
 * Progressive battle-wear state driven by current health vs maxHealth.
 * As health drops, the fighter looks visibly more scuffed, bandaged, and gritty.
 */
export type FighterHealthState = CreatureHealthState;

/**
 * Continuous ambient moods reflecting ongoing board/round context.
 */
export const FIGHTER_AMBIENT_MOODS = [
  'idle',          // Default calm, living breathing + blinks + micro-motions
  'curious',       // 1 card selected: ears/crest perk, attentive eyes
  'anticipation',  // 2 cards selected: eager forward lean & fast wag waiting for 3rd card!
  'streak',        // 3+ consecutive valid matches: "in the zone" starry/fierce aura
  'urgent',        // Low time (<10s) & score below target: sweaty clock-panic
  'sleepy',        // No board interaction for 8+ seconds: drowsy half-lids + floating zZz
  'victory',       // End-of-round / Victory / Unlock continuous celebration dance
  'defeat',        // Time-out loss (when health > 0): droopy dejected sigh
] as const;

export type FighterAmbientMood = (typeof FIGHTER_AMBIENT_MOODS)[number];

/**
 * One-shot expressive reactions triggered by discrete gameplay or user events.
 */
export const FIGHTER_REACTION_TYPES = [
  'joy',        // Valid SET match! Squash -> joyful leap -> creature cheer
  'ecstatic',   // 3+ match streak OR explosive/laser/echo mega-match! Big flip/spin + stars
  'pain',       // Invalid match (lost HP) or enemy tick/bomb damage! Recoil shake + wince
  'relief',     // Near-miss saved by Grace! Startled flinch -> "Phew!" sweat-wipe + clover
  'heal',       // Gained HP! Warm float + blissful smile + rising emerald hearts/crosses
  'powerup',    // Level up or weapon acquired! Heroic surge + golden shockwave ring
  'hint',       // Manual or auto-hint spotted a pattern! Curious tilt + lightbulb gleam
  'pet',        // Player tapped/petted the fighter! Happy squish + rosy blush + floating heart
  'dizzy_joy',  // Rapid 5x pet easter egg! Joyful zoomie spin + rainbow star burst
  'entrance',   // Selected on Character Select or Round Start! Eager battle salute
] as const;

export type FighterReactionType = (typeof FIGHTER_REACTION_TYPES)[number];

export interface FighterReactionEvent {
  type: FighterReactionType;
  /** Monotonically increasing ID so identical consecutive reactions re-trigger cleanly */
  id: number;
}

/**
 * Resolved facial expression rendered by the creature's face layer.
 */
export type FighterExpression =
  | 'normal'
  | 'blink'
  | 'happy'
  | 'starry'
  | 'wince'
  | 'relieved'
  | 'eager'
  | 'panic'
  | 'sleepy'
  | 'determined'
  | 'bruised_grit'
  | 'ko'
  | 'sad'
  | 'blush'
  | 'aha';

/**
 * Per-fighter personality & physics parameters so every creature moves and emotes distinctly.
 */
export interface FighterPersonalityProfile {
  name: CharacterName | string;
  auraColor: string;
  /** Idle breathing cycle duration in ms (lower = peppier) */
  breathCycleMs: number;
  /** Idle breathing vertical scale intensity */
  breathIntensity: number;
  /** Appendage (ear/wing/flipper) idle sway amplitude in degrees */
  earSwayDeg: number;
  /** Tail / pouch idle wag cycle duration in ms */
  tailCycleMs: number;
  /** Tail / pouch idle wag amplitude in degrees */
  tailWagDeg: number;
  /** Idle body bob / waddle tilt in degrees */
  idleTiltDeg: number;
  /** Signature particle motif spawned during joy/ecstatic reactions */
  signatureMotif: 'hearts' | 'embers' | 'frost' | 'stars' | 'splash' | 'shockwave';
}

/** Duration (ms) a one-shot fighter reaction holds its expression before settling */
export const FIGHTER_REACTION_HOLD_MS: Record<FighterReactionType, number> = {
  joy: 900,
  ecstatic: 1200,
  pain: 800,
  relief: 950,
  heal: 950,
  powerup: 1050,
  hint: 800,
  pet: 750,
  dizzy_joy: 1250,
  entrance: 750,
};

const FALLBACK_PERSONALITY: FighterPersonalityProfile = {
  name: 'Fighter',
  auraColor: COLORS.logicTeal,
  breathCycleMs: 2500,
  breathIntensity: 0.03,
  earSwayDeg: 7,
  tailCycleMs: 1800,
  tailWagDeg: 12,
  idleTiltDeg: 2.0,
  signatureMotif: 'stars',
};

/** Personality for a character with no bespoke registry entry. */
export function fallbackFighterPersonality(characterName?: string | null): FighterPersonalityProfile {
  if (!characterName) return FALLBACK_PERSONALITY;
  return { ...FALLBACK_PERSONALITY, name: characterName };
}

/**
 * Pure mapping from (health, maxHealth) -> FighterHealthState.
 */
export const getFighterHealthState = getCreatureHealthState;

/** Ambient rhythm & posture of fighters per mood and health state. */
export const FIGHTER_MOOD_MOTION: MoodMotionTable<FighterAmbientMood> = {
  rates: {
    anticipation: { breath: 1.95, wag: 2.45, sway: 1.65, breathAmp: 1.15, wagAmp: 1.38, swayAmp: 0.85 },
    curious: { breath: 1.15, wag: 1.35, sway: 0.9, wagAmp: 1.12 },
    urgent: { breath: 2.35, wag: 2.1, sway: 2.4, breathAmp: 1.25, swayAmp: 1.35 },
    victory: { breath: 2.05, wag: 2.5, sway: 1.95, breathAmp: 1.3, wagAmp: 1.45, swayAmp: 1.65 },
    streak: { breath: 1.42, wag: 1.75, sway: 1.35, breathAmp: 1.15, wagAmp: 1.24 },
    // Deep slow snoozing breaths
    sleepy: { breath: 0.52, wag: 0.42, sway: 0.48, breathAmp: 1.22, wagAmp: 0.35, swayAmp: 0.55 },
    defeat: { breath: 0.68, wag: 0.3, sway: 0.5, breathAmp: 0.75, wagAmp: 0.08, swayAmp: 0.35 },
  },
  knockedOutRates: {
    breathHz: 0.28,
    wagHz: 0.15,
    swayHz: 0.2,
    breathAmpScale: 0.22,
    wagAmpScale: 0,
    swayAmpScale: 0.12,
  },
  // Heavy low-HP panting
  criticalBreath: { rate: 1.45, amp: 1.38 },
  batteredBreath: { rate: 1.15, amp: 1.12 },
  gazeFollow: { leanX: 0.012, bodyTiltDeg: 1.1, headTiltDeg: 2.8, headY: 0.012 },
  poses: {
    curious: { leanY: -0.015, headTiltDeg: 7.2, headY: -0.01, leftEarDeg: -11, rightEarDeg: 4, postureStretchY: 1.025 },
    // Alert pounce-ready coil: slight forward crouch, perked radar ears
    anticipation: { leanY: 0.018, headTiltDeg: 2.2, headY: -0.016, leftEarDeg: -13, rightEarDeg: 13, postureStretchY: 0.965 },
    streak: { leanY: -0.02, leftEarDeg: -6, rightEarDeg: 6, postureStretchY: 1.035 },
    urgent: { leanY: 0.012, leftEarDeg: 6, rightEarDeg: -6, postureStretchY: 0.975 },
    sleepy: { leanY: 0.026, bodyTiltDeg: 2.5, headTiltDeg: 5.5, headY: 0.028, leftEarDeg: 9, rightEarDeg: -9, postureStretchY: 0.955 },
    victory: { leanY: -0.028, leftEarDeg: -10, rightEarDeg: 10, postureStretchY: 1.045 },
    defeat: { leanY: 0.045, bodyTiltDeg: -5.2, headTiltDeg: -6.5, headY: 0.03, leftEarDeg: 11, rightEarDeg: -11, postureStretchY: 0.935 },
  },
  knockedOutPose: {
    leanX: -0.02,
    leanY: 0.068,
    bodyTiltDeg: -9.5,
    headTiltDeg: -7.5,
    headY: 0.032,
    leftEarDeg: 13,
    rightEarDeg: -13,
    postureStretchY: 0.91,
  },
  criticalPose: { leanY: 0.018, bodyTiltDeg: -2.2, postureStretchYScale: 0.97 },
  batteredLeanY: 0.008,
  celebrationMood: 'victory',
};

/**
 * Resolves the ambient mood during a live round from board & timer signals.
 */
export function resolveFighterAmbientMood(params: {
  health: number;
  remainingTime?: number;
  score?: number;
  targetScore?: number;
  selectedCount?: number;
  streak?: number;
  isBoardIdle?: boolean;
}): FighterAmbientMood {
  const {
    health,
    remainingTime,
    score = 0,
    targetScore = 0,
    selectedCount = 0,
    streak = 0,
    isBoardIdle = false,
  } = params;

  if (health <= 0) {
    return 'defeat';
  }

  // Urgent countdown when <= 10s remain and round target isn't yet met
  if (
    remainingTime !== undefined &&
    remainingTime > 0 &&
    remainingTime <= 10 &&
    targetScore > 0 &&
    score < targetScore
  ) {
    return 'urgent';
  }

  // Card selection anticipation!
  if (selectedCount === 2) {
    return 'anticipation';
  }
  if (selectedCount === 1) {
    return 'curious';
  }

  // 3+ consecutive match streak puts the fighter "in the zone"
  if (streak >= 3) {
    return 'streak';
  }

  // Drowsy if player hasn't interacted for a while
  if (isBoardIdle) {
    return 'sleepy';
  }

  return 'idle';
}

/**
 * Resolves the exact facial expression to render right now.
 * Active one-shot reactions take precedence over ambient mood & health wear.
 */
export function resolveFighterExpression(params: {
  healthState: FighterHealthState;
  mood: FighterAmbientMood;
  activeReaction: FighterReactionType | null;
  isBlinking: boolean;
}): FighterExpression {
  const { healthState, mood, activeReaction, isBlinking } = params;

  // Knocked out always shows KO eyes unless actively healing back above 0
  if (healthState === 'knocked_out' && activeReaction !== 'heal') {
    return 'ko';
  }

  // 1. One-shot reactions take highest priority
  if (activeReaction) {
    switch (activeReaction) {
      case 'joy':
        return 'happy';
      case 'ecstatic':
      case 'powerup':
      case 'dizzy_joy':
        return 'starry';
      case 'pain':
        return 'wince';
      case 'relief':
        return 'relieved';
      case 'heal':
        return 'happy';
      case 'hint':
        return 'aha';
      case 'pet':
        return 'blush';
      case 'entrance':
        return 'eager';
    }
  }

  // 2. High-priority continuous moods
  if (mood === 'victory') return 'happy';
  if (mood === 'defeat') return 'sad';
  if (mood === 'urgent') return 'panic';
  if (mood === 'anticipation') return 'eager';
  if (mood === 'sleepy') return 'sleepy';

  // 3. Natural eye blink during calm states
  if (isBlinking) {
    return 'blink';
  }

  if (mood === 'streak') return 'starry';
  if (mood === 'curious') return 'eager';

  // 4. Health-driven resting expression!
  if (healthState === 'critical' || healthState === 'battered') {
    return 'bruised_grit';
  }
  if (healthState === 'scuffed') {
    return 'determined';
  }

  return 'normal';
}
