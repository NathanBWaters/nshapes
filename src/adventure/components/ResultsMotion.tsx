/**
 * The results screen's choreography (motion review: docs/motion/reviews/results-payout.md).
 *
 * Angry Birds–inspired giant trophy stars + ceremonial Victory Card:
 *   1. The card arrives whole into place (`ResultsCard`).
 *   2. Each earned giant beveled SVG star swoops across the screen on an arc from
 *      off-axis (`fromX`, `fromY`, huge starting scale) and SLAMS into its carved
 *      trophy socket on `starLandMs(i)` (`EASE.impact`), hiding the empty hollow,
 *      physically thumping the entire card downward (`+4 / +6.5 / +9.5 px`), squashing
 *      for 2 frames, rebounding on `SPRING.playful`, and bursting crisp ink/gold
 *      impact rays + a golden shockwave ring. Star 3 triggers the golden crest
 *      flare and celebratory confetti flecks.
 *   3. Each goal's ✓ springs in 64 ms behind its star, followed by the earned
 *      Victory Rank Seal stamp (`VictorySeal`).
 *   4. After unlock reveals close, each revealed reward row turns over (`TurnOver`),
 *      then the coin total counts up tick for tick with `coinRoll` and the fighter
 *      cheers on the closing bell.
 *
 * Pure GPU `transform` and `opacity`; zero infinite loops (battery-friendly).
 * Under Reduced Motion every piece renders crisply finished on frame 0.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Animated, {
  runOnJS,
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Path, Polygon, Circle } from 'react-native-svg';
import { COLORS } from '@/utils/colors';
import { EASE, exitMs, MS, SCALE, SPRING, SQUASH, STAGGER, staggerDelay, STAYS } from '@/utils/motion';
import { CoinPill, INK, STAR_FALL_MS, starLandMs, starPopDelayMs, TONE } from './ui';

/** The band's coinRoll cue rings this many ticks, 45 ms apart, then a bell (src/audio/band.ts). */
export const COIN_TICK_MS = 45;
export const coinRollTicks = (amount: number): number => Math.max(3, Math.min(24, amount));
/** The coinRoll cue's size for a payout: a bigger payout rolls longer, 16 ticks (0.7 s) at most */
export const coinRollAmount = (coins: number): number => Math.min(16, 4 + Math.round(coins / 25));
/** A breath between the last star's hit and the coins starting to count */
export const COIN_BREATH_MS = 300;
/** When the coin count starts on a result with `stars` stars (no reveal in between) */
export const coinStartMs = (stars: number): number => (stars > 0 ? starLandMs(stars - 1) : 0) + COIN_BREATH_MS;
/** When the goal rows that did not earn a star show their ✗: after the last hit */
export const missesShownMs = (stars: number): number => (stars > 0 ? starLandMs(stars - 1) + 160 : 160);
/** When the performance rank seal stamps into the Victory Header */
export const sealLandMs = (stars: number): number => (stars > 0 ? starLandMs(stars - 1) + 140 : 280);
/** The unlock reveal's way out (UnlockReveal.tsx): the dark screen goes in this long, then the results take over */
export const REVEAL_EXIT_MS = exitMs(MS.panel);
/** One unlocked row turning over on the results, edge-on and back (the reveal's own turn, smaller) */
const ROW_TURN_MS = MS.feedback;
/** When unlocked row `k` of `n` turns over, after the reveal has gone */
export const rowTurnMs = (k: number, n: number): number => staggerDelay(k, n, STAGGER.item);
/**
 * After the last unlock reveal closes: the payout (or, with no coins, the fighter's cheer) starts once the
 * unlocked rows in sight have turned over, with a breath; 450 ms when there are no rows.
 */
export const revealPayoutMs = (rows: number): number => {
  if (rows <= 0) return 450;
  // Waits for the rows a phone shows under the payout (two), not for the ones below the fold
  const seen = Math.min(rows, 2);
  return rowTurnMs(seen - 1, rows) + 2 * ROW_TURN_MS + 120;
};
/** The fighter's cheer starts this long after the last star hits (after the ring has gone out) */
export const FIGHTER_CHEER_LAG_MS = 200;
/** A ✓ lands just behind its star: the star is the hero, the tick is its echo */
export const TICK_LAG_MS = 64;

