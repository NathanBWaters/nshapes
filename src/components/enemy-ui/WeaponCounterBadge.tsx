import { MONO_FONT } from '@/utils/fonts';
/**
 * WeaponCounterBadge Component
 * Shows a weapon type with its reduction percentage.
 */
import React, { useEffect, useRef } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { COLORS, RADIUS } from '@/utils/colors';
import { EASE, MS, SCALE, SPRING, STAYS } from '@/utils/motion';
import Icon, { IconName } from '../Icon';

interface WeaponCounterBadgeProps {
  /** Type of weapon being countered */
  type: string;
  /** Reduction percentage (e.g., 15 means -15%) */
  reduction: number;
}

// Map weapon counter types to icons (using icons from the registry)
const COUNTER_ICONS: Record<string, IconName> = {
  fire: 'lorc/campfire',
  explosion: 'lorc/bright-explosion',
  laser: 'lorc/laser-warning',
  hint: 'lorc/light-bulb',
  grace: 'lorc/clover',
  time: 'lorc/stopwatch',
  healing: 'lorc/shining-heart',
};

const WeaponCounterBadge: React.FC<WeaponCounterBadgeProps> = ({ type, reduction }) => {
  const iconName = COUNTER_ICONS[type] || 'lorc/uncertainty';
  const reducedMotion = Boolean(useReducedMotion());
  const opacity = useSharedValue(0);
  const scale = useSharedValue(reducedMotion ? 1 : 0.9);
  const prevReductionRef = useRef(reduction);

  useEffect(() => {
    opacity.value = withTiming(1, { duration: MS.quick, easing: EASE.ui, ...STAYS });
    if (!reducedMotion) {
      scale.value = withTiming(1, { duration: MS.quick, easing: EASE.popSoft });
    } else {
      scale.value = 1;
    }
    return () => {
      cancelAnimation(opacity);
      cancelAnimation(scale);
    };
  }, [opacity, scale, reducedMotion]);

  useEffect(() => {
    if (prevReductionRef.current === reduction) return;
    prevReductionRef.current = reduction;
    if (reducedMotion) return;
    scale.value = withSequence(
      withTiming(SCALE.pop, { duration: Math.round(MS.feedback * 0.5), easing: EASE.popSoft }),
      withSpring(1, SPRING.snappy)
    );
  }, [reduction, scale, reducedMotion]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.container, animStyle]}>
      <Icon name={iconName} size={14} color={COLORS.impactRed} />
      <Text style={styles.text}>-{reduction}%</Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    backgroundColor: 'rgba(255, 113, 105, 0.15)',
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderBottomWidth: 2,
    borderColor: 'rgba(255, 113, 105, 0.55)',
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: MONO_FONT,
    fontVariant: ['tabular-nums'],
    color: COLORS.impactRed,
  },
});

export default WeaponCounterBadge;
