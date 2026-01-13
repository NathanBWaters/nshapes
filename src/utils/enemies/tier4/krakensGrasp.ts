/**
 * Kraken's Grasp - Tier 4 Boss
 *
 * Effects: Wild Goose (10s shuffle) + Burrowing Mole (8s) + Junk Rat (15% dud) + All counters -75%
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
import { registerEnemy } from '../../enemyFactory';

// All weapon types for -75% counter
const WEAPON_TYPES = ['fire', 'explosion', 'laser', 'hint', 'grace', 'time', 'healing'] as const;

/**
 * Creates a fresh Kraken's Grasp enemy instance.
 */
export function createKrakensGrasp(): EnemyInstance {
  // All weapon types at -75%
  const counterEffects = WEAPON_TYPES.map((type) => ({
    behavior: WeaponCounterEffect,
    config: { type, reduction: 75 },
  }));

  return composeEffects(
    {
      name: "Kraken's Grasp",
      icon: 'delapouite/kraken-tentacle',
      tier: 4,
      description: 'Shuffles every 10s, removes card every 8s, 15% dud chance, all weapons -75%',
      defeatConditionText: 'Survive with 5+ cards remaining on board',
    },
    [
      { behavior: PositionShuffleEffect, config: { intervalMs: 10000 } },
      { behavior: CardRemovalEffect, config: { intervalMs: 8000, minBoardSize: 5 } },
      { behavior: DudCardEffect, config: { chance: 15 } },
      ...counterEffects,
    ],
    // Defeat condition: Survive with 5+ cards remaining
    (stats: RoundStats) =>
      stats.currentScore >= stats.targetScore && stats.cardsRemaining >= 5
  );
}

// Register with factory
registerEnemy("Kraken's Grasp", createKrakensGrasp);
