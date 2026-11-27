/**
 * Starfall Summit (Spire) — Shared Disney-12 × Tactile Tabletop Motion Primitives.
 *
 * Strictly consumes tokens from `src/utils/motion.ts` (zero magic literals),
 * animates GPU-only `transform` and `opacity`, gates every infinite loop on
 * `useAppActive()` + `!useReducedMotion()` with `cancelAnimation` cleanup, and
 * preserves meaning under reduced motion via `STAYS` / `reducedMs`.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  type AccessibilityState,
  type Insets,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useAppActive } from '@/hooks/useAppActive';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import {
  BTN_PRESS,
  EASE,
  IDLE_LOOP,
  MODAL_MOTION,
  MS,
  SCALE,
  SECONDARY,
  SPRING,
  STAGGER,
  STAYS,
  exitMs,
  reducedMs,
  seedFromKey,
  staggerDelay,
} from '@/utils/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Jest runs synchronous transitions so existing unit assertions stay deterministic. */
export const SPIRE_MOTION_INSTANT =
  typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

/* -------------------------------------------------------------------------- */
/* 1. Vertical Ascent / Descent Route Transition (`SpireMode.tsx`)            */
/* -------------------------------------------------------------------------- */

export type SpireTransitionDir = 'ascend' | 'descend';

const ASCENT_ENTER_Y = 28;
const ASCENT_EXIT_Y = 16;

export interface SpireScreenTransitionControl {
  go: (apply: () => void, dir?: SpireTransitionDir) => void;
  style: StyleProp<ViewStyle>;
  leaving: boolean;
}

/**
 * Cohesive vertical ascent/descent transition for Starfall Summit routes.
 * - `'ascend'` (climbing deeper into a room, briefing, fight, reward, next Act, victory):
 *   old view recedes gently (`+16px`, `scale 0.985`, soft fade to `0.15` so there is never a
 *   blackout dip!), then new view rises upward (`+28px → 0`, `scale 0.985 → 1`) in `MS.screen`.
 * - `'descend'` (stepping back to Map or Setup): inverse vertical motion.
 * - Reduced motion: zero travel, crisp opacity fade with `STAYS`.
 */
export function useSpireScreenTransition({
  instant = SPIRE_MOTION_INSTANT,
  enterOnMount = true,
}: {
  instant?: boolean;
  enterOnMount?: boolean;
} = {}): SpireScreenTransitionControl {
  const reduced = useReducedMotion();
  const animateMount = enterOnMount && !instant;
  const y = useSharedValue(animateMount && !reduced ? ASCENT_ENTER_Y : 0);
  const s = useSharedValue(animateMount && !reduced ? 0.985 : 1);
  const o = useSharedValue(animateMount ? 0 : 1);
  const [leaving, setLeaving] = useState(false);

  const pendingRef = useRef<{ apply: () => void; dir: SpireTransitionDir } | null>(null);
  const exitingRef = useRef(false);
  const aliveRef = useRef(true);
  const exitIdRef = useRef(0);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSafety = useCallback(() => {
    if (safetyTimerRef.current !== null) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      aliveRef.current = false;
      clearSafety();
      cancelAnimation(y);
      cancelAnimation(s);
      cancelAnimation(o);
    };
  }, [clearSafety, y, s, o]);

  const enter = useCallback(
    (dir: SpireTransitionDir) => {
      const sign = dir === 'ascend' ? 1 : -1;
      if (reduced) {
        y.value = 0;
        s.value = 1;
        o.value = 0.2;
        o.value = withTiming(1, { duration: reducedMs(MS.quick), easing: EASE.ui, ...STAYS });
        return;
      }
      y.value = sign * ASCENT_ENTER_Y;
      s.value = 0.985;
      o.value = 0.18;
      y.value = withTiming(0, { duration: MS.screen, easing: EASE.enter });
      s.value = withTiming(1, { duration: MS.screen, easing: EASE.enter });
      o.value = withTiming(1, { duration: MS.quick, easing: EASE.ui, ...STAYS });
    },
    [reduced, y, s, o]
  );

  const mountedRef = useRef(false);
  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    if (animateMount) enter('ascend');
  }, [animateMount, enter]);

  const swap = useCallback(
    (id: number) => {
      if (id !== exitIdRef.current || !exitingRef.current) return;
      clearSafety();
      exitingRef.current = false;
      const next = pendingRef.current;
      pendingRef.current = null;
      if (!aliveRef.current || !next) return;
      next.apply();
      setLeaving(false);
      enter(next.dir);
    },
    [clearSafety, enter]
  );

  const go = useCallback(
    (apply: () => void, dir: SpireTransitionDir = 'ascend') => {
      if (instant) {
        clearSafety();
        apply();
        return;
      }
      pendingRef.current = { apply, dir };
      if (exitingRef.current) return;
      exitingRef.current = true;
      const id = ++exitIdRef.current;
      setLeaving(true);
      const outDur = reduced ? reducedMs(exitMs(MS.quick)) : exitMs(MS.quick);
      const sign = dir === 'ascend' ? 1 : -1;
      if (!reduced) {
        // Ascending recedes subtly downward (+Y); descending glides upward (-Y), decelerating cleanly before swap
        y.value = withTiming(sign * ASCENT_EXIT_Y, { duration: outDur, easing: EASE.ui });
        s.value = withTiming(0.985, { duration: outDur, easing: EASE.ui });
      }
      o.value = withTiming(0.15, { duration: outDur, easing: EASE.ui, ...STAYS });
      // Drive swap on a single deterministic timer (no Reanimated worklet-vs-timer race)
      clearSafety();
      safetyTimerRef.current = setTimeout(() => swap(id), outDur + 16);
    },
    [instant, reduced, y, s, o, swap, clearSafety]
  );

  const style = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: y.value }, { scale: s.value }],
  }));

  return { go, style, leaving };
}

