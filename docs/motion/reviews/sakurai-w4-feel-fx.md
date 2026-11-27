# sakurai-w4-feel-fx

Wave 4 Sakurai Game Feel, Hitstop, Creature Motion, Stage VFX, A/V Sync & 60fps GPU Verification (`[FX-01]`–`[FX-26]`, `v0.1.177`).

Shots captured at `390×844` (`16 ms`/frame) on `http://localhost:8099`:
- Studio (`app/dev/fx.tsx`): `fx:hit` (`w4 --twice`, `r1`, `reduced`), `fx:blast` (`w4`, `r1`), `fx:laser` (`w4`), `fx:rainbow` (`w4`).
- Real fight (`1-5`, `AdventureRun.tsx`): `fight-set` (`w4`, `r1`, `reduced`), `fight-miss` (`w4`, `r1`).

## Scores (Response / Readability / Motion / Staging / Rhythm / Identity / Sync)

| Surface | Shot | Wave 4 Baseline (`w4`) | Final (`r1`) | Key frame-driven change |
|---|---|---:|---:|---|
| `set-throw-lands` (Swish + Hitstop + Edge Starburst) | `fx:hit`, `fight-set` | `9/8/7/7/8/8/9` | **`9/9/8/9/9/9/9`** | Replaced static full-path `SwishRibbon` (`FADE-ONLY` f1–f15 spoiling card path ahead of wind-up) with 3 staggered trailing segments (`segTail → segMid → segHead`) revealing strictly behind flying cards. |
| `blast-on-board` (4-Stage Explosion) | `fx:blast`, `fight-set` | `9/8/7/8/8/9/9` | **`9/9/8/8/8/9/9`** | Eliminated `HARD-STOP` on `#fx-explosion-ember` (59% speed at f19 in `fx:blast`, 81% at f38 in `fight-set`) using `MOTION.enter` + zero-terminal-velocity cubic arc (`-8t(1-t)²`). |
| `laser-on-board` (2f Snap Beam + Sparks) | `fx:laser` | `9/9/9/9/9/9/9` | **`9/9/9/9/9/9/9`** | Verified 2-frame (`32 ms`) cyan beam snap (`f1→f3`), white-hot core, endpoint `#fx-beam-spark` burst (`f3→f15`), zero linear hints. |
| `wrong-pick` (Invalid Pick Refill Split) | `fight-miss` | `9/8/6/8/7/8/8` | **`9/8/8/8/8/8/8`** | Eliminated 5× `POP-OUT` hints on f29 (`card-slot-0-0..2` still at full opacity on f26 before f29 unmount) by aligning `CARD_MOTION.missLeaveAtMs` (`300 → 240 ms`) and `exitMs(MS.quick)` (`119 ms`, `EASE.exitSoft`) inside `REPLACE_INVALID_DELAY_MS` (`380 ms`). |
| `rainbow-big-hit` (Tier 2/3 Shake + Chiaroscuro) | `fx:rainbow` | `9/8/8/8/8/9/9` | **`9/8/8/8/8/9/9`** | Verified `useCombatShake` diagonal kick (`±8 px` f15→f27), `ChiaroscuroFlash` dark-then-gold perimeter frame, contact-edge `Starburst` + ink-outlined `Ticks`, and enemy `crit_pain` recoil with `hideImpactStars={true}`. |

## Frame-by-frame evidence

### 1. `fx:hit` (`w4` → `r1`) & `fight-set` (`w4` → `r1`)
- **Response:** `f0` (`0 ms`) press squish (`SCALE.press`, `32 ms`) + card pop; `f5` (`80 ms`) ghosts mount and launch in `fight-set` (`f1` in studio `fx:hit`).
- **Baseline defect (`w4`):** On `fx:hit/w4/strip.png` (`f2–f12`) and `fight-set/w4/strip.png` (`f6–f15`), `#fx-swish-ribbon` painted all 3 segments at full length from `f1`, drawing solid lines straight into the enemy's head while the cards were still pulling back on the board (`FADE-ONLY` hint).
- **Fix (`r1`):** `SwishRibbon` in `src/adventure/fx/visuals.tsx` now stages `segTail` (`0.28f→0.78f`), `segMid` (`0.54f→0.98f`), and `segHead` (`0.76f→1.0`) behind the card's `fly = u*(0.35 + 0.65u)` trajectory with slimmer ink/fill widths (`4.5/7.5/10.5` ink, `2.2/4.8/7.5` fill). Compare sheets (`fx-hit/r1/compare-w4-vs-r1.png`, `fight-set/r1/compare-w4-vs-r1.png`) confirm zero premature lines during `f2–f8` wind-up and crisp curved wakes trailing the accelerating cards on `f9–f15` (`fx:hit`) and `f15–f21` (`fight-set`).
- **Impact & A/V sync (`fight-set` `r1`):**
  - Thrown cards land on `f22` (`352 ms`); `#fx-ring`, `#fx-ticks`, `useCombatShake`, enemy `pain`/`crit_pain`, and `MultiplierIgnition` final slam all fire on `f22`.
  - Measured audio cue log: `multStep` `f9 / f12.1 / f14.8`, `blast` `f18.8` (picture `f18`), `multSlam` **`f22.1`** (+0.1f), `fighter:Orange Tabby:cheer` **`f22.1`** (+0.1f), `rainbow` **`f22.9`** (+0.9f). Zero early audio spoil.
