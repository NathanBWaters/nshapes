/**
 * Cackling Hyena - Tier 2 Enemy
 *
 * Effects: Thieving Raven (-3s) + Sneaky Mouse (-35% grace)
 * Defeat Condition: Match 6 times with no grace used
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { TimeStealEffect, WeaponCounterEffect, composeEffects } from '../../enemyEffects';

export function createCacklingHyena(): EnemyInstance {
  return composeEffects(
    {
      name: 'Cackling Hyena',
      icon: 'caro-asercion/hyena-head',
      tier: 2,
      description: '-3s per match, grace gain -35%',
      defeatConditionText: 'Match 6 times with no grace used',
    },
    [
      { behavior: TimeStealEffect, config: { amount: 3 } },
      { behavior: WeaponCounterEffect, config: { type: 'grace', reduction: 35 } },
    ],
    (stats: RoundStats) => stats.totalMatches >= 6 && stats.gracesUsed === 0
  );
}
