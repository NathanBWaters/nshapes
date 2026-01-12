# Ralph Fix Plan

# Enemy System Implementation TODO

> **For Claude:** Check off tasks with `[x]` as you complete them. Follow TDD: write tests first, implement, verify tests pass.

You MUST commit the code once the unit tests and integration tests are passing between each section, like "Section 1: Foundation - Core Types & Interfaces".

---

## Section 1: Foundation - Core Types & Interfaces

### 1.1 Unit Tests for Types
- [ ] Create `__tests__/enemyTypes.test.ts`
- [ ] Write type assertion tests for `EnemyInstance` interface
- [ ] Write type assertion tests for `EnemyTickResult` interface
- [ ] Write type assertion tests for `EnemyMatchResult` interface
- [ ] Write type assertion tests for `EnemyUIModifiers` interface
- [ ] Write type assertion tests for `EnemyStatModifiers` interface
- [ ] Write type assertion tests for `EnemyEvent` union type
- [ ] Write type assertion tests for `RoundStats` interface

### 1.2 Implementation
- [ ] Create `src/types/enemy.ts`
- [ ] Define `EnemyInstance` interface
- [ ] Define `EnemyTickResult` interface (delta-based)
- [ ] Define `EnemyMatchResult` interface (delta-based)
- [ ] Define `EnemyStartResult` interface
- [ ] Define `EnemyUIModifiers` interface
- [ ] Define `EnemyStatModifiers` interface
- [ ] Define `EnemyEvent` union type (all event types)
- [ ] Define `RoundStats` interface
- [ ] Export all types from `src/types/index.ts`

### 1.3 Card Type Extensions
- [ ] Add `isDud?: boolean` to Card interface in `src/types.ts`
- [ ] Add `isFaceDown?: boolean` to Card interface
- [ ] Add `hasCountdown?: boolean` to Card interface
- [ ] Add `countdownTimer?: number` to Card interface
- [ ] Add `hasBomb?: boolean` to Card interface (if not using existing `bomb` property)

### 1.4 Verification
- [ ] Run `npm run typecheck` - all type errors resolved
- [ ] Run `npm test __tests__/enemyTypes.test.ts` - all tests pass

---

## Section 2: Enemy Factory & Dummy Enemy

### 2.1 Unit Tests
- [ ] Create `__tests__/enemyFactory.test.ts`
- [ ] Test: `createDummyEnemy()` returns valid EnemyInstance
- [ ] Test: `createDummyEnemy().onRoundStart()` returns empty result
- [ ] Test: `createDummyEnemy().onTick()` returns zero deltas
- [ ] Test: `createDummyEnemy().onValidMatch()` returns zero deltas
- [ ] Test: `createDummyEnemy().onInvalidMatch()` returns zero deltas
- [ ] Test: `createDummyEnemy().onCardDraw()` returns unmodified card
- [ ] Test: `createDummyEnemy().checkDefeatCondition()` returns true
- [ ] Test: `createDummyEnemy().getUIModifiers()` returns empty object
- [ ] Test: `createDummyEnemy().getStatModifiers()` returns empty object
- [ ] Test: `createEnemy('Unknown')` returns dummy enemy with warning
- [ ] Test: `getRandomEnemies(tier, count)` returns correct count

### 2.2 Implementation
- [ ] Create `src/utils/enemyFactory.ts`
- [ ] Implement `createDummyEnemy()` function
- [ ] Implement `ENEMY_REGISTRY` (empty initially, will populate)
- [ ] Implement `createEnemy(name)` function with fallback to dummy
- [ ] Implement `getRandomEnemies(tier, count)` function
- [ ] Export factory functions

### 2.3 Verification
- [ ] Run `npm test __tests__/enemyFactory.test.ts` - all tests pass
- [ ] Run `npm run typecheck` - no errors

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
- [ ] Test: places countdown card on round start
- [ ] Test: decrements countdown on tick
- [ ] Test: emits countdown_expired and damages player when timer reaches 0
- [ ] Test: tracks countdown matched when card is in matched set

#### ExtraCardRemovalOnMatchEffect Tests
- [ ] Test: removes extra cards on valid match
- [ ] Test: respects minimum board size

#### ExtraCardRemovalOnInvalidEffect Tests
- [ ] Test: removes extra cards on invalid match
- [ ] Test: respects minimum board size

#### composeEffects Tests
- [ ] Test: combines multiple effect behaviors correctly
- [ ] Test: merges tick results from multiple effects
- [ ] Test: merges match results from multiple effects
- [ ] Test: chains onCardDraw through multiple effects
- [ ] Test: merges stat modifiers from multiple effects
- [ ] Test: merges UI modifiers from multiple effects

### 3.2 Implementation
- [ ] Create `src/utils/enemyEffects.ts`
- [ ] Define `EffectBehavior` interface
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
- [ ] Implement `ExtraCardRemovalOnMatchEffect`
- [ ] Implement `ExtraCardRemovalOnInvalidEffect`
- [ ] Implement `DisableHintsEffect`
- [ ] Implement `TripleCardEffect` (multi-health card)
- [ ] Implement `composeEffects()` function
- [ ] Export all effects and compose function

### 3.3 Verification
- [ ] Run `npm test __tests__/enemyEffects.test.ts` - all tests pass
- [ ] Run `npm run typecheck` - no errors

---

## Section 4: Round Stats Tracking

### 4.1 Unit Tests
- [ ] Create `__tests__/roundStats.test.ts`
- [ ] Test: `createEmptyRoundStats()` returns correct initial values
- [ ] Test: `updateStatsOnMatch()` increments totalMatches
- [ ] Test: `updateStatsOnMatch()` increments currentStreak
- [ ] Test: `updateStatsOnMatch()` updates maxStreak if needed
- [ ] Test: `updateStatsOnMatch()` adds matchTime to matchTimes array
- [ ] Test: `updateStatsOnMatch()` updates shapesMatched set
- [ ] Test: `updateStatsOnMatch()` updates colorsMatched set
- [ ] Test: `updateStatsOnMatch()` increments allDifferentMatches when all different
- [ ] Test: `updateStatsOnMatch()` increments allSameColorMatches when applicable
- [ ] Test: `updateStatsOnMatch()` increments squiggleMatches when squiggle in set
- [ ] Test: `updateStatsOnInvalidMatch()` increments invalidMatches
- [ ] Test: `updateStatsOnInvalidMatch()` resets currentStreak to 0
- [ ] Test: `updateStatsOnGraceUsed()` increments gracesUsed
- [ ] Test: `updateStatsOnWeaponEffect()` adds to weaponEffectsTriggered set
- [ ] Test: `updateStatsOnDamage()` increments damageReceived

