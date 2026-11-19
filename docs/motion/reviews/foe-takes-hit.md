# foe-takes-hit

The foe recoils and squashes when a Set lands, with impact stars. Seen on every Set.
Entries: F:28, F:68, S:enemy-react-pain, S:enemy-react-crit-pain, S:enemy-fx-burst.

Shots: `foe-hit`, `foe-chain` (three hits 12 frames apart: a short cascade), `foe-crit`,
`foe-hit-quiet` (Effects switch off) in `scripts/motion/shots/creatures.mjs` (creature studio,
clipped to the first foe card, `--dpr 2`); `fight-set` for the real fight.

## Scores

Response / Readability / Motion / Staging / Rhythm / Identity / Sync

| round | scores | |
|---|---|---|
| before | 8/7/5/5/5/7/5 | |
| r1 | 9/8/8/7/8/8/7 | hit-stop, single knock-back, chain context, quiet prop, stars on at f1 |
| r2 | 9/8/8/7/8/8/7 | chain cap 2 steps (gain 0.15), stars fully opaque on f1 |

Staging and Sync stay at 7 because of code outside the creature (see "Still under 8").

## Baseline (before)

- **Motion, f1–f13 (foe-hit):** the squash takes 65 ms to arrive (0.81 at f4), then rebounds at once: no frame of the impact is held. The body then swings four times on X (+r, −0.82r, +0.55r, −0.28r) while the body rotates 11° → −6° and the head 14° → −8°: a multi-oscillation wobble on something seen forty times a fight (banned list).
- **Stars (enemy-fx-burst):** start at ×0.4 and transparent, peak ×1.14 at f10, 160 ms after the hit; the impact mark arrives late.
- **Chain (foe-chain):** every beat restarts the reaction from its first keyframe and the stars restart from nothing: at f12 and f24 the stars blink out and grow again.
- **In the fight (fight-set, foe at 343,90):** the orb lands f28–f29; the foe's squash shows f30; the HUD bump of the foe (anchor ×1.28 in 70 ms) makes the squashing foe *bigger* on f31–f33 while AdventureRun's own foe flinch (scale 0.9, ±8 px) plays on top; from f32 the stage's burst and the "−3" cover the foe for about 18 frames. Three scale moves on one creature on one frame.
- **Effects off:** the creature has no way to know; the reaction plays in full.

## Brief

```
SURFACE   foe-takes-hit · shots foe-hit, foe-chain, foe-crit, fight-set · seen constant
GOAL      The foe has visibly been hit on the frame the hit lands, and a chain of hits
          pushes it further back instead of starting again.
REFERENCE The Set's own hit on the stage (it is the hero; this is its support).
HERO      In a fight: the stage's hit burst and number. The creature's reaction is support:
          it starts on the impact frame, is over in ~13 frames, and moves the body less than
          the throw moves the cards.
POSES     f0  the face swaps to pain (the frame the reaction is triggered)
          f1  impact pose: squash 0.82 (volume kept), knocked back +recoil (away from the
              fighter), tipped back 9°, sunk 0.03·size; ears flung ±18°; stars on at ×1.12
          f2  the head follows a frame late (11°)
          f1–f4 hold (the hit-stop: HIT.holdMs 48 ms)
          f5–f12 recover on springs; f13 at rest
          f20 the stars are gone; the face keeps its pain until the hold ends (760 ms)
MOTION    scaleY: → 1−0.18·g · HIT.snapMs · EASE.enter · hold · SPRING.lively
          bodyTx: → recoil·g · same · SPRING.settle (no swing back past rest)
          bodyTy: → 0.03·size · same · SPRING.settle
          rotate: → 9°·g · same · SPRING.lively
          head:   → 11°·g · +1 frame · SPRING.lively
          ears:   ±18° · SPRING.loose (the loose parts may follow through)
          stars:  progress linear over HIT.starsMs (320); opacity on by half a frame, off over
                  the last 8 frames; scale 0.7 → 1.12 (f1) → 1 (f4) → 0.96; rise 8 px ease-out
          crit:   squash 0.74, recoil 1.4r, tilt 16°, ears ±24°, hold HIT.critHoldMs (64),
                  scale back on SPRING.playful
          chain:  g = 1 + HIT.chainGain·chain (chain = same hit within HIT.chainWindowMs, max
                  HIT.chainMax = 2 → g ≤ 1.3); from wherever the body is; hold HIT.chainHoldMs
                  (32); the stars carry on from full size instead of growing again
SOUND     none of the creature's own; the hit's cue belongs to the stage beat
BANNED    multi-swing shake; a late-peaking star burst; restarting a reaction from rest
          on every beat; motion with the Effects switch off
REDUCED   reduced motion and Effects off (`quiet`): the face swaps and the stars show still
          at their full-size pose for the hold; nothing moves
CHECK     impact pose complete on f1 · f1–f4 identical bar the head · at rest by f13 ·
          stars gone by f20 · chain f12/f24 goes deeper with no star blink · quiet and
          reduced show no body movement
```