/* -------------------------------------------------------------------------- */
/* 2. Staggered Entrance Wrapper (`STAGGER.item` / `STAGGER.card`)            */
/* -------------------------------------------------------------------------- */

export const SpireStaggerItem: React.FC<{
  index: number;
  count?: number;
  baseDelayMs?: number;
  gapMs?: number;
  distance?: number;
  hero?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: React.ReactNode;
}> = ({
  index,
  count = 6,
  baseDelayMs = 0,
  gapMs = STAGGER.item,
  distance = 14,
  hero = false,
  style,
  testID,
  children,
}) => {
  const reduced = useReducedMotion();
  const skip = SPIRE_MOTION_INSTANT;
  const delay = baseDelayMs + staggerDelay(index, Math.max(count, index + 1), gapMs);
  const startY = skip || reduced ? 0 : hero ? distance : Math.round(distance * SECONDARY.travelRatio);
  const startScale = skip || reduced ? 1 : hero ? MODAL_MOTION.popInFromScale : 0.985;

  const y = useSharedValue(startY);
  const s = useSharedValue(startScale);
  const o = useSharedValue(skip ? 1 : 0);

  useEffect(() => {
    if (skip) return;
    if (reduced) {
      y.value = 0;
      s.value = 1;
      const dur = reducedMs(MS.quick);
      o.value = withTiming(1, { duration: dur, easing: EASE.ui, ...STAYS });
      return;
    }
    const dur = hero ? MS.move : MS.quick;
    const ease = hero ? EASE.enterSoft : EASE.enter;
    const moveAnim = withTiming(0, { duration: dur, easing: ease });
    const scaleAnim = withTiming(1, { duration: dur, easing: ease });
    const fadeAnim = withTiming(1, { duration: Math.round(dur * 0.72), easing: EASE.ui, ...STAYS });
    y.value = delay > 0 ? withDelay(delay, moveAnim) : moveAnim;
    s.value = delay > 0 ? withDelay(delay, scaleAnim) : scaleAnim;
    o.value = delay > 0 ? withDelay(delay, fadeAnim, STAYS.reduceMotion) : fadeAnim;
  }, [skip, reduced, delay, hero, y, s, o]);

  useEffect(
    () => () => {
      cancelAnimation(y);
      cancelAnimation(s);
      cancelAnimation(o);
    },
    [y, s, o]
  );

  const anim = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: y.value }, { scale: s.value }],
  }));

  return (
    <Animated.View testID={testID} style={[anim, style]}>
      {children}
    </Animated.View>
  );
};

/* -------------------------------------------------------------------------- */
/* 3. Tactile Tabletop Pressable (`scale(0.96)` + physical ledge push-down)   */
/* -------------------------------------------------------------------------- */

