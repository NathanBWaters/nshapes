/**
 * Comprehensive Unit Tests for Stinging Scorpion enemy.
 *
 * Stinging Scorpion - Tier 1 Enemy
 * Effect: 2x damage taken, 2x points earned
 * Defeat Condition: Make no invalid matches (must have at least 1 valid match)
 */
import type { Card } from '@/types';
import { createStingingScorpion } from '@/utils/enemies/tier1/stingingScorpion';
import {
  createRoundStats,
  createCard,
  createTestBoard,
  resetCardIdCounter,
  createFaceDownCard,
  createTripleCard,
  createVariedBoard,
} from '../../testUtils';

beforeEach(() => {
  resetCardIdCounter();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Stinging Scorpion', () => {
  // ==========================================================================
  // METADATA TESTS
  // ==========================================================================
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createStingingScorpion();
      expect(enemy.name).toBe('Stinging Scorpion');
    });

    it('has correct tier (1)', () => {
      const enemy = createStingingScorpion();
      expect(enemy.tier).toBe(1);
    });

    it('has scorpion icon', () => {
      const enemy = createStingingScorpion();
      expect(enemy.icon).toBe('lorc/scorpion');
    });

    it('has description containing damage keyword', () => {
      const enemy = createStingingScorpion();
      expect(enemy.description.toLowerCase()).toContain('damage');
    });

    it('has description containing points keyword', () => {
      const enemy = createStingingScorpion();
      expect(enemy.description.toLowerCase()).toContain('points');
    });

    it('has description containing 2x modifier', () => {
      const enemy = createStingingScorpion();
      expect(enemy.description).toContain('2x');
    });

    it('has defeatConditionText containing invalid keyword', () => {
      const enemy = createStingingScorpion();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('invalid');
    });

    it('has defeatConditionText containing match keyword', () => {
      const enemy = createStingingScorpion();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('match');
    });

    it('description mentions both damage and points effects', () => {
      const enemy = createStingingScorpion();
      expect(enemy.description).toMatch(/2x.*damage.*2x.*points|2x.*points.*2x.*damage/i);
    });

    it('creates unique instances each time', () => {
      const enemy1 = createStingingScorpion();
      const enemy2 = createStingingScorpion();
      expect(enemy1).not.toBe(enemy2);
    });
  });

  // ==========================================================================
  // DAMAGE MULTIPLIER EFFECT TESTS
  // ==========================================================================
  describe('damage multiplier effect', () => {
    it('returns 2x damage multiplier in stat modifiers', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.damageMultiplier).toBe(2.0);
    });

    it('damage multiplier is exactly 2.0 (not 2 or "2")', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.damageMultiplier).toStrictEqual(2.0);
    });

    it('damage multiplier persists across multiple getStatModifiers calls', () => {
      const enemy = createStingingScorpion();
      const modifiers1 = enemy.getStatModifiers();
      const modifiers2 = enemy.getStatModifiers();
      const modifiers3 = enemy.getStatModifiers();
      expect(modifiers1.damageMultiplier).toBe(2.0);
      expect(modifiers2.damageMultiplier).toBe(2.0);
      expect(modifiers3.damageMultiplier).toBe(2.0);
    });

    it('damage multiplier is consistent after round start', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.damageMultiplier).toBe(2.0);
    });

    it('damage multiplier is consistent after valid match', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);
      const matchedCards = [createCard(), createCard(), createCard()];
      enemy.onValidMatch(matchedCards, board);
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.damageMultiplier).toBe(2.0);
    });

    it('damage multiplier is consistent after invalid match', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);
      const invalidCards = [createCard(), createCard(), createCard()];
      enemy.onInvalidMatch(invalidCards, board);
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.damageMultiplier).toBe(2.0);
    });
  });

  // ==========================================================================
  // POINTS MULTIPLIER EFFECT TESTS
  // ==========================================================================
  describe('points multiplier effect', () => {
    it('returns 2x points multiplier on valid match', () => {
      const enemy = createStingingScorpion();
      const result = enemy.onValidMatch([], []);
      expect(result.pointsMultiplier).toBe(2.0);
    });

    it('returns 2x points multiplier in stat modifiers', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.pointsMultiplier).toBe(2.0);
    });

    it('points multiplier is exactly 2.0 (not 2 or "2")', () => {
      const enemy = createStingingScorpion();
      const result = enemy.onValidMatch([], []);
      expect(result.pointsMultiplier).toStrictEqual(2.0);
    });

    it('points multiplier persists across multiple valid matches', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);
      const matchedCards = [createCard(), createCard(), createCard()];

      const result1 = enemy.onValidMatch(matchedCards, board);
      const result2 = enemy.onValidMatch(matchedCards, board);
      const result3 = enemy.onValidMatch(matchedCards, board);

      expect(result1.pointsMultiplier).toBe(2.0);
      expect(result2.pointsMultiplier).toBe(2.0);
      expect(result3.pointsMultiplier).toBe(2.0);
    });

    it('points multiplier is consistent after round start', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);
      const result = enemy.onValidMatch([], board);
      expect(result.pointsMultiplier).toBe(2.0);
    });

    it('points multiplier in stat modifiers matches match result', () => {
      const enemy = createStingingScorpion();
      const statMods = enemy.getStatModifiers();
      const matchResult = enemy.onValidMatch([], []);
      expect(statMods.pointsMultiplier).toBe(matchResult.pointsMultiplier);
    });
  });

  // ==========================================================================
  // DEFEAT CONDITION TESTS
  // ==========================================================================
  describe('defeat condition', () => {
    // --- Edge Cases: Zero ---
    describe('edge case: zero', () => {
      it('returns false when totalMatches is 0 and invalidMatches is 0', () => {
        const enemy = createStingingScorpion();
        const stats = createRoundStats({ totalMatches: 0, invalidMatches: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });

    // --- Edge Cases: Threshold - 1 ---
    describe('edge case: threshold - 1 (totalMatches = 0, invalidMatches = 0)', () => {
      it('returns false when just below threshold (no matches)', () => {
        const enemy = createStingingScorpion();
        // Threshold is 1 match with 0 invalid, so threshold - 1 is 0 matches
        const stats = createRoundStats({ totalMatches: 0, invalidMatches: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });

    // --- Edge Cases: Exact Threshold ---
    describe('edge case: exact threshold (1 valid match, 0 invalid)', () => {
      it('returns true at exact threshold (1 match, 0 invalid)', () => {
        const enemy = createStingingScorpion();
        const stats = createRoundStats({ totalMatches: 1, invalidMatches: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    // --- Edge Cases: Above Threshold ---
    describe('edge case: above threshold', () => {
      it('returns true when well above threshold (5 matches, 0 invalid)', () => {
        const enemy = createStingingScorpion();
        const stats = createRoundStats({ totalMatches: 5, invalidMatches: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when far above threshold (10 matches, 0 invalid)', () => {
        const enemy = createStingingScorpion();
        const stats = createRoundStats({ totalMatches: 10, invalidMatches: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when very high matches (100 matches, 0 invalid)', () => {
        const enemy = createStingingScorpion();
        const stats = createRoundStats({ totalMatches: 100, invalidMatches: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    // --- Invalid Match Cases ---
    describe('invalid match failures', () => {
      it('returns false when 1 invalid match made (even with valid matches)', () => {
        const enemy = createStingingScorpion();
        const stats = createRoundStats({ totalMatches: 5, invalidMatches: 1 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when 2 invalid matches made', () => {
        const enemy = createStingingScorpion();
        const stats = createRoundStats({ totalMatches: 5, invalidMatches: 2 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when many invalid matches made', () => {
        const enemy = createStingingScorpion();
        const stats = createRoundStats({ totalMatches: 20, invalidMatches: 10 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when only invalid matches (0 valid)', () => {
        const enemy = createStingingScorpion();
        const stats = createRoundStats({ totalMatches: 0, invalidMatches: 5 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when exactly 1 total match but 1 invalid', () => {
        const enemy = createStingingScorpion();
        // Note: totalMatches tracks valid matches only
        const stats = createRoundStats({ totalMatches: 1, invalidMatches: 1 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });

    // --- Boundary Condition Tests ---
    describe('boundary conditions', () => {
      it('returns false when ratio is just wrong (1 valid, 1 invalid)', () => {
        const enemy = createStingingScorpion();
        const stats = createRoundStats({ totalMatches: 1, invalidMatches: 1 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true with high valid match count (50 valid, 0 invalid)', () => {
        const enemy = createStingingScorpion();
        const stats = createRoundStats({ totalMatches: 50, invalidMatches: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('handles large numbers correctly', () => {
        const enemy = createStingingScorpion();
        const stats = createRoundStats({ totalMatches: 1000, invalidMatches: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    // --- Other Stats Should Not Affect Condition ---
    describe('other stats do not affect defeat condition', () => {
      it('returns true regardless of currentStreak', () => {
        const enemy = createStingingScorpion();
        const stats = createRoundStats({
          totalMatches: 5,
          invalidMatches: 0,
          currentStreak: 10,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true regardless of maxStreak', () => {
        const enemy = createStingingScorpion();
        const stats = createRoundStats({
          totalMatches: 3,
          invalidMatches: 0,
          maxStreak: 100,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true regardless of timeRemaining', () => {
        const enemy = createStingingScorpion();
        const stats = createRoundStats({
          totalMatches: 2,
          invalidMatches: 0,
          timeRemaining: 1,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true regardless of damageReceived', () => {
        const enemy = createStingingScorpion();
        const stats = createRoundStats({
          totalMatches: 2,
          invalidMatches: 0,
          damageReceived: 5,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true regardless of gracesUsed', () => {
        const enemy = createStingingScorpion();
        const stats = createRoundStats({
          totalMatches: 2,
          invalidMatches: 0,
          gracesUsed: 3,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true regardless of hintsUsed', () => {
        const enemy = createStingingScorpion();
        const stats = createRoundStats({
          totalMatches: 2,
          invalidMatches: 0,
          hintsUsed: 5,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true regardless of currentScore', () => {
        const enemy = createStingingScorpion();
        const stats = createRoundStats({
          totalMatches: 2,
          invalidMatches: 0,
          currentScore: 999,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS: onRoundStart
  // ==========================================================================
  describe('onRoundStart', () => {
    it('returns empty card modifications', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);
      const result = enemy.onRoundStart(board);
      expect(result.events).toEqual([]);
    });

    it('does not modify original board', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);
      const boardCopy = JSON.stringify(board);
      enemy.onRoundStart(board);
      expect(JSON.stringify(board)).toBe(boardCopy);
    });

    it('handles empty board', () => {
      const enemy = createStingingScorpion();
      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('handles large board', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(50);
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('returns result with correct structure', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);
      const result = enemy.onRoundStart(board);
      expect(result).toHaveProperty('cardModifications');
      expect(result).toHaveProperty('events');
      expect(Array.isArray(result.cardModifications)).toBe(true);
      expect(Array.isArray(result.events)).toBe(true);
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS: onCardDraw
  // ==========================================================================
  describe('onCardDraw', () => {
    it('returns card unchanged (no modifications)', () => {
      const enemy = createStingingScorpion();
      const card = createCard({ shape: 'oval', color: 'red', number: 1 });
      const result = enemy.onCardDraw(card);
      expect(result).toEqual(card);
    });

    it('does not add dud property', () => {
      const enemy = createStingingScorpion();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isDud).toBeFalsy();
    });

    it('does not add face-down property', () => {
      const enemy = createStingingScorpion();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isFaceDown).toBeFalsy();
    });

    it('does not add bomb property', () => {
      const enemy = createStingingScorpion();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.hasBomb).toBeFalsy();
    });

    it('preserves all card attributes', () => {
      const enemy = createStingingScorpion();
      const card = createCard({
        shape: 'diamond',
        color: 'purple',
        number: 3,
        shading: 'striped',
      });
      const result = enemy.onCardDraw(card);
      expect(result.shape).toBe('diamond');
      expect(result.color).toBe('purple');
      expect(result.number).toBe(3);
      expect(result.shading).toBe('striped');
    });

    it('handles card with existing properties', () => {
      const enemy = createStingingScorpion();
      const card = createCard({ onFire: true });
      const result = enemy.onCardDraw(card);
      expect(result.onFire).toBe(true);
    });

    it('returns same reference (identity)', () => {
      const enemy = createStingingScorpion();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result).toBe(card);
    });

    it('does not modify card with Math.random mocked low', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.01);
      const enemy = createStingingScorpion();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result).toBe(card);
    });

    it('does not modify card with Math.random mocked high', () => {
      jest.spyOn(Math, 'random').mockReturnValue(0.99);
      const enemy = createStingingScorpion();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result).toBe(card);
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS: onValidMatch
  // ==========================================================================
  describe('onValidMatch', () => {
    it('returns points multiplier of 2.0', () => {
      const enemy = createStingingScorpion();
      const matchedCards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.pointsMultiplier).toBe(2.0);
    });

    it('returns 0 time delta', () => {
      const enemy = createStingingScorpion();
      const result = enemy.onValidMatch([], []);
      expect(result.timeDelta).toBe(0);
    });

    it('returns empty cardsToRemove array', () => {
      const enemy = createStingingScorpion();
      const result = enemy.onValidMatch([], []);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardsToFlip array', () => {
      const enemy = createStingingScorpion();
      const result = enemy.onValidMatch([], []);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createStingingScorpion();
      const result = enemy.onValidMatch([], []);
      expect(result.events).toEqual([]);
    });

    it('handles match with various card types', () => {
      const enemy = createStingingScorpion();
      const matchedCards = [
        createCard({ shape: 'oval', color: 'red', number: 1 }),
        createCard({ shape: 'squiggle', color: 'green', number: 2 }),
        createCard({ shape: 'diamond', color: 'purple', number: 3 }),
      ];
      const result = enemy.onValidMatch(matchedCards, createTestBoard(12));
      expect(result.pointsMultiplier).toBe(2.0);
    });

    it('returns result with correct structure', () => {
      const enemy = createStingingScorpion();
      const result = enemy.onValidMatch([], []);
      expect(result).toHaveProperty('timeDelta');
      expect(result).toHaveProperty('pointsMultiplier');
      expect(result).toHaveProperty('cardsToRemove');
      expect(result).toHaveProperty('cardsToFlip');
      expect(result).toHaveProperty('events');
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS: onInvalidMatch
  // ==========================================================================
  describe('onInvalidMatch', () => {
    it('returns points multiplier of 1 (no bonus on invalid)', () => {
      const enemy = createStingingScorpion();
      const invalidCards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onInvalidMatch(invalidCards, board);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('returns 0 time delta', () => {
      const enemy = createStingingScorpion();
      const result = enemy.onInvalidMatch([], []);
      expect(result.timeDelta).toBe(0);
    });

    it('returns empty cardsToRemove array', () => {
      const enemy = createStingingScorpion();
      const result = enemy.onInvalidMatch([], []);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardsToFlip array', () => {
      const enemy = createStingingScorpion();
      const result = enemy.onInvalidMatch([], []);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createStingingScorpion();
      const result = enemy.onInvalidMatch([], []);
      expect(result.events).toEqual([]);
    });

    it('returns result with correct structure', () => {
      const enemy = createStingingScorpion();
      const result = enemy.onInvalidMatch([], []);
      expect(result).toHaveProperty('timeDelta');
      expect(result).toHaveProperty('pointsMultiplier');
      expect(result).toHaveProperty('cardsToRemove');
      expect(result).toHaveProperty('cardsToFlip');
      expect(result).toHaveProperty('events');
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS: onRoundEnd
  // ==========================================================================
  describe('onRoundEnd', () => {
    it('does not throw', () => {
      const enemy = createStingingScorpion();
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('returns undefined (void function)', () => {
      const enemy = createStingingScorpion();
      const result = enemy.onRoundEnd();
      expect(result).toBeUndefined();
    });

    it('can be called multiple times without error', () => {
      const enemy = createStingingScorpion();
      expect(() => {
        enemy.onRoundEnd();
        enemy.onRoundEnd();
        enemy.onRoundEnd();
      }).not.toThrow();
    });

    it('stat modifiers remain valid after round end', () => {
      const enemy = createStingingScorpion();
      enemy.onRoundEnd();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.damageMultiplier).toBe(2.0);
      expect(modifiers.pointsMultiplier).toBe(2.0);
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS: onTick
  // ==========================================================================
  describe('onTick', () => {
    it('returns 0 score delta', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);
      const result = enemy.onTick(100, board);
      expect(result.scoreDelta).toBe(0);
    });

    it('returns 0 health delta', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);
      const result = enemy.onTick(100, board);
      expect(result.healthDelta).toBe(0);
    });

    it('returns 0 time delta', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);
      const result = enemy.onTick(100, board);
      expect(result.timeDelta).toBe(0);
    });

    it('returns empty cardsToRemove array', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);
      const result = enemy.onTick(100, board);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardModifications array', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);
      const result = enemy.onTick(100, board);
      expect(result.cardModifications).toEqual([]);
    });

    it('returns empty cardsToFlip array', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);
      const result = enemy.onTick(100, board);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);
      const result = enemy.onTick(100, board);
      expect(result.events).toEqual([]);
    });

    it('returns instantDeath as false', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);
      const result = enemy.onTick(100, board);
      expect(result.instantDeath).toBe(false);
    });

    it('handles zero deltaMs', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);
      const result = enemy.onTick(0, board);
      expect(result.scoreDelta).toBe(0);
      expect(result.healthDelta).toBe(0);
    });

    it('handles large deltaMs', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);
      const result = enemy.onTick(60000, board);
      expect(result.scoreDelta).toBe(0);
      expect(result.healthDelta).toBe(0);
      expect(result.instantDeath).toBe(false);
    });

    it('handles empty board', () => {
      const enemy = createStingingScorpion();
      const result = enemy.onTick(100, []);
      expect(result.scoreDelta).toBe(0);
      expect(result.healthDelta).toBe(0);
    });

    it('returns result with correct structure', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);
      const result = enemy.onTick(100, board);
      expect(result).toHaveProperty('scoreDelta');
      expect(result).toHaveProperty('healthDelta');
      expect(result).toHaveProperty('timeDelta');
      expect(result).toHaveProperty('cardsToRemove');
      expect(result).toHaveProperty('cardModifications');
      expect(result).toHaveProperty('cardsToFlip');
      expect(result).toHaveProperty('events');
      expect(result).toHaveProperty('instantDeath');
    });

    it('is consistent across multiple ticks', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);

      const result1 = enemy.onTick(100, board);
      const result2 = enemy.onTick(100, board);
      const result3 = enemy.onTick(100, board);

      expect(result1.scoreDelta).toBe(result2.scoreDelta);
      expect(result2.scoreDelta).toBe(result3.scoreDelta);
      expect(result1.healthDelta).toBe(result2.healthDelta);
    });
  });

  // ==========================================================================
  // UI MODIFIERS: getUIModifiers
  // ==========================================================================
  describe('getUIModifiers', () => {
    it('returns an object', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getUIModifiers();
      expect(typeof modifiers).toBe('object');
    });

    it('does not include inactivity bar', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showInactivityBar).toBeUndefined();
    });

    it('does not include score decay', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showScoreDecay).toBeUndefined();
    });

    it('does not include timer speed multiplier', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.timerSpeedMultiplier).toBeUndefined();
    });

    it('does not disable auto hint', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableAutoHint).toBeFalsy();
    });

    it('does not disable manual hint', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableManualHint).toBeFalsy();
    });

    it('does not show countdown cards', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showCountdownCards).toBeUndefined();
    });

    it('does not show bomb cards', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showBombCards).toBeUndefined();
    });

    it('does not show weapon counters', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters).toBeUndefined();
    });

    it('returns consistent modifiers after round lifecycle', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);

      enemy.onRoundStart(board);
      const mod1 = enemy.getUIModifiers();

      enemy.onTick(1000, board);
      const mod2 = enemy.getUIModifiers();

      enemy.onValidMatch([], board);
      const mod3 = enemy.getUIModifiers();

      enemy.onRoundEnd();
      const mod4 = enemy.getUIModifiers();

      expect(mod1.showInactivityBar).toBeUndefined();
      expect(mod2.showInactivityBar).toBeUndefined();
      expect(mod3.showInactivityBar).toBeUndefined();
      expect(mod4.showInactivityBar).toBeUndefined();
    });
  });

  // ==========================================================================
  // STAT MODIFIERS: getStatModifiers
  // ==========================================================================
  describe('getStatModifiers', () => {
    it('returns damage multiplier of 2.0', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.damageMultiplier).toBe(2.0);
    });

    it('returns points multiplier of 2.0', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.pointsMultiplier).toBe(2.0);
    });

    it('does not have fire spread chance reduction', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
    });

    it('does not have explosion chance reduction', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.explosionChanceReduction).toBeUndefined();
    });

    it('does not have laser chance reduction', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.laserChanceReduction).toBeUndefined();
    });

    it('does not have hint gain chance reduction', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.hintGainChanceReduction).toBeUndefined();
    });

    it('does not have grace gain chance reduction', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.graceGainChanceReduction).toBeUndefined();
    });

    it('does not have time gain chance reduction', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.timeGainChanceReduction).toBeUndefined();
    });

    it('does not have healing chance reduction', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.healingChanceReduction).toBeUndefined();
    });

    it('returns consistent modifiers across multiple calls', () => {
      const enemy = createStingingScorpion();

      const mod1 = enemy.getStatModifiers();
      const mod2 = enemy.getStatModifiers();
      const mod3 = enemy.getStatModifiers();

      expect(mod1.damageMultiplier).toBe(mod2.damageMultiplier);
      expect(mod2.damageMultiplier).toBe(mod3.damageMultiplier);
      expect(mod1.pointsMultiplier).toBe(mod2.pointsMultiplier);
      expect(mod2.pointsMultiplier).toBe(mod3.pointsMultiplier);
    });
  });

  // ==========================================================================
  // INTEGRATION: Full Gameplay Scenario
  // ==========================================================================
  describe('full gameplay scenario', () => {
    it('simulates a perfect round (all valid matches)', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);

      // Start round
      const startResult = enemy.onRoundStart(board);
      expect(startResult.cardModifications).toEqual([]);

      // Simulate ticks
      for (let i = 0; i < 10; i++) {
        const tickResult = enemy.onTick(1000, board);
        expect(tickResult.healthDelta).toBe(0);
      }

      // Simulate valid matches
      const stats = createRoundStats({ totalMatches: 0, invalidMatches: 0 });
      for (let i = 0; i < 5; i++) {
        const matchResult = enemy.onValidMatch([], board);
        expect(matchResult.pointsMultiplier).toBe(2.0);
        stats.totalMatches++;
      }

      // Check defeat condition
      expect(enemy.checkDefeatCondition(stats)).toBe(true);

      // End round
      enemy.onRoundEnd();
    });

    it('simulates a failed round (invalid match made)', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);

      enemy.onRoundStart(board);

      // Make some valid matches
      const stats = createRoundStats({ totalMatches: 0, invalidMatches: 0 });
      for (let i = 0; i < 3; i++) {
        enemy.onValidMatch([], board);
        stats.totalMatches++;
      }

      // Make an invalid match
      enemy.onInvalidMatch([], board);
      stats.invalidMatches++;

      // Defeat condition should fail
      expect(enemy.checkDefeatCondition(stats)).toBe(false);

      enemy.onRoundEnd();
    });

    it('simulates a round with no matches (neither win nor lose the stretch goal)', () => {
      const enemy = createStingingScorpion();
      const board = createTestBoard(12);

      enemy.onRoundStart(board);

      // Just ticks, no matches
      for (let i = 0; i < 60; i++) {
        enemy.onTick(1000, board);
      }

      const stats = createRoundStats({ totalMatches: 0, invalidMatches: 0 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);

      enemy.onRoundEnd();
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================
  describe('edge cases', () => {
    it('handles face-down cards in board without issues', () => {
      const enemy = createStingingScorpion();
      const board = [
        createFaceDownCard(),
        createFaceDownCard(),
        createCard(),
        ...createTestBoard(9),
      ];
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
    });

    it('handles triple cards in board without issues', () => {
      const enemy = createStingingScorpion();
      const board = [
        createTripleCard(),
        createTripleCard(),
        createCard(),
        ...createTestBoard(9),
      ];
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
    });

    it('handles varied board correctly', () => {
      const enemy = createStingingScorpion();
      const board = createVariedBoard();
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('handles cards with fire state', () => {
      const enemy = createStingingScorpion();
      const card = createCard({ onFire: true });
      const result = enemy.onCardDraw(card);
      expect(result.onFire).toBe(true);
    });

    it('multiple instances are independent', () => {
      const enemy1 = createStingingScorpion();
      const enemy2 = createStingingScorpion();

      const board = createTestBoard(12);

      enemy1.onRoundStart(board);
      enemy1.onValidMatch([], board);

      // enemy2 should not be affected by enemy1's state
      const mod1 = enemy1.getStatModifiers();
      const mod2 = enemy2.getStatModifiers();

      expect(mod1.damageMultiplier).toBe(mod2.damageMultiplier);
      expect(mod1.pointsMultiplier).toBe(mod2.pointsMultiplier);
    });
  });
});
