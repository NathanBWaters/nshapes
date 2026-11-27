/**
 * The band: the live score of a fight.
 *
 * One sequencer plays the tune in 16-bar A-B form (plus 1-bar INTRO_PICKUP on
 * fight entry), layers (lead, bass, drums, arpeggio, pad, counter-melody), a
 * riff for each weapon you hold, a duet for each evolution, and capped warning
 * figures for what is on the board. The director (src/audio/director.ts) says
 * which layers play; this file plays them.
 *
 * Every effect ("cue") is music too, prioritized across 4 tiers (S / A / B / C):
 *   - Reactive, parry, hurt, tally & UI cues fire immediately (4 ms lookahead)
 *     while staying 100% scale-locked to the active bar ([AU-11]).
 *   - Rhythmic Set cascades align to the 32nd-note grid inside band.stretch().
 *   - Hit cues open with dry <2 ms impactCrack + tight 40-58 ms impactPunch
 *     finishing inside visual hitstop ([AU-08], [AU-09], [AU-10]).
 *
 * With music switched off the sequencer stops, cues still play (in the world's
 * home key), and quiet procedural biome ambience stays alive until SFX is also
 * muted or the app backgrounds ([AU-20]).
 */
import { getIsAppActive } from '@/utils/appLifecycle';
import { registerInterval } from '@/utils/perfWatchdog';
import { ambience } from './ambience';
import { chip, foldFreq, type SfxTier, type Space } from './chip';
import { direct, restingMix, worldTone, type FightMood, type Mix } from './director';
import { FIGHTER_CALL_COOLDOWN_MS, playFighterVoice, type FighterCallKind } from './fighterVoices';
import {
  DRUMS,
  INSTRUMENTS,
  downlifter,
  drum,
  impactPunch,
  note,
  riser,
  subDrop,
  type DrumId,
  type InstrumentId,
} from './instruments';
import { nativeBridge } from './nativeBridge';
import { audioFlags } from './settings';
import { ARRANGEMENTS, INTRO_PICKUP, THEME, THEME_B, THEME_BATTLE_B, type Arrangement } from './songs';
import { themeOf } from './themes';
import { chordRoot, degreeToFreq, isMinor, ladderDegree, ladderRung, nextGridTime, parseNote, type ModeName } from './theory';
import { riffNotes, stingOf, weaponVoice, type EvolutionGroove, type WeaponVoice } from './voices';

/** The instrument that doubles the tune in each world once the band fills in */
const WORLD_COLOUR: Record<string, InstrumentId> = {
  title: 'kalimba',
  story: 'celesta',
  camp: 'harp',
  map: 'celesta',
  meadow: 'glock',
  woods: 'flute',
  canyon: 'banjo',
  peaks: 'celesta',
  summit: 'celesta',
  boss: 'brass',
};

const BASS_STEP: Record<string, number> = { R: 0, '3': 2, '5': 4, '7': 6, '8': 7 };

/** Drum bars an evolution plays instead of the world's own: k kick · s snare · h hat · o open hat · c clap */
const GROOVES: Record<EvolutionGroove, string> = {
  fourFloor: 'k.h.kcohk.h.kcoh',
  gallop: 'k.hkk.hks.hkk.hk',
  breakbeat: 'k.h.s.hk.kh.s.hh',
  march: 'k.ssk.s.k.ssksss',
};
const LOUNGE_DRUMS = 'k...h..hs...h..h';

/** A weapon riff's level in the music, and how much louder it gets while the weapon is firing */
const RIFF_VOL = 1.2;
const RIFF_HEAT = 0.8;

/** Monotonic gain scaling for Set payout tiers 0..3 (-5 dB, -2 dB, 0 dB, +1 dB) ([AU-04]). */
export const PAYOUT_TIER_GAIN = [0.56, 0.79, 1.0, 1.12] as const;

/** Dev builds only: when each fight sound will be heard, on the page's own clock. The motion capture times sound against the picture with it. */
interface CueLogEntry { name: string; t: number }
const CUE_LOG_MAX = 500;
const logCue = (name: string, at: number, now: number): void => {
  if (typeof __DEV__ === 'undefined' || !__DEV__ || typeof window === 'undefined' || typeof performance === 'undefined') return;
  const w = window as unknown as { __nshapesCueLog?: CueLogEntry[] };
  const log = (w.__nshapesCueLog ??= []);
  log.push({ name, t: performance.now() + (at - now) * 1000 });
  if (log.length > CUE_LOG_MAX) log.splice(0, log.length - CUE_LOG_MAX);
};

export type CueName =
  | 'heal' | 'hurt' | 'mistake' | 'graceSave' | 'coins' | 'levelUp' | 'foeDefeated' | 'wave' | 'foeRegen'
  | 'foeMove' | 'foeDud' | 'foeHide' | 'foeFuse' | 'foeShuffle' | 'foeSteal' | 'foeGrowl'
  | 'fire' | 'hint' | 'toll' | 'timeGain' | 'nineLives' | 'hotStreak' | 'bigHit' | 'grudge' | 'shield' | 'patience'
  | 'freeze' | 'redeal' | 'scoop' | 'twinkle' | 'fetch' | 'phew' | 'ding' | 'blast' | 'laser' | 'ricochet'
  | 'doubled' | 'armed' | 'charged' | 'warDrum' | 'clarity' | 'clarityEnd' | 'pinata' | 'pinataBreak' | 'link'
  | 'purity' | 'rainbow' | 'arcanaGain' | 'catalyst' | 'evoAlmost' | 'evoProgress' | 'evoCharge' | 'evoEnd'
  | 'trapSet' | 'trapDefused' | 'trapSprung' | 'burn' | 'overkill'
  | 'streakLost' | 'sour' | 'reelStop' | 'register' | 'reelSpin' | 'star' | 'starSwoosh' | 'rankSeal' | 'coinRoll' | 'weaponGet' | 'tap' | 'back'
  | 'parryWarn' | 'parry' | 'perfectParry' | 'foeStrike' | 'multStep' | 'multSlam' | 'killCamRiser' | 'killCamShatter' | 'slowMoDefeat' | 'storyClimax'
  | 'keyFound' | 'friendRescued';

/**
 * 24 immediate reactive, parry, tally, kill-cam & UI cues ([AU-11]).
 * Fire with 4 ms lookahead instead of waiting for a 32nd-note grid boundary,
 * while staying 100% scale-locked to the active chord & mode.
 */
export const IMMEDIATE_CUES: ReadonlySet<CueName> = new Set<CueName>([
  'tap', 'back', 'slowMoDefeat', 'star', 'starSwoosh', 'rankSeal', 'storyClimax', 'keyFound', 'friendRescued',
  'mistake', 'hurt', 'parryWarn', 'parry', 'perfectParry', 'foeStrike', 'hint',
  'multStep', 'multSlam', 'register', 'weaponGet', 'reelSpin', 'reelStop',
  'killCamRiser', 'killCamShatter',
]);

/** Explicit 4-tier priority assignment for every cue ([AU-04]). */
export const CUE_TIER: Record<CueName, SfxTier> = {
  // Tier S (0 dB, ducks Tier B/C -9 dB & music -8 dB)
  slowMoDefeat: 'S',
  foeDefeated: 'S',
  perfectParry: 'S',
  hurt: 'S',
  foeStrike: 'S',
  parryWarn: 'S',
  killCamRiser: 'S',
  killCamShatter: 'S',

  // Tier A (-1 dB, ducks Tier B/C -4 dB & music -3 to -7 dB)
  parry: 'A',
  evoAlmost: 'A',
  blast: 'A',
  mistake: 'A',
  levelUp: 'A',
  star: 'A',
  rankSeal: 'A',
  friendRescued: 'A',
  bigHit: 'A',
  wave: 'A',
  toll: 'A',
  trapSprung: 'A',
  storyClimax: 'A',

  // Tier B (-5 dB, never ducks higher tiers)
  heal: 'B',
  graceSave: 'B',
  coins: 'B',
  foeRegen: 'B',
  foeMove: 'B',
  foeDud: 'B',
  foeHide: 'B',
  foeFuse: 'B',
  foeShuffle: 'B',
  foeSteal: 'B',
  foeGrowl: 'B',
  fire: 'B',
  hint: 'B',
  timeGain: 'B',
  nineLives: 'B',
  hotStreak: 'B',
  grudge: 'B',
  shield: 'B',
  patience: 'B',
  freeze: 'B',
  redeal: 'B',
  scoop: 'B',
  fetch: 'B',
  phew: 'B',
  ding: 'B',
  laser: 'B',
  ricochet: 'B',
  doubled: 'B',
  charged: 'B',
  warDrum: 'B',
  clarity: 'B',
  clarityEnd: 'B',
  pinata: 'B',
  pinataBreak: 'B',
  link: 'B',
  purity: 'B',
  rainbow: 'B',
  arcanaGain: 'B',
  catalyst: 'B',
  evoCharge: 'B',
  trapSet: 'B',
  trapDefused: 'B',
  burn: 'B',
  overkill: 'B',
  streakLost: 'B',
  sour: 'B',
  register: 'B',
  starSwoosh: 'B',
  coinRoll: 'B',
  weaponGet: 'B',
  multStep: 'B',
  multSlam: 'B',
  keyFound: 'B',

  // Tier C (-8 dB, dry, stolen first)
  tap: 'C',
  back: 'C',
  armed: 'C',
  twinkle: 'C',
  evoProgress: 'C',
  evoEnd: 'C',
  reelSpin: 'C',
  reelStop: 'C',
};

export interface CueOpts {
  /** How big the thing is (damage, coins, a count): scales the cue */
  amount?: number;
  /** Position in a chain of effects: later slots play later and higher */
  slot?: number;
  /** Heard this much later than its slot (ms): when its picture lands */
  afterMs?: number;
}

interface CueCtx {
  t: number;
  /** One 32nd note at the current tempo */
  g: number;
  mode: ModeName;
  key: number;
  /** Root step of the chord playing at `t` */
  root: number;
  amount: number;
  slot: number;
  tier: SfxTier;
  /** True when a heavy T2/T3 payout just landed within 120 ms (prevents double subDrop on multSlam) */
  suppressSlamSub?: boolean;
}

const SFX = 'sfx' as const;

class Band {
  /** Arrangement asked for (remembered while music is off) */
  current: string | null = null;
  private arr: Arrangement | null = null;
  private arrName = 'map';
  private pending: string | null = null;
  private step = 0;
  private introStepsLeft = 0;
  private nextTime = 0;
  private bpm = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopIntervalTrack: (() => void) | null = null;
  private mix: Mix = restingMix('map');
  /** Smoothly eased per-layer energy envelopes (fast attack on match, slow multi-bar release when streak ends or idle) */
  private env = { intensity: 0.5, lead: 1, arp: 0, counter: 0, drums: 2 };
  private mood: FightMood | null = null;
  private heat = new Map<string, number>();
  private turn = 0;
  private spot: string[] = [];
  private clockOverride: number | null = null;
  private lastCueAt: Partial<Record<string, number>> = {};
  private lastHeavyPayoutAt = -Infinity;
  private lastFighterCallAt = new Map<string, number>();
  private storyHeroMode = false;
  /** Expedition 33 slow-mo time-dilation factor (1 = normal, <1 = tempo + pitch dragging down into hit-stop) */
  private slowMo = 1;
  private slowMoTimer: ReturnType<typeof setTimeout> | null = null;

  /** True while a fight is feeding the band its mood: the fight's own sounds belong to the band. */
  get inFight(): boolean {
    return this.mood !== null;
  }

  /** True on native iOS/Android where Web Audio is absent and no offline context is attached. */
  private get useNative(): boolean {
    return !chip.ctx && !chip.available;
  }

  private get now(): number {
    return this.clockOverride ?? chip.now;
  }

  /** Execute `fn` with a temporary clock override (used by offline SFX reels in index.ts). */
  atTime(t: number, fn: () => void): void {
    const prev = this.clockOverride;
    this.clockOverride = t;
    this.lastCueAt = {};
    try {
      fn();
    } finally {
      this.clockOverride = prev;
    }
  }

  // ─── Transport ────────────────────────────────────────────────────────────

  play(name: string) {
    const known = ARRANGEMENTS[name] ? name : 'map';
    this.current = known;
    this.clearSlowMo();
    if (known !== 'story') this.storyHeroMode = false;
    if (!this.mood) this.mix = restingMix(known);
    if (this.useNative) {
      if (!audioFlags.music) return;
      nativeBridge.setMusicLevel(this.mix.level);
      nativeBridge.playMusic(known);
      return;
    }
    if (!audioFlags.music) {
      // [AU-20]: Even when Music is OFF, keep quiet biome ambience alive if SFX is ON
      if (audioFlags.sfx && chip.ensure()) ambience.setBiome(known);
      else ambience.stop();
      return;
    }
    if (!chip.ensure()) return;
    ambience.setBiome(known);
    if (this.timer && this.arr) {
      if (this.arrName !== known) this.pending = known; // swap on the next bar line
      return;
    }
    this.setArrangement(known);
    this.pending = null;
    this.bpm = ARRANGEMENTS[known].bpm;
    this.snapEnv(this.mix);
    this.nextTime = chip.now + 0.08;
    this.applied = { filterHz: -1, level: -1, echo: -1 };
    this.applyMixToChip(0.05);
    this.stopIntervalTrack?.();
    this.stopIntervalTrack = registerInterval('Band.scheduler');
    this.timer = setInterval(() => this.schedule(), 25);
  }

