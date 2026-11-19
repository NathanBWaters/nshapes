# Motion review: `killcam-finisher` & `knockout-handoff`

## Brief

```
SURFACE   killcam-finisher + knockout-handoff · shot fight-ko / fight-win · seen often

GOAL      When the player lands the fight-winning Set, let the cards smash into the
          foe in full color, then dilate time in a Clair-Obscur: Expedition 33
          slow-mo moment (monochrome shift, letterbox, golden slash, slow-drifting
          chroma petals, tempo+pitch audio slowdown) before releasing seamlessly
          into the Victory Card with zero dead air.

REFERENCE Clair Obscur: Expedition 33 enemy defeat slow-motion hit-stop & chiaroscuro
          accent color, translated into NShapes' crisp ink-and-gold visual grammar.

HERO      The Clair-Obscur slow-mo impact & Victory crest (one undisputed hero —
          no duplicate K.O.! banner fighting FINISHING BLOW!, no white screen flash).

POSES     f0    Lethal 3rd card tapped; board answers immediately, Balatro scoreboard lights.
          f6-22 Thrown Set cards fly at full speed in full color and smash into the foe.
          f23   Lethal hit burst + `payout` (f23.5) + `slowMoDefeat` audio drop (f23.9).
          f24-28 Arena drains to painterly monochrome (`backdropFilter`), ink+gold
                letterbox bars glide in, golden chiaroscuro slash cuts across the foe,
                14 golden diamond chroma petals erupt fast then hang in 0.15× drift,
                and the ceremonial dark+gold Victory banner locks in below the scoreboard.
          f29-72 Suspended slow-mo breath (~780 ms hold); live music drags down in tempo
                and pitch into hushed hall stillness while arena pushes in (1 → 1.045).
          f73-86 Color blooms back, letterbox retracts, petals fade cleanly before unmount,
                `band.finale(true)` swells in sync with the release.
          f91+  Seamless `ScreenTransition` sweeps straight into the Victory Card (zero dead gap).

MOTION    noirWash: opacity 0→1 (MS.feedback, EASE.enter), hold 780 ms, 1→0 (240 ms, EASE.exitSoft)
          letterbox (52 px): translateY ±56→0 (MS.move, EASE.enterSoft), out exitMs(MS.move)
          goldSlash: scaleX 0.08→1 (MS.feedback, EASE.enter) across foe center (-18°)
          chromaShards (14): Easing.bezier(0.06, 0.94, 0.14, 1) slow-mo drift; fade completes
                             before release (zero HARD-STOP)
          victoryBanner: scale 1.14→1 (never scaled up) · MS.move · EASE.enterSoft · >550 ms hold
          arenaPushIn: scale 1→1.045, translateY 0→10 · MS.hero × 0.72 · EASE.enterSoft

SOUND     `slowMoDefeat` on f23.9 (exact impact frame): chest-thump sub-drop (122→26 Hz),
          pitch-sagging bell/horn/glass fifth (×0.84), vacuum whoosh (5600→180 Hz), and live
          band tempo/pitch drag (`slowMo = 0.36`, filter 320 Hz); `band.finale(true)` blooms
          on slow-mo release as filter re-opens to 18 kHz.

BANNED    White full-screen flash; dimming before the Set hits; two competing knockout
          banners (`FINISHING BLOW!` + `K.O.!`); 900 ms dead gap before results;
          mid-exit unmount (`HARD-STOP`); firing on mid-wave trash kills.

REDUCED   Zero zoom, zero wash, zero letterbox, zero shards; clean opacity-only dark+gold
          Victory banner fade (`ReduceMotion.Never`, MS.feedback) over 620 ms into Results.

CHECK     Cards hit in full color before slow-mo engages; `slowMoDefeat` lands on impact
          frame (≥ payout frame); zero HARD-STOP hints on kill-cam-overlay; clean release
          straight into Results; clean `--reduced` capture.
```

