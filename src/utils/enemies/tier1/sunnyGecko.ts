/**
 * [GP-16] Sunny Gecko - Tier 1 World 1 Flair Enemy (Level 1-4)
 *
 * Lightweight non-punishing visual sight gag: every 3 Sets, hops onto 1 random
 * card and flips it face-down for 3 seconds before hopping back off.
 */
import type { EffectBehavior, EnemyInstance, EnemyMatchResult, EnemyTickResult, RoundStats } from '@/types/enemy';
import { composeEffects } from '../../enemyEffects';

const HOP_EVERY_SETS = 3;
const HOP_DURATION_MS = 3000;

const nextRandom = (rng?: () => number): number => (rng ? rng() : Math.random());

const SunnyHopEffect: EffectBehavior = {
  onRoundStart: (_board, internalState) => {
    internalState.geckoSets = 0;
    internalState.geckoPendingHop = false;
    internalState.geckoCardId = null;
    internalState.geckoMsLeft = 0;
    internalState.geckoExcludeIds = [];
    return {};
  },

  onValidMatch: (matchedCards, _board, internalState): Partial<EnemyMatchResult> => {
    const sets = ((internalState.geckoSets as number) || 0) + 1;
    internalState.geckoSets = sets;
    const cardsToFlip: string[] = [];
    const activeId = internalState.geckoCardId as string | null;
    if (activeId && matchedCards.some(c => c.id === activeId)) {
      internalState.geckoCardId = null;
      internalState.geckoMsLeft = 0;
    }
    if (sets % HOP_EVERY_SETS === 0 && !internalState.geckoCardId) {
      internalState.geckoPendingHop = true;
      internalState.geckoExcludeIds = matchedCards.map(c => c.id);
    }
    return { cardsToFlip };
  },

  onTick: (deltaMs, board, internalState, _config, rng): Partial<EnemyTickResult> => {
    const activeId = internalState.geckoCardId as string | null;
    if (activeId) {
      const stillOnBoard = board.some(c => c.id === activeId);
      if (!stillOnBoard) {
        internalState.geckoCardId = null;
        internalState.geckoMsLeft = 0;
      } else {
        const left = ((internalState.geckoMsLeft as number) || 0) - deltaMs;
        internalState.geckoMsLeft = left;
        if (left <= 0) {
          internalState.geckoCardId = null;
          internalState.geckoMsLeft = 0;
          return {
            cardsToFlip: [activeId],
            events: [{ type: 'card_flipped', cardId: activeId }],
          };
        }
      }
    }

    if (internalState.geckoPendingHop && !internalState.geckoCardId) {
      internalState.geckoPendingHop = false;
      const excluded = new Set((internalState.geckoExcludeIds as string[]) || []);
      const candidates = board.filter(c => !c.isDud && !c.isFaceDown && !excluded.has(c.id));
      if (candidates.length > 0) {
        const target = candidates[Math.floor(nextRandom(rng) * candidates.length)];
        internalState.geckoCardId = target.id;
        internalState.geckoMsLeft = HOP_DURATION_MS;
        return {
          cardModifications: [{ cardId: target.id, changes: { isFaceDown: true } }],
          events: [{ type: 'card_became_facedown', cardId: target.id }],
        };
      }
    }

    return {};
  },
};

export function createSunnyGecko(): EnemyInstance {
  return composeEffects(
    {
      name: 'Sunny Gecko',
      icon: 'darkzaitzev/chameleon-glyph',
      tier: 1,
      description: 'Playful hop: every 3 Sets, hides 1 random card face-down for 3s.',
      defeatConditionText: 'Set off 2 explosions',
    },
    [{ behavior: SunnyHopEffect, config: {} }],
    (stats: RoundStats) => stats.totalMatches >= 3
  );
}
