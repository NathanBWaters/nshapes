import { createTheHydra } from '@/utils/enemies/tier4/theHydra';
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

describe('The Hydra', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createTheHydra();
      expect(enemy.name).toBe('The Hydra');
      expect(enemy.tier).toBe(4);
    });

    it('has correct icon', () => {
      const enemy = createTheHydra();
      expect(enemy.icon).toBe('lorc/hydra');
    });
  });

  describe('inactivity effect', () => {
    it('causes instant death after 30s', () => {
      const enemy = createTheHydra();
      const board = createTestBoard();
      enemy.onRoundStart(board);

      const result = enemy.onTick(30000, board);
      expect(result.instantDeath).toBe(true);
    });
  });

  describe('time steal', () => {
    it('steals 4s per match', () => {
      const enemy = createTheHydra();
      const board = createTestBoard();

      const result = enemy.onValidMatch([board[0], board[1], board[2]], board);
      expect(result.timeDelta).toBe(-4);
    });
  });

  describe('defeat condition', () => {
    it('returns false with 9 matches', () => {
      const enemy = createTheHydra();
      const stats = createEmptyStats();
      stats.totalMatches = 9;
      stats.invalidMatches = 0;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false with 10 matches but invalid', () => {
      const enemy = createTheHydra();
      const stats = createEmptyStats();
      stats.totalMatches = 10;
      stats.invalidMatches = 1;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with 10+ matches and no invalid', () => {
      const enemy = createTheHydra();
      const stats = createEmptyStats();
      stats.totalMatches = 10;
      stats.invalidMatches = 0;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
