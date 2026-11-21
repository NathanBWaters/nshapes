import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import type { CharacterName } from '@/types';
import { FIGHTERS } from '@/adventure/data/fighters';
import SpireMode from '@/spire/components/SpireMode';
import { SPIRE_WEAPON_POOL } from '@/spire/data/encounters';
import { createSpireRun, MAX_SUMMIT_WEAPONS, selectSpireNode } from '@/spire/engine/runState';
import type { SpireNodeKind, SpireRun } from '@/spire/types';

/**
 * Dev Starfall Spire Page (/dev/spire)
 *
 * URL params:
 * - ?start=true       — jump straight onto the Act 1 map with a fresh run
 * - ?room=shop|campfire|event|treasure — jump directly into a specific room
 * - ?fullBelt=true    — populate all 6 weapon slots to test 6/6 swap UX
 * - ?fighter=Sly+Fox  — fighter name (default Orange Tabby)
 * - ?ascension=0..20  — ascension tier (default 0)
 * - ?seed=12345       — deterministic seed
 * - ?autoplay=true    — board plays itself inside battles
 */
export default function DevSpire() {
  const params = useLocalSearchParams<{
    start?: string;
    room?: string;
    fullBelt?: string;
    fighter?: string;
    ascension?: string;
    seed?: string;
    autoplay?: string;
  }>();

  const fighter = (FIGHTERS.find(f => f.name === params.fighter)?.name ?? 'Orange Tabby') as CharacterName;
  const ascension = Number.isFinite(Number(params.ascension)) ? Math.max(0, Number(params.ascension)) : 0;
  const seed = Number.isFinite(Number(params.seed)) ? Number(params.seed) : 4242;

  let initialRun: SpireRun | undefined;
  if (params.start === 'true' || params.room) {
    let run = createSpireRun(fighter, ascension, seed);
    if (params.fullBelt === 'true') {
      const extra = SPIRE_WEAPON_POOL.filter(id => !run.weapons.includes(id)).slice(
        0,
        Math.max(0, MAX_SUMMIT_WEAPONS - run.weapons.length)
      );
      const weapons = [...run.weapons, ...extra].slice(0, MAX_SUMMIT_WEAPONS);
      const weaponLevels: Record<string, number> = {};
      for (const id of weapons) weaponLevels[id] = run.weaponLevels[id] ?? 2;
      run = { ...run, weapons, weaponLevels };
    }
    const roomKind = params.room as SpireNodeKind | undefined;
    if (roomKind && ['shop', 'campfire', 'event', 'treasure'].includes(roomKind)) {
      const target = run.map.nodes.find(n => n.kind === roomKind);
      if (target) {
        // Expose target node as Row 0 reachable and stock coins/hearts so all room actions are testable
        run = {
          ...run,
          coins: 260,
          hearts: Math.max(2, run.maxHearts - 2),
          map: {
            ...run.map,
            nodes: run.map.nodes.map(n => (n.id === target.id ? { ...n, row: 0 } : n)),
          },
        };
        run = selectSpireNode(run, target.id);
      }
    }
    initialRun = run;
  }

  return (
    <View style={{ flex: 1 }}>
      <SpireMode
        initialRun={initialRun}
        autoPlayer={params.autoplay === 'true'}
        onExit={() => router.replace('/')}
      />
    </View>
  );
}
