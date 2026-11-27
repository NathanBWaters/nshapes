/**
 * Native iOS / Android audio bridge for Adventure & Starfall Summit ([AU-02]).
 *
 * When Web Audio (`window.AudioContext`) is unavailable on iOS/Android native builds,
 * `src/audio/band.ts` delegates music loops and musical cues here so players hear the
 * real mastered `.m4a` biome loops, harmonic card taps, payout tiers, parries, weapon
 * stings (all 64 weapons via 6 role timbres), evolutions, and victory/defeat finales
 * using Expo's built-in `expo-av` with zero extra native modules.
 *
 * Lifecycle & Battery compliance:
 *   - Subscribes exclusively via `src/utils/appLifecycle.ts` (never raw AppState).
 *   - Pauses looping BGM and clears all scheduled timers immediately on background.
 *   - Respects iOS hardware mute switch (`playsInSilentModeIOS: false`).
 *   - Lazy LRU cue cache (max 16 loaded Audio.Sound handles) to keep native RAM tiny.
 */

import { Platform } from 'react-native';
import { getIsAppActive, subscribeAppActive } from '@/utils/appLifecycle';
import type { CueName } from './band';
import type { InstrumentId } from './instruments';
import { audioFlags } from './settings';
import { weaponVoice } from './voices';

export type AVPlaybackSource = number | { uri: string };

export interface NativeSoundHandle {
  playAsync: () => Promise<unknown>;
  pauseAsync: () => Promise<unknown>;
  stopAsync: () => Promise<unknown>;
  unloadAsync: () => Promise<unknown>;
  setPositionAsync: (ms: number) => Promise<unknown>;
  setVolumeAsync: (vol: number) => Promise<unknown>;
  setIsLoopingAsync?: (looping: boolean) => Promise<unknown>;
}

export interface NativeAudioModule {
  setAudioModeAsync: (mode: {
    playsInSilentModeIOS: boolean;
    staysActiveInBackground: boolean;
    shouldDuckAndroid: boolean;
  }) => Promise<unknown>;
  Sound: {
    createAsync: (
      source: AVPlaybackSource,
      initialStatus?: { shouldPlay?: boolean; isLooping?: boolean; volume?: number }
    ) => Promise<{ sound: NativeSoundHandle }>;
  };
}

export type NativeLoopKey = 'map' | 'meadow' | 'woods' | 'canyon' | 'peaks' | 'boss';

export type NativeCueKey =
  | 'select-1' | 'select-2' | 'select-3' | 'deselect'
  | 'payout-0' | 'payout-1' | 'payout-2' | 'payout-3'
  | 'parry-warn' | 'parry' | 'perfect-parry'
  | 'hurt' | 'foe-strike' | 'mistake' | 'grace-save' | 'sour'
  | 'blast' | 'laser' | 'ricochet' | 'heal' | 'coins' | 'register' | 'rainbow'
  | 'level-up' | 'weapon-get' | 'evolve'
  | 'star-1' | 'star-2' | 'star-3' | 'rank-seal'
  | 'foe-defeated' | 'slow-mo-defeat' | 'victory' | 'defeat'
  | 'key-found' | 'friend-rescued'
  | 'sting-brass' | 'sting-bell' | 'sting-mallet' | 'sting-pluck' | 'sting-orchestra' | 'sting-wind';

export const NATIVE_LOOP_ASSETS: Record<NativeLoopKey, AVPlaybackSource> = {
  map: require('../../assets/sounds/native/loops/map.m4a'),
  meadow: require('../../assets/sounds/native/loops/meadow.m4a'),
  woods: require('../../assets/sounds/native/loops/woods.m4a'),
  canyon: require('../../assets/sounds/native/loops/canyon.m4a'),
  peaks: require('../../assets/sounds/native/loops/peaks.m4a'),
  boss: require('../../assets/sounds/native/loops/boss.m4a'),
};

