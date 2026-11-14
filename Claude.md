# NShapes

A roguelike deckbuilding match-three puzzle game for iOS, Android, and Web, built with Expo/React Native.

## Game Overview

NShapes combines the classic SET card matching game with roguelike progression mechanics. The game offers two modes: **Adventure Mode** (a map-based campaign where every level teaches one new mechanic) and **Free Play** (a customizable practice mode).

### Core Mechanics

**Card Attributes:** Cards are defined by up to **5 attributes**, each with 3 possible values:

1. **Shape** (Diamond, Squiggle, Oval)
2. **Color** (Red, Green, Purple)
3. **Number** (1, 2, 3)
4. **Shading** (Solid, Striped, Open)
5. **Background Color** (High-contrast variants)

**The SET Rule:** A valid match requires 3 cards where **each active attribute** is either **all the same** OR **all different** across the three cards.

**Invalid Match Mechanic:** When a player selects 3 cards that do NOT form a valid SET:
* If player has graces AND exactly 1 attribute is wrong: Auto-use grace (saves 1 health)
* If 2+ attributes are wrong OR no graces: The player loses 1 health (heart)
* The 3 selected cards are **removed** from the board and replaced with new cards
* This creates a strategic "sacrifice" option—stuck players can spend health to cycle in new cards

**Grace System:** Graces are a "near-miss" protection. When only 1 attribute breaks the SET rule, a grace is consumed instead of losing health. If 2+ attributes are wrong, it's a full miss and health is lost regardless of graces.

### Game Modes

**Adventure Mode** - Map campaign (Angry Birds / Bloons map + Vampire Survivors meta-progression):

> **Full documentation:** [docs/adventure-design.md](./docs/adventure-design.md) and the v3 build spec [docs/adventure-v3-design.md](./docs/adventure-v3-design.md). All code lives in `src/adventure/` and is **data-driven**: edit `src/adventure/data/*.ts`, not the engine.