/** How long a landed star stays squashed before it springs back (2 frames) */
const SQUASH_HOLD_MS = 32;

/**
 * The results card rises into place, then physically THUMPS downward on each giant
 * star stamp (`stampStars` = 1..3), escalating in weight (+4 → +6.5 → +9.5 px) so every
 * star carries tactile Angry Birds stamp impact.
 */
export const ResultsCard: React.FC<{
  reduced: boolean;
  stampStars?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}> = ({ reduced, stampStars = 0, style, children }) => {
  const y = useSharedValue(reduced ? 0 : 24);
  const thumpY = useSharedValue(0);
  const thumpScale = useSharedValue(1);
  const o = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    y.value = withTiming(0, { duration: MS.panel, easing: EASE.enterSoft });
    o.value = withTiming(1, { duration: MS.feedback, easing: EASE.ui });

    const count = Math.max(0, Math.min(3, stampStars));
    if (count > 0) {
      // Build one clean sequential timeline of physical thumps on each star's exact landing frame
      const amps = [4, 6.5, 9.5];
      const scales = [0.996, 0.993, 0.988];
      const ySteps: number[] = [];
      const sSteps: number[] = [];
      let cursor = 0;
      for (let i = 0; i < count; i++) {
        const hitAt = starLandMs(i);
        const wait = Math.max(0, hitAt - cursor);
        ySteps.push(
          withDelay(wait, withTiming(amps[i], { duration: 24, easing: EASE.ui })),
          withDelay(24, withSpring(0, SPRING.snappy))
        );
        sSteps.push(
          withDelay(wait, withTiming(scales[i], { duration: 24, easing: EASE.ui })),
          withDelay(24, withSpring(1, SPRING.snappy))
        );
        // Each thump takes ~190 ms to settle well before the next 340 ms star lands
        cursor = hitAt + 190;
      }
      thumpY.value = ySteps.length === 2 ? withSequence(ySteps[0], ySteps[1]) : withSequence(...ySteps);
      thumpScale.value = sSteps.length === 2 ? withSequence(sSteps[0], sSteps[1]) : withSequence(...sSteps);
    }
  }, [reduced, stampStars, y, thumpY, thumpScale, o]);

  const a = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: y.value + thumpY.value }, { scale: thumpScale.value }],
  }));
  return <Animated.View style={[a, style]}>{children}</Animated.View>;
};

/** Fades in at `at` ms, in place (a caption that belongs to something that just landed). */
export const FadeAt: React.FC<{ at: number; reduced: boolean; children: React.ReactNode }> = ({ at, reduced, children }) => {
  const o = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) o.value = withDelay(at, withTiming(1, { duration: MS.quick, easing: EASE.ui, ...STAYS }), STAYS.reduceMotion);
  }, [at, reduced, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={a}>{children}</Animated.View>;
};

/**
 * Custom layered vector SVG beveled Trophy Star: thick dark-ink outline, sunlit
 * top-left gold facet, warm gold body, rich deep amber lower bevel, and specular
 * highlight — razor-sharp at every slam scale (never blurry scaled-up text).
 */
const STAR_PTS = '50,5 63.5,33.5 95,37.8 72,59.5 77.8,91 50,75.8 22.2,91 28,59.5 5,37.8 36.5,33.5';

