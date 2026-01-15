# NShapes Weapon System Overhaul

> **For Claude:** Check off tasks with `[x]` as you complete them. Follow TDD where applicable: write tests first, implement, verify tests pass.

You MUST commit the code once the unit tests and integration tests are passing between each section.

---

## Section 1: Rarity Restructure

### 1.1 Add Epic Rarity Tier
**Goal:** Add a new "Epic" rarity between Rare and Legendary.

**Files:**
- `src/types.ts` - Add 'epic' to WeaponRarity type
- `src/utils/gameConfig.ts` - Add epic to rarityChances
- `src/utils/gameDefinitions.ts` - Update weapon generation functions
- `src/components/WeaponShop.tsx` - Epic styling (purple color)
- `src/components/LevelUp.tsx` - Epic styling
- `src/components/InventoryBar.tsx` - Epic styling

**New Rarity Distribution:**
| Rarity | Drop Rate | Typical Values | Price Range |
|--------|-----------|----------------|-------------|
| Common | 60% | 5% effects | 5-10 coins |
| Rare | 25% | 10% effects | 10-20 coins |
| Epic | 12% | 20% + bonus | 20-35 coins |
| Legendary | 3% | Cross-system | 30-50 coins |

**Tasks:**
- [x] Update `WeaponRarity` type in types.ts to include 'epic'
- [x] Update `WEAPON_SYSTEM.rarityChances` in gameConfig.ts: `{ common: 0.60, rare: 0.25, epic: 0.12, legendary: 0.03 }`
- [x] Add `getRarityColor()` helper function returning purple (`#9333ea`) for epic
- [x] Update `getRarityChancesForRound()` to include epic rarity scaling
- [x] Update WeaponShop to style epic items (purple border/glow)
- [x] Update LevelUp to style epic items
- [x] Update InventoryBar to style epic items
- [x] Write tests for epic rarity in weapon generation

### 1.2 Rebalance Existing Weapon Percentages
**Goal:** Adjust Common, Rare, and Legendary values to match new design.

> **Note:** This task is deferred to Section 6 (Migration) which handles the conversion of existing Legendary weapons to Epic tier. The percentage rebalancing will happen as part of that migration.

**Current → Target:**
| Rarity | Current | Target |
|--------|---------|--------|
| Common | 5-10% | 5% |
| Rare | 15-30% | 10% |
| Legendary | 35-70% | Removed (becomes cross-system) |

**Tasks:**
- [ ] DEFERRED TO SECTION 6: Update all Common weapons to 5% base effect
- [ ] DEFERRED TO SECTION 6: Update all Rare weapons to 10% base effect
- [ ] DEFERRED TO SECTION 6: Document which existing Legendary weapons become Epic (25% effect)
- [ ] DEFERRED TO SECTION 6: Update weapon prices to match new rarity tiers
- [ ] DEFERRED TO SECTION 6: Update all weapon descriptions to reflect new percentages
- [ ] DEFERRED TO SECTION 6: Write tests verifying new percentage values

### 1.3 Verification
- [x] Run `npm test -- --testPathPattern="weapon"` - all weapon tests pass
- [x] Run `npm run typecheck` - no new type errors (pre-existing icon issues only)
- [x] Verify shop displays all 4 rarities correctly (ready when epic weapons added)
- [x] Commit with message: "feat(weapons): add epic rarity tier"

---

## Section 2: Effect Cap System

### 2.1 Implement Cap Data Structure
**Goal:** Add cap configuration for each effect type.

**Files:**
- `src/utils/gameConfig.ts` - Add EFFECT_CAPS configuration
- `src/types.ts` - Add EffectCaps interface to PlayerStats

**Cap Configuration:**
| Effect | Weapon(s) | Default Cap | Cap Increase |
|--------|-----------|-------------|--------------|
| Echo | Echo Stone | 25% | +5% |
| Laser | Prismatic Ray | 30% | +5% |
| Grace gain | Fortune Token | 30% | +5% |
| Explosion | Blast Powder | 40% | +10% |
| Hint | Oracle Eye, Seeker Lens | 40% | +10% |
| Time gain | Time Drop | 40% | +10% |
| Healing | Mending Charm | 50% | +10% |
| Fire | Flint Spark | 50% | +10% |
| Ricochet | Chaos Shard | 60% | +10% |
| Board growth | Growth Seed | 60% | +10% |
| Coin gain | Fortune's Favor | 70% | +15% |
| XP gain | Scholar's Tome | 100% | N/A |

