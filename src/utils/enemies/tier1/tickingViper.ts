/**
 * Ticking Viper - Tier 1 Enemy
 *
 * Effect: One card has 15s countdown timer; match or lose 1HP
 * Defeat Condition: Match the countdown card in time
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { CountdownEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Ticking Viper enemy instance.
 */
export function createTickingViper(): EnemyInstance {
  return composeEffects(
    {
      name: 'Ticking Viper',
      icon: 'lorc/snake',
      tier: 1,
      description: 'One card has 15s countdown; match or lose 1HP',
      defeatConditionText: 'Match the countdown card in time',
    },
    [{ behavior: CountdownEffect, config: { countdownMs: 15000 } }],
    // Defeat condition: Match at least 1 countdown card in time
    (stats: RoundStats) => stats.countdownCardsMatched >= 1
  );
}

// Register with factory
registerEnemy('Ticking Viper', createTickingViper);
