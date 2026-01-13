/**
 * Shifting Chameleon - Tier 1 Enemy
 *
 * Effect: Changes 1 attribute on random cards every 20s
 * Defeat Condition: Get 2 all-different matches
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { AttributeChangeEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Shifting Chameleon enemy instance.
 */
export function createShiftingChameleon(): EnemyInstance {
  return composeEffects(
    {
      name: 'Shifting Chameleon',
      icon: 'darkzaitzev/chameleon-glyph',
      tier: 1,
      description: 'Changes 1 attribute on random cards every 20s',
      defeatConditionText: 'Get 2 all-different matches',
    },
    [{ behavior: AttributeChangeEffect, config: { intervalMs: 20000 } }],
    // Defeat condition: 2 all-different matches
    (stats: RoundStats) => stats.allDifferentMatches >= 2
  );
}

// Register with factory
registerEnemy('Shifting Chameleon', createShiftingChameleon);
