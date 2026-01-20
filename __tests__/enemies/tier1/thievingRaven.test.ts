/**
 * Comprehensive Unit Tests for Thieving Raven Enemy
 *
 * Thieving Raven is a Tier 1 enemy with:
 * - Effect: -5s stolen per match (TimeStealEffect)
 * - Defeat Condition: Complete 5 matches total
 */

import { createThievingRaven } from '@/utils/enemies/tier1/thievingRaven';
import { createRoundStats, createCard, createTestBoard, resetCardIdCounter } from '../../testUtils';

beforeEach(() => {
  resetCardIdCounter();
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Thieving Raven', () => {
  // ==========================================================================
  // METADATA TESTS
  // ==========================================================================
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createThievingRaven();
      expect(enemy.name).toBe('Thieving Raven');
    });

    it('has tier 1', () => {
      const enemy = createThievingRaven();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon', () => {
      const enemy = createThievingRaven();
      expect(enemy.icon).toBe('lorc/raven');
    });

    it('has description containing time steal info', () => {
      const enemy = createThievingRaven();
      expect(enemy.description).toContain('-5s');
      expect(enemy.description.toLowerCase()).toContain('stolen');
    });

    it('has defeat condition text mentioning 5 matches', () => {
      const enemy = createThievingRaven();
      expect(enemy.defeatConditionText).toContain('5');
      expect(enemy.defeatConditionText.toLowerCase()).toContain('match');
    });
  });

  // ==========================================================================
  // TIME STEAL EFFECT TESTS
  // ==========================================================================
  describe('time steal effect', () => {
    it('steals exactly 5 seconds on valid match', () => {
      const enemy = createThievingRaven();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      const result = enemy.onValidMatch(matchedCards, board);

      expect(result.timeDelta).toBe(-5);
    });

    it('emits time_stolen event with correct amount', () => {
      const enemy = createThievingRaven();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      const result = enemy.onValidMatch(matchedCards, board);

      expect(result.events).toContainEqual({
        type: 'time_stolen',
        amount: 5,
      });
    });

    it('steals time consistently on multiple consecutive matches', () => {
      const enemy = createThievingRaven();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      // First match
      const result1 = enemy.onValidMatch(matchedCards, board);
      expect(result1.timeDelta).toBe(-5);

      // Second match
      const result2 = enemy.onValidMatch(matchedCards, board);
      expect(result2.timeDelta).toBe(-5);

      // Third match
      const result3 = enemy.onValidMatch(matchedCards, board);
      expect(result3.timeDelta).toBe(-5);
    });

    it('always emits time_stolen event on valid match', () => {
      const enemy = createThievingRaven();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      // Run multiple times to ensure consistency
      for (let i = 0; i < 5; i++) {
        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.events.some((e) => e.type === 'time_stolen')).toBe(true);
      }
    });

    it('does not affect points multiplier', () => {
      const enemy = createThievingRaven();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      const result = enemy.onValidMatch(matchedCards, board);

      expect(result.pointsMultiplier).toBe(1);
    });

    it('does not remove extra cards on valid match', () => {
      const enemy = createThievingRaven();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      const result = enemy.onValidMatch(matchedCards, board);

      expect(result.cardsToRemove).toEqual([]);
    });

    it('does not flip any cards on valid match', () => {
      const enemy = createThievingRaven();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      const result = enemy.onValidMatch(matchedCards, board);

      expect(result.cardsToFlip).toEqual([]);
    });
  });

  // ==========================================================================
  // INVALID MATCH BEHAVIOR TESTS
  // ==========================================================================
  describe('invalid match behavior', () => {
    it('does not steal time on invalid match', () => {
      const enemy = createThievingRaven();
      const board = createTestBoard(12);
      const invalidCards = [board[0], board[1], board[2]];

      const result = enemy.onInvalidMatch(invalidCards, board);

      expect(result.timeDelta).toBe(0);
    });

    it('does not emit time_stolen event on invalid match', () => {
      const enemy = createThievingRaven();
      const board = createTestBoard(12);
      const invalidCards = [board[0], board[1], board[2]];

      const result = enemy.onInvalidMatch(invalidCards, board);

      expect(result.events).not.toContainEqual(
        expect.objectContaining({ type: 'time_stolen' })
      );
    });

    it('does not affect points multiplier on invalid match', () => {
      const enemy = createThievingRaven();
      const board = createTestBoard(12);
      const invalidCards = [board[0], board[1], board[2]];

      const result = enemy.onInvalidMatch(invalidCards, board);

      expect(result.pointsMultiplier).toBe(1);
    });

    it('does not remove extra cards on invalid match', () => {
      const enemy = createThievingRaven();
      const board = createTestBoard(12);
      const invalidCards = [board[0], board[1], board[2]];

      const result = enemy.onInvalidMatch(invalidCards, board);

      expect(result.cardsToRemove).toEqual([]);
    });
  });

  // ==========================================================================
  // DEFEAT CONDITION TESTS
  // ==========================================================================
  describe('defeat condition', () => {
    it('returns false when totalMatches is 0', () => {
      const enemy = createThievingRaven();
      const stats = createRoundStats({ totalMatches: 0 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when totalMatches is 1', () => {
      const enemy = createThievingRaven();
      const stats = createRoundStats({ totalMatches: 1 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when totalMatches is 4 (threshold - 1)', () => {
      const enemy = createThievingRaven();
      const stats = createRoundStats({ totalMatches: 4 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when totalMatches is exactly 5 (threshold)', () => {
      const enemy = createThievingRaven();
      const stats = createRoundStats({ totalMatches: 5 });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when totalMatches is 6 (above threshold)', () => {
      const enemy = createThievingRaven();
      const stats = createRoundStats({ totalMatches: 6 });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when totalMatches is 10 (well above threshold)', () => {
      const enemy = createThievingRaven();
      const stats = createRoundStats({ totalMatches: 10 });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when totalMatches is 100 (extreme case)', () => {
      const enemy = createThievingRaven();
      const stats = createRoundStats({ totalMatches: 100 });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('ignores invalidMatches count for defeat condition', () => {
      const enemy = createThievingRaven();
      const stats = createRoundStats({ totalMatches: 3, invalidMatches: 10 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('only considers totalMatches, not other stats', () => {
      const enemy = createThievingRaven();
      const stats = createRoundStats({
        totalMatches: 4,
        currentStreak: 100,
        maxStreak: 100,
        hintsUsed: 50,
        gracesUsed: 50,
      });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS TESTS
  // ==========================================================================
  describe('lifecycle hooks', () => {
    describe('onRoundStart', () => {
      it('returns empty card modifications', () => {
        const enemy = createThievingRaven();
        const board = createTestBoard(12);

        const result = enemy.onRoundStart(board);

        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty events', () => {
        const enemy = createThievingRaven();
        const board = createTestBoard(12);

        const result = enemy.onRoundStart(board);

        expect(result.events).toEqual([]);
      });

      it('does not modify any cards on the board', () => {
        const enemy = createThievingRaven();
        const board = createTestBoard(12);
        const originalBoard = JSON.stringify(board);

        enemy.onRoundStart(board);

        expect(JSON.stringify(board)).toBe(originalBoard);
      });
    });

    describe('onCardDraw', () => {
      it('returns the card unchanged', () => {
        const enemy = createThievingRaven();
        const card = createCard({ shape: 'diamond', color: 'purple', number: 2 });

        const result = enemy.onCardDraw(card);

        expect(result).toEqual(card);
      });

      it('does not add any special properties to the card', () => {
        const enemy = createThievingRaven();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result.isDud).toBeUndefined();
        expect(result.isFaceDown).toBeUndefined();
        expect(result.hasBomb).toBeUndefined();
        expect(result.hasCountdown).toBeUndefined();
      });
    });

    describe('onTick', () => {
      it('returns zero score delta', () => {
        const enemy = createThievingRaven();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.scoreDelta).toBe(0);
      });

      it('returns zero health delta', () => {
        const enemy = createThievingRaven();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.healthDelta).toBe(0);
      });

      it('returns zero time delta', () => {
        const enemy = createThievingRaven();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.timeDelta).toBe(0);
      });

      it('does not trigger instant death', () => {
        const enemy = createThievingRaven();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.instantDeath).toBe(false);
      });

      it('returns empty arrays for card operations', () => {
        const enemy = createThievingRaven();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.cardsToRemove).toEqual([]);
        expect(result.cardModifications).toEqual([]);
        expect(result.cardsToFlip).toEqual([]);
        expect(result.events).toEqual([]);
      });

      it('remains consistent over many ticks', () => {
        const enemy = createThievingRaven();
        const board = createTestBoard(12);

        // Simulate 60 seconds of gameplay
        for (let i = 0; i < 600; i++) {
          const result = enemy.onTick(100, board);
          expect(result.healthDelta).toBe(0);
          expect(result.instantDeath).toBe(false);
        }
      });
    });

    describe('onRoundEnd', () => {
      it('executes without error', () => {
        const enemy = createThievingRaven();

        expect(() => enemy.onRoundEnd()).not.toThrow();
      });

      it('can be called multiple times without issue', () => {
        const enemy = createThievingRaven();

        expect(() => {
          enemy.onRoundEnd();
          enemy.onRoundEnd();
          enemy.onRoundEnd();
        }).not.toThrow();
      });
    });
  });

  // ==========================================================================
  // UI/STAT MODIFIERS TESTS
  // ==========================================================================
  describe('UI modifiers', () => {
    it('returns empty object (no UI modifiers)', () => {
      const enemy = createThievingRaven();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers).toEqual({});
    });

    it('does not show inactivity bar', () => {
      const enemy = createThievingRaven();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showInactivityBar).toBeUndefined();
    });

    it('does not show score decay', () => {
      const enemy = createThievingRaven();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showScoreDecay).toBeUndefined();
    });

    it('does not modify timer speed', () => {
      const enemy = createThievingRaven();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.timerSpeedMultiplier).toBeUndefined();
    });

    it('does not disable hints', () => {
      const enemy = createThievingRaven();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.disableAutoHint).toBeUndefined();
      expect(modifiers.disableManualHint).toBeUndefined();
    });

    it('does not show weapon counters', () => {
      const enemy = createThievingRaven();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.weaponCounters).toBeUndefined();
    });
  });

  describe('stat modifiers', () => {
    it('returns empty object (no stat modifiers)', () => {
      const enemy = createThievingRaven();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers).toEqual({});
    });

    it('does not reduce fire spread chance', () => {
      const enemy = createThievingRaven();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
    });

    it('does not reduce explosion chance', () => {
      const enemy = createThievingRaven();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.explosionChanceReduction).toBeUndefined();
    });

    it('does not modify damage multiplier', () => {
      const enemy = createThievingRaven();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.damageMultiplier).toBeUndefined();
    });

    it('does not modify points multiplier', () => {
      const enemy = createThievingRaven();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.pointsMultiplier).toBeUndefined();
    });
  });

  // ==========================================================================
  // INTEGRATION / EDGE CASE TESTS
  // ==========================================================================
  describe('edge cases', () => {
    it('handles empty board on valid match', () => {
      const enemy = createThievingRaven();
      const emptyBoard: ReturnType<typeof createCard>[] = [];
      const matchedCards = [createCard(), createCard(), createCard()];

      const result = enemy.onValidMatch(matchedCards, emptyBoard);

      expect(result.timeDelta).toBe(-5);
    });

    it('handles empty matched cards array', () => {
      const enemy = createThievingRaven();
      const board = createTestBoard(12);

      const result = enemy.onValidMatch([], board);

      expect(result.timeDelta).toBe(-5);
    });

    it('maintains state across round restart', () => {
      const enemy = createThievingRaven();
      const board = createTestBoard(12);

      // First round
      enemy.onRoundStart(board);
      const result1 = enemy.onValidMatch([board[0], board[1], board[2]], board);
      enemy.onRoundEnd();

      // Second round
      enemy.onRoundStart(board);
      const result2 = enemy.onValidMatch([board[0], board[1], board[2]], board);

      expect(result1.timeDelta).toBe(-5);
      expect(result2.timeDelta).toBe(-5);
    });

    it('creates fresh instances each time', () => {
      const enemy1 = createThievingRaven();
      const enemy2 = createThievingRaven();

      // Modify enemy1 state
      enemy1.onRoundStart(createTestBoard(12));
      enemy1.onValidMatch([], []);

      // enemy2 should be independent
      expect(enemy2.name).toBe('Thieving Raven');
      expect(enemy2.tier).toBe(1);
    });
  });

  // ==========================================================================
  // CUMULATIVE EFFECT TESTS
  // ==========================================================================
  describe('cumulative time steal', () => {
    it('steals 25 seconds total after 5 matches', () => {
      const enemy = createThievingRaven();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      let totalTimeStolen = 0;
      for (let i = 0; i < 5; i++) {
        const result = enemy.onValidMatch(matchedCards, board);
        totalTimeStolen += Math.abs(result.timeDelta);
      }

      expect(totalTimeStolen).toBe(25);
    });

    it('emits exactly 5 time_stolen events for 5 matches', () => {
      const enemy = createThievingRaven();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      const allEvents: Array<{ type: string; amount?: number }> = [];
      for (let i = 0; i < 5; i++) {
        const result = enemy.onValidMatch(matchedCards, board);
        allEvents.push(...result.events);
      }

      const timeStolenEvents = allEvents.filter((e) => e.type === 'time_stolen');
      expect(timeStolenEvents).toHaveLength(5);
      expect(timeStolenEvents.every((e) => e.amount === 5)).toBe(true);
    });
  });
});
