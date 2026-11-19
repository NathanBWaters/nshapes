/**
 * How a card moves in its slot: it is dealt in, it lifts when picked, and it
 * keeps hopping while it is being pointed out ("tap me"). Only transforms and
 * opacity move; the hop stops when the app is in the background, and reduced
 * motion switches all of it off but a short fade-in of a new card.
 *
 * It never draws a border or an outline: those belong to selection (Card.tsx).
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useAppActive } from '@/hooks/useAppActive';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { EASE, MS, SPRING } from '@/utils/motion';

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
} as const;

interface Props {
  selected: boolean;
  /** The card is being pointed out (a hint, a guided step, a rescue) */
  pointedOut: boolean;
  /** When this card starts to be dealt, after it arrives (ms): GameBoard sweeps the cards dealt together from the top left */
  dealDelayMs: number;
  children: React.ReactNode;
}

const CardMotion: React.FC<Props> = ({ selected, pointedOut, dealDelayMs, children }) => {
  const reduced = useReducedMotion();
  const appActive = useAppActive();
  const dealShown = useSharedValue(0);
  const dealScale = useSharedValue(reduced ? 1 : CARD_MOTION.dealFromScale);
  const lift = useSharedValue(1);
  const hop = useSharedValue(0);
  const mounted = useRef(false);

  // Dealt in once, when the card arrives in the slot
  // (reduced motion: no growth and no sweep, a short fade so the new card still reads as new)
  useEffect(() => {
    if (reduced) {
      // (Reanimated skips animations under reduced motion unless told this one is meant)
      dealShown.value = withTiming(1, { duration: CARD_MOTION.dealFadeMs / 2, easing: EASE.ui, reduceMotion: ReduceMotion.Never });
      return;
    }
    dealShown.value = withDelay(dealDelayMs, withTiming(1, { duration: CARD_MOTION.dealFadeMs, easing: EASE.ui }));
    dealScale.value = withDelay(dealDelayMs, withTiming(1, { duration: CARD_MOTION.dealMs, easing: EASE.pop }));
    // once, on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Picked: a quick pop, then it stays lifted
  useEffect(() => {
    if (reduced) return;
    if (!mounted.current) return;
    lift.value = selected
      ? withSequence(withTiming(CARD_MOTION.pickedPopScale, { duration: CARD_MOTION.pickedPopMs, easing: EASE.ui }), withSpring(CARD_MOTION.pickedScale, SPRING.lively))
      : withTiming(1, { duration: MS.feedback, easing: EASE.ui });
  }, [selected, reduced, lift]);

  // Pointed out: it hops, rests, and hops again for as long as it is, so the eye keeps finding it.
  // A picked card stands still (it has been found).
  const hopping = pointedOut && !selected && !reduced && appActive;
  useEffect(() => {
    if (!hopping) {
      cancelAnimation(hop);
      hop.value = withTiming(0, { duration: 90 });
      return;
    }
    hop.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 150, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 200, easing: Easing.in(Easing.quad) }),
        withTiming(0.5, { duration: 120, easing: Easing.out(Easing.quad) }),
        withTiming(0, { duration: 160, easing: Easing.in(Easing.quad) }),
        withDelay(CARD_MOTION.hopRestMs, withTiming(0, { duration: 1 }))
      ),
      -1
    );
    return () => cancelAnimation(hop);
  }, [hopping, hop]);

  useEffect(() => {
    mounted.current = true;
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: dealShown.value,
    transform: [{ translateY: -7 * hop.value }, { scale: dealScale.value * lift.value }],
  }));

  return <Animated.View style={[st.fill, style]}>{children}</Animated.View>;
};

/**
 * A card that has just been scored and is about to be replaced. The effects
 * stage draws its own copy of it flying off, a frame or two later: this one
 * waits for that copy to cover it, then is gone, so the slot never blinks.
 */
export const CardLeaving: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const shown = useSharedValue(1);
  useEffect(() => {
    shown.value = withDelay(CARD_MOTION.leaveAfterMs, withTiming(0, { duration: 1 }));
    // once, on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: shown.value }));
  return <Animated.View pointerEvents="none" style={[st.fill, style]}>{children}</Animated.View>;
};

const st = StyleSheet.create({
  fill: { flex: 1 },
});

export default CardMotion;
