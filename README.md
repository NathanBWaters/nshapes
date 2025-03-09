# NShapes

A digital implementation of the classic NShapes card game built with Next.js and React.

## Game Rules

In NShapes, players try to identify valid combinations of three cards from a layout of cards on the table. Each card has four attributes:

- **Shape**: Oval, Squiggle, or Diamond
- **Color**: Red, Green, or Purple
- **Number**: One, Two, or Three shapes
- **Shading**: Solid, Striped, or Open

A valid combination consists of three cards where each attribute is either ALL THE SAME or ALL DIFFERENT across all three cards.

## Features

- Complete implementation of NShapes game logic
- Interactive card selection
- Automatic validation of combinations
- Scoring system
- Timer to track gameplay duration
- Hint system to help players find valid combinations
- Option to add more cards when no valid combinations are visible
- Responsive design that works on desktop and mobile devices
- Dark mode support

## How to Play

1. Click "Start Game" to begin
2. Click three cards that you believe form a valid combination
3. If correct, the cards will be removed and replaced
4. If incorrect, try again
5. Use the "Hint" button if you're stuck
6. Use "Add Cards" if no valid combinations are visible
7. The game ends when no more valid combinations can be found or the deck is exhausted

## Development

This project uses:

- Next.js 15.2+
- React 19+
- TypeScript
- Tailwind CSS

### Getting Started

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Run the development server:
   ```
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

- `src/app/components/` - React components for the game UI
- `src/app/utils/` - Utility functions for game logic
- `src/app/types.ts` - TypeScript type definitions
- `src/app/page.tsx` - Main application page

## License

MIT
