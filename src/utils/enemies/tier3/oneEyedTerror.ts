/**
 * One-Eyed Terror - Tier 3 Enemy
 *
 * Effects: Masked Bandit (no hints) + Shifting Chameleon (12s) + Foggy Frog (-55%)
 * Defeat Condition: Get 3 all-different matches
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  HintDisableEffect,
  AttributeChangeEffect,
  WeaponCounterEffect,
  composeEffects,
} from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh One-Eyed Terror enemy instance.
 */
export function createOneEyedTerror(): EnemyInstance {
  return composeEffects(
    {
      name: 'One-Eyed Terror',
      icon: 'lorc/cyclops',
      tier: 3,
      description: 'No hints, attributes change every 12s, hint gain -55%',
      defeatConditionText: 'Get 3 all-different matches',
    },
    [
      { behavior: HintDisableEffect, config: { disableAuto: true, disableManual: true } },
      { behavior: AttributeChangeEffect, config: { intervalMs: 12000 } },
      { behavior: WeaponCounterEffect, config: { type: 'hint', reduction: 55 } },
    ],
    // Defeat condition: 3 all-different matches
    (stats: RoundStats) => stats.allDifferentMatches >= 3
  );
}

// Register with factory
registerEnemy('One-Eyed Terror', createOneEyedTerror);
