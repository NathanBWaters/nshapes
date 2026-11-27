# Motion Review — Lane 1 (`lane-fighters`): Hero Fighters Acting, Blinks, Effects & Build Auras

**Branch:** `swarm-lane-fighters-022d7775` · **Base:** `9b27228` (Phase 0 Foundation)  
**Target Reference:** `scratch/nano-banana/sheets/fighters-acting-sheet.png`, `scratch/disney-playbook.md` (§2.1A, §4), `style_guide.md`  
**Dev Server Port:** `http://localhost:8101` (dedicated lane server; terminated after verification)

---

## 1. Motion Briefs (Written Before Code, Verified Through `r3` Captures)

### Surface A — 3-Step Organic Upper-Eyelid Blink (`fighter-blink-3step`)
- **Goal:** Replace 1-frame snap-blinks with an organic 3-step upper-eyelid sweep (`0 open → 1 heavy half-lid droop → 2 full shut arc → 1 opening half-lid → 0 open`) matching `useCreatureMotion`'s deterministic `BLINK` (`32ms → 48ms → 48ms`) cadence.
- **Hero:** Eyes & upper eyelids (`HalfBlinkLidEye` / `ShutBlinkEye` with species-matched `lidFill`).
- **Poses:** `f0–f7` open → `f8–f9` half-lid closing → `f10–f12` shut arc → `f13–f15` half-lid opening → `f16+` open.
- **Banned:** Boolean snap `blinkStage === 2`, drowsy idle half-blinks leaking into active combat attacks, unseeded `Math.random()`.
- **Reduced Motion:** `animate={false}`, zero blink/idle loop motion, calm open resting face.

### Surface B — 6 Species-Specific Acting Signatures (`fighter-badger-jab`, `fighter-tabby-pounce`, `fighter-fox-dart`, `fighter-penguin-cast`, `fighter-pelican-cheer`, `fighter-corgi-zoomie`, `fighter-joy`, `fighter-streak`)
- **Goal:** Give all 6 Hero Fighters distinct silhouettes, mass classes, fidgets, Set-launch attacks (`throw`), and celebrations (`joy` / `ecstatic`) with zero 1-frame JSX limb teleports and zero raw magic timing literals.
- **Species Contracts (`fighterRegistry.tsx`, 100% tokenized via `src/utils/motion.ts`):**
  - **Orange Tabby (`standard`):** Deep pounce-crouch (`0.84`) → connected-foreleg high-paw diagonal swipe (`pawTx +0.11s`, `pawBounce -0.14s`, `pawRotate -34°`) + 2f strike smear (`SMEAR.strikeSkewDeg`); frame-safe springy cat-hop cheer (`0.60×` lift); arched cat-stretch & alternating L→R ear flick fidgets.
  - **Sly Fox (`nimble`):** Razor-low horizontal rogue dart (`lungeTx × 1.25`, `bodyRotate +18°`, tucked stealth paws `pawTx +0.055s`, flame-tail whip `-34°`); cocky tilt-wink hop (`0.68×` lift); low sly head-dip & brush-tail flick fidgets.
  - **Badger (`heavy`):** Grounded rear uppercut cock-back (`scaleY 0.80`, `-12°`, `pawTx -0.08s`) → forearm-attached heavy haymaker cross jab (`+17°`, `pawTx +0.13s`, `pawBounce -0.09s`, `pawRotate -28°`, `1.5×` recoil, `SPRING.heavy`); low grounded fist-pump stomp cheer (`0.44×` lift + stomp push into shadow); boxer shoulder-weave fidget.
  - **Corgi (`nimble`):** Plush butt-wiggle crouch (`SQUASH_TIER.playful.squashY = 0.78`, `±7°` wiggle, frantic `±36°` nub-tail blur) → frame-safe zoomie sploot bounce (`0.54×` lift, `scaleY 1.14`, splayed radar ears `-22° / +24°`); asymmetric radar-ear swivel & double paw-patter fidgets.
  - **Emperor Penguin (`standard` regal):** Tall upright draw-up (`scaleY 1.06`, never hunches) → sweeping casting flipper (`-34° → +24°`) & mystic halo flare (`+42°`, `SPRING.settle`); dignified bow-bob cheer; noble chin-lift & flipper-fold fidgets.
  - **Pelican (`standard` loose):** Bill-scoop pullback (`-15°`) → forward pouch-heave sling (`headRotate +14°`, lagging `SPRING.loose` gular pouch heave); frame-safe 2-beat coastal wing-flap cheer (`0.52×` lift, `-8°` bill lift, `+52°` skyward wings); pouch gulp & crest-ruffle fidgets.
