# Enemy System Implementation Plan

> **For Claude:** Check off tasks with `[x]` as you complete them. Follow TDD: write tests first, implement, verify tests pass.

You MUST commit the code once the unit tests and integration tests are passing between each section.

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
- [x] Add `hasBomb?: boolean` to Card interface

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
- [x] All 54 effect behavior tests passing

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

### 3.4 Additional Effects ✅ COMPLETED
All effects needed for Tier 1 enemies are now implemented:
- [x] `AttributeChangeEffect` - For Shifting Chameleon (changes card attributes)
- [x] `BombEffect` - For Trap Weaver (places timed bombs on cards)
- [x] `CountdownEffect` - For Ticking Viper (single countdown card)
- [x] `TripleCardEffect` - For Iron Shell (cards needing multiple matches)

---

## Section 4: Tier 1 Enemies (22 total)

### 4.1 Junk Rat ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/junkRat.ts`
- [x] Implement createJunkRat() using composeEffects
- [x] Effect: 4% dud chance on card draw
- [x] Defeat condition: Get a 4-match streak
- [x] Create `__tests__/enemies/tier1/junkRat.test.ts`
- [x] Tests passing (all tests pass)

### 4.2 Stalking Wolf ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/stalkingWolf.ts`
- [x] Implement createStalkingWolf() using composeEffects
- [x] Effect: 45s inactivity → lose 1 health
- [x] Defeat condition: Match 3 times in under 5s each
- [x] Create `__tests__/enemies/tier1/stalkingWolf.test.ts`
- [x] Tests passing (18 tests)

### 4.3 Shifting Chameleon ✅ COMPLETED
- [x] Implement `AttributeChangeEffect` in `src/utils/enemyEffects.ts`
  - Config: `{ intervalMs: number }`
  - onTick: Track timeSinceAttributeChange, when >= interval, pick random card and change one attribute to a random different value
  - Return cardModifications with the changed attribute
  - Emit 'attribute_changed' event
- [x] Create `src/utils/enemies/tier1/shiftingChameleon.ts`
- [x] Icon: `darkzaitzev/chameleon-glyph`
- [x] Effect: Changes 1 attribute on random cards every 20s
- [x] Defeat condition: Get 2 all-different matches (`stats.allDifferentMatches >= 2`)
- [x] Create `__tests__/enemies/tier1/shiftingChameleon.test.ts`
- [x] Tests passing (17 tests)

### 4.4 Burrowing Mole ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/burrowingMole.ts`
- [x] Effect: Removes 1 random card every 20s (uses CardRemovalEffect)
- [x] Defeat condition: Match all 3 shapes at least once
- [x] Tests passing (16 tests)

### 4.5 Masked Bandit ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/maskedBandit.ts`
- [x] Effect: Disables auto-hints entirely (uses HintDisableEffect)
- [x] Defeat condition: Get 3 matches without hesitating >10s
- [x] Tests passing (17 tests)

### 4.6 Wild Goose ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/wildGoose.ts`
- [x] Effect: Shuffles card positions every 30s (uses PositionShuffleEffect)
- [x] Defeat condition: Match 2 sets that share a card attribute
- [x] Tests passing (10 tests)

### 4.7 Thieving Raven ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/thievingRaven.ts`
- [x] Effect: -5s stolen per match (uses TimeStealEffect)
- [x] Defeat condition: Complete 5 matches total
- [x] Tests passing (9 tests)

### 4.8 Stinging Scorpion ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/stingingScorpion.ts`
- [x] Effect: 2x damage taken, 2x points earned (uses DamageMultiplierEffect + PointsMultiplierEffect)
- [x] Defeat condition: Make no invalid matches
- [x] Tests passing (9 tests)

### 4.9 Night Owl ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/nightOwl.ts`
- [x] Icon: `caro-asercion/barn-owl`
- [x] Effect: 20% chance per draw → card is face-down; matching flips with 70% chance (uses FaceDownEffect with `{ chance: 20, flipChance: 70 }`)
- [x] Defeat condition: Match 4 face-down cards (`stats.faceDownCardsMatched >= 4`)
- [x] Create `__tests__/enemies/tier1/nightOwl.test.ts`
- [x] Register in `src/utils/enemies/tier1/index.ts`
- [x] Tests passing

### 4.10 Swift Bee ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/swiftBee.ts`
- [x] Icon: `lorc/bee`
- [x] Effect: Timer 20% faster, 20% more points (uses TimerSpeedEffect `{ multiplier: 1.2 }` + PointsMultiplierEffect `{ multiplier: 1.2 }`)
- [x] Defeat condition: Get a 5-match streak (`stats.maxStreak >= 5`)
- [x] Create `__tests__/enemies/tier1/swiftBee.test.ts`
- [x] Register in `src/utils/enemies/tier1/index.ts`
- [x] Tests passing

### 4.11 Trap Weaver ✅ COMPLETED
- [x] Implement `BombEffect` in `src/utils/enemyEffects.ts`
  - Config: `{ bombChance: number, bombTimerMs: number, minBoardSize: number }`
  - onCardDraw: Chance to add hasBomb=true and bombTimer to card
  - onTick: Decrement bomb timers, explode (remove card) when timer reaches 0
  - Track bombs in internalState, emit 'bomb_exploded' events
  - Return cardsToRemove when bombs explode
- [x] Create `src/utils/enemies/tier1/trapWeaver.ts`
- [x] Icon: `carl-olsen/spider-face`
- [x] Effect: Random cards get 10s bomb timers (BombEffect `{ bombChance: 15, bombTimerMs: 10000, minBoardSize: 6 }`)
- [x] Defeat condition: Defuse 3 bombs - match bomb cards before explosion (`stats.bombsDefused >= 3`)
- [x] Create `__tests__/enemies/tier1/trapWeaver.test.ts`
- [x] Register in `src/utils/enemies/tier1/index.ts`
- [x] Tests passing (15 tests)

