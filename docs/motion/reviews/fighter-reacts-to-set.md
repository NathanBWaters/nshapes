# fighter-reacts-to-set

The player's fighter answers a Set: it hopped, and from a streak of 3 it did a full spin every Set. Seen on every Set.
Entries: F:67, S:fighter-react-joy, S:fighter-react-ecstatic-spin, S:fighter-fx-burst.

Shots (`scripts/motion/shots/creatures.mjs`): `fighter-joy` (a single Set, studio, `--dpr 2`),
`fighter-streak` (a Set on a streak of 5), `fighter-ecstatic` (the cheer for something that has
already landed), `fighter-joy-quiet` (Effects off), `fight-cheer` (a plain Set in a real fight on
1-3, whole screen). `fight-set` on 1-5 rolls a heal in later captures and then plays the heal
reaction, not the cheer (see "Tools" in the report), so `fight-cheer` is the in-fight shot here.

Note on `fighter-streak/before`: it was captured as the old streak behaviour (the `ecstatic`
reaction the conductor fired on every Set from a streak of 3). `fighter-streak/r2` is what a
streak Set plays now (the cheer at streak 5). Both are "a Set on a streak", before and after.

## Scores

Response / Readability / Motion / Staging / Rhythm / Identity / Sync

| round | scores | |
|---|---|---|
| before | 8/7/6/4/5/4/6 | |
| r1 | 8/8/8/8/8/8/7 | crouch on the tap, hop released at the landing, streak raises it, spin gone, quiet prop |
| r2 | 8/8/8/8/8/8/7 | deeper crouch (reads at fight size), ears and tail settle with one overshoot |
| r3 | 8/8/8/8/8/8/7 | the head waited for the wrong clock: it now lifts two frames after the release |

## Baseline (before)

- **Staging (fight-cheer/before, fight-set/before):** the Set is resolved on f13 and the cards fly f13→f32. The fighter crouches f13–f16 and is in the air f18–f28, peaking about f24: it jumps while the throw is in flight, and its hearts pop at f18. Two things moving for the eye before the hit lands on f29–f30.
- **Streak (fighter-streak/before):** every Set from a streak of 3 played `ecstatic`: coil, −15° counter-wind, then 368° in 540 ms (f4–f30), upside down on f12–f20. A full spin as the celebration (banned), a different and louder move on every Set of a streak, ~40 frames long.
- **Motion (fighter-joy/before):** a sideways weave on `inOut(sin)` flagged LINEAR at f21 and a HARD-STOP at f27; the hearts start at ×0.52 and grow again to ×1.14 while fading out (a second pop at the end, f30–f46).
- **Effects off:** the fighter had no way to know.

## Brief

```
SURFACE   fighter-reacts-to-set · shots fighter-joy, fighter-streak, fight-cheer · seen constant
GOAL      The fighter is glad the Set landed: it answers the tap with a crouch and cheers
          on the landing, a little higher the longer the streak.
REFERENCE Support of the Set's hit (the throw is the hero, the foe's impact the payoff).
HERO      The thrown cards, then the hit on the foe. The fighter holds still in a crouch
          while the cards fly, and hops on the landing frame: smaller and shorter than the throw.
POSES     f0   face swaps to joy
          f4   crouch: squash 0.88, down 0.045·size (CHEER.windMs, EASE.enter)
          f4–f15 hold the crouch (the throw is in the air)
          f15  release (CHEER.releaseMs = 240 ms = FX_TIMING.flightMs): stretch 1.10–1.15,
               hearts on at ×1.1 two frames later
          f24  top of the hop (−jump·0.75 single Set … −jump·1.1 at streak 5)
          f33  touch-down: squash 0.9 held 2 frames, then SPRING.lively
          f36  at rest; hearts rise and fade to f56
MOTION    bodyTy: +0.045s → −lift · CHEER.riseMs EASE.enter → 0 · CHEER.fallMs ease-in
          scaleY: 0.88 → 1.10+0.05i (90 ms) → 1 (EASE.drift) → 0.9 at touch-down → SPRING.lively
          rotate: 2° → −(4+4i)° → SPRING.lively
          head:   −0.03s, 2 frames after the release, SPRING.lively
          ears ±(14+6i)°, tail 16° two frames late: SPRING.playful (one overshoot)
          ecstatic (a row that has already landed, a hero moment): the same hop at i = 1,
          crouch 2 frames, released at once
          streak: i = clamp((streak−1)/4, 0, 1); from i ≥ 0.5 the cheer adds its centre mark
SOUND     none of its own
BANNED    the full spin on a Set; a different animation for a streak; leaving the ground
          before the Set lands; marks that grow again while they fade
REDUCED   reduced motion and Effects off (`quiet`): the face and the marks still, no movement
CHECK     crouch by f4 · still f4–f15 · release on f15 (fight: the frame the foe is hit) ·
          land f33, rest f36 · no spin in any Set reaction · no LINEAR/HARD-STOP hints
```

