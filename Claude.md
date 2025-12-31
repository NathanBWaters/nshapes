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

### Game Modes

**Adventure Mode** - Progressive Roguelike Campaign:

* **Round-Based Complexity:** The number of attributes required for a "Set" increases as you progress:
* **Round 1:** 2 Attributes (Shape, Color)
* **Rounds 2–3:** 3 Attributes (adds Number)
* **Rounds 4–9:** 4 Attributes (adds Shading)
* **Round 10 (Final Boss):** 5 Attributes (adds Background Color)


* 60-second timer per round to reach score targets.
* 16 unique characters, enemy modifiers, weapon level-ups, and item shop.

**Free Play Mode** - Relaxed Practice:

* **Difficulty Selector:** Choose the number of active attributes before starting:
* **Easy:** 2 Attributes
* **Medium:** 3 Attributes
* **Hard:** 4 Attributes
* **Omega Brained:** 5 Attributes


* No timer, no score targets, and no enemies—continuous endless gameplay.

### Key Features

* 16 playable characters (Orange Tabby, Sly Fox, Corgi, etc.)
* 9 enemy types with unique effects
* 7 weapon types that can be leveled up
* 22+ purchasable items across 4 tiers
* Card modifiers (bombs, spikes, healing, loot boxes, etc.)
* Optional multiplayer via Socket.io

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
    └── test.tsx            # Dev test page (/dev/test)

src/                        # Shared code (imported via @/ alias)
├── components/
│   ├── Game.tsx            # Main controller (handles Attribute Scaling logic)
│   ├── GameBoard.tsx       # Card display (adjusts grid size for 5-attr sets)
│   ├── Card.tsx            # Renders shapes, fills, and backgrounds
│   ├── CharacterSelection.tsx  
│   ├── EnemySelection.tsx
│   ├── LevelUp.tsx
│   ├── ItemShop.tsx
│   └── RoundSummary.tsx    
├── context/
│   └── SocketContext.tsx   # Multiplayer state management
├── types.ts                # Interfaces for Cards (2-5 attributes)
└── utils/
    ├── gameDefinitions.ts  # Characters, enemies, items, weapons
    └── gameUtils.ts        # Modular SET validation for N-attributes

```

**Import Alias:** Use `@/` to import from `src/` (configured in `tsconfig.json`).

## Game Flow

**Adventure Mode:**

1. Character Selection → Choose Adventure.
2. **Attribute Unlock:** Game initializes with 2 attributes (Shape/Color).
3. Enemy Selection → Play Round (reach score target).
4. **Progression:** After Round 1, 3, and 9, the game introduces the next attribute dimension.
5. Level Up / Item Shop between rounds.
6. Repeat for 10 rounds total.

**Free Play Mode:**

1. Character Selection → Choose Free Play.
2. **Select Difficulty:** Toggle 2, 3, 4, or 5 attributes.
3. Play continuously; exit anytime.

## Game Board Layout

The layout adapts based on the number of active attributes to ensure a Set is mathematically likely to be on the board:

* **2–3 Attributes:** 3x3 or 3x4 grid (9–12 cards).
* **4–5 Attributes:** 3x5 or 3x6 grid (15–18 cards) to prevent "No-Set" deadlocks.

When working on this codebase, also load these additional files for context:
-- [Style Guide](./style_guide.md) - UI design system including colors, typograph
y, and component styles