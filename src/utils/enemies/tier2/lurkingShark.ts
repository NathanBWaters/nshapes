/**
 * Lurking Shark - Tier 2 Enemy
 *
 * Effects: Night Owl (25% face-down) + Ticking Viper (12s countdown)
 * Defeat Condition: Match 3 face-down cards + the countdown card
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { FaceDownEffect, CountdownEffect, composeEffects } from '../../enemyEffects';
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
      description: '25% face-down chance, 12s countdown card',
      defeatConditionText: 'Match 3 face-down cards + the countdown card',
    },
    [
      { behavior: FaceDownEffect, config: { chance: 25, flipChance: 60 } },
      { behavior: CountdownEffect, config: { countdownMs: 12000 } },
    ],
    // Defeat condition: Match 3 face-down cards AND the countdown card
    (stats: RoundStats) =>
      stats.faceDownCardsMatched >= 3 && stats.countdownCardsMatched >= 1
  );
}

// Register with factory
registerEnemy('Lurking Shark', createLurkingShark);
