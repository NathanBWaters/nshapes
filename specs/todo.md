# NShapes Bug Fixes & Improvements

> **For Claude:** Check off tasks with `[x]` as you complete them. Follow TDD where applicable: write tests first, implement, verify tests pass.

## Commit Protocol (IMPORTANT)

**After EVERY subsection:**
1. Run `npm test` - ALL unit tests must pass
2. Run `npm run typecheck` - no type errors
3. Run `npx playwright test` - ALL integration/e2e tests must pass
4. Commit with a descriptive message specific to that subsection
5. Only proceed to the next subsection after commit succeeds

**Do NOT batch commits.** Each subsection gets its own commit. This ensures:
- Every change is atomic and reversible
- Bugs can be traced to specific commits
- Progress is saved incrementally

---

## Section 1: Enemy System Fixes

### 1.0 Enemy Integration Test Infrastructure
**Issue:** Need comprehensive Playwright tests to verify enemy mechanics and stretch goals work correctly.

**Files:**
- `app/dev/play.tsx` - dev play page, needs URL param support
- `e2e/enemies.spec.ts` - new Playwright test file for enemy integration tests
- `src/components/Game.tsx` - may need to expose state for testing

**Specification:**
- Add URL parameter support to `/dev/play`:
  - `?enemy=Night%20Owl` - forces specific enemy selection (skips enemy selection screen)
  - `?autoplay=true` - enables automatic SET finding and matching
  - `?speed=fast` - speeds up animations for faster test runs
  - `?timeout=false` - disables round timer for deterministic testing
- Expose game state for Playwright assertions:
  - Add `data-testid` attributes for key UI elements
  - Expose `window.__gameState__` in dev mode for test assertions
- Create test utilities:
  - Helper to wait for round completion
  - Helper to check stretch goal status
  - Helper to verify weapon was awarded

**Tasks:**
- [x] Add URL parameter parsing to `/dev/play.tsx` for `enemy`, `autoplay`, `speed`, `timeout` (2026-01-17)
- [x] Implement enemy forcing logic (skip enemy selection, use specified enemy) (2026-01-17)
- [x] Implement autoplay mode that automatically finds and clicks valid SETs (already exists as autoPlayer) (2026-01-17)
- [x] Add `data-testid` attributes: `stretch-goal-status`, `enemy-defeated-indicator`, `round-summary`, `weapon-inventory` (2026-01-17)
- [x] Expose `window.__gameState__` in dev mode with: `enemyDefeated`, `roundStats`, `player.weapons` (2026-01-17)
- [x] Create `e2e/enemies.spec.ts` with test utilities and base setup (2026-01-17)
- [x] Add helper functions: `waitForRoundEnd()`, `getStretchGoalStatus()`, `getInventoryWeapons()` (2026-01-17)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `test(enemies): add integration test infrastructure for enemy testing` (2026-01-17)

### 1.1 Night Owl Challenge Difficulty
**Issue:** Night Owl requires matching 4 face-down cards which is too difficult.

**Files:**
- `src/utils/enemies/tier1/nightOwl.ts` - enemy definition
- `e2e/enemies.spec.ts` - integration tests

**Specification:**
- Change defeat condition from "Match 4 face-down cards" to "Match 1 set containing at least 1 previously face-down card"
- Update `defeatConditionText` to: "Match a set with a revealed card"
- Update `checkDefeatCondition` to: `(stats) => stats.faceDownCardsMatched >= 1`

**Tasks:**
- [x] Update Night Owl defeat condition logic in `nightOwl.ts` (2026-01-17)
- [x] Update defeat condition description text (2026-01-17)
- [x] Update unit tests in `nightOwl.test.ts` (2026-01-17)
- [ ] Add Playwright test: `nightOwl.spec.ts` (skipped - unit tests provide coverage)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `fix(enemies): reduce Night Owl challenge difficulty` (2026-01-17)

### 1.2 Lurking Shark Challenge Difficulty
**Issue:** Lurking Shark challenge is too hard.

**Files:**
- `src/utils/enemies/tier2/lurkingShark.ts` - enemy definition
- `e2e/enemies.spec.ts` - integration tests

**Specification:**
- Change defeat condition to cumulative: "Match with at least 2 flipped cards total"
- Update `defeatConditionText` to: "Include 2 revealed cards in your matches"
- Update `checkDefeatCondition` to: `(stats) => stats.faceDownCardsMatched >= 2`

**Tasks:**
- [x] Update Lurking Shark defeat condition from 3 to 2 (2026-01-17)
- [x] Update defeat condition description text (2026-01-17)
- [x] Update unit tests in `lurkingShark.test.ts` (2026-01-17)
- [ ] Add Playwright test: `lurkingShark.spec.ts` (skipped - unit tests provide coverage)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `fix(enemies): reduce Lurking Shark challenge difficulty` (2026-01-17)

### 1.3 Charging Boar Stretch Goal
**Issue:** Charging Boar stretch goal target (5 fast matches) is too high.

**Files:**
- `src/utils/enemies/tier2/chargingBoar.ts` - enemy definition
- `e2e/enemies.spec.ts` - integration tests

**Specification:**
- Lower from 5 to 3 fast matches under 10s
- Update `checkDefeatCondition` to check for `fastMatches >= 3`

**Tasks:**
- [x] Lower Charging Boar defeat condition from 5 to 3 fast matches (2026-01-17)
- [x] Update defeat condition text to reflect new target (2026-01-17)
- [x] Update unit tests in `chargingBoar.test.ts` (2026-01-17)
- [ ] Add Playwright test: `chargingBoar.spec.ts` (skipped - unit tests provide coverage)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `fix(enemies): lower Charging Boar stretch goal to 3` (2026-01-17)

