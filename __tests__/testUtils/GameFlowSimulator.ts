/**
 * Game Flow Simulator for Enemy Stretch Goal Tests
 *
 * Simulates game flow without React, providing direct access to RoundStats
 * for verification. This allows testing of defeat conditions in isolation.
 */

import type { Card } from '@/types';
import type { EnemyInstance, RoundStats } from '@/types/enemy';
import { createRoundStats, createCard, createTestBoard } from './index';

export interface SimulatorConfig {
  /** Initial board (default: 12 cards) */
  board?: Card[];
  /** Target score (default: 100) */
  targetScore?: number;
  /** Initial time remaining in seconds (default: 60) */
  timeRemaining?: number;
  /** Initial hints (default: 3) */
  hints?: number;
  /** Initial graces (default: 2) */
  graces?: number;
}

/**
 * Game Flow Simulator
 *
 * Simulates game actions and tracks RoundStats for testing defeat conditions.
 */
export class GameFlowSimulator {
  private enemy: EnemyInstance;
  private stats: RoundStats;
  private board: Card[];
  private cardIdCounter: number = 0;

  constructor(enemy: EnemyInstance, config: SimulatorConfig = {}) {
    this.enemy = enemy;
    this.board = config.board ?? createTestBoard();

    // Initialize stats
    this.stats = createRoundStats({
      targetScore: config.targetScore ?? 100,
      timeRemaining: config.timeRemaining ?? 60,
      hintsRemaining: config.hints ?? 3,
      gracesRemaining: config.graces ?? 2,
      cardsRemaining: this.board.length,
    });

    // Run enemy's onRoundStart
    const startResult = enemy.onRoundStart(this.board);

    // Apply card modifications from enemy
    for (const mod of startResult.cardModifications) {
      const cardIndex = this.board.findIndex((c) => c.id === mod.cardId);
      if (cardIndex >= 0) {
        this.board[cardIndex] = { ...this.board[cardIndex], ...mod.changes };
      }
    }
  }

  /**
   * Get the current RoundStats (for defeat condition checking).
   */
  getStats(): RoundStats {
    return { ...this.stats };
  }

  /**
   * Get the current board.
   */
  getBoard(): Card[] {
    return [...this.board];
  }

  /**
   * Check if the enemy's defeat condition is met.
   */
  isDefeated(): boolean {
    return this.enemy.checkDefeatCondition(this.stats);
  }

  /**
   * Draw a new card and apply enemy's onCardDraw effect.
   * Returns the (possibly modified) card.
   */
  drawCard(overrides: Partial<Card> = {}): Card {
    const baseCard = createCard({
      id: `sim-card-${this.cardIdCounter++}`,
      ...overrides,
    });

    // Apply enemy's onCardDraw
    const modifiedCard = this.enemy.onCardDraw(baseCard);
    this.board.push(modifiedCard);
    this.stats.cardsRemaining = this.board.length;

    return modifiedCard;
  }

  /**
   * Draw a card that will be face-down (due to enemy effect).
   * Forces the card to be face-down regardless of enemy's random roll.
   */
  drawFaceDownCard(overrides: Partial<Card> = {}): Card {
    const card = this.drawCard(overrides);

    // Force face-down if enemy didn't make it face-down
    if (!card.isFaceDown) {
      const cardIndex = this.board.findIndex((c) => c.id === card.id);
      if (cardIndex >= 0) {
        const faceDownCard = {
          ...card,
          isFaceDown: true,
          wasOriginallyFaceDown: true,
        };
        this.board[cardIndex] = faceDownCard;
        return faceDownCard;
      }
    } else {
      // Card was made face-down by enemy, mark wasOriginallyFaceDown
      const cardIndex = this.board.findIndex((c) => c.id === card.id);
      if (cardIndex >= 0) {
        const updatedCard = { ...card, wasOriginallyFaceDown: true };
        this.board[cardIndex] = updatedCard;
        return updatedCard;
      }
    }

    return card;
  }

  /**
   * Reveal a face-down card (simulate player tap).
   */
  revealCard(cardId: string): Card | null {
    const cardIndex = this.board.findIndex((c) => c.id === cardId);
    if (cardIndex < 0) return null;

    const card = this.board[cardIndex];
    if (!card.isFaceDown) return card;

    const revealedCard = { ...card, isFaceDown: false };
    this.board[cardIndex] = revealedCard;
    return revealedCard;
  }

