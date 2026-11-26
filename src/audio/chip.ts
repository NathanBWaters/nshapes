/**
 * A tiny Game Boy–style sound chip on top of Web Audio.
 *
 *   pulse1, pulse2 — square waves with selectable duty (12.5 / 25 / 50 / 75 %)
 *   wave           — 32-step, 4-bit wavetable voice (bass)
 *   noise          — LFSR noise (long = hiss/snare, short = metallic hat)
 *
 * No audio files: every note and effect is synthesized live, following
 * poteto's approach. On platforms without Web Audio, everything is a no-op.
 *
 * Mastering & Routing:
 *   - 4-Tier SFX priority bus (S / A / B / C) with SFX-to-SFX ducking ([AU-04])
 *   - Priority voice-stealing at MAX_VOICES (56) so Tier S/A cues never drop ([AU-04])
 *   - Plucked (s === 0) envelopes honor o.dur ([AU-09])
 *   - Dedicated 0.35 s SFX room split from a single shared 1.7 s hall convolver;
 *     zero echo delay bus on SFX ([AU-10])
 *   - Octave pitch folding & FM Nyquist guard ([AU-14])
 *   - Phone-speaker-safe master bus + studio monitor simulation ([AU-15], [AU-16])
 */

import { Platform } from 'react-native';
import { getIsAppActive } from '@/utils/appLifecycle';

export type Duty = 0.125 | 0.25 | 0.5 | 0.75;
export type Voice = 'pulse1' | 'pulse2' | 'wave' | 'noise';
export type Bus = 'music' | 'sfx';
/** How much room a sound sits in: dry, a small room, a tight 0.35 s SFX room, a hall, or a tempo echo */
export type Space = 'dry' | 'room' | 'sfxRoom' | 'hall' | 'echo';
/** Sakurai Ep. #032 SFX priority hierarchy: S (KO/parry/hurt) > A (hits/parry/blast) > B (stings/coins) > C (UI taps) */
export type SfxTier = 'S' | 'A' | 'B' | 'C';
/** Voice-stealing priority: 0 = soft/Tier C, 1 = music/Tier B, 2 = Tier A, 3 = Tier S */
export type VoicePriority = 0 | 1 | 2 | 3;
/** Audition-only studio monitor mode ([AU-16]): production always runs 'flat'. */
export type MonitorMode = 'flat' | 'phone' | 'lowVol';

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
  /** Attack (s), decay (s), sustain (0..1) and release (s). Sustain 0 = plucked note whose decay honors `min(p.d, o.dur)`. */
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

const MUSIC_SPACES: Space[] = ['dry', 'room', 'hall', 'echo'];
const SFX_TIERS: SfxTier[] = ['S', 'A', 'B', 'C'];
/** [reverb send, echo send] per space on the music bus */
const MUSIC_SENDS: Record<Space, [number, number]> = {
  dry: [0, 0],
  room: [0.16, 0],
  sfxRoom: [0.16, 0],
  hall: [0.42, 0.06],
  echo: [0.2, 0.34],
};
/** More voices than this at once and lower-priority voices are stolen cleanly (phones) */
export const MAX_VOICES = 56;

/** 4-Tier SFX bus linear gains (0 dB, -1 dB, -5 dB, -8 dB) ([AU-04]). */
export const SFX_BUS_GAIN = 0.6;
export const SFX_TIER_GAINS: Record<SfxTier, number> = {
  S: 1.0,
  A: 0.89,
  B: 0.56,
  C: 0.4,
};
export const SFX_TIER_PRIORITY: Record<SfxTier, VoicePriority> = {
  S: 3,
  A: 2,
  B: 1,
  C: 0,
};
/** Reverb impulse lengths (s): tight 0.35 s SFX room vs single shared 1.7 s hall ([AU-10]). */
export const REVERB_SECONDS = {
  hall: 1.7,
  sfxRoom: 0.35,
} as const;
/** Low-priority biome ambience base gain (-20 dB) ([AU-20]). */
export const AMBIENCE_BUS_GAIN = 0.1;

/** Emergency ceiling for raw oscillator pitch (Hz) — prevents aliasing and shrieks. */
export const MAX_OSC_FREQ_HZ = 4200;
/** Soft-clipper output ceiling (-0.3 dBFS ≈ 0.966). */
export const SOFT_CLIP_CEILING = Math.pow(10, -0.3 / 20);
/** Phone-speaker-safe master bus mastering parameters ([AU-15]). */
export const MASTER_BUS = {
  gain: 0.88,
  hpfHz: 70,
  hpfQ: 0.707,
  presenceHz: 4000,
  presenceQ: 0.9,
  presenceGainDb: -3,
  lpfHz: 10500,
  limiterThreshold: -6,
  limiterKnee: 2,
  limiterRatio: 20,
  limiterAttack: 0.001,
  limiterRelease: 0.09,
  softClipDrive: 1.15,
  softClipSamples: 4096,
} as const;

/**
 * Octave-fold frequencies above `maxHz` down into a phone-friendly register
 * while preserving exact pitch class and harmonic consonance ([AU-14]).
 */
