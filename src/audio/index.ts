/**
 * Public audio API: music arrangements + synthesized SFX.
 *
 *   music.play('woods')   — switches arrangement on the next bar line
 *   music.stop()
 *   sfx('coin')
 *
 * Everything is synthesized by the chip (src/audio/chip.ts) — no audio files.
 */
import { band, CUE_NAMES } from './band';
import { chip, noteToFreq } from './chip';
import type { FightMood } from './director';
import { note, type InstrumentId } from './instruments';
import { audioFlags } from './settings';
import { ARRANGEMENTS, JINGLES } from './songs';
import { RECIPE_IDS } from './themes';
import { WEAPON_VOICES } from './voices';

export const audioSupported = (): boolean => chip.available;

export const setMusicEnabled = (on: boolean) => {
  audioFlags.music = on;
  if (!on) band.halt();
  else if (band.current) band.play(band.current);
};
let sfxSetting = true;
let sfxOverride: boolean | null = null;
/** The player's sound-effects setting (Options menu). */
export const setSfxEnabled = (on: boolean) => {
  sfxSetting = on;
  audioFlags.sfx = sfxOverride ?? sfxSetting;
};
/**
 * A screen with its own sound switch (Adventure's map button) decides for as
 * long as it is open; `null` hands the decision back to the player's setting.
 */
export const setSfxOverride = (on: boolean | null) => {
  sfxOverride = on;
  audioFlags.sfx = sfxOverride ?? sfxSetting;
};

/**
 * Unlock audio inside a real user gesture. iOS (Safari, Chrome, and installed
 * PWAs all use WebKit) only lets audio start from "activation" events such as
 * touchend or click, not touchstart. It also wants a sound actually played
 * inside that gesture.
 */
export const unlockAudio = () => {
  if (!chip.ensure()) return;
  const ctx = chip.liveContext;
  if (!ctx) return;
  // Web Audio is "ambient" on iOS by default, so the ring/silent switch mutes
  // it. Mark this as playback audio (Safari 16.4+). Players can still mute
  // with the in-game toggles.
  const nav = navigator as unknown as { audioSession?: { type: string } };
  if (nav.audioSession && nav.audioSession.type !== 'playback') {
    try { nav.audioSession.type = 'playback'; } catch { /* unsupported */ }
  }
  if (ctx.state !== 'running') void ctx.resume().catch(() => undefined);
  try {
    // One silent sample — the classic iOS "unlock" nudge
    const b = ctx.createBuffer(1, 1, ctx.sampleRate);
    const src = ctx.createBufferSource();
    src.buffer = b;
    src.connect(ctx.destination);
    src.start(0);
  } catch { /* ignore */ }
};

const installGestureUnlock = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!chip.available) return;
  const events = ['touchend', 'pointerup', 'click', 'keydown'];
  const handler = () => {
    unlockAudio();
    if (chip.liveContext?.state === 'running' && band.current && audioFlags.music) band.play(band.current);
  };
  // Keep listening: iOS can interrupt the context again later (calls, Siri, app switch)
  events.forEach(e => document.addEventListener(e, handler, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && chip.liveContext && chip.liveContext.state !== 'running') {
      void chip.liveContext.resume().catch(() => undefined);
    }
  });
};

// ─── Music ─────────────────────────────────────────────────────────────────

/** The band plays the music (src/audio/band.ts). `music.play('woods')` switches arrangement on the next bar line. */
export const music = band;
export { band };
export type { CueName } from './band';
export type { FightMood, Mix } from './director';

