/**
 * Foggy Frog - Tier 1 Enemy
 *
 * Effect: Hint effects divided by 3
 * Defeat Condition: Beat target score with 2+ hints remaining
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { WeaponCounterEffect, composeEffects } from '../../enemyEffects';

export function createFoggyFrog(): EnemyInstance {
  return composeEffects(
    {
      name: 'Foggy Frog',
      icon: 'lorc/frog',
      tier: 1,
      description: 'Hint effects divided by 3',
      defeatConditionText: 'Beat target score with 2+ hints remaining',
    },
    [
      {
        behavior: WeaponCounterEffect,
        config: { type: 'hint', reduction: 15 },
      },
    ],
    (stats: RoundStats) => {
      return stats.currentScore >= stats.targetScore && stats.hintsRemaining >= 2;
    }
  );
}
