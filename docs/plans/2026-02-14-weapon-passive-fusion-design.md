# Weapon & Passive Fusion System Design

> Inspired by Ball Pit. Designed 2026-02-14.

## Overview

A complete overhaul of the weapon system introducing:
- **Slot limits**: 4 weapons + 4 passives (8 total)
- **Leveling**: All items level 1→2→3 (rarity removed)
- **Fusion**: Weapons can fuse at level 3 to create powerful combinations
- **Simplified economy**: Money for rerolls only, no shop

---

## Core System Architecture

### Slot System
- **4 weapon slots**: Aggressive, damage-dealing items that can fuse
- **4 passive slots**: Support, utility, reactive items that cannot fuse
- Hard limits create meaningful build choices

### Progression Axis
All items use **level 1 → 2 → 3**:
- **Level 1**: Base power
- **Level 2**: ~2x effectiveness
- **Level 3**: ~3x effectiveness, eligible for fusion (weapons only)

Levels provide incremental stat scaling only. Limitations remain constant across levels. Fusions are where limitations lift.

### Acquisition
- **Level ups** (XP-based, unchanged): Present 3 mixed options
  - New weapons (if <4 weapons)
  - New passives (if <4 passives)
  - Upgrades to owned items (if <level 3)
- **Contextual filtering**: If you have 4 weapons, only passives and weapon upgrades appear (vice versa)
- **Rerolls**: Cost coins (5 → 10 → 20 → 40...), resets each round

### Shop
Shop UI is hidden but code remains. Money is used exclusively for rerolls.

### Character Starts
Characters keep current starting pairs, classified as-is:
- **Sly Fox**: 2 weapons (Flint Spark + Blast Powder) - can fuse early
- **Orange Tabby**: 2 passives (Life Vessel + Mending Charm)
- **Corgi**: 2 passives (Field Stone + Growth Seed)
- **Pelican**: 2 passives (Oracle Eye + Oracle Eye)
- **Badger**: 2 passives (Second Chance + Fortune Token)
- **Emperor Penguin**: 2 passives (Crystal Orb + Seeker Lens)

---

## Classification

### Weapons (can fuse)
| Name | Effect | Limitation |
|------|--------|------------|
| Blast Powder | Explode adjacent cards | Only same-color cards |
| Flint Spark | Ignite adjacent cards | Fire only spreads to same-color |
| Prismatic Ray | Laser destroys row/column | One direction only |
| Chaos Shard | Ricochet chain destruction | Max 3 ricochets |
| Echo Stone | Auto-match another set | Echo doesn't trigger weapon effects |
| Link Stone | Connect positions | Max 3 connections |

### Passives (cannot fuse)
| Name | Effect |
|------|--------|
| Oracle Eye | Auto-hints when stuck |
| Field Stone | +Starting board size |
| Growth Seed | Board expands on match |
| Second Chance | +Starting graces |
| Fortune Token | Gain grace on match |
| Life Vessel | +Max health, heal |
| Mending Charm | Heal on match |
| Crystal Orb | +Max hints |
| Seeker Lens | Gain hint on match |
| Scholar's Tome | Gain XP on match |
| Fortune's Favor | Gain coins on match |
| Chrono Shard | +Starting time |
| Time Drop | Gain time on match |

---

## Base Weapons - Level Progression

Levels are incremental. Limitations stay constant.

### Blast Powder (Explosion)
| Level | Effect |
|-------|--------|
| 1 | 10% chance to explode adjacent cards |
| 2 | 20% chance |
| 3 | 30% chance |

**Limitation**: Only explodes cards matching your set's color

### Flint Spark (Fire)
| Level | Effect |
|-------|--------|
| 1 | 10% fire spread chance |
| 2 | 20% chance |
| 3 | 30% chance |

**Limitation**: Fire only spreads to same-color cards

### Prismatic Ray (Laser)
| Level | Effect |
|-------|--------|
| 1 | 5% chance to destroy row or column |
| 2 | 10% chance |
| 3 | 15% chance |

**Limitation**: Only fires in one direction (row OR column)

### Chaos Shard (Ricochet)
| Level | Effect |
|-------|--------|
| 1 | 10% initial, 5% chain chance |
| 2 | 20% initial, 10% chain |
| 3 | 30% initial, 15% chain |

**Limitation**: Max 3 ricochets per trigger

### Echo Stone (Auto-match)
| Level | Effect |
|-------|--------|
| 1 | 8% chance to auto-match |
| 2 | 15% chance |
| 3 | 22% chance |

