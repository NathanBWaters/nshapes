/**
 * Merciless Porcupine - Tier 3 Enemy
 *
 * Effects: Punishing Ermine (3 cards per invalid) + Stinging Scorpion (2x) + Stalking Wolf (35s → INSTANT DEATH)
 * Defeat Condition: Make no invalid matches
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  ExtraCardRemovalOnInvalidEffect,
  DamageMultiplierEffect,
  PointsMultiplierEffect,
  InactivityEffect,
  composeEffects,
} from '../../enemyEffects';

export function createMercilessPorcupine(): EnemyInstance {
  return composeEffects(
    {
      name: 'Merciless Porcupine',
      icon: 'caro-asercion/porcupine',
      tier: 3,
      description: '+3 cards removed on invalid, 2x damage/points, 35s inactivity → instant death',
      defeatConditionText: 'Make no invalid matches',
    },
    [
      { behavior: ExtraCardRemovalOnInvalidEffect, config: { count: 3, minBoardSize: 5 } },
      { behavior: DamageMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: PointsMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: InactivityEffect, config: { maxMs: 35000, penalty: 'death' } },
    ],
    (stats: RoundStats) => stats.invalidMatches === 0 && stats.totalMatches >= 1
  );
}
