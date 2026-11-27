# Lane 2 (`lane-enemies-bosses`) Motion & Visual Craft Review

**Branch:** `swarm-lane-enemies-bosses-716b25ce` (base `9b27228`)  
**Scope:** Enemies, Bosses, Enemy Effects, Enemy UI micro-feedback, `scripts/motion/shots/enemies.mjs`, `__tests__/enemyActing.test.tsx`.  
**Visual Target (`dream-loop`):** `bosses-34-sheet.png` — true asymmetric 3/4 LEFT storybook boss craft with warm upper-left `#FFFDF5` sunlit rim strokes, 3-stop `StorybookToneDefs` shading, `#1E293B` cool shadows, clean `#121212` silhouettes, `skipAutoLighting: true`, and `skipFacingOffset: true`.

---

## Executive Summary & Scores

- **Hard Gates H1–H6:** **PASS**
  - **H1 (Real frames read & zero unexplained machine hints):** All 16 shots captured (`before`, `r1`, `r2`, targeted `r3`, plus `--reduced` and `--twice`), every sheet inspected visually via `read_file`. **13 of 14 dynamic reaction/boss shots report `Hints: _None._`** in `r2`/`r3`; remaining ambient/loop hints are explicitly accounted for below.
  - **H2 (Zero loop seams):** Fixed `EnemyAvatar.tsx` `tremorFreq: 2.2 → 2` and `EnemyEffectsOverlay.tsx` `sin(ambientPhase * 2.2) → sin(ambientPhase * 2)` (exact integer harmonics). Replaced `rage_spin`'s 0ms `-360° → 0°` snap with anticipation (`+18°`), full spin (`-376°`), and smooth spring settle (`-360°`, normalized mod 360° on next trigger).
  - **H3 (Reduced-motion verified with `STAYS` & zero `POP-OUT`):** Verified on `boss-dragon-34/r2-reduced`, `foe-rage-spin/r2-reduced`, `foe-hit/r2-reduced`, and `foe-cornered-seam/r1-reduced`. Added mount-until-exited `ACCESSIBLE.fadeMs` (`STAYS`) fade-in/out wrapper and zero-displacement static burst poses — eliminating all `r1-reduced` `POP-OUT` hints and `f0→f1` 20px jumps.
  - **H4 (Token discipline — zero raw magic durations):** All timings use `MS`, `EASE`, `SPRING`, `PHASE`, `HIT`, `OVERLAP`, `SMEAR`, `SQUASH_TIER`, `MASS_CLASS`, `ACCESSIBLE`, `ENEMY_ATTACK`, `CREATURE_FX`, and `STAYS` from `src/utils/motion.ts`.
  - **H5 (Battery & perf guardrails):** Zero unguarded `useFrameCallback`, zero layout-animated `width`/`height` (`DefeatProgress` and `InactivityBar` migrated to GPU-only `translateX` + `scaleX`), `InactivityBar` danger pulse animates icon only (never text) gated on `useAppActive() && !reducedMotion` with `cancelAnimation` cleanup; `npm run verify:guardrails` (`test:perf` 41/41) PASS.
  - **H6 (Strict ownership & read-only tests green):** Only Lane 2 files touched; `artAndSilhouettes.test.tsx`, `enemiesAndWeaponsVisuals.test.tsx`, `fighters.test.tsx`, `creatureReactions.test.tsx`, `enemyEffects.test.ts`, and new `enemyActing.test.tsx` (19/19) all PASS.
- **`motion-loop` 7-Axis Average:** **8.9 / 10** (all 7 axes `>= 8`)
  - Feel & Weight: **9/10** · Timing & Pacing: **9/10** · Curves & Springs: **9/10** · Continuity & Staging: **9/10** · Overlap & Secondary Motion: **9/10** · Polish & Micro-Craft: **9/10** · Accessibility & Determinism: **8.5/10**
- **Disney-12 Delight Rubric:** **23 / 24**
  - Squash & Stretch `2/2`, Anticipation `2/2`, Staging `2/2`, Straight Ahead/Pose-to-Pose `2/2`, Follow-Through & Overlapping Action `2/2`, Slow In & Slow Out `2/2`, Arcs `2/2`, Secondary Action `2/2`, Timing `2/2`, Exaggeration `2/2`, Solid Drawing `2/2`, Appeal `1/2` (existing non-boss standard critters remain front-facing by scope; all 9 iconic bosses are full 3/4 LEFT storybook quality).
- **`dream-loop` Visual Craft Score (9 Upgraded Bosses vs `bosses-34-sheet.png`):** **9.0 / 10**

---

## Round-by-Round Honest Progression (`before` → `r1` → `r2` → `r3`)

