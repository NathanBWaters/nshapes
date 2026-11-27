# NShapes — Silent First-Timer Observation Sheet & Triage Scorecard (`[TP-20]`)

> Companion worksheet to [silent-first-timer-protocol.md](./silent-first-timer-protocol.md) (Sakurai Ep. `#246`).
> Duplicate **Part A** for each tester (`P01` through `P10`), then roll all 10 sessions into **Part B** before touching any balance knob.

---

## Part A — Per-Tester Session Sheet (Copy for `P01`–`P10`)

### Session Metadata

| Field | Entry |
|---|---|
| **Tester ID** | `P__` (of 10) |
| **Date & Build Version** | `YYYY-MM-DD` · `v0.1.___` |
| **Cohort Bucket** | `[ ] Kid/Teen (9–15)` · `[ ] Casual Puzzle (New to SET)` · `[ ] Roguelike Player` |
| **Device & Viewport** | `[ ] Mobile Portrait (____)` · `[ ] Desktop Web (____)` |
| **Launch URL** | `[ ] /dev/adventure?save=fresh` · `[ ] Production Incognito` |
| **Audio Environment** | `[ ] Phone Speaker` · `[ ] Laptop Speaker` · `[ ] Headphones` · Volume: `___%` |
| **Recording File** | `______________________________` |

---

### Core 6 Timestamped Metrics

| # | Metric | Observed Value / Notes |
|---|---|---|
| **1a** | **Time-to-First-Set** (app open → first valid Set on `1-1`) | `___ sec` |
| **1b** | **First Genuine Smile / Lean-In** (timestamp + trigger) | `___ sec` — Trigger: `________________` |
| **2** | **Dead Taps / Mis-Taps / Accidental HUD Opens** (count + worst surface) | Count: `___` — Surface: `________________` |
| **3** | **Cognitive Freezes (`>6s` staring)** (count + longest freeze + level) | Count: `___` — Longest: `___s` on Level `____` |
| **4** | **Squints / Color-Shape Confusions** (Circle/Triangle/Bolt · Orange/Blue/Pink · Hatch) | `[ ] None` · Notes: `____________________` |
| **5a** | **First Parry (`1-6`) Comprehension** | `[ ] Noticed & Parried` · `[ ] Partial` · `[ ] Missed` · `[ ] Didn't reach 1-6` |
| **5b** | **First Camp / Weapon Equip Comprehension** | `[ ] Unassisted` · `[ ] Hesitated` · `[ ] Stuck` · `[ ] Never opened Camp` |
| **6** | **Minute-10 Pull Test** (*"Time's up, you can stop now"*) | `[ ] Kept Playing ("one more!")` · `[ ] Finished Fight` · `[ ] Stopped Immediately` |

---

### Minute-by-Minute Live Observation Log (`0:00` → `10:00`)

*Facilitator Reminder: ZERO hints, ZERO pointing, ZERO defenses! Only log exact timestamps, physical cues (hesitation, squint, lean-in, mis-tap, sigh, smile), and verbatim quotes.*

| Minute | Screen / Level | Hesitation (`>6s`) / Squint / Mis-Tap | Facial Cue / Verbatim Quote | Suspected Root Cause |
|---|---|---|---|---|
| **0:00 – 1:00** | MainMenu / StoryIntro | | | |
| **1:00 – 2:00** | `1-1` *First Light* (2T, 9c) | | | |
| **2:00 – 3:00** | `1-1` Results / `1-2` *Red Clover* | | | |
| **3:00 – 4:00** | `1-2` / `1-3` *All Kinds* | | | |
| **4:00 – 5:00** | `1-4` *Boom Practice* / Camp | | | |
| **5:00 – 6:00** | Camp / `1-5` *Counting Acorns* (3T) | | | |
| **6:00 – 7:00** | `1-5` / `1-6` *Rainbow Hunt* (Parry!) | | | |
| **7:00 – 8:00** | `1-6` / Retry / Skill Tree | | | |
| **8:00 – 9:00** | `1-7+` / Camp Swap | | | |
| **9:00 – 10:00** | Active Fight → **Minute-10 Pull Test** | | | |

---

### Post-Session 5-Question Debrief (3 Minutes Max)

1. **One-sentence description to a friend:** `_____________________________________________________`
2. **Coolest / most satisfying moment:** `_____________________________________________________`
3. **Most confusing *"what just happened?"* moment:** `_____________________________________________________`
4. **Any shape, color, or contrast difficulty?** `_____________________________________________________`
5. **What did weapons & the parry bar seem to do?** `_____________________________________________________`

---

## Part B — 10-Tester Cohort Triage Scorecard

Fill in after all 10 sessions (`P01`–`P10`) are complete.

### Cohort Summary Roll-Up

| Tester | Bucket | Device | 1st Set (s) | 1st Smile (s) | Mis-Taps | Freezes `>6s` | Squints | Parry `1-6` | Camp Equip | Min-10 Pull | Furthest Level |
|---|---|---|---:|---:|---:|---:|---|---|---|---|---|
| `P01` | Kid/Teen | | | | | | | | | | |
| `P02` | Kid/Teen | | | | | | | | | | |
| `P03` | Kid/Teen | | | | | | | | | | |
| `P04` | Casual Puzzle | | | | | | | | | | |
| `P05` | Casual Puzzle | | | | | | | | | | |
| `P06` | Casual Puzzle | | | | | | | | | | |
| `P07` | Casual Puzzle | | | | | | | | | | |
| `P08` | Roguelike | | | | | | | | | | |
| `P09` | Roguelike | | | | | | | | | | |
| `P10` | Roguelike | | | | | | | | | | |

### Launch-Readiness Bars (Pass / Fail Gate)

| Metric | Launch Bar | Observed Result | Status |
|---|---|---|---|
| **Median Time-to-First-Set** | `≤ 25 sec` | `___ sec` | `[ ] PASS` · `[ ] FAIL` |
| **Unassisted `1-1` Completion** | `≥ 9 / 10` | `___ / 10` | `[ ] PASS` · `[ ] FAIL` |
| **Zero Color/Shape Confusion** (Circle/Triangle/Bolt · Orange/Blue/Pink) | `≥ 9 / 10` | `___ / 10` | `[ ] PASS` · `[ ] FAIL` |
| **Unassisted Camp Weapon Equip** | `≥ 7 / 10` | `___ / 10` | `[ ] PASS` · `[ ] FAIL` |
| **Noticed First Timing Parry (`1-6`)** (of testers reaching `1-6`) | `≥ 60%` | `___ %` | `[ ] PASS` · `[ ] FAIL` |
| **Minute-10 Pull Test** (`Kept Playing` or `Finished Fight`) | `≥ 6 / 10` | `___ / 10` | `[ ] PASS` · `[ ] FAIL` |

### Top-5 Human Friction Action List (Fix Before Touching Balance Knobs)

*Severity Rules: **`P0`** = `≥3/10` testers hit same block/confusion or any soft-lock; **`P1`** = `2/10` testers; **`P2`** = `1/10` watchlist.*

| Rank | Severity | Testers Affected (e.g. `4/10`) | Observed Friction & Exact Screen/Timestamp | Concrete Fix Planned |
|---:|---|---|---|---|
| **1** | `P0` | `/10` | | |
| **2** | `P0` | `/10` | | |
| **3** | `P1` | `/10` | | |
| **4** | `P1` | `/10` | | |
| **5** | `P2` | `/10` | | |
