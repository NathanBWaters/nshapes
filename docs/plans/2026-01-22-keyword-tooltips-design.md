# Keyword Tooltip System Design

## Overview

Add an interactive tooltip system that underlines key game mechanics in descriptions. Users can tap underlined keywords to see explanations in a bottom sheet.

## Scope

**Screens affected:**
- Character Selection - character descriptions
- Weapon Shop - weapon descriptions and flavor text
- Level Up - weapon descriptions and flavor text

## Design Decisions

1. **Auto-detection** - Keywords are automatically detected from a centralized registry (no manual markup in descriptions)
2. **Dotted underline** - Subtle visual indicator that doesn't clutter the UI
3. **Bottom sheet** - Mobile-friendly tooltip display that slides up from bottom
4. **Brief + detailed** - Each tooltip shows a one-liner at top, detailed explanation below

## Component Architecture

### New Files

1. **`src/utils/keywords.ts`** - Keyword registry with definitions
2. **`src/components/KeywordText.tsx`** - Text component that renders keywords as tappable
3. **`src/components/KeywordTooltip.tsx`** - Bottom sheet tooltip display
4. **`src/context/KeywordContext.tsx`** - Context provider for tooltip state

### Integration

- `KeywordProvider` wraps app in `_layout.tsx`
- Replace `<Text>` with `<KeywordText>` in description areas
- Single `KeywordTooltip` instance at root level

## Keyword Registry Structure

```typescript
interface KeywordDefinition {
  terms: string[];      // Matching terms (case-insensitive)
  brief: string;        // One-sentence definition
  detailed: string;     // Full explanation
}
```

## Keywords to Define

**Core Mechanics:**
- SET / valid set / match
- Health / hearts
- Grace / graces
- Hints / hint / autohint
- Attributes

**Card Effects:**
- Fire / burning / ignite
- Holographic / holo
- Explosion / explode
- Laser
- Echo
- Ricochet
- Chain reaction

**Resources & Stats:**
- Coins / coin
- XP / experience
- Time / timer
- Board / field / field size
- Board growth
- Adjacent cards

**Weapon System:**
- Cap / effect cap
- Luck
- Rarity terms (Common, Rare, Epic, Legendary)
- Max health / max hints / max graces

## Matching Behavior

- Case-insensitive matching
- Whole-word only (prevents "grace" matching inside "disgrace")
- First match wins if terms overlap
- Keywords rendered with dotted underline style
