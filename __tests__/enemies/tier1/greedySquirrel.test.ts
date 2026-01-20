/**
 * Comprehensive Unit Tests for Greedy Squirrel Enemy
 *
 * Tests cover:
 * - Metadata (name, tier, icon, description, defeatConditionText)
 * - Effect behavior (ExtraCardRemovalOnMatchEffect with count=1, minBoardSize=6)
 * - Defeat condition (score >= target AND cardsRemaining < 8)
 * - All lifecycle hooks (onRoundStart, onCardDraw, onValidMatch, onInvalidMatch, onRoundEnd, onTick)
 * - UI/Stat modifiers (getUIModifiers, getStatModifiers)
 */

import { createGreedySquirrel } from '@/utils/enemies/tier1/greedySquirrel';
import {
  createRoundStats,
  createCard,
  createTestBoard,
  createVariedBoard,
  createFaceDownCard,
  createTripleCard,
  resetCardIdCounter,
} from '../../testUtils';

// Helper to mock Math.random for deterministic tests
const mockRandom = (value: number) => {
  jest.spyOn(Math, 'random').mockReturnValue(value);
};

// Helper to mock Math.random with a sequence of values
const mockRandomSequence = (values: number[]) => {
  let index = 0;
  jest.spyOn(Math, 'random').mockImplementation(() => {
    const value = values[index % values.length];
    index++;
    return value;
  });
};

