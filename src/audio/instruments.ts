/**
 * The band's instruments and its drum kit, as data on top of the chip.
 *
 * A melodic instrument is a Patch (src/audio/chip.ts): which oscillators, how
 * the note swells and fades, how bright it is and how much room it sits in.
 * A drum is a small function, because drums are noise and pitch drops rather
 * than notes. Nothing here is a recording.
 */
import { chip, type Bus, type Patch } from './chip';

export type InstrumentId =
  | 'chip' | 'chipSoft' | 'bell' | 'glock' | 'celesta' | 'musicbox' | 'kalimba' | 'marimba' | 'vibes' | 'steel'
  | 'pluck' | 'harp' | 'pizz' | 'banjo' | 'clav' | 'brass' | 'horn' | 'strings' | 'choir' | 'organ'
  | 'glass' | 'flute' | 'whistle' | 'accordion' | 'saw' | 'theremin' | 'sub' | 'toy';

export const INSTRUMENTS: Record<InstrumentId, Patch> = {
  // The Game Boy voices the tune was born on
  chip: { osc: 'pulse', duty: 0.25, a: 0.004, d: 0.3, s: 0.65, r: 0.04, vol: 0.16 },
  chipSoft: { osc: 'pulse', duty: 0.5, a: 0.004, d: 0.12, s: 0, r: 0.04, vol: 0.2 },

  // Bells and mallets: the casino floor
  bell: { osc: 'sine', fm: { ratio: 3.5, index: 2.2, decay: 0.35 }, a: 0.002, d: 1.1, s: 0, r: 0.2, vol: 0.2, space: 'hall' },
  glock: { osc: 'sine', partials: [[4, 0.28]], fm: { ratio: 7, index: 0.6, decay: 0.05 }, a: 0.001, d: 0.5, s: 0, r: 0.1, vol: 0.2, space: 'hall' },
  celesta: { osc: 'triangle', fm: { ratio: 4, index: 0.9, decay: 0.12 }, a: 0.002, d: 0.7, s: 0, r: 0.1, vol: 0.2, space: 'room' },
  musicbox: { osc: 'sine', fm: { ratio: 5.4, index: 1.4, decay: 0.2 }, partials: [[2, 0.15]], a: 0.001, d: 0.9, s: 0, r: 0.1, vol: 0.17, space: 'hall' },
  kalimba: { osc: 'sine', fm: { ratio: 2.76, index: 1.3, decay: 0.06 }, a: 0.001, d: 0.42, s: 0, r: 0.1, vol: 0.24, space: 'room' },
  marimba: { osc: 'sine', partials: [[4, 0.22]], fm: { ratio: 1, index: 0.7, decay: 0.03 }, a: 0.001, d: 0.28, s: 0, r: 0.05, vol: 0.27, space: 'room' },
  vibes: { osc: 'sine', fm: { ratio: 4, index: 0.45, decay: 0.3 }, vibrato: 0.004, a: 0.003, d: 1.3, s: 0, r: 0.2, vol: 0.2, space: 'hall' },
  steel: { osc: 'sine', partials: [[2, 0.35]], fm: { ratio: 2, index: 1.5, decay: 0.14 }, a: 0.002, d: 0.55, s: 0, r: 0.1, vol: 0.2, space: 'room' },

  // Plucked strings
  pluck: { osc: 'sawtooth', lp: { hz: 2.2, track: true, env: 5, decay: 0.12, q: 1.2 }, a: 0.002, d: 0.26, s: 0, r: 0.05, vol: 0.2, space: 'room' },
  harp: { osc: 'triangle', partials: [[2, 0.3], [3, 0.1]], a: 0.003, d: 0.9, s: 0, r: 0.2, vol: 0.24, space: 'hall' },
  pizz: { osc: 'triangle', partials: [[2, 0.2]], lp: { hz: 2600 }, a: 0.002, d: 0.16, s: 0, r: 0.04, vol: 0.28, space: 'room' },
  banjo: { osc: 'pulse', duty: 0.25, lp: { hz: 3, track: true, env: 4, decay: 0.07 }, a: 0.001, d: 0.3, s: 0, r: 0.05, vol: 0.17, space: 'room' },
  clav: { osc: 'pulse', duty: 0.125, lp: { hz: 4, track: true, env: 3, decay: 0.05, q: 2 }, a: 0.001, d: 0.15, s: 0, r: 0.03, vol: 0.18 },

  // The orchestra: brass, strings, voices
  brass: { osc: 'sawtooth', detune: 9, lp: { hz: 2.5, track: true, env: 2.2, decay: 0.18 }, a: 0.03, d: 0.2, s: 0.75, r: 0.09, vol: 0.14, space: 'room' },
  horn: { osc: 'triangle', partials: [[2, 0.35], [3, 0.12]], lp: { hz: 1500 }, a: 0.05, d: 0.2, s: 0.8, r: 0.12, vol: 0.2, space: 'hall' },
  strings: { osc: 'sawtooth', detune: 13, lp: { hz: 2300 }, vibrato: 0.003, a: 0.11, d: 0.3, s: 0.8, r: 0.3, vol: 0.13, space: 'hall' },
  choir: { osc: 'triangle', detune: 10, partials: [[2, 0.25]], lp: { hz: 1100 }, vibrato: 0.005, a: 0.14, d: 0.3, s: 0.85, r: 0.35, vol: 0.18, space: 'hall' },
  organ: { osc: 'sine', partials: [[2, 0.5], [3, 0.3], [4, 0.18]], a: 0.008, d: 0.1, s: 0.9, r: 0.06, vol: 0.13, space: 'room' },

  // Air and glass
  glass: { osc: 'sine', fm: { ratio: 2, index: 0.3, decay: 0.5 }, a: 0.07, d: 1.5, s: 0, r: 0.3, vol: 0.2, space: 'hall' },
  flute: { osc: 'triangle', vibrato: 0.006, a: 0.04, d: 0.15, s: 0.85, r: 0.08, vol: 0.24, space: 'room' },
  whistle: { osc: 'sine', vibrato: 0.008, a: 0.03, d: 0.1, s: 0.9, r: 0.06, vol: 0.2, space: 'room' },
  accordion: { osc: 'pulse', duty: 0.5, detune: 7, lp: { hz: 2800 }, a: 0.03, d: 0.1, s: 0.9, r: 0.07, vol: 0.13 },

  // Power: the sound of an evolution
  saw: { osc: 'sawtooth', detune: 19, lp: { hz: 5, track: true, env: 1.5, decay: 0.2 }, a: 0.004, d: 0.3, s: 0.45, r: 0.12, vol: 0.14, space: 'echo' },
  theremin: { osc: 'sine', vibrato: 0.012, a: 0.06, d: 0.2, s: 0.9, r: 0.2, vol: 0.2, space: 'hall' },
  sub: { osc: 'sine', a: 0.004, d: 0.3, s: 0.6, r: 0.08, vol: 0.24 },
  toy: { osc: 'triangle', fm: { ratio: 6, index: 0.5, decay: 0.04 }, a: 0.001, d: 0.22, s: 0, r: 0.04, vol: 0.22 },
};

