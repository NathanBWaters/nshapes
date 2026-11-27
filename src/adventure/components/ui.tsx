/** Small shared UI primitives for Adventure screens (Tactile Tabletop Storybook). */
import React, { useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  withDelay,
  cancelAnimation,
} from 'react-native-reanimated';
import Icon, { IconName } from '@/components/Icon';
import { useAppActive } from '@/hooks/useAppActive';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import { DISPLAY_FONT, MONO_FONT } from '@/utils/fonts';
import { BTN_PRESS, EASE, MODAL_MOTION, MS, SPRING, STAYS, reducedMs } from '@/utils/motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const INK = COLORS.slateCharcoal;

/** Adventure tones that the core style-guide palette (COLORS) has no name for. */
export const TONE = {
  /** Text and icons of something already earned, claimed or common */
  spent: '#8E877D',
  spentEdge: '#CFC8BD',
  lockedEdge: '#B8B0A4',
  emptyPip: '#D9D2C7',
  coin: '#B07D00',
  coinBright: '#E0A800',
  coinPale: '#FFF6C2',
  selected: '#FFFBE0',
  arcana: '#6D28D9',
  arcanaPale: '#FAF5FF',
  combo: '#7C3AED',
  comboPale: '#F5F3FF',
  upside: '#0F766E',
  tradeoff: '#B45309',
  evoReady: '#D97706',
  /** Shading Surge: the ×5 window */
  surge: '#DB2777',
  surgePale: '#FDF2F8',
  /** Text on the lantern-lit tabletop walnut Camp and Bounty Board backdrops */
  onDusk: '#F3EAE0',
  /** Warm slate-walnut tabletop backdrop & surface (harmonized with Paper Beige cardstock) */
  walnutFrame: COLORS.walnutFrame,
  walnutSurface: COLORS.walnutSurface,
  walnutBorder: COLORS.walnutBorder,
} as const;

/** The dark cards used for lessons, in-fight tips and unlock reveals. */
export const DARK = {
  panel: '#1C1B19',
  stage: '#2A2826',
  text: '#F1ECE4',
  muted: '#B9B1A5',
  gold: COLORS.actionYellow,
  /** Thin gold outline of a dark card */
  goldEdge: (alpha: number) => `rgba(255,222,0,${alpha})`,
} as const;

/**
 * Results screen: earned stars fall into their slots one after another (ResultsMotion.tsx),
 * then the unlock reveals start. `starPopDelayMs` is when star `index` starts to fall,
 * `starLandMs` the frame it hits its slot (its sound and its goal's ✓ belong there),
 * `starsLandedMs` when the last one has settled and had a breath.
 */
export const STAR_FIRST_MS = 180;
export const STAR_GAP_MS = 340;
export const STAR_FALL_MS = MS.screen;
export const starPopDelayMs = (index: number): number => STAR_FIRST_MS + index * STAR_GAP_MS;
export const starLandMs = (index: number): number => starPopDelayMs(index) + STAR_FALL_MS;
export const starsLandedMs = (stars: number): number => (stars > 0 ? starLandMs(stars - 1) + 240 : 600);

export const Btn: React.FC<{
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'dark' | 'ghost';
  icon?: IconName;
  disabled?: boolean;
  style?: ViewStyle;
  small?: boolean;
  testID?: string;
}> = ({ label, onPress, variant = 'primary', icon, disabled, style, small, testID }) => {
  const reducedMotion = useReducedMotion();
  const pressed = useSharedValue(0);
  const bg = variant === 'primary' ? COLORS.actionYellow : variant === 'dark' ? COLORS.deepOnyx : variant === 'ghost' ? 'transparent' : COLORS.canvasWhite;
  const fg = variant === 'dark' ? COLORS.canvasWhite : INK;
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
      ...(reducedMotion ? STAYS : {}),
    });
  }, [disabled, pressed, reducedMotion]);

  const handlePressOut = useCallback(() => {
    if (reducedMotion) {
      pressed.value = withTiming(0, {
        duration: BTN_PRESS.pressInMs,
        easing: EASE.ui,
        ...STAYS,
      });
    } else {
      pressed.value = withSpring(0, SPRING.snappy);
    }
  }, [pressed, reducedMotion]);

  const pressStyle = useAnimatedStyle(() => {
    if (reducedMotion) {
      const baseOpacity = disabled ? 0.45 : 1;
      const targetOpacity = disabled ? 0.45 : BTN_PRESS.reducedOpacity;
      return {
        opacity: baseOpacity + (targetOpacity - baseOpacity) * pressed.value,
        transform: [{ translateY: 0 }, { scale: 1 }],
      };
    }
    const scale = 1 - pressed.value * (1 - BTN_PRESS.scale);
    const translateY = pressed.value * pushY;
    return {
      transform: [{ translateY }, { scale }],
    };
  });

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        styles.btn,
        small && styles.btnSmall,
        {
          backgroundColor: bg,
          opacity: disabled ? 0.45 : 1,
          borderColor: variant === 'ghost' ? 'transparent' : INK,
        },
        style,
        pressStyle,
      ]}
    >
      {icon && <Icon name={icon} size={small ? 14 : 18} color={fg} />}
      <Text style={[styles.btnText, small && styles.btnTextSmall, { color: fg }]}>{label}</Text>
    </AnimatedPressable>
  );
};

