#!/usr/bin/env node
/**
 * Reproducibly renders crisp, vector-sharp NShapes icons, Android adaptive +
 * monochrome layers, splash emblem, PWA icons, and the 1024x500 Google Play
 * Feature Graphic using Playwright Chromium, and strips alpha channels from
 * Apple/Google opaque store assets so ITMS-90717 checks always pass.
 *
 * Usage: node scripts/store/generate-brand-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from '@playwright/test';

const ROOT = process.cwd();

const ensureDir = (filePath) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
};

/**
 * Core iconic NShapes card SVG: white rounded SET card with dark-plum inner
 * border and 3 cerulean-blue diamonds centered inside.
 */
function cardSvgGroup({
  cx = 512,
  cy = 512,
  cardW = 576,
  cardH = 810,
  showShadow = true,
} = {}) {
  const x = cx - cardW / 2;
  const y = cy - cardH / 2;
  const outerRx = Math.round(cardW * 0.135);
  const inset = Math.round(cardW * 0.036);
  const innerRx = Math.round(outerRx - inset * 0.65);
  const strokeW = Math.max(4, Math.round(cardW * 0.025));

  // 3 centered diamonds matching the original NShapes emblem
  const dW = cardW * 0.21;
  const dH = cardH * 0.235;
  const gap = cardW * 0.038;
  const step = dW + gap;
  const centers = [cx - step, cx, cx + step];

  const diamonds = centers
    .map((dx) => {
      const top = `${dx.toFixed(1)},${(cy - dH / 2).toFixed(1)}`;
      const right = `${(dx + dW / 2).toFixed(1)},${cy.toFixed(1)}`;
      const bottom = `${dx.toFixed(1)},${(cy + dH / 2).toFixed(1)}`;
      const left = `${(dx - dW / 2).toFixed(1)},${cy.toFixed(1)}`;
      return `<polygon points="${top} ${right} ${bottom} ${left}" fill="#0A76C6" />`;
    })
    .join('\n      ');

  return `
    ${
      showShadow
        ? `<rect x="${x}" y="${y + Math.round(cardH * 0.015)}" width="${cardW}" height="${cardH}" rx="${outerRx}" fill="rgba(5, 20, 48, 0.28)" filter="url(#cardShadow)" />`
        : ''
    }
    <rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="${outerRx}" fill="#FBFBFD" />
    <rect
      x="${x + inset}"
      y="${y + inset}"
      width="${cardW - inset * 2}"
      height="${cardH - inset * 2}"
      rx="${innerRx}"
      fill="none"
      stroke="#31153B"
      stroke-width="${strokeW}"
    />
    ${diamonds}
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
    <radialGradient id="bg" cx="50%" cy="48%" r="68%">
      <stop offset="0%" stop-color="#1973CB" />
      <stop offset="65%" stop-color="#1159A8" />
      <stop offset="100%" stop-color="#0B3F80" />
    </radialGradient>
    <filter id="cardShadow" x="-15%" y="-15%" width="130%" height="135%">
      <feGaussianBlur stdDeviation="16" />
    </filter>
    ${clip}
  </defs>
  <g ${groupAttr}>
    <rect width="1024" height="1024" fill="url(#bg)" />
    ${cardSvgGroup({ cx: 512, cy: 512, cardW: 576, cardH: 810, showShadow: true })}
  </g>
</svg>
</body>
</html>`;
}

