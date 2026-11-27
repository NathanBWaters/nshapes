/**
 * The one screen change of the game (docs/motion/reviews/screen-change.md),
 * plus shared Disney-12 modal enter/exit presence (`useModalMotion`) so sheets
 * and dialogs animate cleanly both in and out with overlapping content choreography.
 *
 * A screen change is seen hundreds of times, so it is short and says one
 * thing: which way you went. The old screen steps 26 px away (ease-in) as it
 * fades (exitMs(MS.screen)), then the new one comes 40 px from the other
 * side and settles (MS.screen, ease-out). "Deeper" (menu → Adventure, map →
 * fight, map → Camp, fight → results) comes in from the right; "back" (Camp →
 * map, map → menu) comes in from the left.
 *
 * Reduced motion: no travel, a short `STAYS` fade each way.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { EASE, MODAL_MOTION, MS, OVERLAP, STAYS, exitMs, reducedMs } from '@/utils/motion';
export { MotionModal, type MotionModalProps } from './MotionModal';

/** Which way a change goes: 1 deeper (the new screen comes from the right), -1 back */
export type ScreenDirection = 1 | -1;

/**
 * How far the new screen travels in, and the old one away (two thirds of it).
 * 10% of a phone's width: less is not read as a direction at all.
 */
const ENTER_SHIFT = 40;
const EXIT_SHIFT = 26;
/** Subtle vertical lift for in-screen section swaps (e.g. Camp hub ↔ tabs): zero horizontal viewport drift. */
const SECTION_ENTER_Y = 14;
const SECTION_EXIT_Y = 10;

/**
 * Jest renders screen/modal exits at once, so tests that tap and immediately
 * assert the next screen or unmounted modal keep working.
 * `__tests__/screenTransition.test.tsx` exercises the real animated path with `instant: false`.
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
 * The screen change as a hook, for components that switch their own screens
 * (`Game`, `AdventureMode`, `Camp`). The first screen enters on mount when `enterOnMount` is true.
 */
export function useScreenTransition({
  instant = SCREEN_INSTANT,
  enterOnMount = true,
  initialDirection = 1,
  axis = 'x',
  durationMs = MS.screen,
}: {
  instant?: boolean;
  enterOnMount?: boolean;
  initialDirection?: ScreenDirection;
  /** `'x'` for full-screen routes (default); `'y'` for in-screen section swaps (zero horizontal overflow). */
  axis?: 'x' | 'y';
  /** Enter duration token from `MS` (default `MS.screen`); exit automatically uses `exitMs(durationMs)`. */
  durationMs?: number;
} = {}): ScreenTransitionControl {
  const reduced = useReducedMotion();
  const enterShift = axis === 'y' ? SECTION_ENTER_Y : ENTER_SHIFT;
  const exitShift = axis === 'y' ? SECTION_EXIT_Y : EXIT_SHIFT;
  const animateMount = enterOnMount && !instant;
  const shift = useSharedValue(animateMount && !reduced ? initialDirection * enterShift : 0);
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
    cancelAnimation(shift);
    cancelAnimation(o);
  }, [clearSafetyTimer, shift, o]);

  const enter = useCallback((direction: ScreenDirection) => {
    shift.value = reduced ? 0 : direction * enterShift;
    o.value = 0;
    if (!reduced) {
      shift.value = withTiming(0, { duration: durationMs, easing: EASE.enter });
    }
    o.value = withTiming(1, {
      duration: reduced ? reducedMs(durationMs) : Math.min(MS.feedback, durationMs),
      easing: EASE.ui,
      ...STAYS,
    });
  }, [reduced, enterShift, durationMs, shift, o]);

  const mounted = useRef(false);
  useEffect(() => {
    if (mounted.current) return;
    mounted.current = true;
    if (animateMount) enter(initialDirection);
  }, [animateMount, enter, initialDirection]);

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
    const out = exitMs(reduced ? MS.feedback : durationMs);
    // From wherever the values are now (a change can start while the last one is still arriving)
    if (!reduced) {
      shift.value = withTiming(-direction * exitShift, { duration: out, easing: EASE.exitSoft });
    }
    // The fade is even (not a move, so not eased): answers on f1 and hits paper right at swap
    o.value = withTiming(0, { duration: out, easing: EASE.linear, ...STAYS }, finished => {
      if (finished) runOnJS(swap)(id);
    });
    // If the fade never reports its end (app backgrounded), the change still happens
    clearSafetyTimer();
    safetyTimerRef.current = setTimeout(() => swap(id), out + MS.feedback);
  }, [instant, reduced, durationMs, exitShift, shift, o, swap, clearSafetyTimer]);

  const style = useAnimatedStyle(() => {
    const s = shift.value;
    const op = o.value;
    if (s === 0 && op === 1) {
      return { opacity: 1 };
    }
    return {
      opacity: op,
      transform: axis === 'y' ? [{ translateY: s }] : [{ translateX: s }],
    };
  });

  return { go, style, leaving };
}

