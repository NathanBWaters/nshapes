/**
 * Unit tests for Thieving Raven enemy.
 */
import type { Card } from '@/types';
import type { RoundStats } from '@/types/enemy';
import { createThievingRaven } from '@/utils/enemies/tier1/thievingRaven';

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

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Thieving Raven', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createThievingRaven();
      expect(enemy.name).toBe('Thieving Raven');
    });

    it('has correct tier', () => {
      const enemy = createThievingRaven();
      expect(enemy.tier).toBe(1);
    });

    it('has correct description', () => {
      const enemy = createThievingRaven();
      expect(enemy.description).toContain('-5s');
    });
  });

  describe('time steal effect', () => {
    it('steals 5 seconds on valid match', () => {
      const enemy = createThievingRaven();
      const result = enemy.onValidMatch([], []);
      expect(result.timeDelta).toBe(-5);
    });

    it('emits time_stolen event', () => {
      const enemy = createThievingRaven();
      const result = enemy.onValidMatch([], []);
      expect(result.events).toContainEqual({ type: 'time_stolen', amount: 5 });
    });

    it('does not affect invalid matches', () => {
      const enemy = createThievingRaven();
      const result = enemy.onInvalidMatch([], []);
      expect(result.timeDelta).toBe(0);
    });
  });

  describe('defeat condition', () => {
    it('returns false when less than 5 matches', () => {
      const enemy = createThievingRaven();
      const stats = createRoundStats({ totalMatches: 4 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when exactly 5 matches', () => {
      const enemy = createThievingRaven();
      const stats = createRoundStats({ totalMatches: 5 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when more than 5 matches', () => {
      const enemy = createThievingRaven();
      const stats = createRoundStats({ totalMatches: 10 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
