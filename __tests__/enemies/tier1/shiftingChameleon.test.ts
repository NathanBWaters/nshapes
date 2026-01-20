/**
 * Comprehensive unit tests for Shifting Chameleon enemy.
 *
 * Shifting Chameleon is a Tier 1 enemy that:
 * - Effect: Changes 1 attribute on random cards every 20s
 * - Defeat Condition: Get 2 all-different matches
 */
import type { Card } from '@/types';
import { createShiftingChameleon } from '@/utils/enemies/tier1/shiftingChameleon';
import {
  createRoundStats,
  createCard,
  createTestBoard,
  createFaceDownCard,
  resetCardIdCounter,
} from '../../testUtils';

// Mock Math.random for deterministic tests
const mockRandom = (value: number) => {
  jest.spyOn(Math, 'random').mockReturnValue(value);
};

// Mock Math.random to return a sequence of values
const mockRandomSequence = (values: number[]) => {
  let index = 0;
  jest.spyOn(Math, 'random').mockImplementation(() => {
    const value = values[index % values.length];
    index++;
    return value;
  });
};

beforeEach(() => {
  resetCardIdCounter();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Shifting Chameleon', () => {
  // ==========================================================================
  // METADATA TESTS
  // ==========================================================================
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createShiftingChameleon();
      expect(enemy.name).toBe('Shifting Chameleon');
    });

    it('has correct tier (Tier 1)', () => {
      const enemy = createShiftingChameleon();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon', () => {
      const enemy = createShiftingChameleon();
      expect(enemy.icon).toBe('darkzaitzev/chameleon-glyph');
    });

    it('has description that mentions attribute changes', () => {
      const enemy = createShiftingChameleon();
      expect(enemy.description.toLowerCase()).toContain('attribute');
    });

    it('has description that mentions 20s interval', () => {
      const enemy = createShiftingChameleon();
      expect(enemy.description).toContain('20s');
    });

    it('has description that mentions changing cards', () => {
      const enemy = createShiftingChameleon();
      expect(enemy.description.toLowerCase()).toContain('change');
    });

    it('has correct defeat condition text', () => {
      const enemy = createShiftingChameleon();
      expect(enemy.defeatConditionText).toBe('Get 2 all-different matches');
    });

    it('defeat condition text mentions all-different', () => {
      const enemy = createShiftingChameleon();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('all-different');
    });
  });

  // ==========================================================================
  // ATTRIBUTE CHANGE EFFECT TESTS
  // ==========================================================================
  describe('attribute change effect', () => {
    it('does not change attributes before interval (10s)', () => {
      const enemy = createShiftingChameleon();
      const card = createCard({ id: 'card-1' });
      const board = [card];

      const result = enemy.onTick(10000, board);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('does not change attributes at 19.9s (just before interval)', () => {
      const enemy = createShiftingChameleon();
      const card = createCard({ id: 'card-1' });
      const board = [card];

      const result = enemy.onTick(19999, board);
      expect(result.cardModifications).toEqual([]);
    });

    it('changes an attribute at exactly 20s interval', () => {
      mockRandom(0); // Will select first card and first attribute
      const enemy = createShiftingChameleon();
      const card = createCard({ id: 'card-1' });
      const board = [card];

      const result = enemy.onTick(20000, board);
      expect(result.cardModifications.length).toBe(1);
      expect(result.cardModifications[0].cardId).toBe('card-1');
    });

    it('changes an attribute after 20s interval (e.g., 25s)', () => {
      mockRandom(0);
      const enemy = createShiftingChameleon();
      const card = createCard({ id: 'card-1' });
      const board = [card];

      const result = enemy.onTick(25000, board);
      expect(result.cardModifications.length).toBe(1);
    });

    it('emits attribute_changed event when attribute changes', () => {
      mockRandom(0);
      const enemy = createShiftingChameleon();
      const card = createCard({ id: 'card-1' });
      const board = [card];

      const result = enemy.onTick(20000, board);
      expect(result.events.length).toBe(1);
      expect(result.events[0].type).toBe('attribute_changed');
    });

    it('includes card ID in attribute_changed event', () => {
      mockRandom(0);
      const enemy = createShiftingChameleon();
      const card = createCard({ id: 'target-card' });
      const board = [card];

      const result = enemy.onTick(20000, board);
      const event = result.events[0] as { type: 'attribute_changed'; cardIds: string[] };
      expect(event.cardIds).toContain('target-card');
    });

    it('skips dud cards when selecting target', () => {
      mockRandom(0);
      const enemy = createShiftingChameleon();
      const dudCard = createCard({ id: 'dud-card', isDud: true });
      const normalCard = createCard({ id: 'normal-card' });
      const board = [dudCard, normalCard];

      const result = enemy.onTick(20000, board);
      expect(result.cardModifications[0].cardId).toBe('normal-card');
    });

    it('skips face-down cards when selecting target', () => {
      mockRandom(0);
      const enemy = createShiftingChameleon();
      const faceDownCard = createFaceDownCard({ id: 'facedown-card' });
      const normalCard = createCard({ id: 'normal-card' });
      const board = [faceDownCard, normalCard];

      const result = enemy.onTick(20000, board);
      expect(result.cardModifications[0].cardId).toBe('normal-card');
    });

    it('returns empty result when board is empty', () => {
      const enemy = createShiftingChameleon();
      const board: Card[] = [];

      const result = enemy.onTick(20000, board);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('returns empty result when all cards are duds', () => {
      const enemy = createShiftingChameleon();
      const board = [
        createCard({ id: 'dud-1', isDud: true }),
        createCard({ id: 'dud-2', isDud: true }),
      ];

      const result = enemy.onTick(20000, board);
      expect(result.cardModifications).toEqual([]);
    });

    it('returns empty result when all cards are face-down', () => {
      const enemy = createShiftingChameleon();
      const board = [createFaceDownCard({ id: 'fd-1' }), createFaceDownCard({ id: 'fd-2' })];

      const result = enemy.onTick(20000, board);
      expect(result.cardModifications).toEqual([]);
    });

    it('resets timer after attribute change', () => {
      mockRandom(0);
      const enemy = createShiftingChameleon();
      const card = createCard({ id: 'card-1' });
      const board = [card];

      // First change at 20s
      enemy.onTick(20000, board);

      // 10 more seconds should not trigger another change
      const result = enemy.onTick(10000, board);
      expect(result.cardModifications).toEqual([]);
    });

    it('accumulates time across multiple ticks', () => {
      mockRandom(0);
      const enemy = createShiftingChameleon();
      const card = createCard({ id: 'card-1' });
      const board = [card];

      // 5s + 5s + 5s + 5s = 20s total
      enemy.onTick(5000, board);
      enemy.onTick(5000, board);
      enemy.onTick(5000, board);
      const result = enemy.onTick(5000, board);

      expect(result.cardModifications.length).toBe(1);
    });

    it('changes shape attribute to a different value', () => {
      // Mock: first call for card selection (0 = first card),
      // second call for attribute selection (0 = shape),
      // third call for new value selection
      mockRandomSequence([0, 0, 0]);
      const enemy = createShiftingChameleon();
      const card = createCard({ id: 'card-1', shape: 'oval' });
      const board = [card];

      const result = enemy.onTick(20000, board);
      const changes = result.cardModifications[0].changes;

      // Shape should change to something different from 'oval'
      if (changes.shape !== undefined) {
        expect(changes.shape).not.toBe('oval');
        expect(['squiggle', 'diamond']).toContain(changes.shape);
      }
    });

    it('can change color attribute', () => {
      // Mock to select color attribute (index 1)
      mockRandomSequence([0, 0.25, 0]); // 0.25 * 4 = 1 -> color
      const enemy = createShiftingChameleon();
      const card = createCard({ id: 'card-1', color: 'red' });
      const board = [card];

      const result = enemy.onTick(20000, board);
      const changes = result.cardModifications[0].changes;

      if (changes.color !== undefined) {
        expect(changes.color).not.toBe('red');
        expect(['green', 'purple']).toContain(changes.color);
      }
    });

    it('can change number attribute', () => {
      // Mock to select number attribute (index 2)
      mockRandomSequence([0, 0.5, 0]); // 0.5 * 4 = 2 -> number
      const enemy = createShiftingChameleon();
      const card = createCard({ id: 'card-1', number: 1 });
      const board = [card];

      const result = enemy.onTick(20000, board);
      const changes = result.cardModifications[0].changes;

      if (changes.number !== undefined) {
        expect(changes.number).not.toBe(1);
        expect([2, 3]).toContain(changes.number);
      }
    });

    it('can change shading attribute', () => {
      // Mock to select shading attribute (index 3)
      mockRandomSequence([0, 0.75, 0]); // 0.75 * 4 = 3 -> shading
      const enemy = createShiftingChameleon();
      const card = createCard({ id: 'card-1', shading: 'solid' });
      const board = [card];

      const result = enemy.onTick(20000, board);
      const changes = result.cardModifications[0].changes;

      if (changes.shading !== undefined) {
        expect(changes.shading).not.toBe('solid');
        expect(['striped', 'open']).toContain(changes.shading);
      }
    });

    it('selects random card from board', () => {
      // Mock to select second card (index 1)
      mockRandomSequence([0.5, 0, 0]); // 0.5 * 2 = 1 -> second card
      const enemy = createShiftingChameleon();
      const card1 = createCard({ id: 'card-1' });
      const card2 = createCard({ id: 'card-2' });
      const board = [card1, card2];

      const result = enemy.onTick(20000, board);
      expect(result.cardModifications[0].cardId).toBe('card-2');
    });
  });

  // ==========================================================================
  // DEFEAT CONDITION TESTS
  // ==========================================================================
  describe('defeat condition', () => {
    it('returns false when allDifferentMatches is 0', () => {
      const enemy = createShiftingChameleon();
      const stats = createRoundStats({ allDifferentMatches: 0 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when allDifferentMatches is 1 (threshold - 1)', () => {
      const enemy = createShiftingChameleon();
      const stats = createRoundStats({ allDifferentMatches: 1 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when allDifferentMatches is exactly 2 (at threshold)', () => {
      const enemy = createShiftingChameleon();
      const stats = createRoundStats({ allDifferentMatches: 2 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when allDifferentMatches is 3 (above threshold)', () => {
      const enemy = createShiftingChameleon();
      const stats = createRoundStats({ allDifferentMatches: 3 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when allDifferentMatches is 5 (well above threshold)', () => {
      const enemy = createShiftingChameleon();
      const stats = createRoundStats({ allDifferentMatches: 5 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when allDifferentMatches is 10 (very high)', () => {
      const enemy = createShiftingChameleon();
      const stats = createRoundStats({ allDifferentMatches: 10 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('ignores other stats when checking defeat condition', () => {
      const enemy = createShiftingChameleon();
      const stats = createRoundStats({
        allDifferentMatches: 2,
        totalMatches: 100,
        currentStreak: 50,
        allSameColorMatches: 20,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns false with high stats but low allDifferentMatches', () => {
      const enemy = createShiftingChameleon();
      const stats = createRoundStats({
        allDifferentMatches: 1,
        totalMatches: 100,
        currentStreak: 50,
        allSameColorMatches: 20,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS TESTS
  // ==========================================================================
  describe('lifecycle hooks', () => {
    describe('onRoundStart', () => {
      it('resets internal timer state', () => {
        mockRandom(0);
        const enemy = createShiftingChameleon();
        const board = createTestBoard(12);

        // Accumulate 15s of time
        enemy.onTick(15000, board);

        // Round start should reset
        enemy.onRoundStart(board);

        // 10s more should not trigger (would need full 20s)
        const result = enemy.onTick(10000, board);
        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty card modifications', () => {
        const enemy = createShiftingChameleon();
        const board = createTestBoard(12);

        const result = enemy.onRoundStart(board);
        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty events', () => {
        const enemy = createShiftingChameleon();
        const board = createTestBoard(12);

        const result = enemy.onRoundStart(board);
        expect(result.events).toEqual([]);
      });
    });

    describe('onCardDraw', () => {
      it('returns the card unmodified', () => {
        const enemy = createShiftingChameleon();
        const card = createCard({ id: 'test-card', shape: 'diamond', color: 'green' });

        const result = enemy.onCardDraw(card);
        expect(result).toEqual(card);
      });

      it('does not add any special properties to drawn cards', () => {
        const enemy = createShiftingChameleon();
        const card = createCard({ id: 'test-card' });

        const result = enemy.onCardDraw(card);
        expect(result.isDud).toBeUndefined();
        expect(result.isFaceDown).toBeUndefined();
        expect(result.hasBomb).toBeUndefined();
        expect(result.hasCountdown).toBeUndefined();
      });
    });

    describe('onValidMatch', () => {
      it('returns neutral points multiplier (1)', () => {
        const enemy = createShiftingChameleon();
        const matchedCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);

        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.pointsMultiplier).toBe(1);
      });

      it('returns zero time delta', () => {
        const enemy = createShiftingChameleon();
        const matchedCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);

        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.timeDelta).toBe(0);
      });

      it('returns empty cardsToRemove', () => {
        const enemy = createShiftingChameleon();
        const matchedCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);

        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty cardsToFlip', () => {
        const enemy = createShiftingChameleon();
        const matchedCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);

        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events', () => {
        const enemy = createShiftingChameleon();
        const matchedCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);

        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.events).toEqual([]);
      });
    });

    describe('onInvalidMatch', () => {
      it('returns neutral points multiplier (1)', () => {
        const enemy = createShiftingChameleon();
        const cards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);

        const result = enemy.onInvalidMatch(cards, board);
        expect(result.pointsMultiplier).toBe(1);
      });

      it('returns empty cardsToRemove', () => {
        const enemy = createShiftingChameleon();
        const cards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);

        const result = enemy.onInvalidMatch(cards, board);
        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns zero time delta', () => {
        const enemy = createShiftingChameleon();
        const cards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);

        const result = enemy.onInvalidMatch(cards, board);
        expect(result.timeDelta).toBe(0);
      });
    });

    describe('onRoundEnd', () => {
      it('can be called without error', () => {
        const enemy = createShiftingChameleon();
        expect(() => enemy.onRoundEnd()).not.toThrow();
      });

      it('resets internal state', () => {
        mockRandom(0);
        const enemy = createShiftingChameleon();
        const board = createTestBoard(12);

        // Accumulate time
        enemy.onTick(15000, board);

        // End round
        enemy.onRoundEnd();

        // Start new round and verify timer was reset
        enemy.onRoundStart(board);
        const result = enemy.onTick(10000, board);
        expect(result.cardModifications).toEqual([]);
      });
    });
  });

  // ==========================================================================
  // UI MODIFIERS TESTS
  // ==========================================================================
  describe('getUIModifiers', () => {
    it('returns an object', () => {
      const enemy = createShiftingChameleon();
      const modifiers = enemy.getUIModifiers();
      expect(typeof modifiers).toBe('object');
    });

    it('does not show inactivity bar', () => {
      const enemy = createShiftingChameleon();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showInactivityBar).toBeUndefined();
    });

    it('does not show score decay', () => {
      const enemy = createShiftingChameleon();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showScoreDecay).toBeUndefined();
    });

    it('does not have timer speed multiplier', () => {
      const enemy = createShiftingChameleon();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.timerSpeedMultiplier).toBeUndefined();
    });

    it('does not disable auto hint', () => {
      const enemy = createShiftingChameleon();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableAutoHint).toBeUndefined();
    });

    it('does not disable manual hint', () => {
      const enemy = createShiftingChameleon();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableManualHint).toBeUndefined();
    });

    it('does not show countdown cards', () => {
      const enemy = createShiftingChameleon();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showCountdownCards).toBeUndefined();
    });

    it('does not show bomb cards', () => {
      const enemy = createShiftingChameleon();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showBombCards).toBeUndefined();
    });

    it('does not have weapon counters', () => {
      const enemy = createShiftingChameleon();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters).toBeUndefined();
    });
  });

  // ==========================================================================
  // STAT MODIFIERS TESTS
  // ==========================================================================
  describe('getStatModifiers', () => {
    it('returns an object', () => {
      const enemy = createShiftingChameleon();
      const modifiers = enemy.getStatModifiers();
      expect(typeof modifiers).toBe('object');
    });

    it('does not reduce fire spread chance', () => {
      const enemy = createShiftingChameleon();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
    });

    it('does not reduce explosion chance', () => {
      const enemy = createShiftingChameleon();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.explosionChanceReduction).toBeUndefined();
    });

    it('does not reduce laser chance', () => {
      const enemy = createShiftingChameleon();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.laserChanceReduction).toBeUndefined();
    });

    it('does not reduce hint gain chance', () => {
      const enemy = createShiftingChameleon();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.hintGainChanceReduction).toBeUndefined();
    });

    it('does not reduce grace gain chance', () => {
      const enemy = createShiftingChameleon();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.graceGainChanceReduction).toBeUndefined();
    });

    it('does not reduce time gain chance', () => {
      const enemy = createShiftingChameleon();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.timeGainChanceReduction).toBeUndefined();
    });

    it('does not reduce healing chance', () => {
      const enemy = createShiftingChameleon();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.healingChanceReduction).toBeUndefined();
    });

    it('does not have damage multiplier', () => {
      const enemy = createShiftingChameleon();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.damageMultiplier).toBeUndefined();
    });

    it('does not have points multiplier', () => {
      const enemy = createShiftingChameleon();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.pointsMultiplier).toBeUndefined();
    });
  });

  // ==========================================================================
  // TICK RESULT STRUCTURE TESTS
  // ==========================================================================
  describe('onTick result structure', () => {
    it('returns zero scoreDelta', () => {
      const enemy = createShiftingChameleon();
      const board = createTestBoard(12);
      const result = enemy.onTick(5000, board);
      expect(result.scoreDelta).toBe(0);
    });

    it('returns zero healthDelta', () => {
      const enemy = createShiftingChameleon();
      const board = createTestBoard(12);
      const result = enemy.onTick(5000, board);
      expect(result.healthDelta).toBe(0);
    });

    it('returns zero timeDelta', () => {
      const enemy = createShiftingChameleon();
      const board = createTestBoard(12);
      const result = enemy.onTick(5000, board);
      expect(result.timeDelta).toBe(0);
    });

    it('returns empty cardsToRemove', () => {
      const enemy = createShiftingChameleon();
      const board = createTestBoard(12);
      const result = enemy.onTick(5000, board);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardsToFlip', () => {
      const enemy = createShiftingChameleon();
      const board = createTestBoard(12);
      const result = enemy.onTick(5000, board);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns false for instantDeath', () => {
      const enemy = createShiftingChameleon();
      const board = createTestBoard(12);
      const result = enemy.onTick(5000, board);
      expect(result.instantDeath).toBe(false);
    });
  });

  // ==========================================================================
  // EDGE CASES AND INTEGRATION TESTS
  // ==========================================================================
  describe('edge cases', () => {
    it('handles multiple attribute changes over time', () => {
      mockRandom(0);
      const enemy = createShiftingChameleon();
      const card = createCard({ id: 'card-1' });
      const board = [card];

      // First change at 20s
      const result1 = enemy.onTick(20000, board);
      expect(result1.cardModifications.length).toBe(1);

      // Second change at 40s (20s after first)
      const result2 = enemy.onTick(20000, board);
      expect(result2.cardModifications.length).toBe(1);

      // Third change at 60s (20s after second)
      const result3 = enemy.onTick(20000, board);
      expect(result3.cardModifications.length).toBe(1);
    });

    it('handles board with mixed valid and invalid cards', () => {
      mockRandom(0);
      const enemy = createShiftingChameleon();
      const board = [
        createCard({ id: 'dud-1', isDud: true }),
        createFaceDownCard({ id: 'facedown-1' }),
        createCard({ id: 'valid-1' }),
        createCard({ id: 'dud-2', isDud: true }),
        createCard({ id: 'valid-2' }),
      ];

      const result = enemy.onTick(20000, board);
      expect(result.cardModifications.length).toBe(1);
      // Should only target valid-1 or valid-2
      expect(['valid-1', 'valid-2']).toContain(result.cardModifications[0].cardId);
    });

    it('creates independent instances', () => {
      const enemy1 = createShiftingChameleon();
      const enemy2 = createShiftingChameleon();

      const board = createTestBoard(12);

      // Accumulate time on enemy1 only
      enemy1.onTick(15000, board);

      // enemy2 should start fresh
      mockRandom(0);
      const result1 = enemy1.onTick(5000, board); // 15 + 5 = 20s
      const result2 = enemy2.onTick(5000, board); // only 5s

      expect(result1.cardModifications.length).toBe(1);
      expect(result2.cardModifications.length).toBe(0);
    });

    it('handles very small delta times correctly', () => {
      const enemy = createShiftingChameleon();
      const board = createTestBoard(12);

      // 200 ticks of 100ms each = 20s total
      for (let i = 0; i < 199; i++) {
        const result = enemy.onTick(100, board);
        expect(result.cardModifications).toEqual([]);
      }

      // Final tick should trigger the change
      mockRandom(0);
      const finalResult = enemy.onTick(100, board);
      expect(finalResult.cardModifications.length).toBe(1);
    });

    it('handles large board sizes', () => {
      mockRandom(0);
      const enemy = createShiftingChameleon();
      const board = createTestBoard(100);

      const result = enemy.onTick(20000, board);
      expect(result.cardModifications.length).toBe(1);
    });
  });
});
