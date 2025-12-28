import React from 'react';
import { View, Text, Pressable, ScrollView } from 'react-native';
import { Enemy } from '../types';

interface EnemySelectionProps {
  enemies: Enemy[];
  onSelect: (enemy: Enemy) => void;
  round: number;
}

const EnemySelection: React.FC<EnemySelectionProps> = ({
  enemies,
  onSelect,
  round
}) => {
  return (
    <ScrollView className="p-4">
      <Text className="text-2xl font-bold mb-4">Choose Your Enemy - Round {round}</Text>

      <View className="flex-col gap-6">
        {enemies.map(enemy => (
          <Pressable
            key={enemy.name}
            className="p-4 border-2 rounded-lg border-gray-300"
            onPress={() => onSelect(enemy)}
          >
            <Text className="font-bold text-lg text-red-700">{enemy.name}</Text>
            <Text className="text-sm text-gray-600 mb-2">{enemy.description}</Text>

            <View className="mt-2">
              <Text className="font-semibold text-sm">Enemy Effect:</Text>
              <Text className="text-xs mt-1">{enemy.effect}</Text>
            </View>

            <View className="mt-2">
              <Text className="font-semibold text-sm">Reward:</Text>
              <Text className="text-xs mt-1">{enemy.reward}</Text>
            </View>

            <Pressable
              className="mt-4 w-full py-2 bg-red-600 rounded-lg"
              onPress={() => onSelect(enemy)}
            >
              <Text className="text-white text-center font-medium">Fight This Enemy</Text>
            </Pressable>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
};

export default EnemySelection;
