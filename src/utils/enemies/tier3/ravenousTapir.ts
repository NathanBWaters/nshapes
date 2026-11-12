/**
 * Ravenous Tapir - Tier 3 Enemy
 *
 * Effects: +1 card removed per match, removes 1 card every 15s (card economy pressure)
 * Defeat Condition: Beat target with 5+ cards remaining
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  ExtraCardRemovalOnMatchEffect,
  CardRemovalEffect,
  composeEffects,
} from '../../enemyEffects';

export function createRavenousTapir(): EnemyInstance {
  return composeEffects(
    {
      name: 'Ravenous Tapir',
      icon: 'delapouite/tapir',
      tier: 3,
      description: '+1 card removed per match, removes 1 card every 15s',
      defeatConditionText: 'Beat target with 5+ cards remaining',
    },
    [
      { behavior: ExtraCardRemovalOnMatchEffect, config: { count: 1, minBoardSize: 5 } },
      { behavior: CardRemovalEffect, config: { intervalMs: 15000, minBoardSize: 5 } },
    ],
    (stats: RoundStats) =>
      stats.currentScore >= stats.targetScore && stats.cardsRemaining >= 5
  );
}
