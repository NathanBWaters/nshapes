/**
 * The fight's Power (data/weaponPower.ts): the multiplier every hit is dealt
 * at, fed by the weapons' Scaling and by evolutions. It enters smoothly on mount,
 * pops with a crisp spring & golden sheen each time it climbs a tenth, and glows
 * hotter as it grows.
 */
import React, { useEffect, useRef } from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Icon from '@/components/Icon';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { COLORS } from '@/utils/colors';
import { ACCESSIBLE, EASE, MS, SPRING, STAYS } from '@/utils/motion';
import { formatPower, powerMultiplier } from '../data/weaponPower';
import { INK } from './ui';

/** Background by how far Power has climbed */
const heat = (m: number) => (m >= 10 ? '#FFB4A2' : m >= 5 ? '#FFD59E' : m >= 2 ? '#FFF1B8' : '#F3EEE4');

const PowerMeter: React.FC<{ points: number; onPress?: () => void }> = ({ points, onPress }) => {
  const reducedMotion = useReducedMotion();
  const m = powerMultiplier(points);
  const shown = Math.floor(m * 10);
  const last = useRef(shown);

  const opacity = useSharedValue(0);
  const pop = useSharedValue(reducedMotion ? 1 : 0.88);
  const sheen = useSharedValue(0);

  // Smooth mount entrance (eliminates single-frame POP-IN on first Power gain)
  useEffect(() => {
    if (reducedMotion) {
      pop.value = 1;
      opacity.value = withTiming(1, { duration: ACCESSIBLE.fadeMs, easing: EASE.ui, ...STAYS });
    } else {
      opacity.value = withTiming(1, { duration: MS.feedback, easing: EASE.ui });
      pop.value = withTiming(1, { duration: MS.quick, easing: EASE.popSoft });
    }
    return () => {
      cancelAnimation(opacity);
      cancelAnimation(pop);
      cancelAnimation(sheen);
    };
    // mount once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Climb pop each time Power advances a tenth
  useEffect(() => {
    if (shown > last.current) {
      cancelAnimation(pop);
      cancelAnimation(sheen);
      if (reducedMotion) {
        pop.value = 1;
        sheen.value = 0.4;
        sheen.value = withTiming(0, { duration: ACCESSIBLE.fadeMs, easing: EASE.exitSoft, ...STAYS });
      } else {
        pop.value = withSequence(
          withTiming(1.18, { duration: 80, easing: EASE.enter }),
          withSpring(1, SPRING.snappy)
        );
        sheen.value = 0.65;
        sheen.value = withTiming(0, { duration: MS.quick, easing: EASE.exitSoft });
      }
    }
    last.current = shown;
  }, [shown, reducedMotion, pop, sheen]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: pop.value }],
  }));
  const sheenStyle = useAnimatedStyle(() => ({
    opacity: sheen.value,
  }));

  const chip = (
    <Animated.View
      testID={onPress ? undefined : 'run-power'}
      accessibilityLabel={onPress ? undefined : `Power ${formatPower(points)}: every hit is multiplied by this`}
      style={[st.chip, { backgroundColor: heat(m) }, style]}
    >
      <Animated.View pointerEvents="none" style={[st.sheen, sheenStyle]} />
      <Icon name="lorc/power-lightning" size={11} color={m >= 5 ? COLORS.impactRed : INK} />
      <Text style={st.text}>POWER {formatPower(points)}</Text>
      {onPress && <Text style={st.hint}>?</Text>}
    </Animated.View>
  );
  if (!onPress) return chip;
  return (
    <TouchableOpacity
      testID="run-power"
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Power ${formatPower(points)}: tap to see what Power is and how your gear builds it`}
    >
      {chip}
    </TouchableOpacity>
  );
};

const st = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: INK,
    paddingHorizontal: 5,
    paddingVertical: 1,
    overflow: 'hidden',
  },
  sheen: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#FFFDF5',
  },
  text: { fontSize: 10, fontWeight: '900', color: INK, letterSpacing: 0.3, fontVariant: ['tabular-nums'] },
  hint: { fontSize: 9, fontWeight: '900', color: INK, opacity: 0.65, marginLeft: 1 },
});

export default PowerMeter;