export const foldFreq = (freq: number, maxHz = 2600): number => {
  if (!Number.isFinite(freq) || freq <= 0 || maxHz <= 0) return freq;
  let f = freq;
  while (f > maxHz) f /= 2;
  return f;
};

/** Smooth odd-symmetric tanh soft-clipper curve capped at -0.3 dBFS ([AU-15]). */
export const makeSoftClipCurve = (
  samples: number = MASTER_BUS.softClipSamples,
  drive: number = MASTER_BUS.softClipDrive
): Float32Array<ArrayBuffer> => {
  const curve = new Float32Array(samples);
  const norm = Math.tanh(drive);
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / (samples - 1) - 1;
    curve[i] = (Math.tanh(drive * x) / norm) * SOFT_CLIP_CEILING;
  }
  return curve;
};

const SOFT_CLIP_CURVE = makeSoftClipCurve();

type Ctx = BaseAudioContext;

interface TrackedVoice {
  at: number;
  end: number;
  priority: VoicePriority;
  gain: GainNode | null;
  sources: AudioScheduledSourceNode[];
}

export interface ChipDiagnostics {
  activeVoices: number;
  maxVoices: number;
  stolenVoices: number;
  voiceCount: number;
  monitorMode: MonitorMode;
  rms: number;
  peak: number;
  tiers: Record<SfxTier, { count: number; recent: boolean }>;
}

interface NativeAudioManagerLike {
  setSystemOptions?: (opts: {
    ios?: {
      category?: string;
      options?: string[];
      allowHaptics?: boolean;
      notifyOthersOnDeactivation?: boolean;
    };
  }) => void;
  setAudioSessionActivity?: (enabled: boolean) => Promise<void>;
}

interface NativeAudioModuleLike {
  AudioContext?: new () => AudioContext;
  AudioManager?: NativeAudioManagerLike;
}

let nativeAudioCache: NativeAudioModuleLike | null | undefined;
let nativeSessionConfigured = false;

const loadNativeAudioModule = (): NativeAudioModuleLike | null => {
  if (Platform.OS === 'web') return null;
  if (nativeAudioCache !== undefined) return nativeAudioCache;
  try {
    nativeAudioCache = require('react-native-audio-api') as NativeAudioModuleLike;
  } catch {
    nativeAudioCache = null;
  }
  return nativeAudioCache;
};

const configureNativeSession = (active: boolean) => {
  const mgr = loadNativeAudioModule()?.AudioManager;
  if (!mgr) return;
  try {
    if (active && !nativeSessionConfigured && typeof mgr.setSystemOptions === 'function') {
      nativeSessionConfigured = true;
      mgr.setSystemOptions({
        ios: {
          // Respect iOS Silent Switch, mix gently with background music/podcasts, and keep haptics enabled
          category: 'ambient',
          options: ['mixWithOthers'],
          allowHaptics: true,
          notifyOthersOnDeactivation: true,
        },
      });
    }
    if (typeof mgr.setAudioSessionActivity === 'function') {
      void Promise.resolve(mgr.setAudioSessionActivity(active)).catch(() => undefined);
    }
  } catch {
    /* ignore audio session setup failures */
  }
};

