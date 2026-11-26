import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import Game from "@/components/Game";
import { COLORS } from "@/utils/colors";
import { STARTER_DECK_BY_ID, normalizeSeed } from "@/prism";
import type { StarterDeckId } from "@/prism";
import { LabsStorage } from "@/utils/freePlayStorage";

const firstParam = (val?: string | string[]): string | undefined =>
  Array.isArray(val) ? val[0] : val;

export default function Home() {
  const params = useLocalSearchParams<{
    autoplayer?: string;
    labs?: string;
    mode?: string;
    seed?: string;
    daily?: string;
    deck?: string;
  }>();

  const isAutoPlayer = firstParam(params.autoplayer) === 'true';
  const rawLabs = firstParam(params.labs)?.toLowerCase();
  const urlLabsEnabled = rawLabs === '1' || rawLabs === 'true';
  const labsEnabled = LabsStorage.isEnabled(urlLabsEnabled);

  const rawMode = firstParam(params.mode)?.toLowerCase();
  const initialMode = rawMode === 'prism' && labsEnabled ? ('prism' as const) : undefined;

  const rawSeed = firstParam(params.seed);
  const initialSeed = rawSeed ? normalizeSeed(rawSeed) || undefined : undefined;

  const rawDaily = firstParam(params.daily);
  const initialDaily = Boolean(
    rawDaily && rawDaily !== '0' && rawDaily.toLowerCase() !== 'false'
  );
  const initialDailyDate =
    rawDaily && /^\d{4}-\d{2}-\d{2}$/.test(rawDaily.trim()) ? rawDaily.trim() : undefined;

  const rawDeck = firstParam(params.deck) as StarterDeckId | undefined;
  const initialDeckId = rawDeck && rawDeck in STARTER_DECK_BY_ID ? rawDeck : undefined;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.paperBeige }}>
      <View className="flex-1">
        <Game
          autoPlayer={isAutoPlayer}
          labsEnabled={labsEnabled}
          initialMode={initialMode}
          initialSeed={initialSeed}
          initialDaily={initialDaily}
          initialDailyDate={initialDailyDate}
          initialDeckId={initialDeckId}
        />
      </View>
    </SafeAreaView>
  );
}
