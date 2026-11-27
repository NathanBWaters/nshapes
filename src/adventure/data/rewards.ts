/**
 * What a reward unlocks, and the reverse: where each unlockable thing comes
 * from. "Earn ★★ on 1-7 …" and weapon-gated bounty hints are written from this
 * index, so they follow the level and bounty tables instead of restating them.
 */
import type { CharacterName } from '@/types';
import type { AdventureSave, ArcanaId, BountyDef, LevelDef, RewardDef, UnlockableFeature } from '../types';
import { LEVELS, getLevel, isPathHidden } from './levels';
import { worldNumber } from './biomes';
import { BOUNTIES } from './bounties';
import { armoryBaseWeapon } from './armory';
import { FEATURES } from './features';
import { MECHANICS } from './mechanics';
import { MAP_KEYS, isMapKeyClaimed, isMapKeyReached, nextMapKeyFor } from './mapKeys';

/** A side branch that teaches a fighter (rather than an Elite foe). */
export const isFighterTrial = (level: LevelDef): boolean => !!level.branchOf && MECHANICS[level.introduces]?.kind === 'fighter';

export type Unlockable =
  | { kind: 'feature'; id: UnlockableFeature }
  | { kind: 'fighter'; id: CharacterName }
  | { kind: 'weapon'; id: string }
  | { kind: 'arcana'; id: ArcanaId }
  | { kind: 'evolution'; id: string };

/** Everything a reward unlocks besides coins, in the order it is granted and revealed. */
export const unlockablesOf = (reward: RewardDef): Unlockable[] => [
  ...(reward.unlockFeature ? [{ kind: 'feature', id: reward.unlockFeature } as const] : []),
  ...(reward.character ? [{ kind: 'fighter', id: reward.character } as const] : []),
  ...(reward.weapons ?? []).map(id => ({ kind: 'weapon', id }) as const),
  ...(reward.arcana ? [{ kind: 'arcana', id: reward.arcana } as const] : []),
  ...(reward.evolution ? [{ kind: 'evolution', id: reward.evolution } as const] : []),
];

export const starRewards = (level: LevelDef): RewardDef[] => [level.rewards.star1, level.rewards.star2, level.rewards.star3];

export type UnlockSource =
  | { via: 'star'; level: LevelDef; star: number }
  /** The first star on a level, outside its star rewards (CampaignFeatureDef.clearLevel) */
  | { via: 'clear'; level: LevelDef }
  | { via: 'bounty'; bounty: BountyDef };

const keyOf = (u: Unlockable) => `${u.kind}:${u.id}`;

const SOURCES = new Map<string, UnlockSource[]>();
const addSource = (u: Unlockable, source: UnlockSource) => {
  const list = SOURCES.get(keyOf(u));
  if (list) list.push(source);
  else SOURCES.set(keyOf(u), [source]);
};
for (const level of LEVELS) {
  starRewards(level).forEach((reward, i) => {
    for (const u of unlockablesOf(reward)) addSource(u, { via: 'star', level, star: i + 1 });
  });
}
for (const f of FEATURES) {
  if (f.clearLevel) addSource({ kind: 'feature', id: f.id }, { via: 'clear', level: getLevel(f.clearLevel) });
}
for (const bounty of BOUNTIES) {
  for (const u of unlockablesOf(bounty.reward)) addSource(u, { via: 'bounty', bounty });
}

/** Every place that grants this, campaign levels first. */
export const unlockSources = (u: Unlockable): UnlockSource[] => SOURCES.get(keyOf(u)) ?? [];

export const unlockSource = (u: Unlockable): UnlockSource | null => unlockSources(u)[0] ?? null;

type HintSaveContext = Pick<AdventureSave, 'stars'> &
  Partial<Pick<AdventureSave, 'claimedMapKeys' | 'unlockedFighters' | 'armory'>>;

const describeSource = (s: UnlockSource, save?: HintSaveContext): string => {
  if (s.via === 'bounty') {
    const reqWeapon = s.bounty.requiresWeapon;
    if (reqWeapon) {
      const weaponName = armoryBaseWeapon(reqWeapon)?.name ?? reqWeapon;
      if (save?.armory && !save.armory.includes(reqWeapon)) {
        return `Unlock ${weaponName}, then complete its '${s.bounty.name}' bounty`;
      }
      return `Complete ${weaponName}'s '${s.bounty.name}' bounty`;
    }
    return `Complete the '${s.bounty.name}' bounty`;
  }
  const { level } = s;
  // A side path that has not opened yet stays a secret
  if (save && isPathHidden(level, save)) return `Hidden on a secret path in World ${worldNumber(level.biome)}`;
  const elite = level.branchOf ? ` (World ${worldNumber(level.biome)} ${isFighterTrial(level) ? 'trial' : 'Elite'})` : '';
  return `Earn ${'★'.repeat(s.via === 'star' ? s.star : 1)} on ${level.id} ${level.name}${elite}`;
};

/** Plain-English milestone hint for the 4th, 5th, and optional 6th weapon belt slots. */
export const weaponSlotMilestoneHint = (slotNumber: 4 | 5 | 6): string => {
  if (slotNumber === 4) return 'Defeat the World 1 Boss (1-10) to unlock your 4th weapon slot.';
  if (slotNumber === 5) return 'Defeat the World 2 Boss (2-10) to unlock your 5th weapon slot.';
  return 'Buy Charm Belt in the Camp Workshop for an optional 6th weapon slot.';
};

/**
 * How to get it, in a few words, or null when nothing in the game grants it.
 * With the player's save, a source on a side path they have not found is not named,
 * and weapon-gated bounties tell you whether to unlock the required weapon first.
 */
export const unlockHint = (
  u: Unlockable,
  save?: HintSaveContext
): string | null => {
  const source = unlockSource(u);
  if (source) return describeSource(source, save);
  if (u.kind === 'fighter') {
    if (save && MAP_KEYS.some(k => isMapKeyReached(save, k) && !isMapKeyClaimed(save, k))) {
      return 'A Golden Key is waiting on the map! Tap it to free this friend.';
    }
    const nextKey = nextMapKeyFor(save);
    if (nextKey) {
      return `Find a Golden Key on the map (after ${nextKey.afterLevel}) to free any caged friend.`;
    }
    return 'Find a Golden Key on the map to free this friend.';
  }
  return null;
};
