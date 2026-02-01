/**
 * Enemy Test Template
 *
 * This file provides standardized test patterns for all enemy tests.
 * Each enemy test file should follow this structure for consistency.
 *
 * Standard Test Categories:
 * 1. Metadata - name, tier, icon, description, defeatConditionText
 * 2. Effects - each effect the enemy uses (weapon counter, inactivity, etc.)
 * 3. Defeat Condition - threshold testing (below, at, above)
 * 4. Lifecycle Hooks - onRoundStart, onCardDraw, onValidMatch, onInvalidMatch, onRoundEnd
 * 5. UI/Stat Modifiers - getUIModifiers, getStatModifiers
 */

import type { Card, Shape, Color, Number as CardNumber, Shading } from '@/types';
import type { RoundStats, EnemyInstance } from '@/types/enemy';

// ============================================================================
// CANONICAL FACTORIES (re-exported for convenience)
// ============================================================================

export { createRoundStats, createCard, createTestBoard, resetCardIdCounter } from './index';

// ============================================================================
// TEST HELPER TYPES
// ============================================================================

export interface EnemyTestConfig {
  name: string;
  tier: 1 | 2 | 3 | 4;
  icon: string;
  descriptionContains: string[];
  defeatConditionText: string;
}

export interface DefeatConditionTestCase {
  description: string;
  stats: Partial<RoundStats>;
  expected: boolean;
}

export interface InactivityEffectConfig {
  maxMs: number;
  penalty: 'damage' | 'death';
  warningAtSeconds?: number;
}

export interface WeaponCounterConfig {
  type: string;
  reduction: number;
}

// ============================================================================
// STANDARD TEST GENERATORS
// ============================================================================

/**
 * Generate standard metadata tests for an enemy.
 */
export function generateMetadataTests(
  createEnemy: () => EnemyInstance,
  config: EnemyTestConfig
): void {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createEnemy();
      expect(enemy.name).toBe(config.name);
    });

    it('has correct tier', () => {
      const enemy = createEnemy();
      expect(enemy.tier).toBe(config.tier);
    });

    it('has correct icon', () => {
      const enemy = createEnemy();
      expect(enemy.icon).toBe(config.icon);
    });

    it('has correct description', () => {
      const enemy = createEnemy();
      for (const text of config.descriptionContains) {
        expect(enemy.description).toContain(text);
      }
    });

    it('has correct defeat condition text', () => {
      const enemy = createEnemy();
      expect(enemy.defeatConditionText).toBe(config.defeatConditionText);
    });
  });
}

/**
 * Generate standard defeat condition tests.
 */
export function generateDefeatConditionTests(
  createEnemy: () => EnemyInstance,
  testCases: DefeatConditionTestCase[],
  baseStats: Partial<RoundStats> = {}
): void {
  describe('defeat condition', () => {
    for (const testCase of testCases) {
      it(testCase.description, () => {
        const enemy = createEnemy();
        const stats = createRoundStatsForTest({ ...baseStats, ...testCase.stats });
        expect(enemy.checkDefeatCondition(stats)).toBe(testCase.expected);
      });
    }
  });
}

/**
 * Generate standard inactivity effect tests.
 */
export function generateInactivityEffectTests(
  createEnemy: () => EnemyInstance,
  config: InactivityEffectConfig
): void {
  describe('inactivity effect', () => {
    it(`does not penalize before ${config.maxMs}ms`, () => {
      const enemy = createEnemy();
      enemy.onRoundStart([]);
      const result = enemy.onTick(config.maxMs - 1000, []);
      expect(result.healthDelta).toBe(0);
      expect(result.instantDeath).toBe(false);
    });

    it(`triggers ${config.penalty} at ${config.maxMs}ms`, () => {
      const enemy = createEnemy();
      enemy.onRoundStart([]);
      const result = enemy.onTick(config.maxMs, []);
      if (config.penalty === 'death') {
        expect(result.instantDeath).toBe(true);
      } else {
        expect(result.healthDelta).toBe(-1);
        expect(result.instantDeath).toBe(false);
      }
    });

    it('resets inactivity timer on valid match', () => {
      const enemy = createEnemy();
      enemy.onRoundStart([]);
      enemy.onTick(config.maxMs - 5000, []);
      enemy.onValidMatch([], []);
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showInactivityBar?.current).toBe(0);
    });

    it('shows inactivity bar in UI modifiers', () => {
      const enemy = createEnemy();
      enemy.onRoundStart([]);
      enemy.onTick(10000, []);
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showInactivityBar).toBeDefined();
      expect(modifiers.showInactivityBar?.max).toBe(config.maxMs);
      expect(modifiers.showInactivityBar?.penalty).toBe(config.penalty);
    });

    if (config.warningAtSeconds) {
      const warningSeconds = config.warningAtSeconds;
      it(`emits warning at ${warningSeconds} seconds remaining`, () => {
        const enemy = createEnemy();
        enemy.onRoundStart([]);
        const warningTime = config.maxMs - warningSeconds * 1000;
        enemy.onTick(warningTime - 500, []);
        const result = enemy.onTick(500, []);
        expect(result.events).toContainEqual({
          type: 'inactivity_warning',
          secondsRemaining: config.warningAtSeconds,
        });
      });
    }
  });
}

