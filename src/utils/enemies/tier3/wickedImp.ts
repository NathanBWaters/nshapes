/**
 * Wicked Imp - Tier 3 Enemy
 *
 * Effects: Stinging Scorpion (2x) + Sneaky Mouse (-55%) + Lazy Sloth (-55%)
 * Defeat Condition: Achieve minimum with 3+ graces unused
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
 * Creates a fresh Wicked Imp enemy instance.
 */
export function createWickedImp(): EnemyInstance {
  return composeEffects(
    {
      name: 'Wicked Imp',
      icon: 'lorc/imp',
      tier: 3,
      description: '2x damage/points, grace -55%, time -55%',
      defeatConditionText: 'Achieve minimum with 3+ graces unused',
    },
    [
      { behavior: DamageMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: PointsMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: WeaponCounterEffect, config: { type: 'grace', reduction: 55 } },
      { behavior: WeaponCounterEffect, config: { type: 'time', reduction: 55 } },
    ],
    // Defeat condition: Beat target with 3+ graces unused
    (stats: RoundStats) =>
      stats.currentScore >= stats.targetScore && stats.gracesRemaining >= 3
  );
}

// Register with factory
registerEnemy('Wicked Imp', createWickedImp);
