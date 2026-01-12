/**
 * Unit tests for Wet Crab enemy.
 */
import type { RoundStats } from '@/types/enemy';
import { createWetCrab } from '@/utils/enemies/tier1/wetCrab';

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

describe('Wet Crab', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createWetCrab();
      expect(enemy.name).toBe('Wet Crab');
    });

    it('has correct tier', () => {
      const enemy = createWetCrab();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon', () => {
      const enemy = createWetCrab();
      expect(enemy.icon).toBe('lorc/crab');
    });

    it('has correct description', () => {
      const enemy = createWetCrab();
      expect(enemy.description).toContain('Fire effects reduced by 15%');
    });

    it('has correct defeat condition text', () => {
      const enemy = createWetCrab();
      expect(enemy.defeatConditionText).toContain('2 all-same color matches');
    });
  });

  describe('WeaponCounterEffect', () => {
    it('returns fire spread chance reduction in stat modifiers', () => {
      const enemy = createWetCrab();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.fireSpreadChanceReduction).toBe(15);
    });

    it('returns weapon counter info in UI modifiers', () => {
      const enemy = createWetCrab();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.weaponCounters).toContainEqual({ type: 'fire', reduction: 15 });
    });
  });

  describe('defeat condition', () => {
    it('returns false when no all-same color matches', () => {
      const enemy = createWetCrab();
      const stats = createRoundStats({ allSameColorMatches: 0 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when only 1 all-same color match', () => {
      const enemy = createWetCrab();
      const stats = createRoundStats({ allSameColorMatches: 1 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when exactly 2 all-same color matches', () => {
      const enemy = createWetCrab();
      const stats = createRoundStats({ allSameColorMatches: 2 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when more than 2 all-same color matches', () => {
      const enemy = createWetCrab();
      const stats = createRoundStats({ allSameColorMatches: 5 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
