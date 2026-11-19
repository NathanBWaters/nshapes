# The motion brief: decide before you build

A brief is a list of decisions. Every line you write takes one decision away from the defaults. It is also cheap: changing a number in a table takes seconds; finding out after the build that the order was wrong costs a round.

Write the brief after the baseline critique and before any code. Keep it in the surface's review file (`docs/motion/reviews/<surface>.md`), where the next person can see what was meant.

## The template

```
SURFACE   <id from the ledger> · shot <name> · seen <constant | often | sometimes | once>

GOAL      One sentence: what the player must understand or feel when this ends.
          (Not "impressive". If it has no purpose it has no motion.)

REFERENCE What this should move like, by name: a sibling effect in this game
          ("lands like the Set burst"), or a known game's moment. Take the grammar
          (pacing, weight, order), never the content.

HERO      The one thing the eye follows. Everything else is support.

POSES     The key frames, before any curve is chosen:
          f0   <what is on screen when it starts>
          f6   <...>
          f14  <the hit / the landing / the reveal>
          f20  <the settle>
          f36  <rest: the finished picture>

MOTION    One line per thing that moves:
          <thing>: <from → to> · <token for time> · <token for curve or spring> · starts f<N>
          Support: starts 100–200 ms after the hero, travels 50–70% as far.

SOUND     Which cue, and the frame it lands on (the picture's frame, or one after).

BANNED    The defaults this effect must not reach for (from critique.md, plus
          whatever the baseline used that you are removing).

REDUCED   What plays when reduced motion or Effects off is on: what is kept
          (the meaning: a number, a colour change, a short fade) and what goes.

CHECK     What the after-capture must show, as numbers you can read in report.md:
          "first change by f2", "burst peak on the frame the cards arrive",
          "no hint in report", "all seven scores 8+".
```

## Rules for filling it in

- **Numbers, not adjectives.** "Snappy" is `MS.quick` and `SPRING.snappy`. If you catch an adjective, translate it ([critique.md](critique.md), "Feelings into numbers").
- **Tokens, not literals.** If no token fits, the token file is missing one: add it there with a comment saying what it is for.
- **Poses first.** If you cannot say what f0, the hit frame and the rest frame look like, you are not ready to pick curves. For anything with a character or an impact, the poses include the anticipation and the squash.
- **One hero.** If two things both feel like the hero, the effect is two beats: put one after the other.
- **Frame 0 and the last frame are finished pictures.** A player who looks away must not come back to a half state.
- **Say what you are removing.** Most "mid" motion is fixed by taking away the second and third thing that said the same as the first.
- **The brief is a contract with the capture.** The CHECK lines are what you read in `report.md` afterwards. If the capture does not show them, the build is not done.

## Three variants for hero moments

For a moment the player came for (a knockout, a star, an unlock, an evolution), do not polish the first idea you had: it is the default. Write **three variants that differ in kind**, three lines each (hero, order, feel), for example:

1. *Slam:* the banner drops from above on `SPRING.heavy`, the screen dips 6 px, the foe is already gone.
2. *Hold and release:* everything freezes 4 frames on the last hit, then the foe pops and the banner unrolls from the middle.
3. *Carry:* the last card thrown becomes the banner: it lands, flips, and the words are on its back.

Pick one and say why in one line. When two are close, build both roughly, capture both and let the frames decide. Keep the losers in the review file: they are the next person's starting ideas.

For feedback seen on every tap, skip this. One clear version, refined.

## Stills before motion

Fixing a pose table is cheaper than fixing an animation. For a surface with new layout (a new panel, a rebuilt results screen), get the **rest frame** right first: build the final state with no motion, capture one frame (`--frames 1`), and check it reads at phone size. Then add the way in and the way out.

## Director's notes: how to ask for a change

Follow-ups are written the way a director gives notes: **what it reads as, the frame, the exact change.**

- "Hold the foe 4 frames on the hit (f16–f19) before it recoils."
- "The number lands on f14; the cards arrive on f16. Land the number on f16."
- "Slow the sheet to `MS.panel`; cut its travel to 96 px."
- "Hard cut here: drop the 150 ms fade between the banner and the board."
- "Push in on the star: 1 → 1.06 over the 20-frame hold."
- "Start coin 2 when coin 1 is 40% of the way, not when it lands."

One or two notes a round. Each one changes one thing, so the next capture shows what that thing did.

## A filled example

```
SURFACE   level-preview-sheet · shot preview-open · seen often

GOAL      The player sees a card rise from the foe they tapped and knows it can
          be put back down.

REFERENCE Moves like the game's own speech bubble: quick up, soft landing.

HERO      The sheet.

POSES     f0   map, tapped node pressed (scale 0.96)
          f2   backdrop starts to dim; sheet's top edge 96 px below its rest place, opacity 0
          f10  sheet 80% of the way, fully opaque
          f22  sheet at rest; foe portrait inside it settles last (trails by 3 frames)
          f23+ nothing moves

MOTION    sheet: translateY 96 → 0 · MS.panel · EASE.enterSoft · starts f2
          sheet: opacity 0 → 1 · MS.feedback · EASE.ui · starts f2
          backdrop: opacity 0 → 0.5 · 150 ms · EASE.ui · starts f2
          foe portrait: scale 0.9 → 1 · SPRING.lively · starts f5
          close: the same path back, exitMs(MS.panel), EASE.exit; backdrop fades with it

SOUND     the existing sheet cue on f2

BANNED    slide of the full screen height; the backdrop sliding with the sheet;
          a second entrance inside the first; closing with no exit

REDUCED   backdrop and sheet fade in 120 ms, no travel, no spring

CHECK     first change ≤ f2 · sheet settled by f24 · close ≤ 16 frames and visible
          on the strip · no POP-OUT hint · scores 8+
```
