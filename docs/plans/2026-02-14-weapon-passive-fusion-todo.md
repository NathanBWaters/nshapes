# Weapon & Passive Fusion System - Implementation Todo

Reference: [Design Document](./2026-02-14-weapon-passive-fusion-design.md)

---

> **For Claude:** Check off tasks with `[x]` as you complete them. Follow TDD: write tests first, implement, verify tests pass. You MUST commit the code once the unit tests and integration tests are passing at the end of each phase. Do not proceed to the next phase until the current phase's tests pass and code is committed.

---

## Existing Tests to Update/Remove

These existing test files will need modification:
- `__tests__/weaponEffects.test.ts` - Update for new level-based effects
- `__tests__/effectCaps.test.ts` - **Remove entirely** (cap system removed)
- `__tests__/bridgeWeapons.test.ts` - **Remove entirely** (bridge system removed)
- `__tests__/weaponShop.test.ts` - **Remove entirely** (shop removed)
- `__tests__/levelUp.test.ts` - Major rewrite for mixed pool + upgrades
- `__tests__/matchRewards.test.tsx` - Update for new weapon effects

---

## Phase 1: Data Model Updates ✅ COMPLETE

### 1.1 Update Weapon Type ✅
- [x] Add `type: 'weapon' | 'passive'` field to FusionWeapon interface
- [x] Add `fusionTier: 0 | 1 | 2` field (0 = base, 1 = Tier 1, 2 = Tier 2)
- [x] Add `fusionParents?: [string, string]` field for tracking fusion inputs
- [x] Change `effects` to level-based structure: `levelEffects: { 1: Effects, 2: Effects, 3: Effects }`
- [x] Add `limitation?: string` field for weapon limitations
- [x] Created FusionWeapon interface (new system) alongside legacy Weapon interface
- [x] Update `level` field type to `1 | 2 | 3` (WeaponLevel)

### 1.2 Create Player Inventory Type ✅
- [x] Create `PlayerInventory` interface with `weapons: (FusionWeapon | null)[]` (length 4)
- [x] Add `passives: (FusionWeapon | null)[]` (length 4) to PlayerInventory
- [x] Add optional `inventory?: PlayerInventory` to Player interface (coexists with legacy weapons)

### 1.3 Create Fusion System Types ✅
- [x] Create `FusionRecipe` interface with `inputs`, `output`, `tier`
- [x] Create `FUSION_RECIPES` constant array with all 30 recipes (15 Tier 1 + 15 Tier 2)

### 1.4 Update Game State ✅
- [x] Add `fusionGemPending?: boolean` to GameState
- [x] `rerollCost` already exists in GameState
- [x] `timeGainTriggersThisRound` already exists in GameState
- [x] Made `effectCaps` optional in PlayerStats (deprecated, will be removed)

### 1.5 Update WeaponName Type ✅
- [x] Add all Tier 1 fusion names to WeaponName union
- [x] Add all Tier 2 fusion names to WeaponName union
- [x] Added LegacyWeaponName type for backward compatibility

### 1.6 Phase 1 Unit Tests ✅
- [x] Create `__tests__/types/weapon.test.ts` (54 tests total)
  - [x] Test FusionWeapon interface accepts all required fields
  - [x] Test level-based effects structure validation
  - [x] Test fusionTier values (0, 1, 2)
  - [x] Test type discrimination ('weapon' | 'passive')
- [x] Create `__tests__/types/inventory.test.ts`
  - [x] Test PlayerInventory has exactly 4 weapon slots
  - [x] Test PlayerInventory has exactly 4 passive slots
  - [x] Test null slots are handled correctly
- [x] Create `__tests__/types/fusion.test.ts`
  - [x] Test FusionRecipe interface structure
  - [x] Test FUSION_RECIPES has 30 entries (15 Tier 1 + 15 Tier 2)
  - [x] Test all Tier 1 recipes have tier: 1
  - [x] Test all Tier 2 recipes have tier: 2
- [x] Removed obsolete test files (bridgeWeapons, capIncreaser, effectCaps, weaponShop)

### 1.7 Phase 1 Code Cleanup ✅
- [x] No debug console.log statements
- [x] Added legacy types for backward compatibility
- [x] Code formatting consistent
- [x] All linter issues resolved

### 1.8 Phase 1 Verification ✅
- [x] Run test suite: `npm test` - 3817 tests pass
- [x] Run typecheck: `npm run typecheck` - passes
- [x] Committed: dd8cc61

---

## Phase 2: Define New Weapon/Passive Data ✅ COMPLETE

> Note: Phase 2 was completed in Phase 1 when fusionDefinitions.ts was created with all weapon/passive data.
> This phase adds comprehensive unit tests for the definitions.

