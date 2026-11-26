/**
 * Wicked Imp - Tier 3 Enemy
 *
 * [GP-16]: Rewrote legacy Classic "Achieve minimum" defeat condition into a native Adventure challenge.
 * Effects: Stinging Scorpion (2x) + Sneaky Mouse (-55%) + Lazy Sloth (-55%)
 */
import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  DamageMultiplierEffect,
  PointsMultiplierEffect,
  WeaponCounterEffect,
  composeEffects,
} from '../../enemyEffects';

export function createWickedImp(): EnemyInstance {
  return composeEffects(
    {
      name: 'Wicked Imp',
      icon: 'lorc/imp',
      tier: 3,
      description: '2x damage/points, grace -55%, time -55%',
      defeatConditionText: 'Win with 3+ graces unused',
    },
    [
      { behavior: DamageMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: PointsMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: WeaponCounterEffect, config: { type: 'grace', reduction: 55 } },
      { behavior: WeaponCounterEffect, config: { type: 'time', reduction: 55 } },
    ],
    (stats: RoundStats) => stats.totalMatches >= 1 && stats.gracesRemaining >= 3
  );
}
