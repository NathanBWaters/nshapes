/**
 * Night Owl - Tier 1 Enemy
 *
 * Effect: 20% of cards are face-down; matching flips with 70% chance
 * Defeat Condition: Match a set with a revealed card (previously face-down)
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { FaceDownEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Night Owl enemy instance.
 */
export function createNightOwl(): EnemyInstance {
  return composeEffects(
    {
      name: 'Night Owl',
      icon: 'caro-asercion/barn-owl',
      tier: 1,
      description: "20% of cards are face-down; matching flips with 70% chance",
      defeatConditionText: 'Match a set with a revealed card',
    },
    [
      {
        behavior: FaceDownEffect,
        config: { chance: 20, flipChance: 70 },
      },
    ],
    // Defeat condition: Match at least 1 face-down card
    (stats: RoundStats) => {
      return stats.faceDownCardsMatched >= 1;
    }
  );
}

// Register with factory
registerEnemy('Night Owl', createNightOwl);
