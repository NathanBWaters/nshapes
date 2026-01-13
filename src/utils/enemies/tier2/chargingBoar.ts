/**
 * Charging Boar - Tier 2 Enemy
 *
 * Effects: Stalking Wolf (35s → lose 1HP) + Circling Vulture (3pts/sec drain)
 * Defeat Condition: Get 3 matches each under 8s
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { InactivityEffect, ScoreDecayEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Charging Boar enemy instance.
 */
export function createChargingBoar(): EnemyInstance {
  return composeEffects(
    {
      name: 'Charging Boar',
      icon: 'caro-asercion/boar',
      tier: 2,
      description: '35s inactivity → lose 1HP, score drains 3pts/sec',
      defeatConditionText: 'Get 3 matches each under 8s',
    },
    [
      { behavior: InactivityEffect, config: { maxMs: 35000, penalty: 'damage' } },
      { behavior: ScoreDecayEffect, config: { ratePerSecond: 3 } },
    ],
    // Defeat condition: 3 matches each under 8 seconds
    (stats: RoundStats) => {
      const fastMatches = stats.matchTimes.filter((t) => t < 8000).length;
      return fastMatches >= 3;
    }
  );
}

// Register with factory
registerEnemy('Charging Boar', createChargingBoar);
