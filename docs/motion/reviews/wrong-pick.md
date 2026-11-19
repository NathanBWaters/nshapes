# wrong-pick

Three cards that are not a Set. Seen: often. Inventory: F:52, F:53, S:screen-shake-preset.
Shots: `board-miss`, `fight-miss`. Measured on top of set-tap-confirm and card-leave-and-deal (the pick is checked on f5).

## Baseline (before)

`motion-out/board-miss/before` (`--twice`: differs in the idle creatures and the coach's hops only), `motion-out/fight-miss/before`.

Scores: **7/5/4/5/6/4/5** (Response/Readability/Motion/Staging/Rhythm/Identity/Sync)

- f5–f23: **the whole board** washes red (0.2 in 50 ms, out over 250 ms) and **the whole board shakes** ±5 px x / ±2.5 px y: 7 legs of 21 ms, **linear** (11 reversals in 13 frames: a buzz, not a shake). Every card on screen says "wrong", so none of them does.
- The three wrong cards: nothing of their own. They keep the yellow selection border until f36 (`setTimeout` 500 ms), drop, and on f38 they **pop out** (still at full size and opacity, then gone: the board replaces them 520 ms after the pick).
- Under OS reduced motion Reanimated skips the shake (its default `ReduceMotion.System`), but Adventure's Effects switch never reaches the board, so with Effects off it still shakes.
- In the fight the explanation ("Not a Set: Color and Shape were 2 alike + 1 odd", the ✗ pills) appears on f38, when the cards are already gone (not this lane's file).

Three worst:
1. The mistake is shown on the board, not on the three cards (Readability). → wash and shake the three cards, nothing else.
2. Linear 21 ms legs (Motion, banned: screen shake on a small event, linear position). → 4 legs, ±12/9/5/0 px, 48/64/64/80 ms, eased, 256 ms in all; the board stays still.
3. f38 pop-out. → the three cards step out before they are replaced: ease-in, two thirds of `MS.move`, ×0.88 and opacity 0, ending at 485 ms (replace at 520).

## Brief

```
SURFACE   wrong-pick · shots board-miss, fight-miss · seen often

GOAL      The player sees which three cards were wrong, without reading, and sees
          them go.

HERO      The three wrong cards. The rest of the board holds still.

POSES     f0   third card picked (pop)
          f5   checked: the three cards start a sideways shake and a red wash
          f12  wash at 0.3, shake on its second swing
          f21  shake over; three red cards held still (the read)
          f24  they step out (ease-in): shrink to ×0.88, fade to 0 by f35
          f38  new cards dealt (card-leave-and-deal's sweep)

MOTION    shake: translateX −12 → +9 → −5 → 0 · 48/64/64/80 ms · EASE.ui, EASE.drift, EASE.drift, EASE.ui · f5
          wash: 0 → CARD_MOTION.missWashOpacity 0.3 · MS.feedback · EASE.ui · f5 (colour wash, never a border)
          leave: at missLeaveAtMs 300 · exitMs(MS.move) 185 · EASE.exit · scale → missLeaveScale 0.88, opacity → 0
          return: at missReturnAtMs 700, only if the parent kept the cards (tutorial boards)

SOUND     matchInvalid with the check (f5), the frame the shake starts. Unchanged.

BANNED    board-wide red flash; board shake for a wrong pick; linear shake legs;
          bounce; a border to mark the cards.

REDUCED   (and Effects off) no shake and no shrink: the wash and the fade-out stay,
          on the same frames.

CHECK     only the three wrong cards move; shake ±12 px, ≤ 4 swings, ≤ 260 ms, no
          LINEAR hint; no POP-OUT at f38; reduced keeps the wash f5–f37.
```

## Round 1 (r1)

`motion-out/board-miss/r1` (`sheet-f3-f42.png`), `motion-out/fight-miss/r1`; compare `motion-out/fight-miss/r1/compare-before-vs-r1.png` (f0–f40).

Change: the brief, in `CardMotion` (`missed`), marked by GameBoard for `CARD_MOTION.missHoldMs` 900; board red flash and board shake removed; `useScreenShake`'s presets (only used by this) removed.

Scores: **8/8/8/7/8/8/7**

- f5–f20 the three top cards shake ±12 px, 5 reversals in 15 frames, eased (no LINEAR hint); f6–f33 they are washed red, the rest of the board does not move. f24–f35 they step out; no POP-OUT at f38.
- Staging 7: on f5 the coach lights and hops three *other* cards (the real Set) at the same moment (`glowingCardIds` from AdventureRun): two groups of three move at once. Not this lane's.
- Sync 7: the Effects switch is not reaching the board (below).
- Reduced capture of r1 showed a bug: Reanimated skips `withDelay` under reduced motion too, so the wash went 0→0.3→0 in 16 frames and the cards never stepped out before the swap.

## Round 2 (r2)

`motion-out/board-miss/r2`, compare `motion-out/board-miss/r2/compare-before-vs-r2.png` (f0–f40), `motion-out/board-miss/reduced`.

Change: `ReduceMotion.Never` on the delays of the wash and the step-out (colour and opacity are meant to play with reduced motion).

Scores: **8/8/8/7/8/8/7**

- Full motion unchanged from r1 (same frames, ±1 frame of measurement). One HARD-STOP hint on f37 (0-2's scale still moving on its last frame): the card is at opacity 0 by then, so it cannot be seen.
- Reduced: wash f5–f37 (0→0.3→0 over 32 frames), cards fade out f28–f37, new cards fade in f38–f42. No movement.

## Final numbers

| What | Value |
|---|---|
| Shake | x −12 / +9 / −5 / 0 px in 48 / 64 / 64 / 80 ms (256 ms), `EASE.ui` first and last, `EASE.drift` between |
| Wash | `#EF4444` at 0.3, in `MS.feedback` `EASE.ui`, out at 700 ms |
| Step out | at 300 ms, `exitMs(MS.move)` 185 ms, `EASE.exit`, ×0.88, opacity 0 |
| Return (if not replaced) | at 700 ms, `MS.feedback` |
| Board flash, board shake on a miss, shake presets | removed |

Files: `src/components/CardMotion.tsx`, `src/components/GameBoard.tsx` (`missed` marking, new `effects` prop), `src/hooks/useScreenShake.ts`.

## Still under 8, and why

- **Sync/safety 7: the Effects switch.** GameBoard now takes `effects` (default true) and turns off the shake and the shrink when it is false, but `AdventureRun` does not pass it yet. One line in `src/adventure/components/AdventureRun.tsx` (not this lane): `effects={effects}` on `<GameBoard>`. Until then Effects off still shakes the three cards (no longer the board).
- **Staging 7:** the coach's hops on the real Set start on the same frame as the miss (AdventureRun's guidance). Suggest starting them after the three wrong cards have stepped out (≈ f36).
- Seen, not mine: the mistake note and ✗ pills appear on f38, after the wrong cards have gone; they would read better from f5–f12, while the red cards are on screen.
- Free Play / tutorial: the tutorial board does not replace a wrong pick; its cards come back at 700 ms (not captured: no shot for the tutorial board).
