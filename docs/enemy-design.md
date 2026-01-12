# Enemy System Design

## Design Philosophy

The enemy system adds strategic depth to NShapes by introducing **pre-round decisions** that interact with your build. Rather than being on-board obstacles, enemies exist as **off-board influences** that modify the gameplay rules for each round.

### Core Principles

1. **Strategic Enemy Selection**
   - Before each round, choose 1 of 3 enemies to face
   - Full transparency: See all abilities, effects, and defeat conditions upfront
   - Build-dependent choices: If you've specialized in fire weapons, avoid the anti-fire enemy
   - Risk/reward: Harder enemies offer better rewards

2. **Off-Board Influence**
   - Enemies don't appear on the game board
   - They create persistent effects that modify gameplay (attribute changes, time pressure, card states)
   - Focus remains on SET matching, but with added constraints

3. **Optional Bonus Challenges**
   - **Score target** = Required to advance (unchanged from current gameplay)
   - **Defeat condition** = Optional bonus challenge unique to each enemy
   - Completing defeat condition grants a **premium bonus weapon** at level up
   - No penalty for failing the defeat condition - just miss the bonus reward

4. **Weapon Counter System**
   - Many enemies counter specific weapon types (fire, explosion, laser, hints, etc.)
   - Counters reduce weapon effectiveness by a percentage (scaling by tier)
   - Creates meaningful choices: Do you take the enemy that counters your build for a better reward?

5. **Escalating Threat Tiers**
   - **Tier 1 (R1-5):** Single effects, mild counters (10-20% reduction)
   - **Tier 2 (R5-7):** Two combined effects, moderate counters (30-40%)
   - **Tier 3 (R8-9):** Three combined effects, strong counters (50-60%)
   - **Tier 4 (R10):** Five combined effects, severe counters (70-90%)
   - Animals get scarier as tiers increase (rat → wolf → bear → dragon)

6. **Defeat Conditions**
   - 45 unique conditions across all enemies
   - Mix of: attribute challenges, streak/combo goals, speed challenges, specific patterns
   - Some enemies have unique conditions tied to their mechanics (Iron Shell → clear the triple card)

---

## Design Rules

### Instant Death
**Instant death mechanics are reserved for Tier 3 and Tier 4 only.** In Tier 1 and Tier 2, inactivity or failure conditions should result in health loss, not instant death. This ensures early rounds are challenging but not punishing for new players.

### Streak Definition
A **streak** is defined as consecutive successful matches with **no invalid match attempts** in between. For example, a "4-match streak" means 4 valid SETs matched consecutively without selecting an invalid combination. The streak resets when the player makes an invalid match.

### Timer vs Finish
When describing defeat conditions, use "achieve minimum" rather than "finish" because the round continues until the timer runs out. Players keep scoring for coins after hitting the target.

### Naming Convention
Enemy names should be **1-3 words**, animal-themed, and hint at their mechanic without being purely mechanical. Example: "Burrowing Mole" not "Shrinking Field".

---

## Enemy Roster

### Tier 1 (Rounds 1-5) — 22 Enemies
*Single effect, counters at 10-20% reduction, mild animal icons*

| # | Name | Icon | Effect | Defeat Condition |
|---|------|------|--------|------------------|
| 1 | **Junk Rat** | `rat` | 4% chance per card draw → card is white/blank dud (unmatchable) | Get a 4-match streak |
| 2 | **Stalking Wolf** | `wolf-head` | 45s inactivity bar → lose 1 health | Match 3 times in under 5s each |
| 3 | **Shifting Chameleon** | `chameleon-glyph` | Changes 1 attribute on random cards every 20s | Get 2 all-different matches |
| 4 | **Burrowing Mole** | `mole` | Removes 1 random card every 20s | Match all 3 shapes at least once |
| 5 | **Masked Bandit** | `raccoon-head` | Disables auto-hints entirely | Get 3 matches without hesitating >10s |
| 6 | **Wild Goose** | `goose` | Shuffles card positions every 30s | Match 2 sets that share a card attribute |
| 7 | **Thieving Raven** | `raven` | -5s stolen per match | Complete 5 matches total |
| 8 | **Stinging Scorpion** | `scorpion` | 2x damage taken, 2x points earned | Make no invalid matches |
| 9 | **Night Owl** | `barn-owl` | 20% chance per draw → card is face-down (looks like dud); matching flips face-down cards with 70% chance each | Match 4 face-down cards |
| 10 | **Swift Bee** | `bee` | Timer 20% faster, 20% more points | Get a 5-match streak |
| 11 | **Trap Weaver** | `spider-face` | Random cards get 10s bomb timers | Defuse 3 bombs (match bomb cards) |
| 12 | **Circling Vulture** | `vulture` | Score drains 5pts/sec | Reach 150% of target score |
| 13 | **Iron Shell** | `turtle` | One card needs 3 matches to clear | Clear the triple-health card |
| 14 | **Ticking Viper** | `snake` | One card has 15s countdown timer; match or lose 1HP | Match the countdown card in time |
| 15 | **Wet Crab** | `crab` | Fire effects -15% | Get 2 matches with all-same color |
| 16 | **Spiny Hedgehog** | `hedgehog` | Explosion effects -15% | Get 3 matches containing squiggles |
| 17 | **Shadow Bat** | `bat` | Laser effects -20% | Match 3 different colors in one set |
| 18 | **Foggy Frog** | `frog` | Hint gain -15% | Achieve minimum with 2+ hints remaining |
| 19 | **Sneaky Mouse** | `mouse` | Grace gain -15% | Never use a grace |
| 20 | **Lazy Sloth** | `sloth` | Time gain -20% | Achieve minimum with 15+ seconds remaining |
| 21 | **Greedy Squirrel** | `squirrel` | On valid match, 1 additional random card is removed from field | Achieve minimum with 8+ cards remaining |
| 22 | **Punishing Ermine** | `ermine` | On invalid match, 2 random cards are removed from field | Make no invalid matches

