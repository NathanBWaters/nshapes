/**
 * Unit tests for Night Owl enemy.
 */
import type { Card } from '@/types';
import type { RoundStats } from '@/types/enemy';
import { createNightOwl } from '@/utils/enemies/tier1/nightOwl';

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

describe('Night Owl', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createNightOwl();
      expect(enemy.name).toBe('Night Owl');
    });

    it('has correct icon', () => {
      const enemy = createNightOwl();
      expect(enemy.icon).toBe('caro-asercion/barn-owl');
    });

    it('has correct tier', () => {
      const enemy = createNightOwl();
      expect(enemy.tier).toBe(1);
    });

    it('has correct description', () => {
      const enemy = createNightOwl();
      expect(enemy.description).toContain('20%');
      expect(enemy.description).toContain('face-down');
      expect(enemy.description).toContain('70%');
    });

    it('has correct defeat condition text', () => {
      const enemy = createNightOwl();
      expect(enemy.defeatConditionText).toBe('Match a set with a revealed card');
    });
  });

  describe('FaceDownEffect', () => {
    it('creates face-down cards with 20% chance', () => {
      const enemy = createNightOwl();

      // Mock Math.random to return values that trigger face-down (< 0.20)
      jest.spyOn(Math, 'random').mockReturnValue(0.1); // 10% < 20%, should be face-down

      const card = createTestCard('test-1');
      const result = enemy.onCardDraw(card);
      expect(result.isFaceDown).toBe(true);
    });

    it('does not create face-down cards when random >= 20%', () => {
      const enemy = createNightOwl();

      // Mock Math.random to return value that doesn't trigger face-down
      jest.spyOn(Math, 'random').mockReturnValue(0.25); // 25% >= 20%, should not be face-down

      const card = createTestCard('test-1');
      const result = enemy.onCardDraw(card);
      expect(result.isFaceDown).toBeUndefined();
    });

    it('flips face-down cards on valid match with 70% chance', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);

      // Mock Math.random - first call for flip check (< 0.70 = flip)
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // 50% < 70%, should flip

      const matchedCards = [createTestCard('matched-1')];
      const board = [
        createTestCard('board-1', { isFaceDown: true }),
        createTestCard('board-2'),
      ];

      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.cardsToFlip).toContain('board-1');
    });

    it('does not flip face-down cards when random >= 70%', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);

      // Mock Math.random to return value that doesn't trigger flip
      jest.spyOn(Math, 'random').mockReturnValue(0.8); // 80% >= 70%, should not flip

      const matchedCards = [createTestCard('matched-1')];
      const board = [
        createTestCard('board-1', { isFaceDown: true }),
      ];

      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.cardsToFlip).not.toContain('board-1');
    });

    it('emits card_flipped events for flipped cards', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);

      jest.spyOn(Math, 'random').mockReturnValue(0.5); // Will flip

      const board = [createTestCard('board-1', { isFaceDown: true })];
      const result = enemy.onValidMatch([], board);

      expect(result.events).toContainEqual({
        type: 'card_flipped',
        cardId: 'board-1',
      });
    });
  });

  describe('defeat condition', () => {
    it('returns false when no face-down cards matched', () => {
      const enemy = createNightOwl();
      const stats = createRoundStats({
        faceDownCardsMatched: 0,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when exactly 1 face-down card matched', () => {
      const enemy = createNightOwl();
      const stats = createRoundStats({
        faceDownCardsMatched: 1,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when multiple face-down cards matched', () => {
      const enemy = createNightOwl();
      const stats = createRoundStats({
        faceDownCardsMatched: 3,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  describe('lifecycle hooks', () => {
    it('onRoundStart returns empty result', () => {
      const enemy = createNightOwl();
      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('onTick returns neutral result', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      const result = enemy.onTick(1000, []);
      expect(result.healthDelta).toBe(0);
      expect(result.instantDeath).toBe(false);
    });

    it('onInvalidMatch returns neutral result', () => {
      const enemy = createNightOwl();
      const result = enemy.onInvalidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.cardsToRemove).toEqual([]);
    });
  });
});