export const NATIVE_CUE_ASSETS: Record<NativeCueKey, AVPlaybackSource> = {
  'select-1': require('../../assets/sounds/native/cues/select-1.m4a'),
  'select-2': require('../../assets/sounds/native/cues/select-2.m4a'),
  'select-3': require('../../assets/sounds/native/cues/select-3.m4a'),
  deselect: require('../../assets/sounds/native/cues/deselect.m4a'),
  'payout-0': require('../../assets/sounds/native/cues/payout-0.m4a'),
  'payout-1': require('../../assets/sounds/native/cues/payout-1.m4a'),
  'payout-2': require('../../assets/sounds/native/cues/payout-2.m4a'),
  'payout-3': require('../../assets/sounds/native/cues/payout-3.m4a'),
  'parry-warn': require('../../assets/sounds/native/cues/parry-warn.m4a'),
  parry: require('../../assets/sounds/native/cues/parry.m4a'),
  'perfect-parry': require('../../assets/sounds/native/cues/perfect-parry.m4a'),
  hurt: require('../../assets/sounds/native/cues/hurt.m4a'),
  'foe-strike': require('../../assets/sounds/native/cues/foe-strike.m4a'),
  mistake: require('../../assets/sounds/native/cues/mistake.m4a'),
  'grace-save': require('../../assets/sounds/native/cues/grace-save.m4a'),
  sour: require('../../assets/sounds/native/cues/sour.m4a'),
  blast: require('../../assets/sounds/native/cues/blast.m4a'),
  laser: require('../../assets/sounds/native/cues/laser.m4a'),
  ricochet: require('../../assets/sounds/native/cues/ricochet.m4a'),
  heal: require('../../assets/sounds/native/cues/heal.m4a'),
  coins: require('../../assets/sounds/native/cues/coins.m4a'),
  register: require('../../assets/sounds/native/cues/register.m4a'),
  rainbow: require('../../assets/sounds/native/cues/rainbow.m4a'),
  'level-up': require('../../assets/sounds/native/cues/level-up.m4a'),
  'weapon-get': require('../../assets/sounds/native/cues/weapon-get.m4a'),
  evolve: require('../../assets/sounds/native/cues/evolve.m4a'),
  'star-1': require('../../assets/sounds/native/cues/star-1.m4a'),
  'star-2': require('../../assets/sounds/native/cues/star-2.m4a'),
  'star-3': require('../../assets/sounds/native/cues/star-3.m4a'),
  'rank-seal': require('../../assets/sounds/native/cues/rank-seal.m4a'),
  'foe-defeated': require('../../assets/sounds/native/cues/foe-defeated.m4a'),
  'slow-mo-defeat': require('../../assets/sounds/native/cues/slow-mo-defeat.m4a'),
  victory: require('../../assets/sounds/native/cues/victory.m4a'),
  defeat: require('../../assets/sounds/native/cues/defeat.m4a'),
  'key-found': require('../../assets/sounds/native/cues/key-found.m4a'),
  'friend-rescued': require('../../assets/sounds/native/cues/friend-rescued.m4a'),
  'sting-brass': require('../../assets/sounds/native/cues/sting-brass.m4a'),
  'sting-bell': require('../../assets/sounds/native/cues/sting-bell.m4a'),
  'sting-mallet': require('../../assets/sounds/native/cues/sting-mallet.m4a'),
  'sting-pluck': require('../../assets/sounds/native/cues/sting-pluck.m4a'),
  'sting-orchestra': require('../../assets/sounds/native/cues/sting-orchestra.m4a'),
  'sting-wind': require('../../assets/sounds/native/cues/sting-wind.m4a'),
};

