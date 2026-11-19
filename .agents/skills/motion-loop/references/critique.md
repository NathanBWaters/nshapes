# Critique: grading motion you cannot watch

You are the director, not the author. Judge only what the frames show. What you meant to make does not count.

## What to open, in this order

1. `report.md`: the timeline, who moved and on what curve, the machine's hints. This costs almost nothing to read and tells you where to look.
2. `contact.png`: the whole effect as a storyboard. Pacing, order, dead stretches, where the eye goes.
3. `strip.png`: 16 consecutive frames cropped to the motion. Pops, overlaps, late peaks, hard stops.
4. More strips where the report points: `npm run motion:sheet -- <dir> --from A --to B`. A single frame at full size is `frames/f012.png`.
5. After a change: `npm run motion:sheet -- --compare <before> <after>`. The same frames, one above the other.

The capture is 390 px wide: it already is the phone test. If a word cannot be read on the contact sheet's full-size frame, the player cannot read it either.

## The rubric: seven scores, 1 to 10

Write all seven every round, like `7/6/5/6/7/6/8`. An 8 means this:

| # | Score | An 8 out of 10 means |
|---|-------|----------------------|
| 1 | **Response** | Something visible answers the tap by f6 (100 ms), on the thing that was tapped. Nothing waits for something unrelated to finish. |
| 2 | **Readability** | A first-time player can say what happened and where to look, with the sound off. Every word is legible at phone size and stays still at least 0.5 s + 0.3 s a word. Text never moves while it is being read. |
| 3 | **Motion** | No linear move on position or scale. Every spring settles. Nothing pops in or out on the strip. Things that travel far follow an arc. Exits are shorter than entrances. |
| 4 | **Staging** | One hero per beat. Everything else starts later, travels less, or holds still. No two big moves compete for the eye. Not more than a third of what is on screen moves at once. |
| 5 | **Rhythm** | No dead stretch. Nothing arrives all at once. Steps of a chain overlap (the next starts when the last is 30–50% done). The payoff gets a breath of stillness before it lands. The total length fits how often it is seen: something seen on every Set is over in well under a second. |
| 6 | **Identity** | It looks like NShapes (ink outlines, paper, a playful game that hits hard) and like its sibling effects, and uses nothing from the banned list below. The same event looks the same wherever it happens. |
| 7 | **Sync and safety** | Each sound lands on its picture's frame or one frame after, never before. Reduced motion keeps the meaning and drops the movement. Only transform and opacity animate. No flash more than 3 times a second. A second capture gives the same frames. |

Scores under 8 need a note. A score of 8 or more on round 1 needs a second look at the strip: you probably graded the idea.

