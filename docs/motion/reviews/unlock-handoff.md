# unlock-handoff

The unlocks after the first one in a row (`unlock-advance`), and the way back to the results, where what was hidden becomes what was won (`unlock-return`).
Seen sometimes (every first-time win with rewards; a world-2 win with bounties brings 7 in a row).
Shots: `unlock-advance` (`/dev/results?case=fighter`: Sly Fox revealed, tap "Fight as Sly Fox", the 1-5F path comes up; 90 frames) and `unlock-return` (`/dev/results?case=first`: first ★★★ on 2-5, 7 unlocks with its bounties, the last is the 2-5C path, tap "Later"; 150 frames).
Scores are Response / Readability / Motion / Staging / Rhythm / Identity / Sync. Inventory: A:unlock-advance, A:results-unlocked-reveal-swap.
Both "before" captures were taken on the integration tree (screen-change landed), with this surface's files stashed; `unlock-return/r1` was taken before that tree arrived (the code under test is the same; the screen change does not touch a results screen that is already mounted).

## Scores

| Version | advance | return | Capture |
|---|---|---|---|
| before (5487bac) | 7/5/3/4/4/5/5 | 7/4/3/4/4/5/6 | `motion-out/unlock-advance/before`, `motion-out/unlock-return/before` |
| r1 | 8/8/8/8/8/8/7 | 7/6/6/6/6/8/6 | `motion-out/unlock-advance/r1`, `motion-out/unlock-return/r1` |
| r2 | 8/8/8/8/8/8/8 (`--twice`: same pictures) | 8/7/7/7/8/8/6 | `motion-out/unlock-advance/r2`, `motion-out/unlock-return/r2` |
| r3 | | 8/7/8/8/8/8/6 | `motion-out/unlock-return/r3` |
| r4 (final) | | 8/7/8/8/8/8/8 (`--twice`: only the idle fighter differs) | `motion-out/unlock-return/r4` |
| reduced | fade through the dark | words and medallion fade, dark lifts, rows fade to their faces | `motion-out/unlock-advance/reduced`, `motion-out/unlock-return/reduced` |

Compare sheets: `motion-out/unlock-advance/r2/compare-before-vs-r2.png`, `motion-out/unlock-return/r4/compare-before-vs-r4.png`.

## Baseline critique

