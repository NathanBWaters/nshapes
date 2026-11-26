/**
 * Merciless Porcupine - Tier 3 Enemy
 *
 * [GP-17]: Replaced 35s instantDeath with telegraphed −2 ♥ Heavy Slam.
 * Effects: Punishing Ermine (3 cards per invalid) + Stinging Scorpion (2x) + 35s Heavy Slam (−2 ♥)
 * Defeat Condition: Make no invalid matches
 */
import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  ExtraCardRemovalOnInvalidEffect,
  DamageMultiplierEffect,
  PointsMultiplierEffect,
  composeEffects,
} from '../../enemyEffects';
import { HeavySlamInactivityEffect } from '../heavySlamEffect';

export function createMercilessPorcupine(): EnemyInstance {
  return composeEffects(
    {
      name: 'Merciless Porcupine',
      icon: 'caro-asercion/porcupine',
      tier: 3,
      description: '+3 cards removed on invalid, 2x damage/points, 35s inactivity → Heavy Slam (−2 ♥)',
      defeatConditionText: 'Make no invalid matches',
    },
    [
      { behavior: ExtraCardRemovalOnInvalidEffect, config: { count: 3, minBoardSize: 5 } },
      { behavior: DamageMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: PointsMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: HeavySlamInactivityEffect, config: { maxMs: 35000, hearts: 2 } },
    ],
    (stats: RoundStats) => stats.invalidMatches === 0 && stats.totalMatches >= 1
  );
}
