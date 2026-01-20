import { createChargingBoar } from '@/utils/enemies/tier2/chargingBoar';
import {
  createRoundStats,
  createCard,
  createTestBoard,
  createVariedBoard,
  createFaceDownCard,
  resetCardIdCounter,
} from '../../testUtils';

describe('Charging Boar', () => {
  beforeEach(() => {
    resetCardIdCounter();
  });

  // ============================================================================
  // METADATA TESTS (10 tests)
  // ============================================================================

  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createChargingBoar();
      expect(enemy.name).toBe('Charging Boar');
    });

    it('has tier 2', () => {
      const enemy = createChargingBoar();
      expect(enemy.tier).toBe(2);
    });

    it('has correct icon', () => {
      const enemy = createChargingBoar();
      expect(enemy.icon).toBe('caro-asercion/boar');
    });

    it('has description mentioning 35s', () => {
      const enemy = createChargingBoar();
      expect(enemy.description).toContain('35s');
    });

    it('has description mentioning inactivity', () => {
      const enemy = createChargingBoar();
      expect(enemy.description.toLowerCase()).toContain('inactivity');
    });

    it('has description mentioning HP loss', () => {
      const enemy = createChargingBoar();
      expect(enemy.description).toContain('1HP');
    });

    it('has defeatConditionText mentioning 3 matches', () => {
      const enemy = createChargingBoar();
      expect(enemy.defeatConditionText).toContain('3');
    });

    it('has defeatConditionText mentioning under 10s', () => {
      const enemy = createChargingBoar();
      expect(enemy.defeatConditionText).toContain('10s');
    });

    it('has defeatConditionText mentioning matches', () => {
      const enemy = createChargingBoar();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('match');
    });

    it('creates independent instances', () => {
      const enemy1 = createChargingBoar();
      const enemy2 = createChargingBoar();
      expect(enemy1).not.toBe(enemy2);
    });
  });

  // ============================================================================
  // INACTIVITY EFFECT TESTS (20 tests)
  // ============================================================================

  describe('inactivity effect', () => {
    describe('UI modifiers', () => {
      it('shows inactivity bar in UI modifiers', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);

        const uiMods = enemy.getUIModifiers();
        expect(uiMods.showInactivityBar).toBeDefined();
      });

      it('inactivity bar has max of 35000ms', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);

        const uiMods = enemy.getUIModifiers();
        expect(uiMods.showInactivityBar?.max).toBe(35000);
      });

      it('inactivity bar has damage penalty', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);

        const uiMods = enemy.getUIModifiers();
        expect(uiMods.showInactivityBar?.penalty).toBe('damage');
      });

      it('inactivity bar starts at 0', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);

        const uiMods = enemy.getUIModifiers();
        expect(uiMods.showInactivityBar?.current).toBe(0);
      });

      it('inactivity bar current updates after ticks', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);

        enemy.onTick(5000, board);
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.showInactivityBar?.current).toBe(5000);
      });

      it('inactivity bar current accumulates across multiple ticks', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);

        enemy.onTick(5000, board);
        enemy.onTick(10000, board);
        const uiMods = enemy.getUIModifiers();
        expect(uiMods.showInactivityBar?.current).toBe(15000);
      });
    });

    describe('timer progression', () => {
      it('no damage at 0ms', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);

        const result = enemy.onTick(0, board);
        expect(result.healthDelta).toBe(0);
      });

      it('no damage at 10000ms', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);

        const result = enemy.onTick(10000, board);
        expect(result.healthDelta).toBe(0);
      });

      it('no damage at 20000ms', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);

        const result = enemy.onTick(20000, board);
        expect(result.healthDelta).toBe(0);
      });

      it('no damage at 34999ms (just before threshold)', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);

        const result = enemy.onTick(34999, board);
        expect(result.healthDelta).toBe(0);
      });

      it('deals 1 damage at exactly 35000ms', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);

        const result = enemy.onTick(35000, board);
        expect(result.healthDelta).toBe(-1);
      });

      it('deals 1 damage at 40000ms (above threshold)', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);

        const result = enemy.onTick(40000, board);
        expect(result.healthDelta).toBe(-1);
      });

      it('does not cause instant death', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);

        const result = enemy.onTick(35000, board);
        expect(result.instantDeath).toBe(false);
      });
    });

    describe('timer reset on match', () => {
      it('resets timer on valid match', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);

        enemy.onTick(30000, board);
        enemy.onValidMatch([board[0], board[1], board[2]], board);

        const uiMods = enemy.getUIModifiers();
        expect(uiMods.showInactivityBar?.current).toBe(0);
      });

      it('no damage after reset even with more time passed', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);

        enemy.onTick(30000, board);
        enemy.onValidMatch([board[0], board[1], board[2]], board);
        const result = enemy.onTick(30000, board);

        expect(result.healthDelta).toBe(0);
      });

      it('timer restarts from 0 after reset', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);

        enemy.onTick(30000, board);
        enemy.onValidMatch([board[0], board[1], board[2]], board);
        enemy.onTick(10000, board);

        const uiMods = enemy.getUIModifiers();
        expect(uiMods.showInactivityBar?.current).toBe(10000);
      });

      it('can trigger damage again after reset and full 35s', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);

        // First cycle
        const result1 = enemy.onTick(35000, board);
        expect(result1.healthDelta).toBe(-1);

        // Match to reset
        enemy.onValidMatch([board[0], board[1], board[2]], board);

        // Second cycle
        const result2 = enemy.onTick(35000, board);
        expect(result2.healthDelta).toBe(-1);
      });
    });

    describe('inactivity events', () => {
      it('emits inactivity_penalty event on damage', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);

        const result = enemy.onTick(35000, board);
        expect(result.events).toContainEqual({
          type: 'inactivity_penalty',
          penalty: 'damage',
        });
      });
    });
  });

  // ============================================================================
  // DEFEAT CONDITION TESTS (15 tests)
  // ============================================================================

  describe('defeat condition', () => {
    describe('0 fast matches', () => {
      it('returns false with empty matchTimes', () => {
        const enemy = createChargingBoar();
        const stats = createRoundStats({ matchTimes: [] });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false with all slow matches', () => {
        const enemy = createChargingBoar();
        const stats = createRoundStats({
          matchTimes: [15000, 20000, 30000],
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });

    describe('1 fast match', () => {
      it('returns false with 1 fast match', () => {
        const enemy = createChargingBoar();
        const stats = createRoundStats({ matchTimes: [5000] });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false with 1 fast and 2 slow', () => {
        const enemy = createChargingBoar();
        const stats = createRoundStats({
          matchTimes: [5000, 15000, 20000],
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });

    describe('2 fast matches (threshold - 1)', () => {
      it('returns false with exactly 2 fast matches', () => {
        const enemy = createChargingBoar();
        const stats = createRoundStats({ matchTimes: [5000, 6000] });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false with 2 fast and 1 slow', () => {
        const enemy = createChargingBoar();
        const stats = createRoundStats({
          matchTimes: [5000, 6000, 15000],
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });

    describe('3 fast matches (exact threshold)', () => {
      it('returns true with exactly 3 fast matches', () => {
        const enemy = createChargingBoar();
        const stats = createRoundStats({
          matchTimes: [5000, 6000, 7000],
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true with 3 fast and 1 slow', () => {
        const enemy = createChargingBoar();
        const stats = createRoundStats({
          matchTimes: [5000, 6000, 7000, 15000],
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true with very fast matches (1ms each)', () => {
        const enemy = createChargingBoar();
        const stats = createRoundStats({
          matchTimes: [1, 1, 1],
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('above threshold (4+ fast matches)', () => {
      it('returns true with 4 fast matches', () => {
        const enemy = createChargingBoar();
        const stats = createRoundStats({
          matchTimes: [3000, 4000, 5000, 6000],
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true with 5 fast matches', () => {
        const enemy = createChargingBoar();
        const stats = createRoundStats({
          matchTimes: [3000, 4000, 5000, 6000, 7000],
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true with many fast matches interspersed with slow', () => {
        const enemy = createChargingBoar();
        const stats = createRoundStats({
          matchTimes: [3000, 15000, 4000, 20000, 5000, 25000, 6000],
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('boundary conditions', () => {
      it('returns false when matches are exactly 10000ms (not under)', () => {
        const enemy = createChargingBoar();
        const stats = createRoundStats({
          matchTimes: [10000, 10000, 10000],
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true when matches are 9999ms (just under)', () => {
        const enemy = createChargingBoar();
        const stats = createRoundStats({
          matchTimes: [9999, 9999, 9999],
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });
  });

  // ============================================================================
  // LIFECYCLE HOOK TESTS (10 tests)
  // ============================================================================

  describe('lifecycle hooks', () => {
    describe('onRoundStart', () => {
      it('returns an EnemyStartResult', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        const result = enemy.onRoundStart(board);
        expect(result).toHaveProperty('cardModifications');
        expect(result).toHaveProperty('events');
      });

      it('returns empty cardModifications', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        const result = enemy.onRoundStart(board);
        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty events', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        const result = enemy.onRoundStart(board);
        expect(result.events).toEqual([]);
      });

      it('resets inactivity timer on round start', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();

        // Accumulate some time
        enemy.onRoundStart(board);
        enemy.onTick(20000, board);

        // Start a new round
        enemy.onRoundStart(board);

        const uiMods = enemy.getUIModifiers();
        expect(uiMods.showInactivityBar?.current).toBe(0);
      });
    });

    describe('onCardDraw', () => {
      it('returns unmodified card', () => {
        const enemy = createChargingBoar();
        const card = createCard({ shape: 'diamond', color: 'green' });
        const result = enemy.onCardDraw(card);
        expect(result).toEqual(card);
      });

      it('does not add dud property', () => {
        const enemy = createChargingBoar();
        const card = createCard();
        const result = enemy.onCardDraw(card);
        expect(result.isDud).toBeUndefined();
      });

      it('does not add bomb property', () => {
        const enemy = createChargingBoar();
        const card = createCard();
        const result = enemy.onCardDraw(card);
        expect(result.hasBomb).toBeUndefined();
      });
    });

    describe('onValidMatch', () => {
      it('returns an EnemyMatchResult', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);
        const result = enemy.onValidMatch([board[0], board[1], board[2]], board);
        expect(result).toHaveProperty('timeDelta');
        expect(result).toHaveProperty('pointsMultiplier');
      });

      it('has no time delta', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);
        const result = enemy.onValidMatch([board[0], board[1], board[2]], board);
        expect(result.timeDelta).toBe(0);
      });

      it('has pointsMultiplier of 1', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);
        const result = enemy.onValidMatch([board[0], board[1], board[2]], board);
        expect(result.pointsMultiplier).toBe(1);
      });

      it('has no cards to remove', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);
        const result = enemy.onValidMatch([board[0], board[1], board[2]], board);
        expect(result.cardsToRemove).toEqual([]);
      });
    });

    describe('onInvalidMatch', () => {
      it('returns an EnemyMatchResult', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);
        const result = enemy.onInvalidMatch([board[0], board[1], board[2]], board);
        expect(result).toHaveProperty('timeDelta');
        expect(result).toHaveProperty('pointsMultiplier');
      });

      it('has no time delta', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);
        const result = enemy.onInvalidMatch([board[0], board[1], board[2]], board);
        expect(result.timeDelta).toBe(0);
      });

      it('has pointsMultiplier of 1', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);
        const result = enemy.onInvalidMatch([board[0], board[1], board[2]], board);
        expect(result.pointsMultiplier).toBe(1);
      });

      it('has no cards to remove', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);
        const result = enemy.onInvalidMatch([board[0], board[1], board[2]], board);
        expect(result.cardsToRemove).toEqual([]);
      });

      it('does not reset inactivity timer', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);

        enemy.onTick(20000, board);
        enemy.onInvalidMatch([board[0], board[1], board[2]], board);

        const uiMods = enemy.getUIModifiers();
        expect(uiMods.showInactivityBar?.current).toBe(20000);
      });
    });

    describe('onRoundEnd', () => {
      it('does not throw', () => {
        const enemy = createChargingBoar();
        expect(() => enemy.onRoundEnd()).not.toThrow();
      });
    });

    describe('onTick', () => {
      it('returns an EnemyTickResult with all required fields', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);
        const result = enemy.onTick(1000, board);
        expect(result).toHaveProperty('scoreDelta');
        expect(result).toHaveProperty('healthDelta');
        expect(result).toHaveProperty('timeDelta');
        expect(result).toHaveProperty('cardsToRemove');
        expect(result).toHaveProperty('cardModifications');
        expect(result).toHaveProperty('events');
        expect(result).toHaveProperty('instantDeath');
      });

      it('has scoreDelta of 0', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);
        const result = enemy.onTick(1000, board);
        expect(result.scoreDelta).toBe(0);
      });

      it('has timeDelta of 0', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);
        const result = enemy.onTick(1000, board);
        expect(result.timeDelta).toBe(0);
      });

      it('has empty cardsToRemove', () => {
        const enemy = createChargingBoar();
        const board = createTestBoard();
        enemy.onRoundStart(board);
        const result = enemy.onTick(1000, board);
        expect(result.cardsToRemove).toEqual([]);
      });
    });
  });

  // ============================================================================
  // UI/STAT MODIFIER TESTS (10 tests)
  // ============================================================================

  describe('getUIModifiers', () => {
    it('returns an object', () => {
      const enemy = createChargingBoar();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      const uiMods = enemy.getUIModifiers();
      expect(typeof uiMods).toBe('object');
    });

    it('does not have showScoreDecay', () => {
      const enemy = createChargingBoar();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.showScoreDecay).toBeUndefined();
    });

    it('does not have timerSpeedMultiplier', () => {
      const enemy = createChargingBoar();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBeUndefined();
    });

    it('does not have disableAutoHint', () => {
      const enemy = createChargingBoar();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.disableAutoHint).toBeUndefined();
    });

    it('does not have disableManualHint', () => {
      const enemy = createChargingBoar();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.disableManualHint).toBeUndefined();
    });
  });

  describe('getStatModifiers', () => {
    it('returns an object', () => {
      const enemy = createChargingBoar();
      const statMods = enemy.getStatModifiers();
      expect(typeof statMods).toBe('object');
    });

    it('does not have damageMultiplier', () => {
      const enemy = createChargingBoar();
      const statMods = enemy.getStatModifiers();
      expect(statMods.damageMultiplier).toBeUndefined();
    });

    it('does not have pointsMultiplier', () => {
      const enemy = createChargingBoar();
      const statMods = enemy.getStatModifiers();
      expect(statMods.pointsMultiplier).toBeUndefined();
    });

    it('does not have fireSpreadChanceReduction', () => {
      const enemy = createChargingBoar();
      const statMods = enemy.getStatModifiers();
      expect(statMods.fireSpreadChanceReduction).toBeUndefined();
    });

    it('does not have any weapon counter reductions', () => {
      const enemy = createChargingBoar();
      const statMods = enemy.getStatModifiers();
      expect(statMods.explosionChanceReduction).toBeUndefined();
      expect(statMods.laserChanceReduction).toBeUndefined();
      expect(statMods.hintGainChanceReduction).toBeUndefined();
      expect(statMods.graceGainChanceReduction).toBeUndefined();
      expect(statMods.timeGainChanceReduction).toBeUndefined();
      expect(statMods.healingChanceReduction).toBeUndefined();
    });
  });

  // ============================================================================
  // EDGE CASES AND INTEGRATION (5 tests)
  // ============================================================================

  describe('edge cases', () => {
    it('works with varied board', () => {
      const enemy = createChargingBoar();
      const board = createVariedBoard();
      enemy.onRoundStart(board);

      const result = enemy.onTick(35000, board);
      expect(result.healthDelta).toBe(-1);
    });

    it('works with board containing face-down cards', () => {
      const enemy = createChargingBoar();
      const board = [
        ...createTestBoard(9),
        createFaceDownCard(),
        createFaceDownCard(),
        createFaceDownCard(),
      ];
      enemy.onRoundStart(board);

      const result = enemy.onTick(35000, board);
      expect(result.healthDelta).toBe(-1);
    });

    it('handles zero delta tick', () => {
      const enemy = createChargingBoar();
      const board = createTestBoard();
      enemy.onRoundStart(board);

      const result = enemy.onTick(0, board);
      expect(result.healthDelta).toBe(0);
    });

    it('handles multiple small ticks accumulating to threshold', () => {
      const enemy = createChargingBoar();
      const board = createTestBoard();
      enemy.onRoundStart(board);

      // 35 ticks of 1000ms each
      let result;
      for (let i = 0; i < 35; i++) {
        result = enemy.onTick(1000, board);
      }

      expect(result!.healthDelta).toBe(-1);
    });

    it('checkDefeatCondition is independent of board state', () => {
      const enemy = createChargingBoar();
      const board = createTestBoard();
      enemy.onRoundStart(board);
      enemy.onTick(20000, board);

      const stats = createRoundStats({ matchTimes: [5000, 6000, 7000] });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  // ============================================================================
  // MULTIPLE DAMAGE CYCLES (5 tests)
  // ============================================================================

  describe('multiple damage cycles', () => {
    it('timer resets after damage is dealt', () => {
      const enemy = createChargingBoar();
      const board = createTestBoard();
      enemy.onRoundStart(board);

      enemy.onTick(35000, board);

      const uiMods = enemy.getUIModifiers();
      expect(uiMods.showInactivityBar?.current).toBe(0);
    });

    it('can deal damage multiple times without match', () => {
      const enemy = createChargingBoar();
      const board = createTestBoard();
      enemy.onRoundStart(board);

      const result1 = enemy.onTick(35000, board);
      expect(result1.healthDelta).toBe(-1);

      const result2 = enemy.onTick(35000, board);
      expect(result2.healthDelta).toBe(-1);

      const result3 = enemy.onTick(35000, board);
      expect(result3.healthDelta).toBe(-1);
    });

    it('timer properly tracks across multiple damage events', () => {
      const enemy = createChargingBoar();
      const board = createTestBoard();
      enemy.onRoundStart(board);

      // First cycle: damage at 35s
      enemy.onTick(35000, board);

      // Timer should reset, tick 20s
      enemy.onTick(20000, board);
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.showInactivityBar?.current).toBe(20000);
    });

    it('match between damage cycles resets properly', () => {
      const enemy = createChargingBoar();
      const board = createTestBoard();
      enemy.onRoundStart(board);

      // First cycle
      const result1 = enemy.onTick(35000, board);
      expect(result1.healthDelta).toBe(-1);

      // Partial time
      enemy.onTick(20000, board);

      // Match to reset
      enemy.onValidMatch([board[0], board[1], board[2]], board);

      // Should need full 35s again
      const result2 = enemy.onTick(34999, board);
      expect(result2.healthDelta).toBe(0);
    });

    it('accumulates exactly to threshold with multiple ticks', () => {
      const enemy = createChargingBoar();
      const board = createTestBoard();
      enemy.onRoundStart(board);

      // Accumulate 34999ms (just under)
      for (let i = 0; i < 34; i++) {
        const result = enemy.onTick(1000, board);
        expect(result.healthDelta).toBe(0);
      }

      // One more ms to hit exactly 35000
      enemy.onTick(999, board);
      const finalResult = enemy.onTick(1, board);
      expect(finalResult.healthDelta).toBe(-1);
    });
  });
});
