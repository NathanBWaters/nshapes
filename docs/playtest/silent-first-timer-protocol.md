# NShapes — 10-Person Silent First-Timer Playtest Protocol (`[TP-20]`)

> **Sakurai Grounding:** Ep. `#246` (*Elementary School Playtesters* — invite fresh players, say nothing, and watch firsthand where they smile, freeze, or lose interest), Ep. `#226` (*Echo Chambers* — break out of self-reinforcing assumptions), Ep. `#021` (*Can You Explain That to the Customer?*), Ep. `#216` (*Average Equals Mediocre*), and Ep. `#218` (*Balance Monitoring Never Ends*).

---

## 1. Mandatory Balance-Script Freeze Policy

Before adding any new balance-tuning script, bot-calibration math, or global `balanceEras.json` reset:

1. **Complete all 10 uncoached live human playtests** using this protocol and log every session in [observation-sheet.md](./observation-sheet.md).
2. **Accumulate `≥200` real multi-player fights** spanning 2-trait through 5-trait boards (prior calibration in `docs/calibrated-bot.json` rested on just 73 raw / 64 kept / 17 timed fights with zero 4T–5T fights, while 10 Balance Eras cycled across 6 days).
3. **Triage the top 5 observed human friction points first** — fixing visual readability, onboarding, tap-target confusion, and parry comprehension before turning any numerical balance knob.

---

## 2. Tester Recruitment Mix (10 Non-Developers)

Recruit **10 people who have NEVER played NShapes** and are **NOT game developers** (zero teammates, zero people who watched you build the game):

| Cohort Bucket | Count | Profile & Why They Matter |
|---|---:|---|
| **Kids & Teens (Ages 9–15)** | **3** | Pure Sakurai Ep. `#246` litmus test: zero politeness filter, immediate boredom or delight, exposes jargon and slow starts brutally fast. |
| **Casual Puzzle Players (New to SET)** | **4** | Know match-3 or Wordle/NYT Games, do **not** have SET rules memorized. Tests whether `1-1` (*First Light*) teaches the 3-card Set rule naturally without verbal help. |
| **Roguelike / Deckbuilder Players** | **3** | Play *Balatro*, *Slay the Spire*, or *Vampire Survivors*. Tests whether Weapons, `POWER ×N`, Set-Parries, and Camp loadouts deliver real build-craft excitement. |
| **TOTAL** | **10** | — |

**Device Split Across the 10 Testers:**
- **6–7 on Mobile Portrait** (actual iPhone / Android phones in Safari or Chrome — portrait grip, thumb reach, phone speaker audio ON at ~50–60% volume on at least 4 sessions).
- **3–4 on Desktop Web** (laptop/desktop browser, mouse or keyboard, ~1280×800 or standard window).

---

## 3. Pre-Session Technical Setup (`?save=fresh`)

Choose the cleanest fresh-save launch path for your session:

- **Local Dev Build (Recommended for instant reset & local logging):**
  ```text
  http://localhost:8081/dev/adventure?save=fresh
  ```
  *(Start server with `npm run web`. Note: `/dev/adventure?save=fresh` starts a brand-new save with zero stars, zero unlocks, and full cold-open StoryIntro → `1-1` flow.)*
- **Live Web Build (Testing full MainMenu → Adventure entry):**
  ```text
  https://nathanbwaters.github.io/nshapes/
  ```
  Open in a **brand-new Incognito / Private Browser Window** (or verify `Options → Reset Game → START OVER` before handing over the device) so `localStorage` / MMKV is 100% empty.

**Pre-Flight Checklist (2 Minutes Before Tester Arrives):**
- [ ] Start **screen recording** (iOS Screen Recording / QuickTime / OBS) + position yourself slightly behind/beside the tester so you can see **both the screen and their eyes/thumbs** (notice squints, brow furrows, hover hesitations, and smiles).
- [ ] Enable **Do Not Disturb** on the test device so notifications don't break immersion.
- [ ] Set device volume to **~50–60%** (unmuted) and keep a stopwatch/timer ready at `00:00`.
- [ ] Open a fresh copy of [observation-sheet.md](./observation-sheet.md) labeled `P01`..`P10`.

---

## 4. The Zero-Hint Facilitator Script

### Opening Prompt (Read Aloud Verbatim Before Handing Over Device)

> *"Thanks for helping test NShapes! I'm testing the game, not you — if anything feels confusing, weird, or frustrating, that's a bug I need to fix, not a mistake on your part. For the next 10 minutes, please just play normally and think out loud if you want. I'm going to stay completely quiet and take notes, so pretend I'm not here!"*

### Hard Silence Rules (Minutes `0:00` → `10:00`)

1. **Zero rule explanations:** Do NOT explain what a "Set" is, how Circles/Triangles/Bolts or Orange/Blue/Pink work, or what "all same / all different" means.
2. **Zero UI hints:** Do NOT point at buttons, do NOT say *"tap Camp"*, *"try equipping Blast Powder"*, *"watch the red bar"*, or *"match 3 cards."*
3. **Zero defenses:** Never say *"oh, I'm still working on that"* or *"that's because..."* — just smile neutrally and write it down.
4. **Escape Hatch (`>45s` complete hard stall ONLY):** If a tester freezes completely for **45+ seconds** and turns to ask you what to do, reply ONLY with a neutral mirror question:
   - *"What do you expect to happen if you tap something here?"*
   - *"What did you think just happened?"*
   - Only intervene directly if they hit a genuine crash/soft-lock (mark `P0 SOFT-LOCK` on the observation sheet).