## Rounds

**r1.** The conductor no longer switches to `ecstatic` from a streak of 3: every Set is `joy`, and the avatar reads `streak` as `cheerIntensity`. Joy and ecstatic are one hop (ecstatic released at once, at full height); the spin stays only for the 5-pets easter egg (`dizzy_joy`). Read: fighter-joy f0 face, f3 crouch (shallow), still to f15, hop f16–f27, land f33. In the fight (fight-cheer/fighter-r1) the fighter is crouched and still while the cards fly f13–f28 and hops f30–f38 with its hearts; the foe is hit f29–f30. Streak: the same hop, higher, plus the centre mark; nothing upside down. New defects: the crouch hardly reads at fight size (0.9, 0.035·size); the ears and tail come back on SPRING.loose, three swings on every Set.

**r2.** Crouch 0.88 and 0.045·size; ears and tail on SPRING.playful. Read on the compare sheet (fighter-joy before vs r2) and fight-cheer r2: crouch visible on f3, hop on the landing, one overshoot on the ears. No LINEAR or HARD-STOP hint left (only ALL-AT-ONCE, which is the creature's layers starting on the trigger frame by design).

**r3.** Found on the r2 strip: the head started up on f14, a frame *before* the body's release (its delay was counted from the end of the crouch, not from the release). Now `CHEER.releaseMs + 32`. r2 vs r3 compare: f14–f15 the head stays down in r3; the rest is unchanged. The report's DEAD-STRETCH f4–f15 is the held crouch, on purpose (the throw is the hero in that window).

Reduced (`fighter-joy/reduced`) and Effects off (`fighter-joy-quiet/r2`): face and hearts still for the hold, no movement (idle life still runs with Effects off).

## Final numbers

- `src/utils/motion.ts` new `CHEER`: windMs 60, releaseMs 240, riseMs 150, fallMs 130, landHoldMs 32, liftMin 0.75, liftMax 1.1, streakFull 5; `cheerIntensity(streak)`.
- Joy: crouch 0.88 / +0.045·size; stretch 1.10 + 0.05·i over 90 ms; apex back to 1 over 120 ms (EASE.drift); touch-down squash 0.9 at 520 ms from the trigger, held 32 ms, SPRING.lively. Lift = max(6, 0.22·size) × (0.75 + 0.35·i). Tilt −(4 + 4i)°. Ears ±(14 + 6i)°, tail 16° at +272 ms, SPRING.playful. Head −0.03·size at +272 ms.
- Ecstatic: the same with i = 1, a 32 ms crouch and no hold.
- Burst for joy/ecstatic: linear progress over the reaction's hold (joy 900 ms, ecstatic 1200 ms); nothing before the release; on at ×1.1 two frames after it; ×1 four frames later; rises 9 px on an ease-out; fades over the last 28%. No regrow. Still/reduced progress: release + 0.2.
- Conductor: heal → `heal`, grace → `relief`, otherwise `joy` (mega and streak no longer fire `ecstatic` from the tap).

## Still under 8, and why

- **Sync 7.** `FighterAvatar` takes `quiet`; AdventureRun must pass `quiet={!effects}`. And the hop is released by a constant (`CHEER.releaseMs`) equal to the fight's flight time, guarded by a test (`creatureReactions.test.tsx`): if the fx lane retimes the flight, the test fails and the constant must follow. Better: AdventureRun calls the cheer on the hit's `onLand` (a `fighter: 'joy'` on the `hit` row, and `triggerMatch` only counting the streak), then `CHEER.releaseMs` can go to 0 for fights.
- In Free Play (no throw) the hop still comes 240 ms after the Set, after an immediate crouch. Not captured.
- `fighter-fx-burst`'s symbols still share one transform (they spread a little because they scale about the centre). Not changed: one round, three notes.

## For the director (other lanes' files)

- AdventureRun: pass `quiet={!effects}` to `FighterAvatar` and `EnemyAvatar`.
- Catalog/AdventureRun: rows that already land on the foe and fire `fighter: 'ecstatic'` (rainbow, combo, hot_streak_hit, grudge_release, surge_hit, parry...) now play the same hop at full height, at once. `combo` fires on every Set with the Combo passive: with the tap-time cheer, a Combo Set plays the crouch and then the ecstatic hop on the landing (one gesture, verified in the studio, not in a fight with Combo).
- `src/utils/fighterAnimations.ts` (not this lane): `FIGHTER_REACTION_HOLD_MS.joy` 900 fits the new cheer (lands at 520 ms); `ecstatic` 1200 is now longer than its motion (rest by ~350 ms) and holds the face for the rest.
