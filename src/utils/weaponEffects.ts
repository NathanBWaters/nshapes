import { Card, PlayerStats, Weapon, AttributeName, EffectCaps } from '../types';
import { isValidCombination } from './gameUtils';
import { getEffectiveStat } from './gameConfig';
import { EFFECT_CAP_TYPES, EffectCapType, getMainStatForCap } from '@/game/effectCaps';
import { DEFAULT_EFFECT_CAPS, rollBridgeEffects } from './gameDefinitions';
import { rollEntropyProc, shouldUseEntropy, type ProcAccumulatorState } from '@/adventure/engine/entropy';

// Grid dimensions (assumes 3 columns)
const GRID_COLS = 3;

const nextRandom = (rng?: () => number): number => (rng ? rng() : Math.random());

/**
 * Get the effective (capped) value for a stat, respecting the player's current caps.
 * Uses the player's effectCaps if available, otherwise falls back to defaults.
 */
const getCappedStat = (
  accumulated: number,
  effectType: EffectCapType,
  playerCaps?: EffectCaps
): number => {
  const caps = playerCaps || DEFAULT_EFFECT_CAPS;
  const cap = caps[effectType];
  return getEffectiveStat(accumulated, cap);
};

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
  explosionChance: number,
  rng?: () => number
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
      if (!explodedIndices.has(adjIndex) && nextRandom(rng) * 100 < explosionChance) {
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
 * Get cards to destroy with laser (entire row or column).
 * Set-geometric aiming: if 2+ matched cards share a row or column (with at least
 * one other card on that line), aim the laser along that axis through that card!
 */
export const getLaserCards = (board: Card[], matchedCards: Card[], rng?: () => number): Card[] => {
  const cardsToDestroy: Card[] = [];
  const matchedIdSet = new Set(matchedCards.map(mc => mc.id));
  const matchedIndices = matchedCards
    .map(mc => board.findIndex(c => c.id === mc.id))
    .filter(i => i !== -1);
  if (matchedIndices.length === 0) return cardsToDestroy;

  const { cols } = getGridDimensions(board.length);
  const rowGroups = new Map<number, number[]>();
  const colGroups = new Map<number, number[]>();
  for (const idx of matchedIndices) {
    const r = Math.floor(idx / cols);
    const c = idx % cols;
    rowGroups.set(r, [...(rowGroups.get(r) ?? []), idx]);
    colGroups.set(c, [...(colGroups.get(c) ?? []), idx]);
  }
  const hasTargetsOnLine = (idx: number, rowAxis: boolean) =>
    getLineIndices(idx, board.length, rowAxis).some(i => board[i] && !matchedIdSet.has(board[i].id));

  const alignedRows = [...rowGroups.values()].filter(v => v.length >= 2 && hasTargetsOnLine(v[0], true));
  const alignedCols = [...colGroups.values()].filter(v => v.length >= 2 && hasTargetsOnLine(v[0], false));

  let originIndex: number;
  let isRow: boolean;
  if (alignedRows.length > 0 && alignedCols.length > 0) {
    if (nextRandom(rng) < 0.5) {
      isRow = true;
      originIndex = alignedRows[Math.floor(nextRandom(rng) * alignedRows.length)][0];
    } else {
      isRow = false;
      originIndex = alignedCols[Math.floor(nextRandom(rng) * alignedCols.length)][0];
    }
  } else if (alignedCols.length > 0) {
    isRow = false;
    originIndex = alignedCols[Math.floor(nextRandom(rng) * alignedCols.length)][0];
  } else if (alignedRows.length > 0) {
    isRow = true;
    originIndex = alignedRows[Math.floor(nextRandom(rng) * alignedRows.length)][0];
  } else {
    originIndex = matchedIndices[Math.floor(nextRandom(rng) * matchedIndices.length)];
    // If the random axis would hit zero non-matched cards (e.g. 3 matched in one row), fire perpendicular
    const tryRow = nextRandom(rng) < 0.5;
    isRow = hasTargetsOnLine(originIndex, tryRow) ? tryRow : !tryRow;
  }

  const lineIndices = getLineIndices(originIndex, board.length, isRow);

  lineIndices.forEach(idx => {
    const card = board[idx];
    if (card && !matchedIdSet.has(card.id)) {
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
  chainChance: number,
  rng?: () => number
): Card[] => {
  const ricochetedCards: Card[] = [];
  const destroyedIds = new Set<string>();

  // Track all cards we can't target
  matchedCards.forEach(c => destroyedIds.add(c.id));
  excludedCards.forEach(c => destroyedIds.add(c.id));

  // Roll initial ricochet chance
  if (nextRandom(rng) * 100 >= ricochetChance) {
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
    const randomIndex = Math.floor(nextRandom(rng) * availableTargets.length);
    const targetCard = availableTargets[randomIndex];

    // Destroy this card
    ricochetedCards.push(targetCard);
    destroyedIds.add(targetCard.id);

    // Roll for chain continuation
    if (nextRandom(rng) * 100 >= chainChance) {
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
  fireChance: number,
  rng?: () => number
): Card[] => {
  const cardsToIgnite: Card[] = [];
  const igniteIndices = new Set<number>();

  matchedCards.forEach(matchedCard => {
    const matchedIndex = board.findIndex(c => c.id === matchedCard.id);
    if (matchedIndex === -1) return;

    const adjacentIndices = getAdjacentIndices(matchedIndex, board.length);

    adjacentIndices.forEach(adjIndex => {
      // Roll fire chance for each adjacent card
      if (!igniteIndices.has(adjIndex) && nextRandom(rng) * 100 < fireChance) {
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
  const availableCards = board.filter(c => !excludedIds.has(c.id) && !c.isDud && !c.isFaceDown && !c.locked);

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
  bonusExperience: number;
  bonusCoins: number;
  boardGrowth: number;
  notifications: string[];
  timeGainTriggered: boolean;  // Whether time gain actually triggered (for tracking)
  /** Updated damped-entropy pity-bag accumulator state when `procAccum` was supplied */
  nextProcAccum?: ProcAccumulatorState;
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
  isEchoMatch: boolean = false,
  timeGainContext?: {
    triggersThisRound: number;
    effectiveCap: number;
  },
  isGraceMatch: boolean = false,
  rng?: () => number,
  procAccum?: ProcAccumulatorState
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
    bonusExperience: 0,
    bonusCoins: 0,
    boardGrowth: 0,
    notifications: [],
    timeGainTriggered: false,
  };

  const rand = rng ?? Math.random;
  let curAccum: ProcAccumulatorState | undefined = procAccum;
  const rollProc = (channel: string, pct: number): boolean => {
    if (curAccum !== undefined && shouldUseEntropy(pct)) {
      const rolled = rollEntropyProc(curAccum, channel, pct, rand);
      curAccum = rolled.nextState;
      return rolled.triggered;
    }
    return nextRandom(rng) * 100 < pct;
  };

  // Get player's effect caps (or use defaults)
  const playerCaps = playerStats.effectCaps;

  const capped = Object.fromEntries(
    EFFECT_CAP_TYPES.map(type => [type, getCappedStat(playerStats[getMainStatForCap(type)], type, playerCaps)])
  ) as Record<EffectCapType, number>;

  // Echo effect - MUST be processed FIRST to reserve the echo set before explosions
  // Only triggers on player matches (not on echoed matches) to prevent infinite loops
  if (!isEchoMatch && capped.echo > 0 && activeAttributes && rollProc('echo', capped.echo)) {
    // Find a valid set among remaining cards (only excluding matched cards at this point)
    const echoSet = findValidSet(board, matchedCards, activeAttributes);
    if (echoSet) {
      result.autoMatchedSets.push(echoSet);
      result.notifications.push('Echo!');

      // Check for Chain Reaction - chance for a second auto-match
      if (playerStats.chainReactionChance > 0 && nextRandom(rng) * 100 < playerStats.chainReactionChance) {
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
  if (capped.explosion > 0) {
    if (curAccum !== undefined && shouldUseEntropy(capped.explosion)) {
      const explodedIndices = new Set<number>();
      matchedCards.forEach(matchedCard => {
        const matchedIndex = board.findIndex(c => c.id === matchedCard.id);
        if (matchedIndex === -1) return;
        for (const adjIndex of getAdjacentIndices(matchedIndex, board.length)) {
          if (explodedIndices.has(adjIndex)) continue;
          const adjCard = board[adjIndex];
          if (!adjCard || matchedCards.some(mc => mc.id === adjCard.id) || echoCardIds.has(adjCard.id)) continue;
          if (rollProc('explosion', capped.explosion)) {
            explodedIndices.add(adjIndex);
            result.explosiveCards.push(adjCard);
          }
        }
      });
    } else {
      const rawExplosiveCards = getExplosiveCards(board, matchedCards, capped.explosion, rng);
      // Filter out cards that are part of echo sets
      result.explosiveCards = rawExplosiveCards.filter(c => !echoCardIds.has(c.id));
    }
    if (result.explosiveCards.length > 0) {
      result.bonusPoints += result.explosiveCards.length;
      result.bonusMoney += result.explosiveCards.length;
      result.notifications.push(`Explosion! +${result.explosiveCards.length}`);
    }
  }

  // Laser effect - each laser weapon rolls independently, scaled by playerStats.laserChance
  // so Second Chance luck, weaponChanceScale.laser (Searchlight / Cascade Beam), and enemy counters all apply!
  const laserWeapons = weapons && weapons.length > 0
    ? weapons.filter(w => w.specialEffect === 'laser' && (w.effects.laserChance ?? 0) > 0)
    : [];
  if (laserWeapons.length > 0) {
    const rawLaserSum = laserWeapons.reduce((sum, w) => sum + (w.effects.laserChance || 0), 0);
    // When playerStats.laserChance > 0 (all real runs), scale each weapon proportionally to effective playerStats.laserChance;
    // when playerStats.laserChance === 0 (legacy unit tests passing bare DEFAULT_PLAYER_STATS + mock weapons), fall back to raw chance.
    const laserScale = playerStats.laserChance > 0 && rawLaserSum > 0 ? playerStats.laserChance / rawLaserSum : 1;
    const laserCardIdSet = new Set<string>();
    let lasersActivated = 0;

    laserWeapons.forEach(weapon => {
      const chance = Math.min(100, (weapon.effects.laserChance || 0) * laserScale);
      const channel = laserWeapons.length === 1 ? 'laser' : `laser:${weapon.id}`;
      if (rollProc(channel, chance)) {
        // This laser fires! Get cards for this laser
        const thisLaserCards = getLaserCards(board, matchedCards, rng);
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
  } else if (capped.laser > 0 && rollProc('laser', capped.laser)) {
    // Fallback: single roll with combined chance (for backward compatibility or non-laser-tagged sources)
    result.laserCards = getLaserCards(board, matchedCards, rng);
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
  if (capped.ricochet > 0) {
    // Calculate ricochet after explosions and lasers to avoid double-destruction
    // Also exclude echo set cards
    const excludedCards = [
      ...result.explosiveCards,
      ...result.laserCards,
      ...result.autoMatchedSets.flat(),
    ];
    if (curAccum !== undefined && shouldUseEntropy(capped.ricochet)) {
      if (rollProc('ricochet', capped.ricochet)) {
        result.ricochetCards = getRicochetCards(
          board,
          matchedCards,
          excludedCards,
          101,
          playerStats.ricochetChainChance,
          rng
        );
      }
    } else {
      result.ricochetCards = getRicochetCards(
        board,
        matchedCards,
        excludedCards,
        capped.ricochet,
        playerStats.ricochetChainChance,  // Chain chance isn't capped (ricochet cap is for initial chance)
        rng
      );
    }

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
  if (capped.fire > 0) {
    if (curAccum !== undefined && shouldUseEntropy(capped.fire)) {
      const igniteIndices = new Set<number>();
      matchedCards.forEach(matchedCard => {
        const matchedIndex = board.findIndex(c => c.id === matchedCard.id);
        if (matchedIndex === -1) return;
        for (const adjIndex of getAdjacentIndices(matchedIndex, board.length)) {
          if (igniteIndices.has(adjIndex)) continue;
          const adjCard = board[adjIndex];
          if (!adjCard || adjCard.onFire || matchedCards.some(mc => mc.id === adjCard.id)) continue;
          if (rollProc('fire', capped.fire)) {
            igniteIndices.add(adjIndex);
            result.fireCards.push(adjCard);
          }
        }
      });
    } else {
      result.fireCards = getFireSpreadCards(board, matchedCards, capped.fire, rng);
    }
    if (result.fireCards.length > 0) {
      result.notifications.push(`Fire! ${result.fireCards.length} cards`);
    }
  }

  // Healing chance
  if (capped.healing > 0 && nextRandom(rng) * 100 < capped.healing) {
    result.bonusHealing = 1;
    result.notifications.push('+1 HP');
  }

  // Hint gain chance
  if (capped.hint > 0 && nextRandom(rng) * 100 < capped.hint) {
    result.bonusHints = 1;
    result.notifications.push('+1 Hint');
  }

  // Time gain chance - respects per-round trigger cap
  if (capped.timeGain > 0 && nextRandom(rng) * 100 < capped.timeGain) {
    // Check if we're under the trigger cap
    const canTrigger = !timeGainContext ||
      timeGainContext.triggersThisRound < timeGainContext.effectiveCap;

    if (canTrigger) {
      result.bonusTime = playerStats.timeGainAmount || 10;
      result.timeGainTriggered = true;
      result.notifications.push(`+${result.bonusTime}s`);
    }
    // If over cap, the roll happened but no time awarded
  }

  // Grace gain chance
  if (capped.graceGain > 0 && nextRandom(rng) * 100 < capped.graceGain) {
    result.bonusGraces = 1;
    result.notifications.push('+1 Grace');
  }

  // XP gain chance - handles stacking above 100% (XP has no cap by default)
  if (capped.xpGain > 0) {
    const totalChance = capped.xpGain;
    const guaranteedXP = Math.floor(totalChance / 100);
    const remainingChance = totalChance % 100;

    // Add guaranteed XP
    result.bonusExperience += guaranteedXP;

    // Roll for the remaining chance
    if (remainingChance > 0 && nextRandom(rng) * 100 < remainingChance) {
      result.bonusExperience += 1;
    }

    if (result.bonusExperience > 0) {
      result.notifications.push(`+${result.bonusExperience} XP`);
    }
  }

  // Coin gain chance - handles stacking above 100%
  if (capped.coinGain > 0) {
    const totalChance = capped.coinGain;
    const guaranteedCoins = Math.floor(totalChance / 100);
    const remainingChance = totalChance % 100;

    // Add guaranteed coins
    result.bonusCoins += guaranteedCoins;

    // Roll for the remaining chance
    if (remainingChance > 0 && nextRandom(rng) * 100 < remainingChance) {
      result.bonusCoins += 1;
    }

    if (result.bonusCoins > 0) {
      result.notifications.push(`+${result.bonusCoins} Coins`);
    }
  }

  // Board growth chance
  if (capped.boardGrowth > 0 && nextRandom(rng) * 100 < capped.boardGrowth) {
    result.boardGrowth = playerStats.boardGrowthAmount || 1;
    result.notifications.push(`+${result.boardGrowth} Cards`);
  }

  // Bridge weapon cross-system triggers (non-cascading, player matches only)
  if (!isEchoMatch && weapons && weapons.some(w => w.specialEffect === 'bridge')) {
    if (isGraceMatch) {
      for (const b of rollBridgeEffects('onGraceUse', weapons, rng)) {
        if (b.effect === 'triggerLaser') {
          const bridgeLaserCards = getLaserCards(board, matchedCards, rng).filter(
            lc =>
              !result.explosiveCards.some(ec => ec.id === lc.id) &&
              !result.laserCards.some(existing => existing.id === lc.id) &&
              !echoCardIds.has(lc.id)
          );
          result.laserCount += 1;
          if (bridgeLaserCards.length > 0) {
            result.laserCards.push(...bridgeLaserCards);
            result.bonusPoints += bridgeLaserCards.length * 2;
            result.bonusMoney += bridgeLaserCards.length;
            result.notifications.push(`${b.weaponName}: Laser! +${bridgeLaserCards.length * 2}`);
          }
        }
      }
    }

    if (result.explosiveCards.length > 0) {
      for (const b of rollBridgeEffects('onExplosion', weapons, rng)) {
        if (b.effect === 'gainGrace') {
          const amt = b.amount ?? 1;
          result.bonusGraces += amt;
          result.notifications.push(`${b.weaponName}: +${amt} Grace`);
        }
      }
    }

    if (result.timeGainTriggered && activeAttributes) {
      for (const b of rollBridgeEffects('onTimeGain', weapons, rng)) {
        if (b.effect === 'triggerEcho') {
          const excluded = [
            ...matchedCards,
            ...result.explosiveCards,
            ...result.laserCards,
            ...result.ricochetCards,
            ...result.autoMatchedSets.flat(),
          ];
          const bridgeEcho = findValidSet(board, excluded, activeAttributes);
          if (bridgeEcho) {
            result.autoMatchedSets.push(bridgeEcho);
            result.notifications.push(`${b.weaponName}: Echo!`);
          }
        }
      }
    }

    if (result.autoMatchedSets.length > 0) {
      for (const b of rollBridgeEffects('onEcho', weapons, rng)) {
        if (b.effect === 'fireCard') {
          const count = b.amount ?? 1;
          const busyIds = new Set([
            ...matchedCards.map(c => c.id),
            ...result.explosiveCards.map(c => c.id),
            ...result.laserCards.map(c => c.id),
            ...result.ricochetCards.map(c => c.id),
            ...result.autoMatchedSets.flat().map(c => c.id),
            ...result.fireCards.map(c => c.id),
          ]);
          const candidates = board.filter(c => !c.onFire && !busyIds.has(c.id));
          for (let i = 0; i < count && candidates.length > 0; i++) {
            const pickIdx = Math.floor(nextRandom(rng) * candidates.length);
            const [picked] = candidates.splice(pickIdx, 1);
            busyIds.add(picked.id);
            result.fireCards.push(picked);
          }
          if (result.fireCards.length > 0) {
            result.notifications.push(`${b.weaponName}: Fire!`);
          }
        }
      }
    }

    // Soul Harvest (onDestruction): roll once PER destroyed card (matching description!)
    const destroyedCount =
      result.explosiveCards.length + result.laserCards.length + result.ricochetCards.length;
    if (destroyedCount > 0) {
      let totalHeal = 0;
      let lastWeaponName = '';
      for (let i = 0; i < destroyedCount; i++) {
        for (const b of rollBridgeEffects('onDestruction', weapons, rng)) {
          if (b.effect === 'heal') {
            totalHeal += b.amount ?? 1;
            lastWeaponName = b.weaponName;
          }
        }
      }
      if (totalHeal > 0) {
        result.bonusHealing += totalHeal;
        result.notifications.push(`${lastWeaponName}: +${totalHeal} HP`);
      }
    }

    if (result.bonusCoins > 0) {
      for (const b of rollBridgeEffects('onCoinGain', weapons, rng)) {
        if (b.effect === 'gainHint') {
          const amt = b.amount ?? 1;
          result.bonusHints += amt;
          result.notifications.push(`${b.weaponName}: +${amt} Hint`);
        }
      }
    }

    if (result.bonusExperience > 0) {
      for (const b of rollBridgeEffects('onXPGain', weapons, rng)) {
        if (b.effect === 'gainCoin') {
          const amt = b.amount ?? 1;
          result.bonusCoins += amt;
          result.notifications.push(`${b.weaponName}: +${amt} Coin`);
        }
      }
    }
  }

  if (curAccum !== undefined) {
    result.nextProcAccum = curAccum;
  }

  return result;
};
