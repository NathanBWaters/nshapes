/**
 * TimerSpeedBadge Component
 * Shows the timer speed multiplier when != 1.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';
import Icon from '../Icon';

interface TimerSpeedBadgeProps {
  /** Timer speed multiplier (e.g., 1.2 means 20% faster) */
  multiplier: number;
}

const TimerSpeedBadge: React.FC<TimerSpeedBadgeProps> = ({ multiplier }) => {
  // Don't render if multiplier is effectively 1
  if (Math.abs(multiplier - 1) < 0.01) {
    return null;
  }

  const isFaster = multiplier > 1;
  const displayValue = multiplier.toFixed(1);

  return (
    <View style={[styles.container, isFaster ? styles.containerFast : styles.containerSlow]}>
      <Icon
        name={isFaster ? 'lorc/stopwatch' : 'lorc/hourglass'}
        size={14}
        color={isFaster ? COLORS.impactOrange : COLORS.logicTeal}
      />
      <Text style={[styles.text, isFaster ? styles.textFast : styles.textSlow]}>
        {displayValue}x
      </Text>
    </View>
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
    fontFamily: 'monospace',
  },
  textFast: {
    color: COLORS.impactOrange,
  },
  textSlow: {
    color: COLORS.logicTeal,
  },
});

export default TimerSpeedBadge;
