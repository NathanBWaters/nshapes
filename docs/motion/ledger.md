# Motion ledger

A **surface** is one moment the player sees that can be captured as one shot and judged as one piece (a Set is thrown and lands, the results screen pays out, the preview sheet opens and closes).
**Status:** `todo` (not started) · `shot` (captured, not yet scored) · `wip` (being changed) · `done` (re-scored and accepted) · `skip` (fine as is, or not worth the time).
**Scores** are the seven rubric scores from `.agents/skills/motion-loop/references/critique.md`, in the order Response / Readability / Motion / Staging / Rhythm / Identity / Sync, each 1-10, written like `7/6/5/6/7/6/8`.
**Shot** names how to capture it: `fx:<event>` is a button in `/dev/fx` (`fx-event-<event>`), `fx-cascade` and `fx-evolution` are the studio's sample runs, `—` means no capture recipe yet.
The loop that works through this file is described in `.agents/skills/motion-loop/SKILL.md`; entry ids point into `docs/motion/inventory/` (`F:` fight-fx.md, `A:` adventure-screens.md, `S:` shared-components.md, `N:` spire-and-parry.md).
This file is edited by whoever runs the loop: keep rows short; details, frame strips and decisions go to `docs/motion/reviews/<surface>.md`.

## Fight (every Set)

| Surface | What the player sees | Seen | Pri | Top problems | Shot | Status | Scores before → after | Entries |
|---|---|---|---|---|---|---|---|---|
| set-throw-lands | Set's cards fly at the foe; burst, number, rings | constant | P1 | upgraded v0.1.177 (Wave 4): staggered trailing `SwishRibbon`, contact-edge `Starburst` (`hideImpactStars`), 64th-note `Beat.onLand` sync (+0.1f `multSlam` / +0.9f `rainbow`), tier hitstop | fight-set, fx:hit, fx:rainbow, fx-cascade, fx-hit-effects-off | done v0.1.177 | 6/6/5/4/5/6/2 → 9/9/8/9/9/9/9 | F:1, F:2, F:3, F:4, F:5, F:6, F:7, F:15 |
| set-tap-confirm | Cards lift on tap; board flashes white on a Set | constant | P1 | upgraded v0.1.177 (Wave 4): frame-1 `Pressable` `onPressIn` squish + selection haptic, 80 ms 4th-tap flush, emerald clover Grace save badge | fight-pick, board-set | done v0.1.177 | 6/6/6/5/5/5/7 → 9/9/8/8/9/9/9 | F:47, F:48, F:51, F:56, F:57 |
| card-leave-and-deal | Scored slot empties, new cards grow in | constant | P1 | upgraded v0.1.177 (Wave 4): split refill (`260 ms` picked / `460 ms` collateral / `380 ms` invalid), flying `Ghost` `pointerEvents="none"` | board-deal, board-set, fight-open | done v0.1.177 | 6/6/7/5/5/7/7 → 8/8/8/8/8/8/8 | F:46, F:50 |
| wrong-pick | Board flashes red and shakes; fighter winces, foe gloats | often | P1 | upgraded v0.1.177 (Wave 4): `missLeaveAtMs` 240 ms + `exitMs(MS.quick)` `EASE.exitSoft` eliminates f29 `POP-OUT`; `FighterAvatar` Sakurai HIT recoil | board-miss, fight-miss | done v0.1.177 | 7/5/4/5/6/4/5 → 9/8/8/8/8/8/8 | F:52, F:53, S:screen-shake-preset, S:fighter-react-pain, S:enemy-react-taunt |
| big-hit-impact | Screen shakes and flashes on a 25+ / 50+ hit | often | P1 | upgraded v0.1.177 (Wave 4): unified viewport-scaled `useCombatShake` (`ScreenShakeStorage` + reduced motion) & 112 ms `ChiaroscuroFlash` (`ScreenFlashStorage`) | fx:rainbow, fight-set | done v0.1.177 | 5/5/4/4/5/5/4 → 9/8/8/8/8/9/9 | F:29, F:30 |
| cascade-labels | Tags pop where each chained effect lands; source tag | often | P2 | linear keyframes; labels land on fixed lanes all at once; sour shake is linear | fx-cascade | todo | — | F:21, F:22, F:25 |
| effects-off-cascade | With effects off, words pop beside the foe | sometimes | P2 | reduced path still scales and drifts; everything at once | — | todo | — | F:23 |
| card-hint-hop | A pointed-out card hops, rests, hops | often | P4 | fine as is (auditor: good) | — | todo | — | F:49 |

## Fight (HUD and stage)

