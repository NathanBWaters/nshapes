# Weapon & Passive Fusion System - Implementation Todo

Reference: [Design Document](./2026-02-14-weapon-passive-fusion-design.md)

---

## Phase 1: Data Model Updates

### 1.1 Update Weapon Type
- [ ] Add `type: 'weapon' | 'passive'` field to Weapon interface
- [ ] Add `fusionTier?: 0 | 1 | 2` field (0 = base, 1 = Tier 1, 2 = Tier 2)
- [ ] Add `fusionParents?: [string, string]` field for tracking fusion inputs
- [ ] Change `effects` to level-based structure: `{ 1: Effects, 2: Effects, 3: Effects }`
- [ ] Add `limitation?: string` field for weapon limitations
- [ ] Remove `rarity` field from Weapon interface
- [ ] Remove `price` field from Weapon interface (no shop)
- [ ] Update `level` field type to `1 | 2 | 3`

### 1.2 Create Player Inventory Type
- [ ] Create `PlayerInventory` interface with `weapons: (Weapon | null)[]` (length 4)
- [ ] Add `passives: (Weapon | null)[]` (length 4) to PlayerInventory
- [ ] Update Player interface to use PlayerInventory instead of `weapons: Weapon[]`

### 1.3 Create Fusion System Types
- [ ] Create `FusionRecipe` interface with `inputs`, `output`, `tier`
- [ ] Create `FUSION_RECIPES` constant array with all 30 recipes (15 Tier 1 + 15 Tier 2)

### 1.4 Update Game State
- [ ] Add `fusionGemPending: boolean` to GameState
- [ ] Add `rerollCost: number` to GameState (starts at 5, resets per round)
- [ ] Add `timeGainTriggersThisRound: number` for round-scoped tracking
- [ ] Remove `effectCaps` from PlayerStats
- [ ] Remove cap-related fields from PlayerStats

### 1.5 Update WeaponName Type
- [ ] Add all Tier 1 fusion names to WeaponName union
- [ ] Add all Tier 2 fusion names to WeaponName union

---

## Phase 2: Define New Weapon/Passive Data

### 2.1 Define Base Weapons (6 total)
- [ ] Blast Powder - levels 1/2/3 with limitation
- [ ] Flint Spark - levels 1/2/3 with limitation
- [ ] Prismatic Ray - levels 1/2/3 with limitation
- [ ] Chaos Shard - levels 1/2/3 with limitation
- [ ] Echo Stone - levels 1/2/3 with limitation
- [ ] Link Stone - levels 1/2/3 with limitation

### 2.2 Define Base Passives (13 total)
- [ ] Oracle Eye - levels 1/2/3
- [ ] Field Stone - levels 1/2/3
- [ ] Growth Seed - levels 1/2/3
- [ ] Second Chance - levels 1/2/3
- [ ] Fortune Token - levels 1/2/3
- [ ] Life Vessel - levels 1/2/3
- [ ] Mending Charm - levels 1/2/3
- [ ] Crystal Orb - levels 1/2/3
- [ ] Seeker Lens - levels 1/2/3
- [ ] Scholar's Tome - levels 1/2/3
- [ ] Fortune's Favor - levels 1/2/3
- [ ] Chrono Shard - levels 1/2/3
- [ ] Time Drop - levels 1/2/3

### 2.3 Define Tier 1 Fusions (15 total)
- [ ] Infernal Charge (Blast + Fire)
- [ ] Detonation Beam (Blast + Laser)
- [ ] Shrapnel Storm (Blast + Ricochet)
- [ ] Resonant Blast (Blast + Echo)
- [ ] Chain Detonator (Blast + Link)
- [ ] Solar Flare (Fire + Laser)
- [ ] Wildfire Shard (Fire + Ricochet)
- [ ] Blazing Echo (Fire + Echo)
- [ ] Burning Bonds (Fire + Link)
- [ ] Prism Shatter (Laser + Ricochet)
- [ ] Mirror Beam (Laser + Echo)
- [ ] Linked Annihilation (Laser + Link)
- [ ] Cascade Chaos (Ricochet + Echo)
- [ ] Chaotic Web (Ricochet + Link)
- [ ] Resonant Link (Echo + Link)

