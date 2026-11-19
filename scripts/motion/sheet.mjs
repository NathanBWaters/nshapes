#!/usr/bin/env node
/**
 * Lays captured frames out as one picture a model (or a person) can read:
 *
 *   contact  the whole effect, sampled evenly, like a storyboard: pacing, variety, dead stretches
 *   strip    consecutive frames, cropped to where things move: pops, overlaps, late peaks
 *   compare  two captures of the same shot, the same frames one above the other
 *
 *   node scripts/motion/sheet.mjs <captureDir>                       # contact.png + strip.png
 *   node scripts/motion/sheet.mjs <captureDir> --from 10 --to 25     # a strip of exactly these frames
 *        [--every 1] [--cols 8] [--roi auto|full|<test id>|x,y,w,h] [--out file.png]
 *        (--roi results-stars crops to the box that test id covered, plus --pad N pixels (16); x,y,w,h are image pixels)
 *   node scripts/motion/sheet.mjs --compare <beforeDir> <afterDir> [--from A --to B --every N]
 *
 * Every thumbnail is labelled with its frame number and time, so a note can
 * say "f12 peaks two frames late" and mean it.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { frameLabel, frameName, num, parseArgs, readJson, unionBox } from './lib.mjs';

const SHEET_WIDTH = 1500;
const GAP = 3;
/** Room kept around a test id's box when cropping to it (`--pad N`) */
const PAD = { value: 16 };

function activeRange(capture) {
  const live = capture.activity.slice(capture.preroll);
  const ambient = capture.ambient ?? (capture.preroll > 1 ? Math.max(0, ...capture.activity.slice(1, capture.preroll)) : 0);
  const quiet = ambient * 1.5 + 2;
  let first = null;
  let last = null;
  live.forEach((v, i) => {
    if (v > quiet) {
      if (first == null) first = i;
      last = i;
    }
  });
  return { first: first ?? 0, last: last ?? Math.max(0, capture.frames - 1) };
}

function imageSize(capture) {
  return { width: Math.round(capture.size.width * capture.dpr), height: Math.round(capture.size.height * capture.dpr) };
}

