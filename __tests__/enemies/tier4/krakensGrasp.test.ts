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

describe("Kraken's Grasp", () => {
  describe('position shuffle', () => {
    it('shuffles every 16s', () => {
      const enemy = createKrakensGrasp();
      const board = createTestBoard();

      const result = enemy.onTick(16000, board);
      expect(result.events).toContainEqual({ type: 'positions_shuffled' });
    });
  });

  describe('Tentacle Lock ([GP-16] replaces blanket 7-weapon counter)', () => {
    it('starts with 0 locked weapons, then wraps 1 weapon type at 18s and rewards ×1.5 when snapped', () => {
      const enemy = createKrakensGrasp();
      const board = createTestBoard();
      enemy.onRoundStart(board);

      expect(enemy.getUIModifiers().weaponCounters ?? []).toHaveLength(0);

      const lockTick = enemy.onTick(18000, board);
      const counters = enemy.getUIModifiers().weaponCounters ?? [];
      expect(counters).toHaveLength(1);
      expect(counters[0].reduction).toBe(50);

      const tentacleMod = lockTick.cardModifications.find(m => m.changes.hasCountdown);
      expect(tentacleMod).toBeDefined();
      const tentacleCard = board.find(c => c.id === tentacleMod!.cardId)!;

      // Clearing the marked tentacle card snaps the lock and boosts damage ×1.5
      const snap = enemy.onValidMatch([tentacleCard, board[0], board[1]], board);
      expect(snap.pointsMultiplier).toBe(1.5);
      expect(enemy.getUIModifiers().weaponCounters ?? []).toHaveLength(0);
    });
  });

  describe('defeat condition', () => {
    it('returns false with no matches', () => {
      const enemy = createKrakensGrasp();
      const stats = createEmptyStats();
      stats.totalMatches = 0;
      stats.cardsRemaining = 6;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false with fewer than 5 cards', () => {
      const enemy = createKrakensGrasp();
      const stats = createEmptyStats();
      stats.totalMatches = 3;
      stats.cardsRemaining = 4;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with matches and 5+ cards remaining', () => {
      const enemy = createKrakensGrasp();
      const stats = createEmptyStats();
      stats.totalMatches = 3;
      stats.cardsRemaining = 5;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
