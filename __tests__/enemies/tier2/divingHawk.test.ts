import { createDivingHawk } from '@/utils/enemies/tier2/divingHawk';
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

describe('Diving Hawk', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createDivingHawk();
      expect(enemy.name).toBe('Diving Hawk');
      expect(enemy.tier).toBe(2);
    });

    it('has correct icon', () => {
      const enemy = createDivingHawk();
      expect(enemy.icon).toBe('lorc/hawk-emblem');
    });

    it('has correct description', () => {
      const enemy = createDivingHawk();
      expect(enemy.description).toBe('Timer 35% faster');
    });

    it('has correct defeat condition text', () => {
      const enemy = createDivingHawk();
      expect(enemy.defeatConditionText).toBe('Get 3 all-different matches');
    });
  });

  describe('timer speed effect', () => {
    it('has 35% faster timer', () => {
      const enemy = createDivingHawk();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.timerSpeedMultiplier).toBe(1.35);
    });
  });

  describe('defeat condition', () => {
    it('returns false with only 1 all-different match', () => {
      const enemy = createDivingHawk();
      const stats = createEmptyStats();
      stats.allDifferentMatches = 1;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false with 2 all-different matches', () => {
      const enemy = createDivingHawk();
      const stats = createEmptyStats();
      stats.allDifferentMatches = 2;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with 3 all-different matches', () => {
      const enemy = createDivingHawk();
      const stats = createEmptyStats();
      stats.allDifferentMatches = 3;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true with more than 3 all-different matches', () => {
      const enemy = createDivingHawk();
      const stats = createEmptyStats();
      stats.allDifferentMatches = 5;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
