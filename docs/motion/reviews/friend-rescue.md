# friend-rescue

Angry Birds 2–style Golden Rescue Key pick & cage-break unlock (`FriendRescueModal.tsx`, `RescueArt.tsx`, `AdventureMap.tsx`). Golden Keys sit directly on the winding road between consecutive same-biome nodes (`1-5↔1-6`, `1-9↔1-10`, `2-5↔2-6`, `2-9↔2-10`, `3-5↔3-6`). Walking onto or tapping a reached key opens the Friend Rescue picker showing all remaining caged friends (reusing shared `FighterPassivesList`), and tapping `FREE <NAME>!` plays a mechanical **key-turn → forged iron bars burst apart → golden shockwave ring → freed friend joyous leap** celebration.

Shots: `friend-rescue` (`/dev/adventure?save=before:1-6&keys=ready&rescue=key-1&intro=false`, 100 frames × 16 ms = 1600 ms) + `map-key-open` (`/dev/adventure?save=before:1-6&keys=ready&intro=false`, 45 frames).
Scores are Response / Readability / Motion / Staging / Rhythm / Identity / Sync.

## Scores

| Version | Scores | Capture |
|---|---|---|
| r1 (initial draft) | 8/8/8/7/7/9/9 | `motion-out/friend-rescue/r1`, `motion-out/map-key-open/r1` |
| r2 | 9/9/9/8/9/10/9 | `motion-out/friend-rescue/r2` (`--twice`), `motion-out/map-key-open/r2` |
| r3 | 9/9/9/9/9/10/9 | `motion-out/friend-rescue/r3` (`--twice`) |
| r4 (final) | 9/9/9/9/9/10/9 | `motion-out/friend-rescue/r4` |
| reduced | calm `MS.quick` cross-fade straight into settled `FRIEND FREED!` view on f0–f15 | `motion-out/friend-rescue/reduced` |

## Brief

```
SURFACE   friend-rescue · shots friend-rescue, map-key-open · seen 5× per campaign (once per friend)
GOAL      Reward walking over a Golden Key on the map with joyful agency (choose ANY caged
          friend to rescue first) and a tactile key-turn → split-cage shatter celebration.
REFERENCE Angry Birds 2 Extra Bird Key picker + NShapes dark-onyx ceremonial modal (`UnlockReveal`)
          and crisp ink-outlined custom SVG `GoldenKeyArt` / `CageBarsSvg` / `CagePadlockSvg`.
HERO      Golden Key gliding into the brass padlock (f0–f17), cranking 90° (f20–f30), then
          forged iron cage halves bursting outward on f31 as the friend leaps free.
POSES     f0       picker exits; spotlight shows chosen friend behind forged iron bars,
                   eyebrow reads `GOLDEN KEY`, lower slot shows `UNLOCKING CAGE…` + friend name
          f0–f17   Golden Key glides straight up 22 px into the brass keyhole (`MS.move`, `EASE.enter`)
          f18–f19  2-frame mechanical seat hold (`32 ms`)
          f20–f30  Golden Key cranks 0° → 90° (`MS.quick`, `EASE.ui`); `keyFound` cue lands f20.3
          f31      HERO FRAME: left/right iron cage halves burst ±84 px / ±20° (`MS.move`, `EASE.enter`),
                   padlock drops, single gold shockwave ring expands (`MS.panel`, `EASE.enterSoft`),
                   eyebrow flips to `FRIEND FREED`, `friendRescued` cue lands f31.5, friend leaps
          f39–f55  `RESCUED!`, cheer bubble, shared `FighterPassivesList`, and action buttons rise
                   cleanly (`STAGGER.item`, `MS.quick`, `EASE.enterSoft`)
          f60+     rest: freed friend beaming in gold-rimmed medallion, buttons ready
SOUND     `band.cue('keyFound')` on f20.3 (key crank start) and `band.cue('friendRescued')` on
          f31.5 (0.5 f after cage break).
BANNED    full-screen white flash; spoiling `FRIEND FREED` before break; 400 px empty black hole
          under the cage while unlocking; stacked jump clipping the top badge; key overlapping text;
          layout-property animations.
REDUCED   no key travel, no cage shatter, no leap; calm `STAYS` cross-fade (`MS.quick`) straight
          into the settled `FRIEND FREED!` celebration with `friendRescued` on f0.8.
```

Three hero variants considered:
1. *Key-Turn & Split-Cage Shatter (chosen):* Literalizes the Angry Birds 2 key-unlocks-cage fantasy with clear mechanical cause→effect (key enters → cranks → bars split → friend leaps free).
2. *Medallion Card Flip:* Rejected — duplicates `UnlockReveal` instead of giving map keys their own identity.
3. *Cross-Fade Swap:* Rejected — banned default for a major campaign unlock.

## Rounds

- **r1** (`motion-out/friend-rescue/r1`, `map-key-open/r1`): Zero machine hints and sub-frame audio lock (`keyFound` f20.3, `friendRescued` f31.5), but reading frames exposed three real staging defects:
  1. Top pill spoiled `FRIEND FREED` on `f0` before the key even reached the lock.
  2. Hidden details left ~400 px of empty black space below the cage during `f0–f44`.
  3. Wrapper jump (`-22 px`) stacked with `FighterAvatar`'s `ecstatic` hop on `f39–f44`, pushing Corgi's ears over the top yellow pill. On `map-key-open/r1`, `FREE FRIEND!` sat only ~3 px above `1-6`'s `NEW` badge.
- **r2** (`motion-out/friend-rescue/r2`, `map-key-open/r2`): Fixed all three defects (dynamic `GOLDEN KEY` → `FRIEND FREED` eyebrow, `UNLOCKING CAGE…` heading slot during `f0–f30`, restrained wrapper lift `-8 px` / `SCALE.pop` + `marginTop: 18`, and `KEY_EXTRA_ROW = 98` at Bezier `t = 0.50` giving symmetric breathing room on the map). Reading `compare-r1-vs-r2.png` caught one final micro-defect: `keyY = 74` brushed the `"UNLOCKING CAGE…"` eyebrow on `f0–f4`.
- **r3–r4** (`motion-out/friend-rescue/r3`, `r4`, compare `compare-r1-vs-r4.png`): Adjusted `stage` `marginBottom: 10`, `keyAnchor` `bottom: -4`, and `keyY = 22` so the Golden Key starts cleanly below the brass padlock with zero text overlap on `f0`, glides straight into the keyhole, cranks 90°, and shatters the cage on `f31`.
- **Reduced motion** (`motion-out/friend-rescue/reduced/frames/f015.png`): Calm fade straight to settled `FRIEND FREED!` view, zero bar flight or bounce.

## Final numbers

- `KEY_SLIDE_MS = MS.move` (`280 ms`, `EASE.enter`, `keyY: 22 → 0`), `KEY_HOLD_MS = 32`, `KEY_TURN_MS = MS.quick` (`180 ms`, `EASE.ui`, `0° → 90°`).
- `BREAK_AT = 492 ms` (`~f31`): split iron bars `±84 px`, `±20°` (`MS.move`, `EASE.enter`), single gold ring `scale 0.5 → 1.85` (`MS.panel`, `EASE.enterSoft`), wrapper hop `-8 px` / `SCALE.pop` → `SPRING.snappy`.
- Map road geometry: `KEY_EXTRA_ROW = 98`, Bezier parameter `t = 0.50`, `KEY_WALK_MS = 420` (`EASE.enterSoft`).
