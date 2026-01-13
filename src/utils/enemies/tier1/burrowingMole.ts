/**
 * Burrowing Mole - Tier 1 Enemy
 *
 * Effect: Removes 1 random card every 20s
 * Defeat Condition: Match all 3 shapes at least once
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { CardRemovalEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Burrowing Mole enemy instance.
 */
export function createBurrowingMole(): EnemyInstance {
  return composeEffects(
    {
      name: 'Burrowing Mole',
      icon: 'caro-asercion/mole',
      tier: 1,
      description: 'Removes 1 random card every 20s',
      defeatConditionText: 'Match all 3 shapes at least once',
    },
    [
      {
        behavior: CardRemovalEffect,
        config: { intervalMs: 20000, minBoardSize: 6 },
      },
    ],
    // Defeat condition: Match all 3 shapes at least once
    (stats: RoundStats) => {
      return stats.shapesMatched.size >= 3;
    }
  );
}

// Register with factory
registerEnemy('Burrowing Mole', createBurrowingMole);
