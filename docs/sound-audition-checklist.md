# Real-Device Multi-Environment Audio & Haptics Audition Checklist ([AU-16])

> **Reference:** Masahiro Sakurai Ep. #054 (*Audition Audio Across Environments*), Ep. #032 (*Balance Sound Effects by Priority*), Ep. #165 (*Strong Attack, Restrained Decay*), Ep. #202 (*Balancing Ambient Sound*).
>
> **Studio Tool:** Open **`/dev/sound`** in a dev build to run live diagnostics (`Flat Stereo` / `Phone Sim 300–5kHz Mono` / `Low Vol -12 dB`), voice-stealing telemetry, and offline Stereo / Mono-Sum / Phone-Band RMS checks before signing off on real hardware.

---

## 1. Pre-Audition Studio Verification (`/dev/sound`)

- [ ] **Offline Check Levels (`Check levels` button):**
  - Stereo Peak `< 0.99` (`no clipping`)
  - Mono-Sum Peak `< 0.99` (no phase collapse or mono overload)
  - `300–5000 Hz` Phone-Band RMS sits within `~3–6 dB` of broadband RMS (confirming warm 2nd/3rd bass harmonics carry through tiny phone drivers)
- [ ] **Monitor Mode Sweep (`Phone Sim 300–5kHz Mono` & `Low Vol -12 dB`):**
  - `payout` T0 → T1 → T2 → T3 scales monotonically in perceived weight (`-5 dB → -2 dB → 0 dB → +1 dB`)
  - `impactCrack` + `impactPunch` bite cleanly on frame 0 ahead of tucked `harp`/`bell` chimes
  - Combo `1..12` + `peaks` arrangement never produces shrill upper-octave shrieks or FM aliasing (`<= 2,600 Hz` pitch fold)
- [ ] **4-Tier Priority & Voice Stealing:**
  - Trigger a busy MEGA + Rainbow cascade alongside `hurt`, `perfectParry`, or `foeDefeated`
  - Verify Tier S cues audibly duck Tier B/C (`-9 dB`) & Music (`-8 dB`), and `Stolen` increments cleanly before any Tier S/A cue is dropped
- [ ] **16-Bar A–B Form, Summit & Screen Tracks:**
  - Verify `meadow` (`118`), `woods` (`122`), `canyon` (`128`), `peaks` (`124`), `summit` (`136`), `boss` (`148`) play `INTRO_PICKUP` on fresh fight entry and transition cleanly from 8-bar `THEME` into 8-bar `THEME_BATTLE_B`
  - Verify `title` (`96`), `story` (`88`), `camp` (`98`), and `map` (`108`) sound emotionally distinct with zero jarring drum clash on Title/Story
  - Verify opening 2-bar `THEME` hook (`E5–G5–C6–B5–G5–E5`) remains hummable in bright/neutral worlds (`map`, `title`, `camp`, `meadow`, `canyon`, `peaks`, `summit`) and turns deliberately minor only in `woods`, `boss`, `story`, and `lastHeart`
- [ ] **6 Fighter Voices & Kill-Cam 3-Beat Arc:**
  - Audition all 6 fighters (`Orange Tabby`, `Sly Fox`, `Badger`, `Emperor Penguin`, `Corgi`, `Pelican`) across `signature`, `cheer`, and `hurt` — confirm distinct timbres and Tier B ceiling
  - Audition `Kill-Cam 3-Beat Arc` (Riser → Slow-Mo Defeat → Shatter), `Cut-In Evolve (90ms)`, and `WeaponPick ReelStop (3x)`

---

## 2. Four Real-Hardware Listening Environments

### Environment A — iPhone / Android Built-In Speaker (40% & 80% Volume)
- [ ] **40% volume:** `impactCrack`, `parryWarn`, `perfectParry`, `mistake`, and `foeStrike` stay instantly intelligible above BGM without turning up volume
- [ ] **80% volume:** ZERO harsh 3–5 kHz ear fatigue during combo 10+ MEGA + Rainbow hits or World 4 `peaks` (`celesta`) / World 5 `summit` (`136 BPM`)
- [ ] **Phone bass audit:** `kick`, `subDrop`, `taiko`, `timpani`, and `thud` remain audibly weighty via 2nd/3rd harmonics (`120–360 Hz`) rather than vanishing below `200 Hz`
- [ ] **Mono fold-down:** Panning (`voices.ts`, `rainbow`, `glock`) collapses cleanly on single-speaker phones with zero hollow phasing
- [ ] **Impact-synced haptics (`[AU-21]`):** Card taps = light selection tick; `onLand` scales T0 (`light`) → T1 (`medium`) → T2/T3 (`heavy`); Parry (`medium`) vs Perfect Parry (`success`); Hurt (`error`); Boss KO (`heavy` + `success`); Stars 1–2 (`medium`) vs 3★ (`heavy` + `success`); disabling Haptics in Options silences every pulse including `RoundFunPrompt`

### Environment B — Laptop Speakers (MacBook / Windows Built-In)
- [ ] `title` and `camp` drumless/brushed beds feel cozy and unobtrusive during menu browsing and loadout tweaking
- [ ] `blast`, `laser`, `charged`, and `grudge` terminate tightly in the `0.35 s` SFX room with ZERO runaway hall smear or unintended echo bounces
- [ ] Board alerts cap cleanly to at most 2 simultaneous warnings (1 during last-heart + racing clock) so World 3–5 gamble builds stay readable

### Environment C — Earbuds / Headphones (Wired & Bluetooth)
- [ ] Stereo panning of 64 weapon voices and subtle `0.35 s` SFX room vs ceremonial `1.7 s` hall (`finale`, `slowMoDefeat`, 3★ `star`, `friendRescued`) feels spacious without fatigue
- [ ] Procedural biome ambience (`meadow`, `woods`, `camp`, `canyon`, `peaks`, `summit`) sits gently at `-20 dB`, ducks `-12 dB` under Tier S/A impacts, has zero audible loop seam clicks, and remains softly alive if Music is muted while SFX stays ON
- [ ] Immediate cues (`mistake`, `parry*`, `hurt`, `multStep`, `register`, `reelStop`) feel zero-latency (`4 ms` lookahead, no 32nd-note grid lag or dropped Balatro tally ticks)

### Environment D — iOS Silent Switch, Backgrounding & Call/Siri Interruptions
- [ ] **Hardware Silent Switch ON (iOS):** Native audio respects silent switch (`playsInSilentModeIOS: false` / `ambient` session)
- [ ] **App Switch / Lock Screen:** Band sequencer halts, biome ambience stops, and `AudioContext` suspends immediately (zero background battery drain or leaked notes)
- [ ] **Foreground Return / Post-Call / Post-Siri:** Context resumes cleanly on return without stuck muffled filters or frozen tempo
- [ ] **Both Music & SFX Muted:** `AudioContext` suspends completely and biome ambience shuts down to zero DSP load

---

## 3. Sign-Off Log

| Date | Build / Version | Tester | Env A (Phone) | Env B (Laptop) | Env C (Headphones) | Env D (Lifecycle/Silent) | Notes |
|---|---|---|---|---|---|---|---|
| _TBD_ | _v0.1.x_ | _Tester_ | ☐ | ☐ | ☐ | ☐ | _Initial Wave 3 Audio Mastery sign-off_ |
