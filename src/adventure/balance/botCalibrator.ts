/**
 * PostHog -> BotProfile Behavioral Calibrator (Pure TypeScript, zero RN/fs deps).
 *
 * Fits a realistic human `BotProfile` (`calibrated_human`) from era-independent
 * clean `prod` gameplay telemetry, capturing:
 *  - Linear reaction floor + per-trait scan slope (`baseReactionSec + secondsPerAttribute * traits`)
 *  - Lognormal search-time volatility (`findTimeSigma`) for real human Set droughts,
 *    computed directly from `recording.actions` when available or inferred via
 *    extreme-value order statistics `ln(maxDrought/medFind) / Phi^-1(1 - 0.5/sets)`
 *  - Unforgiven mistake rate, total slip rate (including grace-forgiven near-misses),
 *    empirical near-miss share, hint eagerness, and Perfect Parry wait share
 *  - Empirical-Bayes shrunk (`m = 10` fights toward `1.00`) per-weapon and per-role
 *    cognitive load multipliers, stratified by `mode x traitBucket`
 *
 * SECURITY: Never returns or serializes `distinct_id`, `player_code`, `$session_id`,
 * or any API keys — output contains ONLY aggregate behavioral statistics.
 */
import { resolveLegacyWeapon } from '../data/armory';
import { LEVELS } from '../data/levels';
import { roleLabel, WEAPON_ROLES, weaponRole, type WeaponRole } from '../data/weaponRoles';
import { BOTS, type BotProfile } from '../engine/bot';
import type { RecordedAction } from '../engine/replay';

// ─── Public Types ────────────────────────────────────────────────────────────

export interface CalibrationOptions {
  /** Include `env !== 'prod'` fights (default `false` — prod human fights only). */
  includeDev?: boolean;
  /** Filter out Playwright E2E bot signatures on dev rows (default `true`). */
  excludeE2eBots?: boolean;
  /** Minimum Sets matched per fight (default `3`). */
  minSets?: number;
  /** Minimum fight duration in ms (default `10_000`). */
  minDurationMs?: number;
  /** Exclude Adventure tutorial `1-1` (default `true`). */
  excludeTutorial11?: boolean;
  /** Max coached/hinted Set fraction in Adventure (default `0.50`). */
  maxHelpedSetRatio?: number;
  /** Exclude inter-Set gaps above this AFK threshold in ms (default `30_000`). */
  maxInterSetMs?: number;
  /** Empirical-Bayes shrinkage prior strength `m` for cognitive load (default `10`). */
  cognitivePriorM?: number;
  /** Minimum fights required to emit a per-weapon cognitive load override (default `3`). */
  minWeaponFights?: number;
  /** Minimum timed fights before preferring timed fights for pace/mistakes/sigma (default `8`). */
  minTimedFights?: number;
  /** Optional label for the data source (e.g., `'posthog-live'`, `'posthog-file'`). */
  source?: string;
}

export interface CalibrationAudit {
  totalRaw: number;
  deduped: number;
  kept: number;
  keptTimed: number;
  droppedByEvent: number;
  droppedByEnv: number;
  droppedByE2eBot: number;
  droppedByPractice: number;
  droppedByBug: number;
  droppedByTutorial: number;
  droppedByShort: number;
  droppedByCoached: number;
  recordingsParsed: number;
  unhintedSetsExtracted: number;
  afkGapsTrimmed: number;
}

export interface TraitBucketStats {
  traits: number;
  fights: number;
  sets: number;
  fightMedianFindSec: number;
  medianFindSec: number;
  meanFindSec: number;
  p90FindSec: number;
  p95FindSec: number;
  lognormalMu: number;
  lognormalSigma: number;
}

export interface CohortSummaryStats {
  fights: number;
  unhintedSets: number;
  fightMedianFindSec: number;
  fightMaxDroughtSec: number;
  fightDroughtRatioMedian: number;
  fightDroughtRatioP90: number;
  setP25Sec: number;
  setMedianSec: number;
  setMeanSec: number;
  setP90Sec: number;
  setP95Sec: number;
  lognormalMu: number;
  lognormalSigma: number;
  unforgivenMistakeRate: number;
  totalSlipRate: number;
  hintsPerSet: number;
}

export interface WeaponCognitiveLoadRow {
  weaponId: string;
  role: WeaponRole;
  fights: number;
  rawMult: number;
  shrunkMult: number;
  medianFindMs: number;
  droughtRatio: number;
  mistakeDelta: number;
  applied: boolean;
}

export interface RoleCognitiveLoadRow {
  role: WeaponRole;
  label: string;
  fights: number;
  rawMult: number;
  shrunkMult: number;
  droughtRatio: number;
}

export interface BotComparisonRow {
  name: string;
  secondsPerAttribute: number;
  baseReactionSec: number;
  findTimeSigma: number;
  think3TMedianSec: number;
  think3TMeanSec: number;
  think3TP95Sec: number;
  maxPaceMultiplier: number;
  mistakeRate: number;
  nearMissRate: number;
  hintEagerness: number;
  boldness: number;
  perfectParryWaitChance: number;
}

export interface CalibrationResult {
  generatedAt: string;
  source: string;
  audit: CalibrationAudit;
  profile: BotProfile;
  empirical: {
    sigmaMethod: 'recording' | 'order-statistic' | 'default';
    regressionMethod: 'linear' | 'floor-anchor' | 'default';
    allClean: CohortSummaryStats;
    timed: CohortSummaryStats | null;
    byTraitCount: TraitBucketStats[];
    unforgivenMistakeRate: number;
    totalSlipRate: number;
    nearMissRate: number;
    graceFightsSlips: number;
    graceSaves: number;
    hintsPerSet: number;
    parries: number;
    perfectParries: number;
    perfectParryShare: number | null;
  };
  cognitiveLoad: {
    priorM: number;
    byWeapon: WeaponCognitiveLoadRow[];
    byRole: RoleCognitiveLoadRow[];
  };
  comparison: BotComparisonRow[];
}

export interface ExtractedRecordingStats {
  unhintedInterSetMs: number[];
  hintedInterSetMs: number[];
  matchCount: number;
  invalidCount: number;
  hintCount: number;
  graceMatches: number;
}

