import { createFeralFangs } from '@/utils/enemies/tier3/feralFangs';
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

describe('Feral Fangs', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createFeralFangs();
      expect(enemy.name).toBe('Feral Fangs');
      expect(enemy.tier).toBe(3);
    });

    it('has correct icon', () => {
      const enemy = createFeralFangs();
      expect(enemy.icon).toBe('lorc/bestial-fangs');
    });
  });

  describe('dud card effect', () => {
    it('has 10% dud chance', () => {
      const enemy = createFeralFangs();
      const card: Card = {
        id: 'test',
        shape: 'oval',
        color: 'red',
        number: 1,
        shading: 'solid',
        selected: false,
      };

      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.05);
      const result = enemy.onCardDraw(card);
      expect(result.isDud).toBe(true);
      mockRandom.mockRestore();
    });
  });

  describe('triple card effect', () => {
    it('places 1 triple card on start', () => {
      const enemy = createFeralFangs();
      const board = createTestBoard();

      const result = enemy.onRoundStart(board);
      const tripleCards = result.cardModifications.filter((m) => m.changes.health === 3);
      expect(tripleCards.length).toBe(1);
    });
  });

  describe('card removal', () => {
    it('removes card every 12s', () => {
      const enemy = createFeralFangs();
      const board = createTestBoard();
      enemy.onRoundStart(board);

      const result = enemy.onTick(12000, board);
      expect(result.cardsToRemove.length).toBe(1);
    });
  });

  describe('defeat condition', () => {
    it('returns false without triple card cleared', () => {
      const enemy = createFeralFangs();
      const stats = createEmptyStats();
      stats.tripleCardsCleared = 0;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with triple card cleared', () => {
      const enemy = createFeralFangs();
      const stats = createEmptyStats();
      stats.tripleCardsCleared = 1;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
