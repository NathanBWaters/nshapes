import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Weapon, PlayerStats, WeaponRarity } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import Icon from './Icon';
import StatsButton from './StatsButton';

interface WeaponShopProps {
  weapons: (Weapon | null)[];  // null represents a sold/empty slot
  playerMoney: number;
  onPurchase: (weaponIndex: number) => void;
  onReroll: () => void;
  rerollCost: number;
  freeRerolls: number;
  onContinue: () => void;
  playerStats: PlayerStats;
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

const WeaponShop: React.FC<WeaponShopProps> = ({
  weapons,
  playerMoney,
  onPurchase,
  onReroll,
  rerollCost,
  freeRerolls,
  onContinue,
  playerStats
}) => {
  const [focusedIndex, setFocusedIndex] = useState<number>(() => {
    // Initialize to first non-null weapon
    const firstAvailable = weapons.findIndex(weapon => weapon !== null);
    return firstAvailable >= 0 ? firstAvailable : 0;
  });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Show hovered weapon if hovering, otherwise show focused
  const displayedIndex = hoveredIndex !== null ? hoveredIndex : focusedIndex;

  const focusedWeapon = weapons[displayedIndex];  // Can be null if slot is sold
  const canAffordFocused = focusedWeapon ? playerMoney >= focusedWeapon.price : false;

  // Count available (non-null) weapons
  const availableWeapons = weapons.filter(weapon => weapon !== null);

  // Format effects for display
  const formatEffects = (effects: Record<string, any>): { key: string; value: string }[] => {
    return Object.entries(effects).map(([key, value]) => {
      const formattedKey = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase());
      let displayValue = '';
      if (typeof value === 'number') {
        displayValue = value > 0 ? `+${value}` : `${value}`;
        if (key.toLowerCase().includes('percent') || key.toLowerCase().includes('chance')) displayValue += '%';
        if (key.toLowerCase().includes('interval')) displayValue += 'ms';
        if (key.toLowerCase().includes('time') && !key.toLowerCase().includes('interval')) displayValue += 's';
      } else {
        displayValue = String(value);
      }
      return { key: formattedKey, value: displayValue };
    });
  };

  return (
    <View style={styles.container}>
      {/* Eyebrow Banner */}
      <View style={styles.eyebrow}>
        <Text style={styles.eyebrowText}>Weapon Shop</Text>
        <View style={styles.eyebrowRight}>
          <View style={styles.moneyBadge}>
            <Text style={styles.moneyText}>${playerMoney}</Text>
          </View>
          <StatsButton playerStats={playerStats} />
        </View>
      </View>

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
              <View style={styles.priceBadge}>
                <Text style={styles.priceBadgeText}>${focusedWeapon.price}</Text>
              </View>
            </View>

            {/* Weapon Info */}
            <Text style={[styles.detailName, { color: getRarityColor(focusedWeapon.rarity) }]}>
              {focusedWeapon.name}
            </Text>
            <Text style={styles.detailDescription}>{focusedWeapon.description}</Text>

            {/* Effects */}
            <View style={styles.effectsRow}>
              {Object.keys(focusedWeapon.effects).length > 0 && (
                <View style={[styles.effectsBox, styles.effectsBoxPositive]}>
                  <Text style={styles.effectsLabelPositive}>Effects</Text>
                  {formatEffects(focusedWeapon.effects).map((effect, i) => (
                    <View key={i} style={styles.effectRow}>
                      <Text style={styles.effectKey}>{effect.key}</Text>
                      <Text style={styles.effectValuePositive}>{effect.value}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.emptyDetail}>
            <Text style={styles.emptyText}>
              {availableWeapons.length === 0 ? 'All weapons sold' : 'Select a weapon below'}
            </Text>
          </View>
        )}
      </View>

      {/* Bottom Half - Options Grid */}
      <View style={styles.optionsSection}>
        <View style={styles.optionsHeaderRow}>
          <Text style={styles.optionsHeader}>Available Weapons</Text>
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
          {weapons.length > 0 ? (
            weapons.map((weapon, index) => {
              // Handle sold/empty slot
              if (weapon === null) {
                return (
                  <View
                    key={`sold-${index}`}
                    style={[styles.optionButton, styles.optionButtonSold]}
                  >
                    <Text style={styles.soldText}>SOLD</Text>
                  </View>
                );
              }

              const isFocused = focusedIndex === index;
              const canAfford = playerMoney >= weapon.price;
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
                    !canAfford && styles.optionButtonUnaffordable,
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
                  <View style={styles.optionHeader}>
                    <Text style={[styles.optionPrice, !canAfford && styles.optionPriceUnaffordable]}>
                      ${weapon.price}
                    </Text>
                  </View>
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
            })
          ) : (
            <View style={styles.emptyShop}>
              <Text style={styles.emptyShopText}>Shop is empty</Text>
            </View>
          )}
        </ScrollView>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionSection}>
        <View style={styles.actionRow}>
          <TouchableOpacity
            onPress={() => canAffordFocused && focusedWeapon && onPurchase(focusedIndex)}
            disabled={!canAffordFocused || !focusedWeapon || availableWeapons.length === 0}
            style={[
              styles.purchaseButton,
              (!canAffordFocused || !focusedWeapon || availableWeapons.length === 0) && styles.purchaseButtonDisabled,
            ]}
          >
            <Text style={styles.purchaseButtonText}>
              {availableWeapons.length === 0
                ? 'No Weapons'
                : !focusedWeapon
                  ? 'Select Weapon'
                  : canAffordFocused
                    ? 'Purchase'
                    : 'Cannot Afford'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onContinue}
            style={styles.continueButton}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
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
    borderBottomWidth: 1,
    borderBottomColor: COLORS.slateCharcoal,
    paddingHorizontal: 16,
  },
  eyebrowText: {
    color: COLORS.deepOnyx,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 2,
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
  priceBadge: {
    backgroundColor: COLORS.actionYellow,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
  },
  priceBadgeText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 12,
    fontFamily: 'monospace',
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
    marginBottom: 12,
    opacity: 0.8,
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
  optionButtonUnaffordable: {
    opacity: 0.5,
  },
  optionButtonSold: {
    backgroundColor: COLORS.paperBeige,
    borderColor: COLORS.slateCharcoal,
    borderStyle: 'dashed',
    opacity: 0.4,
  },
  soldText: {
    color: COLORS.slateCharcoal,
    fontWeight: '600',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  optionHeader: {
    marginBottom: 2,
  },
  optionPrice: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  optionPriceUnaffordable: {
    color: COLORS.impactRed,
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
  emptyShop: {
    flex: 1,
    padding: 32,
    alignItems: 'center',
  },
  emptyShopText: {
    color: COLORS.slateCharcoal,
    fontWeight: '400',
    fontSize: 14,
    opacity: 0.6,
  },
  // Action Section
  actionSection: {
    padding: 16,
    backgroundColor: COLORS.canvasWhite,
    borderTopWidth: 1,
    borderTopColor: COLORS.slateCharcoal,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  purchaseButton: {
    flex: 1,
    backgroundColor: COLORS.actionYellow,
    borderRadius: RADIUS.button,
    borderWidth: 1,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 16,
    alignItems: 'center',
  },
  purchaseButtonDisabled: {
    backgroundColor: COLORS.paperBeige,
    opacity: 0.6,
  },
  purchaseButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  continueButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: RADIUS.button,
    borderWidth: 2,
    borderColor: COLORS.slateCharcoal,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueButtonText: {
    color: COLORS.slateCharcoal,
    fontWeight: '700',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
});

export default WeaponShop;
