# NShapes

A roguelike deckbuilding match-three puzzle game for iOS, Android, and Web, built with Expo/React Native.

## Game Overview

NShapes combines the classic SET card matching game with roguelike progression mechanics. The game offers two modes: **Adventure Mode** (a 10-round campaign with expanding logic) and **Free Play** (a customizable practice mode).

### Core Mechanics

**Card Attributes:** Cards are defined by up to **5 attributes**, each with 3 possible values:

1. **Shape** (Diamond, Squiggle, Oval)
2. **Color** (Red, Green, Purple)
3. **Number** (1, 2, 3)
4. **Shading** (Solid, Striped, Open)
5. **Background Color** (High-contrast variants)

**The SET Rule:** A valid match requires 3 cards where **each active attribute** is either **all the same** OR **all different** across the three cards.

**Invalid Match Mechanic:** When a player selects 3 cards that do NOT form a valid SET:
* If player has graces AND exactly 1 attribute is wrong: Auto-use grace (saves 1 health)
* If 2+ attributes are wrong OR no graces: The player loses 1 health (heart)
* The 3 selected cards are **removed** from the board and replaced with new cards
* This creates a strategic "sacrifice" option—stuck players can spend health to cycle in new cards

**Grace System:** Graces are a "near-miss" protection. When only 1 attribute breaks the SET rule, a grace is consumed instead of losing health. If 2+ attributes are wrong, it's a full miss and health is lost regardless of graces.

### Game Modes

**Adventure Mode** - Progressive Roguelike Campaign:

* **Round-Based Complexity:** The number of attributes required for a "Set" increases as you progress:
* **Rounds 1–3:** 3 Attributes (Shape, Color, Number)
* **Rounds 4–9:** 4 Attributes (adds Shading)
* **Round 10 (Final Boss):** 5 Attributes (adds Background Color)

* 60-second timer per round to reach score targets.
* 16 unique characters and weapon-based progression.

**Free Play Mode** - Relaxed Practice:

* **Difficulty Selector:** Choose the number of active attributes before starting:
* **Easy:** 2 Attributes
* **Medium:** 3 Attributes
* **Hard:** 4 Attributes
* **Omega Brained:** 5 Attributes

* No timer, no score targets—continuous endless gameplay.

## Weapon System

The game features 15 weapon types, each available in 3 rarities (45 total weapons):

### Weapon Rarities
* **Common (70%):** Lower stats, prices 5-10 coins
* **Rare (25%):** Medium stats, prices 10-20 coins
* **Legendary (5%):** High stats, prices 15-30 coins

### Weapon Types

| Weapon | Effect | Special |
|--------|--------|---------|
| **Blast Powder** | Explodes adjacent cards on match | explosionChance |
| **Oracle Eye** | Auto-shows hints periodically | autoHintChance, interval |
| **Field Stone** | Increases starting board size | fieldSize |
| **Growth Seed** | Chance to expand board on match | boardGrowthChance |
| **Flint Spark** | Starts fires on adjacent cards | fireSpreadChance |
| **Second Chance** | Starting graces | graces |
| **Fortune Token** | Chance to gain grace on match | graceGainChance |
| **Life Vessel** | Increases max health | maxHealth |
| **Mending Charm** | Chance to heal on match | healingChance |
| **Crystal Orb** | Increases max hint capacity | maxHints |
| **Seeker Lens** | Chance to gain hint on match | hintGainChance |
| **Prism Glass** | Chance for holographic cards (2x pts) | holoChance |
| **Chrono Shard** | Starting time bonus | startingTime |
| **Time Drop** | Chance to gain time on match | timeGainChance |
| **Prismatic Ray** | Destroys entire row/column | laserChance |

### Weapon Effects

* **Stacking:** Multiple weapons of the same type stack their effects
* **Purchase:** Buy weapons in the shop between rounds
* **Level Up:** Choose from 3 weapon rewards on level up

### Hint System

* **Starting Hints:** Players start with 0 hints
* **Max Hints:** Default max capacity is 3 (increased by Crystal Orb weapons)
* **Earning Hints:** Gain hints from matches via Seeker Lens
* **Auto-Hint:** Oracle Eye triggers 15 seconds after the last match (not on a fixed interval)
* **Display:** Hints show as "X/max" in the UI (e.g., "2/3")

### Laser Mechanic (Independent Rolls)

Each laser weapon (Prismatic Ray) rolls **independently** on every match:
* If you have 3 laser weapons at 3% each, each one rolls separately
* You could get 0, 1, 2, or 3 lasers firing on a single match
* Each laser independently chooses horizontal OR vertical
* Multiple lasers can overlap (same row/column = wasted) or differ (row + column = massive destruction)
* The notification shows "2x Laser!" or "3x Laser!" when multiple fire
* This makes stacking lasers very powerful but RNG-dependent

### Card States

* **Holographic:** Animated rainbow shimmer effect (Balatro-style), awards 2x points when matched
* **On Fire:** Red pulsing border, burns after 7.5 seconds (destroys card, awards points, 10% spread)

