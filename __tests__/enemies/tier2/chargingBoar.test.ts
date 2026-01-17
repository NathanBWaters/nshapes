import { createChargingBoar } from '@/utils/enemies/tier2/chargingBoar';
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

describe('Charging Boar', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createChargingBoar();
      expect(enemy.name).toBe('Charging Boar');
      expect(enemy.tier).toBe(2);
    });

    it('has correct icon', () => {
      const enemy = createChargingBoar();
      expect(enemy.icon).toBe('caro-asercion/boar');
    });

    it('has correct description', () => {
      const enemy = createChargingBoar();
      expect(enemy.description).toBe('35s inactivity → lose 1HP');
    });

    it('has correct defeat condition text', () => {
      const enemy = createChargingBoar();
      expect(enemy.defeatConditionText).toBe('Get 3 matches each under 10s');
    });
  });

  describe('inactivity effect', () => {
    it('shows inactivity bar in UI modifiers', () => {
      const enemy = createChargingBoar();
      const board = createTestBoard();
      enemy.onRoundStart(board);

      const uiMods = enemy.getUIModifiers();
      expect(uiMods.showInactivityBar).toBeDefined();
      expect(uiMods.showInactivityBar?.max).toBe(35000);
      expect(uiMods.showInactivityBar?.penalty).toBe('damage');
    });

    it('deals 1 damage after 35s inactivity', () => {
      const enemy = createChargingBoar();
      const board = createTestBoard();
      enemy.onRoundStart(board);

      // Simulate 35 seconds
      const result = enemy.onTick(35000, board);
      expect(result.healthDelta).toBe(-1);
      expect(result.instantDeath).toBe(false);
    });

    it('resets timer on valid match', () => {
      const enemy = createChargingBoar();
      const board = createTestBoard();
      enemy.onRoundStart(board);

      // Simulate 30 seconds
      enemy.onTick(30000, board);

      // Make a match
      enemy.onValidMatch([board[0], board[1], board[2]], board);

      // Check timer reset
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.showInactivityBar?.current).toBe(0);
    });
  });

  describe('defeat condition', () => {
    it('returns false with no fast matches', () => {
      const enemy = createChargingBoar();
      const stats = createEmptyStats();
      stats.matchTimes = [15000, 12000]; // All slow matches (over 10s)
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false with only 2 fast matches', () => {
      const enemy = createChargingBoar();
      const stats = createEmptyStats();
      stats.matchTimes = [5000, 6000, 15000]; // Only 2 under 10s
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with 3 fast matches', () => {
      const enemy = createChargingBoar();
      const stats = createEmptyStats();
      stats.matchTimes = [5000, 6000, 7000]; // All under 10s
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true with more than 3 fast matches', () => {
      const enemy = createChargingBoar();
      const stats = createEmptyStats();
      stats.matchTimes = [3000, 4000, 5000, 6000, 7000]; // 5 under 10s
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
