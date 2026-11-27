# NShapes — 15-Second Zero-Logo Gameplay Trailer Shotlist (`[TP-07]`)

> **Sakurai Guiding Principles:** Ep. `#184` (*Show Us the Gameplay!*), Ep. `#012` (*Presentations Are About Pace*), and Ep. `#205` (*Playing Live in Front of People*).
> **Zero-Logo Cold Open Rule:** Frame 0 starts inside active live combat — no studio splash, no fade from black, no lore exposition. Viewers grasp *Spot 3-Card Set → Explosive Roguelike Payoff* inside the first 3.0 seconds.

---

## Visual Identity Lock (Live Build Alignment)

Every captured clip MUST match the live zero-SET-overlap visual identity (`src/utils/cardVisuals.ts`):

- **Shapes:** `Circle` · `Triangle` · `Chunky 8-Vertex Bolt`
- **Card Colors (CVD-Safe):** `Tangerine Orange (#DF5A00)` · `Electric Sky Blue (#007ED9)` · `Berry Pink (#940E65)`
- **Shadings:** `Solid` · `-45° Diagonal Hatch` · `Outlined`
- **Paper & Ink Storybook Frame:** Warm paper-cream (`#F4EFE6`), charcoal ink (`#2C2C2C`), Action Yellow (`#FFDE00`), Logic Teal (`#16AA98`)
- **Unified 1-Sentence Pitch:** *"Spot 3-card Sets to fire explosive combos, parry boss attacks, and build screen-clearing critter loadouts in a fast pattern-matching roguelike."*

---

## Frame-by-Frame 15-Second Master Shotlist (60 fps · 900 Frames Total)

| Timecode | Frames (60fps) | Dur | Beat | Shot / Source | On-Screen Action & Composition | Audio / SFX Beat |
|---|---:|---:|---|---|---|---|
| **0:00.0 – 0:03.0** | `f000–f179` | 3.0s | **Zero-Logo Visual Hook** | `pr:cascade` (live phone combat, Orange Tabby on `2-4`) | Cold open straight into live vertical board. Finger/cursor snaps 3 glowing cards (**1 Orange Circle · 2 Blue Hatched Triangles · 3 Pink Solid Bolts**) → cards whip into foe → **Blast Powder** 4-stage explosion chains 4 cards + **Prismatic Ray** laser → 48ms hitstop + chiaroscuro flash → **`+142` burst** & Orange Tabby cheers! | Dry `<2ms` `impactCrack` + `impactPunch` at `f024`, ascending combo chime, 136 BPM beat enters cleanly at `0:00.5` |
| **0:03.0 – 0:05.5** | `f180–f329` | 2.5s | **Beat 1: Perfect Counter-Parry** | `pr:parry` (`2-4` *Crimson Ambush* `ALL ORANGE` wind-up) | Foe winds up red telegraph banner (**`ALL ORANGE`**) into the final golden Perfect window → 3 **Tangerine Orange** cards snap in unison → **PERFECT PARRY!** golden shatter + **`2× STAGGER`** + screen roll shake. | Immediate `parryWarn` cue → crisp golden `perfectParry` brass stab + ducked bass drop |
| **0:05.5 – 0:08.5** | `f330–f509` | 3.0s | **Beat 2: Evolution Ignition & Rainbow Cascade** | `pr:rainbow` (`Emperor Penguin` + `Phoenix Pyre` / `Rainbow Nova`) | Catalyst / all-different **Rainbow Set** lands → **Phoenix Pyre** Evolution slash cut-in (`0.45s` crisp read) → `3×2` blast + **Deep Freeze** ice crystal sweep + `0.5×` peak-hit slow-mo hold (`--slowmo-impact`) as boss HP chunks down. | `evolve` riser synced to `90ms` blade flash → `blast` + crystalline penguin trill |
| **0:08.5 – 0:11.5** | `f510–f689` | 3.0s | **Beat 3: Boss Kill-Cam KO & Critter Montage** | `pr:boss-ko` (`1-10` *Shell Shock* `Iron Shell` Boss KO) + `/dev/fighters` rapid cuts | Lethal 3rd tap sends final trio into **Iron Shell** → **Clair-Obscur Kill-Cam** slow-mo shatter & golden slash → rapid `0.35s` flash-cuts showcasing all **6 Critters** (*Orange Tabby, Sly Fox, Badger, Emperor Penguin, Corgi, Pelican*) & the **5-World Map / Starfall Summit**. | `killCamRiser` → `slowMoDefeat` sub-drop + `killCamShatter` chime |
| **0:11.5 – 0:15.0** | `f690–f899` | 3.5s | **Title Card & Playable CTA** | `public/og-hero.png` (`1200×630` hero card) + Play CTA overlay | Hard cut on downbeat to high-contrast Storybook **`NSHAPES`** hero card (Orange Tabby + Circle/Triangle/Bolt starburst) + bottom bar: **`PLAY FREE IN BROWSER · nathanbwaters.github.io/nshapes/dojo/`** + QR code. | Final tonic Ionian `THEME` cadence + crisp coin sparkle tail; clean loop seam back to `0:00.0` |

