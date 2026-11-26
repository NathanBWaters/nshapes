/**
 * The one screen change of the game (docs/motion/reviews/screen-change.md).
 *
 * A screen change is seen hundreds of times, so it is short and says one
 * thing: which way you went. The old screen steps 26 px away (ease-in) as it
 * fades (exitMs(MS.screen)), then the new one comes 40 px from the other
 * side and settles (MS.screen, ease-out). "Deeper" (map → fight, map → Camp,
 * fight → results) comes in from the right; "back" (Camp → map, results →
 * map) comes in from the left. The old screen is unmounted before the new
 * one mounts, so nothing of the old one keeps running behind the new one,
 * and the new screen takes taps the moment it is there. Taps on the leaving
 * screen are ignored, so a double tap cannot start two changes; a change asked
 * for while another is still leaving simply goes to the latest screen.
 *
 * Reduced motion: no travel, a short fade each way.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ViewStyle, StyleProp } from 'react-native';
import Animated, {
  ReduceMotion,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { EASE, MS, exitMs } from '@/utils/motion';

/** Which way a change goes: 1 deeper (the new screen comes from the right), -1 back */
export type ScreenDirection = 1 | -1;

/**
 * How far the new screen travels in, and the old one away (two thirds of it).
 * 10% of a phone's width: less is not read as a direction at all.
 */
const ENTER_SHIFT = 40;
const EXIT_SHIFT = 26;
/** The fades play under reduced motion too (Reanimated would cut them): only the travel goes */
const KEEP = { reduceMotion: ReduceMotion.Never } as const;

/**
 * Jest renders screen changes at once, so the many tests that tap and then
 * look for the next screen keep working. `__tests__/screenTransition.test.tsx`
 * plays the real path with `instant: false`.
 */
export const SCREEN_INSTANT = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

export interface ScreenTransitionControl {
  /** Play the old screen out, then run `apply` (the state change that swaps the screen) and play the new one in */
  go: (apply: () => void, direction: ScreenDirection) => void;
  /** Style for the view that holds the current screen */
  style: StyleProp<ViewStyle>;
  /** True while the old screen is leaving: it takes no taps */
  leaving: boolean;
}

/**
 * The screen change as a hook, for a component that switches its own screens
 * (AdventureMode). The first screen enters on mount, deeper.
 */
export function useScreenTransition({ instant = SCREEN_INSTANT, enterOnMount = true }: { instant?: boolean; enterOnMount?: boolean } = {}): ScreenTransitionControl {
  const reduced = useReducedMotion();
  const animateMount = enterOnMount && !instant;
  const x = useSharedValue(animateMount && !reduced ? ENTER_SHIFT : 0);
  const o = useSharedValue(animateMount ? 0 : 1);
  const [leaving, setLeaving] = useState(false);
  const pending = useRef<{ apply: () => void; direction: ScreenDirection } | null>(null);
  const exiting = useRef(false);
  const alive = useRef(true);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearSafetyTimer = useCallback(() => {
    if (safetyTimerRef.current !== null) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);
  useEffect(() => () => {
    alive.current = false;
    clearSafetyTimer();
  }, [clearSafetyTimer]);

  const enter = useCallback((direction: ScreenDirection) => {
    x.value = reduced ? 0 : direction * ENTER_SHIFT;
    o.value = 0;
    if (!reduced) x.value = withTiming(0, { duration: MS.screen, easing: EASE.enter });
    o.value = withTiming(1, { duration: MS.feedback, easing: EASE.ui, ...KEEP });
  }, [reduced, x, o]);

  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    if (animateMount) enter(1);
  }, [animateMount, enter]);

  /** Which exit is running: the fade's end and the safety timer both call swap, only the first counts */
  const exitId = useRef(0);
  const swap = useCallback((id: number) => {
    if (id !== exitId.current || !exiting.current) return;
    clearSafetyTimer();
    exiting.current = false;
    const next = pending.current;
    pending.current = null;
    if (!alive.current || !next) return;
    next.apply();
    setLeaving(false);
    enter(next.direction);
  }, [enter, clearSafetyTimer]);

  const go = useCallback((apply: () => void, direction: ScreenDirection) => {
    if (instant) {
      clearSafetyTimer();
      apply();
      return;
    }
    // The latest wish wins; an exit already on its way carries it
    pending.current = { apply, direction };
    if (exiting.current) return;
    exiting.current = true;
    const id = ++exitId.current;
    setLeaving(true);
    const out = exitMs(reduced ? MS.feedback : MS.screen);
    // From wherever the values are now (a change can start while the last one is still arriving)
    if (!reduced) x.value = withTiming(-direction * EXIT_SHIFT, { duration: out, easing: EASE.exitSoft });
    // The fade is even (not a move, so not eased): it answers the tap on the first frame and
    // reaches paper just as the old screen is unmounted, with no blank frames between
    o.value = withTiming(0, { duration: out, easing: EASE.linear, ...KEEP }, finished => {
      if (finished) runOnJS(swap)(id);
    });
    // If the fade never reports its end (the app went to the background), the change still happens
    clearSafetyTimer();
    safetyTimerRef.current = setTimeout(() => swap(id), out + MS.feedback);
  }, [instant, reduced, x, o, swap, clearSafetyTimer]);

  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateX: x.value }] }));
  return { go, style, leaving };
}

interface ScreenTransitionProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Wrapper for a screen that is simply mounted in place of another (the
 * classic screens): it arrives the way every screen arrives, deeper.
 */
export function ScreenTransition({ children, style }: ScreenTransitionProps) {
  const t = useScreenTransition();
  return <Animated.View style={[{ flex: 1 }, t.style, style]}>{children}</Animated.View>;
}