const playJingle = (name: keyof typeof JINGLES, bus: 'music' | 'sfx' = 'sfx') => {
  const j = JINGLES[name];
  const sd = 60 / j.bpm / 2;
  let t = (nowOverride ?? chip.now) + 0.02;
  for (const [n, steps] of j.notes) {
    if (n !== '.') {
      note('brass', noteToFreq(n, -12), t, sd * steps * 0.95, { vol: 1, bus });
      note(name === 'defeat' ? 'vibes' : 'bell', noteToFreq(n), t, sd * steps * 0.95 + 0.3, { vol: 0.8, bus });
    }
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
  if (!audioFlags.sfx) return;
  if (!chip.ensure()) return;
  const now = nowOverride ?? chip.now;
  // de-dupe very rapid repeats (e.g. 3 coin events from one match)
  const last = lastPlayed[name] ?? -1;
  if (now - last < 0.035) return;
  lastPlayed[name] = now;
  const t = now + 0.005;
  const T = (freq: number, at: number, dur: number, o: Partial<Parameters<typeof chip.tone>[0]> = {}) =>
    chip.tone({ voice: 'pulse1', freq, at, dur, vol: 0.5, duty: 0.25, bus: 'sfx', ...o });

  const I = (inst: InstrumentId, n: string, dt: number, dur: number, vol: number) => note(inst, noteToFreq(n), t + dt, dur, { vol, bus: 'sfx' });

  switch (name) {
    // Menus are played on the same instruments as the fights, in the map's key (C)
    case 'click': I('kalimba', 'G5', 0, 0.12, 0.6); break;
    case 'deselect': I('kalimba', 'E5', 0, 0.12, 0.5); break;
    case 'deal': chip.noise({ at: t, dur: 0.05, vol: 0.18, short: false, filter: 5000, bus: 'sfx' }); break;
    case 'match': ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => I('harp', n, i * 0.04, 0.5, 0.8)); I('bell', 'C6', 0, 0.6, 0.8); break;
    case 'invalid': T(220, t, 0.12, { duty: 0.5, slideTo: 140 }); T(233, t + 0.1, 0.16, { duty: 0.5, slideTo: 110 }); break;
    case 'grace': T(noteToFreq('E6'), t, 0.06, { duty: 0.5 }); T(noteToFreq('B5'), t + 0.06, 0.12, { duty: 0.5 }); break;
    case 'heart': ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => I('harp', n, i * 0.05, 0.6, 0.9)); break;
    case 'hint': I('celesta', 'G5', 0, 0.3, 0.9); I('celesta', 'C6', 0.07, 0.5, 0.9); break;
    case 'graceGain': T(noteToFreq('G5'), t, 0.05); T(noteToFreq('D6'), t + 0.05, 0.1); break;
    case 'coin': I('glock', 'G6', 0, 0.2, 0.9); I('glock', 'C7', 0.06, 0.35, 0.9); break;
    case 'explosion': chip.noise({ at: t, dur: 0.45, vol: 0.8, filter: 1800, sweepTo: 120, bus: 'sfx' }); break;
    case 'laser': T(2200, t, 0.18, { duty: 0.125, slideTo: 300 }); break;
    case 'ricochet': [1800, 2400, 1600].forEach((f, i) => T(f, t + i * 0.05, 0.04, { duty: 0.125, vol: 0.3 })); break;
    case 'confirm': I('kalimba', 'C5', 0, 0.15, 0.8); I('kalimba', 'G5', 0.06, 0.2, 0.8); break;
    case 'back': I('kalimba', 'G5', 0, 0.15, 0.7); I('kalimba', 'C5', 0.06, 0.2, 0.7); break;
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
    case 'star1': I('bell', 'E6', 0, 0.8, 1); break;
    case 'star2': I('bell', 'G6', 0, 0.8, 1); break;
    case 'star3': I('bell', 'C7', 0, 1, 1); I('bell', 'C6', 0, 1, 0.8); break;
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

/**
 * Render audio offline (no speakers needed) — used to verify the synth and to
 * export previews. `plan` plays arrangements back-to-back on bar lines, exactly
 * like a live transition; `script` plays a scripted fight (mood changes and
 * cues at given seconds); `sfxReel` plays effects one after another afterwards.
 */
export const renderOffline = async (opts: {
  plan?: { arrangement: string; bars: number }[];
  script?: { seconds: number; events: { at: number; mood?: FightMood; run?: (b: typeof band) => void }[] };
  sfxReel?: SfxName[];
  sampleRate?: number;
  channels?: number;
}): Promise<AudioBuffer | null> => {
  if (typeof window === 'undefined') return null;
  const W = window as unknown as { OfflineAudioContext?: typeof OfflineAudioContext };
  if (!W.OfflineAudioContext) return null;
  const sr = opts.sampleRate ?? 22050;
  // estimate length
  let seconds = 0.5;
  for (const p of opts.plan ?? []) seconds += (p.bars * 16 * 60) / ARRANGEMENTS[p.arrangement].bpm / 4;
  seconds += (opts.script?.seconds ?? 0) + (opts.script ? 2.5 : 0);
  seconds += (opts.sfxReel?.length ?? 0) * 0.7 + 0.5;
  const ctx = new W.OfflineAudioContext(opts.channels ?? 1, Math.ceil(seconds * sr), sr);
  const restore = chip.useContext(ctx);
  const was = { ...audioFlags };
  audioFlags.sfx = true;
  audioFlags.music = true;
  try {
    let t = 0.05;
    if (opts.plan?.length) t = band.renderPassage(opts.plan, t) + 0.3;
    if (opts.script) t = band.renderScript(opts.script.seconds, opts.script.events, t) + 2.5;
    for (const name of opts.sfxReel ?? []) {
      withNow(t, () => sfx(name));
      t += 0.7;
    }
    return await (ctx as OfflineAudioContext).startRendering();
  } finally {
    Object.assign(audioFlags, was);
    restore();
  }
};

let nowOverride: number | null = null;
const withNow = (t: number, fn: () => void) => {
  nowOverride = t;
  lastPlayed = {};
  try { fn(); } finally { nowOverride = null; }
};

installGestureUnlock();

// Dev handle for poking the synth from the browser console: __nshapesAudio.sfx('rainbow')
if (typeof __DEV__ !== 'undefined' && __DEV__ && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__nshapesAudio = { chip, music, band, sfx, renderOffline, setSfxEnabled, setSfxOverride, setMusicEnabled, audioFlags, CUE_NAMES, WEAPON_VOICES, RECIPE_IDS };
}
