import { createWorldEater } from '@/utils/enemies/tier4/worldEater';
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

describe('World Eater', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createWorldEater();
      expect(enemy.name).toBe('World Eater');
      expect(enemy.tier).toBe(4);
    });

    it('has correct icon', () => {
      const enemy = createWorldEater();
      expect(enemy.icon).toBe('lorc/daemon-skull');
    });
  });

  describe('extra card removal on match', () => {
    it('removes 2 cards on valid match', () => {
      const enemy = createWorldEater();
      const board = createTestBoard();

      const result = enemy.onValidMatch([board[0], board[1], board[2]], board);
      expect(result.cardsToRemove.length).toBe(2);
    });
  });

  describe('extra card removal on invalid', () => {
    it('removes 3 cards on invalid match', () => {
      const enemy = createWorldEater();
      const board = createTestBoard();

      const result = enemy.onInvalidMatch([board[0], board[1], board[2]], board);
      expect(result.cardsToRemove.length).toBe(3);
    });
  });

  describe('timer speed', () => {
    it('has 50% faster timer', () => {
      const enemy = createWorldEater();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBe(1.5);
    });
  });

  describe('inactivity effect', () => {
    it('causes instant death after 25s', () => {
      const enemy = createWorldEater();
      const board = createTestBoard();
      enemy.onRoundStart(board);

      const result = enemy.onTick(25000, board);
      expect(result.instantDeath).toBe(true);
    });
  });

  describe('defeat condition', () => {
    it('returns false if target not reached', () => {
      const enemy = createWorldEater();
      const stats = createEmptyStats();
      stats.currentScore = 80;
      stats.targetScore = 100;
      stats.cardsRemaining = 5;
      stats.invalidMatches = 0;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false with fewer than 4 cards', () => {
      const enemy = createWorldEater();
      const stats = createEmptyStats();
      stats.currentScore = 100;
      stats.targetScore = 100;
      stats.cardsRemaining = 3;
      stats.invalidMatches = 0;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false if invalid match made', () => {
      const enemy = createWorldEater();
      const stats = createEmptyStats();
      stats.currentScore = 100;
      stats.targetScore = 100;
      stats.cardsRemaining = 5;
      stats.invalidMatches = 1;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with target, 4+ cards, no invalid', () => {
      const enemy = createWorldEater();
      const stats = createEmptyStats();
      stats.currentScore = 100;
      stats.targetScore = 100;
      stats.cardsRemaining = 4;
      stats.invalidMatches = 0;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
