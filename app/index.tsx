import React from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Game from "@/components/Game";

export default function Home() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 p-4">
        <View className="mb-6 items-center">
          <Text className="text-3xl font-bold text-gray-900">NShapes</Text>
          <Text className="text-gray-600">A roguelike card matching game</Text>
        </View>
        <Game />
      </View>
    </SafeAreaView>
  );
}