**Limitation**: Echo doesn't trigger weapon effects

### Link Stone (Connector)
| Level | Effect |
|-------|--------|
| 1 | 15% chance to connect 2 positions |
| 2 | 25% chance |
| 3 | 35% chance |

**Limitation**: Max 3 connections active at once

---

## Base Passives - Level Progression

### Oracle Eye (Auto-hint)
| Level | Effect |
|-------|--------|
| 1 | 15% chance to reveal 1 hint card after 15s idle |
| 2 | 25% chance |
| 3 | 35% chance |

### Field Stone (Board Size)
| Level | Effect |
|-------|--------|
| 1 | +1 starting board size |
| 2 | +2 starting board size |
| 3 | +3 starting board size |

### Growth Seed (Board Growth)
| Level | Effect |
|-------|--------|
| 1 | 5% chance to add 1 card on match |
| 2 | 10% chance |
| 3 | 15% chance |

### Second Chance (Starting Graces)
| Level | Effect |
|-------|--------|
| 1 | +1 starting grace |
| 2 | +2 starting graces |
| 3 | +3 starting graces |

### Fortune Token (Grace Gain)
| Level | Effect |
|-------|--------|
| 1 | 5% chance to gain grace on match |
| 2 | 10% chance |
| 3 | 15% chance |

### Life Vessel (Max Health)
| Level | Effect |
|-------|--------|
| 1 | +1 max health, heal 1 |
| 2 | +2 max health, heal 2 |
| 3 | +3 max health, heal 3 |

### Mending Charm (Heal on Match)
| Level | Effect |
|-------|--------|
| 1 | 5% chance to heal on match |
| 2 | 10% chance |
| 3 | 15% chance |

### Crystal Orb (Max Hints)
| Level | Effect |
|-------|--------|
| 1 | +1 max hints |
| 2 | +2 max hints |
| 3 | +3 max hints |

### Seeker Lens (Hint Gain)
| Level | Effect |
|-------|--------|
| 1 | 5% chance to gain hint on match |
| 2 | 10% chance |
| 3 | 15% chance |

### Scholar's Tome (XP Gain)
| Level | Effect |
|-------|--------|
| 1 | 10% chance to gain +1 XP on match |
| 2 | 20% chance |
| 3 | 30% chance |

### Fortune's Favor (Coin Gain)
| Level | Effect |
|-------|--------|
| 1 | 10% chance to gain +1 coin on match |
| 2 | 20% chance |
| 3 | 30% chance |

### Chrono Shard (Starting Time)
| Level | Effect |
|-------|--------|
| 1 | +10s starting time |
| 2 | +20s starting time |
| 3 | +30s starting time |

### Time Drop (Time Gain)
| Level | Effect |
|-------|--------|
| 1 | 5% chance to gain +5s on match |
| 2 | 10% chance |
| 3 | 15% chance |

---

## Fusion System

### Fusion Gems
- Drop from matches, roughly 1 per 2-3 rounds
- Drop chance scales slightly with round number
- When collected, modal appears immediately

### Fusion Modal Options

**Option A - Fuse Weapons**
- Shows grid of level 3 weapons
- Select two to preview fusion result
- If <2 level 3 weapons: grayed out with "Need 2 level 3 weapons to fuse"

**Option B - Random Level Ups**
- Receive 1-5 level ups (random)
- Applied to random eligible items

### Fusion Mechanics
- **Input**: Two level 3 weapons
- **Output**: One Tier 1 fused weapon at level 1
- **Slot economy**: 2 slots → 1 slot (frees a slot)
- **Fused weapons can level**: 1 → 2 → 3

### Tier Structure
- **Tier 0**: Base weapons (6 types)
- **Tier 1**: Weapon + Weapon fusions (15 combinations)
- **Tier 2**: Fusion + Fusion (15 curated legendary pairs)

---

## Tier 1 Fusions (15 Total)

Each fusion combines both weapon identities and **lifts one or both limitations**.

### Blast Powder + Flint Spark = **Infernal Charge**
*Explosions ignite. Fire explodes.*
| Level | Effect |
|-------|--------|
| 1 | 15% explosion, 15% fire. Explosions set adjacent cards on fire. |
| 2 | 22% each |
| 3 | 30% each |

**Lifted**: Fire spreads to ANY color

---

