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
 * In-place second-order spring-damper step for Reanimated UI-thread worklets.
 * Mutates `state` fields directly via `sharedValue.modify(...)` to avoid per-frame object allocations.
 */
export function stepSecondOrderInPlace(
  state: SecondOrderState,
  target: number,
  dtRaw: number,
  f: number,
  z: number,
  r: number
): void {
  'worklet';
  const dt = Math.min(Math.max(dtRaw, 0.0005), 0.05);
  const safeF = Math.max(0.05, f);
  const w = TAU * safeF;
  const k1 = z / (Math.PI * safeF);
  const k2 = 1 / (w * w);
  const k3 = (r * z) / w;
  const k2Stable = Math.max(k2, (dt * dt) / 2 + (dt * k1) / 2, dt * k1);

  const xd = (target - state.xp) / dt;
  const nextY = state.y + dt * state.yd;
  const nextYd =
    state.yd + (dt * (target + k3 * xd - nextY - k1 * state.yd)) / k2Stable;

  state.y = nextY;
  state.yd = nextYd;
  state.xp = target;
}

/**
 * Evaluates an organic, asymmetric multi-harmonic breath wave in `[-1, 1]`.
 * - Phase skewing (`phase + skew * sin(phase)`) creates a fuller inhale and gentler exhale.
 * - Second harmonic adds subtle upper-chest/shoulder settle.
 * - Integer harmonics on `driftPhase` (whose frequency itself is incommensurate with `phase`)
 *   keep wrapping `driftPhase` at `2π` 100% C0+C1 seamless with zero loop snap.
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
  const depthMod = 1 + 0.13 * Math.sin(driftPhase) + 0.06 * Math.cos(driftPhase * 2);
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
 * Pure worklet (zero allocations): horizontal travel along a curved burst arc.
 * `spreadX` is target horizontal distance; `bowX` bends mid-flight trajectory outward.
 */
export function sampleBurstArcX(progress: number, spreadX: number, bowX = 0): number {
  'worklet';
  const t = Math.max(0, Math.min(1, progress));
  return spreadX * t + bowX * Math.sin(Math.PI * t);
}

/**
 * Pure worklet (zero allocations): vertical parabolic burst arc with lift and gravity drop.
 * Returns `0` at `t=0`, lifts by `-liftY` around mid-flight, then settles by `gravityY * t^2`.
 */
export function sampleBurstArcY(progress: number, liftY: number, gravityY = 0): number {
  'worklet';
  const t = Math.max(0, Math.min(1, progress));
  return -liftY * (4 * t * (1 - t)) + gravityY * t * t;
}

/**
 * Pure worklet (zero allocations): maps a single normalized burst clock `progress ∈ [0, 1]`
 * into a staggered sub-progress for particle `index` of `count`.
 */
export function sampleStaggeredProgress(
  progress: number,
  index: number,
  count: number,
  staggerShare = 0.28
): number {
  'worklet';
  if (count <= 1) return Math.max(0, Math.min(1, progress));
  const clampedShare = Math.max(0, Math.min(0.75, staggerShare));
  const start = (index / (count - 1)) * clampedShare;
  const span = Math.max(0.05, 1 - clampedShare);
  return Math.max(0, Math.min(1, (progress - start) / span));
}

/**
 * Pure worklet (zero allocations): decaying follow-through settle wave that
 * overshoots briefly and lands cleanly at `0` when `progress === 1`.
 */
export function sampleFollowThroughWave(
  progress: number,
  overshoot = 0.16,
  cycles = 1.5
): number {
  'worklet';
  const t = Math.max(0, Math.min(1, progress));
  const decay = (1 - t) * (1 - t);
  return Math.sin(t * cycles * TAU) * overshoot * decay;
}
