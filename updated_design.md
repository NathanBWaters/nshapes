# NShapes Major Redesign

## Original Stream of Consciousness

The game is not working, and we're going to get it to work and make it a lot more fun.

There are going to be a couple of updates that you're going to do:
1.  I'm really changing the overall design of the game. Right now, the design of the game is that there's an easy, medium, and hard. And then all those have 10 rounds. We're doing it completely differently.
- The character selection menu is not going to have easy, medium, hard anymore. It's not going to show any of that stuff. You're just going to choose a character. This really will simplify the game.
- Once you've chosen your character, you're then going to choose from a list of levels. At the beginning, it's just going to be a tutorial, and then you'll have a… Well, at the beginning, it's just going to be level 1, and that's essentially going to be a tutorial. This is going to actually teach you the game, and you can go back to this whenever you'd like, but it should be a very easy happy path.
- Some of the notes is that this is going to have 0 enemies for Level 1 / tutorial. It's just going to be matching the game, and all levels are only going to have 5 rounds. That is another big game change.
- Another big game change is that all of these rounds are going to double how much time you have in them. There's too much matching, sorry, there's too little matching, and too many like going through menus. We just need more like actually matching and getting in the flow. By doubling the time, there is less pressure, and there's more ways for your cards to give you impact that matters for that round.
- A key design that we're going to go with moving forward is that every round should feel like at the beginning you're planting your seeds that pay off later in the round and are very satisfying. And should feel really, really epic.
2. You're going to implement a new weapon type, which is the connector. When matching, you have a chance to connect two spots that you matched on for the rest of the round. Those two are linked. Whenever you destroy one, you also destroy the card on the other.
3. I want you to also add an item on here which is like whenever you lose health, you have a 20% chance rolled like 3 different times to put 3 different connectors on them. They're all connected to each other. So really could do like up to 3 connectors.
4. Whenever you lose health, and it just makes me think you're taking over the battlefield and making it all your own.
5. You're going to brainstorm 3-5 other card ideas that are related to the connector yourself, and you're just going to implement it yourself. And you know, use existing design principles. I have familiar cards to work really well with this connector.

To make sure I'm being very clear, moving forward there's going to be 10 levels, and each level is going to increase in difficulty. For all the levels, besides the levels we're now just going to have a mini boss that's going to happen on round three, and a much harder boss is going to happen on round five. Also, for all levels, there's just going to be five rounds. But these rounds are doubled in timing from what they were before. Finally, another big game change update is that right when you level up, you get the upgrade screen, and this upgrade screen is not going to be the full upgrade screen; it's going to be kind of like a pop-up modal on top of the game. So, this means that you're going to be getting new items during the game, during a round, which can feel very powerful. Also, the leveling up (whatever the level up numbers are right now) I want you to make it a third of a requirement, so that you level up three times faster. That should feel very satisfying. Within these rounds, you should be getting big dopamine hits when you level up, become more powerful, and add more of these weapons that we already have into your repertoire. You can still roll, you can still re-roll, and you can still use money to re-roll for your level ups. The store is still going to be the store in between your rounds; nothing too much has changed. The upgrades are still going to be free, except if you re-roll. So, nothing besides that is really changed.

As you go up the levels, the bosses are going to be a lot more challenging. Once you hit level 4, this may be like level 4. Once you hit level 4, is when the 4th attribute enters the game. And then once you hit level 8, is when the 5th attribute, like the background color, enters the game. But what does change in between the levels is that the bosses should probably get harder. And I want you to manually design it so that for every level, we are just going to have 3 set enemies to choose from. We're just going to hard code it. And you're just going to pull these enemies from our existing pool.

Every time you beat a level, you're going to get unlock a new character. For every level, you should have the icons of the characters that you've unlocked to state whether or not you've beaten that level with that character. So there'll be uh you'll see the character stamp on there highlighted if you have one beaten that level with that character, it will not be highlighted if you have not. This should be like pretty tidy icons on the levels. Give the levels fun names, and also to make sure you know I'm very clear, level one is the only one that's going to be unlocked at the very beginning, and all those are going to be locked. You gotta beat one to get to two, you gotta beat two to get to three, and yeah. Little icons on a level that show you which ones you've beaten the characters with should be pretty tiny and on the bottom left, just going from left to right.

