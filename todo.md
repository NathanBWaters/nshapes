# NShapes Todo - Detailed Implementation Plan

Each section below represents a logical unit of work. After completing each section:
1. Review all code changes thoroughly
2. Run/add unit tests
3. Remove stale comments and documentation
4. Commit and push with a clear commit message
5. Move to the next section

---

## Section 1: Menu Pause System
**Goal:** When the menu is opened during gameplay, the timer should pause.

- [ ] In `Game.tsx`, identify where the menu modal is triggered (GameMenu component)
- [ ] Add a `isPaused` or `menuOpen` state to track when menu is open
- [ ] Modify the timer `useEffect` (around line 247) to NOT decrement when menu is open
- [ ] Ensure fire burn timers also pause when menu is open
- [ ] Ensure auto-hint timers also pause when menu is open
- [ ] Test: Open menu mid-game, verify timer stops, close menu, verify timer resumes
- [ ] Add unit test for pause/resume timer logic
- [ ] **Commit:** "Add menu pause system - timer stops when menu open"

---

## Section 2: Mulligan → Grace Rename + Logic Change
**Goal:** Rename all "mulligan" references to "Grace". Grace only saves you if exactly 1 attribute is incorrect (2+ wrong = still a miss).

### 2.1 Rename Mulligan to Grace
- [ ] In `types.ts`: Rename `mulligans` → `graces` in PlayerStats interface
- [ ] In `gameDefinitions.ts`:
  - [ ] Rename all `mulligans` references in weapon effects to `graces`
  - [ ] Update DEFAULT_PLAYER_STATS
  - [ ] Rename weapon "Second Chance" description to mention "Grace" not "mulligan"
  - [ ] Rename weapon "Fortune Token" effects (`mulliganGainChance` → `graceGainChance`)
- [ ] In `Game.tsx`:
  - [ ] Rename all `mulligans` state/variable references to `graces`
  - [ ] Update `handleInvalidMatch` function
  - [ ] Update `calculatePlayerTotalStats` calls
- [ ] In `GameBoard.tsx`: Change "Redo" text display to "Grace"
- [ ] In `GameInfo.tsx`: Update any mulligan displays
- [ ] In `weaponEffects.ts`: Rename `bonusMulligans` → `bonusGraces`
- [ ] Search all files for "mulligan" (case-insensitive) and rename
- [ ] Update icon: Use prayer hands 🙏 or four-leaf clover 🍀 or sparkle ✨ icon

### 2.2 Implement "Only 1 Attribute Wrong" Logic
- [ ] In `gameUtils.ts`: Create `countInvalidAttributes(cards: Card[], activeAttributes: AttributeName[]): number`
  - Returns count of attributes that violate the SET rule
- [ ] In `Game.tsx` `handleInvalidMatch`:
  - [ ] Call `countInvalidAttributes()`
  - [ ] If count === 1 AND player has graces > 0: Use grace, show "Grace" notification
  - [ ] If count >= 2: Full miss, lose health (grace NOT used)
- [ ] Add unit tests for:
  - [ ] `countInvalidAttributes` returns correct count
  - [ ] Grace activates only when exactly 1 attribute wrong
  - [ ] Grace does NOT activate when 2+ attributes wrong
  - [ ] Grace decrements correctly when used

### 2.3 Update Documentation
- [ ] Update CLAUDE.md: Replace all "mulligan" with "Grace", document new logic
- [ ] Update any in-game help text or tutorials mentioning mulligans
- [ ] **Commit:** "Rename mulligan to Grace + only saves when 1 attribute wrong"

---

## Section 3: Level Up "Free" Indicator
**Goal:** Make it obvious that Level Up rewards are free.

- [ ] In `LevelUp.tsx`:
  - [ ] Add banner/text at top: "Choose your FREE reward!" or "🎁 Free Reward"
  - [ ] Ensure no price is displayed on weapon cards in level up
  - [ ] Style the "free" indicator prominently (maybe green or gold color)
- [ ] Test: Level up screen clearly shows items are free
- [ ] **Commit:** "Add 'Free' indicator to Level Up screen"

---

## Section 4: Inventory Display Sliver
**Goal:** Add a compact, horizontal scrollable inventory bar at top of Shop and Level Up screens.

### 4.1 Create InventoryBar Component
- [ ] Create `src/components/InventoryBar.tsx`:
  - [ ] Takes `weapons: Weapon[]` as prop
  - [ ] Horizontal ScrollView, fixed height (~50-60px)
  - [ ] Group weapons by type+rarity, show count if >1
  - [ ] Display: Small icon + name + count badge
  - [ ] Separate sections for Common, Rare, Legendary (subtle dividers or labels)
  - [ ] Visual-only, no tap interaction
  - [ ] Title: "Inventory" in small text on left
  - [ ] Empty state: "No items yet"