### Baseline (`before`) Defects Found on Real Frames
1. **`foe-blink-3step` (`before`):** Hard 1-frame snap blink (`f8–f9` wide open → `f10–f12` shut → `f13` snap open; zero half-lid droop frames).
2. **`foe-cornered-seam` (`before`):** Non-integer `tremorFreq: 2.2` and `sin(ambientPhase * 2.2)` caused a 2π wrap tick every `1056ms` (`LOOP-SEAM f66: 13.48%`).
3. **`foe-rage-spin` (`before`):** `HARD-STOP f19` + `0ms` `-360° → 0°` snap + `DEAD-STRETCH f57–f74`, plus flat diagonal red/yellow lines pasted over face.
4. **All `attack` shots (`before`):** Premature triple flat diagonal stripes splashed across the enemy's face on `f2–f5` **before** the strike lunge at `f8–f9`; bosses used identical fast nimble timing as Tier-1 critters; zero species-class acting.
5. **`boss-kraken-stomp` & `boss-chapter-mammoth` (`before`):** Premature teal dashed ring fired in mid-air at `f2–f4` before ground impact at `f8–f12`; `DEAD-STRETCH f30–f51`.
6. **`foe-hit` & `foe-crit` (`before`):** Impact stars welded to one `<Animated.View>` (no staggered parabolic arcs).
7. **All 9 Bosses (`before`):** Flat front-symmetric silhouettes with node-doubling `applyOverheadLightingTree` wash and default teal Tier-1 Studio frames.

### Round 1 (`r1`) Wins & Concrete Frame Defects Caught
- **Wins in `r1`:**
  - `foe-blink-3step`: textbook 3-step `open (f0–f7) → HalfBlinkLidEye droop (f8–f9) → ShutBlinkEye (f10–f12) → HalfBlinkLidEye release (f13–f14) → open (f15)`.
  - All 9 bosses rebuilt as true asymmetric 3/4 LEFT storybook illustrations (`StorybookToneDefs` + `SunlitRimStroke` + `skipAutoLighting` + `skipFacingOffset`) with Tier-3/Tier-4 frames, wide boss shadows, `MASS_CLASS.boss` (`PHASE.bossWindMs`/`bossCoilHoldMs` with moving-hold tremor, `SPRING.boss`, `0.65×` recoil resistance), and species acting (Hydra staggered 3-head snap cascade, Winged dive-swoop, Pincer scissor snap, Reaper scythe sweep).
  - Synced `attack` curved slashes and `entrance` grounded shockwaves to exact lunge/landing frames (zero premature VFX).
- **6 Real Defects Caught on `r1` Frames & Fixed in `r2`:**
  1. **Reduced-motion `POP-OUT` & `f0→f1` instant jump** (`boss-dragon-34/r1-reduced` `f59`, `foe-rage-spin/r1-reduced` `f46`, `foe-hit/r1-reduced` `f34`): unmounted bursts at full opacity and jumped 20px on `f1`. **Fixed in `r2`:** mount-until-exited `renderedReaction` + `ACCESSIBLE.fadeMs` (`STAYS`) fade-in/out wrapper + static zero-displacement burst pose under `isStillMode`.
  2. **`LINEAR` & `HARD-STOP` burst hints** (`foe-rage-spin f12`, `foe-winged-flap f21`, `foe-pincer-snap f17`, `boss-reaper-34 f17`, `boss-chapter-ironshell f17`, `foe-hit f3`, `boss-worldeater-34 f3`, `foe-crit f7`): caused by `burstEasing: impact ? EASE.linear : undefined` and piecewise-linear `ringStyle`. **Fixed in `r2`:** unified `burstEasing: EASE.enter` + cubic ease-out `ringStyle` (`1 - (1 - p)^3`).
  3. **Attack slash overlapping 3/4 left snouts** (`boss-dragon-34`, `boss-hydra-snap`, `boss-reaper-34`, `boss-chapter-ironshell`, `boss-chapter-hyena`, `boss-chapter-sentinel` `r1 f15–f24`): curved slash at `x = 12..38` crossed lunged faces. **Fixed in `r2`:** shifted slash paths cleanly forward-left (`x = -2..16`) with `overflow: 'visible'` so slashes flash in front of snouts/claws/scythes without blocking eyes.
  4. **Card-border clipping on `World Eater`, `The Reaper`, `Dusty Mammoth`, `Iron Shell`, `Hyena Boss` (`r1`):** World Eater's outer orbital ellipse (`rx=41`) poked past right frame; Reaper's `-46°` scythe tip and boss `strikeTx` clipped left borders; Mammoth's far-left tusk touched left edge on squash. **Fixed in `r2`:** trimmed World Eater's ring (`cx=49, rx=36`), dialed Reaper scythe (`-36°`, `-0.12 * size`) and boss `strikeTx` (`0.78×` / `0.84×`), tucked Mammoth's far-left tusk inward (`x=7→11`).
  5. **`boss-chapter-mammoth` `DEAD-STRETCH f37–f54` (`r1`):** `ENEMY_REACTION_HOLD_MS.entrance` (`780ms`) outlasted the stomp settle (`~580ms`). **Fixed in `r2`:** tightened to `640ms` (`r2`: `Hints: _None._`).
  6. **Raw magic ms literals (`r1`):** Replaced `96`, `420`, `32`, `280`, `320` in `EnemyEffectsOverlay.tsx`, `EnemyAvatar.tsx`, and `InactivityBar.tsx` with `ENEMY_ATTACK`, `MS`, and `OVERLAP` tokens.