export const TrophyStarSvg: React.FC<{ size: number; filled: boolean; darkSocket?: boolean }> = ({ size, filled, darkSocket = true }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    {filled ? (
      <>
        {/* Base warm gold star with thick comic ink outline */}
        <Polygon points={STAR_PTS} fill="#F5B800" stroke="#1A1715" strokeWidth="5.5" strokeLinejoin="round" />
        {/* Sunlit upper-left bevel facet */}
        <Polygon points="50,9 50,52 29,59 9,39 38,35" fill="#FFF066" />
        <Polygon points="50,9 62,35 91,39 50,52" fill="#FFE033" />
        {/* Deep rich amber lower-right bevel */}
        <Polygon points="50,52 91,39 70,59 75,88 50,73" fill="#D48400" />
        <Polygon points="50,52 50,73 25,88 30,59" fill="#E39A00" />
        {/* Crisp comic specular glint */}
        <Path d="M46 21 L41 34 L28 38" stroke="#FFFDF5" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity={0.92} />
        <Circle cx="36" cy="45" r="2.6" fill="#FFFDF5" opacity={0.88} />
      </>
    ) : (
      <>
        {/* Engraved recessed trophy socket */}
        <Polygon
          points={STAR_PTS}
          fill={darkSocket ? '#2B2622' : TONE.emptyPip}
          stroke={darkSocket ? '#141110' : '#BEB6AA'}
          strokeWidth="4.5"
          strokeLinejoin="round"
        />
        <Polygon
          points="50,14 60,36 85,40 67,56 71,82 50,70 29,82 33,56 15,40 40,36"
          fill={darkSocket ? '#211D1A' : '#CFC7BC'}
          opacity={0.7}
        />
      </>
    )}
  </Svg>
);

/** Deterministic radial impact rays shooting out on a star's stamp frame */
const IMPACT_RAYS = [0, 60, 120, 180, 240, 300] as const;

/** Celebratory geometric confetti flecks erupting on a 3-star climax */
const CLIMAX_FLECKS = [
  { dx: -112, dy: -46, color: COLORS.actionYellow, size: 8, rot: -140, delay: 0 },
  { dx: -84, dy: -74, color: '#16AA98', size: 7, rot: 120, delay: 16 },
  { dx: -44, dy: -88, color: '#FFFDF5', size: 6, rot: -95, delay: 24 },
  { dx: 0, dy: -94, color: '#F5B800', size: 9, rot: 160, delay: 8 },
  { dx: 46, dy: -84, color: '#F0483E', size: 7, rot: -130, delay: 18 },
  { dx: 86, dy: -70, color: COLORS.actionYellow, size: 8, rot: 135, delay: 10 },
  { dx: 114, dy: -42, color: '#16AA98', size: 7, rot: -115, delay: 22 },
  { dx: -96, dy: -12, color: '#F0483E', size: 6, rot: 90, delay: 28 },
  { dx: 98, dy: -10, color: '#FFFDF5', size: 6, rot: -105, delay: 30 },
  { dx: 24, dy: -66, color: '#FFE84D', size: 7, rot: 110, delay: 14 },
] as const;

const ClimaxFleck: React.FC<{
  dx: number;
  dy: number;
  color: string;
  size: number;
  rot: number;
  landAt: number;
}> = ({ dx, dy, color, size, rot, landAt }) => {
  const p = useSharedValue(0);
  const op = useSharedValue(0);

  useEffect(() => {
    p.value = withDelay(landAt, withTiming(1, { duration: 540, easing: EASE.enter }));
    op.value = withDelay(
      landAt,
      withSequence(
        withTiming(1, { duration: 32, easing: EASE.ui }),
        withDelay(260, withTiming(0, { duration: 250, easing: EASE.exitSoft }))
      )
    );
  }, [landAt, p, op]);

  const anim = useAnimatedStyle(() => {
    const t = p.value;
    // Parabolic gravity lift & settle arc
    const gravity = t * t * 34;
    return {
      opacity: op.value,
      transform: [
        { translateX: dx * t },
        { translateY: dy * t + gravity },
        { rotate: `${rot * t}deg` },
        { scale: 0.6 + (1 - t) * 0.55 },
      ],
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        st.fleck,
        { width: size, height: size * 0.68, backgroundColor: color, borderRadius: 2 },
        anim,
      ]}
    />
  );
};

interface StarFlight {
  fromX: number;
  fromY: number;
  fromRot: number;
  restRot: number;
  startScale: number;
}

