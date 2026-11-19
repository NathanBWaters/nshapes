# screen-change: one transition for every change of screen in Adventure

Surface: A:screen-swap (and "Screen flow map", docs/motion/inventory/adventure-screens.md), S:phase-cut, S:route-stack-transition, S:screen-transition-enter (shared-components.md). Seen often: every trip between map, preview, fight, results and Camp.

Shots (scripts/motion/shots/screens.mjs): `screen-map-camp` (deeper), `screen-camp-map` (back), `screen-double` (Camp, then Camp's back arrow on f13 while Camp is still arriving), `screen-map-fight` (the preview's Fight!, and the FIGHT! banner after it), `screen-menu-map` (main menu → Adventure; a fresh browser is a new player, so it lands on the story). Fight → results was read on the existing `fight-win` shot (label `screen-r3`).

Scores are Response/Readability/Motion/Staging/Rhythm/Identity/Sync.

| Round | Scores | |
|-------|--------|--|
| before | 8/5/2/5/4/4/6 | hard cuts everywhere |
| r1 | 6/6/7/6/7/6/8 | shared exit-then-enter, 24/16 px, ease-in fade; the sheet still outside the screen layer |
| r2 | 6/7/7/8/7/6/8 | the preview sheet moved inside the screen layer and removed at the swap |
| r3 | 8/8/7/8/8/7/8 | travel 40/26 px; the old screen's fade is even, so it answers on f1 |

## Baseline (before)