### Blast Powder + Prismatic Ray = **Detonation Beam**
*Lasers trigger explosions along their path.*
| Level | Effect |
|-------|--------|
| 1 | 8% laser. Each card hit by laser has 25% explosion chance. |
| 2 | 12% laser, 35% explosion |
| 3 | 16% laser, 45% explosion |

**Lifted**: Explosions hit ANY card

---

### Blast Powder + Chaos Shard = **Shrapnel Storm**
*Ricochets cause explosions. Explosions ricochet.*
| Level | Effect |
|-------|--------|
| 1 | 15% ricochet (10% chain). Each ricochet hit explodes adjacent cards. |
| 2 | 22% ricochet (15% chain) |
| 3 | 30% ricochet (20% chain) |

**Lifted**: Max 6 ricochets instead of 3

---

### Blast Powder + Echo Stone = **Resonant Blast**
*Echo matches trigger explosions. Explosions can trigger echo.*
| Level | Effect |
|-------|--------|
| 1 | 12% echo, 15% explosion. Echo matches ALSO trigger explosion chance. |
| 2 | 18% echo, 22% explosion |
| 3 | 25% echo, 30% explosion |

**Lifted**: Echo now triggers weapon effects

---

### Blast Powder + Link Stone = **Chain Detonator**
*Connected cards explode together. Explosions create connections.*
| Level | Effect |
|-------|--------|
| 1 | 20% connection, 15% explosion. When connected card explodes, partner explodes too. |
| 2 | 28% connection, 22% explosion |
| 3 | 36% connection, 30% explosion |

**Lifted**: Max 5 connections instead of 3

---

### Flint Spark + Prismatic Ray = **Solar Flare**
*Lasers leave fire trails. Burning cards boost laser chance.*
| Level | Effect |
|-------|--------|
| 1 | 8% laser. All cards in laser path catch fire. |
| 2 | 12% laser |
| 3 | 16% laser |

**Lifted**: Laser can fire BOTH row and column

---

### Flint Spark + Chaos Shard = **Wildfire Shard**
*Ricochets spread fire. Fire increases ricochet chain chance.*
| Level | Effect |
|-------|--------|
| 1 | 15% ricochet. Each ricochet hit catches fire. +5% chain per burning card. |
| 2 | 22% ricochet, +8% per burning |
| 3 | 30% ricochet, +10% per burning |

**Lifted**: Fire spreads to ANY color

---

### Flint Spark + Echo Stone = **Blazing Echo**
*Echo matches spread fire. Fire boosts echo chance.*
| Level | Effect |
|-------|--------|
| 1 | 12% echo. Echo matches ignite all adjacent cards. +3% echo per burning card. |
| 2 | 18% echo, +5% per burning |
| 3 | 25% echo, +7% per burning |

**Lifted**: Echo triggers weapon effects

---

### Flint Spark + Link Stone = **Burning Bonds**
*Fire spreads instantly through connections.*
| Level | Effect |
|-------|--------|
| 1 | 20% connection, 15% fire. When connected card ignites, partner ignites instantly. |
| 2 | 28% connection, 22% fire |
| 3 | 36% connection, 30% fire |

**Lifted**: Max 5 connections instead of 3

---

### Prismatic Ray + Chaos Shard = **Prism Shatter**
*Lasers ricochet at the end. Ricochets can trigger lasers.*
| Level | Effect |
|-------|--------|
| 1 | 8% laser. After laser fires, 20% chance to ricochet from endpoint. |
| 2 | 12% laser, 30% ricochet |
| 3 | 16% laser, 40% ricochet |

**Lifted**: Max 6 ricochets instead of 3

---

### Prismatic Ray + Echo Stone = **Mirror Beam**
*Echo can trigger lasers. Laser kills count toward echo.*
| Level | Effect |
|-------|--------|
| 1 | 12% echo, 8% laser. Echo matches have full laser chance. |
| 2 | 18% echo, 12% laser |
| 3 | 25% echo, 16% laser |

**Lifted**: Echo triggers weapon effects

---

### Prismatic Ray + Link Stone = **Linked Annihilation**
*Laser hitting connected card also fires at partner's position.*
| Level | Effect |
|-------|--------|
| 1 | 20% connection, 8% laser. Laser on connected card triggers second laser at partner. |
| 2 | 28% connection, 12% laser |
| 3 | 36% connection, 16% laser |

**Lifted**: Laser fires BOTH directions

---

### Chaos Shard + Echo Stone = **Cascade Chaos**
*Ricochets can trigger echo. Echo can trigger ricochets.*
| Level | Effect |
|-------|--------|
| 1 | 12% echo, 15% ricochet. Every 3rd ricochet hit triggers echo check. |
| 2 | 18% echo, 22% ricochet |
| 3 | 25% echo, 30% ricochet |

