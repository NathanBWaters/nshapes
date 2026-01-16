/**
 * Enemy System Type Definitions
 *
 * The enemy system uses a factory pattern with lifecycle hooks to keep GameBoard
 * decoupled from enemy-specific logic. Enemies return deltas (not full state) to
 * avoid race conditions with React state.
 */

import type { Card, Shape, Color, AttributeName, Weapon } from '../types';
import type { IconName } from '../components/Icon';

// ============================================================================
// ENEMY OPTION (for selection screen with pre-determined rewards)
// ============================================================================

/**
 * An enemy paired with its pre-determined stretch goal reward.
 * Generated before enemy selection so players can see what they'll get.
 */
export interface EnemyOption {
  enemy: EnemyInstance;
  stretchGoalReward: Weapon;
}

// ============================================================================
// CORE ENEMY INTERFACE
// ============================================================================

/**
 * Core interface for all enemies.
 * GameBoard only calls lifecycle methods at certain points without knowing
 * about specific enemy implementations.
 */
export interface EnemyInstance {
  // === METADATA ===
  readonly name: string;
  readonly icon: IconName;
  readonly tier: 1 | 2 | 3 | 4;
  readonly description: string;
  readonly defeatConditionText: string;

  // === LIFECYCLE HOOKS ===

  /**
   * Called once when round begins. Initialize any enemy-specific state.
   * Returns deltas to apply to initial game state (e.g., place triple cards)
   */
  onRoundStart(board: Card[]): EnemyStartResult;

  /**
   * Called every tick. Handle time-based effects.
   * Enemy maintains internal timers - GameBoard just passes deltaMs.
   * @param deltaMs - milliseconds since last tick
   * @param board - current board state (read-only reference)
   */
  onTick(deltaMs: number, board: Card[]): EnemyTickResult;

  /**
   * Called when player makes a valid match.
   * Enemy resets internal "time since last match" timer here.
   * Can return reward modifiers (e.g., -5s time for Thieving Raven)
   */
  onValidMatch(matchedCards: Card[], board: Card[]): EnemyMatchResult;

  /**
   * Called when player makes an invalid match attempt.
   * Can return penalties (extra card removal, etc.)
   */
  onInvalidMatch(cards: Card[], board: Card[]): EnemyMatchResult;

  /**
   * Called when a new card is drawn to replace a matched/removed card.
   * Can modify the card (add dud state, face-down, bomb timer, etc.)
   */
  onCardDraw(card: Card): Card;

  /**
   * Check if defeat condition is met. Called after each match.
   * @param stats - Round statistics tracked during play
   */
  checkDefeatCondition(stats: RoundStats): boolean;

  /**
   * Called when round ends. Cleanup any enemy state.
   */
  onRoundEnd(): void;

  // === UI HINTS ===

  /**
   * Returns UI modifiers for rendering.
   * Called each render to get current state of inactivity bars, etc.
   */
  getUIModifiers(): EnemyUIModifiers;

  /**
   * Returns stat modifiers (weapon counters, damage multipliers, etc.)
   * Applied when calculating effective player stats.
   */
  getStatModifiers(): EnemyStatModifiers;
}

// ============================================================================
// DELTA-BASED RESULT TYPES
// ============================================================================

/**
 * Result from onRoundStart - initial board modifications
 */
export interface EnemyStartResult {
  cardModifications: Array<{ cardId: string; changes: Partial<Card> }>;
  events: EnemyEvent[];
}

/**
 * Result from onTick - time-based updates
 * All values are deltas to apply, not absolute values
 */
export interface EnemyTickResult {
  // Deltas to apply
  scoreDelta: number;  // e.g., -5 for score decay
  healthDelta: number;  // e.g., -1 for inactivity penalty
  timeDelta: number;  // e.g., 0 (timer speed handled separately)

  // Card changes
  cardsToRemove: string[];  // Card IDs to remove (Burrowing Mole)
  cardModifications: Array<{ cardId: string; changes: Partial<Card> }>;
  cardsToFlip: string[];  // Face-down cards to flip up

  // Events for UI/sound
  events: EnemyEvent[];

  // Instant death flag (for inactivity death penalty)
  instantDeath: boolean;
}

/**
 * Result from onValidMatch/onInvalidMatch
 * Contains reward modifiers and additional effects
 */
export interface EnemyMatchResult {
  // Reward modifiers (applied to match rewards)
  timeDelta: number;  // e.g., -5 for Thieving Raven
  pointsMultiplier: number;  // e.g., 2.0 for Stinging Scorpion

  // Card changes
  cardsToRemove: string[];  // Extra cards removed (Greedy Squirrel)
  cardsToFlip: string[];  // Face-down cards that flip (70% chance already rolled)

