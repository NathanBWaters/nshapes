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

* **Difficulty Selection:** Choose difficulty on character selection screen:
  * **Easy:** 3 attributes for all 10 rounds
  * **Medium (default):** Progressive - 3 attrs (R1-3) → 4 attrs (R4-9) → 5 attrs (R10)
  * **Hard:** 4 attributes (R1-5) → 5 attributes (R6-10)

* 60-second timer per round to reach score targets.
* 6 playable characters (3 unlocked, 3 locked) with weapon-based progression.
* **Character Unlocking:** Beat Adventure Mode to unlock one character. Locked characters: Emperor Penguin, Pelican, Badger.

**Free Play Mode** - Relaxed Practice:

* **Difficulty Selector:** Choose the number of active attributes before starting:
* **Easy:** 2 Attributes
* **Medium:** 3 Attributes
* **Hard:** 4 Attributes
* **Omega Brained:** 5 Attributes

* No timer, no score targets—continuous endless gameplay.

## Weapon & Passive Fusion System

> **Full documentation:** [docs/plans/2026-02-14-weapon-passive-fusion-design.md](./docs/plans/2026-02-14-weapon-passive-fusion-design.md)

The game uses a fusion-based progression system with weapons and passives that level up and combine.

### Inventory Layout
* **4 Weapon Slots** - Active abilities that trigger on matches (explosions, lasers, fire, etc.)
* **4 Passive Slots** - Stat bonuses that apply continuously (health, hints, graces, etc.)

### Item Tiers
* **Base (Tier 0):** 6 weapons + 13 passives - Starting items with limitations
* **Tier 1 Fusions:** 15 combinations - Two base weapons fused, limitations partially lifted
* **Tier 2 Fusions:** 15 combinations - Two Tier 1 fusions combined, maximum power

### Level Progression
All items have 3 levels with scaling effects:
* **Level 1:** Base effect (e.g., 10% explosion chance)
* **Level 2:** Enhanced effect (e.g., 20% explosion chance)
* **Level 3:** Maximum effect + fusion eligible (e.g., 30% explosion chance)

### Fusion System
* Two level 3 weapons can fuse into a higher tier weapon
* Fused weapons start at level 1 and can be leveled again
* Fusion gems drop randomly (25% base + 5% per round)
* Fusion frees an inventory slot (2 inputs → 1 output)

### Acquisition
* **Level Up:** Choose from mixed pool of new items + upgrades
* **No Shop:** Items are only acquired via level-up rewards
* **Contextual Filtering:** Full slots prevent new items of that type from appearing

**Card States:**
* **Holographic:** 2x points when matched
* **On Fire:** Burns after 0.25s, 10% spread chance
* **Connected:** Part of a connector weapon link

## Card Visual Rules (IMPORTANT)

**Borders/outlines are EXCLUSIVELY for selection.** Never use card borders or outlines to indicate any other state (fire, connections, etc.).

**State indicators use small icons** in the bottom left corner of cards:
* Icons are ~1/5 the size of the card shapes (about 10-14px)
* Multiple states can stack horizontally
* Current icons:
  * 🔥 Fire: `lorc/campfire` (red)
  * 🔗 Connection: `lorc/linked-rings` (gray)

This rule ensures visual consistency and prevents confusion with selection state.

## Key Features

* 6 playable characters (Orange Tabby, Sly Fox, Corgi unlocked; Emperor Penguin, Pelican, Badger locked)
* Fusion system: 6 base weapons + 13 passives → 15 Tier 1 fusions → 15 Tier 2 fusions
* 4 weapon + 4 passive inventory slots with level progression (1→2→3)
* Grace auto-use system (prevents health loss on near-misses)
* Match trigger effects (healing, hints, time, graces, explosions, lasers, fire)
* Auto-hint system (shows 1 card from valid set after idle time)
* Options menu with sound toggle (persisted to MMKV storage)
* Optional multiplayer via Socket.io (not a priority - ignore multiplayer code)

### UI Features

* **Inventory Bar:** Displays 4 weapon slots + 4 passive slots with level indicators and fusion tier borders
* **Level Up Selection:** Mixed pool of new items and upgrades with "NEW" and "Lv.X ↑" badges
* **Fusion Tier Styling:** Tier 1 = purple border, Tier 2 = gold legendary border
* **Free Indicator:** Level Up screen clearly shows rewards are free with "FREE" badge and banner
* **Menu Pause:** Timer pauses when the game menu is open

## Notes

