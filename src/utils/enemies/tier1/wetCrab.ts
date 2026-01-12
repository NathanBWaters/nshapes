/**
 * Wet Crab - Tier 1 Enemy
 *
 * Effect: Fire effects reduced by 15%
 * Defeat Condition: Get 2 all-same color matches
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { WeaponCounterEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Wet Crab enemy instance.
 */
export function createWetCrab(): EnemyInstance {
  return composeEffects(
    {
      name: 'Wet Crab',
      icon: 'lorc/crab',
      tier: 1,
      description: 'Fire effects reduced by 15%',
      defeatConditionText: 'Get 2 all-same color matches',
    },
    [
      {
        behavior: WeaponCounterEffect,
        config: { type: 'fire', reduction: 15 },
      },
    ],
    // Defeat condition: Get 2 all-same color matches
    (stats: RoundStats) => stats.allSameColorMatches >= 2
  );
}

// Register with factory
registerEnemy('Wet Crab', createWetCrab);
