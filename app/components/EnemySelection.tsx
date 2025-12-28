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
    <View className="flex-1">
      <Text className="text-2xl font-bold text-center mb-2 text-gray-900">Round {round}</Text>
      <Text className="text-lg text-center text-gray-600 mb-4">Choose Your Opponent</Text>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="gap-4 pb-4">
          {enemies.map((enemy) => (
            <Pressable
              key={enemy.name}
              className="p-4 rounded-lg border-2 border-gray-200 bg-white"
              onPress={() => onSelect(enemy)}
            >
              <Text className="text-xl font-bold text-gray-900 mb-2">{enemy.name}</Text>
              <Text className="text-sm text-gray-600 mb-3">{enemy.description}</Text>

              <View className="flex-row gap-4">
                <View className="flex-1 bg-red-50 rounded-lg p-2">
                  <Text className="text-xs text-red-600 font-medium mb-1">Effect:</Text>
                  <Text className="text-sm text-red-700">{enemy.effect}</Text>
                </View>

                <View className="flex-1 bg-green-50 rounded-lg p-2">
                  <Text className="text-xs text-green-600 font-medium mb-1">Reward:</Text>
                  <Text className="text-sm text-green-700">{enemy.reward}</Text>
                </View>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

export default EnemySelection;
