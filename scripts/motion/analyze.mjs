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
import { decodePng, frameName, png, readJson, round, sparkline } from './lib.mjs';
import { resolveShot } from './shots.mjs';

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
  /** Sprite continuity gate: flag a 1-frame pixel L1 diff above this multiple of the rolling median active step */
  spritePopSpikeMult: 3.8,
  /** Minimum absolute per-channel L1 pixel delta (0..255) for a spike to count as a pop */
  spritePopMinAbsL1: 5.5,
  /** Minimum absolute per-channel RMS pixel delta (0..255) for a spike to count as a pop */
  spritePopMinAbsRms: 14,
  /** Foreground silhouette centroid 1-frame jump threshold as a share of viewport/ROI width */
  spritePopCentroidRatio: 0.1,
  /** Minimum active-step L1 delta (0..255) included in the rolling baseline (skips 60Hz hold frames) */
  spriteActiveStepMinL1: 1.0,
  /** Half-window size (in frames) for the leave-one-out rolling median active step baseline */
  spriteRollingWindow: 16,
  /** Minimum share of a clipped shot that fighter-sprite-viewport must occupy to auto-enable the gate */
  spriteAutoClipShare: 0.25,
  /** Smooth multi-frame bridge guard: minimum contiguous active-frame run (>= 2× activeStepMinL1) */
  spriteBridgeMinRun: 3,
  /** Smooth multi-frame bridge guard: immediate neighbor L1 must be at least this share of the frame's L1 */
  spriteBridgeNeighborRatio: 0.45,
  /** Above this absolute L1 delta (0..255), never exempt a spike as a smooth multi-frame bridge */
  spriteBridgeMaxAbsL1: 13.5,
  /** Periodic limited-fps cadence train: minimum evenly-spaced tick peaks in the rolling window */
  spriteCadenceMinTicks: 3,
  /** Periodic limited-fps cadence train: allowed frame gap range between consecutive ticks (12–30 fps) */
  spriteCadenceMinGap: 2,
  spriteCadenceMaxGap: 6,
  /** Periodic limited-fps cadence train: max step L1 multiple relative to sibling cadence ticks */
  spriteCadenceMaxOutlierMult: 1.45,
  /** Periodic limited-fps cadence train: hard absolute L1 cap so violent whip clips are still flagged */
  spriteCadenceMaxAbsL1: 22,
};

const mean = a => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const std = a => {
  const m = mean(a);
  return Math.sqrt(mean(a.map(v => (v - m) ** 2)));
};
const median = a => {
  if (!a.length) return 0;
  const sorted = a.slice().sort((x, y) => x - y);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

function sampleBilinear(img, fx, fy, out, offset) {
  const { width, height, data } = img;
  const x = Math.max(0, Math.min(width - 1, fx));
  const y = Math.max(0, Math.min(height - 1, fy));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(width - 1, x0 + 1);
  const y1 = Math.min(height - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const w00 = (1 - tx) * (1 - ty);
  const w10 = tx * (1 - ty);
  const w01 = (1 - tx) * ty;
  const w11 = tx * ty;
  const o00 = (y0 * width + x0) * 4;
  const o10 = (y0 * width + x1) * 4;
  const o01 = (y1 * width + x0) * 4;
  const o11 = (y1 * width + x1) * 4;
  for (let c = 0; c < 4; c++) {
    out[offset + c] = Math.round(
      data[o00 + c] * w00 + data[o10 + c] * w10 + data[o01 + c] * w01 + data[o11 + c] * w11
    );
  }
}

/**
 * Extract a sub-pixel stabilized crop centered at `(cx, cy)` of size `width × height`.
 * Used when a moving container (e.g. Main Menu heroCard press scale/translate) shifts the
 * sprite viewport across the clipped stage so container motion & outer card borders never
 * masquerade as internal sprite-atlas teleports.
 */
export function cropStabilizedFrame(img, cx, cy, width, height) {
  const w = Math.max(8, Math.floor(width));
  const h = Math.max(8, Math.floor(height));
  const data = new Uint8Array(w * h * 4);
  const xStart = cx - w / 2;
  const yStart = cy - h / 2;
  let o = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++, o += 4) {
      sampleBilinear(img, xStart + x, yStart + y, data, o);
    }
  }
  return { width: w, height: h, data };
}

/**
 * Resolve per-frame viewport center coordinates from `capture.tracks` so `runSpriteGate`
 * can follow a translating/scaling sprite container without outer-border bleed.
 */
