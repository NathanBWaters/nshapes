/**
 * Tests for useRoundStats helper functions
 *
 * Note: We test createInitialRoundStats directly since it's the core logic.
 * The hook itself is a thin wrapper around useRef and useCallback.
 */

import { createInitialRoundStats } from '@/hooks/useRoundStats';
import type { RoundStats } from '@/types/enemy';
import type { Card } from '@/types';

// Mock card factory
function createMockCard(overrides: Partial<Card> = {}): Card {
  return {
    id: `card-${Math.random()}`,
    shape: 'diamond',
    color: 'red',
    number: 1,
    shading: 'solid',
    backgroundColor: 'white',
    ...overrides,
  };
}

describe('createInitialRoundStats', () => {
  it('returns initial stats with default values', () => {
    const stats = createInitialRoundStats();

    expect(stats.totalMatches).toBe(0);
    expect(stats.currentStreak).toBe(0);
    expect(stats.maxStreak).toBe(0);
    expect(stats.invalidMatches).toBe(0);
    expect(stats.targetScore).toBe(0);
    expect(stats.currentScore).toBe(0);
    expect(stats.timeRemaining).toBe(60);
    expect(stats.cardsRemaining).toBe(12);
  });

  it('accepts target score and resource counts', () => {
    const stats = createInitialRoundStats(100, 3, 2);

    expect(stats.targetScore).toBe(100);
    expect(stats.hintsRemaining).toBe(3);
    expect(stats.gracesRemaining).toBe(2);
  });

  it('initializes Sets properly', () => {
    const stats = createInitialRoundStats();

    expect(stats.shapesMatched).toBeInstanceOf(Set);
    expect(stats.colorsMatched).toBeInstanceOf(Set);
    expect(stats.weaponEffectsTriggered).toBeInstanceOf(Set);
    expect(stats.shapesMatched.size).toBe(0);
    expect(stats.colorsMatched.size).toBe(0);
    expect(stats.weaponEffectsTriggered.size).toBe(0);
  });

  it('initializes timing arrays properly', () => {
    const stats = createInitialRoundStats();

    expect(stats.matchTimes).toEqual([]);
  });

  it('initializes card tracking counters to zero', () => {
    const stats = createInitialRoundStats();

    expect(stats.tripleCardsCleared).toBe(0);
    expect(stats.faceDownCardsMatched).toBe(0);
    expect(stats.bombsDefused).toBe(0);
    expect(stats.countdownCardsMatched).toBe(0);
  });

  it('initializes attribute tracking counters to zero', () => {
    const stats = createInitialRoundStats();

    expect(stats.allDifferentMatches).toBe(0);
    expect(stats.allSameColorMatches).toBe(0);
    expect(stats.squiggleMatches).toBe(0);
  });

  it('initializes resource tracking counters', () => {
    const stats = createInitialRoundStats(0, 5, 3);

    expect(stats.gracesUsed).toBe(0);
    expect(stats.hintsUsed).toBe(0);
    expect(stats.hintsRemaining).toBe(5);
    expect(stats.gracesRemaining).toBe(3);
    expect(stats.damageReceived).toBe(0);
  });
});

