import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { PlayerStats, Weapon } from '../types';

interface LevelUpProps {
  options: (Partial<PlayerStats> | Weapon)[];
  onSelect: (optionIndex: number) => void;
  onReroll: () => void;
  rerollCost: number;
  playerMoney: number;
  freeRerolls: number;
}

// Helper function to check if an option is a weapon
const isWeapon = (option: Partial<PlayerStats> | Weapon): option is Weapon => {
  return 'name' in option && 'level' in option;
};

// Format stat name for display
const formatStatName = (stat: string): string => {
  return stat
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .replace('Percent', '%');
};

const LevelUp: React.FC<LevelUpProps> = ({
  options,
  onSelect,
  onReroll,
  rerollCost,
  playerMoney,
  freeRerolls
}) => {
  const canReroll = freeRerolls > 0 || playerMoney >= rerollCost;

  const renderOption = (option: Partial<PlayerStats> | Weapon, index: number) => {
    if (isWeapon(option)) {
      return (
        <Pressable
          key={index}
          className="p-4 rounded-lg border-2 border-purple-200 bg-purple-50"
          onPress={() => onSelect(index)}
        >
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-lg font-bold text-purple-900">{option.name}</Text>
            <View className="bg-purple-500 px-2 py-1 rounded">
              <Text className="text-white text-xs">Level {option.level}</Text>
            </View>
          </View>
          <Text className="text-sm text-purple-700">{option.description}</Text>
        </Pressable>
      );
    }

    // It's a stat upgrade
    const entries = Object.entries(option);
    return (
      <Pressable
        key={index}
        className="p-4 rounded-lg border-2 border-blue-200 bg-blue-50"
        onPress={() => onSelect(index)}
      >
        <Text className="text-lg font-bold text-blue-900 mb-2">Stat Upgrade</Text>
        {entries.map(([stat, value]) => (
          <View key={stat} className="flex-row items-center">
            <Text className="text-sm text-blue-700">{formatStatName(stat)}: </Text>
            <Text className={`text-sm font-bold ${Number(value) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {Number(value) >= 0 ? '+' : ''}{value}
            </Text>
          </View>
        ))}
      </Pressable>
    );
  };

  return (
    <View className="flex-1">
      <Text className="text-2xl font-bold text-center mb-2 text-gray-900">Level Up!</Text>
      <Text className="text-lg text-center text-gray-600 mb-4">Choose an upgrade</Text>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="gap-3 pb-4">
          {options.map((option, index) => renderOption(option, index))}
        </View>
      </ScrollView>

      <View className="mt-4 items-center">
        <Pressable
          className={`px-6 py-3 rounded-lg ${canReroll ? 'bg-gray-500' : 'bg-gray-300'}`}
          onPress={onReroll}
          disabled={!canReroll}
        >
          <Text className={`font-bold ${canReroll ? 'text-white' : 'text-gray-500'}`}>
            Reroll {freeRerolls > 0 ? `(${freeRerolls} free)` : `($${rerollCost})`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
};

export default LevelUp;
