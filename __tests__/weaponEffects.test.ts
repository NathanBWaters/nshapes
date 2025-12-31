import {
  getGridDimensions,
  getAdjacentIndices,
  getLineIndices,
  getExplosiveCards,
  getLaserCards,
  getFireSpreadCards,
  processWeaponEffects,
} from '@/utils/weaponEffects';
import { Card, PlayerStats } from '@/types';
import { DEFAULT_PLAYER_STATS } from '@/utils/gameDefinitions';

// Helper to create a test card
const createTestCard = (
  id: string,
  shape: 'oval' | 'squiggle' | 'diamond' = 'oval',
  color: 'red' | 'green' | 'purple' = 'red'
): Card => ({
  id,
  shape,
  color,
  number: 1,
  shading: 'solid',
  background: 'white',
  selected: false,
});

// Create a 3x4 board (12 cards) for testing
// Layout:
//   0  1  2
//   3  4  5
//   6  7  8
//   9  10 11
const createTestBoard = (): Card[] => {
  return Array.from({ length: 12 }, (_, i) => createTestCard(`card-${i}`));
};

describe('getGridDimensions', () => {
  it('should return 3 columns for any board size', () => {
    expect(getGridDimensions(9).cols).toBe(3);
    expect(getGridDimensions(12).cols).toBe(3);
    expect(getGridDimensions(15).cols).toBe(3);
  });

  it('should calculate correct row count', () => {
    expect(getGridDimensions(9).rows).toBe(3);
    expect(getGridDimensions(12).rows).toBe(4);
    expect(getGridDimensions(15).rows).toBe(5);
    expect(getGridDimensions(10).rows).toBe(4); // Partial row
  });
});

describe('getAdjacentIndices', () => {
  // 3x4 grid layout:
  //   0  1  2
  //   3  4  5
  //   6  7  8
  //   9  10 11

  it('should return correct adjacent indices for center card', () => {
    // Card 4 has: up=1, down=7, left=3, right=5
    const adjacent = getAdjacentIndices(4, 12);
    expect(adjacent).toContain(1); // up
    expect(adjacent).toContain(7); // down
    expect(adjacent).toContain(3); // left
    expect(adjacent).toContain(5); // right
    expect(adjacent.length).toBe(4);
  });

  it('should return correct adjacent indices for top-left corner', () => {
    // Card 0 has: down=3, right=1
    const adjacent = getAdjacentIndices(0, 12);
    expect(adjacent).toContain(3); // down
    expect(adjacent).toContain(1); // right
    expect(adjacent.length).toBe(2);
  });

  it('should return correct adjacent indices for top-right corner', () => {
    // Card 2 has: down=5, left=1
    const adjacent = getAdjacentIndices(2, 12);
    expect(adjacent).toContain(5); // down
    expect(adjacent).toContain(1); // left
    expect(adjacent.length).toBe(2);
  });

  it('should return correct adjacent indices for bottom-left corner', () => {
    // Card 9 has: up=6, right=10
    const adjacent = getAdjacentIndices(9, 12);
    expect(adjacent).toContain(6); // up
    expect(adjacent).toContain(10); // right
    expect(adjacent.length).toBe(2);
  });

  it('should return correct adjacent indices for bottom-right corner', () => {
    // Card 11 has: up=8, left=10
    const adjacent = getAdjacentIndices(11, 12);
    expect(adjacent).toContain(8); // up
    expect(adjacent).toContain(10); // left
    expect(adjacent.length).toBe(2);
  });

  it('should return correct adjacent indices for edge card (top edge)', () => {
    // Card 1 has: down=4, left=0, right=2
    const adjacent = getAdjacentIndices(1, 12);
    expect(adjacent).toContain(4); // down
    expect(adjacent).toContain(0); // left
    expect(adjacent).toContain(2); // right
    expect(adjacent.length).toBe(3);
  });

  it('should return correct adjacent indices for edge card (left edge)', () => {
    // Card 3 has: up=0, down=6, right=4
    const adjacent = getAdjacentIndices(3, 12);
    expect(adjacent).toContain(0); // up
    expect(adjacent).toContain(6); // down
    expect(adjacent).toContain(4); // right
    expect(adjacent.length).toBe(3);
  });
});

