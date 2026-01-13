/**
 * Ancient Dragon - Tier 4 Boss
 *
 * Effects: Iron Shell (×3 cards) + Shifting Chameleon (8s) + Swift Bee (80% faster) + Stinging Scorpion + Circling Vulture (8pts/sec)
 * Defeat Condition: Clear all 3 triple cards AND get 2 all-different matches
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  TripleCardEffect,
  AttributeChangeEffect,
  TimerSpeedEffect,
  DamageMultiplierEffect,
  PointsMultiplierEffect,
  ScoreDecayEffect,
  composeEffects,
} from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Ancient Dragon enemy instance.
 */
export function createAncientDragon(): EnemyInstance {
  return composeEffects(
    {
      name: 'Ancient Dragon',
      icon: 'lorc/dragon-head',
      tier: 4,
      description: '3 triple cards, attributes shift every 8s, timer 80% faster, 2x damage/points, score drains 8pts/sec',
      defeatConditionText: 'Clear all 3 triple cards AND get 2 all-different matches',
    },
    [
      { behavior: TripleCardEffect, config: { count: 3 } },
      { behavior: AttributeChangeEffect, config: { intervalMs: 8000 } },
      { behavior: TimerSpeedEffect, config: { multiplier: 1.8 } },
      { behavior: DamageMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: PointsMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: ScoreDecayEffect, config: { ratePerSecond: 8 } },
    ],
    // Defeat condition: Clear all 3 triple cards AND get 2 all-different matches
    (stats: RoundStats) =>
      stats.tripleCardsCleared >= 3 && stats.allDifferentMatches >= 2
  );
}

// Register with factory
registerEnemy('Ancient Dragon', createAncientDragon);
