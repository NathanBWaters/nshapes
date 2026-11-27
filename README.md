# NShapes

Spot 3-card Sets to fire explosive combos, parry boss attacks, and build screen-clearing critter loadouts in a fast pattern-matching roguelike.

Built for iOS, Android, and Web with Expo and React Native. Features **Adventure Mode** (a 5-world, 59-level campaign with 6 critter fighters, 64 Armory weapons, 208 evolutions, Arcana, skill trees, Camp, Training Lab, and battle history replays), **Starfall Summit** (roguelike Ascension climbs & Daily Seeds), and **Free Play** (Classic & Daily 3-Minute Score Attack).

- **Play Free in Browser:** https://nathanbwaters.github.io/nshapes/
- **Official DOJO Landing & Primer:** https://nathanbwaters.github.io/nshapes/dojo/ ([public/dojo/index.html](./public/dojo/index.html))
- **Community Discord:** https://discord.gg/JFkUmp54Sp

## Quick Start & Verification

```bash
npm install
npm run web                 # Start Expo web dev server
npm run build:web           # Export static web build
npm run verify:guardrails   # Typecheck, ESLint, icons, balance eras, store readiness, perf
npm run test:fast           # Run fast Jest test suite
npm test                    # Run full Jest test suite
npm run typecheck           # Run TypeScript check (tsc --noEmit)
npm run validate:icons      # Verify ICON_REGISTRY matches assets/icons SVG files
npm run lint                # Run ESLint
```

## Dev Studios

Open `/dev` in development mode for the one-click **Studio Hub**, or jump directly into any of the 7 live studios:

- `/dev/adventure` — Adventure campaign & fight studio (`?save=maxed`, `?save=fresh`, `?save=before:1-4`, `?level=2-4`, `?weapons=blast-powder,echo-stone`, `?seed=4242`, `?autoplay=true`)
- `/dev/summit` (alias `/dev/spire`) — Starfall Summit climbs, Ascension tiers, full-belt & evolution presets
- `/dev/fx` — Fight effects, cascades, hitstop, chiaroscuro flash, and evolution cut-in studio (`1× / 4× / 10×` slow-mo)
- `/dev/sound` — Adaptive music, 64 weapon voices, 208 evolution motifs & phone-speaker EQ studio
- `/dev/fighters` — Critter fighters, enemy rigs, wear-and-tear states, and interactive pet/poke studio
- `/dev/results` — Victory star stamps, unlock reveals, defeat screens, and cumulative damage story preview
- `/dev/analytics` — PostHog-compatible analytics, balance & enjoyment studio (`?source=local`, `?source=simulated`, `?source=import`)

## PR Clips, 15s Trailer & Human Playtesting

- **DOJO Landing Page:** [public/dojo/index.html](./public/dojo/index.html) & [public/dojo/styles.css](./public/dojo/styles.css)
- **OpenGraph Hero Card (`1200×630`):** Regenerate [public/og-hero.png](./public/og-hero.png) via `node scripts/store/generate-og-hero.mjs`
- **Combo-of-the-Day PR Clips (`pr:cascade`, `pr:parry`, `pr:rainbow`, `pr:boss-ko`):**
  ```bash
  # Capture 60fps frames + stitch vertical 720×1280 MP4 / WebM / GIF with 0.5× peak-hit slow-mo
  npm run pr:clip -- pr:cascade --slowmo-impact
  # Equivalent direct CLI:
  node scripts/motion/capture.mjs pr:cascade --clip --slowmo-impact
  ```
- **15-Second Zero-Logo Gameplay Trailer:** Blueprint in [docs/pr/trailer-shotlist.md](./docs/pr/trailer-shotlist.md) · Stitcher script in [scripts/pr/build-trailer.mjs](./scripts/pr/build-trailer.mjs)
- **10-Person Silent First-Timer Playtest Kit (Sakurai Ep. #246):** Protocol in [docs/playtest/silent-first-timer-protocol.md](./docs/playtest/silent-first-timer-protocol.md) · Printable sheet & triage scorecard in [docs/playtest/observation-sheet.md](./docs/playtest/observation-sheet.md)

## Fast-Iteration Git Policy

Nothing in this repository is live in production, so fast iteration takes priority. Whenever a task or fix is verified:

1. Increment the patch version in [package.json](./package.json) (`0.1.X` → `0.1.X+1`).
2. Commit the verified changes (include `(v0.1.Y)` in the commit subject).
3. Push to `origin/main` immediately—do not leave completed work uncommitted or wait to be asked to push.

## Documentation

- [AGENTS.md](./AGENTS.md) — Agent workflow & mandatory auto-commit/push rules
- [Claude.md](./Claude.md) — Architecture, game mechanics, testing, and rules
- [style_guide.md](./style_guide.md) — Visual design system and palette
- [docs/](./docs/) — Adventure design, sound design, FX design, PR shotlist, playtest kit, and balance docs
