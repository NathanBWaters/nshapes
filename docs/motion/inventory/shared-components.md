> Audit of 2026-11-18 at commit f56d11e (v0.1.136). File:line references drift; re-audit an area before trusting them. Part of the motion loop: see docs/motion/ledger.md.

# Motion inventory: shared components, creature rigs, hooks, non-Adventure screens

Repo: the repository root (branch `motion-loop`, read-only audit). All paths below are relative to that root.

Conventions used in this file:
- Reanimated `withTiming` with no `easing` uses the library default **`Easing.inOut(Easing.quad)`** (duration default 300 ms). RN `Animated.timing` with no easing uses **`Easing.inOut(Easing.ease)`** (default 500 ms). These defaults are written as "(default inOut quad)" / "(RN default inOut ease)".
- Reanimated `withSpring({damping, stiffness})` uses mass 1. Damping ratio ζ = damping / (2·√stiffness) is given where it matters (ζ≈0.25 = very bouncy, ≈45% overshoot).
- "Reanimated ReduceMotion.System": Reanimated 4 animations default to `reduceMotion: ReduceMotion.System`, so with the OS/browser reduce-motion setting on they jump to their final value. RN `Animated` ignores the setting.
- Reach: routes are Expo Router web routes. `menu-*` etc. are `testID`s (rendered as `data-testid` on web).

---

## 0. Files covered

**Animated (all call sites attributed below):**
`src/components/creatures/useCreatureMotion.ts`, `src/components/creatures/useEffectsDriver.ts`, `src/components/creatures/CreatureDamageOverlay.tsx`, `src/components/creatures/CreatureStage.tsx`, `src/components/creatures/RigLayers.tsx`, `src/components/fighters/FighterAvatar.tsx`, `src/components/fighters/FighterEffectsOverlay.tsx`, `src/components/fighters/creatures/FallbackFighterRig.tsx`, `src/components/enemies/EnemyAvatar.tsx`, `src/components/enemies/EnemyEffectsOverlay.tsx`, `src/components/weapons/WeaponAvatar.tsx`, `src/components/ScreenTransition.tsx`, `src/components/ui/AnimatedCounter.tsx`, `src/components/Notification.tsx`, `src/components/RewardReveal.tsx`, `src/components/KeywordTooltip.tsx`, `src/components/CircularTimer.tsx`, `src/components/RoundSummary.tsx`, `src/components/RoundProgressChart.tsx`, `src/hooks/useScreenShake.ts`, `src/hooks/useParticles.tsx`, `src/hooks/useGuardedFrameCallback.ts`, `src/hooks/useReducedMotion.ts`, `src/hooks/useBurnTimer.ts`.
Also read for parameters: `src/utils/proceduralMotion.ts`, `src/utils/creatureAnimations.ts`, `src/utils/fighterAnimations.ts`, `src/utils/enemyAnimations.ts`, `src/utils/animation.ts`, `src/components/fighters/fighterRegistry.tsx`.

**Built-in / timer-driven motion only (Modal `animationType`, TouchableOpacity, setTimeout state swaps):**
`src/components/OptionsMenu.tsx`, `src/components/GameMenu.tsx`, `src/components/LevelUpModal.tsx`, `src/components/TutorialPractice.tsx`, `src/components/TutorialUITour.tsx`, `src/components/WeaponShop.tsx`, `src/components/RoundFunPrompt.tsx`, `src/components/MainMenu.tsx`, `src/components/Game.tsx`, `app/dev/fighters.tsx` (auto-flow interval).

**Checked, no animation of their own (static or only host other animated components):**
`src/components/VictoryScreen.tsx`, `CharacterUnlockScreen.tsx`, `GameOverScreen.tsx`, `LevelUp.tsx`, `InventoryBar.tsx`, `DifficultySelection.tsx`, `EnemySelection.tsx`, `WeaponPicker.tsx`, `WeaponList.tsx`, `WeaponGuide.tsx`, `GameInfo.tsx`, `FreePlayHeader.tsx`, `KeywordText.tsx`, `TutorialScreen.tsx`, `TutorialQuiz.tsx`, `Icon.tsx`, `ui/ChallengeCard.tsx`, `illustration/primitives.tsx`, `enemy-ui/*` (InactivityBar, DefeatProgress, TimerSpeedBadge, ScoreDecayIndicator, WeaponCounterBadge, EnemyPortrait), `creatures/eyes.tsx`, `creatures/expressions.ts`, `enemies/EnemyEyes.tsx`, `enemies/enemyRegistry.tsx`, `enemies/rigs/*` (5 files, ~50 rigs: they only consume the 5 part styles via `RigLayer`/`RigLayers`), `fighters/creatures/*Rig.tsx` (6 rigs, 5 `RigLayer`s each), `fighters/creatures/FacialFeatures.tsx`, `fighters/fighterRegistry.tsx`, `weapons/WeaponArtwork.tsx`, `weapons/illustrations/*` (6 files, static SVG), `src/hooks/*` other than the animated ones above (useGameTimer, useAutoHint, useAutoPlayer, useEnemyConductor, useFighterConductor, useRoundStats, useSoundSetting, usePWASafeAreaInsets, useAppActive), `app/index.tsx`, `app/_layout.tsx`, `app/+html.tsx`, `app/dev/_layout.tsx`, `app/dev/{play,store,victory,adventure,fx,sound,analytics}.tsx`, `global.css` (no CSS transitions/keyframes anywhere in the area).
**Excluded (other auditor):** `GameBoard.tsx`, `Card.tsx`, `CardMotion.tsx`.

### Call-site count (found vs covered)
Regex `with(Timing|Spring|Sequence|Repeat|Delay|Decay)\(|Animated\.(timing|spring|loop|sequence|parallel|stagger|delay|decay)\(|useGuardedFrameCallback\(|requestAnimationFrame\(` over the area:

| file | call sites | entries |
|---|---|---|
| fighters/FighterAvatar.tsx | 179 | fighter-fidget-*, fighter-react-* |
| enemies/EnemyAvatar.tsx | 138 | enemy-fidget-*, enemy-react-* |
| weapons/WeaponAvatar.tsx | 122 | weapon-tap-* |
| RoundSummary.tsx | 16 | summary-* |
| CircularTimer.tsx | 10 | timer-* |
| hooks/useScreenShake.ts | 6 | screen-shake-* |
| hooks/useParticles.tsx | 5 | particles-* |
| creatures/useEffectsDriver.ts | 5 | creature-fx-presence-crossfade, *-fx-burst, *-fx ambient phase |
| creatures/CreatureDamageOverlay.tsx | 3 | damage-* |
| RewardReveal.tsx | 3 | reward-reveal-pop |
| ui/AnimatedCounter.tsx | 3 | counter-roll |
| ScreenTransition.tsx | 2 | screen-transition-enter |
| Notification.tsx | 2 | notification-toast |
| KeywordTooltip.tsx | 2 | keyword-sheet-slide |
| RoundProgressChart.tsx | 1 | chart-bar-grow |
| creatures/useCreatureMotion.ts | 1 | creature-* (the integrator) |
| hooks/useGuardedFrameCallback.ts | 1 | (the wrapper itself) |
| **total** | **499** | **499 covered (100%)** |

No `withDecay`, `LayoutAnimation`, `entering=`/`exiting=`/`layout=` Reanimated layout animations, SVG `<animate>`, or CSS keyframes exist in this area. Zero `withRepeat(..., -1)` in the area; every infinite loop is either a `useGuardedFrameCallback` phase integrator or RN `Animated.loop` (CircularTimer).

**Entry count: 95** (plus 2 infrastructure notes: guarded-frame-callback, reduced-motion source).

---

## 1. Creature rig architecture

**One machine, two configs.** `useCreatureMotion(config, input)` (`src/components/creatures/useCreatureMotion.ts:229`) is shared by `FighterAvatar` (`FIGHTER_MOTION`, `FighterAvatar.tsx:55-442`) and `EnemyAvatar` (`ENEMY_MOTION`, `EnemyAvatar.tsx:60-362`). Rigs (`fighters/creatures/*Rig.tsx`, `enemies/rigs/*.tsx`) are pure SVG split into 0..100-viewBox layers; `RigLayer` (`creatures/RigLayers.tsx:24`) wraps each moving layer in an `Animated.View` and receives one of five part styles. `CreatureStage` (`creatures/CreatureStage.tsx:35`) renders the ground shadow + the rig root `Animated.View` (whole-body transform) + overlays (not body-attached) and the optional `Pressable`.

**Drivers.**
1. **Continuous UI-thread simulation** — one `useGuardedFrameCallback` per creature (`useCreatureMotion.ts:390-441`, label `'useCreatureMotion'`), active only when `animate` (= `animate && !reducedMotion && appActive`, and for enemies `&& !lightweight`). dt clamped to 50 ms. State lives in one shared value `sim` mutated in place (`sim.modify`), zero allocations. It integrates:
   - four phase accumulators `breathPhase`, `wagPhase`, `swayPhase`, `driftPhase`, each `advancePhase` wrapped to [0, 2π) (`proceduralMotion.ts:53`);
   - oscillator rates/amps eased with `expApproach` (frame-rate independent exponential, `proceduralMotion.ts:63`) toward targets from `computeMoodLoopRates` (`creatureAnimations.ts:92`);
   - eight second-order (f, ζ, r) posture springs (`stepSecondOrderInPlace`, `proceduralMotion.ts:109`) toward `computeMoodPoseTargets` (`creatureAnimations.ts:138`).
2. **Additive impulse channels** (`ReactionChannels`, `useCreatureMotion.ts:33`): `bodyTx, bodyTy, reactionScaleY, bodyRotate, headRotate, headTy, leftEarExtra, rightEarExtra, tailExtra, pawBounce` — plain shared values animated by `withSequence/withTiming/withSpring/withDelay` from `playReaction` and `idleFidget`. They add on top of the simulation and never reset it.
3. **JS timers** for blink, gaze saccade and idle fidget scheduling (`useCreatureMotion.ts:480-541`) and the reaction hold timer (`:452`, `reactionHoldMs[type] ?? 850`). These change React state (`isBlinking`, `idleGaze`, `activeReaction`) → expression/gaze props → SVG re-render (no tween).

