# Numbers: curves, springs, durations, and the twelve principles as figures

Motion designers think in curves and frames. Give the code curves and frames. All of these live as tokens in `src/utils/motion.ts`: use the token, not the literal.

One frame is 16 ms. Say durations in frames when you review (`f12`), in tokens when you build (`MS.move`).

## Durations by what is moving

| What | Token | ms | Frames |
|------|-------|----|--------|
| Answer to a touch (press, pick, toggle) | `MS.feedback` | 120 (range 80–150) | 5–9 |
| A small part changing state (chip, icon, badge) | `MS.quick` | 180 (120–250) | 8–15 |
| A card, a row, a panel part arriving or moving | `MS.move` | 280 (200–350) | 12–22 |
| A sheet, a modal, a screen | `MS.panel` | 360 (300–450) | 19–28 |
| A hero moment (star, reward, knockout) | `MS.hero` | 700 (600–900) | 37–56 |
| An exit | `exitMs(enter)` | two thirds of its entrance | |
| A single entrance, at most | | 800: a longer build-up is a stagger, not one slow element | |

- **Distance stretches time, a little:** `travelMs(base, px)`: 100 px is the base, 200 px ×1.3, 400 px ×1.6, a full screen ×2 at most.
- **Mass:** big things move and rebound slower, small things snap.
- **Frequency:** seen on every Set → the short end, subtle. Seen once a run → may be dramatic. Ask: is this still welcome the hundredth time today?
- **Latency:** the answer to a tap starts within 100 ms. Nothing the player caused may wait on something they did not.

## Curves

| Token | cubic-bezier | Use it for |
|-------|--------------|------------|
| `EASE.enter` | 0.16, 1, 0.3, 1 (ease-out-expo) | arrivals: cards, text, banners |
| `EASE.enterSoft` | 0.22, 1, 0.36, 1 (ease-out-quint) | hero and panel arrivals |
| `EASE.ui` | 0.33, 1, 0.68, 1 (ease-out-cubic) | small interface parts |
| `EASE.move` | 0.76, 0, 0.24, 1 (ease-in-out-quart) | from one place on screen to another |
| `EASE.exit` | 0.7, 0, 0.84, 0 (ease-in-expo) | leaving on its own (an effect that is done, a banner timing out) |
| `EASE.exitSoft` | 0.32, 0, 0.67, 0 (ease-in-cubic) | leaving because the player asked (a sheet put away, a screen left), and any exit under about 250 ms: expo sits still for the first four frames, which reads as a late answer |
| `EASE.impact` | 0.3, 0, 0.75, 0.3 | falling or thrown INTO a hit: lands at full speed, the hit is the stop |
| `EASE.pop` | 0.34, 1.56, 0.64, 1 (ease-out-back) | a pop with visible overshoot: position and scale only |
| `EASE.drift` | 0.37, 0, 0.63, 1 (ease-in-out-sine) | breathing, floating |
| `EASE.linear` | | rotation, progress bars, loop phase. **Never a move.** |

Four rules cover nine cases in ten: **enter with ease-out. Leave with ease-in, in about two thirds of the time. Cross the screen with ease-in-out. Linear only for rotation, progress and loop phase.**

A thrown thing that hits something may fly on ease-in (it accelerates into the hit). An entrance never eases in.

## Springs

A curve goes from A to B on a fixed path. A spring has mass: it accelerates, overshoots a hair and settles, and it keeps its speed when interrupted. Use springs for anything the player can retrigger mid-flight (picks, presses, hearts changing fast) and for anything that should feel physical.

Read every spring by one number, the **damping ratio**: `damping / (2 × √(stiffness × mass))` (`dampingRatio()` in the tokens file).

| Ratio | Reads as |
|-------|----------|
| 1.0 | never bounces |
| 0.7–0.85 | crisp, expensive |
| 0.4–0.6 | playful |
| under 0.3 | a cartoon; loose parts only |

| Token | Stiffness / damping | Ratio | Overshoot | Settles | For |
|-------|--------------------|-------|-----------|---------|-----|
| `SPRING.snappy` | 320 / 30 | 0.84 | under 1% | ~0.23 s | buttons, chips, toggles |
| `SPRING.settle` | 170 / 26 | 1.0 | none | ~0.45 s | cards and panels coming to rest |
| `SPRING.heavy` | 90 / 20 | 1.05 | none | ~0.68 s | banners, sheets, bosses |
| `SPRING.lively` | 260 / 19.5 | 0.6 | ~10% | ~0.4 s | a dealt card, a counted coin |
| `SPRING.playful` | 220 / 14 | 0.47 | ~19% | ~0.56 s | rewards, stars, mascots |
| `SPRING.loose` | 190 / 8.3 | 0.3 | ~37% | ~1 s | ears, tails, tags that follow through |