function parseRoi(value, capture) {
  const full = imageSize(capture);
  if (!value || value === 'full') return { x: 0, y: 0, ...full };
  if (value === 'auto') {
    const r = capture.roi;
    if (!r || r.width * r.height > full.width * full.height * 0.7) return { x: 0, y: 0, ...full };
    return r;
  }
  const parts = String(value).split(',').map(Number);
  if (parts.length === 4 && parts.every(Number.isFinite)) return { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
  // A test id: the box that part of the screen covered during the capture
  const region = capture.regions?.[value];
  if (!region) throw new Error(`--roi "${value}" is not auto, full, x,y,w,h or a test id seen in this capture. Seen: ${Object.keys(capture.regions ?? {}).slice(0, 40).join(', ')}`);
  // A creature's ears and a burst's rays stick out of the box their test id is on
  const pad = PAD.value;
  const d = capture.dpr;
  const x = Math.max(0, (region[0] - pad) * d);
  const y = Math.max(0, (region[1] - pad) * d);
  return { x, y, width: Math.min(full.width - x, (region[2] + pad * 2) * d), height: Math.min(full.height - y, (region[3] + pad * 2) * d) };
}

/** rows: [{ tag?, cells: [{ file, label }] }] */
async function render({ rows, roi, full, cols, out, title }) {
  const thumbW = Math.max(40, Math.min(Math.floor((SHEET_WIDTH - GAP * (cols + 1)) / cols), Math.round(roi.width * 2)));
  const scale = thumbW / roi.width;
  const thumbH = Math.round(roi.height * scale);
  const cell = c =>
    `<div class="c" style="width:${thumbW}px;height:${thumbH}px">` +
    `<img src="${pathToFileURL(c.file).href}" style="width:${Math.round(full.width * scale)}px;margin-left:${-Math.round(roi.x * scale)}px;margin-top:${-Math.round(roi.y * scale)}px">` +
    `<b class="${c.tone ?? ''}">${c.label}</b></div>`;
  const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:0;background:#16161a;font:11px/1.25 -apple-system,system-ui,sans-serif;color:#fff}
h1{font-size:12px;font-weight:600;margin:0;padding:4px 6px;color:#cfd2da}
.r{display:flex;gap:${GAP}px;padding:0 ${GAP}px ${GAP}px}
.c{position:relative;overflow:hidden;background:#2a2a30;flex:none}
.c img{display:block;max-width:none}
.c b{position:absolute;left:0;top:0;background:rgba(0,0,0,.74);padding:1px 4px;font-weight:700;white-space:nowrap}
.c b.a{background:rgba(120,60,0,.86)}.c b.b{background:rgba(0,90,60,.9)}
</style><h1>${title}</h1>${rows.map(r => `<div class="r">${r.cells.map(cell).join('')}</div>`).join('')}`;
  const htmlFile = out.replace(/\.png$/, '.html');
  fs.writeFileSync(htmlFile, html);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: cols * (thumbW + GAP) + GAP, height: 400 } });
  await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load' });
  await page.screenshot({ path: out, fullPage: true });
  await browser.close();
  fs.rmSync(htmlFile, { force: true });
  return out;
}

const chunk = (list, n) => {
  const out = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
};

function pickFrames(capture, { from, to, every, limit }) {
  const last = capture.frames - 1;
  const a = Math.max(-capture.preroll, Math.min(last, from));
  const b = Math.max(a, Math.min(last, to));
  let step = Math.max(1, every ?? 1);
  if (limit) while ((b - a) / step + 1 > limit) step++;
  const out = [];
  for (let i = a; i <= b; i += step) out.push(i);
  return { frames: out, step };
}

const cellsFor = (dir, capture, frames, tone, prefix = '') =>
  frames.map(i => ({ file: path.join(dir, 'frames', frameName(i)), label: prefix + frameLabel(i, capture.step), tone }));

export async function buildSheet(dir, options = {}) {
  const capture = readJson(path.join(dir, 'capture.json'));
  const full = imageSize(capture);
  const roi = parseRoi(options.roi ?? 'full', capture);
  const cols = options.cols ?? 8;
  const { frames, step } = pickFrames(capture, { from: options.from ?? 0, to: options.to ?? capture.frames - 1, every: options.every, limit: options.limit });
  const out = options.out ?? path.join(dir, `sheet-f${frames[0]}-f${frames[frames.length - 1]}.png`);
  const title = `${capture.shot.id} [${capture.label}] · f${frames[0]}–f${frames[frames.length - 1]}${step > 1 ? ` every ${step}` : ''} · ${capture.step} ms per frame${roi.width < full.width ? ' · cropped to the motion' : ''}`;
  await render({ rows: chunk(cellsFor(dir, capture, frames), cols).map(cells => ({ cells })), roi, full, cols, out, title });
  return out;
}

/** The two sheets every capture gets. */
export async function buildDefaultSheets(dir) {
  const capture = readJson(path.join(dir, 'capture.json'));
  const { first, last } = activeRange(capture);
  const end = Math.min(capture.frames - 1, last + 4);
  const contact = await buildSheet(dir, { from: capture.preroll ? -1 : 0, to: end, limit: 24, roi: 'full', out: path.join(dir, 'contact.png') });
  const from = Math.max(0, first - 1);
  const strip = await buildSheet(dir, { from, to: Math.min(capture.frames - 1, from + 15), every: 1, roi: 'auto', out: path.join(dir, 'strip.png') });
  return [
    { file: contact, about: 'the whole effect as a storyboard' },
    { file: strip, about: `16 consecutive frames from f${from}, cropped to the motion` },
  ];
}

export async function buildCompare(dirA, dirB, options = {}) {
  const a = readJson(path.join(dirA, 'capture.json'));
  const b = readJson(path.join(dirB, 'capture.json'));
  const ra = activeRange(a);
  const rb = activeRange(b);
  const full = imageSize(a);
  let roi = parseRoi(options.roi ?? 'auto', a);
  if ((options.roi ?? 'auto') === 'auto') {
    const u = unionBox(a.roi, b.roi);
    roi = !u || u.width * u.height > full.width * full.height * 0.7 ? { x: 0, y: 0, ...full } : u;
  }
  const cols = options.cols ?? 8;
  const from = options.from ?? Math.max(0, Math.min(ra.first, rb.first) - 1);
  const to = options.to ?? Math.max(ra.last, rb.last) + 2;
  const limit = options.limit ?? 24;
  const { frames, step } = pickFrames({ ...a, frames: Math.max(a.frames, b.frames) }, { from, to, every: options.every, limit });
  const inA = frames.filter(i => i < a.frames);
  const rows = [];
  for (const part of chunk(frames, cols)) {
    rows.push({ cells: cellsFor(dirA, a, part.filter(i => i < a.frames), 'a', `${a.label} `) });
    rows.push({ cells: cellsFor(dirB, b, part.filter(i => i < b.frames), 'b', `${b.label} `) });
  }
  const out = options.out ?? path.join(dirB, `compare-${a.label}-vs-${b.label}.png`);
  const title = `${a.shot.id}: ${a.label} (brown labels, @${a.sha}) above ${b.label} (green labels, @${b.sha}) · f${frames[0]}–f${frames[frames.length - 1]}${step > 1 ? ` every ${step}` : ''} · ${a.step} ms per frame · ${inA.length} frames each`;
  await render({ rows: rows.filter(r => r.cells.length), roi, full, cols, out, title });
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const opt = {
    from: args.from !== undefined ? num(args.from, 0) : undefined,
    to: args.to !== undefined ? num(args.to, 0) : undefined,
    every: args.every !== undefined ? num(args.every, 1) : undefined,
    cols: args.cols !== undefined ? num(args.cols, 8) : undefined,
    limit: args.limit !== undefined ? num(args.limit, 24) : undefined,
    roi: typeof args.roi === 'string' ? args.roi : undefined,
    out: typeof args.out === 'string' ? path.resolve(args.out) : undefined,
  };
  if (args.pad !== undefined) PAD.value = num(args.pad, 16);
  if (args.compare) {
    const [a, b] = [args.compare === true ? args._[0] : args.compare, args.compare === true ? args._[1] : args._[0]];
    if (!a || !b) throw new Error('usage: node scripts/motion/sheet.mjs --compare <beforeDir> <afterDir>');
    console.log(path.relative(process.cwd(), await buildCompare(path.resolve(a), path.resolve(b), opt)));
    return;
  }
  const dir = args._[0];
  if (!dir) throw new Error('usage: node scripts/motion/sheet.mjs <captureDir> [--from A --to B --every N --cols C --roi auto|full|x,y,w,h]');
  if (opt.from === undefined && opt.to === undefined) {
    for (const s of await buildDefaultSheets(path.resolve(dir))) console.log(`${path.relative(process.cwd(), s.file)}  (${s.about})`);
    return;
  }
  console.log(path.relative(process.cwd(), await buildSheet(path.resolve(dir), { roi: 'auto', ...opt })));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(e => {
    console.error(String(e && e.message ? e.message : e));
    process.exit(1);
  });
}
