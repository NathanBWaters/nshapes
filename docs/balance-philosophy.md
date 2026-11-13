# Balance philosophy (rough sentiment)

The designer's high-level feel for Adventure difficulty, recorded so tuning has
a north star. These are rough targets, not hard rules. "Winning" can mean
different things per level (knockout, ★★★…); read it as "knocks the foe out"
unless a level says otherwise.

## Two players to balance between

**The bare player** puts nothing into progression:
- No skill-tree stars spent, no coins spent (no Workshop, no tuning).
- Doesn't chase evolutions or build around anything.

They should win roughly:

| World | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Bare player wins | ~50% | ~30% | ~10% | ~0% | ~0% |

…unless they're just insanely good at the puzzle itself.

**The invested player** is as maxed out as they could be at that point in the
campaign and plays well:
- Every star they could have earned is spent; coins are spent on the Workshop.
- They run a *solid* build (not a hard counter to the foe, just a good one),
  and probably use evolutions.

They should win roughly:

| World | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Invested player wins | ~100% | ~90% | ~80% | ~70% | ~50% |

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
