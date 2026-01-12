/**
 * Reusable Effect Behaviors for Enemy System
 *
 * These effects can be composed to create complex enemy behaviors.
 * Each effect is independent and can be combined with others using composeEffects().
 */

import type { Card } from '@/types';
import type {
  EnemyInstance,
  EnemyStartResult,
  EnemyTickResult,
  EnemyMatchResult,
  EnemyStatModifiers,
  EnemyUIModifiers,
  EnemyEvent,
  EffectBehavior,
} from '@/types/enemy';
import { createDummyEnemy } from './enemyFactory';

// ============================================================================
// INDIVIDUAL EFFECT BEHAVIORS
// ============================================================================

/**
 * DudCardEffect - Creates dud cards that cannot be selected or matched
 * Config: { chance: number } - percentage chance (0-100) to create dud on card draw
 */
export const DudCardEffect: EffectBehavior = {
  onCardDraw: (card: Card, config: unknown): Card => {
    const { chance } = config as { chance: number };
    if (Math.random() * 100 < chance) {
      return { ...card, isDud: true };
    }
    return card;
  },
};

/**
 * InactivityEffect - Penalizes player for not matching quickly
 * Config: { maxMs: number, penalty: 'damage' | 'death' }
 */
export const InactivityEffect: EffectBehavior = {
  onTick: (
    deltaMs: number,
    _board: Card[],
    internalState: Record<string, unknown>,
    config: unknown
  ): Partial<EnemyTickResult> => {
    const { maxMs, penalty } = config as { maxMs: number; penalty: 'damage' | 'death' };
    const state = internalState as { timeSinceMatch: number };
    state.timeSinceMatch = (state.timeSinceMatch || 0) + deltaMs;

    if (state.timeSinceMatch >= maxMs) {
      state.timeSinceMatch = 0; // Reset after penalty
      return {
        healthDelta: penalty === 'damage' ? -1 : 0,
        instantDeath: penalty === 'death',
        events: [{ type: 'inactivity_penalty', penalty }],
      };
    }

    // Warning at 5 seconds remaining
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
    const { maxMs, penalty } = config as { maxMs: number; penalty: 'damage' | 'death' };
    const state = internalState as { timeSinceMatch: number };
    return {
      showInactivityBar: {
        current: state.timeSinceMatch || 0,
        max: maxMs,
        penalty,
      },
    };
  },
};

/**
 * ScoreDecayEffect - Reduces score over time
 * Config: { ratePerSecond: number } - points to decay per second
 */
export const ScoreDecayEffect: EffectBehavior = {
  onTick: (
    deltaMs: number,
    _board: Card[],
    _internalState: Record<string, unknown>,
    config: unknown
  ): Partial<EnemyTickResult> => {
    const { ratePerSecond } = config as { ratePerSecond: number };
    const decay = (deltaMs / 1000) * ratePerSecond;
    return { scoreDelta: -decay };
  },

  getUIModifiers: (
    _internalState: Record<string, unknown>,
    config: unknown
  ): Partial<EnemyUIModifiers> => {
    const { ratePerSecond } = config as { ratePerSecond: number };
    return {
      showScoreDecay: { rate: ratePerSecond },
    };
  },
};

/**
 * FaceDownEffect - Creates face-down cards and handles flip mechanics
 * Config: { chance: number, flipChance: number }
 */
export const FaceDownEffect: EffectBehavior = {
  onCardDraw: (card: Card, config: unknown): Card => {
    const { chance } = config as { chance: number; flipChance: number };
    if (Math.random() * 100 < chance) {
      return { ...card, isFaceDown: true };
    }
    return card;
  },

  onValidMatch: (
    _cards: Card[],
    board: Card[],
    _internalState: Record<string, unknown>,
    config: unknown
  ): Partial<EnemyMatchResult> => {
    const { flipChance } = config as { chance: number; flipChance: number };
    // Any match triggers flip chance for ALL face-down cards on board
    const faceDownCards = board.filter((c) => c.isFaceDown);
    const cardsToFlip: string[] = [];

    for (const card of faceDownCards) {
      if (Math.random() * 100 < flipChance) {
        cardsToFlip.push(card.id);
      }
    }

    return {
      cardsToFlip,
      events: cardsToFlip.map((id) => ({ type: 'card_flipped' as const, cardId: id })),
    };
  },
};

/**
 * CardRemovalEffect - Removes cards from the board at intervals
 * Config: { intervalMs: number, minBoardSize: number }
 */
