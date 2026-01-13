import { createHuntingEagle } from '@/utils/enemies/tier2/huntingEagle';
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

describe('Hunting Eagle', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createHuntingEagle();
      expect(enemy.name).toBe('Hunting Eagle');
      expect(enemy.tier).toBe(2);
    });

    it('has correct icon', () => {
      const enemy = createHuntingEagle();
      expect(enemy.icon).toBe('delapouite/eagle-head');
    });
  });

  describe('triple card effect', () => {
    it('places one triple card on round start', () => {
      const enemy = createHuntingEagle();
      const board = createTestBoard();

      const result = enemy.onRoundStart(board);
      const tripleCards = result.cardModifications.filter((m) => m.changes.health === 3);
      expect(tripleCards.length).toBe(1);
    });
  });

  describe('time weapon counter', () => {
    it('reduces time gain by 35%', () => {
      const enemy = createHuntingEagle();
      const statMods = enemy.getStatModifiers();
      expect(statMods.timeGainChanceReduction).toBe(35);
    });

    it('shows weapon counter in UI', () => {
      const enemy = createHuntingEagle();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.weaponCounters).toContainEqual({ type: 'time', reduction: 35 });
    });
  });

  describe('defeat condition', () => {
    it('returns false if triple card not cleared', () => {
      const enemy = createHuntingEagle();
      const stats = createEmptyStats();
      stats.tripleCardsCleared = 0;
      stats.timeRemaining = 25000;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false if cleared but not enough time', () => {
      const enemy = createHuntingEagle();
      const stats = createEmptyStats();
      stats.tripleCardsCleared = 1;
      stats.timeRemaining = 15000;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true if cleared with 20+ seconds', () => {
      const enemy = createHuntingEagle();
      const stats = createEmptyStats();
      stats.tripleCardsCleared = 1;
      stats.timeRemaining = 20000;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
