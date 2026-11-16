# Balance philosophy (rough sentiment)

The designer's high-level feel for Adventure difficulty, recorded so tuning has
a north star. These are rough targets, not hard rules. "Winning" can mean
different things per level (knockout, ★★★…); read it as "knocks the foe out"
unless a level says otherwise.

## Balancing on All Three Stars (`★`, `★★`, `★★★`) & Mobile FTUE Pacing

Following mobile 3-star best practices (*Angry Birds*, *Cut the Rope*, *Royal Match*, *Plants vs. Zombies*), campaign levels are balanced on **the entire 3-star funnel**, never on knockout win rate alone:

- **`★` (Stage Clear — Very Easy, Never Discouraging):** Clearing a stage unlocks the next node on the map and frames the outcome positively (`STAGE CLEAR!`). In World 1, even a bare player clears `>= 95%` of attempts (`100%` on `1-1`). Players are never walled or scolded for earning 1 star.
- **`★★` (Knockout — Easy Early, Ramping Later):** Knocking out the foe within the move/time budget. Easy in World 1 (`~78%` bare, `~98%` invested) so beginners build confidence immediately, then diverging cleanly as progression layers kick in.
- **`★★★` (Mastery — "A Bit of a Challenge", Never an RNG Sweat):** Completing the level's mini-goal alongside a knockout. In World 1, average invested players hit `★★★` `~72%` of the time and pro players (`BOTS.expert`) clear **`>= 75%` on every level** (`~85%+` mean) — never forcing last-move RNG luck. Across Worlds 2–5, organic first-try `★★★` tightens gradually toward `~28%` to reward mastery and replays.

| Metric / Tier | World 1 | World 2 | World 3 | World 4 | World 5 |
|---|---|---|---|---|---|
| **Bare `★1+` (Stage Clear floor)** | ≥88% (~97% mean) | ≥55% | ≥20% | ≥3% | 0% |
| **Bare `★★+` (Knockout target)** | ~75% (~85% on 1-2..1-5) | ~30% | ~10% | ~0% | ~0% |
| **Invested `★★+` (Knockout target)** | ~98% | ~90% | ~80% | ~70% | ~50% |
| **Invested `★★★` (Mastery target)** | ~72% (Pro ≥75%/lvl) | ~58% | ~48% | ~38% | ~28% |

### Progressive Onboarding (World 1 → World 2)

New players get powers and flow **before** meta-economies:
1. **Constrained 2-trait boards first (`1-1`..`1-4`):** Keep `shape` + `color` (9 cards) across 4 levels while granting `Blast Powder` right on `1-1` `★1`, `Flint Spark` on `1-2`, and `Mending Charm` on `1-3`. Ask for accessible visual mini-goals (*2 all-red Sets*, *2 all-different Sets*, *2 explosions*) so players feel powerful immediately.
2. **Gradual puzzle expansion (`1-5`..`1-7`):** Introduce `Number` (`1-5`, *2 single-color Sets* scanning tip), `Rainbow Strike` (`1-6`, *2 Rainbows*), and `Skill Trees` (`1-7`).
3. **Delayed currencies & meta-systems (`1-8`..`2-2`):** Hide coin UI clutter until `Coin Drops` unlock on `1-8`, open `The Workshop` on `1-9`, award `Phoenix Pyre` + `Bounties` on the `1-10` boss, and teach `Evolutions` (`n: 1`, never penalizing fast play) on `2-2` where `LONG_ROUNDS` gives 30-second evolutions room to shine.

## What this says

- Progression is the point: the gap between the two rows is what skill trees,
  the Workshop and evolutions buy. By World 4 an unprepared player should
  bounce off; a prepared one should mostly get through.
- Even a maxed, well-played run should still lose sometimes from World 2 on,
  and World 5 is a coin flip at best.
- Raw puzzle skill can carry the bare player early, but not past World 3.

## Weapons and evolutions: everything should be worth picking

The game should be exciting to play, not just fair. Weapons and evolutions are
tuned to these, in order:

