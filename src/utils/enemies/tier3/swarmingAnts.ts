/**
 * Swarming Ants - Tier 3 Enemy
 *
 * Effects: Trap Weaver (×2 bombs) + Wet Crab (-55%) + Ticking Viper (8s)
 * Defeat Condition: Defuse 5 bombs total
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  BombEffect,
  WeaponCounterEffect,
  CountdownEffect,
  composeEffects,
} from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Swarming Ants enemy instance.
 */
export function createSwarmingAnts(): EnemyInstance {
  return composeEffects(
    {
      name: 'Swarming Ants',
      icon: 'delapouite/ant',
      tier: 3,
      description: 'Frequent bomb cards, fire -55%, 8s countdown card',
      defeatConditionText: 'Defuse 5 bombs total',
    },
    [
      // Higher bomb chance for "x2" effect
      { behavior: BombEffect, config: { bombChance: 25, bombTimerMs: 10000, minBoardSize: 6 } },
      { behavior: WeaponCounterEffect, config: { type: 'fire', reduction: 55 } },
      { behavior: CountdownEffect, config: { countdownMs: 8000 } },
    ],
    // Defeat condition: Defuse 5 bombs
    (stats: RoundStats) => stats.bombsDefused >= 5
  );
}

// Register with factory
registerEnemy('Swarming Ants', createSwarmingAnts);
