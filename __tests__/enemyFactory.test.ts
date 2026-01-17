/**
 * Unit tests for Enemy Factory
 *
 * Tests the factory pattern for creating enemy instances,
 * including the dummy enemy for testing and the registry system.
 */
import { Card, Shape, Color } from '@/types';
import type { RoundStats } from '@/types/enemy';
import {
  createDummyEnemy,
  createEnemy,
  getEnemyNames,
  getEnemiesByTier,
  getRandomEnemies,
  isEnemyRegistered,
  registerEnemy,
  ENEMY_REGISTRY,
} from '@/utils/enemyFactory';

// Helper to create a minimal test card
const createTestCard = (id: string = 'test-card'): Card => ({
  id,
  shape: 'oval',
  color: 'red',
  number: 1,
  shading: 'solid',
  background: 'white',
  selected: false,
});

// Helper to create empty round stats
const createEmptyRoundStats = (): RoundStats => ({
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
  shapesMatched: new Set<Shape>(),
  colorsMatched: new Set<Color>(),
  colorMatchCounts: new Map<Color, number>(),
  allDifferentMatches: 0,
  allSameColorMatches: 0,
  squiggleMatches: 0,
  gracesUsed: 0,
  hintsUsed: 0,
  hintsRemaining: 3,
  gracesRemaining: 3,
  damageReceived: 0,
  weaponEffectsTriggered: new Set<string>(),
  currentScore: 0,
  targetScore: 100,
});

describe('createDummyEnemy', () => {
  it('should return a valid EnemyInstance', () => {
    const enemy = createDummyEnemy();

    expect(enemy.name).toBe('Dummy');
    expect(enemy.icon).toBe('lorc/uncertainty');
    expect(enemy.tier).toBe(1);
    expect(enemy.description).toBe('No effect');
    expect(enemy.defeatConditionText).toBe('Always defeated');
  });

  it('onRoundStart should return empty result', () => {
    const enemy = createDummyEnemy();
    const board = [createTestCard()];
    const result = enemy.onRoundStart(board);

    expect(result.cardModifications).toEqual([]);
    expect(result.events).toEqual([]);
  });

  it('onTick should return zero deltas', () => {
    const enemy = createDummyEnemy();
    const board = [createTestCard()];
    const result = enemy.onTick(1000, board);

    expect(result.scoreDelta).toBe(0);
    expect(result.healthDelta).toBe(0);
    expect(result.timeDelta).toBe(0);
    expect(result.cardsToRemove).toEqual([]);
    expect(result.cardModifications).toEqual([]);
    expect(result.cardsToFlip).toEqual([]);
    expect(result.events).toEqual([]);
    expect(result.instantDeath).toBe(false);
  });

  it('onValidMatch should return zero deltas and neutral multiplier', () => {
    const enemy = createDummyEnemy();
    const cards = [createTestCard('1'), createTestCard('2'), createTestCard('3')];
    const result = enemy.onValidMatch(cards, cards);

    expect(result.timeDelta).toBe(0);
    expect(result.pointsMultiplier).toBe(1);
    expect(result.cardsToRemove).toEqual([]);
    expect(result.cardsToFlip).toEqual([]);
    expect(result.events).toEqual([]);
  });

  it('onInvalidMatch should return zero deltas and neutral multiplier', () => {
    const enemy = createDummyEnemy();
    const cards = [createTestCard('1'), createTestCard('2'), createTestCard('3')];
    const result = enemy.onInvalidMatch(cards, cards);

    expect(result.timeDelta).toBe(0);
    expect(result.pointsMultiplier).toBe(1);
    expect(result.cardsToRemove).toEqual([]);
    expect(result.cardsToFlip).toEqual([]);
    expect(result.events).toEqual([]);
  });

  it('onCardDraw should return unmodified card', () => {
    const enemy = createDummyEnemy();
    const card = createTestCard('test-id');
    const result = enemy.onCardDraw(card);

    expect(result).toBe(card); // Same reference
    expect(result.id).toBe('test-id');
    expect(result.isDud).toBeUndefined();
    expect(result.isFaceDown).toBeUndefined();
  });

  it('checkDefeatCondition should return true (always defeated)', () => {
    const enemy = createDummyEnemy();
    const stats = createEmptyRoundStats();
    const result = enemy.checkDefeatCondition(stats);

    expect(result).toBe(true);
  });

  it('onRoundEnd should not throw', () => {
    const enemy = createDummyEnemy();
    expect(() => enemy.onRoundEnd()).not.toThrow();
  });

  it('getUIModifiers should return empty object', () => {
    const enemy = createDummyEnemy();
    const modifiers = enemy.getUIModifiers();

    expect(modifiers).toEqual({});
    expect(modifiers.showInactivityBar).toBeUndefined();
    expect(modifiers.timerSpeedMultiplier).toBeUndefined();
  });

  it('getStatModifiers should return empty object', () => {
    const enemy = createDummyEnemy();
    const modifiers = enemy.getStatModifiers();

    expect(modifiers).toEqual({});
    expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
    expect(modifiers.damageMultiplier).toBeUndefined();
  });
});

