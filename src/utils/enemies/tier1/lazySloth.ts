/**
 * Lazy Sloth - Tier 1 Enemy
 *
 * Effect: Time gain divided by 3
 * Defeat Condition: Beat target score with 15+ seconds remaining
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { WeaponCounterEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Lazy Sloth enemy instance.
 */
export function createLazySloth(): EnemyInstance {
  return composeEffects(
    {
      name: 'Lazy Sloth',
      icon: 'caro-asercion/sloth',
      tier: 1,
      description: 'Time gain divided by 3',
      defeatConditionText: 'Beat target score with 15+ seconds remaining',
    },
    [
      {
        behavior: WeaponCounterEffect,
        config: { type: 'time', reduction: 20 },
      },
    ],
    // Defeat condition: Achieve minimum with 15+ seconds remaining
    (stats: RoundStats) => stats.currentScore >= stats.targetScore && stats.timeRemaining >= 15
  );
}

// Register with factory
registerEnemy('Lazy Sloth', createLazySloth);
