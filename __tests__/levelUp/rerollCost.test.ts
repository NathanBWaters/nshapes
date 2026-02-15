/**
 * Reroll Cost Tests for Level Up System
 *
 * Tests that reroll mechanics work correctly:
 * - Initial cost is 5
 * - Cost doubles after each reroll
 * - Cost resets at start of new round
 * - Reroll disabled when player can't afford
 */

import {
  getInitialRerollCost,
  calculateNextRerollCost,
  canAffordReroll,
  performReroll,
  resetRerollCost,
  RerollState,
} from '@/utils/levelUpUtils';

describe('Reroll Cost Mechanics', () => {
  describe('Initial reroll cost', () => {
    it('should be 5', () => {
      expect(getInitialRerollCost()).toBe(5);
    });
  });

  describe('Reroll cost progression', () => {
    it('should double after first reroll (5 → 10)', () => {
      const nextCost = calculateNextRerollCost(5);
      expect(nextCost).toBe(10);
    });

    it('should double after second reroll (10 → 20)', () => {
      const nextCost = calculateNextRerollCost(10);
      expect(nextCost).toBe(20);
    });

    it('should double after third reroll (20 → 40)', () => {
      const nextCost = calculateNextRerollCost(20);
      expect(nextCost).toBe(40);
    });

    it('should follow full progression: 5 → 10 → 20 → 40 → 80', () => {
      let cost = getInitialRerollCost();
      expect(cost).toBe(5);

      cost = calculateNextRerollCost(cost);
      expect(cost).toBe(10);

      cost = calculateNextRerollCost(cost);
      expect(cost).toBe(20);

      cost = calculateNextRerollCost(cost);
      expect(cost).toBe(40);

      cost = calculateNextRerollCost(cost);
      expect(cost).toBe(80);
    });
  });

  describe('Reset reroll cost', () => {
    it('should reset to initial cost (5) at start of new round', () => {
      const currentCost = 40; // After several rerolls
      const resetCost = resetRerollCost();
      expect(resetCost).toBe(5);
    });
  });

  describe('Affordability check', () => {
    it('should return true when player has enough money', () => {
      expect(canAffordReroll(100, 5)).toBe(true);
      expect(canAffordReroll(10, 5)).toBe(true);
      expect(canAffordReroll(5, 5)).toBe(true);
    });

    it('should return false when player cannot afford', () => {
      expect(canAffordReroll(4, 5)).toBe(false);
      expect(canAffordReroll(0, 5)).toBe(false);
      expect(canAffordReroll(19, 20)).toBe(false);
    });

    it('should handle edge case of exact amount', () => {
      expect(canAffordReroll(5, 5)).toBe(true);
      expect(canAffordReroll(20, 20)).toBe(true);
    });
  });

  describe('Perform reroll', () => {
    it('should deduct correct amount from player money', () => {
      const result = performReroll(100, 5);
      expect(result.newMoney).toBe(95);
    });

    it('should update reroll cost to next value', () => {
      const result = performReroll(100, 5);
      expect(result.newRerollCost).toBe(10);
    });

    it('should handle multiple rerolls correctly', () => {
      let money = 100;
      let cost = 5;

      // First reroll: 100 - 5 = 95, next cost = 10
      let result = performReroll(money, cost);
      expect(result.newMoney).toBe(95);
      expect(result.newRerollCost).toBe(10);

      // Second reroll: 95 - 10 = 85, next cost = 20
      money = result.newMoney;
      cost = result.newRerollCost;
      result = performReroll(money, cost);
      expect(result.newMoney).toBe(85);
      expect(result.newRerollCost).toBe(20);

      // Third reroll: 85 - 20 = 65, next cost = 40
      money = result.newMoney;
      cost = result.newRerollCost;
      result = performReroll(money, cost);
      expect(result.newMoney).toBe(65);
      expect(result.newRerollCost).toBe(40);
    });

    it('should throw or return error when cannot afford', () => {
      expect(() => performReroll(4, 5)).toThrow();
    });
  });

  describe('RerollState management', () => {
    it('should track reroll count', () => {
      const state: RerollState = {
        cost: getInitialRerollCost(),
        count: 0,
      };

      expect(state.cost).toBe(5);
      expect(state.count).toBe(0);
    });

    it('should correctly track state through rerolls', () => {
      let state: RerollState = {
        cost: getInitialRerollCost(),
        count: 0,
      };

      // First reroll
      state = {
        cost: calculateNextRerollCost(state.cost),
        count: state.count + 1,
      };
      expect(state.cost).toBe(10);
      expect(state.count).toBe(1);

      // Second reroll
      state = {
        cost: calculateNextRerollCost(state.cost),
        count: state.count + 1,
      };
      expect(state.cost).toBe(20);
      expect(state.count).toBe(2);
    });
  });

  describe('Integration scenarios', () => {
    it('should allow multiple rerolls until player cannot afford', () => {
      let money = 25; // Can afford: 5, 10, but not 20
      let cost = getInitialRerollCost();
      let rerollCount = 0;

      // First reroll: 25 - 5 = 20
      expect(canAffordReroll(money, cost)).toBe(true);
      const result1 = performReroll(money, cost);
      money = result1.newMoney;
      cost = result1.newRerollCost;
      rerollCount++;
      expect(money).toBe(20);
      expect(cost).toBe(10);

      // Second reroll: 20 - 10 = 10
      expect(canAffordReroll(money, cost)).toBe(true);
      const result2 = performReroll(money, cost);
      money = result2.newMoney;
      cost = result2.newRerollCost;
      rerollCount++;
      expect(money).toBe(10);
      expect(cost).toBe(20);

      // Third reroll: Can't afford (10 < 20)
      expect(canAffordReroll(money, cost)).toBe(false);
      expect(rerollCount).toBe(2);
    });

    it('should reset cost correctly between rounds', () => {
      // End of round 1: cost is 40 after several rerolls
      let cost = 40;

      // Start of round 2: reset to 5
      cost = resetRerollCost();
      expect(cost).toBe(5);

      // Can reroll again at initial cost
      expect(canAffordReroll(10, cost)).toBe(true);
    });
  });
});
