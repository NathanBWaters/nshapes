/**
 * Unit tests for Ticking Viper enemy.
 */
import type { Card } from '@/types';
import type { RoundStats } from '@/types/enemy';
import { createTickingViper } from '@/utils/enemies/tier1/tickingViper';

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

// Mock Math.random for deterministic tests
const mockRandom = (value: number) => {
  jest.spyOn(Math, 'random').mockReturnValue(value);
};

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Ticking Viper', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createTickingViper();
      expect(enemy.name).toBe('Ticking Viper');
    });

    it('has correct tier', () => {
      const enemy = createTickingViper();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon', () => {
      const enemy = createTickingViper();
      expect(enemy.icon).toBe('lorc/snake');
    });

    it('has correct description', () => {
      const enemy = createTickingViper();
      expect(enemy.description).toContain('15s');
      expect(enemy.description).toContain('countdown');
    });

    it('has correct defeat condition text', () => {
      const enemy = createTickingViper();
      expect(enemy.defeatConditionText).toContain('countdown card');
    });
  });

  describe('countdown effect', () => {
    it('onRoundStart places countdown on one card', () => {
      mockRandom(0); // Select first card
      const enemy = createTickingViper();
      const cards = [
        createTestCard('card-1'),
        createTestCard('card-2'),
        createTestCard('card-3'),
      ];

      const result = enemy.onRoundStart(cards);

      expect(result.cardModifications.length).toBe(1);
      expect(result.cardModifications[0].cardId).toBe('card-1');
      expect(result.cardModifications[0].changes.hasCountdown).toBe(true);
      expect(result.cardModifications[0].changes.countdownTimer).toBe(15000);
    });

    it('skips dud cards when placing countdown', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = [
        createTestCard('dud-card', { isDud: true }),
        createTestCard('normal-card'),
      ];

      const result = enemy.onRoundStart(cards);

      expect(result.cardModifications[0].cardId).toBe('normal-card');
    });

    it('countdown timer decrements on tick', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = [createTestCard('card-1')];

      // Initialize countdown
      enemy.onRoundStart(cards);

      // Simulate 5 seconds
      const result = enemy.onTick(5000, cards);

      const modification = result.cardModifications.find(m => m.cardId === 'card-1');
      expect(modification).toBeDefined();
      expect(modification?.changes.countdownTimer).toBe(10000);
    });

    it('emits warning at 5 seconds remaining', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = [createTestCard('card-1')];

      enemy.onRoundStart(cards);

      // Skip to ~5 seconds remaining
      enemy.onTick(9500, cards);

      // Tick through the 5-second threshold
      const result = enemy.onTick(500, cards);

      const warning = result.events.find(e => e.type === 'countdown_warning');
      expect(warning).toBeDefined();
    });

    it('deals damage when countdown expires', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const card1 = createTestCard('card-1');
      const card2 = createTestCard('card-2');
      const cards = [card1, card2];

      enemy.onRoundStart(cards);

      // Expire the countdown
      const result = enemy.onTick(16000, cards);

      expect(result.healthDelta).toBe(-1);
      expect(result.events.some(e => e.type === 'countdown_expired')).toBe(true);
    });

    it('picks new card after countdown expires', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const card1 = createTestCard('card-1');
      const card2 = createTestCard('card-2');
      const cards = [card1, card2];

      enemy.onRoundStart(cards);

      // Expire the countdown
      const result = enemy.onTick(16000, cards);

      // Should have modifications to remove countdown from card-1 and add to card-2
      expect(result.cardModifications.length).toBeGreaterThan(1);
    });

    it('picks new card when countdown card is matched (removed from board)', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const card1 = createTestCard('card-1');
      const card2 = createTestCard('card-2');
      const cards = [card1, card2];

      enemy.onRoundStart(cards);

      // Simulate card-1 being removed (matched)
      const remainingCards = [card2];
      const result = enemy.onTick(1000, remainingCards);

      // Should place countdown on card-2
      const modification = result.cardModifications.find(m => m.cardId === 'card-2');
      expect(modification?.changes.hasCountdown).toBe(true);
    });

    it('getUIModifiers shows countdown cards', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = [createTestCard('card-1')];

      enemy.onRoundStart(cards);
      enemy.onTick(5000, cards); // Advance timer a bit

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showCountdownCards).toBeDefined();
      expect(modifiers.showCountdownCards?.length).toBe(1);
      expect(modifiers.showCountdownCards?.[0].cardId).toBe('card-1');
      expect(modifiers.showCountdownCards?.[0].timeRemaining).toBe(10000);
    });
  });

  describe('defeat condition', () => {
    it('returns false when countdownCardsMatched < 1', () => {
      const enemy = createTickingViper();
      const stats = createRoundStats({ countdownCardsMatched: 0 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when countdownCardsMatched = 1', () => {
      const enemy = createTickingViper();
      const stats = createRoundStats({ countdownCardsMatched: 1 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when countdownCardsMatched > 1', () => {
      const enemy = createTickingViper();
      const stats = createRoundStats({ countdownCardsMatched: 3 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  describe('lifecycle hooks', () => {
    it('onCardDraw returns unmodified card', () => {
      const enemy = createTickingViper();
      const card = createTestCard();
      const result = enemy.onCardDraw(card);
      expect(result).toEqual(card);
    });

    it('onValidMatch returns neutral result', () => {
      const enemy = createTickingViper();
      const result = enemy.onValidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.timeDelta).toBe(0);
    });

    it('onInvalidMatch returns neutral result', () => {
      const enemy = createTickingViper();
      const result = enemy.onInvalidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
      expect(result.cardsToRemove).toEqual([]);
    });
  });
});