  /**
   * Semantic helper for non-battle screens ([AU-20]):
   *   - title: warm drumless kalimba/strings/vibes (96 BPM)
   *   - freeplay: gentle lounge continuation of title (level 0.65, 4.2 kHz filter)
   *   - story: dusk Aeolian strings + celesta + timpani (88 BPM)
   *   - storyHero: Beat 3 Hero brightening to Ionian
   *   - camp: cozy campfire vibes + harp + pizz + soft shaker (98 BPM)
   *   - map: adventure map theme (108 BPM)
   */
  playScreenMusic(screen: 'title' | 'freeplay' | 'story' | 'storyHero' | 'camp' | 'map') {
    this.mood = null;
    if (screen === 'freeplay') {
      this.storyHeroMode = false;
      this.play('title');
      this.mix = { ...restingMix('title'), level: 0.65, filterHz: 4200, lounge: true };
      this.applyMixToChip(0.45);
      return;
    }
    if (screen === 'storyHero') {
      this.storyHeroMode = true;
      this.play('story');
      this.mix = { ...restingMix('story'), mode: 'ionian', leadMode: 'ionian', level: 0.92 };
      this.applyMixToChip(0.45);
      return;
    }
    this.storyHeroMode = false;
    this.play(screen);
  }

  /** Brighten the StoryIntro arrangement from dusk Aeolian to triumphant Ionian on Beat 3 ([AU-20]). */
  setStoryHeroMode(hero: boolean) {
    this.storyHeroMode = hero;
    if (this.current === 'story' && !this.mood) {
      const mode: ModeName = hero ? 'ionian' : 'aeolian';
      this.mix = { ...restingMix('story'), mode, leadMode: mode, level: hero ? 0.92 : 0.85 };
      this.applyMixToChip(0.45);
    }
  }

  /** Stop and forget the song (leaving a screen). */
  stop() {
    this.halt();
    ambience.stop();
    if (this.useNative) nativeBridge.stopMusic();
    this.current = null;
    this.mood = null;
    this.storyHeroMode = false;
    this.introStepsLeft = 0;
    this.heat.clear();
  }

  /** Silence playback but remember the song (music toggled off, autoplay blocked). */
  halt(keepNativeHandle = false) {
    this.clearSlowMo();
    if (this.useNative && !keepNativeHandle) nativeBridge.haltMusic();
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stopIntervalTrack?.();
    this.stopIntervalTrack = null;
    this.arr = null;
    this.pending = null;
    ambience.sync();
  }

  private clearSlowMo() {
    if (this.slowMoTimer) clearTimeout(this.slowMoTimer);
    this.slowMoTimer = null;
    this.slowMo = 1;
  }

  private snapEnv(m: Mix) {
    this.env = {
      intensity: m.intensity,
      lead: m.lead ? m.leadGain : 0,
      arp: m.arp ? 1 : 0,
      counter: m.counter ? 1 : 0,
      drums: m.drums,
    };
  }

  /** Asymmetric per-step envelope easing: crisp swell up (~0.4s), gentle multi-bar fade down (~4s). */
  private easeEnv(cur: number, target: number, up = 0.22, down = 0.032): number {
    const k = target >= cur ? up : down;
    const next = cur + (target - cur) * k;
    return Math.abs(target - next) < 0.004 ? target : next;
  }

  private setArrangement(name: string) {
    this.arr = ARRANGEMENTS[name] ?? ARRANGEMENTS.map;
    this.arrName = ARRANGEMENTS[name] ? name : 'map';
  }

  /** One 32nd note right now, in ms: the grid every cue lands on. The effects on screen step to the same grid. */
  get gridMs(): number {
    const running = this.timer !== null || this.clockOverride !== null;
    return ((running && this.bpm ? this.stepDur() : 60 / 120 / 4) / 2) * 1000;
  }

  private stepDur(): number {
    return 60 / (this.bpm || 120) / 4;
  }

  private schedule() {
    if (!chip.ctx || !this.arr) return;
    if (chip.liveContext && chip.ctx === chip.liveContext && (!getIsAppActive() || chip.liveContext.state !== 'running')) {
      return;
    }
    // If the tab was backgrounded, don't try to catch up a pile of notes
    if (this.nextTime < chip.now - 0.2) this.nextTime = chip.now + 0.05;
    while (this.nextTime < chip.now + 0.12) this.advance();
  }

  private advance() {
    if (!this.arr) return;
    if (this.introStepsLeft > 0) {
      const target = this.arr.bpm * this.mix.tempo;
      if (!this.bpm) this.bpm = target;
      const introIdx = INTRO_PICKUP.length - this.introStepsLeft;
      this.playIntroPickupStep(this.arr, introIdx, this.nextTime);
      this.nextTime += this.stepDur();
      this.introStepsLeft -= 1;
      return;
    }
    if (this.step % 16 === 0 && this.pending) {
      this.setArrangement(this.pending);
      this.pending = null;
    }
    // Asymmetric tempo easing: builds momentum crisply on streaks, relaxes imperceptibly over ~3 bars when cooling down;
    // during an Expedition 33 slow-mo knockout, drags tempo sharply down like a tape-stop time dilation.
    const slow = this.slowMo < 0.99;
    const target = this.arr.bpm * this.mix.tempo * this.slowMo;
    if (!this.bpm) this.bpm = target;
    else this.bpm += (target - this.bpm) * (slow ? 0.28 : target >= this.bpm ? 0.1 : 0.025);

    // Smooth per-layer envelopes so idle/streak-end fades out gradually instead of snapping layers off
    const targetLead = this.mix.lead ? this.mix.leadGain : 0;
    this.env.intensity = this.easeEnv(this.env.intensity, this.mix.intensity);
    this.env.lead = this.easeEnv(this.env.lead, targetLead, 0.25, 0.035);
    this.env.arp = this.easeEnv(this.env.arp, this.mix.arp ? 1 : 0, 0.22, 0.03);
    this.env.counter = this.easeEnv(this.env.counter, this.mix.counter ? 1 : 0, 0.2, 0.028);
    // Pause/freeze cuts drums promptly; cooling down from a streak or idle eases them back gradually
    const drumDown = this.mix.drums === 0 ? 0.35 : 0.03;
    this.env.drums = this.easeEnv(this.env.drums, this.mix.drums, 0.22, drumDown);

    this.playStep(this.arr, this.step, this.nextTime);
    this.nextTime += this.stepDur();
    this.step += 1;
  }

  /** Crisp 1-bar INTRO_PICKUP launching fresh battle entries straight into Bar 0 ([AU-17]). */
  private playIntroPickupStep(a: Arrangement, s16: number, t: number) {
    const sd = this.stepDur();
    const { mode, key } = this.tone();
    const leadMode = this.mix.leadMode;
    const tok = INTRO_PICKUP[s16];
    const lead = tok && tok !== '-' && tok !== '.' ? parseNote(tok) : null;
    if (lead) {
      let len = 1;
      while (INTRO_PICKUP[s16 + len] === '-' && s16 + len < 16) len++;
      const semis = a.leadOctave / 12;
      const freq = foldFreq(degreeToFreq(leadMode, key, lead.degree, lead.octave + semis), 2600);
      chip.tone({ voice: 'pulse1', freq, at: t, dur: sd * len * 0.92, vol: a.leadVol * 0.9, duty: a.leadDuty });
    }
    if (s16 === 4 || s16 === 12) {
      const bassF = foldFreq(degreeToFreq(mode, key, 4, a.bassOctave), 2600);
      chip.tone({ voice: 'wave', freq: bassF, at: t, dur: sd * 2.5, vol: 0.5, decay: 0.5 });
    }
    if (s16 === 8 || s16 === 10 || s16 >= 12) {
      drum(s16 >= 12 ? 'snare' : 'tom', t, 0.45 + (s16 - 8) * 0.07);
    }
  }

  // ─── The fight ────────────────────────────────────────────────────────────

  /** Start following a fight. Plays a crisp 1-bar INTRO_PICKUP once before Bar 0 ([AU-17]). */
  enterFight(mood: FightMood) {
    this.mood = null;
    this.heat.clear();
    this.turn = 0;
    this.step = 0;
    this.introStepsLeft = ARRANGEMENTS[mood.arrangement]?.style === 'battle' ? INTRO_PICKUP.length : 0;
    this.setMood(mood);
    this.play(mood.arrangement);
  }

  /** Stop following the fight (results, quitting): the band goes back to a resting mix. */
  leaveFight() {
    this.clearSlowMo();
    this.mood = null;
    this.introStepsLeft = 0;
    this.heat.clear();
    this.mix = restingMix(this.current ?? 'map');
    this.applied = { filterHz: -1, level: -1, echo: -1 };
    this.applyMixToChip(0.6);
  }

  setMood(mood: FightMood) {
    const prev = this.mood;
    this.mood = mood;
    this.mix = direct(mood, id => themeOf(id));
    if (!prev) this.snapEnv(this.mix);
    // Cooling down (idle/streak drop) glides gently over 1.8s; waking up or pausing responds promptly
    const cooling = !mood.paused && this.applied.filterHz > 0 && (this.mix.filterHz < this.applied.filterHz || this.mix.level < this.applied.level);
    this.applyMixToChip(cooling ? 1.8 : 0.35);
    if (!prev) return;
    // [AU-13]: Do NOT fire evolve() or reelStop prematurely during React render in setMood();
    // EvolutionCutIn calls band.playCutInEvolve(id) and WeaponPick calls band.playWeaponPickReelStop() on mount!
    for (const id of prev.evolutions) if (!mood.evolutions.includes(id)) this.devolve();
    if (prev.combo >= 3 && mood.combo === 0 && mood.status === 'playing') this.cue('streakLost');
  }

  /** The mix the band is following right now (the sound studio shows it). */
  get currentMix(): Mix {
    return this.mix;
  }

  private applied = { filterHz: -1, level: -1, echo: -1 };
  private applyMixToChip(glide: number) {
    if (this.useNative) {
      nativeBridge.setMusicLevel(this.mix.level);
      return;
    }
    const a = this.applied;
    const echo = Math.round(this.stepDur() * 300) / 100;
    if (a.filterHz !== this.mix.filterHz) chip.setMusicFilter(this.mix.filterHz, glide);
    if (a.level !== this.mix.level) chip.setMusicLevel(this.mix.level, glide);
    if (a.echo !== echo) chip.setEchoTime(echo);
    this.applied = { filterHz: this.mix.filterHz, level: this.mix.level, echo };
  }

  /** A weapon fired: play its Tier B sting and bring its riff forward for the next bars. */
  fire(weaponId: string, slot = 0, afterMs = 0) {
    this.heat.set(weaponId, Math.min(1, (this.heat.get(weaponId) ?? 0) + 0.5));
    if (this.useNative) {
      if (audioFlags.sfx) nativeBridge.fireWeapon(weaponId, slot, afterMs);
      return;
    }
    const c = this.cueCtx(slot, false, afterMs, 'B');
    if (!c) return;
    logCue(`sting:${weaponId}`, c.t, this.now);
    const v = weaponVoice(weaponId);
    this.playSting(v, c, 1);
  }

  /** How loud each held weapon's riff is right now, 0..1 (the sound studio draws it). */
  heatOf(weaponId: string): number {
    return this.heat.get(weaponId) ?? 0;
  }
  get spotlight(): readonly string[] {
    return this.spot;
  }

  private playSting(v: WeaponVoice, c: CueCtx, vol: number) {
    const octave = Math.min(6, v.octave + (v.octave <= 3 ? 1 : 0));
    // [AU-04]: Weapon stings live in Tier B (0.55 voice / 0.48 drum) so they accent without masking Tier S/A impacts
    stingOf(v).forEach((s, i) =>
      note(v.inst, foldFreq(degreeToFreq(c.mode, c.key, c.root + s, octave), 2600), c.t + i * c.g, c.g * 3, {
        vol: 0.55 * vol,
        pan: v.pan,
        bus: SFX,
        tier: 'B',
      })
    );
    if (v.drum) drum(v.drum, c.t, 0.48 * vol, SFX, v.pan, false, 'B');
  }

  /**
   * Play a fighter's short (60-130 ms) scale-locked Tier B signature voice ([AU-07]).
   * Enforces a 1.8 s per-fighter cooldown so rapid chains never spam vocal cues.
   */
  fighterCall(fighter: string, kind: FighterCallKind = 'signature', opts: { bypassCooldown?: boolean } = {}): boolean {
    if (!audioFlags.sfx) return false;
    if (this.useNative) {
      const nowMs = Date.now();
      const prevMs = this.lastFighterCallAt.get(fighter) ?? -Infinity;
      if (!opts.bypassCooldown && nowMs - prevMs < FIGHTER_CALL_COOLDOWN_MS) return false;
      this.lastFighterCallAt.set(fighter, nowMs);
      nativeBridge.fighterCall(fighter, kind);
      return true;
    }
    const c = this.cueCtx(0, true, 0, 'B');
    if (!c) return false;
    const prevSec = this.lastFighterCallAt.get(fighter) ?? -Infinity;
    if (!opts.bypassCooldown && c.t - prevSec < FIGHTER_CALL_COOLDOWN_MS / 1000) return false;
    const played = playFighterVoice(fighter, kind, c);
    if (played) {
      this.lastFighterCallAt.set(fighter, c.t);
      logCue(`fighter:${fighter}:${kind}`, c.t, this.now);
    }
    return played;
  }