export const SpireTactilePressable: React.FC<{
  onPress?: () => void;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  hitSlop?: Insets;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityRole?: 'button';
  accessibilityState?: AccessibilityState;
  children: React.ReactNode;
}> = ({
  onPress,
  disabled = false,
  small = false,
  style,
  hitSlop,
  testID,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  children,
}) => {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);
  const pushY = small ? BTN_PRESS.smallTranslateY : BTN_PRESS.translateY;

  useEffect(() => {
    if (disabled) {
      cancelAnimation(pressed);
      pressed.value = 0;
    }
  }, [disabled, pressed]);

  useEffect(() => () => cancelAnimation(pressed), [pressed]);

  const handlePressIn = useCallback(() => {
    if (disabled) return;
    pressed.value = withTiming(1, {
      duration: BTN_PRESS.pressInMs,
      easing: EASE.ui,
      ...(reduced ? STAYS : {}),
    });
  }, [disabled, pressed, reduced]);

  const handlePressOut = useCallback(() => {
    if (reduced) {
      pressed.value = withTiming(0, {
        duration: BTN_PRESS.pressInMs,
        easing: EASE.ui,
        ...STAYS,
      });
    } else {
      pressed.value = withSpring(0, SPRING.snappy);
    }
  }, [pressed, reduced]);

  const pressStyle = useAnimatedStyle(() => {
    if (reduced) {
      const target = disabled ? 1 : BTN_PRESS.reducedOpacity;
      return {
        opacity: 1 + (target - 1) * pressed.value,
        transform: [{ translateY: 0 }, { scale: 1 }],
      };
    }
    const scale = 1 - pressed.value * (1 - BTN_PRESS.scale);
    return {
      transform: [{ translateY: pressed.value * pushY }, { scale }],
    };
  });

  return (
    <AnimatedPressable
      testID={testID}
      disabled={disabled}
      hitSlop={hitSlop}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState ?? { disabled }}
      style={[style, pressStyle]}
    >
      {children}
    </AnimatedPressable>
  );
};

/* -------------------------------------------------------------------------- */
/* 4. Zero-Frame-Loop GPU Lightweight Breath Wrapper (for Fighter portraits)  */
/* -------------------------------------------------------------------------- */

export const SpireLightweightBreath: React.FC<{
  /** Stable seed string (e.g. fighter name) for deterministic phase & prime period desync */
  keySeed: string;
  /** Portrait pixel size for accurate bottom foot-anchor pivoting */
  size: number;
  active?: boolean;
  /** Optional incrementing pulse key (e.g. heart heal/damage) for a 1-shot celebratory pop */
  pulseKey?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}> = ({ keySeed, size, active = true, pulseKey = 0, style, children }) => {
  const appActive = useAppActive();
  const reduced = useReducedMotion();
  const breath = useSharedValue(0);
  const pulse = useSharedValue(1);
  const running = active && appActive && !reduced && !SPIRE_MOTION_INSTANT;

  useEffect(() => {
    if (!running) {
      cancelAnimation(breath);
      breath.value = 0;
      return;
    }
    const hash = seedFromKey(keySeed);
    const periodMs = IDLE_LOOP.primePeriodsMs[hash % IDLE_LOOP.primePeriodsMs.length];
    const halfMs = Math.round(periodMs / 2);
    const phaseMs = hash % periodMs;
    breath.value = 0;
    breath.value = withDelay(
      phaseMs,
      withRepeat(withTiming(1, { duration: halfMs, easing: EASE.drift }), -1, true)
    );
    return () => {
      cancelAnimation(breath);
    };
  }, [running, keySeed, breath]);

  const prevPulseRef = useRef(pulseKey);
  useEffect(() => {
    if (pulseKey === prevPulseRef.current) return;
    prevPulseRef.current = pulseKey;
    if (reduced || SPIRE_MOTION_INSTANT) return;
    pulse.value = withSequence(
      withTiming(SCALE.pop, { duration: MS.feedback, easing: EASE.popSoft }),
      withSpring(1, SPRING.lively)
    );
  }, [pulseKey, reduced, pulse]);

  useEffect(
    () => () => {
      cancelAnimation(breath);
      cancelAnimation(pulse);
    },
    [breath, pulse]
  );

  const footAnchorY = size * 0.35;
  const amp = IDLE_LOOP.creatureBreathMax * 0.8;
  const anim = useAnimatedStyle(() => {
    const scaleY = (1 + breath.value * amp) * pulse.value;
    const scaleX = (1 / (1 + breath.value * amp)) * pulse.value;
    return {
      transform: [
        { translateY: footAnchorY },
        { scaleX },
        { scaleY },
        { translateY: -footAnchorY },
      ],
    };
  });

  return <Animated.View style={[anim, style]}>{children}</Animated.View>;
};

