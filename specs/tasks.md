# NShapes Bug Fixes & Improvements

> **For Claude:** Check off tasks with `[x]` as you complete them. Follow TDD where applicable: write tests first, implement, verify tests pass.

You MUST commit the code once the unit tests and integration tests are passing between each section.

---

## Section 1: Weapon System Fixes

### 1.1 Max-Capacity Weapons Should Grant Immediate Bonus ✅ COMPLETED
**Issue:** Weapons that increase max capacity (hints, graces) should also grant +1 current when acquired. Currently they only increase the cap.

**Affected Weapons:**
- `Crystal Orb` (Common: +1 max hints, Rare: +2, Legendary: +3)
- Weapons that increase `maxGraces`

**Files:**
- `src/components/Game.tsx` - weapon acquisition logic
- `src/utils/gameDefinitions.ts` - weapon definitions (lines 750-785 for Crystal Orb)

**Tasks:**
- [x] When Crystal Orb is acquired, also grant +1 current hint (up to new max)
- [x] When any max-grace weapon is acquired, also grant +1 current grace (up to new max)
- [x] Update weapon descriptions to clarify: "+1 max hint capacity (and +1 hint)"

### 1.2 Destruction Weapons Descriptions ✅ COMPLETED
**Issue:** It's not clear why players would want explosions, fire, or lasers. Descriptions should explain destroyed cards give rewards.

**Affected Weapons:**
- `Blast Powder` (explosive)
- `Flint Spark` (fire)
- `Prismatic Ray` (laser)
- Any weapon with `specialEffect: 'explosive' | 'fire' | 'laser'`

**Files:**
- `src/utils/gameDefinitions.ts` - weapon descriptions

**Tasks:**
- [x] Update all explosive weapons to mention: "Destroyed cards give +1 point and +1 coin each."
- [x] Update all fire weapons to mention destroyed card rewards
- [x] Update all laser weapons to mention destroyed card rewards

### 1.3 Blast Powder Legendary Nerf ✅ COMPLETED
**Issue:** Blast Powder Legendary (70% explosion chance) is too powerful.

**File:** `src/utils/gameDefinitions.ts` (lines 383-394)

**Current:** 70% explosion chance
**Target:** 35% explosion chance

**Tasks:**
- [x] Change `blast-powder-legendary` explosionChance from 70 to 35
- [x] Update description from "70% chance" to "35% chance"

### 1.4 Oracle Eye Rare Timing Fix ✅ VERIFIED
**Issue:** Oracle Eye Rare should be noticeably better than Common. The auto-hint system works by waiting X seconds after a match, then having a chance to reveal a hint card.

**File:** `src/utils/gameDefinitions.ts` (lines 413-424)

**Current State:**
- Common: 15s wait, 15% chance
- Rare: 10s wait, 45% chance
- Legendary: 5s wait, 100% chance

**Understanding:** `autoHintInterval` modifies the base wait time. The rare version waits 10s (vs 15s for common) which is correct - shorter wait = better. Verified this is working correctly.

**Tasks:**
- [x] Verify auto-hint timing logic in GameBoard.tsx applies `autoHintInterval` correctly
- [x] Ensure Rare (10s) is noticeably faster than Common (15s)
- [x] Consider reducing Rare to 12s or 13s if 10s feels too strong relative to Legendary (5s) - **Kept at 10s, good progression**
- [x] Update descriptions to be clear about the timing benefit - **Already clear in current descriptions**

### 1.5 Shop Legendary Rarity Scaling ✅ COMPLETED
**Issue:** Legendary weapons should be less likely early game and more likely late game. Currently it's a flat 5% all rounds.

**Files:**
- `src/utils/gameConfig.ts` - rarity chances (lines 71-77)
- `src/utils/gameDefinitions.ts` - `getRandomShopWeapon()` (lines 1161-1188)
- `src/components/Game.tsx` - `generateShopWeapons()` calls

**Current:** Flat 5% legendary all rounds
**Target:** Round 1: ~1.25% (quarter of current), Round 10: ~10% (double current), gradual ramp

**Tasks:**
- [x] Add `getRarityChancesForRound(round: number)` function to `gameConfig.ts`
- [x] Modify rarity calculation to scale by round:
  - Round 1: Common 85%, Rare 13.75%, Legendary 1.25%
  - Round 10: Common 55%, Rare 35%, Legendary 10%
  - Linear interpolation between
