# Adventure Mode — Design & Editing Guide

Adventure Mode is a map campaign in the style of Angry Birds and Bloons, with Vampire Survivors–style meta-progression and a Brotato + Set fight feel. **The game is the tutorial.** Every level teaches exactly one new thing.

The fun is in stacking a build: **2 fighter passives + a web-shaped skill tree + up to 6 charms + timed evolutions + up to 3 Arcana**. All of them are written in one shared rule vocabulary (`src/adventure/rules/types.ts`) and run by one interpreter (`rules/engine.ts`), so any source can chain into any other.

Everything is **data-driven**. To change the campaign, edit `src/adventure/data/*.ts`, not the engine. `docs/adventure-v3-design.md` is the build spec this was made from. Where it and the code disagree, the code wins and this doc follows the code.

## The loop

```
Map ─tap foe─▶ Preview (foe, skulls, NEW mechanic, hazards, ★ goals + rewards,
     ▲                  fighter pick, charm slots, Arcana slots)
     │                 │
     │          new mechanic? ─▶ Lesson cards / "Is this a Set?" checks
     │                 ▼
     │               Fight (one foe, or waves + intermission shop)
     │                 ▼
     │               Results (stars pop, coins bank, unlocks revealed, biggest hit)
     │                 │
     └── Camp: Fighters (skill trees) · Workshop · Armory · Arcana ◀┘
         Bounty Board · Field Guide (mechanics, fighters, recipes)
```

### Map and preview
- **Map** (`AdventureMap.tsx`): a winding path of foe nodes through the five worlds. Side branches hang off the path, and some branches lead on to further branches. Tap a node to open the preview.
- **Preview** (`LevelPreview.tsx`): foe and taunt, 1–5 skulls, the NEW mechanic, level rules and hazards, the three star goals with their coins, and unlocks shown as silhouettes. Below that:
  - **Fighter pick.** The preview tags fighters that suit the level as **STRONG** (`recommended` in `levels.ts`), which drives the "come back with the right fighter" loop.
  - **Charm picker**: tap to equip or remove (`n/slots equipped`).
  - **Arcana picker**: when every slot is full, the Arcana equipped longest ago makes room.
  - **Evolution likelihood**: the engine's own number, so skill nodes and charms that change it are counted.

### Stars (every level)
| Stars | How |
|---|---|
| ★ | **Survive**: use up the moves, or outlast the clock, with hearts left |
| ★★ | **Knock out** every foe (every wave) |
| ★★★ | Knock out **and** meet the level's challenge |

1-1 is different (`starRule: { kind: 'accuracy' }`). It cannot be lost (no hearts yet), and you make 5 Sets against a 15 HP foe. ★★★ means no mistakes, ★★ at most 1, ★ otherwise. Levels are replayable, and each level stores its best result.