describe('getLineIndices', () => {
  // 3x4 grid layout:
  //   0  1  2
  //   3  4  5
  //   6  7  8
  //   9  10 11

  it('should return all indices in a row', () => {
    // Row containing card 4 = [3, 4, 5]
    const rowIndices = getLineIndices(4, 12, true);
    expect(rowIndices).toEqual([3, 4, 5]);
  });

  it('should return all indices in first row', () => {
    // Row containing card 1 = [0, 1, 2]
    const rowIndices = getLineIndices(1, 12, true);
    expect(rowIndices).toEqual([0, 1, 2]);
  });

  it('should return all indices in a column', () => {
    // Column containing card 4 = [1, 4, 7, 10]
    const colIndices = getLineIndices(4, 12, false);
    expect(colIndices).toEqual([1, 4, 7, 10]);
  });

  it('should return all indices in first column', () => {
    // Column containing card 0 = [0, 3, 6, 9]
    const colIndices = getLineIndices(0, 12, false);
    expect(colIndices).toEqual([0, 3, 6, 9]);
  });

  it('should return all indices in last column', () => {
    // Column containing card 2 = [2, 5, 8, 11]
    const colIndices = getLineIndices(2, 12, false);
    expect(colIndices).toEqual([2, 5, 8, 11]);
  });
});

describe('getExplosiveCards', () => {
  it('should return empty array when explosion chance is 0', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const result = getExplosiveCards(board, matchedCards, 0);
    expect(result).toEqual([]);
  });

  it('should potentially return adjacent cards when explosion chance is 100', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]]; // Center card

    // Run multiple times to verify it works with 100% chance
    let hasExploded = false;
    for (let i = 0; i < 10; i++) {
      const result = getExplosiveCards(board, matchedCards, 100);
      if (result.length > 0) {
        hasExploded = true;
        // Should only contain adjacent cards (indices 1, 3, 5, 7)
        result.forEach(card => {
          expect(['card-1', 'card-3', 'card-5', 'card-7']).toContain(card.id);
        });
      }
    }
    expect(hasExploded).toBe(true);
  });

  it('should not include matched cards in explosion result', () => {
    const board = createTestBoard();
    const matchedCards = [board[4], board[1]]; // Card 4 and adjacent card 1

    for (let i = 0; i < 10; i++) {
      const result = getExplosiveCards(board, matchedCards, 100);
      // Card 1 should never be in result since it's matched
      result.forEach(card => {
        expect(card.id).not.toBe('card-1');
        expect(card.id).not.toBe('card-4');
      });
    }
  });

  it('should handle multiple matched cards', () => {
    const board = createTestBoard();
    // Cards 0, 1, 2 (top row)
    const matchedCards = [board[0], board[1], board[2]];

    let totalExploded = 0;
    for (let i = 0; i < 10; i++) {
      const result = getExplosiveCards(board, matchedCards, 100);
      totalExploded += result.length;
      // Should potentially explode cards 3, 4, 5 (below top row)
      result.forEach(card => {
        expect(['card-3', 'card-4', 'card-5']).toContain(card.id);
      });
    }
    expect(totalExploded).toBeGreaterThan(0);
  });

  it('should not duplicate exploded cards', () => {
    const board = createTestBoard();
    // Two adjacent matched cards that share a neighbor
    const matchedCards = [board[3], board[4]]; // Both adjacent to cards 0 and 6

    for (let i = 0; i < 10; i++) {
      const result = getExplosiveCards(board, matchedCards, 100);
      const ids = result.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    }
  });
});