### 4.12 Circling Vulture ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/circlingVulture.ts`
- [x] Icon: `lorc/vulture`
- [x] Effect: Score drains 5pts/sec (uses ScoreDecayEffect `{ ratePerSecond: 5 }`)
- [x] Defeat condition: Reach 150% of target score (`stats.currentScore >= stats.targetScore * 1.5`)
- [x] Create `__tests__/enemies/tier1/circlingVulture.test.ts`
- [x] Register in `src/utils/enemies/tier1/index.ts`
- [x] Tests passing

### 4.13 Iron Shell ✅ COMPLETED
- [x] Implement `TripleCardEffect` in `src/utils/enemyEffects.ts`
  - Config: `{ count: number }` - number of triple cards to place
  - onRoundStart: Select `count` random cards and set health=3 on them
  - Track which cards have health > 1 in internal state
  - onValidMatch decrements health tracking
- [x] Create `src/utils/enemies/tier1/ironShell.ts`
- [x] Icon: `lorc/turtle`
- [x] Effect: One card needs 3 matches to clear (TripleCardEffect `{ count: 1 }`)
- [x] Defeat condition: Clear the triple-health card (`stats.tripleCardsCleared >= 1`)
- [x] Create `__tests__/enemies/tier1/ironShell.test.ts`
- [x] Register in `src/utils/enemies/tier1/index.ts`
- [x] Tests passing (13 tests)

### 4.14 Ticking Viper ✅ COMPLETED
- [x] Implement `CountdownEffect` in `src/utils/enemyEffects.ts`
  - Config: `{ countdownMs: number }` - time until penalty
  - onRoundStart: Pick one random card and set hasCountdown=true, countdownTimer=config.countdownMs
  - onTick: Decrement timer, when reaches 0 deal 1 damage and pick new card
  - Emit 'countdown_warning' at 5s remaining, 'countdown_expired' when expires
- [x] Create `src/utils/enemies/tier1/tickingViper.ts`
- [x] Icon: `lorc/snake` (already registered)
- [x] Effect: One card has 15s countdown timer; match or lose 1HP (CountdownEffect `{ countdownMs: 15000 }`)
- [x] Defeat condition: Match the countdown card in time (`stats.countdownCardsMatched >= 1`)
- [x] Create `__tests__/enemies/tier1/tickingViper.test.ts`
- [x] Register in `src/utils/enemies/tier1/index.ts`
- [x] Tests passing (18 tests)

### 4.15 Wet Crab ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/wetCrab.ts`
- [x] Icon: `lorc/crab`
- [x] Effect: Fire effects -15% (uses WeaponCounterEffect `{ type: 'fire', reduction: 15 }`)
- [x] Defeat condition: Get 2 matches with all-same color (`stats.allSameColorMatches >= 2`)
- [x] Create `__tests__/enemies/tier1/wetCrab.test.ts`
- [x] Register in `src/utils/enemies/tier1/index.ts`
- [x] Tests passing

### 4.16 Spiny Hedgehog ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/spinyHedgehog.ts`
- [x] Icon: `caro-asercion/hedgehog`
- [x] Effect: Explosion effects -15% (uses WeaponCounterEffect `{ type: 'explosion', reduction: 15 }`)
- [x] Defeat condition: Get 3 matches containing squiggles (`stats.squiggleMatches >= 3`)
- [x] Create `__tests__/enemies/tier1/spinyHedgehog.test.ts`
- [x] Register in `src/utils/enemies/tier1/index.ts`
- [x] Tests passing

### 4.17 Shadow Bat ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/shadowBat.ts`
- [x] Icon: `lorc/evil-bat`
- [x] Effect: Laser effects -20% (uses WeaponCounterEffect `{ type: 'laser', reduction: 20 }`)
- [x] Defeat condition: Get an all-different match (`stats.allDifferentMatches >= 1`)
- [x] Create `__tests__/enemies/tier1/shadowBat.test.ts`
- [x] Register in `src/utils/enemies/tier1/index.ts`
- [x] Tests passing

### 4.18 Foggy Frog ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/foggyFrog.ts`
- [x] Icon: `lorc/frog`
- [x] Effect: Hint gain -15% (uses WeaponCounterEffect `{ type: 'hint', reduction: 15 }`)
- [x] Defeat condition: Achieve minimum with 2+ hints remaining (`stats.currentScore >= stats.targetScore && stats.hintsRemaining >= 2`)
- [x] Create `__tests__/enemies/tier1/foggyFrog.test.ts`
- [x] Register in `src/utils/enemies/tier1/index.ts`
- [x] Tests passing

### 4.19 Sneaky Mouse ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/sneakyMouse.ts`
- [x] Icon: `lorc/mouse`
- [x] Effect: Grace gain -15% (uses WeaponCounterEffect `{ type: 'grace', reduction: 15 }`)
- [x] Defeat condition: Never use a grace (`stats.gracesUsed === 0 && stats.totalMatches >= 1`)
- [x] Create `__tests__/enemies/tier1/sneakyMouse.test.ts`
- [x] Register in `src/utils/enemies/tier1/index.ts`
- [x] Tests passing

### 4.20 Lazy Sloth ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/lazySloth.ts`
- [x] Icon: `caro-asercion/sloth`
- [x] Effect: Time gain -20% (uses WeaponCounterEffect `{ type: 'time', reduction: 20 }`)
- [x] Defeat condition: Achieve minimum with 15+ seconds remaining (`stats.currentScore >= stats.targetScore && stats.timeRemaining >= 15`)
- [x] Create `__tests__/enemies/tier1/lazySloth.test.ts`
- [x] Register in `src/utils/enemies/tier1/index.ts`
- [x] Tests passing