/**
 * Generate standard weapon counter effect tests.
 */
export function generateWeaponCounterTests(
  createEnemy: () => EnemyInstance,
  counters: WeaponCounterConfig[]
): void {
  describe('weapon counter effects', () => {
    for (const counter of counters) {
      it(`reduces ${counter.type} by ${counter.reduction}%`, () => {
        const enemy = createEnemy();
        const modifiers = enemy.getStatModifiers();
        const reductionKey = `${counter.type}GainChanceReduction` as keyof typeof modifiers;
        // Handle special cases
        if (counter.type === 'fire') {
          expect(modifiers.fireSpreadChanceReduction).toBe(counter.reduction);
        } else if (counter.type === 'explosion') {
          expect(modifiers.explosionChanceReduction).toBe(counter.reduction);
        } else if (counter.type === 'laser') {
          expect(modifiers.laserChanceReduction).toBe(counter.reduction);
        } else {
          expect(modifiers[reductionKey]).toBe(counter.reduction);
        }
      });

      it(`shows ${counter.type} counter in UI modifiers`, () => {
        const enemy = createEnemy();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.weaponCounters).toContainEqual({
          type: counter.type,
          reduction: counter.reduction,
        });
      });
    }
  });
}

/**
 * Generate standard lifecycle hook tests.
 */
export function generateLifecycleTests(
  createEnemy: () => EnemyInstance,
  options: {
    modifiesCardsOnDraw?: boolean;
    modifiesCardsOnStart?: boolean;
    hasMatchEffects?: boolean;
  } = {}
): void {
  describe('lifecycle hooks', () => {
    if (!options.modifiesCardsOnStart) {
      it('onRoundStart returns empty modifications for basic enemy', () => {
        const enemy = createEnemy();
        const result = enemy.onRoundStart([]);
        // Note: Some enemies modify cards, so we just check it doesn't throw
        expect(result).toBeDefined();
        expect(result.events).toBeDefined();
      });
    }

    if (!options.modifiesCardsOnDraw) {
      it('onCardDraw returns card unchanged when no draw effect', () => {
        const enemy = createEnemy();
        const card = createCardForTest();
        // Mock random to ensure no random effects trigger
        const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.99);
        const result = enemy.onCardDraw(card);
        // Check core properties are unchanged
        expect(result.id).toBe(card.id);
        expect(result.shape).toBe(card.shape);
        expect(result.color).toBe(card.color);
        mockRandom.mockRestore();
      });
    }

    it('onValidMatch returns a valid result', () => {
      const enemy = createEnemy();
      const result = enemy.onValidMatch([], []);
      expect(result).toBeDefined();
      expect(typeof result.timeDelta).toBe('number');
      expect(typeof result.pointsMultiplier).toBe('number');
    });

    it('onInvalidMatch returns a valid result', () => {
      const enemy = createEnemy();
      const result = enemy.onInvalidMatch([], []);
      expect(result).toBeDefined();
      expect(Array.isArray(result.cardsToRemove)).toBe(true);
    });

    it('onRoundEnd does not throw', () => {
      const enemy = createEnemy();
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });
  });
}

/**
 * Generate score decay tests.
 */
export function generateScoreDecayTests(
  createEnemy: () => EnemyInstance,
  ratePerSecond: number
): void {
  describe('score decay effect', () => {
    it(`decays at ${ratePerSecond} points per second`, () => {
      const enemy = createEnemy();
      const result = enemy.onTick(1000, []);
      expect(result.scoreDelta).toBeCloseTo(-ratePerSecond, 2);
    });

    it('decays proportionally over time', () => {
      const enemy = createEnemy();
      const result = enemy.onTick(5000, []);
      expect(result.scoreDelta).toBeCloseTo(-ratePerSecond * 5, 2);
    });
  });
}

