/**
 * World Eater - Tier 4 Boss
 *
 * [GP-16] & [GP-17]: Replaced 25s instantDeath with telegraphed −2 ♥ Heavy Slam
 * and rewrote Classic target-score defeat check natively for Adventure.
 */
import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  ExtraCardRemovalOnMatchEffect,
  ExtraCardRemovalOnInvalidEffect,
  CardRemovalEffect,
  TimerSpeedEffect,
  composeEffects,
} from '../../enemyEffects';
import { HeavySlamInactivityEffect } from '../heavySlamEffect';

export function createWorldEater(): EnemyInstance {
  return composeEffects(
    {
      name: 'World Eater',
      icon: 'lorc/daemon-skull',
      tier: 4,
      description: '+2 cards removed per match, +3 on invalid, removes every 10s, 25s Heavy Slam (−2 ♥), timer 50% faster',
      defeatConditionText: 'Win with 4+ cards remaining AND no invalid matches',
    },
    [
      { behavior: ExtraCardRemovalOnMatchEffect, config: { count: 2, minBoardSize: 4 } },
      { behavior: ExtraCardRemovalOnInvalidEffect, config: { count: 3, minBoardSize: 4 } },
      { behavior: CardRemovalEffect, config: { intervalMs: 10000, minBoardSize: 4 } },
      { behavior: HeavySlamInactivityEffect, config: { maxMs: 25000, hearts: 2 } },
      { behavior: TimerSpeedEffect, config: { multiplier: 1.5 } },
    ],
    (stats: RoundStats) =>
      stats.totalMatches >= 1 &&
      stats.cardsRemaining >= 4 &&
      stats.invalidMatches === 0
  );
}
