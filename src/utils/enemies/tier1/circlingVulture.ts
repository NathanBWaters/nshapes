/**
 * Circling Vulture - Tier 1 Enemy
 *
 * Effect: Score drains 5 points per second
 * Defeat Condition: Reach 150% of target score
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { ScoreDecayEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Circling Vulture enemy instance.
 */
export function createCirclingVulture(): EnemyInstance {
  return composeEffects(
    {
      name: 'Circling Vulture',
      icon: 'lorc/vulture',
      tier: 1,
      description: 'Score drains 5 points per second',
      defeatConditionText: 'Reach 150% of target score',
    },
    [
      {
        behavior: ScoreDecayEffect,
        config: { ratePerSecond: 5 },
      },
    ],
    // Defeat condition: Reach 150% of target score
    (stats: RoundStats) => {
      return stats.currentScore >= stats.targetScore * 1.5;
    }
  );
}

// Register with factory
registerEnemy('Circling Vulture', createCirclingVulture);