### 4.2 Implementation
- [ ] Create `src/utils/roundStats.ts`
- [ ] Implement `createEmptyRoundStats()` function
- [ ] Implement `updateStatsOnMatch()` function
- [ ] Implement `updateStatsOnInvalidMatch()` function
- [ ] Implement `updateStatsOnGraceUsed()` function
- [ ] Implement `updateStatsOnWeaponEffect()` function
- [ ] Implement `updateStatsOnDamage()` function
- [ ] Implement `updateStatsOnBombDefused()` function
- [ ] Implement `updateStatsOnTripleCardCleared()` function
- [ ] Implement `updateStatsOnFaceDownMatched()` function
- [ ] Implement `updateStatsOnCountdownMatched()` function
- [ ] Export all functions

### 4.3 Verification
- [ ] Run `npm test __tests__/roundStats.test.ts` - all tests pass
- [ ] Run `npm run typecheck` - no errors

---

## Section 5: Card State Rendering

### 5.1 Unit Tests
- [ ] Add tests to `__tests__/Card.test.tsx` (create if needed)
- [ ] Test: Dud card renders with dud visual (white/blank)
- [ ] Test: Dud card cannot be selected (onPress does nothing)
- [ ] Test: Face-down card renders with card back (? symbol)
- [ ] Test: Face-down card cannot be selected
- [ ] Test: Bomb card renders with bomb icon and timer
- [ ] Test: Countdown card renders with countdown timer
- [ ] Test: Multi-health card renders with health pips

### 5.2 Implementation
- [ ] Update `src/components/Card.tsx` to render dud state
- [ ] Update `src/components/Card.tsx` to render face-down state
- [ ] Update `src/components/Card.tsx` to block selection for dud/face-down
- [ ] Update `src/components/Card.tsx` to render bomb overlay
- [ ] Update `src/components/Card.tsx` to render countdown overlay
- [ ] Update `src/components/Card.tsx` health pips (may already exist)
- [ ] Add flip animation for face-down cards

### 5.3 Verification
- [ ] Run card-related tests - all pass
- [ ] Run `npm run typecheck` - no errors
- [ ] Manual visual verification in `/dev/play`

---

## Section 6: Enemy UI Components

### 6.1 Unit Tests
- [ ] Create `__tests__/enemyUI.test.tsx`
- [ ] Test: InactivityBar renders with correct progress
- [ ] Test: InactivityBar shows damage icon when penalty is 'damage'
- [ ] Test: InactivityBar shows skull icon when penalty is 'death'
- [ ] Test: ScoreDecayIndicator shows correct rate
- [ ] Test: TimerSpeedBadge shows correct multiplier
- [ ] Test: WeaponCounterBadge shows correct type and reduction
- [ ] Test: EnemyPortrait renders correct icon
- [ ] Test: DefeatProgress shows correct progress text

### 6.2 Implementation
- [ ] Create `src/components/enemy-ui/InactivityBar.tsx`
- [ ] Create `src/components/enemy-ui/ScoreDecayIndicator.tsx`
- [ ] Create `src/components/enemy-ui/TimerSpeedBadge.tsx`
- [ ] Create `src/components/enemy-ui/WeaponCounterBadge.tsx`
- [ ] Create `src/components/enemy-ui/EnemyPortrait.tsx`
- [ ] Create `src/components/enemy-ui/DefeatProgress.tsx`
- [ ] Create `src/components/enemy-ui/index.ts` barrel export

### 6.3 Verification
- [ ] Run `npm test __tests__/enemyUI.test.tsx` - all tests pass
- [ ] Run `npm run typecheck` - no errors

---

## Section 7: GameBoard Integration

### 7.1 Unit Tests
- [ ] Add tests to `__tests__/GameBoard.test.tsx` (create if needed)
- [ ] Test: GameBoard calls enemy.onRoundStart on round start
- [ ] Test: GameBoard calls enemy.onTick with scaled deltaMs
- [ ] Test: GameBoard applies scoreDelta from onTick
- [ ] Test: GameBoard applies healthDelta from onTick
- [ ] Test: GameBoard removes cards from cardsToRemove
- [ ] Test: GameBoard flips cards from cardsToFlip
- [ ] Test: GameBoard triggers game over on instantDeath
- [ ] Test: GameBoard calls enemy.onValidMatch on valid match
- [ ] Test: GameBoard applies timeDelta to rewards
- [ ] Test: GameBoard applies pointsMultiplier to rewards
- [ ] Test: GameBoard calls enemy.onInvalidMatch on invalid match
- [ ] Test: GameBoard calls enemy.onCardDraw when drawing new cards
- [ ] Test: GameBoard applies stat modifiers from getStatModifiers
- [ ] Test: GameBoard renders UI modifiers from getUIModifiers
- [ ] Test: GameBoard blocks selection of dud cards
- [ ] Test: GameBoard blocks selection of face-down cards
- [ ] Test: Card removal does not replace card (board shrinks)
- [ ] Test: Card removal stops at minimum board size (6)

### 7.2 Implementation
- [ ] Add `enemy?: EnemyInstance` prop to GameBoard
- [ ] Add `roundStats` state to GameBoard
- [ ] Call `enemy.onRoundStart()` in useEffect on round start
- [ ] Modify timer tick to apply `timerSpeedMultiplier`
- [ ] Call `enemy.onTick()` in timer loop
- [ ] Apply tick result deltas (score, health, card removals, flips)
- [ ] Handle `instantDeath` flag from tick
- [ ] Modify match handler to call `enemy.onValidMatch()`
- [ ] Apply match result deltas and reward modifiers
- [ ] Update round stats on match
- [ ] Modify invalid match handler to call `enemy.onInvalidMatch()`
- [ ] Apply invalid match result (card removals)
- [ ] Update round stats on invalid match
- [ ] Modify card draw to call `enemy.onCardDraw()`
- [ ] Compute effective stats with `enemy.getStatModifiers()`
- [ ] Render enemy UI components based on `getUIModifiers()`
- [ ] Block card selection for isDud and isFaceDown
- [ ] Implement card removal without replacement (shrinking board)
- [ ] Enforce minimum board size of 6

### 7.3 Verification
- [ ] Run GameBoard tests - all pass
- [ ] Run `npm run typecheck` - no errors
- [ ] Manual testing with DummyEnemy in `/dev/play`

---

## Section 8: Enemy Selection Screen

### 8.1 Unit Tests
- [ ] Create `__tests__/EnemySelection.test.tsx`
- [ ] Test: Renders 3 enemy choices
- [ ] Test: Each enemy card shows name and icon
- [ ] Test: Each enemy card shows effect description
- [ ] Test: Each enemy card shows defeat condition
- [ ] Test: Selecting an enemy calls onSelect callback
- [ ] Test: Shows correct tier indicator