| Surface | What the player sees | Seen | Pri | Top problems | Shot | Status | Scores before → after | Entries |
|---|---|---|---|---|---|---|---|---|
| foe-hp-drop | Red HP fill shrinks; pale trail catches up | constant | P2 | animates width; trail delay restarts every beat, lags the cascade; colour jumps | — | todo | — | F:31, F:32 |
| hud-chip-bump | A HUD chip (coins, hearts, clock…) jumps on arrival | constant | P2 | doubles the foe flinch on the same frame; not fxMs-scaled; numbers swap instantly | fx:coins | todo | — | F:26 |
| fighter-speech-bubble | Fighter's line pops into the stage bubble | often | P2 | no exit; taunt → coach swap is a hard cut; snaps to 0.9 first | — | todo | — | F:34 |
| goal-strip | ★★★ goal strip pops, turns teal when met | often | P2 | pops before the beat that caused it lands; met state gets only a 1.12 pop | — | todo | — | F:33 |
| power-meter | POWER ×N chip pops as it climbs | often | P3 | magic numbers; background heat steps instantly | — | todo | — | F:35 |
| trait-checks | Trait ✓/✗ strip pops above the board | sometimes | P3 | whole strip scales, cells not revealed; everything at once | — | todo | — | F:36 |
| evolution-active-hud | Ring empties around the evo icon; board glow pulses | sometimes | P3 | ring steps at 4 Hz; no exit for ring or glow | — | todo | — | F:37, F:38 |
| shading-surge | Surge bar pulses; pink board glow during a surge | often | P3 | fill width steps at 4 Hz; glow has no exit; fade-only | fx:surge_start | todo | — | F:39, F:40 |
| blast-on-board | Cards burst and shatter; 4-stage Flash → Fireball → Smoke → Embers | sometimes | P2 | upgraded v0.1.177 (Wave 4): deleted legacy `(150, 200)` particles & `useScreenShake`; 4-stage `Explosion` capped ≤24 particles; zero ember `HARD-STOP` | fx:blast, fight-set | done v0.1.177 | 5/5/5/4/5/5/4 → 9/9/8/8/8/9/9 | F:8, F:9, F:54, F:55, S:screen-shake-dynamic, S:particles-explosion |
| laser-on-board | Beam crosses a row; cards vaporise and flash | sometimes | P3 | upgraded v0.1.177 (Wave 4): 2f (`32 ms`) snap `Beam` + 30 Hz core flicker + ink-outlined endpoint `#fx-beam-spark` ticks | fx:laser | done v0.1.177 | 6/7/5/7/6/7/7 → 9/9/9/9/9/9/9 | F:10, F:11, F:12 |
| zap-chain | Bolt hops card to card with rings | sometimes | P3 | linear grow; hop delay duplicated by hand | fx:ricochet | todo | — | F:13, F:14 |
| fire-burn | Burning card reddens, flames lick up | sometimes | P3 | 250 ms burn sampled by 100 ms setInterval (2-3 steps); colour via re-render | fx:fire | todo | — | F:16, F:58, S:burn-timer-progress |
| board-sparkles | Twinkles pop around a card (grow, fetch, catalyst) | sometimes | P4 | magic numbers only | fx:grow | todo | — | F:17 |
| foe-uses-ability | Foe lunges; dark orb lands; smoke puffs on cards | often | P3 | regen has no anticipation; otherwise fine | fx:dud | todo | — | F:18, S:enemy-react-attack, S:enemy-react-regen |
| board-sweep | A slanted colour band crosses the board | sometimes | P3 | label pops 70 ms later on the same spot | fx:wave | todo | — | F:19 |
| aura-save | Two rings expand around the fighter (grace, shield) | sometimes | P4 | magic numbers only | fx:grace | todo | — | F:20 |

## Fight (moments: open, knockout, evolution, waves)

| Surface | What the player sees | Seen | Pri | Top problems | Shot | Status | Scores before → after | Entries |
|---|---|---|---|---|---|---|---|---|
| knockout-handoff | Expedition 33 slow-mo release sweeps straight into the Victory Card | often | P1 | fixed: removed duplicate K.O.! banner on final victory and 900 ms dead gap; slow-mo settles cleanly before `ScreenTransition` carries into Results | fight-ko, fight-win | done v0.1.147 | 6/5/4/3/4/4/3 → 9/9/9/9/9/10/9 | F:24, F:45 |
| fight-opening | "FIGHT!" banner, bell, both creatures enter, taunt | often | P2 | deal-in, entrances, taunt and banner all start at mount; bell at 260 ms vs slam ~120-235 ms; foe pops in on frame 1 | — | todo | — | F:41, S:fighter-react-entrance, S:enemy-react-entrance |
| evolution-cut-in | Blade slashes, band opens, recipe slides in, tap | sometimes | P2 | content moves as one block; close is unscaled and timer-paired; prompt pulse reverse flag; reduced banner exits slower than enters | fx-evolution | todo | — | F:42, F:59, F:60, F:61, F:62, F:63, F:64, F:65, F:66 |
| fight-overlays | Pause, explainer, inspector, level-up pick, shop fade in | sometimes | P3 | fade-only; no exit (only the Modal fade); fade and pop stacked | — | todo | — | F:43, F:44, A:hud-inspector-enter |

