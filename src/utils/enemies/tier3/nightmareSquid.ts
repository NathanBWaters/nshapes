/**
 * Nightmare Squid - Tier 3 Enemy
 *
 * [GP-16]: Rewrote legacy Classic "Score 200% of target" defeat condition into a native Adventure challenge.
 * Effects: Night Owl (35% face-down, 50% flip) + Wild Goose (15s) + score drain (1pt/5s)
 */
import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  FaceDownEffect,
  PositionShuffleEffect,
  ScoreDecayEffect,
  composeEffects,
} from '../../enemyEffects';

export function createNightmareSquid(): EnemyInstance {
  return composeEffects(
    {
      name: 'Nightmare Squid',
      icon: 'delapouite/giant-squid',
      tier: 3,
      description: '35% face-down (50% flip), shuffles every 15s, score drains 1pt/5s',
      defeatConditionText: 'Win without a single invalid match',
    },
    [
      { behavior: FaceDownEffect, config: { chance: 35, flipChance: 50 } },
      { behavior: PositionShuffleEffect, config: { intervalMs: 15000 } },
      { behavior: ScoreDecayEffect, config: { ratePerSecond: 0.2 } },
    ],
    (stats: RoundStats) => stats.totalMatches >= 1 && stats.invalidMatches === 0
  );
}