### 8.2 Implementation
- [ ] Create `src/components/EnemySelection.tsx`
- [ ] Design enemy card layout (name, icon, effects, defeat condition)
- [ ] Implement enemy choice buttons
- [ ] Add tier indicator badge
- [ ] Wire up onSelect callback
- [ ] Style to match game aesthetic

### 8.3 Game Flow Integration
- [ ] Add 'enemy_selection' to game phases in Game.tsx
- [ ] Add selectedEnemy state to Game.tsx
- [ ] Navigate to enemy selection after shop (before round)
- [ ] Pass selected enemy to GameBoard
- [ ] Track enemy defeat status for bonus rewards

### 8.4 Verification
- [ ] Run `npm test __tests__/EnemySelection.test.tsx` - all tests pass
- [ ] Run `npm run typecheck` - no errors
- [ ] Manual testing of enemy selection flow

---

## Section 9: Defeat Condition & Bonus Rewards

### 9.1 Unit Tests
- [ ] Add defeat condition tests to each enemy's test file
- [ ] Test: LevelUp shows bonus weapon when enemy defeated
- [ ] Test: LevelUp does not show bonus when enemy not defeated
- [ ] Test: Bonus weapon is correctly labeled as "Slayer Reward"

### 9.2 Implementation
- [ ] Track `enemyDefeated` boolean in Game.tsx
- [ ] Check defeat condition after each match
- [ ] Pass `enemyDefeated` to LevelUp component
- [ ] Update LevelUp to show bonus weapon slot when applicable
- [ ] Style bonus weapon with "Slayer Reward" badge

### 9.3 Verification
- [ ] Run LevelUp tests - all pass
- [ ] Manual testing of defeat condition tracking

---

## Section 10: Playwright Integration Tests

### 10.1 Setup
- [ ] Ensure Playwright is configured for the project
- [ ] Create `e2e/enemy-system.spec.ts`

### 10.2 Integration Tests
- [ ] Test: Can complete a round with DummyEnemy (no effects)
- [ ] Test: Enemy selection screen appears before round
- [ ] Test: Selected enemy effects are active during round
- [ ] Test: Dud cards cannot be selected
- [ ] Test: Face-down cards cannot be selected
- [ ] Test: Face-down cards flip on match
- [ ] Test: Board shrinks when enemy removes cards
- [ ] Test: Inactivity bar appears for Stalking Wolf
- [ ] Test: Score decay works for Circling Vulture
- [ ] Test: Timer speed increase works for Swift Bee
- [ ] Test: Defeat condition tracking works
- [ ] Test: Bonus reward appears when enemy defeated

### 10.3 Verification
- [ ] Run `npx playwright test e2e/enemy-system.spec.ts` - all pass

---

## TIER 1 ENEMIES (22 total)

---

## Section 11: Junk Rat (#1)

### 11.1 Unit Tests
- [ ] Create `__tests__/enemies/junkRat.test.ts`
- [ ] Test: Has correct metadata (name, icon, tier, description)
- [ ] Test: onCardDraw creates dud at 4% chance
- [ ] Test: Defeat condition: maxStreak >= 4 returns true
- [ ] Test: Defeat condition: maxStreak < 4 returns false

### 11.2 Implementation
- [ ] Create `src/utils/enemies/tier1/junkRat.ts`
- [ ] Implement `createJunkRat()` using DudCardEffect with 4% chance
- [ ] Implement defeat condition check
- [ ] Register in ENEMY_REGISTRY

### 11.3 Verification
- [ ] Run `npm test __tests__/enemies/junkRat.test.ts` - all pass
- [ ] Run `npm run typecheck` - no errors

---

## Section 12: Stalking Wolf (#2)

### 12.1 Unit Tests
- [ ] Create `__tests__/enemies/stalkingWolf.test.ts`
- [ ] Test: Has correct metadata
- [ ] Test: onTick increments inactivity timer
- [ ] Test: onTick triggers -1 health at 45s
- [ ] Test: onValidMatch resets inactivity timer
- [ ] Test: getUIModifiers returns inactivity bar with penalty='damage'
- [ ] Test: Defeat condition: 3 matches each under 5s

### 12.2 Implementation
- [ ] Create `src/utils/enemies/tier1/stalkingWolf.ts`
- [ ] Implement using InactivityEffect with 45000ms, 'damage'
- [ ] Implement defeat condition (check matchTimes array)
- [ ] Register in ENEMY_REGISTRY

### 12.3 Verification
- [ ] Run tests - all pass
- [ ] Run typecheck - no errors

---

## Section 13: Shifting Chameleon (#3)

### 13.1 Unit Tests
- [ ] Create `__tests__/enemies/shiftingChameleon.test.ts`
- [ ] Test: Has correct metadata
- [ ] Test: onTick changes attribute at 20s interval
- [ ] Test: Emits attribute_changed event
- [ ] Test: Defeat condition: allDifferentMatches >= 2

### 13.2 Implementation
- [ ] Create `src/utils/enemies/tier1/shiftingChameleon.ts`
- [ ] Implement using AttributeChangeEffect with 20000ms
- [ ] Implement defeat condition
- [ ] Register in ENEMY_REGISTRY

### 13.3 Verification
- [ ] Run tests - all pass

---

## Section 14: Burrowing Mole (#4)

### 14.1 Unit Tests
- [ ] Create `__tests__/enemies/burrowingMole.test.ts`
- [ ] Test: Has correct metadata
- [ ] Test: onTick removes card at 20s interval
- [ ] Test: Does not remove below 6 cards
- [ ] Test: Emits card_removed event
- [ ] Test: Defeat condition: all 3 shapes matched

### 14.2 Implementation
- [ ] Create `src/utils/enemies/tier1/burrowingMole.ts`
- [ ] Implement using CardRemovalEffect with 20000ms, 1 card, min 6
- [ ] Implement defeat condition (shapesMatched.size === 3)
- [ ] Register in ENEMY_REGISTRY

### 14.3 Verification
- [ ] Run tests - all pass

---

## Section 15: Masked Bandit (#5)

### 15.1 Unit Tests
- [ ] Create `__tests__/enemies/maskedBandit.test.ts`
- [ ] Test: Has correct metadata
- [ ] Test: getUIModifiers returns disableAutoHint: true
- [ ] Test: getStatModifiers returns autoHintChance: 0
- [ ] Test: Defeat condition: 3 consecutive matches under 10s each