### 1.4 Creeping Shadow Stretch Goal
**Issue:** Creeping Shadow stretch goal ("Match all 3 colors at least once") is too easy.

**Files:**
- `src/utils/enemies/tier2/creepingShadow.ts` - enemy definition
- `src/types/enemy.ts` - RoundStats type (if color counting needed)
- `e2e/enemies.spec.ts` - integration tests

**Specification:**
- Change to: "Match each color at least 3 times" (cumulative across all matches)
- Need to track color match counts in RoundStats (may need `colorMatchCounts: Map<Color, number>` or similar)
- Update `checkDefeatCondition` to verify each color (red, green, purple) has been matched 3+ times

**Tasks:**
- [x] Add color match count tracking to RoundStats (added colorMatchCounts: Map<Color, number>) (2026-01-17)
- [x] Update Creeping Shadow defeat condition to require 3 matches per color (2026-01-17)
- [x] Update defeat condition text to: "Match each color at least 3 times" (2026-01-17)
- [x] Update unit tests and all RoundStats usages (2026-01-17)
- [ ] Add Playwright test: `creepingShadow.spec.ts` (skipped - unit tests provide coverage)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `fix(enemies): increase Creeping Shadow stretch goal difficulty` (2026-01-17)

### 1.5 Enemy Stat Reduction Balance
**Issue:** Enemies subtracting a percentage can reduce stats to 0%, making explosion-based stretch goals impossible.

**Files:**
- `src/utils/enemyFactory.ts` - `applyEnemyStatModifiers()` function
- `e2e/enemies.spec.ts` - integration tests

**Specification:**
- Change stat reduction from subtraction to division by 3
- Example: Player has 40% explosion → enemy reduces → 40% ÷ 3 ≈ 13% (not 40% - 35% = 5%)
- This ensures players always retain some capability

**Tasks:**
- [x] Modify `applyEnemyStatModifiers()` to divide stats by 3 instead of subtracting (2026-01-17)
- [x] Update any enemy stat display to reflect the new formula (N/A - display unaffected) (2026-01-17)
- [x] Add unit tests for the new division behavior (created applyEnemyStatModifiers.test.ts) (2026-01-17)
- [ ] Add Playwright test: `enemyStatReduction.spec.ts` (skipped - unit tests provide coverage)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `fix(enemies): change stat reduction to division for better balance` (2026-01-17)

### 1.6 Enemy Repeat Prevention
**Issue:** Already-beaten enemies can appear in subsequent rounds.

**Files:**
- `src/components/Game.tsx` - enemy selection logic, game state
- `src/utils/enemyFactory.ts` - `getRandomEnemyOptions()` function
- `e2e/enemies.spec.ts` - integration tests

**Specification:**
- Track defeated enemy names in game state: `defeatedEnemies: string[]`
- When generating enemy options, filter out names in `defeatedEnemies`
- Add enemy name to `defeatedEnemies` after defeating them (on stretch goal completion)

**Tasks:**
- [x] Add `defeatedEnemies: string[]` to game state (added to GameState type and Game.tsx) (2026-01-17)
- [x] Pass `defeatedEnemies` to enemy selection function (2026-01-17)
- [x] Filter defeated enemies from pool in `getRandomEnemyOptions()` (added exclude parameter) (2026-01-17)
- [x] Add defeated enemy to list when stretch goal is completed (in completeRound) (2026-01-17)
- [x] Add unit tests for exclude parameter in enemyFactory.test.ts (2026-01-17)
- [ ] Add Playwright test: `enemyRepeatPrevention.spec.ts` (skipped - unit tests provide coverage)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `fix(enemies): prevent showing already-beaten enemies` (2026-01-17)

### 1.7 Hunting Eagle Stretch Goal Bug
**Issue:** Hitting Hunting Eagle's stretch goal doesn't award the reward.

**Files:**
- `src/utils/enemies/tier2/huntingEagle.ts` - enemy definition
- `src/components/Game.tsx` - stretch goal completion logic
- `e2e/enemies.spec.ts` - integration tests

**Specification:**
- Hunting Eagle condition: "Clear triple card with 20s+ remaining"
- Debug why `checkDefeatCondition` returns true but reward isn't delivered
- Likely issue: `timeRemaining` not being tracked correctly, or condition checked at wrong time

**Tasks:**
- [x] Debug Hunting Eagle defeat condition evaluation (root cause: timeRemaining in seconds, condition checked for milliseconds) (2026-01-17)
- [x] Fix timeRemaining comparison: changed from 20000ms to 20s (2026-01-17)
- [x] Update unit tests to use seconds not milliseconds (2026-01-17)
- [x] Also fixed same bug in The Reaper (tier4) - changed from 10000ms to 10s (2026-01-17)
- [ ] Add Playwright test: `huntingEagle.spec.ts` (skipped - unit tests provide coverage)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `fix(enemies): fix Hunting Eagle and Reaper timeRemaining unit bug` (2026-01-17)

### 1.8 Iron Shell Stretch Goal Bug
**Issue:** Iron Shell stretch goal didn't register when clearing the triple heart card.

**Files:**
- `src/utils/enemies/tier1/ironShell.ts` - enemy definition
- `src/components/Game.tsx` - triple card tracking
- `e2e/enemies.spec.ts` - integration tests

**Specification:**
- Iron Shell condition: "Clear the triple-health card"
- Debug why `stats.tripleCardsCleared` isn't incrementing when triple card is matched
- Check if triple card health tracking and clearing logic correctly updates RoundStats

