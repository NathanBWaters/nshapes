/**
 * Tests for time gain capping behavior.
 * Time gains from Time Drop weapons should be capped at the starting max
 * (round base time + startingTime bonus from Chrono Shards).
 */

import { ROUND_REQUIREMENTS, getEndlessRoundRequirement } from '@/utils/gameDefinitions';

// Helper function that mirrors the capping logic in Game.tsx
const calculateCappedTime = (
  currentTime: number,
  bonusTime: number,
  roundNumber: number,
  startingTimeBonus: number
): number => {
  const roundBaseTime = roundNumber > 10
    ? getEndlessRoundRequirement(roundNumber).time
    : (ROUND_REQUIREMENTS.find(r => r.round === roundNumber)?.time || 60);

  const startingMax = roundBaseTime + startingTimeBonus;
  const newTime = currentTime + bonusTime;

  return Math.min(newTime, startingMax);
};

describe('Time Gain Capping', () => {
  describe('Without Chrono Shard (no startingTime bonus)', () => {
    it('should cap time at round base time', () => {
      // Round 5 has 60s base time
      const result = calculateCappedTime(55, 10, 5, 0);
      expect(result).toBe(60); // Capped at 60, not 65
    });

    it('should allow time gain if below cap', () => {
      // Round 5 has 60s base time, currently at 40s
      const result = calculateCappedTime(40, 10, 5, 0);
      expect(result).toBe(50); // 40 + 10 = 50, still below cap
    });

    it('should not add time if already at cap', () => {
      // Round 5 has 60s base time, already at 60s
      const result = calculateCappedTime(60, 10, 5, 0);
      expect(result).toBe(60); // Stays at cap
    });

    it('should handle partial gain when near cap', () => {
      // Round 5 has 60s base time, at 57s, +10s would be 67
      const result = calculateCappedTime(57, 10, 5, 0);
      expect(result).toBe(60); // Capped at 60
    });
  });

  describe('With Chrono Shard (startingTime bonus)', () => {
    it('should increase cap by startingTime bonus', () => {
      // Round 5 (60s) + 45s Chrono Shard = 105s cap
      const result = calculateCappedTime(100, 10, 5, 45);
      expect(result).toBe(105); // Capped at 105, not 110
    });

    it('should allow more time gain with Chrono Shard', () => {
      // Round 5 (60s) + 45s Chrono Shard = 105s cap
      const result = calculateCappedTime(70, 10, 5, 45);
      expect(result).toBe(80); // 70 + 10 = 80, below 105 cap
    });

    it('should stack multiple Chrono Shards', () => {
      // Round 5 (60s) + 45s + 45s = 150s cap
      const result = calculateCappedTime(140, 15, 5, 90);
      expect(result).toBe(150); // Capped at 150
    });

    it('should work with legendary Chrono Shard', () => {
      // Round 5 (60s) + 105s legendary = 165s cap
      const result = calculateCappedTime(160, 15, 5, 105);
      expect(result).toBe(165); // Capped at 165
    });
  });

  describe('Different rounds', () => {
    it('should use round 1 base time (30s)', () => {
      const result = calculateCappedTime(25, 10, 1, 0);
      expect(result).toBe(30); // Capped at 30
    });

    it('should use round 3 base time (45s)', () => {
      const result = calculateCappedTime(40, 10, 3, 0);
      expect(result).toBe(45); // Capped at 45
    });

    it('should use round 10 base time (60s)', () => {
      const result = calculateCappedTime(55, 10, 10, 0);
      expect(result).toBe(60); // Capped at 60
    });

    it('should work in endless mode (round 11+)', () => {
      // Endless rounds have 60s base time
      const result = calculateCappedTime(55, 10, 15, 0);
      expect(result).toBe(60); // Capped at 60
    });
  });

  describe('Edge cases', () => {
    it('should handle zero bonus time', () => {
      const result = calculateCappedTime(50, 0, 5, 0);
      expect(result).toBe(50); // No change
    });

    it('should handle time already over cap (edge case)', () => {
      // If timer is somehow already over cap, it should clamp down
      // This shouldn't happen normally but tests the Math.min behavior
      const result = calculateCappedTime(70, 0, 5, 0);
      expect(result).toBe(60); // Clamped to cap
    });

    it('should handle large bonuses', () => {
      // Multiple legendary Time Drops could theoretically add 15s each
      const result = calculateCappedTime(30, 45, 5, 0);
      expect(result).toBe(60); // Capped at 60, not 75
    });
  });
});
