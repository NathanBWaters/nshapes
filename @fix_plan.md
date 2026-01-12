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

## Section 3: Reusable Effect Behaviors ✅ COMPLETED

### 3.1 Unit Tests
- [x] Create `__tests__/enemyEffects.test.ts`

#### DudCardEffect Tests
- [x] Test: creates dud when random < chance
- [x] Test: does not create dud when random >= chance
- [x] Test: works at 0% chance (never dud)
- [x] Test: works at 100% chance (always dud)

#### InactivityEffect Tests
- [x] Test: tracks time since match correctly
- [x] Test: triggers damage penalty at threshold
- [x] Test: triggers instant death at threshold when configured
- [x] Test: resets timer when match occurs
- [x] Test: emits warning event at 5 seconds remaining
- [x] Test: returns correct UI modifiers for inactivity bar

#### ScoreDecayEffect Tests
- [x] Test: decays score by correct amount per tick
- [x] Test: does not decay below 0 (handled in GameBoard)
- [x] Test: returns correct UI modifiers for decay indicator

#### FaceDownEffect Tests
- [x] Test: creates face-down card when random < chance
- [x] Test: any match triggers flip roll for ALL face-down cards
- [x] Test: flips card when random < flipChance
- [x] Test: does not flip when random >= flipChance
- [x] Test: multiple face-down cards each get independent roll

#### CardRemovalEffect Tests
- [x] Test: removes card at interval
- [x] Test: does not remove when board at minimum size (6)
- [x] Test: resets removal timer after removal
- [x] Test: emits card_removed event

#### TimerSpeedEffect Tests
- [x] Test: returns correct timerSpeedMultiplier in UI modifiers

#### WeaponCounterEffect Tests
- [x] Test: returns correct stat reduction for fire
- [x] Test: returns correct stat reduction for explosion
- [x] Test: returns correct stat reduction for laser
- [x] Test: returns correct stat reduction for hints
- [x] Test: returns correct stat reduction for graces
- [x] Test: returns correct stat reduction for time
- [x] Test: returns correct stat reduction for healing
- [x] Test: returns correct UI modifier with counter badge info

#### PositionShuffleEffect Tests
- [x] Test: shuffles positions at interval
- [x] Test: emits positions_shuffled event
- [x] Test: resets timer after shuffle

#### TimeStealEffect Tests
- [x] Test: returns negative timeDelta on match

#### DamageMultiplierEffect Tests
- [x] Test: returns correct damage multiplier in stat modifiers

#### PointsMultiplierEffect Tests
- [x] Test: returns correct points multiplier on match
- [x] Test: returns correct points multiplier in stat modifiers

#### HintDisableEffect Tests
- [x] Test: returns disableAutoHint in UI modifiers
- [x] Test: returns disableManualHint in UI modifiers

#### ExtraCardRemovalOnMatchEffect Tests
- [x] Test: removes extra cards on valid match
- [x] Test: respects minimum board size

#### composeEffects Tests
- [x] Test: composes multiple effects into a single enemy
- [x] Test: merges onTick results from multiple effects
- [x] Test: merges UI modifiers from multiple effects
- [x] Test: merges stat modifiers from multiple effects
- [x] Test: chains onCardDraw through multiple effects
- [x] Test: resets inactivity timer on valid match
- [x] Test: uses custom defeat condition when provided
- [x] Test: resets internal state on onRoundStart

### 3.2 Implementation
- [x] Create `src/utils/enemyEffects.ts`
- [x] Implement `DudCardEffect`
- [x] Implement `InactivityEffect`
- [x] Implement `ScoreDecayEffect`
- [x] Implement `FaceDownEffect`
- [x] Implement `CardRemovalEffect`
- [x] Implement `TimerSpeedEffect`
- [x] Implement `WeaponCounterEffect`
- [x] Implement `PositionShuffleEffect`
- [x] Implement `TimeStealEffect`
- [x] Implement `DamageMultiplierEffect`
- [x] Implement `PointsMultiplierEffect`
- [x] Implement `HintDisableEffect`
- [x] Implement `ExtraCardRemovalOnMatchEffect`
- [x] Implement `ExtraCardRemovalOnInvalidEffect`
- [x] Implement `composeEffects()` helper function

