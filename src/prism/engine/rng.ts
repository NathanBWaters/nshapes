/**
 * Deterministic Mulberry32 PRNG, seed normalization, and Daily Seed utilities.
 * All Prism Deck randomness flows through an explicit integer `rngState` so
 * runs are 100% reproducible across platforms and save/reload cycles.
 */
import type { DailyMutatorId } from '../types';

export const DAILY_MUTATOR_ROTATION: readonly DailyMutatorId[] = [
  'golden_rush',
  'rainbow_fever',
  'glass_house',
  'tight_quarters',
  'spellstorm',
  'six_charms',
  'wildcard_wednesday',
];

/** Clean user-provided seed into a crisp uppercase alphanumeric token (max 24 chars). */
export const normalizeSeed = (raw?: string | null): string => {
  if (!raw || typeof raw !== 'string') return '';
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 24);
  return cleaned;
};

/** Generate a readable random 8-char seed when none is supplied. */
export const generateRandomSeed = (entropy: number = Date.now()): string => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let state = hashStringToSeed(`PRISM-${entropy}-${Math.floor(Math.random() * 0x7fffffff)}`);
  let out = '';
  for (let i = 0; i < 8; i++) {
    const step = nextUint32(state);
    state = step.state;
    out += alphabet[step.value % alphabet.length];
  }
  return out;
};

/** FNV-1a 32-bit string hash producing a non-zero initial Mulberry32 state. */
export const hashStringToSeed = (input: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const u = hash >>> 0;
  return u === 0 ? 0x6d2b79f5 : u;
};

/** Single pure Mulberry32 step returning `[0, 2^32 - 1]` and the next state. */
export const nextUint32 = (state: number): { value: number; state: number } => {
  const nextState = (state + 0x6d2b79f5) >>> 0;
  let t = Math.imul(nextState ^ (nextState >>> 15), 1 | nextState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  const value = (t ^ (t >>> 14)) >>> 0;
  return { value, state: nextState };
};

/** Pure float in `[0, 1)`. */
export const nextFloat = (state: number): { value: number; state: number } => {
  const step = nextUint32(state);
  return { value: step.value / 4294967296, state: step.state };
};

/** Pure integer in `[min, max]` inclusive. */
export const nextInt = (state: number, min: number, max: number): { value: number; state: number } => {
  if (max <= min) return { value: min, state };
  const span = max - min + 1;
  const step = nextUint32(state);
  return { value: min + (step.value % span), state: step.state };
};

/** Pure Fisher-Yates shuffle returning a new array and next RNG state. */
export const shuffleArray = <T>(items: readonly T[], rngState: number): { items: T[]; state: number } => {
  const copy = [...items];
  let state = rngState;
  for (let i = copy.length - 1; i > 0; i--) {
    const pick = nextInt(state, 0, i);
    state = pick.state;
    const tmp = copy[i];
    copy[i] = copy[pick.value];
    copy[pick.value] = tmp;
  }
  return { items: copy, state };
};

/** Pick one item uniformly at random from a non-empty array. */
export const pickOne = <T>(items: readonly T[], rngState: number): { item: T; state: number } => {
  const step = nextInt(rngState, 0, items.length - 1);
  return { item: items[step.value], state: step.state };
};

/** Format a Date (default: today local UTC ISO YYYY-MM-DD) as `YYYY-MM-DD`. */
export const getTodayDateString = (now: Date = new Date()): string => {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** Validate and normalize a YYYY-MM-DD date string (falls back to today UTC). */
export const normalizeDailyDate = (dateStr?: string | null): string => {
  if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
    return dateStr.trim();
  }
  return getTodayDateString();
};

/** Deterministic Daily Seed string for a `YYYY-MM-DD` calendar date. */
export const getDailySeed = (dateStr?: string | null): string => {
  const date = normalizeDailyDate(dateStr);
  return `DAILY-${date.replace(/-/g, '')}`;
};

/** Deterministic rotating Daily Mutator for a `YYYY-MM-DD` calendar date. */
export const getDailyMutatorForDate = (dateStr?: string | null): DailyMutatorId => {
  const date = normalizeDailyDate(dateStr);
  const [y, m, d] = date.split('-').map(n => Number.parseInt(n, 10));
  const dayNumber = Math.floor(Date.UTC(y, m - 1, d) / 86400000);
  const idx = ((dayNumber % DAILY_MUTATOR_ROTATION.length) + DAILY_MUTATOR_ROTATION.length) % DAILY_MUTATOR_ROTATION.length;
  return DAILY_MUTATOR_ROTATION[idx];
};

/** Days difference `dateB - dateA` for `YYYY-MM-DD` strings (1 = consecutive next day). */
export const diffCalendarDays = (dateA: string, dateB: string): number => {
  const [ya, ma, da] = dateA.split('-').map(n => Number.parseInt(n, 10));
  const [yb, mb, db] = dateB.split('-').map(n => Number.parseInt(n, 10));
  const utcA = Date.UTC(ya, ma - 1, da);
  const utcB = Date.UTC(yb, mb - 1, db);
  return Math.round((utcB - utcA) / 86400000);
};
