import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Item } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';
import Icon from './Icon';

interface ItemShopProps {
  items: Item[];
  playerMoney: number;
  onPurchase: (itemIndex: number) => void;
  onReroll: () => void;
  rerollCost: number;
  freeRerolls: number;
  onContinue: () => void;
}

// Rarity colors
const getRarityColor = (rarity: string): string => {
  switch (rarity) {
    case 'Tier 1': return COLORS.slateCharcoal;
    case 'Tier 2': return COLORS.logicTeal;
    case 'Tier 3': return '#1976D2';
    case 'Tier 4': return COLORS.impactOrange;
    default: return COLORS.slateCharcoal;
  }
};

const ItemShop: React.FC<ItemShopProps> = ({
  items,
  playerMoney,
  onPurchase,
  onReroll,
  rerollCost,
  freeRerolls,
  onContinue
}) => {
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Show hovered item if hovering, otherwise show focused
  const displayedIndex = hoveredIndex !== null ? hoveredIndex : focusedIndex;

  const focusedItem = items.length > 0 ? items[displayedIndex] : null;
  const canAffordFocused = focusedItem ? playerMoney >= focusedItem.price : false;

  // Format effects for display
  const formatEffects = (effects: Record<string, any>): { key: string; value: string }[] => {
    return Object.entries(effects).map(([key, value]) => {
      const formattedKey = key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase());
      let displayValue = '';
      if (typeof value === 'number') {
        displayValue = value > 0 ? `+${value}` : `${value}`;
        if (key.toLowerCase().includes('percent')) displayValue += '%';
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
        <Text style={styles.eyebrowText}>Item Shop</Text>
        <View style={styles.moneyBadge}>
          <Text style={styles.moneyText}>${playerMoney}</Text>
        </View>
      </View>

      {/* Top Half - Detail Focus */}
      <View style={styles.detailSection}>
        {focusedItem ? (
          <View style={styles.detailCard}>
            {/* Item Icon */}
            <View style={[styles.previewArea, { borderColor: getRarityColor(focusedItem.rarity) }]}>
              {focusedItem.icon ? (
                <Icon name={focusedItem.icon} size={32} color={COLORS.slateCharcoal} />
              ) : (
                <Text style={styles.previewLabel}>{focusedItem.rarity}</Text>
              )}
              <View style={styles.priceBadge}>
                <Text style={styles.priceBadgeText}>${focusedItem.price}</Text>
              </View>
            </View>

            {/* Item Info */}
            <Text style={[styles.detailName, { color: getRarityColor(focusedItem.rarity) }]}>
              {focusedItem.name}
            </Text>
            <Text style={styles.detailDescription}>{focusedItem.description}</Text>

            {/* Effects & Drawbacks */}
            <View style={styles.effectsRow}>
              {Object.keys(focusedItem.effects).length > 0 && (
                <View style={[styles.effectsBox, styles.effectsBoxPositive]}>
                  <Text style={styles.effectsLabelPositive}>Effects</Text>
                  {formatEffects(focusedItem.effects).map((effect, i) => (
                    <View key={i} style={styles.effectRow}>
                      <Text style={styles.effectKey}>{effect.key}</Text>
                      <Text style={styles.effectValuePositive}>{effect.value}</Text>
                    </View>
                  ))}
                </View>
              )}
              {focusedItem.drawbacks && Object.keys(focusedItem.drawbacks).length > 0 && (
                <View style={[styles.effectsBox, styles.effectsBoxNegative]}>
                  <Text style={styles.effectsLabelNegative}>Drawbacks</Text>
                  {formatEffects(focusedItem.drawbacks).map((effect, i) => (
                    <View key={i} style={styles.effectRow}>
                      <Text style={styles.effectKey}>{effect.key}</Text>
                      <Text style={styles.effectValueNegative}>{effect.value}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        ) : (
          <View style={styles.emptyDetail}>
            <Text style={styles.emptyText}>Select an item below</Text>
          </View>
        )}
      </View>

      {/* Bottom Half - Options Grid */}
      <View style={styles.optionsSection}>
        <View style={styles.optionsHeaderRow}>
          <Text style={styles.optionsHeader}>Available Items</Text>
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
          {items.length > 0 ? (
            items.map((item, index) => {
              const isFocused = focusedIndex === index;
              const canAfford = playerMoney >= item.price;
              const rarityColor = getRarityColor(item.rarity);

              return (
                <Pressable
                  key={`${item.name}-${index}`}
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
                  {item.icon && (
                    <Icon
                      name={item.icon}
                      size={24}
                      color={COLORS.slateCharcoal}
                      style={styles.optionIcon}
                    />
                  )}
                  <View style={styles.optionHeader}>
                    <Text style={[styles.optionPrice, !canAfford && styles.optionPriceUnaffordable]}>
                      ${item.price}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.optionText,
                      isFocused && styles.optionTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {item.name}
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
            onPress={() => canAffordFocused && onPurchase(focusedIndex)}
            disabled={!canAffordFocused || items.length === 0}
            style={[
              styles.purchaseButton,
              (!canAffordFocused || items.length === 0) && styles.purchaseButtonDisabled,
            ]}
          >
            <Text style={styles.purchaseButtonText}>
              {items.length === 0
                ? 'No Items'
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
    justifyContent: 'center',
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
  moneyBadge: {
    position: 'absolute',
    right: 16,
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
  effectsBoxNegative: {
    backgroundColor: COLORS.paperBeige,
    borderColor: COLORS.impactRed,
  },
  effectsLabelPositive: {
    color: COLORS.logicTeal,
    fontWeight: '600',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  effectsLabelNegative: {
    color: COLORS.impactRed,
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
  effectValueNegative: {
    color: COLORS.impactRed,
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

export default ItemShop;