export const INSTRUMENT_NAMES: Record<InstrumentId, string> = {
  chip: 'Chip lead', chipSoft: 'Chip blip', bell: 'Bell', glock: 'Glockenspiel', celesta: 'Celesta', musicbox: 'Music box',
  kalimba: 'Kalimba', marimba: 'Marimba', vibes: 'Vibraphone', steel: 'Steel drum', pluck: 'Plucked synth', harp: 'Harp',
  pizz: 'Pizzicato strings', banjo: 'Banjo', clav: 'Clavinet', brass: 'Brass', horn: 'French horn', strings: 'Strings',
  choir: 'Choir', organ: 'Organ', glass: 'Glass harmonica', flute: 'Flute', whistle: 'Whistle', accordion: 'Accordion',
  saw: 'Supersaw', theremin: 'Theremin', sub: 'Sub bass', toy: 'Toy piano',
};

export interface NoteOpts {
  vol?: number;
  pan?: number;
  bus?: Bus;
  soft?: boolean;
  slideTo?: number;
}

/** Play one note on an instrument. */
export const note = (inst: InstrumentId, freq: number, at: number, dur: number, o: NoteOpts = {}) =>
  chip.play(INSTRUMENTS[inst], { freq, at, dur, ...o });

// ─── Drum kit ───────────────────────────────────────────────────────────────

