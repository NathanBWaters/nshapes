import React from 'react';
import { BEAST_PREDATOR_ENEMY_NAMES, BeastPredatorEnemyRig } from './BeastPredatorRigs';
import {
  BOSS_ARCANE_AQUATIC_ENEMY_NAMES,
  BossArcaneAquaticEnemyRig,
} from './BossArcaneAquaticRigs';
import { REPTILE_BUG_ENEMY_NAMES, ReptileBugEnemyRig } from './ReptileBugRigs';
import { RODENT_WOODLAND_ENEMY_NAMES, RodentWoodlandEnemyRig } from './RodentWoodlandRigs';
import { EnemyRigProps, getEnemyRigPivots } from './types';
import { WINGED_AVIAN_ENEMY_NAMES, WingedAvianEnemyRig } from './WingedAvianRigs';

export { getEnemyRigPivots };

const RODENT_SET = new Set<string>(RODENT_WOODLAND_ENEMY_NAMES);
const BEAST_SET = new Set<string>(BEAST_PREDATOR_ENEMY_NAMES);
const WINGED_SET = new Set<string>(WINGED_AVIAN_ENEMY_NAMES);
const REPTILE_BUG_SET = new Set<string>(REPTILE_BUG_ENEMY_NAMES);
const BOSS_ARCANE_AQUATIC_SET = new Set<string>(BOSS_ARCANE_AQUATIC_ENEMY_NAMES);

export const ALL_CUSTOM_ENEMY_RIG_NAMES: readonly string[] = [
  ...RODENT_WOODLAND_ENEMY_NAMES,
  ...BEAST_PREDATOR_ENEMY_NAMES,
  ...WINGED_AVIAN_ENEMY_NAMES,
  ...REPTILE_BUG_ENEMY_NAMES,
  ...BOSS_ARCANE_AQUATIC_ENEMY_NAMES,
];

/**
 * Dispatches any registered Tier 1–4 enemy, Adventure Mode foe, legacy enemy,
 * or sparring dummy to its bespoke multi-part animated SVG rig.
 */
export const EnemyCreatureRig: React.FC<EnemyRigProps> = (props) => {
  const { enemyName } = props;

  if (RODENT_SET.has(enemyName)) {
    return <RodentWoodlandEnemyRig {...props} />;
  }
  if (BEAST_SET.has(enemyName)) {
    return <BeastPredatorEnemyRig {...props} />;
  }
  if (WINGED_SET.has(enemyName)) {
    return <WingedAvianEnemyRig {...props} />;
  }
  if (REPTILE_BUG_SET.has(enemyName)) {
    return <ReptileBugEnemyRig {...props} />;
  }
  if (BOSS_ARCANE_AQUATIC_SET.has(enemyName)) {
    return <BossArcaneAquaticEnemyRig {...props} />;
  }

  return <BossArcaneAquaticEnemyRig {...props} />;
};
