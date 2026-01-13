/**
 * Savage Claws - Tier 3 Enemy
 *
 * Effects: Thieving Raven (-4s) + Swift Bee (50% faster) + Trap Weaver
 * Defeat Condition: Match 8 times total
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  TimeStealEffect,
  TimerSpeedEffect,
  BombEffect,
  composeEffects,
} from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Savage Claws enemy instance.
 */
export function createSavageClaws(): EnemyInstance {
  return composeEffects(
    {
      name: 'Savage Claws',
      icon: 'lorc/claw-slashes',
      tier: 3,
      description: '-4s per match, timer 50% faster, random bomb cards',
      defeatConditionText: 'Match 8 times total',
    },
    [
      { behavior: TimeStealEffect, config: { amount: 4 } },
      { behavior: TimerSpeedEffect, config: { multiplier: 1.5 } },
      { behavior: BombEffect, config: { bombChance: 15, bombTimerMs: 10000, minBoardSize: 6 } },
    ],
    // Defeat condition: Match 8 times total
    (stats: RoundStats) => stats.totalMatches >= 8
  );
}

// Register with factory
registerEnemy('Savage Claws', createSavageClaws);