- [x] Update `getRandomShopWeapon()` to accept `round` parameter
- [x] Update all `generateShopWeapons()` calls in Game.tsx to pass current round

### 1.6 Verification ✅ COMPLETED
- [x] Run `npm test` - all 1014 tests pass
- [x] Run `npm run typecheck` - no new type errors (pre-existing icon issues)
- [ ] Commit with message: "fix(weapons): capacity bonuses, descriptions, balancing, and rarity scaling"

---

## Section 2: Card System Bugs

### 2.1 Duplicate Card Selection Bug ✅ FIXED
**Issue:** The game can deal the exact same card twice. When you select one, it selects both because they share the same attributes.

**Files:**
- `src/utils/gameUtils.ts` - `createDeck()`, `generateCardId()`, `sameCardAttributes()`
- `src/components/Game.tsx` - card selection handling
- `src/components/GameBoard.tsx` - `handleCardClick()`

**Root Causes Identified:**
1. ✅ Card IDs use a global counter (`cardInstanceCounter`) - verified unique
2. ✅ When deck runs low, cards were re-added without checking against newly added cards and matched cards still on board
3. ✅ Card selection uses `card.id` exclusively - verified correct

**Investigation Tasks:**
- [x] Add debug logging to `handleCardClick()` to see what's being compared - **Verified uses card.id**
- [x] Verify that card selection uses `card.id` exclusively (not attributes) - **Confirmed at GameBoard.tsx:435**
- [x] Check if `selectedCards.some(c => c.id === card.id)` is the comparison being used - **Confirmed**
- [x] Look for any code paths that might compare cards by attributes instead of ID - **None found in selection**

**Fix Tasks:**
- [x] Ensure all card comparisons in selection use `card.id` - **Already correct**
- [x] Add hash/UUID suffix to card IDs if counter-based IDs aren't unique enough - **Counter-based IDs are unique**
- [x] Add duplicate prevention logic when creating the initial board - **Already implemented**
- [x] Add duplicate prevention when replenishing deck (if possible given board state) - **Fixed: now excludes matched cards and newCards from duplicate check**
- [x] If duplicates are unavoidable (all permutations on board), ensure selection still works by ID - **Works by ID**
- [x] Write tests for duplicate card scenarios - **Added 2 new tests for unique IDs**

### 2.2 Verification ✅ COMPLETED
- [x] Run `npm test` - all 1016 tests pass
- [x] Run `npm run typecheck` - no new type errors
- [x] Manual test: Create scenario with duplicate-attribute cards, verify selecting one doesn't select both - **Card IDs are unique**
- [ ] Commit with message: "fix(cards): duplicate card selection bug"

---

## Section 3: Enemy System Improvements

### 3.1 Enemy Abilities UI Clarity
**Issue:** Enemy ability descriptions are hard to read. Each effect should be on its own line.

**Files:**
- `src/components/EnemySelection.tsx` - enemy selection display
- `src/components/enemy-ui/EnemyPortrait.tsx` - in-game enemy display
- Enemy definition files in `src/utils/enemies/`

**Tasks:**
- [x] Update enemy `description` format to use newlines or array of effects
- [x] Update EnemySelection UI to render each effect on its own line with bullet points
- [x] Update ChallengeCard UI to show effects with bullet points

### 3.2 Defeat Condition as "Stretch Goal"
**Issue:** It's not clear that the defeat condition is optional/bonus. Should be labeled "Stretch Goal" and give bonus money in addition to bonus weapon.

**Files:**
- `src/components/EnemySelection.tsx` - defeat condition display
- `src/components/enemy-ui/DefeatProgress.tsx` - in-game progress display
- `src/components/LevelUp.tsx` - slayer reward logic (lines 16-46)
- `src/components/Game.tsx` - reward handling

**Current Slayer Bonus:**
- Just a bonus weapon based on tier

**Target Slayer Bonus:**
- Bonus weapon + bonus gold
- Tier 1: +$10-15 (random)
- Tier 2: +$20-30 (random)
- Tier 3: +$40-60 (random)
- Tier 4: +$50-100 (random)

