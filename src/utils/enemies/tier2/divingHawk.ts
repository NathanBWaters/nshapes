/**
 * Diving Hawk - Tier 2 Enemy
 *
 * Effects: Timer 35% faster (focused single hazard)
 * Defeat Condition: Get 3 all-different matches
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { TimerSpeedEffect, composeEffects } from '../../enemyEffects';

export function createDivingHawk(): EnemyInstance {
  return composeEffects(
    {
      name: 'Diving Hawk',
      icon: 'lorc/hawk-emblem',
      tier: 2,
      description: 'Timer 35% faster',
      defeatConditionText: 'Get 3 all-different matches',
    },
    [
      { behavior: TimerSpeedEffect, config: { multiplier: 1.35 } },
    ],
    (stats: RoundStats) => stats.allDifferentMatches >= 3
  );
}