export const CardRemovalEffect: EffectBehavior = {
  onTick: (
    deltaMs: number,
    board: Card[],
    internalState: Record<string, unknown>,
    config: unknown
  ): Partial<EnemyTickResult> => {
    const { intervalMs, minBoardSize } = config as { intervalMs: number; minBoardSize: number };
    const state = internalState as { timeSinceRemoval: number };
    state.timeSinceRemoval = (state.timeSinceRemoval || 0) + deltaMs;

    if (state.timeSinceRemoval >= intervalMs && board.length > minBoardSize) {
      state.timeSinceRemoval = 0;

      // Pick random card to remove (not duds)
      const validCards = board.filter((c) => !c.isDud);
      if (validCards.length > 0) {
        const target = validCards[Math.floor(Math.random() * validCards.length)];
        return {
          cardsToRemove: [target.id],
          events: [{ type: 'card_removed', cardId: target.id, reason: 'enemy_effect' }],
        };
      }
    }

    return {};
  },
};

/**
 * TimerSpeedEffect - Speeds up the game timer
 * Config: { multiplier: number } - e.g., 1.2 = 20% faster
 */
export const TimerSpeedEffect: EffectBehavior = {
  getUIModifiers: (
    _internalState: Record<string, unknown>,
    config: unknown
  ): Partial<EnemyUIModifiers> => {
    const { multiplier } = config as { multiplier: number };
    return {
      timerSpeedMultiplier: multiplier,
    };
  },
};

/**
 * WeaponCounterEffect - Reduces effectiveness of player weapons
 * Config: { type: string, reduction: number }
 */
export const WeaponCounterEffect: EffectBehavior = {
  getStatModifiers: (config: unknown): Partial<EnemyStatModifiers> => {
    const { type, reduction } = config as { type: string; reduction: number };
    const modifiers: Partial<EnemyStatModifiers> = {};

    switch (type) {
      case 'fire':
        modifiers.fireSpreadChanceReduction = reduction;
        break;
      case 'explosion':
        modifiers.explosionChanceReduction = reduction;
        break;
      case 'laser':
        modifiers.laserChanceReduction = reduction;
        break;
      case 'hint':
        modifiers.hintGainChanceReduction = reduction;
        break;
      case 'grace':
        modifiers.graceGainChanceReduction = reduction;
        break;
      case 'time':
        modifiers.timeGainChanceReduction = reduction;
        break;
      case 'healing':
        modifiers.healingChanceReduction = reduction;
        break;
    }

    return modifiers;
  },

  getUIModifiers: (
    _internalState: Record<string, unknown>,
    config: unknown
  ): Partial<EnemyUIModifiers> => {
    const { type, reduction } = config as { type: string; reduction: number };
    return {
      weaponCounters: [{ type, reduction }],
    };
  },
};

/**
 * TimeStealEffect - Steals time from player on valid match
 * Config: { amount: number } - seconds to steal (negative)
 */
export const TimeStealEffect: EffectBehavior = {
  onValidMatch: (
    _cards: Card[],
    _board: Card[],
    _internalState: Record<string, unknown>,
    config: unknown
  ): Partial<EnemyMatchResult> => {
    const { amount } = config as { amount: number };
    return {
      timeDelta: -Math.abs(amount),
      events: [{ type: 'time_stolen', amount: Math.abs(amount) }],
    };
  },
};

/**
 * DamageMultiplierEffect - Increases damage taken by player
 * Config: { multiplier: number } - e.g., 2.0 = double damage
 */
export const DamageMultiplierEffect: EffectBehavior = {
  getStatModifiers: (config: unknown): Partial<EnemyStatModifiers> => {
    const { multiplier } = config as { multiplier: number };
    return {
      damageMultiplier: multiplier,
    };
  },
};

/**
 * PointsMultiplierEffect - Modifies points earned on match
 * Config: { multiplier: number } - e.g., 2.0 = double points
 */
export const PointsMultiplierEffect: EffectBehavior = {
  onValidMatch: (
    _cards: Card[],
    _board: Card[],
    _internalState: Record<string, unknown>,
    config: unknown
  ): Partial<EnemyMatchResult> => {
    const { multiplier } = config as { multiplier: number };
    return {
      pointsMultiplier: multiplier,
    };
  },

  getStatModifiers: (config: unknown): Partial<EnemyStatModifiers> => {
    const { multiplier } = config as { multiplier: number };
    return {
      pointsMultiplier: multiplier,
    };
  },
};

/**
 * HintDisableEffect - Disables hints for the player
 * Config: { disableAuto?: boolean, disableManual?: boolean }
 */
export const HintDisableEffect: EffectBehavior = {
  getUIModifiers: (
    _internalState: Record<string, unknown>,
    config: unknown
  ): Partial<EnemyUIModifiers> => {
    const { disableAuto, disableManual } = config as {
      disableAuto?: boolean;
      disableManual?: boolean;
    };
    return {
      disableAutoHint: disableAuto,
      disableManualHint: disableManual,
    };
  },
};