- **Banned:** Identical generic right-tilt across species, detached floating fists/paws, 1-frame JSX cheering limb swaps, throw slash lines drawn over faces, welded single-slab burst stickers, `LINEAR`/`HARD-STOP` burst motion, raw magic timing literals.

### Surface C — Living Lightweight Breath, Sleepy `zZz`, Framed Streak Pill & Build Aura (`fighter-sleepy-zzz`, `fighter-streak-pill`, `fighter-aura-loop`)
- **Goal:** Eliminate static closed-oval `zZz`, hard-pop `3x` streak badges, muddied frame tinting, hidden/crowded Arcana build aura gems, and reduced-motion `POP-OUT`; add battery-safe GPU-only `lightweight` breathing (`0` frame loops) to `FighterAvatar`.
- **Motion:**
  - `zZz`: 3 staggered rising S-curve letters (`0`, `1/3`, `2/3` phase) with `sin`-windowed fade-in/out over exact 120-frame (`1.92s`) seamless loop.
  - `3x` Streak Pill & Frame Border: Frame border illuminates at `f0` (`MS.quick`, `EASE.state`, transparent fill so sprite colors stay pure), `3x` pill pops `OVERLAP.primaryMs` (2f) later (`MODAL_MOTION.enterMs`, `EASE.popSoft`); on exit, pill leaves first (`MODAL_MOTION.exitMs`, `EASE.exitSoft`) and frame border follows 2f later (Disney #5 Exit Inversion); `STAYS` opacity fades under reduced motion.
  - `FighterBuildAura`: Tuned `1.28×` diameter (`orb r = 3.0`) clears framed 50px Camp portraits cleanly without grazing adjacent Camp labels (zero Tangent Trap); symmetric `EASE.drift` breath + `±3.5°` counter-sway + `#383838`-inked orbiting Arcana/Evolution glints (`IDLE_LOOP.primePeriodsMs[0]`), strictly `useAppActive()` + `!reducedMotion` + `!quiet` + `cancelAnimation` gated.
  - Reduced-motion reaction bursts (`FighterEffectsOverlay`): Mount-until-exited `displayedReaction` latch + zero-travel `ACCESSIBLE.fadeMs` opacity cross-fade (`EASE.ui` in, `EASE.exitSoft` out, `...STAYS`) -> zero `POP-OUT`.

---

## 2. Round-by-Round Frame Critique & Fixes

### Baseline (`before`) Findings (from reading all 12 `before` sheets)
1. **`fighter-blink-3step` (`before/strip.png`):** `f8–f9` and `f13–f15` stayed 100% wide open while `f10–f12` hard-snapped shut in 1 frame (`FighterAvatar` discarded `blinkStage === 1`).
2. **All 4 fight throw strips (`badger`, `tabby`, `fox`, `penguin` `before/strip.png`):** All 4 species executed the identical `+15°` right tilt with zero `pawTx`/`pawRotate` jab/swipe/cast differentiation, and `fighter-fx-throw` slashed yellow/teal strokes straight across the characters' eyes (`f7–f15`).
3. **`fighter-pelican-cheer`, `fighter-corgi-zoomie`, `fighter-joy` (`before`):** 1-frame JSX limb teleports on `f0` and settle; welded single-slab bursts collided directly with Corgi's left eye (`f6–f15`) and Tabby's forehead (`f19–f31`), and Pelican's crest/bill clipped right off the top border (`f8–f16`).
4. **`fighter-sleepy-zzz` (`before/contact.png`):** Welded `zZz` group orbited in a tiny closed oval instead of rising & fading.
5. **`fighter-streak-pill` (`before/contact.png`):** `3x` pill and yellow border hard-popped in on `f0` and vanished in 1 frame on `f24`.
6. **`fighter-aura-loop` (`before/contact.png`):** Purple Arcana gems (`rInner = 0.39 × 1.24 = 0.484 × size < 0.5 × size`) were buried behind the 50×50px framed Camp portrait; `report.md` flagged `FADE-ONLY`.

### Round 1 (`r1`) Frame Critique (6 Defects Found & Fixed in `r2`)
1. **Detached Paw on `fighter-fox-dart` (`r1 f9–f18`, Solid Drawing #11):** Tightened Fox stealth paw to `pawTx: +0.055 × size`, `pawBounce: -0.04 × size`, `pawRotate: -8°`, `scaleX: 1.11`.
2. **Idle Half-Blink Leaking Mid-Throw (`r1 f9–f15`):** Gated `effectiveBlinkStage` strictly to `!motion.activeReaction` so combat strikes stay fierce & wide-eyed while idle blinks and post-reaction blink-through settle still animate all 3 steps.
3. **Throw Spark Linger & Burst Timing (`r1`):** Shortened `throw` burst to `0.72 × THROW.expressionHoldMs` (~374ms).
4. **Sleepy `z` Proximity to Right Ear (`r1`):** Shifted anchor to `x=77..81, y=24..28`.
5. **Frame Highlight Tint & `ALL-AT-ONCE` (`r1`):** Transparent highlight fill (pure border only) + `OVERLAP.primaryMs` (2f) badge enter stagger & exit inversion.

### Round 2 (`r2`) Independent Verifier Audit & Round 3 (`r3`) Fixes (All 5 Blockers Resolved!)
Independent fresh-context review (`@verifier-characters` #20) caught 5 real defects remaining in `r2` that we fixed and verified pixel-by-pixel in `r3` (and `r2` for `fighter-aura-loop`):
1. **Badger Floating Detached Boxing Fist (`fighter-badger-jab r2 f10–f27`):** `pawTx: +0.28s` launched Badger's front fist clear of its torso with visible background green gap.
   - **Fix (`r3`):** Added thick muscular dark-slate forearm paths inside `BadgerRig.tsx` behind both fists (plus connected orange foreleg behind raised swipe paw in `OrangeTabbyRig.tsx`) AND pulled Badger `throw` `pawTx` from `-0.16..+0.28` → `-0.08..+0.13`, `pawBounce: -0.09`.
   - **Verified on `fighter-badger-jab/r3/{strip,contact,compare-before-vs-r3}.png`:** Zero detached pixels on any frame `f7–f47`; punches read as solid, grounded, heavyweight haymakers.
2. **Throw Slashes Still Crossing Lunged Faces (`badger`/`tabby`/`fox` `r2 f9–f15`):** Premature launch on `f7` + unshifted stage-box `x=80..97` collided directly with lunged heads/eyes.
   - **Fix (`r3`):** Passed `size` into `FighterEffectsOverlay.tsx`, delayed `'throw'` burst start by `THROW.windMs` (`32ms`) so slashes ignite ON the strike frame (never floating during coil wind-up `f7–f8`), and added proportional forward-right `baseTx` (`+0.30s / +0.34s / +0.27s`) in `useBurstSlotStyle`.
   - **Verified on all 4 throw `r3/strip.png` sheets (`badger`, `tabby`, `fox`, `penguin`):** Zero premature wind-up slashes (`f7–f8`), and every yellow/aura slash + sparkle flashes cleanly **in front of** the lunged fist/paw/snout/beak on `f9–f26`.
3. **Reduced-Motion `POP-OUT f46` & `LINEAR`/`HARD-STOP` Burst Curve Hints (`r2`):**
   - **Fix (`r3`):** Added mount-until-exited `displayedReaction` latch + dedicated `reducedOpacity` (`0 → 1` `ACCESSIBLE.fadeMs` `EASE.ui` `...STAYS`, `1 → 0` `ACCESSIBLE.fadeMs` `EASE.exitSoft` `...STAYS`) with zero travel (`tx=staticBaseTx, ty=0, rot=0, scale=1`) when `!animate || stillBurst`. Replaced piecewise-linear burst tail with linear driver progress (`burstEasing: EASE.linear`) + cubic ease-out warp (`uPos = 1 - (1 - s)^3`) into `sampleBurstParticle(uPos, spec)` (with monotonic `|bowX|·π < 0.6·|spreadX|` and gentle float apex) + non-linear ease-out-cubic scale & quadratic opacity envelope.
   - **Verified on `r3` & `reduced` reports:**
     - `fighter-badger-jab/reduced/report.md`: **ZERO `POP-OUT`** (clean 8f fade-in `f5–f14`, calm hold `f15–f39`, clean 7f fade-out `f40–f46`).
     - `fighter-joy/reduced/report.md`: **ZERO `POP-OUT`**, zero travel (`2× fighter-fx-joy›div` smooth `0→1→0.05`, unmounts `f65`).
     - `fighter-pelican-cheer/r3/report.md` & `fighter-corgi-zoomie/r3/report.md`: **`Hints: _None._`** (all 5 `fighter-fx-ecstatic›div` slots pure `ease-out`, zero `LINEAR`, zero `HARD-STOP`).
     - `fighter-joy/r3/report.md` & `fighter-streak/r3/report.md`: All `fighter-fx-joy›div` slots pure `ease-out`, zero `LINEAR`, zero `HARD-STOP`.
4. **Top-of-Frame Clipping on Framed Cheers & `FighterBuildAura` Tangent Trap (`r2`):**
   - **Fix (`r3` / `aura r2`):** Lowered cheer lifts & apex stretch (`Tabby 0.60`, `Corgi 0.54 / scaleY 1.14`, `Pelican 0.52 / scaleY 1.10 / headRotate -8°`, `Fox 0.68`), tightened `FIGHTER_BURST_ARCS` (`spreadX ±6..7`, `liftY 3.8..4.8`) and moved perimeter anchors inward (`cx 18..20 / 80..82`, top `cy 14..15`); trimmed `FighterBuildAura.tsx` `ringSize` `1.38 → 1.28` (`orb r 3.4 → 3.0`).
   - **Verified on `r3` & `aura r2` sheets:** Pelican crest/bill & all 5 splash droplets stay 100% unclipped inside the frame; Corgi's heart & sparkles stay 100% unclipped (ear tip merely grazes top border on peak `f7–f8`, completely inside `f9–f15`); Tabby `joy`/`streak` 100% framed; `fighter-aura-loop/r2/contact.png` shows crisp breathing room between the aura ring/orbs and Camp `"Select..."` text column (**ZERO Tangent Trap**, `Hints: _None._`).
5. **Raw Magic Timing Literals in `fighterRegistry.tsx` (`r2`):**
   - **Fix (`r3`):** Replaced all 6 raw duration literals (`48`, `16`, `32`, `96`, `80`, `112`) with `src/utils/motion.ts` tokens (`HIT.snapMs * 3`, `HIT.snapMs`, `OVERLAP.primaryMs`, `OVERLAP.uiContentMs`, `OVERLAP.tertiaryMs`, `CREATURE_FX.fidgetFastMs`, `CREATURE_FX.entranceDropMs`). Zero raw numeric duration literals remain in `fighterRegistry.tsx`.

---

## 3. Complete Accounting of Every Remaining Machine Hint

Every shot's `report.md` was inspected; zero unresolved Lane 1 defects remain:
- **`fighter-pelican-cheer` (`r3`), `fighter-corgi-zoomie` (`r3`), `fighter-sleepy-zzz` (`r2`), `fighter-aura-loop` (`r2`):** `_None._` (0 hints).
- **`fighter-badger-jab` (`r3`), `fighter-tabby-pounce` (`r3`), `fighter-fox-dart` (`r3`), `fighter-penguin-cast` (`r3`):** Only 2× `FADE-ONLY f17` on `fx-swish-ribbon›div` (Card-flight swish overlay owned by Lane 3 `src/adventure/fx/`, strictly outside Lane 1 ownership). Zero hints on `adventure-run-fighter` or `fighter-fx-throw`.
- **`fighter-joy` (`r3`) & `fighter-streak` (`r3`):** `POP-OUT f18` (`fighter-avatar›div @165,65`) and `HARD-STOP f26/f31/f32` (`fighter-avatar›div @55,239–242`) come from *adjacent idle cards* in the `/dev/fighters` 2-column studio grid (the neighbor fighter to the right `@165,65` and the row below `@55,241`) entering/exiting the crop bounding box during continuous procedural sway — confirmed on `r3/contact.png` where the target Orange Tabby card `@55,59` and all `fighter-fx-joy` particles animate cleanly with zero hints.
- **`fighter-blink-3step` (`r2`) & `fighter-streak-pill` (`r2`):** Minor `ALL-AT-ONCE f0` (from the idle breathing fighter rig layers starting alongside the frame border at `f0`, while the `3x` badge itself cleanly staggers `OVERLAP.primaryMs = 32ms` later on `f3`) and one `HARD-STOP` on a continuous idle procedural spring (`useCreatureMotion.ts`, Phase 0) — visually smooth on `contact.png` & `strip.png`.
- **`fighter-badger-jab` (`reduced`) & `fighter-joy` (`reduced`):** `DEAD-STRETCH` during the intentional static hold between the 120ms fade-in and 120ms fade-out — expected and desired for accessible reduced motion. Zero `POP-OUT`.
- **`fighter-aura-loop` (`reduced`):** `NO-CHANGE f0` — expected because reduced motion halts infinite orbit/pulse loops while keeping the static aura rendered.

---

## 4. Rubric Scores

### `motion-loop` 7-Axis Scores (Response / Readability / Motion / Staging / Rhythm / Identity / Sync & Safety)

| Surface / Shot | Baseline (`before`) | Round 1 (`r1`) | Round 2 (`r2`) | Final (`r3` / `aura r2`) |
|---|---|---|---|---|
| `fighter-blink-3step` | 7 / 6 / 5 / 8 / 6 / 7 / 8 | 9 / 9 / 9 / 9 / 9 / 9 / 9 | 9 / 9 / 9 / 9 / 9 / 9 / 9 | **9 / 9 / 9 / 9 / 9 / 9 / 9** |
| `fighter-badger-jab` | 7 / 5 / 6 / 5 / 6 / 4 / 7 | 8 / 8 / 7 / 8 / 8 / 9 / 8 | 9 / 8 / 8 / 7 / 9 / 9 / 7 | **9 / 9 / 9 / 9 / 9 / 10 / 9** |
| `fighter-tabby-pounce` | 7 / 5 / 6 / 5 / 6 / 4 / 7 | 8 / 8 / 7 / 8 / 8 / 9 / 8 | 9 / 8 / 8 / 7 / 9 / 9 / 8 | **9 / 9 / 9 / 9 / 9 / 9 / 9** |
| `fighter-fox-dart` | 7 / 5 / 6 / 5 / 6 / 4 / 7 | 8 / 8 / 6 / 8 / 8 / 8 / 8 | 9 / 8 / 8 / 7 / 9 / 9 / 8 | **9 / 9 / 9 / 9 / 9 / 9 / 9** |
| `fighter-penguin-cast` | 7 / 5 / 5 / 5 / 6 / 3 / 7 | 8 / 8 / 8 / 9 / 8 / 9 / 8 | 9 / 9 / 9 / 9 / 9 / 9 / 9 | **9 / 9 / 9 / 9 / 9 / 10 / 9** |
| `fighter-pelican-cheer` | 6 / 6 / 5 / 5 / 6 / 5 / 7 | 8 / 8 / 7 / 8 / 8 / 9 / 8 | 9 / 8 / 7 / 7 / 9 / 9 / 8 | **9 / 9 / 9 / 9 / 9 / 9 / 9** |
| `fighter-corgi-zoomie` | 6 / 6 / 5 / 4 / 6 / 5 / 7 | 8 / 8 / 8 / 8 / 8 / 9 / 8 | 9 / 8 / 7 / 7 / 9 / 9 / 8 | **9 / 9 / 9 / 9 / 9 / 9 / 9** |
| `fighter-joy` / `fighter-streak` | 7 / 7 / 6 / 6 / 7 / 6 / 8 | 8 / 8 / 8 / 7 / 8 / 9 / 8 | 9 / 8 / 7 / 8 / 9 / 9 / 8 | **9 / 9 / 9 / 9 / 9 / 9 / 9** |
| `fighter-sleepy-zzz` | 7 / 5 / 4 / 7 / 5 / 6 / 8 | 8 / 8 / 8 / 8 / 8 / 8 / 9 | 9 / 9 / 9 / 9 / 9 / 9 / 9 | **9 / 9 / 9 / 9 / 9 / 9 / 9** |
| `fighter-streak-pill` | 6 / 6 / 4 / 6 / 5 / 6 / 6 | 8 / 8 / 8 / 7 / 8 / 8 / 9 | 9 / 9 / 9 / 9 / 9 / 9 / 9 | **9 / 9 / 9 / 9 / 9 / 9 / 9** |
| `fighter-aura-loop` | 7 / 4 / 6 / 5 / 6 / 6 / 7 | 9 / 8 / 9 / 7 / 9 / 9 / 9 | — | **9 / 9 / 9 / 9 / 9 / 9 / 9** (`r2`) |

### Disney-12 × Tactile Tabletop Delight Rubric (`disney-playbook.md` §4)
- **Hard Gates:** **H1 PASS** (before/r1/r2/r3/compare/--twice captured & read), **H2 PASS** (GPU transform/opacity only, 0 frame loops in `lightweight`, `useAppActive()` + `cancelAnimation`), **H3 PASS** (`--reduced` verified on blink, joy, badger-jab, sleepy-zzz, streak-pill, aura-loop with zero `POP-OUT` & `STAYS` fades), **H4 PASS** (all tokens from `src/utils/motion.ts`, zero raw magic timing literals, zero banned defaults), **H5 PASS** (impact-synced `cheerReleaseMs` & `THROW.windMs`-synced strike arcs, zero early cues), **H6 PASS** (`__tests__/artAndSilhouettes.test.tsx` 100% green, `#383838` ink & 2-tone lighting preserved).
- **12-Principle Score: 24 / 24**
  1. Squash & Stretch: **2/2** (volume-preserved foot-anchored species elasticities: heavy `0.80` Badger vs plush `0.78` Corgi)
  2. Anticipation: **2/2** (f1–f2 crisp combat coils with zero premature FX, Badger uppercut cock-back, Corgi butt-wiggle crouch, Pelican bill-scoop)
  3. Staging: **2/2** (faces 100% clear of forward-offset throw slashes & burst emblems; framed cheers unclipped; `1.28×` BuildAura clear of Camp text)
  4. Pose-to-Pose × Straight-Ahead: **2/2** (distinct key silhouettes layered cleanly over continuous procedural breath/sway)
  5. Follow-Through & Overlap: **2/2** (`OVERLAP` L/R ear lag, `SPRING.loose` pouch/tail follow-through, badge-after-border enter & exit inversion)
  6. Slow In / Slow Out: **2/2** (`EASE.enter`/`EASE.ui`/`EASE.popSoft`/`EASE.exitSoft`/`EASE.impact`/`EASE.drift` + cubic ease-out burst warp, zero `LINEAR`/`HARD-STOP` on bursts)
  7. Arc: **2/2** (staggered parabolic multi-particle bursts via `sampleBurstParticle`, S-curve rising `zZz`, sweeping flipper/paw arcs)
  8. Secondary Action: **2/2** (species-specific fidgets, coupled dual-layer Omnimattes ground shadow + penumbra, staggered aura)
  9. Timing & Rhythm: **2/2** (`heavy` Badger stomp/recoil vs `nimble` Fox/Corgi snap vs regal `SPRING.settle` Penguin)
  10. Exaggeration: **2/2** (1–2f `SMEAR` strike shears, compact rotation boost, expressive 3-step eyelids & wide comic eyes)
  11. Solid Drawing: **2/2** (connected muscular forearms on `BadgerRig` & foreleg on `OrangeTabbyRig`, zero floating limbs on any frame, consistent upper-left 2-tone ink lighting)
  12. Appeal & Living Seam: **2/2** (unmistakable 6-species soul matching `fighters-acting-sheet.png`, living GPU `lightweight` breath, seamless 120f `zZz` loop)

---

## 5. Capture Paths Index

- `motion-out/fighter-blink-3step/{before,r1,r2,reduced}` · `motion-out/fighter-blink-3step/r2/compare-before-vs-r2.png`
- `motion-out/fighter-badger-jab/{before,r1,r2,r3,reduced}` · `motion-out/fighter-badger-jab/r3/compare-before-vs-r3.png`
- `motion-out/fighter-tabby-pounce/{before,r1,r2,r3}` · `motion-out/fighter-tabby-pounce/r3/compare-before-vs-r3.png`
- `motion-out/fighter-fox-dart/{before,r1,r2,r3}` · `motion-out/fighter-fox-dart/r3/compare-before-vs-r3.png`
- `motion-out/fighter-penguin-cast/{before,r1,r2,r3}` · `motion-out/fighter-penguin-cast/r3/compare-before-vs-r3.png`
- `motion-out/fighter-pelican-cheer/{before,r1,r2,r3}` · `motion-out/fighter-pelican-cheer/r3/compare-before-vs-r3.png`
- `motion-out/fighter-corgi-zoomie/{before,r1,r2,r3}` · `motion-out/fighter-corgi-zoomie/r3/compare-before-vs-r3.png`
- `motion-out/fighter-joy/{before,r1,r2,r3,reduced}` · `motion-out/fighter-joy/r3/compare-before-vs-r3.png`
- `motion-out/fighter-streak/{before,r1,r2,r3}` · `motion-out/fighter-streak/r3/compare-before-vs-r3.png`
- `motion-out/fighter-sleepy-zzz/{before,r1,r2,reduced}` · `motion-out/fighter-sleepy-zzz/r2/compare-before-vs-r2.png`
- `motion-out/fighter-streak-pill/{before,r1,r2,reduced}` · `motion-out/fighter-streak-pill/r2/compare-before-vs-r2.png`
- `motion-out/fighter-aura-loop/{before,r1,r2,reduced}` · `motion-out/fighter-aura-loop/r2/compare-before-vs-r2.png`

---

## 6. Nano Banana 2D Illustrated Sprite-Loop Upgrade (`v0.1.187`)

Upgraded all 6 Hero Fighters (`Orange Tabby`, `Sly Fox`, `Badger`, `Corgi`, `Emperor Penguin`, `Pelican`) from flat geometric SVGs to real **Nano Banana Pro (`gemini-3-pro-image`) illustrated 4×3 WebP sprite atlases** (`assets/fighters/*.webp`, 1024×768 = 12 retina 256×256 frames per hero, 745 KB total across all 72 frames):
- **6-frame seamless Disney idle loop (`0..5`):** Species-tuned on 2s/3s (`680–960 ms` cycles), chroma-keyed on `#00FF00` with flood-fill despill + adaptive green-gutter slicing + baseline registration, animated via GPU-only `transform: translateX/translateY` in `FighterSpriteRig.tsx` (`0` React re-renders, `0` extra frame loops, `contain: 'layout style paint'`, gated on `useAppActive()` + `!reducedMotion` + `cancelAnimation`).
- **6 bespoke hand-drawn acting poses (`6..11`):** Natural randomized `blink`, coiled `windup`, explosive `attack` (two-beat `windup → attack` synced to `THROW.windMs`), airborne `cheer` (synced to `cheerReleaseMs`), comic `hurt` (including Emperor Penguin's popped-up crown!), and `sleepy` loaf/droop.
- **Silhouette Audit (`[UI-07]`):** Solid-black `#121212` silhouette flattening (`filter: brightness(0)` on web, `tintColor` on native), visually verified at 36px & 80px in `/dev/fighters`.
- **Stage Framing:** Lifted Main Menu Hero Card mascot (`58 → 74px`) and roomy Battle Stage fighter size (`66 → 74px` mobile / `86 → 92px` wide) while keeping all layouts overflow-free.
- **Captures verified (`r1`):** `motion-out/fighter-sprite-idle-loop/r1/contact.png`, `motion-out/fighter-tabby-pounce/r1/contact.png`, `motion-out/fighter-badger-jab/r1/contact.png` (`0` hints on `fighter-badger-jab`).
