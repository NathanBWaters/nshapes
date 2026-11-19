/**
 * The results screen's choreography (motion review: docs/motion/reviews/results-payout.md).
 *
 * The card and everything the player reads arrive together, at once. Then the
 * stars are the hero: each one falls into its slot (`starPopDelayMs`), hits it
 * on `starLandMs` (its `star` cue and its goal's ✓ land on that frame), squashes
 * and settles. After the last star, the coin total counts up tick for tick with
 * the `coinRoll` cue and the pill bumps on its closing bell.
 *
 * Only transform and opacity move; nothing loops. With reduced motion every
 * piece renders finished and the coin total is shown at once.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, withDelay, withSpring, runOnJS, ReduceMotion } from 'react-native-reanimated';
import { EASE, exitMs, MS, SCALE, SPRING, SQUASH, STAGGER, staggerDelay } from '@/utils/motion';
import { CoinPill, INK, STAR_FALL_MS, starLandMs, starPopDelayMs, TONE } from './ui';

/** The band's coinRoll cue rings this many ticks, 45 ms apart, then a bell (src/audio/band.ts). */
export const COIN_TICK_MS = 45;
export const coinRollTicks = (amount: number): number => Math.max(3, Math.min(24, amount));
/** The coinRoll cue's size for a payout: a bigger payout rolls longer, 16 ticks (0.7 s) at most */
export const coinRollAmount = (coins: number): number => Math.min(16, 4 + Math.round(coins / 25));
/** A breath between the last star's hit and the coins starting to count */
export const COIN_BREATH_MS = 320;
/** When the coin count starts on a result with `stars` stars (no reveal in between) */
export const coinStartMs = (stars: number): number => (stars > 0 ? starLandMs(stars - 1) : 0) + COIN_BREATH_MS;
/** When the goal rows that did not earn a star show their ✗: after the last hit */
export const missesShownMs = (stars: number): number => (stars > 0 ? starLandMs(stars - 1) + 160 : 160);
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
/** The earned star's own gold (ui.tsx StarRow) */
const STAR_GOLD = '#F5B800';

/** The results card rises into place: one panel arrival, everything inside it already there. */
export const ResultsCard: React.FC<{ reduced: boolean; style?: StyleProp<ViewStyle>; children: React.ReactNode }> = ({ reduced, style, children }) => {
  const y = useSharedValue(reduced ? 0 : 24);
  const o = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    y.value = withTiming(0, { duration: MS.panel, easing: EASE.enterSoft });
    o.value = withTiming(1, { duration: MS.feedback, easing: EASE.ui });
  }, [reduced, y, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: y.value }] }));
  return <Animated.View style={[a, style]}>{children}</Animated.View>;
};

/** Fades in at `at` ms, in place (a caption that belongs to something that just landed). */
export const FadeAt: React.FC<{ at: number; reduced: boolean; children: React.ReactNode }> = ({ at, reduced, children }) => {
  const o = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) o.value = withDelay(at, withTiming(1, { duration: MS.quick, easing: EASE.ui }));
  }, [at, reduced, o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={a}>{children}</Animated.View>;
};

/**
 * One big star. It falls from SCALE.slam into its slot on EASE.impact (it speeds
 * up into the hit), squashes on the frame it lands, and springs back to rest.
 * One ring goes out from the slot on the hit: the only decoration, and it has a cause.
 * The gold glyph is drawn at its biggest size and scaled down (text never scales up).
 */
