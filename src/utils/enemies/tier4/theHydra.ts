/**
 * The Hydra - Tier 4 Boss
 *
 * Effects: Stalking Wolf (30s → INSTANT DEATH) + Trap Weaver (×2) + Ticking Viper (10s) + Night Owl (40%) + Thieving Raven (-4s)
 * Defeat Condition: Match 10 times with no invalid matches
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  InactivityEffect,
  BombEffect,
  CountdownEffect,
  FaceDownEffect,
  TimeStealEffect,
  composeEffects,
} from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh The Hydra enemy instance.
 */
export function createTheHydra(): EnemyInstance {
  return composeEffects(
    {
      name: 'The Hydra',
      icon: 'lorc/hydra',
      tier: 4,
      description: '30s inactivity → instant death, bombs, 10s countdown, 40% face-down, -4s per match',
      defeatConditionText: 'Match 10 times with no invalid matches',
    },
    [
      { behavior: InactivityEffect, config: { maxMs: 30000, penalty: 'death' } },
      // Moderate bomb chance
      { behavior: BombEffect, config: { bombChance: 20, bombTimerMs: 10000, minBoardSize: 5 } },
      { behavior: CountdownEffect, config: { countdownMs: 10000 } },
      { behavior: FaceDownEffect, config: { chance: 40, flipChance: 40 } },
      { behavior: TimeStealEffect, config: { amount: 4 } },
    ],
    // Defeat condition: Match 10 times with no invalid matches
    (stats: RoundStats) => stats.totalMatches >= 10 && stats.invalidMatches === 0
  );
}

// Register with factory
registerEnemy('The Hydra', createTheHydra);
