/**
 * Raging Bear - Tier 3 Enemy
 *
 * [GP-17]: Replaced 30s instantDeath with telegraphed −2 ♥ Heavy Slam.
 * Effects: 30s inactivity → −2 ♥ Heavy Slam + Stinging Scorpion (2x) + score drain (1pt/5s)
 * Defeat Condition: 7-match streak with no invalid matches
 */
import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  DamageMultiplierEffect,
  PointsMultiplierEffect,
  ScoreDecayEffect,
  composeEffects,
} from '../../enemyEffects';
import { HeavySlamInactivityEffect } from '../heavySlamEffect';

export function createRagingBear(): EnemyInstance {
  return composeEffects(
    {
      name: 'Raging Bear',
      icon: 'sparker/bear-face',
      tier: 3,
      description: '30s inactivity → Heavy Slam (−2 ♥), 2x damage/points, score drains 1pt/5s',
      defeatConditionText: '7-match streak with no invalid matches',
    },
    [
      { behavior: HeavySlamInactivityEffect, config: { maxMs: 30000, hearts: 2 } },
      { behavior: DamageMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: PointsMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: ScoreDecayEffect, config: { ratePerSecond: 0.2 } },
    ],
    (stats: RoundStats) => stats.maxStreak >= 7 && stats.invalidMatches === 0
  );
}
