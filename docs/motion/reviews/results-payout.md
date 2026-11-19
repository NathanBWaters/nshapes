# results-payout

The results screen after a won fight: the card arrives, the stars land, the goals are ticked, the coins are paid.
Seen often (the end of every fight). Shots: `fight-win` (420 frames from the knockout; the results mount on f81) and `results-payout` (new, 180 frames from the results' first frame).
Scores are Response / Readability / Motion / Staging / Rhythm / Identity / Sync. Frame numbers below are `fight-win` frames (results mount = f81).

## Scores

| Version | Scores | Capture |
|---|---|---|
| original (HEAD 49653d8) | 7/6/6/5/5/6/4 | `motion-out/fight-win/before` |
| draft (someone else's, uncommitted) | 6/5/6/5/5/6/5 | `motion-out/fight-win/draft` |
| r1 | 8/7/7/6/7/7/7 | `motion-out/fight-win/r1` |
| r2 | 8/8/7/6/7/7/7 | `motion-out/fight-win/r2` |
| r3 | 8/8/7/8/8/8/8 | `motion-out/fight-win/r3` |
| r4 (final) | 8/8/8/8/8/8/8 | `motion-out/fight-win/r4` (`--twice`) |
| reduced | finished screen on frame 0 | `motion-out/results-payout/reduced` |

## Baseline critique

**Original.** The whole card pops in one block (f81-f86, 180 ms). Title, "All 3 star shards won back!", goals with every ✓ and the stats are readable from f86, so the caption announces the stars before any star has landed. Stars pop 1→1.25→1 in 260 ms at f103 / f131 / f159, each followed by ~12 frames of nothing (f108-f130). The `star` cue fires when the pop starts; the peak is 9 frames later (sound before picture). The coin total is a fixed number, and the coin box sits behind the footer on a 390×844 phone (its label at y≈753, the pill under the footer), so the `coinRoll` cue plays over nothing visible. The fighter does a full leap and spin f86-f110, the biggest move on screen, at the same time as the stars. Reduced motion ignored.

**Draft.** Kept the content but made it wait: f94-f190 the card is a big white box with holes (the companion line, stats and coins are at opacity 0 but keep their space); the companion bubble arrives at f208 *above* rows that were already shown, so reading order breaks. Stats and coins land 1.7-2.1 s later than in the original. The title is text scaled up from 1.55 (blurry; text should be drawn big and scaled down). Each star overshoots to 1.38 (38%: reads as broken, f113 the star touches the title), twists from -28°, and puts out a pale ring plus 8 dots that linger to f129+ (decoration saying the same thing three times, pastel on white). A yellow sheen flashes each goal row on top of the ✓ pop. The `star` cue still fires at the start of the pop (8 frames early). The coin count is synced to the cue's ticks, but still below the fold, so it is invisible. The fighter's spin still competes with star 1. Reduced motion: handled (everything at rest).

## Brief

```
SURFACE   results-payout · shot fight-win / results-payout · seen often
GOAL      The player reads the whole result at once, then sees each star won land as one hit
          that ticks its goal, then watches the coins they earned count into their pill.
REFERENCE The Set throw: the thing lands as a hit with one burst and the number; here the star is
          the thrown thing and its slot the target.
HERO      The stars, one at a time. Then the coin count. Then the fighter cheers.
POSES     (frames from the results' mount: add 81 for fight-win frames)
          f0  (mount) card 24 px low, fading in; everything inside it already in place
          f12 star 1 starts falling from ×1.5 at 0 opacity
          f24 star 1 hits its slot: squash 1.2×0.8 held 2 frames, one gold ring goes out, star cue
          f28 goal 1 ✓ springs in (0.6→1)
          f43/f62 stars 2 and 3 hit; f71 caption + ✗ misses fade in
          f81 coins start counting (breath of 20 frames after star 3), tick for tick with coinRoll
          f126 bell: the pill bumps ×1.08; the fighter cheers
MOTION    card: translateY 24→0 · MS.panel · EASE.enterSoft; opacity MS.feedback · EASE.ui
          star: scale ×1.5→×1 · MS.quick · EASE.impact (into the hit); opacity MS.feedback
                squash SQUASH.squash in 16 ms, hold 32 ms, back on SPRING.lively
                gap 300 ms (next star starts while the last is settling)
          ring: scale 0.7→1.6 (1.9 on the 3rd of a perfect run) · MS.move · EASE.enter, opacity 0.9→0
          ✓ badge: scale 0.6→1 · SPRING.lively, opacity MS.feedback · starts 64 ms after its star hits
          caption, ✗ misses: opacity only · MS.quick · 160 ms after the last hit
          coin pill: hidden until it counts; steps 45 ms apart (the cue's ticks), ease-out total;
                     bump ×SCALE.pop on the bell, back on SPRING.lively
SOUND     star cue on each star's landing frame (starLandMs); coinRoll on the count's first step
BANNED    everything at once; scaled-up text; overshoot over 25%; twist; particles with no cause;
          a sheen flash over a row; a second celebration (the perfect-run wave); holes in the card
REDUCED   finished screen on the first frame; one star chord; the coin total, no roll
```

Three variants for the star (hero moment):
1. **Slam** (chosen): falls from big into the slot on an ease-in, squashes on the hit, one ring. Gives one exact landing frame for the sound, the ring and the ✓, so each star is one clean event, and it hits like the rest of the game.
2. **Grow**: 0→1 on `SPRING.playful` (19% overshoot) with the ✓. Softer, but the "landing" is smeared over the overshoot: no frame for the sound.
3. **Carry**: each goal's ✓ flies up into its star slot and becomes the star. The best story (the goal earns the star), but it crosses the companion bubble and costs ~300 ms more per star.

## Rounds

**r1** (the brief, built). Reads as: card whole on f86, stars land f105 / f124 / f143 with rings, caption f152, coins count f162-f182. Notes for r2:
1. The coin pill reads "0" from f94 to f162: for a second the screen says the fight paid nothing. Hide the pill until it counts; it fades in on the first tick.
2. The fighter leaps and spins f86-f110, over star 1 (f95-f105): two heroes. Hold its cheer until the stars are in.
3. (kept for later) The star sits big and nearly still f98-f102 and snaps down in 3 frames.

**r2**. Pill hidden until f163; fighter quiet until f155. Notes for r3:
1. The fighter's leap (from f155) and the coin count (from f163) start 8 frames apart: two heroes again. Cheer on the coin bell instead (after the stars when no coins count).
2. The roll is 7 ticks (sized on the fight's 15 coin drops, not the 695 paid): 0→200→695 in 300 ms reads as a jump, not a count. Size the cue on the total paid, 16 ticks (720 ms) at most.

**r3**. Clean order: stars f97-f147, caption f152, coins f165-f205, cheer f207. Notes for r4:
1. Star 3 hangs at ×1.7 nearly still f136-f141 (the old impact curve starts too flat) and at f137 overlaps the title's bottom edge: reads as "a big star appears, then drops". Start at ×1.5, curve 0.3,0,0.75,0.3.
2. The squash is invisible on the strip (f143/f144 same size): it was 0.95 of SQUASH for 48 ms. Use the full SQUASH, reach it in one frame, hold 2 frames.

**r4**. Star shrinks continuously f95→f105 with no hang and never touches the title; squash readable on f106 (zoom: `motion-out/fight-win/r4/squash.png`); ring f106-f113. All seven at 8. Second capture: positions match; 55 of 428 frames differ in drawing only, worst on f69 (the fight's knockout, before the results mount).

## What was kept, cut, changed from the draft

- **Kept:** the card rising in (re-timed to tokens, no scale); each ✓ landing with its star (now 64 ms behind it, so the star leads); the coin count synced to the `coinRoll` cue's ticks and the bump on the bell; waiting for the unlock reveal to close before paying; reduced motion showing the finished screen.
- **Cut:** the hidden stats / companion / coins and their staggered reveal (holes in the card f94-f190, 1.7-2.1 s wait for numbers the player wants); the title stamp (scaled-up text, a second hero before the stars); the 1.38 overshoot and the -28° twist; the 8 sparkles; the yellow row sheen; the perfect-run wave; the UnlockableAvatar pop after the reveal (belongs to unlock-handoff).
- **Changed:** the star cue moves from the start of the star to its landing frame; the coin box moves above the stats so the count is on screen on a 390×844 phone; the coin count is its own component (only the pill re-renders per tick, not the whole screen); the roll is sized on the total paid; the fighter's cheer waits for the payout.

## Final numbers

- `STAR_FIRST_MS` 200, `STAR_GAP_MS` 300, `STAR_FALL_MS` = `MS.quick` (180): stars hit at 380 / 680 / 980 ms. `starsLandedMs` (when the unlock reveal opens) = last hit + 450 = 1430 ms for 3 stars (was 1950).
- New tokens: `CURVE.impact` / `EASE.impact` = cubic-bezier(0.3, 0, 0.75, 0.3); `SCALE.slam` = 1.5.
- Squash `SQUASH.squash` (1.2×0.8) in 16 ms, hold 32 ms, `SPRING.lively` back. Ring 0.7→1.6 (1.9) over `MS.move`, `EASE.enter`.
- ✓ 64 ms behind its star, `SPRING.lively` from 0.6. Caption and misses 160 ms after the last hit, `MS.quick` fade.
- Coins start 320 ms after the last hit; `coinRollAmount(total)` = min(16, 4 + total/25) ticks, 45 ms apart; bump `SCALE.pop`; fighter cheers on the bell (200 ms after the last hit when nothing counts).

## Still open

- The empty grey star shows a tip above the squashed gold star for ~5 frames (f106-f110). Hide the pip once its star has landed.
- Sound timing is reasoned, not heard: the capture is silent and the band snaps cues to its next 32nd (up to ~60 ms late, never early).
- First-time results (an unlock reveal opens at `starsLandedMs`): the coins count 450 ms after the last reveal closes. Not captured in this lane (the reveal is the unlock-reveal surface).
- The fighter avatar still changes opacity on f47 of the reduced capture (its own reaction code: the creatures surface).
