/**
 * Unit tests for Wild Goose enemy.
 */
import type { Card } from '@/types';
import type { RoundStats } from '@/types/enemy';
import { createWildGoose } from '@/utils/enemies/tier1/wildGoose';

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

describe('Wild Goose', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createWildGoose();
      expect(enemy.name).toBe('Wild Goose');
    });

    it('has correct tier', () => {
      const enemy = createWildGoose();
      expect(enemy.tier).toBe(1);
    });

    it('has correct description', () => {
      const enemy = createWildGoose();
      expect(enemy.description).toContain('30s');
      expect(enemy.description).toContain('Shuffles');
    });
  });

  describe('position shuffle effect', () => {
    it('does not shuffle before 30s', () => {
      const enemy = createWildGoose();
      enemy.onRoundStart([]);

      const result = enemy.onTick(29000, []);
      expect(result.events).not.toContainEqual({ type: 'positions_shuffled' });
    });

    it('shuffles at 30s interval', () => {
      const enemy = createWildGoose();
      enemy.onRoundStart([]);

      const result = enemy.onTick(30000, []);
      expect(result.events).toContainEqual({ type: 'positions_shuffled' });
    });

    it('shuffles again at next interval', () => {
      const enemy = createWildGoose();
      enemy.onRoundStart([]);

      // First shuffle at 30s
      enemy.onTick(30000, []);

      // Second shuffle at 60s
      const result = enemy.onTick(30000, []);
      expect(result.events).toContainEqual({ type: 'positions_shuffled' });
    });
  });

  describe('defeat condition', () => {
    it('returns false when no matches', () => {
      const enemy = createWildGoose();
      const stats = createRoundStats({ totalMatches: 0 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when only 1 match', () => {
      const enemy = createWildGoose();
      const stats = createRoundStats({ totalMatches: 1 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when 2+ matches', () => {
      const enemy = createWildGoose();
      const stats = createRoundStats({ totalMatches: 2 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
