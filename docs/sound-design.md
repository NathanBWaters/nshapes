# Sound design: the adaptive score

Adventure Mode's sound is one piece of music that the fight plays. Nothing is a
recording: every note, drum and effect is synthesized live in `src/audio/`.

Three ideas hold it together.

1. **Everything is in key.** The tune, a weapon's riff, a coin, a jackpot: all
   are written in scale steps and resolved against the key and chord the band
   is on at that moment. No sound can clash with the music, so sounds can pile
   up (the casino feel) and still sound like one song.
2. **Everything is on the beat.** Effects wait for the next 32nd note (at most
   about 60 ms), so a chain of triggers is a rhythm, not a smear.
3. **The music tells you the state of the fight.** You can play with your eyes
   on the cards and still know your hearts, the clock, the foe and your streak.

Try it all at **`/dev/sound`** (the sound studio): start the band, change the
fight, tap a weapon, hold it to add it to the band, tap a recipe.

## What you hear, and what it means

| You hear | It means | Where |
|---|---|---|
| The tune turning minor, step by step | You are losing hearts (half gone: one step darker; last heart: two) | `director.ts` hearts → mode |
| A heartbeat, and the band muffled | One heart left | `heartbeat`, `filterHz` |
| Tick-tock, then racing ticks and a faster band | The clock is in its last quarter (or 20 s), then its last 8 s. Untimed levels do the same on their last moves. | `clock` |
| More of the band joining in | The foe is falling, you are deeper into the waves, you are on a streak | `intensity` → drums, arpeggio, pad, counter-melody |
| The band thinning, then the tune dropping out | You have not made a Set for a while (patience grows with every trait beyond three) | `idleThinMs`, `idleQuietMs` |
| A drum roll and kettledrum under it all | The foe is under 20% HP: finish it | `finisher` |
| The band getting faster | Your streak: +2% per Set, up to +10% | `comboTempo` |
| Everything a key higher and brighter, new drums, bells | An evolution is live. Each recipe has its own theme. | evolutions → `lift`, mode, groove |
| The evolution's layer cutting in and out | It ends in 5 seconds | `evolutionFading` |
| A semitone up | The next wave | wave → `lift` |
| Half speed, mellow vibes, a ride cymbal | Level-up pick or the shop: take your time | `lounge` |
| Underwater | Paused, or a tip is waiting for you | `paused` |
| Glass chords, no drums, half speed | Deep Freeze: the clock and the foe stand still | `frozen` |
| Low brass leaning on a sour note, then landing | The foe did something (each move adds its own detail) | `foe…` cues |
| A low choir a semitone off | A cursed card is on the board | `alerts.cursed` |
| Cowbell on every 8th | The Hot Potato is about to jump | `alerts.potatoSoon` |
| A constant shaker | A fuse is in its last seconds | `alerts.fuseHot` |
| Rim clicks off the beat | A thorn card is about to bite | `alerts.thornSoon` |
| A high glass ping twice a bar | The Glass Sword's window is nearly shut | `alerts.glassLow` |
| A loud tick on every beat | A foe's bomb or countdown card is close | `alerts.bombSoon` |

Every world plays the same tune in the same key as the map (C), each in its
own mode: Meadow major, Woods dorian, Canyon mixolydian, Peaks lydian, bosses
minor (`WORLD_TONE`). Walking from the map into a fight never transposes the
tune; only its colour changes. Key changes are kept for things that happen in
a fight (a new wave, an evolution). Each mode swaps the one chord of the loop
that would turn sour in it (`theory.ts` `PROGRESSIONS`).

## The casino layer