## Fight (parry, ignition, kill-cam: added in v0.1.137)

| Surface | What the player sees | Seen | Pri | Top problems | Shot | Status | Scores before → after | Entries |
|---|---|---|---|---|---|---|---|---|
| parry-bar-telegraph | Pill under the HUD fills red, snaps gold and throbs, "PARRY NOW!", teal when staggered | constant | P1 | fill animates width in 4 Hz steps; phase colours snap; throb ignores reduced motion and Effects off; scales its own text | — | todo | — | N:parry-bar-mount, N:parry-bar-fill, N:parry-bar-phase-swap, N:parry-bar-pulse, N:parry-bar-stall-badge, N:parry-bar-press, N:parry-warn-beat |
| ignition-equation | Docked Balatro `BASE × MULT (+ BONUS) = TOTAL` bar + itemized receipt + `GearBelt` value badges | constant | P1 | fixed: moved out of board into zero-reflow 3-zone HUD bar; itemized every card/weapon/passive/mult & follow-up hit; fixed `multStep` double-offset; added primed Next-Set preview, tap-to-inspect receipt & `--reduced` path | fight-ignition | todo: rewritten by its owner in v0.1.145 (docked score bar): the audit entries are stale, re-audit before working on it | 7/4/5/4/5/6/5 → 9/9/8/9/8/9/9 | N:ignition-panel-enter, N:ignition-chip-reveal, N:ignition-total-slam, N:ignition-flame-tongues, N:ignition-panel-exit |
| killcam-finisher | Expedition 33 Clair-Obscur slow-mo: monochrome wash, ink+gold letterbox, golden slash, slow-drifting chroma petals, audio tempo/pitch drag | often | P1 | fixed: removed white flash & competing banner; synced to lethal card impact (`f23.9`); added real audio time-dilation + clean `--reduced` fade | fight-ko, fight-win | done v0.1.147 | 6/5/4/3/4/4/3 → 9/9/9/9/9/10/9 | N:killcam-dim, N:killcam-banner, N:killcam-flash, N:killcam-star-shards |
| parry-landed | After the throw: rings round the fighter, spark to the foe, flinch, "PARRY!" / gold sweep "PERFECT PARRY!" | often | P2 | foe shake survives Effects off; sound ~240 ms before the orb lands; Ignition announces the parry before it launches; perfect beat piles everything on one frame | — | todo | — | N:parry-counter-beat, N:parry-perfect-beat |
| foe-strike | Unparried attack: dark orb to the hearts, foe lunges and shakes, fighter winces | often | P2 | attacker gets the "was hit" shake on its lunge frame; shake survives Effects off; sound leads the orb | — | todo | — | N:parry-foe-strike-beat |

## Creatures (fighter, foe, weapon avatars)

