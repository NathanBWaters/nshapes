/**
 * Unit tests for Burrowing Mole enemy.
 */
import type { Card, Shape } from '@/types';
import type { RoundStats } from '@/types/enemy';
import { createBurrowingMole } from '@/utils/enemies/tier1/burrowingMole';

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
  shapesMatched: new Set<Shape>(),
  colorsMatched: new Set(),
  colorMatchCounts: new Map(),
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

describe('Burrowing Mole', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createBurrowingMole();
      expect(enemy.name).toBe('Burrowing Mole');
    });

    it('has correct tier', () => {
      const enemy = createBurrowingMole();
      expect(enemy.tier).toBe(1);
    });

    it('has correct description', () => {
      const enemy = createBurrowingMole();
      expect(enemy.description).toContain('20s');
      expect(enemy.description).toContain('Removes');
    });

    it('has correct defeat condition text', () => {
      const enemy = createBurrowingMole();
      expect(enemy.defeatConditionText).toBe('Match all 3 shapes at least once');
    });
  });

  describe('card removal effect', () => {
    it('does not remove cards before 20s', () => {
      mockRandom(0.5);
      const enemy = createBurrowingMole();
      enemy.onRoundStart([]);

      const board = Array.from({ length: 12 }, (_, i) => createTestCard(`card-${i}`));
      const result = enemy.onTick(19000, board);

      expect(result.cardsToRemove.length).toBe(0);
    });

    it('removes 1 card at 20s interval', () => {
      mockRandom(0.5);
      const enemy = createBurrowingMole();
      enemy.onRoundStart([]);

      const board = Array.from({ length: 12 }, (_, i) => createTestCard(`card-${i}`));
      const result = enemy.onTick(20000, board);

      expect(result.cardsToRemove.length).toBe(1);
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: 'card_removed', reason: 'enemy_effect' })
      );
    });

    it('does not remove cards when board at minimum size (6)', () => {
      mockRandom(0.5);
      const enemy = createBurrowingMole();
      enemy.onRoundStart([]);

      const board = Array.from({ length: 6 }, (_, i) => createTestCard(`card-${i}`));
      const result = enemy.onTick(20000, board);

      expect(result.cardsToRemove.length).toBe(0);
    });

    it('removes cards repeatedly at intervals', () => {
      mockRandom(0.5);
      const enemy = createBurrowingMole();
      enemy.onRoundStart([]);

      const board = Array.from({ length: 12 }, (_, i) => createTestCard(`card-${i}`));

      // First removal at 20s
      const result1 = enemy.onTick(20000, board);
      expect(result1.cardsToRemove.length).toBe(1);

      // Second removal at 40s (20s after first)
      const result2 = enemy.onTick(20000, board);
      expect(result2.cardsToRemove.length).toBe(1);
    });
  });

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

    it('returns false when only 2 shapes matched', () => {
      const enemy = createBurrowingMole();
      const stats = createRoundStats({
        shapesMatched: new Set<Shape>(['oval', 'diamond']),
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when all 3 shapes matched', () => {
      const enemy = createBurrowingMole();
      const stats = createRoundStats({
        shapesMatched: new Set<Shape>(['oval', 'diamond', 'squiggle']),
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  describe('lifecycle hooks', () => {
    it('onRoundStart returns empty result', () => {
      const enemy = createBurrowingMole();
      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('onCardDraw returns unmodified card', () => {
      const enemy = createBurrowingMole();
      const card = createTestCard();
      const result = enemy.onCardDraw(card);
      expect(result).toEqual(card);
    });

    it('onValidMatch returns neutral result', () => {
      const enemy = createBurrowingMole();
      const result = enemy.onValidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.timeDelta).toBe(0);
    });

    it('onInvalidMatch returns neutral result', () => {
      const enemy = createBurrowingMole();
      const result = enemy.onInvalidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.cardsToRemove).toEqual([]);
    });
  });
});