function resolveTrackedViewportCrops(capture, inset = 0) {
  const vp = capture?.regions?.['fighter-sprite-viewport'];
  if (!vp || !Array.isArray(capture?.tracks) || !capture.tracks.length) return null;
  const dpr = capture.dpr ?? 1;
  const maxDim = Math.max(vp[2], vp[3]) * 1.25;
  const minDim = Math.min(vp[2], vp[3]) * 0.55;
  const prefixes = ['fighter-sprite-viewport', 'main-menu-mascot', 'adventure-run-fighter', 'fighter-avatar'];

  let chosen = [];
  for (const pref of prefixes) {
    const matches = capture.tracks.filter(t => {
      if (!t?.label || !t.label.startsWith(pref) || t.label.includes('"')) return false;
      if (!Array.isArray(t.s) || !t.s.length) return false;
      const w0 = t.s[0][3];
      const h0 = t.s[0][4];
      return w0 >= minDim && h0 >= minDim && w0 <= maxDim && h0 <= maxDim;
    });
    if (matches.length) {
      chosen = matches;
      break;
    }
  }
  if (!chosen.length) return null;

  const byFrame = new Map();
  for (const t of chosen) {
    for (const r of t.s) {
      const f = r[0];
      if (!byFrame.has(f) || r[5] > byFrame.get(f)[5]) byFrame.set(f, r);
    }
  }
  if (byFrame.size < Math.max(2, capture.frames * 0.5)) return null;

  const samples = [...byFrame.values()];
  const nomW = median(samples.map(r => r[3]));
  const nomH = median(samples.map(r => r[4]));
  const cropW = Math.max(16, Math.floor((nomW - inset * 2) * dpr));
  const cropH = Math.max(16, Math.floor((nomH - inset * 2) * dpr));
  const centers = [];
  let last = byFrame.get(0) ?? samples[0];
  for (let i = 0; i < capture.frames; i++) {
    const r = byFrame.get(i) ?? last;
    last = r;
    centers.push({ cx: r[1] * dpr, cy: r[2] * dpr });
  }
  return { centers, cropW, cropH };
}

function insetRoiBox(roi, inset) {
  if (!roi || !inset || inset <= 0) return roi;
  const x = roi.x + inset;
  const y = roi.y + inset;
  const width = Math.max(16, roi.width - inset * 2);
  const height = Math.max(16, roi.height - inset * 2);
  return { x, y, width, height };
}

/**
 * Detect rigid battle-stage screen-shake `(dx, dy)` per frame from a stage reference track
 * (e.g. `#run-foe-hp-trail` / `#run-foe-hp-fill`, using left edge `cx - w/2` so HP-bar drain
 * never registers as horizontal shake). Returns null when the stage is stationary (`< 0.5 px`).
 */
function resolveStageShakeOffsets(capture) {
  if (!Array.isArray(capture?.tracks) || !capture.tracks.length || !capture.frames) return null;
  const refPrefixes = ['#run-foe-hp-trail', '#run-foe-hp-fill', '#run-stage-backdrop', '#run-stage'];
  let refTrack = null;
  for (const pref of refPrefixes) {
    const match = capture.tracks.find(
      t => typeof t?.label === 'string' && t.label.startsWith(pref) && Array.isArray(t.s) && t.s.length >= Math.max(2, capture.frames * 0.5)
    );
    if (match) {
      refTrack = match;
      break;
    }
  }
  if (!refTrack) return null;

  const dpr = capture.dpr ?? 1;
  const byFrame = new Map(refTrack.s.map(r => [r[0], r]));
  const r0 = byFrame.get(0) ?? refTrack.s[0];
  const left0 = r0[1] - r0[3] / 2;
  const y0 = r0[2];

  const offsets = [];
  let maxAbsDx = 0;
  let maxPosDy = 0;
  let minNegDy = 0;
  let last = r0;
  for (let i = 0; i < capture.frames; i++) {
    const r = byFrame.get(i) ?? last;
    last = r;
    const dx = (r[1] - r[3] / 2 - left0) * dpr;
    const dy = (r[2] - y0) * dpr;
    if (Math.abs(dx) > maxAbsDx) maxAbsDx = Math.abs(dx);
    if (dy > maxPosDy) maxPosDy = dy;
    if (dy < minNegDy) minNegDy = dy;
    offsets.push({ dx, dy });
  }
  if (Math.max(maxAbsDx, maxPosDy, Math.abs(minNegDy)) < 0.5) return null;
  return { offsets, maxAbsDx, maxPosDy, minNegDy };
}

