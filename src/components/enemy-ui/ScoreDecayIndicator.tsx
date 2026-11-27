import { MONO_FONT } from '@/utils/fonts';
/**
 * ScoreDecayIndicator Component
 * Shows a badge indicating score is decaying per second.
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

interface ScoreDecayIndicatorProps {
  /** Points lost per second */
  rate: number;
}

const ScoreDecayIndicator: React.FC<ScoreDecayIndicatorProps> = ({ rate }) => {
  const reducedMotion = Boolean(useReducedMotion());
  const opacity = useSharedValue(0);
  const scale = useSharedValue(reducedMotion ? 1 : 0.9);
  const prevRateRef = useRef(rate);

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
    if (prevRateRef.current === rate) return;
    prevRateRef.current = rate;
    if (reducedMotion) return;
    scale.value = withSequence(
      withTiming(SCALE.pop, { duration: Math.round(MS.feedback * 0.5), easing: EASE.popSoft }),
      withSpring(1, SPRING.snappy)
    );
  }, [rate, scale, reducedMotion]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.container, animStyle]}>
      <Icon name="lorc/fist" size={14} color={COLORS.impactRed} />
      <Text style={styles.text}>-{rate}/s</Text>
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
    backgroundColor: 'rgba(255, 113, 105, 0.2)',
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderBottomWidth: 2,
    borderColor: COLORS.impactRed,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: MONO_FONT,
    fontVariant: ['tabular-nums'],
    color: COLORS.impactRed,
  },
});

export default ScoreDecayIndicator;