---

### Tier 2 (Rounds 5-7) — 12 Enemies
*Two combined effects, counters at 30-40% reduction, threatening animal icons*

| # | Name | Icon | Effects (Combined) | Defeat Condition |
|---|------|------|-------------------|------------------|
| 23 | **Charging Boar** | `boar` | Stalking Wolf (35s → lose 1HP) + Circling Vulture (3pts/sec drain) | Get 3 matches each under 8s |
| 24 | **Cackling Hyena** | `hyena-head` | Thieving Raven (-3s) + Sneaky Mouse (-35%) | Match 6 times with no grace used |
| 25 | **Lurking Shark** | `shark-jaws` | Night Owl (25% face-down) + Ticking Viper (12s countdown) | Match 3 face-down cards + the countdown card |
| 26 | **Diving Hawk** | `hawk-emblem` | Swift Bee (35% faster) + Burrowing Mole (15s removal) | Get 2 all-different matches under 6s each |
| 27 | **Venomous Cobra** | `cobra` | Shifting Chameleon (15s) + Trap Weaver | Match 4 bombs before they explode |
| 28 | **Prowling Direwolf** | `direwolf` | Junk Rat (6% dud) + Wild Goose (25s shuffle) | Get a 6-match streak |
| 29 | **Hunting Eagle** | `eagle-head` | Iron Shell + Lazy Sloth (-35%) | Clear triple card with 20s+ remaining |
| 30 | **Armored Tusks** | `boar-tusks` | Wet Crab (-35%) + Spiny Hedgehog (-35%) | Trigger 2 destruction effects (any type) |
| 31 | **Creeping Shadow** | `beast-eye` | Masked Bandit + Foggy Frog (-35%) | Match all 3 colors at least once |
| 32 | **Polar Guardian** | `polar-bear` | Stinging Scorpion + Shadow Bat (-40%) | Take no damage AND trigger 1 weapon effect |
| 33 | **Hoarding Beaver** | `beaver` | Greedy Squirrel (1 card per match) + Burrowing Mole (18s) | Achieve minimum with 6+ cards remaining |
| 34 | **Fierce Wolverine** | `wolverine-claws` | Punishing Ermine (2 cards per invalid) + Stinging Scorpion | Make no invalid matches AND take no damage

---

### Tier 3 (Rounds 8-9) — 12 Enemies
*Three combined effects, counters at 50-60% reduction, dangerous creature icons*
*Note: Instant death mechanics become available in this tier*

