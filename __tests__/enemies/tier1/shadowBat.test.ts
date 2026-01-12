/**
 * Unit tests for Shadow Bat enemy.
 */
import type { Card } from '@/types';
import type { RoundStats } from '@/types/enemy';
import { createShadowBat } from '@/utils/enemies/tier1/shadowBat';

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

describe('Shadow Bat', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createShadowBat();
      expect(enemy.name).toBe('Shadow Bat');
    });

    it('has correct tier', () => {
      const enemy = createShadowBat();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon', () => {
      const enemy = createShadowBat();
      expect(enemy.icon).toBe('lorc/evil-bat');
    });

    it('has correct description', () => {
      const enemy = createShadowBat();
      expect(enemy.description).toContain('Laser');
      expect(enemy.description).toContain('20%');
    });

    it('has correct defeat condition text', () => {
      const enemy = createShadowBat();
      expect(enemy.defeatConditionText).toBe('Get an all-different match');
    });
  });

  describe('weapon counter effect', () => {
    it('returns laser chance reduction in stat modifiers', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.laserChanceReduction).toBe(20);
    });

    it('shows weapon counter in UI modifiers', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters).toContainEqual({ type: 'laser', reduction: 20 });
    });

    it('does not affect other weapon types', () => {
      const enemy = createShadowBat();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
      expect(modifiers.explosionChanceReduction).toBeUndefined();
      expect(modifiers.hintGainChanceReduction).toBeUndefined();
    });
  });

  describe('defeat condition', () => {
    it('returns false when no all-different matches', () => {
      const enemy = createShadowBat();
      const stats = createRoundStats({ allDifferentMatches: 0 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when exactly 1 all-different match', () => {
      const enemy = createShadowBat();
      const stats = createRoundStats({ allDifferentMatches: 1 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when more than 1 all-different match', () => {
      const enemy = createShadowBat();
      const stats = createRoundStats({ allDifferentMatches: 5 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  describe('lifecycle hooks', () => {
    it('onRoundStart returns empty result', () => {
      const enemy = createShadowBat();
      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('onTick returns zero deltas', () => {
      const enemy = createShadowBat();
      const result = enemy.onTick(1000, []);
      expect(result.scoreDelta).toBe(0);
      expect(result.healthDelta).toBe(0);
      expect(result.timeDelta).toBe(0);
    });

    it('onCardDraw returns unmodified card', () => {
      const enemy = createShadowBat();
      const card = createTestCard();
      const result = enemy.onCardDraw(card);
      expect(result).toEqual(card);
    });

    it('onValidMatch returns neutral result', () => {
      const enemy = createShadowBat();
      const result = enemy.onValidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.timeDelta).toBe(0);
    });

    it('onInvalidMatch returns neutral result', () => {
      const enemy = createShadowBat();
      const result = enemy.onInvalidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.cardsToRemove).toEqual([]);
    });
  });
});