A supporting move (a creature flinching under the hit's burst, a chip jumping when a coin lands) is scored as support: does it start on the hero's frame, is it smaller and shorter than the hero, and is it right in the frames where it can be seen? Being half covered by the hero is correct staging, not a defect. Score it in its studio shot for its own motion and in the real shot for how it sits with the hero.

## What to hunt for

Go down this list on every strip. Each line is a defect seen in real reviews.

- A tap with nothing on f0–f6.
- Something animating where nobody can see it: below the fold, under a pinned footer, behind a modal. (The coins of the results screen counted for months under the footer.)
- Anything moving at constant speed (the report says `linear`; on the strip the gaps between positions are equal).
- A move that is at full speed on its last frame and then stops dead (unless it hit something).
- Something that is there on one frame and gone the next, or the other way round.
- Two things saying the same thing at the same time (a shake and a flash and a scale-up for one hit).
- Two heroes: two big moves starting within 6 frames of each other.
- Everything starting on the same frame.
- A stretch of 12 frames or more with nothing changing, in the middle of an effect.
- A reaction that comes late: the hit lands on f15, the flinch starts on f19. Effects start on the frame that causes them.
- A payoff with no pause before it: the number is already there when the thing that causes it arrives.
- Text overlapping other text during a swap. New words must enter after the old ones have left.
- Text or a number that cannot be read at phone size, or is gone before it can be read.
- A straight diagonal flight where an arc belongs.
- Opacity that bounces (reads as a flicker).
- An exit as long as, or longer than, its entrance.
- A loop whose last frame does not flow into its first.
- The same effect looking different in two places.
- A sound scheduled when the effect starts while the picture lands 200 ms later.
- Reduced motion that still shakes, flashes or flies.
- Reduced motion that shows nothing: the animation jumps straight to its end, and the number or word it carried is gone before anyone could read it.
- Anything from the banned list.

## Notes: frames, not feelings

Every note has three parts: **what it reads as + the evidence (frame, pixels, ms) + the exact change.**

| Don't write | Write |
|-------------|-------|
| "The hit feels weak" | "The burst peaks on f20 but the foe does not flinch until f24: it reads as two events. Start the flinch on the burst's first frame (f16)." |
| "Make the stars pop more" | "Each star goes ×0→×1 in 16f on ease-out and just stops (no overshoot, no settle). Use `SPRING.playful` (19% overshoot) and start star 2 when star 1 is 40% in (7 frames later, not 28)." |
| "Too busy" | "f16–f22: burst, screen shake, HP flash and the number all start on f16. Keep the burst and the number. Move the shake to the heavy hits only." |
| "Smoother transition" | "The sheet is at 100% opacity on f0 and slides 844 px in 15f linear. Enter on `EASE.enter` over `MS.panel`, travel 120 px, backdrop fades on its own 150 ms." |

Three notes a round, ordered by how much the player gains. Fix them, capture, score again.

## Feelings into numbers

| The feeling | What to write instead |
|-------------|-----------------------|
| snappy | `MS.feedback`–`MS.quick` (120–180 ms), `SPRING.snappy`, stagger 30–40 ms |
| premium / polished | `EASE.enterSoft` entrances of `MS.panel`+, springs at ratio 0.8, no overshoot on text, one accent, generous margins |
| playful | `SPRING.playful` or `SPRING.lively` on position and scale only; squash and stretch (`SQUASH`); overshoot 10–20% |
| juicy / impactful | squash on impact for 2–4 frames, recover in 4–8; the reaction starts on the impact frame; a pause of 2–4 frames on the hit (hit-stop); the number lands big then settles |
| make it pop | scale 1 → `SCALE.pop` (1.08) → 1 over about 6 frames, peaking on the beat |
| energetic | cuts on every step of the chain, pops of 6 frames, nothing held longer than a beat |
| calm | holds of 1.5 s or more, `EASE.drift`, no overshoot |
| it drags | shorten each hold; shorten exits to two thirds of entrances; overlap the steps more |
| too busy | one hero; others start 150 ms later and travel 60% as far; cut 30% of the motion and keep only what guides the eye |
| the ending is abrupt | add a one-beat hold, then settle on a spring at ratio 0.8 |
| it looks generic / like AI | list by name every default used in this version, ban each one, capture again |

## Banned defaults (named, so they can be refused)

"Avoid a generic look" does nothing: it swaps one default for its neighbour. These are the patterns, by name. If one appears in a capture, it is a defect unless the brief says why it is there.

- Everything fading in at once.
- Fade-and-slide-up on every element.
- A plain opacity fade as the whole transition for something that matters.
- Linear moves on position or scale.
- The same bounce on everything (one overshoot curve used for buttons, panels, text and rewards alike).
- Bounce on opacity or colour.
- Multi-oscillation elastic wobble on anything the player sees many times a fight.
- Glow, bloom, lens flare; purple-to-blue gradients.
- Particles as decoration (particles need a cause: something broke, burned, was collected).
- A white full-screen flash.
- A full spin as the celebration.
- Scale-pulse as the answer to every event.
- Screen shake on small events.
- A second version of an effect that already exists.
- Content hidden but keeping its space while it waits its turn (holes in a card).
- A caption that announces the reward before the reward lands.
- A number that shows 0 while it waits to count.
- **Project rules:** a card border or outline for anything but selection; fight feedback animated inside `AdventureRun.tsx`; a raw frequency instead of a cue; layout properties (width, height, top, left, margin) animated.

After each review, add the defaults you caught that are not here yet. The list grows and the defaults shrink.

## Review prompts that work (one or two per round, not all)

- "Describe frames f0, f8, f16, f24 and f32 in one sentence each, as a first-time player would. Does the story read without sound?"
- "On the strip f10–f25: does anything pop, jump or overlap? Fix it at the frame where it starts."
- "Mark every frame where two things move at once. Which one is the hero? Fix the hierarchy."
- "Review this like a senior motion designer: 10 notes ordered by impact, each with a frame number and the exact change. Apply the top 3."
- "It is too busy. Remove 30% of the motion and keep only the moves that guide the eye."
- "Would this still be welcome the hundredth time today?"

## When the machine and your eyes disagree

The hints in `report.md` are leads. They catch linear moves, pops, hard stops, dead stretches and slow answers. They cannot see staging, meaning or taste, and they can be fooled (an invisible wrapper, a deliberate cut). Confirm each hint on the strip before acting, and never treat an empty hint list as a pass.
