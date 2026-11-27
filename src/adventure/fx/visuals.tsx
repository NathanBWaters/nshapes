/**
 * The drawing vocabulary of the fight effects. Small pieces, each of which
 * animates itself once when it mounts, in stage coordinates.
 *
 * Style: flat colour, a white core and an ink outline, like the cards. Only
 * transforms and opacity move, so the pieces stay cheap on a phone.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
  type EasingFunction,
  type EasingFunctionFactory,
  type SharedValue,
} from 'react-native-reanimated';
import { Svg, Circle, Line, Path, Polygon } from 'react-native-svg';
import Card from '@/components/Card';
import { CARD_MOTION } from '@/components/CardMotion';
import type { Card as CardType } from '@/types';
import { COLORS } from '@/utils/colors';
import { EASE as MOTION, MS, STAYS, exitMs } from '@/utils/motion';
import { fxMs } from './clock';
import type { HitTier, Point, Rect, SweepKind } from './types';

const INK = COLORS.slateCharcoal;
/** High-contrast dark ink outline for hit sparks, shockwaves & 4-stage explosions ([FX-15]/[FX-16]). */
const CHARCOAL_INK = '#161412';
const WHITE = COLORS.canvasWhite;

const EASE = {
  linear: Easing.linear,
  out: Easing.out(Easing.cubic),
  in: Easing.in(Easing.quad),
  inOut: Easing.inOut(Easing.quad),
};

export const centerOf = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** The size to draw things on a card from: its smaller side, so a short wide card (a desktop board) gets small effects */
export const unitOf = (r: Rect): number => Math.min(r.w, r.h);

/**
 * Where a piece with no delay starts: just past 0, so it is on screen on the frame it mounts (the frame of the
 * hit that mounts it), not one frame later.
 */
const ON_MOUNT = 1e-4;

/** 0 → 1 over `ms`, starting `delay` ms after mount. Runs once with `cancelAnimation` cleanup. */
const useProgress = (ms: number, delay = 0, easing: EasingFunction | EasingFunctionFactory = EASE.linear): SharedValue<number> => {
  const p = useSharedValue(delay > 0 ? 0 : ON_MOUNT);
  useEffect(() => {
    p.value = withDelay(fxMs(delay), withTiming(1, { duration: fxMs(ms), easing }));
    return () => cancelAnimation(p);
    // once, on mount: a piece never restarts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return p;
};

/** Piecewise-linear lookup for worklets: seg(t, [0, .3, 1], [0, 1.2, 1]) */
const seg = (t: number, xs: number[], ys: number[]): number => {
  'worklet';
  if (t <= xs[0]) return ys[0];
  for (let i = 1; i < xs.length; i++) {
    if (t <= xs[i]) return ys[i - 1] + ((ys[i] - ys[i - 1]) * (t - xs[i - 1])) / (xs[i] - xs[i - 1]);
  }
  return ys[ys.length - 1];
};

// ─── Things that fly ────────────────────────────────────────────────────────

const Dot: React.FC<{ from: Point; to: Point; delay: number; ms: number; size: number; color: string; bend: number; head: boolean }> = ({ from, to, delay, ms, size, color, bend, head }) => {
  const p = useProgress(ms, delay, EASE.in);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  // sideways unit vector: the path bows out and comes back in
  const nx = -dy / len;
  const ny = dx / len;
  const style = useAnimatedStyle(() => {
    const t = p.value;
    const bow = Math.sin(Math.PI * t) * bend;
    return {
      opacity: t <= 0 || t >= 1 ? 0 : 1,
      transform: [
        { translateX: from.x + dx * t + nx * bow - size / 2 },
        { translateY: from.y + dy * t + ny * bow - size / 2 },
        { scale: seg(t, [0, 0.18, 1], [0.3, 1.15, 0.7]) },
      ],
    };
  });
  return (
    <Animated.View style={[st.abs, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }, head && st.inked, style]}>
      {head && <View style={[st.core, { width: size * 0.36, height: size * 0.36, borderRadius: size * 0.18 }]} />}
    </Animated.View>
  );
};

/** An orb with a short tail, flying from one point to another along a slight bow. */
export const Comet: React.FC<{ from: Point; to: Point; delay?: number; ms: number; size: number; color: string; bend?: number }> = ({ from, to, delay = 0, ms, size, color, bend = 0 }) => (
  <>
    <Dot from={from} to={to} delay={delay + 52} ms={ms} size={size * 0.5} color={color} bend={bend} head={false} />
    <Dot from={from} to={to} delay={delay + 26} ms={ms} size={size * 0.72} color={color} bend={bend} head={false} />
    <Dot from={from} to={to} delay={delay} ms={ms} size={size} color={color} bend={bend} head />
  </>
);

// ─── Things that land ───────────────────────────────────────────────────────

/**
 * Hollow dark-outlined shockwave ring ([FX-15]): keeps the center 100% open
 * so the foe's hitstop expression stays unobstructed while popping against
 * both bright skies and dark panels.
 */
export const Ring: React.FC<{ at: Point; delay?: number; size: number; color: string; ms?: number; width?: number; testID?: string }> = ({
  at,
  delay = 0,
  size,
  color,
  ms = 260,
  width = 3,
  testID,
}) => {
  const p = useProgress(ms, delay, EASE.out);
  const style = useAnimatedStyle(() => ({
    opacity: p.value <= 0 ? 0 : seg(p.value, [0, 0.45, 1], [1, 0.9, 0]),
    transform: [{ scale: 0.25 + 0.75 * p.value }],
  }));
  const c = size / 2;
  const outerStroke = width + 2.5;
  const r = Math.max(2, c - outerStroke / 2 - 1);
  return (
    <Animated.View
      pointerEvents="none"
      testID={testID ?? 'fx-ring'}
      style={[st.abs, { left: at.x - c, top: at.y - c, width: size, height: size }, style]}
    >
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r} fill="none" stroke={CHARCOAL_INK} strokeWidth={outerStroke} />
        <Circle cx={c} cy={c} r={r} fill="none" stroke={color} strokeWidth={width} />
      </Svg>
    </Animated.View>
  );
};

export interface TickRaySpec {
  deg: number;
  /** Ray length as a fraction of overall `size` (0.18..0.34). */
  len: number;
  thick: number;
}

/**
 * Deterministic asymmetric ink-outlined ray tables keyed by damage tier ([FX-15]):
 * 5 rays at tier 0 · 6 rays at tier 1–2 · 7 long+short jagged rays at tier 3.
 */
