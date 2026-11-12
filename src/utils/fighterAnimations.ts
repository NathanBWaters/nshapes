import { CharacterName } from '@/types';
import { COLORS } from './colors';

/**
 * Progressive battle-wear state driven by current health vs maxHealth.
 * As health drops, the fighter looks visibly more scuffed, bandaged, and gritty.
 */
export type FighterHealthState =
  | 'pristine'     // Full HP: vibrant, clean coat/plumage, energetic
  | 'scuffed'      // >50% HP (and >1 HP): minor cheek scuff + small band-aid, determined brow
  | 'battered'     // 26%–50% HP (and >1 HP): X-plaster, bruised eye shiner, ruffled fur/feathers, sweat
  | 'critical'     // 1 HP or <=25% HP: gauze head-bandage, X-plaster, squinting bruised eye, heavy pant/tremble
  | 'knocked_out'; // 0 HP: cartoon KO (@_@ / X_X), slumped tilt, orbiting dizzy stars

/**
 * Continuous ambient mood reflecting ongoing board/round context.
 */
export type FighterAmbientMood =
  | 'idle'          // Default calm, living breathing + blinks + micro-motions
  | 'curious'       // 1 card selected: ears/crest perk, attentive eyes
  | 'anticipation'  // 2 cards selected: eager forward lean & fast wag waiting for 3rd card!
  | 'streak'        // 3+ consecutive valid matches: "in the zone" starry/fierce aura
  | 'urgent'        // Low time (<10s) & score below target: sweaty clock-panic
  | 'sleepy'        // No board interaction for 8+ seconds: drowsy half-lids + floating zZz
  | 'victory'       // End-of-round / Victory / Unlock continuous celebration dance
  | 'defeat';       // Time-out loss (when health > 0): droopy dejected sigh

/**
 * One-shot expressive reaction triggered by discrete gameplay or user events.
 */
export type FighterReactionType =
  | 'joy'        // Valid SET match! Squash -> joyful leap -> creature cheer
  | 'ecstatic'   // 3+ match streak OR explosive/laser/echo mega-match! Big flip/spin + stars
  | 'pain'       // Invalid match (lost HP) or enemy tick/bomb damage! Recoil shake + wince
  | 'relief'     // Near-miss saved by Grace! Startled flinch -> "Phew!" sweat-wipe + clover
  | 'heal'       // Gained HP! Warm float + blissful smile + rising emerald hearts/crosses
  | 'powerup'    // Level up or weapon acquired! Heroic surge + golden shockwave ring
  | 'hint'       // Manual or auto-hint spotted a pattern! Curious tilt + lightbulb gleam
  | 'pet'        // Player tapped/petted the fighter! Happy squish + rosy blush + floating heart
  | 'dizzy_joy'  // Rapid 5x pet easter egg! Joyful zoomie spin + rainbow star burst
  | 'entrance';  // Selected on Character Select or Round Start! Eager battle salute

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

const CHARACTER_PERSONALITIES: Record<string, FighterPersonalityProfile> = {
  'Orange Tabby': {
    name: 'Orange Tabby',
    auraColor: '#FF9538',
    breathCycleMs: 2600,
    breathIntensity: 0.032,
    earSwayDeg: 7,
    tailCycleMs: 1800,
    tailWagDeg: 14,
    idleTiltDeg: 1.5,
    signatureMotif: 'hearts',
  },
  'Sly Fox': {
    name: 'Sly Fox',
    auraColor: '#FF6B00',
    breathCycleMs: 2300,
    breathIntensity: 0.028,
    earSwayDeg: 9,
    tailCycleMs: 1500,
    tailWagDeg: 16,
    idleTiltDeg: 2.2,
    signatureMotif: 'embers',
  },
  'Emperor Penguin': {
    name: 'Emperor Penguin',
    auraColor: '#16AA98',
    breathCycleMs: 3000,
    breathIntensity: 0.026,
    earSwayDeg: 10, // Flippers!
    tailCycleMs: 2200,
    tailWagDeg: 8,
    idleTiltDeg: 3.2, // Regal waddle sway!
    signatureMotif: 'frost',
  },
  'Corgi': {
    name: 'Corgi',
    auraColor: '#FFDE00',
    breathCycleMs: 1650, // Peppy happy pant!
    breathIntensity: 0.04,
    earSwayDeg: 11, // Big radar ears!
    tailCycleMs: 520, // Hyper-speed corgi nub wag!
    tailWagDeg: 22,
    idleTiltDeg: 2.5,
    signatureMotif: 'stars',
  },
  'Pelican': {
    name: 'Pelican',
    auraColor: '#16AA98',
    breathCycleMs: 2800,
    breathIntensity: 0.03,
    earSwayDeg: 9, // Wings!
    tailCycleMs: 2000, // Gular throat pouch bob!
    tailWagDeg: 10,
    idleTiltDeg: 1.8,
    signatureMotif: 'splash',
  },
  'Badger': {
    name: 'Badger',
    auraColor: '#16AA98',
    breathCycleMs: 2100, // Grounded boxer bob!
    breathIntensity: 0.036,
    earSwayDeg: 5,
    tailCycleMs: 1700,
    tailWagDeg: 8,
    idleTiltDeg: 2.0,
    signatureMotif: 'shockwave',
  },
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

export function getFighterPersonality(characterName?: string | null): FighterPersonalityProfile {
  if (!characterName) return FALLBACK_PERSONALITY;
  return CHARACTER_PERSONALITIES[characterName] ?? {
    ...FALLBACK_PERSONALITY,
    name: characterName,
  };
}

/**
 * Pure mapping from (health, maxHealth) -> FighterHealthState.
 *
 * Examples:
 * - 3/3 -> 'pristine'
 * - 2/3 -> 'scuffed'
 * - 1/3 -> 'critical'
 * - 0/3 -> 'knocked_out'
 * - 4/4 -> 'pristine', 3/4 -> 'scuffed', 2/4 -> 'battered', 1/4 -> 'critical', 0/4 -> 'knocked_out'
 */
export function getFighterHealthState(health?: number, maxHealth: number = 3): FighterHealthState {
  const safeMax = Math.max(1, maxHealth);
  const safeHealth = health === undefined ? safeMax : health;

  if (safeHealth <= 0) {
    return 'knocked_out';
  }
  if (safeHealth >= safeMax) {
    return 'pristine';
  }

  const ratio = safeHealth / safeMax;
  if (safeHealth === 1 || ratio <= 0.25) {
    return 'critical';
  }
  if (ratio <= 0.5) {
    return 'battered';
  }
  return 'scuffed';
}

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
