/**
 * The fight's Power (data/weaponPower.ts): the multiplier every hit is dealt
 * at, fed by the weapons' Scaling and by evolutions. It pops each time it
 * climbs a tenth, and glows hotter as it grows.
 */
import React, { useEffect, useRef } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSequence, withTiming, Easing } from 'react-native-reanimated';
import Icon from '@/components/Icon';
import { COLORS } from '@/utils/colors';
import { formatPower, powerMultiplier } from '../data/weaponPower';
import { INK } from './ui';

/** Background by how far Power has climbed */
const heat = (m: number) => (m >= 10 ? '#FFB4A2' : m >= 5 ? '#FFD59E' : m >= 2 ? '#FFF1B8' : '#F3EEE4');

const PowerMeter: React.FC<{ points: number }> = ({ points }) => {
  const m = powerMultiplier(points);
  const shown = Math.floor(m * 10);
  const last = useRef(shown);
  const pop = useSharedValue(1);
  useEffect(() => {
    if (shown > last.current) {
      pop.value = withSequence(withTiming(1.25, { duration: 90, easing: Easing.out(Easing.quad) }), withTiming(1, { duration: 220 }));
    }
    last.current = shown;
  }, [shown, pop]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <Animated.View
      testID="run-power"
      accessibilityLabel={`Power ${formatPower(points)}: every hit is multiplied by this`}
      style={[st.chip, { backgroundColor: heat(m) }, style]}
    >
      <Icon name="lorc/power-lightning" size={11} color={m >= 5 ? COLORS.impactRed : INK} />
      <Text style={st.text}>POWER {formatPower(points)}</Text>
    </Animated.View>
  );
};

const st = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 5, borderWidth: 1.5, borderColor: INK, paddingHorizontal: 5, paddingVertical: 1 },
  text: { fontSize: 10, fontWeight: '900', color: INK, letterSpacing: 0.3, fontVariant: ['tabular-nums'] },
});

export default PowerMeter;
