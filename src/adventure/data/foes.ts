/** Turns a level's foe definition into the enemy to fight and how it is shown. */
import { createEnemy, isEnemyRegistered } from '@/utils/enemyFactory';
import { createDummyEnemy } from '@/utils/enemyEffects';
import { createHydraHead, type HydraHeadPhase } from '@/utils/enemies/tier4/theHydra';
import type { EnemyInstance } from '@/types/enemy';
import type { IconName } from '@/components/Icon';
import type { FoeDef, LevelDef } from '../types';
import type {} from './relief';

export interface Foe {
  foe: EnemyInstance;
  name: string;
  icon: IconName;
  /** A sparring foe has no enemy behind it: it just soaks up damage */
  sparring: boolean;
}

const HYDRA_PHASE_KEY: Record<string, HydraHeadPhase> = {
  'The Hydra#1': 1,
  'The Hydra#2': 2,
  'The Hydra#3': 3,
};

/** A fresh foe instance (enemies carry their own timers, so never share one between fights). */
export const createFoe = (def: FoeDef, rng?: () => number): Foe => {
  const hydraPhase = def.hydraPhase ?? (def.enemy ? HYDRA_PHASE_KEY[def.enemy] : undefined);
  if (hydraPhase !== undefined && (!def.enemy || def.enemy === 'The Hydra' || def.enemy in HYDRA_PHASE_KEY)) {
    const foe = createHydraHead(hydraPhase);
    return { foe, name: def.name ?? foe.name, icon: def.icon ?? foe.icon, sparring: false };
  }
  if (def.enemy && isEnemyRegistered(def.enemy)) {
    const foe = createEnemy(def.enemy, rng);
    return { foe, name: def.name ?? foe.name, icon: def.icon ?? foe.icon, sparring: false };
  }
  return { foe: createDummyEnemy(), name: def.name ?? 'Sparring Foe', icon: def.icon ?? 'lorc/crossed-swords', sparring: true };
};

export interface FoeDisplay {
  name: string;
  icon: IconName;
  /** What the foe does (empty for sparring foes) */
  ability: string | null;
  tier: number;
}

const cache = new Map<string, FoeDisplay>();
const METADATA_RNG = (): number => 0;

export const foeDisplay = (def: FoeDef): FoeDisplay => {
  const key = `${def.enemy ?? ''}|${def.hydraPhase ?? ''}|${def.name ?? ''}|${def.icon ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { foe, name, icon, sparring } = createFoe(def, METADATA_RNG);
  const out: FoeDisplay = { name, icon, ability: sparring ? null : foe.description, tier: sparring ? 1 : foe.tier };
  cache.set(key, out);
  return out;
};

/** The foe shown on the map node (the last / boss foe). */
export const levelFoe = (level: LevelDef): FoeDisplay => foeDisplay(level.foes[level.foes.length - 1]);

/** What the last real enemy of a level asks of the player, if the level has one. */
export const levelDefeatCondition = (level: LevelDef): string | null => {
  const def = [...level.foes].reverse().find(f => !createFoe(f, METADATA_RNG).sparring);
  return def ? createFoe(def, METADATA_RNG).foe.defeatConditionText : null;
};
