# preview-sheet: the level preview comes up and goes away

Surface: A:map-node-tap, A:preview-sheet-enter, A:preview-sheet-exit, A:preview-foe-entrance (docs/motion/inventory/adventure-screens.md). Seen often: before every fight.

Shots (scripts/motion/shots/screens.mjs): `preview-open` (dock Play), `preview-open-node` (tap on the 1-5 node), `map-node-press` (a finger held 6 frames on the node), `preview-close` (✕), `preview-reopen` (backdrop, then Play again on f9, mid-exit), `preview-flick` (Play, then the backdrop on f6, mid-entrance).

Scores are Response/Readability/Motion/Staging/Rhythm/Identity/Sync.

| Round | Scores | |
|-------|--------|--|
| before | 6/6/3/4/5/4/4 | RN Modal `slide` + `PopIn` |
| r1 | 7/6/5/7/7/6/5 | own shell: backdrop fades in place, sheet rises 96 px, foe drops in late, exit exists |
| r2 | 7/7/6/7/7/7/6 | exit unmounts on the fade's end; touches pass through a closing sheet; sheet opaque in 4 frames |
| r3 | 8/8/8/8/8/7/8 | the exit stays opaque until its last 4 frames; the backdrop answers the ✕ at once; no second foe drop on a reopen |

## Baseline (before)

- **Two entrances stacked.** The RN-web Modal slides the whole layer 693 px up in 15 frames while `PopIn` scales the sheet 0.94→1 and fades it 0→1 over 9 frames. On f2–f6 the sheet is half transparent *and* moving, so the map's words show through it (contact sheet, f3–f5).
- **The backdrop slides with the sheet**: the grey dim comes up from the bottom edge (f1–f6) instead of dimming in place. A backdrop tap during the entrance hits the map instead (`preview-flick` before: the tap on f6 did nothing).
- **No exit.** `preview-close` before: the sheet is there on f-1 and gone on f0.
- **Everything starts on f0**: slide, scale, fade and the foe's `entrance` reaction (drop-in and ear flick), so the foe's landing is lost inside the slide.
- Reduced motion ignored (the Modal slide always plays).

## Brief

```
SURFACE   preview-sheet · shots preview-open / preview-close / preview-reopen / preview-flick · seen often
GOAL      A card comes up over the map with the foe on it, and it can be put back down the way it came.
REFERENCE The game's speech bubbles: quick out, soft landing; the foe lands like it does in a fight's opening.
HERO      The sheet. Then (second beat) the foe dropping into its portrait.
POSES     f0   map; the node (if tapped) pressed to 0.96
          f1   backdrop starting to dim in place; sheet 96 px below rest, fading in
          f4   sheet fully opaque, ~70% of the way
          f8   foe drops into its portrait (the sheet is ~90% there)
          f16  sheet at rest; f30 the foe has settled
CLOSE     f1   backdrop starts clearing (ease-out: the answer to the tap)
          f2–f13 sheet accelerates 96 px down, opaque
          f13–f15 sheet fades in its last 4 frames; f16 gone, map live
MOTION    backdrop  opacity 0→1 · MS.quick · EASE.ui · f0
          sheet     translateY 96→0 · MS.panel · EASE.enterSoft · f0
          sheet     opacity 0→1 · MS.feedback/2 · EASE.ui · f0
          foe       the creature's own `entrance` reaction · cued MS.feedback after the open
          close     translateY 0→96 · exitMs(MS.panel) · EASE.exitSoft; opacity held, then 1→0 over the last MS.feedback/2;
                    backdrop 1→0 · exitMs(MS.panel) · EASE.ui
          node      press: scale → SCALE.press in MS.feedback/2 (EASE.ui), back on SPRING.snappy
          interrupted: every value carries on from where it is; reopening mid-exit does not replay the foe
SOUND     unchanged (sfx('click') on the tap)
BANNED    full-height slide; a backdrop that slides; a scale inside the slide; a long fade that shows the map
          through the sheet; a sheet that vanishes; an exit that blocks the next tap
REDUCED   no travel: backdrop and sheet fade MS.feedback in, exitMs(MS.feedback) out (fades kept with ReduceMotion.Never)
CHECK     first change ≤ f1 · sheet still by f16 · close ≤ 16 frames with no pop · a mid-exit Play ends open ·
          a mid-entrance backdrop tap ends closed
```

