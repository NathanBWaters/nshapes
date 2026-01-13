import { createVenomousCobra } from '@/utils/enemies/tier2/venomousCobra';
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

describe('Venomous Cobra', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createVenomousCobra();
      expect(enemy.name).toBe('Venomous Cobra');
      expect(enemy.tier).toBe(2);
    });

    it('has correct icon', () => {
      const enemy = createVenomousCobra();
      expect(enemy.icon).toBe('skoll/cobra');
    });
  });

  describe('attribute change effect', () => {
    it('changes attribute after 15 seconds', () => {
      const enemy = createVenomousCobra();
      const board = createTestBoard();
      enemy.onRoundStart(board);

      const result = enemy.onTick(15000, board);
      expect(result.cardModifications.length).toBeGreaterThan(0);
    });
  });

  describe('bomb effect', () => {
    it('may place bombs on cards', () => {
      const enemy = createVenomousCobra();
      const card: Card = {
        id: 'test-card',
        shape: 'oval',
        color: 'red',
        number: 1,
        shading: 'solid',
        selected: false,
      };

      // Mock random to always place bomb
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.05);

      const modifiedCard = enemy.onCardDraw(card);
      expect(modifiedCard.hasBomb).toBe(true);
      expect(modifiedCard.bombTimer).toBe(10000);

      mockRandom.mockRestore();
    });
  });

  describe('defeat condition', () => {
    it('returns false with fewer than 4 bombs defused', () => {
      const enemy = createVenomousCobra();
      const stats = createEmptyStats();
      stats.bombsDefused = 3;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with 4+ bombs defused', () => {
      const enemy = createVenomousCobra();
      const stats = createEmptyStats();
      stats.bombsDefused = 4;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
