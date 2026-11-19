#!/usr/bin/env node
/**
 * Frame-exact capture of a running NShapes animation.
 *
 * The page never sees a real clock. Playwright's `page.clock` replaces Date,
 * timers, performance.now and requestAnimationFrame before the app boots, and
 * time only moves when this script moves it: in 16 ms steps while it waits for
 * the screen, then one step per captured frame after the shot's trigger. Each
 * frame is screenshotted and every animated element is measured. The same
 * shot therefore gives the same frames on any machine, however slow, so
 * "frame 12" means something and a before/after comparison is fair.
 *
 *   node scripts/motion/capture.mjs <shot> [--label before] [--base http://localhost:8099]
 *        [--frames auto|N] [--max 240] [--step 16] [--preroll 8] [--dpr 1]
 *        [--reduced] [--twice] [--no-seed] [--no-sheets] [--headed]
 *   node scripts/motion/capture.mjs --list
 *
 * Output: motion-out/<shot>/<label>/{frames/*.png, capture.json, report.md,
 * contact.png, strip.png}. Read report.md first, then the sheets.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { chromium } from 'playwright';
import { DEFAULT_BASE, FRAME_MS, OUT_ROOT, PHONE, decodePng, diffFrames, frameName, gitSha, num, padBox, parseArgs, png, unionBox, writeJson } from './lib.mjs';
import { analyze } from './analyze.mjs';
import { buildDefaultSheets } from './sheet.mjs';
import { describeShots, resolveShot } from './shots.mjs';

/** Every capture starts at the same instant, so anything that reads the date is the same too. */
const EPOCH = Date.UTC(2026, 0, 15, 20, 0, 0);

/**
 * Runs in the page. Seeded random numbers: the same particles, blinks and
 * fidgets on every capture. Each place in the code that calls Math.random gets
 * its own stream (keyed by the caller's line), so one consumer drawing an extra
 * number (a component that happened to render once more) cannot shift the
 * numbers every other consumer gets.
 */
function seedRandom(seed) {
  const streams = new Map();
  const make = s => () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const hash = text => {
    let h = seed >>> 0;
    for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
    return h >>> 0;
  };
  Math.random = () => {
    const stack = new Error().stack || '';
    const first = stack.indexOf('\n');
    const second = stack.indexOf('\n', first + 1);
    const third = stack.indexOf('\n', second + 1);
    const site = second < 0 ? 'unknown' : stack.slice(second + 1, third < 0 ? undefined : third);
    let stream = streams.get(site);
    if (!stream) streams.set(site, (stream = make(hash(site))));
    return stream();
  };
}