/* -------------------------------------------------------------------------- */
/* 5. Header / Counter Stat Pop (`tabular-nums`, gain up / spend down)        */
/* -------------------------------------------------------------------------- */

export const SpireStatPop: React.FC<{
  value: number | string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: React.ReactNode;
}> = ({ value, style, testID, children }) => {
  const reduced = useReducedMotion();
  const prevRef = useRef(value);
  const scale = useSharedValue(1);
  const ty = useSharedValue(0);
  const op = useSharedValue(1);

  useEffect(() => {
    if (prevRef.current === value) return;
    const prevNum = typeof prevRef.current === 'number' ? prevRef.current : Number(prevRef.current);
    const nextNum = typeof value === 'number' ? value : Number(value);
    const gained = Number.isFinite(prevNum) && Number.isFinite(nextNum) ? nextNum >= prevNum : true;
    prevRef.current = value;

    if (SPIRE_MOTION_INSTANT) return;
    if (reduced) {
      op.value = withSequence(
        STAYS.reduceMotion,
        withTiming(0.68, { duration: reducedMs(MS.feedback), easing: EASE.ui, ...STAYS }),
        withTiming(1, { duration: reducedMs(MS.feedback), easing: EASE.ui, ...STAYS })
      );
      return;
    }
    scale.value = withSequence(
      withTiming(gained ? SCALE.pop : 0.94, { duration: BTN_PRESS.pressInMs, easing: EASE.ui }),
      withSpring(1, SPRING.lively)
    );
    ty.value = withSequence(
      withTiming(gained ? -3 : 2, { duration: BTN_PRESS.pressInMs, easing: EASE.ui }),
      withSpring(0, SPRING.snappy)
    );
  }, [value, reduced, scale, ty, op]);

  useEffect(
    () => () => {
      cancelAnimation(scale);
      cancelAnimation(ty);
      cancelAnimation(op);
    },
    [scale, ty, op]
  );

  const anim = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ translateY: ty.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View testID={testID} style={[anim, style]}>
      {children}
    </Animated.View>
  );
};

/* -------------------------------------------------------------------------- */
/* 6. Smooth Ease-Out Count-Up (`tabular-nums`, never sits at 0!)             */
/* -------------------------------------------------------------------------- */

const COUNT_STEP_MS = 36;