export const TICK_RAYS: Record<HitTier, readonly TickRaySpec[]> = {
  0: [
    { deg: -156, len: 0.26, thick: 3.0 },
    { deg: -104, len: 0.20, thick: 2.6 },
    { deg: -34, len: 0.28, thick: 3.2 },
    { deg: 42, len: 0.19, thick: 2.6 },
    { deg: 134, len: 0.24, thick: 2.8 },
  ],
  1: [
    { deg: -162, len: 0.29, thick: 3.4 },
    { deg: -118, len: 0.21, thick: 2.8 },
    { deg: -54, len: 0.30, thick: 3.5 },
    { deg: 16, len: 0.20, thick: 2.8 },
    { deg: 74, len: 0.27, thick: 3.2 },
    { deg: 138, len: 0.22, thick: 2.9 },
  ],
  2: [
    { deg: -160, len: 0.32, thick: 3.8 },
    { deg: -116, len: 0.23, thick: 3.0 },
    { deg: -48, len: 0.34, thick: 4.0 },
    { deg: 18, len: 0.22, thick: 3.0 },
    { deg: 76, len: 0.31, thick: 3.6 },
    { deg: 134, len: 0.24, thick: 3.2 },
  ],
  3: [
    { deg: -158, len: 0.34, thick: 4.2 },
    { deg: -118, len: 0.21, thick: 3.0 },
    { deg: -52, len: 0.33, thick: 4.2 },
    { deg: 14, len: 0.20, thick: 3.0 },
    { deg: 68, len: 0.34, thick: 4.0 },
    { deg: 126, len: 0.22, thick: 3.1 },
    { deg: 172, len: 0.30, thick: 3.8 },
  ],
};

/**
 * Deterministic asymmetric comic-book impact sparks outlined in `#161412` ink ([FX-15]).
 * Expands continuously across hitstop with an open center.
 */
export const Ticks: React.FC<{ at: Point; delay?: number; size: number; color: string; ms?: number; tier?: HitTier; testID?: string }> = ({
  at,
  delay = 0,
  size,
  color,
  ms = 220,
  tier = 0,
  testID,
}) => {
  const p = useProgress(ms, delay, EASE.out);
  const style = useAnimatedStyle(() => ({
    opacity: p.value <= 0 ? 0 : seg(p.value, [0, 0.55, 1], [1, 1, 0]),
    transform: [{ scale: 0.45 + 0.75 * p.value }],
  }));
  const c = size / 2;
  const rays = TICK_RAYS[tier];
  const innerR = c * 0.34;
  return (
    <Animated.View
      pointerEvents="none"
      testID={testID ?? 'fx-ticks'}
      style={[st.abs, { left: at.x - c, top: at.y - c, width: size, height: size }, style]}
    >
      <Svg width={size} height={size}>
        {rays.map((ray, idx) => {
          const rad = (ray.deg * Math.PI) / 180;
          const cos = Math.cos(rad);
          const sin = Math.sin(rad);
          const outerR = Math.min(c - 3, innerR + size * ray.len);
          const x1 = c + cos * innerR;
          const y1 = c + sin * innerR;
          const x2 = c + cos * outerR;
          const y2 = c + sin * outerR;
          return (
            <React.Fragment key={idx}>
              <Line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={CHARCOAL_INK}
                strokeWidth={ray.thick + 3}
                strokeLinecap="round"
              />
              <Line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={color}
                strokeWidth={ray.thick}
                strokeLinecap="round"
              />
            </React.Fragment>
          );
        })}
      </Svg>
    </Animated.View>
  );
};

const starPoints = (spikes: number, outer: number, inner: number, c: number): string => {
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    pts.push(`${(c + Math.cos(a) * r).toFixed(1)},${(c + Math.sin(a) * r).toFixed(1)}`);
  }
  return pts.join(' ');
};

/** Default dissipation time for comic impact Starburst ([FX-15]: fast 220 ms contraction). */
export const STARBURST_DEFAULT_MS = 220;

/**
 * Fast contracting comic impact burst ([FX-15]): crisp full-opacity peak over
 * 0..48% (~105 ms), then fades while contracting `1.12 → 0.72` so the foe's
 * hitstop expression reads clearly right after impact.
 */
export const Starburst: React.FC<{ at: Point; delay?: number; size: number; color: string; ms?: number; testID?: string }> = ({
  at,
  delay = 0,
  size,
  color,
  ms = STARBURST_DEFAULT_MS,
  testID,
}) => {
  const p = useProgress(ms, delay, MOTION.ui);
  const style = useAnimatedStyle(() => {
    const t = p.value;
    return {
      opacity: t <= 0 ? 0 : seg(t, [0, 0.48, 1], [1, 1, 0]),
      transform: [
        { scale: seg(t, [0, 0.18, 0.48, 1], [0.76, 1.12, 1.02, 0.72]) },
        { rotate: `${seg(t, [0, 1], [-12, 8])}deg` },
      ],
    };
  });
  const c = size / 2;
  return (
    <Animated.View
      pointerEvents="none"
      testID={testID ?? 'fx-starburst'}
      style={[st.abs, { left: at.x - c, top: at.y - c, width: size, height: size }, style]}
    >
      <Svg width={size} height={size}>
        <Polygon points={starPoints(11, c - 2, c * 0.58, c)} fill={color} stroke={CHARCOAL_INK} strokeWidth={2.5} strokeLinejoin="round" />
        <Polygon points={starPoints(9, c * 0.56, c * 0.3, c)} fill="#FFE45C" />
        <Polygon points={starPoints(6, c * 0.26, c * 0.12, c)} fill={WHITE} />
      </Svg>
    </Animated.View>
  );
};

// ─── 4-Stage Explosion ([FX-16]) ────────────────────────────────────────────

/** Global simultaneous smoke + ember particle ceiling across multi-card blasts (Ep. #242). */
export const MAX_EXPLOSION_EMBERS = 24;

/** Sakurai Ep. #056 timing choreography: Flash → Fireball → Black Smoke → Embers. */
export const EXPLOSION_TIMING = {
  flashMs: 32,
  fireballDelayMs: 16,
  fireballMs: 114,
  smokeDelayMs: 85,
  smokeMs: 235,
  emberDelayMs: 100,
  emberMs: 280,
  totalMs: 380,
} as const;

/**
 * Compute deterministic per-slot smoke + ember budgets so total rendered
 * particles across any `slotCount` simultaneously blasted slots never exceeds
 * `MAX_EXPLOSION_EMBERS` (24).
 */
export const explosionSlotBudgets = (
  slotCount: number,
  slotIndex: number
): { cloudBudget: number; emberBudget: number } => {
  if (slotCount <= 0) return { cloudBudget: 4, emberBudget: 6 };
  if (slotCount <= 2) return { cloudBudget: 4, emberBudget: 6 };
  if (slotCount === 3) return { cloudBudget: 3, emberBudget: 5 };
  if (slotCount === 4) return { cloudBudget: 3, emberBudget: 3 };
  const base = Math.floor(MAX_EXPLOSION_EMBERS / slotCount);
  const extra = MAX_EXPLOSION_EMBERS % slotCount;
  const slotTotal = base + (slotIndex < extra ? 1 : 0);
  if (slotTotal <= 0) return { cloudBudget: 0, emberBudget: 0 };
  if (slotTotal === 1) return { cloudBudget: 1, emberBudget: 0 };
  const cloudBudget = Math.min(4, Math.max(1, Math.floor(slotTotal / 2)));
  const emberBudget = Math.min(6, slotTotal - cloudBudget);
  return { cloudBudget, emberBudget };
};

const SMOKE_CLOUDS = [
  { dx: -0.22, dy: -0.14, sizeShare: 0.56, fill: '#2D2926', delay: 0 },
  { dx: 0.24, dy: -0.06, sizeShare: 0.50, fill: '#44403C', delay: 18 },
  { dx: -0.04, dy: -0.26, sizeShare: 0.60, fill: '#1E1B18', delay: 32 },
  { dx: 0.10, dy: 0.16, sizeShare: 0.46, fill: '#3B3632', delay: 44 },
] as const;