| Surface | What the player sees | Seen | Pri | Top problems | Shot | Status | Scores before → after | Entries |
|---|---|---|---|---|---|---|---|---|
| foe-takes-hit | Foe recoils, squashes, impact stars | constant | P1 | anchor bump 1.28 and squash 0.9 on the same frame; flinch still plays with effects off; restarts every beat, no hit-stop | foe-hit, foe-chain, foe-crit, foe-hit-quiet, fight-set | done v0.1.140 (HUD bump still stacks: see review) | 8/7/5/5/5/7/5 → 9/8/8/7/8/8/7 | F:28, F:68, S:enemy-react-pain, S:enemy-react-crit-pain, S:enemy-fx-burst |
| fighter-reacts-to-set | Fighter leaps; full spin once on a streak | constant | P1 | 368° spin on every Set at streak ≥3 competes with the throw; burst symbols share one transform, re-grow while fading | fighter-joy, fighter-streak, fight-cheer | done v0.1.143 (Effects switch wiring in AdventureRun: next) | 8/7/6/4/5/4/6 → 8/8/8/8/8/8/7 | F:67, S:fighter-react-joy, S:fighter-react-ecstatic-spin, S:fighter-fx-burst |
| creature-face | Eyes blink, pupils dart, face swaps per reaction | constant | P2 | face pops in and out at hold end, mid-spring; timer-driven swaps; lids never travel | — | todo | — | S:creature-blink, S:creature-gaze-saccade, S:creature-expression-swap |
| creature-wear-and-tremor | Low-HP shiver, bandages, sweat, KO stars, red frame | often | P2 | enemy tremor loop seam (1.3 px tick); bandages and KO stars vanish with no exit; frame colour snaps | — | todo | — | S:creature-tremor, S:enemy-fx-cornered-jitter, S:damage-bandage-pop, S:damage-sweat-drip, S:damage-ko-stars-orbit, S:damage-ko-presence-fade, S:creature-frame-state-swap |
| weapon-fires-on-belt | Belt icon jumps and plays its emblem flourish | often | P2 | one generic burst ring for every category; 8 hand-tuned literal flourishes | fx:blast | todo | — | F:27, F:69, S:weapon-tap-explosive, S:weapon-tap-chrono, S:weapon-tap-vitality, S:weapon-tap-laser, S:weapon-tap-tome, S:weapon-tap-coin, S:weapon-tap-connector, S:weapon-tap-arcane, S:weapon-tap-burst-ring |
| creature-mood-overlays | zZz, sweat, sparkles, rage aura; victory hop; streak pill | often | P3 | fade-only crossfade; streak pill pops with no exit | — | todo | — | S:creature-celebration-hop, S:creature-fx-presence-crossfade, S:fighter-fx-sleepy-zzz, S:fighter-fx-urgent-sweat, S:fighter-fx-streak-sparkle, S:enemy-fx-sleepy-zzz, S:enemy-fx-enraged-pulse, S:fighter-streak-badge |
| creature-pet-and-poke | Tapped fighter blushes, foe squishes, 5× spin | sometimes | P3 | enemy rage spin ends dead on 0° (no settle) | — | todo | — | S:fighter-react-pet, S:enemy-react-poke, S:enemy-react-rage-spin |
| fighter-support-reactions | Fighter phews, floats on heal, surges, cocks head | sometimes | P4 | fine as is (good anticipation) | — | todo | — | S:fighter-react-relief, S:fighter-react-heal, S:fighter-react-powerup, S:fighter-react-hint |
| creature-idle-life | Breath, sway, ears, tail, posture, shadow, fidgets | constant | P4 | strongest motion in the game; minor breath seam; lightweight foes fully static | — | todo | — | S:creature-breath-loop, S:creature-sway-tilt-loop, S:creature-head-lag-loop, S:creature-ear-follow-loop, S:creature-tail-wag-loop, S:creature-paw-tap-loop, S:creature-posture-springs, S:creature-mood-rate-blend, S:creature-ground-shadow, S:fallback-rig-head-only, S:fighter-fidget-ear-perk, S:fighter-fidget-tail-flick, S:fighter-fidget-chest-puff, S:enemy-fidget-ear-perk, S:enemy-fidget-tail-flick |

## Results and rewards

| Surface | What the player sees | Seen | Pri | Top problems | Shot | Status | Scores before → after | Entries |
|---|---|---|---|---|---|---|---|---|
| results-payout | Dark-onyx Victory Crest, giant arched SVG Angry Birds stars swoop & stamp with card recoil + rank seal, goals tick, coins roll | often | P1 | upgraded v0.1.147: custom beveled SVG stars arcing across screen with physical card thump, swoosh+thwack+3★ fanfare SFX, sunburst/confetti climax, rank seal & zero socket peek | fight-ko, fight-win, results-quick, results-two | done v0.1.147 | 7/6/6/5/5/6/4 → 9/9/9/9/9/10/9 | A:results-card-popin, A:results-star-pop, A:ui-star-pop, A:results-coins, A:results-avatars, A:results-footer |
| battle-damage-story | Brotato-style cumulative weapon/passive damage bars, stacked over-time SVG graph, 3-second playhead crescendo + peak sparks + weapon-voice audio + MVP crown pop (Adventure & Spire) | often | P1 | fixed: inverse-solved playhead-to-burst/sound sync (`0.5 f` lock), tightened Y-axis (`3.0k`), added tail stacked base band, MVP-normalized GPU bars, fixed 82 px replay button, clean `--reduced` | results-story, results-quick | done v0.1.148 | 7/6/6/6/5/8/4 → 9/9/9/9/9/9/9 | A:battle-damage-story, N:spire-damage-story |
| unlock-reveal | Black screen, rays, tap: flash, medallion, details | sometimes | P2 | white flash and rays ignore reduced motion; 300 ms bump with a hard content swap; ~440 ms dead gap before it opens | unlock-open, unlock-reveal (/dev/results) | done v0.1.144 | 7/4/4/3/4/3/3 → 8/8/8/8/8/8/8 | A:results-unlock-delay, A:unlock-modal-fade, A:unlock-rays, A:unlock-flash, A:unlock-hero-pop, A:unlock-detail-rise, A:unlock-avatar-acting |
| unlock-handoff | Next unlock in a row; results swap silhouettes | sometimes | P2 | cut to next silhouette; no exit; silhouettes swap instantly on return | unlock-advance, unlock-return (/dev/results) | done v0.1.146 (rows below the fold on big wins: layout, not motion) | 7/4/3/4/4/5/6 → 8/7/8/8/8/8/8 | A:unlock-advance, A:results-unlocked-reveal-swap |
| results-details | Power breakdown expander, NEW BEST, 👍/👎 vote | often | P3 | expander pops in; NEW BEST has no emphasis; vote and saved badge snap | — | todo | — | A:results-power-toggle, S:fun-prompt-vote |
| fight-replay | Replay slides up; rows scroll to the inspector | sometimes | P3 | no exit; expanders and inspector swap instantly; "Copied!" on a timer | — | todo | — | A:replay-modal-slide, A:replay-scroll-to-inspector, A:replay-copied-label, A:replay-expanders |

