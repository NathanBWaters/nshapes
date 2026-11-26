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
  // Time gain trigger tracking
  timeGainTriggersThisRound: 0,
  timeGainTriggerCapBonus: 0,
  consecutiveInvalidMatches: 0,
  prismaticPerfectionTriggered: false,
  tabulaRasaTriggered: false,
});

describe('One-Eyed Terror', () => {
  describe('Gaze Drain ([GP-16] keeps manual hints open)', () => {
    it('keeps manual hints enabled and marks a watched card every 16s', () => {
      const enemy = createOneEyedTerror();
      const uiMods = enemy.getUIModifiers();
      expect(uiMods.disableManualHint).toBeFalsy();

      const board = Array(12)
        .fill(null)
        .map((_, i) => ({
          id: `card-${i}`,
          shape: 'oval' as const,
          color: 'red' as const,
          number: 1 as const,
          shading: 'solid' as const,
          selected: false,
        }));
      enemy.onRoundStart(board);
      const gazeTick = enemy.onTick(16000, board);
      const watched = gazeTick.cardModifications.find(m => m.changes.hasCountdown);
      expect(watched).toBeDefined();
    });
  });

  describe('hint counter effect', () => {
    it('reduces hint gain gently by 25% without deleting Insight builds', () => {
      const enemy = createOneEyedTerror();
      const statMods = enemy.getStatModifiers();
      expect(statMods.hintGainChanceReduction).toBe(25);
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
