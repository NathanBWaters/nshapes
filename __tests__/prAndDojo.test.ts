import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(__dirname, '..');
const UNIFIED_PITCH =
  'Spot 3-card Sets to fire explosive combos, parry boss attacks, and build screen-clearing critter loadouts in a fast pattern-matching roguelike.';

function readText(relPath: string): string {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function readPngHeader(relPath: string): { width: number; height: number; colorType: number; bytes: number } {
  const full = path.join(ROOT, relPath);
  const buf = fs.readFileSync(full);
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect(buf.length).toBeGreaterThan(26);
  expect(buf.subarray(0, 8).equals(sig)).toBe(true);
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colorType: buf.readUInt8(25),
    bytes: buf.length,
  };
}

describe('PR, OpenGraph, DOJO Landing, Trailer & Playtest Suite ([TP-06..09, TP-20])', () => {
  describe('[TP-06] OG hero artwork, HTML metadata, and unified elevator pitch', () => {
    it('ships public/og-hero.png as an opaque 1200x630 RGB PNG with reproducible generator', () => {
      const info = readPngHeader('public/og-hero.png');
      expect(info.width).toBe(1200);
      expect(info.height).toBe(630);
      expect(info.colorType).toBe(2); // True 8-bit RGB, zero alpha channel
      expect(info.bytes).toBeGreaterThan(15_000);

      const genSrc = readText('scripts/store/generate-og-hero.mjs');
      expect(genSrc).toContain('#DF5A00');
      expect(genSrc).toContain('#007ED9');
      expect(genSrc).toContain('#940E65');
      expect(genSrc).toContain('public/og-hero.png');
    });

    it('upgrades app/+html.tsx to summary_large_image, og-hero.png (1200x630), #F4EFE6 theme-color, NShapes title, and unified pitch', () => {
      const html = readText('app/+html.tsx');
      expect(html).toContain('name="twitter:card" content="summary_large_image"');
      expect(html).toContain('property="og:image" content="https://nathanbwaters.github.io/nshapes/og-hero.png"');
      expect(html).toContain('name="twitter:image" content="https://nathanbwaters.github.io/nshapes/og-hero.png"');
      expect(html).toContain('property="og:image:width" content="1200"');
      expect(html).toContain('property="og:image:height" content="630"');
      expect(html).toContain('name="theme-color" content="#F4EFE6"');
      expect(html).toContain('NShapes — Pattern-Matching Roguelike');
      expect(html).toContain(UNIFIED_PITCH);
    });

    it('keeps NShapes name untouched in app.config.js and uses the unified pitch for web.description', () => {
      const prevBase = process.env.EXPO_BASE_URL;
      delete process.env.EXPO_BASE_URL;
      const cfg = require(path.join(ROOT, 'app.config.js'));
      if (prevBase !== undefined) process.env.EXPO_BASE_URL = prevBase;

      const expo = (cfg.default ?? cfg).expo;
      expect(expo.name).toBe('NShapes');
      expect(expo.web.name).toBe('NShapes');
      expect(expo.web.description).toBe(UNIFIED_PITCH);
      expect(expo.ios.bundleIdentifier).toBe('com.nshapes.app');
      expect(expo.android.package).toBe('com.nshapes.app');
    });
  });

  describe('[TP-08] Fast, zero-bloat 1-page DOJO landing page', () => {
    it('ships public/dojo/index.html and styles.css with hero card, unified pitch, Play CTA, 3 visual pillars, 6 critters, and Discord', () => {
      const html = readText('public/dojo/index.html');
      const css = readText('public/dojo/styles.css');

      expect(html).toContain('../og-hero.png');
      expect(html).toContain('./styles.css');
      expect(html).toContain(UNIFIED_PITCH);
      expect(html).toContain('Play Free in Browser');
      expect(html).toContain('href="../"');
      expect(html).toContain('https://discord.gg/JFkUmp54Sp');

      // 3 visual one-liner cards + verified Circle/Triangle/Bolt × Orange/Blue/Pink palette
      expect(html).toContain('1. Spot a 3-Card Set');
      expect(html).toContain('2. Fire Explosive Weapons');
      expect(html).toContain('3. Parry &amp; Evolve');
      expect(html).toContain('#DF5A00');
      expect(html).toContain('#007ED9');
      expect(html).toContain('#940E65');

      // All 6 Critters showcased
      for (const critter of ['Orange Tabby', 'Sly Fox', 'Badger', 'Emperor Penguin', 'Corgi', 'Pelican']) {
        expect(html).toContain(critter);
      }

      // Responsive Storybook styles + reduced-motion respect
      expect(css).toContain('#F4EFE6');
      expect(css).toContain('@media (max-width: 960px)');
      expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    });
  });

  describe('[TP-09] PR showcase shots & ffmpeg clip exporter', () => {
    it('registers all 4 PR showcase shots (pr:cascade, pr:parry, pr:rainbow, pr:boss-ko) in capture.mjs --list', () => {
      const out = execFileSync('node', [path.join(ROOT, 'scripts/motion/capture.mjs'), '--list'], {
        cwd: ROOT,
        encoding: 'utf8',
      });
      for (const shotId of ['pr:cascade', 'pr:parry', 'pr:rainbow', 'pr:boss-ko']) {
        expect(out).toContain(shotId);
      }
    });

    it('wires --clip and --slowmo-impact into scripts/motion/capture.mjs and exports deterministic slow-mo timings', () => {
      const captureSrc = readText('scripts/motion/capture.mjs');
      expect(captureSrc).toContain("from './exportClip.mjs'");
      expect(captureSrc).toContain("args['slowmo-impact']");
      expect(captureSrc).toContain('args.clip');

      // Verify exportClip.mjs pure timing & ffmpeg argument builders via Node ESM
      const probeScript = `
        import { findPeakActivityFrame, buildSlowMoFrameList, buildFfmpegArgs } from './scripts/motion/exportClip.mjs';
        const peak = findPeakActivityFrame({ preroll: 2, activity: [0, 1, 10, 500, 120, 20] });
        const frames = Array.from({ length: 20 }, (_, i) => ({ name: 'f' + String(i).padStart(3, '0') + '.png', index: i, file: '/tmp/f' + i + '.png' }));
        const timed = buildSlowMoFrameList(frames, { fps: 60, slowmoImpact: true, impactFrame: peak });
        const slowCount = timed.filter(f => f.slowmo).length;
        const mp4 = buildFfmpegArgs({ concatPath: '/tmp/c.txt', outputPath: '/tmp/out.mp4', format: 'mp4', vertical: true });
        const webm = buildFfmpegArgs({ concatPath: '/tmp/c.txt', outputPath: '/tmp/out.webm', format: 'webm', vertical: true });
        const gif = buildFfmpegArgs({ concatPath: '/tmp/c.txt', outputPath: '/tmp/out.gif', format: 'gif', vertical: true });
        console.log(JSON.stringify({ peak, slowCount, mp4, webm, gif }));
      `;
      const parsed = JSON.parse(
        execFileSync('node', ['--input-type=module', '-e', probeScript], {
          cwd: ROOT,
          encoding: 'utf8',
        })
      );
      expect(parsed.peak).toBe(1);
      expect(parsed.slowCount).toBe(12); // indices 0..11 inside [1-2, 1+10]
      expect(parsed.mp4.join(' ')).toContain('libx264');
      expect(parsed.mp4.join(' ')).toContain('720:1280');
      expect(parsed.webm.join(' ')).toContain('libvpx-vp9');
      expect(parsed.gif.join(' ')).toContain('palettegen');
    });
  });

  describe('[TP-07] 15-second zero-logo gameplay trailer blueprint & stitcher', () => {
    it('documents the 15s zero-logo shotlist aligned to Circle/Triangle/Bolt × Orange/Blue/Pink and pr:clip commands', () => {
      const doc = readText('docs/pr/trailer-shotlist.md');
      expect(doc).toContain('0:00.0');
      expect(doc).toContain('0:15.0');
      expect(doc).toContain('Circle');
      expect(doc).toContain('Triangle');
      expect(doc).toContain('Bolt');
      expect(doc).toContain('#DF5A00');
      expect(doc).toContain('#007ED9');
      expect(doc).toContain('#940E65');
      expect(doc).toContain('npm run pr:clip');
      expect(doc).toContain('pr:cascade');
      expect(doc).toContain('pr:parry');
      expect(doc).toContain('pr:rainbow');
      expect(doc).toContain('pr:boss-ko');

      const stitcher = readText('scripts/pr/build-trailer.mjs');
      expect(stitcher).toContain('public/media/gameplay-trailer-15s.mp4');
      expect(stitcher).toContain('public/media/gameplay-loop.webm');
      expect(stitcher).toContain('public/og-hero.png');
    });
  });

  describe('[TP-20] Sakurai Ep. #246 10-person silent first-timer playtest kit', () => {
    it('provides silent-first-timer-protocol.md and observation-sheet.md with cohort mix, ?save=fresh, zero-hint script, and triage scorecard', () => {
      const protocol = readText('docs/playtest/silent-first-timer-protocol.md');
      const sheet = readText('docs/playtest/observation-sheet.md');

      expect(protocol).toContain('#246');
      expect(protocol).toContain('?save=fresh');
      expect(protocol).toContain('10');
      expect(protocol).toContain('Zero-Hint');
      expect(protocol).toContain('Minute-10 Pull Test');

      expect(sheet).toContain('Hesitation');
      expect(sheet).toContain('Squint');
      expect(sheet).toContain('Mis-Tap');
      expect(sheet).toContain('0:00');
      expect(sheet).toContain('10:00');
      expect(sheet).toContain('Triage Scorecard');
      expect(sheet).toContain('P10');
    });
  });

  describe('README alignment', () => {
    it('publishes the unified pitch, live dev studios, DOJO page, pr:clip, and playtest links', () => {
      const readme = readText('README.md');
      expect(readme).toContain(UNIFIED_PITCH);
      expect(readme).toContain('public/dojo/index.html');
      expect(readme).toContain('npm run pr:clip');
      expect(readme).toContain('docs/pr/trailer-shotlist.md');
      expect(readme).toContain('docs/playtest/silent-first-timer-protocol.md');
      expect(readme).toContain('/dev/summit');
      expect(readme).not.toContain('/dev/play');
      expect(readme).not.toContain('/dev/store');
    });
  });
});