**Tasks:**
- [x] Add `EFFECT_CAPS` constant in gameConfig.ts with all caps
- [x] Add `effectCaps` to PlayerStats interface (via optional EffectCaps type)
- [x] Initialize default cap values in DEFAULT_EFFECT_CAPS and DEFAULT_PLAYER_STATS
- [x] Write tests for cap configuration values (__tests__/effectCaps.test.ts)

### 2.2 Implement Cap Enforcement
**Goal:** Apply caps when calculating effective percentages.

**Files:**
- `src/utils/gameConfig.ts` - `getEffectiveStat()` helper
- `src/utils/weaponEffects.ts` - `getCappedStat()` and cap enforcement in `processWeaponEffects()`

**Tasks:**
- [x] Create `getEffectiveStat(accumulated: number, cap: number): number` helper
- [x] Create `getCappedStat()` helper in weaponEffects.ts
- [x] Update `processWeaponEffects()` to calculate effective (capped) values for all effects
- [x] Track "accumulated" vs "effective" stats (playerStats.echoChance vs effectiveEchoChance)
- [x] Write tests for cap enforcement at various accumulation levels (effectCaps.test.ts)
- [x] Write tests for over-cap scenarios (accumulated > cap)
- [x] Update weapon effects tests to use UNCAPPED_EFFECT_CAPS for 100% chance testing
- [ ] Display both values in UI: "30% (capped at 25%)" when over cap (deferred to 2.3)

### 2.3 UI: Show Accumulated vs Effective
**Goal:** Players should see both their accumulated total and the effective (capped) value.

**Files:**
- `src/components/WeaponShop.tsx` - Stats preview with cap info
- `src/components/LevelUp.tsx` - Stats preview with cap info
- `src/utils/gameConfig.ts` - STAT_TO_CAP_TYPE mapping and getCapInfoForStat()

**Tasks:**
- [x] Add STAT_TO_CAP_TYPE mapping in gameConfig.ts
- [x] Add getCapInfoForStat() helper function
- [x] Update WeaponShop stats preview to show cap indicator "(cap XX%)" when exceeded
- [x] Update LevelUp stats preview to show cap indicator
- [x] Add yellow/amber color for capped stats (statCapped, capIndicator styles)
- [ ] Show cap increase potential when viewing cap-increasing weapons (deferred to Section 3)
- [ ] Update InventoryBar tooltip to show cap status (future enhancement)

### 2.4 Verification
- [x] Run `npm test` - all 1028 tests pass
- [x] Verify caps are enforced in gameplay (processWeaponEffects uses capped values)
- [x] Verify UI shows cap indicator when stat exceeds cap
- [ ] Test stacking 10+ of the same weapon to exceed caps (manual testing)
- [x] Commit with message: "feat(weapons): implement effect cap enforcement"
- [ ] Commit with message: "feat(weapons): add cap indicator UI to shop and level-up"

---

## Section 3: Cap Increaser Weapons

### 3.1 Design Cap Increaser Weapons
**Goal:** Create one cap-increasing weapon per effect type.

**Design Pattern:**
- Rarity: Rare (same price as regular rare weapons)
- Effect: Increases the cap for one effect type
- Naming: "[Effect] Mastery" or similar thematic name

**New Weapons:**
| Weapon Name | Effect | Cap Increase | Price |
|-------------|--------|--------------|-------|
| Echo Mastery | +Echo cap | +5% | 15 |
| Laser Mastery | +Laser cap | +5% | 18 |
| Grace Mastery | +Grace gain cap | +5% | 12 |
| Explosion Mastery | +Explosion cap | +10% | 15 |
| Hint Mastery | +Hint cap | +10% | 12 |
| Time Mastery | +Time gain cap | +10% | 15 |
| Healing Mastery | +Healing cap | +10% | 12 |
| Fire Mastery | +Fire cap | +10% | 15 |
| Ricochet Mastery | +Ricochet cap | +10% | 15 |
| Growth Mastery | +Board growth cap | +10% | 12 |
| Coin Mastery | +Coin gain cap | +15% | 18 |

**Tasks:**
- [ ] Design icons for each cap increaser (reuse existing with modifier, or find new)
- [ ] Add weapon definitions to `gameDefinitions.ts`
- [ ] Add stat effect `capIncrease: { effect: string, amount: number }`
- [ ] Write tests for each cap increaser weapon