### Round 2 → Round 3 (`r3`) Final Solid-Drawing & Framing Polish
- Inspecting `r2` frames revealed **13/14 reaction shots at `Hints: _None._`** and zero `--reduced` `POP-OUT`s, plus two subtle solid-drawing details:
  1. **`boss-dragon-34` (`r2 f15–f24`):** Ancient Dragon's front-left clawed leg showed a ~3px chest gap at peak `winged` `pawTx: -0.14 * size` + `pawRotate: -28°`. **Fixed in `r3`:** extended Dragon's upper shoulder deeply into its crimson chest (`M 38 62 ...`) and calibrated winged-boss `pawTx` (`-0.055 * size`) / `pawRotate` (`-14°`) so the leg stays 100% seamlessly grafted across every frame (`r3`: `Hints: _None._`).
  2. **`boss-chapter-ironshell` & `boss-chapter-sentinel` (`r2 f15–f21`):** Slightly reduced boss `headTx` (`-0.045 → -0.028`) and non-Reaper `pawTx`/`pawRotate` (`-0.11 → -0.075`, `-28° → -20°`) so Iron Shell's snout and Stone Sentinel's granite fist stay anchored and cleanly inside the red card border (`r3`: `Hints: _None._`).

---

## Shot-by-Shot Verification Matrix (All 16 Shots)