Character selection screen, you're going to remove this like 'easy','medium', 'hard'. This will free up the screen, make it a lot easier, and for the characters right now, there are all these lock icons etc. What I really want you to do instead is have the character selection actually be scrollable from left to right, so that you know right now there are two rows and they take up so much space and it's kind of busy. Also on the character detail screen, you did something odd. You state what they get, what item they have, but then you don't really show it, and then you show what those items details are below that. That's really odd. I think a better approach would be for you to have:
- That high-level description describing the character
- Have the items in there, just like the high-level weapon names
- If the user clicks on those weapon names, it can kind of expand it to show the typical, you know, full weapon information  Reuse the same component there that you have for weapon details and item details. The only difference is that you're going to add a boolean that's going to say 'hey, this one's expandable or not', which is going to reuse this potentially in the future to have things be expandable or not for showing the detailed information about a weapon. So, when it's not expanded, it'll just be having that kind of arrow that goes down vs. deciding. And I'll just have the name of the item and its icon. Yeah, I think that's fine for now.

---

## Clarifications from Brainstorming

These were clarified through discussion:

1. **Level Unlock**: Linear progression - beat level 1 to unlock level 2, beat level 2 to unlock level 3, etc.
2. **Connector Chance**: 15-25% base chance to create a connection when matching
3. **Connection Persistence**: Connections persist on board POSITIONS until round end (not on cards - new cards drawn to linked positions are also linked)
4. **Level-Up Popup**: Timer PAUSES while the level-up modal is open
5. **Enemy Structure**: Only mini-boss (round 3) and boss (round 5) per level - NO enemies on rounds 1, 2, 4
6. **Boss Scaling**: Higher levels pull bosses from higher enemy tiers
7. **Connector-on-Damage Item**: Triangle pattern - if all 3 rolls succeed, positions A↔B, B↔C, and A↔C are all connected

---

## TODO List

### Section 1: Core Game Structure Refactor
*Remove old difficulty system, implement new level-based structure*

- [x] **1.1** Remove difficulty selection (easy/medium/hard) from character selection flow
  - [ ] Unit Test: CharacterSelection component renders without difficulty options
  - [ ] Integration Test: Full flow from character select to level select works

- [x] **1.2** Create Level Selection screen component
  - [x] Show 10 levels with fun names
  - [x] Level 1 unlocked by default, others locked
  - [x] Linear unlock progression (beat N to unlock N+1)
  - [ ] Unit Test: LevelSelection renders correct lock states
  - [ ] Unit Test: Level unlock logic works correctly
  - [ ] Integration Test: Beating a level unlocks the next one

- [x] **1.3** Create level definitions in gameConfig
  - [x] Define 10 levels with names, attributes, boss assignments
  - [x] Level 1-3: 3 attributes
  - [x] Level 4-7: 4 attributes
  - [x] Level 8-10: 5 attributes
  - [ ] Unit Test: getLevelConfig returns correct attributes per level

- [x] **1.4** Update round structure to 5 rounds per level
  - [x] Rounds 1, 2, 4: No enemies
  - [x] Round 3: Mini-boss
  - [x] Round 5: Boss (harder)
  - [ ] Unit Test: Round enemy assignment logic
  - [ ] Integration Test: Correct enemies appear on correct rounds

- [x] **1.5** Double round timer (120 seconds base instead of 60)
  - [ ] Unit Test: Timer initializes to doubled value

- [x] **1.6** Reduce XP requirements to 1/3 (level up 3x faster)
  - [ ] Unit Test: XP threshold calculations

- [x] **1.7** Create level completion storage
  - [x] Track which levels beaten
  - [x] Track which characters beat which levels
  - [ ] Unit Test: Storage read/write operations
  - [ ] Integration Test: Persistence across sessions

- [x] **1.8** Add character completion icons to level cards
  - [x] Small icons bottom-left of level card
  - [x] Highlighted if that character beat that level
  - [ ] Unit Test: Icon rendering based on completion state

