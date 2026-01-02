import { Card, PlayerStats, Weapon } from '../types';

// Grid dimensions (assumes 3 columns)
const GRID_COLS = 3;

/**
 * Get grid dimensions based on board size
 */
export const getGridDimensions = (boardSize: number): { cols: number; rows: number } => {
  const cols = GRID_COLS;
  const rows = Math.ceil(boardSize / cols);
  return { cols, rows };
};

/**
 * Get adjacent card indices (up, down, left, right) for a given card index
 */
export const getAdjacentIndices = (index: number, boardSize: number): number[] => {
  const { cols } = getGridDimensions(boardSize);
  const adjacent: number[] = [];
  const row = Math.floor(index / cols);
  const col = index % cols;

  // Up
  if (row > 0) adjacent.push(index - cols);
  // Down
  if (index + cols < boardSize) adjacent.push(index + cols);
  // Left
  if (col > 0) adjacent.push(index - 1);
  // Right
  if (col < cols - 1 && index + 1 < boardSize) adjacent.push(index + 1);

  return adjacent;
};

/**
 * Get all card indices in the same row or column
 */
export const getLineIndices = (index: number, boardSize: number, isRow: boolean): number[] => {
  const { cols } = getGridDimensions(boardSize);
  const indices: number[] = [];
  const row = Math.floor(index / cols);
  const col = index % cols;

  if (isRow) {
    // Get all cards in the same row
    for (let c = 0; c < cols; c++) {
      const idx = row * cols + c;
      if (idx < boardSize) indices.push(idx);
    }
  } else {
    // Get all cards in the same column
    for (let r = 0; r < Math.ceil(boardSize / cols); r++) {
      const idx = r * cols + col;
      if (idx < boardSize) indices.push(idx);
    }
  }

  return indices;
};

/**
 * Get cards to explode (adjacent to matched cards)
 * Rolls explosion chance for each adjacent card
 */
export const getExplosiveCards = (
  board: Card[],
  matchedCards: Card[],
  explosionChance: number
): Card[] => {
  const cardsToExplode: Card[] = [];
  const explodedIndices = new Set<number>();

  // For each matched card, check adjacent cards
  matchedCards.forEach(matchedCard => {
    const matchedIndex = board.findIndex(c => c.id === matchedCard.id);
    if (matchedIndex === -1) return;

    const adjacentIndices = getAdjacentIndices(matchedIndex, board.length);

    adjacentIndices.forEach(adjIndex => {
      // Roll explosion chance for each adjacent card
      if (!explodedIndices.has(adjIndex) && Math.random() * 100 < explosionChance) {
        explodedIndices.add(adjIndex);
        const adjCard = board[adjIndex];
        if (adjCard && !matchedCards.some(mc => mc.id === adjCard.id)) {
          cardsToExplode.push(adjCard);
        }
      }
    });
  });

  return cardsToExplode;
};

/**
 * Get cards to destroy with laser (entire row or column)
 */
export const getLaserCards = (board: Card[], matchedCards: Card[]): Card[] => {
  const cardsToDestroy: Card[] = [];

  // Pick a random matched card as the laser origin
  const originCard = matchedCards[Math.floor(Math.random() * matchedCards.length)];
  const originIndex = board.findIndex(c => c.id === originCard.id);
  if (originIndex === -1) return cardsToDestroy;

  // Randomly choose row or column
  const isRow = Math.random() < 0.5;
  const lineIndices = getLineIndices(originIndex, board.length, isRow);

  lineIndices.forEach(idx => {
    const card = board[idx];
    if (card && !matchedCards.some(mc => mc.id === card.id)) {
      cardsToDestroy.push(card);
    }
  });

  return cardsToDestroy;
};

/**
 * Get cards to destroy with ricochet (random chain destruction)
 *
 * @param board - Current game board
 * @param matchedCards - Cards already matched (exclude from targeting)
 * @param excludedCards - Cards already destroyed by other effects (explosions, lasers)
 * @param ricochetChance - Initial % chance to start ricochet
 * @param chainChance - % chance for each ricochet to chain to another card
 * @returns Array of cards destroyed by ricochet chain
 */
