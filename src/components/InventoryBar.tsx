import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Weapon, WeaponRarity } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import Icon from './Icon';

interface InventoryBarProps {
  weapons: Weapon[];
}

// Group weapons by name and rarity, counting duplicates
interface WeaponGroup {
  weapon: Weapon;
  count: number;
}

const getRarityColor = (rarity: WeaponRarity): string => {
  switch (rarity) {
    case 'common': return COLORS.slateCharcoal;
    case 'rare': return '#1976D2'; // Blue
    case 'legendary': return COLORS.impactOrange;
    default: return COLORS.slateCharcoal;
  }
};

const InventoryBar: React.FC<InventoryBarProps> = ({ weapons }) => {
  // Group weapons by name + rarity
  const groupedWeapons = weapons.reduce<WeaponGroup[]>((groups, weapon) => {
    const key = `${weapon.name}-${weapon.rarity}`;
    const existing = groups.find(g => `${g.weapon.name}-${g.weapon.rarity}` === key);
    if (existing) {
      existing.count++;
    } else {
      groups.push({ weapon, count: 1 });
    }
    return groups;
  }, []);

  // Sort by rarity (legendary first, then rare, then common)
  const rarityOrder: Record<WeaponRarity, number> = { legendary: 0, rare: 1, common: 2 };
  groupedWeapons.sort((a, b) =>
    rarityOrder[a.weapon.rarity] - rarityOrder[b.weapon.rarity]
  );

  if (weapons.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Inventory</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No items yet</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inventory</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {groupedWeapons.map((group, index) => {
          const { weapon, count } = group;
          const rarityColor = getRarityColor(weapon.rarity);

          return (
            <View
              key={`${weapon.id}-${index}`}
              style={[styles.itemContainer, { borderColor: rarityColor }]}
            >
              {weapon.icon && (
                <Icon name={weapon.icon} size={16} color={COLORS.slateCharcoal} />
              )}
              <Text style={styles.itemName} numberOfLines={1}>
                {weapon.name}
              </Text>
              {count > 1 && (
                <View style={[styles.countBadge, { backgroundColor: rarityColor }]}>
                  <Text style={styles.countText}>{count}</Text>
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: 52,
    backgroundColor: COLORS.paperBeige,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
  },
  title: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginRight: 12,
  },
  scrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 12,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.canvasWhite,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    gap: 4,
  },
  itemName: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 10,
    maxWidth: 80,
  },
  countBadge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  countText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 9,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyText: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 11,
    opacity: 0.6,
    fontStyle: 'italic',
  },
});

export default InventoryBar;