### 2.4 Define Tier 2 Fusions (15 total)
- [ ] Supernova (Infernal Charge + Detonation Beam)
- [ ] Eternal Flame (Infernal Charge + Wildfire Shard)
- [ ] Extinction Ray (Detonation Beam + Solar Flare)
- [ ] Reality Fracture (Shrapnel Storm + Prism Shatter)
- [ ] Infinite Echo (Resonant Blast + Cascade Chaos)
- [ ] Doom Network (Chain Detonator + Chaotic Web)
- [ ] Prismatic Inferno (Solar Flare + Mirror Beam)
- [ ] Soul Pyre (Blazing Echo + Burning Bonds)
- [ ] Plague Fire (Wildfire Shard + Chaotic Web)
- [ ] Quantum Entanglement (Linked Annihilation + Resonant Link)
- [ ] Paradox Engine (Mirror Beam + Cascade Chaos)
- [ ] Grid Eraser (Prism Shatter + Linked Annihilation)
- [ ] Scorched Earth (Burning Bonds + Chain Detonator)
- [ ] Phoenix Storm (Resonant Blast + Blazing Echo)
- [ ] Armageddon (Shrapnel Storm + Chain Detonator)

### 2.5 Create Fusion Recipe Registry
- [ ] Define all 15 Tier 1 fusion recipes
- [ ] Define all 15 Tier 2 fusion recipes
- [ ] Create helper function `getFusionResult(weaponA, weaponB)`
- [ ] Create helper function `canFuse(weaponA, weaponB)`
- [ ] Create helper function `getEligibleFusions(playerWeapons)`

---

## Phase 3: Remove Old Content

### 3.1 Remove Mastery Weapons
- [ ] Remove Echo Mastery
- [ ] Remove Laser Mastery
- [ ] Remove Grace Mastery
- [ ] Remove Explosion Mastery
- [ ] Remove Hint Mastery
- [ ] Remove Time Mastery
- [ ] Remove Healing Mastery
- [ ] Remove Fire Mastery
- [ ] Remove Ricochet Mastery
- [ ] Remove Growth Mastery
- [ ] Remove Coin Mastery
- [ ] Remove Time Trigger Mastery

### 3.2 Remove Rarity Variants
- [ ] Remove all "rare" weapon variants
- [ ] Remove all "epic" weapon variants
- [ ] Remove standalone legendary variants (keep fusion legendaries)

### 3.3 Remove Bridge Weapons
- [ ] Remove Chaos Conduit
- [ ] Remove Temporal Rift
- [ ] Remove Soul Harvest
- [ ] Remove Cascade Core
- [ ] Remove Fortune's Blessing
- [ ] Remove Wisdom Chain
- [ ] Remove Grace Conduit
- [ ] Remove Life Link

### 3.4 Remove Challenge Legendaries
- [ ] Remove Prismatic Perfection
- [ ] Remove Tabula Rasa
- [ ] Remove Desperate Measures

### 3.5 Consolidate Connector Weapons
- [ ] Remove Link Chain (rare variant)
- [ ] Remove Soul Link (legendary variant)
- [ ] Remove Web Spinner
- [ ] Remove Web Master
- [ ] Remove Echo Chamber
- [ ] Remove Resonance Core
- [ ] Remove Sympathetic Flames
- [ ] Remove Neural Network
- [ ] Remove Revenge Linker

### 3.6 Remove Cap System
- [ ] Remove EffectCaps interface
- [ ] Remove effectCaps from PlayerStats
- [ ] Remove cap-related logic from calculatePlayerTotalStats
- [ ] Remove CapIncreaseType and CapIncreaseEffect types
- [ ] Remove capIncrease field from Weapon interface