export const SpireCountUp: React.FC<{
  target: number;
  delayMs?: number;
  ticks?: number;
  /** When true, starts immediately at initial target and smoothly counts between subsequent value changes (e.g. Shop coins, Treasure haul). */
  animateChanges?: boolean;
  prefix?: string;
  suffix?: string;
  format?: (n: number) => string;
  style?: StyleProp<TextStyle>;
  testID?: string;
}> = ({
  target,
  delayMs = 0,
  ticks = 10,
  animateChanges = false,
  prefix = '',
  suffix = '',
  format = n => Math.round(n).toLocaleString('en-US'),
  style,
  testID,
}) => {
  const reduced = useReducedMotion();
  const instant = reduced || SPIRE_MOTION_INSTANT || (!animateChanges && target <= 0);
  const safeTicks = Math.max(3, Math.min(18, ticks));
  const [fromVal, setFromVal] = useState(animateChanges ? target : 0);
  const [step, setStep] = useState(instant || animateChanges ? safeTicks : 0);
  const prevTargetRef = useRef(target);
  const bump = useSharedValue(1);
  const op = useSharedValue(instant || animateChanges ? 1 : 0);

  useEffect(() => {
    const prevTarget = prevTargetRef.current;
    prevTargetRef.current = target;
    if (instant) {
      setFromVal(target);
      setStep(safeTicks);
      op.value = 1;
      return;
    }
    if (animateChanges) {
      if (prevTarget === target) {
        setFromVal(target);
        setStep(safeTicks);
        op.value = 1;
        return;
      }
      setFromVal(prevTarget);
      setStep(0);
      op.value = 1;
      const changeTicks = Math.min(safeTicks, 6);
      const timers: ReturnType<typeof setTimeout>[] = [];
      for (let i = 1; i <= changeTicks; i++) {
        timers.push(setTimeout(() => setStep(Math.round((i / changeTicks) * safeTicks)), i * COUNT_STEP_MS));
      }
      timers.push(
        setTimeout(() => {
          bump.value = withSequence(
            withTiming(target >= prevTarget ? SCALE.pop : 0.94, { duration: BTN_PRESS.pressInMs, easing: EASE.ui }),
            withSpring(1, SPRING.lively)
          );
        }, changeTicks * COUNT_STEP_MS)
      );
      return () => timers.forEach(clearTimeout);
    }

    setFromVal(0);
    setStep(0);
    op.value = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(
      setTimeout(() => {
        op.value = withTiming(1, { duration: MS.feedback, easing: EASE.ui, ...STAYS });
        setStep(1);
      }, delayMs)
    );
    for (let i = 2; i <= safeTicks; i++) {
      timers.push(setTimeout(() => setStep(i), delayMs + (i - 1) * COUNT_STEP_MS));
    }
    timers.push(
      setTimeout(() => {
        bump.value = withSequence(
          withTiming(SCALE.pop, { duration: BTN_PRESS.pressInMs, easing: EASE.ui }),
          withSpring(1, SPRING.lively)
        );
      }, delayMs + safeTicks * COUNT_STEP_MS)
    );
    return () => {
      timers.forEach(clearTimeout);
    };
  }, [target, delayMs, safeTicks, animateChanges, instant, bump, op]);

  useEffect(
    () => () => {
      cancelAnimation(bump);
      cancelAnimation(op);
    },
    [bump, op]
  );

  const t = safeTicks > 0 ? step / safeTicks : 1;
  const eased = 1 - Math.pow(1 - Math.max(animateChanges ? 0 : 0.14, t), 2.2);
  // Never shows 0 while counting up from 0: step 1 jumps immediately into the curve
  const shown =
    step >= safeTicks
      ? target
      : animateChanges
        ? Math.round(fromVal + (target - fromVal) * eased)
        : Math.max(1, Math.round(target * eased));

  const anim = useAnimatedStyle(() => ({
    opacity: op.value,
    transform: [{ scale: bump.value }],
  }));

  return (
    <Animated.View style={anim}>
      <Text testID={testID} style={[st.tabular, style]}>
        {prefix}
        {format(shown)}
        {suffix}
      </Text>
    </Animated.View>
  );
};

/* -------------------------------------------------------------------------- */
/* 7. Crossfade Swap (Smooth Submode / Outcome / Reroll Swap)                 */
/* -------------------------------------------------------------------------- */

