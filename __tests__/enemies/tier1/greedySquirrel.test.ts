/**
 * Unit tests for Greedy Squirrel enemy.
 */
import type { Card } from '@/types';
import type { RoundStats } from '@/types/enemy';
import { createGreedySquirrel } from '@/utils/enemies/tier1/greedySquirrel';

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

// Helper to mock Math.random for deterministic tests
const mockRandom = (value: number) => {
  jest.spyOn(Math, 'random').mockReturnValue(value);
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Greedy Squirrel', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createGreedySquirrel();
      expect(enemy.name).toBe('Greedy Squirrel');
    });

    it('has correct tier', () => {
      const enemy = createGreedySquirrel();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon', () => {
      const enemy = createGreedySquirrel();
      expect(enemy.icon).toBe('delapouite/squirrel');
    });

    it('has correct description', () => {
      const enemy = createGreedySquirrel();
      expect(enemy.description).toContain('Only 2 cards are replenished');
    });

    it('has correct defeat condition text', () => {
      const enemy = createGreedySquirrel();
      expect(enemy.defeatConditionText).toContain('8+ cards remaining');
    });
  });

  describe('extra card removal effect', () => {
    it('removes 1 extra card on valid match', () => {
      mockRandom(0.5);
      const enemy = createGreedySquirrel();
      const board = Array.from({ length: 12 }, (_, i) => createTestCard(`card-${i}`));
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToRemove?.length).toBe(1);
    });

    it('emits card_removed event on valid match', () => {
      mockRandom(0.5);
      const enemy = createGreedySquirrel();
      const board = Array.from({ length: 12 }, (_, i) => createTestCard(`card-${i}`));
      const result = enemy.onValidMatch([], board);
      expect(result.events).toContainEqual(
        expect.objectContaining({ type: 'card_removed', reason: 'enemy_match_penalty' })
      );
    });

    it('respects minimum board size of 6', () => {
      const enemy = createGreedySquirrel();
      const board = Array.from({ length: 6 }, (_, i) => createTestCard(`card-${i}`));
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToRemove?.length ?? 0).toBe(0);
    });

    it('removes only 1 card when board has 7 cards (1 above minimum)', () => {
      mockRandom(0.5);
      const enemy = createGreedySquirrel();
      const board = Array.from({ length: 7 }, (_, i) => createTestCard(`card-${i}`));
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToRemove?.length).toBe(1);
    });

    it('does not affect invalid matches', () => {
      const enemy = createGreedySquirrel();
      const board = Array.from({ length: 12 }, (_, i) => createTestCard(`card-${i}`));
      const result = enemy.onInvalidMatch([], board);
      expect(result.cardsToRemove?.length ?? 0).toBe(0);
    });
  });

  describe('defeat condition', () => {
    it('returns false when score is below target', () => {
      const enemy = createGreedySquirrel();
      const stats = createRoundStats({
        currentScore: 50,
        targetScore: 100,
        cardsRemaining: 10,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when score meets target but cards remaining is less than 8', () => {
      const enemy = createGreedySquirrel();
      const stats = createRoundStats({
        currentScore: 100,
        targetScore: 100,
        cardsRemaining: 7,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when score meets target and cards remaining is exactly 8', () => {
      const enemy = createGreedySquirrel();
      const stats = createRoundStats({
        currentScore: 100,
        targetScore: 100,
        cardsRemaining: 8,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when score exceeds target and cards remaining exceeds 8', () => {
      const enemy = createGreedySquirrel();
      const stats = createRoundStats({
        currentScore: 150,
        targetScore: 100,
        cardsRemaining: 12,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