const BigStar: React.FC<{ filled: boolean; size: number; delay: number; big: boolean; reduced: boolean }> = ({ filled, size, delay, big, reduced }) => {
  const animate = filled && delay >= 0 && !reduced;
  const s = useSharedValue(animate ? SCALE.slam : 1);
  const sx = useSharedValue(1);
  const sy = useSharedValue(1);
  const o = useSharedValue(animate ? 0 : 1);
  const ring = useSharedValue(animate ? 0 : 1);
  useEffect(() => {
    if (!animate) return;
    const land = delay + STAR_FALL_MS;
    o.value = withDelay(delay, withTiming(1, { duration: MS.feedback, easing: EASE.ui }));
    s.value = withDelay(delay, withTiming(1, { duration: STAR_FALL_MS, easing: EASE.impact }));
    // The hit: squashed wide and short on the landing frame, held 2 frames, then back on a lively spring
    sx.value = withDelay(land, withSequence(withTiming(SQUASH.squash.x, { duration: 16, easing: EASE.ui }), withDelay(SQUASH_HOLD_MS, withSpring(1, SPRING.lively))));
    sy.value = withDelay(land, withSequence(withTiming(SQUASH.squash.y, { duration: 16, easing: EASE.ui }), withDelay(SQUASH_HOLD_MS, withSpring(1, SPRING.lively))));
    ring.value = withDelay(land, withTiming(1, { duration: MS.move, easing: EASE.enter }));
  }, [animate, delay, s, sx, sy, o, ring]);

  const k = 1 / SCALE.slam;
  const starStyle = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ scaleX: s.value * sx.value * k }, { scaleY: s.value * sy.value * k }],
  }));
  const reach = big ? 1.9 : 1.6;
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ring.value <= 0 || ring.value >= 1 ? 0 : 0.9 * (1 - ring.value),
    transform: [{ scale: 0.7 + ring.value * (reach - 0.7) }],
  }));

  const w = size * 1.05;
  const h = size * 1.1;
  const glyph = { fontSize: size, lineHeight: h, width: w, textAlign: 'center' as const };
  const W = w * SCALE.slam;
  const H = h * SCALE.slam;
  const bigGlyph = { fontSize: size * SCALE.slam, lineHeight: H, width: W, textAlign: 'center' as const };
  const ringD = size * 0.95;
  return (
    <View style={{ width: w, height: h }}>
      <Text style={[glyph, StyleSheet.absoluteFillObject, { color: TONE.emptyPip }]}>★</Text>
      {animate && (
        <Animated.View
          pointerEvents="none"
          style={[st.ring, { width: ringD, height: ringD, left: (w - ringD) / 2, top: (h - ringD) / 2, borderRadius: ringD / 2, borderWidth: Math.max(2, size * 0.06) }, ringStyle]}
        />
      )}
      {filled && (
        <Animated.Text
          style={[bigGlyph, { position: 'absolute', left: (w - W) / 2, top: (h - H) / 2, color: STAR_GOLD, textShadowColor: INK, textShadowRadius: 2 * SCALE.slam }, starStyle]}
        >
          ★
        </Animated.Text>
      )}
    </View>
  );
};

/** The results' star row: earned stars fall in one after another (ui.tsx starPopDelayMs). */
export const ResultStars: React.FC<{ stars: number; size: number; reduced: boolean; max?: number }> = ({ stars, size, reduced, max = 3 }) => (
  <View style={{ flexDirection: 'row', gap: size * 0.12 }} testID="results-stars">
    {Array.from({ length: max }).map((_, i) => (
      <BigStar key={i} filled={i < stars} size={size} delay={i < stars ? starPopDelayMs(i) : -1} big={stars >= max && i === max - 1} reduced={reduced} />
    ))}
  </View>
);

/** A goal's ✓ (or ✗) badge lands at `at` ms: in from 0.6 on a lively spring, its fade quick and flat. */
export const TickAt: React.FC<{ at: number; reduced: boolean; style?: StyleProp<ViewStyle>; children: React.ReactNode }> = ({ at, reduced, style, children }) => {
  const s = useSharedValue(reduced ? 1 : 0.6);
  const o = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    s.value = withDelay(at, withSpring(1, SPRING.lively));
    o.value = withDelay(at, withTiming(1, { duration: MS.feedback, easing: EASE.ui }));
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
    const keep = ReduceMotion.Never;
    if (reduced) {
      o.value = withDelay(delay, withSequence(keep, withTiming(0, { duration: MS.feedback, easing: EASE.ui, reduceMotion: keep }, f => { if (f) runOnJS(setSide)(shown); }), withTiming(1, { duration: MS.quick, easing: EASE.ui, reduceMotion: keep })), keep);
      return;
    }
    turn.value = withDelay(delay, withSequence(
      withTiming(0, { duration: ROW_TURN_MS, easing: EASE.impact }, f => { if (f) runOnJS(setSide)(shown); }),
      withDelay(16, withSpring(1, SPRING.lively))
    ));
  }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scaleX: turn.value }] }));
  return <Animated.View testID={testID} style={[style, a]}>{face(side)}</Animated.View>;
};

const st = StyleSheet.create({
  ring: { position: 'absolute', borderColor: TONE.coinBright },
});
