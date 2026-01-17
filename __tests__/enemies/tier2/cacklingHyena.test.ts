import { createCacklingHyena } from '@/utils/enemies/tier2/cacklingHyena';
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

describe('Cackling Hyena', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createCacklingHyena();
      expect(enemy.name).toBe('Cackling Hyena');
      expect(enemy.tier).toBe(2);
    });

    it('has correct icon', () => {
      const enemy = createCacklingHyena();
      expect(enemy.icon).toBe('caro-asercion/hyena-head');
    });
  });

  describe('time steal effect', () => {
    it('steals 3 seconds per match', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard();

      const result = enemy.onValidMatch([board[0], board[1], board[2]], board);
      expect(result.timeDelta).toBe(-3);
    });

    it('emits time stolen event', () => {
      const enemy = createCacklingHyena();
      const board = createTestBoard();

      const result = enemy.onValidMatch([board[0], board[1], board[2]], board);
      expect(result.events).toContainEqual({ type: 'time_stolen', amount: 3 });
    });
  });

  describe('grace counter effect', () => {
    it('reduces grace gain by 35%', () => {
      const enemy = createCacklingHyena();
      const statMods = enemy.getStatModifiers();
      expect(statMods.graceGainChanceReduction).toBe(35);
    });

    it('shows weapon counter in UI', () => {
      const enemy = createCacklingHyena();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.weaponCounters).toContainEqual({ type: 'grace', reduction: 35 });
    });
  });

  describe('defeat condition', () => {
    it('returns false with fewer than 6 matches', () => {
      const enemy = createCacklingHyena();
      const stats = createEmptyStats();
      stats.totalMatches = 5;
      stats.gracesUsed = 0;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false if grace was used', () => {
      const enemy = createCacklingHyena();
      const stats = createEmptyStats();
      stats.totalMatches = 6;
      stats.gracesUsed = 1;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with 6+ matches and no graces used', () => {
      const enemy = createCacklingHyena();
      const stats = createEmptyStats();
      stats.totalMatches = 6;
      stats.gracesUsed = 0;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
