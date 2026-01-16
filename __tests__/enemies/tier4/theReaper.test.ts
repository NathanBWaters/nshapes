import { createTheReaper } from '@/utils/enemies/tier4/theReaper';
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

describe('The Reaper', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createTheReaper();
      expect(enemy.name).toBe('The Reaper');
      expect(enemy.tier).toBe(4);
    });

    it('has correct icon', () => {
      const enemy = createTheReaper();
      expect(enemy.icon).toBe('lorc/grim-reaper');
    });
  });

  describe('weapon counters', () => {
    it('reduces grace by 60%', () => {
      const enemy = createTheReaper();
      const statMods = enemy.getStatModifiers();
      expect(statMods.graceGainChanceReduction).toBe(60);
    });

    it('reduces time by 60%', () => {
      const enemy = createTheReaper();
      const statMods = enemy.getStatModifiers();
      expect(statMods.timeGainChanceReduction).toBe(60);
    });
  });

  describe('hint disable', () => {
    it('disables all hints', () => {
      const enemy = createTheReaper();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.disableAutoHint).toBe(true);
      expect(uiMods.disableManualHint).toBe(true);
    });
  });

  describe('score decay', () => {
    it('decays at 0.33 points per second (1 per 3s)', () => {
      const enemy = createTheReaper();
      const board = createTestBoard();

      const result = enemy.onTick(1000, board);
      expect(result.scoreDelta).toBe(-0.33);
    });
  });

  describe('defeat condition', () => {
    it('returns false if target not reached', () => {
      const enemy = createTheReaper();
      const stats = createEmptyStats();
      stats.currentScore = 80;
      stats.targetScore = 100;
      stats.timeRemaining = 15000;
      stats.damageReceived = 0;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false with less than 10s remaining', () => {
      const enemy = createTheReaper();
      const stats = createEmptyStats();
      stats.currentScore = 100;
      stats.targetScore = 100;
      stats.timeRemaining = 9000;
      stats.damageReceived = 0;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false if damage taken', () => {
      const enemy = createTheReaper();
      const stats = createEmptyStats();
      stats.currentScore = 100;
      stats.targetScore = 100;
      stats.timeRemaining = 15000;
      stats.damageReceived = 1;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with target, 10+s, no damage', () => {
      const enemy = createTheReaper();
      const stats = createEmptyStats();
      stats.currentScore = 100;
      stats.targetScore = 100;
      stats.timeRemaining = 10000;
      stats.damageReceived = 0;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
