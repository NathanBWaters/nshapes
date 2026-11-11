# Adventure Mode (v2) — Design & Editing Guide

Adventure Mode is a map-based campaign in the style of Angry Birds and Bloons. It has the meta-progression of Vampire Survivors and keeps the Brotato + Set run feel. **The game is the tutorial.** Every level teaches exactly one new thing.

## The loop

```
Map ─tap foe─▶ Preview (foe, skulls, star goals + rewards, fighter pick)
     ▲                 │
     │          NEW mechanic? ─▶ Intro card (demo cards / icons)
     │                 ▼
     │               Fight (one foe, or waves) ─▶ Results (stars pop, coins bank, unlocks)
     │                                               │
     └──────────────── Camp (level fighters · Workshop upgrades · Armory) ◀┘
```

### Stars (every level)
| Stars | How |
|---|---|
| ★ | **Survive**: use up the moves (early levels) or outlast the clock, with hearts left |
| ★★ | **Knock out** the foe (every wave) |
| ★★★ | Knock out **and** meet the level's challenge (no mistakes, rainbows, the enemy's own defeat condition…) |

Each star's reward is granted **once**, the first time you earn it: ★ coins, ★★ usually a weapon or fighter unlock, ★★★ a big payout or a rare weapon. ★★★ is not expected on a first visit. You come back with a levelled fighter or a counter-pick (the preview marks fighters that are **STRONG** for a level).

### Money (Vampire Survivors style)
Every matched card drops coins; golden cards drop +3. Harder levels have a higher `coinMultiplier`. Coins **bank even when you lose**. Spend them:
- **Mid-run** in the shop between waves (taught at 3-3). Weapons you buy there last for that level only.
- **At Camp**, permanently: fighter levels (60 → 1900 coins per level, up to Lv 10) and Workshop upgrades (250 → 2600 per tier). These are priced so replaying levels for coins is worthwhile.

### Fighters bring new rules
Each fighter adds one ability that no weapon provides (`data/abilities.ts`, implemented in `engine/run.ts`). Abilities switch on at 1-4, together with gear.

| Fighter | Ability | Type | What it does | Counters |
|---|---|---|---|---|
| Orange Tabby | Nine Lives | passive | Once per fight, a knockout leaves you on 1 heart | glass cannon, final boss |
| Sly Fox | Combo | passive | Sets < 5s apart: +1 dmg per step (max +4); a mistake breaks it | regen, armor |
| Badger | Grudge | passive | Each mistake stores +3 dmg (max 3) for your next Set | punishers, near-miss levels |
| Emperor Penguin | Deep Freeze | active (4 Sets) | Clock and foe stop for 6s | bombs, countdowns, time thieves, fast clocks |
| Corgi | Zoomies | active (3 Sets) | Re-deal the whole board; clears duds and hidden cards | duds, burrowers, owls |
| Pelican | Big Scoop | active (4 Sets) | Plays a Set for you | trait shifts, 5-trait levels |

The preview's **STRONG** tag (`recommended`) points players at these counters. That's the "come back with the right fighter" loop.

### Unlocks
- **Weapons**: the Armory starts with only your fighter's gear. Star rewards add weapons. Level-up picks and shops only offer Armory weapons.
- **Fighters**: unlocked by ★★ on bosses and key levels. Each has a signature mechanic shown on a "New fighter" card.
- **Regions**: star-gated (Woods 12★, Canyon 28★, Peaks 46★), so the player needs some ★★ and ★★★ clears, not just ★.

## Mechanic order (one per level)

