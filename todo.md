# NShapes Tutorial System - Implementation Plan

## Overview
Create an interactive tutorial system that teaches players how to play NShapes through guided examples and practice, with a step-by-step overlay system for explaining game UI elements.

---

## Phase 1: Stats Menu Expansion - COMPLETED

### 1.1 Convert Stats Button to Menu
- [x] Rename `StatsButton.tsx` to `GameMenu.tsx`
- [x] Change button label from "STATS" to menu icon or "MENU"
- [x] Create menu modal with options list

### 1.2 Menu Options
- [x] Option 1: "Character Stats" - existing stats display
- [x] Option 2: "Weapon Guide" - new weapons reference screen

### 1.3 Weapon Guide Screen
- [x] Create `WeaponGuide.tsx` component
- [x] List all 15 weapon types with:
  - Icon/visual representation
  - Name and description
  - Effect explanation
  - Rarity tiers (Common/Rare/Legendary stats)
- [x] Make scrollable with category sections
- [x] Use consistent styling with rest of game

---

## Phase 2: Foundation & Library Setup - COMPLETED

### 2.1 Research & Install Step-by-Step Guide Library
- [x] Research React Native compatible tutorial/tooltip libraries (react-native-copilot, react-native-spotlight-tour, etc.)
- [x] Install chosen library and verify it works with Expo 54
- [x] Create basic proof-of-concept with highlight and tooltip

### 2.2 Tutorial State Management
- [x] Add `TutorialState` interface to `TutorialContext.tsx`
- [x] Create `TutorialContext.tsx` for managing tutorial progress
- [x] Add localStorage persistence for `hasCompletedTutorial` flag
- [x] Add tutorial phase to Game.tsx phase system

---

## Phase 3: Tutorial Flow - Card Matching Education - COMPLETED

### 3.1 Tutorial Entry Point
- [x] Add "Tutorial" button to CharacterSelection.tsx (next to Adventure/Free Play)
- [x] Create `TutorialScreen.tsx` component
- [x] Add "tutorial" phase to Game.tsx state machine

### 3.2 Game Explanation Intro
- [x] Create intro screen explaining SET matching concept
- [x] Explain the 3 core attributes (Shape, Color, Number)
- [x] Use nice animations/UI to make it engaging

### 3.3 Interactive Quiz - 3 Card Examples (x3)
- [x] Create `TutorialQuiz.tsx` component
- [x] Generate/design 3 quiz scenarios (mix of valid and invalid matches)
- [x] Display 3 cards and ask "Is this a valid match?" (Yes/No buttons)
- [x] If correct: Show "That's right!" with brief explanation
- [x] If incorrect: Explain WHY it's not a match (which attribute breaks the rule)
- [x] Progress through all 3 quiz rounds

### 3.4 Explain Complexity Progression
- [x] Create screen explaining attribute progression:
  - Rounds 1-3: 3 attributes (Shape, Color, Number)
  - Rounds 4-9: 4 attributes (adds Shading)
  - Round 10: 5 attributes (adds Background Color)
- [x] Show visual examples of the new attributes

---

## Phase 4: Tutorial Flow - Guided Practice - COMPLETED

### 4.1 Practice Board Setup
- [x] Create `TutorialPractice.tsx` component
- [x] Generate a simplified practice board (3x4 grid)
- [x] Ensure at least one valid SET exists on the board

### 4.2 Guided Practice Matches (x3)
- [x] Track matches during practice (need 3 total)
- [x] On VALID match: Brief "Great job!" feedback
- [x] On INVALID match: Pause and explain WHY it wasn't valid
- [x] Show which attribute(s) broke the SET rule
- [x] After explanation, let them continue
- [x] Count towards 3 match requirement regardless of valid/invalid

### 4.3 Practice Complete
- [x] Show congratulations/completion message
- [x] Transition to UI tour

---

## Phase 5: Step-by-Step UI Guide (Spotlight Tour) - COMPLETED

### 5.1 Integrate Spotlight Tour Library
- [x] Wrap game components with tour provider
- [x] Create tour step definitions for each UI element
- [x] Add highlight/spotlight animations