### Minute-10 Pull Test (Exact Closing Cue)

At **`10:00`**, say neutrally (without leading tone):

> *"Okay, 10 minutes are up — you can stop whenever you're ready."*

Watch closely for the next 5 seconds and log which of three reactions happens:
- **Strong Pull (`Kept Playing`):** *"Wait, let me beat this boss / try one more level!"*
- **Polite Finish (`Finished Current Fight`):** Finishes the active fight, then hands device back.
- **Drop (`Stopped Immediately`):** Sets the device down right away (especially mid-fight!).

---

## 5. 10-Minute Observation Focus & 6 Core Metrics

Watch for the **6 core metrics** across the natural first-10-minute journey (`MainMenu` → `StoryIntro` → `1-1` through `1-6` + first `Camp` visit):

| # | Metric | What to Record | Red Flag Threshold |
|---|---|---|---|
| **1** | **Time-to-First-Set & First Smile** | Seconds from app open → first valid Set on `1-1`; seconds until first genuine smile, gasp, or lean-in. | `>45s` to first Set or zero smiles in 10 min |
| **2** | **Dead Taps / Mis-Taps / Accidental Overlays** | Every tap that does nothing, hits the wrong card, or accidentally pops a HUD inspector / tooltip. | `≥3` mis-taps on the same UI surface |
| **3** | **Cognitive Freezes (`>6s` Staring)** | Every pause `>6s` without tapping — note level, trait count (2T/3T), board size (9/12), and active overlays. | Repeated `>10s` stalls before `1-5` |
| **4** | **Squints & Visual-Contrast Friction** | Any squinting, tilting the phone, or misreading **Circle/Triangle/Bolt**, **Orange/Blue/Pink**, hatching, or tiny HUD text. | Any tester confusing two colors or shapes |
| **5** | **First Parry (`1-6`) & Camp Weapon Comprehension** | Did they notice the Parry wind-up bar and Stagger on `1-6`? In Camp, could they read `WeaponExplainer`, equip a charm, and re-enter battle unassisted? | `<6/10` unassisted Camp equip or `<5/10` noticing Parry |
| **6** | **Minute-10 Pull Test** | Immediate stop vs. finish fight vs. *"Wait, one more!"* | `<5/10` wanting to finish or keep playing |

### Minute-by-Minute Journey Checkpoints

- **`0:00 – 1:00` (Boot & Cold Open):** Does `MainMenu` communicate ONE clear hero Play button? Does `StoryIntro` delight or feel too long?
- **`1:00 – 3:00` (`1-1` *First Light*, 2 traits, 9 cards):** Does the tester deduce the 3-card Set rule organically? Do card hits, Orange Tabby reactions, and the first `Blast Powder` unlock feel punchy?
- **`3:00 – 5:30` (`1-2`–`1-4` + First Camp Visit):** Do they feel the explosion payoff of `Blast Powder`? Can they open Camp, inspect `WeaponExplainer`, and equip `Rainbow Charm` / `Mending Charm` without hesitation?
- **`5:30 – 8:00` (`1-5` *Counting Acorns* 3T/12-card & `1-6` *Rainbow Hunt* + First Timing Parry):** How smoothly do they adjust to 12 cards + Numbers? Do they spot the Timing Parry bar on `1-6` and feel the `2.5s` micro-Stagger?
- **`8:00 – 10:00` (Progression Loop & Retries):** If they lose a stage, does `<250ms` Defeat Retry feel effortless? Are they excited to spend Stars on the Skill Tree?

---

## 6. Post-Session Debrief (5 Neutral Questions · 3 Minutes Max)

Ask only AFTER the Minute-10 Pull Test concludes:

1. *"In one sentence, how would you describe this game to a friend?"* (Checks whether our unified pitch matches player perception!)
2. *"What was the coolest or most satisfying moment in those 10 minutes?"*
3. *"Was there any moment where you thought, 'Wait — what just happened?' or didn't know what to tap?"*
4. *"Were any shapes, colors, or numbers ever hard to tell apart?"*
5. *"What did you think the weapons / parrying bar were doing?"*

---

## 7. Post-Cohort Triage Rules (Before Touching Balance Knobs)

After all **10 sessions** are recorded in [observation-sheet.md](./observation-sheet.md):

- **`P0 — Mandatory Fix Now` (`≥3/10` testers hit the same confusion, mis-tap, squint, or soft-lock):** Ship a focused UX/onboarding/visual fix before any numerical balance changes.
- **`P1 — High-Value Polish` (`2/10` testers hit noticeable friction, or `≥3/10` miss an optional system like Camp Skill Tree):** Queue in the next UX sprint.
- **`P2 — Watchlist` (`1/10` isolated quirk):** Log and re-check in future PostHog telemetry once `≥200` real fights arrive.
- **Balance Audit Gate:** Only after P0 fixes ship and post-playtest telemetry accumulates `≥200` real human fights across 2T–5T should you resume automated balance adjustments or record a new Balance Era.
