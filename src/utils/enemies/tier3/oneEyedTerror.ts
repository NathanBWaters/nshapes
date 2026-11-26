/**
 * [GP-16] One-Eyed Terror - Tier 3 Enemy
 *
 * Replaced hard manual-hint ban (`disableManual: true`) with counterable Gaze Drain:
 * marks a watched card every 16s (clear it to blind the Cyclops!) & shifts traits every 12s.
 * Manual hints remain usable so Insight builds are never hard-deleted.
 */
import type { Card } from '@/types';
import type {
  EffectBehavior,
  EnemyInstance,
  EnemyMatchResult,
  EnemyTickResult,
  EnemyUIModifiers,
  RoundStats,
} from '@/types/enemy';
import {
  AttributeChangeEffect,
  WeaponCounterEffect,
  composeEffects,
} from '../../enemyEffects';

const GAZE_INTERVAL_MS = 16000;
const GAZE_DURATION_MS = 10000;

const nextRandom = (rng?: () => number): number => (rng ? rng() : Math.random());

const GazeDrainEffect: EffectBehavior = {
  onRoundStart: (_board, internalState) => {
    internalState.gazeCooldownMs = 0;
    internalState.gazeCardId = null;
    internalState.gazeTimerMs = 0;
    return {};
  },

  onTick: (deltaMs, board, internalState, _config, rng): Partial<EnemyTickResult> => {
    const activeId = internalState.gazeCardId as string | null;
    if (activeId) {
      const card = board.find(c => c.id === activeId);
      if (!card) {
        internalState.gazeCardId = null;
        internalState.gazeTimerMs = 0;
        return {};
      }
      const nextMs = ((internalState.gazeTimerMs as number) || GAZE_DURATION_MS) - deltaMs;
      internalState.gazeTimerMs = nextMs;
      if (nextMs <= 0) {
        internalState.gazeCardId = null;
        internalState.gazeTimerMs = 0;
        return {
          healthDelta: -1,
          cardModifications: [{ cardId: activeId, changes: { hasCountdown: false, countdownTimer: undefined } }],
          events: [{ type: 'countdown_expired', cardId: activeId }],
        };
      }
      const remaining = nextMs / 1000;
      const events =
        remaining <= 5 && remaining > 4
          ? [{ type: 'countdown_warning' as const, cardId: activeId, secondsRemaining: Math.ceil(remaining) }]
          : [];
      return {
        cardModifications: [{ cardId: activeId, changes: { countdownTimer: Math.max(0, nextMs) } }],
        events,
      };
    }

    internalState.gazeCooldownMs = ((internalState.gazeCooldownMs as number) || 0) + deltaMs;
    if ((internalState.gazeCooldownMs as number) >= GAZE_INTERVAL_MS) {
      internalState.gazeCooldownMs = 0;
      const candidates = board.filter(c => !c.isDud && !c.isFaceDown && !c.hasCountdown);
      if (candidates.length > 0) {
        const target = candidates[Math.floor(nextRandom(rng) * candidates.length)];
        internalState.gazeCardId = target.id;
        internalState.gazeTimerMs = GAZE_DURATION_MS;
        return {
          cardModifications: [{ cardId: target.id, changes: { hasCountdown: true, countdownTimer: GAZE_DURATION_MS } }],
          events: [{ type: 'countdown_warning', cardId: target.id, secondsRemaining: Math.ceil(GAZE_DURATION_MS / 1000) }],
        };
      }
    }
    return {};
  },

  onValidMatch: (matchedCards: Card[], _board: Card[], internalState): Partial<EnemyMatchResult> => {
    const activeId = internalState.gazeCardId as string | null;
    if (activeId && matchedCards.some(c => c.id === activeId)) {
      internalState.gazeCardId = null;
      internalState.gazeTimerMs = 0;
    }
    return {};
  },

  getUIModifiers: (internalState): Partial<EnemyUIModifiers> => {
    const activeId = internalState.gazeCardId as string | null;
    const timer = (internalState.gazeTimerMs as number) || 0;
    return activeId && timer > 0
      ? { showCountdownCards: [{ cardId: activeId, timeRemaining: timer }] }
      : {};
  },
};

export function createOneEyedTerror(): EnemyInstance {
  return composeEffects(
    {
      name: 'One-Eyed Terror',
      icon: 'lorc/cyclops',
      tier: 3,
      description: 'Gaze Drain watches a card every 16s & shifts traits every 12s (manual hints stay open).',
      defeatConditionText: 'Land 3 Rainbow Strikes (all-different Sets)',
    },
    [
      { behavior: GazeDrainEffect, config: {} },
      { behavior: AttributeChangeEffect, config: { intervalMs: 12000 } },
      { behavior: WeaponCounterEffect, config: { type: 'hint', reduction: 25 } },
    ],
    (stats: RoundStats) => stats.allDifferentMatches >= 3
  );
}
