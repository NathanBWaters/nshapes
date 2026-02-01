/**
 * Comprehensive Unit Tests for Spiny Hedgehog Enemy
 *
 * Spiny Hedgehog - Tier 1 Enemy
 * Effect: Explosion effects reduced by 15%
 * Defeat Condition: Get 3 matches containing squiggles
 */
import { createSpinyHedgehog } from '@/utils/enemies/tier1/spinyHedgehog';
import { createRoundStats, createCard, createTestBoard, resetCardIdCounter } from '../../testUtils';

beforeEach(() => {
  resetCardIdCounter();
  jest.restoreAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ============================================================================
// METADATA TESTS (11 tests)
// ============================================================================

describe('Spiny Hedgehog', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createSpinyHedgehog();
      expect(enemy.name).toBe('Spiny Hedgehog');
    });

    it('name is a non-empty string', () => {
      const enemy = createSpinyHedgehog();
      expect(typeof enemy.name).toBe('string');
      expect(enemy.name.length).toBeGreaterThan(0);
    });

    it('has correct icon', () => {
      const enemy = createSpinyHedgehog();
      expect(enemy.icon).toBe('caro-asercion/hedgehog');
    });

    it('icon contains artist prefix', () => {
      const enemy = createSpinyHedgehog();
      expect(enemy.icon).toContain('/');
    });

    it('has correct tier', () => {
      const enemy = createSpinyHedgehog();
      expect(enemy.tier).toBe(1);
    });

    it('tier is a valid tier value (1-4)', () => {
      const enemy = createSpinyHedgehog();
      expect([1, 2, 3, 4]).toContain(enemy.tier);
    });

    it('has description mentioning explosion', () => {
      const enemy = createSpinyHedgehog();
      expect(enemy.description.toLowerCase()).toContain('explosion');
    });

    it('has description mentioning divided by 3', () => {
      const enemy = createSpinyHedgehog();
      expect(enemy.description).toContain('divided by 3');
    });

    it('has correct defeat condition text', () => {
      const enemy = createSpinyHedgehog();
      expect(enemy.defeatConditionText).toBe('Get 3 matches containing squiggles');
    });

    it('defeat condition text mentions squiggles', () => {
      const enemy = createSpinyHedgehog();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('squiggle');
    });

    it('defeat condition text mentions 3 matches', () => {
      const enemy = createSpinyHedgehog();
      expect(enemy.defeatConditionText).toContain('3');
    });
  });

  // ============================================================================
  // DEFEAT CONDITION TESTS (15 tests)
  // ============================================================================

  describe('defeat condition - checkDefeatCondition', () => {
    describe('boundary conditions', () => {
      it('returns false when squiggleMatches is 0', () => {
        const enemy = createSpinyHedgehog();
        const stats = createRoundStats({ squiggleMatches: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when squiggleMatches is 1', () => {
        const enemy = createSpinyHedgehog();
        const stats = createRoundStats({ squiggleMatches: 1 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when squiggleMatches is 2 (threshold - 1)', () => {
        const enemy = createSpinyHedgehog();
        const stats = createRoundStats({ squiggleMatches: 2 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true when squiggleMatches is exactly 3 (threshold)', () => {
        const enemy = createSpinyHedgehog();
        const stats = createRoundStats({ squiggleMatches: 3 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when squiggleMatches is 4 (above threshold)', () => {
        const enemy = createSpinyHedgehog();
        const stats = createRoundStats({ squiggleMatches: 4 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when squiggleMatches is 5', () => {
        const enemy = createSpinyHedgehog();
        const stats = createRoundStats({ squiggleMatches: 5 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when squiggleMatches is 10 (large value)', () => {
        const enemy = createSpinyHedgehog();
        const stats = createRoundStats({ squiggleMatches: 10 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when squiggleMatches is 100 (very large value)', () => {
        const enemy = createSpinyHedgehog();
        const stats = createRoundStats({ squiggleMatches: 100 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('independence from other stats', () => {
      it('ignores totalMatches when checking defeat', () => {
        const enemy = createSpinyHedgehog();
        const stats = createRoundStats({ squiggleMatches: 2, totalMatches: 100 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores currentStreak when checking defeat', () => {
        const enemy = createSpinyHedgehog();
        const stats = createRoundStats({ squiggleMatches: 3, currentStreak: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores invalidMatches when checking defeat', () => {
        const enemy = createSpinyHedgehog();
        const stats = createRoundStats({ squiggleMatches: 3, invalidMatches: 50 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores allDifferentMatches when checking defeat', () => {
        const enemy = createSpinyHedgehog();
        const stats = createRoundStats({ squiggleMatches: 2, allDifferentMatches: 10 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('ignores timeRemaining when checking defeat', () => {
        const enemy = createSpinyHedgehog();
        const stats = createRoundStats({ squiggleMatches: 3, timeRemaining: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores currentScore when checking defeat', () => {
        const enemy = createSpinyHedgehog();
        const stats = createRoundStats({ squiggleMatches: 3, currentScore: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('ignores damageReceived when checking defeat', () => {
        const enemy = createSpinyHedgehog();
        const stats = createRoundStats({ squiggleMatches: 3, damageReceived: 10 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });
  });

  // ============================================================================
  // WEAPON COUNTER EFFECT TESTS (12 tests)
  // ============================================================================

  describe('WeaponCounterEffect', () => {
    describe('getStatModifiers', () => {
      it('returns explosionChanceReduction of 15', () => {
        const enemy = createSpinyHedgehog();
        const modifiers = enemy.getStatModifiers();
        expect(modifiers.explosionChanceReduction).toBe(15);
      });

      it('does not modify fireSpreadChanceReduction', () => {
        const enemy = createSpinyHedgehog();
        const modifiers = enemy.getStatModifiers();
        expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
      });

      it('does not modify laserChanceReduction', () => {
        const enemy = createSpinyHedgehog();
        const modifiers = enemy.getStatModifiers();
        expect(modifiers.laserChanceReduction).toBeUndefined();
      });

      it('does not modify hintGainChanceReduction', () => {
        const enemy = createSpinyHedgehog();
        const modifiers = enemy.getStatModifiers();
        expect(modifiers.hintGainChanceReduction).toBeUndefined();
      });

      it('does not modify graceGainChanceReduction', () => {
        const enemy = createSpinyHedgehog();
        const modifiers = enemy.getStatModifiers();
        expect(modifiers.graceGainChanceReduction).toBeUndefined();
      });

      it('does not modify timeGainChanceReduction', () => {
        const enemy = createSpinyHedgehog();
        const modifiers = enemy.getStatModifiers();
        expect(modifiers.timeGainChanceReduction).toBeUndefined();
      });

      it('does not modify healingChanceReduction', () => {
        const enemy = createSpinyHedgehog();
        const modifiers = enemy.getStatModifiers();
        expect(modifiers.healingChanceReduction).toBeUndefined();
      });

      it('does not modify damageMultiplier', () => {
        const enemy = createSpinyHedgehog();
        const modifiers = enemy.getStatModifiers();
        expect(modifiers.damageMultiplier).toBeUndefined();
      });

      it('does not modify pointsMultiplier', () => {
        const enemy = createSpinyHedgehog();
        const modifiers = enemy.getStatModifiers();
        expect(modifiers.pointsMultiplier).toBeUndefined();
      });
    });

    describe('getUIModifiers', () => {
      it('returns weaponCounters array with explosion counter', () => {
        const enemy = createSpinyHedgehog();
        const modifiers = enemy.getUIModifiers();
        expect(modifiers.weaponCounters).toBeDefined();
        expect(Array.isArray(modifiers.weaponCounters)).toBe(true);
      });

      it('weaponCounters contains explosion type', () => {
        const enemy = createSpinyHedgehog();
        const modifiers = enemy.getUIModifiers();
        const explosionCounter = modifiers.weaponCounters?.find((c) => c.type === 'explosion');
        expect(explosionCounter).toBeDefined();
      });

      it('explosion counter has 15% reduction', () => {
        const enemy = createSpinyHedgehog();
        const modifiers = enemy.getUIModifiers();
        expect(modifiers.weaponCounters).toContainEqual({ type: 'explosion', reduction: 15 });
      });
    });
  });

  // ============================================================================
  // LIFECYCLE HOOK TESTS - onRoundStart (6 tests)
  // ============================================================================

  describe('lifecycle hooks - onRoundStart', () => {
    it('returns empty cardModifications array', () => {
      const enemy = createSpinyHedgehog();
      const board = createTestBoard(12);
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createSpinyHedgehog();
      const board = createTestBoard(12);
      const result = enemy.onRoundStart(board);
      expect(result.events).toEqual([]);
    });

    it('does not modify the input board', () => {
      const enemy = createSpinyHedgehog();
      const board = createTestBoard(12);
      const originalBoard = JSON.stringify(board);
      enemy.onRoundStart(board);
      expect(JSON.stringify(board)).toBe(originalBoard);
    });

    it('works with an empty board', () => {
      const enemy = createSpinyHedgehog();
      const result = enemy.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('works with a large board', () => {
      const enemy = createSpinyHedgehog();
      const board = createTestBoard(50);
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
      expect(result.events).toEqual([]);
    });

    it('can be called multiple times without side effects', () => {
      const enemy = createSpinyHedgehog();
      const board = createTestBoard(12);
      const result1 = enemy.onRoundStart(board);
      const result2 = enemy.onRoundStart(board);
      expect(result1).toEqual(result2);
    });
  });

  // ============================================================================
  // LIFECYCLE HOOK TESTS - onTick (8 tests)
  // ============================================================================

  describe('lifecycle hooks - onTick', () => {
    it('returns zero scoreDelta', () => {
      const enemy = createSpinyHedgehog();
      enemy.onRoundStart([]);
      const result = enemy.onTick(1000, []);
      expect(result.scoreDelta).toBe(0);
    });

    it('returns zero healthDelta', () => {
      const enemy = createSpinyHedgehog();
      enemy.onRoundStart([]);
      const result = enemy.onTick(1000, []);
      expect(result.healthDelta).toBe(0);
    });

    it('returns zero timeDelta', () => {
      const enemy = createSpinyHedgehog();
      enemy.onRoundStart([]);
      const result = enemy.onTick(1000, []);
      expect(result.timeDelta).toBe(0);
    });

    it('returns instantDeath as false', () => {
      const enemy = createSpinyHedgehog();
      enemy.onRoundStart([]);
      const result = enemy.onTick(1000, []);
      expect(result.instantDeath).toBe(false);
    });

    it('returns empty cardsToRemove array', () => {
      const enemy = createSpinyHedgehog();
      enemy.onRoundStart([]);
      const result = enemy.onTick(1000, []);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardModifications array', () => {
      const enemy = createSpinyHedgehog();
      enemy.onRoundStart([]);
      const result = enemy.onTick(1000, []);
      expect(result.cardModifications).toEqual([]);
    });

    it('returns empty cardsToFlip array', () => {
      const enemy = createSpinyHedgehog();
      enemy.onRoundStart([]);
      const result = enemy.onTick(1000, []);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createSpinyHedgehog();
      enemy.onRoundStart([]);
      const result = enemy.onTick(1000, []);
      expect(result.events).toEqual([]);
    });
  });

  // ============================================================================
  // LIFECYCLE HOOK TESTS - onValidMatch (8 tests)
  // ============================================================================

  describe('lifecycle hooks - onValidMatch', () => {
    it('returns pointsMultiplier of 1', () => {
      const enemy = createSpinyHedgehog();
      const matchedCards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('returns zero timeDelta', () => {
      const enemy = createSpinyHedgehog();
      const matchedCards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.timeDelta).toBe(0);
    });

    it('returns empty cardsToRemove array', () => {
      const enemy = createSpinyHedgehog();
      const matchedCards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardsToFlip array', () => {
      const enemy = createSpinyHedgehog();
      const matchedCards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createSpinyHedgehog();
      const matchedCards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.events).toEqual([]);
    });

    it('works with squiggle cards matched', () => {
      const enemy = createSpinyHedgehog();
      const matchedCards = [
        createCard({ shape: 'squiggle' }),
        createCard({ shape: 'squiggle' }),
        createCard({ shape: 'squiggle' }),
      ];
      const board = createTestBoard(12);
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('works with an empty board', () => {
      const enemy = createSpinyHedgehog();
      const matchedCards = [createCard(), createCard(), createCard()];
      const result = enemy.onValidMatch(matchedCards, []);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('does not modify matched cards', () => {
      const enemy = createSpinyHedgehog();
      const matchedCards = [createCard(), createCard(), createCard()];
      const originalCards = JSON.stringify(matchedCards);
      enemy.onValidMatch(matchedCards, []);
      expect(JSON.stringify(matchedCards)).toBe(originalCards);
    });
  });

  // ============================================================================
  // LIFECYCLE HOOK TESTS - onInvalidMatch (8 tests)
  // ============================================================================

  describe('lifecycle hooks - onInvalidMatch', () => {
    it('returns pointsMultiplier of 1', () => {
      const enemy = createSpinyHedgehog();
      const cards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onInvalidMatch(cards, board);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('returns zero timeDelta', () => {
      const enemy = createSpinyHedgehog();
      const cards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onInvalidMatch(cards, board);
      expect(result.timeDelta).toBe(0);
    });

    it('returns empty cardsToRemove array', () => {
      const enemy = createSpinyHedgehog();
      const cards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onInvalidMatch(cards, board);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardsToFlip array', () => {
      const enemy = createSpinyHedgehog();
      const cards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onInvalidMatch(cards, board);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createSpinyHedgehog();
      const cards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onInvalidMatch(cards, board);
      expect(result.events).toEqual([]);
    });

    it('works with an empty board', () => {
      const enemy = createSpinyHedgehog();
      const cards = [createCard(), createCard(), createCard()];
      const result = enemy.onInvalidMatch(cards, []);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('does not modify input cards', () => {
      const enemy = createSpinyHedgehog();
      const cards = [createCard(), createCard(), createCard()];
      const originalCards = JSON.stringify(cards);
      enemy.onInvalidMatch(cards, []);
      expect(JSON.stringify(cards)).toBe(originalCards);
    });

    it('handles invalid match with squiggle cards', () => {
      const enemy = createSpinyHedgehog();
      const cards = [
        createCard({ shape: 'squiggle' }),
        createCard({ shape: 'squiggle' }),
        createCard({ shape: 'oval' }),
      ];
      const result = enemy.onInvalidMatch(cards, []);
      expect(result.cardsToRemove).toEqual([]);
    });
  });

  // ============================================================================
  // LIFECYCLE HOOK TESTS - onCardDraw (6 tests)
  // ============================================================================

  describe('lifecycle hooks - onCardDraw', () => {
    it('returns the same card unmodified', () => {
      const enemy = createSpinyHedgehog();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result).toEqual(card);
    });

    it('does not add isDud property', () => {
      const enemy = createSpinyHedgehog();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isDud).toBeUndefined();
    });

    it('does not add isFaceDown property', () => {
      const enemy = createSpinyHedgehog();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isFaceDown).toBeUndefined();
    });

    it('does not add hasBomb property', () => {
      const enemy = createSpinyHedgehog();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.hasBomb).toBeUndefined();
    });

    it('does not add hasCountdown property', () => {
      const enemy = createSpinyHedgehog();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.hasCountdown).toBeUndefined();
    });

    it('preserves all original card properties', () => {
      const enemy = createSpinyHedgehog();
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
  });

  // ============================================================================
  // LIFECYCLE HOOK TESTS - onRoundEnd (4 tests)
  // ============================================================================

  describe('lifecycle hooks - onRoundEnd', () => {
    it('does not throw when called', () => {
      const enemy = createSpinyHedgehog();
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('returns undefined', () => {
      const enemy = createSpinyHedgehog();
      const result = enemy.onRoundEnd();
      expect(result).toBeUndefined();
    });

    it('can be called multiple times without error', () => {
      const enemy = createSpinyHedgehog();
      expect(() => {
        enemy.onRoundEnd();
        enemy.onRoundEnd();
        enemy.onRoundEnd();
      }).not.toThrow();
    });

    it('can be called after onRoundStart', () => {
      const enemy = createSpinyHedgehog();
      enemy.onRoundStart([]);
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });
  });

  // ============================================================================
  // UI MODIFIERS TESTS (6 tests)
  // ============================================================================

  describe('getUIModifiers', () => {
    it('does not show inactivity bar', () => {
      const enemy = createSpinyHedgehog();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showInactivityBar).toBeUndefined();
    });

    it('does not show score decay', () => {
      const enemy = createSpinyHedgehog();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showScoreDecay).toBeUndefined();
    });

    it('does not modify timer speed', () => {
      const enemy = createSpinyHedgehog();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.timerSpeedMultiplier).toBeUndefined();
    });

    it('does not disable auto hint', () => {
      const enemy = createSpinyHedgehog();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableAutoHint).toBeUndefined();
    });

    it('does not disable manual hint', () => {
      const enemy = createSpinyHedgehog();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableManualHint).toBeUndefined();
    });

    it('does not show countdown cards', () => {
      const enemy = createSpinyHedgehog();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showCountdownCards).toBeUndefined();
    });
  });

  // ============================================================================
  // FACTORY/INSTANCE TESTS (7 tests)
  // ============================================================================

  describe('factory and instance behavior', () => {
    it('creates a new instance each time', () => {
      const enemy1 = createSpinyHedgehog();
      const enemy2 = createSpinyHedgehog();
      expect(enemy1).not.toBe(enemy2);
    });

    it('instances have independent state', () => {
      const enemy1 = createSpinyHedgehog();
      const enemy2 = createSpinyHedgehog();
      enemy1.onRoundStart([]);
      // enemy2 should not be affected
      const result = enemy2.onRoundStart([]);
      expect(result.cardModifications).toEqual([]);
    });

    it('has all required EnemyInstance properties', () => {
      const enemy = createSpinyHedgehog();
      expect(enemy).toHaveProperty('name');
      expect(enemy).toHaveProperty('icon');
      expect(enemy).toHaveProperty('tier');
      expect(enemy).toHaveProperty('description');
      expect(enemy).toHaveProperty('defeatConditionText');
    });

    it('has all required EnemyInstance methods', () => {
      const enemy = createSpinyHedgehog();
      expect(typeof enemy.onRoundStart).toBe('function');
      expect(typeof enemy.onTick).toBe('function');
      expect(typeof enemy.onValidMatch).toBe('function');
      expect(typeof enemy.onInvalidMatch).toBe('function');
      expect(typeof enemy.onCardDraw).toBe('function');
      expect(typeof enemy.checkDefeatCondition).toBe('function');
      expect(typeof enemy.onRoundEnd).toBe('function');
      expect(typeof enemy.getUIModifiers).toBe('function');
      expect(typeof enemy.getStatModifiers).toBe('function');
    });

    it('modifiers are consistent between calls', () => {
      const enemy = createSpinyHedgehog();
      const modifiers1 = enemy.getStatModifiers();
      const modifiers2 = enemy.getStatModifiers();
      expect(modifiers1).toEqual(modifiers2);
    });

    it('UI modifiers are consistent between calls', () => {
      const enemy = createSpinyHedgehog();
      const modifiers1 = enemy.getUIModifiers();
      const modifiers2 = enemy.getUIModifiers();
      expect(modifiers1).toEqual(modifiers2);
    });

    it('checkDefeatCondition is a pure function', () => {
      const enemy = createSpinyHedgehog();
      const stats = createRoundStats({ squiggleMatches: 3 });
      const result1 = enemy.checkDefeatCondition(stats);
      const result2 = enemy.checkDefeatCondition(stats);
      expect(result1).toBe(result2);
      expect(result1).toBe(true);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS (5 tests)
  // ============================================================================

  describe('integration scenarios', () => {
    it('full round lifecycle works correctly', () => {
      const enemy = createSpinyHedgehog();
      const board = createTestBoard(12);

      // Start round
      const startResult = enemy.onRoundStart(board);
      expect(startResult.cardModifications).toEqual([]);

      // Tick
      const tickResult = enemy.onTick(1000, board);
      expect(tickResult.healthDelta).toBe(0);

      // Valid match
      const matchResult = enemy.onValidMatch([board[0], board[1], board[2]], board);
      expect(matchResult.pointsMultiplier).toBe(1);

      // End round
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('defeat condition progresses correctly over multiple matches', () => {
      const enemy = createSpinyHedgehog();
      const stats = createRoundStats();

      expect(enemy.checkDefeatCondition(stats)).toBe(false);

      stats.squiggleMatches = 1;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);

      stats.squiggleMatches = 2;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);

      stats.squiggleMatches = 3;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('weapon counter effect persists through round', () => {
      const enemy = createSpinyHedgehog();
      const board = createTestBoard(12);

      enemy.onRoundStart(board);

      const modifiersBefore = enemy.getStatModifiers();
      expect(modifiersBefore.explosionChanceReduction).toBe(15);

      enemy.onTick(1000, board);
      enemy.onValidMatch([board[0], board[1], board[2]], board);

      const modifiersAfter = enemy.getStatModifiers();
      expect(modifiersAfter.explosionChanceReduction).toBe(15);
    });

    it('handles rapid tick calls correctly', () => {
      const enemy = createSpinyHedgehog();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      for (let i = 0; i < 100; i++) {
        const result = enemy.onTick(16, board); // 60fps tick rate
        expect(result.healthDelta).toBe(0);
        expect(result.instantDeath).toBe(false);
      }
    });

    it('handles multiple matches in sequence correctly', () => {
      const enemy = createSpinyHedgehog();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      for (let i = 0; i < 10; i++) {
        const result = enemy.onValidMatch([createCard(), createCard(), createCard()], board);
        expect(result.pointsMultiplier).toBe(1);
        expect(result.timeDelta).toBe(0);
      }
    });
  });
});