const STAR_FLIGHTS: readonly StarFlight[] = [
  { fromX: -82, fromY: -78, fromRot: -34, restRot: -10, startScale: 1.85 },
  { fromX: -10, fromY: -98, fromRot: 24, restRot: 0, startScale: 1.95 },
  { fromX: 84, fromY: -92, fromRot: 36, restRot: 10, startScale: 2.05 },
];

/**
 * One giant Angry Birds–style trophy star.
 * Sweeps across the screen along an angled arc at huge scale, SLAMS into its
 * carved pedestal socket on `delay + STAR_FALL_MS`, hides the empty hollow,
 * squashes for 2 frames, rebounds on `SPRING.playful`, and fires a crisp golden
 * shockwave ring + radial ink impact ticks.
 */
const BigStar: React.FC<{
  index: number;
  filled: boolean;
  size: number;
  delay: number;
  big: boolean;
  reduced: boolean;
  darkSocket?: boolean;
}> = ({ index, filled, size, delay, big, reduced, darkSocket = true }) => {
  const flight = STAR_FLIGHTS[index % STAR_FLIGHTS.length];
  const animate = filled && delay >= 0 && !reduced;

  const progress = useSharedValue(animate ? 0 : 1);
  const o = useSharedValue(animate ? 0 : 1);
  const socketOp = useSharedValue(filled && !animate ? 0 : 1);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const ring = useSharedValue(animate ? 0 : 1);

  useEffect(() => {
    if (!animate) return;
    const land = delay + STAR_FALL_MS;
    o.value = withDelay(delay, withTiming(1, { duration: 64, easing: EASE.ui }));
    progress.value = withDelay(delay, withTiming(1, { duration: STAR_FALL_MS, easing: EASE.impact }));
    // Hide the empty grey/dark socket on the exact stamp frame so no tip peeks out during squash
    socketOp.value = withDelay(land, withTiming(0, { duration: 16, easing: EASE.linear }));
    // Heavy stamp squash held 2 frames, then lively playful rebound
    const sqX = big ? 1.25 : SQUASH.squash.x;
    const sqY = big ? 0.76 : SQUASH.squash.y;
    sx.value = withDelay(
      land,
      withSequence(
        withTiming(sqX, { duration: 16, easing: EASE.ui }),
        withDelay(SQUASH_HOLD_MS, withSpring(1, SPRING.playful))
      )
    );
    sy.value = withDelay(
      land,
      withSequence(
        withTiming(sqY, { duration: 16, easing: EASE.ui }),
        withDelay(SQUASH_HOLD_MS, withSpring(1, SPRING.playful))
      )
    );
    ring.value = withDelay(land, withTiming(1, { duration: MS.move + (big ? 60 : 0), easing: EASE.enter }));
  }, [animate, big, delay, o, progress, socketOp, sx, sy, ring]);

  const starStyle = useAnimatedStyle(() => {
    const t = progress.value;
    // Slight parabolic lift mid-flight so the star arcs rather than travelling a flat straight line
    const arcLift = Math.sin(Math.PI * t) * -22;
    const tx = flight.fromX * (1 - t);
    const ty = flight.fromY * (1 - t) + arcLift;
    const sc = flight.startScale + (1 - flight.startScale) * t;
    const rot = flight.fromRot + (flight.restRot - flight.fromRot) * t;
    return {
      opacity: o.value,
      transform: [
        { translateX: tx },
        { translateY: ty },
        { rotate: `${rot}deg` },
        { scaleX: sc * sx.value },
        { scaleY: sc * sy.value },
      ],
    };
  });

  const socketStyle = useAnimatedStyle(() => ({
    opacity: socketOp.value,
    transform: [{ rotate: `${flight.restRot}deg` }],
  }));

  const reach = big ? 2.15 : 1.72;
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value <= 0 || ring.value >= 1 ? 0 : 0.95 * (1 - ring.value),
    transform: [{ scale: 0.65 + ring.value * (reach - 0.65) }],
  }));

  const raysStyle = useAnimatedStyle(() => ({
    opacity: ring.value <= 0 || ring.value >= 0.85 ? 0 : (1 - ring.value / 0.85),
    transform: [{ scale: 0.55 + ring.value * (big ? 1.15 : 0.85) }],
  }));

  const ringD = size * 0.94;
  return (
    <View style={[st.starSlot, { width: size, height: size }, index === 1 && st.centerStarLift]}>
      {/* Carved empty trophy socket (hidden cleanly the frame the earned star stamps home) */}
      <Animated.View style={[StyleSheet.absoluteFillObject, st.center, socketStyle]} pointerEvents="none">
        <TrophyStarSvg size={size} filled={false} darkSocket={darkSocket} />
      </Animated.View>

      {/* Gold shockwave ring + radial impact ticks on landing */}
      {animate && (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              st.ring,
              {
                width: ringD,
                height: ringD,
                left: (size - ringD) / 2,
                top: (size - ringD) / 2,
                borderRadius: ringD / 2,
                borderWidth: big ? 4.5 : 3.5,
              },
              ringStyle,
            ]}
          />
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, st.center, raysStyle]}>
            {IMPACT_RAYS.map(deg => (
              <View
                key={deg}
                style={[
                  st.impactRay,
                  {
                    transform: [{ rotate: `${deg}deg` }, { translateY: -(size * 0.58) }],
                    backgroundColor: big ? COLORS.actionYellow : '#FFE84D',
                  },
                ]}
              />
            ))}
          </Animated.View>
        </>
      )}

      {/* Earned giant beveled gold star */}
      {filled && (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, st.center, starStyle]}>
          <TrophyStarSvg size={size} filled darkSocket={darkSocket} />
        </Animated.View>
      )}
    </View>
  );
};

