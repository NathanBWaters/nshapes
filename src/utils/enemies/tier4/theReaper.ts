/**
 * The Reaper - Tier 4 Boss
 *
 * Effects: Sneaky Mouse (-60%) + Lazy Sloth (-60%) + Stinging Scorpion + score drain (1pt/3s) + Masked Bandit
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
      description: 'Grace -60%, time -60%, 2x damage/points, score drains 1pt/3s, no hints',
      defeatConditionText: 'Achieve minimum with 10+ seconds remaining AND 0 damage taken',
    },
    [
      { behavior: WeaponCounterEffect, config: { type: 'grace', reduction: 60 } },
      { behavior: WeaponCounterEffect, config: { type: 'time', reduction: 60 } },
      { behavior: DamageMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: PointsMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: ScoreDecayEffect, config: { ratePerSecond: 0.33 } },
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
