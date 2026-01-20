/**
 * Comprehensive Unit Tests for Iron Shell enemy.
 *
 * Iron Shell - Tier 1 Enemy
 * Effect: One card needs 3 matches to clear (triple health)
 * Defeat Condition: Clear the triple-health card
 */
import type { Card } from '@/types';
import { createIronShell } from '@/utils/enemies/tier1/ironShell';
import {
  createRoundStats,
  createCard,
  createTestBoard,
  createTripleCard,
  createFaceDownCard,
  createVariedBoard,
  resetCardIdCounter,
} from '../../testUtils';

// Mock Math.random for deterministic tests
const mockRandom = (value: number) => {
  jest.spyOn(Math, 'random').mockReturnValue(value);
};

// Mock Math.random to return sequence of values
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

describe('Iron Shell', () => {
  // ==========================================================================
  // METADATA TESTS
  // ==========================================================================
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createIronShell();
      expect(enemy.name).toBe('Iron Shell');
    });

    it('has correct tier (1)', () => {
      const enemy = createIronShell();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon (lorc/turtle)', () => {
      const enemy = createIronShell();
      expect(enemy.icon).toBe('lorc/turtle');
    });

    it('has description containing "3 matches"', () => {
      const enemy = createIronShell();
      expect(enemy.description).toContain('3 matches');
    });

    it('has description containing "card"', () => {
      const enemy = createIronShell();
      expect(enemy.description.toLowerCase()).toContain('card');
    });

    it('has defeat condition text containing "triple-health"', () => {
      const enemy = createIronShell();
      expect(enemy.defeatConditionText).toContain('triple-health');
    });

    it('has defeat condition text containing "Clear"', () => {
      const enemy = createIronShell();
      expect(enemy.defeatConditionText).toContain('Clear');
    });

    it('has defeat condition text that describes the goal', () => {
      const enemy = createIronShell();
      expect(enemy.defeatConditionText.length).toBeGreaterThan(10);
    });

    it('description is user-friendly (not too technical)', () => {
      const enemy = createIronShell();
      expect(enemy.description).not.toContain('tripleCardsCleared');
      expect(enemy.description).not.toContain('health: 3');
    });

    it('creates independent instances', () => {
      const enemy1 = createIronShell();
      const enemy2 = createIronShell();
      expect(enemy1).not.toBe(enemy2);
    });
  });

  // ==========================================================================
  // EFFECT TESTS - TRIPLE CARD PLACEMENT (onRoundStart)
  // ==========================================================================
  describe('triple card effect - onRoundStart', () => {
    it('places exactly one triple card on round start', () => {
      const enemy = createIronShell();
      const cards = createTestBoard(12);
      const result = enemy.onRoundStart(cards);

      expect(result.cardModifications.length).toBe(1);
      expect(result.cardModifications[0].changes.health).toBe(3);
    });

    it('places triple card on one of the board cards', () => {
      const enemy = createIronShell();
      const cards = createTestBoard(5);
      const cardIds = cards.map((c) => c.id);
      const result = enemy.onRoundStart(cards);

      expect(cardIds).toContain(result.cardModifications[0].cardId);
    });

    it('returns cardId as string', () => {
      const enemy = createIronShell();
      const cards = createTestBoard(3);
      const result = enemy.onRoundStart(cards);

      expect(typeof result.cardModifications[0].cardId).toBe('string');
    });

    it('returns health as number 3', () => {
      const enemy = createIronShell();
      const cards = createTestBoard(3);
      const result = enemy.onRoundStart(cards);

      expect(result.cardModifications[0].changes.health).toBe(3);
    });

    it('returns empty events array', () => {
      const enemy = createIronShell();
      const cards = createTestBoard(3);
      const result = enemy.onRoundStart(cards);

      expect(result.events).toEqual([]);
    });

    it('picks a card deterministically when random returns 0', () => {
      mockRandom(0);
      const enemy = createIronShell();
      const cards = [
        createCard({ id: 'first-card' }),
        createCard({ id: 'second-card' }),
        createCard({ id: 'third-card' }),
      ];

      const result = enemy.onRoundStart(cards);
      // Random(0) with sort(() => 0 - 0.5) reverses the array, so first after shuffle is third
      expect(result.cardModifications[0].cardId).toBe('third-card');
    });

    it('picks a card deterministically when random returns 0.99', () => {
      mockRandom(0.99);
      const enemy = createIronShell();
      const cards = [
        createCard({ id: 'first-card' }),
        createCard({ id: 'second-card' }),
        createCard({ id: 'third-card' }),
      ];

      const result = enemy.onRoundStart(cards);
      // Random(0.99) with sort(() => 0.99 - 0.5) keeps the array order, so first after shuffle is first
      expect(result.cardModifications[0].cardId).toBe('first-card');
    });

    it('skips dud cards when placing triple card', () => {
      mockRandom(0);
      const enemy = createIronShell();
      const cards = [
        createCard({ id: 'dud-card', isDud: true }),
        createCard({ id: 'normal-card' }),
      ];

      const result = enemy.onRoundStart(cards);
      expect(result.cardModifications[0].cardId).toBe('normal-card');
    });

    it('skips face-down cards when placing triple card', () => {
      mockRandom(0);
      const enemy = createIronShell();
      const cards = [
        createFaceDownCard({ id: 'facedown-card' }),
        createCard({ id: 'normal-card' }),
      ];

      const result = enemy.onRoundStart(cards);
      expect(result.cardModifications[0].cardId).toBe('normal-card');
    });

    it('skips both dud and face-down cards', () => {
      mockRandom(0);
      const enemy = createIronShell();
      const cards = [
        createCard({ id: 'dud-card', isDud: true }),
        createFaceDownCard({ id: 'facedown-card' }),
        createCard({ id: 'normal-card' }),
      ];

      const result = enemy.onRoundStart(cards);
      expect(result.cardModifications[0].cardId).toBe('normal-card');
    });

    it('returns empty result when no valid cards (empty board)', () => {
      const enemy = createIronShell();
      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
    });

    it('returns empty result when all cards are duds', () => {
      const enemy = createIronShell();
      const cards = [
        createCard({ id: 'dud1', isDud: true }),
        createCard({ id: 'dud2', isDud: true }),
      ];

      const result = enemy.onRoundStart(cards);
      expect(result.cardModifications).toEqual([]);
    });

    it('returns empty result when all cards are face-down', () => {
      const enemy = createIronShell();
      const cards = [
        createFaceDownCard({ id: 'fd1' }),
        createFaceDownCard({ id: 'fd2' }),
      ];

      const result = enemy.onRoundStart(cards);
      expect(result.cardModifications).toEqual([]);
    });

    it('handles single card board', () => {
      mockRandom(0);
      const enemy = createIronShell();
      const cards = [createCard({ id: 'only-card' })];

      const result = enemy.onRoundStart(cards);
      expect(result.cardModifications.length).toBe(1);
      expect(result.cardModifications[0].cardId).toBe('only-card');
    });

    it('handles large board (18 cards)', () => {
      const enemy = createIronShell();
      const cards = createTestBoard(18);

      const result = enemy.onRoundStart(cards);
      expect(result.cardModifications.length).toBe(1);
    });

    it('handles varied board with different attributes', () => {
      const enemy = createIronShell();
      const cards = createVariedBoard();

      const result = enemy.onRoundStart(cards);
      expect(result.cardModifications.length).toBe(1);
      expect(result.cardModifications[0].changes.health).toBe(3);
    });

    it('does not modify original card objects', () => {
      const enemy = createIronShell();
      const originalCard = createCard({ id: 'test-card' });
      const originalHealth = originalCard.health;
      const cards = [originalCard];

      enemy.onRoundStart(cards);

      expect(originalCard.health).toBe(originalHealth);
    });

    it('resets internal state on each round start', () => {
      const enemy = createIronShell();
      const cards1 = [createCard({ id: 'round1-card' })];
      const cards2 = [createCard({ id: 'round2-card' })];

      mockRandom(0);
      const result1 = enemy.onRoundStart(cards1);
      expect(result1.cardModifications[0].cardId).toBe('round1-card');

      mockRandom(0);
      const result2 = enemy.onRoundStart(cards2);
      expect(result2.cardModifications[0].cardId).toBe('round2-card');
    });
  });

  // ==========================================================================
  // EFFECT TESTS - TRIPLE CARD MATCHING (onValidMatch)
  // ==========================================================================
  describe('triple card effect - onValidMatch', () => {
    it('returns neutral result (pointsMultiplier = 1)', () => {
      const enemy = createIronShell();
      const result = enemy.onValidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('returns neutral timeDelta (0)', () => {
      const enemy = createIronShell();
      const result = enemy.onValidMatch([], []);
      expect(result.timeDelta).toBe(0);
    });

    it('returns empty cardsToRemove array', () => {
      const enemy = createIronShell();
      const result = enemy.onValidMatch([], []);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardsToFlip array', () => {
      const enemy = createIronShell();
      const result = enemy.onValidMatch([], []);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createIronShell();
      const result = enemy.onValidMatch([], []);
      expect(result.events).toEqual([]);
    });

    it('handles match with triple card', () => {
      mockRandom(0);
      const enemy = createIronShell();
      const cards = [
        createCard({ id: 'triple-card' }),
        createCard({ id: 'normal-card' }),
      ];

      enemy.onRoundStart(cards);
      const tripleCard = createTripleCard({ id: 'triple-card' });
      const result = enemy.onValidMatch([tripleCard], cards);

      expect(result.pointsMultiplier).toBe(1);
    });

    it('handles match without triple card', () => {
      mockRandom(0);
      const enemy = createIronShell();
      const cards = [
        createCard({ id: 'triple-card' }),
        createCard({ id: 'normal-card' }),
      ];

      enemy.onRoundStart(cards);
      const normalCard = createCard({ id: 'normal-card' });
      const result = enemy.onValidMatch([normalCard], cards);

      expect(result.pointsMultiplier).toBe(1);
    });

    it('handles match with multiple cards including triple card', () => {
      mockRandom(0);
      const enemy = createIronShell();
      const cards = createTestBoard(12);

      enemy.onRoundStart(cards);
      const matchedCards = [
        createTripleCard({ id: cards[0].id }),
        createCard({ id: cards[1].id }),
        createCard({ id: cards[2].id }),
      ];

      const result = enemy.onValidMatch(matchedCards, cards);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('handles empty matched cards array', () => {
      const enemy = createIronShell();
      const cards = createTestBoard(12);
      enemy.onRoundStart(cards);

      const result = enemy.onValidMatch([], cards);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('handles match after multiple rounds', () => {
      const enemy = createIronShell();
      const cards = createTestBoard(12);

      // Round 1
      enemy.onRoundStart(cards);
      enemy.onValidMatch([createCard()], cards);

      // Round 2 (same enemy instance)
      const newCards = createTestBoard(12);
      enemy.onRoundStart(newCards);
      const result = enemy.onValidMatch([createCard()], newCards);

      expect(result.pointsMultiplier).toBe(1);
    });
  });

  // ==========================================================================
  // DEFEAT CONDITION TESTS
  // ==========================================================================
  describe('defeat condition', () => {
    it('returns false when tripleCardsCleared = 0', () => {
      const enemy = createIronShell();
      const stats = createRoundStats({ tripleCardsCleared: 0 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when tripleCardsCleared = 1 (exact threshold)', () => {
      const enemy = createIronShell();
      const stats = createRoundStats({ tripleCardsCleared: 1 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when tripleCardsCleared = 2 (above threshold)', () => {
      const enemy = createIronShell();
      const stats = createRoundStats({ tripleCardsCleared: 2 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when tripleCardsCleared = 3', () => {
      const enemy = createIronShell();
      const stats = createRoundStats({ tripleCardsCleared: 3 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when tripleCardsCleared = 10 (large value)', () => {
      const enemy = createIronShell();
      const stats = createRoundStats({ tripleCardsCleared: 10 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when tripleCardsCleared = 100 (very large value)', () => {
      const enemy = createIronShell();
      const stats = createRoundStats({ tripleCardsCleared: 100 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('only depends on tripleCardsCleared stat', () => {
      const enemy = createIronShell();
      const stats = createRoundStats({
        tripleCardsCleared: 0,
        totalMatches: 100,
        currentStreak: 50,
        currentScore: 10000,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('ignores other card clearing stats', () => {
      const enemy = createIronShell();
      const stats = createRoundStats({
        tripleCardsCleared: 0,
        faceDownCardsMatched: 10,
        bombsDefused: 5,
        countdownCardsMatched: 3,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('is independent of time remaining', () => {
      const enemy = createIronShell();
      const stats1 = createRoundStats({ tripleCardsCleared: 1, timeRemaining: 60 });
      const stats2 = createRoundStats({ tripleCardsCleared: 1, timeRemaining: 0 });

      expect(enemy.checkDefeatCondition(stats1)).toBe(true);
      expect(enemy.checkDefeatCondition(stats2)).toBe(true);
    });

    it('is independent of player health (damage received)', () => {
      const enemy = createIronShell();
      const stats = createRoundStats({
        tripleCardsCleared: 1,
        damageReceived: 10,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('is independent of score', () => {
      const enemy = createIronShell();
      const stats = createRoundStats({
        tripleCardsCleared: 1,
        currentScore: 0,
        targetScore: 1000,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS - onTick
  // ==========================================================================
  describe('lifecycle hooks - onTick', () => {
    it('returns zero scoreDelta', () => {
      const enemy = createIronShell();
      const result = enemy.onTick(1000, []);
      expect(result.scoreDelta).toBe(0);
    });

    it('returns zero healthDelta', () => {
      const enemy = createIronShell();
      const result = enemy.onTick(1000, []);
      expect(result.healthDelta).toBe(0);
    });

    it('returns zero timeDelta', () => {
      const enemy = createIronShell();
      const result = enemy.onTick(1000, []);
      expect(result.timeDelta).toBe(0);
    });

    it('returns empty cardsToRemove array', () => {
      const enemy = createIronShell();
      const result = enemy.onTick(1000, []);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardModifications array', () => {
      const enemy = createIronShell();
      const result = enemy.onTick(1000, []);
      expect(result.cardModifications).toEqual([]);
    });

    it('returns empty cardsToFlip array', () => {
      const enemy = createIronShell();
      const result = enemy.onTick(1000, []);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createIronShell();
      const result = enemy.onTick(1000, []);
      expect(result.events).toEqual([]);
    });

    it('returns instantDeath as false', () => {
      const enemy = createIronShell();
      const result = enemy.onTick(1000, []);
      expect(result.instantDeath).toBe(false);
    });

    it('handles very small deltaMs (1ms)', () => {
      const enemy = createIronShell();
      const result = enemy.onTick(1, []);
      expect(result.scoreDelta).toBe(0);
      expect(result.healthDelta).toBe(0);
    });

    it('handles large deltaMs (60000ms)', () => {
      const enemy = createIronShell();
      const result = enemy.onTick(60000, []);
      expect(result.scoreDelta).toBe(0);
      expect(result.healthDelta).toBe(0);
    });

    it('handles zero deltaMs', () => {
      const enemy = createIronShell();
      const result = enemy.onTick(0, []);
      expect(result.scoreDelta).toBe(0);
    });

    it('handles board with cards', () => {
      const enemy = createIronShell();
      const cards = createTestBoard(12);
      const result = enemy.onTick(1000, cards);
      expect(result.scoreDelta).toBe(0);
    });

    it('handles multiple consecutive ticks', () => {
      const enemy = createIronShell();
      const cards = createTestBoard(12);

      for (let i = 0; i < 60; i++) {
        const result = enemy.onTick(1000, cards);
        expect(result.healthDelta).toBe(0);
        expect(result.instantDeath).toBe(false);
      }
    });

    it('state is independent between ticks', () => {
      const enemy = createIronShell();
      const result1 = enemy.onTick(1000, []);
      const result2 = enemy.onTick(1000, []);

      expect(result1).toEqual(result2);
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS - onCardDraw
  // ==========================================================================
  describe('lifecycle hooks - onCardDraw', () => {
    it('returns unmodified card', () => {
      const enemy = createIronShell();
      const card = createCard({ id: 'test-card', shape: 'oval', color: 'red' });
      const result = enemy.onCardDraw(card);
      expect(result).toEqual(card);
    });

    it('preserves card id', () => {
      const enemy = createIronShell();
      const card = createCard({ id: 'specific-id' });
      const result = enemy.onCardDraw(card);
      expect(result.id).toBe('specific-id');
    });

    it('preserves card shape', () => {
      const enemy = createIronShell();
      const card = createCard({ shape: 'squiggle' });
      const result = enemy.onCardDraw(card);
      expect(result.shape).toBe('squiggle');
    });

    it('preserves card color', () => {
      const enemy = createIronShell();
      const card = createCard({ color: 'purple' });
      const result = enemy.onCardDraw(card);
      expect(result.color).toBe('purple');
    });

    it('preserves card number', () => {
      const enemy = createIronShell();
      const card = createCard({ number: 3 });
      const result = enemy.onCardDraw(card);
      expect(result.number).toBe(3);
    });

    it('preserves card shading', () => {
      const enemy = createIronShell();
      const card = createCard({ shading: 'striped' });
      const result = enemy.onCardDraw(card);
      expect(result.shading).toBe('striped');
    });

    it('preserves card selected state', () => {
      const enemy = createIronShell();
      const card = createCard({ selected: true });
      const result = enemy.onCardDraw(card);
      expect(result.selected).toBe(true);
    });

    it('does not add isDud', () => {
      const enemy = createIronShell();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isDud).toBeUndefined();
    });

    it('does not add isFaceDown', () => {
      const enemy = createIronShell();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isFaceDown).toBeUndefined();
    });

    it('does not add health', () => {
      const enemy = createIronShell();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.health).toBeUndefined();
    });

    it('preserves existing health if present', () => {
      const enemy = createIronShell();
      const card = createCard({ health: 2 });
      const result = enemy.onCardDraw(card);
      expect(result.health).toBe(2);
    });

    it('handles card that is already a dud', () => {
      const enemy = createIronShell();
      const card = createCard({ isDud: true });
      const result = enemy.onCardDraw(card);
      expect(result.isDud).toBe(true);
    });

    it('handles card that is already face-down', () => {
      const enemy = createIronShell();
      const card = createFaceDownCard();
      const result = enemy.onCardDraw(card);
      expect(result.isFaceDown).toBe(true);
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS - onInvalidMatch
  // ==========================================================================
  describe('lifecycle hooks - onInvalidMatch', () => {
    it('returns pointsMultiplier of 1', () => {
      const enemy = createIronShell();
      const result = enemy.onInvalidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('returns timeDelta of 0', () => {
      const enemy = createIronShell();
      const result = enemy.onInvalidMatch([], []);
      expect(result.timeDelta).toBe(0);
    });

    it('returns empty cardsToRemove array', () => {
      const enemy = createIronShell();
      const result = enemy.onInvalidMatch([], []);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardsToFlip array', () => {
      const enemy = createIronShell();
      const result = enemy.onInvalidMatch([], []);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createIronShell();
      const result = enemy.onInvalidMatch([], []);
      expect(result.events).toEqual([]);
    });

    it('does not penalize invalid matches', () => {
      const enemy = createIronShell();
      const cards = createTestBoard(12);
      const invalidCards = [cards[0], cards[1], cards[2]];

      const result = enemy.onInvalidMatch(invalidCards, cards);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('handles invalid match with triple card', () => {
      mockRandom(0);
      const enemy = createIronShell();
      const cards = createTestBoard(12);
      enemy.onRoundStart(cards);

      const tripleCard = createTripleCard({ id: cards[0].id });
      const result = enemy.onInvalidMatch([tripleCard, cards[1], cards[2]], cards);

      expect(result.pointsMultiplier).toBe(1);
      expect(result.cardsToRemove).toEqual([]);
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS - onRoundEnd
  // ==========================================================================
  describe('lifecycle hooks - onRoundEnd', () => {
    it('does not throw', () => {
      const enemy = createIronShell();
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('can be called multiple times', () => {
      const enemy = createIronShell();
      expect(() => {
        enemy.onRoundEnd();
        enemy.onRoundEnd();
        enemy.onRoundEnd();
      }).not.toThrow();
    });

    it('can be called without onRoundStart', () => {
      const enemy = createIronShell();
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('returns void', () => {
      const enemy = createIronShell();
      const result = enemy.onRoundEnd();
      expect(result).toBeUndefined();
    });
  });

  // ==========================================================================
  // UI MODIFIERS - getUIModifiers
  // ==========================================================================
  describe('UI modifiers - getUIModifiers', () => {
    it('returns an object', () => {
      const enemy = createIronShell();
      const modifiers = enemy.getUIModifiers();
      expect(typeof modifiers).toBe('object');
    });

    it('does not show inactivity bar', () => {
      const enemy = createIronShell();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showInactivityBar).toBeUndefined();
    });

    it('does not show score decay', () => {
      const enemy = createIronShell();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showScoreDecay).toBeUndefined();
    });

    it('does not modify timer speed', () => {
      const enemy = createIronShell();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.timerSpeedMultiplier).toBeUndefined();
    });

    it('does not disable auto hint', () => {
      const enemy = createIronShell();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableAutoHint).toBeUndefined();
    });

    it('does not disable manual hint', () => {
      const enemy = createIronShell();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableManualHint).toBeUndefined();
    });

    it('does not show countdown cards', () => {
      const enemy = createIronShell();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showCountdownCards).toBeUndefined();
    });

    it('does not show bomb cards', () => {
      const enemy = createIronShell();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showBombCards).toBeUndefined();
    });

    it('does not have weapon counters', () => {
      const enemy = createIronShell();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters).toBeUndefined();
    });

    it('returns consistent results on multiple calls', () => {
      const enemy = createIronShell();
      const modifiers1 = enemy.getUIModifiers();
      const modifiers2 = enemy.getUIModifiers();
      expect(modifiers1).toEqual(modifiers2);
    });

    it('returns same shape after onRoundStart', () => {
      const enemy = createIronShell();
      const cards = createTestBoard(12);

      const modifiersBefore = enemy.getUIModifiers();
      enemy.onRoundStart(cards);
      const modifiersAfter = enemy.getUIModifiers();

      expect(Object.keys(modifiersBefore)).toEqual(Object.keys(modifiersAfter));
    });
  });

  // ==========================================================================
  // STAT MODIFIERS - getStatModifiers
  // ==========================================================================
  describe('stat modifiers - getStatModifiers', () => {
    it('returns an object', () => {
      const enemy = createIronShell();
      const modifiers = enemy.getStatModifiers();
      expect(typeof modifiers).toBe('object');
    });

    it('does not reduce fire spread chance', () => {
      const enemy = createIronShell();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
    });

    it('does not reduce explosion chance', () => {
      const enemy = createIronShell();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.explosionChanceReduction).toBeUndefined();
    });

    it('does not reduce laser chance', () => {
      const enemy = createIronShell();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.laserChanceReduction).toBeUndefined();
    });

    it('does not reduce hint gain chance', () => {
      const enemy = createIronShell();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.hintGainChanceReduction).toBeUndefined();
    });

    it('does not reduce grace gain chance', () => {
      const enemy = createIronShell();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.graceGainChanceReduction).toBeUndefined();
    });

    it('does not reduce time gain chance', () => {
      const enemy = createIronShell();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.timeGainChanceReduction).toBeUndefined();
    });

    it('does not reduce healing chance', () => {
      const enemy = createIronShell();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.healingChanceReduction).toBeUndefined();
    });

    it('does not have damage multiplier', () => {
      const enemy = createIronShell();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.damageMultiplier).toBeUndefined();
    });

    it('does not have points multiplier', () => {
      const enemy = createIronShell();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.pointsMultiplier).toBeUndefined();
    });

    it('returns empty object', () => {
      const enemy = createIronShell();
      const modifiers = enemy.getStatModifiers();
      expect(Object.keys(modifiers).length).toBe(0);
    });

    it('returns consistent results', () => {
      const enemy = createIronShell();
      const modifiers1 = enemy.getStatModifiers();
      const modifiers2 = enemy.getStatModifiers();
      expect(modifiers1).toEqual(modifiers2);
    });
  });

  // ==========================================================================
  // INTEGRATION TESTS - Full Round Simulation
  // ==========================================================================
  describe('integration - full round simulation', () => {
    it('simulates a complete round with triple card cleared', () => {
      mockRandom(0);
      const enemy = createIronShell();
      const cards = createTestBoard(12);

      // Start round - triple card placed
      const startResult = enemy.onRoundStart(cards);
      expect(startResult.cardModifications.length).toBe(1);
      const tripleCardId = startResult.cardModifications[0].cardId;

      // Simulate ticks (no effect for Iron Shell)
      for (let i = 0; i < 10; i++) {
        const tickResult = enemy.onTick(1000, cards);
        expect(tickResult.healthDelta).toBe(0);
      }

      // Match the triple card 3 times
      const tripleCard = createTripleCard({ id: tripleCardId });
      for (let i = 0; i < 3; i++) {
        const matchResult = enemy.onValidMatch([tripleCard], cards);
        expect(matchResult.pointsMultiplier).toBe(1);
      }

      // Check defeat condition
      const stats = createRoundStats({ tripleCardsCleared: 1 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);

      // End round
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('simulates a round where player does not clear triple card', () => {
      mockRandom(0);
      const enemy = createIronShell();
      const cards = createTestBoard(12);

      // Start round
      enemy.onRoundStart(cards);

      // Make matches that don't include triple card
      for (let i = 0; i < 5; i++) {
        const normalCards = [
          createCard({ id: `match-${i}-1` }),
          createCard({ id: `match-${i}-2` }),
          createCard({ id: `match-${i}-3` }),
        ];
        enemy.onValidMatch(normalCards, cards);
      }

      // Check defeat condition - should not be met
      const stats = createRoundStats({ tripleCardsCleared: 0 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('simulates multiple rounds with same enemy instance', () => {
      const enemy = createIronShell();

      for (let round = 0; round < 3; round++) {
        mockRandom(0);
        const cards = createTestBoard(12);

        // Start round
        const startResult = enemy.onRoundStart(cards);
        expect(startResult.cardModifications.length).toBe(1);

        // Simulate gameplay
        enemy.onTick(5000, cards);
        enemy.onValidMatch([createCard()], cards);

        // End round
        enemy.onRoundEnd();
      }
    });

    it('handles card draws during round', () => {
      const enemy = createIronShell();
      const cards = createTestBoard(12);

      enemy.onRoundStart(cards);

      // Simulate drawing new cards after matches
      for (let i = 0; i < 10; i++) {
        const newCard = createCard({ id: `drawn-${i}` });
        const result = enemy.onCardDraw(newCard);
        expect(result.id).toBe(`drawn-${i}`);
        expect(result.health).toBeUndefined(); // Iron Shell doesn't modify drawn cards
      }
    });

    it('handles invalid matches during round', () => {
      const enemy = createIronShell();
      const cards = createTestBoard(12);

      enemy.onRoundStart(cards);

      // Make several invalid matches
      for (let i = 0; i < 5; i++) {
        const invalidCards = [cards[0], cards[1], cards[2]];
        const result = enemy.onInvalidMatch(invalidCards, cards);
        expect(result.cardsToRemove).toEqual([]);
      }

      // Defeat condition should not be affected by invalid matches
      const stats = createRoundStats({ tripleCardsCleared: 0, invalidMatches: 5 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================
  describe('edge cases', () => {
    it('handles board with only one valid card (not dud, not face-down)', () => {
      mockRandom(0);
      const enemy = createIronShell();
      const cards = [
        createCard({ id: 'dud1', isDud: true }),
        createCard({ id: 'dud2', isDud: true }),
        createFaceDownCard({ id: 'fd1' }),
        createCard({ id: 'only-valid' }),
      ];

      const result = enemy.onRoundStart(cards);
      expect(result.cardModifications.length).toBe(1);
      expect(result.cardModifications[0].cardId).toBe('only-valid');
    });

    it('handles card with pre-existing health value', () => {
      const enemy = createIronShell();
      const card = createCard({ id: 'pre-health', health: 5 });
      const drawnCard = enemy.onCardDraw(card);
      expect(drawnCard.health).toBe(5);
    });

    it('handles very long game sessions (many ticks)', () => {
      const enemy = createIronShell();
      const cards = createTestBoard(12);
      enemy.onRoundStart(cards);

      // Simulate 10 minutes of gameplay
      for (let i = 0; i < 600; i++) {
        const result = enemy.onTick(1000, cards);
        expect(result.instantDeath).toBe(false);
      }
    });

    it('factory always returns fresh instance', () => {
      const enemies = Array(10)
        .fill(null)
        .map(() => createIronShell());
      const uniqueInstances = new Set(enemies);
      expect(uniqueInstances.size).toBe(10);
    });

    it('handles concurrent access pattern', () => {
      // Create multiple enemies and run operations in interleaved order
      const enemy1 = createIronShell();
      const enemy2 = createIronShell();
      const cards1 = createTestBoard(12);
      const cards2 = createTestBoard(12);

      enemy1.onRoundStart(cards1);
      enemy2.onRoundStart(cards2);
      enemy1.onTick(1000, cards1);
      enemy2.onValidMatch([createCard()], cards2);
      enemy1.onCardDraw(createCard());
      enemy2.onTick(1000, cards2);

      // Both should still function correctly
      expect(enemy1.checkDefeatCondition(createRoundStats({ tripleCardsCleared: 0 }))).toBe(false);
      expect(enemy2.checkDefeatCondition(createRoundStats({ tripleCardsCleared: 1 }))).toBe(true);
    });

    it('handles board mutations between calls', () => {
      const enemy = createIronShell();
      const cards = createTestBoard(12);

      enemy.onRoundStart(cards);

      // Mutate the board (simulating cards being removed/replaced)
      cards.splice(0, 3);
      cards.push(createCard({ id: 'new-1' }));
      cards.push(createCard({ id: 'new-2' }));
      cards.push(createCard({ id: 'new-3' }));

      // Enemy should handle the changed board gracefully
      const tickResult = enemy.onTick(1000, cards);
      expect(tickResult.healthDelta).toBe(0);

      const matchResult = enemy.onValidMatch([cards[0]], cards);
      expect(matchResult.pointsMultiplier).toBe(1);
    });
  });
});