### 4.21 Greedy Squirrel ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/greedySquirrel.ts`
- [x] Icon: `delapouite/squirrel`
- [x] Effect: On valid match, 1 additional random card is removed (uses ExtraCardRemovalOnMatchEffect `{ count: 1, minBoardSize: 6 }`)
- [x] Defeat condition: Achieve minimum with 8+ cards remaining (`stats.currentScore >= stats.targetScore && stats.cardsRemaining >= 8`)
- [x] Create `__tests__/enemies/tier1/greedySquirrel.test.ts`
- [x] Register in `src/utils/enemies/tier1/index.ts`
- [x] Tests passing

### 4.22 Punishing Ermine ✅ COMPLETED
- [x] Create `src/utils/enemies/tier1/punishingErmine.ts`
- [x] Icon: `delapouite/ermine`
- [x] Effect: On invalid match, 2 extra cards are removed (uses ExtraCardRemovalOnInvalidEffect `{ count: 2, minBoardSize: 6 }`)
- [x] Defeat condition: Make no invalid matches (`stats.invalidMatches === 0 && stats.totalMatches >= 1`)
- [x] Create `__tests__/enemies/tier1/punishingErmine.test.ts`
- [x] Register in `src/utils/enemies/tier1/index.ts`
- [x] Tests passing

### 4.23 Verification ✅ COMPLETED
- [x] Run `npm test -- --testPathPattern="enemies/tier1"` - all 22 test suites pass (330 tests)
- [x] Verify all 22 enemies are registered (22 imports in tier1/index.ts)
- [ ] Commit with message: "feat(enemy): complete all 22 Tier 1 enemies"

---

## Section 5: GameBoard Integration (PRIORITY - Do before more enemies)

> **Important:** Complete this section before implementing Tier 2-4 enemies. This ensures the enemy system is actually functional in-game.

### 5.1 RoundStats Tracking ✅ COMPLETED
- [x] Create `src/hooks/useRoundStats.ts`
- [x] Initialize RoundStats at round start with default values
- [x] Track totalMatches on valid match
- [x] Track currentStreak (increment on valid, reset on invalid)
- [x] Track maxStreak (update when currentStreak exceeds)
- [x] Track invalidMatches on invalid match
- [x] Track matchTimes array (time since previous match in ms)
- [x] Track timeRemaining from game timer
- [x] Track cardsRemaining from board state
- [x] Track shapesMatched Set (add shapes from matched cards)
- [x] Track colorsMatched Set (add colors from matched cards)
- [x] Track allDifferentMatches (count when all attributes are different)
- [x] Track allSameColorMatches (count when color is all-same)
- [x] Track squiggleMatches (count when any matched card has squiggle)
- [x] Track gracesUsed (increment when grace auto-used)
- [x] Track hintsUsed (increment when hint used)
- [x] Track hintsRemaining / gracesRemaining from player stats
- [x] Track damageReceived (increment on health loss)
- [x] Track weaponEffectsTriggered Set (add weapon type on trigger)
- [x] Track currentScore / targetScore
- [x] Track faceDownCardsMatched (count face-down cards in valid matches)
- [x] Track bombsDefused (count bomb cards matched before explosion)
- [x] Track countdownCardsMatched (count countdown cards matched in time)
- [x] Track tripleCardsCleared (count cards with health > 1 fully cleared)
- [x] Create `__tests__/hooks/useRoundStats.test.ts` with unit tests
- [x] Tests passing (37 tests)
- [x] Integrated with Game.tsx

### 5.2 GameBoard Enemy Lifecycle Integration (Partial ✅)
- [x] Add `enemy: EnemyInstance` prop to GameBoard component
- [x] Add `roundStats: RoundStats` prop (or use hook internally)
- [x] Import and use `useRoundStats` hook in Game.tsx
- [x] Pass enemy and roundStats to GameBoard in 'round' phase
- [x] Call resetRoundStats in initGame and startNextRound
- [x] Call recordValidMatch with match context (isAllDifferent, isAllSameColor, hasSquiggle)
- [x] Call recordInvalidMatch on invalid matches
- [x] Call recordGraceUsed when grace saves a near-miss
- [x] Call recordHintUsed when hint is used
- [x] Call recordDamage when player takes damage
- [x] Call recordWeaponEffect when fire/explosion/laser/ricochet triggers
- [x] Update timeRemaining, score, cardsRemaining, hintsRemaining, gracesRemaining via useEffect

#### 5.2.1 onRoundStart Integration ✅
- [x] Call `enemy.onRoundStart(board)` when round begins
- [x] Apply `cardModifications` from result to board state
- [x] Create enemy instance (currently using dummy, until enemy selection)

#### 5.2.2 onTick Integration ✅
- [x] Get `timerSpeedMultiplier` from `enemy.getUIModifiers()`
- [x] Scale deltaMs by timerSpeedMultiplier before passing to enemy
- [x] Call `enemy.onTick(scaledDelta, board)` every game tick
- [x] Apply `scoreDelta` to score (clamp to 0 minimum)
- [x] Apply `healthDelta` to health
- [x] Handle `instantDeath` flag → sets health to 0
- [x] Remove cards in `cardsToRemove` (NO replacement - board shrinks)
- [x] Apply `cardModifications` to board
- [x] Flip cards in `cardsToFlip` (set isFaceDown=false)