**Part styles (all `useAnimatedStyle`, transform-only):**
- `rigRootStyle` (`:616-645`): `translateX = bodyTx + leanX.y + tremorX`; `translateY = bodyTy + leanY.y + celebrationHop`; `rotate = bodyRotate + bodyTilt.y + swayWave·idleTiltDeg + swayWave·danceTiltDeg·bounceBlend`; then volume-preserving `scaleX = 1/scaleY`, `scaleY = clamp(reactionScaleY·postureStretchY·(1 + breathWave·breathIntensity), 0.72, 1.36)` anchored at `footAnchorY = size·0.35` (feet planted).
- `headStyle` (`:648-665`): `translateY += headTy + headY.y − laggedBreath·size·0.014`, `rotate = headRotate + headTilt.y + laggedSway·1.9`, about the head pivot. `laggedBreath = sampleOverlappingWave(breathPhase, lag 0.68 rad, tip 0.14)`, `laggedSway = sampleOverlappingWave(swayPhase, 0.52, 0.1)`.
- `leftEarStyle` (`:668-682`): `rotate = wave(breathPhase, lag 1.28, tip 0.22)·earSwayDeg + leftEar.y + leftEarExtra`. `rightEarStyle` (`:685-699`): lag **1.42**, sign inverted (anti-twinning).
- `tailStyle` (`:701-715`): `rotate = wave(wagPhase, lag 0.35, tip 0.26)·wagAmpScale·tailWagDeg + tailExtra`.
- `pawStyle` (`:718-728`): `translateY = pawBounce − |sin(wagPhase)|·size·pawTap·excitement`, `excitement = max(bounceBlend, clamp((wagAmpScale − pawTapThreshold)·pawTapGain, 0, 1))`.
- `groundShadowStyle` (`:591-613`): opacity `max(0.06, shadowOpacity·(1 − lift·0.62))`, `translateX = (bodyTx+leanX)·0.55`, `scaleX = volScaleX·(1 − lift·shadowLiftShrinkX)`, `scaleY = max(0.55, 1 − lift·shadowLiftShrinkY)`; `lift = min(1, max(0,−ty) / max(8, size·0.28))`.

**Wave shapes.** `sampleOrganicBreath(phase, drift, skew 0.32)` (`proceduralMotion.ts:146`): `s = phase + 0.32·sin(phase)`; `(sin s + 0.22·sin(2s − 0.55)) / 1.18 · (1 + 0.13·sin(drift) + 0.06·cos(1.618·drift))`, clamped ±1.15. `sampleOverlappingWave(phase, lag, tip)` (`:166`): `(sin(p) + tip·sin(2p − 0.75)) / (1+tip)`, `p = phase − lag`.

**Base rates.** `breathHz = 1000/max(600, breathCycleMs)·moodMult`, `wagHz = 1000/max(400, tailCycleMs)·moodMult`, `swayHz = breathHz·0.618·moodMult` (`creatureAnimations.ts:119-131`).

**Personalities (fighters, `fighterRegistry.tsx`):** breathCycleMs / breathIntensity / earSwayDeg / tailCycleMs / tailWagDeg / idleTiltDeg —
Orange Tabby 2600/0.032/7/1800/14/1.5 (`:36-41`); Sly Fox 2300/0.028/9/1500/16/2.2 (`:57-62`); Emperor Penguin 3000/0.026/10/2200/8/3.2 (`:78-83`); Corgi 1650/0.04/11/520/22/2.5 (`:99-104`); Pelican 2800/0.03/9/2000/10/1.8 (`:120-125`); Badger 2100/0.036/5/1700/8/2.0 (`:141-146`); fallback 2500/0.03/7/1800/12/2.0 (`fighterAnimations.ts:111-121`).
**Enemies** (`enemyAnimations.ts:120-147`, hashed per name h): breathCycleMs sleepy 3400 / fast 1450+(h%320) / heavy 2850+(h%450) / else 2150+(h%420); breathIntensity heavy .038 / fast .034 / .03; earSwayDeg fast 11 / heavy 6.5 / 8.5; tailCycleMs fast 780+(h%280) / heavy 2100+(h%400) / 1480+(h%360); tailWagDeg 16/10/13; idleTiltDeg heavy 1.6 / fast 2.8 / 2.1.

**Config numbers (fighter vs enemy):**

| param | Fighter (`FighterAvatar.tsx`) | Enemy (`EnemyAvatar.tsx`) |
|---|---|---|
| blink (min gap, jitter, hold, double chance, double gap, double hold) ms | 2400, 2800, 130, 0.22, 95, 115 (`:109`) | 2600, 3000, 125, 0.20, 90, 110 (`:93`) |
| gaze saccade (min gap, jitter) ms; candidates | 1900, 2600; 7 points (`:110-122`) | 1800, 2500; 6 points (`:94-105`) |
| easing λ (1/s) breathHz, wagHz, swayHz, breathAmp, wagAmp, swayAmp, bounce, tremor | 7.5, 9, 7, 6.5, 7.5, 6.5, 8, 8 (`:153`) | 7.5, 8.5, 6.5, 6.5, 7, 6, 5.5, 7 (`:129`) |
| drift Hz | 0.19 fixed (`:154`) | 0.236 × breathHz (`:130`) |
| pose springs (f Hz, ζ, r): leanX / leanY / bodyTilt / headTilt / headY / ears / stretchY | [3.2,.78,.25] [3.4,.74,.3] [3.0,.72,.2] [2.65,.65,.15] [3.0,.7,.2] L/R [2.35,.54,.12] [3.5,.75,.3] (`:156-165`) | [2.7,.72,.6] [2.5,.68,.75] [2.4,.66,.7] [3.0,.6,.85] [2.8,.66,.75] L [3.7,.5,1.1] R [3.5,.5,1.1] [2.8,.68,.7] (`:132-141`) |
| look: hop, danceTiltDeg, tremorFreq, tremorAmpPx, shadowOpacity, shrinkX, shrinkY, pawTap, pawTapThreshold, pawTapGain | .10, 5.2, **2**, 1.35, .19, .42, .35, .036, 1.15, 2.5 (`:167-178`) | .09, 0, **2.2**, 1.4, .20, .40, .34, .032, 1.2, 2 (`:143-154`) |
| initial phase seed | hash·31 % 628 /100; wag ×1.7, sway ×0.9, drift ×0.5 (`:79-91`) | (17, ·37) % 628 /100; wag ×1.73, sway ×0.67, drift ×2.39 (`:76-88`) |
| bounce/tremor blends | bounce 1 in `victory`; tremor 1 `urgent`, 0.55 `critical`, 0 KO (`:93-107`) | bounce 1 `victory`; tremor 1 `cornered` or `critical` (`:364-369`) |

**Moods (rate multipliers & pose offsets):** fighter table `FIGHTER_MOOD_MOTION` (`fighterAnimations.ts:135-181`): e.g. anticipation breath ×1.95 wag ×2.45 sway ×1.65; urgent ×2.35/2.1/2.4; victory ×2.05/2.5/1.95 (amp ×1.3/1.45/1.65); sleepy ×0.52/0.42/0.48; defeat ×0.68/0.3/0.5; KO fixed rates breath 0.28 Hz wag 0.15 sway 0.2 (amps .22/0/.12); critical breath ×1.45 amp ×1.38; battered ×1.15/×1.12; gazeFollow leanX .012·size, bodyTilt 1.1°, headTilt 2.8°, headY .012·size; KO pose leanY .068·size, bodyTilt −9.5°, headTilt −7.5°, ears ±13°, stretchY .91. Enemy table `ENEMY_MOOD_MOTION` (`enemyAnimations.ts:251-284`): menacing ×1.16/1.25/1.12; cornered ×1.65/1.5/1.45; enraged ×1.52/1.95/1.55; victory ×1.45/1.8/1.4; sleepy ×.52/.4/.45; defeat ×.62/.25/.42; no fixed KO rates; KO pose leanX .022, leanY .07, tilt +10.5°, head +8°, ears ±14°, stretchY .9.

**Health tiers** (`creatureAnimations.ts:20`): pristine (full) / scuffed (>50%) / battered (26–50%) / critical (1 HP or ≤25%) / knocked_out (0). They change: breath rate/amp (critical, battered), pose slump (critical leanY +.018·size, tilt ∓2.2°, stretch ×.97/.968; battered leanY +.008·size), tremor blend, KO pose/rates, blink/gaze timers off at KO, damage overlay layers, and frame border colour.

**Infinite loops and their seams:**

| loop | where | seam |
|---|---|---|
| breath (`sampleOrganicBreath(breathPhase, …)`) | `useCreatureMotion.ts:593, 618` | continuous in `breathPhase` (sin, sin 2s; skew term is 0 at wrap). **Discontinuous in `driftPhase`**: `cos(1.618·drift)` jumps at each drift wrap (Δ depthMod ≈ 0.06·(1 − cos(10.166)) ≈ 0.104 → breath depth jumps ~10%). Fighters every 1/0.19 ≈ 5.3 s; enemies every 1/(0.236·breathHz) ≈ 9–13 s. Visible effect ≈ 0.3% scaleY — minor. |
| sway / ambient tilt / dance tilt (`sin(swayPhase)`) | `:619-625` | continuous |
| head / ear lag waves | `:650-651, 670, 687` | continuous (integer harmonics) |
| tail wag | `:703` | continuous |
| celebration hop `−|sin(breathPhase)|` | `:594, 621` | continuous (cusp at ground contact by design) |
| paw tap `−|sin(wagPhase)|` | `:724` | continuous |
| tremor `sin(wagPhase·tremorFreq)` | `:622` | fighter tremorFreq 2 → continuous. **Enemy tremorFreq 2.2 → LOOP-SEAM**: at every wag wrap the value jumps from sin(2π·2.2)=0.951 to 0 → a ≈1.33 px tick per wag cycle (0.4–1.3 Hz) on cornered / critical enemies. |
| effects ambient phase (useEffectsDriver) | `useEffectsDriver.ts:84-91` (λ 8 toward ambientHz) | fighter urgent `sin(2p)`, enemy enraged `sin(2p)`, zZz `sin/cos(p)`, streak `|sin p|` continuous; **enemy cornered `sin(2.2·p)` LOOP-SEAM** (same 0.951·1.4 px jump each ambient cycle, 0.95 Hz). |
| KO dizzy stars | `CreatureDamageOverlay.tsx:91-100` (0.58 Hz) | continuous (sin p, cos 2p, cos p) |
| sweat drip | `CreatureDamageOverlay.tsx:102-112` (0.92 Hz) | sawtooth (ty 3.4 → 0) hidden because opacity ramps to 0 over the first/last 15% → perceptually continuous |
| CircularTimer pulse | `CircularTimer.tsx:81-95` (RN `Animated.loop`) | **restarted every second** because `currentTime` is an effect dependency → see timer-urgency-pulse |
| CircularTimer shake | `CircularTimer.tsx:99-117` | 2 → −2 → 0 loop is continuous, but also restarted every second |

**Reduced motion / app inactive / lightweight:** `shouldAnimate = animate && !reducedMotion && appActive` (`FighterAvatar.tsx:460`; enemies add `!lightweight`, `EnemyAvatar.tsx:387`). When false: frame callback stops; the retarget effect snaps sim amps to 0 and posture to the target (`useCreatureMotion.ts:350-371`); `config.playReaction` is skipped (`:456`) but `activeReaction` still sets for the hold time (expression + static burst); blink/gaze/fidget timers stop (`:481`). `lightweight` enemies are therefore **fully static**, although the prop comment (`EnemyAvatar.tsx:42-46`) promises "gentle UI-thread breath".

**Tap interaction:** `handlePress` (`useCreatureMotion.ts:544-558`): one tap → `tapReaction` (fighter `pet`, enemy `poke`); 5 taps within `TAP_STREAK_WINDOW_MS = 2400` (`:220`, threshold `:221` = 5) → `tapStreakReaction` (`dizzy_joy` / `rage_spin`).

