/**
 * Comprehensive Unit Tests for Masked Bandit Enemy
 *
 * Masked Bandit - Tier 1 Enemy
 * Effect: Disables auto-hints entirely (manual hints still work)
 * Defeat Condition: Get 3 matches without hesitating >10s (all first 3 under 10000ms)
 */

import { createMaskedBandit } from '@/utils/enemies/tier1/maskedBandit';
import {
  createRoundStats,
  createCard,
  createTestBoard,
  resetCardIdCounter,
} from '../../testUtils';

// Reset card IDs before each test for deterministic results
beforeEach(() => {
  resetCardIdCounter();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Masked Bandit', () => {
  // ==========================================================================
  // METADATA TESTS
  // ==========================================================================
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createMaskedBandit();
      expect(enemy.name).toBe('Masked Bandit');
    });

    it('has correct tier (Tier 1)', () => {
      const enemy = createMaskedBandit();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon', () => {
      const enemy = createMaskedBandit();
      expect(enemy.icon).toBe('delapouite/raccoon-head');
    });

    it('description contains "auto-hints"', () => {
      const enemy = createMaskedBandit();
      expect(enemy.description.toLowerCase()).toContain('auto-hints');
    });

    it('description contains "disables"', () => {
      const enemy = createMaskedBandit();
      expect(enemy.description.toLowerCase()).toContain('disable');
    });

    it('has correct defeatConditionText', () => {
      const enemy = createMaskedBandit();
      expect(enemy.defeatConditionText).toBe('Get 3 matches without hesitating >10s');
    });

    it('defeatConditionText mentions "3 matches"', () => {
      const enemy = createMaskedBandit();
      expect(enemy.defeatConditionText).toContain('3 matches');
    });

    it('defeatConditionText mentions "10s" time limit', () => {
      const enemy = createMaskedBandit();
      expect(enemy.defeatConditionText).toContain('10s');
    });
  });

  // ==========================================================================
  // EFFECT TESTS - HINT DISABLE
  // ==========================================================================
  describe('hint disable effect', () => {
    it('disables auto-hints via getUIModifiers', () => {
      const enemy = createMaskedBandit();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableAutoHint).toBe(true);
    });

    it('does NOT disable manual hints', () => {
      const enemy = createMaskedBandit();
      const modifiers = enemy.getUIModifiers();
      // Should be undefined or false, not true
      expect(modifiers.disableManualHint).toBeFalsy();
    });

    it('consistently returns same UI modifiers on multiple calls', () => {
      const enemy = createMaskedBandit();
      const modifiers1 = enemy.getUIModifiers();
      const modifiers2 = enemy.getUIModifiers();
      expect(modifiers1.disableAutoHint).toBe(modifiers2.disableAutoHint);
      expect(modifiers1.disableManualHint).toBe(modifiers2.disableManualHint);
    });

    it('UI modifiers are independent between enemy instances', () => {
      const enemy1 = createMaskedBandit();
      const enemy2 = createMaskedBandit();
      // Both should have same behavior (disabling auto-hints)
      expect(enemy1.getUIModifiers().disableAutoHint).toBe(true);
      expect(enemy2.getUIModifiers().disableAutoHint).toBe(true);
    });
  });

  // ==========================================================================
  // DEFEAT CONDITION TESTS
  // ==========================================================================
  describe('defeat condition', () => {
    describe('returns false when condition not met', () => {
      it('returns false with 0 matches', () => {
        const enemy = createMaskedBandit();
        const stats = createRoundStats({ matchTimes: [] });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false with 1 fast match', () => {
        const enemy = createMaskedBandit();
        const stats = createRoundStats({ matchTimes: [5000] });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false with 2 fast matches', () => {
        const enemy = createMaskedBandit();
        const stats = createRoundStats({ matchTimes: [5000, 3000] });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });

    describe('returns false at threshold - 1 (one match under requirement)', () => {
      it('returns false at exactly 2 matches (threshold is 3)', () => {
        const enemy = createMaskedBandit();
        const stats = createRoundStats({
          matchTimes: [1000, 2000], // Only 2 matches, both fast
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });

    describe('returns true at exact threshold', () => {
      it('returns true with exactly 3 fast matches at 9999ms each', () => {
        const enemy = createMaskedBandit();
        const stats = createRoundStats({
          matchTimes: [9999, 9999, 9999], // All just under 10s
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true with exactly 3 matches at varying fast times', () => {
        const enemy = createMaskedBandit();
        const stats = createRoundStats({
          matchTimes: [5000, 8000, 9000],
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true with 3 very fast matches', () => {
        const enemy = createMaskedBandit();
        const stats = createRoundStats({
          matchTimes: [1000, 1000, 1000], // 1 second each
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('returns true above threshold', () => {
      it('returns true with 4 fast matches', () => {
        const enemy = createMaskedBandit();
        const stats = createRoundStats({
          matchTimes: [5000, 3000, 8000, 4000],
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true with many fast matches', () => {
        const enemy = createMaskedBandit();
        const stats = createRoundStats({
          matchTimes: [5000, 3000, 8000, 2000, 1000, 4000],
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('only checks first 3 matches - slow 4th match does not affect result', () => {
        const enemy = createMaskedBandit();
        const stats = createRoundStats({
          matchTimes: [5000, 3000, 8000, 25000, 30000], // First 3 fast, later slow
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('time boundary edge cases', () => {
      it('returns false when any match is exactly 10000ms (not under 10s)', () => {
        const enemy = createMaskedBandit();
        const stats = createRoundStats({
          matchTimes: [5000, 10000, 3000],
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when first match is exactly 10s', () => {
        const enemy = createMaskedBandit();
        const stats = createRoundStats({
          matchTimes: [10000, 5000, 5000],
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when second match is exactly 10s', () => {
        const enemy = createMaskedBandit();
        const stats = createRoundStats({
          matchTimes: [5000, 10000, 5000],
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when third match is exactly 10s', () => {
        const enemy = createMaskedBandit();
        const stats = createRoundStats({
          matchTimes: [5000, 5000, 10000],
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true when third match is 9999ms (just under 10s)', () => {
        const enemy = createMaskedBandit();
        const stats = createRoundStats({
          matchTimes: [5000, 5000, 9999],
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns false when any match exceeds 10s', () => {
        const enemy = createMaskedBandit();
        const stats = createRoundStats({
          matchTimes: [5000, 15000, 3000],
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false if first match is slow even with fast later matches', () => {
        const enemy = createMaskedBandit();
        const stats = createRoundStats({
          matchTimes: [15000, 3000, 4000],
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });

    describe('edge case: zero timing', () => {
      it('returns true with all 0ms matches (instant)', () => {
        const enemy = createMaskedBandit();
        const stats = createRoundStats({
          matchTimes: [0, 0, 0],
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
      it('returns empty cardModifications array', () => {
        const enemy = createMaskedBandit();
        const board = createTestBoard(12);
        const result = enemy.onRoundStart(board);
        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty events array', () => {
        const enemy = createMaskedBandit();
        const board = createTestBoard(12);
        const result = enemy.onRoundStart(board);
        expect(result.events).toEqual([]);
      });

      it('does not modify the board', () => {
        const enemy = createMaskedBandit();
        const board = createTestBoard(12);
        const originalBoard = JSON.stringify(board);
        enemy.onRoundStart(board);
        expect(JSON.stringify(board)).toBe(originalBoard);
      });
    });

    describe('onTick', () => {
      it('returns zero scoreDelta', () => {
        const enemy = createMaskedBandit();
        const board = createTestBoard(12);
        const result = enemy.onTick(1000, board);
        expect(result.scoreDelta).toBe(0);
      });

      it('returns zero healthDelta', () => {
        const enemy = createMaskedBandit();
        const board = createTestBoard(12);
        const result = enemy.onTick(1000, board);
        expect(result.healthDelta).toBe(0);
      });

      it('returns zero timeDelta', () => {
        const enemy = createMaskedBandit();
        const board = createTestBoard(12);
        const result = enemy.onTick(1000, board);
        expect(result.timeDelta).toBe(0);
      });

      it('returns empty cardsToRemove array', () => {
        const enemy = createMaskedBandit();
        const board = createTestBoard(12);
        const result = enemy.onTick(1000, board);
        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty cardModifications array', () => {
        const enemy = createMaskedBandit();
        const board = createTestBoard(12);
        const result = enemy.onTick(1000, board);
        expect(result.cardModifications).toEqual([]);
      });

      it('returns false for instantDeath', () => {
        const enemy = createMaskedBandit();
        const board = createTestBoard(12);
        const result = enemy.onTick(1000, board);
        expect(result.instantDeath).toBe(false);
      });

      it('has consistent behavior across multiple ticks', () => {
        const enemy = createMaskedBandit();
        const board = createTestBoard(12);
        const result1 = enemy.onTick(1000, board);
        const result2 = enemy.onTick(5000, board);
        const result3 = enemy.onTick(15000, board);
        expect(result1.healthDelta).toBe(0);
        expect(result2.healthDelta).toBe(0);
        expect(result3.healthDelta).toBe(0);
      });
    });

    describe('onCardDraw', () => {
      it('returns unmodified card', () => {
        const enemy = createMaskedBandit();
        const card = createCard({ shape: 'oval', color: 'red', number: 1 });
        const result = enemy.onCardDraw(card);
        expect(result).toEqual(card);
      });

      it('preserves all card properties', () => {
        const enemy = createMaskedBandit();
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

      it('does not add face-down state', () => {
        const enemy = createMaskedBandit();
        const card = createCard();
        const result = enemy.onCardDraw(card);
        expect(result.isFaceDown).toBeFalsy();
      });

      it('does not add bomb state', () => {
        const enemy = createMaskedBandit();
        const card = createCard();
        const result = enemy.onCardDraw(card);
        expect(result.hasBomb).toBeFalsy();
      });

      it('does not add countdown state', () => {
        const enemy = createMaskedBandit();
        const card = createCard();
        const result = enemy.onCardDraw(card);
        expect(result.hasCountdown).toBeFalsy();
      });
    });

    describe('onValidMatch', () => {
      it('returns pointsMultiplier of 1 (no modification)', () => {
        const enemy = createMaskedBandit();
        const matchedCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.pointsMultiplier).toBe(1);
      });

      it('returns timeDelta of 0', () => {
        const enemy = createMaskedBandit();
        const matchedCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.timeDelta).toBe(0);
      });

      it('returns empty cardsToRemove array', () => {
        const enemy = createMaskedBandit();
        const matchedCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty events array', () => {
        const enemy = createMaskedBandit();
        const matchedCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.events).toEqual([]);
      });
    });

    describe('onInvalidMatch', () => {
      it('returns pointsMultiplier of 1', () => {
        const enemy = createMaskedBandit();
        const cards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onInvalidMatch(cards, board);
        expect(result.pointsMultiplier).toBe(1);
      });

      it('returns empty cardsToRemove array', () => {
        const enemy = createMaskedBandit();
        const cards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onInvalidMatch(cards, board);
        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns timeDelta of 0', () => {
        const enemy = createMaskedBandit();
        const cards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onInvalidMatch(cards, board);
        expect(result.timeDelta).toBe(0);
      });

      it('returns empty events array', () => {
        const enemy = createMaskedBandit();
        const cards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onInvalidMatch(cards, board);
        expect(result.events).toEqual([]);
      });
    });

    describe('onRoundEnd', () => {
      it('can be called without errors', () => {
        const enemy = createMaskedBandit();
        expect(() => enemy.onRoundEnd()).not.toThrow();
      });

      it('can be called multiple times without errors', () => {
        const enemy = createMaskedBandit();
        expect(() => {
          enemy.onRoundEnd();
          enemy.onRoundEnd();
          enemy.onRoundEnd();
        }).not.toThrow();
      });
    });
  });

  // ==========================================================================
  // UI AND STAT MODIFIERS
  // ==========================================================================
  describe('UI modifiers (getUIModifiers)', () => {
    it('returns disableAutoHint as true', () => {
      const enemy = createMaskedBandit();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableAutoHint).toBe(true);
    });

    it('does not show inactivity bar', () => {
      const enemy = createMaskedBandit();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showInactivityBar).toBeFalsy();
    });

    it('does not show score decay', () => {
      const enemy = createMaskedBandit();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showScoreDecay).toBeFalsy();
    });

    it('has no timer speed multiplier', () => {
      const enemy = createMaskedBandit();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.timerSpeedMultiplier).toBeFalsy();
    });
  });

  describe('stat modifiers (getStatModifiers)', () => {
    it('returns empty or neutral stat modifiers', () => {
      const enemy = createMaskedBandit();
      const modifiers = enemy.getStatModifiers();
      // Should not have any weapon counter reductions
      expect(modifiers.fireSpreadChanceReduction).toBeFalsy();
      expect(modifiers.explosionChanceReduction).toBeFalsy();
      expect(modifiers.laserChanceReduction).toBeFalsy();
      expect(modifiers.hintGainChanceReduction).toBeFalsy();
      expect(modifiers.graceGainChanceReduction).toBeFalsy();
      expect(modifiers.timeGainChanceReduction).toBeFalsy();
      expect(modifiers.healingChanceReduction).toBeFalsy();
    });

    it('has no damage multiplier', () => {
      const enemy = createMaskedBandit();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.damageMultiplier).toBeFalsy();
    });

    it('has no points multiplier', () => {
      const enemy = createMaskedBandit();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.pointsMultiplier).toBeFalsy();
    });
  });

  // ==========================================================================
  // INSTANCE INDEPENDENCE
  // ==========================================================================
  describe('instance independence', () => {
    it('multiple instances have same metadata', () => {
      const enemy1 = createMaskedBandit();
      const enemy2 = createMaskedBandit();
      expect(enemy1.name).toBe(enemy2.name);
      expect(enemy1.tier).toBe(enemy2.tier);
      expect(enemy1.icon).toBe(enemy2.icon);
      expect(enemy1.description).toBe(enemy2.description);
    });

    it('multiple instances have independent defeat condition checks', () => {
      const enemy1 = createMaskedBandit();
      const enemy2 = createMaskedBandit();
      const statsDefeated = createRoundStats({ matchTimes: [5000, 5000, 5000] });
      const statsNotDefeated = createRoundStats({ matchTimes: [15000, 5000, 5000] });
      expect(enemy1.checkDefeatCondition(statsDefeated)).toBe(true);
      expect(enemy2.checkDefeatCondition(statsNotDefeated)).toBe(false);
    });
  });
});