### 3.7 Remove Bridge Effect System
- [ ] Remove BridgeTriggerType
- [ ] Remove BridgeEffectType
- [ ] Remove BridgeEffect interface
- [ ] Remove bridgeEffect field from Weapon
- [ ] Remove rollBridgeEffects function
- [ ] Remove getBridgeWeaponsForTrigger function
- [ ] Remove hasBridgeWeaponsForTrigger function

---

## Phase 4: Update Character Definitions

### 4.1 Update Starting Weapons
- [ ] Orange Tabby: Life Vessel (passive) + Mending Charm (passive)
- [ ] Sly Fox: Flint Spark (weapon) + Blast Powder (weapon)
- [ ] Emperor Penguin: Crystal Orb (passive) + Seeker Lens (passive)
- [ ] Corgi: Field Stone (passive) + Growth Seed (passive)
- [ ] Pelican: Oracle Eye (passive) + Oracle Eye (passive)
- [ ] Badger: Second Chance (passive) + Fortune Token (passive)

### 4.2 Update initializePlayer Function
- [ ] Initialize player with 4-slot weapons array
- [ ] Initialize player with 4-slot passives array
- [ ] Place starting items in correct arrays based on type

---

## Phase 5: Level Up System

### 5.1 Update Level Up Option Generation
- [ ] Create function to generate mixed pool options
- [ ] Include new weapons (if weapon slots < 4)
- [ ] Include new passives (if passive slots < 4)
- [ ] Include weapon upgrades (if any weapon < level 3)
- [ ] Include passive upgrades (if any passive < level 3)
- [ ] Apply contextual filtering based on slot availability

### 5.2 Update Level Up UI (LevelUp.tsx)
- [ ] Display mixed options (new items + upgrades)
- [ ] Show "NEW" badge for new items
- [ ] Show "Lv.X ↑" for upgrades with before/after stats
- [ ] Add reroll button with current cost display
- [ ] Disable reroll if can't afford
- [ ] Update reroll cost after each reroll (double)

### 5.3 Implement Upgrade Logic
- [ ] Create function to upgrade weapon/passive level
- [ ] Update effects when leveling up
- [ ] Cap at level 3

### 5.4 Reset Reroll Cost
- [ ] Reset rerollCost to 5 at start of each round

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

---

## Phase 8: Hide Shop

### 8.1 Remove Shop from Flow
- [ ] Remove shop phase from game flow
- [ ] Skip shop screen between rounds
- [ ] Keep shop component code intact (do not delete)

### 8.2 Update Navigation
- [ ] Remove shop button from relevant screens
- [ ] Update round transition to skip shop

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

---

## Phase 10: Testing

### 10.1 Unit Tests
- [ ] Test weapon/passive type classification
- [ ] Test level progression (1→2→3 effects)
- [ ] Test fusion recipe lookup
- [ ] Test canFuse helper
- [ ] Test getEligibleFusions helper
- [ ] Test slot limit enforcement

### 10.2 Integration Tests
- [ ] Test level up with mixed pool generation
- [ ] Test contextual filtering (4 weapons = no new weapons)
- [ ] Test reroll cost escalation
- [ ] Test reroll cost reset per round
- [ ] Test fusion gem modal flow
- [ ] Test fusion execution and slot freeing
- [ ] Test random level ups

### 10.3 Manual Testing
- [ ] Play through full game with new system
- [ ] Verify all 6 base weapons work correctly
- [ ] Verify all 13 base passives work correctly
- [ ] Test at least 5 Tier 1 fusions
- [ ] Test at least 2 Tier 2 fusions
- [ ] Verify UI displays correctly on all screen sizes

---

## Phase 11: Polish

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
10. **Phase 10** (Testing) - Verify everything works
11. **Phase 11** (Polish) - Final touches