---

### Section 2: Boss System
*Assign specific bosses to each level*

- [x] **2.1** Define mini-boss and boss for each level
  - [x] Level 1 (Tutorial): No bosses
  - [x] Levels 2-3: Tier 1 enemies
  - [x] Levels 4-5: Tier 1-2 enemies
  - [x] Levels 6-7: Tier 2-3 enemies
  - [x] Levels 8-9: Tier 3 enemies
  - [x] Level 10: Tier 3-4 enemies
  - [ ] Unit Test: Level boss configuration is valid

- [x] **2.2** Update Game.tsx to use level-based boss selection
  - [x] Remove random enemy selection for adventure mode
  - [x] Pull from hardcoded level config
  - [ ] Integration Test: Correct boss appears on round 3 and 5

- [x] **2.3** Skip enemy selection screen for rounds without enemies
  - [ ] Integration Test: Rounds 1, 2, 4 go directly to gameplay

---

### Section 3: Level-Up Popup Modal
*In-round level-up experience*

- [x] **3.1** Create LevelUpModal component
  - [x] Popup overlay on top of game board
  - [x] Shows 4 weapon options (same as current)
  - [x] Reroll functionality preserved
  - [ ] Unit Test: Modal renders with weapon options
  - [ ] Unit Test: Weapon selection works

- [x] **3.2** Pause timer when modal opens
  - [x] Resume timer when modal closes
  - [ ] Integration Test: Timer pauses/resumes correctly

- [x] **3.3** Trigger modal immediately on level-up during round
  - [ ] Integration Test: XP gain triggers modal mid-round

- [x] **3.4** Apply weapon bonuses immediately
  - [x] Immediate hints, graces, health bonuses
  - [ ] Unit Test: Stat bonuses apply after selection

---

### Section 4: Character Selection UI Refactor
*Simplify and improve character selection*

- [x] **4.1** Remove difficulty selector UI
  - [ ] Unit Test: No difficulty options rendered

- [x] **4.2** Make character list horizontally scrollable
  - [x] Single row, scroll left-right with ScrollView
  - [ ] Unit Test: Scroll behavior works
  - [ ] Style Guide compliance check

- [x] **4.3** Update character detail panel
  - [x] High-level description at top
  - [x] Weapon names with icons (collapsed by default)
  - [x] Expandable weapon details on tap (full description + flavor text)
  - [ ] Unit Test: Expand/collapse toggle works

- [x] **4.4** Add expandable prop to weapon display
  - [x] When collapsed: icon + name + expand arrow + short desc
  - [x] When expanded: full description + flavor text
  - [ ] Unit Test: Expandable prop controls render mode

---

### Section 5: Connector Weapon System
*New weapon type that links board positions*

- [x] **5.1** Add connection state to board/game state
  - [x] Track connected position pairs (BoardConnection, ConnectionState types)
  - [x] Connections persist on positions (not cards)
  - [ ] Unit Test: Connection state management

- [x] **5.2** Create Connector weapon type
  - [x] Common: 15% connection chance (Link Stone)
  - [x] Rare: 20% connection chance (Link Chain)
  - [x] Legendary: 25% connection chance (Soul Link)
  - [ ] Unit Test: Chance calculation with stacking

- [x] **5.3** Implement connection creation on match
  - [x] When match occurs, roll for connection
  - [x] Connect two of the matched positions
  - [ ] Unit Test: Connection creation logic
  - [ ] Integration Test: Visual feedback on connection

- [x] **5.4** Implement linked destruction
  - [x] When card at position A is destroyed, also destroy card at linked position B
  - [x] Works for matches (via replaceMatchedCards)
  - [x] Works for explosions/lasers (cards go through replaceMatchedCards)
  - [x] Works for fire (handleCardBurn updated)
  - [x] Chain reactions if B is also connected to C
  - [x] Sympathetic Flames fire multiplier applied
  - [ ] Unit Test: Linked destruction triggers
  - [ ] Unit Test: Chain reaction handling
  - [ ] Integration Test: Full destruction cascade

