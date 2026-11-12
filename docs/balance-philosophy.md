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

## How it could map onto the balance bots (not done yet)

The current bots (`__tests__/adventureBalance.test.ts`, `engine/botBuilds.ts`)
balance one middle player: the average bot with 75% of the stars on offer, a
random fighter and charms, no Workshop. Its mean knockout rate by world at
v0.1.98 is 86% > 68% > 66% > 60% > 54%, which sits between the two rows above.

To balance against this sentiment directly, two bot setups could bracket every level:

- **Bare:** average bot, 0 stars spent, no Workshop, random charms with no
  recipe preference, picks/buys at random. Assert knockout ≈ the bare row (by world).
- **Invested:** average or expert bot, every star available by then spent
  (`plan` style), the Workshop and weapon tuning bought with the coins a player
  would plausibly have banked by then, the best non-counter build from the
  Armory (a recipe pair plus damage charms). Assert knockout ≈ the invested row.

Foe HP would then be tuned so each level lands between the two curves, with
the gap widening world by world. The open question is how many coins
"maxed out at this point" means; it needs a coins-banked-by-level estimate
(e.g. the average bot's coins per level, replays included).
