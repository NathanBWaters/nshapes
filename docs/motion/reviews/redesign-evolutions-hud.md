# redesign-evolutions-hud

Combat, Per-Weapon Evolution (64×3 = 192) & 200-Bounty Redesign — Motion Capture & Frame Review (`v0.1.188+`, Wave 4E).

All shots captured at `390×844` (`16 ms`/frame, deterministic virtual clock, random seed 7) on `http://localhost:8081`:
- **Live Fight HUD (`weapons-hud.mjs`):** `belt-evo-countdown` (`r1`, `reduced`), `belt-evo-anticipation` (`r1`).
- **Camp Armory & 200-Bounty Board (`menu-camp.mjs`):** `armory-evo-picker` (`r1`), `bounty-board-200` (`r1`).
- **Milestone Unlock (`results.mjs`):** `unlock-slot-expand` (`r1`).
- **Effects Studio (`fx.mjs`):** `fx-evolution` (`r1`), `fx-evolution-2` (`r1`), `fx-evolution-banner` (`r1`), `fx-evo-almost` (`r1`).

## Scores (Response / Readability / Motion / Staging / Rhythm / Identity / Sync)

| Surface | Shot | Score (`r1`) | Hints | Key frame-level observations |
|---|---|---:|---|---|
| `belt-evo-anticipation` (Almost-Ready Pop + Amber Rim Pulse) | `belt-evo-anticipation` | **`9/9/9/9/9/9/9`** | **0 hints** | `f0` response; `#belt-evo-anticipation-blast-powder` `SCALE.pop` (`×1→×1.38→×0.98`, `26f/416ms`, peak `+5f`) + bespoke explosive spark burst + `EVO +1` floater; `evoCharge` `f1.7`, `evoAlmost` + `sting:blast-powder` `f14.7`. |
| `armory-evo-picker` (1-of-3 Timed Evolution Picker) | `armory-evo-picker` | **`9/9/9/9/9/9/—`** | **0 hints** | `f0` response; selected `Napalm Payload` card pops via `SPRING.snappy` (`×1→×1.09→×1.01`, `19f/304ms`, peak `+5f`); `ACTIVE` pill & Synergy chips swap with zero layout shift. |
| `unlock-slot-expand` (W1 Boss `1-10` 3→4 Weapon Slot Strip) | `unlock-slot-expand` | **`9/9/9/9/9/9/9`** | **0 hints** | `f1` (`16ms`) response; `?` coin Y-flip (`f1–f17`) → Belt icon reveal (`f20–f29`, `weaponGet` `f26.3`) → `SlotExpansionStrip` 4th `NEW!` golden slot burst (`×1→×2.78→×2.22`, `f24–f67`) + Orange Tabby cheer card. |
| `belt-evo-countdown` (Active Golden Countdown Drain) | `belt-evo-countdown` (`r1`, `reduced`) | **`8/9/8/9/8/9/—`** | `SLOW-RESPONSE` (passive no-op trigger) | Golden `23s → 22s` digit tick (`f41` in `r1`, `f16` in `reduced`) + smooth bottom progress drain bar with zero jitter; `reduced` mode suppresses glow/shimmer cleanly while keeping countdown readable. |
| `bounty-board-200` (200-Bounty Filter Switching) | `bounty-board-200` | **`9/9/8/9/8/9/—`** | `DEAD-STRETCH` (dwell between 2 taps) | `f0` instant tab switch `OPEN (60) → EVOS (53)` and `f24` switch `→ BY WEAPON (18)` on virtualized `FlatList`; `ON BELT ✓`, `CUMULATIVE`/`1 FIGHT`, and `○○○ 0/3` rows stay crisp with zero flicker. |
| `fx-evolution` (Single-Weapon Awakening Cut-In) | `fx-evolution` | **`9/9/8/9/8/9/—`** | `FADE-ONLY` (backdrop), `LINEAR` (speedline) | Dramatic angled black/gold cut-in opens `f24–f39`, single weapon (`Blast Powder`) + golden `Cluster Charge` medallion slam in (`×1→×6.74→×4.63`) with stat pills (`3 explosions`, `15s ACTIVE`, `+8 BASE`, `+0.2× MULT`) and exits cleanly on `f100` tap (`f100–f107`). |
| `fx-evolution-2` (Queued 2-Weapon Awakening Cut-Ins) | `fx-evolution-2` | **`9/9/8/8/8/9/—`** | `POP-OUT` at `f100` handoff | `1/2` `Cluster Charge (Blast Powder)` (`TAP FOR NEXT (2/2)`) swaps directly on `f100` tap into `2/2` `Sweep Beam (Prismatic Ray)` (`f107–f119`) and exits cleanly `f200–f215`. Follow-up polish note below for `f100` handoff exit. |
| `fx-evolution-banner` (Repeat Coalesced Non-Blocking Banner) | `fx-evolution-banner` | **`9/9/7/9/8/9/—`** | `FADE-ONLY` (`#evolution-banner` `f0`) | `2× EVOLUTION ACTIVE · 16s — Cluster Charge + Sweep Beam` mounts cleanly `f0→f11` (`176ms`) above the 12-card board without blocking play while Blast Powder's 4-stage explosion plays below (`f3–f19`). |
| `fx-evo-almost` (Studio Almost-Ready Anticipation) | `fx-evo-almost` | **`9/9/8/9/8/9/—`** | `DEAD-STRETCH` (`f23–f35` hold) | `f0` response; Blast Powder jumps `2/3 → 1!` with spark burst, `ALMOST READY!` floater (`f6–f46`), and continuous opacity-only amber rim pulse (`0.22→0.50` / `0.71→0.28`) across two charging slots. |