---

## 2. Shared motion constants

- **`src/utils/animation.ts:5-18`** is the only app-wide token file: `DURATION = { instant: 100, fast: 150, normal: 250, slow: 400, slower: 600 }` and `EASING = { easeOutExpo: [0.16,1,0.3,1], easeOutBack: [0.34,1.56,0.64,1], spring: {tension:120, friction:6}, bounce: {tension:180, friction:12} }`. Importers: `ScreenTransition.tsx`, `ui/AnimatedCounter.tsx`, `RoundSummary.tsx`, `GameBoard.tsx` (DURATION only). **`EASING` is imported nowhere** (RewardReveal hand-copies `tension 120 / friction 6`).
- Domain constants elsewhere (not shared): `FX_TIMING` (`src/adventure/fx/script.ts:26-38`: gridMs 62.5, flightMs 240, strikeMs 110, settleMs 180, lingerMs 1000, maxSteps 14), `CARD_MOTION` (`src/components/CardMotion.tsx:15`), `FIGHTER_REACTION_HOLD_MS` (`fighterAnimations.ts:98-109`: joy 900, ecstatic 1200, pain 800, relief 950, heal 950, powerup 1050, hint 800, pet 750, dizzy_joy 1250, entrance 750), `ENEMY_REACTION_HOLD_MS` (`enemyAnimations.ts:84-93`: pain 760, crit_pain 1050, taunt 920, attack 880, regen 900, poke 700, rage_spin 1200, entrance 820), `SHAKE_PRESETS` (`useScreenShake.ts:23-27`), the mood tables above.
- **There is no shared spring or easing vocabulary.** All ~460 creature/weapon `withTiming/withSpring` calls use inline literals (springs between damping 7–11 and stiffness 150–240; durations 50–540 ms). `AdventureRun.tsx:313-320` also hand-writes its own shake sequences instead of `useScreenShake`.

---

## 3. Sound sync (short)

- One clock: the adaptive band (`src/audio/band.ts`) schedules Web Audio notes with a **25 ms `setInterval` lookahead scheduler** (`band.ts:125`, `schedule()` `:161-168`) that queues every step whose time is within **120 ms** ahead of `chip.now` (AudioContext time); if the tab stalled >200 ms it skips forward instead of catching up. Step = 16th note, `stepDur = 60 / bpm / 4` (`:157`); bpm eases toward `arr.bpm × mix.tempo` by 12% per step (`:178-179`), arrangement swaps wait for a bar line (`step % 16`, `:174`).
- **Quantization:** cues go through `cueCtx` (`band.ts:404-415`): `t0 = nextGridTime(now + 12 ms, nextTime, g)` with `g` = one 32nd note (`theory.ts:95`), then `t = t0 + slot·g`. `select/deselect` pass `immediate = true` (no quantization) so taps answer instantly.
- **Visuals follow the band, not the other way:** `band.gridMs` (`band.ts:152-155`, 32nd note in ms, 62.5 ms at 120 bpm when idle) is passed by `AdventureRun.tsx:375` into `scriptFor(...)`, which steps the cascade on that grid (`fx/script.ts:94`, accepted range 30–200 ms, fallback `FX_TIMING.gridMs` 62.5). Both start "now", so visual beats and audio beats share the grid size but not an explicit phase lock; there is **no output-latency compensation** (`outputLatency`/`baseLatency` are not read anywhere).
- Shared components in this area do **not** sync to the beat: creature reactions, weapon taps, particles, shakes and the legacy screens fire immediately on state change. Outside Adventure fights, `playSound` (`src/utils/sounds.ts:269`) is fire-and-forget (chip SFX on web, expo-av elsewhere); inside a fight, band-owned categories are suppressed so the band plays them on the grid.

---

## 4. Entries

### 4.1 Creature rig: continuous / state-driven (shared by fighters and enemies)

**creature-breath-loop**
- where: `src/components/creatures/useCreatureMotion.ts:616-645` (rigRootStyle), integrator `:390-441`
- sees: body gently inhales/exhales (taller+thinner / shorter+wider), feet planted
- trigger: loop (mount while `shouldAnimate`)
- mechanism: useGuardedFrameCallback phase integrator + useAnimatedStyle
- params: freq `1000/max(600, breathCycleMs)` × mood mult (personalities in §1); scaleY amp = breathIntensity (0.026–0.04) × breathAmpScale; `sampleOrganicBreath` skew 0.32, 2nd harmonic 0.22 @ −0.55 rad, depth mod 0.13·sin(drift) + 0.06·cos(1.618·drift); scale clamp 0.72–1.36; anchor y = size·0.35
- class: ambient-loop
- reduced-motion: frame loop off, amp eased-to 0 instantly → static resting pose
- reach: any avatar, e.g. `/dev/fighters` (Fighters tab, 6 framed 96 px avatars `fighter-avatar-pressable`); Adventure fight `adventure-run-fighter`; main menu `main-menu-mascot`
- smells: LOOP-SEAM (minor, drift cos(1.618·drift) at drift wrap)

**creature-sway-tilt-loop**
- where: `useCreatureMotion.ts:619-637`
- sees: slow side-to-side body rock
- trigger: loop
- mechanism: frame integrator
- params: swayHz = breathHz·0.618·mood mult; rotate amp = idleTiltDeg (1.5–3.2°) × swayAmpScale; +`danceTiltDeg` (fighter 5.2°, enemy 0) × bounceBlend while celebrating
- class: ambient-loop
- reduced-motion: off (static)
- reach: as above; `victory` mood chip in `/dev/fighters` shows the dance tilt
- smells: none

**creature-head-lag-loop**
- where: `useCreatureMotion.ts:648-665`
- sees: head bobs slightly behind the chest and tilts with the sway
- trigger: loop
- mechanism: frame integrator + useAnimatedStyle (head pivot)
- params: breath lag 0.68 rad tip 0.14, y amp size·0.014; sway lag 0.52 rad tip 0.1, rotate ×1.9°
- class: ambient-loop · reduced-motion: static · reach: as above · smells: none

**creature-ear-follow-loop**
- where: `useCreatureMotion.ts:668-699`
- sees: ears / wings / flippers drift after the breath, left and right slightly out of step
- trigger: loop
- mechanism: frame integrator
- params: amp earSwayDeg (5–11°); lag L 1.28 rad, R 1.42 rad, tip 0.22; R sign inverted
- class: ambient-loop · reduced-motion: static · reach: as above · smells: none

**creature-tail-wag-loop**
- where: `useCreatureMotion.ts:701-715`
- sees: tail / pouch / halo wags
- trigger: loop
- mechanism: frame integrator
- params: wagHz = 1000/max(400, tailCycleMs) × mood (Corgi 520 ms → 1.92 Hz); amp tailWagDeg (8–22°) × wagAmpScale; lag 0.35 rad tip 0.26
- class: ambient-loop · reduced-motion: static · reach: as above (Corgi most visible) · smells: none

**creature-paw-tap-loop**
- where: `useCreatureMotion.ts:718-728`
- sees: feet tap when excited / celebrating
- trigger: loop, gated by excitement (victory bounce or wagAmpScale > threshold)
- mechanism: frame integrator
- params: height size·pawTap (fighter 0.036, enemy 0.032); threshold 1.15 / 1.2, gain 2.5 / 2; `−|sin(wagPhase)|`
- class: ambient-loop · reduced-motion: static · reach: `/dev/fighters` mood chip `anticipation` or `victory` · smells: none

**creature-celebration-hop**
- where: `useCreatureMotion.ts:594, 621` (bounceBlend eased `:409`)
- sees: continuous happy hopping in victory mood, shadow shrinks while airborne
- trigger: mood `victory` (bounce target 1)
- mechanism: frame integrator; blend expApproach λ fighter 8 / enemy 5.5
- params: hop height size·0.10 (fighter) / 0.09 (enemy) at breath frequency × victory mult (fighter ×2.05, enemy ×1.45)
- class: character-acting · reduced-motion: static · reach: `/dev/fighters` chip `victory`; `/dev/victory`; legacy RoundSummary/Unlock · smells: none

**creature-tremor**
- where: `useCreatureMotion.ts:622` (blend `:410`)
- sees: nervous horizontal shiver
- trigger: fighter mood `urgent` (1) or health `critical` (0.55); enemy mood `cornered` or health `critical` (1)
- mechanism: frame integrator
- params: `sin(wagPhase·tremorFreq)·tremorAmpPx·blend`; fighter freq 2, 1.35 px; enemy freq 2.2, 1.4 px; blend λ 8 / 7
- class: character-acting · reduced-motion: static
- reach: `/dev/fighters` → chip `1/4 Critical` or mood `urgent`; Enemies tab → `cornered`; Adventure: foe at low HP
- smells: LOOP-SEAM (enemy, 2.2 non-integer multiple of a wrapped phase → 1.33 px tick per wag cycle)

**creature-posture-springs**
- where: `useCreatureMotion.ts:337-384` (retarget), `:416-432` (springs)
- sees: body leans/crouches/perks ears into each new mood, health slump or gaze direction with inertia and overshoot
- trigger: prop change (mood, healthState, gaze, size)
- mechanism: second-order (f, ζ, r) springs on the UI thread (semi-implicit Euler, stable clamp)
- params: spring tables in §1; pose offsets in mood tables (`fighterAnimations.ts:158-180`, `enemyAnimations.ts:262-281`)
- class: character-acting · reduced-motion: snaps to target pose (`:350-371`)
- reach: `/dev/fighters` mood chips / HP chips · smells: none (good; the strongest motion in the area)

**creature-mood-rate-blend**
- where: `useCreatureMotion.ts:399-414`
- sees: breathing/wagging speeds up or slows into a new mood without a jump
- trigger: prop change (mood / health)
- mechanism: expApproach on Hz and amplitude, phases preserved
- params: λ per channel (§1 table)
- class: character-acting · reduced-motion: n/a (static) · reach: `/dev/fighters` mood chips · smells: none

**creature-ground-shadow**
- where: `useCreatureMotion.ts:591-613`; view `CreatureStage.tsx:70-85`
- sees: contact shadow widens on squash, shrinks and fades when the body leaves the ground
- trigger: follows body (loop + reactions)
- mechanism: useAnimatedStyle (opacity + transform)
- params: base opacity .19 / .20, min .06, fade 62% at full lift; lift norm max(8, size·0.28); shrink X .42/.40, Y .35/.34 (min scaleY .55); follows x ×0.55; size max(minW 14/12, size·0.54) × max(minH 4/3, size·0.11)
- class: character-acting · reduced-motion: static
- reach: testID `fighter-ground-shadow` / `enemy-ground-shadow` (not rendered for lightweight enemies) · smells: none

