/**
 * Unit tests for Enemy Factory
 *
 * Tests the factory pattern for creating enemy instances,
 * including the dummy enemy for testing and the registry system.
 */
import { Card, Shape, Color } from '@/types';
import type { RoundStats } from '@/types/enemy';
import { createDummyEnemy } from '@/utils/enemyEffects';
import {
  createEnemy,
  getEnemyNames,
  getEnemiesByTier,
  getRandomEnemies,
  isEnemyRegistered,
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
  timeGainTriggersThisRound: 0,
  timeGainTriggerCapBonus: 0,
  consecutiveInvalidMatches: 0,
  prismaticPerfectionTriggered: false,
  tabulaRasaTriggered: false,
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
  it('returns the requested number of distinct enemies from the tier', () => {
    const enemies = getRandomEnemies(1, 3);

    expect(enemies.length).toBe(3);
    expect(new Set(enemies.map(e => e.name)).size).toBe(3);
    enemies.forEach(enemy => expect(enemy.tier).toBe(1));
  });

  it('defaults to 3 enemies when count is not specified', () => {
    expect(getRandomEnemies(1).length).toBe(3);
  });

  it('never returns more enemies than the tier has', () => {
    const tier4 = getEnemiesByTier(4);
    expect(getRandomEnemies(4, tier4.length + 5).length).toBe(tier4.length);
  });

  describe('exclude parameter', () => {
    const tier4 = getEnemiesByTier(4);

    it('excludes the specified enemies from selection', () => {
      const excluded = tier4.slice(0, 2);
      for (let i = 0; i < 10; i++) {
        const names = getRandomEnemies(4, 3, excluded).map(e => e.name);
        excluded.forEach(name => expect(names).not.toContain(name));
      }
    });

    it('returns dummy enemies when every enemy in the tier is excluded', () => {
      const enemies = getRandomEnemies(4, 3, tier4);
      expect(enemies.length).toBe(3);
      enemies.forEach(enemy => expect(enemy.name).toBe('Dummy'));
      expect(enemies[0]).not.toBe(enemies[1]);
    });

    it('ignores excluded names that are not enemies', () => {
      expect(getRandomEnemies(1, 3, ['Non-existent Enemy']).length).toBe(3);
    });
  });
});

describe('enemy registry', () => {
  it('lists every enemy exactly once under the name its instance reports', () => {
    const names = getEnemyNames();
    expect(names.length).toBeGreaterThan(0);
    expect(new Set(names).size).toBe(names.length);
    names.forEach(name => expect(createEnemy(name).name).toBe(name));
  });

  it('groups enemies by the tier their instance reports', () => {
    const byTier = ([1, 2, 3, 4] as const).map(tier => getEnemiesByTier(tier));
    byTier.forEach((names, i) => {
      expect(names.length).toBeGreaterThan(0);
      names.forEach(name => expect(createEnemy(name).tier).toBe(i + 1));
    });
    expect(byTier.flat().sort()).toEqual(getEnemyNames().sort());
  });

  it('knows which names are registered', () => {
    expect(isEnemyRegistered(getEnemyNames()[0])).toBe(true);
    expect(isEnemyRegistered('Nonexistent Enemy')).toBe(false);
    expect(isEnemyRegistered('')).toBe(false);
  });
});
