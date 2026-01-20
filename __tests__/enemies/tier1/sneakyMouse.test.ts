/**
 * Comprehensive Unit Tests for Sneaky Mouse Enemy
 *
 * Sneaky Mouse is a Tier 1 enemy with:
 * - Effect: Grace gain reduced by 15% (WeaponCounterEffect)
 * - Defeat Condition: Never use a grace (must have at least 1 match)
 */

import { createSneakyMouse } from '@/utils/enemies/tier1/sneakyMouse';
import {
  createRoundStats,
  createCard,
  createTestBoard,
  createVariedBoard,
  createFaceDownCard,
  createTripleCard,
  resetCardIdCounter,
} from '../../testUtils';

beforeEach(() => {
  resetCardIdCounter();
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Sneaky Mouse', () => {
  // ==========================================================================
  // METADATA TESTS
  // ==========================================================================
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createSneakyMouse();
      expect(enemy.name).toBe('Sneaky Mouse');
    });

    it('has tier 1', () => {
      const enemy = createSneakyMouse();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon', () => {
      const enemy = createSneakyMouse();
      expect(enemy.icon).toBe('lorc/mouse');
    });

    it('has description containing grace reduction info', () => {
      const enemy = createSneakyMouse();
      expect(enemy.description.toLowerCase()).toContain('grace');
      expect(enemy.description).toContain('15%');
    });

    it('has description mentioning reduction', () => {
      const enemy = createSneakyMouse();
      expect(enemy.description.toLowerCase()).toContain('reduced');
    });

    it('has defeat condition text mentioning grace', () => {
      const enemy = createSneakyMouse();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('grace');
    });

    it('has defeat condition text mentioning never', () => {
      const enemy = createSneakyMouse();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('never');
    });

    it('returns consistent metadata on multiple calls', () => {
      const enemy = createSneakyMouse();
      expect(enemy.name).toBe('Sneaky Mouse');
      expect(enemy.name).toBe('Sneaky Mouse');
      expect(enemy.tier).toBe(1);
      expect(enemy.tier).toBe(1);
    });
  });

  // ==========================================================================
  // WEAPON COUNTER EFFECT TESTS
  // ==========================================================================
  describe('weapon counter effect', () => {
    it('returns grace gain chance reduction of 15 in stat modifiers', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.graceGainChanceReduction).toBe(15);
    });

    it('shows weapon counter in UI modifiers', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters).toContainEqual({
        type: 'grace',
        reduction: 15,
      });
    });

    it('returns exactly one weapon counter', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters).toHaveLength(1);
    });

    it('weapon counter has correct type', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters?.[0].type).toBe('grace');
    });

    it('weapon counter has correct reduction value', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters?.[0].reduction).toBe(15);
    });

    it('stat modifiers remain consistent after round start', () => {
      const enemy = createSneakyMouse();
      const board = createTestBoard(12);

      const modifiersBefore = enemy.getStatModifiers();
      enemy.onRoundStart(board);
      const modifiersAfter = enemy.getStatModifiers();

      expect(modifiersBefore.graceGainChanceReduction).toBe(
        modifiersAfter.graceGainChanceReduction
      );
    });

    it('stat modifiers remain consistent after valid match', () => {
      const enemy = createSneakyMouse();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      const modifiersBefore = enemy.getStatModifiers();
      enemy.onValidMatch([board[0], board[1], board[2]], board);
      const modifiersAfter = enemy.getStatModifiers();

      expect(modifiersBefore.graceGainChanceReduction).toBe(
        modifiersAfter.graceGainChanceReduction
      );
    });

    it('stat modifiers remain consistent after invalid match', () => {
      const enemy = createSneakyMouse();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      const modifiersBefore = enemy.getStatModifiers();
      enemy.onInvalidMatch([board[0], board[1], board[2]], board);
      const modifiersAfter = enemy.getStatModifiers();

      expect(modifiersBefore.graceGainChanceReduction).toBe(
        modifiersAfter.graceGainChanceReduction
      );
    });

    it('stat modifiers remain consistent after multiple ticks', () => {
      const enemy = createSneakyMouse();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      const modifiersBefore = enemy.getStatModifiers();
      for (let i = 0; i < 100; i++) {
        enemy.onTick(100, board);
      }
      const modifiersAfter = enemy.getStatModifiers();

      expect(modifiersBefore.graceGainChanceReduction).toBe(
        modifiersAfter.graceGainChanceReduction
      );
    });

    it('does not reduce other weapon chances', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getStatModifiers();

      expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
      expect(modifiers.explosionChanceReduction).toBeUndefined();
      expect(modifiers.laserChanceReduction).toBeUndefined();
      expect(modifiers.hintGainChanceReduction).toBeUndefined();
      expect(modifiers.timeGainChanceReduction).toBeUndefined();
      expect(modifiers.healingChanceReduction).toBeUndefined();
    });

    it('does not modify damage multiplier', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getStatModifiers();

      expect(modifiers.damageMultiplier).toBeUndefined();
    });

    it('does not modify points multiplier in stat modifiers', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getStatModifiers();

      expect(modifiers.pointsMultiplier).toBeUndefined();
    });
  });

  // ==========================================================================
  // DEFEAT CONDITION TESTS
  // ==========================================================================
  describe('defeat condition', () => {
    describe('boundary cases', () => {
      it('returns false when no matches have been made (totalMatches = 0)', () => {
        const enemy = createSneakyMouse();
        const stats = createRoundStats({
          totalMatches: 0,
          gracesUsed: 0,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true when exactly 1 match and no graces used', () => {
        const enemy = createSneakyMouse();
        const stats = createRoundStats({
          totalMatches: 1,
          gracesUsed: 0,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns false when exactly 1 match and 1 grace used', () => {
        const enemy = createSneakyMouse();
        const stats = createRoundStats({
          totalMatches: 1,
          gracesUsed: 1,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });

    describe('graces used edge cases', () => {
      it('returns false when gracesUsed is exactly 1', () => {
        const enemy = createSneakyMouse();
        const stats = createRoundStats({
          totalMatches: 5,
          gracesUsed: 1,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when gracesUsed is 2', () => {
        const enemy = createSneakyMouse();
        const stats = createRoundStats({
          totalMatches: 5,
          gracesUsed: 2,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when multiple graces have been used', () => {
        const enemy = createSneakyMouse();
        const stats = createRoundStats({
          totalMatches: 10,
          gracesUsed: 3,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false with many graces used', () => {
        const enemy = createSneakyMouse();
        const stats = createRoundStats({
          totalMatches: 20,
          gracesUsed: 15,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false even with extreme grace usage', () => {
        const enemy = createSneakyMouse();
        const stats = createRoundStats({
          totalMatches: 100,
          gracesUsed: 99,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });

    describe('matches count edge cases', () => {
      it('returns true when totalMatches is 2 and no graces used', () => {
        const enemy = createSneakyMouse();
        const stats = createRoundStats({
          totalMatches: 2,
          gracesUsed: 0,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when totalMatches is 5 and no graces used', () => {
        const enemy = createSneakyMouse();
        const stats = createRoundStats({
          totalMatches: 5,
          gracesUsed: 0,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when many matches and no graces used', () => {
        const enemy = createSneakyMouse();
        const stats = createRoundStats({
          totalMatches: 10,
          gracesUsed: 0,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true with extreme match count and no graces', () => {
        const enemy = createSneakyMouse();
        const stats = createRoundStats({
          totalMatches: 100,
          gracesUsed: 0,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('ignores other stats', () => {
      it('ignores invalidMatches count', () => {
        const enemy = createSneakyMouse();
        const stats = createRoundStats({
          totalMatches: 3,
          gracesUsed: 0,
          invalidMatches: 50,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores streak count', () => {
        const enemy = createSneakyMouse();
        const stats = createRoundStats({
          totalMatches: 3,
          gracesUsed: 0,
          currentStreak: 100,
          maxStreak: 100,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores hints used', () => {
        const enemy = createSneakyMouse();
        const stats = createRoundStats({
          totalMatches: 3,
          gracesUsed: 0,
          hintsUsed: 50,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores damage received', () => {
        const enemy = createSneakyMouse();
        const stats = createRoundStats({
          totalMatches: 3,
          gracesUsed: 0,
          damageReceived: 10,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores score values', () => {
        const enemy = createSneakyMouse();
        const stats = createRoundStats({
          totalMatches: 3,
          gracesUsed: 0,
          currentScore: 500,
          targetScore: 100,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores time remaining', () => {
        const enemy = createSneakyMouse();
        const stats = createRoundStats({
          totalMatches: 3,
          gracesUsed: 0,
          timeRemaining: 5,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores graces remaining', () => {
        const enemy = createSneakyMouse();
        const stats = createRoundStats({
          totalMatches: 3,
          gracesUsed: 0,
          gracesRemaining: 10,
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
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);

        const result = enemy.onRoundStart(board);

        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty events', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);

        const result = enemy.onRoundStart(board);

        expect(result.events).toEqual([]);
      });

      it('does not modify any cards on the board', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);
        const originalBoard = JSON.stringify(board);

        enemy.onRoundStart(board);

        expect(JSON.stringify(board)).toBe(originalBoard);
      });

      it('handles empty board', () => {
        const enemy = createSneakyMouse();
        const emptyBoard: ReturnType<typeof createCard>[] = [];

        const result = enemy.onRoundStart(emptyBoard);

        expect(result.cardModifications).toEqual([]);
        expect(result.events).toEqual([]);
      });

      it('handles large board', () => {
        const enemy = createSneakyMouse();
        const largeBoard = createTestBoard(100);

        const result = enemy.onRoundStart(largeBoard);

        expect(result.cardModifications).toEqual([]);
        expect(result.events).toEqual([]);
      });

      it('handles varied board', () => {
        const enemy = createSneakyMouse();
        const variedBoard = createVariedBoard();

        const result = enemy.onRoundStart(variedBoard);

        expect(result.cardModifications).toEqual([]);
        expect(result.events).toEqual([]);
      });
    });

    describe('onCardDraw', () => {
      it('returns the card unchanged', () => {
        const enemy = createSneakyMouse();
        const card = createCard({ shape: 'diamond', color: 'purple', number: 2 });

        const result = enemy.onCardDraw(card);

        expect(result).toEqual(card);
      });

      it('does not add isDud property', () => {
        const enemy = createSneakyMouse();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result.isDud).toBeUndefined();
      });

      it('does not add isFaceDown property', () => {
        const enemy = createSneakyMouse();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result.isFaceDown).toBeUndefined();
      });

      it('does not add hasBomb property', () => {
        const enemy = createSneakyMouse();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result.hasBomb).toBeUndefined();
      });

      it('does not add hasCountdown property', () => {
        const enemy = createSneakyMouse();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result.hasCountdown).toBeUndefined();
      });

      it('preserves card shape', () => {
        const enemy = createSneakyMouse();
        const card = createCard({ shape: 'squiggle' });

        const result = enemy.onCardDraw(card);

        expect(result.shape).toBe('squiggle');
      });

      it('preserves card color', () => {
        const enemy = createSneakyMouse();
        const card = createCard({ color: 'green' });

        const result = enemy.onCardDraw(card);

        expect(result.color).toBe('green');
      });

      it('preserves card number', () => {
        const enemy = createSneakyMouse();
        const card = createCard({ number: 3 });

        const result = enemy.onCardDraw(card);

        expect(result.number).toBe(3);
      });

      it('preserves card shading', () => {
        const enemy = createSneakyMouse();
        const card = createCard({ shading: 'striped' });

        const result = enemy.onCardDraw(card);

        expect(result.shading).toBe('striped');
      });

      it('consistently returns unchanged card on multiple draws', () => {
        const enemy = createSneakyMouse();

        for (let i = 0; i < 50; i++) {
          const card = createCard();
          const result = enemy.onCardDraw(card);
          expect(result).toEqual(card);
        }
      });
    });

    describe('onValidMatch', () => {
      it('returns pointsMultiplier of 1', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);
        const matchedCards = [board[0], board[1], board[2]];

        const result = enemy.onValidMatch(matchedCards, board);

        expect(result.pointsMultiplier).toBe(1);
      });

      it('returns timeDelta of 0', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);
        const matchedCards = [board[0], board[1], board[2]];

        const result = enemy.onValidMatch(matchedCards, board);

        expect(result.timeDelta).toBe(0);
      });

      it('returns empty cardsToRemove', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);
        const matchedCards = [board[0], board[1], board[2]];

        const result = enemy.onValidMatch(matchedCards, board);

        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty cardsToFlip', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);
        const matchedCards = [board[0], board[1], board[2]];

        const result = enemy.onValidMatch(matchedCards, board);

        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);
        const matchedCards = [board[0], board[1], board[2]];

        const result = enemy.onValidMatch(matchedCards, board);

        expect(result.events).toEqual([]);
      });

      it('handles empty matched cards array', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);

        const result = enemy.onValidMatch([], board);

        expect(result.pointsMultiplier).toBe(1);
        expect(result.timeDelta).toBe(0);
      });

      it('handles empty board', () => {
        const enemy = createSneakyMouse();
        const emptyBoard: ReturnType<typeof createCard>[] = [];
        const matchedCards = [createCard(), createCard(), createCard()];

        const result = enemy.onValidMatch(matchedCards, emptyBoard);

        expect(result.pointsMultiplier).toBe(1);
      });

      it('returns consistent result over multiple matches', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);
        const matchedCards = [board[0], board[1], board[2]];

        for (let i = 0; i < 10; i++) {
          const result = enemy.onValidMatch(matchedCards, board);
          expect(result.pointsMultiplier).toBe(1);
          expect(result.timeDelta).toBe(0);
        }
      });
    });

    describe('onInvalidMatch', () => {
      it('returns pointsMultiplier of 1', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);
        const invalidCards = [board[0], board[1], board[2]];

        const result = enemy.onInvalidMatch(invalidCards, board);

        expect(result.pointsMultiplier).toBe(1);
      });

      it('returns timeDelta of 0', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);
        const invalidCards = [board[0], board[1], board[2]];

        const result = enemy.onInvalidMatch(invalidCards, board);

        expect(result.timeDelta).toBe(0);
      });

      it('returns empty cardsToRemove', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);
        const invalidCards = [board[0], board[1], board[2]];

        const result = enemy.onInvalidMatch(invalidCards, board);

        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty cardsToFlip', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);
        const invalidCards = [board[0], board[1], board[2]];

        const result = enemy.onInvalidMatch(invalidCards, board);

        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);
        const invalidCards = [board[0], board[1], board[2]];

        const result = enemy.onInvalidMatch(invalidCards, board);

        expect(result.events).toEqual([]);
      });

      it('handles empty invalid cards array', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);

        const result = enemy.onInvalidMatch([], board);

        expect(result.pointsMultiplier).toBe(1);
      });

      it('handles empty board', () => {
        const enemy = createSneakyMouse();
        const emptyBoard: ReturnType<typeof createCard>[] = [];
        const invalidCards = [createCard(), createCard(), createCard()];

        const result = enemy.onInvalidMatch(invalidCards, emptyBoard);

        expect(result.pointsMultiplier).toBe(1);
      });
    });

    describe('onTick', () => {
      it('returns zero score delta', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.scoreDelta).toBe(0);
      });

      it('returns zero health delta', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.healthDelta).toBe(0);
      });

      it('returns zero time delta', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.timeDelta).toBe(0);
      });

      it('does not trigger instant death', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.instantDeath).toBe(false);
      });

      it('returns empty cardsToRemove', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty cardModifications', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty cardsToFlip', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.events).toEqual([]);
      });

      it('handles zero deltaMs', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);

        const result = enemy.onTick(0, board);

        expect(result.healthDelta).toBe(0);
        expect(result.instantDeath).toBe(false);
      });

      it('handles very large deltaMs', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);

        const result = enemy.onTick(60000, board);

        expect(result.healthDelta).toBe(0);
        expect(result.instantDeath).toBe(false);
      });

      it('handles empty board', () => {
        const enemy = createSneakyMouse();
        const emptyBoard: ReturnType<typeof createCard>[] = [];

        const result = enemy.onTick(100, emptyBoard);

        expect(result.healthDelta).toBe(0);
        expect(result.instantDeath).toBe(false);
      });

      it('remains consistent over many ticks', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);

        // Simulate 60 seconds of gameplay
        for (let i = 0; i < 600; i++) {
          const result = enemy.onTick(100, board);
          expect(result.healthDelta).toBe(0);
          expect(result.instantDeath).toBe(false);
        }
      });

      it('does not accumulate state over ticks', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);

        // First tick
        const result1 = enemy.onTick(1000, board);
        // Many more ticks
        for (let i = 0; i < 100; i++) {
          enemy.onTick(1000, board);
        }
        // Final tick
        const result2 = enemy.onTick(1000, board);

        expect(result1.healthDelta).toBe(result2.healthDelta);
        expect(result1.scoreDelta).toBe(result2.scoreDelta);
      });
    });

    describe('onRoundEnd', () => {
      it('executes without error', () => {
        const enemy = createSneakyMouse();

        expect(() => enemy.onRoundEnd()).not.toThrow();
      });

      it('can be called multiple times without issue', () => {
        const enemy = createSneakyMouse();

        expect(() => {
          enemy.onRoundEnd();
          enemy.onRoundEnd();
          enemy.onRoundEnd();
        }).not.toThrow();
      });

      it('can be called after round start', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);

        enemy.onRoundStart(board);
        expect(() => enemy.onRoundEnd()).not.toThrow();
      });

      it('can be called after matches', () => {
        const enemy = createSneakyMouse();
        const board = createTestBoard(12);

        enemy.onRoundStart(board);
        enemy.onValidMatch([board[0], board[1], board[2]], board);
        enemy.onInvalidMatch([board[3], board[4], board[5]], board);
        expect(() => enemy.onRoundEnd()).not.toThrow();
      });
    });
  });

  // ==========================================================================
  // UI MODIFIERS TESTS
  // ==========================================================================
  describe('UI modifiers', () => {
    it('returns weapon counters array', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getUIModifiers();

      expect(modifiers.weaponCounters).toBeDefined();
      expect(Array.isArray(modifiers.weaponCounters)).toBe(true);
    });

    it('does not show inactivity bar', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showInactivityBar).toBeUndefined();
    });

    it('does not show score decay', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showScoreDecay).toBeUndefined();
    });

    it('does not modify timer speed', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getUIModifiers();

      expect(modifiers.timerSpeedMultiplier).toBeUndefined();
    });

    it('does not disable auto hints', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getUIModifiers();

      expect(modifiers.disableAutoHint).toBeUndefined();
    });

    it('does not disable manual hints', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getUIModifiers();

      expect(modifiers.disableManualHint).toBeUndefined();
    });

    it('does not show countdown cards', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showCountdownCards).toBeUndefined();
    });

    it('does not show bomb cards', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showBombCards).toBeUndefined();
    });

    it('UI modifiers remain consistent after gameplay', () => {
      const enemy = createSneakyMouse();
      const board = createTestBoard(12);

      const modifiersBefore = enemy.getUIModifiers();
      enemy.onRoundStart(board);
      enemy.onValidMatch([board[0], board[1], board[2]], board);
      enemy.onTick(1000, board);
      const modifiersAfter = enemy.getUIModifiers();

      expect(modifiersBefore.weaponCounters).toEqual(modifiersAfter.weaponCounters);
    });
  });

  // ==========================================================================
  // STAT MODIFIERS TESTS
  // ==========================================================================
  describe('stat modifiers', () => {
    it('returns graceGainChanceReduction', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getStatModifiers();

      expect(modifiers.graceGainChanceReduction).toBeDefined();
    });

    it('graceGainChanceReduction is exactly 15', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getStatModifiers();

      expect(modifiers.graceGainChanceReduction).toBe(15);
    });

    it('does not reduce fire spread chance', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getStatModifiers();

      expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
    });

    it('does not reduce explosion chance', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getStatModifiers();

      expect(modifiers.explosionChanceReduction).toBeUndefined();
    });

    it('does not reduce laser chance', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getStatModifiers();

      expect(modifiers.laserChanceReduction).toBeUndefined();
    });

    it('does not reduce hint gain chance', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getStatModifiers();

      expect(modifiers.hintGainChanceReduction).toBeUndefined();
    });

    it('does not reduce time gain chance', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getStatModifiers();

      expect(modifiers.timeGainChanceReduction).toBeUndefined();
    });

    it('does not reduce healing chance', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getStatModifiers();

      expect(modifiers.healingChanceReduction).toBeUndefined();
    });
  });

  // ==========================================================================
  // INTEGRATION / EDGE CASE TESTS
  // ==========================================================================
  describe('edge cases', () => {
    it('creates fresh instances each time', () => {
      const enemy1 = createSneakyMouse();
      const enemy2 = createSneakyMouse();

      // Modify enemy1 state
      enemy1.onRoundStart(createTestBoard(12));
      enemy1.onValidMatch([], []);

      // enemy2 should be independent
      expect(enemy2.name).toBe('Sneaky Mouse');
      expect(enemy2.tier).toBe(1);
    });

    it('maintains state across round restart', () => {
      const enemy = createSneakyMouse();
      const board = createTestBoard(12);

      // First round
      enemy.onRoundStart(board);
      enemy.onValidMatch([board[0], board[1], board[2]], board);
      enemy.onRoundEnd();

      // Second round
      enemy.onRoundStart(board);
      const result = enemy.onValidMatch([board[0], board[1], board[2]], board);

      expect(result.pointsMultiplier).toBe(1);
    });

    it('handles board with face-down cards', () => {
      const enemy = createSneakyMouse();
      const board = [
        createFaceDownCard(),
        createFaceDownCard(),
        createCard(),
        ...createTestBoard(9),
      ];

      const result = enemy.onRoundStart(board);

      expect(result.cardModifications).toEqual([]);
    });

    it('handles board with triple cards', () => {
      const enemy = createSneakyMouse();
      const board = [
        createTripleCard(),
        createTripleCard(),
        createCard(),
        ...createTestBoard(9),
      ];

      const result = enemy.onRoundStart(board);

      expect(result.cardModifications).toEqual([]);
    });

    it('handles matching triple cards', () => {
      const enemy = createSneakyMouse();
      const tripleCards = [createTripleCard(), createTripleCard(), createTripleCard()];
      const board = [...tripleCards, ...createTestBoard(9)];

      const result = enemy.onValidMatch(tripleCards, board);

      expect(result.pointsMultiplier).toBe(1);
    });

    it('handles matching face-down cards', () => {
      const enemy = createSneakyMouse();
      const faceDownCards = [
        createFaceDownCard(),
        createFaceDownCard(),
        createFaceDownCard(),
      ];
      const board = [...faceDownCards, ...createTestBoard(9)];

      const result = enemy.onValidMatch(faceDownCards, board);

      expect(result.pointsMultiplier).toBe(1);
    });
  });

  // ==========================================================================
  // GAMEPLAY SCENARIO TESTS
  // ==========================================================================
  describe('gameplay scenarios', () => {
    it('defeat condition met: player completes round without using grace', () => {
      const enemy = createSneakyMouse();
      const board = createTestBoard(12);

      enemy.onRoundStart(board);

      // Simulate multiple valid matches without using graces
      for (let i = 0; i < 5; i++) {
        enemy.onValidMatch([board[0], board[1], board[2]], board);
      }

      const stats = createRoundStats({
        totalMatches: 5,
        gracesUsed: 0,
      });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('defeat condition not met: player uses a grace', () => {
      const enemy = createSneakyMouse();
      const board = createTestBoard(12);

      enemy.onRoundStart(board);

      // Simulate matches including one that used a grace
      for (let i = 0; i < 5; i++) {
        enemy.onValidMatch([board[0], board[1], board[2]], board);
      }

      const stats = createRoundStats({
        totalMatches: 5,
        gracesUsed: 1, // Used one grace
      });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('defeat condition not met: no matches made yet', () => {
      const enemy = createSneakyMouse();
      const board = createTestBoard(12);

      enemy.onRoundStart(board);

      // No matches, no graces - should still be false
      const stats = createRoundStats({
        totalMatches: 0,
        gracesUsed: 0,
      });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('full round simulation with weapon counter active', () => {
      const enemy = createSneakyMouse();
      const board = createTestBoard(12);

      // Round start
      const startResult = enemy.onRoundStart(board);
      expect(startResult.cardModifications).toEqual([]);

      // Verify weapon counter is active
      const statMods = enemy.getStatModifiers();
      expect(statMods.graceGainChanceReduction).toBe(15);

      // Multiple matches
      for (let i = 0; i < 10; i++) {
        const matchResult = enemy.onValidMatch([board[0], board[1], board[2]], board);
        expect(matchResult.pointsMultiplier).toBe(1);
      }

      // Weapon counter should still be active
      const statModsAfter = enemy.getStatModifiers();
      expect(statModsAfter.graceGainChanceReduction).toBe(15);

      // Round end
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('simulates 60 seconds of gameplay with no penalties', () => {
      const enemy = createSneakyMouse();
      const board = createTestBoard(12);

      enemy.onRoundStart(board);

      // Simulate 60 seconds in 100ms intervals
      for (let i = 0; i < 600; i++) {
        const tickResult = enemy.onTick(100, board);
        expect(tickResult.healthDelta).toBe(0);
        expect(tickResult.scoreDelta).toBe(0);
        expect(tickResult.instantDeath).toBe(false);
      }
    });
  });

  // ==========================================================================
  // MULTIPLE INSTANCE TESTS
  // ==========================================================================
  describe('multiple instances', () => {
    it('different instances are independent', () => {
      const enemy1 = createSneakyMouse();
      const enemy2 = createSneakyMouse();

      expect(enemy1).not.toBe(enemy2);
      expect(enemy1.name).toBe(enemy2.name);
    });

    it('modifying one instance does not affect another', () => {
      const enemy1 = createSneakyMouse();
      const enemy2 = createSneakyMouse();
      const board = createTestBoard(12);

      // Use enemy1 extensively
      enemy1.onRoundStart(board);
      for (let i = 0; i < 100; i++) {
        enemy1.onTick(100, board);
        enemy1.onValidMatch([board[0], board[1], board[2]], board);
      }
      enemy1.onRoundEnd();

      // enemy2 should be in fresh state
      const result = enemy2.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });
  });
});
