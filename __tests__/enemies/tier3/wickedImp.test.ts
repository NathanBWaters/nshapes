import { createWickedImp } from '@/utils/enemies/tier3/wickedImp';
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

describe('Wicked Imp', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createWickedImp();
      expect(enemy.name).toBe('Wicked Imp');
      expect(enemy.tier).toBe(3);
    });

    it('has correct icon', () => {
      const enemy = createWickedImp();
      expect(enemy.icon).toBe('lorc/imp');
    });
  });

  describe('multiplier effects', () => {
    it('has 2x damage multiplier', () => {
      const enemy = createWickedImp();
      const statMods = enemy.getStatModifiers();
      expect(statMods.damageMultiplier).toBe(2.0);
    });

    it('has 2x points multiplier', () => {
      const enemy = createWickedImp();
      const board = createTestBoard();
      const result = enemy.onValidMatch([board[0], board[1], board[2]], board);
      expect(result.pointsMultiplier).toBe(2.0);
    });
  });

  describe('weapon counters', () => {
    it('reduces grace and time by 55%', () => {
      const enemy = createWickedImp();
      const statMods = enemy.getStatModifiers();
      expect(statMods.graceGainChanceReduction).toBe(55);
      expect(statMods.timeGainChanceReduction).toBe(55);
    });
  });

  describe('defeat condition', () => {
    it('returns false if target not reached', () => {
      const enemy = createWickedImp();
      const stats = createEmptyStats();
      stats.currentScore = 80;
      stats.targetScore = 100;
      stats.gracesRemaining = 3;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false with fewer than 3 graces remaining', () => {
      const enemy = createWickedImp();
      const stats = createEmptyStats();
      stats.currentScore = 100;
      stats.targetScore = 100;
      stats.gracesRemaining = 2;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with target reached and 3+ graces', () => {
      const enemy = createWickedImp();
      const stats = createEmptyStats();
      stats.currentScore = 100;
      stats.targetScore = 100;
      stats.gracesRemaining = 3;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