| Moment | Sound |
|---|---|
| Tapping cards | The first, second and third card are the root, third and fifth of the current chord. A Set spells a chord. |
| A Set lands | The chord strums, and the **streak ladder** rings: one rung higher for every Set in the combo (a five-note scale, so no rung is ever sour), up three octaves. Streak 3 adds a second bell, 5 a run of sparkles, 8 a cymbal and a choir. |
| How hard it hit | Under 10 damage: a tap. 10+: brass. 25+: a sub-bass drop, a cymbal, and the music ducks under it. 50+ (MEGA): the whole orchestra and a shower of bells. |
| What the Set set off | A **chain**: each effect one 32nd note later (blast, laser, heal, coins, a weapon's sting…). Five or more ends on the cash register. |
| A near miss saved by a grace | A note that starts a semitone flat and is pulled up into the chord |
| The streak ending | Two notes stepping down |
| A trick weapon going wrong (off the rope, a shattered sword, a thorn that bit) | A plucked note with its sour neighbour, falling. Never the weapon's own sting. |
| Level-up | A brass fanfare, then the three choices land like slot reels |
| Buying / rerolling in the shop | The cash register / the reels spinning |
| Results | Each star rings a step higher up the chord; then the coins count out, climbing the ladder |
| A Catalyst appears | One note from outside the scale, which then resolves |
| An evolution starts | A drum roll and a riser into the recipe's fanfare; the band lifts |
| Winning / losing | A full cadence with kettledrums / the band falling apart downward |

## Every weapon is a band member

`src/audio/voices.ts` gives each of the 63 weapons a **voice**: an instrument
and a one-bar riff written in steps above the chord root (so any riff fits any
bar, and any two riffs harmonise). Some also add a drum figure.

- **Holding a weapon** puts its riff in the music. Two or three weapons take a
  turn each bar, so over a few bars you hear your whole build.
- **A weapon firing** plays its **sting** (the riff's notes as one quick run)
  and turns its riff up for the next bars. Weapons that are doing the work are
  the ones you hear.
- **Picking or buying a weapon** plays its sting: a new member joins.
- **Tapping a weapon in the Armory** plays its riff. So does its unlock screen.

The voice follows the weapon's job: brass and big drums for damage, one clear
solo instrument for each trick, an uneasy corner for the board gambles, wide
slow instruments for the board, warm ones for hearts, glass and coins for
insight, clocks for time, things that repeat for echoes. Each row in the table
says why (Blast Powder: "Low brass and a kettledrum: every boom lands on the
beat"; Mirror Shard: "A phrase and its mirror image"; Greedy Chest: "One more
coin each time: the run grows as you wait").

A weapon added later with no row still gets a voice, made from its id.

## Every evolution is a duet

An evolution's theme is made from its two weapons (`evolutionTheme`):

- **Fanfare:** weapon one's sting, weapon two's answered a third higher, then
  the octave, on the two weapons' own instruments over brass.
- **While it is live:** both riffs play together an octave up (one doubled on
  the supersaw), with a ring of bells and off-beat chord stabs.
- **Key lift** of 2 to 7 semitones, **mode** one or two steps brighter, and one
  of four drum grooves (four-on-the-floor, gallop, breakbeat, march), picked by
  the recipe's id.

All 204 recipes get a different theme (tested).

## How it is built

```
src/audio/
  chip.ts         the synth: oscillators, FM bells, filters, reverb, echo, limiter, ducking
  instruments.ts  28 instruments and 22 drums, as data
  theory.ts       modes, chord loops, scale steps → notes, the streak ladder (pure)
  voices.ts       a voice for every weapon, a theme for every evolution (pure)
  director.ts     fight state (FightMood) → how the band plays (Mix) (pure)
  band.ts         the sequencer and the cue book
  fightAudio.ts   RunState → FightMood; fight events → cues (pure mapping)
  songs.ts        the tune and each world's arrangement, as text
  index.ts        public API: music, band, sfx(), renderOffline()
```

- **To change what a state sounds like,** edit `director.ts`. It is the only
  place that decides.
- **To add a fight event,** give it a row in `fightAudio.ts` `EVENT_CUE` (the
  type checker insists) and, if it needs a new sound, a cue in `band.ts` `CUES`.
- **To add a weapon,** add a row to `voices.ts`. If its effect has no rule
  behind it, name the event it causes (`events`) or the callout it announces
  itself with (`calls`) in `data/weaponGuide.ts`, so its sting plays when it fires.
- **The chain steps with the picture.** The effects on screen
  (`src/adventure/fx`, docs/fx-design.md) take a step exactly when the chain
  does (`takesChainSlot`) and choose how many 32nd notes a step lasts
  (`playSounds(sounds, stride)`): a short chain plays slower so it can be read.
- **Run events carry `source`** (the rule key of the weapon, skill node or
  evolution that caused them), which is how the band knows whose sting to play.

**The sound button on the map** turns the whole score on and off (music and
effects together: in Adventure they are one thing).

## Checking it without speakers

- `npx jest __tests__/audioScore.test.ts`: the theory (no diminished chord in
  any loop, the ladder only climbs), every weapon voiced and unique, every
  recipe themed and unique, the director's rules, the event → cue mapping.
- `/dev/sound` → **Check levels** renders a scripted fight through an
  `OfflineAudioContext` and reports peak and RMS. The limiter keeps the peak
  under 1.0.
- In a dev build, `__nshapesAudio.renderOffline({ script: … })` renders any
  scripted fight to an `AudioBuffer`; `__nshapesAudio.band.currentMix` is the
  live mix.

## Limits worth knowing

- **Web only.** The synth needs Web Audio, so the score plays in the browser
  and the installed web app. Native builds keep the old bundled samples and
  have no music.
- **Tuned by measurement, not by ear.** Levels, balance between layers and the
  absence of clipping were measured from offline renders; the musical choices
  follow theory. Nobody has listened to it on a phone speaker yet.
- **Voices are capped** (56 at once, quiet layers dropped first) to protect
  slow phones. A very busy evolution on an old phone may thin its bells.
- Two trick payouts (Ice Block, Wild Card) raise no fight event, so their
  weapons' stings play only when picked, not when they pay.