  // ─── One 16th note of the score ───────────────────────────────────────────

  private tone(): { mode: ModeName; leadMode: ModeName; key: number } {
    // A lift that would push the tune too high comes back down an octave: still a new key, never shrill
    const key = worldTone(this.arrName).key + this.mix.lift;
    const mode: ModeName = this.arrName === 'story' && this.storyHeroMode && !this.mood ? 'ionian' : this.mix.mode;
    const leadMode: ModeName = this.arrName === 'story' && this.storyHeroMode && !this.mood ? 'ionian' : this.mix.leadMode;
    return { mode, leadMode, key: key > 7 ? key - 12 : key };
  }

  private playStep(a: Arrangement, step: number, t: number) {
    const mix = this.mix;
    const sd = this.stepDur();
    const bar = Math.floor(step / 16);
    const s16 = step % 16;
    const { mode, leadMode, key } = this.tone();
    const root = chordRoot(mode, bar);
    // During slow-mo knockout, pitch-bend the music bed downward (~3.5 semitones) as time dilates
    const pitchScale = this.slowMo < 0.99 ? 0.72 + 0.28 * this.slowMo : 1;
    const f = (degree: number, octave: number, m: ModeName = mode) =>
      foldFreq(degreeToFreq(m, key, degree, octave) * pitchScale, 2600);
    const evo = mix.evolutions.length > 0 ? themeOf(mix.evolutions[0]) : null;
    const flicker = mix.evolutionFading && s16 % 8 >= 4;

    if (s16 === 0) this.startBar(bar);

    // Lead: 16-bar A-B form ([AU-17]); canonical Ionian signature hook preserved across bright/neutral worlds ([AU-19])
    const inB = Boolean(a.useB && bar % 16 >= 8);
    const bSection = a.sectionB === 'battle' ? THEME_BATTLE_B : THEME_B;
    const section = inB ? bSection : THEME;
    const idx = (bar % 8) * 16 + s16;
    const tok = section[idx];
    const lead = tok && tok !== '-' && tok !== '.' ? parseNote(tok) : null;
    const leadEnv = this.env.lead;
    const colourEnv = Math.max(0, Math.min(1, (this.env.intensity - 0.38) / 0.22));
    if (lead && leadEnv > 0.04) {
      let len = 1;
      while (section[idx + len] === '-' && s16 + len < 16) len++;
      const dur = sd * len * 0.95;
      const semis = a.leadOctave / 12;
      // Preserve opening 2-bar signature hook purely in `leadMode` (Ionian on bright/neutral worlds);
      // on bars 2-7 / B-section, conform only an altered modal chord tone (lydian #4 on bar 2, mixolydian b7 on bar 3)
      // to `mode` so the chord and melody never clash by a semitone.
      const isHookBar = !inB && bar % 8 < 2;
      const barInLoop = bar % 4;
      const needsChordToneConform =
        !isHookBar &&
        leadMode === 'ionian' &&
        ((mode === 'lydian' && barInLoop === 2 && lead.degree === 3) ||
          (mode === 'mixolydian' && barInLoop === 3 && lead.degree === 6));
      const activeLeadMode = needsChordToneConform ? mode : leadMode;
      const freq = f(lead.degree, lead.octave + semis, activeLeadMode);

      if (mix.lounge || a.style === 'camp') {
        note('vibes', freq, t, dur, { vol: 0.9 * leadEnv });
      } else if (a.style === 'title') {
        note('kalimba', freq, t, dur, { vol: 0.85 * leadEnv });
        if (s16 % 4 === 0) note('vibes', foldFreq(freq * 0.5, 2600), t, dur * 1.4, { vol: 0.36 * leadEnv, soft: true });
      } else if (a.style === 'story') {
        note('celesta', freq, t, dur * 1.15, { vol: 0.72 * leadEnv });
        note('strings', foldFreq(freq * 0.5, 2600), t, dur * 1.3, { vol: 0.45 * leadEnv, soft: true });
      } else {
        chip.tone({ voice: 'pulse1', freq, at: t, dur, vol: a.leadVol * leadEnv, duty: a.leadDuty, vibrato: len > 2 ? a.leadVibrato : 0 });
        // [AU-14]: avoid pushing high-register leads (e.g. peaks leadOctave: 12) up into D8 shrieks
        const colourMult = this.arrName === 'boss' ? 0.5 : freq > 1300 ? 1 : 2;
        if (colourEnv > 0.05) {
          note(WORLD_COLOUR[this.arrName] ?? 'glock', foldFreq(freq * colourMult, 2600), t, dur, { vol: 0.45 * colourEnv * leadEnv, soft: true });
          // [AU-18]: Summit layers heroic brass doubling alongside celesta at high intensity
          if (this.arrName === 'summit' && colourEnv > 0.55) {
            note('brass', foldFreq(freq * 0.5, 2600), t, dur, { vol: 0.34 * colourEnv * leadEnv, soft: true });
          }
        }
        if (this.env.counter > 0.05) {
          note('flute', f(lead.degree - 2, lead.octave + semis, mode), t, dur, { vol: 0.5 * this.env.counter * leadEnv, pan: -0.3, soft: true });
        }
      }
    }

    // Bass
    const b = mix.lounge ? 'R..5..8.R..5.3..'[s16] : a.bass[s16];
    const subEnv = Math.max(0, Math.min(1, (this.env.intensity - 0.48) / 0.2));
    if (b && b !== '-' && b !== '.' && !mix.frozen) {
      let len = 1;
      while (!mix.lounge && a.bass[s16 + len] === '-') len++;
      const freq = f(root + (BASS_STEP[b] ?? 0), a.bassOctave);
      if (a.style === 'camp') {
        note('pizz', freq, t, sd * len * 0.9, { vol: 0.65, soft: true });
      } else if (a.style === 'title' || a.style === 'story') {
        note('strings', freq, t, sd * len * 0.95, { vol: 0.5, soft: true });
      } else {
        chip.tone({ voice: 'wave', freq, at: t, dur: sd * len * 0.9, vol: 0.55, decay: 0.5 });
        if (subEnv > 0.05 && b === 'R') note('sub', freq / (freq > 90 ? 2 : 1), t, sd * 1.5, { vol: 0.5 * subEnv, soft: true });
      }
    }

    // Story low timpani swell on phrase downbeats ([AU-20])
    if (a.style === 'story' && s16 === 0 && bar % 4 === 0 && !mix.frozen) {
      drum('timpani', t, 0.52, 'music', 0, true);
    }

    // Camp gentle harp roll ([AU-20])
    if (a.style === 'camp' && s16 % 4 === 0 && !mix.frozen) {
      const harpStep = [0, 2, 4, 7][(s16 / 4) % 4];
      note('harp', f(root + harpStep, 4), t, sd * 3.5, { vol: 0.42, pan: s16 % 8 === 0 ? -0.3 : 0.3, soft: true });
    }

    // Arpeggio
    const arpGain = a.arp ? Math.max(0.45, this.env.arp) : this.env.arp;
    if (arpGain > 0.05 && s16 % 2 === 0 && !mix.frozen) {
      const tones = [0, 2, 4, 7];
      chip.tone({ voice: 'pulse2', freq: f(root + tones[(s16 / 2) % 4], 4), at: t, dur: sd * 0.8, vol: 0.18 * arpGain, duty: a.arpDuty, decay: 0.8, soft: true });
    }

    // Pad: the chord, held
    if (mix.pad && s16 === 0) {
      for (const d of [0, 2, 4]) note('strings', f(root + d, 3), t, sd * 15.5, { vol: mix.frozen ? 1.2 : 0.8, pan: d === 2 ? 0.3 : d === 4 ? -0.3 : 0, soft: true });
    }
    if (mix.frozen && s16 % 4 === 0) note('glass', f(root + [0, 4, 7, 9][(s16 / 4) % 4], 5), t, sd * 4, { vol: 0.7 });

    // Drums
    this.playDrums(a, s16, bar, t, evo && !flicker ? GROOVES[evo.groove] : null);

    // What the fight is telling you (alerts capped to top 2 threats by director.ts [AU-05])
    if (mix.heartbeat && (s16 === 0 || s16 === 3 || s16 === 8 || s16 === 11)) drum('thud', t, s16 % 8 === 0 ? 0.9 : 0.55);
    if (mix.clock === 1 && s16 % 4 === 0) drum(s16 % 8 === 0 ? 'woodblock' : 'woodblockLo', t, 0.7);
    if (mix.clock === 2 && s16 % 2 === 0) drum(s16 % 4 === 0 ? 'woodblock' : 'woodblockLo', t, 0.9);
    if (mix.finisher) {
      if (s16 === 0) drum('timpani', t, 0.8);
      if (bar % 2 === 1 && s16 >= 8) drum('snare', t, 0.25 + ((s16 - 8) / 8) * 0.55);
    }
    const al = mix.alerts;
    if (al.cursed > 0 && s16 === 0) chip.play(INSTRUMENTS.choir, { freq: f(root, 2) * 1.0595, at: t, dur: sd * 14, vol: 0.5, soft: true });
    if (al.potatoSoon && s16 % 2 === 0) drum('cowbell', t, 0.45, 'music', 0.5);
    // [AU-05]: 8th-note shaker cadence (down from every 16th at 0.7) to prevent high-freq clutter
    if (al.fuseHot > 0 && s16 % 2 === 0) drum('shaker', t, 0.42, 'music', -0.5, true);
    if (al.thornSoon && s16 % 4 === 3) drum('rim', t, 0.8, 'music', 0.4);
    // [AU-05]: Fold glassLow down to octave 5 (<= 2,600 Hz)
    if (al.glassLow && (s16 === 6 || s16 === 14)) note('glass', f(7, 5), t, sd * 2, { vol: 0.6, soft: true });
    if (al.bombSoon && s16 % 4 === 0) drum('tick', t, 1);

    // Your build: weapon riffs taking turns
    for (const id of this.spot) this.playRiff(weaponVoice(id), s16, t, sd, root, mode, key, RIFF_VOL + RIFF_HEAT * (this.heat.get(id) ?? 0), 0);

    // An evolution: the weapon's own riff an octave up with its variant harmonic companion & groove shimmer
    if (evo && !flicker) {
      const leadVoice = weaponVoice(evo.weaponId);
      this.playRiff(leadVoice, s16, t, sd, root, mode, key, RIFF_VOL + RIFF_HEAT, 1, evo.insts[1]);
      if (evo.variantIndex === 0) {
        // Variant 0 (Core / Kinetic): bright octave glockenspiel shimmer + heroic brass backbeat
        if (s16 % 2 === 0) note('glock', f(root + [0, 2, 4, 7, 9, 7, 4, 2][(s16 / 2) % 8], 6), t, sd, { vol: 0.38, pan: s16 % 4 ? 0.5 : -0.5, soft: true });
        if (s16 % 4 === 2) for (const d of [0, 4, 7]) note('brass', f(root + d, 4), t, sd * 0.9, { vol: 0.42, soft: true });
      } else if (evo.variantIndex === 1) {
        // Variant 1 (Tactical / Tempo): off-beat perfect-fifth counter-melody weaving against the lead
        if (s16 % 2 === 1) note(evo.insts[1], f(root + [4, 7, 9, 11, 9, 7, 4, 2][Math.floor(s16 / 2) % 8], 5), t, sd * 1.4, { vol: 0.4, pan: -leadVoice.pan, soft: true });
        if (s16 % 4 === 0) note('harp', f(root + (s16 % 8 === 0 ? 4 : 7), 4), t, sd * 1.8, { vol: 0.36, pan: leadVoice.pan, soft: true });
      } else {
        // Variant 2 (Wild / Escalation): rapid triad arpeggio climb + driving synth chord stab
        if (s16 % 2 === 0) note(evo.insts[1], f(root + [0, 4, 7, 11, 7, 4, 9, 14][(s16 / 2) % 8], 5), t, sd * 0.95, { vol: 0.42, pan: s16 % 4 ? -0.55 : 0.55, soft: true });
        if (s16 % 4 === 2) for (const d of [0, 2, 4]) note('saw', f(root + d, 4), t, sd * 0.9, { vol: 0.45, soft: true });
      }
    }
  }

