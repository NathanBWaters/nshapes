/**
 * Wet Crab - Tier 1 Enemy
 *
 * Effect: Fire effects divided by 3
 * Defeat Condition: Get 2 all-same color matches
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { WeaponCounterEffect, composeEffects } from '../../enemyEffects';

export function createWetCrab(): EnemyInstance {
  return composeEffects(
    {
      name: 'Wet Crab',
      icon: 'lorc/crab',
      tier: 1,
      description: 'Fire effects divided by 3',
      defeatConditionText: 'Get 2 all-same color matches',
    },
    [
      {
        behavior: WeaponCounterEffect,
        config: { type: 'fire', reduction: 15 },
      },
    ],
    (stats: RoundStats) => stats.allSameColorMatches >= 2
  );
}
