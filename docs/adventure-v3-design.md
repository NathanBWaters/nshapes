# Adventure v3 — build spec

This spec turns the Nov 11 design notes into concrete rules. Where the notes were
open, the decision is marked **Call:**. `docs/adventure-design.md` stays the
player-facing description and is updated once this ships.

The core idea: the fun is in stacking **2 fighter passives + their skill tree +
up to 6 charms + timed evolutions + up to 3 Arcana**. Every one of those is
written in one shared rule vocabulary (`src/adventure/rules/types.ts`) and
interpreted by one engine module, so any source can chain into any other
(a heal can cause an explosion, an explosion can add a combo step, …).

---

## 1. Rule vocabulary (`src/adventure/rules/types.ts`)

- `Rule` = trigger + optional conditions + effects. `Modifiers` = standing changes.
- Sources: fighter passives (always on), unlocked skill nodes, equipped charms
  (adventure weapons may carry rules), active evolutions (only during their
  20 s window), Arcana.
- **Chaining:** effects that fire weapon behaviour (`explode`, `laser`, `ignite`,
  `heal`, `coins`, `time`, `hint`, `grace`, `xp`, `growBoard`, `trigger`) emit a
  `weapon` trigger of their kind, so other rules can react. To stop loops, a
  rule can't be re-entered from its own effects, and one action resolves at most
  32 rule firings.
- `doubleNext`: the next weapon trigger resolves twice (both copies emit their
  triggers).
- Area effects use the 3-column grid. `block` picks a random anchor that fits.
  Armored cards lose a hit instead of being destroyed. The Catalyst card is never
  destroyed by area effects.
- Destroyed cards pay the collateral rewards that GameBoard already uses
  (explosion 1, laser 2, ricochet 1, connected 1 damage; 1 coin each).

## 2. Fighters: two passives each, unrelated to weapons

**Call:** fighters no longer have starting gear or an active button. Their
identity is two passives that change *how you play*. Charms are your whole
weapon loadout. The three old actives become passives.

| Fighter | Passive 1 | Passive 2 | Plays like |
|---|---|---|---|
| Orange Tabby | **Nine Lives**: once per fight, a knockout leaves you on 1 heart | **Scrappy**: +1 damage per missing heart on every Set | Risky brawler: low health is a weapon |
| Sly Fox | **Combo**: Sets within 5 s chain, +1 damage per step (max +4); a mistake breaks it | **Hot Streak**: at max Combo your next Set deals ×2 | Speed: never stop moving |
| Badger | **Grudge**: each mistake stores a grudge (max 3); the next Set releases +3 damage per grudge | **Thick Hide**: your first mistake each wave costs no heart | Gambler: guessing is allowed, even good |
| Emperor Penguin | **Patience**: a Set made 6 s+ after the last one deals +3 | **Deep Freeze**: every Rainbow Strike freezes the clock and the foe for 4 s | Precision: slow, deliberate, Rainbow hunter |
| Corgi | **Zoomies**: every 5th Set re-deals the board clean (duds and hidden cards gone) | **Fetch**: matching a power or gold card brings a new one onto the board | Board shaper: hunts bonus cards |
| Pelican | **Big Scoop**: every 6th Set, a free Set is scooped for you | **Keen Eye**: after 8 s without a Set, one card of a Set glows (free) | Relaxed: the board helps you |

Passive numbers live as **tuning keys** (e.g. `combo.windowMs`, `combo.max`,
`grudge.max`, `grudge.damage`, `patience.ms`, `patience.damage`,
`deepFreeze.ms`, `zoomies.every`, `scoop.every`, `keenEye.ms`,
`scrappy.perHeart`, `thickHide.perWave`, `hotStreak.multiplier`,
`nineLives.charges`). Skill nodes change them through `passiveTuning`.

## 3. Skill trees (stars)

- **Call:** 20 nodes per fighter: two branches of 10, one rooted at each passive.
  The roots (the passives) are owned for free.
- A node can be bought only if the node before it in its branch is owned, so
  there is no skipping. Every node is visible and readable; locked nodes show
  their text dimmed with a lock.
- **Call: stars are the currency, in one shared pool across fighters.**
  Available = total stars earned − stars spent in all trees. Biome star gates
  still count *earned* stars, so spending never re-locks a world.
