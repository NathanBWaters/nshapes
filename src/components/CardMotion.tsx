/**
 * How a card moves in its slot: it is dealt in, it lifts when picked, it
 * keeps hopping while it is being pointed out ("tap me"), and when a Grace
 * forgives a 1-trait near-miss ([FX-22]) an emerald shimmer + centered
 * ink-outlined clover badge pops directly on the forgiven card.
 *
 * Only transforms and opacity move; the hop stops when the app is in the
 * background, and reduced motion or Effects off switches movement off while
 * preserving color washes and short fades.
 *
 * It never draws a border or an outline on the card: those belong to selection (Card.tsx).
 *
 * Lane 3 polish:
 * - Hint-hop adds a 32 ms anticipation crouch (`scaleY: 0.94` with volume-preserving
 *   `scaleX ≈ 1.047` via `volumeScale`), `EASE.enter` ascent, faster `EASE.impact`
 *   descent, and phase-offset staggering from `dealDelayMs` so hinted cards never twin.
 * - Wrong-pick shake derives deterministically from `geometricShakeKeyframes` (×0.7 decay)
 *   and decouples exit scale deceleration (`EASE.ui`) from opacity (`EASE.exitSoft`) to
 *   prevent hard-stop clipping on the final frame.
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Icon from '@/components/Icon';
import { useAppActive } from '@/hooks/useAppActive';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  EASE,
  MS,
  SHAKE,
  SPRING,
  SQUASH_TIER,
  STAYS,
  exitMs,
  geometricShakeKeyframes,
  volumeScale,
} from '@/utils/motion';
import { RADIUS } from '@/utils/colors';

const MISS_SHAKE_PX = geometricShakeKeyframes(12, 3, SHAKE.decay, -1);

export const CARD_MOTION = {
  /** A freshly dealt card grows from this size... */
  dealFromScale: 0.72,
  /** ...to full size over this long on `EASE.pop` (a small overshoot that is over when the time is: a spring's tail made every deal twice as long) */
  dealMs: 190,
  /** ...and is fully opaque after this long (opacity never bounces) */
  dealFadeMs: MS.feedback,
  /** Cards dealt together sweep in from the top left, one diagonal every STAGGER.card, the whole sweep at most this long */
  dealSweepMs: 120,
  /** How far a picked card lifts */
  pickedScale: 1.045,
  /** A picked card pops up to this first (on the tap's own frame), then settles to `pickedScale` */
  pickedPopScale: 1.1,
  /** How long the pick pop takes to reach its peak: 5 frames */
  pickedPopMs: 80,
  /**
   * The third card of a Set is checked when its pop peaks: the player sees all
   * three cards up together for a beat, then the Set goes. Was 200 ms of nothing.
   */
  confirmMs: 80,
  /** A scored card stays in its slot this long, until the stage's flying copy covers it */
  leaveAfterMs: 110,
  /** A pointed-out card hops, rests this long, and hops again */
  hopRestMs: 1500,
  /** Anticipation crouch before each hint hop (2 frames) */
  hopCrouchMs: 32,
  /** A wrong pick: deterministic geometric-decay sideways shake (×0.7 decay, px then ms per leg) */
  missShakePx: MISS_SHAKE_PX,
  missShakeMs: [40, 56, 56, 68],
  /** ...is washed red (never a border: borders are for selection) */
  missWashOpacity: 0.3,
  missWashColor: '#EF4444',
  /** ...and steps out before the board replaces it (Adventure replaces a wrong pick 380 ms after it) */
  missLeaveAtMs: 240,
  missLeaveScale: 0.88,
  /** If nothing replaced it (a tutorial board keeps its cards), it comes back after this long */
  missReturnAtMs: 700,
  /** GameBoard keeps a card marked as missed this long (past its return) */
  missHoldMs: 900,
  /** [FX-22] Emerald clover shimmer on the forgiven 3rd card during a Grace save */
  graceWashColor: '#16A34A',
  graceWashOpacity: 0.28,
  graceFadeMs: MS.feedback,
  graceHoldMs: 260,
  graceBadgeHoldMs: 180,
} as const;

/**
 * [FX-22] Crisp emerald shimmer wash + centered ink-outlined `lorc/clover` badge
 * rendered directly over the forgiven 3rd card during a Grace save (zero card border).
 */
