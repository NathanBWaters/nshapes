# Balance philosophy (rough sentiment)

The designer's high-level feel for Adventure difficulty, recorded so tuning has
a north star. These are rough targets, not hard rules. "Winning" can mean
different things per level (knockout, ★★★…); read it as "knocks the foe out"
unless a level says otherwise.

## Balancing on All Three Stars (`★`, `★★`, `★★★`) & Mobile FTUE Pacing

Following mobile 3-star best practices (*Angry Birds*, *Cut the Rope*, *Royal Match*, *Plants vs. Zombies*) and Sakurai's risk-reward & accessibility principles, campaign levels are balanced on **the entire 3-star funnel**, never on knockout win rate alone:

- **`★` (Stage Clear — Welcoming, Never a Permanent Wall):** Clearing a stage unlocks the next node on the map and frames the outcome positively (`STAGE CLEAR!`). In World 1, even a bare player clears `>= 95%` of attempts (`100%` on `1-1`). Late-world bosses (`4-11`, `5-5`) still target `≥ 25%` Bare `★` survival so progression feels huge without turning into a hopeless math wall.
- **`★★` (Knockout — Skill Always Matters, Progression Pays Off Big):** Knocking out the foe within the move/time budget. Easy in World 1 (`~80%` bare, `~98%` invested), then diverging cleanly as progression layers kick in. Skilled bare play (`barePlan`: random Lv1 charms, 0★, 0 Workshop) remains viable on World 4–5 non-boss stages (`~15–20%` W4, `~10–15%` W5), while prepared invested mastery wins reliably (`~82–85%` W4, `~75–80%` W5) instead of flipping a 50% coin.
- **`★★★` (Mastery — Crisp Challenge, Never an RNG Sweat):** Completing the level's mini-goal alongside a knockout. In World 1, average invested players hit `★★★` `~72%` of the time and pro players (`BOTS.expert`) clear **`>= 75%` on every level** (`~85%+` mean). Across Worlds 2–5, organic first-try `★★★` tightens gradually toward `~30%` to reward mastery and replays.

| Metric / Tier | World 1 | World 2 | World 3 | World 4 | World 5 |
|---|---|---|---|---|---|
| **Bare `★1+` (Stage Clear floor)** | ≥90% (~97% mean) | ≥65% | ≥40% | ≥25% (Boss ≥25%) | ≥20% (Boss ≥25%) |
| **Bare `★★+` (Knockout target)** | ~80% (~85% on 1-2..1-5) | ~45% | ~25% | ~15–20% (non-boss) | ~10–15% (non-boss) |
| **Invested `★★+` (Knockout target)** | ~98% | ~92% | ~88% | ~82–85% | ~75–80% |
| **Invested `★★★` (Mastery target)** | ~72% (Pro ≥75%/lvl) | ~60% | ~50% | ~40% | ~30% |

### Pacing, Star Gates, Relief & Upward Wagers (`[GP-09]`, `[GP-17]`, `[GP-18]`)

- **Crisp Mobile Sessions (`LONG_ROUNDS = 1.25×`):** World 2–5 fights target **75–110s** (`4-11` boss `160s`, `5-5` 3-head boss `180s`). Unfair `instantDeath` inactivity timers are replaced with telegraphed **`−2 ♥` Heavy Slams**.
- **`≤ 2` Simultaneous External Pressures:** Non-boss and standard stages showcase at most 2 external board pressures (`Shading Surge`, `Specific Counter-Parry`, `Board Hazards`, `Active Foe Tick`), reserving 3 strictly for the phased `5-5` finale so players can read and counter every threat.
- **Peaks & Valleys + Softened Star Gates:** Worlds 3–5 weave breather/recovery stages (`3-4`, `3-7`, `4-3`, `4-7`, `5-2`) with generous clocks, lighter HP, and high coin multipliers between spike bosses. Biome star gates sit at **`10 / 24 / 46 / 76★`** (down from `12 / 30 / 56 / 90★`).
- **Friendly Tailwind (Loss-Streak Relief):** After **2 consecutive defeats** on a level (`consecutiveLosses[levelId] >= 2`), a zero-shame 1-tap **Friendly Tailwind** toggle appears on `LevelPreview` (`+2 ♥`, `+20%` clock/moves, `+25%` slower Parry wind-ups), capped at **`TAILWIND_STAR_CAP = 1` (`★`)** so players always move forward while `★★`/`★★★` mastery remains full strength. Telemetry stamps `tailwindActive: true` so Tailwind runs stay cleanly separated from standard balance cohorts.
- **3-Loss World 3–5 Stuck-Nudge:** After **3 consecutive defeats** on a World 3–5 level, a gentle single-card stuck-nudge illuminates after 25 quiet seconds without spoiling the whole Set.
- **Retreat & Pre-`1-8` Progress Feel:** Retreating after `≥ 5` Sets retains **`50%` of earned fight coins**. On pre-`1-8` defeats (before Coin Drops unlock), `5–10¢` quietly banks into `hiddenPurse` and bursts open when `1-8` (*Shiny Loot*) unlocks coins.
- **Starfall Cauldron (World 2+ Upward Coin Wager):** Veterans can dial difficulty UP on `LevelPreview` — `+1 Bold` (`50¢` stake: `+25%` foe HP, `10%` faster Parries → `1.5×` coins + `2×` stake on KO) or `+2 Starfall` (`150¢` stake: `+50%` foe HP, `20%` faster Parries → `2.0×` coins + `2×` stake on KO).

