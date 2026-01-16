/**
 * Ancient Dragon - Tier 4 Boss
 *
 * Effects: Iron Shell (×2 cards) + Shifting Chameleon (8s) + Swift Bee (40% faster) + Stinging Scorpion + score drain (1pt/3s)
 * Defeat Condition: Clear all 2 triple cards AND get 2 all-different matches
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
      description: '2 triple cards, attributes shift every 8s, timer 40% faster, 2x damage/points, score drains 1pt/3s',
      defeatConditionText: 'Clear all 2 triple cards AND get 2 all-different matches',
    },
    [
      { behavior: TripleCardEffect, config: { count: 2 } },
      { behavior: AttributeChangeEffect, config: { intervalMs: 8000 } },
      { behavior: TimerSpeedEffect, config: { multiplier: 1.4 } },
      { behavior: DamageMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: PointsMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: ScoreDecayEffect, config: { ratePerSecond: 0.33 } },
    ],
    // Defeat condition: Clear all 2 triple cards AND get 2 all-different matches
    (stats: RoundStats) =>
      stats.tripleCardsCleared >= 2 && stats.allDifferentMatches >= 2
  );
}

// Register with factory
registerEnemy('Ancient Dragon', createAncientDragon);