// ─── Internal Helpers & Math ─────────────────────────────────────────────────

const LEVEL_META_MAP: ReadonlyMap<string, { traits: number; timed: boolean }> = new Map(
  LEVELS.map(l => [
    l.id,
    {
      traits: Math.max(1, l.rules.attributes.length),
      timed: typeof l.rules.timer === 'number' && l.rules.timer > 0,
    },
  ])
);

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const roundN = (x: number, digits = 4): number => {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
};

const mean = (xs: readonly number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

const quantile = (xs: readonly number[], p: number): number => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const idx = (s.length - 1) * clamp(p, 0, 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return s[lo] + (s[hi] - s[lo]) * (idx - lo);
};

const sampleStdDev = (xs: readonly number[]): number => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  let sumSq = 0;
  for (const x of xs) sumSq += (x - m) ** 2;
  return Math.sqrt(sumSq / (xs.length - 1));
};

/**
 * Acklam's rational approximation for the inverse standard normal CDF `Phi^-1(p)`.
 * Accurate to `< 1.15e-9` across `(0, 1)`.
 */
export const invNormalCdf = (pRaw: number): number => {
  const p = clamp(pRaw, 1e-12, 1 - 1e-12);
  const a1 = -3.969683028665376e1;
  const a2 = 2.209460984245205e2;
  const a3 = -2.759285104469687e2;
  const a4 = 1.38357751867269e2;
  const a5 = -3.066479806614716e1;
  const a6 = 2.506628277459239;

  const b1 = -5.447609879822406e1;
  const b2 = 1.615858368580409e2;
  const b3 = -1.556989798598866e2;
  const b4 = 6.680131188771972e1;
  const b5 = -1.328068155288572e1;

  const c1 = -7.784894002430293e-3;
  const c2 = -3.223964580411365e-1;
  const c3 = -2.400758277161838;
  const c4 = -2.549732539343734;
  const c5 = 4.374664141464968;
  const c6 = 2.938163982698783;

  const d1 = 7.784695709041462e-3;
  const d2 = 3.224671290700398e-1;
  const d3 = 2.445134137142996;
  const d4 = 3.754408661907416;

  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
  }
  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return (
      ((((((a1 * r + a2) * r + a3) * r + a4) * r + a5) * r + a6) * q) /
      (((((b1 * r + b2) * r + b3) * r + b4) * r + b5) * r + 1)
    );
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c1 * q + c2) * q + c3) * q + c4) * q + c5) * q + c6) / ((((d1 * q + d2) * q + d3) * q + d4) * q + 1);
};

const asNum = (v: unknown): number | null => {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
};

const asBool = (v: unknown): boolean => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return s === 'true' || s === '1';
  }
  return false;
};

const asStr = (v: unknown): string | null => {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length > 0 ? t : null;
  }
  return null;
};

const asStrArray = (v: unknown): string[] => {
  if (Array.isArray(v)) {
    return v.map(x => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);
  }
  if (typeof v === 'string' && v.trim().startsWith('[')) {
    try {
      const parsed = JSON.parse(v);
      if (Array.isArray(parsed)) return parsed.map(x => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);
    } catch {
      return [];
    }
  }
  return [];
};

const asNumArray = (v: unknown): number[] => {
  if (!Array.isArray(v)) return [];
  return v.map(asNum).filter((x): x is number => x !== null && x > 0);
};

const parseRecordingObj = (raw: unknown): { actions?: RecordedAction[] } | null => {
  if (!raw) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const o = raw as { actions?: unknown };
    return Array.isArray(o.actions) ? { actions: o.actions as RecordedAction[] } : null;
  }
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as { actions?: unknown };
      return parsed && Array.isArray(parsed.actions) ? { actions: parsed.actions as RecordedAction[] } : null;
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * Extracts exact inter-Set find times (in ms) from a compact `FightRecording` action stream.
 * Distinguishes unhinted vs hinted matches and detects grace-forgiven matches.
 */
export const extractRecordingFindTimes = (rawRecording: unknown): ExtractedRecordingStats | null => {
  const rec = parseRecordingObj(rawRecording);
  if (!rec?.actions || rec.actions.length === 0) return null;

  const unhintedInterSetMs: number[] = [];
  const hintedInterSetMs: number[] = [];
  let matchCount = 0;
  let invalidCount = 0;
  let hintCount = 0;
  let graceMatches = 0;
  let lastSetAt = 0;

  for (const item of rec.actions) {
    if (!item || typeof item !== 'object') continue;
    if (!('a' in item) || !item.a || typeof item.a !== 'object') continue;
    const at = asNum(item.at);
    const a = item.a as Record<string, unknown>;
    const type = asStr(a.type);
    if (!type) continue;

    if (type === 'MATCH') {
      matchCount += 1;
      const hinted = a.hinted === true;
      const effects = a.effects && typeof a.effects === 'object' ? (a.effects as Record<string, unknown>) : null;
      const rewards = a.rewards && typeof a.rewards === 'object' ? (a.rewards as Record<string, unknown>) : null;
      if (a.graceUsed === true || effects?.graceUsed === true || rewards?.graceUsed === true) {
        graceMatches += 1;
      }
      if (at !== null) {
        const dt = at - lastSetAt;
        lastSetAt = at;
        if (dt > 0) {
          if (hinted) hintedInterSetMs.push(dt);
          else unhintedInterSetMs.push(dt);
        }
      }
    } else if (type === 'INVALID') {
      invalidCount += 1;
    } else if (type === 'USE_HINT') {
      hintCount += 1;
    } else if (type === 'NEXT_WAVE' && at !== null) {
      lastSetAt = at;
    }
  }

  return {
    unhintedInterSetMs,
    hintedInterSetMs,
    matchCount,
    invalidCount,
    hintCount,
    graceMatches,
  };
};

interface NormalizedCalibrationFight {
  fightId: string;
  mode: 'adventure' | 'spire' | 'classic' | 'free_play';
  levelId: string;
  traits: number;
  timed: boolean;
  sets: number;
  mistakes: number;
  helpedSets: number;
  hintsUsed: number;
  gracesUsed: number;
  parries: number;
  perfectParries: number;
  durationMs: number;
  medianFindMs: number | null;
  maxDroughtMs: number | null;
  diedWithHints: boolean;
  weapons: string[];
  unhintedInterSetMs: number[];
  hadRecording: boolean;
}

