/**
 * Unit tests for Foggy Frog enemy.
 */
import type { Card } from '@/types';
import type { RoundStats } from '@/types/enemy';
import { createFoggyFrog } from '@/utils/enemies/tier1/foggyFrog';

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

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Foggy Frog', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createFoggyFrog();
      expect(enemy.name).toBe('Foggy Frog');
    });

    it('has correct tier', () => {
      const enemy = createFoggyFrog();
      expect(enemy.tier).toBe(1);
    });

    it('has correct description', () => {
      const enemy = createFoggyFrog();
      expect(enemy.description).toContain('Hint gain reduced by 15%');
    });

    it('has correct icon', () => {
      const enemy = createFoggyFrog();
      expect(enemy.icon).toBe('lorc/frog');
    });

    it('has correct defeat condition text', () => {
      const enemy = createFoggyFrog();
      expect(enemy.defeatConditionText).toBe('Beat target score with 2+ hints remaining');
    });
  });

  describe('weapon counter effect', () => {
    it('returns hint gain chance reduction of 15 in stat modifiers', () => {
      const enemy = createFoggyFrog();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.hintGainChanceReduction).toBe(15);
    });

    it('shows weapon counter in UI modifiers', () => {
      const enemy = createFoggyFrog();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters).toContainEqual({
        type: 'hint',
        reduction: 15,
      });
    });
  });

  describe('defeat condition', () => {
    it('returns false when score is below target', () => {
      const enemy = createFoggyFrog();
      const stats = createRoundStats({
        currentScore: 50,
        targetScore: 100,
        hintsRemaining: 3,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when score meets target but hints remaining is less than 2', () => {
      const enemy = createFoggyFrog();
      const stats = createRoundStats({
        currentScore: 100,
        targetScore: 100,
        hintsRemaining: 1,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when score meets target but hints remaining is 0', () => {
      const enemy = createFoggyFrog();
      const stats = createRoundStats({
        currentScore: 100,
        targetScore: 100,
        hintsRemaining: 0,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when score meets target and hints remaining is exactly 2', () => {
      const enemy = createFoggyFrog();
      const stats = createRoundStats({
        currentScore: 100,
        targetScore: 100,
        hintsRemaining: 2,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when score exceeds target and hints remaining is more than 2', () => {
      const enemy = createFoggyFrog();
      const stats = createRoundStats({
        currentScore: 150,
        targetScore: 100,
        hintsRemaining: 5,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when score equals target exactly with 2 hints remaining', () => {
      const enemy = createFoggyFrog();
      const stats = createRoundStats({
        currentScore: 100,
        targetScore: 100,
        hintsRemaining: 2,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  describe('lifecycle hooks', () => {
    it('onRoundStart returns empty result', () => {
      const enemy = createFoggyFrog();
      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('onTick returns zero deltas', () => {
      const enemy = createFoggyFrog();
      const result = enemy.onTick(1000, []);
      expect(result.scoreDelta).toBe(0);
      expect(result.healthDelta).toBe(0);
      expect(result.timeDelta).toBe(0);
    });

    it('onCardDraw returns unmodified card', () => {
      const enemy = createFoggyFrog();
      const card = createTestCard();
      const result = enemy.onCardDraw(card);
      expect(result).toEqual(card);
    });

    it('onValidMatch returns neutral result', () => {
      const enemy = createFoggyFrog();
      const result = enemy.onValidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.timeDelta).toBe(0);
    });

    it('onInvalidMatch returns neutral result', () => {
      const enemy = createFoggyFrog();
      const result = enemy.onInvalidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.cardsToRemove).toEqual([]);
    });
  });
});