/**
 * Giant arched Angry Birds–inspired Trophy Star row.
 * Center star is larger and lifted slightly above the tilted flanking stars;
 * a 3-star climax pops celebratory geometric flecks out from behind the pedestal.
 */
export const ResultStars: React.FC<{
  stars: number;
  size?: number;
  reduced: boolean;
  max?: number;
  darkSocket?: boolean;
}> = ({ stars, size = 66, reduced, max = 3, darkSocket = true }) => {
  const isPerfect = stars >= max && !reduced;
  const climaxAt = starLandMs(max - 1);

  return (
    <View style={st.starsStage} testID="results-stars">
      {/* 3-star grand climax confetti burst originating behind the center trophy star */}
      {isPerfect && (
        <View style={st.fleckOrigin} pointerEvents="none">
          {CLIMAX_FLECKS.map((f, idx) => (
            <ClimaxFleck
              key={idx}
              dx={f.dx}
              dy={f.dy}
              color={f.color}
              size={f.size}
              rot={f.rot}
              landAt={climaxAt + f.delay}
            />
          ))}
        </View>
      )}

      <View style={st.starsRow}>
        {Array.from({ length: max }).map((_, i) => {
          const starSize = max === 3 && i === 1 ? Math.round(size * 1.2) : size;
          return (
            <BigStar
              key={i}
              index={i}
              filled={i < stars}
              size={starSize}
              delay={i < stars ? starPopDelayMs(i) : -1}
              big={stars >= max && i === max - 1}
              reduced={reduced}
              darkSocket={darkSocket}
            />
          );
        })}
      </View>
    </View>
  );
};

/**
 * Subtle ceremonial golden sunburst behind the Victory Header stars.
 * Static at rest (zero infinite loop!); pulses once on a 3-star stamp climax.
 */
