import { createGoblinSaboteur } from '@/utils/enemies/tier2/goblinSaboteur';
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

describe('Goblin Saboteur', () => {
  describe('metadata', () => {
    it('has correct name and tier', () => {
      const enemy = createGoblinSaboteur();
      expect(enemy.name).toBe('Goblin Saboteur');
      expect(enemy.tier).toBe(2);
    });

    it('has correct icon', () => {
      const enemy = createGoblinSaboteur();
      expect(enemy.icon).toBe('caro-asercion/goblin');
    });
  });

  describe('weapon counters', () => {
    it('counters 3 weapon types at 50%', () => {
      const enemy = createGoblinSaboteur();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.weaponCounters?.length).toBe(3);
      uiMods.weaponCounters?.forEach((counter) => {
        expect(counter.reduction).toBe(50);
      });
    });
  });

  describe('defeat condition', () => {
    it('returns false with 2 weapon effects', () => {
      const enemy = createGoblinSaboteur();
      const stats = createEmptyStats();
      stats.weaponEffectsTriggered = new Set(['fire', 'explosion']);
      expect(enemy.checkDefeatCondition(stats)).toBe(false);
    });

    it('returns true with 3+ weapon effects', () => {
      const enemy = createGoblinSaboteur();
      const stats = createEmptyStats();
      stats.weaponEffectsTriggered = new Set(['fire', 'explosion', 'laser']);
      expect(enemy.checkDefeatCondition(stats)).toBe(true);
    });
  });
});