const inferMode = (props: Record<string, unknown>, levelId: string): NormalizedCalibrationFight['mode'] => {
  const m = asStr(props.mode)?.toLowerCase();
  if (m === 'spire' || m === 'adventure' || m === 'classic' || m === 'free_play') return m;
  if (levelId.startsWith('spire-') || asNum(props.spire_act) !== null) return 'spire';
  if (levelId.startsWith('classic-')) return 'classic';
  if (levelId.startsWith('freeplay-')) return 'free_play';
  return 'adventure';
};

const inferTraitsAndTimed = (
  mode: NormalizedCalibrationFight['mode'],
  levelId: string,
  difficulty: string | null
): { traits: number; timed: boolean } => {
  if (mode === 'spire') return { traits: 3, timed: true };
  if (mode === 'adventure') {
    const meta = LEVEL_META_MAP.get(levelId);
    if (meta) return meta;
    const world = Number(levelId.split('-')[0]) || 1;
    return { traits: world <= 1 ? 3 : 3, timed: world >= 2 };
  }
  const d = (difficulty ?? '').toLowerCase();
  const traits = d === 'hard' ? 5 : d === 'medium' ? 4 : 3;
  return { traits, timed: mode === 'classic' };
};

const normalizeWeapons = (raw: unknown): string[] => {
  const ids = asStrArray(raw);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    const resolved = resolveLegacyWeapon(id);
    const canon = resolved?.id ?? id;
    if (canon && !seen.has(canon)) {
      seen.add(canon);
      out.push(canon);
    }
  }
  return out;
};

const isPlaywrightE2eBot = (env: string, medianFindMs: number | null, maxDroughtMs: number | null, mistakes: number): boolean =>
  env === 'dev' &&
  medianFindMs !== null &&
  maxDroughtMs !== null &&
  medianFindMs <= 1400 &&
  maxDroughtMs <= 2000 &&
  mistakes === 0;

const summarizeCohort = (
  fights: readonly NormalizedCalibrationFight[],
  maxInterSetMs: number,
  fallbackSigma: number
): CohortSummaryStats => {
  const fightMedSecs: number[] = [];
  const fightDroughtSecs: number[] = [];
  const droughtRatios: number[] = [];
  const allUnhintedSecs: number[] = [];
  let totalSets = 0;
  let totalMistakes = 0;
  let totalGraces = 0;
  let totalHints = 0;

  for (const f of fights) {
    totalSets += f.sets;
    totalMistakes += f.mistakes;
    totalGraces += f.gracesUsed;
    totalHints += f.hintsUsed;

    const cleanIntervals = f.unhintedInterSetMs.filter(ms => ms >= 250 && ms <= maxInterSetMs);
    for (const ms of cleanIntervals) allUnhintedSecs.push(ms / 1000);

    const medMs = cleanIntervals.length > 0 ? quantile(cleanIntervals, 0.5) : f.medianFindMs;
    if (medMs !== null && medMs > 0 && medMs <= maxInterSetMs) {
      fightMedSecs.push(medMs / 1000);
      if (f.maxDroughtMs !== null && f.maxDroughtMs > 0) {
        fightDroughtSecs.push(f.maxDroughtMs / 1000);
        droughtRatios.push(f.maxDroughtMs / medMs);
      }
    }
  }

  const samples = allUnhintedSecs.length > 0 ? allUnhintedSecs : fightMedSecs;
  const logSamples = samples.map(x => Math.log(Math.max(0.25, x)));
  const mu = logSamples.length > 0 ? mean(logSamples) : Math.log(3.5);
  const sigma = allUnhintedSecs.length >= 10 ? sampleStdDev(logSamples) : fallbackSigma;
  const attempts = Math.max(1, totalSets + totalMistakes);

  return {
    fights: fights.length,
    unhintedSets: allUnhintedSecs.length,
    fightMedianFindSec: roundN(quantile(fightMedSecs, 0.5), 3),
    fightMaxDroughtSec: roundN(quantile(fightDroughtSecs, 0.5), 3),
    fightDroughtRatioMedian: roundN(quantile(droughtRatios, 0.5), 3),
    fightDroughtRatioP90: roundN(quantile(droughtRatios, 0.9), 3),
    setP25Sec: roundN(quantile(samples, 0.25), 3),
    setMedianSec: roundN(quantile(samples, 0.5), 3),
    setMeanSec: roundN(mean(samples), 3),
    setP90Sec: roundN(quantile(samples, 0.9), 3),
    setP95Sec: roundN(quantile(samples, 0.95), 3),
    lognormalMu: roundN(mu, 4),
    lognormalSigma: roundN(sigma, 4),
    unforgivenMistakeRate: roundN(totalMistakes / attempts, 4),
    totalSlipRate: roundN((totalMistakes + totalGraces) / attempts, 4),
    hintsPerSet: roundN(totalHints / Math.max(1, totalSets), 4),
  };
};

const botMetricsRow = (bot: BotProfile): BotComparisonRow => {
  const base = bot.baseReactionSec ?? 0;
  const med3 = base + bot.secondsPerAttribute * 3;
  const sigma = bot.findTimeSigma && bot.findTimeSigma > 0 ? bot.findTimeSigma : 0;
  const maxPace = sigma > 0 ? (bot.maxPaceMultiplier ?? 5.0) : 1.4;
  // For Uniform[0.6, 1.4]: mean = 1.0 * med3, p95 = 1.36 * med3.
  // For clipped Lognormal(0, sigma) on [0.30, maxPace]: exact numerical expectation via 201-point Gauss/midpoints.
  let mean3 = med3;
  let p95 = med3 * 1.36;
  if (sigma > 0) {
    const N = 200;
    let sumMult = 0;
    for (let i = 0; i < N; i++) {
      const p = (i + 0.5) / N;
      const mult = clamp(Math.exp(invNormalCdf(p) * sigma), 0.3, maxPace);
      sumMult += mult;
    }
    mean3 = med3 * (sumMult / N);
    p95 = med3 * clamp(Math.exp(1.6448536269514722 * sigma), 0.3, maxPace);
  }
  const perfectWait =
    bot.perfectParryWaitChance !== undefined ? bot.perfectParryWaitChance : bot.name === 'expert' ? 0.4 : 0;

  return {
    name: bot.name,
    secondsPerAttribute: roundN(bot.secondsPerAttribute, 3),
    baseReactionSec: roundN(base, 3),
    findTimeSigma: roundN(sigma, 3),
    think3TMedianSec: roundN(med3, 2),
    think3TMeanSec: roundN(mean3, 2),
    think3TP95Sec: roundN(p95, 2),
    maxPaceMultiplier: roundN(maxPace, 2),
    mistakeRate: roundN(bot.mistakeRate, 4),
    nearMissRate: roundN(bot.nearMissRate, 3),
    hintEagerness: roundN(bot.hintEagerness, 3),
    boldness: roundN(bot.boldness, 3),
    perfectParryWaitChance: roundN(perfectWait, 3),
  };
};

