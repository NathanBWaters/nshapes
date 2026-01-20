/**
 * Comprehensive Unit Tests for Ticking Viper Enemy
 *
 * Ticking Viper - Tier 1 Enemy
 * Effect: One card has 15s countdown timer; match or lose 1HP
 * Defeat Condition: Match the countdown card in time
 */
import type { Card } from '@/types';
import { createTickingViper } from '@/utils/enemies/tier1/tickingViper';
import {
  createRoundStats,
  createCard,
  createTestBoard,
  resetCardIdCounter,
} from '../../testUtils';

// Mock Math.random for deterministic tests
const mockRandom = (value: number) => {
  jest.spyOn(Math, 'random').mockReturnValue(value);
};

// Helper to create multiple random values in sequence
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

// ============================================================================
// METADATA TESTS
// ============================================================================

describe('Ticking Viper', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createTickingViper();
      expect(enemy.name).toBe('Ticking Viper');
    });

    it('has correct tier (1)', () => {
      const enemy = createTickingViper();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon (lorc/snake)', () => {
      const enemy = createTickingViper();
      expect(enemy.icon).toBe('lorc/snake');
    });

    it('description contains "15s"', () => {
      const enemy = createTickingViper();
      expect(enemy.description).toContain('15s');
    });

    it('description contains "countdown"', () => {
      const enemy = createTickingViper();
      expect(enemy.description).toContain('countdown');
    });

    it('description contains "1HP"', () => {
      const enemy = createTickingViper();
      expect(enemy.description).toContain('1HP');
    });

    it('description mentions match or lose mechanic', () => {
      const enemy = createTickingViper();
      expect(enemy.description.toLowerCase()).toMatch(/match|lose/);
    });

    it('defeatConditionText contains "countdown card"', () => {
      const enemy = createTickingViper();
      expect(enemy.defeatConditionText).toContain('countdown card');
    });

    it('defeatConditionText mentions "in time"', () => {
      const enemy = createTickingViper();
      expect(enemy.defeatConditionText).toContain('in time');
    });

    it('defeatConditionText mentions "match"', () => {
      const enemy = createTickingViper();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('match');
    });
  });

  // ============================================================================
  // COUNTDOWN EFFECT - onRoundStart TESTS
  // ============================================================================

  describe('countdown effect - onRoundStart', () => {
    it('places countdown on one card', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      const result = enemy.onRoundStart(cards);

      expect(result.cardModifications.length).toBe(1);
    });

    it('selects first card when Math.random returns 0', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      const result = enemy.onRoundStart(cards);

      expect(result.cardModifications[0].cardId).toBe(cards[0].id);
    });

    it('selects last card when Math.random returns 0.99', () => {
      mockRandom(0.99);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      const result = enemy.onRoundStart(cards);

      expect(result.cardModifications[0].cardId).toBe(cards[2].id);
    });

    it('selects middle card when Math.random returns 0.5', () => {
      mockRandom(0.5);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      const result = enemy.onRoundStart(cards);

      expect(result.cardModifications[0].cardId).toBe(cards[1].id);
    });

    it('sets hasCountdown to true on selected card', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      const result = enemy.onRoundStart(cards);

      expect(result.cardModifications[0].changes.hasCountdown).toBe(true);
    });

    it('sets countdownTimer to 15000ms', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      const result = enemy.onRoundStart(cards);

      expect(result.cardModifications[0].changes.countdownTimer).toBe(15000);
    });

    it('skips dud cards when placing countdown', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = [
        createCard({ isDud: true }),
        createCard({ isDud: true }),
        createCard(), // This should be selected
      ];

      const result = enemy.onRoundStart(cards);

      expect(result.cardModifications[0].cardId).toBe(cards[2].id);
    });

    it('skips face-down cards when placing countdown', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = [
        createCard({ isFaceDown: true }),
        createCard({ isFaceDown: true }),
        createCard(), // This should be selected
      ];

      const result = enemy.onRoundStart(cards);

      expect(result.cardModifications[0].cardId).toBe(cards[2].id);
    });

    it('returns empty modifications if all cards are duds', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = [
        createCard({ isDud: true }),
        createCard({ isDud: true }),
        createCard({ isDud: true }),
      ];

      const result = enemy.onRoundStart(cards);

      expect(result.cardModifications).toEqual([]);
    });

    it('returns empty modifications if all cards are face-down', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = [
        createCard({ isFaceDown: true }),
        createCard({ isFaceDown: true }),
        createCard({ isFaceDown: true }),
      ];

      const result = enemy.onRoundStart(cards);

      expect(result.cardModifications).toEqual([]);
    });

    it('returns empty modifications if board is empty', () => {
      const enemy = createTickingViper();
      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
    });

    it('returns empty events array on round start', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      const result = enemy.onRoundStart(cards);

      expect(result.events).toEqual([]);
    });

    it('works with single card board', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = [createCard()];

      const result = enemy.onRoundStart(cards);

      expect(result.cardModifications.length).toBe(1);
      expect(result.cardModifications[0].cardId).toBe(cards[0].id);
    });

    it('works with large board (12 cards)', () => {
      mockRandom(0.5);
      const enemy = createTickingViper();
      const cards = createTestBoard(12);

      const result = enemy.onRoundStart(cards);

      expect(result.cardModifications.length).toBe(1);
      expect(result.cardModifications[0].changes.hasCountdown).toBe(true);
    });

    it('selects only valid cards in mixed board', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = [
        createCard({ isDud: true }),
        createCard({ isFaceDown: true }),
        createCard(), // valid
        createCard({ isDud: true }),
        createCard(), // valid
      ];

      const result = enemy.onRoundStart(cards);

      // With Math.random(0), should select first valid card (index 2)
      expect(result.cardModifications[0].cardId).toBe(cards[2].id);
    });
  });

  // ============================================================================
  // COUNTDOWN EFFECT - onTick TESTS
  // ============================================================================

  describe('countdown effect - onTick', () => {
    it('decrements timer on each tick', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      const result = enemy.onTick(1000, cards);

      const modification = result.cardModifications.find(
        (m) => m.cardId === cards[0].id
      );
      expect(modification?.changes.countdownTimer).toBe(14000);
    });

    it('decrements by exact delta amount', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      const result = enemy.onTick(5000, cards);

      const modification = result.cardModifications.find(
        (m) => m.cardId === cards[0].id
      );
      expect(modification?.changes.countdownTimer).toBe(10000);
    });

    it('accumulates decrements across multiple ticks', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      enemy.onTick(3000, cards);
      enemy.onTick(4000, cards);
      const result = enemy.onTick(2000, cards);

      const modification = result.cardModifications.find(
        (m) => m.cardId === cards[0].id
      );
      expect(modification?.changes.countdownTimer).toBe(6000);
    });

    it('handles small delta (100ms tick)', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      const result = enemy.onTick(100, cards);

      const modification = result.cardModifications.find(
        (m) => m.cardId === cards[0].id
      );
      expect(modification?.changes.countdownTimer).toBe(14900);
    });

    it('timer never goes below 0', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      const result = enemy.onTick(20000, cards);

      // Find the modification for the original countdown card
      const modification = result.cardModifications.find(
        (m) => m.changes.countdownTimer !== undefined
      );
      expect(modification?.changes.countdownTimer).toBeGreaterThanOrEqual(0);
    });

    it('emits countdown_warning event at 5 seconds remaining', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      // Tick to ~5 seconds remaining (15000 - 9500 = 5500ms)
      enemy.onTick(9500, cards);
      // Tick through the threshold (5500 - 500 = 5000ms = 5.0 seconds)
      const result = enemy.onTick(500, cards);

      const warning = result.events.find((e) => e.type === 'countdown_warning');
      expect(warning).toBeDefined();
    });

    it('warning event includes cardId', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      enemy.onTick(9500, cards);
      const result = enemy.onTick(500, cards);

      const warning = result.events.find(
        (e) => e.type === 'countdown_warning'
      ) as { type: 'countdown_warning'; cardId: string; secondsRemaining: number };
      expect(warning?.cardId).toBe(cards[0].id);
    });

    it('warning event includes secondsRemaining', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      enemy.onTick(9500, cards);
      const result = enemy.onTick(500, cards);

      const warning = result.events.find(
        (e) => e.type === 'countdown_warning'
      ) as { type: 'countdown_warning'; cardId: string; secondsRemaining: number };
      expect(warning?.secondsRemaining).toBe(5);
    });

    it('does not emit warning before 5 seconds remaining', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      const result = enemy.onTick(5000, cards); // 10 seconds remaining

      const warning = result.events.find((e) => e.type === 'countdown_warning');
      expect(warning).toBeUndefined();
    });

    it('does not emit warning after 4 seconds remaining', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      // Tick past the warning window
      enemy.onTick(11500, cards); // 3.5 seconds remaining
      const result = enemy.onTick(100, cards);

      const warning = result.events.find((e) => e.type === 'countdown_warning');
      expect(warning).toBeUndefined();
    });

    it('deals 1 damage when countdown expires', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      const result = enemy.onTick(16000, cards);

      expect(result.healthDelta).toBe(-1);
    });

    it('emits countdown_expired event when timer reaches 0', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      const result = enemy.onTick(16000, cards);

      const expired = result.events.find((e) => e.type === 'countdown_expired');
      expect(expired).toBeDefined();
    });

    it('expired event includes cardId', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      const result = enemy.onTick(16000, cards);

      const expired = result.events.find(
        (e) => e.type === 'countdown_expired'
      ) as { type: 'countdown_expired'; cardId: string };
      expect(expired?.cardId).toBe(cards[0].id);
    });

    it('removes countdown from old card after expiry', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      const result = enemy.onTick(16000, cards);

      const oldCardMod = result.cardModifications.find(
        (m) => m.cardId === cards[0].id && m.changes.hasCountdown === false
      );
      expect(oldCardMod).toBeDefined();
    });

    it('picks new card after countdown expires', () => {
      mockRandomSequence([0, 0.5]); // First for initial, second for new selection
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      const result = enemy.onTick(16000, cards);

      const newCountdownMod = result.cardModifications.find(
        (m) => m.changes.hasCountdown === true && m.cardId !== cards[0].id
      );
      expect(newCountdownMod).toBeDefined();
    });

    it('new countdown card has 15000ms timer', () => {
      mockRandomSequence([0, 0.5]);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      const result = enemy.onTick(16000, cards);

      const newCountdownMod = result.cardModifications.find(
        (m) => m.changes.hasCountdown === true && m.cardId !== cards[0].id
      );
      expect(newCountdownMod?.changes.countdownTimer).toBe(15000);
    });

    it('picks new card when countdown card is removed from board', () => {
      mockRandomSequence([0, 0]); // First for initial, second for new selection
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);

      // Remove the countdown card from the board
      const remainingCards = cards.slice(1);
      const result = enemy.onTick(1000, remainingCards);

      const newCountdownMod = result.cardModifications.find(
        (m) => m.changes.hasCountdown === true
      );
      expect(newCountdownMod).toBeDefined();
      expect(newCountdownMod?.cardId).toBe(remainingCards[0].id);
    });

    it('resets timer to 15000ms when picking new card after match', () => {
      mockRandomSequence([0, 0]);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);

      const remainingCards = cards.slice(1);
      const result = enemy.onTick(1000, remainingCards);

      const newCountdownMod = result.cardModifications.find(
        (m) => m.changes.hasCountdown === true
      );
      expect(newCountdownMod?.changes.countdownTimer).toBe(15000);
    });

    it('clears countdown state if no valid cards remain', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = [createCard()];

      enemy.onRoundStart(cards);

      // Remove all cards
      const result = enemy.onTick(1000, []);

      expect(result.cardModifications).toEqual([]);
    });

    it('returns empty result if onTick called before onRoundStart', () => {
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      const result = enemy.onTick(1000, cards);

      expect(result.cardModifications).toEqual([]);
      expect(result.healthDelta).toBe(0);
    });

    it('handles exact 15000ms expiry', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      const result = enemy.onTick(15000, cards);

      expect(result.healthDelta).toBe(-1);
      const expired = result.events.find((e) => e.type === 'countdown_expired');
      expect(expired).toBeDefined();
    });

    it('does not damage player if timer has time remaining', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      const result = enemy.onTick(14999, cards);

      expect(result.healthDelta).toBe(0);
    });

    it('only damages once per expiry cycle', () => {
      mockRandomSequence([0, 0.5, 0.99]);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);

      // First expiry
      const result1 = enemy.onTick(16000, cards);
      expect(result1.healthDelta).toBe(-1);

      // Continue ticking - should not immediately damage again
      const result2 = enemy.onTick(1000, cards);
      expect(result2.healthDelta).toBe(0);
    });
  });

  // ============================================================================
  // COUNTDOWN EFFECT - Card Matching/Removal TESTS
  // ============================================================================

  describe('countdown effect - card matching', () => {
    it('detects when countdown card is matched and removed', () => {
      mockRandomSequence([0, 0]);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);

      // Simulate matching the countdown card (remove card 0)
      const remainingCards = cards.slice(1);
      const result = enemy.onTick(100, remainingCards);

      // Should place countdown on a new card
      const newCountdownMod = result.cardModifications.find(
        (m) => m.changes.hasCountdown === true
      );
      expect(newCountdownMod).toBeDefined();
    });

    it('does not pick dud cards when selecting new countdown target', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = [createCard(), createCard({ isDud: true }), createCard()];

      enemy.onRoundStart(cards);

      // Remove the countdown card
      const remainingCards = [cards[1], cards[2]]; // Dud and normal card
      const result = enemy.onTick(100, remainingCards);

      const newCountdownMod = result.cardModifications.find(
        (m) => m.changes.hasCountdown === true
      );
      expect(newCountdownMod?.cardId).toBe(cards[2].id);
    });

    it('does not pick face-down cards when selecting new countdown target', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = [createCard(), createCard({ isFaceDown: true }), createCard()];

      enemy.onRoundStart(cards);

      // Remove the countdown card
      const remainingCards = [cards[1], cards[2]]; // Face-down and normal
      const result = enemy.onTick(100, remainingCards);

      const newCountdownMod = result.cardModifications.find(
        (m) => m.changes.hasCountdown === true
      );
      expect(newCountdownMod?.cardId).toBe(cards[2].id);
    });

    it('excludes current countdown card when selecting new target after expiry', () => {
      mockRandomSequence([0, 0]);
      const enemy = createTickingViper();
      const cards = createTestBoard(2);

      enemy.onRoundStart(cards);
      const result = enemy.onTick(16000, cards);

      // The new countdown should be on the other card
      const newCountdownMod = result.cardModifications.find(
        (m) => m.changes.hasCountdown === true && m.cardId !== cards[0].id
      );
      expect(newCountdownMod?.cardId).toBe(cards[1].id);
    });
  });

  // ============================================================================
  // DEFEAT CONDITION TESTS
  // ============================================================================

  describe('defeat condition', () => {
    it('returns false when countdownCardsMatched is 0', () => {
      const enemy = createTickingViper();
      const stats = createRoundStats({ countdownCardsMatched: 0 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when countdownCardsMatched is exactly 1', () => {
      const enemy = createTickingViper();
      const stats = createRoundStats({ countdownCardsMatched: 1 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when countdownCardsMatched is 2', () => {
      const enemy = createTickingViper();
      const stats = createRoundStats({ countdownCardsMatched: 2 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when countdownCardsMatched is 3', () => {
      const enemy = createTickingViper();
      const stats = createRoundStats({ countdownCardsMatched: 3 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when countdownCardsMatched is 10', () => {
      const enemy = createTickingViper();
      const stats = createRoundStats({ countdownCardsMatched: 10 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when countdownCardsMatched is very large', () => {
      const enemy = createTickingViper();
      const stats = createRoundStats({ countdownCardsMatched: 999 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('ignores other stats when checking defeat condition', () => {
      const enemy = createTickingViper();
      const stats = createRoundStats({
        countdownCardsMatched: 1,
        totalMatches: 0,
        currentStreak: 0,
        damageReceived: 100,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('defeat condition threshold is 1 (not 0)', () => {
      const enemy = createTickingViper();
      const statsBelowThreshold = createRoundStats({ countdownCardsMatched: 0 });
      const statsAtThreshold = createRoundStats({ countdownCardsMatched: 1 });

      expect(enemy.checkDefeatCondition(statsBelowThreshold)).toBe(false);
      expect(enemy.checkDefeatCondition(statsAtThreshold)).toBe(true);
    });
  });

  // ============================================================================
  // LIFECYCLE HOOKS TESTS
  // ============================================================================

  describe('lifecycle hooks - onCardDraw', () => {
    it('returns card unchanged', () => {
      const enemy = createTickingViper();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result).toEqual(card);
    });

    it('preserves all card properties', () => {
      const enemy = createTickingViper();
      const card = createCard({
        shape: 'diamond',
        color: 'purple',
        number: 3,
        shading: 'striped',
      });
      const result = enemy.onCardDraw(card);
      expect(result.shape).toBe('diamond');
      expect(result.color).toBe('purple');
      expect(result.number).toBe(3);
      expect(result.shading).toBe('striped');
    });

    it('preserves card id', () => {
      const enemy = createTickingViper();
      const card = createCard({ id: 'specific-id' });
      const result = enemy.onCardDraw(card);
      expect(result.id).toBe('specific-id');
    });

    it('does not modify existing countdown state', () => {
      const enemy = createTickingViper();
      const card = createCard({ hasCountdown: true, countdownTimer: 5000 });
      const result = enemy.onCardDraw(card);
      expect(result.hasCountdown).toBe(true);
      expect(result.countdownTimer).toBe(5000);
    });

    it('does not add countdown to new cards', () => {
      const enemy = createTickingViper();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.hasCountdown).toBeUndefined();
    });
  });

  describe('lifecycle hooks - onValidMatch', () => {
    it('returns pointsMultiplier of 1', () => {
      const enemy = createTickingViper();
      const result = enemy.onValidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('returns timeDelta of 0', () => {
      const enemy = createTickingViper();
      const result = enemy.onValidMatch([], []);
      expect(result.timeDelta).toBe(0);
    });

    it('returns empty cardsToRemove array', () => {
      const enemy = createTickingViper();
      const result = enemy.onValidMatch([], []);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardsToFlip array', () => {
      const enemy = createTickingViper();
      const result = enemy.onValidMatch([], []);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createTickingViper();
      const result = enemy.onValidMatch([], []);
      expect(result.events).toEqual([]);
    });

    it('handles matched cards parameter', () => {
      const enemy = createTickingViper();
      const matchedCards = createTestBoard(3);
      const result = enemy.onValidMatch(matchedCards, []);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('handles board parameter', () => {
      const enemy = createTickingViper();
      const board = createTestBoard(12);
      const result = enemy.onValidMatch([], board);
      expect(result.pointsMultiplier).toBe(1);
    });
  });

  describe('lifecycle hooks - onInvalidMatch', () => {
    it('returns pointsMultiplier of 1', () => {
      const enemy = createTickingViper();
      const result = enemy.onInvalidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('returns timeDelta of 0', () => {
      const enemy = createTickingViper();
      const result = enemy.onInvalidMatch([], []);
      expect(result.timeDelta).toBe(0);
    });

    it('returns empty cardsToRemove array', () => {
      const enemy = createTickingViper();
      const result = enemy.onInvalidMatch([], []);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardsToFlip array', () => {
      const enemy = createTickingViper();
      const result = enemy.onInvalidMatch([], []);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createTickingViper();
      const result = enemy.onInvalidMatch([], []);
      expect(result.events).toEqual([]);
    });

    it('does not penalize invalid matches', () => {
      const enemy = createTickingViper();
      const invalidCards = createTestBoard(3);
      const board = createTestBoard(12);
      const result = enemy.onInvalidMatch(invalidCards, board);
      expect(result.cardsToRemove).toEqual([]);
    });
  });

  describe('lifecycle hooks - onRoundEnd', () => {
    it('completes without error', () => {
      const enemy = createTickingViper();
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('returns undefined', () => {
      const enemy = createTickingViper();
      const result = enemy.onRoundEnd();
      expect(result).toBeUndefined();
    });

    it('can be called multiple times', () => {
      const enemy = createTickingViper();
      expect(() => {
        enemy.onRoundEnd();
        enemy.onRoundEnd();
        enemy.onRoundEnd();
      }).not.toThrow();
    });
  });

  // ============================================================================
  // UI MODIFIERS TESTS
  // ============================================================================

  describe('getUIModifiers', () => {
    it('returns empty object before onRoundStart', () => {
      const enemy = createTickingViper();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers).toEqual({});
    });

    it('returns showCountdownCards after onRoundStart', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      enemy.onTick(0, cards);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showCountdownCards).toBeDefined();
    });

    it('showCountdownCards has correct cardId', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      enemy.onTick(0, cards);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showCountdownCards?.[0].cardId).toBe(cards[0].id);
    });

    it('showCountdownCards has correct initial timeRemaining', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      enemy.onTick(0, cards);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showCountdownCards?.[0].timeRemaining).toBe(15000);
    });

    it('showCountdownCards updates after tick', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      enemy.onTick(5000, cards);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showCountdownCards?.[0].timeRemaining).toBe(10000);
    });

    it('showCountdownCards is array of length 1', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      enemy.onTick(0, cards);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showCountdownCards?.length).toBe(1);
    });

    it('does not include other UI modifier properties', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      enemy.onTick(0, cards);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showInactivityBar).toBeUndefined();
      expect(modifiers.showScoreDecay).toBeUndefined();
      expect(modifiers.timerSpeedMultiplier).toBeUndefined();
      expect(modifiers.showBombCards).toBeUndefined();
    });
  });

  // ============================================================================
  // STAT MODIFIERS TESTS
  // ============================================================================

  describe('getStatModifiers', () => {
    it('returns empty object', () => {
      const enemy = createTickingViper();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers).toEqual({});
    });

    it('does not modify fire spread chance', () => {
      const enemy = createTickingViper();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
    });

    it('does not modify explosion chance', () => {
      const enemy = createTickingViper();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.explosionChanceReduction).toBeUndefined();
    });

    it('does not modify laser chance', () => {
      const enemy = createTickingViper();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.laserChanceReduction).toBeUndefined();
    });

    it('does not modify damage multiplier', () => {
      const enemy = createTickingViper();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.damageMultiplier).toBeUndefined();
    });

    it('does not modify points multiplier', () => {
      const enemy = createTickingViper();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.pointsMultiplier).toBeUndefined();
    });

    it('returns same result before and after onRoundStart', () => {
      mockRandom(0);
      const enemy = createTickingViper();

      const modifiersBefore = enemy.getStatModifiers();
      enemy.onRoundStart(createTestBoard(3));
      const modifiersAfter = enemy.getStatModifiers();

      expect(modifiersBefore).toEqual(modifiersAfter);
    });
  });

  // ============================================================================
  // EDGE CASES AND INTEGRATION TESTS
  // ============================================================================

  describe('edge cases', () => {
    it('handles multiple rounds correctly (state reset)', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards1 = createTestBoard(3);

      // First round
      enemy.onRoundStart(cards1);
      enemy.onTick(5000, cards1);
      enemy.onRoundEnd();

      // Second round - reset counter for new IDs
      resetCardIdCounter();
      const cards2 = createTestBoard(3);
      const result = enemy.onRoundStart(cards2);

      expect(result.cardModifications[0].changes.countdownTimer).toBe(15000);
    });

    it('handles rapid consecutive ticks', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);

      // Simulate 150 rapid ticks of 100ms each (15 seconds total)
      let totalHealthDelta = 0;
      for (let i = 0; i < 150; i++) {
        const result = enemy.onTick(100, cards);
        totalHealthDelta += result.healthDelta;
      }

      // Should have exactly 1 damage from expiry
      expect(totalHealthDelta).toBe(-1);
    });

    it('creates fresh instance each time', () => {
      const enemy1 = createTickingViper();
      const enemy2 = createTickingViper();

      expect(enemy1).not.toBe(enemy2);
    });

    it('instances do not share state', () => {
      mockRandom(0);
      const enemy1 = createTickingViper();
      const enemy2 = createTickingViper();

      const cards1 = createTestBoard(3);
      resetCardIdCounter();
      const cards2 = createTestBoard(3);

      enemy1.onRoundStart(cards1);
      enemy1.onTick(10000, cards1);

      enemy2.onRoundStart(cards2);

      const ui1 = enemy1.getUIModifiers();
      const ui2 = enemy2.getUIModifiers();

      expect(ui1.showCountdownCards?.[0].timeRemaining).toBe(5000);
      expect(ui2.showCountdownCards?.[0].timeRemaining).toBe(15000);
    });

    it('handles zero-delta tick', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = createTestBoard(3);

      enemy.onRoundStart(cards);
      const result = enemy.onTick(0, cards);

      const modification = result.cardModifications.find(
        (m) => m.cardId === cards[0].id
      );
      expect(modification?.changes.countdownTimer).toBe(15000);
    });

    it('handles single card board with expiry', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = [createCard()];

      enemy.onRoundStart(cards);
      const result = enemy.onTick(16000, cards);

      expect(result.healthDelta).toBe(-1);
      // No new countdown card since we can't pick from same single card
      const newCountdown = result.cardModifications.find(
        (m) => m.changes.hasCountdown === true && m.cardId !== cards[0].id
      );
      expect(newCountdown).toBeUndefined();
    });

    it('clears countdown from expired card even with single card', () => {
      mockRandom(0);
      const enemy = createTickingViper();
      const cards = [createCard()];

      enemy.onRoundStart(cards);
      const result = enemy.onTick(16000, cards);

      const clearCountdown = result.cardModifications.find(
        (m) => m.cardId === cards[0].id && m.changes.hasCountdown === false
      );
      expect(clearCountdown).toBeDefined();
    });
  });

  describe('integration - full round simulation', () => {
    it('can survive full round with timely matches', () => {
      mockRandomSequence([0, 0.5, 0.99, 0, 0.5]);
      const enemy = createTickingViper();
      const cards = createTestBoard(12);

      enemy.onRoundStart(cards);

      let totalDamage = 0;

      // Simulate 60 seconds of gameplay with card matches every 10 seconds
      for (let second = 0; second < 60; second++) {
        const result = enemy.onTick(1000, cards);
        totalDamage += result.healthDelta;

        // Simulate matching the countdown card every 10 seconds
        if (second % 10 === 9) {
          // Remove the countdown card and let new one be selected
          const countdownCardId = enemy.getUIModifiers().showCountdownCards?.[0]?.cardId;
          const remainingCards = cards.filter((c) => c.id !== countdownCardId);
          enemy.onTick(100, remainingCards);
        }
      }

      // With proper matching, should take minimal damage
      expect(totalDamage).toBeLessThan(6);
    });

    it('takes multiple damage if countdown expires repeatedly', () => {
      mockRandomSequence([0, 0.5, 0.99, 0, 0.5, 0.99]);
      const enemy = createTickingViper();
      const cards = createTestBoard(12);

      enemy.onRoundStart(cards);

      let totalDamage = 0;

      // Let countdown expire twice (30+ seconds with no matching)
      for (let i = 0; i < 32; i++) {
        const result = enemy.onTick(1000, cards);
        totalDamage += result.healthDelta;
      }

      // Should take at least 2 damage (2 expiries)
      expect(totalDamage).toBeLessThanOrEqual(-2);
    });
  });
});
