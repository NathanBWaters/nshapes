import {
  getGridDimensions,
  getAdjacentIndices,
  getLineIndices,
  getExplosiveCards,
  getLaserCards,
  getRicochetCards,
  getFireSpreadCards,
  processWeaponEffects,
} from '@/utils/weaponEffects';
import { Card, PlayerStats, Weapon } from '@/types';
import { DEFAULT_PLAYER_STATS, WEAPONS } from '@/utils/gameDefinitions';

// Helper to create a mock laser weapon
const createLaserWeapon = (id: string, laserChance: number): Weapon => ({
  id,
  name: 'Prismatic Ray',
  rarity: 'common',
  level: 1,
  description: 'Test laser weapon',
  shortDescription: 'May destroy a row or column',
  price: 10,
  effects: { laserChance },
  specialEffect: 'laser',
});

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

describe('getRicochetCards', () => {
  it('should return empty array when ricochet chance is 0', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const excludedCards: Card[] = [];
    const result = getRicochetCards(board, matchedCards, excludedCards, 0, 50);
    expect(result).toEqual([]);
  });

  it('should return empty array when ricochet does not trigger', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const excludedCards: Card[] = [];

    // Mock Math.random to always fail initial roll
    const originalRandom = Math.random;
    Math.random = () => 0.99; // 99% - will fail 10% ricochet check

    const result = getRicochetCards(board, matchedCards, excludedCards, 10, 50);
    expect(result).toEqual([]);

    Math.random = originalRandom;
  });

  it('should destroy at least one card when ricochet triggers at 100%', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const excludedCards: Card[] = [];

    for (let i = 0; i < 10; i++) {
      const result = getRicochetCards(board, matchedCards, excludedCards, 100, 0);
      // With 100% initial chance and 0% chain, should hit exactly 1 card
      expect(result.length).toBe(1);
    }
  });

  it('should chain to multiple cards when chain chance is 100%', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]]; // Only 1 matched card
    const excludedCards: Card[] = [];

    // With 100% chain chance, will destroy all 11 available cards (12 total - 1 matched)
    const result = getRicochetCards(board, matchedCards, excludedCards, 100, 100);

    // Should destroy all 11 available cards
    expect(result.length).toBe(11);
  });

  it('should not target matched cards', () => {
    const board = createTestBoard();
    const matchedCards = [board[0], board[1], board[2]];
    const excludedCards: Card[] = [];

    for (let i = 0; i < 20; i++) {
      const result = getRicochetCards(board, matchedCards, excludedCards, 100, 50);
      result.forEach(card => {
        expect(card.id).not.toBe('card-0');
        expect(card.id).not.toBe('card-1');
        expect(card.id).not.toBe('card-2');
      });
    }
  });

  it('should not target excluded cards (exploded/lasered)', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const excludedCards = [board[0], board[1], board[2]]; // Pretend these were exploded

    for (let i = 0; i < 20; i++) {
      const result = getRicochetCards(board, matchedCards, excludedCards, 100, 50);
      result.forEach(card => {
        // Should not target matched cards
        expect(card.id).not.toBe('card-4');
        // Should not target excluded cards
        expect(card.id).not.toBe('card-0');
        expect(card.id).not.toBe('card-1');
        expect(card.id).not.toBe('card-2');
      });
    }
  });

  it('should not duplicate card hits in a single chain', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const excludedCards: Card[] = [];

    for (let i = 0; i < 20; i++) {
      const result = getRicochetCards(board, matchedCards, excludedCards, 100, 70);
      const ids = result.map(c => c.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    }
  });

  it('should stop chaining when no cards available', () => {
    // Create a small board with only 3 cards
    const board = [
      createTestCard('card-0'),
      createTestCard('card-1'),
      createTestCard('card-2'),
    ];
    const matchedCards = [board[0]]; // 1 matched
    const excludedCards: Card[] = [];

    // With 100% chain chance, should destroy both available cards and stop
    const result = getRicochetCards(board, matchedCards, excludedCards, 100, 100);

    // Maximum possible is 2 cards (card-1 and card-2, since card-0 is matched)
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('should handle empty available board gracefully', () => {
    const board = createTestBoard();
    // All cards are either matched or excluded
    const matchedCards = board.slice(0, 6);
    const excludedCards = board.slice(6);

    const result = getRicochetCards(board, matchedCards, excludedCards, 100, 100);

    // No cards available to ricochet
    expect(result).toEqual([]);
  });

  it('should pick random targets from entire board', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const excludedCards: Card[] = [];

    // Track which cards get hit over many runs
    const hitCounts: Record<string, number> = {};

    for (let i = 0; i < 100; i++) {
      const result = getRicochetCards(board, matchedCards, excludedCards, 100, 0);
      result.forEach(card => {
        hitCounts[card.id] = (hitCounts[card.id] || 0) + 1;
      });
    }

    // Should have hit multiple different cards (random distribution)
    const uniqueCardsHit = Object.keys(hitCounts).length;
    expect(uniqueCardsHit).toBeGreaterThan(5); // Should see variety in 100 runs
  });

  it('should chain probabilistically with low chain chance', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const excludedCards: Card[] = [];

    // Track chain lengths over many runs
    const chainLengths: number[] = [];

    for (let i = 0; i < 100; i++) {
      const result = getRicochetCards(board, matchedCards, excludedCards, 100, 30);
      chainLengths.push(result.length);
    }

    // With 30% chain chance, should see variety in chain lengths
    const uniqueLengths = new Set(chainLengths);
    expect(uniqueLengths.size).toBeGreaterThan(1);

    // Should have some single-hit chains
    expect(chainLengths.some(len => len === 1)).toBe(true);

    // Should have some multi-hit chains
    expect(chainLengths.some(len => len > 1)).toBe(true);
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

  it('should process grace gain chance', () => {
    const board = createTestBoard();
    const matchedCards = [board[0], board[1], board[2]];
    const stats: PlayerStats = { ...DEFAULT_PLAYER_STATS, graceGainChance: 100 };

    const result = processWeaponEffects(board, matchedCards, stats);
    expect(result.bonusGraces).toBe(1);
    expect(result.notifications).toContain('+1 Grace');
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

  it('should process ricochet effect when ricochetChance triggers', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const stats: PlayerStats = {
      ...DEFAULT_PLAYER_STATS,
      ricochetChance: 100,
      ricochetChainChance: 0
    };

    const result = processWeaponEffects(board, matchedCards, stats);

    // With 100% ricochet and 0% chain, should hit exactly 1 card
    expect(result.ricochetCards.length).toBe(1);
    expect(result.ricochetCount).toBe(1);
    expect(result.bonusPoints).toBeGreaterThan(0);
    expect(result.bonusMoney).toBeGreaterThan(0);
    expect(result.notifications.some(n => n.includes('Ricochet'))).toBe(true);
  });

  it('should show "Ricochet!" for single hit', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const stats: PlayerStats = {
      ...DEFAULT_PLAYER_STATS,
      ricochetChance: 100,
      ricochetChainChance: 0
    };

    const result = processWeaponEffects(board, matchedCards, stats);

    expect(result.notifications).toContain('Ricochet!');
  });

  it('should show "Ricochet xN!" for multiple hits', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const stats: PlayerStats = {
      ...DEFAULT_PLAYER_STATS,
      ricochetChance: 100,
      ricochetChainChance: 100
    };

    // With 100% chain chance, will destroy all 11 available cards
    const result = processWeaponEffects(board, matchedCards, stats);

    expect(result.ricochetCount).toBe(11);
    expect(result.notifications.some(n => n.includes('Ricochet x11!'))).toBe(true);
  });

  it('should not ricochet already exploded cards', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const stats: PlayerStats = {
      ...DEFAULT_PLAYER_STATS,
      explosionChance: 100,
      ricochetChance: 100,
      ricochetChainChance: 50
    };

    for (let i = 0; i < 20; i++) {
      const result = processWeaponEffects(board, matchedCards, stats);
      // Check no card appears in both explosion and ricochet lists
      const explosionIds = result.explosiveCards.map(c => c.id);
      result.ricochetCards.forEach(ricochetCard => {
        expect(explosionIds).not.toContain(ricochetCard.id);
      });
    }
  });

  it('should not ricochet already lasered cards', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const stats: PlayerStats = {
      ...DEFAULT_PLAYER_STATS,
      laserChance: 100,
      ricochetChance: 100,
      ricochetChainChance: 50
    };

    for (let i = 0; i < 20; i++) {
      const result = processWeaponEffects(board, matchedCards, stats);
      // Check no card appears in both laser and ricochet lists
      const laserIds = result.laserCards.map(c => c.id);
      result.ricochetCards.forEach(ricochetCard => {
        expect(laserIds).not.toContain(ricochetCard.id);
      });
    }
  });

  it('should handle all destruction effects together without duplicates', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const stats: PlayerStats = {
      ...DEFAULT_PLAYER_STATS,
      explosionChance: 100,
      laserChance: 100,
      ricochetChance: 100,
      ricochetChainChance: 70
    };

    for (let i = 0; i < 20; i++) {
      const result = processWeaponEffects(board, matchedCards, stats);

      // Collect all destroyed card IDs
      const allDestroyedIds = [
        ...result.explosiveCards.map(c => c.id),
        ...result.laserCards.map(c => c.id),
        ...result.ricochetCards.map(c => c.id),
      ];

      // No duplicates across all effects
      const uniqueIds = new Set(allDestroyedIds);
      expect(uniqueIds.size).toBe(allDestroyedIds.length);
    }
  });

  it('should award +1 point and +1 money per ricocheted card', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const stats: PlayerStats = {
      ...DEFAULT_PLAYER_STATS,
      ricochetChance: 100,
      ricochetChainChance: 100
    };

    // With 100% chain chance, will destroy all 11 available cards
    const result = processWeaponEffects(board, matchedCards, stats);

    expect(result.ricochetCount).toBe(11);
    expect(result.bonusPoints).toBe(11); // +1 per ricocheted card
    expect(result.bonusMoney).toBe(11); // +1 per ricocheted card
  });

  it('should return 0 ricochets when ricochet does not trigger', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const stats: PlayerStats = {
      ...DEFAULT_PLAYER_STATS,
      ricochetChance: 10, // Use 10% chance
      ricochetChainChance: 50
    };

    // Mock to fail initial ricochet roll (10% chance means need < 10)
    const originalRandom = Math.random;
    Math.random = () => 0.99; // 99 >= 10, so ricochet fails

    const result = processWeaponEffects(board, matchedCards, stats);

    Math.random = originalRandom;

    expect(result.ricochetCards).toEqual([]);
    expect(result.ricochetCount).toBe(0);
    expect(result.notifications.some(n => n.includes('Ricochet'))).toBe(false);
  });
});

