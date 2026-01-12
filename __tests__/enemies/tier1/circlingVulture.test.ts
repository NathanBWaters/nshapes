/**
 * Unit tests for Circling Vulture enemy.
 */
import type { Card } from '@/types';
import type { RoundStats } from '@/types/enemy';
import { createCirclingVulture } from '@/utils/enemies/tier1/circlingVulture';

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

describe('Circling Vulture', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createCirclingVulture();
      expect(enemy.name).toBe('Circling Vulture');
    });

    it('has correct tier', () => {
      const enemy = createCirclingVulture();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon', () => {
      const enemy = createCirclingVulture();
      expect(enemy.icon).toBe('lorc/vulture');
    });

    it('has correct description', () => {
      const enemy = createCirclingVulture();
      expect(enemy.description).toBe('Score drains 5 points per second');
    });

    it('has correct defeat condition text', () => {
      const enemy = createCirclingVulture();
      expect(enemy.defeatConditionText).toBe('Reach 150% of target score');
    });
  });

  describe('ScoreDecayEffect', () => {
    it('decays score at 5 points per second', () => {
      const enemy = createCirclingVulture();
      enemy.onRoundStart([]);

      // Tick 1 second - should decay 5 points
      const result = enemy.onTick(1000, []);
      expect(result.scoreDelta).toBe(-5);
    });

    it('decays score proportionally for partial seconds', () => {
      const enemy = createCirclingVulture();
      enemy.onRoundStart([]);

      // Tick 500ms - should decay 2.5 points
      const result = enemy.onTick(500, []);
      expect(result.scoreDelta).toBe(-2.5);
    });

    it('decays score over multiple ticks', () => {
      const enemy = createCirclingVulture();
      enemy.onRoundStart([]);

      // Tick 2 seconds total
      const result1 = enemy.onTick(1000, []);
      const result2 = enemy.onTick(1000, []);

      expect(result1.scoreDelta).toBe(-5);
      expect(result2.scoreDelta).toBe(-5);
    });

    it('shows score decay rate in UI modifiers', () => {
      const enemy = createCirclingVulture();
      enemy.onRoundStart([]);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showScoreDecay).toBeDefined();
      expect(modifiers.showScoreDecay?.rate).toBe(5);
    });
  });

  describe('defeat condition', () => {
    it('returns false when score is below 150% of target', () => {
      const enemy = createCirclingVulture();
      const stats = createRoundStats({
        currentScore: 140,
        targetScore: 100,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when score is exactly 150% of target', () => {
      const enemy = createCirclingVulture();
      const stats = createRoundStats({
        currentScore: 150,
        targetScore: 100,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when score exceeds 150% of target', () => {
      const enemy = createCirclingVulture();
      const stats = createRoundStats({
        currentScore: 200,
        targetScore: 100,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('correctly calculates 150% for different target scores', () => {
      const enemy = createCirclingVulture();

      // Target 200, need 300
      const stats1 = createRoundStats({
        currentScore: 299,
        targetScore: 200,
      });
      expect(enemy.checkDefeatCondition(stats1)).toBe(false);

      const stats2 = createRoundStats({
        currentScore: 300,
        targetScore: 200,
      });
      expect(enemy.checkDefeatCondition(stats2)).toBe(true);
    });
  });

  describe('lifecycle hooks', () => {
    it('onRoundStart returns empty result', () => {
      const enemy = createCirclingVulture();
      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('onCardDraw returns unmodified card', () => {
      const enemy = createCirclingVulture();
      const card = createTestCard();
      const result = enemy.onCardDraw(card);
      expect(result).toEqual(card);
    });

    it('onValidMatch returns neutral result', () => {
      const enemy = createCirclingVulture();
      const result = enemy.onValidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.timeDelta).toBe(0);
    });

    it('onInvalidMatch returns neutral result', () => {
      const enemy = createCirclingVulture();
      const result = enemy.onInvalidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.cardsToRemove).toEqual([]);
    });
  });
});
