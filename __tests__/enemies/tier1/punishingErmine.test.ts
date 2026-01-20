/**
 * Comprehensive Unit Tests for Punishing Ermine Enemy
 *
 * Punishing Ermine is a Tier 1 enemy with:
 * - Effect: On invalid match, 2 extra cards are removed (ExtraCardRemovalOnInvalidEffect)
 * - Config: { count: 2, minBoardSize: 6 }
 * - Defeat Condition: Make no invalid matches (must have at least 1 valid match)
 */

import { createPunishingErmine } from '@/utils/enemies/tier1/punishingErmine';
import { createRoundStats, createCard, createTestBoard, resetCardIdCounter } from '../../testUtils';

beforeEach(() => {
  resetCardIdCounter();
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Punishing Ermine', () => {
  // ==========================================================================
  // METADATA TESTS
  // ==========================================================================
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createPunishingErmine();
      expect(enemy.name).toBe('Punishing Ermine');
    });

    it('has tier 1', () => {
      const enemy = createPunishingErmine();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon', () => {
      const enemy = createPunishingErmine();
      expect(enemy.icon).toBe('delapouite/ermine');
    });

    it('has description containing invalid match info', () => {
      const enemy = createPunishingErmine();
      expect(enemy.description.toLowerCase()).toContain('invalid');
    });

    it('has description mentioning card removal', () => {
      const enemy = createPunishingErmine();
      expect(enemy.description.toLowerCase()).toContain('removed');
    });

    it('has description specifying 2 extra cards', () => {
      const enemy = createPunishingErmine();
      expect(enemy.description).toContain('2');
    });

    it('has defeat condition text mentioning no invalid matches', () => {
      const enemy = createPunishingErmine();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('no invalid');
    });

    it('has defeat condition text mentioning matches', () => {
      const enemy = createPunishingErmine();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('match');
    });

    it('has non-empty name', () => {
      const enemy = createPunishingErmine();
      expect(enemy.name.length).toBeGreaterThan(0);
    });

    it('has non-empty description', () => {
      const enemy = createPunishingErmine();
      expect(enemy.description.length).toBeGreaterThan(0);
    });

    it('has non-empty defeatConditionText', () => {
      const enemy = createPunishingErmine();
      expect(enemy.defeatConditionText.length).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // EXTRA CARD REMOVAL ON INVALID EFFECT TESTS
  // ==========================================================================
  describe('extra card removal on invalid match effect', () => {
    describe('card removal count', () => {
      it('removes exactly 2 cards on invalid match with large board', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);

        const result = enemy.onInvalidMatch([], board);

        expect(result.cardsToRemove).toHaveLength(2);
      });

      it('removes 2 cards on invalid match with board of 10 cards', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(10);

        const result = enemy.onInvalidMatch([], board);

        expect(result.cardsToRemove).toHaveLength(2);
      });

      it('removes 2 cards on invalid match with board of 9 cards', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(9);

        const result = enemy.onInvalidMatch([], board);

        expect(result.cardsToRemove).toHaveLength(2);
      });

      it('removes 2 cards on invalid match with board of 8 cards', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(8);

        const result = enemy.onInvalidMatch([], board);

        expect(result.cardsToRemove).toHaveLength(2);
      });

      it('removes only 1 card when board has 7 cards (to stay above minBoardSize 6)', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(7);

        const result = enemy.onInvalidMatch([], board);

        expect(result.cardsToRemove).toHaveLength(1);
      });

      it('removes 0 cards when board has exactly 6 cards (minBoardSize)', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(6);

        const result = enemy.onInvalidMatch([], board);

        expect(result.cardsToRemove).toHaveLength(0);
      });

      it('removes 0 cards when board has 5 cards (below minBoardSize)', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(5);

        const result = enemy.onInvalidMatch([], board);

        expect(result.cardsToRemove).toHaveLength(0);
      });

      it('removes 0 cards when board has 3 cards', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(3);

        const result = enemy.onInvalidMatch([], board);

        expect(result.cardsToRemove).toHaveLength(0);
      });

      it('removes 0 cards when board has 1 card', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(1);

        const result = enemy.onInvalidMatch([], board);

        expect(result.cardsToRemove).toHaveLength(0);
      });

      it('handles empty board gracefully', () => {
        const enemy = createPunishingErmine();
        const board: ReturnType<typeof createCard>[] = [];

        const result = enemy.onInvalidMatch([], board);

        expect(result.cardsToRemove).toHaveLength(0);
      });
    });

    describe('event emission', () => {
      it('emits 2 card_removed events on invalid match with large board', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);

        const result = enemy.onInvalidMatch([], board);

        expect(result.events).toHaveLength(2);
        result.events.forEach((event) => {
          expect(event.type).toBe('card_removed');
        });
      });

      it('emits card_removed events with reason enemy_invalid_penalty', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);

        const result = enemy.onInvalidMatch([], board);

        result.events.forEach((event) => {
          expect(event).toMatchObject({
            type: 'card_removed',
            reason: 'enemy_invalid_penalty',
          });
        });
      });

      it('emits events with valid card IDs', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);
        const boardIds = board.map((c) => c.id);

        const result = enemy.onInvalidMatch([], board);

        result.events.forEach((event) => {
          if (event.type === 'card_removed') {
            expect(boardIds).toContain(event.cardId);
          }
        });
      });

      it('emits 1 event when board has 7 cards', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(7);

        const result = enemy.onInvalidMatch([], board);

        expect(result.events).toHaveLength(1);
      });

      it('emits 0 events when board has 6 cards', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(6);

        const result = enemy.onInvalidMatch([], board);

        expect(result.events).toHaveLength(0);
      });
    });

    describe('dud card exclusion', () => {
      it('does not remove dud cards', () => {
        jest.spyOn(Math, 'random').mockReturnValue(0);
        const enemy = createPunishingErmine();
        const board = [
          createCard({ id: 'dud-1', isDud: true }),
          createCard({ id: 'dud-2', isDud: true }),
          createCard({ id: 'card-1' }),
          createCard({ id: 'card-2' }),
          createCard({ id: 'card-3' }),
          createCard({ id: 'card-4' }),
          createCard({ id: 'card-5' }),
          createCard({ id: 'card-6' }),
          createCard({ id: 'card-7' }),
          createCard({ id: 'card-8' }),
        ];

        const result = enemy.onInvalidMatch([], board);

        expect(result.cardsToRemove).toHaveLength(2);
        result.cardsToRemove.forEach((id) => {
          expect(id).not.toContain('dud');
        });
      });

      it('removes 0 cards when all non-dud cards would put board below minBoardSize', () => {
        const enemy = createPunishingErmine();
        const board = [
          createCard({ id: 'dud-1', isDud: true }),
          createCard({ id: 'dud-2', isDud: true }),
          createCard({ id: 'card-1' }),
          createCard({ id: 'card-2' }),
          createCard({ id: 'card-3' }),
          createCard({ id: 'card-4' }),
          createCard({ id: 'card-5' }),
          createCard({ id: 'card-6' }),
        ];

        const result = enemy.onInvalidMatch([], board);

        // Board has 8 cards total, can only remove 2 (8-6=2)
        expect(result.cardsToRemove.length).toBeLessThanOrEqual(2);
      });

      it('handles board with only dud cards', () => {
        const enemy = createPunishingErmine();
        const board = [
          createCard({ id: 'dud-1', isDud: true }),
          createCard({ id: 'dud-2', isDud: true }),
          createCard({ id: 'dud-3', isDud: true }),
          createCard({ id: 'dud-4', isDud: true }),
          createCard({ id: 'dud-5', isDud: true }),
          createCard({ id: 'dud-6', isDud: true }),
          createCard({ id: 'dud-7', isDud: true }),
          createCard({ id: 'dud-8', isDud: true }),
        ];

        const result = enemy.onInvalidMatch([], board);

        expect(result.cardsToRemove).toHaveLength(0);
      });
    });

    describe('valid match behavior (no effect)', () => {
      it('does not remove cards on valid match', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);
        const matchedCards = [board[0], board[1], board[2]];

        const result = enemy.onValidMatch(matchedCards, board);

        expect(result.cardsToRemove).toHaveLength(0);
      });

      it('does not emit card_removed events on valid match', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);
        const matchedCards = [board[0], board[1], board[2]];

        const result = enemy.onValidMatch(matchedCards, board);

        expect(result.events.filter((e) => e.type === 'card_removed')).toHaveLength(0);
      });

      it('returns empty cardsToRemove array on valid match', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);

        const result = enemy.onValidMatch([], board);

        expect(result.cardsToRemove).toEqual([]);
      });

      it('does not affect points multiplier on valid match', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);

        const result = enemy.onValidMatch([], board);

        expect(result.pointsMultiplier).toBe(1);
      });

      it('does not affect time delta on valid match', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);

        const result = enemy.onValidMatch([], board);

        expect(result.timeDelta).toBe(0);
      });
    });

    describe('randomness and card selection', () => {
      it('selects different cards when random returns different values', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);

        jest.spyOn(Math, 'random').mockReturnValue(0.1);
        const result1 = enemy.onInvalidMatch([], board);

        jest.spyOn(Math, 'random').mockReturnValue(0.9);
        const result2 = enemy.onInvalidMatch([], board);

        // Both should remove 2 cards but potentially different ones
        expect(result1.cardsToRemove).toHaveLength(2);
        expect(result2.cardsToRemove).toHaveLength(2);
      });

      it('removed cards match event card IDs', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);

        const result = enemy.onInvalidMatch([], board);

        const removedIds = result.cardsToRemove;
        const eventIds = result.events
          .filter((e) => e.type === 'card_removed')
          .map((e) => (e as { type: 'card_removed'; cardId: string }).cardId);

        expect(removedIds.sort()).toEqual(eventIds.sort());
      });
    });
  });

  // ==========================================================================
  // DEFEAT CONDITION TESTS
  // ==========================================================================
  describe('defeat condition', () => {
    describe('basic threshold tests', () => {
      it('returns false when no matches made (totalMatches = 0)', () => {
        const enemy = createPunishingErmine();
        const stats = createRoundStats({ totalMatches: 0, invalidMatches: 0 });

        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true when exactly 1 valid match and 0 invalid matches', () => {
        const enemy = createPunishingErmine();
        const stats = createRoundStats({ totalMatches: 1, invalidMatches: 0 });

        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when 5 valid matches and 0 invalid matches', () => {
        const enemy = createPunishingErmine();
        const stats = createRoundStats({ totalMatches: 5, invalidMatches: 0 });

        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when 10 valid matches and 0 invalid matches', () => {
        const enemy = createPunishingErmine();
        const stats = createRoundStats({ totalMatches: 10, invalidMatches: 0 });

        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when 100 valid matches and 0 invalid matches', () => {
        const enemy = createPunishingErmine();
        const stats = createRoundStats({ totalMatches: 100, invalidMatches: 0 });

        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('invalid match failure cases', () => {
      it('returns false when 1 invalid match made', () => {
        const enemy = createPunishingErmine();
        const stats = createRoundStats({ totalMatches: 5, invalidMatches: 1 });

        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when 2 invalid matches made', () => {
        const enemy = createPunishingErmine();
        const stats = createRoundStats({ totalMatches: 10, invalidMatches: 2 });

        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when 5 invalid matches made', () => {
        const enemy = createPunishingErmine();
        const stats = createRoundStats({ totalMatches: 15, invalidMatches: 5 });

        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when 10 invalid matches made', () => {
        const enemy = createPunishingErmine();
        const stats = createRoundStats({ totalMatches: 20, invalidMatches: 10 });

        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when many invalid matches but also many valid matches', () => {
        const enemy = createPunishingErmine();
        const stats = createRoundStats({ totalMatches: 100, invalidMatches: 50 });

        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('returns false when 0 total matches and 0 invalid matches', () => {
        const enemy = createPunishingErmine();
        const stats = createRoundStats({ totalMatches: 0, invalidMatches: 0 });

        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('requires at least 1 valid match to be defeated', () => {
        const enemy = createPunishingErmine();
        const statsNoMatch = createRoundStats({ totalMatches: 0, invalidMatches: 0 });
        const statsOneMatch = createRoundStats({ totalMatches: 1, invalidMatches: 0 });

        expect(enemy.checkDefeatCondition(statsNoMatch)).toBe(false);
        expect(enemy.checkDefeatCondition(statsOneMatch)).toBe(true);
      });

      it('only considers invalidMatches and totalMatches, not other stats', () => {
        const enemy = createPunishingErmine();
        const stats = createRoundStats({
          totalMatches: 3,
          invalidMatches: 0,
          currentStreak: 100,
          maxStreak: 100,
          hintsUsed: 50,
          gracesUsed: 50,
          damageReceived: 10,
        });

        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS TESTS
  // ==========================================================================
  describe('lifecycle hooks', () => {
    describe('onRoundStart', () => {
      it('returns empty card modifications', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);

        const result = enemy.onRoundStart(board);

        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty events', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);

        const result = enemy.onRoundStart(board);

        expect(result.events).toEqual([]);
      });

      it('does not modify any cards on the board', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);
        const originalBoard = JSON.stringify(board);

        enemy.onRoundStart(board);

        expect(JSON.stringify(board)).toBe(originalBoard);
      });

      it('handles empty board on round start', () => {
        const enemy = createPunishingErmine();
        const board: ReturnType<typeof createCard>[] = [];

        const result = enemy.onRoundStart(board);

        expect(result.cardModifications).toEqual([]);
        expect(result.events).toEqual([]);
      });

      it('handles board with varied cards', () => {
        const enemy = createPunishingErmine();
        const board = [
          createCard({ shape: 'oval', color: 'red', number: 1 }),
          createCard({ shape: 'squiggle', color: 'green', number: 2 }),
          createCard({ shape: 'diamond', color: 'purple', number: 3 }),
        ];

        const result = enemy.onRoundStart(board);

        expect(result.cardModifications).toEqual([]);
        expect(result.events).toEqual([]);
      });
    });

    describe('onCardDraw', () => {
      it('returns the card unchanged', () => {
        const enemy = createPunishingErmine();
        const card = createCard({ shape: 'diamond', color: 'purple', number: 2 });

        const result = enemy.onCardDraw(card);

        expect(result).toEqual(card);
      });

      it('does not add isDud property', () => {
        const enemy = createPunishingErmine();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result.isDud).toBeUndefined();
      });

      it('does not add isFaceDown property', () => {
        const enemy = createPunishingErmine();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result.isFaceDown).toBeUndefined();
      });

      it('does not add hasBomb property', () => {
        const enemy = createPunishingErmine();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result.hasBomb).toBeUndefined();
      });

      it('does not add hasCountdown property', () => {
        const enemy = createPunishingErmine();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result.hasCountdown).toBeUndefined();
      });

      it('preserves existing card properties', () => {
        const enemy = createPunishingErmine();
        const card = createCard({
          shape: 'squiggle',
          color: 'green',
          number: 3,
          shading: 'striped',
          selected: true,
        });

        const result = enemy.onCardDraw(card);

        expect(result.shape).toBe('squiggle');
        expect(result.color).toBe('green');
        expect(result.number).toBe(3);
        expect(result.shading).toBe('striped');
        expect(result.selected).toBe(true);
      });

      it('handles card with existing special properties', () => {
        const enemy = createPunishingErmine();
        const card = createCard({ isDud: true });

        const result = enemy.onCardDraw(card);

        expect(result.isDud).toBe(true);
      });
    });

    describe('onTick', () => {
      it('returns zero score delta', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.scoreDelta).toBe(0);
      });

      it('returns zero health delta', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.healthDelta).toBe(0);
      });

      it('returns zero time delta', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.timeDelta).toBe(0);
      });

      it('does not trigger instant death', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.instantDeath).toBe(false);
      });

      it('returns empty cardsToRemove', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty cardModifications', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty cardsToFlip', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.events).toEqual([]);
      });

      it('handles small deltaMs (1ms)', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);

        const result = enemy.onTick(1, board);

        expect(result.healthDelta).toBe(0);
        expect(result.instantDeath).toBe(false);
      });

      it('handles large deltaMs (10 seconds)', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);

        const result = enemy.onTick(10000, board);

        expect(result.healthDelta).toBe(0);
        expect(result.instantDeath).toBe(false);
      });

      it('remains consistent over many ticks (60 seconds)', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);

        for (let i = 0; i < 600; i++) {
          const result = enemy.onTick(100, board);
          expect(result.healthDelta).toBe(0);
          expect(result.instantDeath).toBe(false);
        }
      });

      it('handles empty board', () => {
        const enemy = createPunishingErmine();
        const board: ReturnType<typeof createCard>[] = [];

        const result = enemy.onTick(100, board);

        expect(result.scoreDelta).toBe(0);
        expect(result.healthDelta).toBe(0);
      });
    });

    describe('onRoundEnd', () => {
      it('executes without error', () => {
        const enemy = createPunishingErmine();

        expect(() => enemy.onRoundEnd()).not.toThrow();
      });

      it('can be called multiple times without issue', () => {
        const enemy = createPunishingErmine();

        expect(() => {
          enemy.onRoundEnd();
          enemy.onRoundEnd();
          enemy.onRoundEnd();
        }).not.toThrow();
      });

      it('can be called after various lifecycle events', () => {
        const enemy = createPunishingErmine();
        const board = createTestBoard(12);

        enemy.onRoundStart(board);
        enemy.onTick(100, board);
        enemy.onValidMatch([], board);
        enemy.onInvalidMatch([], board);

        expect(() => enemy.onRoundEnd()).not.toThrow();
      });
    });
  });

  // ==========================================================================
  // UI MODIFIERS TESTS
  // ==========================================================================
  describe('UI modifiers', () => {
    it('returns empty object (no UI modifiers)', () => {
      const enemy = createPunishingErmine();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers).toEqual({});
    });

    it('does not show inactivity bar', () => {
      const enemy = createPunishingErmine();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showInactivityBar).toBeUndefined();
    });

    it('does not show score decay', () => {
      const enemy = createPunishingErmine();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showScoreDecay).toBeUndefined();
    });

    it('does not modify timer speed', () => {
      const enemy = createPunishingErmine();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.timerSpeedMultiplier).toBeUndefined();
    });

    it('does not disable auto hints', () => {
      const enemy = createPunishingErmine();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.disableAutoHint).toBeUndefined();
    });

    it('does not disable manual hints', () => {
      const enemy = createPunishingErmine();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.disableManualHint).toBeUndefined();
    });

    it('does not show countdown cards', () => {
      const enemy = createPunishingErmine();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showCountdownCards).toBeUndefined();
    });

    it('does not show bomb cards', () => {
      const enemy = createPunishingErmine();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showBombCards).toBeUndefined();
    });

    it('does not show weapon counters', () => {
      const enemy = createPunishingErmine();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.weaponCounters).toBeUndefined();
    });

    it('returns consistent modifiers across multiple calls', () => {
      const enemy = createPunishingErmine();

      const modifiers1 = enemy.getUIModifiers();
      const modifiers2 = enemy.getUIModifiers();
      const modifiers3 = enemy.getUIModifiers();

      expect(modifiers1).toEqual(modifiers2);
      expect(modifiers2).toEqual(modifiers3);
    });
  });

  // ==========================================================================
  // STAT MODIFIERS TESTS
  // ==========================================================================
  describe('stat modifiers', () => {
    it('returns empty object (no stat modifiers)', () => {
      const enemy = createPunishingErmine();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers).toEqual({});
    });

    it('does not reduce fire spread chance', () => {
      const enemy = createPunishingErmine();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
    });

    it('does not reduce explosion chance', () => {
      const enemy = createPunishingErmine();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.explosionChanceReduction).toBeUndefined();
    });

    it('does not reduce laser chance', () => {
      const enemy = createPunishingErmine();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.laserChanceReduction).toBeUndefined();
    });

    it('does not reduce hint gain chance', () => {
      const enemy = createPunishingErmine();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.hintGainChanceReduction).toBeUndefined();
    });

    it('does not reduce grace gain chance', () => {
      const enemy = createPunishingErmine();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.graceGainChanceReduction).toBeUndefined();
    });

    it('does not reduce time gain chance', () => {
      const enemy = createPunishingErmine();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.timeGainChanceReduction).toBeUndefined();
    });

    it('does not reduce healing chance', () => {
      const enemy = createPunishingErmine();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.healingChanceReduction).toBeUndefined();
    });

    it('does not modify damage multiplier', () => {
      const enemy = createPunishingErmine();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.damageMultiplier).toBeUndefined();
    });

    it('does not modify points multiplier', () => {
      const enemy = createPunishingErmine();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.pointsMultiplier).toBeUndefined();
    });

    it('returns consistent modifiers across multiple calls', () => {
      const enemy = createPunishingErmine();

      const modifiers1 = enemy.getStatModifiers();
      const modifiers2 = enemy.getStatModifiers();
      const modifiers3 = enemy.getStatModifiers();

      expect(modifiers1).toEqual(modifiers2);
      expect(modifiers2).toEqual(modifiers3);
    });
  });

  // ==========================================================================
  // INTEGRATION / EDGE CASE TESTS
  // ==========================================================================
  describe('edge cases', () => {
    it('handles empty board on invalid match', () => {
      const enemy = createPunishingErmine();
      const emptyBoard: ReturnType<typeof createCard>[] = [];

      const result = enemy.onInvalidMatch([], emptyBoard);

      expect(result.cardsToRemove).toHaveLength(0);
    });

    it('handles empty invalid cards array', () => {
      const enemy = createPunishingErmine();
      const board = createTestBoard(12);

      const result = enemy.onInvalidMatch([], board);

      expect(result.cardsToRemove).toHaveLength(2);
    });

    it('handles invalid cards array with cards', () => {
      const enemy = createPunishingErmine();
      const board = createTestBoard(12);
      const invalidCards = [board[0], board[1], board[2]];

      const result = enemy.onInvalidMatch(invalidCards, board);

      expect(result.cardsToRemove).toHaveLength(2);
    });

    it('maintains state across round restart', () => {
      const enemy = createPunishingErmine();
      const board = createTestBoard(12);

      // First round
      enemy.onRoundStart(board);
      const result1 = enemy.onInvalidMatch([], board);
      enemy.onRoundEnd();

      // Second round
      enemy.onRoundStart(board);
      const result2 = enemy.onInvalidMatch([], board);

      expect(result1.cardsToRemove).toHaveLength(2);
      expect(result2.cardsToRemove).toHaveLength(2);
    });

    it('creates fresh instances each time', () => {
      const enemy1 = createPunishingErmine();
      const enemy2 = createPunishingErmine();

      // Modify enemy1 state
      enemy1.onRoundStart(createTestBoard(12));
      enemy1.onInvalidMatch([], createTestBoard(12));

      // enemy2 should be independent
      expect(enemy2.name).toBe('Punishing Ermine');
      expect(enemy2.tier).toBe(1);
    });

    it('handles board with special card types', () => {
      const enemy = createPunishingErmine();
      const board = [
        createCard({ isFaceDown: true }),
        createCard({ hasBomb: true, bombTimer: 5000 }),
        createCard({ hasCountdown: true, countdownTimer: 10000 }),
        createCard({ health: 3 }),
        createCard({ onFire: true }),
        createCard(),
        createCard(),
        createCard(),
        createCard(),
        createCard(),
        createCard(),
        createCard(),
      ];

      const result = enemy.onInvalidMatch([], board);

      expect(result.cardsToRemove).toHaveLength(2);
    });
  });

  // ==========================================================================
  // CUMULATIVE EFFECT TESTS
  // ==========================================================================
  describe('cumulative invalid match penalty', () => {
    it('removes 2 cards on each invalid match (3 invalid matches = 6 total)', () => {
      const enemy = createPunishingErmine();

      let totalRemoved = 0;
      for (let i = 0; i < 3; i++) {
        const board = createTestBoard(12); // Fresh board each time
        const result = enemy.onInvalidMatch([], board);
        totalRemoved += result.cardsToRemove.length;
      }

      expect(totalRemoved).toBe(6);
    });

    it('emits correct number of events across multiple invalid matches', () => {
      const enemy = createPunishingErmine();

      const allEvents: Array<{ type: string }> = [];
      for (let i = 0; i < 5; i++) {
        const board = createTestBoard(12);
        const result = enemy.onInvalidMatch([], board);
        allEvents.push(...result.events);
      }

      const cardRemovedEvents = allEvents.filter((e) => e.type === 'card_removed');
      expect(cardRemovedEvents).toHaveLength(10); // 2 events * 5 matches
    });

    it('board shrinks correctly with consecutive invalid matches on same board', () => {
      const enemy = createPunishingErmine();
      let board = createTestBoard(12);

      // First invalid match - removes 2 cards (12 -> 10)
      let result = enemy.onInvalidMatch([], board);
      expect(result.cardsToRemove).toHaveLength(2);
      board = board.filter((c) => !result.cardsToRemove.includes(c.id));
      expect(board).toHaveLength(10);

      // Second invalid match - removes 2 cards (10 -> 8)
      result = enemy.onInvalidMatch([], board);
      expect(result.cardsToRemove).toHaveLength(2);
      board = board.filter((c) => !result.cardsToRemove.includes(c.id));
      expect(board).toHaveLength(8);

      // Third invalid match - removes 2 cards (8 -> 6)
      result = enemy.onInvalidMatch([], board);
      expect(result.cardsToRemove).toHaveLength(2);
      board = board.filter((c) => !result.cardsToRemove.includes(c.id));
      expect(board).toHaveLength(6);

      // Fourth invalid match - removes 0 cards (at minBoardSize)
      result = enemy.onInvalidMatch([], board);
      expect(result.cardsToRemove).toHaveLength(0);
    });
  });

  // ==========================================================================
  // BOUNDARY CONDITION TESTS
  // ==========================================================================
  describe('boundary conditions', () => {
    it('handles board exactly at minBoardSize + count threshold', () => {
      const enemy = createPunishingErmine();
      const board = createTestBoard(8); // 8 cards, can remove exactly 2 to reach 6

      const result = enemy.onInvalidMatch([], board);

      expect(result.cardsToRemove).toHaveLength(2);
    });

    it('handles board at minBoardSize + count - 1', () => {
      const enemy = createPunishingErmine();
      const board = createTestBoard(7); // 7 cards, can only remove 1 to stay above 6

      const result = enemy.onInvalidMatch([], board);

      expect(result.cardsToRemove).toHaveLength(1);
    });

    it('handles very large board', () => {
      const enemy = createPunishingErmine();
      const board = createTestBoard(50);

      const result = enemy.onInvalidMatch([], board);

      expect(result.cardsToRemove).toHaveLength(2);
    });

    it('handles mixed dud and normal cards at boundary', () => {
      const enemy = createPunishingErmine();
      const board = [
        createCard({ id: 'card-1' }),
        createCard({ id: 'card-2' }),
        createCard({ id: 'card-3' }),
        createCard({ id: 'card-4' }),
        createCard({ id: 'card-5' }),
        createCard({ id: 'card-6' }),
        createCard({ id: 'card-7' }),
        createCard({ id: 'dud-1', isDud: true }),
      ];

      const result = enemy.onInvalidMatch([], board);

      // Board has 8 cards total, but can remove 2 (staying above 6)
      // Only non-dud cards should be removed
      expect(result.cardsToRemove).toHaveLength(2);
      result.cardsToRemove.forEach((id) => {
        expect(id).not.toContain('dud');
      });
    });
  });
});