export const SpireCrossfadeSwap: React.FC<{
  swapKey: string | number;
  /** Optional minimum opacity floor during in-place card swaps so a card never flashes hollow. */
  minOpacity?: number;
  /** Uses snappy `exitMs(MS.feedback)` (78ms) instead of `exitMs(MS.quick)` (104ms) for rapid selector swaps. */
  fast?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: React.ReactNode;
}> = ({ swapKey, minOpacity = 0, fast = false, style, testID, children }) => {
  const reduced = useReducedMotion();
  const [shownKey, setShownKey] = useState(swapKey);
  const [shownChildren, setShownChildren] = useState(children);
  const latestChildrenRef = useRef(children);
  latestChildrenRef.current = children;

  const o = useSharedValue(1);
  const y = useSharedValue(0);
  const s = useSharedValue(1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (swapKey === shownKey) {
      setShownChildren(children);
      return;
    }
    if (SPIRE_MOTION_INSTANT) {
      setShownKey(swapKey);
      setShownChildren(children);
      o.value = 1;
      y.value = 0;
      s.value = 1;
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    // Decelerate exit cleanly to zero velocity (EASE.ui) before swapping content: zero HARD-STOP, zero FADE-ONLY
    const baseOut = fast ? exitMs(MS.feedback) : exitMs(MS.quick);
    const outDur = reduced ? reducedMs(baseOut) : baseOut;
    const inDur = reduced ? reducedMs(MS.quick) : MS.quick;
    const floorOp = Math.max(0, Math.min(0.45, minOpacity));

    if (!reduced) {
      y.value = withTiming(fast ? -7 : -10, { duration: outDur, easing: EASE.ui });
      s.value = withTiming(fast ? 0.985 : 0.97, { duration: outDur, easing: EASE.ui });
    }
    o.value = withTiming(floorOp, { duration: outDur, easing: EASE.ui, ...STAYS });

    timerRef.current = setTimeout(() => {
      setShownKey(swapKey);
      setShownChildren(latestChildrenRef.current);
      if (reduced) {
        y.value = 0;
        s.value = 1;
        o.value = withTiming(1, { duration: inDur, easing: EASE.ui, ...STAYS });
      } else {
        y.value = fast ? 8 : 12;
        s.value = fast ? 0.985 : 0.97;
        y.value = withTiming(0, { duration: inDur, easing: EASE.enter });
        s.value = withTiming(1, { duration: inDur, easing: EASE.enter });
        o.value = withTiming(1, { duration: Math.round(inDur * 0.8), easing: EASE.ui, ...STAYS });
      }
    }, outDur + 16);
  }, [swapKey, shownKey, children, reduced, fast, minOpacity, o, y, s]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      cancelAnimation(o);
      cancelAnimation(y);
      cancelAnimation(s);
    },
    [o, y, s]
  );

  const anim = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: y.value }, { scale: s.value }],
  }));

  return (
    <Animated.View testID={testID} style={[anim, style]}>
      {shownChildren}
    </Animated.View>
  );
};

/* -------------------------------------------------------------------------- */
/* 8. Modal Shell with True Enter & Exit (`OVERLAP.exitContentLeadMs`)        */
/* -------------------------------------------------------------------------- */

