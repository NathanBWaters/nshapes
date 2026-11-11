/** Small shared UI primitives for Adventure screens (Retro-Modern style guide). */
import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle, TextStyle, StyleProp } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withSequence, withTiming, withDelay, withSpring, Easing } from 'react-native-reanimated';
import Icon, { IconName } from '@/components/Icon';
import { COLORS } from '@/utils/colors';

export const INK = COLORS.slateCharcoal;

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
      <AnimatedStar key={i} filled={i < stars} size={size} delay={animateFrom !== undefined && i >= animateFrom && i < stars ? 350 + (i - animateFrom) * 450 : -1} color={color} />
    ))}
  </View>
);

const AnimatedStar: React.FC<{ filled: boolean; size: number; delay: number; color: string }> = ({ filled, size, delay, color }) => {
  const scale = useSharedValue(delay >= 0 ? 0 : 1);
  useEffect(() => {
    if (delay >= 0) scale.value = withDelay(delay, withSequence(withSpring(1.5, { damping: 6 }), withSpring(1)));
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

export const CoinPill: React.FC<{ coins: number; style?: ViewStyle; dark?: boolean }> = ({ coins, style, dark }) => (
  <View style={[styles.pill, dark && { backgroundColor: COLORS.deepOnyx, borderColor: COLORS.deepOnyx }, style]}>
    <Icon name="lorc/crown-coin" size={16} color="#E0A800" />
    <Text style={[styles.pillText, dark && { color: COLORS.canvasWhite }]}>{coins.toLocaleString()}</Text>
  </View>
);

export const Pill: React.FC<{ icon: IconName; text: string; color?: string; style?: ViewStyle; textStyle?: TextStyle }> = ({ icon, text, color = INK, style, textStyle }) => (
  <View style={[styles.pill, style]}>
    <Icon name={icon} size={14} color={color} />
    <Text style={[styles.pillText, textStyle]}>{text}</Text>
  </View>
);

export const Eyebrow: React.FC<{ text: string; color?: string }> = ({ text, color = COLORS.actionYellow }) => (
  <View style={[styles.eyebrow, { backgroundColor: color }]}>
    <Text style={styles.eyebrowText}>{text}</Text>
  </View>
);

/** Gentle bob for "play me next" nodes. */
export const Bob: React.FC<{ children: React.ReactNode; active?: boolean; amount?: number }> = ({ children, active = true, amount = 4 }) => {
  const y = useSharedValue(0);
  useEffect(() => {
    if (active) y.value = withRepeat(withSequence(withTiming(-amount, { duration: 600, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 600, easing: Easing.inOut(Easing.sin) })), -1);
    else y.value = 0;
  }, [active, amount, y]);
  const st = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return <Animated.View style={st}>{children}</Animated.View>;
};

/** Pop-in wrapper. */
export const PopIn: React.FC<{ children: React.ReactNode; delay?: number; style?: StyleProp<ViewStyle> }> = ({ children, delay = 0, style }) => {
  const s = useSharedValue(0.6);
  const o = useSharedValue(0);
  useEffect(() => {
    s.value = withDelay(delay, withSpring(1, { damping: 10 }));
    o.value = withDelay(delay, withTiming(1, { duration: 180 }));
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

export const styles = StyleSheet.create({
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
  pillText: { fontWeight: '800', color: INK, fontSize: 14, fontVariant: ['tabular-nums'] },
  eyebrow: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 3, borderWidth: 1.5, borderColor: INK },
  eyebrowText: { fontWeight: '800', fontSize: 11, letterSpacing: 1.5, color: INK, textTransform: 'uppercase' },
});
