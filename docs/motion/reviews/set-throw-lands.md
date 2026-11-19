# set-throw-lands

A Set's own cards fly at the foe; the burst, the number and the rings. Seen on every Set of every fight.

Shot: `fight-set` (a real Set in 1-5, whole screen). Also `fx:hit`, `fx:rainbow`, `fx-cascade` (effects studio, where nothing is thrown: the orbs are the projectile), `fight-set --reduced`, `fx-hit-effects-off` (new: the in-game Effects switch off).
Frames below are from the trigger (the third tap). In this lane the board waits 200 ms before it checks the Set, so the stage starts on f13; the board lane is cutting that to 80 ms (`CARD_MOTION.confirmMs`), which moves every frame here about 8 earlier.

Sound is measured, not guessed: the band logs when each fight cue will be heard (`window.__nshapesCueLog`, dev builds only) and the capture prints it next to the frames.

## Scores

Response / Readability / Motion / Staging / Rhythm / Identity / Sync

| Round | Scores | What changed |
|---|---|---|
| before | 6/6/5/4/5/6/2 | |
| r1 | 6/6/5/6/6/6/7 | sound times from the picture; impact drawn on the landing's commit; no orbs or board rings with a thrown Set |
| r2 | 7/8/6/7/7/7/8 | burst big on the hit frame; number slams in and holds still; card whole until it hits; pieces visible on their mount frame |
| r3 | 7/8/8/8/8/8/8 | thrown cards: pick-up, draw-back, bow, livelier launch; no white wash; not dimmed |
| r4 | 7/8/8/8/8/8/8 | number leaves in 119 ms (was 400); orbs of an unthrown Set arrive together |
| r5 | 7/8/8/8/8/8/8 | the throw starts at the picked card's size (seam with the board lane) |

## Notes by round

**Before.** Payout heard f14; the stage starts f13; the HP bar drops f28; the burst appears f30 at ×0.15 and peaks f33; the cards arrive f31-32 already fading out (opacity 1→0 over their last 14%), washed white and dimmed to 60% (they are drawn as disabled cards); three big red orbs with six tail dots fly with them and land f32-36; six board rings (two per slot) spread across the whole board f17-f36. The hit reads as five events over 8 frames, and the sound comes 14-18 frames before all of them. In a chain the blast's cue was on its picture (f37 both); an orb-only step (coins) was 240 ms early. The number pops from ×0.5 at full opacity and drifts upward the whole time it is read.

**r1. Sync and one event.** (1) Each beat says when its sound is heard (`Beat.cue`): on arrival for anything that flies (the Set, a coin), at the start for an effect that goes off on the board (a blast). The script hands that to the band on the event (`heardAfterMs`), a flight is a whole number of 32nd notes (`flightFor`, 250 ms at 120 bpm) so the cue stays on the beat, and `band.stretch` counts the chain from the band's next note and returns how long that is; the stage starts that much later (less one frame), so the picture meets it. (2) The burst, ring, ticks and number of a flying beat are drawn when the beat lands (`landed`, the same commit as the HP bar and the foe's flinch), not on a UI-thread delay from mount (which had drifted 2 frames). (3) A thrown Set sends no orbs and no board rings: the cards are the projectile. Result: payout f29.9, impact pieces mount f29, cards arrive f30. But the burst was invisible on f29 and tiny until f31 (peak f34): the sound was on time for a picture that did not read yet.
A first attempt timed every sound one flight late; the capture showed the blast's cue moving from its explosion (f37) to f55. Reverted the same round to per-event timing.

**r2. The hit frame.** Burst ×0.7 → ×1.15 → ×1 over 6 frames on `EASE.ui` (was ×0.15 → ×1.18 over 7 on linear progress). Number slams from ×1.6 to ×1 in `MS.feedback` on `EASE.enter`, opaque within two frames, holds still, lifts on `EASE.exit`. Thrown card stays opaque to the end; its flight is one frame shorter than the beat so it is at the foe the frame before the burst. A piece with no delay is visible on its mount frame (`ON_MOUNT`): before that, f29 was an empty frame between the card leaving and the burst.