### Rewards and unlocks
- **Every star pays coins**, shown up front. Coins left out of the level data are filled in by `normalizeRewards` so they always rise ★ → ★★ → ★★★.
- **Some stars also unlock one thing**: a weapon, a fighter, an Arcana, an evolution recipe, or a campaign system (`unlockFeature`). It stays a silhouette until earned, then gets a full-screen reveal (`UnlockReveal.tsx`).
- **Each star's reward is granted once.** A new weapon goes straight into a free charm slot.
- **A weapon reward for a weapon you already own is +1 level of it** ("Blast Powder is stronger! (Level 2)"). Levels are derived from the earned stars and bounties (`weaponLevels.ts`), so re-granting rewards on load never stacks them. Levels only come from the world; the Workshop tunes (see Weapons).
- **Campaign systems** (`data/features.ts`): Coin Drops (1-1 ★), Workshop (1-5 ★), and Bounty Board (the first star on 1-8, revealed after that level's star rewards).
- `reconcileUnlocks` (`progress.ts`) re-grants anything an old save's stars now unlock after a level-table change. It never pays coins twice.

### How the game teaches
The player always has to accept a teaching step. Nothing auto-dismisses.
- **Lesson cards** (`MechanicIntro.tsx`): a paged card before the first fight with a new mechanic. The pages come from the mechanic's `lessons`, then its summary, then its `quiz`.
- **"Is this a Set?" checks**: yes/no questions with an explanation after each answer. Validity is computed from the cards, never hand-written.
- **First-run onboarding**: the first time the player enters Adventure, the game plays the story page (`data/story.ts`, placeholder text), the Set lessons and the checks, then drops straight into 1-1.
- **Fight tips** (`fightTips` on a mechanic): shown one by one when the first fight with that mechanic starts. The fight is paused and the part of the screen the tip is about stays lit.
- **First-time event tips** (`coachMark`): the fight pauses the first time something happens (first mistake, first Rainbow, first Catalyst…). There are also one-off tips for a fighter's first fight (its two passives), the first fight with each hazard, and the first evolution (`COACH_KEYS` in `progress.ts`).
- **"First evolution is near" page** (`lessons.ts`, `LESSON_KEYS.comboDiscovery`): built from the save, not fixed in data.

## Worlds and routes

| World | Biome id | Star gate | Main levels | Side branches | Theme | Music |
|---|---|---|---|---|---|---|
| 1 Sunny Meadow | `meadow` | 0 | 8 | 1 | basics, first evolution, Time Bombs (no clock) | `meadow` |
| 2 Whispering Woods | `woods` | 12 | 9 | 3 | the clock, foe tricks, snares, hints, graces | `woods` |
| 3 Ember Canyon | `canyon` | 30 | 10 | 4 | shading, charm slots, waves, shop, XP, Arcana | `canyon` |
| 4 Frozen Peaks | `peaks` | 56 | 11 | 5 | five traits, stacked builds | `peaks` |
| 5 Starfall Summit | `summit` | 90 | 5 | 0 | the gauntlet: every system at once | `boss` |
| **Total** | | | **43** | **13** | 56 levels, **168** stars max | |

- **Long rounds from World 2:** every level outside the Meadow gets double foe HP and a double clock (`LONG_ROUNDS` / `withRoundLength` in `data/levels.ts`; numbers in the level table are written before this). Longer fights give snowballing builds (stacked weapons, evolutions, combos) time to pay off.
- **Main path:** a level opens when the previous main level has ★ and its world's star gate is met. Gates count stars *earned*, so spending stars on skill trees never re-locks a world.
- **Side branches** (`branchOf`) open at ★★ on their parent (`BRANCH_STAR_REQUIREMENT = 2`) and never block the main path.
  - **Fighter trials** (ids ending `F`/`C`/`B`/`P`) hang off the level whose ★★ recruits that fighter, so you always own the fighter they teach.
  - **Elites** (`E`, `E2`) are tougher optional foes. Three of them chain off another branch: 3-3E → 3-3E2, 4-2E → 4-2E2, 4-7E → 4-7E2.

### Mechanic order (one per level)

| World | Main path: what each level teaches | Side branches |
|---|---|---|
| 1 | 1-1 The Set (2 traits, no gear) · 1-2 Hearts · 1-3 Number trait · 1-4 Evolutions · 1-5 Skill tree · 1-6 Rainbow Strike · 1-7 Time Bombs · 1-8 **Boss** Iron Shell (armored card) | 1-3F Fox Den (Sly Fox) |
| 2 | 2-1 The clock · 2-2 Snares · 2-3 Hints · 2-4 Power cards · 2-5 Duds · 2-6 Face-down · 2-7 Graces · 2-8 Escalating Purity · 2-9 **Boss** Trap Weaver (bombs) | 2-4C Corgi's Yard · 2-7B Badger's Sett · 2-8P Ice Floe (Penguin) |
| 3 | 3-1 Shading trait · 3-2 Charm slots (Goblin Saboteur) · 3-3 Waves · 3-4 Shop · 3-5 XP level-ups · 3-6 Arcana slots · 3-7 Burrowing · 3-8 Trait shift · 3-9 Time theft · 3-10 **Boss** Charging Boar (inactivity) | 3-3E Ant Hill → 3-3E2 Viper Pit · 3-5P Pelican's Wharf · 3-8E The Deep |
| 4 | 4-1 Background trait · 4-2 Fast clock · 4-3 Regeneration · 4-4 Glass cannon · 4-5 Punishment · 4-6 Countdown · 4-7 Shuffle · 4-8 Polar Guardian · 4-9 One-Eyed Terror · 4-10 Feral Fangs · 4-11 **Boss** Ancient Dragon | 4-2E Bear Country → 4-2E2 Claw Ridge · 4-5E Sentinel Ruins · 4-7E Hoarder's Den → 4-7E2 Ink Grotto |
| 5 | 5-1 Kraken (weapons at half) · 5-2 World Eater · 5-3 The Reaper · 5-4 Merciless Porcupine · 5-5 **Final boss** The Hydra (★★★ = a 50+ hit) | — |

Each mechanic has a `kind` in `data/mechanics.ts`:
- **feature**: stays on once taught. `getFeaturesForLevel` adds every `enables` flag introduced at or before the level's position on the main path.
- **threat**: comes from the level's foe, using the existing `src/utils/enemies` roster.
- **rule**: changes the puzzle itself (traits, clock, waves, traps).
- **fighter**: taught by a fighter trial.

Three systems are switched on by the save rather than by map position:
- `gear` (passives, skill nodes, charms, Arcana) is on everywhere except `noGear` levels (1-1).
- `coins` turns on once Coin Drops is unlocked.
- `evolutions` turns on once the first recipe is unlocked.

## Fighters: two passives each

Fighters bring **no gear and no active button**. A fighter's identity is two always-on passives that change *how you play*. Charms are the whole weapon loadout. Passives are hand-coded in `engine/passives.ts`, and every number is a **tuning key** in `data/passives.ts` that skill nodes adjust through `passiveTuning`.

| Fighter | Passive 1 | Passive 2 | Plays like | Unlock |
|---|---|---|---|---|
| Orange Tabby | **Nine Lives**: once per fight, a knockout leaves you on 1 heart | **Scrappy**: +1 damage per missing heart on every Set | Risky brawler | Start |
| Sly Fox | **Combo**: Sets within 5s chain (+0.5s per trait beyond 3: 6s with 5 traits), +1 damage per step (max +4); a mistake breaks it | **Hot Streak**: at max Combo, your next Set deals ×2 | Speed | 1-3 ★★ |
| Corgi | **Zoomies**: every 5th Set re-deals the board clean (duds and hidden cards gone) | **Fetch**: matching a power or gold card brings a new one onto the board | Board shaper | 2-4 ★★ |
| Badger | **Grudge**: each mistake stores a grudge (max 3); the next Set releases +3 per grudge | **Thick Hide**: your first mistake each wave costs no heart | Gambler | 2-7 ★★ |
| Emperor Penguin | **Patience**: a Set made 2.5s+ per trait after the last one deals +2 (10s with 4 traits) | **Deep Freeze**: every Rainbow Strike freezes the clock and the foe for 4s | Precision, Rainbow hunter | 2-8 ★★ |
| Pelican | **Big Scoop**: every 6th Set, a free Set is scooped for you | **Keen Eye**: after 8s without a Set, one card of a Set glows (free) | Relaxed | 3-5 ★★ |

- The combo counter runs for **every** fighter: it feeds the HUD and the `comboReach` challenge. Only Sly Fox turns it into damage.
- Free Sets made for you (Big Scoop, `autoSet` effects) cost no move and don't count toward the next scoop.

## Skill trees (bought with stars)

`data/skillTrees.ts` · UI `SkillTree.tsx` (Camp → Fighters)

Trees follow *Clair Obscur: Expedition 33*: each fighter's tree is a uniquely shaped **web**, not a list.

- **Adjacency rule:** a node can be bought once **any** node it links to is owned, or straight away if it hangs off one of the two passives (the free roots). Branches fork and rejoin, so most nodes can be reached more than one way. Every node is visible and readable; locked ones show dimmed with a padlock.
- **Shapes and clusters** (each passive's themes sit together, like Lune's elements). Every fighter has 23–24 nodes:

  | Fighter | Shape | Clusters |
  |---|---|---|
  | Orange Tabby | Paw print: both passives in the main pad, four toes, the heel below | heal → blast (outer left toe), heal → power (inner left), rage (inner right), 1-heart wrecking ball (outer right) |
  | Sly Fox | Two zigzag lightning bolts that fuse into one tail tip, sparks off every bend | Combo bolt (speed, coins, time), Hot Streak bolt (fire, echoes, multipliers) |
  | Badger | Burrows dug down from the surface, two galleries across, a den at the bottom | Grudge tunnel (mistakes are ammo), Thick Hide tunnel (mistakes are cheap and lucky) |
  | Emperor Penguin | Snowflake: six arms around the two passives, twigs close it into rings | Patience arms (heavy slow hits), Deep Freeze arms (Rainbow hunting), power arm up, evolution arm down |
  | Corgi | Dog bone: a loop in each knob, a ladder for the shaft | board size, re-deals, rewards, fetch count; crossroads on the shaft |
  | Pelican | Two waves braided together, crossing at Riptide and High Tide | Big Scoop strand (free Sets), Keen Eye strand (hints) |

- **Crossroads** (`x-*` keys) sit where the two halves meet and use both passives (e.g. Tabby's Ninth Life Scrap tunes Nine Lives *and* Scrappy). **Capstones** (`cap-*`, drawn as diamonds, like every 5★+ node) sit at the tips.
- **Sealed capstone:** one per fighter is sealed until the player has earned `SEALED_AT` stars (World 4's star gate, read from `biomes.ts`: 56), like E33's story-gated skills.
- **Cost by role, not depth:** each node is authored with a weight (1 next to a root, 2–4 in the body, 5–6 at the tips). `scaleCosts` turns the weights into star costs so every fighter's full tree costs exactly `TREE_BUDGET`.
- **Every fighter spends every star earned** (no shared pool): a fighter's available stars = stars earned − stars spent on *that* fighter. Growing one never costs another anything, so there is no refunding one fighter to fund the next.
- **Star budget, tied to the level list** (`data/skillTrees.ts`): `CAMPAIGN_STARS` = 3 × the number of levels (168 with 56 levels, elites included), `TREE_BUDGET` = `CAMPAIGN_STARS − TREE_SLACK` (8) = 160. A full campaign maxes any fighter with 8 stars to spare.
  - **Adding levels** adds 3 stars each, and every tree's node costs scale up with it, so "full tree ≈ full campaign" stays true without touching the trees. Raise `TREE_SLACK` instead if new levels should make trees easier to finish.
  - A save whose tree now costs more than it has earned gets that fighter's stars back on load.
  - `__tests__/adventureProgressionSystems.test.ts` checks each tree sums to `TREE_BUDGET` and that `maxStars()` is `CAMPAIGN_STARS`.
- **Refunds are free and any time:** a single node when nothing would be cut off from both passives without it (the sheet names what blocks it), or the whole fighter.
- **Content:** about a third of the nodes tune the passive (`tune('combo.max', 2)`); their text says "+1 more", never "was X", because nodes can be bought in any order. The rest chain systems together (heal → explode, explosion → combo step, Rainbow → spawn Catalyst, mistake → laser), nudge a play pattern, or change how weapons behave. No node is a bare "+1 heart".
- Node ids are `<fighter slug>-<key>` (e.g. `fox-0-4`, `fox-x-1`). Keys `0-n`/`1-n` are the old two-branch ids, kept so saves keep what they own.
- On load, `normalizeSkillNodes` keeps only nodes still connected to a passive through owned nodes. If a rebalance (or more levels scaling costs up) makes a fighter's tree cost more than the player has earned, that fighter's stars are refunded.

## Loadout: charms and Arcana

`loadout.ts` builds what the fighter walks in with (the preview shows the same thing):
- **Features**: what is switched on at this level.
- **Passives and owned skill nodes.**
- **Equipped charms**, at their builds (level found in the world + Workshop tuning).
- **Combined Arcana.**
- **Baked stats**: Workshop items plus the level's starting hints, graces, hearts and clock.

| Slot | Start | Max | Grows with |
|---|---|---|---|
| Charms (Armory weapons) | 3 | 6 | Workshop **Charm Belt** (+1 per tier) |
| Arcana | 1 | 3 | Workshop **Tarot Deck** (+1 per tier) |

- **Charms** are Armory weapons, with no duplicate ids. The Armory only holds weapons won from star and bounty rewards. Level-up picks and the shop also draw only from the Armory, never offer a weapon already held in the fight, and anything picked or bought lasts for that fight only.
- On `noGear` levels, passives, nodes, charms, Arcana and evolutions are all off.

## The rule vocabulary

`rules/types.ts` (shapes) · `rules/engine.ts` (interpreter) · `engine/sources.ts` (where rules come from)

A **Rule** is `trigger` + optional `when` conditions + `effects`, with an optional `callout` floater. **Modifiers** are standing changes while their source is live.

**Sources:**
- Owned skill nodes.
- Held weapons: charms, picks and buys. Only adventure weapons carry rules.
- Active evolutions, only during their window.

**Rule keys** are stable for the whole fight: `node:<id>#i`, `w<slot>:<weaponId>#i`, `evo:<id>#i`.

| Part | Options |
|---|---|
| Triggers | `set`, `firstSetOfWave`, `everyNthSet n`, `setsWithin count/withinMs`, `rainbow`, `mistake`, `healed`, `hurt`, `weapon <kind>`, `idle ms`, `fightStart`, `waveStart`, `evolutionStart`, `evolutionEnd`, `trapDefused`, `bonusCardMatched`, `cardBroken`, `foeBelow fraction`, `hintUsed`, `graceUsed`, `cardBurned`, `linkDestroyed` |
| Conditions | `chance pct`, `heartsAtMost n`, `heartsFull`, `comboAtLeast n`, `diffCount n`, `rainbowSet`, `noMistakesThisFight`, `evolutionActive`, `timeSinceLastSetAtLeast/AtMost ms`, `boardAtLeast n` |
| Effects | `damage` (optionally `per` a count), `cashIn`, `convert`, `shield`, `cleanse`, `explode area`, `laser area`, `ignite`, `heal`, `coins`, `time`, `hint`, `grace`, `xp`, `growBoard`, `empowerBoard`, `armorCard`, `simplify`, `doubleNext`, `freeze`, `redeal`, `autoSet`, `comboStep`, `spawnCatalyst`, `extendEvolutions`, `nextSetMultiplier`, `trigger <kind>`, `ricochet`, `link` |
| Areas | `block cols×rows` (random anchor that fits the 3-column grid), `row`, `column`, `random count` |
| Conditions (new) | `foeHpBelow` · Trigger `finale` (an evolution's own end) |
| Modifiers | `setDamage`, `conditionalDamage`, `rainbowMultiplierBonus`, `weaponChanceScale`, `evolutionLikelihood`, `rainbowEvolutionLikelihood`, `evolutionDurationMs`, `extraEvolutionsPerFight`, `maxHearts`, `startingHints/Graces/Seconds`, `coinPercent`, `pickOptions`, `freeMistakes`, `trapImmunity`, `passiveTuning` |

### Combining and chaining
- **Modifiers combine:** numbers add, `*Scale` values multiply, flags OR, lists concatenate, and `passiveTuning` deltas add.
- **Chaining:** effects that fire weapon behaviour (`explode`, `laser`, `ricochet`, `ignite`, `heal`, `coins`, `time`, `hint`, `grace`, `xp`, `growBoard`, `trigger`) queue a `weapon` trigger of their kind, so other rules can react.
  - Free Play weapon effects rolled by `GameBoard` on a Set are queued the same way (`fireBoardWeapons`).
  - Primitives (`engine/fight.ts`) only queue events. `drain()` resolves the queue at the end of every action.
- **Loop safety:** a rule never reacts to events its own effects caused, and one action resolves at most **32** rule firings.
- **`doubleNext`**: the next weapon trigger runs twice, and both copies emit their trigger.
- **Area effects:**
  - Armored cards lose a hit instead of being destroyed.
  - The Catalyst and cards already leaving are never touched.
  - Linked partners go too.
  - Each destroyed card pays collateral damage (explosion 1, laser 2, ricochet 1, linked 1) and 1 coin.
- **Rule-driven time gains** can lift the clock at most 15s above its starting value.

## Weapons

**One item per weapon, grown two ways** (`data/weaponStats.ts`). There are no rarities in Adventure: every weapon starts solid at level 1, and you make it good by investing in it.

- **Level (1-5) is found in the world.** The first star or bounty reward that names a weapon unlocks it; every later one is another copy found, +1 level, with a "Blast Powder is stronger!" reveal. Each level adds the weapon's flat `perLevel` gain to **every** number it has. Levels never cost coins, and are derived from earned stars and bounties (`weaponLevels.ts`), so re-granting rewards on load can't stack them.
- **Tuning is bought at the Workshop** with coins, one track per number: ×1.1 → ×1.2 → ×1.35 → ×1.5 on the levelled value, for 60 / 150 / 320 / 600 coins (`TUNING_MULTIPLIERS`, `TUNING_COSTS`). Tuning never raises the level. Refunds are 100%.
- Whole-number stats (hearts, graces, board cards, hint slots, links) can come out fractional after tuning. A fight rounds each one by chance with its RNG (2.4 cards = 2, with a 40% chance of 3; `resolveWholeStats` in `loadout.ts`). Previews round down.
- **Weapons do one thing each.** The old epic bundles (Terra Foundation, Vital Core, Entropy Engine...) are gone: each maps to its main single weapon, and Entropy Engine (ricochet + blast) is now an **evolution**. Combinations come from evolutions, not from items. The cap-raising legendaries (Prismatic Perfection, Tabula Rasa, Desperate Measures), Fortune's Eye (rarity luck) and Snowball (did nothing) were removed.
- Destructive weapons have a damage number as well as a chance: each card they destroy deals its collateral (blast 1, laser 2, ricochet 1, burn 1) **plus** the weapon's `explosionDamage` / `laserDamage` / `ricochetDamage` / `burnDamage`.
- `rarity` on a built weapon is only the trim colour of its relic art, and follows its level (`trimForLevel`). UI never shows it.

The Free Play roster (`src/utils/gameDefinitions.ts`) is reused, with **Adventure's own numbers and extras in `data/weaponTuning.ts`** (`ADVENTURE_TUNING`): `effects` are level 1 and `perLevel` the flat gain per level, `extra` are numbers only Adventure uses, and `rider` builds rules and modifiers from the weapon's current numbers. Free Play's numbers are untouched. Adventure adds **rule weapons** in `data/adventureWeapons.ts`: a plain `Weapon` plus `stats` (their numbers, levelled and tuned the same way) and `build`, which turns the numbers into rules and wording. Revenge Linker has an Adventure version there (its Free Play effect lives in the Free Play loop); Sympathetic Flames is Free Play only (`FREE_PLAY_ONLY_WEAPONS`). `data/armory.ts` `getArmoryWeapon(id, weaponBuilds(save))` finds a weapon at its build.

**Three rules every weapon follows** (see [balance-philosophy.md](./balance-philosophy.md), "Weapons and evolutions"):

1. **It does something you can see, alone, at level 1.** Proc weapons fire about once in five Sets from the start. Timing weapons use beats an average player hits at any trait count (every Nth Set, 3 Sets in 15s), not "5 Sets in 20s".
2. **Support weapons hit back.** Hearts, hints, graces, coins and XP each come with a strike on the foe: Mending Charm overheals for damage, Second Chance's grace saves hit, Crystal Orb's hints hit when used, Life Vessel adds Set damage at full hearts.
3. **Reacting weapons bring their own trigger.** The old "bridge" weapons (Chaos Conduit, Temporal Rift, Cascade Core...) used to do nothing without a second weapon. Each now carries a small version of the effect it reacts to (Chaos Conduit blasts a little, Temporal Rift adds a little time), so it works alone and takes off when paired.

| Weapon (id) | Level 1 | Level 5 (untuned) |
|---|---|---|
| Blast Powder (`blast-powder`) | 18% chance per Set to blast the cards next to it. Each blasted card deals 1.5 damage. | 34% blast, 2.5 dmg per card |
| Mending Charm (`mending-charm`) | 12% chance per Set to heal 1 heart. While at full hearts, it also hits the foe for 4. | 28% heal, overheal hits for 8 |
| Flint Spark (`flint-spark`) | 18% chance per Set to set the cards next to it on fire. Each burned card deals 1.5 damage. | 34% fire, 2.5 dmg per card |
| Catalyst Prism (`catalyst-prism`) | Rainbow Strikes hit for 4 more. +6% Catalyst chance on every refill, and +25% more on refills after a Rainbow Strike. | Rainbows +12, +18% Catalysts |
| Rally Horn (`rally-horn`) | The first Set of each wave, and every 4th Set of the fight, deals +5 damage. | Wave openers and every 4th Set +15 |
| Field Stone (`field-stone`) | Every fight starts with 2 extra cards. Every card on a wave's opening board deals +1 when matched. | +6 cards, opening board +3 |
| Piñata (`pinata`) | Each Set has a 20% chance to give a random card +1 hit. Breaking that card deals +8 damage. | Sets may hang a +20 piñata |
| Clarity Lens (`clarity-lens`) | Every 5th Set hits the foe for 5 and simplifies the board for 10s: one trait becomes the same on every card. | Every 5th Set: +15 and simplify |
| Prismatic Ray (`prismatic-ray`) | 10% chance per Set to fire a laser through a row or column. Each card hit deals 2.5 damage. | 20% laser, 5.5 dmg per card |
| Chrono Shard (`chrono-shard`) | +20s on the clock in timed fights. | +60s clock |
| Growth Seed (`growth-seed`) | 15% chance per Set to add a card to the board. Each time it does, every card on the board deals +1 more when matched. | 35% growth, board +1 each time |
| Chaos Shard (`chaos-shard`) | 18% chance per Set to ricochet into a random card, 20% to keep bouncing. Each hit deals 1.5 damage. | 40% ricochet, 3.5 dmg per hit |
| Seeker Lens (`seeker-lens`) | 15% chance per Set to gain a hint and hit the foe for 3. | 35% hint + 6 dmg |
| War Drum (`war-drum`) | 3 Sets within 15s: every card on the board deals +1 more when matched. | 3 Sets in 21s: board +2 damage |
| Link Stone (`connector`) | 25% chance per Set to link two of its spots. Linked cards are destroyed together. | 49% link per Set |
| Oracle Eye (`oracle-eye`) | 25% chance to point out a card of a Set when you go quiet. Sets made 8s or more after the last deal +2. | 49% auto-hint, slow Sets +5 |
| Time Drop (`time-drop`) | 10% chance per Set to add 5s to the clock. | 22% chance of +9s |
| Second Chance (`second-chance`) | Start every fight with 1 extra grace. Every grace save hits the foe for 4. | +5 graces, saves hit for 12 |
| Amplifier Coil (`amplifier-coil`) | Each Set: 25% chance to shock the foe for 2 and make the next weapon trigger (blast, heal, laser, fire...) happen twice. | 49%: +4 and next trigger ×2 |
| Fortune's Favor (`fortunes-favor`) | 20% chance per Set to gain +1 coin and hit the foe for 2. | 44% bonus coin + 3 dmg |
| Life Vessel (`life-vessel`) | +1 max heart in every fight. While at full hearts, every Set deals +1. | +3 hearts, full hearts +3 |
| Scholar's Tome (`scholars-tome`) | 20% chance per Set to gain +1 XP and hit the foe for 2. | 52% bonus XP + 3 dmg |
| Echo Stone (`echo-stone`) | 10% chance per Set to match another Set for you (an echo). Every echo also hits the foe for 3. | 20% echo, +9 per echo |
| Fortune Token (`fortune-token`) | 12% chance per Set to gain a grace and hit the foe for 4. | 26% grace + 8 dmg |
| Life Link (`life-link`) | +1 max heart. Every heart you lose: 50% chance to blast 4 cards. | +1 heart; lost hearts: 90% blast |
| Grace Conduit (`grace-conduit`) | Start every fight with 1 extra grace. Every grace used: 40% chance to fire a laser (2.5 per card). | +3 graces; graces: 80% laser |
| Fortune's Blessing (`fortunes-blessing`) | 15% chance per Set to gain +1 coin and hit the foe for 2. Every coin you gain: 30% chance to gain a hint. | 31% coin + 3 dmg; coins: 62% hint |
| Echo Chamber (`echo-chamber`) | Start every fight with 1 link. +0.5s on the clock for every card destroyed through a link. | +2 links, +1.5s per linked card |
| Chaos Conduit (`chaos-conduit`) | 8% chance per Set to blast the cards next to it. Every explosion: 30% chance to gain a grace. | 16% blast; blasts: 62% grace |
| Chain Reaction (`chain-reaction`) | 6% chance per Set to echo (match another Set for you). 30% of echoes match 2 Sets, and every echo hits the foe for 2. | 14% echo, 70% double, +6 each |
| Mystic Sight (`mystic-sight`) | Every 3rd Set hits the foe for 3 more. 12% auto-hint chance, and 33% of auto-hints point out 2 cards. | Every 3rd Set +9, 2-card hints |
| Crystal Orb (`crystal-orb`) | +1 hint slot, filled when the fight starts. Every hint you use hits the foe for 3. | +5 hints, each use hits for 9 |
| Temporal Rift (`temporal-rift`) | 8% chance per Set to add 4s. Every time gain: 30% chance to echo (match another Set for you). | 16% +6s; time gains: 62% echo |
| Soul Harvest (`soul-harvest`) | 10% chance per Set to ricochet into a random card for 1.5. Every card you destroy: 15% chance to heal 1 heart. | 22% ricochet; destroyed cards: 35% heal |
| Cascade Core (`cascade-core`) | 6% chance per Set to echo (match another Set for you). Every echo: 40% chance to set a card on fire. Burned cards deal 2. | 14% echo; echoes: 80% fire |
| Neural Network (`neural-network`) | 12% chance per Set to link two of its spots, and 30% chance that a new link makes a second one. | 24% link, 70% bonus link |
| Revenge Linker (`revenge-linker`) | Losing a heart hits the foe for 4, with 3 rolls at 30% each to link a pair of cards. Linked cards are destroyed together. | Lost hearts: 12 dmg, 3× 58% link |
| Web Spinner (`web-weaver`) | Start every fight with 2 links already placed. Linked cards are destroyed together. | +6 starting links |
| Wisdom Chain (`wisdom-chain`) | 15% chance per Set to gain +1 XP and hit the foe for 2. Every XP you gain: 30% chance to gain a coin. | 31% XP + 3 dmg; XP: 62% coin |

### Trick weapons

`data/adventureWeapons.ts` ("Trick weapons") · `engine/gear.ts` · `RunState.gear`

Twenty-four weapons that give you something to hunt for or keep up, rather than a chance that fires on its own. Their numbers arrive as modifiers (`magnetDamage`, `snowballMax`…), so a trick is on while its number is above zero; their state lives in `RunState.gear` and a few card flags.

| Weapon | What you do | Where its state shows |
|---|---|---|
| Magnet | One card is marked. A Set that includes it deals +5; the mark moves. | Magnet icon on the card |
| Bounty Poster | One trait value is wanted. Each wanted card matched deals +1.5; changes after 3. | WANTED chip in the HUD |
| Mirror Shard | A Set that uses a spot from your last Set deals +4. | (the spots that just refilled) |
| Odd One Out | Sets with exactly 1 trait different deal +4 (at 4+ traits, exactly 1 the same too). | |
| Collector's Album | One "all the same but X" Set per trait (number, shape, color, shading when in play). The Set that fills the last page deals +15, then it resets. At 4+ traits one other trait may differ too. | Page pips in the HUD |
| Snowball | Each Set adds +1 to later Sets this wave (max +3, +1 per level). A mistake halves it. | Stack chip in the HUD |
| Glass Sword | Every Set +6, until a mistake or 6s without a Set shatters it for the wave. | Countdown chip in the HUD |
| Devil's Bargain | 1 heart fewer; +1 per missing heart (the lost one counts). | |
| Wild Card | 10% of new cards are wild: a wild card makes a Set with any two cards. One at a time. | The card shows a joker |
| Twin Seed | 15% of new cards are exact twins of a card on the board. Matching one destroys the other for 5. | Twin icon on both cards |
| Fog Lantern | 10% of new cards arrive face-down; after 8s they flip up as power cards worth +7. | Lantern on the card back |
| Understudy | Copies the charm to its left, at the Understudy's own level, untuned. | Armory shows what it copies |
| Encore Mask | When an evolution ends it hits for 10 and its opening rules fire again. | |

**Board gambles** make the board harder for a bigger payoff:

| Weapon | What it does to your board | The payoff | Where it shows |
|---|---|---|---|
| Cursed Idol | 5% of new cards arrive cursed: unmatchable for 10s | Then a coin flip: the card becomes a ×2 card, or the curse moves to a neighbour | Purple wash and star; ×2 label |
| Chain Gang | Two cards (of a Set on the board) are chained; one matched alone stays | Both in one Set: +8 | Chain icon on both |
| Thorn Bush | 10% of new cards have thorns (one at a time); left 15s (+5s per trait beyond 3), it costs a heart | Matched in time: +8 | Thorn icon |
| Rust | Every card loses 1 damage per Set it sits through (never below 0) | The oldest card, after 7 Sets, turns golden: +15 and 5 coins | Rust count; then power and coin badges |
| Tar Pit | One row is sticky each wave: its cards take two matches | Every Set that uses that row: +5 | Boot icon with matches left |
| Decoy | 15% of new cards are an unmarked near-copy of a board card (one trait changed) | Decoy and original in one Set: +15 | Nothing, on purpose |
| Long Fuse | 20% of new cards carry a 20s fuse; burnt out, they are duds (3 at most) | Matched in the last 5s: +6 | Dynamite icon, red when hot |
| Ice Block | One card is frozen and unmatchable | After 7 of your Sets it thaws worth +25; then another freezes | Blue wash and Sets left |
| Greedy Chest | A mistake empties the chest | One card holds 10 damage and grows +2 every Set you leave it | Chest icon with its value |
| Tightrope | A Set away from your last one deals half | A Set on or next to your last Set's spots: +4 | |
| Hot Potato | While it is out, a mistake costs an extra heart | One hot card jumps to a neighbour every 10s; matching it: +8 | Potato icon |

- `syncGear` keeps a Set on the board whatever the tricks lock away (`ensureSet`: clears burnt fuses, then lifts curses, then re-deals a few plain cards).
- Rules can react to a trick paying out: `{ on: 'trick', kind: 'magnet' | 'chest' | … }` (`TrickKind` in `rules/types.ts`).

- **Wild cards and Set rules:** `isValidCombination` (utils/gameUtils.ts) and `engine/sets.ts` treat a wild card as completing any Set; for Rainbows, Purity and Odd One Out a trait counts as different when the other two cards differ in it.
- **Understudy** is resolved where charms become weapons (`charmWeapons` / `understudyOf` in `data/armory.ts`); picked up mid-fight it copies the weapon picked up before it. It keeps its own id, so it never arms the copied weapon's evolutions.
- Every trick weapon sits in 3 evolution recipes (48 in all, at the end of `data/evolutionPairs.ts`): one with a classic weapon and two with other trick weapons. A trick recipe makes its trick pay more (modifiers such as `magnetDamage`) or pays for pulling it off (`trick` triggers).
- The bots hunt the way a player would (`engine/bot.ts`): they prefer a Set with the marked card, a reused spot or an empty Album page, and find Sets faster while a wild card is out.

### Armory shelves

The Armory shelves weapons by job (`data/weaponRoles.ts`): Damage, Tricks, Board gambles, Board, Hearts & graces, Hints/coins/XP, Time & evolutions, Echoes & links. Charm slots are numbered and an equipped weapon shows its slot, because slot order matters to the Understudy.

Time gains are exactly the seconds a weapon says (Free Play adds them to a 10s base), and all time gains in a fight together can add at most the fight's starting clock (`BASE_RULES.maxTimeGainShare`, the run's `timeBank`): a 3-minute fight can stretch to 6, never to 12.

Effect caps (`game/effectCaps.ts`) were raised so a level-5, fully tuned weapon is never wasted: blast and fire 55%, hints 55%, grace 40%, echo 30%, coins 75%.

- **Early unlock order** alternates offense and support, clearest first:
  - 1-1 ★★ Blast Powder, 1-2 ★★ Mending Charm, 1-4 ★ Flint Spark, 1-4 ★★ Catalyst Prism.
  - 1-5 ★★ Rally Horn, 1-6 ★★ Field Stone, 1-7 ★/★★ Piñata and Clarity Lens, 1-8 ★★ Prismatic Ray.
- Later rewards that name a weapon you own level it up. No weapon is named by more than 5 rewards (level 5). The Workshop shows how many copies are still out there.

## Evolutions: a 30-second power trip

`data/evolutions.ts` (recipes, families) · `engine/evolutions.ts` · `EVOLUTION_RULES` in `engine/sources.ts`

1. **Arming.** There are **204 recipes: 4 per classic weapon (156) and 2 per trick weapon (48).** A recipe is **armed** while you hold one weapon of each of its two families among your charms, picks or buys, once the player knows any recipe (the first is taught at 1-3). Families are id prefixes, so `oracle-eye` matches `oracle-eye-rare`.
   - **9 signature recipes** (`data/evolutions.ts`, table below) arm from whole weapon families and are taught by star rewards.
   - **147 pair recipes** (`data/evolutionPairs.ts`) each arm from one exact pair of weapons and are **discovered**: the Recipe Guide shows them as "??? Evolution" until forged once, and the preview shows an armed one as "??? Evolution · ARMED". Every weapon sits in 6–12 recipes, and no pair of weapons arms two.
   - Each pair recipe has its own twist rather than "A also does B": finales (`finale` trigger, when the 30 s run out), cashing hints or graces in for damage (`cashIn`), turning cards gold or power (`convert`), free mistakes (`shield`), clearing traps and face-down cards (`cleanse`), damage that scales with the fight (`damage` `per` board card, missing heart, link, burning card…), or "while the foe is below 50%" (`foeHpBelow`).
   - **Every recipe is worth chasing.** It opens with something (hints, links, a blast, free mistakes) or works on every Set or every Nth Set; a recipe that only reacts to a rare event (a mistake, a lost heart) also brings a steady part. `__tests__/adventureBuilds.test.ts` checks that every recipe adds damage over its two weapons alone.
   - `__tests__/adventureEvolutions.test.ts` checks the count, uniqueness, that no pair arms two recipes, and that every recipe forges and runs through its finale in a real fight.
2. **The Catalyst.** While anything is armed, each refill batch may bring the **Evolution Catalyst** card. Only one can be on the board at a time.
   - **Likelihood** = (16% base + 4% per Evolution Lab tier + `evolutionLikelihood` modifiers) × Arcana `catalystChanceScale`, plus the level's own `rules.evolutionLikelihood` (1-4 adds +30).
   - Refills caused by a Rainbow Strike add `rainbowEvolutionLikelihood`.
   - A rule can also `spawnCatalyst` directly.
3. **Triggering.** Matching a Set that includes the Catalyst hits the foe for **10** and starts an evolution for **30s** (+ `evolutionDurationMs`). There is no priming and no shattering.
4. **Which recipe starts.** The first armed recipe, in table order, that isn't running. If all of them are running, the one closest to ending is refreshed. Several can run at once.
5. **The cap.** **Up to 3 triggers per fight**, shared across recipes. `extraEvolutionsPerFight` raises it.
6. **While active.** The recipe's rules are live, every Set's own hit is **×1.5** (once, however many evolutions run), and every Set deals +2 per active evolution (`EVOLUTION_RULES.setMultiplier`, `setDamage`). The UI shows a full-width banner, countdown rings and a board pulse (a background glow, never a card border).
7. **Catalyst safety.** If a foe makes the Catalyst card unmatchable, or the card leaves unmatched, the Catalyst moves to another card.

| Recipe | Families | While active | Unlocked at |
|---|---|---|---|
| Phoenix Pyre | Explosion + Healing | Every heal or lost heart blasts a 3×2 block. Every Set has a 25% chance to heal 1. | 1-3 ★ |
| Wildfire Echo | Fire + Echo | Every echo ignites 2 cards. Every card that burns out sets another alight. | 2-1 ★★★ |
| Judgement Beam | Laser + Grace | Every grace save fires a row laser. Every 3rd Set fires a column laser. | 2-7 ★★★ |
| Golden Hour | Coin + Time | Every coin gained adds +1s and deals 2. Every time gain hits the foe for 4. | 3-2 ★★★ |
| Seeker Swarm | Hint + Ricochet | Every hint you use ricochets into 3 cards and deals 3. Every 2nd Set gives a hint. | 2-3 ★★★ |
| Big Bang | Growth + Explosion | Every Set grows the board by 2. At 18+ cards, a Set detonates a 3×2 block. | 2-2 ★★★ |
| Bloodline | Life + Laser | Fires a row and a column laser. Every lost heart fires a row laser. Every heal makes your next Set deal ×2. | 3-8 ★★★ |
| Overclock | Connector + Time | Every 3rd Set links a new pair. A destroyed linked card adds +1s and deals 3. | 4-3 ★★★ |

The player owns both Phoenix Pyre families (Blast Powder, Mending Charm) by the time 1-3 ★ unlocks it. 1-4 teaches it with a boosted likelihood, and its ★★★ asks for 2 evolutions.

## Arcana (tarot wildcards)

`data/arcana.ts` · rules type `ArcanaRules` in `types.ts`. Each Arcana is a kiss-curse rule twist, and its card text is written from the same numbers the engine reads.

| # | Arcana | Upside | Tradeoff | Unlocked at |
|---|---|---|---|---|
| I | Monochrome Pact | Sets with exactly 1 different trait deal +3 | Rainbow ×1 instead of ×2 | 1-8 ★★★ |
| II | Prismatic Fever | Rainbow ×3, +4s on timed fights | Non-Rainbow Sets −1 base damage (min 1) | 3-6 ★★ |
| III | Controlled Burn | Every 12s at most, a wrong Set ignites 2 cards instead of costing a heart | Start with 0 graces | 2-9 ★★★ |
| IV | Glass Prism | Power and gold cards 3× as often | Max hearts locked to 1 | 4-7E ★ |
| V | Overkill Harvest | +2 coins per overkill damage; wave clears heal 1 | Foes +15% HP | 3-4 ★★★ |
| VI | Scholar's Gambit | 2× XP, 4 level-up choices | −1 max heart (min 1) | 3-5 ★★★ |
| VII | Catalyst Resonance | Catalysts 2× as often; every evolution bursts for 8 damage + 8s | Foes +10% HP | Relic Alchemist bounty |
| VIII | Tempo Surge | +25% damage, +2s per Set on timed fights | Clock 20% faster (or −1 move, min 4) | 3-6 ★ |

**Stacking** (`combineArcana`):
- Additive fields add, and `*Scale` fields multiply.
- `maxHeartsLock` and the grace override take the lowest value.
- `mistakeBurn` takes the shortest cooldown, and `pickOptions` the most.
- Rainbow multipliers combine relative to ×2, so ×1 and ×3 give ×1.5.

## Hazards (level traps)

Traps are placed by the **level** (`rules.hazards`), not the foe, so any level can use them. `every` is the number of refilled cards per new trap. There are at most 2 of each kind on the board, and every fight opens with one trap of each kind the level uses. Both are shown as a small bottom-left card icon, never a border.

| Hazard | Data | Taught | What it does | Defused by | Sprung |
|---|---|---|---|---|---|
| **Time Bomb** | `timeBombs: { every, seconds }` | 1-7 | A card shows a fuse counting down in real time, even on untimed levels. It stops while frozen. | Matching the card in any Set | Fuse hits 0: lose 1 heart, the card is replaced |
| **Snare** | `snares: { every }` | 2-2 | A card shows an arrow pointing at an existing neighbour | Matching the card it **points at**: **+4 damage** (counts even if the snared card is in the Set too) | Matching the snared card itself: the Set still scores, then costs 1 heart (`trapImmunity` prevents it) |

Defusing fires the `trapDefused` trigger and counts toward `defuseTraps`. Levels that use hazards:
- **Time Bombs only:** 1-7, 1-8, 4-6, 4-9, 4-2E2.
- **Snares only:** 2-2, 2-9, 4-10, 4-11, 5-5, 3-3E2, 4-7E2.
- **Both:** 3-10, 5-1 to 5-4.

## ★★★ challenges

Defined in `ChallengeDef` (`types.ts`). Text, progress and checks live in `engine/challenges.ts`.

**Introduction levels ask you to *use* the new thing**, never to avoid it, and the ★★ reward usually makes ★★★ easier.

| New kind | Counts | Used on |
|---|---|---|
| `useHints n` | hints spent | 2-3 |
| `graceSaves n` | graces used | 2-7 |
| `evolutions n` | evolutions triggered | 1-4, 5-1 |
| `defuseTraps n` | bombs and snares defused | 1-7, 2-2, 5-2, 3-3E2 |
| `comboReach n` | best combo | 1-3F |
| `bonusCards n` | power or gold cards matched | 2-4, 2-4C |
| `explosions n` | explosion events (weapon or rule) | 2-5, 4-3 |
| `purityChain n` | best Escalating Purity climb | 2-8 |
| `levelUps n` | in-fight level-ups | 3-5, 3-5P |
| `shopBuys n` | shop purchases | 3-4 |
| `bigHit n` | one action (a Set and everything it set off) dealing ≥ n | 1-2, 1-5, 3-3, 3-6, 2-7B, 5-5 |

The older kinds remain: `noMistakes`, `fullHearts`, `movesLeft`, `timeLeft`, `rainbows`, `streak`, `noGrace`, `hintsLeft`, and `enemy`, which uses the foe's own defeat condition.

## Fight math

`engine/run.ts` `applyMatch`

- **Card value:** each matched card is worth 1 damage (+2 on a power card), 1 coin (+3 on a gold card) and 1 XP. Power cards are dealt at 12% and gold at 10% (`data/rules.ts`), times Glass Prism's scale.
- **Set damage** = (card points + Heavy Hitter + `setDamage` + `conditionalDamage` + passive bonuses + 2 per active evolution) × the multipliers, then the purity and snare bonuses are added. The multipliers are:
  - Rainbow (×2, plus Arcana and modifier changes).
  - Evolved (×1.5 while any evolution is active).
  - Arcana `damageScale`.
  - The foe's multiplier.
  - `nextSetMultiplier` × Hot Streak. "Next Set ×N" effects add up rather than multiply (×2 and ×2 make ×3), and together with Hot Streak top out at ×4 (`BASE_RULES.maxNextSetMultiplier`).
- **Escalating Purity** (taught at 2-8): consecutive Sets with a rising number of all-different traits climb a chain.
  - Bonus damage by step is `[0, 0, 1, 3, 5, 8]`, and each step pays step − 1 coins.
  - A grace Set, a mistake, or a lower/equal diversity restarts the climb.
- **XP:** levelling needs 6 + 5 × level XP. Each level-up offers a free pick from the Armory (3 choices by default).
- **Big numbers:** damage floaters are big at ≥10, huge at ≥25 (with screen shake) and MEGA at ≥50 (with a flash). The HUD shows running damage, combo and biggest-hit counters, and Results shows total damage and the biggest hit.

### Fight log and replay

Every fight is recorded as data in `RunState.log` (`engine/fightLog.ts`), and Results has a **"What happened? See the fight"** button that opens it (`components/FightReplay.tsx`).

- **What's recorded:** one entry per move: a Set, a mistake, a hint, a level-up pick, a shop buy or a new wave. Burns and clock events (foe attacks, fuses, evolutions ending) are entries too, merged per second. Each entry holds:
  - the fight time and wave;
  - the three cards, with their power, gold and Catalyst tags;
  - the damage, split into the Set's own hit and what it triggered;
  - coins, XP, hearts and the foe's HP afterwards;
  - every event in it, with the skill node, weapon or evolution whose rule caused it.
- **Set math:** for a Set, the entry also records how the hit was worked out: card points, collateral cards from weapon procs, flat bonuses, the multiplier, purity and trap extras.
- **How it's recorded:** `emit` copies each event, plus the rule key running at the time, into the draft. `recordLog` turns them into an entry at the end of every reducer action. Entry damage always adds up to `totalDamage` (tested in `adventureFightLog.test.ts`).
- **The replay shows:**
  - a timeline of damage per move (Set hit / triggered / burns and clock), with mistakes, heart losses, picks, buys and waves marked;
  - the foe's HP and your hearts underneath on the same clock;
  - an inspector for any moment, the top damage sources for the fight and a list of every move;
  - **Copy log as JSON** for debugging.
- **Bots:** `simulateRun(...).state.log` holds the same data for any bot fight.

## Money

- **Coins drop** from every matched card and every destroyed card, and from purity steps and coin weapons. Each drop is scaled by the level's `coinMultiplier` and by Lucky Purse and `coinPercent`.
- **Coins bank even when you lose.** They only drop once Coin Drops is unlocked (1-1 ★).
- **Mid-run shop** (taught at 3-4): opens between waves. Price is 2× the weapon's base price; a reroll costs 5 + 5 per reroll. Purchases last for that fight.
- **Camp spending:**
  - Workshop items and Armory weapon tuning.
  - Every coin spent there is **100% refundable**, one item at a time or all at once.
  - Old v1 fighter levels are gone and were refunded in full on load.

### Workshop (`data/upgrades.ts`)

The Workshop opens at 1-5 ★. Each item goes on sale once its mechanic is known.

| Item | Per tier | Tiers | Costs | On sale after |
|---|---|---|---|---|
| Heavy Hitter | +1 damage on every Set | 3 | 300 / 900 / 2200 | The Set |
| Tough Hide | +1 max heart | 3 | 250 / 750 / 1800 | Hearts |
| Lucky Purse | +10% coins | 5 | 150 / 400 / 900 / 1600 / 2600 | Coin Drops |
| Hourglass | +8s on timed levels | 3 | 200 / 600 / 1500 | The clock |
| Sharp Eyes | +1 starting hint | 3 | 200 / 600 / 1400 | Hints |
| Second Wind | +1 starting grace | 3 | 250 / 700 / 1600 | Graces |
| Charm Belt | +1 charm slot (3 → 6) | 3 | 300 / 900 / 2000 | Charm slots (3-2) |
| Tarot Deck | +1 Arcana slot (1 → 3) | 2 | 800 / 2400 | Arcana slots (3-6), and you own 2+ Arcana |
| Evolution Lab | +4% evolution likelihood | 3 | 500 / 1300 / 2800 | Evolutions (1-4) |

**Weapon tuning** multiplies one number of an owned weapon: ×1.1 / ×1.2 / ×1.35 / ×1.5 for 60 / 150 / 320 / 600 coins, per number, on top of its level. Levels are found in the world, never bought. Old saves get every coin they spent on Workshop weapon levels back (at the old rarity prices, `LEGACY_WEAPON_LEVEL_COSTS`).
Losing a Charm Belt or Tarot Deck tier also unequips whatever no longer fits.

## Bounty Board

`data/bounties.ts` · UI `BountyBoard.tsx`. The board opens on the first star at 1-8.

- There are **19 cross-run bounties** in four categories: mastery 6, chaos 6, roster 4, explorer 3.
- Every fight advances lifetime counters (`bountyStats`), whether it was a win, a loss or a replay.
- Rewards are coins, Armory weapons (or +1 level of one you own) and one Arcana (Catalyst Resonance).
- Completions cascade in one pass, so a coin bounty can complete another.

## Code map

```
src/adventure/
  types.ts              LevelDef, MechanicDef, FighterDef, PassiveDef, SkillNode, EvolutionRecipe,
                        ArcanaRules, RunState, AdventureSave
  rules/types.ts        the shared rule vocabulary (triggers, conditions, effects, modifiers)
  rules/engine.ts       the interpreter: drain(), conditions, effects, doubling, loop safety
  data/levels.ts        ← THE campaign table (main path + side branches)
  data/mechanics.ts     lessons, quizzes, fight tips, coach marks
  data/fighters.ts      six fighters, two passives each
  data/passives.ts      passive tuning keys + player text
  data/skillTrees.ts    120 skill nodes
  data/adventureWeapons.ts  rule weapons
  data/armory.ts        weapon lookup at a build (level + tuning), old-id resolution
  data/weaponStats.ts   weapon numbers: levels (flat), tuning (multipliers), wording
  data/weaponTuning.ts  Adventure's numbers and extra effects for the weapons shared with Free Play
  data/weaponRoles.ts   which Armory shelf each weapon sits on
  engine/gear.ts        trick weapons: marks, bounties, stacks, album pages, twins, fog, curses, chains, chest…
  balance/              the balance lab, its targets, the report and the HP tuner (docs/balance-system.md)
  data/evolutions.ts    weapon families + 8 recipes
  data/arcana.ts        8 Arcana + stacking
  data/upgrades.ts      Workshop items (+ old weapon-level prices, for refunds)
  data/bounties.ts      cross-run bounties
  data/features.ts      campaign systems that start locked (coins, workshop, bounties)
  data/rewards.ts       what a reward unlocks, and "Earn ★★ on 1-7…" unlock hints
  data/biomes.ts        worlds, star gates, palettes, music arrangement
  data/foes.ts          FoeDef → enemy instance or sparring foe
  data/rules.ts         base fight constants (Rainbow ×2, power/gold chances…)
  data/story.ts         story pages (placeholder text)
  loadout.ts            what the fighter brings into a level (slots, features, stats)
  progress.ts           pure rules: unlocks, rewards, star pool, purchases, refunds, migration
  weaponLevels.ts       a weapon's level (copies found) and Workshop tuning purchases
  save.ts               MMKV persistence (key adventure_v2_save, version 1)
  lessons.ts            lessons still to play, save-dependent lesson pages
  engine/run.ts         pure reducer for one fight (seeded RNG), createRun, computeStars
  engine/fight.ts       draft state + primitives (damage, hearts, area destruction, Catalyst & trap placement)
  engine/sources.ts     live rule sources, modifier combining, EVOLUTION_RULES
  engine/passives.ts    fighter passive behaviour
  engine/evolutions.ts  starting, extending and ticking evolutions
  engine/hazards.ts     Time Bomb and Snare resolution
  engine/challenges.ts  ★★★ text / progress / checks, star goals
  engine/sets.ts        Set finder
  engine/fightLog.ts    the per-fight log behind the results-screen replay
  engine/bot.ts         headless bot that plays through the reducer
  engine/botBuilds.ts   how a bot gears up: stars by skill, skill-tree buying, charms and recipes
  components/           Map, Preview, MechanicIntro, Run (+RunFx), Results, UnlockReveal,
                        Camp, SkillTree, BountyBoard, FieldGuide
  AdventureMode.tsx     screen router, onboarding
src/audio/              Game Boy–style synth (no audio files)
```

The fight UI reuses the shared `GameBoard` and `Card`, so weapon effects, fire, lasers and auto-hints behave as in Free Play.

## How to add X

**A skill node.**
- Add a row to the fighter's `nodes` in `TREES` (`data/skillTrees.ts`) and link it into `paths` (consecutive keys in a path are linked; `P1`/`P2` are the passives).
- A row is `[name, icon, text, body, cost, [col, row], 'sealed'?]`. Build `body` with the helpers: `rule(T.x, [E.y], [C.z], 'Callout!')`, `tune('key', delta)`, or `{ modifiers: … }`. Cells are on a 7-column grid; one node per cell.
- Keep `text` exact, ≤ 90 chars and true in any buying order.
- Never rename a key: ids come from keys. Saves are normalized on load, as described under Skill trees.
- A new tuning key goes in `PASSIVE_TUNING` and the passive's `TEXT` (`data/passives.ts`), and is read with `tuning(d, key)` in `engine/passives.ts`.
- A new trigger, condition or effect needs:
  - The type in `rules/types.ts`.
  - Handling in `rules/engine.ts` (`triggerMatches`, `holds`, `applyEffect`).
  - An `enqueue` from the primitive that causes the event.

**A weapon with rules.**
- Add one entry to `ADVENTURE_WEAPONS` (`data/adventureWeapons.ts`):
  - A plain id (no rarity suffix), with `effects: {}` and `maxCount: 1`.
  - Put the behaviour in `rules` / `modifiers`, and its levels 2-4 in `levels` (each with a short `text`).
  - Pick a `specialEffect` (it maps to a weapon trigger kind for Big Scoop's "trigger every weapon").
- Register the icon in `src/components/Icon.tsx`.
- Grant it from a star reward (`weapons: [...]` in `levels.ts`) or a bounty, because the Armory only fills from rewards. Naming it again in later rewards (at most 5 in all) gives levels; give it a `perLevel` for every number and wording in `weaponStats.ts`.
- To let it arm a recipe, add its id prefix to a family in `FAMILIES` (`data/evolutions.ts`).

**An evolution recipe.**
- Add an entry to `EVOLUTION_RECIPES` (`data/evolutions.ts`): two `FAMILIES` from different roles that share no weapon, `familyText`, `activeText`, `flavor`, and the `source` rules that are live for 20s.
- Table order is the start priority.
- Unlock it with `evolution: '<id>'` on a star reward. Ideally the level that grants it is one where the player already owns both families.

**A level.**
- Add an entry to `RAW_LEVELS` (array order is main-path order) or to `BRANCHES` with `branchOf`. It needs:
  - `introduces`: one `MECHANICS` id. If the mechanic is new, add it with its `kind`, `enables` flag, lessons/quiz/fightTips and coachMark.
  - `rules`: traits, moves or timer, hearts, hints, graces, hazards, evolutionLikelihood.
  - `foes`: `{ enemy: '<registered name>' }` for real foe effects, or a cosmetic `name`/`icon`. Several entries make waves.
  - `challenge`, `coinMultiplier`, `difficulty`, `rewards` (coins may be omitted) and `recommended`.
- Keep the rules: one new thing per level, a ★★★ that asks to use it, and a ★★ reward that helps.
- Check the world's `starGate` in `data/biomes.ts`, then run the balance bots.

**A hazard.** Hazards are hand-coded, not data.
1. Add the shape to `LevelHazards` (`types.ts`) and a card field to `Card` (`src/types.ts`).
2. Placement goes in `engine/fight.ts`: a `place…` function, `countHazardRefills`, `syncTraps`, the eligibility checks (`trapEligible`, `catalystEligible`), and `MAX_TRAPS_PER_KIND`.
3. Resolution goes in `engine/hazards.ts`: `resolveTrapsOnSet`, a tick if it has a timer, and `placeOpeningTraps`. Call `defused()` so `trapDefused` and `defuseTraps` count it.
4. Draw a small bottom-left icon in `src/components/Card.tsx`, never a border.
5. Teach it:
   - A `MECHANICS` entry plus a level that `introduces` it.
   - A `COACH_KEYS.hazard` first-fight tip in `AdventureRun.tsx`.
   - The hazard rows in `LevelPreview.tsx` and `FieldGuide.tsx`.
   - The seen keys in `createMaxedSave`.

**A foe effect.** Compose a new enemy from `src/utils/enemyEffects.ts`, register it in the enemy factory, then reference it with `foes: [{ enemy: 'Name', hp }]`.

**A feature flag.** Add it to `FeatureFlag`, set `enables` on its mechanic, and read it from `run.features` in the engine and HUD. If it should be unlocked by a star instead of by map position, add a `data/features.ts` row and its save flag.

## Balance bots

The whole system (the lab, the report, level balance and the HP tuner) is described in [balance-system.md](./balance-system.md). The notes below cover the level-balance and build checks.

Target feel (bare vs invested player, by world): [balance-philosophy.md](./balance-philosophy.md).

```
ADVENTURE_BALANCE_REPORT=1 npx jest __tests__/adventureBalance.test.ts
```

- **Two players, by world** ([balance-philosophy.md](./balance-philosophy.md)): the same average-skill bot plays every level twice.
  - **Bare** (`barePlan`): no stars, no Workshop, random charms, random picks and buys. Target wins 50 / 30 / 10 / 0 / 0%.
  - **Invested** (`investedPlan`): every star on offer spent (plan style), every Workshop upgrade on sale maxed, its charms tuned to ×1.5, a solid build (a recipe pair plus damage weapons), picks and buys that chase recipes. Target wins 97 / 90 / 80 / 70 / 50%.
  - "Win" is a knockout. Bosses and elites are a step harder for the invested player, fighter trials a step kinder; `winTargets` in `engine/botBuilds.ts` has the per-level rules.
- How a run gears up (`engine/botBuilds.ts`, a `BuildPlan` passed to `starDistribution`): gear, recipes, Arcana and free weapon levels come from 3★ on every earlier level (`applyLevelResult`); then the plan buys a skill tree (`plan` / `spread` / `random` style), picks a random unlocked fighter (trials use their fighter) and charms ('random', 'solid' or 'mixed'), and optionally maxes the Workshop and tunes the charms. 3-2's puzzle keeps its named charms.
- The test checks every level is within 20 points of both targets, every world's mean within 10, both players find each world harder than the last, and the evolution level shows the invested player an evolution.
- Foe HP in `levels.ts` is tuned so both players land as close to their targets as one number allows. **If you change skill trees, the Workshop, tuning, weapons or evolutions, retune HP**: both curves move with them.

### Broken builds

```
ADVENTURE_BUILDS_REPORT=1 npx jest __tests__/adventureBuilds.test.ts
```

Plays a training dummy (a World 4 board, 25 Sets, a foe that can't fall) with endgame gear (every weapon at level 5, every number tuned to ×1.5) and compares damage per Set:

- every weapon alone, and every pair of weapons that arms each evolution (a recipe may beat the best single weapon by up to 1.75×, and every recipe must actually fire);
- every fighter's full tree with the best single weapons and with each recipe (≤ 2× that fighter's best single; no fighter's best build over 1.6× the median fighter's);
- 30 random endgame builds (fighter, full tree, 3–6 charms, 0–3 Arcana): none over 2.75× the median.

The same file checks the other end, **nothing is a dead pick** (`FLOORS`): in a real timed fight (3 minutes, 5 hearts, the same foe that can't fall, nothing picked up or bought on the way, `simulateRun(..., { skipPicks: true })`):

- every weapon alone deals at least 1.15× the damage of no weapon at all (weapons that only wake up on a lost heart are played by the bot that slips most, and must reach 1.05×);
- every evolution deals more than its two weapons with evolutions switched off (≥ 1.04×), and the middle recipe at least 1.2×.

Limits live in `LIMITS` at the top of the test. Things this sweep caught: next-Set ×N effects multiplied (now they add up, max ×4), board-wide power turned every card into a power card (now it's a separate charge), the board-growth trigger fired on a full board, Blast/Laser/Ricochet damage levels didn't reach the weapons' own procs, Patience counted almost every Set at 4–5 traits (now 2.5 s per trait), Sly Fox's "Combo 4+" payoffs fed their own Combo steps, and Corgi's power-card nodes fired on every Set.

## Save and migration

- **Storage:** `save.ts` stores JSON under `adventure_v2_save`. A save that can't be read is copied to `adventure_v2_save_unreadable` before a new save replaces it.
- **New fields:** loading fills them from `createNewSave()`.
- **v1 migration** (`migrateSave`):
  - Fighter levels are refunded in full (`LEGACY_FIGHTER_LEVEL_COSTS` 60 → 1900).
  - `charm` becomes `charms[]`, and `activeArcana` becomes `equippedArcana[]`.
  - Workshop weapon levels are refunded (see below).
  - A migrated save is written straight back, so the refund is paid once.
- **Merged weapons** (`migrateWeaponIds`, ids in `LEGACY_WEAPON_IDS` / `LEGACY_ADVENTURE_WEAPON_IDS`):
  - Old rare/epic/legendary copies become their one weapon; charms map the same way without duplicates.
  - Owning a stronger copy sets a floor on that weapon's level (`legacyWeaponTiers`, e.g. Blast Powder rare/Inferno Charge → level 3). An epic bundle becomes its main weapon with a floor (Terra Foundation → Field Stone level 3, Entropy Engine → Chaos Shard level 3; the Entropy Engine evolution comes from its level's reward).
  - Every Workshop weapon level ever bought is refunded at the rarity price it was bought for (`LEGACY_WEAPON_LEVEL_COSTS`): levels are world-only now.
  - Mastery weapons, cap-raising legendaries, Fortune's Eye and Snowball are dropped without a refund (they were rewards).

## Audio (poteto's approach)

- **The synth:** every sound is synthesized live by `src/audio/chip.ts`, a Game Boy–style chip: two pulse voices with selectable duty, a 4-bit wavetable bass and LFSR noise drums.
- **Songs are text** in `src/audio/songs.ts`. One theme melody plays under several arrangements: `map`, each world (`meadow`, `woods`, `canyon`, `peaks`) and `boss`, which World 5 also uses.
- **Switching arrangement** waits for the next bar line, so moving from the map into a fight sounds like the song continuing.
- **Platforms:** on the web, `playSound()` routes to the chip. Native keeps the bundled samples.
- **Debugging:** in the browser console (dev builds), `__nshapesAudio.sfx('rainbow')`, `__nshapesAudio.music.play('boss')`.
- **Verifying without speakers:** `renderOffline({ plan: [{ arrangement: 'map', bars: 4 }, { arrangement: 'boss', bars: 4 }], sfxReel: ['coin', 'hit'] })` renders through an `OfflineAudioContext` into an `AudioBuffer`. Measure peak/RMS, run Goertzel pitch checks, or encode a WAV.

## Dev
- `/dev/adventure?save=maxed`: every star, unlock and Workshop item, plus 50k coins. Skill trees are left empty to spend by hand. The save is persisted once you play.
- `/dev/adventure?save=fresh`: a brand-new save.
- `/dev/adventure?autoplay=true`: the board plays itself.
- `/dev/fighters`: fighter animation studio.

## Status and next steps
- The story text in `data/story.ts` is a placeholder waiting for the real story.
- Free Play weapon descriptions were written for score modes. `adventureText()` in `UnlockReveal.tsx` swaps "+N points" for "+N damage".
- Re-run the balance report after any change to foe HP, rule weapons, skill nodes, or Workshop and Arcana numbers.
- iOS audio: `unlockAudio()` in `src/audio/index.ts` unlocks on touchend/click and sets `navigator.audioSession.type = 'playback'` so the silent switch does not mute the game. This still needs confirming on a real iPhone.
