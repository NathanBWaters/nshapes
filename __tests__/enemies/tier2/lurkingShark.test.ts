import { createLurkingShark } from '@/utils/enemies/tier2/lurkingShark';
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

describe('Lurking Shark', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createLurkingShark();
      expect(enemy.name).toBe('Lurking Shark');
      expect(enemy.tier).toBe(2);
    });

    it('has correct icon', () => {
      const enemy = createLurkingShark();
      expect(enemy.icon).toBe('lorc/shark-jaws');
    });

    it('has correct description', () => {
      const enemy = createLurkingShark();
      expect(enemy.description).toBe('25% of new cards are face-down');
    });

    it('has correct defeat condition text', () => {
      const enemy = createLurkingShark();
      expect(enemy.defeatConditionText).toBe('Match 3 face-down cards');
    });
  });

  describe('face-down effect', () => {
    it('may create face-down cards on draw', () => {
      const enemy = createLurkingShark();
      const card: Card = {
        id: 'test-card',
        shape: 'oval',
        color: 'red',
        number: 1,
        shading: 'solid',
        selected: false,
      };

      // Mock random to always return below 25%
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const modifiedCard = enemy.onCardDraw(card);
      expect(modifiedCard.isFaceDown).toBe(true);

      mockRandom.mockRestore();
    });

    it('does not create face-down when roll fails', () => {
      const enemy = createLurkingShark();
      const card: Card = {
        id: 'test-card',
        shape: 'oval',
        color: 'red',
        number: 1,
        shading: 'solid',
        selected: false,
      };

      // Mock random to return above 25%
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const modifiedCard = enemy.onCardDraw(card);
      expect(modifiedCard.isFaceDown).toBeUndefined();

      mockRandom.mockRestore();
    });
  });

  describe('defeat condition', () => {
    it('returns false with insufficient face-down matches', () => {
      const enemy = createLurkingShark();
      const stats = createEmptyStats();
      stats.faceDownCardsMatched = 2;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with 3 face-down matches', () => {
      const enemy = createLurkingShark();
      const stats = createEmptyStats();
      stats.faceDownCardsMatched = 3;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true with more than 3 face-down matches', () => {
      const enemy = createLurkingShark();
      const stats = createEmptyStats();
      stats.faceDownCardsMatched = 5;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