export const SpireModalShell: React.FC<{
  visible: boolean;
  onClose: () => void;
  backdropLabel?: string;
  overlayStyle?: StyleProp<ViewStyle>;
  sheetStyle?: StyleProp<ViewStyle>;
  overlayTestID?: string;
  sheetTestID?: string;
  /** Optional header/footer rendered inside the sheet container (moves with container) */
  header?: React.ReactNode;
  footer?: React.ReactNode;
  /** Main body rendered inside the lagged/lead content wrapper (OVERLAP.uiContentMs / exitContentLeadMs) */
  children: React.ReactNode;
}> = ({
  visible,
  onClose,
  backdropLabel = 'Close modal',
  overlayStyle,
  sheetStyle,
  overlayTestID,
  sheetTestID,
  header,
  footer,
  children,
}) => {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);

  const backdropOp = useSharedValue(0);
  const sheetOp = useSharedValue(0);
  const sheetY = useSharedValue(reduced ? 0 : 28);
  const sheetScale = useSharedValue(reduced ? 1 : MODAL_MOTION.popInFromScale);
  const contentOp = useSharedValue(0);
  const contentY = useSharedValue(reduced ? 0 : 10);

  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }

    if (visible) {
      setMounted(true);
      if (SPIRE_MOTION_INSTANT) {
        backdropOp.value = 1;
        sheetOp.value = 1;
        sheetY.value = 0;
        sheetScale.value = 1;
        contentOp.value = 1;
        contentY.value = 0;
        return;
      }

      if (reduced) {
        sheetY.value = 0;
        sheetScale.value = 1;
        contentY.value = 0;
        backdropOp.value = withTiming(1, {
          duration: reducedMs(MODAL_MOTION.backdropEnterMs),
          easing: EASE.ui,
          ...STAYS,
        });
        sheetOp.value = withTiming(1, {
          duration: reducedMs(MODAL_MOTION.enterMs),
          easing: EASE.ui,
          ...STAYS,
        });
        contentOp.value = withTiming(1, {
          duration: reducedMs(MODAL_MOTION.enterMs),
          easing: EASE.ui,
          ...STAYS,
        });
      } else {
        backdropOp.value = withTiming(1, {
          duration: MODAL_MOTION.backdropEnterMs,
          easing: EASE.ui,
          ...STAYS,
        });
        sheetY.value = 28;
        sheetScale.value = MODAL_MOTION.popInFromScale;
        sheetOp.value = 0;
        sheetY.value = withTiming(0, { duration: MODAL_MOTION.enterMs, easing: EASE.enter });
        sheetScale.value = withTiming(1, { duration: MODAL_MOTION.enterMs, easing: EASE.enter });
        sheetOp.value = withTiming(1, {
          duration: Math.round(MODAL_MOTION.enterMs * 0.75),
          easing: EASE.ui,
          ...STAYS,
        });
        // Content lags container by OVERLAP.uiContentMs (48ms)
        contentY.value = 10;
        contentOp.value = 0;
        contentY.value = withDelay(
          MODAL_MOTION.contentLagMs,
          withTiming(0, { duration: MS.quick, easing: EASE.enter })
        );
        contentOp.value = withDelay(
          MODAL_MOTION.contentLagMs,
          withTiming(1, { duration: MS.feedback, easing: EASE.ui, ...STAYS }),
          STAYS.reduceMotion
        );
      }
      return;
    }

    if (!mounted) return;
    if (SPIRE_MOTION_INSTANT) {
      setMounted(false);
      return;
    }

    // Exit inversion (Disney #5): content exits `OVERLAP.exitContentLeadMs` (48ms) BEFORE container collapses
    const lead = reduced ? 0 : MODAL_MOTION.exitContentLeadMs;
    const contentOut = reduced ? reducedMs(exitMs(MS.feedback)) : exitMs(MS.feedback);
    const sheetOut = reduced ? reducedMs(MODAL_MOTION.exitMs) : MODAL_MOTION.exitMs;
    const backdropOut = reduced ? reducedMs(MODAL_MOTION.backdropExitMs) : MODAL_MOTION.backdropExitMs;

    contentOp.value = withTiming(0, { duration: contentOut, easing: EASE.exitSoft, ...STAYS });
    if (!reduced) {
      contentY.value = withTiming(6, { duration: contentOut, easing: EASE.exitSoft });
    }

    sheetOp.value = withDelay(
      lead,
      withTiming(0, { duration: sheetOut, easing: EASE.exitSoft, ...STAYS }),
      STAYS.reduceMotion
    );
    if (!reduced) {
      sheetScale.value = withDelay(
        lead,
        withTiming(MODAL_MOTION.popOutToScale, { duration: sheetOut, easing: EASE.exitSoft })
      );
      sheetY.value = withDelay(
        lead,
        withTiming(18, { duration: sheetOut, easing: EASE.exitSoft })
      );
    }
    backdropOp.value = withDelay(
      lead,
      withTiming(0, { duration: backdropOut, easing: EASE.exitSoft, ...STAYS }),
      STAYS.reduceMotion
    );

    const totalExitMs = lead + Math.max(sheetOut, backdropOut) + 16;
    exitTimerRef.current = setTimeout(() => {
      setMounted(false);
    }, totalExitMs);
  }, [
    visible,
    mounted,
    reduced,
    backdropOp,
    sheetOp,
    sheetY,
    sheetScale,
    contentOp,
    contentY,
  ]);

  useEffect(
    () => () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      cancelAnimation(backdropOp);
      cancelAnimation(sheetOp);
      cancelAnimation(sheetY);
      cancelAnimation(sheetScale);
      cancelAnimation(contentOp);
      cancelAnimation(contentY);
    },
    [backdropOp, sheetOp, sheetY, sheetScale, contentOp, contentY]
  );

  const backdropAnim = useAnimatedStyle(() => ({ opacity: backdropOp.value }));
  const sheetAnim = useAnimatedStyle(() => ({
    opacity: sheetOp.value,
    transform: [{ translateY: sheetY.value }, { scale: sheetScale.value }],
  }));
  const contentAnim = useAnimatedStyle(() => ({
    opacity: contentOp.value,
    transform: [{ translateY: contentY.value }],
  }));

  if (!mounted) return null;

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View
        style={[st.modalOverlay, overlayStyle, backdropAnim]}
        testID={overlayTestID}
        pointerEvents={visible ? 'auto' : 'none'}
      >
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={backdropLabel}
        />
        <Animated.View style={[sheetStyle, sheetAnim]} testID={sheetTestID}>
          {header}
          <Animated.View style={[st.modalContentWrap, contentAnim]}>{children}</Animated.View>
          {footer}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