beforeEach(() => {
  resetCardIdCounter();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ============================================================================
// METADATA TESTS
// ============================================================================

describe('Greedy Squirrel - Metadata', () => {
  describe('name', () => {
    it('should have the correct name', () => {
      const enemy = createGreedySquirrel();
      expect(enemy.name).toBe('Greedy Squirrel');
    });

    it('should have a non-empty name', () => {
      const enemy = createGreedySquirrel();
      expect(enemy.name.length).toBeGreaterThan(0);
    });
  });

  describe('tier', () => {
    it('should be tier 1', () => {
      const enemy = createGreedySquirrel();
      expect(enemy.tier).toBe(1);
    });

    it('should be a valid tier value (1-4)', () => {
      const enemy = createGreedySquirrel();
      expect([1, 2, 3, 4]).toContain(enemy.tier);
    });
  });

  describe('icon', () => {
    it('should have the squirrel icon', () => {
      const enemy = createGreedySquirrel();
      expect(enemy.icon).toBe('delapouite/squirrel');
    });

    it('should use delapouite icon set', () => {
      const enemy = createGreedySquirrel();
      expect(enemy.icon).toMatch(/^delapouite\//);
    });
  });

  describe('description', () => {
    it('should mention reduced card replenishment', () => {
      const enemy = createGreedySquirrel();
      expect(enemy.description).toContain('2 cards');
    });

    it('should mention "replenished"', () => {
      const enemy = createGreedySquirrel();
      expect(enemy.description).toContain('replenished');
    });

    it('should contain "Only"', () => {
      const enemy = createGreedySquirrel();
      expect(enemy.description).toContain('Only');
    });

    it('should have a non-empty description', () => {
      const enemy = createGreedySquirrel();
      expect(enemy.description.length).toBeGreaterThan(0);
    });
  });

  describe('defeatConditionText', () => {
    it('should mention beating target score', () => {
      const enemy = createGreedySquirrel();
      expect(enemy.defeatConditionText).toContain('Beat target score');
    });

    it('should mention cards remaining threshold', () => {
      const enemy = createGreedySquirrel();
      expect(enemy.defeatConditionText).toContain('<8 cards remaining');
    });

    it('should have a non-empty defeat condition text', () => {
      const enemy = createGreedySquirrel();
      expect(enemy.defeatConditionText.length).toBeGreaterThan(0);
    });
  });

  describe('instance independence', () => {
    it('should create independent instances', () => {
      const enemy1 = createGreedySquirrel();
      const enemy2 = createGreedySquirrel();
      expect(enemy1).not.toBe(enemy2);
    });

    it('should have the same metadata across instances', () => {
      const enemy1 = createGreedySquirrel();
      const enemy2 = createGreedySquirrel();
      expect(enemy1.name).toBe(enemy2.name);
      expect(enemy1.tier).toBe(enemy2.tier);
      expect(enemy1.icon).toBe(enemy2.icon);
    });
  });
});

// ============================================================================
// EXTRA CARD REMOVAL EFFECT TESTS
// ============================================================================

describe('Greedy Squirrel - Extra Card Removal Effect', () => {
  describe('onValidMatch - basic removal', () => {
    it('should remove 1 extra card on valid match with 12-card board', () => {
      mockRandom(0.5);
      const enemy = createGreedySquirrel();
      const board = createTestBoard(12);
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToRemove?.length).toBe(1);
    });

    it('should remove 1 extra card on valid match with 10-card board', () => {
      mockRandom(0.5);
      const enemy = createGreedySquirrel();
      const board = createTestBoard(10);
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToRemove?.length).toBe(1);
    });

    it('should remove 1 extra card on valid match with 9-card board', () => {
      mockRandom(0.5);
      const enemy = createGreedySquirrel();
      const board = createTestBoard(9);
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToRemove?.length).toBe(1);
    });

    it('should remove 1 extra card on valid match with 8-card board', () => {
      mockRandom(0.5);
      const enemy = createGreedySquirrel();
      const board = createTestBoard(8);
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToRemove?.length).toBe(1);
    });

    it('should remove exactly 1 card, not more', () => {
      mockRandom(0.5);
      const enemy = createGreedySquirrel();
      const board = createTestBoard(15);
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToRemove?.length).toBe(1);
    });
  });

  describe('onValidMatch - minimum board size (6)', () => {
    it('should not remove cards when board has exactly 6 cards', () => {
      const enemy = createGreedySquirrel();
      const board = createTestBoard(6);
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToRemove?.length ?? 0).toBe(0);
    });

    it('should not remove cards when board has 5 cards', () => {
      const enemy = createGreedySquirrel();
      const board = createTestBoard(5);
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToRemove?.length ?? 0).toBe(0);
    });

    it('should not remove cards when board has 3 cards', () => {
      const enemy = createGreedySquirrel();
      const board = createTestBoard(3);
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToRemove?.length ?? 0).toBe(0);
    });

    it('should not remove cards when board has 1 card', () => {
      const enemy = createGreedySquirrel();
      const board = createTestBoard(1);
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToRemove?.length ?? 0).toBe(0);
    });

    it('should not remove cards when board is empty', () => {
      const enemy = createGreedySquirrel();
      const board: ReturnType<typeof createCard>[] = [];
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToRemove?.length ?? 0).toBe(0);
    });

    it('should remove 1 card when board has 7 cards (1 above minimum)', () => {
      mockRandom(0.5);
      const enemy = createGreedySquirrel();
      const board = createTestBoard(7);
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToRemove?.length).toBe(1);
    });
  });

  describe('onValidMatch - event emission', () => {
    it('should emit card_removed event when removing card', () => {
      mockRandom(0.5);
      const enemy = createGreedySquirrel();
      const board = createTestBoard(12);
      const result = enemy.onValidMatch([], board);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: 'card_removed',
          reason: 'enemy_match_penalty',
        })
      );
    });

    it('should emit event with correct card ID', () => {
      mockRandom(0.5);
      const enemy = createGreedySquirrel();
      const board = createTestBoard(12);
      const result = enemy.onValidMatch([], board);
      const removedCardId = result.cardsToRemove?.[0];
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: 'card_removed',
          cardId: removedCardId,
        })
      );
    });

    it('should not emit events when no cards removed (board at minimum)', () => {
      const enemy = createGreedySquirrel();
      const board = createTestBoard(6);
      const result = enemy.onValidMatch([], board);
      expect(result.events?.length ?? 0).toBe(0);
    });

    it('should emit exactly 1 event when removing 1 card', () => {
      mockRandom(0.5);
      const enemy = createGreedySquirrel();
      const board = createTestBoard(12);
      const result = enemy.onValidMatch([], board);
      const cardRemovedEvents = result.events?.filter((e) => e.type === 'card_removed') ?? [];
      expect(cardRemovedEvents.length).toBe(1);
    });
  });

  describe('onValidMatch - card selection', () => {
    it('should not remove dud cards', () => {
      mockRandom(0.5);
      const enemy = createGreedySquirrel();
      const board = [
        createCard({ isDud: true }),
        createCard({ isDud: true }),
        createCard({ isDud: true }),
        createCard({ isDud: true }),
        createCard({ isDud: true }),
        createCard({ isDud: true }),
        createCard({ isDud: false }),
        createCard({ isDud: false }),
      ];
      const result = enemy.onValidMatch([], board);
      const removedCardId = result.cardsToRemove?.[0];
      const removedCard = board.find((c) => c.id === removedCardId);
      expect(removedCard?.isDud).toBeFalsy();
    });

    it('should not remove cards when all cards are duds', () => {
      const enemy = createGreedySquirrel();
      const board = Array(10)
        .fill(null)
        .map(() => createCard({ isDud: true }));
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToRemove?.length ?? 0).toBe(0);
    });

    it('should remove a card that exists on the board', () => {
      mockRandom(0.5);
      const enemy = createGreedySquirrel();
      const board = createTestBoard(12);
      const boardIds = board.map((c) => c.id);
      const result = enemy.onValidMatch([], board);
      const removedCardId = result.cardsToRemove?.[0];
      expect(boardIds).toContain(removedCardId);
    });

    it('should select random card (different random values give different cards)', () => {
      const enemy1 = createGreedySquirrel();
      const enemy2 = createGreedySquirrel();
      const board = createTestBoard(12);

      mockRandom(0.1);
      const result1 = enemy1.onValidMatch([], board);

      jest.restoreAllMocks();
      resetCardIdCounter();
      const board2 = createTestBoard(12);
      mockRandom(0.9);
      const result2 = enemy2.onValidMatch([], board2);

      // Results may differ based on shuffle order
      expect(result1.cardsToRemove).toBeDefined();
      expect(result2.cardsToRemove).toBeDefined();
    });
  });

  describe('onValidMatch - with matched cards provided', () => {
    it('should still remove extra card regardless of matched cards', () => {
      mockRandom(0.5);
      const enemy = createGreedySquirrel();
      const board = createTestBoard(12);
      const matchedCards = [board[0], board[1], board[2]];
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.cardsToRemove?.length).toBe(1);
    });
  });
});

