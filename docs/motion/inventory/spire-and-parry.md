> Audit of 2026-11-18 at commit b983a28 (v0.1.137): the Starfall Spire, Set-Parrying, the Kill-Cam and Multiplier Ignition. File:line references drift; re-audit before trusting them. Part of the motion loop: see docs/motion/ledger.md.

# Starfall Spire, Set-Parrying, Kill-Cam, Multiplier Ignition: motion inventory

Repo: `the repository root` (worktree). Read-only audit. Line numbers are of commit b983a28 (every audited file is unchanged at HEAD 49653d8; since b983a28 only `src/utils/motion.ts` was added and `app/dev/fx.tsx` touched). Ledger prefix for these entries: `N:` (new).

## 0. Scope and call-site count

| File (new or changed in f56d11e..b983a28) | What moves | Own animation calls |
|---|---|---|
| `src/adventure/fx/KillCamOverlay.tsx` (new) | dim, banner, white flash, 12 star shards | 8 `withTiming`, 4 `withDelay`, 3 `withSequence`, 2 `setTimeout`, 4 `Animated.*` |
| `src/adventure/fx/MultiplierIgnition.tsx` (new) | equation strip, chips, total slam, flame loop | 6 `withTiming`, 2 `withSequence`, 1 `withRepeat`, 5 `setTimeout`, 2 `cancelAnimation`, 3 `Animated.View` |
| `src/adventure/components/ParryIntentBar.tsx` (new) | parry bar pulse; fill and colour by re-render | 2 `withTiming`, 1 `withSequence`, 1 `withRepeat`, 2 `cancelAnimation`, 1 `Animated.View` |
| `src/adventure/components/ParryPreviewCard.tsx` (new) | nothing (static card; rides its host's PopIn / Modal) | 0 |
| `src/adventure/fx/catalog.ts` (4 new rows) | `parry_warn`, `parry`, `perfect_parry`, `foe_strike` drawn by the existing stage pieces | 0 (data) |
| `src/adventure/components/AdventureRun.tsx` (changed) | mounts `ParryIntentBar` (:982), `MultiplierIgnition` (:998), `KillCamOverlay` (:1036); new rows reuse `onLand` foe shake (:355-358, pre-existing) | 0 new |
| `src/adventure/components/HudInspector.tsx`, `LevelPreview.tsx` (changed) | add the static `ParryPreviewCard`; their `Modal animationType` (:261 fade, :101 slide) are pre-existing (A:hud-inspector-enter, A:preview-sheet-enter) | 0 new |
| `src/audio/band.ts`, `fightAudio.ts` (changed) | 8 new cues, 4 new `EVENT_CUE` rows (sound only) | 0 |
| `src/components/MainMenu.tsx` (changed) | new Spire button (no press state), tighter layout | 0 |
| `src/components/Game.tsx`, `OptionsMenu.tsx` (changed) | `'spire'` phase (hard cut), reset hook; OptionsMenu Modal fade :71 pre-existing | 0 new |
| `src/spire/components/*.tsx` (12 new), `app/dev/spire.tsx` (new) | `PopIn` ×12, `Bob` ×1, `Modal animationType="fade"` ×1, avatars, `TouchableOpacity` dims | 0 direct Reanimated calls |

**Counts.** Reanimated calls in the new and changed files: **28 found, 28 covered** (KillCam 15: dim 4, banner 5, flash 4, shards 2 · Ignition 9: enter 1, slam 3, flames 4, exit 1 · ParryIntentBar 4: pulse 4). JS animation timers: **7 found, 7 covered** (KillCam 2: shatter cue + unmount · Ignition 5: flame start, chip steps, slam, fade-out, unmount). `Modal animationType`: **1 new** (SpireBuildModal:43, covered) + 3 pre-existing in changed files (attributed to A: entries). `<PopIn`: **12 found, 12 covered** (SpireEndScreen:45, SpireEncounterPreview:38, SpireCampfire:39/:52, SpireBuildModal:46, SpireTreasure:35/:46, SpireEvent:49/:104, SpireShop:60, SpireSetup:72, SpireRewardScreen:66). `<Bob`: **1 found, 1 covered** (SpireMap:222). Animated avatars: **4 found, 4 covered** (SpireEndScreen:61 FighterAvatar, SpireEncounterPreview:49 EnemyAvatar `entrance`, SpireCampfire:41 FighterAvatar idle, SpireSetup:107 FighterAvatar `animate={sel}`); static avatars (`animate={false}` / `lightweight`): SpireBuildModal:48, SpireHeader:38, SpireSetup:74, SpireMap:88; `WeaponAvatar` everywhere in Spire is static (no `interactive`, no `triggerKey`). No RN `Animated`, no CSS animation, no layout `entering/exiting`, no frame callback, no `LayoutAnimation` anywhere in the scope.

**Shared primitives used (params in `docs/motion/inventory/adventure-screens.md`):** `PopIn` (`ui.tsx:146-156`: scale 0.94→1 in 180 ms `Easing.out(Easing.cubic)`, opacity 0→1 in 140 ms default easing; not reduced-motion aware; A:ui-popin) · `Bob` (`ui.tsx:123-142`: translateY 0→−amount→0, 600+600 ms `Easing.inOut(Easing.sin)`, gated on `useAppActive`, not on reduced motion; A:ui-bob) · `Btn`/`TouchableOpacity` (activeOpacity dim, RN-web CSS 150 ms in / 250 ms out; A:ui-btn-press) · RN-web `Modal animationType="fade"` (250 ms; A:hud-inspector-enter) · `FightReplay` Modal slide (A:replay-modal-slide).

**Motion tokens:** none of the new code imports `src/utils/motion.ts`. Every duration, easing and distance below is a literal.

**Reduced motion / Effects.** Adventure: `effects = save.effectsOn && !reducedMotion` (`AdventureMode.tsx:284`). Spire: `effects={prefs.effectsOn && !reducedMotion}` and the Effects switch is hidden under reduced motion (`SpireMode.tsx:223-224`). KillCam gets `enabled={effects && !practice}`, MultiplierIgnition `enabled={effects && showDamageHud}`; ParryIntentBar gets only `active={playing && appActive}`. Spire screens outside the fight use `useReducedMotion` nowhere (only `SpireMode` reads it, to pass to the fight).

## 1. Entries

Common fight reach: `/dev/adventure?save=before:1-7&intro=false` → `[data-testid="map-play-next"]` → `[data-testid="preview-play"]`; make Sets by reading `window.__nshapesRun.board` and tapping `[data-testid="card-slot-<row>-<col>"]`. Parry exists from 1-5 (`data/parry.ts:155` `NO_PARRY_LEVELS` 1-1..1-4); damage HUD (and therefore Ignition) from 1-7 (`coach.ts:738`). Spire fight: `/dev/spire?start=true` → `[data-testid="spire-node-a1-r0-c<col>"]` → `[data-testid="spire-enter-fight"]` (Spire always shows the damage HUD and Ignition). Pause → `[data-testid="toggle-effects"]` turns effects off.

### A. Menu

#### menu-spire-button-press
- where: `src/components/MainMenu.tsx:221-231` (MenuButton `variant="spire"`; component :90-117)
- sees: tapping the purple "Starfall Spire" button: nothing changes on the button; the screen cuts to the Spire.
- trigger: press.
- mechanism: `Pressable` with no `pressed` style (only the Discord button :285 has one).
- params: none. (Layout of the whole menu was tightened: padding 40→22, title 56→48, gaps 16→12; static.)
- class: ui-feedback
- reduced-motion: n/a.
- reach: `/` → `[data-testid="menu-spire"]`.
- smells: NO-MOTION (no press feedback at all on a primary menu button; same gap on every MenuButton, new here for the Spire variant).

#### menu-spire-enter-cut
- where: `src/components/Game.tsx:2020` (`setGamePhase('spire')`), `:2048-2049` (render `SpireMode`); exit `SpireMode.tsx:199`, `:255-262` → `onExit` → `exitToMenu`
- sees: main menu is replaced by the Spire setup screen in one frame; leaving the Spire cuts back to the menu.
- trigger: menu button / setup back / end-screen menu.
- mechanism: conditional render (no transition).
- params: –
- class: screen-transition
- reduced-motion: –
- reach: `/` → `[data-testid="menu-spire"]`; back with `[data-testid="spire-setup-back"]`.
- smells: NO-MOTION (mode entrance).

### B. Spire: setup

#### spire-setup-mount
- where: `src/spire/components/SpireSetup.tsx:49` (screen), `:72` (`<PopIn style={st.resumeCard}>`, only with a live run)
- sees: setup screen is just there; if a run is saved, the resume card pops (scales 94%→100% and fades in).
- trigger: mount of `SpireSetup` (`SpireMode.tsx:191-202`).
- mechanism: conditional render + Reanimated `PopIn`.
- params: PopIn 180 ms scale / 140 ms opacity (A:ui-popin), no delay; title, fighter grid, kit card, ascension and Start button have no entrance.
- class: panel-entrance
- reduced-motion: PopIn still scales 6%.
- reach: `/dev/spire` (no params) → `[data-testid="spire-setup"]`; resume card after leaving a run via `[data-testid="spire-back-menu"]` → `[data-testid="spire-resume-run"]`.
- smells: NO-MOTION (screen), FADE-ONLY-ish on the one card that moves; EVERYTHING-AT-ONCE (all else static).

#### spire-setup-fighter-select
- where: `SpireSetup.tsx:99-110`
- sees: tapping a fighter tile: the tile dims while pressed, its frame/colours switch to "selected", and that fighter's avatar starts its idle animation in `anticipation` mood; the previous one freezes.
- trigger: press → `setFighter`.
- mechanism: `TouchableOpacity activeOpacity={0.85}`; style swap; `FighterAvatar animate={sel}` (external rig, S: creature entries).
- params: opacity dim (A:ui-btn-press); style swap instant; avatar starts/stops its rig instantly (no ease-in of the idle).
- class: ui-feedback
- reduced-motion: FighterAvatar respects OS reduced motion (`FighterAvatar.tsx:452` + `useReducedMotion`); the dim is opacity only.
- reach: `/dev/spire` → `[data-testid="spire-fighter-Sly Fox"]`.
- smells: NO-MOTION (selection is a colour swap; the avatar's freeze on deselect is a pop).

#### spire-setup-steppers
- where: `SpireSetup.tsx:162-185` (ascension −/+), `:171` value, `:200-203` seed reroll, `:209` start
- sees: ascension number, its description and the seed digits swap instantly.
- trigger: press.
- mechanism: re-render; `TouchableOpacity` dims.
- params: none; disabled steppers drop to opacity 0.35 instantly.
- class: text-swap
- reduced-motion: n/a.
- reach: `[data-testid="spire-asc-up"]`, `[data-testid="spire-asc-down"]`, `[data-testid="spire-asc-value"]`.
- smells: NO-MOTION (minor).

#### spire-setup-to-map-cut
- where: `SpireMode.tsx:133-142` (`handleStartNew` / `handleResume` → `setInSetup(false)`), `:267-283`
- sees: Start Climb / Resume: setup cuts to the header + map.
- trigger: `[data-testid="spire-start-climb"]` / `[data-testid="spire-resume-run"]`.
- mechanism: conditional render.
- params: –
- class: screen-transition
- reduced-motion: –
- reach: `/dev/spire` → `[data-testid="spire-start-climb"]`.
- smells: NO-MOTION.

### C. Spire: map and header

#### spire-map-node-bob
- where: `src/spire/components/SpireMap.tsx:222` (`<Bob active amount={4}>` around each reachable node)
- sees: every node you can go to next floats up and down 4 px, all in step.
- trigger: loop while the node is reachable (mount).
- mechanism: Reanimated `withRepeat(withSequence(withTiming, withTiming), -1)` inside `Bob`.
- params: translateY 0 → −4 → 0, 600 + 600 ms `Easing.inOut(Easing.sin)` (A:ui-bob); 1-4 nodes at once, all mounted together so all in phase; `active` hard-coded `true`.
- class: ambient-loop
- reduced-motion: **keeps bobbing** with OS reduced motion (the Adventure map passes `isLive = … && !reducedMotion`, `AdventureMap.tsx:152`; Spire does not). Keeps bobbing behind the Build modal.
- reach: `/dev/spire?start=true` → `[data-testid="spire-map"]`, nodes `[data-testid="spire-node-a1-r0-c0"]` etc.
- smells: REDUCED-MOTION-GAP, EVERYTHING-AT-ONCE (identical phase on every node; numbers.md asks a different period per thing). PERF is fine (`Bob` is gated on `useAppActive` and cancels).

#### spire-map-autoscroll
- where: `SpireMap.tsx:67-72`
- sees: the map opens (or a new act opens) already scrolled to the next row; nothing travels.
- trigger: layout (`viewH`), `map.act`, `targetRow` change.
- mechanism: `ScrollView.scrollTo({ y, animated: false })`.
- params: `y = max(0, centerY(targetRow) − viewH·0.55)`.
- class: ui-move
- reduced-motion: n/a.
- reach: `/dev/spire?start=true`; clear a floor and return to the map.
- smells: NO-MOTION (the climb one row up after a floor is a jump; no sense of ascending).

#### spire-map-node-press
- where: `SpireMap.tsx:185-217` (`TouchableOpacity activeOpacity={0.82}`), `:148-151` (`selectSpireNode`)
- sees: tapped node dims; the map cuts straight to the room or the fight briefing. Visited/reachable state (✓, colours, GO badge, path colours) swaps instantly next time the map shows.
- trigger: press.
- mechanism: opacity dim + conditional render (`SpireMode.tsx:278-354`).
- params: activeOpacity 0.82 (A:ui-btn-press timing).
- class: ui-feedback / screen-transition
- reduced-motion: n/a.
- reach: `/dev/spire?start=true` → `[data-testid="spire-node-a1-r0-c0"]`.
- smells: NO-MOTION (no "travel to node" beat; node completion never shown), FADE-ONLY.

#### spire-map-act-change
- where: `SpireMode.tsx:278-283` with `runState.ts:514` (`phase: 'map'` for the next act)
- sees: after an act boss and its rewards, the map shows the next act's map, title and biome colour in one frame.
- trigger: `finishSpireRewards` on an act boss.
- mechanism: re-render; autoscroll (`spire-map-autoscroll`) jumps.
- params: –
- class: screen-transition
- reduced-motion: –
- reach: beat the act boss (`?autoplay=true` helps) → `[data-testid="spire-reward-continue"]` ("Ascend to Act 2").
- smells: NO-MOTION (a once-per-act moment with no reveal).

#### spire-header-stat-swap
- where: `src/spire/components/SpireHeader.tsx:25-75`
- sees: hearts, coins, floor and weapon counts in the header change number instantly when you buy, heal, rest or claim.
- trigger: any `updateRun`.
- mechanism: re-render; `FighterAvatar animate={false}`.
- params: –
- class: number-pop
- reduced-motion: –
- reach: `/dev/spire?room=shop` → `[data-testid="spire-shop-heal"]`, watch `[data-testid="spire-header"]`.
- smells: NO-MOTION (no count, no bump; the Adventure HUD bumps its chips on change).

### D. Spire: rooms

#### spire-preview-card-popin
- where: `src/spire/components/SpireEncounterPreview.tsx:38` (`<PopIn style={st.card}>`)
- sees: the fight briefing card (foe, HP, clock, parry card, rewards, FIGHT!) pops in as one block.
- trigger: phase `preview`.
- mechanism: Reanimated `PopIn`.
- params: 180 ms scale 0.94→1 out-cubic, 140 ms fade (A:ui-popin), no stagger.
- class: panel-entrance
- reduced-motion: still scales 6%.
- reach: `/dev/spire?start=true` → `[data-testid="spire-node-a1-r0-c0"]` (a skirmish) → `[data-testid="spire-encounter-preview"]`.
- smells: EVERYTHING-AT-ONCE (one block, the foe portrait is not staged), MAGIC-NUMBERS (shared PopIn literals).

#### spire-preview-foe-entrance
- where: `SpireEncounterPreview.tsx:49-55` (`EnemyAvatar reaction={{ type: 'entrance', id: 1 }} interactive`, mood `enraged` boss / `menacing`)
- sees: the foe portrait plays its entrance acting at the same time the card pops; tapping it pokes it.
- trigger: mount.
- mechanism: external creature rig (S:enemy-react-entrance, 820 ms hold).
- params: see shared-components; starts on the same frame as the PopIn.
- class: character-acting
- reduced-motion: EnemyAvatar respects OS reduced motion (`EnemyAvatar.tsx:386-387`).
- reach: as above.
- smells: TWO-HEROES (entrance and card pop start together).

#### spire-preview-to-fight-cut
- where: `SpireEncounterPreview.tsx:141` → `SpireMode.tsx:289` (`startSpireEncounter`) → `:204-236` (`AdventureRun`)
- sees: FIGHT! cuts to the fight screen; the fight's own opening (FIGHT! banner, deal-in, entrances) then plays (F:41).
- trigger: `[data-testid="spire-enter-fight"]`.
- mechanism: conditional render.
- params: –
- class: screen-transition
- reduced-motion: –
- reach: as above → `[data-testid="spire-enter-fight"]`.
- smells: NO-MOTION.

#### spire-fight-to-reward-cut
- where: `SpireMode.tsx:149-167` (`handleBattleFinish`), `:294-308`, `:239-265`; quit `:216-220`
- sees: after the knockout hand-off (F:45, 900 ms still), the fight cuts to the Spire reward screen (or to the defeat screen); "Retreat to Briefing" from pause cuts back to the preview.
- trigger: `AdventureRun.onFinish` / `onQuit`.
- mechanism: conditional render.
- params: –
- class: screen-transition
- reduced-motion: –
- reach: win a Spire fight (`/dev/spire?start=true&autoplay=true`).
- smells: NO-MOTION, DEAD-TIME (inherits F:45's 900 ms still before the cut).

#### spire-reward-banner-popin
- where: `src/spire/components/SpireRewardScreen.tsx:66` (`<PopIn style={st.bannerCard}>`)
- sees: "FLOOR CLEARED! / <Foe> Knocked Out!" card with coins, DPM, best hit, parries pops in; the three draft sections below it are simply there.
- trigger: phase `reward`.
- mechanism: `PopIn`.
- params: A:ui-popin; no delay; coin pill shows the final number (no count-up).
- class: panel-entrance (it is the run's most frequent payoff, so arguably hero-reveal)
- reduced-motion: still scales 6%.
- reach: win a fight → `[data-testid="spire-reward-screen"]`.
- smells: DURATION-OUT-OF-BAND (a payoff at 180 ms, hero band is 300-900), EVERYTHING-AT-ONCE (sections not staged), NO-MOTION (coins earned not counted).

#### spire-reward-draft-claim
- where: `SpireRewardScreen.tsx:100-235` (weapon draft :101, reroll :106, inspect :127, pick :149, skip :172; skill :183/:192; arcana :214/:222), `:244` continue
- sees: picking a weapon/skill/arcana: the whole section disappears in one frame and everything below jumps up; reroll replaces the three offers instantly; selecting an offer to inspect swaps the explainer instantly.
- trigger: press.
- mechanism: conditional render (`!reward.weaponClaimed && …`); `TouchableOpacity` dims.
- params: –
- class: exit / ui-move
- reduced-motion: –
- reach: `[data-testid="spire-draft-pick-0"]`, `[data-testid="spire-draft-reroll"]`, `[data-testid="spire-skill-pick-0"]`, `[data-testid="spire-arcana-pick-0"]`.
- smells: NO-MOTION (no "weapon get" moment; the static `WeaponAvatar` never reacts), NO-EXIT, NOT-TRANSFORM/OPACITY (layout collapse as a jump).

#### spire-shop-header-popin
- where: `src/spire/components/SpireShop.tsx:60` (`<PopIn style={st.headerCard}>`)
- sees: the shop's header card pops in; the weapon list, upgrades, heal, forge and arcana sections are just there.
- trigger: phase `shop`.
- mechanism: `PopIn`.
- params: A:ui-popin.
- class: panel-entrance
- reduced-motion: still scales 6%.
- reach: `/dev/spire?room=shop` → `[data-testid="spire-shop"]`.
- smells: EVERYTHING-AT-ONCE.

#### spire-shop-purchase
- where: `SpireShop.tsx:76` (reroll), `:95` (inspect), `:113` (buy weapon), `:150` (upgrade), `:173` (heal), `:192-216` (forge toggle and pick), `:247` (arcana), `:261` (leave)
- sees: buying: the row changes to sold or disappears, coins and hearts swap instantly; reroll swaps the stock; the forge list opens and closes in one frame.
- trigger: press.
- mechanism: re-render; `TouchableOpacity` dims.
- params: –
- class: ui-feedback
- reduced-motion: –
- reach: `/dev/spire?room=shop` (260 coins) → `[data-testid="spire-shop-weapon-0"]`, `[data-testid="spire-shop-heal"]`, `[data-testid="spire-shop-reroll"]`, `[data-testid="spire-shop-forge-toggle"]`.
- smells: NO-MOTION (purchase, cost leaving the coin pill, heal), NOT-TRANSFORM/OPACITY (expander as a layout jump).

#### spire-campfire-popin
- where: `src/spire/components/SpireCampfire.tsx:39` (hero card), `:52` (outcome card)
- sees: the campfire card pops in; after Rest/Forge/Meditate the three options vanish and an outcome card pops in.
- trigger: phase `campfire`; `campfire.resolved`.
- mechanism: `PopIn`.
- params: A:ui-popin each.
- class: panel-entrance
- reduced-motion: still scales 6%.
- reach: `/dev/spire?room=campfire` → `[data-testid="spire-campfire"]` → `[data-testid="spire-campfire-rest"]`.
- smells: NO-EXIT (options cut out under the outcome pop), EVERYTHING-AT-ONCE.

#### spire-campfire-fighter-idle
- where: `SpireCampfire.tsx:41` (`FighterAvatar … mood="idle"`, `animate` default true)
- sees: the fighter breathes and fidgets at the fire; resting does not make it react.
- trigger: mount.
- mechanism: external creature rig (S:creature-* entries).
- params: shared-components.
- class: ambient-loop
- reduced-motion: rig respects OS reduced motion.
- reach: `/dev/spire?room=campfire`.
- smells: NO-MOTION (Rest heals with no `heal`/`relief` reaction; the mood never changes).

#### spire-campfire-submode-swap
- where: `SpireCampfire.tsx:79`, `:95`, `:117`, `:135`, `:163`
- sees: Forge / Meditate replace the three options with a list in one frame; Back cuts back.
- trigger: press.
- mechanism: conditional render (`subMode`).
- params: –
- class: screen-transition (inside a panel)
- reduced-motion: –
- reach: `[data-testid="spire-campfire-forge-open"]`, `[data-testid="spire-campfire-meditate-open"]`.
- smells: NO-MOTION.

#### spire-event-popin
- where: `src/spire/components/SpireEvent.tsx:49` (story card), `:104` (outcome card)
- sees: the event story card pops in; choosing an option cuts the options and pops an outcome card (with a weapon/skill/forge pick when pending).
- trigger: phase `event`; option chosen.
- mechanism: `PopIn`.
- params: A:ui-popin.
- class: panel-entrance
- reduced-motion: still scales 6%.
- reach: `/dev/spire?room=event` → `[data-testid="spire-event"]` → `[data-testid="spire-event-opt-0"]`.
- smells: NO-EXIT, EVERYTHING-AT-ONCE (story text arrives as a block; no line reveal).

#### spire-treasure-popin
- where: `src/spire/components/SpireTreasure.tsx:35` (hero), `:46` (claimed card)
- sees: the treasure card pops in; claiming cuts the three choices and pops a "claimed" card.
- trigger: phase `treasure`; claim.
- mechanism: `PopIn`.
- params: A:ui-popin.
- class: panel-entrance (a treasure is a reward: hero-reveal territory)
- reduced-motion: still scales 6%.
- reach: `/dev/spire?room=treasure` → `[data-testid="spire-treasure-weapon"]` / `-arcana` / `-coins`.
- smells: DURATION-OUT-OF-BAND (a reward reveal at 180 ms), NO-MOTION (no chest open, no item reveal), NO-EXIT.

#### spire-room-exit-cut
- where: `SpireCampfire.tsx:55`, `SpireTreasure.tsx:49`, `SpireEvent.tsx:180`, `SpireShop.tsx:261`, `SpireRewardScreen.tsx:244` → `SpireMode.tsx:278-354`; header back `SpireHeader.tsx:29` → `SpireMode.tsx:272-275`
- sees: "Return to Map" / "Leave Shop" / "Continue" cut to the map; header back cuts to setup.
- trigger: press.
- mechanism: conditional render.
- params: –
- class: screen-transition
- reduced-motion: –
- reach: `[data-testid="spire-campfire-leave"]`, `[data-testid="spire-shop-leave"]`, `[data-testid="spire-reward-continue"]`, `[data-testid="spire-back-menu"]`.
- smells: NO-MOTION.

### E. Spire: end of run, modals

#### spire-end-hero-popin
- where: `src/spire/components/SpireEndScreen.tsx:43-45` (`<PopIn style={st.hero}>`), stats grid :70-, buttons :108-122
- sees: "SPIRE CONQUERED!" (crown) or "CLIMB ENDED" (skull) card pops in; stats, build and buttons are just there.
- trigger: phase `victory` / `defeat`.
- mechanism: `PopIn`.
- params: A:ui-popin; nothing staged, no count-up of floors/DPM.
- class: hero-reveal
- reduced-motion: still scales 6%.
- reach: lose or win a run (`/dev/spire?start=true&autoplay=true`), `[data-testid="spire-victory"]` / `[data-testid="spire-defeat"]`.
- smells: DURATION-OUT-OF-BAND (hero <300 ms), NO-MOTION (the once-per-run payoff has no reveal), EVERYTHING-AT-ONCE.

#### spire-end-fighter-acting
- where: `SpireEndScreen.tsx:61-67` (`FighterAvatar mood={victory ? 'victory' : 'defeat'}`, health 0 on defeat)
- sees: the fighter cheers or slumps (mood loop) inside the popping card.
- trigger: mount.
- mechanism: external rig (moods; S: creature entries).
- params: shared-components.
- class: character-acting
- reduced-motion: rig respects OS reduced motion.
- reach: as above.
- smells: none of its own; starts on the PopIn frame (TWO-HEROES with the pop is mild).

#### spire-build-modal-open
- where: `src/spire/components/SpireBuildModal.tsx:43` (`Modal visible transparent animationType="fade"`), `:46` (`<PopIn style={st.sheet}>`)
- sees: the build inspector (fighter, passives, weapons, armed recipes, ascension) fades in with a dark backdrop while the sheet pops.
- trigger: `[data-testid="spire-open-build"]` or "Inspect build" on the preview.
- mechanism: RN-web Modal CSS fade + Reanimated PopIn.
- params: Modal fade 250 ms; PopIn 180/140 ms concurrently (fade and pop stacked, as A:hud-inspector-enter).
- class: panel-entrance
- reduced-motion: unchanged.
- reach: `/dev/spire?start=true` → `[data-testid="spire-open-build"]`; weapons `[data-testid="spire-build-weapon-<id>"]`.
- smells: FADE-ONLY backdrop + pop stacked (two curves for one arrival), MAGIC-NUMBERS.

#### spire-build-modal-close
- where: `SpireBuildModal.tsx:33` (`if (!visible) return null`), close `:45`, `:56`
- sees: tapping the backdrop or ✕: the modal is gone in one frame.
- trigger: `onClose` → `setBuildOpen(false)`.
- mechanism: unmount (the Modal never gets `visible={false}`, so its fade-out never runs).
- params: –
- class: exit
- reduced-motion: –
- reach: open as above, then the "Close" button (accessibilityLabel "Close"; no testID).
- smells: NO-EXIT.

#### spire-replay-modal
- where: `SpireRewardScreen.tsx:94` / `:260`, `SpireEndScreen.tsx:100` / `:131` (`FightReplay visible={replayOpen}`)
- sees: "What happened? See the fight" slides the fight replay up.
- trigger: press.
- mechanism: `FightReplay` Modal `animationType="slide"` (`FightReplay.tsx:449`).
- params: A:replay-modal-slide.
- class: panel-entrance
- reduced-motion: unchanged.
- reach: reward screen → "What happened?" button (no testID on it); modal `[data-testid="fight-replay"]`.
- smells: as A:replay-modal-slide.

#### spire-btn-press
- where: every `Btn` and `TouchableOpacity` in `src/spire/components/*` (activeOpacity 0.8 `Btn`, 0.85 option/choice cards, 0.82 map nodes, default 0.2 on header/close/seed buttons without `activeOpacity`)
- sees: the pressed thing dims; nothing moves.
- trigger: press.
- mechanism: RN-web opacity transition.
- params: A:ui-btn-press (150 ms in, 250 ms out).
- class: ui-feedback
- reduced-motion: n/a.
- reach: any Spire screen.
- smells: FADE-ONLY, EXIT-SLOWER-THAN-ENTER (as A:ui-btn-press).

### F. Set-Parrying: the bar (HUD)

#### parry-bar-mount
- where: `AdventureRun.tsx:982-989` (`{run.parry && <ParryIntentBar …/>}`), layout budget `:612` (`+ (run.parry ? 28 : 0)`)
- sees: a pill under the HUD saying what the foe will do next; present from the first frame of every fight from 1-5 on.
- trigger: `run.parry` non-null (`engine/run.ts:967`; re-made per wave at `:1212`).
- mechanism: conditional render.
- params: height 24 + marginTop 4 = 28 px reserved in `chromePx`; if a later wave's foe has no parry spec the bar unmounts and the stage/board re-lay out by 28 px in one frame.
- class: panel-entrance
- reduced-motion: –
- reach: `/dev/adventure?save=before:1-5&intro=false` → `map-play-next` → `preview-play` → `[data-testid="run-parry-bar"]`.
- smells: NO-MOTION (appears with everything else in the opening; possible 28 px board jump between waves).

#### parry-bar-fill
- where: `ParryIntentBar.tsx:44-49` (progress), `:103-113` (fill `width: progress·100%`), `:114-116` (gold perfect-zone marker at `(1 − perfectWindowMs/durationMs)·100%`, max 96%)
- sees: a red fill creeps right across the bar during the wind-up (teal fill drains during a stagger); a gold zone marks the last 3.5 s.
- trigger: every fight-clock `TICK` (250 ms) re-renders with new `msLeft`.
- mechanism: React re-render of a `width` percentage (no tween).
- params: steps every 250 ms (4 Hz); wind-up 13-16 s (e.g. 1-5 `Acorn Toss` 16 000 ms, default `Wild Lunge` 15 500 ms) ⇒ about 1.6 % of the bar per step; stops while the cascade holds the clock (`fx.busy`); the label's seconds (`toFixed(1)` under 4 s) change on the same steps.
- class: progress
- reduced-motion: unchanged (it is information).
- reach: as parry-bar-mount; wait out the calm phase (13-15.5 s).
- smells: NOT-TRANSFORM/OPACITY (width), TIMER-DRIVEN (4 Hz steps; a `scaleX` on the UI thread would be continuous).

#### parry-bar-phase-swap
- where: `ParryIntentBar.tsx:73-82` (label/icon), `:94-101` (bar styles), `:118-128` (text styles)
- sees: calm grey "Counter: ANY SET · next in 9s" → red "ACORN TOSS · ANY SET · 12s" → yellow "PERFECT PARRY! …" → teal "STAGGERED · ×2 DMG · 7.5s" → back to grey: background, border, fill colour, icon and wording all swap in one frame.
- trigger: `parry.phase` / `isInPerfectWindow` change on a tick or a Set.
- mechanism: style swap on re-render.
- params: colours `#F5F2EC/#C9C2B8` calm, `#FEE2E2/#B91C1C` wind-up, `actionYellow/INK` perfect, `#CCFBF1/#0F766E` staggered; no transition.
- class: text-swap
- reduced-motion: unchanged.
- reach: as above; staggered after a Set lands in the gold window (`/dev/adventure?save=before:1-10&intro=false` for specific counters).
- smells: NO-MOTION (the entry into the perfect window, the key moment of the mechanic, is a colour snap; text replaced in place while being read).

#### parry-bar-pulse
- where: `ParryIntentBar.tsx:56-71`
- sees: the whole bar (text included) throbs bigger and smaller twice a second during the gold perfect window and the whole stagger.
- trigger: `shouldPulse = active && appActive && (perfect || staggered)`; `active = playing && appActive` (`AdventureRun.tsx:985`).
- mechanism: Reanimated `withRepeat(withSequence(withTiming, withTiming), -1)` on scale; `cancelAnimation` + reset to 1 on stop and unmount.
- params: scale 1 → 1.035 (220 ms) → 1 (220 ms), default easing (`Easing.inOut(Easing.quad)`), 440 ms period (2.3 Hz); runs up to 3.5 s (perfect window) and 4.5 s / 8 s (counter / perfect stagger, `PARRY_RULES` :25-27); literals, no tokens.
- class: ambient-loop
- reduced-motion: **keeps pulsing** with OS reduced motion and with Effects off (no `reducedMotion`/`effects` input).
- reach: as parry-bar-mount; reach the last 3.5 s of a wind-up.
- smells: REDUCED-MOTION-GAP, BANNED-DEFAULT ("scale-pulse as the answer to every event"), text scaled while being read, MAGIC-NUMBERS. PERF is fine (gated on `useAppActive`, cancelled).

#### parry-bar-stall-badge
- where: `ParryIntentBar.tsx:129-133`; `counterAvailable` from `AdventureRun.tsx:540-543`
- sees: a small white "STALL +3s" badge appears in the bar when the asked-for counter Set is not on the board; disappears when one is dealt.
- trigger: board change during a specific-counter wind-up.
- mechanism: conditional render.
- params: –
- class: ui-feedback
- reduced-motion: –
- reach: a specific-counter level (World 2+ table in `data/parry.ts`).
- smells: NO-MOTION (badge pops in and out; text shifts the label sideways).

#### parry-bar-press
- where: `ParryIntentBar.tsx:85-93` (`TouchableOpacity activeOpacity={0.8}`), `AdventureRun.tsx:987` → `HudInspector` with `ParryPreviewCard` (`HudInspector.tsx:71`)
- sees: tapping the bar dims it and opens the foe inspector, which now lists the parry card.
- trigger: press.
- mechanism: opacity dim; Modal fade + PopIn (A:hud-inspector-enter).
- params: A:ui-btn-press; A:hud-inspector-enter.
- class: ui-feedback
- reduced-motion: n/a.
- reach: `[data-testid="run-parry-bar"]` → `[data-testid="inspector-parry-card"]`.
- smells: as the shared entries (FADE-ONLY, the bar dims while it may also be pulsing).

#### parry-preview-card
- where: `src/adventure/components/ParryPreviewCard.tsx:22-` (used at `LevelPreview.tsx:190-193`, `SpireEncounterPreview.tsx:91`, `HudInspector.tsx:71`)
- sees: a static card explaining the foe's telegraphed attack and its counter; arrives with its host (sheet slide / PopIn / Modal fade).
- trigger: host mount.
- mechanism: none of its own.
- params: –
- class: panel-entrance (inherited)
- reduced-motion: –
- reach: `[data-testid="preview-parry"]`, `[data-testid="spire-preview-parry"]`, `[data-testid="inspector-parry-card"]`.
- smells: none (fine as is).

### G. Set-Parrying: the stage beats (catalog rows)

All four rows are drawn by existing stage pieces (fight-fx.md F:1-25) and HUD reactions (`AdventureRun.tsx:353-379`): there is no new drawing code. `shake: true` runs the foe flinch (F:28: translateX −8/8/−4/0 in 40/60/50/50 ms, scale 0.9→1 in 60/120 ms) from `onLand`, which `useFightFx.land` calls **even for quiet beats** (`useFightFx.ts:106-114`).

#### parry-warn-beat
- where: `src/adventure/fx/catalog.ts:159` (`parry_warn`); emitted `engine/parry.ts:143-146` when the wind-up enters the perfect window
- sees: "PARRY NOW!" pops from the foe in the buff colour; the foe portrait bumps; at the same moment the bar snaps to gold and starts throbbing.
- trigger: clock tick (`d._clock`, so `event.clock`); row is `ambient` (does not hold the clock; repeats within `AMBIENT_GAP_MS 900` are dropped, `useFightFx.ts:120-124`).
- mechanism: FxStage label (F:21) + anchor bump (F:26, `withTiming(1.28, 70 ms)` → `withSpring(1, {damping 9, stiffness 320, mass 0.6})`).
- params: `at = 0`, `land = 110 ms` (strike), life 110 + 1000 ms; sound `parryWarn` (rim + steel + bell one grid later) at `t0 = now + 12 ms` quantised up to the next 32nd (0-62.5 ms at 120 bpm).
- class: ui-feedback (alert)
- reduced-motion: Effects off → `fx-quiet-label` only; the foe bump is skipped (quiet); the bar pulse is not (see parry-bar-pulse).
- reach: `/dev/fx` → `[data-testid="fx-event-parry_warn"]`; in a fight from 1-5 (bar enters gold).
- smells: TWO-HEROES (label + bump + bar colour snap + bar throb on one frame, all saying "now"), sound may lead the bump (sound at ≈12-75 ms, bump at 110 ms).

#### parry-counter-beat
- where: `catalog.ts:160` (`parry`); emitted `engine/parry.ts:249` inside the Set (`run.ts:327`), before the lead `hit` (`run.ts:524`)
- sees: after the Set's throw, two rings grow around the fighter, a spark orb flies fighter → foe, fighter and foe bump, the foe flinches and winces, the fighter does its ecstatic jump (with the ≥3-streak full spin, S:fighter-react-ecstatic-spin), "PARRY! ×1.25" (×1.4 for a counter) pops.
- trigger: a Set during the wind-up.
- mechanism: FxStage aura (F:20), orb/comet (F:2), land ring (F:4), label (F:21); `onLand` foe shake (F:28); anchor bumps (F:26); avatar reactions.
- params: a chain step: `at = CHAIN_LEAD (2) × stride × grid` = 375 ms for a short chain at 120 bpm (stride 3), `land = at + 240` = 615 ms; life 240 + 1000 ms; sound `parry` (anvil + steel, bell one grid later) scheduled at `at` (slot 2×stride), i.e. ≈240 ms before the orb lands.
- class: impact/hit
- reduced-motion: Effects off → quiet label only, but `onLand` still shakes and squashes the foe portrait and triggers both avatar reactions (avatars obey OS reduced motion, not the Effects switch).
- reach: `/dev/fx` → `[data-testid="fx-event-parry"]`; in a fight: make a Set while the bar is red.
- smells: REDUCED-MOTION-GAP (foe shake with Effects off), sound leads picture (~240 ms, as F:1-2), TWO-HEROES (the Multiplier Ignition strip shows "PARRY ×1.25" at ≈85-170 ms, before this beat even launches; the fighter's 368° spin competes again), MAGIC-NUMBERS.

#### parry-perfect-beat
- where: `catalog.ts:161` (`perfect_parry`)
- sees: as parry-counter-beat plus a gold slanted band sweeping the board (F:19), the foe's critical wince; "PERFECT PARRY! STAGGER ×2" pops; the bar snaps to teal and throbs for 8 s.
- trigger: a Set inside the gold window.
- mechanism: as above + sweep `gold`.
- params: as above; sound `perfectParry` (anvil + crash + two bells + brass triad two grids later, music ducked to 0.45 for 0.35 s) at `at`.
- class: hero-reveal (the mechanic's best moment)
- reduced-motion: as parry-counter-beat (foe shake survives Effects off).
- reach: `/dev/fx` → `[data-testid="fx-event-perfect_parry"]`.
- smells: REDUCED-MOTION-GAP, EVERYTHING-AT-ONCE (aura, orb, sweep, two bumps, shake, two reactions, 4-word label on one beat), text hold too short for 4 words (label lingers ~1 s, `textHoldMs(4)` = 1.7 s), sound leads picture.

#### parry-foe-strike-beat
- where: `catalog.ts:162` (`foe_strike`); emitted `engine/parry.ts:150-152` when a wind-up runs out unparried
- sees: "ACORN TOSS!" in sour red; a dark orb flies foe → hearts; foe and hearts bump; the foe lunges (attack) **and** its portrait shakes and squashes as if hit; the fighter winces; a heart (or 6 s of clock) goes.
- trigger: clock tick (`event.clock`: does not hold the clock; the clock keeps running under it).
- mechanism: orb (F:2), label (F:21), bumps (F:26), `onLand` foe shake (F:28), avatar `attack` + `pain`.
- params: `at = 0`, `land = 240`; sound `foeStrike` (timpani, thud one grid later, brass swell) at ≈12-75 ms, ≈170-230 ms before the orb lands on the hearts.
- class: impact/hit
- reduced-motion: Effects off → quiet label, but the foe shake/squash and both avatar reactions still play.
- reach: `/dev/fx` → `[data-testid="fx-event-foe_strike"]`; in a fight, let the red bar run out.
- smells: REDUCED-MOTION-GAP, wrong meaning (the attacker gets the "was hit" shake on the same frame as its lunge: two moves on one creature), sound leads picture, NO-ANTICIPATION (the lunge's wind-up is the bar, not the foe).

### H. Multiplier Ignition

Mounted inside the board container (`AdventureRun.tsx:998`), absolute `top 8 / left 8 / right 8`, zIndex 245, `pointerEvents="none"`; shown when `plan.show = steps ≥ 2 || total ≥ 10` (`MultiplierIgnition.tsx:160`), i.e. most Sets once multipliers exist. Driven by `run.lastSetIgnition` (`engine/run.ts:570-578`), not by a run event: it starts at the React commit of the MATCH, the same frame as the cascade's `play()` (throw start).

#### ignition-panel-enter
- where: `MultiplierIgnition.tsx:237-241`, style `:284`, `:294-298`
- sees: a dark rounded strip fades in over the top row of cards with the first chip ("SET 9" / "BASE 12") already in it.
- trigger: new `ignition` with `plan.show`.
- mechanism: Reanimated `withTiming` on opacity.
- params: opacity 0 → 1 in 90 ms, default easing; first chip rendered at once (`setRevealed(1)`); strip border/background already in its heat-tier colour (`#F59E0B` / `#F97316 + rgba(42,20,12,.95)` / `#38BDF8 + rgba(18,22,48,.96)`) from frame 0; literals.
- class: panel-entrance
- reduced-motion: not shown at all with Effects off or OS reduced motion (`enabled={effects && showDamageHud}`).
- reach: `/dev/adventure?save=before:1-7&intro=false` → fight → any Set worth ≥ 10, or `/dev/spire?start=true` → fight; `[data-testid="multiplier-ignition"]`. Not in `/dev/fx`.
- smells: FADE-ONLY, NO-MOTION (the panel's place: over the board the player is scanning), MAGIC-NUMBERS.

#### ignition-chip-reveal
- where: `MultiplierIgnition.tsx:243-252`, render `:307-318`
- sees: chips "SURGE ×5", "RAINBOW ×2", "PARRY ×1.25", "POWER ×3.2"… appear one by one left to right; each just appears, and the centred row re-flows so the earlier chips jump left.
- trigger: JS `setTimeout` per chip.
- mechanism: `setTimeout` → `setRevealed(i+1)` → re-render (no tween); `band.cue('multStep', { slot: idx, amount: heatTier })`.
- params: chip i at `i × STEP_MS` = i × 85 ms (up to 6 chips: 0-425 ms); chip label 9 px, value 11 px; **sound**: `band.cue` treats `slot` as a time offset (`band.ts:404-413`: `t = t0 + slot × g`), so chip i's sound plays at `i×85 ms + 12 ms + quantise(0..g) + i×g` ⇒ i × 62.5 ms late at 120 bpm (≈ +310 ms on chip 5, worse at slower tempos); the cue's pitch also climbs with `slot`. Not scaled by `fxMs`/`fxClock.slow`.
- class: number-pop
- reduced-motion: not shown (as above).
- reach: as ignition-panel-enter; Set with surge/rainbow/parry for several chips.
- smells: NO-MOTION (pop-in), TIMER-DRIVEN, MAGIC-NUMBERS (85), text moves while being read (re-flow), sound late by i×grid (sync defect), EVERYTHING-AT-ONCE inverted (payoff before build: the lead number already lands on the foe at 240 ms, F:6).

#### ignition-total-slam
- where: `MultiplierIgnition.tsx:254-264`, render `:320-345`
- sees: the total badge ("47") slams in at the end of the strip, big then settling, coloured by heat (yellow / amber / orange / purple).
- trigger: `setTimeout` at `slamAt`.
- mechanism: `setTimeout` → mount + `withSequence(withTiming, withTiming)` on scale; `band.cue('multSlam', { amount: heatTier })`.
- params: `slamAt = count × 85 + 40` ms (125-550 ms); scale starts 0.75 (set at `:241`) → 1.24 in 100 ms `Easing.out(Easing.cubic)` → 1 in 130 ms `Easing.inOut(Easing.quad)`; no opacity ramp (pops in at full opacity); 24 % overshoot; sound quantised 0..g after the slam (kick or timpani + sub-drop + brass at tier ≥ 2, crash + bell run-up at tier 3).
- class: number-pop
- reduced-motion: not shown.
- reach: as above; `[data-testid="multiplier-ignition-total"]`.
- smells: TWO-HEROES (the same number already landed on the foe at 240 ms; a 2-chip slam at 210 ms lands one frame-pair before it), BANNED-DEFAULT ("scale-pulse as the answer to every event", on most Sets), MAGIC-NUMBERS, overshoot at the top of the celebration band on something seen constantly, TIMER-DRIVEN.

#### ignition-flame-tongues
- where: `MultiplierIgnition.tsx:172-215` (FlameTongue), used `:322-328` (heat tier ≥ 2 after the slam)
- sees: three little flame shapes flicker above the total badge (orange/yellow at ≥ 60 damage; cyan/purple "plasma" at ≥ 200).
- trigger: `active = slammed && heatTier ≥ 2 && appActive`.
- mechanism: `setTimeout(delay)` then Reanimated `withRepeat(withSequence(withTiming, withTiming), -1)`; `cancelAnimation` on stop/unmount.
- params: up 190 ms `Easing.out(Easing.quad)`, down 210 ms `Easing.in(Easing.quad)` (400 ms period); opacity 0.72 ↔ 1, translateY 0 ↔ −5, scaleY 0.85 ↔ 1.3, fixed rotate ±8°; start delays 0 / 70 / 130 ms (same period, so they keep that fixed offset); runs until the strip unmounts (≈1.45 s); 11×14 px.
- class: ambient-loop
- reduced-motion: not shown.
- reach: as above with a Set ≥ 60 (Spire act 2+, or Surge Sets).
- smells: BANNED-DEFAULT (glow / decorative fire on a number), TIMER-DRIVEN (start offsets by `setTimeout`, not `withDelay`), MAGIC-NUMBERS. PERF: gated on `useAppActive` and cancelled (passes the guardrails).

#### ignition-panel-exit
- where: `MultiplierIgnition.tsx:266-276`; retrigger `:229-236`
- sees: after holding about 1.2 s, the strip fades out and is gone; a new Set while it is up resets it to one chip in one frame.
- trigger: `setTimeout` at `slamAt + LINGER_MS − 220` (fade) and `slamAt + LINGER_MS` (unmount); new ignition clears all timers.
- mechanism: Reanimated `withTiming` on opacity + JS unmount.
- params: `LINGER_MS = 1450`; fade 1 → 0 in 220 ms default easing; visible total `count × 85 + 40 + 1450` ≈ 1.6-2.0 s over the top card row; on retrigger the old chips vanish instantly and `withTiming(1, 90)` restarts from the current opacity. Also re-fires the last ignition whenever `enabled` flips (Effects toggled in pause) because the effect depends on `enabled`.
- class: exit
- reduced-motion: not shown.
- reach: as above.
- smells: FADE-ONLY, EXIT-SLOWER-THAN-ENTER (220 vs 90), DEAD-TIME (≈1.2 s static hold covering cards the player needs for the next Set), TIMER-DRIVEN.

### I. Kill-Cam

`KillCamOverlay` is mounted over the whole fight (`AdventureRun.tsx:1036`), zIndex 255 (above FxStage 240 and the Ignition 245, below MegaFlash 400), `pointerEvents="none"`. It plays when `run.lastSetIgnition.lethal` (set when the Set leaves the foe at ≤ 0 HP, `run.ts:575`, `:1035-1037`): **every knockout, every wave**, not only bosses / elites / final waves as its header comment says (only the headline differs: "PERFECT PARRY K.O.!", "BOSS SHATTERED!" for `isBoss || branchOf`, else "FINISHING BLOW!"). Starts at the MATCH commit (cascade time 0), on its own JS timers, unscaled by `fxMs` / `fxClock.slow`, does not hold the clock, not in `/dev/fx`. Effect deps include `anchors`, `stageSize.w/h` and `enabled`: a stage resize or an Effects toggle replays it.

#### killcam-dim
- where: `KillCamOverlay.tsx:107-110`, style `:141`, `:152`, `:179-182`
- sees: the whole fight screen darkens (a flat near-black wash, no spotlight) and lifts again, covering the Set's throw, burst and number.
- trigger: lethal ignition.
- mechanism: Reanimated `withSequence(withTiming, withDelay(withTiming))` on opacity.
- params: 0 → 0.45 in 140 ms (default easing), hold 240 ms, → 0 in 380 ms (default easing): ends at 760 ms; colour `#0B0A0A`; component unmounts at 880 ms (`setTimeout`, `:129-133`).
- class: hero-reveal (staging)
- reduced-motion: off with Effects off / OS reduced motion (`enabled`), off in practice.
- reach: knock out any foe with effects on; `[data-testid="kill-cam-overlay"]`. Fast route: `/dev/adventure?save=before:1-2&intro=false` (low HP foe) or `/dev/spire?start=true` skirmish.
- smells: EXIT-SLOWER-THAN-ENTER (380 vs 140), FADE-ONLY, staging conflict (dims the Set's own payoff, F:3/F:6, which lands at 240 ms under the darkest part), MAGIC-NUMBERS.

#### killcam-banner
- where: `KillCamOverlay.tsx:111-115`, style `:142-145`, render `:154-158`, `:187-210`
- sees: a yellow tilted tag "FINISHING BLOW!" slams in at 34 % of the screen height, settles, shrinks a little and blinks out.
- trigger: lethal ignition.
- mechanism: Reanimated `withSequence` on scale; opacity is **binary**: `dim > 0.02 ? 1 : 0`.
- params: scale 0.6 → 1.12 in 150 ms `Easing.out(Easing.cubic)` → 1 in 150 ms (default) → hold 300 ms → 0.92 in 180 ms (default) (ends 780 ms); rotate −3° fixed; 20 px / weight 900 text; visible from the first frame where dim > 0.02 (≈1 frame) until dim falls under 0.02 (≈750 ms): it vanishes in one frame mid-shrink; readable still time ≈ 300 ms for 2-3 words (`textHoldMs(2)` = 1.1 s).
- class: hero-reveal
- reduced-motion: off with Effects off / reduced motion.
- reach: as killcam-dim.
- smells: TWO-HEROES (a second knockout banner: the catalog's "K.O.!" banner, F:24, plays on the `foe_defeated` chain step at ≈375-445 ms, centred on the board, overlapping this one), NO-EXIT (cut out at ~750 ms), BANNED-DEFAULT ("a second version of an effect that already exists"), text unreadable (too short), MAGIC-NUMBERS.

#### killcam-flash
- where: `KillCamOverlay.tsx:116-122`, style `:146`, `:153`, `:183-186`
- sees: a full-screen near-white flash at about 0.3 s.
- trigger: lethal ignition, `withDelay(290)`.
- mechanism: Reanimated `withDelay(withSequence(withTiming, withTiming))` on opacity.
- params: 0 → 0.75 in 55 ms (default easing) → 0 in 240 ms `Easing.out(Easing.quad)`; colour `#FFFDF5`; peaks at 345 ms. On a lethal MEGA hit (≥ 50) the catalog's MegaFlash (F:30, 0.85 white, zIndex 400) fires at 240 ms: two white flashes 50 ms apart.
- class: impact/hit
- reduced-motion: off with Effects off / reduced motion.
- reach: as killcam-dim.
- smells: BANNED-DEFAULT (white full-screen flash), TWO-HEROES with MegaFlash, MAGIC-NUMBERS. Photosensitivity: no flash rate limit across the two flash sources.

#### killcam-star-shards
- where: `KillCamOverlay.tsx:38-74` (StarShard), placed `:159-169`, origin `:92-95`
- sees: twelve coloured ★ glyphs burst out of the foe in a ring, growing then shrinking, spinning, drifting slightly up, and fading.
- trigger: lethal ignition.
- mechanism: Reanimated `withDelay(withTiming)` per shard, one progress value.
- params: delay `290 + (idx % 4) × 20` ms (290-350); 520 ms `Easing.out(Easing.cubic)`; angles every 30°; distance `72 + (idx % 3) × 30` px (72/102/132); translate `origin + (dx, dy − 28)·t` (a straight line, the −28 px "lift" is linear in t, no arc); scale `0.4 + sin(πt)·0.9` (0.4 → 1.3 → 0.4); rotate `220·t`°; opacity pops 0 → 1 at t > 0, holds to t 0.72, then fades over the last 28 %; colours from 6 literals (`actionYellow`, `#FDE047`, `#FB923C`, `#38BDF8`, `#C084FC`); 18 px glyphs with ink text-shadow; origin falls back to `(0.72·w, min(130, 0.2·h))` when the foe anchor is missing. Ends ≈ 870 ms.
- class: impact/hit (particles)
- reduced-motion: off with Effects off / reduced motion.
- reach: as killcam-dim.
- smells: EVERYTHING-AT-ONCE (12 shards on 4 delay buckets of 20 ms, same curve), straight radial flights (no arc), pops in at full opacity, BANNED-DEFAULT borderline (particles have a cause here, but they duplicate the board burst on the foe, F:8, and the K.O. twinkles), MAGIC-NUMBERS.

## 2. Screen flow of the Spire

`SpireMode` (`src/spire/components/SpireMode.tsx`) is a conditional-render router; nothing animates between screens. The header (`SpireHeader`) stays mounted across map / preview / reward / shop / campfire / event / treasure and never animates.

| Screen / overlay | Enter | Inside | Leave |
|---|---|---|---|
| Main menu → Spire | cut (menu-spire-enter-cut); the button has no press state (menu-spire-button-press) | – | cut back to the menu |
| Setup (`SpireSetup`) | cut; resume card `PopIn` if a run exists | fighter select (colour swap + avatar starts), steppers (instant) | cut to map (spire-setup-to-map-cut) |
| Map (`SpireMap` + header) | cut; autoscroll jump (`animated: false`); no PopIn | reachable nodes `Bob` 4 px in phase (ignores reduced motion) | node press dims, cut to room / preview |
| Encounter preview (`SpireEncounterPreview`) | card `PopIn` + foe `entrance` acting | static | FIGHT! cut into the fight (fight opening F:41 plays) |
| Fight (`AdventureRun` with `spireContext`) | the fight's own opening | Adventure fight, plus parry bar, Ignition, Kill-Cam; Spire floor strip `run-spire-bar` replaces the ★★★ goal strip (static) | 900 ms still (F:45), cut to reward / defeat; pause "Retreat to Briefing" cuts to preview |
| Reward (`SpireRewardScreen`) | banner `PopIn`, drafts static | claims remove whole sections in one frame; reroll swaps; replay Modal slides | Continue: cut to map, next act, or victory |
| Shop (`SpireShop`) | header card `PopIn` | purchases/heal/reroll/forge toggle instant | cut to map |
| Campfire (`SpireCampfire`) | hero `PopIn`, fighter idle loop | sub-mode lists swap instantly; outcome card `PopIn` | cut to map |
| Event (`SpireEvent`) | story `PopIn` | option → options cut, outcome `PopIn`; picks instant | cut to map (or to preview for an event fight) |
| Treasure (`SpireTreasure`) | hero `PopIn` | claim → choices cut, claimed card `PopIn` | cut to map |
| Build modal (`SpireBuildModal`) | Modal fade 250 ms + `PopIn` | weapon select instant | **instant** (unmounted, no fade-out) |
| Fight replay (from reward / end) | Modal slide (A:replay-modal-slide) | as A: entries | Modal slide out |
| Victory / defeat (`SpireEndScreen`) | hero `PopIn` (180 ms) + fighter mood loop; no count-ups | static | cut to setup / Endless map / menu |

## 3. How the new fight pieces sit in the cascade

**Timeline of one Set** (tap → `GameBoard` waits 200 ms → `MATCH` → React commit = t 0; 120 bpm, grid 62.5 ms, short chain stride 3):

| t (ms) | Cascade (`fx/script.ts`, `useFightFx.ts`) | New pieces (own timers) | Sound |
|---|---|---|---|
| 0 | throw starts (F:1) | Ignition panel fades in (90 ms) with chip 0; Kill-Cam dim + banner start (if lethal) | payout at t0 ≈ 12-75 ms; `killCamRiser` quantised 12-75 ms |
| 85 · 170 · 255 … | – | chip 1, 2, 3… appear | `multStep` i at i×85 + i×62.5 + 12-75 ms (late by i×grid) |
| 125-550 | – | total slams at `count×85+40` | `multSlam` + 12-75 ms |
| 240 | lead burst, number, HP drop, foe flinch, screen shake / MegaFlash by tier (F:3-6, F:28-30) | under the Kill-Cam dim (0.45) if lethal | – |
| 290-345 | – | Kill-Cam white flash peaks 345; shards start 290-350 | `killCamShatter` at 290 + 12-75 ms |
| 375 (+240 land) | first chain step: `parry` / `perfect_parry` (emitted before the hit, takes slot 2), else `foe_defeated` K.O. banner (F:24) | – | chain cues at the step's launch, ≈240 ms before its orb lands |
| 420 | clock hold ends for a plain Set (`land 240 + settle 180`) | Ignition still up | – |
| 760-880 | – | Kill-Cam dim gone 760, unmount 880 | – |
| ≈1.6-2.0 s | – | Ignition fades (220 ms) and unmounts | – |

- **Clock.** Only the cascade holds the clock (`fx.busy`). Kill-Cam and Ignition never hold it: on a long Ignition (6 chips, slam at 550 ms) the clock is already running again at 420 ms while the equation is still assembling. `parry` / `perfect_parry` are chain beats of the player's Set, so they extend the hold (to about 615 + 180 = 795 ms). `parry_warn` (ambient + clock) and `foe_strike` (clock) hold nothing and play over a running clock, as Claude.md asks.
- **Catalog rule ("every run event has a look").** The four new `RunEventType`s have rows in `EVENT_FX` (`catalog.ts:159-162`) and in `EVENT_CUE` (`fightAudio.ts:97-100`), so the rule holds for events. Kill-Cam and Ignition are not events at all: they read `run.lastSetIgnition`, so they bypass `scriptFor`, `fxMs`, `fxClock.slow`, the reduced/quiet path and `/dev/fx`, and they cannot be ordered against the beats (they start at t 0 whatever the chain is).
- **"Never animate fight feedback inside AdventureRun.tsx."** Respected for the new pieces in letter: their animations live in `fx/` and `components/ParryIntentBar.tsx`; `AdventureRun` only mounts them. But the new parry rows rely on the in-file `onLand` shake (`AdventureRun.tsx:355-358`, pre-existing, F:28), which also runs for quiet beats.
- **"The same effect looks the same whoever caused it."** Broken by the Kill-Cam: a second knockout banner (vs F:24 "K.O.!"), a second white full-screen flash (vs F:30 MegaFlash), a second burst of debris from the foe (vs F:8 board burst + K.O. sparkles). The Ignition total is a second copy of the lead number (F:6). `foe_strike` uses the "foe was hit" shake on the attacker.
- **Sound vs picture.** Cascade rows (`parry*`, `foe_strike`, `parry_warn`) inherit the known lead of ≈100-240 ms (cue at the beat's launch, picture at land; see fight-fx §1). Ignition `multStep` is the opposite and worse: double-offset (`setTimeout(i×85)` **and** `slot: i` → `+ i×grid`), so chip sounds fall progressively behind their chips (≈ +62 ms per chip at 120 bpm). `multSlam`, `killCamRiser`, `killCamShatter` are scheduled from JS timers and then quantised to the next 32nd: 12 ms to one grid late, which is within "on the frame or after" for the riser and shatter but can exceed one frame. On a lethal Set the payout, riser, chain cues, `foeDefeated` and Ignition steps all land inside ~400 ms (two cues duck the music: `perfectParry` 0.45 for 0.35 s, `killCamRiser` 0.55 for 0.38 s).

## 4. Proposed ledger rows

### Fight (new: parry, ignition, kill-cam)

| Surface | What the player sees | Seen | Pri | Top problems | Shot | Status | Scores before → after | Entries |
|---|---|---|---|---|---|---|---|---|
| parry-bar-telegraph | Pill under the HUD fills red, snaps gold and throbs, "PARRY NOW!", teal when staggered | constant | P1 | fill animates width in 4 Hz steps; phase colours snap; throb ignores reduced motion and Effects off; scales its own text | — | todo | — | N:parry-bar-mount, N:parry-bar-fill, N:parry-bar-phase-swap, N:parry-bar-pulse, N:parry-bar-stall-badge, N:parry-bar-press, N:parry-warn-beat |
| ignition-equation | Equation chips pop over the top card row, total slams, flames at high heat | constant | P1 | chips pop with no motion and re-flow; chip sounds late by i×grid (double offset); total slams after the foe already shows it; covers the board ~1.8 s; not in /dev/fx | — | todo | — | N:ignition-panel-enter, N:ignition-chip-reveal, N:ignition-total-slam, N:ignition-flame-tongues, N:ignition-panel-exit |
| killcam-finisher | Screen dims, "FINISHING BLOW!" tag, white flash, star shards from the foe | often | P1 | white full-screen flash (banned; stacks with MegaFlash); second K.O. banner fights F:24; dims the Set's own hit; banner blinks out unreadable; plays on every wave's KO | — | todo | — | N:killcam-dim, N:killcam-banner, N:killcam-flash, N:killcam-star-shards |
| parry-landed | After the throw: rings round the fighter, spark to the foe, flinch, "PARRY!" / gold sweep "PERFECT PARRY!" | often | P2 | foe shake survives Effects off; sound ~240 ms before the orb lands; Ignition announces the parry before it launches; perfect beat piles everything on one frame | — | todo | — | N:parry-counter-beat, N:parry-perfect-beat |
| foe-strike | Unparried attack: dark orb to the hearts, foe lunges and shakes, fighter winces | often | P2 | attacker gets the "was hit" shake on its lunge frame; shake survives Effects off; sound leads the orb | — | todo | — | N:parry-foe-strike-beat |

### Starfall Spire

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

## 5. Top 10 candidates

1. **killcam-flash / killcam-finisher**: white full-screen flash on every knockout, stacked with MegaFlash; dims the Set's own hit.
2. **ignition-chip-reveal**: chips pop with no motion and re-flow, and their sounds drift i×grid late (double offset in `band.cue` slot).
3. **ignition-total-slam**: a second copy of the lead number, slammed after the foe already showed it; 24 % overshoot on most Sets.
4. **parry-bar-pulse**: 2.3 Hz text-scaling throb for up to 8 s that ignores reduced motion and Effects off.
5. **parry-bar-fill / phase-swap**: width stepped at 4 Hz and colour snaps for the mechanic's key moment (entering the gold window).
6. **killcam-banner**: second knockout banner over F:24's "K.O.!", visible ~300 ms still, blinks out mid-shrink.
7. **parry-foe-strike-beat**: attacker shakes as if hit on its lunge frame; foe shake still plays with Effects off (also parry rows).
8. **spire-reward-draft-claim**: picking a reward makes the section vanish and the list jump; no "weapon get" moment.
9. **spire-screen-cuts**: the whole Spire router cuts; no sense of climbing a floor or opening an act.
10. **spire-map-node-bob**: always-on bob that ignores reduced motion, all nodes in phase.
