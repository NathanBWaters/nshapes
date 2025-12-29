# NShapes

A roguelike deckbuilding match-three puzzle game for iOS and Android, built with Expo/React Native.

## Game Overview

NShapes combines the classic SET card matching game with roguelike progression mechanics similar to Slay the Spire. Players match valid 3-card combinations to progress through 10 rounds of escalating difficulty.

### Core Mechanics

**SET Card Rules:** The game uses 81 unique cards defined by 4 attributes (Shape, Color, Number, Shading) with 3 values each. A valid match requires 3 cards where each attribute is either all the same OR all different across the cards.

**Roguelike Progression:**
- 10 rounds with increasing difficulty and score targets
- Choose from 16 unique characters with distinct playstyles
- Select enemies each round that add modifiers and grant rewards
- Level up with stat upgrades and weapons after each round
- Purchase items from the shop between rounds

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
src/
├── app/
│   ├── _layout.tsx      # Root navigation layout
│   └── index.tsx        # App entry point
├── components/
│   ├── Game.tsx         # Main game controller
│   ├── GameBoard.tsx    # Card display and selection
│   ├── Card.tsx         # Individual card rendering
│   ├── CharacterSelection.tsx
│   ├── EnemySelection.tsx
│   ├── LevelUp.tsx
│   ├── ItemShop.tsx
│   └── ...
├── context/
│   └── SocketContext.tsx  # Multiplayer state management
├── types.ts             # TypeScript interfaces
└── utils/
    ├── gameDefinitions.ts  # Characters, enemies, items, weapons
    └── gameUtils.ts        # Card logic and validation
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
```

## Game Flow

1. Character Selection
2. Enemy Selection (each round)
3. Play Round (match cards to reach score target before time runs out)
4. Level Up (choose upgrade)
5. Item Shop (buy items)
6. Repeat for 10 rounds
