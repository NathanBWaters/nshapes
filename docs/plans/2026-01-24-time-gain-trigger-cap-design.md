# Time Gain Trigger Cap System - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a per-round cap on time gain triggers to prevent infinite play, with mastery items to increase the cap and challenge legendaries that grant temporary bonuses.

**Architecture:** Track time gain triggers in `useRoundStats` hook (resets each round). Add new weapons to `gameDefinitions.ts`. Modify `weaponEffects.ts` to check trigger cap before awarding time. Challenge legendary logic in `Game.tsx` where matches are processed.

**Tech Stack:** React, TypeScript, existing weapon/stats system

---

## Task 1: Add Time Gain Trigger Tracking to RoundStats

**Files:**
- Modify: `src/types/enemy.ts` (add fields to RoundStats)
- Modify: `src/hooks/useRoundStats.ts` (add tracking functions)

**Step 1: Add fields to RoundStats interface**

In `src/types/enemy.ts`, add to the `RoundStats` interface:

```typescript
// Time gain trigger tracking
timeGainTriggersThisRound: number;
timeGainTriggerCapBonus: number;  // Temporary bonus from challenge legendaries
consecutiveInvalidMatches: number;

// Challenge legendary trigger flags (prevent multiple triggers per round)
prismaticPerfectionTriggered: boolean;
tabulaRasaTriggered: boolean;
```

**Step 2: Initialize new fields in createInitialRoundStats**

In `src/hooks/useRoundStats.ts`, add to `createInitialRoundStats`:

```typescript
// Time gain trigger tracking
timeGainTriggersThisRound: 0,
timeGainTriggerCapBonus: 0,
consecutiveInvalidMatches: 0,

// Challenge legendary trigger flags
prismaticPerfectionTriggered: false,
tabulaRasaTriggered: false,
```

**Step 3: Add tracking functions to useRoundStats**

Add these functions before the return statement:

```typescript
/**
 * Record a time gain trigger (increment counter)
 */
const recordTimeGainTrigger = useCallback(() => {
  statsRef.current.timeGainTriggersThisRound += 1;
}, []);

/**
 * Get current time gain triggers this round
 */
const getTimeGainTriggers = useCallback((): number => {
  return statsRef.current.timeGainTriggersThisRound;
}, []);

/**
 * Add temporary bonus to time gain trigger cap (from challenge legendaries)
 */
const addTimeGainTriggerCapBonus = useCallback((amount: number) => {
  statsRef.current.timeGainTriggerCapBonus += amount;
}, []);

/**
 * Get current time gain trigger cap bonus
 */
const getTimeGainTriggerCapBonus = useCallback((): number => {
  return statsRef.current.timeGainTriggerCapBonus;
}, []);

/**
 * Increment consecutive invalid matches counter
 */
const incrementConsecutiveInvalidMatches = useCallback(() => {
  statsRef.current.consecutiveInvalidMatches += 1;
}, []);

/**
 * Reset consecutive invalid matches counter (on valid match)
 */
const resetConsecutiveInvalidMatches = useCallback(() => {
  statsRef.current.consecutiveInvalidMatches = 0;
}, []);

/**
 * Get consecutive invalid matches count
 */
const getConsecutiveInvalidMatches = useCallback((): number => {
  return statsRef.current.consecutiveInvalidMatches;
}, []);

/**
 * Mark Prismatic Perfection as triggered
 */
const markPrismaticPerfectionTriggered = useCallback(() => {
  statsRef.current.prismaticPerfectionTriggered = true;
}, []);

/**
 * Check if Prismatic Perfection already triggered this round
 */
const isPrismaticPerfectionTriggered = useCallback((): boolean => {
  return statsRef.current.prismaticPerfectionTriggered;
}, []);

/**
 * Mark Tabula Rasa as triggered
 */
const markTabulaRasaTriggered = useCallback(() => {
  statsRef.current.tabulaRasaTriggered = true;
}, []);

/**
 * Check if Tabula Rasa already triggered this round
 */
const isTabulaRasaTriggered = useCallback((): boolean => {
  return statsRef.current.tabulaRasaTriggered;
}, []);
```

**Step 4: Add to return statement**

```typescript
return {
  // ... existing returns ...
  recordTimeGainTrigger,
  getTimeGainTriggers,
  addTimeGainTriggerCapBonus,
  getTimeGainTriggerCapBonus,
  incrementConsecutiveInvalidMatches,
  resetConsecutiveInvalidMatches,
  getConsecutiveInvalidMatches,
  markPrismaticPerfectionTriggered,
  isPrismaticPerfectionTriggered,
  markTabulaRasaTriggered,
  isTabulaRasaTriggered,
};
```

