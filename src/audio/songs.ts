/**
 * Songs are text. One theme melody, many arrangements.
 *
 * Every biome / battle arrangement plays the SAME iconic melody over compatible
 * modal progressions, so switching arrangement on a bar line sounds like the
 * song continuing (poteto's biome transitions) instead of a hard cut.
 *
 * Structure ([AU-17], [AU-18], [AU-20]):
 *   - INTRO_PICKUP (1 bar / 16 steps): crisp pickup played once on enterFight()
 *   - THEME (8 bars / 128 steps): A-section signature hook (canonical Ionian)
 *   - THEME_BATTLE_B (8 bars / 128 steps): syncopated battle B-section with
 *     bars 13-14 lift & triumphant turnaround (16-bar A-B battle form)
 *   - THEME_B (8 bars / 128 steps): calmer B-section for map / title / camp / story
 *
 * Token grammar (one token per 16th-note step):
 *   C5  → play note        -  → hold previous note        .  → rest
 * Bass tokens: R root · 3 third · 5 fifth · 8 octave · 7 flat-seventh
 * Drum tokens: k kick · s snare · h hat · o open hat
 */
import type { Duty } from './chip';

const bars = (text: string): string[] =>
  text.trim().split(/\s+/).filter(t => t !== '|');

/** Crisp 1-bar (16-step) battle intro pickup played once on fresh enterFight() ([AU-17]). */
export const INTRO_PICKUP = bars(`
  . . . . G4 - B4 - D5 - G5 - B5 - D6 -
`);

/**
 * Canonical 8-bar NShapes A-section signature motif ([AU-17], [AU-19]).
 * Bars 1-4 preserve the iconic opening hook (E5-G5-C6-B5-G5-E5); bar 8
 * resolves cleanly through V chord tones (D5-E5-G5-B4-D5) without C5 rubbing V.
 */
export const THEME = bars(`
  E5 - G5 - C6 - - - B5 - G5 - E5 - - - |
  A5 - - - G5 - E5 - C5 - D5 - E5 - - - |
  F5 - A5 - C6 - A5 - G5 - F5 - E5 - D5 - |
  D5 - - - G5 - - - B4 - D5 - G5 - - - |
  E5 - G5 - C6 - - - D6 - C6 - B5 - G5 - |
  A5 - - - C6 - A5 - E5 - - - G5 - - - |
  F5 - E5 - F5 - A5 - G5 - F5 - E5 - D5 - |
  D5 - E5 - G5 - B4 - D5 - - - - - . . |
`);

/** Calmer 8-bar B-section used by map, title, camp & story screens. */
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

/**
 * Contrasting 8-bar battle B-section ([AU-17]):
 * syncopated rhythmic bounce (bars 9-12), rising pre-climax lift (bars 13-14),
 * and triumphant turnaround (bar 16) launching cleanly back into bar 1.
 */
export const THEME_BATTLE_B = bars(`
  G5 - . E5 G5 - A5 - G5 - . E5 C5 - - - |
  A5 - . G5 A5 - C6 - A5 - . E5 A4 - C5 - |
  F5 - . A5 C6 - A5 - G5 - . F5 E5 - D5 - |
  G5 - . F5 G5 - B5 - D6 - - - G5 - . . |
  C6 - . B5 C6 - D6 - E6 - . D6 C6 - G5 - |
  A5 - . C6 E6 - D6 - C6 - . A5 G5 - E5 - |
  F5 - A5 - C6 - D6 - C6 - A5 - G5 - F5 - |
  G5 - A5 - B5 - D6 - G5 - - - . . . . |
`);

export type ArrangementStyle = 'battle' | 'map' | 'title' | 'story' | 'camp';

export interface Arrangement {
  bpm: number;
  leadDuty: Duty;
  leadOctave: number; // semitone offset for the lead (12 = up an octave)
  leadVibrato: number;
  leadVol: number;
  bass: string[]; // 16 tokens, repeats every bar
  bassOctave: number;
  drums: string[]; // 16 tokens
  arp: boolean; // 16th-note chord arpeggio on pulse2
  arpDuty: Duty;
  useB: boolean; // alternate A/B sections (16-bar form)
  sectionB: 'calm' | 'battle';
  style: ArrangementStyle;
}

