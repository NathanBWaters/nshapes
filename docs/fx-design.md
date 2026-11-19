# Fight effects: seeing what happened

Everything that happens in an Adventure fight is shown where it happened, in
the order it happened, and the fight clock stands still while it plays. The
code is `src/adventure/fx/`. Try every effect at **`/dev/fx`** (the effects
studio), in slow motion if you like.

Three ideas hold it together.

1. **One move plays as a cascade.** The Set's own hit comes first; then each
   thing it set off plays one step later: the blast, the laser, the coins,
   the heal. You watch the chain you triggered instead of reading it afterwards.
2. **Picture and sound step together.** A step of the cascade is a step of the
   band's chain (`src/audio/fightAudio.ts`), so every effect lands with its
   sound. A short chain plays slower so each step can be read; a long one
   speeds up. A sound is heard on the frame its picture lands or one frame
   after, never before: the Set's payout when its cards reach the foe, a coin's
   cue when the coin reaches the counter, a blast's when it goes off on the
   card (`Beat.cue`, carried to the band as the event's `heardAfterMs`). The
   stage waits for the band's next note (`band.stretch`, at most one 32nd),
   so the two meet.
3. **The clock waits for your moves.** While the cascade of something you did
   plays (a Set, a miss, a burn, the refill after it), or an evolution's cut-in
   waits for a tap, nothing runs on the fight clock: not the timer, not the
   foe, not fuses, not the combo window. Your effects never cost you time.
   What the clock itself causes (a foe's timed move, a fuse going off, an
   evolution running out) plays in full while the clock keeps running.

## What you see

| It happens | You see |
|---|---|
| A fight opens | A FIGHT! banner across the board (BOSS FIGHT! on a boss), and the foe says its taunt from the battle stage. |
| A Set | Its three cards pop and are thrown at the foe, with an orb trailing each; they land as a comic burst on the foe with the damage number on top (a word in front of it, "RAINBOW", rides above it as a small tag). The foe flinches, and the HP bar drops with a pale trail of what was just taken. The next cards are dealt in. |
| A knockout | A K.O.! banner across the board and a burst on the foe. |
| The ★★★ goal moves | Its strip under the HUD jumps; it turns teal with a tick (and rings) when it is met. |
| A blast | A spiky burst on every card it destroys. The old card shatters and the next card is underneath. |
| A laser | A beam along the row or column (or from whoever fired to each card), and the cards under it vaporised. |
| A ricochet, a link | A bolt jumping from card to card. |
| Fire | Flames licking up the cards that caught. |
| Coins, hearts, seconds, hints, XP | An orb from the cards of the Set (or from the weapon that paid it) to the purse, the hearts, the clock, the hint button, the XP bar, which jumps as it lands. |
| A weapon, a skill or an evolution fires | It jumps on the HUD (the weapon on the belt also plays its own animation) and a small tag under it names it. |
| A fighter passive | Its own chip jumps: Combo, Grudge, Patience, Hot Streak, Nine Lives, Thick Hide, Deep Freeze, Zoomies, Big Scoop, Keen Eye, Fetch. Saves put a ring around the fighter. |
| The foe does something | A dark orb from the foe to the card (or to your hearts, or your clock), a dark puff where it lands, and a tag saying what it did. |
| Something changes the whole board | A band of colour sweeps across it: frost (frozen), gold (War Drum, a new wave), teal (Clarity), orange (Zoomies), dark (the foe shuffles). |
| Bad news from your own gear (off the rope, thorns, a burnt fuse) | The label shakes its head, in red. Nothing flies at the foe. |
| An evolution starts | The Catalyst card erupts, then the **cut-in** takes the screen (below). |

The same effect looks the same whoever caused it. A laser from a weapon, from
a skill node and from an evolution is one laser; what differs is who jumps.

### The weapon belt

The weapons you hold sit in a row in the HUD. Each jumps when it fires, so the
cascade shows who did what. Tap one to read what it does (the same card as
before the fight and in the replay); the fight waits while you read.

### The evolution cut-in

A blade crosses the screen, rising to the right, and the cut opens into a
slanted band with the evolution's icon and name, the two weapons that fused,
what it does, and what every evolution gives (Sets ×1.5, +2 every Set, how
many seconds). The fight waits until you tap. Two evolutions that start at
once share one cut, one row each. The first evolution ever also points at the
countdown ring.

### Turning it off

Pause → **Effects: on / off** (saved as `effectsOn`). Off means numbers only,
all at once, a small banner for evolutions, and the clock never waits. A
device that asks for reduced motion keeps effects off.

## How it is built

```
src/adventure/fx/
  types.ts           the vocabulary: anchors, rows, beats, segments
  catalog.ts         EVENT_FX: ONE row per fight event (what it looks like), as data
  script.ts          events → a script: beats in order, timed to the band (pure)
  anchors.tsx        named places on the screen (foe, hearts, weapon:<id>, slot:<n>…)
  useFightFx.ts      plays scripts; says when the clock must wait
  FxStage.tsx        draws the beats that are playing, from their rows
  visuals.tsx        the drawing pieces: orb, ring, burst, beam, flames, sweep, label, ghost card
  EvolutionCutIn.tsx the cut-in
  GearBelt.tsx       the weapons in the HUD
  clock.ts           slow motion, for the studio
```

The path of one event:

1. **The engine says what happened and where.** `emit(d, type, amount, text, { slots, cards })`
   (`engine/fight.ts`): `slots` are the board positions it touched, `cards`
   the cards that were there if it removed them. The engine swaps in the next
   cards at once; the stage covers them with the old ones (ghosts) until the
   beat arrives, so the player sees the old card get hit.
2. **The script orders and times it** (`scriptFor`). Each event becomes a
   beat: when it starts, when it lands, which cards, who caused it
   (`sourceOfEvent`: the rule behind it, or the held weapon that owns that
   kind of event), and its label. An evolution splits the script in two with
   the cut-in between.
3. **The stage draws it** from its catalog row and the anchors' positions.
   Everything is measured against the stage and sized from the cards, so it
   holds on any screen.
4. **The HUD reacts when it lands** (`onLand` in `AdventureRun.tsx`): the foe
   shakes, the fighter cheers, the HP bar drops, big hits shake the screen.

### Rules worth knowing

- **To add a fight event:** add the type, then a row in `EVENT_FX` (the type
  checker refuses to build without one) and in `EVENT_CUE` for its sound. If
  it happens on cards, pass `{ slots }` to `emit`.
- **To add a weapon:** nothing here. It joins the belt by being held, jumps
  when one of its rules fires, and effects with no rule behind them find it
  through its `events` / `calls` in `data/weaponGuide.ts`.
- **To add a HUD part the effects should aim at:** wrap it in
  `<Anchor name="…">` and add the name to `AnchorName`.
- **Damage:** a row is marked `damage` only if the event's amount was dealt
  right then (a hit, a rule's blast). Bonuses folded into the Set (Grudge,
  Patience, a blast the board rolled) are told without an amount of their
  own, so nothing comes off the HP bar twice.
- **What holds the clock:** beats of events the player's own action caused.
  Events emitted while the clock ticks carry `clock: true` (`engine/fight.ts`
  `emit`, set for every `TICK`) and never hold it. **Ambient rows**
  (`ambient: true`: a fuse warning, a foe healing, Keen Eye) play at most
  once a second and never hold it either.
- **Borders stay for selection.** Effects are drawn on a layer over the board;
  they never change a card's border. A pointed-out card is a warm fill and a
  hop (`src/components/CardMotion.tsx`), never an outline.
- **A Set's own cards are thrown.** `AdventureRun` hands the stage the cards of
  the Set's lead hit (`e.cards`), and a ghost of each flies to the foe
  (`visuals.tsx` `Ghost`, `'throw'`; `useFightFx.ts` `ghostBreakOf`): picked up
  from the picked card's own size, drawn back 8 px, then thrown on a bow
  (6% of the way, at most 20 px, the three fanned 10 px apart), speeding up
  into the hit. The cards are the projectile: a thrown Set sends no orbs and
  rings no board rings. They arrive one frame before the beat lands; on the
  landing's own commit (`Beat.landed`) the burst, the number, the HP bar and
  the foe's flinch all start together. The board
  keeps the scored card under the flying copy for a moment (`CardLeaving`), so
  the slot never blinks, and shows no per-card reward text in Adventure
  (`GameBoard` `quietRewards`).
- **A row can ask for a banner** (`banner: true`, used by `foe_defeated`): its
  words slam in across the middle of the board instead of popping where it
  landed.
- **The battle stage** (`AdventureRun.tsx` `STAGE`): the fighter and their
  hearts on the left, the foe on the right, as tall as the board can spare.
  Tall enough (`STAGE.roomy`), the words get their own row above the two of
  them, and that row keeps its room so the board never moves when the words
  change. Labels that land on the foe fan out to its left, level with the top
  of the stage.

### Timing

| | |
|---|---|
| A step of the chain | 3, 2 or 1 thirty-second notes of the band (about 190, 125 or 60 ms): slower for a chain of 4 or fewer, faster for 10 or more |
| A flight (the thrown cards, an orb) | about 240 ms, rounded to whole 32nd notes of the band (`flightFor`: 250 ms at 120 bpm), plus the wait for the band's next note |
| The Set's number | slams in from ×1.6 in 120 ms (`MS.feedback`, `EASE.enter`), holds still, lifts 12 px and fades in 119 ms (`exitMs(MS.quick)`, `EASE.exit`); reduced motion: no slam, no lift, same hold |
| The burst | ×0.7 on the frame of the hit, ×1.15 two frames later, settled by the sixth (`EASE.ui`) |
| A plain Set holds the clock for | about 0.4 s |
| The longest hold | about 2.2 s, however long the chain (after 14 steps the rest is text only) |
| A cut-in | until tapped |

## Checking it

- `npx jest __tests__/fightFx.test.tsx`: every event has a row that shows
  something and a matching sound cue; the catalog aims only at places the HUD
  has; picture and sound take the same steps; the hold is bounded; the engine
  reports positions; the stage holds and releases the clock; the cut-in.
- `/dev/fx`: a button for every event, a sample cascade, the cut-in with one
  and two evolutions, real time or 4× and 10× slower, effects on and off.
- In a dev build, `__nshapesFx.slow = 8` in the console plays a real fight's
  effects in slow motion.

## Limits worth knowing

- **Tuned on the web at phone size.** It has not been watched on a real phone;
  a long cascade on an old device may drop frames.
- **Always-on weapons have nothing to show.** A weapon that only adds to every
  Set (no event of its own) does not jump; its bonus is inside the Set's number.
- **Timed levels are a little easier with effects on,** because the clock waits
  about 0.4 s per Set and longer for a cascade (never for the foe's own timed
  moves). The balance bots do not model the wait.
- **The matched cards' reward tiles** (the "+1" tiles of the shared board) are
  unchanged.
