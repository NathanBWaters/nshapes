/**
 * ScoreDecayIndicator Component
 * Shows a badge indicating score is decaying per second.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';
import Icon from '../Icon';

interface ScoreDecayIndicatorProps {
  /** Points lost per second */
  rate: number;
}

const ScoreDecayIndicator: React.FC<ScoreDecayIndicatorProps> = ({ rate }) => {
  return (
    <View style={styles.container}>
      <Icon name="lorc/fist" size={14} color={COLORS.impactRed} />
      <Text style={styles.text}>-{rate}/s</Text>
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
    backgroundColor: 'rgba(255, 113, 105, 0.2)',
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.impactRed,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: COLORS.impactRed,
  },
});

export default ScoreDecayIndicator;