**creature-blink**
- where: scheduler `useCreatureMotion.ts:500-522`; expression `resolveFighterExpression` (`fighterAnimations.ts:245`) / `resolveEnemyExpression`
- sees: eyes swap to a closed-eye drawing for one frame-span, sometimes twice
- trigger: JS timer loop
- mechanism: JS setTimeout chain → React state → SVG swap (no tween)
- params: fighter gap 2400 + rand·2800 ms, hold 130 ms, double 22% (gap 95, hold 115); enemy 2600 + rand·3000, hold 125, double 20% (90 / 110)
- class: character-acting · reduced-motion: off (eyes stay open)
- reach: any lively avatar; watch `/dev/fighters` for ~5 s
- smells: TIMER-DRIVEN, NO-MOTION (lid does not travel; a hard swap is acceptable for a 130 ms blink but the eye shape pops)

**creature-gaze-saccade**
- where: `useCreatureMotion.ts:525-531` (schedule), eyes `creatures/eyes.tsx:10-12` (`eyeGazeShift`: x·r·0.34, y·r·0.28)
- sees: pupils dart to a new spot; head and body follow via the posture springs
- trigger: JS timer loop; also mood-forced gaze (curious, anticipation, defeat, menacing, attack, taunt)
- mechanism: setTimeout → state → SVG pupil offset (instant) + spring follow
- params: fighter 1900 + rand·2600 ms; enemy 1800 + rand·2500 ms; candidate lists `FighterAvatar.tsx:113-121`, `EnemyAvatar.tsx:97-104`
- class: character-acting · reduced-motion: off, gaze centred
- reach: any lively avatar · smells: TIMER-DRIVEN (instant pupil jump is physiologically right; fine)

**creature-expression-swap**
- where: `FighterAvatar.tsx:489-498`, `EnemyAvatar.tsx:422-431`, face drawing `fighters/creatures/FacialFeatures.tsx`, `enemies/EnemyEyes.tsx`
- sees: face changes (happy, wince, starry, panic, sleepy, ko…) instantly when a reaction/mood/health starts and again when the hold timer ends
- trigger: activeReaction / mood / health / blink
- mechanism: React re-render of SVG
- params: hold = `*_REACTION_HOLD_MS` (§2), fallback 850 (`useCreatureMotion.ts:454`)
- class: text-swap (face swap) · reduced-motion: same (swaps still happen)
- reach: `/dev/fighters` any reaction button (e.g. "Mistake Pain"); Adventure every Set / mistake
- smells: NO-MOTION (face pops in and pops out at hold end, often mid-spring), TIMER-DRIVEN

**creature-frame-state-swap**
- where: `FighterAvatar.tsx:518-534`, `EnemyAvatar.tsx:437-445`, `CreatureStage.tsx:47-55`
- sees: framed portrait border/background jumps to red (critical/KO), yellow (streak ≥3 / victory) or tier colour
- trigger: prop change (health, streak, mood)
- mechanism: none (style swap)
- params: border 2 px, radius max(10, size·0.24); colours `COLORS.impactRed` / `#FFF1F2`, `COLORS.actionYellow` / `#FFFBEB`, `TIER_AURA_COLORS[tier]`
- class: ui-feedback · reduced-motion: same
- reach: `/dev/fighters` (all framed) → HP chip `1/4 Critical`; Adventure `CompanionBubble`, `SkillTree`, `HudInspector`, `MechanicIntro` (framed avatars)
- smells: NO-MOTION

**fighter-streak-badge**
- where: `FighterAvatar.tsx:566-570`
- sees: "4x" pill appears at bottom-right of a framed fighter
- trigger: `framed && streak >= 3`
- mechanism: none (mount/unmount)
- params: —
- class: number-pop · reduced-motion: same · reach: `/dev/fighters` chip `streak` (testID `fighter-streak-badge`); Adventure HUD only if framed · smells: NO-MOTION, NO-EXIT

**fallback-rig-head-only**
- where: `fighters/creatures/FallbackFighterRig.tsx:25-27`
- sees: unknown characters render an icon that only bobs with `headStyle`; ears/tail/paws styles ignored
- trigger: loop · mechanism: Reanimated style from the machine · params: as creature-head-lag-loop · class: ambient-loop · reduced-motion: static · reach: only for a character name with no registry entry (none in the shipped roster) · smells: none

### 4.2 Fighter idle fidgets (`FighterAvatar.tsx:124-151`, fired with ~every blink, roll = Math.random())

**fighter-fidget-ear-perk**
- where: `FighterAvatar.tsx:125-137`
- sees: left ear flicks, right ear follows 65 ms later
- trigger: blink tick, roll < 0.32
- mechanism: withSequence(withTiming, withSpring) + withDelay
- params: L −11° in 85 ms (default inOut quad) → spring 0 {damping 7, stiffness 190} (ζ 0.25); R withDelay 65 → +9° 85 ms → same spring
- class: ambient-loop · reduced-motion: not run · reach: any idle fighter · smells: MAGIC-NUMBERS

**fighter-fidget-tail-flick**
- where: `FighterAvatar.tsx:138-144`
- sees: two-beat tail flick
- trigger: 0.32 ≤ roll < 0.52 · mechanism: withSequence
- params: +11° 95 ms → −9° 105 ms → spring {8, 180}
- class: ambient-loop · reduced-motion: not run · reach: any idle fighter · smells: MAGIC-NUMBERS

**fighter-fidget-chest-puff**
- where: `FighterAvatar.tsx:145-150`
- sees: small chest swell
- trigger: 0.52 ≤ roll < 0.66 · mechanism: withSequence on reactionScaleY
- params: 1.035 in 220 ms `Easing.out(Easing.sin)` → spring 1 {11, 160}
- class: ambient-loop · reduced-motion: not run · reach: any idle fighter · smells: none

### 4.3 Fighter one-shot reactions (`FighterAvatar.tsx:181-441`)
Common: `jumpPx = max(6, size·0.22)`, `recoilPx = max(4, size·0.14)`. Overlay burst runs in parallel (fighter-fx-burst). All reached in `/dev/fighters` → Fighters tab → section "2. ONE-SHOT REACTIONS" buttons (labels below; affects all 6 avatars at once). Reduced motion: channel animation skipped, only expression + static burst for the hold time. All carry MAGIC-NUMBERS (inline literals, no shared tokens).

**fighter-react-joy** — button "Match Joy"
- where: `FighterAvatar.tsx:186-238`
- sees: crouch, leap with ears flaring and tail swishing, cushioned land
- trigger: valid Set (streak < 3, no heal/grace) via `useFighterConductor.triggerMatch` (`src/hooks/useFighterConductor.ts:83-102`)
- mechanism: 8 parallel withSequence chains
- params: scaleY 0.83 (75, out quad) → 1.17 (155, out cubic) → 0.92 (115, in quad) → spring {9, 220}; bodyTy +size·0.04 (75, out quad) → −jumpPx (175, out cubic) → spring {8, 195}; bodyTx +size·0.022 (160, inOut sin) → −size·0.015 (140, inOut sin) → spring {10, 200}; rotate 3.5° (70) → −9.5° (135) → 8.5° (150) → spring {9, 200}; headTy withDelay 40 → −size·0.035 (150) → spring {8, 190}; ears ±7° (65) → ∓20° (150) → spring {7, 175}; pawBounce +size·0.02 (70) → −size·0.09 (170) → spring {8, 185}; tail 18° (120) → −16° (130) → spring {7, 180}. Hold 900.
- class: character-acting · reach: Adventure every plain Set (`adventure-run-fighter`); Free Play `freeplay-fighter-avatar` · smells: none beyond MAGIC-NUMBERS (good anticipation + follow-through)

**fighter-react-ecstatic-spin** (ecstatic and dizzy_joy) — buttons "Mega / 3x Streak", "5x Zoomie!"
- where: `FighterAvatar.tsx:240-269`
- sees: deep coil, counter-wind −15°, full 368° spin in the air, land and settle
- trigger: ecstatic = mega match OR **every Set once streak ≥ 3** (`useFighterConductor.ts:91`), Adventure fx row `fighter: 'ecstatic'` (`AdventureRun.tsx:325`); dizzy_joy = 5 taps in 2.4 s
- mechanism: withSequence
- params: scaleY 0.79 (85, out quad) → 1.21 (170, out cubic) → 0.9 (150, in quad) → spring {8, 205}; bodyTy +size·0.055 (85) → −jumpPx·1.32 (235, out cubic) → spring {7.5, 185}; rotate −15° (85, inOut quad) → 368° (540, out cubic) → 8° (1 ms snap, visually identical) → spring {9, 200}; ears ∓22° (180) → spring {7, 170}. Total ≈ 625 ms + settle; hold 1200 (ecstatic) / 1250 (dizzy_joy).
- class: hero-reveal / character-acting
- reach: `/dev/fighters` button; Adventure: make 3+ Sets in a row; main menu: tap mascot 5× (`main-menu-mascot-pressable`)
- smells: TWO-HEROES (in Adventure it fires on every Set of a streak, competing with the card throw/burst; the full spin repeats every match), DURATION-OUT-OF-BAND? no (hero 625 ms ok)

**fighter-react-pain** — "Mistake Pain"
- where: `FighterAvatar.tsx:271-307`
- sees: sharp squash, decaying horizontal shake, head whiplash, ears pinned
- trigger: mistake / HP loss (`useFighterConductor.ts:69-75`, `>120 ms` after a manual reaction), Adventure row `fighter: 'pain'`
- params: bodyTx −recoil (50, out quad) → +0.92r (60, inOut sin) → −0.68r (60) → +0.45r (60) → spring {10, 240}; scaleY 0.8 (65, out quad) → 1.06 (110) → spring {9, 220}; rotate −12° (70) → 8.5° (95) → spring {10, 200}; headRotate withDelay 30 → −9° (80) → 6° (95) → spring {9, 190}; ears ±18° (80) → spring {9, 165}. Hold 800.
- class: impact/hit · reach: Adventure wrong pick; Free Play wrong pick · smells: none (good)

**fighter-react-relief** — "Grace Phew!"
- where: `FighterAvatar.tsx:309-329`
- sees: flinch, big inhale, melt; head tilts and holds
- trigger: grace-saved match/mistake (`useFighterConductor.ts:94-97, 110-111`)
- params: scaleY 0.87 (80, out quad) → 1.09 (230, out sin) → 0.96 (240, inOut sin) → spring {10, 170}; bodyTy +size·0.025 (80) → −size·0.04 (220, out sin) → spring {10, 160}; headRotate −4° (75) → 11.5° (230, out quad) → hold 11.5° (280) → spring {10, 170}. Hold 950.
- class: character-acting · reach: Adventure with graces + a one-trait miss · smells: none

**fighter-react-heal** — "Heal +♥"
- where: `FighterAvatar.tsx:331-349`
- params: bodyTy +size·0.02 (80) → −jumpPx·0.78 (320, out sin) → spring {11, 150}; scaleY 0.95 (80) → 1.09 (300, out sin) → spring {10, 170}; tail 14° (180) → −14° (200) → spring {8, 160}. Hold 950.
- sees: warm float up and settle · trigger: HP gain; Adventure row `heal` · class: character-acting · reach: Adventure heal weapon · smells: none

