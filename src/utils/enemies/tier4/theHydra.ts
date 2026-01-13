/**
 * The Hydra - Tier 4 Boss
 *
 * Effects: Stalking Wolf (20s → INSTANT DEATH) + Trap Weaver (×3) + Ticking Viper (×2, 8s each) + Night Owl (40%) + Thieving Raven (-6s)
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
      description: '20s inactivity → instant death, frequent bombs, 8s countdown, 40% face-down, -6s per match',
      defeatConditionText: 'Match 10 times with no invalid matches',
    },
    [
      { behavior: InactivityEffect, config: { maxMs: 20000, penalty: 'death' } },
      // High bomb chance for "×3" effect
      { behavior: BombEffect, config: { bombChance: 30, bombTimerMs: 10000, minBoardSize: 5 } },
      { behavior: CountdownEffect, config: { countdownMs: 8000 } },
      { behavior: FaceDownEffect, config: { chance: 40, flipChance: 40 } },
      { behavior: TimeStealEffect, config: { amount: 6 } },
    ],
    // Defeat condition: Match 10 times with no invalid matches
    (stats: RoundStats) => stats.totalMatches >= 10 && stats.invalidMatches === 0
  );
}

// Register with factory
registerEnemy('The Hydra', createTheHydra);
