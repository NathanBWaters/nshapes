import React from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import Game from "@/components/Game";
import { COLORS } from "@/utils/colors";
import { FIGHTERS } from "@/adventure/data/fighters";
import { LEVELS } from "@/adventure/data/levels";
import { isValidDateKey, parseNumericSeed } from "@/adventure/dailySeed";
import { STARTER_DECK_BY_ID, normalizeSeed } from "@/prism";
import type { StarterDeckId } from "@/prism";
import type { CharacterName } from "@/types";
import { LabsStorage } from "@/utils/freePlayStorage";

const firstParam = (val?: string | string[]): string | undefined =>
  Array.isArray(val) ? val[0] : val;

const VALID_LEVEL_IDS = new Set(LEVELS.map(l => l.id));
const FIGHTER_NAMES: readonly CharacterName[] = FIGHTERS.map(f => f.name);

export default function Home() {
  const params = useLocalSearchParams<{
    autoplayer?: string;
    labs?: string;
    mode?: string;
    seed?: string;
    daily?: string;
    deck?: string;
    level?: string;
    fighter?: string;
    asc?: string;
  }>();

  const isAutoPlayer = firstParam(params.autoplayer) === 'true';
  const rawLabs = firstParam(params.labs)?.toLowerCase();
  const urlLabsEnabled = rawLabs === '1' || rawLabs === 'true';
  const labsEnabled = LabsStorage.isEnabled(urlLabsEnabled);

  const rawMode = firstParam(params.mode)?.toLowerCase();
  const initialMode =
    rawMode === 'prism' && labsEnabled
      ? ('prism' as const)
      : rawMode === 'summit' || rawMode === 'spire'
        ? ('summit' as const)
        : rawMode === 'adventure'
          ? ('adventure' as const)
          : rawMode === 'freeplay' || rawMode === 'free_play'
            ? ('freeplay' as const)
            : undefined;

  const rawSeed = firstParam(params.seed);
  const initialSeed = rawSeed ? normalizeSeed(rawSeed) || undefined : undefined;
  const initialNumericSeed = parseNumericSeed(rawSeed);

  const rawDaily = firstParam(params.daily);
  const initialDaily = Boolean(
    rawDaily && rawDaily !== '0' && rawDaily.toLowerCase() !== 'false'
  );
  const initialDailyDate =
    rawDaily && isValidDateKey(rawDaily) ? rawDaily.trim() : undefined;

  const rawDeck = firstParam(params.deck) as StarterDeckId | undefined;
  const initialDeckId = rawDeck && rawDeck in STARTER_DECK_BY_ID ? rawDeck : undefined;

  const rawLevel = firstParam(params.level)?.trim();
  const initialLevelId = rawLevel && VALID_LEVEL_IDS.has(rawLevel) ? rawLevel : undefined;

  const rawFighter = firstParam(params.fighter)?.trim().toLowerCase();
  const initialFighter = rawFighter
    ? FIGHTER_NAMES.find(n => n.toLowerCase() === rawFighter)
    : undefined;

  const rawAsc = firstParam(params.asc)?.trim();
  const initialAscension =
    rawAsc && /^\d+$/.test(rawAsc)
      ? Math.max(0, Math.min(20, Number.parseInt(rawAsc, 10)))
      : undefined;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: COLORS.paperBeige }}>
      <View className="flex-1">
        <Game
          autoPlayer={isAutoPlayer}
          labsEnabled={labsEnabled}
          initialMode={initialMode}
          initialSeed={initialSeed}
          initialNumericSeed={initialNumericSeed}
          initialDaily={initialDaily}
          initialDailyDate={initialDailyDate}
          initialDeckId={initialDeckId}
          initialLevelId={initialLevelId}
          initialFighter={initialFighter}
          initialAscension={initialAscension}
        />
      </View>
    </SafeAreaView>
  );
}
