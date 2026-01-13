/**
 * Fierce Wolverine - Tier 2 Enemy
 *
 * Effects: Punishing Ermine (2 cards per invalid) + Stinging Scorpion (2x damage/points)
 * Defeat Condition: Make no invalid matches AND take no damage
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  ExtraCardRemovalOnInvalidEffect,
  DamageMultiplierEffect,
  PointsMultiplierEffect,
  composeEffects,
} from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Fierce Wolverine enemy instance.
 */
export function createFierceWolverine(): EnemyInstance {
  return composeEffects(
    {
      name: 'Fierce Wolverine',
      icon: 'lorc/wolverine-claws',
      tier: 2,
      description: '+2 cards removed on invalid match, 2x damage/points',
      defeatConditionText: 'Make no invalid matches AND take no damage',
    },
    [
      { behavior: ExtraCardRemovalOnInvalidEffect, config: { count: 2, minBoardSize: 6 } },
      { behavior: DamageMultiplierEffect, config: { multiplier: 2.0 } },
      { behavior: PointsMultiplierEffect, config: { multiplier: 2.0 } },
    ],
    // Defeat condition: No invalid matches AND no damage taken
    (stats: RoundStats) =>
      stats.invalidMatches === 0 &&
      stats.damageReceived === 0 &&
      stats.totalMatches >= 1
  );
}

// Register with factory
registerEnemy('Fierce Wolverine', createFierceWolverine);
