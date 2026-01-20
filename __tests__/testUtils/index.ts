/**
 * Shared Test Utilities for Enemy Stretch Goal Tests
 *
 * This file provides canonical factories for creating test data.
 * All enemy tests should import from here to ensure consistency.
 */

import type { Card, Shape, Color, Number as CardNumber, Shading } from '@/types';
import type { RoundStats } from '@/types/enemy';

// ============================================================================
// CARD ID COUNTER
// ============================================================================

let cardIdCounter = 0;

/**
 * Reset the card ID counter for deterministic test IDs.
 * Call this in beforeEach() to ensure consistent IDs across test runs.
 */
export function resetCardIdCounter(): void {
  cardIdCounter = 0;
}

/**
 * Generate a unique card ID.
 */
function generateCardId(): string {
  return `test-card-${cardIdCounter++}`;
}

// ============================================================================
// ROUND STATS FACTORY
// ============================================================================

/**
 * Create a RoundStats object with default values.
 * This is the canonical factory - all tests should use this.
 *
 * @param overrides - Partial RoundStats to override defaults
 */
export function createRoundStats(overrides: Partial<RoundStats> = {}): RoundStats {
  return {
    // Match tracking
    totalMatches: 0,
    currentStreak: 0,
    maxStreak: 0,
    invalidMatches: 0,

    // Timing (in seconds, matching actual game usage)
    matchTimes: [],
    timeRemaining: 60,

    // Card tracking
    cardsRemaining: 12,
    tripleCardsCleared: 0,
    faceDownCardsMatched: 0,
    bombsDefused: 0,
    countdownCardsMatched: 0,

    // Attribute tracking
    shapesMatched: new Set<Shape>(),
    colorsMatched: new Set<Color>(),
    colorMatchCounts: new Map<Color, number>(),
    allDifferentMatches: 0,
    allSameColorMatches: 0,
    squiggleMatches: 0,

    // Resource tracking
    gracesUsed: 0,
    hintsUsed: 0,
    hintsRemaining: 3,
    gracesRemaining: 2,
    damageReceived: 0,
    weaponEffectsTriggered: new Set<string>(),

    // Score
    currentScore: 0,
    targetScore: 100,

    ...overrides,
  };
}

// ============================================================================
// CARD FACTORIES
// ============================================================================

export interface CardOverrides {
  id?: string;
  shape?: Shape;
  color?: Color;
  number?: CardNumber;
  shading?: Shading;
  selected?: boolean;
  health?: number;
  isFaceDown?: boolean;
  wasOriginallyFaceDown?: boolean;
  isDud?: boolean;
  hasBomb?: boolean;
  bombTimer?: number;
  hasCountdown?: boolean;
  countdownTimer?: number;
  onFire?: boolean;
}

/**
 * Create a basic card with default values.
 *
 * @param overrides - Partial card properties to override defaults
 */
export function createCard(overrides: CardOverrides = {}): Card {
  return {
    id: overrides.id ?? generateCardId(),
    shape: overrides.shape ?? 'oval',
    color: overrides.color ?? 'red',
    number: overrides.number ?? 1,
    shading: overrides.shading ?? 'solid',
    selected: overrides.selected ?? false,
    health: overrides.health,
    isFaceDown: overrides.isFaceDown,
    wasOriginallyFaceDown: overrides.wasOriginallyFaceDown,
    isDud: overrides.isDud,
    hasBomb: overrides.hasBomb,
    bombTimer: overrides.bombTimer,
    hasCountdown: overrides.hasCountdown,
    countdownTimer: overrides.countdownTimer,
    onFire: overrides.onFire,
  };
}

/**
 * Create a face-down card.
 * Sets both isFaceDown and wasOriginallyFaceDown to true.
 *
 * @param overrides - Partial card properties to override defaults
 */
export function createFaceDownCard(overrides: CardOverrides = {}): Card {
  return createCard({
    ...overrides,
    isFaceDown: true,
    wasOriginallyFaceDown: true,
  });
}

/**
 * Create a triple card (requires 3 matches to clear).
 *
 * @param overrides - Partial card properties to override defaults
 */
export function createTripleCard(overrides: CardOverrides = {}): Card {
  return createCard({
    ...overrides,
    health: 3,
  });
}

/**
 * Create a card that was originally face-down but has been revealed.
 * The card's isFaceDown is false (revealed), but wasOriginallyFaceDown is true.
 *
 * @param overrides - Partial card properties to override defaults
 */
export function createRevealedFaceDownCard(overrides: CardOverrides = {}): Card {
  return createCard({
    ...overrides,
    isFaceDown: false,
    wasOriginallyFaceDown: true,
  });
}

// ============================================================================
// BOARD FACTORIES
// ============================================================================

/**
 * Create a test board with the specified number of cards.
 *
 * @param count - Number of cards to create (default: 12)
 */
export function createTestBoard(count: number = 12): Card[] {
  return Array(count)
    .fill(null)
    .map(() => createCard());
}

/**
 * Create a varied test board with different shapes, colors, and numbers.
 * Useful for tests that need attribute diversity.
 */
export function createVariedBoard(): Card[] {
  const shapes: Shape[] = ['oval', 'squiggle', 'diamond'];
  const colors: Color[] = ['red', 'green', 'purple'];
  const numbers: CardNumber[] = [1, 2, 3];
  const shadings: Shading[] = ['solid', 'striped', 'open'];

  const cards: Card[] = [];
  for (let i = 0; i < 12; i++) {
    cards.push(
      createCard({
        shape: shapes[i % 3],
        color: colors[Math.floor(i / 3) % 3],
        number: numbers[Math.floor(i / 9) % 3],
        shading: shadings[i % 3],
      })
    );
  }
  return cards;
}

// ============================================================================
// MATCH SIMULATION HELPERS
// ============================================================================

/**
 * Simulate revealing a face-down card (player tap).
 * Returns a new card object with isFaceDown set to false.
 *
 * @param card - The face-down card to reveal
 */
export function revealCard(card: Card): Card {
  if (!card.isFaceDown) {
    return card;
  }
  return {
    ...card,
    isFaceDown: false,
  };
}

/**
 * Simulate matching a triple card (reduce health by 1).
 * Returns a new card object with decremented health.
 *
 * @param card - The triple card to match
 */
export function matchTripleCard(card: Card): Card {
  const currentHealth = card.health ?? 1;
  return {
    ...card,
    health: Math.max(0, currentHealth - 1),
  };
}
