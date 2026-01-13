/**
 * Masked Bandit - Tier 1 Enemy
 *
 * Effect: Disables auto-hints entirely
 * Defeat Condition: Get 3 matches without hesitating >10s
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { HintDisableEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Masked Bandit enemy instance.
 */
export function createMaskedBandit(): EnemyInstance {
  return composeEffects(
    {
      name: 'Masked Bandit',
      icon: 'delapouite/raccoon-head',
      tier: 1,
      description: 'Disables auto-hints entirely',
      defeatConditionText: 'Get 3 matches without hesitating >10s',
    },
    [
      {
        behavior: HintDisableEffect,
        config: { disableAuto: true, disableManual: false },
      },
    ],
    // Defeat condition: Get 3 matches without hesitating >10s
    // All 3 first matches must be under 10s (10000ms)
    (stats: RoundStats) => {
      if (stats.matchTimes.length < 3) return false;
      // Check that the first 3 matches were all under 10s
      const first3 = stats.matchTimes.slice(0, 3);
      return first3.every((time) => time < 10000);
    }
  );
}

// Register with factory
registerEnemy('Masked Bandit', createMaskedBandit);