1. **Nothing is a dead pick.** Every weapon, held alone, adds damage you can
   see from level 1, and every evolution adds damage on top of its two weapons.
   Before this pass two thirds of the weapons added nothing alone (support
   weapons had no payoff, "bridge" weapons needed a partner to do anything),
   and the typical evolution lasted two Sets.
2. **Things happen often.** A proc weapon fires about once in five Sets at
   level 1 and about once in two at its best. Timing weapons use beats an
   average player can hit at five traits (about 10 s a Set): every Nth Set,
   3 Sets in 15 s. Not "5 Sets in 20 s".
3. **Support hits back.** Hearts, hints, graces, coins and XP all come with a
   strike on the foe, so a survival build still ends fights.
4. **An evolution is a power trip.** Matching the Catalyst hits the foe at
   once, and for 30 s every Set deals ×1.5 and +2 on top of the recipe's own
   rules. A recipe opens with something or works on every Set; it never waits
   only for a rare event.
5. **Strong is fine, runaway is not.** Two damage weapons with their evolution
   should be the top of the field, not ten times it. Loops that made fights
   last forever are capped (all time gains together can at most double a
   fight's clock).
6. **A harder board should pay more.** The board gambles (Cursed Idol, Chain
   Gang, Rust, Greedy Chest…) take something away from the board and give it
   back with interest if you play around them. They may swing more than a
   staple weapon; they may not be free, and they may never leave the board
   without a Set.

Rough bands, measured on a training dummy with endgame gear (level 5, fully
tuned), as damage per fight against no weapons at all:

| | Weakest | Typical | Strongest |
|---|---|---|---|
| A damage weapon alone (Blast, Flint, Chaos Shard, War Drum, Ray) | ×2.7 | ×3 | ×4 |
| A support or engine weapon alone | ×1.3 | ×1.9 | ×2.4 |
| An evolution, over its two weapons without it | ×1.1 | ×1.35 | ×2 (link-and-time recipes up to ×2.5) |

Life Link and Revenge Linker only wake up when you lose a heart, so they add
little on a dummy that never hits back (about ×1.1 with the bot that slips
most) and more against real foes.

At level 1 every weapon adds something (typically +5% to +35% in an early
fight); levels and Workshop tuning are still where most of its power comes
from, which is what keeps the bare and invested players apart.

These are enforced by the balance lab ([balance-system.md](./balance-system.md)):
every weapon is measured with and without, alone and inside real builds, for
novice, average and expert bots, against the bands in
`src/adventure/balance/targets.ts`. A weapon is overpowered if it is too
strong for any of those players and underpowered only if it is too weak for
all of them. `__tests__/adventureBuilds.test.ts` adds the build-level checks
(no fighter, pairing or random build runs away; every evolution adds damage).

## How the balance bots use this

`__tests__/adventureBalance.test.ts` plays every level with both players
(`engine/botBuilds.ts` `barePlan` / `investedPlan`) and asserts the rates above
(`WIN_TARGETS`, per level ±20 points, per world mean ±10). Both are the same
average-skill bot, so the gap between them is progression alone.

- **Bare:** 0 stars spent, no Workshop, random charms, random level-up picks
  and shop buys (never chases a recipe).
- **Invested:** every star on offer before the level spent (plan style:
  capstones first), every Workshop upgrade on sale by then at its top tier,
  the charms it brings tuned to ×1.5 on every number, a solid build (both
  halves of a random recipe, then damage weapons), picks and buys that chase
  recipes. "Maxed out as far as you could be at this point" is read as
  everything *on sale by then* maxed, not grinding later content.
- **Win** = knockout (★★). "Winning could vary", so per level some slack.

Adjustments in `winTargets`: bosses and elite branches are a step harder for
the invested player (−10 / −15 points), fighter trials a step kinder, and the
meadow's first lessons (1-2, 1-3) come before any progression exists, so both
players win them about 85%. 1-1 can't be lost.

Foe HP is the knob: each level's HP is set so both players land as close to
their targets as one number allows. If a change to progression (skill trees,
Workshop, tuning, weapons, evolutions) moves one curve, retune HP and check both.