### 2.1 Define Base Weapons (6 total) ✅
- [x] Blast Powder - levels 1/2/3 with limitation
- [x] Flint Spark - levels 1/2/3 with limitation
- [x] Prismatic Ray - levels 1/2/3 with limitation
- [x] Chaos Shard - levels 1/2/3 with limitation
- [x] Echo Stone - levels 1/2/3 with limitation
- [x] Link Stone - levels 1/2/3 with limitation

### 2.2 Define Base Passives (13 total) ✅
- [x] Oracle Eye - levels 1/2/3
- [x] Field Stone - levels 1/2/3
- [x] Growth Seed - levels 1/2/3
- [x] Second Chance - levels 1/2/3
- [x] Fortune Token - levels 1/2/3
- [x] Life Vessel - levels 1/2/3
- [x] Mending Charm - levels 1/2/3
- [x] Crystal Orb - levels 1/2/3
- [x] Seeker Lens - levels 1/2/3
- [x] Scholar's Tome - levels 1/2/3
- [x] Fortune's Favor - levels 1/2/3
- [x] Chrono Shard - levels 1/2/3
- [x] Time Drop - levels 1/2/3

### 2.3 Define Tier 1 Fusions (15 total) ✅
- [x] Infernal Charge (Blast + Fire)
- [x] Detonation Beam (Blast + Laser)
- [x] Shrapnel Storm (Blast + Ricochet)
- [x] Resonant Blast (Blast + Echo)
- [x] Chain Detonator (Blast + Link)
- [x] Solar Flare (Fire + Laser)
- [x] Wildfire Shard (Fire + Ricochet)
- [x] Blazing Echo (Fire + Echo)
- [x] Burning Bonds (Fire + Link)
- [x] Prism Shatter (Laser + Ricochet)
- [x] Mirror Beam (Laser + Echo)
- [x] Linked Annihilation (Laser + Link)
- [x] Cascade Chaos (Ricochet + Echo)
- [x] Chaotic Web (Ricochet + Link)
- [x] Resonant Link (Echo + Link)

### 2.4 Define Tier 2 Fusions (15 total) ✅
- [x] Supernova (Infernal Charge + Detonation Beam)
- [x] Eternal Flame (Infernal Charge + Wildfire Shard)
- [x] Extinction Ray (Detonation Beam + Solar Flare)
- [x] Reality Fracture (Shrapnel Storm + Prism Shatter)
- [x] Infinite Echo (Resonant Blast + Cascade Chaos)
- [x] Doom Network (Chain Detonator + Chaotic Web)
- [x] Prismatic Inferno (Solar Flare + Mirror Beam)
- [x] Soul Pyre (Blazing Echo + Burning Bonds)
- [x] Plague Fire (Wildfire Shard + Chaotic Web)
- [x] Quantum Entanglement (Linked Annihilation + Resonant Link)
- [x] Paradox Engine (Mirror Beam + Cascade Chaos)
- [x] Grid Eraser (Prism Shatter + Linked Annihilation)
- [x] Scorched Earth (Burning Bonds + Chain Detonator)
- [x] Phoenix Storm (Resonant Blast + Blazing Echo)
- [x] Armageddon (Shrapnel Storm + Chain Detonator)

### 2.5 Create Fusion Recipe Registry ✅
- [x] Define all 15 Tier 1 fusion recipes
- [x] Define all 15 Tier 2 fusion recipes
- [x] Create helper function `getFusionResult(weaponA, weaponB)`
- [x] Create helper function `canFuse(weaponA, weaponB)`
- [x] Create helper function `getEligibleFusions(playerWeapons)`

### 2.6 Phase 2 Unit Tests ✅
- [x] Create `__tests__/weapons/baseWeapons.test.ts` (34 tests)
  - [x] Test all 6 base weapons have type: 'weapon'
  - [x] Test all 6 base weapons have fusionTier: 0
  - [x] Test all base weapons have effects for levels 1, 2, 3
  - [x] Test all base weapons have limitation defined
  - [x] Test level progression is incremental
  - [x] Test each weapon's effects at each level
- [x] Create `__tests__/weapons/basePassives.test.ts` (42 tests)
  - [x] Test all 13 base passives have type: 'passive'
  - [x] Test all passives have fusionTier: 0
  - [x] Test all passives have effects for levels 1, 2, 3
  - [x] Test passives do NOT have limitation field
  - [x] Test each passive's level effects
- [x] Create `__tests__/weapons/tier1Fusions.test.ts` (21 tests)
  - [x] Test all 15 Tier 1 fusions exist
  - [x] Test all Tier 1 fusions have fusionTier: 1
  - [x] Test all Tier 1 fusions have fusionParents defined
  - [x] Test all Tier 1 fusions have effects for levels 1, 2, 3
  - [x] Test fusion parents and recipes match
