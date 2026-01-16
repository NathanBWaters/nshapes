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

## Section 1: UI Display Improvements

### 1.1 Max Items Display Enhancement
**Issue:** Max items (like maxCount weapons) should show ownership count AND percentage stats should show their caps.

**Files:**
- `src/components/WeaponShop.tsx` - stat display
- `src/components/LevelUp.tsx` - stat display
- `src/components/CharacterSelection.tsx` - character stats

**Tasks:**
- [ ] Show "2/3 owned" style display for weapons with maxCount when player owns multiple copies
- [ ] Show percentage stats with their caps: "30% fire spread (max 70%)"
- [ ] Update weapon cards to indicate ownership count when applicable
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `fix(ui): show weapon ownership count and stat caps`

### 1.2 Character Stats Comprehensive Display
**Issue:** Character stats should show ALL stats (echo, board growth, fire spread, explosion chance, etc.) and display max limits near each stat.

**Files:**
- `src/components/CharacterSelection.tsx` - character stats display
- `src/components/WeaponShop.tsx` - stats preview
- `src/components/LevelUp.tsx` - stats preview
- `src/types.ts` - PlayerStats interface

**Tasks:**
- [ ] Audit PlayerStats interface and ensure ALL stats are displayed
- [ ] Add echo chance, board growth chance, laser chance, fire spread, explosion chance, etc.
- [ ] Show max limit next to each stat (e.g., "Echo: 15% (max 60%)")
- [ ] Ensure no stat from PlayerStats is missing from the display
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `fix(ui): display all character stats with max limits`

### 1.3 RoundSummary Bottom Section Visual Fix
**Issue:** The bottom section (Continue button area) has a weird opaque rectangle that covers content before the button fades in. The transparent area should not hide what's behind it.

**Files:**
- `src/components/RoundSummary.tsx` - button container styling (lines 185-192 for animation timing)

**Tasks:**
- [ ] Remove or fix the opaque background that covers content before fade-in
- [ ] Ensure the area is fully transparent until the button actually appears
- [ ] The button can still fade in, but the area shouldn't look like it's hiding things
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `fix(ui): remove opaque background from RoundSummary button area`

### 1.4 Section Verification
- [ ] Verify all 3 subsection commits are pushed
- [ ] Manual test: Confirm UI improvements work as expected

---

## Section 2: Enemy System Overhaul

### 2.1 Enemy Difficulty Philosophy Change
**Issue:** Enemies weren't fun - they were all net negative. Restructure tier system with this philosophy:
- **Tier 1:** Fun extra challenge, should NOT make things harder
- **Tier 2:** Slightly harder
- **Tier 3:** Harder
- **Tier 4:** Damn hard
- **Rule:** Last round (Round 10) must be all Tier 4 enemies

**Files:**
- `src/utils/enemies/tier1/*.ts` - should be fun, not punishing
- `src/utils/enemies/tier2/*.ts` - slight challenge
- `src/utils/enemies/tier3/*.ts` - moderate challenge
- `src/utils/enemies/tier4/*.ts` - hard challenge
- `src/components/EnemySelection.tsx` - enemy selection logic

**Tasks:**
- [ ] Review and adjust ALL Tier 1 enemies to be fun bonus challenges, not harder
- [ ] Review and adjust Tier 2 enemies to be only slightly harder
- [ ] Review and adjust Tier 3 enemies to be moderately harder
- [ ] Verify Tier 4 enemies are appropriately difficult
- [ ] Ensure Round 10 enemy selection only offers Tier 4 enemies
- [ ] Update enemy descriptions to reflect new balance
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `fix(enemies): rebalance tier difficulty philosophy`

### 2.2 Specific Enemy Fixes

#### Lurking Shark Clarity
**Issue:** "Match face-down cards" is confusing because you can't see what a face-down card is. Reword to clarify it means cards that WERE face-down but have been flipped.

**File:** `src/utils/enemies/tier2/lurkingShark.ts`

**Tasks:**
- [ ] Reword description: "Match cards that were originally face-down" or similar
- [ ] Make the mechanic clearer in the defeat condition text
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `fix(enemies): clarify Lurking Shark face-down mechanic`

#### Charging Boar Too Tough
**Issue:** Score draining at 3 points/second is too punishing. Should be 1 point every 3 seconds.

**File:** `src/utils/enemies/tier2/chargingBoar.ts`

**Current:** 3 points/second decay
**Target:** ~0.33 points/second (1 point every 3 seconds)

**Tasks:**
- [ ] Change scoreDecay from 3 to 0.33 (or implement as 1 point per 3 seconds)
- [ ] Update description to reflect new decay rate
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `fix(enemies): reduce Charging Boar score decay rate`

#### Diving Hawk Stretch Goal Impossible
**Issue:** Stretch goal (2 all-different matches under 6 seconds each) is too hard.

**File:** `src/utils/enemies/tier2/divingHawk.ts`

**Tasks:**
- [ ] Increase time limit from 6 seconds to 8 or 10 seconds
- [ ] OR reduce required matches from 2 to 1
- [ ] Update description
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `fix(enemies): make Diving Hawk stretch goal achievable`