## Key Features

* 16 playable characters (Orange Tabby, Sly Fox, Corgi, etc.)
* 45 weapons across 15 types and 3 rarities
* Card modifiers (bombs, spikes, healing, loot boxes, etc.)
* Grace auto-use system (prevents health loss on near-misses)
* Match trigger effects (healing, hints, time, graces)
* Explosive and laser destruction effects
* Fire spread and burn mechanics
* Auto-hint system (15s after last match)
* Optional multiplayer via Socket.io (not a priority - ignore multiplayer code)

### UI Features

* **Inventory Bar:** Horizontal scrollable bar at top of Shop and Level Up screens showing all collected weapons
* **Stats Preview:** Shop and Level Up show before→after stat comparison when viewing weapons
* **Double-Tap Purchase:** Double-tap a weapon in the shop to instantly purchase (no confirmation)
* **Free Indicator:** Level Up screen clearly shows rewards are free with "FREE" badge and banner
* **Menu Pause:** Timer pauses when the game menu is open

## Notes

* **Multiplayer is NOT a priority.** Do not worry about the multiplayer code or fixing multiplayer bugs. Focus on single-player gameplay.
* **Enemy selection is skipped.** The game goes directly from character selection to the round phase.
* **Shop shows only weapons.** Items have been replaced by the weapon system.
* **Level-up shows only weapons.** No stat upgrade options.

## Tech Stack

* **Expo 54** with Expo Router
* **React Native** for iOS, Android, and Web
* **TypeScript**
* **NativeWind/TailwindCSS** for styling
* **Socket.io** for multiplayer

## Project Structure

```
app/                        # Expo Router routes only
├── _layout.tsx             # Root navigation layout
├── index.tsx               # App entry point (home screen)
└── dev/
    └── test.tsx            # Dev test page (/dev/test) - weapon testing

src/                        # Shared code (imported via @/ alias)
├── components/
│   ├── Game.tsx            # Main controller (handles game phases, weapon effects)
│   ├── GameBoard.tsx       # Card display (auto-hint system)
│   ├── Card.tsx            # Renders shapes, fills, holographic shimmer, fire effects
│   ├── CharacterSelection.tsx
│   ├── WeaponShop.tsx      # Weapon purchase interface (double-tap, stats preview)
│   ├── LevelUp.tsx         # Weapon selection on level up (FREE indicator)
│   ├── InventoryBar.tsx    # Horizontal weapon inventory display
│   ├── AttributeUnlockScreen.tsx  # New attribute explanation screen
│   ├── VictoryScreen.tsx   # End-game celebration screen
│   └── RoundSummary.tsx
├── context/
│   └── SocketContext.tsx   # Multiplayer state management
├── types.ts                # Interfaces for Cards, Weapons, PlayerStats
└── utils/
    ├── gameDefinitions.ts  # Characters, weapons (WEAPONS array)
    ├── gameConfig.ts       # Game constants, default stats
    └── gameUtils.ts        # Modular SET validation for N-attributes

```

**Import Alias:** Use `@/` to import from `src/` (configured in `tsconfig.json`).

## Game Flow

**Adventure Mode:**

1. Character Selection → Choose Adventure.
2. **Attribute Unlock:** Game initializes with 3 attributes (Shape/Color/Number).
3. Play Round (reach score target within 60 seconds).
4. **Progression:** After Round 3 and 9:
   - Shows Attribute Unlock Screen explaining the new attribute (Shading or Background)
   - Displays example cards demonstrating the attribute values
   - Before Round 10: Shows Final Round warning screen
5. Level Up (choose weapon) / Weapon Shop between rounds.
6. Repeat for 10 rounds total.
7. After completing Round 10: Victory Screen showing final stats and weapons collected.

**Free Play Mode:**

1. Character Selection → Choose Free Play.
2. **Select Difficulty:** Toggle 2, 3, 4, or 5 attributes.
3. Play continuously; exit anytime.

## Game Board Layout

The layout adapts based on the number of active attributes to ensure a Set is mathematically likely to be on the board:

* **2–3 Attributes:** 3x3 or 3x4 grid (9–12 cards).
* **4–5 Attributes:** 3x5 or 3x6 grid (15–18 cards) to prevent "No-Set" deadlocks.

**Field Size:** The actual board size is the maximum of:
1. The minimum required for the attribute count (as above)
2. The player's `fieldSize` stat (base 12 + weapon bonuses from Field Stone)

This means Field Stone weapons can increase the starting board size beyond the minimum, giving players more cards to work with from the start of each round.

## Dev Testing

Access `/dev/test` to test weapon effects:
* Add legendary weapons by category
* Toggle holographic cards
* Set cards on fire
* Add graces
* View active weapon stats

When working on this codebase, also load these additional files for context:
-- [Style Guide](./style_guide.md) - UI design system including colors, typography, and component styles
