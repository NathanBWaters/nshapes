import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Pressable, StyleSheet } from 'react-native';
import { PlayerStats, Weapon, WeaponRarity } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import Icon from './Icon';
import GameMenu from './GameMenu';
import InventoryBar from './InventoryBar';

interface LevelUpProps {
  options: Weapon[];
  onSelect: (optionIndex: number) => void;
  onReroll: () => void;
  rerollCost: number;
  playerMoney: number;
  freeRerolls: number;
  playerStats: PlayerStats;
  playerWeapons?: Weapon[];
  onExitGame?: () => void;
}

// Rarity colors
const getRarityColor = (rarity: WeaponRarity): string => {
  switch (rarity) {
    case 'common': return COLORS.slateCharcoal;
    case 'rare': return '#1976D2'; // Blue
    case 'legendary': return COLORS.impactOrange;
    default: return COLORS.slateCharcoal;
  }
};

const getRarityLabel = (rarity: WeaponRarity): string => {
  switch (rarity) {
    case 'common': return 'Common';
    case 'rare': return 'Rare';
    case 'legendary': return 'Legendary';
    default: return rarity;
  }
};

const LevelUp: React.FC<LevelUpProps> = ({
  options,
  onSelect,
  onReroll,
  rerollCost,
  playerMoney,
  freeRerolls,
  playerStats,
  playerWeapons = [],
  onExitGame
}) => {
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Show hovered option if hovering, otherwise show focused
  const displayedIndex = hoveredIndex !== null ? hoveredIndex : focusedIndex;

  // Format key from camelCase to Title Case
  const formatKey = (key: string) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase());
  };

  // Format stat value with appropriate suffix
  const formatStatValue = (key: string, value: number): string => {
    let displayValue = `${value}`;
    if (key.toLowerCase().includes('percent') || key.toLowerCase().includes('chance')) displayValue += '%';
    if (key.toLowerCase().includes('interval')) displayValue += 'ms';
    if (key.toLowerCase().includes('time') && !key.toLowerCase().includes('interval')) displayValue += 's';
    return displayValue;
  };

  // Effects that roll independently per weapon (don't show misleading before→after)
  const INDEPENDENT_ROLL_EFFECTS = [
    'laserChance',
    'timeGainChance',
    'timeGainAmount',
  ];

  // Calculate before/after stat comparison for a weapon
  // Skips independent roll effects since they don't stack additively
  const getStatComparison = (weapon: Weapon): { key: string; before: string; after: string; isIncrease: boolean }[] => {
    return Object.entries(weapon.effects).map(([key, effectValue]) => {
      if (typeof effectValue !== 'number') return null;

      // Skip independent roll effects - they're explained in the description
      if (INDEPENDENT_ROLL_EFFECTS.includes(key)) return null;

      const currentValue = (playerStats as Record<string, any>)[key] ?? 0;
      const newValue = currentValue + effectValue;

      return {
        key: formatKey(key),
        before: formatStatValue(key, currentValue),
        after: formatStatValue(key, newValue),
        isIncrease: effectValue > 0,
      };
    }).filter((item): item is { key: string; before: string; after: string; isIncrease: boolean } => item !== null);
  };

  const focusedWeapon = options[displayedIndex];

  return (
    <View style={styles.container}>
      {/* Eyebrow Banner */}
      <View style={styles.eyebrow}>
        <View style={styles.eyebrowLeft}>
          <Text style={styles.eyebrowText}>Level Up!</Text>
          <View style={styles.freeBadge}>
            <Text style={styles.freeBadgeText}>FREE</Text>
          </View>
        </View>
        <View style={styles.eyebrowRight}>
          <View style={styles.moneyBadge}>
            <Text style={styles.moneyText}>${playerMoney}</Text>
          </View>
          <GameMenu playerStats={playerStats} playerWeapons={playerWeapons} onExitGame={onExitGame} />
        </View>
      </View>

      {/* Inventory Bar */}
      <InventoryBar weapons={playerWeapons} />

      {/* Top Half - Detail Focus */}
      <View style={styles.detailSection}>
        {focusedWeapon ? (
          <View style={styles.detailCard}>
            {/* Weapon Icon */}
            <View style={[styles.previewArea, { borderColor: getRarityColor(focusedWeapon.rarity) }]}>
              {focusedWeapon.icon ? (
                <Icon name={focusedWeapon.icon} size={32} color={COLORS.slateCharcoal} />
              ) : (
                <Text style={styles.previewLabel}>{getRarityLabel(focusedWeapon.rarity)}</Text>
              )}
              <View style={[styles.rarityBadge, { backgroundColor: getRarityColor(focusedWeapon.rarity) }]}>
                <Text style={styles.rarityBadgeText}>{getRarityLabel(focusedWeapon.rarity)}</Text>
              </View>
            </View>

            {/* Weapon Info */}
            <Text style={[styles.detailName, { color: getRarityColor(focusedWeapon.rarity) }]}>
              {focusedWeapon.name}
            </Text>
            <Text style={styles.detailDescription}>{focusedWeapon.description}</Text>
            {focusedWeapon.flavorText && (
              <Text style={styles.detailFlavor}>{focusedWeapon.flavorText}</Text>
            )}

            {/* Effects with before/after comparison */}
            <View style={styles.effectsRow}>
              {Object.keys(focusedWeapon.effects).length > 0 && (
                <View style={[styles.effectsBox, styles.effectsBoxPositive]}>
                  <Text style={styles.effectsLabelPositive}>Stats Change</Text>
                  {getStatComparison(focusedWeapon).map((stat, i) => (
                    <View key={i} style={styles.statComparisonRow}>
                      <Text style={styles.effectKey}>{stat.key}</Text>
                      <View style={styles.statValues}>
                        <Text style={styles.statBefore}>{stat.before}</Text>
                        <Text style={styles.statArrow}>→</Text>
                        <Text style={[styles.statAfter, stat.isIncrease ? styles.statIncrease : styles.statDecrease]}>
                          {stat.after}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.emptyDetail}>
            <Text style={styles.emptyText}>Select a weapon below</Text>
          </View>
        )}
      </View>

      {/* Bottom Half - Options Grid */}
      <View style={styles.optionsSection}>
        <View style={styles.optionsHeaderRow}>
          <Text style={styles.optionsHeader}>Choose Your <Text style={styles.freeText}>FREE</Text> Reward</Text>
          <TouchableOpacity
            onPress={onReroll}
            disabled={playerMoney < rerollCost && freeRerolls <= 0}
            style={[
              styles.rerollButton,
              (playerMoney < rerollCost && freeRerolls <= 0) && styles.rerollButtonDisabled,
            ]}
          >
            <Text style={styles.rerollButtonText}>
              {freeRerolls > 0 ? `Reroll (${freeRerolls})` : `Reroll $${rerollCost}`}
            </Text>
          </TouchableOpacity>
        </View>
        <ScrollView
          style={styles.optionsScroll}
          contentContainerStyle={styles.optionsGrid}
          showsVerticalScrollIndicator={false}
        >
          {options.map((weapon, index) => {
            const isFocused = focusedIndex === index;
            const rarityColor = getRarityColor(weapon.rarity);

            return (
              <Pressable
                key={`${weapon.id}-${index}`}
                onPress={() => setFocusedIndex(index)}
                onHoverIn={() => setHoveredIndex(index)}
                onHoverOut={() => setHoveredIndex(null)}
                style={[
                  styles.optionButton,
                  { borderColor: rarityColor },
                  isFocused && styles.optionButtonSelected,
                ]}
              >
                {weapon.icon && (
                  <Icon
                    name={weapon.icon}
                    size={24}
                    color={COLORS.slateCharcoal}
                    style={styles.optionIcon}
                  />
                )}
                <Text
                  style={[
                    styles.optionText,
                    isFocused && styles.optionTextSelected,
                  ]}
                  numberOfLines={1}
                >
                  {weapon.name}
                </Text>
                <Text style={[styles.rarityTag, { color: rarityColor }]}>
                  {getRarityLabel(weapon.rarity)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Action Button */}
      <View style={styles.actionSection}>
        <TouchableOpacity
          onPress={() => onSelect(focusedIndex)}
          style={styles.actionButton}
        >
          <Text style={styles.actionButtonText}>Select Weapon</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.paperBeige,
  },
  eyebrow: {
    height: 40,
    backgroundColor: COLORS.actionYellow,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
  },
  eyebrowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyebrowText: {
    color: COLORS.deepOnyx,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  freeBadge: {
    backgroundColor: COLORS.logicTeal,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.button,
  },
  freeBadgeText: {
    color: COLORS.canvasWhite,
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 1,
  },
  eyebrowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  moneyBadge: {
    backgroundColor: COLORS.deepOnyx,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
  },
  moneyText: {
    color: COLORS.actionYellow,
    fontWeight: '700',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  // Top Half - Detail Section
  detailSection: {
    flex: 1,
    padding: 16,
  },
  detailCard: {
    flex: 1,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    padding: 16,
  },
  previewArea: {
    backgroundColor: COLORS.paperBeige,
    height: 50,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 2,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  previewLabel: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  rarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.button,
  },
  rarityBadgeText: {
    color: COLORS.canvasWhite,
    fontWeight: '700',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailName: {
    fontWeight: '700',
    fontSize: 20,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  detailDescription: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  detailFlavor: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
    opacity: 0.6,
    fontStyle: 'italic',
  },
  effectsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  effectsBox: {
    flex: 1,
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
  },
  effectsBoxPositive: {
    backgroundColor: COLORS.paperBeige,
    borderColor: COLORS.logicTeal,
  },
  effectsLabelPositive: {
    color: COLORS.logicTeal,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  effectRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  effectKey: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 11,
    flex: 1,
  },
  effectValuePositive: {
    color: COLORS.logicTeal,
    fontWeight: '700',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  statComparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 3,
  },
  statValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statBefore: {
    color: COLORS.slateCharcoal,
    fontWeight: '500',
    fontSize: 11,
    fontFamily: 'monospace',
    opacity: 0.7,
  },
  statArrow: {
    color: COLORS.slateCharcoal,
    fontSize: 10,
    opacity: 0.5,
  },
  statAfter: {
    fontWeight: '700',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  statIncrease: {
    color: COLORS.logicTeal,
  },
  statDecrease: {
    color: COLORS.impactOrange,
  },
  emptyDetail: {
    flex: 1,
    backgroundColor: COLORS.canvasWhite,
    borderRadius: RADIUS.module,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.slateCharcoal,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 14,
    opacity: 0.6,
  },
  // Bottom Half - Options Section
  optionsSection: {
    flex: 1,
    backgroundColor: COLORS.canvasWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.slateCharcoal,
  },
  optionsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  optionsHeader: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  freeText: {
    color: COLORS.logicTeal,
    fontWeight: '800',
  },
  rerollButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    borderRadius: RADIUS.button,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  rerollButtonDisabled: {
    opacity: 0.4,
  },
  rerollButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  optionsScroll: {
    flex: 1,
  },
  optionsGrid: {
    flexGrow: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 8,
    alignContent: 'stretch',
  },
  optionButton: {
    backgroundColor: COLORS.paperBeige,
    borderRadius: RADIUS.button,
    borderWidth: 2,
    width: '48%',
    flexGrow: 1,
    flexBasis: '48%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 2,
  },
  optionIcon: {
    marginBottom: 2,
  },
  optionButtonSelected: {
    backgroundColor: COLORS.actionYellow,
  },
  optionText: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 11,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  optionTextSelected: {
    fontWeight: '700',
  },
  rarityTag: {
    fontSize: 9,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  // Action Section
  actionSection: {
    padding: 16,
    backgroundColor: COLORS.canvasWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.slateCharcoal,
  },
  actionButton: {
    backgroundColor: COLORS.actionYellow,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 16,
    alignItems: 'center',
  },
  actionButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default LevelUp;
