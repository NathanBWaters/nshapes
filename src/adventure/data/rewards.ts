/**
 * What a reward unlocks, and the reverse: where each unlockable thing comes
 * from. "Earn ★★ on 1-7 …" style hints are written from this index, so they
 * follow the level and bounty tables instead of restating them.
 */
import type { CharacterName } from '@/types';
import type { ArcanaId, BountyDef, LevelDef, RewardDef, UnlockableFeature } from '../types';
import { LEVELS, getLevel } from './levels';
import { worldNumber } from './biomes';
import { BOUNTIES } from './bounties';
import { FEATURES } from './features';

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

const describeSource = (s: UnlockSource): string => {
  if (s.via === 'bounty') return `Complete the ${s.bounty.name} bounty`;
  const { level } = s;
  const elite = level.branchOf ? ` (World ${worldNumber(level.biome)} Elite)` : '';
  return `Earn ${'★'.repeat(s.via === 'star' ? s.star : 1)} on ${level.id} ${level.name}${elite}`;
};

/** How to get it, in a few words, or null when nothing in the game grants it. */
export const unlockHint = (u: Unlockable): string | null => {
  const source = unlockSource(u);
  return source ? describeSource(source) : null;
};
