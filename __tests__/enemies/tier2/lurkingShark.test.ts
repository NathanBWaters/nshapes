/**
 * Comprehensive Unit Tests for Lurking Shark Enemy (Tier 2)
 *
 * Lurking Shark Effects:
 * - 25% chance to create face-down cards on card draw
 * - 60% chance to flip face-down cards on valid match
 *
 * Defeat Condition: Match at least 2 face-down cards (cumulative)
 *
 * KNOWN BUG: Face-down cards are revealed BEFORE matching, so the game
 * currently counts them as "revealed" not "face-down" when matching.
 * The wasOriginallyFaceDown field should be used to track this properly.
 */

import { createLurkingShark } from '@/utils/enemies/tier2/lurkingShark';
import {
  createRoundStats,
  createCard,
  createFaceDownCard,
  createRevealedFaceDownCard,
  createTestBoard,
  createVariedBoard,
  resetCardIdCounter,
} from '../../testUtils';
import type { Card } from '@/types';

// Reset card ID counter before each test for deterministic IDs
beforeEach(() => {
  resetCardIdCounter();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Lurking Shark', () => {
  // ==========================================================================
  // METADATA TESTS (10 tests)
  // ==========================================================================
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createLurkingShark();
      expect(enemy.name).toBe('Lurking Shark');
    });

    it('has correct tier (should be 2)', () => {
      const enemy = createLurkingShark();
      expect(enemy.tier).toBe(2);
    });

    it('has correct icon', () => {
      const enemy = createLurkingShark();
      expect(enemy.icon).toBe('lorc/shark-jaws');
    });

    it('has description mentioning 25%', () => {
      const enemy = createLurkingShark();
      expect(enemy.description).toContain('25%');
    });

    it('has description mentioning face-down', () => {
      const enemy = createLurkingShark();
      expect(enemy.description.toLowerCase()).toContain('face-down');
    });

    it('has description mentioning tap to reveal', () => {
      const enemy = createLurkingShark();
      expect(enemy.description.toLowerCase()).toContain('tap to reveal');
    });

    it('has defeatConditionText mentioning 2 revealed cards', () => {
      const enemy = createLurkingShark();
      expect(enemy.defeatConditionText).toContain('2');
    });

    it('has defeatConditionText mentioning revealed cards', () => {
      const enemy = createLurkingShark();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('revealed');
    });

    it('has defeatConditionText mentioning matches', () => {
      const enemy = createLurkingShark();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('match');
    });

    it('creates new instance each time (factory pattern)', () => {
      const enemy1 = createLurkingShark();
      const enemy2 = createLurkingShark();
      expect(enemy1).not.toBe(enemy2);
    });
  });

  // ==========================================================================
  // FACE-DOWN EFFECT - onCardDraw TESTS (15 tests)
  // ==========================================================================
  describe('FaceDownEffect - onCardDraw', () => {
    describe('25% chance boundary testing', () => {
      it('creates face-down card when random is 0 (minimum)', () => {
        const enemy = createLurkingShark();
        const card = createCard();
        jest.spyOn(Math, 'random').mockReturnValue(0);

        const result = enemy.onCardDraw(card);
        expect(result.isFaceDown).toBe(true);
      });

      it('creates face-down card when random is 0.01', () => {
        const enemy = createLurkingShark();
        const card = createCard();
        jest.spyOn(Math, 'random').mockReturnValue(0.01);

        const result = enemy.onCardDraw(card);
        expect(result.isFaceDown).toBe(true);
      });

      it('creates face-down card when random is 0.10', () => {
        const enemy = createLurkingShark();
        const card = createCard();
        jest.spyOn(Math, 'random').mockReturnValue(0.1);

        const result = enemy.onCardDraw(card);
        expect(result.isFaceDown).toBe(true);
      });

      it('creates face-down card when random is 0.20', () => {
        const enemy = createLurkingShark();
        const card = createCard();
        jest.spyOn(Math, 'random').mockReturnValue(0.2);

        const result = enemy.onCardDraw(card);
        expect(result.isFaceDown).toBe(true);
      });

      it('creates face-down card when random is 0.249 (just under boundary)', () => {
        const enemy = createLurkingShark();
        const card = createCard();
        // 0.249 * 100 = 24.9, which is < 25
        jest.spyOn(Math, 'random').mockReturnValue(0.249);

        const result = enemy.onCardDraw(card);
        expect(result.isFaceDown).toBe(true);
      });

      it('does NOT create face-down card when random is exactly 0.25 (boundary)', () => {
        const enemy = createLurkingShark();
        const card = createCard();
        // 0.25 * 100 = 25, which is NOT < 25
        jest.spyOn(Math, 'random').mockReturnValue(0.25);

        const result = enemy.onCardDraw(card);
        expect(result.isFaceDown).toBeUndefined();
      });

      it('does NOT create face-down card when random is 0.251 (just over boundary)', () => {
        const enemy = createLurkingShark();
        const card = createCard();
        jest.spyOn(Math, 'random').mockReturnValue(0.251);

        const result = enemy.onCardDraw(card);
        expect(result.isFaceDown).toBeUndefined();
      });

      it('does NOT create face-down card when random is 0.5', () => {
        const enemy = createLurkingShark();
        const card = createCard();
        jest.spyOn(Math, 'random').mockReturnValue(0.5);

        const result = enemy.onCardDraw(card);
        expect(result.isFaceDown).toBeUndefined();
      });

      it('does NOT create face-down card when random is 0.75', () => {
        const enemy = createLurkingShark();
        const card = createCard();
        jest.spyOn(Math, 'random').mockReturnValue(0.75);

        const result = enemy.onCardDraw(card);
        expect(result.isFaceDown).toBeUndefined();
      });

      it('does NOT create face-down card when random is 0.999 (near maximum)', () => {
        const enemy = createLurkingShark();
        const card = createCard();
        jest.spyOn(Math, 'random').mockReturnValue(0.999);

        const result = enemy.onCardDraw(card);
        expect(result.isFaceDown).toBeUndefined();
      });
    });

    describe('card property preservation', () => {
      it('preserves card id when making face-down', () => {
        const enemy = createLurkingShark();
        const card = createCard({ id: 'my-special-card' });
        jest.spyOn(Math, 'random').mockReturnValue(0);

        const result = enemy.onCardDraw(card);
        expect(result.id).toBe('my-special-card');
      });

      it('preserves all card attributes when making face-down', () => {
        const enemy = createLurkingShark();
        const card = createCard({
          shape: 'diamond',
          color: 'purple',
          number: 3,
          shading: 'striped',
        });
        jest.spyOn(Math, 'random').mockReturnValue(0);

        const result = enemy.onCardDraw(card);
        expect(result.shape).toBe('diamond');
        expect(result.color).toBe('purple');
        expect(result.number).toBe(3);
        expect(result.shading).toBe('striped');
        expect(result.isFaceDown).toBe(true);
      });

      it('preserves card id when NOT making face-down', () => {
        const enemy = createLurkingShark();
        const card = createCard({ id: 'preserved-id' });
        jest.spyOn(Math, 'random').mockReturnValue(0.5);

        const result = enemy.onCardDraw(card);
        expect(result.id).toBe('preserved-id');
      });

      it('returns same card reference when NOT making face-down', () => {
        const enemy = createLurkingShark();
        const card = createCard();
        jest.spyOn(Math, 'random').mockReturnValue(0.5);

        const result = enemy.onCardDraw(card);
        // When not modified, should return the original card
        expect(result).toBe(card);
      });

      it('returns new card object when making face-down (immutability)', () => {
        const enemy = createLurkingShark();
        const card = createCard();
        jest.spyOn(Math, 'random').mockReturnValue(0);

        const result = enemy.onCardDraw(card);
        expect(result).not.toBe(card);
        expect(result.isFaceDown).toBe(true);
        expect(card.isFaceDown).toBeUndefined(); // Original unchanged
      });
    });
  });

  // ==========================================================================
  // FACE-DOWN EFFECT - onValidMatch (60% flip chance) TESTS (15 tests)
  // ==========================================================================
  describe('FaceDownEffect - onValidMatch (60% flip chance)', () => {
    describe('60% flip chance boundary testing', () => {
      it('flips face-down card when random is 0 (minimum)', () => {
        const enemy = createLurkingShark();
        const faceDownCard = createFaceDownCard({ id: 'fd-card' });
        const board = [faceDownCard, createCard(), createCard()];
        jest.spyOn(Math, 'random').mockReturnValue(0);

        const result = enemy.onValidMatch([], board);
        expect(result.cardsToFlip).toContain('fd-card');
      });

      it('flips face-down card when random is 0.30', () => {
        const enemy = createLurkingShark();
        const faceDownCard = createFaceDownCard({ id: 'fd-card' });
        const board = [faceDownCard];
        jest.spyOn(Math, 'random').mockReturnValue(0.3);

        const result = enemy.onValidMatch([], board);
        expect(result.cardsToFlip).toContain('fd-card');
      });

      it('flips face-down card when random is 0.599 (just under boundary)', () => {
        const enemy = createLurkingShark();
        const faceDownCard = createFaceDownCard({ id: 'fd-card' });
        const board = [faceDownCard];
        // 0.599 * 100 = 59.9, which is < 60
        jest.spyOn(Math, 'random').mockReturnValue(0.599);

        const result = enemy.onValidMatch([], board);
        expect(result.cardsToFlip).toContain('fd-card');
      });

      it('does NOT flip card when random is exactly 0.60 (boundary)', () => {
        const enemy = createLurkingShark();
        const faceDownCard = createFaceDownCard({ id: 'fd-card' });
        const board = [faceDownCard];
        // 0.60 * 100 = 60, which is NOT < 60
        jest.spyOn(Math, 'random').mockReturnValue(0.6);

        const result = enemy.onValidMatch([], board);
        expect(result.cardsToFlip).not.toContain('fd-card');
      });

      it('does NOT flip card when random is 0.601 (just over boundary)', () => {
        const enemy = createLurkingShark();
        const faceDownCard = createFaceDownCard({ id: 'fd-card' });
        const board = [faceDownCard];
        jest.spyOn(Math, 'random').mockReturnValue(0.601);

        const result = enemy.onValidMatch([], board);
        expect(result.cardsToFlip).not.toContain('fd-card');
      });

      it('does NOT flip card when random is 0.80', () => {
        const enemy = createLurkingShark();
        const faceDownCard = createFaceDownCard({ id: 'fd-card' });
        const board = [faceDownCard];
        jest.spyOn(Math, 'random').mockReturnValue(0.8);

        const result = enemy.onValidMatch([], board);
        expect(result.cardsToFlip).not.toContain('fd-card');
      });

      it('does NOT flip card when random is 0.999', () => {
        const enemy = createLurkingShark();
        const faceDownCard = createFaceDownCard({ id: 'fd-card' });
        const board = [faceDownCard];
        jest.spyOn(Math, 'random').mockReturnValue(0.999);

        const result = enemy.onValidMatch([], board);
        expect(result.cardsToFlip).not.toContain('fd-card');
      });
    });

    describe('multiple face-down cards', () => {
      it('rolls independently for each face-down card', () => {
        const enemy = createLurkingShark();
        const fd1 = createFaceDownCard({ id: 'fd-1' });
        const fd2 = createFaceDownCard({ id: 'fd-2' });
        const fd3 = createFaceDownCard({ id: 'fd-3' });
        const board = [fd1, fd2, fd3];

        // First card: 0.3 (flips), second: 0.7 (no flip), third: 0.4 (flips)
        const mockRandom = jest.spyOn(Math, 'random');
        mockRandom.mockReturnValueOnce(0.3);
        mockRandom.mockReturnValueOnce(0.7);
        mockRandom.mockReturnValueOnce(0.4);

        const result = enemy.onValidMatch([], board);
        expect(result.cardsToFlip).toContain('fd-1');
        expect(result.cardsToFlip).not.toContain('fd-2');
        expect(result.cardsToFlip).toContain('fd-3');
      });

      it('can flip all face-down cards when all rolls succeed', () => {
        const enemy = createLurkingShark();
        const fd1 = createFaceDownCard({ id: 'fd-1' });
        const fd2 = createFaceDownCard({ id: 'fd-2' });
        const board = [fd1, fd2];
        jest.spyOn(Math, 'random').mockReturnValue(0.1); // All succeed

        const result = enemy.onValidMatch([], board);
        expect(result.cardsToFlip).toContain('fd-1');
        expect(result.cardsToFlip).toContain('fd-2');
        expect(result.cardsToFlip).toHaveLength(2);
      });

      it('flips no cards when all rolls fail', () => {
        const enemy = createLurkingShark();
        const fd1 = createFaceDownCard({ id: 'fd-1' });
        const fd2 = createFaceDownCard({ id: 'fd-2' });
        const board = [fd1, fd2];
        jest.spyOn(Math, 'random').mockReturnValue(0.9); // All fail

        const result = enemy.onValidMatch([], board);
        expect(result.cardsToFlip).toHaveLength(0);
      });
    });

    describe('board filtering', () => {
      it('only considers cards with isFaceDown=true', () => {
        const enemy = createLurkingShark();
        const faceDownCard = createFaceDownCard({ id: 'fd-card' });
        const normalCard = createCard({ id: 'normal-card' });
        const board = [faceDownCard, normalCard];
        jest.spyOn(Math, 'random').mockReturnValue(0);

        const result = enemy.onValidMatch([], board);
        expect(result.cardsToFlip).toContain('fd-card');
        expect(result.cardsToFlip).not.toContain('normal-card');
      });

      it('returns empty cardsToFlip when board has no face-down cards', () => {
        const enemy = createLurkingShark();
        const board = createTestBoard(5);
        jest.spyOn(Math, 'random').mockReturnValue(0);

        const result = enemy.onValidMatch([], board);
        expect(result.cardsToFlip).toHaveLength(0);
      });

      it('handles empty board', () => {
        const enemy = createLurkingShark();
        jest.spyOn(Math, 'random').mockReturnValue(0);

        const result = enemy.onValidMatch([], []);
        expect(result.cardsToFlip).toHaveLength(0);
      });
    });

    describe('events generation', () => {
      it('generates card_flipped event for each flipped card', () => {
        const enemy = createLurkingShark();
        const faceDownCard = createFaceDownCard({ id: 'fd-card' });
        const board = [faceDownCard];
        jest.spyOn(Math, 'random').mockReturnValue(0);

        const result = enemy.onValidMatch([], board);
        expect(result.events).toContainEqual({
          type: 'card_flipped',
          cardId: 'fd-card',
        });
      });

      it('generates events for all flipped cards', () => {
        const enemy = createLurkingShark();
        const fd1 = createFaceDownCard({ id: 'fd-1' });
        const fd2 = createFaceDownCard({ id: 'fd-2' });
        const board = [fd1, fd2];
        jest.spyOn(Math, 'random').mockReturnValue(0);

        const result = enemy.onValidMatch([], board);
        expect(result.events).toHaveLength(2);
        expect(result.events).toContainEqual({ type: 'card_flipped', cardId: 'fd-1' });
        expect(result.events).toContainEqual({ type: 'card_flipped', cardId: 'fd-2' });
      });

      it('generates no events when no cards flip', () => {
        const enemy = createLurkingShark();
        const faceDownCard = createFaceDownCard({ id: 'fd-card' });
        const board = [faceDownCard];
        jest.spyOn(Math, 'random').mockReturnValue(0.9);

        const result = enemy.onValidMatch([], board);
        expect(result.events).toHaveLength(0);
      });
    });
  });

  // ==========================================================================
  // DEFEAT CONDITION TESTS (15 tests)
  // ==========================================================================
  describe('defeat condition', () => {
    describe('threshold boundary testing', () => {
      it('returns false when faceDownCardsMatched is 0', () => {
        const enemy = createLurkingShark();
        const stats = createRoundStats({ faceDownCardsMatched: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when faceDownCardsMatched is 1', () => {
        const enemy = createLurkingShark();
        const stats = createRoundStats({ faceDownCardsMatched: 1 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true when faceDownCardsMatched is exactly 2 (threshold)', () => {
        const enemy = createLurkingShark();
        const stats = createRoundStats({ faceDownCardsMatched: 2 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when faceDownCardsMatched is 3', () => {
        const enemy = createLurkingShark();
        const stats = createRoundStats({ faceDownCardsMatched: 3 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when faceDownCardsMatched is 5', () => {
        const enemy = createLurkingShark();
        const stats = createRoundStats({ faceDownCardsMatched: 5 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when faceDownCardsMatched is 10', () => {
        const enemy = createLurkingShark();
        const stats = createRoundStats({ faceDownCardsMatched: 10 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when faceDownCardsMatched is 100', () => {
        const enemy = createLurkingShark();
        const stats = createRoundStats({ faceDownCardsMatched: 100 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('independence from other stats', () => {
      it('ignores totalMatches', () => {
        const enemy = createLurkingShark();
        const stats = createRoundStats({
          faceDownCardsMatched: 0,
          totalMatches: 100,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores currentScore', () => {
        const enemy = createLurkingShark();
        const stats = createRoundStats({
          faceDownCardsMatched: 1,
          currentScore: 500,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores bombsDefused', () => {
        const enemy = createLurkingShark();
        const stats = createRoundStats({
          faceDownCardsMatched: 1,
          bombsDefused: 5,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores tripleCardsCleared', () => {
        const enemy = createLurkingShark();
        const stats = createRoundStats({
          faceDownCardsMatched: 1,
          tripleCardsCleared: 10,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });

    /**
     * BUG DOCUMENTATION TESTS
     *
     * The following tests document the known bug where face-down cards
     * are revealed BEFORE they can be matched. This means:
     * 1. Player taps to reveal face-down card
     * 2. Card's isFaceDown becomes false
     * 3. Player includes card in match
     * 4. Game should count this as "originally face-down" match
     *
     * The fix requires using wasOriginallyFaceDown to track this.
     */
    describe('wasOriginallyFaceDown tracking (bug documentation)', () => {
      it('cards revealed before matching should still count - using wasOriginallyFaceDown', () => {
        // This test documents the expected behavior once the bug is fixed
        // A card that was originally face-down but has been revealed
        // should still count toward the defeat condition when matched
        const revealedCard = createRevealedFaceDownCard({ id: 'revealed-fd' });

        // The card should have wasOriginallyFaceDown = true
        expect(revealedCard.wasOriginallyFaceDown).toBe(true);
        // But isFaceDown should be false (it was revealed)
        expect(revealedCard.isFaceDown).toBe(false);
      });

      it('createFaceDownCard sets both isFaceDown and wasOriginallyFaceDown', () => {
        const card = createFaceDownCard();
        expect(card.isFaceDown).toBe(true);
        expect(card.wasOriginallyFaceDown).toBe(true);
      });

      it('createRevealedFaceDownCard has isFaceDown false but wasOriginallyFaceDown true', () => {
        const card = createRevealedFaceDownCard();
        expect(card.isFaceDown).toBe(false);
        expect(card.wasOriginallyFaceDown).toBe(true);
      });

      it('normal cards should not have wasOriginallyFaceDown set', () => {
        const card = createCard();
        expect(card.wasOriginallyFaceDown).toBeUndefined();
      });
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS - onRoundStart TESTS (5 tests)
  // ==========================================================================
  describe('lifecycle - onRoundStart', () => {
    it('returns empty cardModifications array', () => {
      const enemy = createLurkingShark();
      const board = createTestBoard();

      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createLurkingShark();
      const board = createTestBoard();

      const result = enemy.onRoundStart(board);
      expect(result.events).toEqual([]);
    });

    it('does not modify the board passed in', () => {
      const enemy = createLurkingShark();
      const board = createTestBoard(5);
      const originalBoard = [...board];

      enemy.onRoundStart(board);
      expect(board).toEqual(originalBoard);
    });

    it('handles empty board', () => {
      const enemy = createLurkingShark();

      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('handles large board', () => {
      const enemy = createLurkingShark();
      const board = createTestBoard(100);

      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS - onTick TESTS (5 tests)
  // ==========================================================================
  describe('lifecycle - onTick', () => {
    it('returns zero scoreDelta', () => {
      const enemy = createLurkingShark();
      const result = enemy.onTick(1000, []);
      expect(result.scoreDelta).toBe(0);
    });

    it('returns zero healthDelta', () => {
      const enemy = createLurkingShark();
      const result = enemy.onTick(1000, []);
      expect(result.healthDelta).toBe(0);
    });

    it('returns zero timeDelta', () => {
      const enemy = createLurkingShark();
      const result = enemy.onTick(1000, []);
      expect(result.timeDelta).toBe(0);
    });

    it('returns empty cardsToRemove array', () => {
      const enemy = createLurkingShark();
      const result = enemy.onTick(1000, createTestBoard());
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns instantDeath as false', () => {
      const enemy = createLurkingShark();
      const result = enemy.onTick(1000, []);
      expect(result.instantDeath).toBe(false);
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS - onInvalidMatch TESTS (5 tests)
  // ==========================================================================
  describe('lifecycle - onInvalidMatch', () => {
    it('returns zero timeDelta', () => {
      const enemy = createLurkingShark();
      const result = enemy.onInvalidMatch([], []);
      expect(result.timeDelta).toBe(0);
    });

    it('returns pointsMultiplier of 1 (no modification)', () => {
      const enemy = createLurkingShark();
      const result = enemy.onInvalidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('returns empty cardsToRemove array', () => {
      const enemy = createLurkingShark();
      const result = enemy.onInvalidMatch([], []);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardsToFlip array', () => {
      const enemy = createLurkingShark();
      const result = enemy.onInvalidMatch([], []);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createLurkingShark();
      const result = enemy.onInvalidMatch([], []);
      expect(result.events).toEqual([]);
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS - onRoundEnd TESTS (3 tests)
  // ==========================================================================
  describe('lifecycle - onRoundEnd', () => {
    it('does not throw when called', () => {
      const enemy = createLurkingShark();
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('can be called multiple times', () => {
      const enemy = createLurkingShark();
      expect(() => {
        enemy.onRoundEnd();
        enemy.onRoundEnd();
        enemy.onRoundEnd();
      }).not.toThrow();
    });

    it('returns undefined', () => {
      const enemy = createLurkingShark();
      const result = enemy.onRoundEnd();
      expect(result).toBeUndefined();
    });
  });

  // ==========================================================================
  // UI MODIFIERS TESTS (5 tests)
  // ==========================================================================
  describe('getUIModifiers', () => {
    it('returns an object (not undefined)', () => {
      const enemy = createLurkingShark();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers).toBeDefined();
      expect(typeof modifiers).toBe('object');
    });

    it('does not have showInactivityBar (no inactivity effect)', () => {
      const enemy = createLurkingShark();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showInactivityBar).toBeUndefined();
    });

    it('does not have timerSpeedMultiplier (no timer speed effect)', () => {
      const enemy = createLurkingShark();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.timerSpeedMultiplier).toBeUndefined();
    });

    it('does not have disableAutoHint (hints not disabled)', () => {
      const enemy = createLurkingShark();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableAutoHint).toBeUndefined();
    });

    it('does not have weaponCounters (no weapon counter effect)', () => {
      const enemy = createLurkingShark();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters).toBeUndefined();
    });
  });

  // ==========================================================================
  // STAT MODIFIERS TESTS (5 tests)
  // ==========================================================================
  describe('getStatModifiers', () => {
    it('returns an object (not undefined)', () => {
      const enemy = createLurkingShark();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers).toBeDefined();
      expect(typeof modifiers).toBe('object');
    });

    it('does not have damageMultiplier (no damage modification)', () => {
      const enemy = createLurkingShark();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.damageMultiplier).toBeUndefined();
    });

    it('does not have pointsMultiplier (no points modification)', () => {
      const enemy = createLurkingShark();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.pointsMultiplier).toBeUndefined();
    });

    it('does not have fireSpreadChanceReduction (no fire counter)', () => {
      const enemy = createLurkingShark();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
    });

    it('does not have graceGainChanceReduction (no grace counter)', () => {
      const enemy = createLurkingShark();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.graceGainChanceReduction).toBeUndefined();
    });
  });

  // ==========================================================================
  // INTEGRATION / SCENARIO TESTS (7 tests)
  // ==========================================================================
  describe('integration scenarios', () => {
    it('face-down cards persist across multiple valid matches', () => {
      const enemy = createLurkingShark();
      const faceDownCard = createFaceDownCard({ id: 'persistent-fd' });
      const board = [faceDownCard, createCard(), createCard()];

      // All flip rolls fail
      jest.spyOn(Math, 'random').mockReturnValue(0.9);

      // Multiple matches, card should not flip
      let result = enemy.onValidMatch([], board);
      expect(result.cardsToFlip).not.toContain('persistent-fd');

      result = enemy.onValidMatch([], board);
      expect(result.cardsToFlip).not.toContain('persistent-fd');

      result = enemy.onValidMatch([], board);
      expect(result.cardsToFlip).not.toContain('persistent-fd');
    });

    it('newly drawn face-down cards are eligible for flip on next match', () => {
      const enemy = createLurkingShark();

      // Draw a card that becomes face-down
      const mockRandom = jest.spyOn(Math, 'random');
      mockRandom.mockReturnValueOnce(0.1); // Card draw: becomes face-down

      const drawnCard = enemy.onCardDraw(createCard({ id: 'new-fd' }));
      expect(drawnCard.isFaceDown).toBe(true);

      // Add to board
      const board = [drawnCard];

      // On next match, flip roll succeeds
      mockRandom.mockReturnValueOnce(0.2); // Flip roll: succeeds
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToFlip).toContain('new-fd');
    });

    it('complete round simulation: draw cards, match, check defeat', () => {
      const enemy = createLurkingShark();
      const stats = createRoundStats();

      // Simulate drawing 4 cards, 25% should become face-down
      const mockRandom = jest.spyOn(Math, 'random');
      mockRandom
        .mockReturnValueOnce(0.1) // Card 1: face-down
        .mockReturnValueOnce(0.5) // Card 2: normal
        .mockReturnValueOnce(0.2) // Card 3: face-down
        .mockReturnValueOnce(0.9); // Card 4: normal

      const cards: Card[] = [];
      for (let i = 0; i < 4; i++) {
        cards.push(enemy.onCardDraw(createCard({ id: `card-${i}` })));
      }

      // Verify face-down distribution
      const faceDownCards = cards.filter((c) => c.isFaceDown);
      expect(faceDownCards).toHaveLength(2);

      // Not defeated yet
      expect(enemy.checkDefeatCondition(stats)).toBe(false);

      // Simulate matching 2 face-down cards (would increment faceDownCardsMatched)
      stats.faceDownCardsMatched = 2;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('onValidMatch does not affect matched cards passed in', () => {
      const enemy = createLurkingShark();
      const matchedCards = [createCard({ id: 'm1' }), createCard({ id: 'm2' })];
      const faceDownOnBoard = createFaceDownCard({ id: 'fd-board' });
      const board = [faceDownOnBoard];

      jest.spyOn(Math, 'random').mockReturnValue(0);

      const result = enemy.onValidMatch(matchedCards, board);

      // Only board face-down cards should be considered for flipping
      expect(result.cardsToFlip).toContain('fd-board');
      expect(result.cardsToFlip).not.toContain('m1');
      expect(result.cardsToFlip).not.toContain('m2');
    });

    it('varied board with mixed card types handles correctly', () => {
      const enemy = createLurkingShark();
      const board = [
        createFaceDownCard({ id: 'fd-1' }),
        createCard({ id: 'normal-1' }),
        createFaceDownCard({ id: 'fd-2' }),
        createCard({ id: 'normal-2', onFire: true }),
        createFaceDownCard({ id: 'fd-3' }),
      ];

      jest.spyOn(Math, 'random').mockReturnValue(0);

      const result = enemy.onValidMatch([], board);

      // All face-down cards should be in flip list
      expect(result.cardsToFlip).toHaveLength(3);
      expect(result.cardsToFlip).toContain('fd-1');
      expect(result.cardsToFlip).toContain('fd-2');
      expect(result.cardsToFlip).toContain('fd-3');
    });

    it('enemy state resets between rounds via onRoundStart', () => {
      const enemy = createLurkingShark();
      const board = createTestBoard();

      // Do some operations
      enemy.onTick(5000, board);
      enemy.onValidMatch([], board);
      enemy.onRoundEnd();

      // Start new round
      const result = enemy.onRoundStart(board);

      // Should return clean state
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('enemy can be reused across multiple rounds', () => {
      const enemy = createLurkingShark();

      for (let round = 0; round < 3; round++) {
        const board = createTestBoard();
        enemy.onRoundStart(board);

        for (let tick = 0; tick < 10; tick++) {
          enemy.onTick(1000, board);
        }

        enemy.onValidMatch([], board);
        enemy.onRoundEnd();
      }

      // Should still function correctly
      expect(enemy.name).toBe('Lurking Shark');
      expect(enemy.tier).toBe(2);
    });
  });
});
