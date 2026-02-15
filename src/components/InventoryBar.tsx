import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Weapon, FusionWeapon, PlayerInventory, WeaponRarity } from '@/types';
import { COLORS, RADIUS, getRarityColor } from '@/utils/colors';
import Icon, { IconName } from './Icon';

interface InventoryBarProps {
  /** Legacy: array of weapons (backward compatibility) */
  weapons?: Weapon[];
  /** New: PlayerInventory with separate weapon and passive slots */
  inventory?: PlayerInventory;
}

// =============================================================================
// Slot Component for new inventory system
// =============================================================================

interface InventorySlotProps {
  item: FusionWeapon | null;
  slotType: 'weapon' | 'passive';
}

function InventorySlot({ item, slotType }: InventorySlotProps) {
  if (!item) {
    // Empty slot placeholder
    return (
      <View style={[styles.slot, styles.slotEmpty]}>
        <Icon
          name={slotType === 'weapon' ? 'lorc/crossed-swords' : 'lorc/checked-shield'}
          size={14}
          color={COLORS.slateCharcoal}
          style={{ opacity: 0.3 }}
        />
      </View>
    );
  }

  // Determine border color based on fusion tier
  const getBorderColor = () => {
    if (item.fusionTier === 2) return COLORS.rarityLegendary;
    if (item.fusionTier === 1) return COLORS.rarityEpic;
    return COLORS.slateCharcoal;
  };

  // Determine border width
  const getBorderWidth = () => {
    if (item.fusionTier === 2) return 2;
    if (item.fusionTier === 1) return 2;
    return 1;
  };

  // Level indicator text
  const getLevelText = () => {
    const levels = ['I', 'II', 'III'];
    return levels[item.level - 1] || item.level.toString();
  };

  return (
    <View
      style={[
        styles.slot,
        styles.slotFilled,
        {
          borderColor: getBorderColor(),
          borderWidth: getBorderWidth(),
        },
        item.fusionTier === 2 && styles.slotTier2,
      ]}
    >
      {item.icon && (
        <Icon name={item.icon} size={16} color={COLORS.slateCharcoal} />
      )}
      <View style={[styles.levelBadge, item.fusionTier === 2 && styles.levelBadgeTier2]}>
        <Text style={[styles.levelText, item.fusionTier === 2 && styles.levelTextTier2]}>
          {getLevelText()}
        </Text>
      </View>
    </View>
  );
}

// =============================================================================
// Legacy Weapon Item (backward compatibility)
// =============================================================================

interface WeaponGroup {
  weapon: Weapon;
  count: number;
}

interface WeaponItemProps {
  weapon: Weapon;
  count: number;
  rarityColor: string;
}

function WeaponItem({ weapon, count, rarityColor }: WeaponItemProps) {
  return (
    <View
      style={[
        styles.itemContainer,
        { borderColor: rarityColor },
      ]}
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
}

// =============================================================================
// Main Component
// =============================================================================

const InventoryBar: React.FC<InventoryBarProps> = ({ weapons, inventory }) => {
  // New inventory system
  if (inventory) {
    return (
      <View style={styles.container} testID="weapon-inventory">
        <Text style={styles.title}>Inventory</Text>
        <View style={styles.slotsContainer}>
          {/* Weapon Slots */}
          <View style={styles.slotGroup}>
            <Text style={styles.slotGroupLabel}>Weapons</Text>
            <View style={styles.slotRow}>
              {inventory.weapons.map((item, index) => (
                <InventorySlot
                  key={`weapon-${index}`}
                  item={item}
                  slotType="weapon"
                />
              ))}
            </View>
          </View>

          {/* Separator */}
          <View style={styles.separator} />

          {/* Passive Slots */}
          <View style={styles.slotGroup}>
            <Text style={styles.slotGroupLabel}>Passives</Text>
            <View style={styles.slotRow}>
              {inventory.passives.map((item, index) => (
                <InventorySlot
                  key={`passive-${index}`}
                  item={item}
                  slotType="passive"
                />
              ))}
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Legacy weapons array (backward compatibility)
  if (!weapons || weapons.length === 0) {
    return (
      <View style={styles.container} testID="weapon-inventory">
        <Text style={styles.title}>Inventory</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No items yet</Text>
        </View>
      </View>
    );
  }

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

  // Sort by rarity (legendary first, then epic, then rare, then common)
  const rarityOrder: Record<WeaponRarity, number> = { legendary: 0, epic: 1, rare: 2, common: 3 };
  groupedWeapons.sort((a, b) =>
    rarityOrder[a.weapon.rarity] - rarityOrder[b.weapon.rarity]
  );

  return (
    <View style={styles.container} testID="weapon-inventory">
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
            <WeaponItem
              key={`${weapon.id}-${index}`}
              weapon={weapon}
              count={count}
              rarityColor={rarityColor}
            />
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    minHeight: 52,
    backgroundColor: COLORS.paperBeige,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
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
  // New inventory styles
  slotsContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slotGroup: {
    alignItems: 'center',
    gap: 2,
  },
  slotGroupLabel: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.6,
  },
  slotRow: {
    flexDirection: 'row',
    gap: 4,
  },
  slot: {
    width: 32,
    height: 32,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotEmpty: {
    backgroundColor: COLORS.canvasWhite,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    borderStyle: 'dashed',
  },
  slotFilled: {
    backgroundColor: COLORS.canvasWhite,
    position: 'relative',
  },
  slotTier2: {
    shadowColor: COLORS.rarityLegendary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 4,
  },
  levelBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: COLORS.slateCharcoal,
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
    minWidth: 14,
    alignItems: 'center',
  },
  levelBadgeTier2: {
    backgroundColor: COLORS.rarityLegendary,
  },
  levelText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 8,
  },
  levelTextTier2: {
    color: COLORS.deepOnyx,
  },
  separator: {
    width: 1,
    height: 28,
    backgroundColor: COLORS.slateCharcoal,
    opacity: 0.3,
    marginHorizontal: 4,
  },
  // Legacy styles
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