#### 5.2.3 onValidMatch Integration ✅
- [x] Call `enemy.onValidMatch(matchedCards, board)` after valid match
- [x] Apply `timeDelta` to remaining time (can be negative for time steal)
- [x] Apply `pointsMultiplier` to match points
- [x] Remove extra cards in `cardsToRemove` (NO replacement)
- [x] Flip cards in `cardsToFlip`
- [x] Check defeat condition: `enemy.checkDefeatCondition(roundStats)`

#### 5.2.4 onInvalidMatch Integration ✅
- [x] Call `enemy.onInvalidMatch(cards, board)` after invalid match
- [x] Remove extra cards in `cardsToRemove` (NO replacement)

#### 5.2.5 onCardDraw Integration ✅
- [x] Call `enemy.onCardDraw(card)` when drawing new cards to replace matched cards
- [x] Use returned card (may have isDud, isFaceDown, hasBomb, etc.)
- [x] Note: Do NOT call onCardDraw for cards removed by enemy effects

#### 5.2.6 Stat Modifiers Integration (Partial ✅)
- [x] Get `statModifiers` from `enemy.getStatModifiers()`
- [x] Apply `damageMultiplier` when calculating damage taken
- [x] Apply `pointsMultiplier` when calculating points earned (via onValidMatch)
- [ ] Apply weapon counter reductions when rolling weapon effects (requires GameBoard changes):
  - `fireSpreadChanceReduction` → reduce fire spread chance
  - `explosionChanceReduction` → reduce explosion chance
  - `laserChanceReduction` → reduce laser chance
  - `hintGainChanceReduction` → reduce hint gain chance
  - `graceGainChanceReduction` → reduce grace gain chance
  - `timeGainChanceReduction` → reduce time bonus chance
  - `healingChanceReduction` → reduce healing chance

#### 5.2.7 onRoundEnd Integration ✅
- [x] Call `enemy.onRoundEnd()` when round ends (in completeRound and endGame)
- [x] Clean up any enemy-related state

### 5.3 Card Component Updates ✅ COMPLETED
- [x] Update `Card.tsx` to render dud cards (isDud=true)
  - Visual: Grayed out white/blank card, opacity 0.5
  - Block selection via isUnselectable check
- [x] Update `Card.tsx` to render face-down cards (isFaceDown=true)
  - Visual: Dark card back with "?" symbol and dashed border pattern
  - Block selection via isUnselectable check
- [x] Update `Card.tsx` to render countdown cards (hasCountdown=true)
  - Visual: Orange border glow + stopwatch timer overlay in bottom-left
  - Timer turns red when <= 5 seconds
- [x] Update `Card.tsx` to render bomb cards (hasBomb=true)
  - Visual: Red border glow + time-bomb icon overlay in bottom-left
  - Timer turns red when <= 5 seconds
- [x] Update `Card.tsx` to render multi-health cards (health > 1)
  - Visual: Health pips (●●● → ●● → ●) shown as red badge in top-right
- [ ] Create `__tests__/Card.enemy.test.tsx` with render tests
- [ ] Tests passing

### 5.4 Enemy UI Components
- [ ] Create `src/components/enemy-ui/InactivityBar.tsx`
  - Props: `{ current: number, max: number, penalty: 'damage' | 'death' }`
  - Visual: Progress bar filling up, color changes near max, death icon for death penalty
- [ ] Create `src/components/enemy-ui/ScoreDecayIndicator.tsx`
  - Props: `{ rate: number }`
  - Visual: "-X/sec" badge near score display
- [ ] Create `src/components/enemy-ui/TimerSpeedBadge.tsx`
  - Props: `{ multiplier: number }`
  - Visual: "1.2x" badge near timer (only show if multiplier !== 1)
- [ ] Create `src/components/enemy-ui/WeaponCounterBadge.tsx`
  - Props: `{ type: string, reduction: number }`
  - Visual: Weapon icon with "-X%" overlay
- [ ] Create `src/components/enemy-ui/EnemyPortrait.tsx`
  - Props: `{ enemy: EnemyInstance }`
  - Visual: Enemy icon + name, shows active enemy
- [ ] Create `src/components/enemy-ui/DefeatProgress.tsx`
  - Props: `{ enemy: EnemyInstance, stats: RoundStats }`
  - Visual: Progress indicator toward defeat condition
- [ ] Create `src/components/enemy-ui/index.ts` barrel export
- [ ] Create `__tests__/enemy-ui/` tests for each component
- [ ] Tests passing

### 5.5 GameBoard UI Integration
- [ ] Import enemy UI components in GameBoard
- [ ] Render `InactivityBar` when `uiModifiers.showInactivityBar` is set
- [ ] Render `ScoreDecayIndicator` when `uiModifiers.showScoreDecay` is set
- [ ] Render `TimerSpeedBadge` when `uiModifiers.timerSpeedMultiplier` !== 1
- [ ] Render `WeaponCounterBadge` for each item in `uiModifiers.weaponCounters`
- [ ] Render `EnemyPortrait` showing current enemy
- [ ] Render `DefeatProgress` showing progress toward defeat condition
- [ ] Handle `disableAutoHint` - don't show auto-hints when true
- [ ] Handle `disableManualHint` - disable hint button when true

### 5.6 Game.tsx Integration
- [ ] Import `createEnemy`, `createDummyEnemy` from enemyFactory
- [ ] Add `currentEnemy: EnemyInstance` to game state
- [ ] Pass `enemy` prop to GameBoard component
- [ ] Handle enemy selection phase (for now, use dummy enemy or random)
- [ ] Track if enemy was defeated for bonus reward