- **Position and scale may bounce. Opacity and colour never do**: an overshooting fade is a flicker. Fades use `withTiming`.
- **If everything overshoots, nothing feels precise.** Give each class of thing its own spring and keep to it.
- **A spring comes to rest late.** `SPRING.lively` is still for about twice as long as a 190 ms curve takes. On one hero that tail is the charm. On things that queue behind each other (a board of cards being dealt, a list) it doubles the wait: use a timed curve there (`EASE.pop` gives the overshoot without the tail). The report's `in 24f` is the time to rest: read it.
- **Time neighbours off the duration you asked for**, not off the moment the spring finally stops. A spring's tail is longer than it looks.
- A value that changes target several times: let the spring carry on to the new target. Do not restart it from rest.

## Overshoot, by what the motion means

| Meaning | Overshoot |
|---------|-----------|
| A mistake, an error | 0%. A shake instead: ±10–15 px, 2–3 swings that shrink, 300–400 ms |
| Plain feedback | 2–5% |
| Success, a reward | 5–10% |
| A celebration, a knockout | 15–25% |
| More than 25% | reads as broken |

## Stagger and order

| | Gap | Token |
|--|-----|-------|
| Cards dealt | 30–60 ms | `STAGGER.card` (40) |
| Rows, chips, list items | 40–80 ms | `STAGGER.item` (60) |
| Words | 60–120 ms | `STAGGER.word` (90) |
| Letters | 1–2 frames | |
| The whole run, at most | 500 ms | `STAGGER.cap`, applied by `staggerDelay(i, n, gap)` |

- Start the next element when the previous one is **30–50% done**. Fully one-after-another looks robotic. All at once looks cheap.
- A cascade that **gathers pace** (each gap 0.84 of the last: `cascadeDelay(i)`) reads as one gesture. Equal gaps read as a list.
- Things that are alike share one curve and one duration. Vary only when they start.
- The last element may land with a little overshoot, as punctuation.

## Hierarchy: one hero