**fighter-react-powerup** — "Level Up!"
- where: `FighterAvatar.tsx:351-375`
- params: scaleY 0.84 (105, inOut quad) → 1.2 (195, out cubic) → 0.94 (120) → spring {8.5, 210}; bodyTy +size·0.04 (105) → −jumpPx·0.92 (205, out cubic) → spring {9, 195}; ears ±8° (100) → ∓16° (180) → spring {8, 185}. Hold 1050.
- sees: gather crouch, heroic surge · trigger: level-up / weapon acquired; WeaponShop purchase (`WeaponShop.tsx:77`); Adventure row `powerup` · class: character-acting · reach: `/dev/store` buy a weapon · smells: none

**fighter-react-hint** — "Hint Aha!"
- where: `FighterAvatar.tsx:377-396`
- params: scaleY 0.95 (70) → 1.06 (140) → spring {10, 190}; headRotate −4° (65) → 14.5° (155, out back 1.5) → hold (340) → spring {10, 180}; leftEar −20° (145, out back 1.4) → hold (340) → spring {8, 180}. Hold 800.
- sees: double-take, head cock, one ear up · trigger: hint used (`useFighterConductor.ts:125`) · class: character-acting · reach: Adventure hint button · smells: none

**fighter-react-pet** — "Pet Blush"
- where: `FighterAvatar.tsx:398-416`
- params: scaleY 0.84 (95, out quad) → 1.09 (145, out cubic) → spring {8, 200}; headRotate −9.5° (120, inOut sin) → 9.5° (145, inOut sin) → spring {9, 180}; tail ±18° (110/120) → spring {7, 190}. Hold 750.
- sees: squish under the finger and nuzzle · trigger: tap (interactive avatars) · class: ui-feedback · reach: `main-menu-mascot-pressable`, `adventure-run-fighter` (interactive) · smells: none

**fighter-react-entrance** — "Salute"
- where: `FighterAvatar.tsx:418-439`
- params: scaleY 0.89 (65) → 1.13 (125, out quad) → spring {8.5, 220}; bodyTy +size·0.025 (65) → −jumpPx·0.68 (145, out quad) → spring {8.5, 205}; ears ∓15° (140) → spring {8, 190}. Hold 750.
- sees: peppy hop, ears perk · trigger: fight start (`AdventureRun.tsx:305`), LevelPreview, StoryIntro, UnlockReveal mounts · class: panel-entrance (character) · reach: Adventure fight start; `/dev/adventure?save=fresh` · smells: none

### 4.4 Enemy idle fidgets (`EnemyAvatar.tsx:107-127`)

**enemy-fidget-ear-perk** — `:108-119`: L −12° (80) → spring {7.5, 195}; R withDelay 60 → +10° (80) → spring. roll < 0.34. class ambient-loop; reach any lively enemy (`/dev/fighters` Enemies tab). smells MAGIC-NUMBERS.
**enemy-fidget-tail-flick** — `:120-126`: −13° (90) → 11° (95) → spring {8, 185}. 0.34 ≤ roll < 0.56. class ambient-loop. (No chest fidget for enemies.)

### 4.5 Enemy one-shot reactions (`EnemyAvatar.tsx:156-361`)
`jumpPx = max(6, size·0.16)`, `recoilPx = max(5, size·0.14)`. Reach: `/dev/fighters` → tab "Enemies (N)" → section "2. COMBAT REACTIONS" (18 enemies per page, page chips). In Adventure triggered from `AdventureRun.tsx:331-338` when an fx beat lands (`onLand`) — so impact is synced to the cascade's landing beat. Reduced motion: expression + static burst only. All MAGIC-NUMBERS.

**enemy-react-pain** — "Set Hit!"
- where: `EnemyAvatar.tsx:161-201`
- sees: knocked back, squashed, head snaps, ears flare
- trigger: Adventure fx row `enemy: 'hit'` on every Set hit
- params: bodyTx +recoil (48, out quad) → −0.82r (60) → +0.55r (58) → −0.28r (52) → spring {10, 240}; scaleY 0.81 (65, out quad) → 1.09 (110) → spring {9, 210}; bodyTy +size·0.045 (65) → spring {10, 200}; rotate 11° (65) → −6° (85) → spring {10, 195}; headRotate withDelay 25 → 14° (75) → −8° (85) → spring {9, 190}; ears ±18° (85) → spring {8, 175}. Hold 760.
- class: impact/hit · reach: Adventure any Set · smells: NO-ANTICIPATION is fine for a hit; lacks a hit-stop / white flash (would clearly help at the moment of contact)

**enemy-react-crit-pain** — "Rainbow Crit!"
- where: `EnemyAvatar.tsx:203-229`
- params: bodyTx 1.35r (55) → −1.1r (68) → 0.75r (62) → spring {9, 220}; scaleY 0.74 (70, out quad) → 1.18 (125, out cubic) → 0.92 (90) → spring {8, 210}; rotate 22° (90, out quad) → −16° (105) → 9° (85) → spring {9, 190}; bodyTy −jumpPx·0.55 (110, out quad) → +size·0.05 (95) → spring {9, 200}. Hold 1050.
- sees: heavy stagger · trigger: fx row `criticalHit` · class: impact/hit · reach: Adventure big hits · smells: none

**enemy-react-taunt** — "Mistake Gloat"
- where: `:231-260`
- params: scaleY 0.86 (65) → 1.16 (125, out cubic) → 0.94 (95) → 1.09 (110) → spring {8, 205}; bodyTy +size·0.03 (65) → −0.9j (140, out cubic) → 0 (95) → −0.55j (115, out quad) → spring {8.5, 210}; headRotate −11 (105) → 11 (115) → −8 (105) → spring {9, 185}; pawBounce −size·0.1 (120) → 0 (95) → −size·0.08 (110) → spring {8, 195}. Hold 920.
- sees: double cackle bounce · trigger: player mistake (`AdventureRun.tsx:456`), fx `gloat`; GameOverScreen mount · class: character-acting · smells: none

**enemy-react-attack** — "Ability Attack!"
- where: `:262-285`
- params: bodyTx +0.55r (85, inOut quad) → −1.45r (105, out cubic) → spring {8.5, 210}; scaleY 0.84 (85) → 1.17 (105, out cubic) → spring {8.5, 215}; rotate 8° (85) → −14° (105, out cubic) → spring {9, 200}; paws +size·0.03 (80) → −size·0.13 (105, out cubic) → spring {8, 200}. Hold 880.
- sees: wind-up, lunge toward the fighter · trigger: foe ability (fx `attack`) · class: character-acting · smells: none (good anticipation)

**enemy-react-regen** — "Regen +HP"
- where: `:287-299`
- params: bodyTy −0.78j (280, out sin) → hold (160) → spring {11, 150}; scaleY 1.1 (240, out sin) → spring {10, 165}. Hold 900.
- sees: eerie float + swell · trigger: fx `regen` · class: character-acting · smells: NO-ANTICIPATION (minor)

**enemy-react-poke** — "Tap Poke"
- where: `:301-319`
- params: scaleY 0.83 (80, out quad) → 1.11 (120, out cubic) → spring {8, 210}; head 10° (85) → −10° (95) → spring {8.5, 195}; tail −20° (95) → 20° (105) → spring {7.5, 195}. Hold 700.
- sees: annoyed squish · trigger: tap on interactive enemy · class: ui-feedback · reach: `/dev/fighters` tap `enemy-avatar-pressable`; Adventure if the foe is interactive · smells: none

**enemy-react-rage-spin** — "5x Rage!"
- where: `:321-335`
- params: bodyRotate set 0, then 16° (75, inOut quad) → −360° (540, out cubic) → 0 (0 ms) ; bodyTy +size·0.04 (75) → −1.15j (250, out cubic) → spring {8, 210}. Hold 1200.
- sees: furious spin · trigger: 5 taps in 2.4 s · class: character-acting · smells: NO-FOLLOW-THROUGH (rotation ends dead on the 0° snap, no settle spring unlike the fighter spin)

**enemy-react-entrance** — "Stomp In"
- where: `:337-358`
- params: bodyTy −0.85j (0 ms snap) → +size·0.04 (115, in quad) → spring {8.5, 220}; scaleY 1.12 (95) → 0.84 (80, out quad) → 1.08 (120) → spring {8.5, 215}; ears ∓16° (150) → spring {8, 190}. Hold 820.
- sees: drops in from above, stomps, roars · trigger: fight start/new wave (`AdventureRun.tsx:306`, fx `entrance`), EnemySelection focus change (`EnemySelection.tsx:80`), UnlockReveal · class: panel-entrance (character)
- smells: first frame teleports up by 0.85·jumpPx (0 ms) — fine as a drop-in, but no opacity/scale in so it pops on mount

### 4.6 Effects overlays (`useEffectsDriver`, not attached to the body)

**creature-fx-presence-crossfade**
- where: `src/components/creatures/useEffectsDriver.ts:93-104` (fade), `:70-82` (keeps loop alive during fade-out)
- sees: zZz / sweat / sparkles / rage aura fade in/out when the mood changes
- trigger: prop change (mood; hidden while any reaction plays)
- mechanism: withTiming ×3
- params: fighter 240 ms, enemy 220 ms, `Easing.inOut(Easing.quad)`; loop kept alive fadeMs + 40
- class: panel-entrance/exit (tiny) · reduced-motion: jumps · reach: `/dev/fighters` mood chips `sleepy`, `urgent`, `streak` · smells: FADE-ONLY

**fighter-fx-burst**
- where: `src/components/fighters/FighterEffectsOverlay.tsx:84-94` (style), driver `:66-81`, progress `useEffectsDriver.ts:106-120`, art `:255-354`
- sees: reaction symbols (signature motif hearts/embers/frost/stars/splash/shockwave, 💢, sweat drop, crosses, golden ring, lightbulb, blush heart, rainbow stars) pop up, rise, fade
- trigger: activeReaction (replays on every reactionId)
- mechanism: withTiming 0→1 + interpolate
- params: duration = hold ms of the reaction (750–1250), `Easing.out(Easing.cubic)`; opacity [0,.12,.78,1]→[0,1,1,0]; scale [0,.24,.52,1]→[.52,1.12,1.03,1.14]; y [0,.35,1]→[5,−3.5,−7.5]; x sin(πp)·1.5
- class: particles · reduced-motion: static at progress 0.55 for the hold
- reach: `/dev/fighters` any reaction; Adventure each reaction
- smells: EVERYTHING-AT-ONCE (all symbols share one transform — no per-particle stagger/spread), scale grows again to 1.14 while fading (reads as a second pop at the end)

**fighter-fx-sleepy-zzz** — `FighterEffectsOverlay.tsx:97-108`: x sin(p)·2.2, y cos(p)·2.8 − 1, opacity presence·(0.78+0.22·(sin+1)/2), scale .92+.08·presence; ambientHz 0.42 (sleepy). Comment says "rising S-curve" but it is a closed circle. class ambient-loop; mood `sleepy` (also fires after 8 s idle board in fights). smells: none.
**fighter-fx-urgent-sweat** — `:111-120`: pulse (sin(2p)+1)/2; y −pulse·2.4, scale .94+.1·pulse, opacity .75+.25·pulse; ambientHz 1.55. mood `urgent`. class ambient-loop.
**fighter-fx-streak-sparkle** — `:123-132`: y sin(p)·−2.5, scale .95+|sin|·.09, opacity .76+.24|sin|; ambientHz 0.78. mood `streak`/`victory`. class ambient-loop.

