/**
 * Armored Tusks - Tier 2 Enemy
 *
 * Effects: Wet Crab (-35% fire) + Spiny Hedgehog (-35% explosion)
 * Defeat Condition: Trigger 2 destruction effects (any type)
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { WeaponCounterEffect, composeEffects } from '../../enemyEffects';

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