* A tappable map of 5 star-gated worlds (8 / 9 / 10 / 11 / 5 main levels) with **secret side paths** (`branchOf`, which can chain): a side path is not on the map at all until it opens (★★ on its parent, or its own `opensAt`), then it is revealed after the result and draws itself onto the map once. Side paths are elites, **fighter trials** that teach a newly recruited fighter, or practice. Each node opens a preview: foe, difficulty, star goals, rewards, fighter, charm and Arcana loadout, armed evolutions and hazards.
* **The Back Field (1-4D):** the surprise behind 1-4. Any clear of 1-4 opens a Training Dummy with endless health, no clock and no move limit (`rules.sandbox`): hearts refill, everything learned so far is on, nothing is banked, and the player leaves with Done. It lives in `PRACTICE_LEVELS`, outside the campaign's `LEVELS`.
* **One new mechanic per level**, and the level that introduces a mechanic rewards *using* it: its ★★★ challenge asks for it (e.g. "use 3 hints") and its ★★ reward makes that easier. Teaching uses lesson cards, "Is this a Set?" checks and in-fight tips that pause until accepted. 1-1 is bare: 2 traits, no gear, can't be lost.
* **Shading Surge (Worlds 3–5):** boards play on 3 traits with every card solid; every 45s of clock, shading switches on for 15s and every Set's base damage is ×5 (3 → 15; "next Set ×2" etc. stack on top). Background is not used in Adventure. Numbers in `SURGE_RULES` (`src/adventure/data/rules.ts`).
* **Stars:** ★ survive · ★★ knock out every foe · ★★★ knock out + challenge (1-1 scores accuracy). Stars are also the skill-tree currency (spent stars never re-lock worlds).
* **Rewards:** every star pays coins; some also unlock a weapon, fighter, Arcana, evolution recipe or campaign system, hidden as a silhouette until earned.
* **One rule vocabulary** (`src/adventure/rules/types.ts`, interpreted by `rules/engine.ts`): fighter passives, skill-tree nodes, adventure weapons, evolutions and Arcana are all data written as `Rule` (trigger + conditions + effects) and `Modifiers`, so any source can chain into any other (a heal can cause an explosion, an explosion can add a Combo step).
* **Fighters** (`data/fighters.ts`, `data/passives.ts`): no starting gear; each has two passives that change how you play (e.g. Sly Fox: Combo + Hot Streak; Badger: Grudge + Thick Hide).
* **Skill trees** (`data/skillTrees.ts`): Clair Obscur–style webs, 23–24 nodes per fighter in a unique shape (paw, lightning tail, burrows, snowflake, bone, braided waves). Buy any node linked to one you own (or to a passive) with stars; every fighter spends every star earned (no shared pool), and a full tree costs `TREE_BUDGET` = campaign stars − 8 (160 of 168), derived from the level list so adding levels scales costs; branches fork and rejoin; one capstone per fighter is sealed until 56★ earned. Refunds are free (single nodes when nothing hangs off them, or the whole fighter).
* **Charms & Arcana:** charms are your whole weapon loadout, 3 slots (up to 6 with the Workshop's Charm Belt). Arcana: 1 slot (up to 3 with Tarot Deck); stacked Arcana combine.
* **Evolutions** (`data/evolutions.ts`, `data/evolutionPairs.ts`): **4 per Armory weapon (156)**. 9 signature recipes arm from two weapon families and are taught by stars (the first at 1-3); the other 147 each arm from one exact pair of weapons and are discovered by forging them (once any recipe is known, every recipe arms from its weapons). Each has its own twist (finales, cashing in hints/graces, gold/power conversion, free mistakes, board cleanses, scaling damage), not just "A also does B". Refills may spawn the Catalyst card (chance = evolution likelihood, raised by Evolution Lab and Catalyst Prism); matching it starts a 20 s power state. Up to 3 per fight, several can overlap. `__tests__/adventureEvolutions.test.ts` keeps the roster honest.
* **Long rounds from World 2:** foes have double HP and clocks double time (`LONG_ROUNDS` in `data/levels.ts`), so builds have time to snowball.
* **Hazards** (`LevelRules.hazards`): Time Bombs (match before the fuse runs out) from 1-7, Snares (matching it hurts; matching the card its arrow points at defuses it) from 2-2.
* **Coins** drop from matches, bank even on a loss (not on retreat), and are spent mid-run (shop between waves) or at **Camp** (Workshop upgrades and weapon upgrades).
* Adventure-only weapons (`data/adventureWeapons.ts`, e.g. War Drum, Amplifier Coil, Piñata) join the Armory through `getArmoryWeapon`; Free Play doesn't use them.
* **Weapons in Adventure:** every weapon does something visible alone at level 1, support weapons also hit the foe, and weapons that react to another effect bring a little of it themselves. Adventure's numbers for the shared weapons live in `src/adventure/data/weaponTuning.ts` (Free Play's stay in `gameDefinitions.ts`).
* **Trick weapons** (`src/adventure/engine/gear.ts`): Magnet, Bounty Poster, Mirror Shard, Odd One Out, Collector's Album, Snowball, Glass Sword, Devil's Bargain, Tightrope, Wild Card, Understudy, Encore Mask, and the **board gambles** that make the board harder for a bigger payoff: Cursed Idol, Chain Gang, Thorn Bush, Rust, Tar Pit, Decoy, Long Fuse, Ice Block, Greedy Chest, Hot Potato, Twin Seed, Fog Lantern. Live state shows as HUD chips or small card icons (Decoy is unmarked on purpose). Each sits in 3 evolution recipes.
* **Balance system** ([docs/balance-system.md](./docs/balance-system.md)): `src/adventure/balance/` measures every weapon and recipe as a with/without counterfactual at three stages and three skill tiers, against bands in `balance/targets.ts`. After changing a weapon, recipe or rule: run `npx jest __tests__/adventureBalanceLab.test.ts`, then `npm run balance:report` (writes `docs/balance-report.md`), then `npm run balance:levels`, and `npm run balance:tune` if levels drifted.
* **Evolutions:** matching the Catalyst hits the foe for 10 and starts 30 seconds in which every Set deals ×1.5 and +2, on top of the recipe's own rules.
* Balance is checked by headless bots: `ADVENTURE_BALANCE_REPORT=1 npx jest __tests__/adventureBalance.test.ts`. `__tests__/adventureBuilds.test.ts` checks that no build runs away and that no evolution is a dead pick. They play every level as two players (see [balance-philosophy.md](./docs/balance-philosophy.md)): a **bare** player (no stars, coins or recipe chasing; target wins 50/30/10/0/0% by world) and an **invested** one (every star, the Workshop maxed, a solid recipe build; 97/90/80/70/50%). `__tests__/adventureBuilds.test.ts` sweeps every weapon pair, evolution, full tree and random endgame build for broken combinations.
* The legacy 10-round adventure flow is still in `Game.tsx` but is no longer reachable from the main menu.

