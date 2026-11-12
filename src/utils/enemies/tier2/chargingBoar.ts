/**
 * Charging Boar - Tier 2 Enemy
 *
 * Effects: 35s inactivity → lose 1HP (focused single hazard)
 * Defeat Condition: Get 3 matches each under 10s
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { InactivityEffect, composeEffects } from '../../enemyEffects';

export function createChargingBoar(): EnemyInstance {
  return composeEffects(
    {
      name: 'Charging Boar',
      icon: 'caro-asercion/boar',
      tier: 2,
      description: '35s inactivity → lose 1HP',
      defeatConditionText: 'Get 3 matches each under 10s',
    },
    [
      { behavior: InactivityEffect, config: { maxMs: 35000, penalty: 'damage' } },
    ],
    (stats: RoundStats) => {
      const fastMatches = stats.matchTimes.filter((t) => t < 10000).length;
      return fastMatches >= 3;
    }
  );
}