export const GraceSaveOverlay: React.FC<{ effects?: boolean }> = ({ effects = true }) => {
  const reduced = useReducedMotion();
  const allowMotion = effects && !reduced;
  const washOp = useSharedValue(0);
  const badgeOp = useSharedValue(0);
  const badgeScale = useSharedValue(allowMotion ? 1.35 : 1);

  useEffect(() => {
    washOp.value = withSequence(
      withTiming(CARD_MOTION.graceWashOpacity, { duration: CARD_MOTION.graceFadeMs, easing: EASE.ui, ...STAYS }),
      withDelay(
        CARD_MOTION.graceBadgeHoldMs - CARD_MOTION.graceFadeMs,
        withTiming(0, { duration: exitMs(CARD_MOTION.graceFadeMs), easing: EASE.exitSoft, ...STAYS }),
        STAYS.reduceMotion
      )
    );
    badgeOp.value = withSequence(
      withTiming(1, { duration: 48, easing: EASE.ui, ...STAYS }),
      withDelay(
        CARD_MOTION.graceBadgeHoldMs,
        withTiming(0, { duration: exitMs(CARD_MOTION.graceFadeMs), easing: EASE.exitSoft, ...STAYS }),
        STAYS.reduceMotion
      )
    );
    if (allowMotion) {
      badgeScale.value = 1.35;
      badgeScale.value = withTiming(1, { duration: CARD_MOTION.graceFadeMs, easing: EASE.pop });
    } else {
      badgeScale.value = 1;
    }
    return () => {
      cancelAnimation(washOp);
      cancelAnimation(badgeOp);
      cancelAnimation(badgeScale);
    };
  }, [allowMotion, washOp, badgeOp, badgeScale]);

  const washStyle = useAnimatedStyle(() => ({ opacity: washOp.value }));
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeOp.value,
    transform: [{ scale: badgeScale.value }],
  }));

  return (
    <View testID="card-grace-clover" pointerEvents="none" style={st.graceWrap}>
      <Animated.View style={[st.graceWash, washStyle]} />
      <Animated.View style={[st.graceDisc, badgeStyle]}>
        <Icon name="lorc/clover" size={22} color="#16A34A" noShadow />
      </Animated.View>
    </View>
  );
};

interface Props {
  selected: boolean;
  /** The card is being pointed out (a hint, a guided step, a rescue) */
  pointedOut: boolean;
  /** When this card starts to be dealt, after it arrives (ms): GameBoard sweeps the cards dealt together from the top left */
  dealDelayMs: number;
  /** This card was one of three that are not a Set: it shakes, washes red and steps out */
  missed?: boolean;
  /** [FX-22] This card was forgiven by a Grace save: pop emerald clover shimmer directly on it */
  graceSaved?: boolean;
  /** Adventure's Effects switch: off keeps the colour and the fades, drops the shake and the scale */
  effects?: boolean;
  children: React.ReactNode;
}

