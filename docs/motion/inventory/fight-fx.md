> Audit of 2026-11-18 at commit f56d11e (v0.1.136). File:line references drift; re-audit an area before trusting them. Part of the motion loop: see docs/motion/ledger.md.

# Adventure fight: motion inventory (fx stage, HUD, board)

Repo: the repository root (branch `motion-loop`, clean). Read-only audit. Line numbers are of that worktree.

## 0. Scope: which files count as "fight"

Treated as fight (everything that renders while `AdventureRun` is mounted):

| File | What is in it | Own animation? |
|---|---|---|
| `src/adventure/fx/FxStage.tsx` | draws beats (orbs, bursts, labels, ghosts) | composes visuals.tsx pieces |
| `src/adventure/fx/visuals.tsx` | all drawing pieces | yes (`useProgress` at :34-42 + `Ghost` :449) |
| `src/adventure/fx/anchors.tsx` | HUD bump | yes (:122-124) |
| `src/adventure/fx/EvolutionCutIn.tsx` | evolution cut-in | yes |
| `src/adventure/fx/GearBelt.tsx` | weapon belt | via `Anchor` + `WeaponAvatar triggerKey` |
| `src/adventure/fx/script.ts`, `useFightFx.ts`, `catalog.ts`, `clock.ts`, `types.ts` | timing / data | timers only |
| `src/adventure/components/AdventureRun.tsx` (+ its inner `HpBar`, `ChallengeStrip`, `PassiveChip`, `EvolutionGlow`, `SurgeBar`, `SurgeGlow`, `Hearts`, `WeaponPick`, `Intermission`, pause/inspect/power modals, tip card) | HUD + orchestration | yes |
| `src/adventure/components/StageBubble.tsx` | speech bubble | yes |
| `src/adventure/components/TraitChecks.tsx` | trait strip | yes |
| `src/adventure/components/PowerMeter.tsx` | POWER chip | yes |
| `src/adventure/components/RunFx.tsx` | `MegaFlash`, `EvolutionBanner`, `EvolutionRing` | yes |
| `src/adventure/components/HudInspector.tsx` | in-fight inspector modal | Modal fade + `PopIn` |
| `src/adventure/components/ui.tsx` | only `PopIn` (:146-156) is used in fight; `Btn`, `CoinPill`, `Heart` static | `PopIn` |
| `src/adventure/components/GearChips.tsx`, `WeaponExplainer.tsx`, `PowerExplainer.tsx` | HUD chips / modal bodies | none (static) |
| `src/components/GameBoard.tsx`, `Card.tsx`, `CardMotion.tsx` | board, card, card motion | yes (owned here) |
| `app/dev/fx.tsx` | effects studio | none of its own |

NOT fight (not counted here): `CompanionBubble`, `LevelPreview`, `LevelResults`, `UnlockReveal`, `MechanicIntro`, `StoryIntro`, `AdventureMap`, `Camp`, `SkillTree`, `BattleHistory`, `FightReplay`, `BountyBoard`, `FieldGuide`, `rewards.tsx`; `ui.tsx` `AnimatedStar` (:86-102, results) and `Bob` (:123-142, map).

Cross-references owned by other auditors (listed as entries 67-69 with trigger only, no params): `FighterAvatar` reactions, `EnemyAvatar` reactions, `WeaponAvatar triggerKey`, plus the hooks `useScreenShake` / `useParticles` / `useBurnTimer` that GameBoard/Card call (their params are copied below because they decide what the board does in a fight).

## 1. Timing architecture

**From a tap to a cascade**

1. Third card tapped → `GameBoard.handleCardClick` (`GameBoard.tsx:432`) waits **200 ms** (`setTimeout`, :434) before validating. Then success flash, `onMatch` → `AdventureRun.handleMatch` (:432) → `dispatch({type:'MATCH'})` (engine reduces synchronously) and `later(REPLACE, 560)` (`REPLACE_DELAY_MS`, :60).
2. New `run.events` → effect at `AdventureRun.tsx:364-413`: Set events get the still-present cards attached (`cards`, for the throw), then `fx.play(scriptFor(staged, { weapons, gridMs: band.gridMs, reduced: !effects }))` (:375).
3. `scriptFor` (`fx/script.ts:164`) splits events into segments at every `evolution_start` (cut-in segments). `beatsOf` (:88) gives each event a Beat:
   - `step = stride × grid`; `grid = band.gridMs` (one 32nd note of the band; fallback `FX_TIMING.gridMs = 62.5` at :28, i.e. 120 bpm; clamped 30..200).
   - `stride = strideFor(steps)` (:42): 3 if ≤4 chain steps, 2 if ≤9, 1 otherwise (reduced: 1).
   - Lead Set hit: `at = 0`. Others: `at = min(slot, CHAIN_LEAD + maxSteps) × step`, `slot` starts at `CHAIN_LEAD = 2` (`audio/fightAudio.ts:142`) when a Set leads.
   - `land = at + flightMs (240)` if something flies, else `at + strikeMs (110)`.
   - `life = (land − at) + lingerMs (1000) + tier × 250`.
   - segment `total` (clock hold) = max land of holding beats + `settleMs (180)`; beats with `ambient` or `event.clock` do not hold.
   - beyond `maxSteps (14)` chain steps → `quiet` (text only).
4. `useFightFx.play` (`fx/useFightFx.ts:139`): adds pending damage, mounts all **ghost covers** (unbroken) at once, `holds++`, `anchors.measure()`, then runs segments sequentially. Per beat (`playBeats` :117): `later(mount + source bump + break ghosts, at)`, `later(land → bump target + row.bump + onLand, land)`, `later(unmount, at + life)`. Next segment after `segment.total` (or on cut-in dismiss).
5. `FxStage` (`fx/FxStage.tsx`) renders mounted beats; every piece animates itself once on mount through `useProgress` (`visuals.tsx:34-42`: `withDelay(fxMs(delay), withTiming(1, {duration: fxMs(ms), easing}))`). Inner delays (e.g. label waits `flight`) run on the UI thread.
6. `onLand` (`AdventureRun.tsx:313-339`) does the HUD reaction: foe shake/squash, screen shake (tier ≥ 2), `MegaFlash` (tier 3), fighter/foe avatar reactions. HP drops because `pendingDamage` decreases at land (`useFightFx.ts:109`) → `shownHp` (`AdventureRun.tsx:476`) → `HpBar` animates.

**Clocks that drive it**

- Beat scheduling: JS `setTimeout` (`useFightFx.ts:88-94` `later`, scaled by `fxMs`). Not rAF, not the audio clock. Each beat schedules 3 independent timeouts relative to `play()` time, so they do not drift relative to each other more than timer jitter, but they are not locked to the audio.
- Piece animation: Reanimated `withTiming`/`withDelay` on the UI thread, started at mount (i.e. after the JS timeout fired and React committed).
- HUD reactions, card motion, glows: Reanimated, unscaled by `fxMs`.
- Fight clock: `setInterval(TICK, 250)` (`AdventureRun.tsx:355`), only while `ticking = appActive && playing && !fx.busy` (:351). `fx.busy = holds > 0` (`useFightFx.ts:188`); `holds` is incremented in `play` if not reduced and any segment has `total > 0` or a cut-in, decremented after the last segment. The clock chip turns teal while held (`AdventureRun.tsx:745`, `st.statHeld`).
- Durations are defined in: `FX_TIMING` (`script.ts:26-39`), `GHOST_BREAK_MS` (`visuals.tsx:436`), `ORB_GAP_MS`/`MAX_ORBS` (`FxStage.tsx:17-19`), `GHOST_SLACK_MS`/`AMBIENT_GAP_MS`/`BANNER_MS` (`useFightFx.ts:15-19`), `GUARD_MS`/`CLOSE_MS`/`SPEED_LINES` (`EvolutionCutIn.tsx:26-34`), `REPLACE_DELAY_MS`/`FOE_TAUNT_MS`/`LAST_SET_MS`/`TICK_MS` (`AdventureRun.tsx:58-66`), `CARD_MOTION` (`CardMotion.tsx:15-26`); everything else is an inline literal at the call site.

**Sound vs picture**

- Sound is scheduled first, in one go: `onSegment` → `playSounds(soundsFor(events), stride)` (`AdventureRun.tsx:345-346`), called synchronously at the start of `playBeats` (`useFightFx.ts:118`), before any beat timeout fires.
- `band.cueCtx` (`audio/band.ts:403-415`): `t0 = nextGridTime(now + 0.012 s, ...)` (quantised up to the next 32nd note when the band is running), `t = t0 + slot × g`. `playSounds` passes `slot × stride` (`fightAudio.ts:189`), the same step index the picture uses for `at`.
- Result: a chain step's **sound lands at the beat's `at` (its launch)** plus 12 ms plus 0..1 grid of quantisation (≈0-62/125 ms), while its **picture impact lands at `land = at + 240 ms`** (orb) or `+110 ms` (strike). The Set's payout (kick, crash, bell at `band.payout`, `band.ts:437-467`) rings at `t0` ≈ 12-140 ms after the tap is processed, while the burst, the number, the HP drop, the foe flinch, the screen shake and the mega flash all land at 240 ms. So the sound leads the picture's impact by roughly 100-230 ms; nothing re-aligns them.
- `/dev/fx` passes no `onSegment` (no sound) and no `gridMs` (always 62.5 ms grid).

**Hold lengths** (derived): plain Set = 240 + 180 = 420 ms. A 9-step chain at stride 2 → last `at` = (2 + 9) × 125 = 1375, + 240 + 180 ≈ 1.8 s at 120 bpm; slower band tempos stretch it (doc says ≈2.2 s). Cut-in holds until tapped (≥450 ms guard).

## 2. Shared motion constants

There is **no central motion-token module used by the fight**. What exists:

- `src/utils/animation.ts:5-18` `DURATION {instant 100, fast 150, normal 250, slow 400, slower 600}` and `EASING {easeOutExpo, easeOutBack, spring, bounce}` (cubic-bezier arrays / RN-Animated spring configs, not Reanimated). In the fight only `GameBoard.tsx:213` (`DURATION.fast`) and `:221` (`DURATION.normal`) use it. Elsewhere: `ScreenTransition.tsx`, `RoundSummary.tsx`, `ui/AnimatedCounter.tsx`.
- Local, per-file constants: `FX_TIMING` (`fx/script.ts:26`), `EASE` (`fx/visuals.tsx:21-26`: linear, out cubic, in quad, inOut quad), `GHOST_BREAK_MS` (`visuals.tsx:436`), `STAMP_SIZE`/`LEAD_STAMP_SIZE` (`visuals.tsx:329-333`), `ORB_GAP_MS` (`FxStage.tsx:19`), `CARD_MOTION` (`components/CardMotion.tsx:15`), `SHAKE_PRESETS` (`hooks/useScreenShake.ts:23`), `CLOSE_MS`/`GUARD_MS` (`EvolutionCutIn.tsx:26-27`), `HIT_TIERS` (`script.ts:21`).
- The "pop" (`withTiming(1.0x, ~90 ms, out quad)` then back) is hand-written 6 times with different numbers (anchors, StageBubble, ChallengeStrip, PowerMeter, TraitChecks, CardMotion pick). Shakes are written 3 ways (AdventureRun foe, AdventureRun screen, useScreenShake). No shared spring config.
- `fxClock.slow` (`fx/clock.ts:7`) is the only global time scale, and it reaches only part of the fight (see §6).

