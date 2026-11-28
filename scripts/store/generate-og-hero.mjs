#!/usr/bin/env node
/**
 * Reproducibly renders the 1200×630 NShapes OpenGraph & social hero card
 * (`public/og-hero.png`) in NShapes' Storybook high-contrast palette:
 *   - Warm paper-cream canvas (#F4EFE6) + charcoal ink (#2C2C2C)
 *   - Orange Tabby fighter hero (authentic OrangeTabbyRig vector geometry)
 *   - Starburst of 3 glowing all-different Set cards using the verified
 *     Circle / Triangle / Bolt × Tangerine Orange (#DF5A00) / Electric Sky Blue
 *     (#007ED9) / Berry Pink (#940E65) visual identity
 *   - Bold NShapes wordmark, unified tagline, and crisp opaque RGB PNG output
 *
 * Usage: node scripts/store/generate-og-hero.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const ROOT = process.cwd();
const OUT_PATH = 'public/og-hero.png';
const WIDTH = 1200;
const HEIGHT = 630;

// Verified zero-SET-overlap card palette & geometry (matching src/utils/cardVisuals.ts)
const COLOR_ORANGE = '#DF5A00';
const COLOR_BLUE = '#007ED9';
const COLOR_PINK = '#940E65';
const BOLT_POINTS_24x30 = '14.8,1.8 12.5,11.8 22.4,9.2 9.2,28.2 11.5,18.2 1.6,20.8';
const TRIANGLE_POINTS_24x30 = '12,2.2 22,26.8 2,26.8';

// Storybook UI palette
const PAPER_CREAM = '#F4EFE6';
const INK = '#2C2C2C';
const ACTION_YELLOW = '#FFDE00';
const LOGIC_TEAL = '#16AA98';
const TABBY_ORANGE = '#FF9538';
const TABBY_STRIPE = '#C2410C';
const TABBY_CREAM = '#FFF7ED';
const NOSE_PINK = '#FF7169';

function buildStarburstPolygon(cx, cy, outerR, innerR, points = 18) {
  const coords = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (Math.PI * i) / points - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    coords.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return coords.join(' ');
}

function buildOrangeTabbySvg({ x, y, scale = 2.45 }) {
  // Faithful vector hero pose derived from src/components/fighters/creatures/OrangeTabbyRig.tsx
  return `
    <g transform="translate(${x} ${y}) scale(${scale})" filter="url(#heroShadow)">
      <!-- Grounded oval shadow beneath tabby -->
      <ellipse cx="50" cy="91" rx="28" ry="6" fill="rgba(44, 44, 44, 0.2)" />

      <!-- 1. Striped Curling Tail -->
      <path
        d="M 68 80 C 84 79, 93 66, 89 50 C 87 42, 79 41, 78 48 C 77 54, 83 56, 83 63 C 83 70, 75 74, 67 75 Z"
        fill="${TABBY_ORANGE}"
        stroke="${INK}"
        stroke-width="3.2"
        stroke-linejoin="round"
      />
      <path d="M 82 69 L 88 67" stroke="${TABBY_STRIPE}" stroke-width="2.8" stroke-linecap="round" />
      <path d="M 84 58 L 90 56" stroke="${TABBY_STRIPE}" stroke-width="2.8" stroke-linecap="round" />

      <!-- 2. Plump Sitting Body + Teal Collar & Gold Bell -->
      <path
        d="M 31 58 C 25 69, 26 86, 36 89 L 64 89 C 74 86, 75 69, 69 58 Z"
        fill="${TABBY_ORANGE}"
        stroke="${INK}"
        stroke-width="3.3"
        stroke-linejoin="round"
      />
      <ellipse cx="50" cy="76" rx="12.5" ry="10.5" fill="${TABBY_CREAM}" />
      <path d="M 29 70 L 35 71 M 28 77 L 35 77" stroke="${TABBY_STRIPE}" stroke-width="2.6" stroke-linecap="round" />
      <path d="M 71 70 L 65 71 M 72 77 L 65 77" stroke="${TABBY_STRIPE}" stroke-width="2.6" stroke-linecap="round" />
      <path d="M 34 61 Q 50 67 66 61" stroke="${LOGIC_TEAL}" stroke-width="5.2" stroke-linecap="round" fill="none" />
      <path d="M 34 61 Q 50 67 66 61" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" fill="none" />
      <circle cx="50" cy="66.5" r="4.2" fill="${ACTION_YELLOW}" stroke="${INK}" stroke-width="2.2" />
      <circle cx="50" cy="67.5" r="1.1" fill="${INK}" />

      <!-- 3. Left Ear -->
      <path d="M 24 35 L 20 12 L 41 25 Z" fill="${TABBY_ORANGE}" stroke="${INK}" stroke-width="3.3" stroke-linejoin="round" />
      <polygon points="25,31 23,17 36,25" fill="${NOSE_PINK}" />

      <!-- 4. Right Ear -->
      <path d="M 76 35 L 80 12 L 59 25 Z" fill="${TABBY_ORANGE}" stroke="${INK}" stroke-width="3.3" stroke-linejoin="round" />
      <polygon points="75,31 77,17 64,25" fill="${NOSE_PINK}" />

      <!-- 5. Expressive Tabby Head & Whiskers -->
      <path
        d="M 24 45 C 24 27, 36 22, 50 22 C 64 22, 76 27, 76 45 C 77 56, 65 63, 50 63 C 35 63, 23 56, 24 45 Z"
        fill="${TABBY_ORANGE}"
        stroke="${INK}"
        stroke-width="3.3"
        stroke-linejoin="round"
      />
      <path d="M 43 24 L 45 31 M 50 23 L 50 32 M 57 24 L 55 31" stroke="${TABBY_STRIPE}" stroke-width="2.8" stroke-linecap="round" />
      <ellipse cx="50" cy="52.5" rx="12.5" ry="7.5" fill="${TABBY_CREAM}" />
      <g stroke="${INK}" stroke-width="2.1" stroke-linecap="round">
        <line x1="17" y1="46" x2="28" y2="48" />
        <line x1="16" y1="52" x2="28" y2="52" />
        <line x1="83" y1="46" x2="72" y2="48" />
        <line x1="84" y1="52" x2="72" y2="52" />
      </g>

      <!-- Starry confident eyes looking toward the glowing cards -->
      <circle cx="39.5" cy="42.5" r="4.8" fill="${INK}" />
      <circle cx="41.1" cy="40.9" r="1.7" fill="#FFFFFF" />
      <circle cx="38.2" cy="44.3" r="0.9" fill="#FFFFFF" />
      <circle cx="62.5" cy="42.5" r="4.8" fill="${INK}" />
      <circle cx="64.1" cy="40.9" r="1.7" fill="#FFFFFF" />
      <circle cx="61.2" cy="44.3" r="0.9" fill="#FFFFFF" />

      <!-- Pink nose + triumphant cheerful meow grin -->
      <polygon points="46.8,48.5 53.2,48.5 50,52.2" fill="${NOSE_PINK}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" />
      <path d="M 44.5 53 Q 50 61.5 55.5 53 Z" fill="${NOSE_PINK}" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round" />

      <!-- 6. Raised Cheering Paws with pink toe-beans -->
      <ellipse cx="25" cy="60" rx="6.5" ry="5.5" fill="${TABBY_CREAM}" stroke="${INK}" stroke-width="2.8" />
      <circle cx="25" cy="60.5" r="2" fill="${NOSE_PINK}" />
      <ellipse cx="75" cy="59" rx="6.5" ry="5.5" fill="${TABBY_CREAM}" stroke="${INK}" stroke-width="2.8" />
      <circle cx="75" cy="59.5" r="2" fill="${NOSE_PINK}" />
    </g>
  `;
}

export function buildOgHeroHtml() {
  const burstOuter = buildStarburstPolygon(365, 295, 250, 152, 16);
  const burstInner = buildStarburstPolygon(365, 295, 198, 126, 16);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body {
    margin: 0;
    padding: 0;
    width: ${WIDTH}px;
    height: ${HEIGHT}px;
    overflow: hidden;
    background: ${PAPER_CREAM};
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <!-- Warm Storybook Paper Gradient -->
    <radialGradient id="paperBg" cx="32%" cy="46%" r="76%">
      <stop offset="0%" stop-color="#FFFDF8" />
      <stop offset="56%" stop-color="${PAPER_CREAM}" />
      <stop offset="100%" stop-color="#E5DAC6" />
    </radialGradient>

    <!-- Explosive golden-orange halo behind cards -->
    <radialGradient id="comboGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#FFDE00" stop-opacity="0.88" />
      <stop offset="48%" stop-color="#FF9538" stop-opacity="0.34" />
      <stop offset="100%" stop-color="#FF9538" stop-opacity="0" />
    </radialGradient>

    <!-- Halftone paper dot pattern for subtle storybook texture -->
    <pattern id="paperDots" width="18" height="18" patternUnits="userSpaceOnUse">
      <circle cx="2" cy="2" r="1.2" fill="rgba(44, 44, 44, 0.06)" />
    </pattern>

    <!-- -45° diagonal hatch for Electric Sky Blue Triangles card -->
    <pattern id="blueHatch" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)">
      <rect x="0" y="0" width="5" height="2.5" fill="${COLOR_BLUE}" />
    </pattern>

    <filter id="cardShadow" x="-18%" y="-18%" width="142%" height="146%">
      <feDropShadow dx="0" dy="10" stdDeviation="10" flood-color="#1E1B16" flood-opacity="0.28" />
    </filter>
    <filter id="heroShadow" x="-18%" y="-18%" width="142%" height="146%">
      <feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#1E1B16" flood-opacity="0.22" />
    </filter>
    <filter id="badgeShadow" x="-15%" y="-15%" width="135%" height="145%">
      <feDropShadow dx="0" dy="5" stdDeviation="0" flood-color="${INK}" flood-opacity="1" />
    </filter>
  </defs>

  <!-- Canvas Background -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#paperBg)" />
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#paperDots)" />

  <!-- Subtle architectural corner stripes (top-right & bottom-left) -->
  <path d="M 1030 0 L 1200 0 L 1200 170 Z" fill="rgba(22, 170, 152, 0.12)" />
  <path d="M 0 470 L 0 630 L 160 630 Z" fill="rgba(223, 90, 0, 0.1)" />

  <!-- Outer Storybook Ink Frame -->
  <rect x="18" y="18" width="${WIDTH - 36}" height="${HEIGHT - 36}" rx="28" fill="none" stroke="${INK}" stroke-width="6" />
  <rect x="28" y="28" width="${WIDTH - 56}" height="${HEIGHT - 56}" rx="20" fill="none" stroke="rgba(44, 44, 44, 0.16)" stroke-width="2" />

  <!-- LEFT STAGE: Explosive Starburst + Glowing 3-Card Rainbow Set + Orange Tabby Hero -->
  <circle cx="365" cy="295" r="265" fill="url(#comboGlow)" />

  <!-- Comic/Storybook action speed rays -->
  <polygon points="${burstOuter}" fill="#FF9538" fill-opacity="0.26" stroke="${COLOR_ORANGE}" stroke-width="2.5" stroke-opacity="0.55" />
  <polygon points="${burstInner}" fill="${ACTION_YELLOW}" fill-opacity="0.72" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" />

  <!-- Sparkle stars & energy motes around starburst -->
  <g fill="${ACTION_YELLOW}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round">
    <polygon points="154,132 162,150 180,158 162,166 154,184 146,166 128,158 146,150" />
    <polygon points="562,126 568,140 582,146 568,152 562,166 556,152 542,146 556,140" />
    <polygon points="546,434 551,445 562,450 551,455 546,466 541,455 530,450 541,445" />
  </g>
  <circle cx="212" cy="108" r="7" fill="${COLOR_BLUE}" stroke="${INK}" stroke-width="2.5" />
  <circle cx="510" cy="104" r="8" fill="${COLOR_PINK}" stroke="${INK}" stroke-width="2.5" />
  <circle cx="114" cy="284" r="6" fill="${LOGIC_TEAL}" stroke="${INK}" stroke-width="2.2" />

  <!-- Fanned Glowing All-Different SET (Circle / Triangle / Bolt × Orange / Blue / Pink) -->
  <!-- Card 1 (Left): 1 Tangerine Orange Outlined Circle -->
  <g transform="translate(226 264) rotate(-18)" filter="url(#cardShadow)">
    <rect x="-74" y="-102" width="148" height="204" rx="18" fill="#FFFFFF" stroke="${INK}" stroke-width="5.5" />
    <rect x="-66" y="-94" width="132" height="188" rx="12" fill="none" stroke="rgba(223, 90, 0, 0.25)" stroke-width="2" />
    <circle cx="-14" cy="-2" r="32" fill="none" stroke="${COLOR_ORANGE}" stroke-width="8.5" />
  </g>

  <!-- Card 3 (Right): 2 Electric Sky Blue Diagonal-Hatched Triangles -->
  <g transform="translate(494 266) rotate(18)" filter="url(#cardShadow)">
    <rect x="-74" y="-102" width="148" height="204" rx="18" fill="#E2ECF7" stroke="${INK}" stroke-width="5.5" />
    <rect x="-66" y="-94" width="132" height="188" rx="12" fill="none" stroke="#6489B8" stroke-width="2" />
    <g transform="translate(-8 -72) scale(2.05)">
      <polygon points="${TRIANGLE_POINTS_24x30}" fill="url(#blueHatch)" stroke="${COLOR_BLUE}" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round" />
    </g>
    <g transform="translate(-8 8) scale(2.05)">
      <polygon points="${TRIANGLE_POINTS_24x30}" fill="url(#blueHatch)" stroke="${COLOR_BLUE}" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round" />
    </g>
  </g>

  <!-- Card 2 (Center Hero): 3 Berry Pink Solid Bolts with golden selection aura -->
  <g transform="translate(360 226) rotate(-1)" filter="url(#cardShadow)">
    <rect x="-90" y="-122" width="180" height="244" rx="22" fill="${ACTION_YELLOW}" />
    <rect x="-84" y="-116" width="168" height="232" rx="18" fill="#FFFFFF" stroke="${INK}" stroke-width="5.5" />
    <g transform="translate(-69 -26) scale(1.72)">
      <polygon points="${BOLT_POINTS_24x30}" fill="${COLOR_PINK}" stroke="${COLOR_PINK}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />
    </g>
    <g transform="translate(-20 -26) scale(1.72)">
      <polygon points="${BOLT_POINTS_24x30}" fill="${COLOR_PINK}" stroke="${COLOR_PINK}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />
    </g>
    <g transform="translate(29 -26) scale(1.72)">
      <polygon points="${BOLT_POINTS_24x30}" fill="${COLOR_PINK}" stroke="${COLOR_PINK}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />
    </g>
  </g>

  <!-- Floating Damage / Combo Impact Pop Callout -->
  <g transform="translate(474 118) rotate(8)" filter="url(#badgeShadow)">
    <rect x="-64" y="-26" width="128" height="52" rx="14" fill="${COLOR_ORANGE}" stroke="${INK}" stroke-width="4" />
    <text x="0" y="9" text-anchor="middle" font-size="28" font-weight="900" letter-spacing="0.5" fill="#FFFFFF">+142!</text>
  </g>

  <!-- Orange Tabby Hero Critter in lower-left foreground -->
  ${buildOrangeTabbySvg({ x: 86, y: 318, scale: 2.62 })}

  <!-- RIGHT COLUMN: Eyebrow Badge, NSHAPES Title, Unified Tagline & Feature Chips -->
  <g transform="translate(612 118)">
    <!-- Eyebrow Pill -->
    <g filter="url(#badgeShadow)">
      <rect x="0" y="0" width="380" height="42" rx="10" fill="${ACTION_YELLOW}" stroke="${INK}" stroke-width="3.5" />
      <text x="190" y="27" text-anchor="middle" font-size="16" font-weight="900" letter-spacing="2" fill="${INK}">PATTERN-MATCHING ROGUELIKE</text>
    </g>

    <!-- Main Wordmark (with crisp ink offset shadow) -->
    <text x="4" y="152" font-size="100" font-weight="900" letter-spacing="4" fill="${INK}">NSHAPES</text>
    <text x="0" y="147" font-size="100" font-weight="900" letter-spacing="4" fill="#FFFFFF" stroke="${INK}" stroke-width="5" paint-order="stroke">NSHAPES</text>

    <!-- Accent Rule in Orange / Blue / Pink -->
    <rect x="2" y="170" width="144" height="8" rx="4" fill="${COLOR_ORANGE}" />
    <rect x="156" y="170" width="144" height="8" rx="4" fill="${COLOR_BLUE}" />
    <rect x="310" y="170" width="144" height="8" rx="4" fill="${COLOR_PINK}" />

    <!-- High-Contrast Tagline -->
    <text x="2" y="224" font-size="26" font-weight="800" fill="${INK}">
      Spot 3-card Sets. Fire explosive combos.
    </text>
    <text x="2" y="259" font-size="22.5" font-weight="700" fill="#4B5563">
      Parry boss attacks &amp; build wild critter loadouts.
    </text>

    <!-- Feature Chips Row -->
    <g transform="translate(0 296)">
      <rect x="0" y="0" width="166" height="44" rx="10" fill="#FFFFFF" stroke="${INK}" stroke-width="3" />
      <text x="83" y="28" text-anchor="middle" font-size="15" font-weight="900" letter-spacing="0.8" fill="${INK}">59 LEVELS</text>

      <rect x="180" y="0" width="174" height="44" rx="10" fill="#FFFFFF" stroke="${INK}" stroke-width="3" />
      <text x="267" y="28" text-anchor="middle" font-size="15" font-weight="900" letter-spacing="0.8" fill="${INK}">64 WEAPONS</text>

      <rect x="368" y="0" width="164" height="44" rx="10" fill="#FFFFFF" stroke="${INK}" stroke-width="3" />
      <text x="450" y="28" text-anchor="middle" font-size="15" font-weight="900" letter-spacing="0.8" fill="${INK}">6 CRITTERS</text>
    </g>

    <!-- Play Free CTA Pill -->
    <g transform="translate(0 364)" filter="url(#badgeShadow)">
      <rect x="0" y="0" width="356" height="58" rx="14" fill="${LOGIC_TEAL}" stroke="${INK}" stroke-width="4" />
      <text x="178" y="37" text-anchor="middle" font-size="22" font-weight="900" letter-spacing="1.2" fill="#FFFFFF">PLAY FREE IN BROWSER ▶</text>
    </g>
  </g>
</svg>
</body>
</html>`;
}

function stripAlphaToRgb(filePath) {
  const py = `
from PIL import Image
import sys
p = sys.argv[1]
img = Image.open(p)
if img.mode != 'RGB':
    bg = Image.new('RGB', img.size, (244, 239, 230))
    if img.mode == 'RGBA':
        bg.paste(img, mask=img.split()[3])
    else:
        bg.paste(img)
    bg.save(p, 'PNG', optimize=True)
`;
  execFileSync('python3', ['-c', py, filePath], { stdio: 'inherit' });
}

export async function generateOgHero(outRelPath = OUT_PATH) {
  const fullPath = path.resolve(ROOT, outRelPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
    await page.setContent(buildOgHeroHtml(), { waitUntil: 'load' });
    await page.screenshot({ path: fullPath, omitBackground: false });
    await page.close();
  } finally {
    await browser.close();
  }
  stripAlphaToRgb(fullPath);
  console.log(`✓ Generated ${outRelPath} (${WIDTH}x${HEIGHT}, RGB opaque)`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateOgHero().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