function clampRoi(roi, width, height) {
  if (!roi) return { x: 0, y: 0, width, height };
  const rawX = Array.isArray(roi) ? roi[0] : roi.x;
  const rawY = Array.isArray(roi) ? roi[1] : roi.y;
  const rawW = Array.isArray(roi) ? roi[2] : roi.width;
  const rawH = Array.isArray(roi) ? roi[3] : roi.height;
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(rawX ?? 0)));
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(rawY ?? 0)));
  const x1 = Math.max(x0 + 1, Math.min(width, Math.ceil((rawX ?? 0) + (rawW ?? width))));
  const y1 = Math.max(y0 + 1, Math.min(height, Math.ceil((rawY ?? 0) + (rawH ?? height))));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

/**
 * Compute per-pixel L1 and RMS delta inside `roi` between two same-sized RGBA images.
 * Handles both opaque Playwright screenshots and alpha-transparent RGBA buffers.
 */
function computeFrameStepDiff(prevImg, currImg, roi) {
  const { width } = currImg;
  const a = prevImg.data;
  const b = currImg.data;
  const x0 = roi.x;
  const y0 = roi.y;
  const x1 = roi.x + roi.width;
  const y1 = roi.y + roi.height;
  let sumL1 = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = y0; y < y1; y++) {
    let o = (y * width + x0) * 4;
    for (let x = x0; x < x1; x++, o += 4) {
      const aA = a[o + 3];
      const aB = b[o + 3];
      if (aA === 255 && aB === 255) {
        const dr = Math.abs(a[o] - b[o]);
        const dg = Math.abs(a[o + 1] - b[o + 1]);
        const db = Math.abs(a[o + 2] - b[o + 2]);
        sumL1 += (dr + dg + db) / 3;
        sumSq += (dr * dr + dg * dg + db * db) / 3;
      } else {
        const prA = (a[o] * aA) / 255;
        const pgA = (a[o + 1] * aA) / 255;
        const pbA = (a[o + 2] * aA) / 255;
        const prB = (b[o] * aB) / 255;
        const pgB = (b[o + 1] * aB) / 255;
        const pbB = (b[o + 2] * aB) / 255;
        const dr = Math.abs(prA - prB);
        const dg = Math.abs(pgA - pgB);
        const db = Math.abs(pbA - pbB);
        const da = Math.abs(aA - aB);
        sumL1 += (dr + dg + db + da) / 4;
        sumSq += (dr * dr + dg * dg + db * db + da * da) / 4;
      }
      count++;
    }
  }
  return {
    l1: count ? sumL1 / count : 0,
    rms: count ? Math.sqrt(sumSq / count) : 0,
  };
}

/**
 * Estimate the foreground silhouette centroid `(cx, cy)` relative to `roi` origin.
 * Supports three image types cleanly:
 *  1. Alpha-transparent RGBA frames (`>= 15%` transparent pixels inside ROI)
 *  2. Opaque frames over a uniform card/studio background (border median RGB)
 *  3. Opaque frames over a horizontally banded/textured stage backdrop (per-row edge samples)
 */