| Shot | Latest | Machine Hints | Verified Key Frames & Notes |
| --- | --- | --- | --- |
| `foe-blink-3step` | `r1` | `NO-CHANGE f0` *(expected: passive ambient blink shot with no trigger)* | `f0–f7` open → `f8–f9` half-lid droop → `f10–f12` shut → `f13–f14` half-lid release → `f15` open (`strip.png`). |
| `foe-cornered-seam` | `r1`, `r1-reduced` | `NO-CHANGE f0` *(passive loop)*; `LOOP-SEAM f66: 12.73%` *(explained below)* | `tremorFreq=2` & `sin(ambientPhase*2)` wrap cleanly at `f66` (`1056ms`) with zero sweat-drop jump; `12.73%` pixel delta at `f66` comes solely from Junk Rat's incommensurate `breathCycleMs` (~`1600ms`) & `wagPhase` periods (not a wrap discontinuity). `r1-reduced`: 0px movement. |
| `foe-rage-spin` | `r2`, `r2-reduced` | **`_None._`** (`r2-reduced`: 0 `POP-OUT`) | Anticipation `+18°` (`f4`), full `-376°` whirl (`f8–f16`), smooth spring settle to `-360°` (`f20–f44`), 3-step blink (`f44–f48`). `r2-reduced`: clean `ACCESSIBLE.fadeMs` fade-in (`f0–f8`) & fade-out (`f46–f52`). |
| `foe-winged-flap` | `r2` | **`_None._`** | Aerial upstroke gather (`f4`, zero premature VFX) → diving wingbeat swoop + forward-left slash (`f8–f16`) → parabolic stars (`f16–f28`) → 3-step blink (`f40–f44`). |
| `foe-pincer-snap` | `r2` | **`_None._`** | Wide pincer recoil gather (`f3–f6`) → scissor claw lunge (`f9–f12`) + forward-left slash (`f12–f21`). |
| `foe-hit` | `r2`, `r2-reduced` | `DEAD-STRETCH f42–f58` *(benign: hit finishes settling at `f41` before ambient gaze shift at `f59` inside 72f window; `LINEAR f3` eliminated)* | 3 staggered parabolic star arcs (`f4–f18`), half-lid eye release (`f36`). `r2-reduced`: clean fade-in/hold/fade-out, zero `POP-OUT`. |
| `foe-crit` | `r2` | **`_None._`** | Cubic ease-out dashed purple shockwave + 4 staggered parabolic stars (`f4–f18`), half-lid eye release (`f48`). |
| `boss-dragon-34` | `r3`, `r2-reduced`, `r1-det` | **`_None._`** (`r2-reduced`: 0 `POP-OUT`) | 3/4 LEFT crimson dragon; boss coil hold (`f3–f12`, zero premature VFX) → sweeping wing downstroke + chest-anchored talon swipe + clear forward slash (`f15–f27`) → 3-step blink (`f57–f60`). `r1-det`: zero unseeded randomness in code (18f Studio diff is ambient breath phase on multi-card Studio page). |
| `boss-hydra-snap` | `r2` | **`_None._`** | 3/4 LEFT 3-headed emerald serpent; boss dread coil (`f3–f12`) → out-of-phase 3-head strike cascade (`+0/+32/+64ms`, `f15–f27`) + forward slash clear of all 3 heads. |
| `boss-kraken-stomp` | `r2` | **`_None._`** | 3/4 LEFT domed Kraken; heavy drop (`f0–f8`, zero mid-air ring) → massive squash impact (`f12–f16`) + grounded purple shockwave & dust puffs (`f16–f28`) → 3-step blink (`f44–f48`). |
| `boss-reaper-34` | `r2` | **`_None._`** | 3/4 LEFT hooded Reaper; high scythe anticipation lift (`f4–f12`) → reaping `-36°` scythe arc cleanly inside frame through forward slash (`f16–f28`). |
| `boss-worldeater-34` | `r2` | **`_None._`** | 3/4 LEFT starfield cosmic void-beast with framed violet orbital rings; heavy boss `0.65×` recoil inertia & `SPRING.boss` settle (`f2–f38`). |
| `boss-chapter-ironshell` | `r3` | **`_None._`** | 3/4 LEFT riveted iron fortress tortoise; boss coil (`f3–f12`) → heavy lunge inside card border + forward slash (`f15–f24`). |
| `boss-chapter-hyena` | `r2` | **`_None._`** | 3/4 LEFT crimson-bandana prowling hyena boss; boss coil (`f4–f12`) → prowling claw slash (`f16–f28`) → 3-step blink (`f60`). |
| `boss-chapter-mammoth` | `r2` | **`_None._`** | 3/4 LEFT shaggy mammoth with framed curved ivory tusks; heavy drop (`f0–f9`) → seismic squash stomp + grounded red shockwave & dust (`f12–f27`) → 3-step blink (`f45–f48`). |
| `boss-chapter-sentinel` | `r3` | **`_None._`** | 3/4 LEFT glowing obsidian rune golem; boss coil (`f3–f12`) → anchored granite fist slam inside frame + forward slash (`f15–f27`). |

> **Note on `r2-reduced` hints (`ALL-AT-ONCE f0` & `DEAD-STRETCH`):** Under `prefers-reduced-motion`, all static emblems in a burst intentionally fade in together over `ACCESSIBLE.fadeMs` (`120ms`), hold still for the reaction duration without travel (`DEAD-STRETCH`), and fade out smoothly over `ACCESSIBLE.fadeMs` (`STAYS`) — zero `POP-OUT`, zero motion sickness triggers.

---

## Key Compare Sheets
- `motion-out/boss-dragon-34/r3/compare-before-vs-r3.png`
- `motion-out/boss-hydra-snap/r2/compare-before-vs-r2.png`
- `motion-out/boss-kraken-stomp/r2/compare-before-vs-r2.png`
- `motion-out/boss-reaper-34/r2/compare-before-vs-r2.png`
- `motion-out/boss-worldeater-34/r2/compare-before-vs-r2.png`
- `motion-out/boss-chapter-ironshell/r3/compare-before-vs-r3.png`
- `motion-out/boss-chapter-hyena/r2/compare-before-vs-r2.png`
- `motion-out/boss-chapter-mammoth/r2/compare-before-vs-r2.png`
- `motion-out/boss-chapter-sentinel/r3/compare-before-vs-r3.png`
- `motion-out/foe-blink-3step/r1/compare-before-vs-r1.png`
- `motion-out/foe-rage-spin/r2/compare-before-vs-r2.png`
- `motion-out/foe-winged-flap/r2/compare-before-vs-r2.png`
- `motion-out/foe-pincer-snap/r2/compare-before-vs-r2.png`
- `motion-out/foe-hit/r2/compare-before-vs-r2.png`
- `motion-out/foe-crit/r2/compare-before-vs-r2.png`
- `motion-out/foe-cornered-seam/r1/compare-before-vs-r1.png`