### 5.7 Integration Tests
- [ ] Create `__tests__/integration/enemyGameBoard.test.tsx`
- [ ] Test: DummyEnemy has no effect on gameplay
- [ ] Test: DudCardEffect creates unselectable cards
- [ ] Test: InactivityEffect shows bar and damages on timeout
- [ ] Test: ScoreDecayEffect reduces score over time
- [ ] Test: FaceDownEffect creates unselectable cards that flip on match
- [ ] Test: CardRemovalEffect removes cards without replacement
- [ ] Test: TimerSpeedEffect speeds up game timer
- [ ] Test: WeaponCounterEffect reduces weapon effectiveness
- [ ] Tests passing

### 5.8 Verification
- [ ] Run `npm test` - all tests pass
- [ ] Run `npm run typecheck` - no type errors
- [ ] Manual test in `/dev/play` with dummy enemy
- [ ] Manual test with one real enemy (e.g., Junk Rat)
- [ ] Commit with message: "feat(enemy): integrate enemy lifecycle with GameBoard"

---

## Section 6: Tier 2 Enemies (12 total)

> **Prerequisite:** Complete Section 5 (GameBoard Integration) first.

### 6.1 Charging Boar
- [ ] Create `src/utils/enemies/tier2/chargingBoar.ts`
- [ ] Icon: `caro-asercion/boar`
- [ ] Effects: InactivityEffect (35s → 1HP) + ScoreDecayEffect (3pts/sec)
- [ ] Defeat condition: Get 3 matches each under 8s (`matchTimes.filter(t => t < 8000).length >= 3`)
- [ ] Create `__tests__/enemies/tier2/chargingBoar.test.ts`
- [ ] Tests passing

### 6.2 Cackling Hyena
- [ ] Create `src/utils/enemies/tier2/cacklingHyena.ts`
- [ ] Icon: `lorc/hyena-head` or suitable alternative
- [ ] Effects: TimeStealEffect (-3s) + WeaponCounterEffect (grace -35%)
- [ ] Defeat condition: Match 6 times with no grace used (`stats.totalMatches >= 6 && stats.gracesUsed === 0`)
- [ ] Create `__tests__/enemies/tier2/cacklingHyena.test.ts`
- [ ] Tests passing

### 6.3 Lurking Shark
- [ ] Create `src/utils/enemies/tier2/lurkingShark.ts`
- [ ] Icon: `lorc/shark-jaws` or suitable alternative
- [ ] Effects: FaceDownEffect (25% chance) + CountdownEffect (12s timer)
- [ ] Defeat condition: Match 3 face-down cards + the countdown card (`stats.faceDownCardsMatched >= 3 && stats.countdownCardsMatched >= 1`)
- [ ] Create `__tests__/enemies/tier2/lurkingShark.test.ts`
- [ ] Tests passing

### 6.4 Diving Hawk
- [ ] Create `src/utils/enemies/tier2/divingHawk.ts`
- [ ] Icon: `lorc/hawk-emblem` or suitable alternative
- [ ] Effects: TimerSpeedEffect (1.35x) + CardRemovalEffect (15s interval)
- [ ] Defeat condition: Get 2 all-different matches under 6s each (`allDifferentMatches >= 2 && matchTimes for those < 6000`)
- [ ] Create `__tests__/enemies/tier2/divingHawk.test.ts`
- [ ] Tests passing

### 6.5 Venomous Cobra
- [ ] Create `src/utils/enemies/tier2/venomousCobra.ts`
- [ ] Icon: `lorc/cobra` or suitable alternative
- [ ] Effects: AttributeChangeEffect (15s) + BombEffect
- [ ] Defeat condition: Match 4 bombs before they explode (`stats.bombsDefused >= 4`)
- [ ] Create `__tests__/enemies/tier2/venomousCobra.test.ts`
- [ ] Tests passing

### 6.6 Prowling Direwolf
- [ ] Create `src/utils/enemies/tier2/prowlingDirewolf.ts`
- [ ] Icon: `lorc/direwolf`
- [ ] Effects: DudCardEffect (6%) + PositionShuffleEffect (25s)
- [ ] Defeat condition: Get a 6-match streak (`stats.maxStreak >= 6`)
- [ ] Create `__tests__/enemies/tier2/prowlingDirewolf.test.ts`
- [ ] Tests passing

### 6.7 Hunting Eagle
- [ ] Create `src/utils/enemies/tier2/huntingEagle.ts`
- [ ] Icon: `lorc/eagle-head` or suitable alternative
- [ ] Effects: TripleCardEffect (1 card) + WeaponCounterEffect (time -35%)
- [ ] Defeat condition: Clear triple card with 20s+ remaining (`stats.tripleCardsCleared >= 1 && stats.timeRemaining >= 20`)
- [ ] Create `__tests__/enemies/tier2/huntingEagle.test.ts`
- [ ] Tests passing

### 6.8 Armored Tusks
- [ ] Create `src/utils/enemies/tier2/armoredTusks.ts`
- [ ] Icon: `lorc/boar-tusks` or suitable alternative
- [ ] Effects: WeaponCounterEffect (fire -35%) + WeaponCounterEffect (explosion -35%)
- [ ] Defeat condition: Trigger 2 destruction effects (`stats.weaponEffectsTriggered.size >= 2` where effects are fire/explosion/laser)
- [ ] Create `__tests__/enemies/tier2/armoredTusks.test.ts`
- [ ] Tests passing

### 6.9 Creeping Shadow
- [ ] Create `src/utils/enemies/tier2/creepingShadow.ts`
- [ ] Icon: `lorc/beast-eye` or suitable alternative
- [ ] Effects: HintDisableEffect (auto+manual) + WeaponCounterEffect (hint -35%)
- [ ] Defeat condition: Match all 3 colors at least once (`stats.colorsMatched.size >= 3`)
- [ ] Create `__tests__/enemies/tier2/creepingShadow.test.ts`
- [ ] Tests passing

