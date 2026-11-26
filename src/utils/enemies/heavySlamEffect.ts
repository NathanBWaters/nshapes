/**
 * [GP-17] Telegraphed Heavy Slam Inactivity Effect.
 *
 * Replaces unfair `instantDeath` inactivity timers with a tense, survivable
 * telegraphed Heavy Slam (`-2 ♥` by default) preceded by a 5-second warning pulse
 * (`inactivity_warning`), resetting the timer cleanly after impact.
 */
import type { Card } from '@/types';
import type { EffectBehavior, EnemyTickResult, EnemyUIModifiers } from '@/types/enemy';

export interface HeavySlamConfig {
  maxMs: number;
  /** Hearts dealt on impact (default 2). */
  hearts?: number;
}

export const HeavySlamInactivityEffect: EffectBehavior = {
  onTick: (
    deltaMs: number,
    _board: Card[],
    internalState: Record<string, unknown>,
    config: unknown
  ): Partial<EnemyTickResult> => {
    const { maxMs, hearts = 2 } = config as HeavySlamConfig;
    const state = internalState as { timeSinceMatch: number };
    state.timeSinceMatch = (state.timeSinceMatch || 0) + deltaMs;

    if (state.timeSinceMatch >= maxMs) {
      state.timeSinceMatch = 0;
      return {
        healthDelta: -Math.abs(hearts),
        instantDeath: false,
        events: [{ type: 'inactivity_penalty', penalty: 'damage' }],
      };
    }

    // 5-second warning pulse before the Heavy Slam lands
    const remaining = (maxMs - state.timeSinceMatch) / 1000;
    if (remaining <= 5 && remaining > 4) {
      return {
        events: [{ type: 'inactivity_warning', secondsRemaining: Math.ceil(remaining) }],
      };
    }

    return {};
  },

  getUIModifiers: (
    internalState: Record<string, unknown>,
    config: unknown
  ): Partial<EnemyUIModifiers> => {
    const { maxMs } = config as HeavySlamConfig;
    const state = internalState as { timeSinceMatch: number };
    return {
      showInactivityBar: {
        current: state.timeSinceMatch || 0,
        max: maxMs,
        penalty: 'damage',
      },
    };
  },
};