- Node costs by depth: `1, 1, 1, 2, 2, 3, 3, 4, 5, 6` (28 per branch, 56 per
  fighter). The campaign pays out about 160 stars, so a player can max roughly
  two or three fighters. That keeps choices real while refunds keep it painless.
- **Refunds:** a full refund per fighter, free and any time, in Camp. **Call:**
  you can only refund whole branches, from the tip down, so nothing you keep
  needs a missing parent.
- Content rules: about a third of the nodes tune the passive; the rest build
  cross-system chains (heal → explode, explosion → combo step, rainbow → spawn
  Catalyst, mistake → laser, …), encourage a play pattern, or change how weapons
  behave. Depths 8–10 hold the build-defining nodes. No node is a bare "+1 heart".
- Data: `src/adventure/data/skillTrees.ts`; each node is `{ id, branch: 0|1,
  depth: 1..10, name, text, cost, source: RuleSource }`.

## 4. Charms and Arcana slots

- **Call:** start with **3 charm slots**. The Workshop item "Charm Belt" adds a
  slot per tier, up to **6** (tiers at 300 / 900 / 2000 coins).
- Charms are Armory weapons. The pre-fight preview has the charm picker, with
  quick equip and unequip. Duplicates of the same id are not allowed.
- **Arcana:** start with **1 slot**. The Workshop item "Tarot Deck" adds slots up
  to **3** (tiers at 800 / 2400 coins, sold once you own 2 Arcana). **Call:**
  stacking combines them. Additive fields add, `*Scale` fields multiply,
  `maxHeartsLock` takes the lowest, and `mistakeBurn` takes the shortest
  cooldown.
- Save migration: `charm` becomes `charms: string[]`; `activeArcana` becomes
  `activeArcana: ArcanaId[]`. Fighter levels bought with coins are refunded in
  full. Weapon upgrade tiers stay.

## 5. Evolutions: a 20-second power trip

- A **recipe** = two weapon families from different roles, plus an evolved rule
  set. It is **armed** in a fight when you hold both families among your charms
  or picks.
- While a recipe is armed, refills may spawn the **Evolution Catalyst** card.
  The spawn chance is the **evolution likelihood**:
  - Base 12 % per refilled slot batch.
  - Workshop "Evolution Lab" adds +4 % per tier (3 tiers).
  - Weapons and nodes can add more; Catalyst Prism adds more on Rainbows.
  - One Catalyst on the board at a time, as before.
- **Call:** matching a Set that includes the Catalyst triggers the evolution
  for **20 s**. There is no more "priming" and no shattering, because the notes
  ask for evolutions to be easy to pull off and feel powerful.
- **Up to 3 evolution triggers per fight.** **Call:** this cap is shared across
  all recipes; nodes and Arcana can raise it. If more than one recipe is armed,
  the Catalyst triggers the one not currently active (ties go to recipe order).
  Several can run at once.
- While active, the recipe's rules are live, plus a flat +1 damage on every Set.
  The UI shows each active evolution with its countdown ring, a big banner on
  start, and the board pulses. The pulse is a background glow, never a card
  border.
- First recipe: **1-3 ★ unlocks Phoenix Pyre** (Blast Powder + Mending Charm).
  The player owns both by then (1-1 ★★ and 1-2 ★★). In 1-4 the likelihood is
  high enough that a normal run triggers it at least once.
- Recipes. Every one is cross-role; none is "damage + damage" or "heal + max
  heart":

| Recipe | Families | While active |
|---|---|---|
| Phoenix Pyre | explosion + healing | Every heal **or** heart lost blasts a 3×2 block (6 cards). Sets heal 1 on a 25 % roll. |
| Wildfire Echo | fire + echo | Every echo ignites 2 cards; burning cards that burn out ignite a neighbour. |
| Judgement Beam | laser + grace | Grace saves fire a row laser; every 3rd Set fires a column laser. |
| Golden Hour | coin + time | Every coin gained adds +1 s; every 5 s gained deals 5 damage. |
| Seeker Swarm | hint + ricochet | Each hint (manual or auto) makes the hinted cards ricochet into 2 others. |
| Big Bang | growth + explosion | Sets grow the board by 2; at 18+ cards the next Set detonates a 3×3 block. |
| Bloodline | life (max hearts) + laser | Heart lost: lasers a row; heal: next Set ×2. |
| Overclock | connector + time | New links form on every Set; a linked card destroyed adds +2 s and 2 damage. |

