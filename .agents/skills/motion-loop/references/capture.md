# Capture: seeing an animation frame by frame

The tools live in `scripts/motion/` and need nothing beyond the repo's own Playwright. They drive the **web build** of the game, where every animation is the same Reanimated code that runs on a phone.

## Before you start

The web dev server must be running:

- Claude Code: `preview_start` with the `nshapes-web` entry of `.claude/launch.json` (port 8099).
- Anyone else: `npx expo start --web --port 8099` in a terminal that stays open.
- Another port or worktree: add `--base http://localhost:PORT` to every command, or set `MOTION_BASE_URL`.

The first capture after a server start waits for the bundle (up to a minute). Later ones take 10–40 seconds.

## The commands

```bash
npm run motion:shots                                  # list every shot
npm run motion:capture -- <shot> --label before       # capture → motion-out/<shot>/before/
npm run motion:sheet -- <dir> --from 10 --to 25       # a strip of exactly these frames
npm run motion:sheet -- --compare <dirA> <dirB>       # the same frames of two captures, A above B
npm run motion:analyze -- <dir>                       # re-run the numbers on an existing capture
npm run motion:flipbook -- <dirA> <dirB> --out x.html # for a person: the two captures as films, side by side
```

The sheets are for you, who cannot watch. The flipbook is for the person who can: one self-contained HTML page where each capture plays (pause, slow motion, scrub), two captures of a shot side by side. Make one when you hand work to a human: `--pair "Title|before|after"` can be repeated to put several surfaces on one page.

Options of `motion:capture`:

| Option | What it does |
|--------|--------------|
| `--label <name>` | Folder name of this capture: `before`, `r1`, `r2`, `reduced`. Default `run`. |
| `--twice` | Capture a second time and compare. Says `repeatable` or `NOT repeatable` in the report. Use it on the baseline. |
| `--reduced` | Capture with `prefers-reduced-motion: reduce`. (The in-game Effects switch is a separate thing: a shot can flip it, e.g. `fx-hit-effects-off`, `foe-hit-quiet`.) Beware what it shows: with this setting Reanimated jumps every animation straight to its last frame, so anything that ends invisible (a number that fades out, a label that leaves) is never seen at all. A reduced capture with one changed frame is usually that bug, not a pass. Give what must be read its own short fade with `reduceMotion: ReduceMotion.Never`, or a plain timed hold. |
| `--frames N` | Exactly N frames. Default: until the picture has been still for 18 frames, or `--max` (240). Give it when something happens after a pause (new cards dealt half a second after the old ones leave): the capture would stop in the pause. |
| `--step 8` | Half frames, for a very fast move. `--step 32` to cover a long sequence cheaply. |
| `--dpr 2` | Sharper frames for looking closely at small things. Four times the pixels. |
| `--preroll N` | Frames taken before the trigger (default 8). They measure the ambient motion. |
| `--no-seed` | Leave `Math.random` alone (it is seeded by default so particles repeat). |

`motion:sheet` crops with `--roi`: `auto` (where pixels changed), `full`, a **test id** (`--roi results-stars`: the box that part of the screen covered during the capture, the easy way to get the crop you meant), or `x,y,w,h` in image pixels.
| `--headed` | Show the browser window. |

## What a capture gives you

In `motion-out/<shot>/<label>/` (never committed):

| File | Read it for |
|------|-------------|
| `report.md` | The timeline as a text graph, first and last change, dead stretches, every element that moved with its curve, start frame and size, and the hints. Printed by the command too. **Read this first.** |
| `contact.png` | Up to 24 frames spread over the effect, whole screen. The storyboard. |
| `strip.png` | 16 consecutive frames from the first change, cropped to where things move. |
| `frames/f012.png` | Any single frame at full size. `p003.png` is 3 frames before the trigger. |
| `analysis.json`, `capture.json` | Everything, for when the report's top 16 is not enough. |

Reading the report's mover lines:

