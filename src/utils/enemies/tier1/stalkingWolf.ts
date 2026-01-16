/**
 * Stalking Wolf - Tier 1 Enemy
 *
 * Effect: 45s inactivity bar → lose 1 health
 * Defeat Condition: Get 3 matches within a 10-second window
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
      defeatConditionText: 'Get 3 matches within 10 seconds total',
    },
    [
      {
        behavior: InactivityEffect,
        config: { maxMs: 45000, penalty: 'damage' as const },
      },
    ],
    // Defeat condition: 3 consecutive matches within 10 seconds total
    // matchTimes[i] = time from match (i-1) to match i
    // So time from match A to match C = matchTimes[B] + matchTimes[C]
    (stats: RoundStats) => {
      if (stats.matchTimes.length < 3) return false;

      // Check if any 3 consecutive matches happened within 10 seconds
      // For matches at indices i, i+1, i+2, the time span is matchTimes[i+1] + matchTimes[i+2]
      for (let i = 0; i <= stats.matchTimes.length - 3; i++) {
        const timeSpan = stats.matchTimes[i + 1] + stats.matchTimes[i + 2];
        if (timeSpan <= 10000) return true;
      }
      return false;
    }
  );
}

// Register with factory
registerEnemy('Stalking Wolf', createStalkingWolf);