**Free Play Mode** - Relaxed Practice:

* **Difficulty Selector:** Choose the number of active attributes before starting:
* **Easy:** 2 Attributes
* **Medium:** 3 Attributes
* **Hard:** 4 Attributes
* **Omega Brained:** 5 Attributes

* No timer, no score targets—continuous endless gameplay.

## Weapon System

> **Full documentation:** [specs/weapons-design.md](./specs/weapons-design.md)

The `WEAPONS` array in `src/utils/gameDefinitions.ts` is the roster (34 weapons). **One item per weapon, and each does one thing:** combinations of two effects are evolutions, not items (Entropy Engine is now an evolution). Adventure has no rarities: every weapon starts solid at level 1 and grows two ways (`src/adventure/data/weaponStats.ts`): **levels 1-5 are found in the world** (repeat star/bounty rewards; each adds the flat `perLevel` gain to every number), and **Workshop tuning** multiplies one number (×1.1/×1.2/×1.35/×1.5). Old saves map removed ids through `LEGACY_WEAPON_IDS`.

**Key Mechanics:**
* **Stacking:** In Free Play, copies of the same weapon stack additively (3x 10% = 30%). Adventure fights never offer a weapon you already hold
* **Independent Rolls:** Destructive effects (Laser, Time Drop) roll separately per weapon
* **Max Count:** Some weapons limited to 1 copy (Mystic Sight, Chain Reaction)
* **Purchase:** Buy in shop between rounds; choose free weapon on level up

**Card States:**
* **Holographic:** 2x points when matched
* **On Fire:** Burns after 0.25s, 10% spread chance
* **Connected:** Part of a connector weapon link

## Explaining weapons (IMPORTANT)

A weapon is explained by ONE card, `src/adventure/components/WeaponExplainer.tsx`, used before a fight (level preview, under the charms) and after it (fight replay, "Your gear this fight", with what the weapon did). Never write a second weapon description UI: use this card.

* **What it does** comes from the weapon itself (`description`, built from its current numbers). Never hand-copy numbers into other text.
* **When it works, what to look for on a card, how to play it** come from the weapon's row in `src/adventure/data/weaponGuide.ts`. The same row tells the fight replay and the band which fight events the weapon caused (`events`, `calls`).
* **Adding a weapon:** add its row to `weaponGuide.ts` (and `weaponRoles.ts`, `src/audio/voices.ts`). `__tests__/weaponGuide.test.tsx` fails for any Armory weapon without a guide row, a role, a voice or a description, and renders the card for every weapon.
* **If the weapon marks a card,** put the same icon and colour in its guide row's `look` that `Card.tsx` draws.

## Sound (IMPORTANT)

> **Full documentation:** [docs/sound-design.md](./docs/sound-design.md). Sound studio: `/dev/sound`.

Adventure's sound is one adaptive score, synthesized live in `src/audio/` (no audio files, web only). Everything is written in scale steps and lands on the beat, so every sound is in key with the music.

* **The music shows the state of the fight** (hearts, clock, foe HP, streak, evolutions, what is on the board). `src/audio/director.ts` is the only place that decides what a state sounds like.
* **Every weapon has a voice** (`src/audio/voices.ts`): when you add a weapon, add its row (instrument, riff, why). Unvoiced weapons fail `__tests__/audioScore.test.ts`.
* **Every run event has a cue** (`src/audio/fightAudio.ts` `EVENT_CUE`, a full Record): when you add a `RunEventType`, give it a row.
* **Never play a raw frequency in a fight.** Use a cue (`band.cue`), in scale steps, so it stays in key.

## Fight effects (IMPORTANT)

> **Full documentation:** [docs/fx-design.md](./docs/fx-design.md). Effects studio: `/dev/fx`.

