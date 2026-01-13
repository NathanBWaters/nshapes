/**
 * Prowling Direwolf - Tier 2 Enemy
 *
 * Effects: Junk Rat (6% dud) + Wild Goose (25s shuffle)
 * Defeat Condition: Get a 6-match streak
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { DudCardEffect, PositionShuffleEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Creates a fresh Prowling Direwolf enemy instance.
 */
export function createProwlingDirewolf(): EnemyInstance {
  return composeEffects(
    {
      name: 'Prowling Direwolf',
      icon: 'lorc/direwolf',
      tier: 2,
      description: '6% dud chance, shuffles positions every 25s',
      defeatConditionText: 'Get a 6-match streak',
    },
    [
      { behavior: DudCardEffect, config: { chance: 6 } },
      { behavior: PositionShuffleEffect, config: { intervalMs: 25000 } },
    ],
    // Defeat condition: 6-match streak
    (stats: RoundStats) => stats.maxStreak >= 6
  );
}

// Register with factory
registerEnemy('Prowling Direwolf', createProwlingDirewolf);
