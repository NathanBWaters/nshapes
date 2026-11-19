> Audit of 2026-11-18 at commit f56d11e (v0.1.136). File:line references drift; re-audit an area before trusting them. Part of the motion loop: see docs/motion/ledger.md.

# Adventure screens (outside the fight): motion inventory

Repo audited: the repository root (branch `motion-loop`, clean). Read-only audit, no repo files edited.

## Files covered

| File | Motion in it |
|---|---|
| `src/adventure/AdventureMode.tsx` (screen router; ambiguous, not in `components/`, covered because it owns every screen swap and the results→unlock timer) | timer, instant screen swaps |
| `src/adventure/components/ui.tsx` | `PopIn`, `AnimatedStar`/`StarRow`, `Bob`, `Btn` press |
| `src/adventure/components/AdventureMap.tsx` | trail dashes, arrival pop/ring/tag, frontier bob, auto-scroll |
| `src/adventure/components/StoryIntro.tsx` | starfall, flash, shards, rise, words |
| `src/adventure/components/MechanicIntro.tsx` | lesson step rise, Modal fade |
| `src/adventure/components/UnlockReveal.tsx` | rays loop, flash, hero pop, detail rise, Modal fade |
| `src/adventure/components/LevelPreview.tsx` | Modal slide + PopIn |
| `src/adventure/components/LevelResults.tsx` | PopIn card, star pops, audio timers |
| `src/adventure/components/FightReplay.tsx` | Modal slide, animated scrollTo, "Copied!" timer |
| `src/adventure/components/Camp.tsx` | PopIn on Workshop cards; everything else instant |
| `src/adventure/components/SkillTree.tsx` | detail Modal fade; nodes instant |
| `src/adventure/components/BountyBoard.tsx` | PopIn cards |
| `src/adventure/components/BattleHistory.tsx` | none (expanders instant) |
| `src/adventure/components/FieldGuide.tsx` | none (tabs instant; opens MechanicIntro) |
| `src/adventure/components/WeaponExplainer.tsx` | none (expander instant) |
| `src/adventure/components/CompanionBubble.tsx` | none of its own (hosts a FighterAvatar) |
| `src/adventure/components/rewards.tsx` | none of its own (hosts avatars) |
| `src/adventure/components/PowerExplainer.tsx` | none |
| `src/adventure/components/GearChips.tsx` (ambiguous: used by the fight HUD; covered) | none (TouchableOpacity 0.75) |
| `src/adventure/components/HudInspector.tsx` (ambiguous: opened from the fight HUD but not on the other auditor's list; covered) | Modal fade + PopIn |
| `src/adventure/components/fightReplayText.ts` | none (text only) |
| `app/dev/adventure.tsx` | none (dev entry, URL params below) |

Skipped (other auditor): `AdventureRun.tsx`, `StageBubble.tsx`, `RunFx.tsx`, `PowerMeter.tsx`, `TraitChecks.tsx`, `src/adventure/fx/**`.

Not inventoried internally but embedded everywhere (shared rigs outside `src/adventure`): `FighterAvatar` (`src/components/fighters/FighterAvatar.tsx`), `EnemyAvatar` (`src/components/enemies/EnemyAvatar.tsx`), `WeaponAvatar` (`src/components/weapons/WeaponAvatar.tsx`, tap animation ~65–130 ms segments + springs, `burst` 540 ms), `Card` (`src/components/Card.tsx`), `RoundFunPrompt` (`src/components/RoundFunPrompt.tsx`, no animation). Where my screens drive them (props `animate`, `mood`, `reaction`, `interactive`, `triggerKey`) they get an entry below as "external rig".

## Call-site count (found vs covered)

Grep over the 22 files above for `withTiming|withSpring|withSequence|withRepeat|withDelay|Animated.*|entering|exiting|layout=|setTimeout|setInterval|<animate|animationType|animated: true|LayoutAnimation|useGuardedFrameCallback`:

| Kind | Found | Covered |
|---|---|---|
| `withTiming(` | 24 (Map 6, Story 5, MechanicIntro 1, Unlock 6, ui 6) | 24 |
| `withSequence(` | 7 (Map 2, Story 1, Unlock 2, ui 2) | 7 |
| `withDelay(` | 12 (Map 5, Story 4, ui 3) | 12 |
| `withRepeat(` | 2 (Unlock 1, ui 1) | 2 |
| `withSpring(` | 0 | – |
| `useAnimatedStyle` | 18 (Map 4, Story 6, MechanicIntro 1, Unlock 4, ui 3) | 18 |
| `cancelAnimation` | 4 (Unlock 2, ui 2) | 4 |
| `Modal animationType` | 6 (LevelPreview slide, FightReplay slide, MechanicIntro fade, UnlockReveal fade, SkillTree fade, HudInspector fade) | 6 |
| `scrollTo({animated:true})` | 2 (Map:204, FightReplay:345) | 2 |
| real `setTimeout(` calls | 8 (Map 194/195/204, Story 157, Results 86/87, FightReplay 400, AdventureMode 216) | 8 |
| `entering/exiting/layout=`, `LayoutAnimation`, `withSpring`, `useGuardedFrameCallback`, `setInterval`, SVG `<animate>`, RN `Animated.timing` | 0 | – |
| `<PopIn` usages | 6 (LevelPreview:102, LevelResults:140, HudInspector:262, Camp:160, Camp:487, BountyBoard:92) | 6 |
| `<Bob` usages | 2 (Map:515, Map:531) | 2 |
| `StarRow animateFrom` usages | 1 (LevelResults:168) | 1 |

## Reference: platform behaviour that applies to many entries

- **RN-web Modal** (`node_modules/react-native-web/dist/exports/Modal/ModalAnimation.js`, v0.21.2): CSS keyframes, `ANIMATION_DURATION = 250` ms. In: `cubic-bezier(0.215, 0.61, 0.355, 1)` (easeOutCubic). Out: `cubic-bezier(0.47, 0, 0.745, 0.715)` (easeInSine). `slide` = `translateY(100%)→0`; `fade` = opacity 0→1. The **whole** modal content (including a dim backdrop drawn inside it) slides. The out animation only runs when `visible` flips to false while mounted. **Every modal in this area is unmounted instead** (component returns `null` or is conditionally rendered), so no modal here ever plays its exit.
- **RN-web TouchableOpacity** (`.../TouchableOpacity/index.js:57-105`): CSS `transition: opacity`; press-in fades to `activeOpacity` (default 0.2) in 150 ms (0 ms on touch grant), press-out fades back in 250 ms.
- **Reduced motion**: `src/hooks/useReducedMotion.ts` (web: `prefers-reduced-motion: reduce` media query, read on first render; native: `AccessibilityInfo`). Used in my area by AdventureMap, StoryIntro, Camp (hides the Effects toggle), AdventureMode (forces fight effects off). **Not** used by `PopIn`, `AnimatedStar`, `Bob` (relies on caller), `UnlockReveal`, `MechanicIntro`, Modals. The in-game Effects switch (`save.effectsOn`) only affects the fight, not these screens.
- **`useAppActive`** gates `Bob` and `Rays` loops (pause when tab hidden).

---

## Entries

Format per entry: where · sees · trigger · mechanism · params · class · reduced-motion · reach · smells.

### Shared primitives (ui.tsx)

#### ui-popin
- where: `src/adventure/components/ui.tsx:146-156`
- sees: a panel fades in while growing from 94% to full size.
- trigger: mount (and re-mount if keyed).
- mechanism: Reanimated `withDelay(withTiming)` on two shared values.
- params: scale `0.94→1`, 180 ms, `Easing.out(Easing.cubic)`; opacity `0→1`, 140 ms, default easing (Reanimated default `Easing.inOut(Easing.quad)`); `delay` prop default 0 (no caller passes a delay). Comment: "Short ease-out, no overshoot".
- class: panel-entrance
- reduced-motion: ignored (always animates).
- reach: any usage below.
- smells: NO-EXIT, MAGIC-NUMBERS (no shared tokens), EVERYTHING-AT-ONCE where used on lists (no caller staggers).

#### ui-star-pop (AnimatedStar / StarRow)
- where: `ui.tsx:78-102`; delay fn `starPopDelayMs` `ui.tsx:48` = `350 + index*450`; `starsLandedMs` `ui.tsx:49` = `600 + stars*450`.
- sees: each filled star pops from nothing, overshoots, settles over a grey empty star.
- trigger: mount with `animateFrom` set (only results).
- mechanism: Reanimated `withDelay(withSequence(withTiming, withTiming))`.
- params: scale `0 → 1.25` 140 ms `Easing.out(Easing.cubic)`, then `→1` 120 ms `Easing.inOut(Easing.quad)`; delays 350 / 800 / 1250 ms for stars 1–3. No opacity, no rotation.
- class: hero-reveal (per star) / number-pop
- reduced-motion: ignored.
- reach: see results-star-pop.
- smells: DURATION-OUT-OF-BAND (whole pop 260 ms < 300 ms for a hero beat), MAGIC-NUMBERS (450 ms step only lives here and is re-used by audio via the fn, good), NO-ANTICIPATION.

#### ui-bob
- where: `ui.tsx:122-143`
- sees: a gentle up-down float.
- trigger: loop while `active && appActive`.
- mechanism: Reanimated `withRepeat(withSequence(withTiming, withTiming), -1)`, `cancelAnimation` on stop.
- params: translateY `0 → -amount → 0`, 600 ms each way (1200 ms cycle), `Easing.inOut(Easing.sin)`; `amount` default 4 px.
- class: ambient-loop
- reduced-motion: not in the primitive; the only caller (map) passes `active={isLive}` where `isLive = active && appActive && !reducedMotion` (`AdventureMap.tsx:152`), so effectively off.
- reach: `/dev/adventure?save=fresh&intro=false` (frontier node visible on load).
- smells: none serious.

#### ui-btn-press (and every TouchableOpacity)
- where: `ui.tsx:64-74` (`Btn`, `activeOpacity={0.8}`); same pattern on map nodes (0.85), dock (default 0.2), camp rows (0.85), charm/fighter tiles (0.85), skill nodes (0.8), history rows (0.9), lesson card (0.9), story tap area (1 = no feedback), GearChips (0.75), Stat (0.75).
- sees: the pressed thing dims; nothing moves. The chunky `borderBottomWidth: 4` 3D button never "presses down".
- trigger: press.
- mechanism: RN-web CSS opacity transition.
- params: in 150 ms (0 ms on touch grant) to activeOpacity; out 250 ms.
- class: ui-feedback
- reduced-motion: n/a (opacity only).
- reach: everywhere; e.g. `[data-testid="preview-play"]`.
- smells: FADE-ONLY, EXIT-SLOWER-THAN-ENTER, DURATION-OUT-OF-BAND (250 ms release > 150 ms), NO-FOLLOW-THROUGH (3D button would want a translateY press).

### Screen router (AdventureMode.tsx)

#### screen-swap
- where: `src/adventure/AdventureMode.tsx:254-342` (`body` switch on `screen.kind`).
- sees: story → fight, map ↔ camp, map ↔ guide, fight → results, results → map/camp all **cut** instantly.
- trigger: `setScreen` from buttons.
- mechanism: none (conditional render).
- params: –
- class: screen-transition
- reduced-motion: –
- reach: `/dev/adventure?save=maxed` → `[data-testid="map-dock-camp"]` → back (accessibilityLabel "Back to map").
- smells: NO-MOTION (top candidate).

#### results-unlock-delay
- where: `AdventureMode.tsx:213-216`
- sees: after stars land, the full-screen UnlockReveal appears.
- trigger: fight finished with ≥1 unlock.
- mechanism: JS `setTimeout(…, starsLandedMs(stars))`.
- params: `600 + stars*450` ms → 1050 / 1500 / 1950 ms. Last star finishes popping at `starPopDelayMs(stars-1)+260` = 610 / 1060 / 1510 ms → ~440 ms gap with nothing moving.
- class: screen-transition (timing)
- reduced-motion: same delay.
- reach: `/dev/adventure?save=before:1-4&autoplay=true` → `map-node-1-4` → `preview-play` → wait for `unlock-modal`.
- smells: TIMER-DRIVEN, DEAD-TIME.

### Story intro (StoryIntro.tsx)

#### story-beat-swap
- where: `StoryIntro.tsx:55-63`, `:81-83` (`Scene key={i}`, `Words key={'w'+i}`)
- sees: tapping Next cuts the old scene away; new scene starts its own entrance.
- trigger: tap anywhere / `story-next`.
- mechanism: React remount by key.
- params: –
- class: screen-transition
- reduced-motion: –
- reach: `/dev/adventure?save=fresh` → `[data-testid="story-intro"]` → `[data-testid="story-next"]`.
- smells: NO-EXIT, NO-MOTION (no crossfade between beats).

#### story-dots
- where: `StoryIntro.tsx:68-70`, styles `:300-303`
- sees: progress pill jumps from 7 px dot to 20 px pill and changes colour instantly.
- trigger: beat change.
- mechanism: none.
- class: progress
- smells: NO-MOTION (small).
- reach: as above.

#### story-words-rise
- where: `StoryIntro.tsx:96-112`
- sees: speaker/title/body rise 10 px and fade in after the scene starts.
- trigger: mount per beat.
- mechanism: Reanimated `withDelay(withTiming)`.
- params: delay 950 ms on `starfall`, 250 ms otherwise; 320 ms `Easing.out(Easing.cubic)`; translateY `10→0`, opacity `0→1`.
- class: panel-entrance (text-swap)
- reduced-motion: shown settled (`p=1`).
- reach: `/dev/adventure?save=fresh`.
- smells: MAGIC-NUMBERS (950 is "after the burst" hand-synced to `870` below), DEAD-TIME on beat 1 (words absent for 950 ms; readers wait).

#### story-starfall-fall
- where: `StoryIntro.tsx:149-201` (`fall` value, `starStyle`, `streakStyle`)
- sees: a big gold star streaks from top-right down onto the peak, spinning and growing, with a fading light trail.
- trigger: mount of beat 1.
- mechanism: Reanimated `withDelay(250, withTiming)`; position/rotate/scale derived in `useAnimatedStyle`.
- params: 620 ms `Easing.in(Easing.quad)`; from `(0.92w, -30)` to `(0.5w, 0.36h)`; rotate `0→200deg`; scale `0.7→1.2`; star opacity hard-cut to 0 at t=1; streak opacity `(1-t)*0.65`, scaleX `t`, width `0.55*len`.
- class: projectile/travel
- reduced-motion: shown at end state (star hidden, shards settled).
- reach: `/dev/adventure?save=fresh` (beat 1 plays on load).
- smells: none (ease-in on a fall is right).

#### story-starfall-flash
- where: `StoryIntro.tsx:186-189`, `:156`
- sees: a pale disc bursts from the peak and fades.
- trigger: 870 ms after mount (= 250 + 620, impact).
- mechanism: Reanimated `withDelay(870, withTiming)`, shared `burst` value; `sfx('unlock')` via `setTimeout(…, 870)` (`:157`).
- params: 700 ms `Easing.out(Easing.cubic)`; scale `0.4→2.8`; opacity `max(0, 0.85 - t*1.6)` (gone by t≈0.53); 120 px disc.
- class: impact/hit
- reduced-motion: invisible (burst=1 → opacity 0).
- reach: as above.
- smells: TIMER-DRIVEN (sound synced by a parallel setTimeout with a duplicated 870), MAGIC-NUMBERS.

#### story-starfall-shards
- where: `StoryIntro.tsx:204-225`, offsets `SHARDS` `:38`
- sees: 7 small gold stars fly out of the impact, up then down under gravity, spinning.
- trigger: same `burst` value as flash.
- mechanism: derived from `burst` (700 ms out-cubic).
- params: dx/dy from `SHARDS` × scene size; gravity `+46*t²` px; rotate `±140deg`; scale `0.5→1` over first half; size 26 (every 3rd) or 18; opacity hard on at t>0.
- class: impact/hit
- reduced-motion: shown at rest.
- reach: as above.
- smells: EVERYTHING-AT-ONCE (all 7 share one curve, no per-shard delay), BOUNCE-free; gravity applied on an ease-out time curve so they decelerate while "falling" (physically off).

#### story-rise (critters and hero)
- where: `StoryIntro.tsx:284-295`; used `:236` (critters, `delay=k*140` → 0/140/280 ms) and `:262/:265` (hero 0, mini Set 180 ms).
- sees: each foe / fighter / card trio pops up from below, slightly overshooting.
- trigger: mount of beat 2 / 3.
- mechanism: Reanimated `withDelay(withSequence(withTiming, withTiming))`.
- params: p `0 → 1.08` 220 ms `Easing.out(Easing.cubic)`, `→1` 140 ms default easing; translateY `24*(1-min(1,p))`; scale `0.7+0.3p` (peaks 1.024); opacity `min(1, 2p)`.
- class: hero-reveal
- reduced-motion: settled.
- reach: `/dev/adventure?save=fresh` → `story-next` ×1 (critters) / ×2 (hero).
- smells: TWO-HEROES (each EnemyAvatar/FighterAvatar also plays its own `entrance` reaction at the same moment, external rig), MAGIC-NUMBERS.

#### story-avatars (external rig)
- where: `StoryIntro.tsx:238` (EnemyAvatar `reaction={{type:'entrance'}}`, mood menacing/idle), `:263` (FighterAvatar entrance, mood anticipation).
- sees: critters/fighter do their entrance move and idle loop.
- mechanism: shared creature rig; disabled by its own `useReducedMotion` (`EnemyAvatar.tsx:386-387`).
- class: character-acting
- reach: as story-rise.

### Map (AdventureMap.tsx)

#### map-mount (missing)
- where: `AdventureMap.tsx:211-358`
- sees: map, top bar, guide banner and dock appear at once; nodes do not settle in.
- trigger: entering the map.
- mechanism: none.
- class: screen-transition
- reach: `/dev/adventure?save=fresh&intro=false`; `[data-testid="map-top-bar"]`.
- smells: NO-MOTION.

#### map-autoscroll
- where: `AdventureMap.tsx:199-206`
- sees: the map scrolls to the fresh secret path, the highlighted level, or the frontier.
- trigger: mount / `focusId` change.
- mechanism: JS `setTimeout(120)` then `ScrollView.scrollTo({animated:true})` (platform smooth scroll; web uses browser `scroll-behavior: smooth`, duration not controllable).
- params: delay 120 ms; target `y - 260`.
- class: ui-move
- reduced-motion: ignored (always animated scroll).
- reach: `/dev/adventure?save=before:3-1&intro=false` (frontier far down).
- smells: TIMER-DRIVEN, uncontrolled duration.

#### map-frontier-bob
- where: `AdventureMap.tsx:515` (`<Bob active={isLive}>` around the node button)
- sees: the next level's node floats up and down 4 px.
- trigger: loop while map active (not covered by a modal), app active, no reduced motion.
- params: ui-bob defaults (4 px, 600+600 ms sine).
- class: ambient-loop
- reach: `/dev/adventure?save=fresh&intro=false` → `[data-testid="map-node-1-1"]`.
- smells: none.

#### map-fighter-bob
- where: `AdventureMap.tsx:529-537`
- sees: your fighter's little bubble beside the frontier floats 3 px, in phase with the node (both 1200 ms cycles started together).
- params: ui-bob, `amount={3}`.
- class: ambient-loop
- reach: as above.
- smells: in lockstep with map-frontier-bob (no phase offset) – reads as one rigid block.

#### map-avatars (external rig)
- where: `AdventureMap.tsx:488-494` (frontier EnemyAvatar `animate={isFrontier && isLive}`, mood menacing), `:483` (coming-up foes, still), `:334` (dock FighterAvatar `animate={isLive}`), `:533` (frontier fighter), `:227-235` CompanionBubble avatar `animate={isLive}`.
- class: ambient-loop / character-acting
- reduced-motion: off via `isLive` + rig's own check.
- reach: `/dev/adventure?save=fresh&intro=false`; `[data-testid="map-play-next"]`, `[data-testid="map-guide-banner"]`.

#### map-trail-dash
- where: `AdventureMap.tsx:402-410`; timing constants `ARRIVE` `:49` = `{ startMs: 700, dashMs: 55, popMs: 380, tagMs: 2000, betweenMs: 500 }`, `DASH_STEP = 12` `:47`; schedule `:175-185`, render `:292-300`.
- sees: a newly opened secret path draws itself out from its parent node, one dash at a time.
- trigger: map shows a path in `freshPaths(save)` for the first time.
- mechanism: Reanimated `withDelay(withTiming)` per dash.
- params: each dash 150 ms `Easing.out(Easing.cubic)`, opacity `0→1`, scale `0.4→1` (rotated to the path angle); dash k delay `startMs(700) + k*55` ms; several fresh paths chain with `betweenMs` 500 ms.
- class: progress / hero-reveal (build-up)
- reduced-motion: dashes present instantly (`still`), all start/pop times 0.
- reach: `/dev/adventure?save=before:1-4&autoplay=true` → `map-node-1-4` → `preview-play` → wait for `unlock-modal` → `unlock-reveal` → `unlock-primary` ("Show me on the map") → map. (Or `results-map` after the reveal.)
- smells: FADE-ONLY-ish (scale 0.4→1 is small at 5×8 px), MAGIC-NUMBERS (fine: local constant).

#### map-arrival-pop
- where: `AdventureMap.tsx:416-438` (`pop`)
- sees: the secret node (with its label/stars) pops into place with an overshoot.
- trigger: `popMs` = end of its trail.
- mechanism: Reanimated `withDelay(withSequence(withTiming, withTiming))`; chime `sfx('unlock')` via `setTimeout(popMs)` (`:194`).
- params: scale `0→1.2` 220 ms `Easing.out(Easing.cubic)`, `→1` 160 ms `Easing.inOut(Easing.quad)`; opacity `min(1, pop*4)`.
- class: hero-reveal
- reduced-motion: shown at once with tag.
- reach: as map-trail-dash. testID `map-node-<id>` of the side path (`map-node-1-4D`, The Back Field, `data/levels.ts:682`).
- smells: TIMER-DRIVEN (sound on parallel setTimeout), DURATION ok (380 ms).

#### map-arrival-ring
- where: `AdventureMap.tsx:423`, `:427`
- sees: a ring bursts outward from the new node and fades.
- params: 620 ms `Easing.out(Easing.quad)`; scale `0.6→2.2`; opacity `1 - t` (0 before start).
- class: impact/hit
- reduced-motion: never shown.
- reach: as above.
- smells: none.

#### map-secret-tag
- where: `AdventureMap.tsx:424`, `:428`, `:433-435`
- sees: "SECRET PATH!" tag rises 6 px in, holds, fades out.
- params: delay `popMs + 120`; in 180 ms (default easing) opacity 0→1, translateY 6→0; hold `ARRIVE.tagMs - 500` = 1500 ms; out 300 ms opacity only. `onPathsRevealed` saved via `setTimeout(max(popMs) + 380 + 2000)` (`:195`).
- class: text-swap / exit
- reduced-motion: tag shown and **never hidden** (tag=1, no fade).
- reach: as above.
- smells: EXIT-SLOWER-THAN-ENTER (300 vs 180, acceptable for a tag), FADE-ONLY exit, TIMER-DRIVEN.

#### map-node-tap (missing)
- where: `AdventureMap.tsx:468-480`
- sees: tapping a node dims it (activeOpacity 0.85) then the sheet slides up; the node itself gives no press/squash.
- class: ui-feedback
- smells: FADE-ONLY, NO-ANTICIPATION.
- reach: `map-node-1-1`.

#### map-progress-static (missing)
- where: `AdventureMap.tsx:254-259` (region star bar `worldFill` width %), star pill `:219-222`, CoinPill.
- sees: region progress bar and star/coin counts change with no fill or count-up after returning from a win.
- class: progress
- smells: NO-MOTION, NOT-TRANSFORM/OPACITY (would need scaleX, not width).
- reach: win a level, `results-map`, look at `map-world-progress-<biome>` / `map-stars`.

### Level preview (LevelPreview.tsx)

#### preview-sheet-enter
- where: `LevelPreview.tsx:99-102` (`Modal animationType="slide"` + `<PopIn style={st.sheet}>`)
- sees: the dimmed backdrop **and** the sheet slide up from the bottom together, while the sheet also fades/scales 0.94→1.
- trigger: tap a map node / `map-play-next` / results `results-next` / camp `camp-return-fight`.
- mechanism: RN-web Modal CSS slide + Reanimated PopIn.
- params: slide 250 ms easeOutCubic `translateY(100%→0)`; PopIn 180 ms scale / 140 ms opacity concurrently.
- class: panel-entrance
- reduced-motion: ignored (both always play).
- reach: `/dev/adventure?save=fresh&intro=false` → `[data-testid="map-node-1-1"]` → wait `[data-testid="preview-play"]`.
- smells: TWO-HEROES (two stacked entrances, scale-from-centre fights the slide-from-bottom), backdrop slides instead of fading, MAGIC-NUMBERS.

#### preview-sheet-exit (missing)
- where: `LevelPreview.tsx:70` (`if (!level) return null`)
- sees: close (✕, backdrop tap, Fight!) makes the sheet vanish instantly.
- class: exit
- smells: NO-EXIT.
- reach: open preview, tap ✕ or backdrop (accessibilityLabel "Close").

#### preview-foe-entrance (external rig)
- where: `LevelPreview.tsx:112-119` (EnemyAvatar `reaction={{type:'entrance',id:1}}`, mood enraged/menacing/idle, interactive → tap poke).
- class: character-acting
- smells: TWO-HEROES with the sheet entrance (plays at the same time).
- reach: as preview.

#### preview-fighter-select
- where: `LevelPreview.tsx:259-280`
- sees: selected fighter's tile border/background swaps instantly; its avatar plays an `entrance` reaction and starts animating.
- trigger: tap `preview-fighter-<Name>`.
- mechanism: style swap (none) + external rig reaction.
- class: ui-feedback
- reach: `/dev/adventure?save=maxed` → any `map-node-*` → `preview-fighter-Sly Fox`.
- smells: NO-MOTION on the selection frame.

#### preview-charm-equip
- where: `LevelPreview.tsx:328-381`
- sees: tapped charm's WeaponAvatar plays its tap animation (external, `triggerKey`); it appears in a slot / leaves a slot instantly; the explainer below appears instantly.
- trigger: tap `charm-<weaponId>` / `preview-slot-<i>`.
- class: ui-feedback / ui-move
- smells: NO-MOTION (no travel from tile to slot, a natural projectile/travel candidate), EVERYTHING-AT-ONCE explainer swap.
- reach: `/dev/adventure?save=maxed` → `map-node-2-1` → `charm-<id>`.

#### preview-lesson-card
- where: `LevelPreview.tsx:523-540` (`preview-lesson`, activeOpacity 0.9) → opens MechanicIntro reference.
- sees: static NEW card with demo cards; tap dims.
- class: ui-feedback
- reach: `/dev/adventure?save=before:1-2` → `map-node-1-2` → `preview-lesson`.
- smells: NO-MOTION (the "NEW" lesson never draws the eye).

### Lesson card (MechanicIntro.tsx; also used by FieldGuide)

#### lesson-modal-fade
- where: `MechanicIntro.tsx:164`
- sees: dark overlay + panel fade in.
- params: RN-web fade 250 ms easeOutCubic.
- class: panel-entrance
- reduced-motion: ignored.
- reach: `/dev/adventure?save=before:1-2` → `map-node-1-2` → `preview-lesson` → `[data-testid="lesson-modal"]`.
- smells: FADE-ONLY, NO-EXIT (`Lesson` returns null when `steps` is null, `:147`; `MechanicIntro` mounted with `mechanic=null`).

#### lesson-step-rise
- where: `MechanicIntro.tsx:127-140`
- sees: every page/quiz step content rises 8 px and fades in (also on first open, on top of the modal fade).
- trigger: step index change (Continue / Back) or new lesson.
- mechanism: Reanimated `withTiming` (value hard-reset to 0 first).
- params: 180 ms `Easing.out(Easing.cubic)`; translateY `8→0`; opacity `0→1`.
- class: text-swap
- reduced-motion: ignored.
- reach: `lesson-modal` → `[data-testid="mechanic-intro-ok"]`.
- smells: NO-EXIT (old step cut, no crossfade), same direction for Back and Continue, MAGIC-NUMBERS.

#### lesson-quiz-feedback (missing)
- where: `MechanicIntro.tsx:206-222`
- sees: YES/NO buttons replaced instantly by a feedback box; speaker avatar mood switches (external rig).
- trigger: `quiz-yes` / `quiz-no`.
- class: impact/hit (answer verdict)
- smells: NO-MOTION (a right/wrong answer with no verdict motion).
- reach: a full lesson with quiz: Field Guide entry (`map-dock-guide` → mechanics tab entry) uses `quiz={false}`; quizzes appear only for non-brief lessons — hard to reach; check `lessons.ts` for a level whose plan is not `brief`.

#### lesson-dots (missing)
- where: `MechanicIntro.tsx:229-231`, styles `:305-308`
- sees: page dot widens 6→18 px and recolours instantly.
- class: progress
- smells: NO-MOTION.

### Results (LevelResults.tsx)

#### results-card-popin
- where: `LevelResults.tsx:140` (`<PopIn style={st.card}>` wraps the whole result).
- sees: the entire result card (title, avatars, stars row, breakdown, stats, coins, bounties, unlocks, buttons) fades/scales in as one block.
- trigger: mount of results screen (instant cut from the fight).
- params: ui-popin (180/140 ms).
- class: panel-entrance
- reduced-motion: ignored.
- reach: `/dev/adventure?save=fresh&autoplay=true` → `story-skip` → (1-1 autoplays) → `unlock-reveal` → `unlock-primary` → `[data-testid="results-star-breakdown"]`. Faster for a no-unlock result: `/dev/adventure?save=maxed&autoplay=true` → `map-node-1-1` → `preview-play`.
- smells: EVERYTHING-AT-ONCE (title, breakdown rows, stats, coin lines, bounty rows all land together; only stars are sequenced), DURATION too short for the screen's hero moment.

#### results-star-pop
- where: `LevelResults.tsx:168` (`<StarRow stars size={52} animateFrom={0}>`) + audio `:83-89`.
- sees: up to 3 big stars pop one after another; each rings a rising chord step.
- params: ui-star-pop; delays 350/800/1250 ms; `band.cue('star',{amount:i})` via `setTimeout(starPopDelayMs(i-1))` (fires at pop **start**, the visual peak is +140 ms).
- class: hero-reveal
- reduced-motion: ignored.
- reach: as above; `[data-testid="results-shards"]` below it.
- smells: TIMER-DRIVEN (audio on parallel setTimeouts), DURATION-OUT-OF-BAND (260 ms per star), NO-ANTICIPATION, no sparkle/impact on land.

#### results-coins (missing count-up)
- where: `LevelResults.tsx:249-261` (bank box, CoinPill), audio `:87` `band.cue('coinRoll', …)` at `starPopDelayMs(stars)+250` ms.
- sees: coin lines and total are already final; a coin-roll sound plays ~1.25–1.95 s later with nothing moving.
- class: number-pop / progress
- smells: NO-MOTION (sound without picture), DEAD-TIME.
- reach: any won result after coins unlock: `/dev/adventure?save=maxed&autoplay=true` → `map-node-1-5` → `preview-play`.

#### results-avatars (external rig)
- where: `LevelResults.tsx:143-165` (FighterAvatar reaction `ecstatic`/`joy`, mood victory/defeat; EnemyAvatar reaction `taunt` on loss, mood cornered/victory; both interactive) and next-foe `:362`.
- class: character-acting
- smells: TWO-HEROES (avatar reactions start at mount, same instant as card pop, before stars).
- reach: `results-fighter-avatar`, `results-enemy-avatar`.

#### results-unlocked-reveal-swap (missing)
- where: `LevelResults.tsx:292-317` (`unlocksRevealed` false → Silhouette / "Something new is on the map…"; true → UnlockableAvatar / text).
- sees: after the reveal modal closes the silhouettes swap to the real rewards instantly.
- class: hero-reveal
- smells: NO-MOTION.
- reach: as results-unlock-delay, then close the reveal; `[data-testid="results-secret-path"]`.

#### results-power-toggle / results-stats (missing)
- where: `LevelResults.tsx:220-247` (`results-power` → PowerExplainer appears), `:203-237` stat tiles static (NEW BEST note static).
- class: panel-entrance / number-pop
- smells: NO-MOTION (expander pops in; "NEW BEST" has no emphasis).
- reach: power result at a late level with gear (`?save=maxed`, play `3-1`).

#### results-footer
- where: `LevelResults.tsx:358-382`
- sees: Next/Retry/Map/Camp footer is just there (not inside PopIn).
- class: panel-entrance
- smells: NO-MOTION (could arrive after stars to steer the eye), press = ui-btn-press.
- reach: `[data-testid="results-actions"]`, `results-next`, `results-retry`, `results-map`, `results-camp`.

### Unlock reveal (UnlockReveal.tsx)

#### unlock-modal-fade
- where: `UnlockReveal.tsx:155`
- sees: opaque black screen fades in over results.
- params: RN-web fade 250 ms easeOutCubic.
- class: screen-transition
- reduced-motion: ignored.
- reach: `[data-testid="unlock-modal"]` (see results-unlock-delay).
- smells: NO-EXIT (conditionally rendered `AdventureMode.tsx:378`, `onDone` → `setUnlocks([])`).

#### unlock-rays
- where: `UnlockReveal.tsx:45-65`
- sees: 12 faint coloured rays (24 beams, 16% opacity) slowly rotate behind the medallion.
- trigger: loop while mounted and app active.
- mechanism: Reanimated `withRepeat(withTiming(360), -1)`, `cancelAnimation`.
- params: 26000 ms per turn, `Easing.linear`; 240 px.
- class: ambient-loop
- reduced-motion: ignored (keeps spinning).
- reach: as unlock-modal.
- smells: reduced motion not honoured.

#### unlock-flash
- where: `UnlockReveal.tsx:137`, `:157`
- sees: full-screen white flash on reveal.
- trigger: tap `unlock-reveal` (or the medallion `onTouchEnd`).
- mechanism: Reanimated `withSequence(withTiming, withTiming)`.
- params: opacity `0→0.9` 70 ms default easing, `→0` 380 ms `Easing.out(Easing.quad)`.
- class: impact/hit
- reduced-motion: ignored (full-screen flash plays regardless; photosensitivity concern).
- reach: `[data-testid="unlock-reveal"]`.
- smells: FADE-ONLY (fine for a flash), reduced motion ignored.

#### unlock-hero-pop
- where: `UnlockReveal.tsx:138`, `:164`
- sees: the 150 px medallion bumps up and settles; its background flips dark→white and the silhouette icon swaps to the animated avatar instantly at t=0.
- params: scale `1→1.12` 140 ms `Easing.out(Easing.cubic)`, `→1` 160 ms `Easing.inOut(Easing.quad)`.
- class: hero-reveal
- reduced-motion: ignored.
- reach: as above; revealed testIDs `unlock-revealed-fighter`, `unlock-revealed-weapon`, `unlock-revealed-path`.
- smells: DURATION-OUT-OF-BAND (300 ms total for the biggest hero moment outside the fight), NO-ANTICIPATION (no wind-up/shake before the tap pays off), content swap is a hard cut, TWO-HEROES (avatar's own `ecstatic`/`entrance` reaction starts the same frame).

#### unlock-detail-rise
- where: `UnlockReveal.tsx:139-140`, `:195-331`
- sees: name, companion bubble and "How it works" card rise 12 px and fade in.
- params: 260 ms `Easing.out(Easing.cubic)`; translateY `12→0`; opacity `0→1`. Level-up weapons skip straight to `detail=1` (`:99-104`).
- class: panel-entrance
- reduced-motion: ignored.
- reach: as above.
- smells: EVERYTHING-AT-ONCE (name, bubble, card together; no stagger), footer CTA swaps instantly (`:335-445`).

#### unlock-advance (missing)
- where: `UnlockReveal.tsx:143-148`
- sees: Continue on reveal N cuts straight to silhouette N+1 (eyebrow "2 of 5" changes, hero snaps back to dark).
- class: screen-transition
- smells: NO-MOTION, NO-EXIT.
- reach: a result with several unlocks, e.g. `/dev/adventure?save=before:1-4&autoplay=true` (1-4 grants several rewards), `unlock-primary` repeatedly.

#### unlock-avatar-acting (external rig)
- where: `UnlockReveal.tsx:166-182` (FighterAvatar `ecstatic`, WeaponAvatar interactive, EnemyAvatar `entrance`, all tappable).
- class: character-acting

### Fight replay (FightReplay.tsx)

#### replay-modal-slide
- where: `FightReplay.tsx:449`
- sees: full-screen replay slides up from the bottom.
- params: RN-web slide 250 ms easeOutCubic.
- class: screen-transition
- reduced-motion: ignored.
- reach: results of level ≥1-4 → `[data-testid="results-replay"]` → `[data-testid="fight-replay"]`; or Camp → History → `history-battle` → `history-replay`.
- smells: NO-EXIT (results renders `{replayOpen && …}` at `LevelResults.tsx:383`; history passes `replay=null` and the component returns null at `:412`).

#### replay-scroll-to-inspector
- where: `FightReplay.tsx:338-346`
- sees: tapping a row in the move list scrolls up to the inspector.
- mechanism: `scrollTo({animated:true})` (browser smooth scroll).
- class: ui-move
- reach: `[data-testid="replay-row-3"]`.
- smells: inspector content swaps with no transition (`select` resets five expanders and changes `selected`).

#### replay-copied-label
- where: `FightReplay.tsx:398-401`, `:1065`
- sees: "Copy log as JSON" button label reads "Copied!" for 1.5 s.
- mechanism: JS `setTimeout(1500)`.
- class: text-swap
- smells: TIMER-DRIVEN, NO-MOTION.

#### replay-expanders (missing)
- where: `FightReplay.tsx:478, 505, 734, 745/755 (prev/next), 773, 813-871, 896, 962`
- sees: chart bars, cards, math rows, chips and lines open/close detail boxes instantly; bar selection highlight is instant.
- class: panel-entrance / ui-feedback
- smells: NO-MOTION.
- reach: `replay-bar-<i>`, `replay-card-<i>`, `replay-math-<i>`, `replay-line-<i>`, `replay-total-<k>`, `replay-power-banner`, `replay-inspector-power`.

### Camp and sections

#### camp-section-switch (missing)
- where: `Camp.tsx:136-140`, `:271-688`; Bounties returns its own screen `:233`.
- sees: menu → section → menu cut instantly; header title/icon swap instantly.
- class: screen-transition
- smells: NO-MOTION.
- reach: `/dev/adventure?save=maxed` → `map-dock-camp` → `camp-tab-fighters|armory|arcana|workshop|bounties|history`; back = accessibilityLabel "Back to camp".

#### camp-workshop-popin
- where: `Camp.tsx:160` (upgrades, keyed `u.id`) and `:487` (weapon tuning, keyed `base.id`).
- sees: every upgrade/tuning card pops in together when Workshop opens.
- params: ui-popin, delay 0 for all.
- class: panel-entrance
- reduced-motion: ignored.
- reach: `camp-tab-workshop` → `camp-upgrade-<id>`, `camp-weapon-upgrade-<id>`.
- smells: EVERYTHING-AT-ONCE (dozens of cards, no stagger), and the pop never replays on purchase (keys stable).

#### camp-purchase (missing)
- where: `Camp.tsx:173-193` (`camp-buy-upgrade-<id>`, `camp-refund-upgrade-<id>`), `:505-545` (`camp-tune-<w>-<key>`, `camp-refund-weapon-<w>`), `:259-267` (`camp-refund-all`).
- sees: pips fill, "Now/Next" text and CoinPill total change instantly (sfx only).
- class: number-pop / progress
- smells: NO-MOTION (spending feedback).

#### camp-armory-equip
- where: `Camp.tsx:601-628`; slots `:566-579`; slots-full note `:580-582`; docked explainer `:691-703`.
- sees: tapped weapon's avatar plays its tap animation (external `triggerKey`); slot fills and border/background turn gold instantly; full-slots note appears instantly; bottom dock with WeaponExplainer pops in/out instantly (return bar hides at the same time).
- class: ui-feedback / panel-entrance
- smells: NO-MOTION (no travel to slot, dock has no slide), "full" refusal has no shake.
- reach: `camp-tab-armory` → `camp-armory-<weaponId>`, `camp-charm-slots`, `camp-charms-full`, `camp-armory-guide`.

#### camp-fighters
- where: `Camp.tsx:353-433` (FighterAvatar `reaction` from `fireFighterReaction` `:142-145`: `joy` on Use, `powerup` on Skill tree; `animate` when selected or reacting).
- sees: Use → avatar joy reaction + USING tag appears instantly. Skill tree → `powerup` reaction fires but the list is replaced by the tree in the same render, so it is never seen.
- class: character-acting
- smells: NO-MOTION (USING tag, border), wasted reaction on tree open.
- reach: `camp-tab-fighters` → `camp-fighter-<Name>`, `camp-fighter-avatar-<Name>`, `camp-open-tree-<Name>`.

#### camp-arcana-toggle (missing)
- where: `Camp.tsx:648-683`
- sees: tarot turns gold + ACTIVE tag instantly.
- class: ui-feedback
- smells: NO-MOTION.
- reach: `camp-tab-arcana` → `camp-arcana-<id>`.

#### camp-settings-toggles
- where: `Camp.tsx:302-343` (`camp-toggle-sound`, `camp-toggle-effects`, `camp-toggle-analytics`).
- sees: label text swaps on/off.
- class: text-swap; smells: NO-MOTION (minor).

#### camp-return-bar (missing)
- where: `Camp.tsx:705-714`
- sees: "Ready: 1-7 …" bar is just there.
- class: panel-entrance; smells: NO-MOTION.
- reach: from a preview lesson with a Camp button (`preview-lesson-camp`, e.g. 1-7) → `camp-return-bar` / `camp-return-fight`.

#### skill-tree-open (missing)
- where: `Camp.tsx:349-351`, `SkillTree.tsx:118-225`
- sees: fighter list replaced by the tree instantly; links and nodes all present at once.
- class: screen-transition
- smells: NO-MOTION.
- reach: `camp-tab-fighters` → `camp-open-tree-Orange Tabby` → `[data-testid="skill-tree-Orange Tabby"]`, `skill-map`.

#### skill-node-select / skill-node-buy (missing)
- where: `SkillTree.tsx:191` (select), `:255-295` (node style by status), lines lit `:105-114`, buy/refund `:341-343`, refund all `:205-210`.
- sees: selected node gets a frame instantly; buying turns the node teal, lights its links and updates the star pool with no transition.
- class: ui-feedback / progress
- smells: NO-MOTION (the main payoff of spending stars), lines are `lit` booleans (no draw-on).
- reach: tree → `skill-node-<id>` → `skill-buy` / `skill-refund-node`; `skill-refund-fighter`; `skill-tree-stars`.

#### skill-detail-modal
- where: `SkillTree.tsx:215-216` (conditional), `:309`
- sees: detail sheet fades in over the tree.
- params: RN-web fade 250 ms easeOutCubic.
- class: panel-entrance
- reduced-motion: ignored.
- reach: `skill-node-<id>` → `[data-testid="skill-detail"]`.
- smells: FADE-ONLY, NO-EXIT.

#### bounty-cards-popin
- where: `BountyBoard.tsx:92` (keyed `b.id`)
- sees: all bounty cards pop in together on open; switching filter pops in only cards that were not shown before, the rest cut.
- params: ui-popin.
- class: panel-entrance
- reach: `camp-tab-bounties` → `bounty-filter-<id>`.
- smells: EVERYTHING-AT-ONCE, inconsistent on filter change.

#### bounty-progress-static (missing)
- where: `BountyBoard.tsx:110-113` (`barFill` width %).
- class: progress; smells: NO-MOTION, NOT-TRANSFORM/OPACITY if animated as width.

#### history-expand (missing)
- where: `BattleHistory.tsx:207-262` (`history-battle` toggles `history-details`), `:276-281` (`history-power`), `:345-349` (`history-more`), chart bar select `:167-173` (`history-chart-bar-<i>`).
- sees: details open/close and more rows appear instantly; DPM chart is static.
- class: panel-entrance / progress
- smells: NO-MOTION.
- reach: needs recorded battles (stored apart from the save, so play a fight first) → `camp-tab-history` → `history-chart`, `history-battle`.

#### guide-tabs (missing)
- where: `FieldGuide.tsx:109-132` (`guide-tab-mechanics|fighters|recipes`), entries `:138` (opens MechanicIntro reference `:279`).
- sees: tab content cut instantly; entry opens lesson (lesson-modal-fade + lesson-step-rise).
- class: screen-transition
- smells: NO-MOTION.
- reach: map with ≥1 star → `map-dock-guide` → `guide-tab-recipes`, `recipe-<id>`.

#### weapon-explainer-toggle (missing)
- where: `WeaponExplainer.tsx:48`, `:59-91`, `:93-146`
- sees: ▼/▲ toggles "more" block instantly; sound row text "Hear it"→"Playing" swaps.
- class: panel-entrance
- smells: NO-MOTION.
- reach: preview charms or `camp-armory-guide` → `weapon-explainer-toggle-<id>`, `weapon-explainer-sound-<id>`.

#### companion-text-swap (missing)
- where: `CompanionBubble.tsx:30-127` (used by map, preview, results, camp, skill tree, unlock).
- sees: bubble text changes with no transition; avatar animates only if `animate`.
- class: text-swap; smells: NO-MOTION (minor).

#### hud-inspector-enter (ambiguous file)
- where: `HudInspector.tsx:259-267` (Modal fade + PopIn), returns null when `!target` (`:40`).
- sees: tapped HUD part's explainer card fades/pops in over the paused fight.
- params: fade 250 ms + PopIn 180/140 ms.
- class: panel-entrance
- reduced-motion: ignored.
- reach: in a fight, tap a HUD chip (see AdventureRun `setHudInspect`) → `[data-testid="hud-inspector-modal"]`, close `hud-inspector-close`.
- smells: TWO-HEROES (fade + scale stacked), NO-EXIT.

---

## 1. Screen flow map

```
[cold open]  StoryIntro (beats cut, own per-beat rises) --cut--> AdventureRun 1-1
[map]        AdventureMap (no enter motion; autoscroll 120 ms later; secret-path arrival if fresh)
   tap node -> LevelPreview  (Modal slide 250 + PopIn; exit = instant unmount)
       Fight! -> (optional) MechanicIntro lesson (Modal fade 250 + step rise 180; exit instant)
              -> AdventureRun (cut)
       lesson card -> MechanicIntro reference (same)
       preview-lesson-camp -> Camp (cut)
   dock Camp -> Camp menu (cut) -> sections (cut) -> SkillTree inline (cut) -> node detail (fade 250, no exit)
                                -> Bounties own screen (cut, cards PopIn)
                                -> History (cut) -> FightReplay (slide 250, no exit)
   dock Guide -> FieldGuide (cut) -> MechanicIntro (fade)
AdventureRun --cut--> LevelResults (card PopIn 180, stars 350/800/1250)
   +starsLandedMs (1050-1950 ms) --> UnlockReveal (opaque, fade 250; each unlock cut; exit instant)
        -> "Show me on the map" -> Map (cut) + trail/arrival
        -> feature button -> Camp tab (cut)
   results-next -> LevelPreview over results (slide)   results-map / results-camp -> cut
   results-replay -> FightReplay (slide, no exit)
```

Every full-screen change is a hard cut; overlays enter with the RN-web Modal CSS animation (250 ms) and never exit.

## 2. Shared motion constants

There is **no central motion token file** for this area. What exists:
- `src/adventure/components/ui.tsx:48-49`: `starPopDelayMs(i) = 350 + i*450`, `starsLandedMs(n) = 600 + n*450` (shared by StarRow, LevelResults audio, AdventureMode unlock timer). The only cross-file timing constants.
- `src/adventure/components/AdventureMap.tsx:47-49`: `DASH_STEP = 12`, `ARRIVE = { startMs: 700, dashMs: 55, popMs: 380, tagMs: 2000, betweenMs: 500 }` (file-local; note `popMs: 380` is a hand-copied sum of the 220+160 pop, not derived).
- Primitives `PopIn`, `Bob`, `AnimatedStar` in `ui.tsx` hard-code their durations/easings inline (180/140, 600, 140/120).
- Everything else is literal per call site (StoryIntro 250/620/870/700/950/320/220/140; UnlockReveal 70/380/140/160/260/26000; MechanicIntro 180). Recurring easing: `Easing.out(Easing.cubic)` for entrances, `Easing.inOut(Easing.quad)` for settles. No springs anywhere in this area.
- The fight side has its own catalog (`src/adventure/fx/`, other auditor), not used here.

## 3. Top 12 candidates

1. **screen-swap**: every screen change (map/camp/guide/results/story→fight) is a hard cut; one shared transition would lift the whole mode.
2. **results-card-popin + results-coins**: the payoff screen lands as one block in 180 ms and coins never count up although the coin-roll sound plays.
3. **unlock-hero-pop**: the biggest reveal outside the fight is a 300 ms bump with a hard content swap, no anticipation, no reduced-motion respect for the white flash.
4. **preview-sheet-enter / exit**: two stacked entrances (slide + scale), the dim backdrop slides with the sheet, and it vanishes with no exit.
5. **skill-node-buy**: spending stars (the core meta loop) gives no motion: node colour, lit links and pool all snap.
6. **unlock-advance**: multi-unlock wins cut from reveal to the next silhouette, no hand-off between items.
7. **results-unlock-delay + results-star-pop**: 260 ms star pops with ~440 ms of dead time before the reveal, all scheduled by parallel setTimeouts.
8. **modal NO-EXIT everywhere** (lesson, unlock, skill detail, replay, hud inspector): all overlays unmount instantly; a shared exit pattern is cheap.
9. **camp-armory-equip / preview-charm-equip**: equipping a charm has no travel into the slot, and the explainer dock pops in and out.
10. **camp-workshop-popin / bounty-cards-popin**: long lists pop in all at once (no stagger) and purchases have no feedback.
11. **lesson-step-rise + lesson-quiz-feedback**: steps never cross-fade (Back moves the same way as Continue) and a quiz verdict has no motion.
12. **ui-btn-press**: every press is a 150/250 ms opacity fade; the 3D-bordered buttons never press down (fade-only, release slower than press).

Honourable mentions: map-progress-static (region bar / star count after a win), story-beat-swap (no crossfade between beats), reduced motion ignored by `PopIn`, `AnimatedStar`, `UnlockReveal` and all Modals.

## Dev route reference (app/dev/adventure.tsx)

`/dev/adventure` mounts `AdventureMode` with:
- `?save=maxed`: `createMaxedSave()`: everything unlocked, ★★★ everywhere, 50k coins (not persisted until you play).
- `?save=fresh`: `createNewSave()`: opens on StoryIntro then 1-1 (`coldOpen` defaults true).
- `?save=before:<levelId>`: `createSaveBefore(id)`: ★★★ on every main level before it, so it is the frontier (e.g. `before:1-4`).
- `?intro=false`: `coldOpen=false`, a fresh save opens on the map.
- `?autoplay=true`: the board plays itself (`autoPlayer`), and in-fight tips auto-dismiss after 1600 ms.
- No param: the stored save. `onExit` returns to `/`.
- Dev web builds expose `window.__nshapesRun` (live fight state) from `AdventureRun.tsx:216`.

Handy paths for Playwright:
- Story: `/dev/adventure?save=fresh` → `story-intro`, `story-next`, `story-skip`.
- Map: `/dev/adventure?save=fresh&intro=false` → `map-top-bar`, `map-node-<id>`, `map-play-next`, `map-dock-guide`, `map-dock-camp`, `map-guide-banner`, `map-loot-<id>`, `map-world-progress-<biome>`.
- Preview: tap `map-node-<id>` → `preview-play`, `preview-lesson`, `preview-lesson-camp`, `preview-fighter-<Name>`, `charm-<id>`, `preview-slot-<i>`, `preview-arcana-<id>`, `preview-arm-recipe`.
- Lesson: `/dev/adventure?save=before:1-2` → `map-node-1-2` → `preview-lesson` → `lesson-modal`, `mechanic-intro-ok`, `quiz-yes`, `quiz-no`.
- Results + reveal + secret path: `/dev/adventure?save=before:1-4&autoplay=true` → `map-node-1-4` → `preview-play` → `unlock-modal` → `unlock-reveal` → `unlock-primary` (repeat) → map arrival, or `results-*` testIDs.
- Camp: `/dev/adventure?save=maxed` → `map-dock-camp` → `camp-tab-<id>`, `camp-open-tree-<Name>` → `skill-node-<id>` → `skill-detail`, `skill-buy`.
