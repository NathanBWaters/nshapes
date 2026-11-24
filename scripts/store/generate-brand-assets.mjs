#!/usr/bin/env node
/**
 * Reproducibly renders crisp, vector-sharp NShapes brand assets built around
 * our scientifically verified, zero-SET-overlap triad:
 *   Shapes: Circle · Triangle · -25°-tilted Crescent Moon
 *   Colors: Cobalt Blue (#1E229E) · Ocean Teal (#007870) · Tangerine Orange (#E05A04)
 *
 * Strips alpha channels from Apple/Google opaque store assets so ITMS-90717
 * checks always pass.
 *
 * Usage: node scripts/store/generate-brand-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const ROOT = process.cwd();

// Exact verified Proposal #2 palette & geometry (matching src/utils/cardVisuals.ts)
const COLOR_ORANGE = '#E05A04';
const COLOR_TEAL = '#007870';
const COLOR_BLUE = '#1E229E';
const CRESCENT_PATH_24x30 =
  'M 22.37,19.18 A 10.80,10.80 0 1,1 15.62,4.69 A 8.00,8.00 0 0,0 22.37,19.18 Z';
const TRIANGLE_POINTS_24x30 = '12,2.2 22,26.8 2,26.8';

const ensureDir = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

/**
 * Iconic NShapes Geometric Triad Badge:
 * Warm ivory rounded square tile framed in deep charcoal with a crisp golden
 * top prism accent, housing the 3 signature shapes (Teal Triangle, Cobalt
 * Circle, Tangerine Crescent Moon) in balanced triangular symmetry.
 */
function triadEmblemGroup({ cx = 512, cy = 512, size = 700, showShadow = true } = {}) {
  const s = size / 700;
  const x = cx - size / 2;
  const y = cy - size / 2;
  const rx = Math.round(142 * s);
  const borderW = Math.round(22 * s);

  // Place the 3 shapes inside the 700x700 coordinate box mapped from 24x30 geometry
  // Top: Ocean Teal Triangle
  // Bottom-Left: Royal Cobalt Circle
  // Bottom-Right: Tangerine Orange Tilted Crescent Moon
  const shapeScale = 10.8 * s; // 24*10.8 = 259px wide, 30*10.8 = 324px tall
  const triX = cx - 12 * shapeScale;
  const triY = cy - 294 * s;
  const circX = cx - 152 * s;
  const circY = cy + 128 * s;
  const circR = 102 * s;
  const moonX = cx + 20 * s;
  const moonY = cy - 26 * s;

  return `
    ${
      showShadow
        ? `<rect x="${x}" y="${y + Math.round(22 * s)}" width="${size}" height="${size}" rx="${rx}" fill="rgba(4, 14, 34, 0.36)" filter="url(#emblemShadow)" />`
        : ''
    }
    <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="${rx}" fill="#FAF7F0" stroke="#1E2530" stroke-width="${borderW}" />
    <!-- Subtle geometric prism highlight ring inside tile -->
    <circle cx="${cx}" cy="${cy + Math.round(18 * s)}" r="${Math.round(238 * s)}" fill="none" stroke="rgba(30, 37, 48, 0.08)" stroke-width="${Math.round(6 * s)}" stroke-dasharray="${Math.round(16 * s)} ${Math.round(14 * s)}" />

    <!-- Top: Ocean Teal Triangle -->
    <g transform="translate(${triX.toFixed(1)} ${triY.toFixed(1)}) scale(${shapeScale.toFixed(3)})">
      <polygon points="${TRIANGLE_POINTS_24x30}" fill="${COLOR_TEAL}" stroke="${COLOR_TEAL}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />
    </g>

    <!-- Bottom-Left: Royal Cobalt Circle -->
    <circle cx="${circX.toFixed(1)}" cy="${circY.toFixed(1)}" r="${circR.toFixed(1)}" fill="${COLOR_BLUE}" />

    <!-- Bottom-Right: Tangerine Orange Tilted Crescent Moon -->
    <g transform="translate(${moonX.toFixed(1)} ${moonY.toFixed(1)}) scale(${shapeScale.toFixed(3)})">
      <path d="${CRESCENT_PATH_24x30}" fill="${COLOR_ORANGE}" stroke="${COLOR_ORANGE}" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" />
    </g>
  `;
}

