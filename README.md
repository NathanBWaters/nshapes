# NShapes

NShapes is a Roguelike digital card game based on the classic game "Set" where you match cards based on their features being all the same or all different. You can collect items and weapons to improve your score, similar to games like Brotato or other roguelikes.

## Game Overview

In NShapes, you progress through 10 increasingly difficult rounds, collecting points by making matches. Each round has a target score you must reach within a time limit to progress to the next round.

### Gameplay Loop

1. **Select Character** - Choose from 16 unique animal characters, each with their own strengths and abilities
2. **Face an Enemy** - Each round, select from 3 randomly chosen enemies to face
3. **Match Cards** - Find valid combinations of cards on the game board
4. **Open Loot Crates** - Collect and open loot crates for random rewards
5. **Level Up** - Choose from 4 upgrade options to improve your character
6. **Shop** - Spend coins to purchase items that enhance your abilities
7. **Repeat** - Continue until you complete all 10 rounds or fail to meet a round's target

## Card Matching Rules

A valid match (or "Set") in NShapes consists of 3 cards where each attribute (shape, color, number, and shading) is either:
- All the same across all three cards, OR
- All different across all three cards

For example, 3 cards with the same shape but different colors, different numbers, and different shadings would form a valid set.

## Roguelike Elements

### Characters

Choose from 16 unique animal characters, each with different starting stats and abilities:

- **Orange Tabby** - Gets extra mulligans
- **Sly Fox** - Specializes in bomb and trap synergy
- **Corgi** - Extra match hints and free rerolls
- **Emperor Penguin** - Money-focused
- **Blue-Footed Boobie** - Can make cards become fragile
- **Meerkat** - Has a larger field view
- **Cow** - Healing-focused
- **Tortoise** - Time-based advantages
- **Chimp** - Can hold more weapons
- **Eagle** - Can remove dud cards
- **Lemur** - Gets cheaper rerolls
- **Hedgehog** - Automatically destroys spikes
- **Armadillo** - Deflects damage back to cards
- **Raccoon** - More crates but starts with duds
- **Polar Bear** - Can freeze cards for extra time
- **Chameleon** - Better chance of transforming field cards

### Enemies

Each round, choose from 3 enemies to face. They make the round harder but provide rewards when defeated:

- **Chihuahua** - Stops field draw on specific cards
- **Jellyfish** - Increases damage received
- **Snake** - Reduces field space
- **Mammoth** - Increases card health
- **Rabbit** - Speeds up time
- **Squid** - Covers some cards
- **Porcupine** - Adds more spikes
- **Hyena** - Makes players lose coins on failed matches
- **Tiger** - Increases card health

### Weapons

You can equip up to 3 weapons (by default) with different effects:

- **Flint** - Chance to start fires
- **Bamboo** - Deal extra damage
- **Carrot** - Slows time
- **Beak** - Make cards fragile
- **Dirt** - Increases field size
- **Talon** - Remove brambles
- **Hoe** - Temporarily increase field size

### Items

Purchase items from the shop to enhance your character:

- **Great Field** - Larger field and commerce boost
- **Mirror Trinket** - Mirrors another item
- **Hint Booster** - Extra match possibilities
- **Lucky Token** - Free rerolls
- **Colorblind Goggles** - Increases holographic chance
- **Crimson Lens** - Focus on red cards
- **Crystal Ball** - Preview upcoming cards
- **Chrono Stop** - Pause the timer
- ...and many more!

### Player Stats

Your character can improve in many areas:

- **Level** - Increases as you gain experience
- **Money** - Used for shop purchases and rerolls
- **Experience Gain** - How quickly you level up
- **Luck** - Improves random events
- **Field Size** - How many cards appear on the board
- **Damage** - How much damage you do to field cards
- **Health** - How many hits you can take
- **Dodge** - Chance to avoid damage
- **Critical Chance** - Chance to deal double damage
- ...and many more!

## Field Card Modifiers

Cards on the field can have special properties:

- **Health** - Some cards require multiple matches
- **Loot Box** - Drops a loot crate when matched
- **Bonus Money/Points** - Extra rewards
- **Fire Starter** - Can spread fire to nearby cards
- **Bomb** - Explodes nearby cards when matched (or damages players if not matched in time)
- **Healing** - Heals the player when matched
- **Spikes** - Damage the player when matched
- **Dud** - Can't be matched
- **Fragile** - Might break and be removed permanently
- **Booby Trap** - Can take out whole rows/columns
- **Clover** - Improves nearby cards

## Multiplayer

The game can be played solo or cooperatively with friends online.

### Co-op Features

- **Shared Board** - Work together to find matches
- **Hint Passes** - Share hints with teammates
- **Team Rerolls** - Vote to refresh the field
- **Bomb Management** - Work together to defuse bombs

## How to Play

1. **Install Dependencies**: Run `npm install`
2. **Start the Game**: Run `npm run dev` for development or `npm start` for production
3. **Multiplayer Server**: Run `npm run server` to start the multiplayer server

## Technologies Used

- React
- Next.js
- Socket.IO for multiplayer functionality

## License

This project is licensed under the MIT License - see the LICENSE file for details.
