/**
 * Tests for multi-level-up logic
 *
 * These tests verify that when a player gains multiple levels in one round,
 * they receive multiple level-up screens with the correct level numbers.
 */

describe('Multi-Level-Up Logic', () => {
  /**
   * Helper function to calculate the level-up queue.
   * This mirrors the logic in Game.tsx RoundSummary onContinue callback.
   */
  const calculateLevelQueue = (startLevel: number, endLevel: number): number[] => {
    const levelsGained = endLevel - startLevel;
    return Array.from(
      { length: levelsGained },
      (_, i) => startLevel + i + 1
    );
  };

  describe('Level queue calculation', () => {
    it('creates queue for single level gain', () => {
      // Player goes from level 5 to level 6
      const queue = calculateLevelQueue(5, 6);
      expect(queue).toEqual([6]);
    });

    it('creates queue for two level gains', () => {
      // Player goes from level 5 to level 7
      const queue = calculateLevelQueue(5, 7);
      expect(queue).toEqual([6, 7]);
    });

    it('creates queue for three level gains', () => {
      // Player goes from level 2 to level 5
      const queue = calculateLevelQueue(2, 5);
      expect(queue).toEqual([3, 4, 5]);
    });

    it('returns empty queue when no level gain', () => {
      // Player stays at level 5
      const queue = calculateLevelQueue(5, 5);
      expect(queue).toEqual([]);
    });

    it('handles level gain from level 0', () => {
      // Player goes from level 0 to level 2
      const queue = calculateLevelQueue(0, 2);
      expect(queue).toEqual([1, 2]);
    });

    it('handles large level gains', () => {
      // Player goes from level 1 to level 6 (5 level gains)
      const queue = calculateLevelQueue(1, 6);
      expect(queue).toEqual([2, 3, 4, 5, 6]);
    });
  });

  describe('Level-up queue consumption', () => {
    it('first screen shows first level in queue', () => {
      const queue = [6, 7, 8];
      const targetLevel = queue[0];
      const hasMoreLevelUps = queue.length > 1;

      expect(targetLevel).toBe(6);
      expect(hasMoreLevelUps).toBe(true);
    });

    it('after consuming first level, second becomes target', () => {
      const queue = [6, 7, 8];
      const remaining = queue.slice(1);
      const targetLevel = remaining[0];
      const hasMoreLevelUps = remaining.length > 1;

      expect(targetLevel).toBe(7);
      expect(hasMoreLevelUps).toBe(true);
    });

    it('on final level-up, hasMoreLevelUps is false', () => {
      const queue = [8];
      const targetLevel = queue[0];
      const hasMoreLevelUps = queue.length > 1;

      expect(targetLevel).toBe(8);
      expect(hasMoreLevelUps).toBe(false);
    });

    it('correctly tracks through full multi-level sequence', () => {
      // Simulate a player gaining 3 levels (5 → 8)
      let queue = calculateLevelQueue(5, 8);
      expect(queue).toEqual([6, 7, 8]);

      // First level-up screen
      expect(queue[0]).toBe(6);
      expect(queue.length > 1).toBe(true);

      // Consume first level
      queue = queue.slice(1);
      expect(queue[0]).toBe(7);
      expect(queue.length > 1).toBe(true);

      // Consume second level
      queue = queue.slice(1);
      expect(queue[0]).toBe(8);
      expect(queue.length > 1).toBe(false);

      // Consume final level
      queue = queue.slice(1);
      expect(queue.length).toBe(0);
    });
  });

  describe('Button text logic', () => {
    const getButtonText = (hasMoreLevelUps: boolean): string => {
      return hasMoreLevelUps ? 'Next Level Up' : 'Select Weapon';
    };

    it('shows "Next Level Up" when more levels pending', () => {
      expect(getButtonText(true)).toBe('Next Level Up');
    });

    it('shows "Select Weapon" on final level-up', () => {
      expect(getButtonText(false)).toBe('Select Weapon');
    });
  });
});
