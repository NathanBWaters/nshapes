#!/usr/bin/env node
/**
 * Turns captures into one HTML page a person can watch: each capture plays as
 * a little film, and two captures of the same shot play side by side, frame
 * for frame, with pause, slow motion and a scrubber. The page has no
 * dependencies and no links out: open it from disk or send it to someone.
 *
 * (The contact sheets are for a model, which cannot watch. This is for the
 * person who can.)
 *
 *   node scripts/motion/flipbook.mjs motion-out/fight-set/before motion-out/fight-set/r2
 *   node scripts/motion/flipbook.mjs --pair "A Set lands|motion-out/fight-set/before|motion-out/fight-set/r2" \
 *        --pair "The preview opens|motion-out/preview-open/before|motion-out/preview-open/r1" --out night.html
 *        [--width 240] [--every 1] [--quality 0.6] [--title "Motion review"]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { frameName, num, parseArgs, readJson } from './lib.mjs';

function activeRange(capture) {
  const live = capture.activity.slice(capture.preroll);
  const ambient = capture.ambient ?? (capture.preroll > 1 ? Math.max(0, ...capture.activity.slice(1, capture.preroll)) : 0);
  const quiet = ambient * 1.5 + 2;
  let last = 0;
  live.forEach((v, i) => {
    if (v > quiet) last = i;
  });
  return last;
}

/** One capture as JPEG frames (data URLs), drawn small: a film, not evidence. */
async function loadClip(page, dir, { from, to, every, width, quality }) {
  const capture = readJson(path.join(dir, 'capture.json'));
  const frames = [];
  for (let i = from; i <= Math.min(to, capture.frames - 1); i += every) {
    const file = path.join(dir, 'frames', frameName(i));
    if (!fs.existsSync(file)) break;
    frames.push({ index: i, file });
  }
  // The frames go to the page as data, in small batches (a canvas may not export pictures it loaded from disk)
  const urls = [];
  for (let at = 0; at < frames.length; at += 12) {
    const batch = frames.slice(at, at + 12).map(f => `data:image/png;base64,${fs.readFileSync(f.file).toString('base64')}`);
    urls.push(
      ...(await page.evaluate(
        async ({ list, width, quality }) => {
          const out = [];
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          for (const src of list) {
            const img = new Image();
            img.src = src;
            await img.decode();
            const scale = width / img.naturalWidth;
            canvas.width = width;
            canvas.height = Math.round(img.naturalHeight * scale);
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            out.push(canvas.toDataURL('image/jpeg', quality));
          }
          return out;
        },
        { list: batch, width, quality }
      ))
    );
  }
  return { label: capture.label, sha: capture.sha, shot: capture.shot.id, step: capture.step, indices: frames.map(f => f.index), urls };
}

const PLAYER = `
(() => {
  const SPEEDS = [1, 0.5, 0.25, 0.1];
  for (const el of document.querySelectorAll('.film')) {
    const data = JSON.parse(el.querySelector('script[type="application/json"]').textContent);
    const imgs = [...el.querySelectorAll('img.frame')];
    const label = el.querySelector('.label');
    const range = el.querySelector('input[type=range]');
    const play = el.querySelector('.play');
    const speed = el.querySelector('.speed');
    const count = Math.max(...data.clips.map(c => c.urls.length));
    range.max = String(count - 1);
    let i = 0, playing = true, rate = 1, last = 0, acc = 0, hold = 0;
    const show = () => {
      data.clips.forEach((c, k) => { imgs[k].src = c.urls[Math.min(i, c.urls.length - 1)]; });
      const frame = data.clips[0].indices[Math.min(i, data.clips[0].indices.length - 1)];
      label.textContent = (frame < 0 ? 'before the tap' : 'f' + frame + ' · ' + Math.round(frame * data.step) + ' ms');
      range.value = String(i);
    };
    const tick = now => {
      if (playing) {
        acc += (now - last) * rate;
        const per = data.step * data.every;
        while (acc >= per) {
          acc -= per;
          if (hold > 0) { hold--; continue; }
          i++;
          if (i >= count) { i = 0; hold = Math.round(500 / per); }
        }
        show();
      }
      last = now;
      requestAnimationFrame(tick);
    };
    play.onclick = () => { playing = !playing; play.textContent = playing ? 'Pause' : 'Play'; };
    speed.onclick = () => { rate = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length]; speed.textContent = rate === 1 ? 'Full speed' : rate + '× speed'; };
    range.oninput = () => { playing = false; play.textContent = 'Play'; i = Number(range.value); show(); };
    show();
    requestAnimationFrame(t => { last = t; requestAnimationFrame(tick); });
  }
})();`;

