import { createRavenousTapir } from '@/utils/enemies/tier3/ravenousTapir';
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

describe('Ravenous Tapir', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createRavenousTapir();
      expect(enemy.name).toBe('Ravenous Tapir');
      expect(enemy.tier).toBe(3);
    });

    it('has correct icon', () => {
      const enemy = createRavenousTapir();
      expect(enemy.icon).toBe('delapouite/tapir');
    });

    it('has correct description', () => {
      const enemy = createRavenousTapir();
      expect(enemy.description).toBe('+1 card removed per match, removes 1 card every 15s');
    });

    it('has correct defeat condition text', () => {
      const enemy = createRavenousTapir();
      expect(enemy.defeatConditionText).toBe('Beat target with 5+ cards remaining');
    });
  });

  describe('extra card removal on match', () => {
    it('removes 1 extra card on match (with board > minSize)', () => {
      const enemy = createRavenousTapir();
      const board = createTestBoard(); // 12 cards

      const result = enemy.onValidMatch([board[0], board[1], board[2]], board);
      expect(result.cardsToRemove.length).toBe(1);
    });

    it('does not remove cards if board would go below minSize', () => {
      const enemy = createRavenousTapir();
      // Create small board (5 cards - at minSize)
      const board = createTestBoard().slice(0, 5);

      const result = enemy.onValidMatch([board[0], board[1], board[2]], board);
      expect(result.cardsToRemove.length).toBe(0);
    });
  });

  describe('timed card removal', () => {
    it('removes 1 card after 15 seconds', () => {
      const enemy = createRavenousTapir();
      const board = createTestBoard(); // 12 cards

      const result = enemy.onTick(15000, board);
      expect(result.cardsToRemove.length).toBe(1);
    });

    it('does not remove cards if board at minSize', () => {
      const enemy = createRavenousTapir();
      // Create small board (5 cards - at minSize)
      const board = createTestBoard().slice(0, 5);

      const result = enemy.onTick(15000, board);
      expect(result.cardsToRemove.length).toBe(0);
    });
  });

  describe('defeat condition', () => {
    it('returns false if target not reached', () => {
      const enemy = createRavenousTapir();
      const stats = createEmptyStats();
      stats.currentScore = 80;
      stats.targetScore = 100;
      stats.cardsRemaining = 5;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false with fewer than 5 cards', () => {
      const enemy = createRavenousTapir();
      const stats = createEmptyStats();
      stats.currentScore = 100;
      stats.targetScore = 100;
      stats.cardsRemaining = 4;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with target reached and 5+ cards', () => {
      const enemy = createRavenousTapir();
      const stats = createEmptyStats();
      stats.currentScore = 100;
      stats.targetScore = 100;
      stats.cardsRemaining = 5;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true with target exceeded and many cards', () => {
      const enemy = createRavenousTapir();
      const stats = createEmptyStats();
      stats.currentScore = 150;
      stats.targetScore = 100;
      stats.cardsRemaining = 10;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
