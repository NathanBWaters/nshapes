/**
 * Venomous Cobra - Tier 2 Enemy
 *
 * Effects: Shifting Chameleon (15s) + Trap Weaver
 * Defeat Condition: Match 4 bombs before they explode
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { AttributeChangeEffect, BombEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Venomous Cobra enemy instance.
 */
export function createVenomousCobra(): EnemyInstance {
  return composeEffects(
    {
      name: 'Venomous Cobra',
      icon: 'skoll/cobra',
      tier: 2,
      description: 'Attributes change every 15s, random cards get bomb timers',
      defeatConditionText: 'Match 4 bombs before they explode',
    },
    [
      { behavior: AttributeChangeEffect, config: { intervalMs: 15000 } },
      { behavior: BombEffect, config: { bombChance: 15, bombTimerMs: 10000, minBoardSize: 6 } },
    ],
    // Defeat condition: Defuse 4 bombs
    (stats: RoundStats) => stats.bombsDefused >= 4
  );
}

// Register with factory
registerEnemy('Venomous Cobra', createVenomousCobra);