### Three Hero Variants Considered
1. **Fast Comic Flash & Stamp (Old KillCam):** Rejected — banned white flash, zero audio/visual time-dilation, dimmed the throw, fought the `K.O.!` banner.
2. **Clair-Obscur Monochrome Slow-Mo & Ink-Gold Snap-Release (Chosen):** Real GPU-composited monochrome wash + ink/gold letterbox + luminous golden slash & slow-drifting chroma petals + real Web Audio tempo/pitch drag, releasing straight into the Victory Card.
3. **Canvas Snapshot Freeze & Shatter:** Rejected — heavy DOM-to-canvas overhead on mobile web vs locked 60fps GPU-composited transforms and opacity.

## Rounds & Scores (Response / Readability / Motion / Staging / Rhythm / Identity / Sync)

- **Baseline (`fight-win/before`):** `6 / 5 / 4 / 3 / 4 / 4 / 3`
  - `f0–f13`: Premature grey veil covered the hit; yellow `FINISHING BLOW!` overlapped the Balatro Scoreboard; banned `#FFFDF5` full-screen flash; rainbow `★` shards fired before `foe_defeated`.
  - `f14–f76`: Duplicate orange `K.O.!` banner slammed in right after `FINISHING BLOW!` vanished and hit `HARD-STOP` on `f76` before a 900 ms dead gap.
  - Audio: `band.finale(true)` fired immediately at `t=0`, colliding with `killCamRiser`, `foeDefeated`, and `killCamShatter`.
- **Round 1 (`fight-win/r1`):** `8 / 8 / 7 / 8 / 7 / 9 / 7`
  - Built Clair-Obscur wash, letterbox, golden slash, diamond chroma shards, ceremonial banner, stage push-in, `suppressKoBanner` on final victory, and `band.slowMoDefeat` audio time-dilation.
  - Defects caught in frames: 6 `HARD-STOP` hints on `f42` because `onFinish` started `ScreenTransition` right as `ChromaShard`s and `victoryZoom` were still finishing; chroma petals read slightly small (`8–14 px`).
- **Round 2 (`fight-ko/r2` + `reduced`):** `9 / 9 / 9 / 9 / 9 / 10 / 8`
  - Added dedicated `fight-ko` shot starting on the exact lethal 3rd-card tap; extended `SLOWMO_HOLD_MS` (`780 ms`) + `SLOWMO_SETTLE_PAD_MS` (`64 ms`); enlarged chroma petals (`11–18 px`) finishing fade cleanly before release → **0 `HARD-STOP` hints!**
  - Defect caught in `fight-ko/r2/report.md`: `slowMoDefeat` fired on `f19.5` while thrown cards landed on `f22` (`payout` on `f23.5`) — 2.5 frames early.
- **Round 3 (`fight-ko/r3 --twice` + `strip-impact.png`):** `9 / 9 / 9 / 9 / 9 / 10 / 9`
  - Adjusted `SLOWMO_IMPACT_DELAY_MS` to `290 ms`: `strip-impact.png` (`f16–f31`) confirms cards smash into the foe in full blazing color on `f22–f23`, `payout` (`f23.5`) and `slowMoDefeat` (`f23.9`) drop on the exact impact frame, monochrome wash + golden slash + letterbox + chroma petals engage on `f24`, hold cleanly through `f76`, release cleanly on `f87`, and sweep into Results on `f98`. Zero hints on `kill-cam-overlay`.

## Final Numbers
- `SLOWMO_IMPACT_DELAY_MS`: `290 ms` (synced to `FX_TIMING.flightMs` + audio grid slip)
- `SLOWMO_HOLD_MS`: `780 ms`, `SLOWMO_RELEASE_MS`: `240 ms`, `SLOWMO_SETTLE_PAD_MS`: `64 ms`
- `SLOWMO_REDUCED_TOTAL_MS`: `620 ms`
- Audio time-dilation (`band.slowMoDefeat`): `slowMo = 0.36`, `musicFilter → 320 Hz`, `musicLevel → 0.32`, pitch sag `×0.84` (-3 semitones), halt at `420 ms`, `band.finale(true)` blooms at `impactDelay + SLOWMO_HOLD_MS`.