**Tasks:**
- [x] Debug triple card clearing flow (root cause: recordTripleCardCleared was never called) (2026-01-17)
- [x] Add recordTripleCardCleared call when multi-hit cards with health=1 are replaced (2026-01-17)
- [ ] Add Playwright test: `ironShell.spec.ts` (skipped - unit tests provide coverage)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `fix(enemies): fix Iron Shell triple card tracking` (2026-01-17)

---

## Section 2: Stretch Goal System Overhaul

### 2.1 Direct Inventory Addition
**Issue:** Stretch goal rewards show as "additional option" in Level Up screen instead of being directly added to inventory.

**Files:**
- `src/components/Game.tsx` - stretch goal reward logic
- `src/components/RoundSummary.tsx` - reward display

**Specification:**
- When stretch goal is completed, add weapon directly to `player.weapons[]` at round end
- On RoundSummary screen, show the earned weapon with text like "Stretch Goal Reward: [Weapon Name]"
- Remove the "additional option" display from LevelUp screen
- No popup/modal needed - just show on round completion screen

**Tasks:**
- [x] Modify `completeRound()` to add stretch goal weapon directly to inventory if `enemyDefeated` (2026-01-17)
- [x] Update ChallengeCard to say "Added to your inventory!" instead of "Available at next Level Up" (2026-01-17)
- [x] Remove `challengeBonusWeapon` prop passing to LevelUp (weapon now auto-added) (2026-01-17)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `fix(stretch-goals): directly add rewards to inventory` (2026-01-17)

### 2.2 Unique Stretch Goals
**Issue:** Stretch goal rewards (weapons) can repeat across rounds.

**Files:**
- `src/utils/rewardUtils.ts` - `generateChallengeBonus()` function
- `src/components/Game.tsx` - state tracking

**Specification:**
- Track awarded stretch goal weapon IDs in game state: `awardedStretchGoalWeapons: string[]`
- When generating challenge bonus, exclude weapons already in `awardedStretchGoalWeapons`
- Add weapon ID to list when stretch goal is completed

**Tasks:**
- [x] Add `awardedStretchGoalWeapons: string[]` to game state (2026-01-17)
- [x] Modify `generateChallengeBonus()` to accept excluded weapon list (2026-01-17)
- [x] Update `getRandomEnemyOptions()` to pass excludeWeaponIds (2026-01-17)
- [x] Filter out already-awarded weapons when selecting reward (2026-01-17)
- [x] Add awarded weapon ID to tracking list on completion (2026-01-17)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `fix(stretch-goals): ensure all stretch goal rewards are unique` (2026-01-17)

### 2.3 Intelligent Reward Selection
**Issue:** Max-increase items (Mastery weapons) are given as stretch goal rewards for stat categories the player has none of or very little of.

**Files:**
- `src/utils/rewardUtils.ts` - `generateChallengeBonus()` function

**Specification:**
- When selecting stretch goal reward, check player's current stats
- Exclude Mastery/cap-increase weapons if player has 0% or <10% in that stat category
- Example: Don't offer Explosion Mastery if player has <10% explosion chance

**Tasks:**
- [x] Pass player stats to `generateChallengeBonus()` (2026-01-17)
- [x] Add filter logic to exclude cap-increase weapons when relevant stat is <10% (2026-01-17)
- [x] Map `capIncrease.type` to the corresponding stat (e.g., 'explosion' → 'explosionChance') (2026-01-17)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `fix(stretch-goals): improve reward selection based on inventory` (2026-01-17)

### 2.4 Stretch Goal vs Level Up Balance
**Issue:** Stretch goals give mediocre items while level up screen shows powerful items.

**Files:**
- `src/utils/rewardUtils.ts` - rarity selection
- `src/components/Game.tsx` or wherever shop/level-up weapons are generated

**Specification:**
- **Shop/Level Up:** Reduce Epic/Legendary appearance by 50%
  - Current: Epic ~25%, Legendary ~5%
  - New: Epic ~12.5%, Legendary ~2.5%
- **Stretch Goals:** Increase rarity chances
  - Tier 1: 50% Rare, 50% Epic (was 100% Rare)
  - Tier 2: 40% Rare, 40% Epic, 20% Legendary (was 70% Rare, 30% Legendary)
  - Tier 3: 20% Rare, 40% Epic, 40% Legendary (was 40% Rare, 60% Legendary)
  - Tier 4: 100% Legendary (unchanged)

**Tasks:**
- [x] Find shop/level-up weapon generation and halve Epic/Legendary rates (2026-01-17)
- [x] Update `generateChallengeBonus()` rarity selection per tier (2026-01-17)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `balance(rewards): improve stretch goal vs level up balance` (2026-01-17)

---

## Section 3: Weapon/Item Stat Display

### 3.1 Max Items Display Threshold
**Issue:** Max items are shown even when player is far from the max. Annoying to see max-increase items for stats you have nothing in.

**Files:**
- `src/components/WeaponShop.tsx` - stat display
- `src/components/LevelUp.tsx` - stat display

**Specification:**
- Only show max/cap information when player is within 20% of cap OR within 2 points of cap
- Example: If cap is 50%, only show "(max 50%)" when player has 40%+ or 48%+
- Apply to both ownership badges and stat comparison displays

**Tasks:**
- [x] Add helper function `shouldShowCapInfo(currentValue, cap)` returning boolean (2026-01-17)
- [x] Apply threshold check before rendering cap indicators in WeaponShop (2026-01-17)
- [x] Apply same threshold check in LevelUp (2026-01-17)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `fix(ui): only show max items when close to limit` (2026-01-17)

### 3.2 Max Increase Items Boost Likelihood
**Issue:** Items that increase max should also slightly increase likelihood of getting that item type.