## Map

| Surface | What the player sees | Seen | Pri | Top problems | Shot | Status | Scores before → after | Entries |
|---|---|---|---|---|---|---|---|---|
| map-return | Map appears, scrolls to the frontier, progress shown | often | P2 | no enter motion; region bar and star count do not fill after a win; scroll on a 120 ms timer | — | todo | — | A:map-mount, A:map-autoscroll, A:map-progress-static |
| secret-path-reveal | Trail draws out, node pops, ring, "SECRET PATH!" | sometimes | P2 | tag never hides in reduced motion; chime on a parallel setTimeout; fade-only exit | — | todo | — | A:map-trail-dash, A:map-arrival-pop, A:map-arrival-ring, A:map-secret-tag |
| map-ambient | Frontier node and fighter bob; foes idle | constant | P3 | node and fighter bob in lockstep; lightweight foes frozen | — | todo | — | A:ui-bob, A:map-frontier-bob, A:map-fighter-bob, A:map-avatars |
| friend-rescue | Golden Rescue Keys sit on the map road; walking onto or tapping one opens the pick-any-friend modal, turns the key, shatters iron cage bars, and springs the friend free | sometimes | P1 | fixed r1→r4: dynamic `GOLDEN KEY`→`FRIEND FREED` eyebrow, `UNLOCKING CAGE…` slot removing empty black void, restrained leap avoiding top-pill clip, `keyY=22` zero text overlap, `KEY_EXTRA_ROW=98` balanced road air, clean `--reduced` | friend-rescue, map-key-open | done v0.1.150 | 8/8/8/7/7/9/9 → 9/9/9/9/9/10/9 | A:map-key-node, A:friend-rescue-modal |

## Level preview and lessons

| Surface | What the player sees | Seen | Pri | Top problems | Shot | Status | Scores before → after | Entries |
|---|---|---|---|---|---|---|---|---|
| preview-sheet | Tap a node; sheet slides up; ✕ closes it | often | P1 | slide + scale stacked; backdrop slides with the sheet; no exit (vanishes); node gives no press | preview-open, preview-close, preview-reopen, preview-flick | done v0.1.140 | 6/6/3/4/5/4/4 → 8/8/8/8/8/7/8 | A:map-node-tap, A:preview-sheet-enter, A:preview-sheet-exit, A:preview-foe-entrance |
| preview-loadout | Pick a fighter, equip charms, explainer appears | often | P3 | no travel from tile to slot; selection frame snaps; explainer swaps at once | — | todo | — | A:preview-fighter-select, A:preview-charm-equip |
| preview-lesson-card | Static NEW card with demo cards | sometimes | P3 | the NEW lesson never draws the eye | — | todo | — | A:preview-lesson-card |
| lesson-card | Lesson modal fades in; steps rise; quiz; guide tabs | sometimes | P3 | no exit; Back moves like Continue, no crossfade; quiz verdict has no motion | — | todo | — | A:lesson-modal-fade, A:lesson-step-rise, A:lesson-quiz-feedback, A:lesson-dots, A:guide-tabs |

## Camp

| Surface | What the player sees | Seen | Pri | Top problems | Shot | Status | Scores before → after | Entries |
|---|---|---|---|---|---|---|---|---|
| skill-tree | Tree opens; tap a node, buy it, links light | sometimes | P2 | buying (the meta payoff) has no motion; links have no draw-on; tree and detail open/close with cuts | — | todo | — | A:skill-tree-open, A:skill-node-select, A:skill-detail-modal |
| camp-menu-and-sections | Camp menu, section cut, settings, return bar | sometimes | P3 | menu ↔ section hard cut; header swaps instantly; return bar just there | — | todo | — | A:camp-section-switch, A:camp-settings-toggles, A:camp-return-bar |
| camp-armory | Tap a weapon: emblem flourish, slot fills, dock | sometimes | P3 | no travel to slot; dock pops in and out; "full" refusal has no shake | — | todo | — | A:camp-armory-equip, A:weapon-explainer-toggle |
| camp-workshop | Upgrade cards pop in; buying fills pips | sometimes | P3 | dozens of cards pop at once (no stagger); purchase has no motion (sfx only) | — | todo | — | A:camp-workshop-popin, A:camp-purchase |
| camp-fighters-arcana | Use a fighter (joy hop, USING tag); toggle Arcana | sometimes | P3 | tag and border snap; powerup reaction on tree open is never seen | — | todo | — | A:camp-fighters, A:camp-arcana-toggle |
| bounties | Bounty cards pop in; progress bars | sometimes | P3 | all at once; filter change inconsistent; bars static | — | todo | — | A:bounty-cards-popin, A:bounty-progress-static |
| history | Battle rows expand; DPM chart | sometimes | P4 | details and chart instant | — | todo | — | A:history-expand |

