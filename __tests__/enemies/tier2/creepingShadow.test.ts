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
    it('returns false when one color has fewer than 3 matches', () => {
      const enemy = createCreepingShadow();
      const stats = createEmptyStats();
      // Red has 3, green has 3, but purple only has 2
      stats.colorMatchCounts.set('red', 3);
      stats.colorMatchCounts.set('green', 3);
      stats.colorMatchCounts.set('purple', 2);
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns false when a color is missing', () => {
      const enemy = createCreepingShadow();
      const stats = createEmptyStats();
      // Only 2 colors present
      stats.colorMatchCounts.set('red', 5);
      stats.colorMatchCounts.set('green', 5);
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true when all 3 colors have 3+ matches', () => {
      const enemy = createCreepingShadow();
      const stats = createEmptyStats();
      stats.colorMatchCounts.set('red', 3);
      stats.colorMatchCounts.set('green', 3);
      stats.colorMatchCounts.set('purple', 3);
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });

    it('returns true when colors have more than 3 matches', () => {
      const enemy = createCreepingShadow();
      const stats = createEmptyStats();
      stats.colorMatchCounts.set('red', 5);
      stats.colorMatchCounts.set('green', 4);
      stats.colorMatchCounts.set('purple', 6);
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
