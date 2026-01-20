/**
 * Comprehensive Unit Tests for Trap Weaver enemy.
 *
 * Trap Weaver - Tier 1 Enemy
 * Effect: Starts with 1 bomb card (10s timer)
 * Defeat Condition: Defuse the bomb (match it before explosion)
 */
import { createTrapWeaver } from '@/utils/enemies/tier1/trapWeaver';
import {
  createRoundStats,
  createCard,
  createTestBoard,
  resetCardIdCounter,
  createFaceDownCard,
  createTripleCard,
} from '../../testUtils';

// Mock Math.random for deterministic tests
const mockRandom = (value: number) => {
  jest.spyOn(Math, 'random').mockReturnValue(value);
};

beforeEach(() => {
  resetCardIdCounter();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// =============================================================================
// METADATA TESTS
// =============================================================================

describe('Trap Weaver - Metadata', () => {
  describe('name', () => {
    it('has correct name', () => {
      const enemy = createTrapWeaver();
      expect(enemy.name).toBe('Trap Weaver');
    });

    it('name is a non-empty string', () => {
      const enemy = createTrapWeaver();
      expect(typeof enemy.name).toBe('string');
      expect(enemy.name.length).toBeGreaterThan(0);
    });
  });

  describe('tier', () => {
    it('has tier 1', () => {
      const enemy = createTrapWeaver();
      expect(enemy.tier).toBe(1);
    });

    it('tier is a valid tier value (1-4)', () => {
      const enemy = createTrapWeaver();
      expect([1, 2, 3, 4]).toContain(enemy.tier);
    });
  });

  describe('icon', () => {
    it('has correct icon', () => {
      const enemy = createTrapWeaver();
      expect(enemy.icon).toBe('carl-olsen/spider-face');
    });

    it('icon is a valid icon path format', () => {
      const enemy = createTrapWeaver();
      expect(enemy.icon).toMatch(/^[a-z-]+\/[a-z-]+$/);
    });
  });

  describe('description', () => {
    it('contains "bomb" keyword', () => {
      const enemy = createTrapWeaver();
      expect(enemy.description.toLowerCase()).toContain('bomb');
    });

    it('contains "10s" timer reference', () => {
      const enemy = createTrapWeaver();
      expect(enemy.description).toContain('10s');
    });

    it('mentions starting with 1 bomb', () => {
      const enemy = createTrapWeaver();
      expect(enemy.description).toContain('1 bomb');
    });

    it('is a non-empty string', () => {
      const enemy = createTrapWeaver();
      expect(typeof enemy.description).toBe('string');
      expect(enemy.description.length).toBeGreaterThan(0);
    });
  });

  describe('defeatConditionText', () => {
    it('contains "defuse" keyword', () => {
      const enemy = createTrapWeaver();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('defuse');
    });

    it('contains "bomb" keyword', () => {
      const enemy = createTrapWeaver();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('bomb');
    });

    it('mentions matching before explosion', () => {
      const enemy = createTrapWeaver();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('match');
    });

    it('is a non-empty string', () => {
      const enemy = createTrapWeaver();
      expect(typeof enemy.defeatConditionText).toBe('string');
      expect(enemy.defeatConditionText.length).toBeGreaterThan(0);
    });
  });

  describe('factory creates fresh instances', () => {
    it('each call returns a new instance', () => {
      const enemy1 = createTrapWeaver();
      const enemy2 = createTrapWeaver();
      expect(enemy1).not.toBe(enemy2);
    });

    it('instances have independent state', () => {
      const enemy1 = createTrapWeaver();
      const enemy2 = createTrapWeaver();

      const board = createTestBoard(6);
      mockRandom(0);
      enemy1.onRoundStart(board);

      // enemy2 should have clean state
      const board2 = createTestBoard(6);
      const result2 = enemy2.onRoundStart(board2);
      expect(result2.cardModifications).toHaveLength(1);
    });
  });
});

// =============================================================================
// EFFECT TESTS - BOMB SPAWNING
// =============================================================================

describe('Trap Weaver - Bomb Spawn Effect', () => {
  describe('onRoundStart spawns initial bomb', () => {
    it('spawns exactly one bomb card', () => {
      const enemy = createTrapWeaver();
      const board = createTestBoard(6);
      mockRandom(0);

      const result = enemy.onRoundStart(board);

      expect(result.cardModifications).toHaveLength(1);
    });

    it('sets hasBomb to true on spawned card', () => {
      const enemy = createTrapWeaver();
      const board = createTestBoard(6);
      mockRandom(0);

      const result = enemy.onRoundStart(board);

      expect(result.cardModifications[0].changes.hasBomb).toBe(true);
    });

    it('sets bombTimer to 10000ms', () => {
      const enemy = createTrapWeaver();
      const board = createTestBoard(6);
      mockRandom(0);

      const result = enemy.onRoundStart(board);

      expect(result.cardModifications[0].changes.bombTimer).toBe(10000);
    });

    it('selects first card when random returns 0', () => {
      const enemy = createTrapWeaver();
      const board = createTestBoard(6);
      mockRandom(0);

      const result = enemy.onRoundStart(board);

      expect(result.cardModifications[0].cardId).toBe(board[0].id);
    });

    it('selects last card when random returns 0.99', () => {
      const enemy = createTrapWeaver();
      const board = createTestBoard(6);
      mockRandom(0.99);

      const result = enemy.onRoundStart(board);

      expect(result.cardModifications[0].cardId).toBe(board[5].id);
    });

    it('returns empty events array', () => {
      const enemy = createTrapWeaver();
      const board = createTestBoard(6);

      const result = enemy.onRoundStart(board);

      expect(result.events).toEqual([]);
    });
  });

  describe('bomb spawn filtering', () => {
    it('does not place bomb on dud cards', () => {
      const enemy = createTrapWeaver();
      const board = [
        createCard({ isDud: true }),
        createCard({ isDud: true }),
        createCard(), // Only valid card
      ];
      mockRandom(0);

      const result = enemy.onRoundStart(board);

      expect(result.cardModifications[0].cardId).toBe(board[2].id);
    });

    it('does not place bomb on face-down cards', () => {
      const enemy = createTrapWeaver();
      const board = [
        createFaceDownCard(),
        createFaceDownCard(),
        createCard(), // Only valid card
      ];
      mockRandom(0);

      const result = enemy.onRoundStart(board);

      expect(result.cardModifications[0].cardId).toBe(board[2].id);
    });

    it('does not place bomb on cards that already have bombs', () => {
      const enemy = createTrapWeaver();
      const board = [
        createCard({ hasBomb: true }),
        createCard({ hasBomb: true }),
        createCard(), // Only valid card
      ];
      mockRandom(0);

      const result = enemy.onRoundStart(board);

      expect(result.cardModifications[0].cardId).toBe(board[2].id);
    });

    it('returns empty modifications if no valid cards exist', () => {
      const enemy = createTrapWeaver();
      const board = [
        createCard({ isDud: true }),
        createFaceDownCard(),
        createCard({ hasBomb: true }),
      ];

      const result = enemy.onRoundStart(board);

      expect(result.cardModifications).toHaveLength(0);
    });

    it('returns empty modifications on empty board', () => {
      const enemy = createTrapWeaver();
      const board: ReturnType<typeof createCard>[] = [];

      const result = enemy.onRoundStart(board);

      expect(result.cardModifications).toHaveLength(0);
    });
  });

  describe('onCardDraw does not add bombs (bombChance is 0)', () => {
    it('does not add bomb to drawn cards', () => {
      const enemy = createTrapWeaver();
      const card = createCard();

      const result = enemy.onCardDraw(card);

      expect(result.hasBomb).toBeUndefined();
    });

    it('returns same card unchanged', () => {
      const enemy = createTrapWeaver();
      const card = createCard({ shape: 'squiggle', color: 'green' });

      const result = enemy.onCardDraw(card);

      expect(result.shape).toBe('squiggle');
      expect(result.color).toBe('green');
    });

    it('preserves existing card properties', () => {
      const enemy = createTrapWeaver();
      const card = createCard({ health: 3, onFire: true });

      const result = enemy.onCardDraw(card);

      expect(result.health).toBe(3);
      expect(result.onFire).toBe(true);
    });
  });
});

// =============================================================================
// EFFECT TESTS - BOMB TIMER
// =============================================================================

describe('Trap Weaver - Bomb Timer Effect', () => {
  describe('bomb timer decrement on tick', () => {
    it('decrements bomb timer by deltaMs', () => {
      const enemy = createTrapWeaver();
      const bombCard = createCard({ id: 'bomb-card', hasBomb: true, bombTimer: 10000 });
      const board = [bombCard, ...createTestBoard(6)];

      // Initialize
      enemy.onTick(0, board);

      // Tick 3 seconds
      const result = enemy.onTick(3000, board);

      const modification = result.cardModifications.find((m) => m.cardId === 'bomb-card');
      expect(modification?.changes.bombTimer).toBe(7000);
    });

    it('decrements by small intervals', () => {
      const enemy = createTrapWeaver();
      const bombCard = createCard({ id: 'bomb-card', hasBomb: true, bombTimer: 10000 });
      const board = [bombCard, ...createTestBoard(6)];

      enemy.onTick(0, board);
      const result = enemy.onTick(100, board);

      const modification = result.cardModifications.find((m) => m.cardId === 'bomb-card');
      expect(modification?.changes.bombTimer).toBe(9900);
    });

    it('handles multiple sequential ticks', () => {
      const enemy = createTrapWeaver();
      const bombCard = createCard({ id: 'bomb-card', hasBomb: true, bombTimer: 10000 });
      const board = [bombCard, ...createTestBoard(6)];

      enemy.onTick(0, board);
      enemy.onTick(2000, board);
      enemy.onTick(3000, board);
      const result = enemy.onTick(1000, board);

      const modification = result.cardModifications.find((m) => m.cardId === 'bomb-card');
      expect(modification?.changes.bombTimer).toBe(4000);
    });

    it('timer does not go below 0', () => {
      const enemy = createTrapWeaver();
      const bombCard = createCard({ id: 'bomb-card', hasBomb: true, bombTimer: 1000 });
      const board = [bombCard, ...createTestBoard(6)];

      enemy.onTick(0, board);
      const result = enemy.onTick(500, board);

      const modification = result.cardModifications.find((m) => m.cardId === 'bomb-card');
      expect(modification?.changes.bombTimer).toBe(500);
    });

    it('tracks multiple bomb cards independently', () => {
      const enemy = createTrapWeaver();
      const bomb1 = createCard({ id: 'bomb-1', hasBomb: true, bombTimer: 10000 });
      const bomb2 = createCard({ id: 'bomb-2', hasBomb: true, bombTimer: 5000 });
      const board = [bomb1, bomb2, ...createTestBoard(5)];

      enemy.onTick(0, board);
      const result = enemy.onTick(2000, board);

      const mod1 = result.cardModifications.find((m) => m.cardId === 'bomb-1');
      const mod2 = result.cardModifications.find((m) => m.cardId === 'bomb-2');

      expect(mod1?.changes.bombTimer).toBe(8000);
      expect(mod2?.changes.bombTimer).toBe(3000);
    });
  });

  describe('bomb explosion', () => {
    it('explodes when timer reaches 0', () => {
      const enemy = createTrapWeaver();
      const bombCard = createCard({ id: 'bomb-card', hasBomb: true, bombTimer: 1000 });
      const board = [bombCard, ...createTestBoard(6)];

      enemy.onTick(0, board);
      const result = enemy.onTick(2000, board);

      expect(result.cardsToRemove).toContain('bomb-card');
    });

    it('emits bomb_exploded event on explosion', () => {
      const enemy = createTrapWeaver();
      const bombCard = createCard({ id: 'bomb-card', hasBomb: true, bombTimer: 1000 });
      const board = [bombCard, ...createTestBoard(6)];

      enemy.onTick(0, board);
      const result = enemy.onTick(2000, board);

      const explosionEvent = result.events.find((e) => e.type === 'bomb_exploded');
      expect(explosionEvent).toBeDefined();
      expect(explosionEvent?.type).toBe('bomb_exploded');
    });

    it('explosion event has correct cardId', () => {
      const enemy = createTrapWeaver();
      const bombCard = createCard({ id: 'bomb-card', hasBomb: true, bombTimer: 1000 });
      const board = [bombCard, ...createTestBoard(6)];

      enemy.onTick(0, board);
      const result = enemy.onTick(2000, board);

      const explosionEvent = result.events.find((e) => e.type === 'bomb_exploded');
      expect((explosionEvent as { cardId: string }).cardId).toBe('bomb-card');
    });

    it('does not explode if board would go below minimum size (6)', () => {
      const enemy = createTrapWeaver();
      const bombCard = createCard({ id: 'bomb-card', hasBomb: true, bombTimer: 1000 });
      const board = [bombCard, ...createTestBoard(5)]; // 6 cards total = minimum

      enemy.onTick(0, board);
      const result = enemy.onTick(2000, board);

      expect(result.cardsToRemove).not.toContain('bomb-card');
    });

    it('explodes if board is above minimum size', () => {
      const enemy = createTrapWeaver();
      const bombCard = createCard({ id: 'bomb-card', hasBomb: true, bombTimer: 1000 });
      const board = [bombCard, ...createTestBoard(6)]; // 7 cards total > minimum

      enemy.onTick(0, board);
      const result = enemy.onTick(2000, board);

      expect(result.cardsToRemove).toContain('bomb-card');
    });

    it('multiple bombs can explode in same tick', () => {
      const enemy = createTrapWeaver();
      const bomb1 = createCard({ id: 'bomb-1', hasBomb: true, bombTimer: 1000 });
      const bomb2 = createCard({ id: 'bomb-2', hasBomb: true, bombTimer: 1000 });
      const board = [bomb1, bomb2, ...createTestBoard(8)]; // 10 cards, plenty of room

      enemy.onTick(0, board);
      const result = enemy.onTick(2000, board);

      expect(result.cardsToRemove).toContain('bomb-1');
      expect(result.cardsToRemove).toContain('bomb-2');
    });
  });

  describe('bomb tracking cleanup', () => {
    it('removes bomb timer when card is removed from board', () => {
      const enemy = createTrapWeaver();
      const bombCard = createCard({ id: 'bomb-card', hasBomb: true, bombTimer: 10000 });
      const board = [bombCard, ...createTestBoard(6)];

      enemy.onTick(0, board);

      // Remove bomb card from board (simulating match)
      const newBoard = board.filter((c) => c.id !== 'bomb-card');
      const result = enemy.onTick(1000, newBoard);

      // Should not have any modification for the removed card
      const modification = result.cardModifications.find((m) => m.cardId === 'bomb-card');
      expect(modification).toBeUndefined();
    });
  });
});

// =============================================================================
// DEFEAT CONDITION TESTS
// =============================================================================

describe('Trap Weaver - Defeat Condition', () => {
  describe('bombsDefused threshold', () => {
    it('returns false when bombsDefused is 0', () => {
      const enemy = createTrapWeaver();
      const stats = createRoundStats({ bombsDefused: 0 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when bombsDefused is exactly 1 (threshold)', () => {
      const enemy = createTrapWeaver();
      const stats = createRoundStats({ bombsDefused: 1 });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when bombsDefused is 2', () => {
      const enemy = createTrapWeaver();
      const stats = createRoundStats({ bombsDefused: 2 });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when bombsDefused is 5', () => {
      const enemy = createTrapWeaver();
      const stats = createRoundStats({ bombsDefused: 5 });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when bombsDefused is 10', () => {
      const enemy = createTrapWeaver();
      const stats = createRoundStats({ bombsDefused: 10 });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when bombsDefused is 100', () => {
      const enemy = createTrapWeaver();
      const stats = createRoundStats({ bombsDefused: 100 });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  describe('defeat condition ignores other stats', () => {
    it('ignores totalMatches', () => {
      const enemy = createTrapWeaver();
      const stats = createRoundStats({ totalMatches: 100, bombsDefused: 0 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('ignores currentStreak', () => {
      const enemy = createTrapWeaver();
      const stats = createRoundStats({ currentStreak: 50, bombsDefused: 0 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('ignores currentScore', () => {
      const enemy = createTrapWeaver();
      const stats = createRoundStats({ currentScore: 1000, bombsDefused: 0 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('ignores timeRemaining', () => {
      const enemy = createTrapWeaver();
      const stats = createRoundStats({ timeRemaining: 0, bombsDefused: 0 });

      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('works with other stats at high values', () => {
      const enemy = createTrapWeaver();
      const stats = createRoundStats({
        totalMatches: 999,
        currentStreak: 50,
        maxStreak: 100,
        currentScore: 9999,
        bombsDefused: 1,
      });

      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});

// =============================================================================
// LIFECYCLE HOOKS TESTS
// =============================================================================

describe('Trap Weaver - Lifecycle Hooks', () => {
  describe('onRoundStart', () => {
    it('returns EnemyStartResult shape', () => {
      const enemy = createTrapWeaver();
      const board = createTestBoard(6);

      const result = enemy.onRoundStart(board);

      expect(result).toHaveProperty('cardModifications');
      expect(result).toHaveProperty('events');
      expect(Array.isArray(result.cardModifications)).toBe(true);
      expect(Array.isArray(result.events)).toBe(true);
    });

    it('can be called multiple times (fresh rounds)', () => {
      const enemy = createTrapWeaver();
      const board1 = createTestBoard(6);
      const board2 = createTestBoard(6);

      mockRandom(0);
      const result1 = enemy.onRoundStart(board1);
      const result2 = enemy.onRoundStart(board2);

      expect(result1.cardModifications).toHaveLength(1);
      expect(result2.cardModifications).toHaveLength(1);
    });
  });

  describe('onCardDraw', () => {
    it('returns a Card object', () => {
      const enemy = createTrapWeaver();
      const card = createCard();

      const result = enemy.onCardDraw(card);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('shape');
      expect(result).toHaveProperty('color');
      expect(result).toHaveProperty('number');
      expect(result).toHaveProperty('shading');
    });

    it('preserves all card properties', () => {
      const enemy = createTrapWeaver();
      const card = createCard({
        id: 'special-id',
        shape: 'diamond',
        color: 'purple',
        number: 3,
        shading: 'striped',
      });

      const result = enemy.onCardDraw(card);

      expect(result.id).toBe('special-id');
      expect(result.shape).toBe('diamond');
      expect(result.color).toBe('purple');
      expect(result.number).toBe(3);
      expect(result.shading).toBe('striped');
    });
  });

  describe('onValidMatch', () => {
    it('returns EnemyMatchResult shape', () => {
      const enemy = createTrapWeaver();

      const result = enemy.onValidMatch([], []);

      expect(result).toHaveProperty('timeDelta');
      expect(result).toHaveProperty('pointsMultiplier');
      expect(result).toHaveProperty('cardsToRemove');
      expect(result).toHaveProperty('cardsToFlip');
      expect(result).toHaveProperty('events');
    });

    it('returns neutral pointsMultiplier (1)', () => {
      const enemy = createTrapWeaver();

      const result = enemy.onValidMatch([], []);

      expect(result.pointsMultiplier).toBe(1);
    });

    it('returns neutral timeDelta (0)', () => {
      const enemy = createTrapWeaver();

      const result = enemy.onValidMatch([], []);

      expect(result.timeDelta).toBe(0);
    });

    it('returns empty cardsToRemove', () => {
      const enemy = createTrapWeaver();

      const result = enemy.onValidMatch([], []);

      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardsToFlip', () => {
      const enemy = createTrapWeaver();

      const result = enemy.onValidMatch([], []);

      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events', () => {
      const enemy = createTrapWeaver();

      const result = enemy.onValidMatch([], []);

      expect(result.events).toEqual([]);
    });

    it('handles matched cards parameter', () => {
      const enemy = createTrapWeaver();
      const matchedCards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(9);

      const result = enemy.onValidMatch(matchedCards, board);

      expect(result.pointsMultiplier).toBe(1);
    });
  });

  describe('onInvalidMatch', () => {
    it('returns EnemyMatchResult shape', () => {
      const enemy = createTrapWeaver();

      const result = enemy.onInvalidMatch([], []);

      expect(result).toHaveProperty('timeDelta');
      expect(result).toHaveProperty('pointsMultiplier');
      expect(result).toHaveProperty('cardsToRemove');
      expect(result).toHaveProperty('cardsToFlip');
      expect(result).toHaveProperty('events');
    });

    it('returns neutral pointsMultiplier (1)', () => {
      const enemy = createTrapWeaver();

      const result = enemy.onInvalidMatch([], []);

      expect(result.pointsMultiplier).toBe(1);
    });

    it('returns empty cardsToRemove', () => {
      const enemy = createTrapWeaver();

      const result = enemy.onInvalidMatch([], []);

      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardsToFlip', () => {
      const enemy = createTrapWeaver();

      const result = enemy.onInvalidMatch([], []);

      expect(result.cardsToFlip).toEqual([]);
    });

    it('handles invalid cards parameter', () => {
      const enemy = createTrapWeaver();
      const invalidCards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(9);

      const result = enemy.onInvalidMatch(invalidCards, board);

      expect(result.pointsMultiplier).toBe(1);
    });
  });

  describe('onRoundEnd', () => {
    it('can be called without error', () => {
      const enemy = createTrapWeaver();

      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('returns void (undefined)', () => {
      const enemy = createTrapWeaver();

      const result = enemy.onRoundEnd();

      expect(result).toBeUndefined();
    });

    it('can be called multiple times', () => {
      const enemy = createTrapWeaver();

      expect(() => {
        enemy.onRoundEnd();
        enemy.onRoundEnd();
        enemy.onRoundEnd();
      }).not.toThrow();
    });
  });

  describe('onTick', () => {
    it('returns EnemyTickResult shape', () => {
      const enemy = createTrapWeaver();
      const board = createTestBoard(6);

      const result = enemy.onTick(100, board);

      expect(result).toHaveProperty('scoreDelta');
      expect(result).toHaveProperty('healthDelta');
      expect(result).toHaveProperty('timeDelta');
      expect(result).toHaveProperty('cardsToRemove');
      expect(result).toHaveProperty('cardModifications');
      expect(result).toHaveProperty('cardsToFlip');
      expect(result).toHaveProperty('events');
      expect(result).toHaveProperty('instantDeath');
    });

    it('returns neutral scoreDelta (0)', () => {
      const enemy = createTrapWeaver();
      const board = createTestBoard(6);

      const result = enemy.onTick(100, board);

      expect(result.scoreDelta).toBe(0);
    });

    it('returns neutral healthDelta (0) with no bomb explosions', () => {
      const enemy = createTrapWeaver();
      const board = createTestBoard(6);

      const result = enemy.onTick(100, board);

      expect(result.healthDelta).toBe(0);
    });

    it('returns neutral timeDelta (0)', () => {
      const enemy = createTrapWeaver();
      const board = createTestBoard(6);

      const result = enemy.onTick(100, board);

      expect(result.timeDelta).toBe(0);
    });

    it('returns false instantDeath', () => {
      const enemy = createTrapWeaver();
      const board = createTestBoard(6);

      const result = enemy.onTick(100, board);

      expect(result.instantDeath).toBe(false);
    });

    it('handles zero deltaMs', () => {
      const enemy = createTrapWeaver();
      const board = createTestBoard(6);

      const result = enemy.onTick(0, board);

      expect(result.scoreDelta).toBe(0);
    });

    it('handles large deltaMs', () => {
      const enemy = createTrapWeaver();
      const board = createTestBoard(6);

      const result = enemy.onTick(60000, board);

      expect(result).toBeDefined();
    });
  });
});

// =============================================================================
// UI MODIFIERS TESTS
// =============================================================================

describe('Trap Weaver - UI Modifiers', () => {
  describe('getUIModifiers', () => {
    it('returns EnemyUIModifiers shape', () => {
      const enemy = createTrapWeaver();

      const modifiers = enemy.getUIModifiers();

      expect(typeof modifiers).toBe('object');
    });

    it('returns empty object when no bombs tracked', () => {
      const enemy = createTrapWeaver();

      const modifiers = enemy.getUIModifiers();

      // Before any bombs are tracked, showBombCards should not be set or empty
      expect(modifiers.showBombCards === undefined || modifiers.showBombCards?.length === 0).toBe(
        true
      );
    });

    it('shows bomb cards after tick initializes tracking', () => {
      const enemy = createTrapWeaver();
      const bombCard = createCard({ id: 'bomb-card', hasBomb: true, bombTimer: 10000 });
      const board = [bombCard, ...createTestBoard(6)];

      enemy.onTick(100, board);
      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showBombCards).toBeDefined();
      expect(modifiers.showBombCards?.length).toBeGreaterThan(0);
    });

    it('showBombCards has correct cardId', () => {
      const enemy = createTrapWeaver();
      const bombCard = createCard({ id: 'my-bomb', hasBomb: true, bombTimer: 10000 });
      const board = [bombCard, ...createTestBoard(6)];

      enemy.onTick(100, board);
      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showBombCards?.[0].cardId).toBe('my-bomb');
    });

    it('showBombCards has correct timeRemaining', () => {
      const enemy = createTrapWeaver();
      const bombCard = createCard({ id: 'bomb-card', hasBomb: true, bombTimer: 10000 });
      const board = [bombCard, ...createTestBoard(6)];

      enemy.onTick(0, board);
      enemy.onTick(3000, board);
      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showBombCards?.[0].timeRemaining).toBe(7000);
    });

    it('tracks multiple bomb cards in UI', () => {
      const enemy = createTrapWeaver();
      const bomb1 = createCard({ id: 'bomb-1', hasBomb: true, bombTimer: 10000 });
      const bomb2 = createCard({ id: 'bomb-2', hasBomb: true, bombTimer: 5000 });
      const board = [bomb1, bomb2, ...createTestBoard(5)];

      enemy.onTick(100, board);
      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showBombCards?.length).toBe(2);
    });

    it('does not show inactivity bar', () => {
      const enemy = createTrapWeaver();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showInactivityBar).toBeUndefined();
    });

    it('does not show score decay', () => {
      const enemy = createTrapWeaver();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.showScoreDecay).toBeUndefined();
    });

    it('does not disable hints', () => {
      const enemy = createTrapWeaver();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.disableAutoHint).toBeUndefined();
      expect(modifiers.disableManualHint).toBeUndefined();
    });

    it('does not modify timer speed', () => {
      const enemy = createTrapWeaver();

      const modifiers = enemy.getUIModifiers();

      expect(modifiers.timerSpeedMultiplier).toBeUndefined();
    });
  });
});

// =============================================================================
// STAT MODIFIERS TESTS
// =============================================================================

describe('Trap Weaver - Stat Modifiers', () => {
  describe('getStatModifiers', () => {
    it('returns EnemyStatModifiers shape', () => {
      const enemy = createTrapWeaver();

      const modifiers = enemy.getStatModifiers();

      expect(typeof modifiers).toBe('object');
    });

    it('returns empty object (no stat reductions)', () => {
      const enemy = createTrapWeaver();

      const modifiers = enemy.getStatModifiers();

      expect(Object.keys(modifiers).length).toBe(0);
    });

    it('does not reduce fire spread chance', () => {
      const enemy = createTrapWeaver();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
    });

    it('does not reduce explosion chance', () => {
      const enemy = createTrapWeaver();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.explosionChanceReduction).toBeUndefined();
    });

    it('does not reduce laser chance', () => {
      const enemy = createTrapWeaver();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.laserChanceReduction).toBeUndefined();
    });

    it('does not reduce hint gain chance', () => {
      const enemy = createTrapWeaver();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.hintGainChanceReduction).toBeUndefined();
    });

    it('does not reduce grace gain chance', () => {
      const enemy = createTrapWeaver();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.graceGainChanceReduction).toBeUndefined();
    });

    it('does not reduce time gain chance', () => {
      const enemy = createTrapWeaver();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.timeGainChanceReduction).toBeUndefined();
    });

    it('does not reduce healing chance', () => {
      const enemy = createTrapWeaver();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.healingChanceReduction).toBeUndefined();
    });

    it('does not modify damage multiplier', () => {
      const enemy = createTrapWeaver();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.damageMultiplier).toBeUndefined();
    });

    it('does not modify points multiplier', () => {
      const enemy = createTrapWeaver();

      const modifiers = enemy.getStatModifiers();

      expect(modifiers.pointsMultiplier).toBeUndefined();
    });
  });
});

// =============================================================================
// EDGE CASES AND INTEGRATION TESTS
// =============================================================================

describe('Trap Weaver - Edge Cases', () => {
  describe('board size edge cases', () => {
    it('handles single card board', () => {
      const enemy = createTrapWeaver();
      const board = [createCard()];
      mockRandom(0);

      const result = enemy.onRoundStart(board);

      expect(result.cardModifications).toHaveLength(1);
    });

    it('handles very large board', () => {
      const enemy = createTrapWeaver();
      const board = createTestBoard(100);
      mockRandom(0.5);

      const result = enemy.onRoundStart(board);

      expect(result.cardModifications).toHaveLength(1);
    });

    it('handles board with all special cards except one', () => {
      const enemy = createTrapWeaver();
      const board = [
        createCard({ isDud: true }),
        createCard({ isDud: true }),
        createFaceDownCard(),
        createFaceDownCard(),
        createCard({ hasBomb: true }),
        createCard(), // Only valid card
      ];
      mockRandom(0);

      const result = enemy.onRoundStart(board);

      expect(result.cardModifications).toHaveLength(1);
      expect(result.cardModifications[0].cardId).toBe(board[5].id);
    });
  });

  describe('timer edge cases', () => {
    it('handles exact timer expiry', () => {
      const enemy = createTrapWeaver();
      const bombCard = createCard({ id: 'bomb-card', hasBomb: true, bombTimer: 5000 });
      const board = [bombCard, ...createTestBoard(6)];

      enemy.onTick(0, board);
      const result = enemy.onTick(5000, board);

      expect(result.cardsToRemove).toContain('bomb-card');
    });

    it('handles very small tick intervals', () => {
      const enemy = createTrapWeaver();
      const bombCard = createCard({ id: 'bomb-card', hasBomb: true, bombTimer: 10000 });
      const board = [bombCard, ...createTestBoard(6)];

      enemy.onTick(0, board);

      // Many small ticks
      for (let i = 0; i < 100; i++) {
        enemy.onTick(10, board);
      }

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showBombCards?.[0].timeRemaining).toBe(9000);
    });
  });

  describe('state persistence', () => {
    it('maintains bomb tracking across valid matches', () => {
      const enemy = createTrapWeaver();
      const bombCard = createCard({ id: 'bomb-card', hasBomb: true, bombTimer: 10000 });
      const board = [bombCard, ...createTestBoard(6)];

      enemy.onTick(0, board);
      enemy.onTick(2000, board);
      enemy.onValidMatch([], board);
      enemy.onTick(1000, board);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showBombCards?.[0].timeRemaining).toBe(7000);
    });

    it('maintains bomb tracking across invalid matches', () => {
      const enemy = createTrapWeaver();
      const bombCard = createCard({ id: 'bomb-card', hasBomb: true, bombTimer: 10000 });
      const board = [bombCard, ...createTestBoard(6)];

      enemy.onTick(0, board);
      enemy.onTick(2000, board);
      enemy.onInvalidMatch([], board);
      enemy.onTick(1000, board);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showBombCards?.[0].timeRemaining).toBe(7000);
    });
  });

  describe('mixed card types', () => {
    it('works with triple cards on board', () => {
      const enemy = createTrapWeaver();
      const board = [
        createTripleCard(),
        createTripleCard(),
        createCard(),
        createCard(),
        createCard(),
        createCard(),
      ];
      mockRandom(0);

      const result = enemy.onRoundStart(board);

      expect(result.cardModifications).toHaveLength(1);
    });

    it('can place bomb on triple card', () => {
      const enemy = createTrapWeaver();
      const board = [createTripleCard(), ...createTestBoard(5)];
      mockRandom(0);

      const result = enemy.onRoundStart(board);

      expect(result.cardModifications[0].cardId).toBe(board[0].id);
      expect(result.cardModifications[0].changes.hasBomb).toBe(true);
    });

    it('works with onFire cards', () => {
      const enemy = createTrapWeaver();
      const board = [createCard({ onFire: true }), ...createTestBoard(5)];
      mockRandom(0);

      const result = enemy.onRoundStart(board);

      expect(result.cardModifications).toHaveLength(1);
    });
  });
});

describe('Trap Weaver - Full Round Simulation', () => {
  it('simulates a full round: spawn bomb, tick, defuse', () => {
    const enemy = createTrapWeaver();
    const board = createTestBoard(9);
    mockRandom(0);

    // Start round - bomb is placed
    const startResult = enemy.onRoundStart(board);
    expect(startResult.cardModifications).toHaveLength(1);
    const bombedCardId = startResult.cardModifications[0].cardId;

    // Apply bomb to board
    const bombedBoard = board.map((c) =>
      c.id === bombedCardId ? { ...c, hasBomb: true, bombTimer: 10000 } : c
    );

    // Tick 5 seconds
    enemy.onTick(0, bombedBoard);
    const tickResult = enemy.onTick(5000, bombedBoard);

    // Bomb should still be ticking (timer at 5000ms)
    const bombMod = tickResult.cardModifications.find((m) => m.cardId === bombedCardId);
    expect(bombMod?.changes.bombTimer).toBe(5000);

    // Player matches the bomb card (defuse)
    const matchedCards = bombedBoard.filter((c) => c.id === bombedCardId);
    const matchResult = enemy.onValidMatch(matchedCards, bombedBoard);

    // Check defeat condition - should be true if bombsDefused >= 1
    const stats = createRoundStats({ bombsDefused: 1 });
    expect(enemy.checkDefeatCondition(stats)).toBe(true);

    // Match result should be neutral
    expect(matchResult.pointsMultiplier).toBe(1);
    expect(matchResult.timeDelta).toBe(0);

    // End round
    enemy.onRoundEnd();
  });

  it('simulates bomb explosion scenario', () => {
    const enemy = createTrapWeaver();
    const board = createTestBoard(9);
    mockRandom(0);

    // Start round
    enemy.onRoundStart(board);
    const bombedCardId = board[0].id;

    // Apply bomb
    const bombedBoard = board.map((c) =>
      c.id === bombedCardId ? { ...c, hasBomb: true, bombTimer: 5000 } : c
    );

    // Initialize and tick to explosion
    enemy.onTick(0, bombedBoard);
    const explosionResult = enemy.onTick(6000, bombedBoard);

    // Bomb should explode
    expect(explosionResult.cardsToRemove).toContain(bombedCardId);
    expect(explosionResult.events.some((e) => e.type === 'bomb_exploded')).toBe(true);

    // Defeat condition not met (no defuse)
    const stats = createRoundStats({ bombsDefused: 0 });
    expect(enemy.checkDefeatCondition(stats)).toBe(false);
  });
});
