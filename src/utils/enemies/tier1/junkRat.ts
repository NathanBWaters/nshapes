/**
 * Junk Rat - Tier 1 Enemy
 *
 * Effect: 4% chance per card draw → card becomes a dud (unmatchable)
 * Defeat Condition: Get a 4-match streak
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { DudCardEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Junk Rat enemy instance.
 */
export function createJunkRat(): EnemyInstance {
  return composeEffects(
    {
      name: 'Junk Rat',
      icon: 'delapouite/rabbit', // TODO: Register delapouite/rat icon
      tier: 1,
      description: '4% chance per card draw becomes unmatchable',
      defeatConditionText: 'Get a 4-match streak',
    },
    [{ behavior: DudCardEffect, config: { chance: 4 } }],
    // Defeat condition: 4-match streak
    (stats: RoundStats) => stats.maxStreak >= 4
  );
}

// Register with factory
registerEnemy('Junk Rat', createJunkRat);
