import { FighterAmbientMood, FighterHealthState } from './fighterAnimations';

export const TAU = Math.PI * 2;

/**
 * Second-order spring-damper state (position `y`, velocity `yd`, previous target `xp`).
 * Stored inside a Reanimated shared value so `useFrameCallback` can integrate on the UI thread.
 */
export interface SecondOrderState {
  y: number;
  yd: number;
  xp: number;
}

/**
 * Parameterized second-order system `(f, z, r)` inspired by t3ssel8r's procedural motion model:
 * - `f`: natural frequency in Hz (speed of response)
 * - `z`: damping ratio (`< 1` underdamped overshoot, `1` critical, `> 1` overdamped)
 * - `r`: initial velocity response (`0` smooth lag, `> 0` immediate/anticipatory)
 */
export interface SecondOrderParams {
  f: number;
  z: number;
  r: number;
}

export interface MoodPoseTargets {
  leanX: number;
  leanY: number;
  bodyTiltDeg: number;
  headTiltDeg: number;
  headY: number;
  leftEarDeg: number;
  rightEarDeg: number;
  /**Multiplicative vertical posture stretch (>1 tall/alert, <1 crouched/slumped) */
  postureStretchY: number;
}

export interface MoodLoopRates {
  breathHz: number;
  wagHz: number;
  swayHz: number;
  breathAmpScale: number;
  wagAmpScale: number;
  swayAmpScale: number;
}

export function createSecondOrderState(initial = 0): SecondOrderState {
  'worklet';
  return { y: initial, yd: 0, xp: initial };
}

/**
 * Wraps an angle in radians into `[0, 2π)` without discontinuities.
 */
export function wrapPhase(phase: number): number {
  'worklet';
  const wrapped = phase % TAU;
  return wrapped < 0 ? wrapped + TAU : wrapped;
}

/**
 * Advances a continuous oscillator phase by `dt` seconds at `frequencyHz`.
 * Changing `frequencyHz` at any instant preserves C0/C1 phase continuity (zero loop snap).
 */
export function advancePhase(phase: number, frequencyHz: number, dt: number): number {
  'worklet';
  if (dt <= 0 || frequencyHz <= 0) {
    return wrapPhase(phase);
  }
  return wrapPhase(phase + TAU * frequencyHz * dt);
}

/**
 * Frame-rate independent exponential smoothing toward `target`.
 */
export function expApproach(current: number, target: number, lambda: number, dt: number): number {
  'worklet';
  if (dt <= 0) return current;
  const alpha = 1 - Math.exp(-lambda * dt);
  return current + (target - current) * alpha;
}

/**
 * Unconditionally stable semi-implicit Euler step for a `(f, z, r)` second-order spring-damper.
 * Preserves momentum (`yd`) across arbitrary mid-flight target changes (inertial transitions).
 */
export function stepSecondOrder(
  state: SecondOrderState,
  target: number,
  dtRaw: number,
  f: number,
  z: number,
  r: number
): SecondOrderState {
  'worklet';
  const dt = Math.min(Math.max(dtRaw, 0.0005), 0.05);
  const safeF = Math.max(0.05, f);
  const w = TAU * safeF;
  const k1 = z / (Math.PI * safeF);
  const k2 = 1 / (w * w);
  const k3 = (r * z) / w;

  // Stability clamp prevents oscillation blow-up on large frame hitches
  const k2Stable = Math.max(k2, (dt * dt) / 2 + (dt * k1) / 2, dt * k1);

  const xd = (target - state.xp) / dt;
  const nextY = state.y + dt * state.yd;
  const nextYd =
    state.yd + (dt * (target + k3 * xd - nextY - k1 * state.yd)) / k2Stable;

  return {
    y: nextY,
    yd: nextYd,
    xp: target,
  };
}

