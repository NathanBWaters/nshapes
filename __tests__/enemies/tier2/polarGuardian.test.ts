import { createPolarGuardian } from '@/utils/enemies/tier2/polarGuardian';
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

describe('Polar Guardian', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createPolarGuardian();
      expect(enemy.name).toBe('Polar Guardian');
      expect(enemy.tier).toBe(2);
    });

    it('has correct icon', () => {
      const enemy = createPolarGuardian();
      expect(enemy.icon).toBe('sparker/bear-face');
    });
  });

  describe('damage multiplier effect', () => {
    it('has 2x damage multiplier', () => {
      const enemy = createPolarGuardian();
      const statMods = enemy.getStatModifiers();
      expect(statMods.damageMultiplier).toBe(2.0);
    });
  });

  describe('points multiplier effect', () => {
    it('has 2x points multiplier', () => {
      const enemy = createPolarGuardian();
      const board = createTestBoard();

      const result = enemy.onValidMatch([board[0], board[1], board[2]], board);
      expect(result.pointsMultiplier).toBe(2.0);
    });
  });

  describe('laser weapon counter', () => {
    it('reduces laser by 40%', () => {
      const enemy = createPolarGuardian();
      const statMods = enemy.getStatModifiers();
      expect(statMods.laserChanceReduction).toBe(40);
    });

    it('shows weapon counter in UI', () => {
      const enemy = createPolarGuardian();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.weaponCounters).toContainEqual({ type: 'laser', reduction: 40 });
    });
  });

  describe('defeat condition', () => {
    it('returns false if damage was taken', () => {
      const enemy = createPolarGuardian();
      const stats = createEmptyStats();
      stats.damageReceived = 1;
      stats.weaponEffectsTriggered = new Set(['fire']);
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false if no weapon effect triggered', () => {
      const enemy = createPolarGuardian();
      const stats = createEmptyStats();
      stats.damageReceived = 0;
      stats.weaponEffectsTriggered = new Set();
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with no damage and 1 weapon effect', () => {
      const enemy = createPolarGuardian();
      const stats = createEmptyStats();
      stats.damageReceived = 0;
      stats.weaponEffectsTriggered = new Set(['fire']);
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