One version, refined (not a hero moment: no variants).

## Round notes

**r1** (built from the brief: own absolute-fill layer instead of `Modal`, `PopIn` removed, backdrop as its own fading layer, foe cue delayed, node press, exit with unmount on a timer).
- Open reads as one card rising; backdrop dims in place; foe lands on f8 (report: `preview-enemy-avatar` puff mounts f8). Good.
- Close: first change only on **f4** (ease-in-expo sits still), and the sheet unmounts on **f15 at opacity 0.4**: a pop-out (report: `opacity 1→0.4 … [unmounts f15]`). Change: unmount on the fade's own completion.
- `preview-reopen` failed: Playwright reported the closing sheet's `Fight!` "intercepts pointer events". `pointerEvents="none"` on the root is undone by the inner `box-none` (RN-web gives box-none's children `auto`). Change: the inner overlay goes `none` too while closing.
- Open f1–f3: the sheet fades over 7 frames, the map's words show through it. Change: opaque in 4 frames.

**r2** (EASE.exitSoft added for the exit; unmount via `withTiming` callback; pointer fix; opacity MS.feedback/2).
- `preview-reopen` and `preview-flick` both end in the right place.
- Close f0–f6 almost still (ease-in-cubic from rest), then f9–f14 the sheet turns translucent over the map: the open's ghost, played backwards (strip f4–f19). Change: hold the sheet opaque and fade only its last 4 frames; let the backdrop clear on ease-out so the tap is answered on f1.
- `preview-reopen` replayed the foe's drop-in although the sheet had never left. Change: no foe cue when reopening mid-exit. Moved the reopen tap to f9 so the interruption is visible.

**r3**
- Close: f1 backdrop clearing, f2–f13 sheet goes down opaque, f14–f15 fades, f16 gone (report `[unmounts f16]`, strip f4–f19: two ghost frames). Open unchanged from r2. Reopen: sheet dips ~8 px and comes back, foe stays put. Flick: ends closed on f21.
- Reduced capture: open = 7-frame fade, close = 5-frame fade, no travel (first try had Reanimated cut both, fixed with `ReduceMotion.Never` on the opacity timings only).

## Final numbers

- Open: backdrop `MS.quick` (180) `EASE.ui`; sheet `translateY 96→0` `MS.panel` (360) `EASE.enterSoft`; sheet opacity `MS.feedback/2` (60) `EASE.ui`; foe `entrance` cued after `MS.feedback` (120).
- Close: `exitMs(MS.panel)` = 238 ms; sheet `translateY 0→96` `EASE.exitSoft` (new token, cubic-bezier 0.32,0,0.67,0); opacity held then `MS.feedback/2` on the tail; backdrop `EASE.ui`.
- Node: `SCALE.press` in `MS.feedback/2`, back on `SPRING.snappy`.
- Play / Camp from the sheet: `exit="cut"`: it leaves with its screen.

## Still under 8, and what was not verified

- **Identity 7.** It is now a clean sheet, but nothing in it is NShapes but the foe's drop-in. A paper/ink touch (a 2 px sink of the sheet on landing like the chunky buttons) was not tried.
- **The node press is not visible in any capture.** RN-web delays press-in by 50 ms inside the map's ScrollView, and under the capture's virtual clock that timer never fired while the mouse was held (`map-node-press`: no change on f0–f5). Checked instead in a plain Playwright page on the real clock: the node is at `scale(0.96)`, opacity 0.85 by 100 ms after mouse-down and springs back on release. On a quick tap the sheet covers the node by f1 anyway; the press reads only while a finger is held.
- The dock's `PLAY 1-5` button (the most used way in) still answers only with the TouchableOpacity dim: outside this lane's scope (map node only).
- The sheet is no longer an RN `Modal`: it is an absolute layer (zIndex 100) inside AdventureMode's screen layer. Follow-up in the screen-change commit: the backdrop reaches past AdventureMode's box by the safe-area insets so the dim covers the whole phone again (the sheet stays inside the safe area), the root says `role="dialog"` / `aria-modal` / `accessibilityViewIsModal`, and Android's back button closes it (`BackHandler`). Not checked on a device or with a screen reader (web insets are 0).
