/**
 * Comprehensive Test Suite for Prowling Direwolf (Tier 2)
 *
 * Effects: Junk Rat (6% dud) + Wild Goose (25s shuffle)
 * Defeat Condition: Get a 6-match streak
 */

import { createProwlingDirewolf } from '@/utils/enemies/tier2/prowlingDirewolf';
import {
  createRoundStats,
  createCard,
  createTestBoard,
  createVariedBoard,
  resetCardIdCounter,
} from '../../testUtils';
import type { Card } from '@/types';

describe('Prowling Direwolf', () => {
  beforeEach(() => {
    resetCardIdCounter();
    jest.restoreAllMocks();
  });

  // ============================================================================
  // METADATA TESTS (5 tests)
  // ============================================================================
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createProwlingDirewolf();
      expect(enemy.name).toBe('Prowling Direwolf');
    });

    it('has tier 2', () => {
      const enemy = createProwlingDirewolf();
      expect(enemy.tier).toBe(2);
    });

    it('has correct icon', () => {
      const enemy = createProwlingDirewolf();
      expect(enemy.icon).toBe('lorc/direwolf');
    });

    it('has description mentioning 6% dud chance', () => {
      const enemy = createProwlingDirewolf();
      expect(enemy.description).toContain('6%');
    });

    it('has defeat condition text mentioning 6-match streak', () => {
      const enemy = createProwlingDirewolf();
      expect(enemy.defeatConditionText).toContain('6');
      expect(enemy.defeatConditionText.toLowerCase()).toContain('streak');
    });
  });

  // ============================================================================
  // DUD CARD EFFECT TESTS (15 tests)
  // ============================================================================
  describe('dud card effect', () => {
    describe('roll below 6% threshold', () => {
      it('creates dud when random returns 0', () => {
        const enemy = createProwlingDirewolf();
        const card = createCard();
        jest.spyOn(Math, 'random').mockReturnValue(0);

        const result = enemy.onCardDraw(card);
        expect(result.isDud).toBe(true);
      });

      it('creates dud when random returns 0.01 (1%)', () => {
        const enemy = createProwlingDirewolf();
        const card = createCard();
        jest.spyOn(Math, 'random').mockReturnValue(0.01);

        const result = enemy.onCardDraw(card);
        expect(result.isDud).toBe(true);
      });

      it('creates dud when random returns 0.03 (3%)', () => {
        const enemy = createProwlingDirewolf();
        const card = createCard();
        jest.spyOn(Math, 'random').mockReturnValue(0.03);

        const result = enemy.onCardDraw(card);
        expect(result.isDud).toBe(true);
      });

      it('creates dud when random returns 0.05 (5%)', () => {
        const enemy = createProwlingDirewolf();
        const card = createCard();
        jest.spyOn(Math, 'random').mockReturnValue(0.05);

        const result = enemy.onCardDraw(card);
        expect(result.isDud).toBe(true);
      });

      it('creates dud when random returns 0.059 (5.9%)', () => {
        const enemy = createProwlingDirewolf();
        const card = createCard();
        jest.spyOn(Math, 'random').mockReturnValue(0.059);

        const result = enemy.onCardDraw(card);
        expect(result.isDud).toBe(true);
      });
    });

    describe('roll at or above 6% threshold', () => {
      it('does not create dud when random returns 0.06 (6%)', () => {
        const enemy = createProwlingDirewolf();
        const card = createCard();
        jest.spyOn(Math, 'random').mockReturnValue(0.06);

        const result = enemy.onCardDraw(card);
        expect(result.isDud).toBeUndefined();
      });

      it('does not create dud when random returns 0.07 (7%)', () => {
        const enemy = createProwlingDirewolf();
        const card = createCard();
        jest.spyOn(Math, 'random').mockReturnValue(0.07);

        const result = enemy.onCardDraw(card);
        expect(result.isDud).toBeUndefined();
      });

      it('does not create dud when random returns 0.5 (50%)', () => {
        const enemy = createProwlingDirewolf();
        const card = createCard();
        jest.spyOn(Math, 'random').mockReturnValue(0.5);

        const result = enemy.onCardDraw(card);
        expect(result.isDud).toBeUndefined();
      });

      it('does not create dud when random returns 0.99 (99%)', () => {
        const enemy = createProwlingDirewolf();
        const card = createCard();
        jest.spyOn(Math, 'random').mockReturnValue(0.99);

        const result = enemy.onCardDraw(card);
        expect(result.isDud).toBeUndefined();
      });
    });

    describe('card preservation', () => {
      it('preserves card id when creating dud', () => {
        const enemy = createProwlingDirewolf();
        const card = createCard({ id: 'unique-id-123' });
        jest.spyOn(Math, 'random').mockReturnValue(0.01);

        const result = enemy.onCardDraw(card);
        expect(result.id).toBe('unique-id-123');
      });

      it('preserves card shape when creating dud', () => {
        const enemy = createProwlingDirewolf();
        const card = createCard({ shape: 'squiggle' });
        jest.spyOn(Math, 'random').mockReturnValue(0.01);

        const result = enemy.onCardDraw(card);
        expect(result.shape).toBe('squiggle');
      });

      it('preserves card color when creating dud', () => {
        const enemy = createProwlingDirewolf();
        const card = createCard({ color: 'purple' });
        jest.spyOn(Math, 'random').mockReturnValue(0.01);

        const result = enemy.onCardDraw(card);
        expect(result.color).toBe('purple');
      });

      it('preserves card number when creating dud', () => {
        const enemy = createProwlingDirewolf();
        const card = createCard({ number: 3 });
        jest.spyOn(Math, 'random').mockReturnValue(0.01);

        const result = enemy.onCardDraw(card);
        expect(result.number).toBe(3);
      });

      it('preserves card shading when creating dud', () => {
        const enemy = createProwlingDirewolf();
        const card = createCard({ shading: 'open' });
        jest.spyOn(Math, 'random').mockReturnValue(0.01);

        const result = enemy.onCardDraw(card);
        expect(result.shading).toBe('open');
      });

      it('preserves all attributes when NOT creating dud', () => {
        const enemy = createProwlingDirewolf();
        const card = createCard({
          id: 'test-id',
          shape: 'diamond',
          color: 'green',
          number: 2,
          shading: 'striped',
        });
        jest.spyOn(Math, 'random').mockReturnValue(0.5);

        const result = enemy.onCardDraw(card);
        expect(result.id).toBe('test-id');
        expect(result.shape).toBe('diamond');
        expect(result.color).toBe('green');
        expect(result.number).toBe(2);
        expect(result.shading).toBe('striped');
        expect(result.isDud).toBeUndefined();
      });
    });
  });

  // ============================================================================
  // POSITION SHUFFLE EFFECT TESTS (15 tests)
  // ============================================================================
  describe('position shuffle effect', () => {
    describe('timing', () => {
      it('does not shuffle before 25 seconds', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard();

        const result = enemy.onTick(24999, board);
        const shuffleEvents = result.events.filter((e) => e.type === 'positions_shuffled');
        expect(shuffleEvents).toHaveLength(0);
      });

      it('shuffles at exactly 25 seconds', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard();

        const result = enemy.onTick(25000, board);
        expect(result.events).toContainEqual({ type: 'positions_shuffled' });
      });

      it('shuffles when time exceeds 25 seconds', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard();

        const result = enemy.onTick(26000, board);
        expect(result.events).toContainEqual({ type: 'positions_shuffled' });
      });

      it('does not shuffle at 10 seconds', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard();

        const result = enemy.onTick(10000, board);
        const shuffleEvents = result.events.filter((e) => e.type === 'positions_shuffled');
        expect(shuffleEvents).toHaveLength(0);
      });

      it('does not shuffle at 20 seconds', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard();

        const result = enemy.onTick(20000, board);
        const shuffleEvents = result.events.filter((e) => e.type === 'positions_shuffled');
        expect(shuffleEvents).toHaveLength(0);
      });
    });

    describe('accumulation', () => {
      it('accumulates time across multiple ticks to reach 25s', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard();

        // 5 ticks of 5 seconds each = 25 seconds
        enemy.onTick(5000, board);
        enemy.onTick(5000, board);
        enemy.onTick(5000, board);
        enemy.onTick(5000, board);
        const result = enemy.onTick(5000, board);

        expect(result.events).toContainEqual({ type: 'positions_shuffled' });
      });

      it('accumulates time with varying tick sizes', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard();

        enemy.onTick(10000, board);
        enemy.onTick(8000, board);
        const result = enemy.onTick(7000, board); // Total: 25000

        expect(result.events).toContainEqual({ type: 'positions_shuffled' });
      });

      it('resets timer after shuffle', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard();

        // Trigger first shuffle
        enemy.onTick(25000, board);

        // Should not shuffle immediately after
        const result = enemy.onTick(1000, board);
        const shuffleEvents = result.events.filter((e) => e.type === 'positions_shuffled');
        expect(shuffleEvents).toHaveLength(0);
      });

      it('shuffles again after another 25 seconds', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard();

        // First shuffle
        enemy.onTick(25000, board);

        // Second shuffle
        const result = enemy.onTick(25000, board);
        expect(result.events).toContainEqual({ type: 'positions_shuffled' });
      });

      it('can shuffle multiple times across a long period', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard();

        let shuffleCount = 0;
        // 60 seconds = should shuffle twice (at 25s and 50s)
        for (let i = 0; i < 60; i++) {
          const result = enemy.onTick(1000, board);
          if (result.events.some((e) => e.type === 'positions_shuffled')) {
            shuffleCount++;
          }
        }

        expect(shuffleCount).toBe(2);
      });
    });

    describe('board size independence', () => {
      it('shuffles with empty board', () => {
        const enemy = createProwlingDirewolf();
        const board: Card[] = [];

        const result = enemy.onTick(25000, board);
        expect(result.events).toContainEqual({ type: 'positions_shuffled' });
      });

      it('shuffles with single card', () => {
        const enemy = createProwlingDirewolf();
        const board = [createCard()];

        const result = enemy.onTick(25000, board);
        expect(result.events).toContainEqual({ type: 'positions_shuffled' });
      });

      it('shuffles with large board', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard(18);

        const result = enemy.onTick(25000, board);
        expect(result.events).toContainEqual({ type: 'positions_shuffled' });
      });

      it('shuffles with varied board', () => {
        const enemy = createProwlingDirewolf();
        const board = createVariedBoard();

        const result = enemy.onTick(25000, board);
        expect(result.events).toContainEqual({ type: 'positions_shuffled' });
      });
    });

    describe('result structure', () => {
      it('returns empty cardsToRemove on shuffle', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard();

        const result = enemy.onTick(25000, board);
        expect(result.cardsToRemove).toHaveLength(0);
      });

      it('returns zero scoreDelta on shuffle', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard();

        const result = enemy.onTick(25000, board);
        expect(result.scoreDelta).toBe(0);
      });

      it('returns zero healthDelta on shuffle', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard();

        const result = enemy.onTick(25000, board);
        expect(result.healthDelta).toBe(0);
      });
    });
  });

  // ============================================================================
  // DEFEAT CONDITION TESTS (20 tests)
  // ============================================================================
  describe('defeat condition', () => {
    describe('streak thresholds', () => {
      it('returns false with 0-match streak', () => {
        const enemy = createProwlingDirewolf();
        const stats = createRoundStats({ maxStreak: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false with 1-match streak', () => {
        const enemy = createProwlingDirewolf();
        const stats = createRoundStats({ maxStreak: 1 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false with 2-match streak', () => {
        const enemy = createProwlingDirewolf();
        const stats = createRoundStats({ maxStreak: 2 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false with 3-match streak', () => {
        const enemy = createProwlingDirewolf();
        const stats = createRoundStats({ maxStreak: 3 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false with 4-match streak', () => {
        const enemy = createProwlingDirewolf();
        const stats = createRoundStats({ maxStreak: 4 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false with 5-match streak', () => {
        const enemy = createProwlingDirewolf();
        const stats = createRoundStats({ maxStreak: 5 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true with exactly 6-match streak', () => {
        const enemy = createProwlingDirewolf();
        const stats = createRoundStats({ maxStreak: 6 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true with 7-match streak', () => {
        const enemy = createProwlingDirewolf();
        const stats = createRoundStats({ maxStreak: 7 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true with 10-match streak', () => {
        const enemy = createProwlingDirewolf();
        const stats = createRoundStats({ maxStreak: 10 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true with 100-match streak', () => {
        const enemy = createProwlingDirewolf();
        const stats = createRoundStats({ maxStreak: 100 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('maxStreak vs currentStreak', () => {
      it('uses maxStreak, not currentStreak (maxStreak=6, currentStreak=0)', () => {
        const enemy = createProwlingDirewolf();
        const stats = createRoundStats({ maxStreak: 6, currentStreak: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('uses maxStreak, not currentStreak (maxStreak=5, currentStreak=6)', () => {
        const enemy = createProwlingDirewolf();
        // currentStreak could theoretically be higher if logic bug exists
        const stats = createRoundStats({ maxStreak: 5, currentStreak: 6 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores currentStreak when maxStreak is sufficient', () => {
        const enemy = createProwlingDirewolf();
        const stats = createRoundStats({ maxStreak: 6, currentStreak: 1 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('other stats independence', () => {
      it('ignores totalMatches', () => {
        const enemy = createProwlingDirewolf();
        const stats = createRoundStats({ maxStreak: 5, totalMatches: 100 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores invalidMatches', () => {
        const enemy = createProwlingDirewolf();
        const stats = createRoundStats({ maxStreak: 6, invalidMatches: 50 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores damageReceived', () => {
        const enemy = createProwlingDirewolf();
        const stats = createRoundStats({ maxStreak: 6, damageReceived: 10 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores gracesUsed', () => {
        const enemy = createProwlingDirewolf();
        const stats = createRoundStats({ maxStreak: 5, gracesUsed: 99 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores hintsUsed', () => {
        const enemy = createProwlingDirewolf();
        const stats = createRoundStats({ maxStreak: 6, hintsUsed: 99 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores currentScore', () => {
        const enemy = createProwlingDirewolf();
        const stats = createRoundStats({ maxStreak: 5, currentScore: 9999 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores timeRemaining', () => {
        const enemy = createProwlingDirewolf();
        const stats = createRoundStats({ maxStreak: 6, timeRemaining: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });
  });

  // ============================================================================
  // LIFECYCLE HOOK TESTS (10 tests)
  // ============================================================================
  describe('lifecycle hooks', () => {
    describe('onRoundStart', () => {
      it('returns empty card modifications', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard();

        const result = enemy.onRoundStart(board);
        expect(result.cardModifications).toHaveLength(0);
      });

      it('returns empty events', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard();

        const result = enemy.onRoundStart(board);
        expect(result.events).toHaveLength(0);
      });

      it('resets shuffle timer', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard();

        // Accumulate some time
        enemy.onTick(20000, board);

        // Start new round
        enemy.onRoundStart(board);

        // Should not shuffle at 5 seconds (would have been 25s without reset)
        const result = enemy.onTick(5000, board);
        const shuffleEvents = result.events.filter((e) => e.type === 'positions_shuffled');
        expect(shuffleEvents).toHaveLength(0);
      });
    });

    describe('onValidMatch', () => {
      it('returns zero timeDelta', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard();
        const matchedCards = [createCard(), createCard(), createCard()];

        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.timeDelta).toBe(0);
      });

      it('returns pointsMultiplier of 1', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard();
        const matchedCards = [createCard(), createCard(), createCard()];

        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.pointsMultiplier).toBe(1);
      });

      it('returns empty cardsToRemove', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard();
        const matchedCards = [createCard(), createCard(), createCard()];

        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.cardsToRemove).toHaveLength(0);
      });
    });

    describe('onInvalidMatch', () => {
      it('returns zero timeDelta', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard();
        const invalidCards = [createCard(), createCard(), createCard()];

        const result = enemy.onInvalidMatch(invalidCards, board);
        expect(result.timeDelta).toBe(0);
      });

      it('returns pointsMultiplier of 1', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard();
        const invalidCards = [createCard(), createCard(), createCard()];

        const result = enemy.onInvalidMatch(invalidCards, board);
        expect(result.pointsMultiplier).toBe(1);
      });

      it('returns empty cardsToRemove', () => {
        const enemy = createProwlingDirewolf();
        const board = createTestBoard();
        const invalidCards = [createCard(), createCard(), createCard()];

        const result = enemy.onInvalidMatch(invalidCards, board);
        expect(result.cardsToRemove).toHaveLength(0);
      });
    });

    describe('onRoundEnd', () => {
      it('can be called without error', () => {
        const enemy = createProwlingDirewolf();
        expect(() => enemy.onRoundEnd()).not.toThrow();
      });
    });
  });

  // ============================================================================
  // UI AND STAT MODIFIER TESTS (8 tests)
  // ============================================================================
  describe('UI and stat modifiers', () => {
    describe('getUIModifiers', () => {
      it('returns object', () => {
        const enemy = createProwlingDirewolf();
        const uiMods = enemy.getUIModifiers();
        expect(typeof uiMods).toBe('object');
      });

      it('does not show inactivity bar', () => {
        const enemy = createProwlingDirewolf();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.showInactivityBar).toBeUndefined();
      });

      it('does not show score decay', () => {
        const enemy = createProwlingDirewolf();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.showScoreDecay).toBeUndefined();
      });

      it('does not disable auto hint', () => {
        const enemy = createProwlingDirewolf();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.disableAutoHint).toBeUndefined();
      });

      it('does not disable manual hint', () => {
        const enemy = createProwlingDirewolf();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.disableManualHint).toBeUndefined();
      });
    });

    describe('getStatModifiers', () => {
      it('returns object', () => {
        const enemy = createProwlingDirewolf();
        const statMods = enemy.getStatModifiers();
        expect(typeof statMods).toBe('object');
      });

      it('does not modify damage multiplier', () => {
        const enemy = createProwlingDirewolf();
        const statMods = enemy.getStatModifiers();
        expect(statMods.damageMultiplier).toBeUndefined();
      });

      it('does not reduce weapon effectiveness', () => {
        const enemy = createProwlingDirewolf();
        const statMods = enemy.getStatModifiers();
        expect(statMods.fireSpreadChanceReduction).toBeUndefined();
        expect(statMods.explosionChanceReduction).toBeUndefined();
        expect(statMods.laserChanceReduction).toBeUndefined();
        expect(statMods.hintGainChanceReduction).toBeUndefined();
        expect(statMods.graceGainChanceReduction).toBeUndefined();
        expect(statMods.timeGainChanceReduction).toBeUndefined();
        expect(statMods.healingChanceReduction).toBeUndefined();
      });
    });
  });

  // ============================================================================
  // INSTANCE INDEPENDENCE TESTS (5 tests)
  // ============================================================================
  describe('instance independence', () => {
    it('creates fresh instance each time', () => {
      const enemy1 = createProwlingDirewolf();
      const enemy2 = createProwlingDirewolf();
      expect(enemy1).not.toBe(enemy2);
    });

    it('instances have independent shuffle timers', () => {
      const enemy1 = createProwlingDirewolf();
      const enemy2 = createProwlingDirewolf();
      const board = createTestBoard();

      // Advance enemy1's timer
      enemy1.onTick(24000, board);

      // enemy2 should still be at 0
      const result2 = enemy2.onTick(1000, board);
      const shuffleEvents = result2.events.filter((e) => e.type === 'positions_shuffled');
      expect(shuffleEvents).toHaveLength(0);
    });

    it('instances have independent dud rolls', () => {
      const enemy1 = createProwlingDirewolf();
      const enemy2 = createProwlingDirewolf();
      const card1 = createCard({ id: 'card1' });
      const card2 = createCard({ id: 'card2' });

      // First instance gets dud
      jest.spyOn(Math, 'random').mockReturnValueOnce(0.01).mockReturnValueOnce(0.5);

      const result1 = enemy1.onCardDraw(card1);
      const result2 = enemy2.onCardDraw(card2);

      expect(result1.isDud).toBe(true);
      expect(result2.isDud).toBeUndefined();
    });

    it('instances have independent defeat condition checks', () => {
      const enemy1 = createProwlingDirewolf();
      const enemy2 = createProwlingDirewolf();

      const stats1 = createRoundStats({ maxStreak: 6 });
      const stats2 = createRoundStats({ maxStreak: 5 });

      expect(enemy1.checkDefeatCondition(stats1)).toBe(true);
      expect(enemy2.checkDefeatCondition(stats2)).toBe(false);
    });

    it('round reset does not affect other instances', () => {
      const enemy1 = createProwlingDirewolf();
      const enemy2 = createProwlingDirewolf();
      const board = createTestBoard();

      // Advance both timers
      enemy1.onTick(20000, board);
      enemy2.onTick(20000, board);

      // Reset only enemy1
      enemy1.onRoundStart(board);

      // enemy2 should still shuffle at 5 more seconds
      const result2 = enemy2.onTick(5000, board);
      expect(result2.events).toContainEqual({ type: 'positions_shuffled' });

      // enemy1 should not shuffle
      const result1 = enemy1.onTick(5000, board);
      const shuffleEvents = result1.events.filter((e) => e.type === 'positions_shuffled');
      expect(shuffleEvents).toHaveLength(0);
    });
  });

  // ============================================================================
  // COMBINED BEHAVIOR TESTS (5 tests)
  // ============================================================================
  describe('combined behavior', () => {
    it('dud effect and shuffle effect work together', () => {
      const enemy = createProwlingDirewolf();
      const board = createTestBoard();
      const card = createCard();

      // Both effects should work in same enemy
      jest.spyOn(Math, 'random').mockReturnValue(0.01);
      const drawResult = enemy.onCardDraw(card);
      expect(drawResult.isDud).toBe(true);

      jest.restoreAllMocks();
      const tickResult = enemy.onTick(25000, board);
      expect(tickResult.events).toContainEqual({ type: 'positions_shuffled' });
    });

    it('multiple draws can create multiple duds', () => {
      const enemy = createProwlingDirewolf();

      jest.spyOn(Math, 'random').mockReturnValue(0.01);

      const card1 = enemy.onCardDraw(createCard({ id: 'c1' }));
      const card2 = enemy.onCardDraw(createCard({ id: 'c2' }));
      const card3 = enemy.onCardDraw(createCard({ id: 'c3' }));

      expect(card1.isDud).toBe(true);
      expect(card2.isDud).toBe(true);
      expect(card3.isDud).toBe(true);
    });

    it('tick result has correct structure even with no events', () => {
      const enemy = createProwlingDirewolf();
      const board = createTestBoard();

      const result = enemy.onTick(1000, board);

      expect(result).toHaveProperty('scoreDelta', 0);
      expect(result).toHaveProperty('healthDelta', 0);
      expect(result).toHaveProperty('timeDelta', 0);
      expect(result).toHaveProperty('cardsToRemove');
      expect(result).toHaveProperty('cardModifications');
      expect(result).toHaveProperty('cardsToFlip');
      expect(result).toHaveProperty('events');
      expect(result).toHaveProperty('instantDeath', false);
    });

    it('match result has correct structure', () => {
      const enemy = createProwlingDirewolf();
      const board = createTestBoard();
      const matchedCards = [createCard(), createCard(), createCard()];

      const result = enemy.onValidMatch(matchedCards, board);

      expect(result).toHaveProperty('timeDelta', 0);
      expect(result).toHaveProperty('pointsMultiplier', 1);
      expect(result).toHaveProperty('cardsToRemove');
      expect(result).toHaveProperty('cardsToFlip');
      expect(result).toHaveProperty('events');
    });

    it('start result has correct structure', () => {
      const enemy = createProwlingDirewolf();
      const board = createTestBoard();

      const result = enemy.onRoundStart(board);

      expect(result).toHaveProperty('cardModifications');
      expect(result).toHaveProperty('events');
    });
  });

  // ============================================================================
  // EDGE CASE TESTS (7 tests)
  // ============================================================================
  describe('edge cases', () => {
    it('handles zero delta tick', () => {
      const enemy = createProwlingDirewolf();
      const board = createTestBoard();

      const result = enemy.onTick(0, board);
      expect(result.events).toHaveLength(0);
    });

    it('handles very small delta tick', () => {
      const enemy = createProwlingDirewolf();
      const board = createTestBoard();

      const result = enemy.onTick(1, board);
      expect(result.events).toHaveLength(0);
    });

    it('handles negative maxStreak (invalid state)', () => {
      const enemy = createProwlingDirewolf();
      const stats = createRoundStats({ maxStreak: -1 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('handles card draw with pre-existing isDud', () => {
      const enemy = createProwlingDirewolf();
      const card = createCard({ isDud: true });

      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      // Should not change existing dud status when roll fails
      const result = enemy.onCardDraw(card);
      // The card retains its original isDud if it was true
      expect(result.isDud).toBe(true);
    });

    it('handles empty matchedCards array in onValidMatch', () => {
      const enemy = createProwlingDirewolf();
      const board = createTestBoard();

      const result = enemy.onValidMatch([], board);
      expect(result.timeDelta).toBe(0);
    });

    it('handles sequential round starts', () => {
      const enemy = createProwlingDirewolf();
      const board = createTestBoard();

      enemy.onRoundStart(board);
      enemy.onRoundStart(board);
      enemy.onRoundStart(board);

      // Should still need full 25 seconds after multiple starts
      const result = enemy.onTick(24999, board);
      const shuffleEvents = result.events.filter((e) => e.type === 'positions_shuffled');
      expect(shuffleEvents).toHaveLength(0);
    });

    it('handles large tick values', () => {
      const enemy = createProwlingDirewolf();
      const board = createTestBoard();

      // 1 million ms tick
      const result = enemy.onTick(1000000, board);
      expect(result.events).toContainEqual({ type: 'positions_shuffled' });
    });
  });
});
