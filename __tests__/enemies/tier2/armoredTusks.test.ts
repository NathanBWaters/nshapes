import { createArmoredTusks } from '@/utils/enemies/tier2/armoredTusks';
import type { RoundStats } from '@/types/enemy';

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

describe('Armored Tusks', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createArmoredTusks();
      expect(enemy.name).toBe('Armored Tusks');
      expect(enemy.tier).toBe(2);
    });

    it('has correct icon', () => {
      const enemy = createArmoredTusks();
      expect(enemy.icon).toBe('lorc/boar-tusks');
    });
  });

  describe('weapon counters', () => {
    it('reduces fire by 35%', () => {
      const enemy = createArmoredTusks();
      const statMods = enemy.getStatModifiers();
      expect(statMods.fireSpreadChanceReduction).toBe(35);
    });

    it('reduces explosion by 35%', () => {
      const enemy = createArmoredTusks();
      const statMods = enemy.getStatModifiers();
      expect(statMods.explosionChanceReduction).toBe(35);
    });

    it('shows both weapon counters in UI', () => {
      const enemy = createArmoredTusks();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.weaponCounters).toContainEqual({ type: 'fire', reduction: 35 });
      expect(uiMods.weaponCounters).toContainEqual({ type: 'explosion', reduction: 35 });
    });
  });

  describe('defeat condition', () => {
    it('returns false with only 1 destruction effect', () => {
      const enemy = createArmoredTusks();
      const stats = createEmptyStats();
      stats.weaponEffectsTriggered = new Set(['fire']);
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with 2 destruction effects', () => {
      const enemy = createArmoredTusks();
      const stats = createEmptyStats();
      stats.weaponEffectsTriggered = new Set(['fire', 'explosion']);
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true with fire and laser', () => {
      const enemy = createArmoredTusks();
      const stats = createEmptyStats();
      stats.weaponEffectsTriggered = new Set(['fire', 'laser']);
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('ignores non-destruction effects', () => {
      const enemy = createArmoredTusks();
      const stats = createEmptyStats();
      stats.weaponEffectsTriggered = new Set(['fire', 'hint', 'grace']);
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });
  });
});
