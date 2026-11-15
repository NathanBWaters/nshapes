import React, { useEffect, useRef } from 'react';
import { Text, TextStyle, StyleSheet, Platform } from 'react-native';
import {
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useAppActive } from '@/hooks/useAppActive';
import { DURATION } from '@/utils/animation';

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  style?: TextStyle;
  decimalPlaces?: number;
}

export function AnimatedCounter({
  value,
  duration = DURATION.slower,
  prefix = '',
  suffix = '',
  style,
  decimalPlaces = 0,
}: AnimatedCounterProps) {
  const appActive = useAppActive();
  const animatedValue = useSharedValue(0);
  const previousValue = useRef(0);

  useEffect(() => {
    if (!appActive) {
      animatedValue.value = value;
      previousValue.current = value;
      return;
    }
    animatedValue.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.exp),
    });
    previousValue.current = value;
  }, [appActive, value, duration, animatedValue]);

  // For simpler implementation, we'll use state-based updates
  const [displayValue, setDisplayValue] = React.useState(0);

  useEffect(() => {
    if (!appActive) {
      setDisplayValue(value);
      previousValue.current = value;
      return;
    }
    let rafId = 0;
    let cancelled = false;
    const startValue = previousValue.current;
    const endValue = value;
    const startTime = Date.now();

    const animate = () => {
      if (cancelled) return;
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const eased = 1 - Math.pow(2, -10 * progress);

      const currentValue = startValue + (endValue - startValue) * eased;
      setDisplayValue(currentValue);

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        previousValue.current = endValue;
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => {
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [appActive, value, duration]);

  const formattedValue =
    decimalPlaces > 0
      ? displayValue.toFixed(decimalPlaces)
      : Math.round(displayValue).toString();

  return (
    <Text style={[styles.counter, style]}>
      {prefix}
      {formattedValue}
      {suffix}
    </Text>
  );
}

const styles = StyleSheet.create({
  counter: {
    fontVariant: ['tabular-nums'],
    fontFamily: Platform.select({
      ios: 'Menlo',
      android: 'monospace',
      default: 'monospace',
    }),
    fontSize: 24,
    fontWeight: '700',
    color: '#383838',
  },
});
