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

  get available(): boolean {
    return getAudioContextCtor() !== null;
  }

  /** Create the context lazily (must happen after a user gesture on the web). */
  ensure(): boolean {
    if (this.ctx) {
      if (this.live && this.live.state === 'suspended') void this.live.resume();
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
    const prev = { ctx: this.ctx, master: this.master, musicBus: this.musicBus, sfxBus: this.sfxBus, pulse: new Map(this.pulseWaves), wave: this.waveVoice, nl: this.noiseLong, ns: this.noiseShort };
    this.wire(ctx);
    return () => {
      this.ctx = prev.ctx; this.master = prev.master; this.musicBus = prev.musicBus; this.sfxBus = prev.sfxBus;
      this.pulseWaves = prev.pulse; this.waveVoice = prev.wave; this.noiseLong = prev.nl; this.noiseShort = prev.ns;
    };
  }

  private wire(ctx: Ctx) {
    {
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.95;
      // gentle low-pass to take the edge off raw squares
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 9000;
      this.master.connect(lp).connect(ctx.destination);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0.32;
      this.musicBus.connect(this.master);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.55;
      this.sfxBus.connect(this.master);
      this.buildWaves(ctx);
    }
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
    bus?: 'music' | 'sfx';
    decay?: number; // 0..1, how much the envelope falls over the note
  }) {
    const ctx = this.ctx;
    if (!ctx || !opts.freq) return;
    const bus = opts.bus === 'sfx' ? this.sfxBus : this.musicBus;
    if (!bus) return;
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
    osc.connect(g).connect(bus);
    osc.start(opts.at);
    osc.stop(opts.at + opts.dur + 0.02);
  }

  noise(opts: { at: number; dur: number; vol?: number; short?: boolean; bus?: 'music' | 'sfx'; filter?: number; sweepTo?: number }) {
    const ctx = this.ctx;
    const buf = opts.short ? this.noiseShort : this.noiseLong;
    const bus = opts.bus === 'sfx' ? this.sfxBus : this.musicBus;
    if (!ctx || !buf || !bus) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(opts.filter ?? 3000, opts.at);
    if (opts.sweepTo) f.frequency.exponentialRampToValueAtTime(opts.sweepTo, opts.at + opts.dur);
    f.Q.value = 0.7;
    const g = ctx.createGain();
    const v = (opts.vol ?? 0.4) * 0.5;
    g.gain.setValueAtTime(v, opts.at);
    g.gain.exponentialRampToValueAtTime(0.0001, opts.at + opts.dur);
    src.connect(f).connect(g).connect(bus);
    src.start(opts.at, Math.random() * 0.5);
    src.stop(opts.at + opts.dur + 0.02);
  }
}

export const chip = new Chip();
