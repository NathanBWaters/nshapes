/**
 * Comprehensive Unit Tests for Armored Tusks enemy (Tier 2)
 *
 * Armored Tusks is a defensive enemy that combines two weapon counters:
 * - Wet Crab effect: -35% fire spread chance
 * - Spiny Hedgehog effect: -35% explosion chance
 *
 * Defeat Condition: Trigger 2 different destruction effects (fire, explosion, or laser)
 *
 * This test file provides comprehensive coverage including:
 * - Metadata validation
 * - Weapon counter effects (fire and explosion reductions)
 * - UI modifiers
 * - Stat modifiers
 * - Defeat condition logic (all combinations of destruction effects)
 * - Lifecycle hooks
 * - Edge cases and boundary conditions
 * - Multiple instance independence
 */

import { createArmoredTusks } from '@/utils/enemies/tier2/armoredTusks';
import {
  createRoundStats,
  createTestBoard,
  createCard,
  createVariedBoard,
  resetCardIdCounter,
} from '../../testUtils';
import type { Card } from '@/types';
import type { RoundStats } from '@/types/enemy';

describe('Armored Tusks', () => {
  beforeEach(() => {
    resetCardIdCounter();
    jest.restoreAllMocks();
  });

  // ============================================================================
  // METADATA TESTS
  // ============================================================================

  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createArmoredTusks();
      expect(enemy.name).toBe('Armored Tusks');
    });

    it('has correct tier (2)', () => {
      const enemy = createArmoredTusks();
      expect(enemy.tier).toBe(2);
    });

    it('has correct icon', () => {
      const enemy = createArmoredTusks();
      expect(enemy.icon).toBe('lorc/boar-tusks');
    });

    it('has description mentioning fire reduction', () => {
      const enemy = createArmoredTusks();
      expect(enemy.description).toContain('Fire');
      expect(enemy.description).toContain('-35%');
    });

    it('has description mentioning explosion reduction', () => {
      const enemy = createArmoredTusks();
      expect(enemy.description).toContain('explosion');
      expect(enemy.description).toContain('-35%');
    });

    it('has correct defeat condition text', () => {
      const enemy = createArmoredTusks();
      expect(enemy.defeatConditionText).toBe('Trigger 2 destruction effects');
    });

    it('returns name as a string', () => {
      const enemy = createArmoredTusks();
      expect(typeof enemy.name).toBe('string');
    });

    it('returns tier as a number', () => {
      const enemy = createArmoredTusks();
      expect(typeof enemy.tier).toBe('number');
    });

    it('returns icon as a string', () => {
      const enemy = createArmoredTusks();
      expect(typeof enemy.icon).toBe('string');
    });

    it('returns description as a string', () => {
      const enemy = createArmoredTusks();
      expect(typeof enemy.description).toBe('string');
    });

    it('returns defeatConditionText as a string', () => {
      const enemy = createArmoredTusks();
      expect(typeof enemy.defeatConditionText).toBe('string');
    });
  });

  // ============================================================================
  // STAT MODIFIERS TESTS
  // ============================================================================

  describe('stat modifiers', () => {
    describe('fire spread chance reduction', () => {
      it('reduces fire spread chance by 35%', () => {
        const enemy = createArmoredTusks();
        const statMods = enemy.getStatModifiers();
        expect(statMods.fireSpreadChanceReduction).toBe(35);
      });

      it('fireSpreadChanceReduction is a number', () => {
        const enemy = createArmoredTusks();
        const statMods = enemy.getStatModifiers();
        expect(typeof statMods.fireSpreadChanceReduction).toBe('number');
      });

      it('fireSpreadChanceReduction is positive', () => {
        const enemy = createArmoredTusks();
        const statMods = enemy.getStatModifiers();
        expect(statMods.fireSpreadChanceReduction).toBeGreaterThan(0);
      });

      it('fireSpreadChanceReduction is less than 100', () => {
        const enemy = createArmoredTusks();
        const statMods = enemy.getStatModifiers();
        expect(statMods.fireSpreadChanceReduction).toBeLessThan(100);
      });
    });

    describe('explosion chance reduction', () => {
      it('reduces explosion chance by 35%', () => {
        const enemy = createArmoredTusks();
        const statMods = enemy.getStatModifiers();
        expect(statMods.explosionChanceReduction).toBe(35);
      });

      it('explosionChanceReduction is a number', () => {
        const enemy = createArmoredTusks();
        const statMods = enemy.getStatModifiers();
        expect(typeof statMods.explosionChanceReduction).toBe('number');
      });

      it('explosionChanceReduction is positive', () => {
        const enemy = createArmoredTusks();
        const statMods = enemy.getStatModifiers();
        expect(statMods.explosionChanceReduction).toBeGreaterThan(0);
      });

      it('explosionChanceReduction is less than 100', () => {
        const enemy = createArmoredTusks();
        const statMods = enemy.getStatModifiers();
        expect(statMods.explosionChanceReduction).toBeLessThan(100);
      });
    });

    describe('other stat modifiers', () => {
      it('does not modify laser chance', () => {
        const enemy = createArmoredTusks();
        const statMods = enemy.getStatModifiers();
        expect(statMods.laserChanceReduction).toBeUndefined();
      });

      it('does not modify hint gain chance', () => {
        const enemy = createArmoredTusks();
        const statMods = enemy.getStatModifiers();
        expect(statMods.hintGainChanceReduction).toBeUndefined();
      });

      it('does not modify grace gain chance', () => {
        const enemy = createArmoredTusks();
        const statMods = enemy.getStatModifiers();
        expect(statMods.graceGainChanceReduction).toBeUndefined();
      });

      it('does not modify time gain chance', () => {
        const enemy = createArmoredTusks();
        const statMods = enemy.getStatModifiers();
        expect(statMods.timeGainChanceReduction).toBeUndefined();
      });

      it('does not modify healing chance', () => {
        const enemy = createArmoredTusks();
        const statMods = enemy.getStatModifiers();
        expect(statMods.healingChanceReduction).toBeUndefined();
      });

      it('does not modify damage multiplier', () => {
        const enemy = createArmoredTusks();
        const statMods = enemy.getStatModifiers();
        expect(statMods.damageMultiplier).toBeUndefined();
      });

      it('does not modify points multiplier', () => {
        const enemy = createArmoredTusks();
        const statMods = enemy.getStatModifiers();
        expect(statMods.pointsMultiplier).toBeUndefined();
      });
    });
  });

  // ============================================================================
  // UI MODIFIERS TESTS
  // ============================================================================

  describe('UI modifiers', () => {
    describe('weapon counters display', () => {
      it('shows weapon counters array', () => {
        const enemy = createArmoredTusks();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.weaponCounters).toBeDefined();
        expect(Array.isArray(uiMods.weaponCounters)).toBe(true);
      });

      it('shows exactly 2 weapon counters', () => {
        const enemy = createArmoredTusks();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.weaponCounters).toHaveLength(2);
      });

      it('shows fire weapon counter', () => {
        const enemy = createArmoredTusks();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.weaponCounters).toContainEqual({ type: 'fire', reduction: 35 });
      });

      it('shows explosion weapon counter', () => {
        const enemy = createArmoredTusks();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.weaponCounters).toContainEqual({ type: 'explosion', reduction: 35 });
      });

      it('weapon counters have correct structure', () => {
        const enemy = createArmoredTusks();
        const uiMods = enemy.getUIModifiers();
        for (const counter of uiMods.weaponCounters ?? []) {
          expect(counter).toHaveProperty('type');
          expect(counter).toHaveProperty('reduction');
          expect(typeof counter.type).toBe('string');
          expect(typeof counter.reduction).toBe('number');
        }
      });
    });

    describe('other UI modifiers', () => {
      it('does not show inactivity bar', () => {
        const enemy = createArmoredTusks();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.showInactivityBar).toBeUndefined();
      });

      it('does not show score decay', () => {
        const enemy = createArmoredTusks();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.showScoreDecay).toBeUndefined();
      });

      it('does not modify timer speed', () => {
        const enemy = createArmoredTusks();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.timerSpeedMultiplier).toBeUndefined();
      });

      it('does not disable auto hint', () => {
        const enemy = createArmoredTusks();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.disableAutoHint).toBeUndefined();
      });

      it('does not disable manual hint', () => {
        const enemy = createArmoredTusks();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.disableManualHint).toBeUndefined();
      });

      it('does not show countdown cards', () => {
        const enemy = createArmoredTusks();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.showCountdownCards).toBeUndefined();
      });

      it('does not show bomb cards', () => {
        const enemy = createArmoredTusks();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.showBombCards).toBeUndefined();
      });
    });
  });

  // ============================================================================
  // DEFEAT CONDITION TESTS
  // ============================================================================

  describe('defeat condition', () => {
    describe('no effects triggered', () => {
      it('returns false with empty weaponEffectsTriggered set', () => {
        const enemy = createArmoredTusks();
        const stats = createRoundStats({
          weaponEffectsTriggered: new Set(),
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });

    describe('single effect triggered', () => {
      it('returns false with only fire triggered', () => {
        const enemy = createArmoredTusks();
        const stats = createRoundStats({
          weaponEffectsTriggered: new Set(['fire']),
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false with only explosion triggered', () => {
        const enemy = createArmoredTusks();
        const stats = createRoundStats({
          weaponEffectsTriggered: new Set(['explosion']),
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false with only laser triggered', () => {
        const enemy = createArmoredTusks();
        const stats = createRoundStats({
          weaponEffectsTriggered: new Set(['laser']),
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });

    describe('two destruction effects triggered', () => {
      it('returns true with fire and explosion', () => {
        const enemy = createArmoredTusks();
        const stats = createRoundStats({
          weaponEffectsTriggered: new Set(['fire', 'explosion']),
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true with fire and laser', () => {
        const enemy = createArmoredTusks();
        const stats = createRoundStats({
          weaponEffectsTriggered: new Set(['fire', 'laser']),
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true with explosion and laser', () => {
        const enemy = createArmoredTusks();
        const stats = createRoundStats({
          weaponEffectsTriggered: new Set(['explosion', 'laser']),
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('all three destruction effects triggered', () => {
      it('returns true with fire, explosion, and laser', () => {
        const enemy = createArmoredTusks();
        const stats = createRoundStats({
          weaponEffectsTriggered: new Set(['fire', 'explosion', 'laser']),
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('non-destruction effects do not count', () => {
      it('returns false with fire and hint', () => {
        const enemy = createArmoredTusks();
        const stats = createRoundStats({
          weaponEffectsTriggered: new Set(['fire', 'hint']),
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false with fire and grace', () => {
        const enemy = createArmoredTusks();
        const stats = createRoundStats({
          weaponEffectsTriggered: new Set(['fire', 'grace']),
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false with fire and time', () => {
        const enemy = createArmoredTusks();
        const stats = createRoundStats({
          weaponEffectsTriggered: new Set(['fire', 'time']),
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false with fire and healing', () => {
        const enemy = createArmoredTusks();
        const stats = createRoundStats({
          weaponEffectsTriggered: new Set(['fire', 'healing']),
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false with explosion and hint', () => {
        const enemy = createArmoredTusks();
        const stats = createRoundStats({
          weaponEffectsTriggered: new Set(['explosion', 'hint']),
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false with explosion and grace', () => {
        const enemy = createArmoredTusks();
        const stats = createRoundStats({
          weaponEffectsTriggered: new Set(['explosion', 'grace']),
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false with laser and hint', () => {
        const enemy = createArmoredTusks();
        const stats = createRoundStats({
          weaponEffectsTriggered: new Set(['laser', 'hint']),
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false with only non-destruction effects', () => {
        const enemy = createArmoredTusks();
        const stats = createRoundStats({
          weaponEffectsTriggered: new Set(['hint', 'grace', 'time', 'healing']),
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });

    describe('mixed destruction and non-destruction effects', () => {
      it('returns true with fire, explosion, and hint', () => {
        const enemy = createArmoredTusks();
        const stats = createRoundStats({
          weaponEffectsTriggered: new Set(['fire', 'explosion', 'hint']),
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true with fire, laser, and grace', () => {
        const enemy = createArmoredTusks();
        const stats = createRoundStats({
          weaponEffectsTriggered: new Set(['fire', 'laser', 'grace']),
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true with explosion, laser, and time', () => {
        const enemy = createArmoredTusks();
        const stats = createRoundStats({
          weaponEffectsTriggered: new Set(['explosion', 'laser', 'time']),
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true with all effects triggered', () => {
        const enemy = createArmoredTusks();
        const stats = createRoundStats({
          weaponEffectsTriggered: new Set([
            'fire',
            'explosion',
            'laser',
            'hint',
            'grace',
            'time',
            'healing',
          ]),
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns false with one destruction effect plus many non-destruction', () => {
        const enemy = createArmoredTusks();
        const stats = createRoundStats({
          weaponEffectsTriggered: new Set(['fire', 'hint', 'grace', 'time', 'healing', 'holographic']),
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });
  });

  // ============================================================================
  // LIFECYCLE HOOKS TESTS
  // ============================================================================

  describe('lifecycle hooks', () => {
    describe('onRoundStart', () => {
      it('returns empty card modifications', () => {
        const enemy = createArmoredTusks();
        const board = createTestBoard();
        const result = enemy.onRoundStart(board);
        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty events', () => {
        const enemy = createArmoredTusks();
        const board = createTestBoard();
        const result = enemy.onRoundStart(board);
        expect(result.events).toEqual([]);
      });

      it('handles empty board', () => {
        const enemy = createArmoredTusks();
        const result = enemy.onRoundStart([]);
        expect(result.cardModifications).toEqual([]);
        expect(result.events).toEqual([]);
      });

      it('handles varied board', () => {
        const enemy = createArmoredTusks();
        const board = createVariedBoard();
        const result = enemy.onRoundStart(board);
        expect(result.cardModifications).toEqual([]);
        expect(result.events).toEqual([]);
      });
    });

    describe('onTick', () => {
      it('returns zero score delta', () => {
        const enemy = createArmoredTusks();
        const board = createTestBoard();
        enemy.onRoundStart(board);
        const result = enemy.onTick(1000, board);
        expect(result.scoreDelta).toBe(0);
      });

      it('returns zero health delta', () => {
        const enemy = createArmoredTusks();
        const board = createTestBoard();
        enemy.onRoundStart(board);
        const result = enemy.onTick(1000, board);
        expect(result.healthDelta).toBe(0);
      });

      it('returns zero time delta', () => {
        const enemy = createArmoredTusks();
        const board = createTestBoard();
        enemy.onRoundStart(board);
        const result = enemy.onTick(1000, board);
        expect(result.timeDelta).toBe(0);
      });

      it('does not remove any cards', () => {
        const enemy = createArmoredTusks();
        const board = createTestBoard();
        enemy.onRoundStart(board);
        const result = enemy.onTick(1000, board);
        expect(result.cardsToRemove).toEqual([]);
      });

      it('does not modify any cards', () => {
        const enemy = createArmoredTusks();
        const board = createTestBoard();
        enemy.onRoundStart(board);
        const result = enemy.onTick(1000, board);
        expect(result.cardModifications).toEqual([]);
      });

      it('does not flip any cards', () => {
        const enemy = createArmoredTusks();
        const board = createTestBoard();
        enemy.onRoundStart(board);
        const result = enemy.onTick(1000, board);
        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events', () => {
        const enemy = createArmoredTusks();
        const board = createTestBoard();
        enemy.onRoundStart(board);
        const result = enemy.onTick(1000, board);
        expect(result.events).toEqual([]);
      });

      it('does not cause instant death', () => {
        const enemy = createArmoredTusks();
        const board = createTestBoard();
        enemy.onRoundStart(board);
        const result = enemy.onTick(1000, board);
        expect(result.instantDeath).toBe(false);
      });

      it('remains neutral after many ticks', () => {
        const enemy = createArmoredTusks();
        const board = createTestBoard();
        enemy.onRoundStart(board);
        // Simulate 60 seconds of gameplay
        for (let i = 0; i < 60; i++) {
          const result = enemy.onTick(1000, board);
          expect(result.scoreDelta).toBe(0);
          expect(result.healthDelta).toBe(0);
          expect(result.instantDeath).toBe(false);
        }
      });
    });

    describe('onValidMatch', () => {
      it('returns zero time delta', () => {
        const enemy = createArmoredTusks();
        const board = createTestBoard();
        const result = enemy.onValidMatch([board[0], board[1], board[2]], board);
        expect(result.timeDelta).toBe(0);
      });

      it('returns 1.0 points multiplier (no bonus/penalty)', () => {
        const enemy = createArmoredTusks();
        const board = createTestBoard();
        const result = enemy.onValidMatch([board[0], board[1], board[2]], board);
        expect(result.pointsMultiplier).toBe(1);
      });

      it('does not remove extra cards', () => {
        const enemy = createArmoredTusks();
        const board = createTestBoard();
        const result = enemy.onValidMatch([board[0], board[1], board[2]], board);
        expect(result.cardsToRemove).toEqual([]);
      });

      it('does not flip cards', () => {
        const enemy = createArmoredTusks();
        const board = createTestBoard();
        const result = enemy.onValidMatch([board[0], board[1], board[2]], board);
        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events', () => {
        const enemy = createArmoredTusks();
        const board = createTestBoard();
        const result = enemy.onValidMatch([board[0], board[1], board[2]], board);
        expect(result.events).toEqual([]);
      });

      it('handles empty matched cards array', () => {
        const enemy = createArmoredTusks();
        const board = createTestBoard();
        const result = enemy.onValidMatch([], board);
        expect(result.pointsMultiplier).toBe(1);
        expect(result.timeDelta).toBe(0);
      });
    });

    describe('onInvalidMatch', () => {
      it('returns zero time delta', () => {
        const enemy = createArmoredTusks();
        const board = createTestBoard();
        const result = enemy.onInvalidMatch([board[0], board[1], board[2]], board);
        expect(result.timeDelta).toBe(0);
      });

      it('returns 1.0 points multiplier', () => {
        const enemy = createArmoredTusks();
        const board = createTestBoard();
        const result = enemy.onInvalidMatch([board[0], board[1], board[2]], board);
        expect(result.pointsMultiplier).toBe(1);
      });

      it('does not remove extra cards', () => {
        const enemy = createArmoredTusks();
        const board = createTestBoard();
        const result = enemy.onInvalidMatch([board[0], board[1], board[2]], board);
        expect(result.cardsToRemove).toEqual([]);
      });

      it('does not flip cards', () => {
        const enemy = createArmoredTusks();
        const board = createTestBoard();
        const result = enemy.onInvalidMatch([board[0], board[1], board[2]], board);
        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events', () => {
        const enemy = createArmoredTusks();
        const board = createTestBoard();
        const result = enemy.onInvalidMatch([board[0], board[1], board[2]], board);
        expect(result.events).toEqual([]);
      });
    });

    describe('onCardDraw', () => {
      it('returns card unchanged', () => {
        const enemy = createArmoredTusks();
        const card = createCard({ shape: 'diamond', color: 'purple', number: 3 });
        const result = enemy.onCardDraw(card);
        expect(result).toEqual(card);
      });

      it('does not add dud property', () => {
        const enemy = createArmoredTusks();
        const card = createCard();
        const result = enemy.onCardDraw(card);
        expect(result.isDud).toBeUndefined();
      });

      it('does not add face-down property', () => {
        const enemy = createArmoredTusks();
        const card = createCard();
        const result = enemy.onCardDraw(card);
        expect(result.isFaceDown).toBeUndefined();
      });

      it('does not add bomb property', () => {
        const enemy = createArmoredTusks();
        const card = createCard();
        const result = enemy.onCardDraw(card);
        expect(result.hasBomb).toBeUndefined();
      });

      it('does not add countdown property', () => {
        const enemy = createArmoredTusks();
        const card = createCard();
        const result = enemy.onCardDraw(card);
        expect(result.hasCountdown).toBeUndefined();
      });

      it('preserves all card attributes', () => {
        const enemy = createArmoredTusks();
        const card = createCard({
          id: 'special-card',
          shape: 'squiggle',
          color: 'green',
          number: 2,
          shading: 'striped',
        });
        const result = enemy.onCardDraw(card);
        expect(result.id).toBe('special-card');
        expect(result.shape).toBe('squiggle');
        expect(result.color).toBe('green');
        expect(result.number).toBe(2);
        expect(result.shading).toBe('striped');
      });

      it('preserves existing card properties', () => {
        const enemy = createArmoredTusks();
        const card = createCard({
          selected: true,
          health: 2,
          onFire: true,
        });
        const result = enemy.onCardDraw(card);
        expect(result.selected).toBe(true);
        expect(result.health).toBe(2);
        expect(result.onFire).toBe(true);
      });
    });

    describe('onRoundEnd', () => {
      it('executes without error', () => {
        const enemy = createArmoredTusks();
        expect(() => enemy.onRoundEnd()).not.toThrow();
      });

      it('can be called multiple times', () => {
        const enemy = createArmoredTusks();
        expect(() => {
          enemy.onRoundEnd();
          enemy.onRoundEnd();
          enemy.onRoundEnd();
        }).not.toThrow();
      });
    });
  });

  // ============================================================================
  // MULTIPLE INSTANCE TESTS
  // ============================================================================

  describe('multiple instances', () => {
    it('creates independent instances', () => {
      const enemy1 = createArmoredTusks();
      const enemy2 = createArmoredTusks();
      expect(enemy1).not.toBe(enemy2);
    });

    it('instances have same metadata', () => {
      const enemy1 = createArmoredTusks();
      const enemy2 = createArmoredTusks();
      expect(enemy1.name).toBe(enemy2.name);
      expect(enemy1.tier).toBe(enemy2.tier);
      expect(enemy1.icon).toBe(enemy2.icon);
      expect(enemy1.description).toBe(enemy2.description);
    });

    it('instances have same stat modifiers', () => {
      const enemy1 = createArmoredTusks();
      const enemy2 = createArmoredTusks();
      expect(enemy1.getStatModifiers()).toEqual(enemy2.getStatModifiers());
    });

    it('instances have same UI modifiers', () => {
      const enemy1 = createArmoredTusks();
      const enemy2 = createArmoredTusks();
      expect(enemy1.getUIModifiers()).toEqual(enemy2.getUIModifiers());
    });

    it('defeat condition works independently', () => {
      const enemy1 = createArmoredTusks();
      const enemy2 = createArmoredTusks();
      const defeatedStats = createRoundStats({
        weaponEffectsTriggered: new Set(['fire', 'explosion']),
      });
      const notDefeatedStats = createRoundStats({
        weaponEffectsTriggered: new Set(['fire']),
      });
      expect(enemy1.checkDefeatCondition(defeatedStats)).toBe(true);
      expect(enemy2.checkDefeatCondition(notDefeatedStats)).toBe(false);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('edge cases', () => {
    it('handles checkDefeatCondition with null-like stats gracefully', () => {
      const enemy = createArmoredTusks();
      const stats = createRoundStats();
      // Ensure the set is empty but defined
      stats.weaponEffectsTriggered = new Set();
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('handles unknown weapon effects in set', () => {
      const enemy = createArmoredTusks();
      const stats = createRoundStats({
        weaponEffectsTriggered: new Set(['unknown1', 'unknown2', 'unknown3']),
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('handles large board in onRoundStart', () => {
      const enemy = createArmoredTusks();
      const largeBoard: Card[] = Array(50)
        .fill(null)
        .map((_, i) => createCard({ id: `card-${i}` }));
      const result = enemy.onRoundStart(largeBoard);
      expect(result.cardModifications).toEqual([]);
    });

    it('handles very small deltaMs in onTick', () => {
      const enemy = createArmoredTusks();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      const result = enemy.onTick(1, board);
      expect(result.scoreDelta).toBe(0);
      expect(result.healthDelta).toBe(0);
    });

    it('handles very large deltaMs in onTick', () => {
      const enemy = createArmoredTusks();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      const result = enemy.onTick(100000, board);
      expect(result.scoreDelta).toBe(0);
      expect(result.healthDelta).toBe(0);
      expect(result.instantDeath).toBe(false);
    });

    it('stat modifiers remain consistent across multiple calls', () => {
      const enemy = createArmoredTusks();
      const mods1 = enemy.getStatModifiers();
      const mods2 = enemy.getStatModifiers();
      const mods3 = enemy.getStatModifiers();
      expect(mods1).toEqual(mods2);
      expect(mods2).toEqual(mods3);
    });

    it('UI modifiers remain consistent across multiple calls', () => {
      const enemy = createArmoredTusks();
      const mods1 = enemy.getUIModifiers();
      const mods2 = enemy.getUIModifiers();
      const mods3 = enemy.getUIModifiers();
      expect(mods1).toEqual(mods2);
      expect(mods2).toEqual(mods3);
    });
  });

  // ============================================================================
  // INTEGRATION-STYLE TESTS
  // ============================================================================

  describe('full round simulation', () => {
    it('maintains neutral behavior throughout a round', () => {
      const enemy = createArmoredTusks();
      const board = createTestBoard();

      // Start round
      const startResult = enemy.onRoundStart(board);
      expect(startResult.cardModifications).toEqual([]);

      // Simulate 10 seconds with multiple matches
      for (let i = 0; i < 10; i++) {
        const tickResult = enemy.onTick(1000, board);
        expect(tickResult.scoreDelta).toBe(0);
        expect(tickResult.healthDelta).toBe(0);
        expect(tickResult.instantDeath).toBe(false);
      }

      // Make a valid match
      const matchResult = enemy.onValidMatch([board[0], board[1], board[2]], board);
      expect(matchResult.pointsMultiplier).toBe(1);
      expect(matchResult.timeDelta).toBe(0);

      // Check defeat condition (should be false with no effects)
      const stats = createRoundStats();
      expect(enemy.checkDefeatCondition(stats)).toBe(false);

      // End round
      enemy.onRoundEnd();
    });

    it('can be defeated by triggering two destruction effects', () => {
      const enemy = createArmoredTusks();
      const board = createTestBoard();

      enemy.onRoundStart(board);

      // Simulate triggering fire effect
      let stats = createRoundStats({
        weaponEffectsTriggered: new Set(['fire']),
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);

      // Simulate triggering explosion effect
      stats = createRoundStats({
        weaponEffectsTriggered: new Set(['fire', 'explosion']),
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  // ============================================================================
  // TYPE SAFETY TESTS
  // ============================================================================

  describe('type safety', () => {
    it('implements all EnemyInstance methods', () => {
      const enemy = createArmoredTusks();
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

    it('returns correct types from all methods', () => {
      const enemy = createArmoredTusks();
      const board = createTestBoard();
      const card = createCard();
      const stats = createRoundStats();

      const startResult = enemy.onRoundStart(board);
      expect(Array.isArray(startResult.cardModifications)).toBe(true);
      expect(Array.isArray(startResult.events)).toBe(true);

      const tickResult = enemy.onTick(1000, board);
      expect(typeof tickResult.scoreDelta).toBe('number');
      expect(typeof tickResult.healthDelta).toBe('number');
      expect(typeof tickResult.timeDelta).toBe('number');
      expect(Array.isArray(tickResult.cardsToRemove)).toBe(true);
      expect(Array.isArray(tickResult.cardModifications)).toBe(true);
      expect(Array.isArray(tickResult.cardsToFlip)).toBe(true);
      expect(Array.isArray(tickResult.events)).toBe(true);
      expect(typeof tickResult.instantDeath).toBe('boolean');

      const matchResult = enemy.onValidMatch([], board);
      expect(typeof matchResult.timeDelta).toBe('number');
      expect(typeof matchResult.pointsMultiplier).toBe('number');
      expect(Array.isArray(matchResult.cardsToRemove)).toBe(true);
      expect(Array.isArray(matchResult.cardsToFlip)).toBe(true);
      expect(Array.isArray(matchResult.events)).toBe(true);

      const drawnCard = enemy.onCardDraw(card);
      expect(typeof drawnCard.id).toBe('string');
      expect(typeof drawnCard.shape).toBe('string');

      const defeatResult = enemy.checkDefeatCondition(stats);
      expect(typeof defeatResult).toBe('boolean');

      const uiMods = enemy.getUIModifiers();
      expect(typeof uiMods).toBe('object');

      const statMods = enemy.getStatModifiers();
      expect(typeof statMods).toBe('object');
    });
  });
});