### 4.2 Integrate into WeaponShop.tsx
- [ ] Import InventoryBar
- [ ] Add at very top of shop screen
- [ ] Pass `player.weapons` to InventoryBar
- [ ] Ensure inventory updates immediately when item purchased

### 4.3 Integrate into LevelUp.tsx
- [ ] Import InventoryBar
- [ ] Add at very top of level up screen
- [ ] Pass `player.weapons` to InventoryBar
- [ ] Ensure inventory updates immediately when weapon selected

### 4.4 Add Tutorial Slide
- [ ] In `TutorialScreen.tsx` (or TutorialContext):
  - [ ] Add new tutorial step explaining inventory persistence
  - [ ] Text: "Weapons you collect stay with you for your entire adventure! Build your arsenal to become unstoppable."
  - [ ] Show example inventory visual

### 4.5 Testing
- [ ] Test: Inventory visible in shop, scrolls horizontally
- [ ] Test: Inventory visible in level up screen
- [ ] Test: Inventory updates when buying/selecting weapons
- [ ] Test: Grouping by rarity works correctly
- [ ] Test: Count badges show correctly for duplicate weapons
- [ ] **Commit:** "Add inventory display bar to Shop and Level Up screens"

---

## Section 5: Auto-Hint Nerf
**Goal:** Auto-hint triggers 15 seconds after last match (not every N seconds continuously).

- [ ] In `Game.tsx`:
  - [ ] Add `lastMatchTime` state (timestamp of last successful match)
  - [ ] Update `lastMatchTime` whenever a valid match is made
  - [ ] Modify auto-hint logic:
    - [ ] Only check for auto-hint if `Date.now() - lastMatchTime >= 15000` (15 seconds)
    - [ ] Reset the auto-hint timer when a match is made
  - [ ] Remove any interval-based auto-hint (if using setInterval, switch to checking in game loop)
- [ ] In `gameDefinitions.ts`:
  - [ ] Update Oracle Eye weapon descriptions to reflect new behavior
  - [ ] Change `autoHintInterval` effect to modify the 15-second threshold (lower is better)
- [ ] Test: Make match, wait 15 seconds, hint appears
- [ ] Test: Make match, wait 10 seconds, make another match, wait 15 seconds, hint appears
- [ ] Add unit test for auto-hint timing logic
- [ ] **Commit:** "Nerf auto-hint: triggers 15s after last match instead of interval"

---

## Section 6: Remove Selected Cards Counter
**Goal:** Remove the 1/2/3 selected cards indicator at top of game screen.

- [ ] In `Game.tsx` or `GameInfo.tsx`:
  - [ ] Find the selected cards counter display (shows "1 of 3", "2 of 3", etc.)
  - [ ] Remove or hide this component
- [ ] Test: Play game, no selected count visible at top
- [ ] Clean up any unused state/props related to selected count display
- [ ] **Commit:** "Remove selected cards counter from game UI"

---

## Section 7: Field Size Starting Board
**Goal:** +/- field size from weapons should affect the starting board size.

- [ ] In `Game.tsx` `startRound` or similar:
  - [ ] Calculate `totalStats.fieldSize` BEFORE generating the board
  - [ ] Use: `boardSize = getBoardSizeForAttributes(activeAttributes.length) + totalStats.fieldSize`
  - [ ] Clamp to reasonable min/max (e.g., min 9, max 21)
- [ ] In `gameUtils.ts`:
  - [ ] Ensure `generateGameBoard` handles varying sizes correctly
- [ ] Test: Start with +1 Field Stone → verify 13 cards on 3-attribute round
- [ ] Test: Start with +2 field size → verify 14 cards
- [ ] Test: (If possible) -1 field size → verify 11 cards
- [ ] Add unit test: `getBoardSizeForAttributes(3) + fieldSize` returns expected value
- [ ] **Commit:** "Field size weapons now affect starting board size"

---

## Section 8: Hint System Rework
**Goal:** Start with 0 hints, max 3, Crystal Orb increases max hints instead of starting hints.

### 8.1 Change Starting Hints to 0
- [ ] In `gameDefinitions.ts`:
  - [ ] Set `DEFAULT_PLAYER_STATS.hints = 0`
  - [ ] Set `DEFAULT_PLAYER_STATS.maxHints = 3`
- [ ] In `types.ts`:
  - [ ] Add `maxHints: number` to PlayerStats if not exists
  - [ ] Keep `hints: number` for current hint count