export const VictorySunburst: React.FC<{ stars: number; reduced: boolean }> = ({ stars, reduced }) => {
  const pulse = useSharedValue(reduced ? 1 : 0.88);
  const op = useSharedValue(reduced ? (stars >= 3 ? 0.22 : 0.12) : 0.08);

  useEffect(() => {
    if (reduced || stars <= 0) return;
    const last = starLandMs(stars - 1);
    const targetOp = stars >= 3 ? 0.28 : 0.14;
    op.value = withDelay(
      last,
      withSequence(
        withTiming(stars >= 3 ? 0.34 : 0.18, { duration: MS.quick, easing: EASE.enter }),
        withTiming(targetOp, { duration: MS.panel, easing: EASE.ui })
      )
    );
    pulse.value = withDelay(
      last,
      withSequence(
        withTiming(stars >= 3 ? 1.15 : 1.05, { duration: MS.quick, easing: EASE.enter }),
        withSpring(1, SPRING.settle)
      )
    );
  }, [stars, reduced, pulse, op]);

  const anim = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ scale: pulse.value }],
  }));

  return (
    <Animated.View pointerEvents="none" style={[st.sunburstWrap, anim]}>
      <Svg width={360} height={240} viewBox="0 0 360 240">
        {Array.from({ length: 12 }).map((_, i) => {
          const a0 = ((i * 30 - 6) * Math.PI) / 180;
          const a1 = ((i * 30 + 6) * Math.PI) / 180;
          const cx = 180;
          const cy = 128;
          const r = 210;
          const x1 = cx + Math.cos(a0) * r;
          const y1 = cy + Math.sin(a0) * r;
          const x2 = cx + Math.cos(a1) * r;
          const y2 = cy + Math.sin(a1) * r;
          return <Polygon key={i} points={`${cx},${cy} ${x1},${y1} ${x2},${y2}`} fill="#FFE033" />;
        })}
      </Svg>
    </Animated.View>
  );
};

/**
 * Earned Victory Rank Seal ("FLAWLESS", "BOSS SLAYER", "NEW RECORD", "3★ MASTER")
 * that slams into the Victory Header right after the last star settles.
 */
export const VictorySeal: React.FC<{
  label: string;
  accent?: 'gold' | 'teal' | 'coral';
  at: number;
  reduced: boolean;
}> = ({ label, accent = 'gold', at, reduced }) => {
  const s = useSharedValue(reduced ? 1 : 1.55);
  const o = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) return;
    o.value = withDelay(at, withTiming(1, { duration: 48, easing: EASE.ui, ...STAYS }), STAYS.reduceMotion);
    s.value = withDelay(
      at,
      withSequence(
        withTiming(0.94, { duration: MS.feedback, easing: EASE.impact }),
        withSpring(1, SPRING.snappy)
      )
    );
  }, [at, reduced, s, o]);

  const anim = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ rotate: '-4deg' }, { scale: s.value }],
  }));

  const bg = accent === 'teal' ? COLORS.logicTeal : accent === 'coral' ? COLORS.impactRed : COLORS.actionYellow;
  const fg = accent === 'gold' ? INK : COLORS.canvasWhite;

  return (
    <Animated.View style={[st.seal, { backgroundColor: bg }, anim]} testID="results-rank-seal">
      <Text style={[st.sealText, { color: fg }]} numberOfLines={1}>
        {label}
      </Text>
    </Animated.View>
  );
};

/** A goal's ✓ (or ✗) badge lands at `at` ms: in from 0.6 on a lively spring, its fade quick and flat. */
export const TickAt: React.FC<{ at: number; reduced: boolean; style?: StyleProp<ViewStyle>; children: React.ReactNode }> = ({ at, reduced, style, children }) => {
  const s = useSharedValue(reduced ? 1 : 0.6);
  const o = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    s.value = withDelay(at, withSpring(1, SPRING.lively));
    o.value = withDelay(at, withTiming(1, { duration: MS.feedback, easing: EASE.ui, ...STAYS }), STAYS.reduceMotion);
  }, [at, reduced, s, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: s.value }] }));
  return <Animated.View style={[a, style]}>{children}</Animated.View>;
};

/**
 * The coin pill, counting. Its own component so only the pill re-renders on
 * each tick. Counts `ticks` steps, COIN_TICK_MS apart, from the moment
 * `running` turns true: step 1 shows on the cue's first tick, the total on its
 * last, and the pill bumps on the bell. Reduced motion: the total at once.
 */