/**
 * Evaluates an organic, asymmetric multi-harmonic breath wave in `[-1, 1]`.
 * - Phase skewing (`phase + skew * sin(phase)`) creates a fuller inhale and gentler exhale.
 * - Second harmonic adds subtle upper-chest/shoulder settle.
 * - Incommensurate `driftPhase` modulates depth so no two breaths repeat identically.
 */
export function sampleOrganicBreath(
  phase: number,
  driftPhase = 0,
  skew = 0.32
): number {
  'worklet';
  const skewed = phase + skew * Math.sin(phase);
  const fundamental = Math.sin(skewed);
  const secondHarmonic = 0.22 * Math.sin(2 * skewed - 0.55);
  const depthMod = 1 + 0.13 * Math.sin(driftPhase) + 0.06 * Math.cos(driftPhase * 1.618);
  const raw = ((fundamental + secondHarmonic) / 1.18) * depthMod;
  return Math.max(-1.15, Math.min(1.15, raw));
}

/**
 * Evaluates a phase-delayed wave (`phase - lagRad`) with optional harmonic tip flick
 * for hierarchical overlapping action & follow-through (body -> head -> ears -> tail tip).
 */
export function sampleOverlappingWave(
  phase: number,
  lagRad: number,
  tipHarmonic = 0.18
): number {
  'worklet';
  const p = phase - lagRad;
  const primary = Math.sin(p);
  const secondary = tipHarmonic * Math.sin(2 * p - 0.75);
  return (primary + secondary) / (1 + Math.abs(tipHarmonic));
}

/**
 * Enforces constant-area volume conservation (`scaleX * scaleY === 1`) so squashing
 * widens horizontally while stretching narrows horizontally, preserving perceived mass.
 */
export function computeVolumePreservedScale(
  rawScaleY: number,
  minScaleY = 0.72,
  maxScaleY = 1.36
): { scaleX: number; scaleY: number } {
  'worklet';
  const scaleY = Math.max(minScaleY, Math.min(maxScaleY, rawScaleY));
  const scaleX = 1 / scaleY;
  return { scaleX, scaleY };
}

/**
 * Computes continuous oscillator target frequencies & amplitude multipliers for a mood/health state.
 * Smoothly interpolated on the UI thread so loops accelerate/decelerate without phase resets.
 */