function computeForegroundCentroid(img, roi) {
  const { width } = img;
  const d = img.data;
  const x0 = roi.x;
  const y0 = roi.y;
  const x1 = roi.x + roi.width;
  const y1 = roi.y + roi.height;
  const total = roi.width * roi.height;
  if (total <= 0) return null;

  let transparent = 0;
  for (let y = y0; y < y1; y++) {
    let o = (y * width + x0) * 4;
    for (let x = x0; x < x1; x++, o += 4) {
      if (d[o + 3] < 24) transparent++;
    }
  }

  let sx = 0;
  let sy = 0;
  let sw = 0;

  if (transparent / total >= 0.15) {
    for (let y = y0; y < y1; y++) {
      let o = (y * width + x0) * 4;
      for (let x = x0; x < x1; x++, o += 4) {
        const a = d[o + 3];
        if (a >= 24) {
          const w = a / 255;
          sx += (x - x0) * w;
          sy += (y - y0) * w;
          sw += w;
        }
      }
    }
  } else {
    const borderR = [];
    const borderG = [];
    const borderB = [];
    for (let x = x0; x < x1; x++) {
      for (const y of y1 - 1 === y0 ? [y0] : [y0, y1 - 1]) {
        const o = (y * width + x) * 4;
        borderR.push(d[o]);
        borderG.push(d[o + 1]);
        borderB.push(d[o + 2]);
      }
    }
    for (let y = y0 + 1; y < y1 - 1; y++) {
      for (const x of x1 - 1 === x0 ? [x0] : [x0, x1 - 1]) {
        const o = (y * width + x) * 4;
        borderR.push(d[o]);
        borderG.push(d[o + 1]);
        borderB.push(d[o + 2]);
      }
    }
    const bgR = median(borderR);
    const bgG = median(borderG);
    const bgB = median(borderB);
    let uniform = 0;
    for (let i = 0; i < borderR.length; i++) {
      if (Math.abs(borderR[i] - bgR) + Math.abs(borderG[i] - bgG) + Math.abs(borderB[i] - bgB) <= 36) uniform++;
    }
    const isUniformBg = borderR.length > 0 && uniform / borderR.length >= 0.5;

    if (isUniformBg) {
      for (let y = y0; y < y1; y++) {
        let o = (y * width + x0) * 4;
        for (let x = x0; x < x1; x++, o += 4) {
          const dist = Math.abs(d[o] - bgR) + Math.abs(d[o + 1] - bgG) + Math.abs(d[o + 2] - bgB);
          if (dist > 42) {
            sx += x - x0;
            sy += y - y0;
            sw += 1;
          }
        }
      }
    } else {
      for (let y = y0; y < y1; y++) {
        const oL = (y * width + x0) * 4;
        const oR = (y * width + (x1 - 1)) * 4;
        const mR = (d[oL] + d[oR]) * 0.5;
        const mG = (d[oL + 1] + d[oR + 1]) * 0.5;
        const mB = (d[oL + 2] + d[oR + 2]) * 0.5;
        let o = oL;
        for (let x = x0; x < x1; x++, o += 4) {
          const dL = Math.abs(d[o] - d[oL]) + Math.abs(d[o + 1] - d[oL + 1]) + Math.abs(d[o + 2] - d[oL + 2]);
          const dR = Math.abs(d[o] - d[oR]) + Math.abs(d[o + 1] - d[oR + 1]) + Math.abs(d[o + 2] - d[oR + 2]);
          const dM = Math.abs(d[o] - mR) + Math.abs(d[o + 1] - mG) + Math.abs(d[o + 2] - mB);
          if (Math.min(dL, dR, dM) > 48) {
            sx += x - x0;
            sy += y - y0;
            sw += 1;
          }
        }
      }
    }
  }

  const minMass = Math.max(12, total * 0.005);
  return sw >= minMass ? { cx: sx / sw, cy: sy / sw, mass: sw } : null;
}

/**
 * Pixel-continuity & silhouette-centroid jump detector for clipped sprite viewports.
 * Flags `SPRITE-POP` on any non-whitelisted frame whose pixel diff spikes above the
 * rolling median active step diff (with meaningful absolute delta) OR whose foreground
 * silhouette centroid jumps more than `maxCentroidShiftRatio` of viewport width in 1 frame.
 */