**enemy-fx-burst**
- where: `src/components/enemies/EnemyEffectsOverlay.tsx:69-79`, art `:109+` (`enemy-fx-<type>` testIDs on the `<G>`)
- params: fixed 680 ms (`:65`), out cubic; scale [0,.24,.65,1]→[.4,1.14,1.03,.96]; opacity [0,.14,.72,1]→[0,1,.9,0]; y [0,.4,1]→[3,−6,−12]
- sees: impact stars / crit ring / taunt marks / attack slashes · trigger: activeReaction · class: particles · reduced-motion: static at 0.5
- reach: `/dev/fighters` Enemies tab reactions; Adventure every hit · smells: EVERYTHING-AT-ONCE; burst length (680) unrelated to reaction hold (700–1200)

**enemy-fx-sleepy-zzz** — `EnemyEffectsOverlay.tsx:81-91`: y −4.5·(sin+1)/2, x cos·2.4, opacity .72+.24·…; 0.42 Hz. ambient-loop.
**enemy-fx-enraged-pulse** — `:93-99`: sin(2p); opacity .65+.35·…, scale .95+.12·…; 1.65 Hz; moods `enraged`, `victory`. ambient-loop.
**enemy-fx-cornered-jitter** — `:101-107`: x sin(2.2·p)·1.4, opacity .85; 0.95 Hz. ambient-loop. smells: LOOP-SEAM (2.2 × wrapped phase).

### 4.7 Battle-wear overlay (`src/components/creatures/CreatureDamageOverlay.tsx`)

**damage-bandage-pop**
- where: `CreatureDamageOverlay.tsx:75-79`, style `:87-89`, applied `:149`
- sees: bandages / plasters / gauze appear with a small pop when health drops a tier
- trigger: health tier worsens
- mechanism: set 0.88 then withSpring 1 {damping 10, stiffness 240} (ζ 0.32)
- params: as above; scale origin = whole 100×100 layer centre (not the bandage)
- class: impact/hit (number-pop-like) · reduced-motion: none (value set to 1) · reach: `/dev/fighters` HP chip `3/4 Scuffed` → `2/4 Battered` → `1/4 Critical`; testID `fighter-damage-<state>` / `enemy-damage-overlay`
- smells: none; on healing the bandages vanish instantly (NO-EXIT), and `pristine` unmounts the whole overlay (`:114`)

**damage-sweat-drip** — `:102-112`, loop `:53-62` (0.92 Hz, active battered/critical/KO): ty = (norm²)·3.4, opacity ramps 0→1 over first 15%, 1→0 over last 15%. class ambient-loop. reduced-motion: static drop. smells: none.

**damage-ko-stars-orbit** — `:91-100`, orbit 0.58 Hz: x sin(p)·4.5, y cos(2p)·1.3, rotate sin(p)·7.5°, scale .85+.15·presence+cos(p)·.04. class ambient-loop. reach: HP chip `0/4 KO`. smells: none.

**damage-ko-presence-fade** — `:81-84`: withTiming to 1/0, 240 ms, `Easing.out(Easing.cubic)`. class panel-entrance. smells: NO-EXIT (the stars are only rendered while `showKO`, `:225`, so the fade-out is never seen; reviving from KO pops them away), FADE-ONLY (opacity + tiny scale).

### 4.8 Weapon emblem tap flourishes (`src/components/weapons/WeaponAvatar.tsx`)
Static at rest. `hop = max(3, size·0.16)`, `sway = max(2, size·0.09)`. Trigger: tap when `interactive` (`:289-292`) or parent bump of `triggerKey` (`:279-287`). Reduced motion: whole flourish skipped (`:81`). Reach: `/dev/fighters` → tab "Weapons (N)" → tap any `weapon-avatar-pressable` (rarity chips change trim). Adventure: `GearBelt.tsx` (`triggerKey={fired}` — plays when the weapon fires in a fight), Camp Armory, LevelPreview charms, AdventureRun shop picks. Legacy: InventoryBar, Victory, Unlock, EnemySelection. Category comes from `getWeaponTapStyle` (`WeaponArtwork.tsx`). All MAGIC-NUMBERS; class ui-feedback (tap) / impact (belt fire).

| id | where | params |
|---|---|---|
| weapon-tap-explosive | `:93-116` | scaleY .82 (65, out quad) → 1.2 (115, out cubic) → spring {7.5, 220}; scaleX 1.2 → .86 → same spring; ty +size·.07 (65) → −1.05·hop (130, out cubic) → spring {8, 210}; rot −10 (75) → 9 (95) → −5 (80) → spring {8, 200} |
| weapon-tap-chrono | `:118-141` | rot −15 (75, out quad) → 16 (85, out back 1.6) → −10 (80) → 6 (70) → spring {9, 220}; scaleY .9 (70) → 1.12 (110) → spring {9, 210}; scaleX 1.1 → .92 → spring; ty −.72·hop (120, out quad) → spring {9, 210} |
| weapon-tap-vitality | `:143-161` | scaleX = scaleY 1.18 (95, out quad) → .95 (80) → 1.14 (100, out quad) → spring {8.5, 200}; ty −.75·hop (135, out cubic) → spring {9, 190} |
| weapon-tap-laser | `:163-185` | tx −sway (65) → 1.25·sway (105, out cubic) → spring {9, 220}; ty +size·.04 → −.7·hop (105) → spring; rot −11 → 13 (105, out cubic) → spring {9, 210}; scaleY .88 → 1.14 → spring (scaleX untouched) |
| weapon-tap-tome | `:187-208` | scaleX .84 (75, inOut quad) → 1.18 (135, out back 1.5) → spring {8.5, 200}; scaleY 1.08 (75) → hold (135) → spring; ty −.9·hop (155, out cubic) → spring {9, 185}; rot −6 (95) → 6 (110) → spring {9, 190} |
| weapon-tap-coin | `:210-228` | ty +size·.06 (55) → −1.2·hop (150, out cubic) → spring {8.5, 230}; scaleX 1.08 (55) → .2 (95, inOut quad) → 1.1 (105, out quad) → spring {8.5, 220} (fake flip); scaleY .86 → 1.12 → spring |
| weapon-tap-connector | `:230-249` | scaleX .84 (70) → 1.19 (110, out cubic) → .93 (85) → spring {8, 210}; scaleY .84 → .89 → 1.12 → spring; rot 12 (105) → −8 (95) → spring {8.5, 200} |
| weapon-tap-arcane (default) | `:251-274` | scaleY .88 (70) → 1.13 (145, out cubic) → spring {9, 190}; scaleX 1.12 → .94 → spring; ty +size·.05 → −1.05·hop (165, out cubic) → spring {9, 180}; rot 8.5 (120, out sin) → −5.5 (130, inOut sin) → spring {9, 185} |