export function computeMoodLoopRates(
  mood: FighterAmbientMood,
  healthState: FighterHealthState,
  breathCycleMs: number,
  tailCycleMs: number
): MoodLoopRates {
  'worklet';
  if (healthState === 'knocked_out') {
    return {
      breathHz: 0.28,
      wagHz: 0.15,
      swayHz: 0.2,
      breathAmpScale: 0.22,
      wagAmpScale: 0,
      swayAmpScale: 0.12,
    };
  }

  let breathMult = 1.0;
  let wagMult = 1.0;
  let swayMult = 1.0;
  let breathAmpScale = 1.0;
  let wagAmpScale = 1.0;
  let swayAmpScale = 1.0;

  if (mood === 'anticipation') {
    breathMult = 1.95;
    wagMult = 2.45;
    swayMult = 1.65;
    breathAmpScale = 1.15;
    wagAmpScale = 1.38;
    swayAmpScale = 0.85;
  } else if (mood === 'curious') {
    breathMult = 1.15;
    wagMult = 1.35;
    swayMult = 0.9;
    wagAmpScale = 1.12;
  } else if (mood === 'urgent') {
    breathMult = 2.35;
    wagMult = 2.1;
    swayMult = 2.4;
    breathAmpScale = 1.25;
    swayAmpScale = 1.35;
  } else if (mood === 'victory') {
    breathMult = 2.05;
    wagMult = 2.5;
    swayMult = 1.95;
    breathAmpScale = 1.3;
    wagAmpScale = 1.45;
    swayAmpScale = 1.65;
  } else if (mood === 'streak') {
    breathMult = 1.42;
    wagMult = 1.75;
    swayMult = 1.35;
    breathAmpScale = 1.15;
    wagAmpScale = 1.24;
  } else if (mood === 'sleepy') {
    breathMult = 0.52;
    wagMult = 0.42;
    swayMult = 0.48;
    breathAmpScale = 1.22; // Deep slow snoozing breaths
    wagAmpScale = 0.35;
    swayAmpScale = 0.55;
  } else if (mood === 'defeat') {
    breathMult = 0.68;
    wagMult = 0.3;
    swayMult = 0.5;
    breathAmpScale = 0.75;
    wagAmpScale = 0.08;
    swayAmpScale = 0.35;
  }

  if (healthState === 'critical') {
    breathMult *= 1.45; // Heavy low-HP panting
    breathAmpScale *= 1.38;
  } else if (healthState === 'battered') {
    breathMult *= 1.15;
    breathAmpScale *= 1.12;
  }

  const baseBreathHz = 1000 / Math.max(600, breathCycleMs);
  const baseWagHz = 1000 / Math.max(400, tailCycleMs);
  const baseSwayHz = baseBreathHz * 0.618; // Golden ratio prevents locked repetition with breathing!

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
 * Computes resting posture targets for a given mood, health state, and eye gaze.
 * Blended continuously through second-order dynamics so state changes never cut or snap.
 */
export function computeMoodPoseTargets(
  mood: FighterAmbientMood,
  healthState: FighterHealthState,
  size: number,
  gazeX = 0,
  gazeY = 0
): MoodPoseTargets {
  'worklet';
  let leanX = gazeX * size * 0.012;
  let leanY = 0;
  let bodyTiltDeg = gazeX * 1.1;
  let headTiltDeg = gazeX * 2.8;
  let headY = gazeY * size * 0.012;
  let leftEarDeg = 0;
  let rightEarDeg = 0;
  let postureStretchY = 1.0;

  if (healthState === 'knocked_out') {
    return {
      leanX: -size * 0.02,
      leanY: size * 0.068,
      bodyTiltDeg: -9.5,
      headTiltDeg: -7.5,
      headY: size * 0.032,
      leftEarDeg: 13,
      rightEarDeg: -13,
      postureStretchY: 0.91,
    };
  }

  switch (mood) {
    case 'curious':
      leanY = -size * 0.015;
      headTiltDeg += 7.2;
      headY -= size * 0.01;
      leftEarDeg = -11;
      rightEarDeg = 4;
      postureStretchY = 1.025;
      break;

    case 'anticipation':
      // Alert pounce-ready coil: slight forward crouch, perked radar ears!
      leanY = size * 0.018;
      headTiltDeg += 2.2;
      headY -= size * 0.016;
      leftEarDeg = -13;
      rightEarDeg = 13;
      postureStretchY = 0.965;
      break;

    case 'streak':
      leanY = -size * 0.02;
      leftEarDeg = -6;
      rightEarDeg = 6;
      postureStretchY = 1.035;
      break;

    case 'urgent':
      leanY = size * 0.012;
      leftEarDeg = 6;
      rightEarDeg = -6;
      postureStretchY = 0.975;
      break;

    case 'sleepy':
      leanY = size * 0.026;
      bodyTiltDeg += 2.5;
      headTiltDeg += 5.5;
      headY += size * 0.028;
      leftEarDeg = 9;
      rightEarDeg = -9;
      postureStretchY = 0.955;
      break;

    case 'victory':
      leanY = -size * 0.028;
      leftEarDeg = -10;
      rightEarDeg = 10;
      postureStretchY = 1.045;
      break;

    case 'defeat':
      leanY = size * 0.045;
      bodyTiltDeg -= 5.2;
      headTiltDeg -= 6.5;
      headY += size * 0.03;
      leftEarDeg = 11;
      rightEarDeg = -11;
      postureStretchY = 0.935;
      break;

    case 'idle':
    default:
      break;
  }

  if (healthState === 'critical' && mood !== 'victory') {
    leanY += size * 0.018;
    bodyTiltDeg -= 2.2;
    postureStretchY *= 0.97;
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
