/**
 * WeaponCounterBadge Component
 * Shows a weapon type with its reduction percentage.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS } from '@/utils/colors';
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

  return (
    <View style={styles.container}>
      <Icon name={iconName} size={14} color={COLORS.impactRed} />
      <Text style={styles.text}>-{reduction}%</Text>
    </View>
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
    borderColor: 'rgba(255, 113, 105, 0.5)',
  },
  text: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: COLORS.impactRed,
  },
});

export default WeaponCounterBadge;
