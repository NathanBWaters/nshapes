/**
 * Fusion Gem Drop Tests
 *
 * Tests for the fusion gem drop mechanic:
 * - Drop chance calculation based on round number
 * - Roughly 1 gem per 2-3 rounds
 */

import {
  calculateFusionGemDropChance,
  shouldDropFusionGem,
  FUSION_GEM_BASE_CHANCE,
  FUSION_GEM_ROUND_SCALING,
} from '@/utils/fusionUtils';

describe('Fusion Gem Drop System', () => {
  describe('Drop Chance Calculation', () => {
    it('should have a base chance', () => {
      expect(FUSION_GEM_BASE_CHANCE).toBeGreaterThan(0);
      expect(FUSION_GEM_BASE_CHANCE).toBeLessThanOrEqual(100);
    });

    it('should have round scaling', () => {
      expect(FUSION_GEM_ROUND_SCALING).toBeGreaterThan(0);
    });

    it('should return positive chance for round 1', () => {
      const chance = calculateFusionGemDropChance(1);
      expect(chance).toBeGreaterThan(0);
    });

    it('should increase chance with higher rounds', () => {
      const chanceRound1 = calculateFusionGemDropChance(1);
      const chanceRound5 = calculateFusionGemDropChance(5);
      const chanceRound10 = calculateFusionGemDropChance(10);

      expect(chanceRound5).toBeGreaterThan(chanceRound1);
      expect(chanceRound10).toBeGreaterThan(chanceRound5);
    });

    it('should cap at 100%', () => {
      const chanceRound100 = calculateFusionGemDropChance(100);
      expect(chanceRound100).toBeLessThanOrEqual(100);
    });

    it('should result in roughly 1 drop per 2-3 rounds on average', () => {
      // For a 10-round game, we expect 3-5 gems on average
      // Testing the chance to ensure it's in the right ballpark
      const totalChance = Array.from({ length: 10 }, (_, i) =>
        calculateFusionGemDropChance(i + 1)
      ).reduce((sum, c) => sum + c, 0);

      // Expected total chance for 10 rounds should be ~300-500% (3-5 drops)
      expect(totalChance).toBeGreaterThan(200);
      expect(totalChance).toBeLessThan(700);
    });
  });

  describe('shouldDropFusionGem', () => {
    it('should return false if fusionGemPending is true', () => {
      const result = shouldDropFusionGem(5, true);
      expect(result).toBe(false);
    });

    it('should return boolean based on random roll when fusionGemPending is false', () => {
      // Run multiple times to verify it returns both true and false
      let hasTrue = false;
      let hasFalse = false;

      for (let i = 0; i < 100; i++) {
        const result = shouldDropFusionGem(5, false);
        if (result) hasTrue = true;
        else hasFalse = true;

        if (hasTrue && hasFalse) break;
      }

      // With ~50% chance at round 5, we should see both outcomes
      expect(hasTrue).toBe(true);
      expect(hasFalse).toBe(true);
    });

    it('should never drop if fusionGemPending even with 100% chance', () => {
      // Even at high rounds with high chance, should not drop if pending
      for (let i = 0; i < 50; i++) {
        const result = shouldDropFusionGem(100, true);
        expect(result).toBe(false);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle round 0 gracefully', () => {
      const chance = calculateFusionGemDropChance(0);
      expect(chance).toBeGreaterThanOrEqual(0);
    });

    it('should handle negative rounds gracefully', () => {
      const chance = calculateFusionGemDropChance(-1);
      expect(chance).toBeGreaterThanOrEqual(0);
    });
  });
});