### 15.2 Implementation
- [ ] Create `src/utils/enemies/tier1/maskedBandit.ts`
- [ ] Implement using DisableHintsEffect
- [ ] Implement defeat condition
- [ ] Register in ENEMY_REGISTRY

### 15.3 Verification
- [ ] Run tests - all pass

---

## Section 16: Wild Goose (#6)

### 16.1 Unit Tests
- [ ] Create `__tests__/enemies/wildGoose.test.ts`
- [ ] Test: Has correct metadata
- [ ] Test: onTick shuffles positions at 30s
- [ ] Test: Emits positions_shuffled event
- [ ] Test: Defeat condition: 2 sets share an attribute value

### 16.2 Implementation
- [ ] Create `src/utils/enemies/tier1/wildGoose.ts`
- [ ] Implement using PositionShuffleEffect with 30000ms
- [ ] Implement defeat condition (track attribute values)
- [ ] Register in ENEMY_REGISTRY

### 16.3 Verification
- [ ] Run tests - all pass

---

## Section 17: Thieving Raven (#7)

### 17.1 Unit Tests
- [ ] Create `__tests__/enemies/thievingRaven.test.ts`
- [ ] Test: Has correct metadata
- [ ] Test: onValidMatch returns timeDelta: -5
- [ ] Test: Defeat condition: totalMatches >= 5

### 17.2 Implementation
- [ ] Create `src/utils/enemies/tier1/thievingRaven.ts`
- [ ] Implement using TimeStealEffect with -5
- [ ] Implement defeat condition
- [ ] Register in ENEMY_REGISTRY

### 17.3 Verification
- [ ] Run tests - all pass

---

## Section 18: Stinging Scorpion (#8)

### 18.1 Unit Tests
- [ ] Create `__tests__/enemies/stingingScorpion.test.ts`
- [ ] Test: Has correct metadata
- [ ] Test: getStatModifiers returns damageMultiplier: 2
- [ ] Test: onValidMatch returns pointsMultiplier: 2
- [ ] Test: Defeat condition: invalidMatches === 0

### 18.2 Implementation
- [ ] Create `src/utils/enemies/tier1/stingingScorpion.ts`
- [ ] Implement using DamageMultiplierEffect and PointsMultiplierEffect
- [ ] Implement defeat condition
- [ ] Register in ENEMY_REGISTRY

### 18.3 Verification
- [ ] Run tests - all pass

---

## Section 19: Night Owl (#9)

### 19.1 Unit Tests
- [ ] Create `__tests__/enemies/nightOwl.test.ts`
- [ ] Test: Has correct metadata
- [ ] Test: onCardDraw creates face-down at 20% chance
- [ ] Test: onValidMatch rolls 70% flip for each face-down card
- [ ] Test: Defeat condition: faceDownCardsMatched >= 4

### 19.2 Implementation
- [ ] Create `src/utils/enemies/tier1/nightOwl.ts`
- [ ] Implement using FaceDownEffect with 20% create, 70% flip
- [ ] Implement defeat condition
- [ ] Register in ENEMY_REGISTRY

### 19.3 Verification
- [ ] Run tests - all pass

---

## Section 20: Swift Bee (#10)

### 20.1 Unit Tests
- [ ] Create `__tests__/enemies/swiftBee.test.ts`
- [ ] Test: Has correct metadata
- [ ] Test: getUIModifiers returns timerSpeedMultiplier: 1.2
- [ ] Test: onValidMatch returns pointsMultiplier: 1.2
- [ ] Test: Defeat condition: maxStreak >= 5

### 20.2 Implementation
- [ ] Create `src/utils/enemies/tier1/swiftBee.ts`
- [ ] Implement using TimerSpeedEffect(1.2) and PointsMultiplierEffect(1.2)
- [ ] Implement defeat condition
- [ ] Register in ENEMY_REGISTRY

### 20.3 Verification
- [ ] Run tests - all pass

---

## Section 21: Trap Weaver (#11)

### 21.1 Unit Tests
- [ ] Create `__tests__/enemies/trapWeaver.test.ts`
- [ ] Test: Has correct metadata
- [ ] Test: onRoundStart places bombs on random cards
- [ ] Test: onTick decrements bomb timers
- [ ] Test: Emits bomb_exploded when timer reaches 0
- [ ] Test: Defeat condition: bombsDefused >= 3

### 21.2 Implementation
- [ ] Create `src/utils/enemies/tier1/trapWeaver.ts`
- [ ] Implement using BombEffect with 10s timer
- [ ] Implement defeat condition
- [ ] Register in ENEMY_REGISTRY

### 21.3 Verification
- [ ] Run tests - all pass

---

## Section 22: Circling Vulture (#12)

### 22.1 Unit Tests
- [ ] Create `__tests__/enemies/circlingVulture.test.ts`
- [ ] Test: Has correct metadata
- [ ] Test: onTick returns scoreDelta: -5 per second
- [ ] Test: getUIModifiers returns showScoreDecay with rate: 5
- [ ] Test: Defeat condition: score >= targetScore * 1.5

### 22.2 Implementation
- [ ] Create `src/utils/enemies/tier1/circlingVulture.ts`
- [ ] Implement using ScoreDecayEffect with 5 pts/sec
- [ ] Implement defeat condition
- [ ] Register in ENEMY_REGISTRY

### 22.3 Verification
- [ ] Run tests - all pass

---

## Section 23: Iron Shell (#13)

### 23.1 Unit Tests
- [ ] Create `__tests__/enemies/ironShell.test.ts`
- [ ] Test: Has correct metadata
- [ ] Test: onRoundStart places one card with health: 3
- [ ] Test: Defeat condition: tripleCardsCleared >= 1

### 23.2 Implementation
- [ ] Create `src/utils/enemies/tier1/ironShell.ts`
- [ ] Implement using TripleCardEffect with 1 card, health 3
- [ ] Implement defeat condition
- [ ] Register in ENEMY_REGISTRY

### 23.3 Verification
- [ ] Run tests - all pass

---

## Section 24: Ticking Viper (#14)

### 24.1 Unit Tests
- [ ] Create `__tests__/enemies/tickingViper.test.ts`
- [ ] Test: Has correct metadata
- [ ] Test: onRoundStart places countdown card with 15s
- [ ] Test: onTick decrements countdown
- [ ] Test: Emits countdown_expired and -1 health when expires
- [ ] Test: Defeat condition: countdownCardsMatched >= 1 AND no expired

### 24.2 Implementation
- [ ] Create `src/utils/enemies/tier1/tickingViper.ts`
- [ ] Implement using CountdownEffect with 15s
- [ ] Implement defeat condition
- [ ] Register in ENEMY_REGISTRY

