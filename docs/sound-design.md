# Sound design: the adaptive score

Adventure Mode's sound is one piece of music that the fight plays. On web (and
native builds with `react-native-audio-api`), every note, drum, biome bed and
effect is synthesized live in `src/audio/`; native builds without live Web Audio
fall back seamlessly to mastered `.m4a` loops & cues via `src/audio/nativeBridge.ts`.

Four ideas hold it together.

1. **Everything is in key — with one canonical signature hook.** The tune,
   weapon riffs, fighter calls, coins, and jackpots are written in scale steps
   and resolved against the active key and chord. The opening 2-bar `THEME`
   hook (`E5–G5–C6–B5–G5–E5`) stays unmistakably Ionian across bright/neutral
   worlds (`title`, `camp`, `map`, `meadow`, `canyon`, `peaks`, `summit`),
   applying deliberate modal lead-flattening only in dark dramatic states
   (`woods` Dorian, `boss` Aeolian, `story` abduction, and `lastHeart` danger).
2. **Priority before loudness (Sakurai Ep. #032).** SFX flow through a 4-tier
   priority bus (`S: 0 dB`, `A: -1 dB`, `B: -5 dB`, `C: -8 dB`) with SFX-to-SFX
   ducking (`Tier S` ducks `B/C` `-9 dB` & music `-8 dB`; `Tier A` ducks `B/C`
   `-4 dB`) and priority voice-stealing at `56` voices so KOs, parries, and
   hurts never drop.
3. **Strong attack, restrained decay (Sakurai Ep. #165).** Combat hits open
   with a dry `<2 ms` `impactCrack` + tight `38–58 ms` `impactPunch` finishing
   inside visual hitstop, `5 ms`-attack `brassStab`, plucked `s === 0` notes
   honoring `o.dur`, a dedicated `0.35 s` SFX room (zero `echo` on SFX), and
   24 immediate reactive cues (`4 ms` lookahead) while Set cascades stay locked
   to the 32nd-note grid inside `band.stretch()`.
4. **The music tells you the state of the fight.** You can play with your eyes
   on the cards and still know your hearts, the clock, the foe, your streak,
   and the top 2 urgent board threats.

Try it all at **`/dev/sound`** (the sound studio): toggle Monitor Mode
(`Flat Stereo` / `Phone Sim 300–5kHz Mono` / `Low Vol -12 dB`), inspect live
voices/stolen counts/per-tier meters, audition all 10 arrangements, 6 fighters,
biome ambience, 64 weapons, and 208 evolution themes. See
[sound-audition-checklist.md](./sound-audition-checklist.md) for the 4-environment
real-hardware verification checklist.

## What you hear, and what it means

| You hear | It means | Where |
|---|---|---|
| The tune turning minor, step by step | You are losing hearts (half gone: one step darker; last heart: two + lead modal flattening) | `director.ts` hearts → `mode`, `leadMode` |
| A heartbeat, and the band muffled | One heart left | `heartbeat`, `filterHz` |
| Tick-tock, then racing ticks and a faster band | The clock is in its last quarter (or 20 s), then its last 8 s. Untimed levels do the same on their last moves. | `clock` |
| More of the band joining in | The foe is falling, you are deeper into the waves, you are on a streak | `intensity` → drums, arpeggio, pad, counter-melody |
| The band softening gently (never dead) | You have not made a Set for 10–34 s (`leadGain` floors at `0.35`, filter at `9,500 Hz`) | `idleStartMs`, `idleThinMs`, `idleQuietMs` |
| A drum roll and kettledrum under it all | The foe is under 20% HP: finish it | `finisher` |
| The band getting faster | Your streak (+2%/Set, up to +10%) & clock, capped at `maxTempo: 1.18` (~175 BPM boss peak) | `comboTempo`, `maxTempo` |
| Everything a key higher and brighter, new drums, bells | An evolution is live. Each of the 208 recipes has its own theme. | evolutions → `lift`, mode, groove |
| The evolution's layer cutting in and out | It ends in 5 seconds | `evolutionFading` |
| A semitone up | The next wave | wave → `lift` |
| Half speed, mellow vibes, a ride cymbal | Level-up pick or the shop: take your time | `lounge` |
| Underwater | Paused, or a tip is waiting for you | `paused` |
| Glass chords, no drums, half speed | Deep Freeze: the clock and the foe stand still | `frozen` |
| Top 2 urgent board warnings (capped to 1 on last heart + racing clock) | Strict lethality order: `bombSoon` → `fuseHot` (8th-note shaker) → `potatoSoon` → `thornSoon` → `glassLow` (oct 5) → `cursed` | `director.ts` `capAlerts()` |

## Arrangements & Canonical `THEME` Motif

Every world shares the map's home key (C), expanding all battle tracks to a
**16-bar A–B form** (`THEME` + syncopated `THEME_BATTLE_B`) with a crisp 1-bar
`INTRO_PICKUP` on `band.enterFight()`:

- **Screen tracks (`THEME` + calm `THEME_B`):** `title` (96 BPM Ionian kalimba/strings/vibes, drumless — also gently filtered for Free Play), `story` (88 BPM dusk Aeolian strings/celesta/timpani, brightening to Ionian on Beat 3 Hero), `camp` (98 BPM cozy vibes/harp/pizz + soft shaker), `map` (108 BPM Ionian).
- **Battle tracks (16-bar A–B, smooth BPM curve):** `meadow` (118 BPM Ionian) → `woods` (122 BPM Dorian) → `canyon` (128 BPM Mixolydian) → `peaks` (124 BPM Lydian) → `summit` (136 BPM Mixolydian, celesta + heroic brass) → `boss` (148 BPM Aeolian).
- **Procedural Biome Ambience (`src/audio/ambience.ts`):** Ultra-low-CPU looped beds (`meadowAir`, `woodlandBreeze`, `campfire`, `mountainWind`) at `-20 dB` (`chip.ambienceBus`), ducked `-12 dB` under Tier S/A hits, staying alive quietly if Music alone is muted and stopping completely on background or full mute.

## Every weapon is a band member & every fighter has a voice

- **`src/audio/voices.ts`** gives all **64** Armory weapons a handcrafted **voice** (instrument + 1-bar riff + Tier B sting at `0.55`).
- **`src/audio/themes.ts`** derives a unique duet theme for all **208** evolution recipes (fanfare fired on `EvolutionCutIn` mount via `band.playCutInEvolve(id)` so the 90 ms riser lands on the exact slash-flash frame).
- **`src/audio/fighterVoices.ts`** gives all **6** animal fighters (`Orange Tabby`, `Sly Fox`, `Badger`, `Emperor Penguin`, `Corgi`, `Pelican`) ultra-short (`60–130 ms`), scale-locked (`≤2,400 Hz`), Tier B `cheer` / `signature` / `hurt` timbres with a `1.8 s` per-fighter cooldown.

## How it is built

```
src/audio/
  chip.ts           Web Audio synth, 4-tier SFX bus, voice-stealing, 0.35s/1.7s room split, phone master bus, monitor mode
  instruments.ts    29 instruments (incl. brassStab) and 24 drums (incl. impactCrack & impactPunch)
  theory.ts         modes, chord loops, scale steps → notes, the streak ladder (pure)
  voices.ts         64 weapon voices & 208 procedural evolution themes (pure)
  fighterVoices.ts  6 distinct scale-locked animal fighter vocal signatures
  director.ts       fight state (FightMood) → Mix, capAlerts, resolveLeadMode (pure)
  band.ts           16-bar A-B sequencer, 24 immediate cues, 4-tier cue book, Kill-Cam & mount-sync APIs
  ambience.ts       zero-timer procedural biome ambience bed wired to appLifecycle
  fightAudio.ts     RunState → FightMood; fight events → cues (pure mapping)
  songs.ts          INTRO_PICKUP, THEME, THEME_B, THEME_BATTLE_B & 10 arrangements
  nativeBridge.ts   expo-av .m4a loop & cue bridge for native builds without Web Audio
  index.ts          public API: music, band, ambience, sfx(), renderOffline()
```

## Checking it without speakers (and on real hardware)

- `npx jest __tests__/audioScore.test.ts`: theory, all 64 weapons & 208 recipes, 4-tier priority bus & voice stealing, `capAlerts`, `o.dur` pluck decay, 0.35 s SFX room / zero SFX echo, 24 immediate cues, 16-bar A–B & `INTRO_PICKUP`, Summit 136 BPM & `maxTempo: 1.18`, Ionian hook integrity, 6 fighter voices, biome ambience lifecycle, and MMKV-gated impact-synced haptics.
- `/dev/sound` → **Check levels** renders a 16 s scripted fight offline and reports Stereo Peak, Mono-Sum Peak, Broadband RMS, and `300–5000 Hz` Phone-Band RMS.
- Real-device verification checklist: [docs/sound-audition-checklist.md](./sound-audition-checklist.md).
