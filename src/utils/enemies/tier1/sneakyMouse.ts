/**
 * Sneaky Mouse - Tier 1 Enemy
 *
 * Effect: Grace gain reduced by 15%
 * Defeat Condition: Never use a grace (must have at least 1 match)
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { WeaponCounterEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Sneaky Mouse enemy instance.
 */
export function createSneakyMouse(): EnemyInstance {
  return composeEffects(
    {
      name: 'Sneaky Mouse',
      icon: 'lorc/mouse',
      tier: 1,
      description: 'Grace gain reduced by 15%',
      defeatConditionText: 'Never use a grace',
    },
    [
      {
        behavior: WeaponCounterEffect,
        config: { type: 'grace', reduction: 15 },
      },
    ],
    // Defeat condition: Never use a grace (must have at least 1 match)
    (stats: RoundStats) => {
      return stats.gracesUsed === 0 && stats.totalMatches >= 1;
    }
  );
}

// Register with factory
registerEnemy('Sneaky Mouse', createSneakyMouse);