### 6.10 Polar Guardian
- [ ] Create `src/utils/enemies/tier2/polarGuardian.ts`
- [ ] Icon: `delapouite/polar-bear` or suitable alternative
- [ ] Effects: DamageMultiplierEffect (2x) + PointsMultiplierEffect (2x) + WeaponCounterEffect (laser -40%)
- [ ] Defeat condition: Take no damage AND trigger 1 weapon effect (`stats.damageReceived === 0 && stats.weaponEffectsTriggered.size >= 1`)
- [ ] Create `__tests__/enemies/tier2/polarGuardian.test.ts`
- [ ] Tests passing

### 6.11 Hoarding Beaver
- [ ] Create `src/utils/enemies/tier2/hoardingBeaver.ts`
- [ ] Icon: `caro-asercion/beaver` or suitable alternative
- [ ] Effects: ExtraCardRemovalOnMatchEffect (1 card) + CardRemovalEffect (18s)
- [ ] Defeat condition: Achieve minimum with 6+ cards remaining (`stats.currentScore >= stats.targetScore && stats.cardsRemaining >= 6`)
- [ ] Create `__tests__/enemies/tier2/hoardingBeaver.test.ts`
- [ ] Tests passing

### 6.12 Fierce Wolverine
- [ ] Create `src/utils/enemies/tier2/fierceWolverine.ts`
- [ ] Icon: `lorc/wolverine-claws` or suitable alternative
- [ ] Effects: ExtraCardRemovalOnInvalidEffect (2 cards) + DamageMultiplierEffect (2x) + PointsMultiplierEffect (2x)
- [ ] Defeat condition: Make no invalid matches AND take no damage (`stats.invalidMatches === 0 && stats.damageReceived === 0`)
- [ ] Create `__tests__/enemies/tier2/fierceWolverine.test.ts`
- [ ] Tests passing

### 6.13 Verification
- [ ] Create `src/utils/enemies/tier2/index.ts` with all exports
- [ ] Update `src/utils/enemies/index.ts` to import tier2
- [ ] Run `npm test -- --testPathPattern="enemies/tier2"` - all tests pass
- [ ] Verify all 12 enemies registered via `getEnemiesByTier(2).length === 12`
- [ ] Commit with message: "feat(enemy): complete all 12 Tier 2 enemies"

---

## Section 7: Tier 3 Enemies (12 total)

> **Note:** Instant death mechanics become available in this tier.

### 7.1 Raging Bear
- [ ] Create `src/utils/enemies/tier3/ragingBear.ts`
- [ ] Icon: `lorc/bear-head` or suitable alternative
- [ ] Effects: InactivityEffect (30s → instant death) + DamageMultiplierEffect (2x) + PointsMultiplierEffect (2x) + ScoreDecayEffect (4pts/sec)
- [ ] Defeat condition: 7-match streak with no invalid matches (`stats.maxStreak >= 7 && stats.invalidMatches === 0`)
- [ ] Tests passing

### 7.2 Abyssal Octopus
- [ ] Create `src/utils/enemies/tier3/abyssalOctopus.ts`
- [ ] Icon: `lorc/octopus` or suitable alternative
- [ ] Effects: FaceDownEffect (30%) + PositionShuffleEffect (20s) + CountdownEffect (10s)
- [ ] Defeat condition: Match 5 face-down cards (`stats.faceDownCardsMatched >= 5`)
- [ ] Tests passing

### 7.3 Feral Fangs
- [ ] Create `src/utils/enemies/tier3/feralFangs.ts`
- [ ] Icon: `lorc/bestial-fangs` or suitable alternative
- [ ] Effects: DudCardEffect (10%) + TripleCardEffect (1) + CardRemovalEffect (12s)
- [ ] Defeat condition: Clear triple card before 5 cards removed (track cards removed, `tripleCardsCleared >= 1` before `cardsRemovedByEnemy >= 5`)
- [ ] Tests passing

### 7.4 Savage Claws
- [ ] Create `src/utils/enemies/tier3/savageClaws.ts`
- [ ] Icon: `lorc/claw-slashes` (already registered)
- [ ] Effects: TimeStealEffect (-4s) + TimerSpeedEffect (1.5x) + BombEffect
- [ ] Defeat condition: Match 8 times total (`stats.totalMatches >= 8`)
- [ ] Tests passing

### 7.5 One-Eyed Terror
- [ ] Create `src/utils/enemies/tier3/oneEyedTerror.ts`
- [ ] Icon: `lorc/cyclops` or suitable alternative
- [ ] Effects: HintDisableEffect (all) + AttributeChangeEffect (12s) + WeaponCounterEffect (hint -55%)
- [ ] Defeat condition: Get 3 all-different matches (`stats.allDifferentMatches >= 3`)
- [ ] Tests passing

### 7.6 Goblin Saboteur
- [ ] Create `src/utils/enemies/tier3/goblinSaboteur.ts`
- [ ] Icon: `lorc/goblin-head` or suitable alternative
- [ ] Effects: WeaponCounterEffect × 3 (pick 3 random weapon types at -50% each)
- [ ] Defeat condition: Trigger 3 different weapon effects (`stats.weaponEffectsTriggered.size >= 3`)
- [ ] Tests passing

### 7.7 Stone Sentinel
- [ ] Create `src/utils/enemies/tier3/stoneSentinel.ts`
- [ ] Icon: `lorc/golem-head` or suitable alternative
- [ ] Effects: TripleCardEffect (2 cards) + WeaponCounterEffect (explosion -55%) + WeaponCounterEffect (laser -55%)
- [ ] Defeat condition: Clear both triple cards (`stats.tripleCardsCleared >= 2`)
- [ ] Tests passing