| Lvl | Teaches | Kind |
|---|---|---|
| 1-1 | The Set (2 traits, 6 moves, infinite hearts) | rule |
| 1-2 | Hearts | feature |
| 1-3 | Number trait | rule |
| 1-4 | Gear (fighter weapons switch on) | feature |
| 1-5 | Rainbow Strike (all-different = 2× damage) | feature |
| 1-6 | Coins & Camp (golden cards) | feature |
| 1-7 | The clock (survive = ★) | rule |
| 1-8 | **Boss** Iron Shell: armored card | threat |
| 2-1…2-8 | Hints, duds, face-down, graces, in-run level-ups, countdown, shuffle, **boss** bombs | |
| 3-1…3-8 | Shading trait, waves, shop, burrowing, trait shifts, time theft, regeneration, **boss** inactivity | |
| 4-1…4-5 | Background trait, fast clock, glass cannon, punishment, **final boss** Hydra | |

**Feature** mechanics stay on once taught (`getFeaturesForLevel`). **Threat** mechanics come from the level's foe (the existing `src/utils/enemies` roster, reused as-is). The foe's own defeat condition often becomes the ★★★ challenge.

## Code map

```
src/adventure/
  types.ts              LevelDef, MechanicDef, FighterDef, RunState, AdventureSave
  data/levels.ts        ← THE campaign table (edit here)
  data/mechanics.ts     intro cards, demos, in-run coach marks
  data/fighters.ts      fighter kits + Lv1–10 loadout curve + level costs
  data/upgrades.ts      Workshop upgrades
  data/biomes.ts        regions, star gates, colors, music arrangement
  progress.ts           pure rules: unlocks, rewards, purchases
  save.ts               MMKV persistence (key: adventure_v2_save)
  engine/run.ts         pure reducer for one fight (seeded RNG)
  engine/challenges.ts  ★★★ text / progress / checks
  engine/sets.ts        O(n²) Set finder
  engine/bot.ts         headless bot that plays through the reducer
  components/           Map, Preview, MechanicIntro, Run, Results, Camp, FieldGuide
  AdventureMode.tsx     screen router
src/audio/              Game Boy–style synth (no audio files)
```

The fight UI reuses the shared `GameBoard` and `Card`, so weapon effects, fire, lasers and auto-hints behave the same as in Free Play.

### Making big changes
- **Add a level**: add an entry to `RAW_LEVELS` with a new `introduces` mechanic. If the mechanic is new, add it to `MECHANICS`. Run the balance test.
- **Add a mechanic that's a foe effect**: compose a new enemy from `src/utils/enemyEffects.ts`, register it, then reference it with `foes: [{ enemy: 'Name', hp }]`.
- **Add a feature flag**: add it to `FeatureFlag`, set `enables` on its mechanic, and read it from `run.features` in the reducer/HUD.
- **Rebalance**: edit HP, timers and moves, then run
  `ADVENTURE_BALANCE_REPORT=1 npx jest __tests__/adventureBalance.test.ts`.
  Novice, average and expert bots play every level through the real reducer and print star distributions. Following poteto, bots tune difficulty against target survival rates.

## Audio (poteto's approach)
Every sound is synthesized live by `src/audio/chip.ts`, a Game Boy–style chip: two pulse voices with selectable duty, a 4-bit wavetable bass and LFSR noise drums. **Songs are text** in `src/audio/songs.ts`. One theme melody plays under several arrangements (map, each region, boss). Switching arrangement waits for the next bar line, so moving from the map into a fight sounds like the song continuing rather than a hard cut. On the web, `playSound()` routes to the chip. Native keeps the bundled samples.

Debug in the browser console (dev builds): `__nshapesAudio.sfx('rainbow')`, `__nshapesAudio.music.play('boss')`.

**Verifying without speakers:** `renderOffline({ plan: [{ arrangement: 'map', bars: 4 }, { arrangement: 'boss', bars: 4 }], sfxReel: ['coin', 'hit'] })` renders through an `OfflineAudioContext` into an `AudioBuffer`. Measure peak/RMS, run Goertzel pitch checks, or encode a WAV to listen to.

## Dev
- `/dev/adventure?save=maxed`: everything unlocked, 50k coins (this save gets persisted once you play)
- `/dev/adventure?save=fresh`: brand-new save
- `/dev/adventure?autoplay=true`: board plays itself
