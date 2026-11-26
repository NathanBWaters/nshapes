/**
 * Public audio API: music arrangements, biome ambience + synthesized SFX.
 *
 *   music.play('woods')   — switches arrangement on the next bar line
 *   music.stop()
 *   sfx('coin')
 *
 * Everything is synthesized by the chip (src/audio/chip.ts) — no audio files.
 */
import { getIsAppActive, subscribeAppActive } from '@/utils/appLifecycle';
import { registerAudioInspector } from '@/utils/perfWatchdog';
import { ambience } from './ambience';
import { band, CUE_NAMES } from './band';
import { chip, noteToFreq, type SfxTier, type Space } from './chip';
import type { FightMood } from './director';
import { FIGHTER_VOICE_IDS, FIGHTER_VOICE_META, type FighterCallKind, type FighterVoiceId } from './fighterVoices';
import { note, type InstrumentId } from './instruments';
import { audioFlags } from './settings';
import { ARRANGEMENTS } from './songs';
import { RECIPE_IDS } from './themes';
import { WEAPON_VOICES } from './voices';

export const audioSupported = (): boolean => chip.available;

const setAudioSessionType = (type: 'playback' | 'ambient') => {
  if (typeof navigator === 'undefined') return;
  const nav = navigator as unknown as { audioSession?: { type: string } };
  if (nav.audioSession && nav.audioSession.type !== type) {
    try { nav.audioSession.type = type; } catch { /* unsupported */ }
  }
};

const suspendIfSilent = () => {
  if (!audioFlags.music && !audioFlags.sfx) {
    band.halt();
    ambience.sync();
    chip.suspend();
    setAudioSessionType('ambient');
  } else {
    ambience.sync();
  }
};

export const setMusicEnabled = (on: boolean) => {
  audioFlags.music = on;
  if (!on) {
    band.halt();
    suspendIfSilent();
  } else if (band.current) {
    band.play(band.current);
  } else {
    ambience.sync();
  }
};
let sfxSetting = true;
let sfxOverride: boolean | null = null;
/** The player's sound-effects setting (Options menu). */
export const setSfxEnabled = (on: boolean) => {
  sfxSetting = on;
  audioFlags.sfx = sfxOverride ?? sfxSetting;
  suspendIfSilent();
};
/**
 * A screen with its own sound switch (Adventure's map button) decides for as
 * long as it is open; `null` hands the decision back to the player's setting.
 */
export const setSfxOverride = (on: boolean | null) => {
  sfxOverride = on;
  audioFlags.sfx = sfxOverride ?? sfxSetting;
  suspendIfSilent();
};

/**
 * Unlock audio inside a real user gesture. iOS (Safari, Chrome, and installed
 * PWAs all use WebKit) only lets audio start from "activation" events such as
 * touchend or click, not touchstart. It also wants a sound actually played
 * inside that gesture.
 */
export const unlockAudio = () => {
  if (!getIsAppActive()) return;
  if (!audioFlags.music && !audioFlags.sfx) return;
  if (!chip.ensure()) return;
  const ctx = chip.liveContext;
  if (!ctx) return;
  // Web Audio is "ambient" on iOS by default, so the ring/silent switch mutes
  // it. Mark this as playback audio while actively playing (Safari 16.4+).
  setAudioSessionType('playback');
  if (ctx.state !== 'running') {
    void Promise.resolve(ctx.resume())
      .then(() => {
        if (getIsAppActive() && ctx.state === 'running') {
          if (band.current && audioFlags.music) band.play(band.current);
          else ambience.sync();
        }
      })
      .catch(() => undefined);
  } else {
    ambience.sync();
  }
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
  // Always monitor app foreground/background lifecycle so backgrounded apps never
  // keep Web Audio DSP or Band sequencers running (even on iOS 'playback' audioSession).
  subscribeAppActive((active) => {
    if (!active) {
      band.halt(true);
      ambience.sync();
      chip.suspend();
      setAudioSessionType('ambient');
      return;
    }
    if (!audioFlags.music && !audioFlags.sfx) return;
    const ctx = chip.liveContext;
    if (ctx && ctx.state !== 'closed') {
      setAudioSessionType('playback');
      void Promise.resolve(ctx.resume())
        .then(() => {
          if (getIsAppActive() && ctx.state === 'running') {
            if (audioFlags.music && band.current) band.play(band.current);
            else ambience.sync();
          }
        })
        .catch(() => undefined);
    }
  });

  registerAudioInspector(() => ({
    state: chip.liveContext?.state ?? 'uninitialized',
    voiceCount: chip.voiceCount,
  }));

  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (!chip.available) return;
  const events = ['touchend', 'pointerup', 'click', 'keydown'];
  const handler = () => {
    if (!getIsAppActive()) return;
    if (!audioFlags.music && !audioFlags.sfx) return;
    unlockAudio();
    if (chip.liveContext?.state === 'running' && band.current && audioFlags.music) band.play(band.current);
  };
  // Keep listening: iOS can interrupt the context again later (calls, Siri, app switch)
  events.forEach(e => document.addEventListener(e, handler, { capture: true, passive: true }));
};

