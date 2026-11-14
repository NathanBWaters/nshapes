/**
 * The band: the live score of a fight.
 *
 * One sequencer plays the tune in layers (lead, bass, drums, arpeggio, pad,
 * counter-melody), a riff for each weapon you hold, a duet for each evolution,
 * and warning figures for what is on the board. The director
 * (src/audio/director.ts) says which layers play; this file plays them.
 *
 * Every effect ("cue") is music too. A cue is written in scale steps, waits
 * for the next 32nd-note of the song and is pitched to the chord playing at
 * that moment. A Set rings one rung higher for every Set in the streak; three
 * card taps spell the chord the Set then strums; a chain of weapon effects
 * climbs the scale like a slot machine paying out.
 *
 * With music switched off the sequencer stops, and cues still play (in the
 * world's home key). With sound effects off, cues are silent.
 */
import { chip } from './chip';
import { direct, restingMix, worldTone, type FightMood, type Mix } from './director';
import { DRUMS, INSTRUMENTS, downlifter, drum, note, riser, subDrop, type DrumId, type InstrumentId } from './instruments';
import { audioFlags } from './settings';
import { ARRANGEMENTS, THEME, THEME_B, type Arrangement } from './songs';
import { themeOf } from './themes';
import { chordRoot, degreeToFreq, isMinor, ladderDegree, ladderRung, nextGridTime, parseNote, strum, type ModeName } from './theory';
import { riffNotes, stingOf, weaponVoice, type EvolutionGroove, type WeaponVoice } from './voices';

/** The instrument that doubles the tune in each world once the band fills in */
const WORLD_COLOUR: Record<string, InstrumentId> = { map: 'celesta', meadow: 'glock', woods: 'flute', canyon: 'banjo', peaks: 'celesta', boss: 'brass' };

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

export type CueName =
  | 'heal' | 'hurt' | 'mistake' | 'graceSave' | 'coins' | 'levelUp' | 'foeDefeated' | 'wave' | 'foeRegen'
  | 'foeMove' | 'foeDud' | 'foeHide' | 'foeFuse' | 'foeShuffle' | 'foeSteal' | 'foeGrowl'
  | 'fire' | 'hint' | 'toll' | 'timeGain' | 'nineLives' | 'hotStreak' | 'bigHit' | 'grudge' | 'shield' | 'patience'
  | 'freeze' | 'redeal' | 'scoop' | 'twinkle' | 'fetch' | 'phew' | 'ding' | 'blast' | 'laser' | 'ricochet'
  | 'doubled' | 'armed' | 'charged' | 'warDrum' | 'clarity' | 'clarityEnd' | 'pinata' | 'pinataBreak' | 'link'
  | 'purity' | 'rainbow' | 'catalyst' | 'trapSet' | 'trapDefused' | 'trapSprung' | 'burn' | 'overkill'
  | 'streakLost' | 'sour' | 'reelStop' | 'register' | 'reelSpin' | 'star' | 'coinRoll' | 'weaponGet' | 'tap' | 'back';

export interface CueOpts {
  /** How big the thing is (damage, coins, a count): scales the cue */
  amount?: number;
  /** Position in a chain of effects: later slots play later and higher */
  slot?: number;
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
}

const SFX = 'sfx' as const;

class Band {
  /** Arrangement asked for (remembered while music is off) */
  current: string | null = null;
  private arr: Arrangement | null = null;
  private arrName = 'map';
  private pending: string | null = null;
  private step = 0;
  private nextTime = 0;
  private bpm = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private mix: Mix = restingMix('map');
  private mood: FightMood | null = null;
  private heat = new Map<string, number>();
  private turn = 0;
  private spot: string[] = [];
  private clockOverride: number | null = null;
  private lastCueAt: Partial<Record<string, number>> = {};

  /** True while a fight is feeding the band its mood: the fight's own sounds belong to the band. */
  get inFight(): boolean {
    return this.mood !== null;
  }

  private get now(): number {
    return this.clockOverride ?? chip.now;
  }

  // ─── Transport ────────────────────────────────────────────────────────────

  play(name: string) {
    const known = ARRANGEMENTS[name] ? name : 'map';
    this.current = known;
    if (!this.mood) this.mix = restingMix(known);
    if (!audioFlags.music) return;
    if (!chip.ensure()) return;
    if (this.timer && this.arr) {
      if (this.arrName !== known) this.pending = known; // swap on the next bar line
      return;
    }
    this.setArrangement(known);
    this.pending = null;
    this.bpm = ARRANGEMENTS[known].bpm;
    this.nextTime = chip.now + 0.08;
    this.applied = { filterHz: -1, level: -1, echo: -1 };
    this.applyMixToChip(0.05);
    this.timer = setInterval(() => this.schedule(), 25);
  }

  /** Stop and forget the song (leaving a screen). */
  stop() {
    this.halt();
    this.current = null;
    this.mood = null;
    this.heat.clear();
  }

