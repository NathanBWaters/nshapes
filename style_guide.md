# NShapes Art Direction & UI Style Guide: "Tactile Tabletop Storybook"

> **North Star:** Every screen, card, creature, icon, and menu in **NShapes** belongs to one cohesive world — a **Tactile Tabletop Storybook** where chunky inked woodland critters battle across hand-painted paper-cut dioramas and crisp, ultra-readable geometric puzzle cards sit on warm ivory cardstock.

---

## 1. Visual North Star & World Cohesion

Every element in NShapes follows four non-negotiable visual pillars:

1. **Warm Ivory Cardstock & Inked Outlines:** Interactive cards, buttons, and panels sit on warm ivory/canvas stock (`#FFFDF7` / `#FFFFFF`) over warm paper beige (`#F4EFEA`) or lantern-lit tabletop walnut-slate (`#322E2B`). Every interactive edge is framed by a confident Slate Charcoal ink stroke (`#383838` — `2px` on UI chrome, `3px` on cards and creatures).
2. **Tactile Tabletop Depth Ledges:** Buttons, hero cards, and interactive tiles use a physical bottom ledge (`borderBottomWidth: 3–5px`) that compresses cleanly on press instead of generic soft CSS blurs.
3. **Restrained Background, Luminous Gameplay:** Non-interactive scenery (map props, biome hills, distant ridges) is desaturated 35–45% relative to interactive nodes and battle cards so the player's eye locks immediately onto playable SETs, Parry telegraphs, and active fighters.
4. **Painted Light, Not Flat Material Fills:** Creatures, biome props, and battle stages share a consistent upper-left warm light source (`#FFFDF5` highlight) and cool bottom-right bounce shadow (`#1E293B`), anchored by directional elliptical grounding shadows.

---

## 2. Core Color Palette

### Tabletop Surface & Ink Tokens (`src/utils/colors.ts`)

| Token | Hex | Role & Usage |
|---|---|---|
| **Canvas White** (`canvasWhite`) | `#FFFFFF` | Active cards, crisp pop-out sheets, high-contrast light text |
| **Ivory Cardstock** (`ivoryCard`) | `#FFFDF7` | Storybook modals, hero cards, tabletop ledger surfaces |
| **Paper Beige** (`paperBeige`) | `#F4EFEA` | Default tabletop surface, inset panels, recessed trays |
| **Slate Charcoal** (`slateCharcoal`) | `#383838` | Primary ink strokes, body text, headers, button borders |
| **Deep Onyx** (`deepOnyx`) | `#121212` | High-contrast dark plates, cut-in overlays, silhouette audit fills |
| **Tabletop Walnut** (`walnutFrame`) | `#322E2B` | Evening tabletop backdrop for Camp, Bounties, and Summit hubs |
| **Walnut Surface** (`walnutSurface`) | `#3E3833` | Recessed trays and tool shelves inside lantern-lit dark hubs |

### Storybook Accents & WCAG-AA Interactive Surfaces

| Token | Hex | Contrast on `#FFFFFF` / Ink | Usage |
|---|---|---|---|
| **Action Yellow** (`actionYellow`) | `#FFDE00` | High vs `#383838` | Primary CTA buttons, Play/Continue hero cards, eyebrow banners, selection borders |
| **Deep Teal Surface** (`tealSurface`) | `#0F766E` | `5.47:1` with `#FFFFFF` | Secondary hero buttons (Starfall Summit), AA-compliant teal pills, upside callouts |
| **Logic Teal** (`logicTeal`) | `#16AA98` | Decorative / badge accent | Progress fills, positive indicators, mystic accents |
| **Crimson Surface** (`redSurface`) | `#DC2626` | `4.83:1` with `#FFFFFF` | Critical warnings, danger buttons, parry alerts |
| **Burnt Orange Surface** (`orangeSurface`) | `#C2410C` | `5.18:1` with `#FFFFFF` | Warning pills, ember accents, tradeoff highlights |
| **Impact Orange** (`impactOrange`) | `#FF9538` | Decorative / badge accent | Warm campfire glow, streak accents |
| **Impact Red** (`impactRed`) | `#FF7169` | Decorative / heart accent | Hearts, blush cheeks, hit callouts |

### Evening Card-Table Wing (Prism Deck — `src/prism/components/prismTheme.ts`)