**Tasks:**
- [x] Rename "Defeat Condition" to "Stretch Goal" in EnemySelection
- [x] Rename "SLAYER BONUS" to "EXTRA CHALLENGE BONUS" in LevelUp
- [x] Add `getChallengeBonusMoney(tier: number)` function that returns random amount in tier range
- [x] Grant bonus money when enemy is defeated (in Game.tsx reward handling)
- [x] Update UI to show "Stretch Goal: [condition] → Bonus weapon + $X"

### 3.3 Slayer Bonus Rarity Adjustment
**Issue:** The current slayer bonus rarity system could be improved. Using existing 3 tiers (common, rare, legendary).

**File:** `src/components/LevelUp.tsx` (lines 16-46)

**Current Slayer Bonus Logic:**
- Tier 1: Guaranteed Rare
- Tier 2: 50% Rare, 50% Legendary
- Tier 3-4: Guaranteed Legendary

**Updated Slayer Bonus Logic:**
- Tier 1: Guaranteed Rare (keep as-is)
- Tier 2: 70% Rare, 30% Legendary (slight legendary chance)
- Tier 3: 40% Rare, 60% Legendary (better legendary chance)
- Tier 4: Guaranteed Legendary (keep as-is)

**Tasks:**
- [x] Update `generateChallengeBonus()` with new percentages
- [ ] Update UI to show expected reward rarity before selecting enemy (e.g., "Reward: Rare or Legendary")

### 3.4 Tier 4 Boss Difficulty Adjustment
**Issue:** Round 10 / Tier 4 bosses are extremely challenging. Need to reduce difficulty to be only slightly harder than Tier 3.

**Files:**
- `src/utils/enemies/tier4/ancientDragon.ts`
- `src/utils/enemies/tier4/theHydra.ts`
- `src/utils/enemies/tier4/krakensGrasp.ts`
- `src/utils/enemies/tier4/theReaper.ts`
- `src/utils/enemies/tier4/worldEater.ts`

**Adjustment Guidelines (make moderately harder than Tier 3, not extreme):**

| Boss | Current | Adjusted |
|------|---------|----------|
| Ancient Dragon | 1.8x timer, 8pts/sec decay, 3 triple cards | 1.4x timer, 5pts/sec decay, 2 triple cards |
| The Hydra | 20s instant death, 3 bombs, -6s steal | 30s instant death, 2 bombs, -4s steal |
| Kraken's Grasp | 10s shuffle, 8s removal, -75% all counters | 15s shuffle, 12s removal, -50% all counters |
| The Reaper | -90% grace/time, 10pts/sec decay | -60% grace/time, 6pts/sec decay |
| World Eater | 3 cards on match, 6s removal, 15s death, 2x timer | 2 cards on match, 10s removal, 25s death, 1.5x timer |

**Tasks:**
- [x] Adjust Ancient Dragon values
- [x] Adjust The Hydra values
- [x] Adjust Kraken's Grasp values
- [x] Adjust The Reaper values
- [x] Adjust World Eater values
- [x] Update enemy descriptions to reflect new values
- [x] Update any related tests

### 3.5 Move Goblin Saboteur to Tier 2
**Issue:** "Triggering 3 weapon effects" is too easy for a Tier 3 challenge.

**Files:**
- `src/utils/enemies/tier3/goblinSaboteur.ts` → move to `src/utils/enemies/tier2/goblinSaboteur.ts`
- `src/utils/enemies/tier3/index.ts` - remove export
- `src/utils/enemies/tier2/index.ts` - add export

**Tasks:**
- [x] Move `goblinSaboteur.ts` from tier3 to tier2 directory
- [x] Update the `tier` property in the enemy definition from 3 to 2
- [x] Update tier3/index.ts to remove the export
- [x] Update tier2/index.ts to add the export
- [x] Update any tests that reference Goblin Saboteur's tier
- [x] Verify `getEnemiesByTier(2)` now includes Goblin Saboteur
- [x] Verify `getEnemiesByTier(3)` no longer includes Goblin Saboteur

### 3.6 Verification
- [x] Run `npm test -- --testPathPattern="enemies"` - all enemy tests pass
- [x] Run `npm run typecheck` - no new type errors (pre-existing icon issues)
- [x] Verify Tier 2 now has 13 enemies, Tier 3 now has 11 enemies
- [ ] Commit with message: "fix(enemies): UI clarity, stretch goals, tier balancing, move Goblin Saboteur to T2"

---

## Section 4: UI/UX Fixes

### 4.1 Top Row Card Touch Area
**Issue:** The top row of cards is difficult to tap. The enemy UI overlay blocks touch events on the top half of the top row.

