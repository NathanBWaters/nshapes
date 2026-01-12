/**
 * Unit tests for Masked Bandit enemy.
 */
import type { Card } from '@/types';
import type { RoundStats } from '@/types/enemy';
import { createMaskedBandit } from '@/utils/enemies/tier1/maskedBandit';

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

describe('Masked Bandit', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createMaskedBandit();
      expect(enemy.name).toBe('Masked Bandit');
    });

    it('has correct tier', () => {
      const enemy = createMaskedBandit();
      expect(enemy.tier).toBe(1);
    });

    it('has correct description', () => {
      const enemy = createMaskedBandit();
      expect(enemy.description).toContain('auto-hints');
    });

    it('has correct defeat condition text', () => {
      const enemy = createMaskedBandit();
      expect(enemy.defeatConditionText).toBe('Get 3 matches without hesitating >10s');
    });
  });

  describe('hint disable effect', () => {
    it('disables auto-hints in UI modifiers', () => {
      const enemy = createMaskedBandit();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableAutoHint).toBe(true);
    });

    it('does not disable manual hints', () => {
      const enemy = createMaskedBandit();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableManualHint).toBeFalsy();
    });
  });

  describe('defeat condition', () => {
    it('returns false when less than 3 matches', () => {
      const enemy = createMaskedBandit();
      const stats = createRoundStats({
        matchTimes: [5000, 3000], // Only 2 matches
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when first 3 matches all under 10s', () => {
      const enemy = createMaskedBandit();
      const stats = createRoundStats({
        matchTimes: [5000, 8000, 9999], // All under 10000ms
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns false when any of first 3 matches is at exactly 10s', () => {
      const enemy = createMaskedBandit();
      const stats = createRoundStats({
        matchTimes: [5000, 10000, 3000], // 10000ms is NOT under 10s
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when any of first 3 matches is over 10s', () => {
      const enemy = createMaskedBandit();
      const stats = createRoundStats({
        matchTimes: [5000, 3000, 15000], // Third match took too long
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('only checks first 3 matches, later matches do not matter', () => {
      const enemy = createMaskedBandit();
      const stats = createRoundStats({
        matchTimes: [5000, 3000, 8000, 25000, 30000], // First 3 fast, later slow
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns false if first match is slow even with fast later matches', () => {
      const enemy = createMaskedBandit();
      const stats = createRoundStats({
        matchTimes: [15000, 3000, 4000], // First match slow
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });
  });

  describe('lifecycle hooks', () => {
    it('onRoundStart returns empty result', () => {
      const enemy = createMaskedBandit();
      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('onTick returns zero deltas', () => {
      const enemy = createMaskedBandit();
      const result = enemy.onTick(1000, []);
      expect(result.scoreDelta).toBe(0);
      expect(result.healthDelta).toBe(0);
      expect(result.timeDelta).toBe(0);
    });

    it('onCardDraw returns unmodified card', () => {
      const enemy = createMaskedBandit();
      const card = createTestCard();
      const result = enemy.onCardDraw(card);
      expect(result).toEqual(card);
    });

    it('onValidMatch returns neutral result', () => {
      const enemy = createMaskedBandit();
      const result = enemy.onValidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.timeDelta).toBe(0);
    });

    it('onInvalidMatch returns neutral result', () => {
      const enemy = createMaskedBandit();
      const result = enemy.onInvalidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.cardsToRemove).toEqual([]);
    });
  });
});
