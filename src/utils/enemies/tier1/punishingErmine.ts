/**
 * Punishing Ermine - Tier 1 Enemy
 *
 * Effect: On invalid match, 2 extra cards are removed
 * Defeat Condition: Make no invalid matches
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { ExtraCardRemovalOnInvalidEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Punishing Ermine enemy instance.
 */
export function createPunishingErmine(): EnemyInstance {
  return composeEffects(
    {
      name: 'Punishing Ermine',
      icon: 'delapouite/ermine',
      tier: 1,
      description: 'On invalid match, 2 extra cards are removed',
      defeatConditionText: 'Make no invalid matches',
    },
    [
      {
        behavior: ExtraCardRemovalOnInvalidEffect,
        config: { count: 2, minBoardSize: 6 },
      },
    ],
    // Defeat condition: Make no invalid matches (must have at least 1 valid match)
    (stats: RoundStats) => {
      return stats.invalidMatches === 0 && stats.totalMatches >= 1;
    }
  );
}

// Register with factory
registerEnemy('Punishing Ermine', createPunishingErmine);