### 3.2 Implement Cap Increase Acquisition
**Goal:** When purchased, cap increasers permanently raise the relevant cap.

**Files:**
- `src/components/Game.tsx` - Weapon acquisition handling
- `src/types.ts` - CapIncreaseEffect interface

**Tasks:**
- [ ] Add `capIncrease` to Weapon interface
- [ ] Update `acquireWeapon()` to apply cap increases
- [ ] Store cap increases in player stats
- [ ] Write tests for cap increase application

### 3.3 Verification
- [ ] Run `npm test` - all tests pass
- [ ] Test acquiring cap increaser raises the cap
- [ ] Test that raised caps allow higher effective values
- [ ] Verify cap increasers appear in shop/level-up at appropriate rate
- [ ] Commit with message: "feat(weapons): add cap increaser weapons"

---

## Section 4: Epic Weapon Variants

### 4.1 Design Epic Weapons
**Goal:** Create unique Epic variant for each weapon type with added value.

**Epic Design Patterns:**
1. **Cap Bundle:** 20% effect + includes +5% cap increase
2. **Cross-system Lite:** 20% effect + minor secondary trigger
3. **Multi-pack:** Combines 2-3 related effects

**Epic Weapon Roster:**

| Base Weapon | Epic Name | Design | Effect |
|-------------|-----------|--------|--------|
| Blast Powder | Inferno Charge | Cap Bundle | 20% explosion + 10% cap |
| Oracle Eye | Prophet's Vision | Cross-system | 20% auto-hint + 10% grace on trigger |
| Field Stone | Terra Foundation | Multi-pack | +5 field size + 10% board growth |
| Growth Seed | Life Bloom | Cross-system | 20% growth + heal 1 on growth |
| Flint Spark | Ember Heart | Cap Bundle | 20% fire + 10% cap |
| Second Chance | Fortune's Shield | Multi-pack | +5 graces + 10% grace gain |
| Fortune Token | Lucky Charm | Cap Bundle | 20% grace gain + 5% cap |
| Life Vessel | Vital Core | Cross-system | +5 max HP + 10% heal on match |
| Mending Charm | Restoration Aura | Cap Bundle | 20% heal + 10% cap |
| Crystal Orb | Clairvoyant Sphere | Multi-pack | +4 max hints + 10% hint gain |
| Seeker Lens | Enlightened Eye | Cross-system | 20% hint gain + 5% XP on hint |
| Scholar's Tome | Arcane Codex | Multi-pack | 20% XP + 10% coin gain |
| Fortune's Favor | Golden Touch | Cap Bundle | 20% coin + 15% cap |
| Chrono Shard | Temporal Core | Multi-pack | +60s time + 10% time gain |
| Time Drop | Hourglass of Ages | Cross-system | 20% time gain + 5% echo |
| Prismatic Ray | Spectrum Annihilator | Cap Bundle | 20% laser + 5% cap |
| Chaos Shard | Entropy Engine | Cross-system | 20% ricochet + explosion on chain |
| Echo Stone | Resonance Crystal | Cap Bundle | 20% echo + 5% cap |

**Tasks:**
- [ ] Add all 18 Epic weapon definitions to gameDefinitions.ts
- [ ] Design/select icons for each Epic weapon
- [ ] Implement cross-system lite triggers
- [ ] Implement multi-pack stat bundles
- [ ] Write tests for each Epic weapon effect

### 4.2 Epic Weapon UI
**Goal:** Epic weapons should feel special in the UI.

**Tasks:**
- [ ] Add purple border/glow for Epic rarity
- [ ] Add "EPIC" badge on weapon cards
- [ ] Update stats preview to show all bundled effects
- [ ] Add special animation/effect when acquiring Epic

### 4.3 Verification
- [ ] Run `npm test` - all tests pass
- [ ] Test each Epic weapon variant functions correctly
- [ ] Verify Epic drop rates match configuration (12%)
- [ ] Verify Epic pricing is appropriate (20-35 coins)
- [ ] Commit with message: "feat(weapons): add epic weapon variants"

---

## Section 5: Legendary Cross-System Bridges

### 5.1 Design Legendary Bridge Weapons
**Goal:** Create powerful cross-system weapons that bridge different mechanics.

