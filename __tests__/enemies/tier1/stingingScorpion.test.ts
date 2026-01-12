/**
 * Unit tests for Stinging Scorpion enemy.
 */
import type { Card } from '@/types';
import type { RoundStats } from '@/types/enemy';
import { createStingingScorpion } from '@/utils/enemies/tier1/stingingScorpion';

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

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Stinging Scorpion', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createStingingScorpion();
      expect(enemy.name).toBe('Stinging Scorpion');
    });

    it('has correct tier', () => {
      const enemy = createStingingScorpion();
      expect(enemy.tier).toBe(1);
    });

    it('has correct description', () => {
      const enemy = createStingingScorpion();
      expect(enemy.description).toContain('2x damage');
      expect(enemy.description).toContain('2x points');
    });
  });

  describe('damage multiplier effect', () => {
    it('returns 2x damage multiplier in stat modifiers', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.damageMultiplier).toBe(2.0);
    });
  });

  describe('points multiplier effect', () => {
    it('returns 2x points multiplier on match', () => {
      const enemy = createStingingScorpion();
      const result = enemy.onValidMatch([], []);
      expect(result.pointsMultiplier).toBe(2.0);
    });

    it('returns 2x points multiplier in stat modifiers', () => {
      const enemy = createStingingScorpion();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.pointsMultiplier).toBe(2.0);
    });
  });

  describe('defeat condition', () => {
    it('returns false when no matches made', () => {
      const enemy = createStingingScorpion();
      const stats = createRoundStats({ totalMatches: 0, invalidMatches: 0 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when invalid matches made', () => {
      const enemy = createStingingScorpion();
      const stats = createRoundStats({ totalMatches: 5, invalidMatches: 1 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when at least 1 match and no invalid matches', () => {
      const enemy = createStingingScorpion();
      const stats = createRoundStats({ totalMatches: 1, invalidMatches: 0 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when many matches and no invalid matches', () => {
      const enemy = createStingingScorpion();
      const stats = createRoundStats({ totalMatches: 10, invalidMatches: 0 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