## Story and menu

| Surface | What the player sees | Seen | Pri | Top problems | Shot | Status | Scores before → after | Entries |
|---|---|---|---|---|---|---|---|---|
| story-abduction | Wild critters swoop in, slam forged iron cages onto your 3 friends in a tight ripple, and scatter Golden Keys across the valley; Beat 2 shows map keys, Beat 3 shows hero + Set | once | P2 | replaced old Starfall void: friends on stage from f0, per-friend mood flip synced to cage slams (`f28/f30/f32`, `foeDud` f31), keys settle on `SPRING.snappy` (`keyFound` f40.5), words enter cleanly after slams, zero flash, clean `--reduced` | story-open | done v0.1.150 | 6/6/5/6/5/5/6 → 9/9/9/9/9/10/9 | A:story-abduction, A:story-keys-road, A:story-words-rise |
| main-menu | Menu buttons, mascot, Discord button | often | P2 | big menu buttons give no press feedback; mascot swaps mid-spin; no mascot entrance | — | todo | — | S:menu-button-press, S:discord-button-press, S:mascot-swap |
| story-beats | Next beat: critters rise, hero rises, dots | once | P3 | hard cut between beats; dot jumps; rise and avatar entrance doubled | — | todo | — | A:story-beat-swap, A:story-dots, A:story-rise, A:story-avatars |

## Shared UI (buttons, modals, toasts)

| Surface | What the player sees | Seen | Pri | Top problems | Shot | Status | Scores before → after | Entries |
|---|---|---|---|---|---|---|---|---|
| screen-change | Menu → map → fight → results → camp swap | often | P1 | every screen change is a hard cut (incl. fight → results); no exits; ScreenTransition only on 4 legacy screens | screen-map-camp, screen-camp-map, screen-map-fight, screen-double, screen-menu-map | done v0.1.143 (menu ↔ Adventure still cuts: Game.tsx) | 8/5/2/5/4/4/6 → 8/8/7/8/8/7/8 | A:screen-swap, S:phase-cut, S:route-stack-transition, S:screen-transition-enter |
| modal-enter-exit | Panels pop in over a fade; options modal | often | P2 | no modal ever plays an exit (unmounted); PopIn ignores reduced motion; fade-only | — | todo | — | A:ui-popin, S:modal-fade |
| button-press | Pressed button dims | constant | P2 | fade-only; release (250 ms) slower than press; 3D buttons never press down | — | todo | — | A:ui-btn-press, S:touchable-opacity-press |
| companion-bubble | Companion's bubble text changes | often | P3 | text swaps with no transition | — | todo | — | A:companion-text-swap |

## Starfall Spire (added in v0.1.137)

| Surface | What the player sees | Seen | Pri | Top problems | Shot | Status | Scores before → after | Entries |
|---|---|---|---|---|---|---|---|---|
| spire-screen-cuts | Menu → setup → map → room / briefing → fight → reward → map: every screen cuts | constant | P2 | no transition anywhere; no climb between floors; act change is a cut; 900 ms still then a cut after fights | — | todo | — | N:menu-spire-enter-cut, N:spire-setup-to-map-cut, N:spire-map-node-press, N:spire-preview-to-fight-cut, N:spire-fight-to-reward-cut, N:spire-room-exit-cut, N:spire-map-act-change |
| spire-map-climb | Reachable nodes bob; map opens scrolled to the next row | constant | P2 | bob ignores reduced motion (Adventure map gates it); all nodes in phase; scroll jumps instead of climbing | — | todo | — | N:spire-map-node-bob, N:spire-map-autoscroll |
| spire-reward-draft | "FLOOR CLEARED!" card pops; pick a weapon, skill, arcana | constant | P2 | claiming has no moment: the section vanishes and the list jumps; reroll swaps instantly; payoff pop at 180 ms; coins not counted | — | todo | — | N:spire-reward-banner-popin, N:spire-reward-draft-claim |
| spire-room-panels | Briefing, shop, campfire, event, treasure cards pop in; outcomes swap | constant | P3 | one 180 ms PopIn on the top card only, rest static; outcomes cut the options; treasure has no reveal; foe entrance and card pop start together | — | todo | — | N:spire-preview-card-popin, N:spire-preview-foe-entrance, N:spire-shop-header-popin, N:spire-campfire-popin, N:spire-campfire-submode-swap, N:spire-campfire-fighter-idle, N:spire-event-popin, N:spire-treasure-popin |
| spire-purchases | Buy, heal, rest: coins and hearts change in the header | often | P3 | numbers swap instantly; bought row vanishes; forge list jumps open | — | todo | — | N:spire-shop-purchase, N:spire-header-stat-swap |
| spire-run-end | "SPIRE CONQUERED!" / "CLIMB ENDED" card with the fighter cheering or slumped | once per run | P2 | the run's payoff is a 180 ms PopIn; nothing staged, no count-up | — | todo | — | N:spire-end-hero-popin, N:spire-end-fighter-acting |
| spire-build-modal | Build inspector fades in; replay sheet slides up | sometimes | P3 | close is an instant unmount (no exit); fade and pop stacked | — | todo | — | N:spire-build-modal-open, N:spire-build-modal-close, N:spire-replay-modal |
| spire-setup | Fighter pick, ascension stepper, resume card | once per run | P3 | selection is a colour swap and the avatar pops between frozen and animated; values swap | — | todo | — | N:spire-setup-mount, N:spire-setup-fighter-select, N:spire-setup-steppers |
| spire-presses | Menu Spire button and Spire buttons dim on press | often | P3 | menu button has no press state at all; elsewhere dim only, slow release | — | todo | — | N:menu-spire-button-press, N:spire-btn-press |
| parry-preview-card | Static parry card in briefings and the inspector | sometimes | P4 | fine as is | — | todo | — | N:parry-preview-card |

