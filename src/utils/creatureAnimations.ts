import { MoodLoopRates, MoodPoseTargets } from './proceduralMotion';

/**
 * Progressive battle-wear state shared by fighters and enemies, driven by current
 * health vs max health. As health drops the creature looks more scuffed and bandaged.
 */
export type CreatureHealthState =
  | 'pristine'     // Full HP
  | 'scuffed'      // >50% HP (and >1 HP)
  | 'battered'     // 26%–50% HP (and >1 HP)
  | 'critical'     // 1 HP or <=25% HP
  | 'knocked_out'; // 0 HP

/**
 * Pure mapping from (health, maxHealth) -> CreatureHealthState.
 *
 * - 3/3 -> 'pristine', 2/3 -> 'scuffed', 1/3 -> 'critical', 0/3 -> 'knocked_out'
 * - 4/4 -> 'pristine', 3/4 -> 'scuffed', 2/4 -> 'battered', 1/4 -> 'critical', 0/4 -> 'knocked_out'
 */
export function getCreatureHealthState(health?: number, maxHealth: number = 3): CreatureHealthState {
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

/** Oscillator multipliers a mood applies on top of a creature's base rhythm (all default to 1). */
export interface MoodRateMultipliers {
  breath?: number;
  wag?: number;
  sway?: number;
  breathAmp?: number;
  wagAmp?: number;
  swayAmp?: number;
}

/**
 * Resting-pose adjustments a mood layers over the gaze-following base pose.
 * Lengths are fractions of avatar size; angles are degrees.
 */
export interface MoodPoseOffsets {
  leanY?: number;
  bodyTiltDeg?: number;
  headTiltDeg?: number;
  headY?: number;
  leftEarDeg?: number;
  rightEarDeg?: number;
  postureStretchY?: number;
}

/**
 * Everything that distinguishes one family of creatures' ambient motion from another:
 * per-mood rhythm and posture, how wounds change them, and the knocked-out slump.
 */
export interface MoodMotionTable<Mood extends string> {
  rates: Partial<Record<Mood, MoodRateMultipliers>>;
  /** Fixed loop rates while knocked out; omit to keep the mood's own rhythm. */
  knockedOutRates?: MoodLoopRates;
  criticalBreath: { rate: number; amp: number };
  batteredBreath: { rate: number; amp: number };
  /** How far the body leans/tilts toward where the eyes look. */
  gazeFollow: { leanX: number; bodyTiltDeg: number; headTiltDeg: number; headY: number };
  poses: Partial<Record<Mood, MoodPoseOffsets>>;
  /** Resting pose while knocked out (lengths as fractions of avatar size). */
  knockedOutPose: Required<MoodPoseOffsets> & { leanX: number };
  /** Extra slump at critical health (skipped while celebrating). */
  criticalPose: { leanY: number; bodyTiltDeg: number; postureStretchYScale: number };
  /** Extra slump at battered health (skipped while celebrating). */
  batteredLeanY: number;
  /** Mood that ignores wound slumps. */
  celebrationMood: Mood;
}

/**
 * Continuous oscillator target frequencies & amplitude multipliers for a mood/health state.
 * Smoothly interpolated on the UI thread so loops accelerate/decelerate without phase resets.
 */
export function computeMoodLoopRates<Mood extends string>(
  table: MoodMotionTable<Mood>,
  mood: Mood,
  healthState: CreatureHealthState,
  breathCycleMs: number,
  tailCycleMs: number
): MoodLoopRates {
  if (healthState === 'knocked_out' && table.knockedOutRates) {
    return table.knockedOutRates;
  }

  const m = table.rates[mood] ?? {};
  let breathMult = m.breath ?? 1.0;
  const wagMult = m.wag ?? 1.0;
  const swayMult = m.sway ?? 1.0;
  let breathAmpScale = m.breathAmp ?? 1.0;
  const wagAmpScale = m.wagAmp ?? 1.0;
  const swayAmpScale = m.swayAmp ?? 1.0;

  if (healthState === 'critical') {
    breathMult *= table.criticalBreath.rate;
    breathAmpScale *= table.criticalBreath.amp;
  } else if (healthState === 'battered') {
    breathMult *= table.batteredBreath.rate;
    breathAmpScale *= table.batteredBreath.amp;
  }

  const baseBreathHz = 1000 / Math.max(600, breathCycleMs);
  const baseWagHz = 1000 / Math.max(400, tailCycleMs);
  // Golden ratio keeps sway from locking into step with breathing
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
 * Resting posture targets for a mood, health state, and eye gaze.
 * Blended continuously through second-order dynamics so state changes never cut or snap.
 */
export function computeMoodPoseTargets<Mood extends string>(
  table: MoodMotionTable<Mood>,
  mood: Mood,
  healthState: CreatureHealthState,
  size: number,
  gazeX = 0,
  gazeY = 0
): MoodPoseTargets {
  if (healthState === 'knocked_out') {
    const ko = table.knockedOutPose;
    return {
      leanX: size * ko.leanX,
      leanY: size * ko.leanY,
      bodyTiltDeg: ko.bodyTiltDeg,
      headTiltDeg: ko.headTiltDeg,
      headY: size * ko.headY,
      leftEarDeg: ko.leftEarDeg,
      rightEarDeg: ko.rightEarDeg,
      postureStretchY: ko.postureStretchY,
    };
  }

  const follow = table.gazeFollow;
  const p = table.poses[mood] ?? {};

  const leanX = gazeX * size * follow.leanX;
  let leanY = size * (p.leanY ?? 0);
  let bodyTiltDeg = gazeX * follow.bodyTiltDeg + (p.bodyTiltDeg ?? 0);
  const headTiltDeg = gazeX * follow.headTiltDeg + (p.headTiltDeg ?? 0);
  const headY = gazeY * size * follow.headY + size * (p.headY ?? 0);
  let postureStretchY = p.postureStretchY ?? 1.0;

  if (mood !== table.celebrationMood) {
    if (healthState === 'critical') {
      leanY += size * table.criticalPose.leanY;
      bodyTiltDeg += table.criticalPose.bodyTiltDeg;
      postureStretchY *= table.criticalPose.postureStretchYScale;
    } else if (healthState === 'battered') {
      leanY += size * table.batteredLeanY;
    }
  }

  return {
    leanX,
    leanY,
    bodyTiltDeg,
    headTiltDeg,
    headY,
    leftEarDeg: p.leftEarDeg ?? 0,
    rightEarDeg: p.rightEarDeg ?? 0,
    postureStretchY,
  };
}
