# Motion Review Log — Lane 4 (`lane-menu-map-camp`)

**Scope:** `MainMenu`, `AdventureMap`, `Camp`, `SkillTree`, `StoryIntro`, `StoryEndingModal`, `FriendRescueModal`, `DefeatOverlay`, `CompanionBubble` (incl. `LivingBreath`), `BountyBoard`, `BattleHistory`, `MechanicIntro`, `HighlightStageModal`, `DifficultySelection`, shared `ScreenTransition` / `useModalMotion`, and modals (`SettingsSheet`, `KeybindingSheet`, `KeywordTooltip`, `RoundFunPrompt`, `Notification`, `RewardReveal`).  
**Base commit:** `9b27228` · **Worktree branch:** `swarm-lane-menu-map-camp-63a6ef63` · **Shot file:** `scripts/motion/shots/menu-camp.mjs` (+ shared `friend-rescue`).  
**Asset added (strict ownership):** `assets/backdrops/story-ending-plate.png` only (5 biome battle backdrops owned by Lane 3 untouched).

---

## 1. Motion Brief & Craft Architecture

1. **Zero Hard Cuts (`ScreenTransition.tsx`, `Game.tsx`, `AdventureMode.tsx`, `Camp.tsx`):**
   - Directional screen transitions (`MS.screen = 220ms`, `exitMs(MS.screen) = 145ms`, `EASE.enter` / `EASE.exitSoft`) across MainMenu ↔ Adventure ↔ Spire ↔ Prism ↔ FreePlay and across Adventure subviews (Map ↔ Camp ↔ SkillTree ↔ Fight).
   - Shared `useModalMotion(visible, { travelY, sheet, instant })` implements Disney-12 `MODAL_MOTION`: independent backdrop fade (`backdropEnterMs` / `backdropExitMs`), panel slide/scale (`EASE.enter` / `EASE.exitSoft`), content lagging enter by `OVERLAP.uiContentMs` (`48ms`) and leading exit by `OVERLAP.exitContentLeadMs` (`48ms`), clean unmount only after opacity reaches `0`, and `STAYS` reduced-motion crossfade with zero travel.
2. **Zero-Frame-Loop Living Portraits (`LivingBreath` in `CompanionBubble.tsx`):**
   - GPU-only volume-preserving breath (`scaleY = 1 + b * amp`, `scaleX = (1 / scaleY)^0.85`, foot-contact anchor `size * 0.35`, subtle chest rise `<= 2.2px`), gated on `useAppActive()` & `!useReducedMotion()`, cleaned up with `cancelAnimation`.
   - Deterministic hashed periods (`2204–3480ms` derived from `IDLE_LOOP.primePeriodsMs[0]`) and immediate-start hashed initial phase (`[-0.35, 0.85]`) so portraits are alive on frame 0 and siblings never breathe in lockstep — **0 extra frame loops** added to `MainMenu`, 60-node `AdventureMap`, `StoryEndingModal`, `DefeatOverlay`, `FriendRescueModal`, `SkillTree`, or `CompanionBubble`.
3. **Tabletop Storybook Tactility & Physical Arcs:**
   - `MainMenu`: choreographed title → hero → shelf entrance; non-nested `main-menu-mascot-tap` Pressable with `SCALE.reward` hop, golden ring burst, companion swap, and `'pet'` reaction; hero CTA `SCALE.press` + `+3px` ledge push + eager mascot lean; `tabular-nums`.
   - `StoryEndingModal`: Beat 2 Reunion integrates `assets/backdrops/story-ending-plate.png` with storybook diorama settle (`1.08 → 1.0`, `EASE.enterSoft`), all 6 rescued friends landing on the hillside grass in a staggered volume-preserving squash-land wave + `LivingBreath` + dark-ink name pills; Beat 1 Hydra & Beat 3 Champion unfrozen.
   - `FriendRescueModal`: unfrozen Phase 1 caged pickers (`LivingBreath` + eager select lean + staggered `PopIn`); Phase 2 Golden Key curved `sampleArcPoint` glide, brass padlock tension wiggle, forged iron cage halves launched on true parabolic gravity arcs (`sampleJumpArcY` + tumble), anticipation crouch + volume-preserving leap (`volumeScale`), and `"UNLOCKING CAGE…"` upward tuck before `"RESCUED!"` rises.
   - `AdventureMap`: phase- and period-staggered `<Bob>` on frontier node (`phase=0, periodMs=1400`), fighter marker (`phase=0.78π, periodMs=1540`), and ready Golden Key (`phase=1.32π, periodMs=1320`); fixed `secret-path-reveal` reduced-motion visibility/dismissal; GPU `scaleX` `WorldProgressBar`; synchronous initial scroll on `onContentSizeChange` (eliminating the `120ms` return jump).
   - `SkillTree`, `Camp`, Lessons & Modals: SkillTree purchase triggers delayed golden shockwave burst + `SCALE.reward` `SPRING.playful` pop + animated golden `AnimatedLinkBeam` draw-on + `useModalMotion` detail sheet; Camp wraps hub ↔ sections in a solid walnut root (zero white flash) with staggered Workshop/Armory/Arcana cards (`STAGGER.cap`), `AnimatedPip` fill pop, `AnimatedBeltSlot` equip pop + golden ring burst, and `geometricShakeKeyframes(10, 4, SHAKE.decay, -1)` slots-full refusal shake; `BountyBoard`, `BattleHistory`, `MechanicIntro`, `StoryIntro`, `SettingsSheet`, `KeybindingSheet`, `KeywordTooltip` (fixed module-load `SCREEN_HEIGHT` via `useWindowDimensions()`), `RoundFunPrompt`, `Notification`, `RewardReveal`, `HighlightStageModal`, and `DifficultySelection` all upgraded to tokenized Reanimated enter/exit choreography.