- **Repeatability (`fx:hit --twice`):** 56/57 frames identical; single-frame boundary variance on `f16` from studio virtual-timer tick alignment on impact mount.

### 2. `fx:blast` (`w4` → `r1`)
- **4-Stage Explosion (`[FX-16]`):** `f1–f3` ink-rimmed cream Flash → `f2–f11` jagged orange/yellow Fireball (`scale ×1→×3.04`, `64 ms` ease-out) → `f7–f31` opaque charcoal Smoke clouds rolling upward (`scale ×1→×2.56`, `224 ms` ease-out) → diamond Embers arcing outward within the 24-particle global cap.
- **Baseline defect (`w4`):** `#fx-explosion-ember` tripped `HARD-STOP` at `f19` (59% top speed in `fx:blast`) and `f38` (81% top speed in `fight-set`) due to `-6 * Math.sin(Math.PI * t)` having non-zero terminal velocity (`+6π`) at `t = 1`.
- **Fix (`r1`):** Switched `ExplosionEmberShard` to `MOTION.enter` (`ease-out-expo`) and `-8 * t * (1 - t)²` (zero derivative at `t = 1`). Both `fx:blast/r1/report.md` and `fight-set/r1/report.md` confirm **0 `HARD-STOP` hints** on `#fx-explosion-ember`.

### 3. `fx:laser` (`w4`)
- **2-Frame Snap Beam (`[FX-19]`):** `#fx-beam` snaps across 156 px in `2f / 32 ms` (`f1→f3`, intentional cut), holds with white-hot core flicker while `#fx-beam-spark` ink-outlined ticks burst at endpoint (`f3→f15`), cards flash & vaporise (`f8→f17`), orbs land on `f16` with `LASER −12` stamp cleanly readable through `f67`. Zero `LINEAR` or `HARD-STOP` hints.

### 4. `fight-miss` (`w4` → `r1`)
- **Baseline defect (`w4`):** Tightening `REPLACE_INVALID_DELAY_MS` to `380 ms` (`[FX-21]`) caused the 3 red-washed invalid cards to unmount on `f29` while still at ~95% opacity (`CARD_MOTION.missLeaveAtMs: 300` + `exitMs(MS.move) = 185 ms` on `EASE.exit`), triggering 5× `POP-OUT` hints (`f26` solid → `f29` gone).
- **Fix (`r1`):** Shifted `CARD_MOTION.missLeaveAtMs` to `240 ms` (right as the `256 ms` shake finishes) and exit curve to `exitMs(MS.quick)` (`119 ms`, `EASE.exitSoft`), completing shrink+fade at `359 ms` before the `380 ms` replacement. Compare sheet (`fight-miss/r1/compare-w4-vs-r1.png`) shows smooth fade/shrink across `f24–f28` (`opacity 1→0.17`, `scale 1→0.90`) and **0 `POP-OUT` hints**.

### 5. Reduced Motion (`fx:hit --reduced` & `fight-set --reduced`)
- **`fight-set --reduced`:** Zero card throw, zero swish ribbons, zero screen shake, zero explosion movement. Damage number `−7` + tags (`NO HARM`, `BLAST!`) mount cleanly on `f6` (`payout` sound `f6.5`), hold still and crisp through `f41` (`560 ms`), fade cleanly `f41→f47` (`96 ms`), and replacement cards fade in `f22→f38` (`64 ms`).
- **`fx:hit --reduced`:** Zero card travel, zero shake, zero swish ribbons; HP bar drops cleanly `180/180 → 166/180` on `f16` and `−14` holds readable through `f31+`.

## Final numbers & limits
- `SwishRibbon`: `total = max(80, ms + 48)`, 3 trailing segments (`segTail 0.04–0.38`, `segMid 0.30–0.70`, `segHead 0.62–0.99`) synced to `Ghost` acceleration curve.
- `ExplosionEmberShard`: `EXPLOSION_TIMING.emberMs` on `MOTION.enter`, arc `-8 * t * (1 - t)²`, fade `0.55→0.92`.
- `CardMotion` miss exit: `missLeaveAtMs: 240`, `exitMs(MS.quick)` (`119 ms`) on `EASE.exitSoft` inside `REPLACE_INVALID_DELAY_MS: 380`.
- Native iOS/Android haptics and native-driver frame pacing were verified via Jest unit suites (`wave4FeelSync`, `fightFx`, `fighters`); visual captures cover the Expo web build (same Reanimated worklets & SVG layers).
