#!/usr/bin/env node
/**
 * Turns a capture (scripts/motion/capture.mjs) into numbers: when the picture
 * first answered the trigger, how long it moved, which elements moved and on
 * what kind of curve, and a list of machine-detected hints (linear moves,
 * pops, hard stops, dead stretches). The model cannot feel motion, so it
 * measures it: notes are written in frames, not feelings.
 *
 *   node scripts/motion/analyze.mjs motion-out/<shot>/<label>
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJson, round, sparkline } from './lib.mjs';

/** Thresholds live here, in one place. */
export const RULES = {
  /** The picture must answer a tap within this many frames (6 × 16 ms ≈ 100 ms) */
  responseFrames: 6,
  /** Nothing changing for this long between two active stretches is a dead stretch */
  deadFrames: 12,
  /** A move this long at constant speed is called linear */
  linearMinFrames: 6,
  /** Coefficient of variation of the speed under which a move is linear */
  linearCv: 0.2,
  /** A move that ends at more than this share of its top speed stops hard */
  hardStopRatio: 0.55,
  /** A mover must travel this far (px), or change size / opacity / angle this much, to count */
  minTravel: 4,
  minScale: 0.04,
  minOpacity: 0.1,
  minRotation: 3,
  /** This many movers starting on the same frame with no later starts reads as "everything at once" */
  allAtOnce: 4,
};

const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const std = a => {
  const m = mean(a);
  return Math.sqrt(mean(a.map(v => (v - m) ** 2)));
};

/**
 * Describe one scalar series (already limited to the frames the element exists).
 * Returns null when nothing changes; else a transition (A→B) or a pulse (A→peak→A).
 */
function describeSeries(values, frames, { eps, minChange }) {
  const n = values.length;
  if (n < 2) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (hi - lo < minChange) return null;
  // The frames where it actually changes
  let a = -1;
  let b = -1;
  for (let i = 1; i < n; i++) {
    if (Math.abs(values[i] - values[i - 1]) > eps) {
      if (a < 0) a = i - 1;
      b = i;
    }
  }
  if (a < 0) return null;
  const start = values[a];
  const end = values[b];
  const span = b - a;
  const net = end - start;
  const range = hi - lo;
  const out = { from: frames[a], to: frames[b], frames: span, start, end, lo, hi };

  if (Math.abs(net) < range * 0.35) {
    // Goes out and comes back: a pulse, a shake or a loop
    let reversals = 0;
    let lastSign = 0;
    for (let i = a + 1; i <= b; i++) {
      const d = values[i] - values[i - 1];
      const sign = Math.abs(d) <= eps ? 0 : Math.sign(d);
      if (sign && lastSign && sign !== lastSign) reversals++;
      if (sign) lastSign = sign;
    }
    const peakValue = Math.abs(hi - start) >= Math.abs(lo - start) ? hi : lo;
    const peakAt = frames[values.indexOf(peakValue)];
    return { ...out, kind: reversals > 2 ? 'oscillation' : 'pulse', reversals, peak: peakValue, peakAt };
  }

  // A to B. Progress 0→1 and its speed per frame.
  const p = [];
  for (let i = a; i <= b; i++) p.push((values[i] - start) / net);
  const v = [];
  for (let i = 1; i < p.length; i++) v.push(p[i] - p[i - 1]);
  const speed = v.map(Math.abs);
  const top = Math.max(...speed);
  const topAt = speed.indexOf(top) / Math.max(1, speed.length - 1);
  const overshoot = Math.max(0, Math.max(...p) - 1);
  const undershoot = Math.max(0, -Math.min(...p));
  const cv = mean(speed) > 0 ? std(speed) / mean(speed) : 0;
  const endRatio = top > 0 ? speed[speed.length - 1] / top : 0;
  const startRatio = top > 0 ? speed[0] / top : 0;
  let curve;
  if (span <= 2) curve = 'instant';
  else if (overshoot > 0.02) curve = 'overshoot';
  else if (span >= RULES.linearMinFrames && cv < RULES.linearCv) curve = 'linear';
  else if (topAt < 0.34) curve = 'ease-out';
  else if (topAt > 0.66) curve = 'ease-in';
  else curve = 'ease-in-out';
  return { ...out, kind: 'transition', curve, overshoot, undershoot, cv, endRatio, startRatio };
}

