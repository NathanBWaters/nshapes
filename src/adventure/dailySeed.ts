/**
 * Deterministic Daily Seeds, Rotating Daily Summit Mutators, GSP-Style
 * Positive Percentile Framing, Standardized Seed URLs, and Spoiler-Free
 * Share Card Formatters for Free Play, Starfall Summit, and Adventure Mode.
 *
 * Pure TypeScript (React Native + Web + Node safe, zero side effects, zero
 * Math.random()).
 */
import type { CharacterName } from '@/types';
import type { IconName } from '@/components/Icon';
import { FIGHTERS } from './data/fighters';

export const DEFAULT_SHARE_BASE_URL = 'https://nathanbwaters.github.io/nshapes';

/** Standard 3-minute countdown for Free Play Daily Score Attack. */
export const FREE_PLAY_DAILY_DURATION_SEC = 180;

// ─── UTC Calendar & Deterministic Seed Helpers ──────────────────────────────

/** Format a Date (default: today UTC) as `YYYY-MM-DD`. */
export const getTodayUtcDate = (now: Date = new Date()): string => {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

/** True when `raw` is a valid real calendar `YYYY-MM-DD` date string. */
export const isValidDateKey = (raw?: string | null): boolean => {
  if (!raw || typeof raw !== 'string') return false;
  const trimmed = raw.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return false;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

/** Normalize a `YYYY-MM-DD` date key, falling back to today UTC when invalid or absent. */
export const normalizeDateKey = (raw?: string | null, fallbackNow: Date = new Date()): string =>
  isValidDateKey(raw) ? raw!.trim() : getTodayUtcDate(fallbackNow);

/** Exact UTC day number since Unix epoch for a valid `YYYY-MM-DD` key. */
export const utcDayNumber = (dateKey: string): number => {
  const [y, m, d] = normalizeDateKey(dateKey).split('-').map(n => Number.parseInt(n, 10));
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
};

/** Signed calendar-day delta `dateB - dateA` (1 means consecutive next day). */
export const diffUtcDays = (dateA: string, dateB: string): number =>
  utcDayNumber(dateB) - utcDayNumber(dateA);

/** FNV-1a 32-bit hash returning a strictly positive 31-bit integer seed (`1..2^31-1`). */
export const hashSeedString = (input: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  const positive = (hash >>> 0) & 0x7fffffff;
  return positive === 0 ? 0x6d2b79f5 & 0x7fffffff : positive;
};

/** Parse an integer seed (`"4242"` → `4242`) or deterministically hash an alphanumeric token. */
export const parseNumericSeed = (raw?: string | null): number | undefined => {
  if (!raw || typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (/^\d{1,10}$/.test(trimmed)) {
    const n = Number.parseInt(trimmed, 10);
    if (Number.isSafeInteger(n) && n > 0) return n & 0x7fffffff || 1;
  }
  return hashSeedString(trimmed.toUpperCase());
};

export type DailySeedScope = 'freeplay' | 'summit' | 'adventure';

/** Deterministic positive 31-bit seed for a given mode scope and UTC calendar day. */
export const dailySeedFor = (scope: DailySeedScope, dateKey?: string | null): number => {
  const day = normalizeDateKey(dateKey);
  return hashSeedString(`NSHAPES:${scope.toUpperCase()}:${day}`);
};

// ─── Daily Starfall Summit Mutators & Daily Showcase ────────────────────────

export type SummitDailyMutatorId =
  | 'catalyst_surge'
  | 'double_elites'
  | 'gamble_mastery'
  | 'hyper_parries'
  | 'golden_bazaar'
  | 'glass_sprint';

export interface SummitDailyMutator {
  id: SummitDailyMutatorId;
  name: string;
  tagline: string;
  description: string;
  icon: IconName;
  accentColor: string;
}

export const SUMMIT_DAILY_MUTATORS: readonly SummitDailyMutator[] = [
  {
    id: 'catalyst_surge',
    name: 'Evolution Surge',
    tagline: 'Weapon evolutions awaken faster and last longer.',
    description: '+1 head-start progress tick & +4s duration on all Weapon Evolutions across the climb.',
    icon: 'lorc/crystal-shine',
    accentColor: '#7C3AED',
  },
  {
    id: 'double_elites',
    name: 'Double Elites',
    tagline: 'More Elites stalk the trail — richer bounties await.',
    description: '+1 Elite room per Act map and +35% bonus coins from every Elite victory.',
    icon: 'lorc/daemon-skull',
    accentColor: '#B91C1C',
  },
  {
    id: 'gamble_mastery',
    name: 'Gamble Mastery',
    tagline: 'High-stakes board tricks take center stage.',
    description: 'Start with +45¢, +1 Grace, and Board Gambles locked into your Focused Pool.',
    icon: 'delapouite/rolling-dices',
    accentColor: '#D97706',
  },
  {
    id: 'hyper_parries',
    name: 'Hyper Parries',
    tagline: 'Snappier wind-ups with lucrative counter bounties.',
    description: 'Foes wind up 12% faster, and every Set-Parry pays +8¢ bonus gold.',
    icon: 'lorc/shield-reflect',
    accentColor: '#0F766E',
  },
  {
    id: 'golden_bazaar',
    name: 'Golden Bazaar',
    tagline: 'Flush purse & bargain shelves at every Merchant Tent.',
    description: 'Start with +60¢ and enjoy 15% off all Merchant Shop wares.',
    icon: 'lorc/crown-coin',
    accentColor: '#B45309',
  },
  {
    id: 'glass_sprint',
    name: 'Starfall Sprint',
    tagline: 'Leaner hearts, sharper hits from Floor 1.',
    description: 'Start with −1 Max Heart (min 3), +2 flat Set damage, and +1 Starting Hint.',
    icon: 'lorc/comet-spark',
    accentColor: '#1D4ED8',
  },
];

const MUTATOR_BY_ID: Record<SummitDailyMutatorId, SummitDailyMutator> = Object.fromEntries(
  SUMMIT_DAILY_MUTATORS.map(m => [m.id, m])
) as Record<SummitDailyMutatorId, SummitDailyMutator>;

export const getSummitDailyMutator = (id: SummitDailyMutatorId): SummitDailyMutator =>
  MUTATOR_BY_ID[id] ?? SUMMIT_DAILY_MUTATORS[0];

const FIGHTER_ROTATION: readonly CharacterName[] = FIGHTERS.map(f => f.name);

export interface DailySummitConfig {
  dateKey: string;
  seed: number;
  fighter: CharacterName;
  mutator: SummitDailyMutator;
  ascension: number;
}

/** Deterministic daily Starfall Summit configuration (seed, featured fighter, rotating mutator). */
export const getDailySummitConfig = (dateKey?: string | null): DailySummitConfig => {
  const day = normalizeDateKey(dateKey);
  const seed = dailySeedFor('summit', day);
  const dayNum = utcDayNumber(day);
  const fighterIdx = ((dayNum % FIGHTER_ROTATION.length) + FIGHTER_ROTATION.length) % FIGHTER_ROTATION.length;
  // Mix dayNum with a prime stride so Fighter × Mutator pairs rotate cleanly instead of locking 1:1
  const mutatorStep = Math.floor(dayNum / FIGHTER_ROTATION.length) + dayNum;
  const mutatorIdx =
    ((mutatorStep % SUMMIT_DAILY_MUTATORS.length) + SUMMIT_DAILY_MUTATORS.length) %
    SUMMIT_DAILY_MUTATORS.length;
  return {
    dateKey: day,
    seed,
    fighter: FIGHTER_ROTATION[fighterIdx] ?? 'Orange Tabby',
    mutator: SUMMIT_DAILY_MUTATORS[mutatorIdx] ?? SUMMIT_DAILY_MUTATORS[0],
    ascension: 0,
  };
};

// ─── Free Play Daily 3-Min Score Attack: Medals & GSP Percentile Framing ────

export type FreePlayMedal = 'none' | 'bronze' | 'silver' | 'gold' | 'starfall';

export const FREE_PLAY_MEDAL_THRESHOLDS: readonly {
  medal: Exclude<FreePlayMedal, 'none'>;
  minSets: number;
  label: string;
  emoji: string;
  color: string;
}[] = [
  { medal: 'bronze', minSets: 10, label: 'Bronze', emoji: '🥉', color: '#B45309' },
  { medal: 'silver', minSets: 18, label: 'Silver', emoji: '🥈', color: '#475569' },
  { medal: 'gold', minSets: 26, label: 'Gold', emoji: '🥇', color: '#D97706' },
  { medal: 'starfall', minSets: 35, label: 'Starfall', emoji: '🌟', color: '#7C3AED' },
];

export interface FreePlayDailyEvaluation {
  sets: number;
  mistakes: number;
  elapsedSec: number;
  setsPerMin: number;
  bestStreak: number;
  medal: FreePlayMedal;
  medalLabel: string;
  medalEmoji: string;
  medalColor: string;
  nextMedal: Exclude<FreePlayMedal, 'none'> | null;
  nextMedalLabel: string | null;
  setsToNextMedal: number;
  /** Positive GSP-style Pattern Power score (never negative, celebrates improvement). */
  patternPower: number;
  /** Positive percentile band (5..99) calibrated against local empirical curves. */
  percentile: number;
  tierName: string;
  /** Sakurai Ep. #168 & #198 positive framing line (never discouraging raw rank). */
  framingLine: string;
}

const logisticPercentile = (value: number, midpoint: number, scale: number): number => {
  const z = (value - midpoint) / Math.max(1, scale);
  const raw = 100 / (1 + Math.exp(-z));
  return Math.max(5, Math.min(99, Math.round(raw)));
};

export const medalRank = (medal: FreePlayMedal): number => {
  switch (medal) {
    case 'starfall':
      return 4;
    case 'gold':
      return 3;
    case 'silver':
      return 2;
    case 'bronze':
      return 1;
    default:
      return 0;
  }
};

export const evaluateFreePlayDaily = (input: {
  sets: number;
  mistakes: number;
  elapsedSec?: number;
  bestStreak?: number;
}): FreePlayDailyEvaluation => {
  const sets = Math.max(0, Math.floor(input.sets));
  const mistakes = Math.max(0, Math.floor(input.mistakes));
  const elapsedSec = Math.max(1, input.elapsedSec ?? FREE_PLAY_DAILY_DURATION_SEC);
  const bestStreak = Math.max(0, Math.floor(input.bestStreak ?? 0));
  const setsPerMin = Number(((sets / elapsedSec) * 60).toFixed(1));

  let earned: (typeof FREE_PLAY_MEDAL_THRESHOLDS)[number] | null = null;
  let next: (typeof FREE_PLAY_MEDAL_THRESHOLDS)[number] | null = null;
  for (const tier of FREE_PLAY_MEDAL_THRESHOLDS) {
    if (sets >= tier.minSets) {
      earned = tier;
    } else if (!next) {
      next = tier;
    }
  }

  const cleanBonus = sets >= 8 && mistakes === 0 ? 120 : 0;
  const patternPower = Math.max(
    100,
    Math.round(120 + sets * 46 + setsPerMin * 28 + bestStreak * 8 + cleanBonus - mistakes * 16)
  );
  // Centered around ~14 sets (Pattern Power ~920 → ~50%), 26 sets (~1,640 → ~82%), 35 sets (~2,200 → ~94%)
  const percentile = logisticPercentile(patternPower, 920, 440);

  const tierName =
    patternPower >= 2100
      ? 'Apex Visionary'
      : patternPower >= 1550
        ? 'Starfall Luminary'
        : patternPower >= 1100
          ? 'Set Savant'
          : patternPower >= 700
            ? 'Pattern Seeker'
            : 'Meadow Scout';

  const framingLine = `Pattern Power: ${patternPower.toLocaleString('en-US')} · Sharper than ${percentile}% of challengers`;

  return {
    sets,
    mistakes,
    elapsedSec,
    setsPerMin,
    bestStreak,
    medal: earned ? earned.medal : 'none',
    medalLabel: earned ? earned.label : 'Finisher',
    medalEmoji: earned ? earned.emoji : '✨',
    medalColor: earned ? earned.color : '#0F766E',
    nextMedal: next ? next.medal : null,
    nextMedalLabel: next ? next.label : null,
    setsToNextMedal: next ? Math.max(0, next.minSets - sets) : 0,
    patternPower,
    percentile,
    tierName,
    framingLine,
  };
};

// ─── Starfall Summit Rating & GSP-Style Percentile Estimator ────────────────

export interface SummitRatingInput {
  floorsCleared: number;
  victory: boolean;
  peakDpm: number;
  parries: number;
  perfectParries: number;
  evolutionsForged: number;
  ascension: number;
  act: number;
  endless?: boolean;
}

export interface SummitRatingBreakdown {
  rating: number;
  percentile: number;
  tierName: string;
  tierColor: string;
  framingLine: string;
  floorPoints: number;
  dpmPoints: number;
  parryPoints: number;
  evolutionPoints: number;
  ascensionMultiplier: number;
}

export const computeSummitRating = (input: SummitRatingInput): SummitRatingBreakdown => {
  const floors = Math.max(0, Math.floor(input.floorsCleared));
  const endlessActs = input.endless && input.act > 3 ? input.act - 3 : 0;
  const floorPoints = floors * 70 + (input.victory ? 450 : 0) + endlessActs * 320;
  const dpmPoints = Math.min(1200, Math.round(Math.sqrt(Math.max(0, input.peakDpm)) * 18));
  const parryPoints = Math.max(0, input.parries) * 18 + Math.max(0, input.perfectParries) * 45;
  const evolutionPoints = Math.max(0, input.evolutionsForged) * 35;
  const ascensionMultiplier = Number((1 + Math.max(0, input.ascension) * 0.08).toFixed(2));
  const baseTotal = floorPoints + dpmPoints + parryPoints + evolutionPoints;
  const rating = Math.max(100, Math.round(baseTotal * ascensionMultiplier));

  // Calibrated so Act 1 ≈ 15-25%, Act 2 ≈ 40-55%, Act 3 Victory ≈ 80-88%, High Ascension/Endless ≈ 95-99%
  const percentile = logisticPercentile(rating, 1650, 620);

  let tierName = 'Trailblazer';
  let tierColor = '#475569';
  if (rating >= 3400) {
    tierName = 'Starfall Apex';
    tierColor = '#7C3AED';
  } else if (rating >= 2400) {
    tierName = 'Ascendant';
    tierColor = '#D97706';
  } else if (rating >= 1600) {
    tierName = 'Peak Seeker';
    tierColor = '#0F766E';
  } else if (rating >= 900) {
    tierName = 'Ridge Climber';
    tierColor = '#2563EB';
  }

  const framingLine = `Summit Rating: ${rating.toLocaleString('en-US')} · ${tierName} Tier — outscored ~${percentile}% of climbers`;

  return {
    rating,
    percentile,
    tierName,
    tierColor,
    framingLine,
    floorPoints,
    dpmPoints,
    parryPoints,
    evolutionPoints,
    ascensionMultiplier,
  };
};

// ─── Standardized Shareable Seed URL Builders & Parsers ─────────────────────

export const buildSummitShareUrl = (options: {
  seed?: number;
  dailyDate?: string | null;
  fighter?: CharacterName;
  ascension?: number;
  baseUrl?: string;
}): string => {
  const base = (options.baseUrl ?? DEFAULT_SHARE_BASE_URL).replace(/\/+$/, '');
  const params: string[] = ['mode=summit'];
  if (typeof options.seed === 'number' && Number.isFinite(options.seed) && options.seed > 0) {
    params.push(`seed=${Math.floor(options.seed)}`);
  }
  if (options.dailyDate && isValidDateKey(options.dailyDate)) {
    params.push(`daily=${encodeURIComponent(options.dailyDate.trim())}`);
  }
  if (options.fighter && !options.dailyDate) {
    params.push(`fighter=${encodeURIComponent(options.fighter)}`);
  }
  if (typeof options.ascension === 'number' && options.ascension > 0 && !options.dailyDate) {
    params.push(`asc=${Math.min(20, Math.max(0, Math.floor(options.ascension)))}`);
  }
  return `${base}/?${params.join('&')}`;
};

export const buildAdventureShareUrl = (options: {
  levelId: string;
  seed?: number;
  baseUrl?: string;
}): string => {
  const base = (options.baseUrl ?? DEFAULT_SHARE_BASE_URL).replace(/\/+$/, '');
  const params: string[] = ['mode=adventure', `level=${encodeURIComponent(options.levelId)}`];
  if (typeof options.seed === 'number' && Number.isFinite(options.seed) && options.seed > 0) {
    params.push(`seed=${Math.floor(options.seed)}`);
  }
  return `${base}/?${params.join('&')}`;
};

export const buildFreePlayShareUrl = (options: {
  dailyDate?: string | null;
  baseUrl?: string;
} = {}): string => {
  const base = (options.baseUrl ?? DEFAULT_SHARE_BASE_URL).replace(/\/+$/, '');
  const day = normalizeDateKey(options.dailyDate);
  return `${base}/?mode=freeplay&daily=${encodeURIComponent(day)}`;
};

/** Normalize a 4-character alphanumeric Starfall Summit co-op room code to uppercase (returns undefined if invalid). */
export const normalizeCoopRoomCode = (raw?: string | null): string | undefined => {
  if (!raw || typeof raw !== 'string') return undefined;
  const cleaned = raw.trim().toUpperCase();
  return /^[A-Z0-9]{4}$/.test(cleaned) ? cleaned : undefined;
};

/** Build a shareable Starfall Summit 2P Co-Op invite URL (`?mode=summit&coop=FOX7[&coopServer=...]`). */
export const buildSummitCoopShareUrl = (options: {
  code: string;
  baseUrl?: string;
  coopServer?: string | null;
}): string => {
  const base = (options.baseUrl ?? DEFAULT_SHARE_BASE_URL).replace(/\/+$/, '');
  const cleanCode = normalizeCoopRoomCode(options.code) ?? options.code.trim().toUpperCase();
  const params: string[] = ['mode=summit', `coop=${encodeURIComponent(cleanCode)}`];
  const server = options.coopServer?.trim();
  if (server) {
    params.push(`coopServer=${encodeURIComponent(server)}`);
  }
  return `${base}/?${params.join('&')}`;
};

export type ParsedModeParam = 'summit' | 'adventure' | 'freeplay' | 'prism';

export interface ParsedShareUrlParams {
  mode?: ParsedModeParam;
  seedRaw?: string;
  seedNumeric?: number;
  daily?: boolean;
  dailyDate?: string;
  levelId?: string;
  fighter?: CharacterName;
  ascension?: number;
  deckId?: string;
  coop?: string;
  coopServer?: string;
}

const matchFighterName = (raw?: string): CharacterName | undefined => {
  if (!raw) return undefined;
  const cleaned = raw.trim().toLowerCase();
  return FIGHTER_ROTATION.find(name => name.toLowerCase() === cleaned);
};

/** Parse standardized query params (`?mode=summit&seed=<N>&daily=YYYY-MM-DD`, `?mode=adventure&level=<ID>&seed=<N>`, etc.). */
export const parseShareUrlParams = (urlOrSearch: string): ParsedShareUrlParams => {
  if (!urlOrSearch || typeof urlOrSearch !== 'string') return {};
  const qIndex = urlOrSearch.indexOf('?');
  const rawQuery = qIndex >= 0 ? urlOrSearch.slice(qIndex + 1) : urlOrSearch;
  const hashIndex = rawQuery.indexOf('#');
  const query = hashIndex >= 0 ? rawQuery.slice(0, hashIndex) : rawQuery;
  if (!query) return {};

  const map = new Map<string, string>();
  for (const part of query.split('&')) {
    if (!part) continue;
    const eq = part.indexOf('=');
    const k = eq >= 0 ? decodeURIComponent(part.slice(0, eq).replace(/\+/g, ' ')) : decodeURIComponent(part);
    const v = eq >= 0 ? decodeURIComponent(part.slice(eq + 1).replace(/\+/g, ' ')) : '';
    map.set(k.toLowerCase(), v);
  }

  const rawMode = map.get('mode')?.toLowerCase();
  const mode: ParsedModeParam | undefined =
    rawMode === 'summit' || rawMode === 'spire'
      ? 'summit'
      : rawMode === 'adventure'
        ? 'adventure'
        : rawMode === 'freeplay' || rawMode === 'free_play'
          ? 'freeplay'
          : rawMode === 'prism'
            ? 'prism'
            : undefined;

  const seedRaw = map.get('seed')?.trim() || undefined;
  const seedNumeric = parseNumericSeed(seedRaw);

  const rawDaily = map.get('daily')?.trim();
  const daily = Boolean(rawDaily && rawDaily !== '0' && rawDaily.toLowerCase() !== 'false');
  const dailyDate = rawDaily && isValidDateKey(rawDaily) ? rawDaily : undefined;

  const levelId = map.get('level')?.trim() || undefined;
  const fighter = matchFighterName(map.get('fighter'));
  const rawAsc = map.get('asc');
  const parsedAsc = rawAsc !== undefined && /^\d+$/.test(rawAsc.trim()) ? Number.parseInt(rawAsc.trim(), 10) : undefined;
  const ascension = parsedAsc !== undefined ? Math.max(0, Math.min(20, parsedAsc)) : undefined;
  const deckId = map.get('deck')?.trim() || undefined;
  const coop = normalizeCoopRoomCode(map.get('coop'));
  const coopServer = map.get('coopserver')?.trim() || undefined;

  return {
    ...(mode ? { mode } : {}),
    ...(seedRaw ? { seedRaw } : {}),
    ...(seedNumeric !== undefined ? { seedNumeric } : {}),
    ...(daily ? { daily } : {}),
    ...(dailyDate ? { dailyDate } : {}),
    ...(levelId ? { levelId } : {}),
    ...(fighter ? { fighter } : {}),
    ...(ascension !== undefined ? { ascension } : {}),
    ...(deckId ? { deckId } : {}),
    ...(coop ? { coop } : {}),
    ...(coopServer ? { coopServer } : {}),
  };
};

// ─── Spoiler-Free Share Card Formatters ─────────────────────────────────────

export const formatFreePlayDailyShareCard = (input: {
  dateKey: string;
  evaluation: FreePlayDailyEvaluation;
  baseUrl?: string;
}): string => {
  const { dateKey, evaluation, baseUrl } = input;
  const mistakeText = evaluation.mistakes === 1 ? '1 Mistake' : `${evaluation.mistakes} Mistakes`;
  const url = buildFreePlayShareUrl({ dailyDate: dateKey, baseUrl });
  return [
    `Daily Meadow · ${dateKey} · ${evaluation.sets} Sets · ${evaluation.setsPerMin}/min · ${mistakeText}`,
    `${evaluation.medalEmoji} ${evaluation.medalLabel} · ${evaluation.framingLine}`,
    url,
  ].join('\n');
};

const renderActEmojiTrack = (act: number, floorsCleared: number, victory: boolean, defeatedAct: number): string => {
  // 7 floors per Act (rows 0..5 + row 6 boss)
  const actStart = (act - 1) * 7;
  const clearedInAct = Math.max(0, Math.min(7, floorsCleared - actStart));
  let pips = '';
  for (let i = 0; i < 7; i++) {
    const isBossSlot = i === 6;
    if (i < clearedInAct) {
      pips += isBossSlot ? '👑' : '🟩';
    } else if (!victory && act === defeatedAct && i === clearedInAct) {
      pips += '🟥';
    } else {
      pips += '⬜';
    }
  }
  const roman = act === 1 ? 'I' : act === 2 ? 'II' : act === 3 ? 'III' : String(act);
  return `Act ${roman} ${pips}`;
};

export const formatSummitShareCard = (input: {
  seed: number;
  fighter: CharacterName;
  ascension: number;
  act: number;
  floor: number;
  floorsCleared: number;
  victory: boolean;
  endless?: boolean;
  peakDpm: number;
  biggestHit: number;
  parries: number;
  perfectParries: number;
  evolutionsForged: number;
  isDaily?: boolean;
  dailyDate?: string;
  dailyMutatorName?: string;
  rating?: SummitRatingBreakdown;
  baseUrl?: string;
}): string => {
  const rating =
    input.rating ??
    computeSummitRating({
      floorsCleared: input.floorsCleared,
      victory: input.victory,
      peakDpm: input.peakDpm,
      parries: input.parries,
      perfectParries: input.perfectParries,
      evolutionsForged: input.evolutionsForged,
      ascension: input.ascension,
      act: input.act,
      endless: input.endless,
    });

  const headerTag =
    input.isDaily && input.dailyDate
      ? `Daily ${input.dailyDate}${input.dailyMutatorName ? ` (${input.dailyMutatorName})` : ''}`
      : `Seed #${input.seed}${input.ascension > 0 ? ` · A${input.ascension}` : ''}`;

  const outcome = input.victory
    ? input.endless
      ? `Endless Act ${input.act} ✨`
      : 'Summit Conquered 👑'
    : `Act ${input.act} · Floor ${input.floor}`;

  const actsToRender = Math.max(1, Math.min(input.act, 4));
  const actRows: string[] = [];
  for (let a = 1; a <= actsToRender; a++) {
    actRows.push(renderActEmojiTrack(a, input.floorsCleared, input.victory, input.act));
  }

  const url = buildSummitShareUrl({
    seed: input.seed,
    dailyDate: input.isDaily ? input.dailyDate : undefined,
    fighter: input.fighter,
    ascension: input.ascension,
    baseUrl: input.baseUrl,
  });

  return [
    `Starfall Summit ✦ ${headerTag}`,
    `${input.fighter} · ${outcome} · Best Hit ${Math.round(input.biggestHit).toLocaleString('en-US')}`,
    ...actRows,
    rating.framingLine,
    url,
  ].join('\n');
};

export const formatAdventureShareCard = (input: {
  levelId: string;
  levelName: string;
  stars: number;
  biggestHit: number;
  dpm: number;
  seed: number;
  baseUrl?: string;
}): string => {
  const clampedStars = Math.max(0, Math.min(3, Math.floor(input.stars)));
  const starStr = '★'.repeat(clampedStars) + '☆'.repeat(3 - clampedStars);
  const url = buildAdventureShareUrl({
    levelId: input.levelId,
    seed: input.seed,
    baseUrl: input.baseUrl,
  });
  return [
    `NShapes Adventure · ${input.levelId} ${input.levelName} · ${starStr}`,
    `Best Hit ${Math.round(input.biggestHit).toLocaleString('en-US')} · DPM ${Math.round(input.dpm).toLocaleString('en-US')} · Seed #${input.seed}`,
    url,
  ].join('\n');
};
