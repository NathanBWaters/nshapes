/**
 * Swift Bee - Tier 1 Enemy
 *
 * Effect: Timer runs 20% faster, earn 20% more points
 * Defeat Condition: Get a 5-match streak
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { TimerSpeedEffect, PointsMultiplierEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Swift Bee enemy instance.
 */
export function createSwiftBee(): EnemyInstance {
  return composeEffects(
    {
      name: 'Swift Bee',
      icon: 'lorc/bee',
      tier: 1,
      description: 'Timer runs 20% faster, earn 20% more points',
      defeatConditionText: 'Get a 5-match streak',
    },
    [
      {
        behavior: TimerSpeedEffect,
        config: { multiplier: 1.2 },
      },
      {
        behavior: PointsMultiplierEffect,
        config: { multiplier: 1.2 },
      },
    ],
    // Defeat condition: Get a 5-match streak
    (stats: RoundStats) => {
      return stats.maxStreak >= 5;
    }
  );
}

// Register with factory
registerEnemy('Swift Bee', createSwiftBee);