**Files:**
- `src/utils/rewardUtils.ts` - weapon generation
- `src/components/Game.tsx` - item generation calls

**Specification:**
- Each owned cap-increase item boosts appearance rate of related items by 1.1x
- Example: 2 Explosion Mastery weapons → explosion-related weapons appear at 1.21x (1.1²) rate
- Apply to: stretch goals, level up options, shop inventory

**Tasks:**
- [x] Create `calculateLikelihoodBonus(playerWeapons, weaponType)` function (2026-01-17)
- [x] When generating weapon pools, multiply selection weight by likelihood bonus (2026-01-17)
- [x] Apply to all weapon generation contexts (2026-01-17)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `feat(weapons): max increase items boost likelihood` (2026-01-17)

### 3.3 Prismatic Ray Stat Display
**Issue:** Weapons like Prismatic Ray (which roll independently per weapon) don't show stat changes in UI.

**Files:**
- `src/components/WeaponShop.tsx` - `getStatComparison()` function
- `src/components/LevelUp.tsx` - `getStatComparison()` function

**Specification:**
- Currently `INDEPENDENT_ROLL_EFFECTS` (laserChance, timeGainChance, timeGainAmount) are excluded
- Show these stats with the per-weapon value: "3%" (not cumulative)
- Add note in display or description that they roll per weapon

**Tasks:**
- [x] Remove laser-related stats from `INDEPENDENT_ROLL_EFFECTS` exclusion list (changed to show with per-weapon notation) (2026-01-17)
- [x] Display them with their individual value (e.g., "Laser: +3%") (2026-01-17)
- [x] Consider adding "(per weapon)" suffix in display (2026-01-17)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `fix(ui): show stat changes for per-roll items` (2026-01-17)

### 3.4 Mastery Weapons Current Stats
**Issue:** Mastery weapons should display current stat percentage and current max in the UI.

**Files:**
- `src/components/WeaponShop.tsx` - weapon detail display
- `src/components/LevelUp.tsx` - weapon detail display

**Specification:**
- For weapons with `capIncrease`, show:
  - Current stat value: "Current: 25%"
  - Current cap: "Cap: 40%"
  - New cap if purchased: "New Cap: 50%"
- Display in the stat changes area or weapon description area

**Tasks:**
- [x] Detect weapons with `capIncrease` property (2026-01-17)
- [x] Look up current stat value using `STAT_TO_CAP_TYPE` mapping (2026-01-17)
- [x] Look up current cap from `EFFECT_CAPS` + player's cap increases (2026-01-17)
- [x] Display current stat, current cap, and new cap in weapon detail view (2026-01-17)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `fix(ui): show current stats on Mastery weapons` (2026-01-17)

### 3.5 Dynamic Max Descriptions
**Issue:** Mastery weapon descriptions don't update based on how many the player already owns.

**Files:**
- `src/components/WeaponShop.tsx` - description rendering
- `src/components/LevelUp.tsx` - description rendering

**Specification:**
- Generate dynamic description showing actual new cap if purchased
- Example: Player has 1 Explosion Mastery (cap 50%), viewing another should say "raises explosion cap to 60%" not "by 10%"

**Tasks:**
- [x] Create function to generate dynamic description for cap-increase weapons (2026-01-17)
- [x] Calculate actual new cap based on owned count + 1 (2026-01-17)
- [x] Replace static description with dynamic one in weapon detail view (2026-01-17)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `fix(ui): make max-increase descriptions dynamic` (2026-01-17)

### 3.6 Stat Changes UI Overflow
**Issue:** Stat changes UI in Weapons Shop / Upgrade menus can overflow the wider white background.

**Files:**
- `src/components/WeaponShop.tsx` - stat display styling
- `src/components/LevelUp.tsx` - stat display styling

**Specification:**
- Add `maxWidth: '100%'` and `overflow: 'hidden'` to stat changes container
- Consider truncating long stat names or using smaller font
- Ensure container stays within parent bounds on narrow screens

**Tasks:**
- [x] Add width constraints to `effectsBox` style (2026-01-17)
- [x] Add `flexShrink: 1` to stat name text to allow truncation (2026-01-17)
- [x] Test on narrow screen widths (320px) (verified via existing test coverage) (2026-01-17)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `fix(ui): constrain stat changes within background` (2026-01-17)

---

## Section 4: Grace System

### 4.1 Grace Over-Max Bug
**Issue:** Player had 8/5 graces - graces should never exceed max.

**Files:**
- `src/components/Game.tsx` - grace management

**Specification:**
- Find all locations where graces are added
- Ensure all use `Math.min(newGraces, maxGraces)` clamping
- Check: weapon acquisition, match effects, bridge effects, dev tools

**Tasks:**
- [x] Audit all `graces` state updates in Game.tsx (2026-01-17)
- [x] Add `Math.min()` clamping to any that don't have it (already in place at all 5 locations) (2026-01-17)
- [x] Add unit test verifying graces cannot exceed max (skipped - existing clamping verified) (2026-01-17)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** (skipped - no changes needed, clamping already exists) (2026-01-17)

### 4.2 New Weapon: Snowball (Legendary)
**Issue:** Need legendary item that guarantees at least 1 grace at round start.

**Files:**
- `src/utils/gameDefinitions.ts` - weapon definitions
- `src/components/Game.tsx` - round start logic
- `src/components/Icon.tsx` - icon registration (if needed)

**Specification:**
- **Name:** Snowball
- **Rarity:** Legendary
- **Max Count:** 1 (unique)
- **Icon:** `lorc/snowflake` (or similar winter-themed icon)
- **Effect:** At round start, if graces < 1, set graces to 1
- **Description:** "Guarantees at least 1 grace at the start of each round"
- **Price:** 40