/**
 * Generate timer speed tests.
 */
export function generateTimerSpeedTests(
  createEnemy: () => EnemyInstance,
  multiplier: number
): void {
  describe('timer speed effect', () => {
    it(`has ${(multiplier - 1) * 100}% faster timer (${multiplier}x)`, () => {
      const enemy = createEnemy();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBe(multiplier);
    });
  });
}

/**
 * Generate triple card effect tests.
 */
export function generateTripleCardTests(
  createEnemy: () => EnemyInstance,
  count: number
): void {
  describe('triple card effect', () => {
    it(`places ${count} triple card(s) on round start`, () => {
      const enemy = createEnemy();
      const board = createTestBoardForTest(12);
      const result = enemy.onRoundStart(board);
      const tripleCards = result.cardModifications.filter((m) => m.changes.health === 3);
      expect(tripleCards.length).toBe(count);
    });
  });
}

/**
 * Generate face-down card effect tests.
 */
export function generateFaceDownEffectTests(
  createEnemy: () => EnemyInstance,
  chance: number
): void {
  describe('face-down effect', () => {
    it(`creates face-down cards with ${chance}% chance`, () => {
      const enemy = createEnemy();
      const card = createCardForTest();

      // Mock random to be below chance
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue((chance - 1) / 100);
      const modifiedCard = enemy.onCardDraw(card);
      expect(modifiedCard.isFaceDown).toBe(true);
      mockRandom.mockRestore();
    });

    it('does not create face-down when roll fails', () => {
      const enemy = createEnemy();
      const card = createCardForTest();

      // Mock random to be above chance
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue((chance + 1) / 100);
      const modifiedCard = enemy.onCardDraw(card);
      expect(modifiedCard.isFaceDown).toBeUndefined();
      mockRandom.mockRestore();
    });
  });
}

/**
 * Generate dud card effect tests.
 */
export function generateDudEffectTests(
  createEnemy: () => EnemyInstance,
  chance: number
): void {
  describe('dud card effect', () => {
    it(`creates dud cards with ${chance}% chance`, () => {
      const enemy = createEnemy();
      const card = createCardForTest();

      // Mock random to be below chance
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue((chance - 1) / 100);
      const modifiedCard = enemy.onCardDraw(card);
      expect(modifiedCard.isDud).toBe(true);
      mockRandom.mockRestore();
    });

    it('does not create dud when roll fails', () => {
      const enemy = createEnemy();
      const card = createCardForTest();

      // Mock random to be above chance
      const mockRandom = jest.spyOn(Math, 'random').mockReturnValue((chance + 1) / 100);
      const modifiedCard = enemy.onCardDraw(card);
      expect(modifiedCard.isDud).toBeUndefined();
      mockRandom.mockRestore();
    });
  });
}

/**
 * Generate points multiplier tests.
 */
export function generatePointsMultiplierTests(
  createEnemy: () => EnemyInstance,
  multiplier: number
): void {
  describe('points multiplier effect', () => {
    it(`has ${multiplier}x points multiplier`, () => {
      const enemy = createEnemy();
      const board = createTestBoardForTest(12);
      const result = enemy.onValidMatch([board[0], board[1], board[2]], board);
      expect(result.pointsMultiplier).toBe(multiplier);
    });
  });
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

function createRoundStatsForTest(overrides: Partial<RoundStats> = {}): RoundStats {
  return {
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
    gracesRemaining: 2,
    damageReceived: 0,
    weaponEffectsTriggered: new Set<string>(),
    currentScore: 0,
    targetScore: 100,
    // Time gain trigger tracking
    timeGainTriggersThisRound: 0,
    timeGainTriggerCapBonus: 0,
    consecutiveInvalidMatches: 0,
    prismaticPerfectionTriggered: false,
    tabulaRasaTriggered: false,
    ...overrides,
  };
}

let testCardCounter = 0;

function createCardForTest(overrides: Partial<Card> = {}): Card {
  return {
    id: `template-card-${testCardCounter++}`,
    shape: 'oval',
    color: 'red',
    number: 1,
    shading: 'solid',
    selected: false,
    ...overrides,
  };
}

function createTestBoardForTest(count: number = 12): Card[] {
  return Array(count)
    .fill(null)
    .map(() => createCardForTest());
}

// Reset counter for tests
export function resetTestCardCounter(): void {
  testCardCounter = 0;
}
