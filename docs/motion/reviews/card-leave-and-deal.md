# card-leave-and-deal

The scored slots empty and new cards grow in. Seen: constant (every Set). Inventory: F:46, F:50.
Shots: `board-deal` (new: a Set on 1-2, board only, 72 frames), `board-set`, `fight-open` (the deal at the start of a fight, as the neighbour that shares the code).

Measured on top of set-tap-confirm (the Set is checked on f5).

## Baseline (before)

`motion-out/board-deal/before` (`--twice`: differs only in creatures, and in the board's blast shake, which uses `Math.random`), `motion-out/fight-open/before`.

Scores: **6/6/7/5/5/7/7**

- f5: the stage's copies cover the three cards; f12 the real cards are hidden (`CardLeaving`, 110 ms); **f13–f40 the three slots stand empty** (27 frames, 432 ms): the next cards are only handed to the board by `AdventureRun`'s `REPLACE` at 560 ms after the match.
- f40/f44/f47: new cards grow in by **column only** (0 / 45 / 90 ms): 0-1 and 1-1 land on the same frame, 0-2 and 1-2 on the same frame. Each fades 0→1 in **3 frames** (opacity driven by the back curve ×1.6): close to a pop.
- f29–f55: on this save two more cards are blasted (the fighter's gear); their bursts are drawn on those slots by the stage and sit on top of the new cards dealt there at f44–f47.

Three worst:
1. f13–f40 the empty slots (432 ms of nothing on every Set). Cause: `REPLACE_DELAY_MS` 560 in `src/adventure/components/AdventureRun.tsx`. Not in this lane's files.
2. f40–f47 deal by column only: equal gaps, two pairs on one frame. → one sweep from the top left by diagonal, `STAGGER.card`.
3. Opacity 0→1 in 3 frames on a back curve. → opacity on its own ease (`MS.feedback`, `EASE.ui`), scale alone overshoots.

## Brief

```
SURFACE   card-leave-and-deal · shots board-deal, board-set, fight-open · seen constant

GOAL      New cards arrive as one gesture, so the eye is handed back to the board.

HERO      The dealt cards (support to the Set's throw, which is the beat before).

POSES     f5   copies cover the scored cards
          f12  slots empty (unchanged: the copies have left)
          f40  first new card (top-left-most) starts; each next diagonal +40 ms
          f40+12  each card at full size, overshoot over by then

MOTION    scale: ×0.72 → ×1 · CARD_MOTION.dealMs 190 · EASE.pop · after its diagonal's delay
          opacity: 0 → 1 · MS.feedback · EASE.ui (never bounces)
          sweep: rank of (row + col) among the new cards × STAGGER.card,
                 squeezed to CARD_MOTION.dealSweepMs 120 in all (a full board: 6 diagonals × 24 ms)

BANNED    a spring tail on the deal (r1 tried SPRING.lively: every deal settled in 24 frames
          instead of 12, the start-of-fight deal went from 288 to 592 ms); bounce on opacity.

REDUCED   no growth, no sweep: a 60 ms fade (half of MS.feedback), all new cards together.

CHECK     sweep starts in diagonal order; each card settled ≤ 12 frames after its start;
          fight-open last card settled ≤ 304 ms (was 288); no POP-IN on the new cards.
```

## Round 1 (r1)

`motion-out/board-deal/r1` (`sheet-f38-f53.png`), `motion-out/fight-open/r1`.

Change: diagonal sweep (`dealDelayMs` from GameBoard, replacing `column`); scale on `SPRING.lively` from ×0.72; opacity `MS.feedback` `EASE.ui`.

Scores: **6/6/8/5/6/7/7**

- Reads as one sweep: 0-0 f40, 0-1 f44, 0-2 and 1-1 f46 (same diagonal), 1-2 f49. Fades take 7 frames: no pop.
- But the spring's tail doubled every deal: 12 → 24 frames to rest, and at the start of a fight the last card settled at 592 ms (was 288). Slower on every Set: rejected.

## Round 2 (r2)

`motion-out/board-deal/r2`, `motion-out/fight-open/r2`; compare `motion-out/board-deal/r2/compare-before-vs-r2.png` (f39–f54).

Change: scale back on a fixed curve, `EASE.pop` over `dealMs` 190 (≈9% overshoot, done when the time is); the sweep squeezed to `dealSweepMs` 120 for a full board.

Scores: **6/6/8/5/7/7/7**

- board-deal: each card 11–12 frames to rest (was 12), overshoot +9%; last card settled f61 (was f59: the sweep's 3 diagonals). fight-open: last card at rest 304 ms (was 288 ms), now as a sweep from the top left rather than three columns.
- Still 432 ms of empty slots (f13–f40) and the blast bursts on top of two new cards: both decided outside this lane (below).

## Reduced (`motion-out/board-deal/reduced`)

Slots empty on f5, new cards fade in together over 5 frames on f40 (`ReduceMotion.Never` on that one fade: Reanimated otherwise skips every timing under reduced motion, which made them pop in 1 frame). No growth.

## Final numbers

| What | Value |
|---|---|
| Deal scale | ×`CARD_MOTION.dealFromScale` 0.72 → ×1 in `dealMs` 190, `EASE.pop` |
| Deal opacity | 0 → 1 in `dealFadeMs` = `MS.feedback` 120, `EASE.ui` |
| Deal order | diagonal (row+col) rank × `STAGGER.card` 40, whole sweep ≤ `dealSweepMs` 120 |
| Reduced | opacity only, 60 ms, `ReduceMotion.Never` |

Files: `src/components/CardMotion.tsx`, `src/components/GameBoard.tsx`, `scripts/motion/shots/board.mjs` (`board-deal`).

## Still under 8, and why

- **Response 6 / Rhythm 7: the empty slot (f13–f40, 432 ms).** The board only gets the next cards when `AdventureRun` dispatches `REPLACE`, `REPLACE_DELAY_MS` 560 after the match (`src/adventure/components/AdventureRun.tsx:62`, not in this lane). Suggestion: about 280 ms, so the sweep starts as the copies leave the slots (f13–f19) and finishes before the hit lands on the foe (f29).
- **Staging 5 / Readability 6: the blast bursts sit on the new cards** (f40–f55 on 1-1 and 1-2). Drawn by `src/adventure/fx/` (the set-throw lane): the blast beat (f29) comes after the deal starts.
- Identity/Sync 7: the deal has no cue of its own (fine: the Set's sound covers it); nothing to change here.
- Seen, not mine: GameBoard's blast board shake (`useScreenShake.triggerShake`, F:54) fires at the Set check (f6), 23 frames before the stage's blast beat (f29), and is random (`Math.random`), which is why `--twice` differs on `game-board›div`.