  // Events
  events: EnemyEvent[];
}

// ============================================================================
// UI AND STAT MODIFIERS
// ============================================================================

/**
 * UI modifiers returned by getUIModifiers()
 * Used to render enemy-specific UI elements
 */
export interface EnemyUIModifiers {
  showInactivityBar?: {
    current: number;  // ms since last match
    max: number;      // ms until penalty
    penalty: 'damage' | 'death';
  };
  showScoreDecay?: { rate: number };  // pts/sec
  timerSpeedMultiplier?: number;  // 1.2 = 20% faster (affects actual tick rate)
  disableAutoHint?: boolean;
  disableManualHint?: boolean;
  showCountdownCards?: Array<{ cardId: string; timeRemaining: number }>;
  showBombCards?: Array<{ cardId: string; timeRemaining: number }>;
  weaponCounters?: Array<{ type: string; reduction: number }>;
}

/**
 * Stat modifiers returned by getStatModifiers()
 * Applied when calculating effective player stats
 */
export interface EnemyStatModifiers {
  // Weapon counter reductions (percentage points to subtract)
  fireSpreadChanceReduction?: number;
  explosionChanceReduction?: number;
  laserChanceReduction?: number;
  hintGainChanceReduction?: number;
  graceGainChanceReduction?: number;
  timeGainChanceReduction?: number;
  healingChanceReduction?: number;

  // Multipliers
  damageMultiplier?: number;  // 2.0 = take 2x damage
  pointsMultiplier?: number;  // 2.0 = earn 2x points
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * Events emitted by enemies for UI/sound effects
 */
export type EnemyEvent =
  | { type: 'card_became_dud'; cardId: string }
  | { type: 'card_became_facedown'; cardId: string }
  | { type: 'card_flipped'; cardId: string }
  | { type: 'attribute_changed'; cardIds: string[]; attribute: AttributeName }
  | { type: 'card_removed'; cardId: string; reason: string }
  | { type: 'positions_shuffled' }
  | { type: 'inactivity_warning'; secondsRemaining: number }
  | { type: 'inactivity_penalty'; penalty: 'damage' | 'death' }
  | { type: 'countdown_warning'; cardId: string; secondsRemaining: number }
  | { type: 'countdown_expired'; cardId: string }
  | { type: 'bomb_placed'; cardId: string; timer: number }
  | { type: 'bomb_exploded'; cardId: string }
  | { type: 'time_stolen'; amount: number };

// ============================================================================
// ROUND STATS - For Defeat Conditions
// ============================================================================

/**
 * Statistics tracked during a round for defeat condition checking
 */
export interface RoundStats {
  // Match tracking
  totalMatches: number;
  currentStreak: number;  // Resets on invalid match
  maxStreak: number;
  invalidMatches: number;

  // Timing
  matchTimes: number[];  // ms for each match (time since previous match)
  timeRemaining: number;

  // Card tracking
  cardsRemaining: number;
  tripleCardsCleared: number;
  faceDownCardsMatched: number;
  bombsDefused: number;
  countdownCardsMatched: number;

  // Attribute tracking
  shapesMatched: Set<Shape>;
  colorsMatched: Set<Color>;
  allDifferentMatches: number;
  allSameColorMatches: number;
  squiggleMatches: number;

  // Resource tracking
  gracesUsed: number;
  hintsUsed: number;
  hintsRemaining: number;
  gracesRemaining: number;
  damageReceived: number;
  weaponEffectsTriggered: Set<string>;

  // Score
  currentScore: number;
  targetScore: number;
}

// ============================================================================
// EFFECT BEHAVIOR INTERFACE (for composition)
// ============================================================================

/**
 * Interface for reusable effect behaviors used in enemy composition
 */
export interface EffectBehavior {
  onRoundStart?: (board: Card[], internalState: Record<string, unknown>, config: unknown) => Partial<EnemyStartResult>;
  onTick?: (deltaMs: number, board: Card[], internalState: Record<string, unknown>, config: unknown) => Partial<EnemyTickResult>;
  onValidMatch?: (cards: Card[], board: Card[], internalState: Record<string, unknown>, config: unknown) => Partial<EnemyMatchResult>;
  onInvalidMatch?: (cards: Card[], board: Card[], internalState: Record<string, unknown>, config: unknown) => Partial<EnemyMatchResult>;
  onCardDraw?: (card: Card, config: unknown) => Card;
  getStatModifiers?: (config: unknown) => Partial<EnemyStatModifiers>;
  getUIModifiers?: (internalState: Record<string, unknown>, config: unknown) => Partial<EnemyUIModifiers>;
}

/**
 * Configuration for composing effects into an enemy
 */
export interface EffectConfig {
  behavior: EffectBehavior;
  config: unknown;
}
