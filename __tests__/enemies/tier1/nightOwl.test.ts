/**
 * Comprehensive Unit Tests for Night Owl Enemy
 *
 * Night Owl - Tier 1 Enemy
 * Effect: 20% of cards are face-down; matching flips with 70% chance
 * Defeat Condition: Match a set with a revealed card (previously face-down)
 */
import type { Card } from '@/types';
import { createNightOwl } from '@/utils/enemies/tier1/nightOwl';
import {
  createRoundStats,
  createCard,
  createTestBoard,
  createFaceDownCard,
  createRevealedFaceDownCard,
  createVariedBoard,
  resetCardIdCounter,
} from '../../testUtils';

// Reset card ID counter before each test for deterministic IDs
beforeEach(() => {
  resetCardIdCounter();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ============================================================================
// METADATA TESTS
// ============================================================================

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

    it('is tier 1 (introductory difficulty)', () => {
      const enemy = createNightOwl();
      expect(enemy.tier).toBeLessThanOrEqual(2);
    });

    it('has description containing face-down percentage', () => {
      const enemy = createNightOwl();
      expect(enemy.description).toContain('20%');
    });

    it('has description mentioning face-down cards', () => {
      const enemy = createNightOwl();
      expect(enemy.description.toLowerCase()).toContain('face-down');
    });

    it('has description containing flip chance', () => {
      const enemy = createNightOwl();
      expect(enemy.description).toContain('70%');
    });

    it('has description mentioning matching mechanism', () => {
      const enemy = createNightOwl();
      expect(enemy.description.toLowerCase()).toContain('matching');
    });

    it('has correct defeat condition text', () => {
      const enemy = createNightOwl();
      expect(enemy.defeatConditionText).toBe('Match a set with a revealed card');
    });

    it('defeat condition text mentions revealed card', () => {
      const enemy = createNightOwl();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('revealed');
    });

    it('defeat condition text mentions matching', () => {
      const enemy = createNightOwl();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('match');
    });

    it('creates independent instances', () => {
      const enemy1 = createNightOwl();
      const enemy2 = createNightOwl();
      expect(enemy1).not.toBe(enemy2);
    });

    it('has consistent metadata across instances', () => {
      const enemy1 = createNightOwl();
      const enemy2 = createNightOwl();
      expect(enemy1.name).toBe(enemy2.name);
      expect(enemy1.tier).toBe(enemy2.tier);
      expect(enemy1.icon).toBe(enemy2.icon);
      expect(enemy1.description).toBe(enemy2.description);
      expect(enemy1.defeatConditionText).toBe(enemy2.defeatConditionText);
    });
  });

  // ============================================================================
  // FACE-DOWN EFFECT - onCardDraw TESTS
  // ============================================================================

  describe('FaceDownEffect - onCardDraw', () => {
    it('creates face-down cards when random < 20%', () => {
      const enemy = createNightOwl();
      jest.spyOn(Math, 'random').mockReturnValue(0.1); // 10% < 20%

      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isFaceDown).toBe(true);
    });

    it('does not create face-down cards when random >= 20%', () => {
      const enemy = createNightOwl();
      jest.spyOn(Math, 'random').mockReturnValue(0.25); // 25% >= 20%

      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isFaceDown).toBeUndefined();
    });

    it('creates face-down card at exactly 19.9% (boundary)', () => {
      const enemy = createNightOwl();
      jest.spyOn(Math, 'random').mockReturnValue(0.199); // 19.9% < 20%

      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isFaceDown).toBe(true);
    });

    it('does not create face-down card at exactly 20% (boundary)', () => {
      const enemy = createNightOwl();
      jest.spyOn(Math, 'random').mockReturnValue(0.20); // 20% = 20%, uses < not <=

      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isFaceDown).toBeUndefined();
    });

    it('creates face-down card at 0% (minimum)', () => {
      const enemy = createNightOwl();
      jest.spyOn(Math, 'random').mockReturnValue(0); // 0% < 20%

      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isFaceDown).toBe(true);
    });

    it('does not create face-down card at 100% (maximum)', () => {
      const enemy = createNightOwl();
      jest.spyOn(Math, 'random').mockReturnValue(0.999); // 99.9% >= 20%

      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isFaceDown).toBeUndefined();
    });

    it('preserves card ID when making face-down', () => {
      const enemy = createNightOwl();
      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const card = createCard({ id: 'my-card-id' });
      const result = enemy.onCardDraw(card);
      expect(result.id).toBe('my-card-id');
    });

    it('preserves all card attributes when making face-down', () => {
      const enemy = createNightOwl();
      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const card = createCard({
        shape: 'squiggle',
        color: 'purple',
        number: 3,
        shading: 'striped',
      });
      const result = enemy.onCardDraw(card);
      expect(result.shape).toBe('squiggle');
      expect(result.color).toBe('purple');
      expect(result.number).toBe(3);
      expect(result.shading).toBe('striped');
    });

    it('preserves card ID when not making face-down', () => {
      const enemy = createNightOwl();
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const card = createCard({ id: 'my-card-id' });
      const result = enemy.onCardDraw(card);
      expect(result.id).toBe('my-card-id');
    });

    it('returns original card reference when not face-down', () => {
      const enemy = createNightOwl();
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const card = createCard();
      const result = enemy.onCardDraw(card);
      // The card should be returned unmodified
      expect(result.isFaceDown).toBeUndefined();
    });

    it('rolls independently for each card drawn', () => {
      const enemy = createNightOwl();
      const mockRandom = jest.spyOn(Math, 'random');

      // First card: will be face-down (10%)
      mockRandom.mockReturnValueOnce(0.1);
      // Second card: will not be face-down (50%)
      mockRandom.mockReturnValueOnce(0.5);
      // Third card: will be face-down (5%)
      mockRandom.mockReturnValueOnce(0.05);

      const card1 = enemy.onCardDraw(createCard({ id: 'card-1' }));
      const card2 = enemy.onCardDraw(createCard({ id: 'card-2' }));
      const card3 = enemy.onCardDraw(createCard({ id: 'card-3' }));

      expect(card1.isFaceDown).toBe(true);
      expect(card2.isFaceDown).toBeUndefined();
      expect(card3.isFaceDown).toBe(true);
    });

    it('handles multiple consecutive face-down cards', () => {
      const enemy = createNightOwl();
      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(enemy.onCardDraw(createCard({ id: `card-${i}` })));
      }

      results.forEach((card) => {
        expect(card.isFaceDown).toBe(true);
      });
    });

    it('handles multiple consecutive non-face-down cards', () => {
      const enemy = createNightOwl();
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const results = [];
      for (let i = 0; i < 5; i++) {
        results.push(enemy.onCardDraw(createCard({ id: `card-${i}` })));
      }

      results.forEach((card) => {
        expect(card.isFaceDown).toBeUndefined();
      });
    });
  });

  // ============================================================================
  // FACE-DOWN EFFECT - onValidMatch FLIP TESTS
  // ============================================================================

  describe('FaceDownEffect - onValidMatch flip behavior', () => {
    it('flips face-down cards when random < 70%', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      jest.spyOn(Math, 'random').mockReturnValue(0.5); // 50% < 70%

      const board = [createFaceDownCard({ id: 'facedown-1' })];
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToFlip).toContain('facedown-1');
    });

    it('does not flip face-down cards when random >= 70%', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      jest.spyOn(Math, 'random').mockReturnValue(0.8); // 80% >= 70%

      const board = [createFaceDownCard({ id: 'facedown-1' })];
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToFlip).not.toContain('facedown-1');
    });

    it('flips face-down card at exactly 69.9% (boundary)', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      jest.spyOn(Math, 'random').mockReturnValue(0.699); // 69.9% < 70%

      const board = [createFaceDownCard({ id: 'facedown-1' })];
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToFlip).toContain('facedown-1');
    });

    it('does not flip face-down card at exactly 70% (boundary)', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      jest.spyOn(Math, 'random').mockReturnValue(0.70); // 70% = 70%, uses < not <=

      const board = [createFaceDownCard({ id: 'facedown-1' })];
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToFlip).not.toContain('facedown-1');
    });

    it('flips face-down card at 0% (minimum)', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      jest.spyOn(Math, 'random').mockReturnValue(0);

      const board = [createFaceDownCard({ id: 'facedown-1' })];
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToFlip).toContain('facedown-1');
    });

    it('does not flip face-down card at 99.9%', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      jest.spyOn(Math, 'random').mockReturnValue(0.999);

      const board = [createFaceDownCard({ id: 'facedown-1' })];
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToFlip).not.toContain('facedown-1');
    });

    it('emits card_flipped event for flipped cards', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const board = [createFaceDownCard({ id: 'facedown-1' })];
      const result = enemy.onValidMatch([], board);

      expect(result.events).toContainEqual({
        type: 'card_flipped',
        cardId: 'facedown-1',
      });
    });

    it('does not emit event when card is not flipped', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      jest.spyOn(Math, 'random').mockReturnValue(0.8);

      const board = [createFaceDownCard({ id: 'facedown-1' })];
      const result = enemy.onValidMatch([], board);

      expect(result.events).not.toContainEqual({
        type: 'card_flipped',
        cardId: 'facedown-1',
      });
    });

    it('returns empty cardsToFlip when no face-down cards on board', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const board = [
        createCard({ id: 'normal-1' }),
        createCard({ id: 'normal-2' }),
      ];
      const result = enemy.onValidMatch([], board);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events when no face-down cards on board', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const board = [createCard({ id: 'normal-1' })];
      const result = enemy.onValidMatch([], board);
      expect(result.events).toEqual([]);
    });

    it('rolls flip independently for each face-down card', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      const mockRandom = jest.spyOn(Math, 'random');

      // First face-down card: will flip (50%)
      mockRandom.mockReturnValueOnce(0.5);
      // Second face-down card: will not flip (80%)
      mockRandom.mockReturnValueOnce(0.8);
      // Third face-down card: will flip (10%)
      mockRandom.mockReturnValueOnce(0.1);

      const board = [
        createFaceDownCard({ id: 'fd-1' }),
        createFaceDownCard({ id: 'fd-2' }),
        createFaceDownCard({ id: 'fd-3' }),
      ];
      const result = enemy.onValidMatch([], board);

      expect(result.cardsToFlip).toContain('fd-1');
      expect(result.cardsToFlip).not.toContain('fd-2');
      expect(result.cardsToFlip).toContain('fd-3');
    });

    it('can flip all face-down cards when all rolls succeed', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      jest.spyOn(Math, 'random').mockReturnValue(0.3); // All will flip

      const board = [
        createFaceDownCard({ id: 'fd-1' }),
        createFaceDownCard({ id: 'fd-2' }),
        createFaceDownCard({ id: 'fd-3' }),
      ];
      const result = enemy.onValidMatch([], board);

      expect(result.cardsToFlip).toHaveLength(3);
      expect(result.cardsToFlip).toContain('fd-1');
      expect(result.cardsToFlip).toContain('fd-2');
      expect(result.cardsToFlip).toContain('fd-3');
    });

    it('flips no cards when all rolls fail', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      jest.spyOn(Math, 'random').mockReturnValue(0.9); // None will flip

      const board = [
        createFaceDownCard({ id: 'fd-1' }),
        createFaceDownCard({ id: 'fd-2' }),
      ];
      const result = enemy.onValidMatch([], board);

      expect(result.cardsToFlip).toHaveLength(0);
    });

    it('only considers cards with isFaceDown=true', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      jest.spyOn(Math, 'random').mockReturnValue(0.3);

      const board = [
        createFaceDownCard({ id: 'fd-1' }),
        createCard({ id: 'normal-1' }),
        createRevealedFaceDownCard({ id: 'revealed-1' }), // Was face-down but now revealed
      ];
      const result = enemy.onValidMatch([], board);

      expect(result.cardsToFlip).toContain('fd-1');
      expect(result.cardsToFlip).not.toContain('normal-1');
      expect(result.cardsToFlip).not.toContain('revealed-1');
    });

    it('ignores matched cards that are face-down (they are being removed)', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      jest.spyOn(Math, 'random').mockReturnValue(0.3);

      const matchedCard = createFaceDownCard({ id: 'matched-fd' });
      const boardCard = createFaceDownCard({ id: 'board-fd' });

      // Board is the remaining cards, matched cards are passed separately
      const result = enemy.onValidMatch([matchedCard], [boardCard]);

      expect(result.cardsToFlip).toContain('board-fd');
      // Matched card shouldn't be in board, so won't be flipped
    });

    it('maintains correct order of events', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      jest.spyOn(Math, 'random').mockReturnValue(0.3);

      const board = [
        createFaceDownCard({ id: 'fd-1' }),
        createFaceDownCard({ id: 'fd-2' }),
      ];
      const result = enemy.onValidMatch([], board);

      expect(result.events).toHaveLength(2);
      expect(result.events[0]).toEqual({ type: 'card_flipped', cardId: 'fd-1' });
      expect(result.events[1]).toEqual({ type: 'card_flipped', cardId: 'fd-2' });
    });
  });

  // ============================================================================
  // DEFEAT CONDITION TESTS
  // ============================================================================

  describe('defeat condition - checkDefeatCondition', () => {
    it('returns false when faceDownCardsMatched is 0', () => {
      const enemy = createNightOwl();
      const stats = createRoundStats({ faceDownCardsMatched: 0 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when faceDownCardsMatched is exactly 1', () => {
      const enemy = createNightOwl();
      const stats = createRoundStats({ faceDownCardsMatched: 1 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when faceDownCardsMatched is 2', () => {
      const enemy = createNightOwl();
      const stats = createRoundStats({ faceDownCardsMatched: 2 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when faceDownCardsMatched is 3', () => {
      const enemy = createNightOwl();
      const stats = createRoundStats({ faceDownCardsMatched: 3 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when faceDownCardsMatched is large (10)', () => {
      const enemy = createNightOwl();
      const stats = createRoundStats({ faceDownCardsMatched: 10 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when faceDownCardsMatched is very large (100)', () => {
      const enemy = createNightOwl();
      const stats = createRoundStats({ faceDownCardsMatched: 100 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('is independent of other stats - totalMatches', () => {
      const enemy = createNightOwl();
      const stats = createRoundStats({
        faceDownCardsMatched: 1,
        totalMatches: 50,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('is independent of other stats - invalidMatches', () => {
      const enemy = createNightOwl();
      const stats = createRoundStats({
        faceDownCardsMatched: 1,
        invalidMatches: 10,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('is independent of other stats - currentScore', () => {
      const enemy = createNightOwl();
      const stats = createRoundStats({
        faceDownCardsMatched: 0,
        currentScore: 1000,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('is independent of other stats - timeRemaining', () => {
      const enemy = createNightOwl();
      const stats = createRoundStats({
        faceDownCardsMatched: 0,
        timeRemaining: 1,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('uses >= 1 check, not == 1', () => {
      const enemy = createNightOwl();
      // Verify both 1 and higher values return true
      expect(enemy.checkDefeatCondition(createRoundStats({ faceDownCardsMatched: 1 }))).toBe(true);
      expect(enemy.checkDefeatCondition(createRoundStats({ faceDownCardsMatched: 5 }))).toBe(true);
    });
  });

  // ============================================================================
  // LIFECYCLE HOOKS - onRoundStart
  // ============================================================================

  describe('lifecycle - onRoundStart', () => {
    it('returns empty cardModifications', () => {
      const enemy = createNightOwl();
      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
    });

    it('returns empty events', () => {
      const enemy = createNightOwl();
      const result = enemy.onRoundStart([]);
      expect(result.events).toEqual([]);
    });

    it('does not modify existing board cards', () => {
      const enemy = createNightOwl();
      const board = createTestBoard(12);
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
    });

    it('accepts empty board', () => {
      const enemy = createNightOwl();
      const result = enemy.onRoundStart([]);
      expect(result).toEqual({ cardModifications: [], events: [] });
    });

    it('accepts board with face-down cards', () => {
      const enemy = createNightOwl();
      const board = [
        createFaceDownCard({ id: 'fd-1' }),
        createCard({ id: 'normal-1' }),
      ];
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
    });

    it('can be called multiple times (resets internal state)', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      enemy.onRoundStart([]);
      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });
  });

  // ============================================================================
  // LIFECYCLE HOOKS - onTick
  // ============================================================================

  describe('lifecycle - onTick', () => {
    it('returns zero scoreDelta', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      const result = enemy.onTick(1000, []);
      expect(result.scoreDelta).toBe(0);
    });

    it('returns zero healthDelta', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      const result = enemy.onTick(1000, []);
      expect(result.healthDelta).toBe(0);
    });

    it('returns zero timeDelta', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      const result = enemy.onTick(1000, []);
      expect(result.timeDelta).toBe(0);
    });

    it('returns empty cardsToRemove', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      const result = enemy.onTick(1000, []);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardModifications', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      const result = enemy.onTick(1000, []);
      expect(result.cardModifications).toEqual([]);
    });

    it('returns empty cardsToFlip', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      const result = enemy.onTick(1000, []);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      const result = enemy.onTick(1000, []);
      expect(result.events).toEqual([]);
    });

    it('returns false for instantDeath', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      const result = enemy.onTick(1000, []);
      expect(result.instantDeath).toBe(false);
    });

    it('handles small deltaMs (16ms frame)', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      const result = enemy.onTick(16, []);
      expect(result.scoreDelta).toBe(0);
      expect(result.healthDelta).toBe(0);
    });

    it('handles large deltaMs (60 seconds)', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      const result = enemy.onTick(60000, []);
      expect(result.scoreDelta).toBe(0);
      expect(result.healthDelta).toBe(0);
    });

    it('handles zero deltaMs', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      const result = enemy.onTick(0, []);
      expect(result.scoreDelta).toBe(0);
    });

    it('does not interact with face-down cards over time', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      const board = [createFaceDownCard({ id: 'fd-1' })];

      // Call onTick multiple times
      for (let i = 0; i < 10; i++) {
        const result = enemy.onTick(1000, board);
        expect(result.cardsToFlip).toEqual([]);
        expect(result.cardModifications).toEqual([]);
      }
    });
  });

  // ============================================================================
  // LIFECYCLE HOOKS - onInvalidMatch
  // ============================================================================

  describe('lifecycle - onInvalidMatch', () => {
    it('returns timeDelta of 0', () => {
      const enemy = createNightOwl();
      const result = enemy.onInvalidMatch([], []);
      expect(result.timeDelta).toBe(0);
    });

    it('returns pointsMultiplier of 1', () => {
      const enemy = createNightOwl();
      const result = enemy.onInvalidMatch([], []);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('returns empty cardsToRemove', () => {
      const enemy = createNightOwl();
      const result = enemy.onInvalidMatch([], []);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardsToFlip', () => {
      const enemy = createNightOwl();
      const result = enemy.onInvalidMatch([], []);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events', () => {
      const enemy = createNightOwl();
      const result = enemy.onInvalidMatch([], []);
      expect(result.events).toEqual([]);
    });

    it('does not flip face-down cards on invalid match', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      jest.spyOn(Math, 'random').mockReturnValue(0.3); // Would flip on valid match

      const board = [createFaceDownCard({ id: 'fd-1' })];
      const result = enemy.onInvalidMatch([], board);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('handles invalid match with face-down cards in attempted set', () => {
      const enemy = createNightOwl();
      const invalidCards = [
        createFaceDownCard({ id: 'fd-1' }),
        createCard({ id: 'normal-1' }),
        createCard({ id: 'normal-2' }),
      ];
      const result = enemy.onInvalidMatch(invalidCards, []);
      expect(result.cardsToFlip).toEqual([]);
    });
  });

  // ============================================================================
  // LIFECYCLE HOOKS - onRoundEnd
  // ============================================================================

  describe('lifecycle - onRoundEnd', () => {
    it('does not throw when called', () => {
      const enemy = createNightOwl();
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('can be called multiple times', () => {
      const enemy = createNightOwl();
      enemy.onRoundEnd();
      enemy.onRoundEnd();
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('does not affect subsequent onRoundStart', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);
      enemy.onRoundEnd();
      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
    });
  });

  // ============================================================================
  // UI MODIFIERS - getUIModifiers
  // ============================================================================

  describe('UI modifiers - getUIModifiers', () => {
    it('returns empty modifiers by default', () => {
      const enemy = createNightOwl();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers).toEqual({});
    });

    it('does not show inactivity bar', () => {
      const enemy = createNightOwl();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showInactivityBar).toBeUndefined();
    });

    it('does not show score decay', () => {
      const enemy = createNightOwl();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showScoreDecay).toBeUndefined();
    });

    it('does not modify timer speed', () => {
      const enemy = createNightOwl();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.timerSpeedMultiplier).toBeUndefined();
    });

    it('does not disable auto hint', () => {
      const enemy = createNightOwl();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableAutoHint).toBeUndefined();
    });

    it('does not disable manual hint', () => {
      const enemy = createNightOwl();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableManualHint).toBeUndefined();
    });

    it('does not show countdown cards', () => {
      const enemy = createNightOwl();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showCountdownCards).toBeUndefined();
    });

    it('does not show bomb cards', () => {
      const enemy = createNightOwl();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showBombCards).toBeUndefined();
    });

    it('does not show weapon counters', () => {
      const enemy = createNightOwl();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters).toBeUndefined();
    });

    it('returns consistent modifiers across calls', () => {
      const enemy = createNightOwl();
      const mod1 = enemy.getUIModifiers();
      const mod2 = enemy.getUIModifiers();
      expect(mod1).toEqual(mod2);
    });
  });

  // ============================================================================
  // STAT MODIFIERS - getStatModifiers
  // ============================================================================

  describe('stat modifiers - getStatModifiers', () => {
    it('returns empty modifiers by default', () => {
      const enemy = createNightOwl();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers).toEqual({});
    });

    it('does not reduce fire spread chance', () => {
      const enemy = createNightOwl();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
    });

    it('does not reduce explosion chance', () => {
      const enemy = createNightOwl();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.explosionChanceReduction).toBeUndefined();
    });

    it('does not reduce laser chance', () => {
      const enemy = createNightOwl();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.laserChanceReduction).toBeUndefined();
    });

    it('does not reduce hint gain chance', () => {
      const enemy = createNightOwl();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.hintGainChanceReduction).toBeUndefined();
    });

    it('does not reduce grace gain chance', () => {
      const enemy = createNightOwl();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.graceGainChanceReduction).toBeUndefined();
    });

    it('does not reduce time gain chance', () => {
      const enemy = createNightOwl();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.timeGainChanceReduction).toBeUndefined();
    });

    it('does not reduce healing chance', () => {
      const enemy = createNightOwl();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.healingChanceReduction).toBeUndefined();
    });

    it('does not have damage multiplier', () => {
      const enemy = createNightOwl();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.damageMultiplier).toBeUndefined();
    });

    it('does not have points multiplier', () => {
      const enemy = createNightOwl();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.pointsMultiplier).toBeUndefined();
    });

    it('returns consistent modifiers across calls', () => {
      const enemy = createNightOwl();
      const mod1 = enemy.getStatModifiers();
      const mod2 = enemy.getStatModifiers();
      expect(mod1).toEqual(mod2);
    });
  });

  // ============================================================================
  // INTEGRATION / SCENARIO TESTS
  // ============================================================================

  describe('integration scenarios', () => {
    it('complete round cycle: start, draw, tick, match, end', () => {
      const enemy = createNightOwl();
      jest.spyOn(Math, 'random').mockReturnValue(0.1);

      // Round start
      const startResult = enemy.onRoundStart(createTestBoard(12));
      expect(startResult.cardModifications).toEqual([]);

      // Card draw - should be face-down
      const drawnCard = enemy.onCardDraw(createCard({ id: 'new-card' }));
      expect(drawnCard.isFaceDown).toBe(true);

      // Tick - no effects
      const tickResult = enemy.onTick(1000, [drawnCard]);
      expect(tickResult.healthDelta).toBe(0);

      // Valid match - should flip face-down cards
      jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const matchResult = enemy.onValidMatch([], [drawnCard]);
      expect(matchResult.cardsToFlip).toContain('new-card');

      // Round end
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('multiple face-down cards with mixed flip results', () => {
      const enemy = createNightOwl();
      enemy.onRoundStart([]);

      // Create board with 5 face-down cards
      const board = [
        createFaceDownCard({ id: 'fd-1' }),
        createFaceDownCard({ id: 'fd-2' }),
        createFaceDownCard({ id: 'fd-3' }),
        createFaceDownCard({ id: 'fd-4' }),
        createFaceDownCard({ id: 'fd-5' }),
      ];

      // Mock random to flip cards 1, 3, 5 (odds pattern)
      const mockRandom = jest.spyOn(Math, 'random');
      mockRandom
        .mockReturnValueOnce(0.3)   // fd-1: flip (30% < 70%)
        .mockReturnValueOnce(0.85)  // fd-2: no flip (85% >= 70%)
        .mockReturnValueOnce(0.5)   // fd-3: flip (50% < 70%)
        .mockReturnValueOnce(0.9)   // fd-4: no flip (90% >= 70%)
        .mockReturnValueOnce(0.2);  // fd-5: flip (20% < 70%)

      const result = enemy.onValidMatch([], board);

      expect(result.cardsToFlip).toHaveLength(3);
      expect(result.cardsToFlip).toContain('fd-1');
      expect(result.cardsToFlip).not.toContain('fd-2');
      expect(result.cardsToFlip).toContain('fd-3');
      expect(result.cardsToFlip).not.toContain('fd-4');
      expect(result.cardsToFlip).toContain('fd-5');

      expect(result.events).toHaveLength(3);
    });

    it('defeat condition tracking through full game simulation', () => {
      const enemy = createNightOwl();
      const stats = createRoundStats();

      // Initially not defeated
      expect(enemy.checkDefeatCondition(stats)).toBe(false);

      // Simulate matches without face-down cards
      stats.totalMatches = 5;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);

      // Match a previously face-down card
      stats.faceDownCardsMatched = 1;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);

      // More face-down matches - still defeated
      stats.faceDownCardsMatched = 3;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('varied board maintains integrity through operations', () => {
      const enemy = createNightOwl();
      const board = createVariedBoard();

      // Start round
      enemy.onRoundStart(board);

      // Multiple ticks
      for (let i = 0; i < 10; i++) {
        const tickResult = enemy.onTick(1000, board);
        expect(tickResult.cardModifications).toEqual([]);
      }

      // UI and stat modifiers remain empty
      expect(enemy.getUIModifiers()).toEqual({});
      expect(enemy.getStatModifiers()).toEqual({});
    });

    it('handles empty board edge cases', () => {
      const enemy = createNightOwl();

      enemy.onRoundStart([]);
      expect(enemy.onTick(1000, [])).toMatchObject({ healthDelta: 0 });
      expect(enemy.onValidMatch([], [])).toMatchObject({ cardsToFlip: [] });
      expect(enemy.onInvalidMatch([], [])).toMatchObject({ cardsToFlip: [] });
    });

    it('new instance has independent state', () => {
      const enemy1 = createNightOwl();
      const enemy2 = createNightOwl();

      // Modify state of enemy1
      enemy1.onRoundStart([createFaceDownCard({ id: 'fd-1' })]);
      jest.spyOn(Math, 'random').mockReturnValue(0.3);
      enemy1.onValidMatch([], [createFaceDownCard({ id: 'fd-1' })]);

      // enemy2 should start fresh
      enemy2.onRoundStart([]);
      const result = enemy2.onValidMatch([], []);
      expect(result.cardsToFlip).toEqual([]);
    });
  });
});