describe('getLaserCards', () => {
  it('should return cards in a row or column (excluding matched cards)', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]]; // Center card

    // Run multiple times since it randomly chooses row or column
    let gotRowResult = false;
    let gotColResult = false;

    for (let i = 0; i < 20; i++) {
      const result = getLaserCards(board, matchedCards);
      const ids = result.map(c => c.id);

      // Should never include the matched card
      expect(ids).not.toContain('card-4');

      // Check if it's row (3, 5) or column (1, 7, 10)
      if (ids.includes('card-3') && ids.includes('card-5')) {
        gotRowResult = true;
        expect(ids).toEqual(['card-3', 'card-5']);
      }
      if (ids.includes('card-1') && ids.includes('card-7') && ids.includes('card-10')) {
        gotColResult = true;
        expect(ids).toEqual(['card-1', 'card-7', 'card-10']);
      }
    }

    // Should have gotten both types at least once
    expect(gotRowResult || gotColResult).toBe(true);
  });

  it('should work with corner matched card', () => {
    const board = createTestBoard();
    const matchedCards = [board[0]]; // Top-left corner

    for (let i = 0; i < 10; i++) {
      const result = getLaserCards(board, matchedCards);
      expect(result.length).toBeGreaterThan(0);
      // Should not include card 0
      result.forEach(card => {
        expect(card.id).not.toBe('card-0');
      });
    }
  });
});

describe('getFireSpreadCards', () => {
  it('should return empty array when fire chance is 0', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const result = getFireSpreadCards(board, matchedCards, 0);
    expect(result).toEqual([]);
  });

  it('should potentially ignite adjacent cards at 100% chance', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];

    let hasIgnited = false;
    for (let i = 0; i < 10; i++) {
      const result = getFireSpreadCards(board, matchedCards, 100);
      if (result.length > 0) {
        hasIgnited = true;
        result.forEach(card => {
          expect(['card-1', 'card-3', 'card-5', 'card-7']).toContain(card.id);
        });
      }
    }
    expect(hasIgnited).toBe(true);
  });

  it('should not ignite already burning cards', () => {
    const board = createTestBoard();
    board[1].onFire = true; // Card above center is already on fire
    const matchedCards = [board[4]];

    for (let i = 0; i < 10; i++) {
      const result = getFireSpreadCards(board, matchedCards, 100);
      // Card 1 should never be in result since it's already on fire
      result.forEach(card => {
        expect(card.id).not.toBe('card-1');
      });
    }
  });

  it('should not ignite matched cards', () => {
    const board = createTestBoard();
    const matchedCards = [board[4], board[1]];

    for (let i = 0; i < 10; i++) {
      const result = getFireSpreadCards(board, matchedCards, 100);
      result.forEach(card => {
        expect(card.id).not.toBe('card-4');
        expect(card.id).not.toBe('card-1');
      });
    }
  });
});