## Frame-by-frame evidence

### 1. Live Fight HUD: `belt-evo-anticipation` & `belt-evo-countdown` (`r1` + `reduced`)
- **`belt-evo-anticipation` (`r1`, 60f / 960ms):**
  - `pre-1`: 3-weapon belt (`Blast Powder 1/3`, `Flint Spark 1/4`, `Mending Charm 1!` already glowing amber).
  - `f0–f11` (`0–176ms`): Tapping `training-lab-step-evo` immediately pops `Blast Powder` from `1/3 → 1!` (`#belt-evo-anticipation-blast-powder` `×1→×1.38→×0.98`, peak `+5f`) with explosive spark bursts (`#weapon-tap-burst` `×2.77`, `#weapon-burst-secondary-explosive` `×2.25`) while `Mending Charm` simultaneously ignites into golden `26s` active countdown.
  - `f27–f38`: `Flint Spark` advances `1/4 → 2/4` with crisp `EVO +1` floater (`f32–f37`) and micro-spark.
  - **Audio sync:** `evoCharge` `f1.7 / f27.7 / f40.8`, `evoAlmost` + `sting:blast-powder` `f14.7`, `sting:flint-spark` `f40.8`, `sting:mending-charm` `f53.8`. Zero hints.
- **`belt-evo-countdown` (`r1` & `reduced`, 48f / 768ms):**
  - Passive continuous-drain observation (`trigger: () => {}`) on an active `Blast Powder` (`Cluster Charge`, golden border + purple bottom drain rail).
  - Both `r1` (`23s → 22s` on `f41`) and `reduced` (`23s → 22s` on `f16`) maintain crisp, non-jittering numerals and bottom progress bar with zero layout shift; `reduced` cleanly drops ambient rim shimmer (`0` movers tracked).

### 2. Camp Armory & 200-Bounty Board: `armory-evo-picker` & `bounty-board-200`
- **`armory-evo-picker` (`r1`, 36f / 576ms):**
  - `f0` instant tap feedback on `Napalm Payload (BRIDGE, 28s)`: card executes a clean `SPRING.snappy` scale pulse (`×1→×1.09→×1.01`, peak `+5f`, settled by `f19 / 304ms`) as the yellow `ACTIVE` badge and heavy ink border transfer from `Cluster Charge` without shifting `Supernova Core` below. Zero hints.
