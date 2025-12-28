import React from 'react';
import { View, Text } from 'react-native';
import Game from './components/Game';

export default function Home() {
  return (
    <View className="min-h-screen p-4">
      <View className="mb-6 items-center">
        <Text className="text-3xl font-bold">NShapes</Text>
        <Text className="text-gray-600">A roguelike card matching game</Text>
      </View>

      <Game />
    </View>
  );
}