function buildAdaptiveForegroundHtml() {
  // Android adaptive icon safe zone is central 66% (676px diameter circle).
  // Keep card height at 560px and width at 398px so all 4 corners sit comfortably inside!
  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><style>html,body{margin:0;padding:0;width:1024px;height:1024px;overflow:hidden;background:transparent;}</style></head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <filter id="cardShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" />
    </filter>
  </defs>
  ${cardSvgGroup({ cx: 512, cy: 512, cardW: 398, cardH: 556, showShadow: true })}
</svg>
</body>
</html>`;
}

function buildAdaptiveMonochromeHtml() {
  // Android 13+ monochrome themed icon: single-color white silhouette with cutouts inside safe zone
  const cx = 512;
  const cy = 512;
  const cardW = 398;
  const cardH = 556;
  const x = cx - cardW / 2;
  const y = cy - cardH / 2;
  const rx = Math.round(cardW * 0.14);
  const dW = cardW * 0.21;
  const dH = cardH * 0.235;
  const gap = cardW * 0.038;
  const step = dW + gap;
  const centers = [cx - step, cx, cx + step];
  const diamondCutouts = centers
    .map((dx) => {
      const top = `${dx.toFixed(1)},${(cy - dH / 2).toFixed(1)}`;
      const right = `${(dx + dW / 2).toFixed(1)},${cy.toFixed(1)}`;
      const bottom = `${dx.toFixed(1)},${(cy + dH / 2).toFixed(1)}`;
      const left = `${(dx - dW / 2).toFixed(1)},${cy.toFixed(1)}`;
      return `<polygon points="${top} ${right} ${bottom} ${left}" fill="black" />`;
    })
    .join('\n        ');

  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><style>html,body{margin:0;padding:0;width:1024px;height:1024px;overflow:hidden;background:transparent;}</style></head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <mask id="monoMask">
      <rect width="1024" height="1024" fill="black" />
      <rect x="${x}" y="${y}" width="${cardW}" height="${cardH}" rx="${rx}" fill="white" />
      ${diamondCutouts}
    </mask>
  </defs>
  <rect width="1024" height="1024" fill="#FFFFFF" mask="url(#monoMask)" />
</svg>
</body>
</html>`;
}

function buildSplashIconHtml() {
  // Transparent emblem placed cleanly on #145CA8 splash background
  return `<!doctype html>
<html>
<head><meta charset="utf-8" /><style>html,body{margin:0;padding:0;width:1024px;height:1024px;overflow:hidden;background:transparent;}</style></head>
<body>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <filter id="cardShadow" x="-15%" y="-15%" width="130%" height="135%">
      <feGaussianBlur stdDeviation="18" />
    </filter>
  </defs>
  ${cardSvgGroup({ cx: 512, cy: 512, cardW: 540, cardH: 760, showShadow: true })}
</svg>
</body>
</html>`;
}