| # | Name | Icon | Effects (Combined) | Defeat Condition |
|---|------|------|-------------------|------------------|
| 35 | **Raging Bear** | `bear-head` | Stalking Wolf (30s → **instant death**) + Stinging Scorpion + Circling Vulture (4pts/sec) | 7-match streak with no invalid matches |
| 36 | **Abyssal Octopus** | `octopus` | Night Owl (30% face-down) + Wild Goose (20s) + Ticking Viper (10s countdown) | Match 5 face-down cards |
| 37 | **Feral Fangs** | `bestial-fangs` | Junk Rat (10% dud) + Iron Shell + Burrowing Mole (12s) | Clear triple card before 5 cards removed |
| 38 | **Savage Claws** | `claws` | Thieving Raven (-4s) + Swift Bee (50% faster) + Trap Weaver | Match 8 times total |
| 39 | **One-Eyed Terror** | `cyclops` | Masked Bandit + Shifting Chameleon (12s) + Foggy Frog (-55%) | Get 3 all-different matches |
| 40 | **Goblin Saboteur** | `goblin-head` | All counter effects at -50% (pick 3 random weapon types) | Trigger 3 different weapon effects |
| 41 | **Stone Sentinel** | `golem-head` | Iron Shell (×2 cards) + Spiny Hedgehog (-55%) + Shadow Bat (-55%) | Clear both triple cards |
| 42 | **Wicked Imp** | `imp` | Stinging Scorpion + Sneaky Mouse (-55%) + Lazy Sloth (-55%) | Achieve minimum with 3+ graces unused |
| 43 | **Swarming Ants** | `ant` | Trap Weaver (×2 bombs) + Wet Crab (-55%) + Ticking Viper (8s) | Defuse 5 bombs total |
| 44 | **Nightmare Squid** | `giant-squid` | Night Owl (35% face-down, 50% flip chance) + Wild Goose (15s) + Circling Vulture (6pts/sec) | Score 200% of target |
| 45 | **Ravenous Tapir** | `tapir` | Greedy Squirrel (2 cards per match) + Burrowing Mole (10s) + Swift Bee (40% faster) | Achieve minimum with 5+ cards remaining |
| 46 | **Merciless Porcupine** | `porcupine` | Punishing Ermine (3 cards per invalid) + Stinging Scorpion + Stalking Wolf (35s → **instant death**) | Make no invalid matches

---

### Tier 4 (Round 10 Only) — 5 Bosses
*Five combined effects, counters at 70-90% reduction, terrifying legend icons*
*Instant death mechanics at full intensity*

| # | Name | Icon | Effects (Combined) | Defeat Condition |
|---|------|------|-------------------|------------------|
| 47 | **Ancient Dragon** | `dragon-head` | Iron Shell (×3 cards) + Shifting Chameleon (8s) + Swift Bee (80% faster) + Stinging Scorpion + Circling Vulture (8pts/sec) | Clear all 3 triple cards AND get 2 all-different matches |
| 48 | **The Hydra** | `hydra` | Stalking Wolf (20s → **instant death**) + Trap Weaver (×3) + Ticking Viper (×2, 8s each) + Night Owl (40%) + Thieving Raven (-6s) | Match 10 times with no invalid matches |
| 49 | **Kraken's Grasp** | `kraken-tentacle` | Wild Goose (10s) + Burrowing Mole (8s) + Junk Rat (15% dud) + All counters -75% | Survive with 5+ cards remaining on board |
| 50 | **The Reaper** | `grim-reaper` | Sneaky Mouse (-90%) + Lazy Sloth (-90%) + Stinging Scorpion + Circling Vulture (10pts/sec) + Masked Bandit | Achieve minimum with 10+ seconds remaining AND 0 damage taken |
| 51 | **World Eater** | `daemon-skull` | Greedy Squirrel (3 cards per match) + Punishing Ermine (4 cards per invalid) + Burrowing Mole (6s) + Stalking Wolf (15s → **instant death**) + Swift Bee (100% faster) | Achieve minimum with 4+ cards remaining AND no invalid matches

---

## Effect Scaling Reference

Effects scale up in intensity through the tiers:

| Effect | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|--------|--------|--------|--------|--------|
| **Dud Chance** | 4% | 6% | 10% | 15% |
| **Inactivity Penalty** | Lose 1HP | Lose 1HP | Instant Death | Instant Death |
| **Attribute Flip Interval** | 20s | 15s | 12s | 8s |
| **Speed Increase** | 20% | 35% | 50% | 80-100% |
| **Countdown Timer** | 15s | 12s | 8-10s | 8s |
| **Face-Down Chance** | 5% | 10% | 15-20% | 30% |
| **Face-Down Flip Chance** | 70% | 60% | 50% | 40% |
| **Point Decay** | 5pts/sec | 3-4pts/sec | 4-6pts/sec | 8-10pts/sec |
| **Weapon Counters** | 10-20% | 30-40% | 50-60% | 70-90% |
| **Cards Removed on Match** | 1 | 1 | 2 | 3 |
| **Cards Removed on Invalid** | 2 | 2 | 3 | 4 |

---

## Enemy Selection Flow

1. **Before each round:** Player sees 3 random enemies from the current tier's pool
2. **Each enemy card shows:**
   - Name and icon
   - All active effects with exact values
   - Defeat condition and bonus reward
   - Difficulty indicator (based on how it interacts with your current build)
3. **Player chooses one** → Round begins with that enemy's effects active
4. **During round:**
   - Reach score target = Advance to next round
   - Complete defeat condition = Earn bonus weapon at level up
   - Round continues until timer ends (keep scoring for coins)