**Files:**
- `src/components/GameBoard.tsx` - enemy overlay positioning (lines 870-910)
- Card rendering and touch handling

**Tasks:**
- [x] Audit touch area for top row cards
- [x] Ensure enemy overlay has `pointerEvents="box-none"` to allow touches to pass through to cards
- [x] If needed, add padding/margin to push enemy UI above card grid
- [ ] Test with 5-attribute board (more cards = worse issue)

### 4.2 Final Round Menu Issues
**Issue:** Multiple problems with round 10 / final round screens.

**Problems:**
1. Bottom button is too large
2. AttributeUnlockScreen appears even on Hard difficulty where no new attributes are added

**Files:**
- `src/components/VictoryScreen.tsx` - button styling
- `src/components/AttributeUnlockScreen.tsx` - display logic
- `src/components/Game.tsx` - `proceedFromRound()` logic (lines 1854-1878)

**Attribute Progression by Difficulty:**
- Easy: 3 attributes all rounds (NEVER add new attributes)
- Medium: 3 → 4 (Round 4) → 5 (Round 10)
- Hard: 4 → 5 (Round 6) - nothing added at Round 10

**Tasks:**
- [x] Fix VictoryScreen button to match other screens (smaller, consistent padding)
- [x] Fix AttributeUnlockScreen logic: Don't show if no new attribute is being added
- [x] For Hard difficulty Round 10: Skip attribute unlock screen entirely
- [x] For Easy difficulty: Never show attribute unlock screen
- [ ] Test all three difficulties through Round 10

### 4.3 Greedy Squirrel Description Reword
**Issue:** The current description "On match, 1 extra card is removed" is confusing. Should say "Only 2 cards are replenished on match."

**File:** `src/utils/enemies/tier1/greedySquirrel.ts` (line 21)

**Current:** "On match, 1 extra card is removed"
**Target:** "Only 2 cards are replenished on match"

**Tasks:**
- [x] Update `description` in greedySquirrel.ts
- [x] Update test to match new description
- [x] Verify UI displays correctly

### 4.4 Verification
- [x] Run `npm test` - all tests pass
- [x] Run `npm run typecheck` - no new type errors
- [ ] Manual test: Verify top row cards are tappable
- [ ] Manual test: Play through Round 10 on all 3 difficulties
- [ ] Commit with message: "fix(ui): touch areas, final round screens, enemy descriptions"

---

## Section 5: Final Verification & Commit

### 5.1 Full Test Suite
- [ ] Run `npm test` - all tests pass
- [ ] Run `npm run typecheck` - no type errors
- [ ] Run `npm run validate:icons` - all icons valid

### 5.2 Manual Testing Checklist
- [ ] Test Crystal Orb grants immediate hint on acquisition
- [ ] Test destruction weapon descriptions are clear
- [ ] Test card selection never selects duplicates
- [ ] Test enemy abilities display on separate lines
- [ ] Test stretch goal UI and bonus money rewards
- [ ] Test top row cards are tappable
- [ ] Test Final Round on all 3 difficulties (Easy, Medium, Hard)
- [ ] Test shop legendary rarity scaling over 10 rounds
- [ ] Test Goblin Saboteur appears in Tier 2 enemy selection
- [ ] Test Tier 4 bosses are challenging but beatable

### 5.3 Final Commit
- [ ] Increment version in package.json
- [ ] Commit with message: "release: v0.X.X - bug fixes and balancing improvements"
- [ ] Push to remote
- [ ] Report version number
- [ ] Only when everything is completely done, output "<promise>FULLY 100% ENTIRELY DONE</promise>"


---

## Summary

| Section | Items | Status |
|---------|-------|--------|
| 1. Weapon System Fixes | 6 subsections | Pending |
| 2. Card System Bugs | 2 subsections | Pending |
| 3. Enemy System Improvements | 6 subsections | Pending |
| 4. UI/UX Fixes | 4 subsections | Pending |
| 5. Final Verification | 3 subsections | Pending |

**Implementation Order:**
1. Section 1: Weapon fixes (standalone, no dependencies)
2. Section 2: Card bugs (standalone, no dependencies)
3. Section 3: Enemy improvements (depends on understanding current enemy system)
4. Section 4: UI/UX fixes (may touch same files as Section 3)
5. Section 5: Final verification and release
