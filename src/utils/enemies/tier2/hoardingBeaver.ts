/**
 * Hoarding Beaver - Tier 2 Enemy
 *
 * Effects: Greedy Squirrel (1 card per match) + Burrowing Mole (18s removal)
 * Defeat Condition: Achieve minimum with 6+ cards remaining
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { ExtraCardRemovalOnMatchEffect, CardRemovalEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Hoarding Beaver enemy instance.
 */
export function createHoardingBeaver(): EnemyInstance {
  return composeEffects(
    {
      name: 'Hoarding Beaver',
      icon: 'delapouite/beaver',
      tier: 2,
      description: '+1 card removed per match, removes 1 card every 18s',
      defeatConditionText: 'Achieve minimum with 6+ cards remaining',
    },
    [
      { behavior: ExtraCardRemovalOnMatchEffect, config: { count: 1, minBoardSize: 6 } },
      { behavior: CardRemovalEffect, config: { intervalMs: 18000, minBoardSize: 6 } },
    ],
    // Defeat condition: Beat target with 6+ cards remaining
    (stats: RoundStats) =>
      stats.currentScore >= stats.targetScore && stats.cardsRemaining >= 6
  );
}

// Register with factory
registerEnemy('Hoarding Beaver', createHoardingBeaver);