- [x] Create `__tests__/weapons/tier2Fusions.test.ts` (21 tests)
  - [x] Test all 15 Tier 2 fusions exist
  - [x] Test all Tier 2 fusions have fusionTier: 2
  - [x] Test all Tier 2 fusions have fusionParents (both Tier 1)
  - [x] Test Supernova has correct parents (Infernal Charge + Detonation Beam)
  - [x] Test Armageddon has correct parents (Shrapnel Storm + Chain Detonator)
- [x] Fusion recipe tests are in `__tests__/types/fusion.test.ts` (22 tests)
  - [x] Test getFusionResult returns correct fusion for valid pairs
  - [x] Test getFusionResult returns null for invalid pairs
  - [x] Test getFusionResult is commutative (A+B = B+A)
  - [x] Test canFuse returns true for valid Tier 1 pairs
  - [x] Test canFuse returns true for valid Tier 2 pairs
  - [x] Test canFuse returns false for passive + weapon
  - [x] Test canFuse returns false for passive + passive
  - [x] Test canFuse returns false for weapons below level 3
  - [x] Test getEligibleFusions covered in tier1/tier2 tests

### 2.7 Phase 2 Code Cleanup ✅
- [x] No debug console.log statements
- [x] No placeholder or TODO comments
- [x] Consistent naming conventions
- [x] Consistent effect value formatting

### 2.8 Phase 2 Verification ✅
- [x] Run test suite: `npm test` - 3935 tests pass
- [x] Run typecheck: `npm run typecheck` - passes
- [x] Commit with descriptive message

---

## Phase 3: Remove Old Content ✅ COMPLETE

### 3.1 Remove Mastery Weapons ✅
- [x] Remove Echo Mastery
- [x] Remove Laser Mastery
- [x] Remove Grace Mastery
- [x] Remove Explosion Mastery
- [x] Remove Hint Mastery
- [x] Remove Time Mastery
- [x] Remove Healing Mastery
- [x] Remove Fire Mastery
- [x] Remove Ricochet Mastery
- [x] Remove Growth Mastery
- [x] Remove Coin Mastery
- [x] Remove Time Trigger Mastery

### 3.2 Remove Rarity Variants ✅
- [x] Remove all "rare" weapon variants
- [x] Remove all "epic" weapon variants
- [x] Remove standalone legendary variants (keep fusion legendaries)

### 3.3 Remove Bridge Weapons ✅
- [x] Remove Chaos Conduit
- [x] Remove Temporal Rift
- [x] Remove Soul Harvest
- [x] Remove Cascade Core
- [x] Remove Fortune's Blessing
- [x] Remove Wisdom Chain
- [x] Remove Grace Conduit
- [x] Remove Life Link

### 3.4 Remove Challenge Legendaries ✅
- [x] Remove Prismatic Perfection
- [x] Remove Tabula Rasa
- [x] Remove Desperate Measures

### 3.5 Consolidate Connector Weapons ✅
- [x] Remove Link Chain (rare variant)
- [x] Remove Soul Link (legendary variant)
- [x] Remove Web Spinner
- [x] Remove Web Master
- [x] Remove Echo Chamber
- [x] Remove Resonance Core
- [x] Remove Sympathetic Flames
- [x] Remove Neural Network
- [x] Remove Revenge Linker

### 3.6 Remove Cap System ✅
- [x] Remove EffectCaps interface
- [x] Remove effectCaps from PlayerStats
- [x] Remove cap-related logic from calculatePlayerTotalStats
- [x] Remove CapIncreaseType and CapIncreaseEffect types
- [x] Remove capIncrease field from Weapon interface

### 3.7 Remove Bridge Effect System ✅
- [x] Remove BridgeTriggerType
- [x] Remove BridgeEffectType
- [x] Remove BridgeEffect interface
- [x] Remove bridgeEffect field from Weapon
- [x] Remove rollBridgeEffects function
- [x] Remove getBridgeWeaponsForTrigger function
- [x] Remove hasBridgeWeaponsForTrigger function

### 3.8 Phase 3 Test Cleanup ✅
- [x] **Deleted** `__tests__/effectCaps.test.ts` entirely (in Phase 1)
- [x] **Deleted** `__tests__/bridgeWeapons.test.ts` entirely (in Phase 1)
- [x] **Deleted** `__tests__/weaponShop.test.ts` entirely (in Phase 1)
- [x] Updated `__tests__/weaponEffects.test.ts`
  - [x] Remove tests for mastery weapons
  - [x] Remove tests for rarity-based effects
  - [x] Remove tests for cap increase weapons
  - [x] Remove tests for bridge effect triggers
- [x] Created `__tests__/cleanup/removedContent.test.ts` (17 tests)
  - [x] Test WEAPONS array does not contain any mastery weapons
  - [x] Test WEAPONS array does not contain any rarity variants
  - [x] Test WEAPONS array does not contain any bridge weapons
  - [x] Test PlayerStats does not have effectCaps field
  - [x] Test Weapon interface does not have rarity field
  - [x] Test Weapon interface does not have price field
  - [x] Test Weapon interface does not have bridgeEffect field
  - [x] Test Weapon interface does not have capIncrease field

