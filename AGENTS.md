# NShapes Workspace Rules

## Git Workflow: Always Commit, Push & Verify CI (CRITICAL)

- **Nothing in this repository is live in production.** The user iterates rapidly and expects completed changes to land on `origin/main` as soon as they are verified.
- **Always commit and push immediately** once local checks pass (`npm run verify:guardrails && npm run test:fast` — also enforced automatically on `git push` by `.githooks/pre-push`).
- **Never** leave finished work uncommitted in the working tree, and **never** stop to ask the user whether to commit or push.
- **Version bump on every commit:** Increment the patch version in `package.json` (`0.1.X` → `0.1.X+1`) and include `(v0.1.Y)` in the commit subject.
- **Verify GitHub Actions before finishing:** After `git push`, wait via the `schedule` tool (never shell `sleep`) and check `npm run verify:ci` until the workflow run for `HEAD` completes with `success` across both `build` and `deploy` (enforced by `.agents/hooks.json`).
- **Always report the shipped version** at the end of your response:
  ```
  ✓ Pushed version X.Y.Z
  ```

## Project Guardrails

- **Single weapon explainer (`WeaponExplainer.tsx`):** Every weapon description UI must reuse `src/adventure/components/WeaponExplainer.tsx`. Never build a second weapon description card. Register new Armory weapons in `src/adventure/data/weaponGuide.ts`, `src/adventure/data/weaponRoles.ts`, and `src/audio/voices.ts`.
- **One wide event per game (`fight_ended`):** Normal gameplay sends only `app_opened` (on session launch) and **one wide `fight_ended` event per finished round/fight** (staged on finish so `👍`/`👎` enjoyment ratings, feedback tags, and replay opens merge in place before commit/flush). Never emit per-move, per-card, or per-modal PostHog events.
- **Icons (`ICON_REGISTRY`):** Only use registered `IconName` keys defined in `src/components/Icon.tsx`. Verify with `npm run typecheck && npm run validate:icons`.
- **Data-driven Adventure Mode:** Content, levels, weapons, skills, evolutions, and Arcana belong in `src/adventure/data/*.ts`, not hardcoded in the engine.
- **Performance & Battery Guardrails:**
  - **React Compiler** is enabled for both Metro and Jest (`app.config.js` & `babel.config.js`).
  - **Frame loops (`useGuardedFrameCallback`):** Never import Reanimated's `useFrameCallback` directly. Use `src/hooks/useGuardedFrameCallback.ts` with a leading `'worklet';` directive and zero object/array/closure allocations inside the callback.
  - **Infinite Reanimated loops (`withRepeat(..., -1)`):** Only animate GPU-composited `transform`/`opacity`, gate on `useAppActive()`, and clean up with `cancelAnimation(...)`.
  - **Single lifecycle & audio gateways:** Never subscribe to `AppState`, `visibilitychange`, or `new AudioContext` outside `src/utils/appLifecycle.ts` and `src/audio/chip.ts`. Pair recurring `setInterval` timers with `useAppActive()` and `registerInterval(...)` from `src/utils/perfWatchdog.ts`.
  - **Verification gates:** Run `npm run verify:guardrails`, `npm run test:e2e:battery`, and `npm run test:e2e:layout`.
- **Motion loop (`motion-loop` skill):** Any animation, transition or fight-effect change follows `.agents/skills/motion-loop/SKILL.md`: capture frames before and after with `npm run motion:capture -- <shot> --label <before|r1>`, take numbers from `src/utils/motion.ts`, add a shot in `scripts/motion/shots.mjs` for any new animation, and record the review in `docs/motion/`. Never report a motion change as better without the before and after sheets. Sweeping many surfaces with sub-agents: `.agents/skills/motion-sweep/SKILL.md`.
- **Reference docs:** See [Claude.md](./Claude.md), [README.md](./README.md), [style_guide.md](./style_guide.md), and [docs/adventure-design.md](./docs/adventure-design.md) for full system specifications.