**Step 5: Commit**

```bash
git add src/types/enemy.ts src/hooks/useRoundStats.ts
git commit -m "feat: add time gain trigger tracking to round stats"
```

---

## Task 2: Add Time Gain Trigger Cap to PlayerStats and Config

**Files:**
- Modify: `src/types.ts` (add to PlayerStats)
- Modify: `src/utils/gameConfig.ts` (add default)
- Modify: `src/utils/gameDefinitions.ts` (add to DEFAULT_PLAYER_STATS)

**Step 1: Add to PlayerStats in types.ts**

After `timeGainAmount`, add:

```typescript
timeGainTriggerCap: number;         // Max time gains per round (default 5)
```

**Step 2: Add default in gameConfig.ts**

In `STARTING_STATS`, add:

```typescript
timeGainTriggerCap: 5, // Max time gains per round
```

**Step 3: Add to DEFAULT_PLAYER_STATS in gameDefinitions.ts**

Add:

```typescript
timeGainTriggerCap: STARTING_STATS.timeGainTriggerCap,
```

**Step 4: Commit**

```bash
git add src/types.ts src/utils/gameConfig.ts src/utils/gameDefinitions.ts
git commit -m "feat: add timeGainTriggerCap to player stats (default 5)"
```

---

## Task 3: Add the Four New Weapons

**Files:**
- Modify: `src/utils/gameDefinitions.ts` (add weapons to WEAPONS array)
- Modify: `src/types.ts` (add weapon names to WeaponName type)

**Step 1: Add weapon names to WeaponName type in types.ts**

Update the WeaponName type to include:

```typescript
| 'Time Trigger Mastery' | 'Prismatic Perfection' | 'Tabula Rasa' | 'Desperate Measures'
```

**Step 2: Add weapons to WEAPONS array in gameDefinitions.ts**

Add after the existing mastery weapons section:

```typescript
// ============================================================================
// TIME TRIGGER MASTERY - Increases time gain trigger cap per round
// ============================================================================
{
  id: 'time-trigger-mastery',
  name: 'Time Trigger Mastery',
  rarity: 'rare',
  level: 1,
  price: 15,
  description: 'Increases max time gains per round by 2.',
  shortDescription: 'More time triggers per round',
  flavorText: 'Master the flow of time to squeeze more moments from each round.',
  icon: 'lorc/hourglass',
  specialEffect: 'capIncrease',
  effects: {},
  capIncrease: { type: 'timeGain', amount: 2 },
},

// ============================================================================
// CHALLENGE LEGENDARIES - Temporary time trigger cap bonuses
// ============================================================================
{
  id: 'prismatic-perfection',
  name: 'Prismatic Perfection',
  rarity: 'legendary',
  level: 1,
  price: 40,
  description: 'All-different match: increase the max number of time gains on match you can have for that round by 5. Can only be done once per round.',
  shortDescription: 'Perfect matches unlock time',
  flavorText: 'When every attribute aligns in opposition, time itself bends to your will.',
  icon: 'lorc/rainbow-star',
  specialEffect: 'challengeLegendary',
  effects: {},
  maxCount: 1,
},
{
  id: 'tabula-rasa',
  name: 'Tabula Rasa',
  rarity: 'legendary',
  level: 1,
  price: 40,
  description: 'Clear the board: increase the max number of time gains on match you can have for that round by 5. Can only be done once per round.',
  shortDescription: 'Board clear unlocks time',
  flavorText: 'A clean slate reveals hidden seconds.',
  icon: 'lorc/eraser',
  specialEffect: 'challengeLegendary',
  effects: {},
  maxCount: 1,
},
{
  id: 'desperate-measures',
  name: 'Desperate Measures',
  rarity: 'legendary',
  level: 1,
  price: 40,
  description: '3 consecutive invalid matches: increase the max number of time gains on match you can have for that round by 10. Can trigger multiple times.',
  shortDescription: 'Sacrifice health for time',
  flavorText: 'Sometimes you have to bleed to buy more seconds.',
  icon: 'lorc/skull-crack',
  specialEffect: 'challengeLegendary',
  effects: {},
  maxCount: 1,
},
```

**Step 3: Add 'challengeLegendary' to specialEffect type in types.ts**

Update the Weapon interface's specialEffect union type to include:

```typescript
specialEffect?: 'explosive' | 'autoHint' | 'enhancedHint' | 'boardGrowth' | 'fire' | 'graceGain' | 'healing' | 'hintGain' | 'xpGain' | 'coinGain' | 'timeGain' | 'laser' | 'ricochet' | 'echo' | 'chainReaction' | 'capIncrease' | 'bridge' | 'challengeLegendary';
```

