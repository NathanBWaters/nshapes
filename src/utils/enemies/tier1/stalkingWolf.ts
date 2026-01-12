/**
 * Stalking Wolf - Tier 1 Enemy
 *
 * Effect: 45s inactivity bar → lose 1 health
 * Defeat Condition: Match 3 times in under 5s each
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { InactivityEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Stalking Wolf enemy instance.
 */
export function createStalkingWolf(): EnemyInstance {
  return composeEffects(
    {
      name: 'Stalking Wolf',
      icon: 'lorc/wolf-head',
      tier: 1,
      description: '45s inactivity → lose 1 health',
      defeatConditionText: 'Match 3 times in under 5s each',
    },
    [
      {
        behavior: InactivityEffect,
        config: { maxMs: 45000, penalty: 'damage' as const },
      },
    ],
    // Defeat condition: 3 matches in under 5s each
    // We need to track matches that were made in under 5s (5000ms)
    // "under" means strictly less than
    (stats: RoundStats) => {
      const fastMatches = stats.matchTimes.filter((time) => time < 5000);
      return fastMatches.length >= 3;
    }
  );
}

// Register with factory
registerEnemy('Stalking Wolf', createStalkingWolf);