* **Multiplayer is NOT a priority.** Do not worry about the multiplayer code or fixing multiplayer code. Focus on single-player gameplay.
* **Enemy selection is skipped.** The game goes directly from character selection to the round phase.
* **Shop is hidden.** Items are acquired only via level-up rewards.
* **Level-up shows mixed pool.** New weapons, new passives, and upgrades for existing items.
* **Fusion requires level 3.** Only max-level weapons can be fused into higher tiers.

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
    ├── play.tsx            # Dev play page (/dev/play) - full game with dev tools
    └── store.tsx           # Dev store page (/dev/store) - weapon shop testing with $50k

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
│   ├── CharacterUnlockScreen.tsx  # Character unlock celebration
│   ├── VictoryScreen.tsx   # End-game celebration screen
│   ├── OptionsMenu.tsx     # Sound settings modal
│   └── RoundSummary.tsx
├── context/
│   └── SocketContext.tsx   # Multiplayer state management
├── types.ts                # Interfaces for Cards, Weapons, PlayerStats
└── utils/
    ├── gameDefinitions.ts  # Characters, player initialization, stats calculation
    ├── gameConfig.ts       # Game constants, default stats, difficulty progressions
    ├── gameUtils.ts        # Modular SET validation for N-attributes
    ├── fusionDefinitions.ts # Weapon/passive data, fusion recipes, tiers
    ├── fusionUtils.ts      # Fusion execution, eligibility checks
    ├── levelUpUtils.ts     # Level-up option generation, upgrade logic
    └── storage.ts          # MMKV persistence (settings, character unlocks, wins)

```

**Import Alias:** Use `@/` to import from `src/` (configured in `tsconfig.json`).

## Icon System (IMPORTANT)

The game uses SVG icons from `assets/icons/` with a **type-safe registry system**. Icons are organized by artist (e.g., `lorc/`, `delapouite/`, `caro-asercion/`).

### How Icons Work

1. **Icon Registry:** All icons must be imported and registered in `src/components/Icon.tsx`
2. **Type Safety:** The `IconName` type is a union of all registered icon paths
3. **Build-Time Validation:** TypeScript catches any invalid icon paths at compile time

### Adding a New Icon

When adding a new icon, you MUST do both steps:

```typescript
// 1. Add the import at the top of Icon.tsx
import MyNewIcon from '../../assets/icons/lorc/my-new-icon.svg';

// 2. Add to ICON_REGISTRY (inside the object)
const ICON_REGISTRY = {
  // ... existing icons
  'lorc/my-new-icon': MyNewIcon,  // Add this line
} as const satisfies Record<string, React.FC<SvgProps>>;
```

### Using Icons

```typescript
// Import IconName type when needed for type annotations
import Icon, { IconName } from './Icon';

// Use in JSX - TypeScript validates the name
<Icon name="lorc/cat" size={24} color={COLORS.slateCharcoal} />

// For typed objects containing icons
const myConfig: { icon: IconName } = {
  icon: 'lorc/cat',  // TypeScript validates this
};
```

### NEVER Do This

- **Never use a string icon path without adding it to ICON_REGISTRY first**
- **Never guess icon paths** - check `assets/icons/` for available SVGs
- **Never use `icon: string`** - always use `icon: IconName` for type safety

### Validation Commands

```bash
npm run typecheck        # Catches invalid icon paths
npm run validate:icons   # Verifies all registered icons have SVG files
```

### Icon Locations

- SVG files: `assets/icons/{artist}/{icon-name}.svg`
- Registry: `src/components/Icon.tsx` (ICON_REGISTRY)
- Type definitions: `src/types.ts` (uses IconName for Weapon, Character, etc.)

## Game Flow

**Adventure Mode:**

1. Character Selection → Select Difficulty (Easy/Medium/Hard) → Start Adventure.
2. **Attribute Unlock:** Game initializes with attributes based on difficulty.
3. Play Round (reach score target within 60 seconds).
4. **Progression:** Attribute unlock screens shown when new attributes are added (varies by difficulty).
5. Level Up (choose from mixed pool of new weapons/passives + upgrades).
6. **Fusion Gem:** Random chance to get fusion gem for combining level 3 weapons.
7. Repeat for 10 rounds total.
8. After completing Round 10: Character Unlock Screen (if characters remain locked) → Victory Screen.

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

**`/dev/play`** - Full game with dev tools:
* Access dev tools through MENU button -> Dev Tools
* Toggle timer on/off
* Reset board, add cards
* Change round (1-10) and difficulty (3-5 attributes)
* Set cards on fire, make holographic
* Add graces
* Add legendary weapons by category

**`/dev/store`** - Standalone weapon shop tester (legacy, may be deprecated):
* Tests the hidden shop component
* Not used in normal gameplay flow

## Versioning (IMPORTANT)

When making commits, **ALWAYS increment the patch version** in `package.json`:

```bash
# Example: 0.1.0 → 0.1.1 → 0.1.2
```

After committing and pushing, **ALWAYS report the new version number** in your output:

```
✓ Pushed version X.Y.Z
```

This ensures builds can be verified to contain the latest changes.

---

## Design Documents

When working on specific systems, load the relevant design doc for detailed specifications:

* **[Weapon/Passive Fusion System](./docs/plans/2026-02-14-weapon-passive-fusion-design.md)** - Fusion mechanics, all weapon/passive definitions, recipes, and tier progression
* **[Legacy Weapon System](./docs/weapons-design.md)** - Original weapon roster (deprecated, kept for reference)
* **[Enemy System](./docs/enemy-design.md)** - Enemy roster, tier scaling, defeat conditions, and weapon counters (in development)
* **[Style Guide](./style_guide.md)** - UI design system including colors, typography, and component styles