- `screen-map-camp`: the map is there on f-1 and Camp on f0 (report: first and last change f0). `screen-camp-map`: the same cut, then the map jumps its scroll ~800 px in 4 frames on f12–f17 (AdventureMap's autoscroll to the frontier).
- `screen-map-fight`: sheet + map on f-1, fight on f0; the cards deal f0–f15, the FIGHT! banner lands f16–f27. A cut answers at once (Response 8) but says nothing about where you went, and every screen pops in and out.
- `screen-double`: two cuts.
- `ScreenTransition.tsx` (rise 20 px + fade 250 ms, no exit) was used by four legacy screens only.

## Brief

```
SURFACE   screen-change · shots screen-map-camp / screen-camp-map / screen-double / screen-map-fight · seen often
GOAL      You can tell which way you went (deeper or back), and the new screen is yours the moment it shows.
REFERENCE A page turned in a notebook: the old page slides a little away, the new one slides in from the side you are going to.
HERO      The new screen arriving. The old screen's exit is support: shorter, travels two thirds as far.
POSES     f0   tap; old screen starts to fade (even fade: visible from f1) and drift away
          f9   old screen gone (exitMs(MS.screen) = 145 ms) and unmounted; paper (paperBeige) for ≤ 1–2 frames
          f10  new screen mounted, 40 px off on the side it comes from, fading in
          f17  new screen opaque and ~95% home (ease-out-expo); taps work from its first frame
          f23  at rest
DIRECTION deeper (to a screen as deep or deeper: map → fight / Camp / guide, fight → results, results → retry / Camp,
          story → fight, menu → map): in from the right, out to the left. back (Camp / guide / results / a quit → map,
          map → menu): the mirror. Depth: story 1, map 1, camp 2, guide 2, run 2, results 2.
MOTION    old  translateX 0 → ∓26 · exitMs(MS.screen) · EASE.exitSoft ; opacity 1 → 0 · same time · even
          new  translateX ±40 → 0 · MS.screen (220, new token) · EASE.enter ; opacity 0 → 1 · MS.feedback · EASE.ui
          the preview sheet, when Fight! or Camp is tapped from it: part of the leaving screen (inside its layer),
          taken away at the swap
ORDER     the old screen unmounts before the new one mounts (exit, then swap, then enter): nothing of the old screen keeps
          running behind the new one (the fight's band leaves before the results arrive), and every screen's own
          opening (card deal, FIGHT! banner, results) plays in sight, after the change.
INTERRUPT the leaving screen takes no taps; a change asked for while one is leaving goes to the latest screen; a change
          during an entrance starts its exit from wherever the entrance is.
BANNED    a crossfade of two screens; a different transition per pair; vertical travel (the sheet owns "up");
          a blank stretch between screens; blocking the new screen's taps; the sheet vanishing before its screen
REDUCED   no travel: fade out exitMs(MS.feedback), fade in MS.feedback (kept with ReduceMotion.Never)
CHECK     first change ≤ f1 · whole change ≤ 23 frames (< 400 ms) · FIGHT! banner after the change has settled ·
          screen-double ends on the map, whole · no frame of bare map between the sheet and the fight
```

Variants considered (it is seen hundreds of times, so only briefly): (1) *page turn*, the one built; (2) *paper wipe*: an ink-edged paper panel sweeps across and uncovers the new screen: more NShapes, but it hides both screens for ~150 ms on every change; (3) *overlap slide*: both screens mounted, the new one slides over the old: no blank frame, but the old screen would keep running (the fight's `band.leaveFight()` would fire after the next fight's `enterFight()` on a retry). (1) wins on safety and length; (2) is the next idea if Identity matters more.

## Round notes

**r1** (built from the brief, but with 24/16 px, the fade on EASE.exitSoft, the preview sheet still a separate layer that fades on its own when Fight! is tapped).
- `screen-camp-map` strip f0–f15: f0–f4 look identical (ease-in from rest: the tap gets no visible answer until ~f5), f9–f10 blank paper, the map at f11. The 24 px shift is not visible at all on the 390 px strip: deeper and back look the same.
- `screen-map-fight` f5–f9: the sheet and the map fade separately, so the map shows through the half-faded sheet (two pictures at once). Change: put the sheet inside the screen layer so one opacity fades them as one picture, and take it away at the swap.
- `screen-double` ends on the map, whole (Camp entering → its exit starts from where it was). Reduced: fades only.

**r2** (sheet inside the screen layer; `startRun(level, also)` / `setScreen(next, also)` so the sheet is removed when the screen swaps).
- `screen-map-fight` f0–f15 (strip): sheet and map leave as one dimming picture; f10 is paper; the fight comes in at f11. No frame of bare map between the sheet and the fight (the director's check, read at full size f0–f3: the sheet is untouched, nothing under it shows).
- Still: no visible change before ~f5; direction unreadable. Change: travel 40/26 px (10% of the width) and an even fade on the exit's opacity.

**r3**
- `screen-camp-map` strip: the Camp page lightens from f1 (Response by f1), is gone f9, paper f10, the map arrives from the left f11–f15 (the "SUNNY MEADOW" banner visibly travels right into place). Report: old layer `hops 40px and back · opacity 1→0→1 in 17f` = f0–f18.
- `screen-map-fight`: same, fight from the right, the FIGHT! banner mounts f26 and lands f34, 9 frames after the change is at rest: they do not overlap.
- `fight-win` (`screen-r3`, f72–f103): K.O.! leaves f75, the fight holds still f76–f80 (its own timing), fades f81–f89, paper f90–f91, results arrive f92–f98 from the right.
- `screen-double`: map out left, Camp in from the right, (back on f13) Camp out to the right, map in from the left: ends on the map.
- Reduced (`screen-map-camp`, `screen-map-fight`): map fades out in 5 frames, the next screen fades in over 7, no travel.

## Final numbers

- `MS.screen` = 220 ms (new token): the new screen's travel, `EASE.enter`; its fade `MS.feedback` (120) `EASE.ui`.
- Exit `exitMs(MS.screen)` = 145 ms: travel `EASE.exitSoft` (token added with the preview sheet), opacity even (`EASE.linear`: a fade, not a move).
- Travel 40 px in, 26 px out. Background between screens: `COLORS.paperBeige`.
- Safety: if the exit's fade never reports its end (the app went to the background), the swap still happens `MS.feedback` later.
- Jest swaps at once (`SCREEN_INSTANT`); `__tests__/screenTransition.test.tsx` plays the real path with fake timers.

## Still under 8, and what was not verified

- **Motion 7**: after every change *back to the map* (`screen-camp-map` f23–f28, `screen-double` f33–f40) the map jumps its scroll ~800 px in 4–5 frames to the frontier. That is AdventureMap's own autoscroll (map-enter surface, not this lane's file); before, it jumped right after the cut, now right after the transition, where it is more visible. Fix belongs to map-enter: start the map already scrolled to where it will be.
- **Identity 7**: a short slide-and-fade is clean but generic; the paper wipe (variant 2) is the NShapes-flavoured option if wanted.
- **A blank paper frame or two** between screens (f10 on light screens; f90–f91 on fight → results, where mounting the results costs a frame). Less than 35 ms; it reads as a page turn, not a dead stretch.
- **Main menu**: Adventure enters on mount (menu → map / story is a cut-out of the menu, then this entrance), and the map's back button plays the back exit before handing over to `onExit`, so the menu cuts in. The menu side lives in `Game.tsx` / `MainMenu.tsx`, outside this lane.
- **Not verified on a device**: the preview backdrop now reaches past AdventureMode's box by the safe-area insets (top/bottom/left/right negative insets) so it covers the notch and home-indicator strips as the Modal did; on web the insets are 0, so no capture can show it. Read from the code: no ancestor clips (AdventureMode root, Game's root `View`, app/index.tsx's `SafeAreaView` and inner `View` have no `overflow: hidden`). Android's back button closing the sheet (`BackHandler`) and the sheet's `role="dialog"` / `aria-modal` / `accessibilityViewIsModal` were not tried with a screen reader.
- The results screen's own entrance (another lane) now plays after this transition's arrival; whatever it becomes, it should start after f92 in `fight-win`, i.e. on mount, as it does.
