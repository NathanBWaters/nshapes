/**
 * Ravenous Tapir - Tier 3 Enemy
 *
 * [GP-16]: Rewrote legacy Classic "Beat target" defeat condition into a native Adventure challenge.
 * Effects: +1 card removed per match, removes 1 card every 15s (card economy pressure)
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
      defeatConditionText: 'Win with 5+ cards remaining on board',
    },
    [
      { behavior: ExtraCardRemovalOnMatchEffect, config: { count: 1, minBoardSize: 5 } },
      { behavior: CardRemovalEffect, config: { intervalMs: 15000, minBoardSize: 5 } },
    ],
    (stats: RoundStats) => stats.totalMatches >= 1 && stats.cardsRemaining >= 5
  );
}