  /**
   * Make a valid match with the given cards.
   * Updates stats and applies enemy effects.
   *
   * @param cardIds - IDs of cards to match (must be on the board)
   * @param options - Match options for attribute tracking
   */
  makeValidMatch(
    cardIds: string[],
    options: {
      isAllDifferent?: boolean;
      isAllSameColor?: boolean;
      hasSquiggle?: boolean;
      pointsEarned?: number;
    } = {}
  ): void {
    const matchedCards = cardIds
      .map((id) => this.board.find((c) => c.id === id))
      .filter((c): c is Card => c !== undefined);

    if (matchedCards.length !== cardIds.length) {
      throw new Error('Some cards not found on board');
    }

    // Track match stats
    this.stats.totalMatches += 1;
    this.stats.currentStreak += 1;
    this.stats.maxStreak = Math.max(this.stats.maxStreak, this.stats.currentStreak);
    this.stats.matchTimes.push(1000); // Dummy match time

    // Track attributes
    for (const card of matchedCards) {
      this.stats.shapesMatched.add(card.shape);
      this.stats.colorsMatched.add(card.color);
      const currentCount = this.stats.colorMatchCounts.get(card.color) || 0;
      this.stats.colorMatchCounts.set(card.color, currentCount + 1);
    }

    if (options.isAllDifferent) {
      this.stats.allDifferentMatches += 1;
    }
    if (options.isAllSameColor) {
      this.stats.allSameColorMatches += 1;
    }
    if (options.hasSquiggle) {
      this.stats.squiggleMatches += 1;
    }

    // Track face-down cards (uses wasOriginallyFaceDown for accurate tracking)
    const faceDownCount = matchedCards.filter((c) => c.wasOriginallyFaceDown).length;
    this.stats.faceDownCardsMatched += faceDownCount;

    // Track bomb defusal
    const bombCount = matchedCards.filter((c) => c.hasBomb).length;
    this.stats.bombsDefused += bombCount;

    // Track countdown cards
    const countdownCount = matchedCards.filter((c) => c.hasCountdown).length;
    this.stats.countdownCardsMatched += countdownCount;

    // Track triple cards (cards with health going from 1 to 0)
    for (const card of matchedCards) {
      if (card.health === 1) {
        this.stats.tripleCardsCleared += 1;
      }
    }

    // Update score
    const points = options.pointsEarned ?? 10;
    this.stats.currentScore += points;

    // Apply enemy effects
    const matchResult = this.enemy.onValidMatch(matchedCards, this.board);

    // Remove matched cards from board (for cards with health <= 1)
    const cardsToRemove = matchedCards.filter((c) => (c.health ?? 1) <= 1);
    this.board = this.board.filter((c) => !cardsToRemove.some((matched) => matched.id === c.id));

    // Remove extra cards as per enemy effect
    if (matchResult.cardsToRemove.length > 0) {
      this.board = this.board.filter((c) => !matchResult.cardsToRemove.includes(c.id));
    }

    // Flip cards as per enemy effect
    for (const cardId of matchResult.cardsToFlip) {
      this.revealCard(cardId);
    }

    this.stats.cardsRemaining = this.board.length;
  }

  /**
   * Make an invalid match attempt.
   */
  makeInvalidMatch(cardIds: string[]): void {
    const cards = cardIds
      .map((id) => this.board.find((c) => c.id === id))
      .filter((c): c is Card => c !== undefined);

    this.stats.invalidMatches += 1;
    this.stats.currentStreak = 0;

    // Apply enemy effects
    const matchResult = this.enemy.onInvalidMatch(cards, this.board);

    // Remove cards as per enemy effect
    if (matchResult.cardsToRemove.length > 0) {
      this.board = this.board.filter((c) => !matchResult.cardsToRemove.includes(c.id));
    }

    this.stats.cardsRemaining = this.board.length;
  }

  /**
   * Advance time by the specified number of seconds.
   * This decreases timeRemaining and triggers enemy onTick.
   *
   * @param seconds - Seconds to advance
   */
  advanceTime(seconds: number): void {
    const deltaMs = seconds * 1000;

    // Update time remaining
    this.stats.timeRemaining = Math.max(0, this.stats.timeRemaining - seconds);

    // Apply enemy tick
    const tickResult = this.enemy.onTick(deltaMs, this.board);

    // Apply card modifications
    for (const mod of tickResult.cardModifications) {
      const cardIndex = this.board.findIndex((c) => c.id === mod.cardId);
      if (cardIndex >= 0) {
        this.board[cardIndex] = { ...this.board[cardIndex], ...mod.changes };
      }
    }

    // Remove cards
    if (tickResult.cardsToRemove.length > 0) {
      this.board = this.board.filter((c) => !tickResult.cardsToRemove.includes(c.id));
    }

    // Flip cards
    for (const cardId of tickResult.cardsToFlip) {
      this.revealCard(cardId);
    }

    this.stats.cardsRemaining = this.board.length;
  }

  /**
   * Set the current score directly.
   */
  setScore(score: number): void {
    this.stats.currentScore = score;
  }

  /**
   * Set the time remaining directly.
   */
  setTimeRemaining(seconds: number): void {
    this.stats.timeRemaining = seconds;
  }

  /**
   * Use a hint.
   */
  useHint(): void {
    if (this.stats.hintsRemaining > 0) {
      this.stats.hintsUsed += 1;
      this.stats.hintsRemaining -= 1;
    }
  }

  /**
   * Use a grace (when an invalid match is saved).
   */
  useGrace(): void {
    if (this.stats.gracesRemaining > 0) {
      this.stats.gracesUsed += 1;
      this.stats.gracesRemaining -= 1;
    }
  }

  /**
   * Record damage received.
   */
  takeDamage(amount: number): void {
    this.stats.damageReceived += amount;
  }

  /**
   * Record a weapon effect trigger.
   */
  triggerWeaponEffect(effectType: string): void {
    this.stats.weaponEffectsTriggered.add(effectType);
  }

  /**
   * Manually increment face-down cards matched count.
   * Use this to test the tracking separately from match simulation.
   */
  recordFaceDownCardMatched(count: number = 1): void {
    this.stats.faceDownCardsMatched += count;
  }

  /**
   * Manually increment triple cards cleared count.
   * Use this to test the tracking separately from match simulation.
   */
  recordTripleCardCleared(count: number = 1): void {
    this.stats.tripleCardsCleared += count;
  }

  /**
   * Get a card from the board by ID.
   */
  getCard(cardId: string): Card | undefined {
    return this.board.find((c) => c.id === cardId);
  }

  /**
   * Find cards on the board matching a predicate.
   */
  findCards(predicate: (card: Card) => boolean): Card[] {
    return this.board.filter(predicate);
  }
}
