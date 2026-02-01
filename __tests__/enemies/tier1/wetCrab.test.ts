/**
 * Comprehensive Unit Tests for Wet Crab Enemy
 *
 * Wet Crab - Tier 1 Enemy
 * Effect: Fire effects reduced by 15%
 * Defeat Condition: Get 2 all-same color matches
 */

import type { Card } from '@/types';
import type { RoundStats } from '@/types/enemy';
import { createWetCrab } from '@/utils/enemies/tier1/wetCrab';
import {
  createRoundStats,
  createCard,
  createTestBoard,
  resetCardIdCounter,
  createFaceDownCard,
  createTripleCard,
} from '../../testUtils';

// Reset card IDs before each test for deterministic results
beforeEach(() => {
  resetCardIdCounter();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ============================================================================
// METADATA TESTS
// ============================================================================

describe('Wet Crab', () => {
  describe('metadata', () => {
    it('has correct name', () => {
      const enemy = createWetCrab();
      expect(enemy.name).toBe('Wet Crab');
    });

    it('has correct tier (1)', () => {
      const enemy = createWetCrab();
      expect(enemy.tier).toBe(1);
    });

    it('has correct icon', () => {
      const enemy = createWetCrab();
      expect(enemy.icon).toBe('lorc/crab');
    });

    it('has description containing "Fire"', () => {
      const enemy = createWetCrab();
      expect(enemy.description).toContain('Fire');
    });

    it('has description containing "divided by 3"', () => {
      const enemy = createWetCrab();
      expect(enemy.description).toContain('divided by 3');
    });

    it('has description exactly matching expected text', () => {
      const enemy = createWetCrab();
      expect(enemy.description).toBe('Fire effects divided by 3');
    });

    it('has defeatConditionText containing "2"', () => {
      const enemy = createWetCrab();
      expect(enemy.defeatConditionText).toContain('2');
    });

    it('has defeatConditionText containing "all-same"', () => {
      const enemy = createWetCrab();
      expect(enemy.defeatConditionText).toContain('all-same');
    });

    it('has defeatConditionText containing "color"', () => {
      const enemy = createWetCrab();
      expect(enemy.defeatConditionText).toContain('color');
    });

    it('has defeatConditionText containing "matches"', () => {
      const enemy = createWetCrab();
      expect(enemy.defeatConditionText).toContain('matches');
    });

    it('has defeatConditionText exactly matching expected text', () => {
      const enemy = createWetCrab();
      expect(enemy.defeatConditionText).toBe('Get 2 all-same color matches');
    });

    it('tier is a valid tier number (1-4)', () => {
      const enemy = createWetCrab();
      expect([1, 2, 3, 4]).toContain(enemy.tier);
    });

    it('name is not empty', () => {
      const enemy = createWetCrab();
      expect(enemy.name.length).toBeGreaterThan(0);
    });

    it('icon is not empty', () => {
      const enemy = createWetCrab();
      expect(enemy.icon.length).toBeGreaterThan(0);
    });

    it('description is not empty', () => {
      const enemy = createWetCrab();
      expect(enemy.description.length).toBeGreaterThan(0);
    });

    it('defeatConditionText is not empty', () => {
      const enemy = createWetCrab();
      expect(enemy.defeatConditionText.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // WEAPON COUNTER EFFECT TESTS (STAT MODIFIERS)
  // ============================================================================

  describe('WeaponCounterEffect - getStatModifiers', () => {
    it('returns fireSpreadChanceReduction of 15', () => {
      const enemy = createWetCrab();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.fireSpreadChanceReduction).toBe(15);
    });

    it('does not return explosionChanceReduction', () => {
      const enemy = createWetCrab();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.explosionChanceReduction).toBeUndefined();
    });

    it('does not return laserChanceReduction', () => {
      const enemy = createWetCrab();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.laserChanceReduction).toBeUndefined();
    });

    it('does not return hintGainChanceReduction', () => {
      const enemy = createWetCrab();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.hintGainChanceReduction).toBeUndefined();
    });

    it('does not return graceGainChanceReduction', () => {
      const enemy = createWetCrab();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.graceGainChanceReduction).toBeUndefined();
    });

    it('does not return timeGainChanceReduction', () => {
      const enemy = createWetCrab();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.timeGainChanceReduction).toBeUndefined();
    });

    it('does not return healingChanceReduction', () => {
      const enemy = createWetCrab();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.healingChanceReduction).toBeUndefined();
    });

    it('does not return damageMultiplier', () => {
      const enemy = createWetCrab();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.damageMultiplier).toBeUndefined();
    });

    it('does not return pointsMultiplier in stat modifiers', () => {
      const enemy = createWetCrab();
      const modifiers = enemy.getStatModifiers();
      expect(modifiers.pointsMultiplier).toBeUndefined();
    });

    it('returns consistent stat modifiers on multiple calls', () => {
      const enemy = createWetCrab();
      const modifiers1 = enemy.getStatModifiers();
      const modifiers2 = enemy.getStatModifiers();
      expect(modifiers1.fireSpreadChanceReduction).toBe(modifiers2.fireSpreadChanceReduction);
    });
  });

  // ============================================================================
  // UI MODIFIERS TESTS
  // ============================================================================

  describe('WeaponCounterEffect - getUIModifiers', () => {
    it('returns weaponCounters array', () => {
      const enemy = createWetCrab();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.weaponCounters).toBeDefined();
      expect(Array.isArray(uiMods.weaponCounters)).toBe(true);
    });

    it('weaponCounters contains fire type', () => {
      const enemy = createWetCrab();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.weaponCounters).toContainEqual({ type: 'fire', reduction: 15 });
    });

    it('weaponCounters has exactly one entry', () => {
      const enemy = createWetCrab();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.weaponCounters?.length).toBe(1);
    });

    it('does not show inactivity bar', () => {
      const enemy = createWetCrab();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.showInactivityBar).toBeUndefined();
    });

    it('does not show score decay', () => {
      const enemy = createWetCrab();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.showScoreDecay).toBeUndefined();
    });

    it('does not have timerSpeedMultiplier', () => {
      const enemy = createWetCrab();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBeUndefined();
    });

    it('does not disable auto hint', () => {
      const enemy = createWetCrab();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.disableAutoHint).toBeUndefined();
    });

    it('does not disable manual hint', () => {
      const enemy = createWetCrab();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.disableManualHint).toBeUndefined();
    });

    it('does not show countdown cards', () => {
      const enemy = createWetCrab();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.showCountdownCards).toBeUndefined();
    });

    it('does not show bomb cards', () => {
      const enemy = createWetCrab();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.showBombCards).toBeUndefined();
    });

    it('returns consistent UI modifiers on multiple calls', () => {
      const enemy = createWetCrab();
      const uiMods1 = enemy.getUIModifiers();
      const uiMods2 = enemy.getUIModifiers();
      expect(uiMods1.weaponCounters).toEqual(uiMods2.weaponCounters);
    });
  });

  // ============================================================================
  // DEFEAT CONDITION TESTS
  // ============================================================================

  describe('defeat condition', () => {
    describe('threshold boundary tests', () => {
      it('returns false when allSameColorMatches is 0', () => {
        const enemy = createWetCrab();
        const stats = createRoundStats({ allSameColorMatches: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns false when allSameColorMatches is 1 (threshold - 1)', () => {
        const enemy = createWetCrab();
        const stats = createRoundStats({ allSameColorMatches: 1 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true when allSameColorMatches is exactly 2 (at threshold)', () => {
        const enemy = createWetCrab();
        const stats = createRoundStats({ allSameColorMatches: 2 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when allSameColorMatches is 3 (above threshold)', () => {
        const enemy = createWetCrab();
        const stats = createRoundStats({ allSameColorMatches: 3 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when allSameColorMatches is 5 (well above threshold)', () => {
        const enemy = createWetCrab();
        const stats = createRoundStats({ allSameColorMatches: 5 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when allSameColorMatches is 10', () => {
        const enemy = createWetCrab();
        const stats = createRoundStats({ allSameColorMatches: 10 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('returns true when allSameColorMatches is 100', () => {
        const enemy = createWetCrab();
        const stats = createRoundStats({ allSameColorMatches: 100 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('independence from other stats', () => {
      it('is not affected by totalMatches', () => {
        const enemy = createWetCrab();
        const stats = createRoundStats({ allSameColorMatches: 0, totalMatches: 50 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('is not affected by allDifferentMatches', () => {
        const enemy = createWetCrab();
        const stats = createRoundStats({ allSameColorMatches: 0, allDifferentMatches: 10 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('is not affected by currentStreak', () => {
        const enemy = createWetCrab();
        const stats = createRoundStats({ allSameColorMatches: 1, currentStreak: 20 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('is not affected by maxStreak', () => {
        const enemy = createWetCrab();
        const stats = createRoundStats({ allSameColorMatches: 1, maxStreak: 15 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('is not affected by invalidMatches', () => {
        const enemy = createWetCrab();
        const stats = createRoundStats({ allSameColorMatches: 2, invalidMatches: 5 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('is not affected by currentScore', () => {
        const enemy = createWetCrab();
        const stats = createRoundStats({ allSameColorMatches: 1, currentScore: 1000 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('is not affected by timeRemaining', () => {
        const enemy = createWetCrab();
        const stats = createRoundStats({ allSameColorMatches: 2, timeRemaining: 0 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('is not affected by gracesUsed', () => {
        const enemy = createWetCrab();
        const stats = createRoundStats({ allSameColorMatches: 1, gracesUsed: 5 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('is not affected by hintsUsed', () => {
        const enemy = createWetCrab();
        const stats = createRoundStats({ allSameColorMatches: 2, hintsUsed: 10 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('is not affected by damageReceived', () => {
        const enemy = createWetCrab();
        const stats = createRoundStats({ allSameColorMatches: 1, damageReceived: 5 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('is not affected by tripleCardsCleared', () => {
        const enemy = createWetCrab();
        const stats = createRoundStats({ allSameColorMatches: 2, tripleCardsCleared: 3 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });

      it('is not affected by faceDownCardsMatched', () => {
        const enemy = createWetCrab();
        const stats = createRoundStats({ allSameColorMatches: 1, faceDownCardsMatched: 6 });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('is not affected by squiggleMatches', () => {
        const enemy = createWetCrab();
        const stats = createRoundStats({ allSameColorMatches: 2, squiggleMatches: 10 });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });

    describe('stat combinations', () => {
      it('returns false with many other stats but allSameColorMatches at 0', () => {
        const enemy = createWetCrab();
        const stats = createRoundStats({
          allSameColorMatches: 0,
          totalMatches: 100,
          allDifferentMatches: 50,
          currentStreak: 20,
          maxStreak: 30,
          currentScore: 5000,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(false);
      });

      it('returns true with minimal other stats but allSameColorMatches at 2', () => {
        const enemy = createWetCrab();
        const stats = createRoundStats({
          allSameColorMatches: 2,
          totalMatches: 2,
          allDifferentMatches: 0,
          currentStreak: 2,
          maxStreak: 2,
          currentScore: 20,
        });
        expect(enemy.checkDefeatCondition(stats)).toBe(true);
      });
    });
  });

  // ============================================================================
  // LIFECYCLE HOOKS - onRoundStart
  // ============================================================================

  describe('onRoundStart', () => {
    it('returns empty cardModifications array', () => {
      const enemy = createWetCrab();
      const board = createTestBoard(12);
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createWetCrab();
      const board = createTestBoard(12);
      const result = enemy.onRoundStart(board);
      expect(result.events).toEqual([]);
    });

    it('does not modify cards on empty board', () => {
      const enemy = createWetCrab();
      const board: Card[] = [];
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
    });

    it('does not modify cards on standard 12-card board', () => {
      const enemy = createWetCrab();
      const board = createTestBoard(12);
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications.length).toBe(0);
    });

    it('does not modify cards on large 18-card board', () => {
      const enemy = createWetCrab();
      const board = createTestBoard(18);
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications.length).toBe(0);
    });

    it('handles board with face-down cards', () => {
      const enemy = createWetCrab();
      const board = [createFaceDownCard(), createCard(), createCard()];
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
    });

    it('handles board with triple cards', () => {
      const enemy = createWetCrab();
      const board = [createTripleCard(), createCard(), createCard()];
      const result = enemy.onRoundStart(board);
      expect(result.cardModifications).toEqual([]);
    });

    it('returns result object with correct structure', () => {
      const enemy = createWetCrab();
      const board = createTestBoard(12);
      const result = enemy.onRoundStart(board);
      expect(result).toHaveProperty('cardModifications');
      expect(result).toHaveProperty('events');
    });
  });

  // ============================================================================
  // LIFECYCLE HOOKS - onTick
  // ============================================================================

  describe('onTick', () => {
    it('returns zero scoreDelta', () => {
      const enemy = createWetCrab();
      const board = createTestBoard(12);
      const result = enemy.onTick(1000, board);
      expect(result.scoreDelta).toBe(0);
    });

    it('returns zero healthDelta', () => {
      const enemy = createWetCrab();
      const board = createTestBoard(12);
      const result = enemy.onTick(1000, board);
      expect(result.healthDelta).toBe(0);
    });

    it('returns zero timeDelta', () => {
      const enemy = createWetCrab();
      const board = createTestBoard(12);
      const result = enemy.onTick(1000, board);
      expect(result.timeDelta).toBe(0);
    });

    it('returns empty cardsToRemove array', () => {
      const enemy = createWetCrab();
      const board = createTestBoard(12);
      const result = enemy.onTick(1000, board);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardModifications array', () => {
      const enemy = createWetCrab();
      const board = createTestBoard(12);
      const result = enemy.onTick(1000, board);
      expect(result.cardModifications).toEqual([]);
    });

    it('returns empty cardsToFlip array', () => {
      const enemy = createWetCrab();
      const board = createTestBoard(12);
      const result = enemy.onTick(1000, board);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createWetCrab();
      const board = createTestBoard(12);
      const result = enemy.onTick(1000, board);
      expect(result.events).toEqual([]);
    });

    it('returns false for instantDeath', () => {
      const enemy = createWetCrab();
      const board = createTestBoard(12);
      const result = enemy.onTick(1000, board);
      expect(result.instantDeath).toBe(false);
    });

    it('handles very small deltaMs (1ms)', () => {
      const enemy = createWetCrab();
      const board = createTestBoard(12);
      const result = enemy.onTick(1, board);
      expect(result.healthDelta).toBe(0);
      expect(result.instantDeath).toBe(false);
    });

    it('handles large deltaMs (60000ms)', () => {
      const enemy = createWetCrab();
      const board = createTestBoard(12);
      const result = enemy.onTick(60000, board);
      expect(result.healthDelta).toBe(0);
      expect(result.instantDeath).toBe(false);
    });

    it('handles zero deltaMs', () => {
      const enemy = createWetCrab();
      const board = createTestBoard(12);
      const result = enemy.onTick(0, board);
      expect(result.healthDelta).toBe(0);
    });

    it('handles empty board', () => {
      const enemy = createWetCrab();
      const board: Card[] = [];
      const result = enemy.onTick(1000, board);
      expect(result.healthDelta).toBe(0);
    });

    it('is consistent across multiple tick calls', () => {
      const enemy = createWetCrab();
      const board = createTestBoard(12);
      const result1 = enemy.onTick(1000, board);
      const result2 = enemy.onTick(1000, board);
      expect(result1.healthDelta).toBe(result2.healthDelta);
      expect(result1.scoreDelta).toBe(result2.scoreDelta);
    });

    it('returns result object with correct structure', () => {
      const enemy = createWetCrab();
      const board = createTestBoard(12);
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
  });

  // ============================================================================
  // LIFECYCLE HOOKS - onValidMatch
  // ============================================================================

  describe('onValidMatch', () => {
    it('returns zero timeDelta', () => {
      const enemy = createWetCrab();
      const matchedCards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.timeDelta).toBe(0);
    });

    it('returns pointsMultiplier of 1', () => {
      const enemy = createWetCrab();
      const matchedCards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('returns empty cardsToRemove array', () => {
      const enemy = createWetCrab();
      const matchedCards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardsToFlip array', () => {
      const enemy = createWetCrab();
      const matchedCards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createWetCrab();
      const matchedCards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.events).toEqual([]);
    });

    it('handles empty matchedCards array', () => {
      const enemy = createWetCrab();
      const matchedCards: Card[] = [];
      const board = createTestBoard(12);
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('handles matchedCards with single card', () => {
      const enemy = createWetCrab();
      const matchedCards = [createCard()];
      const board = createTestBoard(12);
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('handles matchedCards with face-down cards', () => {
      const enemy = createWetCrab();
      const matchedCards = [createFaceDownCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.timeDelta).toBe(0);
    });

    it('handles empty board', () => {
      const enemy = createWetCrab();
      const matchedCards = [createCard(), createCard(), createCard()];
      const board: Card[] = [];
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns consistent results on multiple calls', () => {
      const enemy = createWetCrab();
      const matchedCards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result1 = enemy.onValidMatch(matchedCards, board);
      const result2 = enemy.onValidMatch(matchedCards, board);
      expect(result1.timeDelta).toBe(result2.timeDelta);
      expect(result1.pointsMultiplier).toBe(result2.pointsMultiplier);
    });

    it('returns result object with correct structure', () => {
      const enemy = createWetCrab();
      const matchedCards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onValidMatch(matchedCards, board);
      expect(result).toHaveProperty('timeDelta');
      expect(result).toHaveProperty('pointsMultiplier');
      expect(result).toHaveProperty('cardsToRemove');
      expect(result).toHaveProperty('cardsToFlip');
      expect(result).toHaveProperty('events');
    });
  });

  // ============================================================================
  // LIFECYCLE HOOKS - onInvalidMatch
  // ============================================================================

  describe('onInvalidMatch', () => {
    it('returns zero timeDelta', () => {
      const enemy = createWetCrab();
      const cards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onInvalidMatch(cards, board);
      expect(result.timeDelta).toBe(0);
    });

    it('returns pointsMultiplier of 1', () => {
      const enemy = createWetCrab();
      const cards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onInvalidMatch(cards, board);
      expect(result.pointsMultiplier).toBe(1);
    });

    it('returns empty cardsToRemove array', () => {
      const enemy = createWetCrab();
      const cards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onInvalidMatch(cards, board);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('returns empty cardsToFlip array', () => {
      const enemy = createWetCrab();
      const cards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onInvalidMatch(cards, board);
      expect(result.cardsToFlip).toEqual([]);
    });

    it('returns empty events array', () => {
      const enemy = createWetCrab();
      const cards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onInvalidMatch(cards, board);
      expect(result.events).toEqual([]);
    });

    it('handles empty cards array', () => {
      const enemy = createWetCrab();
      const cards: Card[] = [];
      const board = createTestBoard(12);
      const result = enemy.onInvalidMatch(cards, board);
      expect(result.cardsToRemove).toEqual([]);
    });

    it('handles empty board', () => {
      const enemy = createWetCrab();
      const cards = [createCard(), createCard(), createCard()];
      const board: Card[] = [];
      const result = enemy.onInvalidMatch(cards, board);
      expect(result.timeDelta).toBe(0);
    });

    it('returns result object with correct structure', () => {
      const enemy = createWetCrab();
      const cards = [createCard(), createCard(), createCard()];
      const board = createTestBoard(12);
      const result = enemy.onInvalidMatch(cards, board);
      expect(result).toHaveProperty('timeDelta');
      expect(result).toHaveProperty('pointsMultiplier');
      expect(result).toHaveProperty('cardsToRemove');
      expect(result).toHaveProperty('cardsToFlip');
      expect(result).toHaveProperty('events');
    });
  });

  // ============================================================================
  // LIFECYCLE HOOKS - onCardDraw
  // ============================================================================

  describe('onCardDraw', () => {
    it('returns the same card unmodified', () => {
      const enemy = createWetCrab();
      const card = createCard({ shape: 'diamond', color: 'purple', number: 2 });
      const result = enemy.onCardDraw(card);
      expect(result).toEqual(card);
    });

    it('does not add isDud property', () => {
      const enemy = createWetCrab();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isDud).toBeUndefined();
    });

    it('does not add isFaceDown property', () => {
      const enemy = createWetCrab();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.isFaceDown).toBeUndefined();
    });

    it('does not add hasBomb property', () => {
      const enemy = createWetCrab();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.hasBomb).toBeUndefined();
    });

    it('does not add hasCountdown property', () => {
      const enemy = createWetCrab();
      const card = createCard();
      const result = enemy.onCardDraw(card);
      expect(result.hasCountdown).toBeUndefined();
    });

    it('preserves card shape', () => {
      const enemy = createWetCrab();
      const card = createCard({ shape: 'squiggle' });
      const result = enemy.onCardDraw(card);
      expect(result.shape).toBe('squiggle');
    });

    it('preserves card color', () => {
      const enemy = createWetCrab();
      const card = createCard({ color: 'green' });
      const result = enemy.onCardDraw(card);
      expect(result.color).toBe('green');
    });

    it('preserves card number', () => {
      const enemy = createWetCrab();
      const card = createCard({ number: 3 });
      const result = enemy.onCardDraw(card);
      expect(result.number).toBe(3);
    });

    it('preserves card shading', () => {
      const enemy = createWetCrab();
      const card = createCard({ shading: 'striped' });
      const result = enemy.onCardDraw(card);
      expect(result.shading).toBe('striped');
    });

    it('preserves card id', () => {
      const enemy = createWetCrab();
      const card = createCard({ id: 'test-card-specific-id' });
      const result = enemy.onCardDraw(card);
      expect(result.id).toBe('test-card-specific-id');
    });

    it('is consistent across multiple draws', () => {
      const enemy = createWetCrab();
      const card = createCard();
      const result1 = enemy.onCardDraw(card);
      const result2 = enemy.onCardDraw(card);
      expect(result1).toEqual(result2);
    });
  });

  // ============================================================================
  // LIFECYCLE HOOKS - onRoundEnd
  // ============================================================================

  describe('onRoundEnd', () => {
    it('does not throw', () => {
      const enemy = createWetCrab();
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('returns undefined', () => {
      const enemy = createWetCrab();
      const result = enemy.onRoundEnd();
      expect(result).toBeUndefined();
    });

    it('can be called multiple times without error', () => {
      const enemy = createWetCrab();
      expect(() => {
        enemy.onRoundEnd();
        enemy.onRoundEnd();
        enemy.onRoundEnd();
      }).not.toThrow();
    });

    it('can be called after onRoundStart', () => {
      const enemy = createWetCrab();
      const board = createTestBoard(12);
      enemy.onRoundStart(board);
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('can be called after onTick', () => {
      const enemy = createWetCrab();
      const board = createTestBoard(12);
      enemy.onTick(1000, board);
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });
  });

  // ============================================================================
  // ENEMY INSTANCE CREATION
  // ============================================================================

  describe('createWetCrab factory', () => {
    it('creates independent instances', () => {
      const enemy1 = createWetCrab();
      const enemy2 = createWetCrab();
      expect(enemy1).not.toBe(enemy2);
    });

    it('creates instances with identical metadata', () => {
      const enemy1 = createWetCrab();
      const enemy2 = createWetCrab();
      expect(enemy1.name).toBe(enemy2.name);
      expect(enemy1.tier).toBe(enemy2.tier);
      expect(enemy1.icon).toBe(enemy2.icon);
      expect(enemy1.description).toBe(enemy2.description);
      expect(enemy1.defeatConditionText).toBe(enemy2.defeatConditionText);
    });

    it('creates instances with identical stat modifiers', () => {
      const enemy1 = createWetCrab();
      const enemy2 = createWetCrab();
      expect(enemy1.getStatModifiers()).toEqual(enemy2.getStatModifiers());
    });

    it('creates instances with identical UI modifiers', () => {
      const enemy1 = createWetCrab();
      const enemy2 = createWetCrab();
      expect(enemy1.getUIModifiers()).toEqual(enemy2.getUIModifiers());
    });

    it('creates instances with working lifecycle hooks', () => {
      const enemy = createWetCrab();
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
  });

  // ============================================================================
  // INTEGRATION SCENARIOS
  // ============================================================================

  describe('integration scenarios', () => {
    it('full round lifecycle: start, tick, match, end', () => {
      const enemy = createWetCrab();
      const board = createTestBoard(12);

      // Start round
      const startResult = enemy.onRoundStart(board);
      expect(startResult.cardModifications).toEqual([]);

      // Several ticks
      const tickResult1 = enemy.onTick(1000, board);
      expect(tickResult1.healthDelta).toBe(0);

      const tickResult2 = enemy.onTick(2000, board);
      expect(tickResult2.healthDelta).toBe(0);

      // Valid match
      const matchedCards = [board[0], board[1], board[2]];
      const matchResult = enemy.onValidMatch(matchedCards, board);
      expect(matchResult.timeDelta).toBe(0);

      // End round
      expect(() => enemy.onRoundEnd()).not.toThrow();
    });

    it('defeat condition progression: 0 -> 1 -> 2 matches', () => {
      const enemy = createWetCrab();

      // Start at 0
      let stats = createRoundStats({ allSameColorMatches: 0 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);

      // Progress to 1
      stats = createRoundStats({ allSameColorMatches: 1 });
      expect(enemy.checkDefeatCondition(stats)).toBe(false);

      // Reach 2 - defeated
      stats = createRoundStats({ allSameColorMatches: 2 });
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('fire effect reduction is consistently 15%', () => {
      const enemy = createWetCrab();

      // Verify through stat modifiers
      expect(enemy.getStatModifiers().fireSpreadChanceReduction).toBe(15);

      // Verify through UI modifiers
      const weaponCounters = enemy.getUIModifiers().weaponCounters;
      const fireCounter = weaponCounters?.find((c) => c.type === 'fire');
      expect(fireCounter?.reduction).toBe(15);
    });

    it('maintains state across lifecycle calls', () => {
      const enemy = createWetCrab();
      const board = createTestBoard(12);

      // UI modifiers should be consistent before and after lifecycle events
      const uiModsBefore = enemy.getUIModifiers();

      enemy.onRoundStart(board);
      enemy.onTick(1000, board);
      enemy.onValidMatch([board[0]], board);
      enemy.onInvalidMatch([board[1]], board);

      const uiModsAfter = enemy.getUIModifiers();

      // Fire reduction should remain constant
      expect(uiModsBefore.weaponCounters).toEqual(uiModsAfter.weaponCounters);
    });
  });
});
