/**
 * Unit tests for Swift Bee enemy.
 */
import type { RoundStats } from '@/types/enemy';
import { createSwiftBee } from '@/utils/enemies/tier1/swiftBee';

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

describe('Swift Bee', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createSwiftBee();
      expect(enemy.name).toBe('Swift Bee');
    });

    it('has correct icon', () => {
      const enemy = createSwiftBee();
      expect(enemy.icon).toBe('lorc/bee');
    });

    it('has correct tier', () => {
      const enemy = createSwiftBee();
      expect(enemy.tier).toBe(1);
    });

    it('has correct description', () => {
      const enemy = createSwiftBee();
      expect(enemy.description).toContain('20% faster');
      expect(enemy.description).toContain('20% more points');
    });
  });

  describe('timer speed effect', () => {
    it('returns 1.2x timer speed multiplier in UI modifiers', () => {
      const enemy = createSwiftBee();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.timerSpeedMultiplier).toBe(1.2);
    });
  });

  describe('points multiplier effect', () => {
    it('returns 1.2x points multiplier on match', () => {
      const enemy = createSwiftBee();
      const result = enemy.onValidMatch([], []);
      expect(result.pointsMultiplier).toBe(1.2);
    });

    it('returns 1.2x points multiplier in stat modifiers', () => {
      const enemy = createSwiftBee();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.pointsMultiplier).toBe(1.2);
    });
  });

  describe('defeat condition', () => {
    it('returns false when max streak is 0', () => {
      const enemy = createSwiftBee();
      const stats = createRoundStats({ maxStreak: 0 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when max streak is 4', () => {
      const enemy = createSwiftBee();
      const stats = createRoundStats({ maxStreak: 4 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when max streak is exactly 5', () => {
      const enemy = createSwiftBee();
      const stats = createRoundStats({ maxStreak: 5 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when max streak is greater than 5', () => {
      const enemy = createSwiftBee();
      const stats = createRoundStats({ maxStreak: 10 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
