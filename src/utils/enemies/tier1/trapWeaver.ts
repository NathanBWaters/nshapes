/**
 * Trap Weaver - Tier 1 Enemy
 *
 * Effect: Starts with 1 bomb card (10s timer)
 * Defeat Condition: Defuse the bomb (match it before explosion)
 */

import type { Card } from '@/types';
import type { EnemyInstance, RoundStats, EnemyStartResult, EffectBehavior } from '@/types/enemy';
import { BombEffect, composeEffects } from '../../enemyEffects';
import { registerEnemy } from '../../enemyFactory';

/**
 * Custom effect that spawns a bomb card at round start
 */
const SpawnBombEffect: EffectBehavior = {
  onRoundStart: (
    board: Card[],
    _internalState: Record<string, unknown>,
    config: unknown
  ): Partial<EnemyStartResult> => {
    const { bombTimerMs } = config as { bombTimerMs: number };

    // Pick a random card to place the bomb on
    const validCards = board.filter((c) => !c.isDud && !c.isFaceDown && !c.hasBomb);
    if (validCards.length === 0) return {};

    const randomCard = validCards[Math.floor(Math.random() * validCards.length)];

    return {
      cardModifications: [
        {
          cardId: randomCard.id,
          changes: { hasBomb: true, bombTimer: bombTimerMs },
        },
      ],
      events: [],
    };
  },
};

/**
 * Creates a fresh Trap Weaver enemy instance.
 */
export function createTrapWeaver(): EnemyInstance {
  return composeEffects(
    {
      name: 'Trap Weaver',
      icon: 'carl-olsen/spider-face',
      tier: 1,
      description: 'Starts with 1 bomb card (10s timer)',
      defeatConditionText: 'Defuse the bomb (match it before explosion)',
    },
    [
      {
        behavior: SpawnBombEffect,
        config: { bombTimerMs: 10000 },
      },
      {
        behavior: BombEffect,
        config: { bombChance: 0, bombTimerMs: 10000, minBoardSize: 6 },
      },
    ],
    // Defeat condition: Defuse 1 bomb
    (stats: RoundStats) => stats.bombsDefused >= 1
  );
}

// Register with factory
registerEnemy('Trap Weaver', createTrapWeaver);