function analyzeTrack(track, step) {
  const s = track.s; // [frame, x, y, w, h, opacity, rotation]
  const live = s.filter(r => r[0] >= 0);
  if (live.length < 2) return null;
  const frames = live.map(r => r[0]);
  const xs = live.map(r => r[1]);
  const ys = live.map(r => r[2]);
  const size = live.map(r => Math.sqrt(Math.max(1, r[3]) * Math.max(1, r[4])));
  const opacity = live.map(r => r[5]);
  const rot = live.map(r => r[6]);

  // Position: progress along the straight line from where it starts to where it ends
  let a = -1;
  let b = -1;
  let pathLen = 0;
  for (let i = 1; i < live.length; i++) {
    const d = Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    pathLen += d;
    if (d > 0.3) {
      if (a < 0) a = i - 1;
      b = i;
    }
  }
  let pos = null;
  if (a >= 0 && pathLen >= RULES.minTravel) {
    const dx = xs[b] - xs[a];
    const dy = ys[b] - ys[a];
    const chord = Math.hypot(dx, dy);
    if (chord >= pathLen * 0.35 && chord >= RULES.minTravel) {
      const along = [];
      let bow = 0;
      for (let i = a; i <= b; i++) {
        const px = xs[i] - xs[a];
        const py = ys[i] - ys[a];
        along.push((px * dx + py * dy) / chord);
        bow = Math.max(bow, Math.abs(px * dy - py * dx) / chord);
      }
      const d = describeSeries(along, frames.slice(a, b + 1), { eps: 0.3, minChange: RULES.minTravel });
      if (d) pos = { ...d, travel: round(chord), path: round(pathLen), dx: round(dx), dy: round(dy), bow: round(bow), arc: bow > chord * 0.08 };
    } else {
      // Moves a lot but ends near where it began: a shake or a hop
      const dist = live.map((_, i) => Math.hypot(xs[i] - xs[a], ys[i] - ys[a]));
      const d = describeSeries(dist, frames, { eps: 0.3, minChange: RULES.minTravel });
      if (d) pos = { ...d, kind: d.kind === 'transition' ? 'pulse' : d.kind, travel: round(Math.max(...dist)), path: round(pathLen) };
    }
  }

  const base = size[0] || 1;
  const scale = describeSeries(size.map(v => v / base), frames, { eps: 0.003, minChange: RULES.minScale });
  const fade = describeSeries(opacity, frames, { eps: 0.004, minChange: RULES.minOpacity });
  const turn = describeSeries(rot, frames, { eps: 0.2, minChange: RULES.minRotation });
  if (!pos && !scale && !fade && !turn) return null;

  const area = Math.max(...live.map(r => r[3] * r[4]));
  const salience =
    Math.sqrt(area) *
    ((pos ? pos.path / 20 : 0) + (scale ? Math.abs(scale.hi - scale.lo) * 8 : 0) + (fade ? Math.abs(fade.hi - fade.lo) * 2 : 0) + (turn ? (turn.hi - turn.lo) / 30 : 0));
  const parts = [pos, scale, fade, turn].filter(Boolean);
  const from = Math.min(...parts.map(q => q.from));
  const to = Math.max(...parts.map(q => q.to));
  const head = live[0];
  return {
    id: track.id,
    label: `${track.label} ${Math.round(head[3])}×${Math.round(head[4])}`,
    at: [Math.round(head[1]), Math.round(head[2])],
    appears: track.first > 0 ? track.first : null,
    leaves: track.gone ?? null,
    from,
    to,
    ms: (to - from) * step,
    pos,
    scale,
    fade,
    turn,
    area: Math.round(area),
    salience,
    firstOpacity: opacity[0],
    lastOpacity: opacity[opacity.length - 1],
    firstSize: size[0],
    peakSize: Math.max(...size),
    lastSize: size[size.length - 1],
  };
}

const f = (n, places = 2) => String(round(n, places));

