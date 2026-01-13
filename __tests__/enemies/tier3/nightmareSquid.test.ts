import { createNightmareSquid } from '@/utils/enemies/tier3/nightmareSquid';
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

describe('Nightmare Squid', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createNightmareSquid();
      expect(enemy.name).toBe('Nightmare Squid');
      expect(enemy.tier).toBe(3);
    });

    it('has correct icon', () => {
      const enemy = createNightmareSquid();
      expect(enemy.icon).toBe('delapouite/giant-squid');
    });
  });

  describe('score decay', () => {
    it('decays at 6 points per second', () => {
      const enemy = createNightmareSquid();
      const board = createTestBoard();

      const result = enemy.onTick(1000, board);
      expect(result.scoreDelta).toBe(-6);
    });
  });

  describe('position shuffle', () => {
    it('shuffles every 15s', () => {
      const enemy = createNightmareSquid();
      const board = createTestBoard();

      const result = enemy.onTick(15000, board);
      expect(result.events).toContainEqual({ type: 'positions_shuffled' });
    });
  });

  describe('defeat condition', () => {
    it('returns false below 200% target', () => {
      const enemy = createNightmareSquid();
      const stats = createEmptyStats();
      stats.currentScore = 180;
      stats.targetScore = 100;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true at 200% target', () => {
      const enemy = createNightmareSquid();
      const stats = createEmptyStats();
      stats.currentScore = 200;
      stats.targetScore = 100;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