export function detectSpritePops(frames, options = {}) {
  const valid = Array.isArray(frames) ? frames.filter(Boolean) : [];
  if (valid.length < 2) {
    const first = valid[0];
    const roi = first ? clampRoi(options.roi, first.width, first.height) : { x: 0, y: 0, width: 0, height: 0 };
    return {
      findings: [],
      steps: [],
      summary: {
        who: options.who ?? 'fighter-sprite-viewport',
        roi,
        globalMedianL1: 0,
        maxSpikeMult: 0,
        maxCentroidShiftPx: 0,
        maxCentroidShiftRatio: 0,
        popCount: 0,
      },
    };
  }

  const { width, height } = valid[0];
  const roi = clampRoi(options.roi, width, height);
  const snapSet = new Set((options.snapFrames ?? []).map(Number).filter(Number.isFinite));
  const maxSpikeMult = options.maxSpikeMult ?? RULES.spritePopSpikeMult;
  const maxCentroidShiftRatio = options.maxCentroidShiftRatio ?? RULES.spritePopCentroidRatio;
  const minAbsL1 = options.minAbsL1 ?? RULES.spritePopMinAbsL1;
  const minAbsRms = options.minAbsRms ?? RULES.spritePopMinAbsRms;
  const activeStepMinL1 = options.activeStepMinL1 ?? RULES.spriteActiveStepMinL1;
  const rollingWindow = options.rollingWindow ?? RULES.spriteRollingWindow;
  const startFrame = options.startFrame ?? 0;
  const who = options.who ?? 'fighter-sprite-viewport';

  const centroids = valid.map(img => computeForegroundCentroid(img, roi));
  const rawSteps = [];
  for (let i = 1; i < valid.length; i++) {
    const prev = valid[i - 1];
    const curr = valid[i];
    if (prev.width !== width || prev.height !== height || curr.width !== width || curr.height !== height) continue;
    const frame = startFrame + i;
    const { l1, rms } = computeFrameStepDiff(prev, curr, roi);
    const cPrev = centroids[i - 1];
    const cCurr = centroids[i];
    const dcx = cPrev && cCurr ? cCurr.cx - cPrev.cx : 0;
    const dcy = cPrev && cCurr ? cCurr.cy - cPrev.cy : 0;
    const centroidShiftPx = Math.hypot(dcx, dcy);
    const centroidShiftRatio = centroidShiftPx / Math.max(1, roi.width);
    rawSteps.push({
      frame,
      l1,
      rms,
      dcx,
      dcy,
      centroidShiftPx,
      centroidShiftRatio,
      snapped: snapSet.has(frame),
    });
  }

  const nonSnapActive = rawSteps.filter(s => !s.snapped && s.l1 >= activeStepMinL1).map(s => s.l1);
  const globalMedianL1 = nonSnapActive.length ? median(nonSnapActive) : activeStepMinL1;

  // Precompute local cadence tick peaks (e.g. 16fps sprite steps spaced 2..6f apart under
  // continuous 60Hz overlay FX that would otherwise pin the all-frame median near ~2.5).
  const cadenceTicks = [];
  const cadenceTickSet = new Set();
  for (let j = 0; j < rawSteps.length; j++) {
    const cur = rawSteps[j];
    if (cur.snapped || cur.l1 < minAbsL1) continue;
    const pL1 = j > 0 && !rawSteps[j - 1].snapped ? rawSteps[j - 1].l1 : 0;
    const nL1 = j + 1 < rawSteps.length && !rawSteps[j + 1].snapped ? rawSteps[j + 1].l1 : 0;
    if (cur.l1 >= pL1 && cur.l1 >= nL1) {
      cadenceTicks.push(j);
      cadenceTickSet.add(j);
    }
  }

  const findings = [];
  const steps = [];
  let worstSpikeMult = 0;
  let worstCentroidPx = 0;
  let worstCentroidRatio = 0;

  for (let k = 0; k < rawSteps.length; k++) {
    const s = rawSteps[k];
    // Leave-one-out rolling median of active non-snap steps so a single pop cannot inflate its own baseline,
    // while a smooth 4+ frame crossfade sees its sibling crossfade frames (~1.0×) and stays pop-free.
    const localPool = [];
    const lo = Math.max(0, k - rollingWindow);
    const hi = Math.min(rawSteps.length - 1, k + rollingWindow);
    for (let j = lo; j <= hi; j++) {
      if (j === k) continue;
      if (!rawSteps[j].snapped && rawSteps[j].l1 >= activeStepMinL1) localPool.push(rawSteps[j].l1);
    }
    let baselineL1;
    if (localPool.length >= 3) {
      baselineL1 = median(localPool);
    } else {
      const globalOthers = [];
      for (let j = 0; j < rawSteps.length; j++) {
        if (j === k) continue;
        if (!rawSteps[j].snapped && rawSteps[j].l1 >= activeStepMinL1) globalOthers.push(rawSteps[j].l1);
      }
      baselineL1 = globalOthers.length >= 3 ? median(globalOthers) : activeStepMinL1;
    }
    baselineL1 = Math.max(baselineL1, activeStepMinL1);
    const spikeMult = s.l1 / baselineL1;

    // Distinguish an isolated 1-frame UV teleport impulse from a smooth multi-frame transition
    // (e.g. a 64ms EASE.state crossfade bell curve or continuous spring lunge + FX overlap).
    const bridgeFloor = activeStepMinL1 * 2;
    let runLen = 0;
    if (!s.snapped && s.l1 >= bridgeFloor) {
      runLen = 1;
      for (let j = k - 1; j >= 0 && !rawSteps[j].snapped && rawSteps[j].l1 >= bridgeFloor; j--) runLen++;
      for (let j = k + 1; j < rawSteps.length && !rawSteps[j].snapped && rawSteps[j].l1 >= bridgeFloor; j++) runLen++;
    }
    const prevL1 = k > 0 && !rawSteps[k - 1].snapped ? rawSteps[k - 1].l1 : 0;
    const nextL1 = k + 1 < rawSteps.length && !rawSteps[k + 1].snapped ? rawSteps[k + 1].l1 : 0;
    const maxNeighborL1 = Math.max(prevL1, nextL1);
    const isCentroidJump = !s.snapped && s.centroidShiftRatio > maxCentroidShiftRatio && s.l1 >= activeStepMinL1;
    const isSmoothMultiFrameBridge =
      !isCentroidJump &&
      runLen >= RULES.spriteBridgeMinRun &&
      maxNeighborL1 >= s.l1 * RULES.spriteBridgeNeighborRatio &&
      s.l1 < RULES.spriteBridgeMaxAbsL1;

    // Recognize a regular periodic limited-fps cadence train (3+ evenly spaced ~2–6f ticks
    // with mutually consistent step L1 and bounded centroid shift) as smooth intentional
    // limited-fps animation rather than isolated 1-frame teleports. Also exempt an adjacent
    // lower shoulder frame (e.g. pet-ring fade overlapping the first cheer tick) when its
    // immediate peak neighbor belongs to a valid periodic cadence train.
    const isValidCadenceAnchor = anchorIdx => {
      const anchor = rawSteps[anchorIdx];
      if (!anchor || anchor.snapped || anchor.l1 > RULES.spriteCadenceMaxAbsL1 || !cadenceTickSet.has(anchorIdx)) {
        return false;
      }
      const aLo = Math.max(0, anchorIdx - rollingWindow);
      const aHi = Math.min(rawSteps.length - 1, anchorIdx + rollingWindow);
      const localTicks = cadenceTicks.filter(idx => idx >= aLo && idx <= aHi);
      const pos = localTicks.indexOf(anchorIdx);
      if (pos < 0) return false;
      let chainStart = pos;
      while (
        chainStart > 0 &&
        localTicks[chainStart] - localTicks[chainStart - 1] >= RULES.spriteCadenceMinGap &&
        localTicks[chainStart] - localTicks[chainStart - 1] <= RULES.spriteCadenceMaxGap
      ) {
        chainStart--;
      }
      let chainEnd = pos;
      while (
        chainEnd + 1 < localTicks.length &&
        localTicks[chainEnd + 1] - localTicks[chainEnd] >= RULES.spriteCadenceMinGap &&
        localTicks[chainEnd + 1] - localTicks[chainEnd] <= RULES.spriteCadenceMaxGap
      ) {
        chainEnd++;
      }
      const chain = localTicks.slice(chainStart, chainEnd + 1);
      if (chain.length < RULES.spriteCadenceMinTicks) return false;
      const siblingL1s = chain.filter(idx => idx !== anchorIdx).map(idx => rawSteps[idx].l1);
      const trainMedL1 = median(siblingL1s);
      return trainMedL1 > 0 && anchor.l1 <= trainMedL1 * RULES.spriteCadenceMaxOutlierMult;
    };

    const isPeriodicCadenceTick =
      !s.snapped &&
      !isCentroidJump &&
      s.l1 <= RULES.spriteCadenceMaxAbsL1 &&
      (isValidCadenceAnchor(k) ||
        (k > 0 && s.l1 <= rawSteps[k - 1].l1 && isValidCadenceAnchor(k - 1)) ||
        (k + 1 < rawSteps.length && s.l1 <= rawSteps[k + 1].l1 && isValidCadenceAnchor(k + 1)));

    const isPixelSpike =
      !s.snapped &&
      !isSmoothMultiFrameBridge &&
      !isPeriodicCadenceTick &&
      spikeMult > maxSpikeMult &&
      s.l1 >= minAbsL1 &&
      s.rms >= minAbsRms;
    const popped = isPixelSpike || isCentroidJump;

    if (!s.snapped) {
      if (spikeMult > worstSpikeMult) worstSpikeMult = spikeMult;
      if (s.centroidShiftPx > worstCentroidPx) worstCentroidPx = s.centroidShiftPx;
      if (s.centroidShiftRatio > worstCentroidRatio) worstCentroidRatio = s.centroidShiftRatio;
    }

    steps.push({
      frame: s.frame,
      l1: round(s.l1, 2),
      rms: round(s.rms, 2),
      baselineL1: round(baselineL1, 2),
      spikeMult: round(spikeMult, 2),
      dcx: round(s.dcx, 2),
      dcy: round(s.dcy, 2),
      centroidShiftPx: round(s.centroidShiftPx, 2),
      centroidShiftRatio: round(s.centroidShiftRatio, 4),
      snapped: s.snapped,
      popped,
    });

    if (popped) {
      const reason = isPixelSpike && isCentroidJump ? 'both' : isPixelSpike ? 'pixel-spike' : 'centroid-jump';
      let text;
      if (reason === 'both') {
        text =
          `sprite popped in 1 frame (pixel L1 ${round(s.l1, 1)} / RMS ${round(s.rms, 1)} = ${round(spikeMult, 1)}× rolling median ${round(baselineL1, 1)}; ` +
          `centroid jumped ${round(s.centroidShiftPx, 1)} px [${round(s.centroidShiftRatio * 100, 1)}% of ${roi.width} px width, dx ${round(s.dcx, 1)}, dy ${round(s.dcy, 1)}]). ` +
          'Align atlas registration, add recovery frames, or bridge with a 64–96 ms crossfade.';
      } else if (reason === 'pixel-spike') {
        text =
          `sprite pixel diff spiked in 1 frame (L1 ${round(s.l1, 1)} / RMS ${round(s.rms, 1)} = ${round(spikeMult, 1)}× rolling median ${round(baselineL1, 1)}). ` +
          'Likely an unbridged UV cell teleport or idle phase reset.';
      } else {
        text =
          `sprite silhouette centroid jumped ${round(s.centroidShiftPx, 1)} px in 1 frame ` +
          `(${round(s.centroidShiftRatio * 100, 1)}% of ${roi.width} px width; dx ${round(s.dcx, 1)} px, dy ${round(s.dcy, 1)} px). ` +
          'Likely misaligned atlas registration or abrupt pose snap.';
      }
      findings.push({
        code: 'SPRITE-POP',
        at: s.frame,
        who,
        text,
        reason,
        l1: round(s.l1, 2),
        rms: round(s.rms, 2),
        baselineL1: round(baselineL1, 2),
        spikeMult: round(spikeMult, 2),
        centroidShiftPx: round(s.centroidShiftPx, 2),
        centroidShiftRatio: round(s.centroidShiftRatio, 4),
        dcx: round(s.dcx, 2),
        dcy: round(s.dcy, 2),
      });
    }
  }

  return {
    findings,
    steps,
    summary: {
      who,
      roi,
      globalMedianL1: round(globalMedianL1, 2),
      maxSpikeMult: round(worstSpikeMult, 2),
      maxCentroidShiftPx: round(worstCentroidPx, 2),
      maxCentroidShiftRatio: round(worstCentroidRatio, 4),
      popCount: findings.length,
    },
  };
}