### 7.8 Wicked Imp
- [ ] Create `src/utils/enemies/tier3/wickedImp.ts`
- [ ] Icon: `lorc/imp` or suitable alternative
- [ ] Effects: DamageMultiplierEffect (2x) + PointsMultiplierEffect (2x) + WeaponCounterEffect (grace -55%) + WeaponCounterEffect (time -55%)
- [ ] Defeat condition: Achieve minimum with 3+ graces unused (`stats.currentScore >= stats.targetScore && stats.gracesRemaining >= 3`)
- [ ] Tests passing

### 7.9 Swarming Ants
- [ ] Create `src/utils/enemies/tier3/swarmingAnts.ts`
- [ ] Icon: `lorc/ant` or suitable alternative
- [ ] Effects: BombEffect (×2 bombs) + WeaponCounterEffect (fire -55%) + CountdownEffect (8s)
- [ ] Defeat condition: Defuse 5 bombs total (`stats.bombsDefused >= 5`)
- [ ] Tests passing

### 7.10 Nightmare Squid
- [ ] Create `src/utils/enemies/tier3/nightmareSquid.ts`
- [ ] Icon: `lorc/giant-squid` or suitable alternative
- [ ] Effects: FaceDownEffect (35% chance, 50% flip) + PositionShuffleEffect (15s) + ScoreDecayEffect (6pts/sec)
- [ ] Defeat condition: Score 200% of target (`stats.currentScore >= stats.targetScore * 2`)
- [ ] Tests passing

### 7.11 Ravenous Tapir
- [ ] Create `src/utils/enemies/tier3/ravenousTapir.ts`
- [ ] Icon: `lorc/tapir` or suitable alternative
- [ ] Effects: ExtraCardRemovalOnMatchEffect (2 cards) + CardRemovalEffect (10s) + TimerSpeedEffect (1.4x)
- [ ] Defeat condition: Achieve minimum with 5+ cards remaining (`stats.currentScore >= stats.targetScore && stats.cardsRemaining >= 5`)
- [ ] Tests passing

### 7.12 Merciless Porcupine
- [ ] Create `src/utils/enemies/tier3/mercilessPorcupine.ts`
- [ ] Icon: `lorc/porcupine` or suitable alternative
- [ ] Effects: ExtraCardRemovalOnInvalidEffect (3 cards) + DamageMultiplierEffect (2x) + PointsMultiplierEffect (2x) + InactivityEffect (35s → instant death)
- [ ] Defeat condition: Make no invalid matches (`stats.invalidMatches === 0 && stats.totalMatches >= 1`)
- [ ] Tests passing

### 7.13 Verification
- [ ] Create `src/utils/enemies/tier3/index.ts` with all exports
- [ ] Update `src/utils/enemies/index.ts` to import tier3
- [ ] Run `npm test -- --testPathPattern="enemies/tier3"` - all tests pass
- [ ] Verify all 12 enemies registered via `getEnemiesByTier(3).length === 12`
- [ ] Commit with message: "feat(enemy): complete all 12 Tier 3 enemies"

---

## Section 8: Tier 4 Bosses (5 total)

> **Note:** These are Round 10 only bosses with severe effects.

### 8.1 Ancient Dragon
- [ ] Create `src/utils/enemies/tier4/ancientDragon.ts`
- [ ] Icon: `lorc/dragon-head` or suitable alternative
- [ ] Effects: TripleCardEffect (3 cards) + AttributeChangeEffect (8s) + TimerSpeedEffect (1.8x) + DamageMultiplierEffect (2x) + PointsMultiplierEffect (2x) + ScoreDecayEffect (8pts/sec)
- [ ] Defeat condition: Clear all 3 triple cards AND get 2 all-different matches (`stats.tripleCardsCleared >= 3 && stats.allDifferentMatches >= 2`)
- [ ] Tests passing

### 8.2 The Hydra
- [ ] Create `src/utils/enemies/tier4/theHydra.ts`
- [ ] Icon: `lorc/hydra` or suitable alternative
- [ ] Effects: InactivityEffect (20s → instant death) + BombEffect (×3) + CountdownEffect (×2, 8s each) + FaceDownEffect (40%) + TimeStealEffect (-6s)
- [ ] Defeat condition: Match 10 times with no invalid matches (`stats.totalMatches >= 10 && stats.invalidMatches === 0`)
- [ ] Tests passing

### 8.3 Kraken's Grasp
- [ ] Create `src/utils/enemies/tier4/krakensGrasp.ts`
- [ ] Icon: `lorc/kraken-tentacle` or suitable alternative
- [ ] Effects: PositionShuffleEffect (10s) + CardRemovalEffect (8s) + DudCardEffect (15%) + All weapon counters at -75%
- [ ] Defeat condition: Survive with 5+ cards remaining (`stats.cardsRemaining >= 5`)
- [ ] Tests passing

### 8.4 The Reaper
- [ ] Create `src/utils/enemies/tier4/theReaper.ts`
- [ ] Icon: `lorc/grim-reaper` or suitable alternative
- [ ] Effects: WeaponCounterEffect (grace -90%) + WeaponCounterEffect (time -90%) + DamageMultiplierEffect (2x) + PointsMultiplierEffect (2x) + ScoreDecayEffect (10pts/sec) + HintDisableEffect (all)
- [ ] Defeat condition: Achieve minimum with 10+ seconds remaining AND 0 damage taken (`stats.currentScore >= stats.targetScore && stats.timeRemaining >= 10 && stats.damageReceived === 0`)
- [ ] Tests passing