/** What the element does, written without frame numbers so that elements doing the same thing can be grouped. */
function shapeOf(m, step) {
  const bits = [];
  const len = q => `${q.frames}f/${Math.round(q.frames * step)}ms`;
  const peaked = q => q.overshoot > 0.25;
  if (m.pos) {
    if (m.pos.kind === 'transition') {
      bits.push(
        `moves ${Math.round(m.pos.travel)}px ${m.pos.arc ? `on an arc (bows ${Math.round(m.pos.bow)}px)` : 'straight'} in ${len(m.pos)}, ${m.pos.curve}` +
          (m.pos.overshoot > 0.02 ? ` (+${Math.round(m.pos.overshoot * 100)}%)` : '')
      );
    } else bits.push(`${m.pos.kind === 'oscillation' ? `shakes ±${Math.round(m.pos.travel)}px, ${m.pos.reversals} reversals` : `hops ${Math.round(m.pos.travel)}px and back`} in ${len(m.pos)}`);
  }
  if (m.scale) {
    if (m.scale.kind === 'transition' && !peaked(m.scale))
      bits.push(`scale ×${f(m.scale.start)}→×${f(m.scale.end)} in ${len(m.scale)}, ${m.scale.curve}` + (m.scale.overshoot > 0.02 ? ` (+${Math.round(m.scale.overshoot * 100)}%)` : ''));
    else if (m.scale.kind === 'transition') bits.push(`scale ×${f(m.scale.start)}→peak ×${f(m.scale.hi)}→×${f(m.scale.end)} in ${len(m.scale)}`);
    else bits.push(`scale ${m.scale.kind} ×${f(m.scale.start)}→×${f(m.scale.peak)}→×${f(m.scale.end)} in ${len(m.scale)} (peak +${m.scale.peakAt - m.scale.from}f)`);
  }
  if (m.fade) {
    if (m.fade.kind === 'transition') bits.push(`opacity ${f(m.fade.start)}→${f(m.fade.end)} in ${len(m.fade)}`);
    else bits.push(`opacity ${f(m.fade.start)}→${f(m.fade.peak)}→${f(m.fade.end)} in ${len(m.fade)}`);
  }
  if (m.turn) {
    if (m.turn.kind === 'transition') bits.push(`turns ${f(m.turn.start, 0)}°→${f(m.turn.end, 0)}° in ${len(m.turn)}, ${m.turn.curve}`);
    else bits.push(`rocks ${f(m.turn.lo, 0)}°…${f(m.turn.hi, 0)}° in ${len(m.turn)}`);
  }
  return bits.join(' · ');
}

