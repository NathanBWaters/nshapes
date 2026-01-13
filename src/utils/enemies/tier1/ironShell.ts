/**
 * Iron Shell - Tier 1 Enemy
 *
 * Effect: One card needs 3 matches to clear (triple health)
 * Defeat Condition: Clear the triple-health card
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { TripleCardEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Iron Shell enemy instance.
 */
export function createIronShell(): EnemyInstance {
  return composeEffects(
    {
      name: 'Iron Shell',
      icon: 'lorc/turtle',
      tier: 1,
      description: 'One card needs 3 matches to clear',
      defeatConditionText: 'Clear the triple-health card',
    },
    [{ behavior: TripleCardEffect, config: { count: 1 } }],
    // Defeat condition: Clear 1 triple card
    (stats: RoundStats) => stats.tripleCardsCleared >= 1
  );
}

// Register with factory
registerEnemy('Iron Shell', createIronShell);
