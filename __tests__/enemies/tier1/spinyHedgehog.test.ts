/**
 * Unit tests for Spiny Hedgehog enemy.
 */
import type { RoundStats } from '@/types/enemy';
import { createSpinyHedgehog } from '@/utils/enemies/tier1/spinyHedgehog';

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

describe('Spiny Hedgehog', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createSpinyHedgehog();
      expect(enemy.name).toBe('Spiny Hedgehog');
    });

    it('has correct icon', () => {
      const enemy = createSpinyHedgehog();
      expect(enemy.icon).toBe('caro-asercion/hedgehog');
    });

    it('has correct tier', () => {
      const enemy = createSpinyHedgehog();
      expect(enemy.tier).toBe(1);
    });

    it('has correct description', () => {
      const enemy = createSpinyHedgehog();
      expect(enemy.description).toContain('Explosion');
      expect(enemy.description).toContain('15%');
    });

    it('has correct defeat condition text', () => {
      const enemy = createSpinyHedgehog();
      expect(enemy.defeatConditionText).toBe('Get 3 matches containing squiggles');
    });
  });

  describe('WeaponCounterEffect', () => {
    it('returns correct stat modifier for explosion reduction', () => {
      const enemy = createSpinyHedgehog();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.explosionChanceReduction).toBe(15);
    });

    it('returns correct UI modifier with counter badge info', () => {
      const enemy = createSpinyHedgehog();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters).toContainEqual({ type: 'explosion', reduction: 15 });
    });
  });

  describe('defeat condition', () => {
    it('returns false when less than 3 squiggle matches', () => {
      const enemy = createSpinyHedgehog();
      const stats = createRoundStats({
        squiggleMatches: 2,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when exactly 3 squiggle matches', () => {
      const enemy = createSpinyHedgehog();
      const stats = createRoundStats({
        squiggleMatches: 3,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when more than 3 squiggle matches', () => {
      const enemy = createSpinyHedgehog();
      const stats = createRoundStats({
        squiggleMatches: 5,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns false when no squiggle matches', () => {
      const enemy = createSpinyHedgehog();
      const stats = createRoundStats({
        squiggleMatches: 0,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });
  });

  describe('lifecycle hooks', () => {
    it('onRoundStart returns empty result', () => {
      const enemy = createSpinyHedgehog();
      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('onTick returns neutral result', () => {
      const enemy = createSpinyHedgehog();
      enemy.onRoundStart([]);
      const result = enemy.onTick(1000, []);
      expect(result.healthDelta).toBe(0);
      expect(result.instantDeath).toBe(false);
    });

    it('onValidMatch returns neutral result', () => {
      const enemy = createSpinyHedgehog();
      const result = enemy.onValidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('onInvalidMatch returns neutral result', () => {
      const enemy = createSpinyHedgehog();
      const result = enemy.onInvalidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.cardsToRemove).toEqual([]);
    });
  });
});