  private playRiff(v: WeaponVoice, s16: number, t: number, sd: number, root: number, mode: ModeName, key: number, vol: number, up: number, double?: InstrumentId) {
    const c = v.riff[s16];
    if (c >= '0' && c <= '9') {
      let len = 1;
      while (s16 + len < 16 && v.riff[s16 + len] === '-') len++;
      const freq = foldFreq(degreeToFreq(mode, key, root + (c.charCodeAt(0) - 48), Math.min(6, v.octave + up)), 2600);
      note(v.inst, freq, t, sd * len * 0.92, { vol, pan: v.pan, soft: true });
      if (double) note(double, freq, t, sd * len * 0.92, { vol: vol * 0.55, pan: -v.pan, soft: true });
    }
    const d = v.beat?.[s16];
    if (d === 'x' && v.drum) drum(v.drum, t, vol * 0.75, 'music', v.pan, true);
    if (d === 'o' && v.drum2) drum(v.drum2, t, vol * 0.75, 'music', v.pan, true);
  }

  private playDrums(a: Arrangement, s16: number, bar: number, t: number, groove: string | null) {
    const lvl = this.env.drums;
    if (lvl <= 0.08) return;
    if (a.style === 'camp' && !groove) {
      // Cozy camp uses only a soft brushed shaker
      if (a.drums[s16] === 'h') drum('shaker', t, 0.45 * Math.min(1, lvl), 'music', 0.2, true);
      return;
    }
    const d = groove ? groove[s16] : this.mix.lounge ? LOUNGE_DRUMS[s16] : a.drums[s16];
    // Smooth blends across drum tiers: 0→1 basic groove, 1→2 full hats/snare, 2→3 driving claps & off-beat hats
    const base = Math.min(1, lvl);
    const full = Math.max(0, Math.min(1, lvl - 1));
    const drive = Math.max(0, Math.min(1, lvl - 2));
    if (d === 'k') drum('kick', t, base * (0.7 + 0.3 * full));
    if (d === 's') {
      drum('snare', t, base * (0.5 + 0.4 * full));
      if (drive > 0.06) drum('clap', t, 0.5 * drive);
    }
    if (d === 'c') drum('clap', t, 0.8 * base);
    if (d === 'h' && (full > 0.06 || this.mix.lounge)) drum(this.mix.lounge ? 'ride' : 'hat', t, 0.9 * (this.mix.lounge ? base : full));
    if (d === 'o' && full > 0.06) drum('openHat', t, 0.9 * full);
    if (drive > 0.06 && s16 % 2 === 1 && d !== 'h') drum('hat', t, 0.45 * drive, 'music', 0.3, true);
    // A tom fill hands every fourth bar over to the next one
    if (full > 0.25 && !groove && bar % 4 === 3 && s16 >= 12) drum('tom', t, (0.5 + (s16 - 12) * 0.1) * full, 'music', (s16 - 13.5) * 0.3);
    if (full > 0.25 && bar % 8 === 0 && s16 === 0 && bar > 0) drum('crash', t, 0.45 * full);
  }

  /** Bar line: pick which weapons take this bar, and let old excitement fade. */
  private startBar(bar: number) {
    const held = this.mix.weapons.filter((id, i, all) => all.indexOf(id) === i);
    const evoWeapons: readonly string[] = this.mix.evolutions.length > 0 ? themeOf(this.mix.evolutions[0]).weapons : [];
    const free = held.filter(id => !evoWeapons.includes(id));
    const want = Math.min(this.mix.spotlights, free.length);
    const hot = free.filter(id => (this.heat.get(id) ?? 0) > 0.25).sort((x, y) => (this.heat.get(y) ?? 0) - (this.heat.get(x) ?? 0));
    const spot = hot.slice(0, want);
    // Everyone else takes turns, so you hear your whole build over a few bars
    for (let i = 0; spot.length < want && i < free.length; i++) {
      const id = free[(this.turn + i) % free.length];
      if (!spot.includes(id)) spot.push(id);
    }
    if (bar % 2 === 1) this.turn += 1;
    this.spot = spot;
    for (const [id, h] of this.heat) this.heat.set(id, h < 0.05 ? 0 : h * 0.72);
  }

  // ─── Cues ─────────────────────────────────────────────────────────────────

  /** When and in what harmony the next cue lands; null when effects are off or there is no audio. */
  private cueCtx(slot = 0, immediate = false, afterMs = 0, tier: SfxTier = 'B'): CueCtx | null {
    if (!audioFlags.sfx) return null;
    if (!chip.ensure()) return null;
    const { mode, key } = this.tone();
    const running = this.timer !== null || this.clockOverride !== null;
    const sd = running && this.bpm ? this.stepDur() : 60 / 120 / 4;
    const g = sd / 2;
    // [AU-11]: 4 ms lookahead for immediate cues (down from 12 ms), 12 ms for rhythmic grid cascades
    const earliest = this.now + (immediate ? 0.004 : 0.012);
    // Inside a stretch of beats (`stretch`), every non-immediate cue counts from the note its pictures land on
    const t0 = !immediate && this.stretchT0 !== null ? this.stretchT0 : running && !immediate ? nextGridTime(earliest, this.nextTime, g) : earliest;
    const t = t0 + slot * g + Math.max(0, afterMs) / 1000;
    const stepAt = running ? this.step + Math.floor((t - this.nextTime) / sd + 1e-6) : 0;
    return { t, g, mode, key, root: running ? chordRoot(mode, Math.floor(stepAt / 16)) : 0, amount: 0, slot, tier };
  }

  private stretchT0: number | null = null;

  /**
   * A stretch of a fight's cascade. Every cue played inside `fn` counts its slot
   * from one note, the band's next 32nd, so the whole chain keeps its spacing.
   * Returns how long until that note (ms): the stage starts its picture that much
   * later, so each sound lands on the frame its picture does. Null when there is
   * no sound to wait for.
   */
  stretch(fn: () => void): number | null {
    if (!audioFlags.sfx || !chip.ensure()) {
      fn();
      return null;
    }
    const running = this.timer !== null || this.clockOverride !== null;
    const g = (running && this.bpm ? this.stepDur() : 60 / 120 / 4) / 2;
    const now = this.now;
    const earliest = now + 0.012;
    // [FX-23]: Subdivide to 64th-note grid when a 32nd exceeds 32 ms and cap slip t0 - now <= 0.032 s
    const snap = g > 0.032 ? g / 2 : g;
    const snapped = running ? nextGridTime(earliest, this.nextTime, snap) : earliest;
    const t0 = Math.min(snapped, now + 0.032);
    this.stretchT0 = t0;
    try {
      fn();
    } finally {
      this.stretchT0 = null;
    }
    return (t0 - now) * 1000;
  }

  /** A card was tapped: dry Tier C root/third/fifth of the current chord ([AU-04], [AU-10]). */
  select(count: number) {
    if (this.useNative) {
      if (audioFlags.sfx) nativeBridge.select(count);
      return;
    }
    const c = this.cueCtx(0, true, 0, 'C');
    if (!c) return;
    const i = Math.max(0, Math.min(2, count - 1));
    note('kalimba', foldFreq(degreeToFreq(c.mode, c.key, c.root + i * 2, 5), 2600), c.t, 0.14, { vol: 0.45, bus: SFX, tier: 'C', space: 'dry' });
    drum('tick', c.t, 0.22, SFX, undefined, false, 'C', 'dry');
  }

  deselect() {
    if (this.useNative) {
      if (audioFlags.sfx) nativeBridge.deselect();
      return;
    }
    const c = this.cueCtx(0, true, 0, 'C');
    if (!c) return;
    note('kalimba', foldFreq(degreeToFreq(c.mode, c.key, c.root, 4), 2600), c.t, 0.12, { vol: 0.35, bus: SFX, tier: 'C', space: 'dry' });
  }

  /**
   * A Set landed (Tier A, monotonic T0..T3 gain, <=18 voices even on MEGA+Rainbow).
   * Opens with dry <2 ms impactCrack + tight 38-58 ms impactPunch finishing inside
   * hitstop, then blooms into tucked musical chimes & fast-attack brassStab ([AU-04], [AU-08], [AU-09]).
   */
  payout(o: { combo: number; tier: number; rainbow?: boolean; afterMs?: number }) {
    if (this.useNative) {
      if (audioFlags.sfx) nativeBridge.payout(o);
      return;
    }
    const tier = Math.max(0, Math.min(3, Math.round(o.tier)));
    const c = this.cueCtx(0, false, o.afterMs, 'A');
    if (!c) return;
    logCue('payout', c.t, this.now);
    const scale = PAYOUT_TIER_GAIN[tier];
    const f = (degree: number, octave: number) => foldFreq(degreeToFreq(c.mode, c.key, degree, octave), 2600);
    const N = (inst: InstrumentId, degree: number, octave: number, dt: number, dur: number, vol = 1, pan?: number) =>
      note(inst, f(degree, octave), c.t + dt, dur, { vol: vol * scale, pan, bus: SFX, tier: 'A', space: 'sfxRoom' });

    // Layer 1: dry <2 ms impact crack + hitstop-bounded punch body (3 voices)
    const punchDurMs = [38, 46, 52, 58][tier];
    drum('impactCrack', c.t, scale, SFX, undefined, false, 'A', 'dry');
    impactPunch(c.t, scale, { durMs: punchDurMs, bus: SFX, tier: 'A' });

    // Layer 2: tucked musical reward chime (4-6 dB behind the dry transient so impact hits first)
    const harpChord = o.rainbow ? [c.root, c.root + 4] : [c.root, c.root + 2, c.root + 4];
    harpChord.forEach((d, i) => N('harp', d, 4, 0.008 + i * c.g * 0.45, 0.32, 0.46));

    const rung = ladderRung(o.combo);
    N('bell', ladderDegree(c.mode, rung), 5, 0.006, 0.45, 0.62);
    if (o.combo >= 3 && !o.rainbow) {
      N('glock', ladderDegree(c.mode, rung + 2), 5, c.g, 0.28, 0.48);
    }
    if (o.combo >= 5 && !o.rainbow && tier < 3) {
      [1, 3].forEach((step, idx) =>
        N('glock', ladderDegree(c.mode, rung + step), 6, (idx + 1.5) * c.g, 0.22, 0.42, idx % 2 ? 0.5 : -0.5)
      );
    }
    if (o.combo >= 8 && tier < 2) {
      drum('crash', c.t, 0.42 * scale, SFX, undefined, false, 'A', 'sfxRoom');
    }

    // Layer 3: fast 5 ms brassStab & sub/duck escalation by tier
    if (tier === 1) {
      for (const d of [0, 4]) N('brassStab', c.root + d, 3, 0, c.g * 3, 0.85);
      chip.duck(0.25, c.t, 0.3);
      chip.duckSfx(0.28, c.t, 0.25);
    } else if (tier === 2) {
      this.lastHeavyPayoutAt = c.t;
      subDrop(c.t, 0.72 * scale, SFX, 'A');
      drum('crash', c.t, 0.52 * scale, SFX, undefined, false, 'A', 'sfxRoom');
      for (const d of [0, 4]) N('brassStab', c.root + d, 3, 0, c.g * 3.5, 0.92);
      chip.duck(0.45, c.t, 0.6);
      chip.duckSfx(0.37, c.t, 0.45);
    } else if (tier >= 3) {
      this.lastHeavyPayoutAt = c.t;
      subDrop(c.t, 0.9 * scale, SFX, 'A');
      drum('crash', c.t, 0.62 * scale, SFX, undefined, false, 'A', 'sfxRoom');
      for (const d of [0, 2, 4]) N('brassStab', c.root + d, 3, 0, c.g * 6, 0.92);
      for (const d of [0, 4]) N('strings', c.root + d, 4, 0.015, c.g * 8, 0.65);
      if (!o.rainbow) {
        [6, 4, 2].forEach((offset, idx) =>
          N('glock', ladderDegree(c.mode, rung + offset), 6, (idx + 1.5) * c.g, 0.26, 0.52, idx % 2 ? 0.55 : -0.55)
        );
      }
      chip.duck(0.65, c.t, 0.95);
      chip.duckSfx(0.45, c.t, 0.65);
    }

    // Compact 4-voice Rainbow shimmer (keeps MEGA + Rainbow strictly <= 18 total voices)
    if (o.rainbow) {
      [0, 4, 7].forEach((d, i) =>
        note('glock', f(c.root + d, 5), c.t + (i + 1) * c.g * 0.6, 0.28, {
          vol: 0.58 * scale,
          bus: SFX,
          tier: 'A',
          space: 'sfxRoom',
          pan: -0.6 + i * 0.6,
        })
      );
      chip.noise({ at: c.t, dur: 0.34, vol: 0.22 * scale, short: true, filter: 5000, sweepTo: 9800, bus: SFX, tier: 'A', space: 'sfxRoom' });
    }
  }

  /** Play a named cue (immediate for all 24 IMMEDIATE_CUES, 32nd-note grid for rhythmic cascades). */
  cue(name: CueName, o: CueOpts = {}) {
    if (this.useNative) {
      if (audioFlags.sfx) nativeBridge.cue(name, o);
      return;
    }
    const immediate = IMMEDIATE_CUES.has(name);
    const tier = CUE_TIER[name];
    const c = this.cueCtx(o.slot ?? 0, immediate, o.afterMs, tier);
    if (!c) return;
    // [AU-11]: Key multStep dedupe by step amount with 10 ms floor so rapid Balatro tallies never drop;
    // rate-limit Tier C evoProgress to at most one crisp pip per Set burst (80 ms window)
    const dedupeKey = name === 'multStep' ? `${name}:${Math.round(o.amount ?? 0)}` : name;
    const dedupeWindow = name === 'multStep' ? 0.01 : name === 'evoProgress' ? 0.08 : 0.02;
    const last = this.lastCueAt[dedupeKey];
    if (last !== undefined && Math.abs(c.t - last) < dedupeWindow && name !== 'reelStop' && name !== 'starSwoosh') return;
    this.lastCueAt[dedupeKey] = c.t;
    logCue(name, c.t, this.now);
    c.amount = o.amount ?? 0;
    if (name === 'multSlam') {
      c.suppressSlamSub = Math.abs(c.t - this.lastHeavyPayoutAt) < 0.12;
    }
    this.run(CUES[name], c);
  }

