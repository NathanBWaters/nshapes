/**
 * Foggy Frog - Tier 1 Enemy
 *
 * Effect: Hint gain reduced by 15%
 * Defeat Condition: Beat target score with 2+ hints remaining
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { WeaponCounterEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Foggy Frog enemy instance.
 */
export function createFoggyFrog(): EnemyInstance {
  return composeEffects(
    {
      name: 'Foggy Frog',
      icon: 'lorc/frog',
      tier: 1,
      description: 'Hint gain reduced by 15%',
      defeatConditionText: 'Beat target score with 2+ hints remaining',
    },
    [
      {
        behavior: WeaponCounterEffect,
        config: { type: 'hint', reduction: 15 },
      },
    ],
    // Defeat condition: Achieve minimum score with 2+ hints remaining
    (stats: RoundStats) => {
      return stats.currentScore >= stats.targetScore && stats.hintsRemaining >= 2;
    }
  );
}

// Register with factory
registerEnemy('Foggy Frog', createFoggyFrog);