### 3.9 Phase 3 Code Cleanup ✅
**Goal:** Ensure all removed content is fully cleaned up with no remnants.

**Tasks:**
- [x] Remove any debug console.log statements
- [x] Remove any commented-out old weapon definitions
- [x] Remove any orphaned imports referencing deleted types
- [x] Remove any unused helper functions for old systems
- [x] Search codebase for references to removed weapons/types
- [x] ESLint not configured in project (skipped)

### 3.10 Phase 3 Verification ✅
- [x] Run test suite: `npm test` - 3951 tests pass
- [x] Run typecheck: `npm run typecheck` - passes
- [x] Commit pending

---

## Phase 4: Update Character Definitions ✅ COMPLETE

### 4.1 Update Starting Weapons ✅
- [x] Orange Tabby: Life Vessel (passive) + Mending Charm (passive)
- [x] Sly Fox: Flint Spark (weapon) + Blast Powder (weapon)
- [x] Emperor Penguin: Crystal Orb (passive) + Seeker Lens (passive)
- [x] Corgi: Field Stone (passive) + Growth Seed (passive)
- [x] Pelican: Oracle Eye (passive) + Oracle Eye (passive)
- [x] Badger: Second Chance (passive) + Fortune Token (passive)

### 4.2 Update initializePlayer Function ✅
- [x] Initialize player with 4-slot weapons array
- [x] Initialize player with 4-slot passives array
- [x] Place starting items in correct arrays based on type

### 4.3 Phase 4 Unit Tests ✅
- [x] Created `__tests__/characters/startingLoadouts.test.ts` (36 tests)
  - [x] Test Orange Tabby starts with 0 weapons, 2 passives
  - [x] Test Sly Fox starts with 2 weapons, 0 passives
  - [x] Test Emperor Penguin starts with 0 weapons, 2 passives
  - [x] Test Corgi starts with 0 weapons, 2 passives
  - [x] Test Pelican starts with 0 weapons, 2 passives (both Oracle Eye)
  - [x] Test Badger starts with 0 weapons, 2 passives
  - [x] Test all starting items are level 1
- [x] Created `__tests__/player/initializePlayer.test.ts` (12 tests)
  - [x] Test initializePlayer creates 4-slot weapons array
  - [x] Test initializePlayer creates 4-slot passives array
  - [x] Test starting weapons placed in weapons array
  - [x] Test starting passives placed in passives array
  - [x] Test empty slots are null
  - [x] Test Sly Fox weapons are in correct slots
  - [x] Test Orange Tabby passives are in correct slots
- [x] Existing character tests still pass

### 4.4 Phase 4 Code Cleanup ✅
**Goal:** Ensure character definitions are clean and consistent.

**Tasks:**
- [x] No debug console.log statements
- [x] Commented-out character configs preserved for future reference
- [x] Consistent formatting across all character definitions
- [x] ESLint not configured (skipped)

### 4.5 Phase 4 Verification ✅
- [x] Run test suite: `npm test` - 3997 tests pass
- [x] Run typecheck: `npm run typecheck` - passes
- [x] Commit pending

---

## Phase 5: Level Up System (Utility Functions Complete)

> **Note:** Utility functions complete and tested. UI integration (LevelUp.tsx) deferred to later phase alongside Game.tsx integration.

### 5.1 Update Level Up Option Generation ✅
- [x] Create function to generate mixed pool options (`generateLevelUpOptions`)
- [x] Include new weapons (if weapon slots < 4)
- [x] Include new passives (if passive slots < 4)
- [x] Include weapon upgrades (if any weapon < level 3)
- [x] Include passive upgrades (if any passive < level 3)
- [x] Apply contextual filtering based on slot availability

### 5.2 Update Level Up UI (LevelUp.tsx) (Deferred)
- [ ] Display mixed options (new items + upgrades)
- [ ] Show "NEW" badge for new items
- [ ] Show "Lv.X ↑" for upgrades with before/after stats
- [ ] Add reroll button with current cost display
- [ ] Disable reroll if can't afford
- [ ] Update reroll cost after each reroll (double)

### 5.3 Implement Upgrade Logic ✅
- [x] Create function to upgrade weapon/passive level (`upgradeItem`)
- [x] Update effects when leveling up (uses `levelEffects`)
- [x] Cap at level 3

### 5.4 Reset Reroll Cost ✅
- [x] `resetRerollCost()` function returns initial cost (5)