#### Stalking Wolf Stretch Goal Adjustment
**Issue:** Getting 3 matches each under 5 seconds is hard. Change to "get 3 matches within 10 seconds total" (do two quickly, lined up).

**File:** `src/utils/enemies/tier1/stalkingWolf.ts`

**Current:** 3 matches, each under 5 seconds
**Target:** 3 matches within 10 seconds total

**Tasks:**
- [ ] Change defeat condition from "each under 5s" to "3 matches within 10 seconds window"
- [ ] Update implementation to track a 10-second window
- [ ] Update description
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `fix(enemies): change Stalking Wolf to 10-second window`

#### Ravenous Tapir Too Hard
**Issue:** Card removal is so aggressive (5+ cards per match) that it's nearly impossible.

**File:** `src/utils/enemies/tier3/ravenousTapir.ts`

**Tasks:**
- [ ] Reduce card removal rate significantly
- [ ] Consider changing from "2 extra cards removed per match" to "1 extra card removed"
- [ ] Adjust burrowing mole effect (currently 1 card every 10s)
- [ ] Make the stretch goal achievable
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `fix(enemies): reduce Ravenous Tapir card removal aggressiveness`

### 2.3 Enemy Abilities Before/After Display
**Issue:** Enemy abilities that decrease stats should show before and after values.

**Files:**
- `src/components/EnemySelection.tsx` - enemy ability display
- `src/components/ui/ChallengeCard.tsx` - challenge card display

**Example:** Instead of "-35% time", show "60s → 39s"

**Tasks:**
- [ ] Modify enemy ability display to show before → after for stat reductions
- [ ] Apply to time reductions, score decay rates, etc.
- [ ] Update ChallengeCard to support this format
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `fix(enemies): show before/after values for stat reductions`

### 2.4 Section Verification
- [ ] Verify all 7 subsection commits are pushed
- [ ] Manual test: Confirm enemy changes work as expected

---

## Section 3: Reward System Overhaul

### 3.1 Show Specific Rewards Before Enemy Selection
**Issue:** It's not fun to get a random additional item. Players should see the SPECIFIC weapon they'll get for defeating each enemy's stretch goal BEFORE selecting.

**Files:**
- `src/components/EnemySelection.tsx` - enemy selection screen
- `src/components/Game.tsx` - enemy/reward generation logic
- `src/components/LevelUp.tsx` - current stretch goal bonus logic
- `docs/enemy-design.md` - update documentation

**Tasks:**
- [ ] Generate the specific stretch goal reward weapon when generating enemy options
- [ ] Display the specific weapon on each enemy card in EnemySelection
- [ ] Store the pre-determined reward with the enemy selection
- [ ] When stretch goal is achieved, grant the pre-shown weapon (not random)
- [ ] Update enemy-design.md to reflect this change
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `feat(rewards): show specific weapon rewards before enemy selection`

### 3.2 Stretch Goal Bonus Selection Bug Fix
**Issue:** Selecting stretch goal bonus weapons (Cascade Core, Growth Mastery, Flint Spark) in the upgrade shop causes the selection to refresh back to the first item.

**Files:**
- `src/components/LevelUp.tsx` - selection handling for challenge bonus
- `src/components/WeaponShop.tsx` - if applicable

**Tasks:**
- [ ] Debug why selecting stretch goal bonus weapons causes refresh
- [ ] Fix the selection state to persist correctly
- [ ] Ensure challenge bonus weapons can be selected and acquired normally
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `fix(rewards): fix stretch goal bonus weapon selection bug`

**Note:** This may become less relevant after 3.1 is implemented since rewards will be pre-determined.

### 3.3 RoundSummary Stretch Goal Reward Clarity
**Issue:** When completing a round, the summary should clearly show if the stretch goal was achieved and what specific weapon was earned.

**Files:**
- `src/components/RoundSummary.tsx` - round completion display

**Tasks:**
- [ ] Add section showing "Stretch Goal: [Achieved/Not Achieved]"
- [ ] If achieved, prominently display the weapon that was earned
- [ ] Make it super clear what the player got from the stretch goal
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `feat(rewards): show stretch goal results in RoundSummary`

### 3.4 "Loot" Terminology Fix
**Issue:** The reward screen mentions "LOOT" but we don't really gain loot in the traditional sense.

**File:** `src/components/RoundSummary.tsx` (line 124)

**Tasks:**
- [ ] Rename "LOOT" to something more appropriate (e.g., "BONUS", "REWARDS", or remove if not meaningful)
- [ ] Update icon if terminology changes
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `fix(ui): rename LOOT to appropriate terminology`

### 3.5 Section Verification
- [ ] Verify all 4 subsection commits are pushed
- [ ] Update docs/enemy-design.md with new reward system
- [ ] Manual test: Confirm reward system changes work as expected

---

## Section 4: Gameplay Mechanics

### 4.1 Game Over Screen Enemy Display
**Issue:** When you lose, the game over screen should say which enemy you lost to.

**Files:**
- `src/components/Game.tsx` - game over handling (lines 2395-2466)