## Legacy / Free Play (low priority)

| Surface | What the player sees | Seen | Pri | Top problems | Shot | Status | Scores before → after | Entries |
|---|---|---|---|---|---|---|---|---|
| legacy-round-end | Round summary tiles, numbers, chart; victory counters | sometimes | P4 | AnimatedCounter never rolls (bug); 2.3 s before Continue; number listener leak; chart animates height | — | todo | — | S:summary-match-counter-pop, S:summary-number-roll, S:summary-tile-stagger-in, S:summary-tile-glow, S:summary-tile-pulse, S:summary-button-fade, S:chart-bar-grow, S:counter-roll |
| legacy-round-timer | Circular timer drains, pulses, shakes | sometimes | P4 | pulse and shake restart every second (bug); colour snaps | — | todo | — | S:timer-ring-drain, S:timer-urgency-pulse, S:timer-critical-shake |
| free-play-board | Reward chips, 50 sparkles, card replace, HUD bars | sometimes | P4 | particles fly straight lines; 1.5 s replace delay; bars snap | — | todo | — | S:reward-reveal-pop, S:particles-sparkle, S:legacy-card-replace-delay, S:hud-bars-snap |
| legacy-toasts-tooltips | Toast fades; keyword sheet slides up | sometimes | P4 | keyword slide-out never visible; 500 ms toast read time | — | todo | — | S:notification-toast, S:keyword-sheet-slide |
| legacy-shop-tutorial-dev | Shop success swap; tutorial tour; dev auto-flow | sometimes | P4 | timer chains; dead time at practice end | — | todo | — | S:shop-purchase-success, S:tutorial-tour-steps, S:tutorial-practice-complete-delay, S:dev-fighters-autoflow |

## Order of work

1. **set-throw-lands**: the moment seen on every Set; fixing its sync (sound vs impact, card vs burst) sets the timing every other fight surface follows.
2. **foe-takes-hit**: lands on the same frame as 1; resolving the bump-vs-squash clash and adding a hit-stop completes the core impact.
3. **fighter-reacts-to-set**: the streak spin replays on every Set and steals the eye from 1-2; needs a lighter streak variant.
4. **big-hit-impact**: accessibility; shake and white flash play with effects off. Small change, removes a real risk.
5. **card-leave-and-deal**: closes the Set loop; the empty slot and column-only deal are seen every Set.
6. **set-tap-confirm**: the 200 ms wait after the third tap delays everything above; tighten once 1-5 are timed.
7. **wrong-pick**: the error answer; needs feedback on the three cards and a shake that respects Effects off.
8. **knockout-handoff**: the end of every won fight; banner cut mid-exit, 900 ms of nothing, then a hard cut.
9. **results-payout**: the payoff screen after every fight; coins that sound but never count, all in one 180 ms block.
10. **screen-change**: one shared transition fixes every hard cut, including fight → results right after 8-9.
11. **preview-sheet**: opened before every fight; one entrance instead of two, a fading backdrop, and an exit.

## Cross-cutting findings