/**
 * PositionShuffleEffect - Shuffles card positions at intervals
 * Config: { intervalMs: number }
 */
export const PositionShuffleEffect: EffectBehavior = {
  onTick: (
    deltaMs: number,
    _board: Card[],
    internalState: Record<string, unknown>,
    config: unknown
  ): Partial<EnemyTickResult> => {
    const { intervalMs } = config as { intervalMs: number };
    const state = internalState as { timeSinceShuffle: number };
    state.timeSinceShuffle = (state.timeSinceShuffle || 0) + deltaMs;

    if (state.timeSinceShuffle >= intervalMs) {
      state.timeSinceShuffle = 0;
      return {
        events: [{ type: 'positions_shuffled' }],
      };
    }

    return {};
  },
};

/**
 * ExtraCardRemovalOnMatchEffect - Removes extra cards when player matches
 * Config: { count: number, minBoardSize: number }
 */
export const ExtraCardRemovalOnMatchEffect: EffectBehavior = {
  onValidMatch: (
    _cards: Card[],
    board: Card[],
    _internalState: Record<string, unknown>,
    config: unknown
  ): Partial<EnemyMatchResult> => {
    const { count, minBoardSize } = config as { count: number; minBoardSize: number };

    // Don't remove if we'd go below minimum
    const maxToRemove = Math.max(0, board.length - minBoardSize);
    const actualRemove = Math.min(count, maxToRemove);

    if (actualRemove <= 0) return {};

    // Pick random cards to remove (not duds)
    const validCards = board.filter((c) => !c.isDud);
    const shuffled = [...validCards].sort(() => Math.random() - 0.5);
    const toRemove = shuffled.slice(0, actualRemove);

    return {
      cardsToRemove: toRemove.map((c) => c.id),
      events: toRemove.map((c) => ({
        type: 'card_removed' as const,
        cardId: c.id,
        reason: 'enemy_match_penalty',
      })),
    };
  },
};

/**
 * ExtraCardRemovalOnInvalidEffect - Removes extra cards on invalid match
 * Config: { count: number, minBoardSize: number }
 */
export const ExtraCardRemovalOnInvalidEffect: EffectBehavior = {
  onInvalidMatch: (
    _cards: Card[],
    board: Card[],
    _internalState: Record<string, unknown>,
    config: unknown
  ): Partial<EnemyMatchResult> => {
    const { count, minBoardSize } = config as { count: number; minBoardSize: number };

    // Don't remove if we'd go below minimum
    const maxToRemove = Math.max(0, board.length - minBoardSize);
    const actualRemove = Math.min(count, maxToRemove);

    if (actualRemove <= 0) return {};

    // Pick random cards to remove (not duds)
    const validCards = board.filter((c) => !c.isDud);
    const shuffled = [...validCards].sort(() => Math.random() - 0.5);
    const toRemove = shuffled.slice(0, actualRemove);

    return {
      cardsToRemove: toRemove.map((c) => c.id),
      events: toRemove.map((c) => ({
        type: 'card_removed' as const,
        cardId: c.id,
        reason: 'enemy_invalid_penalty',
      })),
    };
  },
};

// ============================================================================
// COMPOSITION HELPER
// ============================================================================

/**
 * Composes multiple effect behaviors into a single EnemyInstance.
 * Each effect is independent and their results are merged.
 *
 * @param base - Base enemy metadata (name, icon, tier, description, etc.)
 * @param effects - Array of { behavior, config } pairs to compose
 * @param checkDefeatCondition - Function to check if defeat condition is met
 */