function buildAppIconHtml(size = 1024, { roundedMask = false } = {}) {
  const clip = roundedMask
    ? `<clipPath id="round"><rect x="0" y="0" width="1024" height="1024" rx="224" /></clipPath>`
    : '';
  const groupAttr = roundedMask ? 'clip-path="url(#round)"' : '';
  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><style>html,body{margin:0;padding:0;width:${size}px;height:${size}px;overflow:hidden;background:transparent;}</style></head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  <defs>
    <radialGradient id="bg" cx="50%" cy="42%" r="72%">
      <stop offset="0%" stop-color="#1E4B8A" />
      <stop offset="60%" stop-color="#103260" />
      <stop offset="100%" stop-color="#081C3A" />
    </radialGradient>
    <filter id="emblemShadow" x="-18%" y="-18%" width="136%" height="140%">
      <feGaussianBlur stdDeviation="20" />
    </filter>
    ${clip}
  </defs>
  <g ${groupAttr}>
    <rect width="1024" height="1024" fill="url(#bg)" />
    <circle cx="512" cy="512" r="445" fill="none" stroke="rgba(255,255,255,0.07)" stroke-width="4" />
    ${triadEmblemGroup({ cx: 512, cy: 512, size: 736, showShadow: true })}
  </g>
</svg>
</body>
</html>`;
}

function buildAdaptiveForegroundHtml() {
  // Android adaptive icon safe zone is central 66% (676px diameter).
  // Keep rounded tile at 520x520 so corners stay comfortably inside circular/squircle masks!
  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><style>html,body{margin:0;padding:0;width:1024px;height:1024px;overflow:hidden;background:transparent;}</style></head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <filter id="emblemShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="14" />
    </filter>
  </defs>
  ${triadEmblemGroup({ cx: 512, cy: 512, size: 520, showShadow: true })}
</svg>
</body>
</html>`;
}

function buildAdaptiveMonochromeHtml() {
  // Android 13+ Material You themed icon: bold pure-white Triad (Triangle + Circle + Moon) inside safe zone
  const s = 540 / 700;
  const cx = 512;
  const cy = 512;
  const shapeScale = 11.4 * s;
  const triX = cx - 12 * shapeScale;
  const triY = cy - 306 * s;
  const circX = cx - 156 * s;
  const circY = cy + 132 * s;
  const circR = 108 * s;
  const moonX = cx + 18 * s;
  const moonY = cy - 28 * s;

  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><style>html,body{margin:0;padding:0;width:1024px;height:1024px;overflow:hidden;background:transparent;}</style></head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <g transform="translate(${triX.toFixed(1)} ${triY.toFixed(1)}) scale(${shapeScale.toFixed(3)})">
    <polygon points="${TRIANGLE_POINTS_24x30}" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />
  </g>
  <circle cx="${circX.toFixed(1)}" cy="${circY.toFixed(1)}" r="${circR.toFixed(1)}" fill="#FFFFFF" />
  <g transform="translate(${moonX.toFixed(1)} ${moonY.toFixed(1)}) scale(${shapeScale.toFixed(3)})">
    <path d="${CRESCENT_PATH_24x30}" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="1.4" stroke-linejoin="round" stroke-linecap="round" />
  </g>
</svg>
</body>
</html>`;
}

function buildSplashIconHtml() {
  // Transparent emblem placed cleanly on #103260 splash background
  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><style>html,body{margin:0;padding:0;width:1024px;height:1024px;overflow:hidden;background:transparent;}</style></head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <filter id="emblemShadow" x="-15%" y="-15%" width="130%" height="135%">
      <feGaussianBlur stdDeviation="20" />
    </filter>
  </defs>
  ${triadEmblemGroup({ cx: 512, cy: 512, size: 700, showShadow: true })}
</svg>
</body>
</html>`;
}

