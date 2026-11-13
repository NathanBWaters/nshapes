/**
 * A tiny Game Boy–style sound chip on top of Web Audio.
 *
 *   pulse1, pulse2 — square waves with selectable duty (12.5 / 25 / 50 / 75 %)
 *   wave           — 32-step, 4-bit wavetable voice (bass)
 *   noise          — LFSR noise (long = hiss/snare, short = metallic hat)
 *
 * No audio files: every note and effect is synthesized live, following
 * poteto's approach. On platforms without Web Audio, everything is a no-op.
 */

export type Duty = 0.125 | 0.25 | 0.5 | 0.75;
export type Voice = 'pulse1' | 'pulse2' | 'wave' | 'noise';
export type Bus = 'music' | 'sfx';
/** How much room a sound sits in: dry, a small room, a hall, or a tempo echo */
export type Space = 'dry' | 'room' | 'hall' | 'echo';

/**
 * An instrument, as data (src/audio/instruments.ts). Every patch is a few
 * oscillators through an envelope: the chip grew up, but it is still all
 * synthesis and no files.
 */
export interface Patch {
  osc: 'sine' | 'triangle' | 'sawtooth' | 'square' | 'pulse' | 'wave';
  duty?: Duty;
  /** A second oscillator this many cents away (chorus / unison) */
  detune?: number;
  /** Extra sine partials: [frequency ratio, gain] */
  partials?: [number, number][];
  /** FM bell tone: modulator ratio, depth (× carrier frequency) and how fast the depth fades (s) */
  fm?: { ratio: number; index: number; decay: number };
  /** Attack (s), decay (s), sustain (0..1) and release (s). Sustain 0 = a plucked note that ignores `dur`. */
  a: number;
  d: number;
  s: number;
  r: number;
  /** Low-pass: cutoff in Hz, or in multiples of the note with `track`; `env` opens it by that factor on the attack */
  lp?: { hz: number; track?: boolean; env?: number; decay?: number; q?: number };
  vibrato?: number;
  vol: number;
  space?: Space;
}

const SPACES: Space[] = ['dry', 'room', 'hall', 'echo'];
/** [reverb send, echo send] per space */
const SENDS: Record<Space, [number, number]> = { dry: [0, 0], room: [0.16, 0], hall: [0.42, 0.06], echo: [0.2, 0.34] };
/** More voices than this at once and quiet layers are skipped (phones) */
const MAX_VOICES = 56;

type Ctx = BaseAudioContext;

const getAudioContextCtor = (): (new () => AudioContext) | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: new () => AudioContext; webkitAudioContext?: new () => AudioContext };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
};

export const NOTE_INDEX: Record<string, number> = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };

/** "C5" → Hz (A4 = 440). Optional semitone transpose. */
export const noteToFreq = (note: string, transpose = 0): number => {
  const m = /^([A-G](?:#|b)?)(-?\d)$/.exec(note);
  if (!m) return 0;
  const midi = (parseInt(m[2], 10) + 1) * 12 + NOTE_INDEX[m[1]] + transpose;
  return 440 * Math.pow(2, (midi - 69) / 12);
};

export class Chip {
  ctx: Ctx | null = null;
  private live: AudioContext | null = null;
  master: GainNode | null = null;
  musicBus: GainNode | null = null;
  sfxBus: GainNode | null = null;
  private pulseWaves = new Map<Duty, PeriodicWave>();
  private waveVoice: PeriodicWave | null = null;
  private noiseLong: AudioBuffer | null = null;
  private noiseShort: AudioBuffer | null = null;
  private inputs: Record<Bus, Partial<Record<Space, GainNode>>> = { music: {}, sfx: {} };
  private musicFilter: BiquadFilterNode | null = null;
  private duckGain: GainNode | null = null;
  private echoes: DelayNode[] = [];
  private ends: number[] = [];
  /** Voices started since the context was wired (for tests and the sound studio) */
  voiceCount = 0;

  /** The real (speaker) context, if created. */
  get liveContext(): AudioContext | null {
    return this.live;
  }

  get available(): boolean {
    return getAudioContextCtor() !== null;
  }

  /** Create the context lazily (must happen after a user gesture on the web). */
  ensure(): boolean {
    if (this.ctx) {
      // iOS reports 'interrupted' after calls/app switches, not just 'suspended'
      if (this.live && this.live.state !== 'running' && this.live.state !== 'closed') void this.live.resume().catch(() => undefined);
      return true;
    }
    const Ctor = getAudioContextCtor();
    if (!Ctor) return false;
    try {
      const ctx = new Ctor();
      this.live = ctx;
      this.wire(ctx);
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  /**
   * Point the chip at another context (e.g. an OfflineAudioContext to render
   * a preview to a buffer). Returns a function that restores the live one.
   */
  useContext(ctx: Ctx): () => void {
    const prev = {
      ctx: this.ctx, master: this.master, musicBus: this.musicBus, sfxBus: this.sfxBus, pulse: new Map(this.pulseWaves), wave: this.waveVoice,
      nl: this.noiseLong, ns: this.noiseShort, inputs: this.inputs, filter: this.musicFilter, duck: this.duckGain, echoes: this.echoes, ends: this.ends,
    };
    this.pulseWaves = new Map();
    this.wire(ctx);
    return () => {
      this.ctx = prev.ctx; this.master = prev.master; this.musicBus = prev.musicBus; this.sfxBus = prev.sfxBus;
      this.pulseWaves = prev.pulse; this.waveVoice = prev.wave; this.noiseLong = prev.nl; this.noiseShort = prev.ns;
      this.inputs = prev.inputs; this.musicFilter = prev.filter; this.duckGain = prev.duck; this.echoes = prev.echoes; this.ends = prev.ends;
    };
  }

  private wire(ctx: Ctx) {
    this.ctx = ctx;
    this.ends = [];
    this.voiceCount = 0;
    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    // A limiter, so a jackpot on top of a full band never clips
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -9;
    limiter.knee.value = 8;
    limiter.ratio.value = 9;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.16;
    // gentle low-pass to take the edge off raw squares
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 11000;
    this.master.connect(limiter).connect(lp).connect(ctx.destination);

    // Music: bus → filter (muffles when paused or hurt) → duck (dips under big hits) → master
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.32;
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 18000;
    this.musicFilter.Q.value = 0.5;
    this.duckGain = ctx.createGain();
    this.musicBus.connect(this.musicFilter).connect(this.duckGain).connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.55;
    this.sfxBus.connect(this.master);

    // Space: each bus has its own reverb and echo, returning INTO the bus, so
    // muffling, ducking or muting the music also muffles its room
    const tail = this.impulse(ctx, 1.7);
    this.inputs = { music: {}, sfx: {} };
    this.echoes = [];
    for (const bus of ['music', 'sfx'] as Bus[]) {
      const out = bus === 'music' ? this.musicBus : this.sfxBus;
      const reverb = ctx.createConvolver();
      reverb.buffer = tail;
      const reverbOut = ctx.createGain();
      reverbOut.gain.value = 0.7;
      reverb.connect(reverbOut).connect(out);
      const echo = ctx.createDelay(1.5);
      echo.delayTime.value = 0.28;
      const feedback = ctx.createGain();
      feedback.gain.value = 0.36;
      const echoTone = ctx.createBiquadFilter();
      echoTone.type = 'lowpass';
      echoTone.frequency.value = 3200;
      echo.connect(echoTone).connect(feedback).connect(echo);
      echoTone.connect(out);
      this.echoes.push(echo);
      for (const space of SPACES) {
        if (space === 'dry') { this.inputs[bus][space] = out; continue; }
        const g = ctx.createGain();
        g.connect(out);
        const [rev, ech] = SENDS[space];
        if (rev) { const s = ctx.createGain(); s.gain.value = rev; g.connect(s).connect(reverb); }
        if (ech) { const s = ctx.createGain(); s.gain.value = ech; g.connect(s).connect(echo); }
        this.inputs[bus][space] = g;
      }
    }
    this.buildWaves(ctx);
  }

  /** A reverb tail made of decaying noise: darker as it fades, like a room */
  private impulse(ctx: Ctx, seconds: number): AudioBuffer {
    const len = Math.floor(ctx.sampleRate * seconds);
    const channels = Math.min(2, ctx.destination.channelCount || 1);
    const buf = ctx.createBuffer(channels, len, ctx.sampleRate);
    let seed = 0x2f6e2b1;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x80000000 - 1;
    };
    for (let c = 0; c < channels; c++) {
      const data = buf.getChannelData(c);
      let smooth = 0;
      for (let i = 0; i < len; i++) {
        const k = i / len;
        const damp = 0.25 + 0.7 * k; // high frequencies die first
        smooth = smooth * damp + rand() * (1 - damp);
        data[i] = smooth * Math.pow(1 - k, 2.6) * (i < 400 ? i / 400 : 1);
      }
    }
    return buf;
  }

  private input(bus: Bus | undefined, space: Space | undefined): GainNode | null {
    return this.inputs[bus ?? 'music'][space ?? 'dry'] ?? (bus === 'sfx' ? this.sfxBus : this.musicBus);
  }

  /** May another voice start at `at`? Quiet layers pass `soft` and are dropped first when the chip is busy. */
  private admit(at: number, end: number, soft?: boolean): boolean {
    // Voices still sounding when this one starts (works live and when rendering offline)
    if (this.ends.length > 24) this.ends = this.ends.filter(e => e > at);
    if (soft && this.ends.length >= MAX_VOICES) return false;
    if (this.ends.length >= MAX_VOICES * 2) return false;
    this.ends.push(end);
    this.voiceCount += 1;
    return true;
  }

  /** Voices sounding or scheduled right now */
  get activeVoices(): number {
    const now = this.now;
    return this.ends.filter(e => e > now).length;
  }

  /** Close or open the music's low-pass (pause, danger, the shop) over `glide` seconds. */
  setMusicFilter(hz: number, glide = 0.4) {
    if (!this.ctx || !this.musicFilter) return;
    this.musicFilter.frequency.setTargetAtTime(Math.max(200, Math.min(18000, hz)), this.now, Math.max(0.01, glide / 3));
  }

  /** Music level, 0..1 (quieter when paused or in the shop). */
  setMusicLevel(level: number, glide = 0.4) {
    if (!this.ctx || !this.musicBus) return;
    this.musicBus.gain.setTargetAtTime(0.32 * Math.max(0, Math.min(1, level)), this.now, Math.max(0.01, glide / 3));
  }

  /** Dip the music under a big sound and let it swell back (the casino "payout" pump). */
  duck(depth: number, at: number, release = 0.5) {
    if (!this.ctx || !this.duckGain) return;
    const g = this.duckGain.gain;
    g.cancelScheduledValues(at);
    g.setTargetAtTime(Math.max(0.05, 1 - depth), at, 0.012);
    g.setTargetAtTime(1, at + 0.07, release / 3);
  }

  /** Echo repeats on the beat: call when the tempo changes. */
  setEchoTime(seconds: number) {
    if (!this.ctx) return;
    for (const echo of this.echoes) echo.delayTime.setTargetAtTime(Math.max(0.05, Math.min(1.4, seconds)), this.now, 0.05);
  }

  get now(): number {
    return this.ctx?.currentTime ?? 0;
  }

  private buildWaves(ctx: Ctx) {
    // Pulse via Fourier series of a rectangular wave
    const N = 48;
    for (const duty of [0.125, 0.25, 0.5, 0.75] as Duty[]) {
      const real = new Float32Array(N);
      const imag = new Float32Array(N);
      for (let n = 1; n < N; n++) {
        real[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty) * Math.cos(n * Math.PI * duty);
        imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty) * Math.sin(n * Math.PI * duty);
      }
      this.pulseWaves.set(duty, ctx.createPeriodicWave(real, imag));
    }
    // 4-bit wavetable: a soft, slightly buzzy triangle (classic GB bass)
    const table = [0, 2, 4, 6, 8, 10, 12, 14, 15, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0, 0, 1, 1, 0, 0, 0, 0];
    const samples = table.map(v => v / 7.5 - 1);
    const H = 16;
    const re = new Float32Array(H);
    const im = new Float32Array(H);
    for (let k = 1; k < H; k++) {
      let a = 0;
      let b = 0;
      samples.forEach((x, i) => {
        const ph = (2 * Math.PI * k * i) / samples.length;
        a += x * Math.cos(ph);
        b += x * Math.sin(ph);
      });
      re[k] = a / samples.length;
      im[k] = b / samples.length;
    }
    this.waveVoice = ctx.createPeriodicWave(re, im);
    // LFSR noise
    const makeNoise = (short: boolean) => {
      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      let lfsr = 0x7fff;
      const stepEvery = 4;
      let out = 1;
      for (let i = 0; i < len; i++) {
        if (i % stepEvery === 0) {
          const bit = (lfsr ^ (lfsr >> 1)) & 1;
          lfsr = (lfsr >> 1) | (bit << 14);
          if (short) lfsr = (lfsr & ~(1 << 6)) | (bit << 6);
          out = lfsr & 1 ? 1 : -1;
        }
        data[i] = out;
      }
      return buf;
    };
    this.noiseLong = makeNoise(false);
    this.noiseShort = makeNoise(true);
  }

  /** Schedule a tone. Returns nothing; nodes clean themselves up. */
  tone(opts: {
    voice: 'pulse1' | 'pulse2' | 'wave';
    freq: number;
    at: number;
    dur: number;
    vol?: number;
    duty?: Duty;
    slideTo?: number;
    vibrato?: number;
    bus?: Bus;
    space?: Space;
    pan?: number;
    soft?: boolean;
    decay?: number; // 0..1, how much the envelope falls over the note
  }) {
    const ctx = this.ctx;
    if (!ctx || !opts.freq) return;
    const bus = this.input(opts.bus, opts.space);
    if (!bus) return;
    if (!this.admit(opts.at, opts.at + opts.dur, opts.soft)) return;
    const osc = ctx.createOscillator();
    const wave = opts.voice === 'wave' ? this.waveVoice : this.pulseWaves.get(opts.duty ?? 0.5);
    if (wave) osc.setPeriodicWave(wave);
    osc.frequency.setValueAtTime(opts.freq, opts.at);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), opts.at + opts.dur);
    if (opts.vibrato) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 5.5;
      lfoGain.gain.value = opts.freq * opts.vibrato;
      lfo.connect(lfoGain).connect(osc.frequency);
      lfo.start(opts.at + Math.min(0.12, opts.dur / 2));
      lfo.stop(opts.at + opts.dur + 0.05);
    }
    const g = ctx.createGain();
    const v = (opts.vol ?? 0.5) * (opts.voice === 'wave' ? 0.9 : 0.35);
    const decay = opts.decay ?? 0.35;
    g.gain.setValueAtTime(0.0001, opts.at);
    g.gain.linearRampToValueAtTime(v, opts.at + 0.005);
    g.gain.linearRampToValueAtTime(v * (1 - decay), opts.at + Math.max(0.01, opts.dur * 0.85));
    g.gain.linearRampToValueAtTime(0.0001, opts.at + opts.dur);
    osc.connect(g);
    this.out(ctx, g, bus, opts.pan);
    osc.start(opts.at);
    osc.stop(opts.at + opts.dur + 0.02);
  }

  private out(ctx: Ctx, node: AudioNode, dest: AudioNode, pan?: number) {
    if (pan && typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(p).connect(dest);
    } else node.connect(dest);
  }

  /** Play one note of an instrument patch. */
  play(p: Patch, o: { freq: number; at: number; dur: number; vol?: number; pan?: number; bus?: Bus; space?: Space; slideTo?: number; soft?: boolean }) {
    const ctx = this.ctx;
    if (!ctx || !o.freq || !isFinite(o.freq)) return;
    const dest = this.input(o.bus, o.space ?? p.space);
    if (!dest) return;
    const freq = Math.min(o.freq, 7000);
    const plucked = p.s === 0;
    const hold = plucked ? p.d : Math.max(p.a, o.dur);
    const releaseAt = o.at + hold;
    const end = releaseAt + (plucked ? p.d * 0.6 : p.r) + 0.03;
    if (!this.admit(o.at, end, o.soft)) return;
    const peak = Math.max(0.0001, (o.vol ?? 1) * p.vol);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, o.at);
    g.gain.linearRampToValueAtTime(peak, o.at + p.a);
    g.gain.setTargetAtTime(plucked ? 0.0001 : peak * p.s, o.at + p.a, Math.max(0.005, p.d / 3.5));
    if (!plucked) g.gain.setTargetAtTime(0.0001, releaseAt, Math.max(0.005, p.r / 4));

    const sources: OscillatorNode[] = [];
    const add = (f: number, gain: number, detune = 0, sine = false) => {
      const osc = ctx.createOscillator();
      if (sine || p.osc === 'sine') osc.type = 'sine';
      else if (p.osc === 'pulse' || p.osc === 'wave') {
        const wave = p.osc === 'wave' ? this.waveVoice : this.pulseWaves.get(p.duty ?? 0.5);
        if (wave) osc.setPeriodicWave(wave);
      } else osc.type = p.osc;
      osc.frequency.setValueAtTime(f, o.at);
      if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, (o.slideTo * f) / freq), o.at + Math.max(0.02, o.dur));
      if (detune) osc.detune.value = detune;
      if (gain === 1) osc.connect(pre);
      else {
        const og = ctx.createGain();
        og.gain.value = gain;
        osc.connect(og).connect(pre);
      }
      sources.push(osc);
      return osc;
    };
    const pre = ctx.createGain();
    pre.gain.value = p.detune ? 0.7 : 1;
    const carrier = add(freq, 1);
    if (p.detune) add(freq, 1, p.detune);
    for (const [ratio, gain] of p.partials ?? []) if (freq * ratio < 9000) add(freq * ratio, gain, 0, true);
    if (p.fm) {
      const mod = ctx.createOscillator();
      mod.type = 'sine';
      mod.frequency.setValueAtTime(freq * p.fm.ratio, o.at);
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(freq * p.fm.index, o.at);
      depth.gain.setTargetAtTime(freq * p.fm.index * 0.08, o.at, Math.max(0.01, p.fm.decay / 3));
      mod.connect(depth).connect(carrier.frequency);
      sources.push(mod);
    }
    if (p.vibrato) {
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 5.2;
      depth.gain.value = freq * p.vibrato;
      lfo.connect(depth).connect(carrier.frequency);
      sources.push(lfo);
    }
    if (p.lp) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      const base = Math.max(120, Math.min(16000, p.lp.track ? p.lp.hz * freq : p.lp.hz));
      f.Q.value = p.lp.q ?? 0.7;
      if (p.lp.env) {
        f.frequency.setValueAtTime(Math.min(16000, base * (1 + p.lp.env)), o.at);
        f.frequency.setTargetAtTime(base, o.at, Math.max(0.01, (p.lp.decay ?? p.d) / 3));
      } else f.frequency.value = base;
      pre.connect(f).connect(g);
    } else pre.connect(g);
    this.out(ctx, g, dest, o.pan);
    for (const src of sources) {
      src.start(o.at);
      src.stop(end);
    }
  }

  noise(opts: {
    at: number; dur: number; vol?: number; short?: boolean; bus?: Bus; space?: Space; pan?: number; filter?: number; sweepTo?: number;
    /** bandpass (default), or everything above / below `filter` */
    type?: 'bandpass' | 'highpass' | 'lowpass';
    /** Fade in over this many seconds (risers) instead of starting at full */
    attack?: number;
    soft?: boolean;
  }) {
    const ctx = this.ctx;
    const buf = opts.short ? this.noiseShort : this.noiseLong;
    const bus = this.input(opts.bus, opts.space);
    if (!ctx || !buf || !bus) return;
    if (!this.admit(opts.at, opts.at + opts.dur, opts.soft)) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.setValueAtTime(opts.filter ?? 3000, opts.at);
    if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, opts.at + opts.dur);
    f.Q.value = 0.7;
    const g = ctx.createGain();
    const v = (opts.vol ?? 0.4) * 0.5;
    if (opts.attack) {
      g.gain.setValueAtTime(0.0001, opts.at);
      g.gain.exponentialRampToValueAtTime(v, opts.at + Math.min(opts.attack, opts.dur * 0.95));
      g.gain.setTargetAtTime(0.0001, opts.at + Math.min(opts.attack, opts.dur * 0.95), 0.02);
    } else {
      g.gain.setValueAtTime(v, opts.at);
      g.gain.exponentialRampToValueAtTime(0.0001, opts.at + opts.dur);
    }
    src.connect(f).connect(g);
    this.out(ctx, g, bus, opts.pan);
    src.start(opts.at, Math.random() * 0.5);
    src.stop(opts.at + opts.dur + 0.02);
  }
}

export const chip = new Chip();
