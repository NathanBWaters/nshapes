/**
 * Public audio API: music arrangements + synthesized SFX.
 *
 *   music.play('woods')   — switches arrangement on the next bar line
 *   music.stop()
 *   sfx('coin')
 *
 * Everything is synthesized by the chip (src/audio/chip.ts) — no audio files.
 */
import { chip, noteToFreq } from './chip';
import { ARRANGEMENTS, CHORDS, JINGLES, THEME, THEME_B, type Arrangement } from './songs';

let musicEnabled = true;
let sfxEnabled = true;

export const audioSupported = (): boolean => chip.available;

export const setMusicEnabled = (on: boolean) => {
  musicEnabled = on;
  if (!on) music.stop();
  else if (music.current) music.play(music.current);
};
export const isMusicEnabled = () => musicEnabled;
export const setSfxEnabled = (on: boolean) => {
  sfxEnabled = on;
};
export const isSfxEnabled = () => sfxEnabled;

/** Call from any user gesture to unlock audio on the web. */
export const unlockAudio = () => {
  chip.ensure();
};

// ─── Music sequencer ───────────────────────────────────────────────────────

const SEMITONES: Record<string, number> = { R: 0, '3': 4, '5': 7, '7': 10, '8': 12 };
const ROOT_SEMI: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const midiToFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

class Sequencer {
  current: string | null = null;
  private arr: Arrangement | null = null;
  private pending: Arrangement | null = null;
  private step = 0;
  private nextTime = 0;
  private timer: ReturnType<typeof setInterval> | null = null;

  play(name: string) {
    const arr = ARRANGEMENTS[name] ?? ARRANGEMENTS.map;
    this.current = name;
    if (!musicEnabled) return;
    if (!chip.ensure()) return;
    if (this.timer && this.arr) {
      if (this.arr !== arr) this.pending = arr; // swap on the next bar line
      return;
    }
    this.arr = arr;
    this.pending = null;
    this.nextTime = chip.now + 0.08;
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.arr = null;
    this.pending = null;
  }

  private stepDur(a: Arrangement) {
    return 60 / a.bpm / 4;
  }

  private schedule() {
    if (!chip.ctx || !this.arr) return;
    // If the tab was backgrounded, don't try to catch up a pile of notes
    if (this.nextTime < chip.now - 0.2) this.nextTime = chip.now + 0.05;
    while (this.nextTime < chip.now + 0.12) {
      const s16 = this.step % 16;
      if (s16 === 0 && this.pending) {
        this.arr = this.pending;
        this.pending = null;
      }
      this.playStep(this.arr, this.step, this.nextTime);
      this.nextTime += this.stepDur(this.arr);
      this.step += 1;
    }
  }

  /** Schedule a whole passage synchronously (offline rendering / tests). */
  renderPassage(plan: Array<{ arrangement: string; bars: number }>, t0: number): number {
    let t = t0;
    let step = 0;
    for (const part of plan) {
      const a = ARRANGEMENTS[part.arrangement];
      for (let i = 0; i < part.bars * 16; i++) {
        this.playStep(a, step, t);
        t += this.stepDur(a);
        step += 1;
      }
    }
    return t;
  }

  private playStep(a: Arrangement, step: number, t: number) {
    const sd = this.stepDur(a);
    const barIdx = Math.floor(step / 16) % 16;
    const s16 = step % 16;
    const section = a.useB && barIdx >= 8 ? THEME_B : THEME;
    const melodyIdx = (barIdx % 8) * 16 + s16;
    const chord = CHORDS[barIdx % 8];

    // Lead
    const tok = section[melodyIdx];
    if (tok && tok !== '-' && tok !== '.') {
      let len = 1;
      while (section[melodyIdx + len] === '-' && (s16 + len) < 16) len++;
      chip.tone({ voice: 'pulse1', freq: noteToFreq(tok, a.leadOctave), at: t, dur: sd * len * 0.95, vol: a.leadVol, duty: a.leadDuty, vibrato: len > 2 ? a.leadVibrato : 0 });
    }

    // Bass (wave voice)
    const b = a.bass[s16];
    if (b && b !== '-' && b !== '.') {
      let len = 1;
      while (a.bass[s16 + len] === '-') len++;
      const third = chord.minor ? 3 : 4;
      const semi = b === '3' ? third : SEMITONES[b] ?? 0;
      const midi = (a.bassOctave + 1) * 12 + ROOT_SEMI[chord.root] + semi;
      chip.tone({ voice: 'wave', freq: midiToFreq(midi), at: t, dur: sd * len * 0.9, vol: 0.55, decay: 0.5 });
    }

    // Arpeggio
    if (a.arp && s16 % 2 === 0) {
      const third = chord.minor ? 3 : 4;
      const tones = [0, third, 7, 12];
      const midi = 5 * 12 + ROOT_SEMI[chord.root] + tones[(s16 / 2) % 4];
      chip.tone({ voice: 'pulse2', freq: midiToFreq(midi), at: t, dur: sd * 0.8, vol: 0.18, duty: a.arpDuty, decay: 0.8 });
    }

    // Drums
    const d = a.drums[s16];
    if (d === 'k') chip.tone({ voice: 'pulse2', freq: 150, slideTo: 45, at: t, dur: 0.09, vol: 0.6, duty: 0.5, decay: 0.9 });
    if (d === 's') chip.noise({ at: t, dur: 0.12, vol: 0.5, filter: 2200 });
    if (d === 'h') chip.noise({ at: t, dur: 0.035, vol: 0.25, short: true, filter: 8000 });
    if (d === 'o') chip.noise({ at: t, dur: 0.15, vol: 0.25, short: true, filter: 7000 });
  }
}