/**
 * Determine whether the SPRITE-POP pixel-continuity gate applies to a capture.
 * Activates when a shot opts in via `spriteGate` (in capture.json or scripts/motion/shots/*.mjs)
 * OR automatically when `fighter-sprite-viewport` is the primary tracked clip.
 * Non-sprite shots (fight-set, map-open, spire-*, etc.) return null and stay unaffected.
 */
export function resolveSpriteGateConfig(capture, shotDef = null) {
  let resolvedShot = shotDef;
  if (!resolvedShot && capture?.shot?.id) {
    try {
      resolvedShot = resolveShot(capture.shot.id);
    } catch {
      resolvedShot = null;
    }
  }
  const explicit =
    capture?.shot?.spriteGate !== undefined ? capture.shot.spriteGate : resolvedShot?.spriteGate;
  if (explicit === false) return null;
  if (explicit && typeof explicit === 'object') return { ...explicit, auto: false };
  if (explicit === true) return { auto: false };

  const vp = capture?.regions?.['fighter-sprite-viewport'];
  if (!vp || !capture?.clip) return null;
  const clipArea = Math.max(1, (capture.size?.width ?? 0) * (capture.size?.height ?? 0));
  const vpArea = Math.max(0, vp[2]) * Math.max(0, vp[3]);
  if (vpArea / clipArea >= RULES.spriteAutoClipShare) return { auto: true };
  return null;
}

