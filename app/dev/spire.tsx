import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import type { CharacterName } from '@/types';
import { ARCANA } from '@/adventure/data/arcana';
import { FIGHTERS } from '@/adventure/data/fighters';
import type { ArcanaId } from '@/adventure/types';
import SpireMode from '@/spire/components/SpireMode';
import { SPIRE_WEAPON_POOL } from '@/spire/data/encounters';
import { generateActMap } from '@/spire/engine/mapGen';
import { createSpireRun, MAX_SUMMIT_WEAPONS, selectSpireNode, startSpireEncounter } from '@/spire/engine/runState';
import type { SpireNodeKind, SpireRun } from '@/spire/types';

/**
 * Dev Starfall Summit Page (/dev/spire)
 *
 * URL params:
 * - ?start=true       — jump straight onto the Act map with a fresh run
 * - ?act=1|2|3        — start in Act 1, 2, or 3 (default 1)
 * - ?fight=true       — enter the Act's opening battle immediately
 * - ?room=shop|campfire|event|treasure — jump directly into a specific room
 * - ?fullBelt=true    — populate all 6 weapon slots to test 6/6 swap UX
 * - ?weapons=a,b,...  — equip exact weapon ids (up to 6)
 * - ?arcana=a,b       — equip exact Arcana ids
 * - ?evo=true         — boost Catalyst spawn rate so Evolutions ignite quickly
 * - ?fighter=Sly+Fox  — fighter name (default Orange Tabby)
 * - ?ascension=0..20  — ascension tier (default 0)
 * - ?seed=12345       — deterministic seed
 * - ?autoplay=true    — board plays itself inside battles
 */
export default function DevSpire() {
  const params = useLocalSearchParams<{
    start?: string;
    act?: string;
    fight?: string;
    room?: string;
    fullBelt?: string;
    weapons?: string;
    arcana?: string;
    evo?: string;
    fighter?: string;
    ascension?: string;
    seed?: string;
    autoplay?: string;
  }>();

  const fighter = (FIGHTERS.find(f => f.name === params.fighter)?.name ?? 'Orange Tabby') as CharacterName;
  const ascension = Number.isFinite(Number(params.ascension)) ? Math.max(0, Number(params.ascension)) : 0;
  const seed = Number.isFinite(Number(params.seed)) ? Number(params.seed) : 4242;
  const actNum = Number.isFinite(Number(params.act)) ? Math.max(1, Math.min(3, Math.round(Number(params.act)))) : 1;

  let initialRun: SpireRun | undefined;
  if (params.start === 'true' || params.room || params.fight === 'true') {
    let run = createSpireRun(fighter, ascension, seed);
    if (actNum > 1) {
      run = {
        ...run,
        act: actNum,
        floor: (actNum - 1) * 7,
        map: generateActMap(actNum, seed, ascension, [], []),
      };
    }
    if (params.weapons) {
      const validIds = new Set(SPIRE_WEAPON_POOL);
      const list = params.weapons
        .split(',')
        .map(s => s.trim())
        .filter(id => validIds.has(id))
        .slice(0, MAX_SUMMIT_WEAPONS);
      if (list.length > 0) {
        const defaultLv = actNum >= 3 ? 3 : 2;
        const weaponLevels: Record<string, number> = {};
        for (const id of list) weaponLevels[id] = defaultLv;
        run = { ...run, weapons: list, weaponLevels };
      }
    } else if (params.fullBelt === 'true') {
      const extra = SPIRE_WEAPON_POOL.filter(id => !run.weapons.includes(id)).slice(
        0,
        Math.max(0, MAX_SUMMIT_WEAPONS - run.weapons.length)
      );
      const weapons = [...run.weapons, ...extra].slice(0, MAX_SUMMIT_WEAPONS);
      const weaponLevels: Record<string, number> = {};
      for (const id of weapons) weaponLevels[id] = run.weaponLevels[id] ?? 2;
      run = { ...run, weapons, weaponLevels };
    }
    if (params.arcana) {
      const validArcana = new Set<string>(ARCANA.map(a => a.id));
      const arcana = params.arcana
        .split(',')
        .map(s => s.trim())
        .filter((id): id is ArcanaId => validArcana.has(id));
      if (arcana.length > 0) run = { ...run, arcana };
    }
    if (params.evo === 'true') {
      run = { ...run, extraEvolutionLikelihood: 95 };
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
    } else if (params.fight === 'true') {
      const entrance = run.map.nodes.find(n => n.row === 0 && (n.kind === 'skirmish' || n.kind === 'elite' || n.kind === 'boss'));
      if (entrance) {
        run = selectSpireNode(run, entrance.id);
        run = startSpireEncounter(run);
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