/* -------------------------------------------------------------------------- */
/* 9. Inline Panel Enter/Exit (`SpireSwapPicker` & Shop Forge Picker)         */
/* -------------------------------------------------------------------------- */

export const SpireInlineDrawer: React.FC<{
  visible: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: React.ReactNode;
}> = ({ visible, style, testID, children }) => {
  const reduced = useReducedMotion();
  const [mounted, setMounted] = useState(visible);
  const o = useSharedValue(visible && SPIRE_MOTION_INSTANT ? 1 : 0);
  const s = useSharedValue(visible && (SPIRE_MOTION_INSTANT || reduced) ? 1 : MODAL_MOTION.popInFromScale);
  const y = useSharedValue(visible && (SPIRE_MOTION_INSTANT || reduced) ? 0 : -8);
  const contentOp = useSharedValue(visible && SPIRE_MOTION_INSTANT ? 1 : 0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (visible) {
      setMounted(true);
      if (SPIRE_MOTION_INSTANT) {
        o.value = 1;
        s.value = 1;
        y.value = 0;
        contentOp.value = 1;
        return;
      }
      if (reduced) {
        s.value = 1;
        y.value = 0;
        o.value = withTiming(1, { duration: reducedMs(MODAL_MOTION.enterMs), easing: EASE.ui, ...STAYS });
        contentOp.value = withTiming(1, {
          duration: reducedMs(MODAL_MOTION.enterMs),
          easing: EASE.ui,
          ...STAYS,
        });
      } else {
        y.value = -8;
        s.value = MODAL_MOTION.popInFromScale;
        o.value = 0;
        contentOp.value = 0;
        y.value = withTiming(0, { duration: MODAL_MOTION.enterMs, easing: EASE.enter });
        s.value = withTiming(1, { duration: MODAL_MOTION.enterMs, easing: EASE.enter });
        o.value = withTiming(1, { duration: MS.feedback, easing: EASE.ui, ...STAYS });
        contentOp.value = withDelay(
          MODAL_MOTION.contentLagMs,
          withTiming(1, { duration: MS.feedback, easing: EASE.ui, ...STAYS }),
          STAYS.reduceMotion
        );
      }
      return;
    }
    if (!mounted) return;
    if (SPIRE_MOTION_INSTANT) {
      setMounted(false);
      return;
    }
    const lead = reduced ? 0 : MODAL_MOTION.exitContentLeadMs;
    const outDur = reduced ? reducedMs(MODAL_MOTION.exitMs) : MODAL_MOTION.exitMs;
    contentOp.value = withTiming(0, {
      duration: reduced ? outDur : exitMs(MS.feedback),
      easing: EASE.exitSoft,
      ...STAYS,
    });
    o.value = withDelay(
      lead,
      withTiming(0, { duration: outDur, easing: EASE.exitSoft, ...STAYS }),
      STAYS.reduceMotion
    );
    if (!reduced) {
      s.value = withDelay(
        lead,
        withTiming(MODAL_MOTION.popOutToScale, { duration: outDur, easing: EASE.exitSoft })
      );
      y.value = withDelay(lead, withTiming(-6, { duration: outDur, easing: EASE.exitSoft }));
    }
    timerRef.current = setTimeout(() => setMounted(false), lead + outDur + 16);
  }, [visible, mounted, reduced, o, s, y, contentOp]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      cancelAnimation(o);
      cancelAnimation(s);
      cancelAnimation(y);
      cancelAnimation(contentOp);
    },
    [o, s, y, contentOp]
  );

  const shellAnim = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ translateY: y.value }, { scale: s.value }],
  }));
  const innerAnim = useAnimatedStyle(() => ({ opacity: contentOp.value }));

  if (!mounted) return null;

  return (
    <Animated.View testID={testID} style={[style, shellAnim]} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.View style={innerAnim}>{children}</Animated.View>
    </Animated.View>
  );
};

const st = StyleSheet.create({
  tabular: {
    fontVariant: ['tabular-nums'],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18,18,18,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 12,
  },
  modalContentWrap: {
    flexShrink: 1,
    minHeight: 0,
  },
});
