# Ralph Fix Plan

# Enemy System Implementation TODO

> **For Claude:** Check off tasks with `[x]` as you complete them. Follow TDD: write tests first, implement, verify tests pass.

You MUST commit the code once the unit tests and integration tests are passing between each section, like "Section 1: Foundation - Core Types & Interfaces".

---

## Section 1: Foundation - Core Types & Interfaces ✅ COMPLETED

### 1.1 Unit Tests for Types
- [x] Create `__tests__/enemyTypes.test.ts`
- [x] Write type assertion tests for `EnemyInstance` interface
- [x] Write type assertion tests for `EnemyTickResult` interface
- [x] Write type assertion tests for `EnemyMatchResult` interface
- [x] Write type assertion tests for `EnemyUIModifiers` interface
- [x] Write type assertion tests for `EnemyStatModifiers` interface
- [x] Write type assertion tests for `EnemyEvent` union type
- [x] Write type assertion tests for `RoundStats` interface

### 1.2 Implementation
- [x] Create `src/types/enemy.ts`
- [x] Define `EnemyInstance` interface
- [x] Define `EnemyTickResult` interface (delta-based)
- [x] Define `EnemyMatchResult` interface (delta-based)
- [x] Define `EnemyStartResult` interface
- [x] Define `EnemyUIModifiers` interface
- [x] Define `EnemyStatModifiers` interface
- [x] Define `EnemyEvent` union type (all event types)
- [x] Define `RoundStats` interface
- [x] Export all types from `src/types/index.ts`

### 1.3 Card Type Extensions
- [x] Add `isDud?: boolean` to Card interface in `src/types.ts`
- [x] Add `isFaceDown?: boolean` to Card interface
- [x] Add `hasCountdown?: boolean` to Card interface
- [x] Add `countdownTimer?: number` to Card interface
- [x] Add `hasBomb?: boolean` to Card interface (if not using existing `bomb` property)

### 1.4 Verification
- [x] Committed at v0.1.3 (ce5637d)

---

## Section 2: Enemy Factory & Dummy Enemy ✅ COMPLETED

### 2.1 Unit Tests
- [x] Create `__tests__/enemyFactory.test.ts`
- [x] Test: `createDummyEnemy()` returns valid EnemyInstance
- [x] Test: `createDummyEnemy().onRoundStart()` returns empty result
- [x] Test: `createDummyEnemy().onTick()` returns zero deltas
- [x] Test: `createDummyEnemy().onValidMatch()` returns zero deltas
- [x] Test: `createDummyEnemy().onInvalidMatch()` returns zero deltas
- [x] Test: `createDummyEnemy().onCardDraw()` returns unmodified card
- [x] Test: `createDummyEnemy().checkDefeatCondition()` returns true
- [x] Test: `createDummyEnemy().getUIModifiers()` returns empty object
- [x] Test: `createDummyEnemy().getStatModifiers()` returns empty object
- [x] Test: `createEnemy('Unknown')` returns dummy enemy with warning
- [x] Test: `getRandomEnemies(tier, count)` returns correct count

### 2.2 Implementation
- [x] Create `src/utils/enemyFactory.ts`
- [x] Implement `createDummyEnemy()` function
- [x] Implement `ENEMY_REGISTRY` (empty initially, will populate)
- [x] Implement `createEnemy(name)` function with fallback to dummy
- [x] Implement `getRandomEnemies(tier, count)` function
- [x] Export factory functions
- [x] Additional: `registerEnemy`, `isEnemyRegistered`, `getEnemyNames`, `getEnemiesByTier`

### 2.3 Verification
- [x] Committed at e7b8eb4

---

## Section 3: Reusable Effect Behaviors

### 3.1 Unit Tests
- [ ] Create `__tests__/enemyEffects.test.ts`

#### DudCardEffect Tests
- [ ] Test: creates dud when random < chance
- [ ] Test: does not create dud when random >= chance
- [ ] Test: works at 0% chance (never dud)
- [ ] Test: works at 100% chance (always dud)

