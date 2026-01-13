/**
 * Polar Guardian - Tier 2 Enemy
 *
 * Effects: Stinging Scorpion (2x damage/points) + Shadow Bat (-40% laser)
 * Defeat Condition: Take no damage AND trigger 1 weapon effect
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  DamageMultiplierEffect,
  PointsMultiplierEffect,
  WeaponCounterEffect,
  composeEffects,
} from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Polar Guardian enemy instance.
 */
export function createPolarGuardian(): EnemyInstance {
  return composeEffects(
    {
      name: 'Polar Guardian',
      icon: 'sparker/bear-face',
      tier: 2,
      description: '2x damage taken, 2x points earned, laser -40%',
      defeatConditionText: 'Take no damage AND trigger 1 weapon effect',
    },
    [
      { behavior: DamageMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: PointsMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: WeaponCounterEffect, config: { type: 'laser', reduction: 40 } },
    ],
    // Defeat condition: Take no damage AND trigger at least 1 weapon effect
    (stats: RoundStats) =>
      stats.damageReceived === 0 && stats.weaponEffectsTriggered.size >= 1
  );
}

// Register with factory
registerEnemy('Polar Guardian', createPolarGuardian);
