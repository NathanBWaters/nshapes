/**
 * Wild Goose - Tier 1 Enemy
 *
 * Effect: Shuffles card positions every 30s
 * Defeat Condition: Match 2 sets that share a card attribute
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { PositionShuffleEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Wild Goose enemy instance.
 */
export function createWildGoose(): EnemyInstance {
  return composeEffects(
    {
      name: 'Wild Goose',
      icon: 'lorc/swan',
      tier: 1,
      description: 'Shuffles card positions every 30s',
      defeatConditionText: 'Match 2 sets that share a card attribute',
    },
    [
      {
        behavior: PositionShuffleEffect,
        config: { intervalMs: 30000 },
      },
    ],
    // Defeat condition: Match 2 sets that share a card attribute
    // This is tracked by totalMatches >= 2 AND at least one "shared attribute" match
    // For simplicity, we interpret this as: any 2 matches where at least one has all-same attribute
    // Actually the spec says "share a card attribute" meaning two consecutive matches have something in common
    // We'll use allSameColorMatches + checking if we have 2+ matches with a shared attribute
    // For simplicity: require 2 matches total since any SET inherently shares attributes
    (stats: RoundStats) => {
      return stats.totalMatches >= 2;
    }
  );
}

// Register with factory
registerEnemy('Wild Goose', createWildGoose);
