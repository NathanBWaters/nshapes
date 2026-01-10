# NShapes Weapon System Design

This document details the complete weapon system, including all weapon types, rarities, effects, and design philosophy.

## Design Philosophy

### Core Principles

1. **Weapons are the primary progression mechanic** - Characters start with 2 weapons and collect more throughout the run
2. **Effects should synergize** - Weapons work together (e.g., Echo Stone triggers explosion effects again)
3. **Higher rarity = bigger numbers, not different effects** - Common/Rare/Legendary versions of the same weapon do the same thing at different magnitudes
4. **Independent rolls for destructive effects** - Multiple copies of the same weapon roll separately (see Laser Mechanic below)
5. **No weapon limits (except unique)** - Players can stack as many of the same weapon as they want, unless marked `maxCount: 1`

### Rarity System

| Rarity | Drop Rate | Typical Values | Price Range |
|--------|-----------|----------------|-------------|
| **Common** | 70% | 5-10% effects | 5-10 coins |
| **Rare** | 25% | 15-30% effects | 10-20 coins |
| **Legendary** | 5% | 35-70%+ effects | 15-30 coins |

### Effect Stacking

All weapon effects stack additively:
- 3x Common Blast Powder (10% each) = 30% explosion chance per adjacent card
- 2x Rare Mending Charm (15% each) = 30% healing chance per match

**Over 100% Effects:** When stacked chances exceed 100%, the effect is guaranteed with a chance for additional triggers.
- 120% healing chance = guaranteed heal + 20% chance for second heal

---

## Complete Weapon Roster

### 1. Blast Powder - Explosive Destruction

**Effect:** After matching, each adjacent card (up/down/left/right) has a chance to explode.
**On Explosion:** Card destroyed, awards +1 point and +1 coin.

| Rarity | Explosion Chance | Price |
|--------|------------------|-------|
| Common | 10% | 8 |
| Rare | 30% | 16 |
| Legendary | 70% | 24 |

**Icon:** `lorc/bright-explosion`

---

### 2. Oracle Eye - Auto-Hint System

**Effect:** After X seconds without a match, has a chance to highlight 1 card from a valid set.
**Interval:** Checks every few seconds after last match.

| Rarity | Hint Chance | Interval | Price |
|--------|-------------|----------|-------|
| Common | 15% | 15s | 6 |
| Rare | 45% | 10s | 12 |
| Legendary | 100% | 5s | 18 |

**Icon:** `lorc/sheikah-eye`

**Design Note:** Oracle Eye helps prevent stuck situations while still requiring player skill to find the other 2 cards.

---

### 3. Mystic Sight - Enhanced Auto-Hint (Legendary Only)

**Effect:** When auto-hint triggers, 33% chance to reveal 2 cards instead of 1.
**Limit:** `maxCount: 1` (unique - only one can be owned)

| Rarity | Enhanced Chance | Price |
|--------|-----------------|-------|
| Legendary | 33% | 25 |

**Icon:** `lorc/third-eye`

**Design Note:** Makes auto-hints much more valuable. Limited to 1 to prevent trivializing the game.

---

### 4. Field Stone - Starting Board Size

**Effect:** Increases the number of cards on the board at round start.
**Benefit:** More cards = more possible matches to find.

| Rarity | Field Size Bonus | Price |
|--------|------------------|-------|
| Common | +1 | 7 |
| Rare | +3 | 14 |
| Legendary | +7 | 21 |

**Icon:** `lorc/field`

**Design Note:** Interacts with minimum board size requirements (see gameConfig.ts). The actual board size is max(attribute minimum, fieldSize stat).

---

### 5. Growth Seed - Dynamic Board Expansion

**Effect:** After matching, has a chance to add new cards to the board.
**Growth Amount:** 1 card (2 for legendary)

| Rarity | Growth Chance | Amount | Price |
|--------|---------------|--------|-------|
| Common | 5% | 1 | 6 |
| Rare | 15% | 1 | 12 |
| Legendary | 35% | 2 | 18 |

**Icon:** `delapouite/card-exchange`

**Board Cap:** Growth respects `maxBoardSize: 21` from gameConfig.

---

### 6. Flint Spark - Fire Starter