export const getRicochetCards = (
  board: Card[],
  matchedCards: Card[],
  excludedCards: Card[],
  ricochetChance: number,
  chainChance: number
): Card[] => {
  const ricochetedCards: Card[] = [];
  const destroyedIds = new Set<string>();

  // Track all cards we can't target
  matchedCards.forEach(c => destroyedIds.add(c.id));
  excludedCards.forEach(c => destroyedIds.add(c.id));

  // Roll initial ricochet chance
  if (Math.random() * 100 >= ricochetChance) {
    return ricochetedCards; // No ricochet triggered
  }

  // Start the chain!
  let chaining = true;
  while (chaining) {
    // Get available targets (not matched, not exploded, not already ricocheted)
    const availableTargets = board.filter(card => !destroyedIds.has(card.id));

    if (availableTargets.length === 0) {
      break; // No more cards to hit
    }

    // Pick a random target
    const randomIndex = Math.floor(Math.random() * availableTargets.length);
    const targetCard = availableTargets[randomIndex];

    // Destroy this card
    ricochetedCards.push(targetCard);
    destroyedIds.add(targetCard.id);

    // Roll for chain continuation
    if (Math.random() * 100 >= chainChance) {
      chaining = false; // Chain ends
    }
  }

  return ricochetedCards;
};

/**
 * Get cards to set on fire (adjacent to matched cards)
 */
export const getFireSpreadCards = (
  board: Card[],
  matchedCards: Card[],
  fireChance: number
): Card[] => {
  const cardsToIgnite: Card[] = [];
  const igniteIndices = new Set<number>();

  matchedCards.forEach(matchedCard => {
    const matchedIndex = board.findIndex(c => c.id === matchedCard.id);
    if (matchedIndex === -1) return;

    const adjacentIndices = getAdjacentIndices(matchedIndex, board.length);

    adjacentIndices.forEach(adjIndex => {
      // Roll fire chance for each adjacent card
      if (!igniteIndices.has(adjIndex) && Math.random() * 100 < fireChance) {
        const adjCard = board[adjIndex];
        // Don't ignite already burning cards or matched cards
        if (adjCard && !adjCard.onFire && !matchedCards.some(mc => mc.id === adjCard.id)) {
          igniteIndices.add(adjIndex);
          cardsToIgnite.push(adjCard);
        }
      }
    });
  });

  return cardsToIgnite;
};

/**
 * Result of processing weapon effects after a match
 */
export interface WeaponEffectResult {
  explosiveCards: Card[];
  laserCards: Card[];
  laserCount: number; // How many lasers fired (for visual effects)
  fireCards: Card[];
  ricochetCards: Card[];
  ricochetCount: number;
  bonusPoints: number;
  bonusMoney: number;
  bonusTime: number;
  bonusGraces: number;
  bonusHealing: number;
  bonusHints: number;
  boardGrowth: number;
  notifications: string[];
}

/**
 * Process all weapon effects after a valid match
 *
 * @param board - Current game board
 * @param matchedCards - Cards that were matched
 * @param playerStats - Combined player stats
 * @param weapons - Optional array of player's weapons (for independent laser rolls)
 */