export const CUE_TO_NATIVE: Record<CueName, NativeCueKey> = {
  heal: 'heal',
  hurt: 'hurt',
  mistake: 'mistake',
  graceSave: 'grace-save',
  coins: 'coins',
  levelUp: 'level-up',
  foeDefeated: 'foe-defeated',
  wave: 'sting-brass',
  foeRegen: 'sting-orchestra',
  foeMove: 'sting-brass',
  foeDud: 'hurt',
  foeHide: 'sour',
  foeFuse: 'parry-warn',
  foeShuffle: 'sting-mallet',
  foeSteal: 'sour',
  foeGrowl: 'foe-strike',
  fire: 'blast',
  hint: 'sting-bell',
  toll: 'defeat',
  timeGain: 'weapon-get',
  nineLives: 'heal',
  hotStreak: 'payout-2',
  bigHit: 'payout-2',
  grudge: 'sting-brass',
  shield: 'parry',
  patience: 'sting-bell',
  freeze: 'sting-bell',
  redeal: 'sting-mallet',
  scoop: 'sting-mallet',
  twinkle: 'sting-bell',
  fetch: 'coins',
  phew: 'grace-save',
  ding: 'select-3',
  blast: 'blast',
  laser: 'laser',
  ricochet: 'ricochet',
  doubled: 'register',
  armed: 'select-2',
  charged: 'evolve',
  warDrum: 'sting-brass',
  clarity: 'sting-bell',
  clarityEnd: 'deselect',
  pinata: 'sting-mallet',
  pinataBreak: 'coins',
  link: 'sting-pluck',
  purity: 'sting-orchestra',
  rainbow: 'rainbow',
  arcanaGain: 'key-found',
  catalyst: 'key-found',
  evoAlmost: 'key-found',
  evoProgress: 'select-2',
  evoCharge: 'sting-bell',
  evoEnd: 'deselect',
  trapSet: 'parry-warn',
  trapDefused: 'parry',
  trapSprung: 'foe-strike',
  burn: 'blast',
  overkill: 'register',
  streakLost: 'deselect',
  sour: 'sour',
  reelStop: 'select-2',
  register: 'register',
  reelSpin: 'sting-mallet',
  star: 'star-1',
  starSwoosh: 'sting-wind',
  rankSeal: 'rank-seal',
  coinRoll: 'coins',
  weaponGet: 'weapon-get',
  tap: 'select-1',
  back: 'deselect',
  parryWarn: 'parry-warn',
  parry: 'parry',
  perfectParry: 'perfect-parry',
  foeStrike: 'foe-strike',
  multStep: 'select-3',
  multSlam: 'payout-2',
  killCamRiser: 'parry-warn',
  killCamShatter: 'perfect-parry',
  slowMoDefeat: 'slow-mo-defeat',
  storyClimax: 'star-3',
  keyFound: 'key-found',
  friendRescued: 'friend-rescued',
};

const INSTRUMENT_ROLE_STING: Record<InstrumentId, NativeCueKey> = {
  brass: 'sting-brass',
  brassStab: 'sting-brass',
  horn: 'sting-brass',
  saw: 'sting-brass',
  bell: 'sting-bell',
  glock: 'sting-bell',
  celesta: 'sting-bell',
  musicbox: 'sting-bell',
  glass: 'sting-bell',
  kalimba: 'sting-mallet',
  marimba: 'sting-mallet',
  vibes: 'sting-mallet',
  steel: 'sting-mallet',
  toy: 'sting-mallet',
  pluck: 'sting-pluck',
  harp: 'sting-pluck',
  pizz: 'sting-pluck',
  banjo: 'sting-pluck',
  clav: 'sting-pluck',
  strings: 'sting-orchestra',
  choir: 'sting-orchestra',
  organ: 'sting-orchestra',
  accordion: 'sting-orchestra',
  flute: 'sting-wind',
  whistle: 'sting-wind',
  theremin: 'sting-wind',
  chip: 'sting-wind',
  chipSoft: 'sting-wind',
  sub: 'sting-wind',
};

/** High-priority cues that duck the native BGM loop so impacts punch clearly. */
const DUCKING_CUES: Partial<Record<NativeCueKey, [depth: number, releaseMs: number]>> = {
  'payout-2': [0.45, 500],
  'payout-3': [0.65, 850],
  'perfect-parry': [0.55, 450],
  hurt: [0.6, 700],
  'foe-strike': [0.55, 550],
  blast: [0.35, 380],
  'level-up': [0.45, 650],
  evolve: [0.55, 750],
  'foe-defeated': [0.6, 800],
  'slow-mo-defeat': [0.75, 900],
};

const BASE_BGM_VOLUME = 0.42;
const BASE_CUE_VOLUME = 0.78;
const MAX_CACHED_CUES = 16;
const DEDUPE_MS = 35;

export const resolveNativeLoop = (arrangement: string): NativeLoopKey => {
  if (arrangement in NATIVE_LOOP_ASSETS) return arrangement as NativeLoopKey;
  if (arrangement === 'summit') return 'boss';
  return 'map';
};

export const resolveWeaponStingKey = (weaponId: string): NativeCueKey =>
  INSTRUMENT_ROLE_STING[weaponVoice(weaponId).inst] ?? 'sting-mallet';

export const resolveCueKey = (name: CueName, amount = 0): NativeCueKey => {
  if (name === 'star') {
    const n = Math.max(1, Math.min(3, Math.round(amount) || 1));
    return n === 3 ? 'star-3' : n === 2 ? 'star-2' : 'star-1';
  }
  if (name === 'multSlam') {
    const t = Math.max(0, Math.min(3, Math.round(amount)));
    return (`payout-${t}`) as NativeCueKey;
  }
  return CUE_TO_NATIVE[name];
};

const isJestEnv = (): boolean =>
  typeof process !== 'undefined' && typeof process.env !== 'undefined' && Boolean(process.env.JEST_WORKER_ID);

