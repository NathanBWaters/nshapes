/**
 * Unit tests for Punishing Ermine enemy.
 */
import type { Card } from '@/types';
import type { RoundStats } from '@/types/enemy';
import { createPunishingErmine } from '@/utils/enemies/tier1/punishingErmine';

// Helper to create a minimal test card
const createTestCard = (id: string = 'test-card', overrides: Partial<Card> = {}): Card => ({
  id,
  shape: 'oval',
  color: 'red',
  number: 1,
  shading: 'solid',
  background: 'white',
  selected: false,
  ...overrides,
});

// Helper to create minimal RoundStats
const createRoundStats = (overrides: Partial<RoundStats> = {}): RoundStats => ({
  totalMatches: 0,
  currentStreak: 0,
  maxStreak: 0,
  invalidMatches: 0,
  matchTimes: [],
  timeRemaining: 60,
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
  ...overrides,
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Punishing Ermine', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createPunishingErmine();
      expect(enemy.name).toBe('Punishing Ermine');
    });

    it('has correct tier', () => {
      const enemy = createPunishingErmine();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon', () => {
      const enemy = createPunishingErmine();
      expect(enemy.icon).toBe('delapouite/ermine');
    });

    it('has correct description', () => {
      const enemy = createPunishingErmine();
      expect(enemy.description).toBe('On invalid match, 2 extra cards are removed');
    });

    it('has correct defeat condition text', () => {
      const enemy = createPunishingErmine();
      expect(enemy.defeatConditionText).toBe('Make no invalid matches');
    });
  });

  describe('ExtraCardRemovalOnInvalidEffect', () => {
    it('removes 2 cards on invalid match', () => {
      const enemy = createPunishingErmine();
      const board = [
        createTestCard('card-1'),
        createTestCard('card-2'),
        createTestCard('card-3'),
        createTestCard('card-4'),
        createTestCard('card-5'),
        createTestCard('card-6'),
        createTestCard('card-7'),
        createTestCard('card-8'),
        createTestCard('card-9'),
        createTestCard('card-10'),
        createTestCard('card-11'),
        createTestCard('card-12'),
      ];

      const result = enemy.onInvalidMatch([], board);
      expect(result.cardsToRemove).toHaveLength(2);
      expect(result.events).toHaveLength(2);
      result.events.forEach((event) => {
        expect(event.type).toBe('card_removed');
      });
    });

    it('does not remove cards if board would go below minBoardSize', () => {
      const enemy = createPunishingErmine();
      // Board with exactly 6 cards (minBoardSize)
      const board = [
        createTestCard('card-1'),
        createTestCard('card-2'),
        createTestCard('card-3'),
        createTestCard('card-4'),
        createTestCard('card-5'),
        createTestCard('card-6'),
      ];

      const result = enemy.onInvalidMatch([], board);
      expect(result.cardsToRemove).toHaveLength(0);
      expect(result.events).toHaveLength(0);
    });

    it('removes only 1 card if board has 7 cards (to stay above minBoardSize 6)', () => {
      const enemy = createPunishingErmine();
      const board = [
        createTestCard('card-1'),
        createTestCard('card-2'),
        createTestCard('card-3'),
        createTestCard('card-4'),
        createTestCard('card-5'),
        createTestCard('card-6'),
        createTestCard('card-7'),
      ];

      const result = enemy.onInvalidMatch([], board);
      expect(result.cardsToRemove).toHaveLength(1);
      expect(result.events).toHaveLength(1);
    });

    it('does not remove dud cards', () => {
      // Mock Math.random to always return 0 (first valid card)
      jest.spyOn(Math, 'random').mockReturnValue(0);

      const enemy = createPunishingErmine();
      const board = [
        createTestCard('dud-1', { isDud: true }),
        createTestCard('dud-2', { isDud: true }),
        createTestCard('card-1'),
        createTestCard('card-2'),
        createTestCard('card-3'),
        createTestCard('card-4'),
        createTestCard('card-5'),
        createTestCard('card-6'),
        createTestCard('card-7'),
        createTestCard('card-8'),
      ];

      const result = enemy.onInvalidMatch([], board);
      // Should remove 2 non-dud cards
      expect(result.cardsToRemove).toHaveLength(2);
      result.cardsToRemove.forEach((id) => {
        expect(id).not.toContain('dud');
      });
    });

    it('does not affect valid matches', () => {
      const enemy = createPunishingErmine();
      const board = [
        createTestCard('card-1'),
        createTestCard('card-2'),
        createTestCard('card-3'),
        createTestCard('card-4'),
        createTestCard('card-5'),
        createTestCard('card-6'),
        createTestCard('card-7'),
        createTestCard('card-8'),
        createTestCard('card-9'),
        createTestCard('card-10'),
        createTestCard('card-11'),
        createTestCard('card-12'),
      ];

      const result = enemy.onValidMatch([], board);
      expect(result.cardsToRemove).toHaveLength(0);
    });
  });

  describe('defeat condition', () => {
    it('returns false when no matches made', () => {
      const enemy = createPunishingErmine();
      const stats = createRoundStats({
        totalMatches: 0,
        invalidMatches: 0,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when valid matches made with no invalid matches', () => {
      const enemy = createPunishingErmine();
      const stats = createRoundStats({
        totalMatches: 5,
        invalidMatches: 0,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when exactly 1 valid match and no invalid matches', () => {
      const enemy = createPunishingErmine();
      const stats = createRoundStats({
        totalMatches: 1,
        invalidMatches: 0,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns false when invalid matches made', () => {
      const enemy = createPunishingErmine();
      const stats = createRoundStats({
        totalMatches: 5,
        invalidMatches: 1,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when multiple invalid matches made', () => {
      const enemy = createPunishingErmine();
      const stats = createRoundStats({
        totalMatches: 10,
        invalidMatches: 3,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });
  });

  describe('lifecycle hooks', () => {
    it('onRoundStart returns empty result', () => {
      const enemy = createPunishingErmine();
      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('onTick returns zero deltas', () => {
      const enemy = createPunishingErmine();
      const result = enemy.onTick(1000, []);
      expect(result.scoreDelta).toBe(0);
      expect(result.healthDelta).toBe(0);
      expect(result.timeDelta).toBe(0);
    });

    it('onCardDraw returns unmodified card', () => {
      const enemy = createPunishingErmine();
      const card = createTestCard();
      const result = enemy.onCardDraw(card);
      expect(result).toEqual(card);
    });
  });
});
