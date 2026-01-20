/**
 * Comprehensive Unit Tests for Wild Goose Enemy
 *
 * Wild Goose - Tier 1 Enemy
 * Effect: Shuffles card positions every 30s
 * Defeat Condition: Match 2 sets that share a card attribute
 */
import { createWildGoose } from '@/utils/enemies/tier1/wildGoose';
import {
  createRoundStats,
  createCard,
  createTestBoard,
  resetCardIdCounter,
} from '../../testUtils';

// Reset card IDs before each test for deterministic behavior
beforeEach(() => {
  resetCardIdCounter();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Wild Goose', () => {
  // ==========================================================================
  // METADATA TESTS
  // ==========================================================================
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createWildGoose();
      expect(enemy.name).toBe('Wild Goose');
    });

    it('has correct tier (1)', () => {
      const enemy = createWildGoose();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon', () => {
      const enemy = createWildGoose();
      expect(enemy.icon).toBe('lorc/swan');
    });

    it('has description containing key terms about shuffling', () => {
      const enemy = createWildGoose();
      expect(enemy.description.toLowerCase()).toContain('shuffle');
    });

    it('has description containing time interval (30s)', () => {
      const enemy = createWildGoose();
      expect(enemy.description).toContain('30s');
    });

    it('has description containing "position" or "positions"', () => {
      const enemy = createWildGoose();
      expect(enemy.description.toLowerCase()).toContain('position');
    });

    it('has defeatConditionText describing the match requirement', () => {
      const enemy = createWildGoose();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('match');
      expect(enemy.defeatConditionText.toLowerCase()).toContain('2');
    });

    it('has defeatConditionText mentioning shared attribute', () => {
      const enemy = createWildGoose();
      expect(enemy.defeatConditionText.toLowerCase()).toContain('share');
      expect(enemy.defeatConditionText.toLowerCase()).toContain('attribute');
    });
  });

  // ==========================================================================
  // POSITION SHUFFLE EFFECT TESTS
  // ==========================================================================
  describe('position shuffle effect', () => {
    it('does not shuffle immediately after round start', () => {
      const enemy = createWildGoose();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      const result = enemy.onTick(0, board);
      expect(result.events).not.toContainEqual({ type: 'positions_shuffled' });
    });

    it('does not shuffle before 30s (at 1 second)', () => {
      const enemy = createWildGoose();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      const result = enemy.onTick(1000, board);
      expect(result.events).not.toContainEqual({ type: 'positions_shuffled' });
    });

    it('does not shuffle at 29 seconds', () => {
      const enemy = createWildGoose();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      const result = enemy.onTick(29000, board);
      expect(result.events).not.toContainEqual({ type: 'positions_shuffled' });
    });

    it('does not shuffle at 29.999 seconds', () => {
      const enemy = createWildGoose();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      const result = enemy.onTick(29999, board);
      expect(result.events).not.toContainEqual({ type: 'positions_shuffled' });
    });

    it('shuffles at exactly 30 seconds', () => {
      const enemy = createWildGoose();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      const result = enemy.onTick(30000, board);
      expect(result.events).toContainEqual({ type: 'positions_shuffled' });
    });

    it('shuffles when accumulated time exceeds 30s (e.g., 31 seconds)', () => {
      const enemy = createWildGoose();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      const result = enemy.onTick(31000, board);
      expect(result.events).toContainEqual({ type: 'positions_shuffled' });
    });

    it('accumulates time across multiple ticks until 30s', () => {
      const enemy = createWildGoose();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      // 10 seconds
      let result = enemy.onTick(10000, board);
      expect(result.events).not.toContainEqual({ type: 'positions_shuffled' });

      // 20 seconds total
      result = enemy.onTick(10000, board);
      expect(result.events).not.toContainEqual({ type: 'positions_shuffled' });

      // 30 seconds total - should shuffle
      result = enemy.onTick(10000, board);
      expect(result.events).toContainEqual({ type: 'positions_shuffled' });
    });

    it('shuffles again at 60 seconds (second interval)', () => {
      const enemy = createWildGoose();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      // First shuffle at 30s
      enemy.onTick(30000, board);

      // Second shuffle at 60s (30s more)
      const result = enemy.onTick(30000, board);
      expect(result.events).toContainEqual({ type: 'positions_shuffled' });
    });

    it('shuffles at third interval (90 seconds)', () => {
      const enemy = createWildGoose();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      // First shuffle at 30s
      enemy.onTick(30000, board);
      // Second shuffle at 60s
      enemy.onTick(30000, board);
      // Third shuffle at 90s
      const result = enemy.onTick(30000, board);
      expect(result.events).toContainEqual({ type: 'positions_shuffled' });
    });

    it('resets shuffle timer on round start', () => {
      const enemy = createWildGoose();
      const board = createTestBoard(12);

      // Advance time close to shuffle
      enemy.onRoundStart(board);
      enemy.onTick(25000, board);

      // Start new round - timer should reset
      enemy.onRoundStart(board);

      // Now 25s should not trigger shuffle
      const result = enemy.onTick(25000, board);
      expect(result.events).not.toContainEqual({ type: 'positions_shuffled' });
    });
  });

  // ==========================================================================
  // DEFEAT CONDITION TESTS
  // ==========================================================================
  describe('defeat condition', () => {
    it('returns false when no matches have been made', () => {
      const enemy = createWildGoose();
      const stats = createRoundStats({ totalMatches: 0 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when only 1 match has been made (threshold - 1)', () => {
      const enemy = createWildGoose();
      const stats = createRoundStats({ totalMatches: 1 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when exactly 2 matches have been made (at threshold)', () => {
      const enemy = createWildGoose();
      const stats = createRoundStats({ totalMatches: 2 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when 3 matches have been made (above threshold)', () => {
      const enemy = createWildGoose();
      const stats = createRoundStats({ totalMatches: 3 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when many matches have been made (10 matches)', () => {
      const enemy = createWildGoose();
      const stats = createRoundStats({ totalMatches: 10 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('does not consider invalid matches for defeat condition', () => {
      const enemy = createWildGoose();
      const stats = createRoundStats({ totalMatches: 0, invalidMatches: 5 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('considers only valid matches regardless of other stats', () => {
      const enemy = createWildGoose();
      const stats = createRoundStats({
        totalMatches: 2,
        invalidMatches: 10,
        currentStreak: 0,
        gracesUsed: 5,
        damageReceived: 3,
      });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS TESTS
  // ==========================================================================
  describe('lifecycle hooks', () => {
    describe('onRoundStart', () => {
      it('returns valid EnemyStartResult structure', () => {
        const enemy = createWildGoose();
        const board = createTestBoard(12);
        const result = enemy.onRoundStart(board);

        expect(result).toHaveProperty('cardModifications');
        expect(result).toHaveProperty('events');
        expect(Array.isArray(result.cardModifications)).toBe(true);
        expect(Array.isArray(result.events)).toBe(true);
      });

      it('does not modify any cards on round start', () => {
        const enemy = createWildGoose();
        const board = createTestBoard(12);
        const result = enemy.onRoundStart(board);

        expect(result.cardModifications).toHaveLength(0);
      });

      it('does not emit events on round start', () => {
        const enemy = createWildGoose();
        const board = createTestBoard(12);
        const result = enemy.onRoundStart(board);

        expect(result.events).toHaveLength(0);
      });
    });

    describe('onCardDraw', () => {
      it('returns the card unchanged', () => {
        const enemy = createWildGoose();
        const card = createCard({ shape: 'diamond', color: 'purple', number: 3 });
        const result = enemy.onCardDraw(card);

        expect(result).toEqual(card);
        expect(result.id).toBe(card.id);
        expect(result.shape).toBe('diamond');
        expect(result.color).toBe('purple');
        expect(result.number).toBe(3);
      });

      it('does not add dud state to drawn cards', () => {
        const enemy = createWildGoose();
        const card = createCard();
        const result = enemy.onCardDraw(card);

        expect(result.isDud).toBeUndefined();
      });

      it('does not add face-down state to drawn cards', () => {
        const enemy = createWildGoose();
        const card = createCard();
        const result = enemy.onCardDraw(card);

        expect(result.isFaceDown).toBeUndefined();
      });

      it('does not add bomb state to drawn cards', () => {
        const enemy = createWildGoose();
        const card = createCard();
        const result = enemy.onCardDraw(card);

        expect(result.hasBomb).toBeUndefined();
      });
    });

    describe('onValidMatch', () => {
      it('returns valid EnemyMatchResult structure', () => {
        const enemy = createWildGoose();
        const board = createTestBoard(12);
        const matchedCards = [createCard(), createCard(), createCard()];
        enemy.onRoundStart(board);

        const result = enemy.onValidMatch(matchedCards, board);

        expect(result).toHaveProperty('timeDelta');
        expect(result).toHaveProperty('pointsMultiplier');
        expect(result).toHaveProperty('cardsToRemove');
        expect(result).toHaveProperty('cardsToFlip');
        expect(result).toHaveProperty('events');
      });

      it('does not modify time on valid match', () => {
        const enemy = createWildGoose();
        const board = createTestBoard(12);
        const matchedCards = [createCard(), createCard(), createCard()];
        enemy.onRoundStart(board);

        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.timeDelta).toBe(0);
      });

      it('uses default points multiplier (1x)', () => {
        const enemy = createWildGoose();
        const board = createTestBoard(12);
        const matchedCards = [createCard(), createCard(), createCard()];
        enemy.onRoundStart(board);

        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.pointsMultiplier).toBe(1);
      });

      it('does not remove extra cards on valid match', () => {
        const enemy = createWildGoose();
        const board = createTestBoard(12);
        const matchedCards = [createCard(), createCard(), createCard()];
        enemy.onRoundStart(board);

        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.cardsToRemove).toHaveLength(0);
      });
    });

    describe('onInvalidMatch', () => {
      it('returns valid EnemyMatchResult structure', () => {
        const enemy = createWildGoose();
        const board = createTestBoard(12);
        const cards = [createCard(), createCard(), createCard()];
        enemy.onRoundStart(board);

        const result = enemy.onInvalidMatch(cards, board);

        expect(result).toHaveProperty('timeDelta');
        expect(result).toHaveProperty('pointsMultiplier');
        expect(result).toHaveProperty('cardsToRemove');
        expect(result).toHaveProperty('cardsToFlip');
        expect(result).toHaveProperty('events');
      });

      it('does not apply extra penalties on invalid match', () => {
        const enemy = createWildGoose();
        const board = createTestBoard(12);
        const cards = [createCard(), createCard(), createCard()];
        enemy.onRoundStart(board);

        const result = enemy.onInvalidMatch(cards, board);
        expect(result.timeDelta).toBe(0);
        expect(result.cardsToRemove).toHaveLength(0);
      });
    });

    describe('onRoundEnd', () => {
      it('can be called without error', () => {
        const enemy = createWildGoose();
        expect(() => enemy.onRoundEnd()).not.toThrow();
      });

      it('resets internal state for next round', () => {
        const enemy = createWildGoose();
        const board = createTestBoard(12);

        // Advance time to near shuffle
        enemy.onRoundStart(board);
        enemy.onTick(29000, board);

        // End round
        enemy.onRoundEnd();

        // Start new round
        enemy.onRoundStart(board);

        // 1 second should not trigger shuffle (state was reset)
        const result = enemy.onTick(1000, board);
        expect(result.events).not.toContainEqual({ type: 'positions_shuffled' });
      });
    });

    describe('onTick', () => {
      it('returns valid EnemyTickResult structure', () => {
        const enemy = createWildGoose();
        const board = createTestBoard(12);
        enemy.onRoundStart(board);

        const result = enemy.onTick(1000, board);

        expect(result).toHaveProperty('scoreDelta');
        expect(result).toHaveProperty('healthDelta');
        expect(result).toHaveProperty('timeDelta');
        expect(result).toHaveProperty('cardsToRemove');
        expect(result).toHaveProperty('cardModifications');
        expect(result).toHaveProperty('cardsToFlip');
        expect(result).toHaveProperty('events');
        expect(result).toHaveProperty('instantDeath');
      });

      it('does not decay score', () => {
        const enemy = createWildGoose();
        const board = createTestBoard(12);
        enemy.onRoundStart(board);

        const result = enemy.onTick(1000, board);
        expect(result.scoreDelta).toBe(0);
      });

      it('does not damage player on tick', () => {
        const enemy = createWildGoose();
        const board = createTestBoard(12);
        enemy.onRoundStart(board);

        const result = enemy.onTick(1000, board);
        expect(result.healthDelta).toBe(0);
      });

      it('does not modify time', () => {
        const enemy = createWildGoose();
        const board = createTestBoard(12);
        enemy.onRoundStart(board);

        const result = enemy.onTick(1000, board);
        expect(result.timeDelta).toBe(0);
      });

      it('does not cause instant death', () => {
        const enemy = createWildGoose();
        const board = createTestBoard(12);
        enemy.onRoundStart(board);

        const result = enemy.onTick(1000, board);
        expect(result.instantDeath).toBe(false);
      });

      it('does not remove cards on tick', () => {
        const enemy = createWildGoose();
        const board = createTestBoard(12);
        enemy.onRoundStart(board);

        const result = enemy.onTick(1000, board);
        expect(result.cardsToRemove).toHaveLength(0);
      });
    });
  });

  // ==========================================================================
  // UI MODIFIERS TESTS
  // ==========================================================================
  describe('getUIModifiers', () => {
    it('returns an object', () => {
      const enemy = createWildGoose();
      const modifiers = enemy.getUIModifiers();
      expect(typeof modifiers).toBe('object');
    });

    it('does not show inactivity bar', () => {
      const enemy = createWildGoose();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showInactivityBar).toBeUndefined();
    });

    it('does not show score decay', () => {
      const enemy = createWildGoose();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showScoreDecay).toBeUndefined();
    });

    it('does not modify timer speed', () => {
      const enemy = createWildGoose();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.timerSpeedMultiplier).toBeUndefined();
    });

    it('does not disable auto hint', () => {
      const enemy = createWildGoose();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableAutoHint).toBeUndefined();
    });

    it('does not disable manual hint', () => {
      const enemy = createWildGoose();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableManualHint).toBeUndefined();
    });

    it('does not show weapon counters', () => {
      const enemy = createWildGoose();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters).toBeUndefined();
    });
  });

  // ==========================================================================
  // STAT MODIFIERS TESTS
  // ==========================================================================
  describe('getStatModifiers', () => {
    it('returns an object', () => {
      const enemy = createWildGoose();
      const modifiers = enemy.getStatModifiers();
      expect(typeof modifiers).toBe('object');
    });

    it('does not reduce fire spread chance', () => {
      const enemy = createWildGoose();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
    });

    it('does not reduce explosion chance', () => {
      const enemy = createWildGoose();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.explosionChanceReduction).toBeUndefined();
    });

    it('does not reduce laser chance', () => {
      const enemy = createWildGoose();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.laserChanceReduction).toBeUndefined();
    });

    it('does not reduce hint gain chance', () => {
      const enemy = createWildGoose();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.hintGainChanceReduction).toBeUndefined();
    });

    it('does not reduce grace gain chance', () => {
      const enemy = createWildGoose();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.graceGainChanceReduction).toBeUndefined();
    });

    it('does not reduce time gain chance', () => {
      const enemy = createWildGoose();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.timeGainChanceReduction).toBeUndefined();
    });

    it('does not reduce healing chance', () => {
      const enemy = createWildGoose();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.healingChanceReduction).toBeUndefined();
    });

    it('does not apply damage multiplier', () => {
      const enemy = createWildGoose();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.damageMultiplier).toBeUndefined();
    });

    it('does not apply points multiplier', () => {
      const enemy = createWildGoose();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.pointsMultiplier).toBeUndefined();
    });
  });

  // ==========================================================================
  // EDGE CASES AND INTEGRATION
  // ==========================================================================
  describe('edge cases', () => {
    it('handles empty board on tick', () => {
      const enemy = createWildGoose();
      enemy.onRoundStart([]);

      expect(() => enemy.onTick(30000, [])).not.toThrow();
    });

    it('handles empty board on valid match', () => {
      const enemy = createWildGoose();
      enemy.onRoundStart([]);

      expect(() => enemy.onValidMatch([], [])).not.toThrow();
    });

    it('handles large time deltas gracefully', () => {
      const enemy = createWildGoose();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      // 5 minute tick should trigger shuffle (would be multiple intervals)
      const result = enemy.onTick(300000, board);
      expect(result.events).toContainEqual({ type: 'positions_shuffled' });
    });

    it('handles very small time deltas', () => {
      const enemy = createWildGoose();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);

      // 1ms tick should not cause issues
      const result = enemy.onTick(1, board);
      expect(result.events).not.toContainEqual({ type: 'positions_shuffled' });
    });

    it('creates independent instances', () => {
      const enemy1 = createWildGoose();
      const enemy2 = createWildGoose();
      const board = createTestBoard(12);

      enemy1.onRoundStart(board);
      enemy2.onRoundStart(board);

      // Advance enemy1 to near shuffle
      enemy1.onTick(29000, board);

      // enemy2 should have independent state
      const result2 = enemy2.onTick(1000, board);
      expect(result2.events).not.toContainEqual({ type: 'positions_shuffled' });

      // enemy1 should shuffle after 1 more second
      const result1 = enemy1.onTick(1000, board);
      expect(result1.events).toContainEqual({ type: 'positions_shuffled' });
    });
  });
});