/** Runs in the page. Installs the per-frame probes on `window.__motion`. */
function installProbes() {
  // This script is registered before the virtual clock, so these are still the browser's own
  const nativeRaf = window.requestAnimationFrame.bind(window);
  const state = { ids: new WeakMap(), next: 1, fresh: [], anims: new WeakMap() };
  const describe = el => {
    const own = el.getAttribute && el.getAttribute('data-testid');
    const near = !own && el.closest ? el.closest('[data-testid]') : null;
    const tag = el.tagName ? el.tagName.toLowerCase() : 'node';
    const aria = el.getAttribute && el.getAttribute('aria-label');
    let text = '';
    if (el.childElementCount <= 4) text = (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 22);
    const where = own ? `#${own}` : near ? `${near.getAttribute('data-testid')}›${tag}` : tag;
    return where + (aria ? ` [${aria.slice(0, 22)}]` : '') + (text ? ` "${text}"` : '');
  };
  const SELECTOR = '[style*="transform"],[style*="opacity"]';
  const measure = extra => {
    const rows = [];
    const seen = new Set();
    const memo = new Map();
    // What the eye gets: an element inside a faded parent is faded too
    const shown = el => {
      if (!el || el === document.documentElement) return 1;
      let v = memo.get(el);
      if (v !== undefined) return v;
      const cs = getComputedStyle(el);
      v = cs.display === 'none' || cs.visibility === 'hidden' ? 0 : Number(cs.opacity) * shown(el.parentElement);
      memo.set(el, v);
      return v;
    };
    const visit = el => {
      if (seen.has(el)) return;
      seen.add(el);
      const r = el.getBoundingClientRect();
      if (r.width < 1 && r.height < 1) return;
      let id = state.ids.get(el);
      if (!id) {
        id = state.next++;
        state.ids.set(el, id);
        state.fresh.push([id, describe(el)]);
      }
      let angle = 0;
      const t = getComputedStyle(el).transform;
      if (t && t !== 'none') {
        const m = t.match(/matrix(3d)?\(([^)]+)\)/);
        if (m) {
          const v = m[2].split(',').map(Number);
          angle = Math.round(Math.atan2(v[1], v[0]) * (1800 / Math.PI)) / 10;
        }
      }
      rows.push([id, Math.round((r.x + r.width / 2) * 10) / 10, Math.round((r.y + r.height / 2) * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10, Math.round(shown(el) * 1000) / 1000, angle]);
    };
    document.querySelectorAll(SELECTOR).forEach(visit);
    for (const sel of extra || []) document.querySelectorAll(sel).forEach(visit);
    const fresh = state.fresh;
    state.fresh = [];
    return { rows, fresh };
  };
  /** CSS animations and transitions run on the real clock: hold each one and move it by hand. */
  const sync = (virtualNow, step) => {
    let count = 0;
    for (const a of document.getAnimations()) {
      count++;
      let info = state.anims.get(a);
      if (!info) {
        info = { t0: virtualNow - step };
        state.anims.set(a, info);
        try {
          a.pause();
        } catch {
          /* already finished */
        }
      }
      const local = Math.max(0, virtualNow - info.t0);
      try {
        const end = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming().endTime : Infinity;
        if (Number.isFinite(end) && local >= end) a.finish();
        else a.currentTime = local;
      } catch {
        /* an animation that cannot be moved is left alone */
      }
    }
    for (const svg of document.querySelectorAll('svg')) {
      if (svg.querySelector && svg.querySelector('animate,animateTransform,animateMotion,set')) {
        try {
          svg.pauseAnimations();
          svg.setCurrentTime(virtualNow / 1000);
        } catch {
          /* no SMIL here */
        }
      }
    }
    return count;
  };
  /**
   * Let the page finish what the last step of time started, before it is
   * measured or photographed. Two things run on real time whatever the clock
   * says: React's scheduler (a MessageChannel) and layout callbacks
   * (ResizeObserver, which is what `onLayout` is on the web, delivered once per
   * real frame). So: wait for real frames, and for a generous number of
   * scheduler turns after each. Without this the same shot gives slightly
   * different frames from run to run.
   */
  const turns = n =>
    new Promise(resolve => {
      let hops = n;
      const hop = () => {
        if (--hops <= 0) return resolve(true);
        const c = new MessageChannel();
        c.port1.onmessage = hop;
        c.port2.postMessage(0);
      };
      hop();
    });
  const realFrame = () => new Promise(resolve => nativeRaf(() => nativeRaf(() => resolve(true))));
  const flush = async () => {
    await turns(12);
    for (let i = 0; i < 2; i++) {
      await realFrame();
      await turns(12);
    }
    return true;
  };
  const present = selector => {
    for (const el of document.querySelectorAll(selector)) {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) return true;
    }
    return false;
  };
  /** Where every named part of the screen is, so a sheet can be cropped to one by name (`--roi results-stars`) */
  const regions = () => {
    const out = [];
    for (const el of document.querySelectorAll('[data-testid]')) {
      const r = el.getBoundingClientRect();
      if (r.width >= 1 && r.height >= 1) out.push([el.getAttribute('data-testid'), Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]);
    }
    return out;
  };
  window.__motion = { measure, sync, flush, present, regions };
}