const EXPLOSION_EMBERS = [
  { deg: -148, dist: 0.66, sizeShare: 0.19, fill: '#FFE84D', delay: 0, spin: -90 },
  { deg: -96, dist: 0.72, sizeShare: 0.16, fill: '#FF7A1A', delay: 16, spin: 75 },
  { deg: -36, dist: 0.68, sizeShare: 0.18, fill: '#FFF6C2', delay: 8, spin: 105 },
  { deg: 28, dist: 0.60, sizeShare: 0.15, fill: '#FFE84D', delay: 24, spin: -80 },
  { deg: 112, dist: 0.58, sizeShare: 0.17, fill: '#FF7A1A', delay: 12, spin: 95 },
  { deg: 168, dist: 0.64, sizeShare: 0.15, fill: '#FFF6C2', delay: 28, spin: -110 },
] as const;

const ExplosionFlashStage: React.FC<{ at: Point; size: number; delay: number }> = ({ at, size, delay }) => {
  const p = useProgress(EXPLOSION_TIMING.flashMs, delay, EASE.linear);
  const style = useAnimatedStyle(() => {
    const t = p.value;
    return {
      // High-contrast 2-frame flash with an instant cut at 32 ms
      opacity: t <= 0 || t >= 0.99 ? 0 : 1,
      transform: [{ scale: 0.6 + 0.45 * t }],
    };
  });
  const c = size / 2;
  return (
    <Animated.View
      pointerEvents="none"
      testID="fx-explosion-flash"
      style={[
        st.abs,
        {
          left: at.x - c,
          top: at.y - c,
          width: size,
          height: size,
          borderRadius: c,
          backgroundColor: '#FFF6C2',
          borderWidth: 3,
          borderColor: CHARCOAL_INK,
        },
        style,
      ]}
    />
  );
};

const ExplosionFireballStage: React.FC<{ at: Point; size: number; color: string; delay: number }> = ({ at, size, color, delay }) => {
  const p = useProgress(EXPLOSION_TIMING.fireballMs, delay + EXPLOSION_TIMING.fireballDelayMs, MOTION.enter);
  const style = useAnimatedStyle(() => {
    const t = p.value;
    return {
      opacity: t <= 0 ? 0 : seg(t, [0, 0.68, 1], [1, 0.95, 0]),
      transform: [
        { scale: seg(t, [0, 0.55, 1], [0.35, 1.18, 1.04]) },
        { rotate: `${seg(t, [0, 1], [-10, 12])}deg` },
      ],
    };
  });
  const c = size / 2;
  return (
    <Animated.View
      pointerEvents="none"
      testID="fx-explosion-fireball"
      style={[st.abs, { left: at.x - c, top: at.y - c, width: size, height: size }, style]}
    >
      <Svg width={size} height={size}>
        <Polygon points={starPoints(10, c - 2, c * 0.62, c)} fill={color} stroke={CHARCOAL_INK} strokeWidth={2.5} strokeLinejoin="round" />
        <Polygon points={starPoints(8, c * 0.58, c * 0.34, c)} fill="#FFE45C" />
        <Polygon points={starPoints(6, c * 0.28, c * 0.14, c)} fill="#FFFDF5" />
      </Svg>
    </Animated.View>
  );
};

const ExplosionSmokeCloud: React.FC<{ at: Point; u: number; dx: number; dy: number; size: number; fill: string; delay: number }> = ({
  at,
  u,
  dx,
  dy,
  size,
  fill,
  delay,
}) => {
  const p = useProgress(EXPLOSION_TIMING.smokeMs, delay, EASE.out);
  const rise = -u * 0.25;
  const style = useAnimatedStyle(() => {
    const t = p.value;
    return {
      opacity: t <= 0 ? 0 : seg(t, [0, 0.22, 0.58, 1], [0.92, 0.95, 0.85, 0]),
      transform: [
        { translateX: dx * t },
        { translateY: dy * t + rise * t },
        { scale: 0.45 + 0.7 * t },
      ],
    };
  });
  const half = size / 2;
  return (
    <Animated.View
      pointerEvents="none"
      testID="fx-explosion-smoke"
      style={[
        st.abs,
        {
          left: at.x - half,
          top: at.y - half,
          width: size,
          height: size,
          borderRadius: half,
          backgroundColor: fill,
          borderWidth: 2,
          borderColor: CHARCOAL_INK,
        },
        style,
      ]}
    />
  );
};

