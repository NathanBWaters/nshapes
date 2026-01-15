import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Weapon } from '@/types';
import { COLORS, RADIUS, getRarityColor } from '@/utils/colors';
import Icon from './Icon';

interface WeaponListProps {
  weapons: Weapon[];
  title?: string;
  showDescription?: boolean;
  emptyMessage?: string;
}

/**
 * Reusable component to display a list of weapons with icons, names, and counts.
 * Groups duplicate weapons and shows count badges.
 */
const WeaponList: React.FC<WeaponListProps> = ({
  weapons,
  title,
  showDescription = true,
  emptyMessage = 'No weapons equipped',
}) => {
  // Group weapons by name+rarity for display
  const groupedWeapons = weapons.reduce(
    (acc, weapon) => {
      const key = `${weapon.name}-${weapon.rarity}`;
      if (!acc[key]) {
        acc[key] = { weapon, count: 0 };
      }
      acc[key].count++;
      return acc;
    },
    {} as Record<string, { weapon: Weapon; count: number }>
  );

  const sortedWeapons = Object.values(groupedWeapons).sort((a, b) =>
    a.weapon.name.localeCompare(b.weapon.name)
  );

  return (
    <View style={styles.container}>
      {title && (
        <View style={styles.header}>
          <Text style={styles.headerText}>
            {title}
            {weapons.length > 0 && ` (${weapons.length})`}
          </Text>
        </View>
      )}
      <View style={styles.content}>
        {sortedWeapons.length > 0 ? (
          sortedWeapons.map(({ weapon, count }) => (
            <View key={`${weapon.name}-${weapon.rarity}`} style={styles.weaponRow}>
              <View style={[styles.weaponIcon, { borderColor: getRarityColor(weapon.rarity) }]}>
                <Icon name={weapon.icon || 'lorc/field'} size={20} color={COLORS.slateCharcoal} />
              </View>
              <View style={styles.weaponInfo}>
                <View style={styles.weaponNameRow}>
                  <Text style={styles.weaponName}>{weapon.name}</Text>
                  {count > 1 && (
                    <View style={styles.countBadge}>
                      <Text style={styles.countText}>x{count}</Text>
                    </View>
                  )}
                </View>
                {showDescription && weapon.shortDescription && (
                  <Text style={styles.weaponDesc}>{weapon.shortDescription}</Text>
                )}
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>{emptyMessage}</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.module,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: COLORS.slateCharcoal,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
  },
  content: {
    padding: 12,
    gap: 8,
  },
  weaponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  weaponIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.button,
    backgroundColor: COLORS.paperBeige,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  weaponInfo: {
    flex: 1,
  },
  weaponNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  weaponName: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 13,
  },
  weaponDesc: {
    color: COLORS.slateCharcoal,
    fontSize: 11,
    opacity: 0.7,
    marginTop: 2,
  },
  countBadge: {
    backgroundColor: COLORS.logicTeal,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.button,
  },
  countText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 10,
  },
  emptyText: {
    color: COLORS.slateCharcoal,
    fontSize: 13,
    opacity: 0.6,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 4,
  },
});

export default WeaponList;