**Tasks:**
- [ ] Store the current enemy when game over occurs
- [ ] Display enemy name and icon on game over screen
- [ ] Show "Defeated by [Enemy Name]" or similar
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `feat(ui): show enemy name on game over screen`

### 4.2 Hints Should Not Include Dud Cards
**Issue:** Hints can show sets that include dud cards, but duds can't be matched. Hints should exclude duds.

**Files:**
- `src/components/GameBoard.tsx` - hint system
- `src/utils/gameUtils.ts` - set finding logic

**Tasks:**
- [ ] When finding valid sets for hints, exclude cards with `isDud: true`
- [ ] Ensure auto-hints also exclude duds
- [ ] Test with board containing duds to verify
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `fix(hints): exclude dud cards from hint suggestions`

### 4.3 Health Over 3 = Bonus Starting Time
**Issue:** New mechanic - for every health over 3 that you have, gain 15 starting seconds.

**Files:**
- `src/components/Game.tsx` - round start logic
- `src/utils/gameConfig.ts` - if constants needed
- `src/types.ts` - if new stat tracking needed

**Example:**
- 3 health = 0 bonus seconds (base)
- 4 health = +15 seconds
- 5 health = +30 seconds
- 6 health = +45 seconds

**Tasks:**
- [ ] Implement bonus time calculation at round start
- [ ] Add the bonus time to starting timer
- [ ] Display this bonus somewhere so player understands the benefit
- [ ] Update any relevant documentation
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `feat(gameplay): add bonus starting time for health over 3`

### 4.4 End Round Early Button
**Issue:** Players who have already hit the score target may want to skip ahead instead of waiting. Add an "End Round Early" button to the in-game pause menu (top-right corner menu button).

**Files:**
- `src/components/GameMenu.tsx` - pause menu modal
- `src/components/Game.tsx` - round completion logic

**Requirements:**
- Only visible when actively playing a round (game board is up, matching phase)
- NOT visible during other phases (character selection, shop, level up, etc.)
- Should end the round and proceed to the round summary/rewards
- Player keeps their current score, health, etc.

**Tasks:**
- [ ] Add "End Round Early" button to GameMenu component
- [ ] Only show button when `gamePhase === 'playing'` or equivalent
- [ ] Wire button to trigger round completion (same as timer expiry but successful)
- [ ] Ensure score/rewards are calculated based on current progress
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `feat(gameplay): add End Round Early button to pause menu`

### 4.5 Section Verification
- [ ] Verify all 4 subsection commits are pushed
- [ ] Manual test: Confirm gameplay changes work as expected

---

## Section 5: Final Verification & Commit

### 5.1 Full Test Suite
- [ ] Run `npm test` - all tests pass
- [ ] Run `npm run typecheck` - no new type errors
- [ ] Run `npx playwright test` - all integration tests pass
- [ ] Run `npm run validate:icons` - all icons valid

### 5.2 Documentation Updates
- [ ] Update docs/enemy-design.md with new tier philosophy
- [ ] Update docs/enemy-design.md with pre-shown rewards
- [ ] Update CLAUDE.md if any major system changes
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `docs: update enemy and reward system documentation`

### 5.3 Manual Testing Checklist
- [ ] Test stat display shows all stats with max limits
- [ ] Test "2/3 owned" display for multi-copy weapons
- [ ] Test enemy selection shows specific rewards
- [ ] Test RoundSummary shows stretch goal results clearly
- [ ] Test bottom button area doesn't have opaque rectangle issue
- [ ] Test game over screen shows enemy that defeated you
- [ ] Test hints don't include dud cards
- [ ] Test health > 3 grants bonus starting time
- [ ] Test "End Round Early" button only appears during active gameplay
- [ ] Test "End Round Early" properly ends round with current score/rewards
- [ ] Test Tier 1 enemies are fun, not punishing
- [ ] Test rebalanced enemies (Charging Boar, Diving Hawk, Stalking Wolf, Ravenous Tapir)
- [ ] Test Lurking Shark description is clearer

### 5.4 Final Commit
- [ ] Increment version in package.json
- [ ] **Verify:** Run `npm test`, `npm run typecheck`, and `npx playwright test` - all pass
- [ ] **Commit:** `release: vX.Y.Z - enemy rebalance, reward clarity, UI improvements`
- [ ] Push to remote
- [ ] Report version number
- [ ] Emit "FULLY 100% ENTIRELY DONE" on the log so that the loop ends.

---

## Summary

| Section | Subsections | Commits Required |
|---------|-------------|------------------|
| 1. UI Display Improvements | 3 | 3 |
| 2. Enemy System Overhaul | 7 | 7 |
| 3. Reward System Overhaul | 4 | 4 |
| 4. Gameplay Mechanics | 4 | 4 |
| 5. Final Verification | 2 | 2 |
| **Total** | **20** | **20** |

**Implementation Order:**
1. Section 1: UI improvements (standalone, affects display)
2. Section 3: Reward system (changes how enemies work, do before enemy rebalance)
3. Section 2: Enemy rebalance (depends on new reward system being in place)
4. Section 4: Gameplay mechanics (standalone additions)
5. Section 5: Final verification and release