- **`bounty-board-200` (`r1`, 52f / 832ms):**
  - `pre-1`: `OPEN (60)` tab with pinned `TRY NEXT & ALMOST DONE` Hero Rail (`Bright Idea`, `First Bounce`).
  - `f0`: Tap `EVOS (53)` — immediate list swap to Evolution-unlock cards (`First Spectrum`, `Gentle Mend`, `Keep the Beat`, `Chain Detonation`) with `ON BELT ✓`, `CUMULATIVE`/`1 FIGHT`, and purple reward pills.
  - `f24`: Tap `BY WEAPON (18)` — immediate accordion swap showing `Blast Powder`, `Mending Charm`, `Rainbow Charm`, `War Drum` (`ON BELT ✓`), and unequipped weapons (`Catalyst Prism`, `Chaos Shard`, etc.) with 1-tap `EQUIP` and `○○○ 0/3` progress pips.

### 3. World 1 Boss 3→4 Slot Expansion: `unlock-slot-expand` (`r1`, 100f / 1600ms)
- `f1–f17`: `?` crest flips on Y-axis (`scale ×1→×0.08`) against radiating rays.
- `f20–f29`: Belt Expansion icon flips open (`×0.08→×1`), radial halo expands `f27–f38`, and `weaponGet` sounds on `f26.3`.
- `f32–f47`: `4th Weapon Slot / BELT EXPANSION · 4 SLOTS`, Orange Tabby cheer toast (`f16–f43`), and `unlock-slot-strip-4` (`NEW!` golden 4th slot pops `×1→×2.78→×2.22`, `f24–f67`) land smoothly with **0 hints**.

### 4. Awakening Cut-In & Non-Blocking Banner: `fx-evolution`, `fx-evolution-2`, `fx-evolution-banner`, `fx-evo-almost`
- **`fx-evolution` (`r1`, 126f / 2016ms):** Angled black/gold slash sweeps in `f24–f39`; single-weapon `Blast Powder` + `Cluster Charge` golden medallion slam in (`f25–f44`) with all 4 stat pills (`3 explosions`, `15s ACTIVE`, `+8 BASE`, `+0.2× MULT`) and full rule text cleanly legible through `f99`; tap at `f100` closes cleanly `f100–f107`.
- **`fx-evolution-2` (`r1`, 272f / 4352ms):** `1/2` (`Cluster Charge`) hands off on `f100` tap to `2/2` (`Sweep Beam`, `Prismatic Ray`, `2 same-row Sets`, `16s ACTIVE`) through `f200` tap → clean exit `f206–f215`.
- **Optional follow-up polish opportunities spotted on the frames (non-blocking) — ALL 3 RESOLVED (`after` pass, `#60` & `#62`):**
  1. `fx-evolution-banner` (`#evolution-banner`): `r1` had `FADE-ONLY` (`f0→f11`). **`after` (`#60`):** `#evolution-banner` now enters with GPU-composited `translateY (-10 → 0)` + `scale (0.96 → 1.0)` over `5f / 80ms` (`moves 10px straight in 5f/80ms, ease-out · scale ×1→×1.04 in 4f/64ms · opacity 0→1 in 8f/128ms`, `f0→f8`). **`FADE-ONLY` hint eliminated** (`9/9/7/9/8/9/—` → **`9/9/9/9/9/9/—`**).
  2. `fx-evolution-2` (Queued `1/2 → 2/2` Swap): `r1` popped card 1 out in 1 frame at `f100`. **`after` (`#60`):** Frame-by-frame inspection of `motion-out/fx-evolution-2/after/frames/f100.png`, `f103.png`, and `f106.png` confirms `ExitingAwakeningCard` smoothly glides card 1 (`Cluster Charge`) upward while fading (`96ms` `EASE.exitSoft`) as incoming `Prismatic Ray` / `Sweep Beam` slides up from below (`MS.quick` `EASE.enter`), eliminating the visual snap (`9/9/8/8/8/9/—` → **`9/9/9/9/9/9/—`**; DOM linter still notes the keyed React node handoff to the exiting clone).
  3. `AdventureCamp` Armory header & tiles at `375px` (`#62`): Re-captured `armory-evo-picker --label after` (**0 hints**, `f0`, `SPRING.snappy` `×1→×1.09→×1.01` over `19f/304ms`) and full-window `375×667` `ui-armory-evo-picker.png`: **`ARMORY`** renders cleanly in full (zero `ARMO...` truncation) alongside `TEST` and coins, `Rainbow Charm Lv 3` fits cleanly on 1 line inside the widened `148px` tile, and `npm run test:e2e:layout` passes **4/4 (`0` clipping violations)**.