let injectedAudio: NativeAudioModule | null = null;
let cachedExpoAudio: NativeAudioModule | null | undefined = undefined;

const getAudioModule = (): NativeAudioModule | null => {
  if (injectedAudio) return injectedAudio;
  if (Platform.OS === 'web' || isJestEnv()) return null;
  if (cachedExpoAudio !== undefined) return cachedExpoAudio;
  const g = typeof globalThis !== 'undefined'
    ? (globalThis as { __nshapesExpoAv?: { Audio?: NativeAudioModule } }).__nshapesExpoAv
    : undefined;
  cachedExpoAudio = g?.Audio ?? null;
  return cachedExpoAudio;
};

class NativeAudioBridge {
  private audioModeReady = false;
  private currentTrack: NativeLoopKey | null = null;
  private activeSound: NativeSoundHandle | null = null;
  private trackToken = 0;
  private musicLevel = 1;
  private duckFactor = 1;
  private duckTimer: ReturnType<typeof setTimeout> | null = null;
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private scheduledTimers = new Set<ReturnType<typeof setTimeout>>();
  private cueCache = new Map<NativeCueKey, NativeSoundHandle>();
  private loadingCues = new Map<NativeCueKey, Promise<NativeSoundHandle | null>>();
  private lastCueAt = new Map<NativeCueKey, number>();

  constructor() {
    subscribeAppActive((active) => {
      if (!active) {
        this.clearScheduledTimers();
        this.pauseForBackground();
      } else if (audioFlags.music && this.currentTrack) {
        void this.resumeFromBackground();
      }
    });
  }

  get available(): boolean {
    return getAudioModule() !== null;
  }

  get activeTrack(): NativeLoopKey | null {
    return this.currentTrack;
  }