  private run(fn: (c: CueCtx) => void, c: CueCtx) {
    fn(c);
  }

  /**
   * An evolution begins (Tier S): a riser into the weapon evolution's own fanfare.
   * Pass `{ immediate: true, leadMs: 90 }` from EvolutionCutIn mount so the riser fills
   * 0-90 ms and crash + subDrop + weapon-anchored fanfare hit the exact 90 ms slash-flash frame ([AU-13]).
   */
  evolve(evoId: string, opts: { immediate?: boolean; leadMs?: number } = {}) {
    if (this.useNative) {
      if (audioFlags.sfx) nativeBridge.evolve();
      return;
    }
    const c = this.cueCtx(0, Boolean(opts.immediate), 0, 'S');
    if (!c) return;
    const theme = themeOf(evoId);
    const lead = opts.leadMs !== undefined ? Math.max(0, opts.leadMs) / 1000 : c.g * 4;
    if (lead > 0.015) {
      riser(c.t, lead, 0.8, SFX, 'S');
      const rollSteps = Math.max(2, Math.min(4, Math.round(lead / Math.max(0.022, c.g))));
      for (let i = 0; i < rollSteps; i++) {
        drum('snare', c.t + (i * lead) / rollSteps, 0.4 + i * 0.15, SFX, undefined, false, 'S');
      }
    }
    const t = c.t + lead;
    drum('impactCrack', t, 0.95, SFX, undefined, false, 'S', 'dry');
    drum('crash', t, 0.9, SFX, undefined, false, 'S', 'sfxRoom');
    subDrop(t, 0.82, SFX, 'S');
    chip.duck(0.55, t, 0.8);
    chip.duckSfx(0.65, t, 0.65);
    const key = c.key + theme.lift;
    theme.fanfare.forEach((s, i) => {
      const last = i === theme.fanfare.length - 1;
      const freq = foldFreq(degreeToFreq(c.mode, key, s, 4), 2600);
      const dur = last ? c.g * 12 : c.g * 2.4;
      note(theme.insts[i < theme.fanfare.length / 2 ? 0 : 1], freq, t + i * c.g * 2, dur, {
        vol: 1.0,
        bus: SFX,
        tier: 'S',
        space: last ? 'hall' : 'sfxRoom',
        pan: i % 2 ? 0.3 : -0.3,
      });
      note('brass', freq, t + i * c.g * 2, dur, { vol: 0.72, bus: SFX, tier: 'S', space: 'sfxRoom' });
      if (last) {
        for (const d of [2, 4]) {
          note('strings', foldFreq(degreeToFreq(c.mode, key, s - 7 + d, 4), 2600), t + i * c.g * 2, dur, {
            vol: 0.85,
            bus: SFX,
            tier: 'S',
            space: 'hall',
          });
        }
      }
    });
  }

  /** Mount-synced EvolutionCutIn fanfare: 90 ms riser into slash-flash (0 ms when reducedMotion) ([AU-13]). */
  playCutInEvolve(evoId: string, opts: { reducedMotion?: boolean; leadMs?: number } = {}) {
    const leadMs = opts.leadMs ?? (opts.reducedMotion ? 0 : 90);
    this.evolve(evoId, { immediate: true, leadMs });
  }

  /** Mount-synced WeaponPick slot-reel stops at 0 / 75 / 150 ms ([AU-13]). */
  playWeaponPickReelStop(count = 3, staggerMs = 75) {
    const n = Math.max(1, Math.min(6, Math.round(count)));
    for (let i = 0; i < n; i++) {
      this.cue('reelStop', { slot: 0, amount: i, afterMs: i * staggerMs });
    }
  }

  /** Kill-Cam anticipation riser for lethal card flight (Tier S, immediate) ([AU-06]). */
  playKillCamRiser(afterMs = 0) {
    this.cue('killCamRiser', { afterMs });
  }

  /** Kill-Cam golden slash shatter (+48 ms into boss/elite/perfect KO impact) (Tier S, immediate) ([AU-06]). */
  playKillCamShatter(afterMs = 0) {
    this.cue('killCamShatter', { afterMs });
  }

  /** The evolution ends: a gentle Tier C descending 2-note sigh so expiry stays clean and unobtrusive. */
  devolve() {
    this.cue('evoEnd');
  }

  /** Audition a weapon outside a fight (Armory, unlock screen): its riff for one bar. */
  audition(weaponId: string) {
    if (this.useNative) {
      if (audioFlags.sfx) nativeBridge.fireWeapon(weaponId);
      return;
    }
    const c = this.cueCtx(0, true, 0, 'B');
    if (!c) return;
    const v = weaponVoice(weaponId);
    const sd = c.g * 2;
    for (const [s, at, len] of riffNotes(v.riff)) {
      note(v.inst, foldFreq(degreeToFreq(c.mode, c.key, c.root + s, v.octave), 2600), c.t + at * sd, sd * len * 0.92, {
        vol: 0.9,
        pan: v.pan,
        bus: SFX,
        tier: 'B',
        space: 'sfxRoom',
      });
    }
    if (v.beat) [...v.beat].forEach((ch, i) => {
      const id: DrumId | undefined = ch === 'x' ? v.drum : ch === 'o' ? v.drum2 : undefined;
      if (id) DRUMS[id](c.t + i * sd, 0.65, SFX, v.pan, false, 'B');
    });
  }

  /** Audition a weapon evolution's fanfare (WeaponExplainer, Field Guide, unlock screen). */
  auditionEvolution(evoId: string) {
    this.evolve(evoId, { immediate: true });
  }

  /**
   * One beat of the 3-second Battle Damage Story crescendo: plays the peaking weapon's
   * real instrument voice (or a rising harmonic chime for passives/Sets), climbing up
   * the scale and gaining energy as the cumulative damage graph races toward its climax.
   */
  storyBeat(opts: { weaponId?: string; step: number; totalSteps: number }) {
    if (this.useNative) {
      if (audioFlags.sfx) {
        if (opts.weaponId) nativeBridge.fireWeapon(opts.weaponId);
        else nativeBridge.select(Math.min(3, (opts.step % 3) + 1));
      }
      return;
    }
    const c = this.cueCtx(0, true, 0, 'B');
    if (!c) return;
    const total = Math.max(1, opts.totalSteps);
    const ratio = Math.max(0, Math.min(1, opts.step / Math.max(1, total - 1)));
    const deg = ladderDegree(c.mode, Math.min(10, opts.step));
    const vol = 0.58 + ratio * 0.34;
    const pan = opts.step % 2 === 0 ? -0.35 : 0.35;
    logCue(opts.weaponId ? `story:${opts.weaponId}` : 'story:beat', c.t, this.now);

    if (opts.weaponId) {
      const v = weaponVoice(opts.weaponId);
      const oct = Math.min(6, v.octave + (v.octave <= 3 ? 1 : 0));
      const motif = stingOf(v).slice(0, 2);
      motif.forEach((s, i) => {
        const freq = foldFreq(degreeToFreq(c.mode, c.key, c.root + s + Math.floor(opts.step / 2), oct), 2600);
        note(v.inst, freq, c.t + i * c.g * 0.9, c.g * 2.8, { vol: vol * 0.85, pan: v.pan, bus: SFX, tier: 'B' });
      });
      if (v.drum) drum(v.drum, c.t, 0.42 + ratio * 0.28, SFX, v.pan, false, 'B');
      note('celesta', foldFreq(degreeToFreq(c.mode, c.key, deg, 6), 2600), c.t + c.g * 0.5, 0.24, {
        vol: 0.35 + ratio * 0.22,
        pan,
        bus: SFX,
        tier: 'B',
      });
    } else {
      note('marimba', foldFreq(degreeToFreq(c.mode, c.key, deg, 5), 2600), c.t, 0.22, { vol: vol * 0.8, pan, bus: SFX, tier: 'B' });
      note('celesta', foldFreq(degreeToFreq(c.mode, c.key, deg + 4, 6), 2600), c.t + c.g * 0.6, 0.26, {
        vol: 0.42 + ratio * 0.25,
        pan: -pan,
        bus: SFX,
        tier: 'B',
      });
      drum(ratio > 0.65 ? 'woodblock' : 'shaker', c.t, 0.4 + ratio * 0.25, SFX, pan, false, 'B');
    }
  }

  /**
   * Expedition 33 slow-mo knockout: time drags down on the live soundtrack (tempo slows,
   * pitch sags, low-pass closes into cavernous stillness) while a deep sub-drop and
   * pitch-bending metallic resonance hold the impact breath before `finale(true)` blooms.
   */
  slowMoDefeat(opts: { boss?: boolean; perfectParry?: boolean } = {}) {
    this.clearSlowMo();
    if (this.useNative) {
      if (audioFlags.sfx) nativeBridge.slowMoDefeat();
      return;
    }
    this.slowMo = 0.36;
    chip.setMusicFilter(320, 0.34);
    chip.setMusicLevel(0.32, 0.3);
    this.applied = { filterHz: 320, level: 0.32, echo: this.applied.echo };
    const emphasis = opts.perfectParry ? 2 : opts.boss ? 1 : 0;
    this.cue('slowMoDefeat', { amount: emphasis });
    this.slowMoTimer = setTimeout(() => {
      this.slowMoTimer = null;
      // Halt the slowed combat bed at the trough of time-freeze so only the hall resonance lingers
      this.halt();
    }, 420);
  }

  /** The fight is over (Tier S ceremonial hall opt-in): the band stops on a cadence (won) or falls apart (lost). */
  finale(won: boolean) {
    if (this.useNative) {
      this.halt();
      this.mood = null;
      this.heat.clear();
      if (audioFlags.sfx) nativeBridge.finale(won);
      return;
    }
    const c = this.cueCtx(0, true, 0, 'S');
    this.halt();
    this.mood = null;
    this.introStepsLeft = 0;
    this.heat.clear();
    // Re-open the music filter cleanly after slow-mo muffling so the results screen arrives crisp
    chip.setMusicFilter(18000, 0.16);
    chip.setMusicLevel(1, 0.22);
    this.applied = { filterHz: -1, level: -1, echo: -1 };
    if (!c) return;
    chip.duckSfx(0.65, c.t, 0.9);
    const f = (degree: number, octave: number) => foldFreq(degreeToFreq(won ? c.mode : 'aeolian', c.key, degree, octave), 2600);
    const beat = c.g * 8;
    if (won) {
      // V … I, then the top of the chord: "ta-da-daaa" (explicit ceremonial 'hall' opt-in [AU-10])
      drum('crash', c.t, 0.9, SFX, undefined, false, 'S', 'hall');
      drum('timpani', c.t, 1, SFX, undefined, false, 'S', 'hall');
      for (const d of [4, 6, 8]) note('brass', f(d, 3), c.t, beat * 0.45, { vol: 1, bus: SFX, tier: 'S', space: 'hall' });
      for (const d of [0, 2, 4, 7]) {
        note('brass', f(d, 3), c.t + beat * 0.5, beat * 2.4, { vol: 1, bus: SFX, tier: 'S', space: 'hall' });
        note('strings', f(d, 4), c.t + beat * 0.5, beat * 2.6, { vol: 1.05, bus: SFX, tier: 'S', space: 'hall' });
      }
      drum('timpani', c.t + beat * 0.5, 1, SFX, undefined, false, 'S', 'hall');
      [0, 2, 4, 7, 9, 11, 14].forEach((d, i) =>
        note('glock', f(d, 5), c.t + beat * 0.5 + i * c.g, 0.48, { vol: 0.78, bus: SFX, tier: 'S', space: 'hall', pan: i % 2 ? 0.5 : -0.5 })
      );
    } else {
      downlifter(c.t, beat * 1.5, 0.8, SFX, 'S');
      [4, 3, 2, 0].forEach((d, i) =>
        note('brass', f(d, 3), c.t + i * beat * 0.45, i === 3 ? beat * 2 : beat * 0.42, { vol: 1, bus: SFX, tier: 'S', space: 'hall' })
      );
      drum('thud', c.t + beat * 1.35, 1, SFX, undefined, false, 'S', 'dry');
    }
  }

  // ─── Offline rendering (tests, previews, the sound studio's meters) ──────

