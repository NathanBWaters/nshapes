import { createHydraHead, createTheHydra } from '@/utils/enemies/tier4/theHydra';
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
  colorMatchCounts: new Map(),
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
  // Time gain trigger tracking
  timeGainTriggersThisRound: 0,
  timeGainTriggerCapBonus: 0,
  consecutiveInvalidMatches: 0,
  prismaticPerfectionTriggered: false,
  tabulaRasaTriggered: false,
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

describe('The Hydra', () => {
  describe('telegraphed Heavy Slam (replaces instantDeath)', () => {
    it('warns at 25s and delivers a −2 ♥ Heavy Slam after 30s without instant death', () => {
      const enemy = createTheHydra();
      const board = createTestBoard();
      enemy.onRoundStart(board);

      const warn = enemy.onTick(25000, board);
      expect(warn.instantDeath).toBe(false);
      expect(warn.events).toContainEqual(expect.objectContaining({ type: 'inactivity_warning' }));

      const slam = enemy.onTick(5000, board);
      expect(slam.instantDeath).toBe(false);
      expect(slam.healthDelta).toBe(-2);
    });
  });

  describe('3-Head Phases ([GP-16])', () => {
    it('does not steal -4s per match (replaced punitive time-steal soup)', () => {
      const enemy = createTheHydra();
      const board = createTestBoard();

      const result = enemy.onValidMatch([board[0], board[1], board[2]], board);
      expect(result.timeDelta).toBe(0);
    });

    it('supports distinct Head I, Head II, and Head III phases', () => {
      const h1 = createHydraHead(1);
      const h2 = createHydraHead(2);
      const h3 = createHydraHead(3);
      expect(h1.name).toBe('The Hydra');
      expect(h2.name).toBe('The Hydra');
      expect(h3.name).toBe('The Hydra');
      expect(h1.description).toContain('Head I');
      expect(h2.description).toContain('Head II');
      expect(h3.description).toContain('Head III');
    });
  });

  describe('defeat condition', () => {
    it('returns false with 9 matches', () => {
      const enemy = createTheHydra();
      const stats = createEmptyStats();
      stats.totalMatches = 9;
      stats.invalidMatches = 0;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false with 10 matches but invalid', () => {
      const enemy = createTheHydra();
      const stats = createEmptyStats();
      stats.totalMatches = 10;
      stats.invalidMatches = 1;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with 10+ matches and no invalid', () => {
      const enemy = createTheHydra();
      const stats = createEmptyStats();
      stats.totalMatches = 10;
      stats.invalidMatches = 0;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
