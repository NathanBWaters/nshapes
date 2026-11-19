---
name: motion-loop
description: Use when adding, changing, reviewing or polishing any animation, transition, effect, juice or game feel in NShapes (Reanimated, fight effects, creature rigs, screen changes, modals), when motion looks mid, robotic, flat, janky, cheap or AI-default, when a state change just pops with no transition, or before calling any motion work done.
---

# Motion loop

## Overview

You cannot watch a video and you cannot feel motion. You can read frames and you can read numbers. So motion work in this repo goes round one loop:

**capture the real animation frame by frame → read the frames and the measurements → write notes in frames, not feelings → decide in numbers → change the code → capture again.**

The first version of an animation is a draft. Two to four rounds is normal. The loop is the method, not a sign that something went wrong.

Two ideas carry everything else:

1. **You make what you decide; defaults fill in what you don't.** Every duration, curve, distance and order you leave open gets a default (300 ms, ease-in-out, fade and slide up, everything at once). Defaults are what make motion look like everybody else's.
2. **Judge the frames, not your intentions.** The author always thinks it works. The strip shows what the player gets.

## The rule that does not bend

```
NO MOTION CHANGE IS DONE UNTIL YOU HAVE READ ITS FRAMES, BEFORE AND AFTER.
```

Reading the code is not reading the frames. "The numbers look right" is not reading the frames. If a moment has no shot, write the shot (ten lines in `scripts/motion/shots.mjs`). If it truly cannot be captured (native only), say so in plain words in your report and say what you did instead. Never report a motion change as better without the before and after sheets.

## The loop

One **surface** at a time: one moment the player sees (a Set landing, a sheet opening, a foe taking a hit).

| # | Step | Do | Read |
|---|------|----|------|
| 0 | **Shot** | Find the surface's shot (`npm run motion:shots`) or add one. Dev server must be up. | [capture.md](references/capture.md) |
| 1 | **Baseline** | `npm run motion:capture -- <shot> --label before --twice`. Read `report.md`, then `contact.png`, then `strip.png`. | |
| 2 | **Critique** | As a harsh motion director, not the author: score the seven lines of the rubric, list the 3 worst defects, each with a frame number, the evidence and the exact change. | [critique.md](references/critique.md) |
| 3 | **Brief** | Before any code: the goal in one sentence, the key poses on a frame table, one hero, what waits, tokens for every curve and spring, what is banned, what reduced motion shows. For a hero moment write 3 different variants and pick one, saying why. | [brief.md](references/brief.md), [numbers.md](references/numbers.md) |
| 4 | **Build** | Smallest change that meets the brief. Numbers come from `src/utils/motion.ts`. Transform and opacity only. Follow the project's fight-effect, card and battery rules (Claude.md). | |
| 5 | **Capture again** | `npm run motion:capture -- <shot> --label r1`, then `npm run motion:sheet -- --compare motion-out/<shot>/before motion-out/<shot>/r1`. Check the brief's numbers against `report.md`. | |
| 6 | **Score again** | Same rubric, same harshness. Fix the 3 worst. Back to 5 (`r2`, `r3`). Stop when every score is 8 or more, or after 4 rounds: then say what is still under 8 and why. | |
| 7 | **Other paths** | `--reduced` capture (movement gone, meaning kept). Neighbours that share the code still look right. `npm run verify:guardrails && npm run test:fast`. | |
| 8 | **Log** | `docs/motion/reviews/<surface>.md`: rounds, scores, notes, final numbers. Update the surface's row in `docs/motion/ledger.md`. Then commit and push by the repo's rules. | |

Change one thing per round when you can. A round that changes five numbers teaches you nothing about any of them.

## Quick reference

```bash
npm run motion:shots                                   # every shot by name
npm run motion:capture -- fx:hit --label before        # frames + report + sheets into motion-out/fx-hit/before/
npm run motion:capture -- fx:hit --label r1 --twice    # --twice: capture again and check it is repeatable
npm run motion:capture -- fx:hit --label reduced --reduced
npm run motion:sheet -- motion-out/fx-hit/r1 --from 10 --to 25              # a strip of exactly these frames
npm run motion:sheet -- --compare motion-out/fx-hit/before motion-out/fx-hit/r1
```

- Dev server: `http://localhost:8099` by default (`.claude/launch.json` → `nshapes-web`, or `npx expo start --web --port 8099`). Another port: `--base http://localhost:PORT` or `MOTION_BASE_URL`.
- One frame is 16 ms. `f12` is 192 ms after the trigger. Say frames in notes.
- Tokens: `src/utils/motion.ts` (`MS`, `EASE`, `SPRING`, `STAGGER`, `SCALE`, `SQUASH`).
- Ledger of every surface and its scores: `docs/motion/ledger.md`. Reviews: `docs/motion/reviews/`.
- Running the loop over many surfaces with sub-agents: the `motion-sweep` skill.

## Red flags: stop and capture

| Thought | What is true |
|---------|--------------|
| "The code clearly does X, no need to capture" | The code said that last time too. Half the defects in the first audit were invisible in the code. |
| "It's a small tweak" | Small tweaks are 30 seconds to capture. Uncaptured tweaks are how effects drift out of sync. |
| "There is no shot for this" | Write it. A shot is the animation's test and the next agent's eyes. |
| "Every score is 8+ on the first round" | You graded your intentions. Read the strip again as a stranger. |
| "Make it pop / smoother / more premium / juicier" | An adjective is a blank cheque. Translate it to numbers ([critique.md](references/critique.md)). |
| "Add particles / glow / bounce so it feels better" | That is reaching for a default. First remove what competes; add only what has a cause. |
| "I'll handle reduced motion later" | Later is never. It is step 7 of this loop. |
| "The hint says LINEAR but it looks fine" | Then show the strip where it looks fine. Hints are leads, the strip is the verdict, in both directions. |
| "The report has no hints, so it is good" | No hints means no machine-detectable defect. Staging, rhythm and identity are yours to judge. |

## Common mistakes

- **Polishing the wrong thing.** Frequency first: what the player sees on every Set outranks what they see once. The ledger has the order.
- **One round and done.** Round 1 fixes what you expected. Rounds 2 and 3 fix what the frames showed you.
- **Rewriting instead of fixing.** Three notes per round. Pasting ten turns a fix into a rewrite and you lose what worked.
- **A second look for the same effect.** In fights, the same effect looks the same whoever caused it: change the catalog row or the shared piece, never fork one.
- **Slower when it should be clearer.** Feeling unclear is rarely fixed by more milliseconds. Fix order, hierarchy and the pause before the payoff.
- **Forgetting sound.** A cue lands on its picture's frame or one frame after, never before.

Where these practices come from: [sources.md](references/sources.md).
