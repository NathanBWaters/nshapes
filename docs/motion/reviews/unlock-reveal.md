# unlock-reveal

After a first-time win: the stars land, the screen goes dark, a silhouette waits on a medallion, a tap shows what was won.
Seen sometimes, and it is a hero moment (the reward the level was played for).
Shots: `unlock-open` (from the results' mount, 150 frames; the reveal opens on f63) and `unlock-reveal` (the tap on Reveal, 100 frames), both on `/dev/results?case=fighter` (1-5, Sly Fox then the 1-5F path).
Scores are Response / Readability / Motion / Staging / Rhythm / Identity / Sync. Inventory: A:results-unlock-delay, A:unlock-modal-fade, A:unlock-rays, A:unlock-flash, A:unlock-hero-pop, A:unlock-detail-rise, A:unlock-avatar-acting.

## Scores

| Version | Scores | Capture |
|---|---|---|
| before (4fa5269) | 7/4/4/3/4/3/3 | `motion-out/unlock-reveal/before` (`--twice`), `motion-out/unlock-open/before` |
| r1 (turn on EASE.exit, swap on a timer) | 8/5/6/6/6/7/4 | `motion-out/unlock-reveal/r1`, `motion-out/unlock-open/r1` |
| r2 (turn on EASE.impact) | 8/6/7/7/7/7/5 | `motion-out/unlock-reveal/r2` |
| r3 (swap driven by the turn itself) | 8/8/8/7/7/8/6 | `motion-out/unlock-reveal/r3` |
| r4 (landing moved to the round frame) | 8/8/8/8/7/8/7 | `motion-out/unlock-reveal/r4` |
| r5 (final: buttons with the card, reduced motion) | 8/8/8/8/8/8/8 | `motion-out/unlock-reveal/r5` (`--twice`: positions match, 2 frames differ in drawing only, f62 = the fox's own reaction) |
| reduced | fade through the dark, nothing moves | `motion-out/unlock-reveal/reduced` |

Compare sheets: `motion-out/unlock-reveal/r5/compare-before-vs-r5.png`, `motion-out/unlock-open/r1/compare-before-vs-r1.png`.

## Baseline critique

- **Open** (`unlock-open/before`): star 3 lands f37; the results then hold f45-f62 while the fighter starts its cheer on f49, and the reveal fades in over it on f63, covering the leap mid-air. RN's Modal fade (250 ms) cross-fades the whole dark screen with the results: f64-f70 the headline "New fighter unlocked!" sits over "PERFECT!" and the goal rows (text over text). Medallion, rays and words all arrive in the one fade.
- **Tap** (`unlock-reveal/before`): on f0 everything changes at once: the medallion swaps face (hard cut), the whole layout jumps up ~70 px (the content was centred; the details make it taller, so the headline the player was reading moves), name, bubble, card and buttons appear, and a white full-screen flash (opacity 0.9, banned) washes everything f1-f28. The 1.12 bump happens under the flash and cannot be seen. The new fighter's `ecstatic` reaction starts on f0 too: it spins nearly a full turn (±170°, f0-f20), a second hero on the same frame. No anticipation; no pause before the payoff. Rays and flash ignore reduced motion; the results behind the opaque modal keep animating.

Three worst: (1) the flash + hard swap on f0 (no moment, a banned flash); (2) the layout jump under the eye at f0; (3) four things start on f0 (face, details, flash, the fox's spin).

## Brief

```
SURFACE   unlock-reveal · shots unlock-open, unlock-reveal · seen sometimes (hero)
GOAL      The player feels the reward turn over into view, then reads what it is, then is offered what to do.
REFERENCE A card turned over in the player's hand: this game is cards. The landing echoes the results star's ring.
HERO      The medallion. Then its name. The creature acts only after.
POSES     open (from the reveal's mount):
          f0   results; dark backdrop starts (MS.quick, opacity only)
          f10  backdrop opaque; headline rises 14 px in (MS.quick fade, MS.move EASE.enter)
          f14  medallion in from 0.7 on SPRING.lively, fade flat 1/2.5 of the spring; rays with it
          f21  "Reveal" and the tease rise in
          tap:
          f0   tap; medallion winds in to SCALE.windup 0.9 (MS.feedback, EASE.ui)
          f8   turns edge-on: scaleX 1→0 (MS.feedback, EASE.impact: speeds into the edge)
          f16  edge-on, held 2 frames; the face is swapped here by the turn's own callback
          f19  comes round on SPRING.lively (scaleX), windup springs back with it
          f26  round: accent ring 0.95→1.7 over MS.move, the unlock sound
          f34  name rises; f38 companion; f41 card and buttons (STAGGER.item apart)
          f61  the creature starts its own reaction
MOTION    all tokens: MS.feedback, MS.quick, MS.move, EASE.ui/enter/impact, SPRING.lively, SCALE.windup, STAGGER.item
SOUND     band.audition / auditionEvolution / sfx('unlock') on the round frame (LAND_MS = 416 ms), was on the tap
BANNED    white flash; everything on f0; a layout that moves while read; a creature spinning over its own reveal;
          RN Modal's cross-fade (text over text)
REDUCED   the medallion's face fades out through the dark (MS.feedback) and back in as the reward (MS.quick),
          words fade in a third of their delay apart, rays stand still, no windup, turn or ring
CHECK     first change ≤ f2 on the medallion; no frame where the old face is seen changing; ring and sound on the
          round frame; headline y identical before and after the tap; scores 8+
```

Three variants (differ in kind):
1. **Turn over** (chosen): wind in, turn edge-on, come round as the reward, one ring. The swap happens where nobody can see it, so the old hard cut disappears instead of being dressed up; it is the game's own object (a card), and it gives one exact landing frame for sound and ring.
2. **Charge and burst**: the medallion shrinks and the rays draw in for 300 ms, then it bursts back with an accent ring and the rays flung out. Strong, but it is the flash with a new colour: the face still swaps on a visible frame, and the rays loop at 26 s a turn so a burst on them reads as a glitch.
3. **Rise from the dark**: the silhouette sinks, the reward rises up out of the medallion's bottom edge (masked). Most story, but a mask on react-native-web is costly and the fox's own entrance would fight the rise.

## Rounds

**r1** (the brief, built). The open is clean (dark f63-f72, headline f73, medallion f77-f85). The tap: windup barely readable but there (f1-f4, ~10%). Notes:
1. f15: the fox is already showing at full width; f16 thin; f17 edge-on. The swap timer (240 ms) fires before the turn reaches the edge: EASE.exit (ease-in-expo) keeps scaleX near 1 until its last frame and Reanimated starts a frame late. Swap from the turn itself.
2. f17-f20: four frames with nothing but rays. Use EASE.impact so the turn is visible all the way to the edge.
3. (kept) sound and ring on LAND before the face is round.

**r2** (EASE.impact). The turn now reads f12-f16. Swap still visible: f16 shows the fox at 20% width. The timer race remains.

**r3** (`runOnJS(setRevealed)` in the turn's finish callback). f16 old face edge-on, f17-f19 edge-on held, f20 the fox appears as a sliver: no swap is ever seen. Notes:
1. Ring starts f22 while the medallion is 40% wide (round on f26): the ring and the sound are 4-5 frames early. Move LAND to the round frame (+144 ms after the hold).
2. Buttons arrive f46, 0.3 s after the card: the footer is empty f17-f45.

**r4** (LAND 416 ms). Ring f28-f33 on the round medallion; name f34, bubble f37, card f41, buttons f45.

**r5** (final). Buttons with the card (f41). Swap backstop timer inside the hold (for places with no frames, like tests). Reduced motion built and captured: Reanimated skips every animation under reduced motion by default, so the fades carry `ReduceMotion.Never` (fades only; nothing that moves).

## Final numbers

- Open: backdrop `MS.quick` EASE.ui; headline at 140 ms (`MS.quick - 40`); medallion from 0.7 on `SPRING.lively` at 220 ms; Reveal button and tease at 340 ms. The reveal still opens at `starsLandedMs` (last star + 450 ms): with the cheer gone that is a still breath (f45-f62) after the caption.
- Tap: windup `SCALE.windup` (new token, 0.9) over `MS.feedback`; turn `MS.feedback` on `EASE.impact`; edge hold 32 ms; back on `SPRING.lively` (≈10% overshoot on scaleX); `LAND_MS` 416; ring 0.95→1.7 over `MS.move` EASE.enter, opacity 0.85→0; details at LAND+100 + k×`STAGGER.item` (name, bubble, card+buttons); the creature's reaction at `detailAt(3) + MS.move` ≈ 976 ms.
- Layout: the scroll is top-aligned (paddingTop 36), so nothing above the details moves when they arrive.
- The fighter on the results no longer cheers before a reveal: it cheers `REVEAL_PAYOUT_MS` (450 ms, the same as the coin start) after the last reveal closes (`LevelResults.tsx`).

Files: `src/adventure/components/UnlockReveal.tsx`, `LevelResults.tsx`, `ResultsMotion.tsx` (`REVEAL_PAYOUT_MS`), `src/utils/motion.ts` (`SCALE.windup`), four tests that now let the reveal play (`__tests__/fighters.test.tsx`, `adventureWorkshopAndTutorialUI.test.tsx`, `adventureSecretPaths.test.tsx`, `adventureOnboardingAndStars.test.tsx`).

## Still open

- **The fox's `ecstatic` reaction** (creature rig, another lane): a near-full spin (rocks -165°…174°) with a LINEAR move on `#fighter-fx-ecstatic` (f62). It now waits until the details are in, but a full spin as the celebration is on the banned list. It should become a hop with squash (0.85×1.15 up, 1.2×0.8 on landing) and a ±10° tilt, no spin.
- **Sound timing is reasoned, not measured**: `sfx('unlock')` and `band.audition` do not write to `window.__nshapesCueLog`, so the report has no cue section. The call is on f26, the round frame.
- **The results behind the opaque reveal keep animating** (both avatars measured moving under it, f0-f99): invisible battery cost. Pausing them needs the results to know the reveal is up (`unlocksRevealed` is false then): a follow-up for LevelResults/the creature rigs.
- Edge-on hold f17-f19 is 3 frames of rays only: read as the breath before the payoff; shorter makes the swap race return.
