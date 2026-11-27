#!/usr/bin/env node
/**
 * [TP-09] Dual-duty PR clip exporter for `scripts/motion/capture.mjs`.
 *
 * Stitches deterministic 60fps PNG frame sequences from `motion-out/<shot>/<label>/frames/*.png`
 * into crisp social-ready MP4 (H.264), looping WebM (VP9), and looping GIF clips via `ffmpeg`,
 * with optional `--slowmo-impact` (0.5× slow-mo hold across the peak hitstop/explosion window)
 * and `--vertical` (`720×1280` 9:16 portrait framing).
 *
 * Usage:
 *   node scripts/motion/exportClip.mjs <capture-dir> [--slowmo-impact] [--vertical]
 *        [--fit pad|crop] [--formats mp4,webm,gif] [--fps 60] [--impact-frame N]
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { FRAME_MS, parseArgs, readJson, writeJson } from './lib.mjs';

export const DEFAULT_FPS = 60;
export const VERTICAL_SIZE = { width: 720, height: 1280 };
export const DEFAULT_FORMATS = ['mp4', 'webm', 'gif'];
export const SLOWMO_WINDOW_BEFORE = 2;
export const SLOWMO_WINDOW_AFTER = 10;
export const SLOWMO_SCALE = 2; // 2× frame duration = 0.5× playback speed

/** Returns true when `ffmpeg` is available in PATH. */
export function hasFfmpeg() {
  const probe = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  return !probe.error && probe.status === 0;
}

/**
 * Returns ordered frame entries from `framesDir`:
 * preroll frames (`p00N.png` down to `p001.png`), then post-trigger (`f000.png`..`fNNN.png`).
 */
export function collectOrderedFrames(framesDir) {
  if (!fs.existsSync(framesDir)) return [];
  const names = fs.readdirSync(framesDir).filter((f) => f.endsWith('.png'));
  const preroll = names
    .filter((f) => /^p\d+\.png$/.test(f))
    .map((name) => ({ name, index: -Number(name.slice(1, -4)) }))
    .sort((a, b) => a.index - b.index);
  const main = names
    .filter((f) => /^f\d+\.png$/.test(f))
    .map((name) => ({ name, index: Number(name.slice(1, -4)) }))
    .sort((a, b) => a.index - b.index);
  return [...preroll, ...main].map((entry) => ({
    ...entry,
    file: path.join(framesDir, entry.name),
  }));
}

/**
 * Finds the post-trigger frame index with the highest pixel-diff activity spike
 * (ideal anchor for `--slowmo-impact` 0.5× peak-hit holds).
 */
export function findPeakActivityFrame(capture) {
  const activity = Array.isArray(capture?.activity) ? capture.activity : [];
  const preroll = Number.isFinite(capture?.preroll) ? capture.preroll : 0;
  let bestIdx = 0;
  let bestVal = -1;
  for (let i = preroll; i < activity.length; i++) {
    const val = Number(activity[i]) || 0;
    if (val > bestVal) {
      bestVal = val;
      bestIdx = i - preroll;
    }
  }
  return bestIdx;
}

/**
 * Computes per-frame durations (in seconds) for ffmpeg's concat demuxer.
 * When `slowmoImpact` is enabled, frames inside `[impactFrame - 2, impactFrame + 10]`
 * run at 0.5× speed (`2 / fps` per frame).
 */
export function buildSlowMoFrameList(frames, { fps = DEFAULT_FPS, slowmoImpact = false, impactFrame = 0 } = {}) {
  const baseDur = 1 / fps;
  const lo = impactFrame - SLOWMO_WINDOW_BEFORE;
  const hi = impactFrame + SLOWMO_WINDOW_AFTER;
  return frames.map((frame) => {
    const inImpact = slowmoImpact && frame.index >= lo && frame.index <= hi;
    return {
      ...frame,
      slowmo: inImpact,
      durationSec: inImpact ? baseDur * SLOWMO_SCALE : baseDur,
    };
  });
}

