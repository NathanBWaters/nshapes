/**
 * Nightmare Squid - Tier 3 Enemy
 *
 * Effects: Night Owl (35% face-down, 50% flip) + Wild Goose (15s) + score drain (1pt/5s)
 * Defeat Condition: Score 200% of target
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  FaceDownEffect,
  PositionShuffleEffect,
  ScoreDecayEffect,
  composeEffects,
} from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Nightmare Squid enemy instance.
 */
export function createNightmareSquid(): EnemyInstance {
  return composeEffects(
    {
      name: 'Nightmare Squid',
      icon: 'delapouite/giant-squid',
      tier: 3,
      description: '35% face-down (50% flip), shuffles every 15s, score drains 1pt/5s',
      defeatConditionText: 'Score 200% of target',
    },
    [
      { behavior: FaceDownEffect, config: { chance: 35, flipChance: 50 } },
      { behavior: PositionShuffleEffect, config: { intervalMs: 15000 } },
      { behavior: ScoreDecayEffect, config: { ratePerSecond: 0.2 } },
    ],
    // Defeat condition: Score 200% of target
    (stats: RoundStats) => stats.currentScore >= stats.targetScore * 2
  );
}

// Register with factory
registerEnemy('Nightmare Squid', createNightmareSquid);
