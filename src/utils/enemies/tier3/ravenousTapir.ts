/**
 * Ravenous Tapir - Tier 3 Enemy
 *
 * Effects: +2 cards removed per match, removes 1 card every 10s (focused card economy pressure)
 * Defeat Condition: Beat target with 6+ cards remaining
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  ExtraCardRemovalOnMatchEffect,
  CardRemovalEffect,
  composeEffects,
} from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Ravenous Tapir enemy instance.
 */
export function createRavenousTapir(): EnemyInstance {
  return composeEffects(
    {
      name: 'Ravenous Tapir',
      icon: 'delapouite/tapir',
      tier: 3,
      description: '+2 cards removed per match, removes 1 card every 10s',
      defeatConditionText: 'Beat target with 6+ cards remaining',
    },
    [
      { behavior: ExtraCardRemovalOnMatchEffect, config: { count: 2, minBoardSize: 5 } },
      { behavior: CardRemovalEffect, config: { intervalMs: 10000, minBoardSize: 5 } },
    ],
    // Defeat condition: Beat target with 6+ cards remaining
    (stats: RoundStats) =>
      stats.currentScore >= stats.targetScore && stats.cardsRemaining >= 6
  );
}

// Register with factory
registerEnemy('Ravenous Tapir', createRavenousTapir);