function buildFeatureGraphicHtml() {
  // 1024x500 Google Play Feature Graphic: tactile fanned SET trio on left + bold NSHAPES lockup on right
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
      <stop offset="0%" stop-color="#196EC6" />
      <stop offset="55%" stop-color="#0F4E96" />
      <stop offset="100%" stop-color="#0A3364" />
    </linearGradient>
    <radialGradient id="glow" cx="30%" cy="50%" r="48%">
      <stop offset="0%" stop-color="rgba(255, 224, 102, 0.24)" />
      <stop offset="100%" stop-color="rgba(255, 224, 102, 0)" />
    </radialGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="145%" height="145%">
      <feDropShadow dx="0" dy="10" stdDeviation="12" flood-color="#04152E" flood-opacity="0.38" />
    </filter>
    <pattern id="redStripe" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(0)">
      <line x1="0" y1="3" x2="8" y2="3" stroke="#E0433E" stroke-width="3" />
    </pattern>
  </defs>

  <rect width="1024" height="500" fill="url(#fgBg)" />
  <rect width="1024" height="500" fill="url(#glow)" />

  <!-- Subtle geometric grid accents -->
  <g opacity="0.08" stroke="#FFFFFF" stroke-width="1.5" fill="none">
    <circle cx="920" cy="70" r="140" />
    <circle cx="920" cy="70" r="210" />
    <circle cx="110" cy="460" r="150" />
  </g>

  <!-- Fanned SET Trio on the Left -->
  <!-- Card 1: 1 Red Outlined Oval -->
  <g transform="translate(122 270) rotate(-18)" filter="url(#softShadow)">
    <rect x="-82" y="-118" width="164" height="236" rx="22" fill="#FBFBFD" />
    <rect x="-74" y="-110" width="148" height="220" rx="16" fill="none" stroke="#31153B" stroke-width="5" />
    <rect x="-46" y="-48" width="46" height="96" rx="23" fill="none" stroke="#E0433E" stroke-width="8" />
  </g>

  <!-- Card 2: 2 Green Striped Pill/Waves -->
  <g transform="translate(352 270) rotate(18)" filter="url(#softShadow)">
    <rect x="-82" y="-118" width="164" height="236" rx="22" fill="#FBFBFD" />
    <rect x="-74" y="-110" width="148" height="220" rx="16" fill="none" stroke="#31153B" stroke-width="5" />
    <rect x="-4" y="-48" width="32" height="96" rx="16" fill="#00897B" opacity="0.22" stroke="#00897B" stroke-width="6" />
    <line x1="-1" y1="-22" x2="25" y2="-22" stroke="#00897B" stroke-width="4" />
    <line x1="-1" y1="0" x2="25" y2="0" stroke="#00897B" stroke-width="4" />
    <line x1="-1" y1="22" x2="25" y2="22" stroke="#00897B" stroke-width="4" />
    <rect x="34" y="-48" width="32" height="96" rx="16" fill="#00897B" opacity="0.22" stroke="#00897B" stroke-width="6" />
    <line x1="37" y1="-22" x2="63" y2="-22" stroke="#00897B" stroke-width="4" />
    <line x1="37" y1="0" x2="63" y2="0" stroke="#00897B" stroke-width="4" />
    <line x1="37" y1="22" x2="63" y2="22" stroke="#00897B" stroke-width="4" />
  </g>

  <!-- Center Hero Card: 3 Blue Solid Diamonds (the iconic NShapes emblem) -->
  <g transform="translate(237 244) rotate(-1)" filter="url(#softShadow)">
    <rect x="-94" y="-134" width="188" height="268" rx="24" fill="#FBFBFD" />
    <rect x="-85" y="-125" width="170" height="250" rx="17" fill="none" stroke="#31153B" stroke-width="5.5" />
    <polygon points="-47,-32 -27,0 -47,32 -67,0" fill="#0A76C6" />
    <polygon points="0,-32 20,0 0,32 -20,0" fill="#0A76C6" />
    <polygon points="47,-32 67,0 47,32 27,0" fill="#0A76C6" />
  </g>

  <!-- Right Side: Title & Tagline -->
  <g transform="translate(474 148)">
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
  // Use Python Pillow to guarantee true 8-bit RGB (color_type=2, zero alpha channel)
  // as strictly required by Apple App Store (ITMS-90717).
  const py = `
from PIL import Image
import sys
p = sys.argv[1]
img = Image.open(p)
if img.mode != 'RGB':
    bg = Image.new('RGB', img.size, (17, 89, 168))
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
    // 1. iOS / Universal App Icon (1024x1024 opaque RGB)
    await renderHtmlToPng(browser, buildAppIconHtml(1024), 1024, 1024, 'assets/icon.png', { opaqueRgb: true });

    // 2. Android Adaptive Foreground (1024x1024 transparent RGBA, safe-zone centered)
    await renderHtmlToPng(browser, buildAdaptiveForegroundHtml(), 1024, 1024, 'assets/adaptive-icon.png', { transparent: true });

    // 3. Android 13+ Monochrome Themed Icon (1024x1024 white silhouette on transparent)
    await renderHtmlToPng(browser, buildAdaptiveMonochromeHtml(), 1024, 1024, 'assets/adaptive-icon-monochrome.png', { transparent: true });

    // 4. Expo Splash Icon (1024x1024 transparent emblem over #145CA8 splash background)
    await renderHtmlToPng(browser, buildSplashIconHtml(), 1024, 1024, 'assets/splash-icon.png', { transparent: true });

    // 5. Web Favicon & PWA Icons
    await renderHtmlToPng(browser, buildAppIconHtml(512, { roundedMask: true }), 512, 512, 'assets/favicon.png', { transparent: true });
    await renderHtmlToPng(browser, buildAppIconHtml(512), 512, 512, 'public/icons/icon-512.png', { opaqueRgb: true });
    await renderHtmlToPng(browser, buildAppIconHtml(192), 192, 192, 'public/icons/icon-192.png', { opaqueRgb: true });
    await renderHtmlToPng(browser, buildAppIconHtml(180), 180, 180, 'public/icons/apple-touch-icon.png', { opaqueRgb: true });

    // 6. Google Play Console Store Graphics
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
