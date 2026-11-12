/**
 * Big-number feedback for a fight: damage floaters that grow with the hit,
 * a flash for MEGA hits, the evolution banner and evolution countdown rings.
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, withDelay, Easing } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import Icon, { IconName } from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import { DARK, INK, TONE } from './ui';

/** 0 normal · 1 big (≥10) · 2 huge (≥25, screen shake) · 3 MEGA (≥50, flash) */
export type HitTier = 0 | 1 | 2 | 3;

export const HIT_TIERS = { big: 10, huge: 25, mega: 50 } as const;

export const hitTier = (amount: number): HitTier =>
  amount >= HIT_TIERS.mega ? 3 : amount >= HIT_TIERS.huge ? 2 : amount >= HIT_TIERS.big ? 1 : 0;

const FLOATER_SIZE: Record<HitTier, number> = { 0: 20, 1: 28, 2: 36, 3: 46 };

export interface FloaterSpec {
  id: number;
  text: string;
  color: string;
  tier: HitTier;
  /** Horizontal offset so a burst of floaters does not stack on one spot */
  dx: number;
}

export const Floater: React.FC<{ spec: FloaterSpec }> = ({ spec }) => {
  const y = useSharedValue(0);
  const o = useSharedValue(1);
  const s = useSharedValue(spec.tier > 0 ? 0.6 : 1);
  useEffect(() => {
    const rise = 46 + spec.tier * 10;
    const hold = 600 + spec.tier * 200;
    y.value = withTiming(-rise, { duration: hold + 400, easing: Easing.out(Easing.cubic) });
    o.value = withSequence(withTiming(1, { duration: hold }), withTiming(0, { duration: 400 }));
    if (spec.tier > 0) s.value = withSequence(withTiming(1.25, { duration: 120, easing: Easing.out(Easing.back(2)) }), withTiming(1, { duration: 160 }));
  }, [y, o, s, spec.tier]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }, { scale: s.value }], opacity: o.value }));
  return (
    <Animated.Text
      testID={`floater-tier-${spec.tier}`}
      style={[
        st.floater,
        { color: spec.color, fontSize: FLOATER_SIZE[spec.tier], left: spec.dx },
        spec.tier >= 2 && st.floaterHeavy,
        style,
      ]}
    >
      {spec.text}
    </Animated.Text>
  );
};

/** A full-screen white flash for MEGA hits. `trigger` changes to fire it. */
export const MegaFlash: React.FC<{ trigger: number }> = ({ trigger }) => {
  const o = useSharedValue(0);
  useEffect(() => {
    if (trigger > 0) o.value = withSequence(withTiming(0.85, { duration: 60 }), withTiming(0, { duration: 420, easing: Easing.out(Easing.quad) }));
  }, [trigger, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, st.flash, style]} />;
};

/** Full-width banner when an evolution starts. */
export const EvolutionBanner: React.FC<{ name: string; icon: IconName; text: string; seq: number }> = ({ name, icon, text, seq }) => {
  const x = useSharedValue(-40);
  const o = useSharedValue(0);
  useEffect(() => {
    x.value = -40;
    o.value = 0;
    x.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.cubic) });
    o.value = withSequence(withTiming(1, { duration: 160 }), withDelay(2000, withTiming(0, { duration: 400 })));
  }, [seq, x, o]);
  const style = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateX: x.value }] }));
  return (
    <Animated.View pointerEvents="none" style={[st.banner, style]} testID="evolution-banner">
      <View style={st.bannerIcon}><Icon name={icon} size={30} color={INK} /></View>
      <View style={{ flex: 1 }}>
        <Text style={st.bannerEyebrow}>EVOLUTION · 20 SECONDS</Text>
        <Text style={st.bannerName}>{name}!</Text>
        <Text style={st.bannerText} numberOfLines={2}>{text}</Text>
      </View>
    </Animated.View>
  );
};

/** One active evolution: its icon inside a ring that empties as the time runs out. */
export const EvolutionRing: React.FC<{ icon: IconName; name: string; remainingMs: number; durationMs: number }> = ({ icon, name, remainingMs, durationMs }) => {
  const size = 34;
  const r = 14;
  const c = 2 * Math.PI * r;
  const frac = durationMs > 0 ? Math.max(0, Math.min(1, remainingMs / durationMs)) : 0;
  const secs = Math.ceil(remainingMs / 1000);
  return (
    <View style={st.ring} accessibilityLabel={`${name} evolution, ${secs} seconds left`} testID="evolution-ring">
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#E9D5FF" strokeWidth={4} fill={COLORS.canvasWhite} />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={secs <= 5 ? COLORS.impactRed : TONE.evoReady}
          strokeWidth={4}
          fill="none"
          strokeDasharray={`${c * frac} ${c}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Icon name={icon} size={14} color={INK} />
      <Text style={st.ringSecs}>{secs}</Text>
    </View>
  );
};

const st = StyleSheet.create({
  floater: { position: 'absolute', fontWeight: '900', textShadowColor: '#FFF', textShadowRadius: 4 },
  floaterHeavy: { textShadowColor: INK, textShadowRadius: 2, letterSpacing: 1 },
  flash: { backgroundColor: '#FFFFFF', zIndex: 400 },
  banner: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 250,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: DARK.panel,
    borderTopWidth: 3,
    borderBottomWidth: 3,
    borderColor: COLORS.actionYellow,
  },
  bannerIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.actionYellow, alignItems: 'center', justifyContent: 'center' },
  bannerEyebrow: { color: COLORS.actionYellow, fontWeight: '900', letterSpacing: 2, fontSize: 10 },
  bannerName: { color: COLORS.canvasWhite, fontWeight: '900', fontSize: 22 },
  bannerText: { color: DARK.text, fontSize: 12 },
  ring: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  ringSecs: { position: 'absolute', bottom: -6, fontSize: 9, fontWeight: '900', color: INK, backgroundColor: COLORS.canvasWhite, borderRadius: 4, paddingHorizontal: 2, overflow: 'hidden' },
});
