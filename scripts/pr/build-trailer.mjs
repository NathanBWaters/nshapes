#!/usr/bin/env node
/**
 * [TP-07] Reproducible 15-second Zero-Logo Gameplay Trailer Stitcher.
 *
 * Combines the 4 deterministic PR showcase captures (`pr:cascade`, `pr:parry`,
 * `pr:rainbow`, `pr:boss-ko`) plus the `public/og-hero.png` Storybook title card
 * into:
 *   - `public/media/gameplay-trailer-15s.mp4` (60fps H.264 master, 15.0s exact)
 *   - `public/media/gameplay-loop.webm`       (muted 10.0s VP9 autoplay loop)
 *
 * Usage:
 *   node scripts/pr/build-trailer.mjs [--label trailer] [--aspect vertical|square] [--dry-run]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { OUT_ROOT, parseArgs, writeJson } from '../motion/lib.mjs';
import { hasFfmpeg } from '../motion/exportClip.mjs';

const ROOT = process.cwd();

export const TRAILER_SEGMENTS = [
  { id: 'pr:cascade', label: 'Zero-Logo Visual Hook', startSec: 0.0, durationSec: 3.0 },
  { id: 'pr:parry', label: 'Perfect Orange Counter-Parry', startSec: 3.0, durationSec: 2.5 },
  { id: 'pr:rainbow', label: 'Evolution & Rainbow Cascade', startSec: 5.5, durationSec: 3.0 },
  { id: 'pr:boss-ko', label: 'Boss Kill-Cam Knockout', startSec: 8.5, durationSec: 3.0 },
  { id: 'og-hero', label: 'Title Card & Playable CTA', startSec: 11.5, durationSec: 3.5, imagePath: 'public/og-hero.png' },
];

export const ASPECT_PRESETS = {
  vertical: { width: 720, height: 1280 },
  square: { width: 1080, height: 1080 },
};

function sanitizeShotDir(shotId) {
  return shotId.replace(/[^a-zA-Z0-9._-]+/g, '-');
}

function resolveSegmentInput(seg, captureLabel) {
  if (seg.imagePath) {
    return path.resolve(ROOT, seg.imagePath);
  }
  const baseDir = path.join(OUT_ROOT, sanitizeShotDir(seg.id), captureLabel);
  const slowmoMp4 = path.join(baseDir, 'clip-slowmo.mp4');
  const plainMp4 = path.join(baseDir, 'clip.mp4');
  return fs.existsSync(slowmoMp4) ? slowmoMp4 : plainMp4;
}

export function buildTrailerPlan({ label = 'trailer', aspect = 'vertical', outMp4 = 'public/media/gameplay-trailer-15s.mp4', outWebm = 'public/media/gameplay-loop.webm' } = {}) {
  const dims = ASPECT_PRESETS[aspect] ?? ASPECT_PRESETS.vertical;
  const inputs = TRAILER_SEGMENTS.map((seg) => {
    const file = resolveSegmentInput(seg, label);
    return {
      ...seg,
      file,
      exists: fs.existsSync(file),
    };
  });

  const ffmpegInputs = [];
  const filterParts = [];
  inputs.forEach((seg, idx) => {
    if (seg.imagePath) {
      ffmpegInputs.push('-loop', '1', '-t', String(seg.durationSec), '-i', seg.file);
    } else {
      ffmpegInputs.push('-t', String(seg.durationSec), '-i', seg.file);
    }
    const scaleFilter =
      `[${idx}:v]scale=${dims.width}:${dims.height}:force_original_aspect_ratio=decrease:flags=lanczos,` +
      `pad=${dims.width}:${dims.height}:(ow-iw)/2:(oh-ih)/2:color=0xF4EFE6,` +
      `fps=60,setsar=1,trim=duration=${seg.durationSec},setpts=PTS-STARTPTS[v${idx}]`;
    filterParts.push(scaleFilter);
  });

  const concatInputs = inputs.map((_, i) => `[v${i}]`).join('');
  filterParts.push(`${concatInputs}concat=n=${inputs.length}:v=1:a=0[vout]`);
  const filterComplex = filterParts.join(';');

  const mp4Full = path.resolve(ROOT, outMp4);
  const webmFull = path.resolve(ROOT, outWebm);

  const mp4Args = [
    '-y',
    ...ffmpegInputs,
    '-filter_complex', filterComplex,
    '-map', '[vout]',
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    mp4Full,
  ];

  // Muted 10.0s gameplay loop for DOJO & README (trims before static title card)
  const webmArgs = [
    '-y',
    '-i', mp4Full,
    '-t', '10.0',
    '-vf', `scale=${Math.min(540, dims.width)}:-2:flags=lanczos,fps=30`,
    '-c:v', 'libvpx-vp9',
    '-b:v', '0',
    '-crf', '30',
    '-pix_fmt', 'yuv420p',
    '-an',
    webmFull,
  ];

  return {
    totalDurationSec: TRAILER_SEGMENTS.reduce((acc, s) => acc + s.durationSec, 0),
    aspect,
    dims,
    inputs,
    filterComplex,
    mp4Path: mp4Full,
    webmPath: webmFull,
    mp4Args,
    webmArgs,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const label = typeof args.label === 'string' ? args.label : 'trailer';
  const aspect = typeof args.aspect === 'string' ? args.aspect : 'vertical';
  const dryRun = !!args['dry-run'];

  const plan = buildTrailerPlan({ label, aspect });
  const missing = plan.inputs.filter((s) => !s.exists);

  console.log(`NShapes 15s Trailer Plan (${plan.aspect} ${plan.dims.width}×${plan.dims.height}, ${plan.totalDurationSec.toFixed(1)}s):`);
  for (const seg of plan.inputs) {
    const status = seg.exists ? '✓' : '○ missing';
    console.log(`  [${seg.startSec.toFixed(1)}s + ${seg.durationSec.toFixed(1)}s] ${seg.id.padEnd(11)} ${status.padEnd(10)} ${path.relative(ROOT, seg.file)}`);
  }

  const manifestPath = path.join(OUT_ROOT, 'trailer-plan.json');
  writeJson(manifestPath, {
    totalDurationSec: plan.totalDurationSec,
    aspect: plan.aspect,
    dims: plan.dims,
    ffmpegAvailable: hasFfmpeg(),
    segments: plan.inputs.map((s) => ({
      id: s.id,
      label: s.label,
      startSec: s.startSec,
      durationSec: s.durationSec,
      file: path.relative(ROOT, s.file),
      exists: s.exists,
    })),
    mp4Output: path.relative(ROOT, plan.mp4Path),
    webmOutput: path.relative(ROOT, plan.webmPath),
  });

  if (dryRun) {
    console.log(`\nDry run complete. Plan saved to ${path.relative(ROOT, manifestPath)}.`);
    return;
  }

  if (!hasFfmpeg()) {
    console.log('\nℹ ffmpeg is not installed in PATH. Install via `brew install ffmpeg` and re-run:');
    console.log(`  node scripts/pr/build-trailer.mjs --label ${label}`);
    return;
  }

  if (missing.length > 0) {
    console.error('\n✖ Missing captured PR showcase clips. Capture them first while Expo web runs on :8099:');
    for (const seg of missing) {
      if (!seg.imagePath) {
        console.error(`  node scripts/motion/capture.mjs ${seg.id} --label ${label} --clip --slowmo-impact`);
      } else {
        console.error('  node scripts/store/generate-og-hero.mjs');
      }
    }
    process.exit(1);
  }

  fs.mkdirSync(path.dirname(plan.mp4Path), { recursive: true });
  const mp4Res = spawnSync('ffmpeg', plan.mp4Args, { stdio: 'inherit' });
  if (mp4Res.status !== 0) process.exit(mp4Res.status ?? 1);
  console.log(`✓ Rendered ${path.relative(ROOT, plan.mp4Path)}`);

  const webmRes = spawnSync('ffmpeg', plan.webmArgs, { stdio: 'inherit' });
  if (webmRes.status !== 0) process.exit(webmRes.status ?? 1);
  console.log(`✓ Rendered ${path.relative(ROOT, plan.webmPath)}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