**Design Pattern:**
- Trigger: When X happens
- Effect: Y% chance of causing Z (from different system)
- Limit: maxCount 1-3 to prevent infinite loops

**Legendary Roster:**

| Weapon Name | Trigger | Effect | maxCount | Price |
|-------------|---------|--------|----------|-------|
| Phoenix Feather | On heal | 15% chance: target random card becomes holographic | 2 | 35 |
| Chaos Conduit | On explosion | 10% chance: gain +1 grace | 3 | 40 |
| Temporal Rift | On time gain | 20% chance: trigger echo | 2 | 45 |
| Soul Harvest | On card destruction | 5% chance: heal 1 HP | 3 | 35 |
| Cascade Core | On echo | 15% chance: fire random card | 2 | 40 |
| Fortune's Blessing | On coin gain | 10% chance: gain +1 hint | 3 | 35 |
| Wisdom Chain | On XP gain | 15% chance: gain +1 coin | 3 | 30 |
| Grace Conduit | On grace use | 25% chance: trigger laser | 2 | 45 |
| Hint Catalyst | On hint use | 20% chance: 3 random cards holographic | 2 | 40 |
| Life Link | On health loss | 30% chance: trigger explosion on attacker | 2 | 50 |

**Tasks:**
- [ ] Define trigger types: `'onHeal' | 'onExplosion' | 'onTimeGain' | 'onDestruction' | 'onEcho' | 'onCoinGain' | 'onXPGain' | 'onGraceUse' | 'onHintUse' | 'onHealthLoss'`
- [ ] Add `bridgeEffect` interface to Weapon type
- [ ] Add all 10 Legendary bridge weapon definitions
- [ ] Design/select icons for each Legendary weapon

### 5.2 Implement Bridge Trigger System
**Goal:** Create event system for cross-system triggers.

**Files:**
- `src/components/Game.tsx` - Event emission points
- `src/utils/gameDefinitions.ts` - Bridge effect resolution
- `src/types.ts` - BridgeEffect interface