export function composeEffects(
  base: Partial<EnemyInstance>,
  effects: Array<{ behavior: EffectBehavior; config: unknown }>,
  checkDefeatCondition?: EnemyInstance['checkDefeatCondition']
): EnemyInstance {
  // Internal state for all effects
  const internalState: Record<string, unknown> = {
    timeSinceMatch: 0,
    timeSinceRemoval: 0,
    timeSinceAttributeChange: 0,
    timeSinceShuffle: 0,
  };

  const dummy = createDummyEnemy();

  return {
    ...dummy,
    ...base,
    name: base.name ?? dummy.name,
    icon: base.icon ?? dummy.icon,
    tier: base.tier ?? dummy.tier,
    description: base.description ?? dummy.description,
    defeatConditionText: base.defeatConditionText ?? dummy.defeatConditionText,

    onRoundStart: (board: Card[]): EnemyStartResult => {
      // Reset internal state
      internalState.timeSinceMatch = 0;
      internalState.timeSinceRemoval = 0;
      internalState.timeSinceAttributeChange = 0;
      internalState.timeSinceShuffle = 0;

      const result: EnemyStartResult = {
        cardModifications: [],
        events: [],
      };

      for (const { behavior, config } of effects) {
        if (behavior.onRoundStart) {
          const effectResult = behavior.onRoundStart(board, internalState, config);
          result.cardModifications.push(...(effectResult.cardModifications ?? []));
          result.events.push(...(effectResult.events ?? []));
        }
      }

      return result;
    },

    onTick: (deltaMs: number, board: Card[]): EnemyTickResult => {
      const result: EnemyTickResult = {
        scoreDelta: 0,
        healthDelta: 0,
        timeDelta: 0,
        cardsToRemove: [],
        cardModifications: [],
        cardsToFlip: [],
        events: [],
        instantDeath: false,
      };

      for (const { behavior, config } of effects) {
        if (behavior.onTick) {
          const effectResult = behavior.onTick(deltaMs, board, internalState, config);
          result.scoreDelta += effectResult.scoreDelta ?? 0;
          result.healthDelta += effectResult.healthDelta ?? 0;
          result.timeDelta += effectResult.timeDelta ?? 0;
          result.cardsToRemove.push(...(effectResult.cardsToRemove ?? []));
          result.cardModifications.push(...(effectResult.cardModifications ?? []));
          result.cardsToFlip.push(...(effectResult.cardsToFlip ?? []));
          result.events.push(...(effectResult.events ?? []));
          result.instantDeath = result.instantDeath || (effectResult.instantDeath ?? false);
        }
      }

      return result;
    },

    onValidMatch: (matchedCards: Card[], board: Card[]): EnemyMatchResult => {
      // Reset inactivity timer on any match
      internalState.timeSinceMatch = 0;

      const result: EnemyMatchResult = {
        timeDelta: 0,
        pointsMultiplier: 1,
        cardsToRemove: [],
        cardsToFlip: [],
        events: [],
      };

      for (const { behavior, config } of effects) {
        if (behavior.onValidMatch) {
          const effectResult = behavior.onValidMatch(matchedCards, board, internalState, config);
          result.timeDelta += effectResult.timeDelta ?? 0;
          result.pointsMultiplier *= effectResult.pointsMultiplier ?? 1;
          result.cardsToRemove.push(...(effectResult.cardsToRemove ?? []));
          result.cardsToFlip.push(...(effectResult.cardsToFlip ?? []));
          result.events.push(...(effectResult.events ?? []));
        }
      }

      return result;
    },

    onInvalidMatch: (cards: Card[], board: Card[]): EnemyMatchResult => {
      const result: EnemyMatchResult = {
        timeDelta: 0,
        pointsMultiplier: 1,
        cardsToRemove: [],
        cardsToFlip: [],
        events: [],
      };

      for (const { behavior, config } of effects) {
        if (behavior.onInvalidMatch) {
          const effectResult = behavior.onInvalidMatch(cards, board, internalState, config);
          result.timeDelta += effectResult.timeDelta ?? 0;
          result.pointsMultiplier *= effectResult.pointsMultiplier ?? 1;
          result.cardsToRemove.push(...(effectResult.cardsToRemove ?? []));
          result.cardsToFlip.push(...(effectResult.cardsToFlip ?? []));
          result.events.push(...(effectResult.events ?? []));
        }
      }

      return result;
    },

    onCardDraw: (card: Card): Card => {
      let modifiedCard = card;
      for (const { behavior, config } of effects) {
        if (behavior.onCardDraw) {
          modifiedCard = behavior.onCardDraw(modifiedCard, config);
        }
      }
      return modifiedCard;
    },

    checkDefeatCondition: checkDefeatCondition ?? (() => false),

    onRoundEnd: (): void => {
      // Reset state
      internalState.timeSinceMatch = 0;
      internalState.timeSinceRemoval = 0;
    },

    getUIModifiers: (): EnemyUIModifiers => {
      const modifiers: EnemyUIModifiers = {};

      for (const { behavior, config } of effects) {
        if (behavior.getUIModifiers) {
          const effectMods = behavior.getUIModifiers(internalState, config);
          // Merge weapon counters arrays
          if (effectMods.weaponCounters) {
            modifiers.weaponCounters = [
              ...(modifiers.weaponCounters ?? []),
              ...effectMods.weaponCounters,
            ];
          }
          Object.assign(modifiers, effectMods);
        }
      }

      return modifiers;
    },

    getStatModifiers: (): EnemyStatModifiers => {
      const modifiers: EnemyStatModifiers = {};

      for (const { behavior, config } of effects) {
        if (behavior.getStatModifiers) {
          Object.assign(modifiers, behavior.getStatModifiers(config));
        }
      }

      return modifiers;
    },
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Resets inactivity timer - call from onValidMatch
 */
export function resetInactivityTimer(internalState: Record<string, unknown>): void {
  internalState.timeSinceMatch = 0;
}