- **One hero move per beat.** Everything else waits, dims, or holds still.
- Supporting moves start **100–200 ms after** the hero and travel **50–70% as far**.
- Ambient life (breathing, drift) stays under 5% of the hero's travel and under ±2% scale, on a slow sine, with a different period for each thing so they never line up. Ambient motion never fills an empty beat.
- With three or more things on screen, at most a third of them move at once.
- **Causes and effects share a frame.** The flinch starts on the frame the hit lands, not shortly after. In Reanimated that means: mount (or trigger) everything that belongs to the moment in the same React commit, from the same state update, and start their animations there. A JS `setTimeout` for one part and a `withDelay` for another will drift a frame or two apart, and the strip will show it. The same goes for swapping what is drawn when an animation ends: a timer set to the animation's length fires a frame early (the animation starts on the next frame), so the swap shows. Swap from the animation's own finish callback. If the moment waits for something (a flight, the band's next note), let that one wait release all of it.
- **A breath before the payoff.** Hold 0.3–0.75 s between the decisive act and what it pays (a knockout, a reveal), then 100–200 ms of stillness before anything new starts.
- **One direction means "next"** across the game. Up means done or gained; growing means arriving; shrinking means dismissed. Do not ping-pong directions on consecutive transitions.

## The twelve principles, as numbers

Disney's animators wrote these down as feelings. A model follows them only as frames and sizes.

| Principle | What it does | Write it as |
|-----------|--------------|-------------|
| Anticipation | A small move the other way before the main one | 6–12 frames (100–200 ms), 10–20% of the main move, opposite direction. Skip it for feedback under 150 ms. A button dips 3%; a card pulls back 5–10 px. |
| Squash and stretch | Shows speed and weight | Keep the volume: scaleX × scaleY ≈ 1. Stretch 0.85 × 1.15 taking off, squash 1.2 × 0.8 landing (`SQUASH`). Impact lasts 2–4 frames, recovery 4–8. |
| Follow-through | Loose parts keep going after the body stops | A second, looser spring on those parts (`SPRING.loose`), ratio 0.3–0.5 |
| Overlapping action | Parts start at different times | Children, labels and shadows trail the body by 2–6 frames (50–100 ms) |
| Arcs | Natural paths curve | Jumps on a parabola; anything that travels bows 10–20 px off the straight line at its midpoint. Never a straight diagonal. |
| Slow in, slow out | Speeds up and settles softly | Ease-out entrances and springs. Never linear on position. |
| Timing | Frame count is weight | Light things 6–10 frames a move, heavy things 18–30 |
| Exaggeration | Survives a phone screen | Push key poses 10–30% further than feels right |
| Staging | The eye knows where to look | One hero per beat. Everything else travels 60% as far and starts 100–200 ms later. |
| Secondary action | Life during holds | Ambient motion under 5% of the hero's travel, on a slow sine |
| Solid drawing / appeal | It reads at a glance | Silhouette first: a pose should read in one frame of the strip |
| Straight ahead / pose to pose | Plan the keys | Write the key poses on a frame table before any code ([brief.md](brief.md)) |

## Recipes

- **Press:** down to `SCALE.press` (0.96) in 60 ms on ease-out, back on `SPRING.snappy`. A big chunky button also sinks 2 px.
- **Pop:** scale 1 → `SCALE.pop` (1.08) → 1 over about 6 frames, peaking on the beat.
- **A reward landing:** in from 0.6 on `SPRING.playful`, a squash of 2–4 frames on landing, its label 50–100 ms behind it.
- **A wrong move:** no bounce. A shake of ±10–15 px, 2–3 swings that shrink, 300–400 ms, on the thing that was wrong.
- **A hit:** squash the target on the impact frame, hold 2–4 frames, recover in 4–8 on a spring; the number lands big and settles; the bar drops on the same frame.
- **A sheet:** up 60–120 px with `EASE.enterSoft` over `MS.panel` while the backdrop fades on its own 150 ms; down in `exitMs(MS.panel)` on `EASE.exit`. It leaves the way it came.
- **A hand-off between two things** (a coin into a counter, a card into a slot): the first leaves on ease-in, the second arrives on ease-out, same distance and duration, and the thing carried is in the same place on both sides of the hand-off. Never a crossfade.

## Words on screen

- A line stays still for at least **0.5 s + 0.3 s a word** (`textHoldMs(words)`). One or two words may flash for 0.4 s.
- Text never moves while it is being read.
- New words enter after the old ones have gone, never across them.
- Draw text at its biggest size and scale down, never up (scaled-up text is blurry).
- Text keeps 4.5:1 contrast with what is behind it while it is at rest (3:1 for big bold text).

## Sound

- The picture must work with the sound off.
- **A sound lands on its picture's frame or one frame after, never before.** Light arrives before sound in life, so a late sound feels natural and an early one feels wrong at once.
- In fights, never a raw frequency: a cue, in scale steps (`src/audio/fightAudio.ts`, Claude.md "Sound").

## Reduced motion and safety

- Reduced motion **removes movement and springs, keeps opacity and colour**, halves durations, plays no loop by itself. The meaning must still arrive: nothing important is said by motion alone.
- **Reanimated does the removing for you, and it removes too much.** With the OS setting on, every `withTiming`, `withSpring`, `withDelay` and `withSequence` jumps straight to its end unless it is marked to stay:

  ```ts
  import { withDelay, withTiming } from 'react-native-reanimated';
  import { MS, STAYS } from '@/utils/motion';
  // The fade that carries the meaning still plays; the travel around it does not
  opacity.value = withDelay(120, withTiming(1, { duration: MS.feedback, ...STAYS }), STAYS.reduceMotion);
  ```

  So "keep opacity and colour" does nothing by itself: a number that fades in, holds and fades out is simply never shown, and a wash that should stay for a second lasts one frame. Mark the fades and the holds that carry meaning with `ReduceMotion.Never` (the delay too), leave the moves unmarked, and look at the `--reduced` capture: it should show the meaning arriving without the travel.
- No flash more than 3 times a second. No white full-screen flash.
- Shakes, spins and big zooms are what make people ill: they are the first to go.

## Performance (the project's battery rules still rule)

- Animate **transform and opacity only**. Never width, height, top, left or margin. A bar that fills is a `scaleX`, not a width.
- Infinite loops: transform or opacity, gated on `useAppActive()`, cancelled on unmount. Frame loops only through `useGuardedFrameCallback` with no allocation inside.
- Fewer than about 20 things animating at once.
- Clamp every `interpolate` unless the overshoot is meant.
- No `Math.random` or `Date.now` inside animation maths that should look the same twice: captures must be repeatable, and fights must replay.