### 24.3 Verification
- [ ] Run tests - all pass

---

## Section 25: Wet Crab (#15)

### 25.1 Unit Tests
- [ ] Create `__tests__/enemies/wetCrab.test.ts`
- [ ] Test: Has correct metadata
- [ ] Test: getStatModifiers returns fireSpreadChanceReduction: 15
- [ ] Test: getUIModifiers returns weapon counter badge for fire
- [ ] Test: Defeat condition: allSameColorMatches >= 2

### 25.2 Implementation
- [ ] Create `src/utils/enemies/tier1/wetCrab.ts`
- [ ] Implement using WeaponCounterEffect('fire', 15)
- [ ] Implement defeat condition
- [ ] Register in ENEMY_REGISTRY

### 25.3 Verification
- [ ] Run tests - all pass

---

## Section 26: Spiny Hedgehog (#16)

### 26.1 Unit Tests
- [ ] Create `__tests__/enemies/spinyHedgehog.test.ts`
- [ ] Test: Has correct metadata
- [ ] Test: getStatModifiers returns explosionChanceReduction: 15
- [ ] Test: Defeat condition: squiggleMatches >= 3

### 26.2 Implementation
- [ ] Create `src/utils/enemies/tier1/spinyHedgehog.ts`
- [ ] Implement using WeaponCounterEffect('explosion', 15)
- [ ] Implement defeat condition
- [ ] Register in ENEMY_REGISTRY

### 26.3 Verification
- [ ] Run tests - all pass

---

## Section 27: Shadow Bat (#17)

### 27.1 Unit Tests
- [ ] Create `__tests__/enemies/shadowBat.test.ts`
- [ ] Test: Has correct metadata
- [ ] Test: getStatModifiers returns laserChanceReduction: 20
- [ ] Test: Defeat condition: any match with 3 different colors (always for all-different)

### 27.2 Implementation
- [ ] Create `src/utils/enemies/tier1/shadowBat.ts`
- [ ] Implement using WeaponCounterEffect('laser', 20)
- [ ] Implement defeat condition
- [ ] Register in ENEMY_REGISTRY

### 27.3 Verification
- [ ] Run tests - all pass

---

## Section 28: Foggy Frog (#18)

### 28.1 Unit Tests
- [ ] Create `__tests__/enemies/foggyFrog.test.ts`
- [ ] Test: Has correct metadata
- [ ] Test: getStatModifiers returns hintGainChanceReduction: 15
- [ ] Test: Defeat condition: hintsRemaining >= 2 at round end

### 28.2 Implementation
- [ ] Create `src/utils/enemies/tier1/foggyFrog.ts`
- [ ] Implement using WeaponCounterEffect('hint', 15)
- [ ] Implement defeat condition
- [ ] Register in ENEMY_REGISTRY

### 28.3 Verification
- [ ] Run tests - all pass

---

## Section 29: Sneaky Mouse (#19)

### 29.1 Unit Tests
- [ ] Create `__tests__/enemies/sneakyMouse.test.ts`
- [ ] Test: Has correct metadata
- [ ] Test: getStatModifiers returns graceGainChanceReduction: 15
- [ ] Test: Defeat condition: gracesUsed === 0

### 29.2 Implementation
- [ ] Create `src/utils/enemies/tier1/sneakyMouse.ts`
- [ ] Implement using WeaponCounterEffect('grace', 15)
- [ ] Implement defeat condition
- [ ] Register in ENEMY_REGISTRY

### 29.3 Verification
- [ ] Run tests - all pass

---

## Section 30: Lazy Sloth (#20)

### 30.1 Unit Tests
- [ ] Create `__tests__/enemies/lazySloth.test.ts`
- [ ] Test: Has correct metadata
- [ ] Test: getStatModifiers returns timeGainChanceReduction: 20
- [ ] Test: Defeat condition: timeRemaining >= 15 at round end

### 30.2 Implementation
- [ ] Create `src/utils/enemies/tier1/lazySloth.ts`
- [ ] Implement using WeaponCounterEffect('time', 20)
- [ ] Implement defeat condition
- [ ] Register in ENEMY_REGISTRY

### 30.3 Verification
- [ ] Run tests - all pass

---

## Section 31: Greedy Squirrel (#21)

### 31.1 Unit Tests
- [ ] Create `__tests__/enemies/greedySquirrel.test.ts`
- [ ] Test: Has correct metadata
- [ ] Test: onValidMatch removes 1 extra card
- [ ] Test: Does not remove below 6 cards
- [ ] Test: Defeat condition: cardsRemaining >= 8 at round end

### 31.2 Implementation
- [ ] Create `src/utils/enemies/tier1/greedySquirrel.ts`
- [ ] Implement using ExtraCardRemovalOnMatchEffect with 1 card
- [ ] Implement defeat condition
- [ ] Register in ENEMY_REGISTRY

### 31.3 Verification
- [ ] Run tests - all pass

---

## Section 32: Punishing Ermine (#22)

### 32.1 Unit Tests
- [ ] Create `__tests__/enemies/punishingErmine.test.ts`
- [ ] Test: Has correct metadata
- [ ] Test: onInvalidMatch removes 2 cards
- [ ] Test: Does not remove below 6 cards
- [ ] Test: Defeat condition: invalidMatches === 0

### 32.2 Implementation
- [ ] Create `src/utils/enemies/tier1/punishingErmine.ts`
- [ ] Implement using ExtraCardRemovalOnInvalidEffect with 2 cards
- [ ] Implement defeat condition
- [ ] Register in ENEMY_REGISTRY

### 32.3 Verification
- [ ] Run tests - all pass

---

## Section 33: Tier 1 Integration Test

- [ ] Run all Tier 1 enemy tests together
- [ ] Run `npm run typecheck` - no errors
- [ ] Run Playwright integration tests for Tier 1 enemies
- [ ] Manual testing: Play round with each Tier 1 enemy

---

## TIER 2 ENEMIES (12 total)

---

## Section 34: Charging Boar (#23)

### 34.1 Unit Tests
- [ ] Create `__tests__/enemies/chargingBoar.test.ts`
- [ ] Test: Has correct metadata (tier: 2)
- [ ] Test: Combines InactivityEffect (35s, damage) + ScoreDecayEffect (3/sec)
- [ ] Test: Defeat condition: 3 matches each under 8s

### 34.2 Implementation
- [ ] Create `src/utils/enemies/tier2/chargingBoar.ts`
- [ ] Implement using composeEffects with both effects
- [ ] Implement defeat condition
- [ ] Register in ENEMY_REGISTRY

### 34.3 Verification
- [ ] Run tests - all pass

---