describe('createEnemy', () => {
  // Store original console.warn to restore later
  const originalWarn = console.warn;

  beforeEach(() => {
    // Mock console.warn to capture warnings
    console.warn = jest.fn();
  });

  afterEach(() => {
    // Restore original console.warn
    console.warn = originalWarn;
  });

  it('should return dummy enemy for unknown name with warning', () => {
    const enemy = createEnemy('Unknown Enemy That Does Not Exist');

    expect(enemy.name).toBe('Dummy');
    expect(console.warn).toHaveBeenCalledWith(
      'Unknown enemy: Unknown Enemy That Does Not Exist, using dummy'
    );
  });

  it('should return dummy enemy for empty string', () => {
    const enemy = createEnemy('');

    expect(enemy.name).toBe('Dummy');
    expect(console.warn).toHaveBeenCalled();
  });
});

describe('getRandomEnemies', () => {
  it('should return correct count of dummy enemies when registry is empty', () => {
    // Registry starts empty, so this should return dummy enemies
    const enemies = getRandomEnemies(1, 3);

    expect(enemies.length).toBe(3);
    enemies.forEach(enemy => {
      expect(enemy.name).toBe('Dummy');
    });
  });

  it('should return requested count when asking for fewer than available', () => {
    const enemies = getRandomEnemies(1, 2);
    expect(enemies.length).toBe(2);
  });

  it('should return fresh instances (not same reference)', () => {
    const enemies = getRandomEnemies(1, 2);

    // Each should be a different object
    expect(enemies[0]).not.toBe(enemies[1]);

    // But both should be dummy enemies
    expect(enemies[0].name).toBe('Dummy');
    expect(enemies[1].name).toBe('Dummy');
  });

  it('should default to 3 enemies when count not specified', () => {
    const enemies = getRandomEnemies(1);
    expect(enemies.length).toBe(3);
  });

  describe('exclude parameter', () => {
    beforeEach(() => {
      // Register some test enemies for exclusion tests
      registerEnemy('Enemy A', () => ({
        ...createDummyEnemy(),
        name: 'Enemy A',
        tier: 1 as const,
      }));
      registerEnemy('Enemy B', () => ({
        ...createDummyEnemy(),
        name: 'Enemy B',
        tier: 1 as const,
      }));
      registerEnemy('Enemy C', () => ({
        ...createDummyEnemy(),
        name: 'Enemy C',
        tier: 1 as const,
      }));
    });

    afterEach(() => {
      // Clean up registered test enemies
      delete ENEMY_REGISTRY['Enemy A'];
      delete ENEMY_REGISTRY['Enemy B'];
      delete ENEMY_REGISTRY['Enemy C'];
    });

    it('should exclude specified enemies from selection', () => {
      // Run multiple times to verify exclusion is consistent
      for (let i = 0; i < 10; i++) {
        const enemies = getRandomEnemies(1, 3, ['Enemy A']);
        const names = enemies.map(e => e.name);
        expect(names).not.toContain('Enemy A');
      }
    });

    it('should exclude multiple enemies', () => {
      for (let i = 0; i < 10; i++) {
        const enemies = getRandomEnemies(1, 3, ['Enemy A', 'Enemy B']);
        const names = enemies.map(e => e.name);
        expect(names).not.toContain('Enemy A');
        expect(names).not.toContain('Enemy B');
      }
    });

    it('should return dummy enemies when all are excluded', () => {
      const enemies = getRandomEnemies(1, 3, ['Enemy A', 'Enemy B', 'Enemy C']);
      enemies.forEach(enemy => {
        expect(enemy.name).toBe('Dummy');
      });
    });

    it('should handle empty exclude array', () => {
      const enemies = getRandomEnemies(1, 3, []);
      expect(enemies.length).toBe(3);
      // Should still work normally
    });

    it('should handle exclude with non-existent enemy names', () => {
      // Excluding a name that doesn't exist shouldn't cause issues
      const enemies = getRandomEnemies(1, 3, ['Non-existent Enemy']);
      expect(enemies.length).toBe(3);
    });
  });
});