export const music = new Sequencer();

const playJingle = (name: keyof typeof JINGLES, bus: 'music' | 'sfx' = 'sfx') => {
  const j = JINGLES[name];
  const sd = 60 / j.bpm / 2;
  let t = (nowOverride ?? chip.now) + 0.02;
  for (const [n, steps] of j.notes) {
    if (n !== '.') chip.tone({ voice: 'pulse1', freq: noteToFreq(n), at: t, dur: sd * steps * 0.95, vol: 0.55, duty: j.duty, bus });
    if (n !== '.') chip.tone({ voice: 'pulse2', freq: noteToFreq(n, -12), at: t, dur: sd * steps * 0.95, vol: 0.25, duty: 0.5, bus });
    t += sd * steps;
  }
};

// ─── SFX ───────────────────────────────────────────────────────────────────

export type SfxName =
  | 'click' | 'deselect' | 'match' | 'invalid' | 'grace' | 'heart' | 'hint' | 'graceGain' | 'coin'
  | 'explosion' | 'laser' | 'ricochet' | 'deal' | 'confirm' | 'back' | 'gameOver'
  | 'hit' | 'rainbow' | 'hurt' | 'levelup' | 'star1' | 'star2' | 'star3' | 'unlock'
  | 'foeDefeated' | 'wave' | 'tick' | 'victory' | 'whoosh' | 'freeze';

let lastPlayed: Partial<Record<SfxName, number>> = {};

