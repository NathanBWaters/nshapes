import React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import type { CharacterName } from '@/types';
import AdventureMode from '@/adventure/AdventureMode';
import { ARCANA } from '@/adventure/data/arcana';
import { ALL_ARMORY_WEAPON_IDS } from '@/adventure/data/armory';
import { FIGHTERS } from '@/adventure/data/fighters';
import { LEVELS } from '@/adventure/data/levels';
import { UPGRADES } from '@/adventure/data/upgrades';
import { createMaxedSave, createNewSave, createSaveBefore } from '@/adventure/progress';
import type { AdventureSave, ArcanaId } from '@/adventure/types';

/**
 * Dev Adventure Page (/dev/adventure)
 *
 * URL params:
 * - ?save=maxed  — everything unlocked, 3★ everywhere, 50k coins (not persisted until you play)
 * - ?save=fresh  — brand new save
 * - ?save=before:1-4 — ★★★ on every main level before 1-4, so 1-4 is next (any main level id works)
 * - ?level=5-4   — jump straight into a live fight for that level id
 * - ?weapons=a,b — equip exact Armory weapon ids (ensures armory, World boss slots & charm_belt capacity)
 * - ?arcana=a,b  — equip exact Arcana ids (ensures unlockedArcana & tarot_deck capacity)
 * - ?fighter=Sly+Fox — pick starting fighter
 * - ?seed=4242   — deterministic fight seed (with ?level=...)
 * - ?keys=ready  — with save=before:X-Y, leave reached Golden Rescue Keys unclaimed on the map
 * - ?rescue=key-1 — open the Friend Rescue modal directly for that Golden Key
 * - ?autoplay=true — the board plays itself (for watching flows end to end)
 * - ?intro=false — a fresh save opens on the map instead of the story and the first fight
 */
export default function DevAdventure() {
  const params = useLocalSearchParams<{
    save?: string;
    level?: string;
    weapons?: string;
    arcana?: string;
    fighter?: string;
    seed?: string;
    keys?: string;
    rescue?: string;
    autoplay?: string;
    intro?: string;
  }>();
  const leaveKeysReady = params.keys === 'ready' || Boolean(params.rescue);
  let initialSave: AdventureSave | undefined =
    params.save === 'maxed' ? createMaxedSave()
    : params.save === 'fresh' ? createNewSave()
    : params.save?.startsWith('before:') ? createSaveBefore(params.save.slice('before:'.length), { leaveKeysReady })
    : undefined;

  const devLevelId = params.level && LEVELS.some(l => l.id === params.level) ? params.level : undefined;
  const devSeed = params.seed !== undefined && Number.isFinite(Number(params.seed)) ? Number(params.seed) : undefined;

  if (initialSave && (params.weapons !== undefined || params.arcana !== undefined || params.fighter)) {
    const next: AdventureSave = { ...initialSave };
    if (params.fighter) {
      const match = FIGHTERS.find(f => f.name === params.fighter);
      if (match) {
        next.selectedFighter = match.name as CharacterName;
        if (!next.unlockedFighters.includes(match.name)) {
          next.unlockedFighters = [...next.unlockedFighters, match.name];
        }
      }
    }
    if (params.weapons !== undefined) {
      const validIds = new Set(ALL_ARMORY_WEAPON_IDS);
      const list = params.weapons
        .split(',')
        .map(s => s.trim())
        .filter(id => id.length > 0 && validIds.has(id));
      next.armory = [...new Set([...next.armory, ...list])];
      next.charms = list;
      if (list.length >= 4) {
        next.stars = { ...next.stars, '1-10': Math.max(1, next.stars['1-10'] ?? 0) };
      }
      if (list.length >= 5) {
        next.stars = { ...next.stars, '2-10': Math.max(1, next.stars['2-10'] ?? 0) };
      }
      if (list.length >= 6) {
        const beltMax = UPGRADES.find(u => u.id === 'charm_belt')?.costs.length ?? 1;
        next.upgrades = { ...next.upgrades, charm_belt: Math.max(next.upgrades.charm_belt ?? 0, beltMax) };
      }
    }
    if (params.arcana !== undefined) {
      const validArcana = new Set<string>(ARCANA.map(a => a.id));
      const list = params.arcana
        .split(',')
        .map(s => s.trim())
        .filter((id): id is ArcanaId => validArcana.has(id));
      next.unlockedArcana = [...new Set([...next.unlockedArcana, ...list])];
      next.equippedArcana = list;
      if (list.length > 1) {
        const deckMax = UPGRADES.find(u => u.id === 'tarot_deck')?.costs.length ?? 2;
        next.upgrades = { ...next.upgrades, tarot_deck: Math.min(deckMax, Math.max(next.upgrades.tarot_deck ?? 0, list.length - 1)) };
      }
    }
    initialSave = next;
  }

  return (
    <View style={{ flex: 1 }}>
      <AdventureMode
        initialSave={initialSave}
        autoPlayer={params.autoplay === 'true'}
        coldOpen={params.intro !== 'false'}
        devRescueKeyId={params.rescue || undefined}
        devLevelId={devLevelId}
        devSeed={devSeed}
        onExit={() => router.replace('/')}
      />
    </View>
  );
}
