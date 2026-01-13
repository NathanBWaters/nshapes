import { createOneEyedTerror } from '@/utils/enemies/tier3/oneEyedTerror';
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

describe('One-Eyed Terror', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createOneEyedTerror();
      expect(enemy.name).toBe('One-Eyed Terror');
      expect(enemy.tier).toBe(3);
    });

    it('has correct icon', () => {
      const enemy = createOneEyedTerror();
      expect(enemy.icon).toBe('lorc/cyclops');
    });
  });

  describe('hint disable effect', () => {
    it('disables all hints', () => {
      const enemy = createOneEyedTerror();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.disableAutoHint).toBe(true);
      expect(uiMods.disableManualHint).toBe(true);
    });
  });

  describe('hint counter effect', () => {
    it('reduces hint gain by 55%', () => {
      const enemy = createOneEyedTerror();
      const statMods = enemy.getStatModifiers();
      expect(statMods.hintGainChanceReduction).toBe(55);
    });
  });

  describe('defeat condition', () => {
    it('returns false with 2 all-different matches', () => {
      const enemy = createOneEyedTerror();
      const stats = createEmptyStats();
      stats.allDifferentMatches = 2;
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with 3+ all-different matches', () => {
      const enemy = createOneEyedTerror();
      const stats = createEmptyStats();
      stats.allDifferentMatches = 3;
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