Data: `src/adventure/data/evolutions.ts` (rewritten). `EvolutionRecipe = { id,
name, icon, families: [string[], string[]], roleText, activeText, source:
RuleSource, flavor }`.

## 6. Weapons

**Call:** new weapons are adventure-only and live in
`src/adventure/data/adventureWeapons.ts` as `Weapon & RuleSource`. They join the
Armory, shop and picks through `getArmoryWeapon`. Free Play stays as it is.

New weapons, each with a common and a rare tier:

| Weapon | Role | Effect |
|---|---|---|
| Clarity Lens | utility | 3 Sets within 10 s: 33 % (rare 50 %) chance to simplify the board for 15 s. One attribute becomes the same on every card. |
| War Drum | offense | 5 Sets within 20 s: every card on the board gains +2 power. Workshop upgrades raise it to +3 / +4 / +5. |
| Amplifier Coil | combo | Every 4th Set (rare: every 3rd): the next weapon trigger happens twice. |
| Piñata | offense | Each Set has a 20 % (rare 35 %) chance to give a random card +2 hits; breaking it deals +10. |
| Catalyst Prism | evolution | +6 % evolution likelihood (rare +10 %); Rainbow refills get +25 % more. |
| Rally Horn | offense | First Set of each wave deals +6 (rare +10). |

**Unlock order:** rewards alternate offense and support. The first three are
offense, support, offense: Blast Powder (1-1), Mending Charm (1-2), Flint Spark
(1-4). The clearest, most key items come first.

## 7. Traps (by 1-7)

Traps are level hazards (`rules.hazards`), not foe abilities, so any level can
use them.

- **Time Bomb** (introduced in 1-7): a card shows a fuse ring and a seconds
  counter. Match it before it hits 0, or lose 1 heart and the card is replaced.
  This reuses the existing countdown card state, placed by the level instead of
  the foe.
- **Snare** (introduced in 2-2): the card shows an arrow (up/down/left/right)
  pointing at a neighbour. **Matching the snared card itself** still scores, but
  costs 1 heart. **Matching the card it points at** defuses it: +4 bonus damage
  and the `trapDefused` trigger. Snares only point at a card that exists.
- Card visuals follow CLAUDE.md: a small state icon in the bottom-left corner,
  never a border. The snare icon is an arrow rotated to the direction.
- Level data: `hazards?: { timeBombs?: { every: number; seconds: number };
  snares?: { every: number } }`. `every` is the number of refilled cards per new
  trap; at most 2 of each kind on the board.

## 8. Levels: teach it, then reward using it

- **Never discourage a mechanic in the level that introduces it.** The ★★★
  challenge there asks you to *use* the new thing, and the ★★ reward makes ★★★
  easier (usually a weapon or recipe that feeds it).
- New challenge kinds: `useHints n`, `graceSaves n`, `evolutions n`,
  `defuseTraps n`, `comboReach n`, `bonusCards n`, `explosions n`,
  `purityChain n`, `levelUps n`, `shopBuys n`, `bigHit n` (a single Set dealing
  ≥ n). Old kinds stay for non-introduction levels.
- Every level should play like a small puzzle: its rules, foe, hazard and
  challenge point at a tactic the player's current tools can solve.

## 9. Worlds and routes

**Call:** worlds grow up to World 4, and World 5 is short and sharp.

| World | Main levels | Side branches | Theme |
|---|---|---|---|
| 1 Sunny Meadow | 8 | 1 | basics, first evolution, Time Bombs |
| 2 Whispering Woods | 9 | 3 | foe tricks, snares, hints, graces |
| 3 Ember Canyon | 10 | 4 | shading, waves, shop, XP |
| 4 Frozen Peaks | 11 | 5 | five traits, stacked builds |
| 5 Starfall Summit | 5 | 0 | finale: every system at once |

- Branches open at ★★ on their parent, as before. Some World 3–4 branches chain
  (a branch off a branch), so the map has real alternate routes. World 5 is
  gated by stars and plays as one boss gauntlet.
- World 5 uses the `boss` music arrangement and a new palette.

## 10. Big numbers

- Damage floaters scale with the hit: ≥10 big, ≥25 huge with screen shake, ≥50
  "MEGA" with a flash.
- A fight-long running damage counter and a combo/chain counter sit by the foe
  HP bar. Doubled triggers show "×2".
- Evolution start: full-width banner and sound. Active evolutions show
  countdown rings.
- Results show the biggest hit and the total damage.
