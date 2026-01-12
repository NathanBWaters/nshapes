/**
 * Unit tests for Stalking Wolf enemy.
 */
import type { Card } from '@/types';
import type { RoundStats } from '@/types/enemy';
import { createStalkingWolf } from '@/utils/enemies/tier1/stalkingWolf';

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

describe('Stalking Wolf', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createStalkingWolf();
      expect(enemy.name).toBe('Stalking Wolf');
    });

    it('has correct tier', () => {
      const enemy = createStalkingWolf();
      expect(enemy.tier).toBe(1);
    });

    it('has correct description', () => {
      const enemy = createStalkingWolf();
      expect(enemy.description).toContain('45s');
      expect(enemy.description).toContain('inactivity');
    });

    it('has correct defeat condition text', () => {
      const enemy = createStalkingWolf();
      expect(enemy.defeatConditionText).toBe('Match 3 times in under 5s each');
    });
  });

  describe('inactivity effect', () => {
    it('does not penalize before 45s', () => {
      const enemy = createStalkingWolf();
      // Start fresh
      enemy.onRoundStart([]);
      // Tick 44 seconds - should not trigger penalty
      const result = enemy.onTick(44000, []);
      expect(result.healthDelta).toBe(0);
      expect(result.instantDeath).toBe(false);
    });

    it('penalizes with damage (not instant death) at 45s', () => {
      const enemy = createStalkingWolf();
      enemy.onRoundStart([]);
      // Tick 45 seconds - should trigger damage penalty
      const result = enemy.onTick(45000, []);
      expect(result.healthDelta).toBe(-1);
      expect(result.instantDeath).toBe(false);
    });

    it('resets inactivity timer on valid match', () => {
      const enemy = createStalkingWolf();
      enemy.onRoundStart([]);

      // Tick 30 seconds
      enemy.onTick(30000, []);

      // Make a match - should reset timer
      enemy.onValidMatch([], []);

      // Check UI modifiers - timer should be reset
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showInactivityBar?.current).toBe(0);
    });

    it('shows inactivity bar in UI modifiers', () => {
      const enemy = createStalkingWolf();
      enemy.onRoundStart([]);

      // Tick 20 seconds
      enemy.onTick(20000, []);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showInactivityBar).toBeDefined();
      expect(modifiers.showInactivityBar?.current).toBe(20000);
      expect(modifiers.showInactivityBar?.max).toBe(45000);
      expect(modifiers.showInactivityBar?.penalty).toBe('damage');
    });

    it('emits warning at 5 seconds remaining', () => {
      const enemy = createStalkingWolf();
      enemy.onRoundStart([]);

      // Tick to 40 seconds (5 seconds remaining)
      enemy.onTick(39500, []);
      const result = enemy.onTick(500, []); // Cross the 5-second threshold

      expect(result.events).toContainEqual({
        type: 'inactivity_warning',
        secondsRemaining: 5,
      });
    });
  });

  describe('defeat condition', () => {
    it('returns false when less than 3 fast matches', () => {
      const enemy = createStalkingWolf();
      const stats = createRoundStats({
        matchTimes: [4000, 3000], // Only 2 fast matches
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when exactly 3 fast matches (under 5s each)', () => {
      const enemy = createStalkingWolf();
      const stats = createRoundStats({
        matchTimes: [4000, 3500, 4999], // All under 5000ms
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when more than 3 fast matches', () => {
      const enemy = createStalkingWolf();
      const stats = createRoundStats({
        matchTimes: [2000, 3000, 4000, 1500], // 4 fast matches
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('does not count matches at exactly 5s (must be under)', () => {
      const enemy = createStalkingWolf();
      const stats = createRoundStats({
        matchTimes: [4000, 5000, 3000], // 5000ms is NOT under 5s
      });
      // Only 2 are under 5s (4000 and 3000), so should fail
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('ignores slow matches when counting', () => {
      const enemy = createStalkingWolf();
      const stats = createRoundStats({
        matchTimes: [4000, 10000, 3000, 15000, 2000], // 3 fast + 2 slow
      });
      // 3 fast matches is enough
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  describe('lifecycle hooks', () => {
    it('onRoundStart returns empty result', () => {
      const enemy = createStalkingWolf();
      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('onCardDraw returns unmodified card', () => {
      const enemy = createStalkingWolf();
      const card = createTestCard();
      const result = enemy.onCardDraw(card);
      expect(result).toEqual(card);
    });

    it('onValidMatch returns neutral result', () => {
      const enemy = createStalkingWolf();
      const result = enemy.onValidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.timeDelta).toBe(0);
    });

    it('onInvalidMatch returns neutral result', () => {
      const enemy = createStalkingWolf();
      const result = enemy.onInvalidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.cardsToRemove).toEqual([]);
    });
  });
});
