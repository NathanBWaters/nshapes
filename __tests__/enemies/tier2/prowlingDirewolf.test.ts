import { createProwlingDirewolf } from '@/utils/enemies/tier2/prowlingDirewolf';
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

describe('Prowling Direwolf', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createProwlingDirewolf();
      expect(enemy.name).toBe('Prowling Direwolf');
      expect(enemy.tier).toBe(2);
    });

    it('has correct icon', () => {
      const enemy = createProwlingDirewolf();
      expect(enemy.icon).toBe('lorc/direwolf');
    });
  });

  describe('dud card effect', () => {
    it('may create dud cards at 6% chance', () => {
      const enemy = createProwlingDirewolf();
      const card: Card = {
        id: 'test-card',
        shape: 'oval',
        color: 'red',
        number: 1,
        shading: 'solid',
        selected: false,
      };

      // Mock random to return below 6%
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.03);

      const modifiedCard = enemy.onCardDraw(card);
      expect(modifiedCard.isDud).toBe(true);

      mockRandom.mockRestore();
    });

    it('does not create dud when roll fails', () => {
      const enemy = createProwlingDirewolf();
      const card: Card = {
        id: 'test-card',
        shape: 'oval',
        color: 'red',
        number: 1,
        shading: 'solid',
        selected: false,
      };

      // Mock random to return above 6%
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const modifiedCard = enemy.onCardDraw(card);
      expect(modifiedCard.isDud).toBeUndefined();

      mockRandom.mockRestore();
    });
  });

  describe('position shuffle effect', () => {
    it('emits shuffle event after 25 seconds', () => {
      const enemy = createProwlingDirewolf();
      const board: Card[] = [];

      const result = enemy.onTick(25000, board);
      expect(result.events).toContainEqual({ type: 'positions_shuffled' });
    });
  });

  describe('defeat condition', () => {
    it('returns false with 5-match streak', () => {
      const enemy = createProwlingDirewolf();
      const stats = createEmptyStats();
      stats.maxStreak = 5;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with 6-match streak', () => {
      const enemy = createProwlingDirewolf();
      const stats = createEmptyStats();
      stats.maxStreak = 6;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
