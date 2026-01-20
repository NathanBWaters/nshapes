/**
 * Comprehensive Unit Tests for Burrowing Mole Enemy
 *
 * Burrowing Mole - Tier 1 Enemy
 * Effect: Removes 1 random card every 20s (min board size 6)
 * Defeat Condition: Match all 3 shapes at least once
 */
import type { Card, Shape } from '@/types';
import { createBurrowingMole } from '@/utils/enemies/tier1/burrowingMole';
import {
  createRoundStats,
  createCard,
  createTestBoard,
  resetCardIdCounter,
} from '../../testUtils';

// Mock Math.random for deterministic tests
const mockRandom = (value: number) => {
  jest.spyOn(Math, 'random').mockReturnValue(value);
};

beforeEach(() => {
  resetCardIdCounter();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Burrowing Mole', () => {
  // ==========================================================================
  // METADATA TESTS
  // ==========================================================================
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createBurrowingMole();
      expect(enemy.name).toBe('Burrowing Mole');
    });

    it('has correct tier (tier 1)', () => {
      const enemy = createBurrowingMole();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon', () => {
      const enemy = createBurrowingMole();
      expect(enemy.icon).toBe('caro-asercion/mole');
    });

    it('has description mentioning removal interval', () => {
      const enemy = createBurrowingMole();
      expect(enemy.description).toContain('20s');
    });

    it('has description mentioning card removal', () => {
      const enemy = createBurrowingMole();
      expect(enemy.description.toLowerCase()).toContain('remove');
    });

    it('has description mentioning 1 card', () => {
      const enemy = createBurrowingMole();
      expect(enemy.description).toContain('1');
    });

    it('has correct defeatConditionText', () => {
      const enemy = createBurrowingMole();
      expect(enemy.defeatConditionText).toBe('Match all 3 shapes at least once');
    });
  });

  // ==========================================================================
  // EFFECT TESTS - Card Removal
  // ==========================================================================
  describe('card removal effect', () => {
    it('does not remove cards before 20s interval', () => {
      mockRandom(0.5);
      const enemy = createBurrowingMole();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      const result = enemy.onTick(19999, board);

      expect(result.cardsToRemove.length).toBe(0);
    });

    it('removes exactly 1 card at 20s interval', () => {
      mockRandom(0.5);
      const enemy = createBurrowingMole();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      const result = enemy.onTick(20000, board);

      expect(result.cardsToRemove.length).toBe(1);
    });

    it('emits card_removed event with enemy_effect reason', () => {
      mockRandom(0.5);
      const enemy = createBurrowingMole();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      const result = enemy.onTick(20000, board);

      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: 'card_removed',
          reason: 'enemy_effect',
        })
      );
    });

    it('does not remove cards when board is at minimum size (6)', () => {
      mockRandom(0.5);
      const enemy = createBurrowingMole();
      const board = createTestBoard(6);
      enemy.onRoundStart(board);

      const result = enemy.onTick(20000, board);

      expect(result.cardsToRemove.length).toBe(0);
    });

    it('does not remove cards when board is below minimum size', () => {
      mockRandom(0.5);
      const enemy = createBurrowingMole();
      const board = createTestBoard(5);
      enemy.onRoundStart(board);

      const result = enemy.onTick(20000, board);

      expect(result.cardsToRemove.length).toBe(0);
    });

    it('removes cards repeatedly at each 20s interval', () => {
      mockRandom(0.5);
      const enemy = createBurrowingMole();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      // First removal at 20s
      const result1 = enemy.onTick(20000, board);
      expect(result1.cardsToRemove.length).toBe(1);

      // Second removal at 40s (20s after first)
      const result2 = enemy.onTick(20000, board);
      expect(result2.cardsToRemove.length).toBe(1);

      // Third removal at 60s
      const result3 = enemy.onTick(20000, board);
      expect(result3.cardsToRemove.length).toBe(1);
    });

    it('accumulates time across multiple ticks before removal', () => {
      mockRandom(0.5);
      const enemy = createBurrowingMole();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      // Tick for 10s - no removal
      const result1 = enemy.onTick(10000, board);
      expect(result1.cardsToRemove.length).toBe(0);

      // Tick for another 10s - should now trigger removal
      const result2 = enemy.onTick(10000, board);
      expect(result2.cardsToRemove.length).toBe(1);
    });

    it('does not remove dud cards', () => {
      // Set random to select first valid card
      mockRandom(0);
      const enemy = createBurrowingMole();

      // Create board where first card is a dud
      const board: Card[] = [
        createCard({ isDud: true }),
        createCard(),
        createCard(),
        createCard(),
        createCard(),
        createCard(),
        createCard(),
      ];
      enemy.onRoundStart(board);

      const result = enemy.onTick(20000, board);

      // Should remove a card but not the dud card
      if (result.cardsToRemove.length > 0) {
        expect(result.cardsToRemove[0]).not.toBe(board[0].id);
      }
    });

    it('selects card randomly from valid cards', () => {
      const enemy1 = createBurrowingMole();
      const enemy2 = createBurrowingMole();
      const board = createTestBoard(12);

      // First enemy with random = 0.1
      mockRandom(0.1);
      enemy1.onRoundStart(board);
      const result1 = enemy1.onTick(20000, board);

      // Reset mocks and create fresh enemy with different random
      jest.restoreAllMocks();
      mockRandom(0.9);
      enemy2.onRoundStart(board);
      const result2 = enemy2.onTick(20000, board);

      // With different random values, should select different cards
      // (unless by coincidence they hit the same index)
      expect(result1.cardsToRemove.length).toBe(1);
      expect(result2.cardsToRemove.length).toBe(1);
    });
  });

  // ==========================================================================
  // DEFEAT CONDITION TESTS
  // ==========================================================================
  describe('defeat condition', () => {
    it('returns false when no shapes matched', () => {
      const enemy = createBurrowingMole();
      const stats = createRoundStats({
        shapesMatched: new Set<Shape>(),
      });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when only 1 shape matched', () => {
      const enemy = createBurrowingMole();
      const stats = createRoundStats({
        shapesMatched: new Set<Shape>(['oval']),
      });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when only 2 shapes matched (threshold - 1)', () => {
      const enemy = createBurrowingMole();
      const stats = createRoundStats({
        shapesMatched: new Set<Shape>(['oval', 'diamond']),
      });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when all 3 shapes matched (exact threshold)', () => {
      const enemy = createBurrowingMole();
      const stats = createRoundStats({
        shapesMatched: new Set<Shape>(['oval', 'diamond', 'squiggle']),
      });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true with different shape combinations', () => {
      const enemy = createBurrowingMole();

      // Order shouldn't matter
      const stats1 = createRoundStats({
        shapesMatched: new Set<Shape>(['diamond', 'squiggle', 'oval']),
      });
      expect(enemy.checkDefeatCondition(stats1)).toBe(true);

      const stats2 = createRoundStats({
        shapesMatched: new Set<Shape>(['squiggle', 'oval', 'diamond']),
      });
      expect(enemy.checkDefeatCondition(stats2)).toBe(true);
    });

    it('returns true regardless of other stats values', () => {
      const enemy = createBurrowingMole();
      const stats = createRoundStats({
        shapesMatched: new Set<Shape>(['oval', 'diamond', 'squiggle']),
        totalMatches: 50,
        invalidMatches: 10,
        currentScore: 500,
        damageReceived: 5,
      });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS
  // ==========================================================================
  describe('lifecycle hooks', () => {
    describe('onRoundStart', () => {
      it('returns empty cardModifications array', () => {
        const enemy = createBurrowingMole();
        const board = createTestBoard(12);

        const result = enemy.onRoundStart(board);

        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty events array', () => {
        const enemy = createBurrowingMole();
        const board = createTestBoard(12);

        const result = enemy.onRoundStart(board);

        expect(result.events).toEqual([]);
      });

      it('resets internal removal timer', () => {
        mockRandom(0.5);
        const enemy = createBurrowingMole();
        const board = createTestBoard(12);

        // Accumulate some time
        enemy.onRoundStart(board);
        enemy.onTick(15000, board);

        // Reset via new round start
        enemy.onRoundStart(board);

        // Should need full 20s again
        const result = enemy.onTick(15000, board);
        expect(result.cardsToRemove.length).toBe(0);
      });
    });

    describe('onCardDraw', () => {
      it('returns card unmodified', () => {
        const enemy = createBurrowingMole();
        const card = createCard({ shape: 'diamond', color: 'green' });

        const result = enemy.onCardDraw(card);

        expect(result).toEqual(card);
      });

      it('preserves all card properties', () => {
        const enemy = createBurrowingMole();
        const card = createCard({
          shape: 'squiggle',
          color: 'purple',
          number: 3,
          shading: 'striped',
          selected: true,
        });

        const result = enemy.onCardDraw(card);

        expect(result.shape).toBe('squiggle');
        expect(result.color).toBe('purple');
        expect(result.number).toBe(3);
        expect(result.shading).toBe('striped');
        expect(result.selected).toBe(true);
      });
    });

    describe('onValidMatch', () => {
      it('returns pointsMultiplier of 1 (neutral)', () => {
        const enemy = createBurrowingMole();
        const board = createTestBoard(12);

        const result = enemy.onValidMatch([], board);

        expect(result.pointsMultiplier).toBe(1);
      });

      it('returns timeDelta of 0 (neutral)', () => {
        const enemy = createBurrowingMole();
        const board = createTestBoard(12);

        const result = enemy.onValidMatch([], board);

        expect(result.timeDelta).toBe(0);
      });

      it('returns empty cardsToRemove array', () => {
        const enemy = createBurrowingMole();
        const board = createTestBoard(12);

        const result = enemy.onValidMatch([], board);

        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty cardsToFlip array', () => {
        const enemy = createBurrowingMole();
        const board = createTestBoard(12);

        const result = enemy.onValidMatch([], board);

        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events array', () => {
        const enemy = createBurrowingMole();
        const board = createTestBoard(12);

        const result = enemy.onValidMatch([], board);

        expect(result.events).toEqual([]);
      });
    });

    describe('onInvalidMatch', () => {
      it('returns pointsMultiplier of 1 (neutral)', () => {
        const enemy = createBurrowingMole();
        const board = createTestBoard(12);

        const result = enemy.onInvalidMatch([], board);

        expect(result.pointsMultiplier).toBe(1);
      });

      it('returns empty cardsToRemove array', () => {
        const enemy = createBurrowingMole();
        const board = createTestBoard(12);

        const result = enemy.onInvalidMatch([], board);

        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns timeDelta of 0 (neutral)', () => {
        const enemy = createBurrowingMole();
        const board = createTestBoard(12);

        const result = enemy.onInvalidMatch([], board);

        expect(result.timeDelta).toBe(0);
      });
    });

    describe('onRoundEnd', () => {
      it('can be called without error', () => {
        const enemy = createBurrowingMole();

        expect(() => enemy.onRoundEnd()).not.toThrow();
      });

      it('resets internal state for next round', () => {
        mockRandom(0.5);
        const enemy = createBurrowingMole();
        const board = createTestBoard(12);

        // Accumulate time
        enemy.onRoundStart(board);
        enemy.onTick(15000, board);

        // End round
        enemy.onRoundEnd();

        // Start new round
        enemy.onRoundStart(board);

        // Should need full 20s again
        const result = enemy.onTick(15000, board);
        expect(result.cardsToRemove.length).toBe(0);
      });
    });

    describe('onTick', () => {
      it('returns scoreDelta of 0', () => {
        const enemy = createBurrowingMole();
        const board = createTestBoard(12);
        enemy.onRoundStart(board);

        const result = enemy.onTick(1000, board);

        expect(result.scoreDelta).toBe(0);
      });

      it('returns healthDelta of 0', () => {
        const enemy = createBurrowingMole();
        const board = createTestBoard(12);
        enemy.onRoundStart(board);

        const result = enemy.onTick(1000, board);

        expect(result.healthDelta).toBe(0);
      });

      it('returns timeDelta of 0', () => {
        const enemy = createBurrowingMole();
        const board = createTestBoard(12);
        enemy.onRoundStart(board);

        const result = enemy.onTick(1000, board);

        expect(result.timeDelta).toBe(0);
      });

      it('returns instantDeath as false', () => {
        const enemy = createBurrowingMole();
        const board = createTestBoard(12);
        enemy.onRoundStart(board);

        const result = enemy.onTick(20000, board);

        expect(result.instantDeath).toBe(false);
      });

      it('returns empty cardModifications array', () => {
        const enemy = createBurrowingMole();
        const board = createTestBoard(12);
        enemy.onRoundStart(board);

        const result = enemy.onTick(1000, board);

        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty cardsToFlip array', () => {
        const enemy = createBurrowingMole();
        const board = createTestBoard(12);
        enemy.onRoundStart(board);

        const result = enemy.onTick(1000, board);

        expect(result.cardsToFlip).toEqual([]);
      });
    });
  });

  // ==========================================================================
  // UI/STAT MODIFIERS
  // ==========================================================================
  describe('UI modifiers', () => {
    it('returns empty UI modifiers object', () => {
      const enemy = createBurrowingMole();

      const modifiers = enemy.getUIModifiers();

      // Burrowing Mole has no special UI indicators
      expect(modifiers.showInactivityBar).toBeUndefined();
      expect(modifiers.showScoreDecay).toBeUndefined();
      expect(modifiers.timerSpeedMultiplier).toBeUndefined();
      expect(modifiers.disableAutoHint).toBeUndefined();
      expect(modifiers.disableManualHint).toBeUndefined();
      expect(modifiers.weaponCounters).toBeUndefined();
    });
  });

  describe('stat modifiers', () => {
    it('returns empty stat modifiers object', () => {
      const enemy = createBurrowingMole();

      const modifiers = enemy.getStatModifiers();

      // Burrowing Mole has no weapon counters or stat modifications
      expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
      expect(modifiers.explosionChanceReduction).toBeUndefined();
      expect(modifiers.laserChanceReduction).toBeUndefined();
      expect(modifiers.hintGainChanceReduction).toBeUndefined();
      expect(modifiers.graceGainChanceReduction).toBeUndefined();
      expect(modifiers.timeGainChanceReduction).toBeUndefined();
      expect(modifiers.healingChanceReduction).toBeUndefined();
      expect(modifiers.damageMultiplier).toBeUndefined();
      expect(modifiers.pointsMultiplier).toBeUndefined();
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================
  describe('edge cases', () => {
    it('handles empty board gracefully', () => {
      const enemy = createBurrowingMole();
      const emptyBoard: Card[] = [];
      enemy.onRoundStart(emptyBoard);

      const result = enemy.onTick(20000, emptyBoard);

      expect(result.cardsToRemove.length).toBe(0);
    });

    it('handles board with only dud cards', () => {
      mockRandom(0.5);
      const enemy = createBurrowingMole();
      const board: Card[] = Array.from({ length: 7 }, () =>
        createCard({ isDud: true })
      );
      enemy.onRoundStart(board);

      const result = enemy.onTick(20000, board);

      // No valid cards to remove
      expect(result.cardsToRemove.length).toBe(0);
    });

    it('handles exactly 7 cards (just above minimum)', () => {
      mockRandom(0.5);
      const enemy = createBurrowingMole();
      const board = createTestBoard(7);
      enemy.onRoundStart(board);

      const result = enemy.onTick(20000, board);

      expect(result.cardsToRemove.length).toBe(1);
    });

    it('creates fresh instance each time', () => {
      const enemy1 = createBurrowingMole();
      const enemy2 = createBurrowingMole();

      // Modify enemy1's internal state
      mockRandom(0.5);
      enemy1.onRoundStart(createTestBoard(12));
      enemy1.onTick(15000, createTestBoard(12));

      // enemy2 should have fresh state
      enemy2.onRoundStart(createTestBoard(12));
      const result = enemy2.onTick(15000, createTestBoard(12));

      // Only 15s elapsed, shouldn't remove
      expect(result.cardsToRemove.length).toBe(0);
    });

    it('handles very large deltaMs values', () => {
      mockRandom(0.5);
      const enemy = createBurrowingMole();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      // 60 seconds in one tick (3 intervals)
      const result = enemy.onTick(60000, board);

      // Should only remove once per tick regardless of time elapsed
      // (The CardRemovalEffect resets timer after removal)
      expect(result.cardsToRemove.length).toBe(1);
    });

    it('handles zero deltaMs', () => {
      const enemy = createBurrowingMole();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      const result = enemy.onTick(0, board);

      expect(result.cardsToRemove.length).toBe(0);
    });
  });
});