## 3. Entries

Notation: `seg(t,[x..],[y..])` = piecewise-linear keyframes (`visuals.tsx:45-52`). "default easing" = Reanimated `withTiming` default, `Easing.inOut(Easing.quad)`. "up" = `useProgress` (`visuals.tsx:37`, `withDelay(fxMs(delay), withTiming(1, {duration: fxMs(ms), easing}))`). Every fx-stage piece is in stage coordinates over the whole fight (`FxStage` zIndex 240).

Common reach for stage pieces: **/dev/fx** → tap `[data-testid="fx-event-<type>"]` (or `fx-cascade`); slow it with `fx-speed-4` / `fx-speed-10`. In a real fight: `/dev/adventure?save=before:<level>&intro=false` → `map-play-next` → `preview-play` → make a Set by reading `window.__nshapesRun.board` and tapping `[data-testid="card-slot-<row>-<col>"]`; `__nshapesFx.slow = 8` in the console slows the stage. Stage testIDs: `fx-stage`, `fx-ghost`, `fx-banner`, `fx-source-tag`, `floater-tier-<0..3>`, `fx-lead-word`.

Common reduced-motion for stage pieces: effects off (Pause → `toggle-effects`, or OS reduced motion; `AdventureMode.tsx:284` `effects = save.effectsOn && !reducedMotion`) → every beat is `quiet` with `at = land = 0` → only `fx-quiet-label` is drawn; no ghosts, no bumps, no orbs, nothing holds the clock.

### A. Stage: the Set's own hit

