# Motion Review — Lane 1 (`lane-fighters`): Hero Fighters Acting, Blinks, Effects & Build Auras

**Branch:** `swarm-lane-fighters-022d7775` · **Base:** `9b27228` (Phase 0 Foundation)  
**Target Reference:** `scratch/nano-banana/sheets/fighters-acting-sheet.png`, `scratch/disney-playbook.md` (§2.1A, §4), `style_guide.md`  
**Dev Server Port:** `http://localhost:8101` (dedicated lane server; terminated after verification)

---

## 1. Motion Briefs (Written Before Code, Verified Against `r2` Captures)

### Surface A — 3-Step Organic Upper-Eyelid Blink (`fighter-blink-3step`)
- **Goal:** Replace 1-frame snap-blinks with an organic 3-step upper-eyelid sweep (`0 open → 1 heavy half-lid droop → 2 full shut arc → 1 opening half-lid → 0 open`) matching `useCreatureMotion`'s deterministic `BLINK` (`32ms → 48ms → 48ms`) cadence.
- **Hero:** Eyes & upper eyelids (`HalfBlinkLidEye` / `ShutBlinkEye` with species-matched `lidFill`).
- **Poses:** `f0–f7` open → `f8–f9` half-lid closing → `f10–f12` shut arc → `f13–f15` half-lid opening → `f16+` open.
- **Banned:** Boolean snap `blinkStage === 2`, drowsy idle half-blinks leaking into active combat attacks, unseeded `Math.random()`.
- **Reduced Motion:** `animate={false}`, zero blink/idle loop motion, calm open resting face.

### Surface B — 6 Species-Specific Acting Signatures (`fighter-badger-jab`, `fighter-tabby-pounce`, `fighter-fox-dart`, `fighter-penguin-cast`, `fighter-pelican-cheer`, `fighter-corgi-zoomie`, `fighter-joy`, `fighter-streak`)
- **Goal:** Give all 6 Hero Fighters distinct silhouettes, mass classes, fidgets, Set-launch attacks (`throw`), and celebrations (`joy` / `ecstatic`) with zero 1-frame JSX limb teleports.
- **Species Contracts (`fighterRegistry.tsx`):**
  - **Orange Tabby (`standard`):** Deep pounce-crouch (`0.84`) → high-paw diagonal swipe (`pawTx +0.22s`, `pawBounce -0.20s`, `pawRotate -34°`) + 2f strike smear (`SMEAR.strikeSkewDeg`); springy vertical cat-hop cheer; arched cat-stretch & alternating L→R ear flick fidgets.
  - **Sly Fox (`nimble`):** Razor-low horizontal rogue dart (`lungeTx × 1.25`, `bodyRotate +18°`, tucked stealth paws `pawTx +0.055s`, flame-tail whip `-34°`); cocky tilt-wink hop; low sly head-dip & brush-tail flick fidgets.
  - **Badger (`heavy`):** Grounded rear uppercut cock-back (`scaleY 0.80`, `-12°`, `pawTx -0.16s`) → heavy haymaker cross jab (`+17°`, `pawTx +0.28s`, `pawRotate -28°`, `1.5×` recoil, `SPRING.heavy`); low grounded fist-pump stomp cheer (`0.44×` lift + stomp push into shadow); boxer shoulder-weave fidget.
  - **Corgi (`nimble`):** Plush butt-wiggle crouch (`0.78`, `±7°` wiggle, frantic `±36°` nub-tail blur) → exuberant zoomie sploot bounce with splayed radar ears (`-22° / +24°`); asymmetric radar-ear swivel & double paw-patter fidgets.
  - **Emperor Penguin (`standard` regal):** Tall upright draw-up (`scaleY 1.06`, never hunches) → sweeping casting flipper (`-34° → +24°`) & mystic halo flare (`+42°`, `SPRING.settle`); dignified bow-bob cheer; noble chin-lift & flipper-fold fidgets.
  - **Pelican (`standard` loose):** Bill-scoop pullback (`-15°`) → forward pouch-heave sling (`headRotate +14°`, lagging `SPRING.loose` gular pouch heave); 2-beat coastal wing-flap cheer (`+54°` skyward wings); pouch gulp & crest-ruffle fidgets.