function buildFeatureGraphicHtml() {
  // 1024x500 Google Play Feature Graphic showcasing NShapes' new Circle/Triangle/Moon × Orange/Teal/Blue trio!
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body {
    margin: 0;
    padding: 0;
    width: 1024px;
    height: 500px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
</style>
</head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs>
    <linearGradient id="fgBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#194480" />
      <stop offset="55%" stop-color="#0F305C" />
      <stop offset="100%" stop-color="#081D3A" />
    </linearGradient>
    <radialGradient id="glow" cx="27%" cy="50%" r="48%">
      <stop offset="0%" stop-color="rgba(255, 212, 92, 0.24)" />
      <stop offset="100%" stop-color="rgba(255, 212, 92, 0)" />
    </radialGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="145%" height="145%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#030D1E" flood-opacity="0.42" />
    </filter>
    <!-- +45° diagonal hatch for Teal Triangles card -->
    <pattern id="tealHatch" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(-45)">
      <rect x="0" y="0" width="5" height="2.5" fill="${COLOR_TEAL}" />
    </pattern>
  </defs>

  <rect width="1024" height="500" fill="url(#fgBg)" />
  <rect width="1024" height="500" fill="url(#glow)" />

  <!-- Subtle geometric blueprint rings -->
  <g opacity="0.08" stroke="#FFFFFF" stroke-width="1.5" fill="none">
    <circle cx="920" cy="70" r="140" />
    <circle cx="920" cy="70" r="210" />
    <circle cx="110" cy="460" r="150" />
  </g>

  <!-- Fanned NShapes Trio (All-Different: 1 Orange Outlined Circle · 2 Teal Hatched Triangles · 3 Cobalt Solid Moons) -->
  <!-- Card 1 (Left): 1 Orange Outlined Circle -->
  <g transform="translate(122 272) rotate(-16)" filter="url(#softShadow)">
    <rect x="-82" y="-114" width="164" height="228" rx="20" fill="#FAF7F0" stroke="#232934" stroke-width="5" />
    <circle cx="-24" cy="-4" r="34" fill="none" stroke="${COLOR_ORANGE}" stroke-width="8.5" />
  </g>

  <!-- Card 2 (Right): 2 Teal Diagonal-Hatched Triangles (stacked cleanly in visible right field) -->
  <g transform="translate(350 272) rotate(16)" filter="url(#softShadow)">
    <rect x="-82" y="-114" width="164" height="228" rx="20" fill="#FAF7F0" stroke="#232934" stroke-width="5" />
    <g transform="translate(10 -78) scale(2.32)">
      <polygon points="${TRIANGLE_POINTS_24x30}" fill="url(#tealHatch)" stroke="${COLOR_TEAL}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    </g>
    <g transform="translate(10 8) scale(2.32)">
      <polygon points="${TRIANGLE_POINTS_24x30}" fill="url(#tealHatch)" stroke="${COLOR_TEAL}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
    </g>
  </g>

  <!-- Card 3 (Center Hero): 3 Cobalt Solid Tilted Moons -->
  <g transform="translate(236 244) rotate(-1)" filter="url(#softShadow)">
    <rect x="-96" y="-132" width="192" height="264" rx="22" fill="#FFFFFF" stroke="#F5C842" stroke-width="6" />
    <g transform="translate(-76.5 -28) scale(1.88)">
      <path d="${CRESCENT_PATH_24x30}" fill="${COLOR_BLUE}" stroke="${COLOR_BLUE}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />
    </g>
    <g transform="translate(-22.5 -28) scale(1.88)">
      <path d="${CRESCENT_PATH_24x30}" fill="${COLOR_BLUE}" stroke="${COLOR_BLUE}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />
    </g>
    <g transform="translate(31.5 -28) scale(1.88)">
      <path d="${CRESCENT_PATH_24x30}" fill="${COLOR_BLUE}" stroke="${COLOR_BLUE}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" />
    </g>
  </g>

  <!-- Right Side: Title & Tagline -->
  <g transform="translate(484 148)">
    <!-- Accent badge -->
    <rect x="0" y="0" width="234" height="34" rx="17" fill="#F5C842" />
    <text x="117" y="22.5" text-anchor="middle" font-size="14" font-weight="900" letter-spacing="1.8" fill="#182230">PATTERN ROGUELIKE</text>

    <!-- Main title -->
    <text x="0" y="116" font-size="88" font-weight="900" letter-spacing="5" fill="#FFFFFF">NSHAPES</text>

    <!-- Tagline -->
    <text x="2" y="160" font-size="22" font-weight="600" fill="rgba(245, 248, 255, 0.90)">
      Match trios. Bend the rules. Build wild combos.
    </text>

    <!-- Mode pills -->
    <g transform="translate(0 192)">
      <rect x="0" y="0" width="152" height="40" rx="10" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.34)" stroke-width="1.5" />
      <text x="76" y="25.5" text-anchor="middle" font-size="14" font-weight="800" letter-spacing="1" fill="#FFFFFF">5-WORLD MAP</text>

      <rect x="166" y="0" width="158" height="40" rx="10" fill="rgba(255,255,255,0.14)" stroke="rgba(255,255,255,0.34)" stroke-width="1.5" />
      <text x="245" y="25.5" text-anchor="middle" font-size="14" font-weight="800" letter-spacing="1" fill="#FFFFFF">ROGUELIKE CLIMB</text>

      <rect x="338" y="0" width="146" height="40" rx="10" fill="rgba(245, 200, 66, 0.18)" stroke="rgba(245, 200, 66, 0.65)" stroke-width="1.5" />
      <text x="411" y="25.5" text-anchor="middle" font-size="14" font-weight="800" letter-spacing="1" fill="#FFE074">PRISM DECK</text>
    </g>
  </g>
</svg>
</body>
</html>`;
}

function stripAlphaToRgb(filePath) {
  // Guarantee true 8-bit RGB (color_type=2, zero alpha channel) for Apple ITMS-90717
  const py = `
from PIL import Image
import sys
p = sys.argv[1]
img = Image.open(p)
if img.mode != 'RGB':
    bg = Image.new('RGB', img.size, (16, 50, 96))
    if img.mode == 'RGBA':
        bg.paste(img, mask=img.split()[3])
    else:
        bg.paste(img)
    bg.save(p, 'PNG', optimize=True)
`;
  execFileSync('python3', ['-c', py, filePath], { stdio: 'inherit' });
}

async function renderHtmlToPng(browser, html, width, height, outPath, { transparent = false, opaqueRgb = false } = {}) {
  const fullPath = path.resolve(ROOT, outPath);
  ensureDir(fullPath);
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: 'load' });
  await page.screenshot({ path: fullPath, omitBackground: transparent });
  await page.close();
  if (opaqueRgb) {
    stripAlphaToRgb(fullPath);
  }
  console.log(`✓ Generated ${outPath} (${width}x${height}${opaqueRgb ? ', RGB opaque' : ', RGBA'})`);
}

async function main() {
  const browser = await chromium.launch();
  try {
    await renderHtmlToPng(browser, buildAppIconHtml(1024), 1024, 1024, 'assets/icon.png', { opaqueRgb: true });
    await renderHtmlToPng(browser, buildAdaptiveForegroundHtml(), 1024, 1024, 'assets/adaptive-icon.png', { transparent: true });
    await renderHtmlToPng(browser, buildAdaptiveMonochromeHtml(), 1024, 1024, 'assets/adaptive-icon-monochrome.png', { transparent: true });
    await renderHtmlToPng(browser, buildSplashIconHtml(), 1024, 1024, 'assets/splash-icon.png', { transparent: true });
    await renderHtmlToPng(browser, buildAppIconHtml(512, { roundedMask: true }), 512, 512, 'assets/favicon.png', { transparent: true });
    await renderHtmlToPng(browser, buildAppIconHtml(512), 512, 512, 'public/icons/icon-512.png', { opaqueRgb: true });
    await renderHtmlToPng(browser, buildAppIconHtml(192), 192, 192, 'public/icons/icon-192.png', { opaqueRgb: true });
    await renderHtmlToPng(browser, buildAppIconHtml(180), 180, 180, 'public/icons/apple-touch-icon.png', { opaqueRgb: true });
    await renderHtmlToPng(browser, buildAppIconHtml(512), 512, 512, 'store-assets/google-play/app-icon-512.png', { opaqueRgb: true });
    await renderHtmlToPng(browser, buildFeatureGraphicHtml(), 1024, 500, 'store-assets/google-play/feature-graphic.png', { opaqueRgb: true });
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
