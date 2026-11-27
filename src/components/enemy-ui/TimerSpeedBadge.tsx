import { MONO_FONT } from '@/utils/fonts';
/**
 * TimerSpeedBadge Component
 * Shows the timer speed multiplier when != 1.
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
import Icon from '../Icon';

interface TimerSpeedBadgeProps {
  /** Timer speed multiplier (e.g., 1.2 means 20% faster) */
  multiplier: number;
}

const TimerSpeedBadge: React.FC<TimerSpeedBadgeProps> = ({ multiplier }) => {
  const isActive = Math.abs(multiplier - 1) >= 0.01;
  const reducedMotion = Boolean(useReducedMotion());
  const opacity = useSharedValue(isActive ? 0 : 0);
  const scale = useSharedValue(reducedMotion ? 1 : 0.9);
  const prevMultiplierRef = useRef(multiplier);

  useEffect(() => {
    if (!isActive) {
      cancelAnimation(opacity);
      cancelAnimation(scale);
      opacity.value = 0;
      scale.value = reducedMotion ? 1 : 0.9;
      return;
    }
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
  }, [isActive, opacity, scale, reducedMotion]);

  useEffect(() => {
    if (prevMultiplierRef.current === multiplier) return;
    prevMultiplierRef.current = multiplier;
    if (!isActive || reducedMotion) return;
    scale.value = withSequence(
      withTiming(SCALE.pop, { duration: Math.round(MS.feedback * 0.5), easing: EASE.popSoft }),
      withSpring(1, SPRING.snappy)
    );
  }, [multiplier, isActive, scale, reducedMotion]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  // Don't render if multiplier is effectively 1
  if (!isActive) {
    return null;
  }

  const isFaster = multiplier > 1;
  const displayValue = multiplier.toFixed(1);

  return (
    <Animated.View style={[styles.container, isFaster ? styles.containerFast : styles.containerSlow, animStyle]}>
      <Icon
        name={isFaster ? 'lorc/stopwatch' : 'lorc/hourglass'}
        size={14}
        color={isFaster ? COLORS.impactOrange : COLORS.logicTeal}
      />
      <Text style={[styles.text, isFaster ? styles.textFast : styles.textSlow]}>
        {displayValue}x
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderBottomWidth: 2,
  },
  containerFast: {
    backgroundColor: 'rgba(255, 149, 56, 0.2)',
    borderColor: COLORS.impactOrange,
  },
  containerSlow: {
    backgroundColor: 'rgba(22, 170, 152, 0.2)',
    borderColor: COLORS.logicTeal,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: MONO_FONT,
    fontVariant: ['tabular-nums'],
  },
  textFast: {
    color: COLORS.impactOrange,
  },
  textSlow: {
    color: COLORS.logicTeal,
  },
});

export default TimerSpeedBadge;
