/**
 * Comprehensive Unit Tests for Circling Vulture Enemy
 *
 * Enemy: Circling Vulture (Tier 1)
 * Effect: Score drains 1 point every 10 seconds (0.1 pts/sec)
 * Defeat Condition: Reach 150% of target score
 */

import { createCirclingVulture } from '@/utils/enemies/tier1/circlingVulture';
import {
  createRoundStats,
  createCard,
  createTestBoard,
  createVariedBoard,
  createFaceDownCard,
  createTripleCard,
  resetCardIdCounter,
} from '../../testUtils';

// Reset card IDs before each test for deterministic behavior
beforeEach(() => {
  resetCardIdCounter();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Circling Vulture', () => {
  // ==========================================================================
  // METADATA TESTS
  // ==========================================================================
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createCirclingVulture();
      expect(enemy.name).toBe('Circling Vulture');
    });

    it('has correct tier (1)', () => {
      const enemy = createCirclingVulture();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon reference', () => {
      const enemy = createCirclingVulture();
      expect(enemy.icon).toBe('lorc/vulture');
    });

    it('has a non-empty description', () => {
      const enemy = createCirclingVulture();
      expect(enemy.description).toBeTruthy();
      expect(enemy.description.length).toBeGreaterThan(0);
    });

    it('description mentions score draining', () => {
      const enemy = createCirclingVulture();
      expect(enemy.description.toLowerCase()).toContain('score');
      expect(enemy.description.toLowerCase()).toContain('drain');
    });

    it('description mentions the rate (10 seconds)', () => {
      const enemy = createCirclingVulture();
      expect(enemy.description).toContain('10 seconds');
    });

    it('description mentions 1 point', () => {
      const enemy = createCirclingVulture();
      expect(enemy.description).toContain('1 point');
    });

    it('has a non-empty defeat condition text', () => {
      const enemy = createCirclingVulture();
      expect(enemy.defeatConditionText).toBeTruthy();
      expect(enemy.defeatConditionText.length).toBeGreaterThan(0);
    });

    it('defeat condition text mentions 150%', () => {
      const enemy = createCirclingVulture();
      expect(enemy.defeatConditionText).toContain('150%');
    });

    it('defeat condition text mentions target score', () => {
      const enemy = createCirclingVulture();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('target');
      expect(enemy.defeatConditionText.toLowerCase()).toContain('score');
    });

    it('creates independent instances (not shared state)', () => {
      const enemy1 = createCirclingVulture();
      const enemy2 = createCirclingVulture();

      enemy1.onRoundStart([]);
      enemy1.onTick(5000, []);

      // enemy2 should not be affected by enemy1's tick
      enemy2.onRoundStart([]);
      const result = enemy2.onTick(1000, []);
      expect(result.scoreDelta).toBe(-0.1); // Fresh state
    });
  });

  // ==========================================================================
  // SCORE DECAY EFFECT TESTS
  // ==========================================================================
  describe('ScoreDecayEffect', () => {
    describe('basic decay calculation', () => {
      it('decays 0.1 points per second', () => {
        const enemy = createCirclingVulture();
        enemy.onRoundStart([]);

        const result = enemy.onTick(1000, []);
        expect(result.scoreDelta).toBe(-0.1);
      });

      it('decays exactly 1 point in 10 seconds', () => {
        const enemy = createCirclingVulture();
        enemy.onRoundStart([]);

        const result = enemy.onTick(10000, []);
        expect(result.scoreDelta).toBe(-1);
      });

      it('decays 0.5 points in 5 seconds', () => {
        const enemy = createCirclingVulture();
        enemy.onRoundStart([]);

        const result = enemy.onTick(5000, []);
        expect(result.scoreDelta).toBe(-0.5);
      });

      it('decays proportionally for 500ms (0.05 points)', () => {
        const enemy = createCirclingVulture();
        enemy.onRoundStart([]);

        const result = enemy.onTick(500, []);
        expect(result.scoreDelta).toBe(-0.05);
      });

      it('decays proportionally for 100ms (0.01 points)', () => {
        const enemy = createCirclingVulture();
        enemy.onRoundStart([]);

        const result = enemy.onTick(100, []);
        expect(result.scoreDelta).toBeCloseTo(-0.01, 5);
      });

      it('decays proportionally for 16ms (approx 60fps tick)', () => {
        const enemy = createCirclingVulture();
        enemy.onRoundStart([]);

        const result = enemy.onTick(16, []);
        expect(result.scoreDelta).toBeCloseTo(-0.0016, 5);
      });

      it('handles 0ms tick (no decay)', () => {
        const enemy = createCirclingVulture();
        enemy.onRoundStart([]);

        const result = enemy.onTick(0, []);
        expect(result.scoreDelta).toBe(0);
      });
    });

    describe('cumulative decay over multiple ticks', () => {
      it('accumulates decay over multiple 1-second ticks', () => {
        const enemy = createCirclingVulture();
        enemy.onRoundStart([]);

        let totalDecay = 0;
        for (let i = 0; i < 10; i++) {
          const result = enemy.onTick(1000, []);
          totalDecay += result.scoreDelta;
        }

        expect(totalDecay).toBeCloseTo(-1, 10);
      });

      it('accumulates decay over many small ticks (simulating game loop)', () => {
        const enemy = createCirclingVulture();
        enemy.onRoundStart([]);

        // Simulate 1 second at 60fps (roughly 60 ticks of ~16.67ms)
        let totalDecay = 0;
        const tickMs = 1000 / 60;
        for (let i = 0; i < 60; i++) {
          const result = enemy.onTick(tickMs, []);
          totalDecay += result.scoreDelta;
        }

        expect(totalDecay).toBeCloseTo(-0.1, 2);
      });

      it('accumulates decay over a full 60-second round', () => {
        const enemy = createCirclingVulture();
        enemy.onRoundStart([]);

        let totalDecay = 0;
        // 60 ticks of 1 second each
        for (let i = 0; i < 60; i++) {
          const result = enemy.onTick(1000, []);
          totalDecay += result.scoreDelta;
        }

        expect(totalDecay).toBeCloseTo(-6, 10); // 60 seconds * 0.1 pts/sec = 6 points
      });
    });

    describe('decay with varying tick intervals', () => {
      it('handles irregular tick intervals', () => {
        const enemy = createCirclingVulture();
        enemy.onRoundStart([]);

        const r1 = enemy.onTick(100, []);
        const r2 = enemy.onTick(500, []);
        const r3 = enemy.onTick(400, []);

        // Total: 1000ms = 0.1 points
        const total = r1.scoreDelta + r2.scoreDelta + r3.scoreDelta;
        expect(total).toBeCloseTo(-0.1, 5);
      });

      it('handles very small tick intervals', () => {
        const enemy = createCirclingVulture();
        enemy.onRoundStart([]);

        const result = enemy.onTick(1, []); // 1ms
        expect(result.scoreDelta).toBeCloseTo(-0.0001, 6);
      });

      it('handles large tick intervals', () => {
        const enemy = createCirclingVulture();
        enemy.onRoundStart([]);

        const result = enemy.onTick(30000, []); // 30 seconds
        expect(result.scoreDelta).toBe(-3);
      });
    });

    describe('decay does not affect other result properties', () => {
      it('returns 0 healthDelta', () => {
        const enemy = createCirclingVulture();
        enemy.onRoundStart([]);

        const result = enemy.onTick(1000, []);
        expect(result.healthDelta).toBe(0);
      });

      it('returns 0 timeDelta', () => {
        const enemy = createCirclingVulture();
        enemy.onRoundStart([]);

        const result = enemy.onTick(1000, []);
        expect(result.timeDelta).toBe(0);
      });

      it('returns empty cardsToRemove array', () => {
        const enemy = createCirclingVulture();
        enemy.onRoundStart([]);

        const result = enemy.onTick(1000, []);
        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty cardModifications array', () => {
        const enemy = createCirclingVulture();
        enemy.onRoundStart([]);

        const result = enemy.onTick(1000, []);
        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty cardsToFlip array', () => {
        const enemy = createCirclingVulture();
        enemy.onRoundStart([]);

        const result = enemy.onTick(1000, []);
        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events array', () => {
        const enemy = createCirclingVulture();
        enemy.onRoundStart([]);

        const result = enemy.onTick(1000, []);
        expect(result.events).toEqual([]);
      });

      it('returns instantDeath as false', () => {
        const enemy = createCirclingVulture();
        enemy.onRoundStart([]);

        const result = enemy.onTick(1000, []);
        expect(result.instantDeath).toBe(false);
      });
    });
  });

  // ==========================================================================
  // DEFEAT CONDITION TESTS
  // ==========================================================================
  describe('defeat condition', () => {
    describe('boundary tests at exactly 150% threshold', () => {
      it('returns false when score is 0 (target 100)', () => {
        const enemy = createCirclingVulture();
        const stats = createRoundStats({ currentScore: 0, targetScore: 100 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when score is 1 below threshold (149/100)', () => {
        const enemy = createCirclingVulture();
        const stats = createRoundStats({ currentScore: 149, targetScore: 100 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when score is 0.01 below threshold (149.99/100)', () => {
        const enemy = createCirclingVulture();
        const stats = createRoundStats({ currentScore: 149.99, targetScore: 100 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true when score is exactly 150% (150/100)', () => {
        const enemy = createCirclingVulture();
        const stats = createRoundStats({ currentScore: 150, targetScore: 100 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when score is 0.01 above threshold (150.01/100)', () => {
        const enemy = createCirclingVulture();
        const stats = createRoundStats({ currentScore: 150.01, targetScore: 100 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when score is well above threshold (200/100)', () => {
        const enemy = createCirclingVulture();
        const stats = createRoundStats({ currentScore: 200, targetScore: 100 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('various target scores', () => {
      it('calculates correctly for target 50 (need 75)', () => {
        const enemy = createCirclingVulture();

        const statsBelow = createRoundStats({ currentScore: 74, targetScore: 50 });
        expect(enemy.checkDefeatCondition(statsBelow)).toBe(false);

        const statsAt = createRoundStats({ currentScore: 75, targetScore: 50 });
        expect(enemy.checkDefeatCondition(statsAt)).toBe(true);
      });

      it('calculates correctly for target 200 (need 300)', () => {
        const enemy = createCirclingVulture();

        const statsBelow = createRoundStats({ currentScore: 299, targetScore: 200 });
        expect(enemy.checkDefeatCondition(statsBelow)).toBe(false);

        const statsAt = createRoundStats({ currentScore: 300, targetScore: 200 });
        expect(enemy.checkDefeatCondition(statsAt)).toBe(true);
      });

      it('calculates correctly for target 33 (need 49.5)', () => {
        const enemy = createCirclingVulture();

        const statsBelow = createRoundStats({ currentScore: 49, targetScore: 33 });
        expect(enemy.checkDefeatCondition(statsBelow)).toBe(false);

        const statsAt = createRoundStats({ currentScore: 49.5, targetScore: 33 });
        expect(enemy.checkDefeatCondition(statsAt)).toBe(true);
      });

      it('calculates correctly for target 1000 (need 1500)', () => {
        const enemy = createCirclingVulture();

        const statsBelow = createRoundStats({ currentScore: 1499, targetScore: 1000 });
        expect(enemy.checkDefeatCondition(statsBelow)).toBe(false);

        const statsAt = createRoundStats({ currentScore: 1500, targetScore: 1000 });
        expect(enemy.checkDefeatCondition(statsAt)).toBe(true);
      });
    });

    describe('edge cases', () => {
      it('handles target score of 0 (any positive score wins)', () => {
        const enemy = createCirclingVulture();
        const stats = createRoundStats({ currentScore: 0.01, targetScore: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('handles score of 0 with target of 0 (0 >= 0)', () => {
        const enemy = createCirclingVulture();
        const stats = createRoundStats({ currentScore: 0, targetScore: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('handles very small target scores', () => {
        const enemy = createCirclingVulture();
        const stats = createRoundStats({ currentScore: 1.5, targetScore: 1 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('handles floating point precision near threshold', () => {
        const enemy = createCirclingVulture();
        // 150% of 99.99 = 149.985
        const stats = createRoundStats({ currentScore: 149.985, targetScore: 99.99 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('handles negative score (should not defeat)', () => {
        const enemy = createCirclingVulture();
        const stats = createRoundStats({ currentScore: -10, targetScore: 100 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOK TESTS
  // ==========================================================================
  describe('lifecycle hooks', () => {
    describe('onRoundStart', () => {
      it('returns empty cardModifications array', () => {
        const enemy = createCirclingVulture();
        const result = enemy.onRoundStart([]);
        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty events array', () => {
        const enemy = createCirclingVulture();
        const result = enemy.onRoundStart([]);
        expect(result.events).toEqual([]);
      });

      it('accepts an empty board', () => {
        const enemy = createCirclingVulture();
        expect(() => enemy.onRoundStart([])).not.toThrow();
      });

      it('accepts a populated board', () => {
        const enemy = createCirclingVulture();
        const board = createTestBoard(12);
        expect(() => enemy.onRoundStart(board)).not.toThrow();
      });

      it('accepts a board with varied cards', () => {
        const enemy = createCirclingVulture();
        const board = createVariedBoard();
        expect(() => enemy.onRoundStart(board)).not.toThrow();
      });

      it('does not modify the input board array', () => {
        const enemy = createCirclingVulture();
        const board = createTestBoard(12);
        const originalLength = board.length;
        const originalFirstCard = { ...board[0] };

        enemy.onRoundStart(board);

        expect(board.length).toBe(originalLength);
        expect(board[0]).toEqual(originalFirstCard);
      });
    });

    describe('onCardDraw', () => {
      it('returns the same card unmodified', () => {
        const enemy = createCirclingVulture();
        const card = createCard({ shape: 'diamond', color: 'purple', number: 2 });
        const result = enemy.onCardDraw(card);
        expect(result).toEqual(card);
      });

      it('preserves all card properties', () => {
        const enemy = createCirclingVulture();
        const card = createCard({
          shape: 'squiggle',
          color: 'green',
          number: 3,
          shading: 'striped',
          selected: true,
        });
        const result = enemy.onCardDraw(card);

        expect(result.shape).toBe('squiggle');
        expect(result.color).toBe('green');
        expect(result.number).toBe(3);
        expect(result.shading).toBe('striped');
        expect(result.selected).toBe(true);
      });

      it('does not add isDud property', () => {
        const enemy = createCirclingVulture();
        const card = createCard();
        const result = enemy.onCardDraw(card);
        expect(result.isDud).toBeUndefined();
      });

      it('does not add isFaceDown property', () => {
        const enemy = createCirclingVulture();
        const card = createCard();
        const result = enemy.onCardDraw(card);
        expect(result.isFaceDown).toBeUndefined();
      });

      it('does not add hasBomb property', () => {
        const enemy = createCirclingVulture();
        const card = createCard();
        const result = enemy.onCardDraw(card);
        expect(result.hasBomb).toBeUndefined();
      });

      it('preserves existing special properties on cards', () => {
        const enemy = createCirclingVulture();
        const card = createCard({ onFire: true, health: 2 });
        const result = enemy.onCardDraw(card);
        expect(result.onFire).toBe(true);
        expect(result.health).toBe(2);
      });
    });

    describe('onValidMatch', () => {
      it('returns pointsMultiplier of 1 (no modification)', () => {
        const enemy = createCirclingVulture();
        const result = enemy.onValidMatch([], []);
        expect(result.pointsMultiplier).toBe(1);
      });

      it('returns timeDelta of 0 (no time stealing)', () => {
        const enemy = createCirclingVulture();
        const result = enemy.onValidMatch([], []);
        expect(result.timeDelta).toBe(0);
      });

      it('returns empty cardsToRemove array', () => {
        const enemy = createCirclingVulture();
        const result = enemy.onValidMatch([], []);
        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty cardsToFlip array', () => {
        const enemy = createCirclingVulture();
        const result = enemy.onValidMatch([], []);
        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events array', () => {
        const enemy = createCirclingVulture();
        const result = enemy.onValidMatch([], []);
        expect(result.events).toEqual([]);
      });

      it('handles matched cards array', () => {
        const enemy = createCirclingVulture();
        const matchedCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);

        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.pointsMultiplier).toBe(1);
      });
    });

    describe('onInvalidMatch', () => {
      it('returns pointsMultiplier of 1', () => {
        const enemy = createCirclingVulture();
        const result = enemy.onInvalidMatch([], []);
        expect(result.pointsMultiplier).toBe(1);
      });

      it('returns empty cardsToRemove array', () => {
        const enemy = createCirclingVulture();
        const result = enemy.onInvalidMatch([], []);
        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns timeDelta of 0', () => {
        const enemy = createCirclingVulture();
        const result = enemy.onInvalidMatch([], []);
        expect(result.timeDelta).toBe(0);
      });

      it('returns empty cardsToFlip array', () => {
        const enemy = createCirclingVulture();
        const result = enemy.onInvalidMatch([], []);
        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events array', () => {
        const enemy = createCirclingVulture();
        const result = enemy.onInvalidMatch([], []);
        expect(result.events).toEqual([]);
      });

      it('does not penalize invalid matches additionally', () => {
        const enemy = createCirclingVulture();
        const invalidCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);

        const result = enemy.onInvalidMatch(invalidCards, board);
        expect(result.cardsToRemove).toEqual([]);
        expect(result.timeDelta).toBe(0);
      });
    });

    describe('onRoundEnd', () => {
      it('can be called without error', () => {
        const enemy = createCirclingVulture();
        expect(() => enemy.onRoundEnd()).not.toThrow();
      });

      it('does not throw after a round with activity', () => {
        const enemy = createCirclingVulture();
        enemy.onRoundStart([]);
        enemy.onTick(5000, []);
        enemy.onValidMatch([], []);
        expect(() => enemy.onRoundEnd()).not.toThrow();
      });

      it('returns undefined (void function)', () => {
        const enemy = createCirclingVulture();
        const result = enemy.onRoundEnd();
        expect(result).toBeUndefined();
      });
    });
  });

  // ==========================================================================
  // UI MODIFIERS TESTS
  // ==========================================================================
  describe('getUIModifiers', () => {
    it('returns showScoreDecay modifier', () => {
      const enemy = createCirclingVulture();
      enemy.onRoundStart([]);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showScoreDecay).toBeDefined();
    });

    it('showScoreDecay has correct rate (0.1 pts/sec)', () => {
      const enemy = createCirclingVulture();
      enemy.onRoundStart([]);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showScoreDecay?.rate).toBe(0.1);
    });

    it('does not have showInactivityBar', () => {
      const enemy = createCirclingVulture();
      enemy.onRoundStart([]);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showInactivityBar).toBeUndefined();
    });

    it('does not have timerSpeedMultiplier', () => {
      const enemy = createCirclingVulture();
      enemy.onRoundStart([]);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.timerSpeedMultiplier).toBeUndefined();
    });

    it('does not have disableAutoHint', () => {
      const enemy = createCirclingVulture();
      enemy.onRoundStart([]);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableAutoHint).toBeUndefined();
    });

    it('does not have disableManualHint', () => {
      const enemy = createCirclingVulture();
      enemy.onRoundStart([]);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableManualHint).toBeUndefined();
    });

    it('does not have showCountdownCards', () => {
      const enemy = createCirclingVulture();
      enemy.onRoundStart([]);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showCountdownCards).toBeUndefined();
    });

    it('does not have showBombCards', () => {
      const enemy = createCirclingVulture();
      enemy.onRoundStart([]);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showBombCards).toBeUndefined();
    });

    it('does not have weaponCounters', () => {
      const enemy = createCirclingVulture();
      enemy.onRoundStart([]);

      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters).toBeUndefined();
    });

    it('UI modifiers are consistent before and after ticks', () => {
      const enemy = createCirclingVulture();
      enemy.onRoundStart([]);

      const modifiersBefore = enemy.getUIModifiers();
      enemy.onTick(10000, []);
      const modifiersAfter = enemy.getUIModifiers();

      expect(modifiersAfter.showScoreDecay?.rate).toBe(modifiersBefore.showScoreDecay?.rate);
    });
  });

  // ==========================================================================
  // STAT MODIFIERS TESTS
  // ==========================================================================
  describe('getStatModifiers', () => {
    it('returns an object', () => {
      const enemy = createCirclingVulture();
      const modifiers = enemy.getStatModifiers();
      expect(typeof modifiers).toBe('object');
    });

    it('does not have fireSpreadChanceReduction', () => {
      const enemy = createCirclingVulture();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
    });

    it('does not have explosionChanceReduction', () => {
      const enemy = createCirclingVulture();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.explosionChanceReduction).toBeUndefined();
    });

    it('does not have laserChanceReduction', () => {
      const enemy = createCirclingVulture();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.laserChanceReduction).toBeUndefined();
    });

    it('does not have hintGainChanceReduction', () => {
      const enemy = createCirclingVulture();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.hintGainChanceReduction).toBeUndefined();
    });

    it('does not have graceGainChanceReduction', () => {
      const enemy = createCirclingVulture();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.graceGainChanceReduction).toBeUndefined();
    });

    it('does not have timeGainChanceReduction', () => {
      const enemy = createCirclingVulture();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.timeGainChanceReduction).toBeUndefined();
    });

    it('does not have healingChanceReduction', () => {
      const enemy = createCirclingVulture();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.healingChanceReduction).toBeUndefined();
    });

    it('does not have damageMultiplier', () => {
      const enemy = createCirclingVulture();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.damageMultiplier).toBeUndefined();
    });

    it('does not have pointsMultiplier', () => {
      const enemy = createCirclingVulture();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.pointsMultiplier).toBeUndefined();
    });

    it('stat modifiers are empty (no weapon counters)', () => {
      const enemy = createCirclingVulture();
      const modifiers = enemy.getStatModifiers();
      expect(Object.keys(modifiers).length).toBe(0);
    });
  });

  // ==========================================================================
  // INTEGRATION / SCENARIO TESTS
  // ==========================================================================
  describe('integration scenarios', () => {
    it('full round simulation: score decay over 60 seconds', () => {
      const enemy = createCirclingVulture();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      let totalDecay = 0;

      // Simulate 60 seconds of gameplay at ~60fps
      const tickMs = 1000 / 60;
      const totalTicks = 60 * 60; // 60 seconds * 60 ticks/sec

      for (let i = 0; i < totalTicks; i++) {
        const result = enemy.onTick(tickMs, board);
        totalDecay += result.scoreDelta;
      }

      // Should decay about 6 points (60 seconds * 0.1 pts/sec)
      expect(totalDecay).toBeCloseTo(-6, 1);
    });

    it('does not prevent reaching defeat condition despite decay', () => {
      const enemy = createCirclingVulture();
      enemy.onRoundStart([]);

      // Even with decay, high enough score should defeat enemy
      const stats = createRoundStats({ currentScore: 200, targetScore: 100 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('board state does not affect decay rate', () => {
      const enemy = createCirclingVulture();

      // Test with empty board
      enemy.onRoundStart([]);
      const resultEmpty = enemy.onTick(1000, []);

      // Test with populated board
      const enemy2 = createCirclingVulture();
      const board = createTestBoard(18);
      enemy2.onRoundStart(board);
      const resultFull = enemy2.onTick(1000, board);

      expect(resultEmpty.scoreDelta).toBe(resultFull.scoreDelta);
    });

    it('face-down cards on board do not affect behavior', () => {
      const enemy = createCirclingVulture();
      const board = [
        createFaceDownCard(),
        createFaceDownCard(),
        createCard(),
        createCard(),
      ];

      enemy.onRoundStart(board);
      const result = enemy.onTick(1000, board);

      expect(result.scoreDelta).toBe(-0.1);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('triple cards on board do not affect behavior', () => {
      const enemy = createCirclingVulture();
      const board = [
        createTripleCard(),
        createTripleCard(),
        createCard(),
        createCard(),
      ];

      enemy.onRoundStart(board);
      const result = enemy.onTick(1000, board);

      expect(result.scoreDelta).toBe(-0.1);
      expect(result.cardModifications).toEqual([]);
    });

    it('matches do not reset decay rate', () => {
      const enemy = createCirclingVulture();
      enemy.onRoundStart([]);

      // Tick for 5 seconds
      enemy.onTick(5000, []);

      // Make a match
      enemy.onValidMatch([createCard(), createCard(), createCard()], []);

      // Decay should continue at same rate
      const result = enemy.onTick(1000, []);
      expect(result.scoreDelta).toBe(-0.1);
    });

    it('invalid matches do not affect decay', () => {
      const enemy = createCirclingVulture();
      enemy.onRoundStart([]);

      // Make an invalid match
      enemy.onInvalidMatch([createCard(), createCard(), createCard()], []);

      // Decay should continue normally
      const result = enemy.onTick(1000, []);
      expect(result.scoreDelta).toBe(-0.1);
    });

    it('multiple rounds work correctly', () => {
      const enemy = createCirclingVulture();

      // First round
      enemy.onRoundStart([]);
      enemy.onTick(10000, []);
      enemy.onRoundEnd();

      // Second round
      enemy.onRoundStart([]);
      const result = enemy.onTick(1000, []);

      // Should decay normally in second round
      expect(result.scoreDelta).toBe(-0.1);
    });
  });

  // ==========================================================================
  // TYPE SAFETY / CONTRACT TESTS
  // ==========================================================================
  describe('type safety and contract', () => {
    it('all lifecycle methods are defined', () => {
      const enemy = createCirclingVulture();

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

    it('tier is a valid tier number (1-4)', () => {
      const enemy = createCirclingVulture();
      expect([1, 2, 3, 4]).toContain(enemy.tier);
    });

    it('onTick result has all required properties', () => {
      const enemy = createCirclingVulture();
      enemy.onRoundStart([]);
      const result = enemy.onTick(1000, []);

      expect(result).toHaveProperty('scoreDelta');
      expect(result).toHaveProperty('healthDelta');
      expect(result).toHaveProperty('timeDelta');
      expect(result).toHaveProperty('cardsToRemove');
      expect(result).toHaveProperty('cardModifications');
      expect(result).toHaveProperty('cardsToFlip');
      expect(result).toHaveProperty('events');
      expect(result).toHaveProperty('instantDeath');
    });

    it('onValidMatch result has all required properties', () => {
      const enemy = createCirclingVulture();
      const result = enemy.onValidMatch([], []);

      expect(result).toHaveProperty('timeDelta');
      expect(result).toHaveProperty('pointsMultiplier');
      expect(result).toHaveProperty('cardsToRemove');
      expect(result).toHaveProperty('cardsToFlip');
      expect(result).toHaveProperty('events');
    });

    it('onInvalidMatch result has all required properties', () => {
      const enemy = createCirclingVulture();
      const result = enemy.onInvalidMatch([], []);

      expect(result).toHaveProperty('timeDelta');
      expect(result).toHaveProperty('pointsMultiplier');
      expect(result).toHaveProperty('cardsToRemove');
      expect(result).toHaveProperty('cardsToFlip');
      expect(result).toHaveProperty('events');
    });

    it('onRoundStart result has all required properties', () => {
      const enemy = createCirclingVulture();
      const result = enemy.onRoundStart([]);

      expect(result).toHaveProperty('cardModifications');
      expect(result).toHaveProperty('events');
    });
  });
});