## Section 35: Cackling Hyena (#24)

### 35.1 Unit Tests
- [ ] Create `__tests__/enemies/cacklingHyena.test.ts`
- [ ] Test: Combines TimeStealEffect (-3s) + WeaponCounterEffect ('grace', 35)
- [ ] Test: Defeat condition: totalMatches >= 6 AND gracesUsed === 0

### 35.2 Implementation
- [ ] Create `src/utils/enemies/tier2/cacklingHyena.ts`
- [ ] Register in ENEMY_REGISTRY

### 35.3 Verification
- [ ] Run tests - all pass

---

## Section 36: Lurking Shark (#25)

### 36.1 Unit Tests
- [ ] Create `__tests__/enemies/lurkingShark.test.ts`
- [ ] Test: Combines FaceDownEffect (25%) + CountdownEffect (12s)
- [ ] Test: Defeat condition: faceDownCardsMatched >= 3 AND countdownCardsMatched >= 1

### 36.2 Implementation
- [ ] Create `src/utils/enemies/tier2/lurkingShark.ts`
- [ ] Register in ENEMY_REGISTRY

### 36.3 Verification
- [ ] Run tests - all pass

---

## Section 37: Diving Hawk (#26)

### 37.1 Unit Tests
- [ ] Create `__tests__/enemies/divingHawk.test.ts`
- [ ] Test: Combines TimerSpeedEffect (1.35) + CardRemovalEffect (15s)
- [ ] Test: Defeat condition: 2 all-different matches under 6s each

### 37.2 Implementation
- [ ] Create `src/utils/enemies/tier2/divingHawk.ts`
- [ ] Register in ENEMY_REGISTRY

### 37.3 Verification
- [ ] Run tests - all pass

---

## Section 38: Venomous Cobra (#27)

### 38.1 Unit Tests
- [ ] Create `__tests__/enemies/venomousCobra.test.ts`
- [ ] Test: Combines AttributeChangeEffect (15s) + BombEffect
- [ ] Test: Defeat condition: bombsDefused >= 4

### 38.2 Implementation
- [ ] Create `src/utils/enemies/tier2/venomousCobra.ts`
- [ ] Register in ENEMY_REGISTRY

### 38.3 Verification
- [ ] Run tests - all pass

---

## Section 39: Prowling Direwolf (#28)

### 39.1 Unit Tests
- [ ] Create `__tests__/enemies/prowlingDirewolf.test.ts`
- [ ] Test: Combines DudCardEffect (6%) + PositionShuffleEffect (25s)
- [ ] Test: Defeat condition: maxStreak >= 6

### 39.2 Implementation
- [ ] Create `src/utils/enemies/tier2/prowlingDirewolf.ts`
- [ ] Register in ENEMY_REGISTRY

### 39.3 Verification
- [ ] Run tests - all pass

---

## Section 40: Hunting Eagle (#29)

### 40.1 Unit Tests
- [ ] Create `__tests__/enemies/huntingEagle.test.ts`
- [ ] Test: Combines TripleCardEffect + WeaponCounterEffect ('time', 35)
- [ ] Test: Defeat condition: tripleCardsCleared >= 1 AND timeRemaining >= 20

### 40.2 Implementation
- [ ] Create `src/utils/enemies/tier2/huntingEagle.ts`
- [ ] Register in ENEMY_REGISTRY

### 40.3 Verification
- [ ] Run tests - all pass

---

## Section 41: Armored Tusks (#30)

### 41.1 Unit Tests
- [ ] Create `__tests__/enemies/armoredTusks.test.ts`
- [ ] Test: Combines WeaponCounterEffect ('fire', 35) + ('explosion', 35)
- [ ] Test: Defeat condition: weaponEffectsTriggered.size >= 2 (destruction effects)

### 41.2 Implementation
- [ ] Create `src/utils/enemies/tier2/armoredTusks.ts`
- [ ] Register in ENEMY_REGISTRY

### 41.3 Verification
- [ ] Run tests - all pass

---

## Section 42: Creeping Shadow (#31)

### 42.1 Unit Tests
- [ ] Create `__tests__/enemies/creepingShadow.test.ts`
- [ ] Test: Combines DisableHintsEffect + WeaponCounterEffect ('hint', 35)
- [ ] Test: Defeat condition: colorsMatched.size === 3

### 42.2 Implementation
- [ ] Create `src/utils/enemies/tier2/creepingShadow.ts`
- [ ] Register in ENEMY_REGISTRY

### 42.3 Verification
- [ ] Run tests - all pass

---

## Section 43: Polar Guardian (#32)

### 43.1 Unit Tests
- [ ] Create `__tests__/enemies/polarGuardian.test.ts`
- [ ] Test: Combines DamageMultiplierEffect (2) + WeaponCounterEffect ('laser', 40)
- [ ] Test: Defeat condition: damageReceived === 0 AND weaponEffectsTriggered.size >= 1

### 43.2 Implementation
- [ ] Create `src/utils/enemies/tier2/polarGuardian.ts`
- [ ] Register in ENEMY_REGISTRY

### 43.3 Verification
- [ ] Run tests - all pass

---

## Section 44: Hoarding Beaver (#33)

### 44.1 Unit Tests
- [ ] Create `__tests__/enemies/hoardingBeaver.test.ts`
- [ ] Test: Combines ExtraCardRemovalOnMatchEffect (1) + CardRemovalEffect (18s)
- [ ] Test: Defeat condition: cardsRemaining >= 6

### 44.2 Implementation
- [ ] Create `src/utils/enemies/tier2/hoardingBeaver.ts`
- [ ] Register in ENEMY_REGISTRY

### 44.3 Verification
- [ ] Run tests - all pass

---

## Section 45: Fierce Wolverine (#34)

### 45.1 Unit Tests
- [ ] Create `__tests__/enemies/fierceWolverine.test.ts`
- [ ] Test: Combines ExtraCardRemovalOnInvalidEffect (2) + DamageMultiplierEffect (2)
- [ ] Test: Defeat condition: invalidMatches === 0 AND damageReceived === 0

### 45.2 Implementation
- [ ] Create `src/utils/enemies/tier2/fierceWolverine.ts`
- [ ] Register in ENEMY_REGISTRY

### 45.3 Verification
- [ ] Run tests - all pass

---

## Section 46: Tier 2 Integration Test

- [ ] Run all Tier 2 enemy tests together
- [ ] Run `npm run typecheck` - no errors
- [ ] Run Playwright integration tests for Tier 2 enemies
- [ ] Manual testing: Play round with each Tier 2 enemy

---

## TIER 3 ENEMIES (12 total)

---

## Section 47: Raging Bear (#35)

