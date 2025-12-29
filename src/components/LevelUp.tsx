import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { PlayerStats, Weapon } from '@/types';

interface LevelUpProps {
  options: (Partial<PlayerStats> | Weapon)[];
  onSelect: (optionIndex: number) => void;
  onReroll: () => void;
  rerollCost: number;
  playerMoney: number;
  freeRerolls: number;
}

const LevelUp: React.FC<LevelUpProps> = ({
  options,
  onSelect,
  onReroll,
  rerollCost,
  playerMoney,
  freeRerolls
}) => {
  // Helper function to check if an option is a weapon
  const isWeapon = (option: Partial<PlayerStats> | Weapon): option is Weapon => {
    return 'name' in option && 'level' in option;
  };

  // Format stat value for display
  const formatStatValue = (value: number | string | undefined): string => {
    if (value === undefined) return '';

    if (typeof value === 'number') {
      return value > 0 ? `+${value}` : `${value}`;
    }

    return String(value || '');
  };

  return (
    <ScrollView className="p-4 bg-gray-900">
      <Text className="text-4xl font-bold mb-2 text-center text-white">Level Up!</Text>
      <Text className="mb-8 text-center text-xl text-white">Choose one upgrade to improve your character.</Text>

      <View className="flex-col gap-6">
        {options.map((option, index) => {
          if (isWeapon(option)) {
            // Render weapon option
            return (
              <TouchableOpacity
                key={`weapon-${index}`}
                className="p-6 rounded-xl bg-gray-800 border-2 border-orange-500/50"
                onPress={() => onSelect(index)}
              >
                <View className="flex-1">
                  <View className="flex-row items-center">
                    <Text className="font-bold text-xl text-orange-400">{option.name}</Text>
                    <Text className="text-orange-500/70 ml-1"> (Level {option.level})</Text>
                  </View>
                  <Text className="text-sm text-gray-300 mt-2">{option.description}</Text>

                  <View className="mt-4">
                    <Text className="text-lg font-semibold text-orange-400">Effects:</Text>
                    <View className="mt-2 gap-1">
                      {Object.entries(option.effects).map(([key, value]) => {
                        const formattedKey = key
                          .replace(/([A-Z])/g, ' $1')
                          .replace(/^./, str => str.toUpperCase());

                        return (
                          <Text key={key} className="text-gray-300 text-sm">
                            {formattedKey}: {formatStatValue(value)}
                          </Text>
                        );
                      })}
                    </View>
                  </View>
                </View>

                <View className="mt-4">
                  <View className="w-full py-3 bg-orange-500 rounded-lg">
                    <Text className="text-white text-center font-semibold text-lg">
                      Select Weapon
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          } else {
            // Render stat upgrade option
            return (
              <TouchableOpacity
                key={`stat-${index}`}
                className="p-6 rounded-xl bg-gray-800 border-2 border-blue-500/50"
                onPress={() => onSelect(index)}
              >
                <View className="flex-1">
                  <Text className="font-bold text-xl text-blue-400">Stat Upgrade</Text>

                  <View className="mt-4 gap-2">
                    {Object.entries(option).map(([key, value]) => {
                      const formattedKey = key
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, str => str.toUpperCase());

                      return (
                        <Text key={key} className="text-gray-300 font-medium text-sm">
                          {formattedKey}: {formatStatValue(value)}
                        </Text>
                      );
                    })}
                  </View>
                </View>

                <View className="mt-4">
                  <View className="w-full py-3 bg-blue-500 rounded-lg">
                    <Text className="text-white text-center font-semibold text-lg">
                      Select Upgrade
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }
        })}
      </View>

      <View className="mt-8 items-center pb-8">
        <TouchableOpacity
          className={`px-8 py-3 rounded-lg ${
            (playerMoney >= rerollCost || freeRerolls > 0)
              ? 'bg-indigo-500'
              : 'bg-gray-700'
          }`}
          onPress={onReroll}
          disabled={playerMoney < rerollCost && freeRerolls <= 0}
        >
          <Text className={`text-lg font-semibold ${
            (playerMoney >= rerollCost || freeRerolls > 0) ? 'text-white' : 'text-gray-400'
          }`}>
            {freeRerolls > 0
              ? `Reroll Options (${freeRerolls})`
              : `Reroll Options (${rerollCost})`}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default LevelUp;
