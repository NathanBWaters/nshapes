/**
 * Ravenous Tapir - Tier 3 Enemy
 *
 * Effects: Greedy Squirrel (2 cards per match) + Burrowing Mole (10s) + Swift Bee (40% faster)
 * Defeat Condition: Achieve minimum with 5+ cards remaining
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  ExtraCardRemovalOnMatchEffect,
  CardRemovalEffect,
  TimerSpeedEffect,
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
      description: '+2 cards removed per match, removes 1 card every 10s, timer 40% faster',
      defeatConditionText: 'Achieve minimum with 5+ cards remaining',
    },
    [
      { behavior: ExtraCardRemovalOnMatchEffect, config: { count: 2, minBoardSize: 5 } },
      { behavior: CardRemovalEffect, config: { intervalMs: 10000, minBoardSize: 5 } },
      { behavior: TimerSpeedEffect, config: { multiplier: 1.4 } },
    ],
    // Defeat condition: Beat target with 5+ cards remaining
    (stats: RoundStats) =>
      stats.currentScore >= stats.targetScore && stats.cardsRemaining >= 5
  );
}

// Register with factory
registerEnemy('Ravenous Tapir', createRavenousTapir);
