import { createMercilessPorcupine } from '@/utils/enemies/tier3/mercilessPorcupine';
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

describe('Merciless Porcupine', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createMercilessPorcupine();
      expect(enemy.name).toBe('Merciless Porcupine');
      expect(enemy.tier).toBe(3);
    });

    it('has correct icon', () => {
      const enemy = createMercilessPorcupine();
      expect(enemy.icon).toBe('caro-asercion/porcupine');
    });
  });

  describe('extra card removal on invalid', () => {
    it('removes 3 extra cards on invalid', () => {
      const enemy = createMercilessPorcupine();
      const board = createTestBoard();

      const result = enemy.onInvalidMatch([board[0], board[1], board[2]], board);
      expect(result.cardsToRemove.length).toBe(3);
    });
  });

  describe('inactivity effect', () => {
    it('causes instant death after 35s', () => {
      const enemy = createMercilessPorcupine();
      const board = createTestBoard();
      enemy.onRoundStart(board);

      const result = enemy.onTick(35000, board);
      expect(result.instantDeath).toBe(true);
    });
  });

  describe('defeat condition', () => {
    it('returns false with no matches', () => {
      const enemy = createMercilessPorcupine();
      const stats = createEmptyStats();
      stats.totalMatches = 0;
      stats.invalidMatches = 0;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false if invalid match made', () => {
      const enemy = createMercilessPorcupine();
      const stats = createEmptyStats();
      stats.totalMatches = 5;
      stats.invalidMatches = 1;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with matches and no invalid', () => {
      const enemy = createMercilessPorcupine();
      const stats = createEmptyStats();
      stats.totalMatches = 5;
      stats.invalidMatches = 0;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