### 8.2 Change Crystal Orb Weapon
- [ ] In `gameDefinitions.ts`:
  - [ ] Modify Crystal Orb weapons (all rarities):
    - [ ] Remove `hints` from effects
    - [ ] Add `maxHints` bonus: Common +1, Rare +2, Legendary +3
    - [ ] Update name to "Crystal Orb" (or keep same)
    - [ ] Update description: "Increases maximum hint capacity"
    - [ ] Update shortDescription accordingly

### 8.3 Enforce Max Hints Cap
- [ ] In `Game.tsx`:
  - [ ] When gaining hints (from matches, weapons), cap at `totalStats.maxHints`
  - [ ] Ensure `hints = Math.min(hints, maxHints)` after any hint gain
- [ ] In `GameInfo.tsx`:
  - [ ] Display hints as "X / Y" where Y is maxHints

### 8.4 Keep Hint-on-Match Weapons
- [ ] Verify Seeker Lens and similar weapons still work
- [ ] They should still grant hints on match (up to max)

### 8.5 Testing
- [ ] Test: New game starts with 0 hints
- [ ] Test: Crystal Orb increases max (not starting) hints
- [ ] Test: Can't exceed max hints
- [ ] Test: Seeker Lens still grants hints on match
- [ ] Add unit tests for hint cap logic
- [ ] **Commit:** "Hint rework: start 0, max 3, Crystal Orb increases max"

---

## Section 9: Attribute Unlock Screens
**Goal:** Show explanatory screen when new attributes unlock, with optional mini practice game.

### 9.1 Create AttributeUnlockScreen Component
- [ ] Create `src/components/AttributeUnlockScreen.tsx`:
  - [ ] Props: `newAttribute: AttributeName`, `onContinue: () => void`, `onPractice: () => void`
  - [ ] Display:
    - [ ] Title: "New Attribute Unlocked!"
    - [ ] Attribute name and visual example
    - [ ] Explanation of how this attribute works
    - [ ] For Shading: Show Solid, Striped, Open examples
    - [ ] For Background: Show the 3 background colors
  - [ ] Note: "Matches are now worth 1-2 money and 2-3 XP per card"
  - [ ] Buttons: "Continue" and "Practice First"

### 9.2 Create AttributePractice Component
- [ ] Create `src/components/AttributePractice.tsx`:
  - [ ] Mini untimed practice game
  - [ ] Show 3 random cards, ask "Is this a valid SET?"
  - [ ] User taps Yes or No
  - [ ] Show result (correct/incorrect) with explanation
  - [ ] "Try Another" button to get new cards
  - [ ] "Exit" button to return to unlock screen

### 9.3 Integrate into Game Flow
- [ ] In `Game.tsx`:
  - [ ] Add `attribute_unlock` to gamePhase type
  - [ ] Track `newlyUnlockedAttribute: AttributeName | null`
  - [ ] After Round 3 → check if shading was just unlocked
  - [ ] After Round 9 → check if background was just unlocked
  - [ ] Show AttributeUnlockScreen before starting next round

### 9.4 Final Round Warning Screen
- [ ] Create final round warning screen:
  - [ ] Title: "Final Round!"
  - [ ] Text: "This is the ultimate challenge. All 5 attributes are now active. Good luck!"
  - [ ] Dramatic styling
  - [ ] "I'm Ready" button

### 9.5 Update Reward Values
- [ ] In `GameBoard.tsx` or `gameUtils.ts`:
  - [ ] Verify/implement rewards per card: 1-2 money (random), 2-3 XP (random)
  - [ ] Ensure this is per-card, not per-match

### 9.6 Testing
- [ ] Test: Complete Round 3, see Shading unlock screen
- [ ] Test: Practice mode works, shows valid/invalid feedback
- [ ] Test: Complete Round 9, see Background unlock screen
- [ ] Test: Before Round 10, see Final Round warning
- [ ] Test: Rewards are 1-2 money and 2-3 XP per card
- [ ] **Commit:** "Add attribute unlock screens with practice mode"

---

## Section 10: Double-Click to Purchase
**Goal:** Double-clicking a weapon in shop instantly purchases it (no confirmation).

- [ ] In `WeaponShop.tsx`:
  - [ ] Track `lastTapTime` and `lastTappedIndex` for double-tap detection
  - [ ] On first tap: Focus the weapon (existing behavior)
  - [ ] On second tap within 300ms on same weapon: Instant purchase (bypass confirm)
  - [ ] Only works if player can afford the weapon
- [ ] Test: Double-tap weapon → immediately purchased
- [ ] Test: Double-tap unaffordable weapon → nothing happens
- [ ] Test: Single tap → just focuses, no purchase
- [ ] **Commit:** "Add double-click instant purchase in weapon shop"