---

## 2. Iterative Frame Review (`before` → `r1` → `r2` → `r3`)

Every shot was captured on dedicated Expo web port `8104` via `npm run motion:capture -- <shot> --label <before|r1|r2|r3|reduced> --base http://localhost:8104` and inspected frame-by-frame on `contact.png`, `strip.png`, `compare-before-vs-*.png`, and `report.md`.

### Round 1 → Round 2 Fixes (from real `r1` strip & compare reads)
| Shot | Defect Observed on `r1` Frames | Concrete Fix Applied for `r2` | Verified Result on `r2` |
|---|---|---|---|
| `camp-open` | `f10` showed a crisp white flash between Camp hub exit (`f9`) and Workshop entry (`f11`) because the transparent `useScreenTransition` wrapper sat over the white page background. | Wrapped Camp in a non-fading walnut tabletop `<View style={st.root}>` behind the transitioning inner layer. | Zero white flash on `f10`; warm walnut cross-slide (`f1→f12`) followed by Workshop card waterfall (`f12→f17`). |
| `settings-sheet-toggle` | On close (`f20→f36`), panel faded `1→0.12` then popped off (`POP-OUT f35`), and `r1` had an unnecessary dead gap before exit began. | Tuned `useModalMotion` exit fade (`linear` reach `0` before unmount timeout) + content leads exit by `OVERLAP.exitContentLeadMs` (`48ms`). | Smooth enter (`f1→f16`) & smooth content-first exit (`f21→f38`, reaches `opacity 0` before unmount `f39`), **0 hints** on `r2` (except intentional wait between open at `f0` and close tap at `f20`). |
| `friend-rescue` | `r1` cage halves moved linearly (`LINEAR f31`), `"UNLOCKING CAGE…"` popped out (`FADE-ONLY`), and rescue header sat dead briefly (`DEAD-STRETCH`). | Replaced linear cage slide with `EASE.enterSoft` parabolic `sampleJumpArcY` + gravity drop + `±38°` tumble; added upward tuck + fade on `"UNLOCKING CAGE…"`; tightened cue timing to `MS`/`OVERLAP` tokens. | Cage halves trace `99px` parabolic arc bowing `35px`; **0 `LINEAR`**, **0 `DEAD-STRETCH`**, **0 `FADE-ONLY`** on `r2`! |
| `story-ending-alive` | Beat 2 crew portraits initially faded straight in (`FADE-ONLY`) without celebratory bounce, and labels had low contrast against sunlit meadow grass. | Added staggered volume-preserving squash-land hops (`EASE.popSoft` + `SPRING.playful`) per friend, subtle diorama zoom settle (`1.08→1.0`), and dark-ink pill badges. | Staggered crew wave lands on hillside (`f3→f24`), diorama settles softly (`f0→f16`), **0 StoryEndingModal hints**. |
| `skill-node-buy` | `r1` detail sheet exited concurrently with node burst so the modal masked the burst start. | Delayed node burst & `AnimatedLinkBeam` draw-on by `OVERLAP.primaryMs` (`32ms`) while `useModalMotion` leads content exit (`48ms`) before sheet collapse. | Clean sheet exit (`f0→f19`), golden link beam draws parent→node (`f3→f39`), burst ring expands (`f3→f28`), GPU `scaleX` capacity bar slides (`f1→f13`), `--twice` `0.1px` repeatable. |
| `menu-mascot-tap`, `camp-equip-pop`, `camp-slots-full` | `r1` full-viewport crops made small hero pops/shakes harder to inspect pixel-by-pixel. | Added tight element clips (`menu-hero-stage`, `camp-charm-slots`, `camp-belt-zone`) for `r2` inspection. | `menu-mascot-tap` responds on `f0` (`0ms`) with golden burst + Sly Fox hop; `camp-equip-pop` pops belt slot `1→1.18→1` + gold ring; `camp-slots-full` triggers crisp 7-reversal `±10px` geometric refusal shake. |

