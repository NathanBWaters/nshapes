/**
 * Comprehensive Unit Tests for Creeping Shadow (Tier 2)
 *
 * Effects:
 * - HintDisableEffect: Disables both auto and manual hints
 * - WeaponCounterEffect: Reduces hint gain chance by 35%
 *
 * Defeat Condition: Match each color (red, green, purple) at least 3 times
 */
import { createCreepingShadow } from '@/utils/enemies/tier2/creepingShadow';
import {
  createRoundStats,
  createCard,
  createTestBoard,
  createVariedBoard,
  createFaceDownCard,
  resetCardIdCounter,
} from '../../testUtils';
import type { Card, Color } from '@/types';
import type { EnemyInstance } from '@/types/enemy';

describe('Creeping Shadow', () => {
  let enemy: EnemyInstance;

  beforeEach(() => {
    resetCardIdCounter();
    enemy = createCreepingShadow();
  });

  // ==========================================================================
  // METADATA TESTS
  // ==========================================================================
  describe('metadata', () => {
    it('has correct name', () => {
      expect(enemy.name).toBe('Creeping Shadow');
    });

    it('has correct tier', () => {
      expect(enemy.tier).toBe(2);
    });

    it('has correct icon', () => {
      expect(enemy.icon).toBe('lorc/beast-eye');
    });

    it('has description mentioning no hints', () => {
      expect(enemy.description).toContain('hint');
    });

    it('has description mentioning hint gain reduction', () => {
      expect(enemy.description).toContain('-35%');
    });

    it('has defeat condition text mentioning colors', () => {
      expect(enemy.defeatConditionText).toContain('color');
    });

    it('has defeat condition text mentioning 3 times', () => {
      expect(enemy.defeatConditionText).toContain('3');
    });

    it('creates a new instance each time', () => {
      const enemy1 = createCreepingShadow();
      const enemy2 = createCreepingShadow();
      expect(enemy1).not.toBe(enemy2);
    });

    it('has a string name (not empty)', () => {
      expect(typeof enemy.name).toBe('string');
      expect(enemy.name.length).toBeGreaterThan(0);
    });

    it('has a valid tier number', () => {
      expect([1, 2, 3, 4]).toContain(enemy.tier);
    });
  });

  // ==========================================================================
  // HINT DISABLE EFFECT TESTS
  // ==========================================================================
  describe('hint disable effect', () => {
    describe('auto hints', () => {
      it('disables auto hints', () => {
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.disableAutoHint).toBe(true);
      });

      it('disables auto hints immediately after creation', () => {
        const freshEnemy = createCreepingShadow();
        const uiMods = freshEnemy.getUIModifiers();
        expect(uiMods.disableAutoHint).toBe(true);
      });

      it('keeps auto hints disabled after round start', () => {
        enemy.onRoundStart(createTestBoard());
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.disableAutoHint).toBe(true);
      });

      it('keeps auto hints disabled after valid match', () => {
        enemy.onRoundStart(createTestBoard());
        enemy.onValidMatch([createCard()], createTestBoard());
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.disableAutoHint).toBe(true);
      });

      it('keeps auto hints disabled after invalid match', () => {
        enemy.onRoundStart(createTestBoard());
        enemy.onInvalidMatch([createCard()], createTestBoard());
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.disableAutoHint).toBe(true);
      });

      it('keeps auto hints disabled after multiple ticks', () => {
        enemy.onRoundStart(createTestBoard());
        for (let i = 0; i < 10; i++) {
          enemy.onTick(1000, createTestBoard());
        }
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.disableAutoHint).toBe(true);
      });

      it('keeps auto hints disabled throughout entire round', () => {
        enemy.onRoundStart(createTestBoard());
        enemy.onTick(30000, createTestBoard());
        enemy.onValidMatch([createCard()], createTestBoard());
        enemy.onTick(15000, createTestBoard());
        enemy.onInvalidMatch([createCard()], createTestBoard());
        enemy.onTick(10000, createTestBoard());
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.disableAutoHint).toBe(true);
      });
    });

    describe('manual hints', () => {
      it('disables manual hints', () => {
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.disableManualHint).toBe(true);
      });

      it('disables manual hints immediately after creation', () => {
        const freshEnemy = createCreepingShadow();
        const uiMods = freshEnemy.getUIModifiers();
        expect(uiMods.disableManualHint).toBe(true);
      });

      it('keeps manual hints disabled after round start', () => {
        enemy.onRoundStart(createTestBoard());
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.disableManualHint).toBe(true);
      });

      it('keeps manual hints disabled after valid match', () => {
        enemy.onRoundStart(createTestBoard());
        enemy.onValidMatch([createCard()], createTestBoard());
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.disableManualHint).toBe(true);
      });

      it('keeps manual hints disabled after invalid match', () => {
        enemy.onRoundStart(createTestBoard());
        enemy.onInvalidMatch([createCard()], createTestBoard());
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.disableManualHint).toBe(true);
      });

      it('keeps manual hints disabled after round end', () => {
        enemy.onRoundStart(createTestBoard());
        enemy.onRoundEnd();
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.disableManualHint).toBe(true);
      });
    });

    describe('both hints disabled together', () => {
      it('disables both auto and manual hints simultaneously', () => {
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.disableAutoHint).toBe(true);
        expect(uiMods.disableManualHint).toBe(true);
      });

      it('returns consistent values across multiple calls', () => {
        const uiMods1 = enemy.getUIModifiers();
        const uiMods2 = enemy.getUIModifiers();
        const uiMods3 = enemy.getUIModifiers();
        expect(uiMods1.disableAutoHint).toBe(uiMods2.disableAutoHint);
        expect(uiMods2.disableAutoHint).toBe(uiMods3.disableAutoHint);
        expect(uiMods1.disableManualHint).toBe(uiMods2.disableManualHint);
        expect(uiMods2.disableManualHint).toBe(uiMods3.disableManualHint);
      });
    });
  });

  // ==========================================================================
  // HINT WEAPON COUNTER EFFECT TESTS
  // ==========================================================================
  describe('hint weapon counter effect', () => {
    describe('stat modifiers', () => {
      it('reduces hint gain chance by 35%', () => {
        const statMods = enemy.getStatModifiers();
        expect(statMods.hintGainChanceReduction).toBe(35);
      });

      it('returns hint gain reduction immediately after creation', () => {
        const freshEnemy = createCreepingShadow();
        const statMods = freshEnemy.getStatModifiers();
        expect(statMods.hintGainChanceReduction).toBe(35);
      });

      it('returns consistent reduction value across multiple calls', () => {
        const statMods1 = enemy.getStatModifiers();
        const statMods2 = enemy.getStatModifiers();
        expect(statMods1.hintGainChanceReduction).toBe(statMods2.hintGainChanceReduction);
      });

      it('does not modify other stat modifiers', () => {
        const statMods = enemy.getStatModifiers();
        expect(statMods.fireSpreadChanceReduction).toBeUndefined();
        expect(statMods.explosionChanceReduction).toBeUndefined();
        expect(statMods.laserChanceReduction).toBeUndefined();
        expect(statMods.graceGainChanceReduction).toBeUndefined();
        expect(statMods.timeGainChanceReduction).toBeUndefined();
        expect(statMods.healingChanceReduction).toBeUndefined();
        expect(statMods.damageMultiplier).toBeUndefined();
        expect(statMods.pointsMultiplier).toBeUndefined();
      });

      it('keeps reduction after round start', () => {
        enemy.onRoundStart(createTestBoard());
        const statMods = enemy.getStatModifiers();
        expect(statMods.hintGainChanceReduction).toBe(35);
      });

      it('keeps reduction after ticks', () => {
        enemy.onRoundStart(createTestBoard());
        enemy.onTick(10000, createTestBoard());
        const statMods = enemy.getStatModifiers();
        expect(statMods.hintGainChanceReduction).toBe(35);
      });

      it('keeps reduction after matches', () => {
        enemy.onRoundStart(createTestBoard());
        enemy.onValidMatch([createCard()], createTestBoard());
        const statMods = enemy.getStatModifiers();
        expect(statMods.hintGainChanceReduction).toBe(35);
      });
    });

    describe('UI weapon counters', () => {
      it('shows weapon counter in UI modifiers', () => {
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.weaponCounters).toContainEqual({ type: 'hint', reduction: 35 });
      });

      it('weapon counter has correct type', () => {
        const uiMods = enemy.getUIModifiers();
        const hintCounter = uiMods.weaponCounters?.find((c) => c.type === 'hint');
        expect(hintCounter).toBeDefined();
        expect(hintCounter?.type).toBe('hint');
      });

      it('weapon counter has correct reduction value', () => {
        const uiMods = enemy.getUIModifiers();
        const hintCounter = uiMods.weaponCounters?.find((c) => c.type === 'hint');
        expect(hintCounter?.reduction).toBe(35);
      });

      it('has exactly one weapon counter', () => {
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.weaponCounters?.length).toBe(1);
      });

      it('does not have other weapon counter types', () => {
        const uiMods = enemy.getUIModifiers();
        const nonHintCounters = uiMods.weaponCounters?.filter((c) => c.type !== 'hint');
        expect(nonHintCounters?.length).toBe(0);
      });
    });
  });

  // ==========================================================================
  // DEFEAT CONDITION TESTS
  // ==========================================================================
  describe('defeat condition', () => {
    describe('color requirements - all colors', () => {
      it('returns false when no colors have been matched', () => {
        const stats = createRoundStats();
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when only red has 3+ matches', () => {
        const stats = createRoundStats();
        stats.colorMatchCounts.set('red', 3);
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when only green has 3+ matches', () => {
        const stats = createRoundStats();
        stats.colorMatchCounts.set('green', 3);
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when only purple has 3+ matches', () => {
        const stats = createRoundStats();
        stats.colorMatchCounts.set('purple', 3);
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when red and green have 3+ matches but purple is missing', () => {
        const stats = createRoundStats();
        stats.colorMatchCounts.set('red', 5);
        stats.colorMatchCounts.set('green', 5);
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when red and purple have 3+ matches but green is missing', () => {
        const stats = createRoundStats();
        stats.colorMatchCounts.set('red', 5);
        stats.colorMatchCounts.set('purple', 5);
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when green and purple have 3+ matches but red is missing', () => {
        const stats = createRoundStats();
        stats.colorMatchCounts.set('green', 5);
        stats.colorMatchCounts.set('purple', 5);
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true when all 3 colors have exactly 3 matches', () => {
        const stats = createRoundStats();
        stats.colorMatchCounts.set('red', 3);
        stats.colorMatchCounts.set('green', 3);
        stats.colorMatchCounts.set('purple', 3);
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when all colors have more than 3 matches', () => {
        const stats = createRoundStats();
        stats.colorMatchCounts.set('red', 5);
        stats.colorMatchCounts.set('green', 4);
        stats.colorMatchCounts.set('purple', 6);
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('color requirements - individual colors', () => {
      describe('red color', () => {
        it('returns false when red has 0 matches', () => {
          const stats = createRoundStats();
          stats.colorMatchCounts.set('green', 5);
          stats.colorMatchCounts.set('purple', 5);
          expect(enemy.checkDefeatCondition(stats)).toBe(false);
        });

        it('returns false when red has 1 match', () => {
          const stats = createRoundStats();
          stats.colorMatchCounts.set('red', 1);
          stats.colorMatchCounts.set('green', 5);
          stats.colorMatchCounts.set('purple', 5);
          expect(enemy.checkDefeatCondition(stats)).toBe(false);
        });

        it('returns false when red has 2 matches', () => {
          const stats = createRoundStats();
          stats.colorMatchCounts.set('red', 2);
          stats.colorMatchCounts.set('green', 5);
          stats.colorMatchCounts.set('purple', 5);
          expect(enemy.checkDefeatCondition(stats)).toBe(false);
        });

        it('returns true when red has exactly 3 matches', () => {
          const stats = createRoundStats();
          stats.colorMatchCounts.set('red', 3);
          stats.colorMatchCounts.set('green', 3);
          stats.colorMatchCounts.set('purple', 3);
          expect(enemy.checkDefeatCondition(stats)).toBe(true);
        });

        it('returns true when red has more than 3 matches', () => {
          const stats = createRoundStats();
          stats.colorMatchCounts.set('red', 10);
          stats.colorMatchCounts.set('green', 3);
          stats.colorMatchCounts.set('purple', 3);
          expect(enemy.checkDefeatCondition(stats)).toBe(true);
        });
      });

      describe('green color', () => {
        it('returns false when green has 0 matches', () => {
          const stats = createRoundStats();
          stats.colorMatchCounts.set('red', 5);
          stats.colorMatchCounts.set('purple', 5);
          expect(enemy.checkDefeatCondition(stats)).toBe(false);
        });

        it('returns false when green has 1 match', () => {
          const stats = createRoundStats();
          stats.colorMatchCounts.set('red', 5);
          stats.colorMatchCounts.set('green', 1);
          stats.colorMatchCounts.set('purple', 5);
          expect(enemy.checkDefeatCondition(stats)).toBe(false);
        });

        it('returns false when green has 2 matches', () => {
          const stats = createRoundStats();
          stats.colorMatchCounts.set('red', 5);
          stats.colorMatchCounts.set('green', 2);
          stats.colorMatchCounts.set('purple', 5);
          expect(enemy.checkDefeatCondition(stats)).toBe(false);
        });

        it('returns true when green has exactly 3 matches', () => {
          const stats = createRoundStats();
          stats.colorMatchCounts.set('red', 3);
          stats.colorMatchCounts.set('green', 3);
          stats.colorMatchCounts.set('purple', 3);
          expect(enemy.checkDefeatCondition(stats)).toBe(true);
        });

        it('returns true when green has more than 3 matches', () => {
          const stats = createRoundStats();
          stats.colorMatchCounts.set('red', 3);
          stats.colorMatchCounts.set('green', 10);
          stats.colorMatchCounts.set('purple', 3);
          expect(enemy.checkDefeatCondition(stats)).toBe(true);
        });
      });

      describe('purple color', () => {
        it('returns false when purple has 0 matches', () => {
          const stats = createRoundStats();
          stats.colorMatchCounts.set('red', 5);
          stats.colorMatchCounts.set('green', 5);
          expect(enemy.checkDefeatCondition(stats)).toBe(false);
        });

        it('returns false when purple has 1 match', () => {
          const stats = createRoundStats();
          stats.colorMatchCounts.set('red', 5);
          stats.colorMatchCounts.set('green', 5);
          stats.colorMatchCounts.set('purple', 1);
          expect(enemy.checkDefeatCondition(stats)).toBe(false);
        });

        it('returns false when purple has 2 matches', () => {
          const stats = createRoundStats();
          stats.colorMatchCounts.set('red', 3);
          stats.colorMatchCounts.set('green', 3);
          stats.colorMatchCounts.set('purple', 2);
          expect(enemy.checkDefeatCondition(stats)).toBe(false);
        });

        it('returns true when purple has exactly 3 matches', () => {
          const stats = createRoundStats();
          stats.colorMatchCounts.set('red', 3);
          stats.colorMatchCounts.set('green', 3);
          stats.colorMatchCounts.set('purple', 3);
          expect(enemy.checkDefeatCondition(stats)).toBe(true);
        });

        it('returns true when purple has more than 3 matches', () => {
          const stats = createRoundStats();
          stats.colorMatchCounts.set('red', 3);
          stats.colorMatchCounts.set('green', 3);
          stats.colorMatchCounts.set('purple', 10);
          expect(enemy.checkDefeatCondition(stats)).toBe(true);
        });
      });
    });

    describe('boundary conditions', () => {
      it('returns false when all colors have exactly 2 matches', () => {
        const stats = createRoundStats();
        stats.colorMatchCounts.set('red', 2);
        stats.colorMatchCounts.set('green', 2);
        stats.colorMatchCounts.set('purple', 2);
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when two colors have 2 matches and one has 3', () => {
        const stats = createRoundStats();
        stats.colorMatchCounts.set('red', 3);
        stats.colorMatchCounts.set('green', 2);
        stats.colorMatchCounts.set('purple', 2);
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when one color has 2 matches and two have 3', () => {
        const stats = createRoundStats();
        stats.colorMatchCounts.set('red', 3);
        stats.colorMatchCounts.set('green', 3);
        stats.colorMatchCounts.set('purple', 2);
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('handles large match counts', () => {
        const stats = createRoundStats();
        stats.colorMatchCounts.set('red', 100);
        stats.colorMatchCounts.set('green', 100);
        stats.colorMatchCounts.set('purple', 100);
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns false with empty colorMatchCounts map', () => {
        const stats = createRoundStats();
        // Map is empty by default
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });

    describe('progressive defeat scenarios', () => {
      it('tracks progress toward defeat - step 1', () => {
        const stats = createRoundStats();
        stats.colorMatchCounts.set('red', 1);
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('tracks progress toward defeat - step 2', () => {
        const stats = createRoundStats();
        stats.colorMatchCounts.set('red', 2);
        stats.colorMatchCounts.set('green', 1);
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('tracks progress toward defeat - step 3', () => {
        const stats = createRoundStats();
        stats.colorMatchCounts.set('red', 3);
        stats.colorMatchCounts.set('green', 2);
        stats.colorMatchCounts.set('purple', 1);
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('tracks progress toward defeat - step 4', () => {
        const stats = createRoundStats();
        stats.colorMatchCounts.set('red', 3);
        stats.colorMatchCounts.set('green', 3);
        stats.colorMatchCounts.set('purple', 2);
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('tracks progress toward defeat - final step (defeated)', () => {
        const stats = createRoundStats();
        stats.colorMatchCounts.set('red', 3);
        stats.colorMatchCounts.set('green', 3);
        stats.colorMatchCounts.set('purple', 3);
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('uneven distribution scenarios', () => {
      it('returns true with highly uneven distribution (10, 5, 3)', () => {
        const stats = createRoundStats();
        stats.colorMatchCounts.set('red', 10);
        stats.colorMatchCounts.set('green', 5);
        stats.colorMatchCounts.set('purple', 3);
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns false with highly uneven distribution (10, 5, 2)', () => {
        const stats = createRoundStats();
        stats.colorMatchCounts.set('red', 10);
        stats.colorMatchCounts.set('green', 5);
        stats.colorMatchCounts.set('purple', 2);
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true with all same count (4, 4, 4)', () => {
        const stats = createRoundStats();
        stats.colorMatchCounts.set('red', 4);
        stats.colorMatchCounts.set('green', 4);
        stats.colorMatchCounts.set('purple', 4);
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS TESTS
  // ==========================================================================
  describe('lifecycle hooks', () => {
    describe('onRoundStart', () => {
      it('returns empty cardModifications', () => {
        const result = enemy.onRoundStart(createTestBoard());
        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty events', () => {
        const result = enemy.onRoundStart(createTestBoard());
        expect(result.events).toEqual([]);
      });

      it('accepts empty board', () => {
        const result = enemy.onRoundStart([]);
        expect(result.cardModifications).toEqual([]);
        expect(result.events).toEqual([]);
      });

      it('accepts large board', () => {
        const result = enemy.onRoundStart(createTestBoard(18));
        expect(result.cardModifications).toEqual([]);
        expect(result.events).toEqual([]);
      });

      it('accepts varied board', () => {
        const result = enemy.onRoundStart(createVariedBoard());
        expect(result.cardModifications).toEqual([]);
        expect(result.events).toEqual([]);
      });

      it('does not modify input board', () => {
        const board = createTestBoard();
        const originalBoard = JSON.stringify(board);
        enemy.onRoundStart(board);
        expect(JSON.stringify(board)).toBe(originalBoard);
      });
    });

    describe('onTick', () => {
      it('returns zero scoreDelta', () => {
        enemy.onRoundStart(createTestBoard());
        const result = enemy.onTick(1000, createTestBoard());
        expect(result.scoreDelta).toBe(0);
      });

      it('returns zero healthDelta', () => {
        enemy.onRoundStart(createTestBoard());
        const result = enemy.onTick(1000, createTestBoard());
        expect(result.healthDelta).toBe(0);
      });

      it('returns zero timeDelta', () => {
        enemy.onRoundStart(createTestBoard());
        const result = enemy.onTick(1000, createTestBoard());
        expect(result.timeDelta).toBe(0);
      });

      it('returns empty cardsToRemove', () => {
        enemy.onRoundStart(createTestBoard());
        const result = enemy.onTick(1000, createTestBoard());
        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty cardModifications', () => {
        enemy.onRoundStart(createTestBoard());
        const result = enemy.onTick(1000, createTestBoard());
        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty cardsToFlip', () => {
        enemy.onRoundStart(createTestBoard());
        const result = enemy.onTick(1000, createTestBoard());
        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events', () => {
        enemy.onRoundStart(createTestBoard());
        const result = enemy.onTick(1000, createTestBoard());
        expect(result.events).toEqual([]);
      });

      it('returns false for instantDeath', () => {
        enemy.onRoundStart(createTestBoard());
        const result = enemy.onTick(1000, createTestBoard());
        expect(result.instantDeath).toBe(false);
      });

      it('handles very long tick duration', () => {
        enemy.onRoundStart(createTestBoard());
        const result = enemy.onTick(60000, createTestBoard());
        expect(result.healthDelta).toBe(0);
        expect(result.instantDeath).toBe(false);
      });

      it('handles zero tick duration', () => {
        enemy.onRoundStart(createTestBoard());
        const result = enemy.onTick(0, createTestBoard());
        expect(result.scoreDelta).toBe(0);
        expect(result.healthDelta).toBe(0);
      });

      it('handles multiple consecutive ticks', () => {
        enemy.onRoundStart(createTestBoard());
        for (let i = 0; i < 100; i++) {
          const result = enemy.onTick(100, createTestBoard());
          expect(result.healthDelta).toBe(0);
          expect(result.instantDeath).toBe(false);
        }
      });
    });

    describe('onValidMatch', () => {
      it('returns zero timeDelta', () => {
        const result = enemy.onValidMatch([createCard()], createTestBoard());
        expect(result.timeDelta).toBe(0);
      });

      it('returns pointsMultiplier of 1', () => {
        const result = enemy.onValidMatch([createCard()], createTestBoard());
        expect(result.pointsMultiplier).toBe(1);
      });

      it('returns empty cardsToRemove', () => {
        const result = enemy.onValidMatch([createCard()], createTestBoard());
        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty cardsToFlip', () => {
        const result = enemy.onValidMatch([createCard()], createTestBoard());
        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events', () => {
        const result = enemy.onValidMatch([createCard()], createTestBoard());
        expect(result.events).toEqual([]);
      });

      it('accepts empty matched cards array', () => {
        const result = enemy.onValidMatch([], createTestBoard());
        expect(result.pointsMultiplier).toBe(1);
      });

      it('accepts multiple matched cards', () => {
        const cards = [createCard(), createCard(), createCard()];
        const result = enemy.onValidMatch(cards, createTestBoard());
        expect(result.pointsMultiplier).toBe(1);
      });

      it('does not modify matched cards', () => {
        const cards = [createCard(), createCard(), createCard()];
        const originalCards = JSON.stringify(cards);
        enemy.onValidMatch(cards, createTestBoard());
        expect(JSON.stringify(cards)).toBe(originalCards);
      });

      it('works with face-down cards in matched set', () => {
        const cards = [createFaceDownCard()];
        const result = enemy.onValidMatch(cards, createTestBoard());
        expect(result.pointsMultiplier).toBe(1);
      });
    });

    describe('onInvalidMatch', () => {
      it('returns zero timeDelta', () => {
        const result = enemy.onInvalidMatch([createCard()], createTestBoard());
        expect(result.timeDelta).toBe(0);
      });

      it('returns pointsMultiplier of 1', () => {
        const result = enemy.onInvalidMatch([createCard()], createTestBoard());
        expect(result.pointsMultiplier).toBe(1);
      });

      it('returns empty cardsToRemove', () => {
        const result = enemy.onInvalidMatch([createCard()], createTestBoard());
        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty cardsToFlip', () => {
        const result = enemy.onInvalidMatch([createCard()], createTestBoard());
        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events', () => {
        const result = enemy.onInvalidMatch([createCard()], createTestBoard());
        expect(result.events).toEqual([]);
      });

      it('does not modify board on invalid match', () => {
        const board = createTestBoard();
        const originalBoard = JSON.stringify(board);
        enemy.onInvalidMatch([createCard()], board);
        expect(JSON.stringify(board)).toBe(originalBoard);
      });
    });

    describe('onCardDraw', () => {
      it('returns unmodified card', () => {
        const card = createCard();
        const result = enemy.onCardDraw(card);
        expect(result).toEqual(card);
      });

      it('preserves card id', () => {
        const card = createCard({ id: 'specific-id' });
        const result = enemy.onCardDraw(card);
        expect(result.id).toBe('specific-id');
      });

      it('preserves card shape', () => {
        const card = createCard({ shape: 'squiggle' });
        const result = enemy.onCardDraw(card);
        expect(result.shape).toBe('squiggle');
      });

      it('preserves card color', () => {
        const card = createCard({ color: 'green' });
        const result = enemy.onCardDraw(card);
        expect(result.color).toBe('green');
      });

      it('preserves card number', () => {
        const card = createCard({ number: 3 });
        const result = enemy.onCardDraw(card);
        expect(result.number).toBe(3);
      });

      it('preserves card shading', () => {
        const card = createCard({ shading: 'striped' });
        const result = enemy.onCardDraw(card);
        expect(result.shading).toBe('striped');
      });

      it('does not add isDud property', () => {
        const card = createCard();
        const result = enemy.onCardDraw(card);
        expect(result.isDud).toBeUndefined();
      });

      it('does not add isFaceDown property', () => {
        const card = createCard();
        const result = enemy.onCardDraw(card);
        expect(result.isFaceDown).toBeUndefined();
      });

      it('does not add hasBomb property', () => {
        const card = createCard();
        const result = enemy.onCardDraw(card);
        expect(result.hasBomb).toBeUndefined();
      });

      it('does not add hasCountdown property', () => {
        const card = createCard();
        const result = enemy.onCardDraw(card);
        expect(result.hasCountdown).toBeUndefined();
      });

      it('preserves existing isDud property if true', () => {
        const card = createCard({ isDud: true });
        const result = enemy.onCardDraw(card);
        expect(result.isDud).toBe(true);
      });

      it('preserves existing isFaceDown property if true', () => {
        const card = createFaceDownCard();
        const result = enemy.onCardDraw(card);
        expect(result.isFaceDown).toBe(true);
      });
    });

    describe('onRoundEnd', () => {
      it('completes without error', () => {
        expect(() => enemy.onRoundEnd()).not.toThrow();
      });

      it('can be called multiple times', () => {
        expect(() => {
          enemy.onRoundEnd();
          enemy.onRoundEnd();
          enemy.onRoundEnd();
        }).not.toThrow();
      });

      it('can be called after round start', () => {
        enemy.onRoundStart(createTestBoard());
        expect(() => enemy.onRoundEnd()).not.toThrow();
      });

      it('can be called without prior round start', () => {
        expect(() => enemy.onRoundEnd()).not.toThrow();
      });
    });
  });

  // ==========================================================================
  // UI MODIFIERS TESTS
  // ==========================================================================
  describe('getUIModifiers', () => {
    it('returns object with disableAutoHint', () => {
      const uiMods = enemy.getUIModifiers();
      expect(uiMods).toHaveProperty('disableAutoHint');
    });

    it('returns object with disableManualHint', () => {
      const uiMods = enemy.getUIModifiers();
      expect(uiMods).toHaveProperty('disableManualHint');
    });

    it('returns object with weaponCounters', () => {
      const uiMods = enemy.getUIModifiers();
      expect(uiMods).toHaveProperty('weaponCounters');
    });

    it('does not show inactivity bar', () => {
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.showInactivityBar).toBeUndefined();
    });

    it('does not show score decay', () => {
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.showScoreDecay).toBeUndefined();
    });

    it('does not have timer speed multiplier', () => {
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBeUndefined();
    });

    it('does not show countdown cards', () => {
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.showCountdownCards).toBeUndefined();
    });

    it('does not show bomb cards', () => {
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.showBombCards).toBeUndefined();
    });
  });

  // ==========================================================================
  // STAT MODIFIERS TESTS
  // ==========================================================================
  describe('getStatModifiers', () => {
    it('returns object with hintGainChanceReduction', () => {
      const statMods = enemy.getStatModifiers();
      expect(statMods).toHaveProperty('hintGainChanceReduction');
    });

    it('does not have fire spread chance reduction', () => {
      const statMods = enemy.getStatModifiers();
      expect(statMods.fireSpreadChanceReduction).toBeUndefined();
    });

    it('does not have explosion chance reduction', () => {
      const statMods = enemy.getStatModifiers();
      expect(statMods.explosionChanceReduction).toBeUndefined();
    });

    it('does not have laser chance reduction', () => {
      const statMods = enemy.getStatModifiers();
      expect(statMods.laserChanceReduction).toBeUndefined();
    });

    it('does not have grace gain chance reduction', () => {
      const statMods = enemy.getStatModifiers();
      expect(statMods.graceGainChanceReduction).toBeUndefined();
    });

    it('does not have time gain chance reduction', () => {
      const statMods = enemy.getStatModifiers();
      expect(statMods.timeGainChanceReduction).toBeUndefined();
    });

    it('does not have healing chance reduction', () => {
      const statMods = enemy.getStatModifiers();
      expect(statMods.healingChanceReduction).toBeUndefined();
    });

    it('does not have damage multiplier', () => {
      const statMods = enemy.getStatModifiers();
      expect(statMods.damageMultiplier).toBeUndefined();
    });

    it('does not have points multiplier', () => {
      const statMods = enemy.getStatModifiers();
      expect(statMods.pointsMultiplier).toBeUndefined();
    });
  });

  // ==========================================================================
  // INTEGRATION TESTS
  // ==========================================================================
  describe('integration scenarios', () => {
    describe('full round simulation', () => {
      it('survives a complete round without unexpected state changes', () => {
        const board = createVariedBoard();
        enemy.onRoundStart(board);

        // Simulate 60 seconds of gameplay
        for (let second = 0; second < 60; second++) {
          const tickResult = enemy.onTick(1000, board);
          expect(tickResult.healthDelta).toBe(0);
          expect(tickResult.instantDeath).toBe(false);
        }

        enemy.onRoundEnd();

        // Verify modifiers are still correct
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.disableAutoHint).toBe(true);
        expect(uiMods.disableManualHint).toBe(true);
      });

      it('maintains hint disable through multiple matches', () => {
        enemy.onRoundStart(createTestBoard());

        for (let i = 0; i < 10; i++) {
          enemy.onValidMatch([createCard()], createTestBoard());
          const uiMods = enemy.getUIModifiers();
          expect(uiMods.disableAutoHint).toBe(true);
          expect(uiMods.disableManualHint).toBe(true);
        }
      });

      it('maintains weapon counter through multiple ticks', () => {
        enemy.onRoundStart(createTestBoard());

        for (let i = 0; i < 100; i++) {
          enemy.onTick(100, createTestBoard());
          const statMods = enemy.getStatModifiers();
          expect(statMods.hintGainChanceReduction).toBe(35);
        }
      });
    });

    describe('defeat condition progression', () => {
      it('does not interfere with defeat condition when hints are disabled', () => {
        const stats = createRoundStats();

        // Verify hints are disabled
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.disableAutoHint).toBe(true);
        expect(uiMods.disableManualHint).toBe(true);

        // Progress toward defeat
        stats.colorMatchCounts.set('red', 3);
        expect(enemy.checkDefeatCondition(stats)).toBe(false);

        stats.colorMatchCounts.set('green', 3);
        expect(enemy.checkDefeatCondition(stats)).toBe(false);

        stats.colorMatchCounts.set('purple', 3);
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('combined effect behavior', () => {
      it('applies both hint disable and weapon counter simultaneously', () => {
        const uiMods = enemy.getUIModifiers();
        const statMods = enemy.getStatModifiers();

        // Hint disable effect
        expect(uiMods.disableAutoHint).toBe(true);
        expect(uiMods.disableManualHint).toBe(true);

        // Weapon counter effect
        expect(statMods.hintGainChanceReduction).toBe(35);
        expect(uiMods.weaponCounters).toContainEqual({ type: 'hint', reduction: 35 });
      });

      it('both effects persist after round lifecycle', () => {
        enemy.onRoundStart(createTestBoard());
        enemy.onTick(10000, createTestBoard());
        enemy.onValidMatch([createCard()], createTestBoard());
        enemy.onTick(10000, createTestBoard());
        enemy.onInvalidMatch([createCard()], createTestBoard());
        enemy.onRoundEnd();

        const uiMods = enemy.getUIModifiers();
        const statMods = enemy.getStatModifiers();

        expect(uiMods.disableAutoHint).toBe(true);
        expect(uiMods.disableManualHint).toBe(true);
        expect(statMods.hintGainChanceReduction).toBe(35);
      });
    });

    describe('multiple enemy instances', () => {
      it('each instance maintains independent state', () => {
        const enemy1 = createCreepingShadow();
        const enemy2 = createCreepingShadow();

        enemy1.onRoundStart(createTestBoard());
        // enemy2 not started

        // Both should still have correct modifiers
        expect(enemy1.getUIModifiers().disableAutoHint).toBe(true);
        expect(enemy2.getUIModifiers().disableAutoHint).toBe(true);

        expect(enemy1.getStatModifiers().hintGainChanceReduction).toBe(35);
        expect(enemy2.getStatModifiers().hintGainChanceReduction).toBe(35);
      });

      it('defeat conditions are independent per instance', () => {
        const enemy1 = createCreepingShadow();
        const enemy2 = createCreepingShadow();

        const stats1 = createRoundStats();
        stats1.colorMatchCounts.set('red', 3);
        stats1.colorMatchCounts.set('green', 3);
        stats1.colorMatchCounts.set('purple', 3);

        const stats2 = createRoundStats();
        stats2.colorMatchCounts.set('red', 1);

        expect(enemy1.checkDefeatCondition(stats1)).toBe(true);
        expect(enemy2.checkDefeatCondition(stats2)).toBe(false);
      });
    });
  });

  // ==========================================================================
  // EDGE CASES AND ERROR HANDLING
  // ==========================================================================
  describe('edge cases', () => {
    it('handles undefined colorMatchCounts gracefully', () => {
      const stats = createRoundStats();
      // colorMatchCounts is a Map, test with colors not set
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('handles tick with empty board', () => {
      enemy.onRoundStart([]);
      const result = enemy.onTick(1000, []);
      expect(result.healthDelta).toBe(0);
    });

    it('handles valid match with empty board', () => {
      const result = enemy.onValidMatch([createCard()], []);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('handles invalid match with empty board', () => {
      const result = enemy.onInvalidMatch([createCard()], []);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('handles card draw with minimal card', () => {
      const minimalCard: Card = {
        id: 'min',
        shape: 'oval',
        color: 'red',
        number: 1,
        shading: 'solid',
        selected: false,
      };
      const result = enemy.onCardDraw(minimalCard);
      expect(result.id).toBe('min');
    });

    it('handles very small tick values', () => {
      enemy.onRoundStart(createTestBoard());
      const result = enemy.onTick(1, createTestBoard());
      expect(result.healthDelta).toBe(0);
    });

    it('handles negative tick values gracefully', () => {
      enemy.onRoundStart(createTestBoard());
      // Negative tick should not cause errors
      const result = enemy.onTick(-1000, createTestBoard());
      expect(result).toBeDefined();
    });
  });
});
