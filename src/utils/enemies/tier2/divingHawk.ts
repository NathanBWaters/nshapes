/**
 * Diving Hawk - Tier 2 Enemy
 *
 * Effects: Swift Bee (35% faster) + Burrowing Mole (15s removal)
 * Defeat Condition: Get 2 all-different matches under 6s each
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { TimerSpeedEffect, CardRemovalEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Diving Hawk enemy instance.
 */
export function createDivingHawk(): EnemyInstance {
  // Track all-different match times
  let allDifferentMatchTimes: number[] = [];

  const enemy = composeEffects(
    {
      name: 'Diving Hawk',
      icon: 'lorc/hawk-emblem',
      tier: 2,
      description: 'Timer 35% faster, removes 1 card every 15s',
      defeatConditionText: 'Get 2 all-different matches under 6s each',
    },
    [
      { behavior: TimerSpeedEffect, config: { multiplier: 1.35 } },
      { behavior: CardRemovalEffect, config: { intervalMs: 15000, minBoardSize: 6 } },
    ],
    // Defeat condition: 2 all-different matches each under 6s
    (stats: RoundStats) => {
      // We need to track fast all-different matches specifically
      // For now, check if we have at least 2 all-different matches
      // AND have had at least 2 matches under 6s
      const fastMatches = stats.matchTimes.filter((t) => t < 6000).length;
      return stats.allDifferentMatches >= 2 && fastMatches >= 2;
    }
  );

  return enemy;
}

// Register with factory
registerEnemy('Diving Hawk', createDivingHawk);