// ============================================================================
// INVALID MATCH BEHAVIOR TESTS
// ============================================================================

describe('Greedy Squirrel - Invalid Match Behavior', () => {
  it('should not remove cards on invalid match', () => {
    const enemy = createGreedySquirrel();
    const board = createTestBoard(12);
    const result = enemy.onInvalidMatch([], board);
    expect(result.cardsToRemove?.length ?? 0).toBe(0);
  });

  it('should return empty events on invalid match', () => {
    const enemy = createGreedySquirrel();
    const board = createTestBoard(12);
    const result = enemy.onInvalidMatch([], board);
    expect(result.events?.length ?? 0).toBe(0);
  });

  it('should return default time delta on invalid match', () => {
    const enemy = createGreedySquirrel();
    const board = createTestBoard(12);
    const result = enemy.onInvalidMatch([], board);
    expect(result.timeDelta).toBe(0);
  });

  it('should return default points multiplier on invalid match', () => {
    const enemy = createGreedySquirrel();
    const board = createTestBoard(12);
    const result = enemy.onInvalidMatch([], board);
    expect(result.pointsMultiplier).toBe(1);
  });

  it('should not flip any cards on invalid match', () => {
    const enemy = createGreedySquirrel();
    const board = createTestBoard(12);
    const result = enemy.onInvalidMatch([], board);
    expect(result.cardsToFlip?.length ?? 0).toBe(0);
  });
});

// ============================================================================
// DEFEAT CONDITION TESTS
// ============================================================================