## Rounds

**r1.** Built the brief. f1 is the full impact pose; f2–f4 hold (only the head moves, on f2); f5–f12 recovery with one small overshoot of the squash; at rest f13 (before: still swinging at f20). Chain: hit 2 (f13) and hit 3 (f25) go deeper from the recovering pose, the stars stay up the whole time. New defects: the stars are half transparent on f1 (opacity keyed on the full first frame); the third step of a chain throws the body out of its frame (gain 1.44 → 13° and 1.44r).

**r2.** Stars fully on at half a frame of progress; chain gain 0.15 capped at 2 steps (≤ ×1.3). Read on the compare sheets: f1 complete with stars; chain f26 deeper than f14 but inside its frame. In the fight (fight-set r2): the foe's impact pose shows on **f29**, the frame the orb disappears, one frame before the stage's burst and number (f30). Then it is covered by the stage burst until ~f50 and is back at rest under it.

Crit (foe-crit r2): f1 impact, hold to f5, recovery f6–f16; heavier than a plain hit and still one gesture.

Reduced (`foe-hit/reduced`) and Effects off (`foe-hit-quiet/r2`): the face and the still stars for the hold, no body movement; with Effects off idle life (tail, breath) keeps running.

## Final numbers

- `src/utils/motion.ts` new `HIT`: snapMs 16, holdMs 48, critHoldMs 64, chainHoldMs 32, chainWindowMs 420, chainGain 0.15, chainMax 2, starsMs 320.
- Springs: SPRING.lively (scale, rotation, head), SPRING.settle (translation), SPRING.loose (ears), SPRING.playful (crit squash). Snap curve EASE.enter.
- Plain hit: squash 0.82, recoil max(5, 0.14·size), sink 0.03·size, tilt 9°, head 11° (+16 ms), ears ±18°. Crit: 0.74, 1.4r, 0.045·size, 16°, 16°, ±24°. Chain ×(1 + 0.15·chain), recoil ≤ 1.7r, tilt ≤ 22°, squash ≥ 0.72.
- Stars: 320 ms linear progress; opacity [0, 0.025, 0.6, 1] → [0, 1, 1, 0]; scale [0, 0.05, 0.2, 1] → [0.7, 1.12, 1, 0.96]; y −8·(1−(1−p)²). Still/reduced progress 0.3.
- Expression hold unchanged (pain 760 ms, crit 1050 ms).

## Still under 8, and why

- **Staging 7 (fight only).** Three transforms still stack on the foe at the impact: the creature's squash (mine, now correct), the HUD anchor bump ×1.28 (`src/adventure/fx/anchors.tsx`, `Anchor.jump`) and AdventureRun's `foeStyle` flinch (scale 0.9 + ±8 px shake, `AdventureRun.tsx` `onLand`). The creature's impact stars also say the same thing as the stage's burst, which covers the foe from f30 to ~f50. What they should become: see the report to the director (below).
- **Sync 7.** `EnemyAvatar` now takes `quiet`; AdventureRun must pass `quiet={!effects}` (and the same for `FighterAvatar`), and its own `foeStyle` flinch must be skipped when effects are off. Until then the foe still flinches with Effects off.
- **Dead stretch** (report hint f35–f47): the pained face held after the body is at rest; deliberate (in a fight it is the part of the reaction you see once the stage's burst clears). The face's swap back is the creature-face surface.

## For the director (other lanes' files)

- **HUD bump of the foe (`anchors.tsx`):** the foe anchor should not scale up when a hit lands on it; the creature now owns the impact (squash on the landing frame + hold). Make the `foe` anchor's bump a no-op for rows that carry `enemy` (hit, rainbow, blast...), or at most ×1.04 over 2 frames with no overshoot so it never reads as growth while the body squashes. Other anchors keep ×1.28.
- **AdventureRun `foeStyle` flinch (F:28):** delete it (the creature's knock-back replaces it); at least skip it when `!effects`. Pass `quiet={!effects}` to `EnemyAvatar` (and `FighterAvatar`).
- **Timing:** `onLand` reaches the creature one frame before the stage's burst/number is drawn (impact pose f29, burst f30 in fight-set r2). The fx lane retiming the hit should land both on the same frame.
- **Duplicate marks:** with the stage burst on the foe, the creature's own impact stars are a second version of the same mark in fights. Either keep them (they are small and short now, and they are the only mark in the studio and outside the stage) or add a prop to hide them in fights.