  private async ensureAudioMode(Audio: NativeAudioModule): Promise<void> {
    if (this.audioModeReady) return;
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: false,
        staysActiveInBackground: false,
        shouldDuckAndroid: true,
      });
      this.audioModeReady = true;
    } catch {
      // Ignore audio-mode setup failures on simulators/partial runtimes
    }
  }

  private effectiveBgmVolume(): number {
    return Math.max(0, Math.min(1, BASE_BGM_VOLUME * this.musicLevel * this.duckFactor));
  }

  private clearDuckTimer() {
    if (this.duckTimer) clearTimeout(this.duckTimer);
    this.duckTimer = null;
  }

  private clearFadeTimer() {
    if (this.fadeTimer) clearTimeout(this.fadeTimer);
    this.fadeTimer = null;
  }

  private clearScheduledTimers() {
    this.clearDuckTimer();
    this.clearFadeTimer();
    for (const id of this.scheduledTimers) clearTimeout(id);
    this.scheduledTimers.clear();
  }

  private pauseForBackground() {
    this.duckFactor = 1;
    if (this.activeSound) {
      void this.activeSound.pauseAsync().catch(() => undefined);
    }
  }

  private async resumeFromBackground() {
    if (!getIsAppActive() || !audioFlags.music || !this.currentTrack) return;
    if (this.activeSound) {
      try {
        await this.activeSound.setVolumeAsync(this.effectiveBgmVolume());
        await this.activeSound.playAsync();
        return;
      } catch {
        // Sound handle was released by OS; reload cleanly below
      }
    }
    this.playMusic(this.currentTrack);
  }

  /** Start or crossfade into a pre-rendered `.m4a` biome loop. */
  playMusic(arrangement: string): void {
    const Audio = getAudioModule();
    const key = resolveNativeLoop(arrangement);
    this.currentTrack = key;
    if (!Audio || !audioFlags.music || !getIsAppActive()) return;
    if (this.activeSound && this.lastLoadedTrack === key) {
      void this.activeSound.setVolumeAsync(this.effectiveBgmVolume()).catch(() => undefined);
      void this.activeSound.playAsync().catch(() => undefined);
      return;
    }

    const token = ++this.trackToken;
    const prevSound = this.activeSound;
    this.activeSound = null;
    this.lastLoadedTrack = null;
    this.clearFadeTimer();

    void (async () => {
      await this.ensureAudioMode(Audio);
      if (token !== this.trackToken || !audioFlags.music || !getIsAppActive()) {
        if (prevSound) {
          void prevSound.stopAsync().catch(() => undefined);
          void prevSound.unloadAsync().catch(() => undefined);
        }
        return;
      }

      try {
        const { sound } = await Audio.Sound.createAsync(NATIVE_LOOP_ASSETS[key], {
          shouldPlay: true,
          isLooping: true,
          volume: prevSound ? 0.05 : this.effectiveBgmVolume(),
        });
        if (token !== this.trackToken || !audioFlags.music || !getIsAppActive()) {
          await sound.stopAsync().catch(() => undefined);
          await sound.unloadAsync().catch(() => undefined);
          return;
        }
        this.activeSound = sound;
        this.lastLoadedTrack = key;

        if (prevSound) {
          void prevSound.setVolumeAsync(0.05).catch(() => undefined);
          this.fadeTimer = setTimeout(() => {
            this.fadeTimer = null;
            void prevSound.stopAsync().catch(() => undefined);
            void prevSound.unloadAsync().catch(() => undefined);
            if (this.activeSound === sound && getIsAppActive() && audioFlags.music) {
              void sound.setVolumeAsync(this.effectiveBgmVolume()).catch(() => undefined);
            }
          }, 140);
        } else {
          await sound.setVolumeAsync(this.effectiveBgmVolume()).catch(() => undefined);
        }
      } catch {
        // Leave silent gracefully if decode fails
      }
    })();
  }

  private lastLoadedTrack: NativeLoopKey | null = null;

  /** Silence playback but keep `currentTrack` remembered so toggling music back ON resumes it. */
  haltMusic(): void {
    this.trackToken += 1;
    this.clearScheduledTimers();
    this.duckFactor = 1;
    const s = this.activeSound;
    this.activeSound = null;
    this.lastLoadedTrack = null;
    if (s) {
      void s.stopAsync().catch(() => undefined);
      void s.unloadAsync().catch(() => undefined);
    }
  }

  /** Stop and clear the active track (leaving Adventure/Summit screens). */
  stopMusic(): void {
    this.haltMusic();
    this.currentTrack = null;
  }

  /** Smoothly update native BGM level (0..1) from the band director's mix (pause, lounge, slow-mo). */
  setMusicLevel(level: number): void {
    this.musicLevel = Math.max(0, Math.min(1, level));
    if (this.activeSound && getIsAppActive() && audioFlags.music) {
      void this.activeSound.setVolumeAsync(this.effectiveBgmVolume()).catch(() => undefined);
    }
  }

  /** Dip native BGM briefly under high-impact Tier S/A cues, then restore cleanly. */
  duckMusic(depth: number, releaseMs = 450): void {
    if (!this.activeSound || !getIsAppActive() || !audioFlags.music) return;
    this.duckFactor = Math.max(0.15, 1 - Math.max(0, Math.min(0.85, depth)));
    void this.activeSound.setVolumeAsync(this.effectiveBgmVolume()).catch(() => undefined);
    this.clearDuckTimer();
    this.duckTimer = setTimeout(() => {
      this.duckTimer = null;
      this.duckFactor = 1;
      if (this.activeSound && getIsAppActive() && audioFlags.music) {
        void this.activeSound.setVolumeAsync(this.effectiveBgmVolume()).catch(() => undefined);
      }
    }, Math.max(80, releaseMs));
  }

  private async loadCue(Audio: NativeAudioModule, key: NativeCueKey): Promise<NativeSoundHandle | null> {
    const cached = this.cueCache.get(key);
    if (cached) {
      // Refresh LRU ordering
      this.cueCache.delete(key);
      this.cueCache.set(key, cached);
      return cached;
    }
    const inflight = this.loadingCues.get(key);
    if (inflight) return inflight;

    const p = (async () => {
      try {
        await this.ensureAudioMode(Audio);
        const { sound } = await Audio.Sound.createAsync(NATIVE_CUE_ASSETS[key], {
          shouldPlay: false,
          isLooping: false,
          volume: BASE_CUE_VOLUME,
        });
        if (this.cueCache.size >= MAX_CACHED_CUES) {
          const oldest = this.cueCache.keys().next().value as NativeCueKey | undefined;
          if (oldest) {
            const evicted = this.cueCache.get(oldest);
            this.cueCache.delete(oldest);
            if (evicted) void evicted.unloadAsync().catch(() => undefined);
          }
        }
        this.cueCache.set(key, sound);
        return sound;
      } catch {
        return null;
      } finally {
        this.loadingCues.delete(key);
      }
    })();

    this.loadingCues.set(key, p);
    return p;
  }

  /** Play a native `.m4a` cue immediately or after `delayMs` (capped for snappy chains). */
  playCueKey(key: NativeCueKey, delayMs = 0, vol = 1): void {
    const Audio = getAudioModule();
    if (!Audio || !audioFlags.sfx || !getIsAppActive()) return;

    const fireNow = () => {
      if (!audioFlags.sfx || !getIsAppActive()) return;
      const now = Date.now();
      const last = this.lastCueAt.get(key) ?? 0;
      if (now - last < DEDUPE_MS) return;
      this.lastCueAt.set(key, now);

      const duck = DUCKING_CUES[key];
      if (duck) this.duckMusic(duck[0], duck[1]);

      void this.loadCue(Audio, key).then(async (sound) => {
        if (!sound || !audioFlags.sfx || !getIsAppActive()) return;
        try {
          await sound.setVolumeAsync(Math.max(0.05, Math.min(1, BASE_CUE_VOLUME * vol)));
          await sound.setPositionAsync(0);
          await sound.playAsync();
        } catch {
          this.cueCache.delete(key);
        }
      });
    };

    const clampedDelay = Math.max(0, Math.min(1200, Math.round(delayMs)));
    if (clampedDelay <= 8) {
      fireNow();
      return;
    }

    const timer = setTimeout(() => {
      this.scheduledTimers.delete(timer);
      fireNow();
    }, clampedDelay);
    this.scheduledTimers.add(timer);
  }

  select(count: number): void {
    const idx = Math.max(1, Math.min(3, Math.round(count)));
    this.playCueKey(`select-${idx}` as NativeCueKey, 0, 0.72);
  }

  deselect(): void {
    this.playCueKey('deselect', 0, 0.6);
  }

  payout(opts: { tier: number; rainbow?: boolean; afterMs?: number }): void {
    const tier = Math.max(0, Math.min(3, Math.round(opts.tier)));
    const delay = opts.afterMs ?? 0;
    this.playCueKey(`payout-${tier}` as NativeCueKey, delay, 0.82 + tier * 0.06);
    if (opts.rainbow) this.playCueKey('rainbow', delay + 55, 0.85);
  }

  cue(name: CueName, opts: { amount?: number; slot?: number; afterMs?: number } = {}): void {
    const key = resolveCueKey(name, opts.amount ?? 0);
    const slotMs = Math.min(480, Math.max(0, opts.slot ?? 0) * 55);
    this.playCueKey(key, slotMs + (opts.afterMs ?? 0));
  }

  fireWeapon(weaponId: string, slot = 0, afterMs = 0): void {
    const key = resolveWeaponStingKey(weaponId);
    const slotMs = Math.min(480, Math.max(0, slot) * 55);
    this.playCueKey(key, slotMs + afterMs, 0.76);
  }

  evolve(): void {
    this.playCueKey('evolve', 0, 0.95);
  }

  fighterCall(fighter: string, kind: 'cheer' | 'hurt' | 'signature'): void {
    const map: Record<string, NativeCueKey> = {
      'Orange Tabby': 'sting-wind',
      'Sly Fox': 'sting-pluck',
      Badger: 'sting-brass',
      'Emperor Penguin': 'sting-bell',
      Corgi: 'sting-mallet',
      Pelican: 'select-2',
    };
    const key = map[fighter] ?? 'sting-mallet';
    this.playCueKey(key, 0, kind === 'hurt' ? 0.62 : 0.72);
  }

  slowMoDefeat(): void {
    this.setMusicLevel(0.28);
    this.playCueKey('slow-mo-defeat', 0, 1);
  }

  finale(won: boolean): void {
    this.haltMusic();
    this.musicLevel = 1;
    this.playCueKey(won ? 'victory' : 'defeat', 0, 0.95);
  }

  /** Reset internal cache & timers (used by unit tests). */
  resetForTests(): void {
    this.stopMusic();
    this.audioModeReady = false;
    this.musicLevel = 1;
    this.duckFactor = 1;
    this.lastCueAt.clear();
    for (const s of this.cueCache.values()) {
      void s.unloadAsync().catch(() => undefined);
    }
    this.cueCache.clear();
    this.loadingCues.clear();
  }
}

export const nativeBridge = new NativeAudioBridge();

/** Test helper: inject a mock `expo-av` Audio module to verify native bridge behavior in Jest. */
export const __setNativeAudioForTests = (mockAudio: NativeAudioModule | null): void => {
  nativeBridge.resetForTests();
  injectedAudio = mockAudio;
};
