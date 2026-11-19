# story-abduction

Cold-open Beat 1 of Adventure Mode (`StoryIntro.tsx`, `story.ts`): wild critters (`Masked Bandit`, `Iron Shell`) swoop into the moonlit valley, slam forged iron cages down onto your three animal friends (`Sly Fox`, `Corgi`, `Badger`), and scatter gleaming beveled SVG Golden Keys across the meadow road. Beats 2 (`keys`) and 3 (`hero`) follow with the map-road Golden Key reveal and `Orange Tabby` + 3-card Set hint.

Shot: `story-open` (`/dev/adventure?save=fresh`, 110 frames × 16 ms = 1760 ms, viewport 390×844).
Scores are Response / Readability / Motion / Staging / Rhythm / Identity / Sync.

## Scores

| Version | Scores | Capture |
|---|---|---|
| before (old falling star) | 6/6/5/6/5/5/6 | `motion-out/story-open/before` |
| r1 (abduction draft) | 8/8/7/7/8/9/8 | `motion-out/story-open/r1` |
| r2 (final) | 9/9/9/9/9/10/9 | `motion-out/story-open/r2` (`--twice`) |
| reduced | settled composition on f0, 0 travel/springs | `motion-out/story-open/reduced` |

## Baseline critique (`before`)

Captured on the previous `Starfall` scene (`motion-out/story-open/before/contact.png`, `strip.png`):
1. **20+ frames of empty mountain + 950 ms text void (`f6–f55`):** The mountain sat alone with zero characters and an empty black lower half until `f62` (`992 ms`).
2. **One-frame disappearance cut + default white flash (`f55–f62`):** The star vanished on `f55` before the pale flash circle (`opacity 0→0.74→0`) appeared on `f62`, with 7 identical-curve shards and two dead stretches (`f102–f124`, `f127–f149`).
3. **Story mismatch:** Depicted only a falling star rather than wild critters caging your friends and dropping Golden Rescue Keys.

## Brief

```
SURFACE   story-abduction · shot story-open · seen once (cold open)
GOAL      Within 1.4 s, a first-time player witnesses wild critters caging their animal
          friends and scattering Golden Keys across the valley, understanding why they
          are fighting and what Golden Keys on the map do.
REFERENCE NShapes ink outlines + forged iron cages + beveled GoldenKeyArt; impact drop
          uses EASE.impact like the results star slam.
HERO      Three forged iron cages slamming down over the 3 valley friends (f15–f32).
POSES     f0       valley sky/hills + 3 joyful friends already on stage (zero void)
          f5–f21   Masked Bandit & Iron Shell swoop in from upper corners (EASE.enter, MS.move)
          f15–f32  3 iron cages drop in a 2-frame ripple (32 ms gap, EASE.impact, MS.quick),
                   each friend flipping to wide-eyed `mood="urgent"` right as their cage lands
          f33–f55  3 Golden Keys tumble outward onto the meadow grass (SPRING.snappy)
          f38–f55  title & body rise smoothly 10 px (MS.move, EASE.enterSoft)
          f60+     rest: grinning raiders, 3 caged friends, 3 gleaming keys, crisp readable text
SOUND     band.cue('foeDud') on f31 (center cage slam), band.cue('keyFound') on f40.5 (keys land).
BANNED    empty dark void on f0–f26; full-screen white flash; generic star-burst particles;
          layout-property animations.
REDUCED   all 3 caged friends, both raiders, all 3 keys, and full story copy settled cleanly
          on f0 (no travel, no cage drop, no spring bounce).
```

Three hero variants considered:
1. *Swoop & Slam (chosen):* Friends start joyful on stage (`f0`), raiders swoop down (`f5`), iron cages slam down in a tight ripple (`f15–f32`), keys scatter onto the grass (`f33–f55`). Clear cause→effect, zero blank frames.
2. *Three-panel slideshow:* Rejected — breaks single-stage continuity.
3. *Already-caged rattle:* Rejected — hides the actual abduction moment.

## Rounds

- **r1** (`motion-out/story-open/r1`): Implemented `Abduction`, `KeysRoad`, and updated `Hero` scenes with `GoldenKeyArt`, `CageBarsSvg`, and `CagePadlockSvg`. Caught three issues in `r1/contact.png` & `report.md`:
  1. All 3 friends flipped to `mood="urgent"` simultaneously on `f30` even though Cage 3 landed on `f34`.
  2. Story words started rising at `f32` while Cage 3 was still mid-drop (`f34`), competing for attention.
  3. The 3 Golden Keys bounced on `SPRING.lively` until `f82` (`1312 ms`), adding lingering micro-jitter past the beat.
- **r2** (`motion-out/story-open/r2`, compare `compare-before-vs-r2.png`): Tightened `CAGE_GAP_MS` from `40 ms` to `32 ms`, synchronized each friend's `mood="urgent"` flip to their own cage landing (`f28 / f30 / f32`), moved `ABDUCTION_WORDS_MS` cleanly after all 3 cages slam (`580 ms`), and switched `ScatteredKey` landing spring to `SPRING.snappy` (all keys settled by `f63` / `1008 ms`, zero dead stretches, `foeDud` at `f31`, `keyFound` at `f40.5`).
- **Reduced motion** (`motion-out/story-open/reduced/frames/f010.png`): Complete settled composition visible immediately with zero travel or spring bounce.

## Final numbers

- `RAIDER_START_MS = 80` (stagger `56 ms`, `MS.move`, `EASE.enter`).
- `CAGE_FIRST_MS = 240`, `CAGE_GAP_MS = 32`, `CAGE_DROP_MS = MS.quick` (`180 ms`, `EASE.impact`), impact squash `1.09 / 0.91` (`40 ms`) → `SPRING.snappy`.
- `KEY_SCATTER_FIRST_MS = 516` (`64 ms` stagger, `SPRING.snappy`).
- `ABDUCTION_WORDS_MS = 580` (`MS.move`, `EASE.enterSoft`, `10 px` vertical rise).