const CSS = `
:root{--bg:#f6f3ec;--ink:#22252b;--soft:#6b6f78;--card:#fff;--line:#d9d4c7;--accent:#0f766e}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#16181c;--ink:#eceae4;--soft:#a2a6ae;--card:#20232a;--line:#343842;--accent:#5eead4}}
:root[data-theme="dark"]{--bg:#16181c;--ink:#eceae4;--soft:#a2a6ae;--card:#20232a;--line:#343842;--accent:#5eead4}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 -apple-system,system-ui,Segoe UI,sans-serif}
main{max-width:980px;margin:0 auto;padding:20px 16px 60px}h1{font-size:22px;margin:8px 0 4px}h2{font-size:17px;margin:0 0 2px}
p{margin:6px 0;color:var(--soft)}.film{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:14px;margin:18px 0}
.screens{display:flex;gap:12px;flex-wrap:wrap;margin-top:10px}.screen{flex:1 1 150px;min-width:140px;max-width:300px}
.screen b{display:block;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:var(--soft);margin-bottom:4px}
.screen img{display:block;width:100%;height:auto;border-radius:8px;border:1px solid var(--line);background:#fff}
.bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}
button{font:inherit;font-weight:600;color:var(--ink);background:transparent;border:1.5px solid var(--line);border-radius:8px;padding:6px 12px;min-height:36px;cursor:pointer}
button:hover{border-color:var(--accent)}input[type=range]{flex:1 1 160px;accent-color:var(--accent);min-width:120px}
.label{font-variant-numeric:tabular-nums;color:var(--soft);min-width:120px}`;

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export async function buildFlipbook(pairs, options = {}) {
  const width = options.width ?? 240;
  const quality = options.quality ?? 0.6;
  const every = options.every ?? 1;
  const out = options.out ?? path.join(path.dirname(pairs[0].dirs[0]), 'flipbook.html');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const stub = out.replace(/\.html$/, '.loading.html');
  fs.writeFileSync(stub, '<!doctype html><meta charset="utf-8"><title>loading</title>');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(pathToFileURL(stub).href);

  const sections = [];
  for (const pair of pairs) {
    const captures = pair.dirs.map(d => readJson(path.join(d, 'capture.json')));
    const to = (options.to ?? Math.max(...captures.map(activeRange))) + 12;
    const from = options.from ?? -Math.min(4, ...captures.map(c => c.preroll));
    const clips = [];
    for (const dir of pair.dirs) clips.push(await loadClip(page, dir, { from, to, every, width, quality }));
    const data = { step: clips[0].step, every, clips: clips.map(c => ({ urls: c.urls, indices: c.indices })) };
    sections.push(
      `<section class="film"><h2>${esc(pair.title)}</h2>${pair.note ? `<p>${esc(pair.note)}</p>` : ''}` +
        `<div class="screens">${clips.map(c => `<div class="screen"><b>${esc(c.label)} · ${esc(c.sha)}</b><img class="frame" alt="${esc(c.shot)} ${esc(c.label)}"></div>`).join('')}</div>` +
        `<div class="bar"><button class="play">Pause</button><button class="speed">Full speed</button><input type="range" min="0" value="0" aria-label="Frame"><span class="label"></span></div>` +
        `<script type="application/json">${JSON.stringify(data)}</script></section>`
    );
  }
  await browser.close();
  fs.rmSync(stub, { force: true });
  const title = options.title ?? 'Motion flipbook';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${CSS}</style></head><body><main><h1>${esc(title)}</h1>${options.intro ? `<p>${esc(options.intro)}</p>` : ''}${sections.join('')}</main><script>${PLAYER}</script></body></html>`;
  fs.writeFileSync(out, html);
  return { out, bytes: Buffer.byteLength(html) };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const raw = process.argv.slice(2);
  const pairs = [];
  raw.forEach((a, i) => {
    if (a !== '--pair' || !raw[i + 1]) return;
    const [title, ...dirs] = raw[i + 1].split('|');
    pairs.push({ title, dirs: dirs.map(d => path.resolve(d)) });
  });
  if (!pairs.length) {
    if (!args._.length) throw new Error('usage: node scripts/motion/flipbook.mjs <captureDir> [<captureDir>] [--out file.html]  |  --pair "Title|dirA|dirB" …');
    const dirs = args._.map(d => path.resolve(d));
    pairs.push({ title: readJson(path.join(dirs[0], 'capture.json')).shot.id, dirs });
  }
  const result = await buildFlipbook(pairs, {
    out: typeof args.out === 'string' ? path.resolve(args.out) : undefined,
    width: num(args.width, 240),
    quality: num(args.quality, 0.6),
    every: num(args.every, 1),
    from: args.from !== undefined ? num(args.from, 0) : undefined,
    to: args.to !== undefined ? num(args.to, 0) : undefined,
    title: typeof args.title === 'string' ? args.title : undefined,
  });
  console.log(`${path.relative(process.cwd(), result.out)}  (${Math.round(result.bytes / 1024)} KB)`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(e => {
    console.error(String(e && e.message ? e.message : e));
    process.exit(1);
  });
}