const ExplosionEmberShard: React.FC<{ at: Point; deg: number; dist: number; size: number; fill: string; delay: number; spin: number }> = ({
  at,
  deg,
  dist,
  size,
  fill,
  delay,
  spin,
}) => {
  const p = useProgress(EXPLOSION_TIMING.emberMs, delay, MOTION.enter);
  const rad = (deg * Math.PI) / 180;
  const dx = Math.cos(rad) * dist;
  const dy = Math.sin(rad) * dist;
  const half = size / 2;
  const style = useAnimatedStyle(() => {
    const t = p.value;
    const inv = 1 - t;
    return {
      opacity: t <= 0 ? 0 : seg(t, [0, 0.55, 0.92, 1], [1, 0.9, 0, 0]),
      transform: [
        { translateX: dx * t },
        // subtle upward arc that settles to zero vertical velocity at t = 1 (no hard stop)
        { translateY: dy * t - 8 * t * inv * inv },
        { scale: seg(t, [0, 0.18, 0.92, 1], [0.95, 1, 0.15, 0]) },
        { rotate: `${deg + spin * t}deg` },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      testID="fx-explosion-ember"
      style={[st.abs, { left: at.x - half, top: at.y - half, width: size, height: size }, style]}
    >
      <Svg width={size} height={size} viewBox="0 0 16 16">
        <Polygon points="8,1 13,8 8,15 3,8" fill={fill} stroke={CHARCOAL_INK} strokeWidth={1.8} />
      </Svg>
    </Animated.View>
  );
};

const ExplosionReduced: React.FC<{ at: Point; size: number; color: string; delay: number }> = ({ at, size, color, delay }) => {
  const p = useSharedValue(delay > 0 ? 0 : ON_MOUNT);
  useEffect(() => {
    p.value = withDelay(
      fxMs(delay),
      withTiming(1, { duration: fxMs(180), easing: MOTION.ui, ...STAYS }),
      STAYS.reduceMotion
    );
    return () => cancelAnimation(p);
    // once, on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: p.value <= 0 ? 0 : seg(p.value, [0, 0.4, 1], [0.9, 0.85, 0]),
  }));
  const c = size / 2;
  return (
    <Animated.View
      pointerEvents="none"
      testID="fx-explosion-flash"
      style={[st.abs, { left: at.x - c, top: at.y - c, width: size, height: size }, style]}
    >
      <Svg width={size} height={size}>
        <Polygon points={starPoints(10, c - 2, c * 0.62, c)} fill={color} stroke={CHARCOAL_INK} strokeWidth={2.5} strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
};

/**
 * Deterministic 4-stage Sakurai explosion ([FX-16], Ep. #056 & #242):
 *   1. Flash (`0–32 ms`): ink-rimmed cream flash (`#FFF6C2` + `#161412`)
 *   2. Fireball (`16–130 ms`): expanding orange/yellow polygon burst
 *   3. Black Smoke (`85–320 ms`): billowing dark charcoal/ink clouds rolling upward
 *   4. Embers (`100–380 ms`): budget-capped sharp diamond shards arcing outward
 */
export const Explosion: React.FC<{
  rect: Rect;
  color?: string;
  delay?: number;
  cloudBudget?: number;
  emberBudget?: number;
  testID?: string;
}> = ({ rect, color = '#FF7A1A', delay = 0, cloudBudget = 4, emberBudget = 6, testID }) => {
  const reduced = useReducedMotion();
  const at = centerOf(rect);
  const u = Math.max(36, unitOf(rect));
  const flashSize = Math.round(u * 0.96);
  const fireballSize = Math.round(Math.min(rect.w * 1.28, Math.max(u * 1.32, 46)));
  const clouds = SMOKE_CLOUDS.slice(0, Math.max(0, Math.min(SMOKE_CLOUDS.length, cloudBudget)));
  const embers = EXPLOSION_EMBERS.slice(0, Math.max(0, Math.min(EXPLOSION_EMBERS.length, emberBudget)));

  if (reduced) {
    return (
      <View pointerEvents="none" testID={testID ?? 'fx-explosion'} style={StyleSheet.absoluteFill}>
        <ExplosionReduced at={at} size={fireballSize} color={color} delay={delay} />
      </View>
    );
  }

  return (
    <View pointerEvents="none" testID={testID ?? 'fx-explosion'} style={StyleSheet.absoluteFill}>
      {/* Stage 3 smoke behind fireball flash handoff, rising cleanly as flames fade */}
      {clouds.map((cl, idx) => (
        <ExplosionSmokeCloud
          key={`smoke-${idx}`}
          at={at}
          u={u}
          dx={cl.dx * u}
          dy={cl.dy * u}
          size={Math.max(18, Math.round(u * cl.sizeShare))}
          fill={cl.fill}
          delay={delay + EXPLOSION_TIMING.smokeDelayMs + cl.delay}
        />
      ))}
      {/* Stage 2 expanding layered fireball */}
      <ExplosionFireballStage at={at} size={fireballSize} color={color} delay={delay} />
      {/* Stage 1 2-frame high-contrast flash */}
      <ExplosionFlashStage at={at} size={flashSize} delay={delay} />
      {/* Stage 4 budget-capped diamond embers */}
      {embers.map((em, idx) => (
        <ExplosionEmberShard
          key={`ember-${idx}`}
          at={at}
          deg={em.deg}
          dist={u * em.dist}
          size={Math.max(10, Math.round(u * em.sizeShare))}
          fill={em.fill}
          delay={delay + EXPLOSION_TIMING.emberDelayMs + em.delay}
          spin={em.spin}
        />
      ))}
    </View>
  );
};

// ─── Lines ([FX-19]) ────────────────────────────────────────────────────────

/** 2-frame snap beam timings & 30 Hz core flicker parameters ([FX-19]). */
export const BEAM_TIMING = {
  growMs: 28,
  defaultHoldMs: 140,
  zapHoldMs: 70,
  fadeMs: 110,
  flickerHz: 30,
  endpointSparkDelayMs: 24,
  endpointSparkMs: 180,
} as const;

/**
 * A beam drawn from one point to another ([FX-19]): snaps across the whole
 * span in 2 frames (`28 ms`), crackles at 30 Hz during hold, then thins sharply.
 */
export const Beam: React.FC<{
  from: Point;
  to: Point;
  delay?: number;
  thickness: number;
  color: string;
  hold?: number;
  core?: boolean;
  testID?: string;
}> = ({ from, to, delay = 0, thickness, color, hold = BEAM_TIMING.defaultHoldMs, core = true, testID }) => {
  const still = useReducedMotion();
  const grow = BEAM_TIMING.growMs;
  const fade = BEAM_TIMING.fadeMs;
  const total = grow + hold + fade;
  const p = useProgress(total, delay);
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const a = grow / total;
  const b = (grow + hold) / total;
  const style = useAnimatedStyle(() => {
    const t = p.value;
    const u = a > 0 ? Math.min(1, t / a) : 1;
    const inv = 1 - u;
    const snapX = still ? 1 : t < a ? 0.04 + 0.96 * (1 - inv * inv * inv) : 1;
    const holdSec = ((t - a) * total) / 1000;
    const crackleY = still ? 1 : 1 + 0.34 * Math.sin(holdSec * Math.PI * BEAM_TIMING.flickerHz);
    return {
      opacity: t <= 0 || t >= 1 ? 0 : 1,
      transform: [
        { rotate: `${angle}rad` },
        { scaleX: snapX },
        { scaleY: t < a ? 1 : t < b ? crackleY : seg(t, [b, 1], [1, 0.05]) },
      ],
    };
  });
  const coreStyle = useAnimatedStyle(() => {
    const t = p.value;
    if (still || t < a || t >= b) return { opacity: 0.95 };
    const holdSec = ((t - a) * total) / 1000;
    return {
      opacity: 0.72 + 0.28 * Math.cos(holdSec * Math.PI * BEAM_TIMING.flickerHz),
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      testID={testID ?? 'fx-beam'}
      style={[
        st.abs,
        st.inked,
        {
          left: from.x,
          top: from.y - thickness / 2,
          width: len,
          height: thickness,
          borderRadius: thickness / 2,
          backgroundColor: color,
          transformOrigin: 'left center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {core && (
        <Animated.View
          style={[
            {
              height: Math.max(2, thickness * 0.36),
              marginHorizontal: thickness * 0.28,
              borderRadius: thickness,
              backgroundColor: WHITE,
            },
            coreStyle,
          ]}
        />
      )}
    </Animated.View>
  );
};

// ─── On a card ──────────────────────────────────────────────────────────────

/** A quick flash over a card: the moment something hits it. */
export const Flash: React.FC<{ rect: Rect; delay?: number; color?: string; ms?: number }> = ({ rect, delay = 0, color = WHITE, ms = 220 }) => {
  const p = useProgress(ms, delay);
  const style = useAnimatedStyle(() => ({ opacity: p.value <= 0 ? 0 : seg(p.value, [0, 0.2, 1], [0.95, 0.8, 0]) }));
  return <Animated.View style={[st.abs, { left: rect.x, top: rect.y, width: rect.w, height: rect.h, borderRadius: 12, backgroundColor: color }, style]} />;
};

const Drop: React.FC<{ at: Point; delay: number; size: number; color: string; rise: number; sway: number }> = ({ at, delay, size, color, rise, sway }) => {
  const p = useProgress(420, delay, EASE.out);
  const style = useAnimatedStyle(() => {
    const t = p.value;
    return {
      opacity: t <= 0 ? 0 : seg(t, [0, 0.7, 1], [1, 0.9, 0]),
      transform: [
        { translateX: sway * Math.sin(t * Math.PI * 2) },
        { translateY: -rise * t },
        { scale: seg(t, [0, 0.25, 1], [0.3, 1.1, 0.5]) },
        { rotate: '-45deg' },
      ],
    };
  });
  return (
    <Animated.View
      style={[st.abs, st.inked, { left: at.x - size / 2, top: at.y - size / 2, width: size, height: size, borderRadius: size / 2, borderTopRightRadius: 2, backgroundColor: color }, style]}
    />
  );
};

/** Flames licking up from the bottom of a card. */
export const Flames: React.FC<{ rect: Rect; delay?: number; color: string }> = ({ rect, delay = 0, color }) => {
  const s = unitOf(rect) * 0.34;
  const y = rect.y + rect.h * 0.78;
  return (
    <>
      <Drop at={{ x: rect.x + rect.w * 0.28, y }} delay={delay} size={s} color={color} rise={rect.h * 0.55} sway={4} />
      <Drop at={{ x: rect.x + rect.w * 0.72, y }} delay={delay + 70} size={s * 0.9} color="#FF9538" rise={rect.h * 0.5} sway={-4} />
      <Drop at={{ x: rect.x + rect.w * 0.5, y }} delay={delay + 35} size={s * 1.15} color="#FFD23F" rise={rect.h * 0.7} sway={3} />
    </>
  );
};

const Twinkle: React.FC<{ at: Point; delay: number; size: number; color: string }> = ({ at, delay, size, color }) => {
  const p = useProgress(420, delay);
  const style = useAnimatedStyle(() => {
    const t = p.value;
    return {
      opacity: t <= 0 ? 0 : seg(t, [0, 0.7, 1], [1, 1, 0]),
      transform: [{ scale: seg(t, [0, 0.3, 0.6, 1], [0, 1.25, 0.9, 0.4]) }, { rotate: `${t * 90}deg` }],
    };
  });
  const c = size / 2;
  return (
    <Animated.View style={[st.abs, { left: at.x - c, top: at.y - c, width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Polygon points={starPoints(4, c - 1.5, c * 0.26, c)} fill={color} stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
      </Svg>
    </Animated.View>
  );
};

/** Twinkles around a card: it just got better. */
export const Sparkles: React.FC<{ rect: Rect; delay?: number; color: string }> = ({ rect, delay = 0, color }) => {
  const s = Math.max(14, unitOf(rect) * 0.36);
  return (
    <>
      <Twinkle at={{ x: rect.x + rect.w * 0.22, y: rect.y + rect.h * 0.26 }} delay={delay} size={s} color={color} />
      <Twinkle at={{ x: rect.x + rect.w * 0.8, y: rect.y + rect.h * 0.4 }} delay={delay + 80} size={s * 1.25} color={color} />
      <Twinkle at={{ x: rect.x + rect.w * 0.42, y: rect.y + rect.h * 0.8 }} delay={delay + 150} size={s * 0.85} color={color} />
    </>
  );
};

const Cloud: React.FC<{ at: Point; delay: number; size: number; color: string; dx: number; dy: number }> = ({ at, delay, size, color, dx, dy }) => {
  const p = useProgress(380, delay, EASE.out);
  const style = useAnimatedStyle(() => ({
    opacity: p.value <= 0 ? 0 : seg(p.value, [0, 0.4, 1], [0.85, 0.7, 0]),
    transform: [{ translateX: dx * p.value }, { translateY: dy * p.value }, { scale: 0.4 + 0.8 * p.value }],
  }));
  return <Animated.View style={[st.abs, { left: at.x - size / 2, top: at.y - size / 2, width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]} />;
};

/** A dark puff: the foe did something to this card. */
export const Puff: React.FC<{ rect: Rect; delay?: number; color: string }> = ({ rect, delay = 0, color }) => {
  const c = centerOf(rect);
  const u = unitOf(rect);
  const s = u * 0.6;
  return (
    <>
      <Cloud at={c} delay={delay} size={s} color={color} dx={-u * 0.2} dy={-u * 0.12} />
      <Cloud at={c} delay={delay + 40} size={s * 0.8} color={INK} dx={u * 0.22} dy={-u * 0.05} />
      <Cloud at={c} delay={delay + 80} size={s * 0.9} color={color} dx={0} dy={u * 0.16} />
    </>
  );
};

// ─── Across the board ───────────────────────────────────────────────────────

const SWEEPS: Record<SweepKind, { fill: string; edge: string }> = {
  frost: { fill: 'rgba(147,197,253,0.5)', edge: '#FFFFFF' },
  gold: { fill: 'rgba(255,222,0,0.4)', edge: '#FFF6C2' },
  teal: { fill: 'rgba(45,212,191,0.4)', edge: '#CCFBF1' },
  whirl: { fill: 'rgba(255,149,56,0.42)', edge: '#FFE8CC' },
  dark: { fill: 'rgba(60,20,40,0.45)', edge: 'rgba(159,18,57,0.8)' },
  rainbow: { fill: 'rgba(196,181,253,0.45)', edge: '#FDE68A' },
  surge: { fill: 'rgba(219,39,119,0.38)', edge: '#FBCFE8' },
};

/** A slanted band of colour that crosses the whole board once. */
export const Sweep: React.FC<{ rect: Rect; kind: SweepKind; delay?: number; ms?: number }> = ({ rect, kind, delay = 0, ms = 420 }) => {
  const p = useProgress(ms, delay, EASE.inOut);
  const band = rect.w * 0.5;
  const back = kind === 'dark' || kind === 'whirl';
  const style = useAnimatedStyle(() => ({
    opacity: p.value <= 0 || p.value >= 1 ? 0 : 1,
    transform: [{ translateX: back ? rect.w + band - (rect.w + band * 2) * p.value : -band * 2 + (rect.w + band * 2) * p.value }, { rotate: '16deg' }],
  }));
  const { fill, edge } = SWEEPS[kind];
  return (
    <View pointerEvents="none" style={[st.abs, { left: rect.x, top: rect.y, width: rect.w, height: rect.h, overflow: 'hidden', borderRadius: 12 }]}>
      <Animated.View style={[st.abs, { top: -rect.h * 0.25, width: band, height: rect.h * 1.5, backgroundColor: fill, borderLeftWidth: 3, borderRightWidth: 6, borderColor: edge }, style]} />
    </View>
  );
};

// ─── Words ──────────────────────────────────────────────────────────────────

const STAMP_SIZE: Record<HitTier, number> = { 0: 19, 1: 27, 2: 35, 3: 44 };
/** The Set's own number, on the foe: the one the player is waiting for */
const LEAD_STAMP_SIZE: Record<HitTier, number> = { 0: 30, 1: 36, 2: 42, 3: 50 };
/** A tag on a card is smaller: it should not hide the card */
const STICKER_SIZE = 13;

/** How much bigger than its size a word lands before it settles (the Set's own number lands biggest) */
const STAMP_LAND = { lead: 1.6, other: 1.3 } as const;

/**
 * A number or a word that slams in where something landed (big, settling in
 * `MS.feedback`), holds still while it is read, then lifts away and fades on
 * the way out. `sticker` gives it a white tag so it reads over the cards.
 * A sour one shakes its head instead of slamming.
 */
export const Stamp: React.FC<{ at: Point; text: string; color: string; tier?: HitTier; delay?: number; sticker?: boolean; sour?: boolean; fromLeft?: boolean; lead?: boolean; maxX: number; testID?: string }> = ({ at, text, color, tier = 0, delay = 0, sticker, sour, fromLeft, lead, maxX, testID }) => {
  const hold = 520 + tier * 200;
  // (leaving is not the news: out in two thirds of a small part's change, about as quick as it slammed in)
  const out = exitMs(MS.quick);
  const total = hold + out;
  // With reduced motion the words do not slam, lift or shake, but they still hold and fade on time
  // (Reanimated would otherwise jump every timing to its end, and the number would be gone on its first frame)
  const still = useReducedMotion();
  const timed = { reduceMotion: ReduceMotion.Never };
  // (the head shake of a sour one runs on plain time)
  const p = useSharedValue(delay > 0 ? 0 : ON_MOUNT);
  // (with no delay it is already a third of the way in on the frame it mounts: fully opaque, still big)
  const land = useSharedValue(delay > 0 ? 0 : 1 / 3);
  const leave = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(fxMs(delay), withTiming(1, { duration: fxMs(total), easing: EASE.linear, ...timed }), ReduceMotion.Never);
    land.value = withDelay(fxMs(delay), withTiming(1, { duration: fxMs(MS.feedback), easing: MOTION.enter, ...timed }), ReduceMotion.Never);
    leave.value = withDelay(fxMs(delay + hold), withTiming(1, { duration: fxMs(out), easing: MOTION.exit, ...timed }), ReduceMotion.Never);
    return () => {
      cancelAnimation(p);
      cancelAnimation(land);
      cancelAnimation(leave);
    };
    // once, on mount: a piece never restarts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const big = still ? 1 : lead ? STAMP_LAND.lead : STAMP_LAND.other;
  const rise = still ? 0 : 12 + tier * 6;
  const shake = !!sour && !still;
  const wanted = sticker ? STICKER_SIZE + tier * 3 : lead ? LEAD_STAMP_SIZE[tier] : STAMP_SIZE[tier];
  // Heavy capitals run wide: about this share of the font size per letter
  const em = sticker ? 0.62 : 0.74;
  // A bare number ("−3") is as big as its tier says. A long word ("MEGA RAINBOW −254") is drawn smaller:
  // it must stay on the screen, and the Set's own callout should not cover more than about two thirds of it.
  const room = lead ? maxX * 0.66 : maxX - 16;
  const size = sticker ? wanted : Math.max(14, Math.min(wanted, Math.floor(room / (text.length * em))));
  // keep the whole word on screen (a rough width is enough)
  const width = Math.min(maxX - 8, text.length * size * em + (sticker ? 16 : 0));
  // `fromLeft`: the word starts at the point instead of being centred on it (a long word next to a small target)
  const left = Math.max(4, Math.min(maxX - width - 4, fromLeft ? at.x : at.x - width / 2));
  const style = useAnimatedStyle(() => {
    const t = p.value;
    const l = land.value;
    return {
      // in over the first two frames of the slam (never a pop), out as it lifts
      opacity: t <= 0 ? 0 : Math.min(1, l * 3) * (1 - leave.value),
      transform: [
        { translateX: shake ? seg(t, [0, 0.06, 0.12, 0.18, 0.24], [0, -6, 6, -4, 0]) : 0 },
        { translateY: -rise * leave.value },
        { scale: sour ? 1 : big + (1 - big) * l },
      ],
    };
  });
  return (
    <Animated.View style={[st.abs, { left, top: at.y - size * 0.7, width, alignItems: 'center' }, style]} testID={testID ?? `floater-tier-${tier}`}>
      <View style={sticker ? st.sticker : undefined}>
        <Text
          numberOfLines={1}
          // The Set's own number lands on top of its burst: white with an ink edge reads over anything
          style={[st.stamp, { color: lead ? WHITE : color, fontSize: size, lineHeight: size * 1.15 }, !sticker && (lead ? st.stampLead : st.stampGlow), tier >= 2 && st.stampHeavy]}
        >
          {text}
        </Text>
      </View>
    </Animated.View>
  );
};

/**
 * A moment of the fight itself (a knockout): a tilted plate that slams in across
 * the middle of the board, holds, and lifts away.
 */
export const Banner: React.FC<{ rect: Rect; text: string; color: string; delay?: number }> = ({ rect, text, color, delay = 0 }) => {
  const p = useProgress(1150, delay);
  // As big as fits: a short shout ("K.O.!") fills the board, a longer one ("BOSS FIGHT!") is sized to stay on it
  const size = Math.max(26, Math.min(64, rect.w * 0.17, (rect.w - 40) / (text.length * 0.62 + 1)));
  const style = useAnimatedStyle(() => {
    const t = p.value;
    return {
      opacity: t <= 0 ? 0 : seg(t, [0, 0.06, 0.8, 1], [0, 1, 1, 0]),
      transform: [
        { translateY: -seg(t, [0.8, 1], [0, 26]) },
        { scale: seg(t, [0, 0.1, 0.17, 0.24, 1], [2.4, 0.92, 1.06, 1, 1]) },
        { rotate: '-5deg' },
      ],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[st.abs, { left: rect.x, top: rect.y + rect.h * 0.34 - size, width: rect.w, alignItems: 'center' }, style]}
      testID="fx-banner"
    >
      <View style={[st.bannerPlate, { backgroundColor: color, paddingHorizontal: size * 0.5, borderRadius: size * 0.28 }]}>
        <Text numberOfLines={1} style={[st.bannerText, { fontSize: size, lineHeight: size * 1.16 }]}>{text}</Text>
      </View>
    </Animated.View>
  );
};

/** A small dark tag under the weapon, skill or evolution that just fired, naming it. */
export const Tag: React.FC<{ at: Point; text: string; maxX: number }> = ({ at, text, maxX }) => {
  const p = useProgress(700);
  const width = Math.min(maxX - 8, text.length * 6.4 + 14);
  const left = Math.max(4, Math.min(maxX - width - 4, at.x - width / 2));
  const style = useAnimatedStyle(() => ({
    opacity: seg(p.value, [0, 0.08, 0.75, 1], [0, 1, 1, 0]),
    transform: [{ translateY: seg(p.value, [0, 0.1], [-5, 0]) }, { scale: seg(p.value, [0, 0.1, 0.2], [0.7, 1.08, 1]) }],
  }));
  return (
    <Animated.View style={[st.abs, st.tag, { left, top: at.y, width }, style]} testID="fx-source-tag">
      <Text numberOfLines={1} style={st.tagText}>{text}</Text>
    </Animated.View>
  );
};

// ─── A card that is no longer there ([FX-11]) ───────────────────────────────

/** How a card leaves: 'throw' is the Set's own cards, flung at whatever the Set hits */
export type GhostBreak = 'shatter' | 'vaporise' | 'throw';

/** Exaggerated throw physics for Set cards ([FX-11]: velocity stretch, bolder pullback/bank & wobble). */
export const THROW_PHYSICS = {
  /** Share of the flight spent coiling back before launch */
  pickUp: 0.16,
  /** Scale at wind-up apex and at target contact */
  lift: 1.14,
  arrive: 0.34,
  /** Pullback distance away from target at 90 px card reference (px) */
  drawBack: 16,
  /** Maximum mid-flight bank angle (±deg) */
  bankDeg: 42,
  /** Volume-preserving mid-flight velocity stretch (scaleY / scaleX ≈ 1.18 / 0.86) */
  stretchPeakY: 1.18,
  squashPeakX: 0.86,
  /** Transverse off-center wobble amplitude (px) */
  wobblePx: 3,
  /** Initial velocity share on release */
  launch: 0.38,
  /** Arc bow fraction, cap, and 3-card fan spread (px) */
  bowShare: 0.07,
  bowMax: 24,
  fan: 12,
} as const;

/** Shared flight arc bow so `Ghost` and `SwishRibbon` follow the exact same curve. */
export const ghostBendOf = (len: number, order = 0): number =>
  Math.max(4, Math.min(THROW_PHYSICS.bowMax, len * THROW_PHYSICS.bowShare) + (order - 1) * THROW_PHYSICS.fan);

const TIER_HOLD_MS = [48, 64, 96, 136] as const;
const MOVE_HOLD_MULT: Record<string, number> = {
  hit: 1,
  rainbow: 1.15,
  surge_hit: 1.2,
  blast: 1.25,
  pinata_break: 1.25,
  laser: 0.9,
  ricochet: 0.85,
  link_burst: 0.85,
  parry: 1.15,
  perfect_parry: 1.35,
};

/** Impact freeze duration (ms) matching Sakurai's tier-scaled hitstop table ([FX-06]/[FX-11]). */
export const ghostHitstopHoldMs = (tier: HitTier, moveKind?: string): number =>
  Math.min(145, Math.round(TIER_HOLD_MS[tier] * ((moveKind && MOVE_HOLD_MULT[moveKind]) || 1)));

/** How long each way of leaving takes (the stage keeps the ghost mounted this long) */
export const GHOST_BREAK_MS: Record<GhostBreak, number> = { shatter: 240, vaporise: 240, throw: 300 };

/** Sample a point on a quadratic Bézier curve `P0 -> C -> P2` at `t` in `[0, 1]`. */
const quadPt = (p0: Point, ctrl: Point, p2: Point, t: number): Point => {
  const m = 1 - t;
  return {
    x: m * m * p0.x + 2 * m * t * ctrl.x + t * t * p2.x,
    y: m * m * p0.y + 2 * m * t * ctrl.y + t * t * p2.y,
  };
};

const subCurvePath = (p0: Point, ctrl: Point, p2: Point, t0: number, t1: number): string => {
  const a = quadPt(p0, ctrl, p2, t0);
  const mid = quadPt(p0, ctrl, p2, (t0 + t1) / 2);
  const b = quadPt(p0, ctrl, p2, t1);
  // Control point that passes the quadratic through `mid` at 0.5
  const cx = 2 * mid.x - 0.5 * (a.x + b.x);
  const cy = 2 * mid.y - 0.5 * (a.y + b.y);
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
};

/**
 * Curved color-matched swish ribbon trailing a thrown `Ghost` card ([FX-11], Ep. #177).
 * Three width-tapered quadratic Bézier segments with `#161412` ink outer stroke;
 * strictly GPU `opacity` animated and skipped under `useReducedMotion()`.
 */
export const SwishRibbon: React.FC<{
  from: Point;
  to: Point;
  bend: number;
  color: string;
  delay?: number;
  ms: number;
  testID?: string;
}> = ({ from, to, bend, color, delay = 0, ms, testID }) => {
  const reduced = useReducedMotion();
  const total = Math.max(80, ms + 48);
  const flightRatio = Math.min(1, ms / total);
  const p = useProgress(total, delay, EASE.linear);

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  // Matches Ghost's sideways normal `(uy, -ux)` so the ribbon traces the exact flight arc
  const ux = dx / len;
  const uy = dy / len;
  const ctrl: Point = {
    x: (from.x + to.x) / 2 + uy * bend * 1.4,
    y: (from.y + to.y) / 2 - ux * bend * 1.4,
  };

  const pad = 28;
  const minX = Math.min(from.x, to.x, ctrl.x) - pad;
  const minY = Math.min(from.y, to.y, ctrl.y) - pad;
  const w = Math.max(24, Math.max(from.x, to.x, ctrl.x) + pad - minX);
  const h = Math.max(24, Math.max(from.y, to.y, ctrl.y) + pad - minY);

  const lp0: Point = { x: from.x - minX, y: from.y - minY };
  const lctrl: Point = { x: ctrl.x - minX, y: ctrl.y - minY };
  const lp2: Point = { x: to.x - minX, y: to.y - minY };

  const segTail = subCurvePath(lp0, lctrl, lp2, 0.04, 0.38);
  const segMid = subCurvePath(lp0, lctrl, lp2, 0.3, 0.7);
  const segHead = subCurvePath(lp0, lctrl, lp2, 0.62, 0.99);

  // Each segment reveals strictly BEHIND the accelerating thrown Ghost card
  // (never ahead of it during wind-up or early flight) and whips cleanly out after passage.
  const tailStyle = useAnimatedStyle(() => {
    const t = p.value;
    const f = flightRatio;
    return {
      opacity: t <= 0 || t >= 1 ? 0 : seg(t, [0, 0.28 * f, 0.46 * f, 0.78 * f, 1], [0, 0, 0.72, 0, 0]),
      transform: [{ scale: seg(t, [0, 0.28 * f, 0.56 * f, 1], [0.96, 0.96, 1, 1]) }],
    };
  });
  const midStyle = useAnimatedStyle(() => {
    const t = p.value;
    const f = flightRatio;
    return {
      opacity: t <= 0 || t >= 1 ? 0 : seg(t, [0, 0.54 * f, 0.74 * f, Math.min(0.98, 0.98 * f + 0.08), 1], [0, 0, 0.78, 0, 0]),
      transform: [{ scale: seg(t, [0, 0.54 * f, 0.78 * f, 1], [0.96, 0.96, 1, 1]) }],
    };
  });
  const headStyle = useAnimatedStyle(() => {
    const t = p.value;
    const f = flightRatio;
    return {
      opacity: t <= 0 || t >= 1 ? 0 : seg(t, [0, 0.76 * f, 0.94 * f, 1], [0, 0, 0.84, 0]),
      transform: [{ scale: seg(t, [0, 0.76 * f, 0.96 * f, 1], [0.97, 0.97, 1, 1]) }],
    };
  });

  if (reduced) return null;

  return (
    <View
      pointerEvents="none"
      testID={testID ?? 'fx-swish-ribbon'}
      style={[st.abs, { left: minX, top: minY, width: w, height: h }]}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, tailStyle]}>
        <Svg width={w} height={h}>
          <Path d={segTail} fill="none" stroke={CHARCOAL_INK} strokeWidth={4.5} strokeLinecap="round" opacity={0.42} />
          <Path d={segTail} fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" opacity={0.55} />
        </Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, midStyle]}>
        <Svg width={w} height={h}>
          <Path d={segMid} fill="none" stroke={CHARCOAL_INK} strokeWidth={7.5} strokeLinecap="round" opacity={0.68} />
          <Path d={segMid} fill="none" stroke={color} strokeWidth={4.8} strokeLinecap="round" opacity={0.82} />
        </Svg>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, headStyle]}>
        <Svg width={w} height={h}>
          <Path d={segHead} fill="none" stroke={CHARCOAL_INK} strokeWidth={10.5} strokeLinecap="round" opacity={0.86} />
          <Path d={segHead} fill="none" stroke={color} strokeWidth={7.5} strokeLinecap="round" opacity={0.92} />
          <Path d={segHead} fill="none" stroke="#FFFDF5" strokeWidth={2.2} strokeLinecap="round" opacity={0.8} />
        </Svg>
      </Animated.View>
    </View>
  );
};

const noop = () => {};

/**
 * The card that was in a slot before something removed it. The engine swaps
 * in the next card at once; an unbroken covering ghost sits on top until its
 * beat arrives, while flying thrown cards and breaking ghosts use
 * `pointerEvents="none"` ([FX-11]) so freshly dealt cards underneath stay
 * immediately tappable.
 */
export const Ghost: React.FC<{
  rect: Rect;
  card: CardType;
  broken: boolean;
  how: GhostBreak;
  color: string;
  to?: Point | null;
  order?: number;
  ms?: number;
  /** Optional hitstop freeze hold on arrival before unmount ([FX-11]). */
  holdMs?: number;
}> = ({ rect, card, broken, how, color, to, order = 0, ms, holdMs = 0 }) => {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  const thrown = how === 'throw';
  const flightDuration = ms ?? GHOST_BREAK_MS[how];
  const totalDuration = thrown && holdMs > 0 ? flightDuration + holdMs : flightDuration;
  const flightShare = totalDuration > 0 ? Math.min(1, flightDuration / totalDuration) : 1;

  useEffect(() => {
    if (broken) {
      p.value = withTiming(1, { duration: fxMs(totalDuration), easing: thrown ? EASE.linear : EASE.in });
    }
    return () => cancelAnimation(p);
  }, [broken, totalDuration, thrown, p]);

  const dx = to ? to.x - (rect.x + rect.w / 2) : 0;
  const dy = to ? to.y - (rect.y + rect.h / 2) : -rect.h * 0.4;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const bend = ghostBendOf(len, order);
  const spin = order % 2 ? -1 : 1;
  const drawBackPx = THROW_PHYSICS.drawBack * Math.max(0.85, unitOf(rect) / 90);
  const pivotOrigin = order % 2 ? '36% 58%' : '64% 58%';

  const style = useAnimatedStyle(() => {
    const rawT = p.value;
    if (thrown) {
      if (reduced) {
        return {
          opacity: seg(rawT, [0, 0.65, 1], [1, 0.85, 0]),
          transform: [{ scale: CARD_MOTION.pickedScale }],
        };
      }
      // Clamp normalized flight time at 1.0 so the card holds cleanly at the foe's edge across hitstop
      const t = flightShare > 0 ? Math.min(1, rawT / flightShare) : 1;
      const pickFrac = t < THROW_PHYSICS.pickUp ? t / THROW_PHYSICS.pickUp : 1;
      const pickEase = 1 - (1 - pickFrac) * (1 - pickFrac) * (1 - pickFrac);
      const u = seg(t, [0, THROW_PHYSICS.pickUp, 1], [0, 0, 1]);
      // ease-in, already moving as it leaves the hand, accelerating into impact
      const fly = u * (THROW_PHYSICS.launch + (1 - THROW_PHYSICS.launch) * u);
      const back = drawBackPx * (t < THROW_PHYSICS.pickUp ? pickEase : seg(t, [THROW_PHYSICS.pickUp, THROW_PHYSICS.pickUp * 2], [1, 0]));
      const bow = Math.sin(Math.PI * u) * bend;
      const wobble = Math.sin(u * Math.PI * 4) * THROW_PHYSICS.wobblePx * (1 - u);
      const baseScale =
        t < THROW_PHYSICS.pickUp
          ? CARD_MOTION.pickedScale + (THROW_PHYSICS.lift - CARD_MOTION.pickedScale) * pickEase
          : THROW_PHYSICS.lift + (THROW_PHYSICS.arrive - THROW_PHYSICS.lift) * fly;
      // Mid-flight volume-preserving velocity stretch (1.18 Y / 0.86 X peak at u = 0.5)
      const stretchPhase = Math.sin(Math.PI * u);
      const stretchY = 1 + (THROW_PHYSICS.stretchPeakY - 1) * stretchPhase;
      const squashX = 1 - (1 - THROW_PHYSICS.squashPeakX) * stretchPhase;
      return {
        // Whole all the way: holds crisp on the target edge across hitstop until unmounted
        opacity: 1,
        transform: [
          { translateX: dx * fly - ux * back + uy * (bow + wobble) },
          { translateY: dy * fly - uy * back - ux * (bow + wobble) },
          { scaleX: baseScale * squashX },
          { scaleY: baseScale * stretchY },
          { rotate: `${spin * THROW_PHYSICS.bankDeg * fly}deg` },
        ],
      };
    }
    if (reduced) {
      return { opacity: seg(rawT, [0, 0.5, 1], [1, 0.7, 0]) };
    }
    return how === 'vaporise'
      ? { opacity: seg(rawT, [0, 0.5, 1], [1, 1, 0]), transform: [{ scaleX: seg(rawT, [0, 0.3, 1], [1, 1.08, 1.2]) }, { scaleY: seg(rawT, [0, 0.3, 1], [1, 0.9, 0.04]) }] }
      : { opacity: seg(rawT, [0, 0.45, 1], [1, 1, 0]), transform: [{ scale: seg(rawT, [0, 0.3, 1], [1, 1.14, 0.35]) }, { rotate: `${rawT * 16}deg` }] };
  });
  // A thrown card flies as itself (no wash); a broken one washes out as it goes
  const tint = useAnimatedStyle(() => ({ opacity: thrown ? 0 : seg(p.value, [0, 0.25, 1], [0, 0.85, 0.6]) }));
  return (
    // Only unbroken covering ghosts intercept taps; thrown cards and breaking ghosts never swallow taps on fresh dealt cards ([FX-11]).
    <Animated.View
      pointerEvents={thrown || broken ? 'none' : 'auto'}
      style={[
        st.abs,
        { left: rect.x, top: rect.y, width: rect.w, height: rect.h, ...(thrown ? { transformOrigin: pivotOrigin } : null) },
        style,
      ]}
      testID="fx-ghost"
    >
      {/* (a thrown card is drawn whole, not dimmed like a card you cannot tap: it is the Set itself, in flight) */}
      <Card card={{ ...card, selected: false, isHint: false, onFire: false }} onClick={noop} disabled={!thrown} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 12, backgroundColor: how === 'vaporise' ? color : WHITE }, tint]} />
    </Animated.View>
  );
};

const st = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  inked: { borderWidth: 2, borderColor: CHARCOAL_INK },
  core: { position: 'absolute', left: '18%', top: '16%', backgroundColor: WHITE, opacity: 0.9 },
  stamp: { fontWeight: '900', textAlign: 'center' },
  stampGlow: { textShadowColor: WHITE, textShadowRadius: 4, textShadowOffset: { width: 0, height: 0 } },
  stampLead: { textShadowColor: INK, textShadowRadius: 3, textShadowOffset: { width: 1, height: 2 } },
  stampHeavy: { letterSpacing: 1 },
  sticker: { backgroundColor: WHITE, borderRadius: 8, borderWidth: 2, borderColor: INK, paddingHorizontal: 7, paddingVertical: 1 },
  bannerPlate: { borderWidth: 4, borderBottomWidth: 8, borderColor: INK, paddingVertical: 2 },
  bannerText: { fontWeight: '900', letterSpacing: 2, color: WHITE, textShadowColor: INK, textShadowRadius: 0, textShadowOffset: { width: 2, height: 3 } },
  tag: { backgroundColor: COLORS.deepOnyx, borderRadius: 6, paddingVertical: 2, alignItems: 'center' },
  tagText: { color: WHITE, fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
});
