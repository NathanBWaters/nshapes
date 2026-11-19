# battle-damage-story

Brotato-style cumulative weapon, passive, skill, evolution, and Set damage breakdown with an over-time stacked-area SVG graph and a 3-second audio-visual crescendo overview (`BattleDamageStory.tsx`). Shared across both Adventure Mode (`LevelResults.tsx`) and Starfall Spire (`SpireRewardScreen.tsx` and `SpireEndScreen.tsx`).

Shot: `results-story` (`/dev/results?case=geared`, 195 frames × 16 ms = 3120 ms, viewport 390×844) + neighbour check `results-quick` (`/dev/results?case=perfect`).
Scores are Response / Readability / Motion / Staging / Rhythm / Identity / Sync.

## Scores

| Version | Scores | Capture |
|---|---|---|
| before (initial draft) | 7/6/6/6/5/8/4 | `motion-out/results-story/before` |
| r1 | 8/8/8/8/8/9/8 | `motion-out/results-story/r1` (`--twice`) |
| r2 (final) | 9/9/9/9/9/9/9 | `motion-out/results-story/r2` (`--twice`) |
| reduced | 0 movers, 0 sound cues, complete graph & bars on f0 | `motion-out/results-story/reduced` |
| neighbour (`results-quick`) | 0 hints, star/coin/story audio cleanly separated | `motion-out/results-quick/after-story` |

## Baseline critique (`before`)

Captured on `2-4` geared ★★★ win (`2,653 DMG`, 18 damage sources: Power Scaling 44%, Big Bang 14%, Mending Charm 8%, Flint Spark 7%, +14 more):
1. **Playhead vs peak-burst & sound desync (f31–f123):** `sweep` used `EASE.ui` (fast ease-out finishing at f134 / 2144 ms), while `PeakBurst` and `band.storyBeat` fired on linear `beat.progress * STORY_SWEEP_MS`. On `f95`, the golden playhead was already at ~90% of the chart while the spark burst popped back at ~55% (`0:18`) and the live readout lagged at `628 DMG`.
2. **Squashed Y-axis & stacked area gap (f175):** `niceAxisMax(2653)` jumped to `5.0k`, leaving the top 47% of the dark stage empty; the top-5 stacked bands stopped below the white `totalPath` ridge with an unexplained dark gap; and the `EVOLUTION!` / `K.O.!` pill touched the `5.0k` axis label (`PAD_T = 22`).
3. **Tiny rank 2–4 Brotato bars + 23 px replay button hop (f168→f169):** Bars scaled by total share (`44% / 14% / 8% / 7%`) instead of ratio-to-MVP (`100% / 31% / 17% / 16%`), leaving ranks 3–4 as tiny nubs (`HARD-STOP` on row 1 at f58). Toggling `"3s Story"` ↔ `"LIVE"` shifted the replay button icon 23 px sideways on f168→f169.
4. **Coarse live counter:** `liveTotal` only stepped at the 5 beat timestamps, staying frozen for 30+ frames between jumps.

## Brief

