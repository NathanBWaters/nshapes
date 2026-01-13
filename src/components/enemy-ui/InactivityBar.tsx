/**
 * InactivityBar Component
 * Shows a progress bar that fills up as the player remains inactive.
 * Color changes near max, shows death icon for instant death penalty.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';
import Icon from '../Icon';

interface InactivityBarProps {
  /** Current time since last match in milliseconds */
  current: number;
  /** Maximum time before penalty in milliseconds */
  max: number;
  /** Type of penalty when bar fills */
  penalty: 'damage' | 'death';
}

const InactivityBar: React.FC<InactivityBarProps> = ({ current, max, penalty }) => {
  // Calculate fill percentage (0-100)
  const fillPercent = Math.min(100, (current / max) * 100);

  // Determine color based on fill level
  const isWarning = fillPercent >= 70;
  const isDanger = fillPercent >= 90;

  const getBarColor = () => {
    if (isDanger) return COLORS.impactRed;
    if (isWarning) return COLORS.impactOrange;
    return COLORS.logicTeal;
  };

  // Calculate remaining seconds
  const remainingSeconds = Math.max(0, Math.ceil((max - current) / 1000));

  return (
    <View style={styles.container}>
      {/* Icon indicating penalty type */}
      <View style={styles.iconContainer}>
        <Icon
          name={penalty === 'death' ? 'lorc/fist' : 'lorc/heart-inside'}
          size={16}
          color={isDanger ? COLORS.impactRed : COLORS.slateCharcoal}
        />
      </View>

      {/* Progress bar */}
      <View style={styles.barContainer}>
        <View
          style={[
            styles.barFill,
            {
              width: `${fillPercent}%`,
              backgroundColor: getBarColor(),
            },
          ]}
        />
      </View>

      {/* Timer text */}
      <Text style={[styles.timerText, isDanger && styles.timerTextDanger]}>
        {remainingSeconds}s
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  iconContainer: {
    width: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  barContainer: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.paperBeige,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  timerText: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: COLORS.slateCharcoal,
    minWidth: 24,
    textAlign: 'right',
  },
  timerTextDanger: {
    color: COLORS.impactRed,
  },
});

export default InactivityBar;
