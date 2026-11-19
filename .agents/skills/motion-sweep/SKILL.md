---
name: motion-sweep
description: Use when asked to improve, audit or polish NShapes animations across the whole game or a whole area, to run the motion loop over many surfaces, to work on motion unattended or overnight, or to direct sub-agents doing animation work.
---

# Motion sweep

## Overview

One director, many loops. The director does not animate. It picks surfaces from the ledger, hands each one to a sub-agent with a brief, **reads the before and after frames itself**, and lands only what the frames prove. Each sub-agent runs the `motion-loop` skill on one surface.

**REQUIRED SUB-SKILL:** `motion-loop` (`.agents/skills/motion-loop/SKILL.md`). Everything about how one surface is captured, judged and changed is there. This skill is only about running many of them.

Effort and direction substitute for each other: a precise brief lets a cheaper, faster model do the surface loop well. Spend the strongest model on choosing, briefing and reviewing.

## The sweep

| # | Step | Do |
|---|------|----|
| 1 | **Read the ledger** | `docs/motion/ledger.md`: every surface, its priority, problems, shot, status and scores. Work top priority first: what is seen on every Set outranks what is seen once. If an area's code has changed a lot since its audit, re-audit it first ([lane-brief.md](references/lane-brief.md), "Audit"). |
| 2 | **Set up lanes** | One git worktree and one dev server per lane. Never two writers in one tree. Never work in a checkout someone else is editing. ([lane-brief.md](references/lane-brief.md), "Lanes") |
| 3 | **Dispatch** | One sub-agent per surface (or per small cluster of surfaces that share files). Give it the lane brief, filled in. Lanes running at the same time must not touch the same files: when two surfaces share a file, run them one after the other in the same lane. |
| 4 | **Review** | When a lane reports, open its compare sheet and its last `report.md` yourself. Apply the gate below. Send rejections back to the same agent as notes in frames. |
| 5 | **Land** | Bring the lane's commit onto the integration branch. Run `npm run verify:guardrails && npm run test:fast` (and the e2e layout and battery specs if screens or loops changed). Bump the version, commit, push, confirm CI is green: the repo's rules, every time. |
| 6 | **Record** | Ledger row: status, scores before → after, version. The review file stays with the surface. New defaults you caught go on the banned list; new numbers go in the tokens file. |
| 7 | **Again** | Next surfaces. Stop when the ledger's P1 and P2 rows are done, or when told to. |

Land in small batches. One push per two or three surfaces keeps CI readable and makes a bad change easy to find.

## The review gate

Reject a lane's work, with the reason, when any of these is true:

- No before and after captures, or you have not looked at them.
- Every score is 8 or more after one round. (It graded its intentions.)
- The after `report.md` still has a hint the lane did not explain.
- A score went down and the report does not say so.
- No reduced-motion capture.
- The change adds a second version of something that exists (a second laser, a second weapon card, a new timing literal where a token fits).
- The diff touches files the surface does not own.
- Checks were not run, or failed.
- The before/after sheet does not look better **to you**. The lane's opinion is a report, not proof.

A rejection is a note: what it reads as, the frame, the exact change. The same agent fixes it (it has the context).

## Red flags for the director

| Thought | What is true |
|---------|--------------|
| "The lane says all scores are 9, land it" | Open the sheet. A report is not the frames. |
| "I'll fix this one myself, it's quicker" | Then nobody reviews it. Send the note back, or run the loop properly yourself. |
| "Run all the P1s in parallel" | Half of them share `visuals.tsx`. Check file ownership first. |
| "One big push at the end" | One red CI run then hides which of twelve changes broke it. |
| "The skill didn't cover this, I'll tell the agent" | Tell the agent and fix the skill. The next sweep starts from the files, not from this conversation. |
| "Good enough, it's late" | Then say exactly which surfaces are done, which are not, and what each still scores. |

## What to report at the end

Per surface: scores before → after, what changed in one line, the shot name so anyone can look, what is still under 8 and why. Then: what the sweep taught the skill (new banned defaults, new tokens, new shots, tool fixes), and the next surfaces in ledger order.