const CardMotion: React.FC<Props> = ({
  selected,
  pointedOut,
  dealDelayMs,
  missed = false,
  graceSaved = false,
  effects = true,
  children,
}) => {
  const reduced = useReducedMotion();
  const appActive = useAppActive();
  const moves = effects && !reduced;
  const dealShown = useSharedValue(0);
  const dealScale = useSharedValue(moves ? CARD_MOTION.dealFromScale : 1);
  const lift = useSharedValue(1);
  const hop = useSharedValue(0);
  const hopSquashY = useSharedValue(1);
  const missX = useSharedValue(0);
  const missWash = useSharedValue(0);
  const missLeaveOp = useSharedValue(0);
  const missLeaveScale = useSharedValue(0);
  const mounted = useRef(false);

  // Dealt in once, when the card arrives in the slot
  // (reduced motion or effects off: no growth and no sweep, a short fade so the new card still reads as new)
  useEffect(() => {
    if (!moves) {
      dealScale.value = 1;
      dealShown.value = withTiming(1, {
        duration: CARD_MOTION.dealFadeMs / 2,
        easing: EASE.ui,
        ...STAYS,
      });
    } else {
      dealShown.value = withDelay(dealDelayMs, withTiming(1, { duration: CARD_MOTION.dealFadeMs, easing: EASE.ui }));
      dealScale.value = withDelay(dealDelayMs, withTiming(1, { duration: CARD_MOTION.dealMs, easing: EASE.pop }));
    }
    return () => {
      cancelAnimation(dealShown);
      cancelAnimation(dealScale);
    };
    // once, on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Picked: a quick pop, then it stays lifted (dropped under reduced motion or Effects off)
  useEffect(() => {
    if (!moves) {
      cancelAnimation(lift);
      lift.value = 1;
      return;
    }
    if (!mounted.current) return;
    lift.value = selected
      ? withSequence(
          withTiming(CARD_MOTION.pickedPopScale, { duration: CARD_MOTION.pickedPopMs, easing: EASE.ui }),
          withSpring(CARD_MOTION.pickedScale, SPRING.lively)
        )
      : withTiming(1, { duration: MS.feedback, easing: EASE.ui });
    return () => cancelAnimation(lift);
  }, [selected, moves, lift]);

  // Pointed out: 32ms anticipation crouch -> lively hop -> fast-fall landing -> mini bounce -> rest.
  // Phase-offset from `dealDelayMs` so multiple hinted cards ripple organically instead of twinning.
  const hopping = pointedOut && !selected && moves && appActive;
  const hopPhaseOffsetMs = Math.min(180, Math.round(dealDelayMs * 0.9));
  useEffect(() => {
    if (!hopping) {
      cancelAnimation(hop);
      cancelAnimation(hopSquashY);
      hop.value = withTiming(0, { duration: 90, easing: EASE.ui });
      hopSquashY.value = withTiming(1, { duration: 90, easing: EASE.ui });
      return;
    }
    const crouchMs = CARD_MOTION.hopCrouchMs;
    const hopCycle = withSequence(
      withTiming(0, { duration: crouchMs, easing: EASE.ui }),
      withTiming(1, { duration: 136, easing: EASE.enter }),
      withTiming(0, { duration: 118, easing: EASE.impact }),
      withTiming(0, { duration: crouchMs, easing: EASE.ui }),
      withTiming(0.48, { duration: 96, easing: EASE.enter }),
      withTiming(0, { duration: 88, easing: EASE.impact }),
      withDelay(CARD_MOTION.hopRestMs, withTiming(0, { duration: 1, easing: EASE.linear }))
    );
    const squashCycle = withSequence(
      // 32ms anticipation crouch: scaleY 0.94 -> volume-preserving scaleX ≈ 1.047
      withTiming(0.94, { duration: crouchMs, easing: EASE.ui }),
      // Stretch slightly on takeoff & relax at apex
      withTiming(1.04, { duration: 64, easing: EASE.enter }),
      withTiming(1, { duration: 72, easing: EASE.ui }),
      // Fall to ground & absorb impact
      withTiming(1.02, { duration: 118, easing: EASE.impact }),
      withTiming(0.95, { duration: crouchMs, easing: EASE.ui }),
      // Mini follow-up bounce & crisp settle
      withTiming(1.025, { duration: 96, easing: EASE.enter }),
      withTiming(0.98, { duration: 88, easing: EASE.impact }),
      withTiming(1, { duration: 80, easing: EASE.ui }),
      withDelay(Math.max(1, CARD_MOTION.hopRestMs - 80), withTiming(1, { duration: 1, easing: EASE.linear }))
    );

    hop.value = withDelay(hopPhaseOffsetMs, withRepeat(hopCycle, -1));
    hopSquashY.value = withDelay(hopPhaseOffsetMs, withRepeat(squashCycle, -1));
    return () => {
      cancelAnimation(hop);
      cancelAnimation(hopSquashY);
    };
  }, [hopping, hopPhaseOffsetMs, hop, hopSquashY]);

  // A wrong pick, shown on the three cards themselves: the wash and the step out are colour and
  // opacity (kept with reduced motion or Effects off); the shake and the shrink are movement (dropped).
  useEffect(() => {
    if (!missed) return;
    // (colour and opacity are kept under reduced motion: Reanimated would skip them, delays included, unless told)
    const keep = { reduceMotion: ReduceMotion.Never } as const;
    missWash.value = withSequence(
      withTiming(CARD_MOTION.missWashOpacity, { duration: MS.feedback, easing: EASE.ui, ...keep }),
      withDelay(
        CARD_MOTION.missReturnAtMs - MS.feedback,
        withTiming(0, { duration: MS.feedback, easing: EASE.ui, ...keep }),
        ReduceMotion.Never
      )
    );
    const leaveMs = exitMs(MS.quick);
    missLeaveOp.value = withSequence(
      withDelay(CARD_MOTION.missLeaveAtMs, withTiming(1, { duration: leaveMs, easing: EASE.exitSoft, ...keep }), ReduceMotion.Never),
      withDelay(
        CARD_MOTION.missReturnAtMs - CARD_MOTION.missLeaveAtMs - leaveMs,
        withTiming(0, { duration: MS.feedback, easing: EASE.ui, ...keep }),
        ReduceMotion.Never
      )
    );
    // Ease-out scale deceleration so shrink never clips into a hard stop on its last frame
    missLeaveScale.value = withSequence(
      withDelay(CARD_MOTION.missLeaveAtMs, withTiming(1, { duration: leaveMs, easing: EASE.ui, ...keep }), ReduceMotion.Never),
      withDelay(
        CARD_MOTION.missReturnAtMs - CARD_MOTION.missLeaveAtMs - leaveMs,
        withTiming(0, { duration: MS.feedback, easing: EASE.ui, ...keep }),
        ReduceMotion.Never
      )
    );
    if (moves) {
      const last = CARD_MOTION.missShakePx.length - 1;
      missX.value = withSequence(
        ...CARD_MOTION.missShakePx.map((px, i) =>
          withTiming(px, { duration: CARD_MOTION.missShakeMs[i], easing: i === 0 || i === last ? EASE.ui : EASE.drift })
        )
      );
    }
    return () => {
      cancelAnimation(missX);
      cancelAnimation(missWash);
      cancelAnimation(missLeaveOp);
      cancelAnimation(missLeaveScale);
      missX.value = 0;
      missWash.value = 0;
      missLeaveOp.value = 0;
      missLeaveScale.value = 0;
    };
  }, [missed, moves, missX, missWash, missLeaveOp, missLeaveScale]);

  useEffect(() => {
    mounted.current = true;
  }, []);

  const style = useAnimatedStyle(() => {
    const baseScale = dealScale.value * lift.value * (moves ? 1 - (1 - CARD_MOTION.missLeaveScale) * missLeaveScale.value : 1);
    const vol = volumeScale(hopSquashY.value, SQUASH_TIER.ui.conserve, 0.9, 1.08);
    return {
      opacity: dealShown.value * (1 - missLeaveOp.value),
      transform: [
        { translateX: missX.value },
        { translateY: -8 * hop.value },
        { scaleX: baseScale * vol.scaleX },
        { scaleY: baseScale * vol.scaleY },
      ],
    };
  });
  const washStyle = useAnimatedStyle(() => ({ opacity: missWash.value }));

  return (
    <Animated.View style={[st.fill, style]}>
      {children}
      {missed && <Animated.View pointerEvents="none" style={[st.wash, washStyle]} />}
      {graceSaved && <GraceSaveOverlay effects={effects} />}
    </Animated.View>
  );
};

/**
 * A card that has just been scored and is about to be replaced. The effects
 * stage draws its own copy of it flying off, a frame or two later: this one
 * waits for that copy to cover it, then is gone, so the slot never blinks.
 */
export const CardLeaving: React.FC<{
  graceSaved?: boolean;
  effects?: boolean;
  children: React.ReactNode;
}> = ({ graceSaved = false, effects = true, children }) => {
  const shown = useSharedValue(1);
  useEffect(() => {
    shown.value = withDelay(
      graceSaved ? Math.max(CARD_MOTION.leaveAfterMs, CARD_MOTION.graceBadgeHoldMs) : CARD_MOTION.leaveAfterMs,
      withTiming(0, { duration: 1, ...STAYS }),
      STAYS.reduceMotion
    );
    return () => cancelAnimation(shown);
    // once, on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: shown.value }));
  return (
    <Animated.View pointerEvents="none" style={[st.fill, style]}>
      {children}
      {graceSaved && <GraceSaveOverlay effects={effects} />}
    </Animated.View>
  );
};

const st = StyleSheet.create({
  fill: { flex: 1 },
  wash: { ...StyleSheet.absoluteFillObject, borderRadius: RADIUS.module, backgroundColor: CARD_MOTION.missWashColor },
  graceWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
  },
  graceWash: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.module,
    backgroundColor: CARD_MOTION.graceWashColor,
  },
  graceDisc: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#DCFCE7',
    borderWidth: 2,
    borderColor: '#161412',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CardMotion;