  /** Schedule a whole passage synchronously: arrangements back to back on bar lines. */
  renderPassage(plan: { arrangement: string; bars: number }[], t0: number): number {
    this.nextTime = t0;
    this.step = 0;
    this.introStepsLeft = 0;
    for (const part of plan) {
      this.setArrangement(part.arrangement);
      if (!this.mood) this.mix = restingMix(part.arrangement);
      this.snapEnv(this.mix);
      this.bpm = ARRANGEMENTS[part.arrangement].bpm * this.mix.tempo;
      for (let i = 0; i < part.bars * 16; i++) this.advance();
    }
    this.arr = null;
    return this.nextTime;
  }

  /**
   * Schedule a scripted fight synchronously: each entry runs when the score
   * reaches its time (a mood change, or any call on the band such as a cue).
   */
  renderScript(seconds: number, script: { at: number; mood?: FightMood; run?: (b: Band) => void }[], t0: number): number {
    const queue = [...script].sort((x, y) => x.at - y.at);
    const first = queue.find(e => e.mood)?.mood;
    this.nextTime = t0;
    this.step = 0;
    this.introStepsLeft = 0;
    this.mood = null;
    this.applied = { filterHz: -1, level: -1, echo: -1 };
    this.setArrangement(first?.arrangement ?? 'meadow');
    this.bpm = this.arr ? this.arr.bpm : 120;
    try {
      while (this.nextTime < t0 + seconds && this.arr) {
        while (queue.length && queue[0].at <= this.nextTime - t0) {
          const e = queue.shift()!;
          this.clockOverride = this.nextTime - 0.012;
          if (e.mood) this.setMood(e.mood);
          e.run?.(this);
        }
        this.clockOverride = this.nextTime;
        this.advance();
      }
    } finally {
      this.clockOverride = null;
      this.arr = null;
      this.mood = null;
      this.applied = { filterHz: -1, level: -1, echo: -1 };
      this.mix = restingMix(this.current ?? 'map');
    }
    return this.nextTime;
  }
}

// ─── The cue book ───────────────────────────────────────────────────────────
//
// Every cue is written in steps above the chord root (or the tonic), so it is
// in tune with whatever the band is playing. `c.g` is one 32nd note.

const fq = (c: CueCtx, degree: number, octave: number) => foldFreq(degreeToFreq(c.mode, c.key, degree, octave), 2600);
/** A note `degree` steps above the chord root */
const N = (c: CueCtx, inst: InstrumentId, degree: number, octave: number, dt = 0, dur = 0.3, vol = 1, pan?: number, space?: Space) =>
  note(inst, fq(c, c.root + degree, octave), c.t + dt, dur, { vol, pan, bus: SFX, tier: c.tier, space });
/** The same, pushed `semis` semitones out of the scale: a note that is wrong on purpose */
const X = (c: CueCtx, inst: InstrumentId, degree: number, octave: number, semis: number, dt = 0, dur = 0.3, vol = 1, space?: Space) =>
  note(inst, foldFreq(fq(c, c.root + degree, octave) * Math.pow(2, semis / 12), 2600), c.t + dt, dur, { vol, bus: SFX, tier: c.tier, space });
const D = (c: CueCtx, id: DrumId, dt = 0, vol = 1, pan?: number, space?: Space) =>
  drum(id, c.t + dt, vol, SFX, pan, false, c.tier, space);
const runUp = (c: CueCtx, inst: InstrumentId, degrees: number[], octave: number, gap = 1, dur = 0.3, vol = 1, space?: Space) =>
  degrees.forEach((d, i) => N(c, inst, d, octave, i * c.g * gap, dur, vol, i % 2 ? 0.4 : -0.4, space));
const whoosh = (c: CueCtx, up: boolean, dur = 0.25, vol = 0.5, space: Space = 'sfxRoom') =>
  chip.noise({ at: c.t, dur, vol, filter: up ? 600 : 5000, sweepTo: up ? 5000 : 500, bus: SFX, tier: c.tier, space });
/** A rung of the streak ladder, from the tonic (not the chord) */
const rung = (c: CueCtx, r: number, octave: number, dt = 0, dur = 0.22, vol = 0.6, pan?: number) =>
  note('glock', fq(c, ladderDegree(c.mode, r), octave), c.t + dt, dur, { vol, pan, bus: SFX, tier: c.tier, space: 'sfxRoom' });
/** The foe's voice: low brass leaning on a note a tritone away, then landing. You learn to dread it. */
const foe = (c: CueCtx, vol = 0.85) => {
  X(c, 'brassStab', 0, 2, 6, 0, c.g * 3, vol);
  N(c, 'brassStab', 0, 2, c.g * 4, c.g * 5, vol);
};
const bigHit = (c: CueCtx) => {
  D(c, 'impactCrack', 0, 1, undefined, 'dry');
  impactPunch(c.t, 0.95, { durMs: 52, bus: SFX, tier: c.tier });
  subDrop(c.t, 0.8, SFX, c.tier);
  D(c, 'crash', 0, 0.55);
  for (const d of [0, 4, 7]) N(c, 'brassStab', d, 3, 0, c.g * 5, 0.9);
  chip.duck(0.5, c.t, 0.65);
  chip.duckSfx(0.37, c.t, 0.45);
};