export const StarRow: React.FC<{ stars: number; size?: number; max?: number; animateFrom?: number; color?: string }> = ({ stars, size = 18, max = 3, animateFrom, color = '#F5B800' }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {Array.from({ length: max }).map((_, i) => (
      <AnimatedStar key={i} filled={i < stars} size={size} delay={animateFrom !== undefined && i >= animateFrom && i < stars ? starPopDelayMs(i - animateFrom) : -1} color={color} />
    ))}
  </View>
);

const AnimatedStar: React.FC<{ filled: boolean; size: number; delay: number; color: string }> = ({ filled, size, delay, color }) => {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(delay >= 0 && !reducedMotion ? 0 : 1);
  const opacity = useSharedValue(delay >= 0 && reducedMotion ? 0 : 1);
  useEffect(() => {
    if (delay < 0) return;
    if (reducedMotion) {
      scale.value = 1;
      opacity.value = withDelay(
        delay,
        withTiming(1, { duration: reducedMs(MS.quick), easing: EASE.ui, ...STAYS }),
        STAYS.reduceMotion
      );
      return;
    }
    // one quick pop, no wobble
    scale.value = withDelay(
      delay,
      withSequence(
        withTiming(1.25, { duration: 140, easing: EASE.ui }),
        withTiming(1, { duration: MS.feedback, easing: EASE.drift })
      )
    );
  }, [delay, reducedMotion, scale, opacity]);
  useEffect(() => () => { cancelAnimation(scale); cancelAnimation(opacity); }, [scale, opacity]);
  const st = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale.value }] }));
  const glyph = { fontSize: size, lineHeight: size * 1.1, width: size * 1.05, textAlign: 'center' as const };
  return (
    <View style={{ width: size * 1.05, height: size * 1.1 }}>
      <Text style={[glyph, StyleSheet.absoluteFillObject, { color: '#D9D2C7' }]}>★</Text>
      {filled && (
        <Animated.Text style={[glyph, StyleSheet.absoluteFillObject, { color, textShadowColor: INK, textShadowRadius: size > 30 ? 2 : 0.5 }, st]}>★</Animated.Text>
      )}
    </View>
  );
};

/** Text heart — crisper than the icon set's heart at small sizes. */
export const Heart: React.FC<{ size?: number; filled?: boolean }> = ({ size = 16, filled = true }) => (
  <Text style={{ fontSize: size, lineHeight: size * 1.15, color: filled ? COLORS.impactRed : '#C9C2B8' }}>{filled ? '♥' : '♡'}</Text>
);

export const CoinPill: React.FC<{ coins: number; style?: ViewStyle; dark?: boolean; compact?: boolean }> = ({ coins, style, dark, compact }) => (
  <View style={[styles.pill, compact && styles.pillCompact, dark && { backgroundColor: COLORS.deepOnyx, borderColor: COLORS.deepOnyx }, style]}>
    <Icon name="lorc/crown-coin" size={compact ? 13 : 16} color="#E0A800" />
    <Text style={[styles.pillText, compact && styles.pillTextCompact, dark && { color: COLORS.canvasWhite }]}>{coins.toLocaleString()}</Text>
  </View>
);

export const Eyebrow: React.FC<{ text: string; color?: string }> = ({ text, color = COLORS.actionYellow }) => (
  <View style={[styles.eyebrow, { backgroundColor: color }]}>
    <Text style={styles.eyebrowText}>{text}</Text>
  </View>
);

