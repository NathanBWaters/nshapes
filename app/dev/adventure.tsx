import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import AdventureMode from '@/adventure/AdventureMode';
import { createMaxedSave, createNewSave } from '@/adventure/progress';

/**
 * Dev Adventure Page (/dev/adventure)
 *
 * URL params:
 * - ?save=maxed  — everything unlocked, 3★ everywhere, 50k coins (not persisted until you play)
 * - ?save=fresh  — brand new save
 * - ?autoplay=true — the board plays itself (for watching flows end to end)
 */
export default function DevAdventure() {
  const params = useLocalSearchParams<{ save?: string; autoplay?: string }>();
  const initialSave = params.save === 'maxed' ? createMaxedSave() : params.save === 'fresh' ? createNewSave() : undefined;
  return (
    <View style={{ flex: 1 }}>
      <AdventureMode
        initialSave={initialSave}
        autoPlayer={params.autoplay === 'true'}
        onExit={() => router.replace('/')}
      />
    </View>
  );
}