export type DrumId =
  | 'kick' | 'snare' | 'hat' | 'openHat' | 'clap' | 'shaker' | 'tamb' | 'cowbell' | 'woodblock' | 'woodblockLo'
  | 'rim' | 'sleigh' | 'tick' | 'crash' | 'ride' | 'timpani' | 'taiko' | 'tom' | 'crackle' | 'thud' | 'chain' | 'anvil';

type Hit = (at: number, vol: number, bus: Bus, pan?: number, soft?: boolean) => void;

const SINE: Patch = { osc: 'sine', a: 0.001, d: 0.2, s: 0, r: 0.02, vol: 1 };
const drop = (from: number, to: number, d: number, vol: number): Hit => (at, v, bus, pan, soft) =>
  chip.play({ ...SINE, d }, { freq: from, slideTo: to, at, dur: d * 0.7, vol: vol * v, bus, pan, soft });

export const DRUMS: Record<DrumId, Hit> = {
  kick: (at, v, bus, pan, soft) => {
    drop(155, 44, 0.16, 0.85)(at, v, bus, pan, soft);
    chip.noise({ at, dur: 0.02, vol: 0.3 * v, filter: 3500, bus, soft });
  },
  snare: (at, v, bus, pan, soft) => {
    chip.noise({ at, dur: 0.13, vol: 0.62 * v, filter: 2400, bus, pan, soft });
    drop(210, 150, 0.07, 0.3)(at, v, bus, pan, soft);
  },
  hat: (at, v, bus, pan, soft) => chip.noise({ at, dur: 0.035, vol: 0.26 * v, short: true, filter: 8500, type: 'highpass', bus, pan, soft }),
  openHat: (at, v, bus, pan, soft) => chip.noise({ at, dur: 0.16, vol: 0.24 * v, short: true, filter: 7500, type: 'highpass', bus, pan, soft }),
  clap: (at, v, bus, pan, soft) => {
    for (const dt of [0, 0.011, 0.023]) chip.noise({ at: at + dt, dur: dt === 0.023 ? 0.14 : 0.02, vol: 0.5 * v, filter: 1500, bus, pan, space: 'room', soft });
  },
  shaker: (at, v, bus, pan, soft) => chip.noise({ at, dur: 0.05, vol: 0.2 * v, filter: 6200, type: 'highpass', attack: 0.012, bus, pan, soft }),
  tamb: (at, v, bus, pan, soft) => {
    chip.noise({ at, dur: 0.09, vol: 0.24 * v, short: true, filter: 9000, type: 'highpass', bus, pan, soft });
    chip.noise({ at: at + 0.03, dur: 0.05, vol: 0.14 * v, short: true, filter: 10000, type: 'highpass', bus, pan, soft });
  },
  cowbell: (at, v, bus, pan, soft) => {
    for (const f of [540, 806]) chip.tone({ voice: 'pulse2', duty: 0.5, freq: f, at, dur: 0.11, vol: 0.34 * v, decay: 0.95, bus, pan, soft });
  },
  woodblock: (at, v, bus, pan, soft) => chip.play({ ...SINE, d: 0.05, fm: { ratio: 2.4, index: 1.2, decay: 0.02 } }, { freq: 1150, at, dur: 0.04, vol: 0.5 * v, bus, pan, soft }),
  woodblockLo: (at, v, bus, pan, soft) => chip.play({ ...SINE, d: 0.06, fm: { ratio: 2.4, index: 1.2, decay: 0.02 } }, { freq: 760, at, dur: 0.04, vol: 0.5 * v, bus, pan, soft }),
  rim: (at, v, bus, pan, soft) => {
    chip.play({ ...SINE, d: 0.03 }, { freq: 1700, at, dur: 0.02, vol: 0.4 * v, bus, pan, soft });
    chip.noise({ at, dur: 0.02, vol: 0.3 * v, filter: 4200, bus, pan, soft });
  },
  sleigh: (at, v, bus, pan, soft) => {
    for (const [f, dt] of [[5200, 0], [6100, 0.012], [7300, 0.02]] as const) chip.play({ ...SINE, d: 0.09 }, { freq: f, at: at + dt, dur: 0.05, vol: 0.12 * v, bus, pan, space: 'room', soft });
  },
  tick: (at, v, bus, pan, soft) => chip.play({ ...SINE, d: 0.022 }, { freq: 2100, at, dur: 0.015, vol: 0.34 * v, bus, pan, soft }),
  crash: (at, v, bus, pan) => chip.noise({ at, dur: 1.3, vol: 0.44 * v, short: true, filter: 5200, type: 'highpass', bus, pan, space: 'hall' }),
  ride: (at, v, bus, pan, soft) => chip.noise({ at, dur: 0.3, vol: 0.16 * v, short: true, filter: 9500, type: 'highpass', bus, pan, soft }),
  timpani: (at, v, bus, pan, soft) => {
    drop(98, 82, 0.55, 0.8)(at, v, bus, pan, soft);
    chip.noise({ at, dur: 0.06, vol: 0.3 * v, filter: 700, bus, space: 'hall', soft });
  },
  taiko: (at, v, bus, pan, soft) => {
    drop(120, 58, 0.32, 0.9)(at, v, bus, pan, soft);
    chip.noise({ at, dur: 0.09, vol: 0.5 * v, filter: 900, type: 'lowpass', bus, pan, space: 'room', soft });
  },
  tom: (at, v, bus, pan, soft) => drop(190, 110, 0.2, 0.6)(at, v, bus, pan, soft),
  crackle: (at, v, bus, pan, soft) => {
    for (let i = 0; i < 4; i++) chip.noise({ at: at + i * 0.027 + (i % 2) * 0.008, dur: 0.018, vol: 0.34 * v, short: true, filter: 3000 + i * 1300, bus, pan, soft });
  },
  thud: (at, v, bus, pan, soft) => {
    drop(90, 38, 0.24, 0.9)(at, v, bus, pan, soft);
    chip.noise({ at, dur: 0.1, vol: 0.4 * v, filter: 420, type: 'lowpass', bus, soft });
  },
  chain: (at, v, bus, pan, soft) => {
    for (const [f, dt] of [[2300, 0], [3100, 0.03], [2700, 0.055]] as const) chip.play({ ...SINE, d: 0.05, fm: { ratio: 3.3, index: 2, decay: 0.03 } }, { freq: f, at: at + dt, dur: 0.03, vol: 0.2 * v, bus, pan, soft });
  },
  anvil: (at, v, bus, pan, soft) => chip.play({ ...SINE, d: 0.4, fm: { ratio: 5.1, index: 3, decay: 0.2 } }, { freq: 980, at, dur: 0.2, vol: 0.3 * v, bus, pan, space: 'room', soft }),
};