### 3.3 Verification
- [x] Run `npm test __tests__/enemyEffects.test.ts` - all 54 tests pass
- [x] Committed at 50febd0

### 3.4 Note on Unimplemented Effects
The following effects from the spec were not implemented in Section 3 as they require more complex state tracking that will be implemented when specific enemies need them:
- `AttributeChangeEffect` - For enemies like Chameleon Snake that change card attributes
- `BombEffect` - For enemies like Trap Weaver that place bombs
- `CountdownEffect` - For enemies like Ticking Viper with countdown timers
- `TripleCardEffect` - For enemies like Iron Shell with multi-hit cards

These will be implemented as part of the individual enemy implementations in Section 4+.

---

## Section 4: Tier 1 Enemies (22 total)

### 4.1 Junk Rat ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/junkRat.ts`
- [x] Implement createJunkRat() using composeEffects
- [x] Effect: 4% dud chance on card draw
- [x] Defeat condition: Get a 4-match streak
- [x] Create `__tests__/enemies/tier1/junkRat.test.ts`
- [x] Tests passing

### 4.2 Stalking Wolf ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/stalkingWolf.ts`
- [x] Implement createStalkingWolf() using composeEffects
- [x] Effect: 45s inactivity → lose 1 health
- [x] Defeat condition: Match 3 times in under 5s each
- [x] Create `__tests__/enemies/tier1/stalkingWolf.test.ts`
- [x] Tests passing (18 tests)

### 4.3 Shifting Chameleon
- [ ] Create `src/utils/enemies/tier1/shiftingChameleon.ts`
- [ ] Implement AttributeChangeEffect (new effect needed)
- [ ] Effect: Changes 1 attribute on random cards every 20s
- [ ] Defeat condition: Get 2 all-different matches
- [ ] Tests passing

### 4.4 Burrowing Mole ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/burrowingMole.ts`
- [x] Effect: Removes 1 random card every 20s
- [x] Defeat condition: Match all 3 shapes at least once
- [x] Tests passing (16 tests)

### 4.5 Masked Bandit ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/maskedBandit.ts`
- [x] Effect: Disables auto-hints entirely
- [x] Defeat condition: Get 3 matches without hesitating >10s
- [x] Tests passing (17 tests)

### 4.6 Wild Goose ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/wildGoose.ts`
- [x] Effect: Shuffles card positions every 30s
- [x] Defeat condition: Match 2 sets that share a card attribute
- [x] Tests passing (10 tests)

### 4.7 Thieving Raven ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/thievingRaven.ts`
- [x] Effect: -5s stolen per match
- [x] Defeat condition: Complete 5 matches total
- [x] Tests passing (9 tests)

### 4.8 Stinging Scorpion ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/stingingScorpion.ts`
- [x] Effect: 2x damage taken, 2x points earned
- [x] Defeat condition: Make no invalid matches
- [x] Tests passing (9 tests)

### 4.9-4.22 (Remaining Tier 1 enemies)
TODO: Add as individual subsections when starting implementation
- Shifting Chameleon (needs AttributeChangeEffect)
- Night Owl (needs FaceDownEffect - already implemented)
- Swift Bee (needs TimerSpeedEffect - already implemented)
- Trap Weaver (needs BombEffect - complex)
- Circling Vulture (ScoreDecayEffect - already implemented)
- Iron Shell (needs TripleCardEffect - complex)
- Ticking Viper (needs CountdownEffect - complex)
- Wet Crab, Spiny Hedgehog, Shadow Bat, Foggy Frog, Sneaky Mouse, Lazy Sloth (WeaponCounterEffect - already implemented)
- Greedy Squirrel (ExtraCardRemovalOnMatchEffect - already implemented)
- Punishing Ermine (ExtraCardRemovalOnInvalidEffect - already implemented)

---

## Section 5: Tier 2 Enemies (12 total)
TODO: Add when Section 4 is complete

---

## Section 6: Tier 3 Enemies (12 total)
TODO: Add when Section 5 is complete

---

## Section 7: Tier 4 Bosses (5 total)
TODO: Add when Section 6 is complete

---

## Section 8: GameBoard Integration
TODO: Add enemy lifecycle hook calls to GameBoard.tsx

---

## Section 9: Enemy Selection Screen
TODO: Add pre-round enemy selection UI
