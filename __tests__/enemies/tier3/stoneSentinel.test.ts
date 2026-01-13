import { createStoneSentinel } from '@/utils/enemies/tier3/stoneSentinel';
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

describe('Stone Sentinel', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createStoneSentinel();
      expect(enemy.name).toBe('Stone Sentinel');
      expect(enemy.tier).toBe(3);
    });

    it('has correct icon', () => {
      const enemy = createStoneSentinel();
      expect(enemy.icon).toBe('delapouite/golem-head');
    });
  });

  describe('triple card effect', () => {
    it('places 2 triple cards on start', () => {
      const enemy = createStoneSentinel();
      const board = createTestBoard();

      const result = enemy.onRoundStart(board);
      const tripleCards = result.cardModifications.filter((m) => m.changes.health === 3);
      expect(tripleCards.length).toBe(2);
    });
  });

  describe('weapon counters', () => {
    it('reduces explosion and laser by 55%', () => {
      const enemy = createStoneSentinel();
      const statMods = enemy.getStatModifiers();
      expect(statMods.explosionChanceReduction).toBe(55);
      expect(statMods.laserChanceReduction).toBe(55);
    });
  });

  describe('defeat condition', () => {
    it('returns false with 1 triple card cleared', () => {
      const enemy = createStoneSentinel();
      const stats = createEmptyStats();
      stats.tripleCardsCleared = 1;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with 2+ triple cards cleared', () => {
      const enemy = createStoneSentinel();
      const stats = createEmptyStats();
      stats.tripleCardsCleared = 2;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
