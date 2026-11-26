/**
 * Short, distinct procedural vocal timbre signatures for all 6 animal fighters ([AU-07]).
 *
 * Sakurai Ep. #107 ("Voice Recording"):
 *   - Short (60-130 ms), infrequent (1.8 s per-fighter cooldown) character calls
 *     with unmistakable timbre differentiation convey life without causing battle fatigue.
 *   - Strictly Tier B, sfxRoom space, scale-locked and pitch-folded <= 2,400 Hz so
 *     fighter calls never mask Tier S/A impacts or pierce phone speakers.
 */
import { foldFreq } from './chip';
import { drum, note, type DrumId, type InstrumentId } from './instruments';
import { degreeToFreq, type ModeName } from './theory';

export type FighterVoiceId =
  | 'Orange Tabby'
  | 'Sly Fox'
  | 'Badger'
  | 'Emperor Penguin'
  | 'Corgi'
  | 'Pelican';

export type FighterCallKind = 'cheer' | 'hurt' | 'signature';

export const FIGHTER_VOICE_IDS: readonly FighterVoiceId[] = [
  'Orange Tabby',
  'Sly Fox',
  'Badger',
  'Emperor Penguin',
  'Corgi',
  'Pelican',
];

/** Minimum gap between two vocal calls from the same fighter (ms) so fast chains never spam. */
export const FIGHTER_CALL_COOLDOWN_MS = 1800;

export interface FighterVoiceMeta {
  id: FighterVoiceId;
  label: string;
  summary: string;
  primaryInst: InstrumentId;
  secondary: InstrumentId | DrumId;
  pan: number;
}

export const FIGHTER_VOICE_META: Record<FighterVoiceId, FighterVoiceMeta> = {
  'Orange Tabby': {
    id: 'Orange Tabby',
    label: 'Orange Tabby',
    summary: 'Cheeky rising-falling cat-chirp glide (flute + whistle)',
    primaryInst: 'flute',
    secondary: 'whistle',
    pan: -0.22,
  },
  'Sly Fox': {
    id: 'Sly Fox',
    label: 'Sly Fox',
    summary: 'Sharp staccato double-yip (clav + banjo)',
    primaryInst: 'clav',
    secondary: 'banjo',
    pan: 0.24,
  },
  Badger: {
    id: 'Badger',
    label: 'Badger',
    summary: 'Gruff low chesty bark (horn + brassStab)',
    primaryInst: 'horn',
    secondary: 'brassStab',
    pan: -0.18,
  },
  'Emperor Penguin': {
    id: 'Emperor Penguin',
    label: 'Emperor Penguin',
    summary: 'Crystalline icy trill (celesta + glass <= 2.4 kHz)',
    primaryInst: 'celesta',
    secondary: 'glass',
    pan: 0.2,
  },
  Corgi: {
    id: 'Corgi',
    label: 'Corgi',
    summary: 'Bouncy playful arf-pop (marimba + woodblock)',
    primaryInst: 'marimba',
    secondary: 'woodblock',
    pan: -0.25,
  },
  Pelican: {
    id: 'Pelican',
    label: 'Pelican',
    summary: 'Hollow bill-clack + mellow swoop (woodblockLo + vibes)',
    primaryInst: 'vibes',
    secondary: 'woodblockLo',
    pan: 0.22,
  },
};

export interface FighterCallCtx {
  t: number;
  g: number;
  mode: ModeName;
  key: number;
  root: number;
}

export const isFighterVoiceId = (fighter: string): fighter is FighterVoiceId =>
  fighter in FIGHTER_VOICE_META;

const semi = (freq: number, semis: number) => foldFreq(freq * Math.pow(2, semis / 12), 2400);

/** Synthesize one 60-130 ms Tier B scale-locked fighter call on the chip. */
export const playFighterVoice = (
  fighter: string,
  kind: FighterCallKind,
  c: FighterCallCtx
): boolean => {
  if (!isFighterVoiceId(fighter)) return false;
  const meta = FIGHTER_VOICE_META[fighter];
  const f = (deg: number, oct: number) => foldFreq(degreeToFreq(c.mode, c.key, c.root + deg, oct), 2400);
  const opt = { bus: 'sfx' as const, tier: 'B' as const, space: 'sfxRoom' as const, pan: meta.pan };
  const isHurt = kind === 'hurt';
  const isCheer = kind === 'cheer';

  switch (fighter) {
    case 'Orange Tabby': {
      // Cheeky rising-falling cat-chirp glide (+4 -> 0 semitone bend)
      const base = f(isCheer ? 4 : 2, 5);
      const peak = isHurt ? semi(base, -3) : semi(base, 4);
      note('flute', base, c.t, 0.06, { ...opt, vol: 0.72, slideTo: peak });
      note('whistle', peak, c.t + 0.052, 0.068, { ...opt, vol: 0.56, slideTo: isHurt ? semi(base, -5) : base });
      return true;
    }
    case 'Sly Fox': {
      // Sharp staccato double-yip (clav + banjo, tight 32nd-note snap)
      const step = Math.min(0.055, Math.max(0.038, c.g * 0.85));
      const d1 = isHurt ? 4 : isCheer ? 4 : 2;
      const d2 = isHurt ? 1 : isCheer ? 9 : 7;
      note('clav', f(d1, 5), c.t, 0.045, { ...opt, vol: 0.82 });
      note('banjo', f(d2, 5), c.t + step, 0.065, { ...opt, vol: 0.78 });
      return true;
    }
    case 'Badger': {
      // Gruff low chesty bark (horn + brassStab octave 2-3 grit)
      const rootF = f(0, 2);
      const barkTo = isHurt ? semi(rootF, -2) : f(isCheer ? 4 : 2, 3);
      note('horn', rootF, c.t, 0.09, { ...opt, vol: 0.8, slideTo: barkTo });
      note('brassStab', f(isHurt ? 0 : 4, 2), c.t + 0.012, 0.085, { ...opt, vol: 0.72 });
      return true;
    }
    case 'Emperor Penguin': {
      // Crystalline icy trill (celesta + glass, crisp double-pip strictly <= 2,400 Hz)
      const f1 = f(isHurt ? 4 : 4, 5);
      const f2 = f(isHurt ? 2 : isCheer ? 9 : 7, 5);
      note('celesta', f1, c.t, 0.055, { ...opt, vol: 0.75 });
      note('celesta', f2, c.t + 0.048, 0.072, { ...opt, vol: 0.78 });
      note('glass', f2, c.t + 0.02, 0.095, { ...opt, vol: 0.52 });
      return true;
    }
    case 'Corgi': {
      // Bouncy playful arf-pop (marimba + woodblock, upbeat fifth)
      drum('woodblock', c.t, 0.52, 'sfx', meta.pan, false, 'B', 'dry');
      note('marimba', f(isHurt ? 2 : 0, 5), c.t, 0.05, { ...opt, vol: 0.8 });
      note('marimba', f(isHurt ? 0 : isCheer ? 7 : 4, 5), c.t + 0.055, 0.068, { ...opt, vol: 0.82 });
      return true;
    }
    case 'Pelican': {
      // Hollow bill-clack + mellow swoop (woodblockLo + vibes)
      drum('woodblockLo', c.t, 0.65, 'sfx', meta.pan, false, 'B', 'dry');
      const hi = f(isCheer ? 7 : 4, 4);
      const lo = f(isHurt ? -2 : 0, 4);
      note('vibes', hi, c.t + 0.015, 0.11, { ...opt, vol: 0.74, slideTo: lo });
      return true;
    }
  }
};