#### InactivityEffect Tests
- [ ] Test: tracks time since match correctly
- [ ] Test: triggers damage penalty at threshold
- [ ] Test: triggers instant death at threshold when configured
- [ ] Test: resets timer when match occurs
- [ ] Test: emits warning event at 5 seconds remaining
- [ ] Test: returns correct UI modifiers for inactivity bar

#### ScoreDecayEffect Tests
- [ ] Test: decays score by correct amount per tick
- [ ] Test: does not decay below 0
- [ ] Test: returns correct UI modifiers for decay indicator

#### FaceDownEffect Tests
- [ ] Test: creates face-down card when random < chance
- [ ] Test: any match triggers flip roll for ALL face-down cards
- [ ] Test: flips card when random < flipChance
- [ ] Test: does not flip when random >= flipChance
- [ ] Test: multiple face-down cards each get independent roll

#### CardRemovalEffect Tests
- [ ] Test: removes card at interval
- [ ] Test: does not remove when board at minimum size (6)
- [ ] Test: resets removal timer after removal
- [ ] Test: emits card_removed event

#### TimerSpeedEffect Tests
- [ ] Test: returns correct timerSpeedMultiplier in UI modifiers

#### WeaponCounterEffect Tests
- [ ] Test: returns correct stat reduction for fire
- [ ] Test: returns correct stat reduction for explosion
- [ ] Test: returns correct stat reduction for laser
- [ ] Test: returns correct stat reduction for hints
- [ ] Test: returns correct stat reduction for graces
- [ ] Test: returns correct stat reduction for time
- [ ] Test: returns correct UI modifier with counter badge info

#### AttributeChangeEffect Tests
- [ ] Test: changes attribute at interval
- [ ] Test: emits attribute_changed event with affected card IDs
- [ ] Test: resets timer after change

#### PositionShuffleEffect Tests
- [ ] Test: shuffles positions at interval
- [ ] Test: emits positions_shuffled event
- [ ] Test: resets timer after shuffle

#### TimeStealEffect Tests
- [ ] Test: returns negative timeDelta on match

#### DamageMultiplierEffect Tests
- [ ] Test: returns correct damage multiplier in stat modifiers

#### PointsMultiplierEffect Tests
- [ ] Test: returns correct points multiplier on match

#### BombEffect Tests
- [ ] Test: places bombs on round start
- [ ] Test: decrements bomb timers on tick
- [ ] Test: emits bomb_exploded and removes card when timer reaches 0
- [ ] Test: tracks bombs defused when matched

#### CountdownEffect Tests
- [ ] Test: places countdown on cards at interval
- [ ] Test: decrements countdown timers on tick
- [ ] Test: emits countdown_expired and damages player when timer reaches 0
- [ ] Test: clears countdown when card is matched

#### TripleCardEffect Tests
- [ ] Test: places 3-health cards on round start
- [ ] Test: reduces health when matched
- [ ] Test: only clears when health reaches 0

#### HintDisableEffect Tests
- [ ] Test: returns disableAutoHint in UI modifiers
- [ ] Test: returns disableManualHint in UI modifiers

### 3.2 Implementation
- [ ] Create `src/utils/enemyEffects.ts`
- [ ] Implement `DudCardEffect`
- [ ] Implement `InactivityEffect`
- [ ] Implement `ScoreDecayEffect`
- [ ] Implement `FaceDownEffect`
- [ ] Implement `CardRemovalEffect`
- [ ] Implement `TimerSpeedEffect`
- [ ] Implement `WeaponCounterEffect`
- [ ] Implement `AttributeChangeEffect`
- [ ] Implement `PositionShuffleEffect`
- [ ] Implement `TimeStealEffect`
- [ ] Implement `DamageMultiplierEffect`
- [ ] Implement `PointsMultiplierEffect`
- [ ] Implement `BombEffect`
- [ ] Implement `CountdownEffect`
- [ ] Implement `TripleCardEffect`
- [ ] Implement `HintDisableEffect`
- [ ] Implement `composeEffects()` helper function

### 3.3 Verification
- [ ] Run `npm test __tests__/enemyEffects.test.ts` - all tests pass
- [ ] Run `npm run typecheck` - no errors

---

(Remaining sections for individual enemies follow in the original plan...)