Everything that happens in an Adventure fight is SHOWN: one move plays as a cascade over the board and HUD (`src/adventure/fx/`), in step with the band, and the fight clock stands still while it plays.

* **Every run event has a look** (`src/adventure/fx/catalog.ts` `EVENT_FX`, a full Record): when you add a `RunEventType`, give it a row (and its sound row in `EVENT_CUE`). `__tests__/fightFx.test.tsx` fails an empty row.
* **Events say where they happened:** if an event touches cards, pass `{ slots, cards }` to `emit` (`engine/fight.ts`) so the effect plays on those cards.
* **The same effect looks the same whoever caused it.** Do not draw a second laser; add to the catalog row or the shared pieces in `fx/visuals.tsx`.
* **Never animate fight feedback inside `AdventureRun.tsx`.** HUD parts are `<Anchor name="…">`; the stage aims at them and makes them jump.
* **A row is `damage` only if its amount was dealt right then.** Bonuses inside the Set's hit carry no damage of their own (or the HP bar drops twice).
* **The clock waits for the player's own moves** (`fx.busy`). Events the clock itself causes are emitted with `clock: true` (every `TICK`) and play while it runs; rows that repeat (`ambient`) never hold it either.
* Players can turn effects off (Pause → Effects); the code path is the same script with `reduced: true`.

## Card Visual Rules (IMPORTANT)

**Borders/outlines are EXCLUSIVELY for selection.** Never use card borders or outlines to indicate any other state (fire, connections, etc.).

**State indicators use small icons** in the bottom left corner of cards:
* Icons are ~1/5 the size of the card shapes (about 10-14px)
* Multiple states can stack horizontally
* Current icons:
  * 🔥 Fire: `lorc/campfire` (red)
  * 🔗 Connection: `lorc/linked-rings` (gray)
  * 🧲 Magnet mark: `lorc/magnet` (red)
  * ♊ Twin: `delapouite/gemini` (purple)
  * Board gambles: curse `lorc/cursed-star`, chain `lorc/crossed-chains`, thorns `lorc/thorny-vine`, rust `delapouite/rusty-sword`, tar `delapouite/sticky-boot`, fuse `delapouite/time-dynamite`, ice `lorc/ice-cube`, chest `delapouite/mimic-chest`, hot potato `delapouite/potato`

Cursed and frozen cards are out of play: they get a colour wash over the card (never a border).

This rule ensures visual consistency and prevents confusion with selection state.

## Key Features

* 6 playable characters (Orange Tabby, Sly Fox, Emperor Penguin unlocked by default in `storage.ts`; Corgi, Pelican, Badger locked)
* Weapon roster in `WEAPONS` (see [weapons-design.md](./specs/weapons-design.md))
* Grace auto-use system (prevents health loss on near-misses)
* Match trigger effects (healing, hints, time, graces, explosions, lasers, fire)
* Auto-hint system (shows 1 card from valid set after idle time)
* Options menu with sound toggle (persisted to MMKV storage)

### UI Features

* **Inventory Bar:** Horizontal scrollable bar at top of Shop and Level Up screens showing all collected weapons
* **Stats Preview:** Shop and Level Up show before→after stat comparison when viewing weapons
* **Double-Tap Purchase:** Double-tap a weapon in the shop to instantly purchase (no confirmation)
* **Free Indicator:** Level Up screen clearly shows rewards are free with "FREE" badge and banner
* **Menu Pause:** Timer pauses when the game menu is open

## Notes

* **Enemy selection is skipped.** The game goes directly from character selection to the round phase.
* **Shop shows only weapons.** Items have been replaced by the weapon system.
* **Level-up shows only weapons.** No stat upgrade options.

## Tech Stack

* **Expo 54** with Expo Router
* **React Native** for iOS, Android, and Web
* **TypeScript**
* **NativeWind/TailwindCSS** for styling

## Project Structure

