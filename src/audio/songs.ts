/**
 * Songs are text. One theme melody, many arrangements.
 *
 * Every biome / battle arrangement plays the SAME melody over the SAME chords,
 * so switching arrangement on a bar line sounds like the song continuing
 * (poteto's biome transitions) instead of a hard cut.
 *
 * Token grammar (one token per 16th-note step):
 *   C5  → play note        -  → hold previous note        .  → rest
 * Bass tokens: R root · 3 third · 5 fifth · 8 octave · 7 flat-seventh
 * Drum tokens: k kick · s snare · h hat · o open hat
 */
import type { Duty } from './chip';

const bars = (text: string): string[] =>
  text.trim().split(/\s+/).filter(t => t !== '|');

export const THEME = bars(`
  E5 - G5 - C6 - - - B5 - G5 - E5 - - - |
  A5 - - - G5 - E5 - C5 - D5 - E5 - - - |
  F5 - A5 - C6 - A5 - G5 - F5 - E5 - D5 - |
  D5 - - - G5 - - - B4 - D5 - G5 - - - |
  E5 - G5 - C6 - - - D6 - C6 - B5 - G5 - |
  A5 - - - C6 - A5 - E5 - - - G5 - - - |
  F5 - E5 - F5 - A5 - G5 - F5 - E5 - D5 - |
  D5 - E5 - D5 - B4 - C5 - - - - - . . |
`);

/** Calmer B-section used by the map so it doesn't loop the hook forever. */
export const THEME_B = bars(`
  C5 - - - E5 - - - G5 - - - E5 - - - |
  A4 - - - C5 - - - E5 - - - C5 - - - |
  F4 - - - A4 - - - C5 - - - A4 - - - |
  G4 - - - B4 - - - D5 - - - G5 - - - |
  C5 - E5 - G5 - E5 - C5 - E5 - G5 - - - |
  A4 - C5 - E5 - C5 - A4 - C5 - E5 - - - |
  F4 - A4 - C5 - F5 - E5 - D5 - C5 - B4 - |
  G4 - - - - - - - . . . . . . . . |
`);

export const CHORDS: Array<{ root: string; minor: boolean }> = [
  { root: 'C', minor: false },
  { root: 'A', minor: true },
  { root: 'F', minor: false },
  { root: 'G', minor: false },
  { root: 'C', minor: false },
  { root: 'A', minor: true },
  { root: 'F', minor: false },
  { root: 'G', minor: false },
];

export interface Arrangement {
  bpm: number;
  leadDuty: Duty;
  leadOctave: number;   // semitone offset for the lead (12 = up an octave)
  leadVibrato: number;
  leadVol: number;
  bass: string[];       // 16 tokens, repeats every bar
  bassOctave: number;
  drums: string[];      // 16 tokens
  arp: boolean;         // 16th-note chord arpeggio on pulse2
  arpDuty: Duty;
  useB: boolean;        // alternate A/B sections
}

export const ARRANGEMENTS: Record<string, Arrangement> = {
  map: {
    bpm: 108, leadDuty: 0.5, leadOctave: 0, leadVibrato: 0.004, leadVol: 0.45,
    bass: bars('R . . . 5 . . . R . . . 5 . 8 .'), bassOctave: 2,
    drums: bars('k . . . h . . . s . . . h . . .'), arp: false, arpDuty: 0.125, useB: true,
  },
  meadow: {
    bpm: 120, leadDuty: 0.5, leadOctave: 0, leadVibrato: 0.003, leadVol: 0.5,
    bass: bars('R . . R 5 . . . R . . R 5 . 8 .'), bassOctave: 2,
    drums: bars('k . h . s . h . k . h . s . h .'), arp: false, arpDuty: 0.125, useB: false,
  },
  woods: {
    bpm: 112, leadDuty: 0.25, leadOctave: 0, leadVibrato: 0.008, leadVol: 0.45,
    bass: bars('R . . R 5 . . . 8 . . 5 . . 3 .'), bassOctave: 2,
    drums: bars('k . h . . . h . s . h . . . h .'), arp: true, arpDuty: 0.125, useB: false,
  },
  canyon: {
    bpm: 132, leadDuty: 0.125, leadOctave: 0, leadVibrato: 0.004, leadVol: 0.5,
    bass: bars('R . R . 8 . R . R . R . 8 . 5 .'), bassOctave: 2,
    drums: bars('k . h . s . h k k . h . s . h h'), arp: false, arpDuty: 0.25, useB: false,
  },
  peaks: {
    bpm: 116, leadDuty: 0.5, leadOctave: 12, leadVibrato: 0.006, leadVol: 0.35,
    bass: bars('R - - - - - - - 5 - - - - - - -'), bassOctave: 2,
    drums: bars('k . . . . . h . s . . . . . h .'), arp: true, arpDuty: 0.25, useB: false,
  },
  boss: {
    bpm: 150, leadDuty: 0.125, leadOctave: 0, leadVibrato: 0.002, leadVol: 0.5,
    bass: bars('R R 8 R R R 8 R R R 8 R 5 5 8 5'), bassOctave: 2,
    drums: bars('k h s h k h s h k k s h k h s s'), arp: true, arpDuty: 0.125, useB: false,
  },
};

/** Short one-shot jingles: [note, steps] at a fixed tempo. */
export const JINGLES: Record<string, { bpm: number; duty: Duty; notes: Array<[string, number]> }> = {
  victory: { bpm: 180, duty: 0.25, notes: [['C5', 1], ['E5', 1], ['G5', 1], ['C6', 3], ['G5', 1], ['C6', 6]] },
  defeat: { bpm: 140, duty: 0.5, notes: [['G4', 2], ['F#4', 2], ['F4', 2], ['E4', 6]] },
  levelup: { bpm: 220, duty: 0.25, notes: [['C5', 1], ['E5', 1], ['G5', 1], ['C6', 1], ['E6', 1], ['G6', 3]] },
  unlock: { bpm: 200, duty: 0.125, notes: [['G5', 1], ['C6', 1], ['E6', 1], ['G6', 2], ['.', 1], ['E6', 1], ['G6', 4]] },
};
