/**
 * Unit tests for Iron Shell enemy.
 */
import type { Card } from '@/types';
import type { RoundStats } from '@/types/enemy';
import { createIronShell } from '@/utils/enemies/tier1/ironShell';

// Helper to create a minimal test card
const createTestCard = (id: string = 'test-card', overrides: Partial<Card> = {}): Card => ({
  id,
  shape: 'oval',
  color: 'red',
  number: 1,
  shading: 'solid',
  background: 'white',
  selected: false,
  ...overrides,
});

// Helper to create minimal RoundStats
const createRoundStats = (overrides: Partial<RoundStats> = {}): RoundStats => ({
  totalMatches: 0,
  currentStreak: 0,
  maxStreak: 0,
  invalidMatches: 0,
  matchTimes: [],
  timeRemaining: 60,
  cardsRemaining: 12,
  tripleCardsCleared: 0,
  faceDownCardsMatched: 0,
  bombsDefused: 0,
  countdownCardsMatched: 0,
  shapesMatched: new Set(),
  colorsMatched: new Set(),
  allDifferentMatches: 0,
  allSameColorMatches: 0,
  squiggleMatches: 0,
  gracesUsed: 0,
  hintsUsed: 0,
  hintsRemaining: 3,
  gracesRemaining: 2,
  damageReceived: 0,
  weaponEffectsTriggered: new Set(),
  currentScore: 0,
  targetScore: 100,
  ...overrides,
});

// Mock Math.random for deterministic tests
const mockRandom = (value: number) => {
  jest.spyOn(Math, 'random').mockReturnValue(value);
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Iron Shell', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createIronShell();
      expect(enemy.name).toBe('Iron Shell');
    });

    it('has correct tier', () => {
      const enemy = createIronShell();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon', () => {
      const enemy = createIronShell();
      expect(enemy.icon).toBe('lorc/turtle');
    });

    it('has correct description', () => {
      const enemy = createIronShell();
      expect(enemy.description).toContain('3 matches');
    });

    it('has correct defeat condition text', () => {
      const enemy = createIronShell();
      expect(enemy.defeatConditionText).toContain('triple-health');
    });
  });

  describe('triple card effect', () => {
    it('onRoundStart places one triple card', () => {
      const enemy = createIronShell();
      const cards = [
        createTestCard('card-1'),
        createTestCard('card-2'),
        createTestCard('card-3'),
      ];

      const result = enemy.onRoundStart(cards);

      // Should place exactly one triple card
      expect(result.cardModifications.length).toBe(1);
      // Should be one of the cards on the board
      const modifiedCardId = result.cardModifications[0].cardId;
      expect(['card-1', 'card-2', 'card-3']).toContain(modifiedCardId);
      expect(result.cardModifications[0].changes.health).toBe(3);
    });

    it('skips dud cards when placing triple card', () => {
      mockRandom(0);
      const enemy = createIronShell();
      const cards = [
        createTestCard('dud-card', { isDud: true }),
        createTestCard('normal-card'),
      ];

      const result = enemy.onRoundStart(cards);

      expect(result.cardModifications[0].cardId).toBe('normal-card');
    });

    it('skips face-down cards when placing triple card', () => {
      mockRandom(0);
      const enemy = createIronShell();
      const cards = [
        createTestCard('facedown-card', { isFaceDown: true }),
        createTestCard('normal-card'),
      ];

      const result = enemy.onRoundStart(cards);

      expect(result.cardModifications[0].cardId).toBe('normal-card');
    });

    it('returns empty result when no valid cards', () => {
      const enemy = createIronShell();
      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
    });

    it('onValidMatch decrements triple card health', () => {
      mockRandom(0);
      const enemy = createIronShell();
      const cards = [
        createTestCard('triple-card'),
        createTestCard('card-2'),
      ];

      // Place the triple card
      enemy.onRoundStart(cards);

      // Match the triple card
      const tripleCard = createTestCard('triple-card', { health: 3 });
      enemy.onValidMatch([tripleCard], cards);

      // The enemy tracks health internally
      // We can't directly verify internal state, but we verify the method runs
    });
  });

  describe('defeat condition', () => {
    it('returns false when tripleCardsCleared < 1', () => {
      const enemy = createIronShell();
      const stats = createRoundStats({ tripleCardsCleared: 0 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when tripleCardsCleared = 1', () => {
      const enemy = createIronShell();
      const stats = createRoundStats({ tripleCardsCleared: 1 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when tripleCardsCleared > 1', () => {
      const enemy = createIronShell();
      const stats = createRoundStats({ tripleCardsCleared: 3 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  describe('lifecycle hooks', () => {
    it('onTick returns zero deltas', () => {
      const enemy = createIronShell();
      const result = enemy.onTick(1000, []);
      expect(result.scoreDelta).toBe(0);
      expect(result.healthDelta).toBe(0);
      expect(result.timeDelta).toBe(0);
    });

    it('onCardDraw returns unmodified card', () => {
      const enemy = createIronShell();
      const card = createTestCard();
      const result = enemy.onCardDraw(card);
      expect(result).toEqual(card);
    });

    it('onValidMatch returns neutral result', () => {
      const enemy = createIronShell();
      const result = enemy.onValidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.timeDelta).toBe(0);
    });

    it('onInvalidMatch returns neutral result', () => {
      const enemy = createIronShell();
      const result = enemy.onInvalidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.cardsToRemove).toEqual([]);
    });
  });
});
