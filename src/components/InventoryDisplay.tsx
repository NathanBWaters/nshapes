/**
 * InventoryDisplay - Reusable component for displaying player inventory
 *
 * Shows 4 weapon slots on top, 4 passive slots on bottom.
 * Each filled slot shows the item icon and level.
 * Clicking an item triggers onItemSelect callback.
 *
 * Usage:
 * - In LevelUp screen to show current inventory and select items for details
 * - In Character Stats to display equipped items
 * - In Shop screens to show what player already has
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { FusionWeapon, PlayerInventory } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import Icon, { IconName } from './Icon';

// =============================================================================
// Types
// =============================================================================

export interface InventorySlotInfo {
  item: FusionWeapon;
  slotType: 'weapons' | 'passives';
  slotIndex: number;
}

interface InventoryDisplayProps {
  /** The player's inventory */
  inventory: PlayerInventory;
  /** Called when an item slot is pressed */
  onItemSelect?: (slotInfo: InventorySlotInfo) => void;
  /** Index of currently selected item (for highlighting) */
  selectedSlot?: { type: 'weapons' | 'passives'; index: number } | null;
  /** Whether to show labels above each row */
  showLabels?: boolean;
  /** Compact mode - smaller slots */
  compact?: boolean;
}

// =============================================================================
// Slot Component
// =============================================================================

interface SlotProps {
  item: FusionWeapon | null;
  slotType: 'weapons' | 'passives';
  slotIndex: number;
  isSelected: boolean;
  onPress?: (slotInfo: InventorySlotInfo) => void;
  compact?: boolean;
}

function Slot({ item, slotType, slotIndex, isSelected, onPress, compact }: SlotProps) {
  const slotSize = compact ? 36 : 44;

  // Get border color based on fusion tier
  const getBorderColor = () => {
    if (isSelected) return COLORS.actionYellow;
    if (!item) return COLORS.slateCharcoal;
    if (item.fusionTier === 2) return COLORS.rarityLegendary;
    if (item.fusionTier === 1) return COLORS.rarityEpic;
    return COLORS.logicTeal;
  };

  // Level indicator text (I, II, III)
  const getLevelText = () => {
    if (!item) return '';
    const levels = ['I', 'II', 'III'];
    return levels[item.level - 1] || item.level.toString();
  };

  // Handle press
  const handlePress = () => {
    if (item && onPress) {
      onPress({ item, slotType, slotIndex });
    }
  };

  if (!item) {
    // Empty slot placeholder
    return (
      <View
        style={[
          styles.slot,
          styles.slotEmpty,
          { width: slotSize, height: slotSize },
        ]}
      >
        <Icon
          name={slotType === 'weapons' ? 'lorc/crossed-swords' : 'lorc/checked-shield'}
          size={compact ? 12 : 16}
          color={COLORS.slateCharcoal}
          style={{ opacity: 0.2 }}
        />
      </View>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={[
        styles.slot,
        styles.slotFilled,
        {
          width: slotSize,
          height: slotSize,
          borderColor: getBorderColor(),
          borderWidth: isSelected ? 3 : 2,
        },
        item.fusionTier === 2 && styles.slotTier2,
        isSelected && styles.slotSelected,
        Platform.OS === 'web' && { cursor: 'pointer' as any },
      ]}
    >
      {item.icon && (
        <Icon
          name={item.icon}
          size={compact ? 18 : 22}
          color={COLORS.slateCharcoal}
        />
      )}
      {/* Level badge */}
      <View
        style={[
          styles.levelBadge,
          item.fusionTier === 2 && styles.levelBadgeTier2,
          compact && styles.levelBadgeCompact,
        ]}
      >
        <Text
          style={[
            styles.levelText,
            item.fusionTier === 2 && styles.levelTextTier2,
            compact && styles.levelTextCompact,
          ]}
        >
          {getLevelText()}
        </Text>
      </View>
    </Pressable>
  );
}

// =============================================================================
// Main Component
// =============================================================================

const InventoryDisplay: React.FC<InventoryDisplayProps> = ({
  inventory,
  onItemSelect,
  selectedSlot,
  showLabels = true,
  compact = false,
}) => {
  const isSelected = (type: 'weapons' | 'passives', index: number) =>
    selectedSlot?.type === type && selectedSlot?.index === index;

  return (
    <View style={[styles.container, compact && styles.containerCompact]}>
      {/* Weapons Row */}
      <View style={styles.row}>
        {showLabels && (
          <View style={styles.labelContainer}>
            <Icon name="lorc/crossed-swords" size={12} color={COLORS.slateCharcoal} />
            <Text style={styles.label}>Weapons</Text>
          </View>
        )}
        <View style={styles.slotsRow}>
          {inventory.weapons.map((item, index) => (
            <Slot
              key={`weapon-${index}`}
              item={item}
              slotType="weapons"
              slotIndex={index}
              isSelected={isSelected('weapons', index)}
              onPress={onItemSelect}
              compact={compact}
            />
          ))}
        </View>
      </View>

      {/* Passives Row */}
      <View style={styles.row}>
        {showLabels && (
          <View style={styles.labelContainer}>
            <Icon name="lorc/checked-shield" size={12} color={COLORS.slateCharcoal} />
            <Text style={styles.label}>Passives</Text>
          </View>
        )}
        <View style={styles.slotsRow}>
          {inventory.passives.map((item, index) => (
            <Slot
              key={`passive-${index}`}
              item={item}
              slotType="passives"
              slotIndex={index}
              isSelected={isSelected('passives', index)}
              onPress={onItemSelect}
              compact={compact}
            />
          ))}
        </View>
      </View>
    </View>
  );
};

// =============================================================================
// Styles
// =============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.paperBeige,
    padding: 12,
    borderRadius: RADIUS.module,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    gap: 10,
  },
  containerCompact: {
    padding: 8,
    gap: 6,
  },
  row: {
    gap: 4,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 2,
  },
  label: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    opacity: 0.7,
  },
  slotsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  slot: {
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  slotEmpty: {
    backgroundColor: COLORS.canvasWhite,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    borderStyle: 'dashed',
    opacity: 0.5,
  },
  slotFilled: {
    backgroundColor: COLORS.canvasWhite,
    position: 'relative',
  },
  slotTier2: {
    backgroundColor: '#FFF8E7', // Slight gold tint for legendary tier
  },
  slotSelected: {
    backgroundColor: COLORS.actionYellow,
  },
  levelBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: COLORS.logicTeal,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    minWidth: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.canvasWhite,
  },
  levelBadgeTier2: {
    backgroundColor: COLORS.rarityLegendary,
  },
  levelBadgeCompact: {
    bottom: -3,
    right: -3,
    paddingHorizontal: 3,
    paddingVertical: 1,
    minWidth: 14,
    borderRadius: 4,
  },
  levelText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  levelTextTier2: {
    color: COLORS.deepOnyx,
  },
  levelTextCompact: {
    fontSize: 8,
  },
});

export default InventoryDisplay;