**Step 4: Commit**

```bash
git add src/utils/gameDefinitions.ts src/types.ts
git commit -m "feat: add time trigger mastery and challenge legendary weapons"
```

---

## Task 4: Register New Icons

**Files:**
- Modify: `src/components/Icon.tsx` (add icon imports and registry entries)

**Step 1: Check if icons exist and add to registry**

Add imports at top:

```typescript
import RainbowStar from '../../assets/icons/lorc/rainbow-star.svg';
import Eraser from '../../assets/icons/lorc/eraser.svg';
import SkullCrack from '../../assets/icons/lorc/skull-crack.svg';
```

Add to ICON_REGISTRY:

```typescript
'lorc/rainbow-star': RainbowStar,
'lorc/eraser': Eraser,
'lorc/skull-crack': SkullCrack,
```

Note: `lorc/hourglass` should already be registered. If not, add it too.

**Step 2: Commit**

```bash
git add src/components/Icon.tsx
git commit -m "feat: register icons for challenge legendary weapons"
```

---

## Task 5: Modify weaponEffects.ts to Check Trigger Cap

**Files:**
- Modify: `src/utils/weaponEffects.ts`

**Step 1: Update processWeaponEffects signature**

Add new parameters for trigger cap checking:

```typescript
export const processWeaponEffects = (
  board: Card[],
  matchedCards: Card[],
  playerStats: PlayerStats,
  weapons?: Weapon[],
  activeAttributes?: AttributeName[],
  isEchoMatch: boolean = false,
  timeGainContext?: {
    triggersThisRound: number;
    effectiveCap: number;
  }
): WeaponEffectResult => {
```

**Step 2: Add timeGainTriggered to result interface**

In WeaponEffectResult interface, add:

```typescript
timeGainTriggered: boolean;  // Whether time gain actually triggered (for tracking)
```

Initialize in result object:

```typescript
timeGainTriggered: false,
```

**Step 3: Modify time gain logic**

Replace the time gain section (around line 469) with:

```typescript
// Time gain chance - respects per-round trigger cap
if (effectiveTimeGainChance > 0 && Math.random() * 100 < effectiveTimeGainChance) {
  // Check if we're under the trigger cap
  const canTrigger = !timeGainContext ||
    timeGainContext.triggersThisRound < timeGainContext.effectiveCap;

  if (canTrigger) {
    result.bonusTime = playerStats.timeGainAmount || 10;
    result.timeGainTriggered = true;
    result.notifications.push(`+${result.bonusTime}s`);
  }
  // If over cap, the roll happened but no time awarded (could add notification)
}
```

**Step 4: Commit**

```bash
git add src/utils/weaponEffects.ts
git commit -m "feat: add time gain trigger cap checking to weapon effects"
```

---

## Task 6: Wire Up Challenge Legendaries in Game.tsx

**Files:**
- Modify: `src/components/Game.tsx`

**Step 1: Destructure new functions from useRoundStats**

In the existing destructuring, add:

```typescript
const {
  statsRef: roundStatsRef,
  resetStats: resetRoundStats,
  recordValidMatch,
  recordInvalidMatch,
  recordGraceUsed,
  recordHintUsed,
  recordDamage,
  // ... existing ...
  recordTimeGainTrigger,
  getTimeGainTriggers,
  addTimeGainTriggerCapBonus,
  getTimeGainTriggerCapBonus,
  incrementConsecutiveInvalidMatches,
  resetConsecutiveInvalidMatches,
  getConsecutiveInvalidMatches,
  markPrismaticPerfectionTriggered,
  isPrismaticPerfectionTriggered,
  markTabulaRasaTriggered,
  isTabulaRasaTriggered,
} = useRoundStats();
```

**Step 2: Create helper to calculate effective time gain trigger cap**

Add this helper function:

```typescript
// Calculate effective time gain trigger cap
const getEffectiveTimeGainTriggerCap = useCallback((player: Player): number => {
  const totalStats = calculatePlayerTotalStats(player);
  const baseCap = totalStats.timeGainTriggerCap || 5;

  // Count Time Trigger Mastery weapons (each adds +2)
  const masteryCount = player.weapons.filter(w => w.id === 'time-trigger-mastery').length;
  const masteryBonus = masteryCount * 2;

  // Get temporary bonus from challenge legendaries
  const challengeBonus = getTimeGainTriggerCapBonus();

  return baseCap + masteryBonus + challengeBonus;
}, [getTimeGainTriggerCapBonus]);
```

**Step 3: Modify handleValidMatch to check challenge legendaries**

In handleValidMatch (or wherever valid matches are processed), after the match is confirmed valid:

```typescript
// Reset consecutive invalid matches on valid match
resetConsecutiveInvalidMatches();

// Check for Prismatic Perfection (all-different match)
const hasPrismaticPerfection = state.player.weapons.some(w => w.id === 'prismatic-perfection');
if (hasPrismaticPerfection && !isPrismaticPerfectionTriggered()) {
  // Check if this is an all-different match
  const isAllDifferent = state.activeAttributes.every(attr => {
    const values = matchedCards.map(c => c[attr as keyof Card]);
    return new Set(values).size === 3;
  });

  if (isAllDifferent) {
    addTimeGainTriggerCapBonus(5);
    markPrismaticPerfectionTriggered();
    setNotification({ message: 'Prismatic Perfection! +5 time triggers', type: 'success' });
  }
}

// Check for Tabula Rasa (board clear)
const hasTabulaRasa = state.player.weapons.some(w => w.id === 'tabula-rasa');
if (hasTabulaRasa && !isTabulaRasaTriggered()) {
  // Board will be empty after removing matched cards
  const remainingCards = state.board.length - matchedCards.length;
  if (remainingCards === 0) {
    addTimeGainTriggerCapBonus(5);
    markTabulaRasaTriggered();
    setNotification({ message: 'Tabula Rasa! +5 time triggers', type: 'success' });
  }
}
```

**Step 4: Modify handleInvalidMatch to check Desperate Measures**

In handleInvalidMatch, after incrementing the invalid match counter:

```typescript
// Increment consecutive invalid matches
incrementConsecutiveInvalidMatches();

// Check for Desperate Measures (3 consecutive invalid matches)
const hasDesperateMeasures = state.player.weapons.some(w => w.id === 'desperate-measures');
if (hasDesperateMeasures && getConsecutiveInvalidMatches() >= 3) {
  addTimeGainTriggerCapBonus(10);
  resetConsecutiveInvalidMatches(); // Reset so it can trigger again
  setNotification({ message: 'Desperate Measures! +10 time triggers', type: 'success' });
}
```

**Step 5: Pass trigger cap context to processWeaponEffects calls**

Wherever processWeaponEffects is called, add the context:

```typescript
const timeGainContext = {
  triggersThisRound: getTimeGainTriggers(),
  effectiveCap: getEffectiveTimeGainTriggerCap(state.player),
};

const weaponEffects = processWeaponEffects(
  cards,
  newSelectedCards,
  playerStats,
  weapons,
  activeAttributes,
  false,
  timeGainContext
);

// After processing, if time was gained, record the trigger
if (weaponEffects.timeGainTriggered) {
  recordTimeGainTrigger();
}
```

**Step 6: Commit**

```bash
git add src/components/Game.tsx
git commit -m "feat: wire up challenge legendaries and time gain trigger cap in Game.tsx"
```

---

## Task 7: Update GameBoard.tsx to Pass Trigger Context

**Files:**
- Modify: `src/components/GameBoard.tsx`

**Step 1: Add props for time gain context**

Add to GameBoardProps:

```typescript
timeGainContext?: {
  triggersThisRound: number;
  effectiveCap: number;
};
onTimeGainTriggered?: () => void;
```

**Step 2: Pass context to processWeaponEffects calls**

Update all calls to processWeaponEffects in GameBoard.tsx to include the context.

**Step 3: Call onTimeGainTriggered callback when time is gained**

After processing weapon effects, check if time was triggered:

```typescript
if (weaponEffects.timeGainTriggered && onTimeGainTriggered) {
  onTimeGainTriggered();
}
```

**Step 4: Commit**

```bash
git add src/components/GameBoard.tsx
git commit -m "feat: pass time gain trigger context through GameBoard"
```

---

## Task 8: Final Integration and Testing

**Step 1: Run typecheck**

```bash
npm run typecheck
```

**Step 2: Test in dev mode**

1. Open `/dev/play`
2. Add Time Drop weapons via dev tools
3. Add a challenge legendary (may need to add to dev tools)
4. Verify time gain stops after 5 triggers
5. Verify challenge legendaries grant bonus
6. Verify Desperate Measures triggers on 3 consecutive invalid matches

**Step 3: Commit all changes with version bump**

Update version in package.json, then:

```bash
git add -A
git commit -m "feat: complete time gain trigger cap system

- Add per-round cap on time gain triggers (default 5)
- Add Time Trigger Mastery weapon (+2 cap per round)
- Add Prismatic Perfection legendary (+5 on all-different match)
- Add Tabula Rasa legendary (+5 on board clear)
- Add Desperate Measures legendary (+10 on 3 consecutive invalid matches)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```
