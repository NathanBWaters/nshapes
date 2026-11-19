/**
 * Angry Birds 2–style Golden Rescue Keys placed directly along the winding
 * Adventure Map road between consecutive same-biome main levels.
 *
 * Walking over a reached key (or tapping it on the map) opens the Friend Rescue
 * picker so the player can choose ANY remaining caged friend to free first.
 * Every key redeems one friend permanently, and the 5 keys match the 5
 * unlockable friends one-to-one.
 */
import type { CharacterName } from '@/types';
import type { AdventureSave, FighterDef } from '../types';
import { FIGHTERS, STARTING_FIGHTERS } from './fighters';

export interface MapKeyDef {
  id: string;
  /** Main level that must be cleared (≥1★) to reach this Golden Key */
  afterLevel: string;
  /** Next consecutive main level in the same biome */
  beforeLevel: string;
  /** Default friend chosen by dev/test helpers when pre-populating saves */
  defaultFighter: CharacterName;
  /** Short regional label shown in the rescue modal header */
  location: string;
}

/**
 * 5 Golden Keys along Worlds 1–3, always between two consecutive main nodes
 * in the same biome (never spanning a biome banner):
 *   1-5 ↔ 1-6 (mid Sunny Meadow — first rescue!)
 *   1-9 ↔ 1-10 (before World 1 Boss — second ally!)
 *   2-5 ↔ 2-6 (mid Whispering Woods)
 *   2-9 ↔ 2-10 (before World 2 Boss)
 *   3-5 ↔ 3-6 (mid Ember Canyon — complete the crew!)
 */
export const MAP_KEYS: readonly MapKeyDef[] = [
  { id: 'key-1', afterLevel: '1-5', beforeLevel: '1-6', defaultFighter: 'Sly Fox', location: 'Sunny Meadow' },
  { id: 'key-2', afterLevel: '1-9', beforeLevel: '1-10', defaultFighter: 'Corgi', location: 'Meadow Overlook' },
  { id: 'key-3', afterLevel: '2-5', beforeLevel: '2-6', defaultFighter: 'Badger', location: 'Whispering Woods' },
  { id: 'key-4', afterLevel: '2-9', beforeLevel: '2-10', defaultFighter: 'Emperor Penguin', location: 'Deep Thicket' },
  { id: 'key-5', afterLevel: '3-5', beforeLevel: '3-6', defaultFighter: 'Pelican', location: 'Ember Canyon' },
];

export const getMapKey = (id: string): MapKeyDef | undefined => MAP_KEYS.find(k => k.id === id);

export const mapKeyAfter = (levelId: string): MapKeyDef | undefined =>
  MAP_KEYS.find(k => k.afterLevel === levelId);

export const mapKeyBetween = (afterLevelId: string, beforeLevelId: string): MapKeyDef | undefined =>
  MAP_KEYS.find(k => k.afterLevel === afterLevelId && k.beforeLevel === beforeLevelId);

/** True once the player has cleared (≥1★) the level immediately before this key. */
export const isMapKeyReached = (save: Pick<AdventureSave, 'stars'>, key: MapKeyDef): boolean =>
  (save.stars[key.afterLevel] ?? 0) >= 1;

/** True once this key has already been redeemed to rescue a friend. */
export const isMapKeyClaimed = (save: Partial<Pick<AdventureSave, 'claimedMapKeys'>>, key: MapKeyDef): boolean =>
  Boolean(save.claimedMapKeys?.[key.id]);

/** All friends still waiting in cages (in roster order). */
export const lockedFighters = (save: Pick<AdventureSave, 'unlockedFighters'>): FighterDef[] =>
  FIGHTERS.filter(f => !save.unlockedFighters.includes(f.name));

/** Non-starting friends (the 5 rescueable friends). */
export const RESCUABLE_FIGHTERS: readonly FighterDef[] = FIGHTERS.filter(
  f => !STARTING_FIGHTERS.includes(f.name)
);

/** Every Golden Key that has been reached, not yet claimed, and still has a caged friend to free. */
export const readyMapKeys = (
  save: Pick<AdventureSave, 'stars' | 'unlockedFighters'> & Partial<Pick<AdventureSave, 'claimedMapKeys'>>
): MapKeyDef[] => {
  if (lockedFighters(save).length === 0) return [];
  return MAP_KEYS.filter(k => isMapKeyReached(save, k) && !isMapKeyClaimed(save, k));
};

/** The next unclaimed Golden Key along the map (reached or upcoming). */
export const nextMapKeyFor = (
  save?: Partial<Pick<AdventureSave, 'stars' | 'claimedMapKeys'>>
): MapKeyDef | undefined => {
  if (!save) return MAP_KEYS[0];
  return MAP_KEYS.find(k => !isMapKeyClaimed(save, k));
};