**Effect:** After matching, adjacent cards may catch fire.
**Fire Behavior:**
- Burns for 7.5 seconds (`fireBurnDuration: 7500`)
- Destroyed cards award points
- 10% chance to spread to neighbors when burning out (`fireSpreadOnDeathChance: 0.10`)

| Rarity | Ignition Chance | Price |
|--------|-----------------|-------|
| Common | 10% | 8 |
| Rare | 30% | 16 |
| Legendary | 70% | 24 |

**Icon:** `lorc/campfire`

**Design Note:** Fire is a delayed destruction effect - gives players time to match burning cards before they auto-destroy.

---

### 7. Second Chance - Starting Graces

**Effect:** Start each round with additional graces.
**Grace Mechanic:** Graces protect from near-miss invalid matches (only 1 attribute wrong). Consumed instead of losing health.

| Rarity | Starting Graces | Price |
|--------|-----------------|-------|
| Common | +1 | 5 |
| Rare | +3 | 10 |
| Legendary | +7 | 15 |

**Icon:** `lorc/clover`

**Cap:** Graces capped at `maxGraces: 5` by default.

---

### 8. Fortune Token - Grace Gain on Match

**Effect:** After a valid match, has a chance to gain +1 grace.

| Rarity | Gain Chance | Price |
|--------|-------------|-------|
| Common | 5% | 6 |
| Rare | 15% | 12 |
| Legendary | 35% | 18 |

**Icon:** `lorc/cycle`

---

### 9. Life Vessel - Max Health

**Effect:** Increases maximum health pool.

| Rarity | Max Health Bonus | Price |
|--------|------------------|-------|
| Common | +1 | 6 |
| Rare | +3 | 12 |
| Legendary | +7 | 18 |

**Icon:** `lorc/heart-inside`

**Design Note:** Synergizes with Mending Charm to allow healing above base max.

---

### 10. Mending Charm - Heal on Match

**Effect:** After a valid match, has a chance to restore 1 health.
**Cap:** Cannot heal above maximum health.

| Rarity | Heal Chance | Price |
|--------|-------------|-------|
| Common | 5% | 5 |
| Rare | 15% | 10 |
| Legendary | 35% | 15 |

**Icon:** `lorc/shining-heart`

---

### 11. Crystal Orb - Max Hint Capacity

**Effect:** Increases maximum hints the player can hold.

| Rarity | Max Hints Bonus | Price |
|--------|-----------------|-------|
| Common | +1 | 5 |
| Rare | +2 | 10 |
| Legendary | +3 | 15 |

**Icon:** `lorc/floating-crystal`

**Default Max:** 3 hints (`maxHints: 3` in gameConfig)

---

### 12. Seeker Lens - Hint Gain on Match

**Effect:** After a valid match, has a chance to gain +1 hint.

| Rarity | Gain Chance | Price |
|--------|-------------|-------|
| Common | 5% | 6 |
| Rare | 15% | 12 |
| Legendary | 35% | 18 |

**Icon:** `lorc/light-bulb`

**Synergy:** Works best with Crystal Orb to hold more hints.

---

### 13. Scholar's Tome - XP Gain on Match

**Effect:** After a valid match, has a chance to gain +1 XP.

| Rarity | XP Chance | Price |
|--------|-----------|-------|
| Common | 20% | 8 |
| Rare | 40% | 16 |
| Legendary | 80% | 24 |

**Icon:** `lorc/open-book`

**Over 100%:** Multiple tomes stacking over 100% guarantees XP with chance for more.

---

### 14. Fortune's Favor - Coin Gain on Match

**Effect:** After a valid match, has a chance to gain +1 coin.

| Rarity | Coin Chance | Price |
|--------|-------------|-------|
| Common | 20% | 8 |
| Rare | 40% | 16 |
| Legendary | 80% | 24 |

**Icon:** `lorc/crown-coin`

---

### 15. Chrono Shard - Starting Time Bonus

**Effect:** Start rounds with additional time. Also raises the time cap.
**Time Cap:** Time gained during matches (via Time Drop) cannot exceed starting time.

| Rarity | Starting Time | Price |
|--------|---------------|-------|
| Common | +15s | 7 |
| Rare | +45s | 14 |
| Legendary | +105s | 21 |