```
3× fx-stage›div 41×41 — scale ×1→×4 in 17f/272ms, ease-out · opacity 0→0.97→0 in 17f/272ms — starts f7 f10 f13
```

Three elements of that size do the same thing; their starts are 3 frames apart (the stagger). `#name` is an element's own test id, `name›div` is a child of that test id, quoted text is what the element says.

Images cost context. Read `report.md`, then one contact sheet and one strip. Make extra strips only where the report or the contact sheet points.

## How it stays exact

The page never sees a real clock. Before the app boots, `Date`, timers, `performance.now` and `requestAnimationFrame` are replaced by a virtual clock that only moves when the capture moves it: 16 ms at a time while a shot waits for a screen, then one step per frame. The audio clock follows it (the fight's pictures wait for the band's next note, so the note must fall on the same frame every time). Random numbers are seeded, one stream per place in the code that asks. CSS animations are held and moved by hand. So frame 12 is the same picture on a fast or a slow machine, and a before/after pair shows the change you made and nothing else.

What this means for you:

- **Frame numbers are real.** `f12` is 192 ms after the trigger, always.
- **Edges of scaling things can differ by a few pixels** from run to run (the browser re-rasters when it likes). `--twice` allows for that and also compares the measured positions, which do not depend on it.
- **`NOT fully repeatable` names who differed.** If the list is only idle creatures (`adventure-run-fighter…`) or particles, the effect itself is repeatable: carry on, and compare by the report's numbers rather than pixel for pixel. If the effect's own parts are listed, that is a finding: something in it reads a real clock, the audio clock or unseeded randomness. Note it in the review.

## Shots

A shot says how to reach a moment and what starts it. Shots live in `scripts/motion/shots/`, one file per part of the game (`fx`, `fight`, `board`, `creatures`, `results`, `screens`), so two people adding shots do not collide. `scripts/motion/shot-kit.mjs` has the building blocks (`studio`, `intoFight`, `openPreview`, `thirdCard`, `findCards`); the header of `scripts/motion/shots.mjs` is the reference for the format. The shape:

```js
'preview-open': {
  id: 'preview-open',
  about: 'The level preview opens from the map (1-5)',
  path: '/dev/adventure?save=before:1-5&intro=false',   // dev routes jump anywhere: Claude.md "Dev Testing"
  ready: (page, h) => h.until('map-play-next'),          // wait for the screen
  prepare: async (page, h) => { /* click through to just before the moment */ },
  trigger: (page, h) => h.tap('map-play-next'),          // frame 0 is taken right after this
  clip: 'some-test-id',                                  // optional: capture only this box
  frames: 120,                                           // optional: fixed length
  actions: [{ at: 60, do: (page, h) => h.tap('close') }],// optional: do something on frame 60
},
```

Helpers (`h`):

| Helper | Use |
|--------|-----|
| `h.until(target)` | Wait for a test id, a CSS selector or an async function to be true, moving time only as needed |
| `h.tap(target)` | Click a test id or selector |
| `h.go(target)` | `until` then `tap` |
| `h.advance(ms)` | Move time by hand (let an entrance finish before the trigger) |
| `h.present(target)` | Is it on screen right now? |
| `h.evaluate(fn)` | Run code in the page: `window.__nshapesRun` is the live fight (board, attributes, status) |

Rules for shots:

