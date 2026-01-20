/**
 * Comprehensive Unit Tests for Cackling Hyena Enemy
 *
 * Cackling Hyena is a Tier 2 enemy with:
 * - Effect 1: TimeStealEffect - steals 3 seconds per valid match
 * - Effect 2: WeaponCounterEffect - reduces grace gain by 35%
 * - Defeat Condition: Match 6 times with no grace used
 */

import { createCacklingHyena } from '@/utils/enemies/tier2/cacklingHyena';
import { createRoundStats, createCard, createTestBoard, resetCardIdCounter } from '../../testUtils';
import type { Card } from '@/types';

beforeEach(() => {
  resetCardIdCounter();
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Cackling Hyena', () => {
  // ==========================================================================
  // METADATA TESTS
  // ==========================================================================
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createCacklingHyena();
      expect(enemy.name).toBe('Cackling Hyena');
    });

    it('has tier 2', () => {
      const enemy = createCacklingHyena();
      expect(enemy.tier).toBe(2);
    });

    it('has correct icon', () => {
      const enemy = createCacklingHyena();
      expect(enemy.icon).toBe('caro-asercion/hyena-head');
    });

    it('has description containing time steal info', () => {
      const enemy = createCacklingHyena();
      expect(enemy.description).toContain('-3s');
    });

    it('has description containing match keyword', () => {
      const enemy = createCacklingHyena();
      expect(enemy.description.toLowerCase()).toContain('match');
    });

    it('has description containing grace reduction info', () => {
      const enemy = createCacklingHyena();
      expect(enemy.description).toContain('35%');
    });

    it('has description containing grace keyword', () => {
      const enemy = createCacklingHyena();
      expect(enemy.description.toLowerCase()).toContain('grace');
    });

    it('has defeat condition text mentioning 6 matches', () => {
      const enemy = createCacklingHyena();
      expect(enemy.defeatConditionText).toContain('6');
    });

    it('has defeat condition text mentioning match', () => {
      const enemy = createCacklingHyena();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('match');
    });

    it('has defeat condition text mentioning grace', () => {
      const enemy = createCacklingHyena();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('grace');
    });

    it('has defeat condition text mentioning no grace used', () => {
      const enemy = createCacklingHyena();
      const text = enemy.defeatConditionText.toLowerCase();
      expect(text).toMatch(/no\s+grace/);
    });
  });

  // ==========================================================================
  // TIME STEAL EFFECT TESTS
  // ==========================================================================
  describe('time steal effect', () => {
    it('steals exactly 3 seconds on valid match', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      const result = enemy.onValidMatch(matchedCards, board);

      expect(result.timeDelta).toBe(-3);
    });

    it('emits time_stolen event with correct amount', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      const result = enemy.onValidMatch(matchedCards, board);

      expect(result.events).toContainEqual({
        type: 'time_stolen',
        amount: 3,
      });
    });

    it('steals time consistently on multiple consecutive matches', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      // First match
      const result1 = enemy.onValidMatch(matchedCards, board);
      expect(result1.timeDelta).toBe(-3);

      // Second match
      const result2 = enemy.onValidMatch(matchedCards, board);
      expect(result2.timeDelta).toBe(-3);

      // Third match
      const result3 = enemy.onValidMatch(matchedCards, board);
      expect(result3.timeDelta).toBe(-3);
    });

    it('always emits time_stolen event on valid match', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      // Run multiple times to ensure consistency
      for (let i = 0; i < 5; i++) {
        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.events.some((e) => e.type === 'time_stolen')).toBe(true);
      }
    });

    it('does not affect points multiplier', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      const result = enemy.onValidMatch(matchedCards, board);

      expect(result.pointsMultiplier).toBe(1);
    });

    it('does not remove extra cards on valid match', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      const result = enemy.onValidMatch(matchedCards, board);

      expect(result.cardsToRemove).toEqual([]);
    });

    it('does not flip any cards on valid match', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      const result = enemy.onValidMatch(matchedCards, board);

      expect(result.cardsToFlip).toEqual([]);
    });

    it('steals time regardless of matched card types', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);

      // Match with different card configurations
      const configs = [
        { shape: 'oval', color: 'red', number: 1 } as const,
        { shape: 'diamond', color: 'green', number: 2 } as const,
        { shape: 'squiggle', color: 'purple', number: 3 } as const,
      ];

      for (const config of configs) {
        const card = createCard(config);
        const result = enemy.onValidMatch([card, card, card], board);
        expect(result.timeDelta).toBe(-3);
      }
    });
  });

  // ==========================================================================
  // GRACE COUNTER EFFECT TESTS
  // ==========================================================================
  describe('grace counter effect', () => {
    it('reduces grace gain by exactly 35%', () => {
      const enemy = createCacklingHyena();
      const statMods = enemy.getStatModifiers();
      expect(statMods.graceGainChanceReduction).toBe(35);
    });

    it('shows weapon counter in UI with type grace', () => {
      const enemy = createCacklingHyena();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.weaponCounters).toBeDefined();
      expect(uiMods.weaponCounters).toContainEqual({ type: 'grace', reduction: 35 });
    });

    it('does not reduce fire spread chance', () => {
      const enemy = createCacklingHyena();
      const statMods = enemy.getStatModifiers();
      expect(statMods.fireSpreadChanceReduction).toBeUndefined();
    });

    it('does not reduce explosion chance', () => {
      const enemy = createCacklingHyena();
      const statMods = enemy.getStatModifiers();
      expect(statMods.explosionChanceReduction).toBeUndefined();
    });

    it('does not reduce laser chance', () => {
      const enemy = createCacklingHyena();
      const statMods = enemy.getStatModifiers();
      expect(statMods.laserChanceReduction).toBeUndefined();
    });

    it('does not reduce hint gain chance', () => {
      const enemy = createCacklingHyena();
      const statMods = enemy.getStatModifiers();
      expect(statMods.hintGainChanceReduction).toBeUndefined();
    });

    it('does not reduce time gain chance', () => {
      const enemy = createCacklingHyena();
      const statMods = enemy.getStatModifiers();
      expect(statMods.timeGainChanceReduction).toBeUndefined();
    });

    it('does not reduce healing chance', () => {
      const enemy = createCacklingHyena();
      const statMods = enemy.getStatModifiers();
      expect(statMods.healingChanceReduction).toBeUndefined();
    });

    it('does not modify damage multiplier', () => {
      const enemy = createCacklingHyena();
      const statMods = enemy.getStatModifiers();
      expect(statMods.damageMultiplier).toBeUndefined();
    });

    it('does not modify points multiplier in stat modifiers', () => {
      const enemy = createCacklingHyena();
      const statMods = enemy.getStatModifiers();
      expect(statMods.pointsMultiplier).toBeUndefined();
    });

    it('weapon counter has correct reduction value', () => {
      const enemy = createCacklingHyena();
      const uiMods = enemy.getUIModifiers();
      const graceCounter = uiMods.weaponCounters?.find((c) => c.type === 'grace');
      expect(graceCounter?.reduction).toBe(35);
    });

    it('has exactly one weapon counter', () => {
      const enemy = createCacklingHyena();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.weaponCounters).toHaveLength(1);
    });
  });

  // ==========================================================================
  // INVALID MATCH BEHAVIOR TESTS
  // ==========================================================================
  describe('invalid match behavior', () => {
    it('does not steal time on invalid match', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);
      const invalidCards = [board[0], board[1], board[2]];

      const result = enemy.onInvalidMatch(invalidCards, board);

      expect(result.timeDelta).toBe(0);
    });

    it('does not emit time_stolen event on invalid match', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);
      const invalidCards = [board[0], board[1], board[2]];

      const result = enemy.onInvalidMatch(invalidCards, board);

      expect(result.events).not.toContainEqual(
        expect.objectContaining({ type: 'time_stolen' })
      );
    });

    it('does not affect points multiplier on invalid match', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);
      const invalidCards = [board[0], board[1], board[2]];

      const result = enemy.onInvalidMatch(invalidCards, board);

      expect(result.pointsMultiplier).toBe(1);
    });

    it('does not remove extra cards on invalid match', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);
      const invalidCards = [board[0], board[1], board[2]];

      const result = enemy.onInvalidMatch(invalidCards, board);

      expect(result.cardsToRemove).toEqual([]);
    });

    it('does not flip cards on invalid match', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);
      const invalidCards = [board[0], board[1], board[2]];

      const result = enemy.onInvalidMatch(invalidCards, board);

      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events array on invalid match', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);
      const invalidCards = [board[0], board[1], board[2]];

      const result = enemy.onInvalidMatch(invalidCards, board);

      expect(result.events).toEqual([]);
    });
  });

  // ==========================================================================
  // DEFEAT CONDITION TESTS
  // ==========================================================================
  describe('defeat condition', () => {
    describe('match count requirements', () => {
      it('returns false when totalMatches is 0', () => {
        const enemy = createCacklingHyena();
        const stats = createRoundStats({ totalMatches: 0, gracesUsed: 0 });

        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when totalMatches is 1', () => {
        const enemy = createCacklingHyena();
        const stats = createRoundStats({ totalMatches: 1, gracesUsed: 0 });

        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when totalMatches is 2', () => {
        const enemy = createCacklingHyena();
        const stats = createRoundStats({ totalMatches: 2, gracesUsed: 0 });

        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when totalMatches is 3', () => {
        const enemy = createCacklingHyena();
        const stats = createRoundStats({ totalMatches: 3, gracesUsed: 0 });

        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when totalMatches is 4', () => {
        const enemy = createCacklingHyena();
        const stats = createRoundStats({ totalMatches: 4, gracesUsed: 0 });

        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when totalMatches is 5 (threshold - 1)', () => {
        const enemy = createCacklingHyena();
        const stats = createRoundStats({ totalMatches: 5, gracesUsed: 0 });

        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true when totalMatches is exactly 6 (threshold)', () => {
        const enemy = createCacklingHyena();
        const stats = createRoundStats({ totalMatches: 6, gracesUsed: 0 });

        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when totalMatches is 7 (above threshold)', () => {
        const enemy = createCacklingHyena();
        const stats = createRoundStats({ totalMatches: 7, gracesUsed: 0 });

        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when totalMatches is 10 (well above threshold)', () => {
        const enemy = createCacklingHyena();
        const stats = createRoundStats({ totalMatches: 10, gracesUsed: 0 });

        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when totalMatches is 100 (extreme case)', () => {
        const enemy = createCacklingHyena();
        const stats = createRoundStats({ totalMatches: 100, gracesUsed: 0 });

        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('grace requirement', () => {
      it('returns false when grace was used once with 6 matches', () => {
        const enemy = createCacklingHyena();
        const stats = createRoundStats({ totalMatches: 6, gracesUsed: 1 });

        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when multiple graces were used with 6 matches', () => {
        const enemy = createCacklingHyena();
        const stats = createRoundStats({ totalMatches: 6, gracesUsed: 2 });

        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when many graces were used with many matches', () => {
        const enemy = createCacklingHyena();
        const stats = createRoundStats({ totalMatches: 20, gracesUsed: 5 });

        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when grace was used with 100 matches', () => {
        const enemy = createCacklingHyena();
        const stats = createRoundStats({ totalMatches: 100, gracesUsed: 1 });

        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true with 0 graces used and exactly 6 matches', () => {
        const enemy = createCacklingHyena();
        const stats = createRoundStats({ totalMatches: 6, gracesUsed: 0 });

        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('combined conditions', () => {
      it('requires both conditions: 6+ matches AND 0 graces used', () => {
        const enemy = createCacklingHyena();

        // Case 1: 6 matches, 0 graces - should pass
        const stats1 = createRoundStats({ totalMatches: 6, gracesUsed: 0 });
        expect(enemy.checkDefeatCondition(stats1)).toBe(true);

        // Case 2: 6 matches, 1 grace - should fail
        const stats2 = createRoundStats({ totalMatches: 6, gracesUsed: 1 });
        expect(enemy.checkDefeatCondition(stats2)).toBe(false);

        // Case 3: 5 matches, 0 graces - should fail
        const stats3 = createRoundStats({ totalMatches: 5, gracesUsed: 0 });
        expect(enemy.checkDefeatCondition(stats3)).toBe(false);

        // Case 4: 5 matches, 1 grace - should fail
        const stats4 = createRoundStats({ totalMatches: 5, gracesUsed: 1 });
        expect(enemy.checkDefeatCondition(stats4)).toBe(false);
      });

      it('ignores invalidMatches count for defeat condition', () => {
        const enemy = createCacklingHyena();
        const stats = createRoundStats({
          totalMatches: 6,
          gracesUsed: 0,
          invalidMatches: 10,
        });

        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores hintsUsed for defeat condition', () => {
        const enemy = createCacklingHyena();
        const stats = createRoundStats({
          totalMatches: 6,
          gracesUsed: 0,
          hintsUsed: 50,
        });

        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores current streak for defeat condition', () => {
        const enemy = createCacklingHyena();
        const stats = createRoundStats({
          totalMatches: 6,
          gracesUsed: 0,
          currentStreak: 100,
          maxStreak: 100,
        });

        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores damage received for defeat condition', () => {
        const enemy = createCacklingHyena();
        const stats = createRoundStats({
          totalMatches: 6,
          gracesUsed: 0,
          damageReceived: 10,
        });

        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('gracesRemaining does not affect defeat condition', () => {
        const enemy = createCacklingHyena();
        const stats = createRoundStats({
          totalMatches: 6,
          gracesUsed: 0,
          gracesRemaining: 0,
        });

        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('high gracesRemaining does not affect defeat condition', () => {
        const enemy = createCacklingHyena();
        const stats = createRoundStats({
          totalMatches: 6,
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
        const enemy = createCacklingHyena();
        const board = createTestBoard(12);

        const result = enemy.onRoundStart(board);

        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty events', () => {
        const enemy = createCacklingHyena();
        const board = createTestBoard(12);

        const result = enemy.onRoundStart(board);

        expect(result.events).toEqual([]);
      });

      it('does not modify any cards on the board', () => {
        const enemy = createCacklingHyena();
        const board = createTestBoard(12);
        const originalBoard = JSON.stringify(board);

        enemy.onRoundStart(board);

        expect(JSON.stringify(board)).toBe(originalBoard);
      });

      it('works with empty board', () => {
        const enemy = createCacklingHyena();
        const emptyBoard: Card[] = [];

        const result = enemy.onRoundStart(emptyBoard);

        expect(result.cardModifications).toEqual([]);
        expect(result.events).toEqual([]);
      });

      it('works with large board', () => {
        const enemy = createCacklingHyena();
        const largeBoard = createTestBoard(50);

        const result = enemy.onRoundStart(largeBoard);

        expect(result.cardModifications).toEqual([]);
        expect(result.events).toEqual([]);
      });
    });

    describe('onCardDraw', () => {
      it('returns the card unchanged', () => {
        const enemy = createCacklingHyena();
        const card = createCard({ shape: 'diamond', color: 'purple', number: 2 });

        const result = enemy.onCardDraw(card);

        expect(result).toEqual(card);
      });

      it('does not add dud property', () => {
        const enemy = createCacklingHyena();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result.isDud).toBeUndefined();
      });

      it('does not add face down property', () => {
        const enemy = createCacklingHyena();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result.isFaceDown).toBeUndefined();
      });

      it('does not add bomb property', () => {
        const enemy = createCacklingHyena();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result.hasBomb).toBeUndefined();
      });

      it('does not add countdown property', () => {
        const enemy = createCacklingHyena();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result.hasCountdown).toBeUndefined();
      });

      it('preserves existing card properties', () => {
        const enemy = createCacklingHyena();
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

      it('returns same card reference (no modification)', () => {
        const enemy = createCacklingHyena();
        const card = createCard();

        const result = enemy.onCardDraw(card);

        expect(result).toBe(card);
      });
    });

    describe('onTick', () => {
      it('returns zero score delta', () => {
        const enemy = createCacklingHyena();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.scoreDelta).toBe(0);
      });

      it('returns zero health delta', () => {
        const enemy = createCacklingHyena();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.healthDelta).toBe(0);
      });

      it('returns zero time delta', () => {
        const enemy = createCacklingHyena();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.timeDelta).toBe(0);
      });

      it('does not trigger instant death', () => {
        const enemy = createCacklingHyena();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.instantDeath).toBe(false);
      });

      it('returns empty cardsToRemove array', () => {
        const enemy = createCacklingHyena();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty cardModifications array', () => {
        const enemy = createCacklingHyena();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty cardsToFlip array', () => {
        const enemy = createCacklingHyena();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events array', () => {
        const enemy = createCacklingHyena();
        const board = createTestBoard(12);

        const result = enemy.onTick(100, board);

        expect(result.events).toEqual([]);
      });

      it('remains consistent over many ticks', () => {
        const enemy = createCacklingHyena();
        const board = createTestBoard(12);

        // Simulate 60 seconds of gameplay (600 ticks at 100ms each)
        for (let i = 0; i < 600; i++) {
          const result = enemy.onTick(100, board);
          expect(result.healthDelta).toBe(0);
          expect(result.instantDeath).toBe(false);
          expect(result.scoreDelta).toBe(0);
        }
      });

      it('handles small delta values', () => {
        const enemy = createCacklingHyena();
        const board = createTestBoard(12);

        const result = enemy.onTick(1, board);

        expect(result.healthDelta).toBe(0);
        expect(result.instantDeath).toBe(false);
      });

      it('handles large delta values', () => {
        const enemy = createCacklingHyena();
        const board = createTestBoard(12);

        const result = enemy.onTick(60000, board);

        expect(result.healthDelta).toBe(0);
        expect(result.instantDeath).toBe(false);
      });

      it('handles zero delta', () => {
        const enemy = createCacklingHyena();
        const board = createTestBoard(12);

        const result = enemy.onTick(0, board);

        expect(result.healthDelta).toBe(0);
        expect(result.instantDeath).toBe(false);
      });
    });

    describe('onRoundEnd', () => {
      it('executes without error', () => {
        const enemy = createCacklingHyena();

        expect(() => enemy.onRoundEnd()).not.toThrow();
      });

      it('can be called multiple times without issue', () => {
        const enemy = createCacklingHyena();

        expect(() => {
          enemy.onRoundEnd();
          enemy.onRoundEnd();
          enemy.onRoundEnd();
        }).not.toThrow();
      });

      it('can be called after onRoundStart', () => {
        const enemy = createCacklingHyena();
        const board = createTestBoard(12);

        enemy.onRoundStart(board);

        expect(() => enemy.onRoundEnd()).not.toThrow();
      });

      it('can be called after multiple matches', () => {
        const enemy = createCacklingHyena();
        const board = createTestBoard(12);
        const matchedCards = [board[0], board[1], board[2]];

        enemy.onRoundStart(board);
        enemy.onValidMatch(matchedCards, board);
        enemy.onValidMatch(matchedCards, board);

        expect(() => enemy.onRoundEnd()).not.toThrow();
      });
    });
  });

  // ==========================================================================
  // UI MODIFIERS TESTS
  // ==========================================================================
  describe('UI modifiers', () => {
    it('returns object with weaponCounters', () => {
      const enemy = createCacklingHyena();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.weaponCounters).toBeDefined();
    });

    it('does not show inactivity bar', () => {
      const enemy = createCacklingHyena();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showInactivityBar).toBeUndefined();
    });

    it('does not show score decay', () => {
      const enemy = createCacklingHyena();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showScoreDecay).toBeUndefined();
    });

    it('does not modify timer speed', () => {
      const enemy = createCacklingHyena();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.timerSpeedMultiplier).toBeUndefined();
    });

    it('does not disable auto hint', () => {
      const enemy = createCacklingHyena();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.disableAutoHint).toBeUndefined();
    });

    it('does not disable manual hint', () => {
      const enemy = createCacklingHyena();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.disableManualHint).toBeUndefined();
    });

    it('does not show countdown cards', () => {
      const enemy = createCacklingHyena();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showCountdownCards).toBeUndefined();
    });

    it('does not show bomb cards', () => {
      const enemy = createCacklingHyena();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showBombCards).toBeUndefined();
    });

    it('weapon counters array contains grace counter', () => {
      const enemy = createCacklingHyena();

      const modifiers = enemy.getUIModifiers();
      const graceCounter = modifiers.weaponCounters?.find((c) => c.type === 'grace');

      expect(graceCounter).toBeDefined();
      expect(graceCounter?.type).toBe('grace');
      expect(graceCounter?.reduction).toBe(35);
    });

    it('weapon counters does not contain fire counter', () => {
      const enemy = createCacklingHyena();

      const modifiers = enemy.getUIModifiers();
      const fireCounter = modifiers.weaponCounters?.find((c) => c.type === 'fire');

      expect(fireCounter).toBeUndefined();
    });

    it('weapon counters does not contain explosion counter', () => {
      const enemy = createCacklingHyena();

      const modifiers = enemy.getUIModifiers();
      const explosionCounter = modifiers.weaponCounters?.find((c) => c.type === 'explosion');

      expect(explosionCounter).toBeUndefined();
    });
  });

  // ==========================================================================
  // STAT MODIFIERS TESTS
  // ==========================================================================
  describe('stat modifiers', () => {
    it('returns graceGainChanceReduction of 35', () => {
      const enemy = createCacklingHyena();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.graceGainChanceReduction).toBe(35);
    });

    it('does not modify fire spread chance', () => {
      const enemy = createCacklingHyena();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
    });

    it('does not modify explosion chance', () => {
      const enemy = createCacklingHyena();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.explosionChanceReduction).toBeUndefined();
    });

    it('does not modify laser chance', () => {
      const enemy = createCacklingHyena();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.laserChanceReduction).toBeUndefined();
    });

    it('does not modify hint gain chance', () => {
      const enemy = createCacklingHyena();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.hintGainChanceReduction).toBeUndefined();
    });

    it('does not modify time gain chance', () => {
      const enemy = createCacklingHyena();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.timeGainChanceReduction).toBeUndefined();
    });

    it('does not modify healing chance', () => {
      const enemy = createCacklingHyena();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.healingChanceReduction).toBeUndefined();
    });

    it('does not set damage multiplier', () => {
      const enemy = createCacklingHyena();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.damageMultiplier).toBeUndefined();
    });

    it('does not set points multiplier', () => {
      const enemy = createCacklingHyena();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.pointsMultiplier).toBeUndefined();
    });

    it('stat modifiers are consistent across multiple calls', () => {
      const enemy = createCacklingHyena();

      const modifiers1 = enemy.getStatModifiers();
      const modifiers2 = enemy.getStatModifiers();
      const modifiers3 = enemy.getStatModifiers();

      expect(modifiers1.graceGainChanceReduction).toBe(modifiers2.graceGainChanceReduction);
      expect(modifiers2.graceGainChanceReduction).toBe(modifiers3.graceGainChanceReduction);
    });
  });

  // ==========================================================================
  // EDGE CASE TESTS
  // ==========================================================================
  describe('edge cases', () => {
    it('handles empty board on valid match', () => {
      const enemy = createCacklingHyena();
      const emptyBoard: Card[] = [];
      const matchedCards = [createCard(), createCard(), createCard()];

      const result = enemy.onValidMatch(matchedCards, emptyBoard);

      expect(result.timeDelta).toBe(-3);
    });

    it('handles empty matched cards array', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);

      const result = enemy.onValidMatch([], board);

      expect(result.timeDelta).toBe(-3);
    });

    it('handles single matched card', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);

      const result = enemy.onValidMatch([board[0]], board);

      expect(result.timeDelta).toBe(-3);
    });

    it('handles large board on valid match', () => {
      const enemy = createCacklingHyena();
      const largeBoard = createTestBoard(100);
      const matchedCards = [largeBoard[0], largeBoard[1], largeBoard[2]];

      const result = enemy.onValidMatch(matchedCards, largeBoard);

      expect(result.timeDelta).toBe(-3);
    });

    it('handles empty board on invalid match', () => {
      const enemy = createCacklingHyena();
      const emptyBoard: Card[] = [];
      const invalidCards = [createCard(), createCard(), createCard()];

      const result = enemy.onInvalidMatch(invalidCards, emptyBoard);

      expect(result.timeDelta).toBe(0);
    });

    it('maintains state across round restart', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);

      // First round
      enemy.onRoundStart(board);
      const result1 = enemy.onValidMatch([board[0], board[1], board[2]], board);
      enemy.onRoundEnd();

      // Second round
      enemy.onRoundStart(board);
      const result2 = enemy.onValidMatch([board[0], board[1], board[2]], board);

      expect(result1.timeDelta).toBe(-3);
      expect(result2.timeDelta).toBe(-3);
    });

    it('creates fresh instances each time', () => {
      const enemy1 = createCacklingHyena();
      const enemy2 = createCacklingHyena();

      // Modify enemy1 state
      enemy1.onRoundStart(createTestBoard(12));
      enemy1.onValidMatch([], []);

      // enemy2 should be independent
      expect(enemy2.name).toBe('Cackling Hyena');
      expect(enemy2.tier).toBe(2);
    });

    it('handles cards with special properties', () => {
      const enemy = createCacklingHyena();
      const specialCards = [
        createCard({ onFire: true }),
        createCard({ isFaceDown: true }),
        createCard({ hasBomb: true }),
      ];
      const board = createTestBoard(12);

      const result = enemy.onValidMatch(specialCards, board);

      expect(result.timeDelta).toBe(-3);
    });

    it('handles board with special cards', () => {
      const enemy = createCacklingHyena();
      const board = [
        createCard({ onFire: true }),
        createCard({ isFaceDown: true }),
        createCard({ isDud: true }),
        ...createTestBoard(9),
      ];
      const matchedCards = [board[3], board[4], board[5]];

      const result = enemy.onValidMatch(matchedCards, board);

      expect(result.timeDelta).toBe(-3);
    });
  });

  // ==========================================================================
  // CUMULATIVE EFFECT TESTS
  // ==========================================================================
  describe('cumulative time steal', () => {
    it('steals 18 seconds total after 6 matches', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      let totalTimeStolen = 0;
      for (let i = 0; i < 6; i++) {
        const result = enemy.onValidMatch(matchedCards, board);
        totalTimeStolen += Math.abs(result.timeDelta);
      }

      expect(totalTimeStolen).toBe(18);
    });

    it('steals 30 seconds total after 10 matches', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      let totalTimeStolen = 0;
      for (let i = 0; i < 10; i++) {
        const result = enemy.onValidMatch(matchedCards, board);
        totalTimeStolen += Math.abs(result.timeDelta);
      }

      expect(totalTimeStolen).toBe(30);
    });

    it('emits exactly 6 time_stolen events for 6 matches', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      const allEvents: Array<{ type: string; amount?: number }> = [];
      for (let i = 0; i < 6; i++) {
        const result = enemy.onValidMatch(matchedCards, board);
        allEvents.push(...result.events);
      }

      const timeStolenEvents = allEvents.filter((e) => e.type === 'time_stolen');
      expect(timeStolenEvents).toHaveLength(6);
      expect(timeStolenEvents.every((e) => e.amount === 3)).toBe(true);
    });

    it('calculates correct time stolen with varied match patterns', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      // Simulate realistic gameplay: matches interspersed with invalid attempts
      let totalTimeStolen = 0;

      // 3 valid matches
      for (let i = 0; i < 3; i++) {
        const result = enemy.onValidMatch(matchedCards, board);
        totalTimeStolen += Math.abs(result.timeDelta);
      }

      // Invalid match (no time stolen)
      const invalidResult = enemy.onInvalidMatch(matchedCards, board);
      totalTimeStolen += Math.abs(invalidResult.timeDelta);

      // 3 more valid matches
      for (let i = 0; i < 3; i++) {
        const result = enemy.onValidMatch(matchedCards, board);
        totalTimeStolen += Math.abs(result.timeDelta);
      }

      // Should be 6 valid matches * 3 seconds = 18 seconds
      expect(totalTimeStolen).toBe(18);
    });
  });

  // ==========================================================================
  // COMBINED EFFECT INTEGRATION TESTS
  // ==========================================================================
  describe('combined effects integration', () => {
    it('both time steal and grace reduction work simultaneously', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];

      // Check time steal
      const matchResult = enemy.onValidMatch(matchedCards, board);
      expect(matchResult.timeDelta).toBe(-3);

      // Check grace reduction
      const statMods = enemy.getStatModifiers();
      expect(statMods.graceGainChanceReduction).toBe(35);

      // Check UI shows the counter
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.weaponCounters).toContainEqual({ type: 'grace', reduction: 35 });
    });

    it('effects remain stable after round reset', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard(12);

      // First round
      enemy.onRoundStart(board);
      for (let i = 0; i < 3; i++) {
        enemy.onValidMatch([board[0], board[1], board[2]], board);
      }
      enemy.onRoundEnd();

      // Second round - effects should still work
      enemy.onRoundStart(board);
      const matchResult = enemy.onValidMatch([board[0], board[1], board[2]], board);
      const statMods = enemy.getStatModifiers();

      expect(matchResult.timeDelta).toBe(-3);
      expect(statMods.graceGainChanceReduction).toBe(35);
    });

    it('defeat condition considers gracesUsed not graceGainChanceReduction', () => {
      const enemy = createCacklingHyena();

      // Grace reduction is applied (35%), but gracesUsed is 0
      // This should still allow defeat
      const stats = createRoundStats({
        totalMatches: 6,
        gracesUsed: 0,
        gracesRemaining: 5, // Player has graces but didn't use any
      });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  // ==========================================================================
  // FACTORY AND REGISTRATION TESTS
  // ==========================================================================
  describe('factory behavior', () => {
    it('creates new instance each call', () => {
      const enemy1 = createCacklingHyena();
      const enemy2 = createCacklingHyena();

      expect(enemy1).not.toBe(enemy2);
    });

    it('instances have independent state', () => {
      const enemy1 = createCacklingHyena();
      const enemy2 = createCacklingHyena();

      const board = createTestBoard(12);

      // Interact with enemy1
      enemy1.onRoundStart(board);
      enemy1.onValidMatch([board[0], board[1], board[2]], board);

      // enemy2 should be unaffected
      const result = enemy2.onValidMatch([board[0], board[1], board[2]], board);
      expect(result.timeDelta).toBe(-3);
    });

    it('returns properly typed EnemyInstance', () => {
      const enemy = createCacklingHyena();

      // Type checks - these would fail at compile time if types were wrong
      expect(typeof enemy.name).toBe('string');
      expect(typeof enemy.tier).toBe('number');
      expect(typeof enemy.icon).toBe('string');
      expect(typeof enemy.description).toBe('string');
      expect(typeof enemy.defeatConditionText).toBe('string');
      expect(typeof enemy.onRoundStart).toBe('function');
      expect(typeof enemy.onTick).toBe('function');
      expect(typeof enemy.onValidMatch).toBe('function');
      expect(typeof enemy.onInvalidMatch).toBe('function');
      expect(typeof enemy.onCardDraw).toBe('function');
      expect(typeof enemy.checkDefeatCondition).toBe('function');
      expect(typeof enemy.onRoundEnd).toBe('function');
      expect(typeof enemy.getUIModifiers).toBe('function');
      expect(typeof enemy.getStatModifiers).toBe('function');
    });
  });
});