### 47.1 Unit Tests
- [ ] Create `__tests__/enemies/ragingBear.test.ts`
- [ ] Test: Combines InactivityEffect (30s, 'death') + DamageMultiplierEffect (2) + ScoreDecayEffect (4)
- [ ] Test: Defeat condition: maxStreak >= 7 AND invalidMatches === 0

### 47.2 Implementation
- [ ] Create `src/utils/enemies/tier3/ragingBear.ts`
- [ ] Register in ENEMY_REGISTRY

### 47.3 Verification
- [ ] Run tests - all pass

---

## Section 48: Abyssal Octopus (#36)

### 48.1 Unit Tests
- [ ] Create `__tests__/enemies/abyssalOctopus.test.ts`
- [ ] Test: Combines FaceDownEffect (30%) + PositionShuffleEffect (20s) + CountdownEffect (10s)
- [ ] Test: Defeat condition: faceDownCardsMatched >= 5

### 48.2 Implementation
- [ ] Create `src/utils/enemies/tier3/abyssalOctopus.ts`
- [ ] Register in ENEMY_REGISTRY

### 48.3 Verification
- [ ] Run tests - all pass

---

## Section 49: Feral Fangs (#37)

### 49.1 Unit Tests
- [ ] Create `__tests__/enemies/feralFangs.test.ts`
- [ ] Test: Combines DudCardEffect (10%) + TripleCardEffect + CardRemovalEffect (12s)
- [ ] Test: Defeat condition: tripleCardsCleared >= 1 before 5 cards removed

### 49.2 Implementation
- [ ] Create `src/utils/enemies/tier3/feralFangs.ts`
- [ ] Register in ENEMY_REGISTRY (track cards removed)

### 49.3 Verification
- [ ] Run tests - all pass

---

## Section 50: Savage Claws (#38)

### 50.1 Unit Tests
- [ ] Create `__tests__/enemies/savageClaws.test.ts`
- [ ] Test: Combines TimeStealEffect (-4s) + TimerSpeedEffect (1.5) + BombEffect
- [ ] Test: Defeat condition: totalMatches >= 8

### 50.2 Implementation
- [ ] Create `src/utils/enemies/tier3/savageClaws.ts`
- [ ] Register in ENEMY_REGISTRY

### 50.3 Verification
- [ ] Run tests - all pass

---

## Section 51: One-Eyed Terror (#39)

### 51.1 Unit Tests
- [ ] Create `__tests__/enemies/oneEyedTerror.test.ts`
- [ ] Test: Combines DisableHintsEffect + AttributeChangeEffect (12s) + WeaponCounterEffect ('hint', 55)
- [ ] Test: Defeat condition: allDifferentMatches >= 3

### 51.2 Implementation
- [ ] Create `src/utils/enemies/tier3/oneEyedTerror.ts`
- [ ] Register in ENEMY_REGISTRY

### 51.3 Verification
- [ ] Run tests - all pass

---

## Section 52: Goblin Saboteur (#40)

### 52.1 Unit Tests
- [ ] Create `__tests__/enemies/goblinSaboteur.test.ts`
- [ ] Test: onRoundStart picks 3 random weapon types
- [ ] Test: getStatModifiers applies -50% to those 3 types
- [ ] Test: Defeat condition: 3 different weapon effects triggered

### 52.2 Implementation
- [ ] Create `src/utils/enemies/tier3/goblinSaboteur.ts`
- [ ] Implement random weapon type selection
- [ ] Register in ENEMY_REGISTRY

### 52.3 Verification
- [ ] Run tests - all pass

---

## Section 53: Stone Sentinel (#41)

### 53.1 Unit Tests
- [ ] Create `__tests__/enemies/stoneSentinel.test.ts`
- [ ] Test: Combines TripleCardEffect (x2 cards) + WeaponCounterEffect ('explosion', 55) + ('laser', 55)
- [ ] Test: Defeat condition: tripleCardsCleared >= 2

### 53.2 Implementation
- [ ] Create `src/utils/enemies/tier3/stoneSentinel.ts`
- [ ] Register in ENEMY_REGISTRY

### 53.3 Verification
- [ ] Run tests - all pass

---

## Section 54: Wicked Imp (#42)

### 54.1 Unit Tests
- [ ] Create `__tests__/enemies/wickedImp.test.ts`
- [ ] Test: Combines DamageMultiplierEffect (2) + WeaponCounterEffect ('grace', 55) + ('time', 55)
- [ ] Test: Defeat condition: gracesRemaining >= 3 at round end

### 54.2 Implementation
- [ ] Create `src/utils/enemies/tier3/wickedImp.ts`
- [ ] Register in ENEMY_REGISTRY

### 54.3 Verification
- [ ] Run tests - all pass

---

## Section 55: Swarming Ants (#43)

### 55.1 Unit Tests
- [ ] Create `__tests__/enemies/swarmingAnts.test.ts`
- [ ] Test: Combines BombEffect (x2) + WeaponCounterEffect ('fire', 55) + CountdownEffect (8s)
- [ ] Test: Defeat condition: bombsDefused >= 5

### 55.2 Implementation
- [ ] Create `src/utils/enemies/tier3/swarmingAnts.ts`
- [ ] Register in ENEMY_REGISTRY

### 55.3 Verification
- [ ] Run tests - all pass

---

## Section 56: Nightmare Squid (#44)

### 56.1 Unit Tests
- [ ] Create `__tests__/enemies/nightmareSquid.test.ts`
- [ ] Test: Combines FaceDownEffect (35%, 50% flip) + PositionShuffleEffect (15s) + ScoreDecayEffect (6)
- [ ] Test: Defeat condition: currentScore >= targetScore * 2

### 56.2 Implementation
- [ ] Create `src/utils/enemies/tier3/nightmareSquid.ts`
- [ ] Register in ENEMY_REGISTRY

### 56.3 Verification
- [ ] Run tests - all pass

---

## Section 57: Ravenous Tapir (#45)

### 57.1 Unit Tests
- [ ] Create `__tests__/enemies/ravenousTapir.test.ts`
- [ ] Test: Combines ExtraCardRemovalOnMatchEffect (2) + CardRemovalEffect (10s) + TimerSpeedEffect (1.4)
- [ ] Test: Defeat condition: cardsRemaining >= 5

### 57.2 Implementation
- [ ] Create `src/utils/enemies/tier3/ravenousTapir.ts`
- [ ] Register in ENEMY_REGISTRY

### 57.3 Verification
- [ ] Run tests - all pass

---

## Section 58: Merciless Porcupine (#46)