```
SURFACE   battle-damage-story · shot results-story · seen every geared battle (Adventure & Spire)
GOAL      Sync the 3-second cumulative damage graph reveal, glowing golden playhead, color-matched
          peak spark bursts, rolling live DMG readout, MVP-normalized Brotato bars, and each
          weapon's real musical instrument voice into one cohesive crescendo.
HERO      The golden sweeping playhead tracing the stacked cumulative mountain f0→f166 (2700 ms),
          igniting color-matched peak bursts + callouts + instrument voices on exact dot crossings.
POSES     f0      curtain at translateX=0, playhead at left edge, liveTotal=0, replay button fixed 82px
          f36/f60/f83/f107  playhead crosses each milestone dot -> ring + 5 sparks + callout + storyBeat
          f157    playhead reaches K.O. dot at right edge -> final burst + weapon voice
          f166-f172  curtain clears, playhead fades out (160 ms EASE.exitSoft)
          f168-f189  storyClimax resolves + MVP crown badge pops (SCALE.pop MS.feedback -> SPRING.lively)
MOTION    sweep: SWEEP_BEZ cubic-bezier(0.24, 0.06, 0.68, 1) over STORY_SWEEP_MS (2700 ms)
          beats: inverse-solved timeForSweepProgress(beat.progress) * STORY_SWEEP_MS (sub-frame lock)
          liveTotal: 22 steps sampled at sweepProgressAtTime(u) across STORY_SWEEP_MS
          PeakBurst: ring 0.3->1.95 + 5 dots over MS.move+120 (EASE.enter)
          BrotatoBar: GPU translateX inside static %-width clip normalized to topSourceDmg
SOUND     band.storyBeat (each weapon's real instrument from voices.ts climbing in pitch/velocity)
          lands on the exact crossing frame (+0.0..+0.6 f); band.cue('storyClimax') on f169.5.
          Auto-play in LevelResults waits until stars + coinRoll finish (f177 on results-quick).
BANNED    behind-the-playhead bursts; layout-property animations; shifting button widths;
          empty gap between stacked bands and total ridge; wasted Y-axis headroom.
REDUCED   complete stacked graph + 100%-scaled Brotato bars + final DMG on f0; 0 movers,
          0 sound cues, replay button hidden.
```

## Rounds

- **r1** (`motion-out/results-story/r1`, compare `compare-before-vs-r1.png`): Switched sweep to S-curve `[0.36, 0.04, 0.44, 1]` with exact inverse-solved beat timestamps (`f40/f58/f75/f94/f131` matching `storyBeat` at `f40.5/f58.7/f75.3/f94.5/f131.6`), tightened `niceAxisMax` (`3.0k` filling 88% height), added `CHART_H = 142` / `PAD_T = 28` header lane, added `#64748B` stacked base band for sources `#6..#N`, added 22-step smooth live DMG ticker, normalized Brotato bars to MVP width, and changed button label to `Playing`/`3s Story`. Remaining micro-defects caught on `f095.png` & `f131.png`:
  1. The final blue `K.O.!` dot (radius 4) peeked 2 px past the right edge of `revealClip` (`width: plotW + 2`).
  2. `replayBtn` (`minWidth: 74`) still shifted 6 px when toggling `Playing` → `3s Story` at f168→f169.
  3. Clamping `beat.progress` to `0.94` caused `K.O.!` to fire at f131 (`2100 ms`), 600 ms before the climax chord.
- **r2** (`motion-out/results-story/r2`, compare `compare-before-vs-r2.png`): Extended `revealClip` to `plotW + 8`, locked `replayBtn` to fixed `width: 82` (`0 px` shift, Mover #15 eliminated), tuned `SWEEP_BEZ = [0.24, 0.06, 0.68, 1]`, and aligned `crescendoBeats` `progress` to the true dot x-position (`0.06..0.985`). Final bursts land at `f36 / f60 / f83 / f107 / f157` with sounds at `f36.6 / f60.3 / f82.9 / f106.9 / f157.1` and `storyClimax` + `MVP` crown pop at `f168–f189`.
- **Reduced motion** (`motion-out/results-story/reduced`): 0 movers, 0 sound cues, full finished stacked mountain & Brotato bars crisp on f0.
- **Neighbour check** (`motion-out/results-quick/after-story`): 0 machine hints; Adventure victory star/seal/coin sequence (`f6..f105`) finishes cleanly before `story:beat` begins (`f177`).

## Final numbers

- `STORY_SWEEP_MS = 2700`, `SWEEP_BEZ = [0.24, 0.06, 0.68, 1]`.
- `CHART_H = 142`, `PAD_L = 34`, `PAD_R = 10`, `PAD_T = 28`, `PAD_B = 20`, `revealClip` width `plotW + 8`.
- `LIVE_STEPS = 22` interpolated via `sweepProgressAtTime(u)`; beats scheduled via `timeForSweepProgress(beat.progress)`.
- `BrotatoBar` clip width `max(6%, round(totalDamage / topSourceDmg * 100%))`, animated purely with `translateX`.
- `replayBtn` fixed `width: 82`, `justifyContent: 'flex-start'`.
- `MVP` crown pop: `SCALE.pop` (`MS.feedback`, `EASE.pop`) → `SPRING.lively`.
