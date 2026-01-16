/**
 * Stalking Wolf - Tier 1 Enemy
 *
 * Effect: 45s inactivity bar → lose 1 health
 * Defeat Condition: Match 5 times in under 8s each (achievable with focus)
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
      defeatConditionText: 'Match 5 times in under 8s each',
    },
    [
      {
        behavior: InactivityEffect,
        config: { maxMs: 45000, penalty: 'damage' as const },
      },
    ],
    // Defeat condition: 5 matches in under 8s each
    // "under" means strictly less than
    (stats: RoundStats) => {
      const fastMatches = stats.matchTimes.filter((time) => time < 8000);
      return fastMatches.length >= 5;
    }
  );
}

// Register with factory
registerEnemy('Stalking Wolf', createStalkingWolf);
