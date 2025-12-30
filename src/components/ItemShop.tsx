import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Pressable } from 'react-native';
import { Item } from '@/types';
import { COLORS, RADIUS } from '@/utils/colors';

interface ItemShopProps {
  items: Item[];
  playerMoney: number;
  onPurchase: (itemIndex: number) => void;
  onReroll: () => void;
  rerollCost: number;
  freeRerolls: number;
  onContinue: () => void;
}

// Rarity colors based on style guide
const getRarityColors = (rarity: string): { bg: string; text: string; border: string } => {
  switch (rarity) {
    case 'Tier 1':
      return { bg: COLORS.paperBeige, text: COLORS.slateCharcoal, border: COLORS.slateCharcoal };
    case 'Tier 2':
      return { bg: '#E8F5E9', text: COLORS.logicTeal, border: COLORS.logicTeal };
    case 'Tier 3':
      return { bg: '#E3F2FD', text: '#1976D2', border: '#1976D2' };
    case 'Tier 4':
      return { bg: '#FFF3E0', text: COLORS.impactOrange, border: COLORS.impactOrange };
    default:
      return { bg: COLORS.paperBeige, text: COLORS.slateCharcoal, border: COLORS.slateCharcoal };
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
  const [hoveredItem, setHoveredItem] = useState<number | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.paperBeige }}>
      {/* Eyebrow Banner */}
      <View
        style={{
          height: 40,
          backgroundColor: COLORS.actionYellow,
          justifyContent: 'center',
          alignItems: 'center',
          borderBottomWidth: 1,
          borderBottomColor: COLORS.slateCharcoal,
          flexDirection: 'row',
          paddingHorizontal: 16,
        }}
      >
        <Text
          style={{
            color: COLORS.deepOnyx,
            fontWeight: '700',
            fontSize: 14,
            textTransform: 'uppercase',
            letterSpacing: 2,
            flex: 1,
            textAlign: 'center',
          }}
        >
          Item Shop
        </Text>
        <View
          style={{
            position: 'absolute',
            right: 16,
            backgroundColor: COLORS.deepOnyx,
            paddingHorizontal: 12,
            paddingVertical: 4,
            borderRadius: RADIUS.button,
          }}
        >
          <Text
            style={{
              color: COLORS.actionYellow,
              fontWeight: '700',
              fontSize: 14,
              fontFamily: 'monospace',
            }}
          >
            ${playerMoney}
          </Text>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
        {/* Section Header */}
        <Text
          style={{
            color: COLORS.slateCharcoal,
            fontWeight: '700',
            fontSize: 24,
            marginBottom: 8,
            textTransform: 'uppercase',
          }}
        >
          Available Items
        </Text>
        <Text
          style={{
            color: COLORS.slateCharcoal,
            fontWeight: '400',
            fontSize: 14,
            marginBottom: 20,
            opacity: 0.7,
          }}
        >
          Purchase items to enhance your abilities
        </Text>

        {/* Item Cards */}
        <View style={{ gap: 12 }}>
          {items.map((item, index) => {
            const canAfford = playerMoney >= item.price;
            const isHovered = hoveredItem === index;
            const rarityColors = getRarityColors(item.rarity);

            // Format effects
            const effects = Object.entries(item.effects).map(([key, value]) => {
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
              return `${formattedKey}: ${displayValue}`;
            });

            // Format drawbacks
            const drawbacks = Object.entries(item.drawbacks || {}).map(([key, value]) => {
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
              return `${formattedKey}: ${displayValue}`;
            });

            return (
              <Pressable
                key={`${item.name}-${index}`}
                onHoverIn={() => setHoveredItem(index)}
                onHoverOut={() => setHoveredItem(null)}
                style={{
                  backgroundColor: COLORS.canvasWhite,
                  borderRadius: RADIUS.module,
                  borderWidth: 2,
                  borderColor: rarityColors.border,
                  padding: 16,
                  opacity: canAfford ? 1 : 0.6,
                  transform: [{ scale: isHovered && canAfford ? 1.01 : 1 }],
                  shadowColor: COLORS.deepOnyx,
                  shadowOffset: { width: 0, height: isHovered ? 4 : 2 },
                  shadowOpacity: isHovered ? 0.15 : 0.08,
                  shadowRadius: isHovered ? 8 : 4,
                  elevation: isHovered ? 4 : 2,
                }}
              >
                {/* Header Row */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: rarityColors.text,
                        fontWeight: '700',
                        fontSize: 16,
                        textTransform: 'uppercase',
                      }}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={{
                        color: rarityColors.text,
                        fontWeight: '600',
                        fontSize: 10,
                        textTransform: 'uppercase',
                        letterSpacing: 1,
                        opacity: 0.7,
                      }}
                    >
                      {item.rarity}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: COLORS.actionYellow,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                      borderRadius: RADIUS.button,
                      borderWidth: 1,
                      borderColor: COLORS.slateCharcoal,
                    }}
                  >
                    <Text
                      style={{
                        color: COLORS.slateCharcoal,
                        fontWeight: '700',
                        fontSize: 14,
                        fontFamily: 'monospace',
                      }}
                    >
                      ${item.price}
                    </Text>
                  </View>
                </View>

                {/* Description */}
                <Text
                  style={{
                    color: COLORS.slateCharcoal,
                    fontWeight: '400',
                    fontSize: 13,
                    lineHeight: 18,
                    marginBottom: 12,
                    opacity: 0.8,
                  }}
                >
                  {item.description}
                </Text>

                {/* Effects */}
                {effects.length > 0 && (
                  <View
                    style={{
                      backgroundColor: COLORS.paperBeige,
                      borderRadius: 8,
                      padding: 10,
                      marginBottom: 8,
                      borderWidth: 1,
                      borderColor: COLORS.logicTeal,
                    }}
                  >
                    <Text
                      style={{
                        color: COLORS.logicTeal,
                        fontWeight: '600',
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        marginBottom: 4,
                      }}
                    >
                      Effects
                    </Text>
                    {effects.map((effect, i) => (
                      <Text
                        key={i}
                        style={{
                          color: COLORS.slateCharcoal,
                          fontWeight: '400',
                          fontSize: 12,
                          fontFamily: 'monospace',
                        }}
                      >
                        {effect}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Drawbacks */}
                {drawbacks.length > 0 && (
                  <View
                    style={{
                      backgroundColor: COLORS.paperBeige,
                      borderRadius: 8,
                      padding: 10,
                      marginBottom: 12,
                      borderWidth: 1,
                      borderColor: COLORS.impactRed,
                    }}
                  >
                    <Text
                      style={{
                        color: COLORS.impactRed,
                        fontWeight: '600',
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: 0.5,
                        marginBottom: 4,
                      }}
                    >
                      Drawbacks
                    </Text>
                    {drawbacks.map((drawback, i) => (
                      <Text
                        key={i}
                        style={{
                          color: COLORS.slateCharcoal,
                          fontWeight: '400',
                          fontSize: 12,
                          fontFamily: 'monospace',
                        }}
                      >
                        {drawback}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Purchase Button */}
                <TouchableOpacity
                  onPress={() => canAfford && onPurchase(index)}
                  disabled={!canAfford}
                  style={{
                    backgroundColor: canAfford ? COLORS.actionYellow : COLORS.paperBeige,
                    borderWidth: 1,
                    borderColor: COLORS.slateCharcoal,
                    borderRadius: RADIUS.button,
                    paddingVertical: 12,
                    alignItems: 'center',
                  }}
                >
                  <Text
                    style={{
                      color: COLORS.slateCharcoal,
                      fontWeight: '700',
                      fontSize: 14,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    {canAfford ? 'Purchase' : 'Cannot Afford'}
                  </Text>
                </TouchableOpacity>
              </Pressable>
            );
          })}
        </View>

        {/* Empty State */}
        {items.length === 0 && (
          <View
            style={{
              backgroundColor: COLORS.canvasWhite,
              borderRadius: RADIUS.module,
              borderWidth: 1,
              borderColor: COLORS.slateCharcoal,
              padding: 32,
              alignItems: 'center',
            }}
          >
            <Text
              style={{
                color: COLORS.slateCharcoal,
                fontWeight: '600',
                fontSize: 16,
                opacity: 0.6,
              }}
            >
              No items available in the shop.
            </Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 24, marginBottom: 40, gap: 12 }}>
          {/* Reroll Button */}
          <TouchableOpacity
            onPress={onReroll}
            disabled={playerMoney < rerollCost && freeRerolls <= 0}
            style={{
              flex: 1,
              backgroundColor: (playerMoney >= rerollCost || freeRerolls > 0)
                ? COLORS.canvasWhite
                : COLORS.paperBeige,
              borderWidth: 2,
              borderColor: COLORS.slateCharcoal,
              borderRadius: RADIUS.button,
              paddingVertical: 14,
              alignItems: 'center',
              opacity: (playerMoney >= rerollCost || freeRerolls > 0) ? 1 : 0.5,
            }}
          >
            <Text
              style={{
                color: COLORS.slateCharcoal,
                fontWeight: '700',
                fontSize: 14,
                textTransform: 'uppercase',
              }}
            >
              {freeRerolls > 0
                ? `Reroll (${freeRerolls} Free)`
                : `Reroll ($${rerollCost})`}
            </Text>
          </TouchableOpacity>

          {/* Continue Button */}
          <TouchableOpacity
            onPress={onContinue}
            style={{
              flex: 1,
              backgroundColor: COLORS.actionYellow,
              borderWidth: 1,
              borderColor: COLORS.slateCharcoal,
              borderRadius: RADIUS.button,
              paddingVertical: 14,
              alignItems: 'center',
              shadowColor: COLORS.deepOnyx,
              shadowOffset: { width: 2, height: 2 },
              shadowOpacity: 0.2,
              shadowRadius: 0,
              elevation: 2,
            }}
          >
            <Text
              style={{
                color: COLORS.slateCharcoal,
                fontWeight: '700',
                fontSize: 14,
                textTransform: 'uppercase',
                letterSpacing: 1,
              }}
            >
              Continue
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default ItemShop;