// ─── Music & Ambience ──────────────────────────────────────────────────────

/** The band plays the music (src/audio/band.ts). `music.play('woods')` switches arrangement on the next bar line. */
export const music = band;
export { ambience, band, FIGHTER_VOICE_IDS, FIGHTER_VOICE_META };
export type { CueName } from './band';
export type { FightMood, Mix } from './director';
export type { AmbienceBiome, AmbienceKind } from './ambience';
export type { FighterCallKind, FighterVoiceId };

// ─── SFX ───────────────────────────────────────────────────────────────────

export type SfxName =
  | 'click' | 'deselect' | 'match' | 'invalid' | 'grace' | 'heart' | 'hint' | 'graceGain' | 'coin'
  | 'explosion' | 'laser' | 'ricochet' | 'deal' | 'confirm' | 'back' | 'gameOver'
  | 'hit' | 'rainbow' | 'hurt' | 'levelup' | 'star1' | 'star2' | 'star3' | 'unlock'
  | 'foeDefeated' | 'wave' | 'tick' | 'victory' | 'whoosh' | 'freeze';

let lastPlayed: Partial<Record<SfxName, number>> = {};

export const sfx = (name: SfxName) => {
  if (!audioFlags.sfx) return;
  if (nowOverride === null && !getIsAppActive()) return;
  if (!chip.ensure()) return;
  const now = nowOverride ?? chip.now;
  // de-dupe very rapid repeats (e.g. 3 coin events from one match)
  const last = lastPlayed[name] ?? -1;
  if (now - last < 0.035) return;
  lastPlayed[name] = now;
  const t = now + 0.005;
  const T = (freq: number, at: number, dur: number, o: Partial<Parameters<typeof chip.tone>[0]> = {}) =>
    chip.tone({ voice: 'pulse1', freq, at, dur, vol: 0.5, duty: 0.25, bus: 'sfx', tier: 'B', ...o });

  const I = (inst: InstrumentId, n: string, dt: number, dur: number, vol: number, tier: SfxTier = 'B', space?: Space) =>
    note(inst, noteToFreq(n), t + dt, dur, { vol, bus: 'sfx', tier, space });

  switch (name) {
    // Menus are played dry in Tier C on the same instruments as the fights, in the map's key (C)
    case 'click': I('kalimba', 'G5', 0, 0.1, 0.42, 'C', 'dry'); break;
    case 'deselect': I('kalimba', 'E5', 0, 0.1, 0.36, 'C', 'dry'); break;
    case 'deal': chip.noise({ at: t, dur: 0.05, vol: 0.18, short: false, filter: 5000, bus: 'sfx', tier: 'C', space: 'dry' }); break;
    case 'match': ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => I('harp', n, i * 0.04, 0.38, 0.72, 'A')); I('bell', 'C6', 0, 0.5, 0.78, 'A'); break;
    case 'invalid': T(220, t, 0.12, { duty: 0.5, slideTo: 140, tier: 'A', space: 'dry' }); T(233, t + 0.1, 0.16, { duty: 0.5, slideTo: 110, tier: 'A', space: 'dry' }); break;
    case 'grace': T(noteToFreq('E6'), t, 0.06, { duty: 0.5 }); T(noteToFreq('B5'), t + 0.06, 0.12, { duty: 0.5 }); break;
    case 'heart': ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => I('harp', n, i * 0.05, 0.45, 0.8)); break;
    case 'hint': I('celesta', 'G5', 0, 0.25, 0.8); I('celesta', 'C6', 0.07, 0.4, 0.8); break;
    case 'graceGain': T(noteToFreq('G5'), t, 0.05); T(noteToFreq('D6'), t + 0.05, 0.1); break;
    case 'coin': I('glock', 'G6', 0, 0.18, 0.65); I('glock', 'C7', 0.06, 0.28, 0.65); break;
    case 'explosion': chip.noise({ at: t, dur: 0.32, vol: 0.78, filter: 1600, sweepTo: 140, bus: 'sfx', tier: 'A', space: 'sfxRoom' }); break;
    case 'laser': T(2200, t, 0.18, { duty: 0.125, slideTo: 300 }); break;
    case 'ricochet': [1800, 2400, 1600].forEach((f, i) => T(f, t + i * 0.05, 0.04, { duty: 0.125, vol: 0.3 })); break;
    case 'confirm': I('kalimba', 'C5', 0, 0.12, 0.55, 'C', 'dry'); I('kalimba', 'G5', 0.06, 0.16, 0.55, 'C', 'dry'); break;
    case 'back': I('kalimba', 'G5', 0, 0.12, 0.45, 'C', 'dry'); I('kalimba', 'C5', 0.06, 0.14, 0.45, 'C', 'dry'); break;
    case 'whoosh': chip.noise({ at: t, dur: 0.25, vol: 0.3, filter: 600, sweepTo: 5000, bus: 'sfx', tier: 'B' }); break;
    case 'hit':
      chip.noise({ at: t, dur: 0.12, vol: 0.55, filter: 1200, sweepTo: 300, bus: 'sfx', tier: 'A', space: 'dry' });
      T(330, t, 0.1, { duty: 0.5, slideTo: 110, voice: 'pulse2', vol: 0.4, tier: 'A', space: 'dry' });
      break;
    case 'rainbow':
      ['C6', 'D6', 'E6', 'G6', 'A6', 'C7'].forEach((n, i) => T(noteToFreq(n), t + i * 0.035, 0.08, { duty: 0.125, vol: 0.4 }));
      chip.noise({ at: t, dur: 0.2, vol: 0.4, filter: 1500, sweepTo: 200, bus: 'sfx', tier: 'B' });
      break;
    case 'hurt':
      T(180, t, 0.25, { duty: 0.5, slideTo: 60, vol: 0.6, tier: 'S', space: 'dry' });
      chip.noise({ at: t, dur: 0.2, vol: 0.4, filter: 500, bus: 'sfx', tier: 'S', space: 'dry' });
      break;
    // [AU-17]: Legacy jingles consolidated into canonical band cues & finales
    case 'levelup': band.cue('levelUp'); break;
    case 'star1': I('bell', 'E6', 0, 0.6, 0.9, 'A'); break;
    case 'star2': I('bell', 'G6', 0, 0.6, 0.9, 'A'); break;
    case 'star3': I('bell', 'C7', 0, 0.9, 1, 'A', 'hall'); I('bell', 'C6', 0, 0.9, 0.8, 'A', 'hall'); break;
    case 'unlock': band.cue('weaponGet'); break;
    case 'victory': band.finale(true); break;
    case 'gameOver': band.finale(false); break;
    case 'foeDefeated':
      chip.noise({ at: t, dur: 0.5, vol: 0.7, filter: 2500, sweepTo: 80, bus: 'sfx', tier: 'S' });
      ['G5', 'E5', 'C5', 'G4'].forEach((n, i) => T(noteToFreq(n), t + 0.05 + i * 0.07, 0.1, { duty: 0.5, voice: 'pulse2', vol: 0.35, tier: 'S' }));
      break;
    case 'wave': ['C5', 'C5', 'G5'].forEach((n, i) => T(noteToFreq(n), t + i * 0.1, 0.08, { duty: 0.125, tier: 'A' })); break;
    case 'tick': T(1000, t, 0.02, { duty: 0.5, vol: 0.25, tier: 'C', space: 'dry' }); break;
    case 'freeze':
      ['B6', 'G6', 'E6', 'B5', 'G5'].forEach((n, i) => T(noteToFreq(n), t + i * 0.05, 0.25, { duty: 0.125, vol: 0.3, vibrato: 0.02 }));
      chip.noise({ at: t, dur: 0.5, vol: 0.25, short: true, filter: 9000, sweepTo: 3000, bus: 'sfx', tier: 'B' });
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
  try {
    band.atTime(t, fn);
  } finally {
    nowOverride = null;
  }
};

installGestureUnlock();

// Dev handle for poking the synth from the browser console: __nshapesAudio.sfx('rainbow')
if (typeof __DEV__ !== 'undefined' && __DEV__ && typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__nshapesAudio = {
    chip,
    music,
    band,
    ambience,
    sfx,
    renderOffline,
    setSfxEnabled,
    setSfxOverride,
    setMusicEnabled,
    audioFlags,
    CUE_NAMES,
    WEAPON_VOICES,
    RECIPE_IDS,
    FIGHTER_VOICE_IDS,
  };
}
