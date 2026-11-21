/** Small shared UI primitives for Adventure screens (Retro-Modern style guide). */
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withDelay, cancelAnimation, Easing } from 'react-native-reanimated';
import Icon, { IconName } from '@/components/Icon';
import { useAppActive } from '@/hooks/useAppActive';
import { COLORS } from '@/utils/colors';
import { MS } from '@/utils/motion';

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
  /** Text on the dark Camp and Bounty Board backdrops */
  onDusk: '#E9DCCB',
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
export const starsLandedMs = (stars: number): number => (stars > 0 ? starLandMs(stars - 1) + 450 : 600);

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
  const bg = variant === 'primary' ? COLORS.actionYellow : variant === 'dark' ? COLORS.deepOnyx : variant === 'ghost' ? 'transparent' : COLORS.canvasWhite;
  const fg = variant === 'dark' ? COLORS.canvasWhite : INK;
  return (
    <TouchableOpacity
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[styles.btn, small && styles.btnSmall, { backgroundColor: bg, opacity: disabled ? 0.45 : 1, borderColor: variant === 'ghost' ? 'transparent' : INK }, style]}
    >
      {icon && <Icon name={icon} size={small ? 14 : 18} color={fg} />}
      <Text style={[styles.btnText, small && styles.btnTextSmall, { color: fg }]}>{label}</Text>
    </TouchableOpacity>
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
  const scale = useSharedValue(delay >= 0 ? 0 : 1);
  useEffect(() => {
    // one quick pop, no wobble
    if (delay >= 0) scale.value = withDelay(delay, withSequence(withTiming(1.25, { duration: 140, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: 120, easing: Easing.inOut(Easing.quad) })));
  }, [delay, scale]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
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

/** Gentle bob for "play me next" nodes. */
export const Bob: React.FC<{ children: React.ReactNode; active?: boolean; amount?: number }> = ({ children, active = true, amount = 4 }) => {
  const appActive = useAppActive();
  const y = useSharedValue(0);
  const running = active && appActive;
  useEffect(() => {
    if (running) {
      y.value = withRepeat(
        withSequence(
          withTiming(-amount, { duration: 600, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 600, easing: Easing.inOut(Easing.sin) })
        ),
        -1
      );
      return () => cancelAnimation(y);
    }
    cancelAnimation(y);
    y.value = 0;
  }, [running, amount, y]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={st}>{children}</Animated.View>;
};

/** Pop-in wrapper. */
export const PopIn: React.FC<{ children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }> = ({ children, delay = 0, style }) => {
  const s = useSharedValue(0.94);
  const o = useSharedValue(0);
  useEffect(() => {
    // Short ease-out, no overshoot: panels should appear, not bounce
    s.value = withDelay(delay, withTiming(1, { duration: 180, easing: Easing.out(Easing.cubic) }));
    o.value = withDelay(delay, withTiming(1, { duration: 140 }));
  }, [delay, s, o]);
  const st = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: s.value }] }));
  return <Animated.View style={[st, style]}>{children}</Animated.View>;
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
  btnText: { fontWeight: '800', fontSize: 15, letterSpacing: 1, textTransform: 'uppercase' },
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
  pillText: { fontWeight: '800', color: INK, fontSize: 14, fontVariant: ['tabular-nums'] },
  pillTextCompact: { fontSize: 11, fontWeight: '900' },
  eyebrow: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3, borderWidth: 1.5, borderColor: INK },
  eyebrowText: { fontWeight: '800', fontSize: 11, letterSpacing: 1.5, color: INK, textTransform: 'uppercase' },
});
