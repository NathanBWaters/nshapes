/**
 * Armored Tusks - Tier 2 Enemy
 *
 * Effects: Wet Crab (-35% fire) + Spiny Hedgehog (-35% explosion)
 * Defeat Condition: Trigger 2 destruction effects (any type)
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { WeaponCounterEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Armored Tusks enemy instance.
 */
export function createArmoredTusks(): EnemyInstance {
  return composeEffects(
    {
      name: 'Armored Tusks',
      icon: 'lorc/boar-tusks',
      tier: 2,
      description: 'Fire -35%, explosion -35%',
      defeatConditionText: 'Trigger 2 destruction effects',
    },
    [
      { behavior: WeaponCounterEffect, config: { type: 'fire', reduction: 35 } },
      { behavior: WeaponCounterEffect, config: { type: 'explosion', reduction: 35 } },
    ],
    // Defeat condition: Trigger 2 destruction effects (fire/explosion/laser)
    (stats: RoundStats) => {
      const destructiveEffects = ['fire', 'explosion', 'laser'];
      let count = 0;
      for (const effect of destructiveEffects) {
        if (stats.weaponEffectsTriggered.has(effect)) count++;
      }
      return count >= 2;
    }
  );
}

// Register with factory
registerEnemy('Armored Tusks', createArmoredTusks);
