/**
 * Unit tests for Shifting Chameleon enemy.
 */
import type { Card } from '@/types';
import type { RoundStats } from '@/types/enemy';
import { createShiftingChameleon } from '@/utils/enemies/tier1/shiftingChameleon';

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
  ...overrides,
});

// Mock Math.random for deterministic tests
const mockRandom = (value: number) => {
  jest.spyOn(Math, 'random').mockReturnValue(value);
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Shifting Chameleon', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createShiftingChameleon();
      expect(enemy.name).toBe('Shifting Chameleon');
    });

    it('has correct tier', () => {
      const enemy = createShiftingChameleon();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon', () => {
      const enemy = createShiftingChameleon();
      expect(enemy.icon).toBe('darkzaitzev/chameleon-glyph');
    });

    it('has correct description', () => {
      const enemy = createShiftingChameleon();
      expect(enemy.description).toContain('20s');
      expect(enemy.description).toContain('attribute');
    });

    it('has correct defeat condition text', () => {
      const enemy = createShiftingChameleon();
      expect(enemy.defeatConditionText).toBe('Get 2 all-different matches');
    });
  });

  describe('attribute change effect', () => {
    it('does not change attributes before interval', () => {
      const enemy = createShiftingChameleon();
      const card = createTestCard('card-1');
      const board = [card];

      // Simulate 10 seconds (half the interval)
      const result = enemy.onTick(10000, board);
      expect(result.cardModifications).toEqual([]);
    });

    it('changes an attribute after 20s interval', () => {
      mockRandom(0); // Will select first card and first attribute
      const enemy = createShiftingChameleon();
      const card = createTestCard('card-1');
      const board = [card];

      // Simulate 20 seconds
      const result = enemy.onTick(20000, board);
      expect(result.cardModifications.length).toBe(1);
      expect(result.cardModifications[0].cardId).toBe('card-1');
      expect(result.events.length).toBe(1);
      expect(result.events[0].type).toBe('attribute_changed');
    });

    it('skips dud cards when selecting target', () => {
      mockRandom(0);
      const enemy = createShiftingChameleon();
      const dudCard = createTestCard('dud-card', { isDud: true });
      const normalCard = createTestCard('normal-card');
      const board = [dudCard, normalCard];

      const result = enemy.onTick(20000, board);
      // Should modify the normal card, not the dud
      expect(result.cardModifications[0].cardId).toBe('normal-card');
    });

    it('skips face-down cards when selecting target', () => {
      mockRandom(0);
      const enemy = createShiftingChameleon();
      const faceDownCard = createTestCard('facedown-card', { isFaceDown: true });
      const normalCard = createTestCard('normal-card');
      const board = [faceDownCard, normalCard];

      const result = enemy.onTick(20000, board);
      expect(result.cardModifications[0].cardId).toBe('normal-card');
    });

    it('returns empty result when no valid cards', () => {
      const enemy = createShiftingChameleon();
      const board: Card[] = [];

      const result = enemy.onTick(20000, board);
      expect(result.cardModifications).toEqual([]);
    });

    it('resets timer after attribute change', () => {
      mockRandom(0);
      const enemy = createShiftingChameleon();
      const card = createTestCard('card-1');
      const board = [card];

      // First change at 20s
      enemy.onTick(20000, board);

      // 10 more seconds should not trigger another change
      const result = enemy.onTick(10000, board);
      expect(result.cardModifications).toEqual([]);
    });
  });

  describe('defeat condition', () => {
    it('returns false when allDifferentMatches < 2', () => {
      const enemy = createShiftingChameleon();
      const stats = createRoundStats({ allDifferentMatches: 1 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when allDifferentMatches = 2', () => {
      const enemy = createShiftingChameleon();
      const stats = createRoundStats({ allDifferentMatches: 2 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when allDifferentMatches > 2', () => {
      const enemy = createShiftingChameleon();
      const stats = createRoundStats({ allDifferentMatches: 5 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  describe('lifecycle hooks', () => {
    it('onRoundStart resets internal state', () => {
      const enemy = createShiftingChameleon();
      const card = createTestCard('card-1');
      const board = [card];

      // Accumulate some time
      enemy.onTick(15000, board);

      // Round start should reset
      enemy.onRoundStart(board);

      // Now 10s should not trigger (would need 20s total)
      mockRandom(0);
      const result = enemy.onTick(10000, board);
      expect(result.cardModifications).toEqual([]);
    });

    it('onCardDraw returns unmodified card', () => {
      const enemy = createShiftingChameleon();
      const card = createTestCard();
      const result = enemy.onCardDraw(card);
      expect(result).toEqual(card);
    });

    it('onValidMatch returns neutral result', () => {
      const enemy = createShiftingChameleon();
      const result = enemy.onValidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.timeDelta).toBe(0);
    });

    it('onInvalidMatch returns neutral result', () => {
      const enemy = createShiftingChameleon();
      const result = enemy.onInvalidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.cardsToRemove).toEqual([]);
    });
  });
});