// ─── Main Public Calibration Function ────────────────────────────────────────

export const calibrateBotFromPostHog = (
  rawEvents: readonly Record<string, unknown>[],
  opts: CalibrationOptions = {}
): CalibrationResult => {
  const includeDev = opts.includeDev ?? false;
  const excludeE2eBots = opts.excludeE2eBots ?? true;
  const minSets = opts.minSets ?? 3;
  const minDurationMs = opts.minDurationMs ?? 10_000;
  const excludeTutorial11 = opts.excludeTutorial11 ?? true;
  const maxHelpedSetRatio = opts.maxHelpedSetRatio ?? 0.5;
  const maxInterSetMs = opts.maxInterSetMs ?? 30_000;
  const priorM = opts.cognitivePriorM ?? 10;
  const minWeaponFights = opts.minWeaponFights ?? 3;
  const minTimedFights = opts.minTimedFights ?? 8;

  const audit: CalibrationAudit = {
    totalRaw: rawEvents.length,
    deduped: 0,
    kept: 0,
    keptTimed: 0,
    droppedByEvent: 0,
    droppedByEnv: 0,
    droppedByE2eBot: 0,
    droppedByPractice: 0,
    droppedByBug: 0,
    droppedByTutorial: 0,
    droppedByShort: 0,
    droppedByCoached: 0,
    recordingsParsed: 0,
    unhintedSetsExtracted: 0,
    afkGapsTrimmed: 0,
  };

  // 1. Deduplicate by fight_id (preferring rows with recording attached)
  const byFightId = new Map<string, Record<string, unknown>>();
  let anonIdx = 0;
  for (const raw of rawEvents) {
    if (!raw || typeof raw !== 'object') continue;
    const evName = asStr(raw.event);
    if (evName && evName !== 'fight_ended') {
      audit.droppedByEvent += 1;
      continue;
    }
    const props =
      raw.properties && typeof raw.properties === 'object' && !Array.isArray(raw.properties)
        ? (raw.properties as Record<string, unknown>)
        : raw;
    const fightId = asStr(props.fight_id) ?? `anon-${++anonIdx}`;
    const prev = byFightId.get(fightId);
    if (prev) {
      audit.deduped += 1;
      if (!prev.recording && props.recording) byFightId.set(fightId, props);
    } else {
      byFightId.set(fightId, props);
    }
  }

  // 2. Hygiene filtering (strictly era-independent human behavioral filter)
  const keptFights: NormalizedCalibrationFight[] = [];
  for (const [fightId, p] of byFightId.entries()) {
    const env = (asStr(p.env) ?? 'prod').toLowerCase();
    if (!includeDev && env !== 'prod') {
      audit.droppedByEnv += 1;
      continue;
    }
    const levelId = asStr(p.level_id) ?? '';
    const mode = inferMode(p, levelId);
    const practice = asBool(p.practice) || asStr(p.outcome)?.toLowerCase() === 'practice';
    if (practice) {
      audit.droppedByPractice += 1;
      continue;
    }
    const funTags = asStrArray(p.fun_tags);
    if (funTags.includes('bug_in_game')) {
      audit.droppedByBug += 1;
      continue;
    }
    if (excludeTutorial11 && mode === 'adventure' && levelId === '1-1') {
      audit.droppedByTutorial += 1;
      continue;
    }

    const sets = Math.max(0, Math.round(asNum(p.sets) ?? 0));
    const mistakes = Math.max(0, Math.round(asNum(p.mistakes) ?? 0));
    const durationMs = Math.max(0, asNum(p.duration_ms) ?? 0);
    const medianFindMs = asNum(p.median_find_ms);
    const maxDroughtMs = asNum(p.max_drought_ms);
    const helpedSets = Math.max(0, Math.round(asNum(p.helped_sets) ?? 0));

    if (excludeE2eBots && isPlaywrightE2eBot(env, medianFindMs, maxDroughtMs, mistakes)) {
      audit.droppedByE2eBot += 1;
      continue;
    }
    if (sets < minSets || durationMs < minDurationMs) {
      audit.droppedByShort += 1;
      continue;
    }
    if (mode === 'adventure' && sets > 0 && helpedSets / sets > maxHelpedSetRatio) {
      audit.droppedByCoached += 1;
      continue;
    }

    const { traits, timed } = inferTraitsAndTimed(mode, levelId, asStr(p.difficulty));
    const recStats = extractRecordingFindTimes(p.recording);
    const preIntervals = asNumArray(p.unhintedInterSetMs);
    const rawIntervals = recStats ? recStats.unhintedInterSetMs : preIntervals;
    const hadRecording = !!recStats || preIntervals.length > 0;
    if (hadRecording) audit.recordingsParsed += 1;

    const cleanIntervals: number[] = [];
    for (const ms of rawIntervals) {
      if (ms > maxInterSetMs) {
        audit.afkGapsTrimmed += 1;
      } else if (ms >= 250) {
        cleanIntervals.push(ms);
      }
    }
    audit.unhintedSetsExtracted += cleanIntervals.length;

    const hintsUsed = Math.max(0, Math.round(asNum(p.hints_used) ?? recStats?.hintCount ?? 0));
    const gracesUsed = Math.max(0, Math.round(asNum(p.graces_used) ?? recStats?.graceMatches ?? 0));
    const parries = Math.max(0, Math.round(asNum(p.parries) ?? 0));
    const perfectParries = Math.max(0, Math.round(asNum(p.perfect_parries) ?? 0));
    const diedWithHints = asBool(p.died_with_hints);
    const weapons = normalizeWeapons(p.weapons);

    keptFights.push({
      fightId,
      mode,
      levelId,
      traits,
      timed,
      sets,
      mistakes,
      helpedSets,
      hintsUsed,
      gracesUsed,
      parries,
      perfectParries,
      durationMs,
      medianFindMs,
      maxDroughtMs,
      diedWithHints,
      weapons,
      unhintedInterSetMs: cleanIntervals,
      hadRecording,
    });
  }

  audit.kept = keptFights.length;
  const timedFights = keptFights.filter(f => f.timed);
  audit.keptTimed = timedFights.length;
  const pacePool = timedFights.length >= minTimedFights ? timedFights : keptFights;

  // 3. Per-trait-count buckets & linear fit for baseReactionSec + secondsPerAttribute
  const byTraitsMap = new Map<number, { fights: NormalizedCalibrationFight[]; intervalsSec: number[]; fightMedSec: number[] }>();
  for (const f of keptFights) {
    const bucket = byTraitsMap.get(f.traits) ?? { fights: [], intervalsSec: [], fightMedSec: [] };
    bucket.fights.push(f);
    for (const ms of f.unhintedInterSetMs) bucket.intervalsSec.push(ms / 1000);
    const fMed = f.unhintedInterSetMs.length > 0 ? quantile(f.unhintedInterSetMs, 0.5) : f.medianFindMs;
    if (fMed !== null && fMed > 0 && fMed <= maxInterSetMs) bucket.fightMedSec.push(fMed / 1000);
    byTraitsMap.set(f.traits, bucket);
  }

  const byTraitCount: TraitBucketStats[] = [...byTraitsMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([traits, b]) => {
      const xs = b.intervalsSec.length >= 5 ? b.intervalsSec : b.fightMedSec;
      const logs = xs.map(x => Math.log(Math.max(0.25, x)));
      const fightMed = b.fightMedSec.length > 0 ? quantile(b.fightMedSec, 0.5) : quantile(xs, 0.5);
      return {
        traits,
        fights: b.fights.length,
        sets: b.intervalsSec.length > 0 ? b.intervalsSec.length : b.fights.reduce((s, f) => s + f.sets, 0),
        fightMedianFindSec: roundN(fightMed, 3),
        medianFindSec: roundN(quantile(xs, 0.5), 3),
        meanFindSec: roundN(mean(xs), 3),
        p90FindSec: roundN(quantile(xs, 0.9), 3),
        p95FindSec: roundN(quantile(xs, 0.95), 3),
        lognormalMu: roundN(mean(logs), 4),
        lognormalSigma: roundN(b.intervalsSec.length >= 10 ? sampleStdDev(logs) : 0, 4),
      };
    });

  // Fit baseReactionSec & secondsPerAttribute using per-fight medians (so long untimed fights don't distort buckets)
  const regBuckets = byTraitCount.filter(b => b.fights >= 3 && b.fightMedianFindSec > 0);
  let baseReactionSec = 0.8;
  let secondsPerAttribute = BOTS.average.secondsPerAttribute;
  let regressionMethod: 'linear' | 'floor-anchor' | 'default' = 'default';

  const anchorBucket =
    byTraitCount.length > 0 ? [...byTraitCount].sort((a, b) => b.fights - a.fights)[0] : null;
  // Prefer timed primary-trait median when timed pool has enough fights so untimed browsing doesn't slow the bot
  const paceAnchorMedianSec = (() => {
    if (!anchorBucket) return null;
    const timedAnchor = pacePool.filter(f => f.traits === anchorBucket.traits);
    if (timedAnchor.length >= minTimedFights) {
      const meds = timedAnchor
        .map(f => (f.unhintedInterSetMs.length > 0 ? quantile(f.unhintedInterSetMs, 0.5) : f.medianFindMs))
        .filter((x): x is number => x !== null && x > 0 && x <= maxInterSetMs)
        .map(ms => ms / 1000);
      if (meds.length > 0) return quantile(meds, 0.5);
    }
    return anchorBucket.fightMedianFindSec;
  })();

  if (regBuckets.length >= 2) {
    // Weighted least squares across distinct trait buckets (weighted by fights)
    let sw = 0;
    let sx = 0;
    let sy = 0;
    let sxx = 0;
    let sxy = 0;
    for (const b of regBuckets) {
      const w = b.fights;
      sw += w;
      sx += w * b.traits;
      sy += w * b.fightMedianFindSec;
      sxx += w * b.traits * b.traits;
      sxy += w * b.traits * b.fightMedianFindSec;
    }
    const denom = sw * sxx - sx * sx;
    if (denom > 1e-9) {
      const rawSlope = (sw * sxy - sx * sy) / denom;
      const rawIntercept = (sy - rawSlope * sx) / sw;
      if (rawSlope >= 0.35) {
        const anchor = [...regBuckets].sort((a, b) => b.fights - a.fights)[0];
        const targetMed = paceAnchorMedianSec ?? anchor.fightMedianFindSec;
        baseReactionSec = clamp(rawIntercept, 0.4, 1.35);
        secondsPerAttribute = clamp((targetMed - baseReactionSec) / anchor.traits, 0.65, 3.5);
        regressionMethod = 'linear';
      }
    }
  }
  if (regressionMethod === 'default' && anchorBucket && paceAnchorMedianSec && paceAnchorMedianSec > 0) {
    baseReactionSec = 0.8;
    secondsPerAttribute = clamp((paceAnchorMedianSec - baseReactionSec) / anchorBucket.traits, 0.65, 3.5);
    regressionMethod = 'floor-anchor';
  }

  // 4. Fit Lognormal findTimeSigma: exact within-trait-bucket residuals from recordings, else order statistic
  const paceRecordingLogResiduals: number[] = [];
  const traitLogMeans = new Map<number, number>();
  for (const b of byTraitCount) {
    if (b.sets > 0) traitLogMeans.set(b.traits, b.lognormalMu);
  }
  for (const f of pacePool) {
    const m = traitLogMeans.get(f.traits);
    if (m === undefined) continue;
    for (const ms of f.unhintedInterSetMs) {
      paceRecordingLogResiduals.push(Math.log(ms / 1000) - m);
    }
  }

  let findTimeSigma = 0.75;
  let sigmaMethod: 'recording' | 'order-statistic' | 'default' = 'default';
  if (paceRecordingLogResiduals.length >= 15) {
    findTimeSigma = clamp(sampleStdDev(paceRecordingLogResiduals), 0.25, 1.25);
    sigmaMethod = 'recording';
  } else if (keptFights.length > 0) {
    // Extreme-value order statistic fallback: sigma_i = ln(maxDrought / medFind) / Phi^-1(1 - 0.5 / sets)
    const sigmaEstimates: number[] = [];
    for (const f of pacePool) {
      if (
        f.sets >= 3 &&
        f.medianFindMs !== null &&
        f.medianFindMs > 0 &&
        f.maxDroughtMs !== null &&
        f.maxDroughtMs > f.medianFindMs &&
        f.maxDroughtMs <= maxInterSetMs
      ) {
        const zMax = invNormalCdf(1 - 0.5 / f.sets);
        if (zMax > 0.2) {
          sigmaEstimates.push(Math.log(f.maxDroughtMs / f.medianFindMs) / zMax);
        }
      }
    }
    if (sigmaEstimates.length > 0) {
      findTimeSigma = clamp(quantile(sigmaEstimates, 0.5), 0.25, 1.25);
      sigmaMethod = 'order-statistic';
    }
  }

  // 5. Mistakes, total slip rate, near-miss share, hint eagerness, parries
  const poolSets = pacePool.reduce((s, f) => s + f.sets, 0);
  const poolMistakes = pacePool.reduce((s, f) => s + f.mistakes, 0);
  const poolGraces = pacePool.reduce((s, f) => s + f.gracesUsed, 0);
  const poolAttempts = Math.max(1, poolSets + poolMistakes);

  const unforgivenMistakeRate = keptFights.length > 0 ? poolMistakes / poolAttempts : BOTS.expert.mistakeRate;
  const totalSlipRate = keptFights.length > 0 ? (poolMistakes + poolGraces) / poolAttempts : BOTS.expert.mistakeRate;

  // Estimate nearMissRate from fights where graces were active (spire or gracesUsed > 0)
  const graceFights = keptFights.filter(f => f.mode === 'spire' || f.gracesUsed > 0);
  const graceSaves = graceFights.reduce((s, f) => s + f.gracesUsed, 0);
  const graceFightsMistakes = graceFights.reduce((s, f) => s + f.mistakes, 0);
  const graceFightsSlips = graceSaves + graceFightsMistakes;
  const nearMissRate =
    graceFightsSlips >= 5 ? clamp(graceSaves / graceFightsSlips, 0.5, 0.92) : 0.78;

  // Hint eagerness on fights where hints are actually relevant (timed fights or any hint interaction)
  const hintPool = pacePool.filter(f => f.timed || f.hintsUsed > 0 || f.diedWithHints);
  const hintPoolSets = hintPool.reduce((s, f) => s + f.sets, 0);
  const hintPoolHints = hintPool.reduce((s, f) => s + f.hintsUsed, 0);
  const hintsPerSet = hintPoolSets > 0 ? hintPoolHints / hintPoolSets : 0;
  // In bot.ts, a slow search occurs ~50% of Sets (pace > 1); map empirical hints/set onto hintEagerness
  const hintEagerness = keptFights.length > 0 ? clamp(hintsPerSet / 0.45, 0.08, 0.8) : 0.25;

  // Boldness conservatively scaled to slip rate
  const boldness = keptFights.length > 0 ? clamp(totalSlipRate * 3.0, 0.12, 0.35) : 0.2;

  // Parries across all fights that tracked parries
  const totalParries = keptFights.reduce((s, f) => s + f.parries, 0);
  const totalPerfectParries = keptFights.reduce((s, f) => s + f.perfectParries, 0);
  const perfectParryShare = totalParries > 0 ? totalPerfectParries / totalParries : null;
  const perfectParryWaitChance =
    totalParries >= 5 && perfectParryShare !== null ? clamp(perfectParryShare, 0.02, 0.45) : 0.08;

  // 6. Stratified Empirical-Bayes Cognitive Load by Weapon & Role (`mode x traitBucket`, prior m = 10)
  const fightFindMs = new Map<string, number>();
  const fightMistakeRate = new Map<string, number>();
  const fightDroughtRatio = new Map<string, number>();
  const stratumLogFinds = new Map<string, number[]>();
  const stratumMistakes = new Map<string, number[]>();

  for (const f of keptFights) {
    const medMs = f.unhintedInterSetMs.length > 0 ? quantile(f.unhintedInterSetMs, 0.5) : f.medianFindMs;
    if (medMs === null || medMs <= 0 || medMs > maxInterSetMs) continue;
    fightFindMs.set(f.fightId, medMs);
    const misRate = f.mistakes / Math.max(1, f.sets + f.mistakes);
    fightMistakeRate.set(f.fightId, misRate);
    if (f.maxDroughtMs !== null && f.maxDroughtMs > 0) {
      fightDroughtRatio.set(f.fightId, f.maxDroughtMs / medMs);
    }
    const key = `${f.mode}:${f.traits}T`;
    const lf = stratumLogFinds.get(key) ?? [];
    lf.push(Math.log(medMs));
    stratumLogFinds.set(key, lf);
    const sm = stratumMistakes.get(key) ?? [];
    sm.push(misRate);
    stratumMistakes.set(key, sm);
  }

  const stratumBaseLogFind = new Map<string, number>();
  for (const [k, vals] of stratumLogFinds.entries()) stratumBaseLogFind.set(k, mean(vals));
  const stratumBaseMistake = new Map<string, number>();
  for (const [k, vals] of stratumMistakes.entries()) stratumBaseMistake.set(k, mean(vals));

  interface CogAccum {
    fights: number;
    logRatios: number[];
    findMs: number[];
    droughtRatios: number[];
    mistakeDeltas: number[];
  }
  const weaponAcc = new Map<string, CogAccum>();
  const roleAcc = new Map<WeaponRole, CogAccum>();

  for (const f of keptFights) {
    const medMs = fightFindMs.get(f.fightId);
    if (medMs === undefined) continue;
    const key = `${f.mode}:${f.traits}T`;
    const baseLog = stratumBaseLogFind.get(key);
    if (baseLog === undefined) continue;
    const logRatio = Math.log(medMs) - baseLog;
    const misDelta = (fightMistakeRate.get(f.fightId) ?? 0) - (stratumBaseMistake.get(key) ?? 0);
    const dr = fightDroughtRatio.get(f.fightId);

    const seenRoles = new Set<WeaponRole>();
    for (const wid of f.weapons) {
      const wa = weaponAcc.get(wid) ?? { fights: 0, logRatios: [], findMs: [], droughtRatios: [], mistakeDeltas: [] };
      wa.fights += 1;
      wa.logRatios.push(logRatio);
      wa.findMs.push(medMs);
      if (dr !== undefined) wa.droughtRatios.push(dr);
      wa.mistakeDeltas.push(misDelta);
      weaponAcc.set(wid, wa);

      const role = weaponRole(wid);
      if (!seenRoles.has(role)) {
        seenRoles.add(role);
        const ra = roleAcc.get(role) ?? { fights: 0, logRatios: [], findMs: [], droughtRatios: [], mistakeDeltas: [] };
        ra.fights += 1;
        ra.logRatios.push(logRatio);
        ra.findMs.push(medMs);
        if (dr !== undefined) ra.droughtRatios.push(dr);
        ra.mistakeDeltas.push(misDelta);
        roleAcc.set(role, ra);
      }
    }
  }

  const cognitiveLoadByWeapon: Record<string, number> = {};
  const byWeapon: WeaponCognitiveLoadRow[] = [];
  for (const [weaponId, acc] of weaponAcc.entries()) {
    const rawLog = mean(acc.logRatios);
    const rawMult = Math.exp(rawLog);
    const shrinkWeight = acc.fights / (acc.fights + priorM);
    const shrunkMult = clamp(Math.exp(shrinkWeight * rawLog), 0.75, 1.35);
    const applied = acc.fights >= minWeaponFights && Math.abs(shrunkMult - 1) >= 0.01;
    if (applied) {
      cognitiveLoadByWeapon[weaponId] = roundN(shrunkMult, 3);
    }
    byWeapon.push({
      weaponId,
      role: weaponRole(weaponId),
      fights: acc.fights,
      rawMult: roundN(rawMult, 3),
      shrunkMult: roundN(shrunkMult, 3),
      medianFindMs: Math.round(quantile(acc.findMs, 0.5)),
      droughtRatio: roundN(acc.droughtRatios.length ? quantile(acc.droughtRatios, 0.5) : 1, 2),
      mistakeDelta: roundN(mean(acc.mistakeDeltas), 4),
      applied,
    });
  }
  byWeapon.sort((a, b) => b.shrunkMult - a.shrunkMult || b.fights - a.fights || a.weaponId.localeCompare(b.weaponId));

  const cognitiveLoadByRole: Partial<Record<WeaponRole, number>> = {};
  const byRole: RoleCognitiveLoadRow[] = [];
  for (const roleDef of WEAPON_ROLES) {
    const acc = roleAcc.get(roleDef.id);
    if (!acc || acc.fights === 0) continue;
    const rawLog = mean(acc.logRatios);
    const rawMult = Math.exp(rawLog);
    const shrinkWeight = acc.fights / (acc.fights + priorM);
    const shrunkMult = clamp(Math.exp(shrinkWeight * rawLog), 0.75, 1.35);
    if (acc.fights >= minWeaponFights && Math.abs(shrunkMult - 1) >= 0.005) {
      cognitiveLoadByRole[roleDef.id] = roundN(shrunkMult, 3);
    }
    byRole.push({
      role: roleDef.id,
      label: roleLabel(roleDef.id),
      fights: acc.fights,
      rawMult: roundN(rawMult, 3),
      shrunkMult: roundN(shrunkMult, 3),
      droughtRatio: roundN(acc.droughtRatios.length ? quantile(acc.droughtRatios, 0.5) : 1, 2),
    });
  }
  byRole.sort((a, b) => b.shrunkMult - a.shrunkMult || b.fights - a.fights);

  // 7. Assemble calibrated BotProfile
  const profile: BotProfile = {
    name: 'calibrated_human',
    secondsPerAttribute: roundN(secondsPerAttribute, 3),
    baseReactionSec: roundN(baseReactionSec, 3),
    findTimeSigma: roundN(findTimeSigma, 3),
    maxPaceMultiplier: 5.0,
    mistakeRate: roundN(clamp(totalSlipRate, 0.015, 0.25), 4),
    huntsRainbows: true,
    hintEagerness: roundN(hintEagerness, 3),
    nearMissRate: roundN(nearMissRate, 3),
    boldness: roundN(boldness, 3),
    perfectParryWaitChance: roundN(perfectParryWaitChance, 3),
    ...(Object.keys(cognitiveLoadByWeapon).length > 0 ? { cognitiveLoadByWeapon } : {}),
    ...(Object.keys(cognitiveLoadByRole).length > 0 ? { cognitiveLoadByRole } : {}),
  };

  const allCleanSummary = summarizeCohort(keptFights, maxInterSetMs, findTimeSigma);
  const timedSummary = timedFights.length > 0 ? summarizeCohort(timedFights, maxInterSetMs, findTimeSigma) : null;

  const comparison: BotComparisonRow[] = [
    botMetricsRow(BOTS.novice),
    botMetricsRow(BOTS.average),
    botMetricsRow(BOTS.expert),
    botMetricsRow(profile),
  ];

  return {
    generatedAt: new Date().toISOString(),
    source: opts.source ?? 'posthog',
    audit,
    profile,
    empirical: {
      sigmaMethod,
      regressionMethod,
      allClean: allCleanSummary,
      timed: timedSummary,
      byTraitCount,
      unforgivenMistakeRate: roundN(unforgivenMistakeRate, 4),
      totalSlipRate: roundN(totalSlipRate, 4),
      nearMissRate: roundN(nearMissRate, 3),
      graceFightsSlips,
      graceSaves,
      hintsPerSet: roundN(hintsPerSet, 4),
      parries: totalParries,
      perfectParries: totalPerfectParries,
      perfectParryShare: perfectParryShare !== null ? roundN(perfectParryShare, 4) : null,
    },
    cognitiveLoad: {
      priorM,
      byWeapon,
      byRole,
    },
    comparison,
  };
};