### Round 2 → Round 3 Fixes (from real `r2` reads & H4 audit)
| Shot / Audit | Defect Observed on `r2` Frames | Concrete Fix Applied for `r3` | Verified Result on `r3` |
|---|---|---|---|
| `menu-foe-breath` | `NO-CHANGE f0`! `LivingBreath` hashed into `IDLE_LOOP.primePeriodsMs[4]` (`11300ms`) with a `~3000ms` startup `withDelay`, leaving Sleepy Bunny frozen for the entire 1.85s window. | Derived organic living-portrait period `2204–3480ms` from `IDLE_LOOP.primePeriodsMs[0]` and replaced startup `withDelay` with immediate-start hashed phase (`[-0.35, 0.85]`) + symmetrical exhale/inhale (`-0.5 ↔ +1.0`) + buoyant ribcage volume preservation. | Active **89/90 frames (`f1→f89`)**, visible organic breath cycle on `contact.png`, **`Hints: _None._`**, **`--twice` `0 px` diff**, `--reduced` completely still (`0 px`). |
| `map-bob-stagger` | `before:1-5` save fired an unrevealed `1-4D` secret-path autoscroll (`JUMP f36`, `204px`) right in the middle of the bob loop capture. | Switched shot save to `mapPath('before:2-3')` (`ready: h.until('map-node-2-3')`, `prepare: h.advance(600)`). | Active **71/72 frames (`f1→f71`)**, ZERO jump, **`Hints: _None._`**, plus cleanly captures the `SECRET PATH!` arrival (`f51→f69`, `weaponGet: f50.2`) and its `--reduced` fade-out (`f62→f68`). |
| Hard Gate H4 Audit | Grep across touched `src/**` found 13 legacy/raw numeric timing literals in `AdventureMap.tsx` (`1100`, `60`), `CompanionBubble.tsx` (`72`), `StoryEndingModal.tsx` (`180`), and `StoryIntro.tsx` (`48`, `40`, `80`, `340`, `360`). | Replaced every single literal with named tokens (`MS`, `OVERLAP`, `STAGGER`, `CREATURE_FX`, `HIT`). | **H4 audit: 0 raw timing literals** across all 23 touched `src/` files. |

---

## 3. Capture Matrix, Determinism & Machine-Hint Accounting

| Shot | Final Label | Hints on Final Capture | `--twice` Determinism | `--reduced` Parity |
|---|---|---|---|---|
| `menu-open` | `r1` | _None_ | — | Covered via `menu-to-adventure/reduced` |
| `menu-to-adventure` | `r1` | _None_ | — | Clean `12f` opacity crossfade (`f0→f12`), 0 travel, 0 `POP-OUT` |
| `menu-mascot-tap` | `r2` | _None_ (response `f0`, `0ms`) | — | Static swap (`0` hop) |
| `menu-foe-breath` | `r3` | **_None_** (89/90 active frames) | **0 px max diff, 0 px pos** | **0 px change** (`LivingBreath` off) |
| `map-open` | `r1` | _None_ (120ms scroll jump eliminated!) | — | Clean crossfade |
| `map-bob-stagger` | `r3` | **_None_** (71/72 active frames) | Positions matched (rastering only on `f51` trail) | **0 `<Bob>` movers**; `secret-path-reveal` fades `1→0` (`f62→f68`) |
| `camp-open` | `r2` | _None_ (zero white flash on `f10`) | — | Clean walnut crossfade (`f0→f12`) + gentle card fade, 0 `POP-OUT` |
| `camp-equip-pop` | `r2` | _None_ | — | Crisp state swap |
| `camp-slots-full` | `r2` | _None_ (7-reversal geometric shake) | — | No shake under reduced motion |
| `skill-tree-open` | `r2` | _None_ | — | Clean crossfade |
| `skill-node-buy` | `r2` | 1 benign backdrop `FADE-ONLY` (modal scrim) | **0.1 px repeatable** | Clean `8f` opacity exit (`f0→f8`, unmounts `f10`) + soft gold glow, 0 `POP-OUT` |
| `story-ending-alive` | `r3` | 0 StoryEndingModal hints (5 background `LINEAR` hints belong to unowned `battle-damage-story-chart` behind modal) | Repeatable to the eye (background chart scroll only) | Clean `6f` `0→1` crossfade (`f0→f6`), 0 travel, 0 `LivingBreath`, 0 `POP-OUT` |
| `friend-rescue` | `r2` | 0 FriendRescueModal hints (background map secret-path arrival at `f57` is behind modal) | Repeatable | Clean `6f` `0→1` crossfade (`f0→f8`), 0 flying bars (1 `#fighter-fx-ecstatic` `POP-OUT` is unowned Lane 1 `FighterAvatar` mood badge) |
| `btn-tactile-press` | `r1` | _None_ (6f press-down + spring rebound) | — | Opacity press delta (`BTN_PRESS.reducedOpacity`) |
| `settings-sheet-toggle` | `r2` | Intentional `DEAD-STRETCH` is the open→close dwell between `f0` tap and `f20` close tap; **0 `POP-OUT`**, **0 `FADE-ONLY`** | — | Clean `6f` enter (`f0→f6`) & `8f` exit (`f20→f28`, unmounts `f29`), 0 `POP-OUT` |