**Lifted**: Echo triggers weapon effects

---

### Chaos Shard + Link Stone = **Chaotic Web**
*Ricochets prefer connected cards. Ricochet kills create new connections.*
| Level | Effect |
|-------|--------|
| 1 | 20% connection, 15% ricochet. Ricochet kills have 30% chance to create connection. |
| 2 | 28% connection, 22% ricochet, 40% on kill |
| 3 | 36% connection, 30% ricochet, 50% on kill |

**Lifted**: Max 6 ricochets, max 5 connections

---

### Echo Stone + Link Stone = **Resonant Link**
*Echoed matches auto-connect positions. Connected destructions boost echo.*
| Level | Effect |
|-------|--------|
| 1 | 12% echo, 20% connection. Echo matches auto-connect 2 matched positions. |
| 2 | 18% echo, 28% connection |
| 3 | 25% echo, 36% connection |

**Lifted**: Echo triggers weapon effects, max 5 connections

---

## Tier 2 Fusions (15 Legendary)

Require two level 3 Tier 1 fusions + fusion gem.

### 1. Infernal Charge + Detonation Beam = **Supernova**
*Fire + Explosion + Laser*
| Level | Effect |
|-------|--------|
| 1 | 12% laser. Laser path explodes AND ignites. Explosions chain to next row/column. |
| 2 | 18% laser |
| 3 | 25% laser, explosions chain twice |

---

### 2. Infernal Charge + Wildfire Shard = **Eternal Flame**
*Fire + Explosion + Ricochet*
| Level | Effect |
|-------|--------|
| 1 | Fire never stops spreading. 20% explosion on every burn. Burning cards ricochet on death. |
| 2 | 30% explosion |
| 3 | 40% explosion, ricochets guaranteed |

---

### 3. Detonation Beam + Solar Flare = **Extinction Ray**
*Laser + Explosion + Fire*
| Level | Effect |
|-------|--------|
| 1 | 15% laser. Fires CROSS pattern (row and column). Everything hit explodes and ignites. |
| 2 | 22% laser |
| 3 | 30% laser |

---

### 4. Shrapnel Storm + Prism Shatter = **Reality Fracture**
*Explosion + Ricochet + Laser*
| Level | Effect |
|-------|--------|
| 1 | 12% laser. Laser endpoint triggers 3 ricochets. Each ricochet explodes. Unlimited ricochets. |
| 2 | 18% laser, 4 ricochets |
| 3 | 25% laser, 5 ricochets |

---

### 5. Resonant Blast + Cascade Chaos = **Infinite Echo**
*Explosion + Echo + Ricochet*
| Level | Effect |
|-------|--------|
| 1 | 30% echo. Each echo can trigger another (15% recursive). All matches explode and ricochet. |
| 2 | 40% echo, 20% recursive |
| 3 | 50% echo, 25% recursive |

---

### 6. Chain Detonator + Chaotic Web = **Doom Network**
*Explosion + Link + Ricochet*
| Level | Effect |
|-------|--------|
| 1 | Start with 3 connections. Any destruction ripples through ALL connections. 25% new connection on kill. |
| 2 | Start with 4 connections |
| 3 | Start with 5 connections, unlimited connections |

---

### 7. Solar Flare + Mirror Beam = **Prismatic Inferno**
*Laser + Fire + Echo*
| Level | Effect |
|-------|--------|
| 1 | 15% laser (cross pattern). Fire trails trigger echo checks. Echo matches fire lasers. |
| 2 | 22% laser |
| 3 | 30% laser |

---

### 8. Blazing Echo + Burning Bonds = **Soul Pyre**
*Fire + Echo + Link*
| Level | Effect |
|-------|--------|
| 1 | All matches auto-connect. Connected cards share fire instantly. Echo +10% per connection. |
| 2 | +15% per connection |
| 3 | +20% per connection |

---

### 9. Wildfire Shard + Chaotic Web = **Plague Fire**
*Fire + Ricochet + Link*
| Level | Effect |
|-------|--------|
| 1 | Fire jumps to random cards (not just adjacent). Burning cards auto-connected. Unlimited spread. |
| 2 | Fire jumps to 2 random cards |
| 3 | Fire jumps to 3 random cards |

---