```
app/                        # Expo Router routes only
├── _layout.tsx             # Root navigation layout
├── index.tsx               # App entry point (home screen)
└── dev/                    # play, store, adventure, fighters, victory dev pages

src/                        # Shared code (imported via @/ alias)
├── adventure/              # Adventure Mode (data-driven; see docs/adventure-design.md)
├── game/                   # Pure game rules: board, rounds, inventory, effect caps, round stats
├── hooks/                  # React hooks (timers, conductors, auto-hint, safe-area, reduced motion)
├── audio/                # Synth sound effects and songs
├── components/
│   ├── Game.tsx            # Main controller (handles game phases, weapon effects)
│   ├── GameBoard.tsx       # Card display (auto-hint system)
│   ├── Card.tsx            # Renders shapes, fills, holographic shimmer, fire effects
│   ├── WeaponShop.tsx      # Weapon purchase interface (double-tap, stats preview)
│   ├── LevelUp.tsx         # Weapon selection on level up (FREE indicator)
│   ├── InventoryBar.tsx    # Horizontal weapon inventory display
│   ├── CharacterUnlockScreen.tsx  # Character unlock celebration
│   ├── VictoryScreen.tsx   # End-game celebration screen
│   ├── OptionsMenu.tsx     # Sound settings modal
│   ├── RoundSummary.tsx
│   ├── creatures/          # Shared creature rig, motion and damage overlay
│   ├── fighters/ enemies/ weapons/  # Animated avatars
│   ├── illustration/       # SVG drawing primitives
│   └── ui/                 # Shared UI pieces
├── context/                # Tutorial and keyword-tooltip state
├── types.ts / types/       # Interfaces for Cards, Weapons, PlayerStats, enemies
└── utils/
    ├── gameDefinitions.ts  # Characters, weapons (WEAPONS array)
    ├── gameConfig.ts       # Game constants, default stats, difficulty progressions
    ├── gameUtils.ts        # Modular SET validation for N-attributes
    ├── matchResolution.ts  # What one successful Set does to the board (effects, links, echoes, rewards)
    ├── weaponEffects.ts    # Weapon trigger rolls (capped via src/game/effectCaps.ts)
    └── storage.ts          # MMKV persistence (settings, character unlocks, wins)

```

**Import Alias:** Use `@/` to import from `src/` (configured in `tsconfig.json`).

## Icon System (IMPORTANT)

The game uses SVG icons from `assets/icons/` with a **type-safe registry system**. Icons are organized by artist (e.g., `lorc/`, `delapouite/`, `caro-asercion/`).

### How Icons Work

1. **Icon Registry:** All icons must be imported and registered in `src/components/Icon.tsx`
2. **Type Safety:** The `IconName` type is a union of all registered icon paths
3. **Build-Time Validation:** TypeScript catches any invalid icon paths at compile time

### Adding a New Icon

When adding a new icon, you MUST do both steps:

```typescript
// 1. Add the import at the top of Icon.tsx
import MyNewIcon from '../../assets/icons/lorc/my-new-icon.svg';

// 2. Add to ICON_REGISTRY (inside the object)
const ICON_REGISTRY = {
  // ... existing icons
  'lorc/my-new-icon': MyNewIcon,  // Add this line
} as const satisfies Record<string, React.FC<SvgProps>>;
```

### Using Icons

```typescript
// Import IconName type when needed for type annotations
import Icon, { IconName } from './Icon';

// Use in JSX - TypeScript validates the name
<Icon name="lorc/cat" size={24} color={COLORS.slateCharcoal} />

// For typed objects containing icons
const myConfig: { icon: IconName } = {
  icon: 'lorc/cat',  // TypeScript validates this
};
```

### NEVER Do This

- **Never use a string icon path without adding it to ICON_REGISTRY first**
- **Never guess icon paths** - check `assets/icons/` for available SVGs
- **Never use `icon: string`** - always use `icon: IconName` for type safety

### Validation Commands

```bash
npm run typecheck        # Catches invalid icon paths
npm run validate:icons   # Verifies all registered icons have SVG files
```

### Icon Locations

- SVG files: `assets/icons/{artist}/{icon-name}.svg`
- Registry: `src/components/Icon.tsx` (ICON_REGISTRY)
- Type definitions: `src/types.ts` (uses IconName for Weapon, Character, etc.)

## Game Flow

**Adventure Mode:**