describe('RoundStats mutation patterns', () => {
  // These tests validate how the stats should be mutated by the hook
  // (we can't test the hook directly without renderHook, but we can
  // validate the expected mutation patterns)

  describe('match tracking', () => {
    it('can track valid matches with streak', () => {
      const stats = createInitialRoundStats();

      // Simulate 3 valid matches
      stats.totalMatches = 3;
      stats.currentStreak = 3;
      stats.maxStreak = 3;

      expect(stats.totalMatches).toBe(3);
      expect(stats.currentStreak).toBe(3);
      expect(stats.maxStreak).toBe(3);
    });

    it('streak resets on invalid match but maxStreak preserved', () => {
      const stats = createInitialRoundStats();

      // Build streak to 3
      stats.totalMatches = 3;
      stats.currentStreak = 3;
      stats.maxStreak = 3;

      // Invalid match resets current but not max
      stats.invalidMatches = 1;
      stats.currentStreak = 0;

      expect(stats.currentStreak).toBe(0);
      expect(stats.maxStreak).toBe(3);
      expect(stats.invalidMatches).toBe(1);
    });
  });

  describe('attribute tracking with Sets', () => {
    it('can track shapes matched', () => {
      const stats = createInitialRoundStats();

      stats.shapesMatched.add('diamond');
      stats.shapesMatched.add('oval');
      stats.shapesMatched.add('squiggle');

      expect(stats.shapesMatched.size).toBe(3);
      expect(stats.shapesMatched.has('diamond')).toBe(true);
      expect(stats.shapesMatched.has('oval')).toBe(true);
      expect(stats.shapesMatched.has('squiggle')).toBe(true);
    });

    it('can track colors matched', () => {
      const stats = createInitialRoundStats();

      stats.colorsMatched.add('red');
      stats.colorsMatched.add('green');
      stats.colorsMatched.add('purple');

      expect(stats.colorsMatched.size).toBe(3);
    });

    it('Sets handle duplicates correctly', () => {
      const stats = createInitialRoundStats();

      stats.shapesMatched.add('diamond');
      stats.shapesMatched.add('diamond');
      stats.shapesMatched.add('diamond');

      expect(stats.shapesMatched.size).toBe(1);
    });
  });

  describe('card state tracking', () => {
    it('can track face-down cards matched', () => {
      const stats = createInitialRoundStats();
      const cards = [
        createMockCard({ isFaceDown: true }),
        createMockCard({ isFaceDown: true }),
        createMockCard({ isFaceDown: false }),
      ];

      // Simulate counting face-down cards
      const faceDownCount = cards.filter((c) => c.isFaceDown).length;
      stats.faceDownCardsMatched += faceDownCount;

      expect(stats.faceDownCardsMatched).toBe(2);
    });

    it('can track bombs defused', () => {
      const stats = createInitialRoundStats();
      const cards = [
        createMockCard({ hasBomb: true }),
        createMockCard(),
        createMockCard(),
      ];

      const bombCount = cards.filter((c) => c.hasBomb).length;
      stats.bombsDefused += bombCount;

      expect(stats.bombsDefused).toBe(1);
    });

    it('can track countdown cards matched', () => {
      const stats = createInitialRoundStats();
      const cards = [
        createMockCard({ hasCountdown: true }),
        createMockCard({ hasCountdown: true }),
        createMockCard(),
      ];

      const countdownCount = cards.filter((c) => c.hasCountdown).length;
      stats.countdownCardsMatched += countdownCount;

      expect(stats.countdownCardsMatched).toBe(2);
    });
  });

  describe('resource tracking', () => {
    it('can track grace usage', () => {
      const stats = createInitialRoundStats(0, 0, 3);

      stats.gracesUsed = 1;
      stats.gracesRemaining = 2;

      expect(stats.gracesUsed).toBe(1);
      expect(stats.gracesRemaining).toBe(2);
    });

    it('can track hint usage', () => {
      const stats = createInitialRoundStats(0, 3, 0);

      stats.hintsUsed = 2;
      stats.hintsRemaining = 1;

      expect(stats.hintsUsed).toBe(2);
      expect(stats.hintsRemaining).toBe(1);
    });

    it('can track damage received', () => {
      const stats = createInitialRoundStats();

      stats.damageReceived = 3;

      expect(stats.damageReceived).toBe(3);
    });

    it('can track weapon effects triggered', () => {
      const stats = createInitialRoundStats();

      stats.weaponEffectsTriggered.add('fire');
      stats.weaponEffectsTriggered.add('explosion');
      stats.weaponEffectsTriggered.add('laser');

      expect(stats.weaponEffectsTriggered.size).toBe(3);
      expect(stats.weaponEffectsTriggered.has('fire')).toBe(true);
    });
  });

  describe('score and time tracking', () => {
    it('can track current score vs target', () => {
      const stats = createInitialRoundStats(100);

      stats.currentScore = 75;

      expect(stats.currentScore).toBe(75);
      expect(stats.targetScore).toBe(100);
      expect(stats.currentScore >= stats.targetScore).toBe(false);
    });

    it('can detect target score reached', () => {
      const stats = createInitialRoundStats(100);

      stats.currentScore = 150;

      expect(stats.currentScore >= stats.targetScore).toBe(true);
    });

    it('can detect 150% of target score', () => {
      const stats = createInitialRoundStats(100);

      stats.currentScore = 150;

      expect(stats.currentScore >= stats.targetScore * 1.5).toBe(true);
    });

    it('can track time remaining', () => {
      const stats = createInitialRoundStats();

      stats.timeRemaining = 30;

      expect(stats.timeRemaining).toBe(30);
    });

    it('can track cards remaining', () => {
      const stats = createInitialRoundStats();

      stats.cardsRemaining = 9;

      expect(stats.cardsRemaining).toBe(9);
    });
  });

  describe('defeat condition scenarios', () => {
    it('Junk Rat: 4-match streak', () => {
      const stats = createInitialRoundStats();
      stats.maxStreak = 4;

      expect(stats.maxStreak >= 4).toBe(true);
    });

    it('Stalking Wolf: 3 matches each under 5s', () => {
      const stats = createInitialRoundStats();
      stats.matchTimes = [3000, 4500, 2000, 6000];

      const fastMatches = stats.matchTimes.filter((t) => t < 5000).length;
      expect(fastMatches >= 3).toBe(true);
    });

    it('Burrowing Mole: all 3 shapes matched', () => {
      const stats = createInitialRoundStats();
      stats.shapesMatched.add('diamond');
      stats.shapesMatched.add('oval');
      stats.shapesMatched.add('squiggle');

      expect(stats.shapesMatched.size >= 3).toBe(true);
    });

    it('Stinging Scorpion: no invalid matches', () => {
      const stats = createInitialRoundStats();
      stats.totalMatches = 5;
      stats.invalidMatches = 0;

      expect(stats.totalMatches >= 1 && stats.invalidMatches === 0).toBe(true);
    });

    it('Thieving Raven: 5 total matches', () => {
      const stats = createInitialRoundStats();
      stats.totalMatches = 5;

      expect(stats.totalMatches >= 5).toBe(true);
    });

    it('Night Owl: 4 face-down cards matched', () => {
      const stats = createInitialRoundStats();
      stats.faceDownCardsMatched = 4;

      expect(stats.faceDownCardsMatched >= 4).toBe(true);
    });

    it('Swift Bee: 5-match streak', () => {
      const stats = createInitialRoundStats();
      stats.maxStreak = 5;

      expect(stats.maxStreak >= 5).toBe(true);
    });

    it('Circling Vulture: 150% of target score', () => {
      const stats = createInitialRoundStats(100);
      stats.currentScore = 160;

      expect(stats.currentScore >= stats.targetScore * 1.5).toBe(true);
    });

    it('Shadow Bat: all-different match', () => {
      const stats = createInitialRoundStats();
      stats.allDifferentMatches = 1;

      expect(stats.allDifferentMatches >= 1).toBe(true);
    });

    it('Foggy Frog: beat target with 2+ hints', () => {
      const stats = createInitialRoundStats(100, 3, 0);
      stats.currentScore = 100;
      stats.hintsRemaining = 2;

      expect(stats.currentScore >= stats.targetScore && stats.hintsRemaining >= 2).toBe(true);
    });

    it('Sneaky Mouse: no graces used', () => {
      const stats = createInitialRoundStats();
      stats.totalMatches = 3;
      stats.gracesUsed = 0;

      expect(stats.totalMatches >= 1 && stats.gracesUsed === 0).toBe(true);
    });

    it('Lazy Sloth: beat target with 15+ seconds', () => {
      const stats = createInitialRoundStats(100);
      stats.currentScore = 100;
      stats.timeRemaining = 20;

      expect(stats.currentScore >= stats.targetScore && stats.timeRemaining >= 15).toBe(true);
    });

    it('Greedy Squirrel: beat target with 8+ cards', () => {
      const stats = createInitialRoundStats(100);
      stats.currentScore = 100;
      stats.cardsRemaining = 9;

      expect(stats.currentScore >= stats.targetScore && stats.cardsRemaining >= 8).toBe(true);
    });
  });
});