- **Advance**: f0 is a hard cut from the revealed fox (name, bubble, card, buttons, headline) to the next silhouette with its new headline. Then the tease and the Reveal button wait until f23-f31 (the reveal's opening delay, 340 ms, replays for every unlock): the player who just tapped has nothing to tap for half a second. The second unlock costs as long as the first.
- **Return**: f0 the dark screen is simply gone (no exit). What was won sits under the stats: on a 390×844 phone the UNLOCKED block starts at y≈760 and only its first row peeks above the footer; the six other rows and the secret-path box are below the fold, so the silhouettes become the real things where nobody sees them. The visible row swaps on f0 with the cut. The coins then count f29-f90 with nothing before them (DEAD f1-f18).

Three worst: (1) return: no exit, the hand-off happens off screen; (2) advance: hard cut and a 22-frame wait for the button; (3) every unlock in a row costs the same.

## Brief

```
SURFACE   unlock-handoff · shots unlock-advance, unlock-return · seen sometimes
GOAL      Tapping on goes straight to the next thing without waiting; closing the last one gives the
          player back the results with what they won arriving in its row as the same object.
REFERENCE The reveal's own turn: the next card is turned over the way the last came round, and each
          unlocked row on the results is turned over like the medallion was.
HERO      advance: the medallion turning to the next silhouette. return: the unlocked row turning over.
POSES     advance (from the tap):
          f2   words start to leave (exitMs(MS.quick) = 119 ms, EASE.exitSoft, opacity only)
          f2   the reward turns edge-on (MS.feedback, EASE.impact) — no windup, the player is moving on
          f8   edge-on: the next unlock is swapped in, its headline fades in at once
          f9   the silhouette comes round on SPRING.lively
          f17  tease and Reveal button rise in (MS.feedback after the swap, not the opening's 340 ms)
          return (from the tap on the last reveal's button):
          f1   words and medallion fade together (119 ms, EASE.exitSoft); the medallion shrinks toward 0.6 and sinks 48 px
          f8   the dark lifts (the rest of exitMs(MS.panel) = 238 ms), the reveal stops taking taps on f0
          f16  onDone: the results are in charge
          f17  unlocked row k turns over (edge-on on EASE.impact over MS.feedback, face swapped on the edge,
               back on SPRING.lively), STAGGER.item apart (staggerDelay, capped at STAGGER.cap)
          f43  coins count (after the rows a phone shows, two at most, + a 120 ms breath); the fighter cheers on the bell
BANNED    a cut between unlocks; a swap of faces in sight; the reveal's opening delay on every unlock;
          the payout waiting on rows below the fold; a reveal that blocks the results' buttons while it leaves
REDUCED   advance: the medallion fades out (119 ms) and the next one in (MS.quick); return: words and medallion
          fade, then the dark lifts; each row fades through to its face; no turn, no sink
CHECK     advance ready (button in) by f22 (was f31); return: no frame with the medallion or words over the
          results; the visible row turns on screen; scores 8+
```

Variants considered for the return (it is the hand-off of a hero moment):
1. **Turn over in the row** (chosen): every row turns the way the medallion turned. Same object, same gesture, works for any number of rows, and costs ~240 ms per row with a 60 ms stagger.
2. **Fly into the row**: the medallion shrinks and flies to its row. The real hand-off, but on a phone its row is usually below the fold (it would fly off screen), and with 7 unlocks only the last one could fly.
3. **Scroll to the rows**: scroll the results so the UNLOCKED block is in view, then turn. Shows everything, but a programmatic scroll moves the screen under the player and hides the coin count they are about to watch; react-native-web's smooth scroll is also outside the capture's clock.

## Rounds

**advance r1**: words out f2-f7, edge-on f8, the next silhouette and its headline come round f9-f15, Reveal button f17-f21; ready f22. HARD-STOP hint on the fox at f7 is the turn stopping at the edge (the edge is the stop, as in the reveal). Note: reduced not built yet.

**advance r2** (EASE.exitSoft, reduced): same picture; reduced fades the face out and in (f0-f18).

**return r1**: words out from f5 (EASE.exit barely moves for half of a 119 ms exit), the medallion still opaque over "PERFECT!" f13-f15 as the dark lifts; the visible row turns f24-f31; coins wait for all 6 rows (+840 ms): DEAD f50-f62. Notes: (1) a short exit curve; (2) fade the medallion faster than the dark; (3) pay out after the rows in sight, not all.

**return r2** (new token `EASE.exitSoft` = ease-in-cubic; payout after two rows): words start f4; coins from f43, 12 frames after the visible row lands. The medallion still hangs over the results f9-f12 (its fade followed the sink, which eases in late).

**return r3** (medallion fades with the words): f1-f8 the whole reveal recedes as one, f8-f16 the dark lifts, row turns f19-f31. Reduced capture: the medallion does not fade at all (its fade was tied to the sink, which reduced motion does not move) and pops out on f12; the words ghost over the results f6-f7.

**return r4** (final): the dark only starts lifting once the words are gone (f8); a `closing` flag drives the medallion's fade in both modes; the delay before the lift keeps `ReduceMotion.Never` (Reanimated drops a `withDelay` under reduced motion otherwise). Normal: words gone f8, dark f8-f16, row edge-on f20, round f23, coins f43-f85 every 3 frames, fighter cheers after the bell. Reduced: f1-f8 fade, f8-f16 lift, the row fades to its face.

## Final numbers

- `EASE.exitSoft` / `CURVE.leave` = cubic-bezier(0.32, 0, 0.67, 0): new token, for exits under ~250 ms.
- Advance: words `LEAVE_MS` = `exitMs(MS.quick)` = 119 ms on EASE.exitSoft; turn to edge `MS.feedback` on EASE.impact; next face back on SPRING.lively after 16 ms; headline in at once, tease and Reveal button `MS.feedback` after the swap. Later reveals in a row: words at LAND + 60 ms, `STAGGER.card` apart (first: +100, `STAGGER.item`).
- Return: `REVEAL_EXIT_MS` = `exitMs(MS.panel)` = 238 ms (words + medallion 119 ms, then the dark 119 ms), medallion scale →0.6 and +48 px on EASE.exitSoft; the reveal takes no taps from the first frame of its exit.
- Rows: `TurnOver` (ResultsMotion.tsx): edge-on `MS.feedback` on EASE.impact, 16 ms on the edge, back on SPRING.lively; `rowTurnMs(k, n)` = `staggerDelay(k, n, STAGGER.item)`.
- Payout after a reveal: `revealPayoutMs(rows)` = turn of the second row in sight + 2 × 120 + 120 ms (450 ms with no rows); the fighter's cheer uses the same time when no coins count.
- Layout: the UNLOCKED rows and the secret-path box moved from under the stats to right under the coin box.

Files: `src/adventure/components/UnlockReveal.tsx`, `LevelResults.tsx`, `ResultsMotion.tsx`, `src/utils/motion.ts`, `scripts/motion/shots/results.mjs` (`unlock-return` taps through whatever the result unlocked).

## Still open

- **Readability 7 on the return**: on a 390×844 phone, after a big world-2 win (coin box with 5 lines), only the first unlocked row is above the footer; the other rows turn over below the fold, unseen. A smaller result (1-5: a fighter and a path) fits better but was not captured. Fixing it for real is a layout decision (a compact unlocked strip next to the coins, or the coin box's lines folded) rather than motion.
- The medallion's sink and shrink on the way out are hardly visible (it is faded by f8); the exit reads as a fade of the reveal. Kept on purpose: the exit is not the news, the row is.
- The DEAD-STRETCH hints on `unlock-return` (f49-f69, f72-f87) are false: the coin pill changes every 3 frames there (`sheet-f40-f87.png`); the analyzer's "still" threshold comes from the idle creatures in the pre-roll.
- `sfx('confirm')` on the buttons plays at the tap (feedback), not on the picture; the reveal's own sound is in unlock-reveal.
