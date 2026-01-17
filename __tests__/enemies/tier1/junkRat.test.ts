/**
 * Unit tests for Junk Rat enemy.
 */
import type { Card } from '@/types';
import type { RoundStats } from '@/types/enemy';
import { createJunkRat } from '@/utils/enemies/tier1/junkRat';

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

describe('Junk Rat', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createJunkRat();
      expect(enemy.name).toBe('Junk Rat');
    });

    it('has correct tier', () => {
      const enemy = createJunkRat();
      expect(enemy.tier).toBe(1);
    });

    it('has correct description', () => {
      const enemy = createJunkRat();
      expect(enemy.description).toContain('4%');
      expect(enemy.description).toContain('unmatchable');
    });

    it('has correct defeat condition text', () => {
      const enemy = createJunkRat();
      expect(enemy.defeatConditionText).toBe('Get a 4-match streak');
    });
  });

  describe('dud effect', () => {
    it('creates dud when random < 4%', () => {
      mockRandom(0.03); // 3%, below 4% threshold
      const enemy = createJunkRat();
      const card = createTestCard();
      const result = enemy.onCardDraw(card);
      expect(result.isDud).toBe(true);
    });

    it('does not create dud when random >= 4%', () => {
      mockRandom(0.05); // 5%, above 4% threshold
      const enemy = createJunkRat();
      const card = createTestCard();
      const result = enemy.onCardDraw(card);
      expect(result.isDud).toBeUndefined();
    });

    it('at exactly 4% threshold, does not create dud', () => {
      mockRandom(0.04); // Exactly 4%
      const enemy = createJunkRat();
      const card = createTestCard();
      const result = enemy.onCardDraw(card);
      expect(result.isDud).toBeUndefined();
    });
  });

  describe('defeat condition', () => {
    it('returns false when streak < 4', () => {
      const enemy = createJunkRat();
      const stats = createRoundStats({ maxStreak: 3 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when streak = 4', () => {
      const enemy = createJunkRat();
      const stats = createRoundStats({ maxStreak: 4 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when streak > 4', () => {
      const enemy = createJunkRat();
      const stats = createRoundStats({ maxStreak: 7 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  describe('lifecycle hooks', () => {
    it('onRoundStart returns empty result', () => {
      const enemy = createJunkRat();
      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('onTick returns zero deltas', () => {
      const enemy = createJunkRat();
      const result = enemy.onTick(1000, []);
      expect(result.scoreDelta).toBe(0);
      expect(result.healthDelta).toBe(0);
      expect(result.timeDelta).toBe(0);
    });

    it('onValidMatch returns neutral result', () => {
      const enemy = createJunkRat();
      const result = enemy.onValidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.timeDelta).toBe(0);
    });

    it('onInvalidMatch returns neutral result', () => {
      const enemy = createJunkRat();
      const result = enemy.onInvalidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.cardsToRemove).toEqual([]);
    });
  });
});
