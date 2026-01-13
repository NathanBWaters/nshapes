/**
 * World Eater - Tier 4 Boss
 *
 * Effects: Greedy Squirrel (3 cards per match) + Punishing Ermine (4 cards per invalid) + Burrowing Mole (6s) + Stalking Wolf (15s → INSTANT DEATH) + Swift Bee (100% faster)
 * Defeat Condition: Achieve minimum with 4+ cards remaining AND no invalid matches
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  ExtraCardRemovalOnMatchEffect,
  ExtraCardRemovalOnInvalidEffect,
  CardRemovalEffect,
  InactivityEffect,
  TimerSpeedEffect,
  composeEffects,
} from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh World Eater enemy instance.
 */
export function createWorldEater(): EnemyInstance {
  return composeEffects(
    {
      name: 'World Eater',
      icon: 'lorc/daemon-skull',
      tier: 4,
      description: '+3 cards removed per match, +4 on invalid, removes every 6s, 15s inactivity → death, timer 100% faster',
      defeatConditionText: 'Achieve minimum with 4+ cards remaining AND no invalid matches',
    },
    [
      { behavior: ExtraCardRemovalOnMatchEffect, config: { count: 3, minBoardSize: 4 } },
      { behavior: ExtraCardRemovalOnInvalidEffect, config: { count: 4, minBoardSize: 4 } },
      { behavior: CardRemovalEffect, config: { intervalMs: 6000, minBoardSize: 4 } },
      { behavior: InactivityEffect, config: { maxMs: 15000, penalty: 'death' } },
      { behavior: TimerSpeedEffect, config: { multiplier: 2.0 } },
    ],
    // Defeat condition: Beat target with 4+ cards AND no invalid matches
    (stats: RoundStats) =>
      stats.currentScore >= stats.targetScore &&
      stats.cardsRemaining >= 4 &&
      stats.invalidMatches === 0
  );
}

// Register with factory
registerEnemy('World Eater', createWorldEater);
