/**
 * Comprehensive Unit Tests for Foggy Frog Enemy
 *
 * Foggy Frog is a Tier 1 enemy with:
 * - Effect: Hint gain reduced by 15% (WeaponCounterEffect)
 * - Defeat Condition: Beat target score with 2+ hints remaining
 */

import { createFoggyFrog } from '@/utils/enemies/tier1/foggyFrog';
import { createRoundStats, createCard, createTestBoard, resetCardIdCounter, createFaceDownCard, createTripleCard, createVariedBoard } from '../../testUtils';

beforeEach(() => {
  resetCardIdCounter();
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Foggy Frog', () => {
  // ==========================================================================
  // METADATA TESTS
  // ==========================================================================
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createFoggyFrog();
      expect(enemy.name).toBe('Foggy Frog');
    });

    it('has tier 1', () => {
      const enemy = createFoggyFrog();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon', () => {
      const enemy = createFoggyFrog();
      expect(enemy.icon).toBe('lorc/frog');
    });

    it('has description containing hint reduction info', () => {
      const enemy = createFoggyFrog();
      expect(enemy.description).toContain('Hint');
    });

    it('has description mentioning divided by 3', () => {
      const enemy = createFoggyFrog();
      expect(enemy.description).toContain('divided by 3');
    });

    it('has defeat condition text mentioning target score', () => {
      const enemy = createFoggyFrog();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('target');
    });

    it('has defeat condition text mentioning hints remaining', () => {
      const enemy = createFoggyFrog();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('hint');
    });

    it('has defeat condition text mentioning 2+ hints', () => {
      const enemy = createFoggyFrog();
      expect(enemy.defeatConditionText).toContain('2+');
    });

    it('is consistent across multiple instances', () => {
      const enemy1 = createFoggyFrog();
      const enemy2 = createFoggyFrog();

      expect(enemy1.name).toBe(enemy2.name);
      expect(enemy1.tier).toBe(enemy2.tier);
      expect(enemy1.icon).toBe(enemy2.icon);
      expect(enemy1.description).toBe(enemy2.description);
      expect(enemy1.defeatConditionText).toBe(enemy2.defeatConditionText);
    });
  });

  // ==========================================================================
  // WEAPON COUNTER EFFECT TESTS
  // ==========================================================================
  describe('weapon counter effect', () => {
    it('returns hint gain chance reduction of exactly 15 in stat modifiers', () => {
      const enemy = createFoggyFrog();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.hintGainChanceReduction).toBe(15);
    });

    it('shows weapon counter in UI modifiers', () => {
      const enemy = createFoggyFrog();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters).toContainEqual({
        type: 'hint',
        reduction: 15,
      });
    });

    it('weapon counter array has exactly one entry', () => {
      const enemy = createFoggyFrog();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters).toHaveLength(1);
    });

    it('does not affect fire spread chance', () => {
      const enemy = createFoggyFrog();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
    });

    it('does not affect explosion chance', () => {
      const enemy = createFoggyFrog();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.explosionChanceReduction).toBeUndefined();
    });

    it('does not affect laser chance', () => {
      const enemy = createFoggyFrog();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.laserChanceReduction).toBeUndefined();
    });

    it('does not affect grace gain chance', () => {
      const enemy = createFoggyFrog();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.graceGainChanceReduction).toBeUndefined();
    });

    it('does not affect time gain chance', () => {
      const enemy = createFoggyFrog();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.timeGainChanceReduction).toBeUndefined();
    });

    it('does not affect healing chance', () => {
      const enemy = createFoggyFrog();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.healingChanceReduction).toBeUndefined();
    });

    it('does not modify damage multiplier', () => {
      const enemy = createFoggyFrog();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.damageMultiplier).toBeUndefined();
    });

    it('does not modify points multiplier', () => {
      const enemy = createFoggyFrog();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.pointsMultiplier).toBeUndefined();
    });

    it('stat modifiers are consistent across multiple calls', () => {
      const enemy = createFoggyFrog();

      const modifiers1 = enemy.getStatModifiers();
      const modifiers2 = enemy.getStatModifiers();
      const modifiers3 = enemy.getStatModifiers();

      expect(modifiers1.hintGainChanceReduction).toBe(modifiers2.hintGainChanceReduction);
      expect(modifiers2.hintGainChanceReduction).toBe(modifiers3.hintGainChanceReduction);
    });

    it('UI modifiers are consistent across multiple calls', () => {
      const enemy = createFoggyFrog();

      const modifiers1 = enemy.getUIModifiers();
      const modifiers2 = enemy.getUIModifiers();

      expect(modifiers1.weaponCounters).toEqual(modifiers2.weaponCounters);
    });
  });

  // ==========================================================================
  // DEFEAT CONDITION TESTS
  // ==========================================================================
  describe('defeat condition', () => {
    describe('score requirements', () => {
      it('returns false when currentScore is 0', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 0,
          targetScore: 100,
          hintsRemaining: 5,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when currentScore is 1 (far below target)', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 1,
          targetScore: 100,
          hintsRemaining: 5,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when currentScore is 50 (halfway to target)', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 50,
          targetScore: 100,
          hintsRemaining: 5,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when currentScore is 99 (one below target)', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 99,
          targetScore: 100,
          hintsRemaining: 5,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true when currentScore exactly equals target', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 100,
          targetScore: 100,
          hintsRemaining: 2,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when currentScore exceeds target by 1', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 101,
          targetScore: 100,
          hintsRemaining: 2,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when currentScore is well above target', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 500,
          targetScore: 100,
          hintsRemaining: 2,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('handles high target scores correctly', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 1000,
          targetScore: 1000,
          hintsRemaining: 3,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('hints remaining requirements', () => {
      it('returns false when hintsRemaining is 0', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 100,
          targetScore: 100,
          hintsRemaining: 0,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when hintsRemaining is 1 (threshold - 1)', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 100,
          targetScore: 100,
          hintsRemaining: 1,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true when hintsRemaining is exactly 2 (threshold)', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 100,
          targetScore: 100,
          hintsRemaining: 2,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when hintsRemaining is 3 (above threshold)', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 100,
          targetScore: 100,
          hintsRemaining: 3,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when hintsRemaining is 5 (well above threshold)', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 100,
          targetScore: 100,
          hintsRemaining: 5,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when hintsRemaining is 10 (high value)', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 100,
          targetScore: 100,
          hintsRemaining: 10,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('combined conditions', () => {
      it('returns false when both conditions fail (low score, low hints)', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 50,
          targetScore: 100,
          hintsRemaining: 1,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when score meets target but hints are 0', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 100,
          targetScore: 100,
          hintsRemaining: 0,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when hints are sufficient but score is below target', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 50,
          targetScore: 100,
          hintsRemaining: 5,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true when both conditions are exactly met', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 100,
          targetScore: 100,
          hintsRemaining: 2,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when both conditions are exceeded', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 200,
          targetScore: 100,
          hintsRemaining: 10,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('ignores irrelevant stats', () => {
      it('ignores totalMatches', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 100,
          targetScore: 100,
          hintsRemaining: 2,
          totalMatches: 100,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores invalidMatches', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 100,
          targetScore: 100,
          hintsRemaining: 2,
          invalidMatches: 50,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores gracesUsed', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 100,
          targetScore: 100,
          hintsRemaining: 2,
          gracesUsed: 10,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores hintsUsed', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 100,
          targetScore: 100,
          hintsRemaining: 2,
          hintsUsed: 100,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores timeRemaining', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 100,
          targetScore: 100,
          hintsRemaining: 2,
          timeRemaining: 1,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores damageReceived', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 100,
          targetScore: 100,
          hintsRemaining: 2,
          damageReceived: 100,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores currentStreak and maxStreak', () => {
        const enemy = createFoggyFrog();
        const stats = createRoundStats({
          currentScore: 100,
          targetScore: 100,
          hintsRemaining: 2,
          currentStreak: 0,
          maxStreak: 0,
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
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);

        const result = enemy.onRoundStart(board);

        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty events', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);

        const result = enemy.onRoundStart(board);

        expect(result.events).toEqual([]);
      });

      it('does not modify any cards on the board', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);
        const originalBoard = JSON.stringify(board);

        enemy.onRoundStart(board);

        expect(JSON.stringify(board)).toBe(originalBoard);
      });

      it('handles empty board', () => {
        const enemy = createFoggyFrog();
        const emptyBoard: ReturnType<typeof createCard>[] = [];

        const result = enemy.onRoundStart(emptyBoard);

        expect(result.cardModifications).toEqual([]);
        expect(result.events).toEqual([]);
      });

      it('handles large board', () => {
        const enemy = createFoggyFrog();
        const largeBoard = createTestBoard(50);

        const result = enemy.onRoundStart(largeBoard);

        expect(result.cardModifications).toEqual([]);
        expect(result.events).toEqual([]);
      });

      it('handles board with special cards (face-down)', () => {
        const enemy = createFoggyFrog();
        const board = [createFaceDownCard(), createFaceDownCard(), ...createTestBoard(10)];

        const result = enemy.onRoundStart(board);

        expect(result.cardModifications).toEqual([]);
      });

      it('handles board with triple cards', () => {
        const enemy = createFoggyFrog();
        const board = [createTripleCard(), createTripleCard(), ...createTestBoard(10)];

        const result = enemy.onRoundStart(board);

        expect(result.cardModifications).toEqual([]);
      });
    });

    describe('onCardDraw', () => {
      it('returns the card unchanged', () => {
        const enemy = createFoggyFrog();
        const card = createCard({ shape: 'diamond', color: 'purple', number: 2 });

        const result = enemy.onCardDraw(card);

        expect(result).toEqual(card);
      });

      it('preserves card id', () => {
        const enemy = createFoggyFrog();
        const card = createCard({ id: 'specific-id' });

        const result = enemy.onCardDraw(card);

        expect(result.id).toBe('specific-id');
      });

      it('preserves card shape', () => {
        const enemy = createFoggyFrog();
        const card = createCard({ shape: 'squiggle' });

        const result = enemy.onCardDraw(card);

        expect(result.shape).toBe('squiggle');
      });

      it('preserves card color', () => {
        const enemy = createFoggyFrog();
        const card = createCard({ color: 'green' });

        const result = enemy.onCardDraw(card);

        expect(result.color).toBe('green');
      });

      it('preserves card number', () => {
        const enemy = createFoggyFrog();
        const card = createCard({ number: 3 });

        const result = enemy.onCardDraw(card);

        expect(result.number).toBe(3);
      });

      it('preserves card shading', () => {
        const enemy = createFoggyFrog();
        const card = createCard({ shading: 'striped' });

        const result = enemy.onCardDraw(card);

        expect(result.shading).toBe('striped');
      });

      it('does not add isDud property', () => {
        const enemy = createFoggyFrog();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result.isDud).toBeUndefined();
      });

      it('does not add isFaceDown property', () => {
        const enemy = createFoggyFrog();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result.isFaceDown).toBeUndefined();
      });

      it('does not add hasBomb property', () => {
        const enemy = createFoggyFrog();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result.hasBomb).toBeUndefined();
      });

      it('does not add hasCountdown property', () => {
        const enemy = createFoggyFrog();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result.hasCountdown).toBeUndefined();
      });

      it('does not add health property', () => {
        const enemy = createFoggyFrog();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result.health).toBeUndefined();
      });

      it('does not modify onFire property', () => {
        const enemy = createFoggyFrog();
        const card = createCard({ onFire: true });

        const result = enemy.onCardDraw(card);

        expect(result.onFire).toBe(true);
      });
    });

    describe('onValidMatch', () => {
      it('returns pointsMultiplier of 1 (no modification)', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);
        const matchedCards = [board[0], board[1], board[2]];

        const result = enemy.onValidMatch(matchedCards, board);

        expect(result.pointsMultiplier).toBe(1);
      });

      it('returns timeDelta of 0 (no time steal)', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);
        const matchedCards = [board[0], board[1], board[2]];

        const result = enemy.onValidMatch(matchedCards, board);

        expect(result.timeDelta).toBe(0);
      });

      it('returns empty cardsToRemove array', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);
        const matchedCards = [board[0], board[1], board[2]];

        const result = enemy.onValidMatch(matchedCards, board);

        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty cardsToFlip array', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);
        const matchedCards = [board[0], board[1], board[2]];

        const result = enemy.onValidMatch(matchedCards, board);

        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events array', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);
        const matchedCards = [board[0], board[1], board[2]];

        const result = enemy.onValidMatch(matchedCards, board);

        expect(result.events).toEqual([]);
      });

      it('handles empty board', () => {
        const enemy = createFoggyFrog();
        const emptyBoard: ReturnType<typeof createCard>[] = [];
        const matchedCards = [createCard(), createCard(), createCard()];

        const result = enemy.onValidMatch(matchedCards, emptyBoard);

        expect(result.pointsMultiplier).toBe(1);
        expect(result.timeDelta).toBe(0);
      });

      it('handles empty matched cards array', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);

        const result = enemy.onValidMatch([], board);

        expect(result.pointsMultiplier).toBe(1);
        expect(result.timeDelta).toBe(0);
      });

      it('is consistent across multiple valid matches', () => {
        const enemy = createFoggyFrog();
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
      it('returns pointsMultiplier of 1 (no modification)', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);
        const invalidCards = [board[0], board[1], board[2]];

        const result = enemy.onInvalidMatch(invalidCards, board);

        expect(result.pointsMultiplier).toBe(1);
      });

      it('returns timeDelta of 0', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);
        const invalidCards = [board[0], board[1], board[2]];

        const result = enemy.onInvalidMatch(invalidCards, board);

        expect(result.timeDelta).toBe(0);
      });

      it('returns empty cardsToRemove array', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);
        const invalidCards = [board[0], board[1], board[2]];

        const result = enemy.onInvalidMatch(invalidCards, board);

        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty cardsToFlip array', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);
        const invalidCards = [board[0], board[1], board[2]];

        const result = enemy.onInvalidMatch(invalidCards, board);

        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events array', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);
        const invalidCards = [board[0], board[1], board[2]];

        const result = enemy.onInvalidMatch(invalidCards, board);

        expect(result.events).toEqual([]);
      });

      it('handles empty board', () => {
        const enemy = createFoggyFrog();
        const emptyBoard: ReturnType<typeof createCard>[] = [];
        const invalidCards = [createCard(), createCard(), createCard()];

        const result = enemy.onInvalidMatch(invalidCards, emptyBoard);

        expect(result.pointsMultiplier).toBe(1);
      });

      it('handles empty invalid cards array', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);

        const result = enemy.onInvalidMatch([], board);

        expect(result.pointsMultiplier).toBe(1);
      });
    });

    describe('onTick', () => {
      it('returns zero score delta', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.scoreDelta).toBe(0);
      });

      it('returns zero health delta', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.healthDelta).toBe(0);
      });

      it('returns zero time delta', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.timeDelta).toBe(0);
      });

      it('does not trigger instant death', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.instantDeath).toBe(false);
      });

      it('returns empty cardsToRemove array', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty cardModifications array', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty cardsToFlip array', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events array', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.events).toEqual([]);
      });

      it('handles zero deltaMs', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);

        const result = enemy.onTick(0, board);

        expect(result.healthDelta).toBe(0);
        expect(result.instantDeath).toBe(false);
      });

      it('handles small deltaMs', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);

        const result = enemy.onTick(16, board); // ~60fps

        expect(result.healthDelta).toBe(0);
        expect(result.instantDeath).toBe(false);
      });

      it('handles large deltaMs', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);

        const result = enemy.onTick(5000, board);

        expect(result.healthDelta).toBe(0);
        expect(result.instantDeath).toBe(false);
      });

      it('handles very large deltaMs', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);

        const result = enemy.onTick(60000, board);

        expect(result.healthDelta).toBe(0);
        expect(result.instantDeath).toBe(false);
      });

      it('remains consistent over many ticks', () => {
        const enemy = createFoggyFrog();
        const board = createTestBoard(12);

        // Simulate 60 seconds of gameplay
        for (let i = 0; i < 600; i++) {
          const result = enemy.onTick(100, board);
          expect(result.healthDelta).toBe(0);
          expect(result.instantDeath).toBe(false);
          expect(result.scoreDelta).toBe(0);
        }
      });

      it('handles empty board', () => {
        const enemy = createFoggyFrog();
        const emptyBoard: ReturnType<typeof createCard>[] = [];

        const result = enemy.onTick(100, emptyBoard);

        expect(result.healthDelta).toBe(0);
        expect(result.instantDeath).toBe(false);
      });
    });

    describe('onRoundEnd', () => {
      it('executes without error', () => {
        const enemy = createFoggyFrog();

        expect(() => enemy.onRoundEnd()).not.toThrow();
      });

      it('can be called multiple times without issue', () => {
        const enemy = createFoggyFrog();

        expect(() => {
          enemy.onRoundEnd();
          enemy.onRoundEnd();
          enemy.onRoundEnd();
        }).not.toThrow();
      });

      it('can be called without onRoundStart', () => {
        const enemy = createFoggyFrog();

        expect(() => enemy.onRoundEnd()).not.toThrow();
      });
    });
  });

  // ==========================================================================
  // UI MODIFIERS TESTS
  // ==========================================================================
  describe('UI modifiers', () => {
    it('does not show inactivity bar', () => {
      const enemy = createFoggyFrog();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showInactivityBar).toBeUndefined();
    });

    it('does not show score decay', () => {
      const enemy = createFoggyFrog();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showScoreDecay).toBeUndefined();
    });

    it('does not modify timer speed', () => {
      const enemy = createFoggyFrog();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.timerSpeedMultiplier).toBeUndefined();
    });

    it('does not disable auto hint', () => {
      const enemy = createFoggyFrog();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.disableAutoHint).toBeUndefined();
    });

    it('does not disable manual hint', () => {
      const enemy = createFoggyFrog();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.disableManualHint).toBeUndefined();
    });

    it('does not show countdown cards', () => {
      const enemy = createFoggyFrog();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showCountdownCards).toBeUndefined();
    });

    it('does not show bomb cards', () => {
      const enemy = createFoggyFrog();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showBombCards).toBeUndefined();
    });

    it('only has weaponCounters property set', () => {
      const enemy = createFoggyFrog();

      const modifiers = enemy.getUIModifiers();

      // Should only have weaponCounters, nothing else
      const keys = Object.keys(modifiers);
      expect(keys).toContain('weaponCounters');
      expect(keys.length).toBe(1);
    });
  });

  // ==========================================================================
  // EDGE CASES AND INTEGRATION TESTS
  // ==========================================================================
  describe('edge cases', () => {
    it('creates fresh instances each time', () => {
      const enemy1 = createFoggyFrog();
      const enemy2 = createFoggyFrog();

      // Modify enemy1 state by running lifecycle
      enemy1.onRoundStart(createTestBoard(12));
      enemy1.onValidMatch([], []);

      // enemy2 should be independent
      expect(enemy2.name).toBe('Foggy Frog');
      expect(enemy2.tier).toBe(1);
    });

    it('maintains state across round restart', () => {
      const enemy = createFoggyFrog();
      const board = createTestBoard(12);

      // First round
      enemy.onRoundStart(board);
      const result1 = enemy.onValidMatch([board[0], board[1], board[2]], board);
      enemy.onRoundEnd();

      // Second round
      enemy.onRoundStart(board);
      const result2 = enemy.onValidMatch([board[0], board[1], board[2]], board);

      // Should behave consistently
      expect(result1.pointsMultiplier).toBe(result2.pointsMultiplier);
      expect(result1.timeDelta).toBe(result2.timeDelta);
    });

    it('handles board with varied cards', () => {
      const enemy = createFoggyFrog();
      const variedBoard = createVariedBoard();

      const result = enemy.onRoundStart(variedBoard);

      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('handles cards with all possible attributes', () => {
      const enemy = createFoggyFrog();
      const cards = [
        createCard({ shape: 'oval', color: 'red', number: 1, shading: 'solid' }),
        createCard({ shape: 'squiggle', color: 'green', number: 2, shading: 'striped' }),
        createCard({ shape: 'diamond', color: 'purple', number: 3, shading: 'open' }),
      ];

      const result = enemy.onValidMatch(cards, cards);

      expect(result.pointsMultiplier).toBe(1);
      expect(result.timeDelta).toBe(0);
    });

    it('stat modifiers remain constant throughout round', () => {
      const enemy = createFoggyFrog();
      const board = createTestBoard(12);

      // Before round start
      const modifiers1 = enemy.getStatModifiers();

      // After round start
      enemy.onRoundStart(board);
      const modifiers2 = enemy.getStatModifiers();

      // After some matches
      enemy.onValidMatch([board[0], board[1], board[2]], board);
      const modifiers3 = enemy.getStatModifiers();

      // After round end
      enemy.onRoundEnd();
      const modifiers4 = enemy.getStatModifiers();

      expect(modifiers1.hintGainChanceReduction).toBe(15);
      expect(modifiers2.hintGainChanceReduction).toBe(15);
      expect(modifiers3.hintGainChanceReduction).toBe(15);
      expect(modifiers4.hintGainChanceReduction).toBe(15);
    });

    it('UI modifiers remain constant throughout round', () => {
      const enemy = createFoggyFrog();
      const board = createTestBoard(12);

      // Before round start
      const modifiers1 = enemy.getUIModifiers();

      // After round start
      enemy.onRoundStart(board);
      const modifiers2 = enemy.getUIModifiers();

      // After some ticks
      enemy.onTick(5000, board);
      const modifiers3 = enemy.getUIModifiers();

      expect(modifiers1.weaponCounters).toEqual(modifiers2.weaponCounters);
      expect(modifiers2.weaponCounters).toEqual(modifiers3.weaponCounters);
    });
  });

  // ==========================================================================
  // FULL LIFECYCLE SIMULATION
  // ==========================================================================
  describe('full lifecycle simulation', () => {
    it('completes a full round without errors', () => {
      const enemy = createFoggyFrog();
      const board = createTestBoard(12);

      expect(() => {
        // Round start
        enemy.onRoundStart(board);

        // Simulate gameplay
        for (let tick = 0; tick < 100; tick++) {
          enemy.onTick(100, board);

          if (tick % 10 === 0) {
            enemy.onValidMatch([board[0], board[1], board[2]], board);
          }
        }

        // Round end
        enemy.onRoundEnd();
      }).not.toThrow();
    });

    it('correctly evaluates defeat condition during simulated gameplay', () => {
      const enemy = createFoggyFrog();
      const board = createTestBoard(12);

      enemy.onRoundStart(board);

      // Simulate gameplay with increasing score
      let score = 0;
      const hints = 3;

      // Not defeated at low score
      score = 50;
      let stats = createRoundStats({ currentScore: score, targetScore: 100, hintsRemaining: hints });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);

      // Still not defeated just below target
      score = 99;
      stats = createRoundStats({ currentScore: score, targetScore: 100, hintsRemaining: hints });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);

      // Defeated when reaching target with hints
      score = 100;
      stats = createRoundStats({ currentScore: score, targetScore: 100, hintsRemaining: hints });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);

      enemy.onRoundEnd();
    });

    it('correctly fails defeat condition when hints are depleted', () => {
      const enemy = createFoggyFrog();
      const board = createTestBoard(12);

      enemy.onRoundStart(board);

      // High score but no hints
      const stats = createRoundStats({
        currentScore: 200,
        targetScore: 100,
        hintsRemaining: 0,
      });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);

      enemy.onRoundEnd();
    });
  });
});
