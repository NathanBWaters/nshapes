import React from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import Game from "@/components/Game";

export default function Home() {
  const { autoplayer } = useLocalSearchParams<{ autoplayer?: string }>();
  const isAutoPlayer = autoplayer === 'true';

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1">
        <Game autoPlayer={isAutoPlayer} />
      </View>
    </SafeAreaView>
  );
}