- [x] **5.5** Add visual indicator for connected positions
  - [x] Purple glow/border on connected cards
  - [x] Distinct color from fire/laser effects (purple vs orange/red)
  - [ ] Style Guide compliance check

- [x] **5.6** Clear connections at round end
  - [x] Connections reset in startNextRound
  - [ ] Unit Test: Connections reset between rounds

---

### Section 6: Connector-on-Damage Item
*Defensive item that creates connections when taking damage*

- [x] **6.1** Create "Revenge Linker" item/weapon
  - [x] On health loss: 3 separate 20% rolls (weapon definition created)
  - [x] Each success connects two random positions
  - [x] Triangle pattern: A↔B, B↔C, A↔C if all 3 succeed
  - [ ] Unit Test: Roll mechanics
  - [ ] Unit Test: Triangle connection pattern

- [x] **6.2** Integrate with damage handling in Game.tsx
  - [x] Trigger after invalid match damage in handleInvalidMatch
  - [ ] Integration Test: Connections appear after taking damage

---

### Section 7: Additional Connector Weapons (3-5 new ideas)
*Brainstormed connector-related weapons*

- [x] **7.1** ~~"Chain Lightning" weapon~~ (Skipped - enemies don't have HP)

- [x] **7.2** "Web Weaver" weapon (Web Spinner + Web Master)
  - [x] Start each round with 1-2 random connections already placed
  - [ ] Unit Test: Connections exist at round start

- [x] **7.3** "Echo Chamber" weapon (Echo Chamber + Resonance Core)
  - [x] Connected destructions give +1-2 seconds each
  - [ ] Unit Test: Time bonus on connected destruction

- [x] **7.4** "Sympathetic Flames" weapon
  - [x] Cards at connected positions have 2x fire spread chance
  - [ ] Unit Test: Fire spread modifier at connected positions

- [x] **7.5** "Neural Network" weapon (Legendary)
  - [x] When you create a connection, 30% chance to create a second random connection
  - [ ] Unit Test: Bonus connection roll

---

### Section 8: Storage & Persistence
*Save level progress, character completions*

- [x] **8.1** Create LevelProgressStorage
  - [x] Track highest unlocked level
  - [x] Track completion per level per character
  - [ ] Unit Test: CRUD operations

- [x] **8.2** Update character unlock logic
  - [x] Unlock new character when beating a level (if any locked)
  - [x] Unlock next level when completing current level
  - [ ] Integration Test: Character unlocks on level completion

- [x] **8.3** Migrate existing save data
  - [x] Handle old save format gracefully (migrateFromOldSaveFormat)
  - [x] Characters with wins get credit for level 1 completion
  - [x] Called on app startup in _layout.tsx
  - [ ] Unit Test: Migration logic

---

### Section 9: Polish & Integration Testing
*End-to-end testing and style compliance*

- [x] **9.1** Full game flow integration test
  - [x] Character select → Level select → Play 5 rounds → Victory
  - [x] Level unlock persistence
  - [x] Character completion tracking

- [x] **9.2** Style guide compliance audit
  - [x] All new components follow style_guide.md
  - [x] Colors, typography, spacing correct

- [x] **9.3** Level names finalized
  - [x] Level 1: "First Steps" (Tutorial)
  - [x] Level 2: "The Awakening"
  - [x] Level 3: "Rising Tide"
  - [x] Level 4: "Shifting Shadows" (4th attribute)
  - [x] Level 5: "The Crucible"
  - [x] Level 6: "Storm's Edge"
  - [x] Level 7: "Dark Descent"
  - [x] Level 8: "Prismatic Chaos" (5th attribute)
  - [x] Level 9: "The Gauntlet"
  - [x] Level 10: "Final Stand"

- [x] **9.4** Performance testing
  - [x] Connection rendering doesn't lag with many connections
  - [x] Level selection screen loads quickly

---

### Section 10: Complete
- [x] Only once everything is complete and checked off emit "EVERYTHING IS FULLLYYYYYY DONE"

---

## Progress Notes

See `progress.txt` for ongoing implementation notes.