  /** Silence playback but remember the song (music toggled off, autoplay blocked). */
  halt() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.arr = null;
    this.pending = null;
  }

  private setArrangement(name: string) {
    this.arr = ARRANGEMENTS[name];
    this.arrName = name;
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
    // If the tab was backgrounded, don't try to catch up a pile of notes
    if (this.nextTime < chip.now - 0.2) this.nextTime = chip.now + 0.05;
    while (this.nextTime < chip.now + 0.12) this.advance();
  }

  private advance() {
    if (!this.arr) return;
    if (this.step % 16 === 0 && this.pending) {
      this.setArrangement(this.pending);
      this.pending = null;
    }
    // Tempo eases toward its target, so a streak speeds the band up instead of jolting it
    const target = this.arr.bpm * this.mix.tempo;
    this.bpm = this.bpm ? this.bpm + (target - this.bpm) * 0.12 : target;
    this.playStep(this.arr, this.step, this.nextTime);
    this.nextTime += this.stepDur();
    this.step += 1;
  }

  // ─── The fight ────────────────────────────────────────────────────────────

  /** Start following a fight. Call `setMood` whenever the fight changes. */
  enterFight(mood: FightMood) {
    this.mood = null;
    this.heat.clear();
    this.turn = 0;
    this.setMood(mood);
    this.play(mood.arrangement);
  }

  /** Stop following the fight (results, quitting): the band goes back to a resting mix. */
  leaveFight() {
    this.mood = null;
    this.heat.clear();
    this.mix = restingMix(this.current ?? 'map');
    this.applyMixToChip(0.6);
  }

  setMood(mood: FightMood) {
    const prev = this.mood;
    this.mood = mood;
    this.mix = direct(mood, id => themeOf(id));
    this.applyMixToChip(0.35);
    if (!prev) return;
    for (const id of mood.evolutions) if (!prev.evolutions.includes(id)) this.evolve(id);
    for (const id of prev.evolutions) if (!mood.evolutions.includes(id)) this.devolve();
    if (prev.combo >= 3 && mood.combo === 0 && mood.status === 'playing') this.cue('streakLost');
    // Level-up: three choices land like the reels of a slot machine
    if (prev.status !== 'pick' && mood.status === 'pick') [0, 1, 2].forEach(i => this.cue('reelStop', { slot: 8 + i * 4 }));
  }

  /** The mix the band is following right now (the sound studio shows it). */
  get currentMix(): Mix {
    return this.mix;
  }

  private applied = { filterHz: -1, level: -1, echo: -1 };
  private applyMixToChip(glide: number) {
    const a = this.applied;
    const echo = Math.round(this.stepDur() * 300) / 100;
    if (a.filterHz !== this.mix.filterHz) chip.setMusicFilter(this.mix.filterHz, glide);
    if (a.level !== this.mix.level) chip.setMusicLevel(this.mix.level, glide);
    if (a.echo !== echo) chip.setEchoTime(echo);
    this.applied = { filterHz: this.mix.filterHz, level: this.mix.level, echo };
  }

  /** A weapon fired: play its sting and bring its riff forward for the next bars. */
  fire(weaponId: string, slot = 0) {
    this.heat.set(weaponId, Math.min(1, (this.heat.get(weaponId) ?? 0) + 0.5));
    const c = this.cueCtx(slot);
    if (!c) return;
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
    stingOf(v).forEach((s, i) =>
      note(v.inst, degreeToFreq(c.mode, c.key, c.root + s, octave), c.t + i * c.g, c.g * 3, { vol: 1.15 * vol, pan: v.pan, bus: SFX })
    );
    if (v.drum) drum(v.drum, c.t, 0.8 * vol, SFX, v.pan);
  }

  // ─── One 16th note of the score ───────────────────────────────────────────

  private tone(): { mode: ModeName; key: number } {
    // A lift that would push the tune too high comes back down an octave: still a new key, never shrill
    const key = worldTone(this.arrName).key + this.mix.lift;
    return { mode: this.mix.mode, key: key > 7 ? key - 12 : key };
  }

  private playStep(a: Arrangement, step: number, t: number) {
    const mix = this.mix;
    const sd = this.stepDur();
    const bar = Math.floor(step / 16);
    const s16 = step % 16;
    const { mode, key } = this.tone();
    const root = chordRoot(mode, bar);
    const f = (degree: number, octave: number) => degreeToFreq(mode, key, degree, octave);
    const evo = mix.evolutions.length > 0 ? themeOf(mix.evolutions[0]) : null;
    const flicker = mix.evolutionFading && s16 % 8 >= 4;

    if (s16 === 0) this.startBar(bar);

    // Lead: the tune, on the chip, doubled by the world's colour once the band fills in
    const section = a.useB && bar % 16 >= 8 ? THEME_B : THEME;
    const idx = (bar % 8) * 16 + s16;
    const tok = section[idx];
    const lead = tok && tok !== '-' && tok !== '.' ? parseNote(tok) : null;
    if (lead && mix.lead) {
      let len = 1;
      while (section[idx + len] === '-' && s16 + len < 16) len++;
      const dur = sd * len * 0.95;
      const semis = a.leadOctave / 12;
      const freq = f(lead.degree, lead.octave + semis);
      if (mix.lounge) note('vibes', freq, t, dur, { vol: 0.9 });
      else {
        chip.tone({ voice: 'pulse1', freq, at: t, dur, vol: a.leadVol, duty: a.leadDuty, vibrato: len > 2 ? a.leadVibrato : 0 });
        if (mix.intensity >= 0.5) note(WORLD_COLOUR[this.arrName] ?? 'glock', freq * (this.arrName === 'boss' ? 0.5 : 2), t, dur, { vol: 0.45, soft: true });
        if (mix.counter) note('flute', f(lead.degree - 2, lead.octave + semis), t, dur, { vol: 0.5, pan: -0.3, soft: true });
      }
    }

    // Bass
    const b = mix.lounge ? 'R..5..8.R..5.3..'[s16] : a.bass[s16];
    if (b && b !== '-' && b !== '.' && !mix.frozen) {
      let len = 1;
      while (!mix.lounge && a.bass[s16 + len] === '-') len++;
      const freq = f(root + (BASS_STEP[b] ?? 0), a.bassOctave);
      chip.tone({ voice: 'wave', freq, at: t, dur: sd * len * 0.9, vol: 0.55, decay: 0.5 });
      if (mix.intensity >= 0.6 && b === 'R') note('sub', freq / (freq > 90 ? 2 : 1), t, sd * 1.5, { vol: 0.5, soft: true });
    }

    // Arpeggio
    if ((a.arp || mix.arp) && s16 % 2 === 0 && !mix.frozen) {
      const tones = [0, 2, 4, 7];
      chip.tone({ voice: 'pulse2', freq: f(root + tones[(s16 / 2) % 4], 4), at: t, dur: sd * 0.8, vol: 0.18, duty: a.arpDuty, decay: 0.8, soft: true });
    }

    // Pad: the chord, held
    if (mix.pad && s16 === 0) {
      for (const d of [0, 2, 4]) note('strings', f(root + d, 3), t, sd * 15.5, { vol: mix.frozen ? 1.2 : 0.8, pan: d === 2 ? 0.3 : d === 4 ? -0.3 : 0, soft: true });
    }
    if (mix.frozen && s16 % 4 === 0) note('glass', f(root + [0, 4, 7, 9][(s16 / 4) % 4], 5), t, sd * 4, { vol: 0.7 });

    // Drums
    this.playDrums(a, s16, bar, t, evo && !flicker ? GROOVES[evo.groove] : null);

    // What the fight is telling you
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
    if (al.fuseHot > 0) drum('shaker', t, 0.7, 'music', -0.5);
    if (al.thornSoon && s16 % 4 === 3) drum('rim', t, 0.8, 'music', 0.4);
    if (al.glassLow && (s16 === 6 || s16 === 14)) note('glass', f(7, 6), t, sd * 2, { vol: 0.7 });
    if (al.bombSoon && s16 % 4 === 0) drum('tick', t, 1);

    // Your build: weapon riffs taking turns
    for (const id of this.spot) this.playRiff(weaponVoice(id), s16, t, sd, root, mode, key, RIFF_VOL + RIFF_HEAT * (this.heat.get(id) ?? 0), 0);

    // An evolution: its two weapons in duet an octave up, and a ring of bells
    if (evo && !flicker) {
      evo.weapons.forEach((id, i) => this.playRiff(weaponVoice(id), s16, t, sd, root, mode, key, RIFF_VOL + RIFF_HEAT, 1, i === 0 ? 'saw' : undefined));
      if (s16 % 2 === 0) note('glock', f(root + [0, 2, 4, 7, 9, 7, 4, 2][(s16 / 2) % 8], 6), t, sd, { vol: 0.4, pan: s16 % 4 ? 0.5 : -0.5, soft: true });
      if (s16 % 4 === 2) for (const d of [0, 2, 4]) note('saw', f(root + d, 4), t, sd * 0.9, { vol: 0.5, soft: true });
    }
  }

  private playRiff(v: WeaponVoice, s16: number, t: number, sd: number, root: number, mode: ModeName, key: number, vol: number, up: number, double?: InstrumentId) {
    const c = v.riff[s16];
    if (c >= '0' && c <= '9') {
      let len = 1;
      while (s16 + len < 16 && v.riff[s16 + len] === '-') len++;
      const freq = degreeToFreq(mode, key, root + (c.charCodeAt(0) - 48), Math.min(6, v.octave + up));
      note(v.inst, freq, t, sd * len * 0.92, { vol, pan: v.pan, soft: true });
      if (double) note(double, freq, t, sd * len * 0.92, { vol: vol * 0.55, pan: -v.pan, soft: true });
    }
    const d = v.beat?.[s16];
    if (d === 'x' && v.drum) drum(v.drum, t, vol * 0.75, 'music', v.pan, true);
    if (d === 'o' && v.drum2) drum(v.drum2, t, vol * 0.75, 'music', v.pan, true);
  }

  private playDrums(a: Arrangement, s16: number, bar: number, t: number, groove: string | null) {
    const level = this.mix.drums;
    if (level === 0) return;
    const d = groove ? groove[s16] : this.mix.lounge ? LOUNGE_DRUMS[s16] : a.drums[s16];
    const light = level === 1;
    if (d === 'k') drum('kick', t, light ? 0.7 : 1);
    if (d === 's') {
      drum('snare', t, light ? 0.5 : 0.9);
      if (level === 3) drum('clap', t, 0.5);
    }
    if (d === 'c') drum('clap', t, 0.8);
    if (d === 'h' && (!light || this.mix.lounge)) drum(this.mix.lounge ? 'ride' : 'hat', t, 0.9);
    if (d === 'o' && !light) drum('openHat', t, 0.9);
    if (level === 3 && s16 % 2 === 1 && d !== 'h') drum('hat', t, 0.45, 'music', 0.3, true);
    // A tom fill hands every fourth bar over to the next one
    if (level >= 2 && !groove && bar % 4 === 3 && s16 >= 12) drum('tom', t, 0.5 + (s16 - 12) * 0.1, 'music', (s16 - 13.5) * 0.3);
    if (level >= 2 && bar % 8 === 0 && s16 === 0 && bar > 0) drum('crash', t, 0.45);
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
  private cueCtx(slot = 0, immediate = false): CueCtx | null {
    if (!audioFlags.sfx) return null;
    if (!chip.ensure()) return null;
    const { mode, key } = this.tone();
    const running = this.timer !== null || this.clockOverride !== null;
    const sd = running && this.bpm ? this.stepDur() : 60 / 120 / 4;
    const g = sd / 2;
    const earliest = this.now + 0.012;
    const t0 = running && !immediate ? nextGridTime(earliest, this.nextTime, g) : earliest;
    const t = t0 + slot * g;
    const stepAt = running ? this.step + Math.floor((t - this.nextTime) / sd + 1e-6) : 0;
    return { t, g, mode, key, root: running ? chordRoot(mode, Math.floor(stepAt / 16)) : 0, amount: 0, slot };
  }

  /** A card was tapped: the first, second and third card are the root, third and fifth of the chord. */
  select(count: number) {
    const c = this.cueCtx(0, true);
    if (!c) return;
    const i = Math.max(0, Math.min(2, count - 1));
    note('kalimba', degreeToFreq(c.mode, c.key, c.root + i * 2, 5), c.t, 0.2, { vol: 0.9, bus: SFX });
    drum('tick', c.t, 0.25, SFX);
  }

  deselect() {
    const c = this.cueCtx(0, true);
    if (!c) return;
    note('kalimba', degreeToFreq(c.mode, c.key, c.root, 4), c.t, 0.15, { vol: 0.6, bus: SFX });
  }

  /**
   * A Set landed. The chord strums, the streak ladder rings one rung higher
   * for every Set in the combo, and the hit's size picks its weight:
   * 0 a tap, 1 a thump, 2 a slam with a sub drop, 3 the whole orchestra.
   */
  payout(o: { combo: number; tier: number; rainbow?: boolean }) {
    const c = this.cueCtx();
    if (!c) return;
    const f = (degree: number, octave: number) => degreeToFreq(c.mode, c.key, degree, octave);
    const N = (inst: InstrumentId, degree: number, octave: number, dt: number, dur: number, vol = 1, pan?: number) =>
      note(inst, f(degree, octave), c.t + dt, dur, { vol, pan, bus: SFX });

    strum(c.root).forEach((d, i) => N('harp', d, 4, i * c.g * 0.5, 0.5, 0.75));

    const rung = ladderRung(o.combo);
    N('bell', ladderDegree(c.mode, rung), 5, 0, 0.8, 1);
    if (o.combo >= 3) N('glock', ladderDegree(c.mode, rung + 2), 5, c.g, 0.4, 0.7);
    if (o.combo >= 5) [1, 2, 3, 4].forEach(i => N('glock', ladderDegree(c.mode, rung + i), 6, (i + 1) * c.g, 0.3, 0.55, i % 2 ? 0.5 : -0.5));
    if (o.combo >= 8) {
      drum('crash', c.t, 0.5, SFX);
      strum(c.root).forEach(d => N('choir', d, 4, 0, c.g * 12, 0.7));
    }

    drum('kick', c.t, 0.5 + o.tier * 0.15, SFX);
    if (o.tier >= 1) for (const d of [0, 4]) N('brass', c.root + d, 3, 0, c.g * 3, 0.8);
    if (o.tier >= 2) {
      subDrop(c.t, 0.7 + (o.tier - 2) * 0.3);
      drum('crash', c.t, 0.6, SFX);
      chip.duck(0.45, c.t, 0.6);
    }
    if (o.tier >= 3) {
      for (const oct of [3, 4, 5]) strum(c.root).forEach(d => N(oct === 4 ? 'strings' : 'brass', d, oct, 0, c.g * 10, 0.75));
      for (let i = 0; i < 8; i++) N('glock', ladderDegree(c.mode, rung + 7 - i), 6, (i + 2) * c.g, 0.35, 0.7, i % 2 ? 0.6 : -0.6);
      chip.duck(0.7, c.t, 1.1);
    }
    if (o.rainbow) this.run(CUES.rainbow, c);
  }

  /** Play a named cue on the next 32nd note, in key. */
  cue(name: CueName, o: CueOpts = {}) {
    const c = this.cueCtx(o.slot ?? 0, name === 'tap' || name === 'back');
    if (!c) return;
    // The same cue twice inside a 32nd is one sound, not two
    const last = this.lastCueAt[name];
    if (last !== undefined && Math.abs(c.t - last) < 0.02 && name !== 'reelStop') return;
    this.lastCueAt[name] = c.t;
    c.amount = o.amount ?? 0;
    this.run(CUES[name], c);
  }

  private run(fn: (c: CueCtx) => void, c: CueCtx) {
    fn(c);
  }

  /** An evolution begins: a riser into the recipe's own fanfare. The band lifts a key (the director does that). */
  evolve(recipeId: string) {
    const c = this.cueCtx();
    if (!c) return;
    const theme = themeOf(recipeId);
    const lead = c.g * 4; // half a beat of drum roll and riser
    riser(c.t, lead, 0.8);
    for (let i = 0; i < 4; i++) drum('snare', c.t + i * c.g, 0.4 + i * 0.15, SFX);
    const t = c.t + lead;
    drum('crash', t, 0.9, SFX);
    subDrop(t, 0.8);
    chip.duck(0.5, t, 0.8);
    const key = c.key + theme.lift;
    theme.fanfare.forEach((s, i) => {
      const last = i === theme.fanfare.length - 1;
      const freq = degreeToFreq(c.mode, key, s, 4);
      const dur = last ? c.g * 12 : c.g * 2.4;
      note(theme.insts[i < theme.fanfare.length / 2 ? 0 : 1], freq, t + i * c.g * 2, dur, { vol: 1.1, bus: SFX, pan: i % 2 ? 0.3 : -0.3 });
      note('brass', freq, t + i * c.g * 2, dur, { vol: 0.7, bus: SFX });
      if (last) for (const d of [2, 4]) note('strings', degreeToFreq(c.mode, key, s - 7 + d, 4), t + i * c.g * 2, dur, { vol: 0.9, bus: SFX });
    });
  }

  /** The evolution ends: the power drains away. */
  devolve() {
    const c = this.cueCtx();
    if (!c) return;
    downlifter(c.t, c.g * 12, 0.7);
    [7, 4, 2, 0].forEach((s, i) => note('vibes', degreeToFreq(c.mode, c.key, c.root + s, 5), c.t + i * c.g * 2, 0.6, { vol: 0.7, bus: SFX }));
  }

  /** Audition a weapon outside a fight (Armory, unlock screen): its riff for one bar, then its sting. */
  audition(weaponId: string) {
    const c = this.cueCtx(0, true);
    if (!c) return;
    const v = weaponVoice(weaponId);
    const sd = c.g * 2;
    for (const [s, at, len] of riffNotes(v.riff)) {
      note(v.inst, degreeToFreq(c.mode, c.key, c.root + s, v.octave), c.t + at * sd, sd * len * 0.92, { vol: 1.2, pan: v.pan, bus: SFX });
    }
    if (v.beat) [...v.beat].forEach((ch, i) => {
      const id: DrumId | undefined = ch === 'x' ? v.drum : ch === 'o' ? v.drum2 : undefined;
      if (id) DRUMS[id](c.t + i * sd, 0.8, SFX, v.pan);
    });
  }

  /** Audition an evolution's fanfare (Recipe Guide, unlock screen). */
  auditionEvolution(recipeId: string) {
    this.evolve(recipeId);
  }

  /** The fight is over: the band stops on a cadence (won) or falls apart (lost). */
  finale(won: boolean) {
    const c = this.cueCtx();
    this.halt();
    this.mood = null;
    this.heat.clear();
    if (!c) return;
    const f = (degree: number, octave: number) => degreeToFreq(won ? c.mode : 'aeolian', c.key, degree, octave);
    const beat = c.g * 8;
    if (won) {
      // V … I, then the top of the chord: "ta-da-daaa"
      drum('crash', c.t, 0.9, SFX);
      drum('timpani', c.t, 1, SFX);
      for (const d of [4, 6, 8]) note('brass', f(d, 3), c.t, beat * 0.45, { vol: 1, bus: SFX });
      for (const d of [0, 2, 4, 7]) {
        note('brass', f(d, 3), c.t + beat * 0.5, beat * 2.4, { vol: 1, bus: SFX });
        note('strings', f(d, 4), c.t + beat * 0.5, beat * 2.6, { vol: 1.1, bus: SFX });
      }
      drum('timpani', c.t + beat * 0.5, 1, SFX);
      [0, 2, 4, 7, 9, 11, 14].forEach((d, i) => note('glock', f(d, 5), c.t + beat * 0.5 + i * c.g, 0.5, { vol: 0.8, bus: SFX, pan: i % 2 ? 0.5 : -0.5 }));
    } else {
      downlifter(c.t, beat * 1.5, 0.8);
      [4, 3, 2, 0].forEach((d, i) => note('brass', f(d, 3), c.t + i * beat * 0.45, i === 3 ? beat * 2 : beat * 0.42, { vol: 1, bus: SFX }));
      drum('thud', c.t + beat * 1.35, 1, SFX);
    }
  }

  // ─── Offline rendering (tests, previews, the sound studio's meters) ──────

  /** Schedule a whole passage synchronously: arrangements back to back on bar lines. */
  renderPassage(plan: { arrangement: string; bars: number }[], t0: number): number {
    this.nextTime = t0;
    this.step = 0;
    for (const part of plan) {
      this.setArrangement(part.arrangement);
      if (!this.mood) this.mix = restingMix(part.arrangement);
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

const fq = (c: CueCtx, degree: number, octave: number) => degreeToFreq(c.mode, c.key, degree, octave);
/** A note `degree` steps above the chord root */
const N = (c: CueCtx, inst: InstrumentId, degree: number, octave: number, dt = 0, dur = 0.3, vol = 1, pan?: number) =>
  note(inst, fq(c, c.root + degree, octave), c.t + dt, dur, { vol, pan, bus: SFX });
/** The same, pushed `semis` semitones out of the scale: a note that is wrong on purpose */
const X = (c: CueCtx, inst: InstrumentId, degree: number, octave: number, semis: number, dt = 0, dur = 0.3, vol = 1) =>
  note(inst, fq(c, c.root + degree, octave) * Math.pow(2, semis / 12), c.t + dt, dur, { vol, bus: SFX });
const D = (c: CueCtx, id: DrumId, dt = 0, vol = 1, pan?: number) => drum(id, c.t + dt, vol, SFX, pan);
const runUp = (c: CueCtx, inst: InstrumentId, degrees: number[], octave: number, gap = 1, dur = 0.3, vol = 1) =>
  degrees.forEach((d, i) => N(c, inst, d, octave, i * c.g * gap, dur, vol, i % 2 ? 0.4 : -0.4));
const whoosh = (c: CueCtx, up: boolean, dur = 0.25, vol = 0.5) =>
  chip.noise({ at: c.t, dur, vol, filter: up ? 600 : 5000, sweepTo: up ? 5000 : 500, bus: SFX, space: 'room' });
/** A rung of the streak ladder, from the tonic (not the chord) */
const rung = (c: CueCtx, r: number, octave: number, dt = 0, dur = 0.25, vol = 0.8, pan?: number) =>
  note('glock', fq(c, ladderDegree(c.mode, r), octave), c.t + dt, dur, { vol, pan, bus: SFX });
/** The foe's voice: low brass leaning on a note a tritone away, then landing. You learn to dread it. */
const foe = (c: CueCtx, vol = 1) => {
  X(c, 'brass', 0, 2, 6, 0, c.g * 3, vol);
  N(c, 'brass', 0, 2, c.g * 4, c.g * 5, vol);
};
const bigHit = (c: CueCtx) => {
  D(c, 'kick', 0, 1);
  subDrop(c.t, 0.8);
  D(c, 'crash', 0, 0.6);
  for (const d of [0, 4, 7]) N(c, 'brass', d, 3, 0, c.g * 5, 0.9);
  chip.duck(0.5, c.t, 0.7);
};

const CUES: Record<CueName, (c: CueCtx) => void> = {
  // Hearts
  heal: c => runUp(c, 'harp', [0, 2, 4, 7, 9], 4, 1, 0.7, 0.95),
  hurt: c => {
    D(c, 'thud');
    N(c, 'brass', 0, 2, 0, 0.32);
    X(c, 'brass', 0, 2, 1, 0, 0.32);
    chip.duck(0.6, c.t, 0.9);
  },
  mistake: c => {
    N(c, 'clav', 0, 3, 0, 0.14);
    X(c, 'clav', 0, 3, 1, 0, 0.14);
    D(c, 'rim', 0, 0.8);
    chip.duck(0.3, c.t, 0.4);
  },
  // The near miss: a note that starts a semitone flat and is pulled up into the chord
  graceSave: c => {
    X(c, 'vibes', 2, 5, -1, 0, 0.14, 0.9);
    N(c, 'vibes', 2, 5, c.g * 2, 0.6, 1);
    D(c, 'tamb', c.g * 2, 0.4);
  },
  phew: c => {
    N(c, 'whistle', 4, 5, 0, c.g * 2, 0.7);
    N(c, 'whistle', 2, 5, c.g * 2, c.g * 3, 0.7);
  },
  nineLives: c => {
    note('theremin', fq(c, c.root, 4), c.t, 0.35, { vol: 1, bus: SFX, slideTo: fq(c, c.root + 7, 4) });
    runUp(c, 'harp', [0, 2, 4, 7, 9, 11], 4, 1, 0.6, 0.8);
  },
  shield: c => {
    D(c, 'thud', 0, 0.6);
    N(c, 'steel', 4, 5, 0, 0.4, 0.9);
  },

  // Money
  coins: c => {
    const n = Math.max(1, Math.min(6, Math.ceil(c.amount / 2)));
    for (let i = 0; i < n; i++) rung(c, c.slot + i, 6, i * c.g, 0.2, 1, i % 2 ? 0.5 : -0.5);
  },
  overkill: c => {
    for (let i = 0; i < 8; i++) rung(c, i, 6, i * c.g * 0.5, 0.2, 0.7, i % 2 ? 0.6 : -0.6);
    CUES.register({ ...c, t: c.t + c.g * 4 });
  },
  register: c => {
    D(c, 'tick', 0, 1);
    D(c, 'anvil', c.g, 0.5);
    N(c, 'bell', 4, 6, c.g, 0.5, 0.9);
    N(c, 'bell', 7, 6, c.g * 2, 0.8, 0.9);
  },
  coinRoll: c => {
    const n = Math.max(3, Math.min(24, c.amount));
    for (let i = 0; i < n; i++) rung(c, Math.floor((i / n) * 12), 6, i * 0.045, 0.1, 0.5, i % 2 ? 0.4 : -0.4);
    N(c, 'bell', 7, 6, n * 0.045, 0.9, 1);
  },
  fetch: c => {
    N(c, 'pizz', 4, 4, 0, 0.15);
    N(c, 'pizz', 7, 4, c.g * 2, 0.15);
    rung(c, 4, 6, c.g * 3);
  },

  // Growing
  levelUp: c => {
    [0, 2, 4, 7].forEach((d, i) => {
      note('brass', fq(c, d, 4), c.t + i * c.g * 2, c.g * 2.2, { vol: 1, bus: SFX });
      note('bell', fq(c, d, 5), c.t + i * c.g * 2, 0.5, { vol: 0.7, bus: SFX });
    });
    for (const d of [7, 9, 11]) note('brass', fq(c, d, 4), c.t + c.g * 8, c.g * 9, { vol: 0.9, bus: SFX });
    drum('crash', c.t + c.g * 8, 0.7, SFX);
  },
  weaponGet: c => {
    runUp(c, 'celesta', [0, 2, 4, 7], 5, 1, 0.4, 0.9);
    D(c, 'tamb', c.g * 4, 0.8);
  },
  reelStop: c => {
    D(c, 'woodblockLo', 0, 1);
    N(c, 'marimba', [0, 2, 4][c.slot % 3], 4, 0, 0.25, 0.9);
  },
  reelSpin: c => {
    for (let i = 0; i < 12; i++) D(c, i % 2 ? 'woodblock' : 'woodblockLo', i * 0.05, 0.35 + i * 0.03);
    [0, 2, 4].forEach((d, i) => N(c, 'marimba', d, 4, 0.6 + i * 0.12, 0.25, 1));
  },
  star: c => {
    const top = Math.max(1, Math.min(3, c.amount));
    N(c, 'bell', [0, 2, 4][top - 1], 6, 0, 0.9, 1);
    N(c, 'brass', [0, 2, 4][top - 1], 4, 0, 0.3, 0.8);
    if (top === 3) {
      for (const d of [0, 2, 4, 7]) N(c, 'strings', d, 4, 0, 1.2, 1);
      D(c, 'crash', 0, 0.6);
    }
  },

  // The foe
  foeDefeated: c => {
    D(c, 'crash', 0, 0.9);
    D(c, 'timpani', 0, 1);
    whoosh(c, false, 0.6, 0.6);
    const beat = c.g * 8;
    for (const d of [4, 6, 8]) note('brass', fq(c, d, 3), c.t, beat * 0.45, { vol: 0.9, bus: SFX });
    for (const d of [0, 2, 4, 7]) note('brass', fq(c, d, 3), c.t + beat * 0.5, beat * 1.2, { vol: 0.9, bus: SFX });
    chip.duck(0.6, c.t, 0.9);
  },
  wave: c => {
    D(c, 'taiko', 0, 1);
    D(c, 'taiko', c.g * 4, 0.8);
    D(c, 'taiko', c.g * 6, 1);
    N(c, 'horn', 4, 3, 0, c.g * 4, 1);
    N(c, 'horn', 7, 3, c.g * 4, c.g * 8, 1);
  },
  foeRegen: c => {
    N(c, 'horn', 0, 2, 0, c.g * 3, 0.9);
    N(c, 'horn', 2, 2, c.g * 3, c.g * 4, 0.9);
  },
  foeMove: c => foe(c),
  foeDud: c => {
    foe(c, 0.8);
    D(c, 'thud', c.g * 4, 0.8);
  },
  foeHide: c => {
    foe(c, 0.8);
    whoosh(c, false, 0.3, 0.4);
  },
  foeFuse: c => {
    foe(c, 0.8);
    for (let i = 0; i < 4; i++) D(c, 'tick', i * c.g * (1 - i * 0.15), 0.9);
  },
  foeShuffle: c => {
    foe(c, 0.8);
    whoosh(c, true, 0.3, 0.5);
    for (let i = 0; i < 4; i++) D(c, 'shaker', i * c.g, 0.8);
  },
  foeSteal: c => {
    foe(c, 0.8);
    runUp(c, 'toy', [7, 5, 4, 2], 5, 1, 0.12, 0.9);
    for (let i = 0; i < 4; i++) D(c, 'woodblock', i * c.g, 0.6);
  },
  foeGrowl: c => {
    X(c, 'brass', 0, 1, 6, 0, c.g * 10, 1);
    X(c, 'brass', 0, 2, 0, 0, c.g * 10, 0.6);
  },
  toll: c => {
    note('bell', fq(c, 0, 3), c.t, 1.6, { vol: 1.2, bus: SFX });
    note('bell', fq(c, 0, 2), c.t, 1.6, { vol: 1, bus: SFX });
  },

  // Fighters
  hotStreak: c => {
    runUp(c, 'brass', [0, 2, 4], 4, 2, c.g * 2.6, 1.7);
    for (let i = 0; i < 6; i++) D(c, 'shaker', i * c.g, 0.6 + i * 0.1);
  },
  bigHit,
  grudge: c => N(c, 'saw', 0, 2, 0, 0.28, 1.5),
  patience: c => [0, 2, 4].forEach((d, i) => N(c, 'celesta', d, 5, i * c.g * 0.5, 0.8, 0.7)),
  freeze: c => {
    runUp(c, 'celesta', [9, 7, 4, 2, 0], 6, 1, 0.5, 0.8);
    chip.noise({ at: c.t, dur: 0.6, vol: 0.25, short: true, filter: 9000, sweepTo: 3000, bus: SFX, space: 'hall' });
  },
  redeal: c => {
    whoosh(c, true, 0.3, 0.5);
    runUp(c, 'marimba', [0, 2, 4, 7, 9, 11, 14], 4, 0.5, 0.15, 0.9);
  },
  scoop: c => {
    note('sub', fq(c, c.root + 7, 3), c.t, 0.18, { vol: 1, bus: SFX, slideTo: fq(c, c.root, 3) });
    N(c, 'marimba', 7, 4, c.g * 3, 0.2, 1);
  },
  twinkle: c => N(c, 'celesta', 7, 6, 0, 0.3, 0.6),

  // Weapons
  fire: c => {
    D(c, 'crackle', 0, 0.9);
    N(c, 'banjo', 4, 5, 0, 0.12, 0.6);
  },
  hint: c => {
    N(c, 'celesta', 4, 5, 0, 0.3, 0.9);
    N(c, 'celesta', 7, 5, c.g * 2, 0.5, 0.9);
  },
  timeGain: c => {
    runUp(c, 'toy', [0, 2, 4, 7], 5, 1, 0.12, 0.9);
    D(c, 'woodblockLo', 0, 0.8);
    D(c, 'woodblock', c.g * 2, 0.8);
  },
  ding: c => rung(c, c.slot, 6, 0, 0.3, 1),
  blast: c => {
    D(c, 'kick', 0, 1);
    D(c, 'timpani', 0, 0.8);
    chip.noise({ at: c.t, dur: 0.45, vol: 0.7, filter: 1800, sweepTo: 120, bus: SFX, space: 'room' });
    N(c, 'brass', 0, 2, 0, 0.25, 0.9);
  },
  laser: c => {
    note('saw', fq(c, c.root + 7, 5), c.t, 0.22, { vol: 1.7, bus: SFX, slideTo: fq(c, c.root, 3) });
    chip.noise({ at: c.t, dur: 0.12, vol: 0.2, short: true, filter: 7000, bus: SFX });
  },
  ricochet: c => [7, 4, 9].forEach((d, i) => N(c, 'steel', d, 5, i * c.g, 0.25, 0.9, [-0.7, 0.7, -0.3][i])),
  doubled: c => {
    N(c, 'bell', 4, 5, 0, 0.3, 0.9);
    N(c, 'bell', 4, 6, c.g, 0.6, 1);
  },
  armed: c => N(c, 'clav', 4, 4, 0, 0.08, 0.6),
  charged: c => {
    runUp(c, 'saw', [0, 4, 7], 4, 1, 0.18, 1.4);
    chip.noise({ at: c.t, dur: 0.3, vol: 0.2, short: true, filter: 4000, sweepTo: 9000, bus: SFX });
  },
  warDrum: c => {
    D(c, 'taiko', 0, 1);
    D(c, 'taiko', c.g * 2, 0.8);
    D(c, 'taiko', c.g * 3, 1);
    N(c, 'horn', 0, 3, 0, c.g * 3, 0.9);
    N(c, 'horn', 4, 3, c.g * 3, c.g * 5, 0.9);
  },
  clarity: c => {
    runUp(c, 'bell', [9, 7, 4], 5, 2, 0.6, 0.8);
    whoosh(c, true, 0.3, 0.3);
  },
  clarityEnd: c => runUp(c, 'bell', [4, 2], 5, 2, 0.4, 0.5),
  pinata: c => {
    for (let i = 0; i < 3; i++) D(c, 'shaker', i * c.g, 0.9);
    N(c, 'toy', 4, 5, c.g * 3, 0.2, 0.9);
  },
  pinataBreak: c => {
    chip.noise({ at: c.t, dur: 0.08, vol: 0.8, filter: 2500, bus: SFX });
    for (let i = 0; i < 8; i++) rung(c, i, 6, (i + 1) * c.g * 0.5, 0.2, 0.7, i % 2 ? 0.6 : -0.6);
  },
  link: c => {
    N(c, 'pizz', 0, 5, 0, 0.15, 0.9);
    N(c, 'pizz', 4, 5, c.g, 0.15, 0.9);
  },
  purity: c => {
    const n = Math.max(2, Math.min(4, Math.round(c.amount) || 2));
    for (let i = 0; i < n; i++) N(c, 'organ', i * 2, 4, i * c.g, 0.4, 0.9);
  },
  rainbow: c => {
    for (let i = 0; i < 12; i++) note('glock', fq(c, i, 5), c.t + i * c.g * 0.5, 0.3, { vol: 0.7, bus: SFX, pan: -0.8 + (i / 11) * 1.6 });
    chip.noise({ at: c.t, dur: 0.5, vol: 0.25, short: true, filter: 5000, sweepTo: 11000, bus: SFX, space: 'hall' });
    for (const d of [0, 2, 4, 7]) N(c, 'strings', d, 4, c.g * 6, c.g * 10, 0.8);
  },
  // Something special appeared: one note from outside the scale, then it resolves
  catalyst: c => {
    note('bell', fq(c, 0, 6) * Math.pow(2, 6 / 12), c.t, 0.5, { vol: 0.8, bus: SFX });
    note('bell', fq(c, 4, 6), c.t + c.g * 3, 0.9, { vol: 0.9, bus: SFX });
    note('sub', fq(c, 0, 2), c.t, 0.4, { vol: 0.7, bus: SFX });
  },
  trapSet: c => {
    X(c, 'pizz', 0, 3, 1, 0, 0.15, 0.9);
    D(c, 'tick', c.g, 0.8);
  },
  trapDefused: c => {
    D(c, 'rim', 0, 0.9);
    N(c, 'celesta', 0, 5, c.g, 0.3, 0.9);
    N(c, 'celesta', 2, 5, c.g * 3, 0.5, 0.9);
  },
  trapSprung: c => {
    D(c, 'snare', 0, 1);
    X(c, 'brass', 0, 2, 1, 0, 0.25, 0.9);
    N(c, 'brass', 0, 2, 0, 0.25, 0.9);
  },
  burn: c => {
    whoosh(c, true, 0.5, 0.6);
    D(c, 'crackle', 0.1, 0.9);
    for (const d of [0, 2, 4]) N(c, 'choir', d, 4, 0, c.g * 8, 0.8);
  },

  // The streak ends: two notes stepping down, like a slot reel that just missed
  streakLost: c => {
    note('vibes', fq(c, isMinor(c.mode) ? 3 : 2, 4), c.t, 0.25, { vol: 0.7, bus: SFX });
    note('vibes', fq(c, 0, 4), c.t + c.g * 3, 0.5, { vol: 0.7, bus: SFX });
  },

  // Your own gear went wrong: a plucked note with its sour neighbour, falling
  sour: c => {
    X(c, 'pizz', 2, 4, -1, 0, 0.18, 0.9);
    N(c, 'pizz', 0, 4, c.g * 2, 0.22, 0.9);
    D(c, 'rim', 0, 0.5);
  },

  // Menus
  tap: c => note('kalimba', fq(c, 4, 5), c.t, 0.12, { vol: 0.6, bus: SFX }),
  back: c => {
    note('kalimba', fq(c, 4, 5), c.t, 0.12, { vol: 0.6, bus: SFX });
    note('kalimba', fq(c, 0, 5), c.t + 0.06, 0.15, { vol: 0.6, bus: SFX });
  },
};

export const CUE_NAMES = Object.keys(CUES) as CueName[];

export const band = new Band();
export type { Band };
