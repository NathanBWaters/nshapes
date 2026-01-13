/**
 * Abyssal Octopus - Tier 3 Enemy
 *
 * Effects: Night Owl (30% face-down) + Wild Goose (20s shuffle) + Ticking Viper (10s countdown)
 * Defeat Condition: Match 5 face-down cards
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  FaceDownEffect,
  PositionShuffleEffect,
  CountdownEffect,
  composeEffects,
} from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Abyssal Octopus enemy instance.
 */
export function createAbyssalOctopus(): EnemyInstance {
  return composeEffects(
    {
      name: 'Abyssal Octopus',
      icon: 'lorc/octopus',
      tier: 3,
      description: '30% face-down chance, shuffles every 20s, 10s countdown card',
      defeatConditionText: 'Match 5 face-down cards',
    },
    [
      { behavior: FaceDownEffect, config: { chance: 30, flipChance: 50 } },
      { behavior: PositionShuffleEffect, config: { intervalMs: 20000 } },
      { behavior: CountdownEffect, config: { countdownMs: 10000 } },
    ],
    // Defeat condition: Match 5 face-down cards
    (stats: RoundStats) => stats.faceDownCardsMatched >= 5
  );
}

// Register with factory
registerEnemy('Abyssal Octopus', createAbyssalOctopus);
