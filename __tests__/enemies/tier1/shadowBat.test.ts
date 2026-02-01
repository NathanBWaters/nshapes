/**
 * Comprehensive Unit Tests for Shadow Bat enemy.
 *
 * Shadow Bat - Tier 1 Enemy
 * Effect: Laser effects reduced by 20%
 * Defeat Condition: Get an all-different match
 */
import type { Card, Shape, Color, Number as CardNumber, Shading } from '@/types';
import type { RoundStats, EnemyStatModifiers } from '@/types/enemy';
import { createShadowBat } from '@/utils/enemies/tier1/shadowBat';
import {
  createRoundStats,
  createCard,
  createTestBoard,
  createFaceDownCard,
  createTripleCard,
  createVariedBoard,
  resetCardIdCounter,
} from '../../testUtils';

// Reset card ID counter before each test for deterministic IDs
beforeEach(() => {
  resetCardIdCounter();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ============================================================================
// METADATA TESTS
// ============================================================================

describe('Shadow Bat', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createShadowBat();
      expect(enemy.name).toBe('Shadow Bat');
    });

    it('has correct tier (tier 1)', () => {
      const enemy = createShadowBat();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon path', () => {
      const enemy = createShadowBat();
      expect(enemy.icon).toBe('lorc/evil-bat');
    });

    it('has a non-empty description', () => {
      const enemy = createShadowBat();
      expect(enemy.description).toBeTruthy();
      expect(enemy.description.length).toBeGreaterThan(0);
    });

    it('description mentions laser effect', () => {
      const enemy = createShadowBat();
      expect(enemy.description.toLowerCase()).toContain('laser');
    });

    it('description mentions divided by 3', () => {
      const enemy = createShadowBat();
      expect(enemy.description).toContain('divided by 3');
    });

    it('has correct defeat condition text', () => {
      const enemy = createShadowBat();
      expect(enemy.defeatConditionText).toBe('Get an all-different match');
    });

    it('defeat condition text mentions "all-different"', () => {
      const enemy = createShadowBat();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('all-different');
    });

    it('defeat condition text mentions "match"', () => {
      const enemy = createShadowBat();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('match');
    });

    it('creates independent instances', () => {
      const enemy1 = createShadowBat();
      const enemy2 = createShadowBat();
      expect(enemy1).not.toBe(enemy2);
    });

    it('instances have the same metadata', () => {
      const enemy1 = createShadowBat();
      const enemy2 = createShadowBat();
      expect(enemy1.name).toBe(enemy2.name);
      expect(enemy1.tier).toBe(enemy2.tier);
      expect(enemy1.icon).toBe(enemy2.icon);
      expect(enemy1.description).toBe(enemy2.description);
      expect(enemy1.defeatConditionText).toBe(enemy2.defeatConditionText);
    });
  });

  // ============================================================================
  // STAT MODIFIERS TESTS
  // ============================================================================

  describe('getStatModifiers', () => {
    it('returns laser chance reduction of 20', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.laserChanceReduction).toBe(20);
    });

    it('returns an object with laserChanceReduction property', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers).toHaveProperty('laserChanceReduction');
    });

    it('does not affect fire spread chance', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
    });

    it('does not affect explosion chance', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.explosionChanceReduction).toBeUndefined();
    });

    it('does not affect hint gain chance', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.hintGainChanceReduction).toBeUndefined();
    });

    it('does not affect grace gain chance', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.graceGainChanceReduction).toBeUndefined();
    });

    it('does not affect time gain chance', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.timeGainChanceReduction).toBeUndefined();
    });

    it('does not affect healing chance', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.healingChanceReduction).toBeUndefined();
    });

    it('does not affect damage multiplier', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.damageMultiplier).toBeUndefined();
    });

    it('does not affect points multiplier', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.pointsMultiplier).toBeUndefined();
    });

    it('returns consistent modifiers across multiple calls', () => {
      const enemy = createShadowBat();
      const modifiers1 = enemy.getStatModifiers();
      const modifiers2 = enemy.getStatModifiers();
      expect(modifiers1.laserChanceReduction).toBe(modifiers2.laserChanceReduction);
    });

    it('returns consistent modifiers across multiple instances', () => {
      const enemy1 = createShadowBat();
      const enemy2 = createShadowBat();
      expect(enemy1.getStatModifiers().laserChanceReduction).toBe(
        enemy2.getStatModifiers().laserChanceReduction
      );
    });
  });

  // ============================================================================
  // UI MODIFIERS TESTS
  // ============================================================================

  describe('getUIModifiers', () => {
    it('returns weapon counters array', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters).toBeDefined();
      expect(Array.isArray(modifiers.weaponCounters)).toBe(true);
    });

    it('weapon counters array has exactly one entry', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters).toHaveLength(1);
    });

    it('weapon counter specifies type as laser', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters![0].type).toBe('laser');
    });

    it('weapon counter specifies reduction as 20', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters![0].reduction).toBe(20);
    });

    it('weapon counters contains exact expected object', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters).toContainEqual({ type: 'laser', reduction: 20 });
    });

    it('does not show inactivity bar', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showInactivityBar).toBeUndefined();
    });

    it('does not show score decay', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showScoreDecay).toBeUndefined();
    });

    it('does not modify timer speed', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.timerSpeedMultiplier).toBeUndefined();
    });

    it('does not disable auto hint', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableAutoHint).toBeUndefined();
    });

    it('does not disable manual hint', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableManualHint).toBeUndefined();
    });

    it('does not show countdown cards', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showCountdownCards).toBeUndefined();
    });

    it('does not show bomb cards', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showBombCards).toBeUndefined();
    });

    it('returns consistent UI modifiers across multiple calls', () => {
      const enemy = createShadowBat();
      const modifiers1 = enemy.getUIModifiers();
      const modifiers2 = enemy.getUIModifiers();
      expect(modifiers1.weaponCounters).toEqual(modifiers2.weaponCounters);
    });
  });

  // ============================================================================
  // DEFEAT CONDITION TESTS
  // ============================================================================

  describe('checkDefeatCondition', () => {
    describe('boundary values', () => {
      it('returns false when allDifferentMatches is 0', () => {
        const enemy = createShadowBat();
        const stats = createRoundStats({ allDifferentMatches: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true when allDifferentMatches is exactly 1 (threshold)', () => {
        const enemy = createShadowBat();
        const stats = createRoundStats({ allDifferentMatches: 1 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when allDifferentMatches is 2 (above threshold)', () => {
        const enemy = createShadowBat();
        const stats = createRoundStats({ allDifferentMatches: 2 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when allDifferentMatches is 5', () => {
        const enemy = createShadowBat();
        const stats = createRoundStats({ allDifferentMatches: 5 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when allDifferentMatches is 10', () => {
        const enemy = createShadowBat();
        const stats = createRoundStats({ allDifferentMatches: 10 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when allDifferentMatches is 100', () => {
        const enemy = createShadowBat();
        const stats = createRoundStats({ allDifferentMatches: 100 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('independence from other stats', () => {
      it('returns false regardless of totalMatches when no all-different matches', () => {
        const enemy = createShadowBat();
        const stats = createRoundStats({ allDifferentMatches: 0, totalMatches: 50 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true regardless of totalMatches when has all-different match', () => {
        const enemy = createShadowBat();
        const stats = createRoundStats({ allDifferentMatches: 1, totalMatches: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores allSameColorMatches', () => {
        const enemy = createShadowBat();
        const stats = createRoundStats({ allDifferentMatches: 0, allSameColorMatches: 10 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores squiggleMatches', () => {
        const enemy = createShadowBat();
        const stats = createRoundStats({ allDifferentMatches: 0, squiggleMatches: 10 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores invalidMatches', () => {
        const enemy = createShadowBat();
        const stats = createRoundStats({ allDifferentMatches: 0, invalidMatches: 10 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores currentStreak', () => {
        const enemy = createShadowBat();
        const stats = createRoundStats({ allDifferentMatches: 0, currentStreak: 10 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores maxStreak', () => {
        const enemy = createShadowBat();
        const stats = createRoundStats({ allDifferentMatches: 0, maxStreak: 20 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores timeRemaining', () => {
        const enemy = createShadowBat();
        const stats = createRoundStats({ allDifferentMatches: 0, timeRemaining: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores currentScore', () => {
        const enemy = createShadowBat();
        const stats = createRoundStats({ allDifferentMatches: 0, currentScore: 1000 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores targetScore', () => {
        const enemy = createShadowBat();
        const stats = createRoundStats({ allDifferentMatches: 0, targetScore: 1000 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores faceDownCardsMatched', () => {
        const enemy = createShadowBat();
        const stats = createRoundStats({ allDifferentMatches: 0, faceDownCardsMatched: 5 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores tripleCardsCleared', () => {
        const enemy = createShadowBat();
        const stats = createRoundStats({ allDifferentMatches: 0, tripleCardsCleared: 3 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores gracesUsed', () => {
        const enemy = createShadowBat();
        const stats = createRoundStats({ allDifferentMatches: 0, gracesUsed: 5 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores hintsUsed', () => {
        const enemy = createShadowBat();
        const stats = createRoundStats({ allDifferentMatches: 0, hintsUsed: 10 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores damageReceived', () => {
        const enemy = createShadowBat();
        const stats = createRoundStats({ allDifferentMatches: 0, damageReceived: 5 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });

    describe('state transitions', () => {
      it('transitions from false to true when allDifferentMatches becomes 1', () => {
        const enemy = createShadowBat();
        const statsBefore = createRoundStats({ allDifferentMatches: 0 });
        const statsAfter = createRoundStats({ allDifferentMatches: 1 });
        expect(enemy.checkDefeatCondition(statsBefore)).toBe(false);
        expect(enemy.checkDefeatCondition(statsAfter)).toBe(true);
      });

      it('stays true once defeated', () => {
        const enemy = createShadowBat();
        const stats1 = createRoundStats({ allDifferentMatches: 1 });
        const stats2 = createRoundStats({ allDifferentMatches: 2 });
        const stats3 = createRoundStats({ allDifferentMatches: 3 });
        expect(enemy.checkDefeatCondition(stats1)).toBe(true);
        expect(enemy.checkDefeatCondition(stats2)).toBe(true);
        expect(enemy.checkDefeatCondition(stats3)).toBe(true);
      });
    });
  });

  // ============================================================================
  // LIFECYCLE HOOKS: onRoundStart
  // ============================================================================

  describe('onRoundStart', () => {
    it('returns empty cardModifications array', () => {
      const enemy = createShadowBat();
      const board = createTestBoard(12);
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createShadowBat();
      const board = createTestBoard(12);
      const result = enemy.onRoundStart(board);
      expect(result.events).toEqual([]);
    });

    it('does not modify the board', () => {
      const enemy = createShadowBat();
      const board = createTestBoard(12);
      const originalBoard = JSON.stringify(board);
      enemy.onRoundStart(board);
      expect(JSON.stringify(board)).toBe(originalBoard);
    });

    it('handles empty board', () => {
      const enemy = createShadowBat();
      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('handles board with face-down cards', () => {
      const enemy = createShadowBat();
      const board = [
        createFaceDownCard(),
        createFaceDownCard(),
        createCard(),
      ];
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('handles board with triple cards', () => {
      const enemy = createShadowBat();
      const board = [
        createTripleCard(),
        createTripleCard(),
        createCard(),
      ];
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('handles varied board', () => {
      const enemy = createShadowBat();
      const board = createVariedBoard();
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('handles large board (18 cards)', () => {
      const enemy = createShadowBat();
      const board = createTestBoard(18);
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });
  });

  // ============================================================================
  // LIFECYCLE HOOKS: onTick
  // ============================================================================

  describe('onTick', () => {
    it('returns zero scoreDelta', () => {
      const enemy = createShadowBat();
      const result = enemy.onTick(1000, []);
      expect(result.scoreDelta).toBe(0);
    });

    it('returns zero healthDelta', () => {
      const enemy = createShadowBat();
      const result = enemy.onTick(1000, []);
      expect(result.healthDelta).toBe(0);
    });

    it('returns zero timeDelta', () => {
      const enemy = createShadowBat();
      const result = enemy.onTick(1000, []);
      expect(result.timeDelta).toBe(0);
    });

    it('returns empty cardsToRemove array', () => {
      const enemy = createShadowBat();
      const result = enemy.onTick(1000, []);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardModifications array', () => {
      const enemy = createShadowBat();
      const result = enemy.onTick(1000, []);
      expect(result.cardModifications).toEqual([]);
    });

    it('returns empty cardsToFlip array', () => {
      const enemy = createShadowBat();
      const result = enemy.onTick(1000, []);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createShadowBat();
      const result = enemy.onTick(1000, []);
      expect(result.events).toEqual([]);
    });

    it('returns instantDeath as false', () => {
      const enemy = createShadowBat();
      const result = enemy.onTick(1000, []);
      expect(result.instantDeath).toBe(false);
    });

    it('handles zero delta time', () => {
      const enemy = createShadowBat();
      const result = enemy.onTick(0, []);
      expect(result.scoreDelta).toBe(0);
      expect(result.healthDelta).toBe(0);
    });

    it('handles very small delta time', () => {
      const enemy = createShadowBat();
      const result = enemy.onTick(1, []);
      expect(result.scoreDelta).toBe(0);
      expect(result.healthDelta).toBe(0);
    });

    it('handles very large delta time', () => {
      const enemy = createShadowBat();
      const result = enemy.onTick(60000, []);
      expect(result.scoreDelta).toBe(0);
      expect(result.healthDelta).toBe(0);
      expect(result.instantDeath).toBe(false);
    });

    it('handles board with face-down cards', () => {
      const enemy = createShadowBat();
      const board = [createFaceDownCard(), createFaceDownCard()];
      const result = enemy.onTick(1000, board);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('does not accumulate effects over multiple ticks', () => {
      const enemy = createShadowBat();
      const board = createTestBoard(12);
      enemy.onTick(1000, board);
      enemy.onTick(1000, board);
      const result = enemy.onTick(1000, board);
      expect(result.scoreDelta).toBe(0);
      expect(result.healthDelta).toBe(0);
      expect(result.instantDeath).toBe(false);
    });
  });

  // ============================================================================
  // LIFECYCLE HOOKS: onCardDraw
  // ============================================================================

  describe('onCardDraw', () => {
    it('returns the same card unmodified', () => {
      const enemy = createShadowBat();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result).toEqual(card);
    });

    it('preserves card id', () => {
      const enemy = createShadowBat();
      const card = createCard({ id: 'test-123' });
      const result = enemy.onCardDraw(card);
      expect(result.id).toBe('test-123');
    });

    it('preserves card shape', () => {
      const enemy = createShadowBat();
      const card = createCard({ shape: 'squiggle' });
      const result = enemy.onCardDraw(card);
      expect(result.shape).toBe('squiggle');
    });

    it('preserves card color', () => {
      const enemy = createShadowBat();
      const card = createCard({ color: 'green' });
      const result = enemy.onCardDraw(card);
      expect(result.color).toBe('green');
    });

    it('preserves card number', () => {
      const enemy = createShadowBat();
      const card = createCard({ number: 3 });
      const result = enemy.onCardDraw(card);
      expect(result.number).toBe(3);
    });

    it('preserves card shading', () => {
      const enemy = createShadowBat();
      const card = createCard({ shading: 'striped' });
      const result = enemy.onCardDraw(card);
      expect(result.shading).toBe('striped');
    });

    it('does not add isDud property', () => {
      const enemy = createShadowBat();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isDud).toBeUndefined();
    });

    it('does not add isFaceDown property', () => {
      const enemy = createShadowBat();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isFaceDown).toBeUndefined();
    });

    it('does not add hasBomb property', () => {
      const enemy = createShadowBat();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.hasBomb).toBeUndefined();
    });

    it('does not add hasCountdown property', () => {
      const enemy = createShadowBat();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.hasCountdown).toBeUndefined();
    });

    it('preserves existing card properties', () => {
      const enemy = createShadowBat();
      const card = createCard({ onFire: true });
      const result = enemy.onCardDraw(card);
      expect(result.onFire).toBe(true);
    });

    it('handles face-down card input', () => {
      const enemy = createShadowBat();
      const card = createFaceDownCard();
      const result = enemy.onCardDraw(card);
      expect(result.isFaceDown).toBe(true);
      expect(result.wasOriginallyFaceDown).toBe(true);
    });

    it('handles triple card input', () => {
      const enemy = createShadowBat();
      const card = createTripleCard();
      const result = enemy.onCardDraw(card);
      expect(result.health).toBe(3);
    });
  });

  // ============================================================================
  // LIFECYCLE HOOKS: onValidMatch
  // ============================================================================

  describe('onValidMatch', () => {
    it('returns pointsMultiplier of 1', () => {
      const enemy = createShadowBat();
      const result = enemy.onValidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('returns zero timeDelta', () => {
      const enemy = createShadowBat();
      const result = enemy.onValidMatch([], []);
      expect(result.timeDelta).toBe(0);
    });

    it('returns empty cardsToRemove array', () => {
      const enemy = createShadowBat();
      const result = enemy.onValidMatch([], []);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardsToFlip array', () => {
      const enemy = createShadowBat();
      const result = enemy.onValidMatch([], []);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createShadowBat();
      const result = enemy.onValidMatch([], []);
      expect(result.events).toEqual([]);
    });

    it('handles matched cards array', () => {
      const enemy = createShadowBat();
      const matchedCards = [createCard(), createCard(), createCard()];
      const result = enemy.onValidMatch(matchedCards, []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.timeDelta).toBe(0);
    });

    it('handles matched cards with board', () => {
      const enemy = createShadowBat();
      const matchedCards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('handles board with face-down cards - does not flip them', () => {
      const enemy = createShadowBat();
      const matchedCards = [createCard(), createCard(), createCard()];
      const board = [
        createFaceDownCard(),
        createFaceDownCard(),
        ...createTestBoard(10),
      ];
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('does not modify points regardless of board state', () => {
      const enemy = createShadowBat();
      const board = createVariedBoard();
      const matchedCards = board.slice(0, 3);
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('does not steal time on match', () => {
      const enemy = createShadowBat();
      const matchedCards = [createCard(), createCard(), createCard()];
      const result = enemy.onValidMatch(matchedCards, createTestBoard(12));
      expect(result.timeDelta).toBe(0);
    });

    it('handles multiple consecutive matches', () => {
      const enemy = createShadowBat();
      const board = createTestBoard(12);

      const result1 = enemy.onValidMatch([createCard()], board);
      const result2 = enemy.onValidMatch([createCard()], board);
      const result3 = enemy.onValidMatch([createCard()], board);

      expect(result1.pointsMultiplier).toBe(1);
      expect(result2.pointsMultiplier).toBe(1);
      expect(result3.pointsMultiplier).toBe(1);
    });
  });

  // ============================================================================
  // LIFECYCLE HOOKS: onInvalidMatch
  // ============================================================================

  describe('onInvalidMatch', () => {
    it('returns pointsMultiplier of 1', () => {
      const enemy = createShadowBat();
      const result = enemy.onInvalidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('returns zero timeDelta', () => {
      const enemy = createShadowBat();
      const result = enemy.onInvalidMatch([], []);
      expect(result.timeDelta).toBe(0);
    });

    it('returns empty cardsToRemove array', () => {
      const enemy = createShadowBat();
      const result = enemy.onInvalidMatch([], []);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardsToFlip array', () => {
      const enemy = createShadowBat();
      const result = enemy.onInvalidMatch([], []);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createShadowBat();
      const result = enemy.onInvalidMatch([], []);
      expect(result.events).toEqual([]);
    });

    it('handles invalid match cards array', () => {
      const enemy = createShadowBat();
      const cards = [createCard(), createCard(), createCard()];
      const result = enemy.onInvalidMatch(cards, []);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('handles board with many cards', () => {
      const enemy = createShadowBat();
      const cards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(18);
      const result = enemy.onInvalidMatch(cards, board);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('does not penalize with extra card removal', () => {
      const enemy = createShadowBat();
      const board = createTestBoard(12);
      const cards = board.slice(0, 3);
      const result = enemy.onInvalidMatch(cards, board);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('handles multiple invalid matches', () => {
      const enemy = createShadowBat();
      const board = createTestBoard(12);

      const result1 = enemy.onInvalidMatch([createCard()], board);
      const result2 = enemy.onInvalidMatch([createCard()], board);

      expect(result1.cardsToRemove).toEqual([]);
      expect(result2.cardsToRemove).toEqual([]);
    });
  });

  // ============================================================================
  // LIFECYCLE HOOKS: onRoundEnd
  // ============================================================================

  describe('onRoundEnd', () => {
    it('does not throw when called', () => {
      const enemy = createShadowBat();
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('can be called multiple times', () => {
      const enemy = createShadowBat();
      expect(() => {
        enemy.onRoundEnd();
        enemy.onRoundEnd();
        enemy.onRoundEnd();
      }).not.toThrow();
    });

    it('returns undefined', () => {
      const enemy = createShadowBat();
      const result = enemy.onRoundEnd();
      expect(result).toBeUndefined();
    });

    it('can be called after onRoundStart', () => {
      const enemy = createShadowBat();
      enemy.onRoundStart(createTestBoard(12));
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('can be called after multiple ticks', () => {
      const enemy = createShadowBat();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);
      enemy.onTick(1000, board);
      enemy.onTick(1000, board);
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });
  });

  // ============================================================================
  // EFFECT COMPOSITION / INTEGRATION TESTS
  // ============================================================================

  describe('effect composition', () => {
    it('only applies WeaponCounterEffect for laser', () => {
      const enemy = createShadowBat();
      const statModifiers = enemy.getStatModifiers();
      const uiModifiers = enemy.getUIModifiers();

      // Only laser should be affected
      expect(statModifiers.laserChanceReduction).toBe(20);
      expect(uiModifiers.weaponCounters).toContainEqual({ type: 'laser', reduction: 20 });

      // No other effects
      expect(uiModifiers.showInactivityBar).toBeUndefined();
      expect(uiModifiers.showScoreDecay).toBeUndefined();
    });

    it('has consistent behavior across a full round lifecycle', () => {
      const enemy = createShadowBat();
      const board = createTestBoard(12);

      // Start round
      const startResult = enemy.onRoundStart(board);
      expect(startResult.cardModifications).toEqual([]);
      expect(startResult.events).toEqual([]);

      // Multiple ticks
      for (let i = 0; i < 60; i++) {
        const tickResult = enemy.onTick(1000, board);
        expect(tickResult.healthDelta).toBe(0);
        expect(tickResult.instantDeath).toBe(false);
      }

      // Draw a card
      const newCard = createCard();
      const drawnCard = enemy.onCardDraw(newCard);
      expect(drawnCard).toEqual(newCard);

      // Make matches
      const matchResult = enemy.onValidMatch([createCard()], board);
      expect(matchResult.pointsMultiplier).toBe(1);

      // End round
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });
  });

  // ============================================================================
  // EDGE CASES AND SPECIAL SCENARIOS
  // ============================================================================

  describe('edge cases', () => {
    it('handles board with all face-down cards', () => {
      const enemy = createShadowBat();
      const board = Array(12).fill(null).map(() => createFaceDownCard());

      const startResult = enemy.onRoundStart(board);
      expect(startResult.cardModifications).toEqual([]);

      const tickResult = enemy.onTick(1000, board);
      expect(tickResult.cardsToFlip).toEqual([]);
    });

    it('handles board with all triple cards', () => {
      const enemy = createShadowBat();
      const board = Array(12).fill(null).map(() => createTripleCard());

      const startResult = enemy.onRoundStart(board);
      expect(startResult.cardModifications).toEqual([]);
    });

    it('handles empty board in onValidMatch', () => {
      const enemy = createShadowBat();
      const matchedCards = [createCard(), createCard(), createCard()];
      const result = enemy.onValidMatch(matchedCards, []);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('handles single card board', () => {
      const enemy = createShadowBat();
      const board = [createCard()];

      const startResult = enemy.onRoundStart(board);
      const tickResult = enemy.onTick(1000, board);

      expect(startResult.cardModifications).toEqual([]);
      expect(tickResult.cardsToRemove).toEqual([]);
    });

    it('defeat condition handles stats with many shapes matched', () => {
      const enemy = createShadowBat();
      const shapes = new Set<Shape>(['oval', 'squiggle', 'diamond']);
      const stats = createRoundStats({ allDifferentMatches: 0, shapesMatched: shapes });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('defeat condition handles stats with many colors matched', () => {
      const enemy = createShadowBat();
      const colors = new Set<Color>(['red', 'green', 'purple']);
      const stats = createRoundStats({ allDifferentMatches: 0, colorsMatched: colors });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('handles cards with special states in onCardDraw', () => {
      const enemy = createShadowBat();
      const specialCard = createCard({
        onFire: true,
        hasBomb: true,
        bombTimer: 5000,
      });

      const result = enemy.onCardDraw(specialCard);
      expect(result.onFire).toBe(true);
      expect(result.hasBomb).toBe(true);
      expect(result.bombTimer).toBe(5000);
    });

    it('handles selected cards in board', () => {
      const enemy = createShadowBat();
      const board = [
        createCard({ selected: true }),
        createCard({ selected: true }),
        createCard({ selected: false }),
      ];

      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
    });
  });

  // ============================================================================
  // FACTORY AND REGISTRATION TESTS
  // ============================================================================

  describe('factory', () => {
    it('createShadowBat is a function', () => {
      expect(typeof createShadowBat).toBe('function');
    });

    it('createShadowBat returns an object', () => {
      const enemy = createShadowBat();
      expect(typeof enemy).toBe('object');
      expect(enemy).not.toBeNull();
    });

    it('createShadowBat returns an object with all required methods', () => {
      const enemy = createShadowBat();
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

    it('createShadowBat returns object with all required metadata properties', () => {
      const enemy = createShadowBat();
      expect(enemy).toHaveProperty('name');
      expect(enemy).toHaveProperty('tier');
      expect(enemy).toHaveProperty('icon');
      expect(enemy).toHaveProperty('description');
      expect(enemy).toHaveProperty('defeatConditionText');
    });

    it('multiple instances are independent', () => {
      const enemy1 = createShadowBat();
      const enemy2 = createShadowBat();

      // Start rounds separately
      enemy1.onRoundStart(createTestBoard(12));
      enemy2.onRoundStart(createTestBoard(6));

      // They should both function independently
      const result1 = enemy1.onTick(1000, createTestBoard(12));
      const result2 = enemy2.onTick(1000, createTestBoard(6));

      expect(result1.healthDelta).toBe(0);
      expect(result2.healthDelta).toBe(0);
    });
  });
});
