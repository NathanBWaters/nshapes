import { createDivingHawk } from '@/utils/enemies/tier2/divingHawk';
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

describe('Diving Hawk', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createDivingHawk();
      expect(enemy.name).toBe('Diving Hawk');
      expect(enemy.tier).toBe(2);
    });

    it('has correct icon', () => {
      const enemy = createDivingHawk();
      expect(enemy.icon).toBe('lorc/hawk-emblem');
    });
  });

  describe('timer speed effect', () => {
    it('has 35% faster timer', () => {
      const enemy = createDivingHawk();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBe(1.35);
    });
  });

  describe('card removal effect', () => {
    it('removes card after 15 seconds', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard();
      enemy.onRoundStart(board);

      const result = enemy.onTick(15000, board);
      expect(result.cardsToRemove.length).toBe(1);
    });

    it('does not remove below minimum board size', () => {
      const enemy = createDivingHawk();
      const board = createTestBoard().slice(0, 6); // Only 6 cards
      enemy.onRoundStart(board);

      const result = enemy.onTick(15000, board);
      expect(result.cardsToRemove.length).toBe(0);
    });
  });

  describe('defeat condition', () => {
    it('returns false with only 1 all-different match', () => {
      const enemy = createDivingHawk();
      const stats = createEmptyStats();
      stats.allDifferentMatches = 1;
      stats.matchTimes = [5000, 5000];
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false without fast matches', () => {
      const enemy = createDivingHawk();
      const stats = createEmptyStats();
      stats.allDifferentMatches = 2;
      stats.matchTimes = [7000, 8000];
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with 2+ all-different matches and fast times', () => {
      const enemy = createDivingHawk();
      const stats = createEmptyStats();
      stats.allDifferentMatches = 2;
      stats.matchTimes = [5000, 4000];
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