### 58.1 Unit Tests
- [ ] Create `__tests__/enemies/mercilessPorcupine.test.ts`
- [ ] Test: Combines ExtraCardRemovalOnInvalidEffect (3) + DamageMultiplierEffect (2) + InactivityEffect (35s, 'death')
- [ ] Test: Defeat condition: invalidMatches === 0

### 58.2 Implementation
- [ ] Create `src/utils/enemies/tier3/mercilessPorcupine.ts`
- [ ] Register in ENEMY_REGISTRY

### 58.3 Verification
- [ ] Run tests - all pass

---

## Section 59: Tier 3 Integration Test

- [ ] Run all Tier 3 enemy tests together
- [ ] Run `npm run typecheck` - no errors
- [ ] Run Playwright integration tests for Tier 3 enemies
- [ ] Manual testing: Play round with each Tier 3 enemy

---

## TIER 4 BOSSES (5 total)

---

## Section 60: Ancient Dragon (#47)

### 60.1 Unit Tests
- [ ] Create `__tests__/enemies/ancientDragon.test.ts`
- [ ] Test: Combines 5 effects: TripleCardEffect (x3) + AttributeChangeEffect (8s) + TimerSpeedEffect (1.8) + DamageMultiplierEffect (2) + ScoreDecayEffect (8)
- [ ] Test: Defeat condition: tripleCardsCleared >= 3 AND allDifferentMatches >= 2

### 60.2 Implementation
- [ ] Create `src/utils/enemies/tier4/ancientDragon.ts`
- [ ] Register in ENEMY_REGISTRY

### 60.3 Verification
- [ ] Run tests - all pass

---

## Section 61: The Hydra (#48)

### 61.1 Unit Tests
- [ ] Create `__tests__/enemies/theHydra.test.ts`
- [ ] Test: Combines InactivityEffect (20s, 'death') + BombEffect (x3) + CountdownEffect (x2, 8s) + FaceDownEffect (40%) + TimeStealEffect (-6s)
- [ ] Test: Defeat condition: totalMatches >= 10 AND invalidMatches === 0

### 61.2 Implementation
- [ ] Create `src/utils/enemies/tier4/theHydra.ts`
- [ ] Register in ENEMY_REGISTRY

### 61.3 Verification
- [ ] Run tests - all pass

---

## Section 62: Kraken's Grasp (#49)

### 62.1 Unit Tests
- [ ] Create `__tests__/enemies/krakensGrasp.test.ts`
- [ ] Test: Combines PositionShuffleEffect (10s) + CardRemovalEffect (8s) + DudCardEffect (15%) + AllWeaponCounters (75%)
- [ ] Test: Defeat condition: cardsRemaining >= 5

### 62.2 Implementation
- [ ] Create `src/utils/enemies/tier4/krakensGrasp.ts`
- [ ] Implement AllWeaponCountersEffect for -75% all types
- [ ] Register in ENEMY_REGISTRY

### 62.3 Verification
- [ ] Run tests - all pass

---

## Section 63: The Reaper (#50)

### 63.1 Unit Tests
- [ ] Create `__tests__/enemies/theReaper.test.ts`
- [ ] Test: Combines WeaponCounterEffect ('grace', 90) + ('time', 90) + DamageMultiplierEffect (2) + ScoreDecayEffect (10) + DisableHintsEffect
- [ ] Test: Defeat condition: timeRemaining >= 10 AND damageReceived === 0

### 63.2 Implementation
- [ ] Create `src/utils/enemies/tier4/theReaper.ts`
- [ ] Register in ENEMY_REGISTRY

### 63.3 Verification
- [ ] Run tests - all pass

---

## Section 64: World Eater (#51)

### 64.1 Unit Tests
- [ ] Create `__tests__/enemies/worldEater.test.ts`
- [ ] Test: Combines ExtraCardRemovalOnMatchEffect (3) + ExtraCardRemovalOnInvalidEffect (4) + CardRemovalEffect (6s) + InactivityEffect (15s, 'death') + TimerSpeedEffect (2.0)
- [ ] Test: Defeat condition: cardsRemaining >= 4 AND invalidMatches === 0

### 64.2 Implementation
- [ ] Create `src/utils/enemies/tier4/worldEater.ts`
- [ ] Register in ENEMY_REGISTRY

### 64.3 Verification
- [ ] Run tests - all pass

---

## Section 65: Tier 4 Integration Test

- [ ] Run all Tier 4 enemy tests together
- [ ] Run `npm run typecheck` - no errors
- [ ] Run Playwright integration tests for Tier 4 bosses
- [ ] Manual testing: Play round 10 with each Tier 4 boss

---

## Section 66: Final Integration & Polish

### 66.1 Full Test Suite
- [ ] Run `npm test` - all tests pass
- [ ] Run `npm run typecheck` - no errors
- [ ] Run `npx playwright test` - all integration tests pass

### 66.2 Balance Verification
- [ ] Playtest each tier and verify difficulty curve
- [ ] Verify defeat conditions are achievable but challenging
- [ ] Verify weapon counters feel impactful but not debilitating

### 66.3 Documentation
- [ ] Update CLAUDE.md with enemy system notes
- [ ] Verify all icons are registered in Icon.tsx
- [ ] Add enemy system to dev tools (if applicable)

### 66.4 Final Cleanup
- [ ] Remove any TODO comments in code
- [ ] Run linter and fix any issues
- [ ] Increment version in package.json
- [ ] Create commit: "feat: implement enemy system (51 enemies)"

---

## Progress Summary

| Section | Status |
|---------|--------|
| 1. Foundation Types | ⬜ |
| 2. Enemy Factory | ⬜ |
| 3. Effect Behaviors | ⬜ |
| 4. Round Stats | ⬜ |
| 5. Card Rendering | ⬜ |
| 6. Enemy UI | ⬜ |
| 7. GameBoard Integration | ⬜ |
| 8. Enemy Selection | ⬜ |
| 9. Defeat & Rewards | ⬜ |
| 10. Playwright Tests | ⬜ |
| 11-32. Tier 1 (22 enemies) | ⬜ |
| 33. Tier 1 Integration | ⬜ |
| 34-45. Tier 2 (12 enemies) | ⬜ |
| 46. Tier 2 Integration | ⬜ |
| 47-58. Tier 3 (12 enemies) | ⬜ |
| 59. Tier 3 Integration | ⬜ |
| 60-64. Tier 4 (5 bosses) | ⬜ |
| 65. Tier 4 Integration | ⬜ |
| 66. Final Integration | ⬜ |

**Total Sections:** 66
**Completed:** 0

## Completed
- [x] Project initialization

## Notes
- Focus on MVP functionality first
- Ensure each feature is properly tested
- Update this file after each major milestone
