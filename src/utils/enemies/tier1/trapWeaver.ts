/**
 * Trap Weaver - Tier 1 Enemy
 *
 * Effect: Random cards get 10s bomb timers (15% chance on draw)
 * Defeat Condition: Defuse 3 bombs (match bomb cards before explosion)
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { BombEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Trap Weaver enemy instance.
 */
export function createTrapWeaver(): EnemyInstance {
  return composeEffects(
    {
      name: 'Trap Weaver',
      icon: 'carl-olsen/spider-face',
      tier: 1,
      description: 'Random cards get 10s bomb timers',
      defeatConditionText: 'Defuse 3 bombs (match bomb cards)',
    },
    [
      {
        behavior: BombEffect,
        config: { bombChance: 15, bombTimerMs: 10000, minBoardSize: 6 },
      },
    ],
    // Defeat condition: Defuse 3 bombs
    (stats: RoundStats) => stats.bombsDefused >= 3
  );
}

// Register with factory
registerEnemy('Trap Weaver', createTrapWeaver);
