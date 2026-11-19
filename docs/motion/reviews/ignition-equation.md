# Motion review: `ignition-equation`

## Brief

```
SURFACE   ignition-equation · shot fight-ignition · seen constant

GOAL      On every Set — and between Sets for anyone joining mid-stream — show
          the live Base × Mult (+ Bonus) = Total equation, every contributing
          card/weapon/passive/multiplier by name, and per-weapon trigger value
          badges on GearBelt, without ever covering the card board.

REFERENCE Balatro's docked Chips × Mult scoreboard + Joker value popups,
          expressed in NShapes' warm tactile Core Stack palette.

HERO      The docked 3-zone [ BASE ] × [ MULT ] (+ BONUS) = [ TOTAL ] bar.
          Support: GearBelt per-weapon trigger badges (`+10`, `×2`, `🔥2`).

POSES     f0   Docked HUD bar shows live primed NEXT equation (`BASE 6 × MULT 1× = 6`)
               and standing sources (`Next Set: 3 cards · +3 Heavy Hitter`). Zero cards covered.
          f5   Third card tapped; bar enters LIVE tally with Cards base in BASE pill
               (scale 1 → SCALE.pop → 1, MS.feedback, EASE.pop) and GearBelt badges pop.
          f6-18 Contributors step on cascadeDelay(i, STAGGER.item), bumping BASE (cerulean-teal),
               MULT (crimson-orange), or reserved BONUS (amber) with zero horizontal reflow.
          f19-24 TOTAL slams in (0.86 → SCALE.reward → 1, SPRING.lively) synced with Set hit;
               Row 2 settles into the persistent itemized receipt (`Cards 3 (+6) · ...`).
          f25+ Zero pop-out; settled receipt stays readable until the next Set.

MOTION    BASE / MULT / BONUS bump: 1 → SCALE.pop (1.08) → 1 · MS.feedback · EASE.pop / EASE.ui
          Row 2 active ticker: translateY 5→0, opacity 0.6→1 · MS.feedback × 0.75 · EASE.enter
          TOTAL slam: 0.86 → SCALE.reward (1.18) → 1 · MS.feedback × 0.7 + SPRING.lively
          GearBelt value badge: translateY 5→0, scale 0.72→SCALE.pop→1 · MS.quick · EASE.pop;
            exit opacity 1→0 · exitMs(MS.quick) · EASE.exitSoft after 1350 ms hold
          Heat 2+ flames: GPU transform/opacity loop · MS.quick · EASE.drift · gated on useAppActive()

SOUND     multStep (slot: 0, amount: stepIdx) lands on each visual step with zero double-offset;
          multSlam (slot: 0, amount: heatTier) lands on the TOTAL slam frame.

BANNED    Covering card slots; layout reflow during step reveal; double-offset audio (slot: idx
          inside setTimeout); unexplained fractional BASE blobs; linear easing on movement;
          unlabelled black weapon name tags piling over the challenge strip.

REDUCED   Full docked Balatro equation, itemized receipt, primed Next-Set readout, and GearBelt
          badges stay 100% readable with instant final values and zero bounce/slide/flames.

CHECK     Zero cards covered f0..f160; first equation response by f5; zero horizontal reflow across
          the entire tally; full itemized receipt readable without truncation at phone width;
          zero motion hints on multiplier-ignition or belt-badge; clean --reduced capture.
```

### Three Hero Variants Considered
1. **Upgraded floating overlay over the board:** Rejected — still obscures the top card row the player needs to scan and disappears between Sets.
2. **Docked 3-zone Balatro Score Equation Bar + GearBelt value badges (Chosen):** Permanently legible before, during, and after every Set; never blocks a card; reconciles Set + follow-up damage (`12 × 2 + 10 = 34`); works identically across Adventure Mode and Starfall Spire.
3. **Side-docked vertical Balatro rail:** Rejected — portrait 320–390 px mobile layouts need full width for the 3-column Set card grid.

## Rounds & Scores (Response / Readability / Motion / Staging / Rhythm / Identity / Sync)

- **Baseline (`before`):** `7 / 4 / 5 / 4 / 5 / 6 / 5`
  - `f19–f99`: Floating black bar covered top-row card slot `0-1`, showed unexplained `BASE 14.3` with zero source breakdown, did not reconcile follow-up hits (`29` vs `⚔ 40`), and vanished completely by `f109`.
  - `f19–f59`: Chips popped with no entrance and reflowed horizontally; `multStep` double-offset sound (`slot: idx` inside `setTimeout`).
  - `f39–f99`: Unlabelled black weapon tags (`Flint Spark`, `Blast Powder`, `Rally Horn`) piled over the `★★★` challenge bar without showing numerical impact.
- **Round 1 (`r1`):** `8 / 8 / 7 / 7 / 8 / 9 / 8`
  - Moved `MultiplierIgnition` into the docked HUD bar; added `computePrimedEquation`, `buildBalatroBreakdown`, `finalizeTurnIgnition` (`followUps` + `beltBadges`), `GearBelt` value popups, and `HudInspector` `score` modal; suppressed redundant weapon name tags in `AdventureRun`.
  - Remaining defects found in `r1` frames: (1) Row 2 ticker started at `opacity: 0.25`, reading dim on `f12`; (2) `GearBelt` `🔥2`/`+10` badges touched top of `7 armed` chip by ~2 px; (3) conditional `+ 10` bonus pill shifted the equation horizontally mid-tally and left `eqRow` slightly off-center.
- **Round 2 (`r2` + `reduced`):** `9 / 8 / 8 / 9 / 8 / 9 / 9`
  - Fixed 3-zone symmetric `eqRow` with reserved dimmed bonus slot (zero horizontal shift `f0..f162`), raised ticker floor opacity (`0.6`) with bright high-contrast tints, tucked `GearBelt` badges cleanly to `bottom: -6` with `paddingBottom: 3`.
  - Remaining micro-defect on `r2/f025`: `3 Cards (+6 Card Bonus)` caused `+10 Rally Horn` to ellipsize to `+10 R...`.
- **Round 3 (`r3 --twice`):** `9 / 9 / 8 / 9 / 8 / 9 / 9`
  - Tightened opening card label to `Cards 3 (+6)` so the entire receipt (`Cards 3 (+6) · +3 Heavy Hitter · ×2 Rainbow · +10 Rally Horn`) renders untruncated at 390 px.
  - Reduced motion verified (`reduced/f010`): instant final receipt `[ BASE 12 ] × [ MULT 2× ] + [ 10 ] = [ 34 ]` and crisp static belt badges with zero bounce or flames.
  - Note on `--twice`: diffs were solely ambient enemy/particle/card-burst phases; `multiplier-ignition` and `belt-badge` reported zero motion hints.

## Final Numbers
- Step stagger: `cascadeDelay(idx, STAGGER.item)` (`60 ms`, shrink `0.84`), slam `+55 ms` after last step
- Pill bump: `SCALE.pop` (`1.08`), `MS.feedback` (`120 ms`), `EASE.pop` / `EASE.ui`
- Total slam: `0.86 → SCALE.reward` (`1.18`) → `1`, `SPRING.lively`
- Belt badge: `MS.quick` (`180 ms`), `EASE.pop`, hold `1350 ms`, exit `exitMs(MS.quick)` (`119 ms`), `EASE.exitSoft`
