/**
 * The drawing vocabulary of the fight effects. Small pieces, each of which
 * animates itself once when it mounts, in stage coordinates.
 *
 * Style: flat colour, a white core and an ink outline, like the cards. Only
 * transforms and opacity move, so the pieces stay cheap on a phone.
 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated';
import Svg, { Polygon } from 'react-native-svg';
import Card from '@/components/Card';
import type { Card as CardType } from '@/types';
import { COLORS } from '@/utils/colors';
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

/** 0 → 1 over `ms`, starting `delay` ms after mount. Runs once. */
const useProgress = (ms: number, delay = 0, easing: (t: number) => number = EASE.linear): SharedValue<number> => {
  const p = useSharedValue(0);
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

/** A spiky comic explosion: pops out past its size, settles, then swells and fades. */
export const Starburst: React.FC<{ at: Point; delay?: number; size: number; color: string; ms?: number }> = ({ at, delay = 0, size, color, ms = 440 }) => {
  const p = useProgress(ms, delay);
  const style = useAnimatedStyle(() => {
    const t = p.value;
    return {
      opacity: t <= 0 ? 0 : seg(t, [0, 0.6, 1], [1, 1, 0]),
      transform: [{ scale: seg(t, [0, 0.28, 0.45, 1], [0.15, 1.18, 1, 1.3]) }, { rotate: `${seg(t, [0, 1], [-14, 10])}deg` }],
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
/** A tag on a card is smaller: it should not hide the card */
const STICKER_SIZE = 13;

/**
 * A number or a word that pops where something landed, holds, then drifts up
 * and fades. `sticker` gives it a white tag so it reads over the cards.
 * A sour one shakes its head instead of popping.
 */
export const Stamp: React.FC<{ at: Point; text: string; color: string; tier?: HitTier; delay?: number; sticker?: boolean; sour?: boolean; fromLeft?: boolean; maxX: number }> = ({ at, text, color, tier = 0, delay = 0, sticker, sour, fromLeft, maxX }) => {
  const hold = 520 + tier * 200;
  const total = hold + 400;
  const p = useProgress(total, delay);
  const size = sticker ? STICKER_SIZE + tier * 3 : STAMP_SIZE[tier];
  // keep the whole word on screen (a rough width is enough)
  const width = Math.min(maxX - 8, text.length * size * 0.62 + (sticker ? 16 : 0));
  // `fromLeft`: the word starts at the point instead of being centred on it (a long word next to a small target)
  const left = Math.max(4, Math.min(maxX - width - 4, fromLeft ? at.x : at.x - width / 2));
  const h = hold / total;
  const style = useAnimatedStyle(() => {
    const t = p.value;
    return {
      opacity: t <= 0 ? 0 : seg(t, [0, h, 1], [1, 1, 0]),
      transform: [
        { translateX: sour ? seg(t, [0, 0.06, 0.12, 0.18, 0.24], [0, -6, 6, -4, 0]) : 0 },
        { translateY: -seg(t, [0, 0.12, 1], [0, 4, 16 + tier * 6]) },
        { scale: sour ? 1 : seg(t, [0, 0.1, 0.2, 1], [0.5, 1.22, 1, 1]) },
      ],
    };
  });
  return (
    <Animated.View style={[st.abs, { left, top: at.y - size * 0.7, width, alignItems: 'center' }, style]} testID={`floater-tier-${tier}`}>
      <View style={sticker ? st.sticker : undefined}>
        <Text
          numberOfLines={1}
          style={[st.stamp, { color, fontSize: size, lineHeight: size * 1.15 }, !sticker && st.stampGlow, tier >= 2 && st.stampHeavy]}
        >
          {text}
        </Text>
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

export type GhostBreak = 'shatter' | 'vaporise';

const noop = () => {};

/**
 * The card that was in a slot before something removed it. The engine swaps
 * in the next card at once; the ghost sits on top until its beat arrives and
 * then breaks, so the player sees the old card get hit and the new one appear.
 */
export const Ghost: React.FC<{ rect: Rect; card: CardType; broken: boolean; how: GhostBreak; color: string }> = ({ rect, card, broken, how, color }) => {
  const p = useSharedValue(0);
  useEffect(() => {
    if (broken) p.value = withTiming(1, { duration: fxMs(240), easing: EASE.in });
  }, [broken, p]);
  const style = useAnimatedStyle(() => {
    const t = p.value;
    return how === 'vaporise'
      ? { opacity: seg(t, [0, 0.5, 1], [1, 1, 0]), transform: [{ scaleX: seg(t, [0, 0.3, 1], [1, 1.08, 1.2]) }, { scaleY: seg(t, [0, 0.3, 1], [1, 0.9, 0.04]) }] }
      : { opacity: seg(t, [0, 0.45, 1], [1, 1, 0]), transform: [{ scale: seg(t, [0, 0.3, 1], [1, 1.14, 0.35]) }, { rotate: `${t * 16}deg` }] };
  });
  const tint = useAnimatedStyle(() => ({ opacity: seg(p.value, [0, 0.25, 1], [0, 0.85, 0.6]) }));
  return (
    // Swallows taps: the card under it is not the one the player is looking at
    <Animated.View style={[st.abs, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }, style]} testID="fx-ghost">
      <Card card={{ ...card, selected: false, isHint: false, onFire: false }} onClick={noop} disabled />
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
  stampHeavy: { letterSpacing: 1 },
  sticker: { backgroundColor: WHITE, borderRadius: 8, borderWidth: 2, borderColor: INK, paddingHorizontal: 7, paddingVertical: 1 },
  tag: { backgroundColor: COLORS.deepOnyx, borderRadius: 6, paddingVertical: 2, alignItems: 'center' },
  tagText: { color: WHITE, fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
});