**weapon-tap-burst-ring**
- where: `WeaponAvatar.tsx:86-90` (progress), `:304-313` (style), `:327-348`
- sees: dashed rarity-coloured ring + two sparkles + a tick flash around the emblem
- params: 540 ms `Easing.out(Easing.cubic)`; opacity [0,.2,.72,1]→[0,1,.85,0]; scale [0,.35,1]→[.65,1.12,1.24]; hidden ≤.001/≥.999
- class: particles · reduced-motion: skipped · reach: testID `weapon-tap-burst` · smells: same ring for every category (doesn't echo the flourish), EVERYTHING-AT-ONCE

### 4.9 Hooks

**screen-shake-dynamic** (`triggerShake(intensity)`)
- where: `src/hooks/useScreenShake.ts:43-79`
- sees: board container jitters, decaying
- trigger: explosion etc. (consumer: `GameBoard.tsx`, other auditor)
- mechanism: withSequence of withTiming on translateX/Y
- params: amp = min(intensity/5, 1)·`MAX_INTENSITY` 8 px (`:11`); oscillations = min(3 + ⌊intensity/2⌋, 8); each step `BASE_DURATION` 300 (`:12`) / oscillations ms, `Easing.inOut(Easing.quad)`, last step out cubic; decay ×`DECAY_RATE` 0.85 (`:13`); x jitter ×(0.8–1.2), y ×(0.6–1.0) random
- class: impact/hit · reduced-motion: Reanimated ReduceMotion.System (jumps to 0 → no shake) · reach: Free Play / legacy board explosions (Blast Powder) · smells: `Math.random` inside a `'worklet'`-marked JS callback (works on JS thread; non-deterministic), MAGIC-NUMBERS vs AdventureRun's own shake

**screen-shake-preset** (`shake('light'|'medium'|'heavy')`)
- where: `useScreenShake.ts:84-122`, presets `:23-27`
- params: light 2 px / 100 ms / 2 iter; medium 5 / 150 / 3; heavy 10 / 200 / 4; step = duration/(2·iter+1); **Easing.linear**; y = ½x; linear decay 1 − i/iter
- class: impact/hit · reduced-motion: ReduceMotion.System · reach: via GameBoard · smells: LINEAR-ON-POSITION

**particles-sparkle**
- where: `src/hooks/useParticles.tsx:50-53, 91-108`; spawn in `Game.tsx:976-980` (50 sparkles at (width/2, 40) on every valid match start)
- sees: 50 yellow/white 6 px dots drift out from the top bar and fade
- trigger: valid match (Free Play + legacy)
- mechanism: withTiming ×5 per particle (default inOut quad), React-state particle list + setTimeout cleanup (maxLifetime + 100)
- params: speed 1–3, vy −2 bias, lifetime 1000–1500 ms, end offset v·60 + gravity(−0.02)·3600 = −72 px; rotation ±5·60°; scale 0.5–1 → ×0.5; opacity 1→0
- class: particles · reduced-motion: ReduceMotion.System (instantly invisible) · reach: `/` → `menu-freeplay` → start → make a Set · smells: LINEAR-ON-POSITION (actually inOut quad on a straight line — no arc; gravity is added to the end point, not integrated), EVERYTHING-AT-ONCE (all 50 spawn same frame), NOT-TRANSFORM? no; 50 `Animated.View`s + 50 setTimeouts per match

**particles-explosion**
- where: `useParticles.tsx:54-57`, gravity `:92`
- params: speed 5–13, lifetime 400–600 ms, 10 px dots, colours `#FF9538 #FF7169 #FFDE00 #383838`, end y += 0.1·3600 = 360 px, scale → 0
- class: particles · reach: GameBoard explosions (Free Play/legacy) · smells: LINEAR-ON-POSITION (straight line, eased inOut), 360 px "gravity" drop applied as an end-point offset

**burn-timer-progress**
- where: `src/hooks/useBurnTimer.ts:19-86`
- sees: card burn progress (drawn by Card.tsx)
- trigger: card set on fire
- mechanism: `setInterval` 100 ms → React state
- params: `FIRE_BURN_DURATION` 250 ms (`:5`) → only ~3 visual steps
- class: progress · reduced-motion: same · reach: `/dev/play` → `game-menu-button` → "Dev Tools" → "Set Fire (3)" · smells: TIMER-DRIVEN (10 Hz for a 250 ms effect)

**guarded-frame-callback (infrastructure, not an animation)** — `src/hooks/useGuardedFrameCallback.ts:11-25`: wraps `useFrameCallback`, runs only when `isActive && appActive`, registers with `perfWatchdog`. Used by useCreatureMotion, useEffectsDriver, CreatureDamageOverlay.
**reduced-motion source** — `src/hooks/useReducedMotion.ts:19-48`: web `matchMedia('(prefers-reduced-motion: reduce)')` read synchronously on first render + change listener; native `AccessibilityInfo`. Only FighterAvatar, EnemyAvatar, WeaponAvatar consult it in this area.

### 4.10 Screens and UI

**screen-transition-enter**
- where: `src/components/ScreenTransition.tsx:24-33`
- sees: screen fades in while rising 20 px
- trigger: mount
- mechanism: Reanimated withTiming ×2
- params: `DURATION.normal` = 250 ms (`utils/animation.ts:8`), `Easing.out(Easing.exp)`; translateY 20 → 0; opacity 0 → 1
- class: screen-transition · reduced-motion: ReduceMotion.System (instant)
- reach: legacy only: `/dev/victory`, `/dev/store` (WeaponShop), LevelUp, CharacterUnlockScreen
- smells: NO-EXIT (previous phase is unmounted instantly), used by only 4 legacy screens

**phase-cut** (Game.tsx screen switching)
- where: `src/components/Game.tsx:2010-2280` (`renderGamePhase` switch)
- sees: main menu → Adventure / Free Play difficulty / Tutorial / shop / summary etc. replace each other in one frame
- trigger: user navigation
- mechanism: none
- params: —
- class: screen-transition · reduced-motion: n/a
- reach: `/` → `menu-adventure` (Adventure entry), `menu-freeplay`, `menu-tutorial`
- smells: NO-MOTION (most important missing transition on the path into Adventure), NO-EXIT

**route-stack-transition**
- where: `app/_layout.tsx:31-35`, `app/dev/_layout.tsx:5-9`
- sees: Expo Router `Stack` with `headerShown: false`; on web, navigation between routes (e.g. `/dev/adventure` exit → `router.replace('/')`) has no animation
- class: screen-transition · smells: NO-MOTION (only matters for dev routes; the game itself is one route)

**counter-roll** (AnimatedCounter)
- where: `src/components/ui/AnimatedCounter.tsx:32-43` (Reanimated value, never read), `:48-83` (rAF + setState)
- sees: should count up to the value; **actually shows the final value immediately**
- trigger: value change / mount
- mechanism: requestAnimationFrame + React state (plus an unused Reanimated `withTiming`)
- params: duration default `DURATION.slower` 600; VictoryScreen passes 800 (`VictoryScreen.tsx:111, 120, 129`); easing expo-out `1 − 2^(−10p)`
- class: number-pop · reduced-motion: no handling (only appActive)
- reach: `/dev/victory` (three counters)
- smells: **bug** — the first effect sets `previousValue.current = value` (`:42`) before the second effect reads it as `startValue` (`:56`), so start = end and nothing rolls; dead shared value; TIMER-DRIVEN (setState per frame)

**notification-toast**
- where: `src/components/Notification.tsx:20-39`
- sees: bottom-right toast (e.g. "-1 ♥", "Not enough money") fades in, waits, fades out
- trigger: `setNotification` in Game.tsx
- mechanism: RN Animated.timing (native driver) + setTimeout
- params: in 150 ms, hold `duration` default 500 ms, out 150 ms (RN default inOut ease)
- class: panel-entrance/exit · reduced-motion: none
- reach: Free Play / legacy: wrong pick in `/dev/play`, reroll without money in `/dev/store`
- smells: FADE-ONLY, TIMER-DRIVEN, a 500 ms read time is very short for a sentence

**reward-reveal-pop**
- where: `src/components/RewardReveal.tsx:14-28`
- sees: reward chip ("BOOM!", "+12", "$+3"…) springs up over a scored card
- trigger: mount (GameBoard renders it when `quietRewards` is false)
- mechanism: RN Animated.parallel(spring, timing)
- params: scale 0.5 → 1 spring {tension 120, friction 6} (same numbers as `EASING.spring`, hand-copied); opacity 0 → 1 in 200 ms
- class: number-pop · reduced-motion: none · reach: Free Play / legacy any Set (not Adventure) · smells: NO-EXIT (card replaced after Game.tsx's 1500 ms timer), MAGIC-NUMBERS

**keyword-sheet-slide**
- where: `src/components/KeywordTooltip.tsx:33-48`; Modal `:63-69`
- sees: keyword bottom sheet slides up from off-screen inside a fading modal
- trigger: tap a keyword in `KeywordText` (EnemySelection, WeaponPicker, LevelUpModal)
- mechanism: RN Animated.spring / timing (native driver) + Modal `animationType="fade"`
- params: in spring {tension 65, friction 11} from `SCREEN_HEIGHT` (read once at module load); out 200 ms timing
- class: panel-entrance · reduced-motion: none
- reach: legacy only (`/dev/play` → enemy selection → keyword)
- smells: NO-EXIT (Modal `visible={isOpen}` hides immediately on close, so the 200 ms slide-out never renders), TWO motions on enter (modal fade + sheet spring)

**timer-ring-drain**
- where: `src/components/CircularTimer.tsx:39-49`
- sees: ring stroke empties each second
- trigger: progress prop (1 Hz)
- mechanism: Reanimated withTiming → useAnimatedProps `strokeDashoffset`
- params: 1000 ms `Easing.linear` (matches 1 s ticks); colour swaps teal → orange (≤10 s) → red (≤5 s) with no transition
- class: progress · reduced-motion: ReduceMotion.System (steps per second) · reach: legacy round HUD (`/dev/play`, GameInfo), tutorial tour · smells: none (linear is right for a clock), colour NO-MOTION

**timer-urgency-pulse**
- where: `CircularTimer.tsx:66-95`, config `:75-79`
- sees: timer breathes faster as time runs out
- trigger: ≤30 s alert, ≤15 s warning, ≤5 s critical
- mechanism: RN Animated.loop(sequence(timing up, timing down)), native driver
- params: alert 1.03 / 1000 ms per half; warning 1.05 / 500; critical 1.08 / 250 (RN default inOut ease)
- class: ambient-loop · reduced-motion: none (stops when paused/inactive)
- reach: `/dev/play` let the round clock drop under 30 s
- smells: LOOP-SEAM / bug — `currentTime` is in the effect deps (`:126`), so the loop is stopped and restarted every second from wherever it was; the 2000 ms alert cycle and 1000 ms warning cycle never complete cleanly (alert stays near 1.03)

**timer-critical-shake**
- where: `CircularTimer.tsx:98-118`
- params: translateX 2 → −2 → 0, 50 ms each, loop, ≤3 s left
- class: ambient-loop · reach: `/dev/play` last 3 s · smells: restarted every second (same deps), LINEAR? (RN default inOut ease)

**summary-match-counter-pop**
- where: `src/components/RoundSummary.tsx:147-159`, view `:237-263`
- sees: fighter + MATCHES block springs in
- params: scale 0.5 → 1 spring {friction 5, tension 100}; opacity 300 ms
- class: hero-reveal · reach: legacy: finish a round in `/dev/play?timeout=false` (testID `round-summary`) · smells: hero <300? spring ok; TWO-HEROES with the fighter's own ecstatic/joy reaction at the same moment

**summary-number-roll** (`useAnimatedNumber`)
- where: `RoundSummary.tsx:62-86`
- sees: numbers count up from 0
- params: 500 ms (RN default inOut ease), delay 200 (match count) / tile delay + 300; JS-driven `addListener` → setState
- class: number-pop · smells: listener cleanup is returned from inside the `setTimeout` callback so it is never removed (leak), TIMER-DRIVEN

**summary-tile-stagger-in**
- where: `RoundSummary.tsx:162-182`
- params: 6 tiles, start 600 ms, stagger 200 ms (setTimeout); opacity 300 ms + scale 0.8 → 1 spring {friction 6, tension 120}
- class: panel-entrance · smells: TIMER-DRIVEN, MAGIC-NUMBERS, total 1.6 s before last tile (DEAD-TIME)

**summary-tile-glow**
- where: `RoundSummary.tsx:183-196`, interpolation `:429-437`
- params: glow 0 → 1 (200 ms) → 0 (300 ms), JS driver; drives `borderColor` slateCharcoal → award colour and shadowOpacity 0 → 0.5
- class: ui-feedback · smells: NOT-TRANSFORM/OPACITY (borderColor/shadow, JS driver mixed with native-driver opacity/scale on the same view)

**summary-tile-pulse**
- where: `RoundSummary.tsx:404-422`
- params: withDelay(delay + 500, withRepeat(withSequence(1.05 @ `DURATION.slow` 400, 1 @ 400), 3, false)) — non-zero tiles only
- class: ambient-loop (3×) · reduced-motion: ReduceMotion.System · smells: none

**summary-button-fade**
- where: `RoundSummary.tsx:201-209`
- params: at 600 + 6·200 + 500 = 2300 ms, mount container then opacity 0 → 1 in 400 ms
- class: panel-entrance · smells: FADE-ONLY, DEAD-TIME (Continue unavailable for 2.3 s)

**chart-bar-grow**
- where: `src/components/RoundProgressChart.tsx:30-42`
- sees: current round's blue excess bar grows up
- params: after 100 ms setTimeout, height 0 → blueHeight over `animationDuration` 600 (RN default inOut ease), `useNativeDriver: false`
- class: progress · reach: legacy GameOverScreen / RoundSummary · smells: NOT-TRANSFORM/OPACITY (animates `height`), TIMER-DRIVEN

**modal-fade** (built-in)
- where: `OptionsMenu.tsx:66-69`, `GameMenu.tsx:718-721` and `:731-734` (exit confirm), `LevelUpModal.tsx:84-87`, `TutorialPractice.tsx:192-195`, `KeywordTooltip.tsx:63-66`
- sees: whole modal (backdrop + card) cross-fades in/out
- mechanism: RN `Modal animationType="fade"` (react-native-web: fixed-duration opacity CSS animation, ~300 ms)
- class: panel-entrance/exit · reduced-motion: none
- reach: Options from main menu (`menu-options`, Adventure-adjacent; testIDs `options-*`); GameMenu (`game-menu-button`, legacy/Free Play); LevelUpModal (legacy)
- smells: FADE-ONLY (panel has no scale/translate)

**touchable-opacity-press** (built-in, global)
- where: every `TouchableOpacity` (GameMenu 61, OptionsMenu 17, fighters dev 23, TutorialQuiz/Screen 11, RoundFunPrompt 7 with `activeOpacity={0.8}` …)
- sees: button dims while pressed
- mechanism: RN/RNW built-in opacity transition (default `activeOpacity` 0.2; press-in near-instant, release ≈250 ms)
- class: ui-feedback · reduced-motion: none · reach: everywhere, incl. Adventure results `results-fun-up`
- smells: FADE-ONLY, EXIT-SLOWER-THAN-ENTER, DURATION-OUT-OF-BAND (release >150 ms)

**menu-button-press**
- where: `src/components/MainMenu.tsx:84-110` (`MenuButton`), small tiles `:192-225`
- sees: big menu buttons (Resume, Adventure/Play/Continue, Free Play, Tutorial, Options) give no visual press feedback
- trigger: press · mechanism: none (Pressable without `pressed` style)
- class: ui-feedback · reach: `/` testIDs `menu-resume`, `menu-adventure`, `menu-freeplay`, `menu-tutorial`, `menu-options`
- smells: NO-MOTION (entry point to Adventure)

**discord-button-press**
- where: `MainMenu.tsx:230-246`, style `:407-409`
- params: pressed → backgroundColor `#4752C4`, instant
- class: ui-feedback · reach: `/` (label "Join Discord") · smells: NO-MOTION (colour swap only)

**mascot-swap**
- where: `MainMenu.tsx:153-163`
- sees: after a 5-tap zoomie the mascot is replaced by the next character in one frame (only without a saved game)
- trigger: `onPet('dizzy_joy')`
- mechanism: none (key/character change mid-spin)
- class: character-acting · reach: `/` tap `main-menu-mascot-pressable` 5× within 2.4 s
- smells: NO-MOTION (swap lands mid-spin; also no entrance reaction for the mascot on menu mount)

**shop-purchase-success**
- where: `src/components/WeaponShop.tsx:70-79`, style `:220-224`
- sees: purchase button turns to a success style for 800 ms; shop fighter plays `powerup`
- mechanism: setTimeout state swap
- class: ui-feedback · reach: `/dev/store` buy a weapon · smells: NO-MOTION, TIMER-DRIVEN

**fun-prompt-vote**
- where: `src/components/RoundFunPrompt.tsx:72-140`
- sees: 👍/👎 select, "saved" badge appears, tag chips toggle — all instant (plus TouchableOpacity dim 0.8)
- trigger: tap
- class: ui-feedback · reach: **Adventure** results screen: testIDs `results-fun-prompt`, `results-fun-up`, `results-fun-down`, `results-fun-saved`, `results-fun-tag-<id>`; Camp → History (`BattleHistory.tsx:310`); legacy `round-summary-fun-*`, Free Play `freeplay-fun-up/down`
- smells: NO-MOTION (selected state and saved badge pop)

**hud-bars-snap**
- where: `enemy-ui/InactivityBar.tsx:52`, `enemy-ui/DefeatProgress.tsx:146`
- sees: progress bars jump to each new width
- class: progress · reach: legacy boards with enemies (`/dev/play`) · smells: NO-MOTION, would be NOT-TRANSFORM if animated via width

**tutorial-tour-steps**
- where: `src/components/TutorialUITour.tsx:47-75`
- sees: react-native-copilot tour starts after 500 ms; on the "menu" step the GameMenu modal opens after 800 ms and the tour advances 400 ms later
- mechanism: setTimeout chain + copilot's own tooltip animation + modal fade
- class: panel-entrance · reach: `/` → `menu-tutorial` · smells: TIMER-DRIVEN, MAGIC-NUMBERS

**tutorial-practice-complete-delay** — `TutorialPractice.tsx:135`: after 3 matches, `onComplete` after 500 ms with no transition. class screen-transition. smells: DEAD-TIME, NO-MOTION.

**legacy-card-replace-delay** — `Game.tsx:1336-1370`: scored cards are replaced 1500 ms after a match (RewardReveal shows meanwhile); game over is delayed 100 ms (`:1605`). class exit. reach: Free Play / legacy. smells: DEAD-TIME, TIMER-DRIVEN.

**dev-fighters-autoflow** — `app/dev/fighters.tsx:121-171`: "▶ Auto-Flow" steps a scripted mood/HP/reaction sequence every 1150 ms (10 fighter steps, 8 enemy steps). Dev tool for watching reactions back to back (reaction holds 700–1250 ms, so long reactions get cut by the next step).

---

## 5. Dev routes: how a script reaches each state

- **`/dev/fighters`** (no URL params, no testIDs on controls; click by visible text):
  - Header: "▶ Auto-Flow" / "■ Stop Flow" toggle (not on Weapons tab); pill shows health state.
  - Tabs: "Fighters (6)", "Enemies (N)" (N = `ALL_CUSTOM_ENEMY_RIG_NAMES.length`), "Weapons (N)".
  - Fighters/Enemies panel "1. HEALTH & PROGRESSIVE WEAR-AND-TEAR": chips "4/4 Pristine", "3/4 Scuffed", "2/4 Battered", "1/4 Critical", "0/4 KO".
  - Fighters "2. ONE-SHOT REACTIONS": "Match Joy", "Mega / 3x Streak", "Mistake Pain", "Grace Phew!", "Heal +♥", "Level Up!", "Hint Aha!", "Pet Blush", "5x Zoomie!", "Salute".
  - Enemies "2. COMBAT REACTIONS": "Set Hit!", "Rainbow Crit!", "Mistake Gloat", "Ability Attack!", "Regen +HP", "Tap Poke", "5x Rage!", "Stomp In"; enemy page chips (18 per page).
  - "3. CONTINUOUS AMBIENT MOODS": chip text = mood id (fighters: idle, curious, anticipation, streak, urgent, sleepy, victory, defeat; enemies: idle, menacing, enraged, cornered, sleepy, victory).
  - Avatars: fighters 96 px framed interactive (`fighter-avatar-pressable` ×6, label `"<Name> fighter (<state>)"`), enemies 82 px (`enemy-avatar-pressable`, label `"<Name> enemy (<state>)"`), weapons 56 px (`weapon-avatar-pressable`), rarity chips "Default", common, rare, epic, legendary. Sub-testIDs: `fighter-ground-shadow`, `fighter-damage-<state>`, `enemy-damage-overlay`, `enemy-fx-<reaction>`, `fighter-streak-badge`, `weapon-tap-burst`.
- **`/dev/victory`**: renders `VictoryScreen` with mock data (42 matches, mock round scores, 6 weapons). Shows screen-transition-enter, fighter `victory` + `ecstatic`, three (non-rolling) AnimatedCounters, interactive WeaponAvatars. Buttons only raise `Alert`s.
- **`/dev/play`**: `Game devMode` starting in the legacy `round` phase. Params: `?autoplayer=true` (alias `?autoplay=true`), `?enemy=Night%20Owl` (skip enemy selection), `?timeout=false` (no round timer). Dev tools: `game-menu-button` → "Dev Tools" → "Timer: ON/OFF", "Reset Board", "+3 Cards", round/difficulty buttons, "Set Fire (3)", "+3 Graces", weapon category buttons, "Clear All Weapons".
- **`/dev/store`**: `WeaponShop` with $50,000; buy (double-tap = instant), reroll, "Continue" refreshes. Shows ScreenTransition, shop fighter (`curious`, `powerup` on purchase), purchase success swap, InventoryBar WeaponAvatars.
- **`/dev/adventure`**: `?save=maxed | fresh | before:<levelId>`, `?autoplay=true`, `?intro=false`. Adventure fighter in a fight: `adventure-run-fighter`.
- **`/dev/fx`**: stand-in fight with `FighterAvatar` (44 px framed, Anchor "fighter") and an `EnemyAvatar` portrait; chips `fx-event-<RunEventType>`, `fx-cascade`, `fx-evolution`, `fx-evolution-2`, `fx-speed-1|4|10`, `fx-reduced`; clock `studio-clock`.
- **`/dev/sound`**: `studio-start`, `studio-check`, `studio-report`, `studio-mix`, `studio-weapon-<id>`, `studio-recipe-<id>`, `studio-cue-<name>`.
- **`/dev/analytics`**: `?source=local | simulated | import`.
- **`/` (main menu)**: `main-menu-mascot` (`-pressable`), `menu-resume` (only with a saved legacy game), `menu-adventure`, `menu-freeplay`, `menu-tutorial`, `menu-options`; Options modal `options-analytics-toggle`, `options-copy-player-code`, `options-reset-game`, `options-reset-confirm`, `options-reset-cancel`. `/?autoplayer=true` enables the autoplayer.
- **Free Play**: `/` → `menu-freeplay` → DifficultySelection (pick attributes, start) → board with `FreePlayHeader` (`freeplay-fighter-avatar`, `freeplay-fun-up/down`).

---

## 6. Top 12 candidates (ranked)

| # | id | why | mode |
|---|---|---|---|
| 1 | fighter-react-ecstatic-spin | Full 368° spin replays on every Set once streak ≥ 3; competes with the card throw and burst (TWO-HEROES). Needs a lighter streak variant and the big spin only for real milestones. | **Adventure** |
| 2 | enemy-react-pain (+ crit-pain) | The most frequent impact in the game (every Set); good recoil but no hit-stop, flash or squash keyed to the landing beat strength. | **Adventure** |
| 3 | creature-expression-swap (+ creature-blink) | Faces pop in and out at reaction start/end (often mid-spring); eyelids never travel. Every avatar, every reaction. | **Adventure** |
| 4 | phase-cut (menu → Adventure / Free Play / Tutorial) | Hard one-frame cut on the main entry into Adventure; no exit for the menu. | **Adventure** entry |
| 5 | weapon-tap-* + weapon-tap-burst-ring | Plays on the GearBelt each time a weapon fires; 8 hand-tuned flourishes with literal timings, and one generic ring that ignores the category. | **Adventure** |
| 6 | creature-tremor (enemy) + enemy-fx-cornered-jitter | `tremorFreq 2.2` / `sin(2.2·p)` on a wrapped phase → a visible 1.3 px tick every cycle on low-HP foes (LOOP-SEAM). | **Adventure** |
| 7 | fighter-fx-burst / enemy-fx-burst | All symbols share one transform (no spread or stagger); fighter burst re-grows to 1.14 while fading; enemy burst length unrelated to the reaction. | **Adventure** |
| 8 | lightweight EnemyAvatar (map nodes, previews, results "next foe", HUD inspector) | `lightweight` disables everything, contrary to its doc comment; dozens of foes on the map/preview are frozen. | **Adventure** |
| 9 | creature-frame-state-swap (+ fighter-streak-badge) | Portrait border/background snaps to red/yellow; streak pill pops with no entrance/exit. | **Adventure** (framed avatars in CompanionBubble, SkillTree, HudInspector) |
| 10 | menu-button-press + mascot-swap | Main menu buttons have zero press feedback; the mascot swaps characters mid-spin. | **Adventure** entry |
| 11 | fun-prompt-vote | Results-screen 👍/👎, saved badge and tags change instantly. | **Adventure** results |
| 12 | counter-roll (AnimatedCounter) | Broken: start value overwritten before use, so it never rolls; plus the CircularTimer pulse restarts every second. | legacy only (low priority) |

Also worth noting (legacy, low priority): timer-urgency-pulse restart bug, summary-* timer chains (2.3 s dead time), particles-* straight-line trajectories, keyword-sheet-slide exit never visible, chart-bar-grow animating `height`.
