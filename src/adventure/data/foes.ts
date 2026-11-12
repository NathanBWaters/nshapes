/** Turns a level's foe definition into the enemy to fight and how it is shown. */
import { createEnemy, isEnemyRegistered } from '@/utils/enemyFactory';
import { createDummyEnemy } from '@/utils/enemyEffects';
import type { EnemyInstance } from '@/types/enemy';
import type { IconName } from '@/components/Icon';
import type { FoeDef, LevelDef } from '../types';

export interface Foe {
  foe: EnemyInstance;
  name: string;
  icon: IconName;
  /** A sparring foe has no enemy behind it: it just soaks up damage */
  sparring: boolean;
}

/** A fresh foe instance (enemies carry their own timers, so never share one between fights). */
export const createFoe = (def: FoeDef): Foe => {
  if (def.enemy && isEnemyRegistered(def.enemy)) {
    const foe = createEnemy(def.enemy);
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

export const foeDisplay = (def: FoeDef): FoeDisplay => {
  const key = `${def.enemy ?? ''}|${def.name ?? ''}|${def.icon ?? ''}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { foe, name, icon, sparring } = createFoe(def);
  const out: FoeDisplay = { name, icon, ability: sparring ? null : foe.description, tier: sparring ? 1 : foe.tier };
  cache.set(key, out);
  return out;
};

/** The foe shown on the map node (the last / boss foe). */
export const levelFoe = (level: LevelDef): FoeDisplay => foeDisplay(level.foes[level.foes.length - 1]);

/** What the last real enemy of a level asks of the player, if the level has one. */
export const levelDefeatCondition = (level: LevelDef): string | null => {
  const def = [...level.foes].reverse().find(f => !createFoe(f).sparring);
  return def ? createFoe(def).foe.defeatConditionText : null;
};