/** Formats an ffmpeg concat demuxer script with exact frame durations. */
export function buildConcatContent(timedFrames) {
  const lines = ['ffconcat version 1.0'];
  for (const frame of timedFrames) {
    const escaped = frame.file.replace(/'/g, "'\\''");
    lines.push(`file '${escaped}'`);
    lines.push(`duration ${frame.durationSec.toFixed(6)}`);
  }
  if (timedFrames.length > 0) {
    const last = timedFrames[timedFrames.length - 1].file.replace(/'/g, "'\\''");
    lines.push(`file '${last}'`);
  }
  return `${lines.join('\n')}\n`;
}

/** Builds the ffmpeg video filter chain for vertical `720×1280` or native even-dimension encoding. */
export function buildVideoFilter({ vertical = true, width = VERTICAL_SIZE.width, height = VERTICAL_SIZE.height, fit = 'pad' } = {}) {
  if (!vertical) {
    return 'scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos';
  }
  if (fit === 'crop') {
    return `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height}`;
  }
  // Default `pad`: keeps 100% of HUD + full 3×4/3×5 card board visible on warm Storybook paper (#F4EFE6)
  return `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0xF4EFE6`;
}

/** Returns exact ffmpeg CLI arguments for a target format (`mp4`, `webm`, or `gif`). */
export function buildFfmpegArgs({ concatPath, outputPath, format, fps = DEFAULT_FPS, vertical = true, fit = 'pad' }) {
  const vf = buildVideoFilter({ vertical, fit });
  const base = ['-y', '-f', 'concat', '-safe', '0', '-i', concatPath];
  if (format === 'mp4') {
    return [
      ...base,
      '-vf', `${vf},fps=${fps}`,
      '-c:v', 'libx264',
      '-preset', 'medium',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-movflags', '+faststart',
      outputPath,
    ];
  }
  if (format === 'webm') {
    return [
      ...base,
      '-vf', `${vf},fps=${fps}`,
      '-c:v', 'libvpx-vp9',
      '-b:v', '0',
      '-crf', '28',
      '-pix_fmt', 'yuv420p',
      '-an',
      outputPath,
    ];
  }
  if (format === 'gif') {
    const gifWidth = vertical ? 480 : 420;
    const gifScale = vertical
      ? `${vf},scale=${gifWidth}:-2:flags=lanczos`
      : `scale=${gifWidth}:-2:flags=lanczos`;
    return [
      ...base,
      '-vf', `${gifScale},fps=30,split[s0][s1];[s0]palettegen=max_colors=192:stats_mode=diff[p];[s1][p]paletteuse=dither=sierra2_4a`,
      '-loop', '0',
      outputPath,
    ];
  }
  throw new Error(`Unsupported clip format "${format}". Expected mp4, webm, or gif.`);
}

/**
 * Exports social-ready MP4 / WebM / GIF clips from a motion-capture directory.
 * Always writes `clip-frames.txt` and `clip-manifest.json` so clips can also be
 * rendered later if `ffmpeg` is not installed on the current machine.
 */
export function exportClip(outDir, opts = {}) {
  const resolvedOut = path.resolve(outDir);
  const framesDir = path.join(resolvedOut, 'frames');
  const capturePath = path.join(resolvedOut, 'capture.json');
  const capture = fs.existsSync(capturePath) ? readJson(capturePath) : null;

  const frames = collectOrderedFrames(framesDir);
  if (frames.length === 0) {
    throw new Error(`No PNG frames found in ${framesDir}. Run scripts/motion/capture.mjs first.`);
  }

  const fps = Number.isFinite(opts.fps)
    ? opts.fps
    : capture?.step
      ? Math.round(1000 / capture.step)
      : Math.round(1000 / FRAME_MS);
  const slowmoImpact = !!opts.slowmoImpact;
  const vertical = opts.vertical !== false;
  const fit = opts.fit === 'crop' ? 'crop' : 'pad';
  const formats = Array.isArray(opts.formats) && opts.formats.length > 0
    ? opts.formats.map((f) => String(f).trim().toLowerCase()).filter(Boolean)
    : DEFAULT_FORMATS;
  const impactFrame = Number.isFinite(opts.impactFrame)
    ? opts.impactFrame
    : findPeakActivityFrame(capture);

  const timedFrames = buildSlowMoFrameList(frames, { fps, slowmoImpact, impactFrame });
  const totalDurationSec = Number(timedFrames.reduce((sum, f) => sum + f.durationSec, 0).toFixed(3));
  const concatPath = path.join(resolvedOut, 'clip-frames.txt');
  fs.writeFileSync(concatPath, buildConcatContent(timedFrames), 'utf8');

  const suffix = slowmoImpact ? '-slowmo' : '';
  const planned = formats.map((format) => {
    const outputPath = path.join(resolvedOut, `clip${suffix}.${format}`);
    const args = buildFfmpegArgs({ concatPath, outputPath, format, fps, vertical, fit });
    return { format, outputPath, args };
  });

  const manifestPath = path.join(resolvedOut, 'clip-manifest.json');
  const ffmpegAvailable = hasFfmpeg();
  const exported = [];
  const errors = [];

  if (ffmpegAvailable && !opts.dryRun) {
    for (const job of planned) {
      const res = spawnSync('ffmpeg', job.args, { encoding: 'utf8' });
      if (res.status === 0) {
        exported.push({ format: job.format, file: job.outputPath });
      } else {
        errors.push({ format: job.format, error: (res.stderr || res.stdout || 'ffmpeg failed').slice(-400) });
      }
    }
  }

  const manifest = {
    shot: capture?.shot?.id ?? path.basename(resolvedOut),
    frames: frames.length,
    fps,
    vertical,
    size: vertical ? VERTICAL_SIZE : capture?.size ?? null,
    fit,
    slowmoImpact,
    impactFrame,
    slowmoWindow: slowmoImpact ? [impactFrame - SLOWMO_WINDOW_BEFORE, impactFrame + SLOWMO_WINDOW_AFTER] : null,
    totalDurationSec,
    concatPath: path.relative(process.cwd(), concatPath),
    ffmpegAvailable,
    exported: exported.map((e) => ({ format: e.format, file: path.relative(process.cwd(), e.file) })),
    commands: planned.map((job) => ({
      format: job.format,
      file: path.relative(process.cwd(), job.outputPath),
      cmd: `ffmpeg ${job.args.map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ')}`,
    })),
    errors,
  };
  writeJson(manifestPath, manifest);

  return {
    manifest,
    manifestPath,
    concatPath,
    exported,
    ffmpegMissing: !ffmpegAvailable,
    errors,
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetDir = args._[0];
  if (!targetDir || args.help) {
    console.log(
      'usage: node scripts/motion/exportClip.mjs <capture-dir> [--slowmo-impact] [--vertical|--no-vertical] [--fit pad|crop] [--formats mp4,webm,gif] [--fps 60] [--impact-frame N] [--dry-run]'
    );
    return;
  }
  const res = exportClip(targetDir, {
    slowmoImpact: !!args['slowmo-impact'],
    vertical: args['no-vertical'] ? false : args.vertical !== 'false',
    fit: typeof args.fit === 'string' ? args.fit : 'pad',
    formats: typeof args.formats === 'string' ? args.formats.split(',') : DEFAULT_FORMATS,
    fps: args.fps !== undefined ? Number(args.fps) : undefined,
    impactFrame: args['impact-frame'] !== undefined ? Number(args['impact-frame']) : undefined,
    dryRun: !!args['dry-run'],
  });
  if (res.ffmpegMissing) {
    console.log(`ℹ ffmpeg not found in PATH — wrote ${path.relative(process.cwd(), res.concatPath)} and ${path.relative(process.cwd(), res.manifestPath)}.`);
    console.log('  Install ffmpeg (e.g. `brew install ffmpeg`) and re-run this command to render MP4/WebM/GIF.');
  } else {
    for (const out of res.exported) {
      console.log(`✓ Exported ${out.format.toUpperCase()}: ${path.relative(process.cwd(), out.file)}`);
    }
    if (res.errors.length > 0) {
      for (const err of res.errors) console.error(`✖ ${err.format}: ${err.error}`);
      process.exitCode = 1;
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
