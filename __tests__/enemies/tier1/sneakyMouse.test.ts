/**
 * Unit tests for Sneaky Mouse enemy.
 */
import type { Card } from '@/types';
import type { RoundStats } from '@/types/enemy';
import { createSneakyMouse } from '@/utils/enemies/tier1/sneakyMouse';

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

describe('Sneaky Mouse', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createSneakyMouse();
      expect(enemy.name).toBe('Sneaky Mouse');
    });

    it('has correct tier', () => {
      const enemy = createSneakyMouse();
      expect(enemy.tier).toBe(1);
    });

    it('has correct description', () => {
      const enemy = createSneakyMouse();
      expect(enemy.description).toBe('Grace gain reduced by 15%');
    });

    it('has correct icon', () => {
      const enemy = createSneakyMouse();
      expect(enemy.icon).toBe('lorc/mouse');
    });

    it('has correct defeat condition text', () => {
      const enemy = createSneakyMouse();
      expect(enemy.defeatConditionText).toBe('Never use a grace');
    });
  });

  describe('weapon counter effect', () => {
    it('returns grace gain chance reduction of 15 in stat modifiers', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.graceGainChanceReduction).toBe(15);
    });

    it('shows weapon counter in UI modifiers', () => {
      const enemy = createSneakyMouse();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters).toContainEqual({
        type: 'grace',
        reduction: 15,
      });
    });
  });

  describe('defeat condition', () => {
    it('returns false when no matches have been made', () => {
      const enemy = createSneakyMouse();
      const stats = createRoundStats({
        totalMatches: 0,
        gracesUsed: 0,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when graces have been used', () => {
      const enemy = createSneakyMouse();
      const stats = createRoundStats({
        totalMatches: 5,
        gracesUsed: 1,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when multiple graces have been used', () => {
      const enemy = createSneakyMouse();
      const stats = createRoundStats({
        totalMatches: 10,
        gracesUsed: 3,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when at least 1 match and no graces used', () => {
      const enemy = createSneakyMouse();
      const stats = createRoundStats({
        totalMatches: 1,
        gracesUsed: 0,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when many matches and no graces used', () => {
      const enemy = createSneakyMouse();
      const stats = createRoundStats({
        totalMatches: 10,
        gracesUsed: 0,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  describe('lifecycle hooks', () => {
    it('onRoundStart returns empty result', () => {
      const enemy = createSneakyMouse();
      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('onTick returns zero deltas', () => {
      const enemy = createSneakyMouse();
      const result = enemy.onTick(1000, []);
      expect(result.scoreDelta).toBe(0);
      expect(result.healthDelta).toBe(0);
      expect(result.timeDelta).toBe(0);
    });

    it('onCardDraw returns unmodified card', () => {
      const enemy = createSneakyMouse();
      const card = createTestCard();
      const result = enemy.onCardDraw(card);
      expect(result).toEqual(card);
    });

    it('onValidMatch returns neutral result', () => {
      const enemy = createSneakyMouse();
      const result = enemy.onValidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.timeDelta).toBe(0);
    });

    it('onInvalidMatch returns neutral result', () => {
      const enemy = createSneakyMouse();
      const result = enemy.onInvalidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.cardsToRemove).toEqual([]);
    });
  });
});
