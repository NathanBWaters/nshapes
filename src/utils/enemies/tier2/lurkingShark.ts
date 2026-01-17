/**
 * Lurking Shark - Tier 2 Enemy
 *
 * Effects: 25% face-down cards (simpler, more focused hazard)
 * Defeat Condition: Match 2 face-down cards (cumulative)
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { FaceDownEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Lurking Shark enemy instance.
 */
export function createLurkingShark(): EnemyInstance {
  return composeEffects(
    {
      name: 'Lurking Shark',
      icon: 'lorc/shark-jaws',
      tier: 2,
      description: '25% of new cards start face-down (tap to reveal)',
      defeatConditionText: 'Include 2 revealed cards in your matches',
    },
    [
      { behavior: FaceDownEffect, config: { chance: 25, flipChance: 60 } },
    ],
    // Defeat condition: Match at least 2 face-down cards total
    (stats: RoundStats) => stats.faceDownCardsMatched >= 2
  );
}

// Register with factory
registerEnemy('Lurking Shark', createLurkingShark);
