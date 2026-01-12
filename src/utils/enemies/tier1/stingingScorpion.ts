/**
 * Stinging Scorpion - Tier 1 Enemy
 *
 * Effect: 2x damage taken, 2x points earned
 * Defeat Condition: Make no invalid matches
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { DamageMultiplierEffect, PointsMultiplierEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Stinging Scorpion enemy instance.
 */
export function createStingingScorpion(): EnemyInstance {
  return composeEffects(
    {
      name: 'Stinging Scorpion',
      icon: 'delapouite/scorpion',
      tier: 1,
      description: '2x damage taken, 2x points earned',
      defeatConditionText: 'Make no invalid matches',
    },
    [
      {
        behavior: DamageMultiplierEffect,
        config: { multiplier: 2.0 },
      },
      {
        behavior: PointsMultiplierEffect,
        config: { multiplier: 2.0 },
      },
    ],
    // Defeat condition: Make no invalid matches
    (stats: RoundStats) => {
      // Must have made at least 1 match AND no invalid matches
      return stats.totalMatches >= 1 && stats.invalidMatches === 0;
    }
  );
}

// Register with factory
registerEnemy('Stinging Scorpion', createStingingScorpion);