const CUES: Record<CueName, (c: CueCtx) => void> = {
  // Hearts
  heal: c => runUp(c, 'harp', [0, 2, 4, 7, 9], 4, 1, 0.5, 0.8),
  hurt: c => {
    D(c, 'impactCrack', 0, 0.9, undefined, 'dry');
    impactPunch(c.t, 0.95, { durMs: 54, bus: SFX, tier: c.tier });
    D(c, 'thud');
    N(c, 'brassStab', 0, 2, 0, 0.28, 1);
    X(c, 'brassStab', 0, 2, 1, 0, 0.28, 1);
    chip.duck(0.6, c.t, 0.9);
    chip.duckSfx(0.65, c.t, 0.65);
  },
  mistake: c => {
    N(c, 'clav', 0, 3, 0, 0.14, 0.95, undefined, 'dry');
    X(c, 'clav', 0, 3, 1, 0, 0.14, 0.95, 'dry');
    D(c, 'rim', 0, 0.85, undefined, 'dry');
    chip.duck(0.3, c.t, 0.4);
    chip.duckSfx(0.37, c.t, 0.28);
  },
  // The near miss: a note that starts a semitone flat and is pulled up into the chord
  graceSave: c => {
    X(c, 'vibes', 2, 5, -1, 0, 0.14, 0.8);
    N(c, 'vibes', 2, 5, c.g * 2, 0.45, 0.88);
    D(c, 'tamb', c.g * 2, 0.38);
  },
  phew: c => {
    N(c, 'whistle', 4, 5, 0, c.g * 2, 0.65);
    N(c, 'whistle', 2, 5, c.g * 2, c.g * 3, 0.65);
  },
  nineLives: c => {
    note('theremin', fq(c, c.root, 4), c.t, 0.35, { vol: 0.85, bus: SFX, tier: c.tier, slideTo: fq(c, c.root + 7, 4) });
    runUp(c, 'harp', [0, 2, 4, 7, 9, 11], 4, 1, 0.45, 0.72);
  },
  shield: c => {
    D(c, 'thud', 0, 0.6);
    N(c, 'steel', 4, 5, 0, 0.32, 0.82);
  },

  // Money (Tier B: controlled gain so coins never mask hits [AU-04])
  coins: c => {
    const n = Math.max(1, Math.min(6, Math.ceil(c.amount / 2)));
    for (let i = 0; i < n; i++) rung(c, c.slot + i, 6, i * c.g, 0.18, 0.58, i % 2 ? 0.5 : -0.5);
  },
  overkill: c => {
    for (let i = 0; i < 6; i++) rung(c, i, 6, i * c.g * 0.5, 0.18, 0.58, i % 2 ? 0.6 : -0.6);
    CUES.register({ ...c, t: c.t + c.g * 3 });
  },
  register: c => {
    D(c, 'tick', 0, 0.85);
    D(c, 'anvil', c.g, 0.45);
    N(c, 'bell', 4, 6, c.g, 0.36, 0.75);
    N(c, 'bell', 7, 6, c.g * 2, 0.55, 0.78);
  },
  coinRoll: c => {
    const n = Math.max(3, Math.min(20, c.amount));
    for (let i = 0; i < n; i++) rung(c, Math.floor((i / n) * 12), 6, i * 0.045, 0.1, 0.46, i % 2 ? 0.4 : -0.4);
    N(c, 'bell', 7, 6, n * 0.045, 0.6, 0.82);
  },
  fetch: c => {
    N(c, 'pizz', 4, 4, 0, 0.14, 0.78);
    N(c, 'pizz', 7, 4, c.g * 2, 0.14, 0.78);
    rung(c, 4, 6, c.g * 3, 0.18, 0.58);
  },

  // Growing
  levelUp: c => {
    [0, 2, 4, 7].forEach((d, i) => {
      note('brass', fq(c, d, 4), c.t + i * c.g * 2, c.g * 2.2, { vol: 0.95, bus: SFX, tier: c.tier, space: 'sfxRoom' });
      note('bell', fq(c, d, 5), c.t + i * c.g * 2, 0.42, { vol: 0.68, bus: SFX, tier: c.tier, space: 'sfxRoom' });
    });
    for (const d of [7, 9, 11]) note('brass', fq(c, d, 4), c.t + c.g * 8, c.g * 9, { vol: 0.9, bus: SFX, tier: c.tier, space: 'sfxRoom' });
    drum('crash', c.t + c.g * 8, 0.65, SFX, undefined, false, c.tier, 'sfxRoom');
    chip.duck(0.45, c.t, 0.7);
    chip.duckSfx(0.37, c.t, 0.55);
  },
  weaponGet: c => {
    runUp(c, 'celesta', [0, 2, 4, 7], 5, 1, 0.34, 0.78);
    D(c, 'tamb', c.g * 4, 0.68);
  },
  reelStop: c => {
    const idx = Math.max(0, Math.round(c.amount || c.slot));
    D(c, 'woodblockLo', 0, 0.85, undefined, 'dry');
    N(c, 'marimba', [0, 2, 4][idx % 3], 4, 0, 0.18, 0.72, undefined, 'dry');
  },
  reelSpin: c => {
    for (let i = 0; i < 10; i++) D(c, i % 2 ? 'woodblock' : 'woodblockLo', i * 0.048, 0.32 + i * 0.025, undefined, 'dry');
    [0, 2, 4].forEach((d, i) => N(c, 'marimba', d, 4, 0.5 + i * 0.11, 0.2, 0.78, undefined, 'dry'));
  },
  // Angry Birds–inspired flying star swoosh: brisk rising air sweep + subtle glint before the stamp
  starSwoosh: c => {
    const step = Math.max(1, Math.min(3, Math.round(c.amount) || 1));
    const baseHz = 440 + (step - 1) * 140;
    chip.noise({ at: c.t, dur: 0.19, vol: 0.34 + step * 0.05, filter: baseHz, sweepTo: baseHz * 6.5, attack: 0.09, bus: SFX, tier: c.tier, space: 'sfxRoom' });
    const startDeg = [0, 2, 4][step - 1];
    note('whistle', fq(c, startDeg, 5), c.t, 0.16, { vol: 0.28, bus: SFX, tier: c.tier, space: 'sfxRoom', slideTo: fq(c, startDeg + 4, 5) });
  },
  // Angry Birds–inspired giant star stamp: heavy physical thwack + ascending triad chime + 3★ ceremonial hall climax
  star: c => {
    const top = Math.max(1, Math.min(3, Math.round(c.amount) || 1));
    D(c, 'impactCrack', 0, 0.75 + (top - 1) * 0.12, undefined, 'dry');
    D(c, 'taiko', 0, 0.75 + (top - 1) * 0.12);
    D(c, 'thud', 0, 0.65 + (top - 1) * 0.16);
    D(c, 'woodblock', 0, 0.68);
    const deg = [0, 2, 4][top - 1];
    const space: Space = top >= 3 ? 'hall' : 'sfxRoom';
    N(c, 'bell', deg, 6, 0, top >= 3 ? 1.0 : 0.65, 0.95, undefined, space);
    N(c, 'glock', deg, 6, 0.014, 0.42, 0.8, undefined, space);
    N(c, 'brassStab', deg, 4, 0, 0.34, 0.88, undefined, space);
    chip.duck(0.35, c.t, 0.55);
    chip.duckSfx(0.37, c.t, 0.45);
    if (top === 1) {
      runUp(c, 'celesta', [0, 4], 6, 0.7, 0.28, 0.52);
    } else if (top === 2) {
      runUp(c, 'celesta', [2, 4, 7], 6, 0.65, 0.32, 0.62);
      D(c, 'tamb', 0.02, 0.48);
    } else {
      // Ceremonial 3★ climax explicitly opts into 1.7 s hall ([AU-10])
      subDrop(c.t, 0.9, SFX, c.tier);
      D(c, 'crash', 0, 0.78, undefined, 'hall');
      D(c, 'timpani', 0.01, 0.9, undefined, 'hall');
      N(c, 'bell', 7, 6, 0.02, 1.15, 1.0, undefined, 'hall');
      for (const d of [0, 2, 4, 7]) {
        N(c, 'brass', d, 4, 0, 0.85, 0.82, undefined, 'hall');
        N(c, 'strings', d, 4, 0.02, 1.4, 1.0, undefined, 'hall');
        N(c, 'choir', d, 4, 0.05, 1.3, 0.68, undefined, 'hall');
      }
      [0, 2, 4, 7, 9, 11].forEach((d, i) =>
        note('harp', fq(c, d, 5), c.t + 0.03 + i * 0.038, 0.62, { vol: 0.72, bus: SFX, tier: c.tier, space: 'hall', pan: i % 2 ? 0.55 : -0.55 })
      );
    }
  },
  // Performance seal wax-stamp impact on the Victory Card
  rankSeal: c => {
    D(c, 'impactCrack', 0, 0.72, undefined, 'dry');
    D(c, 'woodblockLo', 0, 0.85, undefined, 'dry');
    D(c, 'thud', 0, 0.7, undefined, 'dry');
    N(c, 'bell', 7, 5, 0.01, 0.55, 0.75);
    chip.duckSfx(0.37, c.t, 0.3);
  },

  // The foe
  foeDefeated: c => {
    D(c, 'impactCrack', 0, 1, undefined, 'dry');
    impactPunch(c.t, 1, { durMs: 56, bus: SFX, tier: c.tier });
    D(c, 'crash', 0, 0.9);
    D(c, 'timpani', 0, 1);
    whoosh(c, false, 0.5, 0.55);
    const beat = c.g * 8;
    for (const d of [4, 6, 8]) note('brassStab', fq(c, d, 3), c.t, beat * 0.45, { vol: 0.95, bus: SFX, tier: c.tier, space: 'sfxRoom' });
    for (const d of [0, 2, 4, 7]) note('brass', fq(c, d, 3), c.t + beat * 0.5, beat * 1.2, { vol: 0.95, bus: SFX, tier: c.tier, space: 'sfxRoom' });
    chip.duck(0.6, c.t, 0.9);
    chip.duckSfx(0.65, c.t, 0.7);
  },
  wave: c => {
    D(c, 'taiko', 0, 1);
    D(c, 'taiko', c.g * 4, 0.8);
    D(c, 'taiko', c.g * 6, 1);
    N(c, 'horn', 4, 3, 0, c.g * 4, 0.95);
    N(c, 'horn', 7, 3, c.g * 4, c.g * 8, 0.95);
  },
  foeRegen: c => {
    N(c, 'horn', 0, 2, 0, c.g * 3, 0.85);
    N(c, 'horn', 2, 2, c.g * 3, c.g * 4, 0.85);
  },
  foeMove: c => foe(c),
  foeDud: c => {
    foe(c, 0.8);
    D(c, 'thud', c.g * 4, 0.75);
  },
  foeHide: c => {
    foe(c, 0.8);
    whoosh(c, false, 0.28, 0.38);
  },
  foeFuse: c => {
    foe(c, 0.8);
    for (let i = 0; i < 4; i++) D(c, 'tick', i * c.g * (1 - i * 0.15), 0.82);
  },
  foeShuffle: c => {
    foe(c, 0.8);
    whoosh(c, true, 0.28, 0.45);
    for (let i = 0; i < 4; i++) D(c, 'shaker', i * c.g, 0.72);
  },
  foeSteal: c => {
    foe(c, 0.8);
    runUp(c, 'toy', [7, 5, 4, 2], 5, 1, 0.12, 0.8);
    for (let i = 0; i < 4; i++) D(c, 'woodblock', i * c.g, 0.55);
  },
  foeGrowl: c => {
    X(c, 'brassStab', 0, 1, 6, 0, c.g * 10, 0.9);
    X(c, 'brassStab', 0, 2, 0, 0, c.g * 10, 0.55);
  },
  toll: c => {
    note('bell', fq(c, 0, 3), c.t, 1.1, { vol: 1.0, bus: SFX, tier: c.tier, space: 'sfxRoom' });
    note('bell', fq(c, 0, 2), c.t, 1.1, { vol: 0.9, bus: SFX, tier: c.tier, space: 'sfxRoom' });
  },

  // Fighters (Tier B calibrated per [AU-04])
  hotStreak: c => {
    runUp(c, 'brassStab', [0, 2, 4], 4, 2, c.g * 2.6, 0.9);
    for (let i = 0; i < 5; i++) D(c, 'shaker', i * c.g, 0.5 + i * 0.08);
  },
  bigHit,
  grudge: c => N(c, 'saw', 0, 2, 0, 0.26, 0.78, undefined, 'sfxRoom'),
  patience: c => [0, 2, 4].forEach((d, i) => N(c, 'celesta', d, 5, i * c.g * 0.5, 0.5, 0.65)),
  freeze: c => {
    runUp(c, 'celesta', [9, 7, 4, 2, 0], 6, 1, 0.42, 0.75);
    chip.noise({ at: c.t, dur: 0.45, vol: 0.22, short: true, filter: 9000, sweepTo: 3000, bus: SFX, tier: c.tier, space: 'sfxRoom' });
  },
  redeal: c => {
    whoosh(c, true, 0.28, 0.45);
    runUp(c, 'marimba', [0, 2, 4, 7, 9, 11, 14], 4, 0.5, 0.14, 0.8);
  },
  scoop: c => {
    note('sub', fq(c, c.root + 7, 3), c.t, 0.18, { vol: 0.85, bus: SFX, tier: c.tier, slideTo: fq(c, c.root, 3) });
    N(c, 'marimba', 7, 4, c.g * 3, 0.18, 0.85);
  },
  twinkle: c => N(c, 'celesta', 7, 6, 0, 0.22, 0.5, undefined, 'dry'),

  // Weapons
  fire: c => {
    D(c, 'crackle', 0, 0.8);
    N(c, 'banjo', 4, 5, 0, 0.12, 0.55);
  },
  hint: c => {
    N(c, 'celesta', 4, 5, 0, 0.25, 0.8);
    N(c, 'celesta', 7, 5, c.g * 2, 0.36, 0.82);
  },
  timeGain: c => {
    runUp(c, 'toy', [0, 2, 4, 7], 5, 1, 0.12, 0.8);
    D(c, 'woodblockLo', 0, 0.7);
    D(c, 'woodblock', c.g * 2, 0.7);
  },
  ding: c => rung(c, c.slot, 6, 0, 0.22, 0.55),
  // [AU-09]: 2-stage detonation — dry flash-onset crack+punch at t=0, brassStab + tight low-mid rumble at +14 ms
  blast: c => {
    D(c, 'impactCrack', 0, 1, undefined, 'dry');
    impactPunch(c.t, 0.95, { durMs: 55, bus: SFX, tier: c.tier });
    N(c, 'brassStab', 0, 2, 0.014, 0.22, 0.92, undefined, 'sfxRoom');
    chip.noise({ at: c.t + 0.014, dur: 0.28, vol: 0.65, filter: 1600, sweepTo: 140, bus: SFX, tier: c.tier, space: 'sfxRoom' });
    chip.duck(0.35, c.t, 0.4);
    chip.duckSfx(0.37, c.t, 0.32);
  },
  // [AU-04] & [AU-10]: laser calibrated to 0.85 Tier B and routed to sfxRoom (zero echo bounce!)
  laser: c => {
    note('saw', fq(c, c.root + 7, 5), c.t, 0.22, { vol: 0.85, bus: SFX, tier: c.tier, space: 'sfxRoom', slideTo: fq(c, c.root, 3) });
    chip.noise({ at: c.t, dur: 0.1, vol: 0.2, short: true, filter: 7000, bus: SFX, tier: c.tier, space: 'dry' });
  },
  ricochet: c => [7, 4, 9].forEach((d, i) => N(c, 'steel', d, 5, i * c.g, 0.22, 0.78, [-0.7, 0.7, -0.3][i])),
  doubled: c => {
    N(c, 'bell', 4, 5, 0, 0.24, 0.78);
    N(c, 'bell', 4, 6, c.g, 0.42, 0.82);
  },
  armed: c => N(c, 'clav', 4, 4, 0, 0.08, 0.5, undefined, 'dry'),
  charged: c => {
    runUp(c, 'saw', [0, 4, 7], 4, 1, 0.18, 0.85, 'sfxRoom');
    chip.noise({ at: c.t, dur: 0.26, vol: 0.2, short: true, filter: 4000, sweepTo: 9000, bus: SFX, tier: c.tier, space: 'sfxRoom' });
  },
  warDrum: c => {
    D(c, 'taiko', 0, 0.9);
    D(c, 'taiko', c.g * 2, 0.72);
    D(c, 'taiko', c.g * 3, 0.9);
    N(c, 'horn', 0, 3, 0, c.g * 3, 0.8);
    N(c, 'horn', 4, 3, c.g * 3, c.g * 5, 0.8);
  },
  clarity: c => {
    runUp(c, 'bell', [9, 7, 4], 5, 2, 0.45, 0.72);
    whoosh(c, true, 0.28, 0.28);
  },
  clarityEnd: c => runUp(c, 'bell', [4, 2], 5, 2, 0.32, 0.48),
  pinata: c => {
    for (let i = 0; i < 3; i++) D(c, 'shaker', i * c.g, 0.78);
    N(c, 'toy', 4, 5, c.g * 3, 0.18, 0.8);
  },
  pinataBreak: c => {
    D(c, 'impactCrack', 0, 0.85, undefined, 'dry');
    chip.noise({ at: c.t, dur: 0.08, vol: 0.72, filter: 2500, bus: SFX, tier: c.tier, space: 'sfxRoom' });
    for (let i = 0; i < 6; i++) rung(c, i, 6, (i + 1) * c.g * 0.5, 0.18, 0.6, i % 2 ? 0.6 : -0.6);
  },
  link: c => {
    N(c, 'pizz', 0, 5, 0, 0.14, 0.78);
    N(c, 'pizz', 4, 5, c.g, 0.14, 0.78);
  },
  purity: c => {
    const n = Math.max(2, Math.min(4, Math.round(c.amount) || 2));
    for (let i = 0; i < n; i++) N(c, 'organ', i * 2, 4, i * c.g, 0.34, 0.78);
  },
  rainbow: c => {
    for (let i = 0; i < 8; i++) note('glock', fq(c, i, 5), c.t + i * c.g * 0.5, 0.26, { vol: 0.65, bus: SFX, tier: c.tier, space: 'sfxRoom', pan: -0.7 + (i / 7) * 1.4 });
    chip.noise({ at: c.t, dur: 0.42, vol: 0.22, short: true, filter: 5000, sweepTo: 10000, bus: SFX, tier: c.tier, space: 'sfxRoom' });
    for (const d of [0, 2, 4, 7]) N(c, 'strings', d, 4, c.g * 5, c.g * 8, 0.7);
  },
  // Starfall Summit Arcana pickup / bold discovery: sparkling tritone resolution + celesta glint
  arcanaGain: c => {
    note('bell', foldFreq(fq(c, 0, 6) * Math.pow(2, 6 / 12), 2600), c.t, 0.42, { vol: 0.75, bus: SFX, tier: c.tier, space: 'sfxRoom' });
    note('bell', fq(c, 4, 6), c.t + c.g * 3, 0.65, { vol: 0.82, bus: SFX, tier: c.tier, space: 'sfxRoom' });
    note('celesta', fq(c, 7, 6), c.t + c.g * 4, 0.34, { vol: 0.56, bus: SFX, tier: c.tier, space: 'sfxRoom' });
    note('sub', fq(c, 0, 2), c.t, 0.36, { vol: 0.68, bus: SFX, tier: c.tier, space: 'dry' });
  },
  /** Temporary alias kept until Starfall Summit call sites migrate from `'catalyst'` to `'arcanaGain'`. */
  catalyst: c => CUES.arcanaGain(c),

  // Per-weapon evolution telemetry cues (Sakurai Ep. #032 / #165 priority hierarchy)
  // Tier A: ascending 2-note crystalline shimmer when a weapon hits 1 step away from evolving (distinct from Parry & Set match)
  evoAlmost: c => {
    N(c, 'celesta', 4, 5, 0, 0.16, 0.84, -0.35, 'sfxRoom');
    N(c, 'glass', 7, 5, 0, 0.14, 0.46, 0.25, 'sfxRoom');
    N(c, 'celesta', 9, 5, c.g * 1.5, 0.26, 0.92, 0.35, 'sfxRoom');
    N(c, 'bell', 7, 6, c.g * 1.5, 0.3, 0.64, -0.2, 'sfxRoom');
    chip.duck(0.22, c.t, 0.24);
    chip.duckSfx(0.28, c.t, 0.22);
  },
  // Tier C: subtle rate-limited wooden/crystal pip climbing semitones by progress/target ratio (or step count)
  evoProgress: c => {
    const semis =
      c.amount > 0 && c.amount <= 1
        ? Math.round(c.amount * 10)
        : Math.max(0, Math.min(10, Math.round(c.amount)));
    const mult = Math.pow(2, semis / 12);
    const baseHz = foldFreq(fq(c, c.root + 2, 5) * mult, 2600);
    const highHz = foldFreq(fq(c, c.root + 6, 5) * mult, 2600);
    D(c, 'woodblock', 0, 0.24, undefined, 'dry');
    note('kalimba', baseHz, c.t, 0.09, { vol: 0.44, bus: SFX, tier: 'C', space: 'dry' });
    note('celesta', highHz, c.t + 0.012, 0.11, { vol: 0.34, bus: SFX, tier: 'C', space: 'dry' });
  },
  // Tier B: violet shimmer bolt when Catalyst Prism or Encore Mask charges an allied weapon's evolution
  evoCharge: c => {
    runUp(c, 'celesta', [2, 4, 7], 5, 0.8, 0.22, 0.68, 'sfxRoom');
    N(c, 'harp', 7, 5, c.g * 1.5, 0.28, 0.52, undefined, 'sfxRoom');
  },
  // Tier C: gentle descending 2-note sigh when a timed weapon evolution expires
  evoEnd: c => {
    note('vibes', fq(c, c.root + 4, 5), c.t, 0.22, { vol: 0.48, bus: SFX, tier: 'C', space: 'dry' });
    note('vibes', fq(c, c.root, 5), c.t + c.g * 2.5, 0.36, { vol: 0.4, bus: SFX, tier: 'C', space: 'dry' });
  },
  trapSet: c => {
    X(c, 'pizz', 0, 3, 1, 0, 0.14, 0.8);
    D(c, 'tick', c.g, 0.72);
  },
  trapDefused: c => {
    D(c, 'rim', 0, 0.82);
    N(c, 'celesta', 0, 5, c.g, 0.25, 0.8);
    N(c, 'celesta', 2, 5, c.g * 3, 0.4, 0.82);
  },
  trapSprung: c => {
    D(c, 'impactCrack', 0, 0.88, undefined, 'dry');
    D(c, 'snare', 0, 0.95);
    X(c, 'brassStab', 0, 2, 1, 0, 0.24, 0.9);
    N(c, 'brassStab', 0, 2, 0, 0.24, 0.9);
  },
  burn: c => {
    whoosh(c, true, 0.42, 0.55);
    D(c, 'crackle', 0.1, 0.82);
    for (const d of [0, 2, 4]) N(c, 'choir', d, 4, 0, c.g * 8, 0.72);
  },

  // The streak ends: a gentle, warm two-note exhale so cooling down never feels jarring
  streakLost: c => {
    note('vibes', fq(c, isMinor(c.mode) ? 3 : 2, 4), c.t, 0.28, { vol: 0.42, bus: SFX, tier: c.tier, space: 'sfxRoom' });
    note('vibes', fq(c, 0, 4), c.t + c.g * 3, 0.5, { vol: 0.36, bus: SFX, tier: c.tier, space: 'sfxRoom' });
  },

  // Your own gear went wrong: a plucked note with its sour neighbour, falling
  sour: c => {
    X(c, 'pizz', 2, 4, -1, 0, 0.16, 0.8);
    N(c, 'pizz', 0, 4, c.g * 2, 0.2, 0.8);
    D(c, 'rim', 0, 0.48);
  },

  // Set-Parrying (Tier S warn / perfectParry / foeStrike; Tier A parry [AU-04], [AU-08], [AU-11])
  parryWarn: c => {
    D(c, 'rim', 0, 0.82, undefined, 'dry');
    N(c, 'steel', 7, 5, 0, 0.16, 0.82);
    N(c, 'bell', 7, 6, c.g, 0.22, 0.68);
    chip.duck(0.3, c.t, 0.25);
    chip.duckSfx(0.65, c.t, 0.25);
  },
  parry: c => {
    D(c, 'impactCrack', 0, 0.9, undefined, 'dry');
    impactPunch(c.t, 0.82, { durMs: 44, bus: SFX, tier: c.tier });
    D(c, 'anvil', 0, 0.9);
    N(c, 'steel', 4, 5, 0, 0.22, 0.92);
    N(c, 'bell', 7, 5, c.g, 0.38, 0.9);
    chip.duck(0.35, c.t, 0.3);
    chip.duckSfx(0.37, c.t, 0.28);
  },
  perfectParry: c => {
    D(c, 'impactCrack', 0, 1, undefined, 'dry');
    impactPunch(c.t, 0.95, { durMs: 50, bus: SFX, tier: c.tier });
    D(c, 'anvil', 0, 1);
    D(c, 'crash', 0, 0.72);
    N(c, 'bell', 7, 6, 0, 0.65, 1);
    N(c, 'bell', 11, 6, c.g, 0.58, 0.9);
    for (const d of [0, 4, 7]) N(c, 'brassStab', d, 4, c.g * 1.5, 0.38, 0.95);
    chip.duck(0.55, c.t, 0.45);
    chip.duckSfx(0.65, c.t, 0.4);
  },
  foeStrike: c => {
    D(c, 'impactCrack', 0, 0.95, undefined, 'dry');
    impactPunch(c.t, 1, { durMs: 56, bus: SFX, tier: c.tier });
    D(c, 'timpani', 0, 0.95);
    D(c, 'thud', c.g, 0.95);
    X(c, 'brassStab', 0, 2, 1, 0, 0.28, 1);
    N(c, 'brassStab', 0, 2, 0, 0.28, 0.95);
    chip.duck(0.55, c.t, 0.6);
    chip.duckSfx(0.65, c.t, 0.5);
  },

  // Live Multiplier Ignition & Lethal Kill-Cam
  multStep: c => {
    // Pitch climbs by `amount` (or legacy `slot`), while callers pass `slot: 0` on visual frames to avoid double-offsetting timing
    const step = Math.min(12, Math.max(0, Math.round(c.amount || c.slot)));
    const hot = step >= 4;
    N(c, hot ? 'bell' : 'celesta', step, hot ? 6 : 5, 0, 0.18, 0.68);
    D(c, hot ? 'tick' : 'woodblock', 0, 0.36, undefined, 'dry');
  },
  multSlam: c => {
    const tier = Math.max(0, Math.min(3, Math.round(c.amount)));
    D(c, 'impactCrack', 0, 0.75 + tier * 0.08, undefined, 'dry');
    D(c, tier >= 2 ? 'timpani' : 'kick', 0, 0.8 + tier * 0.05);
    // [AU-04]: Suppress redundant subDrop/crash when a heavy payout T2-T3 already landed within 120 ms
    if (tier >= 2 && !c.suppressSlamSub) {
      subDrop(c.t, 0.8, SFX, c.tier);
    }
    if (tier >= 2) {
      for (const d of [0, 4, 7]) N(c, 'brassStab', d, 4, 0, 0.34, 0.85);
    }
    if (tier >= 3) {
      if (!c.suppressSlamSub) D(c, 'crash', 0, 0.65);
      runUp(c, 'bell', [4, 7, 9, 11], 6, 0.5, 0.36, 0.8);
    } else {
      N(c, 'bell', 7, 5, 0, 0.3, 0.8);
    }
    if (tier >= 1 && !c.suppressSlamSub) {
      chip.duck(0.3, c.t, 0.35);
    }
  },
  killCamRiser: c => {
    for (let i = 0; i < 6; i++) D(c, 'timpani', i * 0.048, 0.45 + i * 0.09);
    riser(c.t, 0.32, 0.55, SFX, c.tier);
    chip.duck(0.55, c.t, 0.38);
    chip.duckSfx(0.65, c.t, 0.38);
  },
  killCamShatter: c => {
    D(c, 'impactCrack', 0, 1, undefined, 'dry');
    D(c, 'crash', 0, 1, undefined, 'hall');
    D(c, 'anvil', 0, 0.85, undefined, 'sfxRoom');
    subDrop(c.t, 1, SFX, c.tier);
    // [AU-06] & [AU-14]: Fold octave-6 glock shimmer strictly <= 2,600 Hz
    runUp(c, 'glock', [0, 2, 4, 7, 9, 11, 14], 5, 0.5, 0.38, 0.88, 'sfxRoom');
    chip.duck(0.65, c.t, 0.75);
    chip.duckSfx(0.65, c.t, 0.65);
  },
  // Expedition 33 slow-mo finishing blow (Tier S, explicit ceremonial 'hall' opt-in [AU-10])
  slowMoDefeat: c => {
    const emphasis = Math.max(0, Math.min(2, Math.round(c.amount)));
    D(c, 'impactCrack', 0, 1, undefined, 'dry');
    // Chest-thumping time-stop bass drop (with warm 2nd/3rd harmonics for phone speakers [AU-15])
    chip.play(
      { osc: 'sine', partials: [[2, 0.3], [3, 0.14]], lp: { hz: 520 }, a: 0.002, d: 0.95, s: 0, r: 0.08, vol: 0.95 },
      { freq: 122, slideTo: 26, at: c.t, dur: 0.95, vol: 1.0, bus: SFX, tier: c.tier, space: 'dry' }
    );
    D(c, 'taiko', 0, 1.0, undefined, 'hall');
    D(c, 'timpani', 0.015, 0.9, undefined, 'hall');
    if (emphasis >= 1) D(c, 'anvil', 0, emphasis >= 2 ? 0.95 : 0.72, undefined, 'hall');
    chip.noise({ at: c.t, dur: 0.72, vol: 0.52, filter: 5600, sweepTo: 180, bus: SFX, tier: c.tier, space: 'hall' });
    const sag = 0.84;
    const bellF = fq(c, 7, 5);
    const hornF = fq(c, 0, 3);
    const glassF = fq(c, 4, 6);
    note('bell', bellF, c.t, 0.68, { vol: 0.92, bus: SFX, tier: c.tier, space: 'hall', slideTo: bellF * sag });
    note('horn', hornF, c.t + 0.01, 0.75, { vol: 0.88, bus: SFX, tier: c.tier, space: 'hall', slideTo: hornF * sag });
    note('glass', glassF, c.t + 0.02, 0.82, { vol: 0.65, bus: SFX, tier: c.tier, space: 'hall', slideTo: glassF * 0.89 });
    chip.duckSfx(0.65, c.t, 0.85);
  },
  // Resolution chord when the 3-second Battle Damage Story crescendo crowns the MVP item
  storyClimax: c => {
    D(c, 'taiko', 0, 0.72);
    D(c, 'tamb', 0.02, 0.55);
    N(c, 'bell', 7, 6, 0, 0.75, 0.88);
    for (const d of [0, 2, 4, 7]) N(c, 'strings', d, 4, 0, 0.9, 0.68);
    [0, 2, 4, 7].forEach((d, i) =>
      note('glock', fq(c, d, 6), c.t + i * 0.032, 0.34, { vol: 0.58, bus: SFX, tier: c.tier, space: 'sfxRoom', pan: i % 2 ? 0.45 : -0.45 })
    );
  },

  // Golden Rescue Key pickup / keyhole turn shimmer
  keyFound: c => {
    D(c, 'tick', 0, 0.7);
    D(c, 'anvil', 0.015, 0.48);
    [0, 4, 7, 11].forEach((d, i) =>
      note('celesta', fq(c, d, 6), c.t + i * 0.042, 0.3, { vol: 0.74, bus: SFX, tier: c.tier, space: 'sfxRoom', pan: i % 2 ? 0.35 : -0.35 })
    );
    N(c, 'bell', 7, 6, 0.09, 0.52, 0.82);
  },

  // Cage bars snap open and a caged friend leaps free! (Ceremonial hall opt-in [AU-10])
  friendRescued: c => {
    D(c, 'impactCrack', 0, 0.88, undefined, 'dry');
    D(c, 'anvil', 0, 0.88, undefined, 'hall');
    D(c, 'taiko', 0.015, 0.85, undefined, 'hall');
    D(c, 'crash', 0.04, 0.65, undefined, 'hall');
    [0, 2, 4, 7].forEach((d, i) => {
      note('brass', fq(c, d, 4), c.t + 0.03 + i * 0.068, i === 3 ? 0.85 : 0.2, { vol: 0.86, bus: SFX, tier: c.tier, space: 'hall' });
      note('bell', fq(c, d, 6), c.t + 0.03 + i * 0.068, 0.55, { vol: 0.75, bus: SFX, tier: c.tier, space: 'hall', pan: i % 2 ? 0.45 : -0.45 });
    });
    [0, 2, 4, 7, 9, 11].forEach((d, i) =>
      note('harp', fq(c, d, 5), c.t + 0.12 + i * 0.04, 0.68, { vol: 0.68, bus: SFX, tier: c.tier, space: 'hall', pan: i % 2 ? -0.5 : 0.5 })
    );
    for (const d of [0, 2, 4, 7]) N(c, 'strings', d, 4, 0.24, 1.05, 0.74, undefined, 'hall');
    chip.duck(0.5, c.t, 0.8);
    chip.duckSfx(0.37, c.t, 0.65);
  },

  // Menus (Tier C, dry, low-level UI feedback [AU-04], [AU-10])
  tap: c => note('kalimba', fq(c, 4, 5), c.t, 0.1, { vol: 0.42, bus: SFX, tier: 'C', space: 'dry' }),
  back: c => {
    note('kalimba', fq(c, 4, 5), c.t, 0.1, { vol: 0.42, bus: SFX, tier: 'C', space: 'dry' });
    note('kalimba', fq(c, 0, 5), c.t + 0.06, 0.12, { vol: 0.42, bus: SFX, tier: 'C', space: 'dry' });
  },
};

export const CUE_NAMES = Object.keys(CUES) as CueName[];

export const band = new Band();
export type { Band };
