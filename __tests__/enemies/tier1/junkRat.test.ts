/**
 * Comprehensive Unit Tests for Junk Rat Enemy
 *
 * Junk Rat is a Tier 1 enemy with the following behavior:
 * - Effect: 4% chance per card draw → card becomes a dud (unmatchable)
 * - Defeat Condition: Get a 4-match streak
 */
import { createJunkRat } from '@/utils/enemies/tier1/junkRat';
import {
  createRoundStats,
  createCard,
  createTestBoard,
  resetCardIdCounter,
} from '../../testUtils';

// Mock Math.random for deterministic tests
const mockRandom = (value: number) => {
  jest.spyOn(Math, 'random').mockReturnValue(value);
};

beforeEach(() => {
  resetCardIdCounter();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Junk Rat', () => {
  // ==========================================================================
  // METADATA TESTS
  // ==========================================================================
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createJunkRat();
      expect(enemy.name).toBe('Junk Rat');
    });

    it('is tier 1', () => {
      const enemy = createJunkRat();
      expect(enemy.tier).toBe(1);
    });

    it('has an icon defined', () => {
      const enemy = createJunkRat();
      expect(enemy.icon).toBeDefined();
      expect(typeof enemy.icon).toBe('string');
    });

    it('description mentions 4% chance', () => {
      const enemy = createJunkRat();
      expect(enemy.description).toContain('4%');
    });

    it('description mentions unmatchable', () => {
      const enemy = createJunkRat();
      expect(enemy.description).toContain('unmatchable');
    });

    it('defeat condition text mentions 4-match streak', () => {
      const enemy = createJunkRat();
      expect(enemy.defeatConditionText).toBe('Get a 4-match streak');
    });
  });

  // ==========================================================================
  // DUD CARD EFFECT TESTS (onCardDraw)
  // ==========================================================================
  describe('dud effect (onCardDraw)', () => {
    it('creates dud when random is 0 (minimum)', () => {
      mockRandom(0);
      const enemy = createJunkRat();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isDud).toBe(true);
    });

    it('creates dud when random is 0.03 (3%, below threshold)', () => {
      mockRandom(0.03);
      const enemy = createJunkRat();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isDud).toBe(true);
    });

    it('creates dud when random is 0.039 (just below 4%)', () => {
      mockRandom(0.039);
      const enemy = createJunkRat();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isDud).toBe(true);
    });

    it('does not create dud at exactly 4% threshold', () => {
      mockRandom(0.04);
      const enemy = createJunkRat();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isDud).toBeUndefined();
    });

    it('does not create dud when random is 0.05 (5%)', () => {
      mockRandom(0.05);
      const enemy = createJunkRat();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isDud).toBeUndefined();
    });

    it('does not create dud when random is 0.5 (50%)', () => {
      mockRandom(0.5);
      const enemy = createJunkRat();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isDud).toBeUndefined();
    });

    it('does not create dud when random is 0.99 (99%)', () => {
      mockRandom(0.99);
      const enemy = createJunkRat();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isDud).toBeUndefined();
    });

    it('preserves original card properties when creating dud', () => {
      mockRandom(0.01);
      const enemy = createJunkRat();
      const card = createCard({
        shape: 'squiggle',
        color: 'purple',
        number: 3,
        shading: 'striped',
      });
      const result = enemy.onCardDraw(card);
      expect(result.isDud).toBe(true);
      expect(result.shape).toBe('squiggle');
      expect(result.color).toBe('purple');
      expect(result.number).toBe(3);
      expect(result.shading).toBe('striped');
    });

    it('preserves original card properties when not creating dud', () => {
      mockRandom(0.5);
      const enemy = createJunkRat();
      const card = createCard({
        shape: 'diamond',
        color: 'green',
        number: 2,
        shading: 'open',
      });
      const result = enemy.onCardDraw(card);
      expect(result.isDud).toBeUndefined();
      expect(result.shape).toBe('diamond');
      expect(result.color).toBe('green');
      expect(result.number).toBe(2);
      expect(result.shading).toBe('open');
    });
  });

  // ==========================================================================
  // DEFEAT CONDITION TESTS
  // ==========================================================================
  describe('defeat condition (checkDefeatCondition)', () => {
    it('returns false when maxStreak is 0', () => {
      const enemy = createJunkRat();
      const stats = createRoundStats({ maxStreak: 0 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when maxStreak is 1', () => {
      const enemy = createJunkRat();
      const stats = createRoundStats({ maxStreak: 1 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when maxStreak is 2', () => {
      const enemy = createJunkRat();
      const stats = createRoundStats({ maxStreak: 2 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when maxStreak is 3 (threshold - 1)', () => {
      const enemy = createJunkRat();
      const stats = createRoundStats({ maxStreak: 3 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when maxStreak equals 4 (exact threshold)', () => {
      const enemy = createJunkRat();
      const stats = createRoundStats({ maxStreak: 4 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when maxStreak is 5 (above threshold)', () => {
      const enemy = createJunkRat();
      const stats = createRoundStats({ maxStreak: 5 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when maxStreak is 10 (well above threshold)', () => {
      const enemy = createJunkRat();
      const stats = createRoundStats({ maxStreak: 10 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('uses maxStreak not currentStreak for defeat condition', () => {
      const enemy = createJunkRat();
      // maxStreak reached 4 earlier, but currentStreak was reset
      const stats = createRoundStats({ maxStreak: 4, currentStreak: 1 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });

  // ==========================================================================
  // LIFECYCLE HOOKS TESTS
  // ==========================================================================
  describe('lifecycle hooks', () => {
    describe('onRoundStart', () => {
      it('returns empty cardModifications array', () => {
        const enemy = createJunkRat();
        const board = createTestBoard(12);
        const result = enemy.onRoundStart(board);
        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty events array', () => {
        const enemy = createJunkRat();
        const board = createTestBoard(12);
        const result = enemy.onRoundStart(board);
        expect(result.events).toEqual([]);
      });

      it('handles empty board', () => {
        const enemy = createJunkRat();
        const result = enemy.onRoundStart([]);
        expect(result.cardModifications).toEqual([]);
        expect(result.events).toEqual([]);
      });
    });

    describe('onTick', () => {
      it('returns zero scoreDelta', () => {
        const enemy = createJunkRat();
        const board = createTestBoard(12);
        const result = enemy.onTick(1000, board);
        expect(result.scoreDelta).toBe(0);
      });

      it('returns zero healthDelta', () => {
        const enemy = createJunkRat();
        const board = createTestBoard(12);
        const result = enemy.onTick(1000, board);
        expect(result.healthDelta).toBe(0);
      });

      it('returns zero timeDelta', () => {
        const enemy = createJunkRat();
        const board = createTestBoard(12);
        const result = enemy.onTick(1000, board);
        expect(result.timeDelta).toBe(0);
      });

      it('returns empty cardsToRemove array', () => {
        const enemy = createJunkRat();
        const board = createTestBoard(12);
        const result = enemy.onTick(1000, board);
        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty cardModifications array', () => {
        const enemy = createJunkRat();
        const board = createTestBoard(12);
        const result = enemy.onTick(1000, board);
        expect(result.cardModifications).toEqual([]);
      });

      it('returns empty cardsToFlip array', () => {
        const enemy = createJunkRat();
        const board = createTestBoard(12);
        const result = enemy.onTick(1000, board);
        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events array', () => {
        const enemy = createJunkRat();
        const board = createTestBoard(12);
        const result = enemy.onTick(1000, board);
        expect(result.events).toEqual([]);
      });

      it('returns false for instantDeath', () => {
        const enemy = createJunkRat();
        const board = createTestBoard(12);
        const result = enemy.onTick(1000, board);
        expect(result.instantDeath).toBe(false);
      });

      it('handles large deltaMs values', () => {
        const enemy = createJunkRat();
        const board = createTestBoard(12);
        const result = enemy.onTick(60000, board); // 60 seconds
        expect(result.scoreDelta).toBe(0);
        expect(result.healthDelta).toBe(0);
      });
    });

    describe('onValidMatch', () => {
      it('returns 1.0 pointsMultiplier (no modification)', () => {
        const enemy = createJunkRat();
        const matchedCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.pointsMultiplier).toBe(1);
      });

      it('returns zero timeDelta', () => {
        const enemy = createJunkRat();
        const matchedCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.timeDelta).toBe(0);
      });

      it('returns empty cardsToRemove array', () => {
        const enemy = createJunkRat();
        const matchedCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty cardsToFlip array', () => {
        const enemy = createJunkRat();
        const matchedCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.cardsToFlip).toEqual([]);
      });

      it('returns empty events array', () => {
        const enemy = createJunkRat();
        const matchedCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onValidMatch(matchedCards, board);
        expect(result.events).toEqual([]);
      });
    });

    describe('onInvalidMatch', () => {
      it('returns 1.0 pointsMultiplier (no modification)', () => {
        const enemy = createJunkRat();
        const invalidCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onInvalidMatch(invalidCards, board);
        expect(result.pointsMultiplier).toBe(1);
      });

      it('returns zero timeDelta', () => {
        const enemy = createJunkRat();
        const invalidCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onInvalidMatch(invalidCards, board);
        expect(result.timeDelta).toBe(0);
      });

      it('returns empty cardsToRemove array (no extra penalty)', () => {
        const enemy = createJunkRat();
        const invalidCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onInvalidMatch(invalidCards, board);
        expect(result.cardsToRemove).toEqual([]);
      });

      it('returns empty events array', () => {
        const enemy = createJunkRat();
        const invalidCards = [createCard(), createCard(), createCard()];
        const board = createTestBoard(12);
        const result = enemy.onInvalidMatch(invalidCards, board);
        expect(result.events).toEqual([]);
      });
    });

    describe('onRoundEnd', () => {
      it('can be called without error', () => {
        const enemy = createJunkRat();
        expect(() => enemy.onRoundEnd()).not.toThrow();
      });

      it('returns undefined', () => {
        const enemy = createJunkRat();
        const result = enemy.onRoundEnd();
        expect(result).toBeUndefined();
      });
    });
  });

  // ==========================================================================
  // UI MODIFIERS TESTS
  // ==========================================================================
  describe('UI modifiers (getUIModifiers)', () => {
    it('returns empty object (no UI modifications)', () => {
      const enemy = createJunkRat();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers).toEqual({});
    });

    it('does not show inactivity bar', () => {
      const enemy = createJunkRat();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showInactivityBar).toBeUndefined();
    });

    it('does not show score decay', () => {
      const enemy = createJunkRat();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showScoreDecay).toBeUndefined();
    });

    it('does not have timer speed multiplier', () => {
      const enemy = createJunkRat();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.timerSpeedMultiplier).toBeUndefined();
    });

    it('does not disable auto hints', () => {
      const enemy = createJunkRat();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableAutoHint).toBeUndefined();
    });

    it('does not disable manual hints', () => {
      const enemy = createJunkRat();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.disableManualHint).toBeUndefined();
    });

    it('does not show countdown cards', () => {
      const enemy = createJunkRat();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showCountdownCards).toBeUndefined();
    });

    it('does not show bomb cards', () => {
      const enemy = createJunkRat();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.showBombCards).toBeUndefined();
    });

    it('does not have weapon counters', () => {
      const enemy = createJunkRat();
      const modifiers = enemy.getUIModifiers();
      expect(modifiers.weaponCounters).toBeUndefined();
    });
  });

  // ==========================================================================
  // STAT MODIFIERS TESTS
  // ==========================================================================
  describe('stat modifiers (getStatModifiers)', () => {
    it('returns empty object (no stat modifications)', () => {
      const enemy = createJunkRat();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers).toEqual({});
    });

    it('does not reduce fire spread chance', () => {
      const enemy = createJunkRat();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.fireSpreadChanceReduction).toBeUndefined();
    });

    it('does not reduce explosion chance', () => {
      const enemy = createJunkRat();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.explosionChanceReduction).toBeUndefined();
    });

    it('does not reduce laser chance', () => {
      const enemy = createJunkRat();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.laserChanceReduction).toBeUndefined();
    });

    it('does not reduce hint gain chance', () => {
      const enemy = createJunkRat();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.hintGainChanceReduction).toBeUndefined();
    });

    it('does not reduce grace gain chance', () => {
      const enemy = createJunkRat();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.graceGainChanceReduction).toBeUndefined();
    });

    it('does not reduce time gain chance', () => {
      const enemy = createJunkRat();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.timeGainChanceReduction).toBeUndefined();
    });

    it('does not reduce healing chance', () => {
      const enemy = createJunkRat();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.healingChanceReduction).toBeUndefined();
    });

    it('does not have damage multiplier', () => {
      const enemy = createJunkRat();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.damageMultiplier).toBeUndefined();
    });

    it('does not have points multiplier', () => {
      const enemy = createJunkRat();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.pointsMultiplier).toBeUndefined();
    });
  });

  // ==========================================================================
  // INTEGRATION TESTS
  // ==========================================================================
  describe('integration scenarios', () => {
    it('multiple card draws with varying random values', () => {
      const enemy = createJunkRat();

      // First draw: becomes dud
      mockRandom(0.02);
      const card1 = createCard({ id: 'card-1' });
      expect(enemy.onCardDraw(card1).isDud).toBe(true);

      // Second draw: normal
      mockRandom(0.5);
      const card2 = createCard({ id: 'card-2' });
      expect(enemy.onCardDraw(card2).isDud).toBeUndefined();

      // Third draw: becomes dud
      mockRandom(0.01);
      const card3 = createCard({ id: 'card-3' });
      expect(enemy.onCardDraw(card3).isDud).toBe(true);
    });

    it('full round lifecycle', () => {
      const enemy = createJunkRat();
      const board = createTestBoard(12);

      // Start round
      const startResult = enemy.onRoundStart(board);
      expect(startResult.cardModifications).toEqual([]);

      // Tick
      const tickResult = enemy.onTick(1000, board);
      expect(tickResult.healthDelta).toBe(0);

      // Valid match
      const matchResult = enemy.onValidMatch(board.slice(0, 3), board);
      expect(matchResult.pointsMultiplier).toBe(1);

      // Check defeat condition not met
      const stats1 = createRoundStats({ maxStreak: 2 });
      expect(enemy.checkDefeatCondition(stats1)).toBe(false);

      // More valid matches leading to defeat
      const stats2 = createRoundStats({ maxStreak: 4 });
      expect(enemy.checkDefeatCondition(stats2)).toBe(true);

      // End round
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('enemy instance is independent (factory creates new instance)', () => {
      const enemy1 = createJunkRat();
      const enemy2 = createJunkRat();

      // Both should have same metadata
      expect(enemy1.name).toBe(enemy2.name);
      expect(enemy1.tier).toBe(enemy2.tier);

      // But they are different instances
      expect(enemy1).not.toBe(enemy2);
    });
  });
});