/** "map-play-next" is a test id; anything that looks like CSS is used as it is. */
const toSelector = target => (/[[\].#>:= ]/.test(target) ? target : `[data-testid="${target}"]`);

async function resolveClip(page, clip, viewport) {
  if (!clip) return null;
  let box = clip;
  if (typeof clip === 'function') box = await clip(page);
  if (typeof box === 'string') box = await page.locator(toSelector(box)).first().boundingBox();
  if (!box) return null;
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const x1 = Math.min(viewport.width, Math.ceil(box.x + box.width));
  const y1 = Math.min(viewport.height, Math.ceil(box.y + box.height));
  if (x1 - x < 8 || y1 - y < 8) return null;
  return { x, y, width: x1 - x, height: y1 - y };
}

async function captureOnce(shot, opts, outDir) {
  const viewport = shot.viewport ?? PHONE;
  const step = opts.step;
  const framesDir = path.join(outDir, 'frames');
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });

  const browser = await chromium.launch({ headless: !opts.headed, args: ['--mute-audio'] });
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: opts.dpr,
    reducedMotion: opts.reduced ? 'reduce' : 'no-preference',
  });
  // Captures are not players: nothing leaves the machine
  await context.route(url => !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(url.hostname), route => route.abort());
  if (opts.seed != null) await context.addInitScript(seedRandom, opts.seed);
  await context.addInitScript(installProbes);
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', e => problems.push(String(e).slice(0, 300)));
  let inflight = 0;
  let netAt = Date.now();
  page.on('request', () => {
    inflight++;
    netAt = Date.now();
  });
  const settled = () => {
    inflight = Math.max(0, inflight - 1);
    netAt = Date.now();
  };
  page.on('requestfinished', settled);
  page.on('requestfailed', settled);

  // Time stands still from before the app boots
  await page.clock.install({ time: EPOCH });
  await page.clock.pauseAt(EPOCH + 1000);

  const inPage = (fn, arg) => page.evaluate(fn, arg).catch(() => null);
  const flush = () => inPage(() => (window.__motion ? window.__motion.flush() : null));
  const present = async target => {
    if (typeof target === 'function') return !!(await target(page));
    return !!(await inPage(s => (window.__motion ? window.__motion.present(s) : false), toSelector(target)));
  };
  let virtual = 0;
  const advance = async ms => {
    await page.clock.runFor(ms);
    virtual += ms;
    await flush();
  };
  /**
   * Wait for something to be on screen, moving time only when time is what it
   * is waiting for. While the network is busy the clock stays where it is, and
   * the first step of time is taken only after the page has done nothing for a
   * moment of real time: a screen that needs no timer to appear costs no
   * virtual time at all, so a slow machine does not change what the frames show.
   */
  const until = async (target, { timeout = 90000, chunk = step } = {}) => {
    const deadline = Date.now() + timeout;
    let stalled = Date.now();
    let moving = false;
    for (;;) {
      await flush();
      if (await present(target)) return;
      if (Date.now() > deadline) throw new Error(`Timed out after ${timeout} ms waiting for ${typeof target === 'string' ? toSelector(target) : 'a condition'} (shot "${shot.id}"). Is the route right, and does that test id exist?`);
      if (inflight > 0 && Date.now() - netAt < 1500) {
        stalled = Date.now();
        await page.waitForTimeout(20);
        continue;
      }
      if (!moving && Date.now() - stalled < 250) {
        await page.waitForTimeout(15);
        continue;
      }
      moving = true;
      await advance(chunk);
    }
  };
  const helpers = {
    base: opts.base,
    reduced: opts.reduced,
    page,
    until,
    /** Advance virtual time by hand (ms) */
    advance,
    /** Click a test id or selector */
    tap: target => page.locator(toSelector(target)).first().click(),
    /** Wait for it, then click it */
    go: async target => {
      await until(target);
      await page.locator(toSelector(target)).first().click();
      await flush();
    },
    present,
    evaluate: (fn, arg) => page.evaluate(fn, arg),
  };

  const url = opts.base.replace(/\/$/, '') + shot.path;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } catch (e) {
    await browser.close();
    throw new Error(
      `Could not open ${url}\n  ${String(e.message).split('\n')[0]}\n` +
        `  Is the web dev server running? Start it with: npx expo start --web --port ${new URL(opts.base).port || 8099}\n` +
        '  (Claude Code: preview_start "nshapes-web" from .claude/launch.json.) Pass --base to use another port.'
    );
  }
  try {
    await shot.ready(page, helpers);
    if (shot.prepare) await shot.prepare(page, helpers);
  } catch (e) {
    await page.screenshot({ path: path.join(outDir, 'stuck.png') }).catch(() => {});
    await browser.close();
    throw new Error(`${String(e.message).split('\n')[0]}\n  What the screen showed is in ${path.relative(process.cwd(), path.join(outDir, 'stuck.png'))}` + (problems.length ? `\n  Page errors: ${problems.slice(0, 3).join(' | ')}` : ''));
  }
  await advance(shot.settleMs ?? 320);
  const clip = await resolveClip(page, shot.clip, viewport);

  const bounds = clip ?? { x: 0, y: 0, width: viewport.width, height: viewport.height };
  const tracks = new Map();
  const regions = new Map();
  const noteRegions = async () => {
    for (const [name, x, y, width, height] of (await inPage(() => window.__motion.regions())) ?? []) {
      const box = { x: x - bounds.x, y: y - bounds.y, width, height };
      if (box.x + box.width < 0 || box.y + box.height < 0 || box.x > bounds.width || box.y > bounds.height) continue;
      regions.set(name, unionBox(regions.get(name) ?? null, box));
    }
  };
  const activity = [];
  const boxes = [];
  const hashes = [];
  let roi = null;
  let prev = null;
  let cssAnimations = 0;
  const canDiff = !!png();
  const startedAt = virtual;

  const grab = async index => {
    cssAnimations = Math.max(cssAnimations, (await inPage(([t, s]) => window.__motion.sync(t, s), [virtual, step])) ?? 0);
    if (index >= 0 && opts.measure) {
      const got = await inPage(extra => window.__motion.measure(extra), (shot.track ?? []).map(toSelector));
      if (got) {
        for (const [id, label] of got.fresh) tracks.set(id, { id, label, first: index, s: [], last: index });
        for (const row of got.rows) {
          const t = tracks.get(row[0]);
          if (!t) continue;
          const x = row[1] - bounds.x;
          const y = row[2] - bounds.y;
          // Outside the clip: not part of this shot
          if (x + row[3] / 2 < 0 || y + row[4] / 2 < 0 || x - row[3] / 2 > bounds.width || y - row[4] / 2 > bounds.height) continue;
          t.s.push([index, x, y, row[3], row[4], row[5], row[6]]);
          t.last = index;
        }
      }
    }
    const buffer = await page.screenshot({ clip: clip ?? undefined, type: 'png', animations: 'allow', caret: 'hide' });
    fs.writeFileSync(path.join(framesDir, frameName(index)), buffer);
    hashes.push(crypto.createHash('sha1').update(buffer).digest('hex'));
    let changed = 0;
    let box = null;
    if (canDiff) {
      const img = decodePng(buffer);
      if (prev) {
        const d = diffFrames(prev, img);
        changed = d.changed;
        box = d.box;
        if (index >= 0 && d.box) roi = unionBox(roi, d.box);
      }
      prev = img;
    }
    activity.push(changed);
    boxes.push(box ? [box.x, box.y, box.width, box.height] : null);
    return changed;
  };

  // What the screen was doing before the trigger (ambient motion is the baseline)
  for (let i = -opts.preroll; i < 0; i++) {
    if (i > -opts.preroll) await advance(step);
    await grab(i);
  }
  // A shot that starts in the middle of something (the last hit of a fight) says what "still" means itself
  const ambient = typeof shot.ambient === 'number' ? shot.ambient : opts.preroll > 1 ? Math.max(0, ...activity.slice(1)) : 0;
  const quiet = ambient * 1.5 + 2;

  // The page's own (virtual) time at the trigger: sound cues are logged against it
  const triggerAt = (await inPage(() => performance.now())) ?? 0;
  await shot.trigger(page, helpers);
  await flush();

  const actions = [...(shot.actions ?? [])].sort((a, b) => a.at - b.at);
  const fixed = opts.frames === 'auto' ? (typeof shot.frames === 'number' ? shot.frames : null) : opts.frames;
  const max = fixed ?? opts.max;
  const minFrames = shot.minFrames ?? 24;
  const quietFrames = shot.quietFrames ?? 18;
  let calm = 0;
  let count = 0;
  let stopped = fixed ? `ran its fixed ${fixed} frames` : `hit the ${max}-frame limit while still moving (pass --frames N or --max N)`;
  for (let i = 0; i < max; i++) {
    while (actions.length && actions[0].at === i) {
      await actions.shift().do(page, helpers);
      await flush();
    }
    if (i > 0) await advance(step);
    const changed = await grab(i);
    if (i % 8 === 0) await noteRegions();
    count = i + 1;
    calm = changed <= quiet ? calm + 1 : 0;
    if (!fixed && !actions.length && i >= minFrames && calm >= quietFrames) {
      stopped = `stopped by itself after ${quietFrames} still frames`;
      break;
    }
  }

  await noteRegions();

  // An element that was there and is not on the last frames has left
  for (const t of tracks.values()) if (t.last < count - 1) t.gone = t.last + 1;
  const moved = [...tracks.values()].filter(t => {
    if (!t.s.length) return false;
    if (t.first > 0 || t.gone != null) return true;
    const a = t.s[0];
    return t.s.some(r => Math.abs(r[1] - a[1]) > 0.6 || Math.abs(r[2] - a[2]) > 0.6 || Math.abs(r[3] - a[3]) > 0.6 || Math.abs(r[4] - a[4]) > 0.6 || Math.abs(r[5] - a[5]) > 0.01 || Math.abs(r[6] - a[6]) > 0.3);
  });

  let seam = null;
  if (shot.loop?.frames && canDiff && count > shot.loop.frames) {
    const a = decodePng(fs.readFileSync(path.join(framesDir, frameName(0))));
    const b = decodePng(fs.readFileSync(path.join(framesDir, frameName(shot.loop.frames))));
    const d = diffFrames(a, b, 16);
    seam = { frame: shot.loop.frames, ratio: d.changed / (a.width * a.height) };
  }

  // Sound cannot be heard here, so it is timed: in dev builds the band logs when each cue will sound
  const cueLog = (await inPage(() => (Array.isArray(window.__nshapesCueLog) ? window.__nshapesCueLog.map(c => ({ name: String(c.name), t: Number(c.t) })) : null))) ?? null;
  const cues = cueLog ? cueLog.filter(c => Number.isFinite(c.t) && c.t >= triggerAt - step).map(c => ({ name: c.name, frame: Math.round(((c.t - triggerAt) / step) * 10) / 10 })) : null;

  await browser.close();
  const capture = {
    shot: { id: shot.id, about: shot.about ?? '', path: shot.path },
    label: opts.label,
    url,
    sha: gitSha(),
    at: new Date().toISOString(),
    step,
    dpr: opts.dpr,
    viewport,
    clip,
    size: bounds,
    preroll: opts.preroll,
    ambient,
    frames: count,
    reduced: !!opts.reduced,
    seed: opts.seed,
    warmupMs: startedAt,
    stopped,
    activity,
    boxes,
    roi: roi ? padBox(roi, 10, { width: bounds.width * opts.dpr, height: bounds.height * opts.dpr }) : null,
    cssAnimations,
    regions: Object.fromEntries([...regions.entries()].map(([name, b]) => [name, [b.x, b.y, b.width, b.height]])),
    cues,
    seam,
    problems,
    tracks: moved,
  };
  writeJson(path.join(outDir, 'capture.json'), capture);
  return { capture, hashes };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.list || args._.length === 0) {
    console.log(describeShots());
    if (!args.list) console.log('\nusage: node scripts/motion/capture.mjs <shot> [--label before] [--base URL] [--frames N] [--twice] [--reduced]');
    return;
  }
  const shot = resolveShot(args._[0]);
  const opts = {
    base: typeof args.base === 'string' ? args.base : DEFAULT_BASE,
    label: typeof args.label === 'string' ? args.label : 'run',
    step: num(args.step, shot.step ?? FRAME_MS),
    preroll: num(args.preroll, shot.preroll ?? 8),
    dpr: num(args.dpr, 1),
    max: num(args.max, shot.maxFrames ?? 240),
    frames: args.frames === undefined || args.frames === 'auto' ? 'auto' : num(args.frames, 'auto'),
    reduced: !!args.reduced,
    seed: args['no-seed'] ? null : num(args.seed, 7),
    measure: !args['no-measure'],
    headed: !!args.headed,
  };
  const outDir = typeof args.out === 'string' ? path.resolve(args.out) : path.join(OUT_ROOT, shot.id.replace(/[^a-zA-Z0-9._-]+/g, '-'), opts.label);

  const first = await captureOnce(shot, opts, outDir);
  if (args.twice) {
    // The same shot twice must give the same picture. Pixels on the edge of a scaling layer may differ by a
    // hair from run to run (the browser re-rasters when it likes), so frames are compared with a tolerance,
    // and the measured positions are compared too: those do not depend on rastering at all.
    const again = await captureOnce(shot, { ...opts, frames: first.capture.frames }, outDir + '.again');
    const n = Math.min(first.hashes.length, again.hashes.length);
    const area = first.capture.size.width * first.capture.size.height * opts.dpr * opts.dpr;
    let worst = 0;
    let worstAt = null;
    let off = 0;
    for (let i = 0; i < n; i++) {
      if (first.hashes[i] === again.hashes[i]) continue;
      const name = frameName(i - opts.preroll);
      const d = diffFrames(decodePng(fs.readFileSync(path.join(outDir, 'frames', name))), decodePng(fs.readFileSync(path.join(outDir + '.again', 'frames', name))));
      if (d.changed > area * 0.004) off++;
      if (d.changed > worst) {
        worst = d.changed;
        worstAt = i - opts.preroll;
      }
    }
    // Match elements across the two runs by what and where they are, then see who moved differently
    const sign = t => `${t.label}|${t.first}|${Math.round(t.s[0]?.[1] ?? 0)},${Math.round(t.s[0]?.[2] ?? 0)}|${Math.round(t.s[0]?.[3] ?? 0)}`;
    const other = new Map();
    for (const t of again.capture.tracks) if (!other.has(sign(t))) other.set(sign(t), t);
    const strays = new Map();
    let drift = 0;
    for (const t of first.capture.tracks) {
      const u = other.get(sign(t));
      let d = 0;
      if (!u) d = Infinity;
      else {
        const byFrame = new Map(u.s.map(r => [r[0], r]));
        for (const r of t.s) {
          const q = byFrame.get(r[0]);
          if (!q) continue;
          for (let j = 1; j <= 4; j++) d = Math.max(d, Math.abs(r[j] - q[j]));
        }
      }
      if (d > 1.5) strays.set(t.label, Math.max(strays.get(t.label) ?? 0, d));
      if (Number.isFinite(d)) drift = Math.max(drift, d);
    }
    const where = worstAt == null ? '' : worstAt < 0 ? `pre${worstAt}` : `f${worstAt}`;
    const who = [...strays.entries()].sort((x, y) => y[1] - x[1]).slice(0, 6).map(([label, d]) => `${label} (${Number.isFinite(d) ? `${Math.round(d)} px` : 'only in one run'})`);
    first.capture.determinism =
      off === 0 && strays.size === 0
        ? `repeatable: a second capture matched (largest difference ${worst} px${where ? ` on ${where}` : ''}; measured positions within ${Math.round(drift * 10) / 10} px).`
        : `NOT fully repeatable: a second capture differs on ${off} of ${n} frames (worst ${worst} px on ${where}). ` +
          (strays.size
            ? `${strays.size} element group(s) moved differently: ${who.join('; ')}. If these are only idle creatures or particles, the effect itself is repeatable: compare it by its numbers. If the effect's own parts are listed, something in it reads a real clock or unseeded randomness.`
            : 'Measured positions matched, so the difference is in drawing only (an image or font arriving late, or rastering).');
    writeJson(path.join(outDir, 'capture.json'), first.capture);
    fs.rmSync(outDir + '.again', { recursive: true, force: true });
  }

  const { report } = analyze(outDir);
  let sheets = [];
  if (!args['no-sheets']) sheets = await buildDefaultSheets(outDir);
  console.log(report);
  if (first.capture.problems.length) console.log(`Page errors during capture:\n- ${first.capture.problems.slice(0, 5).join('\n- ')}\n`);
  console.log('## Files');
  console.log('');
  console.log(`- ${path.relative(process.cwd(), path.join(outDir, 'report.md'))}`);
  for (const s of sheets) console.log(`- ${path.relative(process.cwd(), s.file)}  (${s.about})`);
  console.log(`- ${path.relative(process.cwd(), path.join(outDir, 'frames'))}/f000.png … one PNG per frame (p00N.png = before the trigger)`);
}

main().catch(e => {
  console.error(String(e && e.message ? e.message : e));
  process.exit(1);
});