### 5.2 Game Header Tour Steps
- [x] Step 1: Round indicator - "This shows which round you're on"
- [x] Step 2: Score/Target - "Reach this target to complete the round"
- [x] Step 3: Timer - "Complete the round before time runs out"
- [x] Step 4: Health (hearts) - "Invalid matches cost 1 health"
- [x] Step 5: Money - "Earn money to buy weapons in the shop"
- [x] Step 6: Level/XP bar - "Gain XP to level up and earn weapon rewards"

### 5.3 Gameplay Elements Tour
- [x] Step 7: Hint button - "Use hints to highlight a valid SET"
- [x] Step 8: Mulligan counter - "Mulligans prevent health loss from invalid matches"
- [x] Step 9: Menu button - "Access character stats and weapon guide here"

### 5.4 Menu Tour (Final Steps)
- [x] Step 10: Guide user to open the Menu
- [x] Step 11: Highlight "Character Stats" option
- [x] Step 12: Highlight "Weapon Guide" option
- [x] Show completion message: "You're ready to play! Good luck!"
- [x] Mark tutorial as completed in localStorage
- [x] Offer to start Adventure Mode or return to menu

---

## Phase 6: First-Time Player Detection - COMPLETED

### 6.1 Tutorial Prompt on First Adventure Start
- [x] Check `hasCompletedTutorial` when Adventure is selected
- [x] If not completed, show modal: "Would you like to play the tutorial first?"
- [x] Options: "Start Tutorial" / "Skip - Start Adventure"
- [x] If skipped, still mark as "tutorial offered" (don't ask again)

### 6.2 Persistence Implementation
- [x] Use AsyncStorage for React Native persistence
- [x] Store: `tutorialCompleted`, `tutorialOffered`
- [x] Tutorial state persists across sessions

---

## Phase 7: Unit Tests - COMPLETED

### 7.1 Tutorial Logic Tests
- [x] Test SET validation logic with various card combinations
- [x] Test quiz answer validation (correct/incorrect detection)
- [x] Test tutorial progression state machine

### 7.2 Component Tests
- [x] Test TutorialPractice board generation
- [x] Test deck creation for different attribute counts
- [x] Test attribute progression logic

### 7.3 Test Results
- [x] All 22 tests passing in `__tests__/tutorial.test.ts`

---

## Phase 8: Polish & Final Integration - IN PROGRESS

### 8.1 UI/UX Polish
- [x] Ensure consistent styling with game's color system
- [x] Add progress indicator (Step X of Y)
- [ ] Test on iOS, Android, and Web

### 8.2 Final Integration
- [x] Tutorial can be started from main menu
- [x] All components integrated properly
- [ ] Test edge cases (exit mid-tutorial, backgrounding app, etc.)

---

## File Changes Summary

### New Files Created
- `src/components/TutorialScreen.tsx` - Main tutorial container
- `src/components/TutorialQuiz.tsx` - Quiz component for 3-card matching
- `src/components/TutorialPractice.tsx` - Guided practice board
- `src/components/GameMenu.tsx` - Expanded menu (replaces StatsButton)
- `src/components/WeaponGuide.tsx` - All weapons reference
- `src/context/TutorialContext.tsx` - Tutorial state management
- `__tests__/tutorial.test.ts` - Tutorial unit tests (22 tests)

### Modified Files
- `src/components/Game.tsx` - Add tutorial phase, first-time detection
- `src/components/CharacterSelection.tsx` - Add Tutorial button
- `src/components/LevelUp.tsx` - Replace StatsButton with GameMenu
- `src/components/RoundSummary.tsx` - Replace StatsButton with GameMenu
- `src/components/EnemySelection.tsx` - Replace StatsButton with GameMenu
- `src/components/ItemShop.tsx` - Replace StatsButton with GameMenu
- `src/components/WeaponShop.tsx` - Replace StatsButton with GameMenu
- `app/_layout.tsx` - Add TutorialProvider wrapper

---

## Dependencies Added
- `react-native-copilot` - Step-by-step tour library
- `@react-native-async-storage/async-storage` - Persistence

---

## Notes
- Multiplayer is NOT a priority - tutorial is single-player only
- Use existing color system (COLORS from colors.ts)
- Follow existing component patterns (StyleSheet, similar structure)
- Tutorial is concise but thorough
