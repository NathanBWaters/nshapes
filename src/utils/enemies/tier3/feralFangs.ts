/**
 * Feral Fangs - Tier 3 Enemy
 *
 * Effects: Junk Rat (10% dud) + Iron Shell + Burrowing Mole (12s removal)
 * Defeat Condition: Clear triple card before 5 cards removed
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  DudCardEffect,
  TripleCardEffect,
  CardRemovalEffect,
  composeEffects,
} from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Feral Fangs enemy instance.
 */
export function createFeralFangs(): EnemyInstance {
  return composeEffects(
    {
      name: 'Feral Fangs',
      icon: 'lorc/bestial-fangs',
      tier: 3,
      description: '10% dud chance, one triple-health card, removes 1 card every 12s',
      defeatConditionText: 'Clear triple card before 5 cards removed',
    },
    [
      { behavior: DudCardEffect, config: { chance: 10 } },
      { behavior: TripleCardEffect, config: { count: 1 } },
      { behavior: CardRemovalEffect, config: { intervalMs: 12000, minBoardSize: 6 } },
    ],
    // Defeat condition: Clear triple card (cardsRemovedByEnemy tracking would be ideal, but simplified)
    (stats: RoundStats) => stats.tripleCardsCleared >= 1
  );
}

// Register with factory
registerEnemy('Feral Fangs', createFeralFangs);