### Progressive Onboarding (World 1 → World 2)

New players get powers and flow **before** meta-economies:
1. **Constrained 2-trait boards first (`1-1`..`1-4`):** Keep `shape` + `color` (9 cards) across 4 levels while granting `Blast Powder` right on `1-1` `★1`, `Rainbow Charm` on `1-2`, and `Mending Charm` on `1-3`. `1-4` adds Sunny Gecko's gentle 3s visual hop gag, and Golden Key #1 sits right at **`1-4 ↔ 1-5`** so players rescue Fighter #2 in time for `1-5`.
2. **Gradual puzzle expansion (`1-5`..`1-7`):** Introduce `Number` (`1-5`), `Rainbow Strike` (`1-6`), and `Skill Trees` (`1-7`), with `2.5s` micro-Stagger on every timing Parry so beginners feel Tension → Release immediately.
3. **Delayed currencies & meta-systems (`1-8`..`2-2`):** Hide coin UI clutter until `1-8` (*Shiny Loot* with Golden Mole's gleaming Gold card + hidden purse burst), open `The Workshop` on `1-9`, award `Phoenix Pyre` + `Bounties` on the `1-10` boss, and teach `Evolutions` on `2-2`.

## What this says

- Progression is deeply rewarding: skill trees, Workshop tuning, weapons, and evolutions create a huge power ramp, lifting World 4–5 knockout odds from `~10–20%` bare to `~75–85%` invested.
- Prepared mastery wins reliably in Worlds 4–5 (`75–85%`), while players craving harder risk can raise the Starfall Cauldron wager.
- Raw puzzle skill stays respected all the way to the Summit instead of hitting artificial `0%` math walls.

## Weapons and evolutions: sharp role identities, zero dead picks

The game should be exciting to play, not just fair. Weapons and evolutions are
tuned to these principles:

1. **Sharp, distinct roles (`[GP-11]`):** Pure utility, survival, board, and insight weapons shine through amplified utility (Over-Shields, trait simplification, hint economy, extra picks, coin/XP engines) rather than bolted-on raw DPS riders. Every weapon earns its slot through a crisp one-sentence job.
2. **Weapon-driven `POWER ×N` (`[GP-01]`):** Every one of the 64 Armory weapons earns transparent Power points from its own mechanic across 4 authored tiers (`frequent`, `tactical`, `feat`, `amplifier`), scaling cleanly across weapon levels 1–5 (`1.00× → 2.00×`) into the smooth C¹ curve (`P <= 3 ? 1 + P : 2 + 2 * sqrt(P - 2)`).
3. **Things happen reliably (`[GP-19]`):** Whole-number stats scale at clean integer breakpoints across Lv 1–5 with zero fight-start fractional coin flips, and low-% procs use damped entropy accumulators so dry streaks never ruin a build.
4. **An evolution is a signature rule rewrite (`[GP-12]`):** Halving the generic chassis crutch lets each of the 208 recipes shine through bold bespoke verbs while multiplicative stacking rewards forging multiple concurrent evolutions.
5. **Strong is fine, runaway is not:** Anti-infinite safeguards remain (`hintUsedThisSet`, finite `timeBank` capping clock extension at `2×`), while legitimate player-engineered burst setups pay out cleanly without hidden ceilings (`[GP-03]`).
6. **A harder board should pay more:** Board gambles (`Cursed Idol`, `Chain Gang`, `Rust`, `Greedy Chest`…) trade board safety for high payoff and never deadlock the board.

Rough bands, measured on a training dummy with endgame gear (level 5, fully
tuned), as damage per fight against no weapons at all:

| | Weakest | Typical | Strongest |
|---|---|---|---|
| A damage weapon alone (Blast, Flint, Chaos Shard, War Drum, Ray) | ×2.7 | ×3 | ×4 |
| A utility / support / engine weapon (measured via `inBuild` & Human Gauntlet lift, not solo dummy DPS) | ×0.95 solo / ×1.08 in-build | ×1.5 in-build | ×2.6 in-build |
| An evolution, over its two weapons without it | ×1.25 | ×1.45 | ×2.2 |

These are enforced by the balance lab ([balance-system.md](./balance-system.md)):
every weapon is measured with and without, alone and inside real builds, for
novice, average and expert bots, against the role-aware bands in
`src/adventure/balance/targets.ts`.

## How the balance bots use this

`__tests__/adventureBalance.test.ts` plays every level with both players
(`engine/botBuilds.ts` `barePlan` / `investedPlan`) and checks the 3-star funnel:

- **Bare:** 0 stars spent, no Workshop, random charms, random level-up picks
  and shop buys (never chases a recipe).
- **Invested:** every star on offer before the level spent (plan style:
  capstones first), every Workshop upgrade on sale by then at its top tier,
  the charms it brings tuned, a solid build (both halves of a random recipe,
  then damage weapons), picks and buys that chase recipes.
- **Win** = knockout (★★).

Foe HP is the knob: each level's HP is set so both players land as close to
their targets as one number allows (`1-10 ~180`, `2-10 ~900`, `3-10 ~3,500`,
W4–5 non-boss `~2,200–5,500`, `4-11 ~9,000–12,000`, `5-5 ~12,000–16,000`).