---

## Reproducible Capture & Render Commands (`[TP-09]` Pipeline)

### 1. Start the Local Expo Web Server

```bash
npx expo start --web --port 8099
```

### 2. Capture All 4 Showcase Clips (60fps + 0.5× Impact Slow-Mo)

Using the `pr:clip` npm script (or direct `scripts/motion/capture.mjs` invocation):

```bash
# Beat 0 — Phoenix Pyre / Blast Powder Cascade (0:00–0:03)
npm run pr:clip -- pr:cascade --label trailer --clip --slowmo-impact

# Beat 1 — Perfect Orange Counter-Parry (0:03–0:05.5)
npm run pr:clip -- pr:parry --label trailer --clip --slowmo-impact

# Beat 2 — Rainbow Nova Sweep (0:05.5–0:08.5)
npm run pr:clip -- pr:rainbow --label trailer --clip --slowmo-impact

# Beat 3 — Boss Kill-Cam Knockout (0:08.5–0:11.5)
npm run pr:clip -- pr:boss-ko --label trailer --clip --slowmo-impact
```

*(Direct equivalent without npm wrapper: `node scripts/motion/capture.mjs pr:cascade --label trailer --clip --slowmo-impact`.)*

### 3. Stitch Master 15s Trailer MP4 & Muted WebM Loop

Ensure `ffmpeg` is installed (`brew install ffmpeg` on macOS), then run:

```bash
# Preview the exact 15s ffmpeg timeline & filtergraph without encoding
node scripts/pr/build-trailer.mjs --dry-run

# Render master 15s vertical trailer + muted autoplay WebM loop
node scripts/pr/build-trailer.mjs --label trailer
```

Outputs:
- `public/media/gameplay-trailer-15s.mp4` — Master 60fps H.264 (`720×1280` vertical 9:16, `yuv420p`, `+faststart`)
- `public/media/gameplay-loop.webm` — Compressed muted-loop VP9 WebM (`0:00–0:10` gameplay hook for DOJO hero & README)

---

## Deliverable Aspect Ratios & Platform Specs

| Target Platform | Aspect | Resolution | Notes |
|---|---|---|---|
| **YouTube Shorts / TikTok / Reels** | `9:16` | `720×1280` (or `1080×1920`) | Default `build-trailer.mjs` output; matches portrait mobile gameplay natively with zero crop loss. |
| **X / Bluesky / Reddit / Discord** | `1:1` or `9:16` | `1080×1080` or `720×1280` | Pass `--aspect square` (`1080×1080` on `#F4EFE6` paper frame with side callout badges). |
| **DOJO Hero / Storefront Preview** | `9:16` muted loop | `540×960` WebM (`< 2.5 MB`) | Autoplays muted above the fold; loops seamlessly from Beat 0 → Beat 2. |

---

## Pre-Publish Quality Gate Checklist

- [ ] Frame `0` opens on live moving gameplay (zero logo/fade-in delay).
- [ ] All 3 shapes (**Circle / Triangle / Bolt**) and all 3 colors (**Orange / Blue / Pink**) are crisp and legible on a 5-inch phone screen at 50% brightness.
- [ ] Every impact beat (`Blast Powder`, `Perfect Parry`, `Phoenix Pyre`, `Boss Kill-Cam`) shows clear anticipation → hitstop → release.
- [ ] End card displays `"NShapes"`, unified elevator pitch, and playable URL for at least `3.0s`.
- [ ] Verified with sound OFF (captions/popups carry 100% of the story) and sound ON (phone speaker check, zero distortion).
