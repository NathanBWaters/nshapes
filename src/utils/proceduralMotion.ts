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
function wrapPhase(phase: number): number {
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