### 10. Linked Annihilation + Resonant Link = **Quantum Entanglement**
*Laser + Link + Echo*
| Level | Effect |
|-------|--------|
| 1 | Every match creates connection. Connections mirrored (triangles). Lasers duplicate to connected. |
| 2 | Create 2 connections per match |
| 3 | Echo triggers on every connection destruction |

---

### 11. Mirror Beam + Cascade Chaos = **Paradox Engine**
*Laser + Echo + Ricochet*
| Level | Effect |
|-------|--------|
| 1 | 25% echo. Echo fires mini-lasers (3 cards). Laser kills ricochet. Ricochets trigger echo. |
| 2 | 35% echo |
| 3 | 45% echo, full lasers |

---

### 12. Prism Shatter + Linked Annihilation = **Grid Eraser**
*Laser + Ricochet + Link*
| Level | Effect |
|-------|--------|
| 1 | 15% laser (cross). Connections double laser hits. Ricochet between all connected after laser. |
| 2 | 22% laser |
| 3 | 30% laser, triple on connected |

---

### 13. Burning Bonds + Chain Detonator = **Scorched Earth**
*Fire + Link + Explosion*
| Level | Effect |
|-------|--------|
| 1 | Fire spreads through connections instantly. Connected destruction explodes BOTH. Start with 2 connections. |
| 2 | Start with 3 connections |
| 3 | Start with 4 connections |

---

### 14. Resonant Blast + Blazing Echo = **Phoenix Storm**
*Explosion + Echo + Fire*
| Level | Effect |
|-------|--------|
| 1 | Destroyed cards 30% respawn as fire. Echoes always ignite. Explosions trigger echo check. |
| 2 | 40% respawn as fire |
| 3 | 50% respawn, fire cards explode on burn-out |

---

### 15. Shrapnel Storm + Chain Detonator = **Armageddon**
*Explosion + Ricochet + Link*
| Level | Effect |
|-------|--------|
| 1 | Explosions ricochet. Ricochets explode. Connections multiply both. Start with 2 connections. Unlimited ricochets. |
| 2 | Start with 3 connections |
| 3 | Start with 4 connections, explosions chain twice |

---

## UI Components

### Fusion Gem Modal
- **Header**: "FUSION GEM" with sparkle animation
- **Option A**: Fuse (shows eligible weapons, preview result)
- **Option B**: Random Level Ups (1-5 mystery)
- Fusion grayed out if <2 level 3 weapons

### Fusion Animation
1. Two cards fly to center
2. Collision with particle burst
3. New fusion emerges, rotates
4. Stats appear with flourishes
5. Card flies to inventory

### Level Up Screen
- 3 mixed options (new items + upgrades)
- Upgrades show "Blast Powder Lv.2 ↑"
- Reroll button with escalating cost
- Contextual filtering based on slots

### Inventory Display
**In-game HUD**:
```
[W1][W2][W3][W4] | [P1][P2][P3][P4]
```
- Level indicator per slot
- Fusion items have distinct border
- Empty slots show placeholder

---

## Data Model

### Weapon Type
```typescript
interface Weapon {
  id: string;
  name: string;
  type: 'weapon' | 'passive';
  level: 1 | 2 | 3;
  fusionTier?: 0 | 1 | 2;
  fusionParents?: [string, string];
  effects: {
    1: WeaponEffects;
    2: WeaponEffects;
    3: WeaponEffects;
  };
  limitation?: string;
  description: string;
  shortDescription: string;
  icon: IconName;
}
```

### Player Inventory
```typescript
interface PlayerInventory {
  weapons: (Weapon | null)[];  // Length 4
  passives: (Weapon | null)[]; // Length 4
}
```

### Fusion Registry
```typescript
interface FusionRecipe {
  inputs: [string, string];
  output: string;
  tier: 1 | 2;
}
```

---

## Removed Content

### Removed Entirely
- All Mastery weapons (cap increases built into levels)
- Rarity variants (rare/epic/legendary versions)
- Challenge legendaries
- Shop UI (code kept, hidden)

### Migrated to Fusions
- Bridge weapons become fusion effects
- Connector variants consolidated to Link Stone

---

## Design Principles

1. **Levels are incremental**: 10% → 20% → 30%, not power spikes
2. **Limitations stay constant**: Only fusions lift limitations
3. **Fusions are the power unlock**: Better than sum of parts
4. **Rounds are fresh starts**: Nothing persists between rounds
5. **Slots create choices**: 4+4 limit forces build identity
6. **Money is for rerolls**: Simple economy, no shop complexity
