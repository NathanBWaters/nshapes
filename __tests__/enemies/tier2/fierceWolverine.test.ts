import { createFierceWolverine } from '@/utils/enemies/tier2/fierceWolverine';
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

describe('Fierce Wolverine', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createFierceWolverine();
      expect(enemy.name).toBe('Fierce Wolverine');
      expect(enemy.tier).toBe(2);
    });

    it('has correct icon', () => {
      const enemy = createFierceWolverine();
      expect(enemy.icon).toBe('lorc/wolverine-claws');
    });
  });

  describe('extra card removal on invalid match', () => {
    it('removes 2 extra cards on invalid match', () => {
      const enemy = createFierceWolverine();
      const board = createTestBoard();

      const result = enemy.onInvalidMatch([board[0], board[1], board[2]], board);
      expect(result.cardsToRemove.length).toBe(2);
    });

    it('does not remove below minimum board size', () => {
      const enemy = createFierceWolverine();
      const board = createTestBoard().slice(0, 6);

      const result = enemy.onInvalidMatch([board[0], board[1], board[2]], board);
      expect(result.cardsToRemove.length).toBe(0);
    });
  });

  describe('damage multiplier effect', () => {
    it('has 2x damage multiplier', () => {
      const enemy = createFierceWolverine();
      const statMods = enemy.getStatModifiers();
      expect(statMods.damageMultiplier).toBe(2.0);
    });
  });

  describe('points multiplier effect', () => {
    it('has 2x points multiplier', () => {
      const enemy = createFierceWolverine();
      const board = createTestBoard();

      const result = enemy.onValidMatch([board[0], board[1], board[2]], board);
      expect(result.pointsMultiplier).toBe(2.0);
    });
  });

  describe('defeat condition', () => {
    it('returns false with no matches', () => {
      const enemy = createFierceWolverine();
      const stats = createEmptyStats();
      stats.totalMatches = 0;
      stats.invalidMatches = 0;
      stats.damageReceived = 0;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false if invalid match made', () => {
      const enemy = createFierceWolverine();
      const stats = createEmptyStats();
      stats.totalMatches = 5;
      stats.invalidMatches = 1;
      stats.damageReceived = 0;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false if damage taken', () => {
      const enemy = createFierceWolverine();
      const stats = createEmptyStats();
      stats.totalMatches = 5;
      stats.invalidMatches = 0;
      stats.damageReceived = 1;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with matches, no invalids, no damage', () => {
      const enemy = createFierceWolverine();
      const stats = createEmptyStats();
      stats.totalMatches = 5;
      stats.invalidMatches = 0;
      stats.damageReceived = 0;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
