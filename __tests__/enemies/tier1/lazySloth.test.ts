/**
 * Comprehensive Unit Tests for Lazy Sloth Enemy
 *
 * Lazy Sloth - Tier 1 Enemy
 * Effect: Time gain reduced by 20%
 * Defeat Condition: Beat target score with 15+ seconds remaining
 *
 * Known Bug: Time sync issues - these tests verify the defeat condition
 * boundary behavior with various time values including floating point edge cases.
 */
import type { RoundStats, EnemyStartResult, EnemyTickResult, EnemyMatchResult } from '@/types/enemy';
import { createLazySloth } from '@/utils/enemies/tier1/lazySloth';
import { createRoundStats, createCard, createTestBoard, resetCardIdCounter } from '../../testUtils';

// Reset card ID counter before each test for deterministic IDs
beforeEach(() => {
  resetCardIdCounter();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Lazy Sloth', () => {
  // ==========================================================================
  // METADATA TESTS
  // ==========================================================================
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createLazySloth();
      expect(enemy.name).toBe('Lazy Sloth');
    });

    it('has correct tier (tier 1)', () => {
      const enemy = createLazySloth();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon path', () => {
      const enemy = createLazySloth();
      expect(enemy.icon).toBe('caro-asercion/sloth');
    });

    it('has a description', () => {
      const enemy = createLazySloth();
      expect(enemy.description).toBeDefined();
      expect(typeof enemy.description).toBe('string');
      expect(enemy.description.length).toBeGreaterThan(0);
    });

    it('description mentions time gain reduction', () => {
      const enemy = createLazySloth();
      expect(enemy.description.toLowerCase()).toContain('time');
    });

    it('description mentions divided by 3', () => {
      const enemy = createLazySloth();
      expect(enemy.description).toContain('divided by 3');
    });

    it('has correct full description text', () => {
      const enemy = createLazySloth();
      expect(enemy.description).toBe('Time gain divided by 3');
    });

    it('has a defeat condition text', () => {
      const enemy = createLazySloth();
      expect(enemy.defeatConditionText).toBeDefined();
      expect(typeof enemy.defeatConditionText).toBe('string');
      expect(enemy.defeatConditionText.length).toBeGreaterThan(0);
    });

    it('defeat condition text mentions 15+ seconds', () => {
      const enemy = createLazySloth();
      expect(enemy.defeatConditionText).toContain('15+');
    });

    it('defeat condition text mentions seconds remaining', () => {
      const enemy = createLazySloth();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('seconds remaining');
    });

    it('defeat condition text mentions beating target score', () => {
      const enemy = createLazySloth();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('beat');
      expect(enemy.defeatConditionText.toLowerCase()).toContain('target');
    });

    it('has correct full defeat condition text', () => {
      const enemy = createLazySloth();
      expect(enemy.defeatConditionText).toBe('Beat target score with 15+ seconds remaining');
    });

    it('creates independent instances (no shared state)', () => {
      const enemy1 = createLazySloth();
      const enemy2 = createLazySloth();
      expect(enemy1).not.toBe(enemy2);
    });

    it('instances have same metadata values', () => {
      const enemy1 = createLazySloth();
      const enemy2 = createLazySloth();
      expect(enemy1.name).toBe(enemy2.name);
      expect(enemy1.tier).toBe(enemy2.tier);
      expect(enemy1.icon).toBe(enemy2.icon);
      expect(enemy1.description).toBe(enemy2.description);
      expect(enemy1.defeatConditionText).toBe(enemy2.defeatConditionText);
    });
  });

  // ==========================================================================
  // WEAPON COUNTER EFFECT TESTS
  // ==========================================================================
  describe('WeaponCounterEffect', () => {
    describe('getStatModifiers', () => {
      it('returns timeGainChanceReduction in stat modifiers', () => {
        const enemy = createLazySloth();
        const modifiers = enemy.getStatModifiers();
        expect(modifiers.timeGainChanceReduction).toBeDefined();
      });

      it('returns exactly 20 for timeGainChanceReduction', () => {
        const enemy = createLazySloth();
        const modifiers = enemy.getStatModifiers();
        expect(modifiers.timeGainChanceReduction).toBe(20);
      });

      it('does not affect fire spread chance', () => {
        const enemy = createLazySloth();
        const modifiers = enemy.getStatModifiers();
        expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
      });

      it('does not affect explosion chance', () => {
        const enemy = createLazySloth();
        const modifiers = enemy.getStatModifiers();
        expect(modifiers.explosionChanceReduction).toBeUndefined();
      });

      it('does not affect laser chance', () => {
        const enemy = createLazySloth();
        const modifiers = enemy.getStatModifiers();
        expect(modifiers.laserChanceReduction).toBeUndefined();
      });

      it('does not affect hint gain chance', () => {
        const enemy = createLazySloth();
        const modifiers = enemy.getStatModifiers();
        expect(modifiers.hintGainChanceReduction).toBeUndefined();
      });

      it('does not affect grace gain chance', () => {
        const enemy = createLazySloth();
        const modifiers = enemy.getStatModifiers();
        expect(modifiers.graceGainChanceReduction).toBeUndefined();
      });

      it('does not affect healing chance', () => {
        const enemy = createLazySloth();
        const modifiers = enemy.getStatModifiers();
        expect(modifiers.healingChanceReduction).toBeUndefined();
      });

      it('does not affect damage multiplier', () => {
        const enemy = createLazySloth();
        const modifiers = enemy.getStatModifiers();
        expect(modifiers.damageMultiplier).toBeUndefined();
      });

      it('does not affect points multiplier', () => {
        const enemy = createLazySloth();
        const modifiers = enemy.getStatModifiers();
        expect(modifiers.pointsMultiplier).toBeUndefined();
      });

      it('returns same modifiers on multiple calls', () => {
        const enemy = createLazySloth();
        const modifiers1 = enemy.getStatModifiers();
        const modifiers2 = enemy.getStatModifiers();
        expect(modifiers1.timeGainChanceReduction).toBe(modifiers2.timeGainChanceReduction);
      });
    });

    describe('getUIModifiers', () => {
      it('returns weaponCounters array in UI modifiers', () => {
        const enemy = createLazySloth();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.weaponCounters).toBeDefined();
        expect(Array.isArray(uiMods.weaponCounters)).toBe(true);
      });

      it('weaponCounters contains exactly one entry', () => {
        const enemy = createLazySloth();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.weaponCounters).toHaveLength(1);
      });

      it('weaponCounters entry has type "time"', () => {
        const enemy = createLazySloth();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.weaponCounters![0].type).toBe('time');
      });

      it('weaponCounters entry has reduction of 20', () => {
        const enemy = createLazySloth();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.weaponCounters![0].reduction).toBe(20);
      });

      it('returns correct weapon counter object', () => {
        const enemy = createLazySloth();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.weaponCounters).toContainEqual({ type: 'time', reduction: 20 });
      });

      it('does not show inactivity bar', () => {
        const enemy = createLazySloth();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.showInactivityBar).toBeUndefined();
      });

      it('does not show score decay', () => {
        const enemy = createLazySloth();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.showScoreDecay).toBeUndefined();
      });

      it('does not modify timer speed', () => {
        const enemy = createLazySloth();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.timerSpeedMultiplier).toBeUndefined();
      });

      it('does not disable auto hint', () => {
        const enemy = createLazySloth();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.disableAutoHint).toBeUndefined();
      });

      it('does not disable manual hint', () => {
        const enemy = createLazySloth();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.disableManualHint).toBeUndefined();
      });

      it('does not show countdown cards', () => {
        const enemy = createLazySloth();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.showCountdownCards).toBeUndefined();
      });

      it('does not show bomb cards', () => {
        const enemy = createLazySloth();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.showBombCards).toBeUndefined();
      });
    });
  });

  // ==========================================================================
  // DEFEAT CONDITION TESTS
  // ==========================================================================
  describe('defeat condition', () => {
    describe('score requirements', () => {
      it('returns false when score is 0 and target is 100', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 0, targetScore: 100, timeRemaining: 30 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when score is 1 below target', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 99, targetScore: 100, timeRemaining: 30 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when score is 50 (half of target 100)', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 50, targetScore: 100, timeRemaining: 20 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true when score equals target and time is sufficient', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 15 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when score exceeds target and time is sufficient', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 150, targetScore: 100, timeRemaining: 30 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when score greatly exceeds target', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 500, targetScore: 100, timeRemaining: 20 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns false when target is 0 but time is insufficient', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 0, targetScore: 0, timeRemaining: 10 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true when target is 0 and time is sufficient', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 0, targetScore: 0, timeRemaining: 15 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('time requirements - boundary tests', () => {
      it('returns false when time is 0 seconds', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when time is 1 second', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 1 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when time is 10 seconds', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 10 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when time is 14 seconds (threshold - 1)', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 14 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when time is 14.9 seconds (just below threshold)', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 14.9 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when time is 14.99 seconds (very close to threshold)', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 14.99 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when time is 14.999 seconds (extremely close to threshold)', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 14.999 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true when time is exactly 15 seconds (threshold)', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 15 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when time is 15.001 seconds (just above threshold)', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 15.001 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when time is 15.01 seconds', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 15.01 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when time is 15.1 seconds', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 15.1 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when time is 15.5 seconds', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 15.5 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when time is 16 seconds (threshold + 1)', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 16 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when time is 20 seconds', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 20 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when time is 30 seconds', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 30 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when time is 60 seconds (full timer)', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 60 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('floating point edge cases (time sync bug coverage)', () => {
      it('handles floating point precision at 14.999999999 seconds', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 14.999999999 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('handles floating point precision at 15.000000001 seconds', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 15.000000001 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('handles time represented as fraction 15/1', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 15 / 1 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('handles time represented as expression 10 + 5', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 10 + 5 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('handles time represented as 30/2', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 30 / 2 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('handles potential floating point issue with 0.1 + 0.1 + ... (14.9)', () => {
        const enemy = createLazySloth();
        // Simulate adding 0.1 many times which can cause floating point issues
        let time = 0;
        for (let i = 0; i < 149; i++) {
          time += 0.1;
        }
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: time });
        // The result might be slightly off due to floating point, but should be < 15
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('handles potential floating point issue with 0.1 additions (15.0)', () => {
        const enemy = createLazySloth();
        let time = 0;
        for (let i = 0; i < 150; i++) {
          time += 0.1;
        }
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: time });
        // Due to floating point, 0.1 * 150 might not equal exactly 15
        // This tests that the condition handles this edge case
        expect(enemy.checkDefeatCondition(stats)).toBe(time >= 15);
      });

      it('handles time as Number.EPSILON below 15 (reveals floating point limitation)', () => {
        const enemy = createLazySloth();
        // Note: Number.EPSILON (~2.22e-16) is so small that 15 - Number.EPSILON
        // equals 15 in floating point representation. This documents the limitation.
        const timeValue = 15 - Number.EPSILON;
        const stats = createRoundStats({
          currentScore: 100,
          targetScore: 100,
          timeRemaining: timeValue,
        });
        // Due to floating point precision, 15 - Number.EPSILON === 15
        // So this actually returns true, documenting this edge case behavior
        expect(enemy.checkDefeatCondition(stats)).toBe(timeValue >= 15);
      });

      it('handles time as Number.EPSILON above 15', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({
          currentScore: 100,
          targetScore: 100,
          timeRemaining: 15 + Number.EPSILON,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('combined score and time conditions', () => {
      it('returns false when both score and time are insufficient', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 50, targetScore: 100, timeRemaining: 10 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when score is sufficient but time is not', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 14 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when time is sufficient but score is not', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 99, targetScore: 100, timeRemaining: 30 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true only when both conditions are met', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 15 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('various target scores', () => {
      it('works with target score of 50', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 50, targetScore: 50, timeRemaining: 15 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('works with target score of 200', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 200, targetScore: 200, timeRemaining: 15 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('works with target score of 1000', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 1000, targetScore: 1000, timeRemaining: 15 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('works with very high target score of 10000', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 10000, targetScore: 10000, timeRemaining: 15 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('negative time handling', () => {
      it('returns false when time is -1 (impossible but defensive)', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: -1 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when time is -15 (impossible but defensive)', () => {
        const enemy = createLazySloth();
        const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: -15 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS TESTS
  // ==========================================================================
  describe('lifecycle hooks', () => {
    describe('onRoundStart', () => {
      it('returns EnemyStartResult', () => {
        const enemy = createLazySloth();
        const board = createTestBoard(12);
        const result = enemy.onRoundStart(board);
        expect(result).toBeDefined();
      });

      it('returns empty cardModifications array', () => {
        const enemy = createLazySloth();
        const board = createTestBoard(12);
        const result = enemy.onRoundStart(board);
        expect(result.cardModifications).toBeDefined();
        expect(Array.isArray(result.cardModifications)).toBe(true);
        expect(result.cardModifications).toHaveLength(0);
      });

      it('returns empty events array', () => {
        const enemy = createLazySloth();
        const board = createTestBoard(12);
        const result = enemy.onRoundStart(board);
        expect(result.events).toBeDefined();
        expect(Array.isArray(result.events)).toBe(true);
        expect(result.events).toHaveLength(0);
      });

      it('does not modify the board', () => {
        const enemy = createLazySloth();
        const board = createTestBoard(12);
        const originalBoardJson = JSON.stringify(board);
        enemy.onRoundStart(board);
        expect(JSON.stringify(board)).toBe(originalBoardJson);
      });

      it('handles empty board', () => {
        const enemy = createLazySloth();
        const board: ReturnType<typeof createCard>[] = [];
        const result = enemy.onRoundStart(board);
        expect(result.cardModifications).toHaveLength(0);
        expect(result.events).toHaveLength(0);
      });

      it('handles large board (18 cards)', () => {
        const enemy = createLazySloth();
        const board = createTestBoard(18);
        const result = enemy.onRoundStart(board);
        expect(result.cardModifications).toHaveLength(0);
        expect(result.events).toHaveLength(0);
      });
    });

    describe('onTick', () => {
      it('returns EnemyTickResult', () => {
        const enemy = createLazySloth();
        const board = createTestBoard(12);
        const result = enemy.onTick(100, board);
        expect(result).toBeDefined();
      });

      it('returns scoreDelta of 0', () => {
        const enemy = createLazySloth();
        const board = createTestBoard(12);
        const result = enemy.onTick(100, board);
        expect(result.scoreDelta).toBe(0);
      });

      it('returns healthDelta of 0', () => {
        const enemy = createLazySloth();
        const board = createTestBoard(12);
        const result = enemy.onTick(100, board);
        expect(result.healthDelta).toBe(0);
      });

      it('returns timeDelta of 0', () => {
        const enemy = createLazySloth();
        const board = createTestBoard(12);
        const result = enemy.onTick(100, board);
        expect(result.timeDelta).toBe(0);
      });

      it('returns empty cardsToRemove array', () => {
        const enemy = createLazySloth();
        const board = createTestBoard(12);
        const result = enemy.onTick(100, board);
        expect(result.cardsToRemove).toHaveLength(0);
      });

      it('returns empty cardModifications array', () => {
        const enemy = createLazySloth();
        const board = createTestBoard(12);
        const result = enemy.onTick(100, board);
        expect(result.cardModifications).toHaveLength(0);
      });

      it('returns empty cardsToFlip array', () => {
        const enemy = createLazySloth();
        const board = createTestBoard(12);
        const result = enemy.onTick(100, board);
        expect(result.cardsToFlip).toHaveLength(0);
      });

      it('returns empty events array', () => {
        const enemy = createLazySloth();
        const board = createTestBoard(12);
        const result = enemy.onTick(100, board);
        expect(result.events).toHaveLength(0);
      });

      it('returns instantDeath as false', () => {
        const enemy = createLazySloth();
        const board = createTestBoard(12);
        const result = enemy.onTick(100, board);
        expect(result.instantDeath).toBe(false);
      });

      it('handles various deltaMs values (16ms)', () => {
        const enemy = createLazySloth();
        const board = createTestBoard(12);
        const result = enemy.onTick(16, board);
        expect(result.scoreDelta).toBe(0);
        expect(result.healthDelta).toBe(0);
      });

      it('handles various deltaMs values (1000ms)', () => {
        const enemy = createLazySloth();
        const board = createTestBoard(12);
        const result = enemy.onTick(1000, board);
        expect(result.scoreDelta).toBe(0);
        expect(result.healthDelta).toBe(0);
      });

      it('handles various deltaMs values (5000ms)', () => {
        const enemy = createLazySloth();
        const board = createTestBoard(12);
        const result = enemy.onTick(5000, board);
        expect(result.scoreDelta).toBe(0);
        expect(result.healthDelta).toBe(0);
      });

      it('does not accumulate state over multiple ticks', () => {
        const enemy = createLazySloth();
        const board = createTestBoard(12);
        // Call onTick multiple times
        for (let i = 0; i < 10; i++) {
          const result = enemy.onTick(1000, board);
          expect(result.scoreDelta).toBe(0);
          expect(result.healthDelta).toBe(0);
          expect(result.instantDeath).toBe(false);
        }
      });
    });

    describe('onValidMatch', () => {
      it('returns EnemyMatchResult', () => {
        const enemy = createLazySloth();
        const matchedCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onValidMatch(matchedCards, board);
        expect(result).toBeDefined();
      });

      it('returns timeDelta of 0', () => {
        const enemy = createLazySloth();
        const matchedCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.timeDelta).toBe(0);
      });

      it('returns pointsMultiplier of 1', () => {
        const enemy = createLazySloth();
        const matchedCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.pointsMultiplier).toBe(1);
      });

      it('returns empty cardsToRemove array', () => {
        const enemy = createLazySloth();
        const matchedCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.cardsToRemove).toHaveLength(0);
      });

      it('returns empty cardsToFlip array', () => {
        const enemy = createLazySloth();
        const matchedCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.cardsToFlip).toHaveLength(0);
      });

      it('returns empty events array', () => {
        const enemy = createLazySloth();
        const matchedCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.events).toHaveLength(0);
      });

      it('does not modify matched cards', () => {
        const enemy = createLazySloth();
        const matchedCards = [createCard(), createCard(), createCard()];
        const originalJson = JSON.stringify(matchedCards);
        const board = createTestBoard(12);
        enemy.onValidMatch(matchedCards, board);
        expect(JSON.stringify(matchedCards)).toBe(originalJson);
      });
    });

    describe('onInvalidMatch', () => {
      it('returns EnemyMatchResult', () => {
        const enemy = createLazySloth();
        const cards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onInvalidMatch(cards, board);
        expect(result).toBeDefined();
      });

      it('returns timeDelta of 0', () => {
        const enemy = createLazySloth();
        const cards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onInvalidMatch(cards, board);
        expect(result.timeDelta).toBe(0);
      });

      it('returns pointsMultiplier of 1', () => {
        const enemy = createLazySloth();
        const cards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onInvalidMatch(cards, board);
        expect(result.pointsMultiplier).toBe(1);
      });

      it('returns empty cardsToRemove array', () => {
        const enemy = createLazySloth();
        const cards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onInvalidMatch(cards, board);
        expect(result.cardsToRemove).toHaveLength(0);
      });

      it('returns empty cardsToFlip array', () => {
        const enemy = createLazySloth();
        const cards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onInvalidMatch(cards, board);
        expect(result.cardsToFlip).toHaveLength(0);
      });

      it('returns empty events array', () => {
        const enemy = createLazySloth();
        const cards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onInvalidMatch(cards, board);
        expect(result.events).toHaveLength(0);
      });
    });

    describe('onCardDraw', () => {
      it('returns the same card unchanged', () => {
        const enemy = createLazySloth();
        const card = createCard({ shape: 'diamond', color: 'purple', number: 2 });
        const result = enemy.onCardDraw(card);
        expect(result).toEqual(card);
      });

      it('does not add isDud property', () => {
        const enemy = createLazySloth();
        const card = createCard();
        const result = enemy.onCardDraw(card);
        expect(result.isDud).toBeUndefined();
      });

      it('does not add isFaceDown property', () => {
        const enemy = createLazySloth();
        const card = createCard();
        const result = enemy.onCardDraw(card);
        expect(result.isFaceDown).toBeUndefined();
      });

      it('does not add hasBomb property', () => {
        const enemy = createLazySloth();
        const card = createCard();
        const result = enemy.onCardDraw(card);
        expect(result.hasBomb).toBeUndefined();
      });

      it('does not add hasCountdown property', () => {
        const enemy = createLazySloth();
        const card = createCard();
        const result = enemy.onCardDraw(card);
        expect(result.hasCountdown).toBeUndefined();
      });

      it('preserves all card properties', () => {
        const enemy = createLazySloth();
        const card = createCard({
          id: 'test-id-123',
          shape: 'squiggle',
          color: 'green',
          number: 3,
          shading: 'striped',
        });
        const result = enemy.onCardDraw(card);
        expect(result.id).toBe('test-id-123');
        expect(result.shape).toBe('squiggle');
        expect(result.color).toBe('green');
        expect(result.number).toBe(3);
        expect(result.shading).toBe('striped');
      });

      it('handles cards with existing special properties', () => {
        const enemy = createLazySloth();
        const card = createCard({ health: 3, onFire: true });
        const result = enemy.onCardDraw(card);
        expect(result.health).toBe(3);
        expect(result.onFire).toBe(true);
      });
    });

    describe('onRoundEnd', () => {
      it('can be called without error', () => {
        const enemy = createLazySloth();
        expect(() => enemy.onRoundEnd()).not.toThrow();
      });

      it('returns undefined', () => {
        const enemy = createLazySloth();
        const result = enemy.onRoundEnd();
        expect(result).toBeUndefined();
      });

      it('can be called multiple times', () => {
        const enemy = createLazySloth();
        expect(() => {
          enemy.onRoundEnd();
          enemy.onRoundEnd();
          enemy.onRoundEnd();
        }).not.toThrow();
      });

      it('can be called after other lifecycle hooks', () => {
        const enemy = createLazySloth();
        const board = createTestBoard(12);
        enemy.onRoundStart(board);
        enemy.onTick(1000, board);
        enemy.onValidMatch([createCard(), createCard(), createCard()], board);
        expect(() => enemy.onRoundEnd()).not.toThrow();
      });
    });
  });

  // ==========================================================================
  // INTEGRATION TESTS
  // ==========================================================================
  describe('integration tests', () => {
    it('maintains consistent behavior across full round lifecycle', () => {
      const enemy = createLazySloth();
      const board = createTestBoard(12);

      // Round start
      const startResult = enemy.onRoundStart(board);
      expect(startResult.cardModifications).toHaveLength(0);

      // Multiple ticks
      for (let i = 0; i < 60; i++) {
        const tickResult = enemy.onTick(1000, board);
        expect(tickResult.healthDelta).toBe(0);
        expect(tickResult.scoreDelta).toBe(0);
      }

      // Valid match
      const matchResult = enemy.onValidMatch([createCard(), createCard(), createCard()], board);
      expect(matchResult.pointsMultiplier).toBe(1);

      // Check defeat condition
      const stats = createRoundStats({ currentScore: 100, targetScore: 100, timeRemaining: 15 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);

      // Round end
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('stat modifiers remain constant throughout round', () => {
      const enemy = createLazySloth();
      const board = createTestBoard(12);

      const modifiersBefore = enemy.getStatModifiers();
      enemy.onRoundStart(board);
      enemy.onTick(5000, board);
      enemy.onValidMatch([createCard(), createCard(), createCard()], board);
      const modifiersAfter = enemy.getStatModifiers();

      expect(modifiersBefore.timeGainChanceReduction).toBe(modifiersAfter.timeGainChanceReduction);
    });

    it('UI modifiers remain constant throughout round', () => {
      const enemy = createLazySloth();
      const board = createTestBoard(12);

      const uiModsBefore = enemy.getUIModifiers();
      enemy.onRoundStart(board);
      enemy.onTick(5000, board);
      const uiModsAfter = enemy.getUIModifiers();

      expect(uiModsBefore.weaponCounters).toEqual(uiModsAfter.weaponCounters);
    });

    it('multiple instances do not share state', () => {
      const enemy1 = createLazySloth();
      const enemy2 = createLazySloth();
      const board = createTestBoard(12);

      enemy1.onRoundStart(board);
      enemy1.onTick(10000, board);

      // enemy2 should have fresh state
      const result = enemy2.onTick(100, board);
      expect(result.healthDelta).toBe(0);
      expect(result.instantDeath).toBe(false);
    });
  });

  // ==========================================================================
  // EDGE CASE TESTS
  // ==========================================================================
  describe('edge cases', () => {
    it('handles extremely large time remaining values', () => {
      const enemy = createLazySloth();
      const stats = createRoundStats({
        currentScore: 100,
        targetScore: 100,
        timeRemaining: 999999,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('handles extremely large score values', () => {
      const enemy = createLazySloth();
      const stats = createRoundStats({
        currentScore: 1000000,
        targetScore: 100,
        timeRemaining: 15,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('handles zero target score with exactly 15 seconds', () => {
      const enemy = createLazySloth();
      const stats = createRoundStats({
        currentScore: 0,
        targetScore: 0,
        timeRemaining: 15,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('handles board with special card types', () => {
      const enemy = createLazySloth();
      const board = [
        createCard({ isDud: true }),
        createCard({ isFaceDown: true }),
        createCard({ hasBomb: true, bombTimer: 5000 }),
        createCard({ hasCountdown: true, countdownTimer: 10000 }),
        createCard({ health: 3 }),
        createCard({ onFire: true }),
        ...createTestBoard(6),
      ];

      const startResult = enemy.onRoundStart(board);
      expect(startResult.cardModifications).toHaveLength(0);

      const tickResult = enemy.onTick(1000, board);
      expect(tickResult.cardsToRemove).toHaveLength(0);
    });

    it('consistently returns boolean from checkDefeatCondition', () => {
      const enemy = createLazySloth();

      // Test various conditions always return boolean
      const testCases = [
        { currentScore: 0, targetScore: 100, timeRemaining: 0 },
        { currentScore: 100, targetScore: 100, timeRemaining: 15 },
        { currentScore: 50, targetScore: 100, timeRemaining: 30 },
        { currentScore: 200, targetScore: 100, timeRemaining: 5 },
      ];

      for (const testCase of testCases) {
        const stats = createRoundStats(testCase);
        const result = enemy.checkDefeatCondition(stats);
        expect(typeof result).toBe('boolean');
      }
    });
  });

  // ==========================================================================
  // FACTORY REGISTRATION TESTS
  // ==========================================================================
  describe('factory registration', () => {
    it('createLazySloth returns valid EnemyInstance', () => {
      const enemy = createLazySloth();

      // Verify all required methods exist
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

    it('createLazySloth can be called multiple times', () => {
      const enemies = Array.from({ length: 10 }, () => createLazySloth());
      expect(enemies).toHaveLength(10);
      enemies.forEach((enemy) => {
        expect(enemy.name).toBe('Lazy Sloth');
      });
    });
  });
});