**Icon:** `lorc/hourglass`

**Design Note:** Critical synergy with Time Drop - without Chrono Shards, Time Drops are capped at 60s base time.

---

### 16. Time Drop - Time Gain on Match

**Effect:** After a valid match, has a chance to gain time.
**Time Cap:** Cannot exceed starting time (60s base + Chrono Shard bonuses).

| Rarity | Time Chance | Time Amount | Price |
|--------|-------------|-------------|-------|
| Common | 5% | +10s | 6 |
| Rare | 15% | +10s | 12 |
| Legendary | 35% | +15s | 18 |

**Icon:** `lorc/stopwatch`

**Independent Rolls:** Each Time Drop weapon rolls separately.

---

### 17. Prismatic Ray - Laser Destruction

**Effect:** After matching, has a chance to destroy an entire row OR column (randomly chosen).
**Independent Rolls:** Each laser weapon rolls separately per match.
**Reward:** Destroyed cards award +2 points each.

| Rarity | Laser Chance | Price |
|--------|--------------|-------|
| Common | 3% | 10 |
| Rare | 9% | 20 |
| Legendary | 21% | 30 |

**Icon:** `lorc/laser-warning`

**Multi-Laser Behavior:**
- 3 laser weapons at 3% each = 3 independent rolls
- Could get 0, 1, 2, or 3 lasers firing
- Each laser independently chooses row OR column
- Multiple lasers can overlap (wasted) or differ (massive destruction)
- UI shows "2x Laser!" or "3x Laser!" on multi-trigger

---

### 18. Chaos Shard - Ricochet Chain Destruction

**Effect:** After matching, has a chance to destroy a random card anywhere on the board.
**Chain:** Each destroyed card may chain to another random target.

| Rarity | Initial Chance | Chain Chance | Price |
|--------|----------------|--------------|-------|
| Common | 10% | 5% | 8 |
| Rare | 30% | 15% | 16 |
| Legendary | 70% | 35% | 24 |

**Icon:** `lorc/chained-arrow-heads`

**Design Note:** With lucky rolls, chains can theoretically continue indefinitely.

---

### 19. Echo Stone - Auto-Match Another Set

**Effect:** After matching, has a chance to automatically find and match another valid set on the board.
**Triggers Effects:** The echoed match triggers all on-match effects (explosions, healing, etc.)!

| Rarity | Echo Chance | Price |
|--------|-------------|-------|
| Common | 5% | 8 |
| Rare | 15% | 16 |
| Legendary | 35% | 24 |

**Icon:** `lorc/echo-ripples`

**Design Note:** One of the most synergistic weapons - doubles the trigger rate of all other on-match effects.

---

### 20. Chain Reaction - Double Echo (Legendary Only)

**Effect:** When Echo Stone triggers, 30% chance to match TWO additional sets instead of one.
**Limit:** `maxCount: 1` (unique - only one can be owned)

| Rarity | Double Echo Chance | Price |
|--------|-------------------|-------|
| Legendary | 30% | 25 |

**Icon:** `lorc/lightning-branches`

**Design Note:** Creates massive chain reactions with other on-match effects. Limited to 1 to prevent exponential cascades.

---

## Weapon Statistics Summary

| # | Weapon | Effect Type | Rarities | Stacking |
|---|--------|-------------|----------|----------|
| 1 | Blast Powder | % per adjacent | 3 | Additive |
| 2 | Oracle Eye | % to trigger | 3 | Additive |
| 3 | Mystic Sight | % enhancement | 1 (L) | maxCount: 1 |
| 4 | Field Stone | Flat bonus | 3 | Additive |
| 5 | Growth Seed | % to trigger | 3 | Additive |
| 6 | Flint Spark | % per adjacent | 3 | Additive |
| 7 | Second Chance | Flat bonus | 3 | Additive |
| 8 | Fortune Token | % to trigger | 3 | Additive |
| 9 | Life Vessel | Flat bonus | 3 | Additive |
| 10 | Mending Charm | % to trigger | 3 | Additive |
| 11 | Crystal Orb | Flat bonus | 3 | Additive |
| 12 | Seeker Lens | % to trigger | 3 | Additive |
| 13 | Scholar's Tome | % to trigger | 3 | Additive |
| 14 | Fortune's Favor | % to trigger | 3 | Additive |
| 15 | Chrono Shard | Flat bonus | 3 | Additive |
| 16 | Time Drop | % to trigger | 3 | Independent |
| 17 | Prismatic Ray | % to trigger | 3 | Independent |
| 18 | Chaos Shard | % to trigger | 3 | Additive |
| 19 | Echo Stone | % to trigger | 3 | Additive |
| 20 | Chain Reaction | % enhancement | 1 (L) | maxCount: 1 |