Prism Deck harmonizes with the Tabletop Storybook language as an evening ink-teal felt wing:
- **Felt Backdrop:** `#102B26` (surface `#163A36`, elevated `#1E4942`, border `#385E56`)
- **Card Stock & Ink:** `#FFFDF7` ivory cards with `#383838` Storybook ink borders
- **Brass Accent:** `#FFDE00` / `#F2C94C` warm tabletop gold

---

## 3. Card Visual Identity (`src/utils/cardVisuals.ts`)

Cards are the core interactive puzzle piece. Their shape, color, and stock identity is scientifically calibrated for universal color-vision deficiency (CVD) legibility and grayscale luminance separation:

### Shapes (`24×30` SVG viewBox, `1.9` stroke, round joins, `-45°` diagonal hatch)
- **Circle** (`oval` slot): smooth symmetric convex ring (`r = 9.4`)
- **Triangle** (`diamond` slot): crisp straight-edge apex pointing up
- **Bolt** (`squiggle` slot): chunky 8-vertex diagonal lightning bolt

### Universal CVD-Safe Shape Colors
- **Orange / Tangerine** (`red` slot · badge `O`): `#DF5A00` on light/mist · `#FFAC24` on charcoal
- **Blue / Electric Sky** (`green` slot · badge `B`): `#007ED9` on light/mist · `#7CE4FF` on charcoal
- **Pink / Berry Rose** (`purple` slot · badge `P`): `#940E65` on light/mist · `#E6459E` on charcoal

### Card Stocks (5-Attribute Mode)
- **White** (`white`): `#FFFFFF`
- **Blueprint Mist** (`beige`): `#E2ECF7` with `#6489B8` cool blueprint ink border (maintains `>= 3.12:1` graphical contrast for all 3 colors)
- **Charcoal** (`charcoal`): `#383838` paired with luminous dark-card shape colors

---

## 4. Typography (`src/utils/fonts.ts`)

All typography flows through semantic font tokens in `src/utils/fonts.ts` (never raw `'monospace'`, which triggers missing-font warnings on iOS and fails `npm run validate:store`):

| Token | Web Stack | iOS | Android | Role |
|---|---|---|---|---|
| `DISPLAY_FONT` | `'Plus Jakarta Sans', 'Inter', system-ui` | `AvenirNext-Heavy` | `sans-serif-black` | Screen titles, world banners, victory callouts |
| `BODY_FONT` | `'Inter', system-ui, -apple-system` | `System` | `sans-serif` | Body copy, tooltips, weapon explainers, buttons |
| `MONO_FONT` | `'JetBrains Mono', ui-monospace, Menlo, monospace` | `Menlo` | `monospace` | Timers, damage math, tabular counters, Player IDs |

### Typography Scale & Legibility Floor

| Token | Size | Weight | Line Height | Usage |
|---|---|---|---|---|
| `caption` | `11px` | `700` | `1.25` | Hard minimum floor for all readable HUD badges & metadata |
| `body-sm` | `13px` | `500` | `1.4` | Secondary descriptions, tooltips |
| `body` | `15px` | `500` | `1.5` | Standard body text, weapon explainers |
| `h3` | `18px` | `800` | `1.3` | Section headers, modal titles |
| `h2` | `24px` | `900` | `1.2` | Screen subtitles, biome headers |
| `h1` | `32px` | `900` | `1.1` | Screen titles |
| `display` | `44px` | `900` | `1.0` | Hero title (`NSHAPES`), victory & boss callouts |

Use `fontVariant: ['tabular-nums']` alongside `MONO_FONT` for any live timer, HP readout, coin counter, or damage equation so digits never jitter horizontally.

---

## 5. Iconography & Zero Raw OS Emojis

- **Single Registry:** Every UI icon MUST use `<Icon name="..." />` backed by `ICON_REGISTRY` in `src/components/Icon.tsx`, validated by `npm run validate:icons`.
- **Zero Raw OS Emojis:** Never render raw OS pictographic emojis (`📊`, `⚔️`, `⚙️`, `🛠️`, `🔥`, `⚡`, `⚠`, `🎁`, `💥`, `🍀`, `🔗`, `⏱`, `⬆`, `✦`, etc.) in live UI components. Replace them with registered vector icons (`delapouite/chart`, `lorc/crossed-swords`, `lorc/gear-hammer`, `lorc/fireball`, `sbed/electric`, `lorc/laser-warning`, `delapouite/present`, `lorc/bright-explosion`, `lorc/clover`, `lorc/linked-rings`, `lorc/stopwatch`, `delapouite/upgrade`, `lorc/crystal-shine`).
- **Map Scenery:** World map backdrops use dedicated hand-crafted 2-tone SVG props in `src/adventure/components/BiomeScenery.tsx` rather than monochrome `lorc/` icon stamps.

