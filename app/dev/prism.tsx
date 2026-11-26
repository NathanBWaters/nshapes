import React from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import PrismMode from '@/prism/components/PrismMode';
import { STARTER_DECK_BY_ID, normalizeSeed } from '@/prism';
import type { StarterDeckId } from '@/prism';

const firstParam = (val?: string | string[]): string | undefined =>
  Array.isArray(val) ? val[0] : val;

/**
 * Dev / Labs Prism Deck Route (/dev/prism)
 *
 * Launches Prism Deck directly even while hidden off the default Day-1 MainMenu.
 * Supports ?seed=..., ?daily=1|YYYY-MM-DD, and ?deck=... query params.
 */
export default function DevPrism() {
  const params = useLocalSearchParams<{
    seed?: string;
    daily?: string;
    deck?: string;
  }>();

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
    <View style={{ flex: 1 }}>
      <PrismMode
        onExit={() => router.replace('/')}
        initialSeed={initialSeed}
        initialDaily={initialDaily}
        initialDailyDate={initialDailyDate}
        initialDeckId={initialDeckId}
      />
    </View>
  );
}