---

## 4. Verification Gates & Battery Budget

- **Hard Gate H1–H6:**
  - **H1 (Visual proof):** All 15 shots captured before/after across up to 3 rounds (`r1`/`r2`/`r3`) with `--compare` sheets read visually.
  - **H2 (Zero frame-loop regression / GPU-only):** Live Playwright CDP telemetry on `http://localhost:8104`:
    - `MainMenu`: **`activeFrameLoops: 1`** (`useCreatureMotion: 1`, 0 added for Frontier Foe), `violations: []`.
    - `60-node AdventureMap (save=maxed)`: **`activeFrameLoops: 2`** (budget `<= 6`), **`cpuShare: 1.52%`** (budget `< 15%`), **`layoutDelta: 0`** (budget `< 20`), `violations: []`.
    - `LevelPreview`: **`activeFrameLoops: 2`** (budget `<= 6`), `violations: []`.
    - Live layout check: **`0px` horizontal overflow** and **`0` page errors** at both `375×812` and `320×568` across MainMenu, AdventureMap (60-node + maxed), Camp, SkillTree, and Ending Reunion.
  - **H3 (Reduced motion):** All 8 `--reduced` captures verified (`menu-to-adventure`, `menu-foe-breath`, `map-bob-stagger`, `camp-open`, `skill-node-buy`, `story-ending-alive`, `friend-rescue`, `settings-sheet-toggle`): zero unwanted travel, zero infinite breath/bob loops, zero Lane 4 `POP-OUT` hints.
  - **H4 (Token discipline):** **0 raw magic timing literals** across all 23 touched `src/` files; zero hollow white card flashes.
  - **H5 (Guardrails & tests):** `npm run verify:guardrails` PASS (typecheck, ESLint, `validate:icons`, `validate:balance-eras`, `test:perf`); `npm run test:fast -- --maxWorkers=4` PASS (including new `useModalMotion` lifecycle tests in `__tests__/screenTransition.test.tsx`).
  - **H6 (Strict ownership & hygiene):** Zero edits outside Lane 4's assigned files (`motion.ts`, `ui.tsx`, `fighters/**`, `enemies/**`, `weapons/**`, `ledger.md`, `package.json` untouched; only `story-ending-plate.png` in `assets/backdrops/`); port `8104` Expo server stopped.

---

## 5. Honest Rubric Scores

- **`motion-loop` 7-Axis Average:** **8.9 / 10**
  - Responsiveness (`9.5`): `f0–f1` answer on taps (`menu-mascot-tap f0`, `skill-node-buy f0`, `camp-open f1`, `settings-sheet-toggle f1`).
  - Arcs & Curves (`9.0`): parabolic `sampleJumpArcY` cage shatter arcs, `EASE.enter`/`EASE.exitSoft`/`EASE.popSoft`/`EASE.drift`, zero linear UI motion.
  - Staging & Hierarchy (`9.0`): content-leads-exit modals, sunset meadow diorama layering, staggered Workshop & Reunion waves.
  - Overlap & Follow-Through (`8.8`): `OVERLAP.uiContentMs` / `exitContentLeadMs`, SkillTree delayed node burst + link beam draw-on, companion swap micro-nod.
  - Living World (`9.0`): zero-frame-loop `LivingBreath` unfreezes every menu/ending/defeat/rescue/bubble portrait; phase-staggered map bobs.
  - Accessibility & Determinism (`9.0`): spotless `--reduced` crossfades, `0 px` `--twice` breath determinism.
  - Performance & Battery (`9.0`): `activeFrameLoops = 2` on 60-node map, `0` layout delta, `1.5%` CPU.
- **Disney-12 Scorecard:** **23 / 24** (Squash & Stretch `2`, Anticipation `2`, Staging `2`, Straight Ahead / Pose-to-Pose `2`, Follow-Through & Overlapping `2`, Slow In & Slow Out `2`, Arcs `2`, Secondary Action `2`, Timing `2`, Exaggeration `2`, Solid Drawing `2`, Appeal `1` — minor room for future ambient parallax clouds on AdventureMap).
- **`dream-loop` Feel Score:** **9.0 / 10** (tactile tabletop craft, cozy storybook warmth, zero hard cuts, zero frozen statues).
