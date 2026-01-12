/**
 * Unit tests for Lazy Sloth enemy.
 */
import type { RoundStats } from '@/types/enemy';
import { createLazySloth } from '@/utils/enemies/tier1/lazySloth';

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

describe('Lazy Sloth', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createLazySloth();
      expect(enemy.name).toBe('Lazy Sloth');
    });

    it('has correct tier', () => {
      const enemy = createLazySloth();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon', () => {
      const enemy = createLazySloth();
      expect(enemy.icon).toBe('caro-asercion/sloth');
    });

    it('has correct description', () => {
      const enemy = createLazySloth();
      expect(enemy.description).toContain('Time gain reduced by 20%');
    });

    it('has correct defeat condition text', () => {
      const enemy = createLazySloth();
      expect(enemy.defeatConditionText).toContain('15+ seconds remaining');
    });
  });

  describe('WeaponCounterEffect', () => {
    it('returns time gain chance reduction in stat modifiers', () => {
      const enemy = createLazySloth();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.timeGainChanceReduction).toBe(20);
    });

    it('returns weapon counter info in UI modifiers', () => {
      const enemy = createLazySloth();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.weaponCounters).toContainEqual({ type: 'time', reduction: 20 });
    });
  });

  describe('defeat condition', () => {
    it('returns false when score is below target', () => {
      const enemy = createLazySloth();
      const stats = createRoundStats({ currentScore: 50, targetScore: 100, timeRemaining: 20 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when score meets target but time is below 15 seconds', () => {
      const enemy = createLazySloth();
      const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 10 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when time is exactly 14 seconds', () => {
      const enemy = createLazySloth();
      const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 14 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when score meets target and time is exactly 15 seconds', () => {
      const enemy = createLazySloth();
      const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 15 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when score exceeds target and time is above 15 seconds', () => {
      const enemy = createLazySloth();
      const stats = createRoundStats({ currentScore: 150, targetScore: 100, timeRemaining: 30 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
