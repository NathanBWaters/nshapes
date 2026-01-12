# Enemy System Implementation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement 51 enemies using a factory/composition pattern with lifecycle hooks

**Architecture:** Factory creates enemy instances, GameBoard calls lifecycle hooks at specific points, enemies return deltas (not full state), enemies maintain internal state for timers/counters

**Tech Stack:** TypeScript, React Native, Jest for testing

---

## Design Philosophy: Factory + Composition

The enemy system uses a **factory pattern** with **lifecycle hooks** to keep GameBoard decoupled from enemy-specific logic.

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  EnemyFactory   │─────▶│  Enemy Instance  │◀─────│    GameBoard    │
│                 │      │                  │      │                 │
│ createEnemy()   │      │ Lifecycle Hooks: │      │ Calls hooks at  │
│ createDummy()   │      │ • onRoundStart   │      │ specific points │
└─────────────────┘      │ • onTick         │      │ without knowing │
                         │ • onValidMatch   │      │ enemy specifics │
                         │ • onInvalidMatch │      └─────────────────┘
                         │ • onCardDraw     │
                         │ • onCardRemove   │
                         │ • checkDefeat    │
                         └──────────────────┘
```

**Key Principles:**
1. GameBoard doesn't know anything about specific enemies
2. GameBoard only calls lifecycle methods at certain points
3. **Enemies return deltas, not full state** - avoids race conditions with React state
4. **Enemies maintain internal state** - timers, counters, etc. live inside the enemy instance
5. Factory creates fresh instances per round

**Benefits:**
- **Unit Testing:** DummyEnemy is a no-op, perfect for testing GameBoard in isolation
- **Composition:** Tier 2+ enemies compose multiple effect behaviors
- **Isolation:** Each effect type is independently testable
- **Extensibility:** New enemies just implement the interface
- **No State Conflicts:** Delta-based updates prevent React state race conditions

---

## Core Interface

```typescript
// src/types.ts

interface EnemyInstance {
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

// === DELTA-BASED RESULT TYPES ===

interface EnemyStartResult {
  cardModifications: Array<{ cardId: string; changes: Partial<Card> }>;
  events: EnemyEvent[];
}

interface EnemyTickResult {
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

  // Instant death flag
  instantDeath: boolean;
}

interface EnemyMatchResult {
  // Reward modifiers (applied to match rewards)
  timeDelta: number;  // e.g., -5 for Thieving Raven
  pointsMultiplier: number;  // e.g., 2.0 for Stinging Scorpion

  // Card changes
  cardsToRemove: string[];  // Extra cards removed (Greedy Squirrel)
  cardsToFlip: string[];  // Face-down cards that flip (70% chance already rolled)