// ─── Markdown Renderer ───────────────────────────────────────────────────────

export const renderCalibrationMarkdown = (res: CalibrationResult): string => {
  const out: string[] = [];
  const row = (cells: (string | number)[]) => out.push(`| ${cells.join(' | ')} |`);
  const a = res.audit;
  const e = res.empirical;
  const p = res.profile;

  out.push('# Human Bot Calibration Report (`calibrated_human`)', '');
  out.push(
    `- **Source:** \`${res.source}\` | **Generated:** \`${res.generatedAt}\``,
    `- **Clean Human Fights:** **${a.kept}** kept (${a.keptTimed} timed) / ${a.totalRaw} raw ` +
      `(dropped: ${a.droppedByEnv} dev-env, ${a.droppedByE2eBot} E2E-bot, ${a.droppedByTutorial} tutorial-1-1, ` +
      `${a.droppedByShort} short, ${a.droppedByCoached} coached, ${a.droppedByPractice} practice, ${a.droppedByBug} bug; ` +
      `${a.deduped} deduped; ${a.recordingsParsed} recordings parsed, ${a.unhintedSetsExtracted} unhinted Sets, ${a.afkGapsTrimmed} >30s AFK gaps trimmed)`,
    `- **Fit Methods:** think-time=\`${e.regressionMethod}\` (\`${p.baseReactionSec ?? 0}s + ${p.secondsPerAttribute}s × traits\`), ` +
      `volatility=\`${e.sigmaMethod}\` (\`σ = ${p.findTimeSigma ?? 0}\`), ` +
      `slipRate=\`${(e.totalSlipRate * 100).toFixed(1)}%\` (unforgiven \`${(e.unforgivenMistakeRate * 100).toFixed(1)}%\`, nearMiss \`${Math.round(e.nearMissRate * 100)}%\`), ` +
      `perfectParryWait=\`${Math.round((p.perfectParryWaitChance ?? 0) * 100)}%\` (${e.perfectParries}/${e.parries} parries)`,
    ''
  );

  out.push('## Calibrated Human vs `BOTS` (`novice` / `average` / `expert`)', '');
  row(['Bot', 'Base + s/Attr', 'Lognormal σ', '3T Median', '3T Mean', '3T p95', 'Max Pace', 'Slip Rate', 'Near-Miss', 'Hint Eager', 'Perfect Parry Wait']);
  row(['---', '---', '---', '---', '---', '---', '---', '---', '---', '---', '---']);
  for (const r of res.comparison) {
    const label = r.name === 'calibrated_human' ? '**calibrated_human**' : `\`${r.name}\``;
    row([
      label,
      `${r.baseReactionSec.toFixed(2)}s + ${r.secondsPerAttribute.toFixed(2)}s`,
      r.findTimeSigma > 0 ? r.findTimeSigma.toFixed(2) : '0 (Uniform)',
      `${r.think3TMedianSec.toFixed(2)}s`,
      `${r.think3TMeanSec.toFixed(2)}s`,
      `${r.think3TP95Sec.toFixed(2)}s`,
      `${r.maxPaceMultiplier.toFixed(1)}×`,
      `${(r.mistakeRate * 100).toFixed(1)}%`,
      `${Math.round(r.nearMissRate * 100)}%`,
      r.hintEagerness.toFixed(2),
      `${Math.round(r.perfectParryWaitChance * 100)}%`,
    ]);
  }
  out.push('');

  if (e.byTraitCount.length > 0) {
    out.push('## Empirical Find-Time Distribution by Trait Count', '');
    row(['Traits', 'Fights', 'Sets', 'Fight Median', 'Set Median', 'Set Mean', 'p90', 'p95', 'Lognormal (μ, σ)']);
    row(['---', '---', '---', '---', '---', '---', '---', '---', '---']);
    for (const b of e.byTraitCount) {
      row([
        `${b.traits}T`,
        b.fights,
        b.sets,
        `${b.fightMedianFindSec.toFixed(2)}s`,
        `${b.medianFindSec.toFixed(2)}s`,
        `${b.meanFindSec.toFixed(2)}s`,
        `${b.p90FindSec.toFixed(2)}s`,
        `${b.p95FindSec.toFixed(2)}s`,
        `${b.lognormalMu.toFixed(2)}, ${b.lognormalSigma.toFixed(2)}`,
      ]);
    }
    out.push('');
  }

  const appliedWeapons = res.cognitiveLoad.byWeapon.filter(w => w.applied);
  if (appliedWeapons.length > 0 || res.cognitiveLoad.byRole.length > 0) {
    out.push(`## Stratified Cognitive Load (Empirical Bayes, prior m = ${res.cognitiveLoad.priorM})`, '');
    if (res.cognitiveLoad.byRole.length > 0) {
      row(['Role', 'Fights', 'Raw Mult', 'Shrunk Mult', 'Median Drought/Med']);
      row(['---', '---', '---', '---', '---']);
      for (const r of res.cognitiveLoad.byRole) {
        row([r.label, r.fights, `${r.rawMult.toFixed(3)}×`, `**${r.shrunkMult.toFixed(3)}×**`, `${r.droughtRatio.toFixed(2)}×`]);
      }
      out.push('');
    }
    if (appliedWeapons.length > 0) {
      row(['Weapon', 'Role', 'Fights', 'Raw Mult', 'Shrunk Mult', 'Med Find', 'Drought/Med', 'Mistake Δ']);
      row(['---', '---', '---', '---', '---', '---', '---', '---']);
      for (const w of appliedWeapons) {
        const md = `${w.mistakeDelta >= 0 ? '+' : ''}${(w.mistakeDelta * 100).toFixed(1)}%`;
        row([
          `\`${w.weaponId}\``,
          w.role,
          w.fights,
          `${w.rawMult.toFixed(3)}×`,
          `**${w.shrunkMult.toFixed(3)}×**`,
          `${w.medianFindMs}ms`,
          `${w.droughtRatio.toFixed(2)}×`,
          md,
        ]);
      }
      out.push('');
    }
  }

  return out.join('\n');
};