5. **Post-round:** If enemy was defeated, level-up screen shows bonus "Slayer Reward" weapon

---

## Weapon Counter Reference

Enemies can counter specific weapon categories. Here's what each counter affects:

| Counter Type | Weapons Affected |
|--------------|------------------|
| **Fire** | Flint Spark (fire spread chance) |
| **Explosion** | Blast Powder (explosion chance) |
| **Laser** | Prismatic Ray (laser chance) |
| **Hints** | Oracle Eye, Seeker Lens, Crystal Orb, Mystic Sight |
| **Graces** | Second Chance, Fortune Token |
| **Healing** | Life Vessel, Mending Charm |
| **Time** | Chrono Shard, Time Drop |
| **Board Size** | Field Stone, Growth Seed |
| **Holographic** | Prism Glass |

---

## Defeat Condition Categories

### Attribute Challenges
- "Get X all-different matches"
- "Get X all-same [color/shape] matches"
- "Match all 3 [shapes/colors] at least once"
- "Match 3 different colors in one set"

### Streak/Combo Goals
- "Get a X-match streak" (X consecutive matches with no invalid attempts)
- "Make no invalid matches"
- "Match X times with no grace used"

### Speed Challenges
- "Match X times in under Y seconds each"
- "Achieve minimum with X+ seconds remaining"
- "Get X matches without hesitating >Y seconds"

### Specific Patterns
- "Get X matches containing [shape]"
- "Defuse X bombs"
- "Match X face-down cards"
- "Clear the triple-health card"

### Unique/Hybrid
- "Take no damage AND trigger X weapon effects"
- "Score X% of target"
- "Survive with X+ cards remaining"

---

## Detailed Mechanic Rules

### Face-Down Card Behavior
- Face-down cards **cannot be selected** by the player
- Face-down cards **cannot be matched** (must be flipped first)
- **Any valid match** triggers a **70% flip chance for EACH face-down card** on the entire board
- When flipped, the card reveals its actual attributes (which were always there, just hidden)
- Visual: Card back with "?" symbol

### Dud Card Behavior
- Dud cards **cannot be selected** by the player
- Dud cards **cannot be matched**
- Duds count toward board size but are effectively dead space
- Visual: White/blank card, grayed out

### Card Removal Behavior
- Removed cards (Burrowing Mole, Greedy Squirrel, etc.) are **NOT replaced**
- Board shrinks permanently for that round
- **Minimum board size: 6 cards** - enemies stop removing cards at this threshold
- This creates real tension for card-removal enemies

### Timer Speed Multiplier
- `timerSpeedMultiplier` affects **actual game tick rate**
- A 1.2x multiplier means 1 real second = 1.2 game seconds
- This affects: timer countdown, score decay, bomb timers, burn timers, inactivity timers - everything
- UI shows speed badge (e.g., "1.2x") near the timer

---

## Implementation Notes

> **Full implementation details:** See [enemy-implementation.md](./enemy-implementation.md) for architecture, interfaces, code examples, and testing strategy.

### Required New Systems
1. **Enemy data structure** (types.ts) - EnemyInstance interface
2. **Enemy factory** (enemyFactory.ts) - createEnemy(), createDummyEnemy()
3. **Effect behaviors** (enemyEffects.ts) - Composable effect implementations
4. **Enemy selection screen** (EnemySelection.tsx) - Pre-round UI
5. **Round stats tracker** (RoundStats in types.ts)
6. **Defeat condition checker** (per-enemy implementation)
7. **Bonus reward integration** (LevelUp.tsx) - Slayer Reward

### Card States (New)
| State | Visual | Behavior |
|-------|--------|----------|
| **isDud** | White/blank, grayed out | Cannot be selected or matched |
| **isFaceDown** | Card back (? symbol) | Cannot be selected; any match triggers 70% flip chance per face-down card |
| **hasCountdown** | Urgent countdown timer | Must match before timer expires or lose HP |
| **hasBomb** | Bomb icon + countdown | Explodes (card removed) if not matched in time |
| **health > 1** | Health pips (●●●) | Needs multiple matches to clear |

### Icons Needed
All icons should already exist in `assets/icons/`. Verify and register any missing ones in `Icon.tsx`.

### Balancing Considerations
- Tier distribution ensures appropriate challenge scaling
- Counters never fully disable weapons (max 90% reduction)
- Defeat conditions are challenging but achievable
- Risk/reward is meaningful: harder enemies = better bonus weapons
- Instant death reserved for T3/T4 to avoid frustrating early game

---

## Total Enemy Count: 51

- **Tier 1:** 22 enemies
- **Tier 2:** 12 enemies
- **Tier 3:** 12 enemies
- **Tier 4:** 5 bosses