### 5.5 Phase 5 Unit Tests ✅
- [x] Existing `__tests__/levelUp.test.ts` retained (multi-level-up queue tests)
- [x] Created `__tests__/levelUp/contextualFiltering.test.ts` (20 tests)
  - [x] Test player with 4 weapons sees no new weapons
  - [x] Test player with 4 weapons can still see weapon upgrades
  - [x] Test player with 4 passives sees no new passives
  - [x] Test player with 4 passives can still see passive upgrades
  - [x] Test player with room for both sees mixed options
  - [x] Test player with all items at level 3 sees only new items
- [x] Created `__tests__/levelUp/upgradeLogic.test.ts` (22 tests)
  - [x] Test upgradeItem increases level from 1 to 2
  - [x] Test upgradeItem increases level from 2 to 3
  - [x] Test upgradeItem does nothing at level 3
  - [x] Test upgraded item has correct effects for new level
  - [x] Test works for both weapons and passives
- [x] Created `__tests__/levelUp/rerollCost.test.ts` (13 tests)
  - [x] Test initial reroll cost is 5
  - [x] Test reroll cost doubles after each reroll (5 → 10 → 20 → 40)
  - [x] Test reroll cost resets to 5 at start of new round
  - [x] Test reroll disabled when player can't afford
  - [x] Test reroll deducts correct amount from player money

### 5.6 Phase 5 Code Cleanup ✅
- [x] No debug console.log statements
- [x] No temporary test code
- [x] Consistent function naming
- [x] No unused imports
- [x] ESLint not configured (skipped)

### 5.7 Phase 5 Verification ✅
- [x] Run test suite: `npm test` - 4052 tests pass
- [x] Run typecheck: `npm run typecheck` - passes
- [x] Commit pending

---

## Phase 6: Fusion System Implementation

### 6.1 Fusion Gem Drop System
- [ ] Add fusion gem drop chance calculation (roughly 1 per 2-3 rounds)
- [ ] Scale drop chance with round number
- [ ] Trigger fusionGemPending when gem drops
- [ ] Add visual indicator for gem drop

### 6.2 Create Fusion Gem Modal Component
- [ ] Create FusionGemModal.tsx component
- [ ] Display "FUSION GEM" header with animation
- [ ] Create Option A: Fuse Weapons section
  - [ ] Show grid of level 3 weapons
  - [ ] Allow selection of two weapons
  - [ ] Show fusion preview (name, icon, stats)
  - [ ] Gray out if <2 level 3 weapons with explanation
  - [ ] Add "FUSE" confirm button
- [ ] Create Option B: Random Level Ups section
  - [ ] Show "1-5 Random Level Ups" with mystery visual
  - [ ] Show items that could be upgraded
  - [ ] Add "TAKE CHANCE" button

### 6.3 Implement Fusion Execution
- [ ] Create executeFusion(weaponA, weaponB) function
- [ ] Look up fusion result from FUSION_RECIPES
- [ ] Remove both input weapons from inventory
- [ ] Create new fusion weapon at level 1
- [ ] Add fusion weapon to inventory
- [ ] Return freed slot information

### 6.4 Implement Random Level Ups
- [ ] Create executeRandomLevelUps() function
- [ ] Roll 1-5 (weighted or uniform)
- [ ] Apply upgrades to random eligible items
- [ ] Show animation sequence for each upgrade

### 6.5 Fusion Animation
- [ ] Create fusion animation component
- [ ] Animate two cards flying to center
- [ ] Particle burst on collision
- [ ] New card emergence and reveal
- [ ] Stats display with flourishes
- [ ] Card flying to inventory slot

### 6.6 Phase 6 Unit Tests
- [ ] Create `__tests__/fusion/fusionGemDrop.test.ts`
  - [ ] Test fusion gem drop chance calculation
  - [ ] Test drop chance scales with round number
  - [ ] Test fusionGemPending is set when gem drops
  - [ ] Test gem does not drop if fusionGemPending already true
- [ ] Create `__tests__/fusion/executeFusion.test.ts`
  - [ ] Test executeFusion removes both input weapons from inventory
  - [ ] Test executeFusion adds new fusion weapon to inventory
  - [ ] Test new fusion weapon is level 1
  - [ ] Test new fusion weapon has correct fusionTier (1 or 2)
  - [ ] Test new fusion weapon has correct fusionParents
  - [ ] Test slot count goes from 2 to 1 (frees a slot)
  - [ ] Test Tier 1 fusion: Blast Powder + Flint Spark = Infernal Charge
  - [ ] Test Tier 2 fusion: Infernal Charge + Detonation Beam = Supernova
  - [ ] Test fusion fails if weapons are not level 3
  - [ ] Test fusion fails if recipe doesn't exist
- [ ] Create `__tests__/fusion/randomLevelUps.test.ts`
  - [ ] Test executeRandomLevelUps returns 1-5 upgrades
  - [ ] Test upgrades are applied to eligible items only
  - [ ] Test items at level 3 are not upgraded
  - [ ] Test multiple upgrades can apply to different items
  - [ ] Test all upgrades applied to one item if only one eligible
