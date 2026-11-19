/**
 * The drawing vocabulary of the fight effects. Small pieces, each of which
 * animates itself once when it mounts, in stage coordinates.
 *
 * Style: flat colour, a white core and an ink outline, like the cards. Only
 * transforms and opacity move, so the pieces stay cheap on a phone.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming, type EasingFunction, type EasingFunctionFactory, type SharedValue } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';
import Card from '@/components/Card';
import { CARD_MOTION } from '@/components/CardMotion';
import type { Card as CardType } from '@/types';
import { COLORS } from '@/utils/colors';
import { EASE as MOTION, MS, exitMs } from '@/utils/motion';
import { fxMs } from './clock';
import type { HitTier, Point, Rect, SweepKind } from './types';

const INK = COLORS.slateCharcoal;
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

/** 0 → 1 over `ms`, starting `delay` ms after mount. Runs once. */
const useProgress = (ms: number, delay = 0, easing: EasingFunction | EasingFunctionFactory = EASE.linear): SharedValue<number> => {
  const p = useSharedValue(delay > 0 ? 0 : ON_MOUNT);
  useEffect(() => {
    p.value = withDelay(fxMs(delay), withTiming(1, { duration: fxMs(ms), easing }));
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

/** A ring that grows out of a point and fades. */
export const Ring: React.FC<{ at: Point; delay?: number; size: number; color: string; ms?: number; width?: number }> = ({ at, delay = 0, size, color, ms = 300, width = 3 }) => {
  const p = useProgress(ms, delay, EASE.out);
  const style = useAnimatedStyle(() => ({
    opacity: p.value <= 0 ? 0 : seg(p.value, [0, 0.5, 1], [1, 0.9, 0]),
    transform: [{ scale: 0.25 + 0.75 * p.value }],
  }));
  return (
    <Animated.View
      style={[st.abs, { left: at.x - size / 2, top: at.y - size / 2, width: size, height: size, borderRadius: size / 2, borderWidth: width, borderColor: color }, style]}
    />
  );
};

const TICKS = [0, 60, 120, 180, 240, 300];

/** Short lines thrown out from a point, like a comic-book impact. */
export const Ticks: React.FC<{ at: Point; delay?: number; size: number; color: string; ms?: number }> = ({ at, delay = 0, size, color, ms = 260 }) => {
  const p = useProgress(ms, delay, EASE.out);
  const style = useAnimatedStyle(() => ({
    opacity: p.value <= 0 ? 0 : seg(p.value, [0, 0.6, 1], [1, 1, 0]),
    transform: [{ scale: 0.45 + 0.75 * p.value }],
  }));
  const len = size * 0.24;
  return (
    <Animated.View style={[st.abs, { left: at.x - size / 2, top: at.y - size / 2, width: size, height: size }, style]}>
      {TICKS.map(deg => (
        <View key={deg} style={[st.abs, { left: size / 2 - 1.5, top: 0, width: 3, height: size, transform: [{ rotate: `${deg}deg` }] }]}>
          <View style={{ width: 3, height: len, borderRadius: 2, backgroundColor: color }} />
        </View>
      ))}
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

/**
 * A spiky comic explosion: there at most of its size on the frame of the hit, past it two frames later,
 * settled by the sixth, then it swells a little as it fades. (Progress is eased, so the keys are in eased time.)
 */
export const Starburst: React.FC<{ at: Point; delay?: number; size: number; color: string; ms?: number }> = ({ at, delay = 0, size, color, ms = 440 }) => {
  const p = useProgress(ms, delay, MOTION.ui);
  const style = useAnimatedStyle(() => {
    const t = p.value;
    return {
      opacity: t <= 0 ? 0 : seg(t, [0, 0.75, 1], [1, 1, 0]),
      transform: [{ scale: seg(t, [0, 0.3, 0.5, 1], [0.7, 1.15, 1, 1.25]) }, { rotate: `${seg(t, [0, 1], [-14, 10])}deg` }],
    };
  });
  const c = size / 2;
  return (
    <Animated.View style={[st.abs, { left: at.x - c, top: at.y - c, width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Polygon points={starPoints(11, c - 2, c * 0.6, c)} fill={color} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        <Polygon points={starPoints(9, c * 0.56, c * 0.3, c)} fill="#FFE45C" />
        <Polygon points={starPoints(6, c * 0.26, c * 0.12, c)} fill={WHITE} />
      </Svg>
    </Animated.View>
  );
};

// ─── Lines ──────────────────────────────────────────────────────────────────

/**
 * A beam drawn from one point to another: shoots out, flickers, then thins
 * away. Lasers, the bolts of a ricochet and links are all this.
 */
export const Beam: React.FC<{ from: Point; to: Point; delay?: number; thickness: number; color: string; hold?: number; core?: boolean }> = ({ from, to, delay = 0, thickness, color, hold = 150, core = true }) => {
  const grow = 90;
  const fade = 130;
  const total = grow + hold + fade;
  const p = useProgress(total, delay);
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const a = grow / total;
  const b = (grow + hold) / total;
  const style = useAnimatedStyle(() => {
    const t = p.value;
    return {
      opacity: t <= 0 || t >= 1 ? 0 : 1,
      transform: [
        { rotate: `${angle}rad` },
        { scaleX: seg(t, [0, a], [0.02, 1]) },
        { scaleY: t < a ? 1 : t < b ? 1 + 0.3 * Math.sin(((t - a) / (b - a)) * Math.PI * 3) : seg(t, [b, 1], [1, 0.05]) },
      ],
    };
  });
  return (
    <Animated.View
      style={[
        st.abs,
        st.inked,
        { left: from.x, top: from.y - thickness / 2, width: len, height: thickness, borderRadius: thickness / 2, backgroundColor: color, transformOrigin: 'left center', justifyContent: 'center' },
        style,
      ]}
    >
      {core && <View style={{ height: Math.max(2, thickness * 0.34), marginHorizontal: thickness * 0.3, borderRadius: thickness, backgroundColor: WHITE }} />}
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

// ─── A card that is no longer there ─────────────────────────────────────────

/** How a card leaves: 'throw' is the Set's own cards, flung at whatever the Set hits */
export type GhostBreak = 'shatter' | 'vaporise' | 'throw';

/** The throw of the Set's own cards, as shares of its flight and pixels */
const THROW = {
  /** Share of the flight spent being picked up before it leaves */
  pickUp: 0.2,
  /** How big it is when picked up, and when it reaches the target */
  lift: 1.1,
  arrive: 0.3,
  /** How far it draws back, away from the target, as it is picked up (px) */
  drawBack: 8,
  /** Its speed as it leaves, as a share of an even pace (0 = a plain ease-in, 1 = linear) */
  launch: 0.35,
  /** The bow at the middle of the flight: this share of the distance, at most `bowMax` px; the cards fan `fan` px apart */
  bowShare: 0.06,
  bowMax: 20,
  fan: 10,
} as const;

/** How long each way of leaving takes (the stage keeps the ghost mounted this long) */
export const GHOST_BREAK_MS: Record<GhostBreak, number> = { shatter: 240, vaporise: 240, throw: 300 };

const noop = () => {};

/**
 * The card that was in a slot before something removed it. The engine swaps
 * in the next card at once; the ghost sits on top until its beat arrives and
 * then breaks, so the player sees the old card get hit and the new one appear.
 */
export const Ghost: React.FC<{ rect: Rect; card: CardType; broken: boolean; how: GhostBreak; color: string; to?: Point | null; order?: number; ms?: number }> = ({ rect, card, broken, how, color, to, order = 0, ms }) => {
  const p = useSharedValue(0);
  const thrown = how === 'throw';
  const duration = ms ?? GHOST_BREAK_MS[how];
  useEffect(() => {
    if (broken) p.value = withTiming(1, { duration: fxMs(duration), easing: thrown ? EASE.linear : EASE.in });
  }, [broken, duration, thrown, p]);
  // A thrown card is picked up (it grows and draws back a little), then flies at its target on a bow,
  // speeding up into the hit, shrinking and turning as it goes; without a target it just pops away
  const dx = to ? to.x - (rect.x + rect.w / 2) : 0;
  const dy = to ? to.y - (rect.y + rect.h / 2) : -rect.h * 0.4;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  // the bow bends to the left of the way it flies; the three cards fan apart on it and meet on the target
  const bend = Math.max(4, Math.min(THROW.bowMax, len * THROW.bowShare) + (order - 1) * THROW.fan);
  const spin = order % 2 ? -1 : 1;
  const style = useAnimatedStyle(() => {
    const t = p.value;
    if (thrown) {
      const u = seg(t, [0, THROW.pickUp, 1], [0, 0, 1]);
      // ease-in, but already moving when it leaves the hand: it speeds up into the hit
      const fly = u * (THROW.launch + (1 - THROW.launch) * u);
      const back = THROW.drawBack * seg(t, [0, THROW.pickUp, THROW.pickUp * 2], [0, 1, 0]);
      const bow = Math.sin(Math.PI * u) * bend;
      return {
        // whole all the way: it waits on the target until the stage takes it away, on the frame the burst appears
        opacity: 1,
        transform: [
          { translateX: dx * fly - ux * back + uy * bow },
          { translateY: dy * fly - uy * back - ux * bow },
          // (it starts as big as the picked card it replaces on the board, so the hand-off has no step)
          { scale: t < THROW.pickUp ? CARD_MOTION.pickedScale + (THROW.lift - CARD_MOTION.pickedScale) * (t / THROW.pickUp) : THROW.lift + (THROW.arrive - THROW.lift) * fly },
          { rotate: `${spin * 24 * fly}deg` },
        ],
      };
    }
    return how === 'vaporise'
      ? { opacity: seg(t, [0, 0.5, 1], [1, 1, 0]), transform: [{ scaleX: seg(t, [0, 0.3, 1], [1, 1.08, 1.2]) }, { scaleY: seg(t, [0, 0.3, 1], [1, 0.9, 0.04]) }] }
      : { opacity: seg(t, [0, 0.45, 1], [1, 1, 0]), transform: [{ scale: seg(t, [0, 0.3, 1], [1, 1.14, 0.35]) }, { rotate: `${t * 16}deg` }] };
  });
  // A thrown card flies as itself (no wash); a broken one washes out as it goes
  const tint = useAnimatedStyle(() => ({ opacity: thrown ? 0 : seg(p.value, [0, 0.25, 1], [0, 0.85, 0.6]) }));
  return (
    // Swallows taps: the card under it is not the one the player is looking at
    <Animated.View style={[st.abs, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }, style]} testID="fx-ghost">
      {/* (a thrown card is drawn whole, not dimmed like a card you cannot tap: it is the Set itself, in flight) */}
      <Card card={{ ...card, selected: false, isHint: false, onFire: false }} onClick={noop} disabled={!thrown} />
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: 12, backgroundColor: how === 'vaporise' ? color : WHITE }, tint]} />
    </Animated.View>
  );
};

const st = StyleSheet.create({
  abs: { position: 'absolute', left: 0, top: 0 },
  inked: { borderWidth: 2, borderColor: INK },
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
