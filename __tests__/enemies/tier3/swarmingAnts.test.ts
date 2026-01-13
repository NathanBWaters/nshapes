import { createSwarmingAnts } from '@/utils/enemies/tier3/swarmingAnts';
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

describe('Swarming Ants', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createSwarmingAnts();
      expect(enemy.name).toBe('Swarming Ants');
      expect(enemy.tier).toBe(3);
    });

    it('has correct icon', () => {
      const enemy = createSwarmingAnts();
      expect(enemy.icon).toBe('delapouite/ant');
    });
  });

  describe('fire counter', () => {
    it('reduces fire by 55%', () => {
      const enemy = createSwarmingAnts();
      const statMods = enemy.getStatModifiers();
      expect(statMods.fireSpreadChanceReduction).toBe(55);
    });
  });

  describe('countdown effect', () => {
    it('places 8s countdown card', () => {
      const enemy = createSwarmingAnts();
      const board = createTestBoard();

      const result = enemy.onRoundStart(board);
      const countdownMod = result.cardModifications.find((m) => m.changes.hasCountdown);
      expect(countdownMod).toBeDefined();
      expect(countdownMod?.changes.countdownTimer).toBe(8000);
    });
  });

  describe('defeat condition', () => {
    it('returns false with 4 bombs defused', () => {
      const enemy = createSwarmingAnts();
      const stats = createEmptyStats();
      stats.bombsDefused = 4;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with 5+ bombs defused', () => {
      const enemy = createSwarmingAnts();
      const stats = createEmptyStats();
      stats.bombsDefused = 5;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
