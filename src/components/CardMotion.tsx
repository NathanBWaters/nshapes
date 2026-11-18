/**
 * How a card moves in its slot: it is dealt in, it lifts when picked, and it
 * keeps hopping while it is being pointed out ("tap me"). Only transforms and
 * opacity move; the hop stops when the app is in the background, and reduced
 * motion switches all of it off.
 *
 * It never draws a border or an outline: those belong to selection (Card.tsx).
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useAppActive } from '@/hooks/useAppActive';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export const CARD_MOTION = {
  /** A freshly dealt card grows in over this long */
  dealMs: 190,
  /** Cards dealt together arrive one after another, left to right */
  dealStaggerMs: 45,
  /** How far a picked card lifts */
  pickedScale: 1.045,
  /** A scored card stays in its slot this long, until the stage's flying copy covers it */
  leaveAfterMs: 110,
  /** A pointed-out card hops, rests this long, and hops again */
  hopRestMs: 1500,
} as const;

interface Props {
  selected: boolean;
  /** The card is being pointed out (a hint, a guided step, a rescue) */
  pointedOut: boolean;
  /** Column of the slot: sets the deal-in stagger */
  column: number;
  children: React.ReactNode;
}

const CardMotion: React.FC<Props> = ({ selected, pointedOut, column, children }) => {
  const reduced = useReducedMotion();
  const appActive = useAppActive();
  const deal = useSharedValue(reduced ? 1 : 0);
  const lift = useSharedValue(1);
  const hop = useSharedValue(0);
  const mounted = useRef(false);

  // Dealt in once, when the card arrives in the slot
  useEffect(() => {
    if (reduced) return;
    deal.value = withDelay(column * CARD_MOTION.dealStaggerMs, withTiming(1, { duration: CARD_MOTION.dealMs, easing: Easing.out(Easing.back(1.6)) }));
    // once, on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Picked: a quick pop, then it stays lifted
  useEffect(() => {
    if (reduced) return;
    if (!mounted.current) return;
    lift.value = selected
      ? withSequence(withTiming(1.1, { duration: 70, easing: Easing.out(Easing.quad) }), withSpring(CARD_MOTION.pickedScale, { damping: 11, stiffness: 300, mass: 0.6 }))
      : withTiming(1, { duration: 110, easing: Easing.out(Easing.quad) });
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
    opacity: Math.min(1, deal.value * 1.6),
    transform: [{ translateY: -7 * hop.value }, { scale: (0.72 + 0.28 * deal.value) * lift.value }],
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