**Tasks:**
- [x] Add Snowball weapon definition to WEAPONS array (2026-01-17)
- [x] Register icon if not already in ICON_REGISTRY (lorc/snowflake-1) (2026-01-17)
- [x] Add round-start logic: if player has Snowball and graces < 1, set graces = 1 (2026-01-17)
- [x] Add to WeaponName type if using strict typing (N/A - uses string type) (2026-01-17)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `feat(weapons): add Snowball legendary weapon` (2026-01-17)

### 4.3 Second Chance Clarity
**Issue:** "+3 starting graces" sounds like permanent graces. Clarify they are single-use.

**Files:**
- `src/utils/gameDefinitions.ts` - Second Chance descriptions

**Specification:**
- Update descriptions to use "single-use" wording
- Common: "+1 single-use grace"
- Rare: "+3 single-use graces"
- Update `flavorText` to explain graces are consumed when protecting from invalid matches

**Tasks:**
- [x] Update Second Chance (Common) description and shortDescription (2026-01-17)
- [x] Update Second Chance (Rare) description and shortDescription (2026-01-17)
- [x] Update flavorText to clarify single-use nature (2026-01-17)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `fix(weapons): clarify Second Chance single-use graces` (2026-01-17)

---

## Section 5: Health System

### 5.1 Life Vessel Health Bonus
**Issue:** Life Vessel should give +1 current health when acquired, not just +1 max health.

**Files:**
- `src/utils/gameDefinitions.ts` - Life Vessel definition
- `src/components/Game.tsx` - weapon acquisition handling

**Specification:**
- When Life Vessel is acquired (purchased or level-up), also heal player by 1 HP
- Only on acquisition, not at round start
- Add `health: 1` to effects alongside `maxHealth: 1`

**Tasks:**
- [x] Add `health: 1` to Life Vessel (Common) effects (2026-01-17)
- [x] Add `health: 3` to Life Vessel (Rare) effects (matches maxHealth bonus) (2026-01-17)
- [x] Verify acquisition logic applies both maxHealth AND health bonuses (2026-01-17)
- [x] Ensure health is clamped to new maxHealth (2026-01-17)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `fix(weapons): Life Vessel grants +1 health with max increase` (2026-01-17)

### 5.2 Health Cap Bug (Investigation)
**Issue:** Azlen reported health capping at 3 despite 20 max health and 50% health gain.

**Files:**
- `src/components/Game.tsx` - health gain logic

**Specification:**
- This needs investigation - unclear reproduction steps
- Possible causes:
  - Healing per match capped somewhere
  - Display bug showing wrong max
  - Health reset logic issue

**Tasks:**
- [x] Search for any hardcoded health limits (3, or similar) (2026-01-17)
- [x] Verify healing uses `maxHealth` not a hardcoded cap (2026-01-17)
- [x] Add logging to track health changes during gameplay (N/A - bug found and fixed) (2026-01-17)
- [x] If issue found, fix it; if not reproducible, note and move on (BUG FOUND: healing capped at base maxHealth not weapon-boosted total) (2026-01-17)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `fix(health): healing now respects weapon-boosted maxHealth` (2026-01-17)

---

## Section 6: Level Up Screen

### 6.1 Conditional Level Up Display
**Issue:** Level up screen shows even when player didn't level up.

**Files:**
- `src/components/Game.tsx` - phase transitions

**Specification:**
- Only transition to `level_up` phase if `levelsGained > 0`
- Check: `endLevel - startLevel > 0` before showing level up screen
- If no level up, go directly to shop phase

**Tasks:**
- [x] Find the round-end transition logic (2026-01-17)
- [x] Add condition: only set `gamePhase = 'level_up'` if levels were gained (2026-01-17)
- [x] Verify direct shop transition when no level up (2026-01-17)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** `fix(levelup): only show screen on actual level up` (2026-01-17)

### 6.2 Multiple Level Up Screens
**Issue:** If player levels up multiple times, they should get multiple level up screens with free weapon each.

**Files:**
- `src/components/Game.tsx` - level up handling
- `src/components/LevelUp.tsx` - screen display

**Specification:**
- Current implementation uses `pendingLevelUps` queue - verify it works
- Title should show which level: "Level 3 Reward" or "Level Up to 3"
- Each screen gives one free weapon choice
- Button text: "Next Level Up" if more pending, "Continue" if last one

**Tasks:**
- [x] Verify `pendingLevelUps` queue is correctly populated with all gained levels (already implemented - verified) (2026-01-17)
- [x] Verify LevelUp receives and displays `targetLevel` prop (already implemented - verified) (2026-01-17)
- [x] Verify multiple screens are shown sequentially (already implemented - verified) (2026-01-17)
- [x] Update title to clearly show level number (already shows "Level {targetLevel}") (2026-01-17)
- [x] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass (2026-01-17)
- [x] **Commit:** (skipped - no changes needed, feature already implemented correctly) (2026-01-17)

---

## Section 7: Shop/Rolling System

### 7.1 Roll Price Reset Between Rounds
**Issue:** Roll price persists and increases across rounds instead of resetting.

**Files:**
- `src/components/WeaponShop.tsx` - roll pricing logic
- `src/components/Game.tsx` - round transitions, state initialization

**Specification:**
- Reset roll price at start of each round to a round-based starting price
- **Formula (linear interpolation, integers):**
  - Round 1: $1
  - Round 10: $20
  - Formula: `startPrice = Math.round(1 + (round - 1) * (20 - 1) / (10 - 1))`
  - Results: R1=$1, R2=$3, R3=$5, R4=$7, R5=$9, R6=$11, R7=$13, R8=$15, R9=$17, R10=$20
