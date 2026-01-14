import { createAncientDragon } from '@/utils/enemies/tier4/ancientDragon';
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

describe('Ancient Dragon', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createAncientDragon();
      expect(enemy.name).toBe('Ancient Dragon');
      expect(enemy.tier).toBe(4);
    });

    it('has correct icon', () => {
      const enemy = createAncientDragon();
      expect(enemy.icon).toBe('lorc/dragon-head');
    });
  });

  describe('triple card effect', () => {
    it('places 2 triple cards', () => {
      const enemy = createAncientDragon();
      const board = createTestBoard();

      const result = enemy.onRoundStart(board);
      const tripleCards = result.cardModifications.filter((m) => m.changes.health === 3);
      expect(tripleCards.length).toBe(2);
    });
  });

  describe('timer speed', () => {
    it('has 40% faster timer', () => {
      const enemy = createAncientDragon();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBe(1.4);
    });
  });

  describe('score decay', () => {
    it('decays at 5 points per second', () => {
      const enemy = createAncientDragon();
      const board = createTestBoard();

      const result = enemy.onTick(1000, board);
      expect(result.scoreDelta).toBe(-5);
    });
  });

  describe('defeat condition', () => {
    it('returns false without all 2 triple cards cleared', () => {
      const enemy = createAncientDragon();
      const stats = createEmptyStats();
      stats.tripleCardsCleared = 1;
      stats.allDifferentMatches = 2;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false without 2 all-different matches', () => {
      const enemy = createAncientDragon();
      const stats = createEmptyStats();
      stats.tripleCardsCleared = 2;
      stats.allDifferentMatches = 1;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with 2 triple cards and 2 all-different', () => {
      const enemy = createAncientDragon();
      const stats = createEmptyStats();
      stats.tripleCardsCleared = 2;
      stats.allDifferentMatches = 2;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