- [ ] Create `__tests__/fusion/eligibility.test.ts`
  - [ ] Test canFuseWeapons returns false with 0 level 3 weapons
  - [ ] Test canFuseWeapons returns false with 1 level 3 weapon
  - [ ] Test canFuseWeapons returns true with 2+ level 3 weapons
  - [ ] Test getLevel3Weapons returns only level 3 weapons
  - [ ] Test getLevel3Weapons excludes passives

### 6.7 Phase 6 Code Cleanup
**Goal:** Ensure fusion system is clean and animations are polished.

**Tasks:**
- [ ] Remove any debug console.log statements
- [ ] Remove any temporary animation placeholders
- [ ] Ensure consistent component structure
- [ ] Remove any unused state variables
- [ ] Run linter and fix any issues

### 6.8 Phase 6 Verification
- [ ] Run test suite: `npm test`
- [ ] Run typecheck: `npm run typecheck`
- [ ] Commit with descriptive message

---

## Phase 7: Inventory UI

### 7.1 Create Inventory Display Component
- [ ] Create InventoryBar.tsx or update existing
- [ ] Display 4 weapon slots in a row
- [ ] Display 4 passive slots in a row
- [ ] Add visual separator between weapons and passives

### 7.2 Slot Display
- [ ] Show item icon in each slot
- [ ] Show level indicator (I, II, III or 1, 2, 3)
- [ ] Add distinct border for Tier 1 fusions
- [ ] Add extra flair for Tier 2 fusions (animated, legendary color)
- [ ] Show empty slot placeholder (weapon: sword outline, passive: shield)

### 7.3 Integrate with Game HUD
- [ ] Add inventory bar to main game screen
- [ ] Position appropriately (top of screen)
- [ ] Ensure it doesn't obstruct gameplay

### 7.4 Detailed Inventory View
- [ ] Create expandable inventory screen (accessible from menu)
- [ ] Show full item details on tap
- [ ] Display limitation text for weapons
- [ ] Show fusion parents for fused items
- [ ] Show "Fusion Ready!" if 2+ level 3 weapons

### 7.5 Phase 7 Unit Tests
- [ ] Create `__tests__/components/InventoryBar.test.tsx`
  - [ ] Test renders 4 weapon slots
  - [ ] Test renders 4 passive slots
  - [ ] Test renders separator between weapons and passives
  - [ ] Test empty slots show placeholder
  - [ ] Test filled slots show item icon
  - [ ] Test level indicator displays correctly
  - [ ] Test Tier 1 fusion has distinct border
  - [ ] Test Tier 2 fusion has legendary styling
- [ ] Create `__tests__/components/InventorySlot.test.tsx`
  - [ ] Test displays weapon icon
  - [ ] Test displays level badge
  - [ ] Test tap opens detail view
  - [ ] Test empty slot shows correct placeholder type
- [ ] Update `__tests__/components/InventoryBar.test.tsx` (if exists)

### 7.6 Phase 7 Code Cleanup
**Goal:** Ensure inventory UI is clean and follows design system.

**Tasks:**
- [ ] Remove any debug console.log statements
- [ ] Remove any inline styles (use NativeWind classes)
- [ ] Ensure consistent component prop naming
- [ ] Remove any unused component variants
- [ ] Run linter and fix any issues

### 7.7 Phase 7 Verification
- [ ] Run test suite: `npm test`
- [ ] Run typecheck: `npm run typecheck`
- [ ] Commit with descriptive message

---

## Phase 8: Hide Shop

### 8.1 Remove Shop from Flow
- [ ] Remove shop phase from game flow
- [ ] Skip shop screen between rounds
- [ ] Keep shop component code intact (do not delete)

### 8.2 Update Navigation
- [ ] Remove shop button from relevant screens
- [ ] Update round transition to skip shop

### 8.3 Phase 8 Unit Tests
- [ ] Create `__tests__/flow/shopRemoval.test.ts`
  - [ ] Test game flow skips shop phase
  - [ ] Test round end goes directly to level up (if applicable)
  - [ ] Test shop component still exists in codebase (not deleted)
  - [ ] Test no shop buttons rendered in game UI
- [ ] Update any existing flow tests that expect shop phase

### 8.4 Phase 8 Code Cleanup
**Goal:** Ensure shop removal is clean with no broken references.

**Tasks:**
- [ ] Remove any debug console.log statements
- [ ] Comment shop code clearly as "preserved for future use"
- [ ] Remove any orphaned shop-related state updates
- [ ] Ensure no dead code paths to shop
- [ ] Run linter and fix any issues

### 8.5 Phase 8 Verification
- [ ] Run test suite: `npm test`
- [ ] Run typecheck: `npm run typecheck`
- [ ] Commit with descriptive message

