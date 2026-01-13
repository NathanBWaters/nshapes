/**
 * Creeping Shadow - Tier 2 Enemy
 *
 * Effects: Masked Bandit (no hints) + Foggy Frog (-35% hint gain)
 * Defeat Condition: Match all 3 colors at least once
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { HintDisableEffect, WeaponCounterEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Creeping Shadow enemy instance.
 */
export function createCreepingShadow(): EnemyInstance {
  return composeEffects(
    {
      name: 'Creeping Shadow',
      icon: 'lorc/beast-eye',
      tier: 2,
      description: 'No auto or manual hints, hint gain -35%',
      defeatConditionText: 'Match all 3 colors at least once',
    },
    [
      { behavior: HintDisableEffect, config: { disableAuto: true, disableManual: true } },
      { behavior: WeaponCounterEffect, config: { type: 'hint', reduction: 35 } },
    ],
    // Defeat condition: Match all 3 colors
    (stats: RoundStats) => stats.colorsMatched.size >= 3
  );
}

// Register with factory
registerEnemy('Creeping Shadow', createCreepingShadow);