**Total Weapons:** 18 types × 3 rarities + 2 legendary-only = 56 weapons

---

## Character Starting Weapons

Each character begins with 2 weapons that define their playstyle:

| Character | Starting Weapons | Playstyle |
|-----------|------------------|-----------|
| **Orange Tabby** | Life Vessel, Mending Charm | Survivability - more HP and healing |
| **Sly Fox** | Flint Spark, Blast Powder | Destruction - fire and explosions |
| **Corgi** | Field Stone, Growth Seed | Board Control - bigger, expanding board |
| **Emperor Penguin** | Crystal Orb, Seeker Lens | Hints - more hint capacity and generation |
| **Pelican** | Oracle Eye, Oracle Eye | Vision - double auto-hint chance |
| **Badger** | Second Chance, Fortune Token | Graces - starting graces + grace generation |

---

## Shop & Level Up System

### Shop Generation

- **Shop Size:** 4 weapons per refresh (`ECONOMY.shopSize`)
- **Reroll Cost:** 5 coins base, +2 per reroll (`baseRerollCost`, `rerollCostIncrement`)
- **Rarity Distribution:** 70% Common, 25% Rare, 5% Legendary
- **Max Count Filtering:** Weapons at `maxCount` limit are filtered from shop

### Level Up Rewards

- **Options Shown:** 4 weapons (`ECONOMY.levelUpOptionsCount`)
- **Cost:** FREE
- **Rarity Distribution:** Same as shop (70/25/5)

### Double-Tap Purchase

Shop supports double-tap to instantly purchase without confirmation dialog.

---

## Synergy Categories

### Destruction Synergies
- **Blast Powder + Echo Stone:** Echo triggers can cause additional explosions
- **Flint Spark + Prismatic Ray:** Laser can destroy burning cards for instant points
- **Chaos Shard + Echo Stone:** More matches = more ricochet opportunities

### Resource Generation
- **Scholar's Tome + Fortune's Favor:** Stack for massive XP/coin generation
- **Seeker Lens + Crystal Orb:** Generate hints and store more of them
- **Fortune Token + Second Chance:** Generate and store more graces

### Time Management
- **Chrono Shard + Time Drop:** Essential combo - Chrono raises cap, Drop refills it
- **Echo Stone + Time Drop:** More matches = more time gain chances

### Board Control
- **Field Stone + Growth Seed:** Start big, grow bigger
- **Oracle Eye + Mystic Sight:** Powerful hint reveals when stuck

---

## Configuration Reference

Key values from `gameConfig.ts`:

```typescript
STARTING_STATS = {
  hints: 0,
  maxHints: 3,
  health: 3,
  maxHealth: 3,
  graces: 0,
  maxGraces: 5,
  fieldSize: 12,
  autoHintInterval: 10000, // 10s default
  // All chance stats default to 0
}

WEAPON_SYSTEM = {
  rarityChances: { common: 0.70, rare: 0.25, legendary: 0.05 },
  fireBurnDuration: 7500,      // 7.5 seconds
  fireSpreadOnDeathChance: 0.10, // 10%
  autoHintDisplayDuration: 1500, // 1.5 seconds
}

BOARD = {
  maxBoardSize: 21,
}
```

---

## Future Considerations

### Potential New Weapon Types
- **Shield effects** - Damage prevention/reduction
- **Multiplier weapons** - Points multiplier on certain conditions
- **Transformation weapons** - Change card attributes
- **Combo weapons** - Bonus for consecutive matches

### Balance Levers
- Adjust rarity drop rates
- Tune individual weapon chance values
- Add/remove unique limits (`maxCount`)
- Modify price curves
- Adjust stacking behavior (additive vs diminishing)
