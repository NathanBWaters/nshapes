/**
 * Hunting Eagle - Tier 2 Enemy
 *
 * Effects: Iron Shell + Lazy Sloth (-35% time)
 * Defeat Condition: Clear triple card with 20s+ remaining
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { TripleCardEffect, WeaponCounterEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Hunting Eagle enemy instance.
 */
export function createHuntingEagle(): EnemyInstance {
  return composeEffects(
    {
      name: 'Hunting Eagle',
      icon: 'delapouite/eagle-head',
      tier: 2,
      description: 'One triple-health card, time gain -35%',
      defeatConditionText: 'Clear triple card with 20s+ remaining',
    },
    [
      { behavior: TripleCardEffect, config: { count: 1 } },
      { behavior: WeaponCounterEffect, config: { type: 'time', reduction: 35 } },
    ],
    // Defeat condition: Clear triple card with 20+ seconds remaining
    // Note: timeRemaining is in seconds, not milliseconds
    (stats: RoundStats) =>
      stats.tripleCardsCleared >= 1 && stats.timeRemaining >= 20
  );
}

// Register with factory
registerEnemy('Hunting Eagle', createHuntingEagle);