**1. fx-set-throw**
- where: `src/adventure/fx/visuals.tsx:445-483` (timing :449); mounted by `FxStage.tsx:240-245`; break scheduled `useFightFx.ts:129-131`
- sees: the three scored cards pop, then fly to the foe shrinking and spinning, with a white tint.
- trigger: lead beat (`hit` without text, `rainbow`, `surge_hit`) whose cards are attached at `AdventureRun.tsx:369-374`; breaks at beat `at = 0`.
- mechanism: Reanimated `withTiming` on one progress value; custom worklet curve.
- params: duration `GHOST_BREAK_MS.throw = 300` (`visuals.tsx:436`), `Easing.linear`; flight `f = seg(t,[0,.24,1],[0,0,1])`, `fly = f²` (ease-in); translate `dx·fly, dy·fly − seg(t,[0,.24,.6,1],[0,6,14,0])` px arc; scale `seg(t,[0,.14,.24,1],[1,1.16,1.1,.16])`; rotate `±24·fly` deg (alternates by `order`); opacity `seg(t,[0,.86,1],[1,1,0])`; tint white `seg(t,[0,.14,.4,1],[0,.9,.25,.5])`. Unmounted at 300 + `GHOST_SLACK_MS 20`. Target = foe centre. Board slot under it: `card-leaving` (#58).
- class: projectile/travel
- reduced-motion: no ghost (quiet beats skip covers, `useFightFx.ts:147`); the card just disappears via `CardLeaving` (GameBoard has no reduced path).
- reach: `/dev/fx` `fx-event-hit` / `fx-event-rainbow` / `fx-event-surge_hit` / `fx-cascade`; any Set in a fight. testID `fx-ghost`.
- smells: TWO-HEROES (card + 3 comets + burst all fly/land together), the card arrives at 300 ms while the burst/number/HP drop land at 240 ms (impact before the projectile), MAGIC-NUMBERS.

**2. fx-orb-comet**
- where: `visuals.tsx:56-90` (Dot :56, Comet :84); placed by `FxStage.tsx:190-201`
- sees: a coloured orb with a two-dot tail bows from the cards (or source chip / foe) to a HUD target.
- trigger: any beat with `flies` (row has `orb`, not sour, a contribution); starts at beat `at`.
- mechanism: Reanimated, `up` per dot.
- params: `ms = flight = land − at = FX_TIMING.flightMs 240`; easing `EASE.in` = `Easing.in(Easing.quad)`; tail dots delayed +26 / +52 ms at size ×0.72 / ×0.5; path bow `sin(πt)·bend`, `bend = (i%2?1:-1)·(12+7i)`; scale `seg(t,[0,.18,1],[.3,1.15,.7])`; opacity hard 0/1 at t≤0 / t≥1; up to `MAX_ORBS 3` per beat, `ORB_GAP_MS 45` apart; `orbSize = clamp(unit·0.2, 12, 20)·(lead?1.5:1) + 4·tier`; rainbow orbs cycle `RAINBOW` colours. Inbound foe moves (`to:'board'`): one orb from the foe to the first card only.
- class: projectile/travel
- reduced-motion: not drawn (quiet).
- reach: `/dev/fx` `fx-event-coins`, `fx-event-heal`, `fx-event-hurt`, `fx-event-dud`, `fx-cascade`.
- smells: NO-EXIT (orb blinks off on arrival, impact handled by others), orbs 2-3 of a lead hit arrive at 285/330 ms, after the burst at 240 (EVERYTHING-AT-ONCE inverted: stagger lands late), MAGIC-NUMBERS (26/52).

**3. fx-lead-burst**
- where: `FxStage.tsx:205-207` (Starburst `visuals.tsx:140-159`)
- sees: a big spiky comic burst on the foe where the Set lands.
- trigger: lead beat with damage > 0, delay = flight (240 ms).
- mechanism: Reanimated `up`, linear progress, keyframes.
- params: `ms 380`, delay `flight`; size `min(target.w·1.25, 150) + 14·tier`; scale `seg(t,[0,.28,.45,1],[.15,1.18,1,1.3])`; rotate `−14 → 10` deg; opacity `seg(t,[0,.6,1],[1,1,0])`; 3 nested polygons (11/9/6 spikes).
- class: impact/hit
- reduced-motion: not drawn.
- reach: `/dev/fx` `fx-event-hit`; any Set.
- smells: LINEAR-ON-POSITION (linear progress through scale keys), NO-ANTICIPATION (nothing on the foe before contact; foe flinch #36 starts same frame).

**4. fx-land-ring**
- where: `FxStage.tsx:208` (Ring `visuals.tsx:95-106`)
- sees: a ring grows out of the HUD target when an orb lands.
- trigger: every flying, outbound beat, delay = flight.
- mechanism: Reanimated `up`.
- params: `ms 300` (default), `EASE.out` = `Easing.out(Easing.cubic)`; size `36 + 14·tier + (lead ? 22 : 0)`; border 4 (lead) / 3; scale `0.25 + 0.75p`; opacity `seg(p,[0,.5,1],[1,.9,0])`.
- class: impact/hit
- reduced-motion: not drawn.
- reach: `/dev/fx` `fx-event-coins`, `fx-event-time_gain`.
- smells: MAGIC-NUMBERS.

**5. fx-land-ticks**
- where: `FxStage.tsx:209` and board bursts `:154` (Ticks `visuals.tsx:111-127`)
- sees: six short comic impact lines thrown out from the hit.
- trigger: flying beat with damage > 0 (delay flight); also every board `burst` (delay +60).
- mechanism: Reanimated `up`.
- params: `ms 260`, `EASE.out` (cubic); 6 lines at 0/60/…/300 deg, line length `size·0.24`, width 3; scale `0.45 + 0.75p`; opacity `seg(p,[0,.6,1],[1,1,0])`; size `54 + 16·tier + (lead?30:0)` (land) or `burstSize·1.3` (board).
- class: impact/hit
- reduced-motion: not drawn.
- reach: `/dev/fx` `fx-event-hit`, `fx-event-blast`.
- smells: none obvious.

**6. fx-lead-number**
- where: `FxStage.tsx:224` (Stamp `visuals.tsx:340-380`, `lead`)
- sees: the Set's damage ("−12") slams onto the foe in white with an ink edge, holds, drifts up and fades.
- trigger: lead beat with a label, delay = flight (240 ms).
- mechanism: Reanimated `up`, linear progress.
- params: `hold = 520 + 200·tier`, `total = hold + 400` (920-1520 ms); opacity `seg(t,[0,hold/total,1],[1,1,0])`; translateY `−seg(t,[0,.12,1],[0,4,16+6·tier])`; scale `seg(t,[0,.1,.2,1],[.5,1.45,1,1])`; font `LEAD_STAMP_SIZE {30,36,42,50}` shrunk to fit `0.66·maxX`; "MEGA " prefix at tier 3 (`script.ts:124`).
- class: number-pop
- reduced-motion: becomes `fx-quiet-label` (#23).
- reach: any Set; `/dev/fx` `fx-event-hit`. testID `floater-tier-<tier>`.
- smells: LINEAR-ON-POSITION (drift is piecewise linear), pops at full opacity from frame 0 (no fade-in), MAGIC-NUMBERS.

**7. fx-lead-word**
- where: `FxStage.tsx:225-227` (Stamp `sticker`)
- sees: the word before the number ("RAINBOW", "SURGE", "MEGA RAINBOW") as a white tag on top of the foe.
- trigger: lead label of the form `<word> −N` (`leadParts`, `FxStage.tsx:53-56`), same delay as #6.
- mechanism: Reanimated `up`.
- params: as #6 but `sticker`: size `13 + 3·tier`, scale `seg(...,[.5,1.22,1,1])`, y = top of foe + 4.
- class: number-pop
- reduced-motion: the quiet label shows the whole string instead.
- reach: `/dev/fx` `fx-event-rainbow`, `fx-event-surge_hit`. testID `fx-lead-word`.
- smells: EVERYTHING-AT-ONCE (word and number pop on the same frame; no lead-in).

### B. Stage: board effects

**8. fx-board-burst**
- where: `FxStage.tsx:150-156` (Starburst `visuals.tsx:140` + Ticks)
- sees: a spiky orange/red explosion on each card a blast destroys; the old card shatters underneath.
- trigger: rows with `board:'burst'`: `blast`, `pinata_break`, `trap_sprung`, `foe_defeated` (on foe), `evolution_start` (Catalyst card).
- mechanism: Reanimated `up`.
- params: Starburst `ms 440` linear, scale `seg(t,[0,.28,.45,1],[.15,1.18,1,1.3])`, rotate −14→10 deg, opacity `seg(t,[0,.6,1],[1,1,0])`, size `burstSize(r) = min(w·1.3, max(h·1.8, 44))`; Ticks at +60 ms, size ×1.3; per-card stagger `i·45` ms; inbound rows add `flight` delay.
- class: impact/hit
- reduced-motion: not drawn.
- reach: `/dev/fx` `fx-event-blast`, `fx-event-pinata_break`, `fx-event-trap_sprung`.
- smells: TWO-HEROES with #63/#62 (GameBoard also shakes and throws particles for the same blast), LINEAR-ON-POSITION.

**9. fx-ghost-shatter**
- where: `visuals.tsx:473` (+ tint :475), timing :449
- sees: a card destroyed by a blast/ricochet/link pops bigger, spins slightly and fades white.
- trigger: non-lead, non-beam beat with `cards` (blast, ricochet, link_burst, trap_sprung…), at beat `at`.
- mechanism: Reanimated `withTiming`.
- params: `240 ms` (`GHOST_BREAK_MS.shatter`), `Easing.in(Easing.quad)`; scale `seg(t,[0,.3,1],[1,1.14,.35])`; rotate `16t` deg; opacity `seg(t,[0,.45,1],[1,1,0])`; white tint `seg(t,[0,.25,1],[0,.85,.6])`.
- class: exit
- reduced-motion: no ghost; new card is just there.
- reach: `/dev/fx` `fx-event-blast`, `fx-event-ricochet`, `fx-event-link_burst`.
- smells: the replacement card's deal-in (#54) already ran underneath while the ghost covered it (wasted).

**10. fx-ghost-vaporise**
- where: `visuals.tsx:471-472`, timing :449
- sees: a card hit by a laser squashes flat into a line of the laser colour.
- trigger: beat with `board:'beam'` and cards (`laser`).
- mechanism: Reanimated `withTiming`.
- params: `240 ms`, `Easing.in(Easing.quad)`; scaleX `seg(t,[0,.3,1],[1,1.08,1.2])`, scaleY `seg(t,[0,.3,1],[1,.9,.04])`; opacity `seg(t,[0,.5,1],[1,1,0])`; tint = row colour `seg(t,[0,.25,1],[0,.85,.6])`.
- class: exit
- reduced-motion: none.
- reach: `/dev/fx` `fx-event-laser`.
- smells: none.

**11. fx-laser-beam**
- where: `FxStage.tsx:121-133` (geometry), `:179-181` (render); Beam `visuals.tsx:167-199`
- sees: a thick cyan beam with a white core shoots along the row/column (or from the source to each card), flickers, thins away.
- trigger: `laser` (and any row `board:'beam'`), at beat `at`.
- mechanism: Reanimated `up`, linear progress.
- params: `grow 90 + hold 150 + fade 130 = 370 ms`; scaleX `seg(t,[0,a],[.02,1])` (transformOrigin left); scaleY flicker `1 + 0.3·sin(3π·u)` during hold, then `seg(t,[b,1],[1,.05])`; opacity hard on/off; thickness `max(10, unit·0.2)`; pad `unit·0.12`; non-aligned cards: one beam per card from source, `i·50` ms stagger.
- class: impact/hit
- reduced-motion: not drawn.
- reach: `/dev/fx` `fx-event-laser`.
- smells: LINEAR-ON-POSITION (grow is linear scaleX), MAGIC-NUMBERS.

**12. fx-laser-flash**
- where: `FxStage.tsx:157-158` (Flash `visuals.tsx:204-208`)
- sees: each lasered card flashes cyan.
- trigger: `board:'beam'` places.
- mechanism: Reanimated `up` (linear).
- params: `ms 220`, delay `60 + i·30`; opacity `seg(p,[0,.2,1],[.95,.8,0])`; radius 12.
- class: impact/hit
- reduced-motion: not drawn.
- reach: `/dev/fx` `fx-event-laser`.
- smells: FADE-ONLY.

**13. fx-zap-bolt**
- where: `FxStage.tsx:134-138`, render `:179-181` (Beam, `core=false`)
- sees: a thin yellow/purple bolt jumping card to card.
- trigger: `board:'zap'`: `ricochet`, `link_burst`, `link`.
- mechanism: Reanimated `up`.
- params: Beam `grow 90 + hold 70 + fade 130 = 290 ms`, thickness `max(7, unit·0.08)`, hop delay `(i−1)·70`; one card + source: starts at the source chip.
- class: projectile/travel
- reduced-motion: not drawn.
- reach: `/dev/fx` `fx-event-ricochet`, `fx-event-link`.
- smells: LINEAR-ON-POSITION.

**14. fx-zap-ring**
- where: `FxStage.tsx:159-160` (Ring)
- sees: a ring on each card the bolt reaches.
- trigger: zap rows.
- mechanism: Reanimated `up`.
- params: Ring `300 ms` out cubic, size `unit·0.9`, delay `i·70 + 40`, width 3.
- class: impact/hit
- reduced-motion: not drawn.
- reach: as #13.
- smells: MAGIC-NUMBERS (70 duplicated with bolt hop by hand).

**15. fx-board-ring**
- where: `FxStage.tsx:167-173` (2 Rings)
- sees: two rings expanding from each card of the Set (or a fuse card).
- trigger: `board:'ring'`: `hit`, `rainbow`, `echo`, `countdown` (ambient), `surge_hit`.
- mechanism: Reanimated `up`.
- params: ring 1 size `unit·1.25`, width 4, delay `i·45`; ring 2 `unit·1.7`, width 3, delay +90; each 300 ms out cubic.
- class: ui-feedback / impact
- reduced-motion: not drawn.
- reach: `/dev/fx` `fx-event-hit`, `fx-event-countdown`, `fx-event-echo`.
- smells: on a Set the rings play under the flying ghost (hidden by it).

**16. fx-flames**
- where: `FxStage.tsx:161-162` (Flames `visuals.tsx:232-242`, Drop :210-229)
- sees: three flame drops lick up from the bottom of a card.
- trigger: `board:'flame'`: `fire`.
- mechanism: Reanimated `up`.
- params: each Drop `420 ms`, `EASE.out` (cubic); delays 0 / +70 / +35; size `unit·0.34·{1, .9, 1.15}`; rise `h·{.55,.5,.7}`; sway `±4/−4/3·sin(2πt)`; scale `seg(t,[0,.25,1],[.3,1.1,.5])`; opacity `seg(t,[0,.7,1],[1,.9,0])`; colours row / `#FF9538` / `#FFD23F`; rotate −45deg.
- class: impact/hit
- reduced-motion: not drawn (the card's own fire icon and `card-fire-overlay` #66 stay).
- reach: `/dev/fx` `fx-event-fire`.
- smells: none.

**17. fx-sparkles**
- where: `FxStage.tsx:163-164`, `:220`; Sparkles `visuals.tsx:264-273`, Twinkle :244-261
- sees: three 4-point twinkles pop and spin around a card.
- trigger: `board:'sparkle'`: `grow`, `regen` (on foe), `trap_defused`, `keen_eye` (ambient), `fetch`, `rule`, `pinata`, `catalyst_spawn`; also gold sparkles under the K.O. banner.
- mechanism: Reanimated `up`, linear.
- params: each `420 ms`; delays 0 / 80 / 150; size `max(14, unit·0.36)·{1, 1.25, .85}`; scale `seg(t,[0,.3,.6,1],[0,1.25,.9,.4])`; rotate `90t` deg; opacity `seg(t,[0,.7,1],[1,1,0])`. Sour beats swap sparkle→puff.
- class: impact/hit (positive)
- reduced-motion: not drawn.
- reach: `/dev/fx` `fx-event-catalyst_spawn`, `fx-event-grow`.
- smells: MAGIC-NUMBERS.

**18. fx-puff**
- where: `FxStage.tsx:165-166`; Puff `visuals.tsx:285-296`, Cloud :275-282
- sees: dark smoke puffs where the foe did something to a card.
- trigger: `board:'puff'`: `dud`, `face_down`, `bomb`, `triple`, `attr_shift`, `card_removed`, `trap_placed`; delayed by `flight` (after the dark orb arrives).
- mechanism: Reanimated `up`.
- params: each Cloud `380 ms`, `EASE.out`; delays 0/40/80; size `unit·0.6·{1,.8,.9}`; drift `(−.2u,−.12u)`, `(.22u,−.05u)`, `(0,.16u)`; scale `0.4 + 0.8p`; opacity `seg(p,[0,.4,1],[.85,.7,0])`.
- class: impact/hit (foe)
- reduced-motion: not drawn.
- reach: `/dev/fx` `fx-event-dud`, `fx-event-attr_shift`.
- smells: none.

**19. fx-sweep**
- where: `FxStage.tsx:144`; Sweep `visuals.tsx:311-325`
- sees: a slanted translucent band of colour crosses the whole board once.
- trigger: rows with `sweep`: `shuffle`, `wave`, `freeze`, `redeal`, `surge_start`, `surge_end`, `empowered`, `simplified`, `simplify_end`, `purity_max`, `evolution_start`, `evolution_end`.
- mechanism: Reanimated `up`.
- params: `ms 420`, `EASE.inOut` (quad); band width `w·0.5`, height `h·1.5`, rotate 16deg, borders 3/6; translateX `−2·band → w` (dark/whirl run right-to-left); opacity hard on/off; 7 colour kinds `SWEEPS` (`visuals.tsx:300-308`).
- class: screen-shake/camera (board wash)
- reduced-motion: not drawn.
- reach: `/dev/fx` `fx-event-wave`, `fx-event-freeze`, `fx-event-shuffle`, `fx-event-surge_start`.
- smells: DURATION-OUT-OF-BAND is fine; label for it pops 70 ms later on the same spot (EVERYTHING-AT-ONCE with the label).

**20. fx-aura-rings**
- where: `FxStage.tsx:183-188` (2 Rings)
- sees: two rings expand around your fighter (a save, a shield, a charge).
- trigger: `aura: true` rows: `grace`, `nine_lives`, `power_up`, `breather`, `thick_hide`, `free_mistake`, `arcana_burn`, `hot_streak`, `grudge`, `scoop`, `doubled`, `double_ready`, `charged`.
- mechanism: Reanimated `up`.
- params: ring 1 size `fighter.w·1.5`, width 4, `380 ms`; ring 2 `fighter.w·2.2`, delay 110, `420 ms`; out cubic.
- class: impact/hit
- reduced-motion: not drawn.
- reach: `/dev/fx` `fx-event-grace`, `fx-event-nine_lives`.
- smells: MAGIC-NUMBERS.

### C. Stage: words

**21. fx-label-sticker**
- where: `FxStage.tsx:229-230` (Stamp, `sticker` unless lead); positions `labelPoint` :37-45 and :103-117
- sees: a white tag ("+5¢", "BLAST!", "COMBO ×4") pops where its effect landed, holds, drifts up, fades.
- trigger: any beat with a label; delay `flight` if it flies, `flight + 60` inbound, else 70 ms.
- mechanism: Reanimated `up`, linear.
- params: `hold 520 + 200·tier`, `+400` fade; scale `seg(t,[0,.1,.2,1],[.5,1.22,1,1])`; translateY up `16 + 6·tier`; sticker font `13 + 3·tier`, non-sticker `STAMP_SIZE {19,27,35,44}`; lanes stack `(lane % 3)·18-30` px, foe lanes fan left in 2 columns (−44, −136 px).
- class: number-pop
- reduced-motion: becomes #23.
- reach: `/dev/fx` almost every `fx-event-*`. testID `floater-tier-<n>`.
- smells: LINEAR-ON-POSITION, EVERYTHING-AT-ONCE in a long cascade (labels only offset by step), MAGIC-NUMBERS (70/60).

**22. fx-label-sour-shake**
- where: `visuals.tsx:361-363` (Stamp `sour`)
- sees: bad news from your own gear: the red label shakes its head instead of popping.
- trigger: `isSour(e)` beats (`audio/fightAudio.ts`).
- mechanism: Reanimated `up`.
- params: translateX `seg(t,[0,.06,.12,.18,.24],[0,−6,6,−4,0])` (over the first 24% of `total ≈ 920 ms` ≈ 220 ms), scale fixed 1, colour `FX_COLOR.sour #B91C1C`.
- class: ui-feedback
- reduced-motion: quiet label (no shake? `quiet` Stamp does not pass `sour`, so no shake).
- reach: needs a sour event (rule with negative text, e.g. Tightrope / Thorn Bush); not in `/dev/fx` samples.
- smells: LINEAR-ON-POSITION (linear shake segments).

**23. fx-quiet-label**
- where: `FxStage.tsx:65-69`
- sees: with effects off, the event's words pop next to the foe (all at once).
- trigger: every beat when reduced, or chain steps past `maxSteps 14`.
- mechanism: Reanimated Stamp (`sticker` unless lead).
- params: as #21, delay 0.
- class: number-pop
- reduced-motion: this IS the reduced path; it still scales 0.5→1.22→1 and drifts.
- reach: `/dev/fx` `fx-reduced` then any event; in a fight Pause → `toggle-effects`.
- smells: EVERYTHING-AT-ONCE (by design), still animates in reduced motion.

**24. fx-ko-banner**
- where: `FxStage.tsx:217-221`; Banner `visuals.tsx:386-412`
- sees: "K.O.!" slams in tilted across the middle of the board, holds, lifts away; gold twinkles on the foe.
- trigger: `foe_defeated` (`banner: true`), delay `labelDelay = 70`.
- mechanism: Reanimated `up`, linear.
- params: `1150 ms`; opacity `seg(t,[0,.06,.8,1],[0,1,1,0])`; scale `seg(t,[0,.1,.17,.24,1],[2.4,.92,1.06,1,1])`; translateY `−seg(t,[.8,1],[0,26])`; rotate −5deg; font `clamp(26..64)`; Sparkles `#FFDE00` delay +80. The beat's `life` is `110 + 1000 = 1110 ms` (tier 0, no amount), but the banner ends at `70 + 1150 = 1220 ms`: it is **unmounted 110 ms before its exit finishes** (mid lift-away). Also `foe` burst (#8) and foe anchor bump on land.
- class: hero-reveal
- reduced-motion: quiet label "K.O.!" next to the foe.
- reach: `/dev/fx` `fx-event-foe_defeated`; win any fight. testID `fx-banner`.
- smells: NO-EXIT (cut before its fade ends), LINEAR-ON-POSITION, TWO-HEROES (lands with end-of-fight `band.finale`, foe crit reaction, burst).

**25. fx-source-tag**
- where: `FxStage.tsx:213-216`; Tag `visuals.tsx:415-428`
- sees: a small dark tag under the weapon/skill/evolution that fired, naming it.
- trigger: first beat of each source in a cascade (`named`), at beat `at`.
- mechanism: Reanimated `up` (no delay), linear.
- params: `700 ms`; opacity `seg(p,[0,.08,.75,1],[0,1,1,0])`; translateY `−5 → 0` over 10%; scale `seg(p,[0,.1,.2],[.7,1.08,1])`; rows by `step % 3` × 16 px.
- class: text-swap
- reduced-motion: not drawn.
- reach: `/dev/fx` `fx-event-blast` (source `w0:blast-powder`), `fx-event-laser`. testID `fx-source-tag`.
- smells: none.

### D. HUD reacting

**26. hud-anchor-bump**
- where: `src/adventure/fx/anchors.tsx:121-128`
- sees: a HUD part (foe, fighter, hearts, clock, coins, hint, graces, xp, combo, weapon/passive/evo chip) jumps.
- trigger: `anchors.bump(name)`: source at beat mount (`useFightFx.ts:128`), target + `row.bump` at land (:111-112).
- mechanism: Reanimated `withSequence(withTiming, withSpring)`.
- params: `withTiming(1.28, {duration: 70, easing: Easing.out(Easing.quad)})` then `withSpring(1, {damping: 9, stiffness: 320, mass: 0.6})`; scale only.
- class: ui-feedback
- reduced-motion: quiet beats skip bumps. Not scaled by `fxMs`.
- reach: `/dev/fx` `fx-event-coins` (coins chip), `fx-event-combo`; in fight any Set (foe anchor).
- smells: TWO-HEROES on the foe (anchor scales to 1.28 while `foeScale` squashes to 0.9 in #36 on the same frame), BOUNCE fine.

**27. belt-weapon-fire**
- where: `src/adventure/fx/GearBelt.tsx:19-31`
- sees: the weapon icon on the belt jumps (anchor bump) and plays its own avatar animation.
- trigger: bump `weapon:<id>` → `setFired(n+1)` → `WeaponAvatar triggerKey` (animation owned by `src/components/weapons`).
- mechanism: #26 + WeaponAvatar internals (other auditor).
- params: see #26; avatar params not here.
- class: character-acting
- reduced-motion: no bump when quiet; WeaponAvatar checks OS reduced motion.
- reach: `/dev/fx` `fx-event-blast` (Blast Powder on belt). testID `belt-<weaponId>`, `gear-belt`.
- smells: none here.

**28. hud-foe-flinch**
- where: `src/adventure/components/AdventureRun.tsx:316-317` (style :472, applied :710)
- sees: the foe portrait jerks sideways and squashes.
- trigger: `onLand` of rows with `shake: true` (hit, rainbow, blast, laser, pinata_break, surge_hit).
- mechanism: Reanimated `withSequence(withTiming…)`.
- params: translateX `−8 (40 ms) → 8 (60) → −4 (50) → 0 (50)` = 200 ms, default easing; scale `0.9 (60 ms) → 1 (120 ms, Easing.out(Easing.quad))`.
- class: impact/hit
- reduced-motion: **still plays** (`onLand` runs for quiet beats too, `useFightFx.ts:114`). Not `fxMs`-scaled.
- reach: any Set in a fight (not in `/dev/fx`: the studio has no `onLand`).
- smells: TWO-HEROES with #26, NO-ANTICIPATION, MAGIC-NUMBERS, shake restarts from scratch on every landing beat in a cascade.

**29. fx-screen-shake**
- where: `AdventureRun.tsx:319-322` (style :473, root :625)
- sees: the whole fight screen (HUD, board and effects) shakes sideways.
- trigger: `onLand` with `tier ≥ 2` (damage ≥ 25).
- mechanism: Reanimated `withSequence`.
- params: amp 6 (tier 2) / 10 (tier 3); `−amp 40 → amp 60 → −amp/2 50 → amp/2 50 → 0 50` = 250 ms, default easing, X only.
- class: screen-shake/camera
- reduced-motion: **still plays** with effects off / OS reduced motion.
- reach: a Set ≥25 damage (later worlds, `?save=maxed`); not in `/dev/fx`.
- smells: MAGIC-NUMBERS (third shake implementation), overlaps #61/#62 board shake.

**30. fx-mega-flash**
- where: `src/adventure/components/RunFx.tsx:18-25` (mounted `AdventureRun.tsx:1007`, fired :323)
- sees: a full-screen white flash.
- trigger: `onLand` with `tier === 3` (damage ≥ 50).
- mechanism: Reanimated `withSequence`.
- params: opacity `0.85 in 60 ms` (default easing) → `0 in 420 ms` `Easing.out(Easing.quad)`; zIndex 400.
- class: impact/hit
- reduced-motion: **still plays** (photosensitivity concern).
- reach: `?save=maxed`, a ≥50 Set; not in `/dev/fx`.
- smells: FADE-ONLY, TWO-HEROES (with mega number, screen shake, foe crit).

**31. hud-hp-drop**
- where: `AdventureRun.tsx:1150` (style :1153, view :1158)
- sees: the red HP fill shrinks as each hit lands.
- trigger: `shownHp` change (pending damage released at beat land).
- mechanism: Reanimated `withTiming` on `width` %.
- params: `140 ms`, `Easing.out(Easing.quad)`; colour steps at 50% / 25% (instant).
- class: progress
- reduced-motion: still animates; with effects off damage comes off at once.
- reach: any Set; testID `run-foe-hp`.
- smells: NOT-TRANSFORM/OPACITY (width), colour jumps instantly.

**32. hud-hp-trail**
- where: `AdventureRun.tsx:1151` (view :1157)
- sees: a pale trail of what was just taken, which catches up after a beat.
- trigger: same as #31 (rising HP snaps).
- mechanism: Reanimated `withDelay(withTiming)` on width.
- params: delay `260`, `340 ms`, `Easing.out(Easing.quad)`; when rising: set instantly.
- class: progress
- reduced-motion: none.
- reach: as #31.
- smells: NOT-TRANSFORM/OPACITY, trail restarts its 260 ms delay on every beat of a cascade (it may never move until the cascade ends).

**33. hud-goal-pop**
- where: `AdventureRun.tsx:1179` (ChallengeStrip :1169-1199)
- sees: the ★★★ goal strip pops when its text changes; turns teal with a tick when met.
- trigger: `challenge.text`/`met` change (not first render, not when failed); `band.cue('star')` when met.
- mechanism: Reanimated `withSequence`.
- params: `1.12` (met) / `1.06` in 90 ms `Easing.out(Easing.quad)` → `1` in 160 ms `Easing.inOut(Easing.quad)`; teal colour swap instant; failed → opacity .55 + line-through instant.
- class: ui-feedback
- reduced-motion: none.
- reach: any level but 1-1 (`level.id !== '1-1'`); testID `run-challenge`.
- smells: DURATION-OUT-OF-BAND (250 ms total for ui feedback is fine; the met state is a reward moment that only gets a 1.12 pop), not tied to the cascade (pops at engine time, before the beat that caused it lands).

**34. hud-stage-bubble-pop**
- where: `src/adventure/components/StageBubble.tsx:47-51`
- sees: a new line in the speech bubble pops in.
- trigger: `text` change (coach line, foe taunt, remark, mistake explanation).
- mechanism: Reanimated `withSequence`.
- params: `0.9` instantly (0 ms) → `1.04` in 110 ms `Easing.out(Easing.quad)` → `1` in 90 ms (default easing).
- class: text-swap
- reduced-motion: none.
- reach: any fight; testIDs `run-coach-banner`, `run-foe-taunt` (taunt for `FOE_TAUNT_MS 2400`).
- smells: NO-EXIT (bubble vanishes instantly when `coachBubble` becomes null; taunt → coach swap is a hard cut), FADE-less snap to 0.9.

**35. hud-power-pop**
- where: `src/adventure/components/PowerMeter.tsx:22-27`
- sees: the POWER ×N chip pops each time it climbs a tenth; background heats up.
- trigger: `floor(powerMultiplier·10)` increases.
- mechanism: Reanimated `withSequence`.
- params: `1.25` in 90 ms `Easing.out(Easing.quad)` → `1` in 220 ms (default easing); background steps `heat()` (instant) at ×2/×5/×10.
- class: number-pop
- reduced-motion: none.
- reach: when `showDamageHud` and `run.power > 0` (World 2+ with gear); testID `run-power`.
- smells: MAGIC-NUMBERS.

**36. hud-trait-checks-pop**
- where: `src/adventure/components/TraitChecks.tsx:56-62`
- sees: the trait-check strip above the board pops when new checks appear.
- trigger: change of `said` (checks string).
- mechanism: Reanimated `withSequence`.
- params: `1.04` in 90 ms `Easing.out(Easing.quad)` → `1` in 140 ms `Easing.inOut(Easing.quad)`; cell contents swap instantly.
- class: text-swap
- reduced-motion: none.
- reach: early levels where `showsTraitChecks(level)`; testID `run-trait-checks`; `/dev/adventure?save=fresh&intro=false`.
- smells: whole strip scales (cells are not individually revealed), EVERYTHING-AT-ONCE.

**37. hud-evo-ring-countdown**
- where: `RunFx.tsx:51-77`
- sees: an evolution's icon inside a ring that empties; ring turns red at ≤5 s.
- trigger: `remainingMs` per `TICK` (250 ms).
- mechanism: SVG `strokeDasharray` re-rendered from React state (no tween).
- params: size 34, r 14, stroke 4; updates at 4 Hz.
- class: progress
- reduced-motion: n/a.
- reach: start an evolution (`?save=maxed`, match a Catalyst); testID `evolution-ring`.
- smells: TIMER-DRIVEN (4 Hz steps), NO-EXIT (ring just disappears when it ends).

**38. board-evolution-glow**
- where: `AdventureRun.tsx:1254-1267`
- sees: a soft glow behind the cards pulses while an evolution runs.
- trigger: `run.activeEvolutions.length > 0`, loop while `playing && appActive`.
- mechanism: Reanimated `withRepeat(withSequence)`, `-1`.
- params: opacity `0.25 ↔ 0.6`, 500 / 500 ms, default easing.
- class: ambient-loop
- reduced-motion: none (only paused/backgrounded).
- reach: as #37; testID `evolution-glow`.
- smells: FADE-ONLY, NO-EXIT (unmounts at full value when it ends).

**39. hud-surge-pulse**
- where: `AdventureRun.tsx:1273-1306`
- sees: the Shading Surge bar pulses as a surge nears and during it; its fill moves.
- trigger: `imminent || surge.active`, gated `playing && appActive`.
- mechanism: Reanimated `withRepeat(withSequence)` or `withTiming`.
- params: scale `1.04 ↔ 1`, 260 / 260 ms, default easing; otherwise `withTiming(1, 120)`. Fill `width` set from state every TICK (no tween).
- class: ambient-loop
- reduced-motion: none.
- reach: Worlds 3-5, `/dev/adventure?save=before:3-1&intro=false`; testID `run-surge-bar`.
- smells: NOT-TRANSFORM/OPACITY (fill width, steps at 4 Hz), TIMER-DRIVEN.

**40. board-surge-glow**
- where: `AdventureRun.tsx:1308-1321`
- sees: a pink glow behind the board pulses during a surge.
- trigger: `run.surge?.active`.
- mechanism: Reanimated `withRepeat(withSequence)`, `-1`.
- params: opacity `0.2 ↔ 0.5`, 380 / 380 ms, default easing.
- class: ambient-loop
- reduced-motion: none.
- reach: as #39; testID `surge-glow`.
- smells: FADE-ONLY, NO-EXIT.

**41. fight-opening-banner**
- where: `AdventureRun.tsx:975-979` (timers :201-212)
- sees: "FIGHT!" (or "BOSS FIGHT!") slams across the board as the fight opens; a bell rings.
- trigger: mount (`opening` true for 1500 ms), effects on, not practice.
- mechanism: Banner (#24 params) + JS timers.
- params: Banner `1150 ms`, delay 120; `setOpening(false)` at 1500 ms; `band.cue('wave')` at 260 ms; colour `#9F1239` boss / `deepOnyx`.
- class: hero-reveal
- reduced-motion: hidden when effects off.
- reach: start any fight: `preview-play`; testID `run-opening`, `fx-banner`.
- smells: TWO-HEROES / EVERYTHING-AT-ONCE (board deal-in, fighter + foe entrance reactions, taunt bubble pop and the banner all start at mount), sound at 260 ms vs slam at ~120-235 ms.

**42. evo-banner-reduced**
- where: `RunFx.tsx:28-48` (mounted `AdventureRun.tsx:993-1006`, removed by `useFightFx.ts:172` after `BANNER_MS 2700`)
- sees: with effects off, a dark strip slides in naming the evolution.
- trigger: cut-in segment while reduced.
- mechanism: Reanimated.
- params: translateX `−40 → 0` 220 ms `Easing.out(Easing.cubic)`; opacity `1` in 160 ms, hold 2000, `0` in 400 ms (default easing).
- class: panel-entrance
- reduced-motion: this is the reduced path, but it still slides.
- reach: effects off + evolution; `/dev/fx` shows only a static placeholder (`fx.banner` text) instead. testID `evolution-banner` (duplicate of the cut-in row testID).
- smells: EXIT-SLOWER-THAN-ENTER (400 vs 160-220), FADE-ONLY exit.

**43. panel-modal-fade**
- where: `AdventureRun.tsx:1057, 1107, 1117, 1343, 1372`; `HudInspector.tsx:259`
- sees: pause, weapon explainer, power explainer, level-up pick, intermission/shop and HUD inspector overlays fade in/out.
- trigger: open/close of each modal.
- mechanism: RN `Modal animationType="fade"`; on web react-native-web CSS keyframes (`ModalAnimation.js`: 250 ms, in `cubic-bezier(0.215,0.61,0.355,1)`, out `cubic-bezier(0.47,0,0.745,0.715)`).
- params: as above (library default).
- class: panel-entrance / exit
- reduced-motion: none.
- reach: tap the `II` pause button (`accessibilityLabel="Pause"`), `belt-<id>`, `run-power`, `run-foe-inspect`, `run-challenge`; level-up `pick-<n>`; waves `shop-buy-<n>`, `next-wave`.
- smells: FADE-ONLY.

**44. panel-popin**
- where: `src/adventure/components/ui.tsx:146-156` (used in all modals above)
- sees: the panel scales up slightly as it appears.
- trigger: modal content mount.
- mechanism: Reanimated `withDelay(withTiming)`.
- params: scale `0.94 → 1` 180 ms `Easing.out(Easing.cubic)`; opacity `0 → 1` 140 ms (default easing); delay prop 0.
- class: panel-entrance
- reduced-motion: none.
- reach: as #43.
- smells: NO-EXIT (only the Modal fade), stacked with #43's own 250 ms fade.

**45. fight-end-handoff**
- where: `AdventureRun.tsx:425-430`
- sees: after the last cascade, the fight screen sits still, then the results screen replaces it.
- trigger: `ended && !fx.busy`.
- mechanism: JS `setTimeout`.
- params: `900 ms` (effects on) / `1300 ms` (off), then `onFinish`.
- class: exit
- reduced-motion: longer wait.
- reach: win or lose any fight.
- smells: DEAD-TIME (900 ms with only the K.O. banner's tail), NO-EXIT (hard screen swap).

### E. Board (GameBoard / Card / CardMotion)

**46. card-deal-in**
- where: `src/components/CardMotion.tsx:45-51` (style :88-91)
- sees: a new card grows into its slot with a slight overshoot.
- trigger: mount of `CardMotion` (slot key includes `card.id`, `GameBoard.tsx:655`, so every new card), initial board too.
- mechanism: Reanimated `withDelay(withTiming)`.
- params: delay `column · CARD_MOTION.dealStaggerMs (45)`, duration `CARD_MOTION.dealMs (190)`, `Easing.out(Easing.back(1.6))`; scale `0.72 + 0.28·deal`; opacity `min(1, 1.6·deal)`.
- class: panel-entrance
- reduced-motion: OS reduced motion → `deal = 1` (no motion). Not affected by the effects toggle.
- reach: any Set (after `REPLACE_DELAY_MS 560`); fight start. Slots `card-slot-<r>-<c>`.
- smells: EVERYTHING-AT-ONCE (stagger by column only: all rows deal together), runs hidden under ghosts for blast-removed cards, BOUNCE-ON-OPACITY (back easing drives opacity too, clamped).

**47. card-pick-lift**
- where: `CardMotion.tsx:53-60` (:57-58)
- sees: a tapped card pops up and stays slightly lifted; its border turns yellow (instant, Card.tsx `styles.selected` :613).
- trigger: `selected` true (not first mount).
- mechanism: Reanimated `withSequence(withTiming, withSpring)`.
- params: `1.1` in 70 ms `Easing.out(Easing.quad)` → spring to `CARD_MOTION.pickedScale 1.045` `{damping: 11, stiffness: 300, mass: 0.6}`.
- class: ui-feedback
- reduced-motion: OS reduced → none.
- reach: tap `card-slot-<r>-<c>` in a fight.
- smells: none (fast, transform-only).

**48. card-deselect**
- where: `CardMotion.tsx:59`
- sees: a deselected card settles back.
- trigger: `selected` false (tap again, or 500 ms after a miss, `GameBoard.tsx:498-500`).
- mechanism: Reanimated `withTiming`.
- params: `1` in 110 ms `Easing.out(Easing.quad)`.
- class: ui-feedback
- reduced-motion: OS reduced → none.
- reach: tap a card twice.
- smells: none.

**49. card-hint-hop**
- where: `CardMotion.tsx:62-82`
- sees: a pointed-out card (hint, guided step, rescue, Keen Eye) hops twice, rests, hops again; warm fill `#FFF3B0` (instant, `Card.tsx:622`).
- trigger: `pointedOut && !selected && !reduced && appActive` (hint button `run-hint`, auto-hint, coach glow).
- mechanism: Reanimated `withRepeat(withSequence(...), -1)`.
- params: `1` 150 ms out quad → `0` 200 ms in quad → `0.5` 120 ms out quad → `0` 160 ms in quad → rest `withDelay(CARD_MOTION.hopRestMs 1500, withTiming(0, 1))`; translateY `−7·hop` px; stop: `withTiming(0, 90)`.
- class: ambient-loop
- reduced-motion: OS reduced → none (fill stays).
- reach: `run-hint`; 1-1 walk-through (`/dev/adventure?save=fresh&intro=false`, `window.__nshapesLit` lists lit card ids).
- smells: none (good).

**50. card-leaving**
- where: `CardMotion.tsx:101-110` (used `GameBoard.tsx:663-669`)
- sees: the scored card stays in place 110 ms (under the flying ghost), then is gone; slot shows a faint grey (`emptiedSlot`, `rgba(56,56,56,0.05)`) until the next card is dealt.
- trigger: card has a reward and `quietRewards` (Adventure).
- mechanism: Reanimated `withDelay(withTiming(0, 1 ms))`.
- params: `CARD_MOTION.leaveAfterMs 110`; replaced at `REPLACE_DELAY_MS 560` (`AdventureRun.tsx:60`); reward cleared after `REWARD_REVEAL_MS 1500` (`GameBoard.tsx:37`).
- class: exit
- reduced-motion: none (instant hide either way).
- reach: any Set; testID `card-slot-emptied`.
- smells: DEAD-TIME (empty slot from ~300 ms when the ghost is gone to 560 ms + deal 190 ms).

**51. board-set-flash**
- where: `GameBoard.tsx:210-215` (overlay :559-562)
- sees: the whole board flashes faintly white on a valid Set.
- trigger: valid (or grace) Set, after the 200 ms validation delay.
- mechanism: Reanimated `withSequence`.
- params: opacity `0.15` in 50 ms → `0` in `DURATION.fast 150` (default easing).
- class: ui-feedback
- reduced-motion: none.
- reach: any Set.
- smells: FADE-ONLY, TWO-HEROES-lite (competes with the throw start).

**52. board-miss-flash**
- where: `GameBoard.tsx:217-224` (overlay :563-566)
- sees: the board flashes red on a wrong pick.
- trigger: invalid selection after 200 ms.
- mechanism: Reanimated `withSequence`.
- params: `#EF4444` opacity `0.2` in 50 ms → `0` in `DURATION.normal 250`.
- class: ui-feedback
- reduced-motion: none.
- reach: tap three cards that are not a Set.
- smells: FADE-ONLY (no per-card feedback; the three cards stay lifted 500 ms then drop, `GameBoard.tsx:498`).

**53. board-miss-shake**
- where: `GameBoard.tsx:223` → `src/hooks/useScreenShake.ts:84-122` (`shake('medium')`)
- sees: the board shakes on a wrong pick.
- trigger: invalid selection.
- mechanism: Reanimated `withSequence` of `withTiming` on X/Y.
- params: `SHAKE_PRESETS.medium {offset 5, duration 150, iterations 3}` → 7 legs of `150/7 ≈ 21.4 ms`, x `±5, ±3.33, ±1.67, 0`, y half; `Easing.linear`, last leg `Easing.out(Easing.cubic)`.
- class: screen-shake/camera
- reduced-motion: none.
- reach: as #52.
- smells: LINEAR-ON-POSITION, legs shorter than a 60 Hz frame-pair (jittery), MAGIC-NUMBERS.

**54. board-blast-shake**
- where: `GameBoard.tsx:459-462` → `useScreenShake.ts:43-79` (`triggerShake(n)`)
- sees: the board shakes when a blast weapon fires.
- trigger: `weaponEffects.explosiveCards.length > 0` (the same blasts the engine turns into `blast` events, `engine/run.ts:268`).
- mechanism: Reanimated `withSequence`.
- params: amp `min(n/5,1)·8` px, oscillations `min(3 + floor(n/2), 8)`, each `300/osc` ms, decay 0.85, random 0.8-1.2 (x) / 0.6-1.0 (y) jitter, `Easing.inOut(Easing.quad)`, last `Easing.out(Easing.cubic)`.
- class: screen-shake/camera
- reduced-motion: none.
- reach: hold Blast Powder (`?save=maxed`), make Sets until it fires.
- smells: TWO-HEROES (fires 200 ms after the tap, before the fx-stage blast beat at step ≥2, so the shake and the burst do not coincide), uses `Math.random` in UI.

**55. board-blast-particles**
- where: `GameBoard.tsx:226-242` (rendered :567) → `src/hooks/useParticles.tsx:90-107`
- sees: 15 explosion particles per destroyed card, sprayed around a fixed point of the board.
- trigger: same as #54.
- mechanism: Reanimated `withTiming` per particle (x, y, rotate, opacity, scale), JS cleanup timers.
- params: centre hard-coded `(150, 200)` ± 50 px random, not the card position; speed 5-13, lifetime 400-600 ms, gravity 0.1, colours `#FF9538 #FF7169 #FFDE00 #383838`, scale → 0, default easing.
- class: impact/hit
- reduced-motion: none.
- reach: as #54.
- smells: TWO-HEROES (duplicates `fx-board-burst`), wrong place, EVERYTHING-AT-ONCE.

**56. board-validate-delay**
- where: `GameBoard.tsx:434` (and `:498` 500 ms deselect after a miss; `AdventureRun.tsx:462` 520 ms replace after a miss)
- sees: after the third tap nothing happens for 200 ms except the lift pop.
- trigger: third card tapped.
- mechanism: JS `setTimeout(200)`.
- params: 200 ms; miss: deselect at 500 ms, cards replaced at 520 ms.
- class: ui-feedback
- reduced-motion: same.
- reach: any Set.
- smells: DEAD-TIME, TIMER-DRIVEN.

**57. card-press-dim**
- where: `src/components/Card.tsx:283-299` (`TouchableOpacity activeOpacity={isUnselectable ? 1 : 0.9}`)
- sees: the card dims slightly while pressed.
- trigger: press.
- mechanism: RN/RNW `TouchableOpacity` (web: CSS `transition opacity`; press-in 0 ms on responder grant else 150 ms, release 250 ms; RNW `TouchableOpacity/index.js:77-105`).
- params: opacity 1 → 0.9.
- class: ui-feedback
- reduced-motion: none.
- reach: press any card.
- smells: DURATION-OUT-OF-BAND (250 ms release for ui feedback), FADE-ONLY (the lift in #47 carries the real feedback).

**58. card-fire-overlay**
- where: `Card.tsx:384-394` + `src/hooks/useBurnTimer.ts:5, 58-80`
- sees: a burning card reddens, then burns away (fx `fire` flames play on the new card).
- trigger: `card.onFire`.
- mechanism: JS `setInterval(100)` updating React state → backgroundColor alpha.
- params: `FIRE_BURN_DURATION 250 ms`; overlay `rgba(239,68,68, progress·0.3)`; 100 ms tick → 2-3 visible steps; pauses with `isPaused`.
- class: progress
- reduced-motion: none.
- reach: hold Flint Spark (`?save=maxed`); `/dev/fx` cards never burn.
- smells: TIMER-DRIVEN (steppy), NOT-TRANSFORM/OPACITY (background colour via re-render).

### F. Cut-in (evolution)

All: `src/adventure/fx/EvolutionCutIn.tsx`; reach `/dev/fx` `fx-evolution` / `fx-evolution-2`, in fight match a Catalyst (`?save=maxed`); testIDs `evolution-cutin` (tap target), `evolution-banner` (each recipe row). Reduced: replaced by #42. `fxMs` scales only the first four tracks, `GUARD_MS` and the prompt's start delay.

**59. cutin-dim** — where :159, :174. sees: the screen darkens. trigger: mount. mechanism: derived from `slash`. params: opacity `0.66 · min(1, 2·slash) · (1 − out)` → full at 60 ms. class panel-entrance. reduced: n/a. smells: FADE-ONLY (fine for a scrim).

**60. cutin-slash** — where :121, :161, :182. sees: a white blade with yellow edges crosses the screen rising to the right (−9°). trigger: mount. mechanism: Reanimated `withTiming`. params: `scaleX 0→1`, `fxMs(120)`, `Easing.out(Easing.quad)`, transformOrigin left; opacity `1 − open`. class hero-reveal. smells: DURATION-OUT-OF-BAND (hero <300 ms, but it is one beat of a hero).

**61. cutin-flash** — where :122, :160, :184. sees: a white flash as the blade lands. params: `withDelay(fxMs(90), withSequence(withTiming(0.75, fxMs(40)), withTiming(0, {fxMs(320), Easing.out(Easing.quad)})))`. class impact/hit. smells: FADE-ONLY; second full-screen white flash in the fight (#30).

**62. cutin-band-open** — where :123, :162. sees: the cut opens into a slanted dark band with yellow borders. params: `withDelay(fxMs(110), withTiming(1, {fxMs(260), Easing.out(Easing.back(1.5))}))` on `scaleY` (min 0.001), opacity 0/1 step. class hero-reveal. smells: none.

**63. cutin-content-in** — where :124, :163, :178-180. sees: icon, name, fused weapons, text and chips slide in from the left. params: `withDelay(fxMs(230), withTiming(1, {fxMs(280), Easing.out(Easing.cubic)}))`; opacity 0→1, translateX −90→0. class hero-reveal. smells: EVERYTHING-AT-ONCE (all rows and all recipes move as one block; no stagger between name, chips, second recipe).

**64. cutin-speed-lines** — where :29-50, :177. sees: four faint white streaks race across the band forever. trigger: mount, gated `useAppActive`. mechanism: `withDelay(delay, withRepeat(withTiming(1, {ms, Easing.linear}), -1))`. params: `SPEED_LINES` top 12/34/58/80 %, width 220/120/280/160, ms 760/620/900/700, delay 0/180/90/260 (not `fxMs`-scaled); translateX `span → −width`. class ambient-loop. smells: none (linear is right for streaks); not slowed by the studio.

**65. cutin-tap-prompt** — where :127-136, :164, :185-187. sees: "TAP TO CONTINUE" pulses at the bottom. params: `withDelay(fxMs(750), withRepeat(withSequence(withTiming(1, 500), withTiming(0.35, 500)), -1, true))` (reverse = true on a sequence that already returns), opacity × `(1 − out)`; backgrounded → 0.7. class ambient-loop. smells: FADE-ONLY, the reverse flag makes the cycle 1→.35→(reversed).35→1, i.e. uneven holds.

**66. cutin-close** — where :138-143, :159-164. sees: on tap the band collapses and the dim lifts. trigger: tap after `GUARD_MS 450` (scaled), or `autoDismissMs 1600` for the auto-player. mechanism: `withTiming(1, {CLOSE_MS 170, Easing.in(Easing.quad)})` + `setTimeout(170)` → `onDone` (both unscaled). class exit. smells: content does not exit on its own (it is squashed with the band), TIMER-DRIVEN (setTimeout parallel to the animation), unscaled by `fxMs`.

### G. Character acting (cross-reference only)

**67. char-fighter-reaction** — `AdventureRun.tsx:324-330` (`conductor.triggerReaction('ecstatic'|'pain')`, `triggerHeal`, `triggerPowerup`, `triggerEntrance`), also `triggerMatch`/`triggerMistake`/`triggerHint` (:444, :455, :467), mood/streak props (:676-678). Animation lives in `src/components/fighters/FighterAvatar.tsx` (other auditor). Trigger: beat land (`row.fighter`), Set, miss, hint. Still fires with effects off.

**68. char-foe-reaction** — `AdventureRun.tsx:331-338` (`triggerEnemyReaction('crit_pain'|'pain'|'taunt'|'attack'|'regen'|'entrance')`), entrance at mount (:304-307), taunt on miss (:456). Animation in `src/components/enemies/EnemyAvatar.tsx` (other auditor). Note the foe avatar sits inside `foeStyle` (#28) inside `Anchor` (#26): three transforms stacked.

**69. char-weapon-trigger** — `WeaponAvatar triggerKey` on the belt (#27) and in the shop (`AdventureRun.tsx:1401`, tap a shop item). Other auditor.

### H. State changes that are NOT animated (candidates, not entries)

| Change | Where | Today |
|---|---|---|
| Card selection border/glow (yellow) | `Card.tsx:132-133, 613-620` | instant style swap (motion is #47) |
| Pointed-out warm fill | `Card.tsx:136-138, 622-624` | instant |
| Guided dimming of other cards | `GameBoard.tsx:659` (`dimmedOpacity` 0.4) | instant opacity |
| Web hover shadow | `Card.tsx:288, 809-812` | instant |
| Countdown/bomb overlay urgent ≤5 s | `Card.tsx:246-270` | instant |
| Clock chip held (teal) | `AdventureRun.tsx:745-747` | instant |
| Combo pill appears/updates | `AdventureRun.tsx:694-701` | pops in/out (bumped by `combo` row) |
| XP bar fill | `AdventureRun.tsx:783-786` | width jumps (only the anchor bumps) |
| Inactivity bar fill | `AdventureRun.tsx:652-656` | width jumps |
| Hearts lose/gain | `AdventureRun.tsx:1324-1340` | glyph swap (anchor bumps) |
| Coins / hints / graces numbers | `AdventureRun.tsx:753-777` | text swap (anchor bumps) |
| Synergy chips (purity, NEXT ×2, Clarity, evo chip, Catalyst ready) | `AdventureRun.tsx:791-911` | appear/disappear instantly |
| HP bar colour 50%/25% | `AdventureRun.tsx:1158` | instant |
| Frozen badge | `AdventureRun.tsx:938-943` | instant |
| Tip card + dim | `AdventureRun.tsx:1010-1038` | no animation at all |
| Belt growth stacks badge `+N` | `GearBelt.tsx:33-37` | instant |

## 4. Catalog table (`EVENT_FX`, `src/adventure/fx/catalog.ts:63-157`, 72 keys)

Timing per beat: `land = at + 240` if it flies (orb, outbound or inbound), else `at + 110`; `life = (land − at) + 1000 + 250·tier`. Piece durations: burst 440 (+ticks 260 @+60), beam 370 + flash 220, zap bolt 290/hop + ring 300, flame 420 (+70), sparkle 420 (+150), puff 380 (+80, after flight when inbound), ring 2×300 (+90), sweep 420, aura 380 / 420 @+110, orb 240 (+52 tail, +45/orb), land ring 300, land ticks 260 (damage only), lead burst 380 (lead with damage), label 920+200·tier, banner 1150, tag 700 (named source).

| key | board | orb → to (from) | sweep / aura | flags | fighter / foe | label | land / life (tier 0) |
|---|---|---|---|---|---|---|---|
| hit | ring | damage → foe (fighter) | | damage, shake | – / hit | `−N` or `<text> −N` | 240 / 1240 |
| rainbow | ring | rainbow → foe | | damage, shake | ecstatic / criticalHit | `RAINBOW −N` | 240 / 1240 |
| blast | burst | damage → foe | | damage, shake | – / hit | `BLAST −N` / `BLAST!` | 240 / 1240 |
| laser | beam | damage → foe | | damage, shake | – / hit | `LASER −N` / `LASER!` | 240 / 1240 |
| ricochet | zap | damage → foe | | damage | – / hit | `RICOCHET…` | 240 / 1240 |
| link_burst | zap | damage → foe | | | – / hit | `LINKED!` | 240 / 1240 |
| echo | ring | damage → foe | | | – / hit | `ECHO!` | 240 / 1240 |
| fire | flame | – | | | | `BURNING` | 110 / 1110 |
| pinata_break | burst | damage → foe | | damage, shake | ecstatic / criticalHit | `PIÑATA −N` | 240 / 1240 |
| overkill | – | coin → coins (foe) | | | | `OVERKILL +N` (coinText) | 240 / 1240 |
| heal | – | heart → hearts (set) | | | heal | `+N♥` | 240 / 1240 |
| coins | – | coin → coins (set) | | | | `+N¢` | 240 / 1240 |
| time_gain | – | time → clock (set) | | | | `+Ns` | 240 / 1240 |
| hint | – | hint → hint (set) | | | | `+N hint` | 240 / 1240 |
| grace | – | – | aura | bump graces | | `GRACE!` | 110 / 1110 |
| levelup | – | xp → xp (set) | | | powerup | `LEVEL UP!` | 240 / 1240 |
| grow | sparkle | – | | | | `+N card(s)` | 110 / 1110 |
| hurt | – | dark → hearts (foe) | | | – / gloat | `−N♥` (sour colour) | 240 / 1240 |
| mistake | null (board red flash + shake, #52/#53) | | | | | | – |
| nine_lives | – | – | aura | bump passive:nine_lives, hearts | heal | `NINE LIVES!` | 110 / 1110 |
| power_up | – | – | aura | | powerup | `POWER UP` | 110 / 1110 |
| breather | – | heart → hearts (fighter) | aura | | heal | `HEARTS REFILLED` | 240 / 1240 |
| thick_hide | – | – | aura | bump passive:thick_hide | heal | `THICK HIDE!` | 110 / 1110 |
| free_mistake | – | – | aura | | | `NO HARM` | 110 / 1110 |
| arcana_burn | – | – | aura | | | `CONTROLLED BURN!` | 110 / 1110 |
| dud | puff | dark → board (foe) | | | – / attack | `DUD` | 240 / 1240 |
| face_down | puff | dark → board (foe) | | | – / attack | `HIDDEN` | 240 / 1240 |
| countdown | ring | – | | ambient | | – | 110 / 1110 |
| bomb | puff | dark → board (foe) | | | – / attack | `BOMB` | 240 / 1240 |
| triple | puff | dark → board (foe) | | | – / attack | `ARMORED` | 240 / 1240 |
| attr_shift | puff | dark → board (foe) | | | – / attack | `CHANGED` | 240 / 1240 |
| card_removed | puff | dark → board (foe) | | | – / attack | `CARD TAKEN` | 240 / 1240 |
| shuffle | – | – | sweep dark | | – / attack | `SHUFFLED!` | 110 / 1110 |
| time_stolen | – | dark → clock (foe) | | | pain / attack | `TIME STOLEN` | 240 / 1240 |
| inactivity | – | dark → fighter (foe) | | | pain / attack | `TOO SLOW!` | 240 / 1240 |
| regen | sparkle (on foe) | – (from foe) | | ambient | – / regen | `+N HP` | 110 / 1110 |
| trap_placed | puff | dark → board (foe) | | | – / attack | `TIME BOMB` / `SNARE` | 240 / 1240 |
| trap_defused | sparkle | damage → foe | | | – / hit | `DEFUSED +N` / `DEFUSED!` | 240 / 1240 |
| trap_sprung | burst | – (from hearts) | | | pain / gloat | `SPRUNG!` | 110 / 1110 |
| foe_defeated | burst (on foe) | – (from foe) | | banner, bump foe | ecstatic | `K.O.!` banner 1150 | 110 / 1110 (banner cut at 1110 of 1220) |
| wave | – | – | sweep gold | | entrance / entrance | `WAVE N` | 110 / 1110 |
| time_up | – | – | | bump clock | | `TIME'S UP` | 110 / 1110 |
| moves_out | – | – | | bump clock | | `OUT OF MOVES` | 110 / 1110 |
| combo | – | – | | bump passive:combo, combo | ecstatic | `COMBO ×N` | 110 / 1110 |
| hot_streak | – | – | aura | bump passive:hot_streak | powerup | `HOT STREAK READY` | 110 / 1110 |
| hot_streak_hit | – | spark → foe (passive:hot_streak) | | | ecstatic / criticalHit | `HOT STREAK ×N` | 240 / 1240 |
| grudge | – | – | aura | bump passive:grudge | | `GRUDGE N` | 110 / 1110 |
| grudge_release | – | spark → foe (passive:grudge) | | | ecstatic / criticalHit | `GRUDGE +N` | 240 / 1240 |
| patience | – | spark → foe (passive:patience) | | | – / hit | `PATIENCE +N` | 240 / 1240 |
| freeze | – | – | sweep frost | bump passive:deep_freeze, clock | ecstatic | `FROZEN!` | 110 / 1110 |
| redeal | – | – | sweep whirl | bump passive:zoomies | ecstatic | `ZOOMIES!` | 110 / 1110 |
| scoop | – | – | aura | bump passive:big_scoop | ecstatic / criticalHit | `BIG SCOOP!` | 110 / 1110 |
| keen_eye | sparkle | – | | bump passive:keen_eye, ambient | | – | 110 / 1110 |
| fetch | sparkle | – | | bump passive:fetch | | `FETCH!` | 110 / 1110 |
| surge_warn | – | – | | bump clock | | `SURGE IN Ns` | 110 / 1110 |
| surge_start | – | – | sweep surge | | powerup | `SHADING SURGE ×N!` | 110 / 1110 |
| surge_end | – | – | sweep surge | | | `SURGE OVER` | 110 / 1110 |
| surge_hit | ring | damage → foe | | damage, shake | ecstatic / criticalHit | `SURGE −N` | 240 / 1240 |
| rule | sparkle | spark → foe (only if a plain positive contribution, `script.ts:82-83`) | | | | `ruleLabel` | 240 or 110 / 1240 or 1110 |
| doubled | – | – | aura | | | `×2!` | 110 / 1110 |
| double_ready | – | – | aura | | | `NEXT ×2` | 110 / 1110 |
| charged | – | – | aura | | | `NEXT SET ×N` | 110 / 1110 |
| empowered | – | – | sweep gold | | powerup | `WAR DRUM +N` | 110 / 1110 |
| simplified | – | – | sweep teal | | | `CLARITY!` | 110 / 1110 |
| simplify_end | – | – | sweep teal | | | `CLARITY ENDS` | 110 / 1110 |
| pinata | sparkle | – | | | | `PIÑATA!` | 110 / 1110 |
| link | zap | – | | | | `LINKED` | 110 / 1110 |
| purity | – | spark → foe (set) | | | | `PURITY ×N!` | 240 / 1240 |
| purity_max | – | rainbow → foe (set) | sweep rainbow | | ecstatic / criticalHit | `MAX PURITY ×N!` | 240 / 1240 |
| catalyst_spawn | sparkle | – | | | | `CATALYST!` | 110 / 1110 |
| evolution_start | burst (Catalyst card) | – | sweep rainbow | splits script → cut-in | ecstatic / criticalHit | – | 110 / 1110, then cut-in |
| evolution_end | – | – | sweep dark | | | `<name> ends` | 110 / 1110 |

(`blast` note: `isContribution` only filters `rule` events, so every row with an `orb` flies unless sour; the blast row's land is 240.)

## 5. `/dev/fx` (effects studio, `app/dev/fx.tsx`)

- Route: `/dev/fx`. **No URL params** (no `useLocalSearchParams`).
- Layout: a stand-in fight (`st.fight`, max width 480): foe `Anchor name="foe"` (Sparring Dummy, `EnemyAvatar lightweight`), fighter `Anchor "fighter"` (Orange Tabby, `framed`), static HP bar (70%), `combo`, `hearts`, `clock` (testID `studio-clock`, shows "held" in teal while `fx.busy`), `graces`, `coins`, `hint`, one `passive:<id>` per `PASSIVES`, `evo:<first recipe>`, `xp`, `GearBelt` with 8 weapons (`blast-powder, prismatic-ray, chaos-shard, flint-spark, mending-charm, fortunes-favor, connector, echo-stone`; testIDs `belt-<id>`), 12 plain `Card`s (4×3) each wrapped in `slot:<i>` refs (no GameBoard, no CardMotion, no testID on slots).
- Controls (all `Chip` = `TouchableOpacity`):
  - Speed: `fx-speed-1` "Real time", `fx-speed-4` "4× slower", `fx-speed-10` "10× slower" → sets `fxClock.slow` (`clock.ts:7`).
  - `fx-reduced` toggles "Effects on/off" → `useFightFx({reduced})` and `scriptFor(..., {reduced})`.
  - Play: `fx-cascade` ("A Set and what it sets off": `hit, blast, coins, laser, heal, ricochet, fire, time_gain`), `fx-evolution` (first recipe), `fx-evolution-2` (first two recipes, one shared cut-in).
  - Every event: `fx-event-<type>` for all 72 `EVENT_FX` keys; null rows labelled `<type> (nothing)` (only `mistake`).
- How an event is fired: `sampleEvent(type)` builds a `RunEvent` from `SAMPLE` (slots, amount, text, source; `REMOVES` = blast/laser/ricochet/link_burst/trap_sprung also attach `cards` so ghosts show), then `fx.play(scriptFor(events, { weapons, reduced }))`. No `gridMs` (always 62.5 ms grid), no `onSegment` (no sound), no `onLand` (no foe flinch, screen shake, mega flash, HP drop, avatar reactions), no `pendingDamage` display. The Set's own cards are not thrown for `hit` (no `cards` attached for lead hits in `SAMPLE`), so **fx-set-throw (#1) is not visible in the studio**, only in real fights.
- Cut-in: rendered with `seconds={30}`, no `autoDismissMs` (tap `evolution-cutin`). Effects off shows a static placeholder bar instead of `EvolutionBanner`.
- What `fxClock.slow` scales: `useFightFx` timers (incl. `AMBIENT_GAP_MS`, `BANNER_MS`), every `useProgress` piece, `Ghost` break, cut-in slash/flash/open/content, `GUARD_MS`, prompt start delay. It does NOT scale: `Anchor` bump, cut-in `CLOSE_MS` and its `setTimeout`, prompt pulse 500/500, speed lines, or anything in AdventureRun/HUD/GameBoard/CardMotion.
- In a real fight the same scale is `window.__nshapesFx.slow = N` (`AdventureRun.tsx:219-221`, dev + web only).

**Dev hooks in a real fight** (verified): `window.__nshapesRun` (live `RunState`: `board`, `attributes`, `status`, `matches`, `events`, …; `AdventureRun.tsx:216`), `window.__nshapesFx` (= `fxClock`, :220), `window.__nshapesLit` (ids of pointed-out cards, :533), `window.__nshapesAudio` (`src/audio/index.ts:288`). Card slots: `[data-testid="card-slot-<row>-<col>"]` (`GameBoard.tsx:658`, 3 columns; emptied slot `card-slot-emptied`). Other useful testIDs: `game-board`, `run-stage`, `run-foe-hp`, `run-clock`, `run-challenge`, `run-coach-banner`, `run-foe-taunt`, `run-opening`, `run-power`, `run-combo`, `run-hint`, `run-trait-checks`, `run-surge-bar`, `evolution-cutin`, `evolution-ring`, `evolution-glow`, `surge-glow`, `toggle-effects`, `tip-ok`, `pick-<n>`, `shop-buy-<n>`, `next-wave`, `inspect-close`, `power-info-close`, `adventure-run-fighter`, `adventure-run-enemy`. Getting into a fight: `/dev/adventure?save=before:1-4&intro=false` → `map-play-next` → `preview-play`; `?save=fresh` goes story (`story-skip`) → 1-1; `&autoplay=true` plays itself; `?save=maxed` for evolutions/big hits.

## 6. Call-site coverage

`grep -nE "withTiming\(|withSpring\(|withSequence\(|withRepeat\(|withDelay\("` over the fight files, line-based:

| File | lines with calls | covered by |
|---|---|---|
| `fx/visuals.tsx` | 2 (:37 `useProgress`, :449 Ghost) | :37 drives #2-8, #11-25, #41; :449 drives #1, #9, #10 |
| `fx/anchors.tsx` | 3 (:122-124) | #26 |
| `fx/EvolutionCutIn.tsx` | 7 (:45, :121, :122, :123, :124, :134, :141) | #64, #60, #61, #62, #63, #65, #66 |
| `components/AdventureRun.tsx` | 10 (:316, :317, :321, :1150, :1151, :1179, :1262, :1285, :1286, :1316) | #28, #28, #29, #31, #32, #33, #38, #39, #39, #40 |
| `components/StageBubble.tsx` | 1 (:49) | #34 |
| `components/RunFx.tsx` | 3 (:21, :34, :35) | #30, #42, #42 |
| `components/PowerMeter.tsx` | 1 (:24) | #35 |
| `components/TraitChecks.tsx` | 1 (:60) | #36 |
| `components/ui.tsx` (fight part) | 2 (:151, :152) | #44 |
| `src/components/CardMotion.tsx` | 12 (:48, :58, :59, :68, :71-77, :104) | #46, #47, #48, #49 (×8 lines), #50 |
| `src/components/GameBoard.tsx` | 6 (:211-213, :219-221) | #51, #52 |
| `src/components/Card.tsx`, `fx/FxStage.tsx`, `fx/GearBelt.tsx`, `app/dev/fx.tsx` | 0 | (compose others / TouchableOpacity #57 / timers #58) |
| **Total** | **48 / 48 covered** | |

Also covered: 6 `Modal animationType="fade"` (`AdventureRun.tsx` ×5, `HudInspector.tsx` ×1) → #43; hook call sites `useScreenShake` `shake` (:223) → #53, `triggerShake` (:460) → #54, `useParticles` (:239/:461) → #55; `useBurnTimer` → #58. Excluded as non-fight: `ui.tsx:90` (results stars), `ui.tsx:129-132` (map `Bob`). No `useGuardedFrameCallback`, `useFrameCallback`, layout `entering`/`exiting`, RN `Animated.timing/spring`, CSS keyframes or SVG `<animate>` in the area.

69 entries total (66 animations + 3 character cross-references), plus the 16-row "not animated" table.

## 7. Top 12 candidates

1. **fx-set-throw + fx-lead-burst + fx-orb-comet (the Set landing)**: the thrown card arrives at 300 ms, orbs 2-3 at 285/330 ms, but burst/number/HP/flinch/shake land at 240 ms and the payout sound at ~12-140 ms; the core moment is out of sync with itself and with the audio.
2. **Reduced path leaks (fx-screen-shake #29, fx-mega-flash #30, hud-foe-flinch #28, board shakes #53/#54, particles #55)**: with effects off or OS reduced motion the screen still shakes and flashes white (onLand runs for quiet beats; GameBoard has no gate).
3. **board-blast-particles + board-blast-shake (#55, #54)**: legacy Free Play effects fire 200 ms after the tap at a hard-coded (150,200), duplicating the stage's blast which lands steps later.
4. **board-validate-delay → card-leaving → card-deal-in (#56, #50, #46)**: 200 ms of nothing after the third tap, then an empty slot until 560 ms, then a column-only stagger; the "next cards dealt" beat feels disconnected and slow.
5. **fx-ko-banner (#24)**: the winning moment is unmounted 110 ms before its exit ends (life 1110 < 1220), then 900 ms of dead time before results (#45).
6. **hud-hp-drop / hud-hp-trail (#31, #32)**: animates `width`; trail delay restarts on every beat so it lags the whole cascade; colour jumps.
7. **hud-foe-flinch vs hud-anchor-bump (#28, #26)**: the foe scales up 1.28 and squashes to 0.9 on the same frame, no anticipation, and the shake restarts on every beat.
8. **fx-lead-number / fx-label-sticker (#6, #21)**: linear piecewise keyframes, no fade-in, labels of a cascade land on fixed lanes all at once; most-read text in the fight.
9. **EvolutionCutIn choreography (#60-#66)**: content moves as one block, close (170 ms) unscaled and timer-paired, prompt pulse with a stray reverse flag, unscaled speed lines.
10. **board-miss-flash / board-miss-shake (#52, #53)**: error feedback is a full-board red fade plus 21 ms linear jitter legs; nothing on the three wrong cards themselves.
11. **card-fire-overlay (#58)**: a 250 ms burn sampled by a 100 ms `setInterval`: 2-3 colour steps through React re-renders.
12. **hud-stage-bubble-pop (#34)**: the fighter's words snap to 0.9 then pop, and vanish or swap (taunt → coach) with no exit.
