/**
 * Unit tests for Trap Weaver enemy.
 */
import type { Card } from '@/types';
import type { RoundStats } from '@/types/enemy';
import { createTrapWeaver } from '@/utils/enemies/tier1/trapWeaver';

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

// Mock Math.random for deterministic tests
const mockRandom = (value: number) => {
  jest.spyOn(Math, 'random').mockReturnValue(value);
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Trap Weaver', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createTrapWeaver();
      expect(enemy.name).toBe('Trap Weaver');
    });

    it('has correct tier', () => {
      const enemy = createTrapWeaver();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon', () => {
      const enemy = createTrapWeaver();
      expect(enemy.icon).toBe('carl-olsen/spider-face');
    });

    it('has correct description', () => {
      const enemy = createTrapWeaver();
      expect(enemy.description).toContain('Starts with 1 bomb card');
    });

    it('has correct defeat condition text', () => {
      const enemy = createTrapWeaver();
      expect(enemy.defeatConditionText).toContain('Defuse the bomb');
    });
  });

  describe('bomb spawn on round start', () => {
    it('spawns a bomb card at round start', () => {
      const enemy = createTrapWeaver();
      const board = [
        createTestCard('card-1'),
        createTestCard('card-2'),
        createTestCard('card-3'),
        createTestCard('card-4'),
        createTestCard('card-5'),
        createTestCard('card-6'),
      ];

      const result = enemy.onRoundStart(board);

      // Should have exactly one card modification for the bomb
      expect(result.cardModifications).toHaveLength(1);
      expect(result.cardModifications[0].changes.hasBomb).toBe(true);
      expect(result.cardModifications[0].changes.bombTimer).toBe(10000);
    });

    it('does not create bombs on card draw', () => {
      const enemy = createTrapWeaver();
      const card = createTestCard();
      const result = enemy.onCardDraw(card);
      // Should not add bombs via onCardDraw (bombChance is 0)
      expect(result.hasBomb).toBeUndefined();
    });

    it('bomb timer decrements on tick', () => {
      const enemy = createTrapWeaver();
      const bombCard = createTestCard('bomb-card', { hasBomb: true, bombTimer: 10000 });
      const board = [bombCard, createTestCard('card-2'), createTestCard('card-3'),
                     createTestCard('card-4'), createTestCard('card-5'), createTestCard('card-6'),
                     createTestCard('card-7')];

      // Simulate 3 seconds
      const result = enemy.onTick(3000, board);

      const modification = result.cardModifications.find(m => m.cardId === 'bomb-card');
      expect(modification).toBeDefined();
      expect(modification?.changes.bombTimer).toBe(7000);
    });

    it('bomb explodes when timer reaches 0', () => {
      const enemy = createTrapWeaver();
      const bombCard = createTestCard('bomb-card', { hasBomb: true, bombTimer: 1000 });
      const board = [bombCard, createTestCard('card-2'), createTestCard('card-3'),
                     createTestCard('card-4'), createTestCard('card-5'), createTestCard('card-6'),
                     createTestCard('card-7')];

      // Initialize bomb tracking
      enemy.onTick(0, board);

      // Simulate 2 seconds (beyond timer)
      const result = enemy.onTick(2000, board);

      expect(result.cardsToRemove).toContain('bomb-card');
      expect(result.events.some(e => e.type === 'bomb_exploded')).toBe(true);
    });

    it('bomb does not explode if board would go below minimum', () => {
      const enemy = createTrapWeaver();
      const bombCard = createTestCard('bomb-card', { hasBomb: true, bombTimer: 1000 });
      // Board at minimum size (6 cards)
      const board = [bombCard, createTestCard('card-2'), createTestCard('card-3'),
                     createTestCard('card-4'), createTestCard('card-5'), createTestCard('card-6')];

      // Initialize bomb tracking
      enemy.onTick(0, board);

      // Simulate beyond timer
      const result = enemy.onTick(2000, board);

      // Should not remove card at minimum board size
      expect(result.cardsToRemove).not.toContain('bomb-card');
    });

    it('getUIModifiers shows bomb cards', () => {
      const enemy = createTrapWeaver();
      const bombCard = createTestCard('bomb-card', { hasBomb: true, bombTimer: 10000 });
      const board = [bombCard, createTestCard('card-2'), createTestCard('card-3'),
                     createTestCard('card-4'), createTestCard('card-5'), createTestCard('card-6'),
                     createTestCard('card-7')];

      // Initialize bomb tracking
      enemy.onTick(1000, board);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showBombCards).toBeDefined();
      expect(modifiers.showBombCards?.length).toBe(1);
      expect(modifiers.showBombCards?.[0].cardId).toBe('bomb-card');
    });
  });

  describe('defeat condition', () => {
    it('returns false when bombsDefused < 1', () => {
      const enemy = createTrapWeaver();
      const stats = createRoundStats({ bombsDefused: 0 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when bombsDefused = 1', () => {
      const enemy = createTrapWeaver();
      const stats = createRoundStats({ bombsDefused: 1 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when bombsDefused > 1', () => {
      const enemy = createTrapWeaver();
      const stats = createRoundStats({ bombsDefused: 2 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  describe('lifecycle hooks', () => {
    it('onRoundStart spawns bomb on valid board', () => {
      const enemy = createTrapWeaver();
      const board = [createTestCard('card-1'), createTestCard('card-2'), createTestCard('card-3')];
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications.length).toBe(1);
      expect(result.events).toEqual([]);
    });

    it('onValidMatch returns neutral result', () => {
      const enemy = createTrapWeaver();
      const result = enemy.onValidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.timeDelta).toBe(0);
    });

    it('onInvalidMatch returns neutral result', () => {
      const enemy = createTrapWeaver();
      const result = enemy.onInvalidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.cardsToRemove).toEqual([]);
    });
  });
});