---

## Phase 9: Update Weapon Effect Logic

### 9.1 Update Effect Application
- [ ] Update calculatePlayerTotalStats to use level-based effects
- [ ] Get effects from weapon.effects[weapon.level]
- [ ] Handle fusion-specific effect logic

### 9.2 Implement Weapon Limitations
- [ ] Add limitation checking to explosion logic (same-color only)
- [ ] Add limitation checking to fire spread logic (same-color only)
- [ ] Add limitation checking to laser logic (one direction only)
- [ ] Add limitation checking to ricochet logic (max 3)
- [ ] Add limitation checking to echo logic (no weapon triggers)
- [ ] Add limitation checking to link logic (max 3 connections)

### 9.3 Implement Fusion Lifted Limitations
- [ ] Check fusionTier when applying limitations
- [ ] Skip limitations for fused weapons based on fusion type
- [ ] Implement fusion-specific bonus effects

### 9.4 Phase 9 Unit Tests
- [ ] **Rewrite** `__tests__/weaponEffects.test.ts`
  - [ ] Test calculatePlayerTotalStats uses level-based effects
  - [ ] Test level 1 weapon applies level 1 effects
  - [ ] Test level 3 weapon applies level 3 effects
  - [ ] Test multiple weapons stack effects correctly
  - [ ] Test weapons and passives both contribute to stats
- [ ] Create `__tests__/weapons/limitations.test.ts`
  - [ ] Test Blast Powder only explodes same-color cards
  - [ ] Test Flint Spark fire only spreads to same-color
  - [ ] Test Prismatic Ray only fires one direction
  - [ ] Test Chaos Shard limited to 3 ricochets
  - [ ] Test Echo Stone echo doesn't trigger weapons
  - [ ] Test Link Stone limited to 3 connections
- [ ] Create `__tests__/weapons/fusionLiftedLimitations.test.ts`
  - [ ] Test Infernal Charge fire spreads to any color
  - [ ] Test Solar Flare laser fires both directions
  - [ ] Test Resonant Blast echo triggers weapon effects
  - [ ] Test Shrapnel Storm allows 6 ricochets
  - [ ] Test Chain Detonator allows 5 connections
  - [ ] Test Tier 2 fusions have all relevant limitations lifted
- [ ] Create `__tests__/weapons/fusionBonusEffects.test.ts`
  - [ ] Test Infernal Charge: explosions set cards on fire
  - [ ] Test Detonation Beam: laser cards can explode
  - [ ] Test Solar Flare: laser path catches fire
  - [ ] Test Blazing Echo: echo ignites adjacent cards
  - [ ] Test Supernova: laser explodes AND ignites
  - [ ] Test Armageddon: explosions ricochet, ricochets explode
- [ ] Update `__tests__/matchRewards.test.tsx` for new effects

### 9.5 Phase 9 Code Cleanup
**Goal:** Ensure weapon effect logic is clean and well-documented.

**Tasks:**
- [ ] Remove any debug console.log statements
- [ ] Add clear comments explaining limitation logic
- [ ] Ensure consistent function signatures
- [ ] Remove any duplicated effect calculation code
- [ ] Run linter and fix any issues

### 9.6 Phase 9 Verification
- [ ] Run test suite: `npm test`
- [ ] Run typecheck: `npm run typecheck`
- [ ] Commit with descriptive message

---

## Phase 10: Final Integration Testing

### 10.1 Run All Existing Tests
- [ ] Run `npm test` and fix any failures
- [ ] Ensure no regressions in unmodified systems
- [ ] Update snapshots if needed

### 10.2 Integration Tests
- [ ] Create `__tests__/integration/fullGameFlow.test.ts`
  - [ ] Test complete game from character select to round 3
  - [ ] Test level up appears and functions correctly
  - [ ] Test fusion gem appears and modal works
  - [ ] Test fusion execution mid-game
  - [ ] Test inventory displays correctly throughout
- [ ] Create `__tests__/integration/slotLimits.test.ts`
  - [ ] Test cannot exceed 4 weapons
  - [ ] Test cannot exceed 4 passives
  - [ ] Test fusion frees a slot correctly
  - [ ] Test contextual filtering prevents overflow
- [ ] Create `__tests__/integration/levelProgression.test.ts`
  - [ ] Test weapon levels up from 1 to 2 to 3
  - [ ] Test effects update at each level
  - [ ] Test level 3 weapons can fuse
  - [ ] Test fused weapon starts at level 1
  - [ ] Test fused weapon can level to 3
- [ ] Create `__tests__/integration/fusionChain.test.ts`
  - [ ] Test Tier 1 fusion from two base weapons
  - [ ] Test Tier 1 fusion leveled to 3
  - [ ] Test Tier 2 fusion from two Tier 1 fusions
  - [ ] Test Tier 2 fusion has correct effects
