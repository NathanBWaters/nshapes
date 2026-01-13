/**
 * The Reaper - Tier 4 Boss
 *
 * Effects: Sneaky Mouse (-90%) + Lazy Sloth (-90%) + Stinging Scorpion + Circling Vulture (10pts/sec) + Masked Bandit
 * Defeat Condition: Achieve minimum with 10+ seconds remaining AND 0 damage taken
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  WeaponCounterEffect,
  DamageMultiplierEffect,
  PointsMultiplierEffect,
  ScoreDecayEffect,
  HintDisableEffect,
  composeEffects,
} from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh The Reaper enemy instance.
 */
export function createTheReaper(): EnemyInstance {
  return composeEffects(
    {
      name: 'The Reaper',
      icon: 'lorc/grim-reaper',
      tier: 4,
      description: 'Grace -90%, time -90%, 2x damage/points, score drains 10pts/sec, no hints',
      defeatConditionText: 'Achieve minimum with 10+ seconds remaining AND 0 damage taken',
    },
    [
      { behavior: WeaponCounterEffect, config: { type: 'grace', reduction: 90 } },
      { behavior: WeaponCounterEffect, config: { type: 'time', reduction: 90 } },
      { behavior: DamageMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: PointsMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: ScoreDecayEffect, config: { ratePerSecond: 10 } },
      { behavior: HintDisableEffect, config: { disableAuto: true, disableManual: true } },
    ],
    // Defeat condition: Beat target with 10+ seconds AND no damage
    (stats: RoundStats) =>
      stats.currentScore >= stats.targetScore &&
      stats.timeRemaining >= 10000 &&
      stats.damageReceived === 0
  );
}

// Register with factory
registerEnemy('The Reaper', createTheReaper);
