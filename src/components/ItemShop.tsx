import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Item } from '@/types';

interface ItemShopProps {
  items: Item[];
  playerMoney: number;
  onPurchase: (itemIndex: number) => void;
  onReroll: () => void;
  rerollCost: number;
  freeRerolls: number;
  onContinue: () => void;
}

const ItemShop: React.FC<ItemShopProps> = ({
  items,
  playerMoney,
  onPurchase,
  onReroll,
  rerollCost,
  freeRerolls,
  onContinue
}) => {
  // Helper function to get color based on item rarity
  const getRarityColor = (rarity: string): string => {
    switch (rarity) {
      case 'Common': return 'text-gray-600';
      case 'Uncommon': return 'text-green-600';
      case 'Rare': return 'text-blue-600';
      case 'Epic': return 'text-purple-600';
      case 'Legendary': return 'text-orange-600';
      default: return 'text-gray-600';
    }
  };

  // Helper function to get border class based on item rarity
  const getItemBorderClass = (rarity: string): string => {
    switch (rarity) {
      case 'Common': return 'border-gray-300';
      case 'Uncommon': return 'border-green-300';
      case 'Rare': return 'border-blue-300';
      case 'Epic': return 'border-purple-300';
      case 'Legendary': return 'border-orange-300';
      default: return 'border-gray-300';
    }
  };

  return (
    <ScrollView className="p-4">
      <View className="flex-row justify-between items-center mb-4">
        <Text className="text-2xl font-bold">Item Shop</Text>
        <View className="flex-row items-center">
          <Text className="font-medium">Money: </Text>
          <Text>{playerMoney} 💰</Text>
        </View>
      </View>

      <View className="flex-col gap-4">
        {items.map((item, index) => {
          // Format item effects for display
          const effects = Object.entries(item.effects).map(([key, value]) => {
            const formattedKey = key
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());

            let displayValue: string = '';
            if (typeof value === 'number') {
              displayValue = value > 0 ? `+${value}` : `${value}`;
              if (key.toLowerCase().includes('percent')) {
                displayValue += '%';
              }
            } else {
              displayValue = String(value);
            }

            return `${formattedKey}: ${displayValue}`;
          });

          // Format item drawbacks for display
          const drawbacks = Object.entries(item.drawbacks || {}).map(([key, value]) => {
            const formattedKey = key
              .replace(/([A-Z])/g, ' $1')
              .replace(/^./, str => str.toUpperCase());

            let displayValue: string = '';
            if (typeof value === 'number') {
              displayValue = value > 0 ? `+${value}` : `${value}`;
              if (key.toLowerCase().includes('percent')) {
                displayValue += '%';
              }
            } else {
              displayValue = String(value);
            }

            return `${formattedKey}: ${displayValue}`;
          });

          const canAfford = playerMoney >= item.price;

          return (
            <View
              key={`${item.name}-${index}`}
              className={`p-4 border-2 ${getItemBorderClass(item.rarity)} rounded-lg ${!canAfford ? 'opacity-60' : ''}`}
            >
              <View className="flex-row justify-between items-start">
                <Text className={`font-bold ${getRarityColor(item.rarity)}`}>{item.name}</Text>
                <View className="bg-yellow-100 px-2 py-1 rounded">
                  <Text className="text-sm font-medium">{item.price} 💰</Text>
                </View>
              </View>

              <Text className="text-sm text-gray-600 mt-2">{item.description}</Text>

              {effects.length > 0 && (
                <View className="mt-3">
                  <Text className="text-sm font-semibold text-green-700">Effects:</Text>
                  <View className="mt-1">
                    {effects.map((effect, i) => (
                      <Text key={i} className="text-xs text-green-600">{effect}</Text>
                    ))}
                  </View>
                </View>
              )}

              {drawbacks.length > 0 && (
                <View className="mt-3">
                  <Text className="text-sm font-semibold text-red-700">Drawbacks:</Text>
                  <View className="mt-1">
                    {drawbacks.map((drawback, i) => (
                      <Text key={i} className="text-xs text-red-600">{drawback}</Text>
                    ))}
                  </View>
                </View>
              )}

              <View className="mt-4">
                <TouchableOpacity
                  className={`w-full py-2 rounded-lg ${
                    canAfford
                      ? 'bg-blue-500'
                      : 'bg-gray-300'
                  }`}
                  onPress={() => canAfford && onPurchase(index)}
                  disabled={!canAfford}
                >
                  <Text className={`text-center font-medium ${canAfford ? 'text-white' : 'text-gray-500'}`}>
                    Purchase
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
      </View>

      {items.length === 0 && (
        <View className="py-8">
          <Text className="text-center text-gray-500">No items available in the shop.</Text>
        </View>
      )}

      <View className="mt-6 flex-row justify-between">
        <TouchableOpacity
          className={`px-4 py-2 rounded-lg ${
            (playerMoney >= rerollCost || freeRerolls > 0)
              ? 'bg-purple-500'
              : 'bg-gray-300'
          }`}
          onPress={onReroll}
          disabled={playerMoney < rerollCost && freeRerolls <= 0}
        >
          <Text className={`${(playerMoney >= rerollCost || freeRerolls > 0) ? 'text-white' : 'text-gray-500'}`}>
            {freeRerolls > 0
              ? `Reroll (${freeRerolls} free)`
              : `Reroll (${rerollCost} 💰)`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="px-4 py-2 bg-green-500 rounded-lg"
          onPress={onContinue}
        >
          <Text className="text-white">Continue to Next Round</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default ItemShop;