- **Never use Playwright's own waits** (`waitFor`, `waitForTimeout`, `expect(...).toBeVisible`) inside a shot. Time stands still, so a screen that needs a timer would never arrive. Use `h.until`.
- **A missing test id is a one-line fix:** add `testID="..."` to the component. Test ids are part of making a surface reviewable.
- **Frame 0 is right after the trigger.** If the moment starts by itself (a screen arriving), make the trigger an empty function and let `prepare` stop one step before it.
- **Leave the screen at rest before the trigger** (`h.advance(400)`), or the entrance you did not mean to capture pollutes the frames.
- **Every fight event has a shot already:** `fx:<event>` plays it in the effects studio (`/dev/fx`). Use a real-fight shot (`fight-set`, `fight-miss`, `fight-open`, `fight-win`) to see it in context, with the board, the HUD and the creatures reacting.
- **Clip to the subject.** Idle creatures change a few thousand pixels every frame. On a whole-screen shot that noise hides small moves from the timeline (a card lifting is a few hundred pixels) and fills the report with breathing. `clip: 'game-board'` (see `board-set`, `fight-pick`) measures only what is inside the box.
- **A shot that starts in the middle of something** (the frame a foe goes down, with the last hit still playing) has no quiet moment before it, so the capture cannot learn what "still" looks like and the report says nothing changed. Give the shot `ambient: 0` (or the number of pixels per frame that should count as still), or better, start it on a quiet frame.
- **A capture label ending in `+` was taken with uncommitted changes** (`@1a79299+`): the sheet shows the commit it was built on, not the code under test. Label your captures (`before`, `r1`) so the folder name says what they are.
- **Compare like with like.** A compare sheet lines two captures up by frame number, so both must be the same shot. If you change the shot (a different starting point), capture the baseline again with the new shot (`git stash`, capture, `git stash pop`).
- **Endless loops** (an idle creature, a bobbing node): give the shot `frames` and `loop: { frames: N }` with the loop's length in frames; the report then checks the seam.
- **Add the shot in the same change as the animation.** A surface with no shot cannot be reviewed by the next agent.

Useful places to start a shot (all from Claude.md "Dev Testing" and the inventories in `docs/motion/inventory/`):

| Moment | Route and steps |
|--------|-----------------|
| Any fight event alone | `/dev/fx` → `fx-event-<type>`, `fx-cascade`, `fx-evolution` |
| A real fight | `/dev/adventure?save=before:1-5&intro=false` → `map-play-next` → `preview-play` → `card-slot-<row>-<col>` |
| A new player's first minute | `/dev/adventure?save=fresh` → `story-next` / `story-skip` |
| Results and unlocks | `/dev/adventure?save=before:1-4&autoplay=true` → play → `unlock-modal`, `results-*` |
| Camp, skill trees | `/dev/adventure?save=maxed&intro=false` → `map-dock-camp` → `camp-tab-<id>` |
| Creatures alone | `/dev/fighters` |
| Main menu | `/` |

## When something goes wrong

| Symptom | Cause and fix |
|---------|---------------|
| `Could not open http://localhost:8099…` | The dev server is not running, or is on another port (`--base`). |
| `Timed out … waiting for [data-testid="x"]` | Wrong route or test id. Open `stuck.png` in the capture folder: it shows what the screen looked like. |
| Report says `NO-CHANGE` | The trigger did nothing visible in the clip. Wrong trigger, wrong clip, or Effects are off. |
| Capture never stops (hits the frame limit) | Ambient motion (an idle creature) keeps the picture changing. Pass `--frames N`. |
| Everything is a blur of hints | Clip to the part you are reviewing (`clip`), or read the strip: hints are leads, not verdicts. |
| An element you care about is missing from the report | It is not moved by an inline transform or opacity (an SVG part, a canvas). Add its selector to the shot's `track`, or judge it on the strip. |
| Frames look right but the game on a phone does not | The capture is the web build. Native-only differences (haptics, native driver) need a device; say so in the review. |

## Sound

The capture is silent (the browser is muted), so sound is checked by timing, not by ear. In a dev build the band writes every cue it schedules to `window.__nshapesCueLog` as `{ name, t }`, where `t` is the moment the cue will be heard on the page's own clock (`performance.now()` plus the delay until its audio time). The capture reads that log and the report gets a **Sound cues** section: each cue with the frame it lands on. Compare that frame with the frame its picture lands on (the mover lines above it). A surface whose sounds do not go through the band shows no cues: add the same one-line log where it schedules them. In a fight, `useFightFx` hands each stretch of beats to the band through `onSegment`; each beat has `at` (when it starts) and `land` (when it reaches its target). A cue belongs on `land`, or one frame after, never on `at` when the picture needs 15 frames to arrive.
