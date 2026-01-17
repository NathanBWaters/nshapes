import { createRagingBear } from '@/utils/enemies/tier3/ragingBear';
import type { RoundStats } from '@/types/enemy';
import type { Card } from '@/types';

const createEmptyStats = (): RoundStats => ({
  totalMatches: 0,
  currentStreak: 0,
  maxStreak: 0,
  invalidMatches: 0,
  matchTimes: [],
  timeRemaining: 60000,
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
});

const createTestBoard = (): Card[] =>
  Array(12)
    .fill(null)
    .map((_, i) => ({
      id: `card-${i}`,
      shape: 'oval' as const,
      color: 'red' as const,
      number: 1 as const,
      shading: 'solid' as const,
      selected: false,
    }));

describe('Raging Bear', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createRagingBear();
      expect(enemy.name).toBe('Raging Bear');
      expect(enemy.tier).toBe(3);
    });

    it('has correct icon', () => {
      const enemy = createRagingBear();
      expect(enemy.icon).toBe('sparker/bear-face');
    });
  });

  describe('inactivity effect', () => {
    it('causes instant death after 30s inactivity', () => {
      const enemy = createRagingBear();
      const board = createTestBoard();
      enemy.onRoundStart(board);

      const result = enemy.onTick(30000, board);
      expect(result.instantDeath).toBe(true);
    });
  });

  describe('score decay', () => {
    it('decays at 0.2 points per second (1 per 5s)', () => {
      const enemy = createRagingBear();
      const board = createTestBoard();

      const result = enemy.onTick(1000, board);
      expect(result.scoreDelta).toBe(-0.2);
    });
  });

  describe('points multiplier', () => {
    it('has 2x points', () => {
      const enemy = createRagingBear();
      const board = createTestBoard();

      const result = enemy.onValidMatch([board[0], board[1], board[2]], board);
      expect(result.pointsMultiplier).toBe(2.0);
    });
  });

  describe('defeat condition', () => {
    it('returns false without 7-match streak', () => {
      const enemy = createRagingBear();
      const stats = createEmptyStats();
      stats.maxStreak = 6;
      stats.invalidMatches = 0;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false with 7-match streak but invalid match', () => {
      const enemy = createRagingBear();
      const stats = createEmptyStats();
      stats.maxStreak = 7;
      stats.invalidMatches = 1;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with 7-match streak and no invalid matches', () => {
      const enemy = createRagingBear();
      const stats = createEmptyStats();
      stats.maxStreak = 7;
      stats.invalidMatches = 0;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
