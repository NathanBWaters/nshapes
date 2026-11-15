# NShapes

A SET-inspired roguelike deckbuilding match-three puzzle game for iOS, Android, and Web, built with Expo and React Native. Features **Adventure Mode** (a 5-world map campaign with fighters, weapons, evolutions, Arcana, skill trees, Camp, and battle history replays) and **Free Play**.

## Quick Start & Verification

```bash
npm install
npm run web              # Start Expo web dev server
npm run build:web        # Export static web build
npm test                 # Run Jest test suite
npm run typecheck        # Run TypeScript check (tsc --noEmit)
npm run validate:icons   # Verify ICON_REGISTRY matches assets/icons SVG files
npm run lint             # Run ESLint
```

## Dev Studios

- `/dev/adventure` — Adventure map (`?save=maxed`, `?save=fresh`, `?save=before:1-4`, `?autoplay=true`)
- `/dev/play` — Free Play board with dev tools
- `/dev/fx` — Fight effects, cascades, and evolution cut-in studio
- `/dev/sound` — Adaptive music & weapon voice synthesizer studio
- `/dev/fighters` — Fighter animations and wear-and-tear preview
- `/dev/store` — Standalone weapon shop tester
- `/dev/analytics` — PostHog-compatible analytics, balance & enjoyment studio (`?source=local`, `?source=simulated`, `?source=import`)

## Fast-Iteration Git Policy

Nothing in this repository is live in production, so fast iteration takes priority. Whenever a task or fix is verified:

1. Increment the patch version in [package.json](./package.json) (`0.1.X` → `0.1.X+1`).
2. Commit the verified changes (include `(v0.1.Y)` in the commit subject).
3. Push to `origin/main` immediately—do not leave completed work uncommitted or wait to be asked to push.

## Documentation

- [AGENTS.md](./AGENTS.md) — Agent workflow & mandatory auto-commit/push rules
- [Claude.md](./Claude.md) — Architecture, game mechanics, testing, and rules
- [style_guide.md](./style_guide.md) — Visual design system and palette
- [docs/](./docs/) — Adventure design, sound design, FX design, and balance docs
