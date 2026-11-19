# Lanes, the lane brief, and the audit

## Lanes

A lane is a worktree with its own dev server, so one agent's half-finished edit never breaks another's type check, and nobody's hot reload interrupts somebody else's capture.

```bash
# from the main checkout; sibling folders, not nested ones (a nested worktree is linted and bundled with its parent)
git fetch origin
git worktree add -b motion-lane-a ../nshapes-motion-a origin/main
cp -c -R node_modules ../nshapes-motion-a/node_modules        # macOS: an instant copy-on-write clone. Elsewhere: npm ci
(cd ../nshapes-motion-a && npx expo start --web --port 8102)   # one port per lane; Claude Code: add a launch.json entry and preview_start it
```

- Every motion command in that lane takes `--base http://localhost:8102`.
- A lane commits to its own branch and does not push. The director lands it.
- Before a lane starts its next surface: `git fetch origin && git reset --hard origin/main` (after its last commit has landed), so it builds on what the others shipped.
- When the sweep ends: stop the servers, `git worktree remove ../nshapes-motion-a`, delete the lane branches.

One integration worktree (or the main checkout, if nobody else is working in it) is where commits are brought together, checked and pushed.

## The lane brief

Fill in every bracket. A sub-agent knows only what this says.

```
You are improving one animation surface of the NShapes game by running the repo's motion loop.

WORKSPACE  Work only in [ABSOLUTE PATH OF THE LANE WORKTREE]. Its web dev server is already
           running at [http://localhost:PORT]: pass --base [http://localhost:PORT] to every
           motion command. Do not start or stop servers. Do not touch any other checkout.

SKILL      Read [LANE]/.agents/skills/motion-loop/SKILL.md and follow it exactly, including
           its references when it points to them. Read Claude.md for the project's rules.

SURFACE    [surface id] — [what the player sees, one line]. Seen: [constant | often | once].
           Ledger row and inventory entries: docs/motion/ledger.md, entries [ids] in
           docs/motion/inventory/[file].md (file and line of every animation involved).
           Shot: [shot name, or "none yet: write one in scripts/motion/shots/[area].mjs"].
           Known problems from the audit: [the 2-3 from the ledger. These are leads, not
           conclusions: the baseline capture decides.]

OWNS       You may edit: [files or folders], scripts/motion/shots/[area].mjs,
           docs/motion/reviews/[surface].md.
           Do NOT edit: [files other lanes are in right now], docs/motion/ledger.md (the
           director records the ledger: parallel lanes would collide in it; your scores
           go in the review file and your report). If the fix needs a file outside this
           list, stop and say so in your report instead of editing it.

DIRECTION  [Optional. What the director wants, in numbers and frames, if it has a view.
           Otherwise: "Yours to decide from the baseline."]

DONE WHEN  Every rubric score is 8 or more, or you have done 4 rounds. Reduced-motion capture
           taken. `npm run verify:guardrails && npm run test:fast -- --maxWorkers=4` pass
           (several lanes share the machine). Review written to docs/motion/reviews/[surface].md.
           One commit on this lane's branch (no push, no version bump: the director lands it).

REPORT     Reply with:
           1. Scores per round, as R/Rd/M/St/Rh/Id/Sy (before, r1, r2…).
           2. The notes of each round (what it read as, the frame, the change).
           3. The final numbers (tokens, durations, curves) and the files changed.
           4. The capture folders: before, each round, reduced; and the compare sheet's path.
           5. What is still under 8 and why. What you could not verify. Anything you found
              that belongs to another surface or another lane's files.
           6. Anything in the skill or the tools that was wrong, unclear or missing.
           Be exact and honest: the director will open the sheets.
```

Notes on briefing:

- **Give evidence, not your hypothesis.** If you say "the easing is wrong", you get an easing change whether or not that was the problem. Give the ledger's leads and let the baseline decide.
- **Name the files a lane owns.** It is the only thing that keeps parallel lanes apart.
- **Cluster by file, not by theme.** Surfaces that live in the same component go to one lane, one after the other.
- **Follow up in the same agent.** A rejection goes back to the agent that did the work, as notes in frames.
- **Give the director's taste as constraints, not as a design.** "The hit is the hero and these reactions are its support; nothing here may get slower" leaves the lane the decisions and still keeps four lanes pulling the same way.
- **One writer per shared file.** The ledger is the director's. Shots go in the lane's own area file. If two surfaces meet in one file (the HUD's bump of the foe and the foe's own squash), one lane owns the file and the other reports what it needs.

## Audit: making or refreshing the inventory

The ledger is built from an audit of every animation in the code (`docs/motion/inventory/`). Re-run it for an area when its code has moved on. Split by area so each auditor can be exhaustive; three areas cover the game: the fight (effects, HUD, board, cards), the Adventure screens outside the fight, and the shared components and creature rigs.

Ask each auditor (read-only) for one entry per distinct animation with: an id; file and line; what the player sees; the trigger; the mechanism; the exact current numbers; a class (feedback, move, panel entrance, hero reveal, exit, travel, impact, number pop, text swap, ambient loop, screen change, character acting, progress); what reduced motion does; how to reach it in the running web app with test ids; and smells from a fixed list (linear on position, fade only, everything at once, no exit, exit slower than entrance, duration out of band, bounce on opacity, magic numbers, two heroes, no anticipation or follow-through, layout properties animated, timer driven, dead time, loop seam, no motion where there should be some). Ask for a count of call sites found against call sites covered, and a ranked top twelve.

Then group the entries into surfaces (one capturable moment each), give each a priority by how often it is seen and how real its defect is, and write the ledger: one row per surface, every inventory entry in exactly one row.
