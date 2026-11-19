/**
 * Shared helpers for the motion tools (scripts/motion). See
 * .agents/skills/motion-loop/SKILL.md for how they are used.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT_ROOT = path.join(REPO_ROOT, 'motion-out');
/** One virtual frame. The fake clock's requestAnimationFrame ticks every 16 ms, so a step of 16 is exactly one frame. */
export const FRAME_MS = 16;
export const DEFAULT_BASE = process.env.MOTION_BASE_URL || 'http://localhost:8099';
export const PHONE = { width: 390, height: 844 };

/** `--key value`, `--flag`, and bare words. */
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      out._.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    if (eq > 0) {
      out[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

export const num = (v, fallback) => (v === undefined || v === true || Number.isNaN(Number(v)) ? fallback : Number(v));

export function frameName(i) {
  return i < 0 ? `p${String(-i).padStart(3, '0')}.png` : `f${String(i).padStart(3, '0')}.png`;
}

export function frameLabel(i, step = FRAME_MS) {
  return i < 0 ? `pre${i}` : `f${i} · ${Math.round(i * step)}ms`;
}

let PNG = null;
export function png() {
  if (PNG) return PNG;
  try {
    PNG = require('pngjs').PNG;
  } catch {
    PNG = false;
  }
  return PNG;
}

export function decodePng(buffer) {
  const P = png();
  if (!P) return null;
  return P.sync.read(buffer);
}

/**
 * How much of the picture changed between two frames.
 * Returns the count of changed pixels and their bounding box (or null).
 */
export function diffFrames(a, b, threshold = 24) {
  if (!a || !b || a.width !== b.width || a.height !== b.height) return { changed: 0, box: null };
  const { width, height } = a;
  const da = a.data;
  const db = b.data;
  let changed = 0;
  let x0 = width;
  let y0 = height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < height; y++) {
    let row = y * width * 4;
    for (let x = 0; x < width; x++, row += 4) {
      const d = Math.abs(da[row] - db[row]) + Math.abs(da[row + 1] - db[row + 1]) + Math.abs(da[row + 2] - db[row + 2]);
      if (d > threshold) {
        changed++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { changed, box: x1 < 0 ? null : { x: x0, y: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 } };
}

export function unionBox(a, b) {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
}

export function padBox(box, pad, bounds) {
  if (!box) return null;
  const x = Math.max(0, box.x - pad);
  const y = Math.max(0, box.y - pad);
  const x1 = Math.min(bounds.width, box.x + box.width + pad);
  const y1 = Math.min(bounds.height, box.y + box.height + pad);
  return { x, y, width: x1 - x, height: y1 - y };
}

const BARS = ' ▁▂▃▄▅▆▇█';
/** A text graph of activity per frame: reads as pacing without opening an image. */
export function sparkline(values) {
  const max = Math.max(1, ...values);
  return values
    .map(v => {
      if (v <= 0) return '·';
      const level = Math.max(1, Math.round((Math.log(1 + v) / Math.log(1 + max)) * 8));
      return BARS[level];
    })
    .join('');
}

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value));
}

export function gitSha() {
  try {
    const { execSync } = require('node:child_process');
    const sha = execSync('git rev-parse --short HEAD', { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    // A plus sign says the code under test is not what that commit holds
    const dirty = execSync('git status --porcelain --untracked-files=no', { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    return dirty ? `${sha}+` : sha;
  } catch {
    return 'unknown';
  }
}

export const round = (v, places = 1) => {
  const m = 10 ** places;
  return Math.round(v * m) / m;
};
