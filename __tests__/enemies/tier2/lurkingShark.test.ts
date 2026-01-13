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

  describe('countdown effect', () => {
    it('places countdown card on round start', () => {
      const enemy = createLurkingShark();
      const board = createTestBoard();

      const result = enemy.onRoundStart(board);
      expect(result.cardModifications.length).toBeGreaterThan(0);

      const countdownMod = result.cardModifications.find((m) => m.changes.hasCountdown);
      expect(countdownMod).toBeDefined();
      expect(countdownMod?.changes.countdownTimer).toBe(12000);
    });

    it('damages player when countdown expires', () => {
      const enemy = createLurkingShark();
      const board = createTestBoard();

      enemy.onRoundStart(board);

      // Simulate 12 seconds
      const result = enemy.onTick(12000, board);
      expect(result.healthDelta).toBe(-1);
    });
  });

  describe('defeat condition', () => {
    it('returns false with insufficient face-down matches', () => {
      const enemy = createLurkingShark();
      const stats = createEmptyStats();
      stats.faceDownCardsMatched = 2;
      stats.countdownCardsMatched = 1;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false without countdown match', () => {
      const enemy = createLurkingShark();
      const stats = createEmptyStats();
      stats.faceDownCardsMatched = 3;
      stats.countdownCardsMatched = 0;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with 3+ face-down and 1+ countdown matches', () => {
      const enemy = createLurkingShark();
      const stats = createEmptyStats();
      stats.faceDownCardsMatched = 3;
      stats.countdownCardsMatched = 1;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
