import { createCreepingShadow } from '@/utils/enemies/tier2/creepingShadow';
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

describe('Creeping Shadow', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createCreepingShadow();
      expect(enemy.name).toBe('Creeping Shadow');
      expect(enemy.tier).toBe(2);
    });

    it('has correct icon', () => {
      const enemy = createCreepingShadow();
      expect(enemy.icon).toBe('lorc/beast-eye');
    });
  });

  describe('hint disable effect', () => {
    it('disables auto hints', () => {
      const enemy = createCreepingShadow();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.disableAutoHint).toBe(true);
    });

    it('disables manual hints', () => {
      const enemy = createCreepingShadow();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.disableManualHint).toBe(true);
    });
  });

  describe('hint weapon counter', () => {
    it('reduces hint gain by 35%', () => {
      const enemy = createCreepingShadow();
      const statMods = enemy.getStatModifiers();
      expect(statMods.hintGainChanceReduction).toBe(35);
    });

    it('shows weapon counter in UI', () => {
      const enemy = createCreepingShadow();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.weaponCounters).toContainEqual({ type: 'hint', reduction: 35 });
    });
  });

  describe('defeat condition', () => {
    it('returns false with only 2 colors matched', () => {
      const enemy = createCreepingShadow();
      const stats = createEmptyStats();
      stats.colorsMatched = new Set(['red', 'green']);
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with all 3 colors matched', () => {
      const enemy = createCreepingShadow();
      const stats = createEmptyStats();
      stats.colorsMatched = new Set(['red', 'green', 'purple']);
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
