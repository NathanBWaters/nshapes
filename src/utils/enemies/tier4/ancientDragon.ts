/**
 * [GP-16] Ancient Dragon - Tier 4 Boss
 *
 * Focused iconic dragon kit (removed passive ScoreDecayEffect & AttributeChangeEffect noise):
 *   - 2 armored Dragon Scale triple-cards
 *   - 1.35× fast clock
 *   - 2× damage & 2× points (Dragonfire Surge)
 */
import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  TripleCardEffect,
  TimerSpeedEffect,
  DamageMultiplierEffect,
  PointsMultiplierEffect,
  composeEffects,
} from '../../enemyEffects';

export function createAncientDragon(): EnemyInstance {
  return composeEffects(
    {
      name: 'Ancient Dragon',
      icon: 'lorc/dragon-head',
      tier: 4,
      description: '2 armored Dragon Scale cards, timer 35% faster, 2x damage/points',
      defeatConditionText: 'Clear both Dragon Scale cards AND land 2 Rainbow Strikes',
    },
    [
      { behavior: TripleCardEffect, config: { count: 2 } },
      { behavior: TimerSpeedEffect, config: { multiplier: 1.35 } },
      { behavior: DamageMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: PointsMultiplierEffect, config: { multiplier: 2.0 } },
    ],
    (stats: RoundStats) =>
      stats.tripleCardsCleared >= 2 && stats.allDifferentMatches >= 2
  );
}
