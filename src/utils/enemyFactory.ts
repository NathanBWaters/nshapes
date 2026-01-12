/**
 * Enemy Factory
 *
 * Creates enemy instances using a registry pattern.
 * Each call to createEnemy() returns a fresh instance with reset internal state.
 */

import type { Card } from '@/types';
import type {
  EnemyInstance,
  EnemyStartResult,
  EnemyTickResult,
  EnemyMatchResult,
  EnemyUIModifiers,
  EnemyStatModifiers,
  RoundStats,
} from '@/types/enemy';
import { shuffleArray } from './gameUtils';

// ============================================================================
// ENEMY REGISTRY
// ============================================================================

/**
 * Registry of all enemy constructors indexed by name.
 * Will be populated as enemies are implemented.
 */
export const ENEMY_REGISTRY: Record<string, () => EnemyInstance> = {
  // Tier 1 enemies will be added here
  // 'Junk Rat': () => createJunkRat(),
  // 'Stalking Wolf': () => createStalkingWolf(),
  // etc.
};

// ============================================================================
// DUMMY ENEMY
// ============================================================================

/**
 * Create a no-op enemy for testing.
 * All hooks return empty/neutral deltas.
 * checkDefeatCondition always returns true (always "defeated").
 */
export function createDummyEnemy(): EnemyInstance {
  return {
    name: 'Dummy',
    icon: 'lorc/uncertainty',
    tier: 1,
    description: 'No effect',
    defeatConditionText: 'Always defeated',

    onRoundStart: (_board: Card[]): EnemyStartResult => ({
      cardModifications: [],
      events: [],
    }),

    onTick: (_deltaMs: number, _board: Card[]): EnemyTickResult => ({
      scoreDelta: 0,
      healthDelta: 0,
      timeDelta: 0,
      cardsToRemove: [],
      cardModifications: [],
      cardsToFlip: [],
      events: [],
      instantDeath: false,
    }),

    onValidMatch: (_matchedCards: Card[], _board: Card[]): EnemyMatchResult => ({
      timeDelta: 0,
      pointsMultiplier: 1,
      cardsToRemove: [],
      cardsToFlip: [],
      events: [],
    }),

    onInvalidMatch: (_cards: Card[], _board: Card[]): EnemyMatchResult => ({
      timeDelta: 0,
      pointsMultiplier: 1,
      cardsToRemove: [],
      cardsToFlip: [],
      events: [],
    }),

    onCardDraw: (card: Card): Card => card,

    checkDefeatCondition: (_stats: RoundStats): boolean => true,

    onRoundEnd: (): void => {},

    getUIModifiers: (): EnemyUIModifiers => ({}),

    getStatModifiers: (): EnemyStatModifiers => ({}),
  };
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

/**
 * Create an enemy instance by name.
 * Each call returns a FRESH instance with reset internal state.
 *
 * @param name - The enemy name to create
 * @returns A fresh EnemyInstance, or DummyEnemy if name not found
 */
export function createEnemy(name: string): EnemyInstance {
  const factory = ENEMY_REGISTRY[name];
  if (!factory) {
    console.warn(`Unknown enemy: ${name}, using dummy`);
    return createDummyEnemy();
  }
  return factory();
}

/**
 * Get a list of all registered enemy names.
 */
export function getEnemyNames(): string[] {
  return Object.keys(ENEMY_REGISTRY);
}

/**
 * Get all enemies of a specific tier.
 *
 * @param tier - The tier to filter by (1-4)
 * @returns Array of enemy names in that tier
 */
export function getEnemiesByTier(tier: 1 | 2 | 3 | 4): string[] {
  return Object.entries(ENEMY_REGISTRY)
    .filter(([_, factory]) => factory().tier === tier)
    .map(([name]) => name);
}

/**
 * Get random enemies for selection screen.
 * Returns fresh instances, not references.
 *
 * @param tier - Which tier to pull from
 * @param count - How many to return (default 3)
 * @returns Array of fresh EnemyInstance objects
 */
export function getRandomEnemies(tier: 1 | 2 | 3 | 4, count: number = 3): EnemyInstance[] {
  const tierEnemyNames = getEnemiesByTier(tier);

  if (tierEnemyNames.length === 0) {
    // No enemies registered for this tier, return dummy enemies
    return Array(count).fill(null).map(() => createDummyEnemy());
  }

  // Shuffle and take requested count
  const shuffled = shuffleArray(tierEnemyNames);
  const selectedNames = shuffled.slice(0, Math.min(count, shuffled.length));

  // Create fresh instances
  return selectedNames.map(name => createEnemy(name));
}

/**
 * Check if an enemy is registered.
 *
 * @param name - The enemy name to check
 * @returns true if the enemy exists in the registry
 */
export function isEnemyRegistered(name: string): boolean {
  return name in ENEMY_REGISTRY;
}

/**
 * Register a new enemy in the registry.
 * Used by enemy implementation files to add themselves.
 *
 * @param name - The enemy name
 * @param factory - Function that creates a fresh instance
 */
export function registerEnemy(name: string, factory: () => EnemyInstance): void {
  if (ENEMY_REGISTRY[name]) {
    console.warn(`Enemy "${name}" is already registered, overwriting`);
  }
  ENEMY_REGISTRY[name] = factory;
}
