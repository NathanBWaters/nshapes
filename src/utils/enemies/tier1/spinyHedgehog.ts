/**
 * Spiny Hedgehog - Tier 1 Enemy
 *
 * Effect: Explosion effects reduced by 15%
 * Defeat Condition: Get 3 matches containing squiggles
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { WeaponCounterEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Spiny Hedgehog enemy instance.
 */
export function createSpinyHedgehog(): EnemyInstance {
  return composeEffects(
    {
      name: 'Spiny Hedgehog',
      icon: 'caro-asercion/hedgehog',
      tier: 1,
      description: 'Explosion effects reduced by 15%',
      defeatConditionText: 'Get 3 matches containing squiggles',
    },
    [
      {
        behavior: WeaponCounterEffect,
        config: { type: 'explosion', reduction: 15 },
      },
    ],
    // Defeat condition: Get 3 matches containing squiggles
    (stats: RoundStats) => {
      return stats.squiggleMatches >= 3;
    }
  );
}

// Register with factory
registerEnemy('Spiny Hedgehog', createSpinyHedgehog);