- **Banned:** Identical generic right-tilt across species, 1-frame JSX cheering limb swaps, throw slash lines drawn over faces, welded single-slab burst stickers, `EASE.linear` on burst travel.

### Surface C — Living Lightweight Breath, Sleepy `zZz`, Framed Streak Pill & Build Aura (`fighter-sleepy-zzz`, `fighter-streak-pill`, `fighter-aura-loop`)
- **Goal:** Eliminate static closed-oval `zZz`, hard-pop `3x` streak badges, muddied frame tinting, and hidden Arcana build aura gems; add battery-safe GPU-only `lightweight` breathing (`0` frame loops) to `FighterAvatar`.
- **Motion:**
  - `zZz`: 3 staggered rising S-curve letters (`0`, `1/3`, `2/3` phase) with `sin`-windowed fade-in/out over exact 120-frame (`1.92s`) seamless loop.
  - `3x` Streak Pill & Frame Border: Frame border illuminates at `f0` (`MS.quick`, `EASE.state`, transparent fill so sprite colors stay pure), `3x` pill pops `OVERLAP.primaryMs` (2f) later (`MODAL_MOTION.enterMs`, `EASE.popSoft`); on exit, pill leaves first (`MODAL_MOTION.exitMs`, `EASE.exitSoft`) and frame border follows 2f later (Disney #5 Exit Inversion); `STAYS` opacity fades under reduced motion.
  - `FighterBuildAura`: Expanded `1.38×` diameter clears both bare fighters and framed Camp portraits; symmetric `EASE.drift` breath + `±3.5°` counter-sway + `#383838`-inked orbiting Arcana/Evolution glints (`IDLE_LOOP.primePeriodsMs[0]`), strictly `useAppActive()` + `!reducedMotion` + `!quiet` + `cancelAnimation` gated.

---

## 2. Round-by-Round Frame Critique & Fixes

### Baseline (`before`) Findings (from reading all 12 `before` sheets)
1. **`fighter-blink-3step` (`before/strip.png`):** `f8–f9` and `f13–f15` stayed 100% wide open while `f10–f12` hard-snapped shut in 1 frame (`FighterAvatar` discarded `blinkStage === 1`).
2. **All 4 fight throw strips (`badger`, `tabby`, `fox`, `penguin` `before/strip.png`):** All 4 species executed the identical `+15°` right tilt with zero `pawTx`/`pawRotate` jab/swipe/cast differentiation, and `fighter-fx-throw` slashed yellow/teal strokes straight across the characters' eyes (`f7–f15`).
3. **`fighter-pelican-cheer`, `fighter-corgi-zoomie`, `fighter-joy` (`before`):** 1-frame JSX limb teleports on `f0` and settle; welded single-slab bursts collided directly with Corgi's left eye (`f6–f15`) and Tabby's forehead (`f19–f31`).
4. **`fighter-sleepy-zzz` (`before/contact.png`):** Welded `zZz` group orbited in a tiny closed oval instead of rising & fading.
5. **`fighter-streak-pill` (`before/contact.png`):** `3x` pill and yellow border hard-popped in on `f0` and vanished in 1 frame on `f24`.
6. **`fighter-aura-loop` (`before/contact.png`):** Purple Arcana gems (`rInner = 0.39 × 1.24 = 0.484 × size < 0.5 × size`) were buried behind the 50×50px framed Camp portrait; `report.md` flagged `FADE-ONLY`.

### Round 1 (`r1`) Honest Frame Critique (6 Defects Found on `r1` Compare Sheets!)
1. **Detached Paw on `fighter-fox-dart` (`r1 f9–f18`, Solid Drawing #11):** `pawTx: +0.18 × size` combined with `+18°` body tilt and `1.16` horizontal scale pushed Fox's dark stealth paw ~4px in front of its chest. **Fix for `r2`:** Tightened to `pawTx: +0.055 × size`, `pawBounce: -0.04 × size`, `pawRotate: -8°`, `scaleX: 1.11`.
2. **Idle Half-Blink Leaking Mid-Throw (`badger r1 f12`, `tabby r1 f15`, `fox r1 f12`, `penguin r1 f9, f15`):** `effectiveBlinkStage` allowed `motion.blinkStage === 1` during active `'throw'`, making heroes look drowsy mid-punch. **Fix for `r2`:** Gate `blinkStage` strictly to `!motion.activeReaction` so combat strikes stay fierce & wide-eyed while idle blinks and post-reaction blink-through settle still animate all 3 steps.
3. **`LINEAR` Hints on Burst Particles (`fighter-badger-jab r1 f8`, `fighter-pelican-cheer r1 f45`):** Passing `burstEasing: EASE.linear` caused machine-detected `LINEAR` travel on horizontal particle arcs, and `throw` sparks lingered past arm recovery (`f24–f33`). **Fix for `r2`:** Use `useEffectsDriver`'s default `EASE.ui` (ease-out cubic) and shorten `throw` burst to `0.72 × THROW.expressionHoldMs` (~374ms).
4. **Outer Burst & Apex Ear Clipping (`fighter-joy`, `fighter-streak`, `fighter-corgi-zoomie`, `fighter-pelican-cheer` `r1`):** `FIGHTER_BURST_ARCS` spread (`±14..21px`) clipped outermost hearts at portrait borders, and `1.12–1.18×` jump lift grazed the top card edge on Tabby/Corgi/Pelican. **Fix for `r2`:** Tightened `FIGHTER_BURST_ARCS` (`±9..12px`, `liftY 9..13px`) and tuned cheer lift (`0.96×` Tabby, `0.94×` Corgi, `0.86×` Pelican) so ears and parabolic hearts stay 100% framed.
5. **Sleepy `z` Proximity to Right Ear (`fighter-sleepy-zzz r1`):** Small `z` started at `x=72, y=32` close to Tabby's right ear tip. **Fix for `r2`:** Shifted anchor to `x=77..81, y=24..28` so all 3 rising letters read clearly across the full 120-frame loop.
6. **Frame Highlight Tint & `ALL-AT-ONCE` (`fighter-streak-pill r1`):** Translucent yellow fill (`rgba(255,222,0,0.14)`) sat over the rig and subtly tinted Tabby's orange coat, and border + badge started on the same frame. **Fix for `r2`:** Transparent highlight fill (pure crisp animated border only) + `OVERLAP.primaryMs` (2f) badge stagger on enter (`f3`) and 2f frame lag on exit (`f33`, badge exits first at `f31`).

### Round 2 (`r2`) Verification Verdict
- **`fighter-blink-3step` (`r2 --twice`):** `repeatable: a second capture matched (measured positions within 0 px)`. `f8–f9` half-lid droop, `f10–f12` shut arc, `f13–f15` opening half-lid sweep — crystal clear on compare sheet.
- **`fighter-badger-jab` (`r2 --twice`), `fighter-tabby-pounce`, `fighter-fox-dart`, `fighter-penguin-cast`:** All 4 throw arcs read as unmistakably different characters, zero detached paws, zero mid-strike blinks, zero `LINEAR` hints (`moves 16px on an arc, ease-out`), repeatable to the eye (`--twice`), throw sparks strictly clear of faces.
- **`fighter-pelican-cheer`, `fighter-corgi-zoomie`, `fighter-joy`, `fighter-streak`:** Zero 1-frame JSX limb teleports, zero face-covering burst hearts, crisp parabolic fan-outs inside portrait bounds, distinct species acting on every cheer.
- **`fighter-sleepy-zzz` (`r2`):** Smooth rising S-curve 3-letter stream, `Hints: None`.
- **`fighter-streak-pill` (`r2` & `reduced`):** Un-tinted sprite colors, crisp overlapping-action enter (`f0` border → `f3` badge) and inverted exit (`f24→f31` badge → `f33` border); `--reduced` shows clean `STAYS` opacity fades only.
- **`fighter-aura-loop` (`r1` & `reduced`):** Vivid `#383838`-inked Arcana orbs orbit clearly outside the framed portrait, `Hints: None`; `--reduced` renders crisp static aura with 0 movement.
- **Note on Remaining Machine Hints Checked Against Strips:**
  - `fight-throw` shots show `FADE-ONLY` on `fx-swish-ribbon` (owned by Lane 3 `src/adventure/fx/`, outside Lane 1 scope).
  - `fighter-blink-3step` / `fighter-streak-pill` show a minor `HARD-STOP` on an idle neighbor layer in the continuous procedural second-order solver (`useCreatureMotion.ts`, Phase 0), visually smooth on the strip (`f0–f23`).

---

## 3. Rubric Scores

### `motion-loop` 7-Axis Scores (Response / Readability / Motion / Staging / Rhythm / Identity / Sync & Safety)

| Surface / Shot | Baseline (`before`) | Round 1 (`r1`) | Final (`r2`) |
|---|---|---|---|
| `fighter-blink-3step` | 7 / 6 / 5 / 8 / 6 / 7 / 8 | 9 / 9 / 9 / 9 / 9 / 9 / 9 | **9 / 9 / 9 / 9 / 9 / 9 / 9** |
| `fighter-badger-jab` | 7 / 5 / 6 / 5 / 6 / 4 / 7 | 8 / 8 / 7 / 8 / 8 / 9 / 8 | **9 / 9 / 9 / 9 / 9 / 9 / 9** |
| `fighter-tabby-pounce` | 7 / 5 / 6 / 5 / 6 / 4 / 7 | 8 / 8 / 7 / 8 / 8 / 9 / 8 | **9 / 9 / 9 / 9 / 9 / 9 / 9** |
| `fighter-fox-dart` | 7 / 5 / 6 / 5 / 6 / 4 / 7 | 8 / 8 / 6 / 8 / 8 / 8 / 8 | **9 / 9 / 9 / 9 / 9 / 9 / 9** |
| `fighter-penguin-cast` | 7 / 5 / 5 / 5 / 6 / 3 / 7 | 8 / 8 / 8 / 9 / 8 / 9 / 8 | **9 / 9 / 9 / 9 / 9 / 9 / 9** |
| `fighter-pelican-cheer` | 6 / 6 / 5 / 5 / 6 / 5 / 7 | 8 / 8 / 7 / 8 / 8 / 9 / 8 | **9 / 9 / 8 / 9 / 9 / 9 / 9** |
| `fighter-corgi-zoomie` | 6 / 6 / 5 / 4 / 6 / 5 / 7 | 8 / 8 / 8 / 8 / 8 / 9 / 8 | **9 / 9 / 9 / 9 / 9 / 9 / 9** |
| `fighter-joy` / `fighter-streak` | 7 / 7 / 6 / 6 / 7 / 6 / 8 | 8 / 8 / 8 / 7 / 8 / 9 / 8 | **9 / 9 / 9 / 9 / 9 / 9 / 9** |
| `fighter-sleepy-zzz` | 7 / 5 / 4 / 7 / 5 / 6 / 8 | 8 / 8 / 8 / 8 / 8 / 8 / 9 | **9 / 9 / 9 / 9 / 9 / 9 / 9** |
| `fighter-streak-pill` | 6 / 6 / 4 / 6 / 5 / 6 / 6 | 8 / 8 / 8 / 7 / 8 / 8 / 9 | **9 / 9 / 9 / 9 / 9 / 9 / 9** |
| `fighter-aura-loop` | 7 / 4 / 6 / 5 / 6 / 6 / 7 | 9 / 9 / 9 / 9 / 9 / 9 / 9 | **9 / 9 / 9 / 9 / 9 / 9 / 9** |

### Disney-12 × Tactile Tabletop Delight Rubric (`disney-playbook.md` §4)
- **Hard Gates:** **H1 PASS** (before/r1/r2/compare/--twice captured & read), **H2 PASS** (GPU transform/opacity only, 0 frame loops in `lightweight`, `useAppActive()` + `cancelAnimation`), **H3 PASS** (`--reduced` verified on blink, joy, badger-jab, sleepy-zzz, streak-pill, aura-loop with `STAYS` fades), **H4 PASS** (all tokens from `src/utils/motion.ts`, zero magic easings, zero banned defaults), **H5 PASS** (impact-synced `cheerReleaseMs`, zero early cues), **H6 PASS** (`__tests__/artAndSilhouettes.test.tsx` 100% green, `#383838` ink & 2-tone lighting preserved).
- **12-Principle Score: 23 / 24**
  1. Squash & Stretch: **2/2** (volume-preserved foot-anchored species elasticities: heavy `0.80` Badger vs plush `0.78/1.22` Corgi)
  2. Anticipation: **2/2** (f1–f2 crisp combat coils, Badger uppercut cock-back, Corgi butt-wiggle crouch, Pelican bill-scoop)
  3. Staging: **2/2** (faces 100% clear of throw swooshes & burst hearts; Arcana orbs cleanly frame portraits)
  4. Pose-to-Pose × Straight-Ahead: **2/2** (distinct key silhouettes layered cleanly over continuous procedural breath/sway)
  5. Follow-Through & Overlap: **2/2** (`OVERLAP` L/R ear lag, `SPRING.loose` pouch/tail follow-through, badge-after-border enter & exit inversion)
  6. Slow In / Slow Out: **2/2** (`EASE.enter`/`EASE.ui`/`EASE.popSoft`/`EASE.exitSoft`/`EASE.impact`/`EASE.drift`, zero `LINEAR` on position)
  7. Arc: **2/2** (staggered parabolic multi-particle bursts via `sampleBurstParticle`, S-curve rising `zZz`, sweeping flipper/paw arcs)
  8. Secondary Action: **2/2** (species-specific fidgets, coupled dual-layer Omnimattes ground shadow + penumbra, staggered aura)
  9. Timing & Rhythm: **2/2** (`heavy` Badger stomp/recoil vs `nimble` Fox/Corgi snap vs regal `SPRING.settle` Penguin)
  10. Exaggeration: **2/2** (1–2f `SMEAR` strike shears, compact rotation boost, expressive 3-step eyelids & wide comic eyes)
  11. Solid Drawing: **1/2** (anatomical joints & tucked paws fixed in `r2`, consistent upper-left light; minor continuous spring settle hint on idle neighbor)
  12. Appeal & Living Seam: **2/2** (unmistakable 6-species soul matching `fighters-acting-sheet.png`, living GPU `lightweight` breath, seamless 120f `zZz` loop)

---

## 4. Capture Paths Index

- `motion-out/fighter-blink-3step/{before,r1,r2,reduced}` · `motion-out/fighter-blink-3step/r2/compare-before-vs-r2.png`
- `motion-out/fighter-badger-jab/{before,r1,r2,reduced}` · `motion-out/fighter-badger-jab/r2/compare-before-vs-r2.png`
- `motion-out/fighter-tabby-pounce/{before,r1,r2}` · `motion-out/fighter-tabby-pounce/r2/compare-before-vs-r2.png`
- `motion-out/fighter-fox-dart/{before,r1,r2}` · `motion-out/fighter-fox-dart/r2/compare-before-vs-r2.png`
- `motion-out/fighter-penguin-cast/{before,r1,r2}` · `motion-out/fighter-penguin-cast/r2/compare-before-vs-r2.png`
- `motion-out/fighter-pelican-cheer/{before,r1,r2}` · `motion-out/fighter-pelican-cheer/r2/compare-before-vs-r2.png`
- `motion-out/fighter-corgi-zoomie/{before,r1,r2}` · `motion-out/fighter-corgi-zoomie/r2/compare-before-vs-r2.png`
- `motion-out/fighter-joy/{before,r1,r2,reduced}` · `motion-out/fighter-joy/r2/compare-before-vs-r2.png`
- `motion-out/fighter-streak/{before,r1,r2}` · `motion-out/fighter-streak/r2/compare-before-vs-r2.png`
- `motion-out/fighter-sleepy-zzz/{before,r1,r2,reduced}` · `motion-out/fighter-sleepy-zzz/r2/compare-before-vs-r2.png`
- `motion-out/fighter-streak-pill/{before,r1,r2,reduced}` · `motion-out/fighter-streak-pill/r2/compare-before-vs-r2.png`
- `motion-out/fighter-aura-loop/{before,r1,reduced}` · `motion-out/fighter-aura-loop/r1/compare-before-vs-r1.png`