/** Gentle bob for "play me next" nodes (reduced-motion & app-active gated, with phase desync). */
export const Bob: React.FC<{
  children: React.ReactNode;
  active?: boolean;
  amount?: number;
  /** Phase offset in radians (`0..2π`) so sibling map/spire nodes never bob in lockstep */
  phase?: number;
  /** Explicit start delay in ms (overrides `phase` when provided) */
  delayMs?: number;
  /** Full cycle duration in ms (default `1200`) */
  periodMs?: number;
}> = ({ children, active = true, amount = 4, phase = 0, delayMs, periodMs = 1200 }) => {
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();
  const y = useSharedValue(0);
  const running = active && appActive && !reducedMotion;

  useEffect(() => {
    if (running) {
      const safePeriod = Math.max(320, periodMs);
      const halfMs = Math.round(safePeriod / 2);
      const offsetMs =
        delayMs !== undefined
          ? Math.max(0, Math.round(delayMs))
          : phase !== 0
            ? Math.round(((((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2)) * safePeriod)
            : 0;
      const loop = withRepeat(
        withSequence(
          withTiming(-amount, { duration: halfMs, easing: EASE.drift }),
          withTiming(0, { duration: halfMs, easing: EASE.drift })
        ),
        -1
      );
      y.value = offsetMs > 0 ? withDelay(offsetMs, loop) : loop;
      return () => cancelAnimation(y);
    }
    cancelAnimation(y);
    y.value = 0;
  }, [running, amount, phase, delayMs, periodMs, y]);

  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={st}>{children}</Animated.View>;
};

/**
 * Pop-in wrapper with reduced-motion fade (`STAYS`, zero bounce) and optional `visible`
 * exit transition (`MODAL_MOTION.exitMs` / `EASE.exitSoft`).
 */
export const PopIn: React.FC<{
  children: React.ReactNode;
  delay?: number;
  /** Toggle to `false` to animate out cleanly with `EASE.exitSoft` (`exitMs`). Defaults to `true`. */
  visible?: boolean;
  /** Optional callback fired once the `visible={false}` exit transition finishes. */
  onExited?: () => void;
  style?: StyleProp<ViewStyle>;
}> = ({ children, delay = 0, visible = true, onExited, style }) => {
  const appActive = useAppActive();
  const reducedMotion = useReducedMotion();
  const s = useSharedValue(
    visible ? (!appActive || reducedMotion ? 1 : MODAL_MOTION.popInFromScale) : MODAL_MOTION.popOutToScale
  );
  const o = useSharedValue(!appActive && visible ? 1 : 0);

  useEffect(() => {
    if (!appActive) {
      cancelAnimation(s);
      cancelAnimation(o);
      s.value = 1;
      o.value = visible ? 1 : 0;
      if (!visible && onExited) onExited();
      return;
    }
    if (visible) {
      if (reducedMotion) {
        s.value = 1;
        const dur = reducedMs(MODAL_MOTION.enterMs);
        const fadeIn = withTiming(1, { duration: dur, easing: EASE.ui, ...STAYS });
        o.value = delay > 0 ? withDelay(delay, fadeIn, STAYS.reduceMotion) : fadeIn;
      } else {
        // Short ease-out, no overshoot: panels should appear, not bounce
        const scaleIn = withTiming(1, { duration: MODAL_MOTION.enterMs, easing: EASE.enter });
        const fadeIn = withTiming(1, {
          duration: Math.round(MODAL_MOTION.enterMs * 0.78),
          easing: EASE.ui,
        });
        s.value = delay > 0 ? withDelay(delay, scaleIn) : scaleIn;
        o.value = delay > 0 ? withDelay(delay, fadeIn) : fadeIn;
      }
      return;
    }

    const outDur = reducedMotion ? reducedMs(MODAL_MOTION.exitMs) : MODAL_MOTION.exitMs;
    if (reducedMotion) {
      s.value = 1;
      o.value = withTiming(0, { duration: outDur, easing: EASE.exitSoft, ...STAYS });
    } else {
      s.value = withTiming(MODAL_MOTION.popOutToScale, { duration: outDur, easing: EASE.exitSoft });
      o.value = withTiming(0, { duration: outDur, easing: EASE.exitSoft });
    }

    if (onExited) {
      const timer = setTimeout(onExited, outDur);
      return () => clearTimeout(timer);
    }
  }, [visible, delay, appActive, reducedMotion, onExited, s, o]);

  useEffect(() => () => {
    cancelAnimation(s);
    cancelAnimation(o);
  }, [s, o]);

  const st = useAnimatedStyle(() => ({
    opacity: o.value,
    transform: [{ scale: s.value }],
  }));

  return (
    <Animated.View style={[st, style]} pointerEvents={visible ? 'auto' : 'none'}>
      {children}
    </Animated.View>
  );
};

export const Skulls: React.FC<{ n: number; size?: number }> = ({ n, size = 14 }) => (
  <View style={{ flexDirection: 'row', gap: 2 }}>
    {Array.from({ length: 5 }).map((_, i) => (
      <Icon key={i} name="lorc/daemon-skull" size={size} color={i < n ? COLORS.impactRed : '#D9D2C7'} />
    ))}
  </View>
);

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 6,
    borderWidth: 2,
    borderBottomWidth: 4,
  },
  btnSmall: { paddingVertical: 6, paddingHorizontal: 10, borderBottomWidth: 3 },
  btnText: { fontFamily: DISPLAY_FONT, fontWeight: '800', fontSize: 15, letterSpacing: 1, textTransform: 'uppercase' },
  btnTextSmall: { fontSize: 12 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.canvasWhite,
    borderColor: INK,
    borderWidth: 2,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillCompact: {
    gap: 3,
    borderWidth: 1.5,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
  },
  pillText: { fontFamily: MONO_FONT, fontWeight: '800', color: INK, fontSize: 14, fontVariant: ['tabular-nums'] },
  pillTextCompact: { fontSize: 11, fontWeight: '900' },
  eyebrow: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4, borderWidth: 1.5, borderColor: INK },
  eyebrowText: { fontFamily: DISPLAY_FONT, fontWeight: '800', fontSize: 11, letterSpacing: 1.5, color: INK, textTransform: 'uppercase' },
});
