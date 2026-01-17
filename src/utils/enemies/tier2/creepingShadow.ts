/**
 * Creeping Shadow - Tier 2 Enemy
 *
 * Effects: Masked Bandit (no hints) + Foggy Frog (-35% hint gain)
 * Defeat Condition: Match each color at least 3 times (cumulative)
 */

import type { RoundStats } from '@/types/enemy';
import { HintDisableEffect, WeaponCounterEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Creeping Shadow enemy instance.
 */
export function createCreepingShadow() {
  return composeEffects(
    {
      name: 'Creeping Shadow',
      icon: 'lorc/beast-eye',
      tier: 2,
      description: 'No auto or manual hints, hint gain -35%',
      defeatConditionText: 'Match each color at least 3 times',
    },
    [
      { behavior: HintDisableEffect, config: { disableAuto: true, disableManual: true } },
      { behavior: WeaponCounterEffect, config: { type: 'hint', reduction: 35 } },
    ],
    // Defeat condition: Match each color (red, green, purple) at least 3 times
    (stats: RoundStats) => {
      const colors = ['red', 'green', 'purple'] as const;
      return colors.every(color => (stats.colorMatchCounts.get(color) || 0) >= 3);
    }
  );
}

// Register with factory
registerEnemy('Creeping Shadow', createCreepingShadow);