const getAudioContextCtor = (): (new () => AudioContext) | null => {
  if (Platform.OS !== 'web') {
    const NativeCtor = loadNativeAudioModule()?.AudioContext;
    if (typeof NativeCtor === 'function') return NativeCtor;
  }
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

/** Resolve effective SFX space: clamp patch-default hall/echo to sfxRoom, keep Tier C dry, allow explicit 'hall'. */
export const resolveSpace = (bus: Bus | undefined, explicitSpace: Space | undefined, patchSpace: Space | undefined, tier?: SfxTier): Space => {
  if (bus === 'sfx') {
    if (tier === 'C') return explicitSpace === 'hall' ? 'sfxRoom' : 'dry';
    if (explicitSpace !== undefined) {
      if (explicitSpace === 'echo' || explicitSpace === 'room') return 'sfxRoom';
      return explicitSpace;
    }
    if (patchSpace === 'hall' || patchSpace === 'echo' || patchSpace === 'room' || patchSpace === 'sfxRoom') return 'sfxRoom';
    return 'dry';
  }
  const chosen = explicitSpace ?? patchSpace ?? 'dry';
  return chosen === 'sfxRoom' ? 'room' : chosen;
};

export class Chip {
  ctx: Ctx | null = null;
  private live: AudioContext | null = null;
  master: GainNode | null = null;
  musicBus: GainNode | null = null;
  sfxBus: GainNode | null = null;
  /** Low-priority biome ambience bus (-20 dB base, ducked -12 dB under Tier S/A SFX) ([AU-20]). */
  ambienceBus: GainNode | null = null;
  /** 4 priority sub-buses feeding sfxBus (S/A direct, B/C via sfxDuckGain) ([AU-04]). */
  sfxTiers: Partial<Record<SfxTier, GainNode>> = {};
  /** GainNode sitting in front of Tier B & C SFX for SFX-to-SFX ducking ([AU-04]). */
  sfxDuckGain: GainNode | null = null;
  private ambienceDuckGain: GainNode | null = null;
  private pulseWaves = new Map<Duty, PeriodicWave>();
  private waveVoice: PeriodicWave | null = null;
  private noiseLong: AudioBuffer | null = null;
  private noiseShort: AudioBuffer | null = null;
  private musicInputs: Partial<Record<Space, GainNode>> = {};
  private sfxInputs: Record<SfxTier, Partial<Record<Space, GainNode>>> = { S: {}, A: {}, B: {}, C: {} };
  private musicFilter: BiquadFilterNode | null = null;
  private duckGain: GainNode | null = null;
  private echoes: DelayNode[] = [];
  private monitorHp: BiquadFilterNode | null = null;
  private monitorLp: BiquadFilterNode | null = null;
  private monitorGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private analyserBuf: Float32Array<ArrayBuffer> | null = null;
  private _monitorMode: MonitorMode = 'flat';
  private voices: TrackedVoice[] = [];
  private tierStats: Record<SfxTier, { count: number; lastAt: number }> = {
    S: { count: 0, lastAt: -Infinity },
    A: { count: 0, lastAt: -Infinity },
    B: { count: 0, lastAt: -Infinity },
    C: { count: 0, lastAt: -Infinity },
  };
  /** Voices started since the context was wired (for tests and the sound studio) */
  voiceCount = 0;
  /** Lower-priority voices cleanly stolen under heavy load ([AU-04]) */
  stolenVoices = 0;
  /** Convolver impulse lengths wired on the current context (for diagnostics & tests) */
  reverbConfig: { hallSeconds: number; sfxRoomSeconds: number; sfxEchoEnabled: boolean } = {
    hallSeconds: REVERB_SECONDS.hall,
    sfxRoomSeconds: REVERB_SECONDS.sfxRoom,
    sfxEchoEnabled: false,
  };

  /** The real (speaker) context, if created. */
  get liveContext(): AudioContext | null {
    return this.live;
  }

  get available(): boolean {
    return getAudioContextCtor() !== null;
  }

  get monitorMode(): MonitorMode {
    return this._monitorMode;
  }

  /** Audition-only studio monitor mode ('flat' | 'phone' | 'lowVol') ([AU-16]). */
  setMonitorMode(mode: MonitorMode): void {
    this._monitorMode = mode;
    this.applyMonitorMode();
  }

  private applyMonitorMode(): void {
    if (!this.monitorHp || !this.monitorLp || !this.monitorGain) return;
    if (this._monitorMode === 'phone') {
      this.monitorHp.type = 'highpass';
      this.monitorHp.frequency.value = 300;
      this.monitorHp.Q.value = 0.707;
      this.monitorLp.type = 'lowpass';
      this.monitorLp.frequency.value = 5000;
      this.monitorLp.Q.value = 0.707;
      this.monitorGain.gain.value = 1;
      try {
        this.monitorGain.channelCount = 1;
        this.monitorGain.channelCountMode = 'explicit';
        this.monitorGain.channelInterpretation = 'speakers';
      } catch {
        /* mock or minimal AudioNode */
      }
    } else if (this._monitorMode === 'lowVol') {
      this.monitorHp.type = 'allpass';
      this.monitorLp.type = 'allpass';
      this.monitorGain.gain.value = Math.pow(10, -12 / 20);
      try {
        this.monitorGain.channelCount = 2;
        this.monitorGain.channelCountMode = 'max';
      } catch {
        /* ignore */
      }
    } else {
      this.monitorHp.type = 'allpass';
      this.monitorLp.type = 'allpass';
      this.monitorGain.gain.value = 1;
      try {
        this.monitorGain.channelCount = 2;
        this.monitorGain.channelCountMode = 'max';
      } catch {
        /* ignore */
      }
    }
  }

  /** Live studio diagnostics: polyphony, stolen voices, tier activity & real-time RMS/peak ([AU-16]). */
  getDiagnostics(): ChipDiagnostics {
    const now = this.now;
    let rms = 0;
    let peak = 0;
    if (this.analyser && this.analyserBuf && typeof this.analyser.getFloatTimeDomainData === 'function') {
      try {
        this.analyser.getFloatTimeDomainData(this.analyserBuf);
        let sum = 0;
        for (let i = 0; i < this.analyserBuf.length; i++) {
          const v = Math.abs(this.analyserBuf[i]);
          if (v > peak) peak = v;
          sum += v * v;
        }
        rms = Math.sqrt(sum / this.analyserBuf.length);
      } catch {
        /* ignore analyser read errors */
      }
    }
    return {
      activeVoices: this.activeVoices,
      maxVoices: MAX_VOICES,
      stolenVoices: this.stolenVoices,
      voiceCount: this.voiceCount,
      monitorMode: this._monitorMode,
      rms,
      peak,
      tiers: {
        S: { count: this.tierStats.S.count, recent: now - this.tierStats.S.lastAt < 0.75 },
        A: { count: this.tierStats.A.count, recent: now - this.tierStats.A.lastAt < 0.75 },
        B: { count: this.tierStats.B.count, recent: now - this.tierStats.B.lastAt < 0.75 },
        C: { count: this.tierStats.C.count, recent: now - this.tierStats.C.lastAt < 0.75 },
      },
    };
  }

  /** Create the context lazily (must happen after a user gesture on the web). */
  ensure(): boolean {
    // Offline rendering swaps `ctx` temporarily via `useContext` — never block or resume hardware audio.
    if (this.ctx && this.ctx !== this.live) return true;
    if (!getIsAppActive()) return false;
    if (this.ctx) {
      // iOS reports 'interrupted' after calls/app switches, not just 'suspended'
      if (this.live && this.live.state !== 'running' && this.live.state !== 'closed') {
        if (Platform.OS !== 'web') configureNativeSession(true);
        void Promise.resolve(this.live.resume()).catch(() => undefined);
      }
      return true;
    }
    const Ctor = getAudioContextCtor();
    if (!Ctor) return false;
    try {
      if (Platform.OS !== 'web') configureNativeSession(true);
      const ctx = new Ctor();
      this.live = ctx;
      this.wire(ctx);
      return true;
    } catch {
      this.ctx = null;
      return false;
    }
  }

  /** Suspend the hardware AudioContext so DSP nodes (convolvers/delays) consume zero CPU when idle or backgrounded. */
  suspend(): void {
    const state = this.live?.state as string | undefined;
    if (this.live && state !== 'suspended' && state !== 'closed') {
      void Promise.resolve(this.live.suspend()).catch(() => undefined);
    }
    if (Platform.OS !== 'web' && this.live) {
      configureNativeSession(false);
    }
  }

  /**
   * Point the chip at another context (e.g. an OfflineAudioContext to render
   * a preview to a buffer). Returns a function that restores the live one.
   */
  useContext(ctx: Ctx): () => void {
    const prev = {
      ctx: this.ctx,
      master: this.master,
      musicBus: this.musicBus,
      sfxBus: this.sfxBus,
      ambienceBus: this.ambienceBus,
      ambienceDuckGain: this.ambienceDuckGain,
      sfxTiers: this.sfxTiers,
      sfxDuckGain: this.sfxDuckGain,
      pulse: new Map(this.pulseWaves),
      wave: this.waveVoice,
      nl: this.noiseLong,
      ns: this.noiseShort,
      musicInputs: this.musicInputs,
      sfxInputs: this.sfxInputs,
      filter: this.musicFilter,
      duck: this.duckGain,
      echoes: this.echoes,
      monitorHp: this.monitorHp,
      monitorLp: this.monitorLp,
      monitorGain: this.monitorGain,
      analyser: this.analyser,
      analyserBuf: this.analyserBuf,
      voices: this.voices,
      voiceCount: this.voiceCount,
      stolenVoices: this.stolenVoices,
      tierStats: this.tierStats,
    };
    this.pulseWaves = new Map();
    this.wire(ctx);
    return () => {
      this.ctx = prev.ctx;
      this.master = prev.master;
      this.musicBus = prev.musicBus;
      this.sfxBus = prev.sfxBus;
      this.ambienceBus = prev.ambienceBus;
      this.ambienceDuckGain = prev.ambienceDuckGain;
      this.sfxTiers = prev.sfxTiers;
      this.sfxDuckGain = prev.sfxDuckGain;
      this.pulseWaves = prev.pulse;
      this.waveVoice = prev.wave;
      this.noiseLong = prev.nl;
      this.noiseShort = prev.ns;
      this.musicInputs = prev.musicInputs;
      this.sfxInputs = prev.sfxInputs;
      this.musicFilter = prev.filter;
      this.duckGain = prev.duck;
      this.echoes = prev.echoes;
      this.monitorHp = prev.monitorHp;
      this.monitorLp = prev.monitorLp;
      this.monitorGain = prev.monitorGain;
      this.analyser = prev.analyser;
      this.analyserBuf = prev.analyserBuf;
      this.voices = prev.voices;
      this.voiceCount = prev.voiceCount;
      this.stolenVoices = prev.stolenVoices;
      this.tierStats = prev.tierStats;
    };
  }

  private wire(ctx: Ctx) {
    this.ctx = ctx;
    this.voices = [];
    this.voiceCount = 0;
    this.stolenVoices = 0;
    this.tierStats = {
      S: { count: 0, lastAt: -Infinity },
      A: { count: 0, lastAt: -Infinity },
      B: { count: 0, lastAt: -Infinity },
      C: { count: 0, lastAt: -Infinity },
    };
    this.master = ctx.createGain();
    this.master.gain.value = MASTER_BUS.gain;
    // Phone-speaker-safe master bus ([AU-15]):
    // 70 Hz HPF → 4 kHz -3 dB presence shelf → 10.5 kHz LPF → 20:1 / 1 ms limiter → tanh -0.3 dBFS soft-clipper
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass';
    hpf.frequency.value = MASTER_BUS.hpfHz;
    hpf.Q.value = MASTER_BUS.hpfQ;
    const presence = ctx.createBiquadFilter();
    presence.type = 'peaking';
    presence.frequency.value = MASTER_BUS.presenceHz;
    presence.Q.value = MASTER_BUS.presenceQ;
    if (presence.gain) presence.gain.value = MASTER_BUS.presenceGainDb;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = MASTER_BUS.lpfHz;
    const postEq = this.master.connect(hpf).connect(presence).connect(lp);

    let postMaster: AudioNode = postEq;
    // Browser Web Audio provides DynamicsCompressorNode; native react-native-audio-api
    // uses a soft-clipping WaveShaperNode fallback when createDynamicsCompressor is absent.
    if (typeof ctx.createDynamicsCompressor === 'function') {
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = MASTER_BUS.limiterThreshold;
      limiter.knee.value = MASTER_BUS.limiterKnee;
      limiter.ratio.value = MASTER_BUS.limiterRatio;
      limiter.attack.value = MASTER_BUS.limiterAttack;
      limiter.release.value = MASTER_BUS.limiterRelease;
      const postLimiter = postEq.connect(limiter);
      if (typeof ctx.createWaveShaper === 'function') {
        const shaper = ctx.createWaveShaper();
        shaper.curve = SOFT_CLIP_CURVE;
        const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent ?? '');
        shaper.oversample = isMobile ? 'none' : '2x';
        postMaster = postLimiter.connect(shaper);
      } else {
        postMaster = postLimiter;
      }
    } else if (typeof ctx.createWaveShaper === 'function') {
      const shaper = ctx.createWaveShaper();
      shaper.curve = makeSoftClipCurve(256, 1.35);
      shaper.oversample = 'none';
      this.master.gain.value = 0.82;
      postMaster = postEq.connect(shaper);
    } else {
      this.master.gain.value = 0.78;
      postMaster = postEq;
    }

    // Studio monitor simulation stage (unity/allpass bypass in 'flat' mode) ([AU-16])
    this.monitorHp = ctx.createBiquadFilter();
    this.monitorLp = ctx.createBiquadFilter();
    this.monitorGain = ctx.createGain();
    this.applyMonitorMode();
    postMaster.connect(this.monitorHp).connect(this.monitorLp).connect(this.monitorGain).connect(ctx.destination);

    if (typeof ctx.createAnalyser === 'function') {
      try {
        const an = ctx.createAnalyser();
        an.fftSize = 1024;
        this.monitorGain.connect(an);
        this.analyser = an;
        this.analyserBuf = new Float32Array(an.fftSize);
      } catch {
        this.analyser = null;
        this.analyserBuf = null;
      }
    } else {
      this.analyser = null;
      this.analyserBuf = null;
    }

    // Music: bus → filter (muffles when paused or hurt) → duck (dips under big hits) → master
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.32;
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 18000;
    this.musicFilter.Q.value = 0.5;
    this.duckGain = ctx.createGain();
    this.musicBus.connect(this.musicFilter).connect(this.duckGain).connect(this.master);

    // 4-Tier SFX priority bus ([AU-04]): S (0 dB) & A (-1 dB) direct to sfxBus; B (-5 dB) & C (-8 dB) through sfxDuckGain
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = SFX_BUS_GAIN;
    this.sfxBus.connect(this.master);
    this.sfxDuckGain = ctx.createGain();
    this.sfxDuckGain.gain.value = 1;
    this.sfxDuckGain.connect(this.sfxBus);
    this.sfxTiers = {};
    for (const tier of SFX_TIERS) {
      const tg = ctx.createGain();
      tg.gain.value = SFX_TIER_GAINS[tier];
      tg.connect(tier === 'S' || tier === 'A' ? this.sfxBus : this.sfxDuckGain);
      this.sfxTiers[tier] = tg;
    }

    // Ambience bus (-20 dB base, ducked -12 dB under Tier S/A SFX) ([AU-20])
    this.ambienceBus = ctx.createGain();
    this.ambienceBus.gain.value = AMBIENCE_BUS_GAIN;
    this.ambienceDuckGain = ctx.createGain();
    this.ambienceDuckGain.gain.value = 1;
    this.ambienceBus.connect(this.ambienceDuckGain).connect(this.master);

    // Space split ([AU-10]):
    //   1. Single shared 1.7 s hall convolver (music pads + rare ceremonial explicit-hall SFX)
    //   2. Dedicated tight 0.35 s SFX room convolver (reverbOut = 0.45, faster HF damping)
    //   3. Tempo echo delay exclusively on musicBus (zero echo loop on SFX)
    const hallTail = this.impulse(ctx, REVERB_SECONDS.hall, false);
    const hallReverb = ctx.createConvolver();
    hallReverb.buffer = hallTail;
    const hallOut = ctx.createGain();
    hallOut.gain.value = 0.7;
    hallReverb.connect(hallOut).connect(this.master);

    const sfxRoomTail = this.impulse(ctx, REVERB_SECONDS.sfxRoom, true);
    const sfxRoomReverb = ctx.createConvolver();
    sfxRoomReverb.buffer = sfxRoomTail;
    const sfxRoomOut = ctx.createGain();
    sfxRoomOut.gain.value = 0.45;
    sfxRoomReverb.connect(sfxRoomOut).connect(this.sfxBus);

    const musicEcho = ctx.createDelay(1.5);
    musicEcho.delayTime.value = 0.28;
    const feedback = ctx.createGain();
    feedback.gain.value = 0.36;
    const echoTone = ctx.createBiquadFilter();
    echoTone.type = 'lowpass';
    echoTone.frequency.value = 3200;
    musicEcho.connect(echoTone).connect(feedback).connect(musicEcho);
    echoTone.connect(this.musicBus);
    this.echoes = [musicEcho];

    this.musicInputs = {};
    for (const space of MUSIC_SPACES) {
      if (space === 'dry') {
        this.musicInputs[space] = this.musicBus;
        continue;
      }
      const g = ctx.createGain();
      g.connect(this.musicBus);
      const [rev, ech] = MUSIC_SENDS[space];
      if (rev) {
        const s = ctx.createGain();
        // Scale by music bus nominal level (0.32) since shared hall returns to master
        s.gain.value = rev * 0.32;
        g.connect(s).connect(hallReverb);
      }
      if (ech) {
        const s = ctx.createGain();
        s.gain.value = ech;
        g.connect(s).connect(musicEcho);
      }
      this.musicInputs[space] = g;
    }
    this.musicInputs.sfxRoom = this.musicInputs.room;

    this.sfxInputs = { S: {}, A: {}, B: {}, C: {} };
    for (const tier of SFX_TIERS) {
      const tierOut = this.sfxTiers[tier]!;
      this.sfxInputs[tier].dry = tierOut;
      if (tier === 'C') {
        // Tier C UI cues stay strictly dry unless explicitly elevated
        this.sfxInputs[tier].sfxRoom = tierOut;
        this.sfxInputs[tier].room = tierOut;
        this.sfxInputs[tier].echo = tierOut;
        this.sfxInputs[tier].hall = tierOut;
        continue;
      }
      const roomIn = ctx.createGain();
      roomIn.connect(tierOut);
      const roomSend = ctx.createGain();
      roomSend.gain.value = 0.18 * SFX_TIER_GAINS[tier];
      roomIn.connect(roomSend).connect(sfxRoomReverb);
      this.sfxInputs[tier].sfxRoom = roomIn;
      this.sfxInputs[tier].room = roomIn;
      this.sfxInputs[tier].echo = roomIn;

      const hallIn = ctx.createGain();
      hallIn.connect(tierOut);
      const hallSend = ctx.createGain();
      hallSend.gain.value = 0.38 * SFX_BUS_GAIN * SFX_TIER_GAINS[tier];
      hallIn.connect(hallSend).connect(hallReverb);
      this.sfxInputs[tier].hall = hallIn;
    }

    this.reverbConfig = {
      hallSeconds: REVERB_SECONDS.hall,
      sfxRoomSeconds: REVERB_SECONDS.sfxRoom,
      sfxEchoEnabled: false,
    };

    this.buildWaves(ctx);
  }

  /** A reverb tail made of decaying noise: darker as it fades, like a room. */
  private impulse(ctx: Ctx, seconds: number, fastDamp = false): AudioBuffer {
    const len = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const channels = Math.min(2, ctx.destination.channelCount || 1);
    const buf = ctx.createBuffer(channels, len, ctx.sampleRate);
    let seed = fastDamp ? 0x51a7c3d : 0x2f6e2b1;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 0x80000000 - 1;
    };
    const fadeIn = fastDamp ? 140 : 400;
    const exp = fastDamp ? 3.5 : 2.6;
    for (let c = 0; c < channels; c++) {
      const data = buf.getChannelData(c);
      let smooth = 0;
      for (let i = 0; i < len; i++) {
        const k = i / len;
        const damp = fastDamp ? 0.45 + 0.5 * k : 0.25 + 0.7 * k; // high frequencies die first
        smooth = smooth * damp + rand() * (1 - damp);
        data[i] = smooth * Math.pow(1 - k, exp) * (i < fadeIn ? i / fadeIn : 1);
      }
    }
    return buf;
  }

  private input(bus: Bus | undefined, space: Space | undefined, tier?: SfxTier): GainNode | null {
    if (bus === 'sfx') {
      const t = tier ?? 'B';
      const s = space ?? 'dry';
      return this.sfxInputs[t][s] ?? this.sfxTiers[t] ?? this.sfxBus;
    }
    const s = space === 'sfxRoom' ? 'room' : space ?? 'dry';
    return this.musicInputs[s] ?? this.musicBus;
  }

  /**
   * Reserve a voice slot at `at..end` with priority voice-stealing ([AU-04]).
   * When active >= MAX_VOICES (56), steals the oldest lowest-priority voice
   * (3 ms ramp down + stop at +4 ms) instead of dropping Tier S/A cues.
   */
  private reserveVoice(
    at: number,
    end: number,
    priority: VoicePriority,
    soft?: boolean,
    sfxTier?: SfxTier
  ): TrackedVoice | null {
    // Prune voices finished before `at`
    if (this.voices.length > 16) this.voices = this.voices.filter(v => v.end > at);
    if (this.voices.length >= MAX_VOICES) {
      if (soft && priority === 0) return null;
      // Search for oldest lowest-priority steal candidate
      let victimIdx = -1;
      for (let i = 0; i < this.voices.length; i++) {
        const v = this.voices[i];
        const canSteal = priority >= 2 ? v.priority <= priority : v.priority < priority;
        if (!canSteal) continue;
        if (
          victimIdx === -1 ||
          v.priority < this.voices[victimIdx].priority ||
          (v.priority === this.voices[victimIdx].priority && v.at < this.voices[victimIdx].at)
        ) {
          victimIdx = i;
        }
      }
      if (victimIdx !== -1) {
        const victim = this.voices.splice(victimIdx, 1)[0];
        this.stealVoice(victim, at);
      } else if (this.voices.length >= MAX_VOICES * 2 || priority < 2) {
        return null;
      }
    }
    const entry: TrackedVoice = { at, end, priority, gain: null, sources: [] };
    this.voices.push(entry);
    this.voiceCount += 1;
    if (sfxTier) {
      this.tierStats[sfxTier].count += 1;
      this.tierStats[sfxTier].lastAt = at;
    }
    return entry;
  }

  private stealVoice(victim: TrackedVoice, at: number) {
    this.stolenVoices += 1;
    if (victim.gain) {
      try {
        const g = victim.gain.gain;
        g.cancelScheduledValues(at);
        g.setValueAtTime(Math.max(0.0001, g.value || 0.0001), at);
        g.linearRampToValueAtTime(0.0001, at + 0.003);
      } catch {
        /* ignore mock AudioParam limitations */
      }
    }
    for (const src of victim.sources) {
      try {
        src.stop(at + 0.004);
      } catch {
        /* already stopped */
      }
    }
  }

  /** Voices sounding or scheduled right now */
  get activeVoices(): number {
    const now = this.now;
    return this.voices.filter(v => v.end > now).length;
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
    g.setTargetAtTime(1, at + 0.07, Math.max(0.02, release / 3));
  }

  /**
   * Dip Tier B & C SFX (plus low-priority biome ambience -12 dB) under Tier S / A hits ([AU-04], [AU-20]).
   * Tier S passes depth ~0.65 (-9 dB on B/C); Tier A passes depth ~0.37 (-4 dB on B/C).
   */
  duckSfx(depth: number, at: number, release = 0.35) {
    if (!this.ctx) return;
    const clamped = Math.max(0, Math.min(0.85, depth));
    if (this.sfxDuckGain) {
      const g = this.sfxDuckGain.gain;
      g.cancelScheduledValues(at);
      g.setTargetAtTime(Math.max(0.15, 1 - clamped), at, 0.008);
      g.setTargetAtTime(1, at + 0.05, Math.max(0.02, release / 3));
    }
    if (this.ambienceDuckGain) {
      const ag = this.ambienceDuckGain.gain;
      ag.cancelScheduledValues(at);
      // Ambience sits at lowest priority: dips up to -12 dB (0.25) under Tier S/A cues
      ag.setTargetAtTime(Math.max(0.25, 1 - clamped * 1.15), at, 0.01);
      ag.setTargetAtTime(1, at + 0.08, Math.max(0.04, release / 2.5));
    }
  }

  /** Echo repeats on the beat (music bus only): call when the tempo changes. */
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
    tier?: SfxTier;
    priority?: VoicePriority;
    pan?: number;
    soft?: boolean;
    decay?: number; // 0..1, how much the envelope falls over the note
  }) {
    const ctx = this.ctx;
    if (!ctx || !opts.freq) return;
    const sfxTier = opts.bus === 'sfx' ? (opts.tier ?? 'B') : undefined;
    const space = resolveSpace(opts.bus, opts.space, undefined, sfxTier);
    const bus = this.input(opts.bus, space, sfxTier);
    if (!bus) return;
    const priority: VoicePriority = opts.priority ?? (sfxTier ? SFX_TIER_PRIORITY[sfxTier] : opts.soft ? 0 : 1);
    const slot = this.reserveVoice(opts.at, opts.at + opts.dur, priority, opts.soft, sfxTier);
    if (!slot) return;
    const osc = ctx.createOscillator();
    const wave = opts.voice === 'wave' ? this.waveVoice : this.pulseWaves.get(opts.duty ?? 0.5);
    if (wave) osc.setPeriodicWave(wave);
    const freq = Math.min(opts.freq, MAX_OSC_FREQ_HZ);
    osc.frequency.setValueAtTime(freq, opts.at);
    if (opts.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.min(MAX_OSC_FREQ_HZ, Math.max(20, opts.slideTo)), opts.at + opts.dur);
    const sources: AudioScheduledSourceNode[] = [osc];
    if (opts.vibrato) {
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 5.5;
      lfoGain.gain.value = freq * opts.vibrato;
      lfo.connect(lfoGain).connect(osc.frequency);
      lfo.start(opts.at + Math.min(0.12, opts.dur / 2));
      lfo.stop(opts.at + opts.dur + 0.05);
      sources.push(lfo);
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
    slot.gain = g;
    slot.sources = sources;
  }

  private out(ctx: Ctx, node: AudioNode, dest: AudioNode, pan?: number) {
    if (pan && typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(p).connect(dest);
    } else node.connect(dest);
  }

  /** Play one note of an instrument patch. */
  play(
    p: Patch,
    o: {
      freq: number;
      at: number;
      dur: number;
      vol?: number;
      pan?: number;
      bus?: Bus;
      space?: Space;
      tier?: SfxTier;
      priority?: VoicePriority;
      slideTo?: number;
      soft?: boolean;
    }
  ) {
    const ctx = this.ctx;
    if (!ctx || !o.freq || !isFinite(o.freq)) return;
    const sfxTier = o.bus === 'sfx' ? (o.tier ?? 'B') : undefined;
    const space = resolveSpace(o.bus, o.space, p.space, sfxTier);
    const dest = this.input(o.bus, space, sfxTier);
    if (!dest) return;
    const freq = Math.min(o.freq, MAX_OSC_FREQ_HZ);
    const plucked = p.s === 0;
    // [AU-09]: honor o.dur for plucked (s === 0) notes so short taps/coins end crisply without smearing chains
    const decay = plucked ? (o.dur > 0 ? Math.min(p.d, o.dur) : p.d) : p.d;
    const hold = plucked ? decay : Math.max(p.a, o.dur);
    const releaseAt = o.at + hold;
    const end = plucked ? o.at + p.a + decay * 1.15 + 0.025 : releaseAt + p.r + 0.03;
    const priority: VoicePriority = o.priority ?? (sfxTier ? SFX_TIER_PRIORITY[sfxTier] : o.soft ? 0 : 1);
    const slot = this.reserveVoice(o.at, end, priority, o.soft, sfxTier);
    if (!slot) return;
    const peak = Math.max(0.0001, (o.vol ?? 1) * p.vol);

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, o.at);
    g.gain.linearRampToValueAtTime(peak, o.at + p.a);
    g.gain.setTargetAtTime(plucked ? 0.0001 : peak * p.s, o.at + p.a, Math.max(0.005, decay / 3.5));
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
      if (o.slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, (o.slideTo * f) / freq), o.at + Math.max(0.015, o.dur));
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
    const maxPartialHz = Math.min(9000, ctx.sampleRate * 0.42);
    for (const [ratio, gain] of p.partials ?? []) if (freq * ratio < maxPartialHz) add(freq * ratio, gain, 0, true);
    if (p.fm) {
      // Nyquist FM safety guard ([AU-14]): taper modulation index cleanly as modFreq approaches 0.35*sr,
      // and skip creating the FM modulator entirely whenever modFreq >= 0.42*sr to eliminate aliasing.
      const modFreq = freq * p.fm.ratio;
      const nyqHard = ctx.sampleRate * 0.42;
      if (modFreq < nyqHard) {
        const nyqStart = ctx.sampleRate * 0.2;
        const nyqKnee = ctx.sampleRate * 0.35;
        let fmScale = 1;
        if (modFreq >= nyqKnee) {
          fmScale = Math.max(0, ((nyqHard - modFreq) / Math.max(1, nyqHard - nyqKnee)) * 0.15);
        } else if (modFreq > nyqStart) {
          fmScale = 1 - 0.85 * ((modFreq - nyqStart) / Math.max(1, nyqKnee - nyqStart));
        }
        const effectiveIndex = p.fm.index * fmScale;
        if (effectiveIndex > 0.001) {
          const mod = ctx.createOscillator();
          mod.type = 'sine';
          mod.frequency.setValueAtTime(modFreq, o.at);
          const depth = ctx.createGain();
          depth.gain.setValueAtTime(freq * effectiveIndex, o.at);
          depth.gain.setTargetAtTime(freq * effectiveIndex * 0.08, o.at, Math.max(0.01, p.fm.decay / 3));
          mod.connect(depth).connect(carrier.frequency);
          sources.push(mod);
        }
      }
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
        f.frequency.setTargetAtTime(base, o.at, Math.max(0.01, (p.lp.decay ?? decay) / 3));
      } else f.frequency.value = base;
      pre.connect(f).connect(g);
    } else pre.connect(g);
    this.out(ctx, g, dest, o.pan);
    for (const src of sources) {
      src.start(o.at);
      src.stop(end);
    }
    slot.gain = g;
    slot.sources = sources;
  }

  noise(opts: {
    at: number;
    dur: number;
    vol?: number;
    short?: boolean;
    bus?: Bus;
    space?: Space;
    tier?: SfxTier;
    priority?: VoicePriority;
    pan?: number;
    filter?: number;
    sweepTo?: number;
    /** bandpass (default), or everything above / below `filter` */
    type?: 'bandpass' | 'highpass' | 'lowpass';
    /** Fade in over this many seconds (risers) instead of starting at full */
    attack?: number;
    soft?: boolean;
  }) {
    const ctx = this.ctx;
    const buf = opts.short ? this.noiseShort : this.noiseLong;
    const sfxTier = opts.bus === 'sfx' ? (opts.tier ?? 'B') : undefined;
    const space = resolveSpace(opts.bus, opts.space, undefined, sfxTier);
    const bus = this.input(opts.bus, space, sfxTier);
    if (!ctx || !buf || !bus) return;
    const priority: VoicePriority = opts.priority ?? (sfxTier ? SFX_TIER_PRIORITY[sfxTier] : opts.soft ? 0 : 1);
    const slot = this.reserveVoice(opts.at, opts.at + opts.dur, priority, opts.soft, sfxTier);
    if (!slot) return;
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
    slot.gain = g;
    slot.sources = [src];
  }
}

export const chip = new Chip();