export const sfx = (name: SfxName) => {
  if (!sfxEnabled) return;
  if (!chip.ensure()) return;
  const now = nowOverride ?? chip.now;
  // de-dupe very rapid repeats (e.g. 3 coin events from one match)
  const last = lastPlayed[name] ?? -1;
  if (now - last < 0.035) return;
  lastPlayed[name] = now;
  const t = now + 0.005;
  const T = (freq: number, at: number, dur: number, o: Partial<Parameters<typeof chip.tone>[0]> = {}) =>
    chip.tone({ voice: 'pulse1', freq, at, dur, vol: 0.5, duty: 0.25, bus: 'sfx', ...o });

  switch (name) {
    case 'click': T(1320, t, 0.03, { duty: 0.125, vol: 0.35 }); break;
    case 'deselect': T(880, t, 0.03, { duty: 0.125, vol: 0.3 }); break;
    case 'deal': chip.noise({ at: t, dur: 0.05, vol: 0.18, short: false, filter: 5000, bus: 'sfx' }); break;
    case 'match': ['C6', 'E6', 'G6'].forEach((n, i) => T(noteToFreq(n), t + i * 0.045, 0.07, { duty: 0.5 })); break;
    case 'invalid': T(220, t, 0.12, { duty: 0.5, slideTo: 140 }); T(233, t + 0.1, 0.16, { duty: 0.5, slideTo: 110 }); break;
    case 'grace': T(noteToFreq('E6'), t, 0.06, { duty: 0.5 }); T(noteToFreq('B5'), t + 0.06, 0.12, { duty: 0.5 }); break;
    case 'heart': ['C5', 'G5', 'C6'].forEach((n, i) => T(noteToFreq(n), t + i * 0.06, 0.1, { duty: 0.5, voice: 'pulse2' })); break;
    case 'hint': T(noteToFreq('A5'), t, 0.06, { duty: 0.125 }); T(noteToFreq('E6'), t + 0.07, 0.12, { duty: 0.125, vibrato: 0.01 }); break;
    case 'graceGain': T(noteToFreq('G5'), t, 0.05); T(noteToFreq('D6'), t + 0.05, 0.1); break;
    case 'coin': T(noteToFreq('B5'), t, 0.05, { duty: 0.5, vol: 0.35 }); T(noteToFreq('E6'), t + 0.05, 0.16, { duty: 0.5, vol: 0.35 }); break;
    case 'explosion': chip.noise({ at: t, dur: 0.45, vol: 0.8, filter: 1800, sweepTo: 120, bus: 'sfx' }); break;
    case 'laser': T(2200, t, 0.18, { duty: 0.125, slideTo: 300 }); break;
    case 'ricochet': [1800, 2400, 1600].forEach((f, i) => T(f, t + i * 0.05, 0.04, { duty: 0.125, vol: 0.3 })); break;
    case 'confirm': T(noteToFreq('C6'), t, 0.05, { duty: 0.5 }); T(noteToFreq('G6'), t + 0.05, 0.09, { duty: 0.5 }); break;
    case 'back': T(noteToFreq('G5'), t, 0.05, { duty: 0.5 }); T(noteToFreq('C5'), t + 0.05, 0.08, { duty: 0.5 }); break;
    case 'whoosh': chip.noise({ at: t, dur: 0.25, vol: 0.3, filter: 600, sweepTo: 5000, bus: 'sfx' }); break;
    case 'hit':
      chip.noise({ at: t, dur: 0.12, vol: 0.55, filter: 1200, sweepTo: 300, bus: 'sfx' });
      T(330, t, 0.1, { duty: 0.5, slideTo: 110, voice: 'pulse2', vol: 0.4 });
      break;
    case 'rainbow':
      ['C6', 'D6', 'E6', 'G6', 'A6', 'C7'].forEach((n, i) => T(noteToFreq(n), t + i * 0.035, 0.08, { duty: 0.125, vol: 0.4 }));
      chip.noise({ at: t, dur: 0.2, vol: 0.4, filter: 1500, sweepTo: 200, bus: 'sfx' });
      break;
    case 'hurt': T(180, t, 0.25, { duty: 0.5, slideTo: 60, vol: 0.6 }); chip.noise({ at: t, dur: 0.2, vol: 0.4, filter: 500, bus: 'sfx' }); break;
    case 'levelup': playJingle('levelup'); break;
    case 'star1': T(noteToFreq('E6'), t, 0.18, { duty: 0.25, vibrato: 0.01 }); break;
    case 'star2': T(noteToFreq('G6'), t, 0.2, { duty: 0.25, vibrato: 0.01 }); break;
    case 'star3': T(noteToFreq('C7'), t, 0.3, { duty: 0.25, vibrato: 0.012 }); T(noteToFreq('C6'), t, 0.3, { duty: 0.5, voice: 'pulse2', vol: 0.3 }); break;
    case 'unlock': playJingle('unlock'); break;
    case 'victory': playJingle('victory'); break;
    case 'gameOver': playJingle('defeat'); break;
    case 'foeDefeated':
      chip.noise({ at: t, dur: 0.6, vol: 0.7, filter: 2500, sweepTo: 80, bus: 'sfx' });
      ['G5', 'E5', 'C5', 'G4'].forEach((n, i) => T(noteToFreq(n), t + 0.05 + i * 0.07, 0.1, { duty: 0.5, voice: 'pulse2', vol: 0.35 }));
      break;
    case 'wave': ['C5', 'C5', 'G5'].forEach((n, i) => T(noteToFreq(n), t + i * 0.1, 0.08, { duty: 0.125 })); break;
    case 'tick': T(1000, t, 0.02, { duty: 0.5, vol: 0.25 }); break;
    case 'freeze':
      ['B6', 'G6', 'E6', 'B5', 'G5'].forEach((n, i) => T(noteToFreq(n), t + i * 0.05, 0.25, { duty: 0.125, vol: 0.3, vibrato: 0.02 }));
      chip.noise({ at: t, dur: 0.5, vol: 0.25, short: true, filter: 9000, sweepTo: 3000, bus: 'sfx' });
      break;
  }
};

// For tests
export const __resetSfxDedupe = () => {
  lastPlayed = {};
};

/**
 * Render audio offline (no speakers needed) — used to verify the synth and to
 * export previews. `plan` plays arrangements back-to-back on bar lines, exactly
 * like a live transition; `sfxReel` plays effects one after another afterwards.
 */
export const renderOffline = async (opts: {
  plan?: Array<{ arrangement: string; bars: number }>;
  sfxReel?: SfxName[];
  sampleRate?: number;
}): Promise<AudioBuffer | null> => {
  if (typeof window === 'undefined') return null;
  const W = window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext };
  if (!W.OfflineAudioContext) return null;
  const sr = opts.sampleRate ?? 22050;
  // estimate length
  let seconds = 0.5;
  for (const p of opts.plan ?? []) seconds += (p.bars * 16 * 60) / ARRANGEMENTS[p.arrangement].bpm / 4;
  seconds += (opts.sfxReel?.length ?? 0) * 0.7 + 0.5;
  const ctx = new W.OfflineAudioContext(1, Math.ceil(seconds * sr), sr);
  const restore = chip.useContext(ctx);
  const wasOn = sfxEnabled;
  sfxEnabled = true;
  try {
    let t = 0.05;
    if (opts.plan?.length) t = music.renderPassage(opts.plan, t) + 0.3;
    for (const name of opts.sfxReel ?? []) {
      withNow(t, () => sfx(name));
      t += 0.7;
    }
    return await (ctx as OfflineAudioContext).startRendering();
  } finally {
    sfxEnabled = wasOn;
    restore();
  }
};

let nowOverride: number | null = null;
const withNow = (t: number, fn: () => void) => {
  nowOverride = t;
  lastPlayed = {};
  try { fn(); } finally { nowOverride = null; }
};

// Dev handle for poking the synth from the browser console: __nshapesAudio.sfx('rainbow')
if (typeof __DEV__ !== 'undefined' && __DEV__ && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__nshapesAudio = { chip, music, sfx, renderOffline };
}
