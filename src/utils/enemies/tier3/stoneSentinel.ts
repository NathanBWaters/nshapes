/**
 * Stone Sentinel - Tier 3 Enemy
 *
 * Effects: Iron Shell (×2 cards) + Spiny Hedgehog (-55%) + Shadow Bat (-55%)
 * Defeat Condition: Clear both triple cards
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  TripleCardEffect,
  WeaponCounterEffect,
  composeEffects,
} from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Stone Sentinel enemy instance.
 */
export function createStoneSentinel(): EnemyInstance {
  return composeEffects(
    {
      name: 'Stone Sentinel',
      icon: 'delapouite/golem-head',
      tier: 3,
      description: '2 triple-health cards, explosion -55%, laser -55%',
      defeatConditionText: 'Clear both triple cards',
    },
    [
      { behavior: TripleCardEffect, config: { count: 2 } },
      { behavior: WeaponCounterEffect, config: { type: 'explosion', reduction: 55 } },
      { behavior: WeaponCounterEffect, config: { type: 'laser', reduction: 55 } },
    ],
    // Defeat condition: Clear both triple cards
    (stats: RoundStats) => stats.tripleCardsCleared >= 2
  );
}

// Register with factory
registerEnemy('Stone Sentinel', createStoneSentinel);