- **No shared motion tokens in use.** `src/utils/animation.ts` (`DURATION`, `EASING`) is imported by 4 files, `EASING` by none; everything else is inline literals, the "pop" is hand-written 6 ways, shakes 3 ways (AdventureRun foe, AdventureRun screen, `useScreenShake`), no shared spring. (F §2, A §2, S §2)
- **Sound leads the picture.** Cascade sounds are scheduled at segment start (beat `at`), impacts land at `at + 240` ms: payout leads impact by ~100-230 ms; no output-latency compensation. Elsewhere sounds ride parallel `setTimeout`s (results stars at pop start, story chime, map chime). (F §1 "Sound vs picture", S §3, A:results-star-pop, A:story-starfall-flash, A:map-arrival-pop)
- **Modals never play an exit.** Every overlay is unmounted instead of `visible=false`, so the RN-web out animation never runs; PopIn has no exit. (A "platform behaviour", F:43, F:44, S:keyword-sheet-slide)
- **Screen changes are hard cuts** across Adventure (A:screen-swap, A §1 flow map) and the menu (S:phase-cut); `ScreenTransition` is used only by 4 legacy screens.
- **Reduced-motion gaps.** `onLand` runs for quiet beats, so foe flinch, screen shake and mega flash play with effects off (F:28, F:29, F:30); GameBoard shakes and particles have no gate (F:53-55); PopIn, AnimatedStar, UnlockReveal (rays, white flash), MechanicIntro and all Modals ignore it (A "platform behaviour"); the secret-path tag never hides (A:map-secret-tag); the reduced fight path still animates (F:23, F:42).
- **Timers drive picture.** Blink, gaze, fidgets and reaction holds swap faces via `setTimeout` → state (S:creature-expression-swap); burn overlay at 10 Hz (F:58); evo ring and surge bar at 4 Hz (F:37, F:39); cut-in close paired with a `setTimeout` (F:66).
- **Lots of things land at once.** No list staggers (A:ui-popin, A:camp-workshop-popin); deal-in stagger is column only (F:46); fight opening starts five things at mount (F:41); particle bursts share one transform (S:fighter-fx-burst, S:enemy-fx-burst).
- **Non-transform properties animated:** HP bar and trail (`width`, F:31-32), surge fill (F:39), round chart `height` (S:chart-bar-grow), summary glow `borderColor` (S:summary-tile-glow).
- **The studio misses parts of the fight.** `/dev/fx` has no sound, no `onLand` (no flinch, shake, flash, HP drop, avatar reactions) and never throws the Set's cards; `fxClock.slow` does not reach the HUD, CardMotion, anchor bumps or the cut-in close. (F §5)
- **Real motion bugs found in passing:** AnimatedCounter never rolls (S:counter-roll); CircularTimer pulse and shake restart every second (S:timer-urgency-pulse, S:timer-critical-shake); KeywordTooltip slide-out never visible (S:keyword-sheet-slide); K.O. banner unmounted 110 ms before its exit ends (F:24); enemy tremor and cornered jitter loop-seam tick (S:creature-tremor, S:enemy-fx-cornered-jitter); KO stars' fade-out never seen (S:damage-ko-presence-fade); cut-in prompt pulse reverse flag gives uneven holds (F:65).
- **`lightweight` EnemyAvatar is fully static**, though its doc comment promises a gentle breath; map nodes, previews and the inspector show frozen foes. (S §1 "Reduced motion / app inactive / lightweight")
- **Duplicated effects for one event:** a blast draws the stage burst plus GameBoard's own shake and particles at a hard-coded point (F:8 vs F:54-55); two full-screen white flashes exist (F:30, F:61); the foe gets anchor bump + flinch + avatar reaction stacked (F:26, F:28, F:68).

- **The v0.1.137 fight pieces bypass the effects system** (N §3): the Kill-Cam and Multiplier Ignition read `run.lastSetIgnition` instead of being catalog events, so they skip `fxMs` slow motion, the quiet path and `/dev/fx`; the Kill-Cam adds a second K.O. banner and a white full-screen flash on every knockout (two flashes on a lethal MEGA hit).
- **Ignition chip sounds drift late** (N:ignition-chip-reveal): each chip waits `i × 85` ms in a timer and is also given `slot: i`, which the band adds as a further `i × grid`: about 310 ms late by the fifth chip.
- **New reduced-motion gaps** (N §1): the parry bar's throb ignores both the OS setting and the Effects switch; `parry`, `perfect_parry` and `foe_strike` still shake the foe with Effects off; the Spire map's bob is always on.
- **None of the v0.1.137 code uses the motion tokens** (`src/utils/motion.ts` landed one commit later): every number is a literal.

## Not animations but found on the way

- `summary-number-roll` returns its listener cleanup from inside a `setTimeout` callback, so the listener is never removed (leak). (S:summary-number-roll)
- `KeywordTooltip` reads `SCREEN_HEIGHT` once at module load, so it is wrong after a resize/rotation. (S:keyword-sheet-slide)
- testID `evolution-banner` is used both by the reduced-motion evolution banner and by each recipe row of the cut-in. (F:42)
- `useScreenShake` calls `Math.random` in UI code (non-deterministic frames; not the engine). (F:54, S:screen-shake-dynamic)
- Camp's Skill tree button fires a `powerup` reaction in the same render that replaces the list, so it is wasted work. (A:camp-fighters)
- `FighterEffectsOverlay` sleepy zZz comment says "rising S-curve" but the path is a closed circle. (S:fighter-fx-sleepy-zzz)