---

## 6. Component Geometry & Elevation

### Border Radii (`RADIUS` in `src/utils/colors.ts`)
- **Buttons & Pills:** `6px` (or `999px` for status pills), `borderWidth: 2`, `borderBottomWidth: 3–4`
- **Cards & Modules:** `12px`, `borderWidth: 2–2.5`, `borderBottomWidth: 4–5`
- **Sheets & Top-Level Containers:** `18–24px`, `borderWidth: 2.5–3`

### Spacing Scale (8px Grid)

| Token | Value | Usage |
|---|---|---|
| `xs` | `4px` | Tight icon gaps, micro badges |
| `sm` | `8px` | Inner padding, chip gaps |
| `md` | `16px` | Standard panel padding, section gaps |
| `lg` | `24px` | Major card padding, group separation |
| `xl` | `32px` | Modal margins, screen-level breathing room |

### Tap Targets & Accessibility
- **Touch Targets:** Minimum `44×44px` interactive hit area (use `hitSlop` on compact chrome icons).
- **Contrast Minimums:** `>= 4.5:1` for text on buttons/surfaces; `>= 3.0:1` for graphical card symbols and UI boundaries.
- **Reduced Motion:** Honor `useReducedMotion()` and `useAppActive()` on every infinite loop; animate GPU-composited `transform` and `opacity` only.

---

## 7. Character Craft, 2-Tone Lighting & Silhouette Standards

### Overhead 2-Tone Directional Lighting
- Light falls from **upper-left** (`x1=0.15, y1=0.05` → `x2=0.85, y2=0.95`) using warm sunlit top highlights (`#FFFDF5`) and cool slate-indigo bounce shadows (`#1E293B`) via SVG `<LinearGradient>` definitions in `src/components/illustration/primitives.tsx` and each bespoke creature rig.
- Biome maps and battle stages use smooth vertical sky-to-horizon gradients with atmospheric perspective ridges so foreground silhouettes pop cleanly.

### Asymmetric 3/4 Combat Stances & Solid-Black Silhouette Test
- **Fighters face 3/4 right** toward the foe while keeping both eyes clearly readable to the camera; **combat foes face 3/4 left** toward the fighter.
- Every one of the 6 Fighters must remain instantly distinguishable when filled solid `#121212` black at both `36px` (compact battle stage) and `80px` (studio/boss stage), auditable via the **Silhouette Audit** toggle in `/dev/fighters` (`CritterGallery.tsx`):
  1. **Orange Tabby:** arched forward pounce, high S-curve striped tail counterbalancing left, raised swipe paw right.
  2. **Sly Fox:** low crouched horizontal rogue silhouette, sweeping oversized flame-tail far left, sharp triangular cheek ruffs.
  3. **Badger:** wide low-center-of-gravity brawler hunch, staggered raised boxing fists (lead guard right, rear uppercut cocked left).
  4. **Corgi:** elongated horizontal loaf-sprint stance, tall splayed radar ears tilted forward-right, fluffy rump nub-tail left, kicked-back paw.
  5. **Emperor Penguin:** tall slender regal column, tilted golden crown on top, mystic halo offset behind-left, casting flipper sweeping right.
  6. **Pelican:** lean coastal silhouette, oversized hooked golden bill + tangerine throat pouch jutting far right, swept-back coastal wings & 3-feather crest.

### Boss Scale Differential & Grounding Shadows (`CreatureStage.tsx`)
- Grounding shadows scale by `scaleTier` (`standard` / `elite` / `boss`): bosses project a wider, weightier dual-layer elliptical contact shadow (`0.74×` width, `0.145×` height) plus a subtle cool atmospheric rim halo behind them so huge foes read with real physical mass.

---

## 8. Motion & Audio Alignment

- **Motion Tokens:** All durations, springs, easing curves, hitstop holds, and monotonic `×0.7` combat shakes live in `src/utils/motion.ts` (never raw magic numbers). Every animation change follows the `motion-loop` before/after capture workflow.
- **Audio Gateway:** All sound effects and adaptive music route through `src/audio/` and `src/audio/chip.ts` (single `AudioContext` gateway, iOS-safe `.m4a` assets).