---

## Section 11: Victory Screen
**Goal:** After completing Round 10, show a victory celebration screen.

- [ ] Create `src/components/VictoryScreen.tsx`:
  - [ ] Props: `player`, `finalScore`, `weapons`, `onReturnToMenu`
  - [ ] Layout:
    - [ ] Big celebratory title: "🎉 Victory!" or "You Did It!"
    - [ ] Final score prominently displayed
    - [ ] Character image/name
    - [ ] Stats summary: Total matches, time played, etc.
    - [ ] Scrollable weapons list showing all weapons collected
      - [ ] Group by type, show rarity colors
      - [ ] Show weapon icons and names
    - [ ] "Return to Menu" button at bottom
  - [ ] Exciting visual design (confetti? sparkles? gold theme?)

- [ ] In `Game.tsx`:
  - [ ] Add `victory` to gamePhase type
  - [ ] After completing Round 10 successfully → transition to `victory` phase
  - [ ] Pass necessary data to VictoryScreen

- [ ] Test: Complete Round 10 → Victory screen appears
- [ ] Test: All weapons collected are shown
- [ ] Test: Return to Menu works
- [ ] **Commit:** "Add Victory screen after completing final round"

---

## Section 12: Holographic Card Shimmer Effect
**Goal:** Make holographic cards have a shiny, shimmering Balatro-style effect.

- [ ] Research Balatro holographic effect (prismatic/rainbow shimmer that shifts with movement)
- [ ] In `Card.tsx`:
  - [ ] For holographic cards, add animated gradient overlay
  - [ ] Use `Animated` API or CSS transforms for shimmer movement
  - [ ] Effect: Subtle rainbow/prismatic colors that shift diagonally
  - [ ] Consider using linear-gradient animation
  - [ ] Not too distracting, but clearly special
- [ ] May need to use `react-native-linear-gradient` or similar
- [ ] Test: Holographic cards visibly shimmer
- [ ] Test: Effect is visible but not overwhelming
- [ ] Test: Works on iOS, Android, Web
- [ ] **Commit:** "Add Balatro-style shimmer to holographic cards"

---

## Section 13: Stats Preview on Purchase
**Goal:** When viewing a weapon in shop, show current stat vs. what it would become.

- [ ] In `WeaponShop.tsx`:
  - [ ] When a weapon is focused, calculate affected stats
  - [ ] Display comparison: "Field Size: 12 → 13" or "Grace Chance: 0% → 5%"
  - [ ] Green color for increases, red for decreases
  - [ ] Show in the weapon detail area
- [ ] In `LevelUp.tsx`:
  - [ ] Same feature for level up weapon preview
- [ ] Create helper: `getStatComparison(currentStats, weapon) → {statName, before, after}[]`
- [ ] Test: Focus weapon → see clear before/after comparison
- [ ] Test: Multiple stat changes show correctly
- [ ] **Commit:** "Add stat preview comparison when viewing weapons"

---

## Section 14: Final Cleanup & Documentation

### 14.1 Unit Test Coverage
- [ ] Review all sections above for unit test requirements
- [ ] Add any missing tests
- [ ] Run full test suite, ensure all pass

### 14.2 Clean Up Comments
- [ ] Search for TODO, FIXME, HACK comments
- [ ] Remove or resolve each one
- [ ] Remove any commented-out code
- [ ] Remove debug console.log statements

### 14.3 Update CLAUDE.md
- [ ] Update mulligan → Grace documentation
- [ ] Update hint system documentation (0 starting, max 3)
- [ ] Update auto-hint behavior documentation
- [ ] Update field size weapon documentation
- [ ] Add attribute unlock screen info
- [ ] Add victory screen info
- [ ] Update weapon list if any changed
- [ ] Remove any stale information

### 14.4 Update README.md (if exists)
- [ ] Ensure consistent with CLAUDE.md
- [ ] Update any outdated feature descriptions

### 14.5 Final Review
- [ ] Play through full adventure mode
- [ ] Verify all features work as expected
- [ ] Check for any visual glitches
- [ ] Verify all new screens look polished
- [ ] **Commit:** "Final cleanup, tests, and documentation update"

---

## Summary of Commits
1. Add menu pause system
2. Rename mulligan to Grace + logic change
3. Add 'Free' indicator to Level Up
4. Add inventory display bar
5. Nerf auto-hint (15s after match)
6. Remove selected cards counter
7. Field size affects starting board
8. Hint system rework
9. Attribute unlock screens
10. Double-click to purchase
11. Victory screen
12. Holographic shimmer effect
13. Stats preview on purchase
14. Final cleanup & documentation
