/**
 * Lurking Shark - Tier 2 Enemy
 *
 * Effects: 25% face-down cards (simpler, more focused hazard)
 * Defeat Condition: Match 3 face-down cards
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
      description: '25% of new cards are face-down',
      defeatConditionText: 'Match 3 face-down cards',
    },
    [
      { behavior: FaceDownEffect, config: { chance: 25, flipChance: 60 } },
    ],
    // Defeat condition: Match 3 face-down cards
    (stats: RoundStats) => stats.faceDownCardsMatched >= 3
  );
}

// Register with factory
registerEnemy('Lurking Shark', createLurkingShark);
