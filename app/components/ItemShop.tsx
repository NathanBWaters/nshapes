import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Item } from '../types';

interface ItemShopProps {
  items: Item[];
  playerMoney: number;
  onPurchase: (itemIndex: number) => void;
  onReroll: () => void;
  rerollCost: number;
  freeRerolls: number;
  onContinue: () => void;
}

const getRarityColor = (rarity: string) => {
  switch (rarity) {
    case 'Tier 1':
      return { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-600' };
    case 'Tier 2':
      return { bg: 'bg-green-50', border: 'border-green-300', text: 'text-green-600' };
    case 'Tier 3':
      return { bg: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-600' };
    case 'Tier 4':
      return { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-600' };
    default:
      return { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-600' };
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
  const canReroll = freeRerolls > 0 || playerMoney >= rerollCost;

  return (
    <View className="flex-1">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-2xl font-bold text-gray-900">Shop</Text>
        <View className="bg-green-100 px-3 py-1 rounded-full">
          <Text className="text-green-700 font-bold">${playerMoney}</Text>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="gap-3 pb-4">
          {items.map((item, index) => {
            const canAfford = playerMoney >= item.price;
            const rarityColors = getRarityColor(item.rarity);

            return (
              <Pressable
                key={`${item.name}-${index}`}
                className={`p-4 rounded-lg border-2 ${rarityColors.border} ${rarityColors.bg} ${!canAfford ? 'opacity-60' : ''}`}
                onPress={() => canAfford && onPurchase(index)}
                disabled={!canAfford}
              >
                <View className="flex-row justify-between items-start mb-2">
                  <View className="flex-1">
                    <Text className="text-lg font-bold text-gray-900">{item.name}</Text>
                    <Text className={`text-xs ${rarityColors.text}`}>{item.rarity}</Text>
                  </View>
                  <View className={`px-2 py-1 rounded ${canAfford ? 'bg-green-500' : 'bg-gray-400'}`}>
                    <Text className="text-white font-bold">${item.price}</Text>
                  </View>
                </View>

                <Text className="text-sm text-gray-600 mb-2">{item.description}</Text>

                {/* Effects */}
                {Object.keys(item.effects).length > 0 && (
                  <View className="flex-row flex-wrap gap-1 mb-1">
                    {Object.entries(item.effects).map(([stat, value]) => (
                      <View key={stat} className="bg-green-100 px-2 py-0.5 rounded">
                        <Text className="text-xs text-green-700">
                          +{value} {stat.replace(/([A-Z])/g, ' $1').toLowerCase()}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Drawbacks */}
                {Object.keys(item.drawbacks).length > 0 && (
                  <View className="flex-row flex-wrap gap-1">
                    {Object.entries(item.drawbacks).map(([stat, value]) => (
                      <View key={stat} className="bg-red-100 px-2 py-0.5 rounded">
                        <Text className="text-xs text-red-700">
                          {value} {stat.replace(/([A-Z])/g, ' $1').toLowerCase()}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                {item.limit !== null && (
                  <Text className="text-xs text-gray-400 mt-2">Limit: {item.limit}</Text>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View className="flex-row justify-center gap-4 mt-4">
        <Pressable
          className={`px-6 py-3 rounded-lg ${canReroll ? 'bg-gray-500' : 'bg-gray-300'}`}
          onPress={onReroll}
          disabled={!canReroll}
        >
          <Text className={`font-bold ${canReroll ? 'text-white' : 'text-gray-500'}`}>
            Reroll {freeRerolls > 0 ? `(${freeRerolls} free)` : `($${rerollCost})`}
          </Text>
        </Pressable>

        <Pressable
          className="px-6 py-3 rounded-lg bg-blue-500"
          onPress={onContinue}
        >
          <Text className="text-white font-bold">Continue</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default ItemShop;