function runSpriteGate(dir, capture) {
  const gate = resolveSpriteGateConfig(capture);
  if (!gate || !png()) return null;
  const framesDir = path.join(dir, 'frames');
  if (!fs.existsSync(framesDir)) return null;

  const decoded = [];
  for (let i = 0; i < capture.frames; i++) {
    const file = path.join(framesDir, frameName(i));
    if (!fs.existsSync(file)) break;
    const img = decodePng(fs.readFileSync(file));
    if (img) decoded.push(img);
  }
  if (decoded.length < 2) return null;

  const dpr = capture.dpr ?? 1;
  const vp = capture.regions?.['fighter-sprite-viewport'];
  const insetPx = Math.max(0, Math.round((gate.roiInset ?? 0) * dpr));
  let framesToAnalyze = decoded;
  let roi = gate.roi ?? null;

  if (!roi && gate.trackViewport) {
    const tracked = resolveTrackedViewportCrops(capture, gate.roiInset ?? 0);
    if (tracked) {
      framesToAnalyze = decoded.map((img, i) => {
        const c = tracked.centers[Math.min(i, tracked.centers.length - 1)];
        return cropStabilizedFrame(img, c.cx, c.cy, tracked.cropW, tracked.cropH);
      });
      roi = null;
    }
  }

  if (!roi && framesToAnalyze === decoded && vp) {
    roi = insetRoiBox(
      {
        x: Math.floor(vp[0] * dpr),
        y: Math.floor(vp[1] * dpr),
        width: Math.ceil(vp[2] * dpr),
        height: Math.ceil(vp[3] * dpr),
      },
      insetPx
    );
  }

  // Compensate rigid battle-stage screen shake (e.g. multSlam vertical shake) so camera
  // movement & header intrusion at the clip top never masquerade as internal sprite pops.
  if (gate.stabilizeStageShake !== false && framesToAnalyze === decoded) {
    const shake = resolveStageShakeOffsets(capture);
    if (shake) {
      const base = clampRoi(roi, decoded[0].width, decoded[0].height);
      const hasTopHeader = Boolean(capture.regions?.['run-foe-hp'] || capture.regions?.['run-foe-inspect']);
      const topPad = hasTopHeader
        ? Math.min(Math.floor(base.height * 0.2), Math.ceil(shake.maxPosDy) * 2 + 4)
        : Math.ceil(shake.maxPosDy);
      const cropW = Math.max(16, base.width);
      const cropH = Math.max(16, base.height - topPad);
      const baseCx = base.x + base.width / 2;
      const baseCy = base.y + topPad + cropH / 2;
      framesToAnalyze = decoded.map((img, i) => {
        const off = shake.offsets[Math.min(i, shake.offsets.length - 1)];
        return cropStabilizedFrame(img, baseCx + off.dx, baseCy + off.dy, cropW, cropH);
      });
      roi = null;
    }
  }
  const who = gate.who ?? (vp ? 'fighter-sprite-viewport' : capture.shot?.id || 'sprite');
  return detectSpritePops(framesToAnalyze, { ...gate, roi, who });
}

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
      // A bow of a few pixels is already an arc to the eye (the house rule asks for 10–20 px)
      if (d) pos = { ...d, travel: round(chord), path: round(pathLen), dx: round(dx), dy: round(dy), bow: round(bow), arc: bow >= Math.max(5, chord * 0.02) };
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
  // Pixel-continuity & silhouette-centroid gate for clipped sprite viewports / spriteGate shots
  const spriteResult = runSpriteGate(dir, capture);
  const spriteHints = spriteResult
    ? spriteResult.findings.map(item => ({
        code: item.code,
        who: item.who,
        text: item.text,
        frames: [item.at],
        at: item.at,
      }))
    : [];
  // A shot can say which findings are meant (a held pose is not a dead stretch)
  const mute = new Set(capture.shot.mute ?? []);
  const hints = [...hintsFor(movers, timeline, capture), ...spriteHints]
    .filter(h => !mute.has(h.code))
    .sort((x, y) => x.at - y.at);

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
  if (spriteResult) {
    const sc = spriteResult.summary;
    lines.push(
      `- Sprite continuity (${sc.who} ${sc.roi.width}×${sc.roi.height}): median active L1 ${f(sc.globalMedianL1)}, peak ${f(sc.maxSpikeMult)}×, max centroid shift ${f(sc.maxCentroidShiftPx)} px (${f(sc.maxCentroidShiftRatio * 100)}%) — ${sc.popCount === 0 ? '0 pops' : `${sc.popCount} pop(s) flagged`}.`
    );
  }
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
  if (mute.size) lines.push(`_Not reported for this shot (meant): ${[...mute].join(', ')}._`);
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
  const analysisPayload = {
    timeline,
    groups: groups.map(g => ({ label: g.label, shape: g.shape, starts: g.members.map(m => m.from) })),
    movers,
    hints,
    ...(spriteResult ? { spriteContinuity: { summary: spriteResult.summary, findings: spriteResult.findings } } : {}),
  };
  fs.writeFileSync(path.join(dir, 'analysis.json'), JSON.stringify(analysisPayload, null, 1));
  return {
    report,
    timeline,
    movers,
    hints,
    capture,
    ...(spriteResult ? { spriteContinuity: spriteResult } : {}),
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const dir = process.argv[2];
  if (!dir) {
    console.error('usage: node scripts/motion/analyze.mjs motion-out/<shot>/<label>');
    process.exit(2);
  }
  console.log(analyze(path.resolve(dir)).report);
}