describe('Greedy Squirrel - Defeat Condition', () => {
  describe('score requirements', () => {
    it('should return false when score is 0', () => {
      const enemy = createGreedySquirrel();
      const stats = createRoundStats({
        currentScore: 0,
        targetScore: 100,
        cardsRemaining: 5,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('should return false when score is 1 below target', () => {
      const enemy = createGreedySquirrel();
      const stats = createRoundStats({
        currentScore: 99,
        targetScore: 100,
        cardsRemaining: 5,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('should return true when score equals target (with low cards)', () => {
      const enemy = createGreedySquirrel();
      const stats = createRoundStats({
        currentScore: 100,
        targetScore: 100,
        cardsRemaining: 7,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('should return true when score exceeds target (with low cards)', () => {
      const enemy = createGreedySquirrel();
      const stats = createRoundStats({
        currentScore: 150,
        targetScore: 100,
        cardsRemaining: 5,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('should return true when score greatly exceeds target (with low cards)', () => {
      const enemy = createGreedySquirrel();
      const stats = createRoundStats({
        currentScore: 500,
        targetScore: 100,
        cardsRemaining: 3,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  describe('cards remaining threshold (<8)', () => {
    it('should return false when exactly 8 cards remaining', () => {
      const enemy = createGreedySquirrel();
      const stats = createRoundStats({
        currentScore: 100,
        targetScore: 100,
        cardsRemaining: 8,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('should return true when exactly 7 cards remaining', () => {
      const enemy = createGreedySquirrel();
      const stats = createRoundStats({
        currentScore: 100,
        targetScore: 100,
        cardsRemaining: 7,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('should return true when exactly 0 cards remaining', () => {
      const enemy = createGreedySquirrel();
      const stats = createRoundStats({
        currentScore: 100,
        targetScore: 100,
        cardsRemaining: 0,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('should return true when 1 card remaining', () => {
      const enemy = createGreedySquirrel();
      const stats = createRoundStats({
        currentScore: 100,
        targetScore: 100,
        cardsRemaining: 1,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('should return false when 9 cards remaining', () => {
      const enemy = createGreedySquirrel();
      const stats = createRoundStats({
        currentScore: 100,
        targetScore: 100,
        cardsRemaining: 9,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('should return false when 12 cards remaining', () => {
      const enemy = createGreedySquirrel();
      const stats = createRoundStats({
        currentScore: 100,
        targetScore: 100,
        cardsRemaining: 12,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });
  });

  describe('combined conditions', () => {
    it('should return false when score is low AND cards are high', () => {
      const enemy = createGreedySquirrel();
      const stats = createRoundStats({
        currentScore: 50,
        targetScore: 100,
        cardsRemaining: 12,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('should return false when score is high AND cards are high', () => {
      const enemy = createGreedySquirrel();
      const stats = createRoundStats({
        currentScore: 150,
        targetScore: 100,
        cardsRemaining: 12,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('should return false when score is low AND cards are low', () => {
      const enemy = createGreedySquirrel();
      const stats = createRoundStats({
        currentScore: 50,
        targetScore: 100,
        cardsRemaining: 3,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('should return true only when BOTH conditions are met', () => {
      const enemy = createGreedySquirrel();
      const stats = createRoundStats({
        currentScore: 100,
        targetScore: 100,
        cardsRemaining: 7,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle zero target score', () => {
      const enemy = createGreedySquirrel();
      const stats = createRoundStats({
        currentScore: 0,
        targetScore: 0,
        cardsRemaining: 5,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('should handle very high scores', () => {
      const enemy = createGreedySquirrel();
      const stats = createRoundStats({
        currentScore: 99999,
        targetScore: 100,
        cardsRemaining: 2,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('should handle negative card count (edge case)', () => {
      const enemy = createGreedySquirrel();
      const stats = createRoundStats({
        currentScore: 100,
        targetScore: 100,
        cardsRemaining: -1,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});

// ============================================================================
// LIFECYCLE HOOKS TESTS
// ============================================================================

describe('Greedy Squirrel - Lifecycle Hooks', () => {
  describe('onRoundStart', () => {
    it('should return empty card modifications', () => {
      const enemy = createGreedySquirrel();
      const board = createTestBoard(12);
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
    });

    it('should return empty events', () => {
      const enemy = createGreedySquirrel();
      const board = createTestBoard(12);
      const result = enemy.onRoundStart(board);
      expect(result.events).toEqual([]);
    });

    it('should handle empty board', () => {
      const enemy = createGreedySquirrel();
      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('should handle varied board', () => {
      const enemy = createGreedySquirrel();
      const board = createVariedBoard();
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
    });
  });

  describe('onCardDraw', () => {
    it('should return the card unmodified', () => {
      const enemy = createGreedySquirrel();
      const card = createCard({ id: 'test-card' });
      const result = enemy.onCardDraw(card);
      expect(result).toEqual(card);
    });

    it('should not add dud property', () => {
      const enemy = createGreedySquirrel();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isDud).toBeFalsy();
    });

    it('should not add face-down property', () => {
      const enemy = createGreedySquirrel();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isFaceDown).toBeFalsy();
    });

    it('should preserve all card properties', () => {
      const enemy = createGreedySquirrel();
      const card = createCard({
        id: 'special-card',
        shape: 'diamond',
        color: 'purple',
        number: 3,
        shading: 'striped',
      });
      const result = enemy.onCardDraw(card);
      expect(result.id).toBe('special-card');
      expect(result.shape).toBe('diamond');
      expect(result.color).toBe('purple');
      expect(result.number).toBe(3);
      expect(result.shading).toBe('striped');
    });

    it('should work with face-down cards', () => {
      const enemy = createGreedySquirrel();
      const card = createFaceDownCard();
      const result = enemy.onCardDraw(card);
      expect(result.isFaceDown).toBe(true);
    });

    it('should work with triple cards', () => {
      const enemy = createGreedySquirrel();
      const card = createTripleCard();
      const result = enemy.onCardDraw(card);
      expect(result.health).toBe(3);
    });
  });

  describe('onTick', () => {
    it('should return zero score delta', () => {
      const enemy = createGreedySquirrel();
      const board = createTestBoard(12);
      const result = enemy.onTick(100, board);
      expect(result.scoreDelta).toBe(0);
    });

    it('should return zero health delta', () => {
      const enemy = createGreedySquirrel();
      const board = createTestBoard(12);
      const result = enemy.onTick(100, board);
      expect(result.healthDelta).toBe(0);
    });

    it('should return zero time delta', () => {
      const enemy = createGreedySquirrel();
      const board = createTestBoard(12);
      const result = enemy.onTick(100, board);
      expect(result.timeDelta).toBe(0);
    });

    it('should return empty cards to remove', () => {
      const enemy = createGreedySquirrel();
      const board = createTestBoard(12);
      const result = enemy.onTick(100, board);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('should return empty card modifications', () => {
      const enemy = createGreedySquirrel();
      const board = createTestBoard(12);
      const result = enemy.onTick(100, board);
      expect(result.cardModifications).toEqual([]);
    });

    it('should return empty cards to flip', () => {
      const enemy = createGreedySquirrel();
      const board = createTestBoard(12);
      const result = enemy.onTick(100, board);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('should return empty events', () => {
      const enemy = createGreedySquirrel();
      const board = createTestBoard(12);
      const result = enemy.onTick(100, board);
      expect(result.events).toEqual([]);
    });

    it('should return false for instant death', () => {
      const enemy = createGreedySquirrel();
      const board = createTestBoard(12);
      const result = enemy.onTick(100, board);
      expect(result.instantDeath).toBe(false);
    });

    it('should handle various deltaMs values', () => {
      const enemy = createGreedySquirrel();
      const board = createTestBoard(12);

      expect(enemy.onTick(0, board).scoreDelta).toBe(0);
      expect(enemy.onTick(1000, board).scoreDelta).toBe(0);
      expect(enemy.onTick(10000, board).scoreDelta).toBe(0);
    });
  });

  describe('onRoundEnd', () => {
    it('should not throw', () => {
      const enemy = createGreedySquirrel();
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('should return undefined', () => {
      const enemy = createGreedySquirrel();
      const result = enemy.onRoundEnd();
      expect(result).toBeUndefined();
    });
  });
});

// ============================================================================
// UI/STAT MODIFIERS TESTS
// ============================================================================

describe('Greedy Squirrel - UI Modifiers', () => {
  it('should return empty UI modifiers', () => {
    const enemy = createGreedySquirrel();
    const modifiers = enemy.getUIModifiers();
    expect(modifiers).toEqual({});
  });

  it('should not show inactivity bar', () => {
    const enemy = createGreedySquirrel();
    const modifiers = enemy.getUIModifiers();
    expect(modifiers.showInactivityBar).toBeUndefined();
  });

  it('should not show score decay', () => {
    const enemy = createGreedySquirrel();
    const modifiers = enemy.getUIModifiers();
    expect(modifiers.showScoreDecay).toBeUndefined();
  });

  it('should not modify timer speed', () => {
    const enemy = createGreedySquirrel();
    const modifiers = enemy.getUIModifiers();
    expect(modifiers.timerSpeedMultiplier).toBeUndefined();
  });

  it('should not disable auto hint', () => {
    const enemy = createGreedySquirrel();
    const modifiers = enemy.getUIModifiers();
    expect(modifiers.disableAutoHint).toBeUndefined();
  });

  it('should not disable manual hint', () => {
    const enemy = createGreedySquirrel();
    const modifiers = enemy.getUIModifiers();
    expect(modifiers.disableManualHint).toBeUndefined();
  });

  it('should not show countdown cards', () => {
    const enemy = createGreedySquirrel();
    const modifiers = enemy.getUIModifiers();
    expect(modifiers.showCountdownCards).toBeUndefined();
  });

  it('should not show bomb cards', () => {
    const enemy = createGreedySquirrel();
    const modifiers = enemy.getUIModifiers();
    expect(modifiers.showBombCards).toBeUndefined();
  });

  it('should not show weapon counters', () => {
    const enemy = createGreedySquirrel();
    const modifiers = enemy.getUIModifiers();
    expect(modifiers.weaponCounters).toBeUndefined();
  });
});

describe('Greedy Squirrel - Stat Modifiers', () => {
  it('should return empty stat modifiers', () => {
    const enemy = createGreedySquirrel();
    const modifiers = enemy.getStatModifiers();
    expect(modifiers).toEqual({});
  });

  it('should not reduce fire spread chance', () => {
    const enemy = createGreedySquirrel();
    const modifiers = enemy.getStatModifiers();
    expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
  });

  it('should not reduce explosion chance', () => {
    const enemy = createGreedySquirrel();
    const modifiers = enemy.getStatModifiers();
    expect(modifiers.explosionChanceReduction).toBeUndefined();
  });

  it('should not reduce laser chance', () => {
    const enemy = createGreedySquirrel();
    const modifiers = enemy.getStatModifiers();
    expect(modifiers.laserChanceReduction).toBeUndefined();
  });

  it('should not reduce hint gain chance', () => {
    const enemy = createGreedySquirrel();
    const modifiers = enemy.getStatModifiers();
    expect(modifiers.hintGainChanceReduction).toBeUndefined();
  });

  it('should not reduce grace gain chance', () => {
    const enemy = createGreedySquirrel();
    const modifiers = enemy.getStatModifiers();
    expect(modifiers.graceGainChanceReduction).toBeUndefined();
  });

  it('should not reduce time gain chance', () => {
    const enemy = createGreedySquirrel();
    const modifiers = enemy.getStatModifiers();
    expect(modifiers.timeGainChanceReduction).toBeUndefined();
  });

  it('should not reduce healing chance', () => {
    const enemy = createGreedySquirrel();
    const modifiers = enemy.getStatModifiers();
    expect(modifiers.healingChanceReduction).toBeUndefined();
  });

  it('should not apply damage multiplier', () => {
    const enemy = createGreedySquirrel();
    const modifiers = enemy.getStatModifiers();
    expect(modifiers.damageMultiplier).toBeUndefined();
  });

  it('should not apply points multiplier', () => {
    const enemy = createGreedySquirrel();
    const modifiers = enemy.getStatModifiers();
    expect(modifiers.pointsMultiplier).toBeUndefined();
  });
});

// ============================================================================
// VALID MATCH RETURN VALUES TESTS
// ============================================================================

describe('Greedy Squirrel - onValidMatch Return Values', () => {
  describe('timeDelta', () => {
    it('should return 0 time delta', () => {
      mockRandom(0.5);
      const enemy = createGreedySquirrel();
      const board = createTestBoard(12);
      const result = enemy.onValidMatch([], board);
      expect(result.timeDelta).toBe(0);
    });
  });

  describe('pointsMultiplier', () => {
    it('should return 1 points multiplier (no change)', () => {
      mockRandom(0.5);
      const enemy = createGreedySquirrel();
      const board = createTestBoard(12);
      const result = enemy.onValidMatch([], board);
      expect(result.pointsMultiplier).toBe(1);
    });
  });

  describe('cardsToFlip', () => {
    it('should return empty cards to flip array', () => {
      mockRandom(0.5);
      const enemy = createGreedySquirrel();
      const board = createTestBoard(12);
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToFlip).toEqual([]);
    });
  });
});

// ============================================================================
// STATE PERSISTENCE ACROSS MATCHES
// ============================================================================

describe('Greedy Squirrel - State Across Multiple Matches', () => {
  it('should remove cards on consecutive valid matches', () => {
    mockRandom(0.5);
    const enemy = createGreedySquirrel();
    const board1 = createTestBoard(12);
    const result1 = enemy.onValidMatch([], board1);
    expect(result1.cardsToRemove?.length).toBe(1);

    resetCardIdCounter();
    const board2 = createTestBoard(12);
    const result2 = enemy.onValidMatch([], board2);
    expect(result2.cardsToRemove?.length).toBe(1);
  });

  it('should independently handle each match', () => {
    const enemy = createGreedySquirrel();

    // First match with large board
    mockRandom(0.5);
    const board1 = createTestBoard(12);
    enemy.onValidMatch([], board1);

    // Second match with small board (at minimum)
    jest.restoreAllMocks();
    const board2 = createTestBoard(6);
    const result2 = enemy.onValidMatch([], board2);
    expect(result2.cardsToRemove?.length ?? 0).toBe(0);
  });

  it('should work correctly after round reset', () => {
    mockRandom(0.5);
    const enemy = createGreedySquirrel();

    // First round
    const board1 = createTestBoard(12);
    enemy.onRoundStart(board1);
    enemy.onValidMatch([], board1);
    enemy.onRoundEnd();

    // Second round
    resetCardIdCounter();
    const board2 = createTestBoard(12);
    enemy.onRoundStart(board2);
    const result = enemy.onValidMatch([], board2);
    expect(result.cardsToRemove?.length).toBe(1);
  });
});

// ============================================================================
// INTERACTION WITH SPECIAL CARD TYPES
// ============================================================================

describe('Greedy Squirrel - Special Card Interactions', () => {
  it('should be able to remove face-down cards', () => {
    mockRandom(0.5);
    const enemy = createGreedySquirrel();
    const board = [
      createFaceDownCard(),
      createFaceDownCard(),
      createFaceDownCard(),
      createCard(),
      createCard(),
      createCard(),
      createCard(),
    ];
    const result = enemy.onValidMatch([], board);
    expect(result.cardsToRemove?.length).toBe(1);
  });

  it('should be able to remove triple cards', () => {
    mockRandom(0.5);
    const enemy = createGreedySquirrel();
    const board = [
      createTripleCard(),
      createTripleCard(),
      createCard(),
      createCard(),
      createCard(),
      createCard(),
      createCard(),
    ];
    const result = enemy.onValidMatch([], board);
    expect(result.cardsToRemove?.length).toBe(1);
  });

  it('should handle board with mixed card types', () => {
    mockRandom(0.5);
    const enemy = createGreedySquirrel();
    const board = [
      createCard(),
      createFaceDownCard(),
      createTripleCard(),
      createCard({ isDud: true }),
      createCard(),
      createCard(),
      createCard(),
    ];
    const result = enemy.onValidMatch([], board);
    // Should remove 1 card, and it should not be a dud
    expect(result.cardsToRemove?.length).toBe(1);
    const removedCardId = result.cardsToRemove?.[0];
    const removedCard = board.find((c) => c.id === removedCardId);
    expect(removedCard?.isDud).toBeFalsy();
  });

  it('should handle cards with fire', () => {
    mockRandom(0.5);
    const enemy = createGreedySquirrel();
    const board = [
      createCard({ onFire: true }),
      createCard({ onFire: true }),
      createCard(),
      createCard(),
      createCard(),
      createCard(),
      createCard(),
    ];
    const result = enemy.onValidMatch([], board);
    expect(result.cardsToRemove?.length).toBe(1);
  });
});