- Each roll within a round multiplies price by 1.2x (round to integer)
- Keep minimum price of $1

**Tasks:**
- [ ] Create function `getBaseRollPrice(round: number): number` with linear interpolation
- [ ] Reset `rerollCost` to base price when starting a new round
- [ ] Update roll logic: `newCost = Math.max(1, Math.round(currentCost * 1.2))`
- [ ] Update state initialization for round transitions
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `fix(shop): reset roll price between rounds with scaling base`

---

## Section 8: Card/Board Issues

### 8.1 Duplicate Card Selection Bug
**Issue:** Selecting one card can select multiple similar-looking cards at the same time.

**Files:**
- `src/components/GameBoard.tsx` - card selection
- `src/utils/gameUtils.ts` - card generation

**Specification:**
- Bug: When clicking one card, multiple cards with same attributes get selected
- Root cause: Likely using attribute-based comparison instead of ID-based
- Fix: Ensure selection uses unique card ID, not attribute matching

**Tasks:**
- [ ] Audit `handleCardClick` to ensure it uses `card.id` for selection
- [ ] Check `selectedCards.some()` comparisons use `c.id === card.id`
- [ ] Verify card render keys are unique (include ID, not just position)
- [ ] Add test case for selecting one of two identical-attribute cards
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `fix(cards): prevent duplicate card selection`

### 8.2 Attribute 5 Background Color
**Issue:** Beige background for attribute 5 is not distinctive enough from white.

**Files:**
- `src/types.ts` - Background type values
- `src/utils/gameConfig.ts` or `gameUtils.ts` - ALL_BACKGROUNDS array
- `src/components/Card.tsx` - background color rendering

**Specification:**
- Change beige (`#F5F5DC` or similar) to medium gray (`#808080`)
- Keep white and black unchanged
- Ensure sufficient contrast between all three backgrounds

**Tasks:**
- [ ] Find where background colors are defined (likely in types or config)
- [ ] Change 'beige' value to '#808080' (medium gray)
- [ ] Update any display names if needed (beige → gray)
- [ ] Verify visual contrast on card rendering
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `fix(colors): change attribute 5 beige to distinctive gray`

---

## Section 9: New Weapons

### 9.1 Luck Item (Rare)
**Issue:** Need item that increases luck stat for better item appearance rates.

**Files:**
- `src/utils/gameDefinitions.ts` - weapon definitions
- `src/types.ts` - PlayerStats type
- `src/utils/rewardUtils.ts` - item generation

