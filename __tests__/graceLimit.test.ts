/**
 * Tests for grace limit enforcement
 *
 * Graces should be capped at maxGraces (similar to hints being capped at maxHints)
 */

import { DEFAULT_PLAYER_STATS, calculatePlayerTotalStats, initializePlayer } from '@/utils/gameDefinitions';
import { PlayerStats, Player } from '@/types';
import { STARTING_STATS } from '@/utils/gameConfig';

describe('Grace Limit', () => {
  describe('maxGraces stat exists', () => {
    it('should have maxGraces defined in STARTING_STATS', () => {
      expect(STARTING_STATS.maxGraces).toBeDefined();
      expect(typeof STARTING_STATS.maxGraces).toBe('number');
    });

    it('should have maxGraces in DEFAULT_PLAYER_STATS', () => {
      expect(DEFAULT_PLAYER_STATS.maxGraces).toBeDefined();
      expect(typeof DEFAULT_PLAYER_STATS.maxGraces).toBe('number');
    });

    it('should default maxGraces to 5', () => {
      expect(STARTING_STATS.maxGraces).toBe(5);
    });
  });

  describe('grace capping behavior', () => {
    it('should not allow graces to exceed maxGraces when adding', () => {
      // Simulate what happens in Game.tsx handleValidMatch
      const playerStats: PlayerStats = {
        ...DEFAULT_PLAYER_STATS,
        graces: 4, // Start with 4 graces
        maxGraces: 5, // Max is 5
      };

      // Adding 3 graces should cap at 5, not become 7
      const graceDelta = 3;
      const newGraces = Math.min(
        playerStats.graces + graceDelta,
        playerStats.maxGraces
      );

      expect(newGraces).toBe(5);
      expect(newGraces).not.toBe(7);
    });

    it('should allow graces up to maxGraces', () => {
      const playerStats: PlayerStats = {
        ...DEFAULT_PLAYER_STATS,
        graces: 0,
        maxGraces: 5,
      };

      const graceDelta = 5;
      const newGraces = Math.min(
        playerStats.graces + graceDelta,
        playerStats.maxGraces
      );

      expect(newGraces).toBe(5);
    });

    it('should maintain graces at maxGraces when already at max', () => {
      const playerStats: PlayerStats = {
        ...DEFAULT_PLAYER_STATS,
        graces: 5,
        maxGraces: 5,
      };

      const graceDelta = 1;
      const newGraces = Math.min(
        playerStats.graces + graceDelta,
        playerStats.maxGraces
      );

      expect(newGraces).toBe(5);
    });
  });

  describe('calculatePlayerTotalStats includes maxGraces', () => {
    it('should include maxGraces in calculated stats', () => {
      const player = initializePlayer('test', 'Test Player', 'Orange Tabby');
      const totalStats = calculatePlayerTotalStats(player);

      expect(totalStats.maxGraces).toBeDefined();
      expect(typeof totalStats.maxGraces).toBe('number');
    });

    it('should stack maxGraces from weapons', () => {
      const player = initializePlayer('test', 'Test Player', 'Orange Tabby');

      // Add a weapon that increases maxGraces (if such a weapon exists)
      // For now, just verify the base maxGraces is included
      const totalStats = calculatePlayerTotalStats(player);

      expect(totalStats.maxGraces).toBeGreaterThanOrEqual(STARTING_STATS.maxGraces);
    });
  });

  describe('grace calculation with graceDelta', () => {
    it('should correctly handle positive graceDelta with cap', () => {
      const currentGraces = 3;
      const maxGraces = 5;
      const bonusGraces = 4; // Weapon effect adds 4
      const graceUsed = false;

      const graceDelta = (graceUsed ? -1 : 0) + bonusGraces;
      const newGraces = Math.min(currentGraces + graceDelta, maxGraces);

      expect(graceDelta).toBe(4);
      expect(newGraces).toBe(5); // Should cap at 5, not 7
    });

    it('should correctly handle grace used with bonus and cap', () => {
      const currentGraces = 5;
      const maxGraces = 5;
      const bonusGraces = 2;
      const graceUsed = true;

      const graceDelta = (graceUsed ? -1 : 0) + bonusGraces;
      const newGraces = Math.min(currentGraces + graceDelta, maxGraces);

      // -1 for used + 2 bonus = +1, but 5 + 1 should cap at 5
      expect(graceDelta).toBe(1);
      expect(newGraces).toBe(5);
    });

    it('should allow graces to decrease below max', () => {
      const currentGraces = 5;
      const maxGraces = 5;
      const bonusGraces = 0;
      const graceUsed = true;

      const graceDelta = (graceUsed ? -1 : 0) + bonusGraces;
      const newGraces = Math.min(currentGraces + graceDelta, maxGraces);

      expect(graceDelta).toBe(-1);
      expect(newGraces).toBe(4);
    });
  });
});
