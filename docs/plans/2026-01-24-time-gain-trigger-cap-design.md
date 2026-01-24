# Time Gain Trigger Cap System

## Overview

A per-round cap on how many times time can be gained, preventing infinite play while still rewarding time-gain builds. Includes mastery items to increase the cap and challenge legendaries that grant temporary bonuses.

## Core Mechanic

**New Cap Type:** `timeGainTriggers` - limits how many times time can be gained per round.

- **Default:** 5 triggers per round
- **Reset:** Counter resets to 0 at the start of each round
- **Behavior:** Once cap is reached, Time Drop weapons still roll but don't award time

### Why This Cap Exists

Without this cap, a player with high `timeGainChance` (40%) and good matching speed could play indefinitely - every 2-3 matches would add +10s, outpacing the timer. The trigger cap creates a natural ceiling while still rewarding time-gain builds for the first ~15-25 matches of a round.

## New Stats

```typescript
// PlayerStats additions
timeGainTriggerCap: number;           // Base cap (default 5), increased by mastery weapons

// Round-scoped state (resets each round)
timeGainTriggersThisRound: number;    // Current count
timeGainTriggerCapBonus: number;      // Temporary bonus from challenge legendaries
consecutiveInvalidMatches: number;    // For Desperate Measures tracking
```

**Effective cap formula:**
```
effectiveCap = timeGainTriggerCap + (mastery bonuses) + timeGainTriggerCapBonus
```

## Mastery Item

### Time Trigger Mastery (Rare, $15)

Increases the base trigger cap permanently.

| Field | Value |
|-------|-------|
| ID | `time-trigger-mastery` |
| Rarity | Rare |
| Price | $15 |
| Effect | +2 to time gain trigger cap per round |
| Icon | `lorc/hourglass` |
| Stacks | Yes, unlimited |

**Description:** "Increases max time gains per round by 2."
**Short Description:** "More time triggers per round"
**Flavor Text:** "Master the flow of time to squeeze more moments from each round."

## Challenge Legendary Items

Three unique legendary weapons that grant +5 to the trigger cap **temporarily for the current round** when specific challenges are achieved. Each can only trigger once per round.

### 1. Prismatic Perfection (Legendary, $40)

**Trigger:** Make an "all-different" match where every active attribute is different across the 3 cards.

| Field | Value |
|-------|-------|
| ID | `prismatic-perfection` |
| Rarity | Legendary |
| Price | $40 |
| Effect | +5 time gain trigger cap this round (temporary) |
| Icon | `lorc/rainbow-star` |
| Max Count | 1 (unique) |

**Description:** "All-different match grants +5 time triggers this round."
**Short Description:** "Perfect matches unlock time"
**Flavor Text:** "When every attribute aligns in opposition, time itself bends to your will."

### 2. Tabula Rasa (Legendary, $40)

**Trigger:** Completely clear the board (0 cards remaining).

| Field | Value |
|-------|-------|
| ID | `tabula-rasa` |
| Rarity | Legendary |
| Price | $40 |
| Effect | +5 time gain trigger cap this round (temporary) |
| Icon | `lorc/eraser` |
| Max Count | 1 (unique) |

**Description:** "Clearing the board grants +5 time triggers this round."
**Short Description:** "Board clear unlocks time"
**Flavor Text:** "A clean slate reveals hidden seconds."

### 3. Desperate Measures (Legendary, $40)

**Trigger:** Make 3 strictly consecutive invalid matches (any valid match resets counter to 0).

| Field | Value |
|-------|-------|
| ID | `desperate-measures` |
| Rarity | Legendary |
| Price | $40 |
| Effect | +5 time gain trigger cap this round (temporary) |
| Icon | `lorc/skull-crack` |
| Max Count | 1 (unique) |

**Description:** "3 consecutive invalid matches grants +5 time triggers this round."
**Short Description:** "Sacrifice health for time"
**Flavor Text:** "Sometimes you have to bleed to buy more seconds."

**Note:** Counter resets after triggering, allowing multiple triggers per round if player continues making consecutive invalid matches.

## Implementation

### Logic Flow

**On Valid Match:**
1. Reset `consecutiveInvalidMatches` to 0
2. Check for all-different match:
   - If player owns Prismatic Perfection AND hasn't triggered it this round → add +5 to `timeGainTriggerCapBonus`, mark as triggered
3. Check for board clear (0 cards):
   - If player owns Tabula Rasa AND hasn't triggered it this round → add +5 to `timeGainTriggerCapBonus`, mark as triggered
4. Roll time gain as normal
5. If time gain triggers AND `timeGainTriggersThisRound < effectiveCap`:
   - Grant time
   - Increment `timeGainTriggersThisRound`

**On Invalid Match:**
1. Increment `consecutiveInvalidMatches`
2. If `consecutiveInvalidMatches >= 3` AND player owns Desperate Measures:
   - Add +5 to `timeGainTriggerCapBonus`
   - Reset `consecutiveInvalidMatches` to 0 (can trigger again)

**On Round Start:**
1. Reset `timeGainTriggersThisRound` to 0
2. Reset `timeGainTriggerCapBonus` to 0
3. Reset `consecutiveInvalidMatches` to 0
4. Reset challenge legendary trigger flags

### Helper Functions

```typescript
// Check if all attributes are different across 3 cards
const isAllDifferentMatch = (cards: Card[], activeAttributes: AttributeName[]): boolean => {
  return activeAttributes.every(attr => {
    const values = cards.map(c => c[attr]);
    return new Set(values).size === 3;
  });
};

// Calculate effective cap for the round
const getEffectiveTimeGainTriggerCap = (
  player: Player,
  masteryCount: number,
  temporaryBonus: number
): number => {
  const baseCap = player.stats.timeGainTriggerCap ?? 5;
  return baseCap + (masteryCount * 2) + temporaryBonus;
};
```

## UI

### During Round
- Display time triggers used vs cap near timer: "Time: 3/5"
- Toast notification when challenge triggers: "Prismatic Perfection! +5 time triggers"

### Weapon Descriptions
- Time Trigger Mastery: Show "+2 time triggers/round" in stat effects
- Challenge legendaries: Clearly state trigger condition

## Balance Analysis

### Base Cap (5 triggers)
- At 40% time gain chance: ~2 triggers per 5 matches
- 5 triggers = ~12-15 matches to exhaust = +50s total time gained
- Combined with 60s base + Chrono Shards: skilled players reach ~2+ minutes but not infinite

### Mastery Stacking
- Each +2 is meaningful but not broken
- 3 Mastery items = 11 cap = ~100s potential time gain
- Requires significant weapon slot investment

### Challenge Difficulty
| Challenge | Difficulty | Risk |
|-----------|-----------|------|
| All-different | Rare (~1 in 79 for 3-attr, rarer for 4-5) | None |
| Board clear | Requires destruction build or small board | None |
| 3 consecutive invalid | Costs 3+ health | High |

### Maximum Theoretical Bonus
- All three legendaries = +15 temporary cap
- Extremely unlikely to trigger all three in one round
- Each requires different playstyle/build focus
