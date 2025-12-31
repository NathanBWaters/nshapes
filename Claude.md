# NShapes

A roguelike deckbuilding match-three puzzle game for iOS, Android, and Web, built with Expo/React Native.

## Game Overview

NShapes combines the classic SET card matching game with roguelike progression mechanics similar to Slay the Spire. The game offers two modes: **Adventure Mode** (full roguelike campaign) and **Free Play** (relaxed practice mode).

### Core Mechanics

**SET Card Rules:** The game uses 81 unique cards defined by 4 attributes (Shape, Color, Number, Shading) with 3 values each. A valid match requires 3 cards where each attribute is either all the same OR all different across the cards.

### Game Modes

**Adventure Mode** - Full roguelike campaign:
- 10 rounds with increasing difficulty and score targets
- 60-second timer per round
- Choose from 16 unique characters with distinct playstyles
- Select enemies each round that add modifiers and grant rewards
- Level up with stat upgrades and weapons after each round
- Purchase items from the shop between rounds
- Card modifiers (bombs, spikes, healing, loot boxes, etc.)

**Free Play Mode** - Relaxed practice:
- No timer - take as long as needed to find matches
- No rounds or score targets - continuous endless gameplay
- No enemies, shop, or level up mechanics
- Simple UI showing health, level, hints, and match counter
- Great for learning SET rules or casual play

### Key Features

- 16 playable characters (Orange Tabby, Sly Fox, Corgi, etc.)
- 9 enemy types with unique effects
- 7 weapon types that can be leveled up
- 22+ purchasable items across 4 tiers
- Card modifiers (bombs, spikes, healing, loot boxes, etc.)
- Optional multiplayer via Socket.io

## Tech Stack

- **Expo 54** with Expo Router
- **React Native** for iOS, Android, and Web
- **TypeScript**
- **NativeWind/TailwindCSS** for styling
- **Socket.io** for multiplayer

## Project Structure

```
app/                        # Expo Router routes only
├── _layout.tsx             # Root navigation layout
├── index.tsx               # App entry point (home screen)
└── dev/
    ├── _layout.tsx         # Dev routes layout
    └── test.tsx            # Dev test page (/dev/test)

src/                        # Shared code (imported via @/ alias)
├── components/
│   ├── Game.tsx            # Main game controller (handles both game modes)
│   ├── GameBoard.tsx       # Card display and selection
│   ├── Card.tsx            # Individual card rendering
│   ├── CharacterSelection.tsx  # Character + game mode selection
│   ├── EnemySelection.tsx
│   ├── LevelUp.tsx
│   ├── ItemShop.tsx
│   ├── RoundSummary.tsx    # Post-round stats display
│   └── ...
├── context/
│   └── SocketContext.tsx   # Multiplayer state management
├── types.ts                # TypeScript interfaces
└── utils/
    ├── gameDefinitions.ts  # Characters, enemies, items, weapons
    └── gameUtils.ts        # Card logic and validation
```

**Import Alias:** Use `@/` to import from `src/` (configured in `tsconfig.json`):
```typescript
import Game from "@/components/Game";
import { Card } from "@/types";
```

## Development

```bash
# Install dependencies
npm install

# Start development server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android

# Run web version locally
npx expo start --web

# Access dev test page (for testing game board in isolation)
# http://localhost:8081/dev/test
```

## Web Deployment (GitHub Pages + PWA)

The game is deployed as a Progressive Web App (PWA) to GitHub Pages, allowing users to install it directly from the browser.

**Live URL:** https://nathanbwaters.github.io/nshapes/

### PWA Installation

Users can install the game as a standalone app:
- **iOS Safari:** Tap Share > "Add to Home Screen"
- **Android Chrome:** Tap menu > "Install app" or "Add to Home Screen"
- **Desktop Chrome/Edge:** Click install icon in address bar

### Deployment

Deployment happens automatically via GitHub Actions when pushing to the `main` branch.

```bash
# Manual web build (outputs to ./dist)
npm run build:web
```

### Configuration Notes

- **Dynamic config:** `app.config.js` conditionally sets `baseUrl: "/nshapes"` only in production builds (for GitHub Pages). Local development uses no baseUrl so routes work at `localhost:8081/...`
- PWA manifest settings are in `app.config.js` under the `web` key
- GitHub Actions workflow is in `.github/workflows/deploy.yml`

## Game Flow

**Adventure Mode:**
1. Character Selection → Choose Adventure
2. Enemy Selection (each round)
3. Play Round (match cards to reach score target before timer expires)
4. Round Summary (stats display)
5. Level Up (choose upgrade)
6. Item Shop (buy items)
7. Repeat steps 2-6 for 10 rounds
8. Game Over screen with final stats

**Free Play Mode:**
1. Character Selection → Choose Free Play
2. Play continuously (no timer, no score target)
3. Exit anytime to return to character selection

## Related Documentation

When working on this codebase, also load these additional files for context:

- [Style Guide](./style_guide.md) - UI design system including colors, typography, and component styles

## Game Board Layout

The round phase uses a flex-based layout that adapts to all screen sizes (iOS, Web, Steam Deck):

```
┌──────────────────────────────────────┐
│ Header (10%) - Round, Score, Timer   │
├──────────────────────────────────────┤
│ ┌────────┐ ┌────────┐ ┌────────┐    │
│ │ Card 1 │ │ Card 2 │ │ Card 3 │ Row 1 (flex:1)
│ └────────┘ └────────┘ └────────┘    │
│ ┌────────┐ ┌────────┐ ┌────────┐    │
│ │ Card 4 │ │ Card 5 │ │ Card 6 │ Row 2 (flex:1)
│ └────────┘ └────────┘ └────────┘    │
│ ┌────────┐ ┌────────┐ ┌────────┐    │
│ │ Card 7 │ │ Card 8 │ │ Card 9 │ Row 3 (flex:1)
│ └────────┘ └────────┘ └────────┘    │
│ ┌────────┐ ┌────────┐ ┌────────┐    │
│ │Card 10 │ │Card 11 │ │Card 12 │ Row 4 (flex:1)
│ └────────┘ └────────┘ └────────┘    │
├──────────────────────────────────────┤
│ Bottom Bar - Selected count, Hints   │
└──────────────────────────────────────┘
```

**Layout structure:**
- Header: 10% height with round indicator, score progress bar, circular timer
- Board: 90% height, pure flexbox with 4 rows of 3 cards each
- Each row uses `flex: 1` to share vertical space equally
- Each card uses `flex: 1` with `aspectRatio: 0.75` to maintain proportions
- Card shapes scale dynamically based on screen width