export const CountingCoinPill: React.FC<{ total: number; running: boolean; ticks: number; reduced: boolean; onBell?: () => void }> = ({ total, running, ticks, reduced, onBell }) => {
  const [step, setStep] = useState(reduced ? ticks : 0);
  const bump = useSharedValue(1);
  useEffect(() => {
    if (reduced) {
      setStep(ticks);
      return;
    }
    if (!running) return;
    const ts: ReturnType<typeof setTimeout>[] = [];
    for (let i = 1; i <= ticks; i++) ts.push(setTimeout(() => setStep(i), (i - 1) * COIN_TICK_MS));
    ts.push(
      setTimeout(() => {
        bump.value = withSequence(withTiming(SCALE.pop, { duration: 64, easing: EASE.ui }), withSpring(1, SPRING.lively));
        onBell?.();
      }, ticks * COIN_TICK_MS)
    );
    return () => ts.forEach(clearTimeout);
  }, [running, ticks, reduced, bump]); // eslint-disable-line react-hooks/exhaustive-deps
  const t = ticks > 0 ? step / ticks : 1;
  // Eases out: the first coins rush in, the last few land one by one
  const shown = step >= ticks ? total : Math.round(total * (1 - Math.pow(1 - t, 2.2)));
  // Not shown before it counts: a pill reading 0 would say the fight paid nothing
  const o = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (running && !reduced) o.value = withTiming(1, { duration: MS.feedback, easing: EASE.ui });
  }, [running, reduced, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: bump.value }] }));
  return (
    <Animated.View style={a} testID="results-coin-total">
      {/* Wide enough for the total from the first tick, so the pill never grows while it counts */}
      <CoinPill coins={shown} style={{ minWidth: 44 + 10 * total.toLocaleString().length, justifyContent: 'center' }} />
    </Animated.View>
  );
};

/**
 * A row of the results that hides a reward until its unlock reveal has played. When `shown` turns true it
 * turns over the way the reveal's medallion did (edge-on on EASE.impact, the face swapped there, back on
 * SPRING.lively): the reward the player just saw arrives in its row as the same thing, not as a swap.
 * Reduced motion: it fades through to the new face. `face(shown)` draws each side.
 */
export const TurnOver: React.FC<{ shown: boolean; delay: number; reduced: boolean; style?: StyleProp<ViewStyle>; testID?: string; face: (shown: boolean) => React.ReactNode }> = ({ shown, delay, reduced, style, testID, face }) => {
  const [side, setSide] = useState(shown);
  const turn = useSharedValue(1);
  const o = useSharedValue(1);
  useEffect(() => {
    if (shown === side) return;
    const keep = STAYS.reduceMotion;
    if (reduced) {
      o.value = withDelay(
        delay,
        withSequence(
          keep,
          withTiming(0, { duration: MS.feedback, easing: EASE.ui, ...STAYS }, f => {
            if (f) runOnJS(setSide)(shown);
          }),
          withTiming(1, { duration: MS.quick, easing: EASE.ui, ...STAYS })
        ),
        keep
      );
      return;
    }
    turn.value = withDelay(
      delay,
      withSequence(
        withTiming(0, { duration: ROW_TURN_MS, easing: EASE.impact }, f => {
          if (f) runOnJS(setSide)(shown);
        }),
        withDelay(16, withSpring(1, SPRING.lively))
      )
    );
  }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scaleX: turn.value }] }));
  return <Animated.View testID={testID} style={[style, a]}>{face(side)}</Animated.View>;
};

const st = StyleSheet.create({
  starsStage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 10,
    paddingBottom: 2,
    overflow: 'visible',
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 10,
    overflow: 'visible',
  },
  starSlot: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  centerStarLift: {
    marginBottom: 8,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderColor: COLORS.actionYellow,
  },
  impactRay: {
    position: 'absolute',
    width: 4,
    height: 12,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#1A1715',
  },
  fleckOrigin: {
    position: 'absolute',
    top: '45%',
    left: '50%',
    width: 0,
    height: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fleck: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#1A1715',
  },
  sunburstWrap: {
    position: 'absolute',
    top: -12,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seal: {
    borderWidth: 2,
    borderBottomWidth: 3.5,
    borderColor: INK,
    borderRadius: 6,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  sealText: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
});
