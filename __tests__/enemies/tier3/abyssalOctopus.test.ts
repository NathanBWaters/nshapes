import { createAbyssalOctopus } from '@/utils/enemies/tier3/abyssalOctopus';
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

describe('Abyssal Octopus', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createAbyssalOctopus();
      expect(enemy.name).toBe('Abyssal Octopus');
      expect(enemy.tier).toBe(3);
    });

    it('has correct icon', () => {
      const enemy = createAbyssalOctopus();
      expect(enemy.icon).toBe('lorc/octopus');
    });
  });

  describe('face-down effect', () => {
    it('has 30% chance to create face-down', () => {
      const enemy = createAbyssalOctopus();
      const card: Card = {
        id: 'test',
        shape: 'oval',
        color: 'red',
        number: 1,
        shading: 'solid',
        selected: false,
      };

      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.2);
      const result = enemy.onCardDraw(card);
      expect(result.isFaceDown).toBe(true);
      mockRandom.mockRestore();
    });
  });

  describe('position shuffle', () => {
    it('shuffles every 20s', () => {
      const enemy = createAbyssalOctopus();
      const board = createTestBoard();

      const result = enemy.onTick(20000, board);
      expect(result.events).toContainEqual({ type: 'positions_shuffled' });
    });
  });

  describe('countdown effect', () => {
    it('places 10s countdown card on start', () => {
      const enemy = createAbyssalOctopus();
      const board = createTestBoard();

      const result = enemy.onRoundStart(board);
      const countdownMod = result.cardModifications.find((m) => m.changes.hasCountdown);
      expect(countdownMod).toBeDefined();
      expect(countdownMod?.changes.countdownTimer).toBe(10000);
    });
  });

  describe('defeat condition', () => {
    it('returns false with 4 face-down matches', () => {
      const enemy = createAbyssalOctopus();
      const stats = createEmptyStats();
      stats.faceDownCardsMatched = 4;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with 5+ face-down matches', () => {
      const enemy = createAbyssalOctopus();
      const stats = createEmptyStats();
      stats.faceDownCardsMatched = 5;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
