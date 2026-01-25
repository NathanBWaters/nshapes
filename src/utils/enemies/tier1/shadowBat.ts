/**
 * Shadow Bat - Tier 1 Enemy
 *
 * Effect: Laser effects divided by 3
 * Defeat Condition: Get an all-different match
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { WeaponCounterEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Shadow Bat enemy instance.
 */
export function createShadowBat(): EnemyInstance {
  return composeEffects(
    {
      name: 'Shadow Bat',
      icon: 'lorc/evil-bat',
      tier: 1,
      description: 'Laser effects divided by 3',
      defeatConditionText: 'Get an all-different match',
    },
    [
      {
        behavior: WeaponCounterEffect,
        config: { type: 'laser', reduction: 20 },
      },
    ],
    // Defeat condition: Get an all-different match
    (stats: RoundStats) => {
      return stats.allDifferentMatches >= 1;
    }
  );
}

// Register with factory
registerEnemy('Shadow Bat', createShadowBat);
