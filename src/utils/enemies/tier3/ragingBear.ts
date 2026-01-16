/**
 * Raging Bear - Tier 3 Enemy
 *
 * Effects: Stalking Wolf (30s → INSTANT DEATH) + Stinging Scorpion (2x) + score drain (1pt/5s)
 * Defeat Condition: 7-match streak with no invalid matches
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  InactivityEffect,
  DamageMultiplierEffect,
  PointsMultiplierEffect,
  ScoreDecayEffect,
  composeEffects,
} from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Raging Bear enemy instance.
 */
export function createRagingBear(): EnemyInstance {
  return composeEffects(
    {
      name: 'Raging Bear',
      icon: 'sparker/bear-face',
      tier: 3,
      description: '30s inactivity → instant death, 2x damage/points, score drains 1pt/5s',
      defeatConditionText: '7-match streak with no invalid matches',
    },
    [
      { behavior: InactivityEffect, config: { maxMs: 30000, penalty: 'death' } },
      { behavior: DamageMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: PointsMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: ScoreDecayEffect, config: { ratePerSecond: 0.2 } },
    ],
    // Defeat condition: 7-match streak with no invalid matches
    (stats: RoundStats) => stats.maxStreak >= 7 && stats.invalidMatches === 0
  );
}

// Register with factory
registerEnemy('Raging Bear', createRagingBear);