/** Elements that do the same thing become one line with all their start frames: the stagger is then plain to see. */
function groupMovers(movers, step) {
  const groups = new Map();
  for (const m of movers) {
    const shape = shapeOf(m, step);
    const key = `${m.label}|${shape}|${m.appears != null}|${m.leaves != null}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = { label: m.label, shape, members: [], salience: 0 }));
    g.members.push(m);
    g.salience = Math.max(g.salience, m.salience);
  }
  return [...groups.values()].sort((a, b) => b.salience - a.salience);
}

function describeGroup(g) {
  const ms = g.members.slice().sort((a, b) => a.from - b.from);
  const first = ms[0];
  const starts = ms.map(m => `f${m.from}`);
  const life = [first.appears != null ? `mounts f${[...new Set(ms.map(m => m.appears))].join(',')}` : '', first.leaves != null ? `unmounts f${[...new Set(ms.map(m => m.leaves))].join(',')}` : ''].filter(Boolean).join(', ');
  const who = ms.length > 1 ? `${ms.length}× ${g.label}` : `${g.label} @${first.at[0]},${first.at[1]}`;
  const when = ms.length > 1 ? `starts ${starts.slice(0, 10).join(' ')}${starts.length > 10 ? ' …' : ''}` : `f${first.from}→f${first.to}`;
  return `**${who}** — ${g.shape} — ${when}${life ? ` [${life}]` : ''}`;
}

function hintsFor(movers, timeline, capture) {
  const raw = [];
  const add = (code, at, who, text) => raw.push({ code, at, who, text });
  const step = capture.step;
  const boxes = capture.boxes ?? [];
  /** Did the picture change inside this element's box on that frame? (An invisible wrapper never pops.) */
  const changedAt = (frame, m) => {
    const b = boxes[frame + capture.preroll];
    if (!b) return false;
    const half = Math.sqrt(m.area) / 2 + 6;
    return b[0] < m.at[0] + half && b[0] + b[2] > m.at[0] - half && b[1] < m.at[1] + half && b[1] + b[3] > m.at[1] - half;
  };

  if (timeline.firstChange == null) add('NO-CHANGE', 0, '', 'Nothing on screen changed after the trigger. Wrong trigger, wrong clip, or the effect is off.');
  else if (timeline.firstChange > RULES.responseFrames)
    add('SLOW-RESPONSE', timeline.firstChange, '', `First visible change is f${timeline.firstChange} (${timeline.firstChange * step} ms after the trigger). A tap should be answered within ${RULES.responseFrames} frames (~100 ms).`);
  for (const d of timeline.dead) add('DEAD-STRETCH', d.from, '', `Nothing changes f${d.from}–f${d.to} (${(d.to - d.from + 1) * step} ms) in the middle of the effect.`);

  for (const m of movers) {
    for (const [name, q] of [['position', m.pos], ['scale', m.scale]]) {
      if (!q || q.kind !== 'transition') continue;
      if (q.curve === 'linear') add('LINEAR', q.from, m.label, `${name} changes at constant speed for ${q.frames} frames. Use a spring or an ease; linear is for rotation, progress bars and loop phase only.`);
      else if ((q.curve === 'ease-out' || q.curve === 'ease-in-out') && q.endRatio > RULES.hardStopRatio && q.frames >= 5 && q.to < capture.frames - 1)
        add('HARD-STOP', q.to, m.label, `${name} is still at ${Math.round(q.endRatio * 100)}% of its top speed on its last frame, then stops dead. Let it settle (a spring, or a longer ease-out).`);
      if (q.curve === 'instant' && (name === 'position' ? Math.abs(q.end - q.start) >= 24 : Math.abs(q.end - q.start) >= 0.2) && changedAt(q.to, m))
        add('JUMP', q.from, m.label, `${name} jumps in ${q.frames} frame(s). A teleport, unless it is meant as a cut.`);
    }
    if (m.fade && m.fade.kind !== 'transition' && m.fade.frames <= 8 && Math.abs(m.fade.peak - m.fade.start) > 0.15 && m.fade.reversals > 1)
      add('FLICKER', m.fade.from, m.label, `opacity reverses ${m.fade.reversals} times within ${m.fade.frames} frames. Opacity must not bounce: it reads as a flicker.`);
    const entersMoving = (m.pos && m.pos.from <= (m.appears ?? 0) + 1) || (m.scale && m.scale.from <= (m.appears ?? 0) + 1);
    if (m.appears != null && m.firstOpacity >= 0.9 && !entersMoving && changedAt(m.appears, m))
      add('POP-IN', m.appears, m.label, 'appears at full size and opacity in one frame, with no entrance.');
    const leavesMoving = (m.pos && m.pos.to >= (m.leaves ?? 0) - 2) || (m.scale && m.scale.to >= (m.leaves ?? 0) - 2);
    if (m.leaves != null && m.lastOpacity >= 0.9 && !leavesMoving && changedAt(m.leaves, m))
      add('POP-OUT', m.leaves, m.label, 'is still at full size and opacity on its last frame, then gone. No exit.');
    if (m.fade && m.fade.kind === 'transition' && !m.pos && !m.scale && !m.turn && m.area > 2500)
      add('FADE-ONLY', m.fade.from, m.label, `only its opacity changes (${f(m.fade.start)}→${f(m.fade.end)}). A plain fade is the default look; give it a move or a scale with a purpose, or leave it if it is a backdrop.`);
  }

  // Everything starts on the same frame
  const big = movers.filter(m => m.salience > 8);
  const byStart = new Map();
  for (const m of big) byStart.set(m.from, (byStart.get(m.from) ?? 0) + 1);
  for (const [frame, count] of byStart) {
    if (count >= RULES.allAtOnce && byStart.size <= 2)
      add('ALL-AT-ONCE', frame, '', `${count} elements start moving on f${frame} and almost nothing starts later. Stagger them (start the next when the previous is 30–50% done) or pick one hero.`);
  }
  if (capture.seam && capture.seam.ratio > 0.002)
    add('LOOP-SEAM', capture.seam.frame, '', `frame f${capture.seam.frame} differs from f0 in ${f(capture.seam.ratio * 100)}% of pixels. The last frame of a loop must flow into the first.`);

  // The same finding on many elements is one finding
  const merged = new Map();
  for (const h of raw) {
    const key = `${h.code}|${h.who}|${h.text}`;
    const m = merged.get(key);
    if (m) m.frames.push(h.at);
    else merged.set(key, { code: h.code, who: h.who, text: h.text, frames: [h.at] });
  }
  return [...merged.values()]
    .map(h => ({ ...h, at: Math.min(...h.frames) }))
    .sort((x, y) => x.at - y.at);
}

export function analyze(dir) {
  const capture = readJson(path.join(dir, 'capture.json'));
  const { step, activity } = capture;
  // activity[k] belongs to frame (k - preroll): how much changed since the frame before it
  const pre = capture.preroll;
  const live = activity.slice(pre);
  const ambient = capture.ambient ?? (pre > 1 ? Math.max(0, ...activity.slice(1, pre)) : 0);
  const quiet = ambient * 1.5 + 2;
  let firstChange = null;
  let lastChange = null;
  live.forEach((v, i) => {
    if (v > quiet) {
      if (firstChange == null) firstChange = i;
      lastChange = i;
    }
  });
  const dead = [];
  if (firstChange != null) {
    let run = null;
    for (let i = firstChange; i <= lastChange; i++) {
      if (live[i] <= quiet) run = run ?? i;
      else {
        if (run != null && i - run >= RULES.deadFrames) dead.push({ from: run, to: i - 1 });
        run = null;
      }
    }
  }
  const timeline = { firstChange, lastChange, ambient, dead, activeFrames: firstChange == null ? 0 : lastChange - firstChange + 1 };

  const movers = capture.tracks
    .map(t => analyzeTrack(t, step))
    .filter(Boolean)
    .sort((a, b) => b.salience - a.salience);
  const hints = hintsFor(movers, timeline, capture);

  const lines = [];
  const total = capture.frames;
  lines.push(`# Motion capture: ${capture.shot.id}  [${capture.label}]  @ ${capture.sha}`);
  lines.push('');
  lines.push(`${capture.shot.about ?? ''}`.trim());
  lines.push(`url ${capture.url} · ${total} frames × ${step} ms = ${total * step} ms · viewport ${capture.viewport.width}×${capture.viewport.height}` + (capture.reduced ? ' · REDUCED MOTION' : '') + (capture.seed != null ? ` · random seed ${capture.seed}` : ''));
  lines.push('');
  lines.push('## Timeline (one mark per frame from f0; height = how much of the picture changed)');
  lines.push('');
  lines.push('```');
  for (let i = 0; i < live.length; i += 50) lines.push(`f${String(i).padStart(3, '0')} ${sparkline(live.slice(i, i + 50))}`);
  lines.push('```');
  if (firstChange == null) lines.push('- Nothing changed after the trigger.');
  else {
    lines.push(`- Response: first visible change on **f${firstChange}** (${firstChange * step} ms after the trigger).`);
    lines.push(`- Length: last change on **f${lastChange}** (${lastChange * step} ms). Active for ${timeline.activeFrames} frames (${timeline.activeFrames * step} ms).`);
    lines.push(dead.length ? `- Dead stretches: ${dead.map(d => `f${d.from}–f${d.to}`).join(', ')}.` : '- No dead stretch inside the effect.');
  }
  if (ambient > 0) lines.push(`- Ambient motion before the trigger: up to ${ambient} px per frame (subtracted above).`);
  if (capture.stopped) lines.push(`- Capture ${capture.stopped}.`);
  if (capture.determinism) lines.push(`- Determinism: ${capture.determinism}`);
  lines.push('');
  const groups = groupMovers(movers, step);
  lines.push(`## Movers (${movers.length} elements in ${groups.length} groups, biggest first; size is the element's box at the start)`);
  lines.push('');
  if (!movers.length) lines.push('_No tracked element moved. (Canvas / SVG-internal motion is not tracked per element; read the strip.)_');
  groups.slice(0, 16).forEach((g, i) => lines.push(`${i + 1}. ${describeGroup(g)}`));
  if (groups.length > 16) lines.push(`…and ${groups.length - 16} smaller groups (see analysis.json).`);
  lines.push('');
  lines.push('## Hints (machine-detected; confirm each one on the strip before acting)');
  lines.push('');
  if (!hints.length) lines.push('_None._');
  hints.slice(0, 20).forEach(h => {
    const frames = [...new Set(h.frames)].sort((a, b) => a - b);
    const when = frames.length > 1 ? `f${frames[0]}–f${frames[frames.length - 1]} (×${h.frames.length})` : `f${frames[0]}`;
    lines.push(`- **${h.code}** ${when}${h.who ? ` · ${h.who}` : ''}: ${h.text}`);
  });
  if (hints.length > 20) lines.push(`- …and ${hints.length - 20} more (see analysis.json).`);
  lines.push('');
  if (capture.cues) {
    lines.push('## Sound cues (when each will be heard; a cue belongs on its picture\'s frame or one frame after, never before)');
    lines.push('');
    if (!capture.cues.length) lines.push('_None after the trigger._');
    const byName = new Map();
    for (const c of capture.cues) byName.set(c.name, [...(byName.get(c.name) ?? []), c.frame]);
    for (const [name, frames] of byName) lines.push(`- \`${name}\`: ${frames.slice(0, 14).map(fr => `f${fr}`).join(' ')}${frames.length > 14 ? ' …' : ''}`);
    lines.push('');
  }
  const report = lines.join('\n');
  fs.writeFileSync(path.join(dir, 'report.md'), report + '\n');
  fs.writeFileSync(path.join(dir, 'analysis.json'), JSON.stringify({ timeline, groups: groups.map(g => ({ label: g.label, shape: g.shape, starts: g.members.map(m => m.from) })), movers, hints }, null, 1));
  return { report, timeline, movers, hints, capture };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node scripts/motion/analyze.mjs motion-out/<shot>/<label>');
    process.exit(2);
  }
  console.log(analyze(path.resolve(dir)).report);
}
