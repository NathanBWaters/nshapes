/**
 * Kraken's Grasp - Tier 4 Boss
 *
 * Effects: Wild Goose (15s shuffle) + Burrowing Mole (12s) + Junk Rat (15% dud) + All counters -50%
 * Defeat Condition: Survive with 5+ cards remaining on board
 */

import type { EnemyInstance, RoundStats } from '@/types/enemy';
import {
  PositionShuffleEffect,
  CardRemovalEffect,
  DudCardEffect,
  WeaponCounterEffect,
  composeEffects,
} from '../../enemyEffects';

// All weapon types for -75% counter
const WEAPON_TYPES = ['fire', 'explosion', 'laser', 'hint', 'grace', 'time', 'healing'] as const;

export function createKrakensGrasp(): EnemyInstance {
  // All weapon types at -50%
  const counterEffects = WEAPON_TYPES.map((type) => ({
    behavior: WeaponCounterEffect,
    config: { type, reduction: 50 },
  }));

  return composeEffects(
    {
      name: "Kraken's Grasp",
      icon: 'delapouite/kraken-tentacle',
      tier: 4,
      description: 'Shuffles every 15s, removes card every 12s, 15% dud chance, all weapons -50%',
      defeatConditionText: 'Survive with 5+ cards remaining on board',
    },
    [
      { behavior: PositionShuffleEffect, config: { intervalMs: 15000 } },
      { behavior: CardRemovalEffect, config: { intervalMs: 12000, minBoardSize: 5 } },
      { behavior: DudCardEffect, config: { chance: 15 } },
      ...counterEffects,
    ],
    (stats: RoundStats) =>
      stats.currentScore >= stats.targetScore && stats.cardsRemaining >= 5
  );
}