- [ ] Update existing integration tests

### 10.3 Phase 10 Code Cleanup
**Goal:** Final cleanup before release.

**Tasks:**
- [ ] Remove ALL debug console.log statements across entire codebase
- [ ] Remove ALL commented-out old code
- [ ] Ensure consistent code formatting throughout
- [ ] Run linter and fix ALL issues
- [ ] Run prettier/formatter on all changed files

### 10.4 Phase 10 Verification
- [ ] Run full test suite: `npm test` - ALL tests must pass
- [ ] Run typecheck: `npm run typecheck` - no type errors
- [ ] Run lint: `npm run lint` - no lint errors
- [ ] Run icon validation: `npm run validate:icons`
- [ ] Document any known issues or edge cases

---

## Phase 11: Polish & Release

### 11.1 Visual Polish
- [ ] Add fusion gem drop animation
- [ ] Polish fusion modal transitions
- [ ] Add upgrade level-up flourishes
- [ ] Ensure consistent styling across all new UI

### 11.2 Balance Pass
- [ ] Playtest weapon percentages
- [ ] Playtest fusion power levels
- [ ] Adjust if any combinations are too weak/strong
- [ ] Verify fusion gem drop rate feels good

### 11.3 Documentation
- [ ] Update CLAUDE.md with new system overview
- [ ] Remove outdated weapon system documentation
- [ ] Add fusion recipes reference

### 11.4 Phase 11 Code Cleanup
**Goal:** Final polish and cleanup.

**Tasks:**
- [ ] Remove any remaining debug console.log statements
- [ ] Remove any remaining commented-out code
- [ ] Ensure all files have consistent formatting
- [ ] Run final lint check
- [ ] Review all new code for clarity and maintainability

### 11.5 Final Release
- [ ] Run full test suite: `npm test` - ALL tests must pass
- [ ] Run typecheck: `npm run typecheck` - passes
- [ ] Run icon validation: `npm run validate:icons` - passes
- [ ] Increment version in package.json
- [ ] Commit with message: "feat: implement weapon/passive fusion system"
- [ ] Push to remote
- [ ] Report version number

### 11.6 Completion
- [ ] Only when everything is completely done, output `<done>FULLY 100% ENTIRELY DONE</done>`

---

## Test File Summary

### New Test Files to Create
```
__tests__/
├── types/
│   ├── weapon.test.ts
│   ├── inventory.test.ts
│   └── fusion.test.ts
├── weapons/
│   ├── baseWeapons.test.ts
│   ├── basePassives.test.ts
│   ├── tier1Fusions.test.ts
│   ├── tier2Fusions.test.ts
│   ├── limitations.test.ts
│   ├── fusionLiftedLimitations.test.ts
│   └── fusionBonusEffects.test.ts
├── fusion/
│   ├── fusionRecipes.test.ts
│   ├── fusionGemDrop.test.ts
│   ├── executeFusion.test.ts
│   ├── randomLevelUps.test.ts
│   └── eligibility.test.ts
├── characters/
│   └── startingLoadouts.test.ts
├── player/
│   └── initializePlayer.test.ts
├── levelUp/
│   ├── contextualFiltering.test.ts
│   ├── upgradeLogic.test.ts
│   └── rerollCost.test.ts
├── components/
│   ├── InventoryBar.test.tsx
│   └── InventorySlot.test.tsx
├── flow/
│   └── shopRemoval.test.ts
├── cleanup/
│   └── removedContent.test.ts
└── integration/
    ├── fullGameFlow.test.ts
    ├── slotLimits.test.ts
    ├── levelProgression.test.ts
    └── fusionChain.test.ts
```

### Test Files to Delete
```
__tests__/effectCaps.test.ts
__tests__/bridgeWeapons.test.ts
__tests__/weaponShop.test.ts
```

### Test Files to Rewrite
```
__tests__/levelUp.test.ts
__tests__/weaponEffects.test.ts
```

### Test Files to Update
```
__tests__/matchRewards.test.tsx
(any other files referencing old weapon structure)
```

---

## Estimated Phase Order

1. **Phase 1** (Data Model) - Foundation, must be first
2. **Phase 3** (Remove Old Content) - Clean slate before adding new
3. **Phase 2** (Define New Data) - Create new weapon/passive definitions
4. **Phase 4** (Characters) - Update character starting builds
5. **Phase 5** (Level Up) - Core acquisition mechanic
6. **Phase 6** (Fusion System) - Core fusion mechanic
7. **Phase 7** (Inventory UI) - Display layer
8. **Phase 8** (Hide Shop) - Remove old flow
9. **Phase 9** (Effect Logic) - Wire up new effects
10. **Phase 10** (Integration Testing) - Verify everything works together
11. **Phase 11** (Polish & Release) - Final touches and ship it