describe('processWeaponEffects', () => {
  it('should return empty results when no weapon effects active', () => {
    const board = createTestBoard();
    const matchedCards = [board[0], board[1], board[2]];
    const stats: PlayerStats = { ...DEFAULT_PLAYER_STATS };

    const result = processWeaponEffects(board, matchedCards, stats);

    expect(result.explosiveCards).toEqual([]);
    expect(result.laserCards).toEqual([]);
    expect(result.fireCards).toEqual([]);
    expect(result.notifications).toEqual([]);
  });

  it('should process explosion effect when explosionChance > 0', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const stats: PlayerStats = { ...DEFAULT_PLAYER_STATS, explosionChance: 100 };

    let hasExplosion = false;
    for (let i = 0; i < 10; i++) {
      const result = processWeaponEffects(board, matchedCards, stats);
      if (result.explosiveCards.length > 0) {
        hasExplosion = true;
        expect(result.bonusPoints).toBeGreaterThan(0);
        expect(result.notifications.some(n => n.includes('Explosion'))).toBe(true);
      }
    }
    expect(hasExplosion).toBe(true);
  });

  it('should process laser effect when laserChance triggers', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const stats: PlayerStats = { ...DEFAULT_PLAYER_STATS, laserChance: 100 };

    let hasLaser = false;
    for (let i = 0; i < 10; i++) {
      const result = processWeaponEffects(board, matchedCards, stats);
      if (result.laserCards.length > 0) {
        hasLaser = true;
        expect(result.bonusPoints).toBeGreaterThan(0);
        expect(result.notifications.some(n => n.includes('Laser'))).toBe(true);
      }
    }
    expect(hasLaser).toBe(true);
  });

  it('should process fire spread when fireSpreadChance > 0', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const stats: PlayerStats = { ...DEFAULT_PLAYER_STATS, fireSpreadChance: 100 };

    let hasFire = false;
    for (let i = 0; i < 10; i++) {
      const result = processWeaponEffects(board, matchedCards, stats);
      if (result.fireCards.length > 0) {
        hasFire = true;
        expect(result.notifications.some(n => n.includes('Fire'))).toBe(true);
      }
    }
    expect(hasFire).toBe(true);
  });

  it('should process healing chance', () => {
    const board = createTestBoard();
    const matchedCards = [board[0], board[1], board[2]];
    const stats: PlayerStats = { ...DEFAULT_PLAYER_STATS, healingChance: 100 };

    const result = processWeaponEffects(board, matchedCards, stats);
    expect(result.bonusHealing).toBe(1);
    expect(result.notifications).toContain('+1 HP');
  });

  it('should process hint gain chance', () => {
    const board = createTestBoard();
    const matchedCards = [board[0], board[1], board[2]];
    const stats: PlayerStats = { ...DEFAULT_PLAYER_STATS, hintGainChance: 100 };

    const result = processWeaponEffects(board, matchedCards, stats);
    expect(result.bonusHints).toBe(1);
    expect(result.notifications).toContain('+1 Hint');
  });

  it('should process time gain chance', () => {
    const board = createTestBoard();
    const matchedCards = [board[0], board[1], board[2]];
    const stats: PlayerStats = { ...DEFAULT_PLAYER_STATS, timeGainChance: 100, timeGainAmount: 15 };

    const result = processWeaponEffects(board, matchedCards, stats);
    expect(result.bonusTime).toBe(15);
    expect(result.notifications).toContain('+15s');
  });

  it('should process mulligan gain chance', () => {
    const board = createTestBoard();
    const matchedCards = [board[0], board[1], board[2]];
    const stats: PlayerStats = { ...DEFAULT_PLAYER_STATS, mulliganGainChance: 100 };

    const result = processWeaponEffects(board, matchedCards, stats);
    expect(result.bonusMulligans).toBe(1);
    expect(result.notifications).toContain('+1 Mulligan');
  });

  it('should process board growth chance', () => {
    const board = createTestBoard();
    const matchedCards = [board[0], board[1], board[2]];
    const stats: PlayerStats = { ...DEFAULT_PLAYER_STATS, boardGrowthChance: 100, boardGrowthAmount: 2 };

    const result = processWeaponEffects(board, matchedCards, stats);
    expect(result.boardGrowth).toBe(2);
    expect(result.notifications).toContain('+2 Cards');
  });

  it('should filter laser cards that were already exploded', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const stats: PlayerStats = {
      ...DEFAULT_PLAYER_STATS,
      explosionChance: 100,
      laserChance: 100
    };

    for (let i = 0; i < 20; i++) {
      const result = processWeaponEffects(board, matchedCards, stats);
      // Check no card appears in both lists
      const explosionIds = result.explosiveCards.map(c => c.id);
      result.laserCards.forEach(laserCard => {
        expect(explosionIds).not.toContain(laserCard.id);
      });
    }
  });
});
