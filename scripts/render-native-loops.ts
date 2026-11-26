#!/usr/bin/env npx tsx
/**
 * Reproducible offline synthesizer for native iOS/Android `.m4a` audio packs ([AU-02]).
 *
 * Reads the real NShapes music data (`ARRANGEMENTS`, `THEME`, `THEME_B`, `WORLD_TONE`,
 * `INSTRUMENTS`, `MODES`, `PROGRESSIONS`) and synthesizes:
 *   1. Seamless bar-aligned biome BGM loops (`assets/sounds/native/loops/*.m4a`)
 *   2. Curated Adventure & Starfall Summit one-shot SFX cues + 6 weapon-role stings
 *      (`assets/sounds/native/cues/*.m4a`)
 *
 * Every rendered file passes through the `[AU-14]` pitch-folding / Nyquist FM guard
 * and `[AU-15]` phone-speaker mastering chain (70 Hz HPF, -3 dB 4 kHz presence shelf,
 * 10.5 kHz LPF, 20:1 / 1 ms brickwall limiter, tanh -0.3 dBFS soft-clipper) before
 * AAC-LC encoding via macOS `afconvert` (or `ffmpeg` on Linux/CI).
 *
 * Usage:
 *   npx tsx scripts/render-native-loops.ts
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Duty, Patch } from '../src/audio/chip';
import { worldTone } from '../src/audio/director';
import type { InstrumentId } from '../src/audio/instruments';
import { ARRANGEMENTS, THEME, THEME_B, type Arrangement } from '../src/audio/songs';
import { chordRoot, degreeToFreq, ladderDegree, parseNote, strum } from '../src/audio/theory';

const SR = 44100;
const OUT_LOOPS_DIR = path.resolve(process.cwd(), 'assets/sounds/native/loops');
const OUT_CUES_DIR = path.resolve(process.cwd(), 'assets/sounds/native/cues');

// Mirror [AU-14]/[AU-15] constants from src/audio/chip.ts so this script runs in pure Node without react-native.
const MAX_OSC_FREQ_HZ = 4200;
const SOFT_CLIP_CEILING = Math.pow(10, -0.3 / 20);
const MASTER_BUS = {
  gain: 0.88,
  hpfHz: 70,
  hpfQ: 0.707,
  presenceHz: 4000,
  presenceQ: 0.9,
  presenceGainDb: -3,
  lpfHz: 10500,
  limiterThreshold: -6,
  limiterRatio: 20,
  limiterAttack: 0.001,
  limiterRelease: 0.09,
  softClipDrive: 1.15,
} as const;

const foldFreq = (freq: number, maxHz = 2600): number => {
  if (!Number.isFinite(freq) || freq <= 0 || maxHz <= 0) return freq;
  let f = freq;
  while (f > maxHz) f /= 2;
  return f;
};

// Mirror core instrument patches from src/audio/instruments.ts (pure data, zero Web Audio/RN deps)
const INSTRUMENTS: Record<string, Patch> = {
  bell: { osc: 'sine', fm: { ratio: 3.5, index: 2.2, decay: 0.35 }, a: 0.002, d: 1.1, s: 0, r: 0.2, vol: 0.2, space: 'hall' },
  glock: { osc: 'sine', partials: [[4, 0.28]], fm: { ratio: 7, index: 0.6, decay: 0.05 }, a: 0.001, d: 0.5, s: 0, r: 0.1, vol: 0.2, space: 'hall' },
  celesta: { osc: 'triangle', fm: { ratio: 4, index: 0.9, decay: 0.12 }, a: 0.002, d: 0.7, s: 0, r: 0.1, vol: 0.2, space: 'room' },
  kalimba: { osc: 'sine', fm: { ratio: 2.76, index: 1.3, decay: 0.06 }, a: 0.001, d: 0.42, s: 0, r: 0.1, vol: 0.24, space: 'room' },
  marimba: { osc: 'sine', partials: [[4, 0.22]], fm: { ratio: 1, index: 0.7, decay: 0.03 }, a: 0.001, d: 0.28, s: 0, r: 0.05, vol: 0.27, space: 'room' },
  vibes: { osc: 'sine', fm: { ratio: 4, index: 0.45, decay: 0.3 }, vibrato: 0.004, a: 0.003, d: 1.3, s: 0, r: 0.2, vol: 0.2, space: 'hall' },
  steel: { osc: 'sine', partials: [[2, 0.35]], fm: { ratio: 2, index: 1.5, decay: 0.14 }, a: 0.002, d: 0.55, s: 0, r: 0.1, vol: 0.2, space: 'room' },
  pluck: { osc: 'sawtooth', lp: { hz: 2.2, track: true, env: 5, decay: 0.12, q: 1.2 }, a: 0.002, d: 0.26, s: 0, r: 0.05, vol: 0.2, space: 'room' },
  harp: { osc: 'triangle', partials: [[2, 0.3], [3, 0.1]], a: 0.003, d: 0.9, s: 0, r: 0.2, vol: 0.24, space: 'hall' },
  pizz: { osc: 'triangle', partials: [[2, 0.2]], lp: { hz: 2600 }, a: 0.002, d: 0.16, s: 0, r: 0.04, vol: 0.28, space: 'room' },
  banjo: { osc: 'pulse', duty: 0.25, lp: { hz: 3, track: true, env: 4, decay: 0.07 }, a: 0.001, d: 0.3, s: 0, r: 0.05, vol: 0.17, space: 'room' },
  clav: { osc: 'pulse', duty: 0.125, lp: { hz: 4, track: true, env: 3, decay: 0.05, q: 2 }, a: 0.001, d: 0.15, s: 0, r: 0.03, vol: 0.18 },
  brass: { osc: 'sawtooth', detune: 9, lp: { hz: 2.5, track: true, env: 2.2, decay: 0.18 }, a: 0.03, d: 0.2, s: 0.75, r: 0.09, vol: 0.14, space: 'room' },
  strings: { osc: 'sawtooth', detune: 13, lp: { hz: 2300 }, vibrato: 0.003, a: 0.11, d: 0.3, s: 0.8, r: 0.3, vol: 0.13, space: 'hall' },
  organ: { osc: 'sine', partials: [[2, 0.5], [3, 0.3], [4, 0.18]], a: 0.008, d: 0.1, s: 0.9, r: 0.06, vol: 0.13, space: 'room' },
  flute: { osc: 'triangle', vibrato: 0.006, a: 0.04, d: 0.15, s: 0.85, r: 0.08, vol: 0.24, space: 'room' },
  saw: { osc: 'sawtooth', detune: 19, lp: { hz: 5, track: true, env: 1.5, decay: 0.2 }, a: 0.004, d: 0.3, s: 0.45, r: 0.12, vol: 0.14, space: 'echo' },
  sub: { osc: 'sine', partials: [[2, 0.32], [3, 0.14]], lp: { hz: 480 }, a: 0.004, d: 0.3, s: 0.6, r: 0.08, vol: 0.24 },
};

const WORLD_COLOUR: Record<string, InstrumentId> = {
  map: 'celesta',
  meadow: 'glock',
  woods: 'flute',
  canyon: 'banjo',
  peaks: 'celesta',
  boss: 'brass',
};

const BASS_STEP: Record<string, number> = { R: 0, '3': 2, '5': 4, '7': 6, '8': 7 };

// ─── Stereo PCM Buffer & Offline Synth ───────────────────────────────────────

interface StereoBuf {
  left: Float64Array;
  right: Float64Array;
  sampleRate: number;
}

const createBuf = (seconds: number): StereoBuf => {
  const len = Math.max(1, Math.ceil(seconds * SR));
  return { left: new Float64Array(len), right: new Float64Array(len), sampleRate: SR };
};

// Classic 4-bit Game Boy wave table (matches src/audio/chip.ts)
const GB_WAVE_TABLE = [
  0, 2, 4, 6, 8, 10, 12, 14, 15, 15, 14, 13, 12, 11, 10, 9,
  8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 1, 1, 0, 0, 0, 0,
].map(v => v / 7.5 - 1);

// Deterministic LFSR noise tables (matches src/audio/chip.ts)
const makeLfsr = (short: boolean): Float32Array => {
  const len = SR;
  const data = new Float32Array(len);
  let lfsr = 0x7fff;
  let out = 1;
  for (let i = 0; i < len; i++) {
    if (i % 4 === 0) {
      const bit = (lfsr ^ (lfsr >> 1)) & 1;
      lfsr = (lfsr >> 1) | (bit << 14);
      if (short) lfsr = (lfsr & ~(1 << 6)) | (bit << 6);
      out = lfsr & 1 ? 1 : -1;
    }
    data[i] = out;
  }
  return data;
};

const NOISE_LONG = makeLfsr(false);
const NOISE_SHORT = makeLfsr(true);

const evalOsc = (
  kind: Patch['osc'],
  phase: number,
  freq: number,
  duty: Duty = 0.5
): number => {
  const p = phase - Math.floor(phase);
  switch (kind) {
    case 'sine':
      return Math.sin(2 * Math.PI * p);
    case 'triangle':
      return 1 - 4 * Math.abs(p - 0.5);
    case 'sawtooth': {
      // Band-limited additive sawtooth capped safely below Nyquist
      const maxH = Math.min(20, Math.max(1, Math.floor((SR * 0.42) / Math.max(20, freq))));
      let sum = 0;
      for (let h = 1; h <= maxH; h++) {
        sum += Math.sin(2 * Math.PI * h * p) / h;
      }
      return (2 / Math.PI) * sum;
    }
    case 'square':
    case 'pulse': {
      const d = kind === 'square' ? 0.5 : duty;
      const maxH = Math.min(24, Math.max(1, Math.floor((SR * 0.42) / Math.max(20, freq))));
      let sum = 0;
      for (let h = 1; h <= maxH; h++) {
        const coeff = (2 / (h * Math.PI)) * Math.sin(h * Math.PI * d);
        sum += coeff * Math.cos(2 * Math.PI * h * (p - d / 2));
      }
      return sum;
    }
    case 'wave': {
      const idx = p * GB_WAVE_TABLE.length;
      const i0 = Math.floor(idx) % GB_WAVE_TABLE.length;
      const i1 = (i0 + 1) % GB_WAVE_TABLE.length;
      const frac = idx - Math.floor(idx);
      return GB_WAVE_TABLE[i0] * (1 - frac) + GB_WAVE_TABLE[i1] * frac;
    }
  }
};

interface BiquadCoeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

const calcBiquad = (
  type: 'lowpass' | 'highpass' | 'bandpass' | 'peaking',
  freq: number,
  q = 0.707,
  gainDb = 0
): BiquadCoeffs => {
  const fc = Math.max(20, Math.min(SR * 0.46, freq));
  const w0 = (2 * Math.PI * fc) / SR;
  const cos = Math.cos(w0);
  const sin = Math.sin(w0);
  const alpha = sin / (2 * Math.max(0.1, q));
  let b0 = 1;
  let b1 = 0;
  let b2 = 0;
  let a0 = 1;
  let a1 = 0;
  let a2 = 0;

  if (type === 'lowpass') {
    b0 = (1 - cos) / 2;
    b1 = 1 - cos;
    b2 = (1 - cos) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cos;
    a2 = 1 - alpha;
  } else if (type === 'highpass') {
    b0 = (1 + cos) / 2;
    b1 = -(1 + cos);
    b2 = (1 + cos) / 2;
    a0 = 1 + alpha;
    a1 = -2 * cos;
    a2 = 1 - alpha;
  } else if (type === 'bandpass') {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
    a0 = 1 + alpha;
    a1 = -2 * cos;
    a2 = 1 - alpha;
  } else {
    const A = Math.pow(10, gainDb / 40);
    b0 = 1 + alpha * A;
    b1 = -2 * cos;
    b2 = 1 - alpha * A;
    a0 = 1 + alpha / A;
    a1 = -2 * cos;
    a2 = 1 - alpha / A;
  }

  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
};

const panGains = (pan = 0): [number, number] => {
  const p = Math.max(-1, Math.min(1, pan));
  const angle = ((p + 1) * Math.PI) / 4;
  return [Math.cos(angle), Math.sin(angle)];
};

const renderTone = (
  buf: StereoBuf,
  opts: {
    voice: 'pulse1' | 'pulse2' | 'wave';
    freq: number;
    at: number;
    dur: number;
    vol?: number;
    duty?: Duty;
    vibrato?: number;
    pan?: number;
    decay?: number;
  }
) => {
  const freq = Math.min(opts.freq, MAX_OSC_FREQ_HZ);
  if (!Number.isFinite(freq) || freq <= 0) return;
  const start = Math.max(0, Math.floor(opts.at * SR));
  const len = Math.max(1, Math.floor(opts.dur * SR));
  const end = Math.min(buf.left.length, start + len);
  const v = (opts.vol ?? 0.5) * (opts.voice === 'wave' ? 0.9 : 0.35);
  const decay = opts.decay ?? 0.35;
  const [gL, gR] = panGains(opts.pan);
  const kind: Patch['osc'] = opts.voice === 'wave' ? 'wave' : 'pulse';
  const duty = opts.duty ?? 0.5;
  const atkLen = Math.max(1, Math.floor(0.005 * SR));
  const holdEnd = Math.max(atkLen + 1, Math.floor(len * 0.85));

  let phase = 0;
  for (let i = start; i < end; i++) {
    const n = i - start;
    const t = n / SR;
    let env: number;
    if (n < atkLen) env = (n / atkLen) * v;
    else if (n < holdEnd) env = v * (1 - decay * ((n - atkLen) / (holdEnd - atkLen)));
    else env = v * (1 - decay) * (1 - (n - holdEnd) / Math.max(1, len - holdEnd));

    let curFreq = freq;
    if (opts.vibrato && t > Math.min(0.12, opts.dur / 2)) {
      curFreq += freq * opts.vibrato * Math.sin(2 * Math.PI * 5.5 * t);
    }
    phase += curFreq / SR;
    const s = evalOsc(kind, phase, curFreq, duty) * env;
    buf.left[i] += s * gL;
    buf.right[i] += s * gR;
  }
};

const renderPatch = (
  buf: StereoBuf,
  p: Patch,
  o: { freq: number; at: number; dur: number; vol?: number; pan?: number; slideTo?: number }
) => {
  const freq = Math.min(o.freq, MAX_OSC_FREQ_HZ);
  if (!Number.isFinite(freq) || freq <= 0) return;
  const plucked = p.s === 0;
  const hold = plucked ? Math.min(p.d, Math.max(0.08, o.dur)) : Math.max(p.a, o.dur);
  const releaseAt = hold;
  const totalDur = releaseAt + (plucked ? hold * 0.8 : p.r) + 0.03;

  const start = Math.max(0, Math.floor(o.at * SR));
  const len = Math.max(1, Math.floor(totalDur * SR));
  const end = Math.min(buf.left.length, start + len);
  const peak = Math.max(0.0001, (o.vol ?? 1) * p.vol);
  const [gL, gR] = panGains(o.pan);
  const preGain = p.detune ? 0.7 : 1;
  const detuneRatio = p.detune ? Math.pow(2, p.detune / 1200) : 1;

  // Nyquist FM safety guard ([AU-14])
  let fmModFreq = 0;
  let fmIndex = 0;
  if (p.fm) {
    const mf = freq * p.fm.ratio;
    const nyqHard = SR * 0.42;
    if (mf < nyqHard) {
      const nyqStart = SR * 0.2;
      const nyqKnee = SR * 0.35;
      let scale = 1;
      if (mf >= nyqKnee) scale = Math.max(0, ((nyqHard - mf) / Math.max(1, nyqHard - nyqKnee)) * 0.15);
      else if (mf > nyqStart) scale = 1 - 0.85 * ((mf - nyqStart) / Math.max(1, nyqKnee - nyqStart));
      fmIndex = p.fm.index * scale;
      fmModFreq = mf;
    }
  }

  const maxPartialHz = Math.min(9000, SR * 0.42);
  const partials = (p.partials ?? []).filter(([ratio]) => freq * ratio < maxPartialHz);
  const partialPhases = partials.map(() => 0);

  let phase = 0;
  let phase2 = 0;
  let modPhase = 0;
  let lpZ1 = 0;
  let lpZ2 = 0;
  let lpX1 = 0;
  let lpX2 = 0;
  const lpBase = p.lp ? Math.max(120, Math.min(16000, p.lp.track ? p.lp.hz * freq : p.lp.hz)) : 16000;
  let lpCoeffs = p.lp ? calcBiquad('lowpass', lpBase, p.lp.q ?? 0.7) : null;

  let env = 0.0001;
  const atkStep = peak / Math.max(1, p.a * SR);
  const decAlpha = 1 - Math.exp(-1 / Math.max(1, (Math.max(0.005, (plucked ? hold : p.d) / 3.5)) * SR));
  const relAlpha = 1 - Math.exp(-1 / Math.max(1, (Math.max(0.005, p.r / 4)) * SR));
  const fmAlpha = p.fm ? 1 - Math.exp(-1 / Math.max(1, Math.max(0.01, p.fm.decay / 3) * SR)) : 0;
  let curFmIdx = fmIndex;

  for (let i = start; i < end; i++) {
    const n = i - start;
    const t = n / SR;

    if (t < p.a) {
      env = Math.min(peak, env + atkStep);
    } else if (plucked) {
      env += (0.0001 - env) * decAlpha;
    } else if (t < releaseAt) {
      env += (peak * p.s - env) * decAlpha;
    } else {
      env += (0.0001 - env) * relAlpha;
    }

    let f = freq;
    if (o.slideTo) {
      const slideFrac = Math.min(1, t / Math.max(0.02, o.dur));
      const target = Math.min(MAX_OSC_FREQ_HZ, Math.max(20, o.slideTo));
      f = freq * Math.pow(target / freq, slideFrac);
    }
    if (p.vibrato) {
      f += freq * p.vibrato * Math.sin(2 * Math.PI * 5.2 * t);
    }
    let instFreq = f;
    if (fmModFreq > 0 && curFmIdx > 0.001) {
      modPhase += (f * (p.fm?.ratio ?? 1)) / SR;
      instFreq += f * curFmIdx * Math.sin(2 * Math.PI * modPhase);
      curFmIdx += (fmIndex * 0.08 - curFmIdx) * fmAlpha;
    }

    phase += Math.max(10, instFreq) / SR;
    let s = evalOsc(p.osc, phase, f, p.duty);
    if (p.detune) {
      phase2 += (f * detuneRatio) / SR;
      s += evalOsc(p.osc, phase2, f * detuneRatio, p.duty);
    }
    for (let k = 0; k < partials.length; k++) {
      const [ratio, gain] = partials[k];
      partialPhases[k] += (f * ratio) / SR;
      s += Math.sin(2 * Math.PI * partialPhases[k]) * gain;
    }
    s *= preGain;

    if (p.lp && lpCoeffs) {
      if (p.lp.env && n % 32 === 0) {
        const decay = Math.max(0.01, (p.lp.decay ?? p.d) / 3);
        const curHz = Math.min(16000, lpBase * (1 + p.lp.env * Math.exp(-t / decay)));
        lpCoeffs = calcBiquad('lowpass', curHz, p.lp.q ?? 0.7);
      }
      const y = lpCoeffs.b0 * s + lpCoeffs.b1 * lpX1 + lpCoeffs.b2 * lpX2 - lpCoeffs.a1 * lpZ1 - lpCoeffs.a2 * lpZ2;
      lpX2 = lpX1;
      lpX1 = s;
      lpZ2 = lpZ1;
      lpZ1 = y;
      s = y;
    }

    const out = s * env;
    buf.left[i] += out * gL;
    buf.right[i] += out * gR;
  }
};

const renderNoise = (
  buf: StereoBuf,
  opts: {
    at: number;
    dur: number;
    vol?: number;
    short?: boolean;
    pan?: number;
    filter?: number;
    sweepTo?: number;
    type?: 'bandpass' | 'highpass' | 'lowpass';
    attack?: number;
  }
) => {
  const src = opts.short ? NOISE_SHORT : NOISE_LONG;
  const start = Math.max(0, Math.floor(opts.at * SR));
  const len = Math.max(1, Math.floor(opts.dur * SR));
  const end = Math.min(buf.left.length, start + len);
  const v = (opts.vol ?? 0.4) * 0.5;
  const [gL, gR] = panGains(opts.pan);
  const startHz = opts.filter ?? 3000;
  const endHz = opts.sweepTo ?? startHz;
  const fType = opts.type ?? 'bandpass';
  let coeffs = calcBiquad(fType, startHz, 0.7);
  let x1 = 0, x2 = 0, z1 = 0, z2 = 0;

  for (let i = start; i < end; i++) {
    const n = i - start;
    const frac = n / Math.max(1, len);
    if (opts.sweepTo && n % 32 === 0) {
      const hz = startHz * Math.pow(Math.max(40, endHz) / Math.max(40, startHz), frac);
      coeffs = calcBiquad(fType, hz, 0.7);
    }
    const raw = src[(i + 7919) % src.length];
    const y = coeffs.b0 * raw + coeffs.b1 * x1 + coeffs.b2 * x2 - coeffs.a1 * z1 - coeffs.a2 * z2;
    x2 = x1; x1 = raw; z2 = z1; z1 = y;

    let env: number;
    if (opts.attack) {
      const atkFrac = Math.min(0.95, opts.attack / Math.max(0.01, opts.dur));
      env = frac < atkFrac ? v * Math.pow(frac / Math.max(0.001, atkFrac), 1.4) : v * Math.exp(-(frac - atkFrac) * 12);
    } else {
      env = v * Math.pow(0.001, frac);
    }
    buf.left[i] += y * env * gL;
    buf.right[i] += y * env * gR;
  }
};

// Warm low-end drums matching src/audio/instruments.ts ([AU-15])
const WARM_BASS: Patch = { osc: 'sine', partials: [[2, 0.32], [3, 0.14]], lp: { hz: 520 }, a: 0.001, d: 0.2, s: 0, r: 0.02, vol: 1 };
const SINE: Patch = { osc: 'sine', a: 0.001, d: 0.2, s: 0, r: 0.02, vol: 1 };

const renderDrum = (buf: StereoBuf, id: string, at: number, vol = 1, pan = 0) => {
  const v = vol;
  switch (id) {
    case 'kick':
      renderPatch(buf, { ...WARM_BASS, d: 0.16 }, { freq: 155, slideTo: 44, at, dur: 0.11, vol: 0.85 * v, pan });
      renderNoise(buf, { at, dur: 0.02, vol: 0.3 * v, filter: 3500, pan });
      break;
    case 'snare':
      renderNoise(buf, { at, dur: 0.13, vol: 0.62 * v, filter: 2400, pan });
      renderPatch(buf, { ...SINE, d: 0.07 }, { freq: 210, slideTo: 150, at, dur: 0.05, vol: 0.3 * v, pan });
      break;
    case 'hat':
      renderNoise(buf, { at, dur: 0.035, vol: 0.26 * v, short: true, filter: 8500, type: 'highpass', pan });
      break;
    case 'openHat':
      renderNoise(buf, { at, dur: 0.16, vol: 0.24 * v, short: true, filter: 7500, type: 'highpass', pan });
      break;
    case 'clap':
      for (const dt of [0, 0.011, 0.023]) {
        renderNoise(buf, { at: at + dt, dur: dt === 0.023 ? 0.14 : 0.02, vol: 0.5 * v, filter: 1500, pan });
      }
      break;
    case 'rim':
      renderPatch(buf, { ...SINE, d: 0.03 }, { freq: 1700, at, dur: 0.02, vol: 0.4 * v, pan });
      renderNoise(buf, { at, dur: 0.02, vol: 0.3 * v, filter: 4200, pan });
      break;
    case 'tick':
      renderPatch(buf, { ...SINE, d: 0.022 }, { freq: 2100, at, dur: 0.015, vol: 0.34 * v, pan });
      break;
    case 'crash':
      renderNoise(buf, { at, dur: 0.9, vol: 0.44 * v, short: true, filter: 5200, type: 'highpass', pan });
      break;
    case 'timpani':
      renderPatch(buf, { ...WARM_BASS, d: 0.55 }, { freq: 98, slideTo: 82, at, dur: 0.38, vol: 0.8 * v, pan });
      renderNoise(buf, { at, dur: 0.06, vol: 0.3 * v, filter: 700, pan });
      break;
    case 'taiko':
      renderPatch(buf, { ...WARM_BASS, d: 0.32 }, { freq: 120, slideTo: 58, at, dur: 0.22, vol: 0.9 * v, pan });
      renderNoise(buf, { at, dur: 0.09, vol: 0.5 * v, filter: 900, type: 'lowpass', pan });
      break;
    case 'tom':
      renderPatch(buf, { ...SINE, d: 0.2 }, { freq: 190, slideTo: 110, at, dur: 0.14, vol: 0.6 * v, pan });
      break;
    case 'thud':
      renderPatch(buf, { ...WARM_BASS, d: 0.24 }, { freq: 90, slideTo: 38, at, dur: 0.17, vol: 0.9 * v, pan });
      renderNoise(buf, { at, dur: 0.1, vol: 0.4 * v, filter: 420, type: 'lowpass', pan });
      break;
    case 'woodblock':
      renderPatch(buf, { ...SINE, d: 0.05, fm: { ratio: 2.4, index: 1.2, decay: 0.02 } }, { freq: 1150, at, dur: 0.04, vol: 0.5 * v, pan });
      break;
    case 'woodblockLo':
      renderPatch(buf, { ...SINE, d: 0.06, fm: { ratio: 2.4, index: 1.2, decay: 0.02 } }, { freq: 760, at, dur: 0.04, vol: 0.5 * v, pan });
      break;
    case 'tamb':
      renderNoise(buf, { at, dur: 0.09, vol: 0.24 * v, short: true, filter: 9000, type: 'highpass', pan });
      renderNoise(buf, { at: at + 0.03, dur: 0.05, vol: 0.14 * v, short: true, filter: 10000, type: 'highpass', pan });
      break;
    case 'anvil':
      renderPatch(buf, { ...SINE, d: 0.4, fm: { ratio: 5.1, index: 3, decay: 0.2 } }, { freq: 980, at, dur: 0.2, vol: 0.3 * v, pan });
      break;
    case 'subDrop':
      renderPatch(buf, { ...WARM_BASS, d: 0.7 }, { freq: 110, slideTo: 30, at, dur: 0.5, vol: 0.85 * v, pan });
      break;
  }
};

// ─── Mastering Chain ([AU-15]) + Subtle Room Reverb ──────────────────────────

const applyLightReverb = (buf: StereoBuf, wet = 0.14) => {
  if (wet <= 0) return;
  const delaysL = [1553, 2111, 2797, 3541];
  const delaysR = [1601, 2161, 2851, 3607];
  const fb = 0.48;
  const n = buf.left.length;
  const wetL = new Float64Array(n);
  const wetR = new Float64Array(n);

  const comb = (input: Float64Array, out: Float64Array, delays: number[]) => {
    for (const d of delays) {
      const line = new Float64Array(d);
      let idx = 0;
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const y = line[idx];
        lp = lp * 0.45 + y * 0.55;
        line[idx] = input[i] + lp * fb;
        idx = (idx + 1) % d;
        out[i] += y * 0.25;
      }
    }
  };

  comb(buf.left, wetL, delaysL);
  comb(buf.right, wetR, delaysR);
  for (let i = 0; i < n; i++) {
    buf.left[i] += wetL[i] * wet;
    buf.right[i] += wetR[i] * wet;
  }
};

const applyBiquadStereo = (buf: StereoBuf, coeffs: BiquadCoeffs) => {
  for (const ch of [buf.left, buf.right]) {
    let x1 = 0, x2 = 0, z1 = 0, z2 = 0;
    for (let i = 0; i < ch.length; i++) {
      const x = ch[i];
      const y = coeffs.b0 * x + coeffs.b1 * x1 + coeffs.b2 * x2 - coeffs.a1 * z1 - coeffs.a2 * z2;
      x2 = x1; x1 = x; z2 = z1; z1 = y;
      ch[i] = y;
    }
  }
};

const masterBuffer = (buf: StereoBuf, targetPeak = SOFT_CLIP_CEILING * 0.92, reverbWet = 0.14) => {
  applyLightReverb(buf, reverbWet);
  // 1. 70 Hz HPF
  applyBiquadStereo(buf, calcBiquad('highpass', MASTER_BUS.hpfHz, MASTER_BUS.hpfQ));
  // 2. 4 kHz -3 dB presence shelf
  applyBiquadStereo(buf, calcBiquad('peaking', MASTER_BUS.presenceHz, MASTER_BUS.presenceQ, MASTER_BUS.presenceGainDb));
  // 3. 10.5 kHz gentle LPF
  applyBiquadStereo(buf, calcBiquad('lowpass', MASTER_BUS.lpfHz, 0.707));

  // 4. Brickwall 20:1 / 1 ms limiter + tanh -0.3 dBFS soft-clipper
  const threshLin = Math.pow(10, MASTER_BUS.limiterThreshold / 20);
  const atk = Math.exp(-1 / (MASTER_BUS.limiterAttack * SR));
  const rel = Math.exp(-1 / (MASTER_BUS.limiterRelease * SR));
  const invRatio = 1 / MASTER_BUS.limiterRatio;
  const drive = MASTER_BUS.softClipDrive;
  const normTanh = Math.tanh(drive);

  let env = 0;
  let maxAbs = 0;
  for (let i = 0; i < buf.left.length; i++) {
    const l = buf.left[i] * MASTER_BUS.gain;
    const r = buf.right[i] * MASTER_BUS.gain;
    const mag = Math.max(Math.abs(l), Math.abs(r));
    env = mag > env ? atk * env + (1 - atk) * mag : rel * env + (1 - rel) * mag;
    let gr = 1;
    if (env > threshLin) {
      const overDb = 20 * Math.log10(env / threshLin);
      const outDb = overDb * invRatio;
      gr = Math.pow(10, (outDb - overDb) / 20);
    }
    const sl = (Math.tanh(drive * l * gr) / normTanh) * SOFT_CLIP_CEILING;
    const sr = (Math.tanh(drive * r * gr) / normTanh) * SOFT_CLIP_CEILING;
    buf.left[i] = sl;
    buf.right[i] = sr;
    const m = Math.max(Math.abs(sl), Math.abs(sr));
    if (m > maxAbs) maxAbs = m;
  }

  if (maxAbs > 1e-5) {
    const scale = targetPeak / maxAbs;
    for (let i = 0; i < buf.left.length; i++) {
      buf.left[i] *= scale;
      buf.right[i] *= scale;
    }
  }
};

// ─── Arrangement Loop Renderer ───────────────────────────────────────────────

const renderArrangementLoop = (name: string, a: Arrangement): StereoBuf => {
  const bars = a.useB ? 16 : 8;
  const sd = 60 / a.bpm / 4;
  const loopSecs = bars * 16 * sd;
  const loopSamples = Math.round(loopSecs * SR);
  const tailSecs = 1.8;
  const raw = createBuf(loopSecs + tailSecs);

  const { mode, key } = worldTone(name);
  const f = (degree: number, octave: number) => foldFreq(degreeToFreq(mode, key, degree, octave), 2600);
  const colourInst = WORLD_COLOUR[name] ?? 'glock';

  for (let step = 0; step < bars * 16; step++) {
    const bar = Math.floor(step / 16);
    const s16 = step % 16;
    const t = step * sd;
    const root = chordRoot(mode, bar);

    // Lead + world colour doubling ([AU-14] unison rule when freq > 1300)
    const section = a.useB && bar % 16 >= 8 ? THEME_B : THEME;
    const idx = (bar % 8) * 16 + s16;
    const tok = section[idx];
    const lead = tok && tok !== '-' && tok !== '.' ? parseNote(tok) : null;
    if (lead) {
      let len = 1;
      while (section[idx + len] === '-' && s16 + len < 16) len++;
      const dur = sd * len * 0.95;
      const semis = a.leadOctave / 12;
      const freq = f(lead.degree, lead.octave + semis);
      renderTone(raw, { voice: 'pulse1', freq, at: t, dur, vol: a.leadVol, duty: a.leadDuty, vibrato: len > 2 ? a.leadVibrato : 0 });
      const colourMult = name === 'boss' ? 0.5 : freq > 1300 ? 1 : 2;
      renderPatch(raw, INSTRUMENTS[colourInst], { freq: foldFreq(freq * colourMult, 2600), at: t, dur, vol: 0.32, pan: 0.15 });
    }

    // Bass + warm sub layer ([AU-15])
    const b = a.bass[s16];
    if (b && b !== '-' && b !== '.') {
      let len = 1;
      while (a.bass[s16 + len] === '-') len++;
      const freq = f(root + (BASS_STEP[b] ?? 0), a.bassOctave);
      renderTone(raw, { voice: 'wave', freq, at: t, dur: sd * len * 0.9, vol: 0.55, decay: 0.5 });
      if (b === 'R') {
        renderPatch(raw, INSTRUMENTS.sub, { freq: freq / (freq > 90 ? 2 : 1), at: t, dur: sd * 1.5, vol: 0.35 });
      }
    }

    // Arpeggio
    if (a.arp && s16 % 2 === 0) {
      const tones = [0, 2, 4, 7];
      renderTone(raw, {
        voice: 'pulse2',
        freq: f(root + tones[(s16 / 2) % 4], 4),
        at: t,
        dur: sd * 0.8,
        vol: 0.16,
        duty: a.arpDuty,
        decay: 0.8,
        pan: s16 % 4 === 0 ? -0.25 : 0.25,
      });
    }

    // Subtle harmonic pad on bar downbeat for warmth
    if (s16 === 0) {
      for (const d of [0, 2, 4]) {
        renderPatch(raw, INSTRUMENTS.strings, {
          freq: f(root + d, 3),
          at: t,
          dur: sd * 15.5,
          vol: name === 'map' ? 0.45 : 0.55,
          pan: d === 2 ? 0.25 : d === 4 ? -0.25 : 0,
        });
      }
    }

    // Drums
    const d = a.drums[s16];
    if (d === 'k') renderDrum(raw, 'kick', t, 0.9);
    if (d === 's') renderDrum(raw, 'snare', t, 0.8);
    if (d === 'h') renderDrum(raw, 'hat', t, 0.85, 0.18);
    if (d === 'o') renderDrum(raw, 'openHat', t, 0.85, -0.18);
    if (bar % 4 === 3 && s16 >= 12) renderDrum(raw, 'tom', t, 0.45 + (s16 - 12) * 0.08, (s16 - 13.5) * 0.25);
  }

  // Wrap tail cleanly into loop start so the loop seam is seamless
  const looped: StereoBuf = {
    left: new Float64Array(loopSamples),
    right: new Float64Array(loopSamples),
    sampleRate: SR,
  };
  for (let i = 0; i < raw.left.length; i++) {
    const j = i % loopSamples;
    looped.left[j] += raw.left[i];
    looped.right[j] += raw.right[i];
  }
  masterBuffer(looped, 0.78, 0.14);
  return looped;
};

// ─── Curated Native SFX Cue Bank ─────────────────────────────────────────────

const CUE_BUILDERS: Record<string, () => StereoBuf> = {
  'select-1': () => {
    const b = createBuf(0.22);
    renderPatch(b, INSTRUMENTS.kalimba, { freq: degreeToFreq('ionian', 0, 0, 5), at: 0, dur: 0.18, vol: 0.9 });
    renderDrum(b, 'tick', 0, 0.25);
    return b;
  },
  'select-2': () => {
    const b = createBuf(0.22);
    renderPatch(b, INSTRUMENTS.kalimba, { freq: degreeToFreq('ionian', 0, 2, 5), at: 0, dur: 0.18, vol: 0.9 });
    renderDrum(b, 'tick', 0, 0.25);
    return b;
  },
  'select-3': () => {
    const b = createBuf(0.24);
    renderPatch(b, INSTRUMENTS.kalimba, { freq: degreeToFreq('ionian', 0, 4, 5), at: 0, dur: 0.2, vol: 0.95 });
    renderDrum(b, 'tick', 0, 0.28);
    return b;
  },
  deselect: () => {
    const b = createBuf(0.18);
    renderPatch(b, INSTRUMENTS.kalimba, { freq: degreeToFreq('ionian', 0, 0, 4), at: 0, dur: 0.14, vol: 0.7 });
    return b;
  },
  'payout-0': () => {
    const b = createBuf(0.6);
    strum(0).forEach((d, i) => renderPatch(b, INSTRUMENTS.harp, { freq: degreeToFreq('ionian', 0, d, 4), at: i * 0.025, dur: 0.4, vol: 0.75 }));
    renderPatch(b, INSTRUMENTS.bell, { freq: foldFreq(degreeToFreq('ionian', 0, 0, 5), 2600), at: 0, dur: 0.45, vol: 0.9 });
    renderDrum(b, 'kick', 0, 0.55);
    return b;
  },
  'payout-1': () => {
    const b = createBuf(0.75);
    strum(0).forEach((d, i) => renderPatch(b, INSTRUMENTS.harp, { freq: degreeToFreq('ionian', 0, d, 4), at: i * 0.022, dur: 0.45, vol: 0.8 }));
    renderPatch(b, INSTRUMENTS.bell, { freq: foldFreq(degreeToFreq('ionian', 0, ladderDegree('ionian', 2), 5), 2600), at: 0, dur: 0.55, vol: 1 });
    for (const d of [0, 4]) renderPatch(b, INSTRUMENTS.brass, { freq: degreeToFreq('ionian', 0, d, 3), at: 0, dur: 0.22, vol: 0.8 });
    renderDrum(b, 'kick', 0, 0.75);
    return b;
  },
  'payout-2': () => {
    const b = createBuf(0.95);
    strum(0).forEach((d, i) => renderPatch(b, INSTRUMENTS.harp, { freq: degreeToFreq('ionian', 0, d, 4), at: i * 0.02, dur: 0.5, vol: 0.85 }));
    renderPatch(b, INSTRUMENTS.bell, { freq: foldFreq(degreeToFreq('ionian', 0, ladderDegree('ionian', 4), 5), 2600), at: 0, dur: 0.65, vol: 1.05 });
    renderPatch(b, INSTRUMENTS.glock, { freq: foldFreq(degreeToFreq('ionian', 0, ladderDegree('ionian', 6), 5), 2600), at: 0.05, dur: 0.35, vol: 0.75, pan: 0.3 });
    for (const d of [0, 4, 7]) renderPatch(b, INSTRUMENTS.brass, { freq: degreeToFreq('ionian', 0, d, 3), at: 0, dur: 0.32, vol: 0.85 });
    renderDrum(b, 'kick', 0, 0.9);
    renderDrum(b, 'subDrop', 0, 0.75);
    renderDrum(b, 'crash', 0, 0.55);
    return b;
  },
  'payout-3': () => {
    const b = createBuf(1.3);
    for (const d of [0, 2, 4, 7]) {
      renderPatch(b, INSTRUMENTS.brass, { freq: degreeToFreq('ionian', 0, d, 3), at: 0, dur: 0.55, vol: 0.8 });
      renderPatch(b, INSTRUMENTS.strings, { freq: degreeToFreq('ionian', 0, d, 4), at: 0, dur: 0.75, vol: 0.8 });
    }
    for (let i = 0; i < 6; i++) {
      renderPatch(b, INSTRUMENTS.glock, {
        freq: foldFreq(degreeToFreq('ionian', 0, ladderDegree('ionian', 3 + i), 6), 2600),
        at: 0.06 + i * 0.045,
        dur: 0.3,
        vol: 0.7,
        pan: i % 2 ? 0.5 : -0.5,
      });
    }
    renderDrum(b, 'kick', 0, 1);
    renderDrum(b, 'subDrop', 0, 0.95);
    renderDrum(b, 'crash', 0, 0.7);
    return b;
  },
  'parry-warn': () => {
    const b = createBuf(0.42);
    renderDrum(b, 'rim', 0, 0.8);
    renderPatch(b, INSTRUMENTS.steel, { freq: degreeToFreq('ionian', 0, 7, 5), at: 0, dur: 0.16, vol: 0.8 });
    renderPatch(b, INSTRUMENTS.bell, { freq: foldFreq(degreeToFreq('ionian', 0, 7, 6), 2600), at: 0.06, dur: 0.25, vol: 0.65 });
    return b;
  },
  parry: () => {
    const b = createBuf(0.6);
    renderDrum(b, 'anvil', 0, 0.9);
    renderPatch(b, INSTRUMENTS.steel, { freq: degreeToFreq('ionian', 0, 4, 5), at: 0, dur: 0.24, vol: 0.95 });
    renderPatch(b, INSTRUMENTS.bell, { freq: degreeToFreq('ionian', 0, 7, 5), at: 0.055, dur: 0.45, vol: 0.95 });
    return b;
  },
  'perfect-parry': () => {
    const b = createBuf(0.95);
    renderDrum(b, 'anvil', 0, 1);
    renderDrum(b, 'crash', 0, 0.72);
    renderPatch(b, INSTRUMENTS.bell, { freq: foldFreq(degreeToFreq('ionian', 0, 7, 6), 2600), at: 0, dur: 0.75, vol: 1 });
    renderPatch(b, INSTRUMENTS.bell, { freq: foldFreq(degreeToFreq('ionian', 0, 11, 6), 2600), at: 0.06, dur: 0.65, vol: 0.9 });
    for (const d of [0, 4, 7]) renderPatch(b, INSTRUMENTS.brass, { freq: degreeToFreq('ionian', 0, d, 4), at: 0.1, dur: 0.45, vol: 0.85 });
    return b;
  },
  hurt: () => {
    const b = createBuf(0.5);
    renderDrum(b, 'thud', 0, 1);
    renderPatch(b, INSTRUMENTS.brass, { freq: degreeToFreq('aeolian', 0, 0, 2), at: 0, dur: 0.32, vol: 0.95 });
    renderPatch(b, INSTRUMENTS.brass, { freq: degreeToFreq('aeolian', 0, 0, 2) * Math.pow(2, 1 / 12), at: 0, dur: 0.32, vol: 0.95 });
    return b;
  },
  'foe-strike': () => {
    const b = createBuf(0.65);
    renderDrum(b, 'timpani', 0, 1);
    renderDrum(b, 'thud', 0.05, 0.95);
    renderPatch(b, INSTRUMENTS.brass, { freq: degreeToFreq('aeolian', 0, 0, 2), at: 0, dur: 0.34, vol: 0.95 });
    renderPatch(b, INSTRUMENTS.brass, { freq: degreeToFreq('aeolian', 0, 0, 2) * Math.pow(2, 1 / 12), at: 0, dur: 0.34, vol: 0.9 });
    return b;
  },
  mistake: () => {
    const b = createBuf(0.32);
    renderPatch(b, INSTRUMENTS.clav, { freq: degreeToFreq('ionian', 0, 0, 3), at: 0, dur: 0.15, vol: 0.95 });
    renderPatch(b, INSTRUMENTS.clav, { freq: degreeToFreq('ionian', 0, 0, 3) * Math.pow(2, 1 / 12), at: 0, dur: 0.15, vol: 0.95 });
    renderDrum(b, 'rim', 0, 0.8);
    return b;
  },
  'grace-save': () => {
    const b = createBuf(0.7);
    const f = degreeToFreq('ionian', 0, 2, 5);
    renderPatch(b, INSTRUMENTS.vibes, { freq: f * Math.pow(2, -1 / 12), at: 0, dur: 0.14, vol: 0.85 });
    renderPatch(b, INSTRUMENTS.vibes, { freq: f, at: 0.1, dur: 0.52, vol: 1 });
    renderDrum(b, 'tamb', 0.1, 0.45);
    return b;
  },
  sour: () => {
    const b = createBuf(0.4);
    const f = degreeToFreq('ionian', 0, 2, 4);
    renderPatch(b, INSTRUMENTS.pizz, { freq: f * Math.pow(2, -1 / 12), at: 0, dur: 0.18, vol: 0.9 });
    renderPatch(b, INSTRUMENTS.pizz, { freq: degreeToFreq('ionian', 0, 0, 4), at: 0.1, dur: 0.22, vol: 0.9 });
    renderDrum(b, 'rim', 0, 0.5);
    return b;
  },
  blast: () => {
    const b = createBuf(0.65);
    renderDrum(b, 'kick', 0, 1);
    renderDrum(b, 'timpani', 0, 0.85);
    renderNoise(b, { at: 0, dur: 0.42, vol: 0.72, filter: 1800, sweepTo: 120 });
    renderPatch(b, INSTRUMENTS.brass, { freq: degreeToFreq('ionian', 0, 0, 2), at: 0, dur: 0.28, vol: 0.9 });
    return b;
  },
  laser: () => {
    const b = createBuf(0.35);
    renderPatch(b, INSTRUMENTS.saw, { freq: degreeToFreq('ionian', 0, 7, 5), slideTo: degreeToFreq('ionian', 0, 0, 3), at: 0, dur: 0.24, vol: 1.2 });
    renderNoise(b, { at: 0, dur: 0.12, vol: 0.25, short: true, filter: 7000 });
    return b;
  },
  ricochet: () => {
    const b = createBuf(0.45);
    [7, 4, 9].forEach((d, i) =>
      renderPatch(b, INSTRUMENTS.steel, { freq: foldFreq(degreeToFreq('ionian', 0, d, 5), 2600), at: i * 0.06, dur: 0.24, vol: 0.9, pan: [-0.6, 0.6, -0.25][i] })
    );
    return b;
  },
  heal: () => {
    const b = createBuf(0.8);
    [0, 2, 4, 7, 9].forEach((d, i) =>
      renderPatch(b, INSTRUMENTS.harp, { freq: foldFreq(degreeToFreq('ionian', 0, d, 4), 2600), at: i * 0.055, dur: 0.55, vol: 0.9, pan: i % 2 ? 0.35 : -0.35 })
    );
    return b;
  },
  coins: () => {
    const b = createBuf(0.42);
    [0, 1, 2].forEach(i =>
      renderPatch(b, INSTRUMENTS.glock, { freq: foldFreq(degreeToFreq('ionian', 0, ladderDegree('ionian', 4 + i), 6), 2600), at: i * 0.055, dur: 0.22, vol: 0.85, pan: i % 2 ? 0.4 : -0.4 })
    );
    return b;
  },
  register: () => {
    const b = createBuf(0.85);
    renderDrum(b, 'tick', 0, 0.95);
    renderDrum(b, 'anvil', 0.05, 0.5);
    renderPatch(b, INSTRUMENTS.bell, { freq: foldFreq(degreeToFreq('ionian', 0, 4, 6), 2600), at: 0.05, dur: 0.45, vol: 0.9 });
    renderPatch(b, INSTRUMENTS.bell, { freq: foldFreq(degreeToFreq('ionian', 0, 7, 6), 2600), at: 0.11, dur: 0.65, vol: 0.95 });
    return b;
  },
  rainbow: () => {
    const b = createBuf(0.95);
    for (let i = 0; i < 8; i++) {
      renderPatch(b, INSTRUMENTS.glock, {
        freq: foldFreq(degreeToFreq('lydian', 0, i, 5), 2600),
        at: i * 0.032,
        dur: 0.3,
        vol: 0.72,
        pan: -0.7 + (i / 7) * 1.4,
      });
    }
    for (const d of [0, 2, 4, 7]) renderPatch(b, INSTRUMENTS.strings, { freq: degreeToFreq('lydian', 0, d, 4), at: 0.2, dur: 0.55, vol: 0.75 });
    return b;
  },
  'level-up': () => {
    const b = createBuf(1.2);
    [0, 2, 4, 7].forEach((d, i) => {
      renderPatch(b, INSTRUMENTS.brass, { freq: degreeToFreq('ionian', 0, d, 4), at: i * 0.1, dur: 0.18, vol: 0.95 });
      renderPatch(b, INSTRUMENTS.bell, { freq: foldFreq(degreeToFreq('ionian', 0, d, 5), 2600), at: i * 0.1, dur: 0.42, vol: 0.7 });
    });
    for (const d of [7, 9, 11]) renderPatch(b, INSTRUMENTS.brass, { freq: degreeToFreq('ionian', 0, d, 4), at: 0.42, dur: 0.58, vol: 0.85 });
    renderDrum(b, 'crash', 0.42, 0.65);
    return b;
  },
  'weapon-get': () => {
    const b = createBuf(0.7);
    [0, 2, 4, 7].forEach((d, i) =>
      renderPatch(b, INSTRUMENTS.celesta, { freq: foldFreq(degreeToFreq('ionian', 0, d, 5), 2600), at: i * 0.06, dur: 0.38, vol: 0.9, pan: i % 2 ? 0.35 : -0.35 })
    );
    renderDrum(b, 'tamb', 0.24, 0.75);
    return b;
  },
  evolve: () => {
    const b = createBuf(1.4);
    for (let i = 0; i < 4; i++) renderDrum(b, 'snare', i * 0.055, 0.4 + i * 0.14);
    const t = 0.24;
    renderDrum(b, 'crash', t, 0.85);
    renderDrum(b, 'subDrop', t, 0.8);
    [0, 2, 4, 7, 9].forEach((d, i) => {
      const last = i === 4;
      const freq = foldFreq(degreeToFreq('lydian', 2, d, 4), 2600);
      renderPatch(b, INSTRUMENTS.saw, { freq, at: t + i * 0.1, dur: last ? 0.6 : 0.15, vol: 0.95, pan: i % 2 ? 0.3 : -0.3 });
      renderPatch(b, INSTRUMENTS.brass, { freq, at: t + i * 0.1, dur: last ? 0.6 : 0.15, vol: 0.7 });
    });
    return b;
  },
  'star-1': () => {
    const b = createBuf(0.75);
    renderDrum(b, 'taiko', 0, 0.75);
    renderDrum(b, 'woodblock', 0, 0.65);
    renderPatch(b, INSTRUMENTS.bell, { freq: foldFreq(degreeToFreq('ionian', 0, 0, 6), 2600), at: 0, dur: 0.65, vol: 1 });
    renderPatch(b, INSTRUMENTS.brass, { freq: degreeToFreq('ionian', 0, 0, 4), at: 0, dur: 0.32, vol: 0.85 });
    return b;
  },
  'star-2': () => {
    const b = createBuf(0.85);
    renderDrum(b, 'taiko', 0, 0.85);
    renderDrum(b, 'thud', 0, 0.75);
    renderPatch(b, INSTRUMENTS.bell, { freq: foldFreq(degreeToFreq('ionian', 0, 2, 6), 2600), at: 0, dur: 0.7, vol: 1 });
    renderPatch(b, INSTRUMENTS.brass, { freq: degreeToFreq('ionian', 0, 2, 4), at: 0, dur: 0.35, vol: 0.85 });
    [2, 4, 7].forEach((d, i) => renderPatch(b, INSTRUMENTS.celesta, { freq: foldFreq(degreeToFreq('ionian', 0, d, 6), 2600), at: 0.04 + i * 0.05, dur: 0.32, vol: 0.65 }));
    return b;
  },
  'star-3': () => {
    const b = createBuf(1.45);
    renderDrum(b, 'taiko', 0, 0.95);
    renderDrum(b, 'subDrop', 0, 0.9);
    renderDrum(b, 'crash', 0, 0.75);
    renderPatch(b, INSTRUMENTS.bell, { freq: foldFreq(degreeToFreq('ionian', 0, 7, 6), 2600), at: 0.02, dur: 1.1, vol: 1 });
    for (const d of [0, 2, 4, 7]) {
      renderPatch(b, INSTRUMENTS.brass, { freq: degreeToFreq('ionian', 0, d, 4), at: 0, dur: 0.75, vol: 0.8 });
      renderPatch(b, INSTRUMENTS.strings, { freq: degreeToFreq('ionian', 0, d, 4), at: 0.02, dur: 1.1, vol: 0.9 });
    }
    return b;
  },
  'rank-seal': () => {
    const b = createBuf(0.6);
    renderDrum(b, 'woodblockLo', 0, 0.85);
    renderDrum(b, 'thud', 0, 0.72);
    renderPatch(b, INSTRUMENTS.bell, { freq: degreeToFreq('ionian', 0, 7, 5), at: 0.01, dur: 0.5, vol: 0.8 });
    return b;
  },
  'foe-defeated': () => {
    const b = createBuf(1.1);
    renderDrum(b, 'crash', 0, 0.85);
    renderDrum(b, 'timpani', 0, 1);
    for (const d of [4, 6, 8]) renderPatch(b, INSTRUMENTS.brass, { freq: degreeToFreq('ionian', 0, d, 3), at: 0, dur: 0.2, vol: 0.9 });
    for (const d of [0, 2, 4, 7]) renderPatch(b, INSTRUMENTS.brass, { freq: degreeToFreq('ionian', 0, d, 3), at: 0.24, dur: 0.65, vol: 0.9 });
    return b;
  },
  'slow-mo-defeat': () => {
    const b = createBuf(1.1);
    renderPatch(b, { ...WARM_BASS, d: 0.9 }, { freq: 122, slideTo: 26, at: 0, dur: 0.8, vol: 1 });
    renderDrum(b, 'taiko', 0, 1);
    renderDrum(b, 'anvil', 0, 0.75);
    renderNoise(b, { at: 0, dur: 0.65, vol: 0.5, filter: 5600, sweepTo: 180 });
    const bellF = foldFreq(degreeToFreq('ionian', 0, 7, 5), 2600);
    renderPatch(b, INSTRUMENTS.bell, { freq: bellF, slideTo: bellF * 0.84, at: 0, dur: 0.65, vol: 0.9 });
    return b;
  },
  victory: () => {
    const b = createBuf(1.65);
    renderDrum(b, 'crash', 0, 0.85);
    renderDrum(b, 'timpani', 0, 1);
    for (const d of [4, 6, 8]) renderPatch(b, INSTRUMENTS.brass, { freq: degreeToFreq('ionian', 0, d, 3), at: 0, dur: 0.22, vol: 0.95 });
    for (const d of [0, 2, 4, 7]) {
      renderPatch(b, INSTRUMENTS.brass, { freq: degreeToFreq('ionian', 0, d, 3), at: 0.25, dur: 1.05, vol: 0.95 });
      renderPatch(b, INSTRUMENTS.strings, { freq: degreeToFreq('ionian', 0, d, 4), at: 0.25, dur: 1.15, vol: 0.95 });
    }
    [0, 2, 4, 7, 9, 11].forEach((d, i) =>
      renderPatch(b, INSTRUMENTS.glock, { freq: foldFreq(degreeToFreq('ionian', 0, d, 5), 2600), at: 0.26 + i * 0.055, dur: 0.42, vol: 0.75, pan: i % 2 ? 0.45 : -0.45 })
    );
    return b;
  },
  defeat: () => {
    const b = createBuf(1.45);
    renderNoise(b, { at: 0, dur: 0.75, vol: 0.35, filter: 6000, sweepTo: 250 });
    [4, 3, 2, 0].forEach((d, i) =>
      renderPatch(b, INSTRUMENTS.brass, { freq: degreeToFreq('aeolian', 0, d, 3), at: i * 0.22, dur: i === 3 ? 0.7 : 0.2, vol: 0.95 })
    );
    renderDrum(b, 'thud', 0.66, 1);
    return b;
  },
  'key-found': () => {
    const b = createBuf(0.75);
    renderDrum(b, 'tick', 0, 0.7);
    renderDrum(b, 'anvil', 0.015, 0.45);
    [0, 4, 7, 11].forEach((d, i) =>
      renderPatch(b, INSTRUMENTS.celesta, { freq: foldFreq(degreeToFreq('ionian', 0, d, 6), 2600), at: i * 0.042, dur: 0.36, vol: 0.78, pan: i % 2 ? 0.35 : -0.35 })
    );
    renderPatch(b, INSTRUMENTS.bell, { freq: foldFreq(degreeToFreq('ionian', 0, 7, 6), 2600), at: 0.09, dur: 0.55, vol: 0.85 });
    return b;
  },
  'friend-rescued': () => {
    const b = createBuf(1.35);
    renderDrum(b, 'anvil', 0, 0.85);
    renderDrum(b, 'taiko', 0.015, 0.85);
    renderDrum(b, 'crash', 0.04, 0.6);
    [0, 2, 4, 7].forEach((d, i) => {
      renderPatch(b, INSTRUMENTS.brass, { freq: degreeToFreq('ionian', 0, d, 4), at: 0.03 + i * 0.068, dur: i === 3 ? 0.75 : 0.2, vol: 0.85 });
      renderPatch(b, INSTRUMENTS.bell, { freq: foldFreq(degreeToFreq('ionian', 0, d, 6), 2600), at: 0.03 + i * 0.068, dur: 0.5, vol: 0.75, pan: i % 2 ? 0.45 : -0.45 });
    });
    return b;
  },
  // 6 weapon-role stings so all 64 Armory weapons produce role-authentic native feedback
  'sting-brass': () => {
    const b = createBuf(0.42);
    [0, 4, 7].forEach((d, i) => renderPatch(b, INSTRUMENTS.brass, { freq: degreeToFreq('ionian', 0, d, 3), at: i * 0.05, dur: 0.2, vol: 0.95 }));
    renderDrum(b, 'timpani', 0, 0.65);
    return b;
  },
  'sting-bell': () => {
    const b = createBuf(0.45);
    [0, 2, 4, 7].forEach((d, i) => renderPatch(b, INSTRUMENTS.celesta, { freq: foldFreq(degreeToFreq('ionian', 0, d, 5), 2600), at: i * 0.045, dur: 0.24, vol: 0.9, pan: i % 2 ? 0.3 : -0.3 }));
    return b;
  },
  'sting-mallet': () => {
    const b = createBuf(0.4);
    [0, 4, 7].forEach((d, i) => renderPatch(b, INSTRUMENTS.marimba, { freq: degreeToFreq('ionian', 0, d, 4), at: i * 0.05, dur: 0.2, vol: 0.95 }));
    renderDrum(b, 'woodblock', 0, 0.45);
    return b;
  },
  'sting-pluck': () => {
    const b = createBuf(0.4);
    [0, 2, 4, 7].forEach((d, i) => renderPatch(b, INSTRUMENTS.pluck, { freq: degreeToFreq('ionian', 0, d, 4), at: i * 0.045, dur: 0.18, vol: 0.95 }));
    return b;
  },
  'sting-orchestra': () => {
    const b = createBuf(0.5);
    [0, 2, 4].forEach((d, i) => renderPatch(b, INSTRUMENTS.organ, { freq: degreeToFreq('ionian', 0, d, 4), at: i * 0.055, dur: 0.26, vol: 0.9 }));
    return b;
  },
  'sting-wind': () => {
    const b = createBuf(0.42);
    [0, 2, 4].forEach((d, i) => renderPatch(b, INSTRUMENTS.flute, { freq: degreeToFreq('ionian', 0, d, 5), at: i * 0.055, dur: 0.2, vol: 0.95 }));
    return b;
  },
};

// ─── WAV Writer & AAC-LC Encoder ─────────────────────────────────────────────

const writeStereoWav = (filePath: string, buf: StereoBuf) => {
  const frames = buf.left.length;
  const dataLen = frames * 4;
  const out = Buffer.alloc(44 + dataLen);
  out.write('RIFF', 0);
  out.writeUInt32LE(36 + dataLen, 4);
  out.write('WAVE', 8);
  out.write('fmt ', 12);
  out.writeUInt32LE(16, 16);
  out.writeUInt16LE(1, 20);
  out.writeUInt16LE(2, 22);
  out.writeUInt32LE(buf.sampleRate, 24);
  out.writeUInt32LE(buf.sampleRate * 4, 28);
  out.writeUInt16LE(4, 32);
  out.writeUInt16LE(16, 34);
  out.write('data', 36);
  out.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < frames; i++) {
    const l = Math.max(-1, Math.min(1, buf.left[i]));
    const r = Math.max(-1, Math.min(1, buf.right[i]));
    out.writeInt16LE(Math.round(l * 32767), 44 + i * 4);
    out.writeInt16LE(Math.round(r * 32767), 44 + i * 4 + 2);
  }
  fs.writeFileSync(filePath, out);
};

const hasBinary = (bin: string): boolean => {
  try {
    execFileSync('which', [bin], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
};

const encodeM4a = (wavPath: string, m4aPath: string, bitrateKbps: number) => {
  if (hasBinary('afconvert')) {
    execFileSync('afconvert', ['-f', 'm4af', '-d', `aac@${SR}`, '-b', String(bitrateKbps * 1000), wavPath, m4aPath]);
  } else if (hasBinary('ffmpeg')) {
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wavPath, '-c:a', 'aac', '-b:a', `${bitrateKbps}k`, '-ar', String(SR), m4aPath]);
  } else {
    throw new Error('Neither afconvert (macOS) nor ffmpeg was found to encode AAC .m4a files.');
  }
};

const main = () => {
  fs.mkdirSync(OUT_LOOPS_DIR, { recursive: true });
  fs.mkdirSync(OUT_CUES_DIR, { recursive: true });
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nshapes-native-audio-'));
  let loopBytes = 0;
  let cueBytes = 0;

  try {
    console.log('Rendering seamless biome BGM loops...');
    for (const [name, arr] of Object.entries(ARRANGEMENTS)) {
      const buf = renderArrangementLoop(name, arr);
      const wavPath = path.join(tmpDir, `loop-${name}.wav`);
      const m4aPath = path.join(OUT_LOOPS_DIR, `${name}.m4a`);
      writeStereoWav(wavPath, buf);
      encodeM4a(wavPath, m4aPath, 64);
      const sz = fs.statSync(m4aPath).size;
      loopBytes += sz;
      console.log(`  loop ${name}.m4a (${(buf.left.length / SR).toFixed(1)}s, ${(sz / 1024).toFixed(1)} KB)`);
    }

    console.log('Rendering native Adventure & Summit SFX cues...');
    for (const [name, build] of Object.entries(CUE_BUILDERS)) {
      const buf = build();
      masterBuffer(buf, SOFT_CLIP_CEILING * 0.94, name.startsWith('select') || name === 'deselect' || name === 'mistake' ? 0.04 : 0.12);
      const wavPath = path.join(tmpDir, `cue-${name}.wav`);
      const m4aPath = path.join(OUT_CUES_DIR, `${name}.m4a`);
      writeStereoWav(wavPath, buf);
      encodeM4a(wavPath, m4aPath, 96);
      const sz = fs.statSync(m4aPath).size;
      cueBytes += sz;
      console.log(`  cue  ${name}.m4a (${Math.round((buf.left.length / SR) * 1000)}ms, ${(sz / 1024).toFixed(1)} KB)`);
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  console.log(
    `\nDone! Loops: ${(loopBytes / 1024).toFixed(1)} KB (${Object.keys(ARRANGEMENTS).length} files) | ` +
    `Cues: ${(cueBytes / 1024).toFixed(1)} KB (${Object.keys(CUE_BUILDERS).length} files) | ` +
    `Total: ${((loopBytes + cueBytes) / 1024).toFixed(1)} KB`
  );
};

main();