export const ARRANGEMENTS: Record<string, Arrangement> = {
  // ── Non-battle screen arrangements ([AU-20]) ──────────────────────────────
  title: {
    bpm: 96, leadDuty: 0.5, leadOctave: 0, leadVibrato: 0.005, leadVol: 0.42,
    bass: bars('R - - - - - - - 5 - - - - - - -'), bassOctave: 2,
    drums: bars('. . . . . . . . . . . . . . . .'), arp: false, arpDuty: 0.25,
    useB: true, sectionB: 'calm', style: 'title',
  },
  story: {
    bpm: 88, leadDuty: 0.5, leadOctave: 0, leadVibrato: 0.006, leadVol: 0.4,
    bass: bars('R - - - - - - - - - - - 5 - - -'), bassOctave: 2,
    drums: bars('. . . . . . . . . . . . . . . .'), arp: false, arpDuty: 0.25,
    useB: true, sectionB: 'calm', style: 'story',
  },
  camp: {
    bpm: 98, leadDuty: 0.5, leadOctave: 0, leadVibrato: 0.004, leadVol: 0.44,
    bass: bars('R . . . 5 . . . R . . . 5 . . .'), bassOctave: 2,
    drums: bars('. . . . h . . . . . . . h . . .'), arp: false, arpDuty: 0.25,
    useB: true, sectionB: 'calm', style: 'camp',
  },
  map: {
    bpm: 108, leadDuty: 0.5, leadOctave: 0, leadVibrato: 0.004, leadVol: 0.45,
    bass: bars('R . . . 5 . . . R . . . 5 . 8 .'), bassOctave: 2,
    drums: bars('k . . . h . . . s . . . h . . .'), arp: false, arpDuty: 0.125,
    useB: true, sectionB: 'calm', style: 'map',
  },

  // ── Battle arrangements: 16-bar A-B form + smooth BPM curve ([AU-17], [AU-18]) ─
  meadow: {
    bpm: 118, leadDuty: 0.5, leadOctave: 0, leadVibrato: 0.003, leadVol: 0.5,
    bass: bars('R . . R 5 . . . R . . R 5 . 8 .'), bassOctave: 2,
    drums: bars('k . h . s . h . k . h . s . h .'), arp: false, arpDuty: 0.125,
    useB: true, sectionB: 'battle', style: 'battle',
  },
  woods: {
    bpm: 122, leadDuty: 0.25, leadOctave: 0, leadVibrato: 0.008, leadVol: 0.45,
    bass: bars('R . . R 5 . . . 8 . . 5 . . 3 .'), bassOctave: 2,
    drums: bars('k . h . . . h . s . h . . . h .'), arp: true, arpDuty: 0.125,
    useB: true, sectionB: 'battle', style: 'battle',
  },
  canyon: {
    bpm: 128, leadDuty: 0.125, leadOctave: 0, leadVibrato: 0.004, leadVol: 0.5,
    bass: bars('R . R . 8 . R . R . R . 8 . 5 .'), bassOctave: 2,
    drums: bars('k . h . s . h k k . h . s . h h'), arp: false, arpDuty: 0.25,
    useB: true, sectionB: 'battle', style: 'battle',
  },
  peaks: {
    bpm: 124, leadDuty: 0.5, leadOctave: 12, leadVibrato: 0.006, leadVol: 0.35,
    bass: bars('R - - - - - - - 5 - - - - - - -'), bassOctave: 2,
    drums: bars('k . . . . . h . s . . . . . h .'), arp: true, arpDuty: 0.25,
    useB: true, sectionB: 'battle', style: 'battle',
  },
  summit: {
    bpm: 136, leadDuty: 0.25, leadOctave: 0, leadVibrato: 0.004, leadVol: 0.5,
    bass: bars('R . R 8 5 . R . R . R 8 5 . 7 8'), bassOctave: 2,
    drums: bars('k . h k s . h . k . h k s . o h'), arp: true, arpDuty: 0.125,
    useB: true, sectionB: 'battle', style: 'battle',
  },
  boss: {
    bpm: 148, leadDuty: 0.125, leadOctave: 0, leadVibrato: 0.002, leadVol: 0.5,
    bass: bars('R R 8 R R R 8 R R R 8 R 5 5 8 5'), bassOctave: 2,
    drums: bars('k h s h k h s h k k s h k h s s'), arp: true, arpDuty: 0.125,
    useB: true, sectionB: 'battle', style: 'battle',
  },
};