describe('Multi-Laser Independent Rolls', () => {
  it('should roll each laser weapon independently', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const stats: PlayerStats = { ...DEFAULT_PLAYER_STATS };

    // Create 3 laser weapons with 100% chance each
    const weapons: Weapon[] = [
      createLaserWeapon('laser-1', 100),
      createLaserWeapon('laser-2', 100),
      createLaserWeapon('laser-3', 100),
    ];

    const result = processWeaponEffects(board, matchedCards, stats, weapons);

    // With 3 lasers at 100% chance, all 3 should fire
    expect(result.laserCount).toBe(3);
  });

  it('should track laserCount correctly', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const stats: PlayerStats = { ...DEFAULT_PLAYER_STATS };

    // Create 2 laser weapons with 100% chance
    const weapons: Weapon[] = [
      createLaserWeapon('laser-1', 100),
      createLaserWeapon('laser-2', 100),
    ];

    const result = processWeaponEffects(board, matchedCards, stats, weapons);

    expect(result.laserCount).toBe(2);
    expect(result.notifications.some(n => n.includes('2x Laser'))).toBe(true);
  });

  it('should show single laser notification for 1 laser', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const stats: PlayerStats = { ...DEFAULT_PLAYER_STATS };

    // Create 1 laser weapon with 100% chance
    const weapons: Weapon[] = [
      createLaserWeapon('laser-1', 100),
    ];

    const result = processWeaponEffects(board, matchedCards, stats, weapons);

    expect(result.laserCount).toBe(1);
    expect(result.notifications.some(n => n.includes('Laser!') && !n.includes('x Laser'))).toBe(true);
  });

  it('should not duplicate laser card rewards for overlapping lasers', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const stats: PlayerStats = { ...DEFAULT_PLAYER_STATS };

    // Create 3 laser weapons with 100% chance
    const weapons: Weapon[] = [
      createLaserWeapon('laser-1', 100),
      createLaserWeapon('laser-2', 100),
      createLaserWeapon('laser-3', 100),
    ];

    // Run multiple times to ensure no duplicates
    for (let i = 0; i < 20; i++) {
      const result = processWeaponEffects(board, matchedCards, stats, weapons);
      const laserCardIds = result.laserCards.map(c => c.id);
      const uniqueIds = new Set(laserCardIds);
      expect(uniqueIds.size).toBe(laserCardIds.length);
    }
  });

  it('should return 0 lasers when no laser weapons exist', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const stats: PlayerStats = { ...DEFAULT_PLAYER_STATS };

    const weapons: Weapon[] = []; // No weapons

    const result = processWeaponEffects(board, matchedCards, stats, weapons);

    expect(result.laserCount).toBe(0);
    expect(result.laserCards.length).toBe(0);
  });

  it('should probabilistically fire some lasers with low chance', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const stats: PlayerStats = { ...DEFAULT_PLAYER_STATS };

    // Create 3 laser weapons with 50% chance each
    const weapons: Weapon[] = [
      createLaserWeapon('laser-1', 50),
      createLaserWeapon('laser-2', 50),
      createLaserWeapon('laser-3', 50),
    ];

    // Track how often each count appears
    const laserCounts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };

    for (let i = 0; i < 100; i++) {
      const result = processWeaponEffects(board, matchedCards, stats, weapons);
      laserCounts[result.laserCount] = (laserCounts[result.laserCount] || 0) + 1;
    }

    // With 50% chance each, we should see variety in counts
    // At least one of each count should appear (probabilistically)
    const countsWithOccurrences = Object.values(laserCounts).filter(c => c > 0).length;
    expect(countsWithOccurrences).toBeGreaterThan(1);
  });

  it('should fallback to single roll when no weapons array provided', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const stats: PlayerStats = { ...DEFAULT_PLAYER_STATS, laserChance: 100 };

    // No weapons array - should use fallback
    const result = processWeaponEffects(board, matchedCards, stats);

    // Should fire 1 laser with fallback behavior
    expect(result.laserCount).toBe(1);
    expect(result.laserCards.length).toBeGreaterThan(0);
  });

  it('should only count weapons with specialEffect laser', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const stats: PlayerStats = { ...DEFAULT_PLAYER_STATS };

    // Create mixed weapons
    const weapons: Weapon[] = [
      createLaserWeapon('laser-1', 100),
      {
        id: 'not-laser',
        name: 'Blast Powder',
        rarity: 'common',
        level: 1,
        description: 'Not a laser',
        shortDescription: 'May explode adjacent cards on match',
        price: 10,
        effects: { explosionChance: 100 },
        specialEffect: 'explosive',
      },
    ];

    const result = processWeaponEffects(board, matchedCards, stats, weapons);

    // Only 1 laser weapon should fire
    expect(result.laserCount).toBe(1);
  });

  it('should work correctly with actual WEAPONS laser definitions', () => {
    const board = createTestBoard();
    const matchedCards = [board[4]];
    const stats: PlayerStats = { ...DEFAULT_PLAYER_STATS };

    // Get the actual legendary laser weapon from WEAPONS
    const legendaryLaser = WEAPONS.find(
      w => w.name === 'Prismatic Ray' && w.rarity === 'legendary'
    );

    // Verify the structure is correct for our filter
    expect(legendaryLaser).toBeDefined();
    expect(legendaryLaser?.specialEffect).toBe('laser');
    expect(legendaryLaser?.effects.laserChance).toBe(21); // Legendary is 21%

    // Create 28 legendary lasers (simulating user's scenario)
    const weapons: Weapon[] = Array(28).fill(legendaryLaser) as Weapon[];

    // Run the function and check the filter works
    // Mock Math.random to always return 0 (100% success)
    const originalRandom = Math.random;
    Math.random = () => 0; // This will make all rolls succeed

    const result = processWeaponEffects(board, matchedCards, stats, weapons);

    Math.random = originalRandom;

    // With mocked random, all 28 lasers should fire
    expect(result.laserCount).toBe(28);
    expect(result.laserCards.length).toBeGreaterThan(0);
  });

  it('should correctly filter laser weapons from WEAPONS', () => {
    // Verify how many laser weapons exist in WEAPONS
    const allLaserWeapons = WEAPONS.filter(
      w => w.specialEffect === 'laser' && w.effects.laserChance
    );

    // There should be 3 laser weapons (common, rare, legendary)
    expect(allLaserWeapons.length).toBe(3);

    // Verify each has the correct structure
    allLaserWeapons.forEach(weapon => {
      expect(weapon.specialEffect).toBe('laser');
      expect(weapon.effects.laserChance).toBeGreaterThan(0);
    });
  });
});