export const processWeaponEffects = (
  board: Card[],
  matchedCards: Card[],
  playerStats: PlayerStats,
  weapons?: Weapon[]
): WeaponEffectResult => {
  const result: WeaponEffectResult = {
    explosiveCards: [],
    laserCards: [],
    laserCount: 0,
    fireCards: [],
    ricochetCards: [],
    ricochetCount: 0,
    bonusPoints: 0,
    bonusMoney: 0,
    bonusTime: 0,
    bonusGraces: 0,
    bonusHealing: 0,
    bonusHints: 0,
    boardGrowth: 0,
    notifications: [],
  };

  // Explosive effect - destroy adjacent cards
  if (playerStats.explosionChance > 0) {
    result.explosiveCards = getExplosiveCards(board, matchedCards, playerStats.explosionChance);
    if (result.explosiveCards.length > 0) {
      result.bonusPoints += result.explosiveCards.length;
      result.bonusMoney += result.explosiveCards.length;
      result.notifications.push(`Explosion! +${result.explosiveCards.length}`);
    }
  }

  // Laser effect - each laser weapon rolls independently
  // If no weapons array provided, fall back to single roll with combined chance
  if (weapons && weapons.length > 0) {
    // Get all laser weapons and roll each independently
    const laserWeapons = weapons.filter(w => w.specialEffect === 'laser' && w.effects.laserChance);
    const laserCardIds = new Set<string>();
    let lasersActivated = 0;

    laserWeapons.forEach(weapon => {
      const chance = weapon.effects.laserChance || 0;
      if (Math.random() * 100 < chance) {
        // This laser fires! Get cards for this laser
        const thisLaserCards = getLaserCards(board, matchedCards);
        thisLaserCards.forEach(card => {
          // Only add if not already exploded or already lasered
          if (!result.explosiveCards.some(ec => ec.id === card.id) && !laserCardIds.has(card.id)) {
            laserCardIds.add(card.id);
            result.laserCards.push(card);
          }
        });
        lasersActivated++;
      }
    });

    result.laserCount = lasersActivated;
    if (lasersActivated > 0 && result.laserCards.length > 0) {
      result.bonusPoints += result.laserCards.length * 2;
      result.bonusMoney += result.laserCards.length;
      const laserText = lasersActivated > 1 ? `${lasersActivated}x Laser!` : 'Laser!';
      result.notifications.push(`${laserText} +${result.laserCards.length * 2}`);
    }
  } else if (playerStats.laserChance > 0 && Math.random() * 100 < playerStats.laserChance) {
    // Fallback: single roll with combined chance (for backward compatibility)
    result.laserCards = getLaserCards(board, matchedCards);
    result.laserCards = result.laserCards.filter(
      lc => !result.explosiveCards.some(ec => ec.id === lc.id)
    );
    result.laserCount = 1;
    if (result.laserCards.length > 0) {
      result.bonusPoints += result.laserCards.length * 2;
      result.bonusMoney += result.laserCards.length;
      result.notifications.push(`Laser! +${result.laserCards.length * 2}`);
    }
  }

  // Ricochet effect - random chain destruction
  if (playerStats.ricochetChance > 0) {
    // Calculate ricochet after explosions and lasers to avoid double-destruction
    const excludedCards = [...result.explosiveCards, ...result.laserCards];
    result.ricochetCards = getRicochetCards(
      board,
      matchedCards,
      excludedCards,
      playerStats.ricochetChance,
      playerStats.ricochetChainChance
    );

    result.ricochetCount = result.ricochetCards.length;

    if (result.ricochetCards.length > 0) {
      // Award +1 point per ricocheted card (similar to explosions)
      result.bonusPoints += result.ricochetCards.length;
      result.bonusMoney += result.ricochetCards.length;

      const chainText = result.ricochetCards.length > 1
        ? `Ricochet x${result.ricochetCards.length}!`
        : 'Ricochet!';
      result.notifications.push(chainText);
    }
  }

  // Fire spread effect - set adjacent cards on fire
  if (playerStats.fireSpreadChance > 0) {
    result.fireCards = getFireSpreadCards(board, matchedCards, playerStats.fireSpreadChance);
    if (result.fireCards.length > 0) {
      result.notifications.push(`Fire! ${result.fireCards.length} cards`);
    }
  }

  // Healing chance
  if (playerStats.healingChance > 0 && Math.random() * 100 < playerStats.healingChance) {
    result.bonusHealing = 1;
    result.notifications.push('+1 HP');
  }

  // Hint gain chance
  if (playerStats.hintGainChance > 0 && Math.random() * 100 < playerStats.hintGainChance) {
    result.bonusHints = 1;
    result.notifications.push('+1 Hint');
  }

  // Time gain chance
  if (playerStats.timeGainChance > 0 && Math.random() * 100 < playerStats.timeGainChance) {
    result.bonusTime = playerStats.timeGainAmount || 10;
    result.notifications.push(`+${result.bonusTime}s`);
  }

  // Grace gain chance
  if (playerStats.graceGainChance > 0 && Math.random() * 100 < playerStats.graceGainChance) {
    result.bonusGraces = 1;
    result.notifications.push('+1 Grace');
  }

  // Board growth chance
  if (playerStats.boardGrowthChance > 0 && Math.random() * 100 < playerStats.boardGrowthChance) {
    result.boardGrowth = playerStats.boardGrowthAmount || 1;
    result.notifications.push(`+${result.boardGrowth} Cards`);
  }

  return result;
};
