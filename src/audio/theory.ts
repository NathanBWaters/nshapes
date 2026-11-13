/**
 * The music theory the score runs on. Pure: no audio, fully tested.
 *
 * Everything the game plays (the tune, a weapon's riff, a coin, a jackpot) is
 * written in SCALE DEGREES, not notes. A degree is resolved against the key
 * and mode the band is in at that moment, so every sound is always in tune
 * with the music, whatever state the fight is in.
 */

export type ModeName = 'lydian' | 'ionian' | 'mixolydian' | 'dorian' | 'aeolian';

/** Semitones of each scale degree above the tonic */
export const MODES: Record<ModeName, number[]> = {
  lydian: [0, 2, 4, 6, 7, 9, 11],
  ionian: [0, 2, 4, 5, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
};

/** Brightest to darkest. Losing hearts walks the tune down this list; an evolution walks it up. */
export const BRIGHTNESS: ModeName[] = ['lydian', 'ionian', 'mixolydian', 'dorian', 'aeolian'];

/** `steps` darker (positive) or brighter (negative), stopping at the ends. */
export const shade = (mode: ModeName, steps: number): ModeName => {
  const i = BRIGHTNESS.indexOf(mode) + Math.round(steps);
  return BRIGHTNESS[Math.max(0, Math.min(BRIGHTNESS.length - 1, i))];
};

export const isMinor = (mode: ModeName): boolean => mode === 'dorian' || mode === 'aeolian';

/**
 * The four-bar chord loop, as the scale degree of each chord's root. The tune
 * was written over I vi IV V; each mode swaps out the one chord that would
 * turn sour in it (lydian's IV and dorian's vi are diminished), for the chord
 * that mode is famous for.
 */
export const PROGRESSIONS: Record<ModeName, number[]> = {
  lydian: [0, 5, 1, 4],     // I  vi  II  V
  ionian: [0, 5, 3, 4],     // I  vi  IV  V
  mixolydian: [0, 5, 3, 4], // I  vi  IV  v
  dorian: [0, 3, 6, 4],     // i  IV  bVII v
  aeolian: [0, 5, 3, 4],    // i  bVI iv  v
};

/** Root degree of the chord under bar `bar`. */
export const chordRoot = (mode: ModeName, bar: number): number => PROGRESSIONS[mode][((bar % 4) + 4) % 4];

/** Semitones above the tonic of any degree (negative and beyond-the-octave degrees wrap by octaves). */
export const degreeToSemis = (mode: ModeName, degree: number): number => {
  const d = Math.round(degree);
  const octave = Math.floor(d / 7);
  return MODES[mode][((d % 7) + 7) % 7] + 12 * octave;
};

export const midiToFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** MIDI note of `degree` in `octave` (octave 4 holds middle C when the key is C). */
export const degreeToMidi = (mode: ModeName, key: number, degree: number, octave: number): number =>
  12 * (octave + 1) + key + degreeToSemis(mode, degree);

export const degreeToFreq = (mode: ModeName, key: number, degree: number, octave: number): number =>
  midiToFreq(degreeToMidi(mode, key, degree, octave));

const LETTER_DEGREE: Record<string, number> = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

/** "E5" → its scale degree and octave. The tune is written in C major, so letters are degrees. */
export const parseNote = (token: string): { degree: number; octave: number } | null => {
  const m = /^([A-G])(-?\d)$/.exec(token);
  return m ? { degree: LETTER_DEGREE[m[1]], octave: parseInt(m[2], 10) } : null;
};

/** The i-th tone of a chord built on `root`, stacking thirds: root, third, fifth, seventh, ninth… */
export const chordTone = (root: number, i: number): number => root + 2 * i;

/** Root, third, fifth and the octave: the four notes of a strum. */
export const strum = (root: number): number[] => [root, root + 2, root + 4, root + 7];

/**
 * The streak ladder: the notes a run of Sets climbs. Five-note scales have no
 * sour note over any chord of the loop, so every rung is safe: major
 * pentatonic in the bright modes, minor pentatonic in the dark ones.
 */
export const ladderDegree = (mode: ModeName, rung: number): number => {
  const scale = isMinor(mode) ? [0, 2, 3, 4, 6] : [0, 1, 2, 4, 5];
  const r = Math.max(0, Math.round(rung));
  return scale[r % 5] + 7 * Math.floor(r / 5);
};

/** The rung a combo of `combo` Sets rings (1 Set = the tonic), capped three octaves up. */
export const LADDER_TOP = 14;
export const ladderRung = (combo: number): number => Math.max(0, Math.min(LADDER_TOP, Math.round(combo) - 1));

/** Time of the first grid line at or after `earliest`, for a grid of `gridDur` seconds that has a line at `origin`. */
export const nextGridTime = (earliest: number, origin: number, gridDur: number): number => {
  if (gridDur <= 0) return earliest;
  const n = Math.ceil((earliest - origin) / gridDur - 1e-9);
  return origin + n * gridDur;
};

/** A small, stable hash of a string (FNV-1a): the same weapon always gets the same voice. */
export const hashOf = (text: string): number => {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};
