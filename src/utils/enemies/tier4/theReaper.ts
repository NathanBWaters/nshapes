/**
 * The Reaper - Tier 4 Boss
 *
 * [GP-16]: Rewrote legacy Classic "Achieve minimum" defeat condition into a native Adventure challenge.
 * Effects: Sneaky Mouse (-60%) + Lazy Sloth (-60%) + Stinging Scorpion + score drain (1pt/3s) + Masked Bandit
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

export function createTheReaper(): EnemyInstance {
  return composeEffects(
    {
      name: 'The Reaper',
      icon: 'lorc/grim-reaper',
      tier: 4,
      description: 'Grace -60%, time -60%, 2x damage/points, score drains 1pt/3s, no hints',
      defeatConditionText: 'Win with 10+ seconds remaining AND 0 hearts lost',
    },
    [
      { behavior: WeaponCounterEffect, config: { type: 'grace', reduction: 60 } },
      { behavior: WeaponCounterEffect, config: { type: 'time', reduction: 60 } },
      { behavior: DamageMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: PointsMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: ScoreDecayEffect, config: { ratePerSecond: 0.33 } },
      { behavior: HintDisableEffect, config: { disableAuto: true, disableManual: true } },
    ],
    // Note: timeRemaining is in seconds, not milliseconds
    (stats: RoundStats) =>
      stats.totalMatches >= 1 &&
      stats.timeRemaining >= 10 &&
      stats.damageReceived === 0
  );
}