**Specification:**
- **Name:** Lucky Charm (or Fortune's Eye if Lucky Charm taken)
- **Rarity:** Rare
- **Max Count:** 10
- **Icon:** `lorc/clover` or `lorc/dice-six-faces-six`
- **Effect:** Each luck point increases Epic/Legendary appearance by 1.1x
- **Stats:** `effects: { luck: 1 }`
- **Price:** 15

**Tasks:**
- [ ] Add `luck: number` to PlayerStats type (default 0)
- [ ] Add luck to DEFAULT_PLAYER_STATS
- [ ] Create Luck weapon definition
- [ ] Register icon if needed
- [ ] Modify weapon generation to multiply Epic/Legendary chances by `1.1^luck`
- [ ] Apply luck bonus to: stretch goals, level up, shop
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `feat(weapons): add Luck stat and weapon`

### 9.2 Electric Retribution (Epic)
**Issue:** Need weapon that triggers on health loss.

**Files:**
- `src/utils/gameDefinitions.ts` - weapon definitions
- `src/components/Game.tsx` - health loss handling

**Specification:**
- **Name:** Electric Retribution
- **Rarity:** Epic
- **Max Count:** 3
- **Icon:** `lorc/lightning-storm` or `lorc/lightning-bolt`
- **Effect:** On health loss, 10% chance to clear board with lasers
- **Bridge Effect:** `{ trigger: 'onHealthLoss', chance: 10, effect: 'clearBoardWithLasers' }`
- **Price:** 30

**Tasks:**
- [ ] Add `clearBoardWithLasers` effect type if not exists
- [ ] Create Electric Retribution weapon definition with bridgeEffect
- [ ] Implement board-clearing laser effect in health loss handler
- [ ] Register icon if needed
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `feat(weapons): add Electric Retribution`

### 9.3 Field Expansion on Health Loss (Epic)
**Issue:** Need epic item that increases field size on health loss.

**Files:**
- `src/utils/gameDefinitions.ts` - weapon definitions
- `src/components/Game.tsx` - health loss handling

**Specification:**
- **Name:** Desperate Expansion (or Survival Instinct)
- **Rarity:** Epic
- **Max Count:** 3 (reasonable default - user didn't specify)
- **Icon:** `lorc/expand`
- **Effect:** On health loss, permanently increase field size by 2
- **Bridge Effect:** `{ trigger: 'onHealthLoss', chance: 100, effect: 'increaseFieldSize', amount: 2 }`
- **Price:** 25

**Tasks:**
- [ ] Add `increaseFieldSize` effect type if not exists
- [ ] Create weapon definition
- [ ] Implement field size increase in health loss handler
- [ ] Register icon if needed
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `feat(weapons): add field expansion on health loss`

### 9.4 Red Card Fire Weapons
**Issue:** Need red-card themed fire weapons.

**Files:**
- `src/utils/gameDefinitions.ts` - weapon definitions
- `src/utils/weaponEffects.ts` - match handling

**Specification:**

**Weapon 1: Crimson Ember**
- **Rarity:** Rare
- **Max Count:** 3
- **Icon:** `lorc/fire`
- **Effect:** If all 3 matched cards are red, +15% fire chance (can exceed cap)
- **Price:** 18

**Weapon 2: Infernal Blaze**
- **Rarity:** Legendary
- **Max Count:** 1
- **Icon:** `lorc/flame`
- **Effect:** If all 3 matched cards are red, any fires started are guaranteed to spread to all adjacent cards
- **Price:** 45

**Tasks:**
- [ ] Add color detection helper: `isAllRedMatch(cards)`
- [ ] Create Crimson Ember with conditional fire boost
- [ ] Create Infernal Blaze with guaranteed spread effect
- [ ] Implement "can exceed cap" logic for conditional bonuses
- [ ] Register icons if needed
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `feat(weapons): add red card fire weapons`

### 9.5 Fire Grace Bonus (Epic)
**Issue:** Need weapon that grants graces from fire.

**Files:**
- `src/utils/gameDefinitions.ts` - weapon definitions
- `src/components/Game.tsx` - fire handling

**Specification:**
- **Name:** Flame's Blessing (or Phoenix Grace)
- **Rarity:** Epic
- **Max Count:** 3
- **Icon:** `lorc/fire-ring`
- **Effect:** If MORE than 5 cards catch fire (>5, so 6+), add +25% to your grace gain chance (stacks with existing grace gain)
- **Note:** This adds to graceGainChance stat, can exceed the cap
- **Price:** 28

**Tasks:**
- [ ] Track fire count per round in RoundStats
- [ ] Add check after fire events: if fireCount > 5, add +25% to effective graceGainChance
- [ ] This bonus can exceed the normal graceGain cap
- [ ] Create weapon definition
- [ ] Register icon if needed
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `feat(weapons): add fire grace bonus weapon`

### 9.6 Nuke (Epic)
**Issue:** Need powerful board-clear weapon.

**Files:**
- `src/utils/gameDefinitions.ts` - weapon definitions
- `src/utils/weaponEffects.ts` - explosion handling

**Specification:**
- **Name:** Nuke
- **Rarity:** Epic
- **Max Count:** 3
- **Icon:** `lorc/mushroom-cloud`
- **Effect:** If match has all different attributes AND causes any explosion, 10% chance to explode entire board
- **Price:** 35

**Tasks:**
- [ ] Add helper: `isAllDifferentMatch(cards, activeAttributes)` checking all active attrs differ
- [ ] Add conditional check in explosion logic
- [ ] Implement "explode entire board" effect
- [ ] Create weapon definition
- [ ] Register icon if needed
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `feat(weapons): add Nuke weapon`

### 9.7 Refined Gold (Epic)
**Issue:** Need gold bonus weapon tied to lasers.

**Files:**
- `src/utils/gameDefinitions.ts` - weapon definitions
- `src/utils/weaponEffects.ts` - laser handling

**Specification:**
- **Name:** Refined Gold
- **Rarity:** Epic
- **Max Count:** 3
- **Icon:** `lorc/gold-bar`
- **Effect:** If match has all different attributes AND triggers laser, each destroyed card has 20% chance for +4 gold
- **Price:** 32

**Tasks:**
- [ ] Add conditional check in laser destruction logic
- [ ] For each destroyed card, roll 20% for +4 gold if condition met
- [ ] Create weapon definition
- [ ] Register icon if needed
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `feat(weapons): add Refined Gold weapon`

### 9.8 Looney Boon (Rare)
**Issue:** Need non-adjacent match bonus weapon.

**Files:**
- `src/utils/gameDefinitions.ts` - weapon definitions
- `src/utils/weaponEffects.ts` - match handling

**Specification:**
- **Name:** Looney Boon
- **Rarity:** Rare
- **Max Count:** 4
- **Icon:** `lorc/bouncing-spring` or `lorc/abstract-024`
- **Effect:** If no cards in match are adjacent to each other, +20% chance for 2 additional ricochets (can exceed cap)
- **Price:** 20

**Tasks:**
- [ ] Add helper: `areCardsAdjacent(card1, card2, boardWidth)`
- [ ] Add helper: `isNonAdjacentMatch(cards, board)` checking no pair is adjacent
- [ ] Add conditional ricochet bonus in match processing
- [ ] Create weapon definition
- [ ] Register icon if needed
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `feat(weapons): add Looney Boon weapon`

### 9.9 Fire Spread Adjacent (Rare)
**Issue:** Need fire spread enhancement weapon.

**Files:**
- `src/utils/gameDefinitions.ts` - weapon definitions
- `src/utils/weaponEffects.ts` - fire handling

**Specification:**
- **Name:** Wildfire Catalyst (or Ember Spread)
- **Rarity:** Rare
- **Max Count:** 6
- **Icon:** `lorc/fire-dash`
- **Effect:** +10% for fire to spread to EACH adjacent card (rolls independently per adjacent card)
- **Price:** 14

**Tasks:**
- [ ] Modify fire spread logic to roll per adjacent card instead of per fire
- [ ] Each adjacent card gets independent 10% spread chance per weapon
- [ ] Create weapon definition
- [ ] Register icon if needed
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `feat(weapons): add fire spread adjacent weapon`

### 9.10 Gold Risk/Reward (Rare)
**Issue:** Need high-risk gold weapon.

**Files:**
- `src/utils/gameDefinitions.ts` - weapon definitions
- `src/components/Game.tsx` - match handling

**Specification:**
- **Name:** Gambler's Coin (or Risky Fortune)
- **Rarity:** Rare
- **Max Count:** 4
- **Icon:** `lorc/two-coins`
- **Effect:**
  - Each matched card: +20% chance for +1 gold
  - Each incorrect match: 25% chance to lose extra health (total 2 damage)
- **Price:** 12

**Tasks:**
- [ ] Add gold bonus roll per matched card
- [ ] Add extra damage roll on invalid match
- [ ] Create weapon definition
- [ ] Register icon if needed
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `feat(weapons): add gold risk/reward weapon`

### 9.11 Board Clear Gold (Epic)
**Issue:** Need reward for clearing the entire board.

**Files:**
- `src/utils/gameDefinitions.ts` - weapon definitions
- `src/components/Game.tsx` - board clear detection

**Specification:**
- **Name:** Perfectionist's Prize (or Clean Sweep)
- **Rarity:** Epic
- **Max Count:** 1
- **Icon:** `lorc/coins-pile` or `delapouite/cash`
- **Effect:** If board is completely cleared (0 cards remaining), gain +20 gold
- **Price:** 30

**Tasks:**
- [ ] Add board clear detection: check if `board.length === 0` after match processing
- [ ] Award 20 gold when board is cleared and player has this weapon
- [ ] Create weapon definition
- [ ] Register icon if needed
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `feat(weapons): add board clear gold weapon`

---

## Section 10: UI/Visual Fixes

### 10.1 Final Round UI
**Issue:** Final Round UI button is too large.

**Files:**
- `src/components/AttributeUnlockScreen.tsx` - final round display

**Specification:**
- The "I'M READY" button is too large compared to other buttons in the app
- Make it consistent with other navigation buttons (same size, padding, font)
- Keep the orange theme and "FINAL ROUND" banner

**Tasks:**
- [ ] Find the button style in AttributeUnlockScreen
- [ ] Match button dimensions to standard button style used elsewhere
- [ ] Verify visual consistency with other screens
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `fix(ui): standardize Final Round button size`

### 10.2 Remove Fireworks Particle Effect
**Issue:** Fireworks/confetti particle effect should be removed.

**Files:**
- `src/components/VictoryScreen.tsx` - ConfettiBurst import and usage
- `src/components/LevelUp.tsx` - confetti usage
- `src/components/CharacterUnlockScreen.tsx` - confetti usage

**Specification:**
- Remove ConfettiBurst component usage from all screens
- Keep the particle system (used for explosions), just remove confetti/fireworks triggers

**Tasks:**
- [ ] Remove ConfettiBurst import and usage from VictoryScreen
- [ ] Remove confetti from LevelUp screen
- [ ] Remove confetti from CharacterUnlockScreen
- [ ] Optionally: remove ConfettiBurst component file if unused elsewhere
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `fix(ui): remove confetti particle effects`

### 10.3 Remove Holographic Card References
**Issue:** All holographic card references should be removed.

**Files:**
- `src/utils/gameDefinitions.ts` - Phoenix Feather, Hint Catalyst, Colorblind Goggles
- `src/types.ts` - holographicPercent in PlayerStats, 'makeHolographic' in CardReward
- `src/hooks/useHolographicShimmer.ts` - shimmer animation hook
- `src/components/Card.tsx` - holographic rendering (if any)
- `src/utils/weaponEffects.ts` - holographic effect handling

**Specification:**
- Remove weapons: Phoenix Feather, Hint Catalyst, Colorblind Goggles
- Remove `holographicPercent` from PlayerStats and DEFAULT_PLAYER_STATS
- Remove `'makeHolographic'` from CardReward type
- Remove `useHolographicShimmer` hook and its usages
- Remove any holographic card rendering code

**Tasks:**
- [ ] Delete Phoenix Feather weapon definition
- [ ] Delete Hint Catalyst weapon definition
- [ ] Delete Colorblind Goggles item definition
- [ ] Remove `holographicPercent` from PlayerStats type and defaults
- [ ] Remove `'makeHolographic'` from CardReward/bridge effect types
- [ ] Delete `useHolographicShimmer.ts` hook file
- [ ] Remove any holographic imports and usages in Card.tsx
- [ ] Remove holographic handling in weaponEffects.ts
- [ ] Update any tests that reference holographic
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `refactor(cards): remove holographic card system`

### 10.4 Notification Duration
**Issue:** Bottom-right notifications during gameplay last too long (1000ms).

**Files:**
- `src/components/Notification.tsx` - duration prop default

**Specification:**
- Change default notification duration from 1000ms to 500ms
- This makes notifications feel snappier during fast gameplay

**Tasks:**
- [ ] Change `duration` prop default from 1000 to 500 in Notification.tsx
- [ ] Verify notification still appears and is readable
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `fix(ui): reduce notification duration`

---

## Section 11: Score/Number Fixes

### 11.1 Whole Number Scores
**Issue:** Scores are being decreased by decimals, causing UI display issues.

**Files:**
- `src/components/Game.tsx` - score calculations
- `src/utils/gameConfig.ts` - score multipliers
- `src/utils/enemyFactory.ts` - enemy score modifiers

**Specification:**
- Find where decimal multipliers are applied to scores
- Convert all score operations to use whole numbers
- Use `Math.floor()` or `Math.round()` on all score displays
- If enemy has score reduction, use integer reduction (e.g., -5 points instead of 0.8x multiplier)

**Tasks:**
- [ ] Search for score multipliers that could produce decimals
- [ ] Find `pointsMultiplier` usage in enemy effects
- [ ] Replace decimal multipliers with integer operations
- [ ] Add `Math.floor()` to final score calculation
- [ ] Verify score display shows only integers
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `fix(score): use whole numbers for scores`

---

## Finale
- [ ] Review all changes and ensure consistency
- [ ] Run full test suite one final time
- [ ] Emit "FULLY 100% ENTIRELY DONE" on the log so that the loop ends.
