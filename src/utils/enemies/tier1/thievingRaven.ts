/**
 * Thieving Raven - Tier 1 Enemy
 *
 * Effect: -5s stolen per match
 * Defeat Condition: Complete 5 matches total
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { TimeStealEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Thieving Raven enemy instance.
 */
export function createThievingRaven(): EnemyInstance {
  return composeEffects(
    {
      name: 'Thieving Raven',
      icon: 'lorc/raven',
      tier: 1,
      description: '-5s stolen per match',
      defeatConditionText: 'Complete 5 matches total',
    },
    [
      {
        behavior: TimeStealEffect,
        config: { amount: 5 }, // 5 seconds stolen per match
      },
    ],
    // Defeat condition: Complete 5 matches total
    (stats: RoundStats) => {
      return stats.totalMatches >= 5;
    }
  );
}

// Register with factory
registerEnemy('Thieving Raven', createThievingRaven);
