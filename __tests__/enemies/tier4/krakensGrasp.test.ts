import { createKrakensGrasp } from '@/utils/enemies/tier4/krakensGrasp';
import type { RoundStats } from '@/types/enemy';
import type { Card } from '@/types';

const createEmptyStats = (): RoundStats => ({
  totalMatches: 0,
  currentStreak: 0,
  maxStreak: 0,
  invalidMatches: 0,
  matchTimes: [],
  timeRemaining: 60000,
  cardsRemaining: 12,
  tripleCardsCleared: 0,
  faceDownCardsMatched: 0,
  bombsDefused: 0,
  countdownCardsMatched: 0,
  shapesMatched: new Set(),
  colorsMatched: new Set(),
  allDifferentMatches: 0,
  allSameColorMatches: 0,
  squiggleMatches: 0,
  gracesUsed: 0,
  hintsUsed: 0,
  hintsRemaining: 3,
  gracesRemaining: 2,
  damageReceived: 0,
  weaponEffectsTriggered: new Set(),
  currentScore: 0,
  targetScore: 100,
});

const createTestBoard = (): Card[] =>
  Array(12)
    .fill(null)
    .map((_, i) => ({
      id: `card-${i}`,
      shape: 'oval' as const,
      color: 'red' as const,
      number: 1 as const,
      shading: 'solid' as const,
      selected: false,
    }));

describe("Kraken's Grasp", () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createKrakensGrasp();
      expect(enemy.name).toBe("Kraken's Grasp");
      expect(enemy.tier).toBe(4);
    });

    it('has correct icon', () => {
      const enemy = createKrakensGrasp();
      expect(enemy.icon).toBe('delapouite/kraken-tentacle');
    });
  });

  describe('position shuffle', () => {
    it('shuffles every 10s', () => {
      const enemy = createKrakensGrasp();
      const board = createTestBoard();

      const result = enemy.onTick(10000, board);
      expect(result.events).toContainEqual({ type: 'positions_shuffled' });
    });
  });

  describe('weapon counters', () => {
    it('counters all 7 weapon types at 75%', () => {
      const enemy = createKrakensGrasp();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.weaponCounters?.length).toBe(7);
      uiMods.weaponCounters?.forEach((counter) => {
        expect(counter.reduction).toBe(75);
      });
    });
  });

  describe('defeat condition', () => {
    it('returns false if target not reached', () => {
      const enemy = createKrakensGrasp();
      const stats = createEmptyStats();
      stats.currentScore = 80;
      stats.targetScore = 100;
      stats.cardsRemaining = 6;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false with fewer than 5 cards', () => {
      const enemy = createKrakensGrasp();
      const stats = createEmptyStats();
      stats.currentScore = 100;
      stats.targetScore = 100;
      stats.cardsRemaining = 4;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with target and 5+ cards', () => {
      const enemy = createKrakensGrasp();
      const stats = createEmptyStats();
      stats.currentScore = 100;
      stats.targetScore = 100;
      stats.cardsRemaining = 5;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
