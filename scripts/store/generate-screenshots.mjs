#!/usr/bin/env node
/**
 * Generates Apple App Store & Google Play Store marketing screenshots directly
 * from the live NShapes app using Playwright Chromium.
 *
 * Outputs:
 *   store-assets/screenshots/ios-iphone-6.9/      (1320 x 2868)
 *   store-assets/screenshots/ios-ipad-13/         (2064 x 2752)
 *   store-assets/screenshots/android-phone/       (1080 x 1920)
 *   store-assets/screenshots/android-tablet-10/   (1600 x 2560)
 *
 * Usage:
 *   node scripts/store/generate-screenshots.mjs
 *   STORE_SCREENSHOT_BASE_URL=http://localhost:8081 node scripts/store/generate-screenshots.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const ROOT = process.cwd();
const OUT_ROOT = path.join(ROOT, 'store-assets', 'screenshots');
const DEFAULT_PORT = 8089;
const BASE_URL = process.env.STORE_SCREENSHOT_BASE_URL || `http://localhost:${DEFAULT_PORT}`;

const TARGETS = [
  {
    id: 'ios-iphone-6.9',
    outW: 1320,
    outH: 2868,
    viewportW: 412,
    viewportH: 892,
    scale: 2,
    frameRadius: 56,
    isTablet: false,
  },
  {
    id: 'ios-ipad-13',
    outW: 2064,
    outH: 2752,
    viewportW: 820,
    viewportH: 1094,
    scale: 2,
    frameRadius: 44,
    isTablet: true,
  },
  {
    id: 'android-phone',
    outW: 1080,
    outH: 1920,
    viewportW: 390,
    viewportH: 760,
    scale: 2,
    frameRadius: 42,
    isTablet: false,
  },
  {
    id: 'android-tablet-10',
    outW: 1600,
    outH: 2560,
    viewportW: 768,
    viewportH: 1180,
    scale: 2,
    frameRadius: 40,
    isTablet: true,
  },
];

const SCENES = [
  {
    slug: '01-main-menu',
    eyebrow: 'FOUR WAYS TO PLAY',
    headline: 'Spot Trios.\nBuild Wild Combos.',
    accent: '#F5C842',
    bgTop: '#166AC0',
    bgBottom: '#0B3A75',
    url: '/',
    waitMs: 1200,
  },
  {
    slug: '02-adventure-map',
    eyebrow: '5-WORLD CAMPAIGN',
    headline: 'Rescue Friends &\nUnlock Relics',
    accent: '#FFE074',
    bgTop: '#0E6B6B',
    bgBottom: '#083A44',
    url: '/dev/adventure?save=maxed&intro=false',
    waitMs: 1400,
  },
  {
    slug: '03-adventure-fight',
    eyebrow: 'FAST TACTICAL COMBAT',
    headline: 'Trigger Chains,\nCrits & Evolutions',
    accent: '#FF8A65',
    bgTop: '#1A4E8C',
    bgBottom: '#13244A',
    url: '/dev/adventure?save=maxed&intro=false',
    waitMs: 1400,
    setup: async (page) => {
      // Open level 1-1 preview and start fight so real live combat renders
      const node = page.getByTestId('map-node-1-1');
      if ((await node.count()) > 0) {
        await node.click({ force: true });
        await page.waitForTimeout(600);
        const fightBtn = page.getByTestId('preview-play');
        if ((await fightBtn.count()) > 0) {
          await fightBtn.click();
          await page.waitForTimeout(1600);
        }
      }
    },
  },
  {
    slug: '04-starfall-summit',
    eyebrow: 'STARFALL SUMMIT',
    headline: 'Climb the 3-Act\nRoguelike Peak',
    accent: '#7CE8D8',
    bgTop: '#184A5E',
    bgBottom: '#0C2434',
    url: '/dev/spire?start=true&seed=4242',
    waitMs: 1400,
  },
  {
    slug: '05-prism-deck',
    eyebrow: 'PRISM DECK MODE',
    headline: 'Turn-Based Deck\nCombos & Dailies',
    accent: '#F2C94C',
    bgTop: '#0F4D3A',
    bgBottom: '#072219',
    url: '/?mode=prism&seed=PRISM42',
    waitMs: 1400,
    setup: async (page) => {
      // Dismiss first-run tutorial if open, then launch straight into Blind Select / Play
      const skipBtn = page.getByText(/SKIP|START|PLAY|GOT IT/i).first();
      if ((await skipBtn.count()) > 0) {
        await skipBtn.click().catch(() => undefined);
        await page.waitForTimeout(800);
      }
      const startRun = page.getByTestId('prism-start-run');
      if ((await startRun.count()) > 0) {
        await startRun.click().catch(() => undefined);
        await page.waitForTimeout(900);
      }
    },
  },
];

async function waitForServer(url, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 800));
  }
  throw new Error(`Timed out waiting for Expo web server at ${url}`);
}

function buildFramedHtml({ target, scene, screenshotDataUrl }) {
  const { outW, outH, frameRadius, isTablet } = target;
  const headerH = Math.round(outH * (isTablet ? 0.2 : 0.215));
  const padX = Math.round(outW * (isTablet ? 0.08 : 0.065));
  const padBottom = Math.round(outH * 0.032);
  const availW = outW - padX * 2;
  const availH = outH - headerH - padBottom;
  const aspect = target.viewportW / target.viewportH;
  let frameW = availW;
  let frameH = Math.round(frameW / aspect);
  if (frameH > availH) {
    frameH = availH;
    frameW = Math.round(frameH * aspect);
  }
  const bezel = Math.round(outW * 0.014);
  const eyebrowSize = Math.round(outW * (isTablet ? 0.017 : 0.024));
  const headlineSize = Math.round(outW * (isTablet ? 0.044 : 0.066));

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    width: ${outW}px;
    height: ${outH}px;
    overflow: hidden;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    background: linear-gradient(165deg, ${scene.bgTop} 0%, ${scene.bgBottom} 100%);
    color: #FFFFFF;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .header {
    width: 100%;
    height: ${headerH}px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    padding: ${Math.round(outH * 0.035)}px ${padX}px ${Math.round(outH * 0.015)}px;
  }
  .eyebrow {
    display: inline-block;
    background: ${scene.accent};
    color: #16202C;
    font-size: ${eyebrowSize}px;
    font-weight: 900;
    letter-spacing: ${Math.round(eyebrowSize * 0.12)}px;
    padding: ${Math.round(eyebrowSize * 0.36)}px ${Math.round(eyebrowSize * 0.9)}px;
    border-radius: 999px;
    margin-bottom: ${Math.round(headlineSize * 0.28)}px;
  }
  .headline {
    margin: 0;
    font-size: ${headlineSize}px;
    font-weight: 900;
    line-height: 1.08;
    letter-spacing: -0.02em;
    white-space: pre-line;
    text-shadow: 0 6px 24px rgba(0, 0, 0, 0.28);
  }
  .stage {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-start;
    justify-content: center;
  }
  .device {
    width: ${frameW}px;
    height: ${frameH}px;
    padding: ${bezel}px;
    border-radius: ${frameRadius}px;
    background: linear-gradient(145deg, #27313F 0%, #11161E 100%);
    box-shadow: 0 ${Math.round(outH * 0.02)}px ${Math.round(outH * 0.045)}px rgba(0, 0, 0, 0.45),
                inset 0 0 0 3px rgba(255, 255, 255, 0.14);
  }
  .screen {
    width: 100%;
    height: 100%;
    border-radius: ${Math.max(12, frameRadius - bezel)}px;
    overflow: hidden;
    background: #F5F2EB;
  }
  .screen img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
    display: block;
  }
</style>
</head>
<body>
  <div class="header">
    <div class="eyebrow">${scene.eyebrow}</div>
    <h1 class="headline">${scene.headline}</h1>
  </div>
  <div class="stage">
    <div class="device">
      <div class="screen">
        <img src="${screenshotDataUrl}" alt="${scene.slug}" />
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function main() {
  let serverProc = null;
  let serverRunning = false;
  try {
    const res = await fetch(BASE_URL);
    serverRunning = res.ok;
  } catch {
    serverRunning = false;
  }

  if (!serverRunning) {
    console.log(`Starting Expo web dev server on port ${DEFAULT_PORT}...`);
    serverProc = spawn('npx', ['expo', 'start', '--web', '--port', String(DEFAULT_PORT)], {
      cwd: ROOT,
      stdio: 'ignore',
      env: { ...process.env, CI: '1', BROWSER: 'none' },
    });
    await waitForServer(BASE_URL);
    console.log(`✓ Expo web server ready at ${BASE_URL}`);
  }

  const browser = await chromium.launch();
  try {
    for (const target of TARGETS) {
      const targetDir = path.join(OUT_ROOT, target.id);
      fs.mkdirSync(targetDir, { recursive: true });

      for (const scene of SCENES) {
        const ctx = await browser.newContext({
          viewport: { width: target.viewportW, height: target.viewportH },
          deviceScaleFactor: target.scale,
          reducedMotion: 'reduce',
        });
        const page = await ctx.newPage();
        await page.goto(`${BASE_URL}${scene.url}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(scene.waitMs);
        if (scene.setup) {
          await scene.setup(page);
        }
        const rawBuf = await page.screenshot({ type: 'png' });
        await ctx.close();

        // Compose into framed store marketing screenshot at exact pixel size
        const framePage = await browser.newPage({
          viewport: { width: target.outW, height: target.outH },
          deviceScaleFactor: 1,
        });
        const html = buildFramedHtml({
          target,
          scene,
          screenshotDataUrl: `data:image/png;base64,${rawBuf.toString('base64')}`,
        });
        await framePage.setContent(html, { waitUntil: 'load' });
        const outFile = path.join(targetDir, `${scene.slug}.png`);
        await framePage.screenshot({ path: outFile });
        await framePage.close();
        console.log(`✓ ${path.relative(ROOT, outFile)} (${target.outW}x${target.outH})`);
      }
    }
  } finally {
    await browser.close();
    if (serverProc) {
      serverProc.kill('SIGTERM');
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
