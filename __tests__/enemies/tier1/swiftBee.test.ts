/**
 * Comprehensive Unit Tests for Swift Bee Enemy
 *
 * Swift Bee is a Tier 1 enemy with:
 * - Effect: Timer runs 20% faster (TimerSpeedEffect with multiplier 1.2)
 * - Effect: Earn 20% more points (PointsMultiplierEffect with multiplier 1.2)
 * - Defeat Condition: Get a 5-match streak
 */

import { createSwiftBee } from '@/utils/enemies/tier1/swiftBee';
import {
  createRoundStats,
  createCard,
  createTestBoard,
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

describe('Swift Bee', () => {
  // ==========================================================================
  // METADATA TESTS
  // ==========================================================================
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createSwiftBee();
      expect(enemy.name).toBe('Swift Bee');
    });

    it('has tier 1', () => {
      const enemy = createSwiftBee();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon', () => {
      const enemy = createSwiftBee();
      expect(enemy.icon).toBe('lorc/bee');
    });

    it('has description containing timer speed info', () => {
      const enemy = createSwiftBee();
      expect(enemy.description).toContain('20%');
      expect(enemy.description.toLowerCase()).toContain('faster');
    });

    it('has description containing points multiplier info', () => {
      const enemy = createSwiftBee();
      expect(enemy.description).toContain('20%');
      expect(enemy.description.toLowerCase()).toContain('points');
    });

    it('has defeat condition text mentioning 5-match streak', () => {
      const enemy = createSwiftBee();
      expect(enemy.defeatConditionText).toContain('5');
      expect(enemy.defeatConditionText.toLowerCase()).toContain('streak');
    });

    it('has description that is not empty', () => {
      const enemy = createSwiftBee();
      expect(enemy.description.length).toBeGreaterThan(0);
    });

    it('has defeatConditionText that is not empty', () => {
      const enemy = createSwiftBee();
      expect(enemy.defeatConditionText.length).toBeGreaterThan(0);
    });

    it('has a defined icon property', () => {
      const enemy = createSwiftBee();
      expect(enemy.icon).toBeDefined();
      expect(typeof enemy.icon).toBe('string');
    });

    it('has tier as a number between 1 and 4', () => {
      const enemy = createSwiftBee();
      expect(enemy.tier).toBeGreaterThanOrEqual(1);
      expect(enemy.tier).toBeLessThanOrEqual(4);
    });
  });

  // ==========================================================================
  // TIMER SPEED EFFECT TESTS
  // ==========================================================================
  describe('timer speed effect', () => {
    it('returns 1.2x timer speed multiplier in UI modifiers', () => {
      const enemy = createSwiftBee();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.timerSpeedMultiplier).toBe(1.2);
    });

    it('timer speed multiplier is exactly 1.2 (20% faster)', () => {
      const enemy = createSwiftBee();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.timerSpeedMultiplier).toBeCloseTo(1.2, 5);
    });

    it('timer speed multiplier is greater than 1 (faster timer)', () => {
      const enemy = createSwiftBee();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.timerSpeedMultiplier).toBeGreaterThan(1);
    });

    it('timer speed multiplier is consistent across multiple calls', () => {
      const enemy = createSwiftBee();

      const modifiers1 = enemy.getUIModifiers();
      const modifiers2 = enemy.getUIModifiers();
      const modifiers3 = enemy.getUIModifiers();

      expect(modifiers1.timerSpeedMultiplier).toBe(modifiers2.timerSpeedMultiplier);
      expect(modifiers2.timerSpeedMultiplier).toBe(modifiers3.timerSpeedMultiplier);
    });

    it('timer speed multiplier persists after round start', () => {
      const enemy = createSwiftBee();
      const board = createTestBoard(12);

      enemy.onRoundStart(board);
      const modifiers = enemy.getUIModifiers();

      expect(modifiers.timerSpeedMultiplier).toBe(1.2);
    });

    it('timer speed multiplier persists after valid match', () => {
      const enemy = createSwiftBee();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      enemy.onValidMatch(matchedCards, board);
      const modifiers = enemy.getUIModifiers();

      expect(modifiers.timerSpeedMultiplier).toBe(1.2);
    });

    it('timer speed multiplier persists after multiple ticks', () => {
      const enemy = createSwiftBee();
      const board = createTestBoard(12);

      // Simulate 10 seconds of gameplay
      for (let i = 0; i < 100; i++) {
        enemy.onTick(100, board);
      }
      const modifiers = enemy.getUIModifiers();

      expect(modifiers.timerSpeedMultiplier).toBe(1.2);
    });
  });

  // ==========================================================================
  // POINTS MULTIPLIER EFFECT TESTS
  // ==========================================================================
  describe('points multiplier effect', () => {
    it('returns 1.2x points multiplier on valid match', () => {
      const enemy = createSwiftBee();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      const result = enemy.onValidMatch(matchedCards, board);

      expect(result.pointsMultiplier).toBe(1.2);
    });

    it('returns 1.2x points multiplier in stat modifiers', () => {
      const enemy = createSwiftBee();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.pointsMultiplier).toBe(1.2);
    });

    it('points multiplier is exactly 1.2 (20% more points)', () => {
      const enemy = createSwiftBee();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.pointsMultiplier).toBeCloseTo(1.2, 5);
    });

    it('points multiplier is greater than 1 (bonus points)', () => {
      const enemy = createSwiftBee();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.pointsMultiplier).toBeGreaterThan(1);
    });

    it('points multiplier is consistent on multiple consecutive matches', () => {
      const enemy = createSwiftBee();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      const result1 = enemy.onValidMatch(matchedCards, board);
      const result2 = enemy.onValidMatch(matchedCards, board);
      const result3 = enemy.onValidMatch(matchedCards, board);

      expect(result1.pointsMultiplier).toBe(1.2);
      expect(result2.pointsMultiplier).toBe(1.2);
      expect(result3.pointsMultiplier).toBe(1.2);
    });

    it('points multiplier applies even with empty matched cards array', () => {
      const enemy = createSwiftBee();
      const board = createTestBoard(12);

      const result = enemy.onValidMatch([], board);

      expect(result.pointsMultiplier).toBe(1.2);
    });

    it('points multiplier applies even with empty board', () => {
      const enemy = createSwiftBee();

      const result = enemy.onValidMatch([], []);

      expect(result.pointsMultiplier).toBe(1.2);
    });

    it('stat modifiers points multiplier matches match result multiplier', () => {
      const enemy = createSwiftBee();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      const statModifiers = enemy.getStatModifiers();
      const matchResult = enemy.onValidMatch(matchedCards, board);

      expect(statModifiers.pointsMultiplier).toBe(matchResult.pointsMultiplier);
    });
  });

  // ==========================================================================
  // DEFEAT CONDITION TESTS
  // ==========================================================================
  describe('defeat condition', () => {
    it('returns false when maxStreak is 0', () => {
      const enemy = createSwiftBee();
      const stats = createRoundStats({ maxStreak: 0 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when maxStreak is 1', () => {
      const enemy = createSwiftBee();
      const stats = createRoundStats({ maxStreak: 1 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when maxStreak is 2', () => {
      const enemy = createSwiftBee();
      const stats = createRoundStats({ maxStreak: 2 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when maxStreak is 3', () => {
      const enemy = createSwiftBee();
      const stats = createRoundStats({ maxStreak: 3 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when maxStreak is 4 (threshold - 1)', () => {
      const enemy = createSwiftBee();
      const stats = createRoundStats({ maxStreak: 4 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when maxStreak is exactly 5 (threshold)', () => {
      const enemy = createSwiftBee();
      const stats = createRoundStats({ maxStreak: 5 });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when maxStreak is 6 (threshold + 1)', () => {
      const enemy = createSwiftBee();
      const stats = createRoundStats({ maxStreak: 6 });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when maxStreak is 7', () => {
      const enemy = createSwiftBee();
      const stats = createRoundStats({ maxStreak: 7 });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when maxStreak is 10 (well above threshold)', () => {
      const enemy = createSwiftBee();
      const stats = createRoundStats({ maxStreak: 10 });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when maxStreak is 100 (extreme case)', () => {
      const enemy = createSwiftBee();
      const stats = createRoundStats({ maxStreak: 100 });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('only considers maxStreak, not currentStreak', () => {
      const enemy = createSwiftBee();
      const stats = createRoundStats({ currentStreak: 10, maxStreak: 4 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('ignores totalMatches count for defeat condition', () => {
      const enemy = createSwiftBee();
      const stats = createRoundStats({ totalMatches: 100, maxStreak: 4 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('ignores invalidMatches count for defeat condition', () => {
      const enemy = createSwiftBee();
      const stats = createRoundStats({ invalidMatches: 50, maxStreak: 4 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('ignores all other stats when checking defeat condition', () => {
      const enemy = createSwiftBee();
      const stats = createRoundStats({
        totalMatches: 50,
        currentStreak: 99,
        invalidMatches: 20,
        hintsUsed: 10,
        gracesUsed: 5,
        damageReceived: 10,
        currentScore: 9999,
        maxStreak: 4,
      });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('defeat condition works with minimal stats object', () => {
      const enemy = createSwiftBee();
      const stats = createRoundStats({ maxStreak: 5 });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS TESTS
  // ==========================================================================
  describe('lifecycle hooks', () => {
    describe('onRoundStart', () => {
      it('returns empty card modifications', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);

        const result = enemy.onRoundStart(board);

        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty events', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);

        const result = enemy.onRoundStart(board);

        expect(result.events).toEqual([]);
      });

      it('does not modify any cards on the board', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);
        const originalBoard = JSON.stringify(board);

        enemy.onRoundStart(board);

        expect(JSON.stringify(board)).toBe(originalBoard);
      });

      it('handles empty board', () => {
        const enemy = createSwiftBee();

        const result = enemy.onRoundStart([]);

        expect(result.cardModifications).toEqual([]);
        expect(result.events).toEqual([]);
      });

      it('handles large board', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(100);

        const result = enemy.onRoundStart(board);

        expect(result.cardModifications).toEqual([]);
        expect(result.events).toEqual([]);
      });

      it('can be called multiple times without issue', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);

        expect(() => {
          enemy.onRoundStart(board);
          enemy.onRoundStart(board);
          enemy.onRoundStart(board);
        }).not.toThrow();
      });
    });

    describe('onCardDraw', () => {
      it('returns the card unchanged', () => {
        const enemy = createSwiftBee();
        const card = createCard({ shape: 'diamond', color: 'purple', number: 2 });

        const result = enemy.onCardDraw(card);

        expect(result).toEqual(card);
      });

      it('does not add isDud property', () => {
        const enemy = createSwiftBee();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result.isDud).toBeUndefined();
      });

      it('does not add isFaceDown property', () => {
        const enemy = createSwiftBee();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result.isFaceDown).toBeUndefined();
      });

      it('does not add hasBomb property', () => {
        const enemy = createSwiftBee();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result.hasBomb).toBeUndefined();
      });

      it('does not add hasCountdown property', () => {
        const enemy = createSwiftBee();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result.hasCountdown).toBeUndefined();
      });

      it('preserves existing card properties', () => {
        const enemy = createSwiftBee();
        const card = createCard({
          shape: 'squiggle',
          color: 'green',
          number: 3,
          shading: 'striped',
        });

        const result = enemy.onCardDraw(card);

        expect(result.shape).toBe('squiggle');
        expect(result.color).toBe('green');
        expect(result.number).toBe(3);
        expect(result.shading).toBe('striped');
      });

      it('handles card with existing special properties', () => {
        const enemy = createSwiftBee();
        const card = createCard({ onFire: true });

        const result = enemy.onCardDraw(card);

        expect(result.onFire).toBe(true);
      });

      it('handles face-down card', () => {
        const enemy = createSwiftBee();
        const card = createFaceDownCard();

        const result = enemy.onCardDraw(card);

        expect(result.isFaceDown).toBe(true);
        expect(result.wasOriginallyFaceDown).toBe(true);
      });

      it('handles triple card', () => {
        const enemy = createSwiftBee();
        const card = createTripleCard();

        const result = enemy.onCardDraw(card);

        expect(result.health).toBe(3);
      });
    });

    describe('onValidMatch', () => {
      it('returns 1.2x points multiplier', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);
        const matchedCards = [board[0], board[1], board[2]];

        const result = enemy.onValidMatch(matchedCards, board);

        expect(result.pointsMultiplier).toBe(1.2);
      });

      it('returns zero time delta', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);
        const matchedCards = [board[0], board[1], board[2]];

        const result = enemy.onValidMatch(matchedCards, board);

        expect(result.timeDelta).toBe(0);
      });

      it('returns empty cardsToRemove array', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);
        const matchedCards = [board[0], board[1], board[2]];

        const result = enemy.onValidMatch(matchedCards, board);

        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty cardsToFlip array', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);
        const matchedCards = [board[0], board[1], board[2]];

        const result = enemy.onValidMatch(matchedCards, board);

        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events array', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);
        const matchedCards = [board[0], board[1], board[2]];

        const result = enemy.onValidMatch(matchedCards, board);

        expect(result.events).toEqual([]);
      });

      it('handles empty board', () => {
        const enemy = createSwiftBee();
        const matchedCards = [createCard(), createCard(), createCard()];

        const result = enemy.onValidMatch(matchedCards, []);

        expect(result.pointsMultiplier).toBe(1.2);
      });

      it('handles empty matched cards array', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);

        const result = enemy.onValidMatch([], board);

        expect(result.pointsMultiplier).toBe(1.2);
      });
    });

    describe('onInvalidMatch', () => {
      it('returns default points multiplier of 1', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);
        const invalidCards = [board[0], board[1], board[2]];

        const result = enemy.onInvalidMatch(invalidCards, board);

        expect(result.pointsMultiplier).toBe(1);
      });

      it('returns zero time delta', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);
        const invalidCards = [board[0], board[1], board[2]];

        const result = enemy.onInvalidMatch(invalidCards, board);

        expect(result.timeDelta).toBe(0);
      });

      it('returns empty cardsToRemove array', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);
        const invalidCards = [board[0], board[1], board[2]];

        const result = enemy.onInvalidMatch(invalidCards, board);

        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty cardsToFlip array', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);
        const invalidCards = [board[0], board[1], board[2]];

        const result = enemy.onInvalidMatch(invalidCards, board);

        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events array', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);
        const invalidCards = [board[0], board[1], board[2]];

        const result = enemy.onInvalidMatch(invalidCards, board);

        expect(result.events).toEqual([]);
      });

      it('does not apply points multiplier on invalid match', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);
        const invalidCards = [board[0], board[1], board[2]];

        const result = enemy.onInvalidMatch(invalidCards, board);

        expect(result.pointsMultiplier).not.toBe(1.2);
      });
    });

    describe('onTick', () => {
      it('returns zero score delta', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.scoreDelta).toBe(0);
      });

      it('returns zero health delta', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.healthDelta).toBe(0);
      });

      it('returns zero time delta', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.timeDelta).toBe(0);
      });

      it('does not trigger instant death', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.instantDeath).toBe(false);
      });

      it('returns empty cardsToRemove array', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty cardModifications array', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty cardsToFlip array', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events array', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.events).toEqual([]);
      });

      it('remains consistent over many ticks', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);

        // Simulate 60 seconds of gameplay
        for (let i = 0; i < 600; i++) {
          const result = enemy.onTick(100, board);
          expect(result.healthDelta).toBe(0);
          expect(result.instantDeath).toBe(false);
        }
      });

      it('handles very small delta (1ms)', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);

        const result = enemy.onTick(1, board);

        expect(result.healthDelta).toBe(0);
        expect(result.scoreDelta).toBe(0);
      });

      it('handles very large delta (60 seconds)', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);

        const result = enemy.onTick(60000, board);

        expect(result.healthDelta).toBe(0);
        expect(result.scoreDelta).toBe(0);
        expect(result.instantDeath).toBe(false);
      });

      it('handles empty board', () => {
        const enemy = createSwiftBee();

        const result = enemy.onTick(100, []);

        expect(result.healthDelta).toBe(0);
        expect(result.scoreDelta).toBe(0);
      });
    });

    describe('onRoundEnd', () => {
      it('executes without error', () => {
        const enemy = createSwiftBee();

        expect(() => enemy.onRoundEnd()).not.toThrow();
      });

      it('can be called multiple times without issue', () => {
        const enemy = createSwiftBee();

        expect(() => {
          enemy.onRoundEnd();
          enemy.onRoundEnd();
          enemy.onRoundEnd();
        }).not.toThrow();
      });

      it('can be called after onRoundStart', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);

        enemy.onRoundStart(board);

        expect(() => enemy.onRoundEnd()).not.toThrow();
      });

      it('can be called after multiple matches and ticks', () => {
        const enemy = createSwiftBee();
        const board = createTestBoard(12);

        enemy.onRoundStart(board);
        enemy.onValidMatch([board[0], board[1], board[2]], board);
        enemy.onTick(1000, board);
        enemy.onValidMatch([board[3], board[4], board[5]], board);

        expect(() => enemy.onRoundEnd()).not.toThrow();
      });
    });
  });

  // ==========================================================================
  // UI MODIFIERS TESTS
  // ==========================================================================
  describe('UI modifiers', () => {
    it('returns timerSpeedMultiplier of 1.2', () => {
      const enemy = createSwiftBee();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.timerSpeedMultiplier).toBe(1.2);
    });

    it('does not show inactivity bar', () => {
      const enemy = createSwiftBee();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showInactivityBar).toBeUndefined();
    });

    it('does not show score decay', () => {
      const enemy = createSwiftBee();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showScoreDecay).toBeUndefined();
    });

    it('does not disable auto hint', () => {
      const enemy = createSwiftBee();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.disableAutoHint).toBeUndefined();
    });

    it('does not disable manual hint', () => {
      const enemy = createSwiftBee();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.disableManualHint).toBeUndefined();
    });

    it('does not show weapon counters', () => {
      const enemy = createSwiftBee();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.weaponCounters).toBeUndefined();
    });

    it('does not show countdown cards', () => {
      const enemy = createSwiftBee();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showCountdownCards).toBeUndefined();
    });

    it('does not show bomb cards', () => {
      const enemy = createSwiftBee();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showBombCards).toBeUndefined();
    });
  });

  // ==========================================================================
  // STAT MODIFIERS TESTS
  // ==========================================================================
  describe('stat modifiers', () => {
    it('returns pointsMultiplier of 1.2', () => {
      const enemy = createSwiftBee();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.pointsMultiplier).toBe(1.2);
    });

    it('does not modify damage multiplier', () => {
      const enemy = createSwiftBee();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.damageMultiplier).toBeUndefined();
    });

    it('does not reduce fire spread chance', () => {
      const enemy = createSwiftBee();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
    });

    it('does not reduce explosion chance', () => {
      const enemy = createSwiftBee();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.explosionChanceReduction).toBeUndefined();
    });

    it('does not reduce laser chance', () => {
      const enemy = createSwiftBee();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.laserChanceReduction).toBeUndefined();
    });

    it('does not reduce hint gain chance', () => {
      const enemy = createSwiftBee();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.hintGainChanceReduction).toBeUndefined();
    });

    it('does not reduce grace gain chance', () => {
      const enemy = createSwiftBee();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.graceGainChanceReduction).toBeUndefined();
    });

    it('does not reduce time gain chance', () => {
      const enemy = createSwiftBee();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.timeGainChanceReduction).toBeUndefined();
    });

    it('does not reduce healing chance', () => {
      const enemy = createSwiftBee();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.healingChanceReduction).toBeUndefined();
    });
  });

  // ==========================================================================
  // INTEGRATION / EDGE CASE TESTS
  // ==========================================================================
  describe('edge cases', () => {
    it('handles empty board on valid match', () => {
      const enemy = createSwiftBee();
      const emptyBoard: ReturnType<typeof createCard>[] = [];
      const matchedCards = [createCard(), createCard(), createCard()];

      const result = enemy.onValidMatch(matchedCards, emptyBoard);

      expect(result.pointsMultiplier).toBe(1.2);
    });

    it('handles empty matched cards array', () => {
      const enemy = createSwiftBee();
      const board = createTestBoard(12);

      const result = enemy.onValidMatch([], board);

      expect(result.pointsMultiplier).toBe(1.2);
    });

    it('maintains state across round restart', () => {
      const enemy = createSwiftBee();
      const board = createTestBoard(12);

      // First round
      enemy.onRoundStart(board);
      const result1 = enemy.onValidMatch([board[0], board[1], board[2]], board);
      enemy.onRoundEnd();

      // Second round
      enemy.onRoundStart(board);
      const result2 = enemy.onValidMatch([board[0], board[1], board[2]], board);

      expect(result1.pointsMultiplier).toBe(1.2);
      expect(result2.pointsMultiplier).toBe(1.2);
    });

    it('creates fresh instances each time', () => {
      const enemy1 = createSwiftBee();
      const enemy2 = createSwiftBee();

      // Modify enemy1 state
      enemy1.onRoundStart(createTestBoard(12));
      enemy1.onValidMatch([], []);

      // enemy2 should be independent
      expect(enemy2.name).toBe('Swift Bee');
      expect(enemy2.tier).toBe(1);
    });

    it('timer speed and points effects coexist correctly', () => {
      const enemy = createSwiftBee();
      const board = createTestBoard(12);

      const uiModifiers = enemy.getUIModifiers();
      const statModifiers = enemy.getStatModifiers();
      const matchResult = enemy.onValidMatch([board[0], board[1], board[2]], board);

      // Timer speed effect in UI modifiers
      expect(uiModifiers.timerSpeedMultiplier).toBe(1.2);

      // Points multiplier effect in stat modifiers
      expect(statModifiers.pointsMultiplier).toBe(1.2);

      // Points multiplier also in match result
      expect(matchResult.pointsMultiplier).toBe(1.2);
    });
  });

  // ==========================================================================
  // COMBINED EFFECTS TESTS
  // ==========================================================================
  describe('combined effects', () => {
    it('both effects (timer + points) are active simultaneously', () => {
      const enemy = createSwiftBee();

      const uiModifiers = enemy.getUIModifiers();
      const statModifiers = enemy.getStatModifiers();

      expect(uiModifiers.timerSpeedMultiplier).toBe(1.2);
      expect(statModifiers.pointsMultiplier).toBe(1.2);
    });

    it('effects remain consistent throughout a full round simulation', () => {
      const enemy = createSwiftBee();
      const board = createTestBoard(12);

      enemy.onRoundStart(board);

      // Simulate multiple ticks and matches
      for (let i = 0; i < 10; i++) {
        enemy.onTick(100, board);

        if (i % 3 === 0) {
          const matchResult = enemy.onValidMatch([board[0], board[1], board[2]], board);
          expect(matchResult.pointsMultiplier).toBe(1.2);
        }

        const uiModifiers = enemy.getUIModifiers();
        expect(uiModifiers.timerSpeedMultiplier).toBe(1.2);
      }

      enemy.onRoundEnd();
    });

    it('cumulative points bonus from multiple matches', () => {
      const enemy = createSwiftBee();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      let totalMultiplier = 1;
      for (let i = 0; i < 5; i++) {
        const result = enemy.onValidMatch(matchedCards, board);
        // Each match gets 1.2x multiplier
        totalMultiplier *= result.pointsMultiplier;
      }

      // After 5 matches, effective multiplier is 1.2^5 = 2.48832
      expect(totalMultiplier).toBeCloseTo(Math.pow(1.2, 5), 5);
    });
  });

  // ==========================================================================
  // FACTORY TESTS
  // ==========================================================================
  describe('factory', () => {
    it('creates a new instance each call', () => {
      const enemy1 = createSwiftBee();
      const enemy2 = createSwiftBee();

      expect(enemy1).not.toBe(enemy2);
    });

    it('all instances have the same metadata', () => {
      const instances = [
        createSwiftBee(),
        createSwiftBee(),
        createSwiftBee(),
      ];

      for (const enemy of instances) {
        expect(enemy.name).toBe('Swift Bee');
        expect(enemy.tier).toBe(1);
        expect(enemy.icon).toBe('lorc/bee');
      }
    });

    it('all instances have the same behavior', () => {
      const instances = [
        createSwiftBee(),
        createSwiftBee(),
        createSwiftBee(),
      ];

      for (const enemy of instances) {
        const uiModifiers = enemy.getUIModifiers();
        const statModifiers = enemy.getStatModifiers();

        expect(uiModifiers.timerSpeedMultiplier).toBe(1.2);
        expect(statModifiers.pointsMultiplier).toBe(1.2);
      }
    });
  });
});
