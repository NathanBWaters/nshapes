/**
 * Greedy Squirrel - Tier 1 Enemy
 *
 * Effect: On match, 1 extra card is removed
 * Defeat Condition: Beat target score with 8+ cards remaining
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { ExtraCardRemovalOnMatchEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Greedy Squirrel enemy instance.
 */
export function createGreedySquirrel(): EnemyInstance {
  return composeEffects(
    {
      name: 'Greedy Squirrel',
      icon: 'delapouite/squirrel',
      tier: 1,
      description: 'On match, 1 extra card is removed',
      defeatConditionText: 'Beat target score with 8+ cards remaining',
    },
    [
      {
        behavior: ExtraCardRemovalOnMatchEffect,
        config: { count: 1, minBoardSize: 6 },
      },
    ],
    // Defeat condition: Achieve minimum score with 8+ cards remaining
    (stats: RoundStats) => {
      return stats.currentScore >= stats.targetScore && stats.cardsRemaining >= 8;
    }
  );
}

// Register with factory
registerEnemy('Greedy Squirrel', createGreedySquirrel);