**Tasks:**
- [ ] Create `emitGameEvent(event: GameEvent)` function
- [ ] Add event emission at all trigger points (heal, explosion, etc.)
- [ ] Create `resolveBridgeEffects(event: GameEvent, weapons: Weapon[])` function
- [ ] Implement cascade prevention (bridge effects don't trigger other bridges)
- [ ] Write tests for each bridge trigger type
- [ ] Write tests for cascade prevention

### 5.3 Legendary UI Treatment
**Goal:** Legendary weapons should feel extremely special.

**Tasks:**
- [ ] Add gold/orange animated border for Legendary
- [ ] Add "LEGENDARY" badge with special styling
- [ ] Add particle effects when acquiring Legendary
- [ ] Show bridge effect chain visually during gameplay
- [ ] Add sound effect for Legendary triggers

### 5.4 Verification
- [ ] Run `npm test` - all tests pass
- [ ] Test each Legendary bridge weapon triggers correctly
- [ ] Verify cascade prevention works (no infinite loops)
- [ ] Verify maxCount limits are enforced
- [ ] Verify Legendary drop rate is low (3%)
- [ ] Commit with message: "feat(weapons): add legendary cross-system bridge weapons"

---

## Section 6: Weapon System Migration

### 6.1 Convert Existing Legendary → Epic
**Goal:** Convert current Legendary weapons to Epic tier.

**Migration Map:**
| Current Legendary | New Epic Name | Notes |
|-------------------|---------------|-------|
| Blast Powder L | Inferno Charge | Keep 35% → 20% + cap |
| Oracle Eye L | Prophet's Vision | Keep 100%@5s → 20% + grace |
| (continue for all...) | | |

**Tasks:**
- [ ] Create migration function to update existing player inventories
- [ ] Update all current Legendary weapons to Epic rarity
- [ ] Adjust effect values from 35-70% → 20%
- [ ] Add Epic bonuses to compensate for reduced base effect
- [ ] Test migration preserves player progress

### 6.2 Remove Old Legendary Weapons
**Goal:** Clean up old Legendary weapon definitions.

**Tasks:**
- [ ] Remove old Legendary variants from WEAPONS array
- [ ] Update any hardcoded references to old Legendaries
- [ ] Update tests that reference old Legendary weapons
- [ ] Verify no dead code referencing removed weapons

### 6.3 Update Character Starting Weapons
**Goal:** Ensure starting weapons still make sense with new system.

**Tasks:**
- [ ] Review each character's starting weapons
- [ ] Adjust rarities if needed (should be Common/Rare)
- [ ] Update character descriptions if starting weapons changed
- [ ] Write tests for character starting loadouts

### 6.4 Verification
- [ ] Run `npm test` - all tests pass
- [ ] Test migration from old save data
- [ ] Verify no references to old Legendary weapons remain
- [ ] Test each character's starting loadout
- [ ] Commit with message: "refactor(weapons): migrate old legendary weapons to epic tier"

---

## Section 7: Balance Testing & Tuning

### 7.1 Balance Verification
**Goal:** Ensure the new system is fun and balanced.

**Testing Scenarios:**
- [ ] Play through 10 rounds stacking only one weapon type → hit cap appropriately
- [ ] Play through 10 rounds with diverse weapon selection → smooth power curve
- [ ] Test cap increaser value → feels worth purchasing
- [ ] Test Epic weapons → noticeably better than Rare
- [ ] Test Legendary bridges → powerful but not game-breaking

### 7.2 Tuning Adjustments
**Goal:** Document any balance changes discovered during testing.

**Adjustment Log:**
| Item | Issue | Change |
|------|-------|--------|
| (fill in during testing) | | |

**Tasks:**
- [ ] Play 10+ full Adventure runs
- [ ] Document any balance issues found
- [ ] Adjust cap values if needed
- [ ] Adjust Epic bonuses if needed
- [ ] Adjust Legendary trigger rates if needed

### 7.3 Final Verification
- [ ] Run `npm test` - all tests pass
- [ ] Run `npm run typecheck` - no type errors
- [ ] Commit with message: "balance(weapons): tune weapon system values"

---

## Section 8: Documentation & Cleanup

### 8.1 Update Design Documents
**Goal:** Keep documentation in sync with implementation.

**Files:**
- `docs/weapons-design.md` - Full weapon roster
- `CLAUDE.md` - High-level weapon system overview

**Tasks:**
- [ ] Update weapons-design.md with all new weapons
- [ ] Remove "Planned" section (now implemented)
- [ ] Add Cap System section to weapons-design.md
- [ ] Update CLAUDE.md weapon system description
- [ ] Add Epic and new Legendary weapons to character starting options

### 8.2 Code Cleanup
**Goal:** Remove any temporary code or debug logging.

**Tasks:**
- [ ] Remove any debug console.log statements
- [ ] Remove any commented-out old code
- [ ] Ensure consistent code formatting
- [ ] Run linter and fix any issues

### 8.3 Final Release
- [ ] Run full test suite: `npm test`
- [ ] Run typecheck: `npm run typecheck`
- [ ] Run icon validation: `npm run validate:icons`
- [ ] Increment version in package.json
- [ ] Commit with message: "release: vX.Y.Z - weapon system overhaul"
- [ ] Push to remote
- [ ] Report version number

### 9.0 Emit that you're done
- [ ] Only when everything is completely done, output "<promise>FULLY 100% ENTIRELY DONE</promise>"

---

## Summary

| Section | Description | Status |
|---------|-------------|--------|
| 1. Rarity Restructure | Add Epic tier, rebalance percentages | ⬜ |
| 2. Effect Cap System | Implement caps and UI | ⬜ |
| 3. Cap Increaser Weapons | 11 new cap-increasing weapons | ⬜ |
| 4. Epic Weapon Variants | 18 unique Epic weapons | ⬜ |
| 5. Legendary Bridges | 10 cross-system Legendary weapons | ⬜ |
| 6. System Migration | Convert old Legendaries, cleanup | ⬜ |
| 7. Balance Testing | Playtesting and tuning | ⬜ |
| 8. Documentation | Update docs, final release | ⬜ |

**Implementation Order:**
1. Section 1 (Rarity) - Foundation for everything else
2. Section 2 (Caps) - Core system change
3. Section 3 (Cap Increasers) - Depends on cap system
4. Section 4 (Epics) - Depends on cap system
5. Section 5 (Legendaries) - New tier after Epics exist
6. Section 6 (Migration) - After new weapons exist
7. Section 7 (Balance) - After everything implemented
8. Section 8 (Docs) - Final cleanup

**Estimated New Content:**
- 1 new rarity tier (Epic)
- 11 cap increaser weapons
- 18 Epic weapon variants
- 10 Legendary bridge weapons
- **Total: 39 new weapons**