**r3. The throw.** f13-f17: picked up (scale to ×1.1, drawn back 8 px from the foe). f18-f28: flies on a bow (6% of the distance, at most 20 px, the three fanned 10 px apart, so they converge), ease-in that already moves at 35% of an even pace when it leaves (was a plain quad: nothing visible for 7 frames, then the last 41% in 3 frames). Arrival ×0.3 (was ×0.16). Removed the white wash (0.9 → 0.25 → 0.5, a flicker) and the 60% dim of a disabled card: the cards fly as themselves. The analyzer reports the bow on the right card (24-25 px); the others bow 10 and 20 px, under its threshold, visible on the strip.

**r4.** The number's exit was 400 ms against a 120 ms entrance: now `exitMs(MS.quick)` (119 ms). In the studio (no throw) the second and third orbs landed 3 and 6 frames after the burst: each later orb now flies that much faster, so all three heads arrive on the landing.

**r5.** Seam with the board lane: the thrown copy started at ×1 over a picked card at ×1.045. It now starts at `CARD_MOTION.pickedScale` (read from CardMotion.tsx, not copied). The yellow selection fill does disappear at the hand-off (the copy is not "selected"); the board's white flash used to hide that.

## Final numbers (fight-set r5)

- f13 the copies mount (board validates at 200 ms in this lane) · f13-f17 pick-up · f18-f29 flight · f29/f30 cards at the foe · f30/f31 burst, number, ring, ticks, foe flinch · payout heard f30.3 (r4: f29.6 against a f29 burst; r3: f31.4 against f31). HP bar's first visible change is 1-2 frames after the burst.
- Throw (`THROW` in visuals.tsx): pickUp 0.2 of the flight, lift ×1.1, arrive ×0.3, drawBack 8 px, launch 0.35, bow 6% ≤ 20 px, fan 10 px, rotation ±24°.
- Flight: `flightFor(grid)` = round(240 / grid) × grid (250 ms at 120 bpm), + the wait for the band's note (0-62 ms at 120 bpm, less one frame).
- Burst: ×0.7 → ×1.15 (eased 0.3) → ×1 (0.5) → ×1.25, fade from eased 0.75, 380 ms, `EASE.ui`.
- Number: from ×1.6 (lead) / ×1.3 (others) in `MS.feedback` `EASE.enter`; hold 520 + 200·tier ms; out in `exitMs(MS.quick)` on `EASE.exit`, rising 12 + 6·tier px.
- Sound: a cue is heard `SOUND_AFTER_PICTURE_MS` (16 ms) after its picture is due.

## Reduced motion and Effects off

- `fight-set --reduced` (OS reduced motion turns Effects off too): no throw, no burst; the number appears on f16 white with an ink edge on the foe, as with effects on, and holds still; payout f17. Before this change the number was drawn red, starting at the foe's middle and running off the screen's edge, and (found here) Reanimated's reduced-motion handling jumped its fade to the end, so it showed for one frame: the number now keeps its hold and fade (`ReduceMotion.Never`) and drops its slam, lift and shake.
- `fx-hit-effects-off` (Effects switch only): the number slams from ×1.4 to ×1 in 5 frames and holds. Nothing flies.

## Still under 8, and limits

- Response 7: the 13 frames between the third tap and the throw are the board's validation delay (set-tap-confirm, another lane, being cut to 80 ms).
- Captures are not pixel-repeatable from run to run: the picture waits for the band's next note, read from the real audio clock, so the landing frame moves by up to 4 frames between captures (seen f29-f31). Compare by the report's numbers. The relation (card at foe, then burst and sound on the next frame) held in every capture.
- The HP bar is AdventureRun's: it starts 1-2 frames after the burst.
- `fight-set` before and after deal different boards (the fight's deal is not the same across commits), so the compare sheet's boards differ; judge the top of the screen.
- Native was not captured.

## Brief (written after the baseline)

```
SURFACE   set-throw-lands · shot fight-set · seen constant
GOAL      The three cards leave the board and smash into the foe; the hit is one frame.
HERO      The cards in flight, then the number.
POSES     play+0   cards picked up (pickedScale), board slot keeps its copy
          play+4f  cards ×1.1, drawn back 8 px
          land-1f  cards at the foe, ×0.3
          land     burst ×0.7, number ×1.6 opaque, HP bar, foe flinch, payout (+1 frame)
          land+6f  burst settled, number ×1, still
          +hold    number lifts 12 px and fades in 119 ms
SOUND     payout on the landing frame or one after; every chain cue on its own picture
BANNED    orbs and board rings beside thrown cards; white wash; fade before contact;
          a number that drifts while read; linear progress on scale
REDUCED   no throw, no burst; the number in place, still, held, faded
```