interface ScreenTransitionProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * Wrapper for a screen that is simply mounted in place of another:
 * arrives the way every screen arrives, deeper.
 */
export function ScreenTransition({ children, style }: ScreenTransitionProps) {
  const t = useScreenTransition();
  return <Animated.View style={[{ flex: 1 }, t.style, style]}>{children}</Animated.View>;
}

/**
 * Disney-12 Modal & Sheet Presence Hook (`MODAL_MOTION`):
 * - Keeps the modal mounted through its exit transition in live builds (instant unmount under Jest).
 * - Backdrop fades independently (`backdropEnterMs` / `backdropExitMs`).
 * - Panel rises softly with `EASE.enterSoft` and departs in `exitMs` with `EASE.exitSoft`.
 * - Interior content trails panel on enter (`MODAL_MOTION.contentLagMs`) and leaves
 *   `MODAL_MOTION.exitContentLeadMs` BEFORE the panel collapses on exit!
 * - Reduced motion drops travel/scale and keeps crisp `STAYS` opacity crossfades.
 */
export function useModalMotion(
  visible: boolean,
  options: {
    /** Rise distance in px (default `28` for centered dialogs, `96` for bottom sheets) */
    travelY?: number;
    /** Whether this is a large sheet (`sheetEnterMs`/`sheetExitMs`) vs quick dialog (`enterMs`/`exitMs`) */
    sheet?: boolean;
    instant?: boolean;
  } = {}
) {
  const { travelY = 28, sheet = false, instant = SCREEN_INSTANT } = options;
  const reduced = useReducedMotion();
  const [rendered, setRendered] = useState(visible);
  const [closingState, setClosingState] = useState(false);

  const startOpen = instant && visible;
  const backdropO = useSharedValue(startOpen ? 1 : 0);
  const panelO = useSharedValue(startOpen ? 1 : 0);
  const panelY = useSharedValue(startOpen || reduced ? 0 : travelY);
  const panelS = useSharedValue(startOpen || reduced || sheet ? 1 : MODAL_MOTION.popInFromScale);
  const contentO = useSharedValue(startOpen ? 1 : 0);
  const contentY = useSharedValue(startOpen || reduced ? 0 : 8);

  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasVisible = useRef(visible);

  const clearExitTimer = useCallback(() => {
    if (exitTimer.current !== null) {
      clearTimeout(exitTimer.current);
      exitTimer.current = null;
    }
  }, []);

  useEffect(() => () => {
    clearExitTimer();
    cancelAnimation(backdropO);
    cancelAnimation(panelO);
    cancelAnimation(panelY);
    cancelAnimation(panelS);
    cancelAnimation(contentO);
    cancelAnimation(contentY);
  }, [clearExitTimer, backdropO, panelO, panelY, panelS, contentO, contentY]);

  useEffect(() => {
    clearExitTimer();

    if (visible) {
      wasVisible.current = true;
      setRendered(true);
      setClosingState(false);

      if (instant) {
        backdropO.value = 1;
        panelO.value = 1;
        panelY.value = 0;
        panelS.value = 1;
        contentO.value = 1;
        contentY.value = 0;
        return;
      }

      const enterDur = sheet ? MODAL_MOTION.sheetEnterMs : MODAL_MOTION.enterMs;
      const backdropDur = reduced ? reducedMs(MODAL_MOTION.backdropEnterMs) : MODAL_MOTION.backdropEnterMs;

      backdropO.value = 0;
      panelO.value = 0;
      contentO.value = 0;

      if (reduced) {
        panelY.value = 0;
        panelS.value = 1;
        contentY.value = 0;
        const fadeDur = reducedMs(enterDur);
        backdropO.value = withTiming(1, { duration: backdropDur, easing: EASE.ui, ...STAYS });
        panelO.value = withTiming(1, { duration: fadeDur, easing: EASE.ui, ...STAYS });
        contentO.value = withTiming(1, { duration: fadeDur, easing: EASE.ui, ...STAYS });
      } else {
        panelY.value = travelY;
        panelS.value = sheet ? 1 : MODAL_MOTION.popInFromScale;
        contentY.value = 8;

        backdropO.value = withTiming(1, { duration: backdropDur, easing: EASE.ui, ...STAYS });
        panelO.value = withTiming(1, { duration: MODAL_MOTION.backdropEnterMs, easing: EASE.ui, ...STAYS });
        panelY.value = withTiming(0, { duration: enterDur, easing: EASE.enterSoft });
        if (!sheet) {
          panelS.value = withTiming(1, { duration: enterDur, easing: EASE.enter });
        }
        // Content trails container by MODAL_MOTION.contentLagMs (48ms overlap)
        contentO.value = withDelay(
          MODAL_MOTION.contentLagMs,
          withTiming(1, { duration: MODAL_MOTION.backdropEnterMs, easing: EASE.ui, ...STAYS }),
          STAYS.reduceMotion
        );
        contentY.value = withDelay(
          MODAL_MOTION.contentLagMs,
          withTiming(0, { duration: MODAL_MOTION.enterMs, easing: EASE.enter })
        );
      }
      return;
    }

    if (!wasVisible.current) return;
    wasVisible.current = false;

    if (instant) {
      backdropO.value = 0;
      panelO.value = 0;
      contentO.value = 0;
      setRendered(false);
      setClosingState(false);
      return;
    }

    setClosingState(true);
    const exitDur = sheet ? MODAL_MOTION.sheetExitMs : MODAL_MOTION.exitMs;
    const leadMs = reduced ? 0 : MODAL_MOTION.exitContentLeadMs;
    const totalOutMs = reduced ? reducedMs(exitDur) : exitDur + leadMs;

    const finish = () => {
      if (wasVisible.current) return;
      setRendered(false);
      setClosingState(false);
    };

    if (reduced) {
      const fadeDur = reducedMs(exitDur);
      contentO.value = withTiming(0, { duration: fadeDur, easing: EASE.linear, ...STAYS });
      panelO.value = withTiming(0, { duration: fadeDur, easing: EASE.linear, ...STAYS });
      backdropO.value = withTiming(0, { duration: fadeDur, easing: EASE.linear, ...STAYS });
      exitTimer.current = setTimeout(finish, fadeDur + OVERLAP.primaryMs);
    } else {
      // Exit inversion: content fades out 48ms BEFORE the panel collapses; linear fade reaches 0 cleanly before unmount
      const contentOutDur = Math.max(OVERLAP.secondaryMs, exitDur - leadMs);
      contentO.value = withTiming(0, { duration: contentOutDur, easing: EASE.linear, ...STAYS });
      contentY.value = withTiming(6, { duration: contentOutDur, easing: EASE.exitSoft });

      panelY.value = withDelay(leadMs, withTiming(Math.round(travelY * 0.72), { duration: exitDur, easing: EASE.exitSoft }));
      if (!sheet) {
        panelS.value = withDelay(leadMs, withTiming(MODAL_MOTION.popOutToScale, { duration: exitDur, easing: EASE.exitSoft }));
      }
      panelO.value = withDelay(
        leadMs,
        withTiming(0, { duration: exitDur, easing: EASE.linear, ...STAYS }),
        STAYS.reduceMotion
      );
      backdropO.value = withDelay(
        leadMs,
        withTiming(0, { duration: exitDur, easing: EASE.linear, ...STAYS }),
        STAYS.reduceMotion
      );
      exitTimer.current = setTimeout(finish, totalOutMs + OVERLAP.primaryMs);
    }
  }, [visible, instant, reduced, sheet, travelY, clearExitTimer, backdropO, panelO, panelY, panelS, contentO, contentY]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropO.value,
  }));

  const panelStyle = useAnimatedStyle(() => ({
    opacity: panelO.value,
    transform: [{ translateY: panelY.value }, { scale: panelS.value }],
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentO.value,
    transform: [{ translateY: contentY.value }],
  }));

  // Synchronous closing flag: flips to `true` on the exact render `visible` turns false so taps pass through immediately
  const closing = closingState || (rendered && !visible);

  return { rendered, closing, backdropStyle, panelStyle, contentStyle };
}
