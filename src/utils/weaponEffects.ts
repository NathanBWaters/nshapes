import { Card, PlayerStats, Weapon, AttributeName } from '../types';
import { isValidCombination } from './gameUtils';

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
 * Find a valid set on the board, excluding certain cards
 * Returns the first valid set found, or null if none exists
 */
export const findValidSet = (
  board: Card[],
  excludedCards: Card[],
  activeAttributes: AttributeName[]
): Card[] | null => {
  const excludedIds = new Set(excludedCards.map(c => c.id));
  const availableCards = board.filter(c => !excludedIds.has(c.id));

  // Try all combinations of 3 cards
  for (let i = 0; i < availableCards.length; i++) {
    for (let j = i + 1; j < availableCards.length; j++) {
      for (let k = j + 1; k < availableCards.length; k++) {
        const cards = [availableCards[i], availableCards[j], availableCards[k]];
        if (isValidCombination(cards, activeAttributes).isValid) {
          return cards;
        }
      }
    }
  }

  return null;
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
  autoMatchedSets: Card[][]; // Sets auto-matched by Echo Stone
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
 * @param activeAttributes - Active attributes for valid set detection (for echo)
 * @param isEchoMatch - If true, this is an auto-matched set (don't trigger more echoes)
 */
export const processWeaponEffects = (
  board: Card[],
  matchedCards: Card[],
  playerStats: PlayerStats,
  weapons?: Weapon[],
  activeAttributes?: AttributeName[],
  isEchoMatch: boolean = false
): WeaponEffectResult => {
  const result: WeaponEffectResult = {
    explosiveCards: [],
    laserCards: [],
    laserCount: 0,
    fireCards: [],
    ricochetCards: [],
    ricochetCount: 0,
    autoMatchedSets: [],
    bonusPoints: 0,
    bonusMoney: 0,
    bonusTime: 0,
    bonusGraces: 0,
    bonusHealing: 0,
    bonusHints: 0,
    boardGrowth: 0,
    notifications: [],
  };

  // Echo effect - MUST be processed FIRST to reserve the echo set before explosions
  // Only triggers on player matches (not on echoed matches) to prevent infinite loops
  if (!isEchoMatch && playerStats.echoChance > 0 && activeAttributes && Math.random() * 100 < playerStats.echoChance) {
    // Find a valid set among remaining cards (only excluding matched cards at this point)
    const echoSet = findValidSet(board, matchedCards, activeAttributes);
    if (echoSet) {
      result.autoMatchedSets.push(echoSet);
      result.notifications.push('Echo!');

      // Check for Chain Reaction - chance for a second auto-match
      if (playerStats.chainReactionChance > 0 && Math.random() * 100 < playerStats.chainReactionChance) {
        // Exclude the first echo set too
        const excludedForSecond = [...matchedCards, ...echoSet];
        const secondEchoSet = findValidSet(board, excludedForSecond, activeAttributes);
        if (secondEchoSet) {
          result.autoMatchedSets.push(secondEchoSet);
          // Update notification to show chain reaction
          result.notifications[result.notifications.length - 1] = 'Chain Reaction!';
        }
      }
    }
  }

  // Collect all echo cards to exclude from explosions/lasers/ricochet
  const echoCardIds = new Set(result.autoMatchedSets.flat().map(c => c.id));

  // Explosive effect - destroy adjacent cards (excluding echo set cards)
  if (playerStats.explosionChance > 0) {
    const rawExplosiveCards = getExplosiveCards(board, matchedCards, playerStats.explosionChance);
    // Filter out cards that are part of echo sets
    result.explosiveCards = rawExplosiveCards.filter(c => !echoCardIds.has(c.id));
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
    const laserCardIdSet = new Set<string>();
    let lasersActivated = 0;

    laserWeapons.forEach(weapon => {
      const chance = weapon.effects.laserChance || 0;
      if (Math.random() * 100 < chance) {
        // This laser fires! Get cards for this laser
        const thisLaserCards = getLaserCards(board, matchedCards);
        thisLaserCards.forEach(card => {
          // Only add if not already exploded, already lasered, or part of echo set
          if (!result.explosiveCards.some(ec => ec.id === card.id) &&
              !laserCardIdSet.has(card.id) &&
              !echoCardIds.has(card.id)) {
            laserCardIdSet.add(card.id);
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
      lc => !result.explosiveCards.some(ec => ec.id === lc.id) && !echoCardIds.has(lc.id)
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
    // Also exclude echo set cards
    const excludedCards = [
      ...result.explosiveCards,
      ...result.laserCards,
      ...result.autoMatchedSets.flat(),
    ];
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
