/**
 * [GP-16] Golden Mole - Tier 1 World 1 Flair Enemy (Level 1-8)
 *
 * Playful 1-rule flair reinforcing 1-8's Coin Drops reveal: gleams over 1 random
 * board card as a Gold card that tosses +2¢ when matched.
 */
import type { Card } from '@/types';
import type { EffectBehavior, EnemyInstance, EnemyStartResult, EnemyTickResult, RoundStats } from '@/types/enemy';
import { composeEffects } from '../../enemyEffects';

const MOLE_GOLD_COINS = 2;

const nextRandom = (rng?: () => number): number => (rng ? rng() : Math.random());

const pickGleamTarget = (board: Card[], rng?: () => number): Card | null => {
  if (board.some(c => (c.bonusMoney ?? 0) > 0)) return null;
  const candidates = board.filter(c => !c.isDud && !c.isFaceDown);
  if (candidates.length === 0) return null;
  return candidates[Math.floor(nextRandom(rng) * candidates.length)];
};

const GoldenGleamEffect: EffectBehavior = {
  onRoundStart: (board, internalState, _config, rng): Partial<EnemyStartResult> => {
    const target = pickGleamTarget(board, rng);
    internalState.gleamCardId = target?.id ?? null;
    if (!target) return {};
    return {
      cardModifications: [{ cardId: target.id, changes: { bonusMoney: MOLE_GOLD_COINS } }],
      events: [],
    };
  },

  onTick: (_deltaMs, board, internalState, _config, rng): Partial<EnemyTickResult> => {
    const currentId = internalState.gleamCardId as string | null;
    if (currentId && board.some(c => c.id === currentId && (c.bonusMoney ?? 0) > 0)) {
      return {};
    }
    const target = pickGleamTarget(board, rng);
    internalState.gleamCardId = target?.id ?? null;
    if (!target) return {};
    return {
      cardModifications: [{ cardId: target.id, changes: { bonusMoney: MOLE_GOLD_COINS } }],
      events: [],
    };
  },
};

export function createGoldenMole(): EnemyInstance {
  return composeEffects(
    {
      name: 'Golden Mole',
      icon: 'lorc/gold-scarab',
      tier: 1,
      description: 'Gleams over 1 random card — match it for +2 bonus coins!',
      defeatConditionText: 'Make 4 Sets in a row without a mistake',
    },
    [{ behavior: GoldenGleamEffect, config: {} }],
    (stats: RoundStats) => stats.maxStreak >= 4
  );
}
