/** Display info (name/icon/description) for a level's foes, cached. */
import { createEnemy, isEnemyRegistered } from '@/utils/enemyFactory';
import '@/utils/enemies';
import type { IconName } from '@/components/Icon';
import type { FoeDef, LevelDef } from '../types';

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
  let out: FoeDisplay;
  if (def.enemy && isEnemyRegistered(def.enemy)) {
    const e = createEnemy(def.enemy);
    out = { name: def.name ?? e.name, icon: def.icon ?? e.icon, ability: e.description, tier: e.tier };
  } else {
    out = { name: def.name ?? 'Sparring Foe', icon: def.icon ?? 'lorc/crossed-swords', ability: null, tier: 1 };
  }
  cache.set(key, out);
  return out;
};

/** The foe shown on the map node (the last / boss foe). */
export const levelFoe = (level: LevelDef): FoeDisplay => foeDisplay(level.foes[level.foes.length - 1]);
