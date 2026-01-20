/**
 * Comprehensive Unit Tests for Diving Hawk Enemy (Tier 2)
 *
 * Diving Hawk is a focused speed-based enemy with:
 * - Effect: Timer 35% faster (1.35x multiplier)
 * - Defeat Condition: Get 3 all-different matches
 *
 * This test suite covers:
 * - Metadata verification
 * - Timer speed effect mechanics
 * - Defeat condition edge cases
 * - Lifecycle hook behavior
 * - UI modifier correctness
 * - Stat modifier behavior
 * - Integration scenarios
 */

import { createDivingHawk } from '@/utils/enemies/tier2/divingHawk';
import {
  createRoundStats,
  createCard,
  createTestBoard,
  createVariedBoard,
  createFaceDownCard,
  createTripleCard,
  resetCardIdCounter,
} from '../../testUtils';
import type { RoundStats } from '@/types/enemy';
import type { Card } from '@/types';

describe('Diving Hawk', () => {
  beforeEach(() => {
    resetCardIdCounter();
  });

  // ===========================================================================
  // METADATA TESTS
  // ===========================================================================

  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createDivingHawk();
      expect(enemy.name).toBe('Diving Hawk');
    });

    it('has correct tier (2)', () => {
      const enemy = createDivingHawk();
      expect(enemy.tier).toBe(2);
    });

    it('has correct icon path', () => {
      const enemy = createDivingHawk();
      expect(enemy.icon).toBe('lorc/hawk-emblem');
    });

    it('has correct description mentioning timer speed', () => {
      const enemy = createDivingHawk();
      expect(enemy.description).toBe('Timer 35% faster');
    });

    it('has correct defeat condition text', () => {
      const enemy = createDivingHawk();
      expect(enemy.defeatConditionText).toBe('Get 3 all-different matches');
    });

    it('description matches the actual timer multiplier', () => {
      const enemy = createDivingHawk();
      const uiMods = enemy.getUIModifiers();
      // 35% faster means 1.35 multiplier
      expect(enemy.description).toContain('35%');
      expect(uiMods.timerSpeedMultiplier).toBe(1.35);
    });

    it('tier is number type', () => {
      const enemy = createDivingHawk();
      expect(typeof enemy.tier).toBe('number');
    });

    it('name is non-empty string', () => {
      const enemy = createDivingHawk();
      expect(typeof enemy.name).toBe('string');
      expect(enemy.name.length).toBeGreaterThan(0);
    });

    it('icon follows naming convention', () => {
      const enemy = createDivingHawk();
      expect(enemy.icon).toMatch(/^[a-z-]+\/[a-z-]+$/);
    });
  });

  // ===========================================================================
  // TIMER SPEED EFFECT TESTS
  // ===========================================================================

  describe('timer speed effect', () => {
    it('has 35% faster timer (1.35x multiplier)', () => {
      const enemy = createDivingHawk();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBe(1.35);
    });

    it('timer multiplier is greater than 1 (faster)', () => {
      const enemy = createDivingHawk();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBeGreaterThan(1);
    });

    it('timer multiplier is less than 2 (not double)', () => {
      const enemy = createDivingHawk();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBeLessThan(2);
    });

    it('timer multiplier is exactly 1.35', () => {
      const enemy = createDivingHawk();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBeCloseTo(1.35, 5);
    });

    it('timer multiplier remains consistent across multiple calls', () => {
      const enemy = createDivingHawk();
      const uiMods1 = enemy.getUIModifiers();
      const uiMods2 = enemy.getUIModifiers();
      const uiMods3 = enemy.getUIModifiers();
      expect(uiMods1.timerSpeedMultiplier).toBe(uiMods2.timerSpeedMultiplier);
      expect(uiMods2.timerSpeedMultiplier).toBe(uiMods3.timerSpeedMultiplier);
    });

    it('timer multiplier persists after round start', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBe(1.35);
    });

    it('timer multiplier persists after onTick', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      enemy.onTick(1000, board);
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBe(1.35);
    });

    it('timer multiplier persists after valid match', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      enemy.onValidMatch([board[0], board[1], board[2]], board);
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBe(1.35);
    });

    it('timer multiplier persists after round end', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      enemy.onRoundEnd();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBe(1.35);
    });
  });

  // ===========================================================================
  // DEFEAT CONDITION TESTS
  // ===========================================================================

  describe('defeat condition', () => {
    describe('boundary cases', () => {
      it('returns false with 0 all-different matches', () => {
        const enemy = createDivingHawk();
        const stats = createRoundStats({ allDifferentMatches: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false with 1 all-different match', () => {
        const enemy = createDivingHawk();
        const stats = createRoundStats({ allDifferentMatches: 1 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false with 2 all-different matches', () => {
        const enemy = createDivingHawk();
        const stats = createRoundStats({ allDifferentMatches: 2 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true with exactly 3 all-different matches', () => {
        const enemy = createDivingHawk();
        const stats = createRoundStats({ allDifferentMatches: 3 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true with 4 all-different matches', () => {
        const enemy = createDivingHawk();
        const stats = createRoundStats({ allDifferentMatches: 4 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true with 5 all-different matches', () => {
        const enemy = createDivingHawk();
        const stats = createRoundStats({ allDifferentMatches: 5 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true with many all-different matches', () => {
        const enemy = createDivingHawk();
        const stats = createRoundStats({ allDifferentMatches: 100 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('independence from other stats', () => {
      it('ignores totalMatches count', () => {
        const enemy = createDivingHawk();
        const stats = createRoundStats({
          totalMatches: 100,
          allDifferentMatches: 2,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores allSameColorMatches count', () => {
        const enemy = createDivingHawk();
        const stats = createRoundStats({
          allSameColorMatches: 100,
          allDifferentMatches: 2,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores currentStreak', () => {
        const enemy = createDivingHawk();
        const stats = createRoundStats({
          currentStreak: 10,
          maxStreak: 10,
          allDifferentMatches: 2,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores time remaining', () => {
        const enemy = createDivingHawk();
        const stats = createRoundStats({
          timeRemaining: 60,
          allDifferentMatches: 2,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores current score', () => {
        const enemy = createDivingHawk();
        const stats = createRoundStats({
          currentScore: 1000,
          allDifferentMatches: 2,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores graces remaining', () => {
        const enemy = createDivingHawk();
        const stats = createRoundStats({
          gracesRemaining: 10,
          allDifferentMatches: 2,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores hints remaining', () => {
        const enemy = createDivingHawk();
        const stats = createRoundStats({
          hintsRemaining: 10,
          allDifferentMatches: 2,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores invalid matches', () => {
        const enemy = createDivingHawk();
        const stats = createRoundStats({
          invalidMatches: 100,
          allDifferentMatches: 2,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores damage received', () => {
        const enemy = createDivingHawk();
        const stats = createRoundStats({
          damageReceived: 5,
          allDifferentMatches: 2,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores shapes matched set', () => {
        const enemy = createDivingHawk();
        const stats = createRoundStats({
          shapesMatched: new Set(['oval', 'diamond', 'squiggle']),
          allDifferentMatches: 2,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores colors matched set', () => {
        const enemy = createDivingHawk();
        const stats = createRoundStats({
          colorsMatched: new Set(['red', 'green', 'purple']),
          allDifferentMatches: 2,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });

    describe('combined with high other stats', () => {
      it('still returns true when all stats are high and allDifferentMatches is 3', () => {
        const enemy = createDivingHawk();
        const stats = createRoundStats({
          totalMatches: 50,
          currentStreak: 15,
          maxStreak: 20,
          timeRemaining: 5,
          currentScore: 500,
          allDifferentMatches: 3,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('still returns false when all stats are high but allDifferentMatches is 2', () => {
        const enemy = createDivingHawk();
        const stats = createRoundStats({
          totalMatches: 50,
          currentStreak: 15,
          maxStreak: 20,
          timeRemaining: 60,
          currentScore: 500,
          allDifferentMatches: 2,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });
  });

  // ===========================================================================
  // LIFECYCLE HOOKS - onRoundStart
  // ===========================================================================

  describe('onRoundStart', () => {
    it('returns empty card modifications', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      const result = enemy.onRoundStart(board);
      expect(result.events).toEqual([]);
    });

    it('handles empty board gracefully', () => {
      const enemy = createDivingHawk();
      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('handles large board gracefully', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard(50);
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('does not modify the original board array', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      const originalLength = board.length;
      enemy.onRoundStart(board);
      expect(board.length).toBe(originalLength);
    });

    it('handles varied board correctly', () => {
      const enemy = createDivingHawk();
      const board = createVariedBoard();
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });
  });

  // ===========================================================================
  // LIFECYCLE HOOKS - onTick
  // ===========================================================================

  describe('onTick', () => {
    it('returns zero score delta', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      const result = enemy.onTick(1000, board);
      expect(result.scoreDelta).toBe(0);
    });

    it('returns zero health delta', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      const result = enemy.onTick(1000, board);
      expect(result.healthDelta).toBe(0);
    });

    it('returns zero time delta', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      const result = enemy.onTick(1000, board);
      expect(result.timeDelta).toBe(0);
    });

    it('returns no cards to remove', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      const result = enemy.onTick(1000, board);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns no card modifications', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      const result = enemy.onTick(1000, board);
      expect(result.cardModifications).toEqual([]);
    });

    it('returns no cards to flip', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      const result = enemy.onTick(1000, board);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns no events', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      const result = enemy.onTick(1000, board);
      expect(result.events).toEqual([]);
    });

    it('does not cause instant death', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      const result = enemy.onTick(1000, board);
      expect(result.instantDeath).toBe(false);
    });

    it('handles long time deltas gracefully', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      const result = enemy.onTick(60000, board); // 60 seconds
      expect(result.healthDelta).toBe(0);
      expect(result.instantDeath).toBe(false);
    });

    it('handles zero time delta', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      const result = enemy.onTick(0, board);
      expect(result.healthDelta).toBe(0);
    });

    it('handles small time deltas', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      const result = enemy.onTick(16, board); // ~60fps frame
      expect(result.healthDelta).toBe(0);
    });

    it('handles multiple tick calls', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      for (let i = 0; i < 100; i++) {
        const result = enemy.onTick(100, board);
        expect(result.healthDelta).toBe(0);
      }
    });
  });

  // ===========================================================================
  // LIFECYCLE HOOKS - onValidMatch
  // ===========================================================================

  describe('onValidMatch', () => {
    it('returns zero time delta', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      const matchedCards = [board[0], board[1], board[2]];
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.timeDelta).toBe(0);
    });

    it('returns neutral points multiplier (1)', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      const matchedCards = [board[0], board[1], board[2]];
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('returns no cards to remove', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      const matchedCards = [board[0], board[1], board[2]];
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns no cards to flip', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      const matchedCards = [board[0], board[1], board[2]];
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns no events', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      const matchedCards = [board[0], board[1], board[2]];
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.events).toEqual([]);
    });

    it('handles empty matched cards array', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      const result = enemy.onValidMatch([], board);
      expect(result.timeDelta).toBe(0);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('handles varied board with match', () => {
      const enemy = createDivingHawk();
      const board = createVariedBoard();
      const matchedCards = [board[0], board[3], board[6]];
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.pointsMultiplier).toBe(1);
    });
  });

  // ===========================================================================
  // LIFECYCLE HOOKS - onInvalidMatch
  // ===========================================================================

  describe('onInvalidMatch', () => {
    it('returns zero time delta', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      const invalidCards = [board[0], board[1], board[2]];
      const result = enemy.onInvalidMatch(invalidCards, board);
      expect(result.timeDelta).toBe(0);
    });

    it('returns neutral points multiplier (1)', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      const invalidCards = [board[0], board[1], board[2]];
      const result = enemy.onInvalidMatch(invalidCards, board);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('returns no cards to remove', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      const invalidCards = [board[0], board[1], board[2]];
      const result = enemy.onInvalidMatch(invalidCards, board);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns no cards to flip', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      const invalidCards = [board[0], board[1], board[2]];
      const result = enemy.onInvalidMatch(invalidCards, board);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns no events', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      const invalidCards = [board[0], board[1], board[2]];
      const result = enemy.onInvalidMatch(invalidCards, board);
      expect(result.events).toEqual([]);
    });

    it('handles empty cards array', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      const result = enemy.onInvalidMatch([], board);
      expect(result.timeDelta).toBe(0);
      expect(result.pointsMultiplier).toBe(1);
    });
  });

  // ===========================================================================
  // LIFECYCLE HOOKS - onCardDraw
  // ===========================================================================

  describe('onCardDraw', () => {
    it('returns unmodified card', () => {
      const enemy = createDivingHawk();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result).toEqual(card);
    });

    it('does not add dud property', () => {
      const enemy = createDivingHawk();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isDud).toBeUndefined();
    });

    it('does not add face-down property', () => {
      const enemy = createDivingHawk();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isFaceDown).toBeUndefined();
    });

    it('does not add bomb property', () => {
      const enemy = createDivingHawk();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.hasBomb).toBeUndefined();
    });

    it('does not add countdown property', () => {
      const enemy = createDivingHawk();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.hasCountdown).toBeUndefined();
    });

    it('preserves card shape', () => {
      const enemy = createDivingHawk();
      const card = createCard({ shape: 'squiggle' });
      const result = enemy.onCardDraw(card);
      expect(result.shape).toBe('squiggle');
    });

    it('preserves card color', () => {
      const enemy = createDivingHawk();
      const card = createCard({ color: 'purple' });
      const result = enemy.onCardDraw(card);
      expect(result.color).toBe('purple');
    });

    it('preserves card number', () => {
      const enemy = createDivingHawk();
      const card = createCard({ number: 3 });
      const result = enemy.onCardDraw(card);
      expect(result.number).toBe(3);
    });

    it('preserves card shading', () => {
      const enemy = createDivingHawk();
      const card = createCard({ shading: 'striped' });
      const result = enemy.onCardDraw(card);
      expect(result.shading).toBe('striped');
    });

    it('preserves card id', () => {
      const enemy = createDivingHawk();
      const card = createCard({ id: 'unique-id-123' });
      const result = enemy.onCardDraw(card);
      expect(result.id).toBe('unique-id-123');
    });

    it('handles card with existing properties', () => {
      const enemy = createDivingHawk();
      const card = createCard({ onFire: true });
      const result = enemy.onCardDraw(card);
      expect(result.onFire).toBe(true);
    });
  });

  // ===========================================================================
  // LIFECYCLE HOOKS - onRoundEnd
  // ===========================================================================

  describe('onRoundEnd', () => {
    it('completes without error', () => {
      const enemy = createDivingHawk();
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('returns undefined', () => {
      const enemy = createDivingHawk();
      const result = enemy.onRoundEnd();
      expect(result).toBeUndefined();
    });

    it('can be called multiple times', () => {
      const enemy = createDivingHawk();
      expect(() => {
        enemy.onRoundEnd();
        enemy.onRoundEnd();
        enemy.onRoundEnd();
      }).not.toThrow();
    });

    it('timer speed persists after round end', () => {
      const enemy = createDivingHawk();
      enemy.onRoundEnd();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBe(1.35);
    });
  });

  // ===========================================================================
  // UI MODIFIERS
  // ===========================================================================

  describe('getUIModifiers', () => {
    it('includes timer speed multiplier', () => {
      const enemy = createDivingHawk();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBeDefined();
    });

    it('does not include inactivity bar', () => {
      const enemy = createDivingHawk();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.showInactivityBar).toBeUndefined();
    });

    it('does not include score decay', () => {
      const enemy = createDivingHawk();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.showScoreDecay).toBeUndefined();
    });

    it('does not disable auto hint', () => {
      const enemy = createDivingHawk();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.disableAutoHint).toBeUndefined();
    });

    it('does not disable manual hint', () => {
      const enemy = createDivingHawk();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.disableManualHint).toBeUndefined();
    });

    it('does not show countdown cards', () => {
      const enemy = createDivingHawk();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.showCountdownCards).toBeUndefined();
    });

    it('does not show bomb cards', () => {
      const enemy = createDivingHawk();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.showBombCards).toBeUndefined();
    });

    it('does not include weapon counters', () => {
      const enemy = createDivingHawk();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.weaponCounters).toBeUndefined();
    });
  });

  // ===========================================================================
  // STAT MODIFIERS
  // ===========================================================================

  describe('getStatModifiers', () => {
    it('returns empty object (no stat modifiers)', () => {
      const enemy = createDivingHawk();
      const statMods = enemy.getStatModifiers();
      expect(Object.keys(statMods).length).toBe(0);
    });

    it('does not reduce fire spread chance', () => {
      const enemy = createDivingHawk();
      const statMods = enemy.getStatModifiers();
      expect(statMods.fireSpreadChanceReduction).toBeUndefined();
    });

    it('does not reduce explosion chance', () => {
      const enemy = createDivingHawk();
      const statMods = enemy.getStatModifiers();
      expect(statMods.explosionChanceReduction).toBeUndefined();
    });

    it('does not reduce laser chance', () => {
      const enemy = createDivingHawk();
      const statMods = enemy.getStatModifiers();
      expect(statMods.laserChanceReduction).toBeUndefined();
    });

    it('does not reduce hint gain chance', () => {
      const enemy = createDivingHawk();
      const statMods = enemy.getStatModifiers();
      expect(statMods.hintGainChanceReduction).toBeUndefined();
    });

    it('does not reduce grace gain chance', () => {
      const enemy = createDivingHawk();
      const statMods = enemy.getStatModifiers();
      expect(statMods.graceGainChanceReduction).toBeUndefined();
    });

    it('does not reduce time gain chance', () => {
      const enemy = createDivingHawk();
      const statMods = enemy.getStatModifiers();
      expect(statMods.timeGainChanceReduction).toBeUndefined();
    });

    it('does not reduce healing chance', () => {
      const enemy = createDivingHawk();
      const statMods = enemy.getStatModifiers();
      expect(statMods.healingChanceReduction).toBeUndefined();
    });

    it('does not modify damage multiplier', () => {
      const enemy = createDivingHawk();
      const statMods = enemy.getStatModifiers();
      expect(statMods.damageMultiplier).toBeUndefined();
    });

    it('does not modify points multiplier', () => {
      const enemy = createDivingHawk();
      const statMods = enemy.getStatModifiers();
      expect(statMods.pointsMultiplier).toBeUndefined();
    });
  });

  // ===========================================================================
  // INTEGRATION TESTS
  // ===========================================================================

  describe('integration scenarios', () => {
    it('full round lifecycle completes without error', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();

      // Start round
      const startResult = enemy.onRoundStart(board);
      expect(startResult).toBeDefined();

      // Simulate several ticks
      for (let i = 0; i < 10; i++) {
        const tickResult = enemy.onTick(100, board);
        expect(tickResult).toBeDefined();
      }

      // Make a match
      const matchResult = enemy.onValidMatch([board[0], board[1], board[2]], board);
      expect(matchResult).toBeDefined();

      // Draw new card
      const newCard = createCard({ id: 'new-card' });
      const drawnCard = enemy.onCardDraw(newCard);
      expect(drawnCard).toBeDefined();

      // End round
      enemy.onRoundEnd();
    });

    it('defeat condition progresses correctly through round', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      enemy.onRoundStart(board);

      // 0 matches
      let stats = createRoundStats({ allDifferentMatches: 0 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);

      // 1 match
      enemy.onValidMatch([board[0], board[1], board[2]], board);
      stats = createRoundStats({ allDifferentMatches: 1 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);

      // 2 matches
      enemy.onValidMatch([board[3], board[4], board[5]], board);
      stats = createRoundStats({ allDifferentMatches: 2 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);

      // 3 matches - defeat condition met!
      enemy.onValidMatch([board[6], board[7], board[8]], board);
      stats = createRoundStats({ allDifferentMatches: 3 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('timer speed remains constant throughout round', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();

      // Check at start
      let uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBe(1.35);

      // Check after round start
      enemy.onRoundStart(board);
      uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBe(1.35);

      // Check after multiple ticks
      for (let i = 0; i < 50; i++) {
        enemy.onTick(100, board);
      }
      uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBe(1.35);

      // Check after match
      enemy.onValidMatch([board[0], board[1], board[2]], board);
      uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBe(1.35);

      // Check after round end
      enemy.onRoundEnd();
      uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBe(1.35);
    });

    it('multiple enemy instances are independent', () => {
      const enemy1 = createDivingHawk();
      const enemy2 = createDivingHawk();

      const board1 = createTestBoard();
      const board2 = createTestBoard();

      enemy1.onRoundStart(board1);
      enemy2.onRoundStart(board2);

      // Make matches on enemy1 only
      enemy1.onValidMatch([board1[0], board1[1], board1[2]], board1);

      // Both should still have same timer speed
      expect(enemy1.getUIModifiers().timerSpeedMultiplier).toBe(1.35);
      expect(enemy2.getUIModifiers().timerSpeedMultiplier).toBe(1.35);

      // Both should still have independent defeat condition checking
      const stats1 = createRoundStats({ allDifferentMatches: 3 });
      const stats2 = createRoundStats({ allDifferentMatches: 2 });
      expect(enemy1.checkDefeatCondition(stats1)).toBe(true);
      expect(enemy2.checkDefeatCondition(stats2)).toBe(false);
    });

    it('handles special card types gracefully', () => {
      const enemy = createDivingHawk();
      const board: Card[] = [
        createFaceDownCard({ id: 'fd-1' }),
        createTripleCard({ id: 'tc-1' }),
        createCard({ id: 'normal-1', onFire: true }),
        ...createTestBoard(9),
      ];

      const startResult = enemy.onRoundStart(board);
      expect(startResult.cardModifications).toEqual([]);

      // Tick with special cards
      const tickResult = enemy.onTick(1000, board);
      expect(tickResult.healthDelta).toBe(0);

      // Match with special cards
      const matchResult = enemy.onValidMatch(
        [board[0], board[1], board[2]],
        board
      );
      expect(matchResult.pointsMultiplier).toBe(1);
    });
  });

  // ===========================================================================
  // FACTORY BEHAVIOR TESTS
  // ===========================================================================

  describe('factory behavior', () => {
    it('creates a new instance each time', () => {
      const enemy1 = createDivingHawk();
      const enemy2 = createDivingHawk();
      expect(enemy1).not.toBe(enemy2);
    });

    it('instances have same metadata', () => {
      const enemy1 = createDivingHawk();
      const enemy2 = createDivingHawk();
      expect(enemy1.name).toBe(enemy2.name);
      expect(enemy1.tier).toBe(enemy2.tier);
      expect(enemy1.icon).toBe(enemy2.icon);
      expect(enemy1.description).toBe(enemy2.description);
      expect(enemy1.defeatConditionText).toBe(enemy2.defeatConditionText);
    });

    it('instances have same timer speed', () => {
      const enemy1 = createDivingHawk();
      const enemy2 = createDivingHawk();
      expect(enemy1.getUIModifiers().timerSpeedMultiplier).toBe(
        enemy2.getUIModifiers().timerSpeedMultiplier
      );
    });

    it('instances have identical defeat condition behavior', () => {
      const enemy1 = createDivingHawk();
      const enemy2 = createDivingHawk();

      for (let i = 0; i <= 5; i++) {
        const stats = createRoundStats({ allDifferentMatches: i });
        expect(enemy1.checkDefeatCondition(stats)).toBe(
          enemy2.checkDefeatCondition(stats)
        );
      }
    });
  });
});