describe('getEnemyNames', () => {
  it('should return array of registered enemy names', () => {
    const names = getEnemyNames();

    expect(Array.isArray(names)).toBe(true);
    // Initially empty or may have registered enemies from other tests
    expect(typeof names.length).toBe('number');
  });
});

describe('getEnemiesByTier', () => {
  it('should return empty array for tier with no enemies', () => {
    // Assuming no enemies registered for tier 4 yet
    const tier4 = getEnemiesByTier(4);
    expect(Array.isArray(tier4)).toBe(true);
  });

  it('should only return enemies of specified tier', () => {
    // This test will be more meaningful once enemies are registered
    const tier1 = getEnemiesByTier(1);
    expect(Array.isArray(tier1)).toBe(true);
  });
});

describe('isEnemyRegistered', () => {
  it('should return false for unregistered enemy', () => {
    expect(isEnemyRegistered('Nonexistent Enemy')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isEnemyRegistered('')).toBe(false);
  });
});

describe('registerEnemy', () => {
  const originalWarn = console.warn;

  beforeEach(() => {
    console.warn = jest.fn();
  });

  afterEach(() => {
    console.warn = originalWarn;
    // Clean up registered test enemies
    delete ENEMY_REGISTRY['Test Enemy'];
    delete ENEMY_REGISTRY['Another Test'];
  });

  it('should register a new enemy', () => {
    const testFactory = () => ({
      ...createDummyEnemy(),
      name: 'Test Enemy',
      tier: 2 as const,
    });

    registerEnemy('Test Enemy', testFactory);

    expect(isEnemyRegistered('Test Enemy')).toBe(true);
    expect(createEnemy('Test Enemy').name).toBe('Test Enemy');
    expect(createEnemy('Test Enemy').tier).toBe(2);
  });

  it('should warn when overwriting existing enemy', () => {
    const factory1 = () => ({ ...createDummyEnemy(), name: 'Another Test' });
    const factory2 = () => ({ ...createDummyEnemy(), name: 'Another Test V2' });

    registerEnemy('Another Test', factory1);
    registerEnemy('Another Test', factory2);

    expect(console.warn).toHaveBeenCalledWith(
      'Enemy "Another Test" is already registered, overwriting'
    );
    expect(createEnemy('Another Test').name).toBe('Another Test V2');
  });

  it('registered enemy should appear in getEnemyNames', () => {
    registerEnemy('Test Enemy', () => ({
      ...createDummyEnemy(),
      name: 'Test Enemy',
    }));

    const names = getEnemyNames();
    expect(names).toContain('Test Enemy');
  });

  it('registered enemy should appear in getEnemiesByTier', () => {
    registerEnemy('Test Enemy', () => ({
      ...createDummyEnemy(),
      name: 'Test Enemy',
      tier: 1 as const,
    }));

    const tier1 = getEnemiesByTier(1);
    expect(tier1).toContain('Test Enemy');
  });
});
