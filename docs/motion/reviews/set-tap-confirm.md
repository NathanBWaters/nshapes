# set-tap-confirm

Cards lift when tapped; what happens on the third tap of a Set before the cards leave.
Seen: constant (every tap). Inventory: F:47, F:48, F:51, F:56, F:57. Shots: `fight-pick`, `board-set`.

## Baseline (before)

`motion-out/fight-pick/before`, `motion-out/board-set/before` (both `--twice`; the second run differs only in the idle creatures and the 1-5 fire weapon's particles, measured positions of the board matched).

Scores: **6/6/6/5/5/5/7** (Response/Readability/Motion/Staging/Rhythm/Identity/Sync)

- **One tap (fight-pick):** the card pops on f1 (×1→×1.1 in 70 ms, out-quad) and springs to ×1.045. Good: the tap is answered on the card by f1. The press dim (TouchableOpacity 0.9, 250 ms release) does not show on the strip at all: it only blurs the first frames of the pop.
- **Third tap (board-set):** the third card pops f0–f4, then **nothing changes f5–f12** (the 200 ms `setTimeout` before the Set is checked). On **f12–f13** four things happen on one frame: the selection borders go, the coach's yellow fills go, a **white wash over the whole board** (0.15 in 50 ms, then 150 ms) and the stage's flying copies pop in with their own white tint. The board flash and the copies' tint say the same thing twice, and the board flash is on the banned list (a white full-screen flash).

Three worst:
1. f5–f12: 130 ms dead after the third pop; the answer to the Set waits on a timer the player did not cause. → check the Set when the third card's pop peaks (80 ms, 5 frames).
2. f13–f16: white board flash on top of the copies' tint. → remove the board flash; the Set's own cards are the answer.
3. Press dim: a fade with a 250 ms tail that the lift already covers. → remove it (`activeOpacity` 1).

## Brief

```
SURFACE   set-tap-confirm · shots fight-pick, board-set · seen constant

GOAL      Each tap is answered on the card that was tapped; on the third, the
          player sees the three cards up together, then the Set goes at once.

REFERENCE A card game's pick-up: quick lift, a beat in the hand, then thrown.

HERO      The tapped card (one tap); the three picked cards (third tap).

POSES     f0   third card tapped, selection border on
          f5   the third card at the top of its pop (×1.1), all three lifted
          f5/6 Set checked: the stage's copies take over, they throw
          (no board flash, no dead frames between f5 and the throw)

MOTION    pick pop: ×1 → CARD_MOTION.pickedPopScale 1.1 · pickedPopMs 80 · EASE.ui · f0
          settle: → pickedScale 1.045 · SPRING.lively
          deselect: → ×1 · MS.feedback · EASE.ui
          confirm: CARD_MOTION.confirmMs 80 (was 200)

SOUND     playSelect on the tap (unchanged); matchValid moves with the check, 120 ms earlier.

BANNED    white full-screen flash; press dim; a timer between the tap and its answer.

REDUCED   no pop, no lift (CardMotion off); selection border and the Set check still
          on the same 80 ms; nothing flashes.

CHECK     first change f0–f1 on the tapped card; the copies mount by f6 (was f13);
          no white wash in f6–f16; scores 8+.
```

## Round 1 (r1)

`motion-out/board-set/r1`, `motion-out/fight-pick/r1`; compare: `motion-out/board-set/r1/compare-before-vs-r1.png`, `motion-out/fight-pick/r1/compare-before-vs-r1.png`.

Change: Set checked after `CARD_MOTION.confirmMs` 80 (was 200); board white flash removed; press dim removed (`activeOpacity` 1); pick pop and deselect on tokens (`EASE.ui`, `SPRING.lively`, `MS.feedback`).

Scores: **9/7/7/8/8/8/8**

- Reads as: tap, the third card pops up beside the other two (f0–f4, border on f0), and on **f5** the stage's copies take over and throw. The copies now mount on f5 (was f13): 128 ms earlier on every Set. No white wash anywhere on f5–f16. `matchValid` plays with the check, on the copies' first frame.
- Readability 7: on `fight-pick` the tapped card is one the coach is pointing at (warm yellow fill), and the yellow selection border on a yellow card barely reads (f0–f30, before and r1 alike).
- Motion 7: f4→f5, the lifted card (×1.1, yellow border) is replaced by the stage's copy at ×1 with no border: a one-frame step down before the copy's own pop. The copy is drawn in `src/adventure/fx/visuals.tsx` (`Ghost`, `selected: false`, scale 1), which is another lane's file.

## Round 2 (r2)

`motion-out/fight-pick/r2` (sheet `sheet-f0-f7.png`).

Change: a pointed-out card that is picked drops its warm fill (`Card.tsx`: `isHint && !selected`); it has been found, and the selection border now reads on white.

Scores: **9/8/7/8/8/8/8**

- f0: the tapped coach-lit card turns white with the yellow border on the tap's own frame, clearly apart from the two still-lit cards beside it. Answer on the tapped card at f0, pop peak f5.
- Motion stays 7 for the handoff step (r1 note): not fixable from the board. Ask for the set-throw lane: start the thrown copy at the picked card's pose (×`CARD_MOTION.pickedScale`, or the pop's ×1.1) so the hand-off is seamless.

## Reduced (`motion-out/board-set/reduced`)

No pop, no lift. The selection border arrives on f0, the Set is checked on f5 and the cards leave on f5–f6; nothing flashes. Meaning kept.

## Final numbers

| What | Value |
|---|---|
| Pick pop | ×1 → `CARD_MOTION.pickedPopScale` 1.1 in `pickedPopMs` 80, `EASE.ui` |
| Picked rest | ×`pickedScale` 1.045 on `SPRING.lively` (ratio 0.6) |
| Deselect | ×1 in `MS.feedback` 120, `EASE.ui` |
| Set check after third tap | `CARD_MOTION.confirmMs` 80 (was 200) |
| Board success flash | removed |
| Press dim | removed (`activeOpacity` 1) |
| Picked coach-lit card | warm fill off while picked |

Files: `src/components/CardMotion.tsx`, `src/components/GameBoard.tsx`, `src/components/Card.tsx`, `__tests__/matchRewards.test.tsx`.

Still under 8: Motion 7 (the copy's start pose, other lane). Native: the press dim on iOS/Android was also an opacity fade; removed there too (not captured: web only).