/** Hit one drum. */
export const drum = (id: DrumId, at: number, vol = 1, bus: Bus = 'music', pan?: number, soft?: boolean) => DRUMS[id](at, vol, bus, pan, soft);

// ─── Movie-trailer one-shots ────────────────────────────────────────────────

/** A rising sweep that lands at `at + dur`: something big is about to happen. */
export const riser = (at: number, dur: number, vol = 1, bus: Bus = 'sfx') => {
  chip.noise({ at, dur: dur + 0.04, vol: 0.5 * vol, filter: 500, sweepTo: 9000, attack: dur, bus, space: 'room' });
  chip.play(INSTRUMENTS.saw, { freq: 110, slideTo: 880, at, dur, vol: 0.5 * vol, bus });
};

/** The opposite: the power drains away. */
export const downlifter = (at: number, dur: number, vol = 1, bus: Bus = 'sfx') => {
  chip.noise({ at, dur, vol: 0.4 * vol, filter: 7000, sweepTo: 250, bus, space: 'room' });
  chip.play({ ...SINE, d: dur }, { freq: 440, slideTo: 55, at, dur, vol: 0.3 * vol, bus });
};

/** A sub-bass drop under a huge hit. */
export const subDrop = (at: number, vol = 1, bus: Bus = 'sfx') =>
  chip.play({ ...SINE, d: 0.7 }, { freq: 110, slideTo: 30, at, dur: 0.5, vol: 0.85 * vol, bus });