1. Main Menu → Adventure → **Map** (frontier node bobs; your fighter stands beside it).
2. Tap a foe → **Preview** (foe + taunt, skulls, NEW mechanic, rules, ★/★★/★★★ goals + rewards, fighter pick).
3. If the level teaches something new → **Intro card** (demo cards/icons).
4. **Fight**: HUD with foe HP bar, hearts, moves or clock, coins, hint, XP, the weapon belt, live ★★★ challenge. Every move plays as a cascade of effects while the clock waits; an evolution opens with a tap-to-continue cut-in. Waves → intermission (shop once taught).
5. **Results**: stars pop in, coins bank, first-time star rewards unlock weapons/fighters/regions, and a secret side path the result opened is revealed last → Next / Retry / Map / Camp.

**Free Play Mode:**

1. Character Selection → Choose Free Play.
2. **Select Difficulty:** Toggle 2, 3, 4, or 5 attributes.
3. Play continuously; exit anytime.

## Game Board Layout

The layout adapts based on the number of active attributes to ensure a Set is mathematically likely to be on the board:

* **2–3 Attributes:** 3x3 or 3x4 grid (9–12 cards).
* **4–5 Attributes:** 3x5 or 3x6 grid (15–18 cards) to prevent "No-Set" deadlocks.

**Field Size:** The actual board size is the maximum of:
1. The minimum required for the attribute count (as above)
2. The player's `fieldSize` stat (base 12 + weapon bonuses from Field Stone)

This means Field Stone weapons can increase the starting board size beyond the minimum, giving players more cards to work with from the start of each round.

## Dev Testing

**`/dev/play`** - Full game with dev tools:
* Access dev tools through MENU button -> Dev Tools
* Toggle timer on/off
* Reset board, add cards
* Change round (1-10) and difficulty (3-5 attributes)
* Set cards on fire, make holographic
* Add graces
* Add the rarest weapon of a category

**`/dev/adventure`** - Adventure map (`?save=maxed` everything unlocked + 50k coins, `?save=fresh`, `?save=before:1-4` ★★★ on everything before that level, `?autoplay=true`)

**`/dev/fx`** - Effects studio: a button for every fight event, a sample cascade and the evolution cut-in, on a stand-in fight screen; real time or 4×/10× slower; effects on/off

**`/dev/sound`** - Sound studio: start the band, change the fight state and hear the music follow; audition every weapon voice, evolution theme and cue; "Check levels" renders a fight offline and reports peak/RMS

**`/dev/fighters`** - Interactive fighter animation & battle wear-and-tear studio (all 6 creatures, health tiers, reactions, moods, tap-to-pet)

**`/dev/store`** - Standalone weapon shop tester:
* Starts with $50,000
* Buy weapons, reroll shop
* Test stat preview and inventory display
* "Continue" refreshes the shop for more testing

## Versioning (IMPORTANT)

When making commits, **ALWAYS increment the patch version** in `package.json`:

```bash
# Example: 0.1.0 → 0.1.1 → 0.1.2
```

After committing and pushing, **ALWAYS report the new version number** in your output:

```
✓ Pushed version X.Y.Z
```

This ensures builds can be verified to contain the latest changes.

---

## Design Documents

When working on specific systems, load the relevant design doc for detailed specifications:

* **[Adventure Mode](./docs/adventure-design.md)** - Map, levels, stars, economy, fighters, audio synth, balance bots
* **[Balance System](./docs/balance-system.md)** - The lab, the generated report, level balance and the HP tuner; **[Balance Philosophy](./docs/balance-philosophy.md)** - what we are aiming at
* **[Fight effects](./docs/fx-design.md)** - The cascade, the clock hold, the weapon belt, the evolution cut-in, how to add an effect
* **[Sound](./docs/sound-design.md)** - The adaptive score: what the music tells you, weapon voices, evolution themes, the casino layer
* **[Weapon System](./specs/weapons-design.md)** - Complete weapon roster, rarities, effects, synergies, and balance notes
* **[Enemy System](./specs/enemy-design.md)** - Enemy roster, tier scaling, defeat conditions, and weapon counters (in development)
* **[Balance Philosophy](./docs/balance-philosophy.md)** - Rough target win rates by world for a bare vs a fully invested player
* **[Style Guide](./style_guide.md)** - UI design system including colors, typography, and component styles