  // Events
  events: EnemyEvent[];
}

interface EnemyUIModifiers {
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
  weaponCounters?: Array<{ type: string; reduction: number }>;  // e.g., { type: 'fire', reduction: 15 }
}

interface EnemyStatModifiers {
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

// === EVENT TYPES ===

type EnemyEvent =
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

---

## Factory Implementation

```typescript
// src/utils/enemyFactory.ts

import { EnemyInstance } from '@/types';

// Registry of all enemy constructors
const ENEMY_REGISTRY: Record<string, () => EnemyInstance> = {
  'Junk Rat': () => createJunkRat(),
  'Stalking Wolf': () => createStalkingWolf(),
  // ... all 51 enemies
};

/**
 * Create an enemy instance by name.
 * Each call returns a FRESH instance with reset internal state.
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
 * Create a no-op enemy for testing.
 * All hooks return empty deltas.
 */
export function createDummyEnemy(): EnemyInstance {
  return {
    name: 'Dummy',
    icon: 'lorc/uncertainty',
    tier: 1,
    description: 'No effect',
    defeatConditionText: 'Always defeated',

    onRoundStart: () => ({ cardModifications: [], events: [] }),
    onTick: () => ({
      scoreDelta: 0,
      healthDelta: 0,
      timeDelta: 0,
      cardsToRemove: [],
      cardModifications: [],
      cardsToFlip: [],
      events: [],
      instantDeath: false,
    }),
    onValidMatch: () => ({
      timeDelta: 0,
      pointsMultiplier: 1,
      cardsToRemove: [],
      cardsToFlip: [],
      events: [],
    }),
    onInvalidMatch: () => ({
      timeDelta: 0,
      pointsMultiplier: 1,
      cardsToRemove: [],
      cardsToFlip: [],
      events: [],
    }),
    onCardDraw: (card) => card,
    checkDefeatCondition: () => true,  // Always "defeated" for testing
    onRoundEnd: () => {},
    getUIModifiers: () => ({}),
    getStatModifiers: () => ({}),
  };
}

/**
 * Get random enemies for selection screen.
 * @param tier - Which tier to pull from
 * @param count - How many to return (default 3)
 */
export function getRandomEnemies(tier: 1 | 2 | 3 | 4, count: number = 3): EnemyInstance[] {
  const tierEnemies = Object.entries(ENEMY_REGISTRY)
    .filter(([_, factory]) => factory().tier === tier)
    .map(([_, factory]) => factory());

  return shuffleArray(tierEnemies).slice(0, count);
}
```

---

## Effect Composition (Tier 2+)

Higher tier enemies combine multiple effects using composition:

```typescript
// src/utils/enemyEffects.ts

// Base effect implementations (reusable across enemies)
interface EffectBehavior {
  onTick?: (deltaMs: number, board: Card[], internalState: any, config: any) => Partial<EnemyTickResult>;
  onValidMatch?: (cards: Card[], board: Card[], internalState: any, config: any) => Partial<EnemyMatchResult>;
  onInvalidMatch?: (cards: Card[], board: Card[], internalState: any, config: any) => Partial<EnemyMatchResult>;
  onCardDraw?: (card: Card, config: any) => Card;
  getStatModifiers?: (config: any) => Partial<EnemyStatModifiers>;
  getUIModifiers?: (internalState: any, config: any) => Partial<EnemyUIModifiers>;
}

// === INDIVIDUAL EFFECT BEHAVIORS ===

export const DudCardEffect: EffectBehavior = {
  onCardDraw: (card, config: { chance: number }) => {
    if (Math.random() * 100 < config.chance) {
      return { ...card, isDud: true };
    }
    return card;
  }
};

export const InactivityEffect: EffectBehavior = {
  onTick: (deltaMs, board, state: { timeSinceMatch: number }, config: { maxMs: number; penalty: 'damage' | 'death' }) => {
    state.timeSinceMatch += deltaMs;

    if (state.timeSinceMatch >= config.maxMs) {
      state.timeSinceMatch = 0;  // Reset after penalty
      return {
        healthDelta: config.penalty === 'damage' ? -1 : 0,
        instantDeath: config.penalty === 'death',
        events: [{ type: 'inactivity_penalty', penalty: config.penalty }],
      };
    }

    // Warning at 5 seconds remaining
    const remaining = (config.maxMs - state.timeSinceMatch) / 1000;
    if (remaining <= 5 && remaining > 4) {
      return {
        events: [{ type: 'inactivity_warning', secondsRemaining: Math.ceil(remaining) }],
      };
    }

    return {};
  },

  getUIModifiers: (state: { timeSinceMatch: number }, config: { maxMs: number; penalty: 'damage' | 'death' }) => ({
    showInactivityBar: {
      current: state.timeSinceMatch,
      max: config.maxMs,
      penalty: config.penalty,
    },
  }),
};

export const ScoreDecayEffect: EffectBehavior = {
  onTick: (deltaMs, board, state, config: { ratePerSecond: number }) => {
    const decay = (deltaMs / 1000) * config.ratePerSecond;
    return { scoreDelta: -decay };
  },

  getUIModifiers: (state, config: { ratePerSecond: number }) => ({
    showScoreDecay: { rate: config.ratePerSecond },
  }),
};

export const FaceDownEffect: EffectBehavior = {
  onCardDraw: (card, config: { chance: number }) => {
    if (Math.random() * 100 < config.chance) {
      return { ...card, isFaceDown: true };
    }
    return card;
  },

  onValidMatch: (cards, board, state, config: { flipChance: number }) => {
    // Any match triggers flip chance for ALL face-down cards on board
    const faceDownCards = board.filter(c => c.isFaceDown);
    const cardsToFlip: string[] = [];

    for (const card of faceDownCards) {
      if (Math.random() * 100 < config.flipChance) {
        cardsToFlip.push(card.id);
      }
    }

    return {
      cardsToFlip,
      events: cardsToFlip.map(id => ({ type: 'card_flipped' as const, cardId: id })),
    };
  },
};

export const CardRemovalEffect: EffectBehavior = {
  onTick: (deltaMs, board, state: { timeSinceRemoval: number }, config: { intervalMs: number; minBoardSize: number }) => {
    state.timeSinceRemoval += deltaMs;

    if (state.timeSinceRemoval >= config.intervalMs && board.length > config.minBoardSize) {
      state.timeSinceRemoval = 0;

      // Pick random card to remove
      const validCards = board.filter(c => !c.isDud);
      if (validCards.length > 0) {
        const target = validCards[Math.floor(Math.random() * validCards.length)];
        return {
          cardsToRemove: [target.id],
          events: [{ type: 'card_removed', cardId: target.id, reason: 'enemy_effect' }],
        };
      }
    }

    return {};
  },
};

export const TimerSpeedEffect: EffectBehavior = {
  getUIModifiers: (state, config: { multiplier: number }) => ({
    timerSpeedMultiplier: config.multiplier,
  }),
};

export const WeaponCounterEffect: EffectBehavior = {
  getStatModifiers: (config: { type: string; reduction: number }) => {
    const modifiers: Partial<EnemyStatModifiers> = {};

    switch (config.type) {
      case 'fire':
        modifiers.fireSpreadChanceReduction = config.reduction;
        break;
      case 'explosion':
        modifiers.explosionChanceReduction = config.reduction;
        break;
      case 'laser':
        modifiers.laserChanceReduction = config.reduction;
        break;
      case 'hint':
        modifiers.hintGainChanceReduction = config.reduction;
        break;
      case 'grace':
        modifiers.graceGainChanceReduction = config.reduction;
        break;
      case 'time':
        modifiers.timeGainChanceReduction = config.reduction;
        break;
    }

    return modifiers;
  },

  getUIModifiers: (state, config: { type: string; reduction: number }) => ({
    weaponCounters: [{ type: config.type, reduction: config.reduction }],
  }),
};

// === COMPOSITION HELPER ===

export function composeEffects(
  base: Partial<EnemyInstance>,
  effects: Array<{ behavior: EffectBehavior; config: any }>
): EnemyInstance {
  // Internal state for all effects
  const internalState: Record<string, any> = {
    timeSinceMatch: 0,
    timeSinceRemoval: 0,
    timeSinceAttributeChange: 0,
    timeSinceShuffle: 0,
  };

  return {
    ...createDummyEnemy(),
    ...base,

    onTick: (deltaMs, board) => {
      const result: EnemyTickResult = {
        scoreDelta: 0,
        healthDelta: 0,
        timeDelta: 0,
        cardsToRemove: [],
        cardModifications: [],
        cardsToFlip: [],
        events: [],
        instantDeath: false,
      };

      for (const { behavior, config } of effects) {
        if (behavior.onTick) {
          const effectResult = behavior.onTick(deltaMs, board, internalState, config);
          // Merge results
          result.scoreDelta += effectResult.scoreDelta ?? 0;
          result.healthDelta += effectResult.healthDelta ?? 0;
          result.cardsToRemove.push(...(effectResult.cardsToRemove ?? []));
          result.cardModifications.push(...(effectResult.cardModifications ?? []));
          result.cardsToFlip.push(...(effectResult.cardsToFlip ?? []));
          result.events.push(...(effectResult.events ?? []));
          result.instantDeath = result.instantDeath || (effectResult.instantDeath ?? false);
        }
      }

      return result;
    },

    onValidMatch: (matchedCards, board) => {
      // Reset inactivity timer on any match
      internalState.timeSinceMatch = 0;

      const result: EnemyMatchResult = {
        timeDelta: 0,
        pointsMultiplier: 1,
        cardsToRemove: [],
        cardsToFlip: [],
        events: [],
      };

      for (const { behavior, config } of effects) {
        if (behavior.onValidMatch) {
          const effectResult = behavior.onValidMatch(matchedCards, board, internalState, config);
          result.timeDelta += effectResult.timeDelta ?? 0;
          result.pointsMultiplier *= effectResult.pointsMultiplier ?? 1;
          result.cardsToRemove.push(...(effectResult.cardsToRemove ?? []));
          result.cardsToFlip.push(...(effectResult.cardsToFlip ?? []));
          result.events.push(...(effectResult.events ?? []));
        }
      }

      return result;
    },

    onCardDraw: (card) => {
      let modifiedCard = card;
      for (const { behavior, config } of effects) {
        if (behavior.onCardDraw) {
          modifiedCard = behavior.onCardDraw(modifiedCard, config);
        }
      }
      return modifiedCard;
    },

    getStatModifiers: () => {
      const modifiers: EnemyStatModifiers = {};
      for (const { behavior, config } of effects) {
        if (behavior.getStatModifiers) {
          Object.assign(modifiers, behavior.getStatModifiers(config));
        }
      }
      return modifiers;
    },

    getUIModifiers: () => {
      const modifiers: EnemyUIModifiers = {};
      for (const { behavior, config } of effects) {
        if (behavior.getUIModifiers) {
          const effectMods = behavior.getUIModifiers(internalState, config);
          // Merge weapon counters arrays
          if (effectMods.weaponCounters) {
            modifiers.weaponCounters = [
              ...(modifiers.weaponCounters ?? []),
              ...effectMods.weaponCounters,
            ];
          }
          Object.assign(modifiers, effectMods);
        }
      }
      return modifiers;
    },
  };
}

// === EXAMPLE: CHARGING BOAR (TIER 2) ===

export function createChargingBoar(): EnemyInstance {
  return composeEffects(
    {
      name: 'Charging Boar',
      icon: 'lorc/boar',
      tier: 2,
      description: 'Inactivity penalty + Score decay',
      defeatConditionText: 'Get 3 matches each under 8s',
    },
    [
      { behavior: InactivityEffect, config: { maxMs: 35000, penalty: 'damage' } },
      { behavior: ScoreDecayEffect, config: { ratePerSecond: 3 } },
    ]
  );
}
```

---

## Round Stats Tracking (for Defeat Conditions)

```typescript
// src/types.ts

interface RoundStats {
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
```

---

## GameBoard Integration Points

GameBoard needs minimal changes - just call enemy hooks and apply deltas:

```typescript
// In GameBoard.tsx (pseudocode showing integration points)

const GameBoard = ({ enemy, ... }) => {
  // 1. On round start
  useEffect(() => {
    if (roundStarted && enemy) {
      const { cardModifications, events } = enemy.onRoundStart(board);
      applyCardModifications(cardModifications);
      handleEnemyEvents(events);
    }
  }, [roundStarted]);

  // 2. On tick - APPLY TIMER SPEED MULTIPLIER TO TICK RATE
  const uiMods = enemy?.getUIModifiers() ?? {};
  const tickMultiplier = uiMods.timerSpeedMultiplier ?? 1;

  useGameTimer(isActive, (realDeltaMs) => {
    // Scale delta by speed multiplier - this makes EVERYTHING faster
    const scaledDelta = realDeltaMs * tickMultiplier;

    // Update game timer
    setRemainingTime(prev => prev - scaledDelta);

    // Call enemy tick with scaled delta
    if (enemy) {
      const result = enemy.onTick(scaledDelta, board);

      // Apply deltas
      setScore(prev => Math.max(0, prev + result.scoreDelta));
      if (result.healthDelta !== 0) {
        setHealth(prev => prev + result.healthDelta);
      }
      if (result.instantDeath) {
        triggerGameOver('instant_death');
      }

      // Remove cards (respecting minimum board size)
      if (result.cardsToRemove.length > 0) {
        removeCardsFromBoard(result.cardsToRemove);  // No replacement
      }

      // Flip face-down cards
      if (result.cardsToFlip.length > 0) {
        flipCards(result.cardsToFlip);
      }

      handleEnemyEvents(result.events);
    }
  });

  // 3. On valid match - apply deltas
  const handleValidMatch = (cards, baseRewards) => {
    if (enemy) {
      const result = enemy.onValidMatch(cards, board);

      // Apply reward modifiers
      const modifiedRewards = {
        ...baseRewards,
        timeBonus: (baseRewards.timeBonus ?? 0) + result.timeDelta,
        points: (baseRewards.points ?? 0) * result.pointsMultiplier,
      };

      // Remove extra cards (Greedy Squirrel) - no replacement
      if (result.cardsToRemove.length > 0) {
        removeCardsFromBoard(result.cardsToRemove);
      }

      // Flip face-down cards (70% chance already calculated)
      if (result.cardsToFlip.length > 0) {
        flipCards(result.cardsToFlip);
      }

      handleEnemyEvents(result.events);
      return modifiedRewards;
    }
    return baseRewards;
  };

  // 4. On card draw (when replacing matched cards only - not removed cards)
  const drawNewCard = (baseCard) => {
    return enemy ? enemy.onCardDraw(baseCard) : baseCard;
  };

  // 5. Apply stat modifiers to weapon effects
  const effectiveStats = useMemo(() => {
    const baseStats = calculatePlayerTotalStats(player);
    const modifiers = enemy?.getStatModifiers() ?? {};

    return {
      ...baseStats,
      fireSpreadChance: Math.max(0, baseStats.fireSpreadChance - (modifiers.fireSpreadChanceReduction ?? 0)),
      explosionChance: Math.max(0, baseStats.explosionChance - (modifiers.explosionChanceReduction ?? 0)),
      laserChance: Math.max(0, baseStats.laserChance - (modifiers.laserChanceReduction ?? 0)),
      // ... etc
    };
  }, [player, enemy]);

  // 6. Card selection - BLOCK FACE-DOWN CARDS
  const handleCardSelect = (card) => {
    if (card.isDud || card.isFaceDown) {
      return;  // Cannot select dud or face-down cards
    }
    // ... normal selection logic
  };

  // 7. Render UI modifiers
  return (
    <>
      {uiMods.showInactivityBar && <InactivityBar {...uiMods.showInactivityBar} />}
      {uiMods.showScoreDecay && <ScoreDecayIndicator rate={uiMods.showScoreDecay.rate} />}
      {uiMods.timerSpeedMultiplier && uiMods.timerSpeedMultiplier !== 1 && (
        <TimerSpeedBadge multiplier={uiMods.timerSpeedMultiplier} />
      )}
      {uiMods.weaponCounters?.map(counter => (
        <WeaponCounterBadge key={counter.type} {...counter} />
      ))}
      {/* ... rest of board */}
    </>
  );
};
```

---

## Key Implementation Rules

### 1. Card Removal Behavior
- Removed cards (Burrowing Mole, Greedy Squirrel, etc.) are **NOT replaced**
- Board shrinks permanently for that round
- **Minimum board size: 6 cards** - stop removing when at 6
- This creates real tension for card-removal enemies

### 2. Face-Down Card Behavior
- Face-down cards **cannot be selected**
- Face-down cards **cannot be matched**
- Any valid match triggers **70% flip chance for EACH face-down card** on the entire board
- Flipping is visual - card attributes were always there, just hidden

### 3. Timer Speed Multiplier
- `timerSpeedMultiplier` affects **actual game tick rate**
- A 1.2x multiplier means 1 real second = 1.2 game seconds
- This affects: timer countdown, score decay, bomb timers, burn timers, everything
- UI should show the speed multiplier badge (e.g., "1.2x")

### 4. Dud Card Behavior
- Dud cards **cannot be selected**
- Dud cards **cannot be matched**
- Dud cards are visually distinct (white/blank, grayed out)
- Duds count toward board size but are effectively dead space

### 5. Enemy Internal State
- Enemies maintain their own timers/counters internally
- Factory creates fresh instances per round (state resets)
- GameBoard passes events (match happened) so enemy can reset timers
- No enemy state in GameState - keeps it clean

---

## Testing Strategy

```typescript
// __tests__/enemyEffects.test.ts

describe('DudCardEffect', () => {
  it('should create dud card at configured chance', () => {
    const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.01);
    const card = createTestCard();
    const result = DudCardEffect.onCardDraw!(card, { chance: 4 });
    expect(result.isDud).toBe(true);
    mockRandom.mockRestore();
  });

  it('should not create dud when roll fails', () => {
    const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.99);
    const card = createTestCard();
    const result = DudCardEffect.onCardDraw!(card, { chance: 4 });
    expect(result.isDud).toBeUndefined();
    mockRandom.mockRestore();
  });
});

describe('FaceDownEffect', () => {
  it('should trigger flip chance for ALL face-down cards on any match', () => {
    const mockRandom = jest.spyOn(Math, 'random').mockReturnValue(0.5);  // 50% < 70%
    const board = [
      createTestCard('1', { isFaceDown: true }),
      createTestCard('2', { isFaceDown: true }),
      createTestCard('3', { isFaceDown: false }),
    ];
    const matched = [board[2]];  // Match a non-face-down card

    const result = FaceDownEffect.onValidMatch!(matched, board, {}, { flipChance: 70 });

    // Both face-down cards should flip (50% < 70%)
    expect(result.cardsToFlip).toContain('1');
    expect(result.cardsToFlip).toContain('2');
    mockRandom.mockRestore();
  });
});

describe('CardRemovalEffect', () => {
  it('should not remove cards below minimum board size', () => {
    const board = Array(6).fill(null).map((_, i) => createTestCard(String(i)));
    const state = { timeSinceRemoval: 20000 };

    const result = CardRemovalEffect.onTick!(1000, board, state, { intervalMs: 20000, minBoardSize: 6 });

    expect(result.cardsToRemove).toEqual([]);
  });
});

describe('Junk Rat (full enemy)', () => {
  it('should have correct metadata', () => {
    const enemy = createEnemy('Junk Rat');
    expect(enemy.name).toBe('Junk Rat');
    expect(enemy.tier).toBe(1);
  });

  it('should check defeat condition: 4-match streak', () => {
    const enemy = createEnemy('Junk Rat');
    expect(enemy.checkDefeatCondition({ ...emptyStats, maxStreak: 3 })).toBe(false);
    expect(enemy.checkDefeatCondition({ ...emptyStats, maxStreak: 4 })).toBe(true);
  });
});

describe('GameBoard with DummyEnemy', () => {
  it('should render and play normally with no enemy effects', () => {
    const { getByTestId } = render(
      <GameBoard enemy={createDummyEnemy()} ... />
    );
    // Test normal gameplay without enemy interference
  });
});

describe('Charging Boar (composed enemy)', () => {
  it('should apply both inactivity tracking and score decay', () => {
    const enemy = createEnemy('Charging Boar');
    const board = createTestBoard();

    // Simulate 1 second passing
    const result = enemy.onTick(1000, board);

    // Score should decay by 3 (3pts/sec)
    expect(result.scoreDelta).toBe(-3);
  });

  it('should reset inactivity timer on valid match', () => {
    const enemy = createEnemy('Charging Boar');
    const board = createTestBoard();

    // Simulate 30 seconds of inactivity
    enemy.onTick(30000, board);

    // Make a match
    enemy.onValidMatch([board[0], board[1], board[2]], board);

    // Check UI modifiers - timer should be reset
    const uiMods = enemy.getUIModifiers();
    expect(uiMods.showInactivityBar?.current).toBe(0);
  });
});
```

---

## New Card States Required

| State | Visual | Behavior | Used By |
|-------|--------|----------|---------|
| **isDud** | White/blank card, grayed out | Cannot be selected or matched | Junk Rat, Prowling Direwolf, Feral Fangs, Kraken's Grasp |
| **isFaceDown** | Card back (? symbol) | Cannot be selected; any match triggers 70% flip chance for all face-down cards | Night Owl, Lurking Shark, Abyssal Octopus, Nightmare Squid, The Hydra |
| **health > 1** | Health pips (●●● → ●● → ●) | Needs multiple matches to clear | Iron Shell, Hunting Eagle, Feral Fangs, Stone Sentinel, Ancient Dragon |
| **hasBomb** | Bomb icon + countdown | Explodes if not matched in time; card is removed | Trap Weaver, Venomous Cobra, Savage Claws, Swarming Ants, The Hydra |
| **hasCountdown** | Urgent countdown timer | Lose HP if not matched in time | Ticking Viper, Lurking Shark, Abyssal Octopus, Swarming Ants, The Hydra |

---

## New UI Elements Required

| Element | Description | Used By |
|---------|-------------|---------|
| **Inactivity Bar** | Progress bar showing time until penalty, with damage/death icon | Stalking Wolf, Charging Boar, Raging Bear, Merciless Porcupine, The Hydra, World Eater |
| **Score Decay Indicator** | "-X/sec" badge near score | Circling Vulture, Charging Boar, Raging Bear, Nightmare Squid, Ancient Dragon, The Reaper |
| **Timer Speed Indicator** | "1.2x" badge near timer (actual tick rate multiplied) | Swift Bee, Diving Hawk, Savage Claws, Ravenous Tapir, Ancient Dragon, World Eater |
| **Disabled Hints Badge** | Crossed-out hint icon | Masked Bandit, Creeping Shadow, One-Eyed Terror, The Reaper |
| **Weapon Counter Badge** | Shows debuffed weapon type and reduction % | Wet Crab, Spiny Hedgehog, Shadow Bat, Foggy Frog, Sneaky Mouse, Lazy Sloth, etc. |
| **Enemy Portrait** | Small icon showing active enemy | All enemies |
| **Defeat Progress** | Shows progress toward defeat condition | All enemies |

---

## Files to Create/Modify

### New Files
1. `src/types/enemy.ts` - EnemyInstance, EnemyTickResult, etc.
2. `src/utils/enemyFactory.ts` - createEnemy(), createDummyEnemy(), getRandomEnemies()
3. `src/utils/enemyEffects.ts` - Effect behaviors and composeEffects()
4. `src/utils/enemies/tier1.ts` - All 22 Tier 1 enemy implementations
5. `src/utils/enemies/tier2.ts` - All 12 Tier 2 enemy implementations
6. `src/utils/enemies/tier3.ts` - All 12 Tier 3 enemy implementations
7. `src/utils/enemies/tier4.ts` - All 5 Tier 4 boss implementations
8. `src/components/EnemySelection.tsx` - Pre-round enemy selection UI
9. `src/components/enemy-ui/InactivityBar.tsx` - Inactivity progress bar
10. `src/components/enemy-ui/ScoreDecayIndicator.tsx` - Score decay badge
11. `src/components/enemy-ui/TimerSpeedBadge.tsx` - Timer speed multiplier badge
12. `src/components/enemy-ui/WeaponCounterBadge.tsx` - Weapon counter indicator
13. `src/components/enemy-ui/EnemyPortrait.tsx` - Active enemy display
14. `src/components/enemy-ui/DefeatProgress.tsx` - Defeat condition progress
15. `__tests__/enemyEffects.test.ts` - Effect behavior unit tests
16. `__tests__/enemies.test.ts` - Full enemy integration tests

### Modified Files
1. `src/types.ts` - Add Card.isDud, Card.isFaceDown, Card.hasCountdown, Card.hasBomb
2. `src/components/Game.tsx` - Pass enemy to GameBoard, handle enemy selection phase
3. `src/components/GameBoard.tsx` - Call enemy lifecycle hooks, apply deltas
4. `src/components/Card.tsx` - Render dud cards, face-down cards, bomb/countdown overlays
5. `src/components/LevelUp.tsx` - Show "Slayer Reward" bonus weapon if enemy defeated