### 8.5 World Eater
- [ ] Create `src/utils/enemies/tier4/worldEater.ts`
- [ ] Icon: `lorc/daemon-skull` or suitable alternative
- [ ] Effects: ExtraCardRemovalOnMatchEffect (3 cards) + ExtraCardRemovalOnInvalidEffect (4 cards) + CardRemovalEffect (6s) + InactivityEffect (15s → instant death) + TimerSpeedEffect (2.0x)
- [ ] Defeat condition: Achieve minimum with 4+ cards remaining AND no invalid matches (`stats.currentScore >= stats.targetScore && stats.cardsRemaining >= 4 && stats.invalidMatches === 0`)
- [ ] Tests passing

### 8.6 Verification
- [ ] Create `src/utils/enemies/tier4/index.ts` with all exports
- [ ] Update `src/utils/enemies/index.ts` to import tier4
- [ ] Run `npm test -- --testPathPattern="enemies/tier4"` - all tests pass
- [ ] Verify all 5 bosses registered via `getEnemiesByTier(4).length === 5`
- [ ] Commit with message: "feat(enemy): complete all 5 Tier 4 bosses"

---

## Section 9: Enemy Selection Screen

### 9.1 EnemySelection Component
- [ ] Create `src/components/EnemySelection.tsx`
- [ ] Props: `{ tier: 1|2|3|4, onSelect: (enemy: EnemyInstance) => void }`
- [ ] Display 3 random enemies from the specified tier
- [ ] Each enemy card shows:
  - [ ] Name and icon (large, centered)
  - [ ] Tier badge
  - [ ] Description (all effects with values)
  - [ ] Defeat condition text
  - [ ] Difficulty indicator based on effects
- [ ] "Choose Enemy" button for each card
- [ ] Animation when selecting
- [ ] Create `__tests__/EnemySelection.test.tsx`
- [ ] Tests passing

### 9.2 Enemy Card Component
- [ ] Create `src/components/EnemyCard.tsx`
- [ ] Props: `{ enemy: EnemyInstance, onSelect: () => void, selected?: boolean }`
- [ ] Render enemy icon, name, tier
- [ ] Render description (effects list)
- [ ] Render defeat condition
- [ ] Show difficulty rating (easy/medium/hard based on tier and effect count)
- [ ] Highlight when selected
- [ ] Create `__tests__/EnemyCard.test.tsx`
- [ ] Tests passing

### 9.3 Game Flow Integration
- [ ] Add `enemy_selection` phase to GamePhase enum in types.ts
- [ ] Update Game.tsx to show EnemySelection between character selection and round start
- [ ] Pass selected enemy to GameBoard
- [ ] Store selected enemy in game state
- [ ] Track if enemy was defeated for bonus reward

### 9.4 LevelUp Integration (Slayer Reward)
- [ ] Update LevelUp.tsx to accept `enemyDefeated: boolean` prop
- [ ] If enemyDefeated, show bonus "Slayer Reward" weapon
- [ ] Slayer Reward is a higher-rarity weapon based on enemy tier:
  - Tier 1: Guaranteed Rare
  - Tier 2: 50% Rare, 50% Legendary
  - Tier 3: Guaranteed Legendary
  - Tier 4: Guaranteed Legendary + bonus gold
- [ ] Visual distinction for Slayer Reward (golden border, "SLAYER BONUS" label)

### 9.5 Verification
- [ ] Run `npm test` - all tests pass
- [ ] Run `npm run typecheck` - no type errors
- [ ] Manual test full flow: Character → Enemy Selection → Round → Level Up with Slayer Reward
- [ ] Commit with message: "feat(enemy): add enemy selection screen and slayer rewards"

---

## Section 10: Final Integration & Polish

### 10.1 Icon Registration
- [ ] Verify all enemy icons exist in assets/icons/
- [ ] Register any missing icons in Icon.tsx
- [ ] Run `npm run validate:icons` - all pass
- [ ] Update any placeholder icons with correct ones

### 10.2 Full Test Suite
- [ ] Run `npm test` - all tests pass
- [ ] Run `npm run typecheck` - no type errors
- [ ] Run `npm run lint` - no lint errors

### 10.3 Manual Testing
- [ ] Test each Tier 1 enemy in `/dev/play`
- [ ] Test each Tier 2 enemy
- [ ] Test each Tier 3 enemy
- [ ] Test each Tier 4 boss
- [ ] Test enemy selection flow
- [ ] Test slayer rewards
- [ ] Test defeat conditions for at least 5 different enemies

### 10.4 Final Commit
- [ ] Increment version in package.json
- [ ] Commit with message: "feat(enemy): complete enemy system implementation"
- [ ] Push to remote
- [ ] Report version number

---

## Summary

| Section | Items | Status |
|---------|-------|--------|
| 1. Types & Interfaces | Complete | ✅ |
| 2. Factory & Dummy | Complete | ✅ |
| 3. Effect Behaviors | Complete | ✅ |
| 4. Tier 1 Enemies | 22/22 complete | ✅ |
| 5. GameBoard Integration | 5.1-5.3 Complete (lifecycle hooks integrated, Card visuals done, weapon counters pending) | 🔄 |
| 6. Tier 2 Enemies | 0/12 complete | ⏳ |
| 7. Tier 3 Enemies | 0/12 complete | ⏳ |
| 8. Tier 4 Bosses | 0/5 complete | ⏳ |
| 9. Enemy Selection | Not started | ⏳ |
| 10. Final Integration | Not started | ⏳ |

**Total Enemies:** 51 (22 Tier 1 + 12 Tier 2 + 12 Tier 3 + 5 Tier 4)

**Implementation Order:**
1. ~~Section 1-3~~ (Complete)
2. Section 4: Complete remaining Tier 1 enemies (15 more)
3. **Section 5: GameBoard Integration** (PRIORITY)
4. Section 6-8: Tier 2-4 enemies (after integration verified)
5. Section 9: Enemy Selection Screen
6. Section 10: Final polish
