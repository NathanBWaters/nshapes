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
Workshop, tuning, evolutions) moves one curve, retune HP and check both.
