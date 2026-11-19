import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import AdventureMode from '@/adventure/AdventureMode';
import { createMaxedSave, createNewSave, createSaveBefore } from '@/adventure/progress';

/**
 * Dev Adventure Page (/dev/adventure)
 *
 * URL params:
 * - ?save=maxed  — everything unlocked, 3★ everywhere, 50k coins (not persisted until you play)
 * - ?save=fresh  — brand new save
 * - ?save=before:1-4 — ★★★ on every main level before 1-4, so 1-4 is next (any main level id works)
 * - ?keys=ready  — with save=before:X-Y, leave reached Golden Rescue Keys unclaimed on the map
 * - ?rescue=key-1 — open the Friend Rescue modal directly for that Golden Key
 * - ?autoplay=true — the board plays itself (for watching flows end to end)
 * - ?intro=false — a fresh save opens on the map instead of the story and the first fight
 */
export default function DevAdventure() {
  const params = useLocalSearchParams<{ save?: string; keys?: string; rescue?: string; autoplay?: string; intro?: string }>();
  const leaveKeysReady = params.keys === 'ready' || Boolean(params.rescue);
  const initialSave =
    params.save === 'maxed' ? createMaxedSave()
    : params.save === 'fresh' ? createNewSave()
    : params.save?.startsWith('before:') ? createSaveBefore(params.save.slice('before:'.length), { leaveKeysReady })
    : undefined;
  return (
    <View style={{ flex: 1 }}>
      <AdventureMode
        initialSave={initialSave}
        autoPlayer={params.autoplay === 'true'}
        coldOpen={params.intro !== 'false'}
        devRescueKeyId={params.rescue || undefined}
        onExit={() => router.replace('/')}
      />
    </View>
  );
}
